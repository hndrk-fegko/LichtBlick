-- MySQL/MariaDB schema for LichtBlick
-- See DATABASE_SCHEMA.md for details

-- Configuration (Key-Value Store)
CREATE TABLE IF NOT EXISTS config (
  `key` VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INT DEFAULT (UNIX_TIMESTAMP())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game Sessions
CREATE TABLE IF NOT EXISTS games (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status VARCHAR(20) NOT NULL CHECK(status IN ('lobby', 'playing', 'ended')),
  started_at INT DEFAULT NULL,
  ended_at INT DEFAULT NULL,
  created_at INT DEFAULT (UNIX_TIMESTAMP())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game Images (Pool - no type, just images)
CREATE TABLE IF NOT EXISTS images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  is_start_image TINYINT(1) DEFAULT 0,
  is_end_image TINYINT(1) DEFAULT 0,
  uploaded_at INT DEFAULT (UNIX_TIMESTAMP())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction: Game <-> Images
CREATE TABLE IF NOT EXISTS game_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT,
  image_id INT,
  correct_answer TEXT,
  display_order INT DEFAULT 0,
  is_played TINYINT(1) DEFAULT 0,
  added_at INT DEFAULT (UNIX_TIMESTAMP()),
  UNIQUE KEY unique_game_image (game_id, image_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Players
CREATE TABLE IF NOT EXISTS players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT,
  name VARCHAR(255) NOT NULL,
  score INT DEFAULT 0,
  socket_id VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  last_seen INT DEFAULT (UNIX_TIMESTAMP()),
  joined_at INT DEFAULT (UNIX_TIMESTAMP()),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player Answers (Hybrid+ System: locked first, scored at reveal)
CREATE TABLE IF NOT EXISTS answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT,
  image_id INT,
  answer TEXT NOT NULL,
  is_correct TINYINT(1) DEFAULT NULL,
  points_earned INT DEFAULT 0,
  locked_at INT DEFAULT NULL,
  submitted_at INT DEFAULT (UNIX_TIMESTAMP()),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game State (per-image runtime state)
CREATE TABLE IF NOT EXISTS image_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT,
  image_id INT,
  reveal_count INT DEFAULT 0,
  started_at INT DEFAULT NULL,
  ended_at INT DEFAULT NULL,
  UNIQUE KEY unique_game_image_state (game_id, image_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for performance
CREATE INDEX idx_config_key ON config(`key`);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_active ON games(status, created_at DESC);
CREATE INDEX idx_images_start ON images(is_start_image);
CREATE INDEX idx_images_end ON images(is_end_image);
CREATE INDEX idx_game_images_game ON game_images(game_id);
CREATE INDEX idx_game_images_order ON game_images(game_id, display_order);
CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_players_score ON players(game_id, score DESC);
CREATE INDEX idx_players_socket ON players(socket_id);
CREATE INDEX idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);
CREATE INDEX idx_players_active ON players(game_id, is_active);
CREATE INDEX idx_answers_player ON answers(player_id);
CREATE INDEX idx_answers_image ON answers(image_id);
CREATE INDEX idx_answers_player_image ON answers(player_id, image_id);
CREATE INDEX idx_answers_locked ON answers(image_id, locked_at);
CREATE INDEX idx_image_states_game ON image_states(game_id);
CREATE INDEX idx_image_states_started ON image_states(game_id, started_at DESC);

-- Default Configuration
INSERT IGNORE INTO config (`key`, value) VALUES
('adminPin', '"1234"'),
('qrVisible', 'false'),
('darkMode', 'false'),
('wordList', '["Apfel", "Banane", "Kirsche", "Hund", "Katze", "Maus", "Stern", "Sonne", "Mond"]'),
('scoring', '{"basePointsPerCorrect":100,"revealPenaltyEnabled":true,"revealPenaltyPercent":10,"minimumPointsPercent":20,"firstAnswerBonusEnabled":true,"firstAnswerBonusPoints":50,"secondAnswerBonusEnabled":true,"secondAnswerBonusPoints":30,"thirdAnswerBonusEnabled":true,"thirdAnswerBonusPoints":20,"speedBonusEnabled":false,"speedBonusMaxPoints":50,"speedBonusTimeLimit":10000}'),
('spotlight', '{"radius":80,"strength":0.5,"increaseAfterSeconds":30,"increaseFactor":1.5}');

-- Create initial lobby game
INSERT IGNORE INTO games (id, status) VALUES (1, 'lobby');
