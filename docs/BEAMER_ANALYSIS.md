# 📺 BEAMER - Systematische Analyse

**Datum:** 8. Dezember 2025  
**Status:** Analyse für Debugging

---

## 📡 WebSocket Events (Eingehend)

### Beamer hört ab:

| Event | Quelle | Trigger | Payload |
|-------|--------|---------|---------|
| `beamer:initial_state` | Server (bei Connect) | Beamer verbindet sich | `{ game: {id, status}, playerCount }` |
| `beamer:image_changed` | Admin → Server | Admin wählt neues Bild | `{ imageId, imageUrl, imageType }` |
| `beamer:spotlight` | Admin → Server | Admin bewegt Maus | `{ x, y, size, strength, focus }` |
| `beamer:spotlight_click` | Admin → Server | Admin klickt (fixiert Spotlight) | `{ x, y, size, strength, focus }` |
| `beamer:clear_spotlight` | Admin → Server | Admin löscht Spotlights | `{}` |
| `beamer:reveal_image` | Admin → Server | Admin drückt Reveal | `{ correctAnswer }` |
| `beamer:qr_state` | Admin → Server | QR-Code toggle | `{ enabled, url }` |
| `beamer:image_roles_changed` | Server (Upload) | Start/End-Bild geändert | `{ startImage, endImage }` |
| `beamer:settings_changed` | Server (bei Connect) | Settings geladen | `{ darkMode, spotlight }` |
| `beamer:game_reset` | Admin → Server | Reset-Button | `{ type: 'soft'|'hard'|'factory' }` |
| `game:phase_change` | Admin → Server | Phase wechselt | `{ phase: 'lobby'|'playing'|'ended', imageId? }` |
| `game:lobby_update` | Server | Spieler joinen/leaven | `{ players, totalPlayers }` |
| `game:leaderboard_update` | Server | Leaderboard Update | `{ topPlayers }` |

---

## 🧠 Beamer State (Client-seitig)

```javascript
// Globale Variablen in beamer.js
let currentPhase = 'lobby';           // Phase: lobby | playing | ended
let canvas = null;                    // Canvas-Element
let ctx = null;                       // Canvas-Context
let currentImage = null;              // Aktuelles Image-Objekt
let spotlightClicks = [];             // Array von fixierten Spotlights
let currentMouseSpot = null;          // Aktueller Maus-Spotlight (temporär)
let isRevealed = false;               // Bild komplett aufgedeckt?
let currentCorrectAnswer = '';        // Richtige Antwort (für Overlay)
let endImageUrl = null;               // End-Bild für Result-Screen
```

---

## 🔒 State-basierte Validierung (NEU!)

**Implementiert:** 8. Dezember 2025

Alle Beamer-Events werden jetzt gegen die aktuelle Phase validiert:

### Validierungs-Regeln:

| Phase | ✅ Erlaubte Events | 🚫 Blockierte Events |
|-------|-------------------|---------------------|
| **LOBBY** | `beamer:qr_state`<br>`beamer:image_roles_changed`<br>`game:phase_change`<br>`game:lobby_update` | `beamer:spotlight`<br>`beamer:spotlight_click`<br>`beamer:reveal_image`<br>`beamer:image_changed`<br>`beamer:clear_spotlight` |
| **PLAYING** | `beamer:spotlight`<br>`beamer:spotlight_click`<br>`beamer:reveal_image`<br>`beamer:image_changed`<br>`beamer:clear_spotlight`<br>`game:phase_change` | `beamer:qr_state` |
| **ENDED** | `game:leaderboard_update`<br>`beamer:game_reset`<br>`game:phase_change`<br>`beamer:image_roles_changed` | `beamer:spotlight`<br>`beamer:spotlight_click`<br>`beamer:reveal_image`<br>`beamer:image_changed`<br>`beamer:qr_state` |

### Debug-Logging:

Blockierte Events werden geloggt:
```
🚫 Beamer: Event "beamer:spotlight" blocked in phase "lobby"
   → Admin may be in wrong state or sending invalid events
```

**Hinweis:** `beamer:spotlight` (Maus-Bewegung) wird **silent** blockiert (zu viele Events für Logging).

---

## 🎬 Verhalten pro Game-State

### **LOBBY Phase** (`currentPhase = 'lobby'`)

#### Aktiver Screen:
```html
<div id="lobby-screen" class="screen active">
```

#### Anzeige-Logik:

**Fall 1: Start-Bild gesetzt**
- Hintergrund: Start-Bild als `background-image`
- Overlay: "Warte auf Spielstart..." (kleine Box)
- Logo/Subtitle: **ausgeblendet**

