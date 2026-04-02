-- Migration: 060_add_consent_to_users
-- Adds GDPR / Data Privacy consent timestamp and consent version to users.
-- consented_at is NULL for pre-existing accounts (grandfathered in).

ALTER TABLE users
    ADD COLUMN consented_at      TIMESTAMP NULL     DEFAULT NULL AFTER role,
    ADD COLUMN consent_version   VARCHAR(20) NOT NULL DEFAULT '' AFTER consented_at;
