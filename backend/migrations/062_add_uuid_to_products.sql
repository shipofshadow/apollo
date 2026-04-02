-- Migration: 062_add_uuid_to_products
-- Adds stable UUID identifiers for products so routes can use UUIDs.

ALTER TABLE products
    ADD COLUMN uuid CHAR(36) NULL AFTER id;

UPDATE products
SET uuid = UUID()
WHERE uuid IS NULL OR uuid = '';

ALTER TABLE products
    MODIFY uuid CHAR(36) NOT NULL;

ALTER TABLE products
    ADD UNIQUE KEY uq_products_uuid (uuid);
