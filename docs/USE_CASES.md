# USE_CASES - LichtBlick v3.0

**Status:** 📖 **DOKUMENTIERT**  
**Version:** 3.0.0  
**Datum:** 27. November 2025

---

## 📋 Übersicht

Dieses Dokument beschreibt **realistische Nutzungsszenarien** für LichtBlick in einem Live-Event mit 80+ Teilnehmern. Alle User Stories sind aus Sicht der verschiedenen Rollen (Admin, Beamer-Operator, Mobile Spieler, Kinder) geschrieben.

---

## 🎬 Haupt-Szenario: Weihnachtsgottesdienst

### Kontext

**Event:** Familiengottesdienst am 24.12.2024  
**Ort:** Gemeindesaal der FeG Nahude  
**Teilnehmer:** 80 Personen (25 Familien)  
**Spieler:** 30 Erwachsene mit Smartphones  
**Kinder:** 35 Kinder (6-12 Jahre) ohne Devices  
**Dauer:** 15 Minuten (als Teil des 60min Gottesdienstes)  
**Bilder:** 1 Start + 6 Weihnachtsbilder + 1 End-Bild

### Zeitplan

| Zeit | Phase | Dauer | Hauptaktivität |
|------|-------|-------|----------------|
| **T-15 Min** | Setup | 5 Min | Technik-Check, Bilder hochladen |
| **T-10 Min** | Probe | 3 Min | Beamer-Test, Spotlight-Test |
| **T-7 Min** | Pause | 7 Min | Gottesdienst läuft weiter |
| **T+0** | Start | 0 Min | Moderator kündigt Spiel an |
| **T+2** | Beitritt | 3 Min | Spieler scannen QR-Code |
| **T+5** | Erklärung | 2 Min | Moderator erklärt Regeln |
| **T+7** | Spiel | 9 Min | 6 Bilder à 90 Sekunden |
| **T+16** | Sieger | 1 Min | Finales Leaderboard + Applaus |
| **T+17** | Ende | - | Überleitung zum nächsten Programmpunkt |

---

## 👤 User Stories: Admin / Moderatorin Sarah

### Story 1: Vorbereitung (T-15 Min)

**Als** Moderatorin Sarah  
**möchte ich** Bilder für das Spiel hochladen  
**damit** ich das Spiel ohne technische Probleme durchführen kann.

#### Schritte

1. **Laptop mit Beamer verbinden** (HDMI-Kabel)
2. **Browser öffnen:** `http://localhost:3000/admin.html`
3. **PIN eingeben:** `1234` (zuvor in Settings festgelegt)
4. **"Bilder hochladen" klicken**
5. **8 Dateien auswählen:**
   - `start-weihnachten.jpg` (Start-Bild)
   - `kerze.jpg`, `stern.jpg`, `baum.jpg`, `geschenk.jpg`, `engel.jpg`, `krippe.jpg` (Spielbilder)
   - `ende-frohe-weihnachten.jpg` (End-Bild)
6. **Upload-Fortschritt beobachten:** "Uploading 5/8... 62%"
7. **Bilder als Thumbnails sehen**
8. **Reihenfolge per Drag & Drop anpassen:** Stern zuerst, Baum zuletzt
9. **Lösungen eintragen:**
   - Kerze → "Kerze"
   - Stern → "Stern"
   - Baum → "Weihnachtsbaum"
   - etc.
10. **Speichern** → "Einstellungen gespeichert ✓"

#### Akzeptanzkriterien

- [x] ✅ Bilder werden als Thumbnails angezeigt (100x100px)
- [x] ✅ Drag & Drop funktioniert flüssig
- [x] ✅ Lösungen werden persistiert (auch nach Browser-Reload)
- [x] ✅ Upload dauert <5 Sekunden für 8 Bilder (je 500KB)

---

### Story 2: Beamer öffnen (T-10 Min)

**Als** Moderatorin Sarah  
**möchte ich** den Beamer mit Admin synchronisieren  
**damit** alle Teilnehmer das gleiche sehen wie ich.

#### Schritte

