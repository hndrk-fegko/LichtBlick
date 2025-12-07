# IMPLEMENTATION_ROADMAP - LichtBlick v3.0

**Status:** 🗺️ **BEREIT FÜR UMSETZUNG**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 📋 Übersicht

Dieser Roadmap beschreibt die **schrittweise Implementierung** von LichtBlick v3.0 in 4 Phasen. Jede Phase ist in sich abgeschlossen und testbar.

**Geschätzte Gesamtdauer:** 9-11 Tage (Full-Time, Solo Developer)  
**Alternative:** 4-5 Tage mit 3 parallelen KI-Agenten

---

## 🎯 Implementierungs-Strategie

### Contract-First Development

1. **API_CONTRACT.md ist fix** → Keine Änderungen während Implementierung
2. **Frontend/Backend unabhängig** → Können parallel entwickelt werden
3. **Mock-First Testing** → Frontend mit Mock-Server testen

### Incremental Delivery

Jede Phase liefert ein **lauffähiges Inkrement**:

- **Phase 1:** Backend läuft (REST + WebSockets funktionieren)
- **Phase 2:** Admin kann Bilder hochladen, Beamer synchronisiert
- **Phase 3:** Spieler können beitreten und Antworten
- **Phase 4:** Production-Ready (alle Edge Cases behandelt)

---

## 📅 Phase 1: Backend Core (3-4 Tage)

### Ziel
Express + Socket.IO + SQLite lauffähig, grundlegende REST-Endpoints implementiert.

### Tasks

#### 1.1 Project Setup (0.5 Tage)

**Deliverables:**
- `package.json` mit Dependencies
- `.env.example` Template
- `server/index.js` Entry Point
- Directory Structure angelegt

**Code:**
```bash
# 1. Init Project
mkdir lichtblick && cd lichtblick
npm init -y

# 2. Install Dependencies
npm install express socket.io better-sqlite3 cors compression express-rate-limit multer dotenv winston

# 3. Install DevDependencies
npm install --save-dev nodemon jest supertest socket.io-client

# 4. Create Directory Structure
mkdir -p server/{db,routes,sockets,services,utils}
mkdir -p client/{js,css}
mkdir -p data/uploads
mkdir -p logs
mkdir -p docs
```

**Files:**
```javascript
// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static('../client'));

// Routes
app.use('/api', require('./routes/api'));

// Socket.IO
require('./sockets')(io);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
```

**Akzeptanzkriterien:**
- [x] `npm start` startet Server ohne Errors
- [x] `http://localhost:3000` erreichbar
- [x] Logs werden in `logs/combined.log` geschrieben

---

#### 1.2 Database Setup (1 Tag)

**Deliverables:**
- `server/db/schema.sql` (kopiert aus `restart/DATABASE_SCHEMA.sql`)
- `server/db/database.js` (SQLite Wrapper)
- `server/db/migrations/` (Schema-Versionierung)

**Code:**
```javascript
// server/db/database.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || './data/lichtblick.db';

class DatabaseManager {
  constructor() {
    this.db = new Database(DB_PATH);
    this.initialize();
  }

  initialize() {
    // Enable WAL mode
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    
    // Load schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    this.db.exec(schema);
    
    logger.info('Database initialized', { path: DB_PATH });
  }

  getConfig(key) {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get(key);
    return row ? JSON.parse(row.value) : null;
  }

  setConfig(key, value) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
    );
    stmt.run(key, JSON.stringify(value));
  }

  // ... weitere Helper-Methoden
}

module.exports = new DatabaseManager();
```

**Akzeptanzkriterien:**
- [x] `data/lichtblick.db` wird erstellt
- [x] Alle Tabellen existieren (SELECT * FROM sqlite_master)
- [x] Indexes sind angelegt
- [x] `getConfig()` / `setConfig()` funktionieren

---

#### 1.3 REST API Endpoints (1 Tag)

**Deliverables:**
- `server/routes/api.js` (REST-Endpoints)
- `server/routes/uploads.js` (File-Upload)
- `server/utils/validation.js` (Input-Validation)

