/**
 * Player Client
 * 
 * Mobile player interface for LichtBlick
 */

// State
let playerId = null;
let playerName = null;
let currentScore = 0;
let selectedWord = null;      // Currently highlighted word in UI
let lockedWord = null;        // Word that has been "eingeloggt" (locked in)
let lockedAt = null;          // Timestamp when word was locked
let currentImageId = null;
let keepAliveInterval = null;
let currentWordList = [];     // Loaded from server, deduplicated per image

// DOM Elements
const screens = {
  login: document.getElementById('login-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  const savedPlayerId = sessionStorage.getItem('playerId');
  const savedPlayerName = sessionStorage.getItem('playerName');
  
  if (savedPlayerId && savedPlayerName) {
    // Try to reconnect
    attemptReconnect(savedPlayerId, savedPlayerName);
  }
  
  // Setup event listeners
  setupEventListeners();
  setupSocketListeners();
  
  // Connection status
  updateConnectionStatus();
});

function setupEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Leave game buttons
  document.getElementById('leave-game-lobby')?.addEventListener('click', handleLeaveGame);
  document.getElementById('leave-game-playing')?.addEventListener('click', handleLeaveGame);
  
  // Word search
  document.getElementById('word-search').addEventListener('input', handleWordSearch);
  
  // Submit answer
  document.getElementById('submit-answer-btn').addEventListener('click', handleSubmitAnswer);
}

function setupSocketListeners() {
  const socket = window.socketAdapter;
  
  // Connection events
  window.addEventListener('socket:connected', () => {
    updateConnectionStatus(true);
    startKeepAlive();
    hideRestoreBanner();
  });
  
  window.addEventListener('socket:disconnected', () => {
    updateConnectionStatus(false);
    stopKeepAlive();
    // Show restore banner if player was logged in
    if (playerId && playerName) {
      showRestoreBanner();
    }
  });
  
  // Game events
  socket.on('game:lobby_update', handleLobbyUpdate);
  socket.on('game:phase_change', handlePhaseChange);
  socket.on('game:leaderboard_update', handleLeaderboardUpdate);
  socket.on('game:image_revealed', handleImageRevealed);
}

function handleLogin(e) {
  e.preventDefault();
  
  const name = document.getElementById('player-name').value.trim();
  
  if (name.length < 2 || name.length > 20) {
    showError('Name muss 2-20 Zeichen lang sein');
    return;
  }
  
  // Join game
  window.socketAdapter.emit('player:join', { name }, (response) => {
    if (response.success) {
      playerId = response.data.playerId;
      playerName = name;
      currentScore = response.data.score;
      
      // Save to session
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('playerName', playerName);
      
      // Start keep-alive
      startKeepAlive();
      
      // Show lobby
      showScreen('lobby');
      document.getElementById('player-name-display').textContent = playerName;
      
      console.log('✅ Joined game:', response.data);
    } else {
      showError(response.message || 'Beitritt fehlgeschlagen');
    }
  });
}

function attemptReconnect(savedPlayerId, savedPlayerName) {
  window.socketAdapter.emit('player:reconnect', { playerId: savedPlayerId }, (response) => {
    if (response.success) {
      playerId = savedPlayerId;
      playerName = savedPlayerName;
      currentScore = response.data.score;
      
      // Start keep-alive
      startKeepAlive();
      
      // Show appropriate screen based on game phase
      const phase = response.data.phase || 'lobby';
      showScreen(phase === 'playing' ? 'game' : 'lobby');
      document.getElementById('player-name-display').textContent = playerName;
      document.getElementById('player-score').textContent = currentScore;
      
      // Load word list if in game
      if (phase === 'playing') {
        loadWordList();
      }
      
      console.log('✅ Reconnected:', response.data);
    } else {
      // Reconnect failed, clear session
      sessionStorage.clear();
    }
  });
}

function handleLobbyUpdate(data) {
  const count = data.totalPlayers || data.players?.length || 0;
  document.getElementById('lobby-player-count').textContent = count;
}

