CREATE TABLE IF NOT EXISTS booking_activity_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    actor_user_id INT UNSIGNED DEFAULT NULL,
    actor_role ENUM('system', 'admin', 'client') NOT NULL DEFAULT 'system',
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(191) NOT NULL,
    detail TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_booking_activity_booking (booking_id),
    INDEX idx_booking_activity_created (created_at),
    CONSTRAINT fk_booking_activity_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_activity_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill a baseline log entry for existing bookings.
INSERT INTO booking_activity_logs (booking_id, actor_user_id, actor_role, event_type, action, detail, created_at)
SELECT
    b.id,
    NULL,
    'system',
    'booking_submitted',
    'Booking submitted',
    CONCAT('Status: ', REPLACE(b.status, '_', ' ')),
    b.created_at
FROM bookings b
WHERE NOT EXISTS (
    SELECT 1
    FROM booking_activity_logs l
    WHERE l.booking_id = b.id
      AND l.event_type = 'booking_submitted'
);
