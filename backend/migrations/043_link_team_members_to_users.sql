ALTER TABLE team_members
    ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
    ADD KEY idx_team_members_user_id (user_id),
    ADD CONSTRAINT fk_team_members_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL;

UPDATE team_members tm
JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(tm.email))
SET tm.user_id = u.id
WHERE tm.user_id IS NULL
  AND tm.email IS NOT NULL
  AND tm.email <> '';
