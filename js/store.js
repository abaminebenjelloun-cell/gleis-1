// Progress storage: one JSON object in localStorage, saved after every action.
const KEY = 'gleis-a1-progress-v1';

function blank() {
  return {
    v: 1,
    created: Date.now(),
    settings: { newPerDay: 15, dark: false, slowRate: 0.75 },
    day: 0,                 // current program day index
    days: {},               // i -> {blocks:{idx:true}, done:ts}
    cards: {},              // "<vocabId>|df" or "|fd" -> srs state
    newLog: {},             // "YYYY-MM-DD" -> count of new cards introduced
    drills: {},             // drillId -> {r, w, last}
    ear: { r: 0, w: 0, sessions: [] },
    pron: [],               // {t, kind, target, ok, heard}
    vowel: [],              // {t, w, verdict}
    exams: [],              // {t, sec, set, score}
    activity: {},           // "YYYY-MM-DD" -> count
    lessonsSeen: {},
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(blank(), JSON.parse(raw));
  } catch (e) { /* storage unavailable or corrupt */ }
  return blank();
}
function merge(base, obj) {
  for (const k of Object.keys(obj)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]))
      base[k] = merge(base[k], obj[k]);
    else base[k] = obj[k];
  }
  return base;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  listeners.forEach(f => f(state));
}
export function get() { return state; }
export function onChange(f) { listeners.add(f); return () => listeners.delete(f); }

export function today(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// record one action for streak and activity
export function act(n = 1) {
  const t = today();
  state.activity[t] = (state.activity[t] || 0) + n;
}
export function update(fn) {
  fn(state);
  act();
  save();
}

export function streak() {
  let s = 0;
  const d = new Date();
  if (!state.activity[today(d)]) d.setDate(d.getDate() - 1); // today not started yet keeps yesterday's streak
  while (state.activity[today(d)]) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

export function exportJSON() {
  return JSON.stringify({ app: 'gleis-a1', exported: new Date().toISOString(), progress: state }, null, 1);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  const p = obj.progress || obj;
  if (typeof p !== 'object' || !p.cards) throw new Error('This file is not a Gleis A1 progress file.');
  state = merge(blank(), p);
  save();
}
export function reset() { state = blank(); save(); }
