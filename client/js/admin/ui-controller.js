/**
 * UI Controller
 * Koordiniert alle UI-Komponenten und bindet sie an den State
 * 
 * @module ui-controller
 */

import state, { actions, selectors, subscribe } from './state.js';
import toast from './toast.js';
import { initModals, openSettings, openDangerZone } from './modals.js';
import { initKeyboard } from './keyboard.js';
import { initSidebar, loadImages as loadSidebarImages } from './sidebar.js';

// DOM-Referenzen (werden bei init gefüllt)
const dom = {
  // Header
  phaseBadge: null,
  connectionStatus: null,
  beamerStatus: null,
  playerCount: null,
  settingsBtn: null,
  dangerBtn: null,
  sidebarBtn: null,
  
  // Canvas
  canvas: null,
  spotlightToggle: null,
  spotlightSize: null,
  softEdgeToggle: null,
  
  // Leaderboard
  leaderboardList: null,
  
  // Game Strip
  gameStrip: null,
  stripScroll: null,
  stripNavLeft: null,
  stripNavRight: null,
  answerInput: null,
  
  // Controls
  revealBtn: null,
  buzzBtn: null,
  nextRoundBtn: null,
  activePlayerDisplay: null,
  scoreButtons: null,
  
  // Footer
  progressBar: null,
  progressLabel: null
};

/**
 * UI Controller initialisieren
 */
export function initUI() {
  // DOM-Referenzen sammeln
  collectDOMReferences();
  
  // Module initialisieren
  initModals();
  initKeyboard();
  initSidebar({
    onImageAdd: handleImageAdd,
    onImageDelete: handleImageDelete,
    onImageSelect: handleImageSelect
  });
  
  // Event Listeners einrichten
  setupEventListeners();
  
  // State subscription für reaktive Updates
  subscribe(handleStateChange);
  
  // Initial-Render
  render(state.getState());
  
  console.log('[UI] Initialized');
}

/**
 * DOM-Referenzen sammeln
 */
function collectDOMReferences() {
  // Header
  dom.phaseBadge = document.querySelector('.phase-badge');
  dom.connectionStatus = document.querySelector('.connection-status');
  dom.beamerStatus = document.querySelector('.beamer-status');
  dom.playerCount = document.querySelector('.player-count');
  dom.settingsBtn = document.querySelector('#btn-settings');
  dom.dangerBtn = document.querySelector('#btn-danger');
  dom.sidebarBtn = document.querySelector('#btn-sidebar');
  
  // Canvas
  dom.canvas = document.querySelector('#spotlight-canvas');
  dom.spotlightToggle = document.querySelector('#toggle-spotlight');
  dom.spotlightSize = document.querySelector('#spotlight-size');
  dom.softEdgeToggle = document.querySelector('#toggle-soft-edge');
  
  // Leaderboard
  dom.leaderboardList = document.querySelector('.leaderboard-list');
  
  // Game Strip
  dom.gameStrip = document.querySelector('.game-strip');
  dom.stripScroll = document.querySelector('.strip-scroll');
  dom.stripNavLeft = document.querySelector('.strip-nav-btn.left');
  dom.stripNavRight = document.querySelector('.strip-nav-btn.right');
  dom.answerInput = document.querySelector('.strip-answer-input');
  
  // Controls
  dom.revealBtn = document.querySelector('#btn-reveal');
  dom.buzzBtn = document.querySelector('#btn-buzz');
  dom.nextRoundBtn = document.querySelector('#btn-next-round');
  dom.activePlayerDisplay = document.querySelector('.active-player-display');
  dom.scoreButtons = document.querySelector('.score-buttons');
  
  // Footer
  dom.progressBar = document.querySelector('.progress-fill');
  dom.progressLabel = document.querySelector('.progress-label');
}

/**
 * Event Listeners einrichten
 */
function setupEventListeners() {
  // Header Buttons
  dom.settingsBtn?.addEventListener('click', () => openSettings());
  dom.dangerBtn?.addEventListener('click', () => openDangerZone());
  dom.sidebarBtn?.addEventListener('click', () => actions.toggleSidebar());
  
  // Spotlight Controls
  dom.spotlightToggle?.addEventListener('change', (e) => {
    actions.updateSpotlight({ visible: e.target.checked });
    emitSpotlightUpdate();
  });
  
  dom.spotlightSize?.addEventListener('input', (e) => {
    actions.updateSpotlight({ size: parseInt(e.target.value) });
    emitSpotlightUpdate();
  });
  
  dom.softEdgeToggle?.addEventListener('change', (e) => {
    actions.updateSpotlight({ softEdge: e.target.checked });
    emitSpotlightUpdate();
  });
  
  // Game Controls
  dom.revealBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('game:reveal'));
  });
  
  dom.buzzBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('game:simulateBuzz'));
  });
  
  dom.nextRoundBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('game:nextRound'));
  });
  
  // Score Buttons
  dom.scoreButtons?.querySelector('.btn-score-plus')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('game:awardPoint'));
  });
  
  dom.scoreButtons?.querySelector('.btn-score-minus')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('game:deductPoint'));
  });
  
  // Game Strip Navigation
  dom.stripNavLeft?.addEventListener('click', () => scrollStrip(-200));
  dom.stripNavRight?.addEventListener('click', () => scrollStrip(200));
  
  // Answer Input
  dom.answerInput?.addEventListener('change', (e) => {
    const currentState = state.getState();
    if (currentState.currentImage) {
      document.dispatchEvent(new CustomEvent('game:updateAnswer', {
        detail: { imageId: currentState.currentImage.id, answer: e.target.value }
      }));
    }
  });
  
  // Custom Events von anderen Modulen
  document.addEventListener('settings:changed', handleSettingsChanged);
  document.addEventListener('game:resetScores', handleResetScores);
  document.addEventListener('game:restart', handleRestartGame);
  document.addEventListener('game:deleteAllImages', handleDeleteAllImages);
  document.addEventListener('game:fullReset', handleFullReset);
}

