import { D } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, playPair, playBtn, ICON, toast } from '../ui.js';
import { scale, examResult, checkField, schreibenScore, checkMessage, wordCount, checkKeywords, shuffle, PASS_MARK } from '../grading.js';
import * as audio from '../audio.js';
import { recordHTML, register } from '../speech.js';
import { completeFromQuery, fromBar } from '../main.js';

const SEC = { hoeren: 'Hören', lesen: 'Lesen', schreiben: 'Schreiben', sprechen: 'Sprechen' };
let lesenTimer = null;

export function best(sec) {
  const xs = get().exams.filter(e => e.sec === sec);
  return xs.length ? Math.max(...xs.map(e => e.score)) : null;
}
function saveResult(sec, set, score, query) {
  update(s => { s.exams.push({ t: Date.now(), sec, set, score }); });
  if (query.from) completeFromQuery(query);
}

export function render(main, parts, query) {
  clearInterval(lesenTimer);
  const sec = parts[1];
  if (sec === 'hoeren' || sec === 'lesen') {
    if (parts[2] === undefined) return setList(main, sec, query);
    return sec === 'hoeren' ? hoeren(main, Number(parts[2]), query) : lesen(main, Number(parts[2]), query);
  }
  if (sec === 'schreiben') return schreiben(main, query);
  if (sec === 'sprechen') return sprechen(main, query);
  overview(main);
}

function overview(main) {
  const b = Object.fromEntries(Object.keys(SEC).map(k => [k, best(k)]));
  const r = examResult(b);
  const hist = [...get().exams].reverse().slice(0, 20);
  main.innerHTML = `${header('Prüfung', { sub: 'Goethe-Zertifikat A1: Start Deutsch 1' })}
    <div class="card"><p>Each part is scored out of 25. You pass with <b>${PASS_MARK} of 100</b>.</p>
    <p><b>Your best scores combined: ${r.total} / 100</b> ${Object.values(b).every(v => v !== null) ? (r.passed ? '<span class="badge good">pass level</span>' : '<span class="badge">below pass</span>') : '<span class="small muted">(do all four parts to see a total)</span>'}</p></div>
    <ul class="list">${Object.entries(SEC).map(([k, n]) => `<li><a href="#/exam/${k}"><span class="grow"><span class="t">${n}</span><span class="s">${{ hoeren: '3 Modellsätze, 15 items, about 20 min', lesen: '3 Modellsätze, 15 items, 25 min timer', schreiben: 'form + short message, about 20 min', sprechen: 'introduce yourself, questions, requests' }[k]}</span></span><span class="badge ${b[k] !== null ? 'acc' : ''}">${b[k] !== null ? b[k] + ' / 25' : 'not yet'}</span><span class="chev"></span></a></li>`).join('')}</ul>
    <h2>History</h2>${hist.length ? `<ul class="list">${hist.map(e => `<li><div class="li"><span class="grow"><span class="t">${SEC[e.sec]}${e.set !== undefined && e.set !== null ? ', Modellsatz ' + (e.set + 1) : ''}</span><span class="s">${new Date(e.t).toLocaleString()}</span></span><span class="badge ${e.score >= 15 ? 'good' : ''}">${e.score} / 25</span></div></li>`).join('')}</ul>` : '<p class="muted">No mock exams yet.</p>'}`;
}

function setList(main, sec, query) {
  const sets = D.exam[sec].sets;
  const f = query.from ? '?from=' + query.from : '';
  main.innerHTML = `${header(SEC[sec], { back: '#/exam' })}
    ${sec === 'hoeren' ? '<p>Teil 1 and Teil 3 are played twice, Teil 2 only once, like in the real exam. Transcripts and French appear after you submit.</p>' : '<p>You have 25 minutes. Answers and French translations appear after you submit.</p>'}
    <ul class="list">${sets.map((s, i) => { const xs = get().exams.filter(e => e.sec === sec && e.set === i); return `<li><a href="#/exam/${sec}/${i}${f}"><span class="grow"><span class="t">${esc(s.title)}</span><span class="s">${xs.length ? 'best ' + Math.max(...xs.map(e => e.score)) + ' / 25' : 'not done yet'}</span></span><span class="chev"></span></a></li>`; }).join('')}</ul>`;
}

