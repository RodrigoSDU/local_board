// A deliberately restricted markdown renderer: bold, italic, bullet lists,
// and [ ]/[x] todo lines. It only ever builds DOM nodes from a fixed set
// of element types via createElement/createTextNode -- there is no code
// path that turns source text into innerHTML, so there is no way for a
// card description to inject markup, whitelist or otherwise. Unmatched
// markers (e.g. a stray "*") just render as literal characters.

const LIST_ITEM_RE = /^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.*)$/;
const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;

function appendInline(parent, text) {
  INLINE_RE.lastIndex = 0;
  let lastIndex = 0;
  let match;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    if (match[1] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = match[1];
      parent.appendChild(strong);
    } else {
      const em = document.createElement('em');
      em.textContent = match[2] !== undefined ? match[2] : match[3];
      parent.appendChild(em);
    }
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

// Renders `source` into `container` (clearing it first). Safe to call
// with any string, including one containing HTML -- it will only ever
// appear as literal text.
export function renderMarkdown(source, container) {
  container.innerHTML = '';
  if (!source || !source.trim()) return;

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraphLines = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const p = document.createElement('p');
    paragraphLines.forEach((line, idx) => {
      if (idx > 0) p.appendChild(document.createElement('br'));
      appendInline(p, line);
    });
    container.appendChild(p);
    paragraphLines = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (LIST_ITEM_RE.test(line)) {
      flushParagraph();
      const ul = document.createElement('ul');
      ul.className = 'md-list';
      while (i < lines.length) {
        const m = lines[i].match(LIST_ITEM_RE);
        if (!m) break;
        const [, checkState, text] = m;
        const li = document.createElement('li');
        if (checkState !== undefined) {
          li.className = 'md-todo';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.disabled = true;
          cb.checked = checkState.toLowerCase() === 'x';
          li.appendChild(cb);
        }
        const span = document.createElement('span');
        appendInline(span, text);
        li.appendChild(span);
        ul.appendChild(li);
        i++;
      }
      container.appendChild(ul);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      i++;
      continue;
    }

    paragraphLines.push(line);
    i++;
  }
  flushParagraph();
}
