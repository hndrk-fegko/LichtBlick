# 🚀 Andock-Plan V3: Admin UI Integration

**Erstellt:** 2025-12-04  
**Letztes Update:** 2025-12-04 (Sprint 3 abgeschlossen)  
**Status:** ✅ FEATURE-COMPLETE | Bereit für Test-Phase

---

## 📊 Implementierungsstatus: 100% Feature-Complete

### Übersicht

| Kategorie | Status |
|-----------|--------|
| Socket Events (Client→Server) | 🟢 100% |
| Socket Events (Server→Client) | 🟢 100% |
| REST API Endpoints | 🟢 100% |
| UI Komponenten | 🟢 100% |
| Settings Modal Tabs | 🟢 100% |
| Keyboard-Shortcuts | 🟢 100% |

---

## ✅ Alle Features implementiert

### Sprint 1 (Grundfunktionalität)
- ✅ QR-Toggle mit Keyboard (Q)
- ✅ Upload-Pfad korrigiert
- ✅ Game Strip mit Start/End-Bildern
- ✅ Button Visibility Logic
- ✅ Danger-Tab Socket Events

### Sprint 2 (Vollständigkeit)
- ✅ PIN-Management komplett
- ✅ Multi-Admin Warnung
- ✅ Beamer-Status live
- ✅ Wörterliste laden/speichern
- ✅ Scoring-Settings laden/speichern

### Sprint 3 (Polish)
- ✅ Context Menu: clear-role Aktion
- ✅ Keyboard-Shortcuts erweitert (B, S, H, C, Escape)
- ✅ Admin Session Badge im Header
- ✅ Legacy Module dokumentiert

---

## 🧪 UMFASSENDE TEST-CHECKLISTE

### 📌 Vorbereitung

**Server starten:**
```powershell
cd server
npm start
```

Server zeigt bei tartup noch den alten Admin-Pfad an, das ist in Ordnung, weil wir admin-new ggf. zum schluss umbenennen, dann stimmt es weder


**URLs öffnen:**
- Admin: `http://localhost:3000/admin-new.html?token=<TOKEN>`
- Beamer: `http://localhost:3000/beamer.html?token=<TOKEN>`
- Player: `http://localhost:3000/player.html`

---

Gibt es noch einen alten Beamer, der ohne Token funktioniert?
Oder ist das der gleiche - aber der Token wird nicht überprüft?

entferne den Link von der Homepage (locelhost:3000/) Lass den Link-Button nur im Admin-Panel
Entferne den Button zum Öffnen des Admins in der Homepage. ersetzte das durch einen Hinweis, dass der Admin über /admin.html?token=... geöffnet werden muss.

Teile die Seite auf in einen allgemeinen Bereich mit infos zum Projekt Lichtblick
und einem speziellen Teil. Server läuft, Link zur Teilnahme. Health-Check, Admin-Link mit Hinweis zum Token.

### 🔌 1. VERBINDUNG & AUTHENTIFIZIERUNG

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 1.1 | Server-Verbindung | Seite laden | Grüner Status-Dot bei "Server" | ✓ |
| 1.2 | Beamer-Status (disconnected) | Ohne Beamer laden | Roter Status-Dot bei "Beamer" | ✓ |
| 1.3 | Beamer-Status (connected) | Beamer-Tab öffnen | Grüner Status-Dot bei "Beamer" | ✓ |
| 1.4 | Token-Auth | Mit falschem Token öffnen | Zugriff verweigert / Error | Teilweise: Funktion erlischt - 
🔐 Admin Zugang

Bitte Admin-PIN eingeben:
Ungültiger Admin-Link. Bitte verwende den korrekten Admin-Link.
 erscheint ganz oben am Rannd. sollte als Modal erscheinen und den Hintergrund dimmen/blurren - vermutlich fehlt css |