1. **"Beamer öffnen" Button klicken** (im Admin-Interface)
2. **Neues Browser-Fenster öffnet sich** (`beamer.html`)
3. **Beamer-Fenster auf externen Monitor/Beamer ziehen**
4. **F11 drücken** für Fullscreen
5. **Spotlight-Test:** Maus im Admin bewegen → Beamer zeigt Spotlight
6. **Latenz prüfen:** Spotlight folgt Maus in <50ms

#### Akzeptanzkriterien

- [x] ✅ Beamer-Fenster öffnet sich automatisch
- [x] ✅ WebSocket-Verbindung wird hergestellt (grüner Status-Indikator)
- [x] ✅ Spotlight synchronisiert in Echtzeit (<50ms)
- [x] ✅ Fullscreen funktioniert (F11 oder Button)

---

### Story 3: QR-Code anzeigen (T+2 Min)

**Als** Moderatorin Sarah  
**möchte ich** einen QR-Code auf dem Beamer zeigen  
**damit** Teilnehmer schnell beitreten können.

#### Schritte

1. **"Show QR" Button klicken** (im Admin)
2. **QR-Code erscheint als Overlay auf Beamer** (halbtransparent)
3. **Sarah sagt ins Mikro:** "Wer mitspielen möchte, scannt bitte den QR-Code mit dem Handy!"
4. **Spieler scannen QR-Code** → Automatischer Beitritt
5. **Lobby-Liste im Admin aktualisiert sich:**
   - "Anna" (1)
   - "Ben" (2)
   - "Clara" (3)
   - ... (Live-Count: 23 Spieler)
6. **Nach 3 Minuten:** "Hide QR" klicken → QR verschwindet

#### Akzeptanzkriterien

- [x] ✅ QR-Code ist groß genug (min. 300x300px) und gut lesbar
- [x] ✅ URL führt direkt zu `player.html` (keine Landingpage)
- [x] ✅ Lobby-Liste zeigt neue Spieler in <500ms
- [x] ✅ QR-Code kann wieder eingeblendet werden (während des Spiels)

---

### Story 4: Spiel starten (T+7 Min)

**Als** Moderatorin Sarah  
**möchte ich** das erste Spielbild anzeigen  
**damit** das Raten beginnen kann.

#### Schritte

1. **Erstes Spielbild auswählen** (Thumbnail "Stern" anklicken)
2. **Beamer zeigt schwarzes Bild** (verdeckt)
3. **Spieler-Interfaces wechseln von Lobby → Spielmodus** (Wortliste erscheint)
4. **Sarah bewegt Maus über Admin-Canvas** → Spotlight folgt
5. **Beamer zeigt Spotlight-Enthüllung in Echtzeit**
6. **Kinder rufen:** "Ein Stern! Eine Sonne!"
7. **Spieler wählen auf Handys:** "Stern" → "Absenden"
8. **Nach 60 Sekunden:** Sarah drückt **LEERTASTE** → Bild wird vollständig aufgedeckt
9. **Beamer zeigt:** Volles Bild + "Richtig: STERN"
10. **Spieler sehen Feedback:** "✅ Richtig! +100 Punkte" oder "❌ Leider falsch"

#### Akzeptanzkriterien

- [x] ✅ Bildwechsel dauert <100ms (Admin → Beamer)
- [x] ✅ Spotlight-Latenz <50ms
- [x] ✅ Spieler-UI wechselt automatisch von Lobby → Spiel
- [x] ✅ Feedback erscheint sofort nach Reveal (<200ms)

---

### Story 5: Leaderboard anzeigen (nach Bild 3)

**Als** Moderatorin Sarah  
**möchte ich** Zwischenstände zeigen  
**damit** Spieler ihre Position sehen.

#### Schritte

1. **"Show Leaderboard" Button klicken** (im Admin)
2. **Beamer blendet Overlay ein** (halbtransparent über Bild):
   ```
   🏆 TOP 10
   1. Anna     - 280 Pkt
   2. Ben      - 250 Pkt
   3. Clara    - 210 Pkt
   4. David    - 180 Pkt
   5. Emma     - 170 Pkt
   ...
   ```
3. **Spieler-Handys zeigen:** "Du bist Platz 7 von 23"
4. **Nach 5 Sekunden:** Leaderboard automatisch ausgeblendet
5. **Nächstes Bild weiter**

