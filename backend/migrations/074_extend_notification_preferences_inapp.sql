-- Migration: 074_extend_notification_preferences_inapp
-- Adds more in-app preference switches used by the notification center.

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS inapp_new_booking    TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_parts_update,
    ADD COLUMN IF NOT EXISTS inapp_assignment     TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_new_booking,
    ADD COLUMN IF NOT EXISTS inapp_security_alert TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_assignment,
    ADD COLUMN IF NOT EXISTS inapp_slot_available TINYINT(1) NOT NULL DEFAULT 1 AFTER inapp_security_alert;
