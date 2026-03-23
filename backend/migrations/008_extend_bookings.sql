-- Migration: 008_extend_bookings
-- Extends the bookings table with new fields for:
--   * structured vehicle data  (make / model / year)
--   * multi-service support    (service_ids JSON array)
--   * digital waiver           (signature_data)
--   * media uploads            (media_urls JSON array)
--   * parts-dependency status  (awaiting_parts flag + notes)

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS vehicle_make    VARCHAR(100)  DEFAULT NULL          AFTER vehicle_info,
    ADD COLUMN IF NOT EXISTS vehicle_model   VARCHAR(100)  DEFAULT NULL          AFTER vehicle_make,
    ADD COLUMN IF NOT EXISTS vehicle_year    VARCHAR(4)    DEFAULT NULL          AFTER vehicle_model,
    ADD COLUMN IF NOT EXISTS service_ids     TEXT          DEFAULT NULL          AFTER service_id,
    ADD COLUMN IF NOT EXISTS signature_data  MEDIUMTEXT    DEFAULT NULL          AFTER notes,
    ADD COLUMN IF NOT EXISTS media_urls      TEXT          DEFAULT NULL          AFTER signature_data,
    ADD COLUMN IF NOT EXISTS awaiting_parts  TINYINT(1)    NOT NULL DEFAULT 0    AFTER status,
    ADD COLUMN IF NOT EXISTS parts_notes     TEXT          DEFAULT NULL          AFTER awaiting_parts;
