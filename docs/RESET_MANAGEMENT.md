# RESET MANAGEMENT - LichtBlick v3.0

**Status:** ✅ **IMPLEMENTIERT**  
**Version:** 3.0.0  
**Datum:** 8. Dezember 2025  
**Autor:** System-Analyse & Implementierung

---

## 📋 Übersicht

Dieses Dokument beschreibt die Reset-Funktionen von LichtBlick und dokumentiert deren Verhalten und Implementierung.

---

## 🔄 Die 5 Reset-Funktionen

### 0. Spiel neu starten 🔁 (NEU)

**Zweck:** Gleiche Veranstaltung wiederholen mit flexiblen Optionen

**Wann sichtbar:** Nur wenn `phase === 'ended'`

**Dialog-Optionen:**
- ☐ **Spieler disconnecten?**
  - Ja: Spieler werden gekickt, müssen neu joinen
  - Nein: Spieler bleiben eingeloggt (Score wird auf 0 gesetzt)
- ☐ **Gespielte Bilder entfernen?**
  - Ja: Nur ungespielte Bilder bleiben im game_images
  - Nein: Alle Bilder bleiben, is_played → 0

**Was wird gelöscht:**
- ❌ Game status → `'lobby'`
- ❌ Spieler-Scores → `0`
- ❌ Alle Antworten (answers-Tabelle)
- ❌ Image-States (reveal_count, started_at, ended_at)
- ❌ **Optional:** Spieler (wenn Checkbox aktiviert)
- ❌ **Optional:** Gespielte Bilder aus game_images (wenn Checkbox aktiviert)

**Was bleibt erhalten:**
- ✅ Bild-Pool (images)
- ✅ Einstellungen (config)
- ✅ **Optional:** Spieler (wenn Checkbox deaktiviert)
- ✅ **Optional:** Alle game_images mit is_played → 0 (wenn Checkbox deaktiviert)

**Bestätigung:** Custom Modal mit 2 Checkboxen

**Client-Verhalten:**
```javascript
// Server → Clients
if (disconnectPlayers) {
  io.to('players').emit('player:force_disconnect', { 
    message: 'Neue Runde startet. Bitte neu einloggen.' 
  });
} else {
  io.to('players').emit('player:game_reset', { 
    type: 'restart', 
    message: 'Neue Runde! Dein Score wurde zurückgesetzt.' 
  });
}
io.to('beamer').emit('beamer:game_reset', { type: 'restart' });
```

**Use-Cases:**
1. **Gemeindefest (mehrere Runden, 10min Pause):**
   - ✅ Spieler disconnecten (neue Gruppe)
   - ✅ Gespielte Bilder entfernen (nur neue Bilder zeigen)
   - → Jede Gruppe sieht frische Bilder

2. **Proben (mehrfach wiederholen):**
   - ❌ Spieler NICHT disconnecten (bleiben eingeloggt)
   - ❌ Bilder NICHT entfernen (alle wieder spielbar)
   - → Schneller Neustart ohne Neu-Login

3. **Zweite Veranstaltung am selben Tag:**
   - ✅ Spieler disconnecten (neue Leute)
   - ❌ Bilder NICHT entfernen (gleiches Spiel nochmal)
   - → Exakt gleicher Ablauf

