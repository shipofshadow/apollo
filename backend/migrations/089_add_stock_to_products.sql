-- Migration: 089_add_stock_to_products
-- Adds stock tracking capabilities to the products table.

-- MariaDB IF NOT EXISTS syntax for ADD COLUMN
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_stock TINYINT(1) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS stock_qty INT NOT NULL DEFAULT 0;
