/**
 * Admin Client
 * 
 * Administrative interface for LichtBlick game management
 */

// State
let currentPhase = 'lobby';
let currentImageId = null;
let spotlightEnabled = false;
let spotlightSize = 80;
let spotlightStrength = 100; // Prozent Transparenz pro Klick (100 = volle Aufdeckung)
let spotlightFocus = 70; // Prozent des Radius mit voller Stärke (Gradient beginnt ab hier)
let isDrawing = false;
let lastSpotlightSend = 0;
const SPOTLIGHT_THROTTLE = 50; // 20 updates per second

// Spotlight State - speichert alle Klick-Positionen
let spotlightClicks = []; // Array von {x, y, size, strength, focus} - normalisierte Koordinaten
let showRevealOverlay = false; // Grünes Overlay für aufgedeckte Bereiche

// Image Management State
let imagePool = []; // All uploaded images
let gameImages = []; // Images assigned to current game
let contextMenuTarget = null; // Currently right-clicked image
let draggedGameImage = null; // For drag & drop reordering
let selectedGameImageId = null; // Currently selected game image for playing

// Canvas setup
const canvas = document.getElementById('spotlight-canvas');
const ctx = canvas.getContext('2d');
let canvasImage = null;

// 🔐 URL Token - Required for admin access
function getUrlToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

const URL_TOKEN = getUrlToken();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupCanvas();
  setupEventListeners();
  setupSocketListeners();
  updateConnectionStatus();
  setupAuth();
  // Persist host to DB for beamer QR generation
  const host = window.location.host;
  window.socketAdapter.emit('admin:set_join_host', { host });
  // Auto-auth if PIN stored
  const storedPin = sessionStorage.getItem('adminPin');
  if (storedPin) {
    window.socketAdapter.emit('admin:auth', { pin: storedPin, token: URL_TOKEN }, async (res) => {
      if (res.success) {
        hideAuth();
        // Also get/refresh REST API token if not present
        if (!sessionStorage.getItem('adminToken')) {
          try {
            const tokenRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin: storedPin })
            });
            const tokenData = await tokenRes.json();
            if (tokenData.success && tokenData.data?.token) {
              sessionStorage.setItem('adminToken', tokenData.data.token);
            }
          } catch (e) {
            console.warn('Could not get API token:', e);
          }
        }
      }
    });
  }
});

function setupCanvas() {
  canvas.width = 800;
  canvas.height = 600;
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '20px Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('Lade ein Bild um Spotlight zu zeichnen', canvas.width/2, canvas.height/2);
}

function setupEventListeners() {
  // PIN Management
    // PIN update
    const pinForm = document.getElementById('pin-update-form');
    pinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('new-admin-pin').value.trim();
      if (val.length < 4 || val.length > 10) {
        showPinFeedback('PIN ungültig (4-10 Zeichen)', true);
        return;
      }
      updatePin(val);
      document.getElementById('new-admin-pin').value = '';
    });

    // Protection toggle
    document.getElementById('admin-protection-toggle').addEventListener('change', (e) => {
      const enabled = e.target.checked;
      window.socketAdapter.emit('admin:toggle_protection', { enabled }, (res) => {
        if (res.success) {
          updateProtectionStatus(enabled);
        } else {
          e.target.checked = !enabled; // revert
          showPinFeedback('Änderung fehlgeschlagen', true);
        }
      });
    });

    document.getElementById('refresh-qr-btn').addEventListener('click', () => {
      // Force regenerate QR from current host
      const host = window.location.host;
      generateQRCode(`http://${host}/player.html`);
    });
  function showPinFeedback(msg, isError = false) {
    const fb = document.getElementById('pin-feedback');
    fb.textContent = msg;
    fb.className = 'pin-feedback' + (isError ? ' error' : '');
    fb.style.display = 'block';
    setTimeout(() => fb.style.display = 'none', 2500);
  }
  
  // Image Upload
  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('upload-area');
  
  fileInput.addEventListener('change', handleFileSelect);
  uploadArea.addEventListener('dragover', handleDragOver);
  uploadArea.addEventListener('drop', handleDrop);
  
  // Game Controls
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('reveal-image-btn').addEventListener('click', revealImage);
  document.getElementById('next-image-btn').addEventListener('click', nextImage);
  document.getElementById('end-game-btn').addEventListener('click', endGame);
  document.getElementById('qr-toggle').addEventListener('change', toggleQR);
  
  // Spotlight Controls
  document.getElementById('spotlight-toggle').addEventListener('change', toggleSpotlight);
  document.getElementById('spotlight-size').addEventListener('input', updateSpotlightSize);
  document.getElementById('spotlight-strength').addEventListener('input', updateSpotlightStrength);
  document.getElementById('spotlight-focus').addEventListener('input', updateSpotlightFocus);
  document.getElementById('reveal-overlay-toggle').addEventListener('change', toggleRevealOverlay);
  
  // Lade gespeicherte Spotlight-Einstellungen
  loadSpotlightSettings();;
  document.getElementById('clear-spotlights-btn').addEventListener('click', clearAllSpotlights);
  
  // Canvas Drawing
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('click', handleCanvasClick);
  
  // Touch support
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
  
  // Danger Zone
  setupDangerZone();
}

function setupAuth() {
  const form = document.getElementById('auth-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('admin-pin').value.trim();
    if (pin.length < 4) {
      showAuthError('PIN zu kurz');
      return;
    }
    window.socketAdapter.emit('admin:auth', { pin, token: URL_TOKEN }, async (res) => {
      if (res.success) {
        hideAuth();
        // Also get REST API token
        try {
          const tokenRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
          });
          const tokenData = await tokenRes.json();
          if (tokenData.success && tokenData.data?.token) {
            sessionStorage.setItem('adminToken', tokenData.data.token);
          }
        } catch (e) {
          console.warn('Could not get API token:', e);
        }
        loadImages();
        try { sessionStorage.setItem('adminPin', pin); } catch {}
      } else {
        showAuthError(res.message || 'PIN falsch');
      }
    });
  });
}

/**
 * 🔐 Authenticated fetch wrapper
 * Automatically adds Bearer token to requests
 */
