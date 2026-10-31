import { D } from '../data.js';
import { get, update, streak, today, exportJSON, importJSON, reset } from '../store.js';
import { esc, header, pct, toast } from '../ui.js';
import { wordStatus } from './cards.js';
import { topicStats } from './grammar.js';
import { best } from './exam.js';
import { examResult } from '../grading.js';
import { applyTheme } from '../main.js';
import { micStatusHTML, isNative } from '../speech.js';

export function render(main) {
  const s = get();
  const ws = { new: 0, learning: 0, known: 0 };
  D.vocab.forEach(v => ws[wordStatus(v)]++);
  const dr = Object.values(s.drills).reduce((a, x) => ({ r: a.r + x.r, w: a.w + x.w }), { r: 0, w: 0 });
  const pOk = s.pron.filter(p => p.ok).length, pBad = s.pron.length - pOk;
  const vOk = s.vowel.filter(v => v.verdict === 'ok').length;
  const b = Object.fromEntries(['hoeren', 'lesen', 'schreiben', 'sprechen'].map(k => [k, best(k)]));
  const daysDone = Object.values(s.days).filter(d => d.done).length;

  // last 4 weeks heatmap, Monday first
  const cells = [];
  const d0 = new Date(); d0.setDate(d0.getDate() - 27);
  const pad = (d0.getDay() + 6) % 7;
  for (let i = 0; i < pad; i++) cells.push('<i style="visibility:hidden"></i>');
  for (let i = 0; i < 28; i++) {
    const d = new Date(d0); d.setDate(d0.getDate() + i);
    const n = s.activity[today(d)] || 0;
    const l = n === 0 ? '' : n < 10 ? 'l1' : n < 30 ? 'l2' : n < 80 ? 'l3' : 'l4';
    cells.push(`<i class="${l}" title="${today(d)}: ${n} actions"></i>`);
  }
  const weakTopics = D.grammar.topics.map(t => ({ t, ...topicStats(t.id) })).filter(x => x.seen).sort((a, b) => a.r / (a.r + a.w || 1) - b.r / (b.r + b.w || 1)).slice(0, 5);
  const recentFails = [...new Set(s.pron.filter(p => !p.ok).slice(-40).map(p => p.target))].slice(-8);

  main.innerHTML = `${header('Progress', { sub: `Tag ${s.day + 1} of ${D.program.length} · ${daysDone} days completed` })}
    <div class="grid2">
      <div class="stat"><b>${streak()} 🔥</b><span>day streak</span></div>
      <div class="stat"><b>${ws.known}</b><span>words known · ${ws.learning} learning</span></div>
      <div class="stat"><b>${pct(dr.r, dr.w)}</b><span>grammar accuracy (${dr.r + dr.w} answers)</span></div>
      <div class="stat"><b>${pct(s.ear.r, s.ear.w)}</b><span>ear training (${s.ear.r + s.ear.w} answers)</span></div>
      <div class="stat"><b>${s.pron.length ? pct(pOk, pBad) : 'none yet'}</b><span>pronunciation tests understood (${s.pron.length})</span></div>
      <div class="stat"><b>${s.vowel.length ? pct(vOk, s.vowel.length - vOk) : 'none yet'}</b><span>vowel length checks right (${s.vowel.length})</span></div>
    </div>
    <h2>Words</h2>
    <div class="progressbar"><i style="width:${(100 * ws.known) / D.vocab.length}%"></i></div>
    <p class="small muted">${ws.known} known, ${ws.learning} learning, ${ws.new} not started, of ${D.vocab.length}. A word counts as known when its next review is at least a week away.</p>
    <h2>Activity, last 4 weeks</h2>
    <div class="heat">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="small muted center">${x}</span>`).join('')}${cells.join('')}</div>
    <h2>Mock exam, best per part</h2>
    <ul class="list">${Object.entries({ hoeren: 'Hören', lesen: 'Lesen', schreiben: 'Schreiben', sprechen: 'Sprechen' }).map(([k, n]) => `<li><div class="li"><span class="grow t">${n}</span><span class="badge ${b[k] !== null ? 'acc' : ''}">${b[k] !== null ? b[k] + ' / 25' : 'not yet'}</span></div></li>`).join('')}
      <li><div class="li"><span class="grow t">Total</span><b>${examResult(b).total} / 100</b></div></li></ul>
    ${weakTopics.length ? `<h2>Weakest grammar</h2><ul class="list">${weakTopics.map(x => `<li><a href="#/grammar/topic/${x.t.id}"><span class="grow t">${esc(x.t.title)}</span><span class="badge">${pct(x.r, x.w)}</span><span class="chev"></span></a></li>`).join('')}</ul>` : ''}
    ${recentFails.length ? `<h2>Words to say again</h2><p class="small muted">Recent pronunciation tests a German listener did not understand:</p><p>${recentFails.map(w => `<span class="badge" style="margin:2px">${esc(w)}</span>`).join(' ')}</p>` : ''}

    <h2>Settings</h2>
    <div class="card">
      <label class="small muted">New words per day</label>
      <div class="row"><input type="number" id="npd" min="1" max="100" value="${s.settings.newPerDay}" style="max-width:110px"><span class="small muted">default 15</span></div>
      <label class="row" style="margin-top:12px"><input type="checkbox" id="dark" ${s.settings.dark ? 'checked' : ''} style="width:24px;height:24px"> Dark mode</label>
    </div>
    <div class="card ${isNative ? 'hidden' : ''}"><h3 style="margin-top:0">Offline</h3><p class="small">The app works offline once its files are saved on the phone. Audio clips are saved as you play them; download all 4,529 clips (54 MB) to have everything offline.</p>
      <button class="btn block" id="dl">Download all audio for offline use</button><div class="progressbar hidden" id="dlbar"><i style="width:0"></i></div><p class="small muted" id="dlmsg"></p></div>
    <div class="card"><h3 style="margin-top:0">Microphone</h3>${micStatusHTML()}<a class="btn sm" href="#/pron/mic">Test the microphone</a></div>
    <div class="card"><h3 style="margin-top:0">Backup</h3><p class="small">Progress is saved on this phone after every action. Export it to a file to keep a copy or move it to another phone.</p>
      <div class="row wrap"><button class="btn" id="exp">Export progress</button><label class="btn">Import progress<input type="file" id="imp" accept="application/json,.json" class="hidden"></label></div>
      <button class="btn danger sm" id="rst" style="margin-top:12px">Reset all progress</button></div>
    <p class="small muted center">Gleis A1 · content from your Gleis A1 package · native audio only</p>`;

  main.querySelector('#npd').addEventListener('change', e => { const v = Math.max(1, Math.min(100, Number(e.target.value) || 15)); update(s => { s.settings.newPerDay = v; }); toast('Saved'); });
  main.querySelector('#dark').addEventListener('change', e => { update(s => { s.settings.dark = e.target.checked; }); applyTheme(); });
  main.querySelector('#exp').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gleis-a1-progress-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  main.querySelector('#imp').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { importJSON(await f.text()); toast('Progress imported'); render(main); } catch (err) { toast(err.message, 4000); }
  });
  main.querySelector('#rst').addEventListener('click', () => {
    if (confirm('Delete all progress on this phone? Export first if you want a copy.')) { reset(); applyTheme(); render(main); }
  });
  main.querySelector('#dl').addEventListener('click', () => downloadAll(main));
}

function allKeys() {
  const keys = new Set();
  const H = /^[0-9a-f]{14}$/;
  const walk = x => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
    else if (typeof x === 'string' && H.test(x)) keys.add(x);
  };
  ['vocab', 'grammar', 'pron', 'abc', 'lessons', 'exam'].forEach(n => walk(D[n]));
  return [...keys];
}

async function downloadAll(main) {
  if (!('caches' in window)) { toast('This browser cannot store files offline'); return; }
  const btn = main.querySelector('#dl'), bar = main.querySelector('#dlbar'), msg = main.querySelector('#dlmsg');
  btn.disabled = true; bar.classList.remove('hidden');
  const cache = await caches.open('gleis-audio-v1');
  const keys = allKeys();
  let done = 0, failed = 0;
  const queue = [...keys];
  const worker = async () => {
    while (queue.length) {
      const k = queue.shift();
      const url = `audio/${k}.mp3`;
      try {
        if (!(await cache.match(url))) {
          const r = await fetch(url);
          if (r.ok) await cache.put(url, r); else failed++;
        }
      } catch (e) { failed++; }
      done++;
      if (done % 20 === 0 || done === keys.length) {
        bar.firstElementChild.style.width = (100 * done) / keys.length + '%';
        msg.textContent = `${done} of ${keys.length} clips saved${failed ? `, ${failed} failed` : ''}`;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  msg.textContent = failed ? `${keys.length - failed} clips saved, ${failed} failed. Tap again to retry.` : `All ${keys.length} clips are saved. The app now works fully offline.`;
  btn.disabled = false;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
}
