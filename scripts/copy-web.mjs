// Copies the web app into www/ for the native build (Capacitor webDir). The site itself stays at the repo root for GitHub Pages.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const items = ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'audio', 'icons'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const it of items) cpSync(it, `www/${it}`, { recursive: true });
rmSync('www/js/tests.js', { force: true });
console.log('www/ ready:', items.join(', '));