**Endpoints:**

```javascript
// server/routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Get Settings
router.get('/settings', (req, res) => {
  const settings = {
    darkMode: db.getConfig('darkMode') || false,
    scoring: db.getConfig('scoring') || {},
    spotlight: db.getConfig('spotlight') || {}
  };
  res.json({ success: true, data: settings });
});

// Update Settings
router.put('/settings', (req, res) => {
  const { darkMode, scoring, spotlight } = req.body;
  
  if (darkMode !== undefined) db.setConfig('darkMode', darkMode);
  if (scoring) db.setConfig('scoring', scoring);
  if (spotlight) db.setConfig('spotlight', spotlight);
  
  res.json({ success: true, message: 'Settings updated' });
});

// Get Images
router.get('/images', (req, res) => {
  const stmt = db.db.prepare('SELECT * FROM images ORDER BY display_order');
  const images = stmt.all();
  
  const grouped = {
    start: images.filter(img => img.type === 'start'),
    game: images.filter(img => img.type === 'game'),
    end: images.filter(img => img.type === 'end')
  };
  
  res.json({ success: true, data: grouped });
});

module.exports = router;
```

**Akzeptanzkriterien:**
- [x] `GET /api/health` liefert Status 200
- [x] `GET /api/settings` liefert Config aus Database
- [x] `PUT /api/settings` speichert in Database
- [x] `GET /api/images` liefert gruppierte Bilder

---

#### 1.4 Socket.IO Setup (0.5 Tage)

**Deliverables:**
- `server/sockets/index.js` (Socket.IO Bootstrapper)
- Connection-Handling für Admin/Beamer/Player

**Code:**
```javascript
// server/sockets/index.js
const logger = require('../utils/logger');

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Admin Events
    socket.on('admin:connect', () => {
      socket.join('admin');
      logger.info('Admin joined', { socketId: socket.id });
    });

    // Beamer Events
    socket.on('beamer:connect', () => {
      socket.join('beamer');
      logger.info('Beamer joined', { socketId: socket.id });
    });

    // Player Events
    socket.on('player:join', async ({ name }, callback) => {
      try {
        socket.join('players');
        logger.info('Player joined', { name, socketId: socket.id });
        callback({ success: true });
      } catch (error) {
        logger.error('Player join failed', { error });
        callback({ success: false, message: 'Join failed' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
};
```

**Akzeptanzkriterien:**
- [x] Socket.IO Server läuft auf Port 3000
- [x] Client kann verbinden (`socket.io-client`)
- [x] Rooms funktionieren (admin, beamer, players)
- [x] Disconnect wird geloggt

---

### Phase 1 Deliverables

- ✅ Server läuft (`npm start`)
- ✅ REST API funktioniert (`curl http://localhost:3000/api/health`)
- ✅ WebSocket akzeptiert Connections
- ✅ Database speichert Config
- ✅ Logs funktionieren

---

## 📅 Phase 2: Socket Event Handlers (2 Tage)

### Ziel
Alle WebSocket-Events implementiert, Admin ↔ Beamer Synchronisation funktioniert.

### Tasks

#### 2.1 Admin Events (1 Tag)

**Deliverables:**
- `server/sockets/admin.js` (Admin Event Handler)
- Spotlight-Drawing, Image-Selection, QR-Toggle

