<?php

declare(strict_types=1);

/**
 * Manages booking reviews submitted by clients after a completed service.
 *
 * Reviews are gated by admin approval before being surfaced publicly.
 */
class ReviewService
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Client actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create or replace a review for a completed booking.
     *
     * A client may re-submit their review (it replaces the previous one and
     * resets approval so the admin can re-moderate).
     *
     * @param  array<string, mixed> $data  Must contain 'rating' (1-5) and optionally 'review'
     * @return array<string, mixed>
     * @throws \RuntimeException 422 on validation failure
     */
    public function create(string $bookingId, int $userId, array $data): array
    {
        $rating = (int) ($data['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) {
            throw new \RuntimeException('Rating must be between 1 and 5.', 422);
        }
        $review = isset($data['review']) ? mb_substr(trim((string) $data['review']), 0, 2000) : null;

        $stmt = $this->db->prepare(
            'INSERT INTO booking_reviews (booking_id, user_id, rating, review, is_approved)
             VALUES (:bid, :uid, :rating, :review, 0)
             ON DUPLICATE KEY UPDATE
               rating      = VALUES(rating),
               review      = VALUES(review),
               is_approved = 0,
               updated_at  = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            ':bid'    => $bookingId,
            ':uid'    => $userId,
            ':rating' => $rating,
            ':review' => $review,
        ]);

        return $this->getForBooking($bookingId);
    }

    /**
     * Return the review for a specific booking (or null if none exists yet).
     *
     * @return array<string, mixed>|null
     */
    public function getForBooking(string $bookingId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT r.*, u.name AS reviewer_name
               FROM booking_reviews r
               JOIN users u ON u.id = r.user_id
              WHERE r.booking_id = :bid
              LIMIT 1'
        );
        $stmt->execute([':bid' => $bookingId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ? $this->format($row) : null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return all reviews with their booking and reviewer info.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(): array
    {
        $stmt = $this->db->query(
            'SELECT r.*, u.name AS reviewer_name, s.title AS service_name, b.vehicle_info
               FROM booking_reviews r
               JOIN users    u ON u.id = r.user_id
               JOIN bookings b ON b.id = r.booking_id
               LEFT JOIN services s ON s.id = b.service_id
              ORDER BY r.created_at DESC'
        );
        return array_map([$this, 'format'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** Approve a review. */
    public function approve(int $id): void
    {
        $this->db->prepare('UPDATE booking_reviews SET is_approved = 1 WHERE id = :id')
                 ->execute([':id' => $id]);
    }

    /** Reject (un-approve) a review. */
    public function reject(int $id): void
    {
        $this->db->prepare('UPDATE booking_reviews SET is_approved = 0 WHERE id = :id')
                 ->execute([':id' => $id]);
    }

    /** Delete a review permanently. */
    public function delete(int $id): void
    {
        $this->db->prepare('DELETE FROM booking_reviews WHERE id = :id')
                 ->execute([':id' => $id]);
    }

    /**
     * Return total/average rating stats.
     *
     * @return array{total: int, avgRating: float}
     */
    public function getStats(): array
    {
        $row = $this->db->query(
            'SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
               FROM booking_reviews
              WHERE is_approved = 1'
        )->fetch(\PDO::FETCH_ASSOC);

        return [
            'total'     => (int)   ($row['total']      ?? 0),
            'avgRating' => (float) ($row['avg_rating']  ?? 0),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $row */
    private function format(array $row): array
    {
        return [
            'id'           => (int)  $row['id'],
            'bookingId'    => (string) $row['booking_id'],
            'userId'       => (int)  $row['user_id'],
            'reviewerName' => (string) ($row['reviewer_name'] ?? ''),
            'serviceName'  => (string) ($row['service_name']  ?? ''),
            'vehicleInfo'  => (string) ($row['vehicle_info']  ?? ''),
            'rating'       => (int)  $row['rating'],
            'review'       => $row['review'] !== null ? (string) $row['review'] : null,
            'isApproved'   => (bool) $row['is_approved'],
            'createdAt'    => (string) $row['created_at'],
            'updatedAt'    => (string) $row['updated_at'],
        ];
    }
}
