<?php

declare(strict_types=1);

/**
 * WaitlistService
 *
 * Manages the booking_waitlist table so customers can be auto-notified when a
 * fully-booked time slot becomes available due to a cancellation.
 *
 * Requires migration 061_create_booking_waitlist.sql.
 */
class WaitlistService
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
     * Add a customer to the waitlist for a specific slot.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function join(array $data): array
    {
        $this->validateJoin($data);

        $slotDate  = trim((string) ($data['slotDate']  ?? ''));
        $slotTime  = trim((string) ($data['slotTime']  ?? ''));
        $email     = strtolower(trim((string) ($data['email'] ?? '')));

        if ($this->useDb) {
            // Prevent duplicate waiting entries for same person+slot
            $stmt = Database::getInstance()->prepare(
                'SELECT id FROM booking_waitlist
                 WHERE slot_date = :date AND slot_time = :time
                   AND email = :email AND status = "waiting"
                 LIMIT 1'
            );
            $stmt->execute([':date' => $slotDate, ':time' => $slotTime, ':email' => $email]);
            if ($stmt->fetch()) {
                throw new RuntimeException('You are already on the waitlist for this slot.', 409);
            }

            $db = Database::getInstance();
            $ins = $db->prepare(
                'INSERT INTO booking_waitlist
                 (slot_date, slot_time, user_id, name, email, phone, service_ids, notes, status)
                 VALUES
                 (:slot_date, :slot_time, :user_id, :name, :email, :phone, :service_ids, :notes, "waiting")'
            );
            $ins->execute([
                ':slot_date'   => $slotDate,
                ':slot_time'   => $slotTime,
                ':user_id'     => isset($data['userId']) ? (int) $data['userId'] : null,
                ':name'        => trim((string) ($data['name']       ?? '')),
                ':email'       => $email,
                ':phone'       => trim((string) ($data['phone']      ?? '')),
                ':service_ids' => trim((string) ($data['serviceIds'] ?? '')),
                ':notes'       => trim((string) ($data['notes']      ?? '')) ?: null,
            ]);
            return $this->dbGetById((int) $db->lastInsertId());
        }

        // File fallback – not implemented for waitlist (DB required for proper use)
        throw new RuntimeException('Waitlist requires a database connection.', 503);
    }

    /**
     * List all waiting entries (admin).
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(string $status = ''): array
    {
        if (!$this->useDb) {
            return [];
        }
        $where  = $status !== '' ? 'WHERE w.status = :status ' : '';
        $params = $status !== '' ? [':status' => $status] : [];

        $stmt = Database::getInstance()->prepare(
            "SELECT w.*, u.name AS user_name, u.email AS user_email
               FROM booking_waitlist w
               LEFT JOIN users u ON u.id = w.user_id
             {$where}ORDER BY w.slot_date ASC, w.slot_time ASC, w.created_at ASC"
        );
        $stmt->execute($params);
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /**
     * Get waitlist entries for a specific slot (for checking if anyone is waiting).
     *
     * @return array<int, array<string, mixed>>
     */
    public function getForSlot(string $date, string $time, string $status = 'waiting'): array
    {
        if (!$this->useDb) {
            return [];
        }
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM booking_waitlist
              WHERE slot_date = :date AND slot_time = :time AND status = :status
              ORDER BY created_at ASC'
        );
        $stmt->execute([':date' => $date, ':time' => $time, ':status' => $status]);
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** Remove a waitlist entry (admin or self). */
    public function remove(int $id, ?int $requestingUserId = null): void
    {
        if (!$this->useDb) {
            return;
        }
        $entry = $this->dbGetById($id);
        if ($requestingUserId !== null && (int) ($entry['userId'] ?? 0) !== $requestingUserId) {
            throw new RuntimeException('Not authorized to remove this waitlist entry.', 403);
        }
        $stmt = Database::getInstance()->prepare('DELETE FROM booking_waitlist WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Waitlist entry not found.', 404);
        }
    }

    /**
     * Mark a waiting entry as 'notified' and fire notification channels.
     * Called automatically when a booking slot opens (cancellation).
     *
     * @param array<string, mixed> $entry  Row from booking_waitlist
     */
    public function notifyEntry(array $entry): void
    {
        if (!$this->useDb) {
            return;
        }
        $id   = (int) ($entry['id'] ?? 0);
        $date = (string) ($entry['slotDate'] ?? '');
        $time = (string) ($entry['slotTime'] ?? '');
        $name = (string) ($entry['name']     ?? 'there');
        $email = (string) ($entry['email']   ?? '');
        $phone = (string) ($entry['phone']   ?? '');

        // Mark as notified immediately to prevent duplicate sends
        $stmt = Database::getInstance()->prepare(
            'UPDATE booking_waitlist SET status = "notified", notified_at = NOW() WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);

        // In-app notification for logged-in users
        $userId = isset($entry['userId']) && $entry['userId'] ? (int) $entry['userId'] : null;
        if ($userId !== null) {
            try {
                $ns = new UserNotificationService();
                $ns->create([
                    'user_id' => $userId,
                    'type'    => 'slot_available',
                    'title'   => 'Slot Available!',
                    'message' => "A slot has opened on {$date} at {$time}. Book now before it's taken!",
                    'data'    => json_encode(['slotDate' => $date, 'slotTime' => $time]),
                ]);
            } catch (\Throwable) {
                // fail silently
            }
        }

        // SMS notification
        if ($phone !== '') {
            try {
                $sms = new SmsService();
                $sms->waitlistSlotAvailable([
                    'name'  => $name,
                    'phone' => $phone,
                    'date'  => $date,
                    'time'  => $time,
                ]);
            } catch (\Throwable) {
                // fail silently
            }
        }

        // Email notification
        if ($email !== '') {
            try {
                $ns = new NotificationService();
                $ns->sendWaitlistSlotAvailable($name, $email, $date, $time);
            } catch (\Throwable) {
                // fail silently
            }
        }
    }

    /**
     * When a booking is cancelled, notify the first person on the waitlist
     * for that slot (if any).
     */
    public function handleBookingCancelled(string $slotDate, string $slotTime): void
    {
        $waiting = $this->getForSlot($slotDate, $slotTime, 'waiting');
        if (empty($waiting)) {
            return;
        }
        // Notify only the first person; others remain waiting
        $this->notifyEntry($waiting[0]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function dbGetById(int $id): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM booking_waitlist WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Waitlist entry not found.', 404);
        }
        return $this->mapRow($row);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapRow(array $row): array
    {
        return [
            'id'          => (int)    ($row['id']          ?? 0),
            'slotDate'    => (string) ($row['slot_date']   ?? ''),
            'slotTime'    => (string) ($row['slot_time']   ?? ''),
            'userId'      => isset($row['user_id']) && $row['user_id'] !== null
                               ? (int) $row['user_id'] : null,
            'name'        => (string) ($row['name']        ?? ''),
            'email'       => (string) ($row['email']       ?? ''),
            'phone'       => (string) ($row['phone']       ?? ''),
            'serviceIds'  => (string) ($row['service_ids'] ?? ''),
            'notes'       => isset($row['notes']) ? (string) $row['notes'] : null,
            'status'      => (string) ($row['status']      ?? 'waiting'),
            'notifiedAt'  => isset($row['notified_at']) ? (string) $row['notified_at'] : null,
            'createdAt'   => (string) ($row['created_at']  ?? ''),
            'updatedAt'   => (string) ($row['updated_at']  ?? ''),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validateJoin(array $data): void
    {
        $required = ['slotDate', 'slotTime', 'name', 'email'];
        foreach ($required as $field) {
            if (trim((string) ($data[$field] ?? '')) === '') {
                throw new RuntimeException("Field \"{$field}\" is required.", 422);
            }
        }
        if (!filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Invalid email address.', 422);
        }
    }
}
