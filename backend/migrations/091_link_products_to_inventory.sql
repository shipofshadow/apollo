-- Migration: 091_link_products_to_inventory
-- Links public catalog products to internal inventory_items and drops the manual stock_qty column.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS inventory_item_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER track_stock;

-- Drop the old stock_qty column since inventory_items.qty_on_hand is the new source of truth
ALTER TABLE products
DROP COLUMN stock_qty;

ALTER TABLE products
ADD CONSTRAINT fk_products_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;