**Server-Event:**
```javascript
socket.on('admin:restart_game', ({ disconnectPlayers, removePlayedImages }, callback) => {
  // 1. Soft Reset Basis-Logik
  db.db.transaction(() => {
    // Game status → lobby
    db.db.prepare('UPDATE games SET status = ?, started_at = NULL, ended_at = NULL WHERE id = ?')
      .run('lobby', game.id);
    
    // Reset scores
    db.db.prepare('UPDATE players SET score = 0 WHERE game_id = ?').run(game.id);
    
    // Clear answers & states
    db.db.prepare('DELETE FROM answers WHERE player_id IN (SELECT id FROM players WHERE game_id = ?)').run(game.id);
    db.db.prepare('DELETE FROM image_states WHERE game_id = ?').run(game.id);
    
    // 2. Optional: Spieler disconnecten
    if (disconnectPlayers) {
      db.db.prepare('DELETE FROM players WHERE game_id = ?').run(game.id);
    }
    
    // 3. Optional: Gespielte Bilder entfernen
    if (removePlayedImages) {
      db.db.prepare('DELETE FROM game_images WHERE game_id = ? AND is_played = 1').run(game.id);
    } else {
      // Alle Bilder wieder spielbar machen
      db.db.prepare('UPDATE game_images SET is_played = 0 WHERE game_id = ?').run(game.id);
    }
  })();
  
  // Broadcast
  if (disconnectPlayers) {
    io.to('players').emit('player:force_disconnect', { ... });
  } else {
    io.to('players').emit('player:game_reset', { type: 'restart', ... });
  }
  io.to('beamer').emit('beamer:game_reset', { type: 'restart' });
  
  callback({ success: true });
});
```

**Button-Position:** Footer, erscheint nur bei `phase === 'ended'`, ersetzt dann "START" und "AUFDECKEN"

**Button-Design:**
```html
<button class="btn-game btn-restart" id="btn-restart-game" style="display: none;">
  🔁 SPIEL NEU STARTEN
</button>
```

**JavaScript:**
```javascript
function updateGameControlButtons() {
  // ... existing logic ...
  
  if (state.phase === 'ended') {
    dom.btnStartGame.style.display = 'none';
    dom.btnReveal.style.display = 'none';
    dom.btnNextImage.style.display = 'none';
    dom.btnEndGame.style.display = 'none';
    dom.btnRestartGame.style.display = 'block'; // NEU
  } else {
    dom.btnRestartGame.style.display = 'none';
    // ... existing logic ...
  }
}
```

**Modal HTML:**
```html
<div class="modal-backdrop hidden" id="restart-game-modal">
  <div class="modal">
    <div class="modal-header">
      <h2>🔁 Spiel neu starten</h2>
      <button class="modal-close" data-close-modal="restart-game-modal">✕</button>
    </div>
    <div class="modal-body">
      <p>Spiel wird zurückgesetzt und ist wieder spielbar.</p>
      
      <label class="checkbox-label">
        <input type="checkbox" id="restart-disconnect-players">
        <span>Spieler disconnecten</span>
        <small class="checkbox-hint">Spieler müssen sich neu anmelden (für Gemeindefest)</small>
      </label>
      
      <label class="checkbox-label">
        <input type="checkbox" id="restart-remove-played">
        <span>Gespielte Bilder entfernen</span>
        <small class="checkbox-hint">Nur ungespielte Bilder bleiben im Spiel</small>
      </label>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-close-modal="restart-game-modal">Abbrechen</button>
      <button class="btn btn-primary" id="confirm-restart-game">Neu starten</button>
    </div>
  </div>
</div>
```

---

### 2. Soft Reset 🔄

**Zweck:** Spiel mit denselben Spielern und Bildern neu starten (Legacy, wird durch "Spiel neu starten" ersetzt)

**⚠️ DEPRECATED:** Nutze stattdessen "Spiel neu starten" mit beiden Checkboxen deaktiviert

**Was wird gelöscht:**
- ❌ Game status → `'lobby'`
- ❌ Spieler-Scores → `0` (Spieler bleiben eingeloggt!)
- ❌ Alle Antworten (answers-Tabelle)
- ❌ Image-States (reveal_count, started_at, ended_at)
- ❌ is_played-Flags (Bilder wieder spielbar)

**Was bleibt erhalten:**
- ✅ Spieler (players) - bleiben verbunden
- ✅ Bilder im Spiel (game_images)
- ✅ Bild-Pool (images)
- ✅ Einstellungen (config)

**Bestätigung:** Einfacher JavaScript `confirm()`

