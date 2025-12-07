/**
 * Socket.IO Event Handlers Bootstrap
 * 
 * Loads all socket event handlers
 */

const logger = require('../utils/logger');
const playerHandlers = require('./player');

/**
 * Broadcast admin session count to all admins
 * Called when admin joins or leaves
 */
function broadcastAdminCount(io) {
  const adminRoom = io.sockets.adapter.rooms.get('admin');
  const count = adminRoom ? adminRoom.size : 0;
  
  io.to('admin').emit('admin:session_count', { 
    count,
    warning: count > 1 ? '⚠️ Mehrere Admin-Sitzungen aktiv!' : null
  });
  
  logger.debug('Admin session count broadcasted', { count });
}

/**
 * Broadcast beamer connection status to all admins
 * Called when beamer connects or disconnects
 */
function broadcastBeamerStatus(io) {
  const beamerRoom = io.sockets.adapter.rooms.get('beamer');
  const connected = beamerRoom ? beamerRoom.size > 0 : false;
  
  io.to('admin').emit('beamer:status', { connected });
  
  logger.debug('Beamer status broadcasted', { connected });
}

module.exports = (io) => {
  // Make broadcastAdminCount available to admin handler
  io.broadcastAdminCount = () => broadcastAdminCount(io);
  io.broadcastBeamerStatus = () => broadcastBeamerStatus(io);
  
  io.on('connection', (socket) => {
    // Apply socket logging middleware (request ID, event tracing)
    logger.socketMiddleware(socket);
    
    logger.info('Client connected', { 
      category: 'SOCKET',
      socketId: socket.id,
      requestId: socket.requestId,
      transport: socket.conn?.transport?.name
    });

    // Load event handlers
    require('./admin')(io, socket);
    require('./beamer')(io, socket);
    playerHandlers(io, socket);

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      // Check if this was an admin or beamer
      const wasAdmin = socket.wasInAdminRoom;
      const wasBeamer = socket.wasInBeamerRoom;
      
      logger.info('Client disconnected', { 
        category: 'SOCKET',
        socketId: socket.id,
        requestId: socket.requestId,
        reason,
        playerId: socket.playerId,
        playerName: socket.playerName,
        wasAdmin,
        wasBeamer
      });
      
      // Broadcast updated admin count if an admin left
      if (wasAdmin) {
        setTimeout(() => broadcastAdminCount(io), 100); // Small delay to let room update
      }
      
      // Broadcast beamer status if a beamer left
      if (wasBeamer) {
        setTimeout(() => broadcastBeamerStatus(io), 100);
      }
    });
  });

  // Start periodic cleanup with io reference for broadcasts
  playerHandlers.startCleanupInterval(io);

  logger.info('Socket.IO handlers initialized', { category: 'SYSTEM' });
};
