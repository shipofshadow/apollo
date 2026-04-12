# 1625 Auto Lab – PHP Backend

A lightweight PHP backend that proxies the **Facebook Graph API** so that the
page access token is never exposed in the browser, and provides the full
data API for the admin panel (bookings, services, portfolio, blog, products,
team members, testimonials, FAQ, site settings, shop hours, vehicle data,
and Facebook Page management).

Built with **OOP / PDO-style architecture** and managed with **Composer**.

## Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health-check |
| `GET` | `/api/posts` | Return recent Facebook page posts (cached) |
| `GET` | `/api/services` | List active services |
| `GET` | `/api/portfolio` | List active portfolio items |
| `GET` | `/api/products` | List active products |
| `GET` | `/api/blog` | List published blog posts |
| `GET` | `/api/testimonials` | List active testimonials |
| `GET` | `/api/faq` | List active FAQ items |
| `GET` | `/api/shop/hours` | Shop opening hours |
| `GET` | `/api/site-settings` | Public site settings |
| `GET` | `/api/team-members` | List active team members |
| `POST` | `/api/bookings` | Create a booking (auth optional) |
| `GET` | `/api/bookings/availability` | Available appointment slots |
| `POST` | `/api/auth/register` | Register a client account |
| `POST` | `/api/auth/login` | Log in and receive a JWT |

### Authenticated admin routes

All `/api/admin/*` and write routes on resources require an `Authorization: Bearer <token>` header with an admin-role JWT.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `POST` | `/api/admin/upload` | Upload a media file |
| `GET/POST` | `/api/admin/migrate` | Run/check DB migrations |
| `GET` | `/api/admin/fb/auth-url` | Start Facebook OAuth flow |
| `GET` | `/api/admin/fb/callback` | Exchange Facebook auth code for tokens |
| `GET` | `/api/admin/fb/pages` | List connected Facebook pages |
| `DELETE` | `/api/admin/fb/pages/{pageId}` | Disconnect a Facebook page |
| `POST` | `/api/admin/fb/publish` | Publish a post to a Facebook page |

## Requirements

- PHP 8.1 or newer
- Composer 2.x
- `curl` extension enabled (default in most PHP installations)
- MySQL / MariaDB 5.7+ (or leave `DB_NAME` empty to run without a database)
- A web server (Apache with `mod_rewrite`, or Nginx)

## Setup

```bash
cd backend

# 1. Install Composer dependencies
composer install

# 2. Configure environment variables
cp .env.example .env
# Edit .env and fill in all required values (see table below)

# 3. Run database migrations
php migrate.php
```

### Apache

The included `.htaccess` routes all requests to `index.php` automatically
(requires `mod_rewrite` to be enabled). Point your virtual host document root
at the `backend/` directory.

### Nginx

```nginx
root /path/to/backend;
index index.php;

location / {
    try_files $uri /index.php$is_args$args;
}

location ~ \.php$ {
    include fastcgi_params;
    fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
}
```

### Built-in PHP server (development only)

