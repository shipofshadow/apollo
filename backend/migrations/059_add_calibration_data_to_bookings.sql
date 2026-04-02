-- Migration: 059_add_calibration_data_to_bookings
-- Stores lighting calibration results per booking (beam angle, lux output, etc.)
-- as a JSON blob so the schema stays flexible.

ALTER TABLE bookings
    ADD COLUMN calibration_data TEXT NULL AFTER internal_notes;
