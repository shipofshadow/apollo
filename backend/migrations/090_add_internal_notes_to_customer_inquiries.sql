-- Migration: 090_add_internal_notes_to_customer_inquiries
-- Adds an `internal_notes` column to the customer_inquiries table so admins can store internal notes about the inquiry.

ALTER TABLE customer_inquiries
    ADD COLUMN internal_notes TEXT NULL AFTER status;