| 1.5 | PIN-Schutz aktiviert | In Settings aktivieren | PIN-Eingabe erscheint | x Fehler: Nicht authentifiziert erscheint als Fehler. Checkbox vor  PIN-Schutz aktivieren ist nicht sichtbar (Button? fehlendes css?)|
| 1.6 | PIN-Eingabe | Korrekten PIN eingeben | Zugang gewährt | ☐ Folgefehler zu 1.5. kann niht getestet werden|
| 1.7 | PIN-Timer | Nach Aktivierung | Timer im Header zeigt Countdown | ☐ Folgegfeher zu 1.5. kann niht getestet werden|
| 1.8 | PIN-Ablauf | Timer auf 0 | Warnung / Erneute Auth | ☐ Folgefehler zu 1.5. kann niht getestet werden.. Logik fehler: Pinschutz wird dann aufgehoben, nicht erneut die PIN abgefragt. In der Regel ist die Veranstaltung nach 2 h vorbei. verhindert, dass man bis zum nächsten einsatz die Pin vergistt, aber den Browser schließt ohne den Pinschutz zu deaktivieren. |

---

### 🖼️ 2. BILDER-VERWALTUNG (Sidebar)

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 2.1 | Sidebar öffnen | Button "📁 Bilder" klicken | Sidebar fährt von rechts ein | ✓ Erscheint - keine Animation. Button an der rechten seite Fehlt (nur Button im Header). Sidebar kann noch breiter (bis zum Preview bereich - Bilderpool auf großen Bildschirmen vierspaltig) |
| 2.2 | Sidebar schließen (X) | X-Button klicken | Sidebar schließt | ✓ |
| 2.3 | Sidebar schließen (Escape) | Taste Escape drücken | Sidebar schließt | ✓ (Einstellungen übrigens auch mit ESC schließbar) |
| 2.4 | Bild hochladen | Datei in Upload-Zone ziehen | Bild erscheint im Pool | ☐ Dropzone wird bei hover erkannt, aber nicht, wenn ich eine Datei darüberziehe. Klick und Upload über Auswahldialog funktioniert  |
| 2.5 | Upload-Feedback | Nach Upload | Toast "Bild hochgeladen" | ✓ |
| 2.6 | Bild-Vorschau | Bild im Pool anzeigen | Thumbnail sichtbar | ✓ |
| 2.7 | Image Pool leer | Alle Bilder löschen | "Keine Bilder" Meldung | ✓ |
| 2.8 | Bilder werden auch physisch vom Server gelöscht |  |  | ✓ |
| 2.9 | Gelöschte Bilder verschwinden auch aus dem Spiel-Strip | Bild im Spiel-Strip löschen | Bild verschwindet aus Strip | ✓ |
| 2.10 | Mehrere Bilder hochladen | Mehrere Dateien auswählen | Alle Bilder im Pool | ✓ Funktioniert wie erwartet |

---

