// Tests for the grading logic. Open tests.html in a browser; results are listed on the page.
import * as G from './grading.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e.message]); }
}
function eq(a, b, msg = '') {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} expected ${B}, got ${A}`);
}
function ok(v, msg = 'expected true') { if (!v) throw new Error(msg); }

const tisch = { de: 'Tisch', art: 'der', pl: 'die Tische' };
const fruehstueck = { de: 'Frühstück', art: 'das' };
const strasse = { de: 'Straße', art: 'die' };
const eltern = { de: 'Eltern', art: 'die (Pl.)' };
const phrase = { de: 'Mein Name ist ...', art: '' };
const verb = { de: 'heißen', art: '' };

// ---------- typing check ----------
test('typing: perfect noun with article', () => eq(G.checkTyping(tisch, 'der Tisch').grade, 'perfect'));
test('typing: trailing spaces and period ignored', () => eq(G.checkTyping(tisch, '  der  Tisch. ').grade, 'perfect'));
test('typing: missing article is wrong', () => { const r = G.checkTyping(tisch, 'Tisch'); eq(r.grade, 'wrong'); ok(r.issues[0].includes('Article missing')); });
test('typing: wrong article is wrong', () => { const r = G.checkTyping(tisch, 'die Tisch'); eq(r.grade, 'wrong'); ok(r.issues[0].includes('Wrong article')); });
test('typing: ae/oe/ue counts as small mistake', () => { const r = G.checkTyping(fruehstueck, 'das Fruehstueck'); eq(r.grade, 'minor'); ok(r.issues.some(i => i.includes('umlaut'))); });
test('typing: missing umlaut dots is wrong', () => eq(G.checkTyping(fruehstueck, 'das Fruhstuck').grade, 'wrong'));
test('typing: ss for ß is a small mistake', () => eq(G.checkTyping(strasse, 'die Strasse').grade, 'minor'));
test('typing: small letter noun is a small mistake', () => { const r = G.checkTyping(tisch, 'der tisch'); eq(r.grade, 'minor'); ok(r.issues.some(i => i.includes('Capital'))); });
test('typing: spelling error is wrong', () => eq(G.checkTyping(tisch, 'der Tich').grade, 'wrong'));
test('typing: plural-only noun takes die', () => eq(G.checkTyping(eltern, 'die Eltern').grade, 'perfect'));
test('typing: phrase with ... placeholder', () => eq(G.checkTyping(phrase, 'Mein Name ist').grade, 'perfect'));
test('typing: verb without article', () => eq(G.checkTyping(verb, 'heißen').grade, 'perfect'));
test('typing: verb heissen is minor', () => eq(G.checkTyping(verb, 'heissen').grade, 'minor'));
test('typing: expected answer includes article', () => eq(G.expectedAnswer(tisch), 'der Tisch'));

// ---------- diff ----------
test('diff: identical', () => ok(G.diffChars('Tisch', 'Tisch').every(x => x.t === 'same')));
test('diff: one substitution', () => eq(G.diffChars('Haus', 'Hous').filter(x => x.t !== 'same'), [{ t: 'sub', a: 'a', b: 'o' }]));
test('diff: missing letter', () => eq(G.diffChars('Tisch', 'Tich').filter(x => x.t !== 'same'), [{ t: 'del', a: 's', b: '' }]));
test('diff: extra letter', () => eq(G.diffChars('Tag', 'Taag').filter(x => x.t !== 'same').length, 1));
test('editDistance', () => eq(G.editDistance('kitten', 'sitting'), 3));

// ---------- drill judging ----------
const mc = { type: 'mc', options: ['Der', 'Die', 'Das'], answer: 'Der' };
const gap = { type: 'type', answer: ['Tische'] };
const gap2 = { type: 'type', answer: ['möchte', 'will'] };
const order = { type: 'order', words: ['Tennis spielen', 'kann', 'Ich', 'gut'], answer: ['Ich kann gut Tennis spielen.'] };
test('drill mc right', () => eq(G.judgeDrill(mc, 'Der').ok, true));
test('drill mc wrong', () => eq(G.judgeDrill(mc, 'Das').ok, false));
test('drill type exact', () => eq(G.judgeDrill(gap, 'Tische').ok, true));
test('drill type with spaces and period', () => eq(G.judgeDrill(gap, ' Tische. ').ok, true));
test('drill type any accepted answer', () => eq(G.judgeDrill(gap2, 'will').ok, true));
test('drill type umlaut transliteration accepted with note', () => { const r = G.judgeDrill(gap2, 'moechte'); eq(r.ok, true); ok(r.note); });
test('drill type wrong capitals rejected with note', () => { const r = G.judgeDrill(gap, 'tische'); eq(r.ok, false); ok(r.note.includes('capital')); });
test('drill type wrong word', () => eq(G.judgeDrill(gap, 'Tischen').ok, false));
test('drill order right', () => eq(G.judgeDrill(order, ['Ich', 'kann', 'gut', 'Tennis spielen']).ok, true));
test('drill order wrong', () => eq(G.judgeDrill(order, ['Ich', 'gut', 'kann', 'Tennis spielen']).ok, false));

// ---------- SRS ----------
const now = 1_700_000_000_000;
test('srs: new + good = 1 day', () => eq(G.schedule(G.newCard(), 'good', now).ivl, 1));
test('srs: second good = 3 days', () => { const c = G.schedule(G.schedule(G.newCard(), 'good', now), 'good', now); eq(c.ivl, 3); });
test('srs: third good = ivl * ef', () => { let c = G.newCard(); for (let i = 0; i < 3; i++) c = G.schedule(c, 'good', now); eq(c.ivl, Math.round(3 * 2.5)); });
test('srs: again resets and returns in a minute', () => { let c = G.schedule(G.schedule(G.newCard(), 'good', now), 'again', now); eq(c.reps, 0); eq(c.due, now + 60000); eq(c.lapses, 1); });
test('srs: again lowers ease, never below 1.3', () => { let c = G.newCard(); for (let i = 0; i < 20; i++) c = G.schedule(c, 'again', now); eq(c.ef, 1.3); });
test('srs: easy first = 4 days and raises ease', () => { const c = G.schedule(G.newCard(), 'easy', now); eq(c.ivl, 4); ok(c.ef > 2.5); });
test('srs: hard grows slower than good', () => { let a = G.newCard(), b = G.newCard(); for (let i = 0; i < 3; i++) { a = G.schedule(a, 'good', now); } b = G.schedule(G.schedule(a, 'hard', now), 'hard', now); a = G.schedule(G.schedule(a, 'good', now), 'good', now); ok(b.ivl < a.ivl); });
test('srs: due date matches interval', () => { const c = G.schedule(G.newCard(), 'good', now); eq(c.due, now + G.DAY); });

// ---------- exam scoring ----------
test('scale: 15 of 15 = 25', () => eq(G.scale(15, 15), 25));
test('scale: 9 of 15 = 15', () => eq(G.scale(9, 15), 15));
test('scale: 0 total = 0', () => eq(G.scale(0, 0), 0));
test('objective scoring', () => eq(G.scoreObjective([{ id: 'a', answer: 1 }, { id: 'b', answer: true }, { id: 'c', answer: 'b' }], { a: 1, b: false, c: 'b' }).correct, 2));
test('exam pass at 60', () => eq(G.examResult({ hoeren: 15, lesen: 15, schreiben: 15, sprechen: 15 }).passed, true));
test('exam fail below 60', () => eq(G.examResult({ hoeren: 15, lesen: 15, schreiben: 15, sprechen: 14.9 }).passed, false));
test('exam needs all four parts', () => eq(G.examResult({ hoeren: 25, lesen: 25, schreiben: 25, sprechen: null }).passed, false));
const dob = { answer: ['12.03.1995', '12.3.1995', '12. März 1995', '12.03.95', '12.3.95'] };
test('form: every listed date format accepted', () => dob.answer.forEach(a => ok(G.checkField(dob, a), a)));
test('form: spacing variants accepted', () => ok(G.checkField(dob, '12. 03. 1995') || G.checkField(dob, '12.03.1995 ')));
test('form: case-insensitive', () => ok(G.checkField({ answer: ['am Abend', 'Abend'] }, 'Am abend')));
test('form: wrong value rejected', () => eq(G.checkField(dob, '13.03.1995'), false));
test('form: empty rejected', () => eq(G.checkField(dob, ''), false));
test('schreiben score: full marks', () => eq(G.schreibenScore(5, 5, 15), 25));
test('schreiben score: half', () => eq(G.schreibenScore(3, 5, 9), 15));

// ---------- message check ----------
const nouns = new Set(['termin', 'samstag', 'training', 'grüße']);
const um = new Set(['gruesse', 'moechte']);
const good = 'Lieber Herr Meier,\nleider kann ich am Samstag nicht zum Training kommen. Ich habe einen Termin beim Arzt. Kann ich am Montag kommen? Haben Sie dann Zeit für mich?\nMit freundlichen Grüßen\nAlexandre';
test('message: good formal message passes key checks', () => { const r = G.checkMessage(good, { nouns, umlautWords: um }); ['greeting', 'closing', 'capitals', 'umlauts', 'register'].forEach(k => ok(r.find(x => x.key === k).ok, k)); });
test('message: missing greeting flagged', () => ok(!G.checkMessage('leider kann ich nicht kommen.\nViele Grüße', {}).find(x => x.key === 'greeting').ok));
test('message: du/Sie mix flagged', () => ok(!G.checkMessage('Hallo Sara,\nhast du Zeit? Können Sie kommen?\nViele Grüße', {}).find(x => x.key === 'register').ok));
test('message: small noun flagged', () => ok(!G.checkMessage('Hallo Sara,\nich habe am samstag einen termin.\nViele Grüße', { nouns }).find(x => x.key === 'capitals').ok));
test('message: ae/oe/ue flagged', () => ok(!G.checkMessage('Hallo Sara,\nich moechte kommen.\nViele Gruesse', { umlautWords: um }).find(x => x.key === 'umlauts').ok));
test('word count', () => eq(G.wordCount('Liebe Sara, ich komme um 18 Uhr.'), 7));

// ---------- recognition comparison ----------
test('compareWords: all understood', () => ok(G.compareWords('Der Staat ist groß.', 'der staat ist gross').every(x => x.ok)));
test('compareWords: one word missing', () => eq(G.compareWords('Der Staat ist groß.', 'der Stadt ist groß').filter(x => !x.ok).map(x => x.w), ['Staat']));
test('classifyPair: heard b', () => eq(G.classifyPair(['Stadt'], 'Staat', 'Stadt'), 'b'));
test('classifyPair: heard a', () => eq(G.classifyPair(['staat'], 'Staat', 'Stadt'), 'a'));
test('classifyPair: other', () => eq(G.classifyPair(['Hallo'], 'Staat', 'Stadt'), 'other'));
test('keywords: model answer covers all', () => ok(G.checkKeywords('Ich heiße Alexandre. Ich bin einunddreißig Jahre alt. Ich komme aus Marokko. Ich wohne in Genf. Ich spreche Französisch. Ich bin Informatiker von Beruf. Ich spiele gern Tennis.', ['Name?', 'Alter?', 'Land?', 'Wohnort?', 'Sprachen?', 'Beruf?', 'Hobby?']).every(x => x.ok)));

// ---------- vowel length ----------
function synth(vowelMs, totalMs, sr = 8000) {
  const s = new Float32Array(Math.round((sr * totalMs) / 1000));
  const v0 = Math.round((sr * (totalMs - vowelMs)) / 2000), v1 = v0 + Math.round((sr * vowelMs) / 1000);
  for (let i = 0; i < s.length; i++) s[i] = (i >= v0 && i < v1 ? 0.8 : 0.15) * Math.sin(i / 3);
  return s;
}
test('vowel: measures nucleus', () => { const a = G.analyzeVowel(synth(200, 500), 8000); ok(Math.abs(a.nucleusMs - 200) <= 30, a.nucleusMs); });
test('vowel: short vs long verdict', () => eq(G.compareVowel(G.analyzeVowel(synth(80, 500), 8000), G.analyzeVowel(synth(250, 500), 8000)).verdict, 'short'));
test('vowel: similar length ok', () => eq(G.compareVowel(G.analyzeVowel(synth(220, 500), 8000), G.analyzeVowel(synth(240, 520), 8000)).verdict, 'ok'));

// ---------- numbers ----------
test('numbers', () => {
  eq(G.numberToGerman(0), 'null'); eq(G.numberToGerman(1), 'eins'); eq(G.numberToGerman(21), 'einundzwanzig');
  eq(G.numberToGerman(31), 'einunddreißig'); eq(G.numberToGerman(99), 'neunundneunzig'); eq(G.numberToGerman(101), 'einhunderteins');
  eq(G.numberToGerman(365), 'dreihundertfünfundsechzig'); eq(G.numberToGerman(1000), 'eintausend'); eq(G.numberToGerman(2026), 'zweitausendsechsundzwanzig');
  eq(G.numberToGerman(1000000), 'eine Million');
});

// ---------- report ----------
const pass = results.filter(r => r[1]).length;
const out = document.getElementById('out');
out.innerHTML = `<h1>${pass} / ${results.length} passed</h1>` + results.map(([n, p, m]) => `<div style="color:${p ? '#3b7d0a' : '#b3261e'}">${p ? '✓' : '✗'} ${n}${m ? ': ' + m : ''}</div>`).join('');
window.__testResults = { pass, total: results.length, failed: results.filter(r => !r[1]) };