function handlePhaseChange(data) {
  if (data.phase === 'playing') {
    currentImageId = data.imageId;
    selectedWord = null;
    lockedWord = null;
    lockedAt = null;
    
    // Clear search field
    const searchInput = document.getElementById('word-search');
    if (searchInput) searchInput.value = '';
    
    // Zeige Wortliste, verstecke Reveal-Ansicht
    document.getElementById('word-list-container').style.display = 'block';
    document.getElementById('reveal-result').style.display = 'none';
    document.getElementById('submit-answer-btn').style.display = 'block';
    
    // Spielername oben links anzeigen
    const gamePlayerName = document.getElementById('game-player-name');
    if (gamePlayerName && playerName) {
      gamePlayerName.textContent = playerName;
    }
    
    showScreen('game');
    // Load word list from server (deduplicated for this image)
    loadWordList(data.imageId);
    updateSubmitButton();
  } else if (data.phase === 'ended') {
    showScreen('result');
    document.getElementById('final-score').textContent = currentScore;
  }
}

function handleLeaderboardUpdate(data) {
  // Update player rank and score if in top players
  if (data.topPlayers) {
    const myEntry = data.topPlayers.find(p => p.name === playerName);
    if (myEntry) {
      const myRank = data.topPlayers.indexOf(myEntry);
      const rankDisplay = document.getElementById('player-rank');
      rankDisplay.textContent = `Platz ${myRank + 1}`;
      rankDisplay.style.display = 'block';
      
      // Synchronize score from server
      if (myEntry.score !== undefined) {
        currentScore = myEntry.score;
        document.getElementById('player-score').textContent = currentScore;
      }
    }
  }
  
  // Update leaderboard overlay
  updateLeaderboardDisplay(data.topPlayers);
}

function handleImageRevealed(data) {
  // Bild wurde aufgedeckt - Wertung erfolgt jetzt
  const correctAnswer = data?.correctAnswer || '';
  const roundPoints = data?.roundPoints || 0; // Vom Server gesendet
  
  // Bestimme welches Wort gewertet wurde:
  // 1. Eingeloggtes Wort (lockedWord) hat Priorität
  // 2. Fallback: aktuell ausgewähltes Wort (selectedWord)
  const yourAnswer = lockedWord || selectedWord;
  
  // Wenn nur selectedWord (nicht eingeloggt), jetzt automatisch einloggen
  if (!lockedWord && selectedWord) {
    lockedWord = selectedWord;
    lockedAt = Date.now();
    // Sende ans Server (spätes Einloggen bei Reveal)
    sendLockToServer(selectedWord, lockedAt);
  }
  
  // Prüfe ob richtig
  const isCorrect = yourAnswer && yourAnswer.toLowerCase() === correctAnswer.toLowerCase();
  
  // === UI: Wechsel zur Reveal-Ansicht ===
  document.getElementById('word-list-container').style.display = 'none';
  document.getElementById('submit-answer-btn').style.display = 'none';
  document.getElementById('answer-feedback').style.display = 'none';
  
  const revealResult = document.getElementById('reveal-result');
  revealResult.style.display = 'flex';
  
  // Richtige Antwort
  document.getElementById('reveal-correct-answer').textContent = correctAnswer || '-';
  
  // Deine Antwort
  const yourAnswerCard = document.getElementById('your-answer-card');
  const yourAnswerEl = document.getElementById('reveal-your-answer');
  const statusEl = document.getElementById('reveal-status');
  
  yourAnswerCard.classList.remove('correct', 'wrong', 'no-answer');
  
  if (yourAnswer) {
    yourAnswerEl.textContent = yourAnswer;
    if (isCorrect) {
      yourAnswerCard.classList.add('correct');
      statusEl.textContent = '✅ Richtig!';
    } else {
      yourAnswerCard.classList.add('wrong');
      statusEl.textContent = '❌ Leider falsch';
    }
  } else {
    yourAnswerEl.textContent = 'Nicht beantwortet';
    yourAnswerCard.classList.add('no-answer');
    statusEl.textContent = '';
  }
  
  // Punkte diese Runde (vom Leaderboard-Update, wird separat aktualisiert)
  const pointsEl = document.getElementById('reveal-round-points');
  pointsEl.textContent = roundPoints > 0 ? `+${roundPoints}` : '0';
  pointsEl.classList.toggle('positive', roundPoints > 0);
  
  // Reset für nächstes Bild (State, nicht UI)
  selectedWord = null;
  lockedWord = null;
  lockedAt = null;
}

