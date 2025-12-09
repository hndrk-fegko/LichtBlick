/**
 * Database Abstraction Layer - Main Entry Point
 * 
 * Automatically selects database backend based on environment variables:
 * 1. DB_TYPE=none → No database (for npm install on shared hosting)
 * 2. DB_TYPE=mysql OR DB_HOST is set → MySQL
 * 3. Otherwise → SQLite (default for local development)
 */

const logger = require('../utils/logger');

// Determine database type from environment
function getDatabaseType() {
  const dbType = process.env.DB_TYPE;
  
  // Explicit type selection
  if (dbType === 'none') {
    return 'none';
  }
  
  if (dbType === 'mysql') {
    return 'mysql';
  }
  
  if (dbType === 'sqlite') {
    return 'sqlite';
  }
  
  // Auto-detect: if DB_HOST is set, use MySQL
  if (process.env.DB_HOST) {
    return 'mysql';
  }
  
  // Default fallback: SQLite
  return 'sqlite';
}

const DB_TYPE = getDatabaseType();

logger.info('Database backend selection', { 
  type: DB_TYPE,
  reason: process.env.DB_TYPE ? 'explicit DB_TYPE' : (process.env.DB_HOST ? 'DB_HOST detected' : 'default fallback')
});

// No database mode - used for npm install on shared hosting where better-sqlite3 can't compile
if (DB_TYPE === 'none') {
  logger.warn('⚠️  Database disabled (DB_TYPE=none). Application will not function properly!');
  logger.warn('⚠️  This mode is only for npm install on shared hosting.');
  
  // Export dummy object that throws on any method call
  const noDatabaseProxy = new Proxy({}, {
    get(target, prop) {
      if (prop === 'initialize') {
        return async () => {
          logger.warn('Database.initialize() called but DB_TYPE=none');
        };
      }
      return () => {
        throw new Error('Database is disabled (DB_TYPE=none). Set DB_TYPE=sqlite or DB_TYPE=mysql to enable.');
      };
    }
  });
  
  module.exports = noDatabaseProxy;
} 
// SQLite mode
else if (DB_TYPE === 'sqlite') {
  logger.info('Loading SQLite database backend...');
  const SQLiteDatabase = require('./sqlite');
  const db = new SQLiteDatabase();
  
  // Export immediately, initialization happens on first require
  // The singleton pattern ensures db is initialized before use
  module.exports = db;
  
  // Initialize in background
  db.initialize().then(() => {
    logger.info('SQLite database ready');
  }).catch(err => {
    logger.error('SQLite database initialization failed', { error: err.message });
    process.exit(1);
  });
}
// MySQL mode
else if (DB_TYPE === 'mysql') {
  logger.info('Loading MySQL database backend...');
  const MySQLDatabase = require('./mysql');
  const db = new MySQLDatabase();
  
  // Export immediately, initialization happens on first require
  module.exports = db;
  
  // Initialize in background
  db.initialize().then(() => {
    logger.info('MySQL database ready');
  }).catch(err => {
    logger.error('MySQL database initialization failed', { error: err.message });
    process.exit(1);
  });
}
