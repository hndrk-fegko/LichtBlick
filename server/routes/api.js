/**
 * API Routes
 * 
 * REST endpoints for settings, images, etc.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { validatePin } = require('../utils/validation');

/*
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                                                                   ║
 * ║   🎄 WILLKOMMEN IN DER API, NEUGIERIGER ENTWICKLER! 🎄           ║
 * ║                                                                   ║
 * ║   Du hast die REST-API gefunden! Gut gemacht.                    ║
 * ║                                                                   ║
 * ║   Ein paar Fun Facts:                                            ║
 * ║   • Das Projekt heißt "LichtBlick"                              ║
 * ║   • Es wurde für Gottesdienste der FeG entwickelt               ║
 * ║   • Der Code ist Open Source - Verbesserungen willkommen!       ║
 * ║                                                                   ║
 * ║   PS: Alle schreibenden Endpoints sind geschützt! 🔒            ║
 * ║   PPS: Frohe Weihnachten! 🎅                                     ║
 * ║                                                                   ║
 * ║        *    *    *                                               ║
 * ║       /|\  /|\  /|\     "Macht hoch die Tür,                     ║
 * ║      / | \/ | \/ | \     die Tor macht weit..."                  ║
 * ║         |    |    |                                              ║
 * ║                                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ============================================
// 🔐 Admin Authentication Middleware
// ============================================

// In-memory admin tokens (cleared on server restart = extra security)
const adminTokens = new Map(); // token -> { createdAt, expiresAt }
const TOKEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

// Export tokens map for use in uploads.js
router.use((req, res, next) => {
  req.app.set('adminTokens', adminTokens);
  next();
});

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of adminTokens) {
    if (data.expiresAt < now) {
      adminTokens.delete(token);
    }
  }
}

// Cleanup every 15 minutes
setInterval(cleanExpiredTokens, 15 * 60 * 1000);

/**
 * Middleware: Require admin authentication
 * Accepts either:
 * 1. Bearer token in Authorization header (session token)
 * 2. URL admin token in Authorization header (persistent token from server start)
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('🔒 Unauthorized API access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      message: '🔒 Authentifizierung erforderlich',
      hint: 'Bitte zuerst über Admin-Panel einloggen'
    });
  }
  
  const token = authHeader.slice(7); // Remove 'Bearer '
  
  // Check 1: Is it the persistent URL admin token?
  const urlAdminToken = req.app.get('adminToken');
  if (token === urlAdminToken) {
    req.adminToken = token;
    return next();
  }
  
  // Check 2: Is it a valid session token?
  const tokenData = adminTokens.get(token);
  
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    adminTokens.delete(token); // Clean up expired token
    return res.status(401).json({
      success: false,
      message: '🔒 Token abgelaufen oder ungültig',
      hint: 'Bitte erneut einloggen'
    });
  }
  
  // Token valid - proceed
  req.adminToken = token;
  next();
}

// POST /api/auth/login - Get admin token with PIN
router.post('/auth/login', (req, res) => {
  try {
    const { pin } = req.body;
    const storedPin = db.getConfig('adminPin') || '1234';
    
    if (pin !== storedPin) {
      logger.warn('🔐 Failed admin login attempt', { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'PIN falsch'
      });
    }
    
    // Generate token
    const token = generateToken();
    const now = Date.now();
    adminTokens.set(token, {
      createdAt: now,
      expiresAt: now + TOKEN_EXPIRY_MS
    });
    
    logger.info('🔓 Admin logged in via API', { ip: req.ip });
    
    res.json({
      success: true,
      data: {
        token,
        expiresIn: TOKEN_EXPIRY_MS / 1000 // seconds
      }
    });
  } catch (error) {
    logger.error('Auth login failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// POST /api/auth/logout - Invalidate token
router.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    adminTokens.delete(token);
  }
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/check - Check if token is valid
router.get('/auth/check', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ success: true, data: { authenticated: false } });
  }
  
  const token = authHeader.slice(7);
  const tokenData = adminTokens.get(token);
  
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    adminTokens.delete(token);
    return res.json({ success: true, data: { authenticated: false } });
  }
  
  res.json({
    success: true,
    data: {
      authenticated: true,
      expiresAt: tokenData.expiresAt
    }
  });
});

// Mount image upload routes (with auth applied inside)
router.use('/images', require('./uploads'));

// GET /api/settings (public - read only)
router.get('/settings', async (req, res) => {
  try {
    const settings = {
      darkMode: db.getConfig('darkMode') || false,
      qrVisible: db.getConfig('qrVisible') || false,
      scoring: db.getConfig('scoring') || {
        basePointsPerCorrect: 100,
        revealPenaltyEnabled: true,
        revealPenaltyPercent: 10,
        minimumPointsPercent: 20,
        firstAnswerBonusEnabled: true,
        firstAnswerBonusPoints: 50,
        speedBonusEnabled: false
      },
      spotlight: db.getConfig('spotlight') || {
        radius: 80,
        strength: 0.5,
        increaseAfterSeconds: 30,
        increaseFactor: 1.5
      }
    };
    
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

// PUT /api/settings (🔒 protected)
router.put('/settings', requireAdminAuth, async (req, res) => {
  try {
    const { darkMode, qrVisible, scoring, spotlight } = req.body;
    
    if (darkMode !== undefined) {
      db.setConfig('darkMode', darkMode);
    }
    
    if (qrVisible !== undefined) {
      db.setConfig('qrVisible', qrVisible);
    }
    
    if (scoring) {
      db.setConfig('scoring', scoring);
    }
    
    if (spotlight) {
      db.setConfig('spotlight', spotlight);
    }
    
    logger.info('Settings updated', { darkMode, qrVisible, scoring, spotlight });
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error('Failed to update settings', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// PATCH /api/settings (partial update) (🔒 protected)
router.patch('/settings', requireAdminAuth, async (req, res) => {
  try {
    const updates = req.body;
    
    Object.keys(updates).forEach(key => {
      db.setConfig(key, updates[key]);
    });
    
    logger.info('Settings partially updated', updates);
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error('Failed to update settings', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// GET /api/images - This is now handled by uploads.js router
// (keeping for backwards compatibility, but the real endpoint is in uploads.js)

// POST /api/pin (🔒 protected)
router.post('/pin', requireAdminAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    
    if (!validatePin(pin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid PIN (4-10 characters required)' 
      });
    }
    
    db.setConfig('adminPin', pin);
    logger.info('Admin PIN set');
    
    res.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    logger.error('Failed to set PIN', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to set PIN' });
  }
});

// DELETE /api/pin (🔒 protected)
router.delete('/pin', requireAdminAuth, async (req, res) => {
  try {
    db.setConfig('adminPin', null);
    logger.info('Admin PIN removed');
    
    res.json({ success: true, message: 'PIN removed' });
  } catch (error) {
    logger.error('Failed to remove PIN', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to remove PIN' });
  }
});

// GET /api/check-pin
router.get('/check-pin', async (req, res) => {
  try {
    const pin = db.getConfig('adminPin');
    
    res.json({ 
      success: true, 
      data: { 
        pinRequired: !!pin,
        pinSetAt: pin ? new Date().toISOString() : null
      } 
    });
  } catch (error) {
    logger.error('Failed to check PIN', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to check PIN' });
  }
});

// POST /api/verify-pin
router.post('/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const storedPin = db.getConfig('adminPin');
    
    if (!storedPin) {
      return res.json({ success: true, message: 'No PIN required' });
    }
    
    if (pin === storedPin) {
      logger.info('PIN verified successfully');
      res.json({ success: true, message: 'PIN correct' });
    } else {
      logger.warn('PIN verification failed');
      res.status(401).json({ success: false, message: 'Incorrect PIN' });
    }
  } catch (error) {
    logger.error('Failed to verify PIN', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to verify PIN' });
  }
});

// ============================================
// Game Images Management (Junction Table)
// ============================================

// GET /api/game-images - Get images assigned to current game (or latest ended game)
router.get('/game-images', async (req, res) => {
  try {
    // Try active game first, fallback to latest game (for ended state)
    const game = db.getActiveGame() || db.getLatestGame();
    if (!game) {
      return res.json({ success: true, data: [] });
    }
    
    const stmt = db.db.prepare(`
      SELECT gi.*, i.filename, i.url 
      FROM game_images gi
      JOIN images i ON gi.image_id = i.id
      WHERE gi.game_id = ?
      ORDER BY gi.display_order ASC
    `);
    const gameImages = stmt.all(game.id);
    
    res.json({
      success: true,
      data: gameImages.map(gi => ({
        ...gi,
        is_played: !!gi.is_played
      }))
    });
  } catch (error) {
    logger.error('Failed to get game images', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get game images' });
  }
});

// POST /api/game-images - Add image to current game (🔒 protected)
router.post('/game-images', requireAdminAuth, async (req, res) => {
  try {
    const { imageId, correctAnswer } = req.body;
    
    if (!imageId) {
      return res.status(400).json({ success: false, message: 'imageId required' });
    }
    
    const game = db.getActiveGame();
    if (!game) {
      return res.status(400).json({ success: false, message: 'No active game' });
    }
    
    // Get next display_order
    const maxOrderStmt = db.db.prepare(
      'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM game_images WHERE game_id = ?'
    );
    const { next_order } = maxOrderStmt.get(game.id);
    
    // Insert game_image
    const stmt = db.db.prepare(`
      INSERT INTO game_images (game_id, image_id, correct_answer, display_order)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(game.id, imageId, correctAnswer || null, next_order);
    
    logger.info('Image added to game', { gameId: game.id, imageId, correctAnswer });
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        image_id: imageId,
        correct_answer: correctAnswer || null,
        display_order: next_order,
        is_played: false
      },
      message: 'Bild zum Spiel hinzugefügt'
    });
  } catch (error) {
    // Handle unique constraint violation
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, message: 'Bild bereits im Spiel' });
    }
    logger.error('Failed to add game image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to add game image' });
  }
});

// DELETE /api/game-images/:id - Remove image from game (🔒 protected)
router.delete('/game-images/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const stmt = db.db.prepare('DELETE FROM game_images WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Game image not found' });
    }
    
    logger.info('Image removed from game', { id });
    res.json({ success: true, message: 'Bild aus Spiel entfernt' });
  } catch (error) {
    logger.error('Failed to remove game image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to remove game image' });
  }
});

// PATCH /api/game-images/:id - Update game image (answer, played status) (🔒 protected)
router.patch('/game-images/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { correctAnswer, isPlayed } = req.body;
    
    const updates = [];
    const params = [];
    
    if (correctAnswer !== undefined) {
      updates.push('correct_answer = ?');
      params.push(correctAnswer);
    }
    
    if (isPlayed !== undefined) {
      updates.push('is_played = ?');
      params.push(isPlayed ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }
    
    params.push(id);
    const stmt = db.db.prepare(`UPDATE game_images SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...params);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Game image not found' });
    }
    
    logger.info('Game image updated', { id, correctAnswer, isPlayed });
    res.json({ success: true, message: 'Aktualisiert' });
  } catch (error) {
    logger.error('Failed to update game image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update game image' });
  }
});

// PATCH /api/game-images/reorder - Reorder game images (🔒 protected)
router.patch('/game-images/reorder', requireAdminAuth, async (req, res) => {
  try {
    const { order } = req.body; // Array of game_image IDs in new order
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'order must be an array' });
    }
    
    const updateStmt = db.db.prepare('UPDATE game_images SET display_order = ? WHERE id = ?');
    
    const transaction = db.db.transaction((ids) => {
      ids.forEach((id, index) => {
        updateStmt.run(index, id);
      });
    });
    
    transaction(order);
    
    logger.info('Game images reordered', { order });
    res.json({ success: true, message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    logger.error('Failed to reorder game images', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to reorder' });
  }
});

// POST /api/game-images/reset-played - Reset all is_played flags (🔒 protected)
router.post('/game-images/reset-played', requireAdminAuth, async (req, res) => {
  try {
    const game = db.getActiveGame();
    if (!game) {
      return res.status(400).json({ success: false, message: 'No active game' });
    }
    
    const stmt = db.db.prepare('UPDATE game_images SET is_played = 0 WHERE game_id = ?');
    stmt.run(game.id);
    
    logger.info('Game images reset', { gameId: game.id });
    res.json({ success: true, message: 'Alle Bilder zurückgesetzt' });
  } catch (error) {
    logger.error('Failed to reset game images', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to reset' });
  }
});

// ============================================
// Word List Management
// ============================================

// GET /api/words - Get base word list (without deduplication)
router.get('/words', async (req, res) => {
  try {
    const wordList = db.getConfig('wordList') || [];
    res.json({ success: true, data: wordList });
  } catch (error) {
    logger.error('Failed to get word list', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get words' });
  }
});

// GET /api/words/:imageId - Get word list for a specific image (deduplicated + shuffled)
// The solution word is included but decoy duplicates are removed
router.get('/words/:imageId', async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId);
    
    // 1. Get base word list (decoys/Täuschwörter)
    const wordList = db.getConfig('wordList') || [];
    
    // 2. Get correct answer for this image from game_images
    const game = db.getActiveGame();
    let correctAnswer = null;
    
    if (game) {
      const stmt = db.db.prepare(`
        SELECT correct_answer FROM game_images 
        WHERE game_id = ? AND image_id = ?
      `);
      const result = stmt.get(game.id, imageId);
      correctAnswer = result?.correct_answer || null;
    }
    
    // 3. Deduplicate: Remove solution word from decoy list (case-insensitive)
    let finalWords = [...wordList];
    
    if (correctAnswer) {
      const solutionLower = correctAnswer.trim().toLowerCase();
      
      // Remove any word that matches the solution (case-insensitive)
      finalWords = finalWords.filter(word => 
        word.trim().toLowerCase() !== solutionLower
      );
      
      // Add the solution word (will be shuffled in)
      finalWords.push(correctAnswer);
    }
    
    // 4. Shuffle the array (Fisher-Yates)
    for (let i = finalWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalWords[i], finalWords[j]] = [finalWords[j], finalWords[i]];
    }
    
    logger.debug('Word list generated for image', { 
      imageId, 
      totalWords: finalWords.length,
      hasSolution: !!correctAnswer 
    });
    
    res.json({ success: true, data: finalWords });
  } catch (error) {
    logger.error('Failed to get word list for image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get words' });
  }
});

// PUT /api/words - Update word list (🔒 protected)
router.put('/words', requireAdminAuth, async (req, res) => {
  try {
    const { words } = req.body;
    
    if (!Array.isArray(words)) {
      return res.status(400).json({ success: false, message: 'words must be an array' });
    }
    
    db.setConfig('wordList', words);
    logger.info('Word list updated', { count: words.length });
    res.json({ success: true, message: 'Words saved' });
  } catch (error) {
    logger.error('Failed to update word list', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to save words' });
  }
});

// ============================================
// 🥚 Easter Egg für neugierige Entwickler
// ============================================

// Honeypot: Wer /api/admin aufruft, wird geloggt
router.all('/admin*', (req, res) => {
  logger.warn('🍯 Honeypot triggered!', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(418).json({
    success: false,
    message: '🫖 I\'m a teapot!',
    hint: 'Netter Versuch! Aber die Admin-API gibt es hier nicht.',
    easteregg: `
    
    🎄 FROHE WEIHNACHTEN! 🎄
    
    Du hast den Honeypot gefunden!
    
    Da du offensichtlich neugierig bist,
    hier ein Geheimnis: Die echte Admin-
    Kommunikation läuft über WebSockets.
    
    Aber psst - nicht weitersagen! 🤫
    
    PS: Der Source-Code ist Open Source.
        Schau mal auf GitHub vorbei!
    
    `,
    timestamp: new Date().toISOString()
  });
});

// 🎁 Secret endpoint für die ganz Hartgesottenen
router.get('/secret', (req, res) => {
  logger.info('🔍 Someone found the secret endpoint!', { ip: req.ip });
  
  res.json({
    message: '🎁 Du hast das Geheimnis gefunden!',
    credits: {
      project: 'LichtBlick - Interaktives Ratespiel für Gemeinden',
      purpose: 'Gottesdienste für Jung und Alt',
      stack: 'Node.js + Socket.IO + SQLite + Vanilla JS',
      motto: '"Macht hoch die Tür, die Tor macht weit!"'
    },
    ascii: `
    
          ★
         /|\\
        / | \\
       /  |  \\
      /  /|\\  \\
     /  / | \\  \\
    /  /  |  \\  \\
   /  /   ★   \\  \\
      |   |   |
      |___|___|
      
   🎄 Frohe Weihnachten! 🎄
   
    `,
    hint: 'Bitte nur gucken, nicht das Spiel sabotieren! 😊'
  });
});

module.exports = router;
