// Uzupełnienia z serwera Liveo (spis: tools/data/upload-index.json, node tools/data/index-upload.mjs).
// Używają ich fetch-images.mjs (co pobrać) i generate.mjs (co pokazać), więc oba liczą to samo.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), 'upload-index.json');
const INDEX = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { base: 'https://upload.liveomeble.pl', files: [] };
const base = INDEX.base;
const name = p => decodeURIComponent(p.split('/').pop());
const folderOf = coll => coll.toLowerCase().replace(/\s+/g, '-');

/** Ujęcie bez koloru: „DANTE_01_kaszmir_2160px.jpg” → „dante_01” (ten sam kadr w innym kolorze). */
export const sceneKey = url => {
  const parts = name(url).toLowerCase().replace(/_(2160|1440)px\.jpg$/, '').split('_');
  while (parts.length > 2 && /^[a-ząćęłńóśźż-]+$/.test(parts.at(-1))) parts.pop();
  return parts.join('_');
};

/** Aranżacje kolekcji z serwera, których nie ma w kartach — tylko nowe kadry (bez tego samego ujęcia w innym kolorze). */
export function extraArrangements(coll, kartyUrls = []) {
  const known = new Set(kartyUrls.map(sceneKey));
  const folder = folderOf(coll);
  const out = [];
  for (const p of INDEX.files) {
    const dir = p.split('/')[2]?.toLowerCase();
    if (!p.startsWith('/img/') || !(dir === folder || dir?.startsWith(folder + '-'))) continue;
    const k = sceneKey(p);
    if (known.has(k)) continue;
    known.add(k);
    out.push(base + p);
  }
  return out;
}

/** Animacja mebla z serwera po symbolu (np. „DT04”); najpierw w kolorze pierwszego wariantu (np. „AZ”), potem GIF, potem dowolna. */
export function animationFor(code, colorCode = '') {
  const re = new RegExp(`^${code}(?![0-9])`, 'i');
  const list = INDEX.files.filter(p => p.startsWith('/anim/') && re.test(name(p)));
  if (!list.length) return null;
  const byColor = colorCode && list.find(p => name(p).toUpperCase().startsWith(`${code}_${colorCode}_`.toUpperCase()));
  return base + (byColor || list.find(p => /\.gif$/i.test(p)) || list[0]);
}
