# 📱 PLAYER - Systematische Analyse

**Datum:** 8. Dezember 2025  
**Status:** Analyse für Debugging & State-Validierung  
**Vorbild:** [BEAMER_ANALYSIS.md](./BEAMER_ANALYSIS.md)

---

## 📡 WebSocket Events (Eingehend)

### Player hört ab:

| Event | Quelle | Trigger | Payload |
|-------|--------|---------|---------|
| `game:lobby_update` | Server | Spieler joined/left | `{ players: [], totalPlayers }` |
| `game:phase_change` | Server (Admin triggered) | Phase wechselt | `{ phase: 'lobby'\|'playing'\|'ended', imageId? }` |
| `game:leaderboard_update` | Server | Nach Reveal | `{ topPlayers: [], yourRank?, totalPlayers? }` |
| `game:image_revealed` | Server (Admin Reveal) | Admin drückt Reveal | `{ correctAnswer, roundPoints? }` |
| `player:game_reset` | Server (Admin Reset) | Soft Reset | `{ message }` |
| `player:force_disconnect` | Server (Admin Reset) | Hard/Factory Reset | `{ message }` |

---

## 🚀 WebSocket Events (Ausgehend)

### Player sendet:

| Event | Trigger | Payload | Callback |
|-------|---------|---------|----------|
| `player:join` | Login-Form Submit | `{ name }` | `{ success, data: { playerId, score, gameStatus } }` |
| `player:reconnect` | SessionStorage vorhanden | `{ playerId }` | `{ success, data: { playerId, name, score, phase } }` |
| `player:lock_answer` | "Einloggen" Button | `{ imageId, answer, lockedAt }` | `{ success, data: { answer, lockedAt } }` |
| `player:submit_answer` | **LEGACY** (umgeleitet zu lock_answer) | `{ imageId, answer }` | - |
| `player:keep_alive` | Interval (30s) | - | - |
| `player:leave` | "Spiel verlassen" Button | `{ playerId }` | `{ success }` |

---

## 🧠 Player State (Client-seitig)

```javascript
// Globale Variablen in player.js
let playerId = null;              // DB Player ID (bei Join/Reconnect)
let playerName = null;            // Name des Spielers
let currentScore = 0;             // Aktueller Score (synchronisiert vom Server)
let selectedWord = null;          // Aktuell markiertes Wort in UI (gelb)
let lockedWord = null;            // Eingeloggtes Wort (grün)
let lockedAt = null;              // Timestamp des Einloggens
let currentImageId = null;        // Aktuelle Bild-ID (beim Phase-Wechsel gesetzt)
let keepAliveInterval = null;     // Interval für Keep-Alive
let currentWordList = [];         // Wortliste vom Server (dedupliziert)
```

### Session-Persistenz

```javascript
// Gespeichert in sessionStorage für Reconnect
sessionStorage.setItem('playerId', playerId);
sessionStorage.setItem('playerName', playerName);
```

---

## 🎬 Verhalten pro Game-State

### **LOGIN Screen** (Initial State)

#### Aktiver Screen:
```html
<div id="login-screen" class="screen active">
```

#### Anzeige-Logik:
- Logo: "🔦 LichtBlick"
- Input: Name (2-20 Zeichen)
- Button: "Beitreten"
- Connection Status: Grün/Rot Indikator

#### Event-Handler:
- ✅ `submit` auf Login-Form → `player:join` Event
- ✅ Bei Erfolg: Wechsel zu LOBBY Screen
- ❌ Bei Fehler: Error-Message einblenden

#### Session-Restore:
- Beim Page-Load: Prüfe `sessionStorage` für `playerId`
- Falls vorhanden: Automatisch `player:reconnect` aufrufen
- Bei Erfolg: Direkt zu LOBBY oder GAME Screen springen

#### Robustheit:
- ✅ Name-Validierung (2-20 Zeichen)
- ✅ Fehler-Handling bei Netzwerk-Problemen
- ✅ Connection-Status-Indikator