**Client-Verhalten:**
```javascript
// Server → Clients
io.to('beamer').emit('beamer:game_reset', { type: 'soft' });
io.to('players').emit('player:game_reset', { 
  type: 'soft', 
  message: 'Das Spiel wurde zurückgesetzt.' 
});
```

**Use-Case:** 
- Probedurchlauf vor echter Veranstaltung
- Fehler beim Moderieren, nochmal von vorne starten

---

### 3. Complete Reset 🧹

**Zweck:** Nächste Veranstaltung vorbereiten, andere Bilder nutzen

**Was wird gelöscht:** *Alles von Soft Reset +*
- ❌ Alle Spieler (players) - werden gekickt
- ❌ Alle Bilder aus Spiel (game_images gelöscht)
- ❌ Optional: Start/End-Bild-Flags (`includeStartEnd`-Option)

**Was bleibt erhalten:**
- ✅ Bild-Pool (images, Dateien bleiben)
- ✅ Einstellungen (config)

**Bestätigung:** Einfacher JavaScript `confirm()`

**Client-Verhalten:**
```javascript
// Server → Clients
io.to('players').emit('player:force_disconnect', { 
  message: 'Das Spiel wurde komplett zurückgesetzt. Bitte neu einloggen.' 
});
io.to('beamer').emit('beamer:game_reset', { type: 'hard' });
```

**Use-Case:**
- Neue Veranstaltung (z.B. Ostern statt Weihnachten)
- Admin will frisches Spiel mit neuen Bildern zusammenstellen

---

### 4. Server Restart 🔄

**Zweck:** Memory leaks beheben, Config-Änderungen laden

**Was passiert:**
```javascript
// Graceful Shutdown
io.close(() => {
  process.exit(1);  // nodemon --exitcrash startet neu
});

// Timeout: 3 Sekunden, dann Force-Exit
setTimeout(() => {
  process.exit(1);
}, 3000);
```

**Was wird gelöscht:**
- ❌ Socket.IO-Verbindungen
- ❌ In-Memory Cache

**Was bleibt erhalten:**
- ✅ Komplette Datenbank
- ✅ Alle hochgeladenen Dateien
- ✅ Admin-Token (wird NUR bei fehlendem Token neu generiert)

**Bestätigung:** Einfacher JavaScript `confirm()`

**Client-Verhalten:**
```javascript
io.emit('server:restarting', { message: 'Server wird neu gestartet...' });
// Auto-Reconnect nach 500ms Delay
```

**Use-Case:**
- Server läuft instabil (Memory-Leak)
- Config-Änderungen aktivieren

---

### 5. Factory Reset ☢️

**Zweck:** System komplett auf Werkseinstellungen zurücksetzen

**Was wird gelöscht:**
- ❌ **ALLE Tabellen** (answers, image_states, players, game_images, games, images, config)
- ❌ SQLite auto-increment counters zurückgesetzt
- ❌ **ALLE Dateien** in `data/uploads/` gelöscht
- ✅ Default-Config wiederhergestellt:
  - adminPin: `"1234"`
  - qrVisible: `false`
  - darkMode: `false`
  - wordList: Beispiel-Wörter
  - scoring: Default-Punktesystem
  - spotlight: Default-Einstellungen
- ✅ Frisches Lobby-Game erstellt (id=1)

**Was bleibt erhalten:**
- ⚠️ **Admin-Token** (wird NUR bei Server-Neustart neu generiert!)

**Bestätigung:** 
- ✅ Checkbox "Ich weiß was ich tue"
- ✅ Text-Input: "LICHT AUS" tippen
- Button nur aktiv wenn beide erfüllt

**Client-Verhalten:**
```javascript
io.to('players').emit('player:force_disconnect', { 
  message: 'Werksreset durchgeführt. Bitte Seite neu laden.' 
});
io.to('beamer').emit('beamer:game_reset', { type: 'factory' });
```

**Use-Case:**
- System verkaufen/weitergeben
- Nach Testzyklus komplett aufräumen
- Kritischer Fehler in Datenbank

