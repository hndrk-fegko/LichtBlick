# Deployment auf Plesk Shared Hosting

Diese Anleitung beschreibt die Schritte zum Deployen von LichtBlick auf Plesk Shared Hosting.

## Voraussetzungen

- Plesk Shared Hosting mit Node.js-Unterstützung
- SSH-Zugriff oder FTP-Zugriff
- Node.js Version 20.x oder höher

## Warum funktioniert LichtBlick jetzt auf Plesk?

LichtBlick verwendet jetzt **sql.js** statt **better-sqlite3**. Der wichtigste Unterschied:

- ❌ **better-sqlite3**: Benötigt native Kompilierung (node-gyp, C++ Compiler, Python)
- ✅ **sql.js**: Reine JavaScript/WebAssembly-Implementierung, keine native Kompilierung nötig

Auf Shared Hosting sind Build-Tools nicht verfügbar, daher ist sql.js die ideale Lösung.

## Schritt-für-Schritt-Anleitung

### 1. Repository vorbereiten

Lade den gesamten LichtBlick-Ordner herunter oder clone das Repository:

```bash
git clone https://github.com/hndrk-fegko/LichtBlick.git
cd LichtBlick
```

### 2. Dateien auf Server hochladen

Upload die folgenden Ordner/Dateien per FTP oder SSH:

```
/lichtblick.feg-koblenz.de/
├── server/              # Server-Code (Backend)
├── client/              # Client-Code (Frontend) 
├── data/                # Datenbank und Uploads
├── package.json         # Root package.json (optional)
└── .env                 # Umgebungsvariablen (optional)
```

**Wichtig**: Lade **ALLE** Dateien hoch, nicht nur den server-Ordner!

### 3. Plesk Node.js-Einstellungen konfigurieren

Gehe in Plesk zu: **Websites & Domains** → **Node.js**

#### Grundeinstellungen:

| Einstellung | Wert |
|-------------|------|
| **Node.js-Version** | `23.11.1` (oder höher, mindestens 20.x) |
| **Package Manager** | `npm` |
| **Anwendungsmodus** | `production` |
| **Anwendungsstamm** | `/lichtblick.feg-koblenz.de/server` |
| **Anwendungsstartdatei** | `index.js` |
| **Dokumentenstamm** | `/lichtblick.feg-koblenz.de/client` |

#### Umgebungsvariablen (optional):

Falls gewünscht, kannst du folgende Variablen setzen:

```
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
```

### 4. Dependencies installieren

Im Plesk Node.js-Panel:

1. Klicke auf **"NPM installieren"** oder den entsprechenden Button
2. Plesk führt automatisch `npm install` im Anwendungsstamm (`/server`) aus
3. Warte, bis die Installation abgeschlossen ist (kann 1-2 Minuten dauern)

**Erwartete Ausgabe:**
```
added 452 packages in 5s
found 0 vulnerabilities
```

### 5. Anwendung starten

1. Klicke auf **"Anwendung starten"** oder **"Restart App"**
2. Warte ca. 5-10 Sekunden
3. Status sollte "Running" anzeigen

### 6. Zugriff testen

#### Admin-Panel:

Nach dem ersten Start generiert der Server einen Admin-Token. Um ihn zu sehen:

1. Gehe zu **Protokolle** im Plesk Node.js-Panel
2. Suche nach Zeilen wie:
   ```
   🔐 ADMIN-ZUGANG (diesen Link nicht teilen!):
   http://lichtblick.feg-koblenz.de/admin.html?token=XXXXXXXXXXXX
   ```
3. Kopiere diesen Link und öffne ihn im Browser

#### Player-Join-Seite:

```
http://lichtblick.feg-koblenz.de/player.html
```

### 7. Datenbank-Speicherort

Die SQLite-Datenbank wird hier gespeichert:

```
/lichtblick.feg-koblenz.de/data/lichtblick.db
```

**Wichtig**: Dieser Ordner muss Schreibrechte haben! Plesk setzt dies normalerweise automatisch.

Falls es Probleme gibt, setze die Rechte manuell per SSH:

```bash
chmod 755 /lichtblick.feg-koblenz.de/data
chmod 644 /lichtblick.feg-koblenz.de/data/lichtblick.db
```

### 8. Uploads-Ordner

Hochgeladene Bilder werden hier gespeichert:

```
/lichtblick.feg-koblenz.de/data/uploads
```

Auch dieser Ordner benötigt Schreibrechte:

```bash
chmod 755 /lichtblick.feg-koblenz.de/data/uploads
```

## Fehlerbehebung

### Problem: "npm install" schlägt fehl

**Lösung**: Überprüfe, ob alle Dateien hochgeladen wurden, insbesondere:
- `server/package.json`
- `server/package-lock.json`

### Problem: Server startet nicht

**Lösung**: Überprüfe die Logs in Plesk:
1. Gehe zu Node.js-Anwendung
2. Klicke auf **"Protokolle"** oder **"Logs"**
3. Suche nach Fehlermeldungen

Häufige Fehler:
- **Port bereits belegt**: Ändere die `PORT`-Umgebungsvariable
- **Keine Schreibrechte**: Setze Dateirechte für `data/`-Ordner

### Problem: Admin-Token nicht sichtbar

**Lösung**: Schaue in die Logs (siehe oben). Der Token wird beim ersten Start ausgegeben.