### 🖱️ 3. CONTEXT-MENU (Rechtsklick auf Bild)

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 3.1 | Menu öffnen | Rechtsklick auf Pool-Bild | Context Menu erscheint | ✓ |
| 3.2 | Menu Position | Am Mauszeiger | Menu nicht außerhalb Bildschirm | ✓ |
| 3.3 | "Zum Spiel hinzufügen" | Option klicken | Bild erscheint im Game Strip | ✓ |
| 3.4 | "Aus Spiel entfernen" | Option klicken | Bild verschwindet aus Game Strip | ✓ |
| 3.5 | "Als Startbild setzen" | Option klicken | ⭐-Badge auf Bild | ✓ |
| 3.6 | "Als Endbild setzen" | Option klicken | 🏁-Badge auf Bild | ✓ |
| 3.7 | "Rolle entfernen" (sichtbar) | Bei Start/End-Bild | Option ist sichtbar | ✓ |
| 3.8 | "Rolle entfernen" (versteckt) | Bei normalem Bild | Option ist versteckt | ✓ |
| 3.9 | "Rolle entfernen" (Funktion) | Option klicken | Badge verschwindet | ✓ |
| 3.10 | "Bild löschen" | Option klicken | Bestätigungsdialog | ✓ |
| 3.11 | Löschen bestätigen | "OK" klicken | Bild wird gelöscht | ✓ |
| 3.12 | Menu schließen (Klick außerhalb) | Außerhalb klicken | Menu schließt | ✓ |
| 3.13 | Menu schließen (Escape) | Escape drücken | Menu schließt | ✓ schließt aber auch die Sidebar - ist aber auch ok. das dürfte die intention von ESC ann der Stelle sein, weil rehtsklick ja mit Maus ausgeführt wird. und Kontextmenu dann auch mit der Maus wieder geschlossen wird |
Bug1: Ist ein Bild gleichzeitig Start- oder Endbild, wird es nur ganz am Anfang im Strip angezeigt. In diesem Fall sollte es aber doppelt angezeigt werden (links und rechts).
Bug2: Wird ein Bild zum Spiel hinzugefügt kann es trotzdem noch als Start- oder Endbild gesetzt werden. Das sollte nicht möglich sein. Entweder wird die Option im Kontextmenü ausgeblendet oder es wird automatisch aus dem Spiel entfernt wenn es als Start/Endbild gesetzt wird (was einfacher umzusetzen ist).
Bug3: Dass Kontextmenü braucht einen Moment um sich zu regenerieren. Wenn ich z.B. ein Bild als Startbild setze, dann sofort wieder rechtsklicke, dann öffnet sich nicht das js ontextmenü sondern das Browser-eigene. Vermutlich weil das Kontextmenü-Element noch nicht neu gerendert wurde. Ein kurzes Delay oder ein fallback auf ein leeres Menü mit ladeanimation, dass immer geladen ist und dann auto refresh des menus sobald fertig gerendert könnte helfen.

---

### 🎮 4. GAME STRIP (Spielbilder-Leiste)

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 4.1 | Start-Bild Position | Startbild setzen | Erscheint ganz links im Strip | ✓ |
| 4.2 | End-Bild Position | Endbild setzen | Erscheint ganz rechts im Strip | ✓ |
| 4.3 | Spielbilder dazwischen | Mehrere Bilder hinzufügen | Zwischen Start und End | ✓ siehe Bug1 |
| 4.4 | Drag & Drop | Bild ziehen | Reihenfolge ändert sich | ✓ |
| 4.5 | Bild auswählen | Auf Bild klicken | Bild ist markiert (Rand) | ✓ |
| 4.6 | Scroll bei vielen Bildern | >10 Bilder hinzufügen | Horizontales Scrollen möglich | ☐ |
| 4.7 | Scroll-Buttons | Pfeile am Rand | Links/Rechts-Buttons funktionieren | ☐ |
| 4.8 | Leerer Strip | Keine Bilder | Platzhalter-Text | ☐ |

Feature Request: Im Pool sollte Strg+click mehrfachauswahl und Shift+click Bereichsauswahl und strg+a für alle Bilder möglich sein. Dann könnte man mehrere Bilder gleichzeitig zum Spiel hinzufügen oder löschen - fals die API Bulk-Operationen unterstützt - sonst über der API iterieren? (nicht schön, aber effizient und wir reden von max 10 Bildern in Bulk operationen, meist, wenn eine Veranstaltung entladen wird - da sind abbrüche verschmerzbar, dann löscht man den Rest einfach nochmal)

