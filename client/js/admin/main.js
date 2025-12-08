/**
 * Admin Panel - Main Entry Point (Refactored)
 * LichtBlick
 * 
 * Nutzt existierenden socket-adapter.js und spotlight-renderer.js
 */

// ============================================================
// STATE
// ============================================================
const state = {
  // Game
  phase: 'lobby', // lobby | playing | revealed | ended
  currentImageId: null,
  selectedGameImageId: null,
  
  // Images
  imagePool: [],
  gameImages: [],
  
  // Spotlight
  spotlightEnabled: false,
  spotlightSize: 80,
  spotlightStrength: 100,
  spotlightFocus: 70,
  spotlightClicks: [],
  showRevealOverlay: false,
  
  // Canvas
  canvasImage: null,
  isDrawing: false,
  lastSpotlightSend: 0,
  
  // Players
  players: [],
  
  // Connection
  connected: false,
  beamerConnected: false,
  
  // QR
  qrEnabled: false,
  
  // Leaderboard
  leaderboardVisible: true, // Default: angezeigt
  
  // PIN Protection
  pinEnabled: false,
  pinExpiresAt: null,
  currentPin: null,
  playerJoinUrl: null,
  pinTimerInterval: null,
  
  // Multi-Admin
  adminSessionCount: 1,
  
  // UI
  sidebarOpen: false,
  contextMenuTarget: null,
  draggedGameImage: null,
  
  // Cinema Mode
  cinemaMode: false,
  cinemaAutoRestart: false
};

// Throttle for spotlight updates
const SPOTLIGHT_THROTTLE = 50;

// Scroll animation constants
const SMOOTH_SCROLL_DURATION = 350; // ms
const SCROLL_TOLERANCE = 1; // px for detecting scroll end

// ============================================================
// DOM REFERENCES
// ============================================================
const dom = {};

function collectDOM() {
  // Header
  dom.phaseBadge = document.querySelector('.phase-badge');
  dom.connectionStatus = document.querySelector('.connection-status');
  dom.beamerStatus = document.querySelector('.beamer-status');
  dom.playerCount = document.querySelector('.player-count');
  dom.btnBeamer = document.getElementById('btn-beamer');
  dom.btnSidebar = document.getElementById('btn-sidebar');
  dom.btnSettings = document.getElementById('btn-settings');
  dom.pinTimer = document.getElementById('pin-timer');
  dom.pinTimerValue = document.querySelector('.pin-timer-value');
  
  // Canvas
  dom.canvas = document.getElementById('spotlight-canvas');
  dom.ctx = dom.canvas?.getContext('2d');
  dom.currentImageInfo = document.getElementById('current-image-info');
  dom.canvasSection = document.querySelector('.canvas-section');
  dom.btnCinemaMode = document.getElementById('btn-cinema-mode');
  dom.cinemaBackdrop = document.getElementById('cinema-backdrop');
  dom.cinemaAutoToggle = document.getElementById('cinema-auto-toggle');
  
  // Spotlight Controls
  dom.spotlightToggle = document.getElementById('spotlight-toggle');
  dom.spotlightSize = document.getElementById('spotlight-size');
  dom.spotlightSizeValue = document.getElementById('spotlight-size-value');
  dom.spotlightStrength = document.getElementById('spotlight-strength');
  dom.spotlightStrengthValue = document.getElementById('spotlight-strength-value');
  dom.spotlightFocus = document.getElementById('spotlight-focus');
  dom.spotlightFocusValue = document.getElementById('spotlight-focus-value');
  dom.revealOverlayToggle = document.getElementById('reveal-overlay-toggle');
  dom.btnClearSpotlights = document.getElementById('btn-clear-spotlights');
  dom.btnSpotlightSettings = document.getElementById('btn-spotlight-settings');
  dom.spotlightPopup = document.getElementById('spotlight-popup');
  
  // Leaderboard
  dom.leaderboardList = document.getElementById('leaderboard-list');
  dom.leaderboardCount = document.getElementById('leaderboard-count');
  
  // Game Strip
  dom.stripScroll = document.getElementById('strip-scroll');
  dom.stripNavLeft = document.getElementById('strip-nav-left');
  dom.stripNavRight = document.getElementById('strip-nav-right');
  
  // Controls (now in footer)
  dom.btnStartGame = document.getElementById('btn-start-game');
  dom.btnReveal = document.getElementById('btn-reveal');
  dom.btnNextImage = document.getElementById('btn-next-image');
  dom.btnEndGame = document.getElementById('btn-end-game');
  dom.btnRestartGame = document.getElementById('btn-restart-game');
  
  // Footer
  dom.progressFill = document.getElementById('progress-fill');
  dom.progressLabel = document.getElementById('progress-label');
  dom.qrToggle = document.getElementById('qr-toggle');
  
  // Leaderboard
  dom.leaderboardToggle = document.getElementById('leaderboard-toggle');
  
  // Auth
  dom.authScreen = document.getElementById('auth-screen');
  dom.authForm = document.getElementById('auth-form');
  dom.authError = document.getElementById('auth-error');
  dom.adminPin = document.getElementById('admin-pin');
  
  // Sidebar
  dom.sidebar = document.getElementById('sidebar');
  dom.imagePool = document.getElementById('image-pool');
  dom.btnAddAllFree = document.getElementById('btn-add-all-free');
  dom.poolStats = document.getElementById('pool-stats');
}

// ============================================================
// URL TOKEN
// ============================================================
function getUrlToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

const URL_TOKEN = getUrlToken();

// ============================================================
// AUTHENTICATED FETCH
// ============================================================
/**
 * 🔐 Authenticated fetch wrapper
 * Uses the URL admin token for API authentication
 */
async function authFetch(url, options = {}) {
  const headers = {
    ...options.headers
  };
  
  // Use URL_TOKEN for authentication
  if (URL_TOKEN) {
    headers['Authorization'] = `Bearer ${URL_TOKEN}`;
  }
  
  // Add Content-Type for JSON requests if not already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle 401 - invalid token
  if (response.status === 401) {
    toast('Authentifizierung fehlgeschlagen. Bitte Admin-Link prüfen.', 'error');
    throw new Error('Unauthorized');
  }
  
  return response;
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  collectDOM();
  
  if (!URL_TOKEN) {
    showAuthError('Kein Admin-Token in URL. Bitte korrekten Admin-Link verwenden.');
    return;
  }
  
  setupCanvas();
  setupEventListeners();
  setupSocketListeners();
  setupModals();
  loadSpotlightSettings();
  
  // Connect via socket-adapter
  if (window.socketAdapter) {
    window.socketAdapter.emit('admin:connect', { token: URL_TOKEN });
  }
});

// ============================================================
// CANVAS SETUP
// ============================================================
function setupCanvas() {
  if (!dom.canvas || !dom.ctx) return;
  
  // Initial sizing
  resizeCanvas();
  
  // Resize on window resize
  window.addEventListener('resize', debounce(resizeCanvas, 100));
  
  drawEmptyState();
}

function resizeCanvas() {
  if (!dom.canvas) return;
  
  const container = dom.canvas.parentElement;
  if (!container) return;
  
  // Get container dimensions
  const rect = container.getBoundingClientRect();
  const maxWidth = rect.width - 16; // padding
  const maxHeight = rect.height - 16;
  
  // Standard 4:3 aspect ratio for images
  const aspectRatio = 4 / 3;
  
  let canvasWidth, canvasHeight;
  
  if (maxWidth / maxHeight > aspectRatio) {
    // Container is wider - fit to height
    canvasHeight = maxHeight;
    canvasWidth = canvasHeight * aspectRatio;
  } else {
    // Container is taller - fit to width
    canvasWidth = maxWidth;
    canvasHeight = canvasWidth / aspectRatio;
  }
  
  // Set canvas size (minimum 400x300)
  dom.canvas.width = Math.max(400, Math.floor(canvasWidth));
  dom.canvas.height = Math.max(300, Math.floor(canvasHeight));
  
  // Redraw if image loaded
  if (state.canvasImage) {
    redrawCanvas();
  } else {
    drawEmptyState();
  }
}