---

## 🔍 Analyse: Admin-Token Verhalten

### Aktuelles Verhalten

**Token-Generierung:**
```javascript
// server/index.js
function initializeAdminToken() {
  let adminToken = db.getConfig('adminToken');
  
  if (!adminToken) {
    // First run - generate new token
    adminToken = crypto.randomBytes(24).toString('base64url');
    db.setConfig('adminToken', adminToken);
  }
  
  return adminToken;
}

const ADMIN_TOKEN = initializeAdminToken();
```

**Token wird neu generiert wenn:**
- ✅ `config`-Tabelle leer (z.B. nach Factory Reset)
- ✅ Key `adminToken` fehlt in DB

**Token-Speicherung:**
1. **Datenbank:** `config.adminToken` (JSON-String)
2. **In-Memory:** `io.adminToken` und `app.get('adminToken')`
3. **KEINE .env-Datei!**

### Szenario: Factory Reset

**Schritt 1: Factory Reset ausführen**
```sql
-- Alle Tabellen geleert (inkl. config)
DELETE FROM config;

-- Default-Config wird wiederhergestellt
INSERT INTO config (key, value) VALUES
('adminPin', '"1234"'),
('qrVisible', 'false'),
...
-- ⚠️ ABER: adminToken FEHLT!
```

**Schritt 2: Admin-Token-Status**
```javascript
// In-Memory Token bleibt bestehen!
io.adminToken = 'abc123...'  // ← Alter Token noch im RAM
app.get('adminToken')        // ← Alter Token noch im Express

// DB hat KEINEN Token mehr!
db.getConfig('adminToken')   // → null
```

**Schritt 3: Admin versucht Zugriff**
```javascript
// Admin-Client prüft Token
socket.emit('admin:connect', { token: 'abc123...' });

// Server prüft
const validToken = io.adminToken;  // ← Alter Token aus RAM!
if (token !== validToken) {
  // FAIL! Alte URL funktioniert nicht mehr
}
```

### ✅ Korrektes Verhalten nach Factory Reset + Restart

**Schritt 1: Server startet neu**
```javascript
const ADMIN_TOKEN = initializeAdminToken();
// → Prüft DB: adminToken fehlt
// → Generiert NEUEN Token
// → Speichert in DB
// → Zeigt neuen Link in Konsole
```

**Ergebnis:**
- ✅ Neuer Admin-Link notwendig
- ✅ Alte Links ungültig
- ✅ Höhere Sicherheit

---

## 🎯 Geplante Verbesserungen

### A) Complete Reset: `includeStartEnd`-Option aktivieren

**Problem:** Option existiert im Code, wird aber nicht vom Client übergeben

**Aktueller Code:**
```javascript
// server/sockets/admin.js
socket.on('admin:reset_complete', (data, callback) => {
  const includeStartEnd = data?.includeStartEnd || false;
  // ...
  if (includeStartEnd) {
    db.db.prepare('UPDATE images SET is_start_image = 0, is_end_image = 0').run();
  }
```

**Client sendet:**
```javascript
// client/js/admin/main.js
window.socketAdapter?.emit('admin:reset_complete', {}, (response) => {
  // ⚠️ Leeres Objekt! includeStartEnd fehlt
```

**Lösung:** Checkbox im Settings-Modal hinzufügen

**Status:** ✅ **GEWÜNSCHT, ABER NICHT KRITISCH**
- Start/End-Bilder werden bei Factory Reset sowieso gelöscht
- Bei Complete Reset sinnvoll sie zu behalten (für nächste Veranstaltung)

---

### B) Factory Reset + Server Restart Kombination

**Problem:** Factory Reset löscht DB, aber Admin-Token bleibt im RAM

**Aktuelles Verhalten:**
```javascript
// Factory Reset Response
callback({ 
  success: true, 
  message: 'Factory Reset erfolgreich!\n\n⚠️ WICHTIG: Nach Server-Neustart wird ein NEUER Admin-Link generiert!'
});
// ⚠️ Diese Message ist IRREFÜHREND!
// Token wird nur neu generiert WENN Server neu startet
```

