-- Add reference_number as nullable first so existing rows can be backfilled safely.
ALTER TABLE bookings ADD COLUMN reference_number VARCHAR(20) NULL AFTER id;

-- Backfill a deterministic unique reference for existing rows based on booking UUID.
UPDATE bookings
SET reference_number = CONCAT(
	'BK-LEG-',
	UPPER(SUBSTRING(REPLACE(id, '-', ''), 1, 10))
)
WHERE reference_number IS NULL OR reference_number = '';

-- Enforce required + unique reference numbers after backfill.
ALTER TABLE bookings MODIFY reference_number VARCHAR(20) NOT NULL;
CREATE UNIQUE INDEX idx_reference_number ON bookings(reference_number);