/**
 * State-Änderungen verarbeiten
 */
function handleStateChange(newState, prevState) {
  // Nur relevante Teile neu rendern
  
  // Phase
  if (newState.phase !== prevState.phase) {
    renderPhase(newState.phase);
  }
  
  // Connection
  if (JSON.stringify(newState.connection) !== JSON.stringify(prevState.connection)) {
    renderConnection(newState.connection);
  }
  
  // Players
  if (JSON.stringify(newState.players) !== JSON.stringify(prevState.players)) {
    renderLeaderboard(selectors.getSortedPlayers());
  }
  
  // Active Player
  if (newState.activePlayer !== prevState.activePlayer) {
    renderActivePlayer(newState.activePlayer);
  }
  
  // Game Images
  if (JSON.stringify(newState.gameImages) !== JSON.stringify(prevState.gameImages)) {
    renderGameStrip(newState.gameImages, newState.currentImageIndex);
  }
  
  // Current Image
  if (newState.currentImage !== prevState.currentImage) {
    renderCurrentImage(newState.currentImage);
  }
  
  // Spotlight
  if (JSON.stringify(newState.spotlight) !== JSON.stringify(prevState.spotlight)) {
    renderSpotlightControls(newState.spotlight);
  }
  
  // Sidebar
  if (newState.ui.sidebarOpen !== prevState.ui.sidebarOpen) {
    document.querySelector('.sidebar')?.classList.toggle('open', newState.ui.sidebarOpen);
  }
  
  // Progress
  renderProgress();
}

/**
 * Kompletter Render (Initial)
 */
function render(currentState) {
  renderPhase(currentState.phase);
  renderConnection(currentState.connection);
  renderLeaderboard(selectors.getSortedPlayers());
  renderActivePlayer(currentState.activePlayer);
  renderGameStrip(currentState.gameImages, currentState.currentImageIndex);
  renderCurrentImage(currentState.currentImage);
  renderSpotlightControls(currentState.spotlight);
  renderProgress();
}

/**
 * Phase-Badge rendern
 */
function renderPhase(phase) {
  if (!dom.phaseBadge) return;
  
  const phaseLabels = {
    setup: '⚙️ Setup',
    active: '▶️ Aktiv',
    buzzer: '🔔 Buzzer',
    paused: '⏸️ Pause',
    ended: '🏁 Ende'
  };
  
  dom.phaseBadge.textContent = phaseLabels[phase] || phase;
  dom.phaseBadge.dataset.phase = phase;
  
  // Buttons aktivieren/deaktivieren basierend auf Phase
  if (dom.revealBtn) {
    dom.revealBtn.disabled = !['setup', 'active'].includes(phase);
  }
  if (dom.buzzBtn) {
    dom.buzzBtn.disabled = phase !== 'active';
  }
  if (dom.nextRoundBtn) {
    dom.nextRoundBtn.disabled = phase !== 'buzzer';
  }
}

/**
 * Verbindungsstatus rendern
 */
function renderConnection(connection) {
  if (dom.connectionStatus) {
    dom.connectionStatus.dataset.status = connection.socket ? 'connected' : 'disconnected';
    dom.connectionStatus.title = connection.socket ? 'Verbunden' : 'Nicht verbunden';
  }
  
  if (dom.beamerStatus) {
    dom.beamerStatus.dataset.status = connection.beamer ? 'connected' : 'disconnected';
    dom.beamerStatus.title = connection.beamer ? 'Beamer verbunden' : 'Beamer nicht verbunden';
  }
  
  if (dom.playerCount) {
    dom.playerCount.textContent = connection.playerCount;
  }
}

/**
 * Leaderboard rendern
 */
function renderLeaderboard(players) {
  if (!dom.leaderboardList) return;
  
  if (players.length === 0) {
    dom.leaderboardList.innerHTML = `
      <div class="leaderboard-empty">
        Noch keine Spieler
      </div>
    `;
    return;
  }
  
  dom.leaderboardList.innerHTML = players.map((player, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    const isActive = state.getState().activePlayer?.id === player.id;
    
    return `
      <div class="leaderboard-item ${isActive ? 'active' : ''}" data-player-id="${player.id}">
        <span class="leaderboard-rank">${medal}</span>
        <span class="leaderboard-name">${escapeHtml(player.name)}</span>
        <span class="leaderboard-score">${player.score}</span>
      </div>
    `;
  }).join('');
}

