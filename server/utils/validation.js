/**
 * Input Validation Utilities
 * 
 * Centralized validation logic for security
 */

/**
 * Validate player name
 * @param {string} name - Player name
 * @returns {boolean} - Valid or not
 */
function validatePlayerName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 2 || name.length > 20) return false;
  // Allow alphanumeric + German umlauts + spaces
  if (!/^[a-zA-Z0-9äöüÄÖÜß\s]+$/.test(name)) return false;
  return true;
}

/**
 * Validate answer string
 * @param {string} answer - Player answer
 * @returns {boolean} - Valid or not
 */
function validateAnswer(answer) {
  if (typeof answer !== 'string') return false;
  if (answer.length < 1 || answer.length > 50) return false;
  return true;
}

/**
 * Validate admin PIN
 * @param {string} pin - PIN code
 * @returns {boolean} - Valid or not
 */
function validatePin(pin) {
  if (typeof pin !== 'string') return false;
  if (pin.length < 4 || pin.length > 10) return false;
  return true;
}

/**
 * Validate word list
 * @param {Array} words - Array of words
 * @returns {boolean} - Valid or not
 */
function validateWordList(words) {
  if (!Array.isArray(words)) return false;
  return words.every(word => typeof word === 'string' && word.length >= 1 && word.length <= 50);
}

module.exports = {
  validatePlayerName,
  validateAnswer,
  validatePin,
  validateWordList
};
