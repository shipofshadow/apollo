CREATE TABLE IF NOT EXISTS role_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(60) NOT NULL,
    role_id INT UNSIGNED NULL,
    role_key VARCHAR(50) NULL,
    target_user_id INT UNSIGNED NULL,
    actor_user_id INT UNSIGNED NULL,
    actor_name VARCHAR(200) NOT NULL DEFAULT '',
    details_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_role_audit_logs_created_at (created_at),
    KEY idx_role_audit_logs_role_key (role_key),
    KEY idx_role_audit_logs_actor_user_id (actor_user_id),
    KEY idx_role_audit_logs_target_user_id (target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
