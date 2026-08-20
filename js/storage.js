// Thin persistence layer: everything localStorage-related lives here so
// state.js and the rest of the app never touch `localStorage` directly.

const KEYS = {
  projects: 'pb_projects',
  cards: 'pb_cards',
  settings: 'pb_settings',
};

const DEFAULT_SETTINGS = {
  theme: 'light',
  seeded: false, // whether the first-run sample projects have ever been created
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadProjects() {
  const data = readJSON(KEYS.projects, []);
  return Array.isArray(data) ? data : [];
}

export function saveProjects(projects) {
  writeJSON(KEYS.projects, projects);
}

export function loadCards() {
  const data = readJSON(KEYS.cards, []);
  return Array.isArray(data) ? data : [];
}

export function saveCards(cards) {
  writeJSON(KEYS.cards, cards);
}

export function loadSettings() {
  const data = readJSON(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(data && typeof data === 'object' ? data : {}) };
}

export function saveSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function exportData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: loadProjects(),
    cards: loadCards(),
    settings: loadSettings(),
  };
}

// Validates the shape of a parsed backup file and writes it to storage.
// Returns { ok: true } or { ok: false, error }; never throws.
export function importData(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Not a valid backup file.' };
  }
  if (!Array.isArray(data.projects) || !Array.isArray(data.cards)) {
    return { ok: false, error: 'Backup is missing projects or cards.' };
  }
  const projects = data.projects.filter(p => p && typeof p === 'object' && typeof p.id === 'string');
  const cards = data.cards.filter(c => c && typeof c === 'object' && typeof c.id === 'string');
  saveProjects(projects);
  saveCards(cards);
  if (data.settings && typeof data.settings === 'object') {
    saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  }
  return { ok: true };
}