async function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken');
  const headers = {
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add Content-Type for JSON requests if not already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle 401 - token expired
  if (response.status === 401) {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminPin');
    alert('Session abgelaufen. Bitte erneut einloggen.');
    location.reload();
    throw new Error('Unauthorized');
  }
  
  return response;
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuth() {
  document.getElementById('auth-screen').classList.add('hidden');
}

function setupSocketListeners() {
  const socket = window.socketAdapter;
  
  // Connection
  window.addEventListener('socket:connected', () => {
    updateConnectionStatus(true);
    // Send URL token for admin access validation
    // If protection is disabled, server will accept connect without auth
    // If URL token is valid, server auto-admits to admin room
    socket.emit('admin:connect', { token: URL_TOKEN });
  });
  
  window.addEventListener('socket:disconnected', () => {
    updateConnectionStatus(false);
  });
  
  // Game events
  socket.on('game:lobby_update', handleLobbyUpdate);
  socket.on('game:phase_change', handlePhaseChange);
  socket.on('game:leaderboard_update', handleLeaderboardUpdate);
  socket.on('admin:pin_generated', handlePinGenerated);
  socket.on('admin:initial_state', handleAdminInitialState);
  socket.on('beamer:qr_state', handleQrStateUpdate);
  
  // Auth events
  socket.on('admin:auth_required', handleAuthRequired);
  
  // Admin session count updates
  socket.on('admin:session_count', handleAdminSessionCount);
}

/**
 * Handle auth required event from server
 * Shows appropriate message based on what's needed (token vs PIN)
 */
function handleAuthRequired({ message, needsToken, needsPin }) {
  const authScreen = document.getElementById('auth-screen');
  const authError = document.getElementById('auth-error');
  const authForm = document.getElementById('auth-form');
  
  authScreen.classList.remove('hidden');
  
  if (needsToken) {
    // Invalid or missing URL token - show error, hide PIN form
    authError.textContent = message || 'Ungültiger Admin-Link. Bitte verwende den korrekten Admin-Link aus der Server-Konsole.';
    authError.classList.remove('hidden');
    authForm.style.display = 'none';
    
    // Add helpful hint
    const hint = document.createElement('p');
    hint.style.cssText = 'color: #666; font-size: 14px; margin-top: 15px; text-align: center;';
    hint.innerHTML = '💡 <strong>Tipp:</strong> Der Admin-Link wird beim Server-Start in der Konsole angezeigt.';
    if (!document.getElementById('auth-hint')) {
      hint.id = 'auth-hint';
      authError.parentNode.appendChild(hint);
    }
  } else if (needsPin) {
    // Token valid but PIN required
    authError.textContent = '';
    authError.classList.add('hidden');
    authForm.style.display = 'block';
    // Remove any previous hint
    const hint = document.getElementById('auth-hint');
    if (hint) hint.remove();
  }
}

/**
 * Handle admin session count updates
 * Shows warning if multiple admins are connected
 */
function handleAdminSessionCount({ count, warning }) {
  updateAdminSessionDisplay(count, warning);
}

/**
 * Update the admin session count display in the UI
 */
function updateAdminSessionDisplay(count, warning = null) {
  let indicator = document.getElementById('admin-session-indicator');
  
  // Create indicator if it doesn't exist
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'admin-session-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(indicator);
  }
  
  if (count > 1) {
    // Warning: Multiple admins
    indicator.style.backgroundColor = '#ff9800';
    indicator.style.color = '#000';
    indicator.innerHTML = `
      <span style="font-size: 18px;">⚠️</span>
      <span>${count} Admin-Sitzungen</span>
    `;
    indicator.title = warning || 'Mehrere Admin-Fenster sind geöffnet!';
  } else if (count === 1) {
    // Normal: Single admin
    indicator.style.backgroundColor = '#4caf50';
    indicator.style.color = '#fff';
    indicator.innerHTML = `
      <span style="font-size: 18px;">👤</span>
      <span>1 Admin</span>
    `;
    indicator.title = 'Du bist der einzige Admin';
  } else {
    // No admins (shouldn't happen)
    indicator.style.display = 'none';
    return;
  }
  
  indicator.style.display = 'flex';
}

// PIN Management
// Update PIN
function updatePin(pin) {
  window.socketAdapter.emit('admin:update_pin', { pin }, (res) => {
    const fb = document.getElementById('pin-feedback');
    if (res.success) {
      fb.textContent = 'PIN aktualisiert';
      fb.className = 'pin-feedback';
      fb.style.display = 'block';
      displayCurrentPin(pin);
      setTimeout(() => fb.style.display = 'none', 2500);
    } else {
      fb.textContent = res.message || 'Fehler';
      fb.className = 'pin-feedback error';
      fb.style.display = 'block';
      setTimeout(() => fb.style.display = 'none', 3000);
    }
  });
}

function displayCurrentPin(pin) {
  const pinDisplay = document.getElementById('current-pin');
  pinDisplay.innerHTML = `
    <div class="pin-box">
      <div class="pin-label">Aktuelle PIN:</div>
      <div class="pin-value">${pin}</div>
    </div>
  `;
  pinDisplay.style.display = 'block';
}

function generateQRCode(url) {
  const qrContainer = document.getElementById('qr-code-container');
  const qrUrl = document.getElementById('qr-url');
  qrUrl.textContent = url;
  qrContainer.style.display = 'block';

  // Use goqr.me API to render QR code into canvas (fallback to img if CORS blocks)
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  const canvas = document.getElementById('qr-code');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width = 200;
    canvas.height = 200;
    ctx.drawImage(img, 0, 0, 200, 200);
  };
  img.onerror = () => {
    // Fallback: draw simple message
    canvas.width = 200;
    canvas.height = 200;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,200,200);
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR konnte', 100, 90);
    ctx.fillText('nicht geladen werden', 100, 110);
  };
  img.src = apiUrl;
}

function handlePinGenerated(data) {
  displayCurrentPin(data.pin);
  generateQRCode(data.joinUrl);
}

