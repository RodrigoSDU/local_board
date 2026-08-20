// Renders the current state (projects/cards) into #project-list. Every
// piece of user-controlled text goes through textContent -- never
// innerHTML -- so there is no way for a project/card field to inject
// markup. The two innerHTML uses below are fixed, hardcoded icon strings
// with no user input in them.

import { getProjects, getCardsForCell, STAGES } from './state.js';

const projectListEl = document.getElementById('project-list');
const emptyStateEl = document.getElementById('empty-state');

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

const CHEVRON_SVG = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 4.5l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PENCIL_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

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
    desc.textContent = card.description;
    el.appendChild(desc);
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

function buildProjectRow(project) {
  const section = document.createElement('section');
  section.className = 'project-row';
  section.dataset.id = project.id;
  section.style.setProperty('--row-color', project.color);

  const header = document.createElement('div');
  header.className = 'project-row-header';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'collapse-btn';
  collapseBtn.title = 'Collapse';
  collapseBtn.setAttribute('aria-label', 'Collapse project');
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

  const body = document.createElement('div');
  body.className = 'project-row-body';
  for (const stage of STAGES) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.stage = stage.key;
    for (const card of getCardsForCell(project.id, stage.key)) {
      cell.appendChild(buildCard(card));
    }
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
