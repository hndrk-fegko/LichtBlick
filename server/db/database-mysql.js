/**
 * MySQL/MariaDB Database Manager
 * 
 * Wrapper for mysql2 with connection pooling and helper methods
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Create connection pool
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'lichtblick',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      // Test connection
      const connection = await this.pool.getConnection();
      logger.info('Database connected', { 
        host: process.env.DB_HOST,
        database: process.env.DB_NAME 
      });
      connection.release();

      // Load and execute schema
      await this.loadSchema();
      
      // Apply migrations
      await this.applyMigrations();
      
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  async loadSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schema-mysql.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split by semicolon and filter out empty statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      // Execute each statement separately
      for (const statement of statements) {
        await this.pool.query(statement);
      }
      
      logger.info('Schema loaded successfully');
    } catch (error) {
      logger.error('Failed to load schema', { error: error.message });
      throw error;
    }
  }

  async applyMigrations() {
    try {
      // Migration checks for existing databases
      
      // 1. Ensure players.is_active column exists
      const [playerCols] = await this.pool.query(
        'SHOW COLUMNS FROM players LIKE "is_active"'
      );
      
      if (playerCols.length === 0) {
        await this.pool.query('ALTER TABLE players ADD COLUMN is_active TINYINT(1) DEFAULT 1');
        await this.pool.query('CREATE INDEX idx_players_active ON players(game_id, is_active)');
        await this.pool.query('UPDATE players SET is_active = 1 WHERE is_active IS NULL');
        logger.info('Migration applied: players.is_active added');
      }

      // 2. Ensure wordList config exists
      const wordListConfig = await this.getConfig('wordList');
      if (!wordListConfig) {
        await this.setConfig('wordList', ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus']);
        logger.info('Migration applied: default wordList added');
      }

      // 3. Ensure answers.locked_at column exists
      const [answerCols] = await this.pool.query(
        'SHOW COLUMNS FROM answers LIKE "locked_at"'
      );
      
      if (answerCols.length === 0) {
        await this.pool.query('ALTER TABLE answers ADD COLUMN locked_at INT DEFAULT NULL');
        await this.pool.query('CREATE INDEX idx_answers_locked ON answers(image_id, locked_at)');
        logger.info('Migration applied: answers.locked_at added');
      }

    } catch (error) {
      logger.error('Migration step failed', { error: error.message });
    }
  }

  /**
   * Get config value by key
   * @param {string} key - Config key
   * @returns {any} - Parsed JSON value or null
   */
  async getConfig(key) {
    try {
      const [rows] = await this.pool.query(
        'SELECT value FROM config WHERE `key` = ?',
        [key]
      );
      return rows.length > 0 ? JSON.parse(rows[0].value) : null;
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
  async setConfig(key, value) {
    try {
      await this.pool.query(
        'INSERT INTO config (`key`, value, updated_at) VALUES (?, ?, UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE value = ?, updated_at = UNIX_TIMESTAMP()',
        [key, JSON.stringify(value), JSON.stringify(value)]
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
  async getAllImages() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM images ORDER BY uploaded_at DESC'
      );
      return rows;
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
  async getGameImages(gameId) {
    try {
      const [rows] = await this.pool.query(`
        SELECT gi.*, i.filename, i.url 
        FROM game_images gi
        JOIN images i ON gi.image_id = i.id
        WHERE gi.game_id = ?
        ORDER BY gi.display_order ASC
      `, [gameId]);
      return rows;
    } catch (error) {
      logger.error('Failed to get game images', { gameId, error: error.message });
      return [];
    }
  }

  /**
   * Get start image
   * @returns {Object|null} - Start image or null
   */
  async getStartImage() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM images WHERE is_start_image = 1 LIMIT 1'
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to get start image', { error: error.message });
      return null;
    }
  }

  /**
   * Get end image
   * @returns {Object|null} - End image or null
   */
  async getEndImage() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM images WHERE is_end_image = 1 LIMIT 1'
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to get end image', { error: error.message });
      return null;
    }
  }

  /**
   * Get active game
   * @returns {Object|null} - Active game or null
   */
  async getActiveGame() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM games WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 1',
        ['lobby', 'playing']
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to get active game', { error: error.message });
      return null;
    }
  }

  /**
   * Get latest game (including ended games)
   * @returns {Object|null} - Latest game or null
   */
  async getLatestGame() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM games ORDER BY created_at DESC LIMIT 1'
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to get latest game', { error: error.message });
      return null;
    }
  }

  /**
   * Create new game
   * @returns {number} - New game ID
   */
  async createGame() {
    try {
      const [result] = await this.pool.query(
        'INSERT INTO games (status) VALUES (?)',
        ['lobby']
      );
      logger.info('New game created', { gameId: result.insertId });
      return result.insertId;
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
  async getPlayerBySocketId(socketId) {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM players WHERE socket_id = ?',
        [socketId]
      );
      return rows.length > 0 ? rows[0] : null;
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
  async createPlayer(gameId, name, socketId) {
    try {
      const [result] = await this.pool.query(
        'INSERT INTO players (game_id, name, socket_id) VALUES (?, ?, ?)',
        [gameId, name, socketId]
      );
      logger.info('Player created', { playerId: result.insertId, name });
      return result.insertId;
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
  async getLeaderboard(gameId, limit = 10) {
    try {
      const [rows] = await this.pool.query(`
        SELECT 
          id, 
          name, 
          score,
          RANK() OVER (ORDER BY score DESC, joined_at ASC) as \`rank\`
        FROM players
        WHERE game_id = ? AND is_active = 1
        ORDER BY score DESC, joined_at ASC
        LIMIT ?
      `, [gameId, limit]);
      return rows;
    } catch (error) {
      logger.error('Failed to get leaderboard', { gameId, error: error.message });
      return [];
    }
  }

  /**
   * Update player last_seen timestamp (keep-alive)
   * @param {number} playerId - Player ID
   */
  async updatePlayerKeepAlive(playerId) {
    try {
      await this.pool.query(
        'UPDATE players SET last_seen = UNIX_TIMESTAMP() WHERE id = ?',
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
  async softDeleteInactivePlayers(gameId) {
    try {
      const [result] = await this.pool.query(`
        UPDATE players 
        SET is_active = 0 
        WHERE game_id = ? 
          AND is_active = 1 
          AND last_seen < UNIX_TIMESTAMP() - 60
      `, [gameId]);
      
      if (result.affectedRows > 0) {
        logger.info('Soft-deleted inactive players', { gameId, count: result.affectedRows });
      }
      return result.affectedRows;
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
  async restorePlayer(playerId, socketId) {
    try {
      await this.pool.query(
        'UPDATE players SET is_active = 1, socket_id = ?, last_seen = UNIX_TIMESTAMP() WHERE id = ?',
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
  async getActivePlayerCount(gameId) {
    try {
      const [rows] = await this.pool.query(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ? AND is_active = 1',
        [gameId]
      );
      return rows.length > 0 ? rows[0].count : 0;
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
  async updateGameStatus(gameId, status) {
    try {
      let query;
      let params;
      
      if (status === 'playing') {
        query = 'UPDATE games SET status = ?, started_at = UNIX_TIMESTAMP() WHERE id = ?';
        params = [status, gameId];
      } else if (status === 'ended') {
        query = 'UPDATE games SET status = ?, ended_at = UNIX_TIMESTAMP() WHERE id = ?';
        params = [status, gameId];
      } else {
        query = 'UPDATE games SET status = ? WHERE id = ?';
        params = [status, gameId];
      }
      
      await this.pool.query(query, params);
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
  async savePin(pin, host) {
    try {
      await this.setConfig('currentPin', {
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
  async getPin() {
    return await this.getConfig('currentPin');
  }

  /**
   * Set admin protection state with optional expiry
   * @param {boolean} enabled
   * @param {number|null} expiresAtUnix - seconds since epoch, or null
   */
  async setProtection(enabled, expiresAtUnix = null) {
    await this.setConfig('adminProtection', {
      enabled: !!enabled,
      expiresAt: typeof expiresAtUnix === 'number' ? expiresAtUnix : null
    });
  }

  /**
   * Get protection state
   * @returns {{enabled:boolean, expiresAt:number|null}}
   */
  async getProtection() {
    const protection = await this.getConfig('adminProtection');
    return protection || { enabled: false, expiresAt: null };
  }

  /**
   * Save player join host (domain:port)
   * @param {string} host
   */
  async savePlayerJoinHost(host) {
    await this.setConfig('playerJoinHost', host);
  }

  /**
   * Get player join URL based on stored host
   */
  async getPlayerJoinUrl() {
    const host = await this.getConfig('playerJoinHost');
    if (host) return `http://${host}/player.html`;
    return null;
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
