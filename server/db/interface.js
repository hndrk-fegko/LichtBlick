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

module.exports = {};
