import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePostcode, lookupPostcode, haversineKm, nearestResellers } from '../../src/lib/locator.js';

const load = name => JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url), 'utf8'));
const postcodes = load('postcodes');
const resellers = load('resellers');

const WAW = { lat: 52.2297, lng: 21.0122 };
const KRK = { lat: 50.0647, lng: 19.945 };
const RZE = { lat: 50.0412, lng: 21.9991 };

describe('normalizePostcode', () => {
  test('z myślnikiem, bez myślnika, ze spacjami', () => {
    assert.equal(normalizePostcode('35060'), '35-060');
    assert.equal(normalizePostcode('35-060'), '35-060');
    assert.equal(normalizePostcode(' 35 060 '), '35-060');
    assert.equal(normalizePostcode('35 - 060'), '35-060');
    assert.equal(normalizePostcode('35–060'), '35-060'); // półpauza
    assert.equal(normalizePostcode('35 060'), '35-060');
    assert.equal(normalizePostcode('00-950'), '00-950');
  });

  test('liczba (np. z formularza type=number) — zera wiodące', () => {
    assert.equal(normalizePostcode(35060), '35-060');
    assert.equal(normalizePostcode(950), '00-950');
  });

  test('błędne kody → null', () => {
    for (const bad of ['3506', '350600', '35-0600', 'ab-cde', '35-06a', '', '  ', null, undefined, '35_060', 3.5, -35060, {}]) {
      assert.equal(normalizePostcode(bad), null, `"${bad}"`);
    }
  });
});

describe('lookupPostcode', () => {
  test('prawdziwe dane: Rzeszów, Warszawa, Kraków', () => {
    const rz = lookupPostcode('35-060', postcodes);
    assert.equal(rz.prefix, '35');
    assert.equal(rz.precision, 'prefix-2');
    assert.match(rz.region, /Rzeszów/);
    assert.ok(haversineKm(rz, RZE) < 10);
    assert.ok(haversineKm(lookupPostcode('00001', postcodes), WAW) < 10);
    assert.ok(haversineKm(lookupPostcode('31 564', postcodes), KRK) < 10);
  });

  test('wszystkie prefiksy 00–99 poza 79 istnieją', () => {
    for (let i = 0; i < 100; i++) {
      const p = String(i).padStart(2, '0');
      const hit = lookupPostcode(`${p}-100`, postcodes);
      if (p === '79') assert.equal(hit, null);
      else assert.ok(hit, `brak prefiksu ${p}`);
    }
  });

  test('nieistniejący prefiks lub błędny kod → null', () => {
    assert.equal(lookupPostcode('79-123', postcodes), null);
    assert.equal(lookupPostcode('xx', postcodes), null);
    assert.equal(lookupPostcode('35-060', null), null);
  });

  test('przyjmuje też samą mapę prefiksów', () => {
    const hit = lookupPostcode('35060', { 35: { region: 'Test', lat: 50, lng: 22 } });
    assert.deepEqual({ lat: hit.lat, lng: hit.lng, region: hit.region }, { lat: 50, lng: 22, region: 'Test' });
  });
});

describe('haversineKm', () => {
  test('Warszawa–Kraków ≈ 252 km', () => {
    const d = haversineKm(WAW, KRK);
    assert.ok(d > 245 && d < 260, String(d));
  });
  test('symetryczna, zero dla tego samego punktu', () => {
    assert.equal(haversineKm(WAW, WAW), 0);
    assert.ok(Math.abs(haversineKm(WAW, RZE) - haversineKm(RZE, WAW)) < 1e-9);
  });
});

describe('nearestResellers', () => {
  const shops = [
    { id: 'krk', name: 'Kraków', lat: 50.06, lng: 19.94, collections: ['olmo', 'talve'] },
    { id: 'waw', name: 'Warszawa', lat: 52.23, lng: 21.01, collections: ['olmo'] },
    { id: 'rze', name: 'Rzeszów', lat: 50.04, lng: 22.0, collections: ['nokta'] },
    { id: 'tar', name: 'Tarnów', lat: 50.01, lng: 20.99, collections: ['OLMO'] },
    { id: 'bad', name: 'Bez współrzędnych', collections: ['olmo'] },
  ];

  test('sortuje od najbliższego i dodaje distanceKm', () => {
    const r = nearestResellers(shops, KRK, { limit: 10 });
    assert.deepEqual(r.map(s => s.id), ['krk', 'tar', 'rze', 'waw']);
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].distanceKm <= r[i].distanceKm);
    assert.equal(typeof r[0].distanceKm, 'number');
    assert.equal(shops[0].distanceKm, undefined, 'nie modyfikuje wejścia');
  });

  test('filtr kolekcji (bez względu na wielkość liter)', () => {
    const r = nearestResellers(shops, RZE, { collection: 'olmo', limit: 10 });
    assert.deepEqual(r.map(s => s.id), ['tar', 'krk', 'waw']);
    assert.equal(nearestResellers(shops, RZE, { collection: 'nokta' })[0].id, 'rze');
    assert.deepEqual(nearestResellers(shops, RZE, { collection: 'solma' }), []);
  });

  test('limit i maxKm', () => {
    assert.equal(nearestResellers(shops, KRK, { limit: 2 }).length, 2);
    assert.deepEqual(nearestResellers(shops, KRK, { maxKm: 100 }).map(s => s.id), ['krk', 'tar']);
    assert.equal(nearestResellers(shops, KRK).length, 4); // domyślny limit 5
  });

  test('błędny punkt → pusta lista', () => {
    assert.deepEqual(nearestResellers(shops, null), []);
    assert.deepEqual(nearestResellers(shops, { lat: NaN, lng: 1 }), []);
    assert.deepEqual(nearestResellers(null, KRK), []);
  });

  test('prawdziwe dane: kod z Krakowa → najbliższe sklepy w Krakowie, każdy z wybraną kolekcją', () => {
    const point = lookupPostcode('30-001', postcodes);
    const all = nearestResellers(resellers, point, { limit: 3 });
    assert.equal(all[0].city, 'Kraków');
    for (const slug of ['olmo', 'briso', 'verno']) {
      const list = nearestResellers(resellers, point, { collection: slug, limit: 5 });
      assert.ok(list.length > 0, slug);
      assert.ok(list.every(s => s.collections.includes(slug)), slug);
    }
  });

  test('prawdziwe dane: kod z Podkarpacia → sklepy w promieniu 50 km', () => {
    const point = lookupPostcode('36-130', postcodes); // okolice Rzeszowa
    const near = nearestResellers(resellers, point, { maxKm: 50, limit: 20 });
    assert.ok(near.length >= 3);
    assert.ok(near.every(s => s.voivodeship === 'podkarpackie'));
  });
});
