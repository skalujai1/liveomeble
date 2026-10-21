// Odświeżanie cen, promocji i dostępności w przeglądarce — bez frameworka, bez czytania układu.
//
// 1) PRICES_API ustawione → GET {PRICES_API}?skus=... (paczki po 100, limit czasu) i podmiana tekstów.
// 2) Bez API albo gdy API nie odpowie → priceFor() z osadzonego JSON-a na BIEŻĄCĄ chwilę:
//    promocja zaczyna się i kończy o czasie bez przebudowy strony.
// Po każdej zmianie: zdarzenie `liveo:prices` (lista mebli przelicza filtry cen/promocji).

import { PRICES_API, PRICES_TIMEOUT_MS, STOCK_STALE_HOURS } from '../config';
import { formatPrice, isActive, priceFor, warsawDay } from '../lib/pricing.js';

type Variant = { code: string; sku: string; stock: string; leadTimeDays: number | null };
type ProductRec = { sku: string; collection: string; type: string; basePrice: number; priceHistory: unknown[]; variants: Variant[] };
type Promo = { id: string; label: string; kind: string; value: number; scope: unknown; startsAt: string; endsAt: string };
type Data = {
  builtAt: string;
  promotions: Promo[];
  products: Record<string, ProductRec>;
  t: { label: string; promo: string; lowest30: string; promoUntil: string; stock: Record<string, string> };
};
type PriceInfo = { price: number; regular: number | null; lowest30: number | null; promoLabel: string | null; promoEndsAt: string | null };
type ApiItem = PriceInfo & { stock?: string; leadTimeDays?: number | null };

const state: { data: Data | null; api: Record<string, ApiItem> | null; apiAt: Date | null; stale: boolean } = {
  data: null, api: null, apiAt: null, stale: false,
};

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const DATE_LONG = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' });
const lastDayText = (endsAt: string) => DATE_LONG.format(new Date(`${warsawDay(+new Date(endsAt) - 60_000)}T12:00:00Z`));

function readData(): Data | null {
  const nodes = document.querySelectorAll<HTMLScriptElement>('script[data-liveo-prices]');
  if (!nodes.length) return null;
  let merged: Data | null = null;
  for (const n of nodes) {
    try {
      const d = JSON.parse(n.textContent || '{}') as Data;
      if (!merged) merged = { ...d, products: { ...d.products }, promotions: [...d.promotions] };
      else {
        Object.assign(merged.products, d.products);
        for (const p of d.promotions) if (!merged.promotions.some(x => x.id === p.id)) merged.promotions.push(p);
      }
    } catch { /* uszkodzony blok — zostają ceny z HTML */ }
  }
  return merged;
}

function compute(rec: ProductRec, code: string, now: Date): PriceInfo {
  const v = rec.variants.find(x => x.code === code) ?? rec.variants[0];
  const fromApi = state.api?.[v?.sku ?? ''];
  if (fromApi) return fromApi;
  const r = priceFor(rec, code, state.data!.promotions, now);
  return { price: r.price, regular: r.regular, lowest30: r.lowest30, promoLabel: r.promo?.label ?? null, promoEndsAt: r.promo?.endsAt ?? null };
}

function setText(el: Element | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
}
function setHidden(el: Element | null, hidden: boolean) {
  if (el instanceof HTMLElement && el.hidden !== hidden) el.hidden = hidden;
}

/** Przelicza jeden blok ceny (np. po zmianie koloru na karcie mebla). */
export function renderPrice(el: HTMLElement, now = new Date()) {
  const data = state.data;
  const rec = data?.products[el.dataset.product ?? ''];
  if (!data || !rec) return;
  const info = compute(rec, el.dataset.variant ?? rec.variants[0].code, now);
  const promo = info.regular != null && info.regular > info.price;
  const q = (s: string) => el.querySelector(`[data-price-${s}]`);
  setText(q('current'), formatPrice(info.price));
  setText(q('regular'), promo ? formatPrice(info.regular!) : '');
  setHidden(q('regular-wrap'), !promo);
  setText(q('promo'), promo ? info.promoLabel ?? '' : '');
  setHidden(q('promo'), !promo || !info.promoLabel);
  setText(q('lowest'), promo ? fill(data.t.lowest30, { price: formatPrice(info.lowest30 ?? info.regular!) }) : '');
  setHidden(q('lowest'), !promo);
  const until = q('until');
  if (until) {
    setText(until, promo && info.promoEndsAt ? fill(data.t.promoUntil, { lastDay: lastDayText(info.promoEndsAt) }) : '');
    setHidden(until, !(promo && info.promoEndsAt));
  }
  const sr = q('sr') as HTMLElement | null;
  if (sr) setText(sr, `${promo ? sr.dataset.labelPromo : sr.dataset.label}: `);
  el.classList.toggle('price--promo', promo);
  // Dane do filtrów listy mebli
  const item = el.closest<HTMLElement>('[data-listing-item]');
  if (item) {
    item.dataset.price = String(info.price);
    item.dataset.promo = promo ? '1' : '0';
    const badge = item.querySelector<HTMLElement>('[data-promo-badge]');
    if (badge) { setText(badge, promo ? info.promoLabel ?? '' : ''); setHidden(badge, !promo); }
  }
}