// ---------- Hören ----------
function hoeren(main, si, query) {
  const set = D.exam.hoeren.sets[si];
  const items = [...set.teil1.map(x => ({ ...x, teil: 1 })), ...set.teil2.map(x => ({ ...x, teil: 2 })), ...set.teil3.map(x => ({ ...x, teil: 3 }))];
  const plays = {}, answers = {};
  let submitted = false;
  const teilIntro = { 1: 'Teil 1: short conversations. You hear each text twice. Choose a, b or c.', 2: 'Teil 2: announcements. You hear each text once. Richtig or Falsch?', 3: 'Teil 3: phone messages. You hear each text twice. Choose a, b or c.' };

  const draw = () => {
    let lastTeil = 0;
    main.innerHTML = `${header('Hören: ' + set.title, { back: '#/exam/hoeren' })}
      ${items.map((it, idx) => {
        const intro = it.teil !== lastTeil ? `<h2>${teilIntro[it.teil]}</h2>` : '';
        lastTeil = it.teil;
        const left = it.plays - (plays[it.id] || 0);
        const ok = submitted ? answers[it.id] === it.answer : null;
        const opts = it.teil === 2 ? [[true, 'Richtig'], [false, 'Falsch']] : it.options.map((o, i) => [i, `${'abc'[i]}) ${o}`]);
        return `${intro}<div class="card" id="it-${idx}"><p class="small muted">${idx + 1}.</p>
          <p class="q" style="margin-top:0">${esc(it.q || it.statement)}</p>
          ${submitted ? `<div class="row">${playBtn(it.script.length === 1 ? it.script[0].k : null)}${it.script.length > 1 ? `<button class="btn sm" data-seq="${idx}">${ICON.play} Play again</button>` : ''}</div>`
            : `<button class="btn ${left ? 'primary' : ''}" data-play="${idx}" ${left ? '' : 'disabled'}>${ICON.play} Play (${left} of ${it.plays} left)</button>`}
          <div class="${it.teil === 2 ? 'tf' : 'opts'}">${opts.map(([v, l]) => {
            let cls = answers[it.id] === v ? 'sel' : '';
            if (submitted) cls = v === it.answer ? 'right' : answers[it.id] === v ? 'wrong' : '';
            return `<button data-ans="${idx}" data-v="${v}" class="${cls}" ${submitted ? 'disabled' : ''}>${esc(l)}</button>`;
          }).join('')}</div>
          ${submitted ? `<div class="fb ${ok ? 'good' : 'bad'}"><p><b>${ok ? 'Richtig' : 'Falsch'}</b></p><p class="explain">${esc(it.explain)}</p>
            <details><summary>Transcript</summary>${it.script.map(l => `<p><b>${esc(l.sp)}:</b> ${esc(l.t)}</p>`).join('')}<p class="fr small">${esc(it.transcriptFr)}</p></details></div>` : ''}
        </div>`;
      }).join('')}
      ${submitted ? '' : '<button class="btn primary block" id="submit">Submit answers</button>'}
      <div id="result"></div>${fromBar(query)}`;
    main.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
      const it = items[Number(b.dataset.play)];
      if ((plays[it.id] || 0) >= it.plays) return;
      plays[it.id] = (plays[it.id] || 0) + 1;
      const left = it.plays - plays[it.id];
      b.innerHTML = `${ICON.play} Playing…`;
      b.disabled = true;
      audio.playSeq(it.script.map(l => l.k), { gap: 500 }).then(() => {
        b.innerHTML = `${ICON.play} Play (${left} of ${it.plays} left)`;
        b.disabled = !left;
        b.classList.toggle('primary', !!left);
      });
    }));
    main.querySelectorAll('[data-seq]').forEach(b => b.addEventListener('click', () => audio.playSeq(items[Number(b.dataset.seq)].script.map(l => l.k), { gap: 500, btn: b })));
    main.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => {
      const it = items[Number(b.dataset.ans)];
      answers[it.id] = it.teil === 2 ? b.dataset.v === 'true' : Number(b.dataset.v);
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    }));
    main.querySelector('#submit')?.addEventListener('click', () => {
      const missing = items.filter(it => answers[it.id] === undefined).length;
      if (missing && !confirm(`${missing} question(s) have no answer. Submit anyway?`)) return;
      audio.stop();
      submitted = true;
      const correct = items.filter(it => answers[it.id] === it.answer).length;
      const score = scale(correct, items.length);
      saveResult('hoeren', si, score, query);
      draw();
      main.querySelector('header.top').insertAdjacentHTML('afterend', resultBox(correct, items.length, score));
      window.scrollTo(0, 0);
    });
  };
  draw();
}
function resultBox(c, n, score) {
  return `<div class="fb ${score >= 15 ? 'good' : 'warn'}"><p><b>${c} of ${n} right: ${score} / 25</b></p><p class="small">${score >= 15 ? 'That is pass level for this part (60%).' : 'Pass level is 15 of 25 (60%). Read the explanations below.'}</p></div>`;
}

