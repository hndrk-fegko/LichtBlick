# Admin UI Implementierungsplan

**Erstellt:** 2025-12-03  
**Aktualisiert:** 2025-12-03  
**Backup:** `backup_2025-12-03_12-39/client`  
**Rollback:** `Copy-Item -Path "backup_2025-12-03_12-39\client" -Destination "client" -Recurse -Force`

## ✅ Implementierungsfortschritt

| Phase | Beschreibung | Status |
|-------|--------------|--------|
| Phase 1 | CSS Module | ✅ FERTIG |
| Phase 2 | JS Module | ✅ FERTIG |
| Phase 3 | HTML Struktur | ⏳ NÄCHSTER SCHRITT |
| Phase 4 | Integration | ⬜ |
| Phase 5 | Socket Events | ⬜ |
| Phase 6 | Testing | ⬜ |

### Erstellte Dateien:

**CSS (13 Dateien):**
- ✅ `client/css/admin/_variables.css`
- ✅ `client/css/admin/_base.css`
- ✅ `client/css/admin/_layout.css`
- ✅ `client/css/admin/_header.css`
- ✅ `client/css/admin/_buttons.css`
- ✅ `client/css/admin/_canvas.css`
- ✅ `client/css/admin/_leaderboard.css`
- ✅ `client/css/admin/_game-strip.css`
- ✅ `client/css/admin/_controls.css`
- ✅ `client/css/admin/_footer.css`
- ✅ `client/css/admin/_sidebar.css`
- ✅ `client/css/admin/_modals.css`
- ✅ `client/css/admin/_animations.css`
- ✅ `client/css/admin-new.css` (Main Entry)

**JS (6 Module):**
- ✅ `client/js/admin/state.js` - State Management
- ✅ `client/js/admin/toast.js` - Toast Notifications
- ✅ `client/js/admin/modals.js` - Settings/Danger/Confirm
- ✅ `client/js/admin/keyboard.js` - Keyboard Shortcuts
- ✅ `client/js/admin/sidebar.js` - Bild-Sidebar
- ✅ `client/js/admin/ui-controller.js` - UI Updates
- ✅ `client/js/admin/main.js` - Main Entry Point

---

## 📁 Dateistruktur (Modular)

```
client/
├── admin.html                    # Minimales HTML-Gerüst
├── css/
│   ├── admin.css                 # Hauptstyles (imports andere)
│   ├── admin/
│   │   ├── _variables.css        # CSS Custom Properties
│   │   ├── _base.css             # Reset, Typography
│   │   ├── _layout.css           # Grid, Flexbox Structure
│   │   ├── _header.css           # Header Component
│   │   ├── _canvas.css           # Spotlight Canvas
│   │   ├── _leaderboard.css      # Leaderboard Panel
│   │   ├── _game-strip.css       # Game Images Strip
│   │   ├── _controls.css         # Control Bar
│   │   ├── _footer.css           # Footer
│   │   ├── _sidebar.css          # Bilder-Sidebar
│   │   ├── _modals.css           # Settings & Danger Modals
│   │   └── _animations.css       # Transitions, Keyframes
│   └── admin-legacy.css          # Backup des alten CSS (zum Vergleich)
└── js/
    ├── admin.js                  # Haupt-Orchestrator (imports Module)
    ├── admin/
    │   ├── state.js              # Zentraler State Management
    │   ├── ui-controller.js      # UI Updates, DOM Manipulation
    │   ├── sidebar.js            # Sidebar Logic
    │   ├── modals.js             # Modal Logic
    │   ├── keyboard.js           # Keyboard Shortcuts
    │   ├── game-controls.js      # Spielsteuerung Logic
    │   ├── spotlight.js          # Spotlight Canvas Logic
    │   ├── images.js             # Bilder-Management
    │   └── socket-handlers.js    # Socket Event Handlers
    └── admin-legacy.js           # Backup des alten JS
```

---

## 🎯 UI-Element Interaktionsmatrix

### Legende
- **Trigger**: Wie wird die Aktion ausgelöst?
- **Handler**: Welche Funktion wird aufgerufen?
- **Effekt**: Was passiert?
- **Schließen**: Wann/wie wird es beendet?

