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

        // Split on statement-terminating semicolons while ignoring semicolons
        // that appear inside single- or double-quoted string literals.
        $statements = $this->splitStatements($sql);

        $this->db->beginTransaction();
        $transactionOpen = true;
        try {
            foreach ($statements as $statement) {
                $this->db->exec($statement);
                // DDL statements may trigger an implicit commit on MySQL.
                // Keep executing remaining statements, but avoid commit/rollback
                // once the transaction has been auto-closed.
                if ($transactionOpen && !$this->db->inTransaction()) {
                    $transactionOpen = false;
                }
            }

            $stmt = $this->db->prepare(
                'INSERT INTO migrations (name) VALUES (:name)'
            );
            $stmt->execute([':name' => $name]);

            if ($transactionOpen && $this->db->inTransaction()) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($transactionOpen && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw new RuntimeException(
                "Migration '$name' failed: " . $e->getMessage(), 500, $e
            );
        }
    }

    /**
     * Split a SQL string into individual statements on semicolons, but skip
     * semicolons that appear inside single- or double-quoted string literals
     * or inside -- line comments.
     * Handles both the SQL standard doubled-quote escape ('') and the
     * backslash escape (\').
     *
     * @return string[]
     */
    private function splitStatements(string $sql): array
    {
        $statements = [];
        $current    = '';
        $inString   = false;
        $stringChar = '';
        $len        = strlen($sql);

        for ($i = 0; $i < $len; $i++) {
            $char = $sql[$i];

            if ($inString) {
                $current .= $char;

                if ($char === '\\') {
                    // Backslash escape — consume next character as-is.
                    if ($i + 1 < $len) {
                        $current .= $sql[++$i];
                    }
                } elseif ($char === $stringChar) {
                    // Doubled-quote escape ('' or "").
                    if ($i + 1 < $len && $sql[$i + 1] === $stringChar) {
                        $current .= $sql[++$i];
                    } else {
                        $inString = false;
                    }
                }
            } else {
                // Detect the start of a -- line comment and skip to end-of-line,
                // appending the comment text so the surrounding whitespace is
                // preserved but no semicolon inside it can split statements.
                if ($char === '-' && $i + 1 < $len && $sql[$i + 1] === '-') {
                    // Consume everything up to (but not including) the newline.
                    while ($i < $len && $sql[$i] !== "\n") {
                        $current .= $sql[$i++];
                    }
                    // Back up one so the outer loop's $i++ lands on the '\n'.
                    $i--;
                } elseif ($char === "'" || $char === '"') {
                    $inString   = true;
                    $stringChar = $char;
                    $current   .= $char;
                } elseif ($char === ';') {
                    $trimmed = trim($current);
                    if ($trimmed !== '') {
                        $statements[] = $trimmed;
                    }
                    $current = '';
                } else {
                    $current .= $char;
                }
            }
        }

        $trimmed = trim($current);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }
}