// ---------- Lesen ----------
function lesen(main, si, query) {
  const set = D.exam.lesen.sets[si];
  const answers = {};
  let submitted = false, endAt = Date.now() + 25 * 60 * 1000;
  const items = [...set.teil1.items, ...set.teil2, ...set.teil3];
  const tf = (it, idx) => {
    const v = answers[it.id];
    const c = val => submitted ? (val === it.answer ? 'right' : v === val ? 'wrong' : '') : v === val ? 'sel' : '';
    return `<div class="tf"><button data-a="${it.id}" data-v="true" class="${c(true)}" ${submitted ? 'disabled' : ''}>Richtig</button><button data-a="${it.id}" data-v="false" class="${c(false)}" ${submitted ? 'disabled' : ''}>Falsch</button></div>`;
  };
  const expl = it => submitted ? `<div class="fb ${answers[it.id] === it.answer ? 'good' : 'bad'}"><p class="explain small">${esc(it.explain)}</p></div>` : '';
  const fr = t => submitted && t ? `<details><summary>Français</summary><p class="fr small" style="white-space:pre-line">${esc(t)}</p></details>` : '';
  const draw = () => {
    main.innerHTML = `${header('Lesen: ' + set.title, { back: '#/exam/lesen' })}
      ${submitted ? '' : '<p>Time left: <span class="timer" id="timer">25:00</span></p>'}
      <div id="result"></div>
      <h2>Teil 1: Read the two texts. Richtig or Falsch?</h2>
      ${set.teil1.texts.map(t => `<div class="mail"><div class="hd">${t.kind === 'email' ? 'E-Mail' : esc(t.kind)}${t.from ? ' · Von: ' + esc(t.from) : ''}${t.to ? ' · An: ' + esc(t.to) : ''}${t.subject ? '<br>Betreff: ' + esc(t.subject) : ''}</div>${esc(t.body)}</div>${fr(t.fr)}
        ${set.teil1.items.filter(it => it.text === t.id).map(it => `<div class="card"><p>${esc(it.statement)}</p>${tf(it)}${expl(it)}</div>`).join('')}`).join('')}
      <h2>Teil 2: Read the situation. Which ad fits, a or b?</h2>
      ${set.teil2.map(it => `<div class="card"><p class="q" style="margin-top:0">${esc(it.situation)}</p>
        ${['a', 'b'].map(k => `<div class="mail" style="margin:6px 0"><b>${k})</b> <b>${esc(it[k].title)}</b>\n${esc(it[k].body)}</div>${fr(it[k].fr)}`).join('')}
        <div class="ab">${['a', 'b'].map(k => `<button data-a="${it.id}" data-v="${k}" class="${submitted ? (k === it.answer ? 'right' : answers[it.id] === k ? 'wrong' : '') : answers[it.id] === k ? 'sel' : ''}" ${submitted ? 'disabled' : ''}>${k}</button>`).join('')}</div>${expl(it)}</div>`).join('')}
      <h2>Teil 3: Read the signs. Richtig or Falsch?</h2>
      ${set.teil3.map(it => `<div class="card"><div class="sign"><b>${esc(it.sign.title)}</b>\n${esc(it.sign.body)}</div>${fr(it.sign.fr)}<p>${esc(it.statement)}</p>${tf(it)}${expl(it)}</div>`).join('')}
      ${submitted ? '' : '<button class="btn primary block" id="submit">Submit answers</button>'}${fromBar(query)}`;
    main.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v;
      answers[b.dataset.a] = v;
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    }));
    main.querySelector('#submit')?.addEventListener('click', () => submit(false));
  };
  const submit = auto => {
    if (!auto) { const missing = items.filter(it => answers[it.id] === undefined).length; if (missing && !confirm(`${missing} question(s) have no answer. Submit anyway?`)) return; }
    clearInterval(lesenTimer);
    submitted = true;
    const correct = items.filter(it => answers[it.id] === it.answer).length;
    const score = scale(correct, items.length);
    saveResult('lesen', si, score, query);
    draw();
    main.querySelector('#result').innerHTML = (auto ? '<p class="bad"><b>Time is up.</b></p>' : '') + resultBox(correct, items.length, score);
    window.scrollTo(0, 0);
  };
  draw();
  lesenTimer = setInterval(() => {
    const t = main.querySelector('#timer');
    if (!t) { clearInterval(lesenTimer); return; }
    const left = Math.max(0, endAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    t.textContent = `${m}:${String(s).padStart(2, '0')}`;
    t.classList.toggle('low', left < 3 * 60000);
    if (!left) submit(true);
  }, 1000);
}