function drawEmptyState() {
  if (!dom.ctx) return;
  
  dom.ctx.fillStyle = '#1a1a1a';
  dom.ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
  dom.ctx.font = '18px Arial';
  dom.ctx.fillStyle = '#666';
  dom.ctx.textAlign = 'center';
  dom.ctx.fillText('Wähle ein Bild aus dem Game-Strip', dom.canvas.width/2, dom.canvas.height/2);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Header
  dom.btnBeamer?.addEventListener('click', openBeamer);
  dom.btnSidebar?.addEventListener('click', toggleSidebar);
  dom.btnSettings?.addEventListener('click', openSettings);
  
  // Spotlight Controls
  dom.spotlightToggle?.addEventListener('change', (e) => {
    state.spotlightEnabled = e.target.checked;
    if (!state.spotlightEnabled) {
      window.socketAdapter?.emit('admin:clear_spotlight');
    }
    redrawCanvas();
  });
  
  dom.spotlightSize?.addEventListener('input', (e) => {
    state.spotlightSize = parseInt(e.target.value);
    dom.spotlightSizeValue.textContent = `${state.spotlightSize}px`;
    saveSpotlightSettings();
  });
  
  dom.spotlightStrength?.addEventListener('input', (e) => {
    state.spotlightStrength = parseInt(e.target.value);
    dom.spotlightStrengthValue.textContent = `${state.spotlightStrength}%`;
    saveSpotlightSettings();
  });
  
  dom.spotlightFocus?.addEventListener('input', (e) => {
    state.spotlightFocus = parseInt(e.target.value);
    dom.spotlightFocusValue.textContent = `${state.spotlightFocus}%`;
    saveSpotlightSettings();
  });
  
  dom.revealOverlayToggle?.addEventListener('change', (e) => {
    state.showRevealOverlay = e.target.checked;
    redrawCanvas();
  });
  
  dom.btnClearSpotlights?.addEventListener('click', clearAllSpotlights);
  
  // Spotlight Settings Popup
  dom.btnSpotlightSettings?.addEventListener('click', toggleSpotlightPopup);
  
  // Cinema Mode
  dom.btnCinemaMode?.addEventListener('click', toggleCinemaMode);
  dom.cinemaBackdrop?.addEventListener('click', exitCinemaMode);
  dom.cinemaAutoToggle?.addEventListener('change', handleCinemaAutoToggle);
  
  // Canvas Events
  dom.canvas?.addEventListener('mousedown', startDrawing);
  dom.canvas?.addEventListener('mousemove', handleMouseMove);
  dom.canvas?.addEventListener('mouseup', stopDrawing);
  dom.canvas?.addEventListener('mouseleave', stopDrawing);
  dom.canvas?.addEventListener('click', handleCanvasClick);
  
  // Touch support
  dom.canvas?.addEventListener('touchstart', handleTouchStart, { passive: false });
  dom.canvas?.addEventListener('touchmove', handleTouchMove, { passive: false });
  dom.canvas?.addEventListener('touchend', stopDrawing);
  
  // Game Controls
  dom.btnStartGame?.addEventListener('click', startGame);
  dom.btnReveal?.addEventListener('click', revealImage);
  dom.btnNextImage?.addEventListener('click', nextImage);
  dom.btnEndGame?.addEventListener('click', endGame);
  dom.btnRestartGame?.addEventListener('click', openRestartGameModal);
  
  // QR-Toggle
  dom.qrToggle?.addEventListener('change', toggleQR);
  
  // Leaderboard-Toggle
  dom.leaderboardToggle?.addEventListener('change', toggleLeaderboard);
  
  // Game Strip Navigation
  dom.stripNavLeft?.addEventListener('click', () => scrollStrip(-200));
  dom.stripNavRight?.addEventListener('click', () => scrollStrip(200));
  
  // Auth Form
  dom.authForm?.addEventListener('submit', handleAuth);
  
  // Keyboard Shortcuts
  document.addEventListener('keydown', handleKeyboard);
  
  // Click outside to close context menu
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });
  
  // Sidebar
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  
  // Bug-008 fix: Use event delegation for context menu to avoid render lag
  const imagePool = document.getElementById('image-pool');
  if (imagePool) {
    imagePool.addEventListener('contextmenu', (e) => {
      const poolItem = e.target.closest('.pool-item');
      if (poolItem) {
        showContextMenu(e, poolItem);
      }
    });
    
    imagePool.addEventListener('dblclick', (e) => {
      const poolItem = e.target.closest('.pool-item');
      if (poolItem) {
        const id = parseInt(poolItem.dataset.id);
        const img = state.imagePool.find(i => i.id === id);
        const inGame = state.gameImages.some(g => g.image_id === id);
        if (!inGame && !img?.is_start_image && !img?.is_end_image) {
          addImageToGame(id);
        }
      }
    });
  }
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSidebar();
    });
  });
  
  // Context menu actions
  document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      handleContextMenuAction(item.dataset.action);
    });
  });
  
  // Upload
  setupUpload();
  
  // Sidebar "Add all free" button
  dom.btnAddAllFree?.addEventListener('click', addAllFreeImages);
  
  // Note: Escape key and other shortcuts are handled in handleKeyboard()
  // ? for help (when not in input)
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.target.matches('input, textarea')) {
      openHelpModal();
    }
  });
  
  // Settings Tabs
  setupSettingsTabs();
  
  // Factory Reset confirmation
  setupFactoryResetConfirmation();
}

// ============================================================
// SOCKET LISTENERS
// ============================================================
function setupSocketListeners() {
  if (!window.socketAdapter) {
    toast('Socket-Verbindung konnte nicht hergestellt werden', 'error');
    return;
  }
  
  const socket = window.socketAdapter;
  
  // Connection events
  window.addEventListener('socket:connected', () => {
    state.connected = true;
    updateConnectionStatus();
    socket.emit('admin:connect', { token: URL_TOKEN });
  });
  
  window.addEventListener('socket:disconnected', () => {
    state.connected = false;
    updateConnectionStatus();
  });
  
  // Auth events
  socket.on('admin:auth_required', handleAuthRequired);
  socket.on('admin:initial_state', handleAdminInitialState);
  
  // PIN & Protection events
  socket.on('admin:protection_changed', (data) => {
    state.pinEnabled = data.enabled;
    state.pinExpiresAt = data.expiresAt ? data.expiresAt * 1000 : null;
    updatePinUI();
  });
  
  // Multi-Admin session count
  socket.on('admin:session_count', (data) => {
    const oldCount = state.adminSessionCount;
    state.adminSessionCount = data.count || 1;
    updateAdminSessionBadge();
    // Only show toast warning when count increases (Bug-015 fix)
    if (state.adminSessionCount > oldCount && state.adminSessionCount > 1) {
      toast(`⚠️ ${state.adminSessionCount} Admin-Sessions aktiv! Änderungen können kollidieren.`, 'warning');
    }
  });
  
  // Game events
  socket.on('game:lobby_update', handleLobbyUpdate);
  socket.on('game:phase_change', handlePhaseChange);
  socket.on('game:leaderboard_update', handleLeaderboardUpdate);
  
  // Beamer status
  socket.on('beamer:status', (data) => {
    state.beamerConnected = data.connected;
    updateConnectionStatus();
  });
}

// ============================================================
// AUTH HANDLERS
// ============================================================
function handleAuth(e) {
  e.preventDefault();
  const pin = dom.adminPin?.value.trim();
  if (pin.length < 4) {
    showAuthError('PIN zu kurz');
    return;
  }
  
  window.socketAdapter?.emit('admin:auth', { pin, token: URL_TOKEN }, async (res) => {
    if (res.success) {
      hideAuth();
      try { sessionStorage.setItem('adminPin', pin); } catch {}
      // Get REST API token for authenticated API calls
      await getApiToken(pin);
      loadImages();
    } else {
      showAuthError(res.message || 'PIN falsch');
    }
  });
}

function handleAuthRequired({ message, needsToken, needsPin }) {
  if (needsToken) {
    showAuthError(message || 'Ungültiger Admin-Link.');
    dom.authForm.style.display = 'none';
  } else if (needsPin) {
    dom.authScreen?.classList.remove('hidden');
    dom.authForm.style.display = 'block';
  }
}

function showAuthError(msg) {
  if (dom.authError) {
    dom.authError.textContent = msg;
    dom.authError.classList.remove('hidden');
  }
  dom.authScreen?.classList.remove('hidden');
}

function hideAuth() {
  dom.authScreen?.classList.add('hidden');
}

// ============================================================
// INITIAL STATE HANDLER
// ============================================================
function handleAdminInitialState(payload) {
  if (!payload?.success) return;
  const { pin, protection, players, playerCount, game, currentImageId, qr, adminSessionCount, leaderboardVisible } = payload.data || {};
  
  // QR-State
  if (qr !== undefined) {
    state.qrEnabled = qr.enabled;
    if (dom.qrToggle) {
      dom.qrToggle.checked = qr.enabled;
    }
  }
  
  // Leaderboard-State
  if (leaderboardVisible !== undefined) {
    state.leaderboardVisible = leaderboardVisible;
    if (dom.leaderboardToggle) {
      dom.leaderboardToggle.checked = leaderboardVisible;
    }
  }
  
  // PIN & Player URL
  if (pin) {
    state.currentPin = pin.pin;
    state.playerJoinUrl = pin.joinUrl;
    // Set player URL in settings if modal is open
    const playerUrlInput = document.getElementById('player-url');
    if (playerUrlInput) playerUrlInput.value = pin.joinUrl || '';
  }
  
  // Protection State (PIN-Timer)
  if (protection) {
    state.pinEnabled = protection.enabled;
    state.pinExpiresAt = protection.expiresAt ? protection.expiresAt * 1000 : null; // Convert to ms
    updatePinUI();
  }
  
  // Multi-Admin Warning
  if (adminSessionCount !== undefined) {
    state.adminSessionCount = adminSessionCount;
    updateAdminSessionBadge();
    if (adminSessionCount > 1) {
      updateAdminSessionWarning();
    }
  }
  
  // Phase
  if (game?.status) {
    state.phase = game.status;
    if (game.status === 'playing' && currentImageId) {
      state.currentImageId = currentImageId;
    }
    updateGameControlButtons();
  }
  
  // Players
  if (players) {
    state.players = players;
    renderLeaderboard();
    if (dom.playerCount) {
      dom.playerCount.textContent = playerCount || players.length;
    }
  }
  
  // Protection disabled = auto-login
  if (protection && !protection.enabled) {
    hideAuth();
    // URL_TOKEN is used directly in authFetch, no need for separate API token
    loadImages();
  }
  
  updateConnectionStatus();
}

// ============================================================
// CONNECTION STATUS
// ============================================================
function updateConnectionStatus() {
  if (dom.connectionStatus) {
    dom.connectionStatus.dataset.status = state.connected ? 'connected' : 'disconnected';
  }
  if (dom.beamerStatus) {
    dom.beamerStatus.dataset.status = state.beamerConnected ? 'connected' : 'disconnected';
  }
}

