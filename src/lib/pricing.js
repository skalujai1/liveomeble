// Ceny, promocje i informacja Omnibus dla mebli Liveo.
//
// Czysty moduł ESM bez zależności — działa w Node (generator danych, eksport,
// testy, przyszłe API) i w przeglądarce (karta produktu, listing, doradca).
//
// SKĄD DANE (docelowo):
//   - product.basePrice      → cena katalogowa brutto z ERP Navireo (cennik detaliczny),
//   - product.priceHistory   → historia faktycznych cen sprzedaży z ERP/naszej bazy
//                              (zapis każdej zmiany ceny — wymagany do dyrektywy Omnibus),
//   - promotions[]           → promocje zdefiniowane w Navireo (rabat procentowy albo cena
//                              promocyjna, zakres: kolekcje / typy mebli / indeksy, daty).
//   Synchronizacja z Navireo zapisze te same pola, więc ten moduł się nie zmieni:
//   promocja ustawiona w ERP automatycznie przecenia meble na stronie, bo strona
//   zawsze liczy cenę funkcją priceFor() z aktualnej listy promocji.
//   Jeśli Navireo poda osobne ceny dla wariantów kolorystycznych, wystarczy dodać
//   variant.basePrice / variant.priceHistory — mają pierwszeństwo przed polami produktu.
//
// ZASADY:
//   - promocja jest aktywna, gdy startsAt <= now < endsAt (brak daty = bez ograniczenia),
//   - promocje się nie łączą: wygrywa pojedyncza promocja dająca najniższą cenę,
//   - cenę promocyjną zaokrąglamy do pełnych złotych W DÓŁ i nigdy poniżej 1 zł,
//   - „promocja”, która nie obniża ceny (np. fixedPrice >= ceny regularnej), jest pomijana,
//   - zakres (scope): podane listy łączymy przez AND, wartości w liście przez OR;
//     pusty zakres = cały asortyment. scope.skus pasuje do indeksu produktu albo wariantu,
//   - lowest30 (Omnibus, art. 6a ustawy o informowaniu o cenach towarów i usług):
//     najniższa cena z 30 dni PRZED rozpoczęciem obniżki; brak historii → cena regularna.

export const CURRENCY = 'PLN';
const DAY = 86400000;

// ---------------------------------------------------------------------------
// Czas Europe/Warsaw (bez Intl — reguła UE: czas letni od ostatniej niedzieli
// marca 01:00 UTC do ostatniej niedzieli października 01:00 UTC).
// ---------------------------------------------------------------------------
const lastSundayUTC = (year, month) => {
  const d = new Date(Date.UTC(year, month + 1, 0)); // ostatni dzień miesiąca
  return Date.UTC(year, month, d.getUTCDate() - d.getUTCDay(), 1);
};

/** Przesunięcie czasu polskiego względem UTC w minutach (60 albo 120) dla danej chwili. */
export function warsawOffsetMinutes(date) {
  const t = +toDate(date);
  const y = new Date(t).getUTCFullYear();
  return t >= lastSundayUTC(y, 2) && t < lastSundayUTC(y, 9) ? 120 : 60;
}

/** Data kalendarzowa w Polsce ("YYYY-MM-DD") dla danej chwili. */
export function warsawDay(date) {
  const t = +toDate(date);
  return new Date(t + warsawOffsetMinutes(t) * 60000).toISOString().slice(0, 10);
}

