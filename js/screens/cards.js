import { D, THEME_NAMES } from '../data.js';
import { get, update, today } from '../store.js';
import { esc, header, playBtn, playPair, artWord, plural, ipa, approx, segmented, toast, ICON } from '../ui.js';
import { schedule, previewInterval, checkTyping, shuffle } from '../grading.js';
import * as audio from '../audio.js';
import { recordHTML, register } from '../speech.js';
import { completeFromQuery, fromBar } from '../main.js';

const KNOWN_IVL = 7;

export function deckWords(deck) {
  if (!deck || deck === 'all') return D.vocab;
  if (deck.startsWith('les-')) { const n = Number(deck.slice(4)); return D.vocab.filter(v => v.les.includes(n)); }
  if (deck.startsWith('th-')) { const t = deck.slice(3); return D.vocab.filter(v => v.theme === t); }
  return D.vocab;
}
export function deckName(deck) {
  if (!deck || deck === 'all') return 'All words';
  if (deck.startsWith('les-')) { const l = D.lessonByN.get(Number(deck.slice(4))); return `Lektion ${deck.slice(4)}: ${l ? l.title : ''}`; }
  const t = deck.slice(3); return THEME_NAMES[t] ? THEME_NAMES[t][0] : t;
}
const key = (v, dir) => `${v.id}|${dir}`;
export function wordStatus(v) {
  const c = get().cards;
  const a = c[key(v, 'df')], b = c[key(v, 'fd')];
  if (!a && !b) return 'new';
  const best = Math.max(a?.ivl || 0, b?.ivl || 0);
  return best >= KNOWN_IVL ? 'known' : 'learning';
}
function counts(words, dir) {
  const now = Date.now(), c = get().cards;
  let due = 0, fresh = 0, known = 0;
  for (const v of words) {
    const st = c[key(v, dir)];
    if (!st) fresh++;
    else if (st.due <= now) due++;
    if (wordStatus(v) === 'known') known++;
  }
  return { due, fresh, known, total: words.length };
}
function newLeft() {
  const s = get();
  return Math.max(0, (s.settings.newPerDay || 15) - (s.newLog[today()] || 0));
}
function dir() { return get().settings.dir || 'df'; }

export function render(main, parts, query) {
  if (parts[1] === 'session') return session(main, query);
  if (parts[1] === 'deck') return deckPage(main, parts[2], query);
  overview(main);
}

function deckRow(deck, title, sub) {
  const c = counts(deckWords(deck), dir());
  return `<li><a href="#/cards/deck/${deck}"><span class="grow"><span class="t">${esc(title)}</span><span class="s">${esc(sub ? sub + ' · ' : '')}${c.total} words · ${c.known} known</span></span>${c.due ? `<span class="badge acc">${c.due} due</span>` : ''}${c.fresh ? `<span class="badge">${c.fresh} new</span>` : ''}<span class="chev"></span></a></li>`;
}

function overview(main) {
  const all = counts(D.vocab, dir());
  main.innerHTML = `${header('Karten', { sub: `${all.known} of ${all.total} words known · ${newLeft()} new words left today` })}
    ${segmented('dir', [['df', 'Deutsch → Français'], ['fd', 'Français → Deutsch']], dir())}
    <div class="card">
      <h3 style="margin-top:0">In a rush?</h3>
      <p class="small muted">5 cards in about two minutes: what is due first, then new words. Native voices, French translation on every card.</p>
      <div class="row wrap"><a class="btn primary" href="#/cards/session?deck=all&mode=quick">Quick 5: all words</a><a class="btn" href="#/cards/session?deck=all&mode=review">Review all due (${all.due})</a></div>
    </div>
    <h2>By theme</h2>
    <ul class="list">${D.themes.map(t => deckRow('th-' + t, THEME_NAMES[t]?.[0] || t, THEME_NAMES[t]?.[1])).join('')}</ul>
    <h2>By lesson</h2>
    <ul class="list">${D.lessons.map(l => deckRow('les-' + l.n, 'Lektion ' + l.n, l.title)).join('')}</ul>
    <h2>Everything</h2>
    <ul class="list">${deckRow('all', 'All words', '')}</ul>
    <p class="small muted">Articles are coloured: <span class="art der">der</span>, <span class="art die">die</span>, <span class="art das">das</span>.</p>`;
  main.querySelectorAll('[data-seg=dir] button').forEach(b => b.addEventListener('click', () => { update(s => { s.settings.dir = b.dataset.v; }); overview(main); }));
}

