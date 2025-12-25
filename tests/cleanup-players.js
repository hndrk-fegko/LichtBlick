/**
 * Cleanup Script - Remove test players from database
 */

require('dotenv').config({ path: '../server/.env' });
const mysql = require('mysql2/promise');

async function cleanup() {
  console.log('🧹 Cleaning up test players...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'lichtblick',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'lichtblick'
  });

  try {
    // Count players
    const [players] = await connection.query('SELECT COUNT(*) as count FROM players');
    console.log(`📊 Aktuelle Spieleranzahl: ${players[0].count}`);

    // Delete all players (test cleanup)
    const [result] = await connection.query('DELETE FROM players');
    console.log(`✅ ${result.affectedRows} Spieler gelöscht`);

    // Also delete answers
    const [answers] = await connection.query('DELETE FROM answers');
    console.log(`✅ ${answers.affectedRows} Antworten gelöscht`);

    console.log('\n✨ Datenbank aufgeräumt!');

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    await connection.end();
  }
}

cleanup();
