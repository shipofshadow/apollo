-- Migration: 019_create_facebook_pages
-- Stores long-lived Facebook Page Access Tokens managed through the admin panel.
-- Requires FB_APP_ID and FB_APP_SECRET to be set in backend/.env.

CREATE TABLE IF NOT EXISTS facebook_pages (
    id                INT UNSIGNED   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    page_id           VARCHAR(64)    NOT NULL UNIQUE,
    page_name         VARCHAR(255)   NOT NULL DEFAULT '',
    page_access_token TEXT           NOT NULL,
    token_valid       TINYINT(1)     NOT NULL DEFAULT 1,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_token_valid (token_valid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
