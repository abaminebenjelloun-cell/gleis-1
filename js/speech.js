// In-app microphone: recording (MediaRecorder) + German speech recognition (de-DE),
// plus the record widget used on every word, pair and sentence.
import * as audio from './audio.js';
import { esc, ICON, toast } from './ui.js';
import { compareWords, classifyPair, analyzeVowel, compareVowel } from './grading.js';
import { update } from './store.js';

// In the native iPhone app (Capacitor) recognition comes from the SpeechRecognition plugin,
// wrapped to look like the browser's SpeechRecognition so the rest of this file is shared.
const CAP = window.Capacitor;
export const isNative = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const nativePlugin = isNative ? ((CAP.Plugins && CAP.Plugins.SpeechRecognition) || (CAP.registerPlugin && CAP.registerPlugin('SpeechRecognition'))) : null;

function nativeSR(plugin) {
  return class {
    constructor() { this.lang = 'de-DE'; this.maxAlternatives = 5; this.ended = false; this.handles = []; this.quiet = null; }
    start() {
      (async () => {
        try {
          let perm = await plugin.checkPermissions();
          if (perm.speechRecognition !== 'granted') perm = await plugin.requestPermissions();
          if (perm.speechRecognition !== 'granted') throw { error: 'not-allowed' };
          const av = await plugin.available();
          if (!av.available) throw { error: 'service-not-allowed' };
          this.handles.push(await plugin.addListener('partialResults', d => {
            const matches = (d && d.matches) || [];
            if (!matches.length) return;
            const res = matches.map(t => ({ transcript: t }));
            res.isFinal = true;
            if (this.onresult) this.onresult({ results: [res] });
            // stop by itself after a short silence once something was heard
            clearTimeout(this.quiet);
            this.quiet = setTimeout(() => this.stop(), 1400);
          }));
          this.handles.push(await plugin.addListener('listeningState', d => { if (d && d.status === 'stopped') this._end(); }));
          if (this.ended) return;
          await plugin.start({ language: this.lang, maxResults: this.maxAlternatives, partialResults: true, popup: false });
        } catch (e) {
          if (this.onerror) this.onerror({ error: e.error || 'native: ' + (e.message || e) });
          this._end();
        }
      })();
    }
    stop() {
      clearTimeout(this.quiet);
      plugin.stop().catch(() => {});
      setTimeout(() => this._end(), 800); // in case no "stopped" event arrives
    }
    abort() { this.stop(); }
    _end() {
      if (this.ended) return;
      this.ended = true;
      clearTimeout(this.quiet);
      this.handles.forEach(h => h && h.remove && h.remove());
      if (this.onend) this.onend();
    }
  };
}

