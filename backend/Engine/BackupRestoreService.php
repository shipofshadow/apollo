<?php

declare(strict_types=1);

final class BackupRestoreService
{
    private const INDEX_FILENAME = 'index.json';

    private string $backupDir;

    public function __construct()
    {
        $this->backupDir = rtrim(realpath(__DIR__ . '/../') ?: (__DIR__ . '/../'), '/\\') . '/storage/backups';
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function listBackups(): array
    {
        $index = $this->readIndex();
        usort($index, static fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return $index;
    }

    /** @param array{storage:string,includeDatabase:bool,includeFiles:bool,createdBy:string} $input */
    public function createBackup(array $input): array
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is required to create backups.', 503);
        }

        $storage = strtolower(trim($input['storage']));
        if (!in_array($storage, ['server', 's3'], true)) {
            throw new RuntimeException('Invalid storage target. Use server or s3.', 422);
        }

        $includeDatabase = $input['includeDatabase'];
        $includeFiles = $input['includeFiles'];
        if (!$includeDatabase && !$includeFiles) {
            throw new RuntimeException('Select at least one backup source (database and/or files).', 422);
        }

        if (!class_exists(ZipArchive::class)) {
            throw new RuntimeException('Backup feature requires PHP ZipArchive extension.', 500);
        }

        $id = date('Ymd_His') . '_' . bin2hex(random_bytes(4));
        $tmpZip = sys_get_temp_dir() . '/apollo_backup_' . $id . '.zip';

        $manifest = [
            'id' => $id,
            'createdAt' => gmdate('c'),
            'createdBy' => trim($input['createdBy']) !== '' ? trim($input['createdBy']) : 'Unknown',
            'includeDatabase' => $includeDatabase,
            'includeFiles' => $includeFiles,
            'storage' => $storage,
            'dbName' => DB_NAME,
        ];

        $zip = new ZipArchive();
        if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Unable to create backup archive.', 500);
        }

        $zip->addFromString('manifest.json', (string) json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        if ($includeDatabase) {
            $zip->addFromString('database.sql', $this->exportDatabaseSql());
        }

        if ($includeFiles) {
            $uploadsDir = rtrim((string) UPLOAD_DIR, '/\\');
            if (is_dir($uploadsDir)) {
                $this->addDirectoryToZip($zip, $uploadsDir, 'uploads');
            }
        }

        $zip->close();

        $finalPath = null;
        $publicUrl = null;
        if ($storage === 'server') {
            $finalPath = $this->backupDir . '/' . $id . '.zip';
            if (!rename($tmpZip, $finalPath)) {
                @unlink($tmpZip);
                throw new RuntimeException('Failed to save backup on server.', 500);
            }
        } else {
            $storageClient = new UploadStorage();
            $publicUrl = $storageClient->upload($tmpZip, $id . '.zip', 'application/zip', 'backups');
            @unlink($tmpZip);
        }

        $entry = [
            'id' => $id,
            'createdAt' => $manifest['createdAt'],
            'createdBy' => $manifest['createdBy'],
            'storage' => $storage,
            'includeDatabase' => $includeDatabase,
            'includeFiles' => $includeFiles,
            'sizeBytes' => $finalPath !== null ? (int) (filesize($finalPath) ?: 0) : null,
            'serverPath' => $finalPath,
            'url' => $publicUrl,
        ];

        $index = $this->readIndex();
        $index[] = $entry;
        $this->writeIndex($index);

        return $entry;
    }