**Fall 2: Kein Start-Bild**
- Hintergrund: Gradient (CSS)
- Logo: "🔦 LichtBlick" (groß)
- Subtitle: "Warte auf Spielstart..."
- Animation: Spinner

#### Event-Handler:
- ✅ `beamer:image_roles_changed` → Start-Bild aktualisieren (✅ Phase-Check)
- ✅ `game:phase_change` → Wechsel zu `playing` oder `ended`
- ✅ `beamer:qr_state` → QR-Code Overlay ein/aus (✅ Phase-Check)
- 🚫 `beamer:spotlight` → **BLOCKIERT** (Phase-Check)
- 🚫 `beamer:spotlight_click` → **BLOCKIERT** (Phase-Check)
- 🚫 `beamer:reveal_image` → **BLOCKIERT** (Phase-Check)
- 🚫 `beamer:image_changed` → **BLOCKIERT** (Phase-Check)

#### Robustheit:
- ✅ Admin kann **nicht versehentlich** Spotlights in Lobby aktivieren
- ✅ Beamer ignoriert falsche Events und loggt sie
- ✅ Konsistenter State unabhängig von Admin-Fehlern

---

### **PLAYING Phase** (`currentPhase = 'playing'`)

#### Aktiver Screen:
```html
<div id="game-screen" class="screen active">
  <canvas id="game-canvas"></canvas>
```

#### Anzeige-Logik:

**Zustand: Nicht aufgedeckt** (`isRevealed = false`)
- Canvas: Schwarzer Hintergrund mit Bild
- Spotlights: `spotlightClicks[]` (fixiert) + `currentMouseSpot` (Maus)
- Rendering: `SpotlightRenderer.render()`

**Zustand: Aufgedeckt** (`isRevealed = true`)
- Canvas: Volles Bild sichtbar
- Answer-Overlay: Antwort eingeblendet ("Richtig: STERN")
- Spotlights: **bleiben sichtbar** (Bug?)

#### Event-Handler:
- ✅ `beamer:image_changed` → Neues Bild laden, State zurücksetzen (✅ Phase-Check)
  - `spotlightClicks = []`
  - `currentMouseSpot = null`
  - `isRevealed = false`
  - `currentCorrectAnswer = ''`
- ✅ `beamer:spotlight` → Temporärer Maus-Spotlight (✅ Phase-Check, silent)
  - `currentMouseSpot = { x, y, size, strength, focus }`
  - Sofortiges Redraw
- ✅ `beamer:spotlight_click` → Fixierter Spotlight (✅ Phase-Check)
  - `spotlightClicks.push({ x, y, size, strength, focus })`
  - Sofortiges Redraw
- ✅ `beamer:clear_spotlight` → Alle Spotlights löschen (✅ Phase-Check)
  - `spotlightClicks = []`
  - `currentMouseSpot = null`
- ✅ `beamer:reveal_image` → Bild aufdecken (✅ Phase-Check)
  - **NEU:** Spotlights werden automatisch gelöscht
  - `isRevealed = true`
  - `currentCorrectAnswer = data.correctAnswer`
  - Answer-Overlay einblenden
- ✅ `game:phase_change` → Wechsel zu `ended` oder `lobby`

#### Robustheit:
- ✅ Alle Events haben Phase-Checks
- ✅ Spotlight-Events nur in PLAYING-Phase
- ✅ Spotlights werden automatisch nach Reveal gelöscht
- 🚫 QR-Code wird **blockiert** während PLAYING (Phase-Check)

---

### **ENDED Phase** (`currentPhase = 'ended'`)

#### Aktiver Screen:
```html
<div id="result-screen" class="screen active">
  <div class="result-content">
    <h1>🏆 Gewinner!</h1>
    <div id="leaderboard"></div>
  </div>
```

#### Anzeige-Logik:
- Hintergrund: End-Bild (falls gesetzt) als `background-image`
- Leaderboard: Top 10 Spieler
  - Platz 1-3: Medaillen 🥇🥈🥉
  - Platz 4-10: Nummeriert
- Thank-You-Message: "Vielen Dank fürs Mitspielen! 🎉"

#### Event-Handler:
- ✅ `game:leaderboard_update` → Leaderboard aktualisieren (✅ Phase-Check)
  - **Nur in ENDED-Phase** (Design-Entscheidung)
