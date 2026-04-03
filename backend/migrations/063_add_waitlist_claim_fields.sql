-- Migration: 063_add_waitlist_claim_fields
-- Adds claim token workflow for waitlist auto-fill automation.

SET @has_claim_token := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND COLUMN_NAME = 'claim_token'
);

SET @sql := IF(
    @has_claim_token = 0,
    'ALTER TABLE booking_waitlist ADD COLUMN claim_token CHAR(64) NULL AFTER notified_at',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_claim_expires_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND COLUMN_NAME = 'claim_expires_at'
);

SET @sql := IF(
    @has_claim_expires_at = 0,
    'ALTER TABLE booking_waitlist ADD COLUMN claim_expires_at TIMESTAMP NULL DEFAULT NULL AFTER claim_token',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_claimed_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND COLUMN_NAME = 'claimed_at'
);

SET @sql := IF(
    @has_claimed_at = 0,
    'ALTER TABLE booking_waitlist ADD COLUMN claimed_at TIMESTAMP NULL DEFAULT NULL AFTER claim_expires_at',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_booked_booking_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND COLUMN_NAME = 'booked_booking_id'
);

SET @sql := IF(
    @has_booked_booking_id = 0,
    'ALTER TABLE booking_waitlist ADD COLUMN booked_booking_id CHAR(36) NULL AFTER claimed_at',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_claim_token := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND INDEX_NAME = 'idx_bwl_claim_token'
);

SET @sql := IF(
    @has_idx_claim_token = 0,
    'ALTER TABLE booking_waitlist ADD INDEX idx_bwl_claim_token (claim_token)',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_claim_expiry := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_waitlist'
      AND INDEX_NAME = 'idx_bwl_claim_expiry'
);

SET @sql := IF(
    @has_idx_claim_expiry = 0,
    'ALTER TABLE booking_waitlist ADD INDEX idx_bwl_claim_expiry (claim_expires_at)',
    'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
