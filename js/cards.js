// Wires the card create/edit modal: the per-cell "+ Add card" buttons and
// clicking an existing card both open this same modal. Mirrors settings.js's
// modal pattern; kept separate since projects and cards are different
// concerns with their own delete-confirm state.

import { getCard, createCard, updateCard, deleteCard, moveCard } from './state.js';
import { render, parseLocalDate } from './render.js';
import { initDragAndDrop } from './dragdrop.js';
import { renderMarkdown } from './markdown.js';

const backdrop = document.getElementById('backdrop');
const cardModal = document.getElementById('card-modal');
const cardModalTitle = document.getElementById('card-modal-title');
const cardModalClose = document.getElementById('card-modal-close');
const titleInput = document.getElementById('card-title-input');
const descInput = document.getElementById('card-desc-input');
const descPreview = document.getElementById('card-desc-preview');
const mdTabs = document.getElementById('md-tabs');
const dueInput = document.getElementById('card-due-input');
const startGroup = document.getElementById('card-start-group');
const startValue = document.getElementById('card-start-value');
const tagInput = document.getElementById('card-tag-input');
const tagChipsEl = document.getElementById('card-tag-chips');
const saveBtn = document.getElementById('card-save-btn');
const deleteBtn = document.getElementById('card-delete-btn');

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

let editingCardId = null; // null => create mode
let createContext = null; // { projectId, status }, only used in create mode
let tags = [];

function renderTagChips() {
  tagChipsEl.innerHTML = '';
  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';

    const label = document.createElement('span');
    label.textContent = tag;
    chip.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tag-chip-remove';
    removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      tags = tags.filter(t => t !== tag);
      renderTagChips();
    });
    chip.appendChild(removeBtn);

    tagChipsEl.appendChild(chip);
  }
}

tagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = tagInput.value.trim();
    if (value && !tags.includes(value)) {
      tags.push(value);
      renderTagChips();
    }
    tagInput.value = '';
  } else if (e.key === 'Backspace' && tagInput.value === '' && tags.length) {
    tags.pop();
    renderTagChips();
  }
});

// ── Write/Preview tabs ───────────────────────────────────────
function setDescMode(mode) {
  for (const btn of mdTabs.querySelectorAll('.md-tab')) {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
  if (mode === 'preview') {
    renderMarkdown(descInput.value, descPreview);
    descInput.hidden = true;
    descPreview.hidden = false;
  } else {
    descInput.hidden = false;
    descPreview.hidden = true;
  }
}

mdTabs.addEventListener('click', e => {
  const btn = e.target.closest('.md-tab');
  if (btn) setDescMode(btn.dataset.mode);
});

// ── Open/close ───────────────────────────────────────────────
function openBackdrop() { backdrop.classList.add('open'); }
function closeBackdrop() { backdrop.classList.remove('open'); }

function openCardModal({ card = null, projectId = null, status = null } = {}) {
  editingCardId = card ? card.id : null;
  createContext = card ? null : { projectId, status };

  cardModalTitle.textContent = card ? 'Edit Card' : 'New Card';
  titleInput.value = card?.title || '';
  descInput.value = card?.description || '';
  setDescMode('write');
  dueInput.value = card?.dueDate ? card.dueDate.slice(0, 10) : '';
  tags = card?.tags ? [...card.tags] : [];
  renderTagChips();
  tagInput.value = '';

  if (card) {
    startGroup.hidden = false;
    const d = parseLocalDate(card.startDate);
    startValue.textContent = d ? dateFmt.format(d) : '—';
  } else {
    startGroup.hidden = true; // no start date to show until the card exists
  }

  deleteBtn.hidden = !card;
  resetDeleteConfirm();
  cardModal.classList.add('open');
  openBackdrop();
  titleInput.focus();
}

function closeCardModal() {
  cardModal.classList.remove('open');
  closeBackdrop();
  editingCardId = null;
  createContext = null;
}

// Shared backdrop/Escape also close settings.js's modals; each handler only
// touches its own modal, so a click/keypress while the other is open is a
// harmless no-op here.
backdrop.addEventListener('click', closeCardModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCardModal();
});
cardModalClose.addEventListener('click', closeCardModal);

// ── Save / delete ────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }
  const patch = {
    title,
    description: descInput.value.trim(),
    dueDate: dueInput.value || null,
    tags: [...tags],
  };
  if (editingCardId) {
    updateCard(editingCardId, patch);
  } else {
    createCard({ ...patch, projectId: createContext.projectId, status: createContext.status });
  }
  closeCardModal();
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

deleteBtn.addEventListener('click', () => {
  if (!editingCardId) return;
  if (!deleteConfirming) {
    deleteConfirming = true;
    deleteBtn.textContent = 'Confirm delete?';
    deleteBtn.classList.add('confirming');
    deleteResetTimer = setTimeout(resetDeleteConfirm, 3000);
    return;
  }
  deleteCard(editingCardId);
  resetDeleteConfirm();
  closeCardModal();
  render();
});

// "+ Add card" buttons and clicking an existing card both open this modal.
const projectListEl = document.getElementById('project-list');
projectListEl.addEventListener('click', e => {
  const addBtn = e.target.closest('.add-card-btn');
  if (addBtn) {
    openCardModal({ projectId: addBtn.dataset.projectId, status: addBtn.dataset.status });
    return;
  }
  const cardEl = e.target.closest('.card');
  if (cardEl) {
    const card = getCard(cardEl.dataset.id);
    if (card) openCardModal({ card });
  }
});

// ── Drag-and-drop ────────────────────────────────────────────
// After a drop, the destination cell's DOM order (which now includes the
// moved card at its live-reparented position) becomes the new source of
// truth for every card's `order` field in that cell. Only the moved card's
// projectId/status actually change; the rest just get renumbered.
function commitCellOrder(cell, movedCardId) {
  const projectId = cell.dataset.projectId;
  const status = cell.dataset.stage;
  const ids = [...cell.querySelectorAll('.card')].map(el => el.dataset.id);
  ids.forEach((id, index) => {
    if (id === movedCardId) {
      moveCard(id, { projectId, status, order: index });
    } else {
      updateCard(id, { order: index });
    }
  });
}

initDragAndDrop({
  container: projectListEl,
  onDrop: ({ cardEl, cell }) => {
    commitCellOrder(cell, cardEl.dataset.id);
    render();
  },
});
