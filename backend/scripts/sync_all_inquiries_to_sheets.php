<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

echo "=========================================================\n";
echo "    1625 AUTOLAB - GOOGLE SHEETS INQUIRY SYNC / BACKFILL\n";
echo "=========================================================\n\n";

$settings = (new SiteSettingsService())->getAll();
$webhookUrl = trim((string) ($settings['google_sheets_webhook_url'] ?? ''));

if ($webhookUrl === '') {
    echo "ERROR: Google Sheets Webhook URL is not configured in Site Settings.\n";
    echo "Please set your Webhook URL in Admin Settings -> Google Sheets Integration.\n";
    exit(1);
}

echo "Configured Webhook URL: {$webhookUrl}\n\n";

$inquiryService = new InquiryService();
$inquiries = $inquiryService->getAll();
$total = count($inquiries);

echo "Found {$total} inquiries in database/storage.\n";
echo "Starting synchronization to Google Sheets...\n\n";

$successCount = 0;
$failCount = 0;

foreach ($inquiries as $index => $inquiry) {
    $num = $index + 1;
    $ref = $inquiry['referenceNumber'] ?? $inquiry['reference_number'] ?? $inquiry['id'] ?? 'N/A';
    $name = $inquiry['fullName'] ?? $inquiry['full_name'] ?? 'Unknown';
    $email = $inquiry['emailAddress'] ?? $inquiry['email_address'] ?? 'N/A';

    echo "[{$num}/{$total}] Syncing REF: {$ref} ({$name} - {$email})... ";

    try {
        GoogleSheetsSyncService::syncInquiry($inquiry);
        echo "OK\n";
        $successCount++;
    } catch (\Throwable $e) {
        echo "FAILED: " . $e->getMessage() . "\n";
        $failCount++;
    }

    // Small delay to prevent hitting Google Apps Script rate limits
    usleep(250000); // 0.25 seconds
}

echo "\n=========================================================\n";
echo "Sync Completed!\n";
echo "Successfully Synced: {$successCount}\n";
echo "Failed:              {$failCount}\n";
echo "Total Processed:     {$total}\n";
echo "=========================================================\n";
