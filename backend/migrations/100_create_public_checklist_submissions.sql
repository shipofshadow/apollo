-- Migration 100: Create public_checklist_submissions table for storing raw checklist responses, customer info, and signature data
CREATE TABLE IF NOT EXISTS public_checklist_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inquiry_id VARCHAR(64) NULL,
    reference_number VARCHAR(64) NOT NULL,
    phase VARCHAR(20) NOT NULL DEFAULT 'before',
    customer_name VARCHAR(255) NULL,
    customer_email VARCHAR(255) NULL,
    contact_number VARCHAR(100) NULL,
    vehicle_make VARCHAR(100) NULL,
    vehicle_model VARCHAR(100) NULL,
    vehicle_year VARCHAR(50) NULL,
    plate_number VARCHAR(50) NULL,
    service_title VARCHAR(255) NULL,
    installer_name VARCHAR(255) NULL,
    general_notes TEXT NULL,
    signature_data LONGTEXT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ref_phase (reference_number, phase),
    INDEX idx_inquiry_id (inquiry_id),
    INDEX idx_reference_number (reference_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
