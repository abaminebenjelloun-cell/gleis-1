import { D } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, playBtn, playPair, ipa, approx, pct, ICON } from '../ui.js';
import { shuffle } from '../grading.js';
import * as audio from '../audio.js';
import { recordHTML, register, micStatusHTML } from '../speech.js';
import { completeFromQuery, fromBar } from '../main.js';

export async function render(main, parts, query) {
  if (parts[1] === 'abc') return (await import('./abc.js')).render(main, parts, query);
  if (parts[1] === 'section') return section(main, parts[2], query);
  if (parts[1] === 'ear') return ear(main, query);
  if (parts[1] === 'mic') return micTest(main);
  list(main);
}

function list(main) {
  const s = get();
  const tests = s.pron.length ? pct(s.pron.filter(p => p.ok).length, s.pron.filter(p => !p.ok).length) : 'none yet';
  main.innerHTML = `${header('Aussprache', { sub: `Ear training ${pct(s.ear.r, s.ear.w)} · pronunciation tests ${tests}` })}
    <div class="grid2">
      <a class="btn primary" href="#/pron/ear?focus=vowel%20length">Ear training: vowels</a>
      <a class="btn" href="#/pron/ear">Ear training: all pairs</a>
      <a class="btn" href="#/pron/abc/letters">Alphabet und Zahlen</a>
      <a class="btn" href="#/pron/mic">${ICON.mic} Test the microphone</a>
    </div>
    <h2>Sections</h2>
    <ul class="list">${D.pron.sections.map(x => {
      const n = s.pron.filter(p => sectionTargets(x).has(p.target));
      return `<li><a href="#/pron/section/${x.id}"><span class="grow"><span class="t">${esc(x.title)}</span><span class="s">${x.pairs.length} pairs · ${x.words.length} words · ${x.sentences.length} sentences${n.length ? ' · tests ' + pct(n.filter(p => p.ok).length, n.filter(p => !p.ok).length) : ''}</span></span><span class="chev"></span></a></li>`;
    }).join('')}</ul>`;
}
function sectionTargets(x) {
  const t = new Set();
  x.pairs.forEach(p => { t.add(p.a.w); t.add(p.b.w); });
  x.words.forEach(w => t.add(w.w));
  x.sentences.forEach(s => t.add(s.s));
  return t;
}

function wordLine(w, id, vowel) {
  return `<div class="card white recwrap"><div class="row between"><div><div class="de" style="font-size:1.25rem">${esc(w.w)}</div><div>${ipa(w.ipa)} · ${approx(w.approx)}</div><div class="fr small">${esc(w.fr)}</div></div></div>
    <div class="row wrap" style="margin-top:8px">${playPair(w.k)}${recordHTML(id, 'Say it')}</div></div>`;
}

function section(main, id, query) {
  const x = D.sectionById.get(id);
  if (!x) { main.innerHTML = '<p>Section not found.</p>'; return; }
  const vowel = x.focus === 'vowel length';
  main.innerHTML = `${header(x.title, { back: '#/pron', sub: x.focus })}
    <div class="richtext">${x.explain}</div>
    <div class="card"><h3 style="margin-top:0">How to make the sound</h3><div class="richtext">${x.howto}</div></div>
    <p class="small muted">Tap ${ICON.play.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} to hear the native voice, the 0.75 button to hear it slowly, and the plum button to record yourself: the app shows what a German listener heard${vowel ? ' and compares your vowel length with the native clip' : ''}.</p>
    ${x.pairs.length ? `<h2>Minimal pairs</h2><a class="btn block" href="#/pron/ear?section=${x.id}">Ear training on these pairs</a>
    ${x.pairs.map((p, i) => `<div class="card">
      <div class="grid2">${['a', 'b'].map(s => `<div class="recwrap"><div class="de" style="font-size:1.3rem">${esc(p[s].w)}</div><div class="small">${ipa(p[s].ipa)}</div><div class="small">${approx(p[s].approx)}</div><div class="fr small">${esc(p[s].fr)}</div>
        <div class="row wrap" style="margin-top:6px">${playPair(p[s].k)}</div><div style="margin-top:6px">${recordHTML(`pair-${i}-${s}`, 'Say ' + p[s].w)}</div></div>`).join('')}</div>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-both="${i}">${ICON.play} Play both</button><button class="btn sm" data-both="${i}" data-slow="1">Both slowly</button></div>
      ${p.note ? `<p class="explain small">${esc(p.note)}</p>` : ''}
    </div>`).join('')}` : ''}
    ${x.words.length ? `<h2>Practice words</h2>${x.words.map((w, i) => wordLine(w, `w-${i}`, vowel)).join('')}` : ''}
    ${x.sentences.length ? `<h2>Shadowing sentences</h2><p class="small muted">Play, then say it at the same time as the voice. Record to see word by word what was understood.</p>
    ${x.sentences.map((s, i) => `<div class="card white recwrap"><p class="de">${esc(s.s)}</p><p class="fr small">${esc(s.fr)}</p>${s.focus ? `<p class="small muted">Focus: ${esc(s.focus)}</p>` : ''}<div class="row wrap">${playPair(s.k)}${recordHTML(`s-${i}`, 'Record')}</div></div>`).join('')}` : ''}
    ${fromBar(query)}`;

  x.pairs.forEach((p, i) => ['a', 'b'].forEach(s => register(`pair-${i}-${s}`, { kind: 'pair', pair: p, aim: s, target: p[s].w, nativeKey: p[s].k, vowel, autoVowel: vowel, label: 'Say ' + p[s].w })));
  x.words.forEach((w, i) => register(`w-${i}`, { kind: 'word', target: w.w, nativeKey: w.k, vowel, autoVowel: vowel, label: 'Say it' }));
  x.sentences.forEach((s, i) => register(`s-${i}`, { kind: 'sentence', target: s.s, nativeKey: s.k }));
  main.querySelectorAll('[data-both]').forEach(b => b.addEventListener('click', () => {
    const p = x.pairs[Number(b.dataset.both)];
    audio.playSeq([p.a.k, p.b.k], { rate: b.dataset.slow ? get().settings.slowRate : 1, gap: 600, btn: b });
  }));
}