    /** @param array{restoreDatabase:bool,restoreFiles:bool} $input */
    public function restoreBackup(string $id, array $input): array
    {
        $entry = $this->findBackup($id);

        $restoreDatabase = $input['restoreDatabase'];
        $restoreFiles = $input['restoreFiles'];
        if (!$restoreDatabase && !$restoreFiles) {
            throw new RuntimeException('Select at least one restore target (database and/or files).', 422);
        }

        $tmpZip = $this->resolveZipFile($entry);
        $extractDir = sys_get_temp_dir() . '/apollo_restore_' . $id . '_' . bin2hex(random_bytes(3));
        mkdir($extractDir, 0755, true);

        $zip = new ZipArchive();
        if ($zip->open($tmpZip) !== true) {
            @unlink($tmpZip);
            throw new RuntimeException('Backup archive is unreadable.', 422);
        }
        if (!$zip->extractTo($extractDir)) {
            $zip->close();
            @unlink($tmpZip);
            throw new RuntimeException('Unable to extract backup archive.', 500);
        }
        $zip->close();
        @unlink($tmpZip);

        if ($restoreDatabase) {
            $sqlPath = $extractDir . '/database.sql';
            if (!is_file($sqlPath)) {
                throw new RuntimeException('This backup does not contain a database snapshot.', 422);
            }
            $this->restoreDatabaseSql((string) file_get_contents($sqlPath));
        }

        if ($restoreFiles) {
            $uploadsSnapshotDir = $extractDir . '/uploads';
            if (!is_dir($uploadsSnapshotDir)) {
                throw new RuntimeException('This backup does not contain uploaded files.', 422);
            }
            $target = rtrim((string) UPLOAD_DIR, '/\\');
            if (!is_dir($target)) {
                mkdir($target, 0755, true);
            }
            $this->clearDirectory($target);
            $this->copyDirectory($uploadsSnapshotDir, $target);
        }

        $this->clearDirectory($extractDir);
        @rmdir($extractDir);

        return [
            'id' => $id,
            'restoredDatabase' => $restoreDatabase,
            'restoredFiles' => $restoreFiles,
            'restoredAt' => gmdate('c'),
        ];
    }

    /** @return array<string, mixed> */
    public function findBackup(string $id): array
    {
        foreach ($this->readIndex() as $entry) {
            if ((string) ($entry['id'] ?? '') === $id) {
                return $entry;
            }
        }

        throw new RuntimeException('Backup not found.', 404);
    }

    public function getServerFilePath(string $id): string
    {
        $entry = $this->findBackup($id);
        if (($entry['storage'] ?? '') !== 'server') {
            throw new RuntimeException('Only server backups can be downloaded through this endpoint.', 422);
        }

        $path = (string) ($entry['serverPath'] ?? '');
        if ($path === '' || !is_file($path)) {
            throw new RuntimeException('Backup file is missing on server.', 404);
        }

        return $path;
    }

    private function exportDatabaseSql(): string
    {
        $db = Database::getInstance();
        $sql = "SET FOREIGN_KEY_CHECKS=0;\n";

        $tables = $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($tables as $table) {
            $tableName = (string) $table;
            if ($tableName === '') {
                continue;
            }

            $createRow = $db->query('SHOW CREATE TABLE `' . str_replace('`', '``', $tableName) . '`')->fetch(PDO::FETCH_ASSOC);
            $createSql = (string) ($createRow['Create Table'] ?? '');
            if ($createSql !== '') {
                $sql .= "DROP TABLE IF EXISTS `{$tableName}`;\n";
                $sql .= $createSql . ";\n\n";
            }

            $rows = $db->query('SELECT * FROM `' . str_replace('`', '``', $tableName) . '`')->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) {
                continue;
            }

            $columns = array_keys($rows[0]);
            $quotedColumns = implode(', ', array_map(static fn (string $col): string => '`' . str_replace('`', '``', $col) . '`', $columns));

            foreach ($rows as $row) {
                $values = [];
                foreach ($columns as $column) {
                    $value = $row[$column] ?? null;
                    $values[] = $value === null ? 'NULL' : $db->quote((string) $value);
                }
                $sql .= 'INSERT INTO `' . $tableName . '` (' . $quotedColumns . ') VALUES (' . implode(', ', $values) . ");\n";
            }

            $sql .= "\n";
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
        return $sql;
    }