---

## 1️⃣ HEADER (60px)

### 1.1 Logo/Titel
| Eigenschaft | Wert |
|-------------|------|
| Element | `<h1 id="app-title">` |
| Interaktion | Keine (statisch) |

### 1.2 Phase-Badge
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="phase-badge" class="badge">` |
| Trigger | Socket Event `game:phase_change` |
| Handler | `uiController.updatePhase(phase)` |
| Effekt | Text + Farbe ändern (Lobby=grün, Playing=gelb, Ended=rot) |
| States | `lobby`, `playing`, `ended` |

### 1.3 Spieler-Counter
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="player-count">` |
| Trigger | Socket Event `game:lobby_update` |
| Handler | `uiController.updatePlayerCount(count)` |
| Effekt | Zahl aktualisieren |

### 1.4 Connection-Status
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="connection-status">` |
| Trigger | Socket connect/disconnect |
| Handler | `uiController.updateConnectionStatus(connected)` |
| Effekt | Icon + Text + Farbe ändern |

### 1.5 Settings-Button (⚙️)
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-settings">` |
| Trigger | Click, Keyboard `Ctrl+,` |
| Handler | `modals.open('settings')` |
| Effekt | Settings-Modal öffnet (slide-in + fade) |
| Schließen | Click auf X, Click außerhalb, Esc-Taste |

### 1.6 Bilder-Sidebar-Toggle (📷)
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-sidebar-images">` |
| Trigger | Click, Keyboard `B` |
| Handler | `sidebar.toggle('images')` |
| Effekt | Sidebar slide-in von links (350px) |
| Schließen | Click auf Toggle, Click außerhalb, Esc-Taste |

### 1.7 Admin-Sessions-Badge
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="admin-sessions">` (im Header) |
| Trigger | Socket Event `admin:session_count` |
| Handler | `uiController.updateAdminSessions(count, warning)` |
| Effekt | Badge zeigt Anzahl, >1 = Warnung (rot) |

---

## 2️⃣ MAIN AREA - SPOTLIGHT CANVAS

### 2.1 Canvas Element
| Eigenschaft | Wert |
|-------------|------|
| Element | `<canvas id="spotlight-canvas">` |
| Trigger | Mouse events (move, down, up), Touch events |
| Handler | `spotlight.handleMouse(event)` |
| Effekt | Spotlight zeichnen, an Server senden |
| Besonderheit | Throttled (50ms), Touch-Support |

### 2.2 Spotlight-Toggle
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="checkbox" id="spotlight-toggle">` |
| Trigger | Click, Keyboard `F` |
| Handler | `spotlight.toggleEnabled()` |
| Effekt | Canvas-Cursor ändert sich, Zeichnen aktiviert |
| State | `state.spotlightEnabled` |

### 2.3 Spotlight-Größe Slider
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="range" id="spotlight-size">` |
| Trigger | Input event (drag) |
| Handler | `spotlight.setSize(value)` |
| Effekt | Live-Vorschau, Wert-Anzeige aktualisieren |
| Range | 20-200px |

### 2.4 Spotlight-Stärke Slider
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="range" id="spotlight-strength">` |
| Trigger | Input event |
| Handler | `spotlight.setStrength(value)` |
| Effekt | Transparenz pro Klick |
| Range | 10-100% |

### 2.5 Spotlight-Fokus Slider
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="range" id="spotlight-focus">` |
| Trigger | Input event |
| Handler | `spotlight.setFocus(value)` |
| Effekt | Gradient-Härte |
| Range | 0-100% |

### 2.6 Aufgedeckte-Bereiche Toggle
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="checkbox" id="reveal-overlay-toggle">` |
| Trigger | Click |
| Handler | `spotlight.toggleRevealOverlay()` |
| Effekt | Grünes Overlay für aufgedeckte Bereiche |

### 2.7 Spotlights-Löschen Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-clear-spotlights">` |
| Trigger | Click |
| Handler | `spotlight.clearAll()` |
| Effekt | Alle Spotlights löschen (Admin + Beamer sync) |
| Confirm | Keine (sofort) |

---

## 3️⃣ MAIN AREA - LEADERBOARD PANEL

