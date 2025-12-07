# DATABASE_SCHEMA - LichtBlick v3.0

**Status:** 🗄️ **PRODUCTION READY**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 📋 Übersicht

Vollständiges SQLite-Datenbankschema für LichtBlick v3.0 mit 6 Tabellen, Indexes und Performance-Optimierungen.

**Database File:** `data/lichtblick.db`  
**Engine:** SQLite 3.40+ mit WAL-Mode  
**ORM:** Keine (direktes better-sqlite3)

---

## 🗂️ Tabellen-Übersicht

| Tabelle | Zweck | Rows (Estimate) |
|---------|-------|-----------------|
| `config` | Key-Value Store für Settings | ~10 |
| `games` | Game Sessions | ~100/Jahr |
| `images` | Hochgeladene Bilder (Meta) | ~800/Jahr |
| `players` | Spieler pro Game | ~3000/Jahr |
| `answers` | Spieler-Antworten | ~18000/Jahr |
| `image_states` | Runtime-State pro Bild | ~800/Jahr |

---

## 📐 Schema

### 1. config (Konfiguration)

**Zweck:** Key-Value Store für globale Einstellungen

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,              -- JSON-serialized
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_config_key ON config(key);
```

**Beispiel-Daten:**
```sql
INSERT INTO config (key, value) VALUES
('adminPin', '"1234"'),
('qrVisible', 'false'),
('darkMode', 'false'),
('wordList', '["Apfel", "Banane", "Kirsche", "Hund", "Katze", "Maus", "Stern", "Sonne", "Mond"]'),
('scoring', '{"basePointsPerCorrect":100,"revealPenaltyEnabled":true}'),
('spotlight', '{"radius":80,"strength":0.5,"increaseAfterSeconds":30}');
```

**Hinweis:** `value` ist JSON-String (muss deserialisiert werden)
- `wordList` enthält Täusch-Wörter, die Spielern als Antwort-Optionen angezeigt werden

---

### 2. games (Spiel-Sessions)

**Zweck:** Tracking von Game-Sessions (eine Session pro Event)

```sql
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('lobby', 'playing', 'ended')),
  started_at INTEGER,               -- NULL bis 'playing'
  ended_at INTEGER,                 -- NULL bis 'ended'
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_active ON games(status, created_at DESC) 
  WHERE status != 'ended';
```

**Lifecycle:**
```
created_at → status='lobby' → started_at (when playing) → ended_at (when ended)
```

**Beispiel-Query:**
```sql
-- Get active game
SELECT * FROM games WHERE status IN ('lobby', 'playing') ORDER BY created_at DESC LIMIT 1;
```

---

### 3. images (Bild-Pool)

**Zweck:** Zentrale Sammlung aller hochgeladenen Bilder

```sql
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,           -- Original filename
  url TEXT NOT NULL,                -- /uploads/abc123.jpg
  is_start_image INTEGER DEFAULT 0, -- 1 = wird als Start-Bild verwendet
  is_end_image INTEGER DEFAULT 0,   -- 1 = wird als End-Bild verwendet
  uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_images_start ON images(is_start_image);
CREATE INDEX idx_images_end ON images(is_end_image);
```

**Hinweis:**
- Nur EIN Bild sollte `is_start_image = 1` haben
- Nur EIN Bild sollte `is_end_image = 1` haben
- Bilder ohne Flags sind verfügbar für Game-Zuweisung
- Kein `game_id` mehr - Bilder sind game-unabhängig

---

### 3b. game_images (Junction-Tabelle)

**Zweck:** Verknüpfung von Bildern zu Games mit Reihenfolge und Antworten

```sql
CREATE TABLE game_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  correct_answer TEXT,              -- Richtige Antwort für dieses Bild im Spiel
  display_order INTEGER DEFAULT 0,  -- Reihenfolge im Spiel (0-based)
  is_played INTEGER DEFAULT 0,      -- 1 = bereits gezeigt in diesem Spiel
  added_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(game_id, image_id)         -- Jedes Bild nur einmal pro Spiel
);

CREATE INDEX idx_game_images_game ON game_images(game_id);
CREATE INDEX idx_game_images_order ON game_images(game_id, display_order);
```

**Beispiel-Query:**
```sql
-- Get all game images sorted by display order
SELECT gi.*, i.filename, i.url 
FROM game_images gi
JOIN images i ON gi.image_id = i.id
WHERE gi.game_id = 1 
ORDER BY gi.display_order ASC;

-- Get start image
SELECT * FROM images WHERE is_start_image = 1 LIMIT 1;

-- Get end image
SELECT * FROM images WHERE is_end_image = 1 LIMIT 1;
```

---

### 4. players (Spieler)

**Zweck:** Spieler-Accounts pro Game

```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- 2-20 Zeichen
  score INTEGER DEFAULT 0,          -- Aktuelle Punktzahl
  socket_id TEXT,                   -- Aktuelle WebSocket-Connection
  is_active INTEGER DEFAULT 1,      -- 1=aktiv, 0=inaktiv (soft-delete)
  last_seen INTEGER DEFAULT (strftime('%s', 'now')),
  joined_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_players_score ON players(game_id, score DESC);
