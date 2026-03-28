CREATE TABLE IF NOT EXISTS product_variations (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id  INT UNSIGNED NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       VARCHAR(100) NOT NULL DEFAULT '',
    images      TEXT NOT NULL DEFAULT '[]',
    specs       TEXT NOT NULL DEFAULT '[]',
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_pvar_product
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);
