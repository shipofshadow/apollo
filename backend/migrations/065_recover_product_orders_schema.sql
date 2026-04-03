-- Migration: 065_recover_product_orders_schema
-- Recovers order-related schema when 064 was partially applied.

SET @has_products_track_stock := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'track_stock'
);
SET @sql := IF(
    @has_products_track_stock = 0,
    'ALTER TABLE products ADD COLUMN track_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_products_stock_qty := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'stock_qty'
);
SET @sql := IF(
    @has_products_stock_qty = 0,
    'ALTER TABLE products ADD COLUMN stock_qty INT NOT NULL DEFAULT 0 AFTER track_stock',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pvar_track_stock := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_variations'
      AND COLUMN_NAME = 'track_stock'
);
SET @sql := IF(
    @has_pvar_track_stock = 0,
    'ALTER TABLE product_variations ADD COLUMN track_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pvar_stock_qty := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_variations'
      AND COLUMN_NAME = 'stock_qty'
);
SET @sql := IF(
    @has_pvar_stock_qty = 0,
    'ALTER TABLE product_variations ADD COLUMN stock_qty INT NOT NULL DEFAULT 0 AFTER track_stock',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS product_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL,
    user_id INT UNSIGNED NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    fulfillment_type ENUM('courier', 'walk_in') NOT NULL DEFAULT 'courier',
    delivery_address TEXT NULL,
    delivery_city VARCHAR(120) NOT NULL DEFAULT '',
    delivery_province VARCHAR(120) NOT NULL DEFAULT '',
    delivery_postal_code VARCHAR(20) NOT NULL DEFAULT '',
    status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')
        NOT NULL DEFAULT 'pending',
    payment_status ENUM('unpaid', 'paid', 'cod') NOT NULL DEFAULT 'unpaid',
    courier_name VARCHAR(120) NOT NULL DEFAULT '',
    tracking_number VARCHAR(120) NOT NULL DEFAULT '',
    notes TEXT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_orders_order_number (order_number),
    KEY idx_product_orders_user_id (user_id),
    KEY idx_product_orders_status (status),
    KEY idx_product_orders_created_at (created_at),
    CONSTRAINT fk_product_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    variation_id INT UNSIGNED NULL,
    product_name VARCHAR(255) NOT NULL,
    variation_name VARCHAR(255) NOT NULL DEFAULT '',
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_product_order_items_order_id (order_id),
    KEY idx_product_order_items_product_id (product_id),
    CONSTRAINT fk_product_order_items_order FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_order_items_variation FOREIGN KEY (variation_id) REFERENCES product_variations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
