// Dane i treści strony w jednym miejscu (czytane przy budowie).
// Dane: src/data/*.json (docelowo Navireo + Excel). Teksty: src/content/pages/*.json.

import collectionsJson from '../data/collections.json';
import finishesJson from '../data/finishes.json';
import metaJson from '../data/meta.json';
import postcodesJson from '../data/postcodes.json';
import productsJson from '../data/products.json';
import promotionsJson from '../data/promotions.json';
import resellersJson from '../data/resellers.json';
import roomsJson from '../data/rooms.json';
import typesJson from '../data/types.json';

import siteJson from '../content/pages/site.json';
import homeJson from '../content/pages/home.json';
import kolekcjeJson from '../content/pages/kolekcje.json';
import mebleJson from '../content/pages/meble.json';
import kategorieJson from '../content/pages/kategorie.json';
import pomieszczeniaJson from '../content/pages/pomieszczenia.json';
import produktJson from '../content/pages/produkt.json';
import promocjeJson from '../content/pages/promocje.json';
import gdzieKupicJson from '../content/pages/gdzie-kupic.json';
import dlaPartnerowJson from '../content/pages/dla-partnerow.json';
import strefaPartneraJson from '../content/pages/strefa-partnera.json';
import doradcaJson from '../content/pages/doradca-wnetrz.json';
import oNasJson from '../content/pages/o-nas.json';
import kontaktJson from '../content/pages/kontakt.json';
import poradnikJson from '../content/pages/poradnik.json';

import { activePromotions, findVariant, formatPrice, priceFor } from './pricing.js';
import { fill, listJoin, lowerFirst, plural } from './text';

// ---------------------------------------------------------------------------
// Typy (luźne — dane przychodzą z JSON-ów)
// ---------------------------------------------------------------------------
export type Product = (typeof productsJson)[number];
export type Variant = Product['variants'][number];
export type Collection = (typeof collectionsJson)[number];
export type FurnitureType = (typeof typesJson)[number];
export type Room = (typeof roomsJson)[number];
export type Finish = (typeof finishesJson)[number];
export type Promotion = (typeof promotionsJson)[number];
export type Reseller = (typeof resellersJson)[number];
export type FaqItem = { q: string; a: string };

/** Chwila budowy — ceny w HTML i JSON-LD liczone na ten moment. LIVEO_NOW nadpisuje (testy, podgląd). */
export const BUILD_NOW = process.env.LIVEO_NOW ? new Date(process.env.LIVEO_NOW) : new Date();
if (Number.isNaN(+BUILD_NOW)) throw new Error(`LIVEO_NOW: nieprawidłowa data "${process.env.LIVEO_NOW}"`);

// ---------------------------------------------------------------------------
// Treści
// ---------------------------------------------------------------------------
export const site = siteJson;
export const pages = {
  home: homeJson,
  kolekcje: kolekcjeJson,
  meble: mebleJson,
  kategorie: kategorieJson,
  pomieszczenia: pomieszczeniaJson,
  produkt: produktJson,
  promocje: promocjeJson,
  gdzieKupic: gdzieKupicJson,
  dlaPartnerow: dlaPartnerowJson,
  strefaPartnera: strefaPartneraJson,
  doradca: doradcaJson,
  oNas: oNasJson,
  kontakt: kontaktJson,
  poradnik: poradnikJson,
};

/** Sekcja strony po `id` (sekcje są w kolejności wyświetlania). */
export function section<T = any>(page: { sections?: any[] }, id: string): T {
  const s = page.sections?.find(x => x.id === id);
  if (!s) throw new Error(`Brak sekcji "${id}" w treści strony`);
  return s as T;
}

/** Odwołanie „site.forms.consent” → wartość z site.json; zwykły tekst bez zmian. */
export function resolveRef(value: string | undefined): string | undefined {
  if (!value || !/^site\.[\w.]+$/.test(value)) return value;
  return value.split('.').slice(1).reduce((o: any, k) => o?.[k], site) as string | undefined;
}

// ---------------------------------------------------------------------------
// Dane
// ---------------------------------------------------------------------------
export const meta = metaJson;
export const finishes = finishesJson;
export const boardFinishes = finishes.filter(f => f.group === 'board');
export const collections = [...collectionsJson].sort((a, b) => a.order - b.order);
export const types = [...typesJson].sort((a, b) => a.order - b.order);
export const rooms = [...roomsJson].sort((a, b) => a.order - b.order);
export const products = productsJson;
export const promotions = promotionsJson;
export const resellers = resellersJson;
export const postcodes = postcodesJson;

const byKey = <T, K extends keyof T>(list: T[], key: K) => new Map(list.map(x => [x[key] as unknown as string, x]));
export const finishById = byKey(finishes, 'id');
export const collectionBySlug = byKey(collections, 'slug');
export const typeById = byKey(types, 'id');
export const typeBySlug = byKey(types, 'slug');
export const roomBySlug = byKey(rooms, 'slug');
export const productBySlug = byKey(products, 'slug');

export const collectionOf = (p: Product) => collectionBySlug.get(p.collection)!;
export const typeOf = (p: Product) => typeById.get(p.type)!;

