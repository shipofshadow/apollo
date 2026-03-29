ALTER TABLE service_variations
    ADD COLUMN color_images TEXT NOT NULL DEFAULT '{}' AFTER colors;

ALTER TABLE product_variations
    ADD COLUMN color_images TEXT NOT NULL DEFAULT '{}' AFTER colors;
