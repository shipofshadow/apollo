-- Migration: 069_add_sms_columns_to_notification_preferences
-- Adds per-user SMS opt-in columns to notification_preferences.
-- Defaults to 1 (on) so existing users keep receiving SMS until they opt out.
-- sms_new_booking:      admin/owner/manager/staff receive new booking alert SMS
-- sms_assignment:       staff/manager receive SMS when assigned to a booking
-- sms_status_changed:   client receives SMS on their booking status changes

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS sms_new_booking    TINYINT(1) NOT NULL DEFAULT 1 AFTER email_parts_update,
    ADD COLUMN IF NOT EXISTS sms_assignment     TINYINT(1) NOT NULL DEFAULT 1 AFTER sms_new_booking,
    ADD COLUMN IF NOT EXISTS sms_status_changed TINYINT(1) NOT NULL DEFAULT 1 AFTER sms_assignment;
