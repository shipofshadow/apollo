-- Migration: 070_normalize_team_member_user_links
-- Purpose:
-- 1) Backfill team_members.user_id from users using normalized email first.
-- 2) Backfill remaining links using normalized PH phone numbers.
-- 3) Skip client-role users for technician/team-member links.

-- Email-based link (case/whitespace normalized)
UPDATE team_members tm
JOIN users u ON LOWER(TRIM(tm.email)) = LOWER(TRIM(u.email))
SET tm.user_id = u.id
WHERE tm.user_id IS NULL
  AND tm.email IS NOT NULL
  AND tm.email <> ''
  AND u.role <> 'client';

-- Phone-based link (supports 09XXXXXXXXX, 9XXXXXXXXX, and 639XXXXXXXXX)
UPDATE team_members tm
JOIN users u ON
  (CASE
    WHEN LEFT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 2) = '63'
      THEN CONCAT('0', SUBSTRING(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 3))
    WHEN LEFT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 1) = '9'
         AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 10
      THEN CONCAT('0', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''))
    ELSE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(tm.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', '')
  END)
  =
  (CASE
    WHEN LEFT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 2) = '63'
      THEN CONCAT('0', SUBSTRING(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 3))
    WHEN LEFT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 1) = '9'
         AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 10
      THEN CONCAT('0', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''))
    ELSE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', '')
  END)
SET tm.user_id = u.id
WHERE tm.user_id IS NULL
  AND COALESCE(tm.phone, '') <> ''
  AND COALESCE(u.phone, '') <> ''
  AND u.role <> 'client';
