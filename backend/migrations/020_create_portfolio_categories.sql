-- Migration: 020_create_portfolio_categories
-- Stores dynamic categories used to tag portfolio / build showcase items.

CREATE TABLE IF NOT EXISTS portfolio_categories (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150)  NOT NULL,
    sort_order SMALLINT      NOT NULL DEFAULT 0,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
