-- Migration: 083_create_customer_inquiries
-- Creates a dedicated table for customer inquiry submissions including appointment scheduling data.

CREATE TABLE IF NOT EXISTS customer_inquiries (
    id               CHAR(32)      NOT NULL PRIMARY KEY,
    full_name        VARCHAR(200)  NOT NULL,
    address          TEXT          NOT NULL,
    contact_number   VARCHAR(50)   NOT NULL,
    email_address    VARCHAR(255)  NOT NULL,
    facebook_name    VARCHAR(255)  NOT NULL,
    make             VARCHAR(100)  NOT NULL,
    model            VARCHAR(100)  NOT NULL,
    year_model       VARCHAR(20)   NOT NULL,
    product_to_purchase TEXT       NOT NULL,
    appointment_date DATE          NOT NULL,
    appointment_time VARCHAR(20)   NOT NULL,
    status           ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inquiries_appointment_date (appointment_date),
    INDEX idx_inquiries_appointment_time (appointment_time),
    INDEX idx_inquiries_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
