-- Migration: 029_create_notifications
-- In-app notification store for the booking system.
--
-- user_id = NULL  → admin-targeted notification (any admin can see it)
-- user_id = N     → notification for the specific client user with that ID
--
-- type values: new_booking | status_changed | build_update | parts_update

CREATE TABLE IF NOT EXISTS notifications (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED  NULL     DEFAULT NULL,
    type       VARCHAR(50)   NOT NULL,
    title      VARCHAR(255)  NOT NULL,
    message    TEXT          NOT NULL,
    data       TEXT          DEFAULT NULL,
    is_read    TINYINT(1)    NOT NULL DEFAULT 0,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user    (user_id),
    INDEX idx_notifications_is_read (is_read),
    INDEX idx_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
