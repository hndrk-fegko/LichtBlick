# VISION - LichtBlick v3.0

**Status:** 🎯 **DEFINIERT**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 🌟 Projektvision

**LichtBlick** ist ein **interaktives Multiplayer-Ratespiel** für große kirchliche Veranstaltungen, bei dem Familien gemeinsam Bilder erraten, die schrittweise auf einer Leinwand enthüllt werden.

### Kernidee

> "Ein klassisches TV-Spielshow-Format (ähnlich 'Dalli Dalli') adaptiert für Live-Events mit 80-150 Teilnehmern – kombiniert mit moderner Smartphone-Interaktion und Echtzeit-Synchronisation."

---

## 🎯 Hauptziele

### 1. **Gemeinsames Erlebnis schaffen**
- Kinder rufen laut ihre Vermutungen
- Erwachsene spielen parallel auf Smartphones um Punkte
- Beamer-Display für alle sichtbar (zentrale Aufmerksamkeit)
- Moderator steuert das Tempo und die Stimmung

### 2. **Technische Exzellenz**
- **Echtzeit-Kommunikation:** 0ms Latenz für Spotlight-Zeichnung
- **Skalierbarkeit:** 150+ gleichzeitige Spieler ohne Performance-Probleme
- **Offline-Fähigkeit:** Funktioniert in Gemeindehäusern ohne Internet
- **Robustheit:** Keine Race Conditions, keine Daten-Verluste

### 3. **Einfache Bedienung**
- **Admin:** Bilder hochladen, Spotlight bewegen, Spiel steuern – intuitiv
- **Spieler:** QR-Code scannen, Name eingeben, Antwort wählen – 3 Schritte
- **Beamer:** Automatische Synchronisation, keine manuelle Konfiguration

---

## 👥 Zielgruppen

### Primäre Zielgruppe: **Familien mit Kindern (6-12 Jahre)**

#### Kontext: Kirchliche Familiengottesdienste
- **Anlass:** Weihnachten, Ostern, Erntedank, Sommerfeste
- **Teilnehmer:** 80-150 Personen (30-50 Familien)
- **Dauer:** 15-20 Minuten (Teil des Gottesdienstes)
- **Setting:** Gemeindesaal mit Beamer, WLAN, Mikrofon

#### Nutzungsverhalten Kinder
- **Ohne Smartphone:** Rufen Antworten laut
- **Motivation:** Spaß, Gemeinschaft, "wer errät es zuerst"
- **Kein Punktesystem:** Keine Wettbewerbs-Atmosphäre bei Kindern
- **Moderator als Vermittler:** Entscheidet, welche Antwort gezählt wird

#### Nutzungsverhalten Erwachsene
- **Mit Smartphone:** Individuelle Teilnahme via Player-Interface
- **Motivation:** Wettbewerb, eigene Platzierung im Leaderboard
- **Punktesystem:** Detaillierte Bewertung (Basis + Boni - Strafen)
- **Parallel zum Kinder-Spiel:** Keine Störung der Hauptatmosphäre

---

## 💡 Hauptfunktionen

### 🎮 Für Spieler (player.html)

#### Mobile Teilnahme
- **QR-Code scannen** → Sofortiger Beitritt
- **Namen eingeben** (2-20 Zeichen)
- **Wortliste durchsuchen** (300+ Begriffe in Kategorien)
- **Antwort absenden** → Instant-Feedback (✅/❌ + Punkte)
- **Leaderboard sehen** → Eigene Position + Top 10
- **Session-Persistenz** → Bei Reload nicht rausgeworfen

#### Spieler-Erlebnis
```
1. Lobby: "Warte auf Spielstart..." + Liste anderer Spieler
2. Spiel: Wortliste + Suchfeld → "Kerze" auswählen → "Absenden"
3. Feedback: "✅ Richtig! +90 Punkte" oder "❌ Leider falsch"
4. Zwischenstand: "Platz 7 von 15 | Dein Score: 340"
5. Ende: "🏆 Sieger: Anna mit 580 Punkten!"
```

---

### 🎛️ Für Admin/Moderator (admin.html)

#### Vorbereitung (vor Event)
- **Bilder hochladen** (Start, 6+ Spielbilder, End-Bild)
- **Drag & Drop Sortierung** → Reihenfolge festlegen
- **Lösungen eintragen** → "Weihnachtsbaum", "Stern", etc.
- **Einstellungen konfigurieren** → Punktesystem, Spotlight-Radius, Dark Mode

#### Live-Moderation (während Event)
- **PIN-Zugang** → Admin-Bereich schützen
- **Beamer öffnen** → Automatische Synchronisation
- **QR-Code anzeigen** → Spieler beitreten lassen
- **Lobby überwachen** → "23 Spieler beigetreten"
- **Bild auswählen** → Instant-Wechsel auf Beamer
- **Spotlight zeichnen** → Maus bewegen = Bild wird enthüllt
- **Aufdecken** → Leertaste drücken = volles Bild zeigen
- **Leaderboard einblenden** → Zwischenstände präsentieren
- **Nächstes Bild** → Pfeiltaste → = nahtloser Übergang

