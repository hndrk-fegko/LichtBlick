-- SQLite schema for LichtBlick
-- See DATABASE_SCHEMA.md for details

-- Configuration (Key-Value Store)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game Sessions
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('lobby', 'playing', 'ended')),
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game Images (Pool - no type, just images)
-- Note: This table definition is for NEW databases only.
-- Existing databases with 'type' column will be migrated via applyMigrations()
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  is_start_image INTEGER DEFAULT 0,
  is_end_image INTEGER DEFAULT 0,
  uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Junction: Game <-> Images
CREATE TABLE IF NOT EXISTS game_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  correct_answer TEXT,
  display_order INTEGER DEFAULT 0,
  is_played INTEGER DEFAULT 0,
  added_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(game_id, image_id)
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  socket_id TEXT,
  is_active INTEGER DEFAULT 1,
  last_seen INTEGER DEFAULT (strftime('%s', 'now')),
  joined_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Player Answers (Hybrid+ System: locked first, scored at reveal)
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT NULL,
  points_earned INTEGER DEFAULT 0,
  locked_at INTEGER,
  submitted_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game State (per-image runtime state)
CREATE TABLE IF NOT EXISTS image_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  reveal_count INTEGER DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER,
  UNIQUE(game_id, image_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_active ON games(status, created_at DESC) WHERE status != 'ended';
-- Note: idx_images_start and idx_images_end are created in migrations for existing DBs
-- CREATE INDEX IF NOT EXISTS idx_images_start ON images(is_start_image);
-- CREATE INDEX IF NOT EXISTS idx_images_end ON images(is_end_image);
-- CREATE INDEX IF NOT EXISTS idx_game_images_game ON game_images(game_id);
-- CREATE INDEX IF NOT EXISTS idx_game_images_order ON game_images(game_id, display_order);
CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_score ON players(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_players_socket ON players(socket_id);
CREATE INDEX IF NOT EXISTS idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_answers_player ON answers(player_id);
CREATE INDEX IF NOT EXISTS idx_answers_image ON answers(image_id);
CREATE INDEX IF NOT EXISTS idx_answers_player_image ON answers(player_id, image_id);
CREATE INDEX IF NOT EXISTS idx_answers_locked ON answers(image_id, locked_at);
CREATE INDEX IF NOT EXISTS idx_image_states_game ON image_states(game_id);
CREATE INDEX IF NOT EXISTS idx_image_states_started ON image_states(game_id, started_at DESC);

-- Default Configuration
INSERT OR IGNORE INTO config (key, value) VALUES
('adminPin', '"1234"'),
('qrVisible', 'false'),
('darkMode', 'false'),
('wordList', '["Apfel", "Banane", "Kirsche", "Hund", "Katze", "Maus", "Stern", "Sonne", "Mond"]'),
('scoring', '{"basePointsPerCorrect":100,"revealPenaltyEnabled":true,"revealPenaltyPercent":10,"minimumPointsPercent":20,"firstAnswerBonusEnabled":true,"firstAnswerBonusPoints":50,"secondAnswerBonusEnabled":true,"secondAnswerBonusPoints":30,"thirdAnswerBonusEnabled":true,"thirdAnswerBonusPoints":20,"speedBonusEnabled":false,"speedBonusMaxPoints":50,"speedBonusTimeLimit":10000}'),
('spotlight', '{"radius":80,"strength":0.5,"increaseAfterSeconds":30,"increaseFactor":1.5}');

-- Create initial lobby game
INSERT OR IGNORE INTO games (id, status) VALUES (1, 'lobby');
