-- Migration: 021_add_images_to_portfolio
-- Adds a JSON-encoded images array column to the portfolio table
-- for storing multiple gallery image URLs per item.

ALTER TABLE portfolio
    ADD COLUMN images TEXT NOT NULL DEFAULT '[]'
        AFTER image_url;
