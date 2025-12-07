# 🚀 Andock-Plan: Admin UI Integration

**Erstellt:** 2025-12-04  
**Status:** Analyse abgeschlossen, Ready for Implementation  
**Metapher:** Wie beim Andocken einer Raumstation - präzise Schnittstellen, keine Lecks!

---

## 🔍 Situationsanalyse

### Was haben wir?

| Komponente | Datei | Status |
|------------|-------|--------|
| **Altes Admin UI** | `admin.html` + `js/admin.js` | ✅ Funktioniert, aber unübersichtlich |
| **Neues Admin UI** | `admin-new.html` + `js/admin/main.js` | ⚠️ ~80% fertig, noch nicht vollständig angedockt |
| **Backend API** | `server/routes/api.js` | ✅ Vollständig implementiert |
| **Socket Events** | `server/sockets/admin.js` | ✅ Vollständig implementiert |
| **Konzept-Dokumente** | `docs/ADMIN_UI_CONCEPT_V2.md` | ✅ Detailliert |
| **CSS Module** | `css/admin/` | ✅ 13 Dateien fertig |
| **JS Module** | `js/admin/` | ⚠️ Strukturiert, aber nicht alle genutzt |

### Das "Frankenstein"-Problem

Das neue Frontend (`admin-new.html` + `js/admin/main.js`) wurde teilweise entwickelt, aber:

1. **Doppelte State-Verwaltung:** 
   - `js/admin/state.js` (modular, mit Selectors/Actions)
   - Inline-State in `js/admin/main.js` (direkt im Code)
   
2. **Ungenutzte Module:**
   - `js/admin/state.js` wird **nicht** importiert in `main.js`
   - `js/admin/modals.js`, `js/admin/sidebar.js`, etc. existieren, werden aber nicht verwendet
   
3. **Fehlende Socket-Events:**
   - Einige Events aus dem alten `admin.js` fehlen noch
   - PIN-Timer nicht implementiert
   - Beamer-Status nicht vollständig

4. **API-Inkonsistenzen:**
   - `/api/upload` vs. `/api/images/upload` (unterschiedliche Pfade)
   - Settings-Speicherung teilweise nicht angebunden

---

## 🔌 Die Andock-Schnittstellen

### Schnittstelle 1: Socket Events (Client ↔ Server)

| Event | Richtung | Status in `main.js` | Anmerkung |
|-------|----------|---------------------|-----------|
| `admin:connect` | C→S | ✅ | Mit Token |
| `admin:auth` | C→S | ✅ | |
| `admin:initial_state` | S→C | ⚠️ | Handler vorhanden, aber nicht alle Daten genutzt |
| `admin:auth_required` | S→C | ✅ | |
| `admin:start_game` | C→S | ✅ | |
| `admin:reveal_image` | C→S | ✅ | |
| `admin:next_image` | C→S | ✅ | |
| `admin:end_game` | C→S | ✅ | |
| `admin:select_image` | C→S | ✅ | |
| `admin:spotlight` | C→S | ✅ | Throttled |
| `admin:spotlight_click` | C→S | ✅ | |
| `admin:clear_spotlight` | C→S | ✅ | |
| `admin:toggle_qr` | C→S | ❌ | **FEHLT** |
| `admin:update_pin` | C→S | ❌ | **FEHLT** |
| `admin:toggle_protection` | C→S | ❌ | **FEHLT** |
| `admin:set_join_host` | C→S | ❌ | **FEHLT** |
| `admin:reset_game_soft` | C→S | ⚠️ | Vorhanden in Settings-Modal, aber nicht verbunden |
| `admin:reset_complete` | C→S | ⚠️ | Vorhanden, aber nicht verbunden |
| `admin:restart_server` | C→S | ⚠️ | Vorhanden, aber nicht verbunden |
| `admin:factory_reset` | C→S | ⚠️ | Vorhanden, aber nicht verbunden |
| `game:lobby_update` | S→C | ✅ | |
| `game:phase_change` | S→C | ✅ | |
| `game:leaderboard_update` | S→C | ✅ | |
| `beamer:status` | S→C | ✅ | |
| `admin:session_count` | S→C | ❌ | **FEHLT** (Multi-Admin Warnung) |

