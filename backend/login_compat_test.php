<?php
require __DIR__ . '/config/init.php';
try {
    $email = 'admin@1625autolab.com';
    $result = (new UserService())->login($email, 'admin12345');
    $security = new AuthSecurityService();
    $payload = Auth::decodeToken((string)($result['token'] ?? ''));
    $uid = (int)($payload['sub'] ?? 0);
    $exp = (int)($payload['exp'] ?? (time() + JWT_TTL));

    $security->recordLoginAttempt($email, true, $uid > 0 ? $uid : null, '127.0.0.1', 'cli', 'manual flow');
    if ($uid > 0) {
        $security->createSession($uid, (string)$result['token'], $exp, '127.0.0.1', 'cli');
    }

    echo "ok\n";
} catch (Throwable $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