/**
 * Active Player rendern
 */
function renderActivePlayer(player) {
  if (!dom.activePlayerDisplay) return;
  
  const nameEl = dom.activePlayerDisplay.querySelector('.active-player-name');
  
  if (player) {
    nameEl.textContent = player.name;
    nameEl.classList.remove('active-player-none');
    dom.scoreButtons?.querySelectorAll('.btn-score').forEach(btn => btn.disabled = false);
  } else {
    nameEl.textContent = '—';
    nameEl.classList.add('active-player-none');
    dom.scoreButtons?.querySelectorAll('.btn-score').forEach(btn => btn.disabled = true);
  }
}

/**
 * Game Strip rendern
 */
function renderGameStrip(images, currentIndex) {
  if (!dom.stripScroll) return;
  
  if (images.length === 0) {
    dom.stripScroll.innerHTML = `
      <div class="strip-empty">
        Keine Bilder im Spiel. Füge Bilder über die Sidebar hinzu.
      </div>
    `;
    return;
  }
  
  dom.stripScroll.innerHTML = images.map((img, index) => `
    <div class="game-card ${index === currentIndex ? 'current' : ''} ${img.played ? 'played' : ''}"
         data-id="${img.id}" data-index="${index}">
      <img class="game-card-thumb" src="/uploads/${img.filename}" alt="${img.answer || ''}">
      <div class="game-card-footer">
        <span class="game-card-order">${index + 1}</span>
        ${img.played ? '<span class="game-card-check">✓</span>' : ''}
      </div>
      <button class="game-card-delete" title="Aus Spiel entfernen">×</button>
    </div>
  `).join('');
  
  // Event Listeners für Cards
  dom.stripScroll.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      document.dispatchEvent(new CustomEvent('game:selectImage', { detail: { index } }));
    });
    
    card.querySelector('.game-card-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(card.dataset.id);
      document.dispatchEvent(new CustomEvent('game:removeFromGame', { detail: { id } }));
    });
  });
  
  // Scroll zur aktuellen Karte
  if (currentIndex >= 0) {
    const currentCard = dom.stripScroll.querySelector(`.game-card[data-index="${currentIndex}"]`);
    currentCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/**
 * Aktuelles Bild rendern
 */
function renderCurrentImage(image) {
  if (dom.answerInput) {
    dom.answerInput.value = image?.answer || '';
    dom.answerInput.disabled = !image;
  }
}

/**
 * Spotlight Controls rendern
 */
function renderSpotlightControls(spotlight) {
  if (dom.spotlightToggle) {
    dom.spotlightToggle.checked = spotlight.visible;
  }
  if (dom.spotlightSize) {
    dom.spotlightSize.value = spotlight.size;
  }
  if (dom.softEdgeToggle) {
    dom.softEdgeToggle.checked = spotlight.softEdge;
  }
}

/**
 * Progress rendern
 */
function renderProgress() {
  const progress = selectors.getProgress();
  const played = selectors.getPlayedCount();
  const total = state.getState().totalImages;
  
  if (dom.progressBar) {
    dom.progressBar.style.width = `${progress}%`;
  }
  if (dom.progressLabel) {
    dom.progressLabel.textContent = `${played} / ${total}`;
  }
}

// === Helper Functions ===

function scrollStrip(amount) {
  if (dom.stripScroll) {
    dom.stripScroll.scrollBy({ left: amount, behavior: 'smooth' });
  }
}

function emitSpotlightUpdate() {
  document.dispatchEvent(new CustomEvent('spotlight:update', {
    detail: state.getState().spotlight
  }));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// === Event Handlers ===

function handleImageAdd(id, filename) {
  document.dispatchEvent(new CustomEvent('game:addImage', { detail: { id, filename } }));
}

function handleImageDelete(id) {
  document.dispatchEvent(new CustomEvent('game:deleteImage', { detail: { id } }));
}

function handleImageSelect(id) {
  // Optional: Bild auswählen
}

function handleSettingsChanged(e) {
  console.log('[UI] Settings changed:', e.detail);
  // Settings werden vom Modal direkt im State gespeichert
}

function handleResetScores() {
  state.getState().players.forEach(player => {
    actions.updateScore(player.id, -player.score);
  });
}

function handleRestartGame() {
  const currentState = state.getState();
  actions.setGameImages(currentState.gameImages.map(img => ({ ...img, played: false })));
  actions.setCurrentImage(null, -1);
  actions.setPhase('setup');
}

function handleDeleteAllImages() {
  actions.setGameImages([]);
  actions.setCurrentImage(null, -1);
  actions.setPhase('setup');
}

function handleFullReset() {
  state.resetState();
}

export default {
  initUI,
  render
};
