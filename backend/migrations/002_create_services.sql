-- Migration: 002_create_services
-- Stores all service offerings (headlight retrofits, headunits, etc.).
-- Features are stored in the service_features table (1NF).

CREATE TABLE IF NOT EXISTS services (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200)  NOT NULL,
    description      TEXT          NOT NULL                COMMENT 'Short card description',
    full_description TEXT          NOT NULL DEFAULT ''     COMMENT 'Long detail-page description',
    icon             VARCHAR(50)   NOT NULL DEFAULT 'Wrench'
                                            COMMENT 'Lucide icon name (Lightbulb, MonitorPlay …)',
    image_url        VARCHAR(500)  NOT NULL DEFAULT ''     COMMENT 'Hero image URL',
    duration         VARCHAR(80)   NOT NULL DEFAULT ''     COMMENT 'e.g. 4-6 Hours',
    starting_price   VARCHAR(80)   NOT NULL DEFAULT ''     COMMENT 'e.g. ₱13,750',
    sort_order       SMALLINT      NOT NULL DEFAULT 0,
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
