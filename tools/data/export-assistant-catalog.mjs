#!/usr/bin/env node
// Eksport katalogu dla widżetu „Doradca wnętrz” (liveo-assistant/data/catalog.json).
//
//   node tools/data/export-assistant-catalog.mjs [--now=2026-10-20T12:00:00+02:00] [--out=liveo-assistant/data/catalog.json]
//
// Format zgodny z liveo-assistant/widget/recommender.js i liveo-assistant.js:
//   { products: [{ id, name, collection, model, type, rooms, price, regular, url, img, color, bestseller }],
//     collections: { NAZWA: "/kolekcje/<slug>/" } }
// Jeden rekord na wariant kolorystyczny. Katalog pochodzi z kart produktu Liveo, które nie mają cen —
// price = null (widżet pokazuje wtedy „Cena w salonie partnerskim” i nie filtruje po budżecie).
//
// Uwagi do formatu widżetu:
//   - name: WIELKIMI LITERAMI (jak w starym katalogu sklepu). recommender.fitsRoom()
//     czyta szerokość łóżka z nazwy wzorcem /ŁÓŻKO (\d+)/ — bez tego łóżko 90 cm
//     trafiłoby do propozycji do sypialni.
//   - model: nazwa do wyświetlenia na karcie (widżet pokazuje model, gdy różni się od kolekcji).
//   - img: packshot wariantu z public/katalog (tools/data/fetch-images.mjs).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(a => /^--([^=]+)=(.*)$/.exec(a)).filter(Boolean).map(m => [m[1], m[2]]));
const DATA = resolve(ROOT, args.data || 'src/data');
const OUT = resolve(ROOT, args.out || 'liveo-assistant/data/catalog.json');
const now = args.now ? new Date(args.now) : new Date();
if (Number.isNaN(+now)) throw new Error(`Nieprawidłowe --now: ${args.now}`);

const read = name => JSON.parse(readFileSync(resolve(DATA, `${name}.json`), 'utf8'));
const finishes = read('finishes');
const rooms = read('rooms');
const collections = read('collections');
const products = read('products');

const F = Object.fromEntries(finishes.map(f => [f.id, f]));
const C = Object.fromEntries(collections.map(c => [c.slug, c]));
const ROOM_KEY = Object.fromEntries(rooms.map(r => [r.slug, r.assistantKey]));

const assistantRooms = p => [...new Set(p.rooms.map(r => ROOM_KEY[r]).filter(Boolean))];

/** Cechy kolorystyczne wariantu dla recommender.colorScore(): jasność, drewno, czerń, połysk. */
function colorProfile(finish, label) {
  const boards = [[finish.front, 0.55], [finish.body, 0.35], [finish.accent, 0.1]].filter(([id]) => F[id]);
  const wsum = boards.reduce((a, [, w]) => a + w, 0) || 1;
  const light = boards.reduce((a, [id, w]) => a + F[id].light * w, 0) / wsum;
  return {
    label,
    light: Math.round(light * 100) / 100,
    wood: boards.some(([id]) => F[id].wood),
    black: boards.some(([id]) => F[id].light < 0.3),
    gloss: boards.some(([id]) => F[id].gloss),
  };
}

const imgOf = v => {
  const pk = v.images?.packshot;
  if (!pk) return null;
  const w = pk.widths.includes(480) ? 480 : Math.min(...pk.widths);
  return `${pk.base}-${w}.webp`;
};

const out = [];
for (const p of products) {
  const coll = C[p.collection];
  for (const v of p.variants) {
    out.push({
      id: `${p.slug}--${v.code}`,
      name: p.name.toLocaleUpperCase('pl'),
      collection: coll.name.toLocaleUpperCase('pl'),
      model: p.name,
      type: p.type,
      rooms: assistantRooms(p),
      price: null,
      regular: null,
      url: `/produkt/${p.slug}/${v.code === p.variants[0].code ? '' : `?kolor=${v.code}`}`,
      img: imgOf(v),
      color: colorProfile(v.finish, v.colorLabel),
      bestseller: !!p.bestseller,
      delivery72: !!p.delivery72,
    });
  }
}

const catalog = {
  source: 'karty-produktu-liveo',
  demo: false,
  note: 'Katalog z kart produktu Liveo (bez cen). Generowany z src/data przez tools/data/export-assistant-catalog.mjs.',
  updated: now.toISOString(),
  count: out.length,
  collections: Object.fromEntries(collections.map(c => [c.name.toLocaleUpperCase('pl'), `/kolekcje/${c.slug}/`])),
  products: out,
};

// Gdy produkty i kolekcje się nie zmieniły, zostawiamy plik w spokoju (bez zmiany samego „updated”),
// żeby każdy build nie tworzył pustej zmiany w repo.
mkdirSync(dirname(OUT), { recursive: true });
let previous = null;
try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* brak pliku albo zły JSON – zapisujemy od nowa */ }
const same = previous
  && JSON.stringify(previous.products) === JSON.stringify(catalog.products)
  && JSON.stringify(previous.collections) === JSON.stringify(catalog.collections);
if (!same) writeFileSync(OUT, JSON.stringify(catalog) + '\n');
console.log(same
  ? `Katalog bez zmian (${out.length} rekordów) — plik nie nadpisany: ${OUT}`
  : `Zapisano ${out.length} rekordów (warianty) → ${OUT}`);
