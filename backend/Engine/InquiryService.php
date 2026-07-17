<?php

declare(strict_types=1);

class InquiryService
{
    private const SLOT_CAPACITY = 2;
    private const SLOT_WINDOW_MINUTES = 5 * 60;

    private bool $useDb;

    private static string $storageFile = __DIR__ . '/../storage/inquiries.json';
    private static string $occupancyStorageFile = __DIR__ . '/../storage/inquiry_slot_occupancy.json';

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
        $this->assertSlotCapacity($normalized['appointmentDate'], $normalized['appointmentTime']);

        $inquiry = [
            'id' => $this->uuid(),
            'fullName' => $normalized['fullName'],
            'address' => $normalized['address'],
            'contactNumber' => $normalized['contactNumber'],
            'emailAddress' => $normalized['emailAddress'],
            'facebookName' => $normalized['facebookName'],
            'plateNumber' => $normalized['plateNumber'],
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

        $this->syncOccupancyForInquiry($inquiry);

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

        $targetDate = $appointmentDate;
        $targetTime = $appointmentTime;
        if ($targetDate === null || $targetTime === null) {
            $existing = $this->useDb ? $this->dbGetById($id) : $this->fileGetById($id);
            if ($existing === null) {
                throw new RuntimeException('Inquiry not found.', 404);
            }
            if ($targetDate === null) {
                $targetDate = (string) ($existing['appointmentDate'] ?? '');
            }
            if ($targetTime === null) {
                $targetTime = (string) ($existing['appointmentTime'] ?? '');
            }
        }

        $isScheduleChange = $appointmentDate !== null || $appointmentTime !== null;
        if ($isScheduleChange && $targetDate !== null && $targetTime !== null && trim((string) $targetDate) !== '' && trim((string) $targetTime) !== '') {
            $this->assertSlotCapacity((string) $targetDate, (string) $targetTime, $id);
        }

        if ($this->useDb) {
            $this->dbUpdateDetails($id, $status, $appointmentDate, $appointmentTime);
            $inquiry = $this->dbGetById($id);
            if ($inquiry === null) {
                throw new RuntimeException('Inquiry not found.', 404);
            }
            $this->syncOccupancyForInquiry($inquiry);
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
        if (is_array($updated)) {
            $this->syncOccupancyForInquiry($updated);
        }
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
            $this->deleteOccupancyForInquiry($id);
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
        $this->deleteOccupancyForInquiry($id);
    }

    /**
     * @return string[]
     */
    public function getOccupiedSlots(string $date): array
    {
        $availability = $this->getAvailabilityForDate($date, []);
        return $availability['bookedSlots'];
    }

    /**
     * @return array<string, int>
     */
    public function getSlotCounts(string $date): array
    {
        $availability = $this->getAvailabilityForDate($date, []);
        return $availability['slotCounts'];
    }

    /**
     * @param string[] $allSlots
     * @return array{availableSlots:string[], bookedSlots:string[], slotCounts:array<string,int>, slotCapacity:int}
     */
    public function getAvailabilityForDate(string $date, array $allSlots = []): array
    {
        $slots = $allSlots;
        if ($slots === []) {
            $slots = $this->getAllSlotsForDate($date);
        }

        $activeAppointments = $this->getActiveAppointmentsForDate($date);
        $slotCounts = [];
        $bookedSlots = [];

        foreach ($slots as $slot) {
            $slotMinutes = $this->parseTimeToMinutes($slot);
            if ($slotMinutes === null) {
                continue;
            }

            $overlapCount = 0;
            foreach ($activeAppointments as $appointment) {
                if ($this->appointmentsOverlap($slotMinutes, $appointment['startMinutes'])) {
                    $overlapCount++;
                }
            }

            $slotCounts[$slot] = $overlapCount;
            if ($overlapCount >= self::SLOT_CAPACITY) {
                $bookedSlots[] = $slot;
            }
        }

        $availableSlots = array_values(array_diff($slots, $bookedSlots));

        return [
            'availableSlots' => $availableSlots,
            'bookedSlots' => $bookedSlots,
            'slotCounts' => $slotCounts,
            'slotCapacity' => self::SLOT_CAPACITY,
        ];
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
            'plateNumber' => $getValue($data, ['plateNumber', 'plate_number', 'Plate Number']),
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
                id, full_name, address, contact_number, email_address, facebook_name, plate_number,
                make, model, year_model, product_to_purchase, appointment_date,
                appointment_time, status, created_at, updated_at
            ) VALUES (
                :id, :full_name, :address, :contact_number, :email_address, :facebook_name, :plate_number,
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
            ':plate_number' => (string) ($inquiry['plateNumber'] ?? ''),
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
                'SELECT id, full_name, address, contact_number, email_address, facebook_name, plate_number,
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
        // allow updating plate number as part of details update
        if (array_key_exists(':plate_number', $params) || array_key_exists('plateNumber', $params)) {
            // noop here; update route will need to pass plateNumber explicitly when needed
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
            'SELECT id, full_name, address, contact_number, email_address, facebook_name, plate_number,
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
            'plateNumber' => (string) ($row['plate_number'] ?? ''),
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
    private function syncOccupancyForInquiry(array $inquiry): void
    {
        $inquiryId = (string) ($inquiry['id'] ?? '');
        if ($inquiryId === '') {
            return;
        }

        $appointmentDate = trim((string) ($inquiry['appointmentDate'] ?? ''));
        $appointmentTime = trim((string) ($inquiry['appointmentTime'] ?? ''));
        $status = strtolower(trim((string) ($inquiry['status'] ?? 'pending')));

        if ($appointmentDate === '' || $appointmentTime === '' || $status === 'cancelled') {
            $this->deleteOccupancyForInquiry($inquiryId);
            return;
        }

        if ($this->useDb) {
            $this->dbUpsertOccupancy($inquiry);
            return;
        }

        $this->fileUpsertOccupancy($inquiry);
    }

    private function deleteOccupancyForInquiry(string $inquiryId): void
    {
        if ($inquiryId === '') {
            return;
        }

        if ($this->useDb) {
            $this->dbDeleteOccupancy($inquiryId);
            return;
        }

        $rows = $this->fileGetOccupancyRows();
        $filtered = array_values(array_filter(
            $rows,
            static fn (array $item): bool => (string) ($item['inquiryId'] ?? '') !== $inquiryId
        ));

        $this->fileWriteOccupancyRows($filtered);
    }

    /**
     * @param array<string, mixed> $inquiry
     */
    private function dbUpsertOccupancy(array $inquiry): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO inquiry_slot_occupancy (
                id, inquiry_id, appointment_date, appointment_time, status, created_at, updated_at
            ) VALUES (
                :id, :inquiry_id, :appointment_date, :appointment_time, :status, :created_at, :updated_at
            ) ON DUPLICATE KEY UPDATE
                appointment_date = VALUES(appointment_date),
                appointment_time = VALUES(appointment_time),
                status = VALUES(status),
                updated_at = VALUES(updated_at)'
        );

        $stmt->execute([
            ':id' => (string) $this->uuid(),
            ':inquiry_id' => (string) ($inquiry['id'] ?? ''),
            ':appointment_date' => trim((string) ($inquiry['appointmentDate'] ?? '')),
            ':appointment_time' => trim((string) ($inquiry['appointmentTime'] ?? '')),
            ':status' => strtolower(trim((string) ($inquiry['status'] ?? 'pending'))),
            ':created_at' => date('Y-m-d H:i:s'),
            ':updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function dbDeleteOccupancy(string $inquiryId): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM inquiry_slot_occupancy WHERE inquiry_id = :inquiry_id');
        $stmt->execute([':inquiry_id' => $inquiryId]);
    }

    /**
     * @return string[]
     */
    private function dbGetOccupiedSlots(string $date): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT appointment_time FROM inquiry_slot_occupancy WHERE appointment_date = :appointment_date'
        );
        $stmt->execute([':appointment_date' => $date]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $slots = array_values(array_filter(array_map(
            static fn (array $row): string => trim((string) ($row['appointment_time'] ?? '')),
            $rows
        ), static fn (string $slot): bool => $slot !== ''));
        sort($slots);
        return $slots;
    }

    /**
     * @return array<string, int>
     */
    private function dbGetSlotCounts(string $date): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT appointment_time, COUNT(*) AS slot_count FROM inquiry_slot_occupancy WHERE appointment_date = :appointment_date GROUP BY appointment_time'
        );
        $stmt->execute([':appointment_date' => $date]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $counts = [];
        foreach ($rows as $row) {
            $time = trim((string) ($row['appointment_time'] ?? ''));
            if ($time !== '') {
                $counts[$time] = (int) ($row['slot_count'] ?? 0);
            }
        }
        return $counts;
    }

