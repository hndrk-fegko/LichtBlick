/**
 * Beamer Client
 * 
 * Fullscreen display for LichtBlick game
 */

// State
let currentPhase = 'lobby';
let canvas = null;
let ctx = null;
let currentImage = null;
let spotlightClicks = []; // Fixierte Klick-Spotlights
let currentMouseSpot = null; // Temporärer Maus-Spotlight
let isRevealed = false; // Bild komplett aufgedeckt
let currentCorrectAnswer = ''; // Richtige Antwort für Anzeige
let endImageUrl = null; // End image URL for result screen background

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupCanvas();
  setupSocketListeners();
  setupFullscreen();
  loadStartImage();
  
  // Connect as beamer
  window.socketAdapter.emit('beamer:connect');
});

function loadStartImage() {
  fetch('/api/images')
    .then(r => r.json())
    .then(data => {
      const startImage = data.data.find(img => img.is_start_image);
      if (startImage) {
        showStartImage(startImage.url);
      }
      
      // Cache end image for later use
      const endImage = data.data.find(img => img.is_end_image);
      if (endImage) {
        endImageUrl = endImage.url;
      }
    })
    .catch(err => console.error('Failed to load start image:', err));
}

function showStartImage(url) {
  const bgDiv = document.getElementById('start-image-bg');
  const defaultContent = document.getElementById('lobby-content-default');
  const infoBox = document.getElementById('waiting-info-box');
  
  bgDiv.style.backgroundImage = `url(${url})`;
  bgDiv.classList.add('has-image');
  defaultContent.style.display = 'none';
  infoBox.classList.remove('hidden'); // CSS-Klasse entfernen
  infoBox.style.display = 'flex';
}

function hideStartImage() {
  const bgDiv = document.getElementById('start-image-bg');
  const defaultContent = document.getElementById('lobby-content-default');
  const infoBox = document.getElementById('waiting-info-box');
  
  bgDiv.style.backgroundImage = '';
  bgDiv.classList.remove('has-image');
  defaultContent.style.display = 'flex';
  infoBox.classList.add('hidden'); // CSS-Klasse hinzufügen
  infoBox.style.display = 'none';
}

function showEndImage(url) {
  const resultScreen = document.getElementById('result-screen');
  if (!resultScreen) return;
  
  if (url && typeof url === 'string') {
    // Validate URL format
    const isValidUrl = url.startsWith('data:image/') || 
                       url.startsWith('/') ||
                       /^https?:\/\//.test(url);
    
    if (isValidUrl) {
      resultScreen.style.backgroundImage = `url(${CSS.escape(url)})`;
      resultScreen.style.backgroundSize = 'cover';
      resultScreen.style.backgroundPosition = 'center';
      resultScreen.style.backgroundRepeat = 'no-repeat';
      resultScreen.classList.add('has-image');
    }
  }
}

function hideEndImage() {
  const resultScreen = document.getElementById('result-screen');
  if (!resultScreen) return;
  
  resultScreen.style.backgroundImage = '';
  resultScreen.classList.remove('has-image');
}

function handleImageRolesChanged(data) {
  // Update start image if we're in lobby phase
  if (currentPhase === 'lobby') {
    if (data.startImage && data.startImage.url) {
      showStartImage(data.startImage.url);
    } else {
      hideStartImage();
    }
  }
  
  // Update end image if we're in ended phase (or cache for later)
  if (data.endImage && data.endImage.url) {
    endImageUrl = data.endImage.url; // Cache for phase transition
    
    if (currentPhase === 'ended') {
      showEndImage(data.endImage.url);
    }
  } else if (currentPhase === 'ended') {
    hideEndImage();
  }
}

// ============================================
// STATE VALIDATION
// ============================================
// Validates if an event is allowed in the current phase
// Logs violations for debugging admin-side issues

