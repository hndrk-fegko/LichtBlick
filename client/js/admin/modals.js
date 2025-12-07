/**
 * Modal Controller
 * Verwaltet Settings, Danger Zone und Confirm Dialoge
 * 
 * @module modals
 */

import state, { actions } from './state.js';
import toast from './toast.js';

// Modal Referenzen
let settingsModal = null;
let dangerModal = null;
let confirmModal = null;
let activeBackdrop = null;

/**
 * Modals initialisieren
 */
export function initModals() {
  // Event-Listener für Escape-Taste
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.getState().ui.modalOpen) {
      closeAllModals();
    }
  });
  
  // Backdrop-Click schließt Modal
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop') && e.target.classList.contains('open')) {
      closeAllModals();
    }
  });
}

/**
 * Settings Modal öffnen
 * @param {string} tab - Optional: Tab zum Öffnen
 */
export function openSettings(tab = 'general') {
  if (!settingsModal) {
    settingsModal = createSettingsModal();
  }
  
  // Tab aktivieren
  const tabs = settingsModal.querySelectorAll('.settings-tab');
  const panels = settingsModal.querySelectorAll('.settings-panel');
  
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  panels.forEach(p => p.classList.toggle('active', p.id === `settings-${tab}`));
  
  openModal(settingsModal);
  actions.openModal('settings');
}

/**
 * Danger Zone Modal öffnen
 */
export function openDangerZone() {
  if (!dangerModal) {
    dangerModal = createDangerModal();
  }
  
  openModal(dangerModal);
  actions.openModal('danger');
}

/**
 * Confirm Dialog anzeigen
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
export function confirm({ title, message, confirmText = 'Bestätigen', cancelText = 'Abbrechen', type = 'warning' }) {
  return new Promise((resolve) => {
    if (!confirmModal) {
      confirmModal = createConfirmModal();
    }
    
    const iconEl = confirmModal.querySelector('.confirm-icon');
    const msgEl = confirmModal.querySelector('.confirm-message');
    const confirmBtn = confirmModal.querySelector('.btn-confirm');
    const cancelBtn = confirmModal.querySelector('.btn-cancel');
    
    iconEl.textContent = type === 'danger' ? '⚠️' : type === 'success' ? '✓' : '❓';
    iconEl.className = `confirm-icon confirm-${type}`;
    msgEl.innerHTML = `<strong>${title}</strong><br>${message}`;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    
    // Confirm button styling
    confirmBtn.className = `btn btn-${type === 'danger' ? 'danger' : 'primary'} btn-confirm`;
    
    // Event handlers
    const handleConfirm = () => {
      cleanup();
      closeAllModals();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      closeAllModals();
      resolve(false);
    };
    
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    openModal(confirmModal);
    actions.openModal('confirm');
  });
}

/**
 * Modal öffnen (intern)
 */
function openModal(modal) {
  if (!activeBackdrop) {
    activeBackdrop = document.createElement('div');
    activeBackdrop.className = 'modal-backdrop';
    document.body.appendChild(activeBackdrop);
  }
  
  activeBackdrop.innerHTML = '';
  activeBackdrop.appendChild(modal);
  
  // Animation triggern
  requestAnimationFrame(() => {
    activeBackdrop.classList.add('open');
  });
  
  // Focus trap
  const focusable = modal.querySelectorAll('button, input, select, textarea');
  if (focusable.length) focusable[0].focus();
}

/**
 * Alle Modals schließen
 */
export function closeAllModals() {
  if (activeBackdrop) {
    activeBackdrop.classList.remove('open');
    setTimeout(() => {
      if (activeBackdrop) {
        activeBackdrop.remove();
        activeBackdrop = null;
      }
    }, 300);
  }
  
  actions.closeModal();
}

/**
 * Settings Modal erstellen
 */
function createSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal modal-lg';
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">
        <span class="modal-title-icon">⚙️</span>
        Einstellungen
      </h2>
      <button class="modal-close" aria-label="Schließen">×</button>
    </div>
    
    <div class="modal-body">
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="general">Allgemein</button>
        <button class="settings-tab" data-tab="spotlight">Spotlight</button>
        <button class="settings-tab" data-tab="scoring">Punkte</button>
        <button class="settings-tab" data-tab="display">Anzeige</button>
      </div>
      
      <!-- General Tab -->
      <div class="settings-panel active" id="settings-general">
        <div class="settings-group">
          <div class="settings-group-title">Spielablauf</div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Auto-Start nach Buzz</div>
              <div class="settings-item-description">Automatisch weiter nach Punktevergabe</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-auto-continue">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Sound-Effekte</div>
              <div class="settings-item-description">Buzzer und Feedback-Sounds</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-sounds" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Spotlight Tab -->
      <div class="settings-panel" id="settings-spotlight">
        <div class="settings-group">
          <div class="settings-group-title">Spotlight-Verhalten</div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Standard-Größe</div>
              <div class="settings-item-description">Anfangsgröße des Spotlights in Pixeln</div>
            </div>
            <div class="settings-item-control">
              <input type="number" class="settings-input input-sm" id="setting-spotlight-size" value="150" min="50" max="500">
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Weicher Rand</div>
              <div class="settings-item-description">Spotlight mit Verlauf statt hartem Rand</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-soft-edge" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Auto-Reveal</div>
              <div class="settings-item-description">Spotlight wächst automatisch</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-auto-reveal">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Scoring Tab -->
      <div class="settings-panel" id="settings-scoring">
        <div class="settings-group">
          <div class="settings-group-title">Punktevergabe</div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Basis-Punkte</div>
              <div class="settings-item-description">Punkte für richtige Antwort</div>
            </div>
            <div class="settings-item-control">
              <input type="number" class="settings-input input-sm" id="setting-base-points" value="100" min="10" max="1000" step="10">
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Zeit-Bonus</div>
              <div class="settings-item-description">Mehr Punkte bei weniger aufgedecktem Bild</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-time-bonus" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Falsch-Abzug</div>
              <div class="settings-item-description">Punktabzug bei falscher Antwort</div>
            </div>
            <div class="settings-item-control">
              <input type="number" class="settings-input input-sm" id="setting-wrong-penalty" value="0" min="0" max="100" step="10">
            </div>
          </div>
        </div>
      </div>
      
      <!-- Display Tab -->
      <div class="settings-panel" id="settings-display">
        <div class="settings-group">
          <div class="settings-group-title">Beamer-Anzeige</div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Leaderboard anzeigen</div>
              <div class="settings-item-description">Punktestand auf Beamer sichtbar</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-show-leaderboard" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Spielernamen anzeigen</div>
              <div class="settings-item-description">Namen bei Buzz einblenden</div>
            </div>
            <div class="settings-item-control">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-show-names" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-ghost modal-cancel">Abbrechen</button>
      <button class="btn btn-primary modal-save">Speichern</button>
    </div>
  `;
  
  // Tab switching
  modal.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      modal.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`settings-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  // Close handlers
  modal.querySelector('.modal-close').addEventListener('click', closeAllModals);
  modal.querySelector('.modal-cancel').addEventListener('click', closeAllModals);
  
  // Save handler
  modal.querySelector('.modal-save').addEventListener('click', () => {
    saveSettings(modal);
    closeAllModals();
    toast.success('Gespeichert', 'Einstellungen wurden übernommen');
  });
  
  return modal;
}

/**
 * Danger Zone Modal erstellen
 */