### 3.1 Leaderboard-Liste
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="leaderboard">` |
| Trigger | Socket Event `game:leaderboard_update` |
| Handler | `uiController.updateLeaderboard(players)` |
| Effekt | Liste neu rendern (Top 10 sichtbar, Rest scrollbar) |
| Animation | Rang-Änderungen animieren |

### 3.2 Spieler-Eintrag
| Eigenschaft | Wert |
|-------------|------|
| Element | `.leaderboard-item` |
| Hover | Highlight |
| Click | (Future: Spieler-Details Modal) |

---

## 4️⃣ GAME IMAGES STRIP (120px)

### 4.1 Bild-Strip Container
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="game-images-strip">` |
| Scroll | Horizontal mit Buttons oder Drag |

### 4.2 Scroll-Buttons
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button class="strip-scroll-left/right">` |
| Trigger | Click, Hold (continuous scroll) |
| Handler | `gameStrip.scroll(direction)` |
| Effekt | Strip scrollt 200px |
| Visibility | Nur wenn overflow |

### 4.3 Game-Image Card
| Eigenschaft | Wert |
|-------------|------|
| Element | `.game-image-card` |
| Trigger | Click |
| Handler | `images.selectGameImage(id)` |
| Effekt | Border highlight, als aktuelles Bild setzen |
| States | `selected`, `played`, `current` |
| Drag | Sortieren per Drag & Drop |

### 4.4 Game-Image Delete Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `.game-image-card .delete-btn` |
| Trigger | Click |
| Handler | `images.removeFromGame(id)` |
| Effekt | Bild zurück in Pool |
| Confirm | Keine (sofort, undo möglich) |

### 4.5 Antwort-Input (aktuelles Bild)
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input id="current-answer-input">` |
| Trigger | Input, Blur, Enter |
| Handler | `images.setAnswer(id, value)` |
| Effekt | Antwort speichern (debounced 500ms) |
| Validation | Min 1 Zeichen |

---

## 5️⃣ CONTROL BAR (80px)

### 5.1 Spiel-Starten Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-start-game">` |
| Trigger | Click, Keyboard `S` (wenn Lobby) |
| Handler | `gameControls.startGame()` |
| Effekt | Socket emit `admin:start_game` |
| Disabled | Wenn playing oder keine Bilder |
| Confirm | Keine |

### 5.2 Bild-Aufdecken Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-reveal">` |
| Trigger | Click, Keyboard `Space` |
| Handler | `gameControls.revealImage()` |
| Effekt | Bild vollständig aufdecken |
| Disabled | Wenn nicht playing |

### 5.3 Nächstes-Bild Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-next">` |
| Trigger | Click, Keyboard `→` oder `N` |
| Handler | `gameControls.nextImage()` |
| Effekt | Nächstes Bild laden |
| Disabled | Wenn nicht playing oder letztes Bild |

### 5.4 Spiel-Beenden Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-end-game">` |
| Trigger | Click, Keyboard `E` (mit Confirm) |
| Handler | `gameControls.endGame()` |
| Effekt | Spiel beenden, Endscreen zeigen |
| Disabled | Wenn nicht playing |
| Confirm | "Wirklich beenden?" |

### 5.5 QR-Toggle
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="checkbox" id="qr-toggle">` |
| Trigger | Click, Keyboard `Q` |
| Handler | `gameControls.toggleQR()` |
| Effekt | QR auf Beamer ein/ausblenden |

---

## 6️⃣ FOOTER (40px)

### 6.1 Server-Status
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="server-status">` |
| Trigger | Health check interval (30s) |
| Handler | `uiController.updateServerStatus()` |

### 6.2 Bilder-Counter
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="image-count">` |
| Trigger | Image pool changes |
| Handler | `uiController.updateImageCount(pool, game)` |

### 6.3 Version
| Eigenschaft | Wert |
|-------------|------|
| Element | `<span id="version">` |
| Interaktion | Keine (statisch) |

### 6.4 Danger-Zone Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-danger-zone">` |
| Trigger | Click |
| Handler | `modals.open('danger')` |
| Effekt | Danger-Modal öffnet |
| Schließen | X, Esc, Click außerhalb |

