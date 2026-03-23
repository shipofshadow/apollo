-- Migration: 006_create_blog_posts
-- Stores admin-authored blog posts shown on the public /blog page.

CREATE TABLE IF NOT EXISTS blog_posts (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(255)  NOT NULL,
    content    TEXT          NOT NULL,
    status     ENUM('Draft','Published') NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
