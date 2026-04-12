-- Migration: 071_remove_clients_from_team_members
-- Purpose: Ensure team_members excludes client accounts.
-- Removes rows that are explicitly marked as client OR linked to users.role = client.

DELETE tm
FROM team_members tm
LEFT JOIN users u ON u.id = tm.user_id
WHERE LOWER(TRIM(COALESCE(tm.role, ''))) = 'client'
   OR LOWER(TRIM(COALESCE(u.role, ''))) = 'client';
