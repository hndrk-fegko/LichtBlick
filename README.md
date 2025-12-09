# 🔦 LichtBlick

> **Interaktives Multiplayer-Ratespiel für kirchliche Veranstaltungen**  
> Moderator enthüllt Bilder schrittweise mit Spotlight, Spieler raten via Smartphone

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20%7C%20Known%20Bugs-orange)]()

---

## 📖 Über das Projekt

**LichtBlick** ist ein interaktives Ratespiel für große Gruppen (30-150 Personen), ideal für Familiengottesdienste, Weihnachtsfeiern oder Gemeindefeste.

> **⚠️ MySQL Migration in Progress:**  
> Das Projekt wird gerade von SQLite auf MySQL/MariaDB umgestellt für bessere Kompatibilität mit Plesk Shared Hosting. Die Datenbank-Infrastruktur ist fertig, die Anwendungs-Code-Konvertierung läuft noch. Siehe [MYSQL_MIGRATION_STATUS.md](MYSQL_MIGRATION_STATUS.md) für Details.

### 🎯 Spielprinzip

1. **Moderator** (Admin) wählt ein verdecktes Bild aus
2. Mit einem **Spotlight** wird das Bild schrittweise enthüllt
3. **Kinder** rufen ihre Vermutungen laut
4. **Erwachsene** spielen parallel auf ihren Smartphones und sammeln Punkte
5. **Beamer** zeigt alles synchron für die gesamte Gruppe

### ✨ Hauptfeatures

- 🎮 **Echtzeit-Synchronisation** - Admin, Beamer und alle Spieler sehen dasselbe
- 📱 **Mobile-First** - Spieler nutzen ihre eigenen Smartphones (kein Login nötig)
- 🔒 **Offline-fähig** - Funktioniert im lokalen WLAN ohne Internet
- 🏆 **Live-Leaderboard** - Punktesystem mit Boni und Bestenliste
- 🎨 **Spotlight-Mechanik** - Canvas-basierte interaktive Bildaufdeckung
- ⚡ **WebSocket-basiert** - Keine Verzögerung, keine Lags

---

## 🚀 Quick Start

### Voraussetzungen

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **MySQL/MariaDB** >= 5.7 (für MySQL-Version) oder SQLite (Legacy)
- Moderner Browser (Chrome, Firefox, Edge, Safari)
- Lokales WLAN-Netzwerk (oder Plesk Shared Hosting)

### Installation

#### Option 1: MySQL/MariaDB (Für Plesk Shared Hosting)

```bash
# 1. Repository klonen
git clone https://github.com/hndrk-fegko/LichtBlick.git
cd LichtBlick

# 2. MySQL-Datenbank erstellen
mysql -u root -p
CREATE DATABASE lichtblick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit

# 3. Dependencies installieren
cd server
npm install

# 4. Environment konfigurieren
cp .env.example .env
# Bearbeite .env und setze MySQL-Zugangsdaten:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=your_user
# DB_PASSWORD=your_password
# DB_NAME=lichtblick

# 5. Server starten
npm start
```

#### Option 2: SQLite (Legacy, nur für lokale Entwicklung)

> **Hinweis:** SQLite funktioniert NICHT auf Plesk Shared Hosting wegen benötigter nativer Kompilierung.

```bash
# Für SQLite-Version siehe Branch 'main' vor MySQL-Migration
git checkout <commit-vor-migration>
cd server
npm install
npm start
```

**Server läuft auf:** `http://localhost:3000`

### Erster Start

1. **Admin-Token** wird beim ersten Start generiert und in der Konsole angezeigt:
   ```
   🔐 FIRST RUN - Admin Token generiert!
   ═══════════════════════════════════════════════════════════
   Admin-URL: http://localhost:3000/admin.html?token=AbC123XyZ...
   ═══════════════════════════════════════════════════════════
   ```
   
2. **Admin-Zugang öffnen** → Bilder hochladen & Einstellungen anpassen

3. **Beamer öffnen** → `http://localhost:3000/beamer.html` (automatische Sync)

4. **Spieler beitreten lassen** → QR-Code scannen oder `http://localhost:3000` öffnen

---

## 📁 Projekt-Struktur

