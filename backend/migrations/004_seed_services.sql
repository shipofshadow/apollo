-- Migration: 004_seed_services
-- Seeds the four core service offerings.
-- Uses ON DUPLICATE KEY UPDATE id = id so re-running is safe.

INSERT INTO services
    (id, title, description, full_description, icon, image_url,
     duration, starting_price, features, sort_order, is_active)
VALUES
(
    1,
    'Headlight Retrofits',
    'Custom projector retrofits, demon eyes, halos, and sequential turn signals for maximum visibility and aggressive styling.',
    'Our headlight retrofitting service is where art meets engineering. We don''t just install bulbs; we completely rebuild your headlight housings with state-of-the-art bi-LED or HID projectors. This ensures a razor-sharp cutoff line, massive width, and intense brightness without blinding oncoming traffic. We can customize the look with RGB demon eyes, sequential switchback halos, etched lenses, and custom paint matching.',
    'Lightbulb',
    'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1964&auto=format&fit=crop',
    '4–6 Hours',
    '₱13,750',
    '["Bi-LED & HID Projector Conversions","RGBW Demon Eyes & Halos","Custom Lens Etching","Housing Paint & Blackouts","Sequential Turn Signals","Moisture Sealing & Warranty"]',
    1,
    1
)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO services
    (id, title, description, full_description, icon, image_url,
     duration, starting_price, features, sort_order, is_active)
VALUES
(
    2,
    'Android Headunits',
    'Modernize your dash with high-resolution Android screens featuring Apple CarPlay, Android Auto, and custom bezels.',
    'Upgrade your vehicle''s infotainment system with our premium Android Headunit installations. We seamlessly integrate modern technology into older vehicles, providing you with wireless Apple CarPlay, Android Auto, GPS navigation, and access to thousands of apps via the Google Play Store. Our installations include custom-fitted bezels and wiring harnesses to retain steering wheel controls and factory cameras.',
    'MonitorPlay',
    'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
    '2–3 Hours',
    '₱8,250',
    '["Wireless Apple CarPlay & Android Auto","High-Resolution IPS/OLED Touchscreens","Factory Steering Wheel Control Retention","Custom 3D Printed Bezels","Backup & 360 Camera Integration","DSP Audio Tuning"]',
    2,
    1
)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO services
    (id, title, description, full_description, icon, image_url,
     duration, starting_price, features, sort_order, is_active)
VALUES
(
    3,
    'Security Systems',
    'Advanced alarm systems, GPS tracking, and kill switches to protect your investment.',
    'Protect your investment with our advanced security system installations. We go beyond basic alarms, offering comprehensive security solutions that deter theft and provide peace of mind. From hidden kill switches and GPS tracking modules to 2-way paging alarms with remote start capabilities, we customize the security setup to your specific vehicle and needs.',
    'ShieldAlert',
    'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop',
    '2–4 Hours',
    '₱11,000',
    '["2-Way Paging Alarm Systems","Hidden Kill Switches","Real-Time GPS Tracking","Remote Engine Start","Tilt & Glass Break Sensors","Smartphone Integration"]',
    3,
    1
)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO services
    (id, title, description, full_description, icon, image_url,
     duration, starting_price, features, sort_order, is_active)
VALUES
(
    4,
    'Aesthetic Upgrades',
    'Transform the look of your vehicle inside and out with custom grilles, ambient lighting, vinyl wraps, and more.',
    'Transform the look and feel of your vehicle with our aesthetic upgrades. We offer a wide range of services to personalize your ride, both inside and out. From aggressive aftermarket grilles and aerodynamic splitters to premium interior ambient lighting and custom vinyl wrapping for trim pieces, we pay attention to the small details that make a big impact.',
    'CarFront',
    'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop',
    'Varies',
    'Consultation',
    '["Custom Ambient Interior Lighting","Aftermarket Grille Installation","Interior Trim Vinyl Wrapping","Aero Kit & Splitter Installation","Custom Emblems & Badging","Caliper Painting"]',
    4,
    1
)
ON DUPLICATE KEY UPDATE id = id;