Bug4: Wird ein Bild ausgewählt und dann aus dem Strip entfernt (oder aus dem Pool gelöscht), wird die markierung im Strip nicht neu gesetzt. Das alte Bild bleibt in der Vorschau (existiert aber mglw. nicht mehr auf dem Server.)
Richtig: Ein Bild, dass grade aktivgespielt wird darf nicht gelöscht werden. Beim entfernen aus dem Strip oder Löschen aus dem Pool sollte geprüft werden ob das Bild grade aktiv ist. Wenn ja, dann Fehlermeldung "Bild kann nicht gelöscht/entfernt werden, da es grade aktiv im Spiel ist."
Wird ein Ausgewähltes Bild gelöscht oder entfernt, sollte automatisch das nächste Bild ausgewählt werden (oder das vorherige, wenn kein nächstes mehr da ist). Wenn kein Bild mehr da ist, dann keine Auswahl. Vorschau sollte entsprechend aktualisiert werden.
---

### 🕹️ 5. SPIELSTEUERUNG (Control Buttons)

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 5.1 | "Spiel starten" sichtbar | In Lobby-Phase | Button sichtbar & aktiv | ✓ |
| 5.2 | "Spiel starten" deaktiviert | Keine Bilder vorhanden | Button grau/disabled | ✓ |
| 5.3 | Spiel starten | Button klicken | Phase wechselt zu "Playing" | ☐  - nein zu "Bild aktiv" |
| 5.4 | "Aufdecken" sichtbar | In Playing-Phase | Button sichtbar | ✓ |
| 5.5 | Bild aufdecken | Button klicken | Spotlight-Canvas zeigt Bild | ✓ |
| 5.6 | Phase-Badge Update | Bei Phasenwechsel | Badge zeigt aktuelle Phase | ✓ |
| 5.7 | "Nächstes Bild" | Nach Aufdecken | Nächstes Bild wird geladen | ✓ |
| 5.8 | "Spiel beenden" | Button klicken | Phase wechselt zu "Ended" | ✓ |
| 5.9 | Fortschrittsanzeige | Während Spiel | Progress Bar aktualisiert sich | ☐ ganz rechts unten in der Ecke - nein |

---

### 🔦 6. SPOTLIGHT

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 6.1 | Spotlight-Canvas | Bild aufdecken | Canvas zeigt Bild mit Overlay | ✓ |
| 6.2 | Spotlight bewegen | Maus über Canvas | Spotlight folgt Cursor | ☐ |
| 6.3 | Spotlight klicken | Auf Canvas klicken | Spotlight bleibt fixiert | ☐ |
| 6.4 | Mehrere Spotlights | Mehrfach klicken | Mehrere fixierte Spotlights | ☐ |
| 6.5 | Spotlights löschen (Button) | Button klicken | Alle Spotlights weg | ☐ Kann nicht getestet werden. Folgefehler zu 6.2ff |
| 6.6 | Spotlights löschen (C) | Taste C drücken | Alle Spotlights weg | ☐ Kann nicht getestet werden. Folgefehler zu 6.2ff |
| 6.7 | Beamer-Sync | Spotlight bewegen | Beamer zeigt gleiches Spotlight | ☐ Spotlight funktioniert weder auf dem canvas noch  auf dem Beamer. Server loggt auch keinen Api-Aufruf. Auth kontrollieren? |

Bug5: Aufdecken Button enthüllt im canvas das Bild komplett. mouseover refresht das overlay. vielleicht ist das auch der grund, warum spotlight bewegen nicht funktioniert. weil das overlay sofort wieder drüber gezeichnet wird?
---

### 🏆 7. LEADERBOARD

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 7.1 | Leaderboard leer | Keine Spieler | "Noch keine Spieler" | ✓ |
| 7.2 | Spieler beigetreten | Player-Tab öffnen | Spieler erscheint in Liste | ☐ |
| 7.3 | Spieler-Count | Spieler beitreten | Zähler im Header aktualisiert | ☐ |
| 7.4 | Punkte anzeigen | Spieler hat Punkte | Score wird angezeigt | ☐ |
| 7.5 | Sortierung | Mehrere Spieler | Nach Punkten sortiert | ☐ |
| 7.6 | Live-Update | Punkte ändern sich | Leaderboard aktualisiert live | ☐ |

