-- Migration: 079_extend_campaign_category_and_email_html
-- Adds optional campaign category and rich email HTML body support.

ALTER TABLE marketing_campaigns
    ADD COLUMN category VARCHAR(120) NULL DEFAULT NULL AFTER name,
    ADD COLUMN message_html MEDIUMTEXT NULL AFTER message;
