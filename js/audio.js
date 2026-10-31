// Native audio clips only (audio/<key>.mp3). No speech synthesis anywhere.
export const url = k => `audio/${k}.mp3`;

const el = new Audio();
el.preload = 'auto';
let seqToken = 0;
let current = null;

function setRate(rate) {
  el.playbackRate = rate;
  el.defaultPlaybackRate = rate;
  // keep the pitch natural when slowed down
  if ('preservesPitch' in el) el.preservesPitch = true;
  if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true;
}

function markPlaying(btn, on) {
  if (btn) btn.classList.toggle('playing', on);
}

// play one clip. resolves when it ends (or is interrupted)
export function play(key, { rate = 1, btn = null } = {}) {
  if (!key) return Promise.resolve(false);
  const token = ++seqToken;
  return playOne(key, rate, btn, token);
}

let finishCurrent = null; // resolves the clip that is playing now, so an interrupted clip never hangs
function interrupt() {
  const f = finishCurrent;
  finishCurrent = null;
  if (f) f(false);
}

function playOne(key, rate, btn, token) {
  return new Promise(resolve => {
    interrupt();
    if (current) markPlaying(current, false);
    el.pause();
    el.src = url(key);
    setRate(rate);
    current = btn; markPlaying(btn, true);
    const done = ok => {
      if (finishCurrent === done) finishCurrent = null;
      el.onended = el.onerror = el.onpause = null;
      markPlaying(btn, false);
      resolve(ok && token === seqToken);
    };
    finishCurrent = done;
    el.onended = () => done(true);
    el.onerror = () => { done(false); };
    // a stale pause event from the previous clip arrives after play(): ignore it unless we are really paused
    el.onpause = () => { if (el.paused && !el.ended) done(false); };
    const p = el.play();
    if (p && p.catch) p.catch(() => done(false));
    setRate(rate); // Safari resets rate on src change
  });
}

// play a list of clips back to back. onItem(i) called before each clip
export async function playSeq(keys, { rate = 1, gap = 350, onItem = null, btn = null } = {}) {
  const token = ++seqToken;
  markPlaying(btn, true);
  for (let i = 0; i < keys.length; i++) {
    if (token !== seqToken) break;
    if (onItem) onItem(i);
    if (!keys[i]) continue;
    const ok = await playOne(keys[i], rate, null, token);
    if (!ok || token !== seqToken) break;
    if (gap && i < keys.length - 1) await new Promise(r => setTimeout(r, gap));
  }
  markPlaying(btn, false);
  if (onItem && token === seqToken) onItem(-1);
  return token === seqToken;
}

export function stop() {
  seqToken++;
  interrupt();
  el.pause();
  if (current) markPlaying(current, false);
}

// play a blob URL (my recording)
export function playBlobUrl(u, btn) {
  const token = ++seqToken;
  return new Promise(resolve => {
    interrupt();
    el.pause();
    el.onpause = null;
    el.src = u; setRate(1);
    markPlaying(btn, true);
    const done = () => { if (finishCurrent === done) finishCurrent = null; el.onended = el.onerror = null; markPlaying(btn, false); resolve(token === seqToken); };
    finishCurrent = done;
    el.onended = done; el.onerror = done;
    el.play().catch(done);
  });
}

// decode for waveform analysis
let ctx = null;
export function audioCtx() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
  }
  return ctx;
}
export async function decode(arrayBuffer) {
  const c = audioCtx();
  const buf = await new Promise((res, rej) => {
    const p = c.decodeAudioData(arrayBuffer, res, rej); // callback form for older Safari
    if (p && p.then) p.then(res, rej);
  });
  return { samples: buf.getChannelData(0), sr: buf.sampleRate, duration: buf.duration };
}
export async function decodeKey(key) {
  const r = await fetch(url(key));
  return decode(await r.arrayBuffer());
}
