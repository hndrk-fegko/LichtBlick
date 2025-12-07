/**
 * Toast Notification System
 * Zeigt Feedback-Meldungen an
 * 
 * @module toast
 */

// Toast-Container
let container = null;

/**
 * Container initialisieren
 */
function ensureContainer() {
  if (container) return;
  
  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
}

/**
 * Toast Icons
 */
const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

/**
 * Toast anzeigen
 * @param {Object} options
 * @param {string} options.title - Titel
 * @param {string} options.message - Nachricht
 * @param {string} options.type - success | error | warning | info
 * @param {number} options.duration - Anzeigedauer in ms (0 = permanent)
 */
export function showToast({ title, message, type = 'info', duration = 4000 }) {
  ensureContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Schließen">×</button>
  `;
  
  // Close handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));
  
  // Add to container
  container.appendChild(toast);
  
  // Auto-remove
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

/**
 * Toast entfernen
 */
function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  
  toast.classList.add('toast-exit');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/**
 * Alle Toasts entfernen
 */
export function clearToasts() {
  if (!container) return;
  container.innerHTML = '';
}

// Shorthand-Funktionen
export const toast = {
  success: (title, message) => showToast({ title, message, type: 'success' }),
  error: (title, message) => showToast({ title, message, type: 'error', duration: 6000 }),
  warning: (title, message) => showToast({ title, message, type: 'warning' }),
  info: (title, message) => showToast({ title, message, type: 'info' })
};

export default toast;
