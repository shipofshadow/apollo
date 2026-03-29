-- Migration: 028_create_password_resets
-- Creates the password_resets table used by the forgot-password flow.
-- A token (SHA-256 hex, 64 chars) is stored together with the requesting
-- email address and an expiry timestamp.  Used tokens or expired rows are
-- deleted after the reset is processed.

CREATE TABLE IF NOT EXISTS password_resets (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(255)  NOT NULL,
    token      CHAR(64)      NOT NULL,
    expires_at TIMESTAMP     NOT NULL,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_resets_email   (email),
    INDEX idx_password_resets_expires (expires_at),
    UNIQUE KEY uq_password_resets_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
