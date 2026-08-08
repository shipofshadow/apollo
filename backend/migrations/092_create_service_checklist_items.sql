-- Migration: 092_create_service_checklist_items
-- Template items per service for the checklists

CREATE TABLE IF NOT EXISTS service_checklist_items (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id  INT UNSIGNED NOT NULL,
    phase       ENUM('before','after','acknowledgement') NOT NULL DEFAULT 'before',
    section     VARCHAR(100) NULL,
    label       VARCHAR(300) NOT NULL,
    description TEXT         NULL,
    has_notes   TINYINT(1)   NOT NULL DEFAULT 1,
    sort_order  SMALLINT     NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    INDEX idx_sci_service_id_phase (service_id, phase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