// ---------- Schreiben ----------
function schreiben(main, query) {
  const S = D.exam.schreiben;
  let fi = Math.floor(Math.random() * S.teil1.length), mi = Math.floor(Math.random() * S.teil2.length);
  let gaps = null, auto = null, content = {};
  const draw = () => {
    const form = S.teil1[fi], msg = S.teil2[mi];
    main.innerHTML = `${header('Schreiben', { back: '#/exam' })}
      <h2>Teil 1: Fill in the form</h2>
      <div class="row between"><b>${esc(form.title)}</b><button class="btn sm" id="newform">Other form</button></div>
      <div class="card white"><p class="de">${esc(form.text)}</p><details><summary>Français</summary><p class="fr small">${esc(form.textFr)}</p></details></div>
      <div class="card">${form.fields.map((f, i) => `<label class="small muted" style="display:block;margin-top:8px">${esc(f.label)}</label>
        ${f.given ? `<input value="${esc(f.answer[0])}" readonly style="background:var(--surface2)">`
          : f.options ? `<select data-f="${i}"><option value="">choose…</option>${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`
            : `<input data-f="${i}" autocomplete="off" lang="de">`}
        ${gaps && !f.given ? `<p class="small ${gaps[i] ? 'good' : 'bad'}">${gaps[i] ? '✓ correct' : '✗ accepted: ' + esc(f.answer.join(' / '))}</p>` : ''}`).join('')}
        <button class="btn primary block" id="chkform" style="margin-top:12px">Check the form</button>
        ${gaps ? `<p class="explain small">${esc(form.explain)}</p>` : ''}</div>

      <h2>Teil 2: Write a message (about 30 words)</h2>
      <div class="row between"><span></span><button class="btn sm" id="newmsg">Other task</button></div>
      <div class="card white"><p class="de">${esc(msg.situation)}</p><ul>${msg.points.map(p => `<li class="de">${esc(p)}</li>`).join('')}</ul>
        <details><summary>Français</summary><p class="fr small">${esc(msg.situationFr)}</p><ul>${msg.pointsFr.map(p => `<li class="fr small">${esc(p)}</li>`).join('')}</ul></details></div>
      <textarea id="msg" lang="de" placeholder="Liebe ...,&#10;&#10;&#10;Viele Grüße&#10;Alexandre"></textarea>
      <div class="umlautbar">${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(c => `<button data-ch="${c}">${c}</button>`).join('')}<span class="small muted" id="wc" style="align-self:center"></span></div>
      <button class="btn primary block" id="chkmsg">Check my message</button>
      <div id="msgfb"></div>
      <details><summary>Checklist for Teil 2</summary><ul class="small">${S.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
      ${fromBar(query)}`;
    const ta = main.querySelector('#msg');
    ta.value = get().lessonsSeen['exmsg' + mi] || '';
    const wc = () => (main.querySelector('#wc').textContent = wordCount(ta.value) + ' words');
    wc();
    ta.addEventListener('input', () => { wc(); get().lessonsSeen['exmsg' + mi] = ta.value; clearTimeout(ta._t); ta._t = setTimeout(() => update(() => {}), 600); });
    main.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + b.dataset.ch + ta.value.slice(ta.selectionEnd); ta.focus(); ta.setSelectionRange(p + 1, p + 1); wc(); }));
    main.querySelector('#newform').addEventListener('click', () => { fi = (fi + 1) % S.teil1.length; gaps = null; draw(); });
    main.querySelector('#newmsg').addEventListener('click', () => { mi = (mi + 1) % S.teil2.length; auto = null; content = {}; draw(); });
    const keep = {};
    main.querySelector('#chkform').addEventListener('click', () => {
      main.querySelectorAll('[data-f]').forEach(el => (keep[el.dataset.f] = el.value));
      gaps = form.fields.map((f, i) => f.given ? null : checkField(f, keep[i]));
      draw();
      main.querySelectorAll('[data-f]').forEach(el => (el.value = keep[el.dataset.f] || ''));
    });
    main.querySelector('#chkmsg').addEventListener('click', () => {
      auto = checkMessage(ta.value, { nouns: D.nouns, umlautWords: D.umlautWords });
      showMsg(msg, form);
    });
    if (auto) showMsg(msg, form);
  };
  const showMsg = (msg, form) => {
    const box = main.querySelector('#msgfb');
    box.innerHTML = `<div class="card"><h3 style="margin-top:0">Automatic check</h3>${auto.map(r => `<p class="${r.ok ? 'good' : 'bad'} small">${r.ok ? '✓' : '✗'} ${esc(r.msg)}</p>`).join('')}
      <h3>Did you cover each point?</h3>${msg.points.map((p, i) => `<label class="row" style="padding:6px 0"><input type="checkbox" data-pt="${i}" style="width:24px;height:24px" ${content[i] ? 'checked' : ''}> <span class="de">${esc(p)}</span></label>`).join('')}
      <h3>Model answer</h3><p class="de" style="white-space:pre-line">${esc(msg.model)}</p><div class="row">${playPair(msg.a)}</div>
      <details><summary>Français</summary><p class="fr small" style="white-space:pre-line">${esc(msg.modelFr)}</p></details>
      <p class="small"><b>Key phrases:</b> ${msg.keyPhrases.map(esc).join(' · ')}</p>
      <button class="btn primary block" id="score">Save my Schreiben score</button></div>`;
    box.querySelectorAll('[data-pt]').forEach(c => c.addEventListener('change', () => (content[c.dataset.pt] = c.checked)));
    box.querySelector('#score').addEventListener('click', () => {
      const pts = Object.values(content).filter(Boolean).length * 3 + auto.filter(r => r.ok && ['words', 'greeting', 'closing', 'capitals', 'umlauts', 'register'].includes(r.key)).length;
      const nGaps = form.fields.filter(f => !f.given).length;
      const g = gaps ? gaps.filter(Boolean).length : 0;
      const score = schreibenScore(g, nGaps, Math.min(15, pts));
      saveResult('schreiben', null, score, query);
      toast(`Schreiben: ${score} / 25`, 3000);
      box.querySelector('#score').outerHTML = `<div class="fb ${score >= 15 ? 'good' : 'warn'}"><b>Schreiben: ${score} / 25</b><p class="small">Form ${g}/${nGaps} gaps (10 points), message ${Math.min(15, pts)}/15 (content 3 × 3, form 6).${gaps ? '' : ' Check the form first to count its points.'}</p></div>`;
    });
  };
  draw();
}

