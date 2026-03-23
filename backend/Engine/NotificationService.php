<?php

declare(strict_types=1);

/**
 * Sends transactional email notifications for booking events.
 *
 * Uses PHP's built-in mail() function.  Set MAIL_FROM in the .env file to
 * enable notifications; if MAIL_FROM is empty, all sends are silently skipped
 * so the booking flow is never blocked by missing mail configuration.
 *
 * For production, swap mail() for an SMTP library such as PHPMailer or Symfony
 * Mailer by adding it via Composer and updating the send() method below.
 */
class NotificationService
{
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Send a booking-confirmation email to the customer and a copy to the admin
     * inbox (if MAIL_ADMIN is set).
     *
     * @param array<string, mixed> $booking
     */
    public function bookingCreated(array $booking): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($booking['email'] ?? '');
        $customerName  = (string) ($booking['name']  ?? 'Customer');

        if ($customerEmail !== '') {
            $subject = 'Booking Confirmed – Apollo 1625 Auto Lab';
            $body    = $this->buildConfirmationBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $subject = "New Booking: {$booking['serviceName']} – {$booking['name']}";
            $body    = $this->buildAdminNotificationBody($booking);
            $this->send(MAIL_ADMIN, 'Admin', $subject, $body);
        }
    }

    /**
     * Notify the customer that their booking status has changed.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingStatusChanged(array $booking): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($booking['email'] ?? '');
        $customerName  = (string) ($booking['name']  ?? 'Customer');

        if ($customerEmail === '') {
            return;
        }

        $status  = ucfirst((string) ($booking['status'] ?? ''));
        $subject = "Your Booking is $status – Apollo 1625 Auto Lab";
        $body    = $this->buildStatusUpdateBody($booking);
        $this->send($customerEmail, $customerName, $subject, $body);
    }

    /**
     * Notify the customer that their job is paused awaiting parts.
     *
     * @param array<string, mixed> $booking
     */
    public function bookingAwaitingParts(array $booking): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($booking['email'] ?? '');
        $customerName  = (string) ($booking['name']  ?? 'Customer');

        if ($customerEmail === '') {
            return;
        }

        $subject = 'Job Update: Awaiting Parts – Apollo 1625 Auto Lab';
        $body    = $this->buildAwaitingPartsBody($booking);
        $this->send($customerEmail, $customerName, $subject, $body);
    }

    // -------------------------------------------------------------------------
    // Email body builders
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $b */
    private function buildConfirmationBody(array $b): string
    {
        $name        = htmlspecialchars((string) ($b['name']            ?? ''));
        $service     = htmlspecialchars((string) ($b['serviceName']     ?? ''));
        $date        = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time        = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $vehicle     = htmlspecialchars((string) ($b['vehicleInfo']     ?? ''));
        $id          = htmlspecialchars((string) ($b['id']              ?? ''));

        return $this->wrapHtml("
            <h2>Hi $name,</h2>
            <p>Your appointment has been received and is <strong>pending confirmation</strong>.</p>
            <table>
                <tr><td><strong>Service:</strong></td><td>$service</td></tr>
                <tr><td><strong>Date:</strong></td><td>$date</td></tr>
                <tr><td><strong>Time:</strong></td><td>$time</td></tr>
                <tr><td><strong>Vehicle:</strong></td><td>$vehicle</td></tr>
                <tr><td><strong>Booking ID:</strong></td><td>#$id</td></tr>
            </table>
            <p>We will contact you to confirm the appointment or if we need additional information.</p>
            <p style='color:#888'>Apollo 1625 Auto Lab · NKKS Arcade, Brgy. Alasas, San Fernando, Pampanga</p>
        ");
    }

    /** @param array<string, mixed> $b */
    private function buildAdminNotificationBody(array $b): string
    {
        $lines = '';
        foreach ($b as $key => $val) {
            if (in_array($key, ['signatureData', 'mediaUrls'], true)) {
                continue;
            }
            $k = htmlspecialchars((string) $key);
            $v = htmlspecialchars(is_array($val) ? implode(', ', $val) : (string) $val);
            $lines .= "<tr><td><strong>$k</strong></td><td>$v</td></tr>";
        }
        return $this->wrapHtml("<h2>New Booking Received</h2><table>$lines</table>");
    }

    /** @param array<string, mixed> $b */
    private function buildStatusUpdateBody(array $b): string
    {
        $name    = htmlspecialchars((string) ($b['name']    ?? ''));
        $status  = htmlspecialchars(ucfirst((string) ($b['status'] ?? '')));
        $service = htmlspecialchars((string) ($b['serviceName'] ?? ''));

        return $this->wrapHtml("
            <h2>Hi $name,</h2>
            <p>Your booking for <strong>$service</strong> is now <strong>$status</strong>.</p>
            <p>If you have any questions, please call us at <strong>0939 330 8263</strong>
               or email <a href='mailto:1625autolab@gmail.com'>1625autolab@gmail.com</a>.</p>
            <p style='color:#888'>Apollo 1625 Auto Lab</p>
        ");
    }

    /** @param array<string, mixed> $b */
    private function buildAwaitingPartsBody(array $b): string
    {
        $name   = htmlspecialchars((string) ($b['name']       ?? ''));
        $notes  = htmlspecialchars((string) ($b['partsNotes'] ?? 'No additional details provided.'));

        return $this->wrapHtml("
            <h2>Hi $name,</h2>
            <p>Your job is temporarily <strong>on hold while we wait for parts</strong> to arrive.</p>
            <p><strong>Details:</strong> $notes</p>
            <p>We will notify you as soon as the parts arrive and work resumes.
               In the meantime, feel free to reach us at <strong>0939 330 8263</strong>.</p>
            <p style='color:#888'>Apollo 1625 Auto Lab</p>
        ");
    }

    private function wrapHtml(string $body): string
    {
        return "<!DOCTYPE html><html><body style='font-family:sans-serif;max-width:600px;margin:auto;padding:24px'>
            $body
        </body></html>";
    }

    // -------------------------------------------------------------------------
    // Mailer
    // -------------------------------------------------------------------------

    private function send(string $to, string $toName, string $subject, string $htmlBody): void
    {
        $fromName = MAIL_FROM_NAME;
        $from     = MAIL_FROM;

        $headers  = implode("\r\n", [
            "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$from>",
            "Reply-To: $from",
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'X-Mailer: Apollo-1625-AutoLab',
        ]);

        @mail($to, $subject, $htmlBody, $headers);
    }
}
