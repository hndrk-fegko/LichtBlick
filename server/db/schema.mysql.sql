-- MySQL/MariaDB schema for LichtBlick v3
-- For Plesk deployment

-- Configuration (Key-Value Store)
CREATE TABLE IF NOT EXISTS config (
  `key` VARCHAR(255) PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game Sessions
CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status ENUM('lobby', 'playing', 'ended') NOT NULL,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_games_status (status),
  INDEX idx_games_active (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game Images (Pool - no type, just images)
CREATE TABLE IF NOT EXISTS images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  is_start_image TINYINT(1) DEFAULT 0,
  is_end_image TINYINT(1) DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_images_start (is_start_image),
  INDEX idx_images_end (is_end_image)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction: Game <-> Images
CREATE TABLE IF NOT EXISTS game_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  image_id INT NOT NULL,
  correct_answer VARCHAR(255),
  display_order INT DEFAULT 0,
  is_played TINYINT(1) DEFAULT 0,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_game_image (game_id, image_id),
  INDEX idx_game_images_game (game_id),
  INDEX idx_game_images_order (game_id, display_order),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Players
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  score INT DEFAULT 0,
  socket_id VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_players_game (game_id),
  INDEX idx_players_score (game_id, score DESC),
  INDEX idx_players_socket (socket_id),
  INDEX idx_players_leaderboard (game_id, score DESC, joined_at ASC),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player Answers (Hybrid+ System: locked first, scored at reveal)
CREATE TABLE IF NOT EXISTS answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  image_id INT NOT NULL,
  answer TEXT NOT NULL,
  is_correct TINYINT(1) DEFAULT NULL,
  points_earned INT DEFAULT 0,
  locked_at TIMESTAMP NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_answers_player (player_id),
  INDEX idx_answers_image (image_id),
  INDEX idx_answers_player_image (player_id, image_id),
  INDEX idx_answers_locked (image_id, locked_at),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game State (per-image runtime state)
CREATE TABLE IF NOT EXISTS image_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  image_id INT NOT NULL,
  reveal_count INT DEFAULT 0,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  UNIQUE KEY unique_game_image_state (game_id, image_id),
  INDEX idx_image_states_game (game_id),
  INDEX idx_image_states_started (game_id, started_at DESC),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Configuration
INSERT IGNORE INTO config (`key`, `value`) VALUES
  ('revealCount', '9'),
  ('revealInterval', '3000'),
  ('pointsPerReveal', '100'),
  ('gameMode', 'hybrid_plus');
