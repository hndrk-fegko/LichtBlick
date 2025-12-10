/**
 * Scoring Service
 * 
 * Implements point calculation logic as per GAME_MECHANICS.md
 * 
 * Configuration parameters (stored in DB config.scoring):
 * - basePointsPerCorrect: Base points for a correct answer (default: 100)
 * - revealPenaltyEnabled: Reduce points per reveal (default: true)
 * - revealPenaltyPercent: Penalty per reveal (default: 10%)
 * - minimumPointsPercent: Minimum points even with many reveals (default: 20%)
 * - firstAnswerBonusEnabled: Bonus for 1st correct answer (default: true)
 * - firstAnswerBonusPoints: Points for 1st place (default: 50)
 * - secondAnswerBonusEnabled: Bonus for 2nd correct answer (default: true)
 * - secondAnswerBonusPoints: Points for 2nd place (default: 30)
 * - thirdAnswerBonusEnabled: Bonus for 3rd correct answer (default: true)
 * - thirdAnswerBonusPoints: Points for 3rd place (default: 20)
 * - speedBonusEnabled: Bonus for fast answers (default: false)
 * - speedBonusMaxPoints: Max speed bonus (default: 50)
 * - speedBonusTimeLimit: Time window in ms (default: 10000)
 */

const logger = require('../utils/logger');

/**
 * Get default scoring configuration
 * @returns {Object} Default scoring config
 */
function getDefaultScoringConfig() {
  return {
    basePointsPerCorrect: 100,
    revealPenaltyEnabled: true,
    revealPenaltyPercent: 10,
    minimumPointsPercent: 20,
    firstAnswerBonusEnabled: true,
    firstAnswerBonusPoints: 50,
    secondAnswerBonusEnabled: true,
    secondAnswerBonusPoints: 30,
    thirdAnswerBonusEnabled: true,
    thirdAnswerBonusPoints: 20,
    speedBonusEnabled: false,
    speedBonusMaxPoints: 50,
    speedBonusTimeLimit: 10000
  };
}

/**
 * Calculate points for a correct answer
 * 
 * Formula: (basePoints × reductionFactor) + positionBonus + speedBonus
 * 
 * @param {Object} config - Scoring configuration
 * @param {number} revealCount - Number of manual reveals
 * @param {number} correctAnswerPosition - 1st, 2nd, 3rd, etc. correct answer (1-indexed)
 * @param {number} responseTime - Time taken to answer (ms) - optional
 * @param {number} imageStartTime - When image was shown (timestamp) - optional
 * @returns {number} - Points earned
 */
function calculatePoints(config, revealCount, correctAnswerPosition, responseTime = null, imageStartTime = null) {
  // Merge with defaults
  const cfg = { ...getDefaultScoringConfig(), ...config };
  
  const basePoints = cfg.basePointsPerCorrect || 100;
  
  // 1. Apply reveal penalty
  let points = basePoints;
  
  if (cfg.revealPenaltyEnabled) {
    const penaltyPercent = cfg.revealPenaltyPercent || 10;
    const minimumPercent = cfg.minimumPointsPercent || 20;
    
    // Reduction factor: max(0.2, 1.0 - revealCount × 0.1)
    const reductionFactor = Math.max(
      minimumPercent / 100,
      1.0 - (revealCount * (penaltyPercent / 100))
    );
    
    points = Math.round(basePoints * reductionFactor);
  }
  
  // 2. Position-based bonus (1st, 2nd, 3rd correct answer)
  if (correctAnswerPosition === 1 && cfg.firstAnswerBonusEnabled) {
    points += cfg.firstAnswerBonusPoints || 50;
    logger.debug('Applied 1st place bonus', { bonus: cfg.firstAnswerBonusPoints });
  } else if (correctAnswerPosition === 2 && cfg.secondAnswerBonusEnabled) {
    points += cfg.secondAnswerBonusPoints || 30;
    logger.debug('Applied 2nd place bonus', { bonus: cfg.secondAnswerBonusPoints });
  } else if (correctAnswerPosition === 3 && cfg.thirdAnswerBonusEnabled) {
    points += cfg.thirdAnswerBonusPoints || 20;
    logger.debug('Applied 3rd place bonus', { bonus: cfg.thirdAnswerBonusPoints });
  }
  
  // 3. Speed bonus (optional)
  if (cfg.speedBonusEnabled && responseTime && imageStartTime) {
    const timeTaken = Date.now() - imageStartTime;
    const maxBonusTime = cfg.speedBonusTimeLimit || 10000; // 10 seconds
    
    if (timeTaken < maxBonusTime) {
      const speedFactor = (maxBonusTime - timeTaken) / maxBonusTime;
      const speedBonus = Math.round((cfg.speedBonusMaxPoints || 50) * speedFactor);
      points += speedBonus;
      logger.debug('Applied speed bonus', { timeTaken, speedBonus });
    }
  }
  
  return Math.max(0, points); // Never negative
}