---

### **LOBBY Phase** (`currentPhase = 'lobby'`)

#### Aktiver Screen:
```html
<div id="lobby-screen" class="screen">
```

#### Anzeige-Logik:
- Header: "🎯 Warte auf Spielstart..."
- Spieler-Begrüßung: "Hallo **[Name]**!"
- Stat-Box: Spielerzahl (live-updated)
- Spinner-Animation: "Gleich geht's los!"
- Button: "Spiel verlassen" (oben rechts)

#### Event-Handler:
- ✅ `game:lobby_update` → Spielerzahl aktualisieren
  ```javascript
  document.getElementById('lobby-player-count').textContent = data.totalPlayers;
  ```
- ✅ `game:phase_change` → Wechsel zu PLAYING oder ENDED
  - `phase = 'playing'` → Zu GAME Screen, Wortliste laden
  - `phase = 'ended'` → Zu RESULT Screen
- ❌ Alle anderen Events → **Ignoriert** (kein Handler)

#### State-Reset bei Phase-Change:
```javascript
// Bei Wechsel zu PLAYING
selectedWord = null;
lockedWord = null;
lockedAt = null;
currentImageId = data.imageId;
```

#### Robustheit:
- ✅ Keep-Alive läuft (30s Interval)
- ✅ Spieler-Count live synchronisiert
- ❌ **FEHLT:** Phase-Check für Events (z.B. `game:image_revealed` sollte ignoriert werden)

---

### **PLAYING Phase** (`currentPhase = 'playing'`)

#### Aktiver Screen:
```html
<div id="game-screen" class="screen">
```

#### Anzeige-Logik:

**Header:**
- Links: Spielername
- Rechts: "Spiel verlassen" Button

**Score-Display:**
- "Deine Punkte: **[Score]**"
- Platzierung (falls in Top 10): "Platz **X**"

**Wortliste-Container:**
- Such-Input: "🔍 Suche..."
- Wort-Buttons: Scrollbar, Click → Select
- Zustände:
  - **Normal:** Weiß
  - **Selected:** Gelb (`.selected`)
  - **Locked:** Grün (`.locked`)

**Submit-Button (dynamisch):**
| Zustand | Text | Klasse | Enabled |
|---------|------|--------|---------|
| Kein Wort ausgewählt | "Wort auswählen" | `submit-btn` | ❌ |
| Wort selected, nicht locked | "Einloggen" | `submit-btn ready` | ✅ |
| Locked = Selected | "Eingeloggt ✓" | `submit-btn locked` | ❌ |
| Selected ≠ Locked | "Umentscheiden?" | `submit-btn change` | ✅ |

**Reveal-Result-Ansicht (nach Reveal):**
```html
<div id="reveal-result" class="reveal-result hidden">
  <div class="reveal-card correct-answer-card">
    Richtige Antwort: [STERN]
  </div>
  <div class="reveal-card your-answer-card [correct|wrong|no-answer]">
    Deine Antwort: [deine Antwort]
    Status: ✅ Richtig! / ❌ Leider falsch
  </div>
  <div class="reveal-card points-card">
    Punkte diese Runde: +90
  </div>
  <div class="reveal-waiting">
    Spinner: "Warte auf nächstes Bild..."
  </div>
</div>
```

#### Event-Handler:

##### `game:phase_change` (erneut, für nächstes Bild)
- **Payload:** `{ phase: 'playing', imageId: 2 }`
- **Aktion:**
  - State zurücksetzen
  - Wortliste-Container einblenden
  - Reveal-Result ausblenden
  - Wortliste neu laden (dedupliziert für `imageId`)
  - Such-Input leeren