    private function restoreDatabaseSql(string $sql): void
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is required to restore backups.', 503);
        }

        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            foreach ($this->splitSqlStatements($sql) as $statement) {
                $trimmed = trim($statement);
                if ($trimmed === '') {
                    continue;
                }
                $db->exec($trimmed);
            }
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw new RuntimeException('Restore failed: ' . $e->getMessage(), 500);
        }
    }

    /** @return string[] */
    private function splitSqlStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $inString = false;
        $len = strlen($sql);

        for ($i = 0; $i < $len; $i++) {
            $char = $sql[$i];
            $prev = $i > 0 ? $sql[$i - 1] : '';

            if ($char === "'" && $prev !== '\\') {
                $inString = !$inString;
            }

            if ($char === ';' && !$inString) {
                $statements[] = $buffer;
                $buffer = '';
                continue;
            }

            $buffer .= $char;
        }

        if (trim($buffer) !== '') {
            $statements[] = $buffer;
        }

        return $statements;
    }

    private function addDirectoryToZip(ZipArchive $zip, string $sourceDir, string $zipRoot): void
    {
        $sourceDir = rtrim($sourceDir, '/\\');
        if (!is_dir($sourceDir)) {
            return;
        }

        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iter as $item) {
            $path = (string) $item->getPathname();
            $rel = ltrim(str_replace($sourceDir, '', $path), '/\\');
            if ($rel === '') {
                continue;
            }
            $zipPath = $zipRoot . '/' . str_replace('\\', '/', $rel);
            if ($item->isDir()) {
                $zip->addEmptyDir($zipPath);
            } else {
                $zip->addFile($path, $zipPath);
            }
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function readIndex(): array
    {
        $indexPath = $this->backupDir . '/' . self::INDEX_FILENAME;
        if (!is_file($indexPath)) {
            return [];
        }

        $data = json_decode((string) file_get_contents($indexPath), true);
        return is_array($data) ? array_values(array_filter($data, 'is_array')) : [];
    }

    /** @param array<int, array<string, mixed>> $entries */
    private function writeIndex(array $entries): void
    {
        $indexPath = $this->backupDir . '/' . self::INDEX_FILENAME;
        file_put_contents($indexPath, (string) json_encode(array_values($entries), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    /** @param array<string, mixed> $entry */
    private function resolveZipFile(array $entry): string
    {
        $storage = (string) ($entry['storage'] ?? '');
        if ($storage === 'server') {
            $path = (string) ($entry['serverPath'] ?? '');
            if ($path === '' || !is_file($path)) {
                throw new RuntimeException('Backup file is not available on server.', 404);
            }
            $tmpZip = sys_get_temp_dir() . '/apollo_restore_src_' . bin2hex(random_bytes(4)) . '.zip';
            if (!copy($path, $tmpZip)) {
                throw new RuntimeException('Unable to open server backup file.', 500);
            }
            return $tmpZip;
        }

        $url = (string) ($entry['url'] ?? '');
        if ($url === '') {
            throw new RuntimeException('Backup URL is missing.', 404);
        }

        $payload = @file_get_contents($url);
        if ($payload === false) {
            throw new RuntimeException('Unable to download backup from object storage.', 500);
        }

        $tmpZip = sys_get_temp_dir() . '/apollo_restore_src_' . bin2hex(random_bytes(4)) . '.zip';
        file_put_contents($tmpZip, $payload);
        return $tmpZip;
    }

    private function clearDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $items = scandir($dir);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                $this->clearDirectory($path);
                @rmdir($path);
            } else {
                @unlink($path);
            }
        }
    }

    private function copyDirectory(string $source, string $target): void
    {
        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iter as $item) {
            $from = (string) $item->getPathname();
            $rel = ltrim(str_replace($source, '', $from), '/\\');
            if ($rel === '') {
                continue;
            }
            $to = $target . '/' . $rel;

            if ($item->isDir()) {
                if (!is_dir($to)) {
                    mkdir($to, 0755, true);
                }
            } else {
                $parent = dirname($to);
                if (!is_dir($parent)) {
                    mkdir($parent, 0755, true);
                }
                copy($from, $to);
            }
        }
    }
}
