# COPILOT_INSTRUCTIONS - LichtBlick v3.0

**Zweck:** 🤖 KI-Assistenten Leitfaden für Clean-Slate Rewrite  
**Target:** GitHub Copilot / Cursor AI / Claude  
**Status:** Production Ready  
**Datum:** 27. November 2025

---

## 📋 Projekt-Kontext

LichtBlick ist ein Multiplayer-Ratespiel für kirchliche Veranstaltungen mit 80-150 Teilnehmern. Diese Anleitung gilt für den **Clean-Slate Rewrite (v3.0)** mit Node.js + WebSockets + SQLite.

**Wichtig:** Alle Dokumente in diesem `/docs` Ordner sind die **Single Source of Truth**.

---

## 🎯 Kernprinzipien

### 1. **Contract-First Development**
- API_CONTRACT.md ist fix → Frontend/Backend unabhängig entwickelbar
- Jede Änderung am Contract muss dokumentiert werden
- TypeScript Interfaces als Referenz (auch wenn wir JavaScript nutzen)

### 2. **Event-Driven Architecture**
- ❌ **KEINE** Polling-Intervalle (`setInterval` verboten!)
- ✅ **JA** WebSocket-Events (Push-basiert)
- ✅ **JA** Database-Triggers (für Aggregationen)

### 3. **Keep Frontend UI**
- HTML/CSS/Canvas-Code bleibt **unverändert**
- Nur JavaScript-Kommunikation wird ersetzt (fetch → socket.emit)
- Bestehende Funktionen wiederverwenden (z.B. `loadImage()`)

### 4. **Offline-First**
- Keine Cloud-Dependencies
- SQLite statt Remote-Database
- Self-contained Node.js Server

---

## 📝 Naming Conventions

**Konsequent durch gesamte Codebase.**

