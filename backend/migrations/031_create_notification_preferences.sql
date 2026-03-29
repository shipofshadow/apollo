-- Migration: 031_create_notification_preferences
-- Per-user opt-in/opt-out settings for each notification channel (email and
-- in-app) per notification type.  Defaults to "everything on" – a row is only
-- created when the user first saves their preferences.

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id              INT UNSIGNED NOT NULL PRIMARY KEY,
    -- email channel per type
    email_new_booking    TINYINT(1)   NOT NULL DEFAULT 1,
    email_status_changed TINYINT(1)   NOT NULL DEFAULT 1,
    email_build_update   TINYINT(1)   NOT NULL DEFAULT 1,
    email_parts_update   TINYINT(1)   NOT NULL DEFAULT 1,
    -- in-app channel per type
    inapp_status_changed TINYINT(1)   NOT NULL DEFAULT 1,
    inapp_build_update   TINYINT(1)   NOT NULL DEFAULT 1,
    inapp_parts_update   TINYINT(1)   NOT NULL DEFAULT 1,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