CREATE INDEX idx_players_socket ON players(socket_id);
CREATE INDEX idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);
CREATE INDEX idx_players_active ON players(game_id, is_active);
```

**Wichtig:** `socket_id` wird bei WebSocket-Reconnect aktualisiert

**Session-Health & Cleanup:**
- Clients senden alle 30 Sekunden `player:keep_alive` → aktualisiert `last_seen`.
- Server markiert Spieler als inaktiv (`is_active = 0`), wenn `last_seen < now - 60s`.
- Leaderboard/Lobby zählen nur aktive Spieler (`is_active = 1`).
- `player:reconnect` setzt `is_active = 1` und aktualisiert `socket_id`, `last_seen`.

**Leaderboard-Query:**
```sql
-- Top 10 Spieler
SELECT 
  id, 
  name, 
  score,
  RANK() OVER (ORDER BY score DESC, joined_at ASC) as rank
FROM players
WHERE game_id = 1
ORDER BY score DESC, joined_at ASC
LIMIT 10;
```

---

### 5. answers (Spieler-Antworten)

**Zweck:** Tracking aller eingereichten Antworten

```sql
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,             -- Eingereichte Antwort (lowercase)
  is_correct BOOLEAN NOT NULL DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  submitted_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_answers_player ON answers(player_id);
CREATE INDEX idx_answers_image ON answers(image_id);
CREATE INDEX idx_answers_player_image ON answers(player_id, image_id);
```

**Business Rules:**
- Ein Spieler kann pro Bild nur EINE Antwort abgeben (validiert in API)
- `is_correct` wird bei Submit berechnet (case-insensitive String-Vergleich)
- `points_earned` enthält finale Punkte (inkl. Boni/Strafen)

**Beispiel-Query:**
```sql
-- Hat Spieler bereits geantwortet?
SELECT COUNT(*) FROM answers 
WHERE player_id = 42 AND image_id = 5;

-- Erste richtige Antwort?
SELECT MIN(submitted_at) FROM answers 
WHERE image_id = 5 AND is_correct = 1;
```

---

### 6. image_states (Runtime-State)

**Zweck:** Tracking von Bild-spezifischem State (Reveal-Count, Timing)

```sql
CREATE TABLE image_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  reveal_count INTEGER DEFAULT 0,   -- Anzahl manueller Aufdeckungen
  started_at INTEGER,               -- Wann wurde Bild angezeigt
  ended_at INTEGER,                 -- Wann wurde Reveal geklickt
  UNIQUE(game_id, image_id)
);

CREATE INDEX idx_image_states_game ON image_states(game_id);
CREATE INDEX idx_image_states_started ON image_states(game_id, started_at DESC);
```

**Lifecycle:**
```
1. Admin wählt Bild → started_at = now(), reveal_count = 0
2. Admin klickt Reveal → reveal_count++, ended_at = now()
3. Nächstes Bild → Neuer Eintrag
```

**Beispiel-Query:**
```sql
-- Get current image state
SELECT * FROM image_states 
WHERE game_id = 1 AND ended_at IS NULL 
ORDER BY started_at DESC LIMIT 1;

-- Update reveal count
UPDATE image_states 
SET reveal_count = reveal_count + 1, ended_at = strftime('%s', 'now') 
WHERE game_id = 1 AND image_id = 5;
```

---

## ⚡ Performance-Optimierungen

### WAL-Mode (Write-Ahead Logging)

**Aktivierung:**
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB Cache
```

**Vorteile:**
- ✅ Concurrent Reads während Writes
- ✅ Bis zu 1000x schnellere Writes
- ✅ Atomic Commits
- ✅ Kein Blocking bei Multiple Connections

---

### Composite Indexes

**Leaderboard-Optimierung:**
```sql
-- Vor: 2 Queries (sort by score, dann by joined_at)
-- Nach: 1 Query mit composite index
CREATE INDEX idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);
```

**Answer-Lookup-Optimierung:**
```sql
-- Häufige Query: "Hat Spieler X bereits Bild Y beantwortet?"
CREATE INDEX idx_answers_player_image ON answers(player_id, image_id);
```

---

### Partial Indexes

**Aktive-Games-Filter:**
```sql
-- Nur 'lobby' und 'playing' Games indexieren (nicht 'ended')
CREATE INDEX idx_games_active ON games(status, created_at DESC) 
WHERE status != 'ended';
```

**Vorteil:** Kleinerer Index, schnellere Queries für aktive Games

---

## 🔄 Migrations-Strategie

### Schema-Versionierung

```sql
-- Version Tracking Table
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT INTO schema_version (version) VALUES (1);
```

### Migration-Scripts

**File:** `server/db/migrations/001_initial_schema.sql`

```sql
-- Migration 001: Initial Schema
BEGIN TRANSACTION;

-- Create all tables (siehe oben)
CREATE TABLE config (...);
CREATE TABLE games (...);
-- ... etc

-- Insert version
INSERT INTO schema_version (version) VALUES (1);

COMMIT;
```

