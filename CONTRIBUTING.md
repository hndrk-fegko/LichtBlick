# Contributing to LichtBlick

Vielen Dank für dein Interesse, zu diesem Projekt beizutragen! 🎉

## 🐛 Bugs melden

Wenn du einen Bug gefunden hast:

1. **Prüfe erst**, ob der Bug bereits in [`docs/ANDOCK_PLAN_V4.md`](docs/ANDOCK_PLAN_V4.md) dokumentiert ist
2. **Öffne ein Issue** mit folgenden Informationen:
   - Beschreibung des Problems
   - Schritte zur Reproduktion
   - Erwartetes vs. tatsächliches Verhalten
   - Screenshots (falls hilfreich)
   - Browser/Node.js Version
   - Konsolen-Logs (falls vorhanden)

## 💡 Feature-Requests

Feature-Anfragen sind willkommen! Bitte beschreibe:

- **Problem:** Welches Problem löst das Feature?
- **Lösung:** Wie sollte es funktionieren?
- **Alternativen:** Hast du andere Lösungsansätze erwogen?
- **Kontext:** Wann/wo würdest du das Feature nutzen?

## 🔧 Code beisteuern

### Workflow

1. **Fork** das Repository
2. **Clone** dein Fork: `git clone https://github.com/your-username/lichtblick.git`
3. **Branch** erstellen: `git checkout -b feature/deine-feature-beschreibung`
4. **Änderungen** durchführen
5. **Commit** mit aussagekräftiger Message: `git commit -m "Fix: Spotlight Canvas Cursor-Tracking"`
6. **Push**: `git push origin feature/deine-feature-beschreibung`
7. **Pull Request** öffnen

### Code-Style

- **JavaScript:** ES6+, kein TypeScript
- **Kommentare:** Englisch für Code, Deutsch für User-Messages
- **JSDoc:** Für komplexe Funktionen
- **Formatierung:** 2 Spaces Indentation
- **Semicolons:** Ja (verwenden)

### Commit-Messages

Verwende aussagekräftige Commit-Messages:

```
Fix: Spotlight Canvas nicht responsiv auf Cursor
Add: Scroll-Buttons für Game Strip (>10 Bilder)
Refactor: State Management in admin/state.js
Docs: API-Dokumentation aktualisiert
```

### Testen

Bitte teste deine Änderungen vor dem Commit:

```bash
cd server
npm test

# Manueller Test
npm start
# Dann Browser öffnen und Features testen
```

### Pull Request Checklist

- [ ] Code läuft ohne Fehler
- [ ] Tests bestehen (falls vorhanden)
- [ ] Dokumentation aktualisiert (falls nötig)
- [ ] Keine unnötigen `console.log()` mehr drin
- [ ] Commit-Messages sind aussagekräftig

## 🎯 Prioritäten (Stand: Dezember 2025)

### Kritische Bugs (siehe `docs/ANDOCK_PLAN_V4.md`)

1. **Spotlight Canvas** - Cursor-Tracking funktioniert nicht
2. **PIN-Schutz UI** - Nicht sichtbar/styled
3. **Drag & Drop Upload** - Funktioniert nicht
4. **Auth-Modal** - Nicht styled
5. **QR-Toggle** - Sendet immer `false`

### Wichtige Features

- Game Strip Scroll-Buttons (>10 Bilder)
- Progress Bar anzeigen
- Start/End-Bild Duplikat-Handling
- Aktives Bild löschen verhindern

## 📚 Hilfreiche Ressourcen

- **Dokumentation:** [`docs/`](docs/) - Vollständige Projekt-Docs
- **API-Spezifikation:** [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- **Architektur:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Bug-Tracking:** [`docs/ANDOCK_PLAN_V4.md`](docs/ANDOCK_PLAN_V4.md)

## ❓ Fragen?

Wenn du Fragen hast oder Hilfe brauchst:

- Öffne ein **Discussion** auf GitHub
- Oder ein **Issue** mit dem Label `question`

## 📄 Lizenz

Mit deinem Beitrag stimmst du zu, dass dein Code unter der [MIT License](LICENSE) veröffentlicht wird.

---

**Danke, dass du LichtBlick besser machst! ❤️**
