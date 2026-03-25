CREATE TABLE IF NOT EXISTS site_settings (
    `key`        VARCHAR(100)  NOT NULL PRIMARY KEY,
    `value`      TEXT          DEFAULT NULL,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings (`key`, `value`) VALUES
  ('company_description_1', 'Founded in 2018, 1625 Auto Lab started as a small garage operation focused on fixing poorly done headlight retrofits. Today, we are Los Angeles'' premier destination for high-end automotive electronics and premium vehicle upgrades.'),
  ('company_description_2', 'We believe that your vehicle is an extension of your personality. Our mission is to provide unparalleled craftsmanship, using only the highest quality components, to turn your automotive vision into reality.'),
  ('about_heading',         'Built on Precision. Driven by Passion.'),
  ('about_image_url',       'https://images.unsplash.com/photo-1632823471565-1ec2a74b45b4?q=80&w=2070&auto=format&fit=crop');