```
lichtblick/
├── client/                    # Frontend (Vanilla JS + HTML5 Canvas)
│   ├── admin.html            # Admin-Interface (Moderator)
│   ├── beamer.html           # Beamer-Display (Projektion)
│   ├── player.html           # Spieler-Interface (Smartphone)
│   ├── css/                  # Modular aufgebautes CSS
│   │   └── admin/            # Admin-UI Module (13 Dateien)
│   └── js/                   # Modular aufgebautes JavaScript
│       └── admin/            # Admin-Logik Module (7 Dateien)
├── server/                    # Backend (Node.js + Express + Socket.IO)
│   ├── index.js              # Server Entry Point
│   ├── db/                   # SQLite Database + Schema
│   ├── routes/               # REST API Endpoints
│   ├── sockets/              # WebSocket Event Handlers
│   ├── services/             # Business Logic (Scoring, etc.)
│   └── utils/                # Helpers (Logger, Validation, etc.)
├── scripts/                   # Build & Test Scripts
│   ├── test-security.ps1     # Security Tests
│   └── start-dev.ps1         # Development Server
├── data/                      # Runtime Data (Git-Ignored)
│   ├── uploads/              # Hochgeladene Bilder
│   └── lichtblick.db         # SQLite Database
├── docs/                      # Umfangreiche Dokumentation
│   ├── VISION.md             # Projektvision & Ziele
│   ├── ARCHITECTURE.md       # System-Design
│   ├── API_CONTRACT.md       # REST + WebSocket API
│   ├── GAME_MECHANICS.md     # Spiellogik & Punktesystem
│   ├── DATABASE_SCHEMA.md    # Datenbankstruktur
│   ├── ANDOCK_PLAN.md        # Aktueller Implementierungsplan
│   └── archive/              # Archivierte Versionen
├── tests/                     # Playwright E2E Tests
│   └── playwright.config.js  # Test-Konfiguration
└── README.md                  # Diese Datei
```

---

## 🎮 Verwendung

### Admin (Moderator)

**Zugang:** `http://localhost:3000/admin.html?token=DEIN_TOKEN`

1. **Vorbereitung:**
   - Bilder hochladen (Drag & Drop oder Click)
   - Start- und End-Bild festlegen
   - Spielbilder sortieren (Drag & Drop)
   - Einstellungen anpassen (Settings-Modal)

2. **Während des Spiels:**
   - Beamer öffnen (Button → öffnet neues Fenster)
   - QR-Code anzeigen für Spieler-Beitritt
   - Bild auswählen → Wird auf Beamer synchronisiert
   - Mit Maus Spotlight bewegen → Bild enthüllen
   - Spieler-Antworten live sehen (Leaderboard)
   - Nächstes Bild mit `Space` oder Arrow-Keys

3. **Keyboard-Shortcuts:**
   - `Space` - Nächstes ungespieltes Bild
   - `←` / `→` - Vorheriges / Nächstes Bild
   - `F` - Fullscreen (Beamer)
   - `?` - Hilfe anzeigen

### Beamer (Projektion)

**Zugang:** `http://localhost:3000/beamer.html`

- Automatische Synchronisation mit Admin
- Zeigt aktuelles Bild mit Spotlight-Overlay
- Leaderboard (Top 10)
- QR-Code für Spieler-Beitritt
- Keine manuelle Steuerung nötig

### Spieler (Smartphone)

**Zugang:** QR-Code scannen oder `http://localhost:3000`

1. Namen eingeben (2-20 Zeichen)
2. Wortliste durchsuchen oder Begriff tippen
3. Antwort absenden → Instant-Feedback (✅/❌ + Punkte)
4. Leaderboard & eigene Position sehen

---

## 🔧 Konfiguration

### Environment-Variablen (`.env`)

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Logging
LOG_LEVEL=info

# Datenbankpfad
DB_PATH=../data/lichtblick.db

