/**
 * Player Client
 * 
 * Mobile player interface for LichtBlick
 */

// State
let currentPhase = 'login';   // Phase: login | lobby | playing | ended
let playerId = null;
let playerName = null;
let currentScore = 0;
let previousScore = 0;        // Score before this round (to calculate round points)
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
  // Setup event listeners first
  setupEventListeners();
  setupSocketListeners();
  
  // Check for existing session - but wait for socket connection
  const savedPlayerId = sessionStorage.getItem('playerId');
  const savedPlayerName = sessionStorage.getItem('playerName');
  
  if (savedPlayerId && savedPlayerName) {
    // Wait for socket to connect before attempting reconnect
    if (window.socketAdapter?.isConnected()) {
      attemptReconnect(savedPlayerId, savedPlayerName);
    } else {
      // Wait for connection event
      window.addEventListener('socket:connected', () => {
        attemptReconnect(savedPlayerId, savedPlayerName);
      }, { once: true });
    }
  } else {
    // Check game status on initial load
    checkGameStatus();
  }
  
  // Connection status
  updateConnectionStatus();
});

// ============================================
// STATE VALIDATION
// ============================================
// Validates if an event is allowed in the current phase
// Prevents processing events in wrong game states

function isEventAllowedInPhase(eventName) {
  const rules = {
    // LOGIN: Allow lobby_update (needed during join process)
    'login': {
      allowed: ['game:lobby_update'],
      denied: ['game:phase_change', 'game:image_revealed', 'game:leaderboard_update', 'player:lock_answer']
    },
    // LOBBY: Only lobby updates and phase changes
    'lobby': {
      allowed: ['game:lobby_update', 'game:phase_change', 'player:game_reset', 'player:force_disconnect'],
      denied: ['game:image_revealed', 'game:leaderboard_update', 'player:lock_answer']
    },
    // PLAYING: Active gameplay - can lock answers
    'playing': {
      allowed: ['game:phase_change', 'game:image_revealed', 'game:leaderboard_update', 'player:lock_answer', 'player:game_reset', 'player:force_disconnect'],
      denied: []
    },
    // REVEALED: Answer revealed, waiting for next image - cannot lock new answers
    'revealed': {
      allowed: ['game:phase_change', 'game:image_revealed', 'game:leaderboard_update', 'player:game_reset', 'player:force_disconnect'],
      denied: ['player:lock_answer']
    },
    // ENDED: Only leaderboard and phase changes
    'ended': {
      allowed: ['game:leaderboard_update', 'game:phase_change', 'player:game_reset', 'player:force_disconnect'],
      denied: ['game:image_revealed', 'player:lock_answer']
    }
  };
  
  const phaseRules = rules[currentPhase];
  if (!phaseRules) return true; // Failsafe for unknown phases
  
  // Check denied first (explicit blocks)
  if (phaseRules.denied.includes(eventName)) {
    console.warn(`🚫 Player: Event "${eventName}" blocked in phase "${currentPhase}"`);
    return false;
  }
  
  // If allowed list exists and event is not in it, block
  if (phaseRules.allowed.length > 0 && !phaseRules.allowed.includes(eventName)) {
    console.warn(`🚫 Player: Event "${eventName}" not allowed in phase "${currentPhase}"`);
    return false;
  }
  
  return true;
}

function setupEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Leave game buttons
  document.getElementById('leave-game-lobby')?.addEventListener('click', handleLeaveGame);
  document.getElementById('leave-game-playing')?.addEventListener('click', handleLeaveGame);
  
  // Late join button
  document.getElementById('late-join-btn')?.addEventListener('click', () => {
    // Refresh page to trigger reconnect and force join playing game
    window.location.reload();
  });
  
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
      const gameStatus = response.data.gameStatus;
      
      // Save to session
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('playerName', playerName);
      
      // Start keep-alive
      startKeepAlive();
      
      // Handle different game states
      if (gameStatus === 'playing') {
        // Late Join: Direkt zum Game-Screen
        currentPhase = 'playing';
        showScreen('game');
        document.getElementById('game-player-name').textContent = playerName;
        document.getElementById('player-score').textContent = currentScore;
        
        // Zeige Late-Join-Toast
        showFeedback('⚠️ Spiel läuft bereits - du bist spät dran!', 'info');
        
        // Warte auf phase_change Event mit imageId, um Wortliste zu laden
        console.log('✅ Late joined game (playing):', response.data);
      } else if (gameStatus === 'ended') {
        // Sollte nicht passieren (Server lehnt ab), aber Failsafe
        currentPhase = 'ended';
        showScreen('result');
        console.log('⚠️ Joined ended game:', response.data);
      } else {
        // Normal: Lobby
        currentPhase = 'lobby';
        showScreen('lobby');
        document.getElementById('player-name-display').textContent = playerName;
        console.log('✅ Joined game (lobby):', response.data);
      }
    } else {
      // Join failed - check if game is ended
      const errorMessage = response.message || 'Beitritt fehlgeschlagen';
      
      if (errorMessage.includes('ended') || errorMessage.includes('beendet')) {
        // Game is ended - disable login
        setLoginEnded();
      } else {
        showError(errorMessage);
      }
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
      const imageRevealed = response.data.imageRevealed || false;
      
      // Set player-specific phase: 'revealed' when answer is shown, 'playing' when active
      if (phase === 'playing' && imageRevealed) {
        currentPhase = 'revealed';
      } else if (phase === 'playing') {
        currentPhase = 'playing';
      } else {
        currentPhase = phase === 'ended' ? 'ended' : 'lobby';
      }
      
      showScreen(phase === 'playing' ? 'game' : (phase === 'ended' ? 'result' : 'lobby'));
      
      // Update player name displays
      document.getElementById('player-name-display').textContent = playerName;
      if (phase === 'playing') {
        document.getElementById('game-player-name').textContent = playerName;
      }
      document.getElementById('player-score').textContent = currentScore;
      
      // Handle revealed state immediately (don't wait for game:image_revealed event)
      if (phase === 'playing' && imageRevealed) {
        // Hide word list, show reveal container (waiting for game:image_revealed with answer)
        document.getElementById('word-list-container').style.display = 'none';
        document.getElementById('submit-answer-btn').style.display = 'none';
        const revealResult = document.getElementById('reveal-result');
        revealResult.classList.remove('hidden');
        revealResult.style.display = 'flex';
        
        console.log('✅ Reconnected to revealed phase:', response.data);
      } else if (phase === 'playing' && !imageRevealed && response.data.currentImageId) {
        // Active game - Load word list directly with imageId from reconnect response
        currentImageId = response.data.currentImageId;
        
        // Ensure game UI is visible
        document.getElementById('word-list-container').style.display = 'block';
        document.getElementById('reveal-result').style.display = 'none';
        document.getElementById('submit-answer-btn').style.display = 'block';
        
        // Load word list for current image
        loadWordList(currentImageId);
        updateSubmitButton();
        
        console.log('✅ Reconnected to active game, loaded imageId:', currentImageId);
      } else {
        console.log('✅ Reconnected:', response.data);
      }
    } else {
      // Reconnect failed, clear session
      sessionStorage.clear();
    }
  });
}

function handleLobbyUpdate(data) {
  if (!isEventAllowedInPhase('game:lobby_update')) return;
  
  const count = data.totalPlayers || data.players?.length || 0;
  document.getElementById('lobby-player-count').textContent = count;
  
  // Note: Late Join Warning entfernt - Late Joiner gehen direkt zum Game-Screen
}

