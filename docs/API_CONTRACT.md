# LichtBlick API Contract v3.0

**Version:** 3.0.0  
**Last Updated:** 2025-11-27  
**Status:** 🚀 SPECIFICATION (Target Architecture)

This document defines the complete interface contract between Frontend, Backend, and Database for the LichtBlick v3.0 rewrite. Use this as the single source of truth for all communication protocols.

---

## Table of Contents

1. [Security & Authentication](#security--authentication)
2. [Database Schema](#database-schema)
3. [REST API Endpoints](#rest-api-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)

---

## Security & Authentication

### Admin Access Control

Das System verwendet ein **2-stufiges Sicherheitsmodell** für Admin-Zugriff:

#### 1. URL Admin Token (Primär)
- Beim ersten Server-Start wird ein einzigartiger 32-Zeichen-Token generiert
- Gespeichert in: `config.adminToken` (DB)
- Admin-URL: `http://host:port/admin.html?token=<ADMIN_TOKEN>`
- Token wird in Server-Konsole beim Start angezeigt
- **Factory Reset** regeneriert den Token

```
═══════════════════════════════════════════════════════════
🔐 ADMIN-ZUGANG (diesen Link nicht teilen!):
   http://localhost:3000/admin.html?token=wDMMcrJbK5bbuOBnIvpuz_NbCehbrzHn
═══════════════════════════════════════════════════════════
```

#### 2. PIN-Schutz (Sekundär, Optional)
- Aktivierbar über Admin-Panel: "Adminschutz aktivieren"
- Standard-PIN: `1234`
- Kombinierbar mit URL-Token für doppelte Sicherheit
- Ablaufdatum setzbar

### REST API Authentication

Alle schreibenden REST-Endpoints benötigen Bearer-Token:

```http
Authorization: Bearer <REST_TOKEN>
```

Token-Akquise über Login:
```http
POST /api/auth/login
Content-Type: application/json

{"pin": "1234"}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "abc123...",
    "expiresIn": 14400
  }
}
```

### WebSocket Security

- **admin:connect** Event erfordert gültiges URL-Token
- Alle Admin-Events prüfen Mitgliedschaft im `admin` Room
- Unautorisierte Socket-Zugriffe liefern Easter-Egg-Response

---

## Database Schema

### Tables Overview

```sql
-- Configuration (Key-Value Store)
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,              -- JSON-serialized
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game Sessions
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('lobby', 'playing', 'ended')),
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game Images (Pool)
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  is_start_image INTEGER DEFAULT 0, -- 1 = Start-Bild
  is_end_image INTEGER DEFAULT 0,   -- 1 = End-Bild
  uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Junction: Game <-> Images
CREATE TABLE game_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  correct_answer TEXT,
  display_order INTEGER DEFAULT 0,
  is_played INTEGER DEFAULT 0,      -- 1 = bereits gezeigt
  added_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(game_id, image_id)
);

-- Players
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  socket_id TEXT,                   -- Current WebSocket connection
  last_seen INTEGER DEFAULT (strftime('%s', 'now')),
  joined_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Player Answers
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  submitted_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Game State (per-image runtime state)
CREATE TABLE image_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  reveal_count INTEGER DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER,
  UNIQUE(game_id, image_id)
);
```

### Indexes

```sql
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_images_start ON images(is_start_image);
CREATE INDEX idx_images_end ON images(is_end_image);
CREATE INDEX idx_game_images_game ON game_images(game_id);
CREATE INDEX idx_game_images_order ON game_images(game_id, display_order);
CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_players_score ON players(game_id, score DESC);
CREATE INDEX idx_players_socket ON players(socket_id);
CREATE INDEX idx_answers_player ON answers(player_id);
CREATE INDEX idx_answers_image ON answers(image_id);
CREATE INDEX idx_image_states_game ON image_states(game_id);
```

### Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `adminPin` | string | `"1234"` | PIN für Admin-Zugang |
| `qrVisible` | boolean | `false` | QR-Code Sichtbarkeit auf Beamer |
| `darkMode` | boolean | `false` | Dark Mode aktiviert |
| `wordList` | array | `[]` | Täusch-Wörter für Spieler-Antwortauswahl |
| `scoring` | object | See below | Punktevergabe-Konfiguration |
| `spotlight` | object | See below | Spotlight-Einstellungen |

**Scoring Config:**
```json
{
  "basePointsPerCorrect": 100,
  "revealPenaltyPercent": 10,
  "maxReveals": 5,
  "bonusForSpeed": true
}
```

**Spotlight Config:**
```json
{
  "radius": 80,
  "strength": 0.5,
  "increaseAfterSeconds": 30,
  "increaseFactor": 1.5
}
```

---

## REST API Endpoints

Base URL: `http://localhost:3000/api`

### General Response Format

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

### Health & Status

#### `GET /api/health`
Server health check.

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "uptime": 1234.56,
  "connections": {
    "active": 5,
    "total": 42
  },
  "memory": {
    "heapUsed": "18MB",
    "heapTotal": "25MB"
  }
}
```

---

### Settings Management

#### `GET /api/settings`
Get all game settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "adminPin": "1234",
    "darkMode": false,
    "scoring": { /* scoring config */ },
    "spotlight": { /* spotlight config */ }
  }
}
```

#### `POST /api/settings`
Update complete settings.

**Request Body:**
```json
{
  "adminPin": "1234",
  "darkMode": false,
  "scoring": { /* ... */ },
  "spotlight": { /* ... */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated"
}
```

#### `PATCH /api/settings`
Partial settings update.

**Request Body:**
```json
{
  "darkMode": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated"
}
```

---

### PIN Management

#### `POST /api/pin`
Set/update admin PIN.

**Request Body:**
```json
{
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN set successfully"
}
```

#### `DELETE /api/pin`
Remove admin PIN protection.

**Response:**
```json
{
  "success": true,
  "message": "PIN removed"
}
```

#### `GET /api/check-pin`
Check if PIN protection is active.

**Response:**
```json
{
  "success": true,
  "data": {
    "pinRequired": true,
    "pinSetAt": "2025-11-27T14:17:46.239Z"
  }
}
```

#### `POST /api/verify-pin`
Verify admin PIN.

**Request Body:**
```json
{
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN correct"
}
```

---

### Image Management

#### `GET /api/images`
Get all images (pool).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "bild1.jpg",
      "url": "/uploads/bild1.jpg",
      "is_start_image": false,
      "is_end_image": false,
      "uploaded_at": 1732712345
    },
    {
      "id": 2,
      "filename": "start.jpg",
      "url": "/uploads/start.jpg",
      "is_start_image": true,
      "is_end_image": false,
      "uploaded_at": 1732712400
    }
  ]
}
```

#### `POST /api/images/upload`
Upload new image (no type required).

**Request:** `multipart/form-data`
- `image`: File (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "filename": "neu.jpg",
    "url": "/uploads/neu.jpg",
    "is_start_image": false,
    "is_end_image": false
  },
  "message": "Image uploaded successfully"
}
```