- ✅ `beamer:game_reset` → Zurück zu Lobby
- ✅ `game:phase_change` → Wechsel zurück zu `lobby` (bei Reset)
- 🚫 Alle Spotlight/Reveal-Events → **BLOCKIERT** (Phase-Check)

#### Robustheit:
- ✅ Leaderboard nur in ENDED-Phase
- ✅ End-Bild wird dynamisch aktualisiert (wenn Admin ändert)
- ✅ Keine Spotlight-Events während ENDED möglich

---

## 🔄 Screen-Wechsel-Matrix

| Von Phase | Zu Phase | Event | Beamer-Aktion |
|-----------|----------|-------|---------------|
| `lobby` | `playing` | `game:phase_change` | Screen → `game`, Bild laden |
| `lobby` | `ended` | `game:phase_change` | Screen → `result`, End-Bild laden |
| `playing` | `lobby` | `beamer:game_reset` | Screen → `lobby`, State reset |
| `playing` | `ended` | `game:phase_change` | Screen → `result`, End-Bild laden |
| `ended` | `lobby` | `beamer:game_reset` | Screen → `lobby`, State reset |
| `ended` | `playing` | ❌ **UNMÖGLICH** | - |

---

## 🐛 Identifizierte Probleme

### ✅ Problem 1: Spotlights bleiben nach Reveal sichtbar
**Status:** ✅ **BEHOBEN**
```javascript
function handleRevealImage(data) {
  spotlightClicks = [];      // ✅ Spotlights werden jetzt gelöscht
  currentMouseSpot = null;   // ✅ Maus-Spotlight wird gelöscht
  isRevealed = true;
  // ...
}
```

### ✅ Problem 2: Kein Phase-Check bei Spotlight-Events
**Status:** ✅ **BEHOBEN**

Alle Events haben jetzt Phase-Validierung via `isEventAllowedInPhase()`:
- ✅ `beamer:spotlight` → Nur in PLAYING
- ✅ `beamer:spotlight_click` → Nur in PLAYING
- ✅ `beamer:reveal_image` → Nur in PLAYING
- ✅ `beamer:image_changed` → Nur in PLAYING
- ✅ `beamer:qr_state` → Nur in LOBBY
- ✅ `game:leaderboard_update` → Nur in ENDED

**Debug-Logging aktiviert:**
Falsche Events werden geloggt mit Hinweis auf mögliche Admin-Probleme.

### ✅ Problem 3: End-Bild wird nicht dynamisch aktualisiert
**Status:** ✅ **BEHOBEN**

Jetzt konsistent mit Start-Bild:
- ✅ `showEndImage()` / `hideEndImage()` Funktionen
- ✅ Live-Updates via `beamer:image_roles_changed` während ENDED-Phase
- ✅ CSS-Klasse `.has-image` für besseres Styling

### ❓ Problem 4: Leaderboard nur in ENDED, nicht in PLAYING
**Status:** ⚠️ **DESIGN-ENTSCHEIDUNG**

---

## 🔧 Empfohlene Fixes

### ✅ Fix 1: Spotlights nach Reveal clearen
**Status:** ✅ **IMPLEMENTIERT**
```javascript
function handleRevealImage(data) {
  // Clear spotlights first (cleaner look)
  spotlightClicks = [];
  currentMouseSpot = null;
  
  isRevealed = true;
  currentCorrectAnswer = data.correctAnswer || '';
  redrawCanvas();
  showAnswerOverlay(currentCorrectAnswer);
}
```

### ✅ Fix 2: Phase-Check bei allen Events
**Status:** ✅ **IMPLEMENTIERT**

**Neue Validierungs-Funktion:**
```javascript
function isEventAllowedInPhase(eventName) {
  const rules = {
    'lobby': {
      allowed: ['beamer:qr_state', 'beamer:image_roles_changed', ...],
      denied: ['beamer:spotlight', 'beamer:reveal_image', ...]
    },
    'playing': {
      allowed: ['beamer:spotlight', 'beamer:image_changed', ...],
      denied: ['beamer:qr_state']
    },
    'ended': {
      allowed: ['game:leaderboard_update', 'beamer:game_reset'],
      denied: ['beamer:spotlight', 'beamer:image_changed', ...]
    }
  };
  // Returns true if allowed, false if denied (with console warning)
}
```

**Alle Event-Handler prüfen nun Phase:**
- `handleSpotlight()` → Silent ignore in lobby/ended
- `handleSpotlightClick()` → Logged warning + ignore
- `handleRevealImage()` → Logged warning + ignore
- `handleImageChanged()` → Logged warning + ignore
- `handleQRState()` → Logged warning + ignore in playing/ended
- `handleLeaderboardUpdate()` → Logged warning + ignore in lobby/playing

