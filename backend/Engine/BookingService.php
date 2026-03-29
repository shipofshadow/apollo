<?php

declare(strict_types=1);

/**
 * Booking creation, retrieval and status management.
 *
 * When DB_NAME is configured, bookings are stored in MySQL / MariaDB.
 * Otherwise they fall back to a local JSON file at storage/bookings.json.
 *
 * SQL (run once to create the schema – requires users table first):
 *
 *   CREATE TABLE IF NOT EXISTS bookings (
 *       id               CHAR(36)     NOT NULL PRIMARY KEY,
 *       user_id          INT UNSIGNED DEFAULT NULL,
 *       name             VARCHAR(200) NOT NULL,
 *       email            VARCHAR(255) NOT NULL,
 *       phone            VARCHAR(30)  NOT NULL,
 *       vehicle_info     VARCHAR(255) NOT NULL,
 *       service_id       VARCHAR(50)  NOT NULL,
 *       service_name     VARCHAR(200) NOT NULL,
 *       appointment_date DATE         NOT NULL,
 *       appointment_time VARCHAR(20)  NOT NULL,
 *       notes            TEXT         DEFAULT NULL,
 *       status           ENUM('pending','confirmed','completed','cancelled')
 *                        NOT NULL DEFAULT 'pending',
 *       created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *       updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
 *                        ON UPDATE CURRENT_TIMESTAMP,
 *       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
 *   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 */
class BookingService
{
    private bool $useDb;

    private static string $storageFile = __DIR__ . '/../storage/bookings.json';

