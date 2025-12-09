/**
 * SQLite Database Implementation
 * 
 * Wrapper for better-sqlite3 with WAL mode and helper methods.
 * All methods are async-wrapped for interface compatibility.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class SQLiteDatabase {
  constructor() {
    this.db = null;
    this.Database = null;
  }

  async initialize() {
    try {
      // Dynamic require - only load better-sqlite3 when actually using SQLite
      this.Database = require('better-sqlite3');
      
      const DB_PATH = path.join(__dirname, process.env.DB_PATH || '../../data/lichtblick.db');
      
      // Ensure data directory exists
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database
      this.db = new this.Database(DB_PATH);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      
      // Apply migrations FIRST (before schema) to handle existing DBs
      await this.applyMigrations();
      
      // Load schema (for new databases or to add new tables)
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      this.db.exec(schema);
      
      logger.info('SQLite database initialized', { path: DB_PATH, mode: 'WAL' });
    } catch (error) {
      logger.error('SQLite database initialization failed', { error: error.message });
      throw error;
    }
  }

  async applyMigrations() {
    try {
      // 1. Ensure players.is_active column exists
      const cols = this.db.prepare('PRAGMA table_info(players)').all();
      const hasIsActive = cols.some(c => c.name === 'is_active');
      logger.info('Migration check: players columns', { columns: cols.map(c => c.name) });
      if (!hasIsActive) {
        this.db.exec('ALTER TABLE players ADD COLUMN is_active INTEGER DEFAULT 1');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_players_active ON players(game_id, is_active)');
        this.db.exec('UPDATE players SET is_active = 1 WHERE is_active IS NULL');
        logger.info('Migration applied: players.is_active added');
      } else {
        logger.info('Migration skipped: players.is_active already exists');
      }

      // 2. Migrate images table to new schema (pool-based)
      const imageCols = this.db.prepare('PRAGMA table_info(images)').all();
      const hasType = imageCols.some(c => c.name === 'type');
      const hasIsStartImage = imageCols.some(c => c.name === 'is_start_image');
      
      if (hasType) {
        logger.info('Migration: Converting images table to pool-based schema (full rebuild)');
        
        // SQLite doesn't support DROP COLUMN, so we need to rebuild the table
        // 1. Create game_images table first
        this.db.exec(`
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
        const gameImagesOld = this.db.prepare("SELECT * FROM images WHERE type = 'game'").all();
        const insertGameImg = this.db.prepare(`
          INSERT OR IGNORE INTO game_images (game_id, image_id, correct_answer, display_order)
          VALUES (?, ?, ?, ?)
        `);
        
        for (const img of gameImagesOld) {
          insertGameImg.run(img.game_id || 1, img.id, img.correct_answer, img.display_order || 0);
        }
        
        // 3. Create new images table structure
        this.db.exec(`
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
        this.db.exec(`
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
        this.db.exec('DROP TABLE images');
        this.db.exec('ALTER TABLE images_new RENAME TO images');
        
        // 6. Create indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_images_start ON images(is_start_image)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_images_end ON images(is_end_image)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_game_images_game ON game_images(game_id)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_game_images_order ON game_images(game_id, display_order)');
        
        logger.info('Migration applied: images table rebuilt with new schema', { 
          migratedGameImages: gameImagesOld.length 
        });
      } else if (!hasIsStartImage) {
        // Fresh database or already migrated but missing columns
        logger.info('Migration: Adding is_start_image/is_end_image columns');
        this.db.exec('ALTER TABLE images ADD COLUMN is_start_image INTEGER DEFAULT 0');
        this.db.exec('ALTER TABLE images ADD COLUMN is_end_image INTEGER DEFAULT 0');
      }

      // 3. Ensure wordList config exists
      if (!(await this.getConfig('wordList'))) {
        await this.setConfig('wordList', ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus']);
        logger.info('Migration applied: default wordList added');
      }

      // 4. Add locked_at column to answers table (Hybrid+ System)
      const answerCols = this.db.prepare('PRAGMA table_info(answers)').all();
      const hasLockedAt = answerCols.some(c => c.name === 'locked_at');
      if (!hasLockedAt) {
        this.db.exec('ALTER TABLE answers ADD COLUMN locked_at INTEGER');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_answers_locked ON answers(image_id, locked_at)');
        logger.info('Migration applied: answers.locked_at added');
      }
      
      // 5. Allow is_correct to be NULL (Hybrid+ - answer locked but not scored yet)
      // SQLite doesn't support ALTER COLUMN, but the existing schema allows NULL anyway

    } catch (error) {
      logger.error('SQLite migration step failed', { error: error.message });
    }
  }

  async getConfig(key) {
    try {
      const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
      const row = stmt.get(key);
      return row ? JSON.parse(row.value) : null;
    } catch (error) {
      logger.error('Failed to get config', { key, error: error.message });
      return null;
    }
  }

  async setConfig(key, value) {
    try {
      const stmt = this.db.prepare(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))"
      );
      stmt.run(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to set config', { key, error: error.message });
      throw error;
    }
  }

  async getAllImages() {
    try {
      const stmt = this.db.prepare('SELECT * FROM images ORDER BY uploaded_at DESC');
      return stmt.all();
    } catch (error) {
      logger.error('Failed to get images', { error: error.message });
      return [];
    }
  }

  async getGameImages(gameId) {
    try {
      const stmt = this.db.prepare(`
        SELECT gi.*, i.filename, i.url 
        FROM game_images gi
        JOIN images i ON gi.image_id = i.id
        WHERE gi.game_id = ?
        ORDER BY gi.display_order ASC
      `);
      return stmt.all(gameId);
    } catch (error) {
      logger.error('Failed to get game images', { gameId, error: error.message });
      return [];
    }
  }

  async getStartImage() {
    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE is_start_image = 1 LIMIT 1');
      return stmt.get() || null;
    } catch (error) {
      logger.error('Failed to get start image', { error: error.message });
      return null;
    }
  }

  async getEndImage() {
    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE is_end_image = 1 LIMIT 1');
      return stmt.get() || null;
    } catch (error) {
      logger.error('Failed to get end image', { error: error.message });
      return null;
    }
  }

  async getActiveGame() {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM games WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
      );
      return stmt.get('lobby', 'playing');
    } catch (error) {
      logger.error('Failed to get active game', { error: error.message });
      return null;
    }
  }

  async getLatestGame() {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM games ORDER BY created_at DESC LIMIT 1'
      );
      return stmt.get();
    } catch (error) {
      logger.error('Failed to get latest game', { error: error.message });
      return null;
    }
  }

  async createGame() {
    try {
      const stmt = this.db.prepare('INSERT INTO games (status) VALUES (?)');
      const result = stmt.run('lobby');
      logger.info('New game created', { gameId: result.lastInsertRowid });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to create game', { error: error.message });
      throw error;
    }
  }

  async getPlayerBySocketId(socketId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM players WHERE socket_id = ?');
      return stmt.get(socketId);
    } catch (error) {
      logger.error('Failed to get player by socket', { socketId, error: error.message });
      return null;
    }
  }

  async createPlayer(gameId, name, socketId) {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO players (game_id, name, socket_id) VALUES (?, ?, ?)'
      );
      const result = stmt.run(gameId, name, socketId);
      logger.info('Player created', { playerId: result.lastInsertRowid, name });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to create player', { name, error: error.message });
      throw error;
    }
  }

  async getLeaderboard(gameId, limit = 10) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, 
          name, 
          score,
          RANK() OVER (ORDER BY score DESC, joined_at ASC) as rank
        FROM players
        WHERE game_id = ? AND is_active = 1
        ORDER BY score DESC, joined_at ASC
        LIMIT ?
      `);
      return stmt.all(gameId, limit);
    } catch (error) {
      logger.error('Failed to get leaderboard', { gameId, error: error.message });
      return [];
    }
  }

  async updatePlayerKeepAlive(playerId) {
    try {
      const stmt = this.db.prepare(
        "UPDATE players SET last_seen = strftime('%s','now') WHERE id = ?"
      );
      stmt.run(playerId);
    } catch (error) {
      logger.error('Failed to update keep-alive', { playerId, error: error.message });
    }
  }

  async softDeleteInactivePlayers(gameId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE players 
        SET is_active = 0 
        WHERE game_id = ? 
          AND is_active = 1 
          AND last_seen < strftime('%s','now') - 60
      `);
      const result = stmt.run(gameId);
      if (result.changes > 0) {
        logger.info('Soft-deleted inactive players', { gameId, count: result.changes });
      }
      return result.changes;
    } catch (error) {
      logger.error('Failed to soft-delete inactive players', { gameId, error: error.message });
      return 0;
    }
  }

  async restorePlayer(playerId, socketId) {
    try {
      const stmt = this.db.prepare(
        "UPDATE players SET is_active = 1, socket_id = ?, last_seen = strftime('%s','now') WHERE id = ?"
      );
      stmt.run(socketId, playerId);
      logger.info('Player restored', { playerId });
    } catch (error) {
      logger.error('Failed to restore player', { playerId, error: error.message });
      throw error;
    }
  }

  async getActivePlayerCount(gameId) {
    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ? AND is_active = 1'
      );
      const result = stmt.get(gameId);
      return result ? result.count : 0;
    } catch (error) {
      logger.error('Failed to get active player count', { gameId, error: error.message });
      return 0;
    }
  }

  async updateGameStatus(gameId, status) {
    try {
      // Set started_at when transitioning to 'playing', ended_at when 'ended'
      let stmt;
      if (status === 'playing') {
        stmt = this.db.prepare("UPDATE games SET status = ?, started_at = strftime('%s','now') WHERE id = ?");
      } else if (status === 'ended') {
        stmt = this.db.prepare("UPDATE games SET status = ?, ended_at = strftime('%s','now') WHERE id = ?");
      } else {
        stmt = this.db.prepare("UPDATE games SET status = ? WHERE id = ?");
      }
      stmt.run(status, gameId);
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

  async deleteImage(imageId) {
    try {
      this.db.prepare('DELETE FROM images WHERE id = ?').run(imageId);
    } catch (error) {
      logger.error('Failed to delete image', { imageId, error: error.message });
      throw error;
    }
  }

  async deleteGameImages(imageId) {
    try {
      this.db.prepare('DELETE FROM game_images WHERE image_id = ?').run(imageId);
    } catch (error) {
      logger.error('Failed to delete game images', { imageId, error: error.message });
      throw error;
    }
  }

  async addImage(filename, url) {
    try {
      const stmt = this.db.prepare('INSERT INTO images (filename, url) VALUES (?, ?)');
      const result = stmt.run(filename, url);
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to add image', { filename, error: error.message });
      throw error;
    }
  }

  async close() {
    if (this.db) {
      this.db.close();
      logger.info('SQLite database connection closed');
    }
  }
}

module.exports = SQLiteDatabase;
