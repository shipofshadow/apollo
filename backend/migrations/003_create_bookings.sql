-- Migration: 003_create_bookings
-- Appointment/booking records. user_id is nullable for walk-in / anonymous bookings.

CREATE TABLE IF NOT EXISTS bookings (
    id               CHAR(36)      NOT NULL PRIMARY KEY        COMMENT 'UUID v4',
    user_id          INT UNSIGNED  DEFAULT NULL,
    name             VARCHAR(200)  NOT NULL,
    email            VARCHAR(255)  NOT NULL,
    phone            VARCHAR(30)   NOT NULL,
    vehicle_info     VARCHAR(255)  NOT NULL,
    service_id       VARCHAR(50)   NOT NULL,
    service_name     VARCHAR(200)  NOT NULL,
    appointment_date DATE          NOT NULL,
    appointment_time VARCHAR(20)   NOT NULL,
    notes            TEXT          DEFAULT NULL,
    status           ENUM('pending','confirmed','completed','cancelled')
                                   NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