##### `game:image_revealed` ⚠️ **KRITISCH**
- **Payload:** `{ correctAnswer, roundPoints? }`
- **Aktion:**
  1. **Bestimme gewertete Antwort:**
     - Priorität 1: `lockedWord` (eingeloggtes Wort)
     - Priorität 2: `selectedWord` (nur markiert, nicht eingeloggt)
     - Fallback: `null` (keine Antwort)
  2. **Spätes Einloggen:** Falls `selectedWord` aber kein `lockedWord`:
     ```javascript
     lockedWord = selectedWord;
     lockedAt = Date.now();
     sendLockToServer(selectedWord, lockedAt);
     ```
  3. **Prüfe Korrektheit:**
     ```javascript
     const isCorrect = yourAnswer?.toLowerCase() === correctAnswer.toLowerCase();
     ```
  4. **UI-Wechsel:**
     - Wortliste-Container ausblenden
     - Submit-Button ausblenden
     - Reveal-Result einblenden
  5. **Zeige Ergebnis:**
     - Richtige Antwort anzeigen
     - Deine Antwort anzeigen (mit ✅/❌ oder "Nicht beantwortet")
     - Rundenpunkte anzeigen (`+90` oder `0`)
  6. **State-Reset (für nächstes Bild):**
     ```javascript
     selectedWord = null;
     lockedWord = null;
     lockedAt = null;
     ```

##### `game:leaderboard_update`
- **Payload:** `{ topPlayers: [...] }`
- **Aktion:**
  - Finde eigenen Eintrag in `topPlayers`
  - Aktualisiere Platzierung: "Platz **X**"
  - Synchronisiere Score vom Server (Authority)
  - Aktualisiere Leaderboard-Overlay (falls sichtbar)

##### `player:game_reset` (Soft Reset)
- **Payload:** `{ message }`
- **Aktion:**
  - State zurücksetzen (Score = 0, Wörter löschen)
  - Zurück zu LOBBY Screen
  - Message anzeigen

##### `player:force_disconnect` (Hard/Factory Reset)
- **Payload:** `{ message }`
- **Aktion:**
  - SessionStorage clearen
  - Alle State-Variablen zurücksetzen
  - Keep-Alive stoppen
  - Zurück zu LOGIN Screen
  - Alert mit Message

#### User-Interaktionen:

##### **Wort-Suche:**
- Input-Event auf `#word-search`
- Filterung: Substring-Match (case-insensitive)
  - "as" findet: "Haus", "Maus" (aber nicht "Satz")
- Highlight: Matching-Teil wird fett hervorgehoben
- Keine Treffer: "Keine Treffer für '...'"

##### **Wort-Auswahl:**
- Click auf `.word-btn`
- Altes `selected` entfernen (nur ein Wort gleichzeitig)
- Neues Wort markieren (gelb)
- `selectedWord` setzen
- Submit-Button aktualisieren

##### **Einloggen (Lock-Answer):**
- Click auf "Einloggen" Button
- `lockedWord = selectedWord`
- `lockedAt = Date.now()`
- Button als `.locked` markieren (grün)
- An Server senden: `player:lock_answer`
- Feedback: "**[Wort]** eingeloggt!"

##### **Umentscheiden:**
- Click auf "Umentscheiden?" Button
- Bestätigungs-Dialog:
  ```
  Wirklich von "[old]" zu "[new]" wechseln?
  ⚠️ Geschwindigkeitsboni könnten verloren gehen!
  ```
- Bei Bestätigung:
  - Alte `locked`-Markierung entfernen
  - Neues Wort einloggen (überschreibt DB-Eintrag)
  - Feedback: "Antwort geändert zu **[Wort]**"

#### Robustheit:
- ✅ Wortliste wird vom Server geladen (dedupliziert)
- ✅ Lock-Answer hat Callback mit Fehler-Handling
- ✅ Spätes Einloggen bei Reveal (Fallback für vergessene Spieler)
- ⚠️ **FEHLT:** Phase-Check für `game:image_revealed` (könnte in falscher Phase kommen)
- ⚠️ **FEHLT:** Validierung, ob `imageId` in `player:lock_answer` korrekt ist