**Logging für Debug:**
```
🚫 Beamer: Event "beamer:spotlight" blocked in phase "lobby"
   → Admin may be in wrong state or sending invalid events
```

### ✅ Fix 3: End-Bild konsistent mit Start-Bild
**Status:** ✅ **IMPLEMENTIERT**
```javascript
function showEndImage(url) {
  const resultScreen = document.getElementById('result-screen');
  resultScreen.style.backgroundImage = `url(${CSS.escape(url)})`;
  resultScreen.classList.add('has-image');
}

function handleImageRolesChanged(data) {
  // Update start image if in lobby
  if (currentPhase === 'lobby' && data.startImage) {
    showStartImage(data.startImage.url);
  }
  
  // Update end image if in ended (or cache for later)
  if (data.endImage) {
    endImageUrl = data.endImage.url;
    if (currentPhase === 'ended') {
      showEndImage(data.endImage.url);
    }
  }
}
```

### Fix 4: Leaderboard auch in PLAYING zeigen (optional)
```javascript
function handleLeaderboardUpdate(data) {
  if (!data.topPlayers) return;
  
  // Allow leaderboard update in both playing and ended phases
  if (currentPhase === 'ended') {
    updateLeaderboard(data.topPlayers);
  }
  
  // TODO: Leaderboard-Overlay in playing phase (separate handler?)
}
```

---

## 📊 Event-Flow-Diagramm

### Typischer Spielablauf:

```
1. SERVER START
   └─> beamer:initial_state { phase: 'lobby' }

2. ADMIN WÄHLT START-BILD
   └─> beamer:image_roles_changed { startImage }

3. ADMIN AKTIVIERT QR-CODE
   └─> beamer:qr_state { enabled: true, url }

4. SPIELER JOINEN
   └─> game:lobby_update { players[], totalPlayers }

5. ADMIN WÄHLT ERSTES SPIELBILD
   └─> beamer:image_changed { imageId: 1, imageUrl, imageType: 'game' }
   └─> game:phase_change { phase: 'playing', imageId: 1 }

6. ADMIN BEWEGT MAUS (Spotlight)
   └─> beamer:spotlight { x, y, size, ... } (100x)
   └─> beamer:spotlight_click { x, y, size, ... } (3x)

7. ADMIN DRÜCKT REVEAL
   └─> beamer:reveal_image { correctAnswer: 'Stern' }
   └─> game:leaderboard_update { topPlayers[] }

8. ADMIN WÄHLT NÄCHSTES BILD
   └─> beamer:image_changed { imageId: 2, ... }

9. [... 6x Bilder ...]

10. ADMIN WÄHLT END-BILD
    └─> beamer:image_changed { imageId: 99, imageType: 'end' }
    └─> game:phase_change { phase: 'ended' }
    └─> game:leaderboard_update { topPlayers[] }

11. ADMIN DRÜCKT RESET
    └─> beamer:game_reset { type: 'soft' }
    └─> [Zurück zu Schritt 1]
```

---

## ✅ Was funktioniert gut:

1. ✅ Screen-Wechsel (lobby → game → result)
2. ✅ Spotlight-Rendering (fixiert + Maus)
3. ✅ Image-Loading und Caching
4. ✅ QR-Code Overlay
5. ✅ Leaderboard-Display in ENDED
6. ✅ Reset-Handler (kehrt zu Lobby zurück)
7. ✅ Answer-Overlay wird korrekt versteckt
8. ✅ **State-basierte Validierung** (alle Events Phase-geprüft)
9. ✅ **Spotlights werden nach Reveal automatisch gelöscht**
10. ✅ **Start-Bild und End-Bild konsistent behandelt**
11. ✅ **Debug-Logging für falsche Admin-Events**

---

## 🔍 Zu prüfen:

- [x] Werden Spotlights nach Reveal automatisch gelöscht? → ✅ **JA**
- [x] Reagiert Beamer auf Spotlight-Events in LOBBY/ENDED? → ✅ **NEIN (blockiert)**
- [x] Wird End-Bild aktualisiert wenn Admin es während ENDED ändert? → ✅ **JA**
- [ ] Wird Leaderboard in PLAYING angezeigt wenn Admin es toggelt? → ⚠️ **Design-Entscheidung offen**
- [x] Funktioniert Auto-Fullscreen nach 1 Sekunde? → ✅ **JA**
- [x] Werden falsche Events geloggt für Admin-Debugging? → ✅ **JA**
