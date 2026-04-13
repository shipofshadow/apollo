<?php

declare(strict_types=1);

class MarketingCampaignService
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return array<int, array<string, mixed>> */
    public function listCampaigns(): array
    {
        $stmt = $this->db->query('SELECT * FROM marketing_campaigns ORDER BY created_at DESC, id DESC');
        $rows = $stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : [];
        return array_map([$this, 'formatCampaign'], $rows);
    }

    /** @return array<string, mixed> */
    public function getCampaign(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM marketing_campaigns WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new RuntimeException('Campaign not found.', 404);
        }

        return $this->formatCampaign($row);
    }

    /** @param array<string, mixed> $data */
    public function createCampaign(array $data, ?int $actorUserId = null): array
    {
        $payload = $this->normalizeCampaignPayload($data);

        $stmt = $this->db->prepare(
            'INSERT INTO marketing_campaigns
             (name, category, type, status, is_scheduled, schedule_type, schedule_time, schedule_weekday, schedule_day, schedule_timezone, channels_json, title, message, message_html, cta_url, trigger_config_json, created_by, next_run_at)
             VALUES (:name, :category, :type, :status, :is_scheduled, :schedule_type, :schedule_time, :schedule_weekday, :schedule_day, :schedule_timezone, :channels_json, :title, :message, :message_html, :cta_url, :trigger_config_json, :created_by, :next_run_at)'
        );
        $stmt->execute([
            ':name' => $payload['name'],
            ':category' => $payload['category'],
            ':type' => $payload['type'],
            ':status' => $payload['status'],
            ':is_scheduled' => $payload['scheduleEnabled'] ? 1 : 0,
            ':schedule_type' => $payload['scheduleType'],
            ':schedule_time' => $payload['scheduleTime'],
            ':schedule_weekday' => $payload['scheduleWeekday'],
            ':schedule_day' => $payload['scheduleDay'],
            ':schedule_timezone' => $payload['scheduleTimezone'],
            ':channels_json' => json_encode($payload['channels'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':title' => $payload['title'],
            ':message' => $payload['message'],
            ':message_html' => $payload['messageHtml'],
            ':cta_url' => $payload['ctaUrl'],
            ':trigger_config_json' => json_encode($payload['triggerConfig'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':created_by' => $actorUserId,
            ':next_run_at' => $this->computeNextRunAt($payload),
        ]);

        return $this->getCampaign((int) $this->db->lastInsertId());
    }

    /** @param array<string, mixed> $data */
    public function updateCampaign(int $id, array $data): array
    {
        $current = $this->getCampaign($id);
        $payload = $this->normalizeCampaignPayload(array_merge($current, $data), true);

        $stmt = $this->db->prepare(
            'UPDATE marketing_campaigns
                SET name = :name,
                    category = :category,
                    type = :type,
                    status = :status,
                    is_scheduled = :is_scheduled,
                    schedule_type = :schedule_type,
                    schedule_time = :schedule_time,
                    schedule_weekday = :schedule_weekday,
                    schedule_day = :schedule_day,
                    schedule_timezone = :schedule_timezone,
                    next_run_at = :next_run_at,
                    channels_json = :channels_json,
                    title = :title,
                    message = :message,
                      message_html = :message_html,
                    cta_url = :cta_url,
                    trigger_config_json = :trigger_config_json
              WHERE id = :id'
        );
        $stmt->execute([
            ':id' => $id,
            ':name' => $payload['name'],
                ':category' => $payload['category'],
            ':type' => $payload['type'],
            ':status' => $payload['status'],
            ':is_scheduled' => $payload['scheduleEnabled'] ? 1 : 0,
            ':schedule_type' => $payload['scheduleType'],
            ':schedule_time' => $payload['scheduleTime'],
            ':schedule_weekday' => $payload['scheduleWeekday'],
            ':schedule_day' => $payload['scheduleDay'],
            ':schedule_timezone' => $payload['scheduleTimezone'],
            ':next_run_at' => $this->computeNextRunAt($payload),
            ':channels_json' => json_encode($payload['channels'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':title' => $payload['title'],
            ':message' => $payload['message'],
            ':message_html' => $payload['messageHtml'],
            ':cta_url' => $payload['ctaUrl'],
            ':trigger_config_json' => json_encode($payload['triggerConfig'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        return $this->getCampaign($id);
    }

    public function deleteCampaign(int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM marketing_campaigns WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Campaign not found.', 404);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function getAudience(string $type): array
    {
        $type = strtolower(trim($type));
        if (!in_array($type, ['abandoned_cart', 'no_booking_90d', 'win_back', 'custom'], true)) {
            throw new RuntimeException('Unsupported audience type.', 422);
        }

        if ($type === 'abandoned_cart') {
            return $this->audienceAbandonedCart();
        }
        if ($type === 'no_booking_90d') {
            return $this->audienceNoBooking90d();
        }
        if ($type === 'custom') {
            return $this->audienceCustom();
        }

        return $this->audienceWinBack();
    }

    /** @return array<string, mixed> */
    public function runCampaign(int $id, bool $dryRun = false): array
    {
        return $this->runCampaignInternal($id, $dryRun, 'manual');
    }

    /** @return array<string, mixed> */
    public function runScheduledDue(int $limit = 20): array
    {
        $lim = max(1, min(200, $limit));
        $stmt = $this->db->prepare(
            'SELECT id
               FROM marketing_campaigns
              WHERE status = "active"
                AND is_scheduled = 1
                AND schedule_type <> "manual"
                AND next_run_at IS NOT NULL
                AND next_run_at <= NOW()
              ORDER BY next_run_at ASC, id ASC
              LIMIT :lim'
        );
        $stmt->bindValue(':lim', $lim, \PDO::PARAM_INT);
        $stmt->execute();

        $processed = 0;
        $queuedDeliveries = 0;
        $errors = [];

        foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
            $campaignId = (int) ($row['id'] ?? 0);
            if ($campaignId <= 0) {
                continue;
            }

            try {
                $result = $this->runCampaignInternal($campaignId, false, 'scheduled');
                $processed++;
                $queuedDeliveries += (int) ($result['queuedCount'] ?? 0);
            } catch (\Throwable $e) {
                $errors[] = [
                    'campaignId' => $campaignId,
                    'message' => mb_substr($e->getMessage(), 0, 255),
                ];
            }
        }

        return [
            'processed' => $processed,
            'queuedDeliveries' => $queuedDeliveries,
            'errors' => $errors,
        ];
    }

    /** @return array<string, mixed> */
    private function runCampaignInternal(int $id, bool $dryRun, string $runType): array
    {
        $campaign = $this->getCampaign($id);
        $audience = $this->getAudience((string) ($campaign['type'] ?? ''));
        $channels = is_array($campaign['channels']) ? $campaign['channels'] : [];

        $runStmt = $this->db->prepare(
            'INSERT INTO marketing_campaign_runs (campaign_id, run_type, dry_run, target_count, queued_count, summary_json)
               VALUES (:campaign_id, :run_type, :dry_run, :target_count, :queued_count, :summary_json)'
        );

        $queuedCount = 0;
        $summary = [
            'channels' => $channels,
            'audienceType' => $campaign['type'],
            'dryRun' => $dryRun,
        ];

        $runStmt->execute([
            ':campaign_id' => $id,
            ':run_type' => $runType,
            ':dry_run' => $dryRun ? 1 : 0,
            ':target_count' => count($audience),
            ':queued_count' => 0,
            ':summary_json' => json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        $runId = (int) $this->db->lastInsertId();

        if (!$dryRun) {
            $recipientInsert = $this->db->prepare(
                'INSERT INTO marketing_campaign_recipients
                 (run_id, campaign_id, user_id, channel, recipient, status, payload_json)
                 VALUES (:run_id, :campaign_id, :user_id, :channel, :recipient, "queued", :payload_json)'
            );

            foreach ($audience as $recipient) {
                foreach ($channels as $channel) {
                    $channelName = strtolower(trim((string) $channel));
                    if (!in_array($channelName, ['inapp', 'email', 'sms'], true)) {
                        continue;
                    }

                    $target = '';
                    if ($channelName === 'inapp') {
                        $target = (string) ($recipient['userId'] ?? '');
                        if ((int) $target <= 0) {
                            continue;
                        }
                    }
                    if ($channelName === 'email') {
                        $target = (string) ($recipient['email'] ?? '');
                        if ($target === '') {
                            continue;
                        }
                    }
                    if ($channelName === 'sms') {
                        $target = (string) ($recipient['phone'] ?? '');
                        if ($target === '') {
                            continue;
                        }
                    }

                    $payload = [
                        'campaignId' => $id,
                        'runId' => $runId,
                        'channel' => $channelName,
                        'userId' => (int) ($recipient['userId'] ?? 0),
                        'name' => (string) ($recipient['name'] ?? 'Customer'),
                        'email' => (string) ($recipient['email'] ?? ''),
                        'phone' => (string) ($recipient['phone'] ?? ''),
                        'title' => (string) ($campaign['title'] ?? 'Special Offer'),
                        'message' => (string) ($campaign['message'] ?? ''),
                        'messageHtml' => (string) ($campaign['messageHtml'] ?? ''),
                        'ctaUrl' => (string) ($campaign['ctaUrl'] ?? ''),
                        'type' => (string) ($campaign['type'] ?? ''),
                    ];

                    (new NotificationJobQueueService())->dispatch('marketing_campaign_message', $payload);

                    $recipientInsert->execute([
                        ':run_id' => $runId,
                        ':campaign_id' => $id,
                        ':user_id' => isset($recipient['userId']) ? (int) $recipient['userId'] : null,
                        ':channel' => $channelName,
                        ':recipient' => $target,
                        ':payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ]);
                    $queuedCount++;
                }
            }

            $this->db->prepare('UPDATE marketing_campaign_runs SET queued_count = :queued WHERE id = :id')
                ->execute([':queued' => $queuedCount, ':id' => $runId]);

            $this->db->prepare('UPDATE marketing_campaigns SET last_run_at = NOW() WHERE id = :id')
                ->execute([':id' => $id]);

            $nextRun = $this->computeNextRunAt($campaign, true);
            $this->db->prepare('UPDATE marketing_campaigns SET next_run_at = :next_run_at WHERE id = :id')
                ->execute([
                    ':id' => $id,
                    ':next_run_at' => $nextRun,
                ]);
        }

        return [
            'runId' => $runId,
            'campaign' => $campaign,
            'targetCount' => count($audience),
            'queuedCount' => $queuedCount,
            'dryRun' => $dryRun,
            'previewRecipients' => array_slice($audience, 0, 50),
        ];
    }

    /** @return array<string, mixed> */
    public function analytics(int $id): array
    {
        $campaign = $this->getCampaign($id);

        $totalsStmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS total,
                SUM(status = "queued") AS queued,
                SUM(status = "sent") AS sent,
                SUM(status = "failed") AS failed
             FROM marketing_campaign_recipients
             WHERE campaign_id = :id'
        );
        $totalsStmt->execute([':id' => $id]);
        $totals = $totalsStmt->fetch(\PDO::FETCH_ASSOC) ?: [];

        $channelStmt = $this->db->prepare(
            'SELECT channel, COUNT(*) AS total
             FROM marketing_campaign_recipients
             WHERE campaign_id = :id
             GROUP BY channel'
        );
        $channelStmt->execute([':id' => $id]);
        $channelRows = $channelStmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $runsStmt = $this->db->prepare(
            'SELECT id, run_type, dry_run, target_count, queued_count, created_at
             FROM marketing_campaign_runs
             WHERE campaign_id = :id
             ORDER BY created_at DESC
             LIMIT 20'
        );
        $runsStmt->execute([':id' => $id]);
        $runsRows = $runsStmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

                $statusByChannelStmt = $this->db->prepare(
                        'SELECT channel, status, COUNT(*) AS total
                             FROM marketing_campaign_recipients
                            WHERE campaign_id = :id
                            GROUP BY channel, status
                            ORDER BY channel ASC, status ASC'
                );
                $statusByChannelStmt->execute([':id' => $id]);
                $statusByChannel = $statusByChannelStmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

                $failureSummaryStmt = $this->db->prepare(
                        'SELECT channel,
                                        COALESCE(NULLIF(TRIM(error_text), ""), "Unknown error") AS error_text,
                                        COUNT(*) AS total
                             FROM marketing_campaign_recipients
                            WHERE campaign_id = :id
                                AND status = "failed"
                            GROUP BY channel, COALESCE(NULLIF(TRIM(error_text), ""), "Unknown error")
                            ORDER BY total DESC, channel ASC
                            LIMIT 20'
                );
                $failureSummaryStmt->execute([':id' => $id]);
                        $failureSummaryRows = $failureSummaryStmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

                $recentFailuresStmt = $this->db->prepare(
                        'SELECT run_id, user_id, channel, recipient, error_text, processed_at
                             FROM marketing_campaign_recipients
                            WHERE campaign_id = :id
                                AND status = "failed"
                            ORDER BY processed_at DESC, id DESC
                            LIMIT 30'
                );
                $recentFailuresStmt->execute([':id' => $id]);
                $recentFailureRows = $recentFailuresStmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return [
            'campaign' => $campaign,
            'totals' => [
                'total' => (int) ($totals['total'] ?? 0),
                'queued' => (int) ($totals['queued'] ?? 0),
                'sent' => (int) ($totals['sent'] ?? 0),
                'failed' => (int) ($totals['failed'] ?? 0),
            ],
            'byChannel' => array_map(static function (array $row): array {
                return [
                    'channel' => (string) ($row['channel'] ?? ''),
                    'total' => (int) ($row['total'] ?? 0),
                ];
            }, $channelRows),
            'byStatusByChannel' => array_map(static function (array $row): array {
                return [
                    'channel' => (string) ($row['channel'] ?? ''),
                    'status' => (string) ($row['status'] ?? ''),
                    'total' => (int) ($row['total'] ?? 0),
                ];
            }, $statusByChannel),
            'failureSummary' => array_map(static function (array $row): array {
                return [
                    'channel' => (string) ($row['channel'] ?? ''),
                    'error' => (string) ($row['error_text'] ?? 'Unknown error'),
                    'total' => (int) ($row['total'] ?? 0),
                ];
            }, $failureSummaryRows),
            'recentFailures' => array_map(static function (array $row): array {
                return [
                    'runId' => (int) ($row['run_id'] ?? 0),
                    'userId' => isset($row['user_id']) ? (int) $row['user_id'] : null,
                    'channel' => (string) ($row['channel'] ?? ''),
                    'recipient' => (string) ($row['recipient'] ?? ''),
                    'error' => (string) ($row['error_text'] ?? 'Unknown error'),
                    'processedAt' => isset($row['processed_at']) ? (string) $row['processed_at'] : null,
                ];
            }, $recentFailureRows),
            'runs' => array_map(static function (array $row): array {
                return [
                    'id' => (int) ($row['id'] ?? 0),
                    'runType' => (string) ($row['run_type'] ?? 'manual'),
                    'dryRun' => ((int) ($row['dry_run'] ?? 0)) === 1,
                    'targetCount' => (int) ($row['target_count'] ?? 0),
                    'queuedCount' => (int) ($row['queued_count'] ?? 0),
                    'createdAt' => (string) ($row['created_at'] ?? ''),
                ];
            }, $runsRows),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function audienceAbandonedCart(): array
    {
        $stmt = $this->db->query(
            'SELECT DISTINCT u.id AS user_id, u.name, u.email, u.phone, MAX(po.created_at) AS last_order_at
             FROM users u
             JOIN product_orders po ON po.user_id = u.id
             WHERE u.role = "client"
               AND po.status = "pending"
               AND po.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             GROUP BY u.id, u.name, u.email, u.phone
             ORDER BY last_order_at DESC'
        );
        return $this->formatAudienceRows($stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : []);
    }

    /** @return array<int, array<string, mixed>> */
    private function audienceNoBooking90d(): array
    {
        $stmt = $this->db->query(
            'SELECT u.id AS user_id, u.name, u.email, u.phone, MAX(b.created_at) AS last_booking_at
             FROM users u
             LEFT JOIN bookings b ON b.user_id = u.id
             WHERE u.role = "client"
             GROUP BY u.id, u.name, u.email, u.phone
             HAVING MAX(b.created_at) IS NULL OR MAX(b.created_at) < DATE_SUB(NOW(), INTERVAL 90 DAY)
             ORDER BY last_booking_at DESC'
        );
        return $this->formatAudienceRows($stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : []);
    }

    /** @return array<int, array<string, mixed>> */
    private function audienceWinBack(): array
    {
        $stmt = $this->db->query(
            'SELECT u.id AS user_id, u.name, u.email, u.phone,
                    GREATEST(
                        COALESCE(MAX(b.created_at), "1970-01-01"),
                        COALESCE(MAX(po.created_at), "1970-01-01")
                    ) AS last_activity_at
             FROM users u
             LEFT JOIN bookings b ON b.user_id = u.id
             LEFT JOIN product_orders po ON po.user_id = u.id
             WHERE u.role = "client"
             GROUP BY u.id, u.name, u.email, u.phone
             HAVING last_activity_at < DATE_SUB(NOW(), INTERVAL 120 DAY)
             ORDER BY last_activity_at DESC'
        );
        return $this->formatAudienceRows($stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : []);
    }

    /** @return array<int, array<string, mixed>> */
    private function audienceCustom(): array
    {
        $stmt = $this->db->query(
            'SELECT u.id AS user_id, u.name, u.email, u.phone
             FROM users u
             WHERE u.role = "client"
             ORDER BY u.created_at DESC, u.id DESC'
        );
        return $this->formatAudienceRows($stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : []);
    }

    /** @param array<int, array<string, mixed>> $rows
     *  @return array<int, array<string, mixed>>
     */
    private function formatAudienceRows(array $rows): array
    {
        return array_map(static function (array $row): array {
            return [
                'userId' => (int) ($row['user_id'] ?? 0),
                'name' => (string) ($row['name'] ?? 'Customer'),
                'email' => (string) ($row['email'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
            ];
        }, $rows);
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function formatCampaign(array $row): array
    {
        $channels = json_decode((string) ($row['channels_json'] ?? '[]'), true);
        $trigger = json_decode((string) ($row['trigger_config_json'] ?? '{}'), true);

        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'category' => isset($row['category']) ? (string) $row['category'] : null,
            'type' => (string) ($row['type'] ?? ''),
            'status' => (string) ($row['status'] ?? 'draft'),
            'scheduleEnabled' => ((int) ($row['is_scheduled'] ?? 0)) === 1,
            'scheduleType' => (string) ($row['schedule_type'] ?? 'manual'),
            'scheduleTime' => (string) ($row['schedule_time'] ?? '09:00'),
            'scheduleWeekday' => isset($row['schedule_weekday']) ? (int) $row['schedule_weekday'] : null,
            'scheduleDay' => isset($row['schedule_day']) ? (int) $row['schedule_day'] : null,
            'scheduleTimezone' => (string) ($row['schedule_timezone'] ?? 'Asia/Manila'),
            'channels' => is_array($channels) ? array_values(array_filter(array_map('strval', $channels))) : [],
            'title' => (string) ($row['title'] ?? ''),
            'message' => (string) ($row['message'] ?? ''),
            'messageHtml' => isset($row['message_html']) ? (string) $row['message_html'] : null,
            'ctaUrl' => isset($row['cta_url']) ? (string) $row['cta_url'] : null,
            'triggerConfig' => is_array($trigger) ? $trigger : [],
            'lastRunAt' => isset($row['last_run_at']) ? (string) $row['last_run_at'] : null,
            'nextRunAt' => isset($row['next_run_at']) ? (string) $row['next_run_at'] : null,
            'createdBy' => isset($row['created_by']) ? (int) $row['created_by'] : null,
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function normalizeCampaignPayload(array $data, bool $isUpdate = false): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        $category = trim((string) ($data['category'] ?? ''));
        $type = strtolower(trim((string) ($data['type'] ?? '')));
        $status = strtolower(trim((string) ($data['status'] ?? 'draft')));
        $title = trim((string) ($data['title'] ?? ''));
        $message = trim((string) ($data['message'] ?? ''));
        $messageHtml = trim((string) ($data['messageHtml'] ?? ($data['message_html'] ?? '')));
        $ctaUrl = trim((string) ($data['ctaUrl'] ?? ($data['cta_url'] ?? '')));
        $channelsRaw = $data['channels'] ?? [];
        $scheduleEnabled = (bool) ($data['scheduleEnabled'] ?? $data['is_scheduled'] ?? false);
        $scheduleType = strtolower(trim((string) ($data['scheduleType'] ?? $data['schedule_type'] ?? 'manual')));
        $scheduleTime = trim((string) ($data['scheduleTime'] ?? $data['schedule_time'] ?? '09:00'));
        $scheduleWeekday = isset($data['scheduleWeekday']) ? (int) $data['scheduleWeekday'] : (isset($data['schedule_weekday']) ? (int) $data['schedule_weekday'] : null);
        $scheduleDay = isset($data['scheduleDay']) ? (int) $data['scheduleDay'] : (isset($data['schedule_day']) ? (int) $data['schedule_day'] : null);
        $scheduleTimezone = trim((string) ($data['scheduleTimezone'] ?? $data['schedule_timezone'] ?? 'Asia/Manila'));

        $channels = [];
        if (is_array($channelsRaw)) {
            foreach ($channelsRaw as $value) {
                $channel = strtolower(trim((string) $value));
                if (in_array($channel, ['inapp', 'email', 'sms'], true) && !in_array($channel, $channels, true)) {
                    $channels[] = $channel;
                }
            }
        }

        if ($name === '') {
            throw new RuntimeException('Campaign name is required.', 422);
        }
        if (!in_array($type, ['abandoned_cart', 'no_booking_90d', 'win_back', 'custom'], true)) {
            throw new RuntimeException('Campaign type is invalid.', 422);
        }
        if (!in_array($status, ['draft', 'active', 'paused'], true)) {
            throw new RuntimeException('Campaign status is invalid.', 422);
        }
        if ($message === '') {
            throw new RuntimeException('Campaign message is required.', 422);
        }
        if (count($channels) === 0) {
            throw new RuntimeException('At least one channel is required.', 422);
        }

        if (!in_array($scheduleType, ['manual', 'daily', 'weekly', 'monthly'], true)) {
            throw new RuntimeException('Schedule type is invalid.', 422);
        }
        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $scheduleTime)) {
            throw new RuntimeException('Schedule time must be in HH:MM format.', 422);
        }
        if ($scheduleEnabled && $scheduleType === 'manual') {
            throw new RuntimeException('Scheduled campaigns require a non-manual schedule type.', 422);
        }
        if ($scheduleType === 'weekly') {
            if ($scheduleWeekday === null || $scheduleWeekday < 0 || $scheduleWeekday > 6) {
                throw new RuntimeException('Weekly schedules require weekday 0-6.', 422);
            }
        } else {
            $scheduleWeekday = null;
        }
        if ($scheduleType === 'monthly') {
            if ($scheduleDay === null || $scheduleDay < 1 || $scheduleDay > 28) {
                throw new RuntimeException('Monthly schedules require day 1-28.', 422);
            }
        } else {
            $scheduleDay = null;
        }
        try {
            new \DateTimeZone($scheduleTimezone);
        } catch (\Throwable $e) {
            throw new RuntimeException('Invalid campaign timezone.', 422, $e);
        }

        $triggerConfig = $data['triggerConfig'] ?? ($data['trigger_config'] ?? []);
        if (!is_array($triggerConfig)) {
            $triggerConfig = [];
        }

        return [
            'name' => mb_substr($name, 0, 180),
            'category' => $category !== '' ? mb_substr($category, 0, 120) : null,
            'type' => $type,
            'status' => $status,
            'scheduleEnabled' => $scheduleEnabled,
            'scheduleType' => $scheduleType,
            'scheduleTime' => $scheduleTime,
            'scheduleWeekday' => $scheduleWeekday,
            'scheduleDay' => $scheduleDay,
            'scheduleTimezone' => mb_substr($scheduleTimezone, 0, 64),
            'channels' => $channels,
            'title' => mb_substr($title, 0, 200),
            'message' => mb_substr($message, 0, 2000),
            'messageHtml' => $messageHtml !== '' ? mb_substr($messageHtml, 0, 20000) : null,
            'ctaUrl' => $ctaUrl !== '' ? mb_substr($ctaUrl, 0, 255) : null,
            'triggerConfig' => $triggerConfig,
            'isUpdate' => $isUpdate,
        ];
    }

    /** @param array<string, mixed> $payload */
    private function computeNextRunAt(array $payload, bool $advanceFromNow = false): ?string
    {
        $scheduleEnabled = (bool) ($payload['scheduleEnabled'] ?? false);
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        $type = strtolower(trim((string) ($payload['scheduleType'] ?? 'manual')));
        $time = (string) ($payload['scheduleTime'] ?? '09:00');
        $timezone = (string) ($payload['scheduleTimezone'] ?? 'Asia/Manila');

        if (!$scheduleEnabled || $status !== 'active' || $type === 'manual') {
            return null;
        }

        $tz = new \DateTimeZone($timezone);
        $now = new \DateTimeImmutable('now', $tz);
        [$hour, $minute] = array_map('intval', explode(':', $time));

        $candidate = $now->setTime($hour, $minute, 0);
        if ($advanceFromNow || $candidate <= $now) {
            $candidate = $candidate->modify('+1 day');
        }

        if ($type === 'weekly') {
            $targetDow = (int) ($payload['scheduleWeekday'] ?? 0);
            while ((int) $candidate->format('w') !== $targetDow) {
                $candidate = $candidate->modify('+1 day');
            }
        } elseif ($type === 'monthly') {
            $targetDay = (int) ($payload['scheduleDay'] ?? 1);
            $candidate = $candidate->setDate((int) $candidate->format('Y'), (int) $candidate->format('m'), min($targetDay, 28));
            if ($candidate <= $now) {
                $candidate = $candidate->modify('first day of next month')->setDate(
                    (int) $candidate->format('Y'),
                    (int) $candidate->format('m'),
                    min($targetDay, 28)
                );
            }
        }

        return $candidate->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
}
