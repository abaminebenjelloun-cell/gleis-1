import { D, LEVEL_NAMES } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, playBtn, playPair, artWord, segmented, ipa, approx, ICON } from '../ui.js';
import * as audio from '../audio.js';
import { recordHTML, register } from '../speech.js';
import { fromBar } from '../main.js';

let order = 'level';

export function render(main, parts, query) {
  if (parts[1]) return lesson(main, Number(parts[1]), query);
  const groups = order === 'level'
    ? Object.entries(LEVEL_NAMES).map(([lv, name]) => [name, D.lessons.filter(l => l.level === Number(lv))]).filter(g => g[1].length)
    : [['Schritte international Neu 1 (A1.1)', D.lessons.filter(l => l.book.vol === 1)], ['Schritte international Neu 2 (A1.2)', D.lessons.filter(l => l.book.vol === 2)]];
  main.innerHTML = `${header('Lektionen', { sub: '14 lessons, Schritte international Neu A1' })}
    ${segmented('order', [['level', 'By difficulty'], ['book', 'Book order']], order)}
    ${groups.map(([name, ls]) => `<h2>${esc(name)}</h2><ul class="list">${ls.map(l => {
      const seen = get().lessonsSeen[l.n];
      const words = D.vocab.filter(v => v.les.includes(l.n)).length;
      return `<li><a href="#/lessons/${l.n}"><span class="badge ${seen ? 'good' : ''}">L${l.n}</span><span class="grow"><span class="t">${esc(l.title)}</span><span class="s">${esc(l.titleEn)} · ${words} words · Stufe ${l.level}</span></span><span class="chev"></span></a></li>`;
    }).join('')}</ul>`).join('')}`;
  main.querySelectorAll('[data-seg=order] button').forEach(b => b.addEventListener('click', () => { order = b.dataset.v; render(main, parts, query); }));
}