---

### **ENDED Phase** (`currentPhase = 'ended'`)

#### Aktiver Screen:
```html
<div id="result-screen" class="screen">
```

#### Anzeige-Logik:
- Header: "🏆 Spiel beendet!"
- Final Stats:
  - Stat-Box 1: Finaler Score
  - Stat-Box 2: Finale Platzierung
- Leaderboard: Top 10 (eigene Position hervorgehoben)
- Thank-You: "Vielen Dank fürs Mitspielen! 🎉"

#### Event-Handler:
- ✅ `game:leaderboard_update` → Finales Leaderboard aktualisieren
  - Zeigt Top 10 mit Medaillen (🥇🥈🥉)
  - Eigener Eintrag hervorgehoben (`.highlight`)

#### Robustheit:
- ✅ Score und Platzierung werden angezeigt
- ❌ **FEHLT:** Reset-Button für neue Runde
- ❌ **FEHLT:** Phase-Check (Events aus PLAYING sollten ignoriert werden)

---

## 🔄 Screen-Wechsel-Matrix

| Von Phase | Zu Phase | Event | Player-Aktion |
|-----------|----------|-------|---------------|
| `LOGIN` | `lobby` | `player:join` (callback success) | Show LOBBY, Spielername anzeigen |
| `LOGIN` | `lobby` / `game` | `player:reconnect` (callback success) | Show LOBBY/GAME basierend auf `phase` |
| `lobby` | `playing` | `game:phase_change` | Show GAME, Wortliste laden |
| `lobby` | `ended` | `game:phase_change` | Show RESULT |
| `playing` | `lobby` | `player:game_reset` | Show LOBBY, State reset |
| `playing` | `ended` | `game:phase_change` | Show RESULT, Score/Rank anzeigen |
| `playing` | `LOGIN` | `player:force_disconnect` | Show LOGIN, SessionStorage clear |
| `ended` | `lobby` | `player:game_reset` | Show LOBBY, State reset |
| `ended` | `LOGIN` | `player:force_disconnect` | Show LOGIN, SessionStorage clear |

---

## 🔒 State-basierte Validierung (GEPLANT)

**Status:** ⚠️ **FEHLT - MUSS IMPLEMENTIERT WERDEN**

Nach Vorbild von `BEAMER_ANALYSIS.md` benötigt der Player State-Validierung:

### Validierungs-Regeln:

| Phase | ✅ Erlaubte Events | 🚫 Blockierte Events |
|-------|-------------------|---------------------|
| **LOGIN** | - | Alle Game-Events |
| **LOBBY** | `game:lobby_update`<br>`game:phase_change`<br>`player:game_reset`<br>`player:force_disconnect` | `game:image_revealed`<br>`game:leaderboard_update`<br>`player:lock_answer` |
| **PLAYING** | `game:phase_change`<br>`game:image_revealed`<br>`game:leaderboard_update`<br>`player:lock_answer`<br>`player:game_reset`<br>`player:force_disconnect` | - |
| **ENDED** | `game:leaderboard_update`<br>`game:phase_change`<br>`player:game_reset`<br>`player:force_disconnect` | `game:image_revealed`<br>`player:lock_answer` |

### Implementation Plan:

```javascript
// player.js - State Validator (nach Beamer-Vorbild)

let currentPhase = 'login'; // 'login' | 'lobby' | 'playing' | 'ended'

function isEventAllowedInPhase(eventName) {
  const rules = {
    'login': {
      allowed: [],
      denied: ['game:lobby_update', 'game:phase_change', 'game:image_revealed', 'game:leaderboard_update']
    },
    'lobby': {
      allowed: ['game:lobby_update', 'game:phase_change', 'player:game_reset', 'player:force_disconnect'],
      denied: ['game:image_revealed', 'game:leaderboard_update']
    },
    'playing': {
      allowed: ['game:phase_change', 'game:image_revealed', 'game:leaderboard_update', 'player:game_reset', 'player:force_disconnect'],
      denied: []
    },
    'ended': {
      allowed: ['game:leaderboard_update', 'game:phase_change', 'player:game_reset', 'player:force_disconnect'],
      denied: ['game:image_revealed']
    }
  };
  
  const phaseRules = rules[currentPhase];
  if (!phaseRules) return true; // Failsafe
  
  // Check denied first (explicit blocks)
  if (phaseRules.denied.includes(eventName)) {
    console.warn(`🚫 Player: Event "${eventName}" blocked in phase "${currentPhase}"`);
    return false;
  }
  
  // If allowed list exists and event is not in it, block
  if (phaseRules.allowed.length > 0 && !phaseRules.allowed.includes(eventName)) {
    console.warn(`🚫 Player: Event "${eventName}" not allowed in phase "${currentPhase}"`);
    return false;
  }
  
  return true;
}

// Wrap alle Event-Handler
function handleLobbyUpdate(data) {
  if (!isEventAllowedInPhase('game:lobby_update')) return;
  // ... bestehende Logik
}

function handleImageRevealed(data) {
  if (!isEventAllowedInPhase('game:image_revealed')) return;
  // ... bestehende Logik
}

// usw. für alle Events
```

### Phase-Tracking:

```javascript
// Phase wird aktualisiert bei:
function handleLogin(e) {
  // ... nach erfolgreichem Join
  currentPhase = 'lobby';
  showScreen('lobby');
}

function handlePhaseChange(data) {
  if (data.phase === 'playing') {
    currentPhase = 'playing';
    showScreen('game');
  } else if (data.phase === 'ended') {
    currentPhase = 'ended';
    showScreen('result');
  } else if (data.phase === 'lobby') {
    currentPhase = 'lobby';
    showScreen('lobby');
  }
}

function handleForceDisconnect(data) {
  currentPhase = 'login';
  showScreen('login');
}
```

---

## 🐛 Identifizierte Probleme

### ❌ Problem 1: Fehlende State-Validierung
**Status:** 🚨 **KRITISCH**

Aktuell werden **alle** Socket-Events ohne Phase-Check verarbeitet:
- `game:image_revealed` könnte in LOBBY ankommen → undefined behavior
- `player:lock_answer` könnte ohne aktives Bild gesendet werden → DB-Fehler

**Lösung:** State-Validator wie im Beamer implementieren (siehe oben)

---

### ❌ Problem 2: Spätes Einloggen bei Reveal unsauber
**Status:** ⚠️ **DESIGN-FRAGE**

Aktuelles Verhalten in `handleImageRevealed()`:
```javascript
// Falls nur selectedWord (nicht eingeloggt), automatisch einloggen
if (!lockedWord && selectedWord) {
  lockedWord = selectedWord;
  lockedAt = Date.now();
  sendLockToServer(selectedWord, lockedAt);
}
```

**Probleme:**
- Spieler können "faul" sein und erst bei Reveal einloggen
- Geschwindigkeitsbonus wird falsch berechnet (zu später Timestamp)
- Nicht fair gegenüber Spielern die früh einloggen

**Mögliche Lösungen:**

**A) Kein spätes Einloggen zulassen:**
```javascript
// Nur gewertete Antworten sind locked answers
const yourAnswer = lockedWord; // selectedWord wird NICHT gewertet
```

**B) Spätes Einloggen mit Penalty:**
```javascript
if (!lockedWord && selectedWord) {
  // Setze Timestamp auf Reveal-Zeit (kein Speed-Bonus!)
  lockedAt = Date.now(); 
  sendLockToServer(selectedWord, lockedAt);
  // Server sieht dass lockedAt = revealTime und gibt 0 Speed-Bonus
}
```

