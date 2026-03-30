<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Manila');

// ---------------------------------------------------------------------------
// 1. Composer autoloader – covers vendor packages AND our Engine/ classes
// ---------------------------------------------------------------------------

require_once __DIR__ . '/../vendor/autoload.php';

// Fallback autoloader: loads Engine/ and db/ classes by filename so a stale
// composer classmap (e.g. after adding a new service file) never causes a
// "Class not found" error.
spl_autoload_register(function (string $class): void {
    foreach ([__DIR__ . '/../Engine/', __DIR__ . '/../db/'] as $dir) {
        $file = $dir . $class . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// ---------------------------------------------------------------------------
// 2. Load .env using vlucas/phpdotenv
// ---------------------------------------------------------------------------

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// ---------------------------------------------------------------------------
// 3. Define application constants from the loaded environment
// ---------------------------------------------------------------------------

require_once __DIR__ . '/Configuration.php';

// ---------------------------------------------------------------------------
// 4. Apply CORS headers and handle OPTIONS preflight
// ---------------------------------------------------------------------------

Cors::apply();

// ---------------------------------------------------------------------------
// 5. Start session
// ---------------------------------------------------------------------------

Session::startSession();

// ---------------------------------------------------------------------------
// 6. Database connection (lazy singleton – available anywhere via
//    Database::getInstance())
// ---------------------------------------------------------------------------

if (DB_NAME !== '') {
    Database::getInstance();
}
