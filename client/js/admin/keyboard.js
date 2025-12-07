/**
 * Keyboard Shortcuts Handler
 * Globale Tastatursteuerung für Admin Panel
 * 
 * @module keyboard
 */

import state, { actions, selectors } from './state.js';
import { openSettings, openDangerZone, closeAllModals } from './modals.js';
import toast from './toast.js';

// Shortcut Registry
const shortcuts = new Map();

// Aktiv-Status
let isEnabled = true;

/**
 * Keyboard Handler initialisieren
 */
export function initKeyboard() {
  // Standard-Shortcuts registrieren
  registerDefaultShortcuts();
  
  // Event Listener
  document.addEventListener('keydown', handleKeydown);
  
  console.log('[Keyboard] Initialized with', shortcuts.size, 'shortcuts');
}

/**
 * Standard-Shortcuts registrieren
 */
function registerDefaultShortcuts() {
  // === Spiel-Steuerung ===
  register('Space', {
    description: 'Aufdecken / Weiter',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:reveal'));
    },
    when: () => selectors.isGameActive() || state.getState().phase === 'setup'
  });
  
  register('Enter', {
    description: 'Nächste Runde',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:nextRound'));
    },
    when: () => state.getState().phase === 'buzzer'
  });
  
  register('b', {
    description: 'Buzzer simulieren',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:simulateBuzz'));
    },
    when: () => selectors.canBuzz()
  });
  
  // === Punkte ===
  register('+', {
    description: 'Punkt geben',
    aliases: ['=', 'NumpadAdd'],
    action: () => {
      document.dispatchEvent(new CustomEvent('game:awardPoint'));
    },
    when: () => state.getState().activePlayer !== null
  });
  
  register('-', {
    description: 'Punkt abziehen',
    aliases: ['NumpadSubtract'],
    action: () => {
      document.dispatchEvent(new CustomEvent('game:deductPoint'));
    },
    when: () => state.getState().activePlayer !== null
  });
  
  // === Navigation ===
  register('ArrowLeft', {
    description: 'Vorheriges Bild',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:prevImage'));
    }
  });
  
  register('ArrowRight', {
    description: 'Nächstes Bild',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:nextImage'));
    }
  });
  
  // === UI ===
  register('s', {
    description: 'Sidebar toggle',
    ctrl: true,
    action: () => {
      actions.toggleSidebar();
    }
  });
  
  register(',', {
    description: 'Einstellungen öffnen',
    ctrl: true,
    action: () => {
      openSettings();
    }
  });
  
  register('Escape', {
    description: 'Modal schließen / Abbrechen',
    action: () => {
      const modalOpen = state.getState().ui.modalOpen;
      if (modalOpen) {
        closeAllModals();
      } else if (state.getState().ui.sidebarOpen) {
        actions.toggleSidebar();
      }
    }
  });
  
  // === Spotlight ===
  register('ArrowUp', {
    description: 'Spotlight vergrößern',
    action: () => {
      const current = state.getState().spotlight.size;
      actions.updateSpotlight({ size: Math.min(500, current + 20) });
      document.dispatchEvent(new CustomEvent('spotlight:sizeChanged'));
    }
  });
  
  register('ArrowDown', {
    description: 'Spotlight verkleinern',
    action: () => {
      const current = state.getState().spotlight.size;
      actions.updateSpotlight({ size: Math.max(50, current - 20) });
      document.dispatchEvent(new CustomEvent('spotlight:sizeChanged'));
    }
  });
  
  register('v', {
    description: 'Spotlight an/aus',
    action: () => {
      const current = state.getState().spotlight.visible;
      actions.updateSpotlight({ visible: !current });
      document.dispatchEvent(new CustomEvent('spotlight:visibilityChanged'));
    }
  });
  
  register('r', {
    description: 'Bild komplett aufdecken',
    action: () => {
      document.dispatchEvent(new CustomEvent('game:revealFull'));
    },
    when: () => state.getState().currentImage !== null
  });
  
  // === Hilfe ===
  register('?', {
    description: 'Tastaturkürzel anzeigen',
    shift: true,
    action: () => {
      showShortcutsHelp();
    }
  });
  
  register('F1', {
    description: 'Hilfe anzeigen',
    action: () => {
      showShortcutsHelp();
    },
    preventDefault: true
  });
}

/**
 * Shortcut registrieren
 * @param {string} key - Taste
 * @param {Object} options
 */
export function register(key, options) {
  const {
    description = '',
    action,
    when = () => true,
    ctrl = false,
    shift = false,
    alt = false,
    aliases = [],
    preventDefault = true
  } = options;
  
  const shortcut = { key, description, action, when, ctrl, shift, alt, preventDefault };
  
  shortcuts.set(key, shortcut);
  
  // Aliases registrieren
  aliases.forEach(alias => {
    shortcuts.set(alias, { ...shortcut, key: alias });
  });
}

