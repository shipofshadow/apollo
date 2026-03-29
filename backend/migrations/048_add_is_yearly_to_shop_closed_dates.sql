-- Add is_yearly column to shop_closed_dates table
ALTER TABLE shop_closed_dates
ADD COLUMN is_yearly BOOLEAN DEFAULT 0 AFTER reason;
