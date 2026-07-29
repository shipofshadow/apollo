<?php

/**
 * Cron / One-shot: backfill_inquiry_reminders.php
 *
 * Does two things in one pass:
 *
 * 1. CANCEL stale reminder jobs — marks any queued/retry
 *    `appointment_reminder_3h` job as "done" (suppressed) when:
 *      - The linked inquiry is cancelled or completed, OR
 *      - The appointment time has already passed.
 *
 * 2. BACKFILL missing reminder jobs — for inquiries that are:
 *      - Status: pending or confirmed
 *      - Appointment is in the future (> 3 hours from now)
 *      - No active/done reminder job already exists
 *    …a new `appointment_reminder_3h` job is created with the correct
 *    run_after time (3 hours before the appointment).
 *
 * Safe to run multiple times — it will not create duplicate jobs.
 *
 * Usage:
 *   php cron/backfill_inquiry_reminders.php [--dry-run] [--verbose]
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

$isDryRun  = in_array('--dry-run',  $argv ?? [], true);
$isVerbose = in_array('--verbose',  $argv ?? [], true);

if ($isDryRun) {
    echo "[DRY RUN] No changes will actually be written.\n";
}

// ---------------------------------------------------------------------------
// STEP 1 — Cancel stale pending reminder jobs
// ---------------------------------------------------------------------------
$cancelled = 0;

if (DB_NAME !== '') {
    echo "\n--- Step 1: Cancelling stale reminder jobs ---\n";
    $db = Database::getInstance();

    // Fetch all queued/retry appointment_reminder_3h jobs
    $staleStmt = $db->query(
        "SELECT id, payload
           FROM notification_jobs
          WHERE event = 'appointment_reminder_3h'
            AND status IN ('queued', 'retry')"
    );
    $pendingJobs = $staleStmt ? $staleStmt->fetchAll(PDO::FETCH_ASSOC) : [];

    foreach ($pendingJobs as $job) {
        $jobId   = (int) ($job['id'] ?? 0);
        $payload = json_decode((string) ($job['payload'] ?? '{}'), true);
        $data    = is_array($payload['data'] ?? null) ? $payload['data'] : (is_array($payload['booking'] ?? null) ? $payload['booking'] : []);

        $inquiryId   = (string) ($data['id'] ?? '');
        $apptDate    = trim((string) ($data['appointmentDate'] ?? $data['appointment_date'] ?? ''));
        $apptTime    = trim((string) ($data['appointmentTime'] ?? $data['appointment_time'] ?? ''));
        $inquiryName = (string) ($data['fullName'] ?? $data['full_name'] ?? 'Unknown');

        $shouldCancel = false;
        $cancelReason = '';

        // Check 1: fetch current status from DB
        if ($inquiryId !== '') {
            $iStmt = $db->prepare("SELECT status, appointment_date, appointment_time FROM customer_inquiries WHERE id = :id LIMIT 1");
            $iStmt->execute([':id' => $inquiryId]);
            $iRow = $iStmt->fetch(PDO::FETCH_ASSOC);

            if ($iRow !== false) {
                $currentStatus = strtolower(trim((string) ($iRow['status'] ?? '')));
                $currentDate   = trim((string) ($iRow['appointment_date'] ?? ''));
                $currentTime   = trim((string) ($iRow['appointment_time'] ?? ''));

                if (in_array($currentStatus, ['cancelled', 'completed'], true)) {
                    $shouldCancel = true;
                    $cancelReason = "inquiry status is now '{$currentStatus}'";
                }

                // Use the freshest date/time from DB in case it was rescheduled
                if ($currentDate !== '') {
                    $apptDate = $currentDate;
                }
                if ($currentTime !== '') {
                    $apptTime = $currentTime;
                }
            }
        }

        // Check 2: appointment time has already passed
        if (!$shouldCancel && $apptDate !== '' && $apptTime !== '') {
            try {
                $apptDt = new \DateTimeImmutable(
                    $apptDate . ' ' . $apptTime,
                    new \DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila')
                );
                if ($apptDt->getTimestamp() <= time()) {
                    $shouldCancel = true;
                    $cancelReason = "appointment {$apptDate} {$apptTime} has already passed";
                }
            } catch (\Throwable $e) {
                // Cannot parse — leave alone
            }
        }

        if ($shouldCancel) {
            if ($isVerbose || $isDryRun) {
                echo "  CANCEL job#{$jobId} [{$inquiryId}] {$inquiryName} – {$cancelReason}\n";
            }
            if (!$isDryRun) {
                $cancelStmt = $db->prepare(
                    "UPDATE notification_jobs
                        SET status = 'done',
                            last_error = :reason,
                            processed_at = NOW()
                      WHERE id = :id
                        AND status IN ('queued', 'retry')"
                );
                $cancelStmt->execute([
                    ':id'     => $jobId,
                    ':reason' => 'backfill: ' . $cancelReason,
                ]);
            }
            $cancelled++;
        }
    }

    echo "  Cancelled stale jobs: {$cancelled}\n";
} else {
    echo "File-storage mode: stale job cancellation skipped (no DB).\n";
}

// ---------------------------------------------------------------------------
// STEP 2 — Backfill missing reminder jobs
// ---------------------------------------------------------------------------
echo "\n--- Step 2: Backfilling missing reminder jobs ---\n";

if (DB_NAME === '') {
    // File-storage mode: load all inquiries from JSON
    $inquiries = (new InquiryService())->getAll();
} else {
    $db = Database::getInstance();
    $stmt = $db->query(
        "SELECT id, full_name, contact_number, email_address, facebook_name,
                plate_number, make, model, year_model, product_to_purchase,
                appointment_date, appointment_time, status, created_at
           FROM customer_inquiries
          WHERE status NOT IN ('cancelled', 'completed')
            AND appointment_date >= CURDATE()
          ORDER BY appointment_date ASC, appointment_time ASC"
    );
    $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

    // Map snake_case DB columns to camelCase for the queue payload
    $inquiries = array_map(static function (array $row): array {
        return [
            'id'                => (string) ($row['id'] ?? ''),
            'fullName'          => (string) ($row['full_name'] ?? ''),
            'contactNumber'     => (string) ($row['contact_number'] ?? ''),
            'emailAddress'      => (string) ($row['email_address'] ?? ''),
            'facebookName'      => (string) ($row['facebook_name'] ?? ''),
            'plateNumber'       => (string) ($row['plate_number'] ?? ''),
            'make'              => (string) ($row['make'] ?? ''),
            'model'             => (string) ($row['model'] ?? ''),
            'yearModel'         => (string) ($row['year_model'] ?? ''),
            'productToPurchase' => (string) ($row['product_to_purchase'] ?? ''),
            'appointmentDate'   => (string) ($row['appointment_date'] ?? ''),
            'appointmentTime'   => (string) ($row['appointment_time'] ?? ''),
            'status'            => (string) ($row['status'] ?? 'pending'),
            'createdAt'         => (string) ($row['created_at'] ?? ''),
        ];
    }, $rows);
}

echo "Found " . count($inquiries) . " upcoming inquiry/inquiries to evaluate.\n";

$queue   = new NotificationJobQueueService();
$queued  = 0;
$skipped = 0;
$tooLate = 0;

// Build a set of inquiry IDs that already have an active/done reminder job
// so we don't create duplicates (DB mode only).
$alreadyQueued = [];
if (DB_NAME !== '') {
    $db = Database::getInstance();
    $checkStmt = $db->query(
        "SELECT payload
           FROM notification_jobs
          WHERE event = 'appointment_reminder_3h'
            AND status IN ('queued', 'retry', 'processing', 'done')"
    );
    foreach (($checkStmt ? $checkStmt->fetchAll(PDO::FETCH_ASSOC) : []) as $jobRow) {
        $p = json_decode((string) ($jobRow['payload'] ?? '{}'), true);
        $inquiryId = (string) (
            ($p['data']['id'] ?? null)
            ?? ($p['booking']['id'] ?? null)
            ?? ''
        );
        if ($inquiryId !== '') {
            $alreadyQueued[$inquiryId] = true;
        }
    }
}

foreach ($inquiries as $inquiry) {
    $inquiryId = (string) ($inquiry['id'] ?? '');
    $date      = trim((string) ($inquiry['appointmentDate'] ?? ''));
    $time      = trim((string) ($inquiry['appointmentTime'] ?? ''));
    $status    = strtolower(trim((string) ($inquiry['status'] ?? '')));
    $name      = (string) ($inquiry['fullName'] ?? $inquiry['full_name'] ?? 'Unknown');

    if ($inquiryId === '' || $date === '' || $time === '') {
        if ($isVerbose) {
            echo "  SKIP [{$inquiryId}] {$name} – missing date/time\n";
        }
        $skipped++;
        continue;
    }

    if (in_array($status, ['cancelled', 'completed'], true)) {
        if ($isVerbose) {
            echo "  SKIP [{$inquiryId}] {$name} – status is {$status}\n";
        }
        $skipped++;
        continue;
    }

    // Already has an active/done reminder job → skip
    if (isset($alreadyQueued[$inquiryId])) {
        if ($isVerbose) {
            echo "  SKIP [{$inquiryId}] {$name} – reminder job already exists\n";
        }
        $skipped++;
        continue;
    }

    // Calculate the run_after timestamp (3 h before appointment)
    // Returns null when the reminder window has already passed
    $runAfter = NotificationJobQueueService::calculateReminderRunAfter($date, $time, 3);

    if ($runAfter === null) {
        if ($isVerbose) {
            echo "  LATE [{$inquiryId}] {$name} – appointment {$date} {$time} is < 3 h away or past\n";
        }
        $tooLate++;
        continue;
    }

    if ($isVerbose || $isDryRun) {
        echo "  QUEUE [{$inquiryId}] {$name} – run_after={$runAfter} (appt {$date} {$time})\n";
    }

    if (!$isDryRun) {
        $queue->dispatch('appointment_reminder_3h', ['data' => $inquiry], $runAfter);
    }

    $queued++;
}

echo "\nDone.\n";
echo "  Cancelled stale : {$cancelled}\n";
echo "  Queued (new)    : {$queued}\n";
echo "  Skipped         : {$skipped} (job exists, cancelled/completed, or missing fields)\n";
echo "  Too late        : {$tooLate} (appointment < 3 h away or already past)\n";
