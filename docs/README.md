# LichtBlick v3.0 - Documentation

**Status:** 🚀 **PRODUCTION READY SPECIFICATION** (MySQL Migration in Progress)  
**Datum:** 27. November 2025 (Updated: December 2025)  
**Zweck:** Komplette Neuentwicklung mit Node.js + WebSockets + MySQL/MariaDB

---

## ⚠️ MySQL Migration (December 2025)

Das Projekt wird aktuell von SQLite auf MySQL/MariaDB umgestellt für bessere Kompatibilität mit Plesk Shared Hosting.

**Migrationsstand:**
- ✅ Datenbank-Infrastruktur: ABGESCHLOSSEN
- ⏳ Anwendungs-Code: IN ARBEIT
- 📖 Siehe: [../MYSQL_IMPLEMENTATION_SUMMARY.md](../MYSQL_IMPLEMENTATION_SUMMARY.md)

---

## 📋 Übersicht

Dieses Verzeichnis enthält die **vollständige technische Spezifikation** für einen Clean-Slate Rewrite der LichtBlick Multiplayer-Anwendung. Alle Dokumente sind so konzipiert, dass sie als **Single Source of Truth (SSOT)** für ein neues Projekt in einem frischen Codespace dienen können.

### ✨ Was ist LichtBlick?

Ein interaktives Ratespiel für große Gruppen (80-150 Personen), bei dem ein Moderator Bilder schrittweise mit einem Spotlight enthüllt. Spieler raten via Smartphone, Kinder rufen laut ihre Antworten, während alle auf einem Beamer die Enthüllung verfolgen.

**Einsatz:** Kirchliche Veranstaltungen (Weihnachten, Ostern, Familiengottesdienste)  
**Zielgruppe:** Familien mit Kindern (6-12 Jahre) + Erwachsene  
**Teilnehmerzahl:** 30-150 gleichzeitige Spieler

---

## 📚 Dokumentenstruktur

Alle Dokumente sind **in sich geschlossen** und können einzeln gelesen werden. Die empfohlene Lesereihenfolge ist:

### 1. **[VISION.md](./VISION.md)** 🎯
**Was & Warum**  
- Projektvision und Ziele
- Zielgruppenanalyse (Kinder vs. Erwachsene)
- Hauptfunktionen (Admin, Beamer, Player)
- Problemstellung (v1.x Legacy-System)
- Business Value des Rewrites

**Lesen wenn:** Du verstehen willst, was wir bauen und warum.

---

### 2. **[USE_CASES.md](./USE_CASES.md)** 👥
**Wer & Wie**  
- Detaillierte User Stories (Admin, Beamer-Operator, Mobile Spieler, Kinder)
- Schritt-für-Schritt Spielablauf (15 Minuten Live-Event)
- Realistische Szenarien (Weihnachtsgottesdienst mit 80 Personen)
- Edge Cases und Fehlerszenarien

**Lesen wenn:** Du wissen willst, wie das System im echten Leben verwendet wird.

---

### 3. **[GAME_MECHANICS.md](./GAME_MECHANICS.md)** 🎮
**Spielregeln & Logik**  
- Vollständige Spielmechanik (Lobby → Spielen → Auswertung)
- Punktesystem-Algorithmus (Basis + Boni - Strafen)
- State Machine (Spielphasen und Übergänge)
- Spotlight-Mechanik (Radius, Auto-Vergrößerung)
- Leaderboard-Logik

**Lesen wenn:** Du die Business-Logik implementieren musst.

---

### 4. **[ARCHITECTURE.md](./ARCHITECTURE.md)** 🏗️
**System-Design**  
- Komponentenarchitektur (Frontend ↔ Backend ↔ Database)
- WebSocket-basierte Event-Driven Architektur
- Room-basiertes Broadcasting (Admin/Beamer/Players)
- Datenfluss-Diagramme
- Deployment-Modell (Offline/Local Network)

**Lesen wenn:** Du verstehen willst, wie alle Teile zusammenarbeiten.

---

### 5. **[TECH_STACK.md](./TECH_STACK.md)** ⚙️
**Technologie-Entscheidungen**  
- **Backend:** Node.js 20+, Express 4.x, Socket.IO 4.x
- **Database:** SQLite3 (better-sqlite3) mit WAL-Mode
- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas
- **Deployment:** Standalone Node.js Server (keine Cloud)
- Begründungen für jede Technologie
- Performance-Benchmarks

**Lesen wenn:** Du Dependencies installieren oder Deployment planen willst.

---

