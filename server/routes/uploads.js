/**
 * Image Upload Routes
 * 
 * Handles file uploads with Multer
 * New architecture: Images are uploaded to a pool (no type required)
 * 
 * 🔒 All mutating endpoints require admin authentication via Bearer token
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const logger = require('../utils/logger');

// ============================================
// 🔐 Admin Authentication Check (inline)
// Tokens are managed in api.js, we just validate here
// ============================================

// Import the token store from parent - we use a shared approach via app.locals
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('🔒 Unauthorized upload API access attempt', {
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
  
  const token = authHeader.slice(7);
  
  // Check 1: Is it the persistent URL admin token?
  const urlAdminToken = req.app.get('adminToken');
  if (token === urlAdminToken) {
    return next();
  }
  
  // Check 2: Is it a valid session token?
  const adminTokens = req.app.get('adminTokens');
  if (adminTokens) {
    const tokenData = adminTokens.get(token);
    if (tokenData && tokenData.expiresAt >= Date.now()) {
      return next();
    }
  }
  
  return res.status(401).json({
    success: false,
    message: '🔒 Token abgelaufen oder ungültig'
  });
}

// Helper to emit start/end image changes to beamer
function emitImageRoleChange(req) {
  const io = req.app.get('io');
  if (!io) return;
  
  // Get current start and end images
  const startImage = db.prepare('SELECT * FROM images WHERE is_start_image = 1').get();
  const endImage = db.prepare('SELECT * FROM images WHERE is_end_image = 1').get();
  
  io.emit('beamer:image_roles_changed', {
    startImage: startImage ? { id: startImage.id, url: startImage.url } : null,
    endImage: endImage ? { id: endImage.id, url: endImage.url } : null
  });
  
  logger.info('Emitted image role change', { 
    startImage: startImage?.id || null, 
    endImage: endImage?.id || null 
  });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Configure Multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  }
});

// POST /api/images/upload - Upload image to pool (🔒 protected)
router.post('/upload', checkAdminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Insert into database (no type, no game_id)
    const stmt = db.prepare(`
      INSERT INTO images (filename, url)
      VALUES (?, ?)
    `);
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = stmt.run(
      req.file.originalname,
      imageUrl
    );
    
    logger.info('Image uploaded to pool', {
      imageId: result.lastInsertRowid,
      filename: req.file.originalname,
      size: req.file.size
    });
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        filename: req.file.originalname,
        url: imageUrl,
        is_start_image: false,
        is_end_image: false
      },
      message: 'Image uploaded successfully'
    });
    
  } catch (error) {
    logger.error('Image upload failed', { error: error.message });
    
    // Delete file if it was uploaded
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// GET /api/images - Get all images from pool
router.get('/', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM images ORDER BY uploaded_at DESC');
    const images = stmt.all();
    
    res.json({
      success: true,
      data: images.map(img => ({
        ...img,
        is_start_image: !!img.is_start_image,
        is_end_image: !!img.is_end_image
      }))
    });
  } catch (error) {
    logger.error('Failed to get images', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get images' });
  }
});

// PATCH /api/images/:id/set-start - Set image as start image (🔒 protected)
router.patch('/:id/set-start', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    // Clear previous start image (but not on this image if it's also end)
    db.prepare('UPDATE images SET is_start_image = 0 WHERE is_start_image = 1 AND id != ?').run(imageId);
    
    // Set new start image (keep is_end_image unchanged)
    const stmt = db.prepare('UPDATE images SET is_start_image = 1 WHERE id = ?');
    const result = stmt.run(imageId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    logger.info('Start image set', { imageId });
    emitImageRoleChange(req);
    res.json({ success: true, message: 'Bild als Start-Bild gesetzt' });
    
  } catch (error) {
    logger.error('Failed to set start image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to set start image' });
  }
});

// PATCH /api/images/:id/set-end - Set image as end image (🔒 protected)
router.patch('/:id/set-end', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    // Clear previous end image (but not on this image if it's also start)
    db.prepare('UPDATE images SET is_end_image = 0 WHERE is_end_image = 1 AND id != ?').run(imageId);
    
    // Set new end image (keep is_start_image unchanged)
    const stmt = db.prepare('UPDATE images SET is_end_image = 1 WHERE id = ?');
    const result = stmt.run(imageId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    logger.info('End image set', { imageId });
    emitImageRoleChange(req);
    res.json({ success: true, message: 'Bild als End-Bild gesetzt' });
    
  } catch (error) {
    logger.error('Failed to set end image', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to set end image' });
  }
});

// PATCH /api/images/:id/clear-start - Clear only start role (🔒 protected)
router.patch('/:id/clear-start', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    const stmt = db.prepare('UPDATE images SET is_start_image = 0 WHERE id = ?');
    const result = stmt.run(imageId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    logger.info('Start role cleared', { imageId });
    emitImageRoleChange(req);
    res.json({ success: true, message: 'Start-Rolle entfernt' });
    
  } catch (error) {
    logger.error('Failed to clear start role', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to clear start role' });
  }
});

// PATCH /api/images/:id/clear-end - Clear only end role (🔒 protected)
router.patch('/:id/clear-end', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    const stmt = db.prepare('UPDATE images SET is_end_image = 0 WHERE id = ?');
    const result = stmt.run(imageId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    logger.info('End role cleared', { imageId });
    emitImageRoleChange(req);
    res.json({ success: true, message: 'End-Rolle entfernt' });
    
  } catch (error) {
    logger.error('Failed to clear end role', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to clear end role' });
  }
});

// PATCH /api/images/:id/clear-role - Clear start/end role (both) (🔒 protected)
router.patch('/:id/clear-role', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    const stmt = db.prepare('UPDATE images SET is_start_image = 0, is_end_image = 0 WHERE id = ?');
    const result = stmt.run(imageId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    logger.info('Image role cleared', { imageId });
    emitImageRoleChange(req);
    res.json({ success: true, message: 'Rolle entfernt' });
    
  } catch (error) {
    logger.error('Failed to clear role', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to clear role' });
  }
});

// DELETE /api/images/:id - Delete image from pool (🔒 protected)
router.delete('/:id', checkAdminAuth, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    // Get image from database
    const stmt = db.prepare('SELECT * FROM images WHERE id = ?');
    const image = stmt.get(imageId);
    
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    // Delete file from filesystem
    const filePath = path.join(__dirname, '../../data', image.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from game_images first (referential integrity)
    db.prepare('DELETE FROM game_images WHERE image_id = ?').run(imageId);
    
    // Delete from database
    const deleteStmt = db.prepare('DELETE FROM images WHERE id = ?');
    deleteStmt.run(imageId);
    
    logger.info('Image deleted', { imageId, filename: image.filename });
    
    res.json({ success: true, message: 'Image deleted' });
    
  } catch (error) {
    logger.error('Image delete failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

module.exports = router;
