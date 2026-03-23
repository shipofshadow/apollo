<?php

declare(strict_types=1);

// ---------------------------------------------------------------------------
// Application constants – sourced from environment variables loaded by
// EnvLoader before this file is included.
// ---------------------------------------------------------------------------

define('FB_GRAPH_BASE', 'https://graph.facebook.com/v25.0');

define(
    'FB_POST_FIELDS',
    'id,message,created_time,full_picture,'
    . 'attachments{description,media,url,subattachments},'
    . 'likes.summary(true).limit(0),'
    . 'comments.summary(true).limit(0),'
    . 'shares'
);

define('FB_ACCESS_TOKEN', $_ENV['FB_ACCESS_TOKEN'] ?? '');

define('CACHE_TTL_SECONDS', (int)($_ENV['CACHE_TTL_SECONDS'] ?? 60));

define(
    'CORS_ORIGINS',
    array_values(
        array_filter(
            array_map('trim', explode(',', $_ENV['CORS_ORIGINS'] ?? 'http://localhost:5173,http://localhost:4173'))
        )
    )
);

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

// ---------------------------------------------------------------------------
// API Ninjas – vehicle data
// Sign up at https://api-ninjas.com and set CARNINJA_API_KEY in your .env.
// ---------------------------------------------------------------------------

define('CARNINJA_API_KEY',  $_ENV['CARNINJA_API_KEY']  ?? '');
define('CARNINJA_BASE_URL', 'https://api.api-ninjas.com/v1');
/** TTL in seconds for cached vehicle data (24 h for makes, 12 h for models) */
define('CARNINJA_MAKES_TTL',  (int) ($_ENV['CARNINJA_MAKES_TTL']  ?? 86400));
define('CARNINJA_MODELS_TTL', (int) ($_ENV['CARNINJA_MODELS_TTL'] ?? 43200));

// ---------------------------------------------------------------------------
// Media upload constants
// ---------------------------------------------------------------------------

define('UPLOAD_DIR',      realpath(__DIR__ . '/../') . '/storage/uploads/');
define('UPLOAD_MAX_MB',   (int)($_ENV['UPLOAD_MAX_MB']  ?? 10));
define('UPLOAD_BASE_URL', rtrim($_ENV['UPLOAD_BASE_URL'] ?? '', '/'));

// ---------------------------------------------------------------------------
// Cloudflare R2 (S3-compatible object storage)
// When R2_ACCOUNT_ID is set uploads go to R2; otherwise they fall back to
// the local UPLOAD_DIR.
// ---------------------------------------------------------------------------

define('R2_ACCOUNT_ID',       $_ENV['R2_ACCOUNT_ID']       ?? '');
define('R2_ACCESS_KEY_ID',    $_ENV['R2_ACCESS_KEY_ID']     ?? '');
define('R2_SECRET_ACCESS_KEY',$_ENV['R2_SECRET_ACCESS_KEY'] ?? '');
define('R2_BUCKET_NAME',      $_ENV['R2_BUCKET_NAME']       ?? '');
define('R2_KEY_PREFIX',       rtrim($_ENV['R2_KEY_PREFIX']   ?? 'chopaeng/1625autolab', '/') . '/');
define('R2_PUBLIC_URL',       rtrim($_ENV['R2_PUBLIC_URL']   ?? '', '/'));
