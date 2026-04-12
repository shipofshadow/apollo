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

    /** @var array<int, array<string, mixed>>|null */
    private ?array $activePortfolioCache = null;

    /** @var bool|null Cached bookings.build_slug column existence check. */
    private ?bool $hasBuildSlugColumnCache = null;

    /** @var bool|null Cached team_members.user_id column existence check. */
    private ?bool $hasTeamMemberUserIdColumnCache = null;

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
        $waitlistClaimToken = trim((string) ($data['waitlistClaimToken'] ?? ''));
        $claimEntry = null;
        if ($waitlistClaimToken !== '') {
            $claimEntry = (new WaitlistService())->validateClaimForBooking($waitlistClaimToken, [
                'appointmentDate' => $date,
                'appointmentTime' => $time,
                'email' => (string) ($data['email'] ?? ''),
            ]);
        }

        if ($claimEntry === null && in_array($time, $this->getBookedSlots($date), true)) {
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
            'referenceNumber'    => $this->generateReferenceNumber(),
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
            'beforePhotos'       => [],
            'afterPhotos'        => [],
            'status'             => 'pending',
            'awaitingParts'      => false,
            'partsNotes'         => null,
            'source'             => trim($data['source'] ?? 'website'),
            'createdAt'          => date('c'),
        ];

        $this->useDb ? $this->dbInsert($booking) : $this->fileInsert($booking);

        $this->addActivity(
            (string) $booking['id'],
            'booking_submitted',
            'Booking submitted',
            'Status: pending',
            $userId,
            $userId !== null ? 'client' : 'system',
            (string) $booking['createdAt']
        );

        (new NotificationService())->bookingCreated($booking);

        // SMS notifications for new booking
        $sms = new SmsService();
        $sms->bookingCreated($booking);
        $sms->bookingCreatedAdmin($booking);

        if ($waitlistClaimToken !== '') {
            try {
                (new WaitlistService())->markBookedByClaimToken($waitlistClaimToken, (string) $booking['id']);
            } catch (\Throwable) {
                // don't block booking creation
            }
        }

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
     * @return array<string, mixed>
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

        $before = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($before === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $beforePhotos = is_array($before['beforePhotos'] ?? null) ? $before['beforePhotos'] : [];
        $afterPhotos  = is_array($before['afterPhotos'] ?? null) ? $before['afterPhotos'] : [];

        // Enforce QA workflow: check-in requires before photos; completion requires after photos.
        if ($status === 'confirmed' && count($beforePhotos) === 0) {
            throw new RuntimeException('Add at least one before photo before check-in.', 422);
        }
        if ($status === 'completed' && count($afterPhotos) === 0) {
            throw new RuntimeException('Add at least one after photo before completion.', 422);
        }

        $booking = $this->useDb
            ? $this->dbUpdateStatus($id, $status)
            : $this->fileUpdateStatus($id, $status);

        $fromStatus = (string) ($before['status'] ?? 'unknown');
        $toStatus   = (string) ($booking['status'] ?? $status);
        $this->addActivity(
            (string) $booking['id'],
            'status_changed',
            'Status changed',
            'From: ' . str_replace('_', ' ', $fromStatus) . ' -> ' . str_replace('_', ' ', $toStatus)
        );

        (new NotificationService())->bookingStatusChanged($booking);

        // SMS notification for status changes
        if ($status === 'confirmed') {
            (new SmsService())->bookingConfirmed($booking);
        } else {
            (new SmsService())->bookingStatusChanged($booking);
        }

        // When a booking is cancelled, check if anyone is waiting for the freed slot
        if ($status === 'cancelled') {
            $slotDate = (string) ($booking['appointmentDate'] ?? '');
            $slotTime = (string) ($booking['appointmentTime'] ?? '');
            if ($slotDate !== '' && $slotTime !== '') {
                try {
                    (new WaitlistService())->handleBookingCancelled($slotDate, $slotTime);
                } catch (\Throwable) {
                    // fail silently – don't block the cancellation
                }
            }
        }

        // In-app notification for the client who made the booking
        if ($this->useDb) {
            $uid = (int) ($booking['userId'] ?? 0);
            if ($uid > 0) {
                $label   = ucwords(str_replace('_', ' ', $status));
                $svcName = (string) ($booking['serviceName'] ?? 'your service');
                $prefSvc = new NotificationPreferencesService();
                if ($prefSvc->inappEnabled($uid, 'status_changed')) {
                    (new UserNotificationService())->createForUser(
                        $uid,
                        'status_changed',
                        "Booking Status: {$label}",
                        "Your booking for {$svcName} is now {$label}.",
                        ['bookingId' => $booking['id'], 'status' => $status]
                    );
                }
            }
        }

        return $booking;
    }

    /**
     * Save QA photos captured during check-in/completion workflow.
     *
     * @param string[] $photoUrls
     * @return array<string, mixed>
     */
    public function updateQaPhotos(
        string $id,
        string $stage,
        array $photoUrls,
        ?int $actorUserId = null
    ): array {
        if (!in_array($stage, ['before', 'after'], true)) {
            throw new RuntimeException('Invalid QA stage. Use "before" or "after".', 422);
        }

        $cleanUrls = array_values(array_filter(
            array_map(static fn($v) => is_string($v) ? trim($v) : '', $photoUrls),
            static fn(string $u) => $u !== ''
        ));

        if (count($cleanUrls) === 0) {
            throw new RuntimeException('At least one photo is required.', 422);
        }

        $updated = $this->useDb
            ? $this->dbUpdateQaPhotos($id, $stage, $cleanUrls)
            : $this->fileUpdateQaPhotos($id, $stage, $cleanUrls);

        $this->addActivity(
            (string) $updated['id'],
            $stage === 'before' ? 'before_photos_updated' : 'after_photos_updated',
            $stage === 'before' ? 'Before photos updated' : 'After photos updated',
            count($cleanUrls) . ' photo(s)',
            $actorUserId,
            'admin'
        );

        return $updated;
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

        $partsDetail = trim($partsNotes);
        $this->addActivity(
            (string) $booking['id'],
            'parts_updated',
            $awaitingParts ? 'Flagged: Awaiting Parts' : 'Parts status updated',
            $partsDetail !== '' ? $partsDetail : null
        );

        if ($awaitingParts) {
            (new NotificationService())->bookingAwaitingParts($booking);

            // In-app notification for the client
            if ($this->useDb) {
                $uid = (int) ($booking['userId'] ?? 0);
                if ($uid > 0) {
                    $svcName = (string) ($booking['serviceName'] ?? 'your service');
                    $prefSvc = new NotificationPreferencesService();
                    if ($prefSvc->inappEnabled($uid, 'parts_update')) {
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
        }

        return $booking;
    }

    /**
     * Update the internal (admin-only) notes for a booking.
     *
     * @return array<string, mixed>  Updated booking
     */
    public function updateInternalNotes(string $id, string $notes): array
    {
        if (!$this->useDb) {
            throw new RuntimeException('Internal notes require a database.', 501);
        }
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'UPDATE bookings SET internal_notes = :notes WHERE id = :id'
        );
        $stmt->execute([':notes' => $notes, ':id' => $id]);

        $row = $db->prepare(
              'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                  ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
               LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        $data = $row->fetch(\PDO::FETCH_ASSOC);
        if (!$data) throw new RuntimeException('Booking not found.', 404);
        $booking = $this->mapDbRow($data);

        $this->addActivity(
            (string) $booking['id'],
            'internal_notes_updated',
            'Internal notes updated',
            null
        );

        return $booking;
    }

    /**
     * Assign or unassign a technician to a booking (admin-only workflow).
     *
     * @return array<string, mixed>
     */
    public function assignTechnician(string $id, ?int $assignedTechId): array
    {
        if (!$this->useDb) {
            throw new RuntimeException('Technician assignment requires a database.', 501);
        }

        $before = $this->dbFindById($id);
        if ($before === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $techName  = null;
        $techPhone = '';
        if ($assignedTechId !== null) {
            $techStmt = Database::getInstance()->prepare(
                'SELECT id, name, phone FROM team_members WHERE id = :id LIMIT 1'
            );
            $techStmt->execute([':id' => $assignedTechId]);
            $tech = $techStmt->fetch(\PDO::FETCH_ASSOC);
            if (!$tech) {
                throw new RuntimeException('Technician not found.', 404);
            }
            $techName  = (string) ($tech['name']  ?? '');
            $techPhone = (string) ($tech['phone'] ?? '');
        }

        Database::getInstance()->prepare(
            'UPDATE bookings SET assigned_tech_id = :tech_id WHERE id = :id'
        )->execute([
            ':tech_id' => $assignedTechId,
            ':id'      => $id,
        ]);

        $updated = $this->dbFindById($id);
        if ($updated === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $beforeId = isset($before['assignedTechId']) && $before['assignedTechId'] !== null
            ? (int) $before['assignedTechId']
            : null;
        if ($beforeId !== $assignedTechId) {
            if ($assignedTechId === null) {
                $this->addActivity(
                    $id,
                    'technician_unassigned',
                    'Technician unassigned',
                    null
                );
            } else {
                $this->addActivity(
                    $id,
                    'technician_assigned',
                    'Technician assigned',
                    $techName !== '' ? $techName : ('ID ' . $assignedTechId)
                );

                // SMS notification to the assigned technician
                if ($techPhone !== '') {
                    (new SmsService())->staffAssigned($updated, $techPhone, $techName ?? '');
                }
            }
        }

        return $updated;
    }

    /**
     * Return visit statistics for a specific user (loyalty tracking).
     *
     * @return array{totalVisits: int, completedVisits: int, memberSince: string|null}
     */
    public function getCustomerStats(int $userId): array
    {
        if (!$this->useDb) {
            return ['totalVisits' => 0, 'completedVisits' => 0, 'memberSince' => null];
        }
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT
               COUNT(*) AS total,
               SUM(status = \'completed\') AS completed,
               MIN(created_at) AS first_booking
             FROM bookings
             WHERE user_id = :uid'
        );
        $stmt->execute([':uid' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        return [
            'totalVisits'     => (int)    ($row['total']         ?? 0),
            'completedVisits' => (int)    ($row['completed']     ?? 0),
            'memberSince'     => $row['first_booking'] ? (string) $row['first_booking'] : null,
        ];
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
     * Save calibration data for a completed lighting installation.
     *
     * @param array<string, mixed> $data  Keys: beamAngle, luxOutput, notes, etc.
     * @return array<string, mixed>  Updated booking
     */
    public function updateCalibrationData(string $id, array $data): array
    {
        if (!$this->useDb) {
            throw new RuntimeException('Calibration data requires a database connection.', 503);
        }

        $booking = $this->dbFindById($id);
        if ($booking === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        $stmt = Database::getInstance()->prepare(
            'UPDATE bookings SET calibration_data = :data WHERE id = :id'
        );
        $stmt->execute([':data' => $json, ':id' => $id]);

        return $this->dbFindById($id) ?? $booking;
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
     * Permanently delete a booking (admin-only).
     */
    public function delete(string $id): void
    {
        $existing = $this->useDb
            ? $this->dbFindById($id)
            : $this->fileFindById($id);

        if ($existing === null) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
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

        $oldDate = (string) ($booking['appointmentDate'] ?? '');
        $oldTime = (string) ($booking['appointmentTime'] ?? '');

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

        $updated = $this->useDb
            ? $this->dbReschedule($id, $date, $time)
            : $this->fileReschedule($id, $date, $time);

        $this->addActivity(
            (string) $updated['id'],
            'appointment_rescheduled',
            'Rescheduled',
            sprintf('%s %s -> %s %s', $oldDate, $oldTime, $date, $time)
        );

        if (($oldDate !== '' && $oldTime !== '') && ($oldDate !== $date || $oldTime !== $time)) {
            try {
                (new WaitlistService())->handleBookingCancelled($oldDate, $oldTime);
            } catch (\Throwable) {
                // fail silently – don't block reschedule
            }
        }

        return $updated;
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

        $oldDate = (string) ($booking['appointmentDate'] ?? '');
        $oldTime = (string) ($booking['appointmentTime'] ?? '');

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

        $updated = $this->useDb
            ? $this->dbReschedule($id, $date, $time)
            : $this->fileReschedule($id, $date, $time);

        $this->addActivity(
            (string) $updated['id'],
            'appointment_rescheduled',
            'Rescheduled',
            sprintf('%s %s -> %s %s', $oldDate, $oldTime, $date, $time),
            $userId,
            'client'
        );

        if (($oldDate !== '' && $oldTime !== '') && ($oldDate !== $date || $oldTime !== $time)) {
            try {
                (new WaitlistService())->handleBookingCancelled($oldDate, $oldTime);
            } catch (\Throwable) {
                // fail silently – don't block reschedule
            }
        }

        return $updated;
    }

    private function addActivity(
        string $bookingId,
        string $eventType,
        string $action,
        ?string $detail = null,
        ?int $actorUserId = null,
        string $actorRole = 'system',
        ?string $createdAt = null
    ): void {
        if (!$this->useDb) {
            return;
        }

        try {
            (new BookingActivityService())->add(
                $bookingId,
                $eventType,
                $action,
                $detail,
                $actorUserId,
                $actorRole,
                $createdAt
            );
        } catch (\Throwable $e) {
            error_log('[BookingService] Failed to write booking activity log: ' . $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // DB storage
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $booking */
    private function dbInsert(array $booking): void
    {
        $db = Database::getInstance();
        $params = [
            ':id'                  => $booking['id'],
            ':reference_number'    => $booking['referenceNumber'],
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
            ':before_media_urls'   => json_encode($booking['beforePhotos'] ?? []),
            ':after_media_urls'    => json_encode($booking['afterPhotos'] ?? []),
            ':status'              => $booking['status'],
            ':source'              => $booking['source'] ?? 'website',
        ];

        if ($this->hasBuildSlugColumn()) {
            $params[':build_slug'] = $this->resolveBuildSlugForBooking($booking);
            $db->prepare(
                'INSERT INTO bookings
                 (id, reference_number, user_id, name, email, phone, vehicle_info, vehicle_make, vehicle_model,
                  vehicle_year, service_id, service_ids, selected_variations, appointment_date, appointment_time,
                  notes, signature_data, media_urls, before_media_urls, after_media_urls, status, source, build_slug)
                 VALUES
                 (:id, :reference_number, :user_id, :name, :email, :phone, :vehicle_info, :vehicle_make, :vehicle_model,
                  :vehicle_year, :service_id, :service_ids, :selected_variations, :appointment_date, :appointment_time,
                  :notes, :signature_data, :media_urls, :before_media_urls, :after_media_urls, :status, :source, :build_slug)'
            )->execute($params);
            return;
        }

        $db->prepare(
            'INSERT INTO bookings
             (id, reference_number, user_id, name, email, phone, vehicle_info, vehicle_make, vehicle_model,
              vehicle_year, service_id, service_ids, selected_variations, appointment_date, appointment_time,
              notes, signature_data, media_urls, before_media_urls, after_media_urls, status, source)
             VALUES
             (:id, :reference_number, :user_id, :name, :email, :phone, :vehicle_info, :vehicle_make, :vehicle_model,
              :vehicle_year, :service_id, :service_ids, :selected_variations, :appointment_date, :appointment_time,
              :notes, :signature_data, :media_urls, :before_media_urls, :after_media_urls, :status, :source)'
        )->execute($params);
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                    ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             ORDER BY b.created_at DESC'
        );
        return array_map([$this, 'mapDbRow'], $stmt->fetchAll());
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetByUser(int $userId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                    ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
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

        $row = $db->prepare(
              'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                  ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
               LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        $data = $row->fetch();
        if (!$data) {
            throw new RuntimeException('Booking not found.', 404);
        }

        if ($this->hasBuildSlugColumn()) {
            $resolvedSlug = $this->resolveBuildSlugForBooking($data);
            $currentSlug  = trim((string) ($data['build_slug'] ?? ''));

            if ($resolvedSlug !== null && $resolvedSlug !== '' && $resolvedSlug !== $currentSlug) {
                $db->prepare('UPDATE bookings SET build_slug = :slug WHERE id = :id')
                    ->execute([':slug' => $resolvedSlug, ':id' => $id]);
                $data['build_slug'] = $resolvedSlug;
            }
        }

        return $this->mapDbRow($data);
    }

    /** @return array<string, mixed>|null */
    private function dbFindById(string $id): ?array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                    ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
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

        $row = $db->prepare(
              'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                  ' . $this->assignedTechUserIdSelectSql() . '
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
               LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        $data = $row->fetch();
        if (!$data) {
            throw new RuntimeException('Booking not found.', 404);
        }
        return $this->mapDbRow($data);
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

        $row = $db->prepare(
              'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
               LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        $data = $row->fetch();
        if (!$data) {
            throw new RuntimeException('Booking not found.', 404);
        }
        return $this->mapDbRow($data);
    }

    /**
     * @param string[] $photoUrls
     * @return array<string, mixed>
     */
    private function dbUpdateQaPhotos(string $id, string $stage, array $photoUrls): array
    {
        $column = $stage === 'before' ? 'before_media_urls' : 'after_media_urls';
        $db = Database::getInstance();

        $stmt = $db->prepare(
            "UPDATE bookings SET {$column} = :urls WHERE id = :id"
        );
        $stmt->execute([
            ':urls' => json_encode($photoUrls),
            ':id'   => $id,
        ]);

        $row = $db->prepare(
              'SELECT b.*, s.title AS service_name,
                    tm.name AS assigned_tech_name,
                    tm.role AS assigned_tech_role,
                    tm.image_url AS assigned_tech_image_url
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id
             WHERE b.id = :id LIMIT 1'
        );
        $row->execute([':id' => $id]);
        $data = $row->fetch();
        if (!$data) {
            throw new RuntimeException('Booking not found.', 404);
        }
        return $this->mapDbRow($data);
    }

    private function dbDelete(string $id): void
    {
        $db = Database::getInstance();
        $startedTransaction = false;

        if (!$db->inTransaction()) {
            $db->beginTransaction();
            $startedTransaction = true;
        }

        try {
            // booking_reviews has no FK in older schemas, so delete manually when present.
            try {
                $db->prepare('DELETE FROM booking_reviews WHERE booking_id = :id')
                    ->execute([':id' => $id]);
            } catch (\Throwable) {
                // Ignore when table does not exist yet.
            }

            $stmt = $db->prepare('DELETE FROM bookings WHERE id = :id');
            $stmt->execute([':id' => $id]);

            if ($stmt->rowCount() === 0) {
                throw new RuntimeException('Booking not found.', 404);
            }

            if ($startedTransaction && $db->inTransaction()) {
                $db->commit();
            }
        } catch (\Throwable $e) {
            if ($startedTransaction && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
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

        $rawBeforeMedia = $row['before_media_urls'] ?? null;
        $beforePhotos = $rawBeforeMedia ? (json_decode((string) $rawBeforeMedia, true) ?? []) : [];

        $rawAfterMedia = $row['after_media_urls'] ?? null;
        $afterPhotos = $rawAfterMedia ? (json_decode((string) $rawAfterMedia, true) ?? []) : [];

        $rawVars = $row['selected_variations'] ?? null;
        $selectedVariations = $rawVars ? (json_decode((string) $rawVars, true) ?? []) : [];

        $assignedTechId = isset($row['assigned_tech_id']) && $row['assigned_tech_id'] !== null
            ? (int) $row['assigned_tech_id']
            : null;
        $assignedTech = null;
        if ($assignedTechId !== null) {
            $assignedTech = [
                'id'       => $assignedTechId,
                'userId'   => isset($row['assigned_tech_user_id']) && $row['assigned_tech_user_id'] !== null ? (int) $row['assigned_tech_user_id'] : null,
                'name'     => (string) ($row['assigned_tech_name'] ?? ''),
                'role'     => (string) ($row['assigned_tech_role'] ?? ''),
                'imageUrl' => $row['assigned_tech_image_url'] ?? null,
            ];
        }

        return [
            'id'                 => $row['id'],
            'referenceNumber'    => $row['reference_number'],
            'userId'             => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'assignedTechId'     => $assignedTechId,
            'assignedTech'       => $assignedTech,
            'name'               => $row['name'],
            'email'              => $row['email'],
            'phone'              => $row['phone'],
            'vehicleInfo'        => $row['vehicle_info'],
            'vehicleMake'        => $row['vehicle_make']  ?? null,
            'vehicleModel'       => $row['vehicle_model'] ?? null,
            'vehicleYear'        => $row['vehicle_year']  ?? null,
            'serviceId'          => (int) $row['service_id'],
            'serviceIds'         => $serviceIds,
            'serviceName'        => $row['service_name'] ?? null,
            'selectedVariations' => $selectedVariations,
            'appointmentDate'    => $row['appointment_date'],
            'appointmentTime'    => $row['appointment_time'],
            'notes'              => $row['notes']          ?? '',
            'signatureData'      => $row['signature_data'] ?? null,
            'mediaUrls'          => $mediaUrls,
            'beforePhotos'       => $beforePhotos,
            'afterPhotos'        => $afterPhotos,
            'status'             => $row['status'],
            'source'             => $row['source'] ?? 'website',
            'awaitingParts'      => (bool) ($row['awaiting_parts'] ?? false),
            'partsNotes'         => $row['parts_notes']     ?? null,
            'internalNotes'      => $row['internal_notes']  ?? null,
            'calibrationData'    => isset($row['calibration_data']) && $row['calibration_data'] !== null
                                      ? json_decode((string) $row['calibration_data'], true)
                                      : null,
            'createdAt'          => $row['created_at'],
            'buildSlug'          => $this->resolveBuildSlugForBooking($row),
        ];
    }

    private function assignedTechUserIdSelectSql(): string
    {
        return $this->hasTeamMemberUserIdColumn()
            ? 'tm.user_id AS assigned_tech_user_id,'
            : 'NULL AS assigned_tech_user_id,';
    }

    private function hasTeamMemberUserIdColumn(): bool
    {
        if ($this->hasTeamMemberUserIdColumnCache !== null) {
            return $this->hasTeamMemberUserIdColumnCache;
        }
        if (!$this->useDb) {
            $this->hasTeamMemberUserIdColumnCache = false;
            return false;
        }

        try {
            $stmt = Database::getInstance()->prepare('SHOW COLUMNS FROM team_members LIKE :column');
            $stmt->execute([':column' => 'user_id']);
            $this->hasTeamMemberUserIdColumnCache = (bool) $stmt->fetch(\PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            $this->hasTeamMemberUserIdColumnCache = false;
        }

        return $this->hasTeamMemberUserIdColumnCache;
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

    /** @return array<string, mixed> */
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

        $todayBookings = (int) $db->query(
            "SELECT COUNT(*) FROM bookings WHERE appointment_date = CURDATE()"
        )->fetchColumn();

        $todayPending = (int) $db->query(
            "SELECT COUNT(*) FROM bookings WHERE appointment_date = CURDATE() AND status IN ('pending','confirmed')"
        )->fetchColumn();

        // Top 5 most-booked services
        $topServices = $db->query(
            "SELECT s.title AS service_name, COUNT(*) AS cnt
               FROM bookings b
               JOIN services s ON s.id = b.service_id
              GROUP BY b.service_id, s.title
              ORDER BY cnt DESC
              LIMIT 5"
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        // Peak appointment hours by volume (completed and active bookings).
        $peakHours = $db->query(
            "SELECT appointment_time AS hour_label, COUNT(*) AS cnt
               FROM bookings
              WHERE status IN ('pending', 'confirmed', 'completed')
              GROUP BY appointment_time
              ORDER BY cnt DESC
              LIMIT 8"
        )->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        usort($peakHours, static function (array $a, array $b): int {
            $timeA = strtotime((string) ($a['hour_label'] ?? ''));
            $timeB = strtotime((string) ($b['hour_label'] ?? ''));

            if ($timeA === false && $timeB === false) return 0;
            if ($timeA === false) return 1;
            if ($timeB === false) return -1;
            return $timeA <=> $timeB;
        });

        // Review stats
        $reviewRow = null;
        try {
            $reviewRow = $db->query(
                'SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
                   FROM booking_reviews WHERE is_approved = 1'
            )->fetch(\PDO::FETCH_ASSOC);
        } catch (\Throwable) { /* table may not exist yet */ }

        return [
            'totalBookings'     => $total,
            'pendingBookings'   => $pending,
            'confirmedBookings' => $confirmed,
            'completedBookings' => $completed,
            'cancelledBookings' => $cancelled,
            'activeBookings'    => $pending + $confirmed,
            'bookingsThisWeek'  => $thisWeek,
            'bookingsThisMonth' => $thisMonth,
            'todayBookings'     => $todayBookings,
            'todayPending'      => $todayPending,
            'topServices'       => array_map(fn($r) => [
                'name'  => $r['service_name'],
                'count' => (int) $r['cnt'],
            ], $topServices),
            'peakHours'         => array_map(fn($r) => [
                'time'  => (string) ($r['hour_label'] ?? ''),
                'count' => (int) ($r['cnt'] ?? 0),
            ], $peakHours),
            'reviewCount'       => $reviewRow ? (int)   $reviewRow['total']      : 0,
            'avgRating'         => $reviewRow ? (float) $reviewRow['avg_rating'] : 0.0,
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
        if (!is_array($data)) {
            return [];
        }

        $bookings = array_reverse($data);
        foreach ($bookings as &$booking) {
            if (!is_array($booking)) {
                continue;
            }
            $booking['buildSlug'] = $this->resolveBuildSlugForBooking($booking);
        }
        unset($booking);

        return $bookings;
    }

    /** @return array<int, array<string, mixed>> */
    private function getActivePortfolioItems(): array
    {
        if ($this->activePortfolioCache !== null) {
            return $this->activePortfolioCache;
        }

        try {
            $items = (new PortfolioService())->getAll(false);
            $this->activePortfolioCache = is_array($items) ? $items : [];
        } catch (\Throwable) {
            $this->activePortfolioCache = [];
        }

        return $this->activePortfolioCache;
    }

    private function hasBuildSlugColumn(): bool
    {
        if ($this->hasBuildSlugColumnCache !== null) {
            return $this->hasBuildSlugColumnCache;
        }

        try {
            $stmt = Database::getInstance()->query('SELECT build_slug FROM bookings LIMIT 0');
            $this->hasBuildSlugColumnCache = $stmt !== false;
        } catch (\Throwable) {
            $this->hasBuildSlugColumnCache = false;
        }

        return $this->hasBuildSlugColumnCache;
    }

    private function makeSlug(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-');
    }

    /** @param array<string, mixed> $item */
    private function portfolioItemSlug(array $item): string
    {
        $explicit = trim((string) ($item['slug'] ?? ''));
        if ($explicit !== '') {
            return $this->makeSlug($explicit);
        }

        return $this->makeSlug((string) ($item['title'] ?? ''));
    }

    /**
     * Resolve a completed booking to a public portfolio/build slug.
     *
     * @param array<string, mixed> $booking
     */
    private function resolveBuildSlugForBooking(array $booking): ?string
    {
        $status = strtolower((string) ($booking['status'] ?? ''));
        if ($status !== 'completed') {
            return null;
        }

        $explicit = trim((string) ($booking['buildSlug'] ?? ($booking['build_slug'] ?? '')));
        if ($explicit !== '') {
            $slug = $this->makeSlug($explicit);
            return $slug !== '' ? $slug : null;
        }

        $items = $this->getActivePortfolioItems();

        $referenceNumber = trim((string) ($booking['referenceNumber'] ?? ($booking['reference_number'] ?? '')));
        if ($referenceNumber !== '' && !empty($items)) {
            $needle = strtolower($referenceNumber);
            foreach ($items as $item) {
                $haystack = strtolower(
                    trim((string) ($item['title'] ?? '')) . ' ' . trim((string) ($item['description'] ?? ''))
                );
                if ($haystack !== '' && str_contains($haystack, $needle)) {
                    $slug = $this->portfolioItemSlug($item);
                    if ($slug !== '') {
                        return $slug;
                    }
                }
            }
        }

        $serviceName = trim((string) ($booking['serviceName'] ?? ($booking['service_name'] ?? '')));
        if ($serviceName !== '' && !empty($items)) {
            $serviceSlug = $this->makeSlug($serviceName);
            if ($serviceSlug !== '') {
                foreach ($items as $item) {
                    $slug = $this->portfolioItemSlug($item);
                    if ($slug === $serviceSlug) {
                        return $slug;
                    }
                }
            }

            foreach ($items as $item) {
                $title = trim((string) ($item['title'] ?? ''));
                if ($title !== '' && stripos($title, $serviceName) !== false) {
                    $slug = $this->portfolioItemSlug($item);
                    if ($slug !== '') {
                        return $slug;
                    }
                }
            }
        }

        $referenceNumber = trim((string) ($booking['referenceNumber'] ?? ($booking['reference_number'] ?? '')));
        if ($referenceNumber !== '') {
            $fallback = $this->makeSlug($referenceNumber);
            if ($fallback !== '') {
                return $fallback;
            }
        }

        $id = trim((string) ($booking['id'] ?? ''));
        if ($id !== '') {
            $fallback = $this->makeSlug($id);
            if ($fallback !== '') {
                return 'booking-' . $fallback;
            }
        }

        return null;
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

    /**
     * @param string[] $photoUrls
     * @return array<string, mixed>
     */
    private function fileUpdateQaPhotos(string $id, string $stage, array $photoUrls): array
    {
        $all   = array_reverse($this->fileGetAll());
        $found = null;
        $key   = $stage === 'before' ? 'beforePhotos' : 'afterPhotos';

        foreach ($all as &$b) {
            if ($b['id'] === $id) {
                $b[$key] = $photoUrls;
                $found   = $b;
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

    private function fileDelete(string $id): void
    {
        $all = array_reverse($this->fileGetAll());
        $next = [];
        $deleted = false;

        foreach ($all as $booking) {
            if (($booking['id'] ?? '') === $id) {
                $deleted = true;
                continue;
            }
            $next[] = $booking;
        }

        if (!$deleted) {
            throw new RuntimeException('Booking not found.', 404);
        }

        $this->fileWrite($next);
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

    /** @return array<string, mixed> */
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
        $todayBookings = 0;
        $todayPending  = 0;
        $topServiceCounts = [];
        $peakHourCounts = [];
        $todayIso = (new \DateTime('today'))->format('Y-m-d');

        foreach ($all as $b) {
            $status = (string) ($b['status'] ?? '');

            switch ($status) {
                case 'pending':   $pending++;   break;
                case 'confirmed': $confirmed++; break;
                case 'completed': $completed++; break;
                case 'cancelled': $cancelled++; break;
            }

            $created = new \DateTime($b['createdAt'] ?? 'now');
            if ($created >= $weekAgo)    $thisWeek++;
            if ($created >= $monthStart) $thisMonth++;

            $appointmentDate = (string) ($b['appointmentDate'] ?? '');
            if ($appointmentDate === $todayIso) {
                $todayBookings++;
                if (in_array($status, ['pending', 'confirmed'], true)) {
                    $todayPending++;
                }
            }

            $serviceLabel = trim((string) ($b['serviceName'] ?? ''));
            if ($serviceLabel !== '') {
                $topServiceCounts[$serviceLabel] = ($topServiceCounts[$serviceLabel] ?? 0) + 1;
            }

            $timeLabel = trim((string) ($b['appointmentTime'] ?? ''));
            if ($timeLabel !== '' && in_array($status, ['pending', 'confirmed', 'completed'], true)) {
                $peakHourCounts[$timeLabel] = ($peakHourCounts[$timeLabel] ?? 0) + 1;
            }
        }

        arsort($topServiceCounts);
        $topServiceCounts = array_slice($topServiceCounts, 0, 5, true);

        arsort($peakHourCounts);
        $peakHourCounts = array_slice($peakHourCounts, 0, 8, true);

        $peakHours = [];
        foreach ($peakHourCounts as $time => $count) {
            $peakHours[] = ['time' => (string) $time, 'count' => (int) $count];
        }

        usort($peakHours, static function (array $a, array $b): int {
            $timeA = strtotime((string) ($a['time'] ?? ''));
            $timeB = strtotime((string) ($b['time'] ?? ''));

            if ($timeA === false && $timeB === false) return 0;
            if ($timeA === false) return 1;
            if ($timeB === false) return -1;
            return $timeA <=> $timeB;
        });

        return [
            'totalBookings'     => count($all),
            'pendingBookings'   => $pending,
            'confirmedBookings' => $confirmed,
            'completedBookings' => $completed,
            'cancelledBookings' => $cancelled,
            'activeBookings'    => $pending + $confirmed,
            'bookingsThisWeek'  => $thisWeek,
            'bookingsThisMonth' => $thisMonth,
            'todayBookings'     => $todayBookings,
            'todayPending'      => $todayPending,
            'topServices'       => array_map(
                fn($name, $count) => ['name' => (string) $name, 'count' => (int) $count],
                array_keys($topServiceCounts),
                array_values($topServiceCounts)
            ),
            'peakHours'         => $peakHours,
            'reviewCount'       => 0,
            'avgRating'         => 0.0,
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

    private function generateReferenceNumber(): string
    {
        $date = date('Ymd');
        $randomPart = str_pad((string) mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        return 'BK-' . $date . '-' . $randomPart;
    }
}
