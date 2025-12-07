/**
 * Image Sync Utility
 * 
 * Validates consistency between database and filesystem:
 * - Removes DB entries for missing files
 * - Auto-imports files not in DB
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const UPLOADS_DIR = path.join(__dirname, '../../data/uploads');

/**
 * Sync database with filesystem
 * @param {Object} db - Database manager instance
 */
function syncImagesWithFilesystem(db) {
  logger.info('Image sync: Starting validation...');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    logger.info('Image sync: Created uploads directory');
    return;
  }
  
  // Get all files in uploads directory
  const filesOnDisk = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  
  // Get all images from database
  const imagesInDb = db.db.prepare('SELECT id, url, filename FROM images').all();
  
  let cleaned = 0;
  let imported = 0;
  
  // 1. Clean DB entries without files
  for (const img of imagesInDb) {
    const filename = img.url.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      // File missing - remove from DB
      logger.warn('Image sync: File missing, removing DB entry', { 
        id: img.id, 
        filename: img.filename,
        expectedPath: filePath 
      });
      
      // Also remove from game_images
      db.db.prepare('DELETE FROM game_images WHERE image_id = ?').run(img.id);
      db.db.prepare('DELETE FROM images WHERE id = ?').run(img.id);
      cleaned++;
    }
  }
  
  // 2. Auto-import files not in DB
  const dbFilenames = imagesInDb.map(img => img.url.replace('/uploads/', ''));
  
  for (const file of filesOnDisk) {
    if (!dbFilenames.includes(file)) {
      // File exists but not in DB - import it
      const url = `/uploads/${file}`;
      
      try {
        const stmt = db.db.prepare(`
          INSERT INTO images (filename, url)
          VALUES (?, ?)
        `);
        stmt.run(file, url);
        
        logger.info('Image sync: Auto-imported file', { filename: file });
        imported++;
      } catch (err) {
        logger.error('Image sync: Failed to import file', { 
          filename: file, 
          error: err.message 
        });
      }
    }
  }
  
  // Summary
  if (cleaned > 0 || imported > 0) {
    logger.info('Image sync: Completed', { 
      cleaned, 
      imported,
      totalInDb: imagesInDb.length - cleaned + imported,
      totalOnDisk: filesOnDisk.length
    });
  } else {
    logger.info('Image sync: All images in sync', {
      count: imagesInDb.length
    });
  }
}

module.exports = { syncImagesWithFilesystem };
