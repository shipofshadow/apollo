INSERT INTO roles (role_key, name, description, permissions_json, is_system)
VALUES
    ('admin', 'Admin', 'Full control over admin panel and user access.', JSON_ARRAY(
        'analytics:view', 'bookings:manage', 'bookings:assign-tech', 'bookings:notes',
        'build-updates:manage', 'clients:manage', 'users:manage', 'roles:view',
        'roles:manage', 'reviews:manage', 'shop-hours:manage', 'media:upload'
    ), 1),
    ('manager', 'Manager', 'Operations and analytics access without user or role administration.', JSON_ARRAY(
        'analytics:view', 'bookings:manage', 'bookings:assign-tech', 'bookings:notes',
        'build-updates:manage', 'clients:manage', 'roles:view', 'reviews:manage'
    ), 1),
    ('staff', 'Staff', 'Day-to-day booking and client operations access.', JSON_ARRAY(
        'bookings:manage', 'build-updates:manage', 'clients:manage', 'roles:view'
    ), 1),
    ('client', 'Client', 'Client portal access for own account only.', JSON_ARRAY('client:self'), 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    permissions_json = VALUES(permissions_json),
    is_system = VALUES(is_system);