---

## 7️⃣ BILDER-SIDEBAR (350px, Links)

### 7.1 Sidebar Container
| Eigenschaft | Wert |
|-------------|------|
| Element | `<aside id="sidebar-images">` |
| States | `open`, `closed` |
| Animation | `transform: translateX(-350px)` → `translateX(0)` |
| Duration | 300ms ease-out |

### 7.2 Sidebar-Close Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button class="sidebar-close">` |
| Trigger | Click |
| Handler | `sidebar.close()` |

### 7.3 Upload-Area (Drag & Drop)
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="upload-area">` |
| Trigger | Click, Drag & Drop |
| Handler | `images.handleUpload(files)` |
| States | `idle`, `dragover`, `uploading` |
| Effekt | File Dialog oder Drop-Upload |
| Feedback | Progress Bar |

### 7.4 Upload-Progress
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="upload-progress">` |
| Trigger | Upload in progress |
| Handler | `images.updateProgress(percent)` |
| Visibility | Nur während Upload |

### 7.5 "Alle zum Spiel" Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-add-all">` |
| Trigger | Click |
| Handler | `images.addAllToGame()` |
| Effekt | Alle Pool-Bilder zum Spiel hinzufügen |
| Disabled | Wenn Pool leer |

### 7.6 Pool-Image Thumbnail
| Eigenschaft | Wert |
|-------------|------|
| Element | `.pool-image` |
| Click | Zum Spiel hinzufügen |
| Right-Click | Context-Menu öffnen |
| Hover | Delete-Button zeigen |
| States | `is-start`, `is-end`, `in-game` |

### 7.7 Pool-Image Context-Menu
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="image-context-menu">` |
| Trigger | Right-Click auf Pool-Image |
| Handler | `images.showContextMenu(event, id)` |
| Position | Bei Mausposition |
| Schließen | Click außerhalb, Click auf Option, Esc |

### 7.8 Context-Menu Optionen
| Option | Handler | Effekt |
|--------|---------|--------|
| Als Start-Bild | `images.setRole(id, 'start')` | Grüner Rahmen |
| Als End-Bild | `images.setRole(id, 'end')` | Roter Rahmen |
| Zum Spiel | `images.addToGame(id)` | Zum Strip hinzufügen |
| Rolle entfernen | `images.clearRole(id)` | Rollen löschen |
| Löschen | `images.delete(id)` | Confirm-Dialog, dann löschen |

### 7.9 Pool-Image Delete Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `.pool-image .delete-btn` |
| Trigger | Click |
| Handler | `images.confirmDelete(id)` |
| Effekt | Confirm-Dialog → Löschen |
| Confirm | "Bild wirklich löschen?" |

---

## 8️⃣ SETTINGS-MODAL

### 8.1 Modal Container
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="modal-settings" class="modal">` |
| Open | `modals.open('settings')` |
| Close | X-Button, Overlay-Click, Esc |
| Animation | Fade-in + Scale |

### 8.2 Modal-Overlay (Backdrop)
| Eigenschaft | Wert |
|-------------|------|
| Element | `.modal-overlay` |
| Trigger | Click |
| Handler | `modals.close()` |
| Effekt | Modal schließen |

### 8.3 PIN-Schutz Toggle
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input type="checkbox" id="protection-toggle">` |
| Trigger | Change |
| Handler | `settings.toggleProtection()` |
| Effekt | Socket emit `admin:set_protection` |

### 8.4 PIN-Ändern Input
| Eigenschaft | Wert |
|-------------|------|
| Element | `<input id="new-pin-input">` |
| Trigger | Form submit |
| Handler | `settings.updatePin()` |
| Validation | 4-10 Zeichen |
| Feedback | Success/Error Message |

### 8.5 QR-Code Anzeige
| Eigenschaft | Wert |
|-------------|------|
| Element | `<canvas id="qr-preview">` |
| Trigger | Modal open, Refresh |
| Handler | `settings.renderQR()` |

### 8.6 QR-Refresh Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-refresh-qr">` |
| Trigger | Click |
| Handler | `settings.refreshQR()` |
| Effekt | Neuen QR generieren |

