# Gleis A1

An offline iPhone app (installable web app, PWA) that prepares you for the **Goethe-Zertifikat A1: Start Deutsch 1**, built from the content in your Gleis A1 package (`BRIEF.md`, `data/*.json`, `audio/`). All content is used as delivered: nothing was rewritten or invented.

## 1. Put it on your iPhone (about 10 minutes, free)

The app has to be served over **https**, because the microphone only works on secure pages. GitHub Pages does that for free.

### A. Publish on GitHub Pages
1. Create a free account at github.com if you don't have one.
2. Click **New repository**, name it `gleis-a1`, choose **Private** or **Public**, and click **Create repository**. (Pages on a private repository needs a paid GitHub plan; on a free account choose Public.)
3. On your PC, open a terminal in this folder (`German App\gleis-a1`) and run these commands, replacing `YOUR-NAME` with your GitHub user name:

```bash
git remote add origin https://github.com/YOUR-NAME/gleis-a1.git
```

```bash
git push -u origin main
```

   The project is already a git repository with everything committed. The push uploads about 60 MB, mostly the audio.
4. On GitHub, open the repository, then **Settings > Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. Wait a minute or two. The address appears at the top of that page: `https://YOUR-NAME.github.io/gleis-a1/`.

### B. Install it on the iPhone
1. Open that address in **Safari** (not Chrome) on the iPhone.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**. The Gleis A1 icon (lime square with rails) appears on your home screen.
3. Open the app from the icon, go to **Progress > Offline > Download all audio for offline use**, and wait until it says that all clips are saved (54 MB, about a minute on Wi-Fi). From then on everything works without a connection.

### C. Turn on the microphone
1. The first time you tap a plum **record** button, iOS asks for the microphone: tap **Allow**.
2. "What a German listener heard" uses Apple's speech recognition. Make sure **Settings > General > Keyboard > Enable Dictation** is on.
3. Test it in **Aussprache > Test the microphone**: say "Guten Tag, ich heiße …".
4. If the home screen app records but shows no recognition, open the same address in a Safari tab. Recording, playback and the vowel length check work in both; Apple only offers speech recognition reliably in Safari itself. Your progress is shared only if you use the same one: home screen app and Safari tab keep **separate** progress. Use *Export / Import progress* to move it.

> Recognition on iPhone goes through Apple's servers, so that part needs a connection. Everything else (audio, flashcards, grammar, exams, recording, vowel check) works offline.

## 2. What is in the app

Bottom tab bar, one column, large tap targets, white by default (dark mode in Progress > Settings).

| Tab | What it does |
|---|---|
| **Heute** | Current day of the 45-day program: title, what you learn, points, blocks as a checklist with **Start**. Finishing a session opened from Heute ticks the block automatically (or tick it by hand). When every block is ticked the day is complete and Heute moves to the next day. All 45 days below; tap any day to open it, or make it your current day. |
| **Lektionen** | 14 lessons by difficulty (Stufe 1 to 5) or book order. Each lesson: goals, study days, both dialogues (play all with line highlighting, or line by line, normal and 0.75x, French under each line, record each line), word list, grammar topics, speaking tasks (record, model answer with audio), writing task (draft saved, model answer), pronunciation focus, exam links. |
| **Karten** | Decks **by theme** (12), **by lesson** (14) and all words. **Quick 5** (about 2 minutes, due cards first then new words) for when you are in a rush. Review with SM-2 spaced repetition (Again, Hard, Good, Easy) in both directions, daily new-word limit (default 15), "Learn this deck now" without limit, and **Typing mode** (French to German) that checks the article, umlauts (ae/oe/ue = small mistake), ß, capitals and spelling, with a letter-by-letter diff. Card back: Hochdeutsch with coloured article (der blue, die plum, das orange) and plural, IPA, French-style approximation, Zürich German, **French and English meaning**, example with audio, pronunciation tip, and a record button. All audio is the native recordings from the package: there is no robot voice anywhere in the app. |
| **Grammatik** | 38 topics with explanation, French comparison and table. 452 drills (multiple choice, gap fill, word order) with instant correction: correct sentence, its audio, and why. Wrong drills come back later in the same session. Mixed practice serves your weakest drills first. |
| **Aussprache** | 16 sections: explanation and how-to, minimal pairs (each word, both, normal and slow), practice words, shadowing sentences. **Record button** on every word, pair word and sentence: shows what a German listener heard; for minimal pairs, if you were heard as the other word you get that pair's specific feedback; for sentences, word by word in green and red. **Vowel length check**: compares your stressed vowel with the native clip, draws both waveforms, plays native then yours. Ear training quiz. **Alphabet und Zahlen**: letter grid (French traps C, E, G, J, U, V, W, Z in plum), spell any word, numbers list, number builder, dictation of letters, spelled words and numbers. |
| **Prüfung** | Hören (3 sets, play limits enforced: 2, 1, 2; transcripts and French after submitting), Lesen (3 sets, 25-minute timer), Schreiben (form check accepting every listed format; message editor with word count and automatic check of greeting, closing, capitals, umlauts and Sie/du consistency, then the model answer), Sprechen (record your introduction with keyword check, random question cards and picture cards, model answers with audio). Each part out of 25, pass mark 60 of 100, history kept. |
| **Progress** | Streak, words known and learning, grammar accuracy, ear-training score, pronunciation test results, vowel checks, best mock score per part, activity over the last 4 weeks, weakest grammar, words to say again. Settings, offline download, microphone status, **export / import progress** (JSON file), reset. |

