<?php

declare(strict_types=1);

class InquiryService
{
    private bool $useDb;

    private static string $storageFile = __DIR__ . '/../storage/inquiries.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $normalized = $this->normalizePayload($data);
        $this->validatePayload($normalized);

        $inquiry = [
            'id' => $this->uuid(),
            'fullName' => $normalized['fullName'],
            'address' => $normalized['address'],
            'contactNumber' => $normalized['contactNumber'],
            'emailAddress' => $normalized['emailAddress'],
            'facebookName' => $normalized['facebookName'],
            'make' => $normalized['make'],
            'model' => $normalized['model'],
            'yearModel' => $normalized['yearModel'],
            'productToPurchase' => $normalized['productToPurchase'],
            'appointmentDate' => $normalized['appointmentDate'],
            'appointmentTime' => $normalized['appointmentTime'],
            'status' => 'pending',
            'createdAt' => date('Y-m-d H:i:s'),
        ];

        if ($this->useDb) {
            $this->dbInsert($inquiry);
        } else {
            $this->fileInsert($inquiry);
        }

        return $inquiry;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getAll(): array
    {
        return $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
    }

    /**
     * Update the status of an inquiry.
     *
     * @param string $id
     * @param string $status
     * @return array<string, mixed>
     */
    public function updateStatus(string $id, string $status): array
    {
        return $this->updateDetails($id, $status, null, null);
    }

