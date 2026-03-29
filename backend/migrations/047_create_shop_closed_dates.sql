-- Migration: 047_create_shop_closed_dates
-- Stores one-off shop closure dates (holidays, special closures).
-- These override the regular weekly shop_hours schedule for that specific date.

CREATE TABLE IF NOT EXISTS shop_closed_dates (
    id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    closed_date DATE         NOT NULL UNIQUE COMMENT 'The calendar date that is closed',
    reason     VARCHAR(255)  NULL     DEFAULT NULL COMMENT 'Optional label shown to clients',
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