Progress is saved on the phone (localStorage) after every action.

## 3. How it is built

No build step and no dependencies: plain HTML, CSS and JavaScript modules, so it runs as-is on GitHub Pages.

```
index.html             app shell, bottom tab bar
manifest.webmanifest   home screen app definition
sw.js                  service worker: offline cache, Safari audio range requests
css/app.css            design (Fira Sans, lime #a5c500, plum #810061, olive #1d1f17)
js/main.js             router (#/today, #/cards/...), program block routing, day completion
js/data.js             loads data/*.json, builds indexes
js/store.js            progress in localStorage, streak, export/import
js/audio.js            native clip playback, sequences, 0.75x, decoding for waveforms
js/speech.js           microphone: MediaRecorder + de-DE speech recognition, record widget, vowel check
js/grading.js          all grading logic (pure functions, tested)
js/screens/*.js        one file per tab (abc.js is Alphabet und Zahlen)
tests.html, js/tests.js  tests for the grading logic
data/, audio/          your content, unchanged
```

### Tests
Run a local server and open `tests.html`:

```bash
python -m http.server 8765
```

Then open http://localhost:8765/tests.html. 67 tests cover the typing check, letter diff, drill judging, SM-2 intervals, exam scoring (sections, pass mark, form formats, Schreiben and Sprechen weights), the message check, speech comparison (including minimal pairs such as Staat / Stadt), the vowel length measurement and the number builder.

### Scoring details
- **SRS**: Again = back in 1 minute (same session), ease −0.2; Hard = interval × 1.2, ease −0.15; Good = 1 day, 3 days, then interval × ease; Easy = 4 days, 6 days, then interval × ease × 1.3, ease +0.15. Ease never goes below 1.3. A word is *known* once its next review is at least 7 days away.
- **Typing**: wrong or missing article, missing umlaut dots, spelling = mistake (Again). ae/oe/ue for umlauts, ss for ß, wrong capital = small mistake (Hard).
- **Hören / Lesen**: correct items / 15 × 25.
- **Schreiben**: form 5 gaps = 10 points, message = 15 points (3 content points × 3, ticked by you after seeing the model, plus 1 each for length, greeting, closing, capitals, umlauts and register).
- **Sprechen**: Goethe weights Teil 1 = 3 (keywords covered), Teil 2 = 6, Teil 3 = 6 (self-rated per card), scaled to 25.
- **Vowel length**: the stressed vowel is taken as the longest loud stretch of the word; your share of the word's duration is compared with the native clip's. Below 75% of the native share = too short, above 133% = too long.

## 4. Differences from the brief, and why
- **Web app instead of Expo.** Putting an Expo development build on an iPhone from a Windows PC needs a paid Apple Developer account and Node.js. A home screen web app is free, works offline and has the in-app microphone. Everything else in the brief is implemented.
- **Speech recognition** uses the browser's `webkitSpeechRecognition` (Apple's recognizer on iPhone) instead of on-device `expo-speech-recognition`. It needs a connection and works most reliably in a Safari tab (see 1C). When it is not available, recording, playback and the vowel length check still work, and the app says why.
- **Practise with Claude** blocks open a page with the prompt from the program, a Copy button and an Open Claude link.
- **Fonts** load from Google Fonts on first use and are then cached for offline use. Charis SIL is not on Google Fonts, so IPA uses Noto Serif.

## 5. Updating the app
Edit files, then in this folder:

```bash
git add -A && git commit -m "Update" && git push
```

GitHub Pages republishes within a minute. If the phone still shows the old version, close the app completely and open it twice (the service worker updates in the background). When you change app files, bump `VERSION` in `sw.js` so the shell cache refreshes.