#### `PATCH /api/images/:id/set-start`
Set image as start image (clears previous start image).

**Response:**
```json
{
  "success": true,
  "message": "Bild als Start-Bild gesetzt"
}
```

#### `PATCH /api/images/:id/set-end`
Set image as end image (clears previous end image).

**Response:**
```json
{
  "success": true,
  "message": "Bild als End-Bild gesetzt"
}
```

#### `PATCH /api/images/:id/clear-role`
Clear start/end role from image.

**Response:**
```json
{
  "success": true,
  "message": "Rolle entfernt"
}
```

#### `DELETE /api/images/:id`
Delete image from pool.

**Response:**
```json
{
  "success": true,
  "message": "Image deleted"
}
```

---

### Game Images Management

#### `GET /api/game-images`
Get images assigned to current game with order and answers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "image_id": 5,
      "filename": "kerze.jpg",
      "url": "/uploads/kerze.jpg",
      "correct_answer": "Kerze",
      "display_order": 0,
      "is_played": false
    },
    {
      "id": 2,
      "image_id": 7,
      "filename": "stern.jpg",
      "url": "/uploads/stern.jpg",
      "correct_answer": "Stern",
      "display_order": 1,
      "is_played": true
    }
  ]
}
```

#### `POST /api/game-images`
Add image to current game.

**Request Body:**
```json
{
  "imageId": 5,
  "correctAnswer": "Kerze"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "image_id": 5,
    "correct_answer": "Kerze",
    "display_order": 0,
    "is_played": false
  },
  "message": "Bild zum Spiel hinzugefügt"
}
```

#### `DELETE /api/game-images/:id`
Remove image from current game.

**Response:**
```json
{
  "success": true,
  "message": "Bild aus Spiel entfernt"
}
```

#### `PATCH /api/game-images/:id`
Update game image (answer, played status).

**Request Body:**
```json
{
  "correctAnswer": "Kerze",
  "isPlayed": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Aktualisiert"
}
```

#### `PATCH /api/game-images/reorder`
Reorder game images.

**Request Body:**
```json
{
  "order": [3, 1, 2]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reihenfolge aktualisiert"
}
```

#### `POST /api/game-images/reset-played`
Reset all is_played flags for current game.

**Response:**
```json
{
  "success": true,
  "message": "Alle Bilder zurückgesetzt"
}
```

---

### Word Bank Management

#### `GET /api/words`
Get word bank for players.

**Response:**
```json
{
  "success": true,
  "data": ["Kerze", "Stern", "Baum", "Geschenk"]
}
```

#### `POST /api/words`
Update word bank.

**Request Body:**
```json
{
  "words": ["Kerze", "Stern", "Baum"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Words saved"
}
```

---

## WebSocket Events

**Connection URL:** `ws://localhost:3000`  
**Protocol:** Socket.IO v4.x

### Connection Flow

```javascript
// Client connects
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

---

### Admin Events

#### Client → Server

##### `admin:connect`
Admin joins admin room.

**Payload:** None

**Response Event:** `admin:initial_state`

```javascript
socket.emit('admin:connect');
```

Notes:
- If admin protection is disabled, `admin:connect` does not require a PIN.
- If protection is enabled and not expired, the admin must authenticate separately via `admin:auth` before receiving state.

---

##### `admin:set_image`
Admin selects/changes current image.

**Payload:**
```typescript
{
  imageId: number;
  imageType: 'start' | 'game' | 'end';
}
```

**Emits to Beamer:** `beamer:image_changed`

```javascript
socket.emit('admin:set_image', { imageId: 123, imageType: 'game' });
```

---

##### `admin:spotlight`
Admin draws spotlight on canvas (throttled to 20/sec).

**Payload:**
```typescript
{
  x: number;      // Absolute pixel position
  y: number;      // Absolute pixel position
  radius: number; // Spotlight radius in pixels
}
```

**Emits to Beamer:** `beamer:spotlight`

```javascript
socket.emit('admin:spotlight', { x: 500, y: 300, radius: 80 });
```

---

##### `admin:toggle_qr`
Toggle QR code visibility on beamer.

**Payload:**
```typescript
{
  visible: boolean;
  url?: string;  // Player URL (optional, defaults to /player.html)
}
```

**Emits to Beamer:** `beamer:qr_state`

```javascript
socket.emit('admin:toggle_qr', { visible: true, url: 'http://localhost:3000/player.html' });
```

---

##### `admin:reset_game`
Reset entire game state.

**Payload:** None

**Emits to All:** `beamer:game_reset`, `player:game_reset`

```javascript
socket.emit('admin:reset_game');
```

---

#### Server → Admin

##### `admin:initial_state`
Sent after `admin:connect`.

**Payload:**
```typescript
{
  success: boolean;
  data: {
    game: {
      id: number;
      status: 'lobby' | 'playing' | 'ended';
    };
    players: Array<{
      id: number;
      name: string;
      score: number;
    }>;
    playerCount: number;
  }
}
```

---

##### `admin:player_joined`
New player joined the game.

**Payload:**
```typescript
{
  success: boolean;
  data: {
    id: number;
    name: string;
    score: number;
  }
}
```

---

##### `admin:answer_submitted`
Player submitted an answer.

**Payload:**
```typescript
{
  success: boolean;
  data: {
    playerId: number;
    playerName: string;
    imageId: number;
    answer: string;
    isCorrect: boolean;
    pointsEarned: number;
    newScore: number;
  }
}
```

---

### Beamer Events

#### Client → Server

##### `beamer:connect`
Beamer joins beamer room.

**Payload:** None

**Response Event:** `beamer:initial_state`, `beamer:image_changed`, `beamer:settings_changed`, `beamer:qr_state`

```javascript
socket.emit('beamer:connect');
```

---

#### Server → Beamer

##### `beamer:initial_state`
Sent after `beamer:connect`.

**Payload:**
```typescript
{
  success: boolean;
  data: {
    game: {
      id: number;
      status: 'lobby' | 'playing' | 'ended';
    };
    playerCount: number;
  }
}
```

---

##### `beamer:image_changed`
Current image changed.

**Payload:**
```typescript
{
  imageId: number;
  imageUrl: string;
  imageType: 'start' | 'game' | 'end';
}
```

**Trigger:** Admin calls `admin:set_image`

```javascript
socket.on('beamer:image_changed', ({ imageId, imageUrl, imageType }) => {
  loadImage(imageUrl);
});
```

---

##### `beamer:spotlight`
Real-time spotlight position from admin.

**Payload:**
```typescript
{
  x: number;
  y: number;
  radius: number;
}
```

**Frequency:** Max 20/second (throttled)  
**Trigger:** Admin calls `admin:spotlight`

```javascript
socket.on('beamer:spotlight', ({ x, y, radius }) => {
  applySpotlight(x, y, radius);
});
```

---

##### `beamer:qr_state`
QR code visibility changed.

**Payload:**
```typescript
{
  visible: boolean;
  url: string;
}
```

**Trigger:** Admin calls `admin:toggle_qr`

```javascript
socket.on('beamer:qr_state', ({ visible, url }) => {
  if (visible) showQRCode(url);
  else hideQRCode();
});
```

---

##### `beamer:settings_changed`
Game settings updated.

**Payload:**
```typescript
{
  darkMode: boolean;
  spotlight: {
    radius: number;
    strength: number;
    increaseAfterSeconds: number;
    increaseFactor: number;
  }
}
```

**Trigger:** Settings updated via REST API

```javascript
socket.on('beamer:settings_changed', (settings) => {
  spotlightSettings = settings.spotlight;
});
```

---

##### `beamer:leaderboard`
Leaderboard update.

**Payload:**
```typescript
{
  topPlayers: Array<{
    name: string;
    score: number;
    rank: number;
  }>;
  totalPlayers: number;
}
```

**Trigger:** Player submits answer, scores change

```javascript
socket.on('beamer:leaderboard', ({ topPlayers, totalPlayers }) => {
  updateLeaderboard(topPlayers);
});
```

---

##### `beamer:game_reset`
Game was reset.

**Payload:** None

**Trigger:** Admin calls `admin:reset_game`

```javascript
socket.on('beamer:game_reset', () => {
  clearCanvas();
  resetState();
});
```

---

### Player Events

#### Client → Server

##### `player:join`
Player joins the game.

**Payload:**
```typescript
{
  name: string;
}
```

**Response:** Callback with player data

```javascript
socket.emit('player:join', { name: 'Max' }, (response) => {
  if (response.success) {
    const { playerId, score } = response.data;
    console.log('Joined as player', playerId);
  }
});
```

**Callback Response:**
```typescript
{
  success: boolean;
  data?: {
    playerId: number;
    score: number;
  };
  message?: string;
}
```

---

##### `player:submit_answer`
Player submits answer for current image.

**Payload:**
```typescript
{
  imageId: number;
  answer: string;
}
```

**Response:** Callback with result

```javascript
socket.emit('player:submit_answer', { imageId: 123, answer: 'Kerze' }, (response) => {
  if (response.success) {
    const { correct, points, newScore } = response.data;
    if (correct) showSuccess(points);
    else showError();
  }
});
```

**Callback Response:**
```typescript
{
  success: boolean;
  data?: {
    correct: boolean;
    points: number;
    newScore: number;
  };
  message?: string;
}
```

---

##### `player:reconnect`
Player reconnects with existing ID.

**Payload:**
```typescript
{
  playerId: number;
}
```

**Response:** Callback with updated data

```javascript
socket.emit('player:reconnect', { playerId: 42 }, (response) => {
  if (response.success) {
    const { score, phase } = response.data;
    updateScore(score);
    // Client can restore the correct screen based on phase
    if (phase === 'playing') showGameUI();
    if (phase === 'lobby') showLobby();
  }
});
```

Callback Response augmentation:
```typescript
{
  success: boolean;
  data?: {
    playerId: number;
    name: string;
    score: number;
    phase: 'lobby' | 'playing' | 'ended';
  };
  message?: string;
}
```

##### `player:keep_alive`
Player heartbeat to update last_seen.

**Payload:** None

**Response:** None

Notes:
- Sent every 30 seconds by clients with an active session.
- Server may mark players inactive (`is_active = 0`) when `last_seen` is older than 60 seconds.

##### `player:leave`
Player voluntarily leaves the game.

**Payload:**
```typescript
{
  playerId: number;
}
```

**Response:** Callback
```typescript
{
  success: boolean;
}
```

Notes:
- Server marks player `is_active = 0` (soft-delete) but keeps historical data.
- Server broadcasts `game:lobby_update` with active player count only.

---

#### Server → Player

##### `game:leaderboard_update`
Leaderboard changed (broadcast to all players).

**Payload:**
```typescript
{
  topPlayers: Array<{
    name: string;
    score: number;
    rank: number;
  }>;
  yourRank?: number;  // If player is in top 10
  totalPlayers?: number; // Active players only (is_active = 1)
}
```

```javascript
socket.on('game:leaderboard_update', ({ topPlayers, yourRank }) => {
  updateLeaderboardDisplay(topPlayers, yourRank);
});
```

---

##### `game:phase_change`
Game phase changed (e.g., new image, game started/ended).

**Payload:**
```typescript
{
  phase: 'lobby' | 'playing' | 'ended';
  imageId?: number;
  imageType?: 'start' | 'game' | 'end';
}
```

```javascript
socket.on('game:phase_change', ({ phase, imageId }) => {
  if (phase === 'playing') showGameUI();
  if (phase === 'ended') showResults();
});
```

---

## Data Models

### Game Model
```typescript
interface Game {
  id: number;
  status: 'lobby' | 'playing' | 'ended';
  started_at: number | null;  // Unix timestamp
  ended_at: number | null;
  created_at: number;
}
```

### Image Model
```typescript
interface Image {
  id: number;
  filename: string;
  url: string;
  is_start_image: boolean;
  is_end_image: boolean;
  uploaded_at: number;
}
```

### GameImage Model
```typescript
interface GameImage {
  id: number;
  game_id: number;
  image_id: number;
  correct_answer: string | null;
  display_order: number;
  is_played: boolean;
  added_at: number;
}
```

### Player Model
```typescript
interface Player {
  id: number;
  game_id: number;
  name: string;
  score: number;
  socket_id: string | null;
  is_active: 0 | 1;
  last_seen: number;
  joined_at: number;
}
```

### Answer Model
```typescript
interface Answer {
  id: number;
  player_id: number;
  image_id: number;
  answer: string;
  is_correct: boolean;
  points_earned: number;
  submitted_at: number;
}
```

---

## Error Handling

### HTTP Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Invalid PIN |
| 404 | Not Found | Image ID doesn't exist |
| 409 | Conflict | Player already answered |
| 413 | Payload Too Large | Image file > 10MB |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Database error |

### Error Response Format

```typescript
{
  success: false,
  message: string,      // User-friendly German message
  error?: string,       // Technical error (dev mode only)
  code?: string         // Error code (e.g., "INVALID_PIN")
}
```

### WebSocket Errors

Errors are sent via `error` event:

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // error = { message: string, code?: string }
});
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PIN` | PIN verification failed |
| `GAME_NOT_FOUND` | No active game |
| `PLAYER_NOT_FOUND` | Player ID invalid |
| `IMAGE_NOT_FOUND` | Image ID invalid |
| `ALREADY_ANSWERED` | Player already answered this image |
| `GAME_NOT_STARTED` | Cannot submit answer in lobby |
| `UPLOAD_ERROR` | File upload failed |
| `DATABASE_ERROR` | SQLite transaction failed |
| `VALIDATION_ERROR` | Input validation failed |

---

## Performance Guarantees

| Metric | Target | Notes |
|--------|--------|-------|
| REST API Response | < 50ms (p95) | Indexed queries |
| WebSocket Latency | < 50ms (p95) | Local network |
| Spotlight Update | < 50ms | Real-time broadcast |
| Image Change | < 100ms | Includes canvas render |
| Concurrent Players | 150+ | Tested with load tests |
| Database Write | < 5ms | WAL mode |

---

## Migration Notes (v1.x → v3.0)

### Deprecated API Endpoints (v1.x Legacy)

These legacy PHP endpoints are NO LONGER SUPPORTED in v3.0:

- `POST /api-v2.php?action=set_current_image` → Use WebSocket `admin:set_image`
- `POST /api-v2.php?action=add_spotlight` → Use WebSocket `admin:spotlight`
- `GET /api-v2.php?action=get_current_image` → Use WebSocket `beamer:image_changed`
- `POST /api-v2.php?action=join_game` → Use WebSocket `player:join`
- `POST /api-v2.php?action=submit_answer` → Use WebSocket `player:submit_answer`

### Breaking Changes

1. **File Storage:** JSON files (`data/*.json`) replaced by SQLite database
2. **Polling:** All `setInterval` polling removed, replaced by WebSocket push
3. **Image IDs:** Changed from timestamp-based to auto-increment integers
4. **Timestamps:** All timestamps are Unix epoch integers (not ISO strings)
5. **QR Visibility:** Default changed from `true` to `false`

---

## Examples

### Complete Admin Flow

```javascript
// 1. Connect
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // 2. Join admin room
  socket.emit('admin:connect');
});

// 3. Receive initial state
socket.on('admin:initial_state', (state) => {
  console.log('Players:', state.data.playerCount);
  console.log('Game status:', state.data.game.status);
});

// 4. Select start image
socket.emit('admin:set_image', { imageId: 1, imageType: 'start' });

// 5. Enable QR code
socket.emit('admin:toggle_qr', { visible: true });

// 6. Draw spotlight (on mousemove, throttled)
canvas.addEventListener('mousemove', throttle((e) => {
  socket.emit('admin:spotlight', {
    x: e.clientX,
    y: e.clientY,
    radius: 80
  });
}, 50));

// 7. Listen for player answers
socket.on('admin:answer_submitted', (answer) => {
  if (answer.data.isCorrect) {
    console.log(`${answer.data.playerName} correct! +${answer.data.pointsEarned} points`);
  }
});
```

### Complete Beamer Flow

```javascript
// 1. Connect
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // 2. Join beamer room
  socket.emit('beamer:connect');
});

// 3. Receive initial state + current image
socket.on('beamer:initial_state', (state) => {
  console.log('Game:', state.data.game);
});

socket.on('beamer:image_changed', ({ imageUrl }) => {
  loadImageToCanvas(imageUrl);
});

// 4. Real-time spotlight
socket.on('beamer:spotlight', ({ x, y, radius }) => {
  applySpotlightMask(x, y, radius);
});

// 5. QR code toggle
socket.on('beamer:qr_state', ({ visible, url }) => {
  if (visible) showQRCodeModal(url);
  else hideQRCodeModal();
});

// 6. Leaderboard updates
socket.on('beamer:leaderboard', ({ topPlayers }) => {
  updateLeaderboardDisplay(topPlayers);
});
```

### Complete Player Flow

```javascript
// 1. Connect
const socket = io('http://localhost:3000');

// 2. Join game
socket.emit('player:join', { name: 'Max Mustermann' }, (response) => {
  if (response.success) {
    const playerId = response.data.playerId;
    localStorage.setItem('playerId', playerId);
  }
});

// 3. Submit answer
socket.emit('player:submit_answer', {
  imageId: 5,
  answer: 'Kerze'
}, (response) => {
  if (response.success) {
    if (response.data.correct) {
      showSuccess(`+${response.data.points} Punkte!`);
    } else {
      showError('Leider falsch');
    }
    updateScore(response.data.newScore);
  }
});

// 4. Listen for leaderboard
socket.on('game:leaderboard_update', ({ topPlayers, yourRank }) => {
  updateLeaderboard(topPlayers);
  if (yourRank) showRank(yourRank);
});

// 5. Listen for phase changes
socket.on('game:phase_change', ({ phase, imageId }) => {
  if (phase === 'playing') showGameUI();
  if (phase === 'ended') showResultsScreen();
});
```

---

## Testing Checklist

### REST API Tests
- [ ] `GET /api/health` returns 200 with valid JSON
- [ ] `GET /api/settings` returns current config
- [ ] `POST /api/settings` updates database
- [ ] `POST /api/images/upload` accepts multipart form-data
- [ ] `GET /api/images` returns grouped by type
- [ ] `DELETE /api/images/:id` removes from filesystem + DB
- [ ] `POST /api/pin` sets PIN in database
- [ ] `POST /api/verify-pin` validates correctly

### WebSocket Tests
- [ ] Admin connects and receives `admin:initial_state`
- [ ] Beamer connects and receives `beamer:initial_state`
- [ ] Player connects and `player:join` callback works
- [ ] `admin:set_image` broadcasts to beamer
- [ ] `admin:spotlight` broadcasts at max 20/sec
- [ ] `admin:toggle_qr` updates beamer display
- [ ] `player:submit_answer` updates score + leaderboard
- [ ] Disconnected player can reconnect with `player:reconnect`
- [ ] Multiple beamers receive same events (room broadcast)

### Performance Tests
- [ ] 150 concurrent Socket.IO connections
- [ ] Spotlight broadcast latency < 50ms
- [ ] Database write latency < 5ms
- [ ] No memory leaks after 1000 image changes
- [ ] Rate limiting prevents DoS (429 errors)

---

**End of API Contract v3.0**
