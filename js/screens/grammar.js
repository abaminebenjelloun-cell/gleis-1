import { D } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, playPair, pct, ICON } from '../ui.js';
import { judgeDrill, shuffle } from '../grading.js';
import * as audio from '../audio.js';
import { completeFromQuery, fromBar } from '../main.js';

export function render(main, parts, query) {
  if (parts[1] === 'topic') return topic(main, parts[2], query);
  if (parts[1] === 'drill') return drills(main, pickDrills(query), query, 'Practice');
  if (parts[1] === 'mix') return drills(main, weakest(15), query, 'Mixed practice');
  list(main);
}

export function topicStats(id) {
  const st = get().drills;
  let r = 0, w = 0, seen = 0;
  const ds = D.grammar.drills.filter(d => d.topic === id);
  for (const d of ds) { const s = st[d.id]; if (s) { r += s.r; w += s.w; seen++; } }
  return { r, w, seen, total: ds.length };
}

function list(main) {
  const all = Object.values(get().drills).reduce((a, s) => ({ r: a.r + s.r, w: a.w + s.w }), { r: 0, w: 0 });
  main.innerHTML = `${header('Grammatik', { sub: `${D.grammar.topics.length} topics · ${D.grammar.drills.length} drills · accuracy ${pct(all.r, all.w)}` })}
    <a class="btn primary block" href="#/grammar/mix">Mixed practice: my weakest drills first</a>
    <ul class="list">${D.grammar.topics.map(t => {
      const s = topicStats(t.id);
      return `<li><a href="#/grammar/topic/${t.id}"><span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.summary)}</span></span><span class="badge ${s.seen ? (s.r / Math.max(1, s.r + s.w) >= 0.8 ? 'good' : '') : ''}">${s.seen ? pct(s.r, s.w) : s.total + ' drills'}</span><span class="chev"></span></a></li>`;
    }).join('')}</ul>`;
}

