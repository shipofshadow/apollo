-- Migration: 005_create_service_features
-- Extracts the feature bullet-points out of the services.features JSON blob
-- into a proper child table (1NF).  Each row is one feature for one service.
-- Deleting a service cascades to its features automatically.

CREATE TABLE IF NOT EXISTS service_features (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNSIGNED  NOT NULL,
    feature    VARCHAR(300)  NOT NULL,
    sort_order SMALLINT      NOT NULL DEFAULT 0,
    CONSTRAINT fk_service_features_service
        FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service feature seeding removed.
-- Features are now expected to be managed per service in admin UI/API.
DO 0;
