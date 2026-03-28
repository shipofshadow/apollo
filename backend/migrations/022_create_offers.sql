CREATE TABLE IF NOT EXISTS offers (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(300)  NOT NULL DEFAULT '',
    subtitle         VARCHAR(300)  NOT NULL DEFAULT '',
    description      TEXT          NOT NULL DEFAULT '',
    badge_text       VARCHAR(100)  NOT NULL DEFAULT 'Limited Time Offer',
    cta_text         VARCHAR(100)  NOT NULL DEFAULT 'Claim Your Offer',
    cta_url          VARCHAR(500)  NOT NULL DEFAULT '#contact',
    linked_service_id INT UNSIGNED NULL DEFAULT NULL,
    linked_product_id INT UNSIGNED NULL DEFAULT NULL,
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order       SMALLINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