function isEventAllowedInPhase(eventName) {
  const rules = {
    // LOBBY: Only QR, Start-Image, Phase-Changes
    'lobby': {
      allowed: ['beamer:qr_state', 'beamer:image_roles_changed', 'game:phase_change', 'game:lobby_update'],
      denied: ['beamer:spotlight', 'beamer:spotlight_click', 'beamer:reveal_image', 'beamer:image_changed', 'beamer:clear_spotlight']
    },
    // PLAYING: Spotlights, Image-Changes, Reveals - NO QR
    'playing': {
      allowed: ['beamer:spotlight', 'beamer:spotlight_click', 'beamer:reveal_image', 'beamer:image_changed', 'beamer:clear_spotlight', 'game:phase_change'],
      denied: ['beamer:qr_state']
    },
    // ENDED: Leaderboard, Reset - NO QR
    'ended': {
      allowed: ['game:leaderboard_update', 'beamer:game_reset', 'game:phase_change'],
      denied: ['beamer:spotlight', 'beamer:spotlight_click', 'beamer:reveal_image', 'beamer:image_changed', 'beamer:qr_state']
    }
  };
  
  const phaseRules = rules[currentPhase];
  if (!phaseRules) return true; // Unknown phase, allow (safety)
  
  // Check if explicitly allowed
  if (phaseRules.allowed.includes(eventName)) return true;
  
  // Check if explicitly denied
  if (phaseRules.denied.includes(eventName)) {
    console.warn(`🚫 Beamer: Event "${eventName}" blocked in phase "${currentPhase}"`);
    console.warn('   → Admin may be in wrong state or sending invalid events');
    return false;
  }
  
  // Not in lists, allow by default
  return true;
}

function setupCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redrawCanvas();
}

function setupFullscreen() {
  // F11 handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
  });
  
  // Auto fullscreen on load
  setTimeout(() => {
    if (!document.fullscreenElement) {
      toggleFullscreen();
    }
  }, 1000);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen().catch(err => {
      console.warn('Exit fullscreen failed:', err);
    });
  }
}

function setupSocketListeners() {
  const socket = window.socketAdapter;
  
  // Connection
  window.addEventListener('socket:connected', () => {
    socket.emit('beamer:connect');
  });
  
  // Game events
  socket.on('beamer:initial_state', handleInitialState);
  socket.on('game:lobby_update', handleLobbyUpdate);
  socket.on('game:phase_change', handlePhaseChange);
  socket.on('beamer:image_changed', handleImageChanged);
  socket.on('beamer:spotlight', handleSpotlight);
  socket.on('beamer:spotlight_click', handleSpotlightClick);
  socket.on('beamer:reveal_image', handleRevealImage);
  socket.on('beamer:image_roles_changed', handleImageRolesChanged);
  socket.on('beamer:clear_spotlight', clearSpotlight);
  socket.on('beamer:qr_state', handleQRState);
  socket.on('game:leaderboard_update', handleLeaderboardUpdate);
}

function handleInitialState(data) {
  // Extract phase from nested data structure
  const phase = data.data?.game?.status || data.phase || 'lobby';
  currentPhase = phase;
  
  console.log('Beamer: Initial state received', { phase, data });
  
  // Load image if in playing phase
  if (phase === 'playing') {
    const imageId = data.data?.imageId || data.imageId;
    if (imageId) {
      loadImage(imageId);
    }
  }
  
  // Show appropriate screen
  const screenName = phase === 'lobby' ? 'lobby' : 
                     phase === 'playing' ? 'game' : 
                     phase === 'ended' ? 'result' : 'lobby';
  
  showScreen(screenName);
}

function handleLobbyUpdate(data) {
  // Lobby update received but no display needed on beamer
  // Leaderboard loads in background for quick transition to game
}

