/**
 * Test Data for LichtBlick E2E Tests
 * Contains test users, invalid credentials, and other test data
 */

module.exports = {
  // Valid test users for testing
  testUsers: {
    player1: { 
      username: 'testplayer1', 
      password: 'test123',
      name: 'Test Player 1'
    },
    player2: { 
      username: 'testplayer2', 
      password: 'test123',
      name: 'Test Player 2'
    },
    player3: { 
      username: 'testplayer3', 
      password: 'test123',
      name: 'Test Player 3'
    },
    admin: { 
      username: 'testadmin', 
      password: 'admin123', 
      pin: '1234',
      isAdmin: true 
    }
  },

  // Invalid credentials for negative testing
  invalidCredentials: [
    { username: '', password: '', description: 'Empty credentials' },
    { username: 'a', password: '12', description: 'Too short' },
    { username: 'test@#$', password: 'test123', description: 'Invalid characters in username' },
    { username: 'validuser', password: '12345', description: 'Password too short (min 6 chars)' }
  ],

  // Valid player names
  validPlayerNames: [
    'Max',
    'Anna',
    'TestSpieler123',
    'Player_One',
    'Gamer42'
  ],

  // Invalid player names
  invalidPlayerNames: [
    'A', // Too short (min 2 chars)
    'ThisNameIsWayTooLongForAPlayerAndShouldBeRejected', // Too long (max 20 chars)
    'Test@User#', // Special characters
    '', // Empty
    '   ' // Only whitespace
  ],

  // Test game answers
  testAnswers: {
    correct: ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus'],
    incorrect: ['WrongAnswer', 'FalscheAntwort', 'NichtKorrekt'],
    mixed: ['Apfel', 'Wrong', 'Banane', 'NotCorrect', 'Kirsche']
  },

  // Default admin PIN (from schema.sql)
  defaultAdminPin: '1234',

  // Default word list (from schema.sql)
  defaultWordList: ['Apfel', 'Banane', 'Kirsche', 'Hund', 'Katze', 'Maus', 'Stern', 'Sonne', 'Mond'],

  // Test image data
  testImages: {
    valid: {
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      size: 102400 // 100KB
    },
    tooLarge: {
      name: 'huge-image.jpg',
      mimeType: 'image/jpeg',
      size: 11485760 // 11MB (exceeds 10MB limit)
    },
    invalidType: {
      name: 'document.pdf',
      mimeType: 'application/pdf',
      size: 51200
    }
  },

  // WebSocket events
  socketEvents: {
    join: 'player:join',
    answer: 'player:answer',
    gameState: 'game:state',
    leaderboard: 'game:leaderboard',
    adminConnect: 'admin:connect',
    beamerConnect: 'beamer:connect'
  }
};
