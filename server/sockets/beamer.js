/**
 * Beamer Socket Event Handlers
 * 
 * Handles beamer-specific events (initial state, etc.)
 */

const logger = require('../utils/logger');
const db = require('../db');

module.exports = (io, socket) => {
  // Beamer connects
  socket.on('beamer:connect', async () => {
    socket.join('beamer');
    socket.wasInBeamerRoom = true; // Track for disconnect handler
    logger.info('Beamer joined', { socketId: socket.id });
    
    // Notify admins that beamer is connected
    if (io.broadcastBeamerStatus) io.broadcastBeamerStatus();
    
    try {
      // Get current game state (including ended games)
      const game = await db.getLatestGame() || { id: 1, status: 'lobby' };
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
      
      // Send lobby start image if in lobby phase
      if (game.status === 'lobby') {
        const startImage = await db.getStartImage();
        if (startImage) {
          socket.emit('beamer:image_roles_changed', {
            startImage: {
              id: startImage.id,
              url: startImage.url
            }
          });
        }
      }
      
      // Get current image ID from game state
      const currentImageId = game.current_image_id;
      
      // Send current image if any (for playing phase)
      if (currentImageId && game.status === 'playing') {
        const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
        const image = stmt.get(currentImageId);
        
        if (image) {
          socket.emit('beamer:image_changed', {
            imageId: image.id,
            imageUrl: image.url,
            imageType: image.type
          });
          
          // Check if image was already revealed
          const imageStateStmt = db.db.prepare(`
            SELECT reveal_count, ended_at FROM image_states
            WHERE game_id = ? AND image_id = ?
          `);
          const imageState = imageStateStmt.get(game.id, currentImageId);
          
          // If already revealed, send correct answer too
          if (imageState && imageState.reveal_count > 0 && imageState.ended_at) {
            const gameImageStmt = db.db.prepare(`
              SELECT correct_answer FROM game_images
              WHERE game_id = ? AND image_id = ?
            `);
            const gameImage = gameImageStmt.get(game.id, currentImageId);
            
            if (gameImage && gameImage.correct_answer) {
              socket.emit('beamer:reveal_image', {
                imageId: currentImageId,
                correctAnswer: gameImage.correct_answer
              });
            }
          }
        }
      }
      
      // If game ended: send end image and final leaderboard
      if (game.status === 'ended') {
        // Get end image
        const endImageStmt = db.db.prepare('SELECT * FROM images WHERE is_end_image = 1 LIMIT 1');
        const endImage = endImageStmt.get();
        
        if (endImage) {
          socket.emit('beamer:image_roles_changed', {
            endImage: {
              id: endImage.id,
              url: endImage.url
            }
          });
        }
        
        // Send final leaderboard
        const leaderboard = await db.getLeaderboard(game.id, 10);
        socket.emit('game:leaderboard_update', {
          topPlayers: leaderboard.map(p => ({ 
            name: p.name, 
            score: p.score, 
            rank: p.rank 
          })),
          totalPlayers: leaderboard.length
        });
      }
      
      // Send current QR state
      const qrEnabled = await db.getConfig('qrEnabled') || false;
      const storedUrl = await db.getPlayerJoinUrl();
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
      const darkMode = await db.getConfig('darkMode') || false;
      const spotlight = await db.getConfig('spotlight') || {};
      socket.emit('beamer:settings_changed', {
        darkMode,
        spotlight
      });
      
      // Send leaderboard visibility state
      const leaderboardVisible = await db.getConfig('leaderboardVisible') !== false; // Default: true
      socket.emit('beamer:leaderboard_visibility', {
        visible: leaderboardVisible
      });
      
      // Send lobby update with player list
      const players = await db.getLeaderboard(game.id, 100);
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