function createDangerModal() {
  const modal = document.createElement('div');
  modal.className = 'modal modal-danger';
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">
        <span class="modal-title-icon">⚠️</span>
        Gefahrenzone
      </h2>
      <button class="modal-close" aria-label="Schließen">×</button>
    </div>
    
    <div class="modal-body">
      <div class="danger-warning">
        <span class="danger-warning-icon">🚨</span>
        <div class="danger-warning-text">
          <div class="danger-warning-title">Achtung!</div>
          <div class="danger-warning-desc">
            Die folgenden Aktionen können nicht rückgängig gemacht werden.
            Bitte mit Vorsicht verwenden.
          </div>
        </div>
      </div>
      
      <div class="danger-actions">
        <div class="danger-action-item">
          <div class="danger-action-info">
            <div class="danger-action-label">Alle Punkte zurücksetzen</div>
            <div class="danger-action-desc">Setzt alle Spielerpunkte auf 0</div>
          </div>
          <button class="btn btn-warning" data-action="reset-scores">Zurücksetzen</button>
        </div>
        
        <div class="danger-action-item">
          <div class="danger-action-info">
            <div class="danger-action-label">Spiel neu starten</div>
            <div class="danger-action-desc">Markiert alle Bilder als ungespielt</div>
          </div>
          <button class="btn btn-warning" data-action="restart-game">Neustarten</button>
        </div>
        
        <div class="danger-action-item">
          <div class="danger-action-info">
            <div class="danger-action-label">Alle Bilder löschen</div>
            <div class="danger-action-desc">Entfernt alle Bilder aus dem Spiel</div>
          </div>
          <button class="btn btn-danger" data-action="delete-images">Löschen</button>
        </div>
        
        <div class="danger-action-item">
          <div class="danger-action-info">
            <div class="danger-action-label">Kompletter Reset</div>
            <div class="danger-action-desc">Löscht ALLES (Bilder, Spieler, Punkte)</div>
          </div>
          <button class="btn btn-danger" data-action="full-reset">Alles löschen</button>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-ghost modal-cancel">Schließen</button>
    </div>
  `;
  
  // Close handlers
  modal.querySelector('.modal-close').addEventListener('click', closeAllModals);
  modal.querySelector('.modal-cancel').addEventListener('click', closeAllModals);
  
  // Action handlers
  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleDangerAction(btn.dataset.action));
  });
  
  return modal;
}

/**
 * Confirm Modal erstellen
 */
function createConfirmModal() {
  const modal = document.createElement('div');
  modal.className = 'modal modal-sm';
  modal.innerHTML = `
    <div class="modal-body" style="padding-top: var(--spacing-xl);">
      <div class="confirm-icon">❓</div>
      <div class="confirm-message"></div>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-cancel">Abbrechen</button>
        <button class="btn btn-primary btn-confirm">Bestätigen</button>
      </div>
    </div>
  `;
  
  return modal;
}

/**
 * Einstellungen speichern
 */
function saveSettings(modal) {
  const settings = {
    autoContinue: modal.querySelector('#setting-auto-continue')?.checked,
    sounds: modal.querySelector('#setting-sounds')?.checked,
    spotlightSize: parseInt(modal.querySelector('#setting-spotlight-size')?.value) || 150,
    softEdge: modal.querySelector('#setting-soft-edge')?.checked,
    autoReveal: modal.querySelector('#setting-auto-reveal')?.checked,
    basePoints: parseInt(modal.querySelector('#setting-base-points')?.value) || 100,
    timeBonus: modal.querySelector('#setting-time-bonus')?.checked,
    wrongPenalty: parseInt(modal.querySelector('#setting-wrong-penalty')?.value) || 0,
    showLeaderboard: modal.querySelector('#setting-show-leaderboard')?.checked,
    showNames: modal.querySelector('#setting-show-names')?.checked
  };
  
  // State aktualisieren
  actions.updateSpotlight({
    size: settings.spotlightSize,
    softEdge: settings.softEdge,
    autoReveal: settings.autoReveal
  });
  
  // Event für andere Module
  document.dispatchEvent(new CustomEvent('settings:changed', { detail: settings }));
  
  console.log('[Modals] Settings saved:', settings);
}

/**
 * Danger Zone Aktion ausführen
 */
async function handleDangerAction(action) {
  let confirmed = false;
  
  switch (action) {
    case 'reset-scores':
      confirmed = await confirm({
        title: 'Punkte zurücksetzen?',
        message: 'Alle Spielerpunkte werden auf 0 gesetzt.',
        type: 'warning'
      });
      if (confirmed) {
        document.dispatchEvent(new CustomEvent('game:resetScores'));
        toast.success('Erledigt', 'Alle Punkte wurden zurückgesetzt');
      }
      break;
      
    case 'restart-game':
      confirmed = await confirm({
        title: 'Spiel neu starten?',
        message: 'Alle Bilder werden als ungespielt markiert.',
        type: 'warning'
      });
      if (confirmed) {
        document.dispatchEvent(new CustomEvent('game:restart'));
        toast.success('Erledigt', 'Spiel wurde neu gestartet');
      }
      break;
      
    case 'delete-images':
      confirmed = await confirm({
        title: 'Alle Bilder löschen?',
        message: 'Diese Aktion kann nicht rückgängig gemacht werden!',
        type: 'danger',
        confirmText: 'Ja, löschen'
      });
      if (confirmed) {
        document.dispatchEvent(new CustomEvent('game:deleteAllImages'));
        toast.success('Erledigt', 'Alle Bilder wurden gelöscht');
      }
      break;
      
    case 'full-reset':
      confirmed = await confirm({
        title: 'ALLES löschen?',
        message: 'Bilder, Spieler und Punkte werden unwiderruflich gelöscht!',
        type: 'danger',
        confirmText: 'Ja, alles löschen'
      });
      if (confirmed) {
        document.dispatchEvent(new CustomEvent('game:fullReset'));
        toast.success('Erledigt', 'Kompletter Reset durchgeführt');
      }
      break;
  }
}

export default {
  initModals,
  openSettings,
  openDangerZone,
  confirm,
  closeAllModals
};
