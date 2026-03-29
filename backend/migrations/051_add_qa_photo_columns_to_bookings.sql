-- Migration: 051_add_qa_photo_columns_to_bookings
-- Stores dedicated before/after photo sets for QA check-in and completion workflows.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS before_media_urls TEXT NULL AFTER media_urls,
    ADD COLUMN IF NOT EXISTS after_media_urls  TEXT NULL AFTER before_media_urls;
