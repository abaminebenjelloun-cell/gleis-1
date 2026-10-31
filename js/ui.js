// Small DOM helpers shared by all screens.
import * as audio from './audio.js';
import { get } from './store.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  slow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" opacity=".55"/><text x="12" y="23" font-size="7" text-anchor="middle" font-family="sans-serif" font-weight="700">0.75</text></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
};

// audio button markup. data-k is the clip key, data-rate optional
export function playBtn(k, { slow = false, label = '', cls = '' } = {}) {
  if (!k) return '';
  const rate = slow ? (get().settings.slowRate || 0.75) : 1;
  return `<button class="pbtn ${slow ? 'slow' : ''} ${cls}" data-k="${esc(k)}" data-rate="${rate}" aria-label="${slow ? 'Play slowly' : 'Play'} ${esc(label)}">${slow ? ICON.slow : ICON.play}${label ? `<span>${esc(label)}</span>` : ''}</button>`;
}
export function playPair(k, label = '') {
  return k ? `<span class="pgroup">${playBtn(k, { label })}${playBtn(k, { slow: true })}</span>` : '';
}

// one delegated listener for every play button in the app
document.addEventListener('click', e => {
  const b = e.target.closest('.pbtn[data-k]');
  if (!b) return;
  e.preventDefault();
  if (b.classList.contains('playing')) { audio.stop(); return; }
  audio.play(b.dataset.k, { rate: Number(b.dataset.rate) || 1, btn: b });
});

export function artClass(art) {
  if (!art) return '';
  if (art.startsWith('der')) return 'der';
  if (art.startsWith('das')) return 'das';
  return 'die';
}
export function artWord(v) {
  const a = v.art === 'die (Pl.)' ? 'die' : v.art;
  if (!a) return `<span class="w">${esc(v.de)}</span>`;
  return `<span class="art ${artClass(a)}">${esc(a)}</span> <span class="w">${esc(v.de)}</span>${v.art === 'die (Pl.)' ? ' <small class="muted">(plural only)</small>' : ''}`;
}
export function plural(v) {
  if (!v.pl) return '';
  if (!/^die /.test(v.pl)) return esc(v.pl); // "kein Plural", "nur Singular"
  return `<span class="art die">${esc(v.pl.split(' ')[0])}</span> ${esc(v.pl.split(' ').slice(1).join(' '))}`;
}

export function toast(msg, ms = 2200) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

export function header(title, { back = null, sub = '' } = {}) {
  return `<header class="top">${back ? `<a class="back" href="${back}" aria-label="Back">${ICON.back}</a>` : ''}<div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div></header>`;
}

export function segmented(name, options, value) {
  return `<div class="seg" role="tablist" data-seg="${esc(name)}">${options.map(([v, l]) => `<button role="tab" data-v="${esc(v)}" class="${String(v) === String(value) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
}

export function ipa(s) { return s ? `<span class="ipa">${esc(s)}</span>` : ''; }
export function approx(s) { return s ? `<span class="approx" title="French-style: CAPS = stressed, : = long">${esc(s)}</span>` : ''; }

export function pct(r, w) { return r + w ? Math.round((100 * r) / (r + w)) + '%' : 'none yet'; }