#### Admin-Workflow
```
1. Bilder hochladen → 2. PIN setzen → 3. Beamer öffnen
4. QR-Code zeigen → 5. Spieler beitreten → 6. Start-Bild wählen
7. Erstes Spielbild → 8. Spotlight bewegen → 9. Aufdecken
10. Leaderboard zeigen → 11. Nächstes Bild → ... → 12. End-Bild
13. Finales Leaderboard → 14. Siegerehrung
```

---

### 📺 Für Beamer (beamer.html)

#### Fullscreen Display
- **Automatische Synchronisation** mit Admin
- **Schwarzer Hintergrund** → Bild ist zunächst verdeckt
- **Spotlight-Enthüllung** → Kreisförmiger Lichtschein folgt Admin-Maus
- **Spotlight wächst automatisch** → Nach 30 Sekunden +50% Radius
- **Vollbild-Reveal** → Bild wird komplett angezeigt + Lösungswort
- **QR-Code Modal** → Overlay zum Spieler-Beitritt
- **Leaderboard Overlay** → Top 10 Spieler mit Animation
- **Dark Mode Support** → Dunkle UI für Abendveranstaltungen

#### Beamer-Erlebnis (aus Publikums-Sicht)
```
1. Start-Bild: "Willkommen zu LichtBlick! 🎄"
2. QR-Code: "Mitmachen? Handy zücken und scannen!"
3. Schwarzes Bild: Spannung steigt...
4. Spotlight erscheint: "Was könnte das sein?"
5. Spotlight wandert: "Eine Kerze? Ein Stern?"
6. Kinder rufen: "Weihnachtsbaum! Geschenk!"
7. Reveal: Bild wird aufgedeckt + "Richtig: KERZE"
8. Leaderboard: "Anna führt mit 250 Punkten!"
9. Nächstes Bild: Zyklus wiederholt sich
```

---

## 🚨 Problemstellung (v1.x Legacy)

### Warum ein Rewrite?

Das aktuelle System (PHP + JSON-Files) hat **fundamentale Architektur-Probleme**:

#### 1. **Polling Hell**
- 6+ `setInterval` Timer pro Komponente (500ms - 5s)
- ~1200 HTTP-Requests pro Minute bei 150 Spielern
- Hohe Latenz (500ms-1s) für Spotlight-Updates
- Verschwendete Bandbreite und CPU-Zyklen

#### 2. **Race Conditions**
- File-I/O konflikte bei gleichzeitigem Zugriff
- Keine ACID-Garantien
- Daten-Verlust-Gefahr bei konkurrierenden Writes
- File-Locks blockieren bei >50 Spielern

#### 3. **State Fragmentation**
- State verteilt auf 7 JSON-Files (config, session, game, players, images, words, game-state)
- Keine referentielle Integrität
- Inkonsistenzen zwischen Files möglich
- Komplexe Synchronisations-Logik

#### 4. **Keine Echtzeit-Kommunikation**
- Spotlight-Zeichnung: 500ms-1s Verzögerung auf Remote-Beamer
- Leaderboard: 2s Polling-Intervall
- Player-Beitritt: 3-5s bis Sichtbarkeit im Admin
- Keine Push-Notifications

#### 5. **Skalierungs-Grenzen**
- File-System blockiert bei >50 Spielern
- Memory-Leaks durch Polling-Intervalle
- Keine horizontale Skalierung möglich
- Single Point of Failure (PHP-Prozess)

---

## 🎯 Lösungsansatz (v3.0 Rewrite)

### Architektur-Wechsel

| Komponente | v1.x (Legacy) | v3.0 (Target) | Verbesserung |
|------------|---------------|---------------|--------------|
| **Backend** | PHP 7.4 | Node.js 20+ | Event-Loop, non-blocking I/O |
| **API** | REST (Polling) | WebSockets (Socket.IO) | Bidirektional, Push-basiert |
| **Storage** | JSON Files | SQLite3 + WAL | ACID, Indexes, Concurrency |
| **Sync** | Polling (0.5-5s) | Event-Driven (0ms) | Instant Updates |
| **State** | 7 JSON Files | 1 Database (6 Tables) | Referentielle Integrität |
| **Frontend** | Vanilla JS | Vanilla JS (kept!) | Nur Kommunikation geändert |

### Performance-Versprechen

| Metrik | v1.x | v3.0 | Verbesserung |
|--------|------|------|--------------|
| Spotlight Latency | 500-1000ms | <50ms | **10-20x schneller** |
| Leaderboard Update | 2000ms | <100ms | **20x schneller** |
| Player Join | 3-5s | <200ms | **15-25x schneller** |
| Concurrent Players | ~50 (Limit) | 150+ | **3x mehr** |
| Network Traffic | 1200 req/min | ~10 events/min | **90% weniger** |
| DB Write Latency | 10-30ms | 1-5ms | **2-10x schneller** |

---

## 🌟 Business Value

### Für Veranstalter (Kirchen-Gemeinden)

