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

        $phoneRowHtml = $phone !== ''
            ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Phone</td>'
              . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">'
              . '<a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a></td></tr>'
            : '';

        $body = $this->render('contact-message', [
            'name'          => $name,
            'email'         => $email,
            'phone_row_html' => $phoneRowHtml,
            'subject'       => $subject,
            'message'       => $msgText,
        ]);

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
            $subject = 'Booking Confirmed | 1625 Auto Lab';
            $body    = $this->buildConfirmationBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $subject = "New Booking: {$booking['serviceName']} | {$booking['name']}";
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
            $subject = "Your Booking is $status | 1625 Auto Lab";
            $body    = $this->buildStatusUpdateBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $status  = ucfirst((string) ($booking['status'] ?? ''));
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Status Updated: {$service} | {$name} ({$status})";
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
            $subject = 'Job Update: Awaiting Parts | 1625 Auto Lab';
            $body    = $this->buildAwaitingPartsBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Awaiting Parts: {$service} | {$name}";
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
            $subject = 'Build Update on Your Vehicle | 1625 Auto Lab';
            $body    = $this->buildProgressUpdateBody($booking, $update);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if (MAIL_ADMIN !== '') {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Build Progress Update Posted: {$service} | {$name}";
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
        $body = $this->render('password-reset', [
            'reset_url' => $safeUrl,
        ]);

        $this->send($email, 'Customer', 'Reset Your Password | 1625 Auto Lab', $body);
    }

    // -------------------------------------------------------------------------
    // Email body builders
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $b */
    private function buildConfirmationBody(array $b): string
    {
        $name    = htmlspecialchars((string) ($b['name']            ?? ''));
        $service = htmlspecialchars((string) ($b['serviceName']     ?? ''));
        $date    = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time    = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $vehicle = htmlspecialchars((string) ($b['vehicleInfo']     ?? ''));
        $refNum  = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $notes   = htmlspecialchars((string) ($b['notes']           ?? ''));

        $variationsHtml = '';
        if (!empty($b['selectedVariations']) && is_array($b['selectedVariations'])) {
            $rows = [];
            foreach ($b['selectedVariations'] as $variation) {
                if (isset($variation['variationName'])) {
                    $rows[] = '<li style="margin:3px 0;color:#cbd5e1">' . htmlspecialchars($this->normalizeFancyText($variation['variationName'])) . '</li>';
                }
            }
            if ($rows) {
                $variationsHtml = '<tr>'
                    . '<td style="padding:10px 0;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:120px;vertical-align:top">Options</td>'
                    . '<td style="padding:10px 0;border-bottom:1px solid #334155">'
                    . '<ul style="margin:0;padding:0 0 0 16px">' . implode('', $rows) . '</ul></td></tr>';
            }
        }

        $notesHtml = $notes !== ''
            ? '<div style="background:#162032;border-left:3px solid #f97316;padding:12px 16px;margin:20px 0;border-radius:0 4px 4px 0">'
              . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#f97316;text-transform:uppercase">Your Notes</p>'
              . '<p style="margin:0;color:#cbd5e1;font-size:14px">' . $notes . '</p></div>'
            : '';

        return $this->render('booking-confirmation', [
            'name'            => $name,
            'service'         => $service,
            'variations_html' => $variationsHtml,
            'date'            => $date,
            'time'            => $time,
            'vehicle'         => $vehicle,
            'ref_num'         => $refNum,
            'notes_html'      => $notesHtml,
        ]);
    }

    /** @param array<string, mixed> $b */
    private function buildAdminNotificationBody(array $b): string
    {
        $name    = htmlspecialchars((string) ($b['name']            ?? '—'));
        $email   = htmlspecialchars((string) ($b['email']           ?? '—'));
        $phone   = htmlspecialchars((string) ($b['phone']           ?? ''));
        $service = htmlspecialchars((string) ($b['serviceName']     ?? '—'));
        $date    = htmlspecialchars((string) ($b['appointmentDate'] ?? '—'));
        $time    = htmlspecialchars((string) ($b['appointmentTime'] ?? '—'));
        $vehicle = htmlspecialchars((string) ($b['vehicleInfo']     ?? '—'));
        $refNum  = htmlspecialchars((string) ($b['referenceNumber'] ?? '—'));
        $source  = htmlspecialchars(ucfirst((string) ($b['source']  ?? 'website')));
        $notes   = nl2br(htmlspecialchars((string) ($b['notes']     ?? '')));

        $variationsHtml = '';
        if (!empty($b['selectedVariations']) && is_array($b['selectedVariations'])) {
            $names = array_column($b['selectedVariations'], 'variationName');
            $safe  = [];
            foreach ($names as $n) {
                $safe[] = htmlspecialchars($this->normalizeFancyText((string) $n));
            }
            if ($safe) {
                $variationsHtml = '<tr>'
                    . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:120px">Options</td>'
                    . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . implode(', ', $safe) . '</td></tr>';
            }
        }

        $phoneHtml = $phone !== ''
            ? ' &nbsp;&middot;&nbsp; <a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>'
            : '';

        $notesHtml = $notes !== ''
            ? '<div style="background:#162032;border-left:3px solid #f59e0b;padding:12px 16px;margin:20px 0;border-radius:0 4px 4px 0">'
              . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#f59e0b;text-transform:uppercase">Customer Notes</p>'
              . '<p style="margin:0;color:#fde68a;font-size:14px">' . $notes . '</p></div>'
            : '';

        return $this->render('admin-new-booking', [
            'name'            => $name,
            'ref_num'         => $refNum,
            'service'         => $service,
            'variations_html' => $variationsHtml,
            'date'            => $date,
            'time'            => $time,
            'vehicle'         => $vehicle,
            'email'           => $email,
            'phone_html'      => $phoneHtml,
            'source'          => $source,
            'notes_html'      => $notesHtml,
        ]);
    }

    /** @param array<string, mixed> $b */
    private function buildStatusUpdateBody(array $b): string
    {
        $name    = htmlspecialchars((string) ($b['name']            ?? ''));
        $status  = (string) ($b['status'] ?? '');
        $service = htmlspecialchars((string) ($b['serviceName']     ?? ''));
        $date    = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time    = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $vehicle = htmlspecialchars((string) ($b['vehicleInfo']     ?? ''));
        $refNum  = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $badge   = $this->statusBadge($status);

        $messages = [
            'confirmed'      => 'Your appointment is <strong style="color:#4ade80">confirmed</strong>. We look forward to seeing you and your vehicle!',
            'in_progress'    => 'Our technicians have <strong style="color:#60a5fa">started working on your vehicle</strong>. We\'ll keep you posted on progress.',
            'completed'      => 'Your vehicle is <strong style="color:#34d399">ready for pickup</strong>! Thank you for trusting 1625 Auto Lab with your build.',
            'cancelled'      => 'Your booking has been <strong style="color:#f87171">cancelled</strong>. If this was a mistake or you\'d like to rebook, feel free to contact us.',
            'awaiting_parts' => 'Your job is currently <strong style="color:#fb923c">on hold</strong> while we wait for parts. We\'ll notify you as soon as work resumes.',
        ];
        $key     = strtolower(str_replace(' ', '_', $status));
        $message = $messages[$key] ?? 'Your booking status has been updated. Contact us for details.';

                $dateRowHtml = $date
                        ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:120px">Date</td>'
                            . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $date . ($time ? ' &middot; ' . $time : '') . '</td></tr>'
                        : '';
                $vehicleRowHtml = $vehicle
                        ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Vehicle</td>'
                            . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $vehicle . '</td></tr>'
                        : '';
                $refRowHtml = $refNum
                        ? '<tr><td style="padding:10px 16px;color:#64748b;font-size:13px">Reference #</td>'
                            . '<td style="padding:10px 16px;color:#f97316;font-weight:700">' . $refNum . '</td></tr>'
                        : '';

                return $this->render('booking-status', [
                        'name'            => $name,
                        'status_badge'    => $badge,
                        'status_message'  => $message,
                        'service'         => $service,
                        'date_row_html'   => $dateRowHtml,
                        'vehicle_row_html' => $vehicleRowHtml,
                        'ref_row_html'    => $refRowHtml,
                ]);
    }

    /** @param array<string, mixed> $b */
    private function buildAwaitingPartsBody(array $b): string
    {
        $name    = htmlspecialchars((string) ($b['name']        ?? ''));
        $service = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $notes   = nl2br(htmlspecialchars((string) ($b['partsNotes'] ?? 'No additional details provided.')));
        $refNum  = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));

        $refParaHtml = $refNum !== ''
            ? '<p style="margin:8px 0 0;font-size:12px;color:#475569">Reference: <strong style="color:#64748b">' . $refNum . '</strong></p>'
            : '';

        return $this->render('booking-awaiting-parts', [
            'name'         => $name,
            'service'      => $service,
            'parts_notes'  => $notes,
            'ref_para_html' => $refParaHtml,
        ]);
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
        $refNum  = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));

        $photoUrls = is_array($u['photoUrls'] ?? null) ? $u['photoUrls'] : [];
        $photosHtml = '';
        if ($photoUrls) {
            $photosHtml = '<p style="margin:20px 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase">Build Photos</p>'
                . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>';
            $col = 0;
            foreach ($photoUrls as $url) {
                $safeUrl = htmlspecialchars((string) $url);
                if ($col > 0 && $col % 2 === 0) {
                    $photosHtml .= '</tr><tr>';
                }
                $photosHtml .= '<td style="padding:4px;width:50%">'
                    . '<a href="' . $safeUrl . '">'
                    . '<img src="' . $safeUrl . '" alt="Build photo" style="width:100%;max-width:240px;border-radius:6px;display:block;border:1px solid #334155">'
                    . '</a></td>';
                $col++;
            }
            $photosHtml .= '</tr></table>';
        }

        $noteHtml = $note !== ''
            ? '<div style="background:#162032;border-left:3px solid #3b82f6;padding:14px 18px;margin-bottom:20px;border-radius:0 6px 6px 0">'
              . '<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#60a5fa;text-transform:uppercase">Technician Note</p>'
              . '<p style="margin:0;font-size:14px;color:#bfdbfe;white-space:pre-wrap">' . $note . '</p></div>'
            : '';

        $refHtml = $refNum !== ''
            ? '<p style="margin:4px 0 0;font-size:12px;color:#475569">Reference: <strong style="color:#64748b">' . $refNum . '</strong></p>'
            : '';

        return $this->render('build-update', [
            'name'       => $name,
            'service'    => $service,
            'note_html'  => $noteHtml,
            'photos_html' => $photosHtml,
            'posted_at'  => $date,
            'ref_html'   => $refHtml,
        ]);
    }

    /** @param array<string, mixed> $b */
    private function buildAdminStatusChangedBody(array $b): string
    {
        $name      = htmlspecialchars((string) ($b['name']            ?? ''));
        $email     = htmlspecialchars((string) ($b['email']           ?? ''));
        $phone     = htmlspecialchars((string) ($b['phone']           ?? ''));
        $service   = htmlspecialchars((string) ($b['serviceName']     ?? ''));
        $status    = (string) ($b['status'] ?? '');
        $date      = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time      = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $bookingId = htmlspecialchars((string) ($b['id']              ?? ''));
        $refNum    = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $badge     = $this->statusBadge($status);
        $phoneHtml = $phone !== ''
            ? ' &nbsp;&middot;&nbsp; <a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>'
            : '';

        return $this->render('admin-status-changed', [
            'status_badge' => $badge,
            'name'         => $name,
            'email'        => $email,
            'phone_html'   => $phoneHtml,
            'service'      => $service,
            'date'         => $date,
            'time'         => $time,
            'ref_num'      => $refNum,
            'booking_id'   => $bookingId,
        ]);
    }

    /** @param array<string, mixed> $b */
    private function buildAdminAwaitingPartsBody(array $b): string
    {
        $name      = htmlspecialchars((string) ($b['name']        ?? ''));
        $email     = htmlspecialchars((string) ($b['email']       ?? ''));
        $phone     = htmlspecialchars((string) ($b['phone']       ?? ''));
        $service   = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $notes     = nl2br(htmlspecialchars((string) ($b['partsNotes'] ?? 'No additional details provided.')));
        $bookingId = htmlspecialchars((string) ($b['id']          ?? ''));
        $refNum    = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $phoneHtml = $phone !== ''
            ? ' &nbsp;&middot;&nbsp; <a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>'
            : '';

        return $this->render('admin-awaiting-parts', [
            'name'        => $name,
            'email'       => $email,
            'phone_html'  => $phoneHtml,
            'service'     => $service,
            'ref_num'     => $refNum,
            'booking_id'  => $bookingId,
            'parts_notes' => $notes,
        ]);
    }

    /**
     * @param array<string, mixed> $b
     * @param array<string, mixed> $u
     */
    private function buildAdminBuildUpdateBody(array $b, array $u): string
    {
        $name      = htmlspecialchars((string) ($b['name']        ?? ''));
        $email     = htmlspecialchars((string) ($b['email']       ?? ''));
        $phone     = htmlspecialchars((string) ($b['phone']       ?? ''));
        $service   = htmlspecialchars((string) ($b['serviceName'] ?? ''));
        $bookingId = htmlspecialchars((string) ($b['id']          ?? ''));
        $refNum    = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $note      = nl2br(htmlspecialchars((string) ($u['note']  ?? '')));
        $date      = htmlspecialchars((string) ($u['createdAt']   ?? ''));
        $phoneHtml = $phone !== ''
            ? ' &nbsp;&middot;&nbsp; <a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>'
            : '';

        $variationsHtml = '';
        if (!empty($b['selectedVariations']) && is_array($b['selectedVariations'])) {
            $rows = [];
            foreach ($b['selectedVariations'] as $variation) {
                if (isset($variation['variationName'])) {
                    $rows[] = htmlspecialchars($this->normalizeFancyText($variation['variationName']));
                }
            }
            if ($rows) {
                $variationsHtml = '<tr>'
                    . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:120px">Options</td>'
                    . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . implode(', ', $rows) . '</td></tr>';
            }
        }

        $photoUrls = is_array($u['photoUrls'] ?? null) ? $u['photoUrls'] : [];
        $photosHtml = '';
        if ($photoUrls) {
            $items = '';
            foreach ($photoUrls as $url) {
                $safeUrl = htmlspecialchars((string) $url);
                $items .= '<li style="margin:4px 0"><a href="' . $safeUrl . '" style="color:#f97316;text-decoration:none;font-size:13px;word-break:break-all">' . $safeUrl . '</a></li>';
            }
            $photosHtml = '<div style="background:#162032;border:1px solid #334155;border-radius:6px;padding:14px 18px;margin-top:16px">'
                . '<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;text-transform:uppercase">Attached Photos</p>'
                . '<ul style="margin:0;padding:0 0 0 16px">' . $items . '</ul></div>';
        }

        $noteHtml = $note !== ''
            ? '<div style="background:#162032;border-left:3px solid #3b82f6;padding:14px 18px;margin-bottom:16px;border-radius:0 6px 6px 0">'
              . '<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#60a5fa;text-transform:uppercase">Update Note</p>'
              . '<p style="margin:0;font-size:14px;color:#bfdbfe;white-space:pre-wrap">' . $note . '</p></div>'
            : '';

        return $this->render('admin-build-update', [
            'name'            => $name,
            'email'           => $email,
            'phone_html'      => $phoneHtml,
            'service'         => $service,
            'variations_html' => $variationsHtml,
            'ref_num'         => $refNum,
            'booking_id'      => $bookingId,
            'posted_at'       => $date,
            'note_html'       => $noteHtml,
            'photos_html'     => $photosHtml,
        ]);
    }

    /** Generates a coloured status badge span for HTML emails. */
    private function statusBadge(string $status): string
    {
        $map = [
            'confirmed'      => ['#052e16', '#4ade80', '#166534'],
            'in_progress'    => ['#172554', '#60a5fa', '#1e40af'],
            'completed'      => ['#052e16', '#34d399', '#065f46'],
            'cancelled'      => ['#450a0a', '#f87171', '#7f1d1d'],
            'awaiting_parts' => ['#431407', '#fb923c', '#7c2d12'],
            'pending'        => ['#451a03', '#fbbf24', '#78350f'],
        ];
        $key   = strtolower(str_replace(' ', '_', $status));
        $c     = $map[$key] ?? ['#1e293b', '#94a3b8', '#334155'];
        $label = htmlspecialchars(ucwords(str_replace('_', ' ', $status)));
        return '<span style="background:' . $c[0] . ';color:' . $c[1] . ';border:1px solid ' . $c[2]
            . ';font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;'
            . 'letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif">'
            . $label . '</span>';
    }

    /**
     * Render an email template, injecting variables for {{ key }} placeholders.
     * The content template is wrapped in backend/templates/email/layout.html.
     *
     * @param string               $template Template filename without .html (e.g. 'booking-confirmation')
     * @param array<string, string> $vars     Map of placeholder name → value (values must already be HTML-safe)
     */
    private function render(string $template, array $vars): string
    {
        static $layout = null;
        $dir = __DIR__ . '/../templates/email/';

        if ($layout === null) {
            $layout = (string) file_get_contents($dir . 'layout.html');
        }

        $tplFile = $dir . $template . '.html';
        $content = file_exists($tplFile) ? (string) file_get_contents($tplFile) : '';

        foreach ($vars as $key => $value) {
            $content = str_replace('{{ ' . $key . ' }}', $value, $content);
        }

        // Remove any unfilled placeholders so they don't leak into the email
        $content = (string) preg_replace('/\{\{\s*\w[\w_]*\s*\}\}/', '', $content);

        return str_replace('{{ body }}', $content, $layout);
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
                'reason'    => 'No recipient | set MAIL_ADMIN in .env or supply a recipient',
            ];
        }

        $subject = 'Test Email | 1625 Auto Lab';
        $body = $this->render('test-email', [
            'sent_at' => date('Y-m-d H:i:s'),
        ]);

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

    /**
     * Converts "fancy" Unicode (bold/italic/serif) back to standard plain text.
     * Useful for email clients that choke on mathematical alphanumeric symbols.
     */
    private function normalizeFancyText(string $text): string
    {
        // Map for Bold Sans-Serif (which your output seems to use)
        // You can expand this map if you use other styles (italics, etc.)
        $search  = [
            '/[\x{1D5D4}-\x{1D5ED}]/u', // A-Z (Bold Sans)
            '/[\x{1D5EE}-\x{1D607}]/u', // a-z (Bold Sans)
            '/[\x{1D7EC}-\x{1D7F5}]/u', // 0-9 (Bold Sans)
        ];

        return preg_replace_callback($search, function ($match) {
            $char = $match[0];
            $code = mb_ord($char, 'UTF-8');

            if ($code >= 0x1D5D4 && $code <= 0x1D5ED) return chr($code - 0x1D5D4 + 65);  // A-Z
            if ($code >= 0x1D5EE && $code <= 0x1D607) return chr($code - 0x1D5EE + 97);  // a-z
            if ($code >= 0x1D7EC && $code <= 0x1D7F5) return chr($code - 0x1D7EC + 48);  // 0-9
            
            return $char;
        }, $text);
    }
}
