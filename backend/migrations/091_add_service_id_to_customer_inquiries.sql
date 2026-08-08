-- Migration: 091_add_service_id_to_customer_inquiries
-- Adds a nullable service_id foreign key to customer_inquiries so each inquiry
-- can be linked to a specific service offered by the shop.

ALTER TABLE customer_inquiries
    ADD COLUMN service_id INT UNSIGNED NULL DEFAULT NULL
        AFTER product_to_purchase;

-- Foreign key referencing the services table (set NULL on service delete)
ALTER TABLE customer_inquiries
    ADD CONSTRAINT fk_ci_service_id
        FOREIGN KEY (service_id) REFERENCES services (id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;

CREATE INDEX idx_ci_service_id ON customer_inquiries (service_id);