Layout: die Spieleranzahl nach der Überschrift "Leaderboard" braucht noch einen abstand oder ein Infobox style, damit es nicht so gequetscht aussieht.
---

### ⚙️ 8. SETTINGS MODAL

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 8.1 | Modal öffnen (Button) | ⚙️ Button klicken | Modal öffnet sich | ✓ |
| 8.2 | Modal öffnen (S) | Taste S drücken | Modal öffnet sich |  nein |
| 8.3 | Modal schließen (X) | X-Button klicken | Modal schließt | ✓ |
| 8.4 | Modal schließen (Escape) | Escape drücken | Modal schließt | ✓ |
| 8.5 | Tab-Wechsel | Tab-Buttons klicken | Inhalt wechselt | ✓ |

**Tab: Allgemein**
| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 8.6 | PIN aktivieren | Toggle einschalten | PIN-Schutz aktiv | ☐ nein - siehe oben |
| 8.7 | PIN ändern | Neuen PIN eingeben | PIN wird gespeichert | ☐ nein - siehe oben |
| 8.8 | PIN deaktivieren | Toggle ausschalten | Kein PIN mehr nötig | ☐ folgefehler |

**Tab: Namen (Wörterliste)**

Benenne das in Worterpool für 📱 Spieler - 
Diese Liste enthält die falschen antworten die die Spieler in der Auswahllisten angezeigt bekommen. 

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 8.9 | Wörterliste laden | Tab öffnen | Bestehende Wörter angezeigt | ✓ |
| 8.10 | Wort hinzufügen | Neues Wort eingeben | Wort in Liste |✓ |
| 8.11 | Wort entfernen | X bei Wort klicken | Wort entfernt | ☐ gibt es nicht, aber ich kann Wort aus der Liste Entfernen |
| 8.12 | Speichern | "Speichern" klicken | Toast "Gespeichert" | ✓ |

**Tab: Punkte (Scoring)**
| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 8.13 | Settings laden | Tab öffnen | Aktuelle Werte angezeigt | ✓ |
| 8.14 | Basispunkte ändern | Wert ändern | Wert aktualisiert | ✓ |
| 8.15 | Bonus aktivieren | Toggle einschalten | Bonus aktiv | ✓ aber Checkbox ist niccht richtig gestyled (wie bei pin) |
| 8.16 | Speichern | "Speichern" klicken | Toast "Gespeichert" | ✓ | Speichern Button schließt das Modal. Ergänze einen "Übernehmen" Modal, der die Einstellungen speichert, aber das Modal offen lässt. |

**Tab: Gefahr (Danger Zone)**
| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 8.17 | Soft Reset | Button klicken | Spiel zurückgesetzt | ✓ |
| 8.18 | Complete Reset | Button klicken | Alles zurückgesetzt | ✓ |
| 8.19 | Server Restart | Button klicken | Server startet neu | ✓ | (mal sehen, ob das auch nachher in Plesk funktioniert)
| 8.20 | Factory Reset | Button klicken | Bestätigungsdialog | ✓ |
| 8.21 | Factory bestätigen | Checkbox + Button | Alles gelöscht | ☐ | machich erst später--- erst alles testen

---

### ❓ 9. HELP MODAL

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 9.1 | Modal öffnen (?) | Taste ? drücken | Help Modal öffnet | ✓ |
| 9.2 | Modal öffnen (H) | Taste H drücken | Help Modal öffnet | ✓ |
| 9.3 | Inhalt | Modal ansehen | Shortcuts erklärt | ✓ |
| 9.4 | Modal schließen | Escape drücken | Modal schließt | ✓ |
Diese Funktion ist nirgends visuell angedeutet. Vielleicht einen kleinen "?" Button im Header ergänzen, der das Modal öffnet? oder (H)ilfe Button?

---

### ⌨️ 10. KEYBOARD-SHORTCUTS

