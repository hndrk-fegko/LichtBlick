# LichtBlick E2E Tests

Playwright-basierte End-to-End Tests für die LichtBlick Multiplayer-Anwendung.

## 📁 Struktur

```
tests/
├── docs/              # Test-Dokumentation
│   ├── README.md      # Ausführliche Test-Anleitung
│   ├── TEST_RESULTS.md   # Letzte Test-Ergebnisse
│   ├── TEST_SUMMARY.md   # Test-Zusammenfassung
│   └── TEST_COVERAGE.md  # Test-Abdeckung
├── e2e/               # E2E Test-Specs
│   ├── admin.spec.js
│   ├── auth.spec.js
│   ├── gameplay.spec.js
│   ├── multiplayer.spec.js
│   └── profile.spec.js
├── fixtures/          # Test-Fixtures
│   └── base.js
└── helpers/           # Helper-Funktionen
    ├── db-setup.js
    ├── server.js
    ├── test-data.js
    └── websocket.js
```

## 🚀 Tests ausführen

```bash
# Alle Tests
npm run test:e2e

# Mit UI
npm run test:e2e:ui

# Nur ein Browser
npm run test:e2e:chromium

# Debug-Modus
npm run test:e2e:debug

# Test-Report anzeigen
npm run test:e2e:report
```

## 📖 Weitere Dokumentation

Siehe [`docs/README.md`](./docs/README.md) für ausführliche Informationen über:
- Test-Setup und Konfiguration
- Einzelne Test-Cases
- Test-Ergebnisse und Coverage
- Bekannte Probleme

## ⚙️ Konfiguration

Die Playwright-Konfiguration befindet sich in [`tests/playwright.config.js`](./playwright.config.js).

Die Test-Scripts in `package.json` verweisen automatisch auf diese Config mit dem `--config` Parameter.
