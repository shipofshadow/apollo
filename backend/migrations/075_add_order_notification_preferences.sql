-- Migration: 075_add_order_notification_preferences
-- Adds email and in-app preference switches for product order notifications.

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS email_new_order      TINYINT(1) NOT NULL DEFAULT 1 AFTER email_new_booking,
    ADD COLUMN IF NOT EXISTS email_order_created  TINYINT(1) NOT NULL DEFAULT 1 AFTER email_new_order,
    ADD COLUMN IF NOT EXISTS email_order_status   TINYINT(1) NOT NULL DEFAULT 1 AFTER email_order_created,
    ADD COLUMN IF NOT EXISTS email_order_tracking TINYINT(1) NOT NULL DEFAULT 1 AFTER email_order_status,
    ADD COLUMN IF NOT EXISTS inapp_new_order      TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_new_booking,
    ADD COLUMN IF NOT EXISTS inapp_order_created  TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_new_order,
    ADD COLUMN IF NOT EXISTS inapp_order_status   TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_order_created,
    ADD COLUMN IF NOT EXISTS inapp_order_tracking TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_order_status;