### Schnittstelle 2: REST API Calls

| Endpoint | Methode | Status in `main.js` | Anmerkung |
|----------|---------|---------------------|-----------|
| `/api/images` | GET | ✅ | |
| `/api/images/upload` | POST | ⚠️ | Pfad ist `/api/upload` - **FALSCH** |
| `/api/images/:id` | DELETE | ✅ | |
| `/api/images/:id/set-start` | PATCH | ✅ | |
| `/api/images/:id/set-end` | PATCH | ✅ | |
| `/api/images/:id/clear-role` | PATCH | ❌ | **FEHLT** |
| `/api/game-images` | GET | ✅ | |
| `/api/game-images` | POST | ✅ | |
| `/api/game-images/:id` | DELETE | ✅ | |
| `/api/game-images/:id` | PATCH | ✅ | |
| `/api/game-images/reorder` | PATCH | ✅ | |
| `/api/game-images/reset-played` | POST | ❌ | **FEHLT** |
| `/api/words` | GET | ❌ | **FEHLT** |
| `/api/words` | PUT | ⚠️ | Anderer Pfad verwendet |
| `/api/settings` | GET/PUT/PATCH | ❌ | **FEHLT** |
| `/api/auth/login` | POST | ❌ | **FEHLT** (URL-Token wird stattdessen verwendet) |

### Schnittstelle 3: UI-Komponenten

| Komponente | HTML | CSS | JS-Logic | Status |
|------------|------|-----|----------|--------|
| **Header** | ✅ | ✅ | ⚠️ | Phase-Badge: nur Text, Styling fehlt |
| **Connection Status** | ✅ | ✅ | ✅ | |
| **Beamer Status** | ✅ | ✅ | ⚠️ | Wird nicht aktualisiert |
| **Player Count** | ✅ | ✅ | ✅ | |
| **PIN Timer** | ✅ | ✅ | ❌ | **Logik fehlt komplett** |
| **Spotlight Canvas** | ✅ | ✅ | ✅ | Mit SpotlightRenderer |
| **Spotlight Controls** | ✅ | ✅ | ✅ | |
| **Leaderboard** | ✅ | ✅ | ✅ | |
| **Game Strip** | ✅ | ✅ | ⚠️ | Start/End-Bilder nicht angezeigt |
| **Control Buttons** | ✅ | ✅ | ⚠️ | Visibility-Logic falsch |
| **Progress Bar** | ✅ | ✅ | ✅ | |
| **Sidebar** | ✅ | ✅ | ✅ | |
| **Image Pool** | ✅ | ✅ | ✅ | |
| **Context Menu** | ✅ | ✅ | ⚠️ | Nicht alle Aktionen |
| **Settings Modal** | ✅ | ✅ | ⚠️ | Tab-Wechsel funktioniert, Speichern unvollständig |
| **Help Modal** | ✅ | ✅ | ✅ | |
| **Toast Notifications** | ✅ | ✅ | ✅ | |
| **Admin Session Badge** | ❌ | ❌ | ❌ | **Komplett fehlt** |

---

## 📋 Andock-Checkliste

### Phase 1: Kritische Lücken schließen (Socket-Events) ⚡

Diese müssen für Grundfunktionalität zuerst implementiert werden:

- [ ] **1.1** `admin:toggle_qr` - QR-Toggle Button anschließen
- [ ] **1.2** `admin:session_count` Handler - Multi-Admin Warnung
- [ ] **1.3** PIN-Timer Logik aus `handleAdminInitialState` extrahieren
- [ ] **1.4** Beamer-Status korrekt updaten (Event `beamer:status` oder aus `initial_state`)

### Phase 2: API-Pfade korrigieren 🔧

- [ ] **2.1** Upload-Pfad: `/api/upload` → `/api/images/upload`
- [ ] **2.2** Words-Endpunkt anschließen: `/api/words` GET/PUT
- [ ] **2.3** Settings-Endpunkt für PIN-Management

### Phase 3: UI-Logik vervollständigen 🎨

