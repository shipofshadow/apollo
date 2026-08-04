-- Migration: 090_add_product_id_to_inquiries
-- Links customer inquiries to a specific product by ID and adds additional info.

-- Fix data type (it was already added as INT in a failed run)
ALTER TABLE customer_inquiries
MODIFY COLUMN product_id INT UNSIGNED NULL;

ALTER TABLE customer_inquiries
ADD CONSTRAINT fk_customer_inquiries_product_id
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;