**File:** `server/db/migrations/002_add_leaderboard_index.sql`

```sql
-- Migration 002: Leaderboard Performance
BEGIN TRANSACTION;

CREATE INDEX idx_players_leaderboard ON players(game_id, score DESC, joined_at ASC);

UPDATE schema_version SET version = 2;

COMMIT;
```

---

## 🛠️ Database-Verwaltung

### Initialisierung

```javascript
// server/db/database.js
const Database = require('better-sqlite3');
const db = new Database('data/lichtblick.db');

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Load schema
const schema = fs.readFileSync('db/schema.sql', 'utf8');
db.exec(schema);
```

### Backup-Strategie

**Automatisch:**
```javascript
// Jeden Tag um 3 Uhr
const cron = require('node-cron');
cron.schedule('0 3 * * *', () => {
  const backup = require('better-sqlite3')('data/backup.db');
  db.backup(backup);
  backup.close();
});
```

**Manuell:**
```bash
# Copy database file
cp data/lichtblick.db data/backup-$(date +%Y%m%d).db

# Oder via SQL
sqlite3 data/lichtblick.db ".backup data/backup.db"
```

---

## 📊 Beispiel-Datenfluss

### Spieler tritt bei

```sql
-- 1. Create player
INSERT INTO players (game_id, name, socket_id) 
VALUES (1, 'Anna', 'socket_abc123');
-- Result: player_id = 42

-- 2. Broadcast player_joined event (via WebSocket)
-- 3. Admin sieht Lobby-Update
```

### Spieler antwortet

```sql
-- 1. Check if already answered
SELECT COUNT(*) FROM answers 
WHERE player_id = 42 AND image_id = 5;
-- Result: 0 (noch nicht geantwortet)

-- 2. Get image state for scoring
SELECT reveal_count FROM image_states 
WHERE game_id = 1 AND image_id = 5;
-- Result: 2 (zwei Aufdeckungen)

-- 3. Check if first correct answer
SELECT COUNT(*) FROM answers 
WHERE image_id = 5 AND is_correct = 1;
-- Result: 0 (noch keine richtige Antwort)

-- 4. Calculate points (siehe GAME_MECHANICS.md)
-- basePoints = 100
-- reductionFactor = 1.0 - (2 * 0.1) = 0.8
-- reducedPoints = 80
-- firstBonus = 50
-- totalPoints = 130

-- 5. Insert answer
INSERT INTO answers (player_id, image_id, answer, is_correct, points_earned)
VALUES (42, 5, 'stern', 1, 130);

-- 6. Update player score
UPDATE players SET score = score + 130 WHERE id = 42;

-- 7. Broadcast leaderboard_update event
```

---

## 🔍 Nützliche Queries

### Game-Management

```sql
-- Create new game
INSERT INTO games (status) VALUES ('lobby');

-- Get active game
SELECT * FROM games 
WHERE status IN ('lobby', 'playing') 
ORDER BY created_at DESC LIMIT 1;

-- End game
UPDATE games SET status = 'ended', ended_at = strftime('%s', 'now') 
WHERE id = 1;
```

### Player-Management

```sql
-- Get player count
SELECT COUNT(*) FROM players WHERE game_id = 1;

-- Get player by socket_id
SELECT * FROM players WHERE socket_id = 'socket_abc123';

-- Update last_seen (heartbeat)
UPDATE players SET last_seen = strftime('%s', 'now') 
WHERE id = 42;

-- Disconnect player (clear socket_id)
UPDATE players SET socket_id = NULL WHERE id = 42;
```

### Statistics

```sql
-- Average score
SELECT AVG(score) FROM players WHERE game_id = 1;

-- Total answers
SELECT COUNT(*) FROM answers 
JOIN players ON answers.player_id = players.id 
WHERE players.game_id = 1;

-- Correct answer rate
SELECT 
  COUNT(CASE WHEN is_correct = 1 THEN 1 END) * 100.0 / COUNT(*) as accuracy_percent
FROM answers
JOIN players ON answers.player_id = players.id
WHERE players.game_id = 1;
```

---

## 🚨 Wichtige Hinweise

### Timestamps

- **Format:** Unix Epoch (Sekunden seit 1970-01-01)
- **SQLite Function:** `strftime('%s', 'now')`
- **JavaScript:** `Math.floor(Date.now() / 1000)`

### JSON-Serialisierung

- `config.value` ist **immer** JSON-String
- **Speichern:** `JSON.stringify({...})`
- **Laden:** `JSON.parse(value)`

### Foreign Keys

- **WICHTIG:** SQLite Foreign Keys sind **standardmäßig deaktiviert**!
- **Aktivieren:** `PRAGMA foreign_keys = ON;` (bei jeder Connection)

---

**Vollständige SQL-Datei:** `DATABASE_SCHEMA.sql` (in diesem Ordner)

**Nächster Schritt:** [API_CONTRACT.md](./API_CONTRACT.md) → Verstehe die Schnittstellen.
