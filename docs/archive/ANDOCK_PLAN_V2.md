# 🚀 Andock-Plan V2: Admin UI Integration

**Erstellt:** 2025-12-04  
**Letztes Update:** 2025-12-04 (nach Sprint 1 & 2)  
**Status:** Sprint 1 & 2 ✅ ABGESCHLOSSEN | Sprint 3 OFFEN

---

## 📊 Aktueller Implementierungsstatus

### Übersicht nach Kategorien

| Kategorie | Erledigt | Offen | Status |
|-----------|----------|-------|--------|
| Socket Events (Client→Server) | 15 | 1 | 🟢 94% |
| Socket Events (Server→Client) | 6 | 0 | 🟢 100% |
| REST API Endpoints | 10 | 2 | 🟡 83% |
| UI Komponenten | 14 | 3 | 🟡 82% |
| Settings Modal Tabs | 4 | 0 | 🟢 100% |

---

## ✅ ERLEDIGT (Sprint 1 & 2)

### Socket Events - Implementiert
- ✅ `admin:connect` - Mit Token
- ✅ `admin:auth` - PIN-Authentifizierung  
- ✅ `admin:initial_state` - Vollständig verarbeitet (inkl. PIN, protection, qr, adminSessionCount)
- ✅ `admin:auth_required` - Handler vorhanden
- ✅ `admin:start_game` - Spiel starten
- ✅ `admin:reveal_image` - Bild aufdecken
- ✅ `admin:next_image` - Nächstes Bild
- ✅ `admin:end_game` - Spiel beenden
- ✅ `admin:select_image` - Bild auswählen
- ✅ `admin:spotlight` - Spotlight Position (throttled)
- ✅ `admin:spotlight_click` - Spotlight Klick
- ✅ `admin:clear_spotlight` - Spotlights löschen
- ✅ `admin:toggle_qr` - QR-Code ein/aus + Keyboard (Q)
- ✅ `admin:update_pin` - PIN ändern
- ✅ `admin:toggle_protection` - PIN-Schutz aktivieren/deaktivieren
- ✅ `admin:reset_game_soft` - Soft Reset
- ✅ `admin:reset_complete` - Complete Reset  
- ✅ `admin:restart_server` - Server neustarten
- ✅ `admin:factory_reset` - Factory Reset
- ✅ `admin:protection_changed` - Server→Client Handler
- ✅ `admin:session_count` - Multi-Admin Warnung
- ✅ `game:lobby_update` - Lobby Updates
- ✅ `game:phase_change` - Phasenwechsel
- ✅ `game:leaderboard_update` - Leaderboard Updates
- ✅ `beamer:status` - Beamer Verbindungsstatus

### REST API - Implementiert
- ✅ `GET /api/images` - Bilder laden
- ✅ `POST /api/images/upload` - Bilder hochladen (Pfad korrigiert)
- ✅ `DELETE /api/images/:id` - Bild löschen
- ✅ `PATCH /api/images/:id/set-start` - Start-Bild setzen
- ✅ `PATCH /api/images/:id/set-end` - End-Bild setzen
- ✅ `GET /api/game-images` - Spielbilder laden
- ✅ `POST /api/game-images` - Bild zum Spiel hinzufügen
- ✅ `DELETE /api/game-images/:id` - Bild aus Spiel entfernen
- ✅ `PATCH /api/game-images/:id` - Spielbild aktualisieren
- ✅ `PATCH /api/game-images/reorder` - Reihenfolge ändern
- ✅ `GET /api/words` - Wörterliste laden
- ✅ `PUT /api/words` - Wörterliste speichern
- ✅ `GET /api/settings` - Settings laden (inkl. scoring)
- ✅ `PUT /api/settings` - Settings speichern (inkl. scoring)

### UI Komponenten - Implementiert
- ✅ Header mit Phase-Badge
- ✅ Connection Status (Server)
- ✅ Beamer Status (live update via Socket)
- ✅ Player Count
- ✅ PIN Timer mit Countdown
- ✅ Spotlight Canvas mit SpotlightRenderer
- ✅ Spotlight Controls
- ✅ Leaderboard
- ✅ Game Strip mit Start/End-Bildern
- ✅ Control Buttons mit korrekter Visibility
- ✅ Progress Bar
- ✅ Sidebar mit Image Pool
- ✅ Settings Modal (alle 4 Tabs funktional)
- ✅ Help Modal
- ✅ Toast Notifications

### Server-Änderungen
- ✅ `broadcastBeamerStatus()` in `sockets/index.js`
- ✅ `wasInBeamerRoom` Flag für Disconnect-Tracking
- ✅ Beamer-Status Broadcast bei Connect/Disconnect

---

## 🔴 OFFEN (Sprint 3: Polish)

### ~~TODO-001: Context Menu - clear-role Aktion~~ ✅ ERLEDIGT
**Datei:** `client/admin-new.html` + `client/js/admin/main.js`  
**Umsetzung:** Button hinzugefügt, `clearImageRole()` Funktion implementiert, dynamische Anzeige bei Start/End-Bildern

### TODO-002: API Endpoint reset-played fehlt
**Datei:** `client/js/admin/main.js`  
**Priorität:** Niedrig  
**Beschreibung:** `/api/game-images/reset-played` wird nicht genutzt  
**Anmerkung:** Könnte über Soft-Reset abgedeckt sein - prüfen ob separate Funktion benötigt

### TODO-003: set_join_host Socket Event fehlt
**Datei:** `client/js/admin/main.js`  
**Priorität:** Niedrig  
**Beschreibung:** `admin:set_join_host` wird nicht aufgerufen  
**Anmerkung:** Server setzt automatisch Host aus Headers - ggf. nicht nötig

