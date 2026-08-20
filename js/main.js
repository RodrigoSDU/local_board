import { init, createProject, createCard } from './state.js';
import { loadSettings, saveSettings } from './storage.js';
import { render } from './render.js';
import './settings.js';
import './cards.js';

// First-run only: gives the board something to look at instead of the
// empty state. Runs exactly once ever, tracked via settings.seeded --
// not "projects.length === 0", so deleting every project later doesn't
// bring the sample data back on the next reload.
function seedSampleDataIfEmpty() {
  const settings = loadSettings();
  if (settings.seeded) return;
  saveSettings({ ...settings, seeded: true });

  const site = createProject({
    name: 'Website Redesign',
    summary: 'Refresh the marketing site design and content.',
    dueDate: '2026-09-12',
    priority: 4,
    color: '#3b82f6',
  });
  createCard({ projectId: site.id, status: 'planned', title: 'Wireframe homepage', description: 'Sketch layout for hero, features, and footer sections.', tags: ['design'] });
  createCard({ projectId: site.id, status: 'planned', title: 'Collect brand assets', dueDate: '2026-08-25' });
  createCard({ projectId: site.id, status: 'in_progress', title: 'Build component library', description: 'Buttons, inputs, cards, and modals in the new style.', tags: ['dev', 'ui'], dueDate: '2026-08-30' });
  createCard({ projectId: site.id, status: 'blocked', title: 'Await client copy', description: 'Blocked on final marketing copy for the landing page.' });
  createCard({ projectId: site.id, status: 'done', title: 'Kickoff meeting' });

  const app = createProject({
    name: 'Mobile App Beta',
    dueDate: '2026-10-01',
    priority: 2,
    color: '#f97316',
  });
  createCard({ projectId: app.id, status: 'planned', title: 'Push notification spec' });
  createCard({ projectId: app.id, status: 'done', title: 'Set up CI pipeline' });
  createCard({ projectId: app.id, status: 'done', title: 'App icon design' });
}

init();
seedSampleDataIfEmpty();
render();