function handleAdminInitialState(payload) {
  if (!payload?.success) return;
  const { pin, qr, protection, players, playerCount, game, currentImageId: serverImageId, adminSessionCount } = payload.data || {};
  
  // Spielphase aus Server-Daten übernehmen
  if (game && game.status) {
    currentPhase = game.status;
    
    // Bei laufendem Spiel: Phase auf 'playing' oder 'revealed' setzen
    // Je nachdem ob das aktuelle Bild schon gespielt wurde
    if (game.status === 'playing' && serverImageId) {
      currentImageId = serverImageId;
    }
    
    updateGameControlButtons(currentPhase);
  }
  
  // Update player list and count from initial state (DB data)
  if (players) {
    updatePlayerList(players);
    document.getElementById('player-count').textContent = playerCount || players.length;
  }
  
  if (pin) {
    displayCurrentPin(pin.pin);
    // Always use plain player URL without token
    const host = window.location.host;
    generateQRCode(`http://${host}/player.html`);
  }
  if (qr && typeof qr.enabled === 'boolean') {
    document.getElementById('qr-toggle').checked = qr.enabled;
  }
  if (protection) {
    document.getElementById('admin-protection-toggle').checked = !!protection.enabled;
    updateProtectionStatus(!!protection.enabled);
    updateProtectionCountdown(protection.expiresAt);
    // If protection disabled hide auth overlay automatically
    if (!protection.enabled) {
      hideAuth();
      loadImages(); // Load images when protection is disabled
    }
  }
  
  // Update admin session count display
  if (adminSessionCount !== undefined) {
    const warning = adminSessionCount > 1 ? '⚠️ Mehrere Admin-Sitzungen aktiv!' : null;
    updateAdminSessionDisplay(adminSessionCount, warning);
  }
}

function handleQrStateUpdate(data) {
  if (data.enabled && data.url) {
    document.getElementById('qr-toggle').checked = true;
    generateQRCode(data.url);
  } else {
    document.getElementById('qr-toggle').checked = false;
  }
}

// Protection toggle
function updateProtectionStatus(enabled) {
  const status = document.getElementById('protection-status');
  status.textContent = 'Status: ' + (enabled ? 'aktiv' : 'inaktiv');
  status.style.color = enabled ? 'var(--success)' : 'var(--warning)';
}

let countdownInterval = null;
function updateProtectionCountdown(expiresAt) {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  const status = document.getElementById('protection-status');
  if (!expiresAt) return;
  countdownInterval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, expiresAt - now);
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    status.textContent = `Status: aktiv – läuft ab in ${h}h ${m}m ${s}s`;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      status.textContent = 'Status: inaktiv';
    }
  }, 1000);
}

// Image Upload
async function loadImages() {
  try {
    // Load all data first, then render
    const [poolRes, gameRes, wordsRes] = await Promise.all([
      fetch('/api/images'),
      fetch('/api/game-images'),
      fetch('/api/words')
    ]);
    
    const [poolData, gameData, wordsData] = await Promise.all([
      poolRes.json(),
      gameRes.json(),
      wordsRes.json()
    ]);
    
    // Update state
    if (poolData.success) {
      imagePool = poolData.data;
    }
    
    if (gameData.success) {
      gameImages = gameData.data;
      
      // Bei laufendem Spiel: Aktuelles Bild vom Server vorauswählen und laden
      if (currentImageId && currentPhase === 'playing') {
        const currentGI = gameImages.find(g => g.image_id === currentImageId);
        if (currentGI) {
          selectedGameImageId = currentGI.id;
          loadImageToCanvas(currentImageId);
        }
      }
      // Sonst: Erstes ungespieltes Bild vorauswählen, falls keins ausgewählt
      else if (!selectedGameImageId) {
        const firstUnplayed = gameImages.find(g => !g.is_played);
        if (firstUnplayed) {
          selectedGameImageId = firstUnplayed.id;
        }
      }
    }
    
    // Now render with all data available
    renderImagePool();
    renderGameImages();
    updateImageSelect(gameImages);
    
    // Button-Zustände initialisieren basierend auf aktuellem Status
    updateGameControlButtons(currentPhase);
    
    if (wordsData.success) {
      document.getElementById('word-list-textarea').value = wordsData.data.join('\n');
    }
  } catch (error) {
    console.error('Failed to load images:', error);
  }
}

function renderImagePool() {
  const container = document.getElementById('image-pool');
  container.innerHTML = '';
  
  if (imagePool.length === 0) {
    container.innerHTML = '<p class="empty-state">Keine Bilder hochgeladen</p>';
    return;
  }
  
  // Get IDs of images in game
  const gameImageIds = gameImages.map(gi => gi.image_id);
  
  imagePool.forEach(img => {
    const div = document.createElement('div');
    div.className = 'pool-image';
    div.dataset.id = img.id;
    
    // Add classes for roles
    if (img.is_start_image) div.classList.add('is-start');
    if (img.is_end_image) div.classList.add('is-end');
    if (gameImageIds.includes(img.id)) div.classList.add('in-game');
    
    // Badges - show both if image is both start and end
    let badges = '';
    if (img.is_start_image && img.is_end_image) {
      badges = '<span class="badge start">START</span><span class="badge end">END</span>';
    } else if (img.is_start_image) {
      badges = '<span class="badge start">START</span>';
    } else if (img.is_end_image) {
      badges = '<span class="badge end">END</span>';
    } else if (gameImageIds.includes(img.id)) {
      badges = '<span class="badge game">IM SPIEL</span>';
    }
    
    div.innerHTML = `
      ${badges}
      <img src="${img.url}" alt="${img.filename}">
      <button class="delete-btn" onclick="deletePoolImage(${img.id}, event)">×</button>
    `;
    
    // Right-click context menu
    div.addEventListener('contextmenu', (e) => showContextMenu(e, img));
    
    container.appendChild(div);
  });
}

function renderGameImages() {
  const container = document.getElementById('game-images-strip');
  container.innerHTML = '';
  
  if (gameImages.length === 0) {
    container.innerHTML = '<p class="empty-state">Keine Bilder im Spiel. Füge Bilder aus dem Pool hinzu.</p>';
    return;
  }
  
  gameImages.forEach((gi, index) => {
    const card = document.createElement('div');
    card.className = 'game-image-card';
    card.dataset.id = gi.id;
    card.draggable = !gi.is_played; // Gespielte Bilder nicht mehr verschiebbar
    
    if (gi.is_played) card.classList.add('is-played');
    if (gi.id === selectedGameImageId) card.classList.add('selected');
    
    const isDisabled = gi.is_played ? 'disabled' : '';
    const radioLabel = gi.is_played ? '✓ Gespielt' : 'Nächstes';
    
    card.innerHTML = `
      <button class="game-image-delete" onclick="removeGameImage(${gi.id})" title="Entfernen" ${isDisabled}>×</button>
      <img src="${gi.url}" alt="${gi.filename}">
      <div class="card-body">
        <span class="order-badge">#${index + 1}</span>
        <input type="text" class="answer-input" 
               placeholder="Antwort..." 
               value="${gi.correct_answer || ''}"
               onchange="updateGameImageAnswer(${gi.id}, this.value)"
               ${isDisabled}>
        <div class="card-actions">
          <label class="select-radio ${gi.is_played ? 'played' : ''}">
            <input type="radio" name="current-image" 
                   ${gi.id === selectedGameImageId ? 'checked' : ''}
                   ${isDisabled}
                   onchange="selectGameImage(${gi.id})">
            ${radioLabel}
          </label>
        </div>
      </div>
    `;
    
    // Drag & Drop
    card.addEventListener('dragstart', (e) => {
      draggedGameImage = gi.id;
      card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedGameImage = null;
    });
    
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedGameImage && draggedGameImage !== gi.id) {
        reorderGameImages(draggedGameImage, gi.id);
      }
    });
    
    container.appendChild(card);
  });
}

