-- SQLite schema for LichtBlick v3
-- See copilot-instructions.md for details

CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('lobby', 'playing', 'ended')),
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_games_status ON games(status);

CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('start', 'game', 'end')),
  correct_answer TEXT,
  display_order INTEGER NOT NULL,
  uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_images_game_type ON images(game_id, type);
CREATE INDEX idx_images_order ON images(game_id, display_order);

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  socket_id TEXT,
  last_seen INTEGER DEFAULT (strftime('%s', 'now')),
  joined_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_players_score ON players(game_id, score DESC);
CREATE INDEX idx_players_socket ON players(socket_id);

CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  submitted_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_answers_player ON answers(player_id);
CREATE INDEX idx_answers_image ON answers(image_id);

CREATE TABLE image_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  reveal_count INTEGER DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER,
  UNIQUE(game_id, image_id)
);
CREATE INDEX idx_image_states_game ON image_states(game_id);
CREATE INDEX idx_image_states_started ON image_states(game_id, started_at DESC);

-- Phase 5, Agent 3: Additional Performance Indexes
-- Optimize leaderboard queries (ORDER BY score DESC, joined_at ASC)
CREATE INDEX idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);

-- Optimize answer lookups (hasPlayerAnswered queries)
CREATE INDEX idx_answers_player_image ON answers(player_id, image_id);

-- Optimize config lookups
CREATE INDEX idx_config_key ON config(key);

-- Optimize active game queries
CREATE INDEX idx_games_active ON games(status, created_at DESC) WHERE status != 'ended';
