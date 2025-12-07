# GAME_MECHANICS - LichtBlick v3.0

**Status:** 🎮 **DEFINIERT**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 📋 Übersicht

Dieses Dokument definiert die **vollständige Spielmechanik** von LichtBlick: Spielphasen, Punktesystem, Spotlight-Logik, State Machine und Leaderboard-Algorithmen.

---

## 🎯 Spielphasen (State Machine)

### State Diagram

```
┌─────────────┐
│   SETUP     │ (Pre-Event, Admin konfiguriert)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   LOBBY     │ (Spieler treten bei, QR-Code sichtbar)
└──────┬──────┘
       │ Admin wählt erstes Spielbild
       ▼
┌─────────────┐
│  PLAYING    │ (Aktives Spielbild, Raten + Enthüllen)
└──────┬──────┘
       │ Zyklus: 6x Bilder
       │ ┌──────────────┐
       │ │ 1. Raten     │ (30-90 Sek, Spotlight-Enthüllung)
       │ │ 2. Reveal    │ (5 Sek, volles Bild + Lösungswort)
       │ │ 3. Leaderb.  │ (Optional, 5 Sek Zwischenstand)
       │ │ 4. Nächstes  │ (Nahtloser Übergang)
       │ └──────────────┘
       ▼
┌─────────────┐
│   ENDED     │ (Finales Leaderboard, Siegerehrung)
└─────────────┘
```

### Phasen-Details

#### 1. SETUP Phase

**Status:** `gameStatus = 'lobby'`, `imageType = 'start'`  
**Dauer:** Variabel (Vorbereitung vor Event)

**Erlaubte Aktionen:**
- ✅ Admin: Bilder hochladen, sortieren, Lösungen eintragen
- ✅ Admin: Einstellungen konfigurieren (Scoring, Spotlight, Dark Mode)
- ✅ Admin: PIN setzen
- ❌ Spieler: Können NICHT beitreten (kein QR-Code sichtbar)

---

#### 2. LOBBY Phase

**Status:** `gameStatus = 'lobby'`, `imageType = 'start'`  
**Dauer:** 3-5 Minuten (Spieler-Beitritt)

**Erlaubte Aktionen:**
- ✅ Admin: QR-Code anzeigen/ausblenden
- ✅ Admin: Lobby-Liste überwachen
- ✅ Admin: Beamer öffnen und Fullscreen aktivieren
- ✅ Spieler: Beitreten (via QR-Code oder direkte URL)
- ✅ Beamer: Start-Bild anzeigen + QR-Code Overlay
- ❌ Spieler: Können KEINE Antworten senden (kein aktives Spielbild)

**Übergang zu PLAYING:**
- Admin wählt erstes Spielbild (imageType = 'game')
- `gameStatus` wechselt zu `'playing'`
- Spieler-UI wechselt von Lobby → Spielmodus (Wortliste erscheint)

---

#### 3. PLAYING Phase

**Status:** `gameStatus = 'playing'`, `imageType = 'game'`  
**Dauer:** 9-12 Minuten (6 Bilder à 90-120 Sekunden)

**Sub-Phasen pro Bild:**

##### 3a. Raten (30-90 Sekunden)

**Beamer:**
- Schwarzes Bild (vollständig verdeckt)
- Spotlight-Enthüllung (folgt Admin-Maus)
- Spotlight wächst automatisch nach 30 Sekunden (+50% Radius)

**Admin:**
- Maus über Canvas bewegen → Spotlight zeichnen
- Reveal-Count wird NICHT erhöht (automatische Enthüllung)
- Kann jederzeit LEERTASTE drücken → Frühzeitiger Reveal

**Spieler:**
- Wortliste durchsuchen (300+ Begriffe)
- Begriff auswählen + "Absenden" klicken
- Feedback: "Antwort gesendet! Warte auf Auflösung..."
- Button deaktiviert bis Reveal

**Kinder:**
- Rufen laut ihre Vermutungen
- Moderator reagiert und kommentiert
- Keine Punktevergabe

---

##### 3b. Reveal (5 Sekunden)

**Trigger:** Admin drückt LEERTASTE oder klickt "Reveal"

**Beamer:**
- Schwarzes Bild verschwindet
- Volles Bild wird angezeigt
- Lösungswort eingeblendet (z.B. "STERN")
- Reveal-Count wird erhöht (`image_states.reveal_count++`)

**Spieler:**
- Feedback erscheint:
  - ✅ "Richtig! +90 Punkte" (wenn Antwort korrekt)
  - ❌ "Leider falsch. Richtig war: Stern"
- Punktedetails:
  ```
  Basis-Punkte:         100
  - Reveal-Strafe:      -10 (1x Aufdeckung)
  + Erste-Antwort-Bonus: 0 (nicht erster)
  = Gesamt:             90 Punkte
  
  Dein Score: 90 → 180
  ```
