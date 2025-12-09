/**
 * SQLite Database Manager
 * 
 * Wrapper for sql.js (pure JavaScript SQLite) for Plesk Shared Hosting compatibility
 * sql.js doesn't require native compilation (no node-gyp, C++, Python)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, process.env.DB_PATH || '../../data/lichtblick.db');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.isReady = false;
    this.initPromise = null;
  }

  /**
   * Initialize database (async)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Ensure data directory exists
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        // Initialize sql.js
        this.SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(DB_PATH)) {
          const buffer = fs.readFileSync(DB_PATH);
          this.db = new this.SQL.Database(buffer);
          logger.info('Database loaded from file', { path: DB_PATH });
        } else {
          this.db = new this.SQL.Database();
          logger.info('New database created', { path: DB_PATH });
        }

        // sql.js doesn't support PRAGMA in the same way, but we can still execute them
        // Note: WAL mode is not available in sql.js (in-memory with manual persistence)
        try {
          this.db.run('PRAGMA foreign_keys = ON');
        } catch (e) {
          logger.warn('PRAGMA foreign_keys failed (may not be supported)', { error: e.message });
        }

        // Apply migrations FIRST (before schema) to handle existing DBs
        this.applyMigrations();

        // Load schema (for new databases or to add new tables)
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        this.db.exec(schema);

        // Save to disk after initialization
        this.save();

        this.isReady = true;
        logger.info('Database initialized', { path: DB_PATH, engine: 'sql.js' });
      } catch (error) {
        logger.error('Database initialization failed', { error: error.message });
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Save database to disk
   * sql.js works in-memory, so we must explicitly persist changes
   */
  save() {
    if (!this.db) return;
    
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (error) {
      logger.error('Failed to save database', { error: error.message });
    }
  }

  /**
   * Execute SQL with auto-save
   * @param {string} sql - SQL statement
   * @returns {Object} - Result object
   */
  exec(sql) {
    if (!this.db) throw new Error('Database not initialized');
    const result = this.db.exec(sql);
    this.save();
    return result;
  }

  /**
   * Run SQL statement (wrapper for compatibility)
   * @param {string} sql - SQL statement
   * @param {Array} params - Parameters
   * @returns {Object} - Result with changes and lastInsertRowid
   */
  run(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(sql, params);
    
    // Get last insert rowid and changes
    const lastIdResult = this.db.exec('SELECT last_insert_rowid() as id');
    const changesResult = this.db.exec('SELECT changes() as changes');
    
    const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] || 0;
    const changes = changesResult[0]?.values[0]?.[0] || 0;
    
    this.save();
    
    return { 
      lastInsertRowid: Number(lastInsertRowid),
      changes: Number(changes)
    };
  }

  /**
   * Get single row (wrapper for compatibility)
   * @param {string} sql - SQL statement
   * @param {Array} params - Parameters
   * @returns {Object|null} - Row object or null
   */
  get(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      stmt.free();
      return row;
    }
    
    stmt.free();
    return null;
  }

  /**
   * Get all rows (wrapper for compatibility)
   * @param {string} sql - SQL statement
   * @param {Array} params - Parameters
   * @returns {Array} - Array of row objects
   */
  all(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    const rows = [];
    const columns = stmt.getColumnNames();
    
    while (stmt.step()) {
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      rows.push(row);
    }
    
    stmt.free();
    return rows;
  }

  /**
   * Prepare statement (wrapper for compatibility with better-sqlite3)
   * Returns an object with run(), get(), and all() methods
   * @param {string} sql - SQL statement
   * @returns {Object} - Statement-like object
   */
  prepare(sql) {
    if (!this.db) throw new Error('Database not initialized');
    
    return {
      run: (...params) => this.run(sql, params),
      get: (...params) => this.get(sql, params),
      all: (...params) => this.all(sql, params)
    };
  }

  /**
   * Transaction wrapper (wrapper for compatibility with better-sqlite3)
   * sql.js doesn't have native transactions, so we simulate with BEGIN/COMMIT
   * @param {Function} fn - Function to execute in transaction
   * @returns {Function} - Wrapped function
   */
  transaction(fn) {
    return (...args) => {
      try {
        this.db.run('BEGIN TRANSACTION');
        const result = fn(...args);
        this.db.run('COMMIT');
        this.save();
        return result;
      } catch (error) {
        this.db.run('ROLLBACK');
        throw error;
      }
    };
  }

  applyMigrations() {
    try {
      // 1. Ensure players.is_active column exists
      const cols = this.all('PRAGMA table_info(players)');
      const hasIsActive = cols.some(c => c.name === 'is_active');
      logger.info('Migration check: players columns', { columns: cols.map(c => c.name) });
      if (!hasIsActive) {
        this.exec('ALTER TABLE players ADD COLUMN is_active INTEGER DEFAULT 1');
        this.exec('CREATE INDEX IF NOT EXISTS idx_players_active ON players(game_id, is_active)');
        this.exec('UPDATE players SET is_active = 1 WHERE is_active IS NULL');
        logger.info('Migration applied: players.is_active added');
      } else {
        logger.info('Migration skipped: players.is_active already exists');
      }

      // 2. Migrate images table to new schema (pool-based)
      const imageCols = this.all('PRAGMA table_info(images)');
      const hasType = imageCols.some(c => c.name === 'type');
      const hasIsStartImage = imageCols.some(c => c.name === 'is_start_image');
      
      if (hasType) {
        logger.info('Migration: Converting images table to pool-based schema (full rebuild)');
        
        // SQLite doesn't support DROP COLUMN, so we need to rebuild the table
        // 1. Create game_images table first
        this.exec(`
          CREATE TABLE IF NOT EXISTS game_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
            image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
            correct_answer TEXT,
            display_order INTEGER DEFAULT 0,
            is_played INTEGER DEFAULT 0,
            added_at INTEGER DEFAULT (strftime('%s', 'now')),
            UNIQUE(game_id, image_id)
          )
        `);
        
        // 2. Migrate game images to junction table BEFORE rebuilding images table
        const gameImagesOld = this.all("SELECT * FROM images WHERE type = 'game'");
        
        for (const img of gameImagesOld) {
          this.run(
            `INSERT OR IGNORE INTO game_images (game_id, image_id, correct_answer, display_order)
             VALUES (?, ?, ?, ?)`,
            [img.game_id || 1, img.id, img.correct_answer, img.display_order || 0]
          );
        }
        
        // 3. Create new images table structure
        this.exec(`
          CREATE TABLE IF NOT EXISTS images_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            is_start_image INTEGER DEFAULT 0,
            is_end_image INTEGER DEFAULT 0,
            uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `);
        
        // 4. Copy data with migration logic
        this.exec(`
          INSERT INTO images_new (id, filename, url, is_start_image, is_end_image, uploaded_at)
          SELECT 
            id, 
            filename, 
            url, 
            CASE WHEN type = 'start' THEN 1 ELSE 0 END,
            CASE WHEN type = 'end' THEN 1 ELSE 0 END,
            uploaded_at
          FROM images
        `);
        
        // 5. Drop old table and rename new one
        this.exec('DROP TABLE images');
        this.exec('ALTER TABLE images_new RENAME TO images');
        
        // 6. Create indexes
        this.exec('CREATE INDEX IF NOT EXISTS idx_images_start ON images(is_start_image)');
        this.exec('CREATE INDEX IF NOT EXISTS idx_images_end ON images(is_end_image)');
        this.exec('CREATE INDEX IF NOT EXISTS idx_game_images_game ON game_images(game_id)');
        this.exec('CREATE INDEX IF NOT EXISTS idx_game_images_order ON game_images(game_id, display_order)');
        
        logger.info('Migration applied: images table rebuilt with new schema', { 
          migratedGameImages: gameImagesOld.length 
        });
      } else if (!hasIsStartImage) {
        // Fresh database or already migrated but missing columns
        logger.info('Migration: Adding is_start_image/is_end_image columns');
        this.exec('ALTER TABLE images ADD COLUMN is_start_image INTEGER DEFAULT 0');
        this.exec('ALTER TABLE images ADD COLUMN is_end_image INTEGER DEFAULT 0');
      }

      // 3. Ensure wordList config exists
      if (!this.getConfig('wordList')) {
        this.setConfig('wordList', ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus']);
        logger.info('Migration applied: default wordList added');
      }

      // 4. Add locked_at column to answers table (Hybrid+ System)
      const answerCols = this.all('PRAGMA table_info(answers)');
      const hasLockedAt = answerCols.some(c => c.name === 'locked_at');
      if (!hasLockedAt) {
        this.exec('ALTER TABLE answers ADD COLUMN locked_at INTEGER');
        this.exec('CREATE INDEX IF NOT EXISTS idx_answers_locked ON answers(image_id, locked_at)');
        logger.info('Migration applied: answers.locked_at added');
      }
      
      // 5. Allow is_correct to be NULL (Hybrid+ - answer locked but not scored yet)
      // SQLite doesn't support ALTER COLUMN, but the existing schema allows NULL anyway

    } catch (error) {
      logger.error('Migration step failed', { error: error.message });
    }
  }

  /**
   * Get config value by key
   * @param {string} key - Config key
   * @returns {any} - Parsed JSON value or null
   */
  getConfig(key) {
    try {
      const row = this.get('SELECT value FROM config WHERE key = ?', [key]);
      return row ? JSON.parse(row.value) : null;
    } catch (error) {
      logger.error('Failed to get config', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set config value
   * @param {string} key - Config key
   * @param {any} value - Value (will be JSON-serialized)
   */
  setConfig(key, value) {
    try {
      this.run(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))",
        [key, JSON.stringify(value)]
      );
    } catch (error) {
      logger.error('Failed to set config', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get all images from pool
   * @returns {Array} - Array of image objects
   */
  getAllImages() {
    try {
      return this.all('SELECT * FROM images ORDER BY uploaded_at DESC');
    } catch (error) {
      logger.error('Failed to get images', { error: error.message });
      return [];
    }
  }

  /**
   * Get game images for a specific game
   * @param {number} gameId - Game ID
   * @returns {Array} - Array of game image objects with image details
   */
  getGameImages(gameId) {
    try {
      return this.all(`
        SELECT gi.*, i.filename, i.url 
        FROM game_images gi
        JOIN images i ON gi.image_id = i.id
        WHERE gi.game_id = ?
        ORDER BY gi.display_order ASC
      `, [gameId]);
    } catch (error) {
      logger.error('Failed to get game images', { gameId, error: error.message });
      return [];
    }
  }

  /**
   * Get start image
   * @returns {Object|null} - Start image or null
   */
  getStartImage() {
    try {
      return this.get('SELECT * FROM images WHERE is_start_image = 1 LIMIT 1') || null;
    } catch (error) {
      logger.error('Failed to get start image', { error: error.message });
      return null;
    }
  }

  /**
   * Get end image
   * @returns {Object|null} - End image or null
   */
  getEndImage() {
    try {
      return this.get('SELECT * FROM images WHERE is_end_image = 1 LIMIT 1') || null;
    } catch (error) {
      logger.error('Failed to get end image', { error: error.message });
      return null;
    }
  }

  /**
   * Get active game
   * @returns {Object|null} - Active game or null
   */
  getActiveGame() {
    try {
      return this.get(
        'SELECT * FROM games WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 1',
        ['lobby', 'playing']
      );
    } catch (error) {
      logger.error('Failed to get active game', { error: error.message });
      return null;
    }
  }

  /**
   * Get latest game (including ended games)
   * @returns {Object|null} - Latest game or null
   */
  getLatestGame() {
    try {
      return this.get('SELECT * FROM games ORDER BY created_at DESC LIMIT 1');
    } catch (error) {
      logger.error('Failed to get latest game', { error: error.message });
      return null;
    }
  }

  /**
   * Create new game
   * @returns {number} - New game ID
   */
  createGame() {
    try {
      const result = this.run('INSERT INTO games (status) VALUES (?)', ['lobby']);
      logger.info('New game created', { gameId: result.lastInsertRowid });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to create game', { error: error.message });
      throw error;
    }
  }

  /**
   * Get player by socket ID
   * @param {string} socketId - Socket ID
   * @returns {Object|null} - Player or null
   */
  getPlayerBySocketId(socketId) {
    try {
      return this.get('SELECT * FROM players WHERE socket_id = ?', [socketId]);
    } catch (error) {
      logger.error('Failed to get player by socket', { socketId, error: error.message });
      return null;
    }
  }

  /**
   * Create player
   * @param {number} gameId - Game ID
   * @param {string} name - Player name
   * @param {string} socketId - Socket ID
   * @returns {number} - New player ID
   */
  createPlayer(gameId, name, socketId) {
    try {
      const result = this.run(
        'INSERT INTO players (game_id, name, socket_id) VALUES (?, ?, ?)',
        [gameId, name, socketId]
      );
      logger.info('Player created', { playerId: result.lastInsertRowid, name });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to create player', { name, error: error.message });
      throw error;
    }
  }

  /**
   * Get leaderboard
   * @param {number} gameId - Game ID
   * @param {number} limit - Max number of players (default 10)
   * @returns {Array} - Array of player objects with ranks
   */
  getLeaderboard(gameId, limit = 10) {
    try {
      return this.all(`
        SELECT 
          id, 
          name, 
          score,
          RANK() OVER (ORDER BY score DESC, joined_at ASC) as rank
        FROM players
        WHERE game_id = ? AND is_active = 1
        ORDER BY score DESC, joined_at ASC
        LIMIT ?
      `, [gameId, limit]);
    } catch (error) {
      logger.error('Failed to get leaderboard', { gameId, error: error.message });
      return [];
    }
  }

  /**
   * Update player last_seen timestamp (keep-alive)
   * @param {number} playerId - Player ID
   */
  updatePlayerKeepAlive(playerId) {
    try {
      this.run(
        "UPDATE players SET last_seen = strftime('%s','now') WHERE id = ?",
        [playerId]
      );
    } catch (error) {
      logger.error('Failed to update keep-alive', { playerId, error: error.message });
    }
  }

  /**
   * Soft-delete inactive players (older than 60 seconds)
   * @param {number} gameId - Game ID
   * @returns {number} - Number of players marked inactive
   */
  softDeleteInactivePlayers(gameId) {
    try {
      const result = this.run(`
        UPDATE players 
        SET is_active = 0 
        WHERE game_id = ? 
          AND is_active = 1 
          AND last_seen < strftime('%s','now') - 60
      `, [gameId]);
      if (result.changes > 0) {
        logger.info('Soft-deleted inactive players', { gameId, count: result.changes });
      }
      return result.changes;
    } catch (error) {
      logger.error('Failed to soft-delete inactive players', { gameId, error: error.message });
      return 0;
    }
  }

  /**
   * Restore inactive player (session restore)
   * @param {number} playerId - Player ID
   * @param {string} socketId - New socket ID
   */
  restorePlayer(playerId, socketId) {
    try {
      this.run(
        "UPDATE players SET is_active = 1, socket_id = ?, last_seen = strftime('%s','now') WHERE id = ?",
        [socketId, playerId]
      );
      logger.info('Player restored', { playerId });
    } catch (error) {
      logger.error('Failed to restore player', { playerId, error: error.message });
      throw error;
    }
  }

  /**
   * Get active player count for a game
   * @param {number} gameId - Game ID
   * @returns {number} - Count of active players
   */
  getActivePlayerCount(gameId) {
    try {
      const result = this.get(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ? AND is_active = 1',
        [gameId]
      );
      return result ? result.count : 0;
    } catch (error) {
      logger.error('Failed to get active player count', { gameId, error: error.message });
      return 0;
    }
  }

  /**
   * Update game status
   * @param {number} gameId - Game ID
   * @param {string} status - New status (lobby|playing|ended)
   */
  updateGameStatus(gameId, status) {
    try {
      // Set started_at when transitioning to 'playing', ended_at when 'ended'
      if (status === 'playing') {
        this.run("UPDATE games SET status = ?, started_at = strftime('%s','now') WHERE id = ?", [status, gameId]);
      } else if (status === 'ended') {
        this.run("UPDATE games SET status = ?, ended_at = strftime('%s','now') WHERE id = ?", [status, gameId]);
      } else {
        this.run("UPDATE games SET status = ? WHERE id = ?", [status, gameId]);
      }
      logger.info('Game status updated', { category: 'GAME', gameId, status });
    } catch (error) {
      logger.error('Failed to update game status', { gameId, status, error: error.message });
      throw error;
    }
  }

  /**
   * Persist or update current PIN
   * @param {string} pin - PIN string
   * @param {string} host - Host for join URL
   */
  savePin(pin, host) {
    try {
      this.setConfig('currentPin', {
        pin,
        createdAt: new Date().toISOString(),
        joinUrl: `http://${host}/player.html`
      });
      logger.info('PIN saved', { pin });
    } catch (error) {
      logger.error('Failed to save PIN', { pin, error: error.message });
      throw error;
    }
  }

  /**
   * Get current PIN object
   * @returns {Object|null}
   */
  getPin() {
    return this.getConfig('currentPin');
  }

  /**
   * Set admin protection state with optional expiry
   * @param {boolean} enabled
   * @param {number|null} expiresAtUnix - seconds since epoch, or null
   */
  setProtection(enabled, expiresAtUnix = null) {
    this.setConfig('adminProtection', {
      enabled: !!enabled,
      expiresAt: typeof expiresAtUnix === 'number' ? expiresAtUnix : null
    });
  }

  /**
   * Get protection state
   * @returns {{enabled:boolean, expiresAt:number|null}}
   */
  getProtection() {
    return this.getConfig('adminProtection') || { enabled: false, expiresAt: null };
  }

  /**
   * Save player join host (domain:port)
   * @param {string} host
   */
  savePlayerJoinHost(host) {
    this.setConfig('playerJoinHost', host);
  }

  /**
   * Get player join URL based on stored host
   */
  getPlayerJoinUrl() {
    const host = this.getConfig('playerJoinHost');
    if (host) return `http://${host}/player.html`;
    return null;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.save(); // Save before closing
      this.db.close();
      logger.info('Database connection closed');
    }
  }
}

// Create singleton instance (will be initialized async)
const dbManager = new DatabaseManager();

// Export singleton that will be initialized
module.exports = dbManager;
