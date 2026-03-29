<?php

declare(strict_types=1);

/**
 * Security-focused auth telemetry and session tracking.
 *
 * Features:
 * - Login attempt audit (success/failure)
 * - Suspicious activity detection helpers
 * - Active-session tracking with revocation support
 * - Export-friendly audit listing
 */
class AuthSecurityService
{
    private const WINDOW_SECONDS = 900; // 15 minutes
    private const ACCOUNT_BLOCK_THRESHOLD = 8;
    private const IP_BLOCK_THRESHOLD = 20;
    private const SUSPICIOUS_ACCOUNT_THRESHOLD = 5;
    private const SUSPICIOUS_IP_THRESHOLD = 10;

    private \PDO $db;

    private ?bool $auditTableExistsCache = null;
    private ?bool $sessionsTableExistsCache = null;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is not configured.', 503);
        }

        $this->db = Database::getInstance();
    }

    public function recordLoginAttempt(
        string $email,
        bool $success,
        ?int $userId,
        string $ipAddress,
        string $userAgent,
        ?string $detail = null
    ): void {
        if (!$this->auditTableExists()) {
            return;
        }

        $eventType = $success ? 'login_success' : 'login_failed';
        $outcome = $success ? 'success' : 'failure';

        $stmt = $this->db->prepare(
            'INSERT INTO auth_audit_logs
                (user_id, email, ip_address, user_agent, event_type, outcome, detail)
             VALUES
                (:user_id, :email, :ip, :ua, :event_type, :outcome, :detail)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':email' => strtolower(trim($email)),
            ':ip' => $this->normalizeIp($ipAddress),
            ':ua' => $this->normalizeUserAgent($userAgent),
            ':event_type' => $eventType,
            ':outcome' => $outcome,
            ':detail' => $detail !== null ? trim($detail) : null,
        ]);
    }

    public function isSuspiciousLogin(string $email, string $ipAddress): bool
    {
        $email = strtolower(trim($email));
        $ip = $this->normalizeIp($ipAddress);

        $emailFails = $email !== ''
            ? $this->countRecentFailedAttemptsBy('email', $email, self::WINDOW_SECONDS)
            : 0;
        $ipFails = $ip !== ''
            ? $this->countRecentFailedAttemptsBy('ip_address', $ip, self::WINDOW_SECONDS)
            : 0;

        return $emailFails >= self::SUSPICIOUS_ACCOUNT_THRESHOLD
            || $ipFails >= self::SUSPICIOUS_IP_THRESHOLD;
    }

    public function isTemporarilyBlocked(string $email, string $ipAddress): bool
    {
        return $this->getRetryAfterSeconds($email, $ipAddress) > 0;
    }

    /**
     * Return the lockout duration in seconds (0 when not blocked).
     */
    public function getRetryAfterSeconds(string $email, string $ipAddress): int
    {
        if (!$this->auditTableExists()) {
            return 0;
        }

        $email = strtolower(trim($email));
        $ip = $this->normalizeIp($ipAddress);

        $accountRetry = $email !== ''
            ? $this->computeRetryAfterBy('email', $email, self::ACCOUNT_BLOCK_THRESHOLD, self::WINDOW_SECONDS)
            : 0;
        $ipRetry = $ip !== ''
            ? $this->computeRetryAfterBy('ip_address', $ip, self::IP_BLOCK_THRESHOLD, self::WINDOW_SECONDS)
            : 0;

        return max($accountRetry, $ipRetry);
    }

    public function recordBlockedLoginAttempt(
        string $email,
        string $ipAddress,
        string $userAgent,
        int $retryAfterSeconds,
        ?string $detail = null
    ): void {
        if (!$this->auditTableExists()) {
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO auth_audit_logs
                (user_id, email, ip_address, user_agent, event_type, outcome, detail)
             VALUES
                (NULL, :email, :ip, :ua, :event_type, :outcome, :detail)'
        );

        $suffix = $detail !== null && trim($detail) !== ''
            ? ' ' . trim($detail)
            : '';

        $stmt->execute([
            ':email' => strtolower(trim($email)),
            ':ip' => $this->normalizeIp($ipAddress),
            ':ua' => $this->normalizeUserAgent($userAgent),
            ':event_type' => 'login_blocked',
            ':outcome' => 'blocked',
            ':detail' => 'Login temporarily blocked. Retry after ' . max(1, $retryAfterSeconds) . ' second(s).' . $suffix,
        ]);
    }

    public function shouldSendSuspiciousAlert(string $email, string $ipAddress): bool
    {
        if (!$this->auditTableExists()) {
            return false;
        }

        $email = strtolower(trim($email));
        $ip = $this->normalizeIp($ipAddress);
        $cutoff = date('Y-m-d H:i:s', time() - self::WINDOW_SECONDS);

        $stmt = $this->db->prepare(
            'SELECT COUNT(*)
             FROM auth_audit_logs
             WHERE event_type = :event_type
               AND created_at >= :cutoff
               AND (email = :email OR ip_address = :ip)'
        );
        $stmt->execute([
            ':event_type' => 'suspicious_login_alert',
            ':cutoff' => $cutoff,
            ':email' => $email,
            ':ip' => $ip,
        ]);

        return ((int) $stmt->fetchColumn()) === 0;
    }

    public function markSuspiciousAlertSent(string $email, string $ipAddress, string $userAgent, string $detail): void
    {
        if (!$this->auditTableExists()) {
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO auth_audit_logs
                (user_id, email, ip_address, user_agent, event_type, outcome, detail)
             VALUES
                (NULL, :email, :ip, :ua, :event_type, :outcome, :detail)'
        );
        $stmt->execute([
            ':email' => strtolower(trim($email)),
            ':ip' => $this->normalizeIp($ipAddress),
            ':ua' => $this->normalizeUserAgent($userAgent),
            ':event_type' => 'suspicious_login_alert',
            ':outcome' => 'warning',
            ':detail' => trim($detail),
        ]);
    }

    public function createSession(
        int $userId,
        string $token,
        int $expUnix,
        string $ipAddress,
        string $userAgent
    ): void {
        if (!$this->sessionsTableExists()) {
            return;
        }

        $tokenHash = hash('sha256', $token);

        $stmt = $this->db->prepare(
            'INSERT INTO user_sessions
                (user_id, token_hash, ip_address, user_agent, issued_at, expires_at, last_seen_at)
             VALUES
                (:uid, :token_hash, :ip, :ua, NOW(), FROM_UNIXTIME(:exp), NOW())'
        );
        $stmt->execute([
            ':uid' => $userId,
            ':token_hash' => $tokenHash,
            ':ip' => $this->normalizeIp($ipAddress),
            ':ua' => $this->normalizeUserAgent($userAgent),
            ':exp' => $expUnix,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    public function listSessions(int $userId, ?string $currentTokenHash = null, int $limit = 20): array
    {
        if (!$this->sessionsTableExists()) {
            return [];
        }

        $limit = max(1, min(100, $limit));

        $stmt = $this->db->prepare(
            'SELECT id, user_id, token_hash, ip_address, user_agent, issued_at, expires_at, last_seen_at, revoked_at, revoked_reason
             FROM user_sessions
             WHERE user_id = :uid
             ORDER BY issued_at DESC, id DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $row) use ($currentTokenHash): array {
            $tokenHash = (string) ($row['token_hash'] ?? '');
            return [
                'id' => (int) ($row['id'] ?? 0),
                'userId' => (int) ($row['user_id'] ?? 0),
                'ipAddress' => (string) ($row['ip_address'] ?? ''),
                'userAgent' => (string) ($row['user_agent'] ?? ''),
                'issuedAt' => (string) ($row['issued_at'] ?? ''),
                'expiresAt' => (string) ($row['expires_at'] ?? ''),
                'lastSeenAt' => (string) ($row['last_seen_at'] ?? ''),
                'revokedAt' => $row['revoked_at'] !== null ? (string) $row['revoked_at'] : null,
                'revokedReason' => $row['revoked_reason'] !== null ? (string) $row['revoked_reason'] : null,
                'isCurrent' => $currentTokenHash !== null && hash_equals($currentTokenHash, $tokenHash),
                'isActive' => $row['revoked_at'] === null,
            ];
        }, $rows);
    }

    public function revokeSessionById(int $userId, int $sessionId, string $reason = 'manual_revoke'): bool
    {
        if (!$this->sessionsTableExists()) {
            return false;
        }

        $stmt = $this->db->prepare(
            'SELECT token_hash, expires_at
             FROM user_sessions
             WHERE id = :id AND user_id = :uid
             LIMIT 1'
        );
        $stmt->execute([':id' => $sessionId, ':uid' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            return false;
        }

        $this->db->prepare(
            'UPDATE user_sessions
             SET revoked_at = NOW(), revoked_reason = :reason
             WHERE id = :id AND user_id = :uid AND revoked_at IS NULL'
        )->execute([
            ':reason' => $reason,
            ':id' => $sessionId,
            ':uid' => $userId,
        ]);

        $this->blocklistTokenHash((string) ($row['token_hash'] ?? ''), (string) ($row['expires_at'] ?? ''));
        return true;
    }

    public function revokeOtherSessions(int $userId, string $currentTokenHash): int
    {
        if (!$this->sessionsTableExists()) {
            return 0;
        }

        $stmt = $this->db->prepare(
            'SELECT id, token_hash, expires_at
             FROM user_sessions
             WHERE user_id = :uid
               AND revoked_at IS NULL
               AND token_hash <> :current_hash'
        );
        $stmt->execute([':uid' => $userId, ':current_hash' => $currentTokenHash]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        if (empty($rows)) {
            return 0;
        }

        foreach ($rows as $row) {
            $this->blocklistTokenHash((string) ($row['token_hash'] ?? ''), (string) ($row['expires_at'] ?? ''));
        }

        $this->db->prepare(
            'UPDATE user_sessions
             SET revoked_at = NOW(), revoked_reason = :reason
             WHERE user_id = :uid
               AND revoked_at IS NULL
               AND token_hash <> :current_hash'
        )->execute([
            ':reason' => 'revoke_others',
            ':uid' => $userId,
            ':current_hash' => $currentTokenHash,
        ]);

        return count($rows);
    }

    public function endSessionByToken(string $token, string $reason = 'logout'): void
    {
        if (!$this->sessionsTableExists()) {
            return;
        }

        $hash = hash('sha256', $token);
        $this->db->prepare(
            'UPDATE user_sessions
             SET revoked_at = NOW(), revoked_reason = :reason
             WHERE token_hash = :hash AND revoked_at IS NULL'
        )->execute([
            ':reason' => $reason,
            ':hash' => $hash,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    public function listAuthAuditLogs(int $limit = 200): array
    {
        if (!$this->auditTableExists()) {
            return [];
        }

        $limit = max(1, min(1000, $limit));

        $stmt = $this->db->prepare(
            'SELECT l.id, l.user_id, l.email, l.ip_address, l.user_agent, l.event_type, l.outcome, l.detail, l.created_at,
                    u.name AS user_name
             FROM auth_audit_logs l
             LEFT JOIN users u ON u.id = l.user_id
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
                'userName' => $row['user_name'] !== null ? (string) $row['user_name'] : null,
                'email' => (string) ($row['email'] ?? ''),
                'ipAddress' => (string) ($row['ip_address'] ?? ''),
                'userAgent' => (string) ($row['user_agent'] ?? ''),
                'eventType' => (string) ($row['event_type'] ?? ''),
                'outcome' => (string) ($row['outcome'] ?? ''),
                'detail' => $row['detail'] !== null ? (string) $row['detail'] : null,
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }, $rows);
    }

    private function countRecentFailedAttemptsBy(string $field, string $value, int $windowSeconds): int
    {
        if (!$this->auditTableExists()) {
            return 0;
        }

        if (!in_array($field, ['email', 'ip_address'], true) || $value === '') {
            return 0;
        }

        $cutoff = date('Y-m-d H:i:s', time() - max(1, $windowSeconds));

        $stmt = $this->db->prepare(
            'SELECT COUNT(*)
             FROM auth_audit_logs
             WHERE event_type = :event_type
               AND created_at >= :cutoff
               AND ' . $field . ' = :value'
        );
        $stmt->execute([
            ':event_type' => 'login_failed',
            ':cutoff' => $cutoff,
            ':value' => $value,
        ]);

        return (int) $stmt->fetchColumn();
    }

    private function computeRetryAfterBy(string $field, string $value, int $threshold, int $windowSeconds): int
    {
        if (!$this->auditTableExists()) {
            return 0;
        }

        if (!in_array($field, ['email', 'ip_address'], true) || $value === '' || $threshold <= 0) {
            return 0;
        }

        $windowSeconds = max(1, $windowSeconds);
        $cutoff = date('Y-m-d H:i:s', time() - $windowSeconds);

        // Compute retry-after entirely in SQL so DB/PHP timezone differences do not inflate values.
        $stmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS fail_count,
                GREATEST(
                    0,
                    CAST((UNIX_TIMESTAMP(MIN(t.created_at)) + :window_seconds) - UNIX_TIMESTAMP(NOW()) AS SIGNED)
                ) AS retry_after
             FROM (
                SELECT created_at
                FROM auth_audit_logs
                WHERE event_type = :event_type
                  AND created_at >= :cutoff
                  AND ' . $field . ' = :value
                ORDER BY created_at DESC
                LIMIT :lim
             ) t'
        );
        $stmt->bindValue(':window_seconds', $windowSeconds, \PDO::PARAM_INT);
        $stmt->bindValue(':event_type', 'login_failed');
        $stmt->bindValue(':cutoff', $cutoff);
        $stmt->bindValue(':value', $value);
        $stmt->bindValue(':lim', max(1, $threshold), \PDO::PARAM_INT);
        $stmt->execute();

        $row = $stmt->fetch(\PDO::FETCH_ASSOC) ?: ['fail_count' => 0, 'retry_after' => 0];
        if ((int) ($row['fail_count'] ?? 0) < $threshold) {
            return 0;
        }

        $retry = (int) ($row['retry_after'] ?? 0);
        return max(0, min($windowSeconds, $retry));
    }

    private function blocklistTokenHash(string $tokenHash, string $expiresAt): void
    {
        if ($tokenHash === '') {
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT IGNORE INTO token_blocklist (token_hash, expires_at)
             VALUES (:hash, :expires_at)'
        );
        $stmt->execute([
            ':hash' => $tokenHash,
            ':expires_at' => $expiresAt !== '' ? $expiresAt : date('Y-m-d H:i:s', time() + JWT_TTL),
        ]);
    }

    private function normalizeIp(string $ipAddress): string
    {
        $ip = trim($ipAddress);
        if ($ip === '') {
            return '';
        }

        return substr($ip, 0, 64);
    }

    private function normalizeUserAgent(string $userAgent): string
    {
        $ua = trim($userAgent);
        if ($ua === '') {
            return '';
        }

        return mb_substr($ua, 0, 500);
    }

    private function auditTableExists(): bool
    {
        if ($this->auditTableExistsCache !== null) {
            return $this->auditTableExistsCache;
        }

        try {
            $this->db->query('SELECT 1 FROM auth_audit_logs LIMIT 1');
            $this->auditTableExistsCache = true;
        } catch (\Throwable) {
            $this->auditTableExistsCache = false;
        }

        return $this->auditTableExistsCache;
    }

    private function sessionsTableExists(): bool
    {
        if ($this->sessionsTableExistsCache !== null) {
            return $this->sessionsTableExistsCache;
        }

        try {
            $this->db->query('SELECT 1 FROM user_sessions LIMIT 1');
            $this->sessionsTableExistsCache = true;
        } catch (\Throwable) {
            $this->sessionsTableExistsCache = false;
        }

        return $this->sessionsTableExistsCache;
    }
}