/** "2026-10-31", 0, 0 → "2026-10-31T00:00:00+01:00" (czas lokalny Polski z właściwym offsetem). */
export function warsawISO(day, hour = 0, minute = 0) {
  const [y, m, d] = day.split('-').map(Number);
  const local = Date.UTC(y, m - 1, d, hour, minute);
  // offset zależy od chwili UTC: wybieramy ten, który jest spójny sam ze sobą
  const off = [120, 60].find(o => warsawOffsetMinutes(local - o * 60000) === o) ?? 60;
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00+${pad(off / 60)}:00`;
}

function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  return new Date(v);
}

const time = (v, fallback) => (v == null || v === '' ? fallback : +toDate(v));

// ---------------------------------------------------------------------------
// Promocje
// ---------------------------------------------------------------------------

/** Czy promocja trwa w chwili `now` (startsAt <= now < endsAt). */
export function isActive(promo, now = new Date()) {
  if (!promo || promo.enabled === false) return false;
  const t = +toDate(now);
  return time(promo.startsAt, -Infinity) <= t && t < time(promo.endsAt, Infinity);
}

/** Promocje aktywne w chwili `now`, od najwcześniej kończącej się. */
export function activePromotions(promotions = [], now = new Date()) {
  return promotions
    .filter(p => isActive(p, now))
    .sort((a, b) => time(a.endsAt, Infinity) - time(b.endsAt, Infinity) || String(a.id).localeCompare(String(b.id)));
}

const norm = v => String(v).trim().toLowerCase();
const listHas = (list, ...values) => list.map(norm).some(x => values.some(v => v != null && norm(v) === x));

/** Czy promocja obejmuje produkt (i wariant). */
export function promotionApplies(promo, product, variant = null) {
  const s = promo.scope || {};
  if (s.collections?.length && !listHas(s.collections, product.collection)) return false;
  if (s.types?.length && !listHas(s.types, product.type)) return false;
  if (s.skus?.length && !listHas(s.skus, product.sku, variant?.sku)) return false;
  return true;
}

/** Cena po promocji (pełne złote w dół, min. 1 zł). */
export function discountedPrice(promo, regular) {
  let price;
  if (promo.kind === 'fixedPrice') price = Number(promo.value);
  else if (promo.kind === 'percent') price = (regular * (100 - Number(promo.value))) / 100;
  else return regular;
  if (!Number.isFinite(price)) return regular;
  return Math.max(1, Math.floor(price + 1e-9));
}

/**
 * Najlepsza (najtańsza) pojedyncza promocja dla produktu albo null.
 * Remis: dłużej trwająca promocja, potem id.
 */
export function bestPromotion(product, variant, promotions = [], now = new Date(), regular = regularPrice(product, variant)) {
  let best = null;
  for (const promo of promotions) {
    if (!isActive(promo, now) || !promotionApplies(promo, product, variant)) continue;
    const price = discountedPrice(promo, regular);
    if (!(price < regular)) continue;
    if (!best || price < best.price
        || (price === best.price && (time(promo.endsAt, Infinity) > time(best.promo.endsAt, Infinity)
            || (time(promo.endsAt, Infinity) === time(best.promo.endsAt, Infinity) && String(promo.id) < String(best.promo.id))))) {
      best = { promo, price };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Omnibus
// ---------------------------------------------------------------------------

/**
 * Najniższa cena z `days` dni przed chwilą `startsAt`.
 * history: [{ date: "YYYY-MM-DD", price }] — cena obowiązująca od danego dnia (czas polski).
 * Bierzemy cenę obowiązującą na początku okna oraz wszystkie zmiany w oknie,
 * z pominięciem dnia rozpoczęcia obniżki i dni późniejszych.
 */
export function lowestPriceBefore(history, startsAt, { days = 30, fallback = null } = {}) {
  if (!history?.length || startsAt == null) return fallback;
  const start = warsawDay(startsAt);
  const from = warsawDay(time(startsAt) - days * DAY);
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let atWindowStart = null;
  let lowest = null;
  for (const e of sorted) {
    if (e.date <= from) { atWindowStart = e.price; continue; }
    if (e.date >= start) break;
    lowest = lowest == null ? e.price : Math.min(lowest, e.price);
  }
  if (atWindowStart != null) lowest = lowest == null ? atWindowStart : Math.min(lowest, atWindowStart);
  return lowest ?? fallback;
}

// ---------------------------------------------------------------------------
// Cena produktu
// ---------------------------------------------------------------------------

/** Wariant po kodzie; bez kodu — pierwszy wariant; nieznany kod — null. */
export function findVariant(product, variantCode) {
  const list = product?.variants || [];
  if (variantCode == null) return list[0] || null;
  return list.find(v => v.code === variantCode) || null;
}

/** Cena regularna (bez promocji) produktu/wariantu. */
export function regularPrice(product, variant = null) {
  return Number(variant?.basePrice ?? product.basePrice);
}

/**
 * Aktualna cena produktu.
 * @returns {{ price:number, regular:number|null, promo:{id,label,endsAt}|null, lowest30:number|null, currency:'PLN' }}
 *   regular — cena przed obniżką (null, gdy nie ma promocji),
 *   lowest30 — najniższa cena z 30 dni przed obniżką (null, gdy nie ma promocji).
 */
export function priceFor(product, variantCode, promotions = [], now = new Date()) {
  const variant = findVariant(product, variantCode);
  const regular = regularPrice(product, variant);
  const best = bestPromotion(product, variant, promotions || [], now, regular);
  if (!best) return { price: regular, regular: null, promo: null, lowest30: null, currency: CURRENCY };
  const history = variant?.priceHistory ?? product.priceHistory ?? [];
  return {
    price: best.price,
    regular,
    promo: { id: best.promo.id, label: best.promo.label ?? best.promo.name ?? null, endsAt: best.promo.endsAt ?? null },
    lowest30: lowestPriceBefore(history, best.promo.startsAt, { fallback: regular }),
    currency: CURRENCY,
  };
}

// ---------------------------------------------------------------------------
// Formatowanie
// ---------------------------------------------------------------------------
const NBSP = ' ';

/** 1299 → "1 299 zł", 1299.5 → "1 299,50 zł" (spacje niełamliwe). */
export function formatPrice(n) {
  const v = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(v)) return '';
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${neg ? '−' : ''}${grouped}${dec === '00' ? '' : ',' + dec}${NBSP}zł`;
}