### 6. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** 🗄️
**Datenbankstruktur**  
- Vollständiges SQLite-Schema (6 Tabellen)
- Indexes und Performance-Optimierungen
- Constraints und Validierungen
- Config-Keys (JSON-serialisierte Settings)
- Migrations-Strategie

**Lesen wenn:** Du die Datenbank aufsetzen oder Queries schreiben willst.

---

### 7. **[API_CONTRACT.md](./API_CONTRACT.md)** 📡
**Schnittstellen-Spezifikation**  
- **REST Endpoints:** `GET /api/health`, `POST /api/images/upload`, etc.
- **WebSocket Events:** 30+ Events (Client ↔ Server)
- TypeScript Interfaces für alle Datenmodelle
- Error Handling (HTTP Codes, Socket.IO Errors)
- Request/Response Beispiele

**Lesen wenn:** Du Frontend oder Backend implementierst (Contract-First Development).

---

### 8. **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** 🗺️
**Implementierungsplan**  
- Phase 1: Backend Core (Express + Socket.IO + SQLite) - 3 Tage
- Phase 2: Socket Event Handlers (Admin/Beamer/Player) - 2 Tage
- Phase 3: Frontend Adapter (Socket.IO Integration) - 2 Tage
- Phase 4: Testing & Debugging (Multi-Device) - 2 Tage
- Effort-Schätzungen pro Komponente

**Lesen wenn:** Du das Projekt planen oder Aufgaben aufteilen willst.

---

### 9. **[COPILOT_INSTRUCTIONS.md](./COPILOT_INSTRUCTIONS.md)** 🤖
**KI-Assistenten Leitfaden**  
- Coding Conventions (camelCase, snake_case, kebab-case)
- Best Practices (Canvas Rendering, State Management)
- Debugging Workflows
- Testing Checklists
- Common Pitfalls und deren Lösungen

**Lesen wenn:** Du diesen Ordner in einen neuen Codespace kopierst (SSOT für GitHub Copilot).

---

### Weitere Dokumente

- **[ADMIN_UI_IMPLEMENTATION.md](./ADMIN_UI_IMPLEMENTATION.md)** - Aktuelle Admin-UI Implementierung
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Deployment und Markenname-Ersetzung
- **[RESET_MANAGEMENT.md](./RESET_MANAGEMENT.md)** - Reset- und Neustart-Funktionalität
- **[BEAMER_ANALYSIS.md](./BEAMER_ANALYSIS.md)** - Beamer-Display Analyse und Optimierungen
- **[canvas-verhalten.md](./canvas-verhalten.md)** - Canvas-spezifische Dokumentation

### Archivierte Dokumente

Ältere Versionen der Dokumentation wurden nach `docs/archive/` verschoben:
- ANDOCK_PLAN (V1-V4) - Frühere Planungsversionen
- ADMIN_UI_CONCEPT_V2 - Frühere UI-Konzepte
- ADMIN_UI_REDESIGN - Frühere UI-Redesign Pläne

---

## 🚀 Schnellstart für KI-Agenten

### Szenario: Neuer Codespace-Rewrite

1. **Kopiere diesen `/restart` Ordner** in einen frischen Workspace
2. **Lese `COPILOT_INSTRUCTIONS.md`** → Stelle als `.github/copilot-instructions.md` bereit
3. **Folge `IMPLEMENTATION_ROADMAP.md`** → Phase 1 → Phase 2 → Phase 3 → Phase 4
4. **Verwende `API_CONTRACT.md`** als Contract zwischen Frontend/Backend
5. **Referenziere `DATABASE_SCHEMA.md`** für alle DB-Operationen
6. **Prüfe `GAME_MECHANICS.md`** bei Business-Logik-Fragen

### Wichtige Prinzipien

✅ **Contract-First Development:** API Contract steht fest, Frontend/Backend unabhängig entwickelbar  
✅ **Keep Frontend UI:** HTML/CSS/Canvas bleiben unverändert (nur JS-Kommunikation ersetzen)  
✅ **Event-Driven:** Keine Polling-Logik mehr, alles über WebSocket Push  
✅ **Single Source of Truth:** SQLite Database, kein File-System Storage  
✅ **Offline-First:** Funktioniert ohne Internet (Local Network)

---

## 📊 Metriken & Erfolgs-Kriterien

### Performance-Ziele (v3.0)