/**
 * Check if answer is correct (case-insensitive)
 * 
 * @param {string} answer - Player's answer
 * @param {string} correctAnswer - Correct answer from database
 * @returns {boolean} - Is correct?
 */
function isAnswerCorrect(answer, correctAnswer) {
  if (!answer || !correctAnswer) return false;
  
  const normalizedAnswer = answer.trim().toLowerCase();
  const normalizedCorrect = correctAnswer.trim().toLowerCase();
  
  return normalizedAnswer === normalizedCorrect;
}

/**
 * Get current reveal count for an image
 * 
 * @param {Object} db - Database interface instance
 * @param {number} gameId - Game ID
 * @param {number} imageId - Image ID
 * @returns {Promise<number>} - Reveal count
 */
async function getRevealCount(db, gameId, imageId) {
  try {
    return await db.getRevealCount(gameId, imageId);
  } catch (error) {
    logger.error('Failed to get reveal count', { error: error.message, gameId, imageId });
    return 0;
  }
}

/**
 * Get the position of the next correct answer for an image (1st, 2nd, 3rd, etc.)
 * Returns 1 if no correct answers yet, 2 if one exists, etc.
 * 
 * @param {Object} db - Database interface instance
 * @param {number} imageId - Image ID
 * @returns {Promise<number>} - Position (1-indexed)
 */
async function getCorrectAnswerPosition(db, imageId) {
  try {
    const count = await db.getCorrectAnswerCount(imageId);
    return count + 1; // Next position (1-indexed)
  } catch (error) {
    logger.error('Failed to get correct answer position', { error: error.message, imageId });
    return 1;
  }
}

/**
 * Check if this is the first correct answer for an image
 * (Legacy wrapper for backwards compatibility)
 * 
 * @param {Object} db - Database interface instance
 * @param {number} imageId - Image ID
 * @returns {Promise<boolean>} - Is first correct?
 */
async function isFirstCorrectAnswer(db, imageId) {
  const pos = await getCorrectAnswerPosition(db, imageId);
  return pos === 1;
}

/**
 * Check if player already answered this image
 * 
 * @param {Object} db - Database interface instance
 * @param {number} playerId - Player ID
 * @param {number} imageId - Image ID
 * @returns {Promise<boolean>} - Has answered?
 */
async function hasPlayerAnswered(db, playerId, imageId) {
  try {
    return await db.hasPlayerAnsweredImage(playerId, imageId);
  } catch (error) {
    logger.error('Failed to check player answer', { error: error.message, playerId, imageId });
    return false;
  }
}

module.exports = {
  calculatePoints,
  getDefaultScoringConfig,
  isAnswerCorrect,
  getRevealCount,
  getCorrectAnswerPosition,
  isFirstCorrectAnswer,
  hasPlayerAnswered
};
