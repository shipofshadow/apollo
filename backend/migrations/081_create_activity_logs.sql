CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    log_name VARCHAR(100) NOT NULL DEFAULT 'default',
    description TEXT NOT NULL,
    subject_type VARCHAR(120) NULL,
    subject_id VARCHAR(120) NULL,
    causer_type VARCHAR(120) NULL,
    causer_id VARCHAR(120) NULL,
    properties_json JSON NULL,
    attribute_changes_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_activity_logs_created_at (created_at),
    KEY idx_activity_logs_subject (subject_type, subject_id),
    KEY idx_activity_logs_causer (causer_type, causer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
