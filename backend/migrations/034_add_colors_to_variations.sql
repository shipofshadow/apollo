ALTER TABLE service_variations
    ADD COLUMN colors TEXT NOT NULL DEFAULT '[]' AFTER specs;

ALTER TABLE product_variations
    ADD COLUMN colors TEXT NOT NULL DEFAULT '[]' AFTER specs;
