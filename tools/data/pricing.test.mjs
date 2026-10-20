import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  priceFor, formatPrice, activePromotions, isActive, lowestPriceBefore, warsawDay, warsawISO, discountedPrice,
} from '../../src/lib/pricing.js';

const NOW = '2026-10-20T12:00:00+02:00';

const product = (over = {}) => ({
  id: 'olmo-kom120',
  sku: 'LV-OLMO-KOM120',
  collection: 'olmo',
  type: 'komoda',
  basePrice: 1000,
  variants: [
    { code: 'DN', sku: 'LV-OLMO-KOM120-DN' },
    { code: 'KA-DN', sku: 'LV-OLMO-KOM120-KA-DN' },
  ],
  priceHistory: [{ date: '2026-08-21', price: 1000 }],
  ...over,
});

const promo = (over = {}) => ({
  id: 'p1',
  label: '−15% na kolekcję OLMO',
  kind: 'percent',
  value: 15,
  scope: { collections: ['olmo'] },
  startsAt: '2026-10-13T00:00:00+02:00',
  endsAt: '2026-10-31T00:00:00+01:00',
  ...over,
});

describe('priceFor — bez promocji', () => {
  test('brak promocji: cena regularna, regular/promo/lowest30 = null', () => {
    assert.deepEqual(priceFor(product(), 'DN', [], NOW), {
      price: 1000, regular: null, promo: null, lowest30: null, currency: 'PLN',
    });
  });

  test('promocje = undefined/null nie psują wyniku', () => {
    assert.equal(priceFor(product(), 'DN', undefined, NOW).price, 1000);
    assert.equal(priceFor(product(), 'DN', null, NOW).price, 1000);
  });

  test('bez kodu wariantu: pierwszy wariant; nieznany kod: cena produktu', () => {
    assert.equal(priceFor(product(), null, [], NOW).price, 1000);
    assert.equal(priceFor(product(), 'XX', [], NOW).price, 1000);
  });

  test('cena wariantu (variant.basePrice) ma pierwszeństwo', () => {
    const p = product({ variants: [{ code: 'DN', sku: 'x', basePrice: 1200 }] });
    assert.equal(priceFor(p, 'DN', [], NOW).price, 1200);
  });
});

describe('priceFor — czas trwania promocji', () => {
  test('aktywna promocja obniża cenę', () => {
    const r = priceFor(product(), 'DN', [promo()], NOW);
    assert.equal(r.price, 850);
    assert.equal(r.regular, 1000);
    assert.deepEqual(r.promo, { id: 'p1', label: '−15% na kolekcję OLMO', endsAt: '2026-10-31T00:00:00+01:00' });
  });

  test('wygasła promocja nie działa', () => {
    const r = priceFor(product(), 'DN', [promo({ startsAt: '2026-09-01T00:00:00+02:00', endsAt: '2026-09-15T00:00:00+02:00' })], NOW);
    assert.equal(r.price, 1000);
    assert.equal(r.promo, null);
  });

  test('przyszła promocja jeszcze nie działa', () => {
    const r = priceFor(product(), 'DN', [promo({ startsAt: '2026-10-25T00:00:00+02:00', endsAt: '2026-11-01T00:00:00+01:00' })], NOW);
    assert.equal(r.price, 1000);
    assert.equal(r.regular, null);
  });

  test('granice: startsAt włącznie, endsAt wyłącznie', () => {
    const p = promo();
    assert.equal(isActive(p, '2026-10-13T00:00:00+02:00'), true);
    assert.equal(isActive(p, '2026-10-12T23:59:59+02:00'), false);
    assert.equal(isActive(p, '2026-10-30T23:59:59+01:00'), true);
    assert.equal(isActive(p, '2026-10-31T00:00:00+01:00'), false);
  });

  test('brak dat = bez ograniczenia; enabled: false wyłącza promocję', () => {
    assert.equal(isActive({ kind: 'percent', value: 10 }, NOW), true);
    assert.equal(isActive(promo({ enabled: false }), NOW), false);
  });

  test('activePromotions zwraca tylko trwające, od najwcześniej kończącej się', () => {
    const list = [
      promo({ id: 'late', endsAt: '2026-11-30T00:00:00+01:00' }),
      promo({ id: 'past', startsAt: '2026-09-01T00:00:00+02:00', endsAt: '2026-09-10T00:00:00+02:00' }),
      promo({ id: 'soon', endsAt: '2026-10-22T00:00:00+02:00' }),
      promo({ id: 'future', startsAt: '2026-11-01T00:00:00+01:00', endsAt: '2026-11-08T00:00:00+01:00' }),
    ];
    assert.deepEqual(activePromotions(list, NOW).map(p => p.id), ['soon', 'late']);
  });
});

