-- Rename the PHP auth-sessions table from user_sessions → auth_sessions.
--
-- Background: migration 045 originally created `user_sessions` for auth
-- session tracking, but the chatbot migration (55_migration_apollo_chatbot.sql)
-- also creates `user_sessions` for chatbot flow state.  Because both use
-- CREATE TABLE IF NOT EXISTS, whichever ran first "won" and the other was
-- silently skipped — causing column-not-found errors on /api/auth/sessions.
--
-- This migration renames the auth table so both can coexist.
-- It is a no-op when auth_sessions already exists (i.e. fresh install).

-- Only rename if the old table has the auth-specific column user_id AND
-- the new name does not yet exist.
DROP PROCEDURE IF EXISTS _rename_auth_sessions;

DELIMITER $$
CREATE PROCEDURE _rename_auth_sessions()
BEGIN
    DECLARE old_has_uid INT DEFAULT 0;
    DECLARE new_exists  INT DEFAULT 0;

    SELECT COUNT(*) INTO old_has_uid
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'user_sessions'
      AND COLUMN_NAME  = 'user_id';

    SELECT COUNT(*) INTO new_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'auth_sessions';

    IF old_has_uid > 0 AND new_exists = 0 THEN
        RENAME TABLE user_sessions TO auth_sessions;
    END IF;
END$$
DELIMITER ;

CALL _rename_auth_sessions();
DROP PROCEDURE IF EXISTS _rename_auth_sessions;

-- Ensure auth_sessions exists for fresh installs that never had user_sessions.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED    NOT NULL,
    token_hash     CHAR(64)        NOT NULL,
    ip_address     VARCHAR(64)     NOT NULL DEFAULT '',
    user_agent     VARCHAR(500)    NOT NULL DEFAULT '',
    issued_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     DATETIME        NOT NULL,
    last_seen_at   DATETIME        NULL,
    revoked_at     DATETIME        NULL,
    revoked_reason VARCHAR(80)     NULL,
    KEY        idx_auth_sessions_user_id    (user_id),
    KEY        idx_auth_sessions_expires_at (expires_at),
    KEY        idx_auth_sessions_revoked_at (revoked_at),
    UNIQUE KEY uq_auth_sessions_token_hash  (token_hash),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