const SR = nativePlugin ? nativeSR(nativePlugin) : (window.SpeechRecognition || window.webkitSpeechRecognition);
export const hasRecognition = !!SR;
export const hasRecorder = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
export const standalone = !isNative && (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
let recognitionBroken = false; // set when the browser refuses recognition during recording

function pickMime() {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}

// one active session at a time
let active = null;

// start recording + recognition. returns controller {stop()} ; resolves result via onDone
export async function capture({ maxMs = 6000, recognize = true, onState = () => {}, onInterim = () => {} } = {}) {
  if (active) active.stop();
  audio.stop();
  const result = { blob: null, url: null, alternatives: [], transcript: '', recogError: null, recError: null };
  let stream = null, rec = null, recog = null, chunks = [], timer = null, finished = false;
  let resolveDone;
  const done = new Promise(r => (resolveDone = r));
  let pending = 0;
  const finishOne = () => { if (--pending <= 0 && !finished) { finished = true; onState('idle'); resolveDone(result); } };

  const ctrl = {
    done,
    stop() {
      clearTimeout(timer);
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) { /* already stopped */ }
      try { if (recog) recog.stop(); } catch (e) { /* already stopped */ }
      if (active === ctrl) active = null;
      // safety net: some Safari versions never fire onend/onstop after stop()
      setTimeout(() => {
        if (finished) return;
        if (stream) stream.getTracks().forEach(t => t.stop());
        try { if (recog) recog.abort(); } catch (e) { /* gone */ }
        if (!result.url && chunks.length) { result.blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'audio/mp4' }); result.url = URL.createObjectURL(result.blob); }
        finished = true; onState('idle'); resolveDone(result);
      }, 2500);
    },
  };
  active = ctrl;

  const useRecognition = recognize && SR;
  const useRecorder = hasRecorder && !(useRecognition && recognitionBroken);
  if (useRecorder) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const mime = pickMime();
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunks.length) {
          result.blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' });
          result.url = URL.createObjectURL(result.blob);
        }
        finishOne();
      };
      pending++;
      rec.start();
    } catch (e) {
      result.recError = e.name === 'NotAllowedError' ? (isNative ? 'Microphone access was refused. Open Settings > Apps > Gleis A1 and turn on Microphone.' : 'Microphone access was refused. Allow it in Settings > Safari > Microphone (or in the browser prompt) and try again.') : 'Could not start the microphone: ' + e.message;
      if (stream) stream.getTracks().forEach(t => t.stop());
      rec = null;
    }
  } else if (!hasRecorder) {
    result.recError = 'This browser cannot record audio.';
  }

  if (useRecognition) {
    try {
      recog = new SR();
      recog.lang = 'de-DE';
      recog.interimResults = true;
      recog.maxAlternatives = 5;
      recog.continuous = false;
      recog.onresult = e => {
        const alts = [];
        let txt = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          txt += r[0].transcript;
          if (r.isFinal) for (let j = 0; j < r.length; j++) alts.push(r[j].transcript);
        }
        result.transcript = txt.trim();
        if (alts.length) result.alternatives = alts.map(a => a.trim());
        onInterim(result.transcript);
      };
      recog.onerror = e => {
        result.recogError = e.error;
        if (e.error === 'audio-capture' || e.error === 'service-not-allowed') recognitionBroken = !!rec;
      };
      recog.onend = () => {
        // recognition finished: stop recording shortly after so the tail is kept
        setTimeout(() => { try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) { /* stopped */ } }, 250);
        finishOne();
      };
      pending++;
      recog.start();
      result.usedRecog = true;
    } catch (e) {
      result.recogError = e.message || e.name || 'start failed';
      if (recog) pending--; // start() threw: onend will never come
      recog = null;
    }
  }

  if (!pending) { onState('idle'); resolveDone(result); return ctrl; }
  onState('rec');
  timer = setTimeout(() => ctrl.stop(), maxMs);
  return ctrl;
}

function recogHelp(err) {
  if (!hasRecognition) return standalone
    ? 'Speech recognition is not offered to home screen apps on this iPhone. Open the app in a Safari tab to see what a German listener heard. Your recording and the vowel check still work.'
    : 'This browser has no speech recognition. Use Safari on iPhone (with Siri and dictation turned on) or Chrome on Android. Your recording still works.';
  if (!err) return '';
  if (err === 'no-speech') return 'Nothing was heard. Hold the phone closer and speak right after tapping.';
  if (isNative && (err === 'not-allowed' || err === 'service-not-allowed')) return 'Speech recognition is not allowed. Open Settings > Apps > Gleis A1 and turn on Microphone and Speech Recognition.';
  if (err === 'not-allowed' || err === 'service-not-allowed') return 'Speech recognition was refused. On iPhone turn on Settings > General > Keyboard > Enable Dictation, and allow Speech Recognition for Safari.';
  if (err === 'network') return 'Recognition needs a connection on this phone. Your recording still works offline.';
  if (err === 'audio-capture') return 'The microphone was busy. Tap the record button again: the app will now listen without recording at the same time.';
  return 'Recognition error: ' + err;
}

// ---------- waveform drawing ----------
function drawWave(canvas, an, color) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 56;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const env = an.env, n = env.length || 1;
  const x = i => (i / n) * w;
  g.fillStyle = 'rgba(165,197,0,.22)';
  g.fillRect(x(an.start), 0, x(an.end + 1) - x(an.start), h);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const v = env[i] * (h / 2 - 2);
    g.fillRect(x(i), h / 2 - v, Math.max(1, w / n - 0.5), v * 2 || 1);
  }
}

