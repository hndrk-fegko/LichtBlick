/**
 * Player Socket Event Handlers
 * 
 * Handles player-specific events (join, submit answer, etc.)
 */

const logger = require('../utils/logger');
const db = require('../db');
const { validatePlayerName, validateAnswer } = require('../utils/validation');
const {
  calculatePoints,
  isAnswerCorrect,
  getRevealCount,
  getCorrectAnswerPosition,
  hasPlayerAnswered
} = require('../services/scoring');

module.exports = (io, socket) => {
  // Player joins game
  socket.on('player:join', async ({ name }, callback) => {
    try {
      // Validate name
      if (!validatePlayerName(name)) {
        return callback({ 
          success: false, 
          message: 'Invalid name (2-20 characters, alphanumeric only)' 
        });
      }
      
      // Get or create active game
      let game = db.getActiveGame();
      if (!game) {
        const gameId = db.createGame();
        game = { id: gameId, status: 'lobby' };
      }
      
      // Check if game allows joining
      if (game.status === 'ended') {
        return callback({ 
          success: false, 
          message: 'Game has ended. Please wait for a new game.' 
        });
      }
      
      // Create player in database
      const playerId = db.createPlayer(game.id, name, socket.id);
      
      socket.join('players');
      socket.playerId = playerId;
      socket.playerName = name;
      socket.gameId = game.id;
      
      logger.game('Player joined', { playerId, name, gameId: game.id, socketId: socket.id });
      
      // Get all players for lobby update
      const players = db.getLeaderboard(game.id, 100); // Get all players
      
      // Notify admin
      io.to('admin').emit('admin:player_joined', {
        success: true,
        data: {
          playerId,
          name,
          score: 0,
          totalPlayers: players.length
        }
      });
      
      // Broadcast lobby update to all (players, admin, beamer)
      io.emit('game:lobby_update', {
        players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        totalPlayers: players.length
      });
      
      // Return success to player
      callback({ 
        success: true, 
        data: { 
          playerId, 
          score: 0,
          gameStatus: game.status
        } 
      });
    } catch (error) {
      logger.error('Player join failed', { error: error.message, name });
      callback({ success: false, message: 'Join failed' });
    }
  });

  // Player submits answer (Legacy - wird durch lock_answer ersetzt)
  socket.on('player:submit_answer', async ({ imageId, answer }, callback) => {
    // Redirect to lock_answer for backward compatibility
    socket.emit('player:lock_answer', { imageId, answer, lockedAt: Date.now() }, callback);
  });

  // Player locks in an answer (Hybrid+ System)
  // Answer is saved with timestamp but not scored yet - scoring happens at reveal
  socket.on('player:lock_answer', async ({ imageId, answer, lockedAt }, callback) => {
    try {
      // Validate
      if (!socket.playerId) {
        return callback({ success: false, message: 'Not logged in' });
      }
      
      if (!imageId) {
        return callback({ success: false, message: 'No image selected' });
      }
      
      if (!validateAnswer(answer)) {
        return callback({ success: false, message: 'Invalid answer' });
      }
      
      // Check if game is in playing phase
      const game = db.getActiveGame();
      if (!game || game.status !== 'playing') {
        return callback({ success: false, message: 'Game not active' });
      }
      
      const lockTimestamp = lockedAt || Date.now();
      
      // Check if player already has a locked answer for this image
      const existingStmt = db.db.prepare(`
        SELECT id FROM answers 
        WHERE player_id = ? AND image_id = ?
      `);
      const existing = existingStmt.get(socket.playerId, imageId);
      
      if (existing) {
        // Update existing answer (player changed their mind)
        const updateStmt = db.db.prepare(`
          UPDATE answers 
          SET answer = ?, locked_at = ?, is_correct = NULL, points_earned = 0
          WHERE player_id = ? AND image_id = ?
        `);
        updateStmt.run(answer, lockTimestamp, socket.playerId, imageId);
        
        logger.game('Answer updated (re-locked)', { 
          playerId: socket.playerId, 
          playerName: socket.playerName,
          imageId, 
          answer,
          lockedAt: lockTimestamp
        });
      } else {
        // Insert new locked answer (not scored yet - is_correct = NULL)
        const insertStmt = db.db.prepare(`
          INSERT INTO answers (player_id, image_id, answer, is_correct, points_earned, locked_at)
          VALUES (?, ?, ?, NULL, 0, ?)
        `);
        insertStmt.run(socket.playerId, imageId, answer, lockTimestamp);
        
        logger.game('Answer locked', { 
          playerId: socket.playerId, 
          playerName: socket.playerName,
          imageId, 
          answer,
          lockedAt: lockTimestamp
        });
      }
      
      // Notify admin that player locked an answer
      io.to('admin').emit('admin:answer_locked', {
        success: true,
        data: {
          playerId: socket.playerId,
          playerName: socket.playerName,
          imageId,
          answer,
          lockedAt: lockTimestamp
        }
      });
      
      callback({ success: true, data: { answer, lockedAt: lockTimestamp } });
      
    } catch (error) {
      logger.error('Lock answer failed', { error: error.message, imageId, answer });
      callback({ success: false, message: 'Failed to lock answer' });
    }
  });

  // Player reconnects
  socket.on('player:reconnect', async ({ playerId }, callback) => {
    try {
      // Get player from database
      const stmt = db.db.prepare('SELECT * FROM players WHERE id = ?');
      const player = stmt.get(playerId);
      
      if (!player) {
        return callback({ 
          success: false, 
          message: 'Player not found. Please join again.' 
        });
      }
      
      // Update socket_id and mark as active
      const updateStmt = db.db.prepare(
        "UPDATE players SET socket_id = ?, is_active = 1, last_seen = strftime('%s','now') WHERE id = ?"
      );
      updateStmt.run(socket.id, playerId);
      
      socket.join('players');
      socket.playerId = playerId;
      socket.playerName = player.name;
      socket.gameId = player.game_id;
      
      // Get game phase
      const game = db.getActiveGame();
      const phase = game ? game.status : 'lobby';
      
      logger.game('Player reconnected', { playerId, name: player.name, phase, socketId: socket.id });
      
      // Send lobby update to reconnected player so they see current player count
      if (game) {
        const players = db.getLeaderboard(game.id, 100);
        socket.emit('game:lobby_update', {
          players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          totalPlayers: players.length
        });
      }
      
      callback({ 
        success: true, 
        data: { 
          playerId, 
          name: player.name,
          score: player.score,
          phase
        } 
      });
    } catch (error) {
      logger.error('Player reconnect failed', { error: error.message, playerId });
      callback({ success: false, message: 'Reconnect failed' });
    }
  });

  // Player keep-alive (sent every 30 seconds from client)
  socket.on('player:keep_alive', () => {
    if (socket.playerId) {
      db.updatePlayerKeepAlive(socket.playerId);
    }
  });

  // Player leaves game voluntarily
  socket.on('player:leave', ({ playerId }, callback) => {
    try {
      if (!playerId) {
        return callback && callback({ success: false, message: 'No player ID' });
      }
      
      // Soft-delete player
      const stmt = db.db.prepare(
        'UPDATE players SET is_active = 0 WHERE id = ?'
      );
      stmt.run(playerId);
      
      logger.info('Player left game', { playerId });
      
      // Get game for broadcast
      const game = db.getActiveGame();
      if (game) {
        const activeCount = db.getActivePlayerCount(game.id);
        const players = db.getLeaderboard(game.id, 100);
        io.emit('game:lobby_update', {
          players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          totalPlayers: activeCount
        });
      }
      
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Player leave failed', { error: error.message, playerId });
      callback && callback({ success: false, message: 'Leave failed' });
    }
  });

  // Handle disconnect (keep player active for potential reconnect)
  socket.on('disconnect', () => {
    if (socket.playerId) {
      logger.info('Player disconnected', { playerId: socket.playerId, name: socket.playerName });
      
      // Update last_seen but keep is_active=1 for 60 seconds grace period
      try {
        const stmt = db.db.prepare(
          "UPDATE players SET last_seen = strftime('%s','now') WHERE id = ?"
        );
        stmt.run(socket.playerId);
      } catch (error) {
        logger.error('Failed to update player disconnect', { error: error.message });
      }
    }
  });
};

// Export cleanup function that needs io reference
let cleanupInterval = null;

module.exports.startCleanupInterval = (io) => {
  if (cleanupInterval) return; // Already running
  
  cleanupInterval = setInterval(() => {
    const game = db.getActiveGame();
    if (game) {
      const count = db.softDeleteInactivePlayers(game.id);
      if (count > 0) {
        logger.info('Cleaned up inactive players', { count });
        // Send lobby update to all clients after cleanup
        const players = db.getLeaderboard(game.id, 100);
        io.emit('game:lobby_update', {
          players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          totalPlayers: players.length
        });
      }
    }
  }, 30000);
};