function handlePhaseChange(data) {
  if (!isEventAllowedInPhase('game:phase_change')) return;
  
  const oldPhase = currentPhase;
  // Map server phase to player-specific phase (revealed -> playing on new image)
  currentPhase = data.phase === 'playing' ? 'playing' : (data.phase === 'ended' ? 'ended' : 'lobby');
  
  console.log(`Player: Phase changed from "${oldPhase}" to "${currentPhase}" (server: ${data.phase})`);
  
  if (data.phase === 'playing') {
    currentImageId = data.imageId;
    selectedWord = null;
    lockedWord = null;
    lockedAt = null;
    
    // Save current score as previous (for next round points calculation)
    previousScore = currentScore;
    
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
    
    // Update final leaderboard and rank
    // Wait for final leaderboard update, or use last known leaderboard
    // The rank will be set by handleLeaderboardUpdate when final leaderboard arrives
  }
}

function handleLeaderboardUpdate(data) {
  if (!isEventAllowedInPhase('game:leaderboard_update')) return;
  
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
        
        // Update round points in reveal screen if visible
        if (currentPhase === 'revealed') {
          const roundPoints = currentScore - previousScore;
          const pointsEl = document.getElementById('reveal-round-points');
          pointsEl.textContent = roundPoints > 0 ? `+${roundPoints}` : '0';
          pointsEl.classList.toggle('positive', roundPoints > 0);
          
          // Update total score in reveal screen
          document.getElementById('reveal-total-score').textContent = currentScore;
        }
      }
      
      // Update final rank if on result screen
      if (currentPhase === 'ended') {
        document.getElementById('final-rank').textContent = `#${myRank + 1}`;
        document.getElementById('final-score').textContent = currentScore;
      }
    }
  }
  
  // Update leaderboard overlay
  updateLeaderboardDisplay(data.topPlayers);
  
  // Update final leaderboard if on result screen
  if (currentPhase === 'ended' && data.topPlayers) {
    updateFinalLeaderboard(data.topPlayers);
  }
}

