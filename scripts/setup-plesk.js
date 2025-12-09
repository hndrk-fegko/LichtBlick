/**
 * LichtBlick - Plesk Installation & Setup Script
 * 
 * Dieses Script:
 * 1. Prüft Datenbank-Verbindung
 * 2. Erstellt Datenbank-Schema (Tabellen)
 * 3. Generiert Admin-Token
 * 4. Gibt Admin-URL aus
 * 
 * Usage: node scripts/setup-plesk.js
 */

const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');

// Optional: Load .env if available (Plesk uses environment variables directly)
const envPath = path.join(__dirname, '../server/.env');
console.log(`\n🔍 Debug: Suche nach .env Datei in: ${envPath}`);
console.log(`🔍 Debug: Absoluter Pfad: ${path.resolve(envPath)}`);

try {
  const envExists = require('fs').existsSync(envPath);
  console.log(`🔍 Debug: .env Datei existiert: ${envExists ? 'JA' : 'NEIN'}`);
  
  if (envExists) {
    const envContent = require('fs').readFileSync(envPath, 'utf8');
    console.log(`🔍 Debug: .env Datei Größe: ${envContent.length} Bytes`);
    console.log(`🔍 Debug: .env Erste 100 Zeichen: ${envContent.substring(0, 100)}`);
  }
  
  const result = require('dotenv').config({ path: envPath, debug: true });
  if (result.error) {
    console.log(`⚠️  dotenv Fehler: ${result.error.message}`);
  } else {
    console.log(`✅ dotenv geladen: ${Object.keys(result.parsed || {}).length} Variablen`);
  }
} catch (err) {
  console.log(`⚠️  dotenv nicht verfügbar: ${err.message}`);
}

// Farben für Console Output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function box(title, content, color = 'cyan') {
  const line = '═'.repeat(63);
  console.log(`${colors[color]}${line}${colors.reset}`);
  console.log(`${colors[color]}${title}${colors.reset}`);
  console.log(`${colors[color]}${line}${colors.reset}`);
  if (content) {
    console.log(content);
    console.log(`${colors[color]}${line}${colors.reset}`);
  }
}

// Helper to prompt user for input
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function checkEnvironment() {
  log('\n📋 1. Umgebungs-Variablen prüfen...', 'bright');
  
  // Check command line arguments first
  const args = process.argv.slice(2);
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  }
  
  // Check if variables are set
  let DB_HOST = process.env.DB_HOST;
  let DB_NAME = process.env.DB_NAME;
  let DB_USER = process.env.DB_USER;
  let DB_PASSWORD = process.env.DB_PASSWORD;
  
  const required = {
    'DB_TYPE': process.env.DB_TYPE || 'mysql',
    'DB_HOST': DB_HOST || 'nicht gesetzt',
    'DB_NAME': DB_NAME || 'nicht gesetzt',
    'DB_USER': DB_USER || 'nicht gesetzt',
    'DB_PASSWORD': DB_PASSWORD ? '***gesetzt***' : 'nicht gesetzt',
    'NODE_ENV': process.env.NODE_ENV || 'production',
    'PORT': process.env.PORT || '3000'
  };
  
  for (const [key, value] of Object.entries(required)) {
    const status = value !== 'nicht gesetzt' ? '✅' : '❌';
    log(`  ${status} ${key}: ${value}`, value !== 'nicht gesetzt' ? 'green' : 'red');
  }
  
  // Exit if missing (non-interactive environment)
  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    log('\n❌ FEHLER: MySQL-Konfiguration fehlt!', 'red');
    log('\n💡 Bitte als Parameter übergeben:', 'yellow');
    log('  node scripts/setup-plesk.js DB_HOST=localhost DB_NAME=lichtblick DB_USER=lichtblick DB_PASSWORD=xxx', 'cyan');
    log('\nODER .env Datei korrekt befüllen:', 'yellow');
    log(`  Aktuelle .env: ${envPath}`, 'cyan');
    process.exit(1);
  }
}

