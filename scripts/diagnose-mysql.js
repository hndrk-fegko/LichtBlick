/**
 * MySQL Diagnose-Tool für Plesk
 * 
 * Testet verschiedene Verbindungsmöglichkeiten und gibt detaillierte Infos
 */

const path = require('path');
const fs = require('fs');

// Load .env
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 MySQL Diagnose-Tool für Plesk');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Zeige aktuelle Konfiguration
console.log('📋 Aktuelle .env Konfiguration:');
console.log('  DB_TYPE:', process.env.DB_TYPE);
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : 'NICHT GESETZT');

// 2. Teste verschiedene Verbindungsoptionen
async function testConnection(config, label) {
  console.log(`\n🔌 Teste: ${label}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   DB:   ${config.database || 'keine'}`);
  
  try {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection(config);
    console.log('   ✅ VERBINDUNG ERFOLGREICH!');
    
    // Zeige MySQL-Version
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`   📦 MySQL Version: ${rows[0].version}`);
    
    // Zeige verfügbare Datenbanken
    const [dbs] = await connection.query('SHOW DATABASES');
    console.log(`   📂 Verfügbare Datenbanken: ${dbs.map(d => d.Database).join(', ')}`);
    
    await connection.end();
    return true;
  } catch (err) {
    console.log(`   ❌ Fehler: ${err.message}`);
    console.log(`   📝 Code: ${err.code}`);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('   💡 Tipp: Zugangsdaten sind falsch oder User hat keine Berechtigung');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('   💡 Tipp: MySQL Server läuft nicht oder falscher Port/Host');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('   💡 Tipp: Datenbank existiert nicht');
    }
    return false;
  }
}

async function diagnose() {
  // Test 1: Verbindung OHNE Datenbank
  await testConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  }, 'Verbindung ohne Datenbank (nur Auth-Test)');

  // Test 2: Verbindung MIT Datenbank
  await testConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }, 'Verbindung mit Datenbank');

  // Test 3: Verbindung über 127.0.0.1 statt localhost
  if (process.env.DB_HOST === 'localhost') {
    await testConnection({
      host: '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    }, 'Verbindung über 127.0.0.1 statt localhost');
  }

  // Test 4: Verbindung über Plesk-spezifischen Host
  const pleskHost = 'localhost.localdomain';
  await testConnection({
    host: pleskHost,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }, `Verbindung über ${pleskHost} (Plesk-Standard)`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📝 Weitere Diagnose-Schritte:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('1. PLESK DATENBANK-USER PRÜFEN:');
  console.log('   - Login zu Plesk');
  console.log('   - Websites & Domains → Datenbanken');
  console.log('   - User "lichtblick" anklicken');
  console.log('   - Berechtigung für DB "lichtblick" prüfen');
  console.log('   - ggf. Passwort neu setzen\n');
  
  console.log('2. ALTERNATIVEN HOST-NAMEN IN PLESK:');
  console.log('   - localhost           (Standard)');
  console.log('   - 127.0.0.1          (IP statt Hostname)');
  console.log('   - localhost.localdomain (Plesk-spezifisch)');
  console.log('   - Der Host, der in Plesk unter "DB Server" angezeigt wird\n');
  
  console.log('3. COMMAND LINE TEST IM PLESK SERVER:');
  console.log('   mysql -u lichtblick -p -h localhost');
  console.log('   (dann Passwort eingeben)\n');
  
  console.log('4. MYSQL USER-BERECHTIGUNGEN PRÜFEN:');
  console.log('   Als root in MySQL:');
  console.log('   SELECT user, host FROM mysql.user WHERE user=\'lichtblick\';');
  console.log('   SHOW GRANTS FOR \'lichtblick\'@\'localhost\';\n');
  
  console.log('5. .ENV PASSWORT SONDERZEICHEN:');
  console.log('   Aktuelles Passwort enthält: ! # $');
  console.log('   In .env KEINE Anführungszeichen um Passwort!');
  console.log('   Richtig: DB_PASSWORD=SKwRrswiom5h!89#');
  console.log('   Falsch:  DB_PASSWORD="SKwRrswiom5h!89#"\n');
}

// Run diagnosis
diagnose().catch(err => {
  console.error('\n❌ Diagnose fehlgeschlagen:', err.message);
  process.exit(1);
});
