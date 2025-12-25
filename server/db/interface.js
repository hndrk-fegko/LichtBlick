/**
 * Database Interface Definition
 * 
 * This file defines the common interface that both SQLite and MySQL implementations must follow.
 * All methods are async to accommodate MySQL's promise-based API.
 */

/**
 * Database Interface
 * @interface DatabaseInterface
 */

/**
 * Get config value by key
 * @async
 * @param {string} key - Config key
 * @returns {Promise<any>} - Parsed JSON value or null
 */

/**
 * Set config value
 * @async
 * @param {string} key - Config key
 * @param {any} value - Value (will be JSON-serialized)
 * @returns {Promise<void>}
 */

/**
 * Get all images from pool
 * @async
 * @returns {Promise<Array>} - Array of image objects
 */

/**
 * Get game images for a specific game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<Array>} - Array of game image objects with image details
 */

/**
 * Get start image
 * @async
 * @returns {Promise<Object|null>} - Start image or null
 */

/**
 * Get end image
 * @async
 * @returns {Promise<Object|null>} - End image or null
 */

/**
 * Get active game
 * @async
 * @returns {Promise<Object|null>} - Active game or null
 */

/**
 * Get latest game (including ended games)
 * @async
 * @returns {Promise<Object|null>} - Latest game or null
 */

/**
 * Create new game
 * @async
 * @returns {Promise<number>} - New game ID
 */

/**
 * Get player by socket ID
 * @async
 * @param {string} socketId - Socket ID
 * @returns {Promise<Object|null>} - Player or null
 */

/**
 * Create player
 * @async
 * @param {number} gameId - Game ID
 * @param {string} name - Player name
 * @param {string} socketId - Socket ID
 * @returns {Promise<number>} - New player ID
 */

/**
 * Get leaderboard
 * @async
 * @param {number} gameId - Game ID
 * @param {number} limit - Max number of players (default 10)
 * @returns {Promise<Array>} - Array of player objects with ranks
 */

/**
 * Update player last_seen timestamp (keep-alive)
 * @async
 * @param {number} playerId - Player ID
 * @returns {Promise<void>}
 */

/**
 * Soft-delete inactive players (older than 60 seconds)
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<number>} - Number of players marked inactive
 */

/**
 * Restore inactive player (session restore)
 * @async
 * @param {number} playerId - Player ID
 * @param {string} socketId - New socket ID
 * @returns {Promise<void>}
 */

/**
 * Get active player count for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<number>} - Count of active players
 */

/**
 * Update game status
 * @async
 * @param {number} gameId - Game ID
 * @param {string} status - New status (lobby|playing|ended)
 * @returns {Promise<void>}
 */

/**
 * Persist or update current PIN
 * @async
 * @param {string} pin - PIN string
 * @param {string} host - Host for join URL
 * @returns {Promise<void>}
 */

/**
 * Get current PIN object
 * @async
 * @returns {Promise<Object|null>}
 */

/**
 * Set admin protection state with optional expiry
 * @async
 * @param {boolean} enabled
 * @param {number|null} expiresAtUnix - seconds since epoch, or null
 * @returns {Promise<void>}
 */

/**
 * Get protection state
 * @async
 * @returns {Promise<{enabled:boolean, expiresAt:number|null}>}
 */

/**
 * Save player join host (domain:port)
 * @async
 * @param {string} host
 * @returns {Promise<void>}
 */

/**
 * Get player join URL based on stored host
 * @async
 * @returns {Promise<string|null>}
 */

/**
 * Close database connection
 * @async
 * @returns {Promise<void>}
 */

// ========================================
// IMAGE MANAGEMENT
// ========================================

/**
 * Get image by ID
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<Object|null>} - Image object or null
 */

/**
 * Get all images (ordered by upload date)
 * @async
 * @returns {Promise<Array>} - Array of image objects
 */

/**
 * Update image metadata (filename/flags)
 * @async
 * @param {number} imageId - Image ID
 * @param {Object} updates - Fields to update {filename, is_start_image, is_end_image}
 * @returns {Promise<void>}
 */

/**
 * Set start image (clears previous start image)
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<void>}
 */

/**
 * Set end image (clears previous end image)
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<void>}
 */

/**
 * Clear start image flag
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<void>}
 */

/**
 * Clear end image flag
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<void>}
 */

/**
 * Clear both start and end image flags
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<void>}
 */

// ========================================
// GAME IMAGE MANAGEMENT
// ========================================

/**
 * Get game image by ID
 * @async
 * @param {number} gameImageId - game_images.id
 * @returns {Promise<Object|null>} - Game image object or null
 */

