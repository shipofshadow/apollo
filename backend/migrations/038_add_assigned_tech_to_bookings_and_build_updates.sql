ALTER TABLE bookings
    ADD COLUMN assigned_tech_id INT UNSIGNED NULL AFTER user_id,
    ADD INDEX idx_bookings_assigned_tech_id (assigned_tech_id),
    ADD CONSTRAINT fk_bookings_assigned_tech
        FOREIGN KEY (assigned_tech_id) REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE build_updates
    ADD COLUMN assigned_tech_id INT UNSIGNED NULL AFTER booking_id,
    ADD INDEX idx_build_updates_assigned_tech_id (assigned_tech_id),
    ADD CONSTRAINT fk_build_updates_assigned_tech
        FOREIGN KEY (assigned_tech_id) REFERENCES team_members(id) ON DELETE SET NULL;