**Code:**
```javascript
// server/sockets/admin.js
const db = require('../db/database');
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  // Set Image
  socket.on('admin:set_image', async ({ imageId }) => {
    try {
      // 1. Get image from DB
      const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
      const image = stmt.get(imageId);
      
      if (!image) {
        return socket.emit('error', { message: 'Image not found' });
      }
      
      // 2. Update current image
      db.setConfig('currentImageId', imageId);
      
      // 3. Broadcast to beamer
      io.to('beamer').emit('beamer:image_changed', {
        imageId: image.id,
        imageUrl: image.url,
        imageType: image.type
      });
      
      logger.info('Image changed', { imageId });
    } catch (error) {
      logger.error('Set image failed', { error });
    }
  });

  // Spotlight Drawing
  socket.on('admin:spotlight', ({ x, y, radius }) => {
    // Broadcast to beamer (real-time, no DB)
    io.to('beamer').emit('beamer:spotlight', { x, y, radius });
  });

  // Toggle QR Code
  socket.on('admin:toggle_qr', ({ visible }) => {
    db.setConfig('qrVisible', visible);
    io.to('beamer').emit('beamer:qr_state', { 
      visible, 
      url: 'http://localhost:3000/player.html' 
    });
  });
};
```

**Akzeptanzkriterien:**
- [x] `admin:set_image` broadcasted zu Beamer
- [x] `admin:spotlight` in <50ms auf Beamer
- [x] `admin:toggle_qr` zeigt QR auf Beamer

---

#### 2.2 Beamer Events (0.5 Tage)

**Deliverables:**
- `server/sockets/beamer.js`
- Initial State Loading

**Code:**
```javascript
// server/sockets/beamer.js
const db = require('../db/database');

module.exports = (io, socket) => {
  socket.on('beamer:connect', () => {
    socket.join('beamer');
    
    // Send initial state
    const currentImageId = db.getConfig('currentImageId');
    if (currentImageId) {
      const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
      const image = stmt.get(currentImageId);
      
      socket.emit('beamer:image_changed', {
        imageId: image.id,
        imageUrl: image.url,
        imageType: image.type
      });
    }
    
    const qrVisible = db.getConfig('qrVisible');
    socket.emit('beamer:qr_state', { visible: qrVisible });
  });
};
```

**Akzeptanzkriterien:**
- [x] Beamer lädt aktuelles Bild bei Connect
- [x] QR-State wird geladen

---

#### 2.3 Player Events (0.5 Tage)

**Deliverables:**
- `server/sockets/player.js`
- Join Game, Submit Answer (Grundgerüst)

**Code:**
```javascript
// server/sockets/player.js
const db = require('../db/database');
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  socket.on('player:join', async ({ name }, callback) => {
    try {
      // 1. Validate name
      if (!name || name.length < 2 || name.length > 20) {
        return callback({ success: false, message: 'Invalid name' });
      }
      
      // 2. Get active game
      const game = db.db.prepare(
        'SELECT * FROM games WHERE status IN ("lobby", "playing") ORDER BY created_at DESC LIMIT 1'
      ).get();
      
      if (!game) {
        return callback({ success: false, message: 'No active game' });
      }
      
      // 3. Insert player
      const stmt = db.db.prepare(
        'INSERT INTO players (game_id, name, socket_id) VALUES (?, ?, ?)'
      );
      const result = stmt.run(game.id, name, socket.id);
      
      socket.join('players');
      socket.playerId = result.lastInsertRowid;
      
      // 4. Notify admin
      io.to('admin').emit('admin:player_joined', {
        playerId: socket.playerId,
        name
      });
      
      callback({ success: true, data: { playerId: socket.playerId, score: 0 } });
      logger.info('Player joined', { playerId: socket.playerId, name });
    } catch (error) {
      logger.error('Player join failed', { error });
      callback({ success: false, message: 'Join failed' });
    }
  });
  
  socket.on('player:submit_answer', async (data, callback) => {
    // TODO: Implement in Phase 3
    callback({ success: false, message: 'Not yet implemented' });
  });
};
```

**Akzeptanzkriterien:**
- [x] Spieler kann beitreten
- [x] Admin wird über Beitritt benachrichtigt
- [x] Spieler-ID wird zurückgegeben

---

### Phase 2 Deliverables

- ✅ Admin kann Bilder wechseln
- ✅ Beamer synchronisiert in <100ms
- ✅ Spotlight funktioniert in <50ms
- ✅ QR-Code Toggle funktioniert
- ✅ Spieler können beitreten

---

## 📅 Phase 3: Frontend Adapter (2-3 Tage)

