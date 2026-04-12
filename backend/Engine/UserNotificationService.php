<?php

declare(strict_types=1);

/**
 * Persistent in-app notification store.
 *
 * Notification targeting:
 *   user_id = NULL  → admin-only (all admins see it)
 *   user_id = N     → the specific client with that ID
 *
 * Type constants (also used on the frontend):
 *   new_booking    – a new booking was submitted (admin target)
 *   status_changed – booking status was updated   (client target)
 *   build_update   – a new build progress update  (client target)
 *   parts_update   – booking set to awaiting_parts (client target)
 */
class UserNotificationService
{
    private \PDO $db;
    private ?bool $hasUserIdColumnCache = null;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // -------------------------------------------------------------------------
    // Write helpers
    // -------------------------------------------------------------------------

    /**
     * Create a notification targeted at ALL admins (user_id = NULL).
     *
     * @param array<string, mixed>|null $data  Extra JSON payload (e.g. ['bookingId' => '…'])
     */
    public function createForAdmin(
        string  $type,
        string  $title,
        string  $message,
        ?array  $data = null
    ): void {
        $this->insert(null, $type, $title, $message, $data);
    }

    /**
     * Create a notification for a specific client user.
     *
     * @param array<string, mixed>|null $data  Extra JSON payload
     */
    public function createForUser(
        int    $userId,
        string $type,
        string $title,
        string $message,
        ?array $data = null
    ): void {
        $this->insert($userId, $type, $title, $message, $data);
    }

    // -------------------------------------------------------------------------
    // Read helpers
    // -------------------------------------------------------------------------

