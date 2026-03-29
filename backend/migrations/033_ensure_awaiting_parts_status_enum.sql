-- Migration: 033_ensure_awaiting_parts_status_enum
-- Ensures the status ENUM on the bookings table includes the 'awaiting_parts'
-- value.  Migration 008 was supposed to add it, but on installations where
-- that statement was skipped or failed silently the value is absent, causing
-- SQLSTATE[01000] "Data truncated for column 'status'" whenever the admin
-- saves an awaiting-parts booking status update.
--
-- Running MODIFY COLUMN with the full ENUM list is idempotent: if
-- 'awaiting_parts' is already present MySQL is a no-op.

ALTER TABLE bookings
    MODIFY COLUMN status ENUM('pending','confirmed','completed','cancelled','awaiting_parts')
                         NOT NULL DEFAULT 'pending';
