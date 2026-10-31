import { D } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, playBtn, playPair, ipa, approx, segmented, ICON } from '../ui.js';
import { numberToGerman, shuffle } from '../grading.js';
import * as audio from '../audio.js';
import { recordHTML, register } from '../speech.js';
import { fromBar } from '../main.js';

const TRAPS = new Set(['C', 'E', 'G', 'J', 'U', 'V', 'W', 'Z']);
const TABS = [['letters', 'Letters'], ['spell', 'Spell'], ['numbers', 'Numbers'], ['builder', 'Builder'], ['dictation', 'Dictation']];

export function render(main, parts, query) {
  const tab = parts[2] || 'letters';
  main.innerHTML = `${header('Alphabet und Zahlen', { back: '#/pron' })}
    ${segmented('abc', TABS, tab)}<div id="abc"></div>${fromBar(query)}`;
  main.querySelectorAll('[data-seg=abc] button').forEach(b => b.addEventListener('click', () => {
    location.hash = `#/pron/abc/${b.dataset.v}${query.from ? '?from=' + query.from : ''}`;
  }));
  const box = main.querySelector('#abc');
  ({ letters, spell, numbers, builder, dictation }[tab] || letters)(box);
}

function letterByChar(ch) {
  const up = ch === 'ß' ? 'ß' : ch.toUpperCase();
  return D.abc.letters.find(l => l.l === up);
}

function letters(box) {
  const L = D.abc.letters;
  box.innerHTML = `<p class="small muted">Plum letters are the French traps: C, E, G, J, U, V, W and Z sound different from French. Tap a letter.</p>
    <div class="letters">${L.map((l, i) => `<button data-i="${i}" class="${TRAPS.has(l.l) ? 'trap' : ''}">${esc(l.l)}<small>${esc(l.name)}</small></button>`).join('')}</div>
    <div id="ld"></div>`;
  const show = i => {
    const l = L[i];
    box.querySelectorAll('.letters button').forEach((b, k) => b.classList.toggle('sel', k === i));
    box.querySelector('#ld').innerHTML = `<div class="card recwrap" style="margin-top:12px">
      <div class="row between"><h2 style="margin:0">${esc(l.l)} <span class="muted" style="font-weight:400">${esc(l.name)}</span></h2>${playPair(l.k)}</div>
      <p>${ipa(l.ipa)} · ${approx(l.approx)}</p>
      <p class="explain">${esc(l.tip)}</p>
      <p>Example: <b class="de">${esc(l.word)}</b> <span class="fr">${esc(l.wordFr)}</span> ${playBtn(l.kw)}</p>
      ${recordHTML('letter', 'Say the letter')}</div>`;
    register('letter', { kind: 'word', target: l.say || l.name, nativeKey: l.k, label: 'Say the letter' });
    audio.play(l.k);
  };
  box.querySelectorAll('.letters button').forEach(b => b.addEventListener('click', () => show(Number(b.dataset.i))));
}

