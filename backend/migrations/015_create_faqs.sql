CREATE TABLE IF NOT EXISTS faqs (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question    TEXT          NOT NULL,
    answer      TEXT          NOT NULL,
    category    VARCHAR(200)  NOT NULL DEFAULT 'General',
    sort_order  INT           NOT NULL DEFAULT 0,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO faqs (question, answer, category, sort_order) VALUES
  ('What services does 1625 Autolab offer?',
   'We specialize in headlight retrofits, Android headunits, advanced security systems, and aesthetic upgrades including custom grilles, ambient lighting, and vinyl wraps.',
   'General', 0),
  ('How long does a headlight retrofit take?',
   'A standard headlight retrofit typically takes 4–6 hours depending on the vehicle and complexity of the build.',
   'Services', 1),
  ('Do you offer a warranty on your work?',
   'Yes, all our installations come with a workmanship warranty. Parts warranties vary by manufacturer. Contact us for specific warranty details.',
   'General', 2),
  ('How do I book an appointment?',
   'You can book an appointment directly through our website using the Book Appointment button, or call us at 0939 330 8263.',
   'Booking', 3),
  ('What payment methods do you accept?',
   'We accept cash, bank transfer, and major e-wallets (GCash, Maya). Payment details will be confirmed upon booking.',
   'Billing', 4);
