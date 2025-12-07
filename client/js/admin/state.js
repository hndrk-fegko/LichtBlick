/**
 * Admin State Management
 * Zentraler State für das Admin Panel
 * 
 * @module state
 */

/**
 * @typedef {Object} GameImage
 * @property {number} id - Bild-ID
 * @property {string} filename - Dateiname
 * @property {string} answer - Richtige Antwort
 * @property {number} order_num - Reihenfolge
 * @property {boolean} played - Bereits gespielt?
 */

/**
 * @typedef {Object} Player
 * @property {string} id - Player Socket-ID
 * @property {string} name - Spielername
 * @property {number} score - Punktestand
 * @property {boolean} connected - Verbunden?
 */

/**
 * @typedef {Object} AppState
 * @property {string} phase - Aktuelle Spielphase
 * @property {GameImage[]} gameImages - Bilder im Spiel
 * @property {GameImage|null} currentImage - Aktuelles Bild
 * @property {Player[]} players - Spielerliste
 * @property {Player|null} activePlayer - Gebuzzter Spieler
 * @property {Object} spotlight - Spotlight-Einstellungen
 * @property {Object} connection - Verbindungsstatus
 * @property {Object} ui - UI-State
 */

// === Initial State ===
const initialState = {
  // Game State
  phase: 'setup', // setup | active | buzzer | paused | ended
  gameImages: [],
  currentImage: null,
  currentImageIndex: -1,
  totalImages: 0,
  
  // Players
  players: [],
  activePlayer: null,
  
  // Spotlight
  spotlight: {
    visible: true,
    size: 150,
    softEdge: true,
    autoReveal: false,
    autoRevealSpeed: 5
  },
  
  // Connection
  connection: {
    socket: false,
    beamer: false,
    playerCount: 0
  },
  
  // Scoring
  scoring: {
    basePoints: 100,
    timeBonus: true,
    wrongPenalty: 0
  },
  
  // UI State
  ui: {
    sidebarOpen: false,
    modalOpen: null, // 'settings' | 'danger' | 'confirm' | null
    selectedImageId: null,
    isDragging: false
  }
};

// === State Container ===
let state = JSON.parse(JSON.stringify(initialState));

// === Subscribers ===
const subscribers = new Set();

/**
 * State abrufen (immutable copy)
 * @returns {AppState}
 */
export function getState() {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Teilbereich des States abrufen
 * @param {string} path - Dot-notation Pfad (z.B. 'spotlight.size')
 * @returns {*}
 */
export function getStateValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], state);
}

/**
 * State aktualisieren
 * @param {Partial<AppState>|function} updater - Neuer State oder Update-Funktion
 */
export function setState(updater) {
  const prevState = state;
  
  if (typeof updater === 'function') {
    state = { ...state, ...updater(state) };
  } else {
    state = { ...state, ...updater };
  }
  
  // Notify subscribers
  notifySubscribers(prevState, state);
}

/**
 * Verschachtelten State aktualisieren
 * @param {string} path - Dot-notation Pfad
 * @param {*} value - Neuer Wert
 */
export function setStateValue(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  setState(prev => {
    const newState = JSON.parse(JSON.stringify(prev));
    let obj = newState;
    
    for (const key of keys) {
      if (!obj[key]) obj[key] = {};
      obj = obj[key];
    }
    
    obj[lastKey] = value;
    return newState;
  });
}

/**
 * State zurücksetzen
 */
export function resetState() {
  const prevState = state;
  state = JSON.parse(JSON.stringify(initialState));
  notifySubscribers(prevState, state);
}

// === Subscriptions ===

/**
 * Auf State-Änderungen reagieren
 * @param {function} callback - Wird bei Änderungen aufgerufen
 * @returns {function} Unsubscribe-Funktion
 */
export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Subscribers benachrichtigen
 * @param {AppState} prevState
 * @param {AppState} newState
 */
function notifySubscribers(prevState, newState) {
  subscribers.forEach(callback => {
    try {
      callback(newState, prevState);
    } catch (err) {
      console.error('[State] Subscriber error:', err);
    }
  });
}

// === Selectors (computed values) ===

