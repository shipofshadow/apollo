-- Migration: 078_ensure_notifications_user_id
-- Safety migration for legacy databases where notifications.user_id may be missing.
-- Also backfills user_id from JSON payload key `_targetUserId` when present.

SET @db_name := DATABASE();

-- Add notifications.user_id if missing.
SET @has_user_id := (
    SELECT COUNT(*)
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db_name
       AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME = 'user_id'
);
SET @sql_add_user_id := IF(
    @has_user_id = 0,
    'ALTER TABLE notifications ADD COLUMN user_id INT UNSIGNED NULL DEFAULT NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql_add_user_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure index on user_id.
SET @has_user_idx := (
    SELECT COUNT(*)
      FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db_name
       AND TABLE_NAME = 'notifications'
       AND INDEX_NAME = 'idx_notifications_user'
);
SET @sql_add_user_idx := IF(
    @has_user_idx = 0,
    'ALTER TABLE notifications ADD INDEX idx_notifications_user (user_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql_add_user_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill user_id from legacy payload marker when possible.
-- Example payload: {"_targetUserId": 123, ...}
UPDATE notifications
   SET user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$._targetUserId')) AS UNSIGNED)
 WHERE user_id IS NULL
   AND data IS NOT NULL
   AND JSON_VALID(data)
   AND JSON_EXTRACT(data, '$._targetUserId') IS NOT NULL;
