<?php

declare(strict_types=1);

/**
 * Build-update records (progress photos & notes) attached to a booking.
 *
 * SQL schema (migration 026_create_build_updates.sql):
 *
 *   CREATE TABLE IF NOT EXISTS build_updates (
 *       id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
 *       booking_id   CHAR(36)      NOT NULL,
 *       note         TEXT          DEFAULT NULL,
 *       photo_urls   TEXT          DEFAULT NULL,   -- JSON-encoded string[]
 *       created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *       CONSTRAINT fk_build_updates_booking
 *           FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
 *   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 */
class BuildUpdateService
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return all build updates for a booking, oldest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getByBookingId(string $bookingId): array
    {
        $stmt = $this->db->prepare(
                'SELECT bu.id, bu.booking_id, bu.note, bu.photo_urls, bu.created_at
                    FROM build_updates bu
              WHERE booking_id = :bid
           ORDER BY created_at ASC'
        );
        $stmt->execute([':bid' => $bookingId]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        return array_map([$this, 'formatRow'], $rows ?: []);
    }

    /**
     * Create a new build update.
     *
     * @param  array<int, string> $photoUrls
     * @return array<string, mixed>
     */
    public function create(string $bookingId, string $note, array $photoUrls): array
    {
        $note      = trim($note);
        $urlsJson  = json_encode(array_values($photoUrls));

        $stmt = $this->db->prepare(
                        'INSERT INTO build_updates (booking_id, note, photo_urls)
                                    VALUES (:bid, :note, :urls)'
        );
        $stmt->execute([
                        ':bid'   => $bookingId,
                        ':note'  => $note !== '' ? $note : null,
                        ':urls'  => $urlsJson,
        ]);

        $id = (int) $this->db->lastInsertId();

        $fetch = $this->db->prepare(
            'SELECT bu.id, bu.booking_id, bu.note, bu.photo_urls, bu.created_at
               FROM build_updates bu
              WHERE bu.id = :id'
        );
        $fetch->execute([':id' => $id]);
        $row = $fetch->fetch(\PDO::FETCH_ASSOC);
        $update = $this->formatRow($row);

        $this->logBuildUpdateActivity($update);

        return $update;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $row */
    private function formatRow(array $row): array
    {
        $urls = [];
        if (!empty($row['photo_urls'])) {
            $decoded = json_decode((string) $row['photo_urls'], true);
            if (is_array($decoded)) {
                $urls = $decoded;
            }
        }

        return [
            'id'        => (int) $row['id'],
            'bookingId' => (string) $row['booking_id'],
            'note'      => (string) ($row['note'] ?? ''),
            'photoUrls' => $urls,
            'createdAt' => (string) $row['created_at'],
        ];
    }

    /** @param array<string, mixed> $update */
    private function logBuildUpdateActivity(array $update): void
    {
        try {
            $subjectId = (string) ((int) ($update['id'] ?? 0));
            $bookingId = (string) ($update['bookingId'] ?? '');
            $photoCount = is_array($update['photoUrls'] ?? null) ? count($update['photoUrls']) : 0;

            $logger = activity()
                ->forSubject('build_updates', $subjectId)
                ->withProperties([
                    'bookingId' => $bookingId,
                    'photoCount' => $photoCount,
                    'note' => (string) ($update['note'] ?? ''),
                    'createdAt' => (string) ($update['createdAt'] ?? ''),
                ]);

            $actorUserId = $this->resolveActorUserId();
            if ($actorUserId !== null) {
                $logger->byUser($actorUserId);
            }

            $logger->log(ActivityEvents::BUILD_UPDATE_CREATED, 'build_updates');
        } catch (\Throwable $e) {
            error_log('[BuildUpdateService] Failed to write build update activity log: ' . $e->getMessage());
        }
    }

    private function resolveActorUserId(): ?int
    {
        try {
            $payload = Auth::user();
            $userId = (int) ($payload['sub'] ?? 0);
            return $userId > 0 ? $userId : null;
        } catch (\Throwable) {
            return null;
        }
    }
}