// Wires the gear-icon settings panel and the project create/edit modal.
// Both modals share one backdrop; only one is ever open at a time because
// the flows that open the project modal always close settings first.

import { init as reinitState, getProject, createProject, updateProject, deleteProject } from './state.js';
import { exportData, importData } from './storage.js';
import { render } from './render.js';

const PALETTE = ['#3b82f6', '#f97316', '#22c55e', '#ef4444', '#a855f7', '#eab308', '#14b8a6', '#ec4899'];
const DEFAULT_COLOR = PALETTE[0];
const DEFAULT_PRIORITY = 3;

const backdrop = document.getElementById('backdrop');
const settingsModal = document.getElementById('settings-modal');
const projectModal = document.getElementById('project-modal');

const settingsBtn = document.getElementById('settings-btn');
const settingsClose = document.getElementById('settings-close');
const newProjectBtn = document.getElementById('new-project-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');

const projectModalTitle = document.getElementById('project-modal-title');
const projectModalClose = document.getElementById('project-modal-close');
const nameInput = document.getElementById('project-name-input');
const summaryInput = document.getElementById('project-summary-input');
const dueInput = document.getElementById('project-due-input');
const priorityPicker = document.getElementById('priority-picker');
const colorPicker = document.getElementById('color-picker');
const saveBtn = document.getElementById('project-save-btn');
const deleteBtn = document.getElementById('project-delete-btn');

let editingProjectId = null; // null => create mode
let selectedPriority = DEFAULT_PRIORITY;
let selectedColor = DEFAULT_COLOR;

for (const color of PALETTE) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'color-swatch';
  btn.style.background = color;
  btn.dataset.color = color;
  btn.setAttribute('aria-label', `Color ${color}`);
  btn.addEventListener('click', () => selectColor(color));
  colorPicker.appendChild(btn);
}

function selectColor(color) {
  selectedColor = color;
  for (const el of colorPicker.querySelectorAll('.color-swatch')) {
    el.classList.toggle('active', el.dataset.color === color);
  }
}

function selectPriority(value) {
  selectedPriority = value;
  for (const el of priorityPicker.querySelectorAll('.priority-btn')) {
    el.classList.toggle('active', Number(el.dataset.value) === value);
  }
}

priorityPicker.addEventListener('click', e => {
  const btn = e.target.closest('.priority-btn');
  if (btn) selectPriority(Number(btn.dataset.value));
});

// ── Open/close ───────────────────────────────────────────────
function openBackdrop() { backdrop.classList.add('open'); }
function closeBackdrop() { backdrop.classList.remove('open'); }

function openSettings() {
  settingsModal.classList.add('open');
  openBackdrop();
}
function closeSettings() {
  settingsModal.classList.remove('open');
  closeBackdrop();
}

function openProjectModal(project) {
  editingProjectId = project ? project.id : null;
  projectModalTitle.textContent = project ? 'Edit Project' : 'New Project';
  nameInput.value = project?.name || '';
  summaryInput.value = project?.summary || '';
  dueInput.value = project?.dueDate ? project.dueDate.slice(0, 10) : '';
  selectPriority(project?.priority || DEFAULT_PRIORITY);
  selectColor(project?.color || DEFAULT_COLOR);
  deleteBtn.hidden = !project;
  resetDeleteConfirm();
  projectModal.classList.add('open');
  openBackdrop();
  nameInput.focus();
}

function closeProjectModal() {
  projectModal.classList.remove('open');
  closeBackdrop();
  editingProjectId = null;
}

backdrop.addEventListener('click', () => {
  closeSettings();
  closeProjectModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSettings();
    closeProjectModal();
  }
});

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
newProjectBtn.addEventListener('click', () => {
  closeSettings();
  openProjectModal(null);
});
projectModalClose.addEventListener('click', closeProjectModal);

// ── Save / delete ────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  const patch = {
    name,
    summary: summaryInput.value.trim(),
    dueDate: dueInput.value || null,
    priority: selectedPriority,
    color: selectedColor,
  };
  if (editingProjectId) {
    updateProject(editingProjectId, patch);
  } else {
    createProject(patch);
  }
  closeProjectModal();
  render();
});

let deleteConfirming = false;
let deleteResetTimer = null;

function resetDeleteConfirm() {
  deleteConfirming = false;
  deleteBtn.textContent = 'Delete';
  deleteBtn.classList.remove('confirming');
  if (deleteResetTimer) {
    clearTimeout(deleteResetTimer);
    deleteResetTimer = null;
  }
}

// Press-to-confirm delete: first click arms it, second click (within 3s)
// commits it. Mirrors the pattern from the to-do reference app.
deleteBtn.addEventListener('click', () => {
  if (!editingProjectId) return;
  if (!deleteConfirming) {
    deleteConfirming = true;
    deleteBtn.textContent = 'Confirm delete?';
    deleteBtn.classList.add('confirming');
    deleteResetTimer = setTimeout(resetDeleteConfirm, 3000);
    return;
  }
  deleteProject(editingProjectId);
  resetDeleteConfirm();
  closeProjectModal();
  render();
});

// Each project row's pencil button opens it in edit mode.
document.getElementById('project-list').addEventListener('click', e => {
  const editBtn = e.target.closest('.icon-btn.small');
  if (!editBtn) return;
  const row = e.target.closest('.project-row');
  const project = getProject(row.dataset.id);
  if (project) openProjectModal(project);
});

// ── Export / import ──────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const data = exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project-board-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

let importConfirming = false;
let importResetTimer = null;

importBtn.addEventListener('click', () => {
  if (!importConfirming) {
    importConfirming = true;
    importBtn.textContent = 'Confirm import?';
    importResetTimer = setTimeout(() => {
      importConfirming = false;
      importBtn.textContent = 'Import backup';
      importResetTimer = null;
    }, 3000);
    return;
  }
  importFileInput.click();
});

importFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  importConfirming = false;
  importBtn.textContent = 'Import backup';
  if (importResetTimer) {
    clearTimeout(importResetTimer);
    importResetTimer = null;
  }
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    let parsed;
    try {
      parsed = JSON.parse(ev.target.result);
    } catch {
      alert('Could not read file. Make sure it is a valid JSON backup.');
      return;
    }
    const result = importData(parsed);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    reinitState(); // resync state.js's in-memory cache with the new storage contents
    closeSettings();
    render();
  };
  reader.readAsText(file);
});
