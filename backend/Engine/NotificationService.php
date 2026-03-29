<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;

/**
 * Sends transactional email notifications for booking events.
 *
 * Uses SMTP via PHPMailer when SMTP_HOST is configured.
 * Falls back to PHP's built-in mail() when SMTP is not configured.
 * Set MAIL_FROM in .env to enable notifications.
 */
class NotificationService
{
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Send a contact-form message to the admin inbox (1625autolab@gmail.com).
     *
     * @param array<string, string> $data
     */
    public function contactMessage(array $data): void
    {
        $to      = '1625autolab@gmail.com';
        // Strip CRLF from values used in email headers to prevent header injection
        $rawName    = str_replace(["\r", "\n"], '', $data['name']    ?? '');
        $rawEmail   = str_replace(["\r", "\n"], '', $data['email']   ?? '');
        $rawSubject = str_replace(["\r", "\n"], '', $data['subject'] ?? '');

        // HTML-escaped versions for use in the email body
        $name    = htmlspecialchars($rawName);
        $email   = htmlspecialchars($rawEmail);
        $phone   = htmlspecialchars(str_replace(["\r", "\n"], '', $data['phone'] ?? ''));
        $subject = htmlspecialchars($rawSubject);
        $msgText = nl2br(htmlspecialchars($data['message'] ?? ''));

        $phoneRow = $phone !== '' ? "<tr><td><strong>Phone:</strong></td><td>$phone</td></tr>" : '';

        $body = $this->wrapHtml("
            <h2>New Contact Form Message</h2>
            <table>
                <tr><td><strong>From:</strong></td><td>$name &lt;$email&gt;</td></tr>
                $phoneRow
                <tr><td><strong>Subject:</strong></td><td>$subject</td></tr>
            </table>
            <h3>Message</h3>
            <p style='white-space:pre-wrap'>$msgText</p>
            <p style='color:#888;font-size:12px'>Sent via the contact form on the 1625 Auto Lab website.</p>
        ");

        $emailSubject = "Contact Form: $rawSubject";

        // Build headers; use RFC 2047 base64 encoding for the Reply-To display name
        $fromName   = MAIL_FROM_NAME;
        $from       = MAIL_FROM !== '' ? MAIL_FROM : $to;
        $headers    = implode("\r\n", [
            "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$from>",
            "Reply-To: =?UTF-8?B?" . base64_encode($rawName) . "?= <$rawEmail>",
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'X-Mailer: 1625-AutoLab',
        ]);

        @mail($to, $emailSubject, $body, $headers);
    }

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
            $subject = 'Booking Confirmed – 1625 Auto Lab';
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
            // Continue to admin notification even if customer email is missing.
        } else {
            $status  = ucfirst((string) ($booking['status'] ?? ''));
            $subject = "Your Booking is $status – 1625 Auto Lab";
            $body    = $this->buildStatusUpdateBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $status  = ucfirst((string) ($booking['status'] ?? ''));
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Status Updated: {$service} – {$name} ({$status})";
            $body    = $this->buildAdminStatusChangedBody($booking);
            $this->send(MAIL_ADMIN, 'Admin', $subject, $body);
        }
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
            // Continue to admin notification even if customer email is missing.
        } else {
            $subject = 'Job Update: Awaiting Parts – 1625 Auto Lab';
            $body    = $this->buildAwaitingPartsBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Awaiting Parts: {$service} – {$name}";
            $body    = $this->buildAdminAwaitingPartsBody($booking);
            $this->send(MAIL_ADMIN, 'Admin', $subject, $body);
        }
    }

    /**
     * Notify the customer that a new build progress update has been posted.
     *
     * @param array<string, mixed> $booking  Full booking row (must include email, name, serviceName)
     * @param array<string, mixed> $update   Build update row (note, photoUrls, createdAt)
     */
    public function buildUpdateCreated(array $booking, array $update): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($booking['email'] ?? '');
        $customerName  = (string) ($booking['name']  ?? 'Customer');

        if ($customerEmail === '') {
            // Continue to admin notification even if customer email is missing.
        } else {
            $subject = 'Build Update on Your Vehicle – 1625 Auto Lab';
            $body    = $this->buildProgressUpdateBody($booking, $update);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Build Progress Update Posted: {$service} – {$name}";
            $body    = $this->buildAdminBuildUpdateBody($booking, $update);
            $this->send(MAIL_ADMIN, 'Admin', $subject, $body);
        }
    }

    /**
     * Send a password-reset link to the given email address.
     *
     * @param string $email     Recipient address (already validated as a known user).
     * @param string $resetUrl  Full URL containing the reset token.
     */
    public function passwordReset(string $email, string $resetUrl): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $safeUrl = htmlspecialchars($resetUrl);
        $body    = $this->wrapHtml("
            <h2>Reset Your Password</h2>
            <p>We received a request to reset the password for your 1625 Auto Lab account.</p>
            <p>Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.</p>
            <p style='text-align:center;margin:32px 0'>
                <a href='$safeUrl'
                   style='background:#f97316;color:#fff;padding:14px 28px;text-decoration:none;
                          font-weight:bold;border-radius:4px;display:inline-block'>
                    Reset Password
                </a>
            </p>
            <p>If you did not request a password reset, you can safely ignore this email.
               Your password will not be changed.</p>
            <p>Or copy this link into your browser:<br>
               <a href='$safeUrl' style='color:#f97316;word-break:break-all'>$safeUrl</a>
            </p>
            <p style='color:#888'>1625 Auto Lab</p>
        ");

        $this->send($email, 'Customer', 'Reset Your Password – 1625 Auto Lab', $body);
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
            <p style='color:#888'>1625 Auto Lab · NKKS Arcade, Brgy. Alasas, San Fernando, Pampanga</p>
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
            <p style='color:#888'>1625 Auto Lab</p>
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
            <p style='color:#888'>1625 Auto Lab</p>
        ");
    }

    /**
     * @param array<string, mixed> $b
     * @param array<string, mixed> $u
     */
    private function buildProgressUpdateBody(array $b, array $u): string
    {
        $name    = htmlspecialchars((string) ($b['name']        ?? ''));
        $service = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $note    = nl2br(htmlspecialchars((string) ($u['note']  ?? '')));
        $date    = htmlspecialchars((string) ($u['createdAt']   ?? ''));

        $photosHtml = '';
        $photoUrls  = is_array($u['photoUrls'] ?? null) ? $u['photoUrls'] : [];
        foreach ($photoUrls as $url) {
            $safeUrl     = htmlspecialchars((string) $url);
            $photosHtml .= "<img src='$safeUrl' alt='Build photo' style='max-width:100%;margin:8px 0;display:block;border-radius:4px'>";
        }

        $noteSection = $note !== '' ? "<p><strong>Update:</strong> $note</p>" : '';

        return $this->wrapHtml("
            <h2>Hi $name,</h2>
            <p>There is a new progress update on your <strong>$service</strong> job!</p>
            $noteSection
            $photosHtml
            <p style='color:#888;font-size:12px'>Posted on $date</p>
            <p>If you have any questions, call us at <strong>0939 330 8263</strong>
               or email <a href='mailto:1625autolab@gmail.com'>1625autolab@gmail.com</a>.</p>
            <p style='color:#888'>1625 Auto Lab</p>
        ");
    }

    /** @param array<string, mixed> $b */
    private function buildAdminStatusChangedBody(array $b): string
    {
        $name        = htmlspecialchars((string) ($b['name'] ?? ''));
        $email       = htmlspecialchars((string) ($b['email'] ?? ''));
        $service     = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $status      = htmlspecialchars(ucfirst((string) ($b['status'] ?? '')));
        $date        = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time        = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $bookingId   = htmlspecialchars((string) ($b['id'] ?? ''));

        return $this->wrapHtml("
            <h2>Booking Status Updated</h2>
            <table>
                <tr><td><strong>Customer:</strong></td><td>$name &lt;$email&gt;</td></tr>
                <tr><td><strong>Service:</strong></td><td>$service</td></tr>
                <tr><td><strong>Status:</strong></td><td>$status</td></tr>
                <tr><td><strong>Date:</strong></td><td>$date</td></tr>
                <tr><td><strong>Time:</strong></td><td>$time</td></tr>
                <tr><td><strong>Booking ID:</strong></td><td>#$bookingId</td></tr>
            </table>
        ");
    }

    /** @param array<string, mixed> $b */
    private function buildAdminAwaitingPartsBody(array $b): string
    {
        $name        = htmlspecialchars((string) ($b['name'] ?? ''));
        $email       = htmlspecialchars((string) ($b['email'] ?? ''));
        $service     = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $notes       = nl2br(htmlspecialchars((string) ($b['partsNotes'] ?? 'No additional details provided.')));
        $bookingId   = htmlspecialchars((string) ($b['id'] ?? ''));

        return $this->wrapHtml("
            <h2>Booking Awaiting Parts</h2>
            <table>
                <tr><td><strong>Customer:</strong></td><td>$name &lt;$email&gt;</td></tr>
                <tr><td><strong>Service:</strong></td><td>$service</td></tr>
                <tr><td><strong>Booking ID:</strong></td><td>#$bookingId</td></tr>
            </table>
            <h3>Parts Notes</h3>
            <p style='white-space:pre-wrap'>$notes</p>
        ");
    }

    /**
     * @param array<string, mixed> $b
     * @param array<string, mixed> $u
     */
    private function buildAdminBuildUpdateBody(array $b, array $u): string
    {
        $name      = htmlspecialchars((string) ($b['name'] ?? ''));
        $email     = htmlspecialchars((string) ($b['email'] ?? ''));
        $service   = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $bookingId = htmlspecialchars((string) ($b['id'] ?? ''));
        $note      = nl2br(htmlspecialchars((string) ($u['note'] ?? '')));
        $date      = htmlspecialchars((string) ($u['createdAt'] ?? ''));

        $photosHtml = '';
        $photoUrls  = is_array($u['photoUrls'] ?? null) ? $u['photoUrls'] : [];
        foreach ($photoUrls as $url) {
            $safeUrl = htmlspecialchars((string) $url);
            $photosHtml .= "<li><a href='$safeUrl' style='color:#f97316'>$safeUrl</a></li>";
        }
        if ($photosHtml !== '') {
            $photosHtml = "<h3>Photos</h3><ul>$photosHtml</ul>";
        }

        $noteSection = $note !== '' ? "<h3>Update Note</h3><p style='white-space:pre-wrap'>$note</p>" : '';

        return $this->wrapHtml("
            <h2>Build Progress Update Posted</h2>
            <table>
                <tr><td><strong>Customer:</strong></td><td>$name &lt;$email&gt;</td></tr>
                <tr><td><strong>Service:</strong></td><td>$service</td></tr>
                <tr><td><strong>Booking ID:</strong></td><td>#$bookingId</td></tr>
                <tr><td><strong>Posted At:</strong></td><td>$date</td></tr>
            </table>
            $noteSection
            $photosHtml
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

    /**
     * Send a test email to MAIL_ADMIN (or a custom recipient).
     * Returns an array describing what was attempted.
     *
     * @return array<string, mixed>
     */
    public function sendTest(string $recipient = ''): array
    {
        $to = $recipient !== '' ? $recipient : MAIL_ADMIN;

        if (MAIL_FROM === '') {
            return [
                'sent'      => false,
                'recipient' => $to,
                'reason'    => 'MAIL_FROM is not configured in .env',
            ];
        }

        if ($to === '') {
            return [
                'sent'      => false,
                'recipient' => $to,
                'reason'    => 'No recipient – set MAIL_ADMIN in .env or supply a recipient',
            ];
        }

        $subject = 'Test Email – 1625 Auto Lab';
        $body    = '<h2 style="font-family:sans-serif;color:#f97316">Test Email</h2>'
                 . '<p style="font-family:sans-serif">This is a test notification from your 1625 Auto Lab booking system. '
                 . 'If you received this, your email configuration is working correctly.</p>'
                 . '<p style="font-family:sans-serif;color:#9ca3af;font-size:12px">Sent at: ' . date('Y-m-d H:i:s') . '</p>';

        $this->send($to, 'Admin', $subject, $body);

        return [
            'sent'      => true,
            'recipient' => $to,
            'reason'    => null,
        ];
    }

    /**
     * Return current mail configuration status (no secrets exposed).
     *
     * @return array<string, mixed>
     */
    public function configStatus(): array
    {
        $smtpConfigured = $this->smtpConfigured();

        return [
            'configured' => MAIL_FROM !== '',
            'fromSet'    => MAIL_FROM !== '',
            'adminSet'   => MAIL_ADMIN !== '',
            'fromName'   => MAIL_FROM_NAME,
            'fromHint'   => MAIL_FROM !== '' ? $this->maskEmail(MAIL_FROM) : '',
            'adminHint'  => MAIL_ADMIN !== '' ? $this->maskEmail(MAIL_ADMIN) : '',
            'transport'  => $smtpConfigured ? 'smtp' : 'mail',
            'smtpHost'   => $smtpConfigured ? SMTP_HOST : '',
            'smtpPort'   => $smtpConfigured ? SMTP_PORT : 0,
        ];
    }

    // -------------------------------------------------------------------------
    // Mailer
    // -------------------------------------------------------------------------

    private function send(string $to, string $toName, string $subject, string $htmlBody): void
    {
        if ($this->smtpConfigured()) {
            $this->sendViaSmtp($to, $toName, $subject, $htmlBody);
            return;
        }

        $fromName = MAIL_FROM_NAME;
        $from     = MAIL_FROM;

        $headers  = implode("\r\n", [
            "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$from>",
            "Reply-To: $from",
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'X-Mailer: 1625-AutoLab',
        ]);

        @mail($to, $subject, $htmlBody, $headers);
    }

    private function smtpConfigured(): bool
    {
        return SMTP_HOST !== '';
    }

    private function sendViaSmtp(string $to, string $toName, string $subject, string $htmlBody): void
    {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = SMTP_HOST;
            $mail->Port       = SMTP_PORT;
            $mail->SMTPAuth   = SMTP_AUTH;
            $mail->Username   = SMTP_USERNAME;
            $mail->Password   = SMTP_PASSWORD;
            $mail->Timeout    = max(1, SMTP_TIMEOUT);

            if (SMTP_ENCRYPTION === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } elseif (SMTP_ENCRYPTION === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } else {
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
            }

            $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
            $mail->addAddress($to, $toName);
            $mail->addReplyTo(MAIL_FROM, MAIL_FROM_NAME);
            $mail->Subject = $subject;
            $mail->isHTML(true);
            $mail->Body    = $htmlBody;
            $mail->send();
        } catch (PHPMailerException $e) {
            error_log('[NotificationService] SMTP send failed for ' . $to . ': ' . $e->getMessage());
        }
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $masked = strlen($local) > 2
            ? substr($local, 0, 2) . str_repeat('*', max(1, strlen($local) - 2))
            : str_repeat('*', strlen($local));
        return $masked . ($domain !== '' ? '@' . $domain : '');
    }
}