| # | Taste | Erwartete Aktion | ✓ |
|---|-------|------------------|---|
| 10.1 | `Space` | Start Spiel (Lobby) / Aufdecken (Playing) | ✓ | (besser "Enter" startet das Spiel, Space deckt auf. Enter ist immer weiter, space immer aufdecken - Enter würde dann auch das End bild anzeigen, wenn kein nächstes Bild mehr da ist) 
| 10.2 | `Enter` | Nächstes Bild (nach Aufdecken) | ☐ |
| 10.3 | `←` (ArrowLeft) | Vorheriges Bild auswählen | ✓ | kann auch schon gespielte Bilder auswählen - das soll nicht möglich sein
| 10.4 | `→` (ArrowRight) | Nächstes Bild auswählen | ✓ | s.o.
| 10.5 | `Q` | QR-Code Toggle | ☐ | 23:51:48.671 debug [SOCKET][6c9f9bc1] IN admin:toggle_qr {"socketId":"mGrYme-z","data":{"visible":false}}
23:51:48.671 info  Admin toggled QR {"enabled":false}
23:51:49.413 debug [SOCKET][6c9f9bc1] IN admin:toggle_qr {"socketId":"mGrYme-z","data":{"visible":false}}
23:51:49.413 info  Admin toggled QR {"enabled":false}
| 10.6 | `B` | Beamer öffnen (neues Tab) | ✓ |
| 10.7 | `S` | Settings Modal öffnen | ✓ |
| 10.8 | `H` | Help Modal öffnen | ✓ |
| 10.9 | `?` | Help Modal öffnen | ✓ |
| 10.10 | `C` | Spotlights löschen | ☐ | kann ich nochnicht testen
| 10.11 | `Escape` | Schließt alles (Modal, Sidebar, Menu) | ✓ |

**Wichtig:** Shortcuts sollten NICHT funktionieren wenn:
- Ein Input-Feld fokussiert ist
- Ein Modal offen ist (außer Escape)

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 10.12 | In Input-Feld | Text eingeben + Space | Leerzeichen, kein Spiel-Start | ✓ |
| 10.13 | Modal offen | Modal öffnen + S | Kein zweites Modal |s |

---

### 👥 11. MULTI-ADMIN

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 11.1 | Badge versteckt | Nur 1 Admin | Kein Badge sichtbar | ✓ |
| 11.2 | 2. Admin verbindet | 2. Tab öffnen | Toast-Warnung erscheint | ✓ erscheint doppelt |
| 11.3 | Badge sichtbar | Bei 2+ Admins | "⚠️ 2 Admins" Badge im Header | ✓ |
| 11.4 | Badge pulsiert | Bei 2+ Admins | Rote Animation | ✓ |
| 11.5 | Badge verschwindet | 2. Tab schließen | Badge hidden | ✓ |

---

### 🔔 12. TOAST NOTIFICATIONS

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 12.1 | Success Toast | Bild hochladen | Grüner Toast erscheint | ✓ |
| 12.2 | Warning Toast | Multi-Admin | Gelber Toast erscheint | ✓ |
| 12.3 | Error Toast | Fehler provozieren | Roter Toast erscheint | ✓ |
| 12.4 | Toast verschwindet | Warten | Nach ~3s automatisch weg | ✓ | mach 4 Sekunden 
| 12.5 | Toast manuell schließen | X klicken | Toast sofort weg | ✓ |

---

