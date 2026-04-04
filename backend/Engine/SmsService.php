use Twilio\Rest\Client;
<?php

/**
 * Sends SMS notifications via the Twilio REST API.
 *
 * Configuration (set in .env / Configuration.php):
 *   TWILIO_ACCOUNT_SID  - Twilio Account SID
 *   TWILIO_AUTH_TOKEN   - Twilio Auth Token
 *   TWILIO_FROM         - Twilio phone number in E.164 format, e.g. +15551234567
 *
 * All methods fail silently when Twilio credentials are not configured, so the
 * booking flow is never interrupted by missing SMS setup.
 */
class SmsService
{
    private string $accountSid;
    private string $authToken;
    private string $from;
    private bool   $enabled;

    public function __construct()
    {
        $this->accountSid = defined('TWILIO_ACCOUNT_SID') ? (string) TWILIO_ACCOUNT_SID : '';
        $this->authToken  = defined('TWILIO_AUTH_TOKEN')  ? (string) TWILIO_AUTH_TOKEN  : '';
        $this->from       = defined('TWILIO_FROM')        ? (string) TWILIO_FROM        : '';
        $this->enabled    = $this->accountSid !== '' && $this->authToken !== '' && $this->from !== '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public methods
    // ─────────────────────────────────────────────────────────────────────────

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
          . "Reply STOP to unsubscribe. - 1625 Auto Lab"
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
            "Hi {$name}! Your {$service} booking status is now: {$status}. "
          . "Reply STOP to unsubscribe. - 1625 Auto Lab"
        );
    }

    /**
     * Send an appointment reminder SMS 24 h before (in Filipino/Tagalog).
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
                "Hello {$name}! 🔧 Just a reminder - your appointment for {$service}" .
                ($time !== '' ? " at {$time}" : '') .
                " is tomorrow. Please don't forget to come to 1625 Auto Lab. Reply STOP to unsubscribe."
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
          . "I-book na agad bago maubusan! - 1625 Auto Lab. "
          . "Reply STOP para mag-unsubscribe."
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST to the Twilio Messages API.
     *
     * Uses Guzzle (already a project dependency) with a 5-second timeout.
     * Any exception is caught and logged to PHP's error log so the booking
     * flow is never interrupted by an SMS failure.
     */
    private function send(string $to, string $body): void
    {
        if (!$this->enabled) return;

        try {
            $twilio = new Client($this->accountSid, $this->authToken);
            $twilio->messages->create(
                $to,
                [
                    'from' => $this->from,
                    'body' => $body,
                ]
            );
        } catch (\Throwable $e) {
            error_log('[SmsService] Failed to send SMS to ' . substr($to, 0, 4) . '****' . ': ' . $e->getMessage());
        }
    }

    /**
     * Normalise a phone number to E.164 format for Philippine numbers.
     *
     * Accepts:  09171234567 → +639171234567
     *           +639171234567 → +639171234567 (unchanged)
     *           (02) 1234-5678 → stripped, returned as-is if already has +
     *
     * Returns '' if normalisation is not possible.
     */
    private function normalisePhone(string $phone): string
    {
        $digits = preg_replace('/[^\d+]/', '', $phone);
        if ($digits === null || $digits === '') return '';

        if (str_starts_with($digits, '+')) return $digits;    // already E.164
        if (str_starts_with($digits, '09') && strlen($digits) === 11) {
            return '+63' . substr($digits, 1);                // PH mobile
        }
        if (str_starts_with($digits, '639') && strlen($digits) === 12) {
            return '+' . $digits;
        }
        return '';
    }
}
