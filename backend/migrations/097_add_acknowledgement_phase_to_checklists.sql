-- Migration: 097_add_acknowledgement_phase_to_checklists
-- Adds acknowledgement to phase enum

ALTER TABLE inquiry_checklists
MODIFY COLUMN phase ENUM('before','after','acknowledgement') NOT NULL;