function handlePhaseChange(data) {
  const oldPhase = currentPhase;
  currentPhase = data.phase;
  
  console.log(`Beamer: Phase changed from "${oldPhase}" to "${data.phase}"`);
  
  // QR-Code Panel automatisch ausblenden wenn Lobby verlassen wird
  if (oldPhase === 'lobby' && data.phase !== 'lobby') {
    const qrPanel = document.getElementById('qr-side-panel');
    qrPanel.classList.add('hidden');
    console.log('   → QR-Code Panel ausgeblendet (Phase-Wechsel)');
  }
  
  if (data.phase === 'playing') {
    showScreen('game');
    if (data.imageId) {
      loadImage(data.imageId);
    }
  } else if (data.phase === 'ended') {
    showScreen('result');
    // Apply end image if cached
    if (endImageUrl) {
      showEndImage(endImageUrl);
    }
  } else {
    showScreen('lobby');
  }
}

function handleImageChanged(data) {
  // Validate: Only allowed in PLAYING phase
  if (!isEventAllowedInPhase('beamer:image_changed')) {
    console.warn('   → Ignoring image change, not in playing phase');
    return;
  }
  
  spotlightClicks = [];
  currentMouseSpot = null;
  isRevealed = false;
  currentCorrectAnswer = '';
  hideAnswerOverlay();
  loadImage(data.imageId);
  showScreen('game');
}

function loadImage(imageId) {
  fetch('/api/images')
    .then(r => r.json())
    .then(data => {
      const image = data.data.find(img => img.id == imageId);
      if (!image) return;
      
      const img = new Image();
      img.onload = () => {
        currentImage = img;
        redrawCanvas();
      };
      img.src = image.url;
    })
    .catch(err => {
      console.error('Failed to load image:', err);
    });
}

// Temporärer Maus-Spotlight (Bewegung)
function handleSpotlight(data) {
  // Validate: Only allowed in PLAYING phase
  if (!isEventAllowedInPhase('beamer:spotlight')) {
    return; // Silent ignore (too many events for logging)
  }
  
  currentMouseSpot = {
    x: data.x,
    y: data.y,
    size: data.size || 0.1,
    strength: data.strength ?? 1,
    focus: data.focus ?? 0.7
  };
  redrawCanvas();
}

// Fixierter Klick-Spotlight
function handleSpotlightClick(data) {
  // Validate: Only allowed in PLAYING phase
  if (!isEventAllowedInPhase('beamer:spotlight_click')) {
    console.warn('   → Ignoring spotlight click, not in playing phase');
    return;
  }
  
  spotlightClicks.push({
    x: data.x,
    y: data.y,
    size: data.size || 0.1,
    strength: data.strength ?? 1,
    focus: data.focus ?? 0.7
  });
  redrawCanvas();
}

function clearSpotlight() {
  // Validate: Only allowed in PLAYING phase
  if (!isEventAllowedInPhase('beamer:clear_spotlight')) {
    console.warn('   → Ignoring clear spotlight, not in playing phase');
    return;
  }
  
  spotlightClicks = [];
  currentMouseSpot = null;
  redrawCanvas();
}

// Bild komplett aufdecken
function handleRevealImage(data) {
  // Validate: Only allowed in PLAYING phase
  if (!isEventAllowedInPhase('beamer:reveal_image')) {
    console.warn('   → Ignoring reveal, not in playing phase');
    return;
  }
  
  // Clear spotlights before reveal (cleaner look)
  spotlightClicks = [];
  currentMouseSpot = null;
  
  isRevealed = true;
  currentCorrectAnswer = data.correctAnswer || '';
  redrawCanvas();
  showAnswerOverlay(currentCorrectAnswer);
}