// Context Menu
function showContextMenu(e, img) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('showContextMenu called for image:', img);
  contextMenuTarget = img;
  
  const menu = document.getElementById('image-context-menu');
  if (!menu) {
    console.error('Context menu element not found!');
    return;
  }
  
  // Update button labels based on current state (toggle behavior)
  const startBtn = menu.querySelector('[data-action="set-start"]');
  const endBtn = menu.querySelector('[data-action="set-end"]');
  
  if (startBtn) {
    startBtn.textContent = img.is_start_image ? '⭐ Start-Bild entfernen' : '⭐ Als Start-Bild';
  }
  if (endBtn) {
    endBtn.textContent = img.is_end_image ? '🏁 End-Bild entfernen' : '🏁 Als End-Bild';
  }
  
  // Show/hide "Add to game" option based on image type
  const addToGameBtn = menu.querySelector('[data-action="add-to-game"]');
  if (addToGameBtn) {
    if (img.is_start_image || img.is_end_image) {
      addToGameBtn.style.display = 'none';
    } else {
      addToGameBtn.style.display = 'block';
    }
  }
  
  // Hide "Clear role" if no role is set
  const clearRoleBtn = menu.querySelector('[data-action="clear-role"]');
  if (clearRoleBtn) {
    if (img.is_start_image || img.is_end_image) {
      clearRoleBtn.style.display = 'block';
    } else {
      clearRoleBtn.style.display = 'none';
    }
  }
  
  // Use clientX/clientY for fixed positioning (viewport-relative)
  menu.style.display = 'block';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  // Make sure menu stays within viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 10}px`;
  }
  
  console.log('Context menu displayed at:', e.clientX, e.clientY);
}

function hideContextMenu() {
  const menu = document.getElementById('image-context-menu');
  menu.style.display = 'none';
  contextMenuTarget = null;
}

// Setup context menu listeners
document.addEventListener('DOMContentLoaded', () => {
  // Hide context menu on any click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });
  
  // Context menu button handlers
  const menu = document.getElementById('image-context-menu');
  menu.querySelectorAll('.context-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!contextMenuTarget) {
        console.error('No contextMenuTarget set');
        hideContextMenu();
        return;
      }
      
      const action = btn.dataset.action;
      const imageId = contextMenuTarget.id; // contextMenuTarget is the image object with .id property
      
      console.log('Context menu action:', action, 'for image:', imageId);
      
      try {
        let response;
        switch (action) {
          case 'set-start':
            // Toggle: if already start, clear it; otherwise set it
            if (contextMenuTarget.is_start_image) {
              response = await authFetch(`/api/images/${imageId}/clear-start`, { method: 'PATCH' });
              console.log('clear-start response:', response.status);
            } else {
              response = await authFetch(`/api/images/${imageId}/set-start`, { method: 'PATCH' });
              console.log('set-start response:', response.status);
            }
            break;
          case 'set-end':
            // Toggle: if already end, clear it; otherwise set it
            if (contextMenuTarget.is_end_image) {
              response = await authFetch(`/api/images/${imageId}/clear-end`, { method: 'PATCH' });
              console.log('clear-end response:', response.status);
            } else {
              response = await authFetch(`/api/images/${imageId}/set-end`, { method: 'PATCH' });
              console.log('set-end response:', response.status);
            }
            break;
          case 'add-to-game':
            await addImageToGame(imageId);
            break;
          case 'clear-role':
            response = await authFetch(`/api/images/${imageId}/clear-role`, { method: 'PATCH' });
            console.log('clear-role response:', response.status);
            break;
          case 'delete':
            if (confirm('Bild wirklich löschen?')) {
              response = await authFetch(`/api/images/${imageId}`, { method: 'DELETE' });
              console.log('delete response:', response.status);
            }
            break;
        }
      } catch (err) {
        console.error('Context menu action failed:', err);
      }
      
      hideContextMenu();
      loadImages();
    });
  });
  
  // Add all to game button
  document.getElementById('add-all-to-game-btn').addEventListener('click', addAllImagesToGame);
  
  // Word list save
  document.getElementById('save-words-btn').addEventListener('click', saveWordList);
  
  // Reset played
  document.getElementById('reset-played-btn').addEventListener('click', resetPlayedImages);
});

async function addImageToGame(imageId) {
  // Check if image is start or end image
  const img = imagePool.find(i => i.id === parseInt(imageId));
  if (img && (img.is_start_image || img.is_end_image)) {
    alert('Start- und End-Bilder können nicht zum Spiel hinzugefügt werden.');
    return;
  }
  
  const answer = prompt('Richtige Antwort für dieses Bild:');
  if (answer === null) return; // User cancelled
  
  try {
    const res = await authFetch('/api/game-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: parseInt(imageId), correctAnswer: answer })
    });
    
    if (!res.ok) {
      const data = await res.json();
      if (data.message) alert(data.message);
    }
  } catch (err) {
    console.error('Failed to add image to game:', err);
  }
}

async function addAllImagesToGame() {
  // Get IDs of images already in game
  const gameImageIds = gameImages.map(gi => gi.image_id);
  
  // Filter images not yet in game (and not start/end images)
  const imagesToAdd = imagePool.filter(img => 
    !gameImageIds.includes(img.id) && 
    !img.is_start_image && 
    !img.is_end_image
  );
  
  if (imagesToAdd.length === 0) {
    alert('Alle Bilder sind bereits im Spiel oder als Start/End markiert.');
    return;
  }
  
  // Add each image
  for (const img of imagesToAdd) {
    try {
      await authFetch('/api/game-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: img.id, correctAnswer: '' })
      });
    } catch (err) {
      console.error('Failed to add image:', img.id, err);
    }
  }
  
  alert(`${imagesToAdd.length} Bilder hinzugefügt. Bitte Antworten eintragen!`);
  loadImages();
}