function lesson(main, n, query) {
  const l = D.lessonByN.get(n);
  if (!l) { main.innerHTML = '<p>Lesson not found.</p>'; return; }
  update(s => { s.lessonsSeen[n] = Date.now(); });
  const words = D.vocab.filter(v => v.les.includes(n));
  const progDays = D.program.map((d, i) => ({ d, i })).filter(x => x.d.lesson === n);
  const s = get();

  main.innerHTML = `${header('Lektion ' + n, { back: '#/lessons', sub: l.titleEn })}
    <h2 style="margin-top:4px">${esc(l.title)}</h2>
    <p class="small muted">Book ${l.book.vol}: KB ${esc(l.book.kb)} · ${esc(l.book.ab)} · ${esc(l.book.lws)}</p>
    <div class="card"><b>${esc(LEVEL_NAMES[l.level])}</b><p class="small">${esc(l.levelWhy)}</p></div>
    <h3>Goals</h3><ul>${l.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
    ${l.wortfelder ? `<p class="small muted">Word fields: ${esc(l.wortfelder.join(', '))}</p>` : ''}

    <h3>Study days</h3>
    <ul class="list">${progDays.map(({ d, i }) => `<li><a href="#/today/${i}"><span class="badge ${s.days[i]?.done ? 'acc' : ''}">Tag ${i + 1}</span><span class="grow"><span class="t">${esc(d.title)}</span><span class="s">${esc(d.learn)}</span></span><span class="chev"></span></a></li>`).join('')}</ul>

    ${l.dialogues.map((dl, di) => `<section id="dialogue-${di}" class="recwrap">
      <h2>Dialog ${di + 1}: ${esc(dl.title)}</h2>
      <p class="small muted">${esc(dl.setting || '')}</p>
      <div class="row wrap"><button class="btn primary" data-playall="${di}">${ICON.play} Play whole dialogue</button><button class="btn" data-playall="${di}" data-slow="1">Slow (0.75x)</button></div>
      <div class="dlg" data-d="${di}">${dl.lines.map((ln, li) => `<div class="line" data-li="${li}">
        <span class="sp ${esc(ln.g)}">${esc(ln.sp)}</span>
        <div class="grow"><div class="de">${esc(ln.t)}</div><div class="fr small">${esc(ln.fr)}</div>
        <div class="row wrap" style="margin-top:6px">${playPair(ln.k)}${recordHTML(`dl-${di}-${li}`)}</div></div>
      </div>`).join('')}</div>
    </section>`).join('')}

    <h2>Words of this lesson (${words.length})</h2>
    <div class="row wrap"><a class="btn primary" href="#/cards/session?deck=les-${n}&mode=review">Study these cards</a><a class="btn" href="#/cards/session?deck=les-${n}&mode=learn">Learn all now</a></div>
    <details><summary>Show the word list</summary><ul class="list">${words.map(v => `<li><div class="li"><span class="grow"><span class="t">${artWord(v)}</span><span class="s">${esc(v.fr)} · ${ipa(v.ipa)}</span></span>${playBtn(v.a?.w)}</div></li>`).join('')}</ul></details>

    <h2>Grammar</h2>
    <ul class="list">${l.grammar.map(g => { const t = D.topicById.get(g.id); return t ? `<li><a href="#/grammar/topic/${g.id}"><span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${esc(g.note)}</span></span><span class="chev"></span></a></li>` : ''; }).join('')}</ul>
    <a class="btn" href="#/grammar/drill?topics=${l.grammar.map(g => g.id).join(',')}&lesson=${n}&n=12">Practise this lesson's grammar</a>

    <section id="speaking"><h2>Speaking</h2>${l.speaking.map((sp, si) => `<div class="card recwrap"><p><b>${esc(sp.task)}</b></p>
      <details><summary>Model answer</summary><p class="de">${esc(sp.model)}</p><p class="fr small">${esc(sp.modelFr)}</p><div class="row">${playPair(sp.k)}</div></details>
      <div class="row wrap">${recordHTML(`sp-${si}`, 'Record my answer')}</div></div>`).join('')}</section>

    <section id="writing"><h2>Writing</h2><div class="card"><p><b>${esc(l.writing.task)}</b></p>
      <textarea id="wtext" placeholder="Write your text here…">${esc(s.lessonsSeen['w' + n] || '')}</textarea>
      <details><summary>Model answer</summary><p class="de" style="white-space:pre-line">${esc(l.writing.model)}</p><p class="fr small" style="white-space:pre-line">${esc(l.writing.modelFr)}</p><div class="row">${playPair(l.writing.k)}</div></details></div></section>

    <h2>Pronunciation focus</h2>
    <ul class="list">${l.pron.map(id => { const p = D.sectionById.get(id); return p ? `<li><a href="#/pron/section/${id}"><span class="grow"><span class="t">${esc(p.title)}</span><span class="s">${esc(p.focus)}</span></span><span class="chev"></span></a></li>` : ''; }).join('')}</ul>

    <h2>For the exam</h2>
    <ul class="list">${l.exam.map(e => `<li><a href="#/exam/${e.section}"><span class="badge plum">${esc(examName(e.section))} Teil ${e.teil}</span><span class="grow"><span class="s">${esc(e.why)}</span></span><span class="chev"></span></a></li>`).join('')}</ul>
    ${fromBar(query)}`;

  l.dialogues.forEach((dl, di) => dl.lines.forEach((ln, li) => register(`dl-${di}-${li}`, { kind: 'sentence', target: ln.t, nativeKey: ln.k })));
  l.speaking.forEach((sp, si) => register(`sp-${si}`, { kind: 'free', target: sp.model, nativeKey: sp.k, label: 'Record my answer' }));

  main.querySelectorAll('[data-playall]').forEach(b => b.addEventListener('click', () => {
    const di = Number(b.dataset.playall);
    const box = main.querySelector(`.dlg[data-d="${di}"]`);
    const lines = [...box.querySelectorAll('.line')];
    audio.playSeq(l.dialogues[di].lines.map(x => x.k), {
      rate: b.dataset.slow ? get().settings.slowRate : 1, btn: b,
      onItem: i => { lines.forEach((el, k) => el.classList.toggle('now', k === i)); if (i >= 0) lines[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    });
  }));
  const wt = main.querySelector('#wtext');
  wt.addEventListener('input', () => { get().lessonsSeen['w' + n] = wt.value; clearTimeout(wt._t); wt._t = setTimeout(() => update(() => {}), 500); });

  const target = query.tab === 'speaking' ? 'speaking' : query.tab === 'writing' ? 'writing' : query.dialogue !== undefined ? 'dialogue-' + query.dialogue : null;
  if (target) setTimeout(() => main.querySelector('#' + target)?.scrollIntoView({ behavior: 'smooth' }), 80);
}
const examName = s => ({ hoeren: 'Hören', lesen: 'Lesen', schreiben: 'Schreiben', sprechen: 'Sprechen' }[s] || s);
