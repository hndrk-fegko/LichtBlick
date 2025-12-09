# Plesk Shared Hosting - Deployment Anleitung

Diese Anleitung beschreibt, wie Sie LichtBlick auf einem Plesk Shared Hosting mit MySQL/MariaDB deployen.

## Voraussetzungen

- Plesk Control Panel Zugang
- Node.js Support (Version 20.x oder höher)
- MySQL/MariaDB Datenbank
- SSH-Zugang (optional, aber empfohlen)

---

## Schritt 1: MySQL-Datenbank in Plesk anlegen

1. Öffne Plesk → **Datenbanken** → **Datenbank hinzufügen**
2. Erstelle eine neue Datenbank:
   - **Datenbankname:** `lichtblick` (oder beliebig)
   - **Datenbankbenutzer:** Neuen Benutzer anlegen
   - **Passwort:** Sicheres Passwort vergeben
3. Notiere dir die Zugangsdaten:
   - Host: meist `localhost` oder `127.0.0.1`
   - Port: meist `3306`
   - Datenbankname
   - Benutzername
   - Passwort

> **💡 Tipp:** Speichere diese Informationen sicher - du brauchst sie im nächsten Schritt!

---

## Schritt 2: Anwendung hochladen

### Option A: Git (empfohlen)

1. Öffne Plesk → **Git**
2. Repository hinzufügen:
   - **Repository URL:** `https://github.com/hndrk-fegko/LichtBlick.git`
   - **Branch:** `feature/mysql-shared-hosting` (oder `main` nach Merge)
3. Klicke auf **"Bereitstellen"**

### Option B: Manueller Upload

1. Lade das Repository herunter
2. Entpacke es lokal
3. Öffne Plesk → **Dateien** → **Dateimanager**
4. Lade den `server` Ordner in dein Web-Verzeichnis hoch

---

## Schritt 3: Node.js Anwendung konfigurieren

1. Öffne Plesk → **Node.js**
2. Klicke auf **"Node.js aktivieren"**
3. Stelle folgende Werte ein:

| Einstellung | Wert |
|-------------|------|
| **Node.js-Version** | 20.x oder höher |
| **Package Manager** | npm |
| **Dokumentenstamm** | `/httpdocs` (oder dein Web-Verzeichnis) |
| **Anwendungsmodus** | production |
| **Anwendungsstamm** | `/httpdocs/server` |
| **Anwendungsstartdatei** | `index.js` |

---

## Schritt 4: Umgebungsvariablen setzen

Klicke auf **"Benutzerdefinierte Umgebungsvariablen angeben"** und füge folgende Variablen hinzu:

```env
NODE_ENV=production
PORT=3000

# Datenbank-Konfiguration (Werte aus Schritt 1)
DB_HOST=localhost
DB_PORT=3306
DB_USER=dein_datenbank_benutzer
DB_PASSWORD=dein_passwort
DB_NAME=lichtblick

# CORS (setze deine Domain)
CORS_ORIGIN=https://deine-domain.de

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=../logs

# File Upload
UPLOAD_DIR=../data/uploads
MAX_FILE_SIZE=10485760
```

> **⚠️ Wichtig:** Ersetze `dein_datenbank_benutzer`, `dein_passwort` und `deine-domain.de` mit deinen tatsächlichen Werten!

---

## Schritt 5: NPM Install & Start

1. Klicke auf **"NPM Install"**
2. Warte bis die Installation abgeschlossen ist (kann 2-5 Minuten dauern)
3. Überprüfe, ob alle Dependencies erfolgreich installiert wurden
4. Klicke auf **"Anwendung aktivieren"** oder **"Neu starten"**

---

## Schritt 6: Anwendung testen

1. Öffne `https://deine-domain.de/api/health` 
   - Sollte `{"status":"ok"}` anzeigen
2. Beim ersten Start wird das Datenbank-Schema automatisch erstellt
3. Der Admin-Token wird in den **Logs** angezeigt:
   - Öffne Plesk → **Node.js** → **Logs**
   - Suche nach: `🔐 FIRST RUN - Admin Token generiert!`
   - Kopiere die Admin-URL

---

## Schritt 7: Verzeichnis-Berechtigungen

Stelle sicher, dass diese Verzeichnisse existieren und beschreibbar sind:

```bash
mkdir -p data/uploads
mkdir -p logs
chmod 755 data/uploads
chmod 755 logs
```

Falls du SSH-Zugang hast, führe diese Befehle im `server/` Verzeichnis aus.

---

## Troubleshooting

### Problem: "Cannot connect to database"

