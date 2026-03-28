-- Migration: 025_add_variations_to_bookings
-- Adds a selected_variations column to store the variation chosen per service
-- when the customer books. Stored as a JSON array of objects:
-- [{"serviceId": 1, "variationId": 3, "variationName": "Premium Package"}, ...]

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS selected_variations TEXT DEFAULT NULL AFTER service_ids;
