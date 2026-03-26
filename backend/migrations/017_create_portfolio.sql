-- Migration: 017_create_portfolio
-- Stores portfolio / build showcase items managed through the admin panel.

CREATE TABLE IF NOT EXISTS portfolio (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(255)  NOT NULL,
    category     VARCHAR(100)  NOT NULL DEFAULT '',
    description  TEXT          NOT NULL DEFAULT '',
    image_url    VARCHAR(500)  NOT NULL DEFAULT '',
    sort_order   SMALLINT      NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
