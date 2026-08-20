// In-memory cache of projects/cards plus the CRUD operations the rest of
// the app uses. Every mutation here persists immediately via storage.js;
// callers are responsible for re-rendering afterwards.

import { loadProjects, saveProjects, loadCards, saveCards } from './storage.js';

export const STAGES = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];

let projects = [];
let cards = [];

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function init() {
  projects = loadProjects();
  cards = loadCards();
}

// ── Projects ─────────────────────────────────────────────────
export function getProjects() {
  return projects.slice().sort((a, b) => a.order - b.order);
}

export function getProject(id) {
  return projects.find(p => p.id === id) || null;
}

function nextProjectOrder() {
  return projects.reduce((max, p) => Math.max(max, p.order), -1) + 1;
}

export function createProject({ name, summary = '', dueDate = null, priority = 3, color = '#4f46e5' }) {
  const project = {
    id: generateId(),
    name,
    summary,
    dueDate,
    priority,
    color,
    collapsed: false,
    order: nextProjectOrder(),
    createdAt: new Date().toISOString(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

export function updateProject(id, patch) {
  const project = getProject(id);
  if (!project) return null;
  Object.assign(project, patch);
  saveProjects(projects);
  return project;
}

export function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  cards = cards.filter(c => c.projectId !== id); // cascade delete its cards
  saveProjects(projects);
  saveCards(cards);
}

// ── Cards ────────────────────────────────────────────────────
export function getCards() {
  return cards.slice();
}

export function getCard(id) {
  return cards.find(c => c.id === id) || null;
}

export function getCardsForCell(projectId, status) {
  return cards
    .filter(c => c.projectId === projectId && c.status === status)
    .sort((a, b) => a.order - b.order);
}

function nextCardOrder(projectId, status) {
  return cards
    .filter(c => c.projectId === projectId && c.status === status)
    .reduce((max, c) => Math.max(max, c.order), -1) + 1;
}

export function createCard({ projectId, status = 'planned', title, description = '', dueDate = null, tags = [], checklist = [] }) {
  const now = new Date().toISOString();
  const card = {
    id: generateId(),
    projectId,
    status,
    title,
    description,
    startDate: now, // set once, never touched again
    dueDate,
    tags,
    checklist,
    order: nextCardOrder(projectId, status),
    createdAt: now,
    updatedAt: now,
  };
  cards.push(card);
  saveCards(cards);
  return card;
}

export function updateCard(id, patch) {
  const card = getCard(id);
  if (!card) return null;
  Object.assign(card, patch, { updatedAt: new Date().toISOString() });
  saveCards(cards);
  return card;
}

export function deleteCard(id) {
  cards = cards.filter(c => c.id !== id);
  saveCards(cards);
}

// Convenience wrapper for drag-and-drop: reassigns a card's cell/position.
export function moveCard(id, { projectId, status, order }) {
  return updateCard(id, { projectId, status, order });
}