- Button bleibt deaktiviert (bis nächstes Bild)

**Punkteberechnung:**
Siehe [Punktesystem](#-punktesystem) unten.

---

##### 3c. Leaderboard (Optional, 5 Sekunden)

**Trigger:** Admin klickt "Show Leaderboard"

**Beamer:**
- Overlay mit Top 10 Spielern
- Sortiert nach Score (DESC), bei Gleichstand nach joined_at (ASC)
- Animation: Slide-in von rechts

**Spieler:**
- Eigene Position hervorgehoben
- "Du bist Platz 7 von 23"
- Scrollbar für mehr als 10 Einträge

**Automatisches Ausblenden:**
- Nach 5 Sekunden verschwindet Overlay
- Oder Admin klickt erneut "Show Leaderboard" (Toggle)

---

##### 3d. Nächstes Bild (1-2 Sekunden)

**Trigger:** Admin klickt "Next" oder Pfeiltaste →

**Admin:**
- Canvas wird zurückgesetzt (schwarzer Hintergrund)
- Spotlights-Array geleert
- Nächstes Bild wird geladen

**Beamer:**
- Schwarzes Bild (neues Bild verdeckt)
- Spotlights zurückgesetzt
- Bereit für neue Enthüllung

**Spieler:**
- UI wechselt zurück zu Wortliste
- Button "Absenden" wieder aktiv
- Vorherige Antwort vergessen (kann neu wählen)

**Database:**
- Neuer `image_states` Eintrag erstellt
- `reveal_count = 0` (fresh start)
- `started_at` = aktueller Timestamp

---

#### 4. ENDED Phase

**Status:** `gameStatus = 'ended'`, `imageType = 'end'`  
**Dauer:** 1-2 Minuten (Siegerehrung)

**Trigger:** Admin wählt End-Bild

**Beamer:**
- End-Bild anzeigen (z.B. "Frohe Weihnachten! 🎄")
- Finales Leaderboard eingeblendet
- Top 3 mit Medaillen-Icons (🥇🥈🥉)

**Spieler:**
- Finales Leaderboard
- Eigene Position hervorgehoben
- "Du bist auf Platz 7 von 23! Vielen Dank fürs Mitspielen!"

**Admin:**
- Kann Leaderboard toggeln (show/hide)
- Kann neue Runde starten (Reset)

---

## 💯 Punktesystem

### Formel

```javascript
Gesamt-Punkte = (Basis-Punkte × Aufdeckungs-Faktor) + Boni

wobei:
  Basis-Punkte          = config.basePointsPerCorrect (Standard: 100)
  Aufdeckungs-Faktor    = max(0.2, 1.0 - revealCount × 0.1)
  Boni                  = Erste-Antwort-Bonus + Speed-Bonus (optional)
```

### Komponenten

#### 1. Basis-Punkte mit Aufdeckungs-Reduktion

**Konfiguration:**
```javascript
config.scoring = {
  basePointsPerCorrect: 100,      // Basis-Punkte bei 0 Aufdeckungen
  revealPenaltyEnabled: true,     // Strafe aktiviert
  revealPenaltyPercent: 10,       // -10% pro Aufdeckung
  minimumPointsPercent: 20        // Minimum 20% der Basis
}
```

**Berechnung:**
```javascript
const basePoints = config.scoring.basePointsPerCorrect; // 100
const revealCount = imageState.reveal_count;            // Anzahl manueller Aufdeckungen

// Reduktion: -10% pro Aufdeckung, Minimum 20%
const reductionFactor = Math.max(0.2, 1.0 - (revealCount * 0.1));
const reducedPoints = Math.round(basePoints * reductionFactor);
```

**Beispiele:**

| Aufdeckungen | Faktor | Punkte (bei 100 Basis) | Kommentar |
|-------------|--------|------------------------|-----------|
| 0           | 1.0    | **100**                | Perfekt! Ohne Hilfe erraten |
| 1           | 0.9    | **90**                 | Einmal aufgedeckt |
| 2           | 0.8    | **80**                 | Zweimal aufgedeckt |
| 3           | 0.7    | **70**                 | Dreimal aufgedeckt |
| 5           | 0.5    | **50**                 | Fünfmal aufgedeckt |
| 8+          | 0.2    | **20**                 | Minimum (auch bei 10+ Aufdeckungen) |

**Wichtig:** Automatische Spotlight-Vergrößerung zählt NICHT als Aufdeckung!

---

#### 2. Erste-Antwort-Bonus

**Konfiguration:**
```javascript
config.scoring = {
  firstAnswerBonusEnabled: true,   // Bonus aktiviert
  firstAnswerBonusPoints: 50       // +50 Punkte für erste richtige Antwort
}
```

**Berechnung:**
```javascript
// Prüfe ob bereits korrekte Antwort für dieses Bild existiert
const isFirstCorrect = !players.some(p => 
  p.id !== currentPlayer.id && 
  p.answers.some(a => a.image_id === currentImageId && a.is_correct)
);

if (isFirstCorrect && config.scoring.firstAnswerBonusEnabled) {
  points += config.scoring.firstAnswerBonusPoints; // +50
}
```

**Beispiel:**
- Anna antwortet als Erste → richtig → +50 Bonus
- Ben antwortet als Zweiter → richtig → +0 Bonus (kein Bonus mehr)
- Clara antwortet als Dritte → falsch → +0 Punkte

---

#### 3. Geschwindigkeits-Bonus (OPTIONAL - Standard: deaktiviert)

**Konfiguration:**
```javascript
config.scoring = {
  speedBonusEnabled: false,         // Standard: AUS (zu komplex für Kinder-Event)
  speedBonusMaxPoints: 50,         // Max +50 Punkte
  speedBonusTimeLimit: 10000       // 10 Sekunden
}
```

**Berechnung:**
```javascript
if (config.scoring.speedBonusEnabled) {
  const responseTime = Date.now() - imageStartTime; // in ms
  const maxBonusTime = config.scoring.speedBonusTimeLimit;
  
  if (responseTime < maxBonusTime) {
    const speedFactor = (maxBonusTime - responseTime) / maxBonusTime;
    const speedBonus = Math.round(config.scoring.speedBonusMaxPoints * speedFactor);
    points += speedBonus;
  }
}
```

**Beispiele (bei 10 Sek Limit, 50 Pkt Max):**

| Antwortzeit | Faktor | Bonus | Kommentar |
|------------|--------|-------|-----------|
| 2 Sekunden | 0.8    | +40   | Sehr schnell |
| 5 Sekunden | 0.5    | +25   | Mittel |
| 8 Sekunden | 0.2    | +10   | Langsam |
| 10+ Sekunden | 0.0  | +0    | Kein Bonus |

---

### Vollständiges Beispiel

**Szenario:**
- Bild hat 3 manuelle Aufdeckungen
- Spieler antwortet als Zweiter richtig
- Antwortzeit: 4 Sekunden (wenn Speed-Bonus aktiv)

**Berechnung:**
```
Basis-Punkte:              100
× Aufdeckungs-Faktor:      × 0.7 (3 Aufdeckungen)
= Reduzierte Basis:        70

+ Erste-Antwort-Bonus:     0 (nicht erster)
+ Geschwindigkeits-Bonus:  30 (wenn aktiv, 4 Sek → 60% von 50)
────────────────────────────
= GESAMT:                  100 Punkte (oder 70 ohne Speed-Bonus)
```

**Database-Eintrag:**
```sql
INSERT INTO answers (player_id, image_id, answer, is_correct, points_earned, submitted_at)
VALUES (42, 5, 'Stern', 1, 70, 1732713000);

UPDATE players SET score = score + 70 WHERE id = 42;
```

---

## 🔦 Spotlight-Mechanik

### Konfiguration

```javascript
config.spotlight = {
  radius: 80,                    // Basis-Radius in Pixeln
  strength: 0.5,                 // Opacity (0.0 = transparent, 1.0 = opak)
  increaseAfterSeconds: 30,      // Auto-Vergrößerung nach 30 Sekunden
  increaseFactor: 1.5            // +50% Radius
}
```

### Arten von Spotlight

#### 1. Maus-Spotlight (Admin)

**Verhalten:**
- Folgt Maus-Bewegungen auf Admin-Canvas
- Wird NICHT persistiert (nur temporär)
- Sendet WebSocket-Events an Beamer (`admin:spotlight`)
- Throttled auf max 20 Events/Sekunde (Performance)

**Canvas-Rendering:**
```javascript
// Admin-Canvas
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

// Spotlight-Effekt
ctx.globalCompositeOperation = 'destination-in';
const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
gradient.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

---

#### 2. Click-Spotlight (Admin)

**Verhalten:**
- Admin klickt auf Canvas → Spotlight wird "eingefroren"
- Position wird persistiert (Database: `image_states`)
- Bleibt sichtbar auch bei Maus-Bewegung
- Mehrere Click-Spotlights möglich (Array)

**Database:**
```sql
-- Config-Key für persistierte Spotlights
INSERT INTO config (key, value)
VALUES ('current_spotlights', '[{"x":500,"y":300,"radius":80},{"x":700,"y":400,"radius":120}]');
```

---

#### 3. Auto-Größen-Anpassung (Beamer)

**Verhalten:**
- Nach 30 Sekunden (konfigurierbar)
- Alle Spotlights wachsen um 50% (konfigurierbar)
- Schrittweise Vergrößerung (smooth transition)

**Berechnung:**
```javascript
const timeSinceImageStart = Date.now() - imageStartTime;
const increaseThreshold = config.spotlight.increaseAfterSeconds * 1000;

if (timeSinceImageStart > increaseThreshold) {
  const timeOverThreshold = timeSinceImageStart - increaseThreshold;
  const increaseSteps = Math.floor(timeOverThreshold / 10000); // alle 10 Sek
  const currentRadius = baseRadius * Math.pow(config.spotlight.increaseFactor, increaseSteps);
  
  return Math.min(currentRadius, 300); // Max 300px
}
```

---

## 🏆 Leaderboard-Logik

### Sortierung

**Primär:** Score (absteigend)  
**Sekundär:** Beitrittszeit (aufsteigend) bei Gleichstand

```sql
SELECT 
  id, 
  name, 
  score,
  RANK() OVER (ORDER BY score DESC, joined_at ASC) as rank
FROM players
WHERE game_id = ?
ORDER BY score DESC, joined_at ASC
LIMIT 10;
```

**Beispiel:**

| Rang | Name | Score | Joined At | Kommentar |
|------|------|-------|-----------|-----------|
| 1    | Anna | 280   | 10:30:15  | Höchster Score |
| 2    | Ben  | 280   | 10:30:22  | Gleichstand → später beigetreten → Rang 2 |
| 3    | Clara| 210   | 10:30:18  | Dritter Score |

---

### Top N Anzeige

**Beamer:** Top 10 (fest)  
**Player:** Top 10 + eigene Position (wenn nicht in Top 10)

**Beispiel (Player Interface):**
```
🏆 LEADERBOARD

1. 🥇 Anna    - 280 Pkt
2. 🥈 Ben     - 280 Pkt
3. 🥉 Clara   - 210 Pkt
4. David      - 180 Pkt
5. Emma       - 170 Pkt
...
10. Jan       - 120 Pkt

────────────────────────
📍 DU: Platz 15 - 95 Pkt
────────────────────────

Gesamt: 23 Spieler
```

---

### Update-Strategie

**Wann wird Leaderboard aktualisiert?**

1. **Nach jedem Reveal** (automatisch)
   - Alle Spieler-Scores neu berechnet
   - WebSocket broadcast: `game:leaderboard_update`
   - Player-Interfaces aktualisieren in <100ms

2. **Bei Player-Beitritt** (nur Top 10 betroffen)
   - Neue Spieler erscheinen mit Score 0
   - Kein Broadcast (nur Admin-Lobby wird aktualisiert)

3. **Manuell (Admin klickt "Show Leaderboard")**
   - Overlay auf Beamer anzeigen
   - Broadcast an alle Player

---

## 🔄 State Transitions

### Erlaubte Übergänge

```
SETUP → LOBBY
  Trigger: Admin öffnet Beamer + zeigt QR-Code
  
LOBBY → PLAYING
  Trigger: Admin wählt erstes Spielbild (imageType = 'game')
  
PLAYING → PLAYING
  Trigger: Admin wählt nächstes Spielbild (Zyklus)
  
PLAYING → ENDED
  Trigger: Admin wählt End-Bild (imageType = 'end')
  
ENDED → LOBBY (neu)
  Trigger: Admin klickt "New Game" (Reset)
```

### Verbotene Übergänge

❌ LOBBY → ENDED (direkt)  
❌ SETUP → PLAYING (ohne Lobby)  
❌ ENDED → PLAYING (ohne Reset)

---

## ⚙️ Konfigurations-Übersicht

Alle Einstellungen sind in Database-Table `config` gespeichert:

```sql
-- Beispiel-Config
INSERT INTO config (key, value) VALUES
('adminPin', '"1234"'),
('qrVisible', 'false'),
('darkMode', 'false'),
('scoring', '{
  "basePointsPerCorrect": 100,
  "revealPenaltyEnabled": true,
  "revealPenaltyPercent": 10,
  "minimumPointsPercent": 20,
  "firstAnswerBonusEnabled": true,
  "firstAnswerBonusPoints": 50,
  "speedBonusEnabled": false,
  "speedBonusMaxPoints": 50,
  "speedBonusTimeLimit": 10000
}'),
('spotlight', '{
  "radius": 80,
  "strength": 0.5,
  "increaseAfterSeconds": 30,
  "increaseFactor": 1.5
}');
```

---

**Nächster Schritt:** [ARCHITECTURE.md](./ARCHITECTURE.md) → Verstehe das System-Design.
