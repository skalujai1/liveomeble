// Spójność wygenerowanych danych demo (src/data). Po zmianach: node tools/data/generate.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateData } from './validate.mjs';
import { priceFor } from '../../src/lib/pricing.js';

const load = name => JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url), 'utf8'));
const names = ['finishes', 'types', 'rooms', 'collections', 'products', 'promotions', 'postcodes', 'resellers', 'meta'];
const data = Object.fromEntries(names.map(n => [n, load(n)]));
const TODAY = data.meta.generatedFor;
const NOON = `${TODAY}T12:00:00+02:00`;

test('dane przechodzą kontrolę spójności', () => {
  assert.deepEqual(validateData(data, TODAY), []);
});

test('80–100 produktów, 8 kolekcji, ~45 sklepów, wszystko oznaczone jako demo', () => {
  assert.ok(data.products.length >= 80 && data.products.length <= 100, String(data.products.length));
  assert.equal(data.collections.length, 8);
  assert.ok(data.resellers.length >= 40 && data.resellers.length <= 50);
  for (const list of [data.products, data.collections, data.resellers, data.promotions]) {
    assert.ok(list.every(x => x.demo === true));
  }
});

test('nazwy kolekcji nie pokrywają się z prawdziwymi kolekcjami Liveo', () => {
  const banned = ['ARIS', 'DANTE', 'IRMA', 'ELIZA', 'MODENA'];
  for (const c of data.collections) assert.ok(!banned.includes(c.name), c.name);
});

test('każda kolekcja ma meble do każdego swojego pomieszczenia', () => {
  for (const c of data.collections) {
    for (const room of c.rooms) {
      const n = data.products.filter(p => p.collection === c.slug && p.rooms.includes(room)).length;
      assert.ok(n >= 2, `${c.slug} / ${room}: ${n}`);
    }
  }
});

test('promocje działają na danych: OLMO −15%, komody −10%, Omnibus', () => {
  const byId = Object.fromEntries(data.products.map(p => [p.sku, p]));
  const rtv = byId['LV-OLMO-RTV160'];
  const r = priceFor(rtv, null, data.promotions, NOON);
  assert.equal(r.promo.id, 'promo-olmo-jesien');
  assert.equal(r.price, Math.floor(rtv.basePrice * 0.85));

  const komoda = data.products.find(p => p.type === 'komoda' && p.collection !== 'olmo');
  assert.equal(priceFor(komoda, null, data.promotions, NOON).promo.id, 'promo-komody');

  // łóżko OLMO było we wrześniu −20% → lowest30 niższa niż obecna cena promocyjna (−15%)
  const bed = data.products.find(p => p.collection === 'olmo' && p.type === 'lozko');
  const b = priceFor(bed, null, data.promotions, NOON);
  assert.ok(b.lowest30 < b.price, `${b.lowest30} < ${b.price}`);
  assert.ok(b.lowest30 <= Math.floor(bed.basePrice * 0.8));

  // przyszła „cena tygodnia” jeszcze nie działa, a po starcie pokazuje cenę sprzed podwyżki jako lowest30
  const week = data.promotions.find(p => p.kind === 'fixedPrice');
  const target = byId[week.scope.skus[0]];
  assert.equal(priceFor(target, null, data.promotions, NOON).promo, null);
  const later = priceFor(target, null, data.promotions, week.startsAt);
  assert.equal(later.price, week.value);
  assert.ok(later.lowest30 < target.basePrice);
});
