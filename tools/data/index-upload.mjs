// Spis plików z serwera Liveo (upload.liveomeble.pl ma otwarte katalogi) → tools/data/upload-index.json.
// Zapisujemy tylko to, czego używa strona: animacje (/anim) i zdjęcia aranżacji (/img/<kolekcja>/*_2160px|_1440px.jpg).
// Eksport kart wskazuje część animacji pod złymi adresami (np. /anim/ARIS/ zamiast /anim/aris/), a część aranżacji
// z serwera w kartach w ogóle nie ma — generate.mjs i fetch-images.mjs uzupełniają je z tego spisu.
// Uruchomienie: node tools/data/index-upload.mjs  (potem npm run prepare:site albo npm run data).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://upload.liveomeble.pl';
const files = [];
const seen = new Set();
async function walk(path, depth) {
  if (seen.has(path) || depth > 4) return;
  seen.add(path);
  let html = '';
  try { html = await (await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) })).text(); } catch { return; }
  const hrefs = [...html.matchAll(/href="([^"?#]+)"/g)].map(m => m[1]).filter(h => h.startsWith(path) && h !== path);
  hrefs.filter(h => !h.endsWith('/')).forEach(h => files.push(h));
  const dirs = hrefs.filter(h => h.endsWith('/'));
  for (let i = 0; i < dirs.length; i += 8) await Promise.all(dirs.slice(i, i + 8).map(d => walk(d, depth + 1)));
}
await Promise.all(['/anim/', '/img/'].map(p => walk(p, 0)));
const keep = f => /^\/anim\/[^/]+\/[^/]+\.(mp4|gif)$/i.test(f) || /^\/img\/[^/]+\/[^/]+_(2160|1440)px\.jpg$/i.test(f);
const list = [...new Set(files.filter(keep))].sort();
const out = join(dirname(fileURLToPath(import.meta.url)), 'upload-index.json');
writeFileSync(out, JSON.stringify({ checked: new Date().toISOString().slice(0, 10), base: BASE, files: list }, null, 1) + '\n');
console.log(`Spis serwera Liveo: ${list.filter(f => f.startsWith('/anim/')).length} animacji, ${list.filter(f => f.startsWith('/img/')).length} aranżacji → tools/data/upload-index.json`);
