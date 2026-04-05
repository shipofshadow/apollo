<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;

/**
 * Authentication class.
 *
 * Handles password hashing (Argon2id), JWT issuance / verification, and the
 * database-backed login / register / logout operations.
 *
 * Password hashing  → PHP built-in password_hash() with PASSWORD_ARGON2ID
 * Token format      → JWT (firebase/php-jwt), algorithm from JWT_ALGORITHM
 * Token lifetime    → JWT_TTL seconds (default 3600)
 * Token revocation  → SHA-256 hash stored in the token_blocklist table
 *
 * Usage:
 *   // Hash a password before storing
 *   $hash = Auth::hashPassword($plaintext);
 *
 *   // Verify a login attempt
 *   if (Auth::verifyPassword($plaintext, $storedHash)) { ... }
 *
 *   // Issue a token after successful login
 *   $token = Auth::issueToken(['user_id' => 42, 'role' => 'admin']);
 *
 *   // Decode & validate an incoming token
 *   $payload = Auth::decodeToken($token);
 *
 *   // Full login flow (DB-backed)
 *   $token = Auth::login(['email' => '...', 'password' => '...']);
 *
 *   // Registration (DB-backed)
 *   Auth::register(['name' => '...', 'email' => '...', 'password' => '...']);
 *
 *   // Invalidate a token
 *   Auth::logout($token);
 */
class Auth
{
    // -------------------------------------------------------------------------
    // Password helpers  (Argon2id)
    // -------------------------------------------------------------------------

    /**
     * Hash a plaintext password using Argon2id.
     */
    public static function hashPassword(string $plaintext): string
    {
        return password_hash($plaintext, PASSWORD_ARGON2ID);
    }

    /**
     * Verify a plaintext password against a stored Argon2id hash.
     */
    public static function verifyPassword(string $plaintext, string $hash): bool
    {
        return password_verify($plaintext, $hash);
    }