/** Kolejność „polecane”: kolejność kolekcji, potem rodzaju mebla, potem szerokość. */
const productOrder = (p: Product) => [collectionOf(p).order, typeOf(p).order, p.dims.w] as const;
export const productsSorted = [...products].sort((a, b) => {
  const x = productOrder(a), y = productOrder(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.name.localeCompare(b.name, 'pl');
});
export const productsByCollection = (slug: string) => productsSorted.filter(p => p.collection === slug);
export const productsByType = (id: string) => productsSorted.filter(p => p.type === id);
export const productsByRoom = (slug: string) => productsSorted.filter(p => p.rooms.includes(slug));

// ---------------------------------------------------------------------------
// Adresy
// ---------------------------------------------------------------------------
export const url = {
  home: '/',
  collections: '/kolekcje/',
  collection: (slug: string) => `/kolekcje/${slug}/`,
  products: '/meble/',
  category: (typeSlug: string) => `/meble/${typeSlug}/`,
  rooms: '/pomieszczenia/',
  room: (slug: string) => `/pomieszczenia/${slug}/`,
  product: (slug: string, code?: string) => `/produkt/${slug}/${code ? `?kolor=${encodeURIComponent(code)}` : ''}`,
  promotions: '/promocje/',
  stores: (collection?: string) => `/gdzie-kupic/${collection ? `?kolekcja=${collection}` : ''}`,
  advisor: '/doradca-wnetrz/',
  guides: '/poradnik/',
  guide: (slug: string) => `/poradnik/${slug}/`,
  partners: '/dla-partnerow/',
  partnerZone: '/strefa-partnera/',
  about: '/o-nas/',
  contact: '/kontakt/',
};

// ---------------------------------------------------------------------------
// Produkty: warianty, ceny, opisy
// ---------------------------------------------------------------------------

/** Domyślny wariant: pierwszy dostępny (nie „wyprzedany”). */
export function defaultVariant(p: Product): Variant {
  return p.variants.find(v => v.stock !== 'wyprzedany') ?? p.variants[0];
}

export function priceAt(p: Product, code?: string, now: Date = BUILD_NOW) {
  return priceFor(p, code ?? defaultVariant(p).code, promotions, now);
}

/** Aktywne promocje w chwili budowy, od najwcześniej kończącej się. */
export const activePromosAtBuild = activePromotions(promotions, BUILD_NOW);

/** Promocje aktywne albo przyszłe w chwili budowy (przeglądarka włącza je sama o czasie). */
export const upcomingOrActivePromos = promotions.filter(p => !p.endsAt || +new Date(p.endsAt) > +BUILD_NOW);

export const dims = (p: Product) => fill(site.dims.format, p.dims);
export const dimsLong = (p: Product) => fill(site.dims.formatLong, p.dims);

export const colorCount = (p: Product) => plural(site.plural.colors, p.variants.length);
export const productCount = (n: number) => plural(site.plural.products, n);

export function stockText(v: Pick<Variant, 'stock'> & { leadTimeDays?: number | null }): string {
  if (v.stock === 'na-zamowienie') {
    return v.leadTimeDays ? fill(site.stock['na-zamowienie'], { days: v.leadTimeDays }) : site.stock['na-zamowienie-short'];
  }
  return (site.stock as Record<string, string>)[v.stock] ?? site.stock.unknown;
}

/** Kolory płyt wariantu (front, korpus, blat) — do filtra „Kolor”. */
export function variantBoardColors(v: Variant): string[] {
  const f = v.finish as Record<string, string | undefined>;
  return [...new Set([f.front, f.body, f.top].filter((x): x is string => !!x && finishById.get(x)?.group === 'board'))];
}

// ---------------------------------------------------------------------------
// Teksty złożone z danych
// ---------------------------------------------------------------------------
export const roomsList = (slugs: string[]) =>
  rooms.filter(r => slugs.includes(r.slug)).map(r => lowerFirst(r.name)).join(', ');
export const finishLabels = (c: Collection) => c.finishes.map(f => f.label).join(', ');
export const finishLabelsSentence = (c: Collection) => listJoin(c.finishes.map(f => lowerFirst(f.label)));
export const typePluralList = (typeIds: string[]) =>
  listJoin(types.filter(t => typeIds.includes(t.id)).map(t => lowerFirst(t.plural)));
export const collectionNames = (slugs: string[]) =>
  listJoin(collections.filter(c => slugs.includes(c.slug)).map(c => c.name));

export const styleOf = (c: Collection) => (site.styles as Record<string, { label: string; in: string }>)[c.style];
export const handleLabel = (c: Collection) => (site.handles as Record<string, string>)[c.handle] ?? c.handle;
export const baseLabel = (c: Collection) => (site.bases as Record<string, string>)[c.base] ?? c.base;

/** Zakres cen rodzaju mebla (z promocjami, w chwili budowy). */
export function priceRangeOf(list: Product[]) {
  const prices = list.map(p => priceAt(p).price);
  return { min: Math.min(...prices), max: Math.max(...prices), minText: formatPrice(Math.min(...prices)), maxText: formatPrice(Math.max(...prices)) };
}

export const year = BUILD_NOW.getUTCFullYear();
export { formatPrice, findVariant };
