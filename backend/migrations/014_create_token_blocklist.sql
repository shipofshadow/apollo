CREATE TABLE IF NOT EXISTS token_blocklist (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token_hash VARCHAR(64)  NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    UNIQUE KEY uq_token_blocklist_hash (token_hash),
    KEY        idx_token_blocklist_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