### 8.7 Wörterliste Textarea
| Eigenschaft | Wert |
|-------------|------|
| Element | `<textarea id="word-list">` |
| Trigger | Input |
| Handler | Auto-save nach 1s idle |
| Feedback | "Gespeichert" Toast |

### 8.8 Wörter-Speichern Button
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-save-words">` |
| Trigger | Click |
| Handler | `settings.saveWords()` |
| Effekt | Socket emit `admin:set_words` |
| Feedback | Success Toast |

---

## 9️⃣ DANGER-MODAL

### 9.1 Modal Container
| Eigenschaft | Wert |
|-------------|------|
| Element | `<div id="modal-danger" class="modal modal-danger">` |
| Open | `modals.open('danger')` |
| Close | X-Button, Overlay-Click, Esc |
| Style | Rote Akzente, Warnfarben |

### 9.2 Spiel-Zurücksetzen
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-reset-game">` |
| Trigger | Click |
| Handler | `danger.resetGame()` |
| Confirm | Inline-Confirm (Button wird "Sicher?", nochmal klicken) |
| Effekt | Socket emit `admin:reset_game` |
| Nach Ausführung | Success-Meldung, Modal bleibt offen |

### 9.3 Komplett-Zurücksetzen
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-reset-complete">` |
| Checkbox | Include roles |
| Trigger | Click |
| Handler | `danger.resetComplete(includeRoles)` |
| Confirm | Inline-Confirm |
| Effekt | Socket emit `admin:reset_complete` |

### 9.4 Server-Neustarten
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-restart-server">` |
| Trigger | Click |
| Handler | `danger.restartServer()` |
| Confirm | Inline-Confirm |
| Effekt | Socket emit `admin:restart_server` |
| Nach Ausführung | Modal schließt, Reconnect-Overlay |

### 9.5 Factory-Reset
| Eigenschaft | Wert |
|-------------|------|
| Element | `<button id="btn-factory-reset">` |
| Trigger | Click |
| Handler | `danger.factoryReset()` |
| Confirm | Typ-Bestätigung ("RESET" eingeben) |
| Effekt | Socket emit `admin:factory_reset` |
| Nach Ausführung | Redirect zu Login |

---

## ⌨️ KEYBOARD SHORTCUTS

### Global (immer aktiv)
| Taste | Aktion | Handler |
|-------|--------|---------|
| `Esc` | Modal/Sidebar schließen | `keyboard.handleEscape()` |
| `B` | Bilder-Sidebar toggle | `sidebar.toggle('images')` |
| `Ctrl+,` | Settings öffnen | `modals.open('settings')` |

### Spielsteuerung (nur wenn kein Input fokussiert)
| Taste | Aktion | Bedingung | Handler |
|-------|--------|-----------|---------|
| `S` | Spiel starten | Phase=Lobby | `gameControls.startGame()` |
| `Space` | Bild aufdecken | Phase=Playing | `gameControls.revealImage()` |
| `→` oder `N` | Nächstes Bild | Phase=Playing | `gameControls.nextImage()` |
| `←` oder `P` | Vorheriges Bild | Phase=Playing | `gameControls.prevImage()` |
| `E` | Spiel beenden | Phase=Playing | `gameControls.endGame()` |
| `Q` | QR toggle | Immer | `gameControls.toggleQR()` |
| `F` | Spotlight toggle | Immer | `spotlight.toggleEnabled()` |

### Canvas (wenn Canvas fokussiert)
| Taste | Aktion | Handler |
|-------|--------|---------|
| `+` / `=` | Spotlight größer | `spotlight.increaseSize()` |
| `-` | Spotlight kleiner | `spotlight.decreaseSize()` |
| `Delete` | Spotlights löschen | `spotlight.clearAll()` |

---

## 🔄 State Management

