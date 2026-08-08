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

    public function sendChecklistEmail(array $inquiry, string $phaseName, string $pdfPath, string $pdfName): void
    {
        $clientEmail = $inquiry['emailAddress'] ?? $inquiry['email'] ?? '';
        $clientName  = $inquiry['fullName'] ?? $inquiry['name'] ?? 'Client';
        
        if (!$clientEmail) {
            return;
        }

        $subject = "Your $phaseName Checklist - 1625 AutoLab";
        
        $body = '<div style="font-family: sans-serif; color: #333;">';
        $body .= '<p>Hi ' . htmlspecialchars($clientName) . ',</p>';
        $body .= '<p>Attached is your <strong>' . htmlspecialchars($phaseName) . ' Checklist</strong> for your recent service with us.</p>';
        $body .= '<p>If you have any questions, feel free to contact us.</p>';
        $body .= '<p>Best regards,<br>1625 AutoLab Team</p>';
        $body .= '</div>';

        $this->send($clientEmail, $clientName, $subject, $body, [
            ['path' => $pdfPath, 'name' => $pdfName]
        ]);
    }

    /**
     * Send a contact-form message to the admin inbox (1625autolab@gmail.com).
     *
     * @param array<string, string> $data
     */
    public function contactMessage(array $data): void
    {
        $adminEmail = defined('MAIL_ADMIN') ? MAIL_ADMIN : '1625autolab@gmail.com';
        $to      = explode(',', $adminEmail)[0];
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
        $this->send($to, $rawName !== '' ? $rawName : 'Customer', $emailSubject, $body);
    }

    /**
     * Send a new customer-inquiry email to the admin inbox.
     *
     * @param array<string, mixed> $inquiry
     */
    public function customerInquiryAdmin(array $inquiry): void
    {
        $recipients = $this->adminRecipients();
        if (count($recipients) === 0) {
            $recipients = defined('MAIL_ADMIN') ? explode(',', MAIL_ADMIN) : ['1625autolab@gmail.com'];
        }

        $s = $this->sanitizeInquiryData($inquiry);

        $name = htmlspecialchars($s['rawName']);
        $email = htmlspecialchars($s['rawEmail']);
        $phone = htmlspecialchars($s['rawPhone']);
        $product = htmlspecialchars($s['rawProduct']);
        $make = htmlspecialchars($s['rawMake']);
        $model = htmlspecialchars($s['rawModel'] === 'Other Model' ? $s['rawOtherModel'] : $s['rawModel']);
        $year = htmlspecialchars($s['rawYear']);
        $address = htmlspecialchars($s['rawAddress']);
        $facebook = htmlspecialchars($s['rawFacebook']);
        $appointmentDate = htmlspecialchars($s['rawDate'] !== '' ? $this->formatAppointmentDate($s['rawDate']) : '—');
        $appointmentTime = htmlspecialchars($s['rawTime'] !== '' ? $s['rawTime'] : '—');


        $body = $this->render('customer-inquiry-admin', [
            'name' => $name,
            'email' => $email,
            'phone' => $phone !== '' ? '<a href="tel:' . htmlspecialchars($s['rawPhone']) . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>' : '—',
            'product' => $product !== '' ? $product : '—',
            'make' => $make !== '' ? $make : '—',
            'model' => $model !== '' ? $model : '—',
            'year' => $year !== '' ? $year : '—',
            'address' => $address !== '' ? $address : '—',
            'plate' => $s['rawPlate'] !== '' ? htmlspecialchars($s['rawPlate']) : '—',
            'facebook' => $facebook !== '' ? $facebook : '—',
            'booking_date' => $appointmentDate,
            'booking_time' => $appointmentTime,

        ]);

        $this->sendToRecipients($recipients, 'New Customer Inquiry | 1625 Autolab', $body, 'Admin');
    }

    /**
     * Send a confirmation email to the customer who submitted an inquiry.
     *
     * @param array<string, mixed> $inquiry
     */
    public function customerInquiryCustomer(array $inquiry): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = strtolower(trim((string) ($inquiry['emailAddress'] ?? $inquiry['email'] ?? '')));
        if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $s = $this->sanitizeInquiryData($inquiry);

        $name = htmlspecialchars($s['rawName']);
        $email = htmlspecialchars($s['rawEmail']);
        $phone = htmlspecialchars($s['rawPhone']);
        $product = htmlspecialchars($s['rawProduct']);
        $make = htmlspecialchars($s['rawMake']);
        $model = htmlspecialchars($s['rawModel'] === 'Other Model' ? $s['rawOtherModel'] : $s['rawModel']);
        $year = htmlspecialchars($s['rawYear']);
        $address = htmlspecialchars($s['rawAddress']);
        $facebook = htmlspecialchars($s['rawFacebook']);
        $appointmentDate = htmlspecialchars($s['rawDate'] !== '' ? $this->formatAppointmentDate($s['rawDate']) : '—');
        $appointmentTime = htmlspecialchars($s['rawTime'] !== '' ? $s['rawTime'] : '—');


        $body = $this->render('customer-inquiry-customer', [
           'name' => $name,
            'email' => $email,
            'phone' => $phone !== '' ? '<a href="tel:' . htmlspecialchars($s['rawPhone']) . '" style="color:#f97316;text-decoration:none">' . $phone . '</a>' : '—',
            'product' => $product !== '' ? $product : '—',
            'make' => $make !== '' ? $make : '—',
            'model' => $model !== '' ? $model : '—',
            'year' => $year !== '' ? $year : '—',
            'address' => $address !== '' ? $address : '—',
            'plate' => $s['rawPlate'] !== '' ? htmlspecialchars($s['rawPlate']) : '—',
            'facebook' => $facebook !== '' ? $facebook : '—',
            'booking_date' => $appointmentDate,
            'booking_time' => $appointmentTime,
        ]);

        $subject = 'Thanks for your inquiry | 1625 Autolab';
        $this->send($customerEmail, $name !== '' ? $name : 'Customer', $subject, $body);
    }

    /**
     * Send a 3-hour prior appointment reminder email to the customer.
     *
     * @param array<string, mixed> $data
     */
    public function appointmentReminder3hCustomer(array $data): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = strtolower(trim((string) ($data['emailAddress'] ?? $data['email'] ?? '')));
        if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $rawName = str_replace(["\r", "\n"], '', (string) ($data['fullName'] ?? $data['name'] ?? ''));
        $rawProduct = str_replace(["\r", "\n"], '', (string) ($data['productToPurchase'] ?? $data['serviceName'] ?? $data['service_name'] ?? 'Appointment'));
        $rawMake = str_replace(["\r", "\n"], '', (string) ($data['make'] ?? ''));
        $rawModel = str_replace(["\r", "\n"], '', (string) ($data['model'] ?? ''));
        $rawVehicle = str_replace(["\r", "\n"], '', (string) ($data['vehicleInfo'] ?? $data['vehicle'] ?? ''));

        if ($rawVehicle === '' && ($rawMake !== '' || $rawModel !== '')) {
            $rawVehicle = trim($rawMake . ' ' . $rawModel);
        }

        $rawAppointmentDate = str_replace(["\r", "\n"], '', (string) ($data['appointmentDate'] ?? $data['appointment_date'] ?? ''));
        $rawAppointmentTime = str_replace(["\r", "\n"], '', (string) ($data['appointmentTime'] ?? $data['appointment_time'] ?? ''));

        $name = htmlspecialchars($rawName !== '' ? $rawName : 'Customer');
        $product = htmlspecialchars($rawProduct !== '' ? $rawProduct : 'Appointment Service');
        $vehicle = htmlspecialchars($rawVehicle !== '' ? $rawVehicle : '—');
        $appointmentDate = htmlspecialchars($rawAppointmentDate !== '' ? $this->formatAppointmentDate($rawAppointmentDate) : '—');
        $appointmentTime = htmlspecialchars($rawAppointmentTime !== '' ? $rawAppointmentTime : '—');

        $body = $this->render('appointment-reminder-3h-customer', [
            'name' => $name,
            'vehicle' => $vehicle,
            'product' => $product,
            'booking_date' => $appointmentDate,
            'booking_time' => $appointmentTime,
        ]);

        $subject = 'Appointment Reminder: Your appointment is in 3 hours | 1625 Autolab';
        $this->send($customerEmail, $name, $subject, $body);
    }

    /**
     * Send a 3-hour prior appointment reminder email to admins/owners.
     *
     * @param array<string, mixed> $data
     * @param array<int, string> $recipients
     */
    public function appointmentReminder3hAdmin(array $data, array $recipients = []): void
    {
        if (count($recipients) === 0) {
            $recipients = $this->adminRecipients();
            if (count($recipients) === 0) {
                $recipients = defined('MAIL_ADMIN') ? explode(',', MAIL_ADMIN) : ['1625autolab@gmail.com'];
            }
        }

        $rawName = str_replace(["\r", "\n"], '', (string) ($data['fullName'] ?? $data['name'] ?? 'Customer'));
        $rawEmail = str_replace(["\r", "\n"], '', (string) ($data['emailAddress'] ?? $data['email'] ?? ''));
        $rawPhone = str_replace(["\r", "\n"], '', (string) ($data['contactNumber'] ?? $data['phone'] ?? ''));
        $rawProduct = str_replace(["\r", "\n"], '', (string) ($data['productToPurchase'] ?? $data['serviceName'] ?? $data['service_name'] ?? 'Appointment'));
        $rawMake = str_replace(["\r", "\n"], '', (string) ($data['make'] ?? ''));
        $rawModel = str_replace(["\r", "\n"], '', (string) ($data['model'] ?? ''));
        $rawVehicle = str_replace(["\r", "\n"], '', (string) ($data['vehicleInfo'] ?? $data['vehicle'] ?? ''));

        if ($rawVehicle === '' && ($rawMake !== '' || $rawModel !== '')) {
            $rawVehicle = trim($rawMake . ' ' . $rawModel);
        }

        $rawAppointmentDate = str_replace(["\r", "\n"], '', (string) ($data['appointmentDate'] ?? $data['appointment_date'] ?? ''));
        $rawAppointmentTime = str_replace(["\r", "\n"], '', (string) ($data['appointmentTime'] ?? $data['appointment_time'] ?? ''));

        $name = htmlspecialchars($rawName);
        $email = htmlspecialchars($rawEmail !== '' ? $rawEmail : '—');
        $phone = htmlspecialchars($rawPhone !== '' ? $rawPhone : '—');
        $product = htmlspecialchars($rawProduct !== '' ? $rawProduct : 'Appointment Service');
        $vehicle = htmlspecialchars($rawVehicle !== '' ? $rawVehicle : '—');
        $appointmentDate = htmlspecialchars($rawAppointmentDate !== '' ? $this->formatAppointmentDate($rawAppointmentDate) : '—');
        $appointmentTime = htmlspecialchars($rawAppointmentTime !== '' ? $rawAppointmentTime : '—');

        $body = $this->render('appointment-reminder-3h-admin', [
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'vehicle' => $vehicle,
            'product' => $product,
            'booking_date' => $appointmentDate,
            'booking_time' => $appointmentTime,
        ]);

        $subject = 'Upcoming Appointment Reminder (In 3 Hours) | 1625 Autolab';
        $this->sendToRecipients($recipients, $subject, $body, 'Admin');
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
            $subject = 'Booking Confirmed | 1625 Autolab';
            $body    = $this->buildConfirmationBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if ($this->hasAdminRecipients()) {
            $subject = "New Booking: {$booking['serviceName']} | {$booking['name']}";
            $body    = $this->buildAdminNotificationBody($booking);
            $this->sendToAdmins($subject, $body);
        }
    }

    /**
     * Notify the customer that their service-request (inquiry) status has changed.
     *
     * Inquiry records use different field names than bookings
     * (emailAddress / fullName / contactNumber / make / model / productToPurchase).
     *
     * @param array<string, mixed> $inquiry
     */
    public function inquiryStatusChanged(array $inquiry): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = strtolower(trim((string) ($inquiry['emailAddress'] ?? $inquiry['email'] ?? '')));
        if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $s = $this->sanitizeInquiryData($inquiry);
        $status     = strtolower(trim((string) ($inquiry['status'] ?? 'pending')));

        $name    = htmlspecialchars($s['rawName'] !== '' ? $s['rawName'] : 'Customer');
        $phone   = htmlspecialchars($s['rawPhone']);
        $vehicle = htmlspecialchars(trim($s['rawMake'] . ' ' . $s['rawModel'] . ($s['rawYear'] !== '' ? ' (' . $s['rawYear'] . ')' : '')));
        $product = htmlspecialchars($s['rawProduct'] !== '' ? $s['rawProduct'] : '—');
        $date    = htmlspecialchars($s['rawDate'] !== '' ? $this->formatAppointmentDate($s['rawDate']) : '—');
        $time    = htmlspecialchars($s['rawTime'] !== '' ? $s['rawTime'] : '—');

        $statusMessages = [
            'confirmed'   => 'Your appointment is <strong style="color:#4ade80">confirmed</strong>. We look forward to seeing you!',
            'in_progress' => 'Our team has <strong style="color:#60a5fa">started working on your vehicle</strong>. We\'ll keep you posted.',
            'completed'   => 'Your service is <strong style="color:#34d399">complete</strong>! Thank you for trusting 1625 Autolab.',
            'cancelled'   => 'Your service request has been <strong style="color:#f87171">cancelled</strong>. If this was a mistake, feel free to reach out.',
            'pending'     => 'Your service request is currently <strong style="color:#fbbf24">pending review</strong>. We\'ll confirm your schedule shortly.',
        ];
        $statusMessage = $statusMessages[$status] ?? 'Your service request status has been updated. Contact us for details.';

        $statusColors = [
            'confirmed'   => '#4ade80',
            'in_progress' => '#60a5fa',
            'completed'   => '#34d399',
            'cancelled'   => '#f87171',
            'pending'     => '#fbbf24',
        ];
        $badgeColor = $statusColors[$status] ?? '#94a3b8';
        $statusLabel = ucwords(str_replace('_', ' ', $status));

        $phoneRow = $phone !== ''
            ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:140px">Phone</td>'
              . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">'
              . '<a href="tel:' . $phone . '" style="color:#f97316;text-decoration:none">' . $phone . '</a></td></tr>'
            : '';

        $vehicleRow = trim(str_replace('()', '', $vehicle)) !== ''
            ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Vehicle</td>'
              . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $vehicle . '</td></tr>'
            : '';

        $body = $this->render('inquiry-status-changed', [
            'name' => $name,
            'badge_color' => $badgeColor,
            'status_label' => $statusLabel,
            'status_message' => $statusMessage,
            'product' => $product,
            'vehicle_row_html' => $vehicleRow,
            'phone_row_html' => $phoneRow,
            'date' => $date,
            'time' => $time,
        ]);

        $subject = 'Service Request Update: ' . $statusLabel . ' | 1625 Autolab';
        $this->send($customerEmail, $s['rawName'] !== '' ? $s['rawName'] : 'Customer', $subject, $body);
    }

    /**
     * Send an email to the customer when their inquiry is rescheduled.
     *
     * @param array<string, mixed> $inquiry
     */
    public function inquiryRescheduledCustomer(array $inquiry): void
    {
        if (MAIL_FROM === '') return;

        $customerEmail = strtolower(trim((string) ($inquiry['emailAddress'] ?? $inquiry['email'] ?? '')));
        if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) return;

        $s = $this->sanitizeInquiryData($inquiry);
        $name    = htmlspecialchars($s['rawName'] !== '' ? $s['rawName'] : 'Customer');
        
        $date = htmlspecialchars($s['rawDate'] !== '' ? $this->formatAppointmentDate($s['rawDate']) : '—');
        $time = htmlspecialchars($s['rawTime'] !== '' ? $s['rawTime'] : '—');

        $body = $this->render('inquiry-rescheduled-customer', [
            'name' => $name,
            'date' => $date,
            'time' => $time,
        ]);

        $subject = 'Appointment Rescheduled | 1625 Autolab';
        $this->send($customerEmail, $name, $subject, $body);
    }

    /**
     * Send an email to the admin when an inquiry is rescheduled.
     *
     * @param array<string, mixed> $inquiry
     * @param array<string> $adminEmails
     */
    public function inquiryRescheduledAdmin(array $inquiry, array $adminEmails): void
    {
        if (MAIL_FROM === '' || count($adminEmails) === 0) return;

        $s = $this->sanitizeInquiryData($inquiry);
        $name    = htmlspecialchars($s['rawName'] !== '' ? $s['rawName'] : 'A customer');
        
        $date = htmlspecialchars($s['rawDate'] !== '' ? $this->formatAppointmentDate($s['rawDate']) : '—');
        $time = htmlspecialchars($s['rawTime'] !== '' ? $s['rawTime'] : '—');

        $body = $this->render('inquiry-rescheduled-admin', [
            'name' => $name,
            'date' => $date,
            'time' => $time,
        ]);

        $subject = '[Admin Alert] Appointment Rescheduled: ' . $name;
        foreach ($adminEmails as $email) {
            $this->send($email, 'Admin', $subject, $body);
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
            $subject = "Your Booking is $status | 1625 Autolab";
            $body    = $this->buildStatusUpdateBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if ($this->hasAdminRecipients()) {
            $status  = ucfirst((string) ($booking['status'] ?? ''));
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Status Updated: {$service} | {$name} ({$status})";
            $body    = $this->buildAdminStatusChangedBody($booking);
            $this->sendToAdmins($subject, $body);
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
            $subject = 'Job Update: Awaiting Parts | 1625 Autolab';
            $body    = $this->buildAwaitingPartsBody($booking);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if ($this->hasAdminRecipients()) {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Booking Awaiting Parts: {$service} | {$name}";
            $body    = $this->buildAdminAwaitingPartsBody($booking);
            $this->sendToAdmins($subject, $body);
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
            $subject = 'Build Update on Your Vehicle | 1625 Autolab';
            $body    = $this->buildProgressUpdateBody($booking, $update);
            $this->send($customerEmail, $customerName, $subject, $body);
        }

        if ($this->hasAdminRecipients()) {
            $service = (string) ($booking['serviceName'] ?? 'Service');
            $name    = (string) ($booking['name'] ?? 'Customer');
            $subject = "Build Progress Update Posted: {$service} | {$name}";
            $body    = $this->buildAdminBuildUpdateBody($booking, $update);
            $this->sendToAdmins($subject, $body);
        }
    }

    /**
     * Notify a customer that their order was received.
     *
     * @param array<string, mixed> $order
     */
    public function orderCreatedCustomer(array $order): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($order['customerEmail'] ?? '');
        $customerName = (string) ($order['customerName'] ?? 'Customer');
        if ($customerEmail === '') {
            return;
        }

        $this->send(
            $customerEmail,
            $customerName,
            'Order Received | 1625 Autolab',
            $this->buildOrderCreatedBody($order)
        );
    }

    /**
     * Notify a customer that their order status changed.
     *
     * @param array<string, mixed> $order
     */
    public function orderStatusChangedCustomer(array $order): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($order['customerEmail'] ?? '');
        $customerName = (string) ($order['customerName'] ?? 'Customer');
        if ($customerEmail === '') {
            return;
        }

        $label = ucwords(str_replace('_', ' ', (string) ($order['status'] ?? 'pending')));
        $this->send(
            $customerEmail,
            $customerName,
            'Order Status Updated: ' . $label . ' | 1625 Autolab',
            $this->buildOrderStatusBody($order)
        );
    }

    /**
     * Notify a customer that tracking details were updated.
     *
     * @param array<string, mixed> $order
     */
    public function orderTrackingUpdatedCustomer(array $order): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $customerEmail = (string) ($order['customerEmail'] ?? '');
        $customerName = (string) ($order['customerName'] ?? 'Customer');
        if ($customerEmail === '') {
            return;
        }

        $this->send(
            $customerEmail,
            $customerName,
            'Order Tracking Updated | 1625 Autolab',
            $this->buildOrderTrackingBody($order)
        );
    }

    /**
     * Send an email verification link.
     */
    public function sendEmailVerification(string $email, string $name, string $verifyUrl): void
    {
        if (MAIL_FROM === '') {
            return;
        }

        $to = strtolower(trim($email));
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $safeName = htmlspecialchars(trim($name) !== '' ? $name : 'there');
        $safeUrl = htmlspecialchars($verifyUrl);

        $body = $this->render('email-verification', [
            'name' => $safeName,
            'verify_url' => $safeUrl,
        ]);

        $this->send($to, trim($name) !== '' ? $name : 'Customer', 'Verify Your Email | 1625 Autolab', $body);
    }

    /**
     * Notify order managers that a new order was placed.
     *
     * @param array<string, mixed> $order
     * @param string[] $recipients
     */
    public function orderCreatedAdmin(array $order, array $recipients): void
    {
        if (MAIL_FROM === '' || count($recipients) === 0) {
            return;
        }

        $orderNumber = (string) ($order['orderNumber'] ?? '');
        $customerName = (string) ($order['customerName'] ?? 'Customer');
        $subject = 'New Order: ' . $orderNumber . ' | ' . $customerName;
        $body = $this->buildAdminNewOrderBody($order);

        $this->sendToRecipients($recipients, $subject, $body, 'Order Manager');
    }

    /**
     * Notify an assigned staff member about a new booking assignment.
     *
     * @param array<string, mixed> $booking
     */
    public function staffAssigned(array $booking, string $staffEmail, string $staffName): void
    {
        if (MAIL_FROM === '' || trim($staffEmail) === '') {
            return;
        }

        $subject = 'Booking Assigned To You | 1625 Autolab';
        $body = $this->buildStaffAssignedBody($booking, $staffName);
        $this->send($staffEmail, $staffName !== '' ? $staffName : 'Staff', $subject, $body);
    }

    /**
     * Send a generic marketing campaign email.
     */
    public function marketingCampaignMessage(
        string $email,
        string $name,
        string $title,
        string $message,
        string $ctaUrl = '',
        ?string $messageHtml = null
    ): void {
        if (MAIL_FROM === '' || trim($email) === '') {
            return;
        }

        $safeName = htmlspecialchars($name !== '' ? $name : 'Customer');
        $safeTitle = htmlspecialchars($title !== '' ? $title : 'Special Offer');
        $safeMessage = nl2br(htmlspecialchars($message));
        $safeMessageHtml = $this->sanitizeCampaignHtml($messageHtml ?? '');
        $safeCta = htmlspecialchars($ctaUrl);

        $ctaBlock = $safeCta !== ''
            ? '<p style="margin-top:24px"><a href="' . $safeCta . '" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Claim Offer</a></p>'
            : '';

        $body = $this->render('marketing-campaign-message', [
            'name' => $safeName,
            'title' => $safeTitle,
            'message' => $safeMessageHtml !== '' ? $safeMessageHtml : $safeMessage,
            'cta_block' => $ctaBlock,
        ]);

        $this->send($email, $safeName, $safeTitle . ' | 1625 Autolab', $body);
    }

    private function sanitizeCampaignHtml(string $html): string
    {
        $trimmed = trim($html);
        if ($trimmed === '') {
            return '';
        }

        $trimmed = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $trimmed) ?? '';
        $allowed = '<p><br><strong><b><em><i><u><ul><ol><li><a><h1><h2><h3><h4><blockquote><span><div>';
        $clean = strip_tags($trimmed, $allowed);

        return $clean;
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

        $this->send($email, 'Customer', 'Reset Your Password | 1625 Autolab', $body);
    }

    /**
     * Notify a waitlisted customer that their requested slot has opened up.
     */
    public function sendWaitlistSlotAvailable(
        string $name,
        string $email,
        string $date,
        string $time,
        string $claimUrl,
        int $claimWindowMinutes = 30
    ): void {
        if (MAIL_FROM === '' || $email === '') {
            return;
        }

        $safeName = htmlspecialchars($name);
        $safeDate = htmlspecialchars($date);
        $safeTime = htmlspecialchars($time);
        $safeClaimUrl = htmlspecialchars($claimUrl);
        $claimWindow = max(5, $claimWindowMinutes);

        $body = $this->render('waitlist-slot-available', [
            'name' => $safeName,
            'date' => $safeDate,
            'time' => $safeTime,
            'claim_window' => $claimWindow,
            'claim_url' => $safeClaimUrl,
        ]);

        $this->send($email, $name, "Slot Available: {$date} at {$time} | 1625 Autolab", $body);
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
            'completed'      => 'Your vehicle is <strong style="color:#34d399">ready for pickup</strong>! Thank you for trusting 1625 Autolab with your build.',
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

    /** @param array<string, mixed> $b */
    private function buildStaffAssignedBody(array $b, string $staffName): string
    {
        $name = htmlspecialchars($staffName !== '' ? $staffName : 'Team Member');
        $clientName = htmlspecialchars((string) ($b['name'] ?? 'Customer'));
        $service = htmlspecialchars((string) ($b['serviceName'] ?? 'Service'));
        $date = htmlspecialchars((string) ($b['appointmentDate'] ?? ''));
        $time = htmlspecialchars((string) ($b['appointmentTime'] ?? ''));
        $vehicle = htmlspecialchars((string) ($b['vehicleInfo'] ?? ''));
        $refNum = htmlspecialchars((string) ($b['referenceNumber'] ?? ''));
        $notes = nl2br(htmlspecialchars((string) ($b['notes'] ?? '')));

        $vehicleHtml = $vehicle !== ''
            ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Vehicle</td>'
              . '<td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $vehicle . '</td></tr>'
            : '';

        $notesHtml = trim((string) ($b['notes'] ?? '')) !== ''
            ? '<div style="background:#162032;border-left:3px solid #f97316;padding:12px 16px;margin:20px 0;border-radius:0 4px 4px 0">'
              . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#f97316;text-transform:uppercase">Booking Notes</p>'
              . '<p style="margin:0;color:#cbd5e1;font-size:14px">' . $notes . '</p></div>'
            : '';

        return '
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px">
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f97316;font-weight:700">1625 Autolab</p>
          <h2 style="margin:0 0 16px;font-size:24px;color:#ffffff">New Booking Assignment</h2>
          <p style="margin:0 0 16px;color:#cbd5e1">Hi ' . $name . ', you have been assigned to a booking.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #334155;border-radius:8px;overflow:hidden;background:#111827">
            <tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px;width:140px">Client</td><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $clientName . '</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Service</td><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $service . '</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#64748b;font-size:13px">Schedule</td><td style="padding:10px 16px;border-bottom:1px solid #334155;color:#f1f5f9">' . $date . ($time !== '' ? ' at ' . $time : '') . '</td></tr>
            ' . $vehicleHtml . '
            <tr><td style="padding:10px 16px;color:#64748b;font-size:13px">Reference #</td><td style="padding:10px 16px;color:#f97316;font-weight:700">' . $refNum . '</td></tr>
          </table>
          ' . $notesHtml . '
          <p style="margin:20px 0 0;color:#94a3b8;font-size:13px">Please review the booking details in the admin panel before the scheduled appointment.</p>
        </div>';
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

    /** @param array<string, mixed> $order */
    private function buildOrderCreatedBody(array $order): string
    {
        $name = htmlspecialchars((string) ($order['customerName'] ?? 'Customer'));
        $orderNumber = htmlspecialchars((string) ($order['orderNumber'] ?? ''));
        $status = (string) ($order['status'] ?? 'pending');
        $itemsHtml = $this->buildOrderItemsHtml($order, true);
        $deliveryHtml = $this->buildOrderDeliveryHtml($order);
        $notesHtml = $this->buildOrderNotesHtml($order, 'Order Notes');

        return $this->render('order-confirmation', [
            'name' => $name,
            'order_number' => $orderNumber,
            'status_badge' => $this->statusBadge($status),
            'fulfillment' => htmlspecialchars($this->labelOrderFulfillment((string) ($order['fulfillmentType'] ?? 'courier'))),
            'payment_status' => htmlspecialchars($this->labelOrderPayment((string) ($order['paymentStatus'] ?? 'unpaid'))),
            'subtotal' => htmlspecialchars($this->formatMoney((float) ($order['subtotal'] ?? 0))),
            'shipping_fee' => htmlspecialchars($this->formatMoney((float) ($order['shippingFee'] ?? 0))),
            'total_amount' => htmlspecialchars($this->formatMoney((float) ($order['totalAmount'] ?? 0))),
            'items_html' => $itemsHtml,
            'delivery_html' => $deliveryHtml,
            'notes_html' => $notesHtml,
        ]);
    }

    /** @param array<string, mixed> $order */
    private function buildOrderStatusBody(array $order): string
    {
        $name = htmlspecialchars((string) ($order['customerName'] ?? 'Customer'));
        $orderNumber = htmlspecialchars((string) ($order['orderNumber'] ?? ''));
        $status = (string) ($order['status'] ?? 'pending');
        $label = ucwords(str_replace('_', ' ', $status));

        $messages = [
            'pending' => 'We received your order and will review it shortly.',
            'confirmed' => 'Your order has been confirmed and is moving into processing.',
            'preparing' => 'We are preparing your order for pickup or delivery.',
            'ready_for_pickup' => 'Your order is ready for pickup.',
            'out_for_delivery' => 'Your order is already out for delivery.',
            'completed' => 'Your order has been completed. Thank you for your purchase.',
            'cancelled' => 'Your order has been cancelled. Contact us if you need assistance.',
        ];

        return $this->render('order-status', [
            'name' => $name,
            'order_number' => $orderNumber,
            'status_badge' => $this->statusBadge($status),
            'status_label' => htmlspecialchars($label),
            'status_message' => htmlspecialchars($messages[$status] ?? 'Your order status was updated.'),
            'fulfillment' => htmlspecialchars($this->labelOrderFulfillment((string) ($order['fulfillmentType'] ?? 'courier'))),
            'payment_status' => htmlspecialchars($this->labelOrderPayment((string) ($order['paymentStatus'] ?? 'unpaid'))),
            'total_amount' => htmlspecialchars($this->formatMoney((float) ($order['totalAmount'] ?? 0))),
            'tracking_html' => $this->buildOrderTrackingSummaryHtml($order),
        ]);
    }

    /** @param array<string, mixed> $order */
    private function buildOrderTrackingBody(array $order): string
    {
        $name = htmlspecialchars((string) ($order['customerName'] ?? 'Customer'));
        $orderNumber = htmlspecialchars((string) ($order['orderNumber'] ?? ''));
        $courierName = trim((string) ($order['courierName'] ?? 'Courier'));
        $trackingNumber = trim((string) ($order['trackingNumber'] ?? ''));

        return $this->render('order-tracking', [
            'name' => $name,
            'order_number' => $orderNumber,
            'courier_name' => htmlspecialchars($courierName !== '' ? $courierName : 'Courier'),
            'tracking_number' => htmlspecialchars($trackingNumber !== '' ? $trackingNumber : 'To be assigned'),
            'tracking_message' => htmlspecialchars(
                $trackingNumber !== ''
                    ? 'Use the tracking number below to follow your shipment.'
                    : 'Your order delivery details were updated. Tracking information will appear once assigned.'
            ),
            'status_badge' => $this->statusBadge((string) ($order['status'] ?? 'pending')),
            'delivery_html' => $this->buildOrderDeliveryHtml($order),
        ]);
    }

    /** @param array<string, mixed> $order */
    private function buildAdminNewOrderBody(array $order): string
    {
        $customerName = htmlspecialchars((string) ($order['customerName'] ?? 'Customer'));
        $customerEmail = htmlspecialchars((string) ($order['customerEmail'] ?? ''));
        $customerPhone = htmlspecialchars((string) ($order['customerPhone'] ?? ''));
        $orderNumber = htmlspecialchars((string) ($order['orderNumber'] ?? ''));
        $itemsHtml = $this->buildOrderItemsHtml($order, false);
        $notesHtml = $this->buildOrderNotesHtml($order, 'Customer Notes');

        return $this->render('admin-new-order', [
            'customer_name' => $customerName,
            'customer_email' => $customerEmail,
            'customer_phone' => $customerPhone,
            'order_number' => $orderNumber,
            'status_badge' => $this->statusBadge((string) ($order['status'] ?? 'pending')),
            'fulfillment' => htmlspecialchars($this->labelOrderFulfillment((string) ($order['fulfillmentType'] ?? 'courier'))),
            'payment_status' => htmlspecialchars($this->labelOrderPayment((string) ($order['paymentStatus'] ?? 'unpaid'))),
            'subtotal' => htmlspecialchars($this->formatMoney((float) ($order['subtotal'] ?? 0))),
            'shipping_fee' => htmlspecialchars($this->formatMoney((float) ($order['shippingFee'] ?? 0))),
            'total_amount' => htmlspecialchars($this->formatMoney((float) ($order['totalAmount'] ?? 0))),
            'items_html' => $itemsHtml,
            'delivery_html' => $this->buildOrderDeliveryHtml($order),
            'notes_html' => $notesHtml,
        ]);
    }

    /** @param array<string, mixed> $order */
    private function buildOrderItemsHtml(array $order, bool $withLineTotal): string
    {
        $items = is_array($order['items'] ?? null) ? $order['items'] : [];
        if (count($items) === 0) {
            return '<p style="margin:0;color:#94a3b8">No line items available.</p>';
        }

        $rows = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $name = htmlspecialchars((string) ($item['productName'] ?? 'Item'));
            $variation = trim((string) ($item['variationName'] ?? ''));
            $qty = (int) ($item['quantity'] ?? 1);
            $line = $withLineTotal
                ? '<span style="color:#f8fafc;font-weight:700">' . htmlspecialchars($this->formatMoney((float) ($item['subtotal'] ?? 0))) . '</span>'
                : '<span style="color:#cbd5e1">' . htmlspecialchars($this->formatMoney((float) ($item['unitPrice'] ?? 0))) . ' each</span>';
            $rows[] = '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #334155">'
                . '<div><p style="margin:0;color:#f8fafc;font-weight:600">' . $name . ($variation !== '' ? ' <span style="color:#94a3b8;font-weight:400">(' . htmlspecialchars($variation) . ')</span>' : '') . '</p>'
                . '<p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Qty: ' . $qty . '</p></div>'
                . $line
                . '</div>';
        }

        return '<div style="background:#111827;border:1px solid #334155;border-radius:8px;padding:0 16px">' . implode('', $rows) . '</div>';
    }

    /** @param array<string, mixed> $order */
    private function buildOrderDeliveryHtml(array $order): string
    {
        $fulfillment = (string) ($order['fulfillmentType'] ?? 'courier');
        $addressParts = array_values(array_filter([
            trim((string) ($order['deliveryAddress'] ?? '')),
            trim((string) ($order['deliveryCity'] ?? '')),
            trim((string) ($order['deliveryProvince'] ?? '')),
            trim((string) ($order['deliveryPostalCode'] ?? '')),
        ], static fn(string $value): bool => $value !== ''));

        if ($fulfillment !== 'courier') {
            return '<div style="background:#162032;border:1px solid #334155;border-radius:8px;padding:14px 16px;margin-top:20px">'
                . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase">Pickup</p>'
                . '<p style="margin:0;color:#e2e8f0">Walk-in pickup selected for this order.</p>'
                . '</div>';
        }

        if (count($addressParts) === 0) {
            return '';
        }

        return '<div style="background:#162032;border:1px solid #334155;border-radius:8px;padding:14px 16px;margin-top:20px">'
            . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase">Delivery Address</p>'
            . '<p style="margin:0;color:#e2e8f0">' . htmlspecialchars(implode(', ', $addressParts)) . '</p>'
            . '</div>';
    }

    /** @param array<string, mixed> $order */
    private function buildOrderNotesHtml(array $order, string $heading): string
    {
        $notes = trim((string) ($order['notes'] ?? ''));
        if ($notes === '') {
            return '';
        }

        return '<div style="background:#162032;border-left:3px solid #f97316;padding:12px 16px;margin-top:20px;border-radius:0 4px 4px 0">'
            . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#f97316;text-transform:uppercase">' . htmlspecialchars($heading) . '</p>'
            . '<p style="margin:0;color:#cbd5e1;font-size:14px">' . nl2br(htmlspecialchars($notes)) . '</p></div>';
    }

    /** @param array<string, mixed> $order */
    private function buildOrderTrackingSummaryHtml(array $order): string
    {
        $courierName = trim((string) ($order['courierName'] ?? ''));
        $trackingNumber = trim((string) ($order['trackingNumber'] ?? ''));
        if ($courierName === '' && $trackingNumber === '') {
            return '';
        }

        $summary = trim($courierName . ($courierName !== '' && $trackingNumber !== '' ? ' · ' : '') . $trackingNumber);
        return '<div style="background:#162032;border:1px solid #334155;border-radius:8px;padding:14px 16px;margin-top:20px">'
            . '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase">Tracking</p>'
            . '<p style="margin:0;color:#e2e8f0">' . htmlspecialchars($summary) . '</p>'
            . '</div>';
    }

    private function labelOrderFulfillment(string $type): string
    {
        return $type === 'walk_in' ? 'Walk-in Pickup' : 'Courier Delivery';
    }

    private function labelOrderPayment(string $status): string
    {
        if ($status === 'cod') {
            return 'Cash On Delivery';
        }

        return strtoupper($status);
    }

    private function formatMoney(float $amount): string
    {
        return 'PHP ' . number_format($amount, 2);
    }

    /** Generates a coloured status badge span for HTML emails. */
    private function statusBadge(string $status): string
    {
        $map = [
            'confirmed'      => ['#052e16', '#4ade80', '#166534'],
            'in_progress'    => ['#172554', '#60a5fa', '#1e40af'],
            'preparing'      => ['#172554', '#7dd3fc', '#0c4a6e'],
            'ready_for_pickup' => ['#2e1065', '#c4b5fd', '#6d28d9'],
            'out_for_delivery' => ['#083344', '#67e8f9', '#0e7490'],
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
    private function formatAppointmentDate(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '—';
        }

        $timestamp = strtotime($trimmed);
        if ($timestamp === false) {
            return htmlspecialchars($trimmed);
        }

        return htmlspecialchars(date('F j, Y', $timestamp));
    }

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

        $subject = 'Test Email | 1625 Autolab';
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

    private function send(string $to, string $toName, string $subject, string $htmlBody, array $attachments = []): void
    {
        if (defined('APP_ENV') && APP_ENV === 'development') {
            @error_log("[NotificationService] DEV MODE: Skipped sending email to {$to} - Subject: {$subject}");
            return;
        }

        if ($this->smtpConfigured()) {
            $this->sendViaSmtp($to, $toName, $subject, $htmlBody, $attachments);
            return;
        }

        $fromName = MAIL_FROM_NAME;
        $from     = MAIL_FROM;
        
        $domain   = isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] !== '' ? $_SERVER['SERVER_NAME'] : 'apollo.local';
        $messageId = sprintf('<%s.%s@%s>', uniqid('', true), time(), $domain);

        $headers  = implode("\r\n", [
            "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$from>",
            "Reply-To: $from",
            "Message-ID: $messageId",
            "List-Unsubscribe: <mailto:$from>",
            "Precedence: bulk",
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'X-Mailer: 1625-AutoLab',
        ]);

        @mail($to, $subject, $htmlBody, $headers);
    }

    private function sendToAdmins(string $subject, string $htmlBody): void
    {
        foreach ($this->adminRecipients() as $recipient) {
            $this->send($recipient, 'Admin', $subject, $htmlBody);
        }
    }

    /** @param string[] $recipients */
    private function sendToRecipients(array $recipients, string $subject, string $htmlBody, string $recipientName = 'Admin'): void
    {
        $unique = [];
        foreach ($recipients as $recipient) {
            $email = strtolower(trim($recipient));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            $unique[$email] = true;
        }

        foreach (array_keys($unique) as $email) {
            $this->send($email, $recipientName, $subject, $htmlBody);
        }
    }

    private function hasAdminRecipients(): bool
    {
        return count($this->adminRecipients()) > 0;
    }

    /** @return string[] */
    private function adminRecipients(): array
    {
        $parts = preg_split('/\s*,\s*/', (string) MAIL_ADMIN) ?: [];
        $emails = [];
        foreach ($parts as $part) {
            $email = trim($part);
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            $emails[] = strtolower($email);
        }

        return array_values(array_unique($emails));
    }

    private function smtpConfigured(): bool
    {
        return SMTP_HOST !== '';
    }

    private function sendViaSmtp(string $to, string $toName, string $subject, string $htmlBody, array $attachments = []): void
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

            $domain = isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] !== '' ? $_SERVER['SERVER_NAME'] : 'apollo.local';
            $mail->MessageID = sprintf('<%s.%s@%s>', uniqid('', true), time(), $domain);
            $mail->addCustomHeader('List-Unsubscribe', '<mailto:' . MAIL_FROM . '>');
            $mail->addCustomHeader('Precedence', 'bulk');

            $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
            $mail->addAddress($to, $toName);
            $mail->addReplyTo(MAIL_FROM, MAIL_FROM_NAME);
            $mail->Subject = $subject;
            $mail->isHTML(true);
            $mail->Body    = $htmlBody;
            
            foreach ($attachments as $attachment) {
                if (isset($attachment['path']) && file_exists($attachment['path'])) {
                    $name = $attachment['name'] ?? basename($attachment['path']);
                    $mail->addAttachment($attachment['path'], $name);
                }
            }
            
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
    /**
     * Sanitizes common inquiry fields.
     *
     * @param array<string, mixed> $inquiry
     * @return array<string, string>
     */
    private function sanitizeInquiryData(array $inquiry): array
    {
        return [
            'rawName'    => str_replace(["\r", "\n"], '', (string) ($inquiry['fullName'] ?? $inquiry['name'] ?? 'Customer')),
            'rawEmail'   => str_replace(["\r", "\n"], '', (string) ($inquiry['emailAddress'] ?? $inquiry['email'] ?? '')),
            'rawPhone'   => str_replace(["\r", "\n"], '', (string) ($inquiry['contactNumber'] ?? $inquiry['phone'] ?? '')),
            'rawMake'    => str_replace(["\r", "\n"], '', (string) ($inquiry['make'] ?? '')),
            'rawModel'   => str_replace(["\r", "\n"], '', (string) ($inquiry['model'] ?? '')),
            'rawYear'    => str_replace(["\r", "\n"], '', (string) ($inquiry['yearModel'] ?? '')),
            'rawProduct' => str_replace(["\r", "\n"], '', (string) ($inquiry['productToPurchase'] ?? '')),
            'rawDate'    => str_replace(["\r", "\n"], '', (string) ($inquiry['appointmentDate'] ?? '')),
            'rawTime'    => str_replace(["\r", "\n"], '', (string) ($inquiry['appointmentTime'] ?? '')),
            'rawAddress' => str_replace(["\r", "\n"], '', (string) ($inquiry['address'] ?? '')),
            'rawFacebook'=> str_replace(["\r", "\n"], '', (string) ($inquiry['facebookName'] ?? '')),
            'rawPlate'   => str_replace(["\r", "\n"], '', (string) ($inquiry['plateNumber'] ?? '')),
            'rawOtherModel'=> str_replace(["\r", "\n"], '', (string) ($inquiry['otherModel'] ?? '')),
        ];
    }
}
