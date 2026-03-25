CREATE TABLE IF NOT EXISTS team_members (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    role        VARCHAR(200)  NOT NULL DEFAULT '',
    image_url   TEXT          DEFAULT NULL,
    bio         TEXT          DEFAULT NULL,
    full_bio    TEXT          DEFAULT NULL,
    email       VARCHAR(255)  DEFAULT NULL,
    phone       VARCHAR(50)   DEFAULT NULL,
    facebook    VARCHAR(500)  DEFAULT NULL,
    instagram   VARCHAR(500)  DEFAULT NULL,
    sort_order  INT           NOT NULL DEFAULT 0,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO team_members (name, role, image_url, bio, full_bio, email, phone, sort_order) VALUES
  ('Alex "The Spark" Mercer', 'Master Retrofitter & Founder',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1974&auto=format&fit=crop',
   'With over 15 years of experience in automotive electronics, Alex founded 1625 Auto Lab to push the boundaries of custom lighting.',
   'Alex started his journey in his parents'' garage, fixing broken headlight seals and upgrading halogen bulbs. His obsession with perfection led him to master projector retrofitting and custom LED integration. Today, he oversees all major builds at 1625 Auto Lab, ensuring every vehicle leaves with a signature look and flawless functionality.',
   'alex@1625autolab.com', '0939 330 8263', 0),
  ('Sarah Chen', 'Lead Technician',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop',
   'Specializing in Android headunit integrations and complex wiring harnesses. Sarah ensures every install looks factory-perfect.',
   'Sarah holds a degree in Electrical Engineering and brings a meticulous approach to automotive wiring. She specializes in integrating modern Android headunits into older vehicles, ensuring steering wheel controls, backup cameras, and factory amplifiers work seamlessly. Her wiring harnesses are known for being cleaner than OEM.',
   'sarah@1625autolab.com', '0939 330 8264', 1);