> 💡 **Vollständige Naming-Tabelle:** Siehe [README.md § Namenskonventionen](./README.md#-namenskonventionen)

**Quick Reference - Die wichtigsten:**
- **WebSocket Events**: `role:snake_case_action` → `admin:set_image`
- **Database**: `snake_case` → `players`, `correct_answer`
- **JavaScript**: `camelCase` → `loadCurrentImage()`
- **CSS/HTML**: `kebab-case` → `.pin-overlay`, `#qr-modal`

---

## 🏗️ Code-Struktur Best Practices

### Backend (Node.js)

#### 1. Route-Handler (Express)

```javascript
// ✅ GOOD: Async/Await + Error Handling
router.get('/api/health', async (req, res) => {
  try {
    const stats = await getServerStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({ success: false, message: 'Internal Error' });
  }
});

// ❌ BAD: Keine Error Handling
router.get('/api/health', async (req, res) => {
  const stats = await getServerStats(); // kann crashen!
  res.json(stats);
});
```

---

#### 2. Socket Event Handler

```javascript
// ✅ GOOD: Validation + Error Callback
socket.on('player:submit_answer', async (data, callback) => {
  try {
    // 1. Validate Input
    if (!validateAnswer(data)) {
      return callback({ success: false, message: 'Invalid input' });
    }
    
    // 2. Business Logic
    const result = await processAnswer(data);
    
    // 3. Broadcast (if needed)
    io.emit('game:leaderboard_update', result.leaderboard);
    
    // 4. Return Success
    callback({ success: true, data: result });
  } catch (error) {
    logger.error('Answer submission failed', { error, data });
    callback({ success: false, message: 'Internal error' });
  }
});

// ❌ BAD: Kein Callback, keine Validation
socket.on('player:submit_answer', async (data) => {
  const result = await processAnswer(data);
  io.emit('update', result); // Unklarer Event-Name!
});
```

---

#### 3. Database-Queries

```javascript
// ✅ GOOD: Prepared Statements + Error Handling
function getPlayer(playerId) {
  try {
    const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
    const player = stmt.get(playerId);
    return player || null;
  } catch (error) {
    logger.error('Failed to get player', { error, playerId });
    throw new Error('Database query failed');
  }
}

// ❌ BAD: String Concatenation (SQL Injection!)
function getPlayer(playerId) {
  const sql = `SELECT * FROM players WHERE id = ${playerId}`;
  return db.exec(sql);
}
```

---

### Frontend (Vanilla JS)

#### 1. WebSocket Event Listener

```javascript
// ✅ GOOD: Single Listener pro Event
socket.on('beamer:image_changed', ({ imageId, imageUrl }) => {
  logger.log('Image changed', { imageId });
  loadImage(imageUrl);
});

// ❌ BAD: Mehrfache Listener (Memory Leak!)
function setupListeners() {
  socket.on('beamer:image_changed', loadImage);
  socket.on('beamer:image_changed', updateUI); // Listener stacked!
}
```

---

#### 2. WebSocket emit mit Callback

```javascript
// ✅ GOOD: Callback für Response
function submitAnswer(answer) {
  socket.emit('player:submit_answer', { imageId, answer }, (response) => {
    if (response.success) {
      showSuccess(response.data);
    } else {
      showError(response.message);
    }
  });
}

// ❌ BAD: Keine Response-Handling
function submitAnswer(answer) {
  socket.emit('player:submit_answer', { imageId, answer });
  // Woher weiß ich, ob es funktioniert hat?
}
```

---

#### 3. Canvas Rendering

```javascript
// ✅ GOOD: Korrekter Rendering-Pipeline
function renderSpotlight(x, y, radius) {
  // 1. Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2. Black Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 3. Draw Image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  // 4. Apply Spotlight Mask
  ctx.globalCompositeOperation = 'destination-in';
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 5. Reset Composite Operation
  ctx.globalCompositeOperation = 'source-over';
}

// ❌ BAD: Falscher Composite-Mode (überschreibt alles)
function renderSpotlight(x, y, radius) {
  ctx.fillStyle = '#fff';
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill(); // Spotlight wird weiß statt transparent!
}
```

---

## 🐛 Debugging Workflows

### 1. WebSocket-Debugging

```javascript
// Development: Enable verbose logging
if (process.env.NODE_ENV === 'development') {
  io.on('connection', (socket) => {
    socket.onAny((event, ...args) => {
      logger.debug('Socket Event', { event, args });
    });
  });
}

// Frontend: Chrome DevTools → Network → WS
// Filter für "socket.io" → Messages Tab
```

### 2. Database-Debugging

```javascript
// Enable query logging
db.prepare = new Proxy(db.prepare, {
  apply(target, thisArg, args) {
    logger.debug('SQL Query', { sql: args[0] });
    return Reflect.apply(target, thisArg, args);
  }
});
```

### 3. Performance-Profiling

```bash
# Node.js built-in profiler
node --prof server/index.js

# Analyze
node --prof-process isolate-*.log > processed.txt
```

---

## ⚠️ Common Pitfalls

### 1. Race Conditions

**Problem:** Concurrent DB-Writes ohne Transaction

```javascript
// ❌ BAD: Race Condition
async function incrementScore(playerId, points) {
  const player = db.prepare('SELECT score FROM players WHERE id = ?').get(playerId);
  const newScore = player.score + points;
  db.prepare('UPDATE players SET score = ? WHERE id = ?').run(newScore, playerId);
  // Problem: Zwischen SELECT und UPDATE kann anderer Request laufen!
}

// ✅ GOOD: Atomic Update
function incrementScore(playerId, points) {
  db.prepare('UPDATE players SET score = score + ? WHERE id = ?').run(points, playerId);
}
```

---

### 2. Memory Leaks

**Problem:** Event Listener nicht entfernt

```javascript
// ❌ BAD: Listener häuft sich an
function setupUI() {
  socket.on('game:leaderboard_update', updateLeaderboard);
  socket.on('game:leaderboard_update', logLeaderboard); // Zweiter Listener!
}

// ✅ GOOD: Cleanup
function setupUI() {
  socket.off('game:leaderboard_update'); // Remove old listeners
  socket.on('game:leaderboard_update', updateLeaderboard);
}
```

---

### 3. Blocking the Event Loop

**Problem:** Synchrones File-I/O blockiert Server

```javascript
// ❌ BAD: Blockiert Event Loop
const file = fs.readFileSync('large-file.jpg'); // STOP!

// ✅ GOOD: Async
const file = await fs.promises.readFile('large-file.jpg');
```

---

### 4. Graceful Shutdown

**Problem:** `server.close()` wartet auf offene Verbindungen - Socket.IO hält diese offen!

```javascript
// ❌ BAD: Hängt wenn WebSocket-Clients verbunden sind
process.on('SIGINT', () => {
  server.close(() => process.exit(0)); // HÄNGT FOREVER!
});

// ✅ GOOD: Socket.IO zuerst schließen + Force-Timeout
const shutdown = (signal) => {
  logger.info(`${signal} received, closing...`);
  
  const forceExit = setTimeout(() => process.exit(1), 3000);
  
  io.close(() => {
    server.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

---

### 5. Contract Consistency (Event-Namen & Schema)

**Problem:** Server-Handler ↔ Client-Event oder Code ↔ DB-Schema stimmen nicht überein.

```javascript
// ❌ BAD: Event-Namen unterschiedlich
// Server: socket.on('admin:reset_game', ...)
// Client: socket.emit('admin:reset_game_soft', ...)  // → Handler nie aufgerufen!

// ✅ GOOD: Exakt identische Event-Namen (wie in API_CONTRACT.md)
// Server: socket.on('admin:reset_game_soft', ...)
// Client: socket.emit('admin:reset_game_soft', ...)
```

```javascript
// ❌ BAD: Code nutzt Spalte die nicht existiert
db.prepare('UPDATE games SET updated_at = ?').run(now);
// → Error: "no such column: updated_at"

// ✅ GOOD: Schema prüfen mit PRAGMA
// $ sqlite3 data/lichtblick.db "PRAGMA table_info(games)"
db.prepare('UPDATE games SET started_at = ?').run(now);
```

**Tipp:** `grep -r "socket.on\|socket.emit"` um Event-Namen zu vergleichen.

---

### 6. Defensive Input Validation

**Problem:** Client kann `null`/`undefined` für IDs senden → DB Constraint Errors.

```javascript
// ❌ BAD: Nur Content validieren
socket.on('player:lock_answer', ({ imageId, answer }, callback) => {
  if (!validateAnswer(answer)) return callback({ error: 'Invalid' });
  // imageId kann NULL sein → "NOT NULL constraint failed"!
  db.prepare('INSERT INTO answers (image_id, ...) VALUES (?, ...)').run(imageId);
});

// ✅ GOOD: Auch IDs validieren
socket.on('player:lock_answer', ({ imageId, answer }, callback) => {
  if (!socket.playerId) return callback({ error: 'Not logged in' });
  if (!imageId) return callback({ error: 'No image selected' });
  if (!validateAnswer(answer)) return callback({ error: 'Invalid answer' });
  // Jetzt sicher
});
```

---

### 7. Kategorisiertes Logging

**Problem:** `logger.info()` überall macht Logs schwer filterbar.

```javascript
// ❌ BAD: Generisches Logging
logger.info('Something happened', { data });

// ✅ GOOD: Kategorien für grep-Filterung
logger.game('Player scored', { playerId, points });    // [GAME]
logger.socket('Client connected', { socketId });       // [SOCKET]
logger.db('Query executed', { table });                // [DB]

// Log-Format: [TIME] [LEVEL] [CATEGORY] message {json}
// Filtern: grep "\[GAME\]" combined.log
```

---

## ✅ Testing Checkliste

### Pre-Commit Checklist

- [ ] Keine `console.log()` (nutze `logger.debug()`)
- [ ] Keine `setInterval()` (nutze WebSocket-Events)
- [ ] Alle Promises haben `.catch()` oder `try/catch`
- [ ] Alle Socket Events haben Error-Handling
- [ ] SQL-Queries nutzen Prepared Statements
- [ ] Namenskonventionen korrekt (siehe Tabelle oben)
- [ ] JSDoc-Kommentare für Public Functions

### Pre-Deployment Checklist

- [ ] `npm audit` zeigt keine kritischen Vulnerabilities
- [ ] Alle Tests laufen durch (`npm test`)
- [ ] Load-Test mit 150 Clients erfolgreich
- [ ] Memory-Leak-Test (4h Runtime) erfolgreich
- [ ] Multi-Device-Test (Admin + Beamer + 3 Player)
- [ ] Database-Backup erstellt
- [ ] `.env` Datei konfiguriert (Production-Werte)

---

## 📚 Wichtige Dokumenten-Referenzen

> 💡 **Vollständige Übersicht:** Siehe [README.md § Dokumentenstruktur](./README.md#-dokumentenstruktur) für detaillierte Beschreibungen aller Dokumente.

**Pflichtlektüre vor dem Coding:**

1. **[API_CONTRACT.md](./API_CONTRACT.md)** → Alle REST/WebSocket Schnittstellen
2. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** → DB-Struktur, Queries, Indexes
3. **[GAME_MECHANICS.md](./GAME_MECHANICS.md)** → Business-Logik, Punktesystem, State Machine

**Bei Bugs:**

1. Logs: `logs/combined.log`, `logs/error.log`
2. Chrome DevTools: Console + Network Tab (WS)
3. Database: `sqlite3 data/lichtblick.db`

---

## 🚀 Getting Started (für KI-Agent)

### 1. Lies die Dokumentation

> 💡 **Lesereihenfolge:** Siehe [README.md § Schnellstart für KI-Agenten](./README.md#-schnellstart-für-ki-agenten)

**Absolute Pflicht:**
- [README.md](./README.md) - Start hier für Übersicht
- [API_CONTRACT.md](./API_CONTRACT.md) - **Wichtigste Referenz für Implementierung**

### 2. Setup Development Environment

```bash
# 1. Node.js 20+ installieren
# https://nodejs.org

# 2. Dependencies installieren
cd server
npm install

# 3. Database initialisieren
node db/database.js

# 4. Server starten
npm run dev

# 5. Frontend öffnen
# http://localhost:3000/admin.html
```

### 3. Implementierungs-Reihenfolge

> 💡 **Detaillierter Plan:** Siehe [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) für vollständige Task-Liste mit Zeitschätzungen.

**Kurzfassung:** Backend Core → Event Handlers → Frontend Adapter → Testing (9-11 Tage)

---

## 💡 KI-Agent Best Practices

### Wenn du Code schreibst:

1. **Lies API_CONTRACT.md zuerst** → Kenne die exakten Schnittstellen
2. **Nutze Prepared Statements** → Keine SQL-Injection
3. **Validiere alle Inputs** → Nutze `server/utils/validation.js`
4. **Logge Errors** → Nutze Winston Logger, nicht `console.log`
5. **Schreibe Tests** → Jest für Unit-Tests

### Wenn du stuck bist:

1. **Prüfe Logs:** `tail -f logs/combined.log`
2. **Prüfe Database:** `sqlite3 data/lichtblick.db "SELECT * FROM ..."`
3. **Prüfe WebSocket:** Chrome DevTools → Network → WS
4. **Referenziere USE_CASES.md** → Siehe realistische Szenarien

---

## 🎯 Erfolgs-Kriterien

Dein Code ist **production-ready** wenn:

- ✅ Alle Tests grün (`npm test`)
- ✅ Keine Memory-Leaks (4h Runtime-Test)
- ✅ 150 Concurrent Clients funktionieren
- ✅ Spotlight Latency <50ms
- ✅ Leaderboard Update <100ms
- ✅ Keine `console.log()` (nur `logger`)
- ✅ Alle TODOs entfernt

---

**Viel Erfolg beim Implementieren! 🚀**

**Bei Fragen:** Referenziere die relevanten Docs oben.
