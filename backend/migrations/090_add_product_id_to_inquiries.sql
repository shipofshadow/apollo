-- Migration: 090_add_product_id_to_inquiries
-- Links customer inquiries to a specific product by ID and adds additional info.

ALTER TABLE customer_inquiries
ADD COLUMN product_id INT UNSIGNED NULL AFTER year_model,
ADD COLUMN additional_info TEXT NULL AFTER product_to_purchase;

ALTER TABLE customer_inquiries
ADD CONSTRAINT fk_customer_inquiries_product_id
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;
