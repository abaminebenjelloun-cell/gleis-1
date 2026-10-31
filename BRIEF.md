# Gleis A1: brief for Claude Code

Build a mobile app (iPhone and Android) that prepares me for the Goethe-Zertifikat A1: Start Deutsch 1.
All the content already exists in this folder and must be used exactly as it is. Do not rewrite, shorten or invent content.

## About me
- Native French speaker, fluent English, living in Geneva, beginner in German.
- Pronunciation is my biggest weakness: vowel length first, then word stress, the ich-Laut, aspiration of p/t/k, final devoicing and the vocalized r in -er.
- Every mistake I make must be corrected and explained.
- Explanations are in English, with French translations and French comparisons where they exist in the data.

## Platform
- Use **Expo (React Native, TypeScript)** so the same app runs on iPhone and Android. Speech recognition and recording need native modules, so use an **Expo development build** (EAS Build) rather than plain Expo Go, and explain to me step by step how to install it on my phone.
- The app must work **offline**: bundle all JSON and audio inside the app.
- The microphone must work **inside the app** (record button on screen, no external recorder app).
- Save all progress automatically on the device (SQLite or AsyncStorage), after every action. Add export and import of progress as a JSON file.

## The content (this folder)
| File | What it holds |
|---|---|
| `vocab.json` | 1,210 words |
| `grammar.json` | 38 topics and 452 drills |
| `pron.json` | 16 pronunciation sections, 116 minimal pairs |
| `abc.json` | alphabet (30 letters), numbers, dictation lists, spelling words |
| `lessons.json` | 14 lessons (Schritte international Neu A1.1 and A1.2 curriculum) with dialogues |
| `program.json` | 45-day study program, about 1 hour a day |
| `exam.json` | mock exams: Hören (3 sets), Lesen (3 sets), Schreiben, Sprechen |
| `audio/` | 4,529 MP3 clips with native German voices |

**Audio rule:** any field named `k`, `kw`, `aq`, `aq2`, `aa`, or the values inside an `a` object (for example `a.w`, `a.pl`, `a.ex`) is an audio key. Play `audio/<key>.mp3`. A null key means no clip.

### Field reference
- **vocab item:** `id`, `theme`, `de` (word), `art` (der/die/das, or "die (Pl.)" for plural-only nouns, or empty), `pl` (plural), `pos`, `forms` (verb forms), `ipa`, `approx` (French-style pronunciation: CAPS = stressed syllable, `:` = long vowel, `ch'` = soft ich sound, `kh` = ach sound), `fr`, `en`, `ch` (Zürich German, may be empty), `chNote`, `ex` (example sentence), `exFr`, `tip` (pronunciation tip), `a` (`w` word audio, `pl` plural audio, `ex` example audio), `les` (lesson numbers this word belongs to).
- **grammar topic:** `id`, `title`, `summary`, `explain` (HTML), `fr` (HTML, French comparison), `table` (`head`, `rows`). **drill:** `id`, `topic`, `type`, `q`, `answer`, `full` (the complete correct sentence), `explain`, `a` (audio of `full`), optional `les`.
  - `mc`: `options`, `answer` is one option string.
  - `type`: the gap is `___`; `answer` is an array of all accepted answers.
  - `order`: `words` are shuffled chunks; `answer` is an array of accepted full sentences.
- **pron section:** `id`, `title`, `focus`, `explain` and `howto` (HTML), `pairs` (each has `a` and `b` with `w`, `ipa`, `approx`, `fr`, `k`, plus `note`, `heardBforA`, `heardAforB` = feedback when I aimed at one word and was heard as the other), `words`, `sentences`.
- **lesson:** `n`, `title`, `titleEn`, `book` (book volume and pages), `level` (difficulty 1 to 5), `levelWhy`, `goals`, `grammar` (topic ids), `dialogues` (lines with `sp` speaker, `g` gender, `t` German, `fr`, `k` audio), `pron` (section ids), `speaking`, `writing`, `exam`, `days`.
- **program day:** `i`, `kind` (lesson, review, exam), `lesson`, `title`, `learn` (what I learn today), `points`, `min`, `blocks` (each has `src`, `min`, `label`, optional `note`, optional `act` describing which screen to open: `cards`, `lesson`, `grammar`, `gmix`, `pron`, `ear`, `abc`, `speak`, `exam`, `claude`).
- **abc:** `letters` (`l`, `name`, `ipa`, `approx`, `word`, `wordFr`, `tip`, `k` letter audio, `kw` example word audio), `numbers` (`n`, `word`, `ipa`, `approx`, `tip`, `group`, `k`), `dictNums` (`n`, `word`, `k`), `spell` (`w`, `say`, `k` = the word spelled letter by letter).
- **exam:** `hoeren.sets[]` with `teil1` (mc, played twice), `teil2` (true/false, played once), `teil3` (mc, played twice); each item has `script` lines with audio `k`, `answer` (option index, or true/false), `plays`, `explain`, `transcriptFr`. `lesen.sets[]` with `teil1` (texts plus true/false items), `teil2` (choose ad a or b), `teil3` (signs, true/false). `schreiben.teil1` (forms with 5 gaps; `answer` lists accepted formats; `given` fields are prefilled), `schreiben.teil2` (message tasks with model answer and key phrases), `schreiben.checklist`. `sprechen.teil1` (self-introduction model, spelling, phone number, follow-ups), `teil2` (6 themes with question cards), `teil3` (picture request cards), `tips`.