#### Akzeptanzkriterien

- [x] ✅ Leaderboard ist gut lesbar (große Schrift, kontrastreiche Farben)
- [x] ✅ Top 10 werden sortiert nach Score (DESC), bei Gleichstand nach Beitrittszeit (ASC)
- [x] ✅ Spieler sehen ihre eigene Position hervorgehoben
- [x] ✅ Leaderboard-Update <100ms nach Score-Änderung

---

## 📱 User Stories: Mobile Spielerin Anna

### Story 6: Beitritt (T+2 Min)

**Als** Spielerin Anna  
**möchte ich** schnell dem Spiel beitreten  
**damit** ich mitspielen kann.

#### Schritte

1. **Smartphone entsperren**
2. **Kamera-App öffnen**
3. **QR-Code auf Beamer scannen**
4. **Browser öffnet sich automatisch:** `http://192.168.1.100:3000/player.html`
5. **Namens-Eingabe:** "Anna" (Tastatur erscheint)
6. **"Beitreten" Button tippen**
7. **Lobby-Screen:** "Warte auf Spielstart... | Spieler: Anna, Ben, Clara"
8. **Wait-Animation:** Pulsierender Circle + "Gleich geht's los!"

#### Akzeptanzkriterien

- [x] ✅ QR-Code-Scan funktioniert auf iOS + Android
- [x] ✅ Namens-Eingabe validiert (min. 2 Zeichen, max. 20)
- [x] ✅ Beitritt dauert <200ms (Netzwerk)
- [x] ✅ Lobby-Liste wird live aktualisiert (andere Spieler sichtbar)

---

### Story 7: Antwort absenden (während Spiel)

**Als** Spielerin Anna  
**möchte ich** eine Antwort auswählen und absenden  
**damit** ich Punkte sammeln kann.

#### Schritte

1. **Spielbild erscheint** (Lobby → Spielmodus-Wechsel)
2. **Wortliste wird angezeigt** (300+ Begriffe in Kategorien)
3. **Anna scrollt durch Kategorien:**
   - 🎄 Weihnachten: Kerze, Stern, Baum, Geschenk...
   - 🐾 Tiere: Hund, Katze, Vogel...
   - 📦 Objekte: Apfel, Auto, Ball...
4. **Suchfeld nutzen:** "Ster" eintippen → "Stern" wird hervorgehoben
5. **"Stern" antippen** → Wort wird markiert (grüner Hintergrund)
6. **"Absenden" Button tippen**
7. **Bestätigung:** "Antwort gesendet! Warte auf Auflösung..."
8. **Button deaktiviert** (grau) bis Reveal
9. **Nach Reveal:** "✅ Richtig! +100 Punkte | Dein Score: 100"

#### Akzeptanzkriterien

- [x] ✅ Wortliste lädt in <500ms
- [x] ✅ Suchfeld filtert instant (keine Verzögerung)
- [x] ✅ Antwort-Submit dauert <200ms
- [x] ✅ Feedback erscheint sofort nach Reveal
- [x] ✅ Button-State verhindert Doppel-Submit

---

### Story 8: Leaderboard auf Handy (nach Bild 3)

**Als** Spielerin Anna  
**möchte ich** meine Position im Leaderboard sehen  
**damit** ich weiß, wie gut ich abschneide.

#### Schritte

1. **Leaderboard wird automatisch angezeigt** (nach Reveal)
2. **Handy zeigt:**
   ```
   🏆 LEADERBOARD
   
   1. 🥇 Anna    - 280 Pkt (DU!)
   2. 🥈 Ben     - 250 Pkt
   3. 🥉 Clara   - 210 Pkt
   4. David      - 180 Pkt
   ...
   
   Du bist auf Platz 1 von 23!
   ```
3. **Eigene Zeile ist hervorgehoben** (goldener Hintergrund)
4. **Nach 5 Sekunden:** Automatischer Wechsel zurück zu "Warte auf nächstes Bild"

#### Akzeptanzkriterien

- [x] ✅ Eigene Position ist klar sichtbar (Highlight)
- [x] ✅ Top 3 haben Medaillen-Icons (🥇🥈🥉)
- [x] ✅ Scrollbar für mehr als 10 Spieler
- [x] ✅ Update <100ms nach Score-Änderung

