#!/usr/bin/env node

/**
 * MySQL Connection Test Script
 * Testet verschiedene Verbindungsvarianten für Plesk MariaDB
 */

const mysql = require('mysql2/promise');

// Lade .env falls vorhanden
try {
  require('dotenv').config({ path: '../server/.env', debug: true });
} catch (err) {
  console.log('⚠️  dotenv nicht verfügbar, verwende process.env');
}

const configs = [
  {
    name: 'localhost mit Port im host',
    host: 'localhost:3306',
    port: undefined,
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD || 'SKwRrswiom5h!89#',
    database: process.env.DB_NAME || 'lichtblick'
  },
  {
    name: 'localhost mit separatem Port',
    host: 'localhost',
    port: 3306,
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD || 'SKwRrswiom5h!89#',
    database: process.env.DB_NAME || 'lichtblick'
  },
  {
    name: '127.0.0.1 mit separatem Port',
    host: '127.0.0.1',
    port: 3306,
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD || 'SKwRrswiom5h!89#',
    database: process.env.DB_NAME || 'lichtblick'
  },
  {
    name: 'Unix Socket (falls verfügbar)',
    socketPath: '/var/run/mysqld/mysqld.sock',
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD || 'SKwRrswiom5h!89#',
    database: process.env.DB_NAME || 'lichtblick'
  },
  {
    name: 'Plesk typischer Socket',
    socketPath: '/var/lib/mysql/mysql.sock',
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD || 'SKwRrswiom5h!89#',
    database: process.env.DB_NAME || 'lichtblick'
  }
];

async function testConnection(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: ${config.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const displayConfig = { ...config };
  if (displayConfig.password) displayConfig.password = '***';
  console.log(JSON.stringify(displayConfig, null, 2));
  
  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Verbindung erfolgreich!');
    
    // Test Query
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as db, USER() as user');
    console.log('📊 Server Info:', rows[0]);
    
    // Teste ob Datenbank leer ist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📦 Anzahl Tabellen: ${tables.length}`);
    if (tables.length > 0) {
      console.log('   Vorhandene Tabellen:', tables.map(t => Object.values(t)[0]).join(', '));
    }
    
    await connection.end();
    return true;
  } catch (error) {
    console.log('❌ Fehler:', error.message);
    if (error.code) console.log('   Code:', error.code);
    if (error.errno) console.log('   Errno:', error.errno);
    return false;
  }
}

async function main() {
  console.log('\n🔍 MySQL/MariaDB Verbindungstest für Plesk\n');
  console.log(`Benutzer: ${process.env.DB_USER || 'lichtblick'}`);
  console.log(`Datenbank: ${process.env.DB_NAME || 'lichtblick'}`);
  console.log(`Passwort: ${process.env.DB_PASSWORD ? '***gesetzt***' : '❌ NICHT GESETZT'}\n`);
  
  let successCount = 0;
  
  for (const config of configs) {
    const success = await testConnection(config);
    if (success) successCount++;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Ergebnis: ${successCount}/${configs.length} Verbindungen erfolgreich`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (successCount === 0) {
    console.log('❌ Keine Verbindung möglich!\n');
    console.log('🔧 Mögliche Lösungen:');
    console.log('   1. Prüfe User-Berechtigungen in Plesk:');
    console.log('      → Datenbanken → Benutzer → lichtblick');
    console.log('      → Stelle sicher, dass "localhost" als Host eingetragen ist');
    console.log('   2. Prüfe ob der User alle Rechte auf die DB hat');
    console.log('   3. In Plesk: "Host access" könnte auf einen anderen Host beschränkt sein');
    console.log('   4. Versuche den User neu anzulegen mit explizitem localhost-Zugriff\n');
  }
}

main().catch(console.error);
