# Copilot Instructions für LichtBlick

## Terminal-Nutzung & Server-Management

### ⚠️ WICHTIG: Hintergrund-Server nicht unterbrechen!

Wenn ein **Server im Hintergrund läuft** (z.B. `npm start` mit `isBackground: true`), darf dieser NICHT durch weitere Terminal-Befehle unterbrochen werden!

#### Problem:
- VS Code verwendet standardmäßig das gleiche Terminal für neue Befehle
- Ein laufender Server wird dabei beendet (SIGINT)

#### Workaround - IMMER diese Regeln befolgen:

1. **Server starten**: Immer mit `isBackground: true`
   ```
   run_in_terminal({ command: "npm start", isBackground: true })
   ```

2. **Weitere Befehle während Server läuft**: 
   - **NIEMALS** `run_in_terminal` verwenden wenn ein Server läuft!
   - Stattdessen: `Start-Process powershell -ArgumentList "-Command", "..."` verwenden
   - Oder: Befehle als separaten Prozess starten

3. **Für Tests während Server läuft** (z.B. curl, Invoke-WebRequest):
   ```powershell
   # RICHTIG: Als separaten Prozess starten
   Start-Process powershell -ArgumentList "-NoProfile -Command `"Invoke-RestMethod -Uri 'http://localhost:3000/api/test'`"" -Wait
   
   # FALSCH: Direkt im Terminal (beendet Server!)
   # run_in_terminal({ command: "Invoke-RestMethod ..." })
   ```

4. **Server-Output prüfen**: `get_terminal_output` mit der Terminal-ID verwenden

5. **Server beenden**: Nur wenn explizit gewünscht:
   ```powershell
   taskkill /f /im node.exe
   ```

### Wann ein NEUES Terminal öffnen?

| Situation | Aktion |
|-----------|--------|
| Server läuft, weitere Befehle nötig | `Start-Process powershell` |
| Server läuft, nur Output prüfen | `get_terminal_output` |
| Kein Server läuft | `run_in_terminal` normal nutzen |
| Server neu starten gewünscht | Erst `taskkill`, dann `run_in_terminal` |

### Beispiel für IT-DAU Test während Server läuft:

```powershell
# PROBLEM: Start-Process im gleichen Terminal beendet trotzdem den Server!
# LÖSUNG: Test-Skript als .ps1 Datei erstellen und User bitten es separat auszuführen

# 1. Erstelle test-security.ps1 mit create_file Tool
# 2. Informiere den User: "Bitte öffne ein neues Terminal und führe aus:"
#    .\test-security.ps1
```

### Praktischer Workaround - Start-Job:

**LÖSUNG**: Server als PowerShell Background-Job starten!

```powershell
# Server als Job im Hintergrund starten
$serverJob = Start-Job -ScriptBlock { 
    cd 'PFAD/ZUM/SERVER'
    node index.js 
}
Write-Host "Server gestartet als Job $($serverJob.Id)..."
Start-Sleep -Seconds 3  # Warten bis Server hochgefahren ist

# Tests ausführen
.\test-security.ps1

# Server beenden
Stop-Job $serverJob
Remove-Job $serverJob
```

**Vorteile:**
- Server läuft im Hintergrund
- Weitere Befehle können im gleichen Terminal ausgeführt werden
- Sauberes Beenden mit `Stop-Job`

## Projekt-spezifische Hinweise

- **Server-Verzeichnis**: `server/`
- **Server starten**: `cd server; npm start`
- **Admin-Token**: Wird beim Server-Start in der Konsole angezeigt
- **Logs**: `server/logs/`

## Code-Style

- JavaScript ES6+
- JSDoc-Kommentare für komplexe Funktionen
- Deutsche Benutzer-Meldungen, englische Code-Kommentare
