-- Migration: 096_add_service_field_value_to_inquiry_checklists
-- Adds service_field_value to inquiry_checklists

ALTER TABLE inquiry_checklists
ADD COLUMN service_field_value TEXT NULL AFTER general_notes;