### Ziel
Frontend kommuniziert via Socket.IO statt Polling.

### Tasks

#### 3.1 Socket Adapter (0.5 Tage)

**Deliverables:**
- `client/js/socket-adapter.js` (WebSocket Wrapper)

**Code:**
```javascript
// client/js/socket-adapter.js
class SocketAdapter {
  constructor(url = 'http://localhost:3000') {
    this.socket = io(url);
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  emit(event, data, callback) {
    this.socket.emit(event, data, callback);
  }

  on(event, callback) {
    this.socket.on(event, callback);
  }

  off(event, callback) {
    this.socket.off(event, callback);
  }
}

// Export singleton
window.socketAdapter = new SocketAdapter();
```

---

#### 3.2 Admin Frontend (1 Tag)

**Deliverables:**
- `client/admin.html` (keep HTML, update JS imports)
- `client/js/admin.js` (replace polling with socket.io)

**Änderungen:**
```javascript
// OLD (Polling)
setInterval(async () => {
  const response = await fetch('/api/current_image');
  const data = await response.json();
}, 2000);

// NEW (Socket.IO)
socket.on('admin:player_joined', ({ playerId, name }) => {
  addPlayerToLobby(playerId, name);
});
```

**Akzeptanzkriterien:**
- [x] Kein `setInterval` mehr
- [x] Spotlight sendet Events
- [x] Bildwechsel funktioniert
- [x] QR-Toggle funktioniert

---

#### 3.3 Beamer Frontend (0.5 Tage)

**Deliverables:**
- `client/beamer.html`
- `client/js/beamer.js`

**Änderungen:**
```javascript
// OLD
setInterval(checkForImageChange, 1000);
setInterval(checkForSpotlights, 500);

// NEW
socket.on('beamer:image_changed', ({ imageUrl }) => {
  loadImage(imageUrl);
});

socket.on('beamer:spotlight', ({ x, y, radius }) => {
  applySpotlight(x, y, radius);
});
```

**Akzeptanzkriterien:**
- [x] Kein Polling
- [x] Spotlight <50ms Latency
- [x] Bildwechsel <100ms

---

#### 3.4 Player Frontend (0.5 Tage)

**Deliverables:**
- `client/player.html`
- `client/js/player.js`

**Änderungen:**
```javascript
// OLD
async function joinGame() {
  const response = await fetch('/api/join_game', { ... });
  const data = await response.json();
}

// NEW
function joinGame(name) {
  socket.emit('player:join', { name }, (response) => {
    if (response.success) {
      const { playerId, score } = response.data;
      sessionStorage.setItem('playerId', playerId);
      showLobby();
    }
  });
}
```

**Akzeptanzkriterien:**
- [x] Beitritt funktioniert
- [x] SessionStorage speichert playerId
- [x] Lobby zeigt andere Spieler

---

### Phase 3 Deliverables

- ✅ Kein Polling mehr (alle `setInterval` entfernt)
- ✅ Admin/Beamer/Player nutzen WebSockets
- ✅ UI funktioniert identisch wie v1.x
- ✅ Latenz <50ms (Spotlight), <100ms (Bildwechsel)

---

## 📅 Phase 4: Scoring & Testing (2 Tage)

### Ziel
Vollständige Business-Logik, Production-Ready Testing.

### Tasks

#### 4.1 Scoring System (1 Tag)

**Deliverables:**
- `server/services/scoring.js` (Punkteberechnung)
- `server/sockets/player.js` (Submit Answer komplett)

**Code:**
```javascript
// server/services/scoring.js
function calculatePoints(imageState, config, isFirstCorrect) {
  const basePoints = config.scoring.basePointsPerCorrect;
  const revealCount = imageState.reveal_count;
  
  // 1. Reduction Factor
  const reductionFactor = Math.max(0.2, 1.0 - (revealCount * 0.1));
  const reducedPoints = Math.round(basePoints * reductionFactor);
  
  // 2. First Answer Bonus
  let points = reducedPoints;
  if (isFirstCorrect && config.scoring.firstAnswerBonusEnabled) {
    points += config.scoring.firstAnswerBonusPoints;
  }
  
  return points;
}

module.exports = { calculatePoints };
```

