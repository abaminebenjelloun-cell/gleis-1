// Pure grading logic: no DOM, no storage. Covered by tests.html.

export const DAY = 86400000;

// ---------- text helpers ----------
export function collapse(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
// strip final punctuation and the "..." placeholder used in phrases
export function stripEnd(s) {
  return collapse(String(s ?? '').replace(/\.\.\.|…/g, ' ')).replace(/[\s.,!?;:]+$/g, '').trim();
}
export function stripPunct(s) {
  return collapse(String(s ?? '').replace(/\.\.\.|…/g, ' ').replace(/[.,!?;:«»"„“()]/g, ' '));
}
const UML = [['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue'], ['Ä', 'Ae'], ['Ö', 'Oe'], ['Ü', 'Ue']];
export function deUmlaut(s) {
  let r = s;
  for (const [u, t] of UML) r = r.split(u).join(t);
  return r;
}
export function plainUmlaut(s) { // ä -> a (umlaut forgotten)
  return s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
}

// ---------- letter-by-letter diff (Levenshtein alignment) ----------
// returns [{t:'same'|'sub'|'del'|'ins', a, b}] where a = expected char, b = typed char
export function diffChars(expected, typed) {
  const a = [...expected], b = [...typed];
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      out.push({ t: a[i - 1] === b[j - 1] ? 'same' : 'sub', a: a[i - 1], b: b[j - 1] }); i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      out.push({ t: 'del', a: a[i - 1], b: '' }); i--;
    } else {
      out.push({ t: 'ins', a: '', b: b[j - 1] }); j--;
    }
  }
  return out.reverse();
}
export function editDistance(a, b) {
  return diffChars(a, b).filter(x => x.t !== 'same').length;
}

// ---------- typing check (French to German flashcards) ----------
// card: vocab item. Expected answer = article + word for nouns.
const ARTS = ['der', 'die', 'das'];
export function expectedAnswer(v) {
  const art = v.art === 'die (Pl.)' ? 'die' : v.art;
  return collapse((art ? art + ' ' : '') + stripEnd(v.de));
}
// returns {grade:'perfect'|'minor'|'wrong', issues:[string], expected, diff}
export function checkTyping(v, input) {
  const expected = expectedAnswer(v);
  const typed = stripEnd(input);
  const issues = [];
  const art = v.art === 'die (Pl.)' ? 'die' : v.art;
  let word = typed, typedArt = '';
  const first = typed.split(' ')[0];
  if (ARTS.includes(first.toLowerCase())) { typedArt = first.toLowerCase(); word = typed.slice(first.length).trim(); }
  const target = stripEnd(v.de);
  let major = false, minor = false;

  if (art) {
    if (!typedArt) { issues.push(`Article missing: it is ${art} ${target}.`); major = true; }
    else if (typedArt !== art) { issues.push(`Wrong article: ${typedArt}. It is ${art} ${target}.`); major = true; }
    else if (first !== typedArt) { issues.push('The article is written in small letters: ' + art + '.'); minor = true; }
  } else if (typedArt && !ARTS.includes(target.split(' ')[0].toLowerCase())) {
    // article given for a word that has none: tolerate only if target itself starts with it
    issues.push(`${target} has no article here.`); minor = true;
  }
  if (!art && typedArt && ARTS.includes(target.split(' ')[0].toLowerCase())) word = typed; // phrase starting with der/die/das

  if (word !== target) {
    if (word.toLowerCase() === target.toLowerCase()) {
      issues.push(capsNote(target, word)); minor = true;
    } else if (deUmlaut(target) === word || deUmlaut(target).toLowerCase() === word.toLowerCase()) {
      issues.push('Use the umlauts ä, ö, ü instead of ae, oe, ue. It counts as a small mistake.'); minor = true;
      if (deUmlaut(target) !== word) issues.push(capsNote(target, word));
    } else if (target.replace(/ß/g, 'ss') === word || target.replace(/ß/g, 'ss').toLowerCase() === word.toLowerCase()) {
      issues.push('Write ß here (in Switzerland ss is normal, but the exam accepts both; learn the ß spelling).'); minor = true;
    } else if (deUmlaut(target.replace(/ß/g, 'ss')).toLowerCase() === deUmlaut(word.replace(/ß/g, 'ss')).toLowerCase()) {
      issues.push('Check umlauts, ß and capital letters.'); minor = true;
    } else if (plainUmlaut(target) === word || plainUmlaut(target).toLowerCase() === word.toLowerCase()) {
      issues.push('Umlaut missing: ' + target + '. Without the dots it is a different vowel.'); major = true;
    } else {
      issues.push('Spelling: ' + target + '.'); major = true;
    }
  }
  const grade = major ? 'wrong' : minor ? 'minor' : 'perfect';
  return { grade, issues, expected, diff: diffChars(expected, collapse(input).replace(/[.!?]+$/, '')) };
}
function capsNote(target, word) {
  if (target[0] !== word[0] && target[0] === target[0].toUpperCase())
    return 'Capital letter: German nouns always start with a capital (' + target + ').';
  return 'Check capital and small letters: ' + target + '.';
}

// ---------- grammar drill judging ----------
// returns {ok:boolean, note:string|null}
export function judgeDrill(drill, response) {
  if (drill.type === 'mc') return { ok: response === drill.answer, note: null };
  if (drill.type === 'type') {
    const r = stripEnd(response);
    for (const ans of drill.answer) {
      const a = stripEnd(ans);
      if (r === a) return { ok: true, note: null };
    }
    for (const ans of drill.answer) {
      const a = stripEnd(ans);
      if (deUmlaut(a) === r) return { ok: true, note: 'Correct, but write the umlaut: ' + a + '.' };
      if (a.replace(/ß/g, 'ss') === r) return { ok: true, note: 'Correct, but the standard spelling uses ß: ' + a + '.' };
      if (a.toLowerCase() === r.toLowerCase()) return { ok: false, note: 'Almost: check capital and small letters (' + a + ').' };
    }
    return { ok: false, note: null };
  }
  if (drill.type === 'order') {
    const r = stripPunct(Array.isArray(response) ? response.join(' ') : response);
    for (const ans of drill.answer) if (stripPunct(ans) === r) return { ok: true, note: null };
    for (const ans of drill.answer) if (stripPunct(ans).toLowerCase() === r.toLowerCase()) return { ok: true, note: null };
    return { ok: false, note: null };
  }
  return { ok: false, note: null };
}

// ---------- SRS (SM-2 style) ----------
// state: {ef, ivl (days), reps, due (ms), lapses}
export function newCard() { return { ef: 2.5, ivl: 0, reps: 0, due: 0, lapses: 0 }; }
export const GRADES = { again: 0, hard: 1, good: 2, easy: 3 };
export function schedule(card, grade, now = Date.now()) {
  const c = { ...newCard(), ...card };
  if (grade === 'again') {
    c.lapses += c.reps > 0 ? 1 : 0;
    c.reps = 0; c.ivl = 0;
    c.ef = Math.max(1.3, c.ef - 0.2);
    c.due = now + 60 * 1000; // back in this session
  } else if (grade === 'hard') {
    c.ivl = c.reps === 0 ? 1 : Math.max(1, Math.round(c.ivl * 1.2));
    c.ef = Math.max(1.3, c.ef - 0.15);
    c.reps += 1;
    c.due = now + c.ivl * DAY;
  } else if (grade === 'good') {
    c.ivl = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.ivl * c.ef);
    c.reps += 1;
    c.due = now + c.ivl * DAY;
  } else if (grade === 'easy') {
    c.ivl = c.reps === 0 ? 4 : c.reps === 1 ? 6 : Math.round(c.ivl * c.ef * 1.3);
    c.ef = c.ef + 0.15;
    c.reps += 1;
    c.due = now + c.ivl * DAY;
  }
  c.last = now;
  return c;
}
export function previewInterval(card, grade, now = Date.now()) {
  const c = schedule(card, grade, now);
  if (grade === 'again') return '1 min';
  return c.ivl === 1 ? '1 day' : c.ivl + ' days';
}

// ---------- exam scoring ----------
export function scale(correct, total, max = 25) {
  if (!total) return 0;
  return Math.round((correct / total) * max * 10) / 10;
}
export function scoreObjective(items, answers) {
  // items: [{id, answer}], answers: {id: value}
  let correct = 0;
  for (const it of items) if (answers[it.id] !== undefined && answers[it.id] === it.answer) correct++;
  return { correct, total: items.length, score: scale(correct, items.length) };
}
export const PASS_MARK = 60;
export function examResult(sections) {
  // sections: {hoeren, lesen, schreiben, sprechen} each a number out of 25 or null
  const vals = Object.values(sections).filter(v => typeof v === 'number');
  const total = Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10;
  return { total, passed: vals.length === 4 && total >= PASS_MARK };
}

// Schreiben Teil 1: form field check, accepts every listed format
export function normField(s) {
  return collapse(String(s ?? '')).toLowerCase().replace(/\s*([,.])\s*/g, '$1 ').replace(/\s+/g, ' ').replace(/[ .,]+$/, '').trim();
}
export function checkField(field, input) {
  const r = normField(input);
  if (!r) return false;
  return field.answer.some(a => normField(a) === r);
}
// Schreiben total: teil1 5 gaps -> 10 points, teil2 -> 15 points
export function schreibenScore(gapsCorrect, gapsTotal, teil2Points /* 0..15 */) {
  return Math.round((scale(gapsCorrect, gapsTotal, 10) + Math.max(0, Math.min(15, teil2Points))) * 10) / 10;
}

// ---------- message check (Schreiben Teil 2) ----------
const GREET = /^(liebe|lieber|hallo|hi|sehr geehrte|sehr geehrter|guten tag|guten morgen|guten abend)\b[^\n]*,\s*$/i;
const CLOSE = /(viele grüße|liebe grüße|herzliche grüße|beste grüße|mit freundlichen grüßen|freundliche grüße|bis bald|bis dann|bis morgen|bis später|tschüss|viele gruesse|liebe gruesse|mit freundlichen gruessen)/i;
export function wordCount(text) {
  return (String(text).match(/[A-Za-zÄÖÜäöüß0-9]+(?:[-'][A-Za-zÄÖÜäöüß]+)*/g) || []).length;
}
// nouns: Set of lowercase nouns (from vocab), umlautWords: Set of words with umlauts
export function checkMessage(text, { nouns = new Set(), umlautWords = new Set() } = {}) {
  const res = [];
  const lines = String(text).split(/\n/).map(l => l.trim()).filter(Boolean);
  const wc = wordCount(text);
  res.push({ key: 'words', ok: wc >= 25 && wc <= 45, msg: `${wc} words (aim for about 30, between 25 and 45).` });
  const first = lines[0] || '';
  const greetOk = GREET.test(first);
  res.push({ key: 'greeting', ok: greetOk, msg: greetOk ? 'Greeting on its own line with a comma.' : 'Start with a greeting on its own line, followed by a comma: "Liebe Sara," or "Sehr geehrte Damen und Herren,".' });
  if (greetOk && lines[1]) {
    const w = lines[1].split(/\s+/)[0].replace(/[^A-Za-zÄÖÜäöüß]/g, '');
    const isNounOrSie = nouns.has(w.toLowerCase()) || /^(Sie|Ihr|Ihnen|Ihre|Ihren|Ihrem|Ich)$/.test(w);
    if (w && w[0] === w[0].toUpperCase() && !isNounOrSie)
      res.push({ key: 'afterComma', ok: false, msg: `After the greeting comma, the next line starts with a small letter: "${w[0].toLowerCase() + w.slice(1)}".` });
  }
  const tail = lines.slice(-3).join(' ');
  const closeOk = CLOSE.test(tail);
  res.push({ key: 'closing', ok: closeOk, msg: closeOk ? 'Closing found.' : 'End with a closing and your name on separate lines: "Viele Grüße" (friend) or "Mit freundlichen Grüßen" (formal).' });
  // capitals: nouns written small
  const tokens = String(text).match(/[A-Za-zÄÖÜäöüß]+/g) || [];
  const smallNouns = [...new Set(tokens.filter(t => t[0] === t[0].toLowerCase() && nouns.has(t) && !COMMON_LOWER.has(t)))];
  res.push({ key: 'capitals', ok: smallNouns.length === 0, msg: smallNouns.length ? 'Nouns need a capital letter: ' + smallNouns.slice(0, 6).map(n => n[0].toUpperCase() + n.slice(1)).join(', ') + '.' : 'Nouns are capitalized.' });
  // sentence starts
  const sentStarts = [...String(text).matchAll(/[.!?]\s+([a-zäöü][a-zäöüß]*)/g)].map(m => m[1]);
  if (sentStarts.length) res.push({ key: 'sentence', ok: false, msg: 'A new sentence starts with a capital letter: ' + sentStarts.slice(0, 4).join(', ') + '.' });
  // umlauts
  const translit = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (/(ae|oe|ue|ss)/.test(low) && umlautWords.has(low)) translit.push(t);
  }
  res.push({ key: 'umlauts', ok: translit.length === 0, msg: translit.length ? 'Write umlauts and ß: ' + [...new Set(translit)].slice(0, 6).join(', ') + '.' : 'Umlauts look fine.' });
  // Sie / du consistency
  const du = tokens.filter(t => /^(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)$/i.test(t)).length;
  const sieTok = [];
  String(text).replace(/(^|[.!?\n]\s*)?\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer)\b/g, (m, start, w) => { if (!start) sieTok.push(w); return m; });
  const sie = sieTok.length;
  const formal = /sehr geehrte|mit freundlichen/i.test(text);
  let regOk = true, regMsg = du && !sie ? 'Consistent: du form.' : sie && !du ? 'Consistent: Sie form.' : 'No du or Sie found.';
  if (du && sie) { regOk = false; regMsg = 'You mix du and Sie. Choose one: formal letter = Sie everywhere, friend = du everywhere.'; }
  else if (formal && du) { regOk = false; regMsg = 'A formal greeting or closing goes with Sie, not du.'; }
  else if (!formal && /^(liebe|lieber|hallo)/i.test(first) && /mit freundlichen/i.test(text)) { regOk = false; regMsg = '"Liebe/Hallo" goes with "Viele Grüße", not "Mit freundlichen Grüßen".'; }
  const smallSie = tokens.filter((t, i) => /^(ihnen|ihren|ihrem)$/.test(t)).length;
  if (smallSie) { regOk = false; regMsg += ' Formal Ihnen / Ihr / Ihren take a capital I.'; }
  res.push({ key: 'register', ok: regOk, msg: regMsg });
  return res;
}
const COMMON_LOWER = new Set(['morgen', 'abend', 'mittag', 'heute', 'gestern', 'bitte', 'danke', 'leid', 'gern', 'recht', 'essen', 'lesen', 'kochen', 'spielen', 'tanzen', 'schwimmen', 'fahren', 'trinken', 'leben']);

// ---------- Sprechen Teil 1 keywords ----------
const KW = {
  'Name?': /(hei(ß|ss)e|name ist|ich bin [A-ZÄÖÜ])/i,
  'Alter?': /jahre alt|\bjahre\b/i,
  'Land?': /komme aus|aus der schweiz|aus deutschland/i,
  'Wohnort?': /wohne|lebe in/i,
  'Sprachen?': /spreche|sprachen/i,
  'Beruf?': /von beruf|arbeite|bin (\w+ )?(lehrer|informatiker|ingenieur|student|studentin|arzt|ärztin)/i,
  'Hobby?': /hobby|hobbys|gern|spiele|mache gern/i,
};
export function checkKeywords(transcript, keywords) {
  return keywords.map(k => ({ k, ok: (KW[k] || new RegExp(k.replace('?', ''), 'i')).test(transcript || '') }));
}

// ---------- speech recognition comparison ----------
export function normWord(w) {
  return deUmlaut(String(w).toLowerCase()).replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}
// target sentence vs heard transcript: returns [{w, ok}] for each target word
export function compareWords(target, heard) {
  const tw = stripPunct(target).split(' ').filter(Boolean);
  const hw = stripPunct(heard).split(' ').filter(Boolean).map(normWord);
  const used = new Array(hw.length).fill(false);
  return tw.map(w => {
    const n = normWord(w);
    let idx = hw.findIndex((h, i) => !used[i] && h === n);
    // fuzzy only for long words: short words differ by one sound in minimal pairs (Staat / Stadt)
    if (idx < 0 && n.length >= 9) idx = hw.findIndex((h, i) => !used[i] && editDistance(h, n) <= 1);
    if (idx >= 0) { used[idx] = true; return { w, ok: true }; }
    return { w, ok: false };
  });
}
// minimal pair: alternatives = array of heard strings. returns 'a' | 'b' | 'other'
export function classifyPair(alternatives, a, b) {
  const na = normWord(a), nb = normWord(b);
  for (const alt of alternatives) {
    const words = stripPunct(alt).split(' ').map(normWord);
    const hasA = words.includes(na) || normWord(alt) === na;
    const hasB = words.includes(nb) || normWord(alt) === nb;
    if (hasA && !hasB) return 'a';
    if (hasB && !hasA) return 'b';
  }
  return 'other';
}

// ---------- vowel length (energy envelope) ----------
// samples: Float32Array, sr: sample rate. returns {env, frameMs, start, end, nucleusMs, wordMs}
export function analyzeVowel(samples, sr, frameMs = 10) {
  const hop = Math.max(1, Math.round(sr * frameMs / 1000));
  const env = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += samples[j] * samples[j];
    env.push(Math.sqrt(s / hop));
  }
  const max = Math.max(...env, 1e-9);
  const norm = env.map(e => e / max);
  // word extent: above 8% of max
  let ws = norm.findIndex(e => e > 0.08), we = norm.length - 1 - [...norm].reverse().findIndex(e => e > 0.08);
  if (ws < 0) { ws = 0; we = norm.length - 1; }
  // nucleus: longest run above 45% of max, allowing 2-frame dips
  let best = [ws, ws], cur = null, gap = 0;
  for (let i = ws; i <= we; i++) {
    if (norm[i] >= 0.45) {
      if (!cur) cur = [i, i]; else cur[1] = i;
      gap = 0;
    } else if (cur) {
      gap++;
      if (gap > 2) { if (cur[1] - cur[0] > best[1] - best[0]) best = cur; cur = null; gap = 0; }
    }
  }
  if (cur && cur[1] - cur[0] > best[1] - best[0]) best = cur;
  return {
    env: norm, frameMs, start: best[0], end: best[1], wordStart: ws, wordEnd: we,
    nucleusMs: (best[1] - best[0] + 1) * frameMs, wordMs: (we - ws + 1) * frameMs,
  };
}
// compare user vs native analyses. returns {verdict:'ok'|'short'|'long', ratioUser, ratioNative, msg}
export function compareVowel(user, native) {
  const ru = user.nucleusMs / Math.max(user.wordMs, 1);
  const rn = native.nucleusMs / Math.max(native.wordMs, 1);
  const rel = ru / Math.max(rn, 1e-6);
  let verdict = 'ok';
  if (rel < 0.75) verdict = 'short';
  else if (rel > 1.33) verdict = 'long';
  const pct = x => Math.round(x * 100) + '%';
  const msg = verdict === 'ok'
    ? `Good length: your vowel takes ${pct(ru)} of the word, the native speaker ${pct(rn)}.`
    : verdict === 'short'
      ? `Your vowel is too short: ${pct(ru)} of the word, the native speaker holds it for ${pct(rn)}. Hold it longer.`
      : `Your vowel is too long: ${pct(ru)} of the word, the native speaker only ${pct(rn)}. Cut it off sooner.`;
  return { verdict, ratioUser: ru, ratioNative: rn, msg };
}

// ---------- numbers to German words ----------
const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
function below100(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? (o === 1 ? 'ein' : ONES[o]) + 'und' + TENS[t] : TENS[t];
}
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  let s = h ? (h === 1 ? 'ein' : ONES[h]) + 'hundert' : '';
  if (r) s += below100(r);
  return s;
}
export function numberToGerman(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0 || n > 999999999) return '';
  if (n === 0) return 'null';
  const mio = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const parts = [];
  if (mio) parts.push(mio === 1 ? 'eine Million' : below1000(mio) + ' Millionen');
  let s = '';
  if (th) s += (th === 1 ? 'ein' : below1000(th)) + 'tausend';
  if (rest) s += below1000(rest);
  if (s) parts.push(s);
  return parts.join(' ');
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