async function removeGameImage(id) {
  await authFetch(`/api/game-images/${id}`, { method: 'DELETE' });
  loadImages();
}

async function updateGameImageAnswer(id, answer) {
  await authFetch(`/api/game-images/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correctAnswer: answer })
  });
}

function selectGameImage(id) {
  selectedGameImageId = id;
  renderGameImages();
  
  // Load to canvas
  const gi = gameImages.find(g => g.id === id);
  if (gi) {
    currentImageId = gi.image_id;
    loadImageToCanvas(gi.image_id);
    
    // Notify server
    window.socketAdapter.emit('admin:select_image', { imageId: gi.image_id });
  }
}

async function reorderGameImages(fromId, toId) {
  // Find indices
  const fromIdx = gameImages.findIndex(g => g.id === fromId);
  const toIdx = gameImages.findIndex(g => g.id === toId);
  
  if (fromIdx === -1 || toIdx === -1) return;
  
  // Reorder locally
  const [removed] = gameImages.splice(fromIdx, 1);
  gameImages.splice(toIdx, 0, removed);
  
  // Send new order to server
  const order = gameImages.map(g => g.id);
  await authFetch('/api/game-images/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  
  loadImages();
}

async function resetPlayedImages() {
  await authFetch('/api/game-images/reset-played', { method: 'POST' });
  loadImages();
}

async function saveWordList() {
  const text = document.getElementById('word-list-textarea').value;
  const words = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
  
  const res = await authFetch('/api/words', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words })
  });
  
  if (res.ok) {
    alert('Wörterliste gespeichert!');
  }
}

async function deletePoolImage(imageId, e) {
  e.stopPropagation();
  if (!confirm('Bild wirklich löschen?')) return;
  
  await authFetch(`/api/images/${imageId}`, { method: 'DELETE' });
  loadImages();
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  uploadFiles(files);
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('dragover');
  
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  uploadFiles(files);
}

async function uploadFiles(files) {
  if (files.length === 0) return;
  
  const progressBar = document.getElementById('upload-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  progressBar.style.display = 'block';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await authFetch('/api/images/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!data.success) {
        alert(`Fehler beim Upload von ${file.name}: ${data.message}`);
      }
      
      const progress = ((i + 1) / files.length) * 100;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Fehler beim Upload von ${file.name}`);
    }
  }
  
  setTimeout(() => {
    progressBar.style.display = 'none';
    loadImages();
  }, 500);
}

function updateImageSelect(images) {
  // Dropdown entfernt - die Auswahl erfolgt jetzt über die Spiel-Bilder-Karten
  // Diese Funktion bleibt für Kompatibilität, macht aber nichts mehr
}

async function deleteImage(imageId) {
  // Legacy - now handled by deletePoolImage
  await deletePoolImage(imageId, { stopPropagation: () => {} });
}

// Game Controls
function startGame() {
  // Finde das erste ungespielte Bild oder das manuell ausgewählte
  let targetGI = null;
  
  if (selectedGameImageId) {
    targetGI = gameImages.find(g => g.id === selectedGameImageId && !g.is_played);
  }
  
  // Falls kein gültiges ausgewählt, nimm das erste ungespielte
  if (!targetGI) {
    targetGI = gameImages.find(g => !g.is_played);
  }
  
  if (!targetGI) {
    alert('Keine ungespielten Bilder vorhanden');
    return;
  }
  
  window.socketAdapter.emit('admin:start_game', { imageId: targetGI.image_id }, (response) => {
    if (response.success) {
      console.log('Game started');
      currentImageId = targetGI.image_id;
      selectedGameImageId = targetGI.id;
      loadImageToCanvas(targetGI.image_id);
      
      // UI-Status aktualisieren
      updateGameControlButtons('playing');
      renderGameImages();
    } else {
      alert('Fehler beim Starten: ' + response.message);
    }
  });
}

// Bild aufdecken und werten
function revealImage() {
  const selectedGI = gameImages.find(g => g.id === selectedGameImageId);
  
  if (!selectedGI) {
    alert('Kein aktives Bild zum Aufdecken');
    return;
  }
  
  // Server: Bild aufdecken, Wertung auslösen, als gespielt markieren
  window.socketAdapter.emit('admin:reveal_image', { imageId: selectedGI.image_id }, (response) => {
    if (response && response.success) {
      console.log('Image revealed and scored');
      
      // Lokal als gespielt markieren
      selectedGI.is_played = 1;
      
      // Canvas komplett aufdecken (schwarze Maske entfernen)
      redrawCanvasRevealed();
      
      // UI aktualisieren: Reveal deaktivieren, Nächstes Bild aktivieren
      updateGameControlButtons('revealed');
      renderGameImages();
      
      // Nächstes ungespieltes Bild vorauswählen
      preselectNextImage();
    } else {
      alert('Fehler beim Aufdecken: ' + (response?.message || 'Unbekannt'));
    }
  });
}

// Nächstes ungespieltes Bild vorauswählen (für "Nächstes Bild" Button)
function preselectNextImage() {
  const nextUnplayed = gameImages.find(g => !g.is_played);
  if (nextUnplayed) {
    selectedGameImageId = nextUnplayed.id;
    renderGameImages();
  }
}

// Canvas ohne Maske anzeigen (Bild komplett aufgedeckt)
function redrawCanvasRevealed() {
  if (!canvasImage) return;
  
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const scale = Math.min(canvas.width / canvasImage.width, canvas.height / canvasImage.height);
  const x = (canvas.width - canvasImage.width * scale) / 2;
  const y = (canvas.height - canvasImage.height * scale) / 2;
  
  ctx.drawImage(canvasImage, x, y, canvasImage.width * scale, canvasImage.height * scale);
}