    /**
     * Return notifications for the current viewer.
     *
    * @param  bool   $adminMode  true → return broadcast rows + rows targeted to this user
     * @param  int    $userId     Ignored when adminMode is true
     * @param  int    $limit
     * @return array<int, array<string, mixed>>
     */
    public function getForViewer(bool $adminMode, int $userId = 0, int $limit = 50): array
    {
        if (!$this->hasUserIdColumn()) {
            if (!$adminMode) {
                return [];
            }

            $stmt = $this->db->prepare(
                'SELECT * FROM notifications
                  ORDER BY created_at DESC
                  LIMIT :lim'
            );
            $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
            $stmt->execute();
            return array_map([$this, 'formatRow'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
        }

        if ($adminMode) {
            $stmt = $this->db->prepare(
                'SELECT * FROM notifications
                  WHERE user_id IS NULL OR user_id = :uid
                  ORDER BY created_at DESC
                  LIMIT :lim'
            );
            $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        } else {
            $stmt = $this->db->prepare(
                'SELECT * FROM notifications
                  WHERE user_id = :uid
                  ORDER BY created_at DESC
                  LIMIT :lim'
            );
            $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        }
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();

        return array_map([$this, 'formatRow'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /**
     * Count unread notifications for the current viewer.
     */
    public function getUnreadCount(bool $adminMode, int $userId = 0): int
    {
        if (!$this->hasUserIdColumn()) {
            if (!$adminMode) {
                return 0;
            }

            $stmt = $this->db->prepare(
                'SELECT COUNT(*) FROM notifications WHERE is_read = 0'
            );
            $stmt->execute();
            return (int) $stmt->fetchColumn();
        }

        if ($adminMode) {
            $stmt = $this->db->prepare(
                'SELECT COUNT(*)
                   FROM notifications
                  WHERE (user_id IS NULL OR user_id = :uid)
                    AND is_read = 0'
            );
            $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        } else {
            $stmt = $this->db->prepare(
                'SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0'
            );
            $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        }
        $stmt->execute();
        return (int) $stmt->fetchColumn();
    }

    // -------------------------------------------------------------------------
    // Mutation helpers
    // -------------------------------------------------------------------------

    /**
     * Mark a single notification as read.
     * Ownership is checked to prevent cross-user manipulation.
     */
    public function markRead(int $id, bool $adminMode, int $userId = 0): void
    {
        if (!$this->hasUserIdColumn()) {
            if (!$adminMode) {
                return;
            }

            $stmt = $this->db->prepare(
                'UPDATE notifications SET is_read = 1
                  WHERE id = :id'
            );
            $stmt->execute([':id' => $id]);
            return;
        }

        if ($adminMode) {
            $stmt = $this->db->prepare(
                'UPDATE notifications SET is_read = 1
                  WHERE id = :id AND (user_id IS NULL OR user_id = :uid)'
            );
            $stmt->execute([':id' => $id, ':uid' => $userId]);
        } else {
            $stmt = $this->db->prepare(
                'UPDATE notifications SET is_read = 1
                  WHERE id = :id AND user_id = :uid'
            );
            $stmt->execute([':id' => $id, ':uid' => $userId]);
        }
    }

    /**
     * Mark ALL notifications as read for the viewer.
     */
    public function markAllRead(bool $adminMode, int $userId = 0): void
    {
        if (!$this->hasUserIdColumn()) {
            if (!$adminMode) {
                return;
            }

            $this->db->exec(
                'UPDATE notifications SET is_read = 1 WHERE is_read = 0'
            );
            return;
        }

        if ($adminMode) {
            $stmt = $this->db->prepare(
                'UPDATE notifications SET is_read = 1
                  WHERE (user_id IS NULL OR user_id = :uid)
                    AND is_read = 0'
            );
            $stmt->execute([':uid' => $userId]);
        } else {
            $stmt = $this->db->prepare(
                'UPDATE notifications SET is_read = 1
                  WHERE user_id = :uid AND is_read = 0'
            );
            $stmt->execute([':uid' => $userId]);
        }
    }

    /**
     * Delete a single notification (ownership enforced).
     */
    public function delete(int $id, bool $adminMode, int $userId = 0): void
    {
        if (!$this->hasUserIdColumn()) {
            if (!$adminMode) {
                return;
            }

            $stmt = $this->db->prepare(
                'DELETE FROM notifications WHERE id = :id'
            );
            $stmt->execute([':id' => $id]);
            return;
        }

        if ($adminMode) {
            $stmt = $this->db->prepare(
                'DELETE FROM notifications
                  WHERE id = :id
                    AND (user_id IS NULL OR user_id = :uid)'
            );
            $stmt->execute([':id' => $id, ':uid' => $userId]);
        } else {
            $stmt = $this->db->prepare(
                'DELETE FROM notifications WHERE id = :id AND user_id = :uid'
            );
            $stmt->execute([':id' => $id, ':uid' => $userId]);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed>|null $data */
    private function insert(?int $userId, string $type, string $title, string $message, ?array $data): void
    {
        if ($this->hasUserIdColumn()) {
            $stmt = $this->db->prepare(
                'INSERT INTO notifications (user_id, type, title, message, data)
                 VALUES (:uid, :type, :title, :msg, :data)'
            );
            $stmt->execute([
                ':uid'   => $userId,
                ':type'  => $type,
                ':title' => $title,
                ':msg'   => $message,
                ':data'  => $data !== null ? json_encode($data) : null,
            ]);
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO notifications (type, title, message, data)
             VALUES (:type, :title, :msg, :data)'
        );
        $stmt->execute([
            ':type'  => $type,
            ':title' => $title,
            ':msg'   => $message,
            ':data'  => $data !== null ? json_encode($data) : null,
        ]);
    }

    /** @param array<string, mixed> $row */
    private function formatRow(array $row): array
    {
        $data = null;
        if (!empty($row['data'])) {
            $decoded = json_decode((string) $row['data'], true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        return [
            'id'        => (int) $row['id'],
            'userId'    => array_key_exists('user_id', $row) && $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'type'      => (string) $row['type'],
            'title'     => (string) $row['title'],
            'message'   => (string) $row['message'],
            'data'      => $data,
            'isRead'    => (bool) $row['is_read'],
            'createdAt' => (string) $row['created_at'],
        ];
    }

    private function hasUserIdColumn(): bool
    {
        if ($this->hasUserIdColumnCache !== null) {
            return $this->hasUserIdColumnCache;
        }

        try {
            $stmt = $this->db->prepare('SHOW COLUMNS FROM notifications LIKE :column');
            $stmt->execute([':column' => 'user_id']);
            $this->hasUserIdColumnCache = (bool) $stmt->fetch(\PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            $this->hasUserIdColumnCache = false;
        }

        return $this->hasUserIdColumnCache;
    }
}
