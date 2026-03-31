-- Migration: 053_support_external_bookings
-- Modifies the bookings table to support external leads (e.g., SendPulse live chat).
-- Makes the email column nullable and adds a lead source tracker.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'website' AFTER status;

    