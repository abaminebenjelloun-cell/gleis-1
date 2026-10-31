// Offline support: app shell + data precached, audio cached on first play (or via "Download all audio").
const VERSION = 'gleis-shell-v5';
const AUDIO = 'gleis-audio-v1';
const FONTS = 'gleis-fonts-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/data.js', 'js/store.js', 'js/ui.js', 'js/audio.js', 'js/speech.js', 'js/grading.js',
  'js/screens/today.js', 'js/screens/lessons.js', 'js/screens/cards.js', 'js/screens/grammar.js',
  'js/screens/pron.js', 'js/screens/abc.js', 'js/screens/exam.js', 'js/screens/progress.js',
  'data/vocab.json', 'data/grammar.json', 'data/pron.json', 'data/abc.json', 'data/lessons.json', 'data/program.json', 'data/exam.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gleis-shell-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Safari asks for audio with a Range header and needs a 206 answer
async function rangeResponse(req, resp) {
  const range = req.headers.get('range');
  if (!range) return resp;
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = buf.byteLength;
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) { start = size - Number(m[2]); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start < 0) start = 0;
  if (start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const key = url.pathname.slice(url.pathname.indexOf('audio/'));
      let resp = await cache.match(key);
      if (!resp) {
        const net = await fetch(url.href); // full file, no range, so it can be cached
        if (net.ok) { await cache.put(key, net.clone()); resp = net; } else return net;
      }
      return rangeResponse(req, resp.clone());
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }

  if (url.origin === location.origin) {
    // stale while revalidate for the app shell and data
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || (await c.match('index.html'));
    }));
  }
});
