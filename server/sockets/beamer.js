/**
 * Beamer Socket Event Handlers
 * 
 * Handles beamer-specific events (initial state, etc.)
 */

const logger = require('../utils/logger');
const db = require('../db/database');

module.exports = (io, socket) => {
  // Beamer connects
  socket.on('beamer:connect', () => {
    socket.join('beamer');
    socket.wasInBeamerRoom = true; // Track for disconnect handler
    logger.info('Beamer joined', { socketId: socket.id });
    
    // Notify admins that beamer is connected
    if (io.broadcastBeamerStatus) io.broadcastBeamerStatus();
    
    try {
      // Get current game state
      const game = db.getActiveGame() || { id: 1, status: 'lobby' };
      const playerCount = db.db.prepare(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ?'
      ).get(game.id);
      
      // Send initial state
      const initialState = {
        success: true,
        phase: game.status, // Top-level for easier access
        data: {
          game: { 
            id: game.id, 
            status: game.status 
          },
          playerCount: playerCount.count
        }
      };
      
      logger.debug('Sending beamer:initial_state', { 
        socketId: socket.id.substring(0, 8),
        phase: game.status,
        playerCount: playerCount.count
      });
      
      socket.emit('beamer:initial_state', initialState);
      
      // Get current image ID from game state
      const currentImageId = game.current_image_id;
      
      // Send current image if any
      if (currentImageId) {
        const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
        const image = stmt.get(currentImageId);
        
        if (image) {
          socket.emit('beamer:image_changed', {
            imageId: image.id,
            imageUrl: image.url,
            imageType: image.type
          });
        }
      }
      
      // Send current QR state
      const qrEnabled = db.getConfig('qrEnabled') || false;
      const storedUrl = db.getPlayerJoinUrl();
      const host = socket.handshake.headers.host;
      const joinUrl = storedUrl || `http://${host}/player.html`;
      
      logger.debug('Sending beamer:qr_state', { 
        socketId: socket.id.substring(0, 8),
        enabled: qrEnabled,
        url: joinUrl
      });
      
      socket.emit('beamer:qr_state', {
        enabled: qrEnabled,
        visible: qrEnabled, // backward compatibility
        url: joinUrl
      });
      
      // Send current settings
      const darkMode = db.getConfig('darkMode') || false;
      const spotlight = db.getConfig('spotlight') || {};
      socket.emit('beamer:settings_changed', {
        darkMode,
        spotlight
      });
      
      // Send lobby update with player list
      const players = db.getLeaderboard(game.id, 100);
      socket.emit('game:lobby_update', {
        players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        totalPlayers: players.length
      });
      
    } catch (error) {
      logger.error('Beamer connect failed', { error: error.message });
      socket.emit('beamer:initial_state', {
        success: false,
        message: 'Failed to load state'
      });
    }
  });
};
