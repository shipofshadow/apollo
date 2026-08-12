<?php

declare(strict_types=1);

/**
 * Persistent inquiry activity timeline entries.
 */
class InquiryActivityService
{
    private bool $enabled;

    public function __construct()
    {
        $this->enabled = DB_NAME !== '';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getForInquiry(string $inquiryId): array
    {
        if (!$this->enabled) {
            return [];
        }

        $cleanId = str_starts_with($inquiryId, 'inq-') ? substr($inquiryId, 4) : $inquiryId;
        $prefixedId = str_starts_with($inquiryId, 'inq-') ? $inquiryId : 'inq-' . $inquiryId;

        $stmt = Database::getInstance()->prepare(
            'SELECT a.id, a.inquiry_id, a.actor_user_id, a.actor_role, a.event_type, a.action, a.detail, a.created_at, u.name AS actor_name
             FROM inquiry_activity_logs a
             LEFT JOIN users u ON a.actor_user_id = u.id
             WHERE a.inquiry_id = :id OR a.inquiry_id = :cleanId OR a.inquiry_id = :prefixedId
             ORDER BY a.created_at ASC, a.id ASC'
        );
        $stmt->execute([':id' => $inquiryId, ':cleanId' => $cleanId, ':prefixedId' => $prefixedId]);

        return array_map([$this, 'formatRow'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    public function add(
        string $inquiryId,
        string $eventType,
        string $action,
        ?string $detail = null,
        ?int $actorUserId = null,
        string $actorRole = 'system',
        ?string $createdAt = null
    ): void {
        if (!$this->enabled) {
            return;
        }

        if (!in_array($actorRole, ['system', 'admin', 'client'], true)) {
            $actorRole = 'system';
        }

        // Accept ISO 8601 and normalize to MySQL DATETIME when provided.
        if ($createdAt !== null) {
            $ts = strtotime($createdAt);
            $createdAt = $ts === false ? null : date('Y-m-d H:i:s', $ts);
        }

        $stmt = Database::getInstance()->prepare(
            'INSERT INTO inquiry_activity_logs
                (inquiry_id, actor_user_id, actor_role, event_type, action, detail, created_at)
             VALUES
                (:inquiry_id, :actor_user_id, :actor_role, :event_type, :action, :detail, COALESCE(:created_at, NOW()))'
        );

        $stmt->execute([
            ':inquiry_id'    => $inquiryId,
            ':actor_user_id' => $actorUserId,
            ':actor_role'    => $actorRole,
            ':event_type'    => $eventType,
            ':action'        => $action,
            ':detail'        => $detail,
            ':created_at'    => $createdAt,
        ]);
    }

    /** @param array<string, mixed> $row */
    private function formatRow(array $row): array
    {
        return [
            'id'          => (int) $row['id'],
            'inquiryId'   => (string) $row['inquiry_id'],
            'actorUserId' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
            'actorRole'   => (string) $row['actor_role'],
            'eventType'   => (string) $row['event_type'],
            'action'      => (string) $row['action'],
            'detail'      => $row['detail'] !== null ? (string) $row['detail'] : null,
            'createdAt'   => (string) $row['created_at'],
            'actorName'   => $row['actor_name'] ?? null,
        ];
    }
}