    /**
     * Return true if the stored hash needs to be rehashed
     * (e.g. after a cost-factor change).
     */
    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID);
    }

    // -------------------------------------------------------------------------
    // JWT helpers
    // -------------------------------------------------------------------------

    /**
     * Issue a signed JWT for the given payload claims.
     *
     * Standard claims (iat, exp) are added automatically.
     *
     * @param  array<string, mixed> $claims  Application-specific claims.
     * @param  int $ttl Optional custom TTL in seconds. Defaults to JWT_TTL.
     * @throws RuntimeException  If JWT_SECRET is not configured.
     */
    public static function issueToken(array $claims, int $ttl = 0): string
    {
        if (JWT_SECRET === '') {
            throw new RuntimeException('JWT_SECRET is not configured on the server.', 500);
        }

        if ($ttl === 0) {
            $ttl = JWT_TTL;
        }

        $now     = time();
        $payload = array_merge($claims, [
            'iat' => $now,
            'exp' => $now + $ttl,
        ]);

        return JWT::encode($payload, JWT_SECRET, JWT_ALGORITHM);
    }

    /**
     * Decode and verify a JWT, returning its payload as an associative array.
     *
     * Also checks the token-blocklist table (when a DB is configured) so that
     * tokens invalidated via logout() are rejected immediately.
     *
     * @return array<string, mixed>
     * @throws RuntimeException  On invalid / expired / revoked tokens or missing secret.
     */
    public static function decodeToken(string $token): array
    {
        if (JWT_SECRET === '') {
            throw new RuntimeException('JWT_SECRET is not configured on the server.', 500);
        }

        try {
            $decoded = JWT::decode($token, new Key(JWT_SECRET, JWT_ALGORITHM));
            $payload = (array) $decoded;
        } catch (ExpiredException $e) {
            throw new RuntimeException('Token has expired.', 401, $e);
        } catch (SignatureInvalidException $e) {
            throw new RuntimeException('Token signature is invalid.', 401, $e);
        } catch (\Exception $e) {
            throw new RuntimeException('Invalid token: ' . $e->getMessage(), 401, $e);
        }

        if (DB_NAME !== '') {
            $hash = hash('sha256', $token);
            $stmt = Database::getInstance()->prepare(
                'SELECT 1 FROM token_blocklist WHERE token_hash = :hash LIMIT 1'
            );
            $stmt->execute([':hash' => $hash]);
            if ($stmt->fetch()) {
                throw new RuntimeException('Token has been revoked.', 401);
            }
        }

        return $payload;
    }

    /**
     * Extract the Bearer token from the Authorization header, or return null.
     *
     * Apache running PHP as CGI/FastCGI sometimes strips HTTP_AUTHORIZATION
     * from $_SERVER.  The .htaccess RewriteRule re-injects it, but after a
     * rewrite the variable may land as REDIRECT_HTTP_AUTHORIZATION instead.
     * We check both to handle all deployment configurations.
     */
    public static function tokenFromHeader(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Database-backed auth operations
    // -------------------------------------------------------------------------

    /**
     * Look up a user by email, verify the password, rehash on-the-fly if
     * needed, and return a signed JWT on success.
     *
     * @param  array<string, mixed> $credentials  e.g. ['email'=>'...', 'password'=>'...']
     * @throws RuntimeException  On invalid credentials or DB errors.
     */
    public static function login(array $credentials): string
    {
        $db    = Database::getInstance();
        $email = strtolower(trim((string) ($credentials['email'] ?? '')));
        $pass  = (string) ($credentials['password'] ?? '');

        $stmt = $db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch();

        if (!$row || !self::verifyPassword($pass, $row['password'])) {
            throw new RuntimeException('Invalid email or password.', 401);
        }

        if (isset($row['is_active']) && !(bool) $row['is_active']) {
            throw new RuntimeException('This account has been deactivated. Please contact support.', 403);
        }

        if (self::needsRehash($row['password'])) {
            $db->prepare('UPDATE users SET password = :p WHERE id = :id')
               ->execute([':p' => self::hashPassword($pass), ':id' => $row['id']]);
        }

        return self::issueToken([
            'sub'  => $row['id'],
            'role' => $row['role'],
            'name' => $row['name'],
            'type' => 'access',
        ]);
    }

    /**
     * Validate registration fields, hash the password, and insert the new
     * user record.  The caller is responsible for retrieving the created row
     * (e.g. via Database::getInstance()->lastInsertId()).
     *
     * @param  array<string, mixed> $data  Registration fields.
     * @throws RuntimeException  On validation failure or DB errors.
     */
    public static function register(array $data): void
    {
        if (empty(trim((string) ($data['name'] ?? '')))) {
            throw new RuntimeException('Name is required.', 422);
        }
        if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
        if (empty($data['password']) || strlen((string) $data['password']) < 8) {
            throw new RuntimeException('Password must be at least 8 characters.', 422);
        }

        $db    = Database::getInstance();
        $email = strtolower(trim((string) $data['email']));

        $stmt = $db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        if ($stmt->fetch()) {
            throw new RuntimeException('That email address is already registered.', 409);
        }

        $db->prepare(
            'INSERT INTO users (name, email, phone, password, role)
             VALUES (:name, :email, :phone, :password, :role)'
        )->execute([
            ':name'     => trim((string) $data['name']),
            ':email'    => $email,
            ':phone'    => trim((string) ($data['phone'] ?? '')),
            ':password' => self::hashPassword((string) $data['password']),
            ':role'     => 'client',
        ]);
    }

    /**
     * Invalidate the given token by storing its SHA-256 hash in the
     * token_blocklist table until the token's own expiry time.
     *
     * Expired blocklist entries are pruned on every call to keep the table
     * small.  If the token is already invalid (expired / bad signature) the
     * call is silently ignored — there is nothing to revoke.
     */
    public static function logout(string $token): void
    {
        try {
            $payload = self::decodeToken($token);
            $exp     = (int) ($payload['exp'] ?? (time() + JWT_TTL));
        } catch (RuntimeException) {
            // Token is already invalid; nothing to add to the blocklist.
            return;
        }

        $db   = Database::getInstance();
        $hash = hash('sha256', $token);

        // Probabilistically prune stale blocklist entries (~5 % of calls) to
        // avoid a per-request DELETE while still keeping the table bounded.
        if (random_int(1, 20) === 1) {
            $db->exec('DELETE FROM token_blocklist WHERE expires_at < NOW()');
        }

        // INSERT IGNORE is intentional: concurrent logouts of the same token
        // are silently deduplicated by the unique key on token_hash.
        $db->prepare(
            'INSERT IGNORE INTO token_blocklist (token_hash, expires_at)
             VALUES (:hash, FROM_UNIXTIME(:exp))'
        )->execute([':hash' => $hash, ':exp' => $exp]);
    }

    // -------------------------------------------------------------------------
    // Password reset flow
    // -------------------------------------------------------------------------

    /** Lifetime of a password-reset token in seconds (1 hour). */
    private const PASSWORD_RESET_TOKEN_TTL = 3600;

    /**
     * Generate and store a password-reset token for the given email.
     *
     * Silently succeeds even when the email is not found to prevent
     * user-enumeration attacks.  Returns the plain-text token (to be emailed
     * to the user) or null when the email is unknown.
     *
     * @throws RuntimeException  On DB errors.
     */
    public static function generatePasswordResetToken(string $email): ?string
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Password reset requires a database connection.', 500);
        }

        $email = strtolower(trim($email));
        $db    = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        if (!$stmt->fetch()) {
            return null; // Email not found – suppress the fact for security
        }

        // Invalidate any existing token for this email before creating a new one
        $db->prepare('DELETE FROM password_resets WHERE email = :email')
           ->execute([':email' => $email]);

        $token     = bin2hex(random_bytes(32)); // 64-char hex string
        $expiresAt = date('Y-m-d H:i:s', time() + self::PASSWORD_RESET_TOKEN_TTL);

        $db->prepare(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (:email, :token, :exp)'
        )->execute([':email' => $email, ':token' => $token, ':exp' => $expiresAt]);

        return $token;
    }

    /**
     * Verify a password-reset token and update the user's password.
     *
     * @throws RuntimeException  On invalid / expired token or validation failure.
     */
    public static function resetPassword(string $token, string $newPassword): void
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Password reset requires a database connection.', 500);
        }
        if (strlen($newPassword) < 8) {
            throw new RuntimeException('Password must be at least 8 characters.', 422);
        }

        $token = trim($token);
        $db    = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT email FROM password_resets
              WHERE token = :token AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch();

        if (!$row) {
            throw new RuntimeException('This reset link is invalid or has expired.', 422);
        }

        $email = (string) $row['email'];

        $db->prepare('UPDATE users SET password = :pw WHERE email = :email')
           ->execute([
               ':pw'    => self::hashPassword($newPassword),
               ':email' => $email,
           ]);

        // Delete used token so it cannot be reused
        $db->prepare('DELETE FROM password_resets WHERE token = :token')
           ->execute([':token' => $token]);
    }

    // -------------------------------------------------------------------------
    // Request helpers
    // -------------------------------------------------------------------------

    /**
     * Return the authenticated user's payload from the current request,
     * throwing if no valid token is present.
     *
     * @return array<string, mixed>
     * @throws RuntimeException  401 if no valid Bearer token is found.
     */
    public static function user(): array
    {
        $token = self::tokenFromHeader()
            ?? throw new RuntimeException('Unauthenticated.', 401);

        return self::decodeToken($token);
    }
}