// Antwort-Overlay anzeigen
function showAnswerOverlay(answer) {
  let overlay = document.getElementById('answer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'answer-overlay';
    overlay.className = 'answer-overlay';
    document.getElementById('game-screen').appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="answer-box">
      <span class="answer-label">Richtig:</span>
      <span class="answer-text">${answer}</span>
    </div>
  `;
  overlay.style.display = 'flex';
}

function hideAnswerOverlay() {
  const overlay = document.getElementById('answer-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function handleQRState(data) {
  console.log('🔲 Beamer: QR state received', data);
  
  // QR nur in LOBBY Phase erlaubt (Spieler joinen nicht mid-game)
  if (!isEventAllowedInPhase('beamer:qr_state')) {
    console.warn('   → Ignoring QR state change, only allowed in lobby phase');
    return;
  }
  
  const qrPanel = document.getElementById('qr-side-panel');
  
  if (data.enabled && data.url) {
    document.getElementById('qr-url').textContent = data.url;
    generateQRCode(data.url);
    qrPanel.classList.remove('hidden');
    console.log('   → QR-Code Panel angezeigt:', data.url);
  } else {
    qrPanel.classList.add('hidden');
    console.log('   → QR-Code Panel ausgeblendet');
  }
}

function generateQRCode(url) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width = 300;
    canvas.height = 300;
    ctx.drawImage(img, 0, 0, 300, 300);
  };
  img.onerror = () => {
    canvas.width = 300;
    canvas.height = 300;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,300,300);
    ctx.fillStyle = '#000';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Fehler', 150, 140);
  };
  img.src = apiUrl;
}

function handleLeaderboardUpdate(data) {
  // Validate: Only allowed in ENDED phase
  if (!isEventAllowedInPhase('game:leaderboard_update')) {
    console.warn('   → Ignoring leaderboard update, not in ended phase');
    return;
  }
  
  if (!data.topPlayers) return;
  
  updateLeaderboard(data.topPlayers);
}

function updateLeaderboard(players) {
  const container = document.getElementById('leaderboard');
  container.innerHTML = '';
  
  players.slice(0, 10).forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    
    item.innerHTML = `
      <span class="rank">${medal}</span>
      <span class="name">${player.name}</span>
      <span class="score">${player.score}</span>
    `;
    
    if (index < 3) {
      item.classList.add('top-three');
    }
    
    container.appendChild(item);
  });
}

function redrawCanvas() {
  if (!ctx) return;
  
  // Only render in PLAYING phase
  if (currentPhase !== 'playing') {
    // Clear canvas in other phases to prevent black overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  
  // Nutze gemeinsame Render-Logik mit Beamer-Einstellungen (preview=false)
  SpotlightRenderer.render({
    ctx: ctx,
    image: currentImage,
    spotlights: spotlightClicks,
    mouseSpot: currentMouseSpot,
    isRevealed: isRevealed,
    preview: false,  // Beamer: 100% Effekt
    highlight: false // Kein grünes Overlay
  });
}

function showScreen(screenName) {
  const screens = {
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
  };
  
  console.log(`Beamer: Switching to screen "${screenName}"`);
  
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  const targetScreen = screens[screenName];
  if (targetScreen) {
    targetScreen.classList.add('active');
    console.log(`Beamer: Screen "${screenName}" is now active`);
  } else {
    console.error(`Beamer: Screen "${screenName}" not found!`);
  }
  
  // Clear canvas when leaving game screen
  if (screenName !== 'game' && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ==========================================
// RESET Handler
// ==========================================

function handleGameReset(data) {
  console.log('Beamer: Game reset received', data);
  
  // Reset state
  currentImage = null;
  currentMouseSpot = null;
  spotlightClicks = [];
  isRevealed = false;
  currentCorrectAnswer = '';
  currentPhase = 'lobby';
  
  // Clear canvas
  if (ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  
  // Hide overlays
  hideAnswerOverlay();
  const qrPanel = document.getElementById('qr-side-panel');
  if (qrPanel) qrPanel.classList.add('hidden');
  
  // Show lobby screen
  showScreen('lobby');
  
  // Show reset message based on type
  const type = data?.type || 'unknown';
  const messages = {
    soft: 'Spiel wurde zurückgesetzt',
    hard: 'Kompletter Reset durchgeführt',
    factory: 'Werksreset durchgeführt'
  };
  
  console.log('Beamer: ' + (messages[type] || 'Reset durchgeführt'));
}

// Register reset handler
if (window.socketAdapter) {
  window.socketAdapter.on('beamer:game_reset', handleGameReset);
}

