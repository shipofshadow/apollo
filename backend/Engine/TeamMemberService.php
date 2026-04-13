<?php

declare(strict_types=1);

/**
 * TeamMemberService
 *
 * Full CRUD for the team_members table.
 * Falls back to backend/storage/team_members.json when DB is not configured.
 *
 * Requires migration 012_create_team_members.sql to have been run.
 */
class TeamMemberService
{
    private bool $useDb;
    private static string $storageFile = __DIR__ . '/../storage/team_members.json';
    private ?bool $hasUserIdColumnCache = null;

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    public function getAll(bool $activeOnly = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($activeOnly)
            : $this->fileGetAll($activeOnly);
    }

    /** @return array<string, mixed> */
    public function getById(int $id): array
    {
        return $this->useDb ? $this->dbGetById($id) : $this->fileGetById($id);
    }

    /** @return array<string, mixed> */
    public function create(array $data): array
    {
        $this->validatePayload($data);
        $created = $this->useDb ? $this->dbCreate($data) : $this->fileCreate($data);
        $this->logTeamMemberActivity(ActivityEvents::TEAM_MEMBER_CREATED, $created, [
            'after' => $created,
        ]);
        return $created;
    }

    /** @return array<string, mixed> */
    public function update(int $id, array $data): array
    {
        $before = $this->getById($id);
        $updated = $this->useDb ? $this->dbUpdate($id, $data) : $this->fileUpdate($id, $data);
        $this->logTeamMemberActivity(ActivityEvents::TEAM_MEMBER_UPDATED, $updated, [
            'before' => $before,
            'after' => $updated,
        ]);
        return $updated;
    }

    public function delete(int $id): void
    {
        $before = $this->getById($id);
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
        $this->logTeamMemberActivity(ActivityEvents::TEAM_MEMBER_DELETED, $before, [
            'before' => $before,
        ]);
    }