### ~~TODO-004: Keyboard-Shortcuts erweitern~~ ✅ ERLEDIGT
**Datei:** `client/js/admin/main.js`  
**Umsetzung:** Erweitert um B (Beamer), S (Settings), H (Help), C (Clear Spotlights), Escape (schließt alles)

### TODO-005: State-Management konsolidieren
**Dateien:** `client/js/admin/main.js`, `client/js/admin/state.js`  
**Priorität:** Niedrig (Refactoring)  
**Beschreibung:** 
- `state.js` existiert mit modularem Design (Selectors, Actions)
- `main.js` verwendet inline State-Objekt
- **Entscheidung treffen:** Entweder `state.js` integrieren ODER löschen

### TODO-006: Ungenutzte JS-Module aufräumen
**Dateien:** `client/js/admin/` Verzeichnis  
**Priorität:** Niedrig (Cleanup)  
**Beschreibung:** Folgende Module werden nicht importiert:
- `state.js` - Nicht verwendet
- `modals.js` - Funktionen in main.js inline
- `sidebar.js` - Teilweise verwendet für Upload
- `keyboard.js` - Funktionen in main.js inline
- `toast.js` - Funktionen in main.js inline
- `ui-controller.js` - Nicht verwendet

### TODO-007: Admin Session Badge UI fehlt
**Datei:** `client/admin-new.html` + `client/js/admin/main.js`  
**Priorität:** Niedrig  
**Beschreibung:** Toast-Warnung existiert, aber kein persistentes Badge im Header  
**Umsetzung (optional):**
1. HTML: Badge-Element im Header hinzufügen
2. JS: Bei `admin:session_count > 1` Badge anzeigen

### TODO-008: Datei-Umbenennung (Final Cleanup)
**Priorität:** Erst nach vollständigem Test  
**Beschreibung:**
1. `admin.html` → `admin-backup.html`
2. `admin-new.html` → `admin.html`
3. Ggf. `js/admin.js` → `js/admin-backup.js`

---

## 🧪 Test-Checkliste

### Smoke Tests (vor Go-Live)
- [ ] Seite lädt ohne Console-Errors
- [ ] Socket-Verbindung wird hergestellt
- [ ] Initial State lädt korrekt
- [ ] Bilder-Upload funktioniert
- [ ] Spielablauf: Start → Aufdecken → Nächstes → Ende
- [ ] QR-Toggle funktioniert (Button + Taste Q)

### Integration Tests
- [ ] Spotlight wird auf Beamer synchronisiert
- [ ] Leaderboard aktualisiert bei Punkteänderung
- [ ] Multi-Admin Warnung bei 2. Session
- [ ] PIN-Schutz aktivieren/deaktivieren/Timer
- [ ] Beamer-Status zeigt connected/disconnected

### Settings Tests
- [ ] Wörterliste laden & speichern
- [ ] Scoring-Settings laden & speichern
- [ ] PIN ändern
- [ ] Soft Reset
- [ ] Complete Reset
- [ ] Factory Reset (mit Bestätigung)

---

## 📁 Aktuelle Dateistruktur

```
client/
├── admin.html              # Alt (Fallback)
├── admin-new.html          # Neu (aktiv in Entwicklung)
├── css/
│   ├── admin.css           # Alt
│   ├── admin-new.css       # Neu (importiert Module)
│   └── admin/              # CSS Module (13 Dateien)
└── js/
    ├── admin.js            # Alt (Fallback)
    ├── admin/
    │   ├── main.js         # Neu (Haupt-Entry)
    │   ├── state.js        # Ungenutzt
    │   ├── modals.js       # Ungenutzt
    │   ├── sidebar.js      # Teilweise genutzt
    │   ├── keyboard.js     # Ungenutzt
    │   ├── toast.js        # Ungenutzt
    │   └── ui-controller.js # Ungenutzt
    ├── socket-adapter.js   # Shared
    └── spotlight-renderer.js # Shared
```

---

## 📋 Quick Reference: Offene TODOs

| ID | Beschreibung | Priorität |
|----|--------------|-----------|
| ~~TODO-001~~ | ~~Context Menu clear-role~~ | ✅ Erledigt |
| TODO-002 | API reset-played | Niedrig |
| TODO-003 | set_join_host Socket | Niedrig |
| ~~TODO-004~~ | ~~Keyboard-Shortcuts erweitern~~ | ✅ Erledigt |
| TODO-005 | State-Management konsolidieren | Niedrig |
| TODO-006 | Ungenutzte Module aufräumen | Niedrig |
| TODO-007 | Admin Session Badge | Niedrig |
| TODO-008 | Datei-Umbenennung | Nach Test |

---

## 📜 Changelog

### V2.1 (2025-12-04)
- ✅ TODO-001: Context Menu clear-role implementiert
- ✅ TODO-004: Keyboard-Shortcuts erweitert (B, S, H, C, Escape)

### V2 (2025-12-04)
- Sprint 1 & 2 als ABGESCHLOSSEN dokumentiert
- Detaillierte TODO-Liste mit IDs erstellt
- Test-Checkliste hinzugefügt
- Quick Reference Tabelle hinzugefügt
- Aktuelle Dateistruktur dokumentiert

### V1 (2025-12-04)
- Initiale Analyse erstellt
- Socket/API/UI Gap-Analysis durchgeführt
- 5 Phasen-Plan definiert

---

**Stand: Sprint 1 & 2 abgeschlossen, Sprint 3 (Polish) offen** 🚀