// ============================================================
// PIN UI & TIMER
// ============================================================
function updatePinUI() {
  const pinEnabledCheckbox = document.getElementById('pin-enabled');
  const pinStatusBox = document.getElementById('pin-status-box');
  const pinRemainingEl = document.getElementById('pin-remaining');
  
  // Update checkbox in settings
  if (pinEnabledCheckbox) {
    pinEnabledCheckbox.checked = state.pinEnabled;
  }
  
  // Show/hide PIN timer in header
  if (dom.pinTimer) {
    if (state.pinEnabled && state.pinExpiresAt) {
      dom.pinTimer.classList.remove('hidden');
      startPinTimer();
    } else {
      dom.pinTimer.classList.add('hidden');
      stopPinTimer();
    }
  }
  
  // Update settings modal PIN status box
  if (pinStatusBox) {
    if (state.pinEnabled && state.pinExpiresAt) {
      pinStatusBox.classList.remove('hidden');
    } else {
      pinStatusBox.classList.add('hidden');
    }
  }
}

function startPinTimer() {
  stopPinTimer(); // Clear any existing timer
  
  const updateTimer = () => {
    if (!state.pinExpiresAt) return;
    
    const remaining = state.pinExpiresAt - Date.now();
    if (remaining <= 0) {
      state.pinEnabled = false;
      state.pinExpiresAt = null;
      updatePinUI();
      toast('PIN-Schutz abgelaufen', 'info');
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (dom.pinTimerValue) dom.pinTimerValue.textContent = timeStr;
    const pinRemainingEl = document.getElementById('pin-remaining');
    if (pinRemainingEl) pinRemainingEl.textContent = timeStr;
  };
  
  updateTimer(); // Initial update
  state.pinTimerInterval = setInterval(updateTimer, 1000);
}

function stopPinTimer() {
  if (state.pinTimerInterval) {
    clearInterval(state.pinTimerInterval);
    state.pinTimerInterval = null;
  }
}

// ============================================================
// MULTI-ADMIN WARNING
// ============================================================
function updateAdminSessionWarning() {
  // Bug-015 fix: Don't call toast here, it's called from the event handler
  // This function just updates the badge
  updateAdminSessionBadge();
}

function updateAdminSessionBadge() {
  const badge = document.getElementById('admin-session-badge');
  const countEl = badge?.querySelector('.admin-session-count');
  
  if (badge) {
    if (state.adminSessionCount > 1) {
      if (countEl) countEl.textContent = state.adminSessionCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// ============================================================
// IMAGE LOADING
// ============================================================
async function loadImages() {
  try {
    const [poolRes, gameRes] = await Promise.all([
      authFetch('/api/images'),
      authFetch('/api/game-images')
    ]);
    
    const [poolData, gameData] = await Promise.all([
      poolRes.json(),
      gameRes.json()
    ]);
    
    if (poolData.success) {
      state.imagePool = poolData.data;
    }
    
    if (gameData.success) {
      state.gameImages = gameData.data;
      
      // Restore selection if in playing state
      if (state.currentImageId && state.phase === 'playing') {
        const currentGI = state.gameImages.find(g => g.image_id === state.currentImageId);
        if (currentGI) {
          state.selectedGameImageId = currentGI.id;
          loadImageToCanvas(state.currentImageId);
        }
      } else if (!state.selectedGameImageId) {
        const firstUnplayed = state.gameImages.find(g => !g.is_played);
        if (firstUnplayed) {
          state.selectedGameImageId = firstUnplayed.id;
        }
      }
    }
    
    renderGameStrip();
    renderSidebar();
    updateProgress();
    updateGameControlButtons();
    
  } catch (error) {
    toast('Fehler beim Laden der Bilder', 'error');
  }
}

// ============================================================
// GAME STRIP RENDERING
// ============================================================
function renderGameStrip() {
  if (!dom.stripScroll) return;
  
  // Find start/end images
  const startImage = state.imagePool.find(img => img.is_start_image);
  const endImage = state.imagePool.find(img => img.is_end_image);
  
  // Check if start and end are the same
  const startAndEndSame = startImage && endImage && startImage.id === endImage.id;
  
  if (state.gameImages.length === 0 && !startImage && !endImage) {
    dom.stripScroll.innerHTML = '<div class="strip-empty">Keine Bilder im Spiel. Füge Bilder über die Sidebar hinzu.</div>';
    return;
  }
  
  let html = '';
  
  // Bug-006 fix: Show start and end separately even if they're the same image
  // Start Image (always show if set)
  if (startImage) {
    html += renderStripCardWithInput(startImage, 'start', false);
  }
  
  // Game Images (sorted: played first, then unplayed)
  const sortedGameImages = [...state.gameImages].sort((a, b) => {
    // Played images first
    if (a.is_played && !b.is_played) return -1;
    if (!a.is_played && b.is_played) return 1;
    // Then by order
    return a.order_index - b.order_index;
  });
  
  sortedGameImages.forEach((gi, index) => {
    const isCurrentlyPlaying = gi.id === state.selectedGameImageId && state.phase === 'playing';
    html += renderStripCardWithInput(gi, 'game', gi.is_played, index + 1, isCurrentlyPlaying);
  });
  
  // Bug-006 fix: Always show end image if set, even if same as start
  // End Image (always show if set)
  if (endImage) {
    html += renderStripCardWithInput(endImage, 'end', false);
  }
  
  dom.stripScroll.innerHTML = html;
  
  // Add event listeners
  dom.stripScroll.querySelectorAll('.game-card-container').forEach(container => {
    const card = container.querySelector('.game-card');
    const input = container.querySelector('.game-card-input');
    const id = parseInt(container.dataset.id);
    const type = container.dataset.type;
    
    if (type === 'game') {
      card?.addEventListener('click', () => selectGameImage(id));
      
      // Drag & Drop for unplayed cards
      const gi = state.gameImages.find(g => g.id === id);
      if (gi && !gi.is_played) {
        container.draggable = true;
        container.addEventListener('dragstart', (e) => handleDragStart(e, id));
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', (e) => handleDrop(e, id));
        container.addEventListener('dragend', handleDragEnd);
      }
      
      // Input change
      input?.addEventListener('change', (e) => {
        updateGameImageAnswer(id, e.target.value);
      });
    }
    
    // Delete button
    container.querySelector('.game-card-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      removeGameImage(id);
    });
  });
  
  // Scroll to current
  if (state.selectedGameImageId) {
    const currentCard = dom.stripScroll.querySelector(`.game-card-container[data-id="${state.selectedGameImageId}"]`);
    currentCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  
  // Bug-014 fix: Update scroll button states
  updateScrollButtons();
}

function renderStripCardWithInput(item, type, isPlayed, orderNum = null, isCurrentlyPlaying = false) {
  const isGame = type === 'game';
  const isCurrent = isGame && item.id === state.selectedGameImageId;
  const isStart = type === 'start' || type === 'start-end';
  const isEnd = type === 'end' || type === 'start-end';
  const url = item.url || `/uploads/${item.filename}`;
  
  // Determine classes
  let cardClasses = ['game-card'];
  if (isCurrent) cardClasses.push('current');
  if (isPlayed) cardClasses.push('played');
  if (isStart) cardClasses.push('is-start');
  if (isEnd) cardClasses.push('is-end');
  if (isCurrentlyPlaying) cardClasses.push('playing');
  
  // Badges
  let badges = '';
  if (isStart) badges += '<span class="game-card-badge badge-start">⭐</span>';
  if (isEnd) badges += '<span class="game-card-badge badge-end">🏁</span>';
  if (isCurrentlyPlaying) badges += '<span class="game-card-badge badge-playing">▶️</span>';
  
  // Order text
  let orderText = '';
  if (type === 'start' || type === 'start-end') orderText = '⭐';
  else if (type === 'end') orderText = '🏁';
  else if (orderNum) orderText = `#${orderNum}`;
  
  // Answer/correct_answer
  const answer = item.correct_answer || item.answer || '';
  
  // Can edit input?
  const inputDisabled = isPlayed || type !== 'game';
  const inputClass = isPlayed ? 'locked' : '';
  
  // Show delete button? (Bug-012 fix: don't show if currently playing)
  const showDelete = isGame && !isPlayed && !isCurrentlyPlaying;
  
  return `
    <div class="game-card-container" data-id="${item.id || item.image_id}" data-type="${type}">
      <div class="${cardClasses.join(' ')}">
        <img class="game-card-thumb" src="${url}" alt="${answer}" loading="lazy">
        ${badges}
        <div class="game-card-footer">
          <span class="game-card-order">${orderText}</span>
          ${isPlayed ? '<span class="game-card-check">✓</span>' : ''}
        </div>
        ${showDelete ? '<button class="game-card-delete" title="Entfernen">✕</button>' : ''}
      </div>
      <input 
        type="text" 
        class="game-card-input ${inputClass}" 
        value="${escapeHtml(answer)}" 
        placeholder="..." 
        ${inputDisabled ? 'disabled' : ''}
        title="${inputDisabled ? 'Kann nicht mehr bearbeitet werden' : 'Antwort eingeben'}"
      >
    </div>
  `;
}

// ============================================================
// GAME IMAGE SELECTION
// ============================================================
function selectGameImage(id) {
  state.selectedGameImageId = id;
  renderGameStrip();
  
  const gi = state.gameImages.find(g => g.id === id);
  if (gi) {
    state.currentImageId = gi.image_id;
    loadImageToCanvas(gi.image_id);
    
    // Update image info
    if (dom.currentImageInfo) {
      dom.currentImageInfo.textContent = gi.correct_answer || `Bild ${state.gameImages.indexOf(gi) + 1}`;
    }
    
    // Notify server
    window.socketAdapter?.emit('admin:select_image', { imageId: gi.image_id });
  }
}

// ============================================================
// CANVAS & SPOTLIGHT
// ============================================================
function loadImageToCanvas(imageId) {
  const poolImage = state.imagePool.find(img => img.id === imageId);
  const gameImage = state.gameImages.find(gi => gi.image_id === imageId);
  const imageUrl = poolImage?.url || gameImage?.url;
  
  if (!imageUrl) return;
  
  const img = new Image();
  img.onload = () => {
    state.canvasImage = img;
    state.spotlightClicks = []; // Reset spotlights for new image
    redrawCanvas();
  };
  img.onerror = () => {
    toast('Fehler beim Laden des Bildes', 'error');
    drawEmptyState();
  };
  img.src = imageUrl;
}

function redrawCanvas(mouseSpot = null) {
  if (!state.canvasImage || !dom.ctx) return;
  
  // Use SpotlightRenderer if available
  if (window.SpotlightRenderer) {
    window.SpotlightRenderer.render({
      ctx: dom.ctx,
      image: state.canvasImage,
      spotlights: state.spotlightClicks,
      mouseSpot: mouseSpot,
      isRevealed: false,
      preview: true,
      highlight: state.showRevealOverlay
    });
  } else {
    // Fallback: Simple image render
    dom.ctx.fillStyle = '#000';
    dom.ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
    
    const scale = Math.min(dom.canvas.width / state.canvasImage.width, dom.canvas.height / state.canvasImage.height);
    const x = (dom.canvas.width - state.canvasImage.width * scale) / 2;
    const y = (dom.canvas.height - state.canvasImage.height * scale) / 2;
    
    dom.ctx.drawImage(state.canvasImage, x, y, state.canvasImage.width * scale, state.canvasImage.height * scale);
  }
}

function redrawCanvasRevealed() {
  if (!state.canvasImage || !dom.ctx) return;
  
  dom.ctx.fillStyle = '#000';
  dom.ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
  
  const scale = Math.min(dom.canvas.width / state.canvasImage.width, dom.canvas.height / state.canvasImage.height);
  const x = (dom.canvas.width - state.canvasImage.width * scale) / 2;
  const y = (dom.canvas.height - state.canvasImage.height * scale) / 2;
  
  dom.ctx.drawImage(state.canvasImage, x, y, state.canvasImage.width * scale, state.canvasImage.height * scale);
}

// Spotlight drawing handlers
function getImageBounds() {
  if (!state.canvasImage) return null;
  const scale = Math.min(dom.canvas.width / state.canvasImage.width, dom.canvas.height / state.canvasImage.height);
  const imgX = (dom.canvas.width - state.canvasImage.width * scale) / 2;
  const imgY = (dom.canvas.height - state.canvasImage.height * scale) / 2;
  const imgW = state.canvasImage.width * scale;
  const imgH = state.canvasImage.height * scale;
  return { imgX, imgY, imgW, imgH };
}

function canvasToImageCoords(canvasX, canvasY) {
  const bounds = getImageBounds();
  if (!bounds) return null;
  
  const x = (canvasX - bounds.imgX) / bounds.imgW;
  const y = (canvasY - bounds.imgY) / bounds.imgH;
  
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y))
  };
}

function startDrawing(e) {
  if (!state.spotlightEnabled || !state.canvasImage) return;
  state.isDrawing = true;
  draw(e);
}

function handleMouseMove(e) {
  // Only draw when actively dragging spotlight
  if (state.isDrawing) {
    draw(e);
  }
  // Note: Preview cursor without drawing was considered but not needed
  // The static spotlight circles on click are sufficient for user feedback
}

function draw(e) {
  if (!state.isDrawing || !state.spotlightEnabled || !state.canvasImage) return;
  
  const rect = dom.canvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) * (dom.canvas.width / rect.width);
  const canvasY = (e.clientY - rect.top) * (dom.canvas.height / rect.height);
  
  const coords = canvasToImageCoords(canvasX, canvasY);
  if (!coords) return;
  
  const bounds = getImageBounds();
  const size = state.spotlightSize / bounds.imgW;
  const strength = state.spotlightStrength / 100;
  const focus = state.spotlightFocus / 100;
  
  // Throttle socket updates
  const now = Date.now();
  if (now - state.lastSpotlightSend >= SPOTLIGHT_THROTTLE) {
    window.socketAdapter?.emit('admin:spotlight', {
      x: coords.x, y: coords.y,
      size, strength, focus
    });
    state.lastSpotlightSend = now;
  }
  
  // Draw preview with mouse spotlight
  redrawCanvasWithMouse({ x: coords.x, y: coords.y, size, strength, focus });
}

