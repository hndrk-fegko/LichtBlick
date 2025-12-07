/**
 * Sidebar Controller
 * Verwaltet die ausklappbare Bilder-Sidebar
 * 
 * @module sidebar
 */

import state, { actions, getState } from './state.js';
import toast from './toast.js';
import { confirm } from './modals.js';

// DOM Referenzen
let sidebarEl = null;
let toggleBtn = null;
let imagesContainer = null;
let uploadZone = null;

// Callbacks
let onImageAdd = null;
let onImageDelete = null;
let onImageSelect = null;

/**
 * Sidebar initialisieren
 * @param {Object} options
 */
export function initSidebar(options = {}) {
  onImageAdd = options.onImageAdd || (() => {});
  onImageDelete = options.onImageDelete || (() => {});
  onImageSelect = options.onImageSelect || (() => {});
  
  // DOM-Elemente finden oder erstellen
  sidebarEl = document.querySelector('.sidebar');
  
  if (!sidebarEl) {
    sidebarEl = createSidebar();
    document.body.appendChild(sidebarEl);
  }
  
  toggleBtn = sidebarEl.querySelector('.sidebar-toggle');
  imagesContainer = sidebarEl.querySelector('.sidebar-images');
  uploadZone = sidebarEl.querySelector('.upload-zone');
  
  // Event Listeners
  setupEventListeners();
  
  // State subscription
  state.subscribe((newState, prevState) => {
    if (newState.ui.sidebarOpen !== prevState.ui.sidebarOpen) {
      updateSidebarVisibility(newState.ui.sidebarOpen);
    }
  });
  
  console.log('[Sidebar] Initialized');
}

/**
 * Sidebar HTML erstellen
 */
function createSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <button class="sidebar-toggle" aria-label="Sidebar öffnen">
      <span class="sidebar-toggle-icon">◀</span>
      <span class="sidebar-toggle-badge">0</span>
    </button>
    
    <div class="sidebar-header">
      <h3 class="sidebar-title">📁 Bilder</h3>
      <button class="sidebar-close" aria-label="Schließen">×</button>
    </div>
    
    <div class="upload-zone">
      <div class="upload-zone-icon">📤</div>
      <div class="upload-zone-text">
        <strong>Bilder hierher ziehen</strong><br>
        oder klicken zum Auswählen
      </div>
      <input type="file" accept="image/*" multiple>
    </div>
    
    <div class="sidebar-images">
      <div class="sidebar-empty">
        <div class="sidebar-empty-icon">🖼️</div>
        <div>Noch keine Bilder vorhanden</div>
      </div>
    </div>
    
    <div class="sidebar-footer">
      <span class="sidebar-stats">0 Bilder</span>
      <button class="btn btn-sm btn-ghost" id="btn-refresh-images">🔄 Aktualisieren</button>
    </div>
  `;
  
  // Backdrop für Mobile
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  
  return sidebar;
}

/**
 * Event Listeners einrichten
 */
function setupEventListeners() {
  // Toggle Button
  toggleBtn?.addEventListener('click', () => {
    actions.toggleSidebar();
  });
  
  // Close Button
  sidebarEl.querySelector('.sidebar-close')?.addEventListener('click', () => {
    actions.toggleSidebar();
  });
  
  // Backdrop Click
  document.querySelector('.sidebar-backdrop')?.addEventListener('click', () => {
    if (getState().ui.sidebarOpen) {
      actions.toggleSidebar();
    }
  });
  
  // Upload Zone - Click
  uploadZone?.addEventListener('click', () => {
    uploadZone.querySelector('input[type="file"]')?.click();
  });
  
  // Upload Zone - File Input
  uploadZone?.querySelector('input[type="file"]')?.addEventListener('change', (e) => {
    handleFileUpload(e.target.files);
    e.target.value = ''; // Reset für erneuten Upload gleicher Datei
  });
  
  // Upload Zone - Drag & Drop
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  
  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFileUpload(e.dataTransfer.files);
  });
  
  // Refresh Button
  sidebarEl.querySelector('#btn-refresh-images')?.addEventListener('click', () => {
    loadImages();
  });
}

/**
 * Sidebar Sichtbarkeit aktualisieren
 */
function updateSidebarVisibility(isOpen) {
  sidebarEl?.classList.toggle('open', isOpen);
  
  // Badge aktualisieren
  updateBadge();
}

/**
 * Bilder laden (von Server)
 */
export async function loadImages() {
  try {
    const token = new URLSearchParams(window.location.search).get('token');
    const response = await fetch(`/api/images?token=${token}`);
    
    if (!response.ok) throw new Error('Fehler beim Laden');
    
    const images = await response.json();
    renderImages(images);
    updateStats(images.length);
    
  } catch (err) {
    console.error('[Sidebar] Load images error:', err);
    toast.error('Fehler', 'Bilder konnten nicht geladen werden');
  }
}

/**
 * Bilder rendern
 */
function renderImages(images) {
  if (!imagesContainer) return;
  
  if (images.length === 0) {
    imagesContainer.innerHTML = `
      <div class="sidebar-empty">
        <div class="sidebar-empty-icon">🖼️</div>
        <div>Noch keine Bilder vorhanden</div>
      </div>
    `;
    return;
  }
  
  const gameImages = getState().gameImages;
  const gameImageIds = new Set(gameImages.map(img => img.id));
  
  imagesContainer.innerHTML = images.map(img => {
    const inGame = gameImageIds.has(img.id);
    
    return `
      <div class="sidebar-image-item ${inGame ? 'in-game' : ''}" 
           data-id="${img.id}" 
           data-filename="${img.filename}">
        <img class="sidebar-image-thumb" 
             src="/uploads/${img.filename}" 
             alt="${img.answer || img.filename}"
             loading="lazy">
        ${inGame ? '<span class="sidebar-image-badge">Im Spiel</span>' : ''}
        <div class="sidebar-image-actions">
          ${!inGame ? `
            <button class="sidebar-image-action-btn add" title="Zum Spiel hinzufügen">➕</button>
          ` : ''}
          <button class="sidebar-image-action-btn delete" title="Löschen">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Event Listeners für Bilder
  imagesContainer.querySelectorAll('.sidebar-image-item').forEach(item => {
    const id = parseInt(item.dataset.id);
    
    // Doppelklick = Hinzufügen
    item.addEventListener('dblclick', () => {
      if (!item.classList.contains('in-game')) {
        onImageAdd(id, item.dataset.filename);
      }
    });
    
    // Add Button
    item.querySelector('.add')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onImageAdd(id, item.dataset.filename);
    });
    
    // Delete Button
    item.querySelector('.delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await confirm({
        title: 'Bild löschen?',
        message: 'Das Bild wird unwiderruflich gelöscht.',
        type: 'danger',
        confirmText: 'Löschen'
      });
      
      if (confirmed) {
        onImageDelete(id);
      }
    });
  });
  
  updateBadge();
}

