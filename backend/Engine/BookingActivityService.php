<?php

declare(strict_types=1);

/**
 * Persistent booking activity timeline entries.
 */
class BookingActivityService
{
    private bool $enabled;

    public function __construct()
    {
        $this->enabled = DB_NAME !== '';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getForBooking(string $bookingId): array
    {
        if (!$this->enabled) {
            return [];
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT id, booking_id, actor_user_id, actor_role, event_type, action, detail, created_at
             FROM booking_activity_logs
             WHERE booking_id = :booking_id
             ORDER BY created_at ASC, id ASC'
        );
        $stmt->execute([':booking_id' => $bookingId]);

        return array_map([$this, 'formatRow'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    public function add(
        string $bookingId,
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

        $stmt = Database::getInstance()->prepare(
            'INSERT INTO booking_activity_logs
                (booking_id, actor_user_id, actor_role, event_type, action, detail, created_at)
             VALUES
                (:booking_id, :actor_user_id, :actor_role, :event_type, :action, :detail, COALESCE(:created_at, NOW()))'
        );

        $stmt->execute([
            ':booking_id'    => $bookingId,
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
            'bookingId'   => (string) $row['booking_id'],
            'actorUserId' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
            'actorRole'   => (string) $row['actor_role'],
            'eventType'   => (string) $row['event_type'],
            'action'      => (string) $row['action'],
            'detail'      => $row['detail'] !== null ? (string) $row['detail'] : null,
            'createdAt'   => (string) $row['created_at'],
        ];
    }
}
