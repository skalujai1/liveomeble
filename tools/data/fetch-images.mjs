#!/usr/bin/env node
// Zdjęcia z kart produktu (serwer Liveo: upload.liveomeble.pl) → lekkie WebP w public/katalog/ + manifest.
//
//   node tools/data/fetch-images.mjs [--force]
//
// Nie trzymamy zdjęć w repozytorium: karty (tools/data/karty-liveo.json) wskazują oryginały na serwerze Liveo,
// a ten skrypt przed buildem pobiera tylko to, czego jeszcze nie ma w public/katalog/ (lokalnie i w CI — cache).
// Packshot wariantu: 480 i 1000 px szerokości. Aranżacje kolekcji: 1280 i 2400 px (oryginały mają ~2,4 MB).
// Dodatkowe zdjęcia wariantu (do 3): 1000 px. Rysunek wymiarowy: 1200 px. Instrukcje PDF i animacje strona linkuje do serwera Liveo.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/katalog');
const MANIFEST = join(OUT, 'manifest.json');
const force = process.argv.includes('--force');
const karty = JSON.parse(readFileSync(join(ROOT, 'tools/data/karty-liveo.json'), 'utf8'));
export const ARRANGEMENTS_PER_COLLECTION = 8;

export const https = u => u.replace(/^http:\/\//, 'https://');

// lista zadań: [url, szerokości, zapasowe adresy] — gdy pierwsze zdjęcie wariantu nie istnieje (404), próbujemy kolejnych
const jobs = new Map();
for (const p of karty.products) {
  for (const v of p.variants) if (v.photos[0]) jobs.set(https(v.photos[0]), [480, 1000, v.photos.slice(1).map(https)]);
}
export const GALLERY_PER_VARIANT = 3;
for (const p of karty.products) {
  for (const v of p.variants) for (const u of v.photos.slice(1, 1 + GALLERY_PER_VARIANT)) if (!jobs.has(https(u))) jobs.set(https(u), [1000, null, []]);
  if (p.drawing) jobs.set(https(p.drawing), [1200, null, []]);
}
for (const list of Object.values(karty.arrangements)) {
  for (const u of list.slice(0, ARRANGEMENTS_PER_COLLECTION)) jobs.set(https(u), [1280, 2400, []]);
}

mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) && !force ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const ok = u => manifest[u] && (manifest[u].alias ? ok(manifest[u].alias) : manifest[u].widths.every(w => existsSync(join(OUT, `${manifest[u].key}-${w}.webp`))));
const todo = [...jobs].map(([u, [a, b, fallbacks]]) => [u, [a, b].filter(Boolean), fallbacks]).filter(([u]) => !ok(u));
console.log(`Zdjęcia katalogu: ${jobs.size} w kartach, do pobrania ${todo.length}`);

let done = 0, failed = 0;
async function one([url, widths, fallbacks = []], original = url) {
  const key = createHash('sha1').update(url).digest('hex').slice(0, 10) + '-' + url.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9_-]+/gi, '').slice(0, 40).toLowerCase();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf, { failOn: 'none' }).rotate();
    const { width, height } = await img.metadata();
    const made = [];
    for (const w of widths) {
      const tw = Math.min(w, width);
      if (made.includes(tw)) continue;
      await img.clone().resize({ width: tw, withoutEnlargement: true }).webp({ quality: tw > 1500 ? 72 : 78, effort: 5 }).toFile(join(OUT, `${key}-${tw}.webp`));
      made.push(tw);
    }
    manifest[url] = { key, w: width, h: height, widths: made };
    if (original !== url) manifest[original] = { alias: url };
  } catch (e) {
    if (fallbacks.length) return one([fallbacks[0], widths, fallbacks.slice(1)], original);
    failed++;
    console.warn(`  ! ${original}: ${e.message}`);
  }
  if (++done % 50 === 0) {
    console.log(`  ${done}/${todo.length}`);
    writeFileSync(MANIFEST, JSON.stringify(manifest));
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); }));
writeFileSync(MANIFEST, JSON.stringify(manifest));
console.log(`Gotowe: ${Object.keys(manifest).length} zdjęć w manifeście, błędy: ${failed}`);
