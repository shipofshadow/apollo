-- Migration: 030_create_booking_reviews
-- Clients can leave a star rating (1-5) and optional review text after their
-- booking is marked completed.  Reviews default to NOT approved; admins must
-- explicitly approve them before they appear publicly (e.g. on Testimonials).

CREATE TABLE IF NOT EXISTS booking_reviews (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id  VARCHAR(36)   NOT NULL,
    user_id     INT UNSIGNED  NOT NULL,
    rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review      TEXT          DEFAULT NULL,
    is_approved TINYINT(1)    NOT NULL DEFAULT 0,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY  uq_booking_review (booking_id),
    INDEX idx_booking_reviews_user     (user_id),
    INDEX idx_booking_reviews_approved (is_approved),
    INDEX idx_booking_reviews_rating   (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