/** Tekst dostępności wariantu: z API, z HTML/JSON albo „sprawdź w sklepie”, gdy dane są nieświeże. */
export function renderStock(el: HTMLElement, now = new Date()) {
  const data = state.data;
  const rec = data?.products[el.dataset.product ?? ''];
  if (!data || !rec) return;
  const v = rec.variants.find(x => x.code === el.dataset.variant) ?? rec.variants[0];
  const api = state.api?.[v.sku];
  const stock = api?.stock ?? v.stock;
  const lead = api?.leadTimeDays ?? v.leadTimeDays;
  const builtAgeH = (+now - +new Date(data.builtAt)) / 3_600_000;
  const stale = state.api ? state.stale : builtAgeH > STOCK_STALE_HOURS;
  const t = data.t.stock;
  const text = stale
    ? t.unknown
    : stock === 'na-zamowienie'
      ? lead ? fill(t['na-zamowienie'], { days: lead }) : t['na-zamowienie-short']
      : t[stock] ?? t.unknown;
  setText(el.querySelector('[data-stock-text]') ?? el, text);
  el.dataset.stock = stale ? 'unknown' : stock;
}

/** Bloki zależne od okna promocji (strona Promocje, sekcja na głównej): pokaż tylko trwające. */
function renderPromoWindows(now: Date) {
  const groups = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-promo-window]').forEach(el => {
    const active = isActive({ startsAt: el.dataset.start || null, endsAt: el.dataset.end || null }, now);
    setHidden(el, !active);
    const g = el.closest<HTMLElement>('[data-promo-group]');
    if (g) groups.add(g);
  });
  groups.forEach(g => {
    const any = [...g.querySelectorAll<HTMLElement>('[data-promo-window]')].some(x => !x.hidden);
    g.querySelectorAll<HTMLElement>('[data-promo-empty]').forEach(e => setHidden(e, any));
    if (g.hasAttribute('data-promo-hide-empty')) setHidden(g, !any);
  });
}

async function fetchApi(skus: string[]) {
  if (!PRICES_API || !skus.length) return;
  const items: Record<string, ApiItem> = {};
  let stale = false;
  for (let i = 0; i < skus.length; i += 100) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PRICES_TIMEOUT_MS);
    try {
      const res = await fetch(`${PRICES_API}?skus=${encodeURIComponent(skus.slice(i, i + 100).join(','))}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      stale ||= !!json.stale;
      for (const [sku, it] of Object.entries<any>(json.items || {})) {
        items[sku] = { price: it.price, regular: it.regular ?? null, lowest30: it.lowest30 ?? null, promoLabel: it.promoLabel ?? null, promoEndsAt: it.promoEndsAt ?? null, stock: it.stock, leadTimeDays: it.leadTimeDays ?? null };
      }
    } catch {
      return; // brak odpowiedzi → zostają ceny z HTML / z przeliczenia lokalnego
    } finally {
      clearTimeout(timer);
    }
  }
  state.api = items;
  state.apiAt = new Date();
  state.stale = stale;
}

export function refreshAll(now = new Date()) {
  document.querySelectorAll<HTMLElement>('[data-price]').forEach(el => renderPrice(el, now));
  document.querySelectorAll<HTMLElement>('[data-stock][data-product]').forEach(el => renderStock(el, now));
  renderPromoWindows(now);
  document.querySelectorAll<HTMLElement>('[data-prices-updated]').forEach(el => {
    const tpl = el.dataset.template;
    if (tpl) setText(el, fill(tpl, { date: DATE_LONG.format(state.apiAt ?? now) }));
  });
  document.dispatchEvent(new CustomEvent('liveo:prices'));
}

let started = false;
export function initPrices() {
  if (started) return;
  started = true;
  state.data = readData();
  if (!state.data) return;
  const run = async () => {
    const skus = Object.values(state.data!.products).flatMap(p => p.variants.map(v => v.sku));
    await fetchApi(skus);
    refreshAll();
  };
  const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  if (idle) idle(run, { timeout: 2000 });
  else setTimeout(run, 1);
}

export const pricesReady = () => state.data !== null;