- [ ] **3.1** Game Strip: Start/End-Bilder aus Pool anzeigen (nicht nur gameImages)
- [ ] **3.2** Control Buttons: `startGame` vs `revealImage` Visibility korrekt
- [ ] **3.3** Phase-Badge: Korrektes Styling nach Phase
- [ ] **3.4** Context Menu: Alle Aktionen implementieren

### Phase 4: Settings Modal komplett anschließen ⚙️

- [ ] **4.1** Tab "Allgemein": PIN-Aktivierung & Änderung via Socket
- [ ] **4.2** Tab "Namen": Wörterliste laden & speichern via API
- [ ] **4.3** Tab "Punkte": Scoring-Settings laden & speichern
- [ ] **4.4** Tab "Gefahr": Alle Reset-Buttons mit Socket-Events verbinden

### Phase 5: Cleanup & Konsolidierung 🧹

- [ ] **5.1** Entscheiden: `js/admin/state.js` verwenden ODER inline State
- [ ] **5.2** Ungenutzte Module entfernen oder integrieren
- [ ] **5.3** `admin.html` (alt) → `admin-backup.html` umbenennen
- [ ] **5.4** `admin-new.html` → `admin.html` umbenennen

---

## 🎯 Priorisierte Task-Reihenfolge

### Sprint 1: "Grundfunktionalität" (MUSS) ✅ ABGESCHLOSSEN
1. ✅ Socket Event: `admin:toggle_qr` - implementiert mit Keyboard-Shortcut (Q)
2. ✅ API-Pfad korrigieren: Upload (`/api/images/upload` in main.js und sidebar.js)
3. ✅ Game Strip: Start/End-Bilder anzeigen (war bereits korrekt implementiert)
4. ✅ Control Buttons Visibility-Logic fixen (war bereits korrekt implementiert)
5. ✅ Settings Modal: Danger-Tab Socket Events (soft/complete/factory reset + restart)

### Sprint 2: "Vollständigkeit" (SOLL) ✅ ABGESCHLOSSEN
6. ✅ PIN-Management komplett:
   - State-Variablen (pinEnabled, pinExpiresAt, currentPin, playerJoinUrl)
   - Socket-Handler (admin:protection_changed)
   - PIN-Timer UI mit Countdown
   - Toggle via Socket (admin:toggle_protection)
   - PIN-Update via Socket (admin:update_pin)
7. ✅ Multi-Admin Warnung:
   - Socket-Handler (admin:session_count)
   - Toast-Warnung bei mehreren aktiven Sessions
8. ✅ Beamer-Status live update:
   - Server: broadcastBeamerStatus() Funktion
   - Server: wasInBeamerRoom Flag für Disconnect-Tracking
   - Client: beamer:status Handler bereits vorhanden
9. ✅ Wörterliste laden/speichern:
   - loadWordlist() via GET /api/words
   - saveSettings() via PUT /api/words
10. ✅ Scoring-Settings:
    - loadScoringSettings() via GET /api/settings
    - saveSettings() via PUT /api/settings (scoring)

### Sprint 3: "Polish" (KANN)
11. State-Management konsolidieren
12. Keyboard-Shortcuts erweitern
13. Animations/Transitions verfeinern
14. Cleanup alte Dateien

---

## 🔌 Detaillierte Andock-Anweisungen

### 1. QR-Toggle anschließen

**Datei:** `js/admin/main.js`

**Problem:** Der QR-Toggle-Checkbox existiert nicht in `admin-new.html`

**Lösung:**

```javascript
// In setupEventListeners() hinzufügen:
document.getElementById('qr-toggle')?.addEventListener('change', (e) => {
  window.socketAdapter.emit('admin:toggle_qr', { enabled: e.target.checked });
});
```

**ODER** einen Button im Header hinzufügen und State tracken.

---

### 2. Upload-Pfad korrigieren

**Datei:** `js/admin/main.js`, Funktion `setupUpload()`

**Aktuell:** `/api/upload`  
**Korrekt:** `/api/images/upload`

```javascript
// Zeile ~850
await authFetch('/api/images/upload', {  // <-- korrigiert
  method: 'POST',
  body: formData
});
```

---

### 3. Game Strip mit Start/End-Bildern