## Screens (bottom tab bar)
1. **Heute (Today):** the current program day: title, "What you learn today", points, and the blocks as a checklist with a Start button that opens the right screen. Ticking all blocks completes the day and moves to the next one. List of all 45 days below; tap any day to see it. No countdown and no exam date.
2. **Lektionen:** the 14 lessons grouped by difficulty (Stufe 1 Einstieg, 2 Grundlagen, 3 Aufbau, 4 Erweiterung, 5 Prüfungsniveau) or in book order. A lesson page shows goals, study days, both dialogues (play the whole dialogue, or line by line, with French under each line), the lesson's words, its grammar topics, speaking and writing tasks with model answers, pronunciation focus and exam links.
3. **Karten (flashcards):** decks by lesson, by theme or all words.
   - Spaced repetition (SM-2 style: Again, Hard, Good, Easy) in both directions: German to French and French to German. Daily limit for new words (default 15) plus a "learn this deck now" mode.
   - Card back shows the four layers: Hochdeutsch with article and plural, IPA, French-style approximation, Zürich German. Plus meaning, example with audio, and the pronunciation tip.
   - Typing mode (French to German) that checks the article, umlauts (ae/oe/ue counts as a small mistake), ß, capital letters and spelling, and shows a letter-by-letter diff of my mistake.
   - Articles always in colour: der blue, die plum, das orange.
4. **Grammatik:** topics with explanation, French comparison and table; drills with instant correction (show the correct sentence, play its audio, explain why). Wrong drills come back later in the same session. Mixed practice serves my weakest drills first.
5. **Aussprache (pronunciation):**
   - Minimal pairs (play each word, play both), ear-training quiz (hear one word, pick which), practice words and shadowing sentences, each with a normal and a slow (0.75x) button.
   - **Pronunciation test:** a record button on every word and sentence. Use on-device German speech recognition (`de-DE`, for example `expo-speech-recognition`) to show what a German listener heard. For a minimal pair, if I was heard as the other word, show that pair's `heardBforA` or `heardAforB` feedback. For sentences, show word by word which words were understood.
   - **Vowel length check:** compare the length of my stressed vowel with the native clip, show both waveforms, and let me play mine and the native one back to back.
   - **Alphabet und Zahlen:** letter grid (with the French traps C, E, G, J, U, V, W, Z highlighted), "spell any word" (plays letter names in sequence), numbers list, a number builder (digits to German words), and dictation quizzes for letters, spelled words and numbers.
6. **Prüfung (mock exam):** Hören (enforce the play limits; transcripts and French only after submitting), Lesen (25-minute timer), Schreiben (form check accepting every listed format; message editor with word count, an automatic check of greeting, closing, capitals, umlauts and Sie/du consistency, then the model answer), Sprechen (record my answers, check the Teil 1 keywords, draw random cards, model answers with audio). Score each section out of 25, pass mark 60 of 100, keep a history.
7. **Progress:** words known and learning, grammar accuracy, ear-training score, pronunciation test results, best mock score per section, streak and activity over the last four weeks.

## Design
- White background, dark olive text (#1d1f17), Goethe-Institut style lime green accent (#a5c500) for actions, plum (#810061) for the record button.
- Font: Fira Sans (body) and Fira Sans Condensed (headings); IPA in a font that supports IPA (Charis SIL or Noto Serif).
- Phone first: one column, large tap targets, bottom tab bar. Optional dark mode, but white is the default.
- Text in the app must never contain em dashes.

## Done means
- Every screen above works on a real phone (development build), offline.
- Every audio key in the data plays.
- Recording and speech recognition work inside the app on iPhone and Android.
- Progress survives closing the app.
- Write tests for the grading logic (typing check, drill judging, exam scoring, SRS intervals).
