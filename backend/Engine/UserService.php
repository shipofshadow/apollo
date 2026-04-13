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

        // Issue a long-lived refresh token (7 days)
        $refreshToken = Auth::issueToken(['sub' => $user['id'], 'type' => 'refresh'], 7 * 24 * 60 * 60);

        // Claim any anonymous bookings submitted with this email before the
        // account existed (guest bookings have user_id = NULL).
        $this->claimAnonymousBookings((int) $user['id'], strtolower(trim((string) ($data['email'] ?? ''))));

        return ['token' => $token, 'refresh_token' => $refreshToken, 'user' => $user];
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
        $userId  = (int) $payload['sub'];
        $user    = $this->findById($userId);

        // Issue a long-lived refresh token (7 days)
        $refreshToken = Auth::issueToken(['sub' => $userId, 'type' => 'refresh'], 7 * 24 * 60 * 60);

        return ['token' => $token, 'refresh_token' => $refreshToken, 'user' => $user];
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

        foreach (['name', 'phone', 'avatar_url'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $fields[]         = "$field = :$field";
                if ($field === 'phone') {
                    $params[':phone'] = $this->normalizePhoneForStorage((string) $data[$field]);
                } else {
                    $params[":$field"] = trim((string) $data[$field]);
                }
            }
        }

        if (array_key_exists('avatar_url', $data) && $data['avatar_url'] === null) {
            $fields[] = 'avatar_url = :avatar_url';
            $params[':avatar_url'] = null;
        }

        $current = $this->findById($id);
        $oldAvatar = trim((string) ($current['avatar_url'] ?? ''));

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

        $updated = $this->findById($id);
        $newAvatar = trim((string) ($updated['avatar_url'] ?? ''));
        if ($oldAvatar !== '' && $oldAvatar !== $newAvatar) {
            $this->deleteManagedImageUrl($oldAvatar);
        }

        return $updated;
    }

    /**
     * List users for admin management.
     *
     * @param array<string, mixed> $filters
     * @return array<int, array<string, mixed>>
     */
    public function listUsers(array $filters = []): array
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $role   = trim((string) ($filters['role'] ?? ''));

        $sql = 'SELECT * FROM users WHERE 1=1';
        $params = [];

        if ($search !== '') {
            $sql .= ' AND (name LIKE :search OR email LIKE :search OR phone LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        if ($role !== '') {
            if (!$this->roleExists($role)) {
                throw new RuntimeException('Invalid role filter.', 422);
            }
            $sql .= ' AND role = :role';
            $params[':role'] = $role;
        }

        $sql .= ' ORDER BY created_at DESC, id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map([$this, 'sanitize'], $rows);
    }

    /**
     * Create a user from admin panel.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createByAdmin(array $data): array
    {
        $name  = trim((string) ($data['name'] ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $phone = $this->normalizePhoneForStorage((string) ($data['phone'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $role = strtolower(trim((string) ($data['role'] ?? 'client')));

        if ($name === '') {
            throw new RuntimeException('Name is required.', 422);
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }
        if (strlen($password) < 8) {
            throw new RuntimeException('Password must be at least 8 characters.', 422);
        }
        if (!$this->roleExists($role)) {
            throw new RuntimeException('Invalid role.', 422);
        }

        $exists = $this->db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute([':email' => $email]);
        if ($exists->fetch()) {
            throw new RuntimeException('That email address is already registered.', 409);
        }

        $this->db->prepare(
            'INSERT INTO users (name, email, phone, password, role)
             VALUES (:name, :email, :phone, :password, :role)'
        )->execute([
            ':name'     => $name,
            ':email'    => $email,
            ':phone'    => $phone,
            ':password' => Auth::hashPassword($password),
            ':role'     => $role,
        ]);

        return $this->findById((int) $this->db->lastInsertId());
    }

    /**
     * Update an existing user's role.
     *
     * @return array<string, mixed>
     */
    public function updateRole(int $id, string $role, ?int $actorUserId = null, ?string $actorName = null): array
    {
        $role = strtolower(trim($role));
        if (!$this->roleExists($role)) {
            throw new RuntimeException('Invalid role.', 422);
        }

        $current = $this->findById($id);
        $previousRole = strtolower(trim((string) ($current['role'] ?? '')));
        if ($previousRole === $role) {
            return $current;
        }

        $stmt = $this->db->prepare('UPDATE users SET role = :role WHERE id = :id');
        $stmt->execute([':role' => $role, ':id' => $id]);

        if ($stmt->rowCount() === 0) {
            $this->findById($id); // throws 404 when missing
        }

        $updated = $this->findById($id);

        $this->logRoleAudit(
            'user_role_updated',
            null,
            $role,
            $id,
            $actorUserId,
            $actorName,
            [
                'from' => $previousRole,
                'to' => $role,
                'targetEmail' => (string) ($updated['email'] ?? ''),
                'targetName' => (string) ($updated['name'] ?? ''),
            ]
        );

        return $updated;
    }

    /**
     * List role definitions used for access management.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listRoles(): array
    {
        $stmt = $this->db->query(
            'SELECT id, role_key, name, description, permissions_json, is_system, created_at, updated_at
             FROM roles
             ORDER BY is_system DESC, name ASC, id ASC'
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $row): array {
            $decoded = json_decode((string) ($row['permissions_json'] ?? '[]'), true);
            $permissions = is_array($decoded)
                ? array_values(array_filter(array_map('strval', $decoded), static fn (string $v): bool => $v !== ''))
                : [];

            return [
                'id' => (int) ($row['id'] ?? 0),
                'key' => (string) ($row['role_key'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
                'description' => (string) ($row['description'] ?? ''),
                'permissions' => $permissions,
                'isSystem' => ((int) ($row['is_system'] ?? 0)) === 1,
                'created_at' => isset($row['created_at']) ? (string) $row['created_at'] : null,
                'updated_at' => isset($row['updated_at']) ? (string) $row['updated_at'] : null,
            ];
        }, $rows);
    }

    /**
     * Create a custom role entry.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createRole(array $data, ?int $actorUserId = null, ?string $actorName = null): array
    {
        $key = $this->normalizeRoleKey((string) ($data['key'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $permissions = $this->normalizePermissions($data['permissions'] ?? []);

        if ($key === '') {
            throw new RuntimeException('Role key is required.', 422);
        }
        if (!preg_match('/^[a-z][a-z0-9_-]{1,31}$/', $key)) {
            throw new RuntimeException('Role key must be 2-32 characters: lowercase letters, numbers, underscore, dash.', 422);
        }
        if ($name === '') {
            throw new RuntimeException('Role name is required.', 422);
        }

        $exists = $this->db->prepare('SELECT id FROM roles WHERE role_key = :key LIMIT 1');
        $exists->execute([':key' => $key]);
        if ($exists->fetch()) {
            throw new RuntimeException('Role key already exists.', 409);
        }

        $this->db->prepare(
            'INSERT INTO roles (role_key, name, description, permissions_json, is_system)
             VALUES (:key, :name, :description, :permissions, 0)'
        )->execute([
            ':key' => $key,
            ':name' => $name,
            ':description' => $description,
            ':permissions' => json_encode($permissions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $created = $this->getRoleById((int) $this->db->lastInsertId());

        $this->logRoleAudit(
            'role_created',
            (int) ($created['id'] ?? 0),
            (string) ($created['key'] ?? ''),
            null,
            $actorUserId,
            $actorName,
            [
                'name' => (string) ($created['name'] ?? ''),
                'permissions' => (array) ($created['permissions'] ?? []),
                'isSystem' => (bool) ($created['isSystem'] ?? false),
            ]
        );

        return $created;
    }

    /**
     * Update an existing role definition.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateRoleDefinition(int $id, array $data, ?int $actorUserId = null, ?string $actorName = null): array
    {
        $current = $this->getRoleById($id);
        $nextKey = $this->normalizeRoleKey((string) ($data['key'] ?? $current['key']));
        $nextName = trim((string) ($data['name'] ?? $current['name']));
        $nextDescription = trim((string) ($data['description'] ?? $current['description']));
        $nextPermissions = array_key_exists('permissions', $data)
            ? $this->normalizePermissions($data['permissions'])
            : (array) ($current['permissions'] ?? []);

        if ($nextKey === '' || !preg_match('/^[a-z][a-z0-9_-]{1,31}$/', $nextKey)) {
            throw new RuntimeException('Role key must be 2-32 characters: lowercase letters, numbers, underscore, dash.', 422);
        }
        if ($nextName === '') {
            throw new RuntimeException('Role name is required.', 422);
        }

        if ((bool) ($current['isSystem'] ?? false) && $nextKey !== (string) $current['key']) {
            throw new RuntimeException('System role keys cannot be changed.', 422);
        }

        if ($nextKey !== (string) $current['key']) {
            $dup = $this->db->prepare('SELECT id FROM roles WHERE role_key = :key AND id <> :id LIMIT 1');
            $dup->execute([':key' => $nextKey, ':id' => $id]);
            if ($dup->fetch()) {
                throw new RuntimeException('Role key already exists.', 409);
            }
        }

        $this->db->beginTransaction();
        try {
            $this->db->prepare(
                'UPDATE roles
                 SET role_key = :key, name = :name, description = :description, permissions_json = :permissions
                 WHERE id = :id'
            )->execute([
                ':id' => $id,
                ':key' => $nextKey,
                ':name' => $nextName,
                ':description' => $nextDescription,
                ':permissions' => json_encode($nextPermissions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);

            if ($nextKey !== (string) $current['key']) {
                $this->db->prepare('UPDATE users SET role = :next WHERE role = :prev')
                    ->execute([':next' => $nextKey, ':prev' => (string) $current['key']]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }

        $updated = $this->getRoleById($id);

        $this->logRoleAudit(
            'role_updated',
            (int) ($updated['id'] ?? 0),
            (string) ($updated['key'] ?? ''),
            null,
            $actorUserId,
            $actorName,
            [
                'before' => [
                    'key' => (string) ($current['key'] ?? ''),
                    'name' => (string) ($current['name'] ?? ''),
                    'description' => (string) ($current['description'] ?? ''),
                    'permissions' => (array) ($current['permissions'] ?? []),
                ],
                'after' => [
                    'key' => (string) ($updated['key'] ?? ''),
                    'name' => (string) ($updated['name'] ?? ''),
                    'description' => (string) ($updated['description'] ?? ''),
                    'permissions' => (array) ($updated['permissions'] ?? []),
                ],
            ]
        );

        return $updated;
    }

    public function deleteRole(int $id, ?int $actorUserId = null, ?string $actorName = null): void
    {
        $role = $this->getRoleById($id);

        if ((bool) ($role['isSystem'] ?? false)) {
            throw new RuntimeException('System roles cannot be deleted.', 422);
        }

        $inUse = $this->db->prepare('SELECT COUNT(*) FROM users WHERE role = :role');
        $inUse->execute([':role' => (string) $role['key']]);
        if ((int) $inUse->fetchColumn() > 0) {
            throw new RuntimeException('Cannot delete a role that is assigned to users.', 409);
        }

        $stmt = $this->db->prepare('DELETE FROM roles WHERE id = :id');
        $stmt->execute([':id' => $id]);

        $this->logRoleAudit(
            'role_deleted',
            $id,
            (string) ($role['key'] ?? ''),
            null,
            $actorUserId,
            $actorName,
            [
                'name' => (string) ($role['name'] ?? ''),
                'description' => (string) ($role['description'] ?? ''),
                'permissions' => (array) ($role['permissions'] ?? []),
            ]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listRoleAuditLogs(int $limit = 100): array
    {
        if (!$this->roleAuditTableExists()) {
            return [];
        }

        $limit = max(1, min(300, $limit));

        $stmt = $this->db->prepare(
            'SELECT ral.id, ral.action, ral.role_id, ral.role_key, ral.target_user_id,
                    ral.actor_user_id, ral.actor_name, ral.details_json, ral.created_at,
                    au.email AS actor_email, tu.email AS target_email
             FROM role_audit_logs ral
             LEFT JOIN users au ON au.id = ral.actor_user_id
             LEFT JOIN users tu ON tu.id = ral.target_user_id
             ORDER BY ral.created_at DESC, ral.id DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(function (array $row): array {
            $details = json_decode((string) ($row['details_json'] ?? 'null'), true);
            return [
                'id' => (int) ($row['id'] ?? 0),
                'action' => (string) ($row['action'] ?? ''),
                'roleId' => isset($row['role_id']) ? (int) $row['role_id'] : null,
                'roleKey' => isset($row['role_key']) ? (string) $row['role_key'] : null,
                'targetUserId' => isset($row['target_user_id']) ? (int) $row['target_user_id'] : null,
                'targetUserEmail' => isset($row['target_email']) ? (string) $row['target_email'] : null,
                'actorUserId' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
                'actorName' => (string) ($row['actor_name'] ?? ''),
                'actorEmail' => isset($row['actor_email']) ? (string) $row['actor_email'] : null,
                'details' => is_array($details) ? $details : null,
                'created_at' => (string) ($row['created_at'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * List clients with quick booking metrics.
     *
     * @param array<string, mixed> $filters
     * @return array<int, array<string, mixed>>
     */
    public function listClients(array $filters = []): array
    {
        $search = trim((string) ($filters['search'] ?? ''));

        $sql = "SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
                       COUNT(b.id) AS booking_count,
                       MAX(b.created_at) AS last_booking_at
                FROM users u
                LEFT JOIN bookings b ON b.user_id = u.id
                WHERE u.role = 'client'";
        $params = [];

        if ($search !== '') {
            $sql .= ' AND (u.name LIKE :search OR u.email LIKE :search OR u.phone LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $sql .= ' GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at';
        $sql .= ' ORDER BY u.created_at DESC, u.id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $row): array {
            return [
                'id'           => (int) $row['id'],
                'name'         => (string) $row['name'],
                'email'        => (string) $row['email'],
                'phone'        => (string) ($row['phone'] ?? ''),
                'role'         => (string) $row['role'],
                'is_active'    => isset($row['is_active']) ? (bool) $row['is_active'] : true,
                'created_at'   => (string) $row['created_at'],
                'bookingCount' => (int) ($row['booking_count'] ?? 0),
                'lastBookingAt' => $row['last_booking_at'] !== null ? (string) $row['last_booking_at'] : null,
            ];
        }, $rows);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Enable or disable a user account.
     *
     * @return array<string, mixed>
     */
    public function updateUserStatus(int $id, bool $isActive): array
    {
        $this->findById($id); // throws 404 if not found
        $this->db->prepare('UPDATE users SET is_active = :is_active WHERE id = :id')
            ->execute([':is_active' => (int) $isActive, ':id' => $id]);
        return $this->findById($id);
    }

    /**
     * Update editable info fields (name, email, phone) for a user from admin panel.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateUserInfo(int $id, array $data): array
    {
        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ($name === '') {
                throw new RuntimeException('Name is required.', 422);
            }
            $fields[]      = 'name = :name';
            $params[':name'] = $name;
        }

        if (array_key_exists('email', $data)) {
            $email = strtolower(trim((string) $data['email']));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('A valid email address is required.', 422);
            }
            $dup = $this->db->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
            $dup->execute([':email' => $email, ':id' => $id]);
            if ($dup->fetch()) {
                throw new RuntimeException('That email address is already registered.', 409);
            }
            $fields[]       = 'email = :email';
            $params[':email'] = $email;
        }

        if (array_key_exists('phone', $data)) {
            $fields[]       = 'phone = :phone';
            $params[':phone'] = $this->normalizePhoneForStorage((string) $data['phone']);
        }

        if (empty($fields)) {
            return $this->findById($id);
        }

        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $this->db->prepare($sql)->execute($params);
        return $this->findById($id);
    }

    /**
     * Delete a user account from the admin panel.
     */
    public function deleteByAdmin(int $id, ?int $actorUserId = null, ?string $actorName = null): void
    {
        $target = $this->findById($id);
        $targetRole = strtolower(trim((string) ($target['role'] ?? '')));

        if ($targetRole === 'owner' && $this->countUsersByRole('owner') <= 1) {
            throw new RuntimeException('You cannot delete the last owner account.', 422);
        }

        $this->db->beginTransaction();
        try {
            (new PrivacyService())->deleteAccount($id, 'admin_delete');

            $this->logRoleAudit(
                'user_deleted',
                null,
                $targetRole !== '' ? $targetRole : null,
                $id,
                $actorUserId,
                $actorName,
                [
                    'targetEmail' => (string) ($target['email'] ?? ''),
                    'targetName' => (string) ($target['name'] ?? ''),
                    'targetRole' => $targetRole,
                ]
            );

            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    private function issueTokenFor(array $user): string
    {
        return Auth::issueToken([
            'sub'  => $user['id'],
            'role' => $user['role'],
            'name' => $user['name'],
            'type' => 'access',
        ]);
    }

    /** Remove the password field from a user row. @return array<string, mixed> */
    private function sanitize(array $row): array
    {
        unset($row['password']);
        $row['avatar_url'] = $row['avatar_url'] ?? null;
        $row['is_active']  = isset($row['is_active']) ? (bool) $row['is_active'] : true;
        return $row;
    }

    private function deleteManagedImageUrl(string $url): void
    {
        try {
            (new UploadStorage())->deleteByUrl($url);
        } catch (
            Throwable
        ) {
            // Keep profile updates successful even if storage cleanup fails.
        }
    }

    private function roleExists(string $role): bool
    {
        $role = $this->normalizeRoleKey($role);
        if ($role === '') {
            return false;
        }

        $stmt = $this->db->prepare('SELECT 1 FROM roles WHERE role_key = :role LIMIT 1');
        $stmt->execute([':role' => $role]);
        return (bool) $stmt->fetchColumn();
    }

    private function countUsersByRole(string $role): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE role = :role');
        $stmt->execute([':role' => strtolower(trim($role))]);
        return (int) $stmt->fetchColumn();
    }

    private function normalizePhoneForStorage(string $phone): string
    {
        $trimmed = trim($phone);
        if ($trimmed === '') {
            return '';
        }

        $digits = preg_replace('/\D+/', '', $trimmed);
        if ($digits === null || $digits === '') {
            return $trimmed;
        }

        if (str_starts_with($digits, '63') && strlen($digits) === 12 && ($digits[2] ?? '') === '9') {
            return '0' . substr($digits, 2);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 10) {
            return '0' . $digits;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 11 && ($digits[1] ?? '') === '9') {
            return $digits;
        }

        return $trimmed;
    }

    /**
     * @return array<string, mixed>
     */
    private function getRoleById(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, role_key, name, description, permissions_json, is_system, created_at, updated_at
             FROM roles
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new RuntimeException('Role not found.', 404);
        }

        $decoded = json_decode((string) ($row['permissions_json'] ?? '[]'), true);
        $permissions = is_array($decoded)
            ? array_values(array_filter(array_map('strval', $decoded), static fn (string $v): bool => $v !== ''))
            : [];

        return [
            'id' => (int) ($row['id'] ?? 0),
            'key' => (string) ($row['role_key'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'permissions' => $permissions,
            'isSystem' => ((int) ($row['is_system'] ?? 0)) === 1,
            'created_at' => isset($row['created_at']) ? (string) $row['created_at'] : null,
            'updated_at' => isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        ];
    }

    private function normalizeRoleKey(string $value): string
    {
        return strtolower(trim($value));
    }

    /**
     * @param mixed $permissions
     * @return string[]
     */
    private function normalizePermissions($permissions): array
    {
        if (!is_array($permissions)) {
            return [];
        }

        $result = [];
        foreach ($permissions as $permission) {
            $value = strtolower(trim((string) $permission));
            if ($value === '') {
                continue;
            }
            if (!preg_match('/^[a-z0-9:_-]{2,64}$/', $value)) {
                throw new RuntimeException('Invalid permission key format.', 422);
            }
            if (!in_array($value, $result, true)) {
                $result[] = $value;
            }
        }

        return $result;
    }

    private function roleAuditTableExists(): bool
    {
        try {
            $this->db->query('SELECT 1 FROM role_audit_logs LIMIT 1');
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param array<string, mixed>|null $details
     */
    private function logRoleAudit(
        string $action,
        ?int $roleId,
        ?string $roleKey,
        ?int $targetUserId,
        ?int $actorUserId,
        ?string $actorName,
        ?array $details = null
    ): void {
        if (!$this->roleAuditTableExists()) {
            return;
        }

        $safeRoleKey = $roleKey !== null ? trim($roleKey) : null;
        $safeActorName = trim((string) ($actorName ?? ''));

        $this->db->prepare(
            'INSERT INTO role_audit_logs (
                action, role_id, role_key, target_user_id, actor_user_id, actor_name, details_json
             ) VALUES (
                :action, :role_id, :role_key, :target_user_id, :actor_user_id, :actor_name, :details_json
             )'
        )->execute([
            ':action' => $action,
            ':role_id' => $roleId,
            ':role_key' => $safeRoleKey,
            ':target_user_id' => $targetUserId,
            ':actor_user_id' => $actorUserId,
            ':actor_name' => $safeActorName,
            ':details_json' => $details !== null
                ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : null,
        ]);
    }

    /**
     * Link any anonymous bookings (user_id IS NULL) that share the given
     * email address to the newly registered user.
     * This connects guest bookings made before account creation.
     */
    private function claimAnonymousBookings(int $userId, string $email): void
    {
        if ($email === '') {
            return;
        }
        $this->db->prepare(
            'UPDATE bookings SET user_id = :uid WHERE email = :email AND user_id IS NULL'
        )->execute([':uid' => $userId, ':email' => $email]);
    }
}