function ear(main, query) {
  let pool = [];
  let title = 'Ear training';
  if (query.section) { const x = D.sectionById.get(query.section); pool = x.pairs; title = x.title; }
  else if (query.focus) { pool = D.pron.sections.filter(x => x.focus === query.focus).flatMap(x => x.pairs); title = 'Ear training: long and short vowels'; }
  else pool = D.pron.sections.flatMap(x => x.pairs);
  const qs = shuffle(pool).slice(0, 10).map(p => ({ p, side: Math.random() < 0.5 ? 'a' : 'b' }));
  let i = 0, right = 0;
  const back = query.section ? '#/pron/section/' + query.section : '#/pron';
  const show = () => {
    if (i >= qs.length) return finish();
    const { p, side } = qs[i];
    main.innerHTML = `${header(title, { back, sub: `Question ${i + 1} of ${qs.length}` })}
      <div class="progressbar"><i style="width:${(100 * i) / qs.length}%"></i></div>
      <p class="q center">Which word do you hear?</p>
      <div class="center row" style="justify-content:center">${playBtn(p[side].k, { label: 'Play again' })}${playBtn(p[side].k, { slow: true })}</div>
      <div class="opts" style="margin-top:16px">${['a', 'b'].map(s => `<button data-s="${s}"><b>${esc(p[s].w)}</b> <span class="small">${ipa(p[s].ipa)}</span> <span class="fr small">${esc(p[s].fr)}</span></button>`).join('')}</div>
      <div id="fb"></div>`;
    setTimeout(() => audio.play(p[side].k), 200);
    main.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.s === side;
      if (ok) right++;
      update(s => { ok ? s.ear.r++ : s.ear.w++; });
      main.querySelectorAll('[data-s]').forEach(x => { x.disabled = true; if (x.dataset.s === side) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const other = side === 'a' ? 'b' : 'a';
      main.querySelector('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><p><b>${ok ? 'Richtig!' : 'Not this time.'}</b> You heard <b>${esc(p[side].w)}</b> (${esc(p[side].fr)}).</p>
        ${p.note ? `<p class="explain small">${esc(p.note)}</p>` : ''}
        <div class="row wrap"><button class="btn sm" data-cmp>${ICON.play} ${esc(p[side].w)}, then ${esc(p[other].w)}</button></div></div>
        <button class="btn primary block" id="nx">Next</button>`;
      main.querySelector('[data-cmp]').addEventListener('click', e => audio.playSeq([p[side].k, p[other].k], { gap: 600, btn: e.currentTarget }));
      main.querySelector('#nx').addEventListener('click', () => { i++; show(); });
    }));
  };
  const finish = () => {
    update(s => { s.ear.sessions.push({ t: Date.now(), r: right, n: qs.length }); });
    main.innerHTML = `${header(title, { back })}<div class="fb ${right >= 8 ? 'good' : 'warn'}"><p><b>${right} of ${qs.length} right.</b></p><p>${right >= 8 ? 'Your ear is getting sharp.' : 'Go back to the pairs and listen to both words slowly, then try again.'}</p></div>
      <div class="row wrap"><button class="btn primary" id="again">Again</button><a class="btn" href="${back}">Back</a></div>${fromBar(query)}`;
    main.querySelector('#again').addEventListener('click', () => ear(main, query));
    if (query.from) completeFromQuery(query);
  };
  show();
}

function micTest(main) {
  main.innerHTML = `${header('Microphone test', { back: '#/pron' })}
    ${micStatusHTML()}
    <div class="card recwrap"><p>Tap the button and say <b class="de">Guten Tag, ich heiße …</b> with your name.</p>${recordHTML('mictest', 'Record')}</div>
    <div class="card"><h3 style="margin-top:0">If it does not work on iPhone</h3><ol class="small">
      <li>Open the app from its https address (GitHub Pages), not from a file.</li>
      <li>Allow the microphone when Safari asks. If you said no: Settings > Apps > Safari > Microphone > Ask or Allow.</li>
      <li>Speech recognition uses Apple dictation: Settings > General > Keyboard > Enable Dictation must be on.</li>
      <li>If the home screen app shows no recognition, open the same address in a Safari tab: recording works in both, recognition is most reliable in Safari.</li>
    </ol></div>`;
  register('mictest', { kind: 'free', target: '' });
}
