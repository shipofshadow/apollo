-- =============================================================================
-- Chatbot tables migration for the `apollo` MariaDB database
-- Run this once against your production apollo database so the FastAPI
-- chatbot backend can share the same DB as the PHP application.
--
-- Safe to run multiple times — all CREATE TABLE statements use
-- IF NOT EXISTS so existing data is never touched.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `conversations` (
  `id`         int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` varchar(128)     NOT NULL,
  `status`     varchar(20)      NOT NULL DEFAULT 'bot'
               COMMENT 'bot | human | closed',
  `created_at` timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp        NOT NULL DEFAULT current_timestamp()
               ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversations_session_id` (`session_id`),
  KEY `idx_conversations_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id`              int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` int(10) UNSIGNED NOT NULL,
  `sender`          varchar(20)      NOT NULL COMMENT 'user | bot | human',
  `content`         text             NOT NULL,
  `message_type`    varchar(30)      NOT NULL DEFAULT 'text'
                    COMMENT 'text | quick_reply | card | button',
  `metadata_json`   text             DEFAULT NULL,
  `created_at`      timestamp        NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation_id` (`conversation_id`),
  CONSTRAINT `fk_messages_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. flows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `flows` (
  `id`          int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        varchar(200)     NOT NULL,
  `description` text             DEFAULT NULL,
  `flow_json`   longtext         NOT NULL,
  `is_active`   tinyint(1)       NOT NULL DEFAULT 0,
  `created_at`  timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at`  timestamp        NOT NULL DEFAULT current_timestamp()
                ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. user_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id`              int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id`      varchar(128)     NOT NULL,
  `variables_json`  text             NOT NULL DEFAULT '{}',
  `current_node_id` varchar(200)     DEFAULT NULL,
  `conversation_id` int(10) UNSIGNED NOT NULL,
  `created_at`      timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at`      timestamp        NOT NULL DEFAULT current_timestamp()
                    ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_session_id` (`session_id`),
  KEY `idx_user_sessions_session_id` (`session_id`),
  CONSTRAINT `fk_user_sessions_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. customer_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_profiles` (
  `id`            int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id`    varchar(128)     NOT NULL,
  `name`          varchar(200)     DEFAULT NULL,
  `email`         varchar(255)     DEFAULT NULL,
  `phone`         varchar(30)      DEFAULT NULL,
  `vehicle_make`  varchar(100)     DEFAULT NULL,
  `vehicle_model` varchar(100)     DEFAULT NULL,
  `vehicle_year`  varchar(10)      DEFAULT NULL,
  `vehicle_info`  varchar(255)     DEFAULT NULL,
  `created_at`    timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at`    timestamp        NOT NULL DEFAULT current_timestamp()
                  ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_profiles_session_id` (`session_id`),
  KEY `idx_customer_profiles_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. conversation_presence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `conversation_presence` (
  `id`                    int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id`            varchar(128)     NOT NULL,
  `customer_typing`       tinyint(1)       NOT NULL DEFAULT 0,
  `agent_typing`          tinyint(1)       NOT NULL DEFAULT 0,
  `customer_last_read_at` timestamp        NULL DEFAULT NULL,
  `agent_last_read_at`    timestamp        NULL DEFAULT NULL,
  `updated_at`            timestamp        NOT NULL DEFAULT current_timestamp()
                          ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_presence_session_id` (`session_id`),
  KEY `idx_conversation_presence_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. service_availability_rules
--    References the existing `services` table via FK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_availability_rules` (
  `id`           int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_id`   int(10) UNSIGNED NOT NULL,
  `day_of_week`  tinyint(3)       DEFAULT NULL COMMENT '0=Monday … 6=Sunday',
  `start_hour`   tinyint(3)       DEFAULT NULL COMMENT '0–23',
  `end_hour`     tinyint(3)       DEFAULT NULL COMMENT '0–23',
  `is_available` tinyint(1)       NOT NULL DEFAULT 1,
  `note`         varchar(255)     DEFAULT NULL,
  `created_at`   timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at`   timestamp        NOT NULL DEFAULT current_timestamp()
                 ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_service_availability_service_id` (`service_id`),
  CONSTRAINT `fk_service_availability_service`
    FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. appointment_action_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `appointment_action_requests` (
  `id`             int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id`     varchar(128)     NOT NULL,
  `action`         varchar(30)      NOT NULL COMMENT 'reschedule | cancel',
  `requested_date` varchar(20)      DEFAULT NULL,
  `requested_time` varchar(20)      DEFAULT NULL,
  `reason`         text             DEFAULT NULL,
  `status`         varchar(20)      NOT NULL DEFAULT 'pending'
                   COMMENT 'pending | processed | rejected',
  `created_at`     timestamp        NOT NULL DEFAULT current_timestamp(),
  `updated_at`     timestamp        NOT NULL DEFAULT current_timestamp()
                   ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_appt_action_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
