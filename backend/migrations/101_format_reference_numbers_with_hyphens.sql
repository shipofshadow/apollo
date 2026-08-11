-- Migration: 101_format_reference_numbers_with_hyphens
-- Converts reference numbers with underscores (1625_DDMMYY_0001) to hyphens (1625-DDMMYY-0001)

SET FOREIGN_KEY_CHECKS = 0;

UPDATE customer_inquiries 
   SET reference_number = REPLACE(reference_number, '1625_', '1625-') 
 WHERE reference_number LIKE '1625_%';

UPDATE public_checklist_submissions 
   SET reference_number = REPLACE(reference_number, '1625_', '1625-') 
 WHERE reference_number LIKE '1625_%';

UPDATE bookings 
   SET reference_number = REPLACE(reference_number, '1625_', '1625-') 
 WHERE reference_number LIKE '1625_%';

SET FOREIGN_KEY_CHECKS = 1;
