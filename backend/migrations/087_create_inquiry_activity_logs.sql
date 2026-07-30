-- Migration: 087_create_inquiry_activity_logs
-- Creates a table for tracking status changes, reschedules, and creation events for inquiries.

CREATE TABLE IF NOT EXISTS inquiry_activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inquiry_id CHAR(32) NOT NULL,
    actor_user_id INT UNSIGNED NULL,
    actor_role ENUM('system', 'admin', 'client') NOT NULL DEFAULT 'system',
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    detail TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_inquiry_activity_logs_inquiry_id (inquiry_id),
    KEY idx_inquiry_activity_logs_created_at (created_at),
    FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
