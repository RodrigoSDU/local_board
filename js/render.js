// Renders the current state (projects/cards) into #project-list. Every
// piece of user-controlled text goes through textContent -- never
// innerHTML -- so there is no way for a project/card field to inject
// markup. The two innerHTML uses below are fixed, hardcoded icon strings
// with no user input in them.

import { getProjects, getCardsForCell, getCardsForProject, STAGES } from './state.js';

const projectListEl = document.getElementById('project-list');
const emptyStateEl = document.getElementById('empty-state');

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// Reads the calendar date directly out of an ISO date/datetime string and
// builds a *local* Date from those components -- `new Date('2026-09-05')`
// parses as UTC midnight, which formatters then render as the previous day
// in any timezone behind UTC. Due dates are calendar dates the user picked,
// not instants, so they must never shift with the viewer's timezone.
export function parseLocalDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDate(iso) {
  const d = parseLocalDate(iso);
  return d ? dateFmt.format(d) : '';
}

const CHEVRON_SVG = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 4.5l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PENCIL_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

// Read-only checklist for the compact board card -- toggling only happens
// in the edit modal, same as every other card field.
function buildChecklistDisplay(items) {
  const list = document.createElement('div');
  list.className = 'card-checklist';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'card-checklist-item' + (item.done ? ' done' : '');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.disabled = true;
    row.appendChild(checkbox);
    const text = document.createElement('span');
    text.textContent = item.text;
    row.appendChild(text);
    list.appendChild(row);
  }
  return list;
}

function buildCard(card) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = card.id;

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = card.title;
  el.appendChild(title);

  if (card.description) {
    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = card.description; // plain text; CSS preserves line breaks
    el.appendChild(desc);
  }

  if (card.checklist && card.checklist.length) {
    el.appendChild(buildChecklistDisplay(card.checklist));
  }

  if (card.tags && card.tags.length) {
    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'card-tags';
    for (const t of card.tags) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t;
      tagsWrap.appendChild(tag);
    }
    el.appendChild(tagsWrap);
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const start = document.createElement('span');
  start.className = 'card-start';
  start.textContent = `Started ${formatDate(card.startDate)}`;
  meta.appendChild(start);
  if (card.dueDate) {
    const due = document.createElement('span');
    due.className = 'due-chip small';
    due.textContent = `Due ${formatDate(card.dueDate)}`;
    meta.appendChild(due);
  }
  el.appendChild(meta);

  return el;
}

function buildPriorityDots(priority) {
  const wrap = document.createElement('span');
  wrap.className = 'priority-dots';
  wrap.title = `Priority ${priority} of 5`;
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i <= priority ? ' filled' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}

function buildAddCardButton(projectId, status) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'add-card-btn';
  btn.dataset.projectId = projectId;
  btn.dataset.status = status;
  btn.textContent = '+ Add card';
  return btn;
}

// Cards stay in the DOM (never disappear) when a project is collapsed --
// they're just visually stacked into a fanned pile instead of laid out in
// the 4-column grid. The pile doubles as a drop target: dropping a card
// here moves it into this project's "planned" stage, since a collapsed
// row has no visible column to pick a more specific one from.
// A compact stand-in for a full card: title only, fixed height matching
// the pile container exactly. The pile's height is fixed, so a full
// buildCard() (title+description+tags+meta) would overflow it and spill
// into the row below -- the pile needs every chip to be the same height,
// not just the same width.
function buildStackChip(card) {
  const el = document.createElement('div');
  el.className = 'card stack-chip';
  el.dataset.id = card.id;
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = card.title;
  el.appendChild(title);
  return el;
}

function buildCollapsedStack(project) {
  const wrap = document.createElement('div');
  wrap.className = 'project-row-stack';

  const pile = document.createElement('div');
  pile.className = 'cell stack-pile';
  pile.dataset.projectId = project.id;
  pile.dataset.stage = 'planned';

  const cards = getCardsForProject(project.id);
  const FAN_CAP = 5; // additional cards beyond this just stack directly behind, no extra spread
  cards.forEach((card, i) => {
    const chip = buildStackChip(card);
    const offset = Math.min(i, FAN_CAP);
    const rotate = offset === 0 ? 0 : (offset % 2 === 0 ? 1 : -1) * offset * 0.7;
    chip.style.transform = `translate(${offset * 4}px, ${offset * 6}px) rotate(${rotate}deg)`;
    chip.style.zIndex = String(cards.length - i);
    pile.appendChild(chip);
  });
  wrap.appendChild(pile);

  const badge = document.createElement('span');
  badge.className = 'stack-badge';
  badge.textContent = cards.length === 1 ? '1 card' : `${cards.length} cards`;
  wrap.appendChild(badge);

  return wrap;
}

function buildProjectRow(project) {
  const section = document.createElement('section');
  section.className = 'project-row' + (project.collapsed ? ' collapsed' : '');
  section.dataset.id = project.id;
  section.style.setProperty('--row-color', project.color);

  const header = document.createElement('div');
  header.className = 'project-row-header';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'collapse-btn';
  collapseBtn.title = project.collapsed ? 'Expand' : 'Collapse';
  collapseBtn.setAttribute('aria-label', project.collapsed ? 'Expand project' : 'Collapse project');
  collapseBtn.innerHTML = CHEVRON_SVG;
  header.appendChild(collapseBtn);

  const name = document.createElement('span');
  name.className = 'project-name';
  name.textContent = project.name;
  header.appendChild(name);

  header.appendChild(buildPriorityDots(project.priority));

  if (project.dueDate) {
    const due = document.createElement('span');
    due.className = 'due-chip';
    due.textContent = `Due ${formatDate(project.dueDate)}`;
    header.appendChild(due);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn small';
  editBtn.title = 'Edit project';
  editBtn.setAttribute('aria-label', 'Edit project');
  editBtn.innerHTML = PENCIL_SVG;
  header.appendChild(editBtn);

  section.appendChild(header);

  if (project.collapsed) {
    section.appendChild(buildCollapsedStack(project));
    return section;
  }

  const body = document.createElement('div');
  body.className = 'project-row-body';
  for (const stage of STAGES) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.projectId = project.id;
    cell.dataset.stage = stage.key;
    for (const card of getCardsForCell(project.id, stage.key)) {
      cell.appendChild(buildCard(card));
    }
    cell.appendChild(buildAddCardButton(project.id, stage.key));
    body.appendChild(cell);
  }
  section.appendChild(body);

  return section;
}

export function render() {
  const projects = getProjects();
  projectListEl.innerHTML = '';

  if (projects.length === 0) {
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;
  for (const project of projects) {
    projectListEl.appendChild(buildProjectRow(project));
  }
}
