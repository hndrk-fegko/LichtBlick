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
  infoBox.style.display = 'flex';
}

function hideStartImage() {
  const bgDiv = document.getElementById('start-image-bg');
  const defaultContent = document.getElementById('lobby-content-default');
  const infoBox = document.getElementById('waiting-info-box');
  
  bgDiv.style.backgroundImage = '';
  bgDiv.classList.remove('has-image');
  defaultContent.style.display = 'flex';
  infoBox.style.display = 'none';
}

function handleImageRolesChanged(data) {
  // Only update if we're in lobby phase
  if (currentPhase !== 'lobby') return;
  
  if (data.startImage && data.startImage.url) {
    showStartImage(data.startImage.url);
  } else {
    hideStartImage();
  }
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
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
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
  currentPhase = data.phase;
  
  if (data.phase === 'playing' && data.imageId) {
    loadImage(data.imageId);
  }
  
  showScreen(data.phase === 'lobby' ? 'lobby' : 
             data.phase === 'playing' ? 'game' : 
             data.phase === 'ended' ? 'result' : 'lobby');
}

function handleLobbyUpdate(data) {
  // Lobby update received but no display needed on beamer
  // Leaderboard loads in background for quick transition to game
}

function handlePhaseChange(data) {
  currentPhase = data.phase;
  
  if (data.phase === 'playing') {
    showScreen('game');
    if (data.imageId) {
      loadImage(data.imageId);
    }
  } else if (data.phase === 'ended') {
    showScreen('result');
  } else {
    showScreen('lobby');
  }
}

function handleImageChanged(data) {
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
  spotlightClicks = [];
  currentMouseSpot = null;
  redrawCanvas();
}

// Bild komplett aufdecken
function handleRevealImage(data) {
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
  const overlay = document.getElementById('qr-overlay');
  
  if (data.enabled && data.url) {
    document.getElementById('qr-url').textContent = data.url;
    generateQRCode(data.url);
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
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
  if (!data.topPlayers || currentPhase !== 'ended') return;
  
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
  
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  screens[screenName]?.classList.add('active');
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
  const qrOverlay = document.getElementById('qr-overlay');
  if (qrOverlay) qrOverlay.style.display = 'none';
  
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

