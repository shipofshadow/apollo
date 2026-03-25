<?php

declare(strict_types=1);

/**
 * User registration, login, profile management.
 *
 * Requires a MySQL / MariaDB connection via Database::getInstance().
 * If DB_NAME is empty the constructor throws 503 so callers can show a
 * friendly "service unavailable" response.
 *
 * SQL (run once to create the schema):
 *
 *   CREATE TABLE IF NOT EXISTS users (
 *       id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *       name       VARCHAR(200)  NOT NULL,
 *       email      VARCHAR(255)  NOT NULL UNIQUE,
 *       phone      VARCHAR(30)   NOT NULL DEFAULT '',
 *       password   VARCHAR(255)  NOT NULL,
 *       role       ENUM('client','admin') NOT NULL DEFAULT 'client',
 *       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 *   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 */
class UserService
{
    private PDO $db;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is not configured. Please set DB_NAME in .env.', 503);
        }
        $this->db = Database::getInstance();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Register a new client account and return a signed JWT + user data.
     *
     * @param  array<string, mixed> $data
     * @return array{ token: string, user: array<string, mixed> }
     */
    public function register(array $data): array
    {
        Auth::register($data);

        $user  = $this->findById((int) $this->db->lastInsertId());
        $token = $this->issueTokenFor($user);

        return ['token' => $token, 'user' => $user];
    }

    /**
     * Authenticate with email + password and return a signed JWT + user data.
     *
     * @param  string $email
     * @param  string $password
     * @return array{ token: string, user: array<string, mixed> }
     */
    public function login(string $email, string $password): array
    {
        $token   = Auth::login(['email' => $email, 'password' => $password]);
        $payload = Auth::decodeToken($token);
        $user    = $this->findById((int) $payload['sub']);

        return ['token' => $token, 'user' => $user];
    }

    /**
     * Return a sanitized user record by ID.
     *
     * @return array<string, mixed>
     */
    public function findById(int $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        if (!$row) {
            throw new RuntimeException('User not found.', 404);
        }

        return $this->sanitize($row);
    }

    /**
     * Update allowed profile fields for a user.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>  Updated user record
     */
    public function updateProfile(int $id, array $data): array
    {
        $fields = [];
        $params = [':id' => $id];

        foreach (['name', 'phone'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $fields[]         = "$field = :$field";
                $params[":$field"] = trim((string) $data[$field]);
            }
        }

        // Optional password change
        $newPw = $data['password'] ?? '';
        if ($newPw !== '') {
            if (strlen($newPw) < 8) {
                throw new RuntimeException('Password must be at least 8 characters.', 422);
            }
            if (($data['password_confirmation'] ?? '') !== $newPw) {
                throw new RuntimeException('Password confirmation does not match.', 422);
            }
            $fields[]          = 'password = :password';
            $params[':password'] = Auth::hashPassword($newPw);
        }

        if (!empty($fields)) {
            $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
            $this->db->prepare($sql)->execute($params);
        }

        return $this->findById($id);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $user */
    private function issueTokenFor(array $user): string
    {
        return Auth::issueToken([
            'sub'  => $user['id'],
            'role' => $user['role'],
            'name' => $user['name'],
        ]);
    }

    /** Remove the password field from a user row. @return array<string, mixed> */
    private function sanitize(array $row): array
    {
        unset($row['password']);
        return $row;
    }
}