# Upload-Limits
MAX_FILE_SIZE=10485760
MAX_FILES=50
```

### Settings (Admin-UI)

- **Punktesystem:** Basis-Punkte, Speed-Bonus, Strafen
- **Spotlight:** Radius, Auto-Vergrößerung
- **Game-Flow:** Start-/End-Bild automatisch zeigen
- **Dark Mode:** An/Aus

---

## 📊 Status & Bekannte Probleme

**Aktueller Stand:** Beta (v3.0) - Feature-Complete, aber bekannte Bugs

### ✅ Was funktioniert (61% Test-Success-Rate)

- Backend komplett (REST API, WebSockets, Datenbank)
- Bilder hochladen, löschen, sortieren
- Context-Menu (Rechtsklick)
- Game Strip & Spielsteuerung
- Leaderboard & Toast-Notifications
- Keyboard-Shortcuts
- Multi-Admin Session Detection

### 🔴 Bekannte kritische Bugs

1. **Spotlight Canvas** funktioniert nicht (kein Cursor-Tracking)
2. **PIN-Schutz UI** nicht sichtbar/styled
3. **Drag & Drop Upload** funktioniert nicht (nur Click-Upload)
4. **Auth-Modal** nicht styled (erscheint als Text)
5. **QR-Toggle** sendet immer `false`

👉 **Details:** Siehe [`docs/ANDOCK_PLAN.md`](docs/ANDOCK_PLAN.md) für vollständige Bug-Liste

### 🚧 Nächste Schritte

- Bug-Fix Phase (V4.1)
- Spotlight Canvas reparieren
- UI-Bugs beheben
- Erneute Test-Phase (Ziel: >90% Success)

---

## 📚 Dokumentation

Ausführliche Dokumentation in [`docs/`](docs/):

| Datei | Beschreibung |
|-------|--------------|
| [VISION.md](docs/VISION.md) | Projektvision & Ziele |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System-Design & Komponenten |
| [API_CONTRACT.md](docs/API_CONTRACT.md) | REST + WebSocket API Spezifikation |
| [GAME_MECHANICS.md](docs/GAME_MECHANICS.md) | Spiellogik & Punktesystem |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | SQLite Datenbankstruktur |
| [DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) | Deployment & Markenname-Ersetzung |
| [ANDOCK_PLAN.md](docs/ANDOCK_PLAN.md) | Aktueller Implementierungsplan & Bug-Tracking |
| [RESET_MANAGEMENT.md](docs/RESET_MANAGEMENT.md) | Reset- und Neustart-Funktionalität |
| [BEAMER_ANALYSIS.md](docs/BEAMER_ANALYSIS.md) | Beamer-Display Analyse und Optimierungen |

---

## 🛠️ Entwicklung

### Dev-Server starten (Auto-Restart)

```bash
cd server
npm run dev
```

Verwendet Nodemon für automatischen Neustart bei Dateiänderungen.

### Tests

```bash
cd server
npm test
```

### Logs

Logs werden in `server/logs/` gespeichert:
- `combined.log` - Alle Logs
- `error.log` - Nur Fehler
- Konsole - Live-Output während Entwicklung

---

## 🤝 Contributing

Beiträge sind willkommen! Bitte beachte:

1. **Fork** das Repository
2. **Branch** erstellen (`git checkout -b feature/AmazingFeature`)
3. **Commit** (`git commit -m 'Add AmazingFeature'`)
4. **Push** (`git push origin feature/AmazingFeature`)
5. **Pull Request** öffnen

### Bekannte Baustellen (siehe Issues)

- [ ] Spotlight Canvas Bug beheben
- [ ] PIN-Schutz UI implementieren
- [ ] Drag & Drop Upload fixen
- [ ] Game Strip Scroll-Buttons (>10 Bilder)
- [ ] Progress Bar anzeigen

---

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE)

---

## 👥 Autoren

**FeG Nahude - Diakonat Junge Generation**

Entwickelt für Familiengottesdienste und kirchliche Veranstaltungen.

---

## 🙏 Danksagungen


- Gebaut für die Kinder und Familien der FeG Koblenz
- Erstmals eingesetzt: Weihnachtsgottesdienst 2025

---

## 📞 Support & Kontakt

- **Issues:** [GitHub Issues](https://github.com/hndrk-fegko/LichtBlick/issues)
- **Dokumentation:** [docs/](docs/)
- **E-Mail:** [Kontakt zur FeG Nahude]

---

**Made with ❤️ for families and communities**