**C) Client-seitige Warnung:**
```javascript
// Nach 80% der Zeit: Pulsierendes "Jetzt einloggen!" auf Button
if (timeElapsed > 0.8 * maxTime && selectedWord && !lockedWord) {
  showUrgentMessage("⚠️ Bitte jetzt einloggen!");
}
```

---

### ⚠️ Problem 3: Keine Validierung bei `player:lock_answer`
**Status:** ⚠️ **FEHLT**

Aktuell wird `player:lock_answer` ohne Client-seitige Checks gesendet:
```javascript
function lockAnswer(word) {
  lockedWord = word;
  sendLockToServer(word, lockedAt);
}
```

**Fehlende Checks:**
- Ist `currentImageId` gesetzt? (sonst undefiniert)
- Ist `currentPhase === 'playing'`? (sonst falscher State)
- Ist `word` in `currentWordList`? (Manipulation möglich)

**Lösung:**
```javascript
function lockAnswer(word) {
  // Phase-Check
  if (currentPhase !== 'playing') {
    console.warn('Cannot lock answer: not in playing phase');
    return;
  }
  
  // Image-Check
  if (!currentImageId) {
    console.warn('Cannot lock answer: no active image');
    return;
  }
  
  // Word-Check (optional, aber empfohlen)
  if (!currentWordList.includes(word)) {
    console.warn('Cannot lock answer: word not in list', word);
    return;
  }
  
  lockedWord = word;
  lockedAt = Date.now();
  sendLockToServer(word, lockedAt);
}
```

---

### ✅ Problem 4: Keep-Alive nur bei Connected
**Status:** ✅ **BEREITS KORREKT**

```javascript
keepAliveInterval = setInterval(() => {
  if (playerId && window.socketAdapter?.isConnected()) {
    window.socketAdapter.emit('player:keep_alive');
  }
}, 30000);
```

Gut: Keep-Alive wird nur gesendet wenn:
- `playerId` existiert (eingeloggt)
- Socket ist verbunden

---

### ⚠️ Problem 5: Leaderboard-Update überschreibt Score
**Status:** ⚠️ **POTENTIELLER BUG**

In `handleLeaderboardUpdate()`:
```javascript
if (myEntry.score !== undefined) {
  currentScore = myEntry.score;
  document.getElementById('player-score').textContent = currentScore;
}
```

**Risiko:**
- Leaderboard könnte "veralteten" Score haben (Race Condition)
- Server ist Authority, aber Client hat lokal bereits höheren Score

**Lösung:**
- Server sollte **immer** den aktuellsten Score im Leaderboard haben
- Client sollte Server-Score bedingungslos akzeptieren
- **Aktuelles Verhalten ist korrekt** (Server-Authority)

---

### ❌ Problem 6: Keine Behandlung von `game:lobby_update` in PLAYING/ENDED
**Status:** ⚠️ **MINOR**

Aktuell wird `game:lobby_update` **immer** verarbeitet:
```javascript
function handleLobbyUpdate(data) {
  const count = data.totalPlayers || data.players?.length || 0;
  document.getElementById('lobby-player-count').textContent = count;
}
```

**Problem:**
- In PLAYING/ENDED ist `#lobby-player-count` nicht sichtbar
- Event wird sinnlos verarbeitet (DOM-Update hat keine Wirkung)

**Lösung:**
- Phase-Check in `handleLobbyUpdate`:
  ```javascript
  function handleLobbyUpdate(data) {
    if (currentPhase !== 'lobby') return; // Ignoriere in anderen Phasen
    // ... Update UI
  }
  ```

---

## 🔧 Empfohlene Fixes

### ✅ Fix 1: State-Validator implementieren
**Priorität:** 🔴 **HOCH**