function redrawCanvasWithMouse(mouseSpot) {
  if (!state.canvasImage || !dom.ctx) return;
  
  // Use SpotlightRenderer if available
  if (window.SpotlightRenderer) {
    window.SpotlightRenderer.render({
      ctx: dom.ctx,
      image: state.canvasImage,
      spotlights: state.spotlightClicks,
      mouseSpot: mouseSpot,
      isRevealed: false,
      preview: true,
      highlight: state.showRevealOverlay
    });
  } else {
    // Fallback: Simple image render
    dom.ctx.fillStyle = '#000';
    dom.ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
    
    const scale = Math.min(dom.canvas.width / state.canvasImage.width, dom.canvas.height / state.canvasImage.height);
    const x = (dom.canvas.width - state.canvasImage.width * scale) / 2;
    const y = (dom.canvas.height - state.canvasImage.height * scale) / 2;
    
    dom.ctx.drawImage(state.canvasImage, x, y, state.canvasImage.width * scale, state.canvasImage.height * scale);
  }
}

function stopDrawing() {
  state.isDrawing = false;
  redrawCanvas();
}

function handleCanvasClick(e) {
  if (!state.spotlightEnabled || !state.canvasImage) return;
  
  const rect = dom.canvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) * (dom.canvas.width / rect.width);
  const canvasY = (e.clientY - rect.top) * (dom.canvas.height / rect.height);
  
  const coords = canvasToImageCoords(canvasX, canvasY);
  if (!coords) return;
  
  const bounds = getImageBounds();
  const size = state.spotlightSize / bounds.imgW;
  const strength = state.spotlightStrength / 100;
  const focus = state.spotlightFocus / 100;
  
  state.spotlightClicks.push({ x: coords.x, y: coords.y, size, strength, focus });
  
  window.socketAdapter?.emit('admin:spotlight_click', { x: coords.x, y: coords.y, size, strength, focus });
  
  redrawCanvas();
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  dom.canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  dom.canvas.dispatchEvent(mouseEvent);
}

function clearAllSpotlights() {
  state.spotlightClicks = [];
  window.socketAdapter?.emit('admin:clear_spotlight');
  redrawCanvas();
}

/**
 * 🔧 Spotlight Settings Popup Toggle
 */
function toggleSpotlightPopup(event) {
  event?.stopPropagation();
  
  if (!dom.spotlightPopup) return;
  
  const isHidden = dom.spotlightPopup.classList.contains('hidden');
  
  if (isHidden) {
    // Show popup
    dom.spotlightPopup.classList.remove('hidden');
    
    // Add click-outside handler
    setTimeout(() => {
      document.addEventListener('click', handleClickOutsidePopup);
    }, 0);
  } else {
    // Hide popup
    closeSpotlightPopup();
  }
}

function closeSpotlightPopup() {
  if (!dom.spotlightPopup) return;
  
  dom.spotlightPopup.classList.add('hidden');
  document.removeEventListener('click', handleClickOutsidePopup);
}

function handleClickOutsidePopup(event) {
  if (!dom.spotlightPopup || !dom.btnSpotlightSettings) return;
  
  const isClickInsidePopup = dom.spotlightPopup.contains(event.target);
  const isClickOnButton = dom.btnSpotlightSettings.contains(event.target);
  
  if (!isClickInsidePopup && !isClickOnButton) {
    closeSpotlightPopup();
  }
}

// ============================================================
// CINEMA MODE
// ============================================================

/**
 * 🎬 Toggle Cinema Mode (Manueller Overlay-Button)
 */
function toggleCinemaMode() {
  if (state.cinemaMode) {
    exitCinemaMode();
  } else {
    enterCinemaMode();
  }
}

function enterCinemaMode() {
  if (!dom.canvasSection || !dom.cinemaBackdrop) return;
  
  state.cinemaMode = true;
  state.cinemaModeWasActive = true;
  
  dom.canvasSection.classList.add('cinema-mode');
  dom.canvasBackdrop.classList.remove('hidden');
  
  // Update footer indicator
  if (dom.cinemaIndicator) {
    dom.cinemaIndicator.classList.add('active');
  }
  
  // Toggle button icons
  const expandIcon = dom.btnCinemaMode?.querySelector('.cinema-icon-expand');
  const collapseIcon = dom.btnCinemaMode?.querySelector('.cinema-icon-collapse');
  if (expandIcon) expandIcon.classList.add('hidden');
  if (collapseIcon) collapseIcon.classList.remove('hidden');
  
  // Resize canvas
  setTimeout(() => {
    if (state.canvasImage) {
      resizeCanvas();
      redrawCanvas();
    }
  }, 100);
}

function exitCinemaMode() {
  if (!dom.canvasSection || !dom.cinemaBackdrop) return;
  
  state.cinemaMode = false;
  
  // Add closing animation
  dom.canvasSection.classList.add('closing');
  dom.cinemaBackdrop.classList.add('closing');
  
  // Wait for animation to complete
  setTimeout(() => {
    dom.canvasSection.classList.remove('cinema-mode', 'closing');
    dom.cinemaBackdrop.classList.add('hidden');
    dom.cinemaBackdrop.classList.remove('closing');
    
    // Toggle button icons
    const expandIcon = dom.btnCinemaMode?.querySelector('.cinema-icon-expand');
    const collapseIcon = dom.btnCinemaMode?.querySelector('.cinema-icon-collapse');
    if (expandIcon) expandIcon.classList.remove('hidden');
    if (collapseIcon) collapseIcon.classList.add('hidden');
    
    // Resize canvas
    if (state.canvasImage) {
      resizeCanvas();
      redrawCanvas();
    }
  }, 250); // Match animation duration
}

/**
 * 🔄 Handle Kino-Automatik Toggle (Footer-Switch)
 */