---

## 🖥️ User Stories: Beamer-Operator (Techniker Tom)

### Story 9: Setup und Monitoring (T-15 Min)

**Als** Beamer-Operator Tom  
**möchte ich** den Beamer korrekt einrichten  
**damit** alle Teilnehmer das Spiel sehen können.

#### Schritte

1. **Laptop an Beamer anschließen** (HDMI)
2. **Beamer einschalten** → Display-Modus: "Erweitern"
3. **Beamer-Fenster (`beamer.html`) auf zweiten Monitor ziehen**
4. **F11 für Fullscreen drücken**
5. **WebSocket-Status prüfen:** Grüner Indikator "Connected"
6. **Spotlight-Test:** Admin bewegt Maus → Tom sieht Spotlight auf Beamer
7. **Latenz-Check:** Spotlight folgt <50ms
8. **Audio-Test:** Mikrofon für Moderator prüfen
9. **Dark Mode aktivieren** (falls Abendveranstaltung)

#### Akzeptanzkriterien

- [x] ✅ Beamer zeigt Fullscreen ohne Ränder
- [x] ✅ Auflösung: 1920x1080 (Full HD)
- [x] ✅ Keine Browser-UI sichtbar (kein Adressbar, Tabs)
- [x] ✅ WebSocket-Reconnect funktioniert bei kurzer Unterbrechung

---

## 👶 User Stories: Kind Lukas (6 Jahre)

### Story 10: Mitmachen ohne Smartphone (während Spiel)

**Als** Kind Lukas (6 Jahre)  
**möchte ich** auch mitspielen  
**obwohl ich kein Handy habe**.

#### Schritte

1. **Lukas sitzt vorne** (näher am Beamer)
2. **Start-Bild erscheint:** "Willkommen zu LichtBlick! 🎄"
3. **Moderator Sarah fragt:** "Wer möchte mitspielen? Alle Kinder nach vorne!"
4. **Erstes Spielbild:** Schwarzer Bildschirm
5. **Spotlight erscheint:** Ein kleiner Kreis mit Licht
6. **Lukas sieht etwas Gelbes:** "Eine Banane!"
7. **Spotlight wandert:** Jetzt sieht Lukas eine Spitze
8. **Lukas ruft laut:** "Ein Stern! Ein Stern!"
9. **Andere Kinder rufen:** "Sonne! Blume!"
10. **Moderator:** "Sehr gut geraten! Wir decken auf..."
11. **Bild wird komplett gezeigt:** Großer Weihnachtsstern
12. **Moderator:** "Richtig! Es war ein Stern! Lukas hatte recht! 👏"
13. **Alle klatschen**

#### Akzeptanzkriterien

- [x] ✅ Beamer ist groß genug für alle sichtbar (min. 2m Diagonale)
- [x] ✅ Spotlight ist deutlich erkennbar (Kontrast ausreichend)
- [x] ✅ Moderator moderiert fair (alle Kinder dürfen raten)
- [x] ✅ Keine Punktevergabe für Kinder (Fokus auf Spaß)

---

## ⚠️ Edge Cases & Fehlerszenarien

### Szenario A: Spieler verliert Verbindung

**Situation:** Anna's Handy verliert WLAN während Bild 3

**Erwartetes Verhalten:**
1. WebSocket erkennt Disconnect nach 5 Sekunden
2. Anna's Handy zeigt: "⚠️ Verbindung unterbrochen... Reconnecting..."
3. Auto-Reconnect versucht 3x (je 2 Sekunden Pause)
4. Bei Erfolg: Session-Recovery via playerId (aus sessionStorage)
5. Anna sieht: "✅ Verbindung wiederhergestellt! | Dein Score: 210"
6. Aktuelles Bild wird geladen, Wortliste wieder verfügbar

**Akzeptanzkriterien:**
- [x] ✅ Kein Datenverlust (Score bleibt erhalten)
- [x] ✅ Reconnect dauert <5 Sekunden
- [x] ✅ Spieler kann weitermachen (aktuelles Bild wird geladen)

---

