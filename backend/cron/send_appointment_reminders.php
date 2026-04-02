#!/usr/bin/env php
<?php

/**
 * Cron: send_appointment_reminders.php
 *
 * Sends a 24-hour appointment reminder SMS (in Filipino/Tagalog) to every
 * client whose confirmed booking is scheduled for tomorrow.
 *
 * Recommended cron schedule (run once daily, e.g. 8 PM):
 *   0 20 * * * /usr/bin/php /path/to/backend/cron/send_appointment_reminders.php >> /var/log/apollo_reminders.log 2>&1
 *
 * Usage:
 *   php backend/cron/send_appointment_reminders.php [--dry-run]
 */

declare(strict_types=1);

// Bootstrap the application (loads env, DB, autoloader, constants)
require_once __DIR__ . '/../config/init.php';

$isDryRun = in_array('--dry-run', $argv ?? [], true);

if ($isDryRun) {
    echo "[DRY RUN] No SMS will actually be sent.\n";
}

// Tomorrow's date in Y-m-d format (Manila timezone already set in init.php)
$tomorrow = date('Y-m-d', strtotime('+1 day'));
echo "Sending reminders for appointments on: {$tomorrow}\n";

if (DB_NAME === '') {
    echo "ERROR: No database configured – cannot fetch bookings.\n";
    exit(1);
}

$db = Database::getInstance();

// Fetch all confirmed/pending bookings for tomorrow that haven't been cancelled
$stmt = $db->prepare(
    "SELECT id, name, phone, service_name, appointment_date, appointment_time
       FROM bookings
      WHERE appointment_date = :date
        AND status IN ('confirmed', 'pending')
      ORDER BY appointment_time ASC"
);
$stmt->execute([':date' => $tomorrow]);
$bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($bookings)) {
    echo "No bookings found for tomorrow.\n";
    exit(0);
}

echo "Found " . count($bookings) . " booking(s). Sending reminders...\n";

$sms     = new SmsService();
$sent    = 0;
$skipped = 0;

foreach ($bookings as $booking) {
    $name  = (string) ($booking['name']             ?? '');
    $phone = (string) ($booking['phone']            ?? '');
    $time  = (string) ($booking['appointment_time'] ?? '');

    if ($phone === '') {
        echo "  SKIP #{$booking['id']} {$name} – no phone number\n";
        $skipped++;
        continue;
    }

    echo "  → #{$booking['id']} {$name} ({$phone}) at {$time}";

    if ($isDryRun) {
        echo " [DRY RUN]\n";
        $sent++;
        continue;
    }

    try {
        $sms->appointmentReminder($booking);
        echo " ✓\n";
        $sent++;
    } catch (\Throwable $e) {
        echo " ✗ ERROR: " . $e->getMessage() . "\n";
        $skipped++;
    }
}

echo "\nDone. Sent: {$sent}, Skipped: {$skipped}\n";
