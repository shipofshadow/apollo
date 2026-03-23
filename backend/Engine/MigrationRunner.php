<?php

declare(strict_types=1);

/**
 * MigrationRunner
 *
 * Tracks and executes SQL migration files located in backend/migrations/.
 * Each file is executed exactly once; completions are recorded in a
 * `migrations` tracking table.
 *
 * Naming convention:  NNN_description.sql   (e.g. 001_create_users.sql)
 * Files are executed in alphabetical / numeric order.
 *
 * CLI usage (from the backend/ directory):
 *   php migrate.php
 *
 * HTTP usage (requires admin JWT):
 *   POST /api/admin/migrate
 *   GET  /api/admin/migrate   → returns status of all migrations
 */
class MigrationRunner
{
    private PDO    $db;
    private string $migrationsDir;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is not configured. Set DB_NAME in .env.', 503);
        }

        $this->db            = Database::getInstance();
        $this->migrationsDir = __DIR__ . '/../migrations';

        $this->ensureTrackingTable();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Run all pending migrations in order.
     *
     * @return array{ ran: string[], skipped: string[], total: int }
     */
    public function run(): array
    {
        $files   = $this->getMigrationFiles();
        $ran     = $this->getRanMigrations();
        $results = ['ran' => [], 'skipped' => [], 'total' => count($files)];

        foreach ($files as $file) {
            $name = basename($file);

            if (in_array($name, $ran, true)) {
                $results['skipped'][] = $name;
                continue;
            }

            $this->execute($file, $name);
            $results['ran'][] = $name;
        }

        return $results;
    }

    /**
     * Return the status of every migration file.
     *
     * @return array<int, array{ name: string, status: 'ran'|'pending', ran_at: string|null }>
     */
    public function status(): array
    {
        $files  = $this->getMigrationFiles();
        $ranMap = $this->getRanMigrationsWithTimestamp();
        $result = [];

        foreach ($files as $file) {
            $name     = basename($file);
            $ranAt    = $ranMap[$name] ?? null;
            $result[] = [
                'name'   => $name,
                'status' => $ranAt !== null ? 'ran' : 'pending',
                'ran_at' => $ranAt,
            ];
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function ensureTrackingTable(): void
    {
        $this->db->exec(
            'CREATE TABLE IF NOT EXISTS migrations (
                id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name     VARCHAR(255) NOT NULL,
                ran_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_migrations_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /** @return string[] Absolute paths, sorted alphabetically */
    private function getMigrationFiles(): array
    {
        if (!is_dir($this->migrationsDir)) {
            return [];
        }

        $files = glob($this->migrationsDir . '/*.sql');
        if ($files === false) {
            return [];
        }

        sort($files);
        return $files;
    }

    /** @return string[] Migration file names that have already been run */
    private function getRanMigrations(): array
    {
        $stmt = $this->db->query('SELECT name FROM migrations ORDER BY id');
        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /** @return array<string, string>  name => ran_at */
    private function getRanMigrationsWithTimestamp(): array
    {
        $stmt = $this->db->query('SELECT name, ran_at FROM migrations ORDER BY id');
        $map  = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[$row['name']] = $row['ran_at'];
        }
        return $map;
    }

    private function execute(string $filePath, string $name): void
    {
        $sql = file_get_contents($filePath);
        if ($sql === false || trim($sql) === '') {
            return;
        }

        // Execute each semicolon-terminated statement separately so PDO
        // doesn't choke on multi-statement files.
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn (string $s) => $s !== ''
        );

        $this->db->beginTransaction();
        try {
            foreach ($statements as $statement) {
                $this->db->exec($statement);
                // DDL statements (CREATE TABLE, ALTER TABLE, etc.) cause MySQL to
                // issue an implicit commit, silently ending the transaction.
                // After each statement we check whether we are still in a
                // transaction so that the final commit/rollBack calls are only
                // made when a real transaction is still open.
                if (!$this->db->inTransaction()) {
                    break;
                }
            }

            $stmt = $this->db->prepare(
                'INSERT INTO migrations (name) VALUES (:name)'
            );
            $stmt->execute([':name' => $name]);

            if ($this->db->inTransaction()) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw new RuntimeException(
                "Migration '$name' failed: " . $e->getMessage(), 500, $e
            );
        }
    }
}
