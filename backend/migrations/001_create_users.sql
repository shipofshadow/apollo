-- Migration: 001_create_users
-- Creates the users table for client and admin accounts.

CREATE TABLE IF NOT EXISTS users (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(200)                       NOT NULL,
    email      VARCHAR(255)                       NOT NULL,
    phone      VARCHAR(30)                        NOT NULL DEFAULT '',
    password   VARCHAR(255)                       NOT NULL,
    role       ENUM('client','admin')             NOT NULL DEFAULT 'client',
    created_at TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP                          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                           ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
