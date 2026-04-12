<?php

declare(strict_types=1);

/**
 * Lightweight DB-backed queue for notification side effects (email/SMS/in-app).
 *
 * Queue mode is enabled when DB is configured and NOTIFICATION_QUEUE_ENABLED=true.
 * If queueing is unavailable, events are executed inline as a safe fallback.
 */
class NotificationJobQueueService
{
    private bool $queueEnabled;
    private ?\PDO $db;

    public function __construct()
    {
        $this->queueEnabled = DB_NAME !== ''
            && (!defined('NOTIFICATION_QUEUE_ENABLED') || (bool) NOTIFICATION_QUEUE_ENABLED);
        $this->db = DB_NAME !== '' ? Database::getInstance() : null;
    }

    /** @param array<string, mixed> $payload */
    public function dispatch(string $event, array $payload): void
    {
        if (!$this->queueEnabled || $this->db === null) {
            $this->handleNow($event, $payload);
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO notification_jobs (event, payload, status, run_after)
             VALUES (:event, :payload, "queued", NOW())'
        );
        $stmt->execute([
            ':event' => $event,
            ':payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    public function processPending(?int $limit = null): array
    {
        if ($this->db === null) {
            return ['processed' => 0, 'failed' => 0, 'retried' => 0];
        }

        $batch = $limit ?? (defined('NOTIFICATION_QUEUE_BATCH_SIZE') ? (int) NOTIFICATION_QUEUE_BATCH_SIZE : 25);
        if ($batch < 1) {
            $batch = 1;
        }

        $stats = ['processed' => 0, 'failed' => 0, 'retried' => 0];

        $stmt = $this->db->prepare(
            'SELECT *
               FROM notification_jobs
              WHERE status IN ("queued", "retry")
                AND run_after <= NOW()
              ORDER BY id ASC
              LIMIT :lim'
        );
        $stmt->bindValue(':lim', $batch, \PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        foreach ($jobs as $job) {
            $jobId = (int) ($job['id'] ?? 0);
            if ($jobId <= 0) {
                continue;
            }

            $lock = $this->db->prepare(
                'UPDATE notification_jobs
                    SET status = "processing", attempts = attempts + 1
                  WHERE id = :id
                    AND status IN ("queued", "retry")'
            );
            $lock->execute([':id' => $jobId]);
            if ($lock->rowCount() === 0) {
                continue;
            }

            $attempts = ((int) ($job['attempts'] ?? 0)) + 1;
            $maxAttempts = max(1, (int) ($job['max_attempts'] ?? 5));
            $event = (string) ($job['event'] ?? '');
            $payload = json_decode((string) ($job['payload'] ?? '{}'), true);
            if (!is_array($payload)) {
                $payload = [];
            }

            try {
                $this->handleNow($event, $payload);
                $done = $this->db->prepare(
                    'UPDATE notification_jobs
                        SET status = "done",
                            processed_at = NOW(),
                            last_error = NULL
                      WHERE id = :id'
                );
                $done->execute([':id' => $jobId]);
                $stats['processed']++;
            } catch (\Throwable $e) {
                if ($attempts >= $maxAttempts) {
                    $fail = $this->db->prepare(
                        'UPDATE notification_jobs
                            SET status = "failed",
                                last_error = :err
                          WHERE id = :id'
                    );
                    $fail->execute([
                        ':id' => $jobId,
                        ':err' => mb_substr($e->getMessage(), 0, 2000),
                    ]);
                    $stats['failed']++;
                } else {
                    $retryDelay = max(15, (defined('NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS') ? (int) NOTIFICATION_QUEUE_RETRY_DELAY_SECONDS : 60));
                    $retry = $this->db->prepare(
                        'UPDATE notification_jobs
                            SET status = "retry",
                                run_after = DATE_ADD(NOW(), INTERVAL :delay SECOND),
                                last_error = :err
                          WHERE id = :id'
                    );
                    $retry->bindValue(':id', $jobId, \PDO::PARAM_INT);
                    $retry->bindValue(':delay', $retryDelay, \PDO::PARAM_INT);
                    $retry->bindValue(':err', mb_substr($e->getMessage(), 0, 2000), \PDO::PARAM_STR);
                    $retry->execute();
                    $stats['retried']++;
                }
            }
        }

        return $stats;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listJobs(string $status = '', int $limit = 100): array
    {
        if ($this->db === null) {
            return [];
        }

        $safeLimit = max(1, min(500, $limit));
        $allowed = ['queued', 'processing', 'retry', 'done', 'failed'];

        if ($status !== '' && !in_array($status, $allowed, true)) {
            $status = '';
        }

        if ($status !== '') {
            $stmt = $this->db->prepare(
                'SELECT *
                   FROM notification_jobs
                  WHERE status = :status
                  ORDER BY id DESC
                  LIMIT :lim'
            );
            $stmt->bindValue(':status', $status, \PDO::PARAM_STR);
        } else {
            $stmt = $this->db->prepare(
                'SELECT *
                   FROM notification_jobs
                  ORDER BY id DESC
                  LIMIT :lim'
            );
        }

        $stmt->bindValue(':lim', $safeLimit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $row): array {
            $payload = json_decode((string) ($row['payload'] ?? '{}'), true);
            if (!is_array($payload)) {
                $payload = [];
            }

            return [
                'id' => (int) ($row['id'] ?? 0),
                'event' => (string) ($row['event'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'attempts' => (int) ($row['attempts'] ?? 0),
                'maxAttempts' => (int) ($row['max_attempts'] ?? 0),
                'runAfter' => (string) ($row['run_after'] ?? ''),
                'lastError' => isset($row['last_error']) ? (string) $row['last_error'] : null,
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
                'processedAt' => isset($row['processed_at']) ? (string) $row['processed_at'] : null,
                'payload' => $payload,
            ];
        }, $rows);
    }

    /** @return array<string, mixed> */
    public function getSummary(): array
    {
        if ($this->db === null) {
            return [
                'counts' => ['queued' => 0, 'processing' => 0, 'retry' => 0, 'failed' => 0, 'done' => 0],
                'lastProcessedAt' => null,
                'oldestPendingAt' => null,
                'lastFailure' => null,
            ];
        }

        $counts = ['queued' => 0, 'processing' => 0, 'retry' => 0, 'failed' => 0, 'done' => 0];

        $countStmt = $this->db->query(
            'SELECT status, COUNT(*) AS cnt
               FROM notification_jobs
              GROUP BY status'
        );
        foreach (($countStmt ? $countStmt->fetchAll(\PDO::FETCH_ASSOC) : []) ?: [] as $row) {
            $status = (string) ($row['status'] ?? '');
            if (array_key_exists($status, $counts)) {
                $counts[$status] = (int) ($row['cnt'] ?? 0);
            }
        }

        $lastProcessedAt = null;
        $stmt = $this->db->query('SELECT MAX(processed_at) AS ts FROM notification_jobs');
        if ($stmt) {
            $lastProcessedAt = $stmt->fetchColumn() ?: null;
        }

        $oldestPendingAt = null;
        $stmt = $this->db->query(
            'SELECT MIN(created_at) AS ts
               FROM notification_jobs
              WHERE status IN ("queued", "retry", "processing")'
        );
        if ($stmt) {
            $oldestPendingAt = $stmt->fetchColumn() ?: null;
        }

        $lastFailure = null;
        $stmt = $this->db->query(
            'SELECT id, event, last_error, updated_at
               FROM notification_jobs
              WHERE status = "failed"
              ORDER BY updated_at DESC
              LIMIT 1'
        );
        if ($stmt) {
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (is_array($row)) {
                $lastFailure = [
                    'id' => (int) ($row['id'] ?? 0),
                    'event' => (string) ($row['event'] ?? ''),
                    'lastError' => isset($row['last_error']) ? (string) $row['last_error'] : null,
                    'updatedAt' => (string) ($row['updated_at'] ?? ''),
                ];
            }
        }

        return [
            'counts' => $counts,
            'lastProcessedAt' => $lastProcessedAt,
            'oldestPendingAt' => $oldestPendingAt,
            'lastFailure' => $lastFailure,
        ];
    }

    /** @return array<string, mixed> */
    public function getHealth(?int $warnAfterSeconds = null): array
    {
        $threshold = $warnAfterSeconds ?? 300;
        if ($threshold < 30) {
            $threshold = 30;
        }

        $summary = $this->getSummary();
        $counts = is_array($summary['counts'] ?? null) ? $summary['counts'] : [];
        $pendingCount = (int) ($counts['queued'] ?? 0) + (int) ($counts['retry'] ?? 0);

        $lastProcessedAt = (string) ($summary['lastProcessedAt'] ?? '');
        $secondsSinceLastProcessed = null;
        if ($lastProcessedAt !== '' && strtotime($lastProcessedAt) !== false) {
            $secondsSinceLastProcessed = max(0, time() - (int) strtotime($lastProcessedAt));
        }

        $warning = false;
        $message = 'Queue worker appears healthy.';

        if ($pendingCount > 0) {
            if ($secondsSinceLastProcessed === null) {
                $warning = true;
                $message = 'Queue has pending jobs but no processed jobs have been recorded yet.';
            } elseif ($secondsSinceLastProcessed > $threshold) {
                $warning = true;
                $message = 'Queue has pending jobs and worker has not processed jobs recently.';
            }
        }

        return [
            'warning' => $warning,
            'message' => $message,
            'warnAfterSeconds' => $threshold,
            'secondsSinceLastProcessed' => $secondsSinceLastProcessed,
            'pendingCount' => $pendingCount,
            'summary' => $summary,
        ];
    }

    /** @return array<string, mixed> */
    public function replayFailed(?int $jobId = null, int $limit = 50): array
    {
        if ($this->db === null) {
            return ['replayed' => 0, 'ids' => []];
        }

        $ids = [];
        if ($jobId !== null && $jobId > 0) {
            $stmt = $this->db->prepare(
                'SELECT id
                   FROM notification_jobs
                  WHERE id = :id
                    AND status = "failed"
                  LIMIT 1'
            );
            $stmt->execute([':id' => $jobId]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($row) {
                $ids[] = (int) $row['id'];
            }
        } else {
            $safeLimit = max(1, min(200, $limit));
            $stmt = $this->db->prepare(
                'SELECT id
                   FROM notification_jobs
                  WHERE status = "failed"
                  ORDER BY id ASC
                  LIMIT :lim'
            );
            $stmt->bindValue(':lim', $safeLimit, \PDO::PARAM_INT);
            $stmt->execute();
            foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
                $ids[] = (int) ($row['id'] ?? 0);
            }
            $ids = array_values(array_filter($ids, static fn(int $id): bool => $id > 0));
        }

        if (count($ids) === 0) {
            return ['replayed' => 0, 'ids' => []];
        }

        $update = $this->db->prepare(
            'UPDATE notification_jobs
                SET status = "retry",
                    run_after = NOW(),
                    attempts = 0,
                    last_error = NULL,
                    processed_at = NULL
              WHERE id = :id
                AND status = "failed"'
        );

        $replayed = 0;
        foreach ($ids as $id) {
            $update->execute([':id' => $id]);
            if ($update->rowCount() > 0) {
                $replayed++;
            }
        }

        return [
            'replayed' => $replayed,
            'ids' => $ids,
        ];
    }

    /** @param array<string, mixed> $payload */
    private function handleNow(string $event, array $payload): void
    {
        switch ($event) {
            case 'booking_created':
                $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                (new NotificationService())->bookingCreated($booking);
                $sms = new SmsService();
                $sms->bookingCreated($booking);
                $sms->bookingCreatedAdmin($booking);

                $vehicle = trim((string) ($booking['vehicleInfo'] ?? ''));
                $svcName = (string) ($booking['serviceName'] ?? '');
                $message = (string) ($booking['name'] ?? 'A customer')
                    . ' booked ' . $svcName
                    . ($vehicle !== '' ? ' · ' . $vehicle : '');
                $this->notifyRolesInApp(
                    ['owner', 'admin', 'manager'],
                    'new_booking',
                    'new_booking',
                    'New Booking Received',
                    $message,
                    ['bookingId' => $booking['id'] ?? null]
                );
                return;

            case 'booking_status_changed':
                $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                (new NotificationService())->bookingStatusChanged($booking);
                $status = (string) ($booking['status'] ?? '');
                if ($status === 'confirmed') {
                    (new SmsService())->bookingConfirmed($booking);
                } else {
                    (new SmsService())->bookingStatusChanged($booking);
                }

                $uid = (int) ($booking['userId'] ?? 0);
                if ($uid > 0) {
                    $prefSvc = new NotificationPreferencesService();
                    if ($prefSvc->inappEnabled($uid, 'status_changed')) {
                        $label = ucwords(str_replace('_', ' ', $status));
                        $svcName = (string) ($booking['serviceName'] ?? 'your service');
                        (new UserNotificationService())->createForUser(
                            $uid,
                            'status_changed',
                            'Booking Status: ' . $label,
                            'Your booking for ' . $svcName . ' is now ' . $label . '.',
                            ['bookingId' => $booking['id'] ?? null, 'status' => $status]
                        );
                    }
                }
                return;

            case 'booking_awaiting_parts':
                $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                (new NotificationService())->bookingAwaitingParts($booking);

                $uid = (int) ($booking['userId'] ?? 0);
                if ($uid > 0) {
                    $prefSvc = new NotificationPreferencesService();
                    if ($prefSvc->inappEnabled($uid, 'parts_update')) {
                        $svcName = (string) ($booking['serviceName'] ?? 'your service');
                        (new UserNotificationService())->createForUser(
                            $uid,
                            'parts_update',
                            'Job On Hold - Awaiting Parts',
                            'Your ' . $svcName . ' job is on hold while we wait for parts to arrive.',
                            ['bookingId' => $booking['id'] ?? null]
                        );
                    }
                }
                return;

            case 'build_update_created':
                $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                $update = is_array($payload['update'] ?? null) ? $payload['update'] : [];
                (new NotificationService())->buildUpdateCreated($booking, $update);

                $uid = (int) ($booking['userId'] ?? 0);
                if ($uid > 0) {
                    $prefSvc = new NotificationPreferencesService();
                    if ($prefSvc->inappEnabled($uid, 'build_update')) {
                        $svcName = (string) ($booking['serviceName'] ?? 'your service');
                        $note = trim((string) ($update['note'] ?? ''));
                        $snippet = $note !== '' ? ': ' . mb_strimwidth($note, 0, 60, '...') : '';
                        (new UserNotificationService())->createForUser(
                            $uid,
                            'build_update',
                            'Build Progress Update',
                            'New update on your ' . $svcName . ' job' . $snippet,
                            ['bookingId' => $booking['id'] ?? null]
                        );
                    }
                }
                return;

            case 'staff_assignment_sms_email':
                $booking = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                $techPhone = (string) ($payload['techPhone'] ?? '');
                $techEmail = (string) ($payload['techEmail'] ?? '');
                $techName = (string) ($payload['techName'] ?? '');
                $techUserId = isset($payload['techUserId']) ? (int) $payload['techUserId'] : null;
                if ($techPhone !== '') {
                    (new SmsService())->staffAssigned($booking, $techPhone, $techName, $techUserId);
                }
                if ($techEmail !== '') {
                    (new NotificationService())->staffAssigned($booking, $techEmail, $techName);
                }
                return;

            case 'password_reset':
                (new NotificationService())->passwordReset(
                    (string) ($payload['email'] ?? ''),
                    (string) ($payload['resetUrl'] ?? '')
                );
                return;

            case 'contact_message':
                $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
                (new NotificationService())->contactMessage($data);
                return;

            case 'waitlist_slot_available':
                $name = (string) ($payload['name'] ?? 'there');
                $email = (string) ($payload['email'] ?? '');
                $phone = (string) ($payload['phone'] ?? '');
                $date = (string) ($payload['date'] ?? '');
                $time = (string) ($payload['time'] ?? '');
                $claimUrl = (string) ($payload['claimUrl'] ?? '');
                $claimWindow = max(5, (int) ($payload['claimWindowMinutes'] ?? 30));
                $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;

                if ($userId > 0) {
                    $prefs = new NotificationPreferencesService();
                    if ($prefs->inappEnabled($userId, 'slot_available')) {
                        (new UserNotificationService())->createForUser(
                            $userId,
                            'slot_available',
                            'Slot Available!',
                            'A slot has opened on ' . $date . ' at ' . $time . '. Book now before it is taken!',
                            ['slotDate' => $date, 'slotTime' => $time, 'claimUrl' => $claimUrl]
                        );
                    }
                }

                if ($phone !== '') {
                    (new SmsService())->waitlistSlotAvailable([
                        'name' => $name,
                        'phone' => $phone,
                        'date' => $date,
                        'time' => $time,
                    ]);
                }

                if ($email !== '') {
                    (new NotificationService())->sendWaitlistSlotAvailable(
                        $name,
                        $email,
                        $date,
                        $time,
                        $claimUrl,
                        $claimWindow
                    );
                }
                return;

            case 'admin_security_alert':
                $email = strtolower(trim((string) ($payload['email'] ?? '')));
                $ipAddress = (string) ($payload['ipAddress'] ?? '');
                $this->notifyRolesInApp(
                    ['owner', 'admin', 'manager'],
                    'security_alert',
                    'security_alert',
                    'Suspicious Login Pattern',
                    'Repeated login failures detected for ' . $email . ' from IP ' . ($ipAddress !== '' ? $ipAddress : 'unknown') . '.',
                    ['email' => $email, 'ipAddress' => $ipAddress]
                );
                return;

            default:
                throw new RuntimeException('Unknown notification job event: ' . $event);
        }
    }

    /**
     * @param string[] $roles
     * @param array<string, mixed>|null $data
     */
    private function notifyRolesInApp(
        array $roles,
        string $prefType,
        string $type,
        string $title,
        string $message,
        ?array $data = null
    ): void {
        if ($this->db === null || count($roles) === 0) {
            return;
        }

        $placeholders = implode(', ', array_fill(0, count($roles), '?'));
        $sql =
            "SELECT id
               FROM users
              WHERE role IN ({$placeholders})
                AND (is_active IS NULL OR is_active = 1)";
        $stmt = $this->db->prepare($sql);
        foreach ($roles as $i => $role) {
            $stmt->bindValue($i + 1, $role, \PDO::PARAM_STR);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $prefs = new NotificationPreferencesService();
        $notifications = new UserNotificationService();

        foreach ($rows as $row) {
            $uid = (int) ($row['id'] ?? 0);
            if ($uid <= 0) {
                continue;
            }
            if (!$prefs->inappEnabled($uid, $prefType)) {
                continue;
            }
            $notifications->createForUser($uid, $type, $title, $message, $data);
        }
    }
}
