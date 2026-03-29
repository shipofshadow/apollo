CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_key VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    permissions_json JSON NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_roles_role_key (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
    MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'client';

INSERT INTO roles (role_key, name, description, permissions_json, is_system)
VALUES
    ('admin', 'Admin', 'Full control over admin panel and user access.', JSON_ARRAY(
        'analytics:view', 'bookings:manage', 'clients:manage', 'users:manage', 'roles:manage',
        'services:manage', 'products:manage', 'content:manage', 'settings:manage'
    ), 1),
    ('manager', 'Manager', 'Operations and analytics access without user or role administration.', JSON_ARRAY(
        'analytics:view', 'bookings:manage', 'clients:manage', 'calendar:view'
    ), 1),
    ('staff', 'Staff', 'Day-to-day booking and client operations access.', JSON_ARRAY(
        'bookings:manage', 'clients:manage', 'calendar:view'
    ), 1),
    ('client', 'Client', 'Client portal access for own account only.', JSON_ARRAY(
        'client:self'
    ), 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    permissions_json = VALUES(permissions_json),
    is_system = VALUES(is_system);
