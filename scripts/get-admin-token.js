/**
 * Admin Token aus Datenbank auslesen
 * 
 * Usage: node get-admin-token.js
 */

require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function getAdminToken() {
  try {
    const token = await db.getConfig('adminToken');
    
    if (!token) {
      console.error('❌ Kein Admin-Token gefunden!');
      console.log('\nMögliche Ursachen:');
      console.log('- Server wurde noch nie gestartet');
      console.log('- Datenbank ist leer (Factory Reset durchgeführt)');
      console.log('\nLösung: Server einmal starten, Token wird automatisch generiert');
      process.exit(1);
    }
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://lichtblick.feg-koblenz.de' 
      : 'http://localhost:3000';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 Admin Token gefunden!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nAdmin-URL:\n${baseUrl}/admin.html?token=${token}`);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`\nToken (nur falls benötigt): ${token}`);
    
  } catch (error) {
    console.error('❌ Fehler beim Auslesen:', error.message);
    console.log('\nDatenbank-Status:');
    console.log('- DB_TYPE:', process.env.DB_TYPE || 'auto (mysql wenn DB_HOST gesetzt)');
    console.log('- DB_HOST:', process.env.DB_HOST || 'nicht gesetzt');
    console.log('- DB_NAME:', process.env.DB_NAME || 'nicht gesetzt');
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

getAdminToken();
