-- Migration: 073_create_notification_jobs
-- Durable background queue for notification delivery jobs.

CREATE TABLE IF NOT EXISTS notification_jobs (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event        VARCHAR(80)     NOT NULL,
    payload      LONGTEXT        NOT NULL,
    status       VARCHAR(20)     NOT NULL DEFAULT 'queued',
    attempts     INT UNSIGNED    NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED    NOT NULL DEFAULT 5,
    run_after    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error   TEXT            NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at TIMESTAMP       NULL DEFAULT NULL,
    INDEX idx_notification_jobs_status_run_after (status, run_after),
    INDEX idx_notification_jobs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