    /** @return array<string, mixed>|null */
    public function findByUserId(int $userId): ?array
    {
        if ($userId <= 0 || !$this->useDb) {
            return null;
        }

        if ($this->hasUserIdColumn()) {
            $stmt = Database::getInstance()->prepare(
                'SELECT * FROM team_members WHERE user_id = :user_id LIMIT 1'
            );
            $stmt->execute([':user_id' => $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $this->mapRow($row);
            }

            // Legacy fallback: attempt to link an existing row by normalized
            // identity so old team_members records connect to users.
            $user = $this->getUserIdentity($userId);
            $legacy = $this->findUnlinkedByNormalizedIdentity($user);
            if ($legacy) {
                $update = Database::getInstance()->prepare(
                    'UPDATE team_members SET user_id = :user_id WHERE id = :id'
                );
                $update->execute([
                    ':user_id' => $userId,
                    ':id' => (int) ($legacy['id'] ?? 0),
                ]);

                $linked = $this->dbGetById((int) ($legacy['id'] ?? 0));
                return $linked;
            }

            return null;
        }

        $user = $this->getUserIdentity($userId);
        $email = strtolower(trim((string) ($user['email'] ?? '')));
        if ($email === '') {
            return null;
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM team_members WHERE LOWER(TRIM(email)) = :email LIMIT 1'
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->mapRow($row) : null;
    }

    /** @param array<string, mixed> $user @return array<string, mixed>|null */
    private function findUnlinkedByNormalizedIdentity(array $user): ?array
    {
        $email = strtolower(trim((string) ($user['email'] ?? '')));
        $phone = $this->normalizePhoneForMatch((string) ($user['phone'] ?? ''));

        if ($email !== '') {
            $stmt = Database::getInstance()->prepare(
                'SELECT * FROM team_members
                 WHERE user_id IS NULL
                   AND email IS NOT NULL
                   AND LOWER(TRIM(email)) = :email
                 LIMIT 1'
            );
            $stmt->execute([':email' => $email]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $row;
            }
        }

        if ($phone !== '') {
            $stmt = Database::getInstance()->query(
                'SELECT * FROM team_members WHERE user_id IS NULL AND phone IS NOT NULL AND phone <> ""'
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                $candidate = $this->normalizePhoneForMatch((string) ($row['phone'] ?? ''));
                if ($candidate !== '' && $candidate === $phone) {
                    return $row;
                }
            }
        }

        return null;
    }

    private function normalizePhoneForMatch(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if ($digits === null || $digits === '') {
            return '';
        }

        if (str_starts_with($digits, '63') && strlen($digits) === 12) {
            return '0' . substr($digits, 2);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 10) {
            return '0' . $digits;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 11) {
            return $digits;
        }

        return $digits;
    }

    // -------------------------------------------------------------------------
    // DB
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $activeOnly): array
    {
        $whereParts = [];
        if ($activeOnly) {
            $whereParts[] = 'tm.is_active = 1';
        }
        $whereParts[] = "LOWER(TRIM(COALESCE(tm.role, ''))) <> 'client'";
        $whereParts[] = "(u.role IS NULL OR LOWER(TRIM(u.role)) <> 'client')";
        $whereSql = 'WHERE ' . implode(' AND ', $whereParts);

        $stmt  = Database::getInstance()->query(
            "SELECT tm.id,
                    tm.user_id,
                    COALESCE(NULLIF(TRIM(u.name), ''), tm.name) AS name,
                    COALESCE(NULLIF(TRIM(u.role), ''), tm.role) AS role,
                    tm.image_url,
                    tm.bio,
                    tm.full_bio,
                    COALESCE(NULLIF(TRIM(u.email), ''), tm.email) AS email,
                    COALESCE(NULLIF(TRIM(u.phone), ''), tm.phone) AS phone,
                    tm.facebook,
                    tm.instagram,
                    tm.sort_order,
                    tm.is_active,
                    tm.created_at,
                    tm.updated_at
             FROM team_members tm
             LEFT JOIN users u ON u.id = tm.user_id
             {$whereSql}
             ORDER BY tm.sort_order ASC, tm.id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id): array
    {
        $stmt = Database::getInstance()->prepare(
                        "SELECT tm.id,
                                        tm.user_id,
                                        COALESCE(NULLIF(TRIM(u.name), ''), tm.name) AS name,
                                        COALESCE(NULLIF(TRIM(u.role), ''), tm.role) AS role,
                                        tm.image_url,
                                        tm.bio,
                                        tm.full_bio,
                                        COALESCE(NULLIF(TRIM(u.email), ''), tm.email) AS email,
                                        COALESCE(NULLIF(TRIM(u.phone), ''), tm.phone) AS phone,
                                        tm.facebook,
                                        tm.instagram,
                                        tm.sort_order,
                                        tm.is_active,
                                        tm.created_at,
                                        tm.updated_at
                         FROM team_members tm
                         LEFT JOIN users u ON u.id = tm.user_id
                         WHERE tm.id = :id
                             AND LOWER(TRIM(COALESCE(tm.role, ''))) <> 'client'
                             AND (u.role IS NULL OR LOWER(TRIM(u.role)) <> 'client')
                         LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Team member not found.', 404);
        }
        return $this->mapRow($row);
    }

    /** @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $payload = $this->withUserIdentity($data);
        $db = Database::getInstance();

        if ($this->hasUserIdColumn()) {
            $stmt = $db->prepare(
                'INSERT INTO team_members (user_id, name, role, image_url, bio, full_bio, email, phone, facebook, instagram, sort_order, is_active)
                 VALUES (:user_id, :name, :role, :image_url, :bio, :full_bio, :email, :phone, :facebook, :instagram, :sort_order, :is_active)'
            );
            $stmt->execute($this->bindParams($payload));
        } else {
            $stmt = $db->prepare(
                'INSERT INTO team_members (name, role, image_url, bio, full_bio, email, phone, facebook, instagram, sort_order, is_active)
                 VALUES (:name, :role, :image_url, :bio, :full_bio, :email, :phone, :facebook, :instagram, :sort_order, :is_active)'
            );
            $params = $this->bindParams($payload);
            unset($params[':user_id']);
            $stmt->execute($params);
        }

        return $this->dbGetById((int) $db->lastInsertId());
    }

    /** @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id);
        $merged  = $this->withUserIdentity(array_merge($current, $data));
        $this->validatePayload($merged);

        if ($this->hasUserIdColumn()) {
            $stmt = Database::getInstance()->prepare(
                'UPDATE team_members SET user_id = :user_id, name = :name, role = :role, image_url = :image_url,
                 bio = :bio, full_bio = :full_bio, email = :email, phone = :phone,
                 facebook = :facebook, instagram = :instagram,
                 sort_order = :sort_order, is_active = :is_active
                 WHERE id = :id'
            );
        } else {
            $stmt = Database::getInstance()->prepare(
                'UPDATE team_members SET name = :name, role = :role, image_url = :image_url,
                 bio = :bio, full_bio = :full_bio, email = :email, phone = :phone,
                 facebook = :facebook, instagram = :instagram,
                 sort_order = :sort_order, is_active = :is_active
                 WHERE id = :id'
            );
        }

        $params        = $this->bindParams($merged);
        if (!$this->hasUserIdColumn()) {
            unset($params[':user_id']);
        }
        $params[':id'] = $id;
        $stmt->execute($params);

        $oldImage = (string) ($current['imageUrl'] ?? '');
        $newImage = (string) ($merged['imageUrl'] ?? ($merged['image_url'] ?? ''));
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $this->dbGetById($id);
    }

    private function dbDelete(int $id): void
    {
        $current = $this->dbGetById($id);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM team_members WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Team member not found.', 404);
        }

        $oldImage = (string) ($current['imageUrl'] ?? '');
        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $activeOnly): array
    {
        $all = $this->fileRead();
        if ($activeOnly) {
            $all = array_values(array_filter($all, fn ($m) => (bool) ($m['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => (int) ($a['sortOrder'] ?? 0) <=> (int) ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id): array
    {
        foreach ($this->fileRead() as $m) {
            if ((int) ($m['id'] ?? 0) === $id) {
                return $m;
            }
        }
        throw new RuntimeException('Team member not found.', 404);
    }

    /** @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all  = $this->fileRead();
        $id   = empty($all) ? 1 : (int) max(array_column($all, 'id')) + 1;
        $record = $this->buildRecord($id, $this->withUserIdentity($data));
        $all[]  = $record;
        $this->fileWrite($all);
        return $record;
    }

    /** @return array<string, mixed> */
    private function fileUpdate(int $id, array $data): array
    {
        $all    = $this->fileRead();
        $found  = false;
        $result = null;
        $oldImage = '';

        foreach ($all as &$m) {
            if ((int) ($m['id'] ?? 0) === $id) {
                $oldImage = (string) ($m['imageUrl'] ?? '');
                $merged = $this->withUserIdentity(array_merge($m, $data));
                $this->validatePayload($merged);
                $m      = $this->buildRecord($id, $merged);
                $result = $m;
                $found  = true;
                break;
            }
        }
        unset($m);

        if (!$found) {
            throw new RuntimeException('Team member not found.', 404);
        }
        $this->fileWrite($all);

        $newImage = (string) ($result['imageUrl'] ?? '');
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $oldImage = '';
        foreach ($all as $m) {
            if ((int) ($m['id'] ?? 0) === $id) {
                $oldImage = (string) ($m['imageUrl'] ?? '');
                break;
            }
        }
        $filtered = array_values(array_filter($all, fn ($m) => (int) ($m['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Team member not found.', 404);
        }
        $this->fileWrite($filtered);

        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }
        $data = json_decode((string) file_get_contents(self::$storageFile), true);
        return is_array($data) ? $data : [];
    }

    /** @param array<int, array<string, mixed>> $data */
    private function fileWrite(array $data): void
    {
        $dir = dirname(self::$storageFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            self::$storageFile,
            json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapRow(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'userId'    => isset($row['user_id']) ? (int) $row['user_id'] : null,
            'name'      => $row['name'],
            'role'      => $row['role'] ?? '',
            'imageUrl'  => $row['image_url'] ?? null,
            'bio'       => $row['bio'] ?? null,
            'fullBio'   => $row['full_bio'] ?? null,
            'email'     => $row['email'] ?? null,
            'phone'     => $row['phone'] ?? null,
            'facebook'  => $row['facebook'] ?? null,
            'instagram' => $row['instagram'] ?? null,
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
            'isActive'  => (bool) ($row['is_active'] ?? true),
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':user_id'    => isset($data['userId']) ? (int) $data['userId'] : ($data['user_id'] ?? null),
            ':name'       => $data['name']      ?? '',
            ':role'       => $data['role']       ?? '',
            ':image_url'  => $data['imageUrl']   ?? ($data['image_url']  ?? null),
            ':bio'        => $data['bio']        ?? null,
            ':full_bio'   => $data['fullBio']    ?? ($data['full_bio']   ?? null),
            ':email'      => $data['email']      ?? null,
            ':phone'      => $data['phone']      ?? null,
            ':facebook'   => $data['facebook']   ?? null,
            ':instagram'  => $data['instagram']  ?? null,
            ':sort_order' => (int) ($data['sortOrder'] ?? $data['sort_order'] ?? 0),
            ':is_active'  => (int) (isset($data['isActive']) ? (bool) $data['isActive'] : true),
        ];
    }

    /** @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        return [
            'id'        => $id,
            'userId'    => isset($data['userId']) ? (int) $data['userId'] : null,
            'name'      => $data['name']      ?? '',
            'role'      => $data['role']       ?? '',
            'imageUrl'  => $data['imageUrl']   ?? null,
            'bio'       => $data['bio']        ?? null,
            'fullBio'   => $data['fullBio']    ?? null,
            'email'     => $data['email']      ?? null,
            'phone'     => $data['phone']      ?? null,
            'facebook'  => $data['facebook']   ?? null,
            'instagram' => $data['instagram']  ?? null,
            'sortOrder' => (int) ($data['sortOrder'] ?? 0),
            'isActive'  => isset($data['isActive']) ? (bool) $data['isActive'] : true,
            'createdAt' => $data['createdAt']  ?? date('c'),
            'updatedAt' => date('c'),
        ];
    }

    private function validatePayload(array $data): void
    {
        $role = strtolower(trim((string) ($data['role'] ?? '')));
        if ($role === 'client') {
            throw new RuntimeException('Client accounts cannot be saved as team members.', 422);
        }

        $hasUser = (int) ($data['userId'] ?? 0) > 0 || (int) ($data['user_id'] ?? 0) > 0;
        if ($this->useDb && $this->hasUserIdColumn() && !$hasUser) {
            throw new RuntimeException('Team member must be linked to an existing user.', 422);
        }
        if (!$hasUser && empty(trim((string) ($data['name'] ?? '')))) {
            throw new RuntimeException('Team member name is required.', 422);
        }
    }

    /** @return array<string, mixed> */
    private function withUserIdentity(array $data): array
    {
        $userId = (int) ($data['userId'] ?? ($data['user_id'] ?? 0));
        if ($userId <= 0 || !$this->useDb) {
            return $data;
        }

        $user = $this->getUserIdentity($userId);

        $data['userId'] = $this->hasUserIdColumn() ? (int) $user['id'] : null;
        $data['name'] = (string) ($user['name'] ?? '');
        $data['email'] = (string) ($user['email'] ?? '');
        $data['phone'] = (string) ($user['phone'] ?? '');
        $data['role'] = (string) ($user['role'] ?? ($data['role'] ?? ''));

        return $data;
    }

    /** @return array<string, mixed> */
    private function getUserIdentity(int $userId): array
    {
        if ($userId <= 0) {
            throw new RuntimeException('Selected user was not found.', 422);
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT id, name, email, phone, role FROM users WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            throw new RuntimeException('Selected user was not found.', 422);
        }
        if (strtolower(trim((string) ($user['role'] ?? ''))) === 'client') {
            throw new RuntimeException('Client accounts cannot be assigned as team members.', 422);
        }

        return $user;
    }

    private function hasUserIdColumn(): bool
    {
        if ($this->hasUserIdColumnCache !== null) {
            return $this->hasUserIdColumnCache;
        }
        if (!$this->useDb) {
            $this->hasUserIdColumnCache = false;
            return false;
        }

        try {
            $stmt = Database::getInstance()->prepare('SHOW COLUMNS FROM team_members LIKE :column');
            $stmt->execute([':column' => 'user_id']);
            $this->hasUserIdColumnCache = (bool) $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable) {
            $this->hasUserIdColumnCache = false;
        }

        return $this->hasUserIdColumnCache;
    }

    private function deleteManagedImageUrl(string $url): void
    {
        try {
            (new UploadStorage())->deleteByUrl($url);
        } catch (\Throwable) {
            // Keep CRUD successful even if storage cleanup fails.
        }
    }

    /** @param array<string, mixed> $entity @param array<string, mixed> $properties */
    private function logTeamMemberActivity(string $description, array $entity, array $properties = []): void
    {
        try {
            $subjectId = (string) ((int) ($entity['id'] ?? 0));
            $logger = activity()
                ->forSubject('team_members', $subjectId)
                ->withProperties($properties);

            $actorUserId = $this->resolveActorUserId();
            if ($actorUserId !== null) {
                $logger->byUser($actorUserId);
            }

            $logger->log($description, 'team_members');
        } catch (\Throwable $e) {
            error_log('[TeamMemberService] Failed to write activity log: ' . $e->getMessage());
        }
    }

    private function resolveActorUserId(): ?int
    {
        try {
            $payload = Auth::user();
            $userId = (int) ($payload['sub'] ?? 0);
            return $userId > 0 ? $userId : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
