CREATE TABLE IF NOT EXISTS testimonials (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    role        VARCHAR(200)  NOT NULL DEFAULT '',
    content     TEXT          NOT NULL,
    rating      TINYINT       NOT NULL DEFAULT 5,
    image_url   TEXT          DEFAULT NULL,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO testimonials (name, role, content, rating, image_url, sort_order) VALUES
  ('Mark Reyes', 'Honda Civic FD Owner',
   '1625 Autolab completely transformed my Civic! The X1 Bi-LED Projector Headlights are incredibly bright and the amber demon eyes look aggressive. Highly recommend their services.',
   5, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150', 0),
  ('Sarah Mendoza', 'Toyota Fortuner Owner',
   'Professional team and excellent workmanship. They installed a new suspension system on my Fortuner and the ride quality is night and day. Will definitely come back for more upgrades.',
   5, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150', 1),
  ('John Villanueva', 'Honda BR-V Owner',
   'Got the full setup for my BR-V. The tri-color foglights are a game changer for night driving, especially during heavy rain. Great customer service from start to finish.',
   5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150', 2);
