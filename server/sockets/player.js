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
      // Callback ist optional (für instabile Verbindungen)
      const respond = (response) => {
        if (typeof callback === 'function') {
          callback(response);
        }
      };
      
      // Validate name
      if (!validatePlayerName(name)) {
        return respond({ 
          success: false, 
          message: 'Invalid name (2-20 characters, alphanumeric only)' 
        });
      }
      
      // Get or create active game
      let game = await db.getActiveGame();
      if (!game) {
        const gameId = await db.createGame();
        game = { id: gameId, status: 'lobby' };
      }
      
      // Check if game allows joining
      if (game.status === 'ended') {
        return respond({ 
          success: false, 
          message: 'Game has ended. Please wait for a new game.' 
        });
      }
      
      // Create player in database
      const playerId = await db.createPlayer(game.id, name, socket.id);
      
      socket.join('players');
      socket.playerId = playerId;
      socket.playerName = name;
      socket.gameId = game.id;
      
      logger.game('Player joined', { playerId, name, gameId: game.id, socketId: socket.id });
      
      // Get all players for lobby update
      const players = await db.getLeaderboard(game.id, 100); // Get all players
      
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
        totalPlayers: players.length,
        gameRunning: game.status === 'playing'
      });
      
      // Return success to player
      respond({ 
        success: true, 
        data: { 
          playerId, 
          score: 0,
          gameStatus: game.status
        } 
      });
    } catch (error) {
      logger.error('Player join failed', { error: error.message, name });
      respond({ success: false, message: 'Join failed' });
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
      const game = await db.getActiveGame();
      if (!game || game.status !== 'playing') {
        return callback({ success: false, message: 'Game not active' });
      }
      
      const lockTimestamp = lockedAt || Date.now();
      
      // Check if player already has a locked answer for this image
      const hasAnswered = await db.hasPlayerAnsweredImage(socket.playerId, imageId);
      
      if (hasAnswered) {
        // Player wants to change their answer - allow update before reveal
        logger.game('Player changing answer', { 
          playerId: socket.playerId, 
          playerName: socket.playerName,
          imageId,
          newAnswer: answer
        });
        
        // Update existing answer with new answer and new timestamp
        await db.updatePlayerAnswer(socket.playerId, imageId, answer, lockTimestamp);
        
        // Notify admin that player changed their answer
        io.to('admin').emit('admin:answer_changed', {
          success: true,
          data: {
            playerId: socket.playerId,
            playerName: socket.playerName,
            imageId,
            answer,
            lockedAt: lockTimestamp
          }
        });
        
        return callback({ success: true, data: { answer, lockedAt: lockTimestamp, changed: true } });
      }
      
      // Insert new locked answer (not scored yet - is_correct = NULL, points = 0)
      await db.saveAnswer(socket.playerId, imageId, answer, false, 0, lockTimestamp);
      
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
      const player = await db.getPlayerById(playerId);
      
      if (!player) {
        return callback({ 
          success: false, 
          message: 'Player not found. Please join again.' 
        });
      }
      
      // Update socket_id and mark as active
      await db.updatePlayerConnection(playerId, socket.id);
      
      socket.join('players');
      socket.playerId = playerId;
      socket.playerName = player.name;
      socket.gameId = player.game_id;
      
      // Get game phase and current image
      const game = await db.getActiveGame();
      const phase = game ? game.status : 'lobby';
      let imageRevealed = false;
      let currentImageId = null;
      
      if (game && phase === 'playing') {
        // Get current image from config (set by admin when selecting/starting image)
        currentImageId = await db.getConfig('currentImageId');
        
        if (currentImageId) {
          // Check if this image has been revealed already
          const gameImages = await db.getGameImages(game.id);
          const gameImage = gameImages.find(gi => gi.image_id === parseInt(currentImageId));
          imageRevealed = gameImage?.is_played || false;
        }
      }
      
      logger.game('Player reconnected', { playerId, name: player.name, phase, imageRevealed, currentImageId, socketId: socket.id });
      
      // Send callback FIRST so client updates phase before receiving game events
      callback({ 
        success: true, 
        data: { 
          playerId, 
          name: player.name,
          score: player.score,
          phase,
          imageRevealed,
          currentImageId  // ✨ NEW: Send imageId directly in reconnect response
        } 
      });
      
      // Then send game state updates (client phase is now set correctly)
      if (game) {
        const players = await db.getLeaderboard(game.id, 100);
        socket.emit('game:lobby_update', {
          players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          totalPlayers: players.length,
          gameRunning: game.status === 'playing'
        });
        
        // If game is playing, send current game state
        if (phase === 'playing') {
          const gameImages = await db.getGameImages(game.id);
          const imageStates = await db.getImageStates(game.id);
          
          // Find current active image (most recently started)
          const currentState = imageStates.find(s => s.started_at);
          if (currentState) {
            const gameImage = gameImages.find(gi => gi.image_id === currentState.image_id);
            
            if (gameImage && !gameImage.is_played) {
              // Active image - send phase_change (like normal game flow)
              socket.emit('game:phase_change', {
                phase: 'playing',
                imageId: currentState.image_id
              });
            } else if (gameImage && gameImage.is_played) {
              // Last image was revealed - send ONLY revealed state, NO phase_change
              // (phase_change would trigger active game UI)
              socket.emit('game:image_revealed', {
                imageId: currentState.image_id,
                correctAnswer: gameImage.correct_answer
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Player reconnect failed', { error: error.message, playerId });
      callback({ success: false, message: 'Reconnect failed' });
    }
  });

  // Player keep-alive (sent every 30 seconds from client)
  socket.on('player:keep_alive', async () => {
    if (socket.playerId) {
      await db.updatePlayerKeepAlive(socket.playerId);
    }
  });

  // Player leaves game voluntarily
  socket.on('player:leave', async ({ playerId }, callback) => {
    try {
      if (!playerId) {
        return callback && callback({ success: false, message: 'No player ID' });
      }
      
      // Soft-delete player
      await db.updatePlayerConnection(playerId, { is_active: 0 });
      
      logger.info('Player left game', { playerId });
      
      // Get game for broadcast
      const game = await db.getActiveGame();
      if (game) {
        const activeCount = await db.getActivePlayerCount(game.id);
        const players = await db.getLeaderboard(game.id, 100);
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
  socket.on('disconnect', async () => {
    if (socket.playerId) {
      logger.info('Player disconnected', { playerId: socket.playerId, name: socket.playerName });
      
      // Update last_seen (keep alive mechanism handled by db layer)
      try {
        await db.updatePlayerKeepAlive(socket.playerId);
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
  
  cleanupInterval = setInterval(async () => {
    const game = await db.getActiveGame();
    if (game) {
      const count = await db.softDeleteInactivePlayers(game.id);
      if (count > 0) {
        logger.info('Cleaned up inactive players', { count });
        // Send lobby update to all clients after cleanup
        const players = await db.getLeaderboard(game.id, 100);
        io.emit('game:lobby_update', {
          players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          totalPlayers: players.length
        });
      }
    }
  }, 30000);
};