/**
 * Shortcut entfernen
 */
export function unregister(key) {
  shortcuts.delete(key);
}

/**
 * Keydown Handler
 */
function handleKeydown(e) {
  // Deaktiviert?
  if (!isEnabled) return;
  
  // Input-Felder ignorieren
  if (isInputFocused()) return;
  
  // Shortcut suchen
  const shortcut = shortcuts.get(e.key) || shortcuts.get(e.code);
  if (!shortcut) return;
  
  // Modifier prüfen
  if (shortcut.ctrl && !e.ctrlKey) return;
  if (shortcut.shift && !e.shiftKey) return;
  if (shortcut.alt && !e.altKey) return;
  
  // Bedingung prüfen
  if (!shortcut.when()) return;
  
  // Aktion ausführen
  if (shortcut.preventDefault) {
    e.preventDefault();
  }
  
  try {
    shortcut.action();
  } catch (err) {
    console.error('[Keyboard] Action error:', err);
  }
}

/**
 * Prüfen ob Input fokussiert
 */
function isInputFocused() {
  const active = document.activeElement;
  if (!active) return false;
  
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
}

/**
 * Shortcuts aktivieren/deaktivieren
 */
export function setEnabled(enabled) {
  isEnabled = enabled;
}

/**
 * Hilfe-Dialog anzeigen
 */
export function showShortcutsHelp() {
  const groups = {
    'Spiel-Steuerung': [],
    'Punkte': [],
    'Navigation': [],
    'Spotlight': [],
    'UI': []
  };
  
  // Shortcuts kategorisieren
  shortcuts.forEach((shortcut, key) => {
    // Duplikate (Aliases) überspringen
    if (key !== shortcut.key) return;
    
    const keyDisplay = formatKey(shortcut);
    const entry = { key: keyDisplay, desc: shortcut.description };
    
    if (['Space', 'Enter', 'b'].includes(key)) {
      groups['Spiel-Steuerung'].push(entry);
    } else if (['+', '-', '='].includes(key)) {
      groups['Punkte'].push(entry);
    } else if (['ArrowLeft', 'ArrowRight'].includes(key)) {
      groups['Navigation'].push(entry);
    } else if (['ArrowUp', 'ArrowDown', 'v', 'r'].includes(key)) {
      groups['Spotlight'].push(entry);
    } else {
      groups['UI'].push(entry);
    }
  });
  
  // HTML generieren
  let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">';
  
  for (const [group, entries] of Object.entries(groups)) {
    if (entries.length === 0) continue;
    
    html += `<div>
      <h4 style="margin-bottom: var(--spacing-sm); color: var(--color-primary);">${group}</h4>
      <div style="display: flex; flex-direction: column; gap: var(--spacing-xs);">
    `;
    
    entries.forEach(({ key, desc }) => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="shortcut-key">${key}</span>
          <span style="color: var(--color-text-muted);">${desc}</span>
        </div>
      `;
    });
    
    html += '</div></div>';
  }
  
  html += '</div>';
  
  // Toast mit Shortcuts anzeigen (als Info-Modal wäre besser, aber Toast reicht erstmal)
  toast.info('Tastaturkürzel', 'Drücke ? für die Übersicht');
  
  // Alternativ: Modal öffnen
  // TODO: Eigenes Help-Modal erstellen
}

/**
 * Taste formatieren für Anzeige
 */
function formatKey(shortcut) {
  const parts = [];
  
  if (shortcut.ctrl) parts.push('Strg');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.alt) parts.push('Alt');
  
  // Key formatieren
  let key = shortcut.key;
  switch (key) {
    case 'Space': key = '␣'; break;
    case 'Enter': key = '↵'; break;
    case 'Escape': key = 'Esc'; break;
    case 'ArrowUp': key = '↑'; break;
    case 'ArrowDown': key = '↓'; break;
    case 'ArrowLeft': key = '←'; break;
    case 'ArrowRight': key = '→'; break;
  }
  
  parts.push(key);
  return parts.join(' + ');
}

/**
 * Alle registrierten Shortcuts abrufen
 */
export function getShortcuts() {
  const result = [];
  const seen = new Set();
  
  shortcuts.forEach((shortcut, key) => {
    if (seen.has(shortcut)) return;
    seen.add(shortcut);
    result.push({
      key: shortcut.key,
      display: formatKey(shortcut),
      description: shortcut.description
    });
  });
  
  return result;
}

export default {
  initKeyboard,
  register,
  unregister,
  setEnabled,
  showShortcutsHelp,
  getShortcuts
};
