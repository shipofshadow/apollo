<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

// ---------------------------------------------------------------------------
// Application constants – sourced from environment variables loaded by
// EnvLoader before this file is included.
// ---------------------------------------------------------------------------

define('FB_GRAPH_BASE', 'https://graph.facebook.com/v25.0');

define(
    'FB_POST_FIELDS',
    'id,message,created_time,full_picture,'
    . 'attachments{type,description,media,url,subattachments{type,media,url,description}},'
    . 'likes.summary(true).limit(0),'
    . 'comments.summary(true).limit(0),'
    . 'shares'
);

define('FB_ACCESS_TOKEN', $_ENV['FB_ACCESS_TOKEN'] ?? '');

define('CACHE_TTL_SECONDS', (int)($_ENV['CACHE_TTL_SECONDS'] ?? 60));

define('CORS_ORIGINS',
    array_values(
        array_filter(
            array_map('trim', explode(',', $_ENV['CORS_ORIGINS'] ?? 'http://localhost:5173,http://localhost:4173'))
        )
    )
);

// Public-facing URL of the frontend app, used for password reset links.
// Defaults to the first CORS origin when not explicitly set.
define('APP_URL', rtrim($_ENV['APP_URL'] ?? (CORS_ORIGINS[0] ?? 'http://localhost:5173'), '/'));

// ---------------------------------------------------------------------------
// Database constants
// ---------------------------------------------------------------------------

define('DB_HOST',    $_ENV['DB_HOST']     ?? 'localhost');
define('DB_PORT',    (int)($_ENV['DB_PORT'] ?? 3306));
define('DB_NAME',    $_ENV['DB_NAME']     ?? '');
define('DB_USER',    $_ENV['DB_USER']     ?? 'root');
define('DB_PASS',    $_ENV['DB_PASS']     ?? '');
define('DB_CHARSET', $_ENV['DB_CHARSET']  ?? 'utf8mb4');

// ---------------------------------------------------------------------------
// JWT constants
// ---------------------------------------------------------------------------

define('JWT_SECRET',     $_ENV['JWT_SECRET']      ?? '');
define('JWT_ALGORITHM',  $_ENV['JWT_ALGORITHM']   ?? 'HS256');
define('JWT_TTL',        (int)($_ENV['JWT_TTL']   ?? 3600));   // seconds

// ---------------------------------------------------------------------------
// Email / notification constants
// Set MAIL_FROM to enable transactional email via PHP mail().
// ---------------------------------------------------------------------------

define('MAIL_FROM',      $_ENV['MAIL_FROM']       ?? '');           // e.g. noreply@1625autolab.com
define('MAIL_FROM_NAME', $_ENV['MAIL_FROM_NAME']  ?? '1625 Auto Lab');
define('MAIL_ADMIN',     $_ENV['MAIL_ADMIN']       ?? '');           // admin notification recipient
define('SMTP_HOST',      trim((string) ($_ENV['SMTP_HOST'] ?? '')));
define('SMTP_PORT',      (int) ($_ENV['SMTP_PORT'] ?? 587));
define('SMTP_USERNAME',  (string) ($_ENV['SMTP_USERNAME'] ?? ''));
define('SMTP_PASSWORD',  (string) ($_ENV['SMTP_PASSWORD'] ?? ''));
define('SMTP_ENCRYPTION', strtolower(trim((string) ($_ENV['SMTP_ENCRYPTION'] ?? 'tls'))));
define('SMTP_AUTH',      filter_var($_ENV['SMTP_AUTH'] ?? 'true', FILTER_VALIDATE_BOOLEAN));
define('SMTP_TIMEOUT',   (int) ($_ENV['SMTP_TIMEOUT'] ?? 10));

// ---------------------------------------------------------------------------
// CarAPI – vehicle make / model / trim data
// Sign up at https://carapi.app and create an API token/secret pair.
// CARAPI_MAKES_TTL:  cache lifetime in seconds for makes  (default 86400 = 24 h)
// CARAPI_MODELS_TTL: cache lifetime in seconds for models (default 43200 = 12 h)
// ---------------------------------------------------------------------------

define('CARAPI_TOKEN',      $_ENV['CARAPI_TOKEN']      ?? '');
define('CARAPI_SECRET',     $_ENV['CARAPI_SECRET']     ?? '');
/** TTL in seconds for cached vehicle data (24 h for makes, 12 h for models) */
define('CARAPI_MAKES_TTL',  (int) ($_ENV['CARAPI_MAKES_TTL']  ?? 86400));
define('CARAPI_MODELS_TTL', (int) ($_ENV['CARAPI_MODELS_TTL'] ?? 43200));

// ---------------------------------------------------------------------------
// Media upload constants
// ---------------------------------------------------------------------------

define('FILESYSTEM_DISK', strtolower(trim($_ENV['FILESYSTEM_DISK'] ?? 'local')));
define('UPLOAD_DIR',      realpath(__DIR__ . '/../') . '/storage/uploads/');
define('UPLOAD_MAX_MB',   (int)($_ENV['UPLOAD_MAX_MB']  ?? 10));
define('UPLOAD_BASE_URL', rtrim($_ENV['UPLOAD_BASE_URL'] ?? '', '/'));

// ---------------------------------------------------------------------------
// Cloudflare R2 (S3-compatible object storage)
// Used when FILESYSTEM_DISK is set to "s3".
// ---------------------------------------------------------------------------

define('R2_ACCOUNT_ID',       $_ENV['R2_ACCOUNT_ID']       ?? '');
define('R2_ACCESS_KEY_ID',    $_ENV['R2_ACCESS_KEY_ID']     ?? '');
define('R2_SECRET_ACCESS_KEY',$_ENV['R2_SECRET_ACCESS_KEY'] ?? '');
define('R2_BUCKET_NAME',      $_ENV['R2_BUCKET_NAME']       ?? '');
define('R2_KEY_PREFIX',       rtrim($_ENV['R2_KEY_PREFIX']   ?? '1625autolab', '/') . '/');
define('R2_PUBLIC_URL',       rtrim($_ENV['R2_PUBLIC_URL']   ?? '', '/'));

// ---------------------------------------------------------------------------
// SMS (Twilio)
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM to enable SMS.
// ---------------------------------------------------------------------------

define('TWILIO_ACCOUNT_SID', $_ENV['TWILIO_ACCOUNT_SID'] ?? '');
define('TWILIO_AUTH_TOKEN',  $_ENV['TWILIO_AUTH_TOKEN']  ?? '');
define('TWILIO_FROM',        $_ENV['TWILIO_FROM']        ?? '');

// ---------------------------------------------------------------------------
// Cloudflare Turnstile
// TURNSTILE_SECRET_KEY: server-side secret from the Turnstile dashboard.
// Leave empty to skip validation (development only).
// ---------------------------------------------------------------------------

define('TURNSTILE_SECRET_KEY', $_ENV['TURNSTILE_SECRET_KEY'] ?? '');
define('TURNSTILE_BYPASS', filter_var($_ENV['TURNSTILE_BYPASS'] ?? 'false', FILTER_VALIDATE_BOOLEAN));

// ---------------------------------------------------------------------------
// Waitlist automation
// WAITLIST_CLAIM_TTL_MINUTES controls how long a notified customer has to
// claim a newly opened slot before the offer expires.
// ---------------------------------------------------------------------------

define('WAITLIST_CLAIM_TTL_MINUTES', (int)($_ENV['WAITLIST_CLAIM_TTL_MINUTES'] ?? 30));
