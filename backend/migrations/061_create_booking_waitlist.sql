-- Migration: 061_create_booking_waitlist
-- Stores customers who want to be notified when a fully-booked time slot
-- becomes available due to a cancellation.

CREATE TABLE IF NOT EXISTS booking_waitlist (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slot_date        DATE         NOT NULL,
    slot_time        VARCHAR(20)  NOT NULL,
    user_id          INT UNSIGNED NULL,            -- NULL for guest waitlists
    name             VARCHAR(200) NOT NULL DEFAULT '',
    email            VARCHAR(255) NOT NULL DEFAULT '',
    phone            VARCHAR(30)  NOT NULL DEFAULT '',
    service_ids      TEXT         NOT NULL DEFAULT '',  -- comma-separated
    notes            TEXT         NULL,
    status           ENUM('waiting','notified','booked','expired')
                                  NOT NULL DEFAULT 'waiting',
    notified_at      TIMESTAMP    NULL DEFAULT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bwl_slot       (slot_date, slot_time),
    INDEX idx_bwl_status     (status),
    INDEX idx_bwl_user       (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