function deckPage(main, deck, query) {
  const words = deckWords(deck);
  const c = counts(words, dir());
  const st = { new: 0, learning: 0, known: 0 };
  words.forEach(v => st[wordStatus(v)]++);
  const q = m => `#/cards/session?deck=${deck}&mode=${m}${query.from ? '&from=' + query.from : ''}`;
  main.innerHTML = `${header(deckName(deck), { back: '#/cards', sub: `${words.length} words` })}
    ${segmented('dir', [['df', 'Deutsch → Français'], ['fd', 'Français → Deutsch']], dir())}
    <div class="grid3"><div class="stat"><b>${c.due}</b><span>due now</span></div><div class="stat"><b>${st.learning}</b><span>learning</span></div><div class="stat"><b>${st.known}</b><span>known</span></div></div>
    <div class="progressbar"><i style="width:${(100 * st.known) / Math.max(1, words.length)}%"></i></div>
    <div style="display:grid;gap:8px;margin:14px 0">
      <a class="btn primary block" href="${q('quick')}">Quick 5 (about 2 minutes)</a>
      <a class="btn block" href="${q('review')}">Review: ${c.due} due + up to ${Math.min(newLeft(), c.fresh)} new</a>
      <a class="btn block" href="${q('learn')}">Learn this deck now (${c.fresh} new, no daily limit)</a>
      <a class="btn block" href="${q('type')}">Typing mode: Français → Deutsch</a>
    </div>
    <details><summary>All words in this deck</summary><ul class="list">${words.map(v => `<li><div class="li"><span class="grow"><span class="t">${artWord(v)}</span><span class="s">${esc(v.fr)} · ${esc(v.en)}</span></span><span class="badge ${wordStatus(v) === 'known' ? 'good' : ''}">${wordStatus(v)}</span>${playBtn(v.a?.w)}</div></li>`).join('')}</ul></details>`;
  main.querySelectorAll('[data-seg=dir] button').forEach(b => b.addEventListener('click', () => { update(s => { s.settings.dir = b.dataset.v; }); deckPage(main, deck, query); }));
}

// ---------- session ----------
function buildQueue(words, mode, d) {
  const now = Date.now(), c = get().cards;
  const due = words.filter(v => c[key(v, d)] && c[key(v, d)].due <= now).sort((a, b) => c[key(a, d)].due - c[key(b, d)].due);
  const fresh = words.filter(v => !c[key(v, d)]);
  if (mode === 'learn') return fresh.slice(0, 20);
  if (mode === 'quick') return [...due, ...fresh].slice(0, 5);
  if (mode === 'type') return [...due, ...fresh.slice(0, Math.max(5, newLeft()))].slice(0, 15);
  return [...due, ...fresh.slice(0, newLeft())];
}

function session(main, query) {
  const deck = query.deck || 'all', mode = query.mode || 'review';
  const d = mode === 'type' ? 'fd' : dir();
  const words = deckWords(deck);
  let queue = buildQueue(words, mode, d);
  const stats = { seen: 0, again: 0, total: queue.length };
  const back = `#/cards/deck/${deck}${query.from ? '?from=' + query.from : ''}`;
  const title = { quick: 'Quick 5', review: 'Review', learn: 'Learn now', type: 'Typing' }[mode] || 'Cards';

  if (!queue.length) {
    main.innerHTML = `${header(title, { back, sub: deckName(deck) })}<div class="fb good"><p><b>Nothing to do here right now.</b></p><p>No cards are due${mode === 'review' && !newLeft() ? ' and today\'s new-word limit is reached' : ''}. Try "Learn this deck now" or another deck.</p></div>
      <a class="btn block" href="#/cards/session?deck=${deck}&mode=learn${query.from ? '&from=' + query.from : ''}">Learn new words anyway</a>${fromBar(query)}`;
    if (query.from) completeFromQuery(query);
    return;
  }

  const showCard = () => {
    if (!queue.length) return finish();
    const v = queue[0];
    const st = get().cards[key(v, d)];
    main.innerHTML = `${header(title, { back, sub: `${deckName(deck)} · ${queue.length} left` })}
      <div class="progressbar"><i style="width:${(100 * stats.seen) / Math.max(1, stats.seen + queue.length)}%"></i></div>
      <div class="flash" id="flash">${front(v, d, mode)}</div>
      <div id="ctrl"></div>`;
    const ctrl = main.querySelector('#ctrl');
    if (d === 'df') audio.play(v.a?.w);
    if (mode === 'type') {
      ctrl.innerHTML = `<input id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="der, die, das + word" lang="de">
        <div class="umlautbar">${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(ch => `<button data-ch="${ch}">${ch}</button>`).join('')}</div>
        <button class="btn primary block" id="check">Check</button><p class="kbd-hint">Nouns need their article. ae, oe, ue instead of ä, ö, ü counts as a small mistake.</p>`;
      const inp = ctrl.querySelector('#ans');
      setTimeout(() => inp.focus(), 50);
      ctrl.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.ch + inp.value.slice(p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); }));
      const check = () => {
        const r = checkTyping(v, inp.value);
        const g = r.grade === 'perfect' ? 'good' : r.grade === 'minor' ? 'hard' : 'again';
        reveal(v, d, r);
        ctrl.innerHTML = `<button class="btn primary block" id="next">Next</button>`;
        grade(v, g, true);
        ctrl.querySelector('#next').addEventListener('click', showCard);
      };
      ctrl.querySelector('#check').addEventListener('click', check);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    } else {
      ctrl.innerHTML = `<button class="btn primary block" id="show">Show answer</button>`;
      ctrl.querySelector('#show').addEventListener('click', () => {
        reveal(v, d, null);
        ctrl.innerHTML = `<div class="grades">${[['again', 'Again'], ['hard', 'Hard'], ['good', 'Good'], ['easy', 'Easy']].map(([g, l]) => `<button class="${g}" data-g="${g}">${l}<small>${previewInterval(st, g)}</small></button>`).join('')}</div>`;
        ctrl.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { grade(v, b.dataset.g, false); showCard(); }));
      });
    }
  };

  const grade = (v, g, typed) => {
    const k = key(v, d);
    update(s => {
      if (!s.cards[k]) s.newLog[today()] = (s.newLog[today()] || 0) + 1;
      s.cards[k] = schedule(s.cards[k], g);
    });
    queue.shift();
    stats.seen++;
    if (g === 'again') { stats.again++; queue.splice(Math.min(3, queue.length), 0, v); }
  };

  const reveal = (v, d, typed) => {
    const el = main.querySelector('#flash');
    el.innerHTML = front(v, d, mode) + (typed ? typedHTML(typed) : '') + backHTML(v, d);
    register('card-' + v.id, { kind: 'sentence', target: v.de.replace(/\.\.\./g, ''), nativeKey: v.a?.w, vowel: true, tip: v.tip });
    if (d === 'fd') audio.play(v.a?.w);
  };

  const finish = () => {
    main.innerHTML = `${header('Session done', { back, sub: deckName(deck) })}
      <div class="fb good"><p><b>${stats.seen} cards reviewed.</b></p><p>${stats.again ? `${stats.again} needed another look; they come back sooner.` : 'No misses. Well done.'}</p></div>
      <div class="row wrap"><a class="btn primary" href="#/cards/session?deck=${deck}&mode=quick">Another quick 5</a><a class="btn" href="#/cards">All decks</a></div>${fromBar(query)}`;
    if (query.from) completeFromQuery(query);
  };
  showCard();
}

