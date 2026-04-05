-- Migration: 067_add_is_active_to_users
-- Adds is_active flag to the users table so admin can enable/disable accounts.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role;