describe('priceFor — wybór promocji i zakres', () => {
  test('najlepsza pojedyncza promocja, bez łączenia', () => {
    const r = priceFor(product(), 'DN', [
      promo({ id: 'kolekcja', value: 15 }),
      promo({ id: 'typ', value: 10, scope: { types: ['komoda'] } }),
    ], NOW);
    assert.equal(r.price, 850); // nie 765 (15% + 10%)
    assert.equal(r.promo.id, 'kolekcja');
  });

  test('fixedPrice ustawia cenę', () => {
    const r = priceFor(product(), 'DN', [promo({ id: 'fx', kind: 'fixedPrice', value: 799 })], NOW);
    assert.equal(r.price, 799);
    assert.equal(r.regular, 1000);
  });

  test('fixedPrice wyższa niż cena regularna jest pomijana', () => {
    const r = priceFor(product(), 'DN', [promo({ kind: 'fixedPrice', value: 1100 })], NOW);
    assert.equal(r.price, 1000);
    assert.equal(r.promo, null);
  });

  test('fixedPrice wygrywa z procentem, gdy daje niższą cenę', () => {
    const r = priceFor(product(), 'DN', [promo({ id: 'pct', value: 15 }), promo({ id: 'fx', kind: 'fixedPrice', value: 799 })], NOW);
    assert.equal(r.promo.id, 'fx');
  });

  test('promocja na inną kolekcję nie działa', () => {
    assert.equal(priceFor(product(), 'DN', [promo({ scope: { collections: ['nokta'] } })], NOW).price, 1000);
  });

  test('zakres: listy łączone przez AND, wartości w liście przez OR', () => {
    const both = promo({ scope: { collections: ['olmo', 'nokta'], types: ['komoda'] } });
    const wrongType = promo({ scope: { collections: ['olmo'], types: ['rtv'] } });
    assert.equal(priceFor(product(), 'DN', [both], NOW).price, 850);
    assert.equal(priceFor(product(), 'DN', [wrongType], NOW).price, 1000);
  });

  test('pusty zakres = cały asortyment', () => {
    assert.equal(priceFor(product(), 'DN', [promo({ scope: {} })], NOW).price, 850);
  });

  test('skus pasuje do indeksu produktu albo konkretnego wariantu', () => {
    const forProduct = promo({ scope: { skus: ['LV-OLMO-KOM120'] } });
    const forVariant = promo({ scope: { skus: ['lv-olmo-kom120-ka-dn'] } }); // wielkość liter bez znaczenia
    assert.equal(priceFor(product(), 'DN', [forProduct], NOW).price, 850);
    assert.equal(priceFor(product(), 'KA-DN', [forVariant], NOW).price, 850);
    assert.equal(priceFor(product(), 'DN', [forVariant], NOW).price, 1000);
  });

  test('zaokrąglenie do pełnych złotych w dół', () => {
    assert.equal(priceFor(product({ basePrice: 1299 }), 'DN', [promo()], NOW).price, 1104); // 1104,15
    assert.equal(priceFor(product({ basePrice: 999 }), 'DN', [promo({ value: 10 })], NOW).price, 899); // 899,10
    assert.equal(priceFor(product({ basePrice: 849 }), 'DN', [promo()], NOW).price, 721); // 721,65
    assert.equal(discountedPrice({ kind: 'percent', value: 10 }, 1000), 900); // bez błędu 899 z float
    assert.equal(discountedPrice({ kind: 'fixedPrice', value: 499.99 }, 1000), 499);
  });

  test('cena nigdy poniżej 1 zł', () => {
    assert.equal(priceFor(product(), 'DN', [promo({ value: 100 })], NOW).price, 1);
    assert.equal(priceFor(product(), 'DN', [promo({ value: 99.99 })], NOW).price, 1);
    assert.equal(priceFor(product(), 'DN', [promo({ kind: 'fixedPrice', value: 0 })], NOW).price, 1);
  });
});

