-- Migration 099: Drop legacy admin checklist tables safely
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS inquiry_checklist_responses;
DROP TABLE IF EXISTS service_checklist_items;
DROP TABLE IF EXISTS inquiry_checklists;

SET FOREIGN_KEY_CHECKS = 1;
