<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(function (string $class): void {
    foreach ([__DIR__ . '/../Engine/', __DIR__ . '/../db/'] as $dir) {
        $file = $dir . $class . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

require_once __DIR__ . '/Configuration.php';

Cors::apply();

Session::startSession();


if (DB_NAME !== '') {
    Database::getInstance();
}