function handleCinemaAutoToggle() {
  const newState = dom.cinemaAutoToggle?.checked || false;
  state.cinemaAutoRestart = newState;
  
  // Wenn Kino-Automatik deaktiviert wird UND Kino ist aktiv → Kino beenden
  if (!newState && state.cinemaMode) {
    exitCinemaMode();
  }
  
  toast(newState ? 'Kino-Automatik aktiviert' : 'Kino-Automatik deaktiviert', 'success');
}

/**
 * Auto-Restart Cinema Mode nach Bildwechsel
 * Wird von handleImageChange() aufgerufen
 */
function restartCinemaModeIfNeeded() {
  if (state.cinemaAutoRestart && state.phase === 'playing' && state.currentImageId) {
    setTimeout(() => {
      enterCinemaMode();
    }, 300);
  }
}

// Spotlight settings persistence
function saveSpotlightSettings() {
  try {
    localStorage.setItem('spotlightSettings', JSON.stringify({
      size: state.spotlightSize,
      strength: state.spotlightStrength,
      focus: state.spotlightFocus
    }));
  } catch (e) {}
}

function loadSpotlightSettings() {
  try {
    const saved = localStorage.getItem('spotlightSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      state.spotlightSize = settings.size ?? 80;
      state.spotlightStrength = settings.strength ?? 100;
      state.spotlightFocus = settings.focus ?? 70;
    }
  } catch (e) {}
  
  // Sync UI
  if (dom.spotlightSize) {
    dom.spotlightSize.value = state.spotlightSize;
    dom.spotlightSizeValue.textContent = `${state.spotlightSize}px`;
  }
  if (dom.spotlightStrength) {
    dom.spotlightStrength.value = state.spotlightStrength;
    dom.spotlightStrengthValue.textContent = `${state.spotlightStrength}%`;
  }
  if (dom.spotlightFocus) {
    dom.spotlightFocus.value = state.spotlightFocus;
    dom.spotlightFocusValue.textContent = `${state.spotlightFocus}%`;
  }
}

// ============================================================
// GAME CONTROLS
// ============================================================
function startGame() {
  let targetGI = null;
  
  if (state.selectedGameImageId) {
    targetGI = state.gameImages.find(g => g.id === state.selectedGameImageId && !g.is_played);
  }
  
  if (!targetGI) {
    targetGI = state.gameImages.find(g => !g.is_played);
  }
  
  if (!targetGI) {
    alert('Keine ungespielten Bilder vorhanden');
    return;
  }
  
  window.socketAdapter?.emit('admin:start_game', { imageId: targetGI.image_id }, (response) => {
    if (response.success) {
      state.currentImageId = targetGI.image_id;
      state.selectedGameImageId = targetGI.id;
      state.phase = 'playing';
      loadImageToCanvas(targetGI.image_id);
      updateGameControlButtons();
      renderGameStrip();
    } else {
      alert('Fehler beim Starten: ' + response.message);
    }
  });
}

function revealImage() {
  const selectedGI = state.gameImages.find(g => g.id === state.selectedGameImageId);
  
  if (!selectedGI) {
    alert('Kein aktives Bild zum Aufdecken');
    return;
  }
  
  window.socketAdapter?.emit('admin:reveal_image', { imageId: selectedGI.image_id }, (response) => {
    if (response?.success) {
      selectedGI.is_played = 1;
      state.phase = 'revealed';
      
      redrawCanvasRevealed();
      updateGameControlButtons();
      renderGameStrip();
      preselectNextImage();
      
      // Cinema Mode beenden beim Reveal
      if (state.cinemaMode) exitCinemaMode();
    } else {
      alert('Fehler beim Aufdecken: ' + (response?.message || 'Unbekannt'));
    }
  });
}

function nextImage() {
  const nextGI = state.gameImages.find(g => g.id === state.selectedGameImageId && !g.is_played);
  
  if (!nextGI) {
    const firstUnplayed = state.gameImages.find(g => !g.is_played);
    if (!firstUnplayed) {
      alert('Keine weiteren ungespielten Bilder vorhanden.');
      return;
    }
    state.selectedGameImageId = firstUnplayed.id;
  }
  
  const targetGI = state.gameImages.find(g => g.id === state.selectedGameImageId);
  
  window.socketAdapter?.emit('admin:next_image', { imageId: targetGI.image_id }, (response) => {
    if (response.success) {
      state.currentImageId = targetGI.image_id;
      state.phase = 'playing';
      state.spotlightClicks = [];
      loadImageToCanvas(targetGI.image_id);
      updateGameControlButtons();
      renderGameStrip();
      
      // Auto-Restart Cinema Mode wenn vorher aktiv
      restartCinemaModeIfNeeded();
    } else {
      alert('Fehler: ' + response.message);
    }
  });
}

function endGame() {
  if (!confirm('Spiel wirklich beenden?')) return;
  
  window.socketAdapter?.emit('admin:end_game', {}, (response) => {
    if (response.success) {
      state.phase = 'ended';
      updateGameControlButtons();
    } else {
      alert('Fehler: ' + response.message);
    }
  });
}

/**
 * 🔁 Spiel neu starten Modal öffnen
 */
function openRestartGameModal() {
  const modal = document.getElementById('restart-game-modal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Reset checkboxes
    const disconnectCheckbox = document.getElementById('restart-disconnect-players');
    const removePlayedCheckbox = document.getElementById('restart-remove-played');
    if (disconnectCheckbox) disconnectCheckbox.checked = false;
    if (removePlayedCheckbox) removePlayedCheckbox.checked = false;
  }
}

/**
 * 🔁 Spiel neu starten ausführen
 */
function restartGame() {
  const disconnectCheckbox = document.getElementById('restart-disconnect-players');
  const removePlayedCheckbox = document.getElementById('restart-remove-played');
  
  const disconnectPlayers = disconnectCheckbox?.checked || false;
  const removePlayedImages = removePlayedCheckbox?.checked || false;
  
  // Modal schließen
  const modal = document.getElementById('restart-game-modal');
  if (modal) modal.classList.add('hidden');
  
  // Server-Request
  window.socketAdapter?.emit('admin:restart_game', { 
    disconnectPlayers, 
    removePlayedImages 
  }, (response) => {
    if (response?.success) {
      toast('Spiel neu gestartet', 'success');
      state.phase = 'lobby';
      state.gameImages = [];
      state.players = [];
      loadImages();
      updateGameControlButtons();
      renderLeaderboard();
    } else {
      toast('Fehler beim Neustarten: ' + (response?.message || 'Unbekannt'), 'error');
    }
  });
}

/**
 * 🔲 QR-Code auf Beamer ein-/ausschalten
 * Socket-Event: admin:toggle_qr
 */
function toggleQR() {
  const newState = dom.qrToggle?.checked ?? !state.qrEnabled;
  
  window.socketAdapter?.emit('admin:toggle_qr', { visible: newState }, (response) => {
    if (response?.success) {
      state.qrEnabled = newState;
      toast(newState ? 'QR-Code eingeblendet' : 'QR-Code ausgeblendet', 'success');
    } else {
      // Revert checkbox on error
      if (dom.qrToggle) dom.qrToggle.checked = state.qrEnabled;
      toast('Fehler: ' + (response?.message || 'QR-Toggle fehlgeschlagen'), 'error');
    }
  });
}

/**
 * 🏆 Leaderboard-Anzeige im Endscreen ein-/ausschalten
 * Socket-Event: admin:toggle_leaderboard
 */
function toggleLeaderboard() {
  const newState = dom.leaderboardToggle?.checked ?? !state.leaderboardVisible;
  
  window.socketAdapter?.emit('admin:toggle_leaderboard', { visible: newState }, (response) => {
    if (response?.success) {
      state.leaderboardVisible = newState;
      toast(newState ? 'Leaderboard wird angezeigt' : 'Leaderboard ausgeblendet', 'success');
    } else {
      // Revert checkbox on error
      if (dom.leaderboardToggle) dom.leaderboardToggle.checked = state.leaderboardVisible;
      toast('Fehler: ' + (response?.message || 'Leaderboard-Toggle fehlgeschlagen'), 'error');
    }
  });
}

function preselectNextImage() {
  const nextUnplayed = state.gameImages.find(g => !g.is_played);
  if (nextUnplayed) {
    state.selectedGameImageId = nextUnplayed.id;
    renderGameStrip();
  }
}

function updateGameControlButtons() {
  const hasUnplayedImages = state.gameImages.some(g => !g.is_played);
  
  if (dom.btnStartGame) dom.btnStartGame.disabled = state.phase !== 'lobby' || !hasUnplayedImages;
  if (dom.btnReveal) dom.btnReveal.disabled = state.phase !== 'playing';
  if (dom.btnNextImage) dom.btnNextImage.disabled = state.phase !== 'revealed' || !hasUnplayedImages;
  if (dom.btnEndGame) dom.btnEndGame.disabled = state.phase !== 'revealed';
  
  // Toggle visibility
  if (dom.btnStartGame && dom.btnReveal) {
    dom.btnStartGame.style.display = state.phase === 'lobby' ? 'flex' : 'none';
    dom.btnReveal.style.display = state.phase !== 'lobby' ? 'flex' : 'none';
  }
  
  // Restart button: Nur bei phase='ended' sichtbar
  if (dom.btnRestartGame) {
    dom.btnRestartGame.style.display = state.phase === 'ended' ? 'flex' : 'none';
  }
  
  // End button: Verstecken wenn phase='ended'
  if (dom.btnEndGame) {
    dom.btnEndGame.style.display = state.phase === 'ended' ? 'none' : 'flex';
  }
  
  // Phase badge
  const phaseLabels = {
    'lobby': '⚙️ Lobby',
    'playing': '▶️ Bild aktiv',
    'revealed': '✓ Aufgedeckt',
    'ended': '🏁 Beendet'
  };
  if (dom.phaseBadge) {
    dom.phaseBadge.textContent = phaseLabels[state.phase] || state.phase;
    dom.phaseBadge.dataset.phase = state.phase;
  }
}