```javascript
// Kopiere Beamer-Logik 1:1
let currentPhase = 'login';

function isEventAllowedInPhase(eventName) {
  // ... (siehe oben)
}

// Wrap alle Event-Handler
socket.on('game:lobby_update', (data) => {
  if (!isEventAllowedInPhase('game:lobby_update')) return;
  handleLobbyUpdate(data);
});

socket.on('game:image_revealed', (data) => {
  if (!isEventAllowedInPhase('game:image_revealed')) return;
  handleImageRevealed(data);
});

// usw.
```

---

### ⚠️ Fix 2: Spätes Einloggen entfernen oder mit Penalty
**Priorität:** 🟡 **MITTEL** (Design-Entscheidung nötig)

**Empfehlung:** Kein automatisches Einloggen bei Reveal
```javascript
function handleImageRevealed(data) {
  const correctAnswer = data?.correctAnswer || '';
  
  // Nur lockedWord wird gewertet
  const yourAnswer = lockedWord; // selectedWord wird IGNORIERT
  
  // Falls kein lockedWord: "Nicht beantwortet"
  // ...
}
```

---

### ✅ Fix 3: Client-seitige Validierung bei Lock
**Priorität:** 🟡 **MITTEL**

```javascript
function lockAnswer(word) {
  // Validierungen
  if (currentPhase !== 'playing') {
    showFeedback('Aktion nur während Spielphase möglich', 'error');
    return;
  }
  if (!currentImageId) {
    showFeedback('Kein aktives Bild', 'error');
    return;
  }
  
  lockedWord = word;
  lockedAt = Date.now();
  sendLockToServer(word, lockedAt);
  updateSubmitButton();
  showFeedback(`"${word}" eingeloggt!`, 'info');
}
```

---

### ✅ Fix 4: Phase-Check in handleLobbyUpdate
**Priorität:** 🟢 **NIEDRIG** (Optimierung)

```javascript
function handleLobbyUpdate(data) {
  if (currentPhase !== 'lobby') return;
  const count = data.totalPlayers || data.players?.length || 0;
  document.getElementById('lobby-player-count').textContent = count;
}
```

---

## 📊 Event-Flow-Diagramm (Spieler-Perspektive)

### Typischer Spielablauf:

```
1. PAGE LOAD
   └─> Check sessionStorage
       ├─> playerId vorhanden → player:reconnect → Zu LOBBY/GAME
       └─> Nicht vorhanden → Zeige LOGIN Screen

2. SPIELER LOGGED EIN
   └─> player:join { name: "Max" }
   └─> Response: { playerId: 42, score: 0, gameStatus: 'lobby' }
   └─> Screen: LOGIN → LOBBY
   └─> Keep-Alive startet

3. LOBBY PHASE
   └─> game:lobby_update (alle 2 Sekunden)
       └─> "23 Spieler"
   └─> game:phase_change { phase: 'playing', imageId: 1 }
       └─> Screen: LOBBY → GAME
       └─> Lade Wortliste für Bild 1

4. SPIELPHASE - Bild 1
   a) Spieler sucht Wort: "Stern"
      └─> word-search Input-Event → Filter → Highlight
   
   b) Spieler klickt "Stern"
      └─> selectedWord = "Stern" (gelb)
      └─> Submit-Button: "Einloggen" (aktiv)
   
   c) Spieler klickt "Einloggen"
      └─> player:lock_answer { imageId: 1, answer: "Stern", lockedAt: 1702049234567 }
      └─> lockedWord = "Stern" (grün)
      └─> Submit-Button: "Eingeloggt ✓" (disabled)
      └─> Feedback: "Stern eingeloggt!"
   
   d) Admin drückt Reveal
      └─> game:image_revealed { correctAnswer: "Stern", roundPoints: 90 }
      └─> Prüfe: lockedWord === correctAnswer → RICHTIG ✅
      └─> UI-Wechsel: Wortliste → Reveal-Result
      └─> Zeige: "✅ Richtig! +90 Punkte"
   
   e) Server sendet Leaderboard
      └─> game:leaderboard_update { topPlayers: [...] }
      └─> Aktualisiere Score: 0 → 90
      └─> Aktualisiere Rank: "Platz 7"

5. SPIELPHASE - Bild 2
   └─> game:phase_change { phase: 'playing', imageId: 2 }
   └─> UI-Wechsel: Reveal-Result → Wortliste
   └─> State reset: selectedWord = null, lockedWord = null
   └─> Lade neue Wortliste
   └─> [Zyklus wiederholt sich 6x]

6. SPIEL ENDET
   └─> game:phase_change { phase: 'ended' }
   └─> Screen: GAME → RESULT
   └─> game:leaderboard_update { topPlayers: [...] }
   └─> Zeige finalen Score + Rang
   └─> "Vielen Dank fürs Mitspielen! 🎉"

7. ADMIN RESET (Soft)
   └─> player:game_reset { message: "Spiel zurückgesetzt" }
   └─> State reset: Score = 0, Wörter löschen
   └─> Screen: RESULT → LOBBY
   └─> Keep-Alive läuft weiter

8. ADMIN RESET (Hard/Factory)
   └─> player:force_disconnect { message: "Bitte neu einloggen" }
   └─> SessionStorage clear
   └─> Keep-Alive stoppen
   └─> Screen: [Any] → LOGIN
   └─> Alert mit Message
```

