-- Migration: 094_create_inquiry_checklist_responses
-- Item-level responses per checklist

CREATE TABLE IF NOT EXISTS inquiry_checklist_responses (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT UNSIGNED NOT NULL,
    item_id      INT UNSIGNED NOT NULL,
    is_checked   TINYINT(1)   NOT NULL DEFAULT 0,
    notes        TEXT         NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_checklist_item (checklist_id, item_id),
    FOREIGN KEY (checklist_id) REFERENCES inquiry_checklists(id)      ON DELETE CASCADE,
    FOREIGN KEY (item_id)      REFERENCES service_checklist_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
