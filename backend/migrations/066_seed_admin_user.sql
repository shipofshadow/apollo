-- Migration: 066_seed_admin_user
-- Seeds a default admin user (idempotent).

INSERT INTO users (name, email, phone, password, role)
VALUES (
    'Admin',
    'admin@1625autolab.com',
    '',
    '$argon2id$v=19$m=65536,t=4,p=1$YUVqV29qZDEyWUs2RGg3Ug$OD0Az+nnjufFjjq4FeU56RaUnKUNbvrFOQ2/CjUE7Bw',
    'admin'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    phone = VALUES(phone),
    password = VALUES(password),
    role = VALUES(role);
