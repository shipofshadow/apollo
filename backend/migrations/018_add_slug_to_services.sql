-- Add slug column to services table and backfill from titles.
-- Slugs are lowercase, hyphen-separated, URL-safe identifiers.

ALTER TABLE services
    ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '' AFTER title;

-- Backfill: convert title to slug (lowercase, spaces → hyphens, strip non-alnum/hyphen)
UPDATE services
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9 ]', ''), ' +', '-'))
WHERE slug = '';

ALTER TABLE services
    ADD UNIQUE KEY uq_services_slug (slug);