describe('Omnibus — lowest30', () => {
  test('najniższa cena z 30 dni przed startem obniżki', () => {
    const p = product({
      priceHistory: [
        { date: '2026-08-21', price: 1000 },
        { date: '2026-09-23', price: 900 }, // 20 dni przed startem
        { date: '2026-09-30', price: 1000 },
        { date: '2026-10-13', price: 850 }, // dzień startu promocji — nie liczy się
      ],
    });
    assert.equal(priceFor(p, 'DN', [promo()], NOW).lowest30, 900);
  });

  test('cena sprzed okna liczy się tylko jako cena obowiązująca na jego początku', () => {
    const p = product({
      priceHistory: [
        { date: '2026-08-01', price: 700 }, // dawno, potem podwyżka przed oknem
        { date: '2026-09-01', price: 1000 },
      ],
    });
    assert.equal(priceFor(p, 'DN', [promo()], NOW).lowest30, 1000);
  });

  test('podwyżka w oknie: liczy się niższa cena sprzed podwyżki', () => {
    const p = product({ priceHistory: [{ date: '2026-08-21', price: 950 }, { date: '2026-10-01', price: 1000 }] });
    assert.equal(priceFor(p, 'DN', [promo()], NOW).lowest30, 950);
  });

  test('wcześniejsza promocja w oknie obniża lowest30 poniżej obecnej ceny promocyjnej', () => {
    const p = product({
      priceHistory: [{ date: '2026-08-21', price: 1000 }, { date: '2026-09-15', price: 800 }, { date: '2026-09-29', price: 1000 }],
    });
    const r = priceFor(p, 'DN', [promo()], NOW);
    assert.equal(r.price, 850);
    assert.equal(r.lowest30, 800);
  });

  test('brak historii → cena regularna', () => {
    assert.equal(priceFor(product({ priceHistory: [] }), 'DN', [promo()], NOW).lowest30, 1000);
    assert.equal(lowestPriceBefore([], '2026-10-13T00:00:00+02:00', { fallback: 5 }), 5);
  });

  test('produkt w sprzedaży krócej niż 30 dni → najniższa cena od początku sprzedaży', () => {
    const p = product({ priceHistory: [{ date: '2026-10-05', price: 1050 }, { date: '2026-10-08', price: 1000 }] });
    assert.equal(priceFor(p, 'DN', [promo()], NOW).lowest30, 1000);
  });

  test('historia wariantu ma pierwszeństwo przed historią produktu', () => {
    const p = product({ variants: [{ code: 'DN', sku: 'x', priceHistory: [{ date: '2026-09-20', price: 880 }] }] });
    assert.equal(priceFor(p, 'DN', [promo()], NOW).lowest30, 880);
  });
});

describe('czas Europe/Warsaw', () => {
  test('warsawISO uwzględnia zmianę czasu (25.10.2026)', () => {
    assert.equal(warsawISO('2026-10-24'), '2026-10-24T00:00:00+02:00');
    assert.equal(warsawISO('2026-10-25'), '2026-10-25T00:00:00+02:00');
    assert.equal(warsawISO('2026-10-26'), '2026-10-26T00:00:00+01:00');
    assert.equal(warsawISO('2026-03-29', 12), '2026-03-29T12:00:00+02:00');
    assert.equal(warsawISO('2026-01-15', 9, 30), '2026-01-15T09:30:00+01:00');
  });

  test('warsawDay: data kalendarzowa w Polsce', () => {
    assert.equal(warsawDay('2026-10-12T22:30:00Z'), '2026-10-13'); // 00:30 CEST
    assert.equal(warsawDay('2026-12-31T23:30:00Z'), '2027-01-01'); // 00:30 CET
    assert.equal(warsawDay('2026-12-31T22:30:00Z'), '2026-12-31');
  });
});

describe('formatPrice', () => {
  test('spacje niełamliwe w tysiącach i przed „zł”', () => {
    assert.equal(formatPrice(1299), '1 299 zł');
    assert.equal(formatPrice(149), '149 zł');
    assert.equal(formatPrice(12999), '12 999 zł');
    assert.equal(formatPrice(1234567), '1 234 567 zł');
  });

  test('grosze tylko gdy są', () => {
    assert.equal(formatPrice(1299.5), '1 299,50 zł');
    assert.equal(formatPrice(1299.0), '1 299 zł');
    assert.equal(formatPrice(0.99), '0,99 zł');
  });

  test('nie-liczba → pusty tekst', () => {
    assert.equal(formatPrice(NaN), '');
    assert.equal(formatPrice('abc'), '');
  });
});
