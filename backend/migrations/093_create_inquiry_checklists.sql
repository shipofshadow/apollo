-- Migration: 093_create_inquiry_checklists
-- Filled checklist header per inquiry

CREATE TABLE IF NOT EXISTS inquiry_checklists (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inquiry_id          CHAR(32)     NOT NULL,
    service_id          INT UNSIGNED NOT NULL,
    phase               ENUM('before','after') NOT NULL,
    submitted_by        INT UNSIGNED NULL,
    general_notes       TEXT         NULL,
    customer_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
    installer_name      VARCHAR(200) NULL,
    submitted_at        TIMESTAMP    NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inquiry_phase (inquiry_id, phase),
    FOREIGN KEY (inquiry_id)   REFERENCES customer_inquiries(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id)   REFERENCES services(id)           ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES users(id)              ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