/**
 * Load word list from server for a specific image
 * The server deduplicates: if a solution word is in the decoy list,
 * it's only shown once (to avoid hints)
 */
async function loadWordList(imageId) {
  const container = document.getElementById('word-list');
  container.innerHTML = '<p class="loading">Lade Wörter...</p>';
  
  try {
    const url = imageId ? `/api/words/${imageId}` : '/api/words';
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      currentWordList = data.data;
      renderWordList();
    } else {
      container.innerHTML = '<p class="error">Fehler beim Laden der Wörter</p>';
    }
  } catch (error) {
    console.error('Failed to load word list:', error);
    container.innerHTML = '<p class="error">Verbindungsfehler</p>';
  }
}

function renderWordList() {
  const container = document.getElementById('word-list');
  container.innerHTML = '';
  
  if (currentWordList.length === 0) {
    container.innerHTML = '<p class="empty">Keine Wörter verfügbar</p>';
    return;
  }
  
  currentWordList.forEach(word => {
    const btn = document.createElement('button');
    btn.className = 'word-btn';
    btn.textContent = word;
    btn.dataset.word = word; // für robustere Vergleiche
    if (selectedWord === word) {
      btn.classList.add('selected');
    }
    if (lockedWord === word) {
      btn.classList.add('locked');
    }
    btn.onclick = () => selectWord(word, btn);
    container.appendChild(btn);
  });
}

/**
 * Handle word search with substring matching and highlighting
 * Searches for exact sequence of characters (e.g., "as" finds "Haus" and "Maus" but not "Satz")
 */
