-- Migration: 080_cleanup_orphaned_targeted_notifications
-- Cleans up legacy/malformed notifications that were intended for a specific
-- user but ended up without a valid target, causing them to appear in admin
-- or staff feeds as if they were broadcasts.
--
-- Strategy:
-- 1. Re-backfill notifications.user_id from legacy JSON payload marker
--    `_targetUserId` when possible.
-- 2. Remove client/staff-targeted notification rows that still have no valid
--    target after backfill.
--
-- Broadcast/admin notification types such as new_booking, new_order, and
-- security_alert are intentionally left untouched.

-- Re-backfill user_id from legacy payload marker if available.
UPDATE notifications
   SET user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$._targetUserId')) AS UNSIGNED)
 WHERE (user_id IS NULL OR user_id = 0)
   AND data IS NOT NULL
   AND JSON_VALID(data)
   AND JSON_EXTRACT(data, '$._targetUserId') IS NOT NULL
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$._targetUserId')) AS UNSIGNED) > 0;

-- Remove targeted notification rows that still cannot be associated with a
-- specific user. These types are never valid broadcasts.
DELETE FROM notifications
 WHERE type IN (
        'status_changed',
        'build_update',
        'parts_update',
        'order_created',
        'order_status',
        'order_tracking',
        'slot_available',
        'assignment'
    )
   AND (user_id IS NULL OR user_id = 0)
   AND (
        data IS NULL
        OR JSON_VALID(data) = 0
        OR JSON_EXTRACT(data, '$._targetUserId') IS NULL
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$._targetUserId')) AS UNSIGNED) = 0
   );
