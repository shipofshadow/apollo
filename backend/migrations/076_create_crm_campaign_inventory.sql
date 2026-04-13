-- Migration: 076_create_crm_campaign_inventory
-- Adds CRM 360 support tables, marketing campaigns, and structured inventory + parts workflow.

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    type ENUM('abandoned_cart','no_booking_90d','win_back') NOT NULL,
    status ENUM('draft','active','paused') NOT NULL DEFAULT 'draft',
    channels_json JSON NOT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    cta_url VARCHAR(255) NULL,
    trigger_config_json JSON NULL,
    last_run_at TIMESTAMP NULL DEFAULT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_marketing_campaigns_type_status (type, status),
    KEY idx_marketing_campaigns_created_by (created_by),
    CONSTRAINT fk_marketing_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaign_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    campaign_id BIGINT UNSIGNED NOT NULL,
    run_type ENUM('manual','scheduled') NOT NULL DEFAULT 'manual',
    dry_run TINYINT(1) NOT NULL DEFAULT 0,
    target_count INT UNSIGNED NOT NULL DEFAULT 0,
    queued_count INT UNSIGNED NOT NULL DEFAULT 0,
    summary_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_marketing_campaign_runs_campaign (campaign_id, created_at),
    CONSTRAINT fk_marketing_campaign_runs_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT UNSIGNED NOT NULL,
    campaign_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NULL,
    channel ENUM('inapp','email','sms') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
    error_text TEXT NULL,
    payload_json JSON NULL,
    queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    KEY idx_marketing_campaign_recipients_run (run_id),
    KEY idx_marketing_campaign_recipients_campaign (campaign_id),
    KEY idx_marketing_campaign_recipients_status (status),
    CONSTRAINT fk_marketing_campaign_recipients_run FOREIGN KEY (run_id) REFERENCES marketing_campaign_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketing_campaign_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketing_campaign_recipients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    contact_person VARCHAR(180) NOT NULL DEFAULT '',
    phone VARCHAR(40) NOT NULL DEFAULT '',
    email VARCHAR(180) NOT NULL DEFAULT '',
    notes TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_suppliers_active (is_active),
    UNIQUE KEY uq_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(80) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(120) NOT NULL DEFAULT '',
    unit VARCHAR(40) NOT NULL DEFAULT 'pcs',
    qty_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
    reorder_point DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    supplier_id INT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_items_sku (sku),
    KEY idx_inventory_items_supplier (supplier_id),
    KEY idx_inventory_items_low_stock (qty_on_hand, reorder_point),
    CONSTRAINT fk_inventory_items_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM('adjustment','purchase','reservation','release','consumption') NOT NULL,
    quantity_delta DECIMAL(12,2) NOT NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    reference_type VARCHAR(50) NULL,
    reference_id VARCHAR(80) NULL,
    actor_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_inventory_movements_item_created (item_id, created_at),
    KEY idx_inventory_movements_reference (reference_type, reference_id),
    CONSTRAINT fk_inventory_movements_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_movements_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_reorder_alerts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT UNSIGNED NOT NULL,
    status ENUM('open','resolved') NOT NULL DEFAULT 'open',
    qty_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
    reorder_point_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
    message VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    KEY idx_inventory_reorder_alerts_item_status (item_id, status),
    CONSTRAINT fk_inventory_reorder_alerts_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(40) NOT NULL,
    supplier_id INT UNSIGNED NULL,
    status ENUM('draft','ordered','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
    notes TEXT NULL,
    ordered_at TIMESTAMP NULL DEFAULT NULL,
    expected_at TIMESTAMP NULL DEFAULT NULL,
    received_at TIMESTAMP NULL DEFAULT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchase_orders_number (po_number),
    KEY idx_purchase_orders_supplier (supplier_id),
    KEY idx_purchase_orders_status (status),
    CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    received_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_purchase_order_items_po (purchase_order_id),
    KEY idx_purchase_order_items_item (item_id),
    CONSTRAINT fk_purchase_order_items_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_order_items_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_part_requirements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    inventory_item_id BIGINT UNSIGNED NULL,
    part_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
    status ENUM('needed','ordered','arrived','installed','cancelled') NOT NULL DEFAULT 'needed',
    supplier_id INT UNSIGNED NULL,
    po_item_id BIGINT UNSIGNED NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_booking_part_requirements_booking (booking_id),
    KEY idx_booking_part_requirements_status (status),
    CONSTRAINT fk_booking_part_requirements_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_part_requirements_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
    CONSTRAINT fk_booking_part_requirements_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT fk_booking_part_requirements_po_item FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    CONSTRAINT fk_booking_part_requirements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
