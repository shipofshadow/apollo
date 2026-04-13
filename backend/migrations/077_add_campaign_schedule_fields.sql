-- Migration: 077_add_campaign_schedule_fields
-- Adds scheduling metadata for marketing campaigns.

ALTER TABLE marketing_campaigns
    ADD COLUMN is_scheduled TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN schedule_type ENUM('manual','daily','weekly','monthly') NOT NULL DEFAULT 'manual' AFTER is_scheduled,
    ADD COLUMN schedule_time CHAR(5) NOT NULL DEFAULT '09:00' AFTER schedule_type,
    ADD COLUMN schedule_weekday TINYINT UNSIGNED NULL AFTER schedule_time,
    ADD COLUMN schedule_day TINYINT UNSIGNED NULL AFTER schedule_weekday,
    ADD COLUMN schedule_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila' AFTER schedule_day,
    ADD COLUMN next_run_at TIMESTAMP NULL DEFAULT NULL AFTER last_run_at,
    ADD KEY idx_marketing_campaigns_schedule (is_scheduled, status, next_run_at);