    private const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'awaiting_parts'];

    /** @var int|null Cached slot capacity to avoid repeated DB/file reads within one request. */
    private ?int $slotCapacityCache = null;

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    /**
     * Return the configured maximum number of bookings allowed per time slot.
     * Reads from site_settings key 'slot_capacity', defaulting to 3.
     */
    public function getSlotCapacity(): int
    {
        if ($this->slotCapacityCache !== null) {
            return $this->slotCapacityCache;
        }
        $settings = (new SiteSettingsService())->getAll();
        $this->slotCapacityCache = max(1, (int) ($settings['slot_capacity'] ?? 3));
        return $this->slotCapacityCache;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Create a new booking.
     *
     * @param  array<string, mixed> $data
     * @param  int|null             $userId  Authenticated user ID, or null for walk-ins.
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $userId = null): array
    {
        $this->validatePayload($data);

        // Server-side capacity check – reject immediately if the slot is already full
        $date = trim($data['appointmentDate']);
        $time = trim($data['appointmentTime']);
        if (in_array($time, $this->getBookedSlots($date), true)) {
            throw new RuntimeException(
                'This time slot is fully booked. Please choose a different time.',
                409
            );
        }

        // Support both legacy single-serviceId and new multi-service serviceIds
        $serviceIds  = $this->resolveServiceIds($data);
        $primaryId   = $serviceIds[0];
        $serviceName = $this->resolveServiceNames($serviceIds, $data);

        $booking = [
            'id'                 => $this->uuid(),
            'userId'             => $userId,
            'name'               => trim($data['name']),
            'email'              => strtolower(trim($data['email'])),
            'phone'              => trim($data['phone']),
            'vehicleInfo'        => trim($data['vehicleInfo']),
            'vehicleMake'        => trim($data['vehicleMake']  ?? ''),
            'vehicleModel'       => trim($data['vehicleModel'] ?? ''),
            'vehicleYear'        => trim($data['vehicleYear']  ?? ''),
            'serviceId'          => $primaryId,
            'serviceIds'         => $serviceIds,
            'serviceName'        => $serviceName,
            'selectedVariations' => $this->resolveSelectedVariations($data),
            'appointmentDate'    => trim($data['appointmentDate']),
            'appointmentTime'    => trim($data['appointmentTime']),
            'notes'              => trim($data['notes']          ?? ''),
            'signatureData'      => $data['signatureData']        ?? null,
            'mediaUrls'          => $data['mediaUrls']            ?? [],
            'status'             => 'pending',
            'awaitingParts'      => false,
            'partsNotes'         => null,
            'createdAt'          => date('c'),
        ];

        $this->useDb ? $this->dbInsert($booking) : $this->fileInsert($booking);

        (new NotificationService())->bookingCreated($booking);

        // In-app notification for admin
        if ($this->useDb) {
            $vehicle = trim((string) ($booking['vehicleInfo'] ?? ''));
            $svcName = (string) ($booking['serviceName'] ?? '');
            (new UserNotificationService())->createForAdmin(
                'new_booking',
                'New Booking Received',
                "{$booking['name']} booked {$svcName}" . ($vehicle !== '' ? " · {$vehicle}" : ''),
                ['bookingId' => $booking['id']]
            );
        }

        return $booking;
    }

    /**
     * Return all bookings (admin use).
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(): array
    {
        return $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
    }

    /**
     * Return bookings belonging to a specific user.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getByUserId(int $userId): array
    {
        if ($this->useDb) {
            return $this->dbGetByUser($userId);
        }

        return array_values(
            array_filter($this->fileGetAll(), fn (array $b) => (int) ($b['userId'] ?? 0) === $userId)
        );
    }

    /**
     * Return aggregate booking statistics for the admin dashboard.
     *
     * @return array<string, int>
     */
    public function getStats(): array
    {
        return $this->useDb ? $this->dbGetStats() : $this->fileGetStats();
    }

    /**
     * Return the time slots that are already fully booked for a given date.
     *
     * A slot is considered "taken" once the configured slot capacity is reached
     * for bookings with status 'pending' or 'confirmed'.
     *
     * @return string[]  e.g. ['09:00 AM', '11:00 AM']
     */
    public function getBookedSlots(string $date): array
    {
        return $this->useDb
            ? $this->dbGetBookedSlots($date)
            : $this->fileGetBookedSlots($date);
    }

    /**
     * Return the number of active bookings per time slot for a given date.
     * Only bookings with status 'pending' or 'confirmed' are counted.
     *
     * @return array<string, int>  e.g. ['09:00 AM' => 2, '11:00 AM' => 3]
     */
    public function getSlotCounts(string $date): array
    {
        return $this->useDb
            ? $this->dbGetSlotCounts($date)
            : $this->fileGetSlotCounts($date);
    }

    /**
     * Update a booking's status.
     *
     * @return array<string, mixed>  Updated booking
     */
    public function updateStatus(string $id, string $status): array
    {
        if (!in_array($status, self::VALID_STATUSES, true)) {
            throw new RuntimeException(
                'Invalid status. Allowed: ' . implode(', ', self::VALID_STATUSES) . '.', 422
            );
        }

        $booking = $this->useDb
            ? $this->dbUpdateStatus($id, $status)
            : $this->fileUpdateStatus($id, $status);

        (new NotificationService())->bookingStatusChanged($booking);

        // In-app notification for the client who made the booking
        if ($this->useDb) {
            $uid = (int) ($booking['userId'] ?? 0);
            if ($uid > 0) {
                $label   = ucwords(str_replace('_', ' ', $status));
                $svcName = (string) ($booking['serviceName'] ?? 'your service');
                (new UserNotificationService())->createForUser(
                    $uid,
                    'status_changed',
                    "Booking Status: {$label}",
                    "Your booking for {$svcName} is now {$label}.",
                    ['bookingId' => $booking['id'], 'status' => $status]
                );
            }
        }

        return $booking;
    }

    /**
     * Update the parts-dependency flag and notes for a booking.
     *
     * @return array<string, mixed>  Updated booking
     */
    public function updatePartsStatus(string $id, bool $awaitingParts, string $partsNotes): array
    {
        $booking = $this->useDb
            ? $this->dbUpdateParts($id, $awaitingParts, $partsNotes)
            : $this->fileUpdateParts($id, $awaitingParts, $partsNotes);

        if ($awaitingParts) {
            (new NotificationService())->bookingAwaitingParts($booking);

            // In-app notification for the client
            if ($this->useDb) {
                $uid = (int) ($booking['userId'] ?? 0);
                if ($uid > 0) {
                    $svcName = (string) ($booking['serviceName'] ?? 'your service');
                    (new UserNotificationService())->createForUser(
                        $uid,
                        'parts_update',
                        'Job On Hold – Awaiting Parts',
                        "Your {$svcName} job is on hold while we wait for parts to arrive.",
                        ['bookingId' => $booking['id']]
                    );
                }
            }
        }

        return $booking;
    }

    /**
     * Allow an authenticated client to cancel their own booking.
     * Only bookings with status 'pending' or 'confirmed' may be cancelled.
     *
     * @throws RuntimeException 403 if booking does not belong to user, 422 if not cancellable
     * @return array<string, mixed>  Updated booking
     */
    public function cancelByUser(string $id, int $userId): array
    {
        $booking = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($booking === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        if ((int) ($booking['userId'] ?? 0) !== $userId) {
            throw new RuntimeException('You are not authorized to cancel this booking.', 403);
        }

        if (!in_array($booking['status'], ['pending', 'confirmed'], true)) {
            throw new RuntimeException(
                'Only pending or confirmed bookings can be cancelled.',
                422
            );
        }

        return $this->updateStatus($id, 'cancelled');
    }

    /**
     * Fetch a single booking by ID, verifying ownership.
     *
     * @return array<string, mixed>
     */
    public function getById(string $id, int $userId): array
    {
        $booking = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($booking === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        if ((int) ($booking['userId'] ?? 0) !== $userId) {
            throw new RuntimeException('You are not authorized to view this booking.', 403);
        }

        return $booking;
    }

    /**
     * Retrieve a booking by ID without an ownership check (admin use only).
     *
     * @return array<string, mixed>|null  null when not found
     */
    public function adminFindById(string $id): ?array
    {
        return $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);
    }

    /**
     * Admin-only reschedule: no ownership check, bypasses client restrictions.
     * Date must be in YYYY-MM-DD format; time must be non-empty.
     *
     * @return array<string, mixed>
     */
    public function adminReschedule(string $id, string $date, string $time): array
    {
        $booking = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($booking === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('Invalid date format. Expected YYYY-MM-DD.', 422);
        }
        // Use DateTime comparison to avoid any edge-case with string comparison
        $inputTs = strtotime($date);
        if ($inputTs === false) {
            throw new RuntimeException('Invalid date. Expected a valid YYYY-MM-DD date.', 422);
        }
        $todayTs = strtotime(date('Y-m-d'));
        if ($inputTs < $todayTs) {
            throw new RuntimeException('Appointment date cannot be in the past.', 422);
        }
        if (trim($time) === '') {
            throw new RuntimeException('Appointment time is required.', 422);
        }

        // Skip availability check if keeping the same slot
        $sameSlot = ($booking['appointmentDate'] === $date && $booking['appointmentTime'] === $time);
        if (!$sameSlot && in_array($time, $this->getBookedSlots($date), true)) {
            throw new RuntimeException(
                'This time slot is fully booked. Please choose a different time.',
                409
            );
        }

        return $this->useDb
            ? $this->dbReschedule($id, $date, $time)
            : $this->fileReschedule($id, $date, $time);
    }

    /**
     * Reschedule a booking's appointment date and time (client-only).
     * Only bookings with status 'pending' or 'confirmed' can be rescheduled.
     *
     * @return array<string, mixed>
     */
    public function reschedule(string $id, int $userId, string $date, string $time): array
    {
        $booking = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($booking === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        if ((int) ($booking['userId'] ?? 0) !== $userId) {
            throw new RuntimeException('You are not authorized to reschedule this booking.', 403);
        }

        if (!in_array($booking['status'], ['pending', 'confirmed'], true)) {
            throw new RuntimeException(
                'Only pending or confirmed bookings can be rescheduled.',
                422
            );
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('Invalid date format. Expected YYYY-MM-DD.', 422);
        }
        if ($date < date('Y-m-d')) {
            throw new RuntimeException('Appointment date cannot be in the past.', 422);
        }
        if (trim($time) === '') {
            throw new RuntimeException('Appointment time is required.', 422);
        }

        // Check slot availability (skip check if keeping the same slot)
        $sameSlot = ($booking['appointmentDate'] === $date && $booking['appointmentTime'] === $time);
        if (!$sameSlot && in_array($time, $this->getBookedSlots($date), true)) {
            throw new RuntimeException(
                'This time slot is fully booked. Please choose a different time.',
                409
            );
        }

        return $this->useDb
            ? $this->dbReschedule($id, $date, $time)
            : $this->fileReschedule($id, $date, $time);
    }

    // -------------------------------------------------------------------------
    // DB storage
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $booking */
    private function dbInsert(array $booking): void
    {
        $db = Database::getInstance();
        $db->prepare(
            'INSERT INTO bookings
             (id, user_id, name, email, phone, vehicle_info, vehicle_make, vehicle_model,
              vehicle_year, service_id, service_ids, selected_variations, appointment_date, appointment_time,
              notes, signature_data, media_urls, status)
             VALUES
             (:id, :user_id, :name, :email, :phone, :vehicle_info, :vehicle_make, :vehicle_model,
              :vehicle_year, :service_id, :service_ids, :selected_variations, :appointment_date, :appointment_time,
              :notes, :signature_data, :media_urls, :status)'
        )->execute([
            ':id'                  => $booking['id'],
            ':user_id'             => $booking['userId'],
            ':name'                => $booking['name'],
            ':email'               => $booking['email'],
            ':phone'               => $booking['phone'],
            ':vehicle_info'        => $booking['vehicleInfo'],
            ':vehicle_make'        => $booking['vehicleMake']  ?? null,
            ':vehicle_model'       => $booking['vehicleModel'] ?? null,
            ':vehicle_year'        => $booking['vehicleYear']  ?? null,
            ':service_id'          => $booking['serviceId'],
            ':service_ids'         => json_encode($booking['serviceIds'] ?? [$booking['serviceId']]),
            ':selected_variations' => json_encode($booking['selectedVariations'] ?? []),
            ':appointment_date'    => $booking['appointmentDate'],
            ':appointment_time'    => $booking['appointmentTime'],
            ':notes'               => $booking['notes'],
            ':signature_data'      => $booking['signatureData'] ?? null,
            ':media_urls'          => json_encode($booking['mediaUrls'] ?? []),
            ':status'              => $booking['status'],
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             ORDER BY b.created_at DESC'
        );
        return array_map([$this, 'mapDbRow'], $stmt->fetchAll());
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetByUser(int $userId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.user_id = :uid
             ORDER BY b.created_at DESC'
        );
        $stmt->execute([':uid' => $userId]);
        return array_map([$this, 'mapDbRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbUpdateStatus(string $id, string $status): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'UPDATE bookings SET status = :status WHERE id = :id'
        );
        $stmt->execute([':status' => $status, ':id' => $id]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $row = $db->prepare(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        return $this->mapDbRow($row->fetch());
    }

    /** @return array<string, mixed>|null */
    private function dbFindById(string $id): ?array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ? $this->mapDbRow($row) : null;
    }

    /** @return array<string, mixed>|null */
    private function fileFindById(string $id): ?array
    {
        foreach ($this->fileGetAll() as $b) {
            if (($b['id'] ?? '') === $id) {
                return $b;
            }
        }
        return null;
    }

    /** @return array<string, mixed> */
    private function dbReschedule(string $id, string $date, string $time): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'UPDATE bookings SET appointment_date = :date, appointment_time = :time WHERE id = :id'
        );
        $stmt->execute([':date' => $date, ':time' => $time, ':id' => $id]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $row = $db->prepare(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        return $this->mapDbRow($row->fetch());
    }

    /** @return array<string, mixed> */
    private function fileReschedule(string $id, string $date, string $time): array
    {
        $all   = array_reverse($this->fileGetAll());
        $found = null;

        foreach ($all as &$b) {
            if ($b['id'] === $id) {
                $b['appointmentDate'] = $date;
                $b['appointmentTime'] = $time;
                $found                = $b;
                break;
            }
        }
        unset($b);

        if ($found === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $this->fileWrite($all);
        return $found;
    }

    /** @return array<string, mixed> */
    private function dbUpdateParts(string $id, bool $awaitingParts, string $partsNotes): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'UPDATE bookings SET awaiting_parts = :ap, parts_notes = :pn WHERE id = :id'
        );
        $stmt->execute([':ap' => (int) $awaitingParts, ':pn' => $partsNotes, ':id' => $id]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $row = $db->prepare(
            'SELECT b.*, s.title AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        return $this->mapDbRow($row->fetch());
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapDbRow(array $row): array
    {
        $rawIds = $row['service_ids'] ?? null;
        $serviceIds = $rawIds
            ? (json_decode((string) $rawIds, true) ?? [(int) $row['service_id']])
            : [(int) $row['service_id']];

        $rawMedia = $row['media_urls'] ?? null;
        $mediaUrls = $rawMedia ? (json_decode((string) $rawMedia, true) ?? []) : [];

        $rawVars = $row['selected_variations'] ?? null;
        $selectedVariations = $rawVars ? (json_decode((string) $rawVars, true) ?? []) : [];

        return [
            'id'                 => $row['id'],
            'userId'             => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'name'               => $row['name'],
            'email'              => $row['email'],
            'phone'              => $row['phone'],
            'vehicleInfo'        => $row['vehicle_info'],
            'vehicleMake'        => $row['vehicle_make']  ?? null,
            'vehicleModel'       => $row['vehicle_model'] ?? null,
            'vehicleYear'        => $row['vehicle_year']  ?? null,
            'serviceId'          => (int) $row['service_id'],
            'serviceIds'         => $serviceIds,
            'serviceName'        => $row['service_name'],
            'selectedVariations' => $selectedVariations,
            'appointmentDate'    => $row['appointment_date'],
            'appointmentTime'    => $row['appointment_time'],
            'notes'              => $row['notes']          ?? '',
            'signatureData'      => $row['signature_data'] ?? null,
            'mediaUrls'          => $mediaUrls,
            'status'             => $row['status'],
            'awaitingParts'      => (bool) ($row['awaiting_parts'] ?? ($row['status'] === 'awaiting_parts')),
            'partsNotes'         => $row['parts_notes'] ?? null,
            'createdAt'          => $row['created_at'],
        ];
    }

    // -------------------------------------------------------------------------
    // DB – availability
    // -------------------------------------------------------------------------

    /** @return string[] */
    private function dbGetBookedSlots(string $date): array
    {
        $stmt = Database::getInstance()->prepare(
            "SELECT appointment_time
             FROM bookings
             WHERE appointment_date = :date
               AND status IN ('pending','confirmed')
             GROUP BY appointment_time
             HAVING COUNT(*) >= :max"
        );
        $stmt->execute([':date' => $date, ':max' => $this->getSlotCapacity()]);
        return array_column($stmt->fetchAll(\PDO::FETCH_ASSOC), 'appointment_time');
    }

    /** @return string[] */
    private function fileGetBookedSlots(string $date): array
    {
        $counts = $this->fileGetSlotCounts($date);
        $max    = $this->getSlotCapacity();
        return array_keys(array_filter($counts, fn (int $c) => $c >= $max));
    }

    /** @return array<string, int> */
    private function dbGetSlotCounts(string $date): array
    {
        $stmt = Database::getInstance()->prepare(
            "SELECT appointment_time, COUNT(*) AS cnt
             FROM bookings
             WHERE appointment_date = :date
               AND status IN ('pending','confirmed')
             GROUP BY appointment_time"
        );
        $stmt->execute([':date' => $date]);
        $result = [];
        foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $result[(string) $row['appointment_time']] = (int) $row['cnt'];
        }
        return $result;
    }

    /** @return array<string, int> */
    private function fileGetSlotCounts(string $date): array
    {
        $counts = [];
        foreach ($this->fileGetAll() as $b) {
            if (
                ($b['appointmentDate'] ?? '') === $date
                && in_array($b['status'] ?? '', ['pending', 'confirmed'], true)
            ) {
                $time = (string) ($b['appointmentTime'] ?? '');
                $counts[$time] = ($counts[$time] ?? 0) + 1;
            }
        }
        return $counts;
    }

    // -------------------------------------------------------------------------
    // DB – stats
    // -------------------------------------------------------------------------

    /** @return array<string, int> */
    private function dbGetStats(): array
    {
        $db = Database::getInstance();

        $total = (int) $db->query('SELECT COUNT(*) FROM bookings')->fetchColumn();

        $byStatus = $db->query(
            'SELECT status, COUNT(*) AS cnt FROM bookings GROUP BY status'
        )->fetchAll(\PDO::FETCH_KEY_PAIR);

        $pending   = (int) ($byStatus['pending']   ?? 0);
        $confirmed = (int) ($byStatus['confirmed'] ?? 0);
        $completed = (int) ($byStatus['completed'] ?? 0);
        $cancelled = (int) ($byStatus['cancelled'] ?? 0);

        $thisWeek = (int) $db->query(
            "SELECT COUNT(*) FROM bookings WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )->fetchColumn();

        $thisMonth = (int) $db->query(
            "SELECT COUNT(*) FROM bookings WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"
        )->fetchColumn();

        return [
            'totalBookings'     => $total,
            'pendingBookings'   => $pending,
            'confirmedBookings' => $confirmed,
            'completedBookings' => $completed,
            'cancelledBookings' => $cancelled,
            'activeBookings'    => $pending + $confirmed,
            'bookingsThisWeek'  => $thisWeek,
            'bookingsThisMonth' => $thisMonth,
        ];
    }

    // -------------------------------------------------------------------------
    // File storage (fallback)
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $booking */
    private function fileInsert(array $booking): void
    {
        $all   = $this->fileGetAll();
        $all[] = $booking;
        $this->fileWrite($all);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }
        $data = json_decode((string) file_get_contents(self::$storageFile), true);
        return is_array($data) ? array_reverse($data) : [];
    }

    /** @return array<string, mixed> */
    private function fileUpdateStatus(string $id, string $status): array
    {
        $all   = array_reverse($this->fileGetAll()); // back to chronological order
        $found = null;

        foreach ($all as &$b) {
            if ($b['id'] === $id) {
                $b['status'] = $status;
                $found       = $b;
                break;
            }
        }
        unset($b);

        if ($found === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $this->fileWrite($all);
        return $found;
    }

    /** @return array<string, mixed> */
    private function fileUpdateParts(string $id, bool $awaitingParts, string $partsNotes): array
    {
        $all   = array_reverse($this->fileGetAll());
        $found = null;

        foreach ($all as &$b) {
            if ($b['id'] === $id) {
                $b['awaitingParts'] = $awaitingParts;
                $b['partsNotes']    = $partsNotes;
                $found              = $b;
                break;
            }
        }
        unset($b);

        if ($found === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $this->fileWrite($all);
        return $found;
    }

    /** @param array<int, array<string, mixed>> $bookings */
    private function fileWrite(array $bookings): void
    {
        $dir = dirname(self::$storageFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(self::$storageFile, json_encode($bookings, JSON_PRETTY_PRINT));
    }

    /** @return array<string, int> */
    private function fileGetStats(): array
    {
        $all = $this->fileGetAll();

        $weekAgo    = new \DateTime('-7 days');
        $monthStart = new \DateTime('first day of this month midnight');

        $pending   = 0;
        $confirmed = 0;
        $completed = 0;
        $cancelled = 0;
        $thisWeek  = 0;
        $thisMonth = 0;

        foreach ($all as $b) {
            switch ($b['status'] ?? '') {
                case 'pending':   $pending++;   break;
                case 'confirmed': $confirmed++; break;
                case 'completed': $completed++; break;
                case 'cancelled': $cancelled++; break;
            }

            $created = new \DateTime($b['createdAt'] ?? 'now');
            if ($created >= $weekAgo)    $thisWeek++;
            if ($created >= $monthStart) $thisMonth++;
        }

        return [
            'totalBookings'     => count($all),
            'pendingBookings'   => $pending,
            'confirmedBookings' => $confirmed,
            'completedBookings' => $completed,
            'cancelledBookings' => $cancelled,
            'activeBookings'    => $pending + $confirmed,
            'bookingsThisWeek'  => $thisWeek,
            'bookingsThisMonth' => $thisMonth,
        ];
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        $required = [
            'name', 'email', 'phone', 'vehicleInfo',
            'appointmentDate', 'appointmentTime',
        ];
        foreach ($required as $field) {
            if (empty(trim((string) ($data[$field] ?? '')))) {
                throw new RuntimeException("Field '$field' is required.", 422);
            }
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
        // Accepts new multi-service format (serviceIds[]) or legacy single serviceId
        $ids = $this->resolveServiceIds($data);
        if (empty($ids)) {
            throw new RuntimeException('At least one valid serviceId is required.', 422);
        }
    }

    /**
     * Normalise the submitted service ID(s) into an array of positive integers.
     * Accepts: serviceIds[] (new) or serviceId (legacy single value).
     *
     * @return int[]
     */
    private function resolveServiceIds(array $data): array
    {
        if (!empty($data['serviceIds']) && is_array($data['serviceIds'])) {
            return array_values(array_filter(
                array_map('intval', $data['serviceIds']),
                fn (int $id) => $id > 0
            ));
        }
        $id = (int) ($data['serviceId'] ?? 0);
        return $id > 0 ? [$id] : [];
    }

    /**
     * Resolve human-readable names for all selected service IDs.
     * In DB mode fetches from the services table; falls back to client-supplied names.
     *
     * @param int[] $serviceIds
     */
    private function resolveServiceNames(array $serviceIds, array $data): string
    {
        if ($this->useDb && !empty($serviceIds)) {
            $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
            $stmt = Database::getInstance()->prepare(
                "SELECT id, title FROM services WHERE id IN ($placeholders)"
            );
            $stmt->execute($serviceIds);
            $map = array_column($stmt->fetchAll(\PDO::FETCH_ASSOC), 'title', 'id');

            $names = [];
            foreach ($serviceIds as $id) {
                if (!isset($map[$id])) {
                    throw new RuntimeException("Service #$id not found.", 422);
                }
                $names[] = $map[$id];
            }
            return implode(', ', $names);
        }

        // File-storage fallback: use client-supplied serviceName
        return trim((string) ($data['serviceName'] ?? ''));
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    /**
     * Normalise and validate the selectedVariations input.
     * Expects an array of objects: [{serviceId, variationId, variationName}, ...]
     *
     * @param  array<string, mixed> $data
     * @return array<int, array<string, mixed>>
     */
    private function resolveSelectedVariations(array $data): array
    {
        $raw = $data['selectedVariations'] ?? [];
        if (!is_array($raw)) {
            return [];
        }
        $result = [];
        foreach ($raw as $item) {
            if (!is_array($item)) {
                continue;
            }
            $serviceId   = isset($item['serviceId'])   ? (int) $item['serviceId']   : null;
            $variationId = isset($item['variationId']) ? (int) $item['variationId'] : null;
            $name        = isset($item['variationName']) ? trim((string) $item['variationName']) : '';
            if ($serviceId && $variationId) {
                $result[] = [
                    'serviceId'     => $serviceId,
                    'variationId'   => $variationId,
                    'variationName' => $name,
                ];
            }
        }
        return $result;
    }

    private function uuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
