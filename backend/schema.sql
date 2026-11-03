CREATE DATABASE IF NOT EXISTS smart_education
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_education;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(60) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS whiteboard_rooms (
  room_code CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  room_name VARCHAR(80) NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_code),
  KEY whiteboard_rooms_owner (owner_id),
  CONSTRAINT whiteboard_rooms_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS whiteboard_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_code CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  author_name VARCHAR(60) NOT NULL,
  event_type ENUM('stroke', 'clear') NOT NULL,
  event_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY whiteboard_events_room_cursor (room_code, id),
  CONSTRAINT whiteboard_events_room_fk FOREIGN KEY (room_code) REFERENCES whiteboard_rooms (room_code) ON DELETE CASCADE,
  CONSTRAINT whiteboard_events_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
