#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Cron worker for queued notification jobs.
 *
 * Example:
 *   * * * * * /usr/bin/php /path/to/backend/cron/process_notification_jobs.php >> /var/log/apollo_notification_queue.log 2>&1
 */

require_once __DIR__ . '/../config/init.php';

if (DB_NAME === '') {
    fwrite(STDERR, "notification queue skipped: DB_NAME is empty\n");
    exit(0);
}

$limit = 0;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $limit = max(0, (int) substr($arg, 8));
    }
}

$queue = new NotificationJobQueueService();
$stats = $queue->processPending($limit > 0 ? $limit : null);

echo sprintf(
    "processed=%d retried=%d failed=%d\n",
    (int) ($stats['processed'] ?? 0),
    (int) ($stats['retried'] ?? 0),
    (int) ($stats['failed'] ?? 0)
);