### Szenario B: Admin-Browser stürzt ab

**Situation:** Sarah's Browser freezt während Bild 4

**Erwartetes Verhalten:**
1. Sarah lädt `admin.html` neu
2. PIN-Eingabe erneut
3. Admin-Interface lädt letzten Game-State aus Database
4. Bildergalerie zeigt: Bild 4 ist aktiv (blauer Border)
5. Lobby-Liste zeigt: 23 Spieler verbunden
6. Beamer läuft weiter (nicht betroffen, da eigene WebSocket-Verbindung)
7. Sarah kann weitermachen (Spotlight, Reveal, Next)

**Akzeptanzkriterien:**
- [x] ✅ State-Recovery aus SQLite Database
- [x] ✅ Beamer läuft ungestört weiter
- [x] ✅ Spieler merken nichts vom Admin-Reload

---

### Szenario C: 150 Spieler treten gleichzeitig bei

**Situation:** Sehr große Veranstaltung, QR-Code wird auf Leinwand gezeigt

**Erwartetes Verhalten:**
1. 150 Spieler scannen QR-Code innerhalb 30 Sekunden
2. Server verarbeitet 5 Joins pro Sekunde
3. Database schreibt Player-Einträge mit WAL-Mode (concurrent)
4. WebSocket broadcasts `player:joined` Event an Admin + Beamer
5. Admin-Lobby-Liste zeigt: "150 Spieler"
6. Leaderboard lädt Top 10 (nicht alle 150)
7. Performance bleibt stabil (<100ms Response Time)

**Akzeptanzkriterien:**
- [x] ✅ Keine Timeouts (alle 150 Joins erfolgreich)
- [x] ✅ Database-Write Latency <5ms (SQLite WAL)
- [x] ✅ Admin-UI bleibt responsiv (Throttling für Lobby-Updates)
- [x] ✅ Leaderboard zeigt nur Top 10 (nicht alle 150)

---

## 📊 Metriken für Erfolgs-Messung

| User Story | Metrik | Ziel | Messung |
|------------|--------|------|---------|
| **Bild-Upload (Admin)** | Upload-Zeit | <5s für 8 Bilder | Server-Logs |
| **Spotlight-Sync** | Latency | <50ms | WebSocket Ping |
| **QR-Code-Beitritt** | Join-Zeit | <200ms | Database Timestamp |
| **Antwort-Submit** | Response Time | <200ms | API Logs |
| **Leaderboard-Update** | Update-Zeit | <100ms | Frontend Profiling |
| **Concurrent Players** | Max Players | 150+ | Load Testing |

---

## 🎯 Akzeptanztests (Checkliste)

Vor jedem Live-Event muss diese Checkliste durchgegangen werden:

### Pre-Event (T-15 Min)
- [ ] Laptop mit Beamer verbunden (HDMI funktioniert)
- [ ] Server läuft (`npm start` erfolgreich)
- [ ] Admin-PIN funktioniert
- [ ] Bilder hochgeladen (Start + 6+ Game + End)
- [ ] Lösungen eingetragen
- [ ] Beamer-Fenster im Fullscreen
- [ ] Spotlight-Test erfolgreich (<50ms Latenz)
- [ ] QR-Code auf Beamer sichtbar und scanbar

### Während Event (T+0 bis T+17)
- [ ] Mindestens 10 Spieler beigetreten
- [ ] Lobby-Liste zeigt alle Spieler
- [ ] Erstes Bild lädt auf Beamer
- [ ] Spotlight folgt Maus-Bewegungen
- [ ] Spieler können Antworten absenden
- [ ] Reveal zeigt volles Bild + Lösungswort
- [ ] Leaderboard aktualisiert sich
- [ ] Nächstes Bild lädt nahtlos
- [ ] Finales Leaderboard zeigt Sieger

### Post-Event (T+17)
- [ ] Keine JavaScript Errors in Browser-Console
- [ ] Keine 500 Errors in Server-Logs
- [ ] Database-Backup erstellt
- [ ] Spieler-Feedback gesammelt (informell)

---

**Nächster Schritt:** [GAME_MECHANICS.md](./GAME_MECHANICS.md) → Verstehe die Spielregeln im Detail.