function nextImage() {
  // Nutze das vorausgewählte nächste Bild
  const nextGI = gameImages.find(g => g.id === selectedGameImageId && !g.is_played);
  
  if (!nextGI) {
    // Suche alternativ das erste ungespielte
    const firstUnplayed = gameImages.find(g => !g.is_played);
    if (!firstUnplayed) {
      alert('Keine weiteren ungespielten Bilder vorhanden. Beende das Spiel.');
      return;
    }
    selectedGameImageId = firstUnplayed.id;
  }
  
  const targetGI = gameImages.find(g => g.id === selectedGameImageId);
  
  window.socketAdapter.emit('admin:next_image', { imageId: targetGI.image_id }, (response) => {
    if (response.success) {
      currentImageId = targetGI.image_id;
      loadImageToCanvas(targetGI.image_id);
      
      // UI: Reveal aktivieren, Nächstes Bild deaktivieren
      updateGameControlButtons('playing');
      renderGameImages();
    } else {
      alert('Fehler: ' + response.message);
    }
  });
}

function endGame() {
  if (!confirm('Spiel wirklich beenden?')) return;
  
  window.socketAdapter.emit('admin:end_game', {}, (response) => {
    if (response.success) {
      console.log('Game ended');
      updateGameControlButtons('ended');
    } else {
      alert('Fehler: ' + response.message);
    }
  });
}

// Button-Zustände basierend auf Spielphase aktualisieren
function updateGameControlButtons(phase) {
  const startBtn = document.getElementById('start-game-btn');
  const revealBtn = document.getElementById('reveal-image-btn');
  const nextBtn = document.getElementById('next-image-btn');
  const endBtn = document.getElementById('end-game-btn');
  
  const hasUnplayedImages = gameImages.some(g => !g.is_played);
  
  switch(phase) {
    case 'lobby':
      // Vor Spielstart
      startBtn.disabled = !hasUnplayedImages;
      revealBtn.disabled = true;
      nextBtn.disabled = true;
      endBtn.disabled = true;
      break;
      
    case 'playing':
      // Bild wird gerade gespielt (Spotlight aktiv)
      startBtn.disabled = true;
      revealBtn.disabled = false;
      nextBtn.disabled = true;
      endBtn.disabled = true;
      break;
      
    case 'revealed':
      // Bild wurde aufgedeckt, warte auf nächstes oder Ende
      startBtn.disabled = true;
      revealBtn.disabled = true;
      nextBtn.disabled = !hasUnplayedImages;
      endBtn.disabled = false;
      break;
      
    case 'ended':
      // Spiel beendet
      startBtn.disabled = true;
      revealBtn.disabled = true;
      nextBtn.disabled = true;
      endBtn.disabled = true;
      break;
  }
  
  // Phase-Indicator aktualisieren
  const phaseIndicator = document.getElementById('phase-indicator');
  const phaseLabels = {
    'lobby': 'Lobby',
    'playing': 'Bild aktiv',
    'revealed': 'Aufgedeckt',
    'ended': 'Beendet'
  };
  phaseIndicator.textContent = phaseLabels[phase] || phase;
}

function loadSelectedImage() {
  // Diese Funktion wird jetzt über selectGameImage aufgerufen
  const selectedGI = gameImages.find(g => g.id === selectedGameImageId);
  if (!selectedGI) {
    alert('Bitte wähle ein Bild in den Spiel-Bildern aus');
    return;
  }
  
  currentImageId = selectedGI.image_id;
  loadImageToCanvas(selectedGI.image_id);
  
  window.socketAdapter.emit('admin:select_image', { imageId: selectedGI.image_id });
}

function loadImageToCanvas(imageId) {
  // Find image in pool or game images
  const poolImage = imagePool.find(img => img.id == imageId);
  const gameImage = gameImages.find(gi => gi.image_id == imageId);
  
  const imageUrl = poolImage?.url || gameImage?.url;
  
  if (!imageUrl) return;
  
  const img = new Image();
  img.onload = () => {
    canvasImage = img;
    redrawCanvas();
  };
  img.src = imageUrl;
}

function toggleQR(e) {
  const enabled = e.target.checked;
  window.socketAdapter.emit('admin:toggle_qr', { enabled });
}

// Spotlight
function toggleSpotlight(e) {
  spotlightEnabled = e.target.checked;
  if (!spotlightEnabled) {
    window.socketAdapter.emit('admin:clear_spotlight');
  }
  redrawCanvas();
}

function toggleRevealOverlay(e) {
  showRevealOverlay = e.target.checked;
  redrawCanvas();
}

function clearAllSpotlights() {
  spotlightClicks = [];
  window.socketAdapter.emit('admin:clear_spotlight');
  redrawCanvas();
}

function updateSpotlightSize(e) {
  spotlightSize = parseInt(e.target.value);
  document.getElementById('spotlight-size-value').textContent = `${spotlightSize}px`;
  saveSpotlightSettings();
}

function updateSpotlightStrength(e) {
  spotlightStrength = parseInt(e.target.value);
  document.getElementById('spotlight-strength-value').textContent = `${spotlightStrength}%`;
  saveSpotlightSettings();
}

function updateSpotlightFocus(e) {
  spotlightFocus = parseInt(e.target.value);
  document.getElementById('spotlight-focus-value').textContent = `${spotlightFocus}%`;
  saveSpotlightSettings();
}

// Speichere Spotlight-Einstellungen in localStorage
function saveSpotlightSettings() {
  try {
    localStorage.setItem('spotlightSettings', JSON.stringify({
      size: spotlightSize,
      strength: spotlightStrength,
      focus: spotlightFocus
    }));
  } catch (e) { /* ignore */ }
}

// Lade Spotlight-Einstellungen aus localStorage und synchronisiere UI
function loadSpotlightSettings() {
  try {
    const saved = localStorage.getItem('spotlightSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      spotlightSize = settings.size ?? 80;
      spotlightStrength = settings.strength ?? 100;
      spotlightFocus = settings.focus ?? 70;
    }
  } catch (e) { /* ignore */ }
  
  // Synchronisiere UI mit den geladenen Werten
  const sizeSlider = document.getElementById('spotlight-size');
  const strengthSlider = document.getElementById('spotlight-strength');
  const focusSlider = document.getElementById('spotlight-focus');
  
  if (sizeSlider) {
    sizeSlider.value = spotlightSize;
    document.getElementById('spotlight-size-value').textContent = `${spotlightSize}px`;
  }
  if (strengthSlider) {
    strengthSlider.value = spotlightStrength;
    document.getElementById('spotlight-strength-value').textContent = `${spotlightStrength}%`;
  }
  if (focusSlider) {
    focusSlider.value = spotlightFocus;
    document.getElementById('spotlight-focus-value').textContent = `${spotlightFocus}%`;
  }
}

