CREATE TABLE IF NOT EXISTS build_updates (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id   CHAR(36)      NOT NULL,
    note         TEXT          DEFAULT NULL,
    photo_urls   TEXT          DEFAULT NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_build_updates_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