**Lösung:** Factory Reset sollte automatisch Server-Restart triggern

**Vorteile:**
- ✅ Clean State, Memory vollständig gelöscht
- ✅ Neuer Admin-Token wird automatisch generiert
- ✅ Konsistenter Zustand (DB leer = RAM leer)

**Implementierung:**
```javascript
socket.on('admin:factory_reset', (data, callback) => {
  // ... Factory Reset Logik ...
  
  callback({ 
    success: true, 
    message: 'Factory Reset erfolgreich!\n\nServer startet jetzt neu...'
  });
  
  // Restart nach 1 Sekunde (Zeit für Response)
  setTimeout(() => {
    logger.info('🔃 Auto-Restart nach Factory Reset...');
    io.close(() => process.exit(1));
  }, 1000);
});
```

**Status:** ✅ **GEWÜNSCHT UND EMPFOHLEN**

---

### C) Player State Validation nach Reset

**Problem:** Spieler erhalten nur `player:game_reset` Event, keine State-Validierung

**Aktuelles Verhalten:**
```javascript
// Server → Player
io.to('players').emit('player:game_reset', { 
  type: 'soft', 
  message: 'Das Spiel wurde zurückgesetzt.' 
});

// Player-Client
socket.on('player:game_reset', (data) => {
  // ⚠️ Kein Handler implementiert!
  // Spieler sehen keine Infobox
});
```

**Beamer-Vergleich:** Beamer hat State-Validierung
```javascript
// beamer.js validiert Phase bei jedem Event
function validatePhaseTransition(newPhase) {
  const valid = PHASE_TRANSITIONS[currentPhase]?.includes(newPhase);
  if (!valid) {
    logger.warn('Invalid phase transition', { from: currentPhase, to: newPhase });
  }
  return valid;
}
```

**Lösung: `isReset`-Flag im Game-State**

**Konzept:**
1. Bei Reset: `isReset = true` in DB setzen
2. Spieler laden Seite neu → `player:reconnect` oder `player:join`
3. Server sendet `player:initial_state` mit `isReset: true`
4. Spieler zeigen Infobox: "Das Spiel wurde zurückgesetzt"
5. Nach 30 Sekunden: `isReset = false` (damit neu verbundene Spieler keine alte Meldung sehen)

**Implementierung:**
```javascript
// Server: Reset Handler
socket.on('admin:reset_game_soft', (data, callback) => {
  // ... Reset-Logik ...
  
  // Set reset flag with expiry
  db.setConfig('gameResetAt', Date.now());
  db.setConfig('gameResetType', 'soft');
  
  // Broadcast
  io.to('players').emit('player:game_reset', { 
    type: 'soft', 
    message: 'Das Spiel wurde zurückgesetzt.',
    isReset: true
  });
  
  // Clear flag after 30 seconds
  setTimeout(() => {
    db.deleteConfig('gameResetAt');
    db.deleteConfig('gameResetType');
  }, 30000);
});

// Player: Initial State
socket.on('player:join', (data, callback) => {
  // ... Join-Logik ...
  
  const resetAt = db.getConfig('gameResetAt');
  const resetType = db.getConfig('gameResetType');
  const isRecentReset = resetAt && (Date.now() - resetAt < 30000);
  
  callback({
    success: true,
    data: {
      playerId,
      score,
      phase: game.status,
      isReset: isRecentReset,
      resetType: isRecentReset ? resetType : null
    }
  });
});

// Player-Client: Handler
socket.on('player:game_reset', (data) => {
  if (data.isReset) {
    showInfoModal(data.message || 'Spiel wurde zurückgesetzt');
  }
});

function handleReconnect(response) {
  if (response.data.isReset) {
    showInfoModal(`Spiel wurde zurückgesetzt (${response.data.resetType})`);
  }
}
```

