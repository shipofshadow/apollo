CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    ip_address VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(500) NOT NULL DEFAULT '',
    event_type VARCHAR(64) NOT NULL,
    outcome ENUM('success', 'failure', 'blocked', 'warning') NOT NULL DEFAULT 'success',
    detail TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auth_audit_created_at (created_at),
    KEY idx_auth_audit_email (email),
    KEY idx_auth_audit_ip (ip_address),
    KEY idx_auth_audit_event_type (event_type),
    KEY idx_auth_audit_user_id (user_id),
    CONSTRAINT fk_auth_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(500) NOT NULL DEFAULT '',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME NULL,
    revoked_at DATETIME NULL,
    revoked_reason VARCHAR(80) NULL,
    KEY idx_auth_sessions_user_id (user_id),
    KEY idx_auth_sessions_expires_at (expires_at),
    KEY idx_auth_sessions_revoked_at (revoked_at),
    UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
