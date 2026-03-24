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

-- Seed: Headlight Retrofits (service_id = 1)
INSERT INTO service_features (service_id, feature, sort_order) VALUES
    (1, 'Bi-LED & HID Projector Conversions', 1),
    (1, 'RGBW Demon Eyes & Halos',            2),
    (1, 'Custom Lens Etching',                3),
    (1, 'Housing Paint & Blackouts',          4),
    (1, 'Sequential Turn Signals',            5),
    (1, 'Moisture Sealing & Warranty',        6);

-- Seed: Android Headunits (service_id = 2)
INSERT INTO service_features (service_id, feature, sort_order) VALUES
    (2, 'Wireless Apple CarPlay & Android Auto',      1),
    (2, 'High-Resolution IPS/OLED Touchscreens',      2),
    (2, 'Factory Steering Wheel Control Retention',   3),
    (2, 'Custom 3D Printed Bezels',                   4),
    (2, 'Backup & 360 Camera Integration',            5),
    (2, 'DSP Audio Tuning',                           6);

-- Seed: Security Systems (service_id = 3)
INSERT INTO service_features (service_id, feature, sort_order) VALUES
    (3, '2-Way Paging Alarm Systems', 1),
    (3, 'Hidden Kill Switches',       2),
    (3, 'Real-Time GPS Tracking',     3),
    (3, 'Remote Engine Start',        4),
    (3, 'Tilt & Glass Break Sensors', 5),
    (3, 'Smartphone Integration',     6);

-- Seed: Aesthetic Upgrades (service_id = 4)
INSERT INTO service_features (service_id, feature, sort_order) VALUES
    (4, 'Custom Ambient Interior Lighting',  1),
    (4, 'Aftermarket Grille Installation',   2),
    (4, 'Interior Trim Vinyl Wrapping',      3),
    (4, 'Aero Kit & Splitter Installation',  4),
    (4, 'Custom Emblems & Badging',          5),
    (4, 'Caliper Painting',                  6);
