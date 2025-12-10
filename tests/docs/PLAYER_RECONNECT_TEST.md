# Player Reconnect Test Plan

## Problem
Player hatte Probleme beim Reload während eines aktiven Spiels:
- Bei Phase-Wechsel: ✅ Alle Infos korrekt
- Bei Reload: ❌ Seite lädt nicht den aktuellen Game-State

## Lösung
1. **Server-Side**: `player:reconnect` Event sendet jetzt `currentImageId` in der Response
2. **Client-Side**: Bei Reconnect zu aktivem Spiel wird direkt die Wortliste geladen

## Test-Szenarien

### Szenario 1: Reload in Lobby
**Schritte:**
1. Spieler joined in Lobby
2. Seite neu laden (F5)

**Erwartetes Verhalten:**
- ✅ Spieler landet wieder in Lobby
- ✅ Spielername wird angezeigt
- ✅ Spieler-Anzahl wird angezeigt
- ✅ "Warte auf Spielstart" Message sichtbar

### Szenario 2: Reload während aktiver Runde (Wortliste sichtbar)
**Schritte:**
1. Admin startet Spiel
2. Bild wird aufgedeckt (strip reveal)
3. Spieler sieht Wortliste
4. **Seite neu laden (F5)** ← HAUPTTEST

**Erwartetes Verhalten:**
- ✅ Spieler landet im Game-Screen
- ✅ Spielername oben links sichtbar
- ✅ **Wortliste wird geladen** ← KRITISCH
- ✅ Aktuelles Bild ist das richtige
- ✅ Score wird angezeigt
- ✅ Einloggen-Button ist verfügbar

**Console-Output Check:**
```
✅ Reconnected to active game, loaded imageId: [ID]
```

### Szenario 3: Reload nach Answer-Lock
**Schritte:**
1. Spieler ist in aktiver Runde
2. Spieler wählt Wort und loggt ein
3. Seite neu laden (F5)

**Erwartetes Verhalten:**
- ✅ Spieler landet im Game-Screen
- ✅ Wortliste wird geladen
- ✅ Eingeloggtes Wort ist markiert (wenn implementiert)
- ✅ Button zeigt "Bereits eingeloggt" an

### Szenario 4: Reload während Reveal-Phase
**Schritte:**
1. Admin deckt Bild komplett auf (reveal image)
2. Antwort wird gezeigt
3. Seite neu laden (F5)

**Erwartetes Verhalten:**
- ✅ Spieler landet im Game-Screen
- ✅ Reveal-Container ist sichtbar
- ✅ Wortliste ist versteckt
- ✅ "Deine Antwort" und "Richtige Antwort" werden angezeigt
- ✅ Punktzahl dieser Runde wird angezeigt

**Console-Output Check:**
```
✅ Reconnected to revealed phase: {...}
```

### Szenario 5: Reload am Ende (Ended Phase)
**Schritte:**
1. Spiel ist beendet
2. Endbildschirm mit Endpunktzahl sichtbar
3. Seite neu laden (F5)

**Erwartetes Verhalten:**
- ✅ Spieler landet im Result-Screen
- ✅ Finale Punktzahl wird angezeigt
- ✅ "Spiel beendet" Message sichtbar

### Szenario 6: Kurze Disconnect/Reconnect (ohne Reload)
**Schritte:**
1. Spieler ist in aktiver Runde
2. Internet-Verbindung kurz unterbrechen (DevTools offline mode)
3. Verbindung wiederherstellen

**Erwartetes Verhalten:**
- ✅ Socket reconnected automatisch
- ✅ Game-State bleibt erhalten
- ✅ Keine Seiten-Reload nötig
- ✅ Status-Indikator zeigt "Verbunden" an

## Code-Änderungen

### Server (`server/sockets/player.js`)
```javascript
// Line ~182: player:reconnect Event
callback({ 
  success: true, 
  data: { 
    playerId, 
    name: player.name,
    score: player.score,
    phase,
    imageRevealed,
    currentImageId  // ✨ NEU: ImageId direkt mitschicken
  } 
});
```

### Client (`client/js/player.js`)
```javascript
// Line ~245: attemptReconnect Function
else if (phase === 'playing' && !imageRevealed && response.data.currentImageId) {
  // Active game - Load word list directly with imageId from reconnect response
  currentImageId = response.data.currentImageId;
  
  // Ensure game UI is visible
  document.getElementById('word-list-container').style.display = 'block';
  document.getElementById('reveal-result').style.display = 'none';
  document.getElementById('submit-answer-btn').style.display = 'block';
  
  // Load word list for current image
  loadWordList(currentImageId);
  updateSubmitButton();
  
  console.log('✅ Reconnected to active game, loaded imageId:', currentImageId);
}
```

### API Route (Backup, falls Socket-Reconnect fehlschlägt)
```javascript
// server/routes/api.js
// GET /api/game/current-state
// Returns current game state for reconnecting players
```

## Debugging

### Browser Console Checks
```javascript
// Check if sessionStorage is set
sessionStorage.getItem('playerId')
sessionStorage.getItem('playerName')

// Check current phase
currentPhase  // sollte 'playing', 'revealed', 'lobby' oder 'ended' sein

// Check if word list is loaded
currentWordList.length  // sollte > 0 sein wenn Spiel aktiv
```

### Network Tab
- WebSocket Connection: sollte "101 Switching Protocols" zeigen
- `player:reconnect` Event: in WebSocket Frames sichtbar

### Server Logs
```
✅ Player reconnected { playerId: X, phase: 'playing', currentImageId: Y }
```

## Rollback Plan
Falls Probleme auftreten:
1. Revert changes in `player.js` (attemptReconnect function)
2. Revert changes in `player.js` (server socket handler)
3. Reload server

## Known Limitations
- Wenn Server während Spieler-Session neu startet, geht die Session verloren (sessionStorage wird gelöscht)
- Sehr alte Browser ohne sessionStorage Support funktionieren nicht
