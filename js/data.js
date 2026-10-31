// Loads the course content (data/*.json) once and builds lookup indexes.
export const D = {};

export async function loadAll() {
  const names = ['vocab', 'grammar', 'pron', 'abc', 'lessons', 'program', 'exam'];
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => {
    if (!r.ok) throw new Error(`data/${n}.json: ${r.status}`);
    return r.json();
  })));
  names.forEach((n, i) => (D[n] = res[i]));
  D.vocabById = new Map(D.vocab.map(v => [v.id, v]));
  D.topicById = new Map(D.grammar.topics.map(t => [t.id, t]));
  D.drillById = new Map(D.grammar.drills.map(d => [d.id, d]));
  D.sectionById = new Map(D.pron.sections.map(s => [s.id, s]));
  D.lessonByN = new Map(D.lessons.map(l => [l.n, l]));
  D.themes = [...new Set(D.vocab.map(v => v.theme))];
  D.nouns = new Set();
  D.umlautWords = new Set();
  const addWords = s => {
    for (const w of String(s).match(/[A-Za-zÄÖÜäöüß]+/g) || []) {
      if (/[äöüÄÖÜß]/.test(w)) {
        const t = w.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        D.umlautWords.add(t);
      }
    }
  };
  for (const v of D.vocab) {
    if (!Array.isArray(v.les)) v.les = v.les == null ? [] : [v.les]; // some words belong to no lesson
    if (['der', 'die', 'das', 'die (Pl.)'].includes(v.art)) D.nouns.add(v.de.split(/[ (]/)[0].toLowerCase());
    addWords(v.de); addWords(v.ex); addWords(v.forms);
  }
  for (const w of ['grüße', 'grüßen', 'möchte', 'möchten', 'schön', 'für', 'über', 'können', 'müssen', 'würde', 'tschüss', 'hätte', 'wäre', 'späte', 'später', 'fährt', 'Frühstück']) addWords(w);
  return D;
}

export const THEME_NAMES = {
  greetings: ['Begrüßung', 'Greetings and phrases'],
  person: ['Person und Familie', 'People and family'],
  food: ['Essen und Trinken', 'Food and drink'],
  home: ['Wohnen', 'Home'],
  time: ['Zeit und Tag', 'Time and the day'],
  freetime: ['Freizeit', 'Free time'],
  work: ['Arbeit und Beruf', 'Work'],
  travel: ['Reisen und Verkehr', 'Travel and transport'],
  health: ['Gesundheit', 'Health and body'],
  town: ['In der Stadt', 'In town'],
  shopping: ['Einkaufen und Kleidung', 'Shopping and clothes'],
  small: ['Kleine Wörter', 'Small words (pronouns, prepositions, question words)'],
};
export const LEVEL_NAMES = { 1: 'Stufe 1 Einstieg', 2: 'Stufe 2 Grundlagen', 3: 'Stufe 3 Aufbau', 4: 'Stufe 4 Erweiterung', 5: 'Stufe 5 Prüfungsniveau' };
