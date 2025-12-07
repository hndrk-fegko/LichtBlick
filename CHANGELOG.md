# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Bekannte Bugs (in Arbeit)
- Spotlight Canvas funktioniert nicht (Bug-001)
- PIN-Schutz UI nicht sichtbar (Bug-002)
- Drag & Drop Upload funktioniert nicht (Bug-003)
- Auth-Modal nicht styled (Bug-004)
- QR-Toggle sendet immer false (Bug-005)

Siehe [`docs/ANDOCK_PLAN_V4.md`](docs/ANDOCK_PLAN_V4.md) für vollständige Bug-Liste.

## [3.0.0] - 2025-12-07

### 🎉 Initial GitHub Release - LichtBlick v3.0

**Status:** Beta - Feature-Complete, aber bekannte Bugs (61% Test-Success-Rate)

### Added (Neu)

#### Backend
- ✅ Node.js + Express + Socket.IO Server
- ✅ SQLite Datenbank mit better-sqlite3
- ✅ REST API für Admin-Funktionen (Upload, Delete, Settings)
- ✅ WebSocket-basierte Echtzeit-Kommunikation
- ✅ Admin-Token Authentifizierung (URL-basiert)
- ✅ Image-Sync (Filesystem ↔ Database)
- ✅ Logging mit Winston
- ✅ Scoring-Service (Punktesystem)
- ✅ File-Upload mit Multer (max 10MB, 50 Bilder)
- ✅ Input-Validation

#### Admin UI
- ✅ Komplettes UI-Redesign (modular)
- ✅ 13 CSS-Module (Variables, Layout, Header, Canvas, etc.)
- ✅ 7 JavaScript-Module (State, Toast, Modals, Keyboard, etc.)
- ✅ Drag & Drop Bild-Sortierung
- ✅ Context-Menu (Rechtsklick auf Bilder)
- ✅ Keyboard-Shortcuts (Space, Arrow Keys, F, ?)
- ✅ Toast-Notifications System
- ✅ Settings-Modal (3 Tabs)
- ✅ Danger-Modal (Factory Reset)
- ✅ Multi-Admin Session Detection
- ✅ Responsive Design (Mobile-kompatibel)

#### Beamer Display
- ✅ Automatische Admin-Synchronisation
- ✅ Spotlight-Overlay (Canvas-basiert)
- ✅ Leaderboard (Top 10)
- ✅ QR-Code für Spieler-Beitritt
- ✅ Fullscreen-Modus

#### Player Interface
- ✅ Mobile-optimiert (Smartphone)
- ✅ QR-Code Login (kein Account nötig)
- ✅ Wortliste mit Kategorien (300+ Begriffe)
- ✅ Instant-Feedback (✅/❌ + Punkte)
- ✅ Leaderboard & eigene Position
- ✅ Session-Persistenz

#### Dokumentation
- ✅ 14 ausführliche Markdown-Dokumente
- ✅ VISION.md - Projektvision & Ziele
- ✅ ARCHITECTURE.md - System-Design
- ✅ API_CONTRACT.md - REST + WebSocket API
- ✅ GAME_MECHANICS.md - Spiellogik & Punktesystem
- ✅ DATABASE_SCHEMA.md - SQLite Schema
- ✅ DEPLOYMENT_CHECKLIST.md - Deployment-Guide
- ✅ ANDOCK_PLAN_V4.md - Test-Ergebnisse & Bugs

#### DevOps
- ✅ Security Penetration Test Script
- ✅ Nodemon Dev-Setup
- ✅ .env Configuration
- ✅ Logging (combined.log, error.log)

### Known Issues (Bekannte Probleme)

#### 🔴 Kritisch (5)
1. Spotlight Canvas funktioniert nicht
2. PIN-Schutz UI nicht funktional
3. Drag & Drop Upload funktioniert nicht
4. Auth-Modal nicht styled
5. QR-Toggle sendet ständig false

#### 🟡 Wichtig (10)
- Start/End-Bild kann Duplikat sein
- Start/End-Bild darf im Spiel sein
- Context-Menu Render-Lag
- Spotlight-Overlay Refresh-Problem
- Ausgewähltes Bild nicht neugesetzt nach Löschen
- Arrow Keys navigieren zu gespielten Bildern
- Aktives Bild kann gelöscht werden
- Progress Bar nicht sichtbar
- Game Strip Scroll-Buttons fehlen
- Multi-Admin Toast doppelt

### Test-Ergebnisse
- **73 von 120 Tests bestanden (61%)**
- **17 kritische/wichtige Fehler**
- **27 Verbesserungen identifiziert**

### Technical Debt
- TypeScript-Migration geplant für v4.0
- Unit-Tests fehlen (nur manuelle Tests)
- WebSocket Rate-Limiting fehlt

---

## Versionsgeschichte (vor GitHub)

### [2.x] - Legacy (nicht veröffentlicht)
- PHP + MySQL + jQuery
- Monolithische Struktur
- Keine WebSockets (Polling)
- Performance-Probleme bei >50 Spielern

### [1.x] - Prototyp (2024)
- Erster Einsatz: Weihnachtsgottesdienst 2024
- Proof of Concept
- Hard-coded Bilder

---

## Geplante Releases

### [4.0.0] - Production-Ready (Q1 2026)
- [ ] Alle kritischen Bugs behoben
- [ ] >90% Test-Success-Rate
- [ ] Unit-Tests implementiert
- [ ] Performance-Optimierungen
- [ ] Docker-Support

### [4.1.0] - Bug-Fix Phase (Dezember 2025)
- [ ] Bug-001 bis Bug-005 behoben
- [ ] Game Strip Scroll-Buttons
- [ ] Progress Bar Implementation
- [ ] Erneute Test-Phase

---

[Unreleased]: https://github.com/your-username/lichtblick/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/your-username/lichtblick/releases/tag/v3.0.0