Alternativ kannst du den Token aus der Datenbank auslesen:

```bash
sqlite3 /lichtblick.feg-koblenz.de/data/lichtblick.db "SELECT value FROM config WHERE key='adminToken'"
```

### Problem: Bilder können nicht hochgeladen werden

**Lösung**: 
1. Überprüfe Schreibrechte von `data/uploads/`
2. Überprüfe Multer-Konfiguration in `server/routes/uploads.js`
3. Prüfe Plesk-Limits für Datei-Uploads (maxFileSize)

### Problem: Datenbank wird nicht gespeichert

**Lösung**: 
- sql.js speichert die Datenbank nach jeder Schreiboperation automatisch
- Überprüfe Schreibrechte für `data/lichtblick.db`
- Falls die Datei nicht existiert, wird sie beim ersten Start erstellt

## Performance-Tipps

### 1. Node.js Version

Verwende mindestens Node.js 20.x für optimale Performance.

### 2. Anwendungsmodus

Setze immer `production` für bessere Performance:
- Weniger Logging
- Optimierte Fehlerbehandlung
- Bessere Memory-Verwaltung

### 3. Memory Limit

Falls die App viel Memory benötigt, kannst du in Plesk das Memory-Limit erhöhen:
- Standard: 512 MB
- Empfohlen: 1024 MB (für größere Games)

## Unterschiede zu lokaler Entwicklung

| Aspekt | Lokal | Plesk Shared Hosting |
|--------|-------|---------------------|
| **Datenbank** | SQLite mit WAL-Mode | SQLite (sql.js) in-memory + auto-save |
| **Performance** | Schneller (native) | Etwas langsamer (JavaScript) |
| **Kompilierung** | Benötigt Build-Tools | Keine Build-Tools nötig |
| **Port** | 3000 (konfigurierbar) | Von Plesk zugewiesen |
| **Logs** | Konsole + Dateien | Plesk Logs |

## Sicherheit

### Admin-Token sichern

Der Admin-Token ist **sehr wichtig**! 

- ❌ **NICHT** den Token teilen oder öffentlich zugänglich machen
- ✅ Sichere den Token sicher ab (z.B. Password Manager)
- ✅ Bei Kompromittierung: Datenbank löschen und neu generieren lassen

### HTTPS verwenden

Plesk bietet kostenlose Let's Encrypt SSL-Zertifikate:
1. Gehe zu **Websites & Domains** → **SSL/TLS-Zertifikate**
2. Klicke auf **"Let's Encrypt"**
3. Wähle deine Domain und klicke auf **"Installieren"**

Nach der Installation:
- Admin-Panel: `https://lichtblick.feg-koblenz.de/admin.html?token=XXX`
- Player-Join: `https://lichtblick.feg-koblenz.de/player.html`

### Firewall / Rate Limiting

LichtBlick hat eingebautes Rate Limiting (express-rate-limit). 

Zusätzliche Plesk-Firewall-Regeln sind optional, aber empfohlen:
- Begrenze Requests pro IP
- Blockiere bekannte Bots
- Aktiviere ModSecurity (falls verfügbar)

## Backup

### Automatisches Backup

Richte ein regelmäßiges Backup ein:

1. **Datenbank**: `/lichtblick.feg-koblenz.de/data/lichtblick.db`
2. **Uploads**: `/lichtblick.feg-koblenz.de/data/uploads/`

Plesk bietet automatische Backups:
- Gehe zu **Websites & Domains** → **Backup Manager**
- Erstelle einen Backup-Plan (täglich/wöchentlich)

### Manuelles Backup

Per SSH:

```bash
# Datenbank
cp /lichtblick.feg-koblenz.de/data/lichtblick.db ~/backups/lichtblick-$(date +%Y%m%d).db

# Uploads
tar -czf ~/backups/uploads-$(date +%Y%m%d).tar.gz /lichtblick.feg-koblenz.de/data/uploads
```

## Updates

### Neue Version deployen

1. Stoppe die Anwendung in Plesk
2. Lade die neuen Dateien hoch (überschreibe alte)
3. Führe `npm install` aus (falls Dependencies geändert wurden)
4. Starte die Anwendung neu

**Wichtig**: Sichere **vorher** die Datenbank!

```bash
cp data/lichtblick.db data/lichtblick.db.backup
```

### Migration von better-sqlite3 zu sql.js

Falls du von einer älteren Version (mit better-sqlite3) upgradeest:

1. Sichere die Datenbank: `cp data/lichtblick.db data/lichtblick.db.backup`
2. Die neue Version (mit sql.js) kann die alte Datenbank direkt lesen
3. Beim ersten Start werden automatisch Migrations durchgeführt
4. Überprüfe die Logs auf Fehler

**Kompatibilität**: Die Datenbank-Struktur ist identisch, sql.js kann direkt SQLite-Dateien von better-sqlite3 lesen!

## Support

Bei Problemen:

1. Überprüfe die Logs in Plesk
2. Erstelle ein Issue auf GitHub: https://github.com/hndrk-fegko/LichtBlick/issues
3. Beschreibe das Problem mit:
   - Fehlermeldung
   - Plesk Node.js Version
   - Logs (falls vorhanden)

## Lizenz

LichtBlick ist unter der MIT-Lizenz lizenziert.
