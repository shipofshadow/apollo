-- Migration: 008_extend_bookings
-- Extends the bookings table with new fields for:
--   * structured vehicle data  (make / model / year)
--   * multi-service support    (service_ids JSON array)
--   * digital waiver           (signature_data)
--   * media uploads            (media_urls JSON array)
--   * parts-dependency notes   (parts_notes)
--
-- Parts-dependency status uses the existing status ENUM — the value
-- 'awaiting_parts' is added to the ENUM rather than adding a boolean column.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS vehicle_make   VARCHAR(100)  DEFAULT NULL  AFTER vehicle_info,
    ADD COLUMN IF NOT EXISTS vehicle_model  VARCHAR(100)  DEFAULT NULL  AFTER vehicle_make,
    ADD COLUMN IF NOT EXISTS vehicle_year   VARCHAR(4)    DEFAULT NULL  AFTER vehicle_model,
    ADD COLUMN IF NOT EXISTS service_ids    TEXT          DEFAULT NULL  AFTER service_id,
    ADD COLUMN IF NOT EXISTS signature_data MEDIUMTEXT    DEFAULT NULL  AFTER notes,
    ADD COLUMN IF NOT EXISTS media_urls     TEXT          DEFAULT NULL  AFTER signature_data,
    ADD COLUMN IF NOT EXISTS parts_notes    TEXT          DEFAULT NULL  AFTER status;

-- Extend the status ENUM to include awaiting_parts
ALTER TABLE bookings
    MODIFY COLUMN status ENUM('pending','confirmed','completed','cancelled','awaiting_parts')
                         NOT NULL DEFAULT 'pending';
