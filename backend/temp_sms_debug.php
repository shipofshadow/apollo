<?php
require __DIR__ . '/config/init.php';
require_once __DIR__ . '/Engine/SmsService.php';

echo 'DEFINED_SEMAPHORE_API_KEY=' . (defined('SEMAPHORE_API_KEY') ? 'yes' : 'no') . "\n";
if (defined('SEMAPHORE_API_KEY')) {
    echo 'SEMAPHORE_API_KEY=' . substr(SEMAPHORE_API_KEY, 0, 8) . '...' . "\n";
}
echo 'SEMAPHORE_SENDER_NAME=' . (defined('SEMAPHORE_SENDER_NAME') ? SEMAPHORE_SENDER_NAME : '(unset)') . "\n";

$s = new SmsService();
$reflect = new ReflectionClass($s);
$prop = $reflect->getProperty('enabled');
$prop->setAccessible(true);
echo 'SmsService.enabled=' . ($prop->getValue($s) ? 'true' : 'false') . "\n";
$prop2 = $reflect->getProperty('apiKey');
$prop2->setAccessible(true);
echo 'SmsService.apiKey=' . ($prop2->getValue($s) === '' ? '(empty)' : substr($prop2->getValue($s),0,8) . '...') . "\n";
$prop3 = $reflect->getProperty('senderName');
$prop3->setAccessible(true);
echo 'SmsService.senderName=' . $prop3->getValue($s) . "\n";

$apiKey = SEMAPHORE_API_KEY;
$sender = SEMAPHORE_SENDER_NAME;
$number = '639171234567';
$message = 'Test SMS from local debug run.';

$client = new GuzzleHttp\Client(['timeout' => 15, 'http_errors' => false]);
$response = $client->post('https://api.semaphore.co/api/v4/messages', [
    'form_params' => [
        'apikey' => $apiKey,
        'number' => $number,
        'message' => $message,
        'sendername' => $sender,
    ],
]);

$status = $response->getStatusCode();
$body = (string) $response->getBody();
$decoded = json_decode($body, true);

echo "HTTP_STATUS={$status}\n";
echo "BODY_RAW={$body}\n";
echo "BODY_JSON=" . var_export($decoded, true) . "\n";
