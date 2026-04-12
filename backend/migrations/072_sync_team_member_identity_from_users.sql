-- Migration: 072_sync_team_member_identity_from_users
-- Purpose: normalize team_members identity fields from users for linked rows.
-- users table remains source of truth for name/role/email/phone.

UPDATE team_members tm
JOIN users u ON u.id = tm.user_id
SET
  tm.name  = u.name,
  tm.role  = u.role,
  tm.email = u.email,
  tm.phone = u.phone
WHERE tm.user_id IS NOT NULL;
