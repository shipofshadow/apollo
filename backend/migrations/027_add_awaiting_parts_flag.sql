-- Migration: 027_add_awaiting_parts_flag
-- Adds a dedicated boolean column `awaiting_parts` to the bookings table so
-- that the parts-dependency state can be tracked independently of the status
-- ENUM.  This fixes the SQLSTATE[42S22] "Unknown column 'awaiting_parts'"
-- error that occurred when the admin toggled the awaiting-parts flag.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS awaiting_parts TINYINT(1) NOT NULL DEFAULT 0 AFTER parts_notes;
