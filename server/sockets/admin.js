/**
 * Admin Socket Event Handlers
 * 
 * Handles admin-specific events (image selection, spotlight, QR toggle, etc.)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const db = require('../db');
const { calculatePoints, isAnswerCorrect, getRevealCount } = require('../services/scoring');

/*
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║                                                               ║
 * ║     🎄 FROHE WEIHNACHTEN, NEUGIERIGER ENTWICKLER! 🎄          ║
 * ║                                                               ║
 * ║          Du hast den Admin-Code gefunden!                     ║
 * ║                                                               ║
 * ║                        *                                      ║
 * ║                       /|\                                     ║
 * ║                      / | \                                    ║
 * ║                     /  |  \                                   ║
 * ║                    /  \|/  \                                  ║
 * ║                   /----*----\                                 ║
 * ║                  /----|----\                                  ║
 * ║                 /-----|-----\                                 ║
 * ║                /------|------\                                ║
 * ║                      |||                                      ║
 * ║                      |||                                      ║
 * ║                                                               ║
 * ║     Aber keine Sorge - die Admin-Events sind gesichert! 🔒    ║
 * ║                                                               ║
 * ║     Falls du Verbesserungen hast: Pull Requests welcome!      ║
 * ║                                                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

module.exports = (io, socket) => {
  // 🛡️ Security Helper: Prüft ob Socket im Admin-Room ist
  function requireAdmin(eventName, callback) {
    if (!socket.rooms.has('admin')) {
      logger.warn('🚨 Unauthorized admin event attempt', {
        event: eventName,
        socketId: socket.id,
        rooms: Array.from(socket.rooms)
      });
      
      // 🎁 Osterei für neugierige Programmierer
      socket.emit('easter_egg', {
        message: '🎄 Ho Ho Ho! Netter Versuch, aber du bist nicht der Admin!',
        hint: 'Frohe Weihnachten - aber bitte nur gucken, nicht anfassen! 🎅',
        ascii: `
    🎅 ERWISCHT! 🎅
    
       .-"""-.
      /        \
     |  O    O  |
     |    __    |
      \  \__/  /
       '-.  .-'
          ||   Du hast versucht:
          ||   ${eventName}
         /||\\ 
        / || \\ Aber du bist kein Admin!
       /  ||  \\
          `
      });
      
      callback && callback({ 
        success: false, 
        message: '🎄 Nice try! Aber du bist nicht im Admin-Room. Frohe Weihnachten! 🎅' 
      });
      return false;
    }
    return true;
  }
  function emitInitialState() {
    const host = socket.handshake.headers.host;
    // Use getLatestGame to include ended games
    const game = db.getLatestGame() || { id: db.createGame(), status: 'lobby' };
    const players = db.getLeaderboard(game.id, 100);
    const adminPin = db.getConfig('adminPin') || '1234';
    const qrVisible = db.getConfig('qrEnabled') || false;
    const currentImageId = db.getConfig('currentImageId') || null;
    const protection = db.getProtection();
    const playerJoinUrl = db.getPlayerJoinUrl() || `http://${host}/player.html`;
    
    // Get admin session count
    const adminRoom = io.sockets.adapter.rooms.get('admin');
    const adminSessionCount = adminRoom ? adminRoom.size : 1;
    
    // Get leaderboard visibility (default: true)
    const leaderboardVisible = db.getConfig('leaderboardVisible') !== false;

    socket.emit('admin:initial_state', {
      success: true,
      data: {
        game: { id: game.id, status: game.status },
        players: players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        playerCount: players.length,
        pin: { pin: adminPin, joinUrl: playerJoinUrl },
        qr: { enabled: qrVisible },
        leaderboardVisible,
        currentImageId,
        protection,
        adminSessionCount
      }
    });
  }

  // Allow connect without auth when protection is disabled
  // BUT always require valid URL token!
  socket.on('admin:connect', ({ token } = {}) => {
    try {
      // ALWAYS validate URL token first
      const validToken = io.adminToken;
      if (!token || token !== validToken) {
        logger.warn('🚫 Admin connect rejected: Invalid URL token', { 
          socketId: socket.id,
          providedToken: token ? token.substring(0, 8) + '...' : 'none'
        });
        socket.emit('admin:auth_required', { 
          message: 'Ungültiger Admin-Link. Bitte verwende den korrekten Admin-Link.',
          needsToken: true
        });
        return;
      }
      
      // Token valid - check if PIN protection is enabled
      const protection = db.getProtection();
      if (protection.enabled) {
        // Protection enabled: require PIN auth after token
        socket.hasValidToken = true; // Mark that URL token was valid
        socket.emit('admin:auth_required', { 
          message: 'PIN-Schutz aktiv. Bitte PIN eingeben.',
          needsPin: true
        });
        return;
      }
      
      // Token valid, no PIN required
      socket.join('admin');
      socket.wasInAdminRoom = true;
      socket.hasValidToken = true;
      logger.info('Admin joined (valid token, no PIN required)', { socketId: socket.id });
      emitInitialState();
      if (io.broadcastAdminCount) io.broadcastAdminCount();
    } catch (error) {
      logger.error('Admin connect failed', { error: error.message });
    }
  });

  // Admin authentication with PIN (requires valid URL token first!)
  socket.on('admin:auth', ({ pin, token }, callback) => {
    try {
      // Must have valid URL token (either from admin:connect or passed here)
      if (!socket.hasValidToken) {
        const validToken = io.adminToken;
        if (!token || token !== validToken) {
          return callback && callback({ 
            success: false, 
            message: 'Ungültiger Admin-Link. Bitte verwende den korrekten Admin-Link.' 
          });
        }
        socket.hasValidToken = true;
      }
      
      const protection = db.getProtection();
      const storedPin = db.getConfig('adminPin') || '1234';
      // If protection enabled and not expired, require correct pin
      if (protection.enabled) {
        const now = Math.floor(Date.now() / 1000);
        if (protection.expiresAt && protection.expiresAt <= now) {
          // auto disable protection when expired
          db.setProtection(false, null);
        } else if (pin !== storedPin) {
          return callback && callback({ success: false, message: 'PIN falsch' });
        }
      }
      socket.authenticated = true;
      // Only join if not already in admin room
      if (!socket.rooms.has('admin')) {
        socket.join('admin');
      }
      socket.wasInAdminRoom = true; // Mark for disconnect tracking
      logger.info('Admin authenticated', { socketId: socket.id });
      emitInitialState();
      // Broadcast updated admin count to all admins
      if (io.broadcastAdminCount) io.broadcastAdminCount();
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Admin auth failed', { error: error.message });
      callback && callback({ success: false, message: 'Auth Fehler' });
    }
  });

  // Update admin PIN
  socket.on('admin:update_pin', ({ pin }, callback) => {
    try {
      if (!socket.authenticated) {
        return callback && callback({ success: false, message: 'Nicht authentifiziert' });
      }
      if (typeof pin !== 'string' || pin.length < 4 || pin.length > 10) {
        return callback && callback({ success: false, message: 'PIN ungültig (4-10 Zeichen)' });
      }
      db.setConfig('adminPin', pin);
      logger.info('Admin PIN updated');
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Update PIN failed', { error: error.message });
      callback && callback({ success: false, message: 'Fehler beim Speichern' });
    }
  });

  // Toggle protection
  socket.on('admin:toggle_protection', ({ enabled }, callback) => {
    try {
      if (!socket.authenticated) {
        return callback && callback({ success: false, message: 'Nicht authentifiziert' });
      }
      const value = !!enabled;
      const expiresAt = value ? Math.floor(Date.now() / 1000) + 2 * 60 * 60 : null; // 2 hours
      db.setProtection(value, expiresAt);
      logger.info('Admin protection toggled', { enabled: value, expiresAt });
      callback && callback({ success: true });
      socket.emit('admin:protection_changed', { enabled: value, expiresAt });
    } catch (error) {
      logger.error('Toggle protection failed', { error: error.message });
      callback && callback({ success: false, message: 'Fehler' });
    }
  });

  // Store current host for player join
  socket.on('admin:set_join_host', ({ host }, callback) => {
    try {
      if (!socket.authenticated) {
        return callback && callback({ success: false, message: 'Nicht authentifiziert' });
      }
      if (typeof host !== 'string' || !host.length) {
        return callback && callback({ success: false, message: 'Host ungültig' });
      }
      db.savePlayerJoinHost(host);
      const url = db.getPlayerJoinUrl() || `http://${socket.handshake.headers.host}/player.html`;
      io.to('beamer').emit('beamer:qr_state', { enabled: db.getConfig('qrEnabled') || false, url });
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Set join host failed', { error: error.message });
      callback && callback({ success: false, message: 'Fehler' });
    }
  });

  // Helper: load image and broadcast
  function loadAndBroadcastImage(imageId, broadcastPhase = null) {
    const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
    const image = stmt.get(imageId);
    if (!image) {
      socket.emit('error', { message: 'Image not found' });
      return null;
    }
    db.setConfig('currentImageId', imageId);
    const game = db.getActiveGame();
    if (game) {
      const stateStmt = db.db.prepare(`
        INSERT INTO image_states (game_id, image_id, started_at)
        VALUES (?, ?, strftime('%s', 'now'))
        ON CONFLICT(game_id, image_id) 
        DO UPDATE SET started_at = strftime('%s', 'now')
      `);
      stateStmt.run(game.id, imageId);
    }
    io.to('beamer').emit('beamer:image_changed', {
      imageId: image.id,
      imageUrl: image.url,
      imageType: image.type
    });
    if (broadcastPhase) {
      io.to('players').emit('game:phase_change', { phase: broadcastPhase, imageId: image.id });
      io.to('beamer').emit('game:phase_change', { phase: broadcastPhase, imageId: image.id });
    }
    return image;
  }

  // Start game
  socket.on('admin:start_game', ({ imageId }, callback) => {
    if (!requireAdmin('admin:start_game', callback)) return;
    try {
      const game = db.getActiveGame();
      if (!game) return callback && callback({ success: false, message: 'No active game' });
      db.updateGameStatus(game.id, 'playing');
      const image = loadAndBroadcastImage(imageId, 'playing');
      if (!image) return callback && callback({ success: false, message: 'Image not found' });
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Start game failed', { error: error.message });
      callback && callback({ success: false, message: 'Failed to start game' });
    }
  });

  // Select image without broadcasting (internal admin selection only)
  socket.on('admin:select_image', ({ imageId }, callback) => {
    if (!requireAdmin('admin:select_image', callback)) return;
    try {
      // Only update internal state, DO NOT broadcast to beamer
      const stmt = db.db.prepare('SELECT * FROM images WHERE id = ?');
      const image = stmt.get(imageId);
      if (!image) return callback && callback({ success: false, message: 'Image not found' });
      
      // Store current selection (for admin UI state only)
      db.setConfig('currentImageId', imageId);
      
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Select image failed', { error: error.message });
      callback && callback({ success: false, message: 'Failed to select image' });
    }
  });

  // Next image during game
  socket.on('admin:next_image', ({ imageId }, callback) => {
    if (!requireAdmin('admin:next_image', callback)) return;
    try {
      const game = db.getActiveGame();
      if (!game || game.status !== 'playing') {
        return callback && callback({ success: false, message: 'Game not running' });
      }
      const image = loadAndBroadcastImage(imageId, 'playing');
      if (!image) return callback && callback({ success: false, message: 'Image not found' });
      callback && callback({ success: true });
    } catch (error) {
      logger.error('Next image failed', { error: error.message });
      callback && callback({ success: false, message: 'Failed to load next image' });
    }
  });

  // End game
  socket.on('admin:end_game', (_data, callback) => {
    if (!requireAdmin('admin:end_game', callback)) return;
    try {
      const game = db.getActiveGame();
      if (!game) return callback && callback({ success: false, message: 'No active game' });
      db.updateGameStatus(game.id, 'ended');
      io.to('players').emit('game:phase_change', { phase: 'ended' });
      io.to('beamer').emit('game:phase_change', { phase: 'ended' });
      // final leaderboard
      const leaderboard = db.getLeaderboard(game.id, 10);
      io.emit('game:leaderboard_update', {
        topPlayers: leaderboard.map(p => ({ name: p.name, score: p.score, rank: p.rank })),
        totalPlayers: leaderboard.length
      });
      callback && callback({ success: true });
    } catch (error) {
      logger.error('End game failed', { error: error.message });
      callback && callback({ success: false, message: 'Failed to end game' });
    }
  });

  // Admin spotlight (client throttled) - temporäre Mausbewegung
  socket.on('admin:spotlight', ({ x, y, size, radius, strength, focus }) => {
    if (!socket.rooms.has('admin')) return; // Silent fail for spotlight (high frequency)
    const spotSize = size || radius || 0.1;
    io.to('beamer').emit('beamer:spotlight', { 
      x, y, 
      size: spotSize,
      strength: strength ?? 1,
      focus: focus ?? 0.7
    });
  });

  // Admin spotlight click - fixierter Spotlight
  socket.on('admin:spotlight_click', ({ x, y, size, strength, focus }) => {
    const inAdminRoom = socket.rooms.has('admin');
    logger.debug(`Spotlight click received, in admin room: ${inAdminRoom}`, { 
      socketId: socket.id, 
      rooms: Array.from(socket.rooms),
      x, y 
    });
    if (!inAdminRoom) return; // Silent fail
    io.to('beamer').emit('beamer:spotlight_click', { 
      x, y, 
      size: size || 0.1,
      strength: strength ?? 1,
      focus: focus ?? 0.7
    });
  });

  // Admin clear all spotlights
  socket.on('admin:clear_spotlight', () => {
    if (!socket.rooms.has('admin')) return; // Silent fail
    io.to('beamer').emit('beamer:clear_spotlight');
  });

  // Admin toggles QR code
  socket.on('admin:toggle_qr', ({ visible }, callback) => {
    if (!socket.rooms.has('admin')) {
      if (callback) callback({ success: false, message: 'Nicht authentifiziert' });
      return;
    }
    const qrEnabled = !!visible;
    logger.info('Admin toggled QR', { visible: qrEnabled });
    db.setConfig('qrEnabled', qrEnabled);
    const host = socket.handshake.headers.host;
    const pinObj = db.getPin();
    const joinUrl = pinObj ? pinObj.joinUrl : `http://${host}/player.html`;
    
    logger.debug('Broadcasting beamer:qr_state to beamer room', { 
      enabled: qrEnabled, 
      url: joinUrl 
    });
    
    io.to('beamer').emit('beamer:qr_state', {
      enabled: qrEnabled,
      visible: qrEnabled, // backward compatibility
      url: joinUrl
    });
    if (callback) {
      callback({ 
        success: true, 
        message: qrEnabled ? 'QR-Code eingeblendet' : 'QR-Code ausgeblendet' 
      });
    }
  });

  // Admin toggles Leaderboard visibility
  socket.on('admin:toggle_leaderboard', ({ visible }, callback) => {
    if (!socket.rooms.has('admin')) {
      if (callback) callback({ success: false, message: 'Nicht authentifiziert' });
      return;
    }
    const leaderboardVisible = !!visible;
    logger.info('Admin toggled Leaderboard', { visible: leaderboardVisible });
    db.setConfig('leaderboardVisible', leaderboardVisible);
    
    logger.debug('Broadcasting beamer:leaderboard_visibility to beamer room', { 
      visible: leaderboardVisible 
    });
    
    io.to('beamer').emit('beamer:leaderboard_visibility', {
      visible: leaderboardVisible
    });
    
    if (callback) {
      callback({ 
        success: true, 
        message: leaderboardVisible ? 'Leaderboard wird im Endscreen angezeigt' : 'Leaderboard ausgeblendet' 
      });
    }
  });

  // Admin generate PIN
  socket.on('admin:generate_pin', (_data, callback) => {
    if (!requireAdmin('admin:generate_pin', callback)) return;
    try {
      const host = socket.handshake.headers.host;
      const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
      db.savePin(pin, host);
      const pinObj = db.getPin();
      io.to('beamer').emit('beamer:qr_state', { enabled: db.getConfig('qrEnabled') || false, url: pinObj.joinUrl });
      callback({ success: true, data: { pin: pinObj.pin, joinUrl: pinObj.joinUrl } });
    } catch (error) {
      logger.error('Generate PIN failed', { error: error.message });
      callback({ success: false, message: 'Failed to generate PIN' });
    }
  });

  // Admin reveals image - deckt Bild auf, wertet Antworten, markiert als gespielt
  socket.on('admin:reveal_image', ({ imageId }, callback) => {
    if (!requireAdmin('admin:reveal_image', callback)) return;
    logger.game('Image reveal started', { imageId, adminSocketId: socket.id });
    
    try {
      const game = db.getActiveGame();
      if (!game) {
        return callback && callback({ success: false, message: 'No active game' });
      }
      
      // 1. Update image_state: increment reveal_count und Endzeit setzen
      const updateStateStmt = db.db.prepare(`
        UPDATE image_states 
        SET reveal_count = reveal_count + 1,
            ended_at = strftime('%s', 'now')
        WHERE game_id = ? AND image_id = ?
      `);
      updateStateStmt.run(game.id, imageId);
      
      // 2. Bild als gespielt markieren (game_images)
      const markPlayedStmt = db.db.prepare(`
        UPDATE game_images 
        SET is_played = 1 
        WHERE game_id = ? AND image_id = ?
      `);
      markPlayedStmt.run(game.id, imageId);
      
      // 3. Richtige Antwort aus game_images holen
      const gameImageStmt = db.db.prepare(`
        SELECT correct_answer FROM game_images 
        WHERE game_id = ? AND image_id = ?
      `);
      const gameImage = gameImageStmt.get(game.id, imageId);
      const correctAnswer = gameImage?.correct_answer || '';
      
      // 4. HYBRID+ SCORING: Alle eingeloggten Antworten für dieses Bild werten
      const config = db.getConfig('scoring') || {};
      const revealCount = getRevealCount(db.db, game.id, imageId);
      
      // Hole alle Antworten für dieses Bild (sortiert nach locked_at für Position)
      const answersStmt = db.db.prepare(`
        SELECT a.*, p.name as player_name 
        FROM answers a
        JOIN players p ON a.player_id = p.id
        WHERE a.image_id = ?
        ORDER BY a.locked_at ASC NULLS LAST
      `);
      const allAnswers = answersStmt.all(imageId);
      
      let correctPosition = 0; // Zählt nur korrekte Antworten
      const scoringResults = [];
      
      for (const answer of allAnswers) {
        const isCorrect = isAnswerCorrect(answer.answer, correctAnswer);
        let points = 0;
        
        if (isCorrect) {
          correctPosition++; // 1st, 2nd, 3rd...
          points = calculatePoints(config, revealCount, correctPosition);
        }
        
        // Update answer in DB
        const updateAnswerStmt = db.db.prepare(`
          UPDATE answers 
          SET is_correct = ?, points_earned = ?
          WHERE id = ?
        `);
        updateAnswerStmt.run(isCorrect ? 1 : 0, points, answer.id);
        
        // Update player score
        if (points > 0) {
          const updatePlayerStmt = db.db.prepare(`
            UPDATE players SET score = score + ? WHERE id = ?
          `);
          updatePlayerStmt.run(points, answer.player_id);
        }
        
        scoringResults.push({
          playerId: answer.player_id,
          playerName: answer.player_name,
          answer: answer.answer,
          isCorrect,
          points,
          position: isCorrect ? correctPosition : null
        });
        
        logger.game('Answer scored', {
          playerId: answer.player_id,
          playerName: answer.player_name,
          answer: answer.answer,
          isCorrect,
          position: isCorrect ? correctPosition : null,
          points
        });
      }
      
      // 5. Leaderboard aktualisieren und broadcasten
      const leaderboard = db.getLeaderboard(game.id, 10);
      const totalPlayers = db.db.prepare(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ? AND is_active = 1'
      ).get(game.id);
      
      io.emit('game:leaderboard_update', {
        topPlayers: leaderboard.map(p => ({
          name: p.name,
          score: p.score,
          rank: p.rank
        })),
        totalPlayers: totalPlayers.count
      });
      
      // 6. Broadcast to beamer: Bild komplett aufdecken
      io.to('beamer').emit('beamer:reveal_image', { 
        imageId,
        correctAnswer
      });
      
      // 7. Send individual reveal info to each player (with their points)
      // Create a map of playerId -> scoring result
      const playerScoreMap = new Map();
      for (const result of scoringResults) {
        playerScoreMap.set(result.playerId, result);
      }
      
      // Get all active players with their socket_ids
      const playersStmt = db.db.prepare(`
        SELECT id, socket_id FROM players 
        WHERE game_id = ? AND is_active = 1 AND socket_id IS NOT NULL
      `);
      const activePlayers = playersStmt.all(game.id);
      
      // Send personalized reveal to each player
      for (const player of activePlayers) {
        const playerResult = playerScoreMap.get(player.id);
        const playerSocket = io.sockets.sockets.get(player.socket_id);
        
        if (playerSocket) {
          playerSocket.emit('game:image_revealed', {
            imageId,
            correctAnswer,
            roundPoints: playerResult?.points || 0,
            wasCorrect: playerResult?.isCorrect || false,
            position: playerResult?.position || null
          });
        }
      }
      
      // Also broadcast to players room for any we might have missed
      io.to('players').emit('game:image_revealed', { 
        imageId,
        correctAnswer,
        roundPoints: 0 // Default for players not in scoringResults
      });
      
      logger.game('Image revealed and scored', { 
        gameId: game.id, 
        imageId, 
        correctAnswer,
        totalAnswers: allAnswers.length,
        correctAnswers: correctPosition
      });
      
      callback && callback({ 
        success: true, 
        data: { 
          correctAnswer,
          scoringResults,
          totalAnswers: allAnswers.length,
          correctAnswers: correctPosition
        }
      });
      
    } catch (error) {
      logger.error('Reveal image failed', { error: error.message, imageId });
      callback && callback({ success: false, message: 'Reveal failed' });
    }
  });

  // Admin requests leaderboard
  socket.on('admin:get_leaderboard', () => {
    if (!socket.rooms.has('admin')) return;
    try {
      const game = db.getActiveGame();
      if (!game) return;
      
      const leaderboard = db.getLeaderboard(game.id, 10);
      const totalPlayers = db.db.prepare(
        'SELECT COUNT(*) as count FROM players WHERE game_id = ?'
      ).get(game.id);
      
      // Broadcast to all
      io.emit('game:leaderboard_update', {
        topPlayers: leaderboard.map(p => ({
          name: p.name,
          score: p.score,
          rank: p.rank
        })),
        totalPlayers: totalPlayers.count
      });
      
    } catch (error) {
      logger.error('Get leaderboard failed', { error: error.message });
    }
  });

  // ==========================================
  // DANGER ZONE - Reset Handlers
  // ==========================================

  /**
   * Soft Reset: 
   * - Game status → lobby
   * - Clear: scores, answers, image_states, game_images.is_played
   * - Keep: players, game_images, images, config
   */
  socket.on('admin:reset_game_soft', (data, callback) => {
    if (!requireAdmin('admin:reset_game_soft', callback)) return;
    try {
      const game = db.getActiveGame();
      if (!game) {
        callback && callback({ success: false, message: 'Kein aktives Spiel gefunden' });
        return;
      }

      logger.game('SOFT RESET initiated', { gameId: game.id }, 'warn');

      // Collect stats for logging
      let stats = { playersReset: 0, answersDeleted: 0, statesDeleted: 0, imagesReset: 0 };

      // Transaction for atomicity
      const reset = db.db.transaction(() => {
        // 1. Reset game status to lobby
        db.db.prepare('UPDATE games SET status = ?, started_at = NULL, ended_at = NULL WHERE id = ?')
          .run('lobby', game.id);
        
        // 2. Reset all player scores (keep players logged in)
        const playerResult = db.db.prepare('UPDATE players SET score = 0 WHERE game_id = ?')
          .run(game.id);
        stats.playersReset = playerResult.changes;
        
        // 3. Clear all answers
        const answerResult = db.db.prepare(`
          DELETE FROM answers WHERE player_id IN (
            SELECT id FROM players WHERE game_id = ?
          )
        `).run(game.id);
        stats.answersDeleted = answerResult.changes;
        
        // 4. Clear image_states
        const stateResult = db.db.prepare('DELETE FROM image_states WHERE game_id = ?')
          .run(game.id);
        stats.statesDeleted = stateResult.changes;
        
        // 5. Reset is_played flags on game_images
        const imageResult = db.db.prepare('UPDATE game_images SET is_played = 0 WHERE game_id = ?')
          .run(game.id);
        stats.imagesReset = imageResult.changes;
      });
      
      reset();
      
      logger.game('SOFT RESET completed', { gameId: game.id, ...stats });
      
      // Notify all clients
      io.to('beamer').emit('beamer:game_reset', { type: 'soft' });
      io.to('players').emit('player:game_reset', { type: 'soft', message: 'Das Spiel wurde zurückgesetzt.' });
      socket.emit('admin:state_update', { 
        gameStatus: 'lobby',
        message: 'Soft Reset erfolgreich'
      });
      
      callback && callback({ success: true, message: 'Soft Reset erfolgreich durchgeführt' });
      
    } catch (error) {
      logger.game('SOFT RESET failed', { error: error.message }, 'error');
      callback && callback({ success: false, message: error.message });
    }
  });

  /**
   * Hard Reset:
   * - Everything from Soft Reset
   * - Clear: players, game_images
   * - Optionally: reset start/end images
   */
  socket.on('admin:reset_complete', (data, callback) => {
    if (!requireAdmin('admin:reset_complete', callback)) return;
    try {
      const includeStartEnd = data?.includeStartEnd || false;
      const game = db.getActiveGame();
      if (!game) {
        callback && callback({ success: false, message: 'Kein aktives Spiel gefunden' });
        return;
      }

      logger.game('HARD RESET initiated', { gameId: game.id, includeStartEnd }, 'warn');

      // Collect stats for logging
      let stats = { answersDeleted: 0, statesDeleted: 0, playersDeleted: 0, gameImagesDeleted: 0 };

      const reset = db.db.transaction(() => {
        // 1. Clear answers first (foreign key to players)
        const answerResult = db.db.prepare(`
          DELETE FROM answers WHERE player_id IN (
            SELECT id FROM players WHERE game_id = ?
          )
        `).run(game.id);
        stats.answersDeleted = answerResult.changes;
        
        // 2. Clear image_states
        const stateResult = db.db.prepare('DELETE FROM image_states WHERE game_id = ?')
          .run(game.id);
        stats.statesDeleted = stateResult.changes;
        
        // 3. Clear players
        const playerResult = db.db.prepare('DELETE FROM players WHERE game_id = ?')
          .run(game.id);
        stats.playersDeleted = playerResult.changes;
        
        // 4. Clear game_images (junction table)
        const gameImageResult = db.db.prepare('DELETE FROM game_images WHERE game_id = ?')
          .run(game.id);
        stats.gameImagesDeleted = gameImageResult.changes;
        
        // 5. Optionally clear start/end images
        if (includeStartEnd) {
          db.db.prepare('UPDATE images SET is_start_image = 0, is_end_image = 0').run();
        }
        
        // 6. Reset game status
        db.db.prepare('UPDATE games SET status = ?, started_at = NULL, ended_at = NULL WHERE id = ?')
          .run('lobby', game.id);
      });
      
      reset();
      
      logger.game('HARD RESET completed', { gameId: game.id, includeStartEnd, ...stats });
      
      // Force disconnect all players
      io.to('players').emit('player:force_disconnect', { 
        message: 'Das Spiel wurde komplett zurückgesetzt. Bitte neu einloggen.' 
      });
      io.to('beamer').emit('beamer:game_reset', { type: 'hard' });
      socket.emit('admin:state_update', { 
        gameStatus: 'lobby',
        message: 'Hard Reset erfolgreich'
      });
      
      callback && callback({ success: true, message: 'Hard Reset erfolgreich durchgeführt' });
      
    } catch (error) {
      logger.game('HARD RESET failed', { error: error.message }, 'error');
      callback && callback({ success: false, message: error.message });
    }
  });

  /**
   * Factory Reset:
   * - Complete database wipe
   * - Delete all uploaded files
   * - Restore default configuration
   */
  socket.on('admin:factory_reset', (data, callback) => {
    if (!requireAdmin('admin:factory_reset', callback)) return;
    try {
      logger.game('FACTORY RESET initiated - ALL DATA WILL BE DELETED', {}, 'warn');
      
      const uploadsDir = path.join(__dirname, '../../data/uploads');
      
      const reset = db.db.transaction(() => {
        // 1. Clear all data tables (in order of dependencies)
        db.db.prepare('DELETE FROM answers').run();
        db.db.prepare('DELETE FROM image_states').run();
        db.db.prepare('DELETE FROM players').run();
        db.db.prepare('DELETE FROM game_images').run();
        db.db.prepare('DELETE FROM games').run();
        db.db.prepare('DELETE FROM images').run();
        db.db.prepare('DELETE FROM config').run();
        
        // 2. Reset auto-increment counters
        db.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('games', 'images', 'players', 'answers', 'game_images', 'image_states')").run();
        
        // 3. Restore default configuration
        db.db.prepare(`
          INSERT INTO config (key, value) VALUES
          ('adminPin', '"1234"'),
          ('qrVisible', 'false'),
          ('darkMode', 'false'),
          ('wordList', '["Apfel", "Banane", "Kirsche", "Hund", "Katze", "Maus", "Stern", "Sonne", "Mond"]'),
          ('scoring', '{"basePointsPerCorrect":100,"revealPenaltyEnabled":true,"revealPenaltyPercent":10,"minimumPointsPercent":20,"firstAnswerBonusEnabled":true,"firstAnswerBonusPoints":50,"secondAnswerBonusEnabled":true,"secondAnswerBonusPoints":30,"thirdAnswerBonusEnabled":true,"thirdAnswerBonusPoints":20,"speedBonusEnabled":false,"speedBonusMaxPoints":50,"speedBonusTimeLimit":10000}'),
          ('spotlight', '{"radius":80,"strength":0.5,"increaseAfterSeconds":30,"increaseFactor":1.5}')
        `).run();
        
        // 4. Create fresh lobby game
        db.db.prepare("INSERT INTO games (id, status) VALUES (1, 'lobby')").run();
      });
      
      reset();
      
      // 5. Delete all uploaded files (outside transaction)
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
          } catch (e) {
            logger.warn('Could not delete file', { file, error: e.message });
          }
        }
        logger.game('Deleted uploaded files', { count: files.length });
      }
      
      logger.game('FACTORY RESET completed - System restored to defaults', {});
      
      // Force disconnect everyone
      io.to('players').emit('player:force_disconnect', { 
        message: 'Werksreset durchgeführt. Bitte Seite neu laden.' 
      });
      io.to('beamer').emit('beamer:game_reset', { type: 'factory' });
      socket.emit('admin:state_update', { 
        gameStatus: 'lobby',
        message: 'Factory Reset erfolgreich'
      });
      
      callback && callback({ 
        success: true, 
        message: 'Factory Reset erfolgreich!\n\n⚠️ WICHTIG: Nach Server-Neustart wird ein NEUER Admin-Link generiert!\nDer aktuelle Link ist dann ungültig.' 
      });
      
    } catch (error) {
      logger.game('FACTORY RESET failed', { error: error.message }, 'error');
      callback && callback({ success: false, message: error.message });
    }
  });

  /**
   * Restart Game:
   * - Flexible reset for same event with options
   * - Optional: Disconnect players
   * - Optional: Remove played images
   */
  socket.on('admin:restart_game', (data, callback) => {
    if (!requireAdmin('admin:restart_game', callback)) return;
    try {
      const { disconnectPlayers, removePlayedImages } = data || {};
      
      // Get ENDED game (not active lobby/playing)
      const game = db.db.prepare(
        'SELECT * FROM games WHERE status = ? ORDER BY created_at DESC LIMIT 1'
      ).get('ended');
      
      if (!game) {
        logger.game('RESTART GAME failed: No ended game found', {}, 'error');
        callback && callback({ success: false, message: 'Kein beendetes Spiel gefunden' });
        return;
      }

      logger.game('RESTART GAME initiated', { 
        gameId: game.id, 
        disconnectPlayers, 
        removePlayedImages 
      }, 'warn');

      // Collect stats for logging
      let stats = { 
        playersReset: 0, 
        answersDeleted: 0, 
        statesDeleted: 0, 
        imagesReset: 0, 
        playersDeleted: 0,
        playedImagesRemoved: 0
      };

      // Transaction for atomicity
      const restart = db.db.transaction(() => {
        // 1. Reset game status to lobby
        db.db.prepare('UPDATE games SET status = ?, started_at = NULL, ended_at = NULL WHERE id = ?')
          .run('lobby', game.id);
        
        // 2. Clear answers & states (always)
        const answerResult = db.db.prepare(`
          DELETE FROM answers WHERE player_id IN (
            SELECT id FROM players WHERE game_id = ?
          )
        `).run(game.id);
        stats.answersDeleted = answerResult.changes;
        
        const stateResult = db.db.prepare('DELETE FROM image_states WHERE game_id = ?')
          .run(game.id);
        stats.statesDeleted = stateResult.changes;
        
        // 3. Optional: Disconnect players (delete) OR reset scores (keep)
        if (disconnectPlayers) {
          const playerResult = db.db.prepare('DELETE FROM players WHERE game_id = ?')
            .run(game.id);
          stats.playersDeleted = playerResult.changes;
        } else {
          const playerResult = db.db.prepare('UPDATE players SET score = 0 WHERE game_id = ?')
            .run(game.id);
          stats.playersReset = playerResult.changes;
        }
        
        // 4. Optional: Remove played images OR reset is_played flags
        if (removePlayedImages) {
          const imageResult = db.db.prepare('DELETE FROM game_images WHERE game_id = ? AND is_played = 1')
            .run(game.id);
          stats.playedImagesRemoved = imageResult.changes;
        } else {
          const imageResult = db.db.prepare('UPDATE game_images SET is_played = 0 WHERE game_id = ?')
            .run(game.id);
          stats.imagesReset = imageResult.changes;
        }
      });
      
      restart();
      
      logger.game('RESTART GAME completed', { 
        gameId: game.id, 
        disconnectPlayers, 
        removePlayedImages, 
        ...stats 
      }, 'warn');
      
      // Notify all clients
      if (disconnectPlayers) {
        logger.game('Broadcasting player:force_disconnect', { roomSize: io.sockets.adapter.rooms.get('players')?.size || 0 });
        io.to('players').emit('player:force_disconnect', { 
          message: 'Neue Runde startet. Bitte neu einloggen.' 
        });
      } else {
        logger.game('Broadcasting player:game_reset', { roomSize: io.sockets.adapter.rooms.get('players')?.size || 0 });
        io.to('players').emit('player:game_reset', { 
          type: 'restart', 
          message: 'Neue Runde! Dein Score wurde zurückgesetzt.' 
        });
      }
      logger.game('Broadcasting beamer:game_reset', {});
      io.to('beamer').emit('beamer:game_reset', { type: 'restart' });
      logger.game('Broadcasting admin:state_update', { socketId: socket.id.substring(0, 8) });
      socket.emit('admin:state_update', { 
        gameStatus: 'lobby',
        message: 'Spiel neu gestartet'
      });
      
      callback && callback({ 
        success: true, 
        message: 'Spiel neu gestartet',
        stats
      });
      
      logger.game('RESTART GAME callback sent', { success: true, stats }, 'info');
      
    } catch (error) {
      logger.game('RESTART GAME failed', { error: error.message, stack: error.stack }, 'error');
      callback && callback({ success: false, message: error.message });
    }
  });

  /**
   * Server Restart:
   * - Gracefully shutdown and restart the Node.js process
   * - Uses exit code 1 to trigger nodemon restart (with --exitcrash)
   */
  socket.on('admin:restart_server', (data, callback) => {
    if (!requireAdmin('admin:restart_server', callback)) return;
    try {
      logger.game('SERVER RESTART initiated', {}, 'warn');
      
      // Notify all clients before restart
      io.emit('server:restarting', { message: 'Server wird neu gestartet...' });
      
      // Send success response before shutdown
      callback && callback({ success: true, message: 'Server wird neu gestartet...' });
      
      // Graceful shutdown with delay to allow response to be sent
      setTimeout(() => {
        logger.info('🔃 Initiating graceful shutdown...');
        
        // Close all socket connections gracefully
        io.close(() => {
          logger.info('✅ All socket connections closed');
          // Exit with code 1 - nodemon --exitcrash will restart
          process.exit(1);
        });
        
        // Force exit after 3 seconds if graceful shutdown fails
        setTimeout(() => {
          logger.warn('⚠️ Forcing exit after timeout');
          process.exit(1);
        }, 3000);
        
      }, 500);
      
    } catch (error) {
      logger.error('Server Restart failed', { error: error.message });
      callback && callback({ success: false, message: error.message });
    }
  });
};