### 📺 13. BEAMER-SYNCHRONISATION

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 13.1 | Beamer zeigt Bild | Bild aufdecken | Beamer zeigt gleiches Bild | ✓ |
| 13.2 | Spotlight-Sync | Admin bewegt Spotlight | Beamer zeigt Spotlight | ☐ nein |
| 13.3 | QR-Code Sync | Q drücken | Beamer zeigt/versteckt QR | ☐ nein |
| 13.4 | Phase-Sync | Phase wechseln | Beamer reagiert entsprechend | ✓ |
| 13.5 | Start/End-Bilder | Spiel starten/beenden | Beamer zeigt Start/End-Bild | ☐ nein. start bild wird schwarz überlegt. End bild wird von Leaderboard geschluckt (Transparenter Hintergrund für Leaderboard. Leaderboard kann optional eingeblendet werden. toggle switch direkt in der UI bei der Überschrift.|

---

### 📱 14. RESPONSIVE DESIGN (optional) wird später getestet

| # | Test | Schritte | Erwartung | ✓ |
|---|------|----------|-----------|---|
| 14.1 | Desktop (1920px) | Fenster maximieren | Alles sichtbar | ✓ |
| 14.2 | Laptop (1366px) | Fenster verkleinern | Layout passt sich an | ✓ | Vorschlag: setz das Leaderboard als Modal aufeinen Button, der im Header um die Anzahl der Spieler erscheint. 
| 14.3 | Tablet (768px) | DevTools Tablet | Bedienbar | ☐ |
| 14.4 | Mobile (375px) | DevTools Mobile | Grundfunktionen nutzbar | ☐ |

---

## 🐛 BEKANNTE EINSCHRÄNKUNGEN

### Nicht implementiert (bewusst):
- TODO-002: `/api/game-images/reset-played` - wird durch Soft-Reset abgedeckt
- TODO-003: `admin:set_join_host` - Server setzt Host automatisch

### Legacy/Unused (dokumentiert):
- `js/admin/state.js` - Modular State, aber nicht integriert
- `js/admin/modals.js` - Funktionen inline in main.js
- `js/admin/keyboard.js` - Funktionen inline in main.js
- `js/admin/toast.js` - Funktionen inline in main.js
- `js/admin/sidebar.js` - Teilweise genutzt (Upload)
- `js/admin/ui-controller.js` - Nicht verwendet

---

## 📁 Aktuelle Dateistruktur

```
client/
├── admin.html              # Alt (Fallback)
├── admin-new.html          # Neu ✅ (Feature-Complete)
├── css/
│   ├── admin.css           # Alt
│   ├── admin-new.css       # Neu (importiert Module)
│   └── admin/              # CSS Module (13 Dateien)
└── js/
    ├── admin.js            # Alt (Fallback)
    ├── admin/
    │   ├── main.js         # Neu ✅ (Haupt-Entry, ~2200 Zeilen)
    │   └── *.js            # Legacy Module (dokumentiert)
    ├── socket-adapter.js   # Shared
    └── spotlight-renderer.js # Shared
```

---

## 📜 Changelog

### V3 (2025-12-04)
- ✅ TODO-007: Admin Session Badge im Header implementiert
- ✅ Umfassende Test-Checkliste mit 100+ Testfällen
- 📝 Legacy Module als "dokumentiert, nicht verwendet" markiert
- 🎉 **Feature-Complete** - Bereit für manuelle Tests

### V2.1 (2025-12-04)
- ✅ TODO-001: Context Menu clear-role implementiert
- ✅ TODO-004: Keyboard-Shortcuts erweitert (B, S, H, C, Escape)

### V2 (2025-12-04)
- Sprint 1 & 2 als ABGESCHLOSSEN dokumentiert
- Detaillierte TODO-Liste mit IDs erstellt

### V1 (2025-12-04)
- Initiale Analyse erstellt
- Socket/API/UI Gap-Analysis durchgeführt

---

## 🚀 Nächste Schritte

1. **Manuelle Tests durchführen** (diese Checkliste)
2. **Bugs dokumentieren** und fixen
3. **Nach erfolgreichem Test:** Datei-Umbenennung
   - `admin.html` → `admin-backup.html`
   - `admin-new.html` → `admin.html`

---

**Status: Feature-Complete, bereit für Test-Phase! 🎉**