function spell(box) {
  box.innerHTML = `<h3>Spell any word</h3><p class="small muted">Type a word (your name, your street) and hear it spelled with the German letter names.</p>
    <div class="row"><input id="sw" placeholder="Benjelloun" autocapitalize="characters" autocomplete="off"><button class="btn primary" id="sp">${ICON.play}</button></div>
    <p id="say" class="approx" style="margin-top:8px"></p>
    <h3>Spelling words</h3><ul class="list">${D.abc.spell.map(s => `<li><div class="li"><span class="grow"><span class="t">${esc(s.w)}</span><span class="s">${esc(s.say)}</span></span>${playPair(s.k)}</div></li>`).join('')}</ul>`;
  const inp = box.querySelector('#sw');
  box.querySelector('#sp').addEventListener('click', e => {
    const chars = [...inp.value].filter(c => /[A-Za-zÄÖÜäöüß]/.test(c));
    const ls = chars.map(letterByChar).filter(Boolean);
    box.querySelector('#say').textContent = ls.map(l => l.name).join(', ');
    const items = box.querySelectorAll('#say');
    audio.playSeq(ls.map(l => l.k), { gap: 150, btn: e.currentTarget });
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') box.querySelector('#sp').click(); });
}

function numbers(box) {
  const groups = [...new Set(D.abc.numbers.map(n => n.group))];
  box.innerHTML = groups.map(g => `<h3>${esc(g)}</h3><ul class="list">${D.abc.numbers.filter(n => n.group === g).map(n => `<li><div class="li"><span class="badge acc" style="min-width:44px;text-align:center">${esc(n.n)}</span><span class="grow"><span class="t">${esc(n.word)}</span><span class="s">${ipa(n.ipa)} · ${approx(n.approx)}${n.tip ? ' · ' + esc(n.tip) : ''}</span></span>${playPair(n.k)}</div></li>`).join('')}</ul>`).join('');
}

function builder(box) {
  box.innerHTML = `<h3>Number builder</h3><p class="small muted">Type digits and see the German word. German says the units before the tens: 47 = sieben-und-vierzig.</p>
    <input id="nb" inputmode="numeric" placeholder="e.g. 1987" autocomplete="off"><div id="nbo" class="card" style="margin-top:10px"><p class="muted">The word appears here.</p></div>`;
  const inp = box.querySelector('#nb');
  inp.addEventListener('input', () => {
    const v = inp.value.replace(/\D/g, '');
    const out = box.querySelector('#nbo');
    if (!v) { out.innerHTML = '<p class="muted">The word appears here.</p>'; return; }
    const n = Number(v);
    const w = numberToGerman(n);
    const clip = D.abc.numbers.find(x => x.n === v) || D.abc.dictNums.find(x => String(x.n) === v);
    const yr = n >= 1100 && n <= 1999 ? `<p class="small">As a year: <b>${esc(numberToGerman(Math.floor(n / 100)) + 'hundert' + (n % 100 ? numberToGerman(n % 100) : ''))}</b></p>` : '';
    const parts = n > 20 && n < 100 && n % 10 ? `<p class="small muted">${esc(numberToGerman(n % 10).replace(/^eins$/, 'ein'))} + und + ${esc(numberToGerman(n - (n % 10)))}</p>` : '';
    out.innerHTML = `<p style="font-size:1.4rem" class="de">${esc(w || 'too large')}</p>${parts}${yr}${clip ? `<div class="row">${playPair(clip.k)}</div>` : '<p class="small muted">No native clip for this exact number; the number list has the building blocks.</p>'}`;
  });
}

function dictation(box) {
  box.innerHTML = `<h3>Dictation</h3><p class="small muted">Listen and type what you hear. 10 questions.</p>
    <div class="grid3"><button class="btn" data-m="letters">Letters</button><button class="btn" data-m="spell">Spelled words</button><button class="btn" data-m="nums">Numbers</button></div><div id="dq"></div>`;
  box.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => quiz(box.querySelector('#dq'), b.dataset.m)));
}

function quiz(box, mode) {
  const items = mode === 'letters' ? shuffle(D.abc.letters).slice(0, 10).map(l => ({ k: l.k, ans: l.l, show: `${l.l} (${l.name})`, tip: l.tip }))
    : mode === 'spell' ? shuffle(D.abc.spell).slice(0, 10).map(s => ({ k: s.k, ans: s.w, show: `${s.w}: ${s.say}` }))
      : shuffle(D.abc.dictNums).slice(0, 10).map(n => ({ k: n.k, ans: String(n.n), show: `${n.n} = ${n.word}` }));
  let i = 0, right = 0;
  const norm = s => String(s).trim().toLowerCase().replace(/[\s.']/g, '');
  const show = () => {
    if (i >= items.length) {
      box.innerHTML = `<div class="fb ${right >= 8 ? 'good' : 'warn'}"><p><b>${right} of ${items.length} right.</b></p></div><button class="btn primary block" id="ag">Again</button>`;
      update(s => { s.ear.sessions.push({ t: Date.now(), r: right, n: items.length, kind: 'dict-' + mode }); });
      box.querySelector('#ag').addEventListener('click', () => quiz(box, mode));
      return;
    }
    const it = items[i];
    box.innerHTML = `<div class="card"><p class="small muted">${i + 1} of ${items.length}</p><div class="row">${playPair(it.k)}</div>
      <input id="da" style="margin-top:10px" autocomplete="off" autocapitalize="off" ${mode === 'nums' ? 'inputmode="numeric"' : ''} placeholder="${mode === 'letters' ? 'One letter' : mode === 'spell' ? 'The word' : 'Digits'}">
      <button class="btn primary block" id="dc" style="margin-top:8px">Check</button><div id="dfb"></div></div>`;
    audio.play(it.k);
    const inp = box.querySelector('#da');
    const check = () => {
      const ok = norm(inp.value) === norm(it.ans) || (mode === 'letters' && norm(inp.value) === norm(it.ans).replace('ß', 'ss'));
      if (ok) right++;
      update(s => { ok ? s.ear.r++ : s.ear.w++; });
      box.querySelector('#dfb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><p><b>${ok ? 'Richtig!' : 'Not quite.'}</b> ${esc(it.show)}</p>${!ok && it.tip ? `<p class="explain small">${esc(it.tip)}</p>` : ''}</div><button class="btn primary block" id="dn">Next</button>`;
      box.querySelector('#dc').remove();
      box.querySelector('#dn').addEventListener('click', () => { i++; show(); });
    };
    box.querySelector('#dc').addEventListener('click', check);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && box.querySelector('#dc')) check(); });
  };
  show();
}
