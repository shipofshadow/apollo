CREATE TABLE IF NOT EXISTS inquiry_slot_occupancy (
    id               CHAR(36)     NOT NULL PRIMARY KEY,
    inquiry_id      CHAR(36)     NOT NULL UNIQUE,
    appointment_date DATE         NOT NULL,
    appointment_time VARCHAR(20)  NOT NULL,
    status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_inquiry_slot_occupancy_date_time (appointment_date, appointment_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
