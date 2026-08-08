-- Migration: 095_seed_service_checklist_items
-- Seed template items for Headlight Retrofits (1) and Android Headunits (2)

-- HEADLIGHT RETROFITS (1)
-- Before
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'before', NULL, 'Low Beam', 1, 10),
(1, 'before', NULL, 'High Beam', 1, 20),
(1, 'before', NULL, 'Parklight', 1, 30),
(1, 'before', NULL, 'No Dashboard Error', 1, 40),
(1, 'before', NULL, 'Left Turn Signal', 1, 50),
(1, 'before', NULL, 'Right Turn Signal', 1, 60),
(1, 'before', NULL, 'Foglights (if equipped)', 1, 70),
(1, 'before', NULL, 'DRL (if equipped)', 1, 80),
(1, 'before', NULL, 'Hazzard Lights', 1, 90),
(1, 'before', NULL, 'No Bumper and Headlight scratches', 1, 100),
(1, 'before', NULL, 'Complete Screws', 1, 110);

-- After - Function Check
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'after', 'Function Check', 'Low Beam is working properly.', 0, 120),
(1, 'after', 'Function Check', 'High Beam is working properly.', 0, 130),
(1, 'after', 'Function Check', 'Left Turn Signal is working.', 0, 140),
(1, 'after', 'Function Check', 'Right Turn Signal is working.', 0, 150),
(1, 'after', 'Function Check', 'Parklight is working.', 0, 160),
(1, 'after', 'Function Check', 'Foglights (if equipped) are working.', 0, 170),
(1, 'after', 'Function Check', 'DRL (if equipped) is working.', 0, 180),
(1, 'after', 'Function Check', 'Hazzard Lights are working.', 0, 190);

-- After - Vehicle Check
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'after', 'Vehicle Check', 'No dashboard warning lights.', 0, 200),
(1, 'after', 'Vehicle Check', 'Headlights are securely installed.', 0, 210),
(1, 'after', 'Vehicle Check', 'Front bumper and panels are properly reinstalled.', 0, 220),
(1, 'after', 'Vehicle Check', 'Vehicle is free from any installation-related damage.', 0, 230);

-- After - Alignment & Condition
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'after', 'Alignment & Condition', 'Headlights are properly aimed and even.', 0, 240),
(1, 'after', 'Alignment & Condition', 'No visible moisture or condensation inside the headlights.', 0, 250),
(1, 'after', 'Alignment & Condition', 'Lenses are clean and free from scratches.', 0, 260),
(1, 'after', 'Alignment & Condition', 'No loose wiring or exposed connectors.', 0, 270);

-- After - Explanation & Documents
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'after', 'Explanation & Documents', 'Retrofit operation and features explained.', 0, 280),
(1, 'after', 'Explanation & Documents', 'Care instructions explained.', 0, 290),
(1, 'after', 'Explanation & Documents', 'Warranty document provided.', 0, 300),
(1, 'after', 'Explanation & Documents', 'Questions answered.', 0, 310);

-- Acknowledgement
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(1, 'acknowledgement', NULL, 'I have inspected my vehicle and confirm that the installation has been completed to my satisfaction.', 0, 320);


-- ANDROID HEADUNITS (2)
-- Before
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(2, 'before', NULL, 'Radio is functioning', 1, 10),
(2, 'before', NULL, 'Steering Wheel Controls (if equipped)', 1, 20),
(2, 'before', NULL, 'Reverse Camera (if equipped)', 1, 30),
(2, 'before', NULL, 'Factory USB Port (if equipped)', 1, 40),
(2, 'before', NULL, 'Dashboard Warning Lights', 1, 50),
(2, 'before', NULL, 'Speakers (Front & Rear)', 1, 60),
(2, 'before', NULL, 'Wirings are in good setup/condition', 1, 70),
(2, 'before', NULL, 'No scratches on dashboard/trim panels', 1, 80),
(2, 'before', NULL, 'All dashboard clips & screws complete', 1, 90);

-- After - Function Check
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(2, 'after', 'Function Check', 'Android Head Unit powers ON properly', 0, 100),
(2, 'after', 'Function Check', 'Touchscreen responds correctly', 0, 110),
(2, 'after', 'Function Check', 'FM/AM Radio working', 0, 120),
(2, 'after', 'Function Check', 'Wi-Fi connection working', 0, 130),
(2, 'after', 'Function Check', 'Apple CarPlay/Android Auto working', 0, 140),
(2, 'after', 'Function Check', 'GPS Navigation working', 0, 150),
(2, 'after', 'Function Check', 'USB ports working', 0, 160),
(2, 'after', 'Function Check', 'Steering Wheel Controls working (if equipped)', 0, 170),
(2, 'after', 'Function Check', 'All Camera (Front, Rear, Left and Right) are working properly', 0, 180),
(2, 'after', 'Function Check', 'All speakers producing sound', 0, 190),
(2, 'after', 'Function Check', 'Equalizer / Audio settings verified', 0, 200);

-- After - Vehicle Check
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(2, 'after', 'Vehicle Check', 'Dashboard panels properly reinstalled', 0, 210),
(2, 'after', 'Vehicle Check', 'No dashboard warning lights', 0, 220),
(2, 'after', 'Vehicle Check', 'No loose trim or rattling', 0, 230),
(2, 'after', 'Vehicle Check', 'No exposed wiring', 0, 240),
(2, 'after', 'Vehicle Check', 'Vehicle starts normally', 0, 250),
(2, 'after', 'Vehicle Check', 'Interior is clean after installation', 0, 260);

-- After - Customer Orientation
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(2, 'after', 'Customer Orientation', 'Demonstrated basic operation', 0, 270),
(2, 'after', 'Customer Orientation', 'Connected customer''s Bluetooth phone', 0, 280),
(2, 'after', 'Customer Orientation', 'Apple CarPlay/Android Auto connected', 0, 290),
(2, 'after', 'Customer Orientation', 'Demonstrated all cameras', 0, 300),
(2, 'after', 'Customer Orientation', 'Warranty explained', 0, 310),
(2, 'after', 'Customer Orientation', 'Questions answered', 0, 320);

-- Acknowledgement
INSERT INTO service_checklist_items (service_id, phase, section, label, has_notes, sort_order) VALUES
(2, 'acknowledgement', NULL, 'I have inspected my vehicle and confirm that the installation has been completed to my satisfaction.', 0, 330);