**Problem:** Die Funktion `renderGameStrip()` zeigt Start/End-Bilder nur wenn sie im `imagePool` gefunden werden, aber die Logik greift nicht richtig.

**Lösung:** In `renderGameStrip()` sicherstellen dass:
1. Start-Bild immer links
2. End-Bild immer rechts
3. Wenn Start=End, dann kombinierte Karte

**Code-Fix:**
```javascript
// Zeile ~380 - Start/End-Bilder korrekt finden
const startImage = state.imagePool.find(img => img.is_start_image);
const endImage = state.imagePool.find(img => img.is_end_image);
const startAndEndSame = startImage && endImage && startImage.id === endImage.id;

// Dann die Reihenfolge: Start → Game Images → End
```

---

### 4. Control Buttons Visibility

**Problem:** `btn-start-game` wird versteckt wenn `phase !== 'lobby'`, aber `btn-reveal` wird auch in `lobby` angezeigt.

**Lösung:** In `updateGameControlButtons()`:

```javascript
// Beide Buttons sollten unterschiedlich behandelt werden:
// - START nur in Lobby sichtbar UND enabled wenn Bilder vorhanden
// - REVEAL nur in Playing sichtbar UND enabled

if (dom.btnStartGame && dom.btnReveal) {
  const isLobby = state.phase === 'lobby';
  dom.btnStartGame.style.display = isLobby ? 'flex' : 'none';
  dom.btnReveal.style.display = isLobby ? 'none' : 'flex';
  
  dom.btnStartGame.disabled = !hasUnplayedImages;
  dom.btnReveal.disabled = state.phase !== 'playing';
}
```

---

### 5. Danger-Tab Socket Events

**Funktionen vorhanden aber nicht angebunden:**
- `softReset()` → `admin:reset_game_soft`
- `completeReset()` → `admin:reset_complete`
- `restartServer()` → `admin:restart_server`
- `factoryReset()` → `admin:factory_reset`

**Diese sind bereits implementiert!** Nur Button-Clicks müssen sicherstellen dass die Modals richtig schließen und Feedback geben.

---

## 🧪 Test-Checkliste nach Andocken

### Smoke Tests (Basis-Funktionalität)
- [ ] Seite lädt ohne Fehler
- [ ] Socket-Verbindung wird hergestellt
- [ ] Initial State wird geladen (Images, Players, Phase)
- [ ] Bilder-Upload funktioniert
- [ ] Spiel kann gestartet werden
- [ ] Bild kann aufgedeckt werden
- [ ] Nächstes Bild kann geladen werden
- [ ] Spiel kann beendet werden

### Integration Tests
- [ ] Spotlight wird auf Beamer angezeigt
- [ ] QR-Code Toggle funktioniert
- [ ] Leaderboard aktualisiert sich bei Punkten
- [ ] Multi-Admin Warnung erscheint bei 2. Admin
- [ ] PIN-Schutz aktivieren/deaktivieren

### Regressions-Tests
- [ ] Drag & Drop für Bildersortierung
- [ ] Context-Menu alle Aktionen
- [ ] Keyboard-Shortcuts
- [ ] Settings speichern & laden

---

## 📁 Finale Dateistruktur (nach Cleanup)

```
client/
├── admin.html                    # Das neue UI (umbenannt von admin-new.html)
├── admin-backup.html             # Das alte UI (für Notfall)
├── css/
│   ├── admin.css                 # Main CSS (imports Module)
│   └── admin/                    # CSS Module (bleiben)
└── js/
    ├── admin.js                  # Legacy (für Backup)
    ├── admin/
    │   └── main.js               # Haupt-Entry (alles drin ODER modular)
    ├── socket-adapter.js         # Shared
    └── spotlight-renderer.js     # Shared
```

---

## 💡 Empfehlung: Schrittweises Vorgehen

1. **Heute:** Sprint 1 Tasks (kritische Lücken)
2. **Morgen:** Sprint 2 Tasks (Vollständigkeit)
3. **Zum Schluss:** Rename `admin-new.html` → `admin.html`

Das sorgt dafür, dass das alte `admin.html` als Fallback bereitsteht bis das neue stabil läuft.

---

**Bereit zum Andocken! 🚀**
