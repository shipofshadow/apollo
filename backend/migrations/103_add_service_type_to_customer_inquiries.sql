-- Migration: 103_add_service_type_to_customer_inquiries
-- Adds a `service_type` column to customer_inquiries table to distinguish between 'shop_visit' and 'home_service'.

ALTER TABLE customer_inquiries
    ADD COLUMN service_type VARCHAR(50) NOT NULL DEFAULT 'shop_visit'
        AFTER service_id;

CREATE INDEX idx_ci_service_type ON customer_inquiries (service_type);