function handleWordSearch(e) {
  const query = e.target.value.toLowerCase();
  const container = document.getElementById('word-list');
  container.innerHTML = '';
  
  // If query is empty, show all words normally
  if (!query || query.length === 0) {
    renderWordList();
    return;
  }
  
  // Filter and render words that contain the search query as a substring
  const matchingWords = currentWordList.filter(word => 
    word.toLowerCase().includes(query)
  );
  
  if (matchingWords.length === 0) {
    container.innerHTML = '<p class="no-results">Keine Treffer für "' + escapeHtml(query) + '"</p>';
    return;
  }
  
  matchingWords.forEach(word => {
    const btn = document.createElement('button');
    btn.className = 'word-btn';
    btn.dataset.word = word; // für robustere Vergleiche
    if (selectedWord === word) {
      btn.classList.add('selected');
    }
    if (lockedWord === word) {
      btn.classList.add('locked');
    }
    
    // Highlight matching substring (case-insensitive)
    btn.innerHTML = highlightMatch(word, query);
    btn.onclick = () => selectWord(word, btn);
    container.appendChild(btn);
  });
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching substring in word
 * Preserves original case, highlights matched characters
 */
function highlightMatch(word, query) {
  const lowerWord = word.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerWord.indexOf(lowerQuery);
  
  if (startIndex === -1) {
    return escapeHtml(word);
  }
  
  const endIndex = startIndex + query.length;
  const before = escapeHtml(word.substring(0, startIndex));
  const match = escapeHtml(word.substring(startIndex, endIndex));
  const after = escapeHtml(word.substring(endIndex));
  
  return `${before}<strong class="highlight">${match}</strong>${after}`;
}

function selectWord(word, button) {
  // Deselect previous (nur 'selected', nicht 'locked')
  document.querySelectorAll('.word-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  // Select new
  selectedWord = word;
  button.classList.add('selected');
  updateSubmitButton();
}

function updateSubmitButton() {
  const btn = document.getElementById('submit-answer-btn');
  
  // Fall 1: Kein Wort ausgewählt
  if (!selectedWord) {
    btn.disabled = true;
    btn.textContent = 'Wort auswählen';
    btn.className = 'submit-btn';
    return;
  }
  
  // Fall 2: Wort ausgewählt, noch nicht eingeloggt
  if (!lockedWord) {
    btn.disabled = false;
    btn.textContent = 'Einloggen';
    btn.className = 'submit-btn ready';
    return;
  }
  
  // Fall 3: Gleiches Wort eingeloggt wie ausgewählt
  if (lockedWord === selectedWord) {
    btn.disabled = true;
    btn.textContent = 'Eingeloggt ✓';
    btn.className = 'submit-btn locked';
    return;
  }
  
  // Fall 4: Anderes Wort ausgewählt als eingeloggt
  btn.disabled = false;
  btn.textContent = 'Umentscheiden?';
  btn.className = 'submit-btn change';
}

function handleSubmitAnswer() {
  if (!selectedWord) return;
  
  // Fall A: Noch nicht eingeloggt -> Einloggen
  if (!lockedWord) {
    lockAnswer(selectedWord);
    return;
  }
  
  // Fall B: Bereits eingeloggt mit gleichem Wort -> nichts tun
  if (lockedWord === selectedWord) {
    return;
  }
  
  // Fall C: Anderes Wort -> Bestätigungsdialog
  showChangeConfirmDialog();
}

function lockAnswer(word) {
  lockedWord = word;
  lockedAt = Date.now();
  
  // UI aktualisieren: Zeige locked-Status auf dem Button
  document.querySelectorAll('.word-btn').forEach(btn => {
    btn.classList.remove('locked');
    // Verwende data-word Attribut für robuste Vergleiche (auch bei Highlighting)
    if (btn.dataset.word === word) {
      btn.classList.add('locked');
    }
  });
  
  updateSubmitButton();
  
  // An Server senden
  sendLockToServer(word, lockedAt);
  
  showFeedback(`"${word}" eingeloggt!`, 'info');
}

function sendLockToServer(word, timestamp) {
  window.socketAdapter.emit('player:lock_answer', {
    imageId: currentImageId,
    answer: word,
    lockedAt: timestamp
  }, (response) => {
    if (response && !response.success) {
      console.error('Lock failed:', response.message);
      // Bei Fehler trotzdem lokal gespeichert, wird bei Reveal gesendet
    }
  });
}

function showChangeConfirmDialog() {
  // Einfacher Bestätigungsdialog
  const confirmed = confirm(
    `Wirklich von "${lockedWord}" zu "${selectedWord}" wechseln?\n\n` +
    `⚠️ Geschwindigkeitsboni könnten verloren gehen!`
  );
  
  if (confirmed) {
    // Altes Wort entsperren
    document.querySelectorAll('.word-btn').forEach(btn => {
      btn.classList.remove('locked');
    });
    
    // Neues Wort einloggen (überschreibt das alte)
    lockAnswer(selectedWord);
    showFeedback(`Antwort geändert zu "${selectedWord}"`, 'info');
  }
}

function showFeedback(message, type) {
  const feedback = document.getElementById('answer-feedback');
  feedback.textContent = message;
  feedback.className = `feedback-message ${type}`;
  feedback.style.display = 'block';
  
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 3000);
}

function updateLeaderboardDisplay(topPlayers) {
  if (!topPlayers) return;
  
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '';
  
  topPlayers.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    if (player.name === playerName) {
      item.classList.add('highlight');
    }
    
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    
    item.innerHTML = `
      <span class="rank">${medal}</span>
      <span class="name">${player.name}</span>
      <span class="score">${player.score}</span>
    `;
    
    container.appendChild(item);
  });
}