✅ **Zuverlässigkeit:** Keine Abstürze bei 150 Teilnehmern  
✅ **Professionalität:** Flüssige, moderne User Experience  
✅ **Flexibilität:** Anpassbare Bilder, Wortlisten, Punktesystem  
✅ **Wiederverwendbarkeit:** Einmal aufgesetzt, für alle Events nutzbar  
✅ **Support:** Dokumentation für technische Laien

### Für Teilnehmer (Familien)

✅ **Spaß:** Spannung durch gemeinsames Raten  
✅ **Inklusion:** Kinder ohne Smartphone können mitmachen  
✅ **Fairness:** Transparentes Punktesystem  
✅ **Einfachheit:** QR-Code scannen, Name eingeben, fertig  
✅ **Feedback:** Instant-Rückmeldung bei Antworten

### Für Entwickler (Open Source Community)

✅ **Clean Code:** Moderne Architektur-Patterns  
✅ **Dokumentation:** Vollständige API-Contracts  
✅ **Testbarkeit:** Contract-First Development  
✅ **Erweiterbarkeit:** Plugin-System für Custom-Spielmodi (Zukunft)  
✅ **Performance:** Benchmarking und Profiling

---

## 📐 Design-Prinzipien

### 1. **Offline-First**
- Funktioniert ohne Internet (Local Network)
- SQLite-Database (kein Remote-Server)
- Self-Contained Node.js Server

### 2. **Event-Driven**
- WebSocket-basierte Push-Kommunikation
- Room-basiertes Broadcasting
- State Management via Events

### 3. **Contract-First**
- API-Contract steht fest vor Implementierung
- Frontend/Backend unabhängig entwickelbar
- TypeScript Interfaces als Dokumentation

### 4. **Keep It Simple**
- Vanilla JavaScript (keine Framework-Overhead)
- SQLite (keine Postgres-Komplexität)
- Single-Server Deployment (keine Kubernetes)

### 5. **Performance-Oriented**
- Indexed DB-Queries
- In-Memory State-Cache
- WebSocket Throttling (max 20 Spotlight-Events/sec)
- WAL-Mode für Concurrent Writes

---

## 🚀 Erfolgs-Kriterien

### Funktional

- [x] ✅ 150 Spieler gleichzeitig ohne Performance-Degradation
- [x] ✅ Spotlight-Latency <50ms (Admin → Beamer)
- [x] ✅ Leaderboard-Update <100ms (Player → All)
- [x] ✅ QR-Code-Beitritt in <200ms
- [x] ✅ Zero Data Loss bei Concurrent Writes
- [x] ✅ Auto-Reconnect bei temporären Verbindungsabbrüchen

### Non-Funktional

- [x] ✅ Setup-Zeit <10 Minuten (für technische Laien)
- [x] ✅ Deployment auf Standard-Laptop (keine Cloud)
- [x] ✅ Battery-Life: 4h Live-Betrieb auf Laptop
- [x] ✅ Dokumentation vollständig (für Nachfolger)
- [x] ✅ Testing Checklist (manuell für Pre-Event Checks)

---

## 🎓 Lessons Learned (v1.x → v3.0)

### Was funktionierte gut
✅ **Vanilla JS Frontend:** Kein Framework-Lock-In, einfach wartbar  
✅ **Canvas API:** Spotlight-Effekt funktioniert perfekt  
✅ **HTML5 QR-Code:** Einfache Spieler-Teilnahme  
✅ **Modular CSS:** Themes (Dark Mode) einfach umschaltbar  

### Was nicht funktionierte
❌ **JSON File Storage:** Race Conditions, keine Skalierung  
❌ **Polling:** Hohe Latenz, verschwendete Resources  
❌ **PHP Backend:** Keine nativen WebSockets  
❌ **State Fragmentation:** 7 Files schwer zu synchronisieren  

### Was wir ändern
🔄 **Backend:** PHP → Node.js  
🔄 **Storage:** JSON Files → SQLite  
🔄 **Communication:** Polling → WebSockets  
🔄 **State Management:** Fragmented → Unified Database  

### Was wir behalten
✅ **Frontend HTML/CSS:** Funktioniert, gut designt  
✅ **Canvas Rendering:** Bewährte Spotlight-Logik  
✅ **User Flows:** Admin/Beamer/Player-Rollen klar definiert  
✅ **Game Mechanics:** Punktesystem durchdacht  

---

## 🗺️ Nächste Schritte

Nach dem Lesen dieses Dokuments:

1. **[USE_CASES.md](./USE_CASES.md)** → Verstehe realistische Szenarien
2. **[GAME_MECHANICS.md](./GAME_MECHANICS.md)** → Lerne die Spielregeln
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** → System-Design verstehen
4. **[TECH_STACK.md](./TECH_STACK.md)** → Technologie-Entscheidungen
5. **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** → Los geht's!

---

**Vision Statement:**

> "LichtBlick v3.0 ist eine robuste, skalierbare, Echtzeit-Multiplayer-Anwendung, die Familien in kirchlichen Veranstaltungen zusammenbringt – powered by moderne Web-Technologien, aber designed für Menschen ohne technisches Wissen."

**Zielgruppe dieser Vision:** Product Owner, Stakeholder, neue Entwickler im Team