function startDrawing(e) {
  if (!spotlightEnabled || !canvasImage) return;
  isDrawing = true;
  draw(e);
}

// Berechne Bild-Dimensionen für Koordinaten-Umrechnung
function getImageBounds() {
  if (!canvasImage) return null;
  const scale = Math.min(canvas.width / canvasImage.width, canvas.height / canvasImage.height);
  const imgX = (canvas.width - canvasImage.width * scale) / 2;
  const imgY = (canvas.height - canvasImage.height * scale) / 2;
  const imgW = canvasImage.width * scale;
  const imgH = canvasImage.height * scale;
  return { imgX, imgY, imgW, imgH };
}

// Wandelt Canvas-Koordinaten in Bild-relative Koordinaten um
function canvasToImageCoords(canvasX, canvasY) {
  const bounds = getImageBounds();
  if (!bounds) return null;
  
  // Berechne Position relativ zum Bild (0-1)
  const x = (canvasX - bounds.imgX) / bounds.imgW;
  const y = (canvasY - bounds.imgY) / bounds.imgH;
  
  // Clamp auf gültigen Bereich
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y))
  };
}

// Klick fixiert einen Spotlight
function handleCanvasClick(e) {
  if (!spotlightEnabled || !canvasImage) return;
  
  const rect = canvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  const coords = canvasToImageCoords(canvasX, canvasY);
  if (!coords) return;
  
  const bounds = getImageBounds();
  const size = spotlightSize / bounds.imgW; // Größe relativ zur Bildbreite
  const strength = spotlightStrength / 100; // 0-1
  const focus = spotlightFocus / 100; // 0-1
  
  // Speichere Klick-Position (relativ zum Bild) mit Stärke und Fokus
  spotlightClicks.push({ x: coords.x, y: coords.y, size, strength, focus });
  
  // Sende an Server/Beamer
  window.socketAdapter.emit('admin:spotlight_click', { x: coords.x, y: coords.y, size, strength, focus });
  
  redrawCanvas();
}

function draw(e) {
  if (!isDrawing || !spotlightEnabled || !canvasImage) return;
  
  const rect = canvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  const coords = canvasToImageCoords(canvasX, canvasY);
  if (!coords) return;
  
  const bounds = getImageBounds();
  const size = spotlightSize / bounds.imgW; // Größe relativ zur Bildbreite
  const strength = spotlightStrength / 100; // 0-1
  const focus = spotlightFocus / 100; // 0-1
  
  // Throttle socket updates
  const now = Date.now();
  if (now - lastSpotlightSend >= SPOTLIGHT_THROTTLE) {
    window.socketAdapter.emit('admin:spotlight', {
      x: coords.x, y: coords.y,
      size, strength, focus
    });
    lastSpotlightSend = now;
  }
  
  // Zeichne mit Maus-Position (temporär)
  redrawCanvas({ x: coords.x, y: coords.y, size, strength, focus });
}

function stopDrawing() {
  isDrawing = false;
  redrawCanvas(); // Nur fixierte Spotlights anzeigen
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}

function redrawCanvas(mouseSpot = null) {
  if (!canvasImage) return;
  
  // Nutze gemeinsame Render-Logik mit Admin-Einstellungen (preview=true)
  SpotlightRenderer.render({
    ctx: ctx,
    image: canvasImage,
    spotlights: spotlightClicks,
    mouseSpot: mouseSpot,
    isRevealed: false,
    preview: true,  // Admin: 80% Effekt
    highlight: showRevealOverlay  // Grünes Overlay optional
  });
}

// Event Handlers
function handleLobbyUpdate(data) {
  const count = data.totalPlayers || data.players?.length || 0;
  document.getElementById('player-count').textContent = count;
  
  if (data.players) {
    updatePlayerList(data.players);
  }
}