**Akzeptanzkriterien:**
- [x] Punkteberechnung korrekt (siehe GAME_MECHANICS.md)
- [x] First-Answer-Bonus funktioniert
- [x] Reveal-Penalty funktioniert

---

#### 4.2 Leaderboard (0.5 Tage)

**Deliverables:**
- Leaderboard-Query optimiert
- Broadcast nach Score-Update

**Code:**
```javascript
function getLeaderboard(gameId) {
  const stmt = db.db.prepare(`
    SELECT 
      id, 
      name, 
      score,
      RANK() OVER (ORDER BY score DESC, joined_at ASC) as rank
    FROM players
    WHERE game_id = ?
    ORDER BY score DESC, joined_at ASC
    LIMIT 10
  `);
  return stmt.all(gameId);
}
```

**Akzeptanzkriterien:**
- [x] Leaderboard sortiert korrekt
- [x] Top 10 werden angezeigt
- [x] Broadcast nach Answer-Submit

---

#### 4.3 Load Testing (0.5 Tage)

**Deliverables:**
- `tests/load-test.js` (150 Concurrent Clients)

**Code:**
```javascript
// tests/load-test.js
const io = require('socket.io-client');

async function loadTest() {
  const clients = [];
  
  for (let i = 0; i < 150; i++) {
    const socket = io('http://localhost:3000');
    clients.push(socket);
    
    socket.emit('player:join', { name: `Player${i}` }, (response) => {
      console.log(`Player ${i} joined:`, response.success);
    });
  }
  
  console.log('150 clients connected');
  
  // Wait 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Disconnect all
  clients.forEach(socket => socket.disconnect());
  console.log('All clients disconnected');
}

loadTest();
```

**Akzeptanzkriterien:**
- [x] 150 Clients verbinden erfolgreich
- [x] Keine Timeouts
- [x] Memory bleibt stabil (<500MB)

---

### Phase 4 Deliverables

- ✅ Scoring komplett implementiert
- ✅ Leaderboard funktioniert
- ✅ 150 Clients Load-Test erfolgreich
- ✅ Alle Edge Cases behandelt

---

## ✅ Definition of Done

Das Projekt ist **Production-Ready** wenn:

### Funktional
- [x] Admin kann Bilder hochladen, sortieren, Lösungen eintragen
- [x] Beamer zeigt Bilder in Fullscreen mit Spotlight
- [x] Spieler können beitreten und Antworten senden
- [x] Punktesystem funktioniert korrekt (inkl. Boni/Strafen)
- [x] Leaderboard aktualisiert sich in Echtzeit
- [x] QR-Code funktioniert für Spieler-Beitritt

### Performance
- [x] Spotlight Latency <50ms
- [x] Leaderboard Update <100ms
- [x] Player Join <200ms
- [x] 150 Concurrent Players funktionieren

### Code Quality
- [x] Alle Tests grün (`npm test`)
- [x] Keine `console.log()` (nur `logger`)
- [x] Keine TODOs im Code
- [x] JSDoc-Kommentare für Public APIs

### Documentation
- [x] README.md aktualisiert
- [x] API_CONTRACT.md befolgt
- [x] Deployment-Guide geschrieben

---

## 🚀 Next Steps (Post v3.0)

**Future Enhancements (v3.1+):**
- Drag & Drop für Bild-Upload (nicht nur File-Input)
- Admin-Dashboard mit Statistiken
- Replay-Funktion (vergangene Spiele ansehen)
- Alternative Spielmodi (Buzzer-Mode, Team-Mode)

---

**Start Implementierung:** Phase 1, Task 1.1 - Project Setup

**Referenz:** [COPILOT_INSTRUCTIONS.md](./COPILOT_INSTRUCTIONS.md) für Best Practices während Implementierung.
