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

        $booking = [
            'id'              => $this->uuid(),
            'userId'          => $userId,
            'name'            => trim($data['name']),
            'email'           => strtolower(trim($data['email'])),
            'phone'           => trim($data['phone']),
            'vehicleInfo'     => trim($data['vehicleInfo']),
            'serviceId'       => trim($data['serviceId']),
            'serviceName'     => trim($data['serviceName']),
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
             (id, user_id, name, email, phone, vehicle_info, service_id, service_name,
              appointment_date, appointment_time, notes, status)
             VALUES
             (:id, :user_id, :name, :email, :phone, :vehicle_info, :service_id, :service_name,
              :appointment_date, :appointment_time, :notes, :status)'
        )->execute([
            ':id'               => $booking['id'],
            ':user_id'          => $booking['userId'],
            ':name'             => $booking['name'],
            ':email'            => $booking['email'],
            ':phone'            => $booking['phone'],
            ':vehicle_info'     => $booking['vehicleInfo'],
            ':service_id'       => $booking['serviceId'],
            ':service_name'     => $booking['serviceName'],
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
            'SELECT * FROM bookings ORDER BY created_at DESC'
        );
        return array_map([$this, 'mapDbRow'], $stmt->fetchAll());
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetByUser(int $userId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM bookings WHERE user_id = :uid ORDER BY created_at DESC'
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

        $row = $db->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
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

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        $required = [
            'name', 'email', 'phone', 'vehicleInfo',
            'serviceId', 'serviceName', 'appointmentDate', 'appointmentTime',
        ];
        foreach ($required as $field) {
            if (empty(trim((string) ($data[$field] ?? '')))) {
                throw new RuntimeException("Field '$field' is required.", 422);
            }
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
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