---

## ✅ Was funktioniert gut:

1. ✅ Session-Restore (Reconnect nach Reload)
2. ✅ Keep-Alive mit Connection-Check
3. ✅ Wort-Suche mit Highlighting
4. ✅ Lock-Answer mit Umentscheiden-Logik
5. ✅ Reveal-Ansicht mit Feedback
6. ✅ Leaderboard-Synchronisation (Server-Authority)
7. ✅ Screen-Wechsel zwischen Phasen
8. ✅ Soft/Hard Reset-Handler
9. ✅ Connection-Status-Indikator
10. ✅ Validierung bei Login (2-20 Zeichen)

---

## 🔍 Zu prüfen / implementieren:

- [ ] **State-Validator** nach Beamer-Vorbild implementieren (🔴 HOCH)
- [ ] **Spätes Einloggen**: Entfernen oder mit Penalty? (🟡 Design-Entscheidung)
- [ ] **Client-Validierung** bei `player:lock_answer` (🟡 MITTEL)
- [ ] **Phase-Check** in `handleLobbyUpdate` (🟢 Optimierung)
- [ ] **Testing:** Player in falscher Phase sendet Events (sollte blockiert werden)
- [ ] **Testing:** Reconnect bei verschiedenen Phasen (LOBBY, PLAYING, ENDED)
- [ ] **Testing:** Umentscheiden-Dialog + Geschwindigkeitsbonus
- [ ] **UI:** Dringendes "Jetzt einloggen!" nach X Sekunden? (🟢 Optional)
- [ ] **Leaderboard-Overlay:** Wann wird es angezeigt? (momentan nur in ENDED?)

---

## 🎯 Next Steps für Debugging:

1. **State-Validator implementieren** (höchste Priorität)
   - Kopiere `isEventAllowedInPhase()` von Beamer
   - Wrapping aller Event-Handler
   - Phase-Tracking in `currentPhase` Variable

2. **Logging verbessern**
   - Alle blockierten Events loggen
   - Phase-Wechsel loggen
   - Lock-Answer mit Timestamp loggen

3. **Testing-Szenarien**
   - Player joined in LOBBY → Wechsel zu PLAYING → Reveal → ENDED
   - Player reconnect in PLAYING (sollte Wortliste laden)
   - Admin reset während PLAYING (Player sollte zu LOBBY)
   - Mehrere Spieler gleichzeitig (Race Conditions?)

4. **Design-Entscheidung:** Spätes Einloggen
   - Mit Team besprechen
   - Falls erlaubt: Penalty-System implementieren
   - Falls verboten: Code aus `handleImageRevealed()` entfernen

---

**Ende der Analyse** ✅
