# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

**Bitte melde Sicherheitslücken NICHT öffentlich über GitHub Issues!**

Wenn du eine Sicherheitslücke entdeckt hast:

### 1. Sofort melden

- **E-Mail:** [Kontakt zur FeG Nahude einfügen]
- **Betreff:** "SECURITY: [Kurze Beschreibung]"

### 2. Beschreibung

Bitte gib folgende Informationen an:

- **Art der Schwachstelle** (z.B. XSS, SQL Injection, Auth-Bypass)
- **Betroffene Komponente** (z.B. Admin-Token, Upload, WebSocket)
- **Schritte zur Reproduktion**
- **Proof of Concept** (falls vorhanden)
- **Auswirkung** (was kann ein Angreifer damit tun?)

### 3. Erwartete Antwortzeit

- **Initial Response:** Innerhalb von 48 Stunden
- **Fix:** Abhängig von Schweregrad (1-14 Tage)
- **Disclosure:** Nach Fix-Deployment (koordiniert)

## Bekannte Sicherheitsmaßnahmen

### ✅ Bereits implementiert

1. **Admin-Token-Authentifizierung**
   - URL-basierter Token (32 Zeichen, base64url)
   - Generiert beim ersten Start
   - Stored in SQLite

2. **REST API Schutz**
   - Alle Admin-Endpoints erfordern Token
   - Middleware: `requireAdminToken()`

3. **WebSocket Security**
   - Admin-Zugriff nur nach erfolgreicher Auth
   - Separate Namespaces (`/admin`, `/beamer`, `/player`)

4. **File Upload**
   - Multer-basiert mit MIME-Type-Check
   - Max. 10 MB pro Datei
   - Max. 50 Dateien gesamt
   - Nur Bilder erlaubt (jpg, png, gif, webp)

5. **SQL Injection Prevention**
   - Better-sqlite3 mit Prepared Statements
   - Keine String-Konkatenation in Queries

6. **Input Validation**
   - `server/utils/validation.js`
   - Spieler-Namen: 2-20 Zeichen, keine HTML
   - Image-IDs: Integer-Validierung

### 🔴 Bekannte Schwachstellen (nicht kritisch für Offline-Deployment)

1. **Kein HTTPS**
   - Akzeptabel für lokale WLAN-Nutzung
   - Für Internet-Deployment: Reverse Proxy (Nginx/Caddy) empfohlen

2. **Kein Rate-Limiting auf WebSockets**
   - DOS möglich durch viele Socket-Connections
   - Mitigation: Express-Rate-Limit nur für REST

3. **Admin-Token im URL**
   - Bei Screen-Share sichtbar
   - Mitigation: PIN-Schutz zusätzlich implementiert (Settings)

4. **Keine Session-Timeouts**
   - Admin bleibt dauerhaft authentifiziert
   - Mitigation: Token nur für Event-Duration verwenden

## Security-Tests

Ein Penetration-Test-Script ist vorhanden:

```bash
# Server muss laufen
cd server
npm start

# In separatem Terminal
powershell -ExecutionPolicy Bypass -File test-security.ps1
```

Tests:
- REST API ohne Auth → sollte 401 zurückgeben
- Image Upload ohne Auth → sollte blockieren
- Admin-Endpoint Brute-Force → sollte blockieren

## Best Practices für Deployment

1. **Admin-Token sicher speichern**
   - Nicht im Git-Commit einchecken
   - Bei Factory-Reset neuer Token

2. **Firewall konfigurieren**
   - Port 3000 nur im lokalen Netzwerk öffnen
   - Kein Internet-Zugriff (falls nicht nötig)

3. **Logs überwachen**
   - `server/logs/error.log` auf verdächtige Aktivitäten prüfen
   - Rate-Limit-Warnings beachten

4. **Updates**
   - Node.js und Dependencies aktuell halten
   - `npm audit` regelmäßig ausführen

## Kontakt

Für nicht-sicherheitskritische Fragen:
- **GitHub Issues:** [Link einfügen]
- **Discussions:** [Link einfügen]

---

**Danke, dass du zur Sicherheit von LichtBlick beiträgst! 🔒**