// ---------- Sprechen ----------
function sprechen(main, query) {
  const S = D.exam.sprechen;
  const t1 = S.teil1;
  let kw = t1.keywords.map(k => ({ k, ok: false }));
  const pick = () => {
    const th = S.teil2[Math.floor(Math.random() * S.teil2.length)];
    return { th, cards: shuffle(th.cards).slice(0, 2), pics: shuffle(S.teil3).slice(0, 2) };
  };
  let p = pick();
  const self = { t2: [0, 0], t3: [0, 0] };
  const rate = (name, i) => `<div class="row wrap small" style="margin-top:6px">How did it go? ${[0, 1, 2, 3].map(v => `<button class="btn sm ${self[name][i] === v ? 'primary' : ''}" data-rate="${name}.${i}.${v}">${['missed', 'weak', 'ok', 'good'][v]}</button>`).join('')}</div>`;
  const draw = () => {
    main.innerHTML = `${header('Sprechen', { back: '#/exam' })}
      <h2>Teil 1: Introduce yourself</h2>
      <div class="card recwrap"><p>Say one sentence for each keyword:</p>
        <p>${kw.map(x => `<span class="badge ${x.ok ? 'good' : ''}" style="margin:2px">${x.ok ? '✓ ' : ''}${esc(x.k)}</span>`).join(' ')}</p>
        ${recordHTML('t1', 'Record my introduction')}
        <p class="small muted">Recognition checks the keywords. If it is not available, tick them yourself: ${kw.map((x, i) => `<label style="white-space:nowrap"><input type="checkbox" data-kw="${i}" ${x.ok ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> ${esc(x.k)}</label>`).join(' ')}</p>
        <details><summary>Model answer</summary><p class="de">${esc(t1.model)}</p><p class="fr small">${esc(t1.modelFr)}</p>${playPair(t1.a.model)}
          <p class="de" style="margin-top:10px">${esc(t1.alt)}</p><p class="fr small">${esc(t1.altFr)}</p>${playPair(t1.a.alt)}</details>
        <details><summary>Spell your name and give your phone number</summary><p class="de">${esc(t1.spelling)}</p><p class="approx">${esc(t1.spellingSay)}</p>${playPair(t1.a.spelling)}<p class="de" style="margin-top:10px">${esc(t1.phone)}</p>${playPair(t1.a.phone)}
          <div class="recwrap" style="margin-top:8px">${recordHTML('t1s', 'Record spelling')}</div></details>
        <details><summary>Follow-up questions from the examiner</summary>${t1.followUps.map((f, i) => `<div style="margin:8px 0"><p class="de"><b>${esc(f.q)}</b> ${playBtn(t1.a['fu' + i + 'q'])}</p><p>${esc(f.a)} ${playBtn(t1.a['fu' + i + 'a'])}</p></div>`).join('')}</details>
        <ul class="small">${t1.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <h2>Teil 2: Ask and answer, theme «${esc(p.th.theme)}»</h2>
      ${p.cards.map((c, i) => `<div class="card recwrap"><p class="small muted">Your card</p><p style="font-size:1.6rem;text-align:center;font-weight:700" class="de">${esc(c.word)}</p>
        <p class="small">Ask a question with this word, then answer the partner's question.</p>${recordHTML('t2-' + i, 'Record my question')}
        <details><summary>Model</summary><p class="de"><b>${esc(c.q)}</b> ${playBtn(c.aq)}</p>${c.q2 ? `<p class="de">${esc(c.q2)} ${playBtn(c.aq2)}</p>` : ''}<p class="de">${esc(c.a)} ${playBtn(c.aa)}</p><p class="fr small">${esc(c.fr)}</p></details>${rate('t2', i)}</div>`).join('')}
      <h2>Teil 3: Make a request</h2>
      ${p.pics.map((c, i) => `<div class="card recwrap"><div class="picture">${esc(c.picture)}</div><p class="center muted">${esc(c.pictureDesc)}</p>
        <p class="small">Ask someone politely to do something with this.</p>${recordHTML('t3-' + i, 'Record my request')}
        <details><summary>Model</summary><p class="de"><b>${esc(c.request)}</b> ${playBtn(c.a.request)}</p>${c.alt.map((a, k) => `<p class="de">${esc(a)} ${playBtn(c.a['alt' + k])}</p>`).join('')}<p>Reply: <span class="de">${esc(c.reply)}</span> ${playBtn(c.a.reply)}</p><p class="fr small">${esc(c.fr)}</p></details>${rate('t3', i)}</div>`).join('')}
      <button class="btn block" id="redraw">Draw new cards</button>
      <details><summary>Tips for Sprechen</summary><ul class="small">${S.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>
      <button class="btn primary block" id="score" style="margin-top:10px">Save my Sprechen score</button><div id="sfb"></div>${fromBar(query)}`;
    register('t1', { kind: 'free', target: t1.model, nativeKey: t1.a.model, label: 'Record my introduction', onResult: res => {
      const heard = [res.transcript, ...res.alternatives].join(' ');
      if (!heard.trim()) return;
      const found = checkKeywords(heard, t1.keywords);
      kw = kw.map((x, i) => ({ k: x.k, ok: x.ok || found[i].ok }));
      const missing = kw.filter(x => !x.ok).map(x => x.k);
      setTimeout(() => {
        main.querySelectorAll('[data-kw]').forEach((c, i) => (c.checked = kw[i].ok));
        const out = main.querySelector('[data-rec=t1]').parentElement.querySelector('.recout');
        out.insertAdjacentHTML('beforeend', `<p class="${missing.length ? 'bad' : 'good'}">${missing.length ? 'Missing keywords: ' + missing.map(esc).join(', ') : 'All seven keywords covered.'}</p>`);
      }, 0);
    } });
    register('t1s', { kind: 'free', target: t1.spelling, nativeKey: t1.a.spelling, label: 'Record spelling' });
    p.cards.forEach((c, i) => register('t2-' + i, { kind: 'sentence', target: c.q, nativeKey: c.aq, label: 'Record my question' }));
    p.pics.forEach((c, i) => register('t3-' + i, { kind: 'sentence', target: c.request, nativeKey: c.a.request, label: 'Record my request' }));
    main.querySelectorAll('[data-kw]').forEach(c => c.addEventListener('change', () => { kw[Number(c.dataset.kw)].ok = c.checked; }));
    main.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
      const [n, i, v] = b.dataset.rate.split('.');
      self[n][Number(i)] = Number(v);
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('primary', x === b));
    }));
    main.querySelector('#redraw').addEventListener('click', () => { p = pick(); self.t2 = [0, 0]; self.t3 = [0, 0]; draw(); });
    main.querySelector('#score').addEventListener('click', () => {
      // Goethe weights: Teil 1 = 3, Teil 2 = 6, Teil 3 = 6, scaled to 25
      const t1p = (3 * kw.filter(x => x.ok).length) / kw.length;
      const t2p = self.t2.reduce((a, b) => a + b, 0);
      const t3p = self.t3.reduce((a, b) => a + b, 0);
      const score = scale(t1p + t2p + t3p, 15);
      saveResult('sprechen', null, score, query);
      main.querySelector('#sfb').innerHTML = `<div class="fb ${score >= 15 ? 'good' : 'warn'}"><b>Sprechen: ${score} / 25</b><p class="small">Teil 1 ${t1p.toFixed(1)}/3, Teil 2 ${t2p}/6, Teil 3 ${t3p}/6, scaled to 25.</p></div>`;
    });
  };
  draw();
}