function updatePlayerList(players) {
  const container = document.getElementById('player-list');
  container.innerHTML = '';
  
  if (players.length === 0) {
    container.innerHTML = '<p class="empty-state">Keine Spieler in der Lobby</p>';
    return;
  }
  
  players.forEach(player => {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <span class="player-name">${player.name}</span>
      <span class="player-score">${player.score || 0} Punkte</span>
    `;
    container.appendChild(item);
  });
}

function handlePhaseChange(data) {
  currentPhase = data.phase;
  
  // Mappe Server-Phase auf UI-Phase
  let uiPhase = data.phase;
  if (data.phase === 'playing') {
    uiPhase = 'playing'; // Bild aktiv, Spotlight läuft
  }
  
  updateGameControlButtons(uiPhase);
}

function handleLeaderboardUpdate(data) {
  if (!data.topPlayers) return;
  
  const container = document.getElementById('leaderboard');
  container.innerHTML = '';
  
  if (data.topPlayers.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Punkte</p>';
    return;
  }
  
  data.topPlayers.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    
    item.innerHTML = `
      <span class="rank">${medal}</span>
      <span class="name">${player.name}</span>
      <span class="score">${player.score}</span>
    `;
    
    container.appendChild(item);
  });
}

function updateConnectionStatus(connected = window.socketAdapter?.isConnected()) {
  const status = document.getElementById('connection-status');
  if (connected) {
    status.textContent = '● Verbunden';
    status.className = 'connection-status connected';
  } else {
    status.textContent = '● Nicht verbunden';
    status.className = 'connection-status disconnected';
  }
}

// ==================== DANGER ZONE ====================

function setupDangerZone() {
  const details = document.getElementById('danger-zone-details');
  const content = document.getElementById('danger-zone-content');
  
  // Toggle mit Warnung beim Öffnen
  details.addEventListener('toggle', () => {
    if (details.open) {
      showConfirmModal({
        title: '⚠️ Gefahrenbereich öffnen',
        message: 'Du öffnest den Gefahrenbereich. Die Aktionen hier können Daten unwiderruflich löschen. Bist du sicher?',
        confirmText: 'Ja, ich weiß was ich tue',
        cancelText: 'Abbrechen',
        isDanger: false,
        onConfirm: () => {
          content.style.display = 'block';
        },
        onCancel: () => {
          details.open = false;
          content.style.display = 'none';
        }
      });
    } else {
      content.style.display = 'none';
    }
  });
  
  // Spiel zurücksetzen
  document.getElementById('reset-game-btn').addEventListener('click', () => {
    showConfirmModal({
      title: '🔄 Spiel zurücksetzen',
      message: 'Das aktuelle Spiel wird zurückgesetzt:\n• Status → Lobby\n• Alle Punkte → 0\n• Alle Antworten gelöscht\n• Alle Bilder → nicht gespielt\n\nSpieler und Bilder bleiben erhalten.',
      confirmText: 'Spiel zurücksetzen',
      requireInput: 'RESET',
      onConfirm: () => resetGame()
    });
  });
  
  // Komplett zurücksetzen
  document.getElementById('reset-complete-btn').addEventListener('click', () => {
    const includeRoles = document.getElementById('reset-complete-include-roles').checked;
    showConfirmModal({
      title: '🧹 Komplett zurücksetzen',
      message: `Alles wird zurückgesetzt:\n• Spiel → Lobby\n• Alle Punkte → 0\n• Alle Antworten gelöscht\n• Alle Spieler abgemeldet\n• Spiel-Bilder → zurück in Pool${includeRoles ? '\n• Start/End-Bilder → entfernt' : ''}`,
      confirmText: 'Komplett zurücksetzen',
      requireInput: 'KOMPLETT',
      onConfirm: () => resetComplete(includeRoles)
    });
  });
  
  // Server Restart
  document.getElementById('restart-server-btn').addEventListener('click', () => {
    showConfirmModal({
      title: '🔃 Server neustarten',
      message: 'Der Server wird neu gestartet.\n\nAlle Verbindungen werden kurz unterbrochen und sollten sich automatisch wieder verbinden.\n\nMöchtest du fortfahren?',
      confirmText: 'Neustarten',
      isDanger: false,
      onConfirm: () => restartServer()
    });
  });
  
  // Factory Reset
  document.getElementById('factory-reset-btn').addEventListener('click', () => {
    showConfirmModal({
      title: '💥 FACTORY RESET',
      message: '⚠️ ACHTUNG! ALLES wird gelöscht:\n• Datenbank komplett geleert\n• Alle Uploads gelöscht\n• Alle Einstellungen auf Standard\n• PIN wird auf "1234" zurückgesetzt\n\nDies kann NICHT rückgängig gemacht werden!',
      confirmText: 'FACTORY RESET',
      requireInput: 'FACTORY RESET',
      isDanger: true,
      onConfirm: () => factoryReset()
    });
  });
}

function showConfirmModal(options) {
  const {
    title,
    message,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    requireInput = null,
    isDanger = true,
    onConfirm,
    onCancel
  } = options;
  
  // Modal erstellen
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `
    <div class="confirm-modal-box ${isDanger ? 'danger' : ''}">
      <h3>${title}</h3>
      <p style="white-space: pre-line;">${message}</p>
      ${requireInput ? `
        <input type="text" class="confirm-input" placeholder='Tippe "${requireInput}" zur Bestätigung' />
      ` : ''}
      <div class="confirm-modal-buttons">
        <button class="btn btn-secondary cancel-btn">${cancelText}</button>
        <button class="btn btn-danger confirm-btn" ${requireInput ? 'disabled' : ''}>${confirmText}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const confirmBtn = modal.querySelector('.confirm-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const input = modal.querySelector('.confirm-input');
  
  // Input-Validierung
  if (input) {
    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.toUpperCase() !== requireInput.toUpperCase();
    });
    input.focus();
  }
  
  // Event Handlers
  confirmBtn.addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });
  
  // ESC zum Schließen
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function resetGame() {
  window.socketAdapter.emit('admin:reset_game_soft', {}, (response) => {
    if (response.success) {
      alert('✅ Spiel wurde zurückgesetzt!');
      location.reload();
    } else {
      alert('❌ Fehler: ' + (response.message || 'Unbekannt'));
    }
  });
}

function resetComplete(includeRoles) {
  window.socketAdapter.emit('admin:reset_complete', { includeStartEnd: includeRoles }, (response) => {
    if (response.success) {
      alert('✅ Komplett zurückgesetzt!');
      location.reload();
    } else {
      alert('❌ Fehler: ' + (response.message || 'Unbekannt'));
    }
  });
}

function restartServer() {
  // Zeige Lade-Overlay
  const overlay = document.createElement('div');
  overlay.id = 'restart-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:white;font-size:1.5rem;">
      <div style="animation:spin 1s linear infinite;font-size:3rem;margin-bottom:1rem;">🔄</div>
      <div>Server wird neu gestartet...</div>
      <div style="font-size:1rem;margin-top:0.5rem;opacity:0.7;">Bitte warten...</div>
    </div>
    <style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(overlay);
  
  window.socketAdapter.emit('admin:restart_server', {}, (response) => {
    // Server antwortet kurz bevor er neu startet
    if (response.success) {
      // Warte und versuche reconnect
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkConnection = () => {
        attempts++;
        if (window.socketAdapter.connected) {
          overlay.remove();
          alert('✅ Server erfolgreich neu gestartet!');
        } else if (attempts < maxAttempts) {
          setTimeout(checkConnection, 500);
        } else {
          overlay.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:white;font-size:1.5rem;">
              <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
              <div>Verbindung nicht wiederhergestellt</div>
              <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;font-size:1rem;cursor:pointer;">Seite neu laden</button>
            </div>
          `;
        }
      };
      
      // Kurz warten, dann reconnect prüfen
      setTimeout(checkConnection, 2000);
    } else {
      overlay.remove();
      alert('❌ Fehler: ' + (response.message || 'Unbekannt'));
    }
  });
}

function factoryReset() {
  window.socketAdapter.emit('admin:factory_reset', {}, (response) => {
    if (response.success) {
      alert('✅ Factory Reset durchgeführt! Die Seite wird neu geladen.');
      // Session Storage leeren (gespeicherte PIN)
      try { sessionStorage.clear(); } catch {}
      location.reload();
    } else {
      alert('❌ Fehler: ' + (response.message || 'Unbekannt'));
    }
  });
}

// Make functions globally available for onclick handlers
window.deleteImage = deleteImage;
window.deletePoolImage = deletePoolImage;
window.removeGameImage = removeGameImage;
window.updateGameImageAnswer = updateGameImageAnswer;
window.selectGameImage = selectGameImage;
