/**
 * Database Setup Helper for LichtBlick E2E Tests
 * Handles test database preparation and cleanup
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { testUsers } = require('./test-data');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/lichtblick-test.db');

/**
 * Setup test database with test users and initial data
 * @returns {Promise<Function>} Cleanup function
 */
async function setupTestDatabase() {
  console.log('Setting up test database...');
  
  // Use the existing database or create test-specific one
  // For now, we'll use the main database as tests will run in isolation
  // and clean up after themselves
  
  return async () => {
    // Cleanup function
    await cleanupTestDatabase();
  };
}

/**
 * Clean up test data from database
 */
async function cleanupTestDatabase() {
  console.log('Cleaning up test database...');
  
  // Note: In production, we'd clean up specific test data
  // For this implementation, each test should handle its own cleanup
  // or we use the existing database and rely on game isolation
}

/**
 * Reset database to initial state
 * Useful for integration tests that need a clean slate
 */
async function resetDatabase() {
  console.log('Resetting database to initial state...');
  
  // This would drop all tables and recreate them
  // For now, we'll skip this as it's destructive
  // Tests should be designed to work with existing data
}

/**
 * Create a test player in the database
 * @param {Object} playerData - Player data
 * @returns {Promise<number>} Player ID
 */
async function createTestPlayer(playerData) {
  // This would insert a player into the database
  // For now, tests will use the API to create players
  console.log('Creating test player:', playerData.name);
  return 1; // Mock ID
}

/**
 * Get admin token from database
 * @returns {Promise<string>} Admin token
 */
async function getAdminToken() {
  try {
    const dbPath = path.join(__dirname, '../../data/lichtblick.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.warn('Database does not exist yet. It will be created on server start.');
      return null;
    }
    
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
    stmt.bind(['adminToken']);
    
    let token = null;
    if (stmt.step()) {
      const result = stmt.get();
      if (result && result[0]) {
        token = result[0].replace(/"/g, ''); // Remove quotes if present
      }
    }
    
    stmt.free();
    db.close();
    
    return token;
  } catch (error) {
    console.error('Error getting admin token:', error.message);
    return null;
  }
}

/**
 * Wait for database to be ready
 * @param {number} maxWaitMs - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} True if ready, false if timeout
 */
async function waitForDatabase(maxWaitMs = 30000) {
  const dbPath = path.join(__dirname, '../../data/lichtblick.db');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    if (fs.existsSync(dbPath)) {
      try {
        const SQL = await initSqlJs();
        const buffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(buffer);
        db.exec('SELECT 1');
        db.close();
        console.log('Database is ready');
        return true;
      } catch (error) {
        // Database exists but not ready yet
      }
    }
    
    // Wait 500ms before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error('Database not ready after', maxWaitMs, 'ms');
  return false;
}

module.exports = { 
  setupTestDatabase, 
  cleanupTestDatabase,
  resetDatabase,
  createTestPlayer,
  getAdminToken,
  waitForDatabase
};
