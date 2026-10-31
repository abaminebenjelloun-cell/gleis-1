import { D } from '../data.js';
import { get, update } from '../store.js';
import { esc, header, ICON, toast } from '../ui.js';
import { actRoute, checkDayDone } from '../main.js';

const KIND = { lesson: 'Lektion', review: 'Wiederholung', exam: 'Prüfung' };

export function render(main, parts, query) {
  if (parts[0] === 'claude') return claude(main, query);
  const s = get();
  const viewing = parts[0] === 'today' && parts[1] !== undefined ? Number(parts[1]) : s.day;
  const i = Math.max(0, Math.min(D.program.length - 1, viewing));
  const day = D.program[i];
  const st = s.days[i] || { blocks: {} };
  const required = day.blocks.filter(b => b.src !== 'book').length;
  const doneN = day.blocks.filter((b, j) => st.blocks[j] && b.src !== 'book').length;
  const isCurrent = i === s.day;
  const totalDone = Object.values(s.days).filter(d => d.done).length;

  main.innerHTML = `
    ${header(isCurrent ? 'Heute' : 'Tag ' + (i + 1), { back: isCurrent ? null : '#/today', sub: `Tag ${i + 1} von ${D.program.length} · ${KIND[day.kind] || ''}${day.lesson ? ' ' + day.lesson : ''} · about ${day.min} min` })}
    <div class="card">
      <h2 style="margin-top:0">${esc(day.title)}</h2>
      <p><b>What you learn today.</b> ${esc(day.learn)}</p>
      <ul>${day.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="progressbar"><i style="width:${(100 * doneN) / required}%"></i></div>
      <p class="small muted">${doneN} of ${required} blocks done${required < day.blocks.length ? ' (the book block is optional)' : ''}${st.done ? ' · day completed' : ''}</p>
    </div>
    <div id="blocks">${day.blocks.map((b, j) => blockHTML(b, j, i, !!st.blocks[j])).join('')}</div>
    ${!isCurrent ? `<p><button class="btn block" id="makecur">Make this my current day</button></p>` : ''}
    <h2>All ${D.program.length} days</h2>
    <p class="small muted">${totalDone} days completed. Lime = done, plum ring = current day.</p>
    <div class="daygrid">${D.program.map((d, k) => `<a href="#/today/${k}" class="${s.days[k]?.done ? 'done' : ''} ${k === s.day ? 'cur' : ''} ${d.kind}">${k + 1}<small>${d.kind === 'lesson' ? 'L' + d.lesson : d.kind === 'review' ? 'Wdh.' : 'Prüf.'}</small></a>`).join('')}</div>
    <p class="small muted" style="margin-top:14px">Tap a block's box to tick it, or press Start: finishing the session there ticks it for you. When every block except the optional book one is ticked the day is complete and Heute moves to the next day.</p>
  `;

  main.querySelectorAll('.chk').forEach(b => b.addEventListener('click', () => {
    const j = Number(b.dataset.j);
    update(s => {
      const d = (s.days[i] = s.days[i] || { blocks: {} });
      d.blocks[j] = !d.blocks[j];
      if (!d.blocks[j] && d.done) delete d.done;
    });
    const wasCurrent = get().day === i;
    if (checkDayDone(i) && get().days[i].done && wasCurrent && get().day !== i) toast(`Tag ${i + 1} complete. On to Tag ${get().day + 1}!`, 3000);
    render(main, parts, query);
  }));
  main.querySelector('#makecur')?.addEventListener('click', () => { update(s => { s.day = i; }); location.hash = '#/today'; });
}

function blockHTML(b, j, i, done) {
  const href = b.act ? actRoute(b.act, `${i}.${j}`) : '';
  return `<div class="blk ${done ? 'done' : ''}">
    <button class="chk" data-j="${j}" aria-label="Tick block">${ICON.check}</button>
    <div class="grow"><div class="lbl">${esc(b.label)}</div>
      <div class="meta">${b.min} min · ${b.src === 'book' ? 'book' : b.src === 'exam' ? 'exam practice' : 'in the app'}</div>
      ${b.note ? `<p class="small muted">${esc(b.note)}</p>` : ''}</div>
    ${href ? `<a class="btn sm primary" href="${href}">Start</a>` : ''}
  </div>`;
}

function claude(main, query) {
  const prompt = query.prompt || '';
  main.innerHTML = `${header('Practise with Claude', { back: '#/today' })}
    <p>Copy this prompt and paste it in a chat with Claude to have a short spoken or written conversation at A1 level. This part needs an internet connection.</p>
    <div class="card white"><p style="white-space:pre-wrap">${esc(prompt)}</p></div>
    <div class="row wrap"><button class="btn primary" id="copy">Copy prompt</button><a class="btn" target="_blank" rel="noopener" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}">Open Claude</a></div>
    ${query.from ? `<p><button class="btn block" data-fromdone="${esc(query.from)}">Mark this block done</button></p>` : ''}`;
  main.querySelector('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(prompt); toast('Copied'); } catch (e) { toast('Select the text and copy it'); }
  });
}
