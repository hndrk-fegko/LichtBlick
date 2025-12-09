/**
 * MySQL Database Implementation
 * 
 * Uses mysql2 with connection pooling and promise-based API.
 * All methods are async by default.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class MySQLDatabase {
  constructor() {
    this.pool = null;
    this.mysql = null;
  }

  async initialize() {
    try {
      // Dynamic require - only load mysql2 when actually using MySQL
      this.mysql = require('mysql2/promise');
      
      // Create connection pool
      this.pool = this.mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lichtblick',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      // Test connection
      const connection = await this.pool.getConnection();
      logger.info('MySQL database connection established', {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      });
      connection.release();

      // Apply migrations and schema
      await this.applyMigrations();
      await this.loadSchema();

      logger.info('MySQL database initialized');
    } catch (error) {
      logger.error('MySQL database initialization failed', { error: error.message });
      throw error;
    }
  }

  async loadSchema() {
    try {
      // Read and convert SQLite schema to MySQL
      const sqliteSchema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      
      // Convert SQLite syntax to MySQL syntax
      let mysqlSchema = sqliteSchema
        // Replace AUTOINCREMENT with AUTO_INCREMENT
        .replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT')
        // Replace INTEGER with INT
        .replace(/INTEGER/g, 'INT')
        // Replace strftime('%s', 'now') with UNIX_TIMESTAMP()
        .replace(/strftime\('%s',\s*'now'\)/g, 'UNIX_TIMESTAMP()')
        // Replace datetime('now') with NOW()
        .replace(/datetime\('now'\)/g, 'NOW()')
        // Handle IF NOT EXISTS for indexes - MySQL requires different syntax
        .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX')
        // Remove WHERE clause from index creation (MySQL doesn't support partial indexes)
        .replace(/CREATE INDEX ([^\s]+) ON ([^\s]+)\([^)]+\)[^;]*WHERE[^;]+;/g, 'CREATE INDEX $1 ON $2;');

      // Split into individual statements
      const statements = mysqlSchema.split(';').filter(s => s.trim());

      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;

        try {
          // Handle CREATE TABLE IF NOT EXISTS
          if (trimmed.startsWith('CREATE TABLE')) {
            await this.pool.query(trimmed);
          }
          // Handle CREATE INDEX - check if exists first
          else if (trimmed.startsWith('CREATE INDEX')) {
            const match = trimmed.match(/CREATE INDEX\s+(\w+)/);
            if (match) {
              const indexName = match[1];
              // MySQL doesn't have IF NOT EXISTS for indexes, so we need to check first
              const [rows] = await this.pool.query(
                `SELECT COUNT(*) as count FROM information_schema.statistics 
                 WHERE table_schema = DATABASE() AND index_name = ?`,
                [indexName]
              );
              if (rows[0].count === 0) {
                await this.pool.query(trimmed);
              }
            }
          }
          // Handle INSERT OR IGNORE
          else if (trimmed.startsWith('INSERT OR IGNORE')) {
            const converted = trimmed.replace('INSERT OR IGNORE', 'INSERT IGNORE');
            await this.pool.query(converted);
          }
        } catch (err) {
          // Ignore errors for duplicate keys/indexes (already exists)
          if (!err.message.includes('Duplicate') && !err.message.includes('already exists')) {
            logger.warn('Schema statement failed (continuing)', { error: err.message, stmt: trimmed.substring(0, 100) });
          }
        }
      }

      logger.info('MySQL schema loaded');
    } catch (error) {
      logger.error('Failed to load MySQL schema', { error: error.message });
      throw error;
    }
  }

  async applyMigrations() {
    try {
      // 1. Check if players.is_active column exists
      const [playerCols] = await this.pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'players' AND COLUMN_NAME = 'is_active'`
      );
      
      if (playerCols.length === 0) {
        await this.pool.query('ALTER TABLE players ADD COLUMN is_active INT DEFAULT 1');
        await this.pool.query('CREATE INDEX idx_players_active ON players(game_id, is_active)');
        await this.pool.query('UPDATE players SET is_active = 1 WHERE is_active IS NULL');
        logger.info('Migration applied: players.is_active added');
      } else {
        logger.info('Migration skipped: players.is_active already exists');
      }

      // 2. Check if images table needs migration (has 'type' column)
      const [imageCols] = await this.pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images'`
      );
      
      const hasType = imageCols.some(c => c.COLUMN_NAME === 'type');
      const hasIsStartImage = imageCols.some(c => c.COLUMN_NAME === 'is_start_image');
      
      if (hasType) {
        logger.info('Migration: Converting images table to pool-based schema');
        
        // Create game_images table first
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS game_images (
            id INT PRIMARY KEY AUTO_INCREMENT,
            game_id INT,
            image_id INT,
            correct_answer TEXT,
            display_order INT DEFAULT 0,
            is_played INT DEFAULT 0,
            added_at INT DEFAULT (UNIX_TIMESTAMP()),
            UNIQUE KEY unique_game_image (game_id, image_id),
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
          )
        `);
        
        // Migrate game images to junction table
        const [gameImagesOld] = await this.pool.query("SELECT * FROM images WHERE type = 'game'");
        
        for (const img of gameImagesOld) {
          await this.pool.query(
            `INSERT IGNORE INTO game_images (game_id, image_id, correct_answer, display_order)
             VALUES (?, ?, ?, ?)`,
            [img.game_id || 1, img.id, img.correct_answer, img.display_order || 0]
          );
        }
        
        // Create new images table
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS images_new (
            id INT PRIMARY KEY AUTO_INCREMENT,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            is_start_image INT DEFAULT 0,
            is_end_image INT DEFAULT 0,
            uploaded_at INT DEFAULT (UNIX_TIMESTAMP())
          )
        `);
        
        // Copy data with migration logic
        await this.pool.query(`
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
        
        // Drop old table and rename
        await this.pool.query('DROP TABLE images');
        await this.pool.query('ALTER TABLE images_new RENAME TO images');
        
        // Create indexes
        await this.pool.query('CREATE INDEX idx_images_start ON images(is_start_image)');
        await this.pool.query('CREATE INDEX idx_images_end ON images(is_end_image)');
        await this.pool.query('CREATE INDEX idx_game_images_game ON game_images(game_id)');
        await this.pool.query('CREATE INDEX idx_game_images_order ON game_images(game_id, display_order)');
        
        logger.info('Migration applied: images table rebuilt', { migratedGameImages: gameImagesOld.length });
      } else if (!hasIsStartImage) {
        logger.info('Migration: Adding is_start_image/is_end_image columns');
        await this.pool.query('ALTER TABLE images ADD COLUMN is_start_image INT DEFAULT 0');
        await this.pool.query('ALTER TABLE images ADD COLUMN is_end_image INT DEFAULT 0');
      }

      // 3. Ensure wordList config exists
      if (!(await this.getConfig('wordList'))) {
        await this.setConfig('wordList', ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus']);
        logger.info('Migration applied: default wordList added');
      }

      // 4. Check if answers.locked_at column exists
      const [answerCols] = await this.pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'answers' AND COLUMN_NAME = 'locked_at'`
      );
      
      if (answerCols.length === 0) {
        await this.pool.query('ALTER TABLE answers ADD COLUMN locked_at INT');
        await this.pool.query('CREATE INDEX idx_answers_locked ON answers(image_id, locked_at)');
        logger.info('Migration applied: answers.locked_at added');
      }

    } catch (error) {
      logger.error('MySQL migration step failed', { error: error.message });
    }
  }

  async getConfig(key) {
    try {
      const [rows] = await this.pool.query('SELECT value FROM config WHERE `key` = ?', [key]);
      return rows[0] ? JSON.parse(rows[0].value) : null;
    } catch (error) {
      logger.error('Failed to get config', { key, error: error.message });
      return null;
    }
  }

  async setConfig(key, value) {
    try {
      await this.pool.query(
        "INSERT INTO config (`key`, value, updated_at) VALUES (?, ?, UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE value = ?, updated_at = UNIX_TIMESTAMP()",
        [key, JSON.stringify(value), JSON.stringify(value)]
      );
    } catch (error) {
      logger.error('Failed to set config', { key, error: error.message });
      throw error;
    }
  }

  async getAllImages() {
    try {
      const [rows] = await this.pool.query('SELECT * FROM images ORDER BY uploaded_at DESC');
      return rows;
    } catch (error) {
      logger.error('Failed to get images', { error: error.message });
      return [];
    }
  }

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

  async getStartImage() {
    try {
      const [rows] = await this.pool.query('SELECT * FROM images WHERE is_start_image = 1 LIMIT 1');
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get start image', { error: error.message });
      return null;
    }
  }

  async getEndImage() {
    try {
      const [rows] = await this.pool.query('SELECT * FROM images WHERE is_end_image = 1 LIMIT 1');
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get end image', { error: error.message });
      return null;
    }
  }

  async getActiveGame() {
    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM games WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 1',
        ['lobby', 'playing']
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get active game', { error: error.message });
      return null;
    }
  }

  async getLatestGame() {
    try {
      const [rows] = await this.pool.query('SELECT * FROM games ORDER BY created_at DESC LIMIT 1');
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get latest game', { error: error.message });
      return null;
    }
  }

  async createGame() {
    try {
      const [result] = await this.pool.query('INSERT INTO games (status) VALUES (?)', ['lobby']);
      logger.info('New game created', { gameId: result.insertId });
      return result.insertId;
    } catch (error) {
      logger.error('Failed to create game', { error: error.message });
      throw error;
    }
  }

  async getPlayerBySocketId(socketId) {
    try {
      const [rows] = await this.pool.query('SELECT * FROM players WHERE socket_id = ?', [socketId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get player by socket', { socketId, error: error.message });
      return null;
    }
  }

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

  async updatePlayerKeepAlive(playerId) {
    try {
      await this.pool.query(
        "UPDATE players SET last_seen = UNIX_TIMESTAMP() WHERE id = ?",
        [playerId]
      );
    } catch (error) {
      logger.error('Failed to update keep-alive', { playerId, error: error.message });
    }
  }

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

  async restorePlayer(playerId, socketId) {
    try {
      await this.pool.query(
        "UPDATE players SET is_active = 1, socket_id = ?, last_seen = UNIX_TIMESTAMP() WHERE id = ?",
        [socketId, playerId]
      );
      logger.info('Player restored', { playerId });
    } catch (error) {
      logger.error('Failed to restore player', { playerId, error: error.message });
      throw error;
    }
  }

  async getActivePlayerCount(gameId) {
    try {
      const [rows] = await this.pool.query(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ? AND is_active = 1',
        [gameId]
      );
      return rows[0] ? rows[0].count : 0;
    } catch (error) {
      logger.error('Failed to get active player count', { gameId, error: error.message });
      return 0;
    }
  }

  async updateGameStatus(gameId, status) {
    try {
      let query;
      if (status === 'playing') {
        query = "UPDATE games SET status = ?, started_at = UNIX_TIMESTAMP() WHERE id = ?";
      } else if (status === 'ended') {
        query = "UPDATE games SET status = ?, ended_at = UNIX_TIMESTAMP() WHERE id = ?";
      } else {
        query = "UPDATE games SET status = ? WHERE id = ?";
      }
      await this.pool.query(query, [status, gameId]);
      logger.info('Game status updated', { category: 'GAME', gameId, status });
    } catch (error) {
      logger.error('Failed to update game status', { gameId, status, error: error.message });
      throw error;
    }
  }

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

  async getPin() {
    return await this.getConfig('currentPin');
  }

  async setProtection(enabled, expiresAtUnix = null) {
    await this.setConfig('adminProtection', {
      enabled: !!enabled,
      expiresAt: typeof expiresAtUnix === 'number' ? expiresAtUnix : null
    });
  }

  async getProtection() {
    return (await this.getConfig('adminProtection')) || { enabled: false, expiresAt: null };
  }

  async savePlayerJoinHost(host) {
    await this.setConfig('playerJoinHost', host);
  }

  async getPlayerJoinUrl() {
    const host = await this.getConfig('playerJoinHost');
    if (host) return `http://${host}/player.html`;
    return null;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('MySQL database connection pool closed');
    }
  }
}

module.exports = MySQLDatabase;
