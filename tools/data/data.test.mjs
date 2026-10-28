// Spójność danych strony (src/data) z kart produktu Liveo. Po zmianach: node tools/data/generate.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateData } from './validate.mjs';

const load = name => JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url), 'utf8'));
const names = ['finishes', 'types', 'rooms', 'collections', 'products', 'promotions', 'postcodes', 'resellers', 'meta'];
const data = Object.fromEntries(names.map(n => [n, load(n)]));
const karty = JSON.parse(readFileSync(new URL('./karty-liveo.json', import.meta.url), 'utf8'));

test('dane przechodzą kontrolę spójności', () => {
  assert.deepEqual(validateData(data), []);
});

test('prawdziwy katalog: 30+ kolekcji z kart, 400+ mebli, 400+ salonów, bez cen i promocji', () => {
  assert.ok(data.collections.length >= 30, String(data.collections.length));
  assert.ok(data.products.length >= 400, String(data.products.length));
  assert.ok(data.resellers.length >= 400);
  assert.equal(data.promotions.length, 0);
  for (const p of data.products) assert.ok(!('basePrice' in p), p.slug);
  for (const name of ['ARIS', 'DANTE', 'IRMA', 'MILTON', 'REMI']) assert.ok(data.collections.some(c => c.name === name), name);
});

test('każdy mebel z karty trafił na stronę (bez akcesoriów i modułów kuchennych)', () => {
  assert.equal(data.products.length, karty.products.length);
  const variants = data.products.reduce((a, p) => a + p.variants.length, 0);
  assert.equal(variants, karty.products.reduce((a, p) => a + p.variants.length, 0));
  // akcesoria nie są meblami na stronie
  assert.ok(!data.products.some(p => /UCHWYT|PROFIL LED|ZESTAW ZASILAJ/i.test(p.name)));
});

test('kolory wariantów: DANTE ma 5 wersji frontów na tym samym korpusie', () => {
  const dante = data.collections.find(c => c.slug === 'dante');
  const labels = dante.finishes.map(f => f.label);
  for (const front of ['antracyt mat', 'biały mat', 'kaszmir mat', 'szary mat', 'zielony mat']) {
    assert.ok(labels.includes(`Dąb cremona torro / ${front}`), front);
  }
  const dt03 = data.products.find(p => p.collection === 'dante' && p.sku === 'DT03');
  assert.equal(dt03.variants.length, 5);
});

test('łóżka: osobny mebel na rozmiar i wersję z pojemnikiem', () => {
  const beds = data.products.filter(p => p.collection === 'ate' && p.type === 'lozko');
  assert.ok(beds.some(p => p.name === 'Łóżko 160 z pojemnikiem ATE AT15'));
  assert.ok(beds.some(p => p.name === 'Łóżko 160 bez stelaża ATE AT15'));
});

test('zdjęcia: każdy mebel ma zdjęcie (własne albo aranżację z karty)', () => {
  const missing = data.products.filter(p => !p.images.packshot).map(p => p.slug);
  assert.deepEqual(missing, []);
  for (const c of data.collections) assert.ok(c.arrangements.length > 0, c.slug);
});

test('eksport katalogu doradcy: format widżetu, jeden rekord na wariant, bez cen', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'liveo-catalog-'));
  try {
    const out = join(dir, 'catalog.json');
    const script = fileURLToPath(new URL('./export-assistant-catalog.mjs', import.meta.url)); // .pathname psuje ścieżkę na Windows (/D:/…)
    execFileSync(process.execPath, [script, `--out=${out}`], { stdio: 'pipe' });
    const cat = JSON.parse(readFileSync(out, 'utf8'));
    const keys = new Set(data.rooms.map(r => r.assistantKey));
    assert.equal(cat.products.length, data.products.reduce((a, p) => a + p.variants.length, 0));
    assert.equal(Object.keys(cat.collections).length, data.collections.length);
    for (const x of cat.products) {
      assert.equal(x.collection, x.collection.toUpperCase());
      assert.ok(cat.collections[x.collection], x.collection);
      assert.ok(x.rooms.length && x.rooms.every(r => keys.has(r)), `${x.id}: ${x.rooms}`);
      assert.ok(x.url.startsWith('/produkt/'), x.url);
      assert.ok(x.img?.startsWith('/katalog/'), `${x.id}: ${x.img}`);
      assert.equal(x.price, null);
      for (const k of ['light', 'wood', 'black', 'gloss']) assert.ok(k in x.color, `${x.id}: color.${k}`);
      assert.ok(x.color.light >= 0 && x.color.light <= 1);
    }
    // „Kuchnia” w doradcy: zestawy kuchenne TIFFANY
    assert.ok(cat.products.some(x => x.rooms.includes('kuchnia') && x.type === 'kuchnia'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