```bash
php -S localhost:8000
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Facebook feed** | | | |
| `FB_ACCESS_TOKEN` | ✅ | — | Static page access token for `/api/posts` |
| `CACHE_TTL_SECONDS` | ❌ | `3600` | Seconds to cache first-page `/api/posts` results |
| **Facebook Page management (admin OAuth)** | | | |
| `FB_APP_ID` | ✅ (for Connect Page) | — | Facebook App ID |
| `FB_APP_SECRET` | ✅ (for Connect Page) | — | Facebook App Secret – **keep private** |
| **Database** | | | |
| `DB_HOST` | ❌ | `localhost` | MySQL host |
| `DB_PORT` | ❌ | `3306` | MySQL port |
| `DB_NAME` | ✅ | — | Database name (leave empty to skip DB) |
| `DB_USER` | ❌ | `root` | Database user |
| `DB_PASS` | ❌ | _(empty)_ | Database password |
| `DB_CHARSET` | ❌ | `utf8mb4` | Database charset |
| **Authentication** | | | |
| `JWT_SECRET` | ✅ | — | Long random string used to sign JWTs – **keep private** |
| `JWT_ALGORITHM` | ❌ | `HS256` | JWT algorithm (`HS256`, `HS384`, `HS512`) |
| `JWT_TTL` | ❌ | `3600` | JWT lifetime in seconds |
| **CORS** | | | |
| `CORS_ORIGINS` | ❌ | `http://localhost:5173,http://localhost:4173` | Comma-separated allowed origins |
| **Email** | | | |
| `MAIL_FROM` | ❌ | _(empty)_ | From address for transactional emails |
| `MAIL_FROM_NAME` | ❌ | `1625 Auto Lab` | From display name |
| `MAIL_ADMIN` | ❌ | _(empty)_ | Admin notification recipient |
| `SMTP_HOST` | ❌ | _(empty)_ | SMTP server host (recommended for reliable delivery) |
| `SMTP_PORT` | ❌ | `587` | SMTP server port |
| `SMTP_USERNAME` | ❌ | _(empty)_ | SMTP username/login |
| `SMTP_PASSWORD` | ❌ | _(empty)_ | SMTP password/app password – **keep private** |
| `SMTP_ENCRYPTION` | ❌ | `tls` | SMTP transport security (`tls`, `ssl`, `none`) |
| `SMTP_AUTH` | ❌ | `true` | Enable SMTP authentication |
| `SMTP_TIMEOUT` | ❌ | `10` | SMTP timeout in seconds |
| **Vehicle data (CarAPI)** | | | |
| `CARAPI_TOKEN` | ✅ (for vehicle lookup) | — | CarAPI token |
| `CARAPI_SECRET` | ✅ (for vehicle lookup) | — | CarAPI secret |
| `CARAPI_MAKES_TTL` | ❌ | `86400` | Cache TTL for vehicle makes (seconds) |
| `CARAPI_MODELS_TTL` | ❌ | `43200` | Cache TTL for vehicle models (seconds) |
| **Media uploads** | | | |
| `FILESYSTEM_DISK` | ❌ | `local` | Upload disk driver: `local` or `s3` (Cloudflare R2) |
| `UPLOAD_MAX_MB` | ❌ | `10` | Max upload size in MB |
| `UPLOAD_BASE_URL` | ❌ | _(empty)_ | Public base URL for local uploads |
| **SMS (Semaphore, optional)** | | | |
| `SEMAPHORE_API_KEY` | ❌ | _(empty)_ | Semaphore API key – **keep private** |
| `SEMAPHORE_SENDER_NAME` | ❌ | `1625AutoLab` | Approved sender name in your Semaphore account |
| `SEMAPHORE_ADMIN_PHONE` | ❌ | _(empty)_ | Philippine mobile number to receive new-booking alerts |
| **Cloudflare R2 / S3 (used when `FILESYSTEM_DISK=s3`)** | | | |
| `R2_ACCOUNT_ID` | ❌ | _(empty)_ | Cloudflare account ID (enables R2 uploads) |
| `R2_ACCESS_KEY_ID` | ❌ | _(empty)_ | R2 API token key |
| `R2_SECRET_ACCESS_KEY` | ❌ | _(empty)_ | R2 API token secret – **keep private** |
| `R2_BUCKET_NAME` | ❌ | `chopaeng` | R2 bucket name |
| `R2_KEY_PREFIX` | ❌ | `chopaeng/1625autolab` | Object-key prefix |
| `R2_PUBLIC_URL` | ❌ | _(empty)_ | Public base URL for R2 files |

### Frontend env vars (see `../.env.example`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_BACKEND_URL` | ❌ | `http://localhost:8000` | Backend API URL |
| `VITE_FB_REDIRECT_URI` | ✅ (for Connect Page) | `<origin>/admin` | Facebook OAuth redirect URI – must be registered in your Facebook App |

## Project Structure

```
backend/
├── composer.json           # Composer manifest
├── composer.lock           # Locked dependency versions
├── index.php               # Thin entry point
├── migrate.php             # CLI migration runner
├── .htaccess               # Apache mod_rewrite catch-all + security headers
├── .env.example            # Environment variable template
├── config/
│   ├── Configuration.php   # Application constants (sourced from .env)
│   └── init.php            # Bootstrap: autoload → Dotenv → CORS → Session → DB
├── db/
│   └── Database.php        # PDO singleton
├── migrations/             # SQL migration files (run in order)
└── Engine/
    ├── Auth.php             # Argon2id passwords, JWT issuance/verification, blocklist
    ├── Cache.php            # TTL cache (APCu when available, file fallback)
    ├── Cors.php             # CORS header handling
    ├── FacebookPageService.php # Facebook OAuth flow + page token management
    ├── FacebookService.php  # Facebook Graph API feed client
    ├── Router.php           # Request router (FastRoute)
    ├── Session.php          # Secure session manager
    └── ...                  # Service classes for each resource
```

## Security Notes

- **Passwords** are hashed with **Argon2id** (PHP `PASSWORD_ARGON2ID`).
- **JWTs** are signed with `JWT_SECRET`; use a minimum 32-character random string.
- **Token revocation** – logout invalidates tokens via a SHA-256 hash in `token_blocklist`.
- **SQL injection** – all queries use PDO prepared statements with bound parameters.
- **CORS** – only origins listed in `CORS_ORIGINS` receive `Access-Control-Allow-Origin`.
- **Facebook OAuth** – state is generated by the frontend (`crypto.randomUUID()`), stored in `sessionStorage`, and validated on return to prevent CSRF. The backend callback endpoint requires a valid admin JWT.
- **`FB_APP_SECRET`** and **`JWT_SECRET`** must never be committed or logged.
- **Security headers** – `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are emitted by `.htaccess`. Enable `Strict-Transport-Security` in production.
- **HSTS** – uncomment the `Strict-Transport-Security` line in `.htaccess` when deployed behind TLS.