**Wortliste:** Wird regelmäßig neu geladen
```javascript
// Player lädt Wortliste bei jedem neuen Bild
socket.on('game:phase_change', (data) => {
  if (data.phase === 'playing') {
    loadWordList(data.imageId);  // ✅ Lädt aktuelle Wortliste vom Server
  }
});
```

**Status:** ✅ **EMPFOHLEN** - Bessere UX für Spieler

---

### D) Complete Reset: Bilder-Verhalten

**Frage:** Sollte Complete Reset game_images behalten?

**Aktuelle Implementierung:**
```javascript
// Complete Reset löscht game_images
db.db.prepare('DELETE FROM game_images WHERE game_id = ?').run(game.id);
```

**Analyse:**
- ❌ Admin muss alle Bilder neu hinzufügen
- ❌ Reihenfolge geht verloren
- ❌ Antworten gehen verloren

**Alternative:** Soft Reset + Spieler kicken?
```javascript
// Complete Reset = Soft Reset + Spieler löschen
// → Bilder bleiben im Spiel
// → Nur is_played-Flags werden zurückgesetzt
```

**Entscheidung:** ❌ **NICHT GEWÜNSCHT**
- Complete Reset bereitet nächste Veranstaltung vor
- Neue Veranstaltung = andere Bilder (Ostern statt Weihnachten)
- Admin will frische Bildauswahl zusammenstellen

**Status:** ✅ **AKTUELLES VERHALTEN KORREKT**

---

## 🎮 Spiel Beenden: Bilder-Verhalten

### Aktuelles Verhalten

**Server: `admin:end_game`**
```javascript
socket.on('admin:end_game', (_data, callback) => {
  // Game status → 'ended'
  db.updateGameStatus(game.id, 'ended');
  
  // Broadcast
  io.to('players').emit('game:phase_change', { phase: 'ended' });
  io.to('beamer').emit('game:phase_change', { phase: 'ended' });
  
  // Final leaderboard
  const leaderboard = db.getLeaderboard(game.id, 10);
  io.emit('game:leaderboard_update', { ... });
});
```

**Client: `endGame()`**
```javascript
function endGame() {
  if (!confirm('Spiel wirklich beenden?')) return;
  
  window.socketAdapter?.emit('admin:end_game', {}, (response) => {
    if (response.success) {
      state.phase = 'ended';
      updateGameControlButtons();
      // ✅ Bilder bleiben im Strip
      // ✅ "Spiel neu starten" Button erscheint
    }
  });
}
```

**Admin UI: `handlePhaseChange`**
```javascript
function handlePhaseChange(data) {
  state.phase = data.phase;
  updateGameControlButtons();
  
  if (data.phase === 'ended') {
    // "Spiel neu starten" Button wird sichtbar
    dom.btnRestartGame.style.display = 'block';
  }
}
```

### ✅ NEUES Verhalten (gewünscht)

**"Spiel beenden" macht KEINE Änderungen an Bildern:**
- ✅ Alle Bilder bleiben im game_images
- ✅ is_played-Flags bleiben erhalten
- ✅ Game Strip zeigt alle Bilder mit ✓-Badges
- ✅ "Spiel neu starten" Button erscheint

**Admin kann dann entscheiden:**
- Option 1: "Spiel neu starten" → Flexible Optionen (siehe oben)
- Option 2: "Complete Reset" → Neue Veranstaltung vorbereiten
- Option 3: Nichts tun → Endergebnis bleibt sichtbar

**Vorteile:**
- ✅ Nicht-destruktiv (Admin kann Endergebnis dokumentieren)
- ✅ Flexibilität durch "Spiel neu starten"
- ✅ Klare Trennung: "Beenden" ≠ "Aufräumen"

---

## 📊 Vergleichstabelle (aktualisiert)

