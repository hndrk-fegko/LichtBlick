# ARCHITECTURE - LichtBlick v3.0

**Status:** 🏗️ **DEFINIERT**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 📋 System-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vanilla JS)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  admin.html  │  │ beamer.html  │  │ player.html  │         │
│  │              │  │              │  │              │         │
│  │ • PIN-Check  │  │ • Fullscreen │  │ • QR-Join    │         │
│  │ • Gallery    │  │ • Canvas     │  │ • Word List  │         │
│  │ • Spotlight  │  │ • Spotlight  │  │ • Submit     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                 │
│         └────────┬────────┴──────────────────┘                 │
│                  │                                              │
│            Socket.IO Client                                    │
│                  │                                              │
└──────────────────┼──────────────────────────────────────────────┘
                   │ WebSocket (ws://)
┌──────────────────┼──────────────────────────────────────────────┐
│              BACKEND (Node.js)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Socket.IO Server (socket.io)                   │  │
│  │  • Room-based Broadcasting                               │  │
│  │    - admin: Admin-only events                            │  │
│  │    - beamer: All beamer instances                        │  │
│  │    - players: All mobile players                         │  │
│  │  • Connection Management                                 │  │
│  │  • Event Routing                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express REST API                            │  │
│  │  • GET /api/health                                       │  │
│  │  • POST /api/images/upload (multipart)                   │  │
│  │  • GET /api/settings                                     │  │
│  │  • PUT /api/settings                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Game State Manager                          │  │
│  │  • In-Memory Cache (LRU)                                 │  │
│  │  • Event Validation                                      │  │
│  │  • Business Logic (Scoring, Phase Transitions)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SQLite Database                             │  │
│  │  • WAL Mode (Concurrent R/W)                             │  │
│  │  • 6 Tables (config, games, images, players, answers,   │  │
│  │             image_states)                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Event-Driven Architecture

### WebSocket-Kommunikation

#### Admin → Server → Beamer

```javascript
// Admin (client)
socket.emit('admin:set_image', { imageId: 5 });

// Server (handler)
io.to('beamer').emit('beamer:image_changed', {
  imageId: 5,
  imageUrl: '/uploads/image5.jpg',
  imageType: 'game'
});

// Beamer (client)
socket.on('beamer:image_changed', ({ imageUrl }) => {
  loadImage(imageUrl);
});
```

**Latenz:** <50ms (local network)

---

#### Player → Server → All

```javascript
// Player (client)
socket.emit('player:submit_answer', { 
  imageId: 5, 
  answer: 'Stern' 
}, (response) => {
  if (response.success) {
    showFeedback(response.data);
  }
});

// Server (handler)
// 1. Validate answer
// 2. Calculate points
// 3. Update database
// 4. Broadcast leaderboard update
io.emit('game:leaderboard_update', { topPlayers });

// All Clients (listen)
socket.on('game:leaderboard_update', ({ topPlayers }) => {
  updateLeaderboard(topPlayers);
});
```

---

### Room-based Broadcasting

```javascript
// Join rooms on connect
socket.on('admin:connect', () => {
  socket.join('admin');
});

socket.on('beamer:connect', () => {
  socket.join('beamer');
});

socket.on('player:join', ({ name }) => {
  socket.join('players');
});

// Broadcast to specific rooms
io.to('beamer').emit(...);        // Only beamers
io.to('players').emit(...);       // Only players
io.to('admin').emit(...);         // Only admin
io.emit(...);                     // All connected clients
```

---

## 🗄️ Database-Architektur

### Entity-Relationship Diagram

```
┌─────────────┐
│   games     │
│  id (PK)    │
│  status     │
│  started_at │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────┴──────────────────┐
│                         │
┌─────────────┐   ┌───────────────┐
│   images    │   │    players    │
│  id (PK)    │   │    id (PK)    │
│  game_id    │   │    game_id    │
│  type       │   │    name       │
│  url        │   │    score      │
└──────┬──────┘   └───────┬───────┘
       │ 1                │ 1
       │                  │
       │ N                │ N
     ┌─┴──────────────────┴─┐
     │      answers         │
     │      id (PK)         │
     │      player_id       │
     │      image_id        │
     │      is_correct      │
     │      points_earned   │
     └──────────────────────┘

┌──────────────────┐
│  image_states    │ (Runtime State)
│  game_id         │
│  image_id        │
│  reveal_count    │
│  started_at      │
└──────────────────┘

┌──────────────────┐
│     config       │ (Key-Value Store)
│  key (PK)        │
│  value (JSON)    │
└──────────────────┘
```

---

## 📂 File Structure

```
lichtblick/
├── server/
│   ├── index.js                  # Entry Point
│   ├── .env.example              # Environment Variables
│   ├── package.json              # Dependencies
│   │
│   ├── db/
│   │   ├── database.js           # SQLite Wrapper
│   │   └── schema.sql            # Database Schema
│   │
│   ├── routes/
│   │   ├── api.js                # REST Endpoints
│   │   └── uploads.js            # File Upload Handler
│   │
│   ├── sockets/
│   │   ├── admin.js              # Admin Event Handlers
│   │   ├── beamer.js             # Beamer Event Handlers
│   │   ├── player.js             # Player Event Handlers
│   │   └── game.js               # Game State Manager
│   │
│   ├── services/
│   │   ├── scoring.js            # Points Calculation
│   │   └── state.js              # In-Memory Cache
│   │
│   └── utils/
│       ├── validation.js         # Input Validation
│       ├── logger.js             # Winston Logger
│       └── errors.js             # Error Handling
│
├── client/                       # Frontend (Static Files)
│   ├── admin.html
│   ├── beamer.html
│   ├── player.html
│   ├── index.html                # Landing Page
│   │
│   ├── js/
│   │   ├── admin.js
│   │   ├── beamer.js
│   │   ├── player.js
│   │   └── socket-adapter.js     # WebSocket Wrapper
│   │
│   └── css/
│       ├── admin.css
│       ├── beamer.css
│       └── player.css
│
├── data/                         # Runtime Data
│   ├── lichtblick.db            # SQLite Database
│   └── uploads/                  # User-uploaded Images
│
├── docs/                         # Documentation (this folder)
│   ├── README.md
│   ├── VISION.md
│   ├── USE_CASES.md
│   ├── GAME_MECHANICS.md
│   ├── ARCHITECTURE.md
│   ├── TECH_STACK.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_CONTRACT.md
│   └── IMPLEMENTATION_ROADMAP.md
│
└── README.md                     # Project README
```

---

## 🔁 Data Flow Examples

### 1. Player Join Flow

```
┌─────────┐
│ Player  │
│ (Mobile)│
└────┬────┘
     │ 1. Scan QR → Open player.html
     │ 2. Enter Name "Anna"
     │ 3. Click "Beitreten"
     ▼
┌────────────────────┐
│ player.js          │
│ socket.emit(       │
│  'player:join',    │
│  { name: 'Anna' }  │
│ )                  │
└────┬───────────────┘
     │ WebSocket
     ▼
┌────────────────────┐
│ server/sockets/    │
│ player.js          │
│                    │
│ 1. Validate name   │
│ 2. Check game      │
│    status          │
│ 3. Insert DB:      │
│    INSERT INTO     │
│    players         │
│ 4. Broadcast       │
└────┬───────────────┘
     │
     ├──────────────────────────┐
     │                          │
     ▼                          ▼
┌────────────┐          ┌──────────────┐
│ Admin      │          │ All Players  │
│ (Lobby)    │          │ (Lobby)      │
│            │          │              │
│ player:    │          │ lobby:update │
│ joined     │          │              │
│            │          │ "Anna        │
│ "Anna      │          │  joined"     │
│  joined"   │          │              │
└────────────┘          └──────────────┘
```

---

### 2. Spotlight Drawing Flow

```
┌─────────┐
│ Admin   │
│ (Canvas)│
└────┬────┘
     │ 1. Mousemove Event
     │ 2. Throttle (50ms)
     ▼
┌────────────────────┐
│ admin.js           │
│ socket.emit(       │
│  'admin:spotlight',│
│  { x, y, radius }  │
│ )                  │
└────┬───────────────┘
     │ WebSocket (throttled 20/sec)
     ▼
┌────────────────────┐
│ server/sockets/    │
│ admin.js           │
│                    │
│ Broadcast to       │
│ beamer room        │
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ beamer.js          │
│ socket.on(         │
│  'beamer:spotlight'│
│  { x, y, radius }  │
│ )                  │
│                    │
│ applySpotlight()   │
└────────────────────┘

Latency: <50ms (Admin → Beamer)
```

---

### 3. Answer Submit & Scoring Flow

```
┌─────────┐
│ Player  │
│ (Mobile)│
└────┬────┘
     │ 1. Select word "Stern"
     │ 2. Click "Absenden"
     ▼
┌────────────────────┐
│ player.js          │
│ socket.emit(       │
│  'player:submit',  │
│  { imageId: 5,     │
│    answer: 'Stern'}│
│  callback          │
│ )                  │
└────┬───────────────┘
     │ WebSocket
     ▼
┌────────────────────────────────────┐
│ server/sockets/player.js           │
│                                    │
│ 1. Check if already answered:      │
│    SELECT * FROM answers           │
│    WHERE player_id=? AND image_id=?│
│                                    │
│ 2. Get image state:                │
│    SELECT reveal_count             │
│    FROM image_states               │
│    WHERE image_id=?                │
│                                    │
│ 3. Calculate points:               │
│    • Base: 100                     │
│    • Reduction: -20 (2 reveals)    │
│    • First Bonus: +50              │
│    • Total: 130                    │
│                                    │
│ 4. Save answer:                    │
│    INSERT INTO answers             │
│    (player_id, image_id, answer,   │
│     is_correct, points_earned)     │
│    VALUES (42, 5, 'stern', 1, 130) │
│                                    │
│ 5. Update score:                   │
│    UPDATE players                  │
│    SET score = score + 130         │
│    WHERE id = 42                   │
│                                    │
│ 6. Get leaderboard:                │
│    SELECT * FROM players           │
│    ORDER BY score DESC             │
│    LIMIT 10                        │
│                                    │
│ 7. Broadcast                       │
└────┬───────────────────────────────┘
     │
     ├──────────────────┬─────────────┐
     │                  │             │
     ▼                  ▼             ▼
┌─────────┐      ┌──────────┐   ┌─────────┐
│ Player  │      │ Admin    │   │ All     │
│ (Anna)  │      │          │   │ Players │
│         │      │ answer_  │   │         │
│ Callback│      │ submitted│   │ leader  │
│ Response│      │          │   │ board_  │
│         │      │ "Anna:   │   │ update  │
│ success │      │  130pts" │   │         │
│ correct │      │          │   │ topPly  │
│ points  │      │          │   │ ers[]   │
│ newScore│      │          │   │         │
└─────────┘      └──────────┘   └─────────┘
```

---

## 🔒 Security-Architektur

### 1. Input Validation

```javascript
// server/utils/validation.js
function validatePlayerName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 2 || name.length > 20) return false;
  if (!/^[a-zA-Z0-9äöüÄÖÜß\s]+$/.test(name)) return false;
  return true;
}

function validateImageType(type) {
  return ['start', 'game', 'end'].includes(type);
}
```

### 2. SQL Injection Prevention

```javascript
// better-sqlite3 uses prepared statements
const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
const player = stmt.get(playerId); // Safe!
```

### 3. Rate Limiting

```javascript
// server/index.js
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per IP
});
app.use('/api/', apiLimiter);
```

### 4. File Upload Restrictions

```javascript
// server/routes/uploads.js
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});
```

---

## 📈 Scalability

### Horizontal Scaling (Future)

```
┌──────────┐
│  Nginx   │ (Load Balancer)
│ Reverse  │
│  Proxy   │
└────┬─────┘
     │
     ├───────────────┬───────────────┐
     ▼               ▼               ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Node.js │     │ Node.js │     │ Node.js │
│ Server 1│     │ Server 2│     │ Server 3│
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┴───────────────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
     ┌──────────┐        ┌──────────┐
     │ Redis    │        │ Postgres │
     │ (Session)│        │ (Storage)│
     └──────────┘        └──────────┘
```

**Für v3.0 NICHT nötig** (150 Users auf 1 Server)

---

## 🚀 Deployment-Modell

### Single-Server Deployment (v3.0)

```
┌────────────────────────────────────────────┐
│            Laptop (Windows/macOS)          │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Node.js Server (Port 3000)          │ │
│  │  • Express HTTP Server               │ │
│  │  • Socket.IO WebSocket Server        │ │
│  │  • Serves Static Files (HTML/CSS/JS) │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  SQLite Database                     │ │
│  │  data/lichtblick.db                 │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  File System                         │ │
│  │  data/uploads/                       │ │
│  └──────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
                    │
                    │ WLAN (192.168.1.x)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Beamer  │   │ Player  │   │ Player  │
│ (Browser│   │ (Mobile)│   │ (Mobile)│
│  F11)   │   │         │   │         │
└─────────┘   └─────────┘   └─────────┘
```

**Vorteile:**
- ✅ Einfaches Setup (keine Cloud)
- ✅ Offline-fähig (keine Internet-Abhängigkeit)
- ✅ Keine laufenden Kosten
- ✅ Volle Kontrolle über Daten

---

**Nächster Schritt:** [API_CONTRACT.md](./API_CONTRACT.md) → Verstehe die Schnittstellen im Detail.
