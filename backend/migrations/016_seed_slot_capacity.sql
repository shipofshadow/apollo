-- Migration: 016_seed_slot_capacity
-- Adds the slot_capacity site-setting that controls how many bookings are
-- accepted per appointment time slot.  Defaults to 3.

INSERT IGNORE INTO site_settings (`key`, `value`) VALUES ('slot_capacity', '3');
