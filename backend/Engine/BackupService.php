<?php

declare(strict_types=1);

use Aws\S3\S3Client;

/**
 * BackupService
 *
 * Handles creation, listing, inspection, download, and restoration of system backups:
 *  - Databases (Full MySQL structure & data dump + JSON representation)
 *  - Uploaded media (Cloudflare R2 object storage via AWS S3 SDK, or local filesystem)
 *  - Site settings and system configuration
 */
class BackupService
{
    private string $backupDir;
    private string $tempDir;

    public function __construct()
    {
        $this->backupDir = dirname(__DIR__) . '/storage/backups';
        $this->tempDir   = dirname(__DIR__) . '/storage/backups/tmp';

        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0755, true);
        }

        // Protect backup storage from direct HTTP access
        $htaccess = $this->backupDir . '/.htaccess';
        if (!is_file($htaccess)) {
            file_put_contents($htaccess, "Deny from all\n");
        }
    }

    // -------------------------------------------------------------------------
    // System Health & Storage Statistics
    // -------------------------------------------------------------------------

    /**
     * Gathers diagnostic statistics for the backup dashboard.
     *
     * @return array<string, mixed>
     */
    public function getSystemStats(): array
    {
        $dbConnected = false;
        $dbTableCount = 0;
        $dbTotalRows = 0;
        $dbSizeBytes = 0;

        if (DB_NAME !== '') {
            try {
                $db = Database::getInstance();
                $dbConnected = true;

                $stmt = $db->query('SHOW TABLES');
                $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $dbTableCount = count($tables);

                // Query information_schema for estimated rows & data size
                $sizeStmt = $db->prepare('
                    SELECT SUM(data_length + index_length) AS total_size,
                           SUM(table_rows) AS total_rows
                    FROM information_schema.TABLES
                    WHERE table_schema = :db_name
                ');
                $sizeStmt->execute([':db_name' => DB_NAME]);
                $sizeRow = $sizeStmt->fetch(PDO::FETCH_ASSOC);

                if ($sizeRow) {
                    $dbSizeBytes = (int) ($sizeRow['total_size'] ?? 0);
                    $dbTotalRows = (int) ($sizeRow['total_rows'] ?? 0);
                }
            } catch (\Throwable $e) {
                error_log('[BackupService] getSystemStats DB error: ' . $e->getMessage());
            }
        }

        $disk = strtolower(trim((string) (defined('FILESYSTEM_DISK') ? FILESYSTEM_DISK : 'local')));
        $r2Configured = false;
        $r2Bucket = '';
        $r2Prefix = '';

        if ($disk === 's3') {
            $r2Configured = defined('R2_ACCOUNT_ID') && R2_ACCOUNT_ID !== ''
                && defined('R2_ACCESS_KEY_ID') && R2_ACCESS_KEY_ID !== ''
                && defined('R2_SECRET_ACCESS_KEY') && R2_SECRET_ACCESS_KEY !== ''
                && defined('R2_BUCKET_NAME') && R2_BUCKET_NAME !== '';
            $r2Bucket = defined('R2_BUCKET_NAME') ? (string) R2_BUCKET_NAME : '';
            $r2Prefix = defined('R2_KEY_PREFIX') ? (string) R2_KEY_PREFIX : '';
        }

        $localUploadsDir = dirname(__DIR__) . '/storage/uploads';
        $localUploadsCount = 0;
        $localUploadsBytes = 0;
        if (is_dir($localUploadsDir)) {
            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($localUploadsDir, RecursiveDirectoryIterator::SKIP_DOTS)
            );
            foreach ($files as $file) {
                if ($file->isFile()) {
                    $localUploadsCount++;
                    $localUploadsBytes += $file->getSize();
                }
            }
        }

        $snapshots = $this->listSnapshots();
        $totalBackupBytes = 0;
        foreach ($snapshots as $snap) {
            $totalBackupBytes += (int) ($snap['sizeBytes'] ?? 0);
        }

        return [
            'database' => [
                'connected'  => $dbConnected,
                'name'       => DB_NAME,
                'host'       => DB_HOST,
                'tableCount' => $dbTableCount,
                'totalRows'  => $dbTotalRows,
                'sizeBytes'  => $dbSizeBytes,
            ],
            'storage' => [
                'disk'              => $disk,
                'r2Configured'      => $r2Configured,
                'r2Bucket'          => $r2Bucket,
                'r2Prefix'          => $r2Prefix,
                'localUploadsCount' => $localUploadsCount,
                'localUploadsBytes' => $localUploadsBytes,
            ],
            'backups' => [
                'snapshotCount'    => count($snapshots),
                'totalBackupBytes' => $totalBackupBytes,
                'backupDir'        => $this->backupDir,
            ],
        ];
    }

    // -------------------------------------------------------------------------
    // Snapshot Management
    // -------------------------------------------------------------------------

    /**
     * Lists all available backup files in backend/storage/backups/.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listSnapshots(): array
    {
        $snapshots = [];
        if (!is_dir($this->backupDir)) {
            return $snapshots;
        }

        $items = scandir($this->backupDir);
        if ($items === false) {
            return $snapshots;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item === '.htaccess' || $item === 'tmp') {
                continue;
            }

            $fullPath = $this->backupDir . '/' . $item;
            if (!is_file($fullPath)) {
                continue;
            }

            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (!in_array($ext, ['zip', 'sql'], true)) {
                continue;
            }

            $size = filesize($fullPath) ?: 0;
            $mtime = filemtime($fullPath) ?: time();

            $meta = [
                'filename'   => $item,
                'extension'  => $ext,
                'sizeBytes'  => $size,
                'sizeFormatted' => self::formatBytes($size),
                'createdAt'  => date('Y-m-d H:i:s', $mtime),
                'timestamp'  => $mtime,
                'scope'      => 'unknown',
                'driver'     => 'unknown',
                'tableCount' => 0,
                'mediaCount' => 0,
                'version'    => '1.0',
            ];

            // If it's a zip, peek at manifest.json
            if ($ext === 'zip') {
                $zip = new ZipArchive();
                if ($zip->open($fullPath) === true) {
                    $manifestIndex = $zip->locateName('manifest.json');
                    if ($manifestIndex !== false) {
                        $manifestRaw = $zip->getFromIndex($manifestIndex);
                        if ($manifestRaw !== false) {
                            $parsed = json_decode($manifestRaw, true);
                            if (is_array($parsed)) {
                                $meta['scope']      = $parsed['scope'] ?? 'full';
                                $meta['driver']     = $parsed['driver'] ?? 'local';
                                $meta['tableCount'] = (int) ($parsed['tableCount'] ?? 0);
                                $meta['mediaCount'] = (int) ($parsed['mediaCount'] ?? 0);
                                $meta['version']    = $parsed['version'] ?? '1.0';
                                if (!empty($parsed['createdAt'])) {
                                    $meta['createdAt'] = $parsed['createdAt'];
                                }
                            }
                        }
                    }
                    $zip->close();
                }
            } elseif ($ext === 'sql') {
                $meta['scope'] = 'db';
            }

            $snapshots[] = $meta;
        }

        usort($snapshots, fn($a, $b) => $b['timestamp'] <=> $a['timestamp']);
        return $snapshots;
    }

    /**
     * Delete a snapshot file safely.
     */
    public function deleteSnapshot(string $filename): bool
    {
        $clean = basename(trim($filename));
        if ($clean === '' || $clean === '.' || $clean === '..' || $clean === '.htaccess') {
            throw new InvalidArgumentException('Invalid snapshot filename.', 400);
        }

        $fullPath = $this->backupDir . '/' . $clean;
        if (!is_file($fullPath)) {
            throw new RuntimeException('Backup file not found.', 404);
        }

        return unlink($fullPath);
    }

    /**
     * Returns the absolute path of a snapshot file for downloading.
     */
    public function getSnapshotPath(string $filename): string
    {
        $clean = basename(trim($filename));
        if ($clean === '' || $clean === '.' || $clean === '..' || $clean === '.htaccess') {
            throw new InvalidArgumentException('Invalid snapshot filename.', 400);
        }

        $fullPath = $this->backupDir . '/' . $clean;
        if (!is_file($fullPath)) {
            throw new RuntimeException('Backup file not found.', 404);
        }

        return $fullPath;
    }

    // -------------------------------------------------------------------------
    // Create Backup
    // -------------------------------------------------------------------------

    /**
     * Creates a new backup archive.
     *
     * @param string $scope 'full' | 'db' | 'media'
     * @param array<string, mixed>|null $user
     * @return array<string, mixed>
     */
    public function createBackup(string $scope = 'full', ?array $user = null): array
    {
        $scope = strtolower(trim($scope));
        if (!in_array($scope, ['full', 'db', 'media'], true)) {
            $scope = 'full';
        }

        $timestamp = date('Y-m-d_His');
        $stageId   = 'stage_' . $timestamp . '_' . bin2hex(random_bytes(4));
        $stageDir  = $this->tempDir . '/' . $stageId;

        if (!mkdir($stageDir, 0755, true) && !is_dir($stageDir)) {
            throw new RuntimeException('Failed to create temporary backup staging directory.', 500);
        }

        $zipFilename = "apollo_backup_{$scope}_{$timestamp}.zip";
        $zipFullPath = $this->backupDir . '/' . $zipFilename;

        $dbTablesCount = 0;
        $dbTotalRows   = 0;
        $mediaCount    = 0;
        $mediaBytes    = 0;
        $diskDriver    = strtolower(trim((string) (defined('FILESYSTEM_DISK') ? FILESYSTEM_DISK : 'local')));

        try {
            // 1. Export Database (if scope includes db)
            if ($scope === 'full' || $scope === 'db') {
                $dbResult = $this->dumpDatabase($stageDir);
                $dbTablesCount = $dbResult['tableCount'];
                $dbTotalRows   = $dbResult['totalRows'];

                // Export site settings
                $settings = (new SiteSettingsService())->getAll();
                file_put_contents(
                    $stageDir . '/site_settings.json',
                    json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                );
            }

            // 2. Export Media / Uploads (if scope includes media)
            if ($scope === 'full' || $scope === 'media') {
                $uploadsDir = $stageDir . '/uploads';
                mkdir($uploadsDir, 0755, true);

                if ($diskDriver === 's3') {
                    $mediaResult = $this->downloadR2Media($uploadsDir);
                } else {
                    $mediaResult = $this->copyLocalMedia($uploadsDir);
                }

                $mediaCount = $mediaResult['count'];
                $mediaBytes = $mediaResult['bytes'];

                file_put_contents(
                    $stageDir . '/media_manifest.json',
                    json_encode($mediaResult['manifest'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                );
            }

            // 3. Write Manifest
            $manifest = [
                'version'         => '1.0',
                'createdAt'       => date('Y-m-d H:i:s'),
                'timestamp'       => time(),
                'scope'           => $scope,
                'driver'          => $diskDriver,
                'databaseName'    => DB_NAME,
                'tableCount'      => $dbTablesCount,
                'totalRows'       => $dbTotalRows,
                'mediaCount'      => $mediaCount,
                'mediaTotalBytes' => $mediaBytes,
                'createdBy'       => $user['name'] ?? $user['email'] ?? 'admin',
            ];

            file_put_contents(
                $stageDir . '/manifest.json',
                json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            );

            // 4. Create ZIP Archive
            $zip = new ZipArchive();
            if ($zip->open($zipFullPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('Failed to create ZIP backup archive file.', 500);
            }

            $this->addDirectoryToZip($stageDir, $zip, '');
            $zip->close();

            $finalSize = filesize($zipFullPath) ?: 0;

            // Log activity
            try {
                (new ActivityLog())->log(
                    ActivityEvents::SITE_SETTINGS_UPDATED,
                    'System Backup created (' . strtoupper($scope) . '): ' . $zipFilename . ' (' . self::formatBytes($finalSize) . ')',
                    [
                        'action'     => 'backup_created',
                        'filename'   => $zipFilename,
                        'scope'      => $scope,
                        'sizeBytes'  => $finalSize,
                        'tableCount' => $dbTablesCount,
                        'mediaCount' => $mediaCount,
                    ]
                );
            } catch (\Throwable) {}

            return [
                'success'       => true,
                'filename'      => $zipFilename,
                'sizeBytes'     => $finalSize,
                'sizeFormatted' => self::formatBytes($finalSize),
                'createdAt'     => $manifest['createdAt'],
                'scope'         => $scope,
                'tableCount'    => $dbTablesCount,
                'totalRows'     => $dbTotalRows,
                'mediaCount'    => $mediaCount,
                'manifest'      => $manifest,
            ];
        } finally {
            // Clean up staging directory
            self::deleteDirectoryRecursively($stageDir);
        }
    }

    // -------------------------------------------------------------------------
    // Inspect Backup (Pre-flight Preview)
    // -------------------------------------------------------------------------

    /**
     * Inspects an uploaded file or existing snapshot without modifying anything.
     *
     * @param string $sourcePath Path to .zip or .sql file
     * @return array<string, mixed>
     */
    public function inspectBackup(string $sourcePath): array
    {
        if (!is_file($sourcePath)) {
            throw new RuntimeException('Specified backup file does not exist.', 404);
        }

        $size = filesize($sourcePath) ?: 0;
        $ext  = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));

        if ($ext === 'sql') {
            $content = file_get_contents($sourcePath, false, null, 0, 500000) ?: '';
            $createTableMatches = preg_match_all('/CREATE\s+TABLE/i', $content);

            return [
                'valid'           => true,
                'type'            => 'sql',
                'filename'        => basename($sourcePath),
                'sizeBytes'       => $size,
                'sizeFormatted'   => self::formatBytes($size),
                'createdAt'       => date('Y-m-d H:i:s', filemtime($sourcePath) ?: time()),
                'scope'           => 'db',
                'hasDatabase'     => true,
                'hasMedia'        => false,
                'hasSettings'     => false,
                'tableCount'      => $createTableMatches ?: 1,
                'mediaCount'      => 0,
                'manifest'        => null,
            ];
        }

        if ($ext !== 'zip') {
            throw new InvalidArgumentException('Unsupported backup format. Must be .zip or .sql.', 422);
        }

        $zip = new ZipArchive();
        if ($zip->open($sourcePath) !== true) {
            throw new RuntimeException('Unable to open or read ZIP backup archive.', 422);
        }

        $hasManifest = false;
        $hasDatabase = false;
        $hasMedia    = false;
        $hasSettings = false;
        $manifest    = null;
        $mediaFilesCount = 0;
        $tablesFound = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if ($name === false) continue;

            if ($name === 'manifest.json') {
                $hasManifest = true;
                $raw = $zip->getFromIndex($i);
                if ($raw !== false) {
                    $manifest = json_decode($raw, true);
                }
            } elseif ($name === 'database.sql' || $name === 'database.json') {
                $hasDatabase = true;
            } elseif ($name === 'site_settings.json') {
                $hasSettings = true;
            } elseif (str_starts_with($name, 'uploads/') && !str_ends_with($name, '/')) {
                $hasMedia = true;
                $mediaFilesCount++;
            }
        }

        // If database.json is present, peek at table names
        $dbJsonIndex = $zip->locateName('database.json');
        if ($dbJsonIndex !== false) {
            $rawDbJson = $zip->getFromIndex($dbJsonIndex);
            if ($rawDbJson !== false) {
                $dbArr = json_decode($rawDbJson, true);
                if (is_array($dbArr)) {
                    $tablesFound = array_keys($dbArr);
                }
            }
        }

        $zip->close();

        $scope = $manifest['scope'] ?? ($hasDatabase && $hasMedia ? 'full' : ($hasDatabase ? 'db' : ($hasMedia ? 'media' : 'custom')));
        $tableCount = $manifest['tableCount'] ?? count($tablesFound);
        $createdAt = $manifest['createdAt'] ?? date('Y-m-d H:i:s', filemtime($sourcePath) ?: time());

        return [
            'valid'         => true,
            'type'          => 'zip',
            'filename'      => basename($sourcePath),
            'sizeBytes'     => $size,
            'sizeFormatted' => self::formatBytes($size),
            'createdAt'     => $createdAt,
            'scope'         => $scope,
            'driver'        => $manifest['driver'] ?? 'unknown',
            'hasDatabase'   => $hasDatabase,
            'hasMedia'      => $hasMedia,
            'hasSettings'   => $hasSettings,
            'tableCount'    => $tableCount,
            'tables'        => array_slice($tablesFound, 0, 30),
            'mediaCount'    => $mediaFilesCount,
            'manifest'      => $manifest,
        ];
    }

    // -------------------------------------------------------------------------
    // Restore Backup
    // -------------------------------------------------------------------------

    /**
     * Restores system state from a backup archive or SQL file.
     *
     * @param string $sourcePath Path to backup file (.zip or .sql)
     * @param array<string, bool> $options
     * @param array<string, mixed>|null $user
     * @return array<string, mixed>
     */
    public function restoreBackup(string $sourcePath, array $options = [], ?array $user = null): array
    {
        if (!is_file($sourcePath)) {
            throw new RuntimeException('Backup source file not found.', 404);
        }

        $restoreDb       = $options['restoreDatabase'] ?? true;
        $restoreMedia    = $options['restoreMedia'] ?? true;
        $restoreSettings = $options['restoreSettings'] ?? true;

        $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));

        $startTime = microtime(true);
        $tablesRestored = 0;
        $statementsExecuted = 0;
        $mediaRestoredCount = 0;
        $settingsRestored = false;

        // Direct SQL file restore
        if ($ext === 'sql') {
            if ($restoreDb) {
                $res = $this->executeSqlDump($sourcePath);
                $statementsExecuted = $res['executed'];
                $tablesRestored = $res['tables'];
            }

            return [
                'success'            => true,
                'durationSeconds'    => round(microtime(true) - $startTime, 2),
                'tablesRestored'     => $tablesRestored,
                'statementsExecuted' => $statementsExecuted,
                'mediaRestoredCount' => 0,
                'settingsRestored'   => false,
            ];
        }

        if ($ext !== 'zip') {
            throw new InvalidArgumentException('Unsupported file format for restore. Must be .zip or .sql', 422);
        }

        // Unpack ZIP into temporary staging folder
        $stageId  = 'restore_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));
        $stageDir = $this->tempDir . '/' . $stageId;

        if (!mkdir($stageDir, 0755, true) && !is_dir($stageDir)) {
            throw new RuntimeException('Failed to create restore temporary staging folder.', 500);
        }

        try {
            $zip = new ZipArchive();
            if ($zip->open($sourcePath) !== true) {
                throw new RuntimeException('Failed to open ZIP backup archive.', 422);
            }

            $zip->extractTo($stageDir);
            $zip->close();

            // 1. Restore Database
            if ($restoreDb) {
                $sqlPath = $stageDir . '/database.sql';
                if (is_file($sqlPath)) {
                    $dbRes = $this->executeSqlDump($sqlPath);
                    $statementsExecuted = $dbRes['executed'];
                    $tablesRestored     = $dbRes['tables'];
                }
            }

            // 2. Restore Site Settings
            if ($restoreSettings) {
                $settingsPath = $stageDir . '/site_settings.json';
                if (is_file($settingsPath)) {
                    $rawSettings = file_get_contents($settingsPath);
                    if ($rawSettings !== false) {
                        $parsedSettings = json_decode($rawSettings, true);
                        if (is_array($parsedSettings)) {
                            (new SiteSettingsService())->update($parsedSettings);
                            $settingsRestored = true;
                        }
                    }
                }
            }

            // 3. Restore Media / Uploaded Images
            if ($restoreMedia) {
                $uploadsDir = $stageDir . '/uploads';
                if (is_dir($uploadsDir)) {
                    $diskDriver = strtolower(trim((string) (defined('FILESYSTEM_DISK') ? FILESYSTEM_DISK : 'local')));
                    if ($diskDriver === 's3') {
                        $mediaRes = $this->uploadR2Media($uploadsDir);
                    } else {
                        $mediaRes = $this->restoreLocalMedia($uploadsDir);
                    }
                    $mediaRestoredCount = $mediaRes['count'];
                }
            }

            // Log activity
            try {
                (new ActivityLog())->log(
                    ActivityEvents::SITE_SETTINGS_UPDATED,
                    'System Backup restored from: ' . basename($sourcePath) . " ({$tablesRestored} tables, {$mediaRestoredCount} media files)",
                    [
                        'action'             => 'backup_restored',
                        'filename'           => basename($sourcePath),
                        'tablesRestored'     => $tablesRestored,
                        'statementsExecuted' => $statementsExecuted,
                        'mediaRestoredCount' => $mediaRestoredCount,
                        'settingsRestored'   => $settingsRestored,
                        'restoredBy'         => $user['email'] ?? $user['name'] ?? 'admin',
                    ]
                );
            } catch (\Throwable) {}

            return [
                'success'            => true,
                'durationSeconds'    => round(microtime(true) - $startTime, 2),
                'tablesRestored'     => $tablesRestored,
                'statementsExecuted' => $statementsExecuted,
                'mediaRestoredCount' => $mediaRestoredCount,
                'settingsRestored'   => $settingsRestored,
            ];
        } finally {
            self::deleteDirectoryRecursively($stageDir);
        }
    }

    // -------------------------------------------------------------------------
    // Internal Database Dump & Execution Helpers
    // -------------------------------------------------------------------------

    /**
     * Dumps all MySQL tables to database.sql and database.json.
     *
     * @return array{tableCount: int, totalRows: int}
     */
    private function dumpDatabase(string $stageDir): array
    {
        if (DB_NAME === '') {
            return ['tableCount' => 0, 'totalRows' => 0];
        }

        $db = Database::getInstance();
        $stmt = $db->query('SHOW TABLES');
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $sqlHandle = fopen($stageDir . '/database.sql', 'wb');
        if ($sqlHandle === false) {
            throw new RuntimeException('Failed to open database.sql for writing.', 500);
        }

        $now = date('Y-m-d H:i:s');
        fwrite($sqlHandle, "-- Apollo Database Backup\n");
        fwrite($sqlHandle, "-- Generated at: {$now}\n");
        fwrite($sqlHandle, "-- Database: " . DB_NAME . "\n\n");
        fwrite($sqlHandle, "SET NAMES utf8mb4;\n");
        fwrite($sqlHandle, "SET FOREIGN_KEY_CHECKS = 0;\n\n");

        $databaseJson = [];
        $totalRows = 0;

        foreach ($tables as $table) {
            $table = (string) $table;

            // 1. Get CREATE TABLE statement
            $createStmt = $db->query("SHOW CREATE TABLE `{$table}`");
            $createRow  = $createStmt->fetch(PDO::FETCH_ASSOC);
            $createSql  = $createRow['Create Table'] ?? '';

            fwrite($sqlHandle, "-- --------------------------------------------------------\n");
            fwrite($sqlHandle, "-- Table structure for `{$table}`\n");
            fwrite($sqlHandle, "-- --------------------------------------------------------\n");
            fwrite($sqlHandle, "DROP TABLE IF EXISTS `{$table}`;\n");
            fwrite($sqlHandle, $createSql . ";\n\n");

            // 2. Dump Table Data in batches
            fwrite($sqlHandle, "-- Dumping data for table `{$table}`\n");
            $databaseJson[$table] = [];

            $countStmt = $db->query("SELECT COUNT(*) FROM `{$table}`");
            $rowCount  = (int) $countStmt->fetchColumn();
            $totalRows += $rowCount;

            if ($rowCount > 0) {
                $offset = 0;
                $batchSize = 500;

                while ($offset < $rowCount) {
                    $dataStmt = $db->prepare("SELECT * FROM `{$table}` LIMIT :limit OFFSET :offset");
                    $dataStmt->bindValue(':limit', $batchSize, PDO::PARAM_INT);
                    $dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                    $dataStmt->execute();
                    $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

                    if (empty($rows)) {
                        break;
                    }

                    // Write JSON representation
                    foreach ($rows as $r) {
                        $databaseJson[$table][] = $r;
                    }

                    // Write SQL INSERT statements
                    $columns = array_keys($rows[0]);
                    $quotedCols = array_map(fn($c) => "`{$c}`", $columns);
                    $colList = implode(', ', $quotedCols);

                    $valuesChunks = [];
                    foreach ($rows as $row) {
                        $vals = [];
                        foreach ($row as $val) {
                            if ($val === null) {
                                $vals[] = 'NULL';
                            } elseif (is_int($val) || is_float($val)) {
                                $vals[] = (string) $val;
                            } else {
                                $vals[] = $db->quote((string) $val);
                            }
                        }
                        $valuesChunks[] = '(' . implode(', ', $vals) . ')';
                    }

                    $insertSql = "INSERT INTO `{$table}` ({$colList}) VALUES\n" . implode(",\n", $valuesChunks) . ";\n";
                    fwrite($sqlHandle, $insertSql);

                    $offset += $batchSize;
                }
            }

            fwrite($sqlHandle, "\n");
        }

        fwrite($sqlHandle, "SET FOREIGN_KEY_CHECKS = 1;\n");
        fclose($sqlHandle);

        file_put_contents(
            $stageDir . '/database.json',
            json_encode($databaseJson, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );

        return ['tableCount' => count($tables), 'totalRows' => $totalRows];
    }

    /**
     * Executes SQL dump line-by-line / statement-by-statement safely.
     *
     * @return array{executed: int, tables: int}
     */
    private function executeSqlDump(string $sqlFilePath): array
    {
        $db = Database::getInstance();
        $db->exec('SET FOREIGN_KEY_CHECKS = 0;');

        $handle = fopen($sqlFilePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Failed to read SQL dump file.', 500);
        }

        $currentQuery = '';
        $executed = 0;
        $tablesFound = [];

        try {
            while (($line = fgets($handle)) !== false) {
                $trimmed = trim($line);

                // Skip comments and empty lines
                if ($trimmed === '' || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '/*')) {
                    continue;
                }

                $currentQuery .= $line;

                // Check if statement ends with semicolon
                if (str_ends_with($trimmed, ';')) {
                    $stmtText = trim($currentQuery);
                    if ($stmtText !== '') {
                        if (preg_match('/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i', $stmtText, $m)) {
                            $tablesFound[$m[1]] = true;
                        }

                        $db->exec($stmtText);
                        $executed++;
                    }
                    $currentQuery = '';
                }
            }
        } finally {
            fclose($handle);
            $db->exec('SET FOREIGN_KEY_CHECKS = 1;');
        }

        return ['executed' => $executed, 'tables' => count($tablesFound)];
    }

    // -------------------------------------------------------------------------
    // Internal Media / Object Storage Helpers
    // -------------------------------------------------------------------------

    /**
     * Downloads all Cloudflare R2 uploaded objects into local staging directory.
     *
     * @return array{count: int, bytes: int, manifest: array<int, mixed>}
     */
    private function downloadR2Media(string $targetDir): array
    {
        $s3 = $this->getS3Client();
        $prefix = trim((string) (defined('R2_KEY_PREFIX') ? R2_KEY_PREFIX : ''), '/');
        $bucket = (string) (defined('R2_BUCKET_NAME') ? R2_BUCKET_NAME : '');

        $manifest = [];
        $totalCount = 0;
        $totalBytes = 0;

        $params = ['Bucket' => $bucket];
        if ($prefix !== '') {
            $params['Prefix'] = $prefix;
        }

        do {
            $result = $s3->listObjectsV2($params);
            $objects = $result['Contents'] ?? [];

            foreach ($objects as $obj) {
                $key  = (string) ($obj['Key'] ?? '');
                $size = (int) ($obj['Size'] ?? 0);

                if ($key === '' || str_ends_with($key, '/')) {
                    continue;
                }

                // Relative path inside uploads archive
                $relPath = $prefix !== '' && str_starts_with($key, $prefix . '/')
                    ? substr($key, strlen($prefix) + 1)
                    : $key;

                $destFile = $targetDir . '/' . $relPath;
                $destDir  = dirname($destFile);
                if (!is_dir($destDir)) {
                    mkdir($destDir, 0755, true);
                }

                // Download object
                $s3->getObject([
                    'Bucket' => $bucket,
                    'Key'    => $key,
                    'SaveAs' => $destFile,
                ]);

                $totalCount++;
                $totalBytes += $size;

                $manifest[] = [
                    'key'       => $key,
                    'relPath'   => $relPath,
                    'sizeBytes' => $size,
                    'mtime'     => (string) ($obj['LastModified'] ?? ''),
                ];
            }

            $params['ContinuationToken'] = $result['NextContinuationToken'] ?? null;
        } while (!empty($result['IsTruncated']));

        return ['count' => $totalCount, 'bytes' => $totalBytes, 'manifest' => $manifest];
    }

    /**
     * Uploads media from staging folder back into Cloudflare R2.
     *
     * @return array{count: int}
     */
    private function uploadR2Media(string $uploadsDir): array
    {
        $s3 = $this->getS3Client();
        $prefix = trim((string) (defined('R2_KEY_PREFIX') ? R2_KEY_PREFIX : ''), '/');
        $bucket = (string) (defined('R2_BUCKET_NAME') ? R2_BUCKET_NAME : '');

        $count = 0;
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($uploadsDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if (!$file->isFile()) continue;

            $relPath = ltrim(substr($file->getPathname(), strlen($uploadsDir)), '/\\');
            $relPath = str_replace('\\', '/', $relPath);

            $key = $prefix !== '' ? ($prefix . '/' . $relPath) : $relPath;

            $mime = mime_content_type($file->getPathname()) ?: 'application/octet-stream';

            $s3->putObject([
                'Bucket'      => $bucket,
                'Key'         => $key,
                'SourceFile'  => $file->getPathname(),
                'ContentType' => $mime,
            ]);

            $count++;
        }

        return ['count' => $count];
    }

    /**
     * Copies local uploads storage into staging uploads directory.
     *
     * @return array{count: int, bytes: int, manifest: array<int, mixed>}
     */
    private function copyLocalMedia(string $targetDir): array
    {
        $sourceDir = dirname(__DIR__) . '/storage/uploads';
        $manifest = [];
        $totalCount = 0;
        $totalBytes = 0;

        if (!is_dir($sourceDir)) {
            return ['count' => 0, 'bytes' => 0, 'manifest' => []];
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if (!$file->isFile()) continue;

            $relPath = ltrim(substr($file->getPathname(), strlen($sourceDir)), '/\\');
            $destFile = $targetDir . '/' . $relPath;
            $destDir  = dirname($destFile);

            if (!is_dir($destDir)) {
                mkdir($destDir, 0755, true);
            }

            copy($file->getPathname(), $destFile);
            $size = $file->getSize();

            $totalCount++;
            $totalBytes += $size;

            $manifest[] = [
                'relPath'   => str_replace('\\', '/', $relPath),
                'sizeBytes' => $size,
            ];
        }

        return ['count' => $totalCount, 'bytes' => $totalBytes, 'manifest' => $manifest];
    }

    /**
     * Restores staging media into local storage/uploads folder.
     *
     * @return array{count: int}
     */
    private function restoreLocalMedia(string $uploadsDir): array
    {
        $destDir = dirname(__DIR__) . '/storage/uploads';
        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }

        $count = 0;
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($uploadsDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if (!$file->isFile()) continue;

            $relPath = ltrim(substr($file->getPathname(), strlen($uploadsDir)), '/\\');
            $destFile = $destDir . '/' . $relPath;
            $parentDir = dirname($destFile);

            if (!is_dir($parentDir)) {
                mkdir($parentDir, 0755, true);
            }

            copy($file->getPathname(), $destFile);
            $count++;
        }

        return ['count' => $count];
    }

    private function getS3Client(): S3Client
    {
        return new S3Client([
            'version'                 => 'latest',
            'region'                  => 'auto',
            'endpoint'                => 'https://' . (defined('R2_ACCOUNT_ID') ? R2_ACCOUNT_ID : '') . '.r2.cloudflarestorage.com',
            'credentials'             => [
                'key'    => defined('R2_ACCESS_KEY_ID') ? R2_ACCESS_KEY_ID : '',
                'secret' => defined('R2_SECRET_ACCESS_KEY') ? R2_SECRET_ACCESS_KEY : '',
            ],
            'use_path_style_endpoint' => true,
        ]);
    }

    // -------------------------------------------------------------------------
    // Static Utility Helpers
    // -------------------------------------------------------------------------

    private function addDirectoryToZip(string $sourceDir, ZipArchive $zip, string $localPrefix): void
    {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($files as $file) {
            $filePath = $file->getPathname();
            $relPath  = ltrim(substr($filePath, strlen($sourceDir)), '/\\');
            $zipPath  = $localPrefix !== '' ? ($localPrefix . '/' . $relPath) : $relPath;
            $zipPath  = str_replace('\\', '/', $zipPath);

            if ($file->isDir()) {
                $zip->addEmptyDir($zipPath);
            } elseif ($file->isFile()) {
                $zip->addFile($filePath, $zipPath);
            }
        }
    }

    public static function deleteDirectoryRecursively(string $dir): void
    {
        if (!is_dir($dir)) return;

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($items as $item) {
            if ($item->isDir()) {
                rmdir($item->getPathname());
            } else {
                unlink($item->getPathname());
            }
        }

        rmdir($dir);
    }

    public static function formatBytes(int $bytes, int $precision = 2): string
    {
        if ($bytes <= 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = min((int) floor(log($bytes, 1024)), count($units) - 1);
        return round($bytes / (1024 ** $power), $precision) . ' ' . $units[$power];
    }
}
