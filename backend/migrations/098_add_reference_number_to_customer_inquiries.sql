-- Migration: 098_add_reference_number_to_customer_inquiries
-- Adds `reference_number` column to customer_inquiries table.

ALTER TABLE customer_inquiries
ADD COLUMN reference_number VARCHAR(50) NULL AFTER id;

CREATE INDEX idx_ci_reference_number ON customer_inquiries (reference_number);