function updateProgress() {
  const total = state.gameImages.length;
  const played = state.gameImages.filter(g => g.is_played).length;
  const percent = total > 0 ? Math.round((played / total) * 100) : 0;
  
  if (dom.progressFill) dom.progressFill.style.width = `${percent}%`;
  if (dom.progressLabel) dom.progressLabel.textContent = `${played} / ${total} Bilder`;
}

// ============================================================
// LEADERBOARD
// ============================================================
function handleLobbyUpdate(data) {
  const count = data.totalPlayers || data.players?.length || 0;
  if (dom.playerCount) dom.playerCount.textContent = count;
  
  if (data.players) {
    state.players = data.players;
    renderLeaderboard();
  }
}

function handleLeaderboardUpdate(data) {
  if (data.topPlayers) {
    state.players = data.topPlayers;
    renderLeaderboard();
  }
}

function handlePhaseChange(data) {
  state.phase = data.phase;
  updateGameControlButtons();
}

function renderLeaderboard() {
  if (!dom.leaderboardList) return;
  
  // Sort by score
  const sorted = [...state.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  if (sorted.length === 0) {
    dom.leaderboardList.innerHTML = '<div class="leaderboard-empty">Noch keine Spieler</div>';
  } else {
    dom.leaderboardList.innerHTML = sorted.map((player, index) => {
      const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
      return `
        <div class="leaderboard-item">
          <span class="leaderboard-rank">${medal}</span>
          <span class="leaderboard-name">${escapeHtml(player.name)}</span>
          <span class="leaderboard-score">${player.score || 0}</span>
        </div>
      `;
    }).join('');
  }
  
  if (dom.leaderboardCount) {
    dom.leaderboardCount.textContent = `${sorted.length} Spieler`;
  }
}

// ============================================================
// DRAG & DROP
// ============================================================
function handleDragStart(e, id) {
  state.draggedGameImage = id;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // Find container and add class
  const container = e.target.closest('.game-card-container');
  if (container && !container.classList.contains('dragging')) {
    // Remove from others
    document.querySelectorAll('.game-card-container.drag-over').forEach(c => c.classList.remove('drag-over'));
    container.classList.add('drag-over');
  }
}

function handleDrop(e, targetId) {
  e.preventDefault();
  document.querySelectorAll('.game-card-container.drag-over').forEach(c => c.classList.remove('drag-over'));
  
  if (state.draggedGameImage && state.draggedGameImage !== targetId) {
    reorderGameImages(state.draggedGameImage, targetId);
  }
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.game-card-container.drag-over').forEach(c => c.classList.remove('drag-over'));
  state.draggedGameImage = null;
}

async function reorderGameImages(fromId, toId) {
  const fromIdx = state.gameImages.findIndex(g => g.id === fromId);
  const toIdx = state.gameImages.findIndex(g => g.id === toId);
  
  if (fromIdx === -1 || toIdx === -1) return;
  
  const [removed] = state.gameImages.splice(fromIdx, 1);
  state.gameImages.splice(toIdx, 0, removed);
  
  const order = state.gameImages.map(g => g.id);
  await authFetch('/api/game-images/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  
  renderGameStrip();
}

// ============================================================
// API HELPERS
// ============================================================
async function updateGameImageAnswer(id, answer) {
  await authFetch(`/api/game-images/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correctAnswer: answer })
  });
}

async function removeGameImage(id) {
  // Bug-010 fix: Reset selection if deleted image was selected
  const wasSelected = state.gameImages.find(g => g.id === id)?.id === state.selectedGameImageId;
  
  await authFetch(`/api/game-images/${id}`, { method: 'DELETE' });
  
  if (wasSelected) {
    // Reset to next unplayed image after deletion
    const nextUnplayed = state.gameImages.find(g => g.id !== id && !g.is_played);
    if (nextUnplayed) {
      state.selectedGameImageId = nextUnplayed.id;
    } else {
      state.selectedGameImageId = null;
      state.canvasImage = null;
      drawEmptyState();
    }
  }
  
  loadImages();
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (state.sidebarOpen) {
    sidebar?.classList.add('open');
    if (!overlay) {
      const newOverlay = document.createElement('div');
      newOverlay.id = 'sidebar-overlay';
      newOverlay.className = 'sidebar-overlay';
      newOverlay.addEventListener('click', closeSidebar);
      document.body.appendChild(newOverlay);
    }
    document.getElementById('sidebar-overlay')?.classList.add('visible');
    renderSidebar();
  } else {
    closeSidebar();
  }
}

function closeSidebar() {
  state.sidebarOpen = false;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

function renderSidebar() {
  const poolContainer = document.getElementById('image-pool');
  if (!poolContainer) return;
  
  // Filtering
  const filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
  
  let images = [...state.imagePool];
  
  const inGameIds = state.gameImages.map(g => g.image_id);
  
  if (filter === 'unused') {
    images = images.filter(img => !inGameIds.includes(img.id) && !img.is_start_image && !img.is_end_image);
  } else if (filter === 'ingame') {
    images = images.filter(img => inGameIds.includes(img.id) || img.is_start_image || img.is_end_image);
  }
  
  if (images.length === 0) {
    poolContainer.innerHTML = '<div class="pool-empty">Keine Bilder gefunden</div>';
  } else {
    poolContainer.innerHTML = images.map(img => {
      const url = img.url || `/uploads/${img.filename}`;
      const inGame = inGameIds.includes(img.id);
      const isStart = img.is_start_image;
      const isEnd = img.is_end_image;
      
      // Determine classes based on Rahmen-System
      let itemClasses = ['pool-item'];
      if (isStart) itemClasses.push('is-start');
      if (isEnd) itemClasses.push('is-end');
      if (inGame && !isStart && !isEnd) itemClasses.push('in-game');
      
      // Badges: ⭐ oben links, 🏁 oben rechts
      let badges = '';
      if (isStart) badges += '<span class="pool-badge badge-start">⭐</span>';
      if (isEnd) badges += '<span class="pool-badge badge-end">🏁</span>';
      if (inGame && !isStart && !isEnd) badges += '<span class="pool-badge badge-ingame">✓</span>';
      
      return `
        <div class="${itemClasses.join(' ')}" data-id="${img.id}" data-filename="${img.filename}">
          <img class="pool-thumb" src="${url}" alt="${img.answer || ''}" loading="lazy">
          ${badges}
          <div class="pool-answer">${img.answer || '...'}</div>
        </div>
      `;
    }).join('');
    
    // Event listeners are now delegated from the parent (Bug-008 fix)
  }
  
  // Update stats
  updatePoolStats();
}

function updatePoolStats() {
  if (!dom.poolStats) return;
  
  const total = state.imagePool.length;
  const inGame = state.gameImages.length;
  const startEnd = state.imagePool.filter(img => img.is_start_image || img.is_end_image).length;
  
  dom.poolStats.textContent = `${total} Bilder | ${inGame + startEnd} im Spiel`;
}

// Add all free images to game
async function addAllFreeImages() {
  const inGameIds = state.gameImages.map(g => g.image_id);
  const freeImages = state.imagePool.filter(img => 
    !inGameIds.includes(img.id) && !img.is_start_image && !img.is_end_image
  );
  
  if (freeImages.length === 0) {
    toast('Keine freien Bilder verfügbar', 'info');
    return;
  }
  
  let added = 0;
  for (const img of freeImages) {
    try {
      const res = await authFetch('/api/game-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: img.id })
      });
      if (res.ok) added++;
    } catch (error) {
      // Silently continue with other images
    }
  }
  
  if (added > 0) {
    toast(`${added} Bild(er) hinzugefügt`, 'success');
  } else {
    toast('Keine Bilder konnten hinzugefügt werden', 'warning');
  }
  loadImages();
}

function showContextMenu(e, item) {
  e.preventDefault();
  const menu = document.getElementById('image-context-menu');
  if (!menu) return;
  
  const id = parseInt(item.dataset.id);
  const img = state.imagePool.find(i => i.id === id);
  
  state.contextMenuTarget = {
    id: id,
    filename: item.dataset.filename
  };
  
  // Check if image is in game
  const inGame = state.gameImages.some(g => g.image_id === id);
  const hasRole = img?.is_start_image || img?.is_end_image;
  
  // Show/hide appropriate menu items
  const addItem = menu.querySelector('[data-action="add-to-game"]');
  const removeItem = menu.querySelector('[data-action="remove-from-game"]');
  const clearRoleItem = menu.querySelector('[data-action="clear-role"]');
  
  if (addItem) addItem.style.display = inGame || hasRole ? 'none' : 'flex';
  if (removeItem) removeItem.style.display = inGame ? 'flex' : 'none';
  if (clearRoleItem) clearRoleItem.style.display = hasRole ? 'flex' : 'none';
  
  // Position menu
  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - 250);
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'block';
}

function hideContextMenu() {
  const menu = document.getElementById('image-context-menu');
  if (menu) menu.style.display = 'none';
  state.contextMenuTarget = null;
}

async function handleContextMenuAction(action) {
  if (!state.contextMenuTarget) return;
  
  const { id, filename } = state.contextMenuTarget;
  
  switch (action) {
    case 'add-to-game':
      await addImageToGame(id);
      break;
    case 'remove-from-game':
      await removeImageFromGame(id);
      break;
    case 'set-start':
      await setSpecialImage(id, 'start');
      break;
    case 'set-end':
      await setSpecialImage(id, 'end');
      break;
    case 'clear-role':
      await clearImageRole(id);
      break;
    case 'delete':
      if (confirm('Bild wirklich löschen?')) {
        await deleteImage(id);
      }
      break;
  }
  
  hideContextMenu();
}

// Remove image from game (by pool image id)
async function removeImageFromGame(imageId) {
  const gameImage = state.gameImages.find(g => g.image_id === imageId);
  if (gameImage) {
    await removeGameImage(gameImage.id);
    toast('Bild aus Spiel entfernt', 'success');
  }
}

async function addImageToGame(imageId) {
  // Bug-007 fix: Prevent adding start/end images to game
  const img = state.imagePool.find(i => i.id === imageId);
  if (img && (img.is_start_image || img.is_end_image)) {
    toast('Bild kann nicht hinzugefügt werden: Es ist bereits als Start- oder End-Bild gesetzt', 'warning');
    return;
  }
  
  try {
    const res = await authFetch('/api/game-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId })
    });
    
    if (res.ok) {
      toast('Bild zum Spiel hinzugefügt', 'success');
      loadImages();
    } else {
      toast('Fehler beim Hinzufügen des Bildes', 'error');
    }
  } catch (error) {
    toast('Fehler beim Hinzufügen des Bildes', 'error');
  }
}

async function setSpecialImage(imageId, type) {
  // Bug-007 fix: Prevent setting start/end if image is in game
  const inGame = state.gameImages.some(g => g.image_id === imageId);
  if (inGame) {
    toast('Bild kann nicht als Start/End gesetzt werden: Es ist bereits im Spiel', 'warning');
    return;
  }
  
  try {
    const endpoint = `/api/images/${imageId}/set-${type}`;
    const res = await authFetch(endpoint, {
      method: 'PATCH'
    });
    
    if (res.ok) {
      toast(`${type === 'start' ? 'Start' : 'End'}bild gesetzt`, 'success');
      loadImages();
    } else {
      const data = await res.json();
      toast(data.message || 'Fehler', 'error');
    }
  } catch (error) {
    toast('Fehler beim Setzen des Bildes', 'error');
  }
}

async function clearImageRole(imageId) {
  try {
    const res = await authFetch(`/api/images/${imageId}/clear-role`, {
      method: 'PATCH'
    });
    
    if (res.ok) {
      toast('Rolle entfernt', 'success');
      loadImages();
    } else {
      const data = await res.json();
      toast(data.message || 'Fehler', 'error');
    }
  } catch (error) {
    toast('Fehler beim Entfernen der Rolle', 'error');
  }
}

function editImageAnswer(imageId) {
  const img = state.imagePool.find(i => i.id === imageId);
  if (!img) return;
  
  const answer = prompt('Antwort eingeben:', img.answer || '');
  if (answer === null) return;
  
  updateImageAnswer(imageId, answer);
}

async function updateImageAnswer(imageId, answer) {
  try {
    await authFetch(`/api/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    });
    
    const img = state.imagePool.find(i => i.id === imageId);
    if (img) img.answer = answer;
    
    renderSidebar();
  } catch (error) {
    toast('Fehler beim Aktualisieren der Antwort', 'error');
  }
}

