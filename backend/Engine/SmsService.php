<?php

/**
 * Sends SMS notifications via the Semaphore REST API.
 *
 * Configuration (set in .env / Configuration.php):
 *   SEMAPHORE_API_KEY     - Semaphore API key
 *   SEMAPHORE_SENDER_NAME - Approved sender name (default: "1625AutoLab")
 *   Booking alert recipients are active owner/admin users from DB
 *   (filtered by SMS notification preferences).
 *
 * All methods fail silently when Semaphore credentials are not configured, so
 * the booking flow is never interrupted by missing SMS setup.
 *
 * API reference: https://www.semaphore.co/docs
 */
class SmsService
{
    private const API_URL = 'https://api.semaphore.co/api/v4/messages';

    private string $apiKey;
    private string $senderName;
    private bool   $enabled;

    public function __construct()
    {
        $this->apiKey     = defined('SEMAPHORE_API_KEY')     ? (string) SEMAPHORE_API_KEY     : '';
        $this->senderName = defined('SEMAPHORE_SENDER_NAME') ? (string) SEMAPHORE_SENDER_NAME : '1625AutoLab';
        $this->enabled    = $this->apiKey !== '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public methods
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send a new-booking SMS to the client.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingCreated(array $booking): void
    {
        $phone = $this->normalisePhone((string) ($booking['phone'] ?? ''));
        if ($phone === '') return;

        $name    = (string) ($booking['name']            ?? 'there');
        $service = (string) ($booking['serviceName']     ?? 'your service');
        $date    = (string) ($booking['appointmentDate'] ?? '');
        $time    = (string) ($booking['appointmentTime'] ?? '');
        $refNumber = (string) ($booking['referenceNumber'] ?? '');

        $this->send(
            $phone,
            "Hi {$name}! Your booking for {$service} on {$date} at {$time} has been received."
          . ($refNumber !== '' ? " Reference: {$refNumber}." : '')
          . " We will confirm your appointment shortly. - 1625 Auto Lab"
        );
    }

    /**
     * Send a new-booking alert SMS to the admin.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingCreatedAdmin(array $booking): void
    {
        $name    = (string) ($booking['name']            ?? 'Unknown');
        $service = (string) ($booking['serviceName']     ?? 'Unknown service');
        $date    = (string) ($booking['appointmentDate'] ?? '');
        $time    = (string) ($booking['appointmentTime'] ?? '');
        $refNumber = (string) ($booking['referenceNumber'] ?? '');

        $message = "New booking received!"
            . ($refNumber !== '' ? " Ref: {$refNumber}." : '')
            . " Client: {$name}. Service: {$service}. Date: {$date} at {$time}. - 1625 Auto Lab";

        foreach ($this->fetchAlertRecipients('new_booking') as $phone) {
            $this->send($phone, $message);
        }
    }

/**
 * Send a customer-inquiry alert SMS to admins/owners.
 *
 * @param array<string, mixed> $inquiry
 */
public function customerInquiryAdmin(array $inquiry): void
{
    $name = (string) ($inquiry['fullName'] ?? $inquiry['name'] ?? 'A customer');
    $email = trim((string) ($inquiry['emailAddress'] ?? $inquiry['email'] ?? ''));
    $customerPhone = $this->normalisePhone((string) ($inquiry['contactNumber'] ?? $inquiry['phone'] ?? ''));

    $product = (string) ($inquiry['productToPurchase'] ?? '');
    $make = (string) ($inquiry['make'] ?? '');
    $model = (string) ($inquiry['model'] ?? '');
    $otherModel = (string) ($inquiry['otherModel'] ?? '');
    $year = trim((string) ($inquiry['yearModel'] ?? ''));
    $plate = trim((string) ($inquiry['plateNumber'] ?? ''));
    $address = trim((string) ($inquiry['address'] ?? ''));
    $facebook = trim((string) ($inquiry['facebookName'] ?? ''));

    $date = trim((string) ($inquiry['appointmentDate'] ?? ''));
    $time = trim((string) ($inquiry['appointmentTime'] ?? ''));

    $vehicle = trim($make . ' ' . ($model === 'Other Model' ? $otherModel : $model));

    $message = "NEW CUSTOMER INQUIRY\n\n"
        . "Customer\n"
        . "Name: {$name}\n"
        . ($customerPhone !== '' ? "Phone: {$customerPhone}\n" : '')
        . ($email !== '' ? "Email: {$email}\n" : '')
        . ($facebook !== '' ? "Facebook: {$facebook}\n" : '')
        . ($address !== '' ? "Address: {$address}\n" : '')
        . "\nVehicle\n"
        . ($vehicle !== '' ? "Vehicle: {$vehicle}\n" : '')
        . ($year !== '' ? "Year: {$year}\n" : '')
        . ($plate !== '' ? "Plate: {$plate}\n" : '')
        . "\nInquiry\n"
        . ($product !== '' ? "Product/Service: {$product}\n" : '')
        . ($date !== '' ? "Preferred Date: {$date}\n" : '')
        . ($time !== '' ? "Preferred Time: {$time}\n" : '')
        . "\nPlease follow up with the customer.\n\n"
        . "- 1625 Autolab";

    foreach ($this->fetchAlertRecipients('new_inquiry') as $recipientPhone) {
        $this->send($recipientPhone, $message);
    }
}

    /**
     * Send a confirmation SMS to the customer who submitted an inquiry.
     *
     * @param array<string, mixed> $inquiry
     */
    public function customerInquiryCustomer(array $inquiry): void
    {
        $phone = $this->normalisePhone((string) ($inquiry['contactNumber'] ?? $inquiry['phone'] ?? ''));
        if ($phone === '') return;

        $name = trim((string) ($inquiry['fullName'] ?? $inquiry['name'] ?? 'there'));
        $date = trim((string) ($inquiry['appointmentDate'] ?? ''));
        $time = trim((string) ($inquiry['appointmentTime'] ?? ''));

        $message = "Hi {$name}!\n\n"
            . "Thank you for booking an installation service with us. Your appointment has been successfully received.\n\n"
            . ($date !== '' ? "Date: {$date}\n" : '')
            . ($time !== '' ? "Time: {$time}\n\n" : "\n")
            . "Our team will contact you before the scheduled appointment to confirm your booking and provide any necessary updates.\n\n"
            . "If you need to reschedule or have any questions, simply contact us on our Facebook page.\n\n"
            . "Thank you for choosing us—we look forward to serving you!";

        $this->send($phone, $message);
    }

    /**
     * Send a booking confirmation SMS to the client.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingConfirmed(array $booking): void
    {
        $phone = $this->normalisePhone((string) ($booking['phone'] ?? ''));
        if ($phone === '') return;

        $name    = (string) ($booking['name']            ?? 'there');
        $service = (string) ($booking['serviceName']     ?? 'your service');
        $date    = (string) ($booking['appointmentDate'] ?? '');
        $time    = (string) ($booking['appointmentTime'] ?? '');

        $this->send(
            $phone,
            "Hi {$name}! Your booking for {$service} on {$date} at {$time} has been CONFIRMED. "
          . "- 1625 Auto Lab"
        );
    }

    /**
     * Send a status-change SMS to the client.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingStatusChanged(array $booking): void
    {
        $phone = $this->normalisePhone((string) ($booking['phone'] ?? ''));
        if ($phone === '') return;

        $name    = (string) ($booking['name']        ?? 'there');
        $service = (string) ($booking['serviceName'] ?? 'your service');
        $status  = ucwords(str_replace('_', ' ', (string) ($booking['status'] ?? '')));

        $this->send(
            $phone,
            "Hi {$name}! Your {$service} booking status is now: {$status}. - 1625 Auto Lab"
        );
    }

    /**
     * Send an appointment reminder SMS 24 h before.
     *
     * @param array<string, mixed> $booking
     */
    public function appointmentReminder(array $booking): void
    {
        $phone = $this->normalisePhone((string) ($booking['phone'] ?? ''));
        if ($phone === '') return;

        $name    = (string) ($booking['name']            ?? 'po');
        $service = (string) ($booking['serviceName']     ?? $booking['service_name'] ?? 'inyong serbisyo');
        $time    = (string) ($booking['appointmentTime'] ?? $booking['appointment_time'] ?? '');

        $this->send(
            $phone,
            "Hello {$name}! Just a reminder - your appointment for {$service}"
          . ($time !== '' ? " at {$time}" : '')
          . " is tomorrow. Please don't forget to come to 1625 Auto Lab."
        );
    }

    /**
     * Notify a waitlisted customer that a slot has become available.
     *
     * @param array<string, mixed> $data  Keys: name, phone, date, time
     */
    public function waitlistSlotAvailable(array $data): void
    {
        $phone = $this->normalisePhone((string) ($data['phone'] ?? ''));
        if ($phone === '') return;

        $name = (string) ($data['name'] ?? 'po');
        $date = (string) ($data['date'] ?? '');
        $time = (string) ($data['time'] ?? '');

        $this->send(
            $phone,
            "Hi {$name}! Magandang balita - may bakanteng slot na sa {$date}"
          . ($time !== '' ? " at {$time}" : '') . ". "
          . "I-book na agad bago maubusan! - 1625 Auto Lab"
        );
    }

    /**
     * Notify a staff member (technician) that a booking has been assigned to them.
     *
     * @param array<string, mixed> $booking   The booking record
     * @param string               $techPhone The technician's phone number
     * @param string               $techName  The technician's name
     */
    public function staffAssigned(array $booking, string $techPhone, string $techName, ?int $techUserId = null): void
    {
        $phone = $this->normalisePhone($techPhone);
        if ($phone === '') return;

        // Respect the technician's SMS assignment preference when we have their user ID.
        if ($techUserId !== null) {
            try {
                $prefs = new NotificationPreferencesService();
                if (!$prefs->smsEnabled($techUserId, 'assignment')) {
                    return;
                }
            } catch (\Throwable) {
                // Preferences unavailable – send anyway.
            }
        }

        $client  = (string) ($booking['name']            ?? 'a client');
        $service = (string) ($booking['serviceName']     ?? 'a service');
        $date    = (string) ($booking['appointmentDate'] ?? '');
        $time    = (string) ($booking['appointmentTime'] ?? '');
        $refNumber = (string) ($booking['referenceNumber'] ?? '');

        $this->send(
            $phone,
            "Hi {$techName}! You have been assigned to a booking."
          . ($refNumber !== '' ? " Ref: {$refNumber}." : '')
          . " Client: {$client}. Service: {$service}."
          . ($date !== '' ? " Date: {$date}" . ($time !== '' ? " at {$time}" : '') . '.' : '')
          . " - 1625 Auto Lab"
        );
    }

    /**
     * Send a generic campaign SMS to a client.
     */
    public function marketingCampaignMessage(string $phone, string $message): void
    {
        $to = $this->normalisePhone($phone);
        if ($to === '') {
            return;
        }

        $text = trim($message);
        if ($text === '') {
            return;
        }

        $this->send($to, mb_substr($text, 0, 480));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return normalised phone numbers for all admin/owner users who have opted
     * in to the given SMS alert type.
     *
     * @return string[]
     */
    private function fetchAlertRecipients(string $smsType): array
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->query(
                "SELECT u.id, u.phone
                 FROM users u
                 WHERE u.role IN ('admin', 'owner')
                   AND u.phone IS NOT NULL
                   AND u.phone <> ''
                   AND (u.is_active IS NULL OR u.is_active = 1)"
            );
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable) {
            return [];
        }

        try {
            $prefs = new NotificationPreferencesService();
        } catch (\Throwable) {
            $prefs = null;
        }

        $phones = [];
        foreach ($rows as $row) {
            $userId = (int) ($row['id'] ?? 0);
            $phone  = $this->normalisePhone((string) ($row['phone'] ?? ''));
            if ($phone === '') {
                continue;
            }
            // Check preference – default true when preferences unavailable.
            $allowed = ($prefs === null) || $prefs->smsEnabled($userId, $smsType);
            if ($allowed) {
                $phones[] = $phone;
            }
        }

        return array_values(array_unique($phones));
    }

