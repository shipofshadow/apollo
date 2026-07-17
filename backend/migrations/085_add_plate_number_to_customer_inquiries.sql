-- Migration: 085_add_plate_number_to_customer_inquiries
-- Adds `plate_number` column to existing customer_inquiries table.

ALTER TABLE customer_inquiries
  ADD COLUMN plate_number VARCHAR(50) NULL AFTER contact_number;

-- Optional: add an index if you expect lookups by plate
-- CREATE INDEX IF NOT EXISTS idx_inquiries_plate_number ON customer_inquiries (plate_number(20));
