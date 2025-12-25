# 🔦 LichtBlick

> **Interaktives Multiplayer-Ratespiel für (kirchliche) Veranstaltungen**  
> Moderator enthüllt Bilder schrittweise mit Spotlight, Spieler raten via Smartphone

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20%7C%20Known%20Bugs-orange)]()

---

## 📖 Über das Projekt

**LichtBlick** ist ein interaktives Ratespiel für große Gruppen (30-150 Personen), ideal für Familiengottesdienste, Weihnachtsfeiern oder Gemeindefeste.

### 🎯 Spielprinzip

1. **Moderator** (Admin) wählt ein verdecktes Bild aus
2. Mit einem **Spotlight** wird das Bild schrittweise enthüllt
3. **Kinder** rufen ihre Vermutungen laut
4. **Erwachsene** spielen parallel auf ihren Smartphones und sammeln Punkte
5. **Beamer** zeigt alles synchron für die gesamte Gruppe

Tipp: die Arbeit der Moderation wird am besten auf zwei Personen verteilt - einer bedient die Technik und einer konzentriert sich voll auf die Teilnehmenden Personen 

### ✨ Hauptfeatures

- 🎮 **Echtzeit-Synchronisation** - Admin, Beamer und alle Spieler sehen dasselbe
- 📱 **Mobile-First** - Spieler nutzen ihre eigenen Smartphones 
- 🔒 **Offline-fähig** - Funktioniert im lokalen WLAN ohne Internet (node.js auf Laptop oder Rechner ausführen,bringt SQLite DB nativ mit. Keine weitere Konfiguration benötigt) 
- 🌐 **Webhosting** - unterstützt Verbindung zu einer MySQL Datenbank und ist getestet in einem plesk Webhosting mit node.js
- 🏆 **Live-Leaderboard** - Punktesystem mit Boni und Bestenliste
- 🎨 **Spotlight-Mechanik** - Canvas-basierte interaktive Bildaufdeckung
- ⚡ **WebSocket-basiert** - Keine Verzögerung, keine Lags

---

## 🚀 Quick Start

### Voraussetzungen

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- Moderner Browser (Chrome, Firefox, Edge, Safari)
- Lokales WLAN-Netzwerk

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/hndrk-fegko/LichtBlick.git
cd LichtBlick

# 2. Dependencies installieren
cd server
npm install

# 3. Environment konfigurieren
cp .env.example .env
# Optional: Anpassen (PORT, LOG_LEVEL, etc.)

# 4. Server starten
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
3. Antwort absenden → Feedback am Ende der Runde (✅/❌ + Punkte)
4. Leaderboard & eigene Position sehen

---

## 🔧 Konfiguration

### Datenbank-Konfiguration

LichtBlick unterstützt **SQLite** (Standard) und **MySQL/MariaDB** über eine einheitliche Abstraktionsschicht.

#### SQLite (Standard - Empfohlen für lokale Entwicklung)

```env
# Keine spezielle Konfiguration nötig
# DB_TYPE wird automatisch auf sqlite gesetzt
DB_PATH=../data/lichtblick.db
```

**Vorteile:**
- ✅ Keine zusätzliche Server-Installation nötig
- ✅ Perfekt für lokale Entwicklung
- ✅ Sehr schnell für kleine bis mittlere Datenmengen
- ✅ Zero-Config

#### MySQL/MariaDB (Empfohlen für Produktions-Deployment)

```env
# Option 1: Explizit setzen
DB_TYPE=mysql

# Option 2: Automatisch via DB_HOST
DB_HOST=localhost      # Wenn gesetzt, wird MySQL automatisch verwendet
DB_PORT=3306
DB_USER=lichtblick
DB_PASSWORD=dein_passwort
DB_NAME=lichtblick
```

**Vorteile:**
- ✅ Bessere Performance bei vielen gleichzeitigen Zugriffen
- ✅ Geeignet für Shared-Hosting-Umgebungen
- ✅ Standard bei den meisten Web-Hostern

**Datenbank erstellen:**
```sql
CREATE DATABASE lichtblick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lichtblick'@'localhost' IDENTIFIED BY 'dein_passwort';
GRANT ALL PRIVILEGES ON lichtblick.* TO 'lichtblick'@'localhost';
FLUSH PRIVILEGES;
```

#### DB_TYPE=none (Nur für npm install auf Shared Hosting)

```env
DB_TYPE=none
```

⚠️ **Achtung:** In diesem Modus wird **keine Datenbank** geladen. Die Anwendung ist **nicht funktionsfähig**!

**Verwendungszweck:** Auf Shared-Hosting-Umgebungen (z.B. Plesk, cPanel) kann `better-sqlite3` nicht kompiliert werden, da `node-gyp` fehlt. Setze `DB_TYPE=none` **nur** für `npm install`, und wechsle danach zu `DB_TYPE=mysql`:

```bash
# Auf Shared Hosting (Plesk/cPanel):
export DB_TYPE=none
npm install                # Installiert Dependencies OHNE better-sqlite3
export DB_TYPE=mysql       # Oder setze in .env Datei
npm start                  # Startet mit MySQL
```

