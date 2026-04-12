-- Migration: 068_add_owner_role_and_unlock_defaults
-- 1. Makes all existing roles fully modifiable (is_system = 0).
-- 2. Upserts the Owner role with every available permission.
-- 3. Patches the admin DB record to include permissions only present in the
--    Router fallback (services:manage, products:manage, content:manage,
--    settings:manage) so DB and fallback stay consistent.

-- Unlock all existing roles
UPDATE roles SET is_system = 0 WHERE is_system = 1;

-- Upsert owner role
INSERT INTO roles (role_key, name, description, permissions_json, is_system)
VALUES (
    'owner',
    'Owner',
    'Full unrestricted access to all admin features and settings.',
    JSON_ARRAY(
        'analytics:view',
        'bookings:manage',
        'bookings:assign-tech',
        'bookings:notes',
        'chatbot:manage',
        'build-updates:manage',
        'clients:manage',
        'users:manage',
        'roles:view',
        'roles:manage',
        'security:audit:view',
        'reviews:manage',
        'services:manage',
        'products:manage',
        'content:manage',
        'settings:manage',
        'shop-hours:manage',
        'media:upload'
    ),
    0
)
ON DUPLICATE KEY UPDATE
    name            = VALUES(name),
    description     = VALUES(description),
    permissions_json = VALUES(permissions_json),
    is_system       = VALUES(is_system);

-- Patch admin to include permissions that were only in the Router fallback
UPDATE roles
SET permissions_json = JSON_ARRAY(
    'analytics:view',
    'bookings:manage',
    'bookings:assign-tech',
    'bookings:notes',
    'chatbot:manage',
    'build-updates:manage',
    'clients:manage',
    'users:manage',
    'roles:view',
    'roles:manage',
    'security:audit:view',
    'reviews:manage',
    'services:manage',
    'products:manage',
    'content:manage',
    'settings:manage',
    'shop-hours:manage',
    'media:upload'
)
WHERE role_key = 'admin';