| Metrik | Ziel | v1.x Baseline |
|--------|------|---------------|
| **Spotlight Latency** | < 50ms | 500-1000ms |
| **Leaderboard Update** | < 100ms | 2000ms (Polling) |
| **Player Join Time** | < 200ms | 3-5 Sekunden |
| **Concurrent Players** | 150+ | ~50 (Limit) |
| **API Response Time** | < 50ms (p95) | 50-200ms |
| **Database Write** | < 5ms | 10-30ms (JSON) |
| **Network Traffic** | -90% | 1200 req/min |
| **Server Load** | -80% | 6+ Polling Intervals |

### Funktionale Anforderungen

- [x] ✅ Admin kann Bilder hochladen und sortieren (Drag & Drop)
- [x] ✅ Beamer zeigt Bilder in Fullscreen mit Spotlight-Enthüllung
- [x] ✅ Spieler können via Smartphone beitreten und Antworten senden
- [x] ✅ Echtzeit-Leaderboard für alle Teilnehmer
- [x] ✅ Punktesystem mit Boni/Strafen (konfigurierbar)
- [x] ✅ QR-Code für einfachen Spieler-Beitritt
- [x] ✅ Dark Mode Support
- [x] ✅ PIN-geschützter Admin-Zugang
- [x] ✅ Multi-Device Synchronisation (0ms Latency)
- [x] ✅ Offline/Local Network Betrieb

---

## 🎓 Für Entwickler

### Technisches Skill-Level

**Benötigt:**
- ✅ JavaScript ES6+ (async/await, Promises, Modules)
- ✅ Node.js/Express Grundlagen
- ✅ Socket.IO Events (emit/on/broadcast)
- ✅ SQLite Queries (SELECT/INSERT/UPDATE mit Joins)
- ✅ HTML5 Canvas API (drawImage, globalCompositeOperation)

**Nice-to-Have:**
- TypeScript (nur für Type Hints in API Contract)
- HTTP/REST API Design
- Git/GitHub Workflows

### Geschätzte Entwicklungszeit

| Rolle | Effort | Voraussetzung |
|-------|--------|---------------|
| **Solo Full-Stack Dev** | 9-11 Tage | Kennt alle Technologien |
| **Junior Dev (mit Mentoring)** | 15-20 Tage | Lernt Node.js/Socket.IO on-the-fly |
| **3 Parallele KI-Agenten** | 4-5 Tage | Contract-First, unabhängige Implementierung |

---

## 📝 Namenskonventionen

Konsequent durch alle Dokumente und Code:

| Kontext | Convention | Beispiel |
|---------|-----------|----------|
| **Dateinamen** | `UPPER_SNAKE_CASE.md` | `API_CONTRACT.md` |
| **Ordner** | `kebab-case` | `restart/`, `server/db/` |
| **REST Endpoints** | `/api/resource_name` | `/api/images/upload` |
| **WebSocket Events** | `role:snake_case_action` | `admin:set_image` |
| **Database Tables** | `plural_snake_case` | `players`, `image_states` |
| **Database Columns** | `snake_case` | `correct_answer`, `socket_id` |
| **JS Functions** | `camelCase` | `loadCurrentImage()` |
| **JS Constants** | `UPPER_SNAKE_CASE` | `API_BASE_URL` |
| **CSS Classes** | `kebab-case` | `.pin-overlay`, `.game-screen` |
| **HTML IDs** | `kebab-case` | `#qr-modal`, `#leaderboard` |

---

## 🔄 Versions-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| **v3.0-spec** | 2025-11-27 | Clean Slate Dokumentation erstellt (Target Architecture) |
| v2.0-partial | 2025-11-20 | Migration zu Node.js begonnen (unvollständig, deprecated) |
| v1.x-legacy | 2024-12-24 | PHP/JSON Version (Production in Kirche) |

---

## 🆘 Support & Fragen

**Bei Unklarheiten:**
1. Lese das relevante Dokument oben vollständig
2. Prüfe `COPILOT_INSTRUCTIONS.md` für Best Practices
3. Suche in `USE_CASES.md` nach realistischen Beispielen
4. Referenziere `API_CONTRACT.md` für exakte Schnittstellen

**Dieses Dokumentenset ist:**
- ✅ **Vollständig:** Alle Informationen für Clean-Slate Rewrite
- ✅ **Konsistent:** Naming, Struktur, Format durchgehend einheitlich
- ✅ **Selbsterklärend:** Jedes Dokument in sich geschlossen
- ✅ **KI-freundlich:** Strukturiert für GitHub Copilot / Cursor AI

---

**🎯 Ziel:** Diese 9 Dokumente in einen neuen Codespace kopieren und ein KI-Team die Implementierung parallel durchführen lassen.

**Nächster Schritt:** Lies `VISION.md` um zu verstehen, was wir bauen. Dann folge der Lesereihenfolge oben.