function handleImageRevealed(data) {
  if (!isEventAllowedInPhase('game:image_revealed')) return;
  
  // Transition to 'revealed' phase (player-specific sub-phase of 'playing')
  currentPhase = 'revealed';
  
  // Bild wurde aufgedeckt - Wertung erfolgt jetzt
  const correctAnswer = data?.correctAnswer || '';
  
  // Auto-Lock: Wenn Wort ausgewählt aber nicht eingeloggt, jetzt einloggen (mit Malus)
  if (selectedWord && !lockedWord) {
    lockedWord = selectedWord;
    lockedAt = new Date(); // Timestamp jetzt (beim Reveal)
    
    // Sende Late-Lock Answer zum Server (wird mit aktuellem revealCount gewertet)
    window.socketAdapter.emit('player:lock_answer', {
      imageId: currentImageId,
      answer: lockedWord
    }, (response) => {
      if (response?.success) {
        console.log('⚠️ Auto-locked answer at reveal (late lock, with penalties):', lockedWord);
      }
    });
  }
  
  // Die gewertete Antwort ist das eingeloggte Wort (kann gerade erst auto-locked worden sein)
  const yourAnswer = lockedWord;
  
  // Prüfe ob richtig
  const isCorrect = yourAnswer && yourAnswer.toLowerCase() === correctAnswer.toLowerCase();
  
  // === UI: Wechsel zur Reveal-Ansicht ===
  document.getElementById('word-list-container').style.display = 'none';
  document.getElementById('submit-answer-btn').style.display = 'none';
  document.getElementById('answer-feedback').textContent = ''; // Clear feedback
  
  const revealResult = document.getElementById('reveal-result');
  revealResult.classList.remove('hidden');
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
      statusEl.textContent = '✓ Richtig!';
    } else {
      yourAnswerCard.classList.add('wrong');
      statusEl.textContent = '✗ Falsch';
    }
  } else {
    yourAnswerEl.textContent = '-';
    yourAnswerCard.classList.add('no-answer');
    statusEl.textContent = '';
  }
  
  // Punkte diese Runde (werden durch leaderboard_update aktualisiert)
  const roundPoints = currentScore - previousScore;
  const pointsEl = document.getElementById('reveal-round-points');
  pointsEl.textContent = roundPoints > 0 ? `+${roundPoints}` : '0';
  pointsEl.classList.toggle('positive', roundPoints > 0);
  
  // Gesamtpunktzahl aktualisieren
  document.getElementById('reveal-total-score').textContent = currentScore;
  
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
  // Client-side validation
  if (currentPhase !== 'playing') {
    showFeedback('Aktion nur während Spielphase möglich', 'error');
    console.warn('Cannot lock answer: not in playing phase');
    return;
  }
  
  if (!currentImageId) {
    showFeedback('Kein aktives Bild', 'error');
    console.warn('Cannot lock answer: no active image');
    return;
  }
  
  if (!currentWordList.includes(word)) {
    showFeedback('Ungültiges Wort', 'error');
    console.warn('Cannot lock answer: word not in list', word);
    return;
  }
  
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
  
  setTimeout(() => {
    feedback.textContent = ''; // Clear text to trigger :empty CSS
    feedback.className = 'feedback-message';
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

function updateFinalLeaderboard(topPlayers) {
  if (!topPlayers) return;
  
  const container = document.getElementById('final-leaderboard');
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
  
  // Reset game screen state when showing it (to default: word list visible, reveal hidden)
  if (screenName === 'game') {
    document.getElementById('word-list-container').style.display = 'block';
    document.getElementById('reveal-result').style.display = 'none';
    document.getElementById('submit-answer-btn').style.display = 'block';
  }
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
  
  // Return to login and check game status
  showScreen('login');
  document.getElementById('player-name').value = '';
  
  // Re-enable login in case it was disabled
  enableLogin();
  checkGameStatus();
}

// ==========================================
// GAME STATUS CHECK
// ==========================================

/**
 * Check current game status and update login UI accordingly
 * Called on page load and after leaving game
 */
async function checkGameStatus() {
  try {
    const response = await fetch('/api/game/status');
    const data = await response.json();
    
    if (data.success && data.data) {
      const gameStatus = data.data.status;
      
      if (gameStatus === 'ended') {
        setLoginEnded();
      } else {
        enableLogin();
      }
    }
  } catch (error) {
    console.warn('Failed to check game status:', error);
    // Fail-safe: Enable login on error
    enableLogin();
  }
}

/**
 * Disable login when game has ended
 */
function setLoginEnded() {
  const submitBtn = document.getElementById('login-submit-btn');
  const nameInput = document.getElementById('player-name');
  const description = document.getElementById('login-description');
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Spiel beendet';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-secondary');
  
  nameInput.disabled = true;
  
  description.textContent = 'Das Spiel ist beendet. Bitte warte auf ein neues Spiel.';
  
  console.log('🔒 Login disabled: Game has ended');
}

/**
 * Enable login (normal state)
 */
function enableLogin() {
  const submitBtn = document.getElementById('login-submit-btn');
  const nameInput = document.getElementById('player-name');
  const description = document.getElementById('login-description');
  
  submitBtn.disabled = false;
  submitBtn.textContent = 'Beitreten';
  submitBtn.classList.remove('btn-secondary');
  submitBtn.classList.add('btn-primary');
  
  nameInput.disabled = false;
  
  description.textContent = 'Gib deinen Namen ein um mitzuspielen:';
}

// ==========================================
// RESET Handlers
// ==========================================

function handleGameReset(data) {
  if (!isEventAllowedInPhase('player:game_reset')) return;
  
  console.log('Player: Game reset received', data);
  
  // Soft reset: Keep player logged in, reset game state
  currentPhase = 'lobby';
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
  if (!isEventAllowedInPhase('player:force_disconnect')) return;
  
  console.log('Player: Force disconnect received', data);
  
  // Clear everything
  sessionStorage.clear();
  currentPhase = 'login';
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