### Zentraler State (`state.js`)
```javascript
const state = {
  // Connection
  connected: false,
  adminSessions: 1,
  
  // Game
  gameId: null,
  phase: 'lobby', // 'lobby' | 'playing' | 'ended'
  players: [],
  leaderboard: [],
  
  // Images
  imagePool: [],
  gameImages: [],
  currentImageId: null,
  selectedGameImageId: null,
  
  // Spotlight
  spotlightEnabled: false,
  spotlightSize: 80,
  spotlightStrength: 100,
  spotlightFocus: 70,
  spotlightClicks: [],
  showRevealOverlay: false,
  
  // UI
  sidebarOpen: null, // null | 'images'
  modalOpen: null,   // null | 'settings' | 'danger'
  contextMenuOpen: false,
  
  // Settings
  protectionEnabled: false,
  qrEnabled: false,
  wordList: [],
};
```

### State Updates
```javascript
// Alle State-Änderungen über zentrale Funktion
function updateState(path, value) {
  // Deep update
  // Trigger UI-Update für betroffene Komponenten
  // Optional: History für Undo
}

// Beispiel
updateState('phase', 'playing');
updateState('spotlight.size', 100);
```

---

## 📦 Implementierungs-Phasen

### Phase 0: Vorbereitung ✅
- [x] Backup erstellen
- [x] Dokumentation schreiben
- [ ] CSS-Dateistruktur anlegen
- [ ] JS-Modulstruktur anlegen

### Phase 1: Grundgerüst (HTML + CSS Layout)
- [ ] Neues HTML-Gerüst (`admin.html`)
- [ ] CSS Grid Layout (`_layout.css`)
- [ ] CSS Variables (`_variables.css`)
- [ ] Basis-Styles (`_base.css`)

### Phase 2: Header + Footer
- [ ] Header implementieren (`_header.css`)
- [ ] Footer implementieren (`_footer.css`)
- [ ] Connection-Status
- [ ] Phase-Badge

### Phase 3: Main Area
- [ ] Canvas-Bereich (`_canvas.css`)
- [ ] Leaderboard-Panel (`_leaderboard.css`)
- [ ] Spotlight Controls (kompakt)

### Phase 4: Game Strip + Controls
- [ ] Game Images Strip (`_game-strip.css`)
- [ ] Control Bar (`_controls.css`)
- [ ] Button States

### Phase 5: Sidebar
- [ ] Sidebar Container (`_sidebar.css`)
- [ ] Upload Area
- [ ] Image Pool Grid
- [ ] Context Menu

### Phase 6: Modals
- [ ] Modal Base (`_modals.css`)
- [ ] Settings Modal
- [ ] Danger Modal
- [ ] Confirm Dialogs

### Phase 7: JavaScript Module
- [ ] State Management (`state.js`)
- [ ] UI Controller (`ui-controller.js`)
- [ ] Sidebar Logic (`sidebar.js`)
- [ ] Modal Logic (`modals.js`)
- [ ] Keyboard Shortcuts (`keyboard.js`)
- [ ] Socket Handlers (`socket-handlers.js`)

### Phase 8: Integration
- [ ] Alle Module verbinden
- [ ] Event-Binding
- [ ] Socket-Integration
- [ ] Testing

### Phase 9: Polish
- [ ] Animationen (`_animations.css`)
- [ ] Responsive Anpassungen
- [ ] Edge Cases
- [ ] Performance

---

## 🧪 Test-Checkliste

### Funktionale Tests
- [ ] Spiel starten/beenden
- [ ] Bilder hochladen/löschen
- [ ] Spotlight zeichnen
- [ ] Leaderboard Updates
- [ ] QR-Code anzeigen
- [ ] Alle Reset-Funktionen
- [ ] Keyboard Shortcuts

### UI Tests
- [ ] Sidebar öffnen/schließen
- [ ] Modal öffnen/schließen
- [ ] Responsive bei verschiedenen Auflösungen
- [ ] Touch-Support (Tablet)
- [ ] Keyboard-Navigation

### Integration Tests
- [ ] Multi-Admin (2 Sessions)
- [ ] Reconnect nach Disconnect
- [ ] Server-Restart Handling

---

## 🔙 Rollback-Anleitung

Falls etwas schief geht:

```powershell
cd 'c:\Users\...\lichtblick'

# Aktuellen Stand löschen
Remove-Item -Path "client" -Recurse -Force

# Backup wiederherstellen
Copy-Item -Path "backup_2025-12-03_12-39\client" -Destination "client" -Recurse

# Verifizieren
Get-ChildItem client
```