    /**
     * POST to the Semaphore Messages API.
     *
     * Uses Guzzle (already a project dependency) with a 10-second timeout.
     * Any exception is caught and logged to PHP's error log so the booking
     * flow is never interrupted by an SMS failure.
     */
    private function send(string $to, string $body): void
    {
        if (!$this->enabled) {
            return;
        }

        try {
            $client = new \GuzzleHttp\Client([
                'timeout' => 10,
                'http_errors' => false,
                'headers' => ['Accept' => 'application/json'],
            ]);

            $response = $client->post(self::API_URL, [
                'form_params' => [
                    'apikey'     => $this->apiKey,
                    'number'     => $to,
                    'message'    => $body,
                    'sendername' => $this->senderName,
                ],
            ]);

            $statusCode = $response->getStatusCode();
            if ($statusCode < 200 || $statusCode >= 300) {
                $responseBody = (string) $response->getBody();
                $decoded = json_decode($responseBody, true);
                $errorMessage = '';
                if (is_array($decoded) && isset($decoded['message']) && is_string($decoded['message'])) {
                    $errorMessage = trim($decoded['message']);
                }
                if ($errorMessage === '') {
                    $errorMessage = trim($responseBody) !== '' ? $responseBody : 'Unknown Semaphore error';
                }

                error_log(
                    '[SmsService] Semaphore SMS failed for ' . substr($to, 0, 4) . '****' .
                    ' with status ' . $statusCode . ': ' . $errorMessage
                );
            }
        } catch (\Throwable $e) {
            error_log('[SmsService] Failed to send SMS to ' . substr($to, 0, 4) . '****' . ': ' . $e->getMessage());
        }
    }

    /**
     * Normalise a phone number to the format accepted by Semaphore (no leading +).
     *
     * Accepts:  09171234567  → 639171234567
     *           +639171234567 → 639171234567
     *           639171234567  → 639171234567 (unchanged)
     *
     * Returns '' if normalisation is not possible.
     */
    private function normalisePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);
        if ($digits === null || $digits === '') return '';

        if (str_starts_with($digits, '0') && strlen($digits) === 11) {
            return '63' . substr($digits, 1);       // 09XXXXXXXXX → 639XXXXXXXXX
        }
        if (str_starts_with($digits, '63') && strlen($digits) === 12) {
            return $digits;                          // already 639XXXXXXXXX
        }
        return '';
    }
}
