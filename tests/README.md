# LichtBlick Tests

Automatisierte Tests und Simulationen für LichtBlick.

## 📁 Struktur

```
tests/
├── docs/              # Test-Dokumentation
│   ├── README.md      # Ausführliche Test-Anleitung
│   ├── TEST_RESULTS.md   # Letzte Test-Ergebnisse
│   ├── TEST_SUMMARY.md   # Test-Zusammenfassung
│   └── TEST_COVERAGE.md  # Test-Abdeckung
├── e2e/               # E2E Test-Specs (Playwright)
│   ├── admin.spec.js
│   ├── auth.spec.js
│   ├── gameplay.spec.js
│   ├── multiplayer.spec.js
│   └── profile.spec.js
├── fixtures/          # Test-Fixtures
│   └── base.js
├── helpers/           # Helper-Funktionen
│   ├── db-setup.js
│   ├── server.js
│   ├── test-data.js
│   └── websocket.js
├── simulate-players.js        # Spieler-Simulator (Zustandsbasiert)
└── player-state-simulation.js # State-Validierungs-Tests
```

## 🧪 Test-Typen

### 1. E2E Tests (Playwright)
Vollständige End-to-End Tests mit echtem Browser.

```powershell
cd tests
npm test
```

### 2. Spieler-Simulation
Simuliert mehrere Spieler mit **zustandsbasiertem Verhalten**.

## 🎮 Spieler-Simulation

### Features

✅ **Zustandsbasierte Aktionen** - Spieler führen nur erlaubte Aktionen je nach Game-Phase aus:
- `login`: Verbinden und beitreten
- `lobby`: Warten auf Spielstart
- `playing`: Wort auswählen und locken (nur wenn Bild aktiv!)
- `ended`: Kein weiteres Spielen möglich

✅ **Realistische Spieler** - Simulieren echtes Nutzerverhalten:
- Zufällige Verzögerungen beim Antworten
- Mix aus richtigen und falschen Antworten
- Gestaffelte Verbindungen

✅ **State-Validierung** - Verhindert DAU-Fehler:
- Kein Wort-Lock außerhalb von `playing`
- Kein Wort-Lock ohne aktives Bild
- Event-Handling nur in passender Phase

### Verwendung

```powershell
# Standard (localhost:3000, 10 Spieler)
.\simulate-quick.ps1

# Lokaler Server auf anderem Port
.\simulate-quick.ps1 -ServerUrl "http://localhost:3001" -Players 5

# Produktiv-Server
.\simulate-quick.ps1 -ServerUrl "https://lichtblick.feg-koblenz.de" -Players 20

# Alle Parameter anpassen
.\simulate-quick.ps1 -ServerUrl "http://localhost:3001" -Players 5 -DelayMin 1000 -DelayMax 5000 -CorrectChance 0.5

# Parameter-Info anzeigen
.\simulate-quick.ps1 -Info

# Manuelle Konfiguration via Umgebungsvariablen
$env:SERVER_URL="http://localhost:3001"
$env:NUM_PLAYERS=10
node simulate-players.js
```

### Umgebungsvariablen

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `SERVER_URL` | `http://localhost:3000` | Server-URL |
| `NUM_PLAYERS` | `10` | Anzahl simulierter Spieler |
| `ANSWER_DELAY_MIN` | `500` | Min. Verzögerung (ms) |
| `ANSWER_DELAY_MAX` | `3000` | Max. Verzögerung (ms) |
| `CORRECT_ANSWER_CHANCE` | `0.3` | Wahrscheinlichkeit für richtige Antwort (0-1) |

### Parameter für `simulate-quick.ps1`

| Parameter | Default | Beschreibung |
|-----------|---------|--------------|
| `-ServerUrl` | `http://localhost:3000` | Server-URL |
| `-Players` | `10` | Anzahl Spieler |
| `-DelayMin` | `500` | Min. Verzögerung (ms) |
| `-DelayMax` | `3000` | Max. Verzögerung (ms) |
| `-CorrectChance` | `0.3` | Wahrscheinlichkeit für richtige Antwort (0-1) |
| `-Info` | - | Zeigt nur Parameter-Info an |

### Verhalten der Spieler

#### Phase: `login`
- Verbindung zum Server
- Automatisches Beitreten nach 0,5-3,5s

#### Phase: `lobby`
- Warten auf `game:phase_change` → `playing`
- Keine Aktionen möglich

#### Phase: `playing`
- Event `game:phase_change` empfangen mit `wordList`
- Nach zufälliger Verzögerung: Wort auswählen
- Wort per `player:lock_answer` locken
- Event `game:image_revealed` abwarten
- Prüfung: War meine Antwort richtig?

#### Phase: `ended`
- Finale Rangliste ausgeben
- Keine Aktionen mehr möglich

### Beispiel-Output

```
🎮 LichtBlick Spieler-Simulator (Zustandsbasiert)
═══════════════════════════════════════════════════════
Server:             http://localhost:3000
Anzahl Spieler:     5
Antwort-Delay:      500-3000ms
Richtig-Chance:     30%
═══════════════════════════════════════════════════════

[Anna] 🔌 Verbinde mit http://localhost:3000...
✅ [Anna] Verbunden: abc123
👤 [Anna] Trete Spiel bei...
✓ [Anna] Beigetreten als ID 1
📊 [Anna] Lobby Update: 1 Spieler

🔄 [Anna] Phase-Wechsel: lobby → playing
🎯 [Anna] Spiel gestartet! 20 Wörter verfügbar
💭 [Anna] Wähle Wort: "Stern"
🔒 [Anna] Antwort gelockt: "Stern"

🖼️ [Anna] Bild enthüllt: "Stern"
   Meine Antwort: "Stern" ✅
📊 [Anna] Leaderboard: Rang 1/5 - 100 Punkte
```

## 🔧 State-Validierung

### Client-Side Checks (wie in `player.js`)

```javascript
// Wort nur locken wenn:
if (phase !== 'playing') return;        // ❌ Falsche Phase
if (!currentImageId) return;            // ❌ Kein aktives Bild
if (!wordList.includes(word)) return;   // ❌ Wort nicht in Liste
```

### Event-Filtering

```javascript
// Events nur verarbeiten wenn erlaubt:
if (phase !== 'playing' && event === 'game:image_revealed') {
  console.warn('⚠️ Event in falscher Phase blockiert');
  return;
}
```

## 🐛 Debugging

```powershell
# Einzelner Spieler mit Debug-Output
$env:NUM_PLAYERS=1
$env:ANSWER_DELAY_MIN=100
$env:ANSWER_DELAY_MAX=500
node simulate-players.js
```

## 🚀 E2E Tests ausführen

```bash
# Alle Tests
npm run test:e2e

# Mit UI
npm run test:e2e:ui

# Nur ein Browser
npm run test:e2e:chromium

# Debug-Modus
npm run test:e2e:debug

# Test-Report anzeigen
npm run test:e2e:report
```

## 📖 Weitere Dokumentation

Siehe [`docs/README.md`](./docs/README.md) für ausführliche Informationen über:
- Test-Setup und Konfiguration
- Einzelne Test-Cases
- Test-Ergebnisse und Coverage
- Bekannte Probleme

## ⚙️ Konfiguration

Die Playwright-Konfiguration befindet sich in [`tests/playwright.config.js`](./playwright.config.js).

Die Test-Scripts in `package.json` verweisen automatisch auf diese Config mit dem `--config` Parameter.
