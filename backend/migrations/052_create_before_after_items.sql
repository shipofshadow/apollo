CREATE TABLE IF NOT EXISTS before_after_items (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(300) NOT NULL DEFAULT '',
    description     TEXT         NOT NULL,
    before_image_url VARCHAR(500) NOT NULL,
    after_image_url  VARCHAR(500) NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    sort_order      SMALLINT     NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
