#!/usr/bin/env node
// Synchronizacja doradcy wnętrz do katalogu publicznego strony (uruchamiane przed dev i build).
//
//   liveo-assistant/widget/*.js|css   → public/liveo-assistant/widget/ (zminifikowane: oxc z rolldown, lightningcss)
//   liveo-assistant/data/catalog.json → public/liveo-assistant/data/   (+ text-embeddings.json, wiedza.txt, jeśli są)
//   src/assets/renders/products/*.webp → public/media/produkty/       (obrazy kart w widżecie: /media/produkty/<sku>--<wariant>.webp)
//   public/liveo-assistant/fonts.css  — lokalny arkusz fontów: widżet nie dociąga wtedy Google Fonts.
//
// Pliki w liveo-assistant/ są źródłem — tu tylko kopiujemy (katalogi docelowe są w .gitignore).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minifySync } from 'rolldown/utils';
import { transform as transformCss } from 'lightningcss';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'liveo-assistant');
const OUT = join(ROOT, 'public', 'liveo-assistant');
const RENDERS = join(ROOT, 'src', 'assets', 'renders', 'products');
const MEDIA = join(ROOT, 'public', 'media', 'produkty');

function copyDir(from, to, filter, minify = false) {
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of readdirSync(from)) {
    const p = join(from, f);
    if (!statSync(p).isFile() || !filter(f)) continue;
    if (minify && f.endsWith('.js')) {
      const r = minifySync(f, readFileSync(p, 'utf8'), { compress: true, mangle: { toplevel: false } });
      if (r.errors?.length) throw new Error(`Minifikacja ${f}: ${r.errors.map(e => e.message).join('; ')}`);
      writeFileSync(join(to, f), r.code);
    } else if (minify && f.endsWith('.css')) {
      writeFileSync(join(to, f), transformCss({ filename: f, code: readFileSync(p), minify: true }).code);
    } else copyFileSync(p, join(to, f));
    n++;
  }
  return n;
}

// Czysta kopia (usunięte pliki źródłowe nie zostają w public/).
rmSync(OUT, { recursive: true, force: true });
const widget = copyDir(join(SRC, 'widget'), join(OUT, 'widget'), f => /\.(js|css)$/.test(f), true);
const data = copyDir(join(SRC, 'data'), join(OUT, 'data'), f => ['catalog.json', 'text-embeddings.json', 'wiedza.txt'].includes(f));
if (!existsSync(join(OUT, 'widget', 'liveo-assistant.js'))) throw new Error('Brak liveo-assistant/widget/liveo-assistant.js');
if (!existsSync(join(OUT, 'data', 'catalog.json'))) throw new Error('Brak liveo-assistant/data/catalog.json — uruchom tools/data/export-assistant-catalog.mjs');

writeFileSync(
  join(OUT, 'fonts.css'),
  `/* Fonty widżetu doradcy: lokalnie (bez Google Fonts). Widżet używa fontów strony (EB Garamond, Hanken Grotesk),
   zadeklarowanych przez @font-face w <head> (src/layouts/BaseLayout.astro, pliki w public/fonts). */\n`,
);

rmSync(MEDIA, { recursive: true, force: true });
const media = copyDir(RENDERS, MEDIA, f => /\.webp$/.test(f));

console.log(`Doradca wnętrz → public/liveo-assistant: widżet ${widget} plików, dane ${data} plików; obrazy produktów → public/media/produkty: ${media}${media ? '' : ' (renderów produktów jeszcze nie ma)'}`);
