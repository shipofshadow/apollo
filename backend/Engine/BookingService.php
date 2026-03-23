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

    private const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
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

        $serviceId   = (int) $data['serviceId'];
        $serviceName = $this->resolveServiceName($serviceId, $data);

        $booking = [
            'id'              => $this->uuid(),
            'userId'          => $userId,
            'name'            => trim($data['name']),
            'email'           => strtolower(trim($data['email'])),
            'phone'           => trim($data['phone']),
            'vehicleInfo'     => trim($data['vehicleInfo']),
            'serviceId'       => $serviceId,
            'serviceName'     => $serviceName,
            'appointmentDate' => trim($data['appointmentDate']),
            'appointmentTime' => trim($data['appointmentTime']),
            'notes'           => trim($data['notes'] ?? ''),
            'status'          => 'pending',
            'createdAt'       => date('c'),
        ];

        $this->useDb ? $this->dbInsert($booking) : $this->fileInsert($booking);

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
     * A slot is considered "taken" once MAX_BOOKINGS_PER_SLOT bookings with
     * status 'pending' or 'confirmed' exist for that date+time combination.
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

        return $this->useDb
            ? $this->dbUpdateStatus($id, $status)
            : $this->fileUpdateStatus($id, $status);
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
             (id, user_id, name, email, phone, vehicle_info, service_id,
              appointment_date, appointment_time, notes, status)
             VALUES
             (:id, :user_id, :name, :email, :phone, :vehicle_info, :service_id,
              :appointment_date, :appointment_time, :notes, :status)'
        )->execute([
            ':id'               => $booking['id'],
            ':user_id'          => $booking['userId'],
            ':name'             => $booking['name'],
            ':email'            => $booking['email'],
            ':phone'            => $booking['phone'],
            ':vehicle_info'     => $booking['vehicleInfo'],
            ':service_id'       => $booking['serviceId'],
            ':appointment_date' => $booking['appointmentDate'],
            ':appointment_time' => $booking['appointmentTime'],
            ':notes'            => $booking['notes'],
            ':status'           => $booking['status'],
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

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapDbRow(array $row): array
    {
        return [
            'id'              => $row['id'],
            'userId'          => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'name'            => $row['name'],
            'email'           => $row['email'],
            'phone'           => $row['phone'],
            'vehicleInfo'     => $row['vehicle_info'],
            'serviceId'       => $row['service_id'],
            'serviceName'     => $row['service_name'],
            'appointmentDate' => $row['appointment_date'],
            'appointmentTime' => $row['appointment_time'],
            'notes'           => $row['notes'] ?? '',
            'status'          => $row['status'],
            'createdAt'       => $row['created_at'],
        ];
    }

    // -------------------------------------------------------------------------
    // DB – availability
    // -------------------------------------------------------------------------

    private const MAX_BOOKINGS_PER_SLOT = 3;

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
        $stmt->execute([':date' => $date, ':max' => self::MAX_BOOKINGS_PER_SLOT]);
        return array_column($stmt->fetchAll(\PDO::FETCH_ASSOC), 'appointment_time');
    }

    /** @return string[] */
    private function fileGetBookedSlots(string $date): array
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
        return array_keys(
            array_filter($counts, fn (int $c) => $c >= self::MAX_BOOKINGS_PER_SLOT)
        );
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
            'serviceId', 'appointmentDate', 'appointmentTime',
        ];
        foreach ($required as $field) {
            if (empty(trim((string) ($data[$field] ?? '')))) {
                throw new RuntimeException("Field '$field' is required.", 422);
            }
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
        if ((int) ($data['serviceId'] ?? 0) <= 0) {
            throw new RuntimeException('A valid serviceId is required.', 422);
        }
    }

    /**
     * Resolve the human-readable service name.
     * In DB mode the name is fetched from the services table (canonical source).
     * In file mode the client-supplied serviceName is used as a fallback.
     */
    private function resolveServiceName(int $serviceId, array $data): string
    {
        if ($this->useDb) {
            $stmt = Database::getInstance()->prepare(
                'SELECT title FROM services WHERE id = :id LIMIT 1'
            );
            $stmt->execute([':id' => $serviceId]);
            $row = $stmt->fetch();
            if (!$row) {
                throw new RuntimeException('Service not found.', 422);
            }
            return $row['title'];
        }

        return trim((string) ($data['serviceName'] ?? ''));
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

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
