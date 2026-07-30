-- Migration: 088_add_user_id_to_customer_inquiries
-- Adds user_id to link inquiries to registered accounts

ALTER TABLE customer_inquiries
ADD COLUMN user_id VARCHAR(36) NULL DEFAULT NULL AFTER id,
ADD INDEX idx_customer_inquiries_user_id (user_id);