function topic(main, id, query) {
  const t = D.topicById.get(id);
  if (!t) { main.innerHTML = '<p>Topic not found.</p>'; return; }
  const s = topicStats(id);
  main.innerHTML = `${header(t.title, { back: '#/grammar' })}
    <p><b>${esc(t.summary)}</b></p>
    <div class="richtext">${t.explain}</div>
    <div class="card"><h3 style="margin-top:0">🇫🇷 Compared with French</h3><div class="richtext">${t.fr}</div></div>
    ${t.table ? `<div class="tablewrap"><table><thead><tr>${t.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.table.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    <a class="btn primary block" href="#/grammar/drill?topics=${id}${query.from ? '&from=' + query.from : ''}">Practise: ${s.total} drills${s.seen ? ' · ' + pct(s.r, s.w) + ' so far' : ''}</a>`;
}

function score(d) {
  const s = get().drills[d.id];
  if (!s) return 0.5; // unseen: middle
  return (s.w * 2 - s.r) + (s.lastWrong ? 2 : 0);
}
function pickDrills(query) {
  const topics = (query.topics || '').split(',').filter(Boolean);
  const lesson = query.lesson ? Number(query.lesson) : null;
  let pool = D.grammar.drills.filter(d => !topics.length || topics.includes(d.topic));
  if (lesson) {
    const within = pool.filter(d => !d.les || d.les <= lesson);
    if (within.length >= 5) pool = within;
  }
  const n = query.n ? Number(query.n) : pool.length;
  // unseen and weak first, otherwise random
  const st = get().drills;
  const ranked = shuffle(pool).sort((a, b) => (st[a.id] ? 1 : 0) - (st[b.id] ? 1 : 0) || score(b) - score(a));
  return ranked.slice(0, n);
}
export function weakest(n) {
  const st = get().drills;
  const seen = D.grammar.drills.filter(d => st[d.id]);
  const weak = shuffle(seen).sort((a, b) => score(b) - score(a)).filter(d => score(d) > -2);
  const unseen = shuffle(D.grammar.drills.filter(d => !st[d.id]));
  return [...weak, ...unseen].slice(0, n);
}

function drills(main, list, query, title) {
  const queue = [...list];
  let done = 0, right = 0, firstTry = new Map();
  const back = query.topics && !query.topics.includes(',') ? '#/grammar/topic/' + query.topics : '#/grammar';
  if (!queue.length) { main.innerHTML = `${header(title, { back })}<p>No drills here.</p>`; return; }

  const show = () => {
    if (!queue.length) return finish();
    const d = queue[0];
    const t = D.topicById.get(d.topic);
    main.innerHTML = `${header(title, { back, sub: `${t ? t.title : ''} · ${queue.length} left` })}
      <div class="progressbar"><i style="width:${(100 * done) / (done + queue.length)}%"></i></div>
      <div id="drill"></div><div id="fb"></div><div id="next"></div>`;
    const box = main.querySelector('#drill');
    const submit = resp => {
      const r = judgeDrill(d, resp);
      if (!firstTry.has(d.id)) firstTry.set(d.id, r.ok);
      update(s => {
        const x = (s.drills[d.id] = s.drills[d.id] || { r: 0, w: 0 });
        r.ok ? x.r++ : x.w++;
        x.last = Date.now(); x.lastWrong = !r.ok;
      });
      queue.shift();
      if (r.ok) { done++; if (firstTry.get(d.id)) right++; } else queue.splice(Math.min(3, queue.length), 0, d); // comes back later
      feedback(d, r, resp);
    };
    if (d.type === 'mc') {
      box.innerHTML = `<p class="q">${esc(d.q).replace('___', '<b>___</b>')}</p><div class="opts">${d.options.map(o => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
        box.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (x.dataset.o === d.answer) x.classList.add('right'); });
        if (b.dataset.o !== d.answer) b.classList.add('wrong');
        submit(b.dataset.o);
      }));
    } else if (d.type === 'type') {
      box.innerHTML = `<p class="q">${esc(d.q).replace('___', '<b>___</b>')}</p><input id="in" autocomplete="off" autocapitalize="off" spellcheck="false" lang="de" placeholder="Type the missing word(s)">
        <div class="umlautbar">${['ä', 'ö', 'ü', 'ß'].map(c => `<button data-ch="${c}">${c}</button>`).join('')}</div><button class="btn primary block" id="ok">Check</button>`;
      const inp = box.querySelector('#in');
      setTimeout(() => inp.focus(), 50);
      box.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { inp.value += b.dataset.ch; inp.focus(); }));
      const go = () => { if (!inp.value.trim()) return; inp.disabled = true; box.querySelector('#ok').remove(); submit(inp.value); };
      box.querySelector('#ok').addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    } else {
      const pool = shuffle(d.words.map((w, i) => ({ w, i })));
      let built = [];
      box.innerHTML = `<p class="q">${esc(d.q)}</p><div class="chips built" id="built"></div><div class="chips" id="pool"></div><div class="row"><button class="btn" id="clr">Clear</button><button class="btn primary" id="ok" style="flex:1">Check</button></div>`;
      const draw = () => {
        box.querySelector('#built').innerHTML = built.map((x, k) => `<button data-b="${k}">${esc(x.w)}</button>`).join('');
        box.querySelector('#pool').innerHTML = pool.filter(x => !built.includes(x)).map(x => `<button data-p="${x.i}">${esc(x.w)}</button>`).join('');
        box.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { built.push(pool.find(x => x.i === Number(b.dataset.p))); draw(); }));
        box.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { built.splice(Number(b.dataset.b), 1); draw(); }));
      };
      draw();
      box.querySelector('#clr').addEventListener('click', () => { built = []; draw(); });
      box.querySelector('#ok').addEventListener('click', () => { if (built.length < d.words.length) return; box.querySelectorAll('button').forEach(b => (b.disabled = true)); submit(built.map(x => x.w)); });
    }
  };

  const feedback = (d, r, resp) => {
    const yours = Array.isArray(resp) ? resp.join(' ') : resp;
    main.querySelector('#fb').innerHTML = `<div class="fb ${r.ok ? 'good' : 'bad'}">
      <p><b>${r.ok ? ICON.check + ' Richtig!' : 'Not quite.'}</b>${!r.ok ? ` You wrote: «${esc(yours)}».` : ''}</p>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}
      <p class="full">${esc(d.full)}</p><div class="row">${playPair(d.a)}</div>
      <p class="explain">${esc(d.explain)}</p>
      ${!r.ok ? '<p class="small muted">This drill comes back in a moment.</p>' : ''}</div>`;
    main.querySelector('#next').innerHTML = `<button class="btn primary block" id="nx">Next</button>`;
    main.querySelector('#nx').addEventListener('click', show);
    audio.play(d.a);
  };

  const finish = () => {
    main.innerHTML = `${header('Done', { back })}<div class="fb good"><p><b>${right} of ${list.length} right on the first try.</b></p><p>Every drill you missed was repeated until you got it.</p></div>
      <div class="row wrap"><a class="btn primary" href="#/grammar/mix">Mixed practice</a><a class="btn" href="#/grammar">All topics</a></div>${fromBar(query)}`;
    if (query.from) completeFromQuery(query);
  };
  show();
}
