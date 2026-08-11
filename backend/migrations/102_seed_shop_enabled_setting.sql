-- Migration: 102_seed_shop_enabled_setting
-- Adds the shop_enabled site-setting to toggle shop, e-commerce, products, cart, and orders functionality. Defaults to '1' (enabled).

INSERT IGNORE INTO site_settings (`key`, `value`) VALUES ('shop_enabled', '1');