    /**
     * Update inquiry details such as status or appointment schedule.
     *
     * @param string $id
     * @param string|null $status
     * @param string|null $appointmentDate
     * @param string|null $appointmentTime
     * @return array<string, mixed>
     */
    public function updateDetails(string $id, ?string $status = null, ?string $appointmentDate = null, ?string $appointmentTime = null): array
    {
        $status = $status === null ? null : trim($status);
        if ($status !== null) {
            $allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
            if (!in_array($status, $allowed, true)) {
                throw new RuntimeException('Invalid inquiry status.', 422);
            }
        }

        if ($appointmentDate !== null && trim($appointmentDate) === '') {
            throw new RuntimeException('Appointment date is required.', 422);
        }

        if ($appointmentTime !== null && trim($appointmentTime) === '') {
            throw new RuntimeException('Appointment time is required.', 422);
        }

        if ($status === null && $appointmentDate === null && $appointmentTime === null) {
            throw new RuntimeException('No changes were provided.', 422);
        }

        if ($this->useDb) {
            $this->dbUpdateDetails($id, $status, $appointmentDate, $appointmentTime);
            $inquiry = $this->dbGetById($id);
            if ($inquiry === null) {
                throw new RuntimeException('Inquiry not found.', 404);
            }
            return $inquiry;
        }

        $inquiries = $this->fileGetAll();
        $found = false;
        foreach ($inquiries as &$item) {
            if ((string) ($item['id'] ?? '') === $id) {
                if ($status !== null) {
                    $item['status'] = $status;
                }
                if ($appointmentDate !== null) {
                    $item['appointmentDate'] = $appointmentDate;
                }
                if ($appointmentTime !== null) {
                    $item['appointmentTime'] = $appointmentTime;
                }
                $item['updatedAt'] = date('c');
                $found = true;
                break;
            }
        }
        unset($item);

        if (!$found) {
            throw new RuntimeException('Inquiry not found.', 404);
        }

        file_put_contents(self::$storageFile, json_encode($inquiries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $updated = array_values(array_filter($inquiries, fn ($item) => (string) ($item['id'] ?? '') === $id))[0] ?? null;
        if (!is_array($updated)) {
            throw new RuntimeException('Inquiry not found.', 404);
        }

        return $updated;
    }

    /**
     * @param string $id
     */
    public function delete(string $id): void
    {
        if ($this->useDb) {
            $this->dbDelete($id);
            return;
        }

        $inquiries = $this->fileGetAll();
        $filtered = array_values(array_filter(
            $inquiries,
            static fn (array $item): bool => (string) ($item['id'] ?? '') !== $id
        ));

        if (count($filtered) === count($inquiries)) {
            throw new RuntimeException('Inquiry not found.', 404);
        }

        file_put_contents(self::$storageFile, json_encode($filtered, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @param string $id
     * @return array<string, mixed>|null
     */
    public function getById(string $id): ?array
    {
        $items = $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
        foreach ($items as $item) {
            if ((string) ($item['id'] ?? '') === $id) {
                return $item;
            }
        }
        return null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    private function normalizePayload(array $data): array
    {
        $getValue = static function (array $data, array $keys): string {
            foreach ($keys as $key) {
                if (array_key_exists($key, $data) && $data[$key] !== null) {
                    return trim((string) $data[$key]);
                }
            }
            return '';
        };

        return [
            'fullName' => $getValue($data, ['fullName', 'full_name', 'Full Name']),
            'address' => $getValue($data, ['address', 'Address']),
            'contactNumber' => $getValue($data, ['contactNumber', 'contact_number', 'Contact Number']),
            'emailAddress' => $getValue($data, ['emailAddress', 'email_address', 'Email address', 'Email Address']),
            'facebookName' => $getValue($data, ['facebookName', 'facebook_name', 'Facebook Name']),
            'make' => $getValue($data, ['make', 'Car Make']),
            'model' => $getValue($data, ['model', 'Car Model']),
            'yearModel' => $getValue($data, ['yearModel', 'year_model', 'Year Model']),
            'productToPurchase' => $getValue($data, ['productToPurchase', 'product_to_purchase', 'Product to Purchase']),
            'appointmentDate' => $getValue($data, ['appointmentDate', 'appointment_date', 'Appointment Date', 'bookingDate', 'booking_date']),
            'appointmentTime' => $getValue($data, ['appointmentTime', 'appointment_time', 'Appointment Time', 'bookingTime', 'booking_time']),
        ];
    }

    /**
     * @param array<string, string> $inquiry
     */
    private function validatePayload(array $inquiry): void
    {
        $required = [
            'fullName' => 'Full name is required.',
            'address' => 'Address is required.',
            'contactNumber' => 'Contact number is required.',
            'emailAddress' => 'Email address is required.',
            'facebookName' => 'Facebook name is required.',
            'make' => 'Car make is required.',
            'model' => 'Car model is required.',
            'yearModel' => 'Year model is required.',
            'productToPurchase' => 'Product or service is required.',
            'appointmentDate' => 'Appointment date is required.',
            'appointmentTime' => 'Appointment time is required.',
        ];

        foreach ($required as $field => $message) {
            if (trim((string) ($inquiry[$field] ?? '')) === '') {
                throw new RuntimeException($message, 422);
            }
        }

        if (!filter_var($inquiry['emailAddress'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
    }

    /**
     * @param array<string, mixed> $inquiry
     */
    private function dbInsert(array $inquiry): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO customer_inquiries (
                id, full_name, address, contact_number, email_address, facebook_name,
                make, model, year_model, product_to_purchase, appointment_date,
                appointment_time, status, created_at, updated_at
            ) VALUES (
                :id, :full_name, :address, :contact_number, :email_address, :facebook_name,
                :make, :model, :year_model, :product_to_purchase, :appointment_date,
                :appointment_time, :status, :created_at, :updated_at
            )'
        );

        $stmt->execute([
            ':id' => (string) $inquiry['id'],
            ':full_name' => (string) $inquiry['fullName'],
            ':address' => (string) $inquiry['address'],
            ':contact_number' => (string) $inquiry['contactNumber'],
            ':email_address' => (string) $inquiry['emailAddress'],
            ':facebook_name' => (string) $inquiry['facebookName'],
            ':make' => (string) $inquiry['make'],
            ':model' => (string) $inquiry['model'],
            ':year_model' => (string) $inquiry['yearModel'],
            ':product_to_purchase' => (string) $inquiry['productToPurchase'],
            ':appointment_date' => (string) $inquiry['appointmentDate'],
            ':appointment_time' => (string) $inquiry['appointmentTime'],
            ':status' => (string) $inquiry['status'],
            ':created_at' => (string) $inquiry['createdAt'],
            ':updated_at' => (string) $inquiry['createdAt'],
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function dbGetAll(): array
    {
        $db = Database::getInstance();
        $stmt = $db->query(
            'SELECT id, full_name, address, contact_number, email_address, facebook_name,
                    make, model, year_model, product_to_purchase, appointment_date,
                    appointment_time, status, created_at
             FROM customer_inquiries
             ORDER BY appointment_date ASC, appointment_time ASC, created_at DESC'
        );

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map(fn (array $row): array => $this->mapDbRow($row), $rows);
    }

    /**
     * @param string $id
     * @param string|null $status
     * @param string|null $appointmentDate
     * @param string|null $appointmentTime
     */
    private function dbUpdateDetails(string $id, ?string $status, ?string $appointmentDate, ?string $appointmentTime): void
    {
        $db = Database::getInstance();
        $fields = ['updated_at = CURRENT_TIMESTAMP'];
        $params = [':id' => $id];

        if ($status !== null) {
            $fields[] = 'status = :status';
            $params[':status'] = $status;
        }

        if ($appointmentDate !== null) {
            $fields[] = 'appointment_date = :appointment_date';
            $params[':appointment_date'] = $appointmentDate;
        }

        if ($appointmentTime !== null) {
            $fields[] = 'appointment_time = :appointment_time';
            $params[':appointment_time'] = $appointmentTime;
        }

        $stmt = $db->prepare(
            'UPDATE customer_inquiries
             SET ' . implode(', ', $fields) . '
             WHERE id = :id'
        );
        $stmt->execute($params);
    }

    /**
     * @param string $id
     */
    private function dbDelete(string $id): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM customer_inquiries WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Inquiry not found.', 404);
        }
    }

    /**
     * @param string $id
     * @return array<string, mixed>|null
     */
    private function dbGetById(string $id): ?array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT id, full_name, address, contact_number, email_address, facebook_name,
                    make, model, year_model, product_to_purchase, appointment_date,
                    appointment_time, status, created_at
             FROM customer_inquiries
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $this->mapDbRow($row);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapDbRow(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'fullName' => (string) ($row['full_name'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'contactNumber' => (string) ($row['contact_number'] ?? ''),
            'emailAddress' => (string) ($row['email_address'] ?? ''),
            'facebookName' => (string) ($row['facebook_name'] ?? ''),
            'make' => (string) ($row['make'] ?? ''),
            'model' => (string) ($row['model'] ?? ''),
            'yearModel' => (string) ($row['year_model'] ?? ''),
            'productToPurchase' => (string) ($row['product_to_purchase'] ?? ''),
            'appointmentDate' => (string) ($row['appointment_date'] ?? ''),
            'appointmentTime' => (string) ($row['appointment_time'] ?? ''),
            'status' => (string) ($row['status'] ?? 'pending'),
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $inquiry
     */
    private function fileInsert(array $inquiry): void
    {
        $path = dirname(self::$storageFile);
        if (!is_dir($path)) {
            @mkdir($path, 0775, true);
        }

        $items = $this->fileGetAll();
        $items[] = $inquiry;
        file_put_contents(self::$storageFile, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fileGetAll(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }

        $raw = file_get_contents(self::$storageFile);
        if ($raw === false) {
            return [];
        }

        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function uuid(): string
    {
        return bin2hex(random_bytes(16));
    }
}
