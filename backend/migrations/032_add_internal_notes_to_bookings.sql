-- Migration: 032_add_internal_notes_to_bookings
-- Adds an `internal_notes` column to the bookings table so admins can store
-- private notes that are never shown to the client.

ALTER TABLE bookings
    ADD COLUMN internal_notes TEXT NULL AFTER parts_notes;
