-- Migration: 007_create_products
-- Stores the product catalog managed through the admin panel.

CREATE TABLE IF NOT EXISTS products (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255)  NOT NULL,
    description  TEXT          NOT NULL DEFAULT '',
    price        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    category     VARCHAR(100)  NOT NULL DEFAULT '',
    image_url    VARCHAR(500)  NOT NULL DEFAULT '',
    features     TEXT          NOT NULL DEFAULT ''  COMMENT 'JSON array of feature strings',
    sort_order   SMALLINT      NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