// ---------- the record widget ----------
// opts: {kind:'word'|'pair'|'sentence', target, nativeKey, pair, aim:'a'|'b', vowel:bool, label}
export function recordHTML(id, label = 'Record') {
  return `<button class="rec" data-rec="${esc(id)}" aria-label="${esc(label)}">${ICON.mic}<span>${esc(label)}</span></button>`;
}

const registry = new Map();
export function register(id, opts) { registry.set(id, opts); }
export function clearRegistry() { registry.clear(); if (active) active.stop(); }

document.addEventListener('click', e => {
  const b = e.target.closest('button.rec[data-rec]');
  if (!b) return;
  e.preventDefault();
  const opts = registry.get(b.dataset.rec);
  if (!opts) return;
  if (b.classList.contains('on')) { if (active) active.stop(); return; }
  runRecord(b, opts, opts.recognize !== false);
});

async function runRecord(b, opts, recognize) {
  let out = b.closest('.recwrap')?.querySelector('.recout');
  if (!out) {
    out = document.createElement('div');
    out.className = 'recout';
    b.insertAdjacentElement('afterend', out);
  }
  out.innerHTML = '<p class="muted live">Listening… speak now, tap again to stop.</p>';
  const setState = s => {
    b.classList.toggle('on', s === 'rec');
    b.querySelector('span').textContent = s === 'rec' ? 'Stop' : (opts.label || 'Record');
    b.querySelector('svg').outerHTML = s === 'rec' ? ICON.stop : ICON.mic;
  };
  const maxMs = opts.kind === 'sentence' ? 12000 : opts.kind === 'free' ? 60000 : 5000;
  const ctrl = await capture({
    maxMs,
    recognize,
    onState: setState,
    onInterim: t => { const l = out.querySelector('.live'); if (l) l.textContent = 'Heard so far: ' + t; },
  });
  const res = await ctrl.done;
  setState('idle');
  renderResult(out, opts, res, b);
  if (opts.onResult) opts.onResult(res);
}

function renderResult(out, opts, res, btn) {
  const parts = [];
  if (res.recError && !res.url) parts.push(`<p class="bad">${esc(res.recError)}</p>`);
  const heard = res.alternatives[0] || res.transcript;
  let logOk = null;
  if (res.usedRecog && !res.recogError && heard) {
    if (opts.kind === 'pair') {
      const p = opts.pair;
      const who = classifyPair(res.alternatives.length ? res.alternatives : [heard], p.a.w, p.b.w);
      const aimed = opts.aim;
      const aimW = p[aimed].w;
      if (who === aimed) { logOk = true; parts.push(`<p class="good">${ICON.check} A German listener heard <b>${esc(aimW)}</b>. Well done.</p>`); }
      else if (who === 'a' || who === 'b') {
        logOk = false;
        const fb = aimed === 'a' ? p.heardBforA : p.heardAforB;
        parts.push(`<p class="bad">You aimed at <b>${esc(aimW)}</b> but a German listener heard <b>${esc(p[who].w)}</b>.</p><p class="explain">${esc(fb)}</p>`);
      } else {
        logOk = false;
        parts.push(`<p class="warn">A German listener heard «${esc(heard)}», neither ${esc(p.a.w)} nor ${esc(p.b.w)}. Listen again and try once more.</p>${p.note ? `<p class="explain">${esc(p.note)}</p>` : ''}`);
      }
    } else if (opts.kind === 'free') {
      parts.push(`<p>A German listener heard: «${esc(heard)}»</p>`);
    } else {
      const words = compareWords(opts.target, res.alternatives.find(a => compareWords(opts.target, a).every(x => x.ok)) || heard);
      const okN = words.filter(w => w.ok).length;
      logOk = okN === words.length;
      parts.push(`<p>A German listener heard: «${esc(heard)}»</p><p class="words">${words.map(w => `<span class="${w.ok ? 'wok' : 'wbad'}">${esc(w.w)}</span>`).join(' ')}</p>`);
      parts.push(logOk ? `<p class="good">${ICON.check} Every word was understood.</p>` : `<p class="bad">${words.length - okN} of ${words.length} word${words.length > 1 ? 's were' : ' was'} not understood (red). Play the native clip, then try again.${opts.tip ? ' Tip: ' + esc(opts.tip) : ''}</p>`);
    }
  } else if (res.usedRecog && !res.recogError && !heard) {
    parts.push(`<p class="warn">Nothing was recognised. Speak a little louder, right after tapping.</p>`);
  } else {
    const h = recogHelp(res.recogError);
    if (h) parts.push(`<p class="muted small">${esc(h)}</p>`);
  }
  if (res.url) {
    parts.push(`<div class="row wrap"><button class="btn sm" data-mine>${ICON.play} My recording</button>${opts.nativeKey ? `<button class="btn sm" data-both>${ICON.play} Native, then mine</button>` : ''}${opts.vowel && opts.nativeKey ? `<button class="btn sm" data-vowel>Vowel length check</button>` : ''}</div><div class="vowelout"></div>`);
  }
  if (recognitionBroken && hasRecorder && !res.url) parts.push(`<button class="btn sm" data-reconly>${ICON.mic} Record only (playback and vowel check)</button>`);
  out.innerHTML = parts.join('');
  out.querySelector('[data-reconly]')?.addEventListener('click', () => runRecord(btn, opts, false));
  if (logOk !== null) update(s => { s.pron.push({ t: Date.now(), kind: opts.kind, target: opts.kind === 'pair' ? opts.pair[opts.aim].w : opts.target, ok: logOk, heard }); if (s.pron.length > 2000) s.pron.shift(); });
  out.querySelector('[data-mine]')?.addEventListener('click', ev => audio.playBlobUrl(res.url, ev.currentTarget));
  out.querySelector('[data-both]')?.addEventListener('click', async ev => {
    const b = ev.currentTarget;
    await audio.play(opts.nativeKey, { btn: b });
    await new Promise(r => setTimeout(r, 300));
    await audio.playBlobUrl(res.url, b);
  });
  out.querySelector('[data-vowel]')?.addEventListener('click', () => vowelCheck(out.querySelector('.vowelout'), opts, res));
  if (opts.vowel && opts.nativeKey && res.url && opts.autoVowel) vowelCheck(out.querySelector('.vowelout'), opts, res);
}

