# Deployment Checkliste - LichtBlick v3.0

Diese Checkliste hilft beim Deployment auf ein Web-Hosting mit Node.js-Unterstützung.

---

## 📋 Vor dem Deployment

### 1. Code-Bereinigung

- [ ] **PowerShell Wrapper-Script entfernen/anpassen**
  - `server/start-dev.ps1` - Nur für lokale Entwicklung, nicht für Produktion
  - Auf Hosting-Plattform eigenen Process Manager nutzen (pm2, forever, etc.)

- [ ] **package.json Scripts prüfen**
  ```json
  "scripts": {
    "start": "node index.js",        // ✅ Für Produktion
    "dev": "powershell ...",          // ❌ Nur lokal - ggf. entfernen
    "dev:nodemon": "nodemon index.js" // ⚠️ Nur für Entwicklung
  }
  ```

- [ ] **nodemon.json** - Kann entfernt werden (nur Dev-Tool)

- [ ] **Server-Restart Feature prüfen**
  - `server/sockets/admin.js` → `admin:restart_server` Handler
  - Funktioniert nur mit Process Manager (pm2) oder Wrapper-Script
  - Ohne Process Manager: Button deaktivieren oder Warnung anzeigen

### 2. Environment & Konfiguration

- [ ] **Admin-PIN ändern**
  - Default ist `1234` - unbedingt ändern!
  - In Datenbank: `config` Tabelle, Key `adminPin`

- [ ] **Port-Konfiguration**
  - Default: `3000`
  - Prüfen ob Hosting-Provider anderen Port erwartet
  - Umgebungsvariable: `PORT`

- [ ] **CORS-Einstellungen prüfen**
  - `server/index.js` - CORS für Produktions-Domain konfigurieren

- [ ] **Rate Limiting anpassen**
  - `server/index.js` - Limits für Produktion ggf. verschärfen

### 3. Datenbank

- [ ] **SQLite-Datei Pfad**
  - Default: `data/lichtblick.db`
  - Sicherstellen, dass Verzeichnis existiert und beschreibbar ist

- [ ] **Backup-Strategie**
  - SQLite-Datei regelmäßig sichern
  - WAL-Modus beachten: `.db`, `.db-wal`, `.db-shm` Dateien

- [ ] **Uploads-Verzeichnis**
  - `data/uploads/` muss existieren und beschreibbar sein

### 4. Logging

- [ ] **Log-Verzeichnis**
  - `server/logs/` muss existieren
  - Auf Hosting-Plattform: Log-Rotation prüfen

- [ ] **Log-Level anpassen**
  - Für Produktion ggf. weniger verbose

---

## 🚀 Deployment-Schritte

### 1. Dateien hochladen

```
Benötigte Verzeichnisse:
├── client/           # Frontend (statische Dateien)
├── server/           # Backend
│   ├── db/
│   ├── routes/
│   ├── services/
│   ├── sockets/
│   ├── utils/
│   ├── index.js
│   └── package.json
├── data/             # Wird automatisch erstellt
│   ├── uploads/
│   └── lichtblick.db
└── docs/             # Optional - nur Dokumentation
```

### 2. Dependencies installieren

```bash
cd server
npm install --production
```

### 3. Server starten

**Mit PM2 (empfohlen):**
```bash
pm2 start index.js --name "lichtblick"
pm2 save
pm2 startup  # Auto-Start nach Reboot
```

**Ohne PM2:**
```bash
node index.js
```

### 4. Erreichbarkeit testen

- [ ] `http://[domain]/` → Sollte auf `player.html` weiterleiten
- [ ] `http://[domain]/admin.html` → Admin-Interface
- [ ] `http://[domain]/beamer.html` → Beamer-Ansicht
- [ ] WebSocket-Verbindung testen (Browser Console)

---

## ⚠️ Bekannte Einschränkungen

### Server-Neustart Button
- Funktioniert nur mit Process Manager (pm2)
- Ohne pm2: Server beendet sich, startet aber nicht neu
- **Empfehlung:** Button in Produktion ggf. ausblenden oder Warnung anzeigen

### SQLite Limitierungen
- Nicht für sehr hohe Last geeignet
- Bei >100 gleichzeitigen Spielern: PostgreSQL/MySQL erwägen

### Uploads
- Bilder werden im Dateisystem gespeichert
- Bei Cloud-Hosting (Heroku, etc.): S3/Cloudinary erwägen

---

## 🔒 Sicherheit

- [ ] HTTPS aktivieren (SSL-Zertifikat)
- [ ] Admin-PIN stark wählen (nicht `1234`!)
- [ ] Rate Limiting für API-Endpunkte
- [ ] Uploads: Dateityp-Validierung ist implementiert
- [ ] CORS auf Produktions-Domain beschränken

---

## 📱 Mobile/Responsive

- [ ] Player-Interface auf verschiedenen Geräten testen
- [ ] QR-Code Größe und Lesbarkeit prüfen
- [ ] Touch-Gesten auf Admin-Canvas testen

---

## 🧪 Funktionstests nach Deployment

1. [ ] Spieler können beitreten (QR-Code / URL)
2. [ ] Admin kann Spiel starten
3. [ ] Bilder werden korrekt angezeigt
4. [ ] Spotlight funktioniert (Admin → Beamer Sync)
5. [ ] Spieler können Antworten einloggen
6. [ ] Punkte werden korrekt berechnet
7. [ ] Leaderboard aktualisiert sich
8. [ ] Reset-Funktionen arbeiten korrekt

---

## 📝 Notizen

_Platz für hosting-spezifische Notizen:_

```
Hosting-Provider: ________________
Domain: ________________
Port: ________________
PM2 installiert: [ ] Ja [ ] Nein
SSL aktiv: [ ] Ja [ ] Nein
```

---

Letzte Aktualisierung: November 2025