function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[screenName]?.classList.add('active');
}

function showError(message) {
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 3000);
}

function updateConnectionStatus(connected = window.socketAdapter?.isConnected()) {
  const status = document.getElementById('connection-status');
  if (connected) {
    status.textContent = '● Verbunden';
    status.className = 'status-indicator connected';
  } else {
    status.textContent = '● Verbindung unterbrochen';
    status.className = 'status-indicator disconnected';
  }
}

// Keep-alive functions
function startKeepAlive() {
  stopKeepAlive(); // Clear any existing interval
  keepAliveInterval = setInterval(() => {
    if (playerId && window.socketAdapter?.isConnected()) {
      window.socketAdapter.emit('player:keep_alive');
    }
  }, 30000); // Send every 30 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Session restore banner
function showRestoreBanner() {
  const banner = document.getElementById('restore-banner');
  banner.style.display = 'block';
  
  // Setup restore button once
  const restoreBtn = document.getElementById('restore-btn');
  if (!restoreBtn.onclick) {
    restoreBtn.onclick = () => {
      const savedPlayerId = sessionStorage.getItem('playerId');
      const savedPlayerName = sessionStorage.getItem('playerName');
      if (savedPlayerId && savedPlayerName) {
        attemptReconnect(savedPlayerId, savedPlayerName);
      }
    };
  }
}

function hideRestoreBanner() {
  const banner = document.getElementById('restore-banner');
  banner.style.display = 'none';
}

// Leave game
function handleLeaveGame() {
  if (!confirm('Möchtest du das Spiel wirklich verlassen? Dein Fortschritt geht verloren.')) {
    return;
  }
  
  if (playerId) {
    // Notify server
    window.socketAdapter.emit('player:leave', { playerId }, (response) => {
      if (response?.success) {
        console.log('✅ Left game successfully');
      }
    });
  }
  
  // Clear session and state
  sessionStorage.clear();
  playerId = null;
  playerName = null;
  currentScore = 0;
  stopKeepAlive();
  
  // Return to login
  showScreen('login');
  document.getElementById('player-name').value = '';
}

// ==========================================
// RESET Handlers
// ==========================================

function handleGameReset(data) {
  console.log('Player: Game reset received', data);
  
  // Soft reset: Keep player logged in, reset game state
  selectedWord = null;
  lockedWord = null;
  lockedAt = null;
  currentImageId = null;
  currentScore = 0;
  
  // Update UI
  updateScoreDisplay();
  clearWordSelection();
  
  // Show message
  if (data?.message) {
    showMessage(data.message, 'info');
  }
  
  // Return to lobby
  showScreen('lobby');
}

function handleForceDisconnect(data) {
  console.log('Player: Force disconnect received', data);
  
  // Clear everything
  sessionStorage.clear();
  playerId = null;
  playerName = null;
  currentScore = 0;
  selectedWord = null;
  lockedWord = null;
  currentImageId = null;
  stopKeepAlive();
  
  // Show message and return to login
  alert(data?.message || 'Das Spiel wurde zurückgesetzt. Bitte neu einloggen.');
  showScreen('login');
  document.getElementById('player-name').value = '';
}

function clearWordSelection() {
  const wordGrid = document.getElementById('word-grid');
  if (wordGrid) {
    wordGrid.querySelectorAll('.word-item').forEach(item => {
      item.classList.remove('selected', 'locked');
    });
  }
  document.getElementById('submit-answer-btn').disabled = true;
}

function showMessage(text, type = 'info') {
  // Try to show in existing notification area or create alert
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = text;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  } else {
    console.log(`[${type}] ${text}`);
  }
}

// Register reset handlers in socket setup
(function registerResetHandlers() {
  if (window.socketAdapter) {
    window.socketAdapter.on('player:game_reset', handleGameReset);
    window.socketAdapter.on('player:force_disconnect', handleForceDisconnect);
  }
})();

