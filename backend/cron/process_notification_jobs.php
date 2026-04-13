<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

if (DB_NAME === '') {
    fwrite(STDERR, "notification queue skipped: DB_NAME is empty\n");
    exit(0);
}

$limit = 0;
$campaignLimit = 20;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $limit = max(0, (int) substr($arg, 8));
    }
    if (str_starts_with($arg, '--campaign-limit=')) {
        $campaignLimit = max(1, (int) substr($arg, 17));
    }
}

$scheduled = (new MarketingCampaignService())->runScheduledDue($campaignLimit);

$queue = new NotificationJobQueueService();
$stats = $queue->processPending($limit > 0 ? $limit : null);

echo sprintf(
    "campaigns_processed=%d campaign_errors=%d deliveries_queued=%d processed=%d retried=%d failed=%d\n",
    (int) ($scheduled['processed'] ?? 0),
    is_array($scheduled['errors'] ?? null) ? count($scheduled['errors']) : 0,
    (int) ($scheduled['queuedDeliveries'] ?? 0),
    (int) ($stats['processed'] ?? 0),
    (int) ($stats['retried'] ?? 0),
    (int) ($stats['failed'] ?? 0)
);