async function testDatabaseConnection() {
  log('\n🔌 2. Datenbank-Verbindung testen...', 'bright');
  
  try {
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    await connection.ping();
    log('  ✅ Verbindung erfolgreich!', 'green');
    
    const [rows] = await connection.query('SELECT DATABASE() as db');
    log(`  ✅ Datenbank: ${rows[0].db}`, 'green');
    
    await connection.end();
    return true;
    
  } catch (error) {
    log('  ❌ Verbindungsfehler:', 'red');
    log(`     ${error.message}`, 'red');
    log('\nMögliche Ursachen:', 'yellow');
    log('  - MySQL-Server läuft nicht');
    log('  - Falsche Zugangsdaten in .env');
    log('  - Datenbank existiert nicht');
    log('  - Firewall blockiert Port 3306');
    process.exit(1);
  }
}

async function createDatabaseSchema() {
  log('\n🗄️  3. Datenbank-Schema erstellen...', 'bright');
  
  try {
    const mysql = require('mysql2/promise');
    const schemaPath = path.join(__dirname, '../server/db/schema.mysql.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });
    
    // SQL-Statements einzeln ausführen (sicherer als multipleStatements)
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
        // Tabelle existiert bereits - OK
      }
    }
    
    log('  ✅ Schema erfolgreich erstellt!', 'green');
    
    // Prüfe ob Tabellen existieren
    const [tables] = await connection.query('SHOW TABLES');
    log(`  ✅ ${tables.length} Tabellen gefunden:`, 'green');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      log(`     - ${tableName}`);
    });
    
    await connection.end();
    return true;
    
  } catch (error) {
    log('  ❌ Schema-Fehler:', 'red');
    log(`     ${error.message}`, 'red');
    process.exit(1);
  }
}

async function generateAdminToken() {
  log('\n🔐 4. Admin-Token generieren...', 'bright');
  
  try {
    const mysql = require('mysql2/promise');
    const crypto = require('crypto');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    // Prüfe ob Token bereits existiert
    const [existing] = await connection.query(
      'SELECT value FROM config WHERE key = ?',
      ['adminToken']
    );
    
    let token;
    if (existing.length > 0) {
      token = existing[0].value;
      log('  ℹ️  Admin-Token existiert bereits', 'yellow');
    } else {
      // Neuen Token generieren
      token = crypto.randomBytes(24).toString('base64url');
      await connection.query(
        'INSERT INTO config (key, value) VALUES (?, ?)',
        ['adminToken', token]
      );
      log('  ✅ Neuer Admin-Token generiert!', 'green');
    }
    
    await connection.end();
    return token;
    
  } catch (error) {
    log('  ❌ Token-Fehler:', 'red');
    log(`     ${error.message}`, 'red');
    process.exit(1);
  }
}

async function createDirectories() {
  log('\n📁 5. Verzeichnisse erstellen...', 'bright');
  
  const dirs = [
    '../data/uploads',
    '../server/logs'
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      log(`  ✅ ${dir}`, 'green');
    } catch (error) {
      log(`  ⚠️  ${dir} - ${error.message}`, 'yellow');
    }
  }
}

async function showAdminUrl(token) {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://lichtblick.feg-koblenz.de'
    : 'http://localhost:3000';
  
  const adminUrl = `${baseUrl}/admin.html?token=${token}`;
  
  box(
    '✅ Installation erfolgreich!',
    `\n🔐 Admin-URL:\n${adminUrl}\n\n💡 Speichere diese URL - sie wird bei jedem Neustart benötigt!\n\nℹ️  Token später abrufen mit:\n   node scripts/get-admin-token.js\n`,
    'green'
  );
}

async function main() {
  try {
    box('🚀 LichtBlick - Plesk Installation', null, 'cyan');
    
    await checkEnvironment();
    await testDatabaseConnection();
    await createDatabaseSchema();
    await createDirectories();
    const token = await generateAdminToken();
    
    log('\n✅ Setup abgeschlossen!', 'green');
    await showAdminUrl(token);
    
    log('\n📋 Nächste Schritte:', 'bright');
    log('  1. Node.js App in Plesk starten (oder neu starten)');
    log('  2. Admin-URL im Browser öffnen');
    log('  3. Bilder hochladen und Spiel konfigurieren');
    log('  4. Viel Spaß! 🎮\n');
    
  } catch (error) {
    log('\n❌ Setup fehlgeschlagen:', 'red');
    log(`   ${error.message}`, 'red');
    log(`\n${error.stack}`, 'red');
    process.exit(1);
  }
}

main();