    /**
     * @param array<string, mixed> $inquiry
     */
    private function fileUpsertOccupancy(array $inquiry): void
    {
        $rows = $this->fileGetOccupancyRows();
        $inquiryId = (string) ($inquiry['id'] ?? '');
        $appointmentDate = trim((string) ($inquiry['appointmentDate'] ?? ''));
        $appointmentTime = trim((string) ($inquiry['appointmentTime'] ?? ''));
        $status = strtolower(trim((string) ($inquiry['status'] ?? 'pending')));

        if ($appointmentDate === '' || $appointmentTime === '' || $status === 'cancelled') {
            $this->deleteOccupancyForInquiry($inquiryId);
            return;
        }

        $found = false;
        foreach ($rows as &$row) {
            if ((string) ($row['inquiryId'] ?? '') === $inquiryId) {
                $row['appointmentDate'] = $appointmentDate;
                $row['appointmentTime'] = $appointmentTime;
                $row['status'] = $status;
                $row['updatedAt'] = date('c');
                $found = true;
                break;
            }
        }
        unset($row);

        if (!$found) {
            $rows[] = [
                'id' => $this->uuid(),
                'inquiryId' => $inquiryId,
                'appointmentDate' => $appointmentDate,
                'appointmentTime' => $appointmentTime,
                'status' => $status,
                'createdAt' => date('c'),
                'updatedAt' => date('c'),
            ];
        }

        $this->fileWriteOccupancyRows($rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fileGetOccupancyRows(): array
    {
        if (!file_exists(self::$occupancyStorageFile)) {
            return [];
        }

        $raw = file_get_contents(self::$occupancyStorageFile);
        if ($raw === false) {
            return [];
        }

        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function fileWriteOccupancyRows(array $rows): void
    {
        $dir = dirname(self::$occupancyStorageFile);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        file_put_contents(self::$occupancyStorageFile, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @return string[]
     */
    private function fileGetOccupiedSlots(string $date): array
    {
        $slots = array_values(array_filter(
            array_map(
                static fn (array $row): string => (string) ($row['appointmentTime'] ?? ''),
                array_filter(
                    $this->fileGetOccupancyRows(),
                    static fn (array $row): bool => (string) ($row['appointmentDate'] ?? '') === $date
                )
            ),
            static fn (string $slot): bool => $slot !== ''
        ));
        sort($slots);
        return $slots;
    }

    /**
     * @return array<string, int>
     */
    private function fileGetSlotCounts(string $date): array
    {
        $counts = [];
        foreach ($this->fileGetOccupancyRows() as $row) {
            if ((string) ($row['appointmentDate'] ?? '') !== $date) {
                continue;
            }
            $time = trim((string) ($row['appointmentTime'] ?? ''));
            if ($time === '') {
                continue;
            }
            $counts[$time] = ($counts[$time] ?? 0) + 1;
        }
        return $counts;
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

    private function assertSlotCapacity(string $date, string $time, ?string $excludeInquiryId = null): void
    {
        if ($date === '' || $time === '') {
            return;
        }

        $count = $this->countOverlappingAppointments($date, $time, $excludeInquiryId);
        if ($count >= self::SLOT_CAPACITY) {
            throw new RuntimeException('This time slot is fully booked. Please choose a different time.', 409);
        }
    }

    /**
     * @return array<int, array{startMinutes:int}>
     */
    private function getActiveAppointmentsForDate(string $date): array
    {
        $items = $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
        $appointments = [];

        foreach ($items as $item) {
            $itemDate = trim((string) ($item['appointmentDate'] ?? ''));
            if ($itemDate !== $date) {
                continue;
            }

            $status = strtolower(trim((string) ($item['status'] ?? 'pending')));
            if ($status === 'cancelled' || $status === 'completed') {
                continue;
            }

            $itemTime = trim((string) ($item['appointmentTime'] ?? ''));
            $startMinutes = $this->parseTimeToMinutes($itemTime);
            if ($startMinutes === null) {
                continue;
            }

            $appointments[] = [
                'inquiryId' => (string) ($item['id'] ?? ''),
                'startMinutes' => $startMinutes,
            ];
        }

        return $appointments;
    }

    private function countOverlappingAppointments(string $date, string $time, ?string $excludeInquiryId = null): int
    {
        $candidateStart = $this->parseTimeToMinutes($time);
        if ($candidateStart === null) {
            return 0;
        }

        $appointments = $this->getActiveAppointmentsForDate($date);
        $count = 0;
        foreach ($appointments as $appointment) {
            if ($excludeInquiryId !== null && isset($appointment['inquiryId']) && (string) $appointment['inquiryId'] === $excludeInquiryId) {
                continue;
            }
            if ($this->appointmentsOverlap($candidateStart, $appointment['startMinutes'])) {
                $count++;
            }
        }

        return $count;
    }

    private function appointmentsOverlap(int $candidateStart, int $existingStart): bool
    {
        $candidateEnd = $candidateStart + self::SLOT_WINDOW_MINUTES;
        $existingEnd = $existingStart + self::SLOT_WINDOW_MINUTES;
        return $candidateStart < $existingEnd && $existingStart < $candidateEnd;
    }

    private function getAllSlotsForDate(string $date): array
    {
        $shopHoursService = new ShopHoursService();
        $dayHours = $shopHoursService->getForDate($date);
        return $shopHoursService->generateSlots($dayHours);
    }

    private function parseTimeToMinutes(string $value): ?int
    {
        $normalized = trim($value);
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2}):(\d{2})(?:\s*([ap]\.?m\.?))?$/i', $normalized, $matches) !== 1) {
            return null;
        }

        $hours = (int) $matches[1];
        $minutes = (int) $matches[2];
        $meridiem = isset($matches[3]) ? strtolower($matches[3]) : null;

        if ($meridiem === 'p' || $meridiem === 'pm') {
            if ($hours < 12) {
                $hours += 12;
            }
        } elseif ($meridiem === 'a' || $meridiem === 'am') {
            if ($hours === 12) {
                $hours = 0;
            }
        }

        if ($hours < 0 || $hours > 23 || $minutes < 0 || $minutes > 59) {
            return null;
        }

        return $hours * 60 + $minutes;
    }

    private function fileGetById(string $id): ?array
    {
        $items = $this->fileGetAll();
        foreach ($items as $item) {
            if ((string) ($item['id'] ?? '') === $id) {
                return $item;
            }
        }
        return null;
    }

    private function uuid(): string
    {
        return bin2hex(random_bytes(16));
    }
}