**Lösung:**
1. Überprüfe die Umgebungsvariablen (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
2. Teste die Datenbankverbindung in Plesk → **Datenbanken** → **phpMyAdmin**
3. Stelle sicher, dass der Datenbankbenutzer die richtigen Berechtigungen hat

### Problem: "npm install" schlägt fehl

**Lösung:**
1. Überprüfe, ob Node.js Version >= 20.x ist
2. Lösche `node_modules` und `package-lock.json`
3. Führe "NPM Install" erneut aus

### Problem: "Permission denied" bei File Uploads

**Lösung:**
1. Überprüfe die Verzeichnis-Berechtigungen für `data/uploads`
2. Stelle sicher, dass der Web-Server-User Schreibrechte hat
3. In Plesk: **Dateien** → Rechtsklick auf `data/uploads` → **Berechtigungen ändern**

### Problem: Anwendung startet nicht

**Lösung:**
1. Überprüfe die Logs in Plesk → **Node.js** → **Logs**
2. Stelle sicher, dass `index.js` im richtigen Verzeichnis liegt
3. Überprüfe, ob der PORT verfügbar ist (ggf. ändern)

---

## Wichtige Hinweise

### SQLite → MySQL Migrationshinweise

- Die Tabellen werden beim ersten Start automatisch erstellt
- **Bestehende SQLite-Daten werden NICHT automatisch migriert**
- Bei Bedarf: Daten manuell exportieren/importieren (siehe unten)

### Performance-Tipps

1. **Connection Pool:** Die Anwendung nutzt einen Connection Pool (max. 10 Connections)
2. **Indexes:** Alle wichtigen Indexes werden automatisch erstellt
3. **Caching:** Für bessere Performance kannst du einen Redis-Cache hinzufügen

### Sicherheit

1. **Admin-Token:** Der Admin-Token wird nur beim ersten Start generiert
2. **CORS:** Setze `CORS_ORIGIN` auf deine exakte Domain
3. **Umgebungsvariablen:** Niemals in Git committen!
4. **Backups:** Erstelle regelmäßige Datenbank-Backups in Plesk

---

## Daten von SQLite nach MySQL migrieren

Falls du bereits eine SQLite-Datenbank hast:

### Schritt 1: Daten exportieren (SQLite)

```bash
# Altes System
cd server
node -e "
const db = require('better-sqlite3')('../data/lichtblick.db');
const fs = require('fs');

// Export images
const images = db.prepare('SELECT * FROM images').all();
fs.writeFileSync('export-images.json', JSON.stringify(images, null, 2));

// Export games
const games = db.prepare('SELECT * FROM games').all();
fs.writeFileSync('export-games.json', JSON.stringify(games, null, 2));

// Export config
const config = db.prepare('SELECT * FROM config').all();
fs.writeFileSync('export-config.json', JSON.stringify(config, null, 2));

console.log('Export completed!');
"
```

### Schritt 2: Daten importieren (MySQL)

```bash
# Neues System mit MySQL
cd server
node -e "
const mysql = require('mysql2/promise');
const fs = require('fs');

async function importData() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Import images
  const images = JSON.parse(fs.readFileSync('export-images.json'));
  for (const img of images) {
    await pool.query(
      'INSERT INTO images (filename, url, is_start_image, is_end_image) VALUES (?, ?, ?, ?)',
      [img.filename, img.url, img.is_start_image, img.is_end_image]
    );
  }

  // Import config
  const config = JSON.parse(fs.readFileSync('export-config.json'));
  for (const cfg of config) {
    await pool.query(
      'INSERT INTO config (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [cfg.key, cfg.value, cfg.value]
    );
  }

  console.log('Import completed!');
  await pool.end();
}

importData();
"
```

---

## Unterschiede in der SQL-Syntax

Falls du eigene Queries schreibst, beachte:

| SQLite | MySQL |
|--------|-------|
| `AUTOINCREMENT` | `AUTO_INCREMENT` |
| `INTEGER PRIMARY KEY` | `INT PRIMARY KEY AUTO_INCREMENT` |
| `BOOLEAN` (0/1) | `TINYINT(1)` oder `BOOLEAN` |
| `datetime('now')` | `NOW()` |
| `strftime('%s', 'now')` | `UNIX_TIMESTAMP()` |
| `IFNULL()` | `IFNULL()` oder `COALESCE()` |
| `||` (concatenation) | `CONCAT()` |

---

## Support

Bei Problemen:

1. **Logs überprüfen:** Plesk → Node.js → Logs
2. **GitHub Issues:** [https://github.com/hndrk-fegko/LichtBlick/issues](https://github.com/hndrk-fegko/LichtBlick/issues)
3. **Dokumentation:** [docs/](../docs/)

---

## Weitere Ressourcen

- [Plesk Node.js Dokumentation](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/nodejs-support.77064/)
- [MySQL/MariaDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Node.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

**Made with ❤️ for Plesk Shared Hosting**
