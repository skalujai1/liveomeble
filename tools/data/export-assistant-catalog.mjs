#!/usr/bin/env node
// Eksport katalogu dla widżetu „Doradca wnętrz” (liveo-assistant/data/catalog.json).
//
//   node tools/data/export-assistant-catalog.mjs [--now=2026-10-20T12:00:00+02:00] [--out=liveo-assistant/data/catalog.json]
//
// Format zgodny z liveo-assistant/widget/recommender.js i liveo-assistant.js:
//   { products: [{ id, name, collection, model, type, rooms, price, regular, url, img, color, bestseller, stock }],
//     collections: { NAZWA: "/kolekcje/<slug>/" } }
// Jeden rekord na wariant kolorystyczny. Ceny liczone przez src/lib/pricing.js
// w chwili --now (domyślnie: teraz), więc aktywne promocje są już uwzględnione.
// Warianty „wyprzedany” pomijamy — doradca nie powinien polecać niedostępnych mebli.
//
// Uwagi do formatu widżetu:
//   - name: WIELKIMI LITERAMI (jak w starym katalogu sklepu). recommender.fitsRoom()
//     czyta szerokość łóżka z nazwy wzorcem /ŁÓŻKO (\d+)/ — bez tego łóżko 90 cm
//     trafiłoby do propozycji do sypialni.
//   - model: nazwa do wyświetlenia na karcie (widżet pokazuje model, gdy różni się od kolekcji).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { priceFor } from '../../src/lib/pricing.js';

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
const promotions = read('promotions');

const F = Object.fromEntries(finishes.map(f => [f.id, f]));
const C = Object.fromEntries(collections.map(c => [c.slug, c]));
const ROOM_KEY = Object.fromEntries(rooms.map(r => [r.slug, r.assistantKey]));

/** Cechy kolorystyczne wariantu dla recommender.colorScore(): jasność, drewno, czerń, połysk. */
function colorProfile(finish, model, label) {
  const boards = [
    [finish.front, finish.top ? 0.5 : 0.6],
    [finish.body, finish.top ? 0.3 : 0.4],
    ...(finish.top ? [[finish.top, 0.2]] : []),
  ].filter(([id]) => F[id]);
  const wsum = boards.reduce((a, [, w]) => a + w, 0);
  const light = boards.reduce((a, [id, w]) => a + F[id].light * w, 0) / wsum;
  const visibleMetal = ['legsMetal', 'frame'].includes(model.base) || model.handle === 'bar' || model.kind === 'coatRack'
    || (model.kind === 'mirror' && model.frameMaterial === 'metal');
  return {
    label,
    light: Math.round(light * 100) / 100,
    wood: boards.some(([id]) => F[id].wood) || F[finish.legs]?.wood === true,
    black: boards.some(([id]) => F[id].black) || (visibleMetal && finish.metal === 'czarny'),
    gloss: boards.some(([id]) => F[id].gloss),
  };
}

const out = [];
for (const p of products) {
  const coll = C[p.collection];
  for (const v of p.variants) {
    if (v.stock === 'wyprzedany') continue;
    const price = priceFor(p, v.code, promotions, now);
    out.push({
      id: `${p.sku}--${v.code}`,
      name: p.name.toLocaleUpperCase('pl'),
      collection: coll.name.toLocaleUpperCase('pl'),
      model: p.name,
      type: p.type,
      rooms: [...new Set(p.rooms.map(r => ROOM_KEY[r]).filter(Boolean))],
      price: price.price,
      regular: price.regular,
      url: `/produkt/${p.slug}/`,
      img: `/media/produkty/${p.sku}--${v.code}.webp`,
      color: colorProfile(v.finish, p.model3d, v.colorLabel),
      bestseller: !!p.bestseller,
      stock: v.stock,
    });
  }
}

const catalog = {
  source: 'demo',
  demo: true,
  note: 'Dane demonstracyjne — fikcyjne meble Liveo. Generowane z src/data przez tools/data/export-assistant-catalog.mjs.',
  updated: now.toISOString(),
  count: out.length,
  collections: Object.fromEntries(collections.map(c => [c.name.toLocaleUpperCase('pl'), `/kolekcje/${c.slug}/`])),
  products: out,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(catalog) + '\n');
const onSale = out.filter(x => x.regular).length;
console.log(`Zapisano ${out.length} rekordów (warianty), w tym ${onSale} w promocji → ${OUT}`);