/**
 * Datei-Upload verarbeiten
 */
async function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  
  const token = new URLSearchParams(window.location.search).get('token');
  let successCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    // Nur Bilder
    if (!file.type.startsWith('image/')) {
      errorCount++;
      continue;
    }
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(`/api/images/upload?token=${token}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error('[Sidebar] Upload error:', err);
      errorCount++;
    }
  }
  
  // Feedback
  if (successCount > 0) {
    toast.success('Upload erfolgreich', `${successCount} Bild(er) hochgeladen`);
    loadImages(); // Neu laden
  }
  
  if (errorCount > 0) {
    toast.error('Upload-Fehler', `${errorCount} Datei(en) fehlgeschlagen`);
  }
}

/**
 * Badge aktualisieren
 */
function updateBadge() {
  const badge = sidebarEl?.querySelector('.sidebar-toggle-badge');
  if (!badge) return;
  
  const count = imagesContainer?.querySelectorAll('.sidebar-image-item:not(.in-game)').length || 0;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

/**
 * Statistik aktualisieren
 */
function updateStats(count) {
  const stats = sidebarEl?.querySelector('.sidebar-stats');
  if (stats) {
    stats.textContent = `${count} Bild${count !== 1 ? 'er' : ''}`;
  }
}

/**
 * Sidebar öffnen
 */
export function open() {
  if (!getState().ui.sidebarOpen) {
    actions.toggleSidebar();
  }
}

/**
 * Sidebar schließen
 */
export function close() {
  if (getState().ui.sidebarOpen) {
    actions.toggleSidebar();
  }
}

/**
 * Bilder-Liste aktualisieren (nach Änderungen)
 */
export function refresh() {
  loadImages();
}

export default {
  initSidebar,
  loadImages,
  open,
  close,
  refresh
};