function front(v, d, mode) {
  if (d === 'df') return `<div class="front">${artWord(v)}</div><div class="center">${playPair(v.a?.w)}</div>`;
  return `<div class="front frtxt">${esc(v.fr)}</div><p class="center muted">${esc(v.en)}${v.art ? ' · noun' : v.pos ? ' · ' + esc(v.pos) : ''}</p>`;
}

function typedHTML(r) {
  const cls = r.grade === 'perfect' ? 'good' : r.grade === 'minor' ? 'warn' : 'bad';
  const head = r.grade === 'perfect' ? 'Correct.' : r.grade === 'minor' ? 'Almost: small mistake.' : 'Not quite.';
  const diff = r.grade === 'perfect' ? '' : `<p class="small muted">Your answer compared with the right one (red = wrong or extra, green underline = missing):</p><div class="diff">${r.diff.map(x => x.t === 'same' ? `<span class="ok">${esc(x.a)}</span>` : x.t === 'del' ? `<span class="del">${esc(x.a)}</span>` : x.t === 'ins' ? `<span class="ins">${esc(x.b)}</span>` : `<span class="sub">${esc(x.b)}</span><span class="del">${esc(x.a)}</span>`).join('')}</div>`;
  return `<div class="fb ${cls}"><p><b>${head}</b> ${r.grade !== 'perfect' ? 'Right answer: <b>' + esc(r.expected) + '</b>' : ''}</p>${r.issues.map(i => `<p class="small">${esc(i)}</p>`).join('')}${diff}</div>`;
}

export function backHTML(v) {
  return `
    <div class="layer"><b>Hochdeutsch</b><div><span class="big">${artWord(v)}</span> ${playBtn(v.a?.w)}${v.pl ? `<div>Plural: ${plural(v)} ${playBtn(v.a?.pl)}</div>` : ''}${v.forms ? `<div class="small">${esc(v.forms)}</div>` : ''}</div></div>
    <div class="layer"><b>IPA</b><div>${ipa(v.ipa)}</div></div>
    <div class="layer"><b>Sounds like</b><div>${approx(v.approx)}</div></div>
    ${v.ch ? `<div class="layer"><b>Zürich</b><div class="ch">${esc(v.ch)}${v.chNote ? `<div class="small">${esc(v.chNote)}</div>` : ''}</div></div>` : ''}
    <div class="layer"><b>Meaning</b><div><div>🇫🇷 ${esc(v.fr)}</div><div class="muted">🇬🇧 ${esc(v.en)}</div></div></div>
    ${v.ex ? `<div class="layer"><b>Example</b><div><div class="de">${esc(v.ex)}</div><div class="fr small">${esc(v.exFr)}</div><div class="row" style="margin-top:4px">${playPair(v.a?.ex)}</div></div></div>` : ''}
    ${v.tip ? `<div class="layer"><b>Say it</b><div class="small">${esc(v.tip)}</div></div>` : ''}
    <div class="layer recwrap"><b>Test me</b><div>${recordHTML('card-' + v.id, 'Say the word')}</div></div>`;
}
