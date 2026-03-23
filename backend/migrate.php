#!/usr/bin/env php
<?php

/**
 * CLI migration runner.
 *
 * Usage (from the backend/ directory):
 *   php migrate.php          – run all pending migrations
 *   php migrate.php status   – show migration status without running anything
 */

declare(strict_types=1);

require_once __DIR__ . '/config/init.php';

$command = $argv[1] ?? 'run';

try {
    $runner = new MigrationRunner();

    if ($command === 'status') {
        $rows = $runner->status();
        echo "\nMigration status:\n";
        echo str_repeat('-', 60) . "\n";
        foreach ($rows as $row) {
            $badge = $row['status'] === 'ran'
                ? "[RAN]     " . ($row['ran_at'] ?? '')
                : "[PENDING]";
            printf("  %-40s %s\n", $row['name'], $badge);
        }
        echo str_repeat('-', 60) . "\n\n";
        exit(0);
    }

    // default: run
    echo "\nRunning migrations…\n";
    $result = $runner->run();

    if (empty($result['ran'])) {
        echo "  Nothing to migrate – all " . $result['total'] . " migration(s) already applied.\n\n";
    } else {
        foreach ($result['ran'] as $name) {
            echo "  ✓ Ran:     $name\n";
        }
        foreach ($result['skipped'] as $name) {
            echo "  – Skipped: $name\n";
        }
        echo "\n  " . count($result['ran']) . " migration(s) applied.\n\n";
    }

    exit(0);
} catch (RuntimeException $e) {
    fwrite(STDERR, "\nError: " . $e->getMessage() . "\n\n");
    exit(1);
}
