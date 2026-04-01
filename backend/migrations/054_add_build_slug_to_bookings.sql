-- Migration: 054_add_build_slug_to_bookings
-- Adds a deterministic build_slug on bookings for portfolio/build showcase links.

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS build_slug VARCHAR(255) DEFAULT NULL AFTER source,
    ADD INDEX IF NOT EXISTS idx_bookings_build_slug (build_slug);

-- Backfill completed bookings from active portfolio items by matching
-- booking reference number inside portfolio title/description.
UPDATE bookings b
JOIN (
    SELECT
        b2.id AS booking_id,
        SUBSTRING_INDEX(
            GROUP_CONCAT(
                DISTINCT TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(p.title), '[^a-z0-9]+', '-'))
                ORDER BY p.sort_order ASC, p.id ASC
                SEPARATOR ','
            ),
            ',',
            1
        ) AS resolved_slug
    FROM bookings b2
    JOIN portfolio p
      ON p.is_active = 1
     AND b2.reference_number IS NOT NULL
     AND b2.reference_number <> ''
     AND LOWER(CONCAT(IFNULL(p.title, ''), ' ', IFNULL(p.description, '')))
         LIKE CONCAT('%', LOWER(b2.reference_number), '%')
    WHERE b2.status = 'completed'
    GROUP BY b2.id
) matched ON matched.booking_id = b.id
SET b.build_slug = matched.resolved_slug
WHERE (b.build_slug IS NULL OR b.build_slug = '')
  AND matched.resolved_slug IS NOT NULL
  AND matched.resolved_slug <> '';
