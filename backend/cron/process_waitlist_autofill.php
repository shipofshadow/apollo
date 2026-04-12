#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Cron worker for waitlist auto-fill progression.
 *
 * It expires stale claim links and notifies the next waiting user
 * for slots that are available and currently have no active claim.
 *
 * Example (every minute):
 *   * * * * * /usr/bin/php /path/to/backend/cron/process_waitlist_autofill.php >> /var/log/apollo_waitlist_autofill.log 2>&1
 */

require_once __DIR__ . '/../config/init.php';

if (DB_NAME === '') {
    fwrite(STDERR, "waitlist autofill skipped: DB_NAME is empty\n");
    exit(0);
}

$stats = (new WaitlistService())->processAutoFill();

echo sprintf(
    "slotsChecked=%d notified=%d\n",
    (int) ($stats['slotsChecked'] ?? 0),
    (int) ($stats['notified'] ?? 0)
);
