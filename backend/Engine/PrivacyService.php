<?php

declare(strict_types=1);

/**
 * PrivacyService
 *
 * GDPR / Data Privacy tools for client users:
 *   - Export all personal data (profile, bookings, vehicles, reviews) as JSON
 *   - Delete account and wipe all related data
 *
 * Requires migration 060_add_consent_to_users.sql.
 */
class PrivacyService
{
    private bool $useDb;

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Export all data for a user as an associative array (caller converts to JSON).
     *
     * @return array<string, mixed>
     */
    public function exportData(int $userId): array
    {
        if (!$this->useDb) {
            throw new RuntimeException('Data export requires a database connection.', 503);
        }

        $db = Database::getInstance();

        // Profile
        $stmt = $db->prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Bookings (own)
        $stmt = $db->prepare(
            'SELECT b.id, b.reference_number, s.title AS service_name, b.appointment_date, b.appointment_time,
                    b.vehicle_info, b.vehicle_make, b.vehicle_model, b.vehicle_year,
                    b.status, b.notes, b.created_at
               FROM bookings b
               LEFT JOIN services s ON s.id = b.service_id
              WHERE b.user_id = :id ORDER BY b.created_at DESC'
        );
        $stmt->execute([':id' => $userId]);
        $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Vehicles / Garage
        $stmt = $db->prepare(
            'SELECT make, model, year, vin, license_plate, created_at
               FROM client_vehicles WHERE user_id = :id ORDER BY created_at DESC'
        );
        $stmt->execute([':id' => $userId]);
        $vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Reviews
        $stmt = $db->prepare(
            'SELECT u.name AS reviewer_name, s.title AS service_name, r.rating, r.review, r.created_at
               FROM booking_reviews r
               JOIN bookings b ON b.id = r.booking_id
               LEFT JOIN services s ON s.id = b.service_id
               LEFT JOIN users u ON u.id = r.user_id
              WHERE r.user_id = :id ORDER BY r.created_at DESC'
        );
        $stmt->execute([':id' => $userId]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Waitlist entries
        $stmt = $db->prepare(
            'SELECT slot_date, slot_time, service_ids, status, created_at
               FROM booking_waitlist WHERE user_id = :id ORDER BY created_at DESC'
        );
        $stmt->execute([':id' => $userId]);
        $waitlist = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'exportedAt' => date('c'),
            'profile'    => $profile,
            'bookings'   => $bookings,
            'vehicles'   => $vehicles,
            'reviews'    => $reviews,
            'waitlist'   => $waitlist,
        ];
    }

    /**
     * Permanently delete a user account and all associated personal data.
     *
     * This wipes: bookings (user_id set to NULL, personal fields anonymised),
     * client_vehicles, booking_reviews (soft-anonymised), waitlist entries,
     * notifications, sessions, and finally the user row itself.
     *
     * @param int    $userId  User to delete.
     * @param string $reason  Optional reason for audit log.
     */
    public function deleteAccount(int $userId, string $reason = 'user_request'): void
    {
        if (!$this->useDb) {
            throw new RuntimeException('Account deletion requires a database connection.', 503);
        }

        $db = Database::getInstance();

        // Anonymise bookings (keep history for business records, strip PII)
        $db->prepare(
            "UPDATE bookings SET
                user_id      = NULL,
                name         = '[Deleted User]',
                email        = '',
                phone        = '',
                signature_data = NULL,
                internal_notes = NULL
             WHERE user_id = :id"
        )->execute([':id' => $userId]);

        // Remove vehicles
        $db->prepare('DELETE FROM client_vehicles WHERE user_id = :id')
           ->execute([':id' => $userId]);

        // Anonymise reviews (keep rating/service info for public display if approved)
        $db->prepare(
            "UPDATE booking_reviews SET reviewer_name = '[Deleted User]', review = NULL
              WHERE user_id = :id"
        )->execute([':id' => $userId]);

        // Remove waitlist entries
        $db->prepare('DELETE FROM booking_waitlist WHERE user_id = :id')
           ->execute([':id' => $userId]);

        // Remove notifications
        $db->prepare('DELETE FROM notifications WHERE user_id = :id')
           ->execute([':id' => $userId]);

        // Revoke auth sessions
        $db->prepare("UPDATE auth_sessions SET revoked_at = NOW(), revoked_reason = :reason WHERE user_id = :id")
           ->execute([':reason' => $reason, ':id' => $userId]);

        // Delete the user row itself
        $db->prepare('DELETE FROM users WHERE id = :id')
           ->execute([':id' => $userId]);
    }

    /**
     * Record consent for a user (called at registration or when consent version changes).
     */
    public function recordConsent(int $userId, string $version = '1.0'): void
    {
        if (!$this->useDb) {
            return;
        }
        $db = Database::getInstance();
        $db->prepare(
            'UPDATE users SET consented_at = NOW(), consent_version = :version WHERE id = :id'
        )->execute([':version' => $version, ':id' => $userId]);
    }
}
