import { loadAll, D } from './data.js';
import { get, update, save } from './store.js';
import { esc, $ } from './ui.js';
import { clearRegistry } from './speech.js';
import * as audio from './audio.js';

const screens = {
  today: () => import('./screens/today.js'),
  lessons: () => import('./screens/lessons.js'),
  cards: () => import('./screens/cards.js'),
  grammar: () => import('./screens/grammar.js'),
  pron: () => import('./screens/pron.js'),
  exam: () => import('./screens/exam.js'),
  progress: () => import('./screens/progress.js'),
};

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '') || 'today';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts, query };
}
export function go(hash) { location.hash = hash; }

// act from a program block -> route
export function actRoute(act, from = '') {
  const q = (base, params) => {
    if (from) params.from = from;
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    return '#/' + base + (s ? '?' + s : '');
  };
  switch (act.t) {
    case 'cards': return q('cards/session', { deck: act.lesson ? 'les-' + act.lesson : 'all', mode: 'review' });
    case 'lesson': return q('lessons/' + act.lesson, { dialogue: act.dialogue });
    case 'abc': return q('pron/abc/' + (act.tab || 'letters'), {});
    case 'grammar': return q('grammar/drill', { topics: (act.topics || []).join(','), lesson: act.lesson, n: act.n });
    case 'gmix': return q('grammar/mix', {});
    case 'pron': return q('pron/section/' + act.section, {});
    case 'ear': return q('pron/ear', { focus: 'vowel length' });
    case 'speak': return q('lessons/' + act.lesson, { tab: act.writing ? 'writing' : 'speaking' });
    case 'exam': return q('exam/' + act.sec + (act.set !== undefined ? '/' + act.set : ''), {});
    case 'claude': return q('claude', { prompt: act.prompt });
    default: return '#/today';
  }
}

// a screen opened from Today carries ?from=<day>.<block>; finishing it ticks the block
export function completeFromQuery(query) {
  if (!query || !query.from) return;
  const [d, b] = query.from.split('.').map(Number);
  update(s => {
    const day = (s.days[d] = s.days[d] || { blocks: {} });
    day.blocks[b] = true;
  });
  checkDayDone(d);
}
export function checkDayDone(d) {
  const day = D.program[d];
  const st = get().days[d];
  if (!day || !st) return false;
  // optional course-book blocks do not hold the day back
  const all = day.blocks.every((b, i) => st.blocks[i] || b.src === 'book');
  if (all && !st.done) {
    update(s => {
      s.days[d].done = Date.now();
      if (s.day === d) {
        let n = d + 1;
        while (n < D.program.length && s.days[n]?.done) n++;
        s.day = Math.min(n, D.program.length - 1);
      }
    });
    return true;
  }
  return all;
}
export function fromBar(query) {
  if (!query.from) return '';
  const [d, b] = query.from.split('.').map(Number);
  const done = get().days[d]?.blocks?.[b];
  return `<div class="frombar"><span>Tag ${d + 1}: ${esc(D.program[d]?.blocks[b]?.label || '')}</span><button class="btn sm ${done ? '' : 'primary'}" data-fromdone="${esc(query.from)}">${done ? 'Done ✓' : 'Mark done'}</button></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fromdone]');
  if (!b) return;
  completeFromQuery({ from: b.dataset.fromdone });
  b.textContent = 'Done ✓';
  b.classList.remove('primary');
  setTimeout(() => go('#/today'), 400);
});

const TABS = [
  ['today', 'Heute', '<path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 7h14v11H5zm2 2v2h2v-2zm4 0v2h2v-2z"/>'],
  ['lessons', 'Lektionen', '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zm16 0h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z"/>'],
  ['cards', 'Karten', '<path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm16-2v14a3 3 0 0 0 2-3V8a3 3 0 0 0-2-3z"/>'],
  ['grammar', 'Grammatik', '<path d="M4 5h16v2H4zm0 6h10v2H4zm0 6h16v2H4zm13-7 3 2-3 2z"/>'],
  ['pron', 'Aussprache', '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V20H8v2h8v-2h-3v-2.1a7 7 0 0 0 6-6.9z"/>'],
  ['exam', 'Prüfung', '<path d="M9 2h6v2h4v18H5V4h4zm0 4H7v14h10V6h-2v2H9zm2-2v2h2V4zm-2 7h6v2H9zm0 4h6v2H9z"/>'],
  ['progress', 'Progress', '<path d="M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z"/>'],
];
function tabbar(active) {
  return TABS.map(([id, label, path]) => `<a href="#/${id}" class="${id === active ? 'on' : ''}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg><span>${label}</span></a>`).join('');
}

let renderToken = 0;
async function route() {
  const token = ++renderToken;
  const { parts, query } = parseHash();
  let name = parts[0] || 'today';
  if (name === 'claude') name = 'today';
  if (!screens[name]) name = 'today';
  $('#tabs').innerHTML = tabbar(name);
  audio.stop();
  clearRegistry();
  const main = $('#main');
  try {
    const mod = await screens[name]();
    if (token !== renderToken) return;
    main.innerHTML = '';
    window.scrollTo(0, 0);
    await mod.render(main, parts, query);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="pad"><h2>Something went wrong</h2><p class="bad">${esc(e.message)}</p><p><a href="#/today">Back to Heute</a></p></div>`;
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = get().settings.dark ? 'dark' : 'light';
}
export { applyTheme };

async function start() {
  applyTheme();
  try {
    await loadAll();
  } catch (e) {
    $('#main').innerHTML = `<div class="pad"><h2>Could not load the course</h2><p>${esc(e.message)}</p><p>Open the app once while online so it can be saved for offline use.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  }
  save();
}
start();