export const selectors = {
  /**
   * Sortierte Spielerliste nach Score
   */
  getSortedPlayers: () => {
    return [...state.players].sort((a, b) => b.score - a.score);
  },
  
  /**
   * Anzahl gespielte Bilder
   */
  getPlayedCount: () => {
    return state.gameImages.filter(img => img.played).length;
  },
  
  /**
   * Fortschritt in Prozent
   */
  getProgress: () => {
    if (state.totalImages === 0) return 0;
    const played = state.gameImages.filter(img => img.played).length;
    return Math.round((played / state.totalImages) * 100);
  },
  
  /**
   * Nächstes ungespieltes Bild
   */
  getNextUnplayedImage: () => {
    return state.gameImages.find(img => !img.played);
  },
  
  /**
   * Ist das Spiel aktiv?
   */
  isGameActive: () => {
    return ['active', 'buzzer'].includes(state.phase);
  },
  
  /**
   * Kann gebuzzert werden?
   */
  canBuzz: () => {
    return state.phase === 'active' && state.currentImage !== null;
  },
  
  /**
   * Hat das Spiel Bilder?
   */
  hasImages: () => {
    return state.gameImages.length > 0;
  }
};

// === Actions (state mutations) ===

export const actions = {
  /**
   * Phase setzen
   */
  setPhase: (phase) => {
    setState({ phase });
  },
  
  /**
   * Spieler hinzufügen/aktualisieren
   */
  upsertPlayer: (player) => {
    setState(prev => {
      const idx = prev.players.findIndex(p => p.id === player.id);
      const players = [...prev.players];
      
      if (idx >= 0) {
        players[idx] = { ...players[idx], ...player };
      } else {
        players.push(player);
      }
      
      return { players };
    });
  },
  
  /**
   * Spieler entfernen
   */
  removePlayer: (playerId) => {
    setState(prev => ({
      players: prev.players.filter(p => p.id !== playerId)
    }));
  },
  
  /**
   * Score ändern
   */
  updateScore: (playerId, delta) => {
    setState(prev => ({
      players: prev.players.map(p => 
        p.id === playerId 
          ? { ...p, score: Math.max(0, p.score + delta) }
          : p
      )
    }));
  },
  
  /**
   * Aktiven Spieler setzen (Buzzer)
   */
  setActivePlayer: (player) => {
    setState({ 
      activePlayer: player,
      phase: player ? 'buzzer' : 'active'
    });
  },
  
  /**
   * Aktuelles Bild setzen
   */
  setCurrentImage: (image, index) => {
    setState({
      currentImage: image,
      currentImageIndex: index
    });
  },
  
  /**
   * Bild als gespielt markieren
   */
  markImagePlayed: (imageId) => {
    setState(prev => ({
      gameImages: prev.gameImages.map(img =>
        img.id === imageId ? { ...img, played: true } : img
      )
    }));
  },
  
  /**
   * Spielbilder setzen
   */
  setGameImages: (images) => {
    setState({
      gameImages: images,
      totalImages: images.length
    });
  },
  
  /**
   * Sidebar toggle
   */
  toggleSidebar: () => {
    setStateValue('ui.sidebarOpen', !state.ui.sidebarOpen);
  },
  
  /**
   * Modal öffnen/schließen
   */
  openModal: (modalName) => {
    setStateValue('ui.modalOpen', modalName);
  },
  
  closeModal: () => {
    setStateValue('ui.modalOpen', null);
  },
  
  /**
   * Verbindungsstatus aktualisieren
   */
  setConnectionStatus: (status) => {
    setState(prev => ({
      connection: { ...prev.connection, ...status }
    }));
  },
  
  /**
   * Spotlight-Einstellung ändern
   */
  updateSpotlight: (settings) => {
    setState(prev => ({
      spotlight: { ...prev.spotlight, ...settings }
    }));
  }
};

// === Debug ===
if (typeof window !== 'undefined') {
  window.__adminState = {
    getState,
    setState,
    resetState,
    selectors,
    actions
  };
}

export default {
  getState,
  getStateValue,
  setState,
  setStateValue,
  resetState,
  subscribe,
  selectors,
  actions
};
