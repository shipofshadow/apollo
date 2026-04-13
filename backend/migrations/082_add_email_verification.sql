-- Migration: 082_add_email_verification
-- Adds verification state to users and token storage for email verification.

ALTER TABLE users
    ADD COLUMN email_verified_at DATETIME NULL AFTER email;

CREATE TABLE IF NOT EXISTS email_verifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL,
    token CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email_verifications_token (token),
    KEY idx_email_verifications_user_id (user_id),
    KEY idx_email_verifications_email (email),
    KEY idx_email_verifications_expires_at (expires_at),
    CONSTRAINT fk_email_verifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
