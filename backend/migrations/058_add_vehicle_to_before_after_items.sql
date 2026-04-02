-- Migration: 058_add_vehicle_to_before_after_items
-- Adds optional vehicle_make and vehicle_model columns to before_after_items
-- so showcase entries can be tagged with the car model for filtering.

ALTER TABLE before_after_items
    ADD COLUMN vehicle_make  VARCHAR(100) NOT NULL DEFAULT '' AFTER description,
    ADD COLUMN vehicle_model VARCHAR(100) NOT NULL DEFAULT '' AFTER vehicle_make;