async function deleteImage(imageId) {
  try {
    await authFetch(`/api/images/${imageId}`, { method: 'DELETE' });
    toast('Bild gelöscht', 'success');
    loadImages();
  } catch (error) {
    toast('Fehler beim Löschen des Bildes', 'error');
  }
}

// ============================================================
// UPLOAD
// ============================================================
function setupUpload() {
  const input = document.getElementById('image-upload');
  const uploadLabel = document.querySelector('.upload-label');
  const progress = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');
  
  // File input change event
  input?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    await uploadFiles(files);
    input.value = '';
  });
  
  // Drag & Drop on upload label
  if (uploadLabel) {
    uploadLabel.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadLabel.classList.add('drag-over');
    });
    
    uploadLabel.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadLabel.classList.remove('drag-over');
    });
    
    uploadLabel.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadLabel.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) {
        toast('Keine Bild-Dateien gefunden', 'warning');
        return;
      }
      
      await uploadFiles(files);
    });
  }
  
  async function uploadFiles(files) {
    progress?.classList.remove('hidden');
    
    let uploaded = 0;
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      
      try {
        await authFetch('/api/images/upload', {
          method: 'POST',
          body: formData
        });
        uploaded++;
      } catch (error) {
        // Continue with remaining files
      }
      
      const percent = Math.round((uploaded / files.length) * 100);
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}%`;
    }
    
    progress?.classList.add('hidden');
    toast(`${uploaded} Bild(er) hochgeladen`, 'success');
    loadImages();
  }
}

// ============================================================
// TOASTS
// ============================================================
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-fade');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// MODALS
// ============================================================
async function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal?.classList.remove('hidden');
  
  // Load current player URL from state or generate
  const playerUrl = state.playerJoinUrl || `${window.location.origin}/player.html`;
  const playerUrlInput = document.getElementById('player-url');
  if (playerUrlInput) playerUrlInput.value = playerUrl;
  
  // Copy button
  document.getElementById('copy-player-url')?.addEventListener('click', () => {
    navigator.clipboard.writeText(playerUrl);
    toast('Link kopiert!', 'success');
  }, { once: true }); // Prevent duplicate listeners
  
  // Update PIN UI state
  const pinEnabledCheckbox = document.getElementById('pin-enabled');
  if (pinEnabledCheckbox) pinEnabledCheckbox.checked = state.pinEnabled;
  
  // Load wordlist from server
  await loadWordlist();
  
  // Load scoring settings
  loadScoringSettings();
  
  // Reset to first tab
  switchSettingsTab('general');
}

/**
 * Load wordlist from server (GET /api/words)
 */
async function loadWordlist() {
  try {
    const res = await authFetch('/api/words');
    const data = await res.json();
    
    if (data.success && Array.isArray(data.data)) {
      const wordlistTextarea = document.getElementById('wordlist');
      if (wordlistTextarea) {
        wordlistTextarea.value = data.data.join('\n');
      }
    }
  } catch (error) {
    toast('Fehler beim Laden der Wortliste', 'warning');
  }
}

function openHelpModal() {
  const modal = document.getElementById('help-modal');
  modal?.classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
}

function setupModals() {
  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.closeModal);
    });
  });
  
  // Click outside to close
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
      }
    });
  });
  
  // Save settings
  document.getElementById('save-settings')?.addEventListener('click', saveSettings);
  
  // Restart Game
  document.getElementById('confirm-restart-game')?.addEventListener('click', restartGame);
  
  // Danger actions
  document.getElementById('btn-soft-reset')?.addEventListener('click', softReset);
  document.getElementById('btn-complete-reset')?.addEventListener('click', completeReset);
  document.getElementById('btn-restart-server')?.addEventListener('click', restartServer);
  document.getElementById('btn-factory-reset')?.addEventListener('click', factoryReset);
}

// Settings Tabs
function setupSettingsTabs() {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchSettingsTab(tab.dataset.tab);
    });
  });
  
  // PIN Protection Toggle - triggers immediately via Socket
  document.getElementById('pin-enabled')?.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    window.socketAdapter?.emit('admin:toggle_protection', { enabled }, (res) => {
      if (res?.success) {
        toast(enabled ? 'PIN-Schutz aktiviert (2h)' : 'PIN-Schutz deaktiviert', 'success');
        // State will be updated via admin:protection_changed event
      } else {
        e.target.checked = !enabled; // Revert on error
        toast('Fehler: ' + (res?.message || 'Änderung fehlgeschlagen'), 'error');
      }
    });
  });
  
  // Scoring preview updates
  document.getElementById('base-points')?.addEventListener('input', updateScoringPreview);
  document.getElementById('speed-bonus-enabled')?.addEventListener('change', (e) => {
    const speedSettings = document.getElementById('speed-bonus-settings');
    if (speedSettings) speedSettings.style.display = e.target.checked ? 'block' : 'none';
    updateScoringPreview();
  });
  document.getElementById('speed-bonus-percent')?.addEventListener('input', updateScoringPreview);
}

function switchSettingsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  
  // Update panels
  document.querySelectorAll('.settings-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tabName);
  });
}

/**
 * Load scoring settings from server
 */
async function loadScoringSettings() {
  try {
    const res = await authFetch('/api/settings');
    const data = await res.json();
    
    if (data.success && data.data?.scoring) {
      const scoring = data.data.scoring;
      
      const basePoints = document.getElementById('base-points');
      const speedEnabled = document.getElementById('speed-bonus-enabled');
      const speedPercent = document.getElementById('speed-bonus-percent');
      
      if (basePoints) basePoints.value = scoring.basePointsPerCorrect || 100;
      if (speedEnabled) speedEnabled.checked = scoring.speedBonusEnabled ?? false;
      if (speedPercent) speedPercent.value = scoring.speedBonusMaxPoints || 50;
      
      // Show/hide speed settings
      const speedSettings = document.getElementById('speed-bonus-settings');
      if (speedSettings) {
        speedSettings.style.display = scoring.speedBonusEnabled ? 'block' : 'none';
      }
    }
  } catch (error) {
    // Use defaults on error
    const basePoints = document.getElementById('base-points');
    const speedEnabled = document.getElementById('speed-bonus-enabled');
    const speedPercent = document.getElementById('speed-bonus-percent');
    
    if (basePoints) basePoints.value = 100;
    if (speedEnabled) speedEnabled.checked = false;
    if (speedPercent) speedPercent.value = 50;
  }
  
  updateScoringPreview();
}

function updateScoringPreview() {
  const base = parseInt(document.getElementById('base-points')?.value) || 100;
  const speedEnabled = document.getElementById('speed-bonus-enabled')?.checked;
  const speedPercent = parseInt(document.getElementById('speed-bonus-percent')?.value) || 50;
  
  const maxPoints = speedEnabled ? Math.round(base * (1 + speedPercent / 100)) : base;
  
  const previewMax = document.getElementById('preview-max');
  const previewMin = document.getElementById('preview-min');
  
  if (previewMax) previewMax.textContent = maxPoints;
  if (previewMin) previewMin.textContent = base;
}

// Factory Reset Confirmation
function setupFactoryResetConfirmation() {
  const checkbox = document.getElementById('factory-confirm-checkbox');
  const input = document.getElementById('factory-confirm-input');
  const button = document.getElementById('btn-factory-reset');
  
  const updateButtonState = () => {
    const checkboxOk = checkbox?.checked;
    const inputOk = input?.value.toUpperCase() === 'LICHT AUS';
    if (button) button.disabled = !(checkboxOk && inputOk);
  };
  
  checkbox?.addEventListener('change', updateButtonState);
  input?.addEventListener('input', updateButtonState);
}

async function saveSettings() {
  const wordlist = document.getElementById('wordlist')?.value || '';
  const newPin = document.getElementById('admin-pin-setting')?.value?.trim();
  
  let success = true;
  
  try {
    // Save wordlist via REST API (PUT /api/words)
    const words = wordlist.split('\n').map(w => w.trim()).filter(w => w);
    const wordRes = await authFetch('/api/words', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words })
    });
    
    if (!wordRes.ok) {
      toast('Fehler beim Speichern der Wörterliste', 'error');
      success = false;
    }
    
    // Save PIN via Socket if changed (admin:update_pin)
    if (newPin && newPin.length >= 4) {
      window.socketAdapter?.emit('admin:update_pin', { pin: newPin }, (res) => {
        if (res?.success) {
          state.currentPin = newPin;
          document.getElementById('admin-pin-setting').value = ''; // Clear input
          toast('PIN aktualisiert', 'success');
        } else {
          toast('Fehler beim PIN-Update: ' + (res?.message || 'Unbekannt'), 'error');
        }
      });
    }
    
    // Save scoring settings via REST API (PUT /api/settings)
    const basePoints = parseInt(document.getElementById('base-points')?.value) || 100;
    const speedBonusEnabled = document.getElementById('speed-bonus-enabled')?.checked ?? false;
    const speedBonusMaxPoints = parseInt(document.getElementById('speed-bonus-percent')?.value) || 50;
    
    const scoringRes = await authFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scoring: {
          basePointsPerCorrect: basePoints,
          speedBonusEnabled: speedBonusEnabled,
          speedBonusMaxPoints: speedBonusMaxPoints
        }
      })
    });
    
    if (!scoringRes.ok) {
      toast('Fehler beim Speichern der Punkte-Einstellungen', 'error');
      success = false;
    }
    
    if (success) {
      toast('Einstellungen gespeichert', 'success');
      closeModal('settings-modal');
    }
  } catch (error) {
    toast('Fehler beim Speichern', 'error');
  }
}

async function softReset() {
  if (!confirm('Soft Reset durchführen? Punkte und Spielstatus werden zurückgesetzt.')) return;
  
  window.socketAdapter?.emit('admin:reset_game_soft', {}, (response) => {
    if (response?.success) {
      toast('Soft Reset durchgeführt', 'success');
      state.phase = 'lobby';
      state.players = [];
      loadImages();
      updateGameControlButtons();
      renderLeaderboard();
      closeSettingsModal();
    } else {
      toast('Fehler beim Reset: ' + (response?.message || 'Unbekannt'), 'error');
    }
  });
}

async function completeReset() {
  if (!confirm('Complete Reset durchführen? Alle Bilder werden aus dem Spiel entfernt.')) return;
  
  window.socketAdapter?.emit('admin:reset_complete', {}, (response) => {
    if (response?.success) {
      toast('Complete Reset durchgeführt', 'success');
      state.phase = 'lobby';
      state.gameImages = [];
      state.players = [];
      loadImages();
      closeSettingsModal();
    } else {
      toast('Fehler beim Reset: ' + (response?.message || 'Unbekannt'), 'error');
    }
  });
}

async function restartServer() {
  if (!confirm('Server wirklich neustarten? Alle Verbindungen werden getrennt.')) return;
  
  toast('Server wird neugestartet...', 'info');
  
  window.socketAdapter?.emit('admin:restart_server', {}, (response) => {
    // Response may not arrive if server restarts quickly
    if (response?.success) {
      toast('Server-Neustart eingeleitet', 'success');
    }
  });
  
  // Wait and reload (server will restart)
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}

async function factoryReset() {
  // Double-check: Button should only be enabled if both checkbox and input are valid
  const checkbox = document.getElementById('factory-confirm-checkbox');
  const input = document.getElementById('factory-confirm-input');
  
  if (!checkbox?.checked || input?.value.toUpperCase() !== 'LICHT AUS') {
    toast('Bitte Bestätigung ausfüllen', 'error');
    return;
  }
  
  window.socketAdapter?.emit('admin:factory_reset', {}, (response) => {
    if (response?.success) {
      toast('Factory Reset durchgeführt', 'success');
      
      // Reset the confirmation inputs
      if (checkbox) checkbox.checked = false;
      if (input) input.value = '';
      document.getElementById('btn-factory-reset').disabled = true;
      
      setTimeout(() => window.location.reload(), 1000);
    } else {
      toast('Fehler beim Reset: ' + (response?.message || 'Unbekannt'), 'error');
    }
  });
}

// ============================================================
// HEADER ACTIONS
// ============================================================
function openBeamer() {
  const url = `/beamer.html?token=${URL_TOKEN}`;
  window.open(url, '_blank');
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function handleKeyboard(e) {
  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  // Escape to close modals/sidebar/context menu - always allowed
  if (e.key === 'Escape') {
    e.preventDefault();
    hideContextMenu();
    if (state.sidebarOpen) closeSidebar();
    closeAllModals();
    return;
  }
  
  // Check if any modal is open - block other shortcuts
  const settingsModal = document.getElementById('settings-modal');
  const helpModal = document.getElementById('help-modal');
  const modalOpen = !settingsModal?.classList.contains('hidden') || 
                    !helpModal?.classList.contains('hidden');
  if (modalOpen) return;
  
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (state.phase === 'lobby') startGame();
      else if (state.phase === 'playing') {
        revealImage();
        // Reveal beendet Cinema Mode
        if (state.cinemaMode) exitCinemaMode();
      }
      break;
    case 'Enter':
      e.preventDefault();
      if (state.phase === 'revealed') nextImage();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      selectPrevImage();
      break;
    case 'ArrowRight':
      e.preventDefault();
      selectNextImage();
      break;
    case 'KeyK':
      e.preventDefault();
      // Toggle Kino-Automatik
      if (dom.cinemaAutoToggle) {
        dom.cinemaAutoToggle.checked = !dom.cinemaAutoToggle.checked;
        handleCinemaAutoToggle();
      }
      break;
    case 'KeyQ':
      e.preventDefault();
      // Toggle QR-Code Anzeige
      if (dom.qrToggle) {
        dom.qrToggle.checked = !dom.qrToggle.checked;
        toggleQR();
      }
      break;
    case 'KeyB':
      e.preventDefault();
      openBeamer();
      break;
    case 'KeyS':
      e.preventDefault();
      openSettingsModal();
      break;
    case 'KeyH':
      e.preventDefault();
      openHelpModal();
      break;
    case 'KeyC':
      e.preventDefault();
      clearSpotlights();
      break;
  }
}

function closeAllModals() {
  const modals = document.querySelectorAll('.modal-backdrop');
  modals.forEach(m => m.classList.add('hidden'));
}

function selectPrevImage() {
  // Bug-011 fix: Only select unplayed images
  const unplayedImages = state.gameImages.filter(g => !g.is_played);
  if (unplayedImages.length === 0) return;
  
  const currentIdx = unplayedImages.findIndex(g => g.id === state.selectedGameImageId);
  if (currentIdx > 0) {
    selectGameImage(unplayedImages[currentIdx - 1].id);
  } else if (currentIdx === -1 && unplayedImages.length > 0) {
    // If current selection is not in unplayed list, select first unplayed
    selectGameImage(unplayedImages[0].id);
  }
}

function selectNextImage() {
  // Bug-011 fix: Only select unplayed images
  const unplayedImages = state.gameImages.filter(g => !g.is_played);
  if (unplayedImages.length === 0) return;
  
  const currentIdx = unplayedImages.findIndex(g => g.id === state.selectedGameImageId);
  if (currentIdx >= 0 && currentIdx < unplayedImages.length - 1) {
    selectGameImage(unplayedImages[currentIdx + 1].id);
  } else if (currentIdx === -1 && unplayedImages.length > 0) {
    // If current selection is not in unplayed list, select first unplayed
    selectGameImage(unplayedImages[0].id);
  }
}

function showHelp() {
  openHelpModal();
}

// ============================================================
// STRIP SCROLL
// ============================================================
function scrollStrip(amount) {
  if (dom.stripScroll) {
    dom.stripScroll.scrollBy({ left: amount, behavior: 'smooth' });
    // Update button states after scroll animation completes
    setTimeout(updateScrollButtons, SMOOTH_SCROLL_DURATION);
  }
}

// Bug-014 fix: Update scroll button disabled states
function updateScrollButtons() {
  if (!dom.stripScroll || !dom.stripNavLeft || !dom.stripNavRight) return;
  
  const { scrollLeft, scrollWidth, clientWidth } = dom.stripScroll;
  const maxScroll = scrollWidth - clientWidth;
  
  // Disable left button if at start
  dom.stripNavLeft.disabled = scrollLeft <= 0;
  
  // Disable right button if at end (with tolerance for rounding)
  dom.stripNavRight.disabled = scrollLeft >= maxScroll - SCROLL_TOLERANCE;
}

// Add scroll event listener to update buttons in real-time
if (dom.stripScroll) {
  dom.stripScroll.addEventListener('scroll', updateScrollButtons);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// EXPORTS FOR DEBUGGING
// ============================================================
window.__adminNew = {
  state,
  loadImages,
  renderGameStrip,
  renderLeaderboard
};
