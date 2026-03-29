ALTER TABLE users
    MODIFY COLUMN role ENUM('client','staff','manager','admin') NOT NULL DEFAULT 'client';