/**
 * Add image to game
 * @async
 * @param {number} gameId - Game ID
 * @param {number} imageId - Image ID
 * @param {number} displayOrder - Display order
 * @param {string|null} word - Associated word
 * @returns {Promise<number>} - New game_images.id
 */

/**
 * Remove image from game
 * @async
 * @param {number} gameImageId - game_images.id
 * @returns {Promise<void>}
 */

/**
 * Update game image properties
 * @async
 * @param {number} gameImageId - game_images.id
 * @param {Object} updates - Fields to update {reveal_count, is_played, word, display_order}
 * @returns {Promise<void>}
 */

/**
 * Update display order for a game image
 * @async
 * @param {number} gameImageId - game_images.id
 * @param {number} displayOrder - New display order
 * @returns {Promise<void>}
 */

/**
 * Reset all is_played flags for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

// ========================================
// PLAYER MANAGEMENT
// ========================================

/**
 * Get player by ID
 * @async
 * @param {number} playerId - Player ID
 * @returns {Promise<Object|null>} - Player object or null
 */

/**
 * Get existing player by name and game
 * @async
 * @param {number} gameId - Game ID
 * @param {string} name - Player name
 * @returns {Promise<Object|null>} - Player or null
 */

/**
 * Update player (for reconnection)
 * @async
 * @param {number} playerId - Player ID
 * @param {string} socketId - New socket ID
 * @returns {Promise<void>}
 */

/**
 * Update player name
 * @async
 * @param {number} playerId - Player ID
 * @param {string} name - New name
 * @returns {Promise<void>}
 */

/**
 * Update player score
 * @async
 * @param {number} playerId - Player ID
 * @param {number} scoreIncrement - Score to add
 * @returns {Promise<void>}
 */

/**
 * Get active player count
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<number>} - Count
 */

// ========================================
// ANSWER MANAGEMENT
// ========================================

/**
 * Save player answer
 * @async
 * @param {number} playerId - Player ID
 * @param {number} imageId - Image ID
 * @param {string} answer - Answer text
 * @param {boolean} isCorrect - Is correct?
 * @param {number} points - Points earned
 * @param {number} timeMs - Answer time in ms
 * @returns {Promise<number>} - New answer ID
 */

/**
 * Get all answers for an image
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<Array>} - Array of answer objects with player names
 */

/**
 * Update answer correctness and points
 * @async
 * @param {number} answerId - Answer ID
 * @param {boolean} isCorrect - New correctness
 * @param {number} points - New points
 * @returns {Promise<void>}
 */

/**
 * Check if player has answered image
 * @async
 * @param {number} playerId - Player ID
 * @param {number} imageId - Image ID
 * @returns {Promise<boolean>} - Has answered?
 */

/**
 * Get count of correct answers for image
 * @async
 * @param {number} imageId - Image ID
 * @returns {Promise<number>} - Count
 */

// ========================================
// IMAGE STATE MANAGEMENT
// ========================================

/**
 * Get all image states for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<Array>} - Array of image states
 */

/**
 * Get image state for game
 * @async
 * @param {number} gameId - Game ID
 * @param {number} imageId - Image ID
 * @returns {Promise<Object|null>} - Image state or null
 */

/**
 * Update image state (reveal count)
 * @async
 * @param {number} gameId - Game ID
 * @param {number} imageId - Image ID
 * @param {number} revealCount - New reveal count
 * @returns {Promise<void>}
 */

/**
 * Get reveal count for image
 * @async
 * @param {number} gameId - Game ID
 * @param {number} imageId - Image ID
 * @returns {Promise<number>} - Reveal count
 */

// ========================================
// STATISTICS & QUERIES
// ========================================

/**
 * Get statistics for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<Object>} - Stats object {totalPlayers, activePlayers, totalAnswers, correctAnswers}
 */

/**
 * Get assigned word for game image
 * @async
 * @param {number} gameId - Game ID
 * @param {string} word - Word to find
 * @returns {Promise<Array>} - Array of matching game images
 */

// ========================================
// GAME MANAGEMENT & RESET
// ========================================

/**
 * Reset game to lobby (keep players, reset scores)
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Reset player scores for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Delete all players for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Delete all answers for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Delete all image states for a game
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Delete played game images
 * @async
 * @param {number} gameId - Game ID
 * @returns {Promise<void>}
 */

/**
 * Clear all start/end image flags
 * @async
 * @returns {Promise<void>}
 */

/**
 * Full database reset (delete all data, reinitialize)
 * @async
 * @returns {Promise<void>}
 */

module.exports = {};