| Reset-Typ | Spieler | Bilder (game_images) | is_played | Bild-Pool | Config | Use-Case |
|-----------|---------|----------------------|-----------|-----------|--------|----------|
| **Spiel neu starten** | Optional kicken | Optional entfernen (nur gespielte) | → 0 | ✅ Bleibt | ✅ Bleibt | Gemeindefest/Proben |
| **Soft Reset** | Score → 0 | ✅ Bleiben | → 0 | ✅ Bleibt | ✅ Bleibt | *DEPRECATED* |
| **Complete Reset** | ❌ Gelöscht | ❌ Gelöscht | - | ✅ Bleibt | ✅ Bleibt | Neue Veranstaltung |
| **Server Restart** | Reconnect | ✅ Bleiben | ✅ Bleibt | ✅ Bleibt | ✅ Bleibt | Tech-Probleme |
| **Factory Reset** | ❌ Gelöscht | ❌ Gelöscht | - | ❌ Gelöscht | ❌ Reset | System verkaufen |

---

## 🎯 Decision Tree: Welcher Reset?

```
Spiel ist beendet (ended)
│
├─ Gleiche Bilder nochmal spielen?
│  ├─ JA → "Spiel neu starten"
│  │      ├─ Neue Spieler? → ✅ Disconnect
│  │      ├─ Nur neue Bilder zeigen? → ✅ Gespielte entfernen
│  │      └─ Proben? → ❌ Beide Checkboxen aus
│  │
│  └─ NEIN → Neue Veranstaltung?
│           └─ JA → "Complete Reset"
│
Technisches Problem?
└─ JA → "Server Restart"

System verkaufen/komplett neu?
└─ JA → "Factory Reset"
```

---

## 🛡️ Sicherheits-Features

### Aktuell implementiert

1. **Factory Reset:**
   - ✅ Checkbox "Ich weiß was ich tue"
   - ✅ Text-Input: "LICHT AUS" tippen
   - ✅ Button disabled bis beide erfüllt

2. **Admin-Only Events:**
   - ✅ Alle Reset-Events prüfen `socket.rooms.has('admin')`
   - ✅ Unautorisierte Zugriffe → Fehler-Response

3. **Logging:**
   - ✅ Alle Resets werden geloggt (`logger.game(..., 'warn')`)
   - ✅ Stats werden mitgeloggt (Anzahl gelöschter Einträge)

### Empfohlene Ergänzungen

1. **Bestätigungsdialoge verbessern:**
   ```javascript
   // Statt confirm() → Custom Modal mit Details
   function confirmReset(type, details) {
     showModal({
       title: `${type} durchführen?`,
       message: details,
       confirmText: 'Ja, ausführen',
       cancelText: 'Abbrechen',
       dangerous: true
     });
   }
   ```

2. **Reset-Lock während laufendem Spiel:**
   ```javascript
   socket.on('admin:reset_game_soft', (data, callback) => {
     const game = db.getActiveGame();
     if (game.status === 'playing') {
       // Warnung anzeigen
       callback({ 
         success: false, 
         message: 'Spiel läuft noch! Bitte erst beenden.',
         requiresConfirm: true
       });
       return;
     }
     // ... Reset durchführen
   });
   ```

3. **Auto-Backup vor Factory Reset:**
   ```javascript
   socket.on('admin:factory_reset', async (data, callback) => {
     // Backup erstellen
     await createBackup('factory-reset');
     
     // Factory Reset durchführen
     // ...
   });
   ```

---

## 🔄 Migration & Backward Compatibility

### Datenbank-Änderungen

**Keine Breaking Changes geplant!**

Alle Verbesserungen sind:
- ✅ Additiv (neue Flags, neue Config-Keys)
- ✅ Optional (alte Clients funktionieren weiter)
- ✅ Abwärtskompatibel

### Client-Updates

**Empfohlene Reihenfolge:**
1. Server-Update (neue Events verfügbar)
2. Admin-Client-Update (neue UI-Features)
3. Player-Client-Update (besseres Reset-Feedback)
4. Beamer bleibt unverändert (bereits robust)

---

## 📝 Testing-Checkliste

