-- Add slug column to services table and backfill from titles.
-- Slugs are lowercase, hyphen-separated, URL-safe identifiers.

SET @has_services_slug := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'services'
      AND COLUMN_NAME = 'slug'
);

SET @sql := IF(
    @has_services_slug = 0,
    'ALTER TABLE services ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '''' AFTER title',
    'DO 0'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: convert title to slug (lowercase, spaces → hyphens, strip non-alnum/hyphen)
UPDATE services
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9 ]', ''), ' +', '-'))
WHERE slug = '';

SET @has_services_slug_unique := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'services'
      AND INDEX_NAME = 'uq_services_slug'
);

SET @sql := IF(
    @has_services_slug_unique = 0,
    'ALTER TABLE services ADD UNIQUE KEY uq_services_slug (slug)',
    'DO 0'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