**📋 Vollständige Plesk-Installation:** Siehe [Deployment auf Plesk](#-deployment-auf-plesk-shared-hosting)

#### Automatische Backend-Auswahl

Die Datenbank-Backend-Auswahl erfolgt automatisch nach folgender Logik:

1. `DB_TYPE=none` → Keine Datenbank (nur für npm install)
2. `DB_TYPE=mysql` **ODER** `DB_HOST` ist gesetzt → MySQL
3. Sonst → SQLite (Standard-Fallback)

### Environment-Variablen (`.env`)

```env
# Server
PORT=3000
NODE_ENV=production

# Database (siehe oben für Details)
DB_TYPE=              # optional: mysql, sqlite, none
DB_PATH=../data/lichtblick.db  # Nur für SQLite
DB_HOST=              # Wenn gesetzt, wird MySQL verwendet
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=lichtblick

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=../logs

# Security
ADMIN_PIN=1234

# Upload-Limits
UPLOAD_DIR=../data/uploads
MAX_FILE_SIZE=10485760

# CORS
CORS_ORIGIN=*
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

## 🚀 Deployment auf Plesk Shared Hosting

### Voraussetzungen

- Plesk-Zugang mit SSH (oder Terminal in Plesk)
- MySQL-Datenbank verfügbar
- Node.js 20+ installiert (via Node.js Extension in Plesk)

### Schritt-für-Schritt Installation

#### 1. MySQL-Datenbank erstellen

In Plesk unter **Datenbanken**:
- Neue Datenbank erstellen (z.B. `lichtblick`)
- Benutzer mit Passwort erstellen
- Notiere: Host, Port (meist 3306), User, Passwort, DB-Name

#### 2. Repository hochladen

```bash
# Via SSH oder Plesk File Manager
cd /var/www/vhosts/deine-domain.de/httpdocs
git clone https://github.com/hndrk-fegko/LichtBlick.git lichtblick
cd lichtblick
```

#### 3. Dependencies installieren (MIT DB_TYPE=none!)

⚠️ **Wichtig:** `better-sqlite3` kann auf Shared Hosting nicht kompiliert werden!

```bash
cd server

# WICHTIG: DB_TYPE=none setzen für npm install
export DB_TYPE=none
npm install

# Sollte ohne Fehler durchlaufen
```

#### 4. .env Datei erstellen

```bash
cp .env.example .env
nano .env
```

**Inhalt anpassen:**
```env
PORT=3000
NODE_ENV=production

# MySQL-Datenbank verwenden!
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=dein_mysql_user
DB_PASSWORD=dein_mysql_passwort
DB_NAME=lichtblick

LOG_LEVEL=info
LOG_FILE_PATH=../logs

ADMIN_PIN=1234

UPLOAD_DIR=../data/uploads
MAX_FILE_SIZE=10485760

CORS_ORIGIN=*
```

#### 5. Verzeichnisse erstellen

```bash
cd ..  # Zurück ins Hauptverzeichnis
mkdir -p data/uploads logs
chmod 755 data/uploads logs
```

#### 6. Server starten

```bash
cd server
npm start
```

#### 7. Node.js App in Plesk konfigurieren

In Plesk unter **Node.js**:
- **Application Mode:** Production
- **Application Root:** `/var/www/vhosts/deine-domain.de/httpdocs/lichtblick`
- **Application Startup File:** `server/index.js`
- **Environment Variables:** Aus `.env` übernehmen
- **NPM install:** NICHT ausführen (bereits mit DB_TYPE=none installiert)

### Troubleshooting

**Problem:** `npm install` schlägt fehl mit `error code 127` (better-sqlite3)
- **Lösung:** `export DB_TYPE=none` VOR `npm install` setzen

**Problem:** Server startet nicht (DB-Fehler)
- **Lösung:** In `.env` prüfen: `DB_TYPE=mysql` und korrekte MySQL-Credentials

**Problem:** "nodenv: node: command not found"
- **Lösung:** Node.js Extension in Plesk aktivieren, Version 20+ wählen

**Problem:** Bilder können nicht hochgeladen werden
- **Lösung:** `chmod 755 data/uploads` und Besitzer auf Plesk-User setzen

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

- [ ] Drag & Drop Upload fixen (Bilder werden verschoben, nicht kopiert)
- [ ] Plesk install ist nicht sauber (postinstall script wird noch benötigt)
- [ ] Reload eines Players zu einem ungünstigen Zeitpunkt fällt aus dem aktuellen GameState raus, Logik und LateJoin muss überprüft werden.


---

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE)

---

## 👥 Autoren

**FeG Koblenz - Diakonat Junge Generation**
Hendrik Dreis 

Entwickelt für Familiengottesdienste und kirchliche Veranstaltungen.

---

## 🙏 Danksagungen


- Gebaut für die Kinder und Familien der FeG Koblenz
- Erstmals eingesetzt: Weihnachtsgottesdienst 2025

---

## 📞 Support & Kontakt

- **Issues:** [GitHub Issues](https://github.com/hndrk-fegko/LichtBlick/issues)
- **Dokumentation:** [docs/](docs/)
- **E-Mail:** hendrik.dreis@feg-koblenz.de 

---

**Made with ❤️ for families and communities**