### Manuelle Tests

- [ ] Soft Reset: Spieler bleiben verbunden, Scores auf 0
- [ ] Complete Reset: Spieler werden gekickt, game_images leer
- [ ] Server Restart: Alle Clients reconnecten automatisch
- [ ] Factory Reset: Alles gelöscht, Default-Config wiederhergestellt
- [ ] Factory Reset + Restart: Neuer Admin-Token wird generiert
- [ ] Spiel Beenden: Strip ausgeblendet, Leaderboard sichtbar
- [ ] Player Reset-Feedback: Infobox wird angezeigt (bei Reconnect innerhalb 30s)

### Edge Cases

- [ ] Reset während Phase = 'playing'
- [ ] Reset ohne aktives Spiel (sollte fehlschlagen)
- [ ] Mehrere Admins drücken gleichzeitig Reset
- [ ] Factory Reset mit 1000+ Bildern in uploads/
- [ ] Server-Neustart schlägt fehl (Force-Exit nach 3s)

---

## 🚀 Prioritäten (aktualisiert)

| Prio | Feature | Aufwand | Impact | Status |
|------|---------|---------|--------|--------|
| **P0** | "Spiel neu starten" Button + Modal | 🟡 Medium | 🔴 High | ✅ Skizziert, bereit zur Implementierung |
| **P1** | Factory Reset → Auto-Restart | 🟢 Low | 🔴 High | ✅ Empfohlen |
| **P2** | Player Reset-Feedback (isReset-Flag) | 🟡 Medium | 🟡 Medium | ✅ Empfohlen |
| **P3** | Soft Reset → DEPRECATED markieren | 🟢 Low | 🟢 Low | ⚪ Optional (wird durch P0 ersetzt) |
| **P4** | includeStartEnd-Checkbox | 🟢 Low | 🟢 Low | ⚪ Optional |
| **P5** | Reset-Lock während Spiel läuft | 🟡 Medium | 🟢 Low | ⚪ Optional |
| **P6** | Auto-Backup vor Factory Reset | 🔴 High | 🟡 Medium | ⚪ Optional |

---

## 📝 Implementation Checklist für "Spiel neu starten"

### Frontend (client/admin-new.html)
- [ ] Button `btn-restart-game` im Footer hinzufügen (neben btn-end-game)
- [ ] Modal `restart-game-modal` mit 2 Checkboxen erstellen
- [ ] CSS-Styles für Modal und Button

### Frontend (client/js/admin/main.js)
- [ ] DOM-Referenz `dom.btnRestartGame` hinzufügen
- [ ] Event-Listener `dom.btnRestartGame.addEventListener('click', openRestartModal)`
- [ ] Funktion `openRestartModal()` implementieren
- [ ] Funktion `restartGame(disconnectPlayers, removePlayedImages)` implementieren
- [ ] `updateGameControlButtons()` anpassen: Button nur bei phase='ended' zeigen

### Backend (server/sockets/admin.js)
- [ ] Event-Handler `socket.on('admin:restart_game')` implementieren
- [ ] Transaction mit Optionen: disconnectPlayers, removePlayedImages
- [ ] Logging mit stats (ähnlich wie Soft Reset)
- [ ] Broadcasting an Clients (conditional je nach Option)

### Backend (Broadcasting)
- [ ] `beamer:game_reset` mit type='restart' senden
- [ ] `player:force_disconnect` wenn disconnectPlayers=true
- [ ] `player:game_reset` wenn disconnectPlayers=false

### Testing
- [ ] Test: Restart mit beiden Checkboxen aus (= Soft Reset)
- [ ] Test: Restart mit Disconnect = true, Remove = false
- [ ] Test: Restart mit Disconnect = false, Remove = true
- [ ] Test: Restart mit beiden Checkboxen an
- [ ] Test: Button erscheint nur bei phase='ended'
- [ ] Test: Nach Restart ist Strip korrekt (gespielte weg oder nicht)

---

**Ende der Dokumentation**
