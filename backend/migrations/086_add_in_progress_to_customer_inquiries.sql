-- Migration: 086_add_in_progress_to_customer_inquiries
-- Extends the status ENUM on customer_inquiries to include 'in_progress',
-- matching the booking status vocabulary and the updated InquiryService validation.

ALTER TABLE customer_inquiries
    MODIFY COLUMN status
        ENUM('pending','confirmed','in_progress','completed','cancelled')
        NOT NULL DEFAULT 'pending';
