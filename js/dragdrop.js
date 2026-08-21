// Generic press-and-drag controller for moving `.card` elements between
// `.cell` drop targets (each cell tagged with data-project-id/data-status).
// One shared implementation for the whole board -- not copy-pasted per
// list the way the to-do reference app's drag code was, which left four
// near-identical copies that drifted out of sync. Both pointercancel and
// setPointerCapture are handled here, two gaps that app's version had.
//
// Mouse/pen and touch use different start gestures on purpose. A mouse or
// pen drag begins as soon as the pointer moves past a small threshold --
// the normal desktop feel, since neither has a competing scroll gesture to
// disambiguate against (an Apple Pencil dragging across a webpage doesn't
// scroll it the way a finger swipe does). Touch alone requires a short
// press-and-hold with an early-movement cancel, so an ordinary scroll
// swipe across a card is left alone rather than hijacked into a drag.
// Pen deliberately isn't lumped in with touch here: a stylus has far less
// natural hand-stabilization than a fingertip, so requiring it to hold
// still for HOLD_MS made the gesture unreliable -- the slightest drift
// during the hold window cancelled it before it ever started. Neither
// path sets touch-action on the card: leaving it at the default is what
// lets a fast touch swipe cancel the pending hold below before any
// drag-only preventDefault() runs.

const HOLD_MS = 200;
const MOVE_THRESHOLD_PX = 6;

export function initDragAndDrop({ container, onDrop }) {
  container.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; // primary mouse button / touch / pen only
    if (e.target.closest('input, button, a, textarea, select')) return; // let interactive sub-elements (e.g. checklist checkboxes) handle their own clicks
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    beginPress(e, cardEl, onDrop);
  });
}

function beginPress(downEvent, cardEl, onDrop) {
  const pointerId = downEvent.pointerId;
  const requiresHold = downEvent.pointerType === 'touch';
  const startX = downEvent.clientX;
  const startY = downEvent.clientY;
  let settled = false;

  function cleanup() {
    settled = true;
    clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  function onMove(e) {
    if (e.pointerId !== pointerId || settled) return;
    const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    if (moved <= MOVE_THRESHOLD_PX) return;
    if (requiresHold) {
      cleanup(); // treat as a scroll swipe, not a drag
    } else {
      cleanup();
      startDrag(downEvent, cardEl, pointerId, onDrop);
    }
  }

  function onUp(e) {
    if (e.pointerId !== pointerId || settled) return;
    cleanup(); // plain tap/click -- let the native click event fire
  }

  const timer = requiresHold
    ? setTimeout(() => {
        cleanup();
        startDrag(downEvent, cardEl, pointerId, onDrop);
      }, HOLD_MS)
    : null;

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
}

function startDrag(downEvent, cardEl, pointerId, onDrop) {
  if (navigator.vibrate) navigator.vibrate(10);

  const rect = cardEl.getBoundingClientRect();
  const ghost = cardEl.cloneNode(true);
  ghost.classList.add('card-ghost');
  ghost.style.position = 'fixed';
  ghost.style.top = rect.top + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.margin = '0';
  document.body.appendChild(ghost);

  // The "snap in place" preview is a separate placeholder, not cardEl
  // itself. Reparenting the element that currently holds pointer capture
  // silently breaks that capture in Chromium -- moving cardEl between
  // cells mid-drag was cutting the pointermove stream off after the first
  // hop. cardEl stays exactly where it started (collapsed to nothing via
  // .drag-source) for the whole drag; only the placeholder moves.
  const placeholder = document.createElement('div');
  placeholder.className = 'card-drop-placeholder';
  placeholder.style.height = rect.height + 'px';
  cardEl.parentElement.insertBefore(placeholder, cardEl);

  cardEl.classList.add('drag-source');
  try {
    cardEl.setPointerCapture(pointerId);
  } catch {
    // No active pointer to capture (practically never happens for a real
    // press). Abort cleanly rather than leaving the ghost/placeholder
    // stuck with no listeners ever attached to clean them up.
    cardEl.classList.remove('drag-source');
    ghost.remove();
    placeholder.remove();
    return;
  }
  document.body.style.cursor = 'grabbing';

  const state = {
    pointerId,
    cardEl,
    ghost,
    placeholder,
    offsetX: downEvent.clientX - rect.left,
    offsetY: downEvent.clientY - rect.top,
    hoveredCell: cardEl.closest('.cell'),
    moved: false,
  };

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    state.moved = true;
    ghost.style.left = e.clientX - state.offsetX + 'px';
    ghost.style.top = e.clientY - state.offsetY + 'px';
    updateHover(e.clientX, e.clientY, state);
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    cardEl.removeEventListener('pointermove', onMove);
    cardEl.removeEventListener('pointerup', onUp);
    cardEl.removeEventListener('pointercancel', onUp);
    endDrag(state, onDrop);
  }

  // Bound to cardEl (not window): setPointerCapture routes this pointer's
  // events here regardless of what's visually underneath it.
  cardEl.addEventListener('pointermove', onMove, { passive: false });
  cardEl.addEventListener('pointerup', onUp, { passive: true });
  cardEl.addEventListener('pointercancel', onUp, { passive: true }); // interrupted gesture ends the drag too, not just pointerup
}

// Ghost and placeholder both have pointer-events:none, so elementFromPoint
// sees through them to whatever cell is actually underneath.
function updateHover(clientX, clientY, state) {
  const under = document.elementFromPoint(clientX, clientY);
  const cell = under?.closest('.cell') || null;

  if (cell !== state.hoveredCell) {
    state.hoveredCell?.classList.remove('drag-over');
    cell?.classList.add('drag-over');
    state.hoveredCell = cell;
  }
  if (!cell) return;

  // Detach the placeholder before measuring siblings. Otherwise, once it
  // lands before a card, that card gets pushed down by the placeholder's
  // own height -- which shifts its midpoint down too, so the pointer
  // keeps reading as "still above it" long after it has visually passed.
  state.placeholder.remove();

  const addBtn = cell.querySelector('.add-card-btn');
  const siblings = [...cell.querySelectorAll('.card')].filter(el => el !== state.cardEl);
  let target = addBtn; // default: land at the end, just before the add-card button
  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) {
      target = sib;
      break;
    }
  }
  cell.insertBefore(state.placeholder, target);
}

function endDrag(state, onDrop) {
  try {
    state.cardEl.releasePointerCapture(state.pointerId);
  } catch {
    // pointercancel already auto-released capture; releasing again throws
  }
  document.body.style.cursor = '';
  state.ghost.remove();
  state.hoveredCell?.classList.remove('drag-over');
  state.cardEl.classList.remove('drag-source');

  const finalCell = state.placeholder.parentElement;
  const wasMoved = state.moved && !!finalCell;
  if (wasMoved) {
    // Swap the real card in where the placeholder was tracking. Safe to
    // reparent cardEl now -- the drag (and its need for capture) is over.
    finalCell.insertBefore(state.cardEl, state.placeholder);
  }
  state.placeholder.remove();

  if (wasMoved) {
    onDrop({ cardEl: state.cardEl, cell: finalCell });
  }

  // A drag that reparented the card (or even just entered drag mode on
  // touch) must not also fire the click-to-edit handler right afterward.
  suppressNextClick(state.cardEl);
}

function suppressNextClick(cardEl) {
  const swallow = e => {
    e.stopPropagation();
    cardEl.removeEventListener('click', swallow, true);
  };
  cardEl.addEventListener('click', swallow, true); // capture phase: runs before #project-list's delegated listener
}
