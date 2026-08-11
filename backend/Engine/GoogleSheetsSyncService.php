<?php

declare(strict_types=1);

use GuzzleHttp\Client;

/**
 * GoogleSheetsSyncService
 *
 * Posts customer inquiry updates directly to a Google Sheets Apps Script Webhook URL.
 */
class GoogleSheetsSyncService
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'timeout' => 10,
            'http_errors' => false,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
        ]);
    }

    /**
     * Sends the inquiry data to the Google Sheets Webhook URL if configured.
     *
     * @param array<string, mixed> $inquiry
     */
    public static function syncInquiry(array $inquiry): void
    {
        try {
            $settings = (new SiteSettingsService())->getAll();
            $webhookUrl = trim((string) ($settings['google_sheets_webhook_url'] ?? ''));

            if ($webhookUrl === '') {
                return;
            }

            // Resolve service name if service_id is available
            $serviceName = '';
            $rawServiceId = $inquiry['serviceId'] ?? $inquiry['service_id'] ?? null;
            if ($rawServiceId !== null && DB_NAME !== '') {
                try {
                    $stmt = Database::getInstance()->prepare('SELECT title FROM services WHERE id = :id LIMIT 1');
                    $stmt->execute([':id' => (int) $rawServiceId]);
                    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $serviceName = (string) ($row['title'] ?? '');
                    }
                } catch (\Throwable) {
                    // Ignore service lookup failure
                }
            }

            if ($serviceName === '') {
                $serviceName = (string) ($inquiry['serviceName'] ?? $inquiry['service_name'] ?? $inquiry['service'] ?? '');
            }
            if ($serviceName === '') {
                $serviceName = (string) ($inquiry['productToPurchase'] ?? $inquiry['product_to_purchase'] ?? '');
            }

            $idVal = (string) ($inquiry['id'] ?? $inquiry['inquiryId'] ?? '');
            $refVal = (string) ($inquiry['referenceNumber'] ?? $inquiry['reference_number'] ?? '');
            $fullNameVal = (string) ($inquiry['fullName'] ?? $inquiry['full_name'] ?? '');
            $emailVal = (string) ($inquiry['emailAddress'] ?? $inquiry['email_address'] ?? '');
            $addressVal = (string) ($inquiry['address'] ?? '');
            $phoneVal = (string) ($inquiry['contactNumber'] ?? $inquiry['contact_number'] ?? '');
            $fbVal = (string) ($inquiry['facebookName'] ?? $inquiry['facebook_name'] ?? '');
            $makeVal = (string) ($inquiry['make'] ?? '');
            $modelVal = (string) ($inquiry['model'] ?? '');
            $yearVal = (string) ($inquiry['yearModel'] ?? $inquiry['year_model'] ?? $inquiry['year'] ?? '');
            $productVal = (string) ($inquiry['productToPurchase'] ?? $inquiry['product_to_purchase'] ?? '');
            $plateVal = (string) ($inquiry['plateNumber'] ?? $inquiry['plate_number'] ?? '');
            $dateVal = (string) ($inquiry['appointmentDate'] ?? $inquiry['appointment_date'] ?? '');
            $timeVal = (string) ($inquiry['appointmentTime'] ?? $inquiry['appointment_time'] ?? '');
            $statusVal = (string) ($inquiry['status'] ?? 'pending');
            $createdVal = (string) ($inquiry['createdAt'] ?? $inquiry['created_at'] ?? date('Y-m-d H:i:s'));
            $nowStr = date('Y-m-d H:i:s');

            $payload = [
                // Standard camelCase keys
                'id' => $idVal,
                'timestamp' => $createdVal,
                'fullName' => $fullNameVal,
                'emailAddress' => $emailVal,
                'address' => $addressVal,
                'contactNumber' => $phoneVal,
                'facebookName' => $fbVal,
                'make' => $makeVal,
                'model' => $modelVal,
                'yearModel' => $yearVal,
                'serviceName' => $serviceName,
                'productToPurchase' => $productVal,
                'plateNumber' => $plateVal,
                'appointmentDate' => $dateVal,
                'appointmentTime' => $timeVal,
                'status' => $statusVal,
                'lastUpdated' => $nowStr,
                'inquiryId' => $idVal,
                'referenceNumber' => $refVal,

                // Snake_case aliases
                'inquiry_id' => $idVal,
                'reference_number' => $refVal,
                'full_name' => $fullNameVal,
                'email_address' => $emailVal,
                'contact_number' => $phoneVal,
                'facebook_name' => $fbVal,
                'year_model' => $yearVal,
                'product_to_purchase' => $productVal,
                'plate_number' => $plateVal,
                'appointment_date' => $dateVal,
                'appointment_time' => $timeVal,
                'last_updated' => $nowStr,

                // Header Name Aliases for e.parameter / header-matching scripts
                'Timestamp' => $createdVal,
                'Full Name' => $fullNameVal,
                'Email address' => $emailVal,
                'Address' => $addressVal,
                'Contact Number' => $phoneVal,
                'Facebook Name' => $fbVal,
                'Car Make' => $makeVal,
                'Car Model' => $modelVal,
                'Year Model' => $yearVal,
                'Service Name' => $serviceName,
                'Product to Purchase' => $productVal,
                'Plate Number' => $plateVal,
                'Appointment Date' => $dateVal,
                'Appointment Time' => $timeVal,
                'Status' => $statusVal,
                'Last Updated' => $nowStr,
                'Inquiry ID' => $idVal,
                'Reference Number' => $refVal,
            ];

            $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $webhookUrl,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $jsonPayload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_POSTREDIR => 7, // Preserve POST method on redirect (CURL_REDIR_POST_ALL)
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json; charset=utf-8',
                    'Content-Length: ' . strlen($jsonPayload),
                ],
                CURLOPT_TIMEOUT => 15,
                CURLOPT_SSL_VERIFYPEER => false,
            ]);

            $response = curl_exec($ch);
            $curlError = curl_error($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($curlError !== '') {
                error_log('[GoogleSheetsSyncService] cURL error: ' . $curlError);
            } else {
                error_log("[GoogleSheetsSyncService] Webhook response ({$httpCode}): " . (string)$response);
            }
        } catch (\Throwable $e) {
            error_log('[GoogleSheetsSyncService] Webhook post failed: ' . $e->getMessage());
        }
    }

    /**
     * Test a webhook URL with a test payload.
     *
     * @return array<string, mixed>
     */
    public static function testWebhook(string $webhookUrl): array
    {
        $testPayload = [
            'timestamp' => date('Y-m-d H:i:s'),
            'fullName' => 'Test Customer',
            'emailAddress' => 'test@1625autolab.com',
            'address' => 'Test Address, San Fernando, Pampanga',
            'contactNumber' => '09123456789',
            'facebookName' => 'Test FB Profile',
            'make' => 'Toyota',
            'model' => 'Vios',
            'yearModel' => '2023',
            'serviceName' => 'Headlight Retrofit Test',
            'productToPurchase' => 'Headlight Retrofit Package',
            'plateNumber' => 'TEST-123',
            'appointmentDate' => date('Y-m-d'),
            'appointmentTime' => '10:00 AM',
            'status' => 'confirmed',
            'lastUpdated' => date('Y-m-d H:i:s'),
            'inquiryId' => 'test-id-0000',
            'referenceNumber' => '1625-TEST-0001',
        ];

        $jsonPayload = json_encode($testPayload, JSON_UNESCAPED_UNICODE);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $webhookUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json; charset=utf-8',
                'Content-Length: ' . strlen($jsonPayload),
            ],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlError !== '') {
            return ['success' => false, 'error' => 'cURL error: ' . $curlError];
        }

        $respStr = (string) $response;
        $isOk = $httpCode >= 200 && $httpCode < 400 && !str_contains($respStr, 'Hindi Nahanap ang Page') && !str_contains($respStr, 'drive.google.com');

        $errorMessage = null;
        if (!$isOk) {
            if (str_contains($respStr, 'Hindi Nahanap ang Page') || str_contains($respStr, 'drive.google.com') || $httpCode === 401 || $httpCode === 404) {
                $errorMessage = "Google Webhook Access Error (HTTP {$httpCode}): Please ensure your Google Apps Script Web App Deployment settings have 'Who has access' set to 'Anyone' and that your URL ends with '/exec'.";
            } else {
                $errorMessage = "Google Webhook Error (HTTP {$httpCode}).";
            }
        }

        return [
            'success' => $isOk,
            'httpCode' => $httpCode,
            'error' => $errorMessage,
            'response' => $respStr,
        ];
    }
}