async function vowelCheck(box, opts, res) {
  box.innerHTML = '<p class="muted">Measuring…</p>';
  try {
    const [nat, mine] = await Promise.all([audio.decodeKey(opts.nativeKey), res.blob.arrayBuffer().then(audio.decode)]);
    const an = analyzeVowel(nat.samples, nat.sr), au = analyzeVowel(mine.samples, mine.sr);
    const cmp = compareVowel(au, an);
    box.innerHTML = `<div class="waves"><label>Native</label><canvas class="wave" data-w="n"></canvas><label>You</label><canvas class="wave" data-w="u"></canvas></div>
      <p class="${cmp.verdict === 'ok' ? 'good' : 'bad'}">${esc(cmp.msg)}</p>
      <p class="muted small">The green band marks the loudest held part of the word: the stressed vowel. Native ${an.nucleusMs} ms of ${an.wordMs} ms, you ${au.nucleusMs} ms of ${au.wordMs} ms.</p>`;
    drawWave(box.querySelector('[data-w=n]'), an, '#1d1f17');
    drawWave(box.querySelector('[data-w=u]'), au, '#810061');
    update(s => { s.vowel.push({ t: Date.now(), w: opts.target, verdict: cmp.verdict }); });
  } catch (e) {
    box.innerHTML = `<p class="bad">Could not measure this recording (${esc(e.message || e)}). Record again a little louder.</p>`;
  }
}

export function micStatusHTML() {
  const items = [];
  items.push(hasRecorder ? 'Recording: available' : 'Recording: not available in this browser');
  items.push(isNative ? 'Native iPhone app: Apple speech recognition (de-DE)' : hasRecognition ? 'Speech recognition (de-DE): available' : standalone ? 'Speech recognition: not available in home screen mode, open in Safari' : 'Speech recognition: not available in this browser');
  if (!window.isSecureContext) items.push('The page must be opened over https for the microphone to work.');
  return `<ul class="small muted">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
}
export function testMic() { toast('Say "Guten Tag"'); }
