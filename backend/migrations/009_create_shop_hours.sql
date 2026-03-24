-- Migration: 009_create_shop_hours
-- Stores per-day-of-week shop opening hours and appointment slot configuration.
-- day_of_week follows PHP / JS convention: 0 = Sunday … 6 = Saturday.

CREATE TABLE IF NOT EXISTS shop_hours (
    id              TINYINT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    day_of_week     TINYINT UNSIGNED  NOT NULL UNIQUE
                    COMMENT '0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat',
    is_open         TINYINT(1)        NOT NULL DEFAULT 1,
    open_time       TIME              NOT NULL DEFAULT '09:00:00',
    close_time      TIME              NOT NULL DEFAULT '18:00:00',
    slot_interval_h TINYINT UNSIGNED  NOT NULL DEFAULT 2
                    COMMENT 'Appointment slot interval in hours (1, 2, or 3)',
    updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                               ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default hours: Mon–Sat open 09:00–18:00, 2 h slots; Sunday closed.
INSERT INTO shop_hours (day_of_week, is_open, open_time, close_time, slot_interval_h)
VALUES
    (0, 0, '09:00:00', '18:00:00', 2),
    (1, 1, '09:00:00', '18:00:00', 2),
    (2, 1, '09:00:00', '18:00:00', 2),
    (3, 1, '09:00:00', '18:00:00', 2),
    (4, 1, '09:00:00', '18:00:00', 2),
    (5, 1, '09:00:00', '18:00:00', 2),
    (6, 1, '09:00:00', '18:00:00', 2)
ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week);
