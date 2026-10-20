#!/usr/bin/env node
// Generator DANYCH DEMO dla nowej strony Liveo Meble.
//
//   node tools/data/generate.mjs [--today=2026-10-20] [--seed=liveo-demo-2026] [--out=src/data]
//
// Wszystkie kolekcje, meble, ceny, promocje i sklepy są FIKCYJNE (demo: true).
// Docelowo produkty, ceny, promocje i stany przyjdą z ERP Navireo (API) i arkusza
// Excel klienta — struktura plików jest do tego przygotowana (patrz src/data/README.md).
// Generator jest deterministyczny: ten sam --seed i --today dają identyczne pliki.
// Bez zależności — tylko Node (ESM).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { priceFor, warsawISO } from '../../src/lib/pricing.js';
import { validateData } from './validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    out[m[1]] = m[2] ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const TODAY = args.today || '2026-10-20';
const SEED = args.seed || 'liveo-demo-2026';
const OUT = resolve(ROOT, args.out || 'src/data');
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) throw new Error(`--today w formacie YYYY-MM-DD, otrzymano "${TODAY}"`);

// ---------------------------------------------------------------------------
// Narzędzia
// ---------------------------------------------------------------------------
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Osobny strumień losowy na klucz — dodanie mebla nie zmienia losowań innych. */
const rng = key => mulberry32(hash32(`${SEED}|${key}`));

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const round = (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n;
const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const slugify = s => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = s => s[0].toUpperCase() + s.slice(1);
/** 2.5 → "2,5" (przecinek dziesiętny w tekstach). */
const num = n => String(n).replace('.', ',');
const joinPl = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} i ${list.at(-1)}`);
/** Cena „psychologiczna”: 1 049, 1 099, 279 … */
const psych = p => (p < 400 ? Math.round(p / 10) * 10 - 1 : Math.round(p / 50) * 50 - 1);

// ---------------------------------------------------------------------------
// Wykończenia (kontrakt wspólny z rendererem)
// ---------------------------------------------------------------------------
/** Jasność L* (CIELAB) z koloru hex, 0–1. */
function lightness(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const f = Y > 0.008856 ? Math.cbrt(Y) : 7.787 * Y + 16 / 116;
  return round((116 * f - 16) / 100, 2);
}

const BOARD_DEFS = [
  ['dab-naturalny', 'Dąb naturalny', '#c49a6c', { wood: true, roughness: 0.6, grain: 'wyraźne' }],
  ['dab-miodowy', 'Dąb miodowy', '#b07b45', { wood: true, roughness: 0.55, grain: 'średnie' }],
  ['orzech', 'Orzech', '#6b4a32', { wood: true, roughness: 0.55, grain: 'średnie' }],
  ['bialy-mat', 'Biały mat', '#eeece8', { roughness: 0.75 }],
  ['bialy-polysk', 'Biały połysk', '#f3f2ef', { gloss: true, roughness: 0.12, clearcoat: 0.8 }],
  ['kaszmir', 'Kaszmir', '#d6c8b8', { roughness: 0.65 }],
  ['szalwia', 'Szałwia', '#9aa58f', { roughness: 0.7 }],
  ['grafit', 'Grafit', '#4a4b4d', { black: true, roughness: 0.55 }],
  ['czarny-mat', 'Czarny mat', '#222223', { black: true, roughness: 0.65 }],
];
const FINISHES = [
  ...BOARD_DEFS.map(([id, label, hex, o]) => ({
    id, label, group: 'board', hex,
    wood: !!o.wood, light: lightness(hex), black: !!o.black, gloss: !!o.gloss,
    roughness: o.roughness, metalness: 0, ...(o.clearcoat ? { clearcoat: o.clearcoat } : {}),
    ...(o.grain ? { grain: o.grain } : {}),
    note: o.wood ? 'płyta laminowana w dekorze drewna' : 'płyta laminowana',
  })),
  { id: 'czarny', label: 'Czarny', group: 'metal', hex: '#1a1a1a', wood: false, light: lightness('#1a1a1a'), black: true, gloss: false, roughness: 0.45, metalness: 0.6, note: 'stal malowana proszkowo' },
  { id: 'zloty', label: 'Złoty', group: 'metal', hex: '#b8935a', wood: false, light: lightness('#b8935a'), black: false, gloss: false, roughness: 0.35, metalness: 1, note: 'szczotkowany mosiądz (kolor)' },
  { id: 'stal', label: 'Stal', group: 'metal', hex: '#9a9ca0', wood: false, light: lightness('#9a9ca0'), black: false, gloss: false, roughness: 0.3, metalness: 1, note: 'stal szczotkowana' },
  { id: 'szklo', label: 'Szkło lekko przydymione', group: 'glass', hex: '#8f9592', wood: false, light: 0.6, black: false, gloss: true, roughness: 0.05, metalness: 0, opacity: 0.35, transmission: 0.85, note: 'szkło hartowane 4 mm (witryny, kredensy)' },
];
const F = Object.fromEntries(FINISHES.map(f => [f.id, f]));
const METAL_LOC = { czarny: 'czarnym', zloty: 'szczotkowanego mosiądzu', stal: 'stali' };

// ---------------------------------------------------------------------------
// Pomieszczenia
// ---------------------------------------------------------------------------
const ROOMS = [
  { slug: 'salon', name: 'Salon', shortName: 'Salon', genitive: 'salonu', accusative: 'salon', locative: 'w salonie',
    assistantKey: 'salon', description: 'Szafki RTV, komody, witryny, regały, ławy i półki do strefy dziennej.' },
  { slug: 'jadalnia', name: 'Jadalnia', shortName: 'Jadalnia', genitive: 'jadalni', accusative: 'jadalnię', locative: 'w jadalni',
    assistantKey: 'jadalnia', description: 'Stoły, kredensy, witryny i komody — miejsce na zastawę i wspólne posiłki.' },
  { slug: 'sypialnia', name: 'Sypialnia', shortName: 'Sypialnia', genitive: 'sypialni', accusative: 'sypialnię', locative: 'w sypialni',
    assistantKey: 'sypialnia', description: 'Łóżka, szafki nocne, szafy, komody, toaletki i lustra.' },
  { slug: 'pokoj-mlodziezowy', name: 'Pokój młodzieżowy', shortName: 'Pokój młodzieżowy', genitive: 'pokoju młodzieżowego',
    accusative: 'pokój młodzieżowy', locative: 'w pokoju młodzieżowym', assistantKey: 'mlodziezowy',
    description: 'Biurka, łóżka 90 i 120 cm, regały, komody i szafy do pokoju nastolatka.' },
  { slug: 'przedpokoj', name: 'Przedpokój', shortName: 'Przedpokój', genitive: 'przedpokoju', accusative: 'przedpokój',
    locative: 'w przedpokoju', assistantKey: 'przedpokoj', description: 'Szafy, szafki na buty, wieszaki, lustra i komody do strefy wejścia.' },
  { slug: 'biuro', name: 'Domowe biuro', shortName: 'Biuro', genitive: 'domowego biura', accusative: 'domowe biuro',
    locative: 'w domowym biurze', assistantKey: 'biuro', description: 'Biurka, regały, komody i półki do pracy w domu.' },
].map((r, i) => ({ ...r, order: i + 1 }));

// ---------------------------------------------------------------------------
// Typy mebli. priceRange: z briefu; dla kredensu, toaletki, szafki na buty
// i wieszaka — założenie (do potwierdzenia).
// ---------------------------------------------------------------------------
const ALL_ROOMS = ROOMS.map(r => r.slug);
const TYPES = [
  ['rtv', 'Szafka RTV', 'Szafki RTV', 'szafek RTV', 'szafki-rtv', ['salon'], [499, 1399], 'cabinet', 'RTV'],
  ['komoda', 'Komoda', 'Komody', 'komód', 'komody', ['salon', 'sypialnia', 'przedpokoj', 'jadalnia', 'pokoj-mlodziezowy', 'biuro'], [699, 1699], 'cabinet', 'KOM'],
  ['witryna', 'Witryna', 'Witryny', 'witryn', 'witryny', ['salon', 'jadalnia'], [899, 1899], 'cabinet', 'WIT'],
  ['regal', 'Regał', 'Regały', 'regałów', 'regaly', ['salon', 'pokoj-mlodziezowy', 'biuro'], [449, 1199], 'cabinet', 'REG'],
  ['lawa', 'Ława', 'Ławy', 'ław', 'lawy', ['salon'], [399, 899], 'coffeeTable', 'LAW'],
  ['polka', 'Półka', 'Półki', 'półek', 'polki', ['salon', 'pokoj-mlodziezowy', 'biuro', 'przedpokoj', 'sypialnia'], [149, 299], 'wallShelf', 'POL'],
  ['stol', 'Stół', 'Stoły', 'stołów', 'stoly', ['jadalnia'], [799, 1899], 'table', 'STO'],
  ['kredens', 'Kredens', 'Kredensy', 'kredensów', 'kredensy', ['jadalnia', 'salon'], [1099, 2199], 'cabinet', 'KRE'],
  ['lozko', 'Łóżko', 'Łóżka', 'łóżek', 'lozka', ['sypialnia', 'pokoj-mlodziezowy'], [1199, 2799], 'bed', 'LOZ'],
  ['szafka_nocna', 'Szafka nocna', 'Szafki nocne', 'szafek nocnych', 'szafki-nocne', ['sypialnia', 'pokoj-mlodziezowy'], [249, 499], 'cabinet', 'SZN'],
  ['szafa', 'Szafa', 'Szafy', 'szaf', 'szafy', ['sypialnia', 'przedpokoj', 'pokoj-mlodziezowy'], [1199, 2999], 'cabinet', 'SZA'],
  ['toaletka', 'Toaletka', 'Toaletki', 'toaletek', 'toaletki', ['sypialnia'], [599, 1199], 'desk', 'TOA'],
  ['lustro', 'Lustro', 'Lustra', 'luster', 'lustra', ['przedpokoj', 'sypialnia'], [199, 599], 'mirror', 'LUS'],
  ['biurko', 'Biurko', 'Biurka', 'biurek', 'biurka', ['biuro', 'pokoj-mlodziezowy'], [449, 1299], 'desk', 'BIU'],
  ['szafka_na_buty', 'Szafka na buty', 'Szafki na buty', 'szafek na buty', 'szafki-na-buty', ['przedpokoj'], [399, 999], 'cabinet', 'SZB'],
  ['wieszak', 'Wieszak', 'Wieszaki', 'wieszaków', 'wieszaki', ['przedpokoj'], [199, 499], 'coatRack', 'WIE'],
].map(([id, name, plural, genitivePlural, slug, rooms, priceRange, kind, skuCode], i) => ({
  id, name, plural, genitivePlural, slug, rooms, priceRange, kind, skuCode, order: i + 1,
  priceRangeSource: ['kredens', 'toaletka', 'szafka_na_buty', 'wieszak'].includes(id) ? 'założenie' : 'brief',
}));
const T = Object.fromEntries(TYPES.map(t => [t.id, t]));
for (const t of TYPES) if (!t.rooms.every(r => ALL_ROOMS.includes(r))) throw new Error(`typ ${t.id}: pomieszczenia`);

// ---------------------------------------------------------------------------
// Kolekcje (fikcyjne). finishes = warianty kolorystyczne całej kolekcji.
// ---------------------------------------------------------------------------
const pal = (code, label, body, front, metal, extra = {}) => ({ code, label, body, front, ...extra, metal });

const COLLECTIONS = [
  {
    slug: 'olmo', name: 'OLMO', style: 'naturalny', rooms: ['salon', 'jadalnia', 'sypialnia'], heroRoom: 'salon',
    handle: 'edge', base: 'legsWood', legH: 12, tier: 0.08,
    tagline: 'Dekor jasnego dębu, spokojne proporcje i drewniane nóżki.',
    description: 'OLMO to komplet do salonu, jadalni i sypialni w dekorze dębu naturalnego. Fronty chwyta się za wyprofilowaną krawędź, więc na meblach nie ma widocznych uchwytów. Szafki stoją na nóżkach 12 cm, dzięki czemu łatwo pod nimi posprzątać.',
    finishes: [
      pal('DN', 'Dąb naturalny', 'dab-naturalny', 'dab-naturalny', 'czarny', { legs: 'dab-naturalny' }),
      pal('KA-DN', 'Kaszmir / dąb naturalny', 'kaszmir', 'kaszmir', 'czarny', { top: 'dab-naturalny', legs: 'dab-naturalny' }),
      pal('BM-DN', 'Biały mat / dąb naturalny', 'bialy-mat', 'bialy-mat', 'czarny', { top: 'dab-naturalny', legs: 'dab-naturalny' }),
    ],
  },
  {
    slug: 'talve', name: 'TALVE', style: 'skandynawski', rooms: ['salon', 'sypialnia', 'pokoj-mlodziezowy'], heroRoom: 'sypialnia',
    handle: 'knob', base: 'legsWood', legH: 15, tier: 0.02,
    tagline: 'Matowe fronty, dębowe blaty i małe okrągłe gałki.',
    description: 'TALVE łączy gładkie, matowe fronty z blatami w dekorze dębu naturalnego. Meble stoją na wysokich drewnianych nóżkach, a małe czarne gałki są jedynym metalowym akcentem. Kolekcja ma meble do salonu, sypialni i pokoju nastolatka.',
    finishes: [
      pal('BM-DN', 'Biały mat / dąb naturalny', 'bialy-mat', 'bialy-mat', 'czarny', { top: 'dab-naturalny', legs: 'dab-naturalny' }),
      pal('SZ-DN', 'Szałwia / dąb naturalny', 'szalwia', 'szalwia', 'czarny', { top: 'dab-naturalny', legs: 'dab-naturalny' }),
      pal('GR-DN', 'Grafit / dąb naturalny', 'grafit', 'grafit', 'czarny', { top: 'dab-naturalny', legs: 'dab-naturalny' }),
    ],
  },
  {
    slug: 'nokta', name: 'NOKTA', style: 'loft', rooms: ['salon', 'jadalnia', 'biuro'], heroRoom: 'jadalnia',
    handle: 'bar', base: 'legsMetal', legH: 10, tier: 0.1,
    tagline: 'Ciepłe drewno na czarnym, metalowym stelażu.',
    description: 'NOKTA zestawia fronty w dekorze dębu miodowego albo orzecha z ciemnym, matowym korpusem. Meble stoją na cienkich metalowych nogach, a długie czarne uchwyty podkreślają poziome linie. Pasuje do salonu, jadalni i domowego biura.',
    finishes: [
      pal('DM-CM', 'Dąb miodowy / czarny mat', 'czarny-mat', 'dab-miodowy', 'czarny'),
      pal('OR-GR', 'Orzech / grafit', 'grafit', 'orzech', 'czarny'),
    ],
  },
  {
    slug: 'solma', name: 'SOLMA', style: 'glamour-lekki', rooms: ['salon', 'sypialnia', 'przedpokoj'], heroRoom: 'sypialnia',
    handle: 'bar', base: 'legsMetal', legH: 12, tier: 0.22,
    tagline: 'Gładkie fronty i akcenty w kolorze szczotkowanego mosiądzu.',
    description: 'SOLMA to kolekcja z lekkim akcentem glamour: gładkie fronty, cienkie nogi i uchwyty w kolorze szczotkowanego mosiądzu. Obejmuje meble do sypialni, salonu i przedpokoju — od łóżka i toaletki po szafę i szafkę na buty. Do wyboru biały połysk, kaszmir albo czarny mat.',
    finishes: [
      pal('BP-ZL', 'Biały połysk / złoty', 'bialy-mat', 'bialy-polysk', 'zloty', { top: 'bialy-polysk' }),
      pal('KA-ZL', 'Kaszmir / złoty', 'kaszmir', 'kaszmir', 'zloty'),
      pal('CM-ZL', 'Czarny mat / złoty', 'czarny-mat', 'czarny-mat', 'zloty'),
    ],
  },
  {
    slug: 'liran', name: 'LIRAN', style: 'nowoczesny', rooms: ['salon', 'jadalnia', 'biuro'], heroRoom: 'salon',
    handle: 'push', base: 'plinth', legH: 4, tier: 0.14,
    tagline: 'Fronty bez uchwytów, cofnięty cokół i blaty w dekorze dębu.',
    description: 'LIRAN ma fronty bez uchwytów — szuflady i drzwi otwiera się lekkim naciśnięciem (push-to-open). Korpusy stoją na cofniętym cokole albo wiszą na ścianie, więc bryły wyglądają lekko. Matowa czerń lub biel z blatem w dekorze dębu, a także jednolity grafit.',
    finishes: [
      pal('CM-DN', 'Czarny mat / dąb naturalny', 'czarny-mat', 'czarny-mat', 'stal', { top: 'dab-naturalny' }),
      pal('BM-DN', 'Biały mat / dąb naturalny', 'bialy-mat', 'bialy-mat', 'stal', { top: 'dab-naturalny' }),
      pal('GR', 'Grafit', 'grafit', 'grafit', 'stal'),
    ],
  },
  {
    slug: 'melva', name: 'MELVA', style: 'klasyczny-nowoczesny', rooms: ['salon', 'jadalnia', 'sypialnia'], heroRoom: 'jadalnia',
    handle: 'knob', base: 'legsWood', legH: 10, tier: 0.18,
    tagline: 'Stonowane kolory, blaty w dekorze dębu miodowego i złote gałki.',
    description: 'MELVA to klasyka w nowoczesnym wydaniu: fronty w kolorze kaszmiru lub szałwii, blaty w dekorze dębu miodowego i małe gałki w kolorze mosiądzu. Kolekcja ma meble do jadalni, salonu i sypialni, w tym kredens z przeszkleniem i rozkładany stół.',
    finishes: [
      pal('KA-DM', 'Kaszmir / dąb miodowy', 'kaszmir', 'kaszmir', 'zloty', { top: 'dab-miodowy', legs: 'dab-miodowy' }),
      pal('SZ-DM', 'Szałwia / dąb miodowy', 'szalwia', 'szalwia', 'zloty', { top: 'dab-miodowy', legs: 'dab-miodowy' }),
      pal('OR', 'Orzech', 'orzech', 'orzech', 'zloty', { legs: 'orzech' }),
    ],
  },
  {
    slug: 'briso', name: 'BRISO', style: 'nowoczesny', rooms: ['pokoj-mlodziezowy', 'biuro'], heroRoom: 'pokoj-mlodziezowy',
    handle: 'groove', base: 'legsMetal', legH: 8, tier: -0.08, isNew: true,
    tagline: 'Biurka, regały i łóżka do nauki i odpoczynku w jednym stylu.',
    description: 'BRISO to kolekcja do pokoju młodzieżowego i domowego biura: biurka z szufladami, otwarte regały, łóżka 90 i 120 cm oraz szafa. Uchwyty są wyfrezowane we frontach, więc nic nie wystaje. Korpusy białe albo grafitowe, fronty w dekorze dębu lub w kolorze szałwii.',
    finishes: [
      pal('BM-DN', 'Biały mat / dąb naturalny', 'bialy-mat', 'dab-naturalny', 'czarny'),
      pal('BM-SZ', 'Biały mat / szałwia', 'bialy-mat', 'szalwia', 'czarny'),
      pal('GR-DM', 'Grafit / dąb miodowy', 'grafit', 'dab-miodowy', 'czarny'),
    ],
  },
  {
    slug: 'verno', name: 'VERNO', style: 'minimalistyczny', rooms: ['przedpokoj', 'sypialnia'], heroRoom: 'przedpokoj',
    handle: 'groove', base: 'plinth', legH: 5, tier: 0.04, isNew: true,
    tagline: 'Pojemne szafy i meble do przedpokoju o prostych, cichych frontach.',
    description: 'VERNO porządkuje przedpokój i sypialnię: szafy 100 i 150 cm, szafki na buty z uchylnymi komorami, wieszak, lustro, komoda i łóżka z pojemnikiem. Fronty mają wyfrezowany uchwyt, a korpusy stoją na niskim cokole. Biel z dekorem dębu, kaszmir albo grafit z dębem miodowym.',
    finishes: [
      pal('BM-DN', 'Biały mat / dąb naturalny', 'bialy-mat', 'dab-naturalny', 'stal'),
      pal('KA', 'Kaszmir', 'kaszmir', 'kaszmir', 'stal'),
      pal('GR-DM', 'Grafit / dąb miodowy', 'grafit', 'dab-miodowy', 'stal'),
    ],
  },
];
const C = Object.fromEntries(COLLECTIONS.map(c => [c.slug, c]));

// ---------------------------------------------------------------------------
// Specyfikacje mebli. Komórki frontów: od GÓRY do dołu, h = proporcje wysokości.
// ---------------------------------------------------------------------------
const cell = t => (h = 1) => ({ t, h });
const dr = cell('drawer'), dw = cell('door'), gl = cell('doorGlass'), op = cell('open'), fl = cell('flap');
const col = (w, ...cells) => ({ w, cells });

const SPECS = {
  olmo: [
    { type: 'rtv', w: 160, h: 52, d: 40, best: true, cols: [col(1, dw()), col(1, op(1.4), dr()), col(1, dw())] },
    { type: 'rtv', w: 200, h: 52, d: 40, cols: [col(1, dw()), col(1, op(1.4), dr()), col(1, op(1.4), dr()), col(1, dw())] },
    { type: 'komoda', w: 120, h: 88, d: 42, best: true, cols: [col(1, dw()), col(1, dr(), dr(), dr()), col(1, dw())] },
    { type: 'komoda', w: 80, h: 104, d: 42, tag: 'wysoka', suffix: 'H', cols: [col(1, dr(), dr(), dr(), dr())] },
    { type: 'witryna', w: 90, h: 192, d: 40, cols: [col(1, gl(3), dw(1.2)), col(1, gl(3), dw(1.2))] },
    { type: 'regal', w: 80, h: 192, d: 36, cols: [col(1, op(), op(), op(), dw(1.3))] },
    { type: 'lawa', w: 110, h: 45, d: 60, top: 3, shelf: true },
    { type: 'stol', w: 160, h: 76, d: 90, top: 3 },
    { type: 'kredens', w: 150, h: 136, d: 42, cols: [col(1, dw()), col(1, gl(1.5), dr(0.5), dr(0.5)), col(1, dw())] },
    { type: 'lozko', mattress: 160, headboardH: 95, frameH: 28 },
    { type: 'szafka_nocna', w: 50, h: 50, d: 40, cols: [col(1, dr(), op())] },
    { type: 'polka', w: 120, h: 22, d: 22, style: 'box', dividers: 1 },
  ],
  talve: [
    { type: 'rtv', w: 150, h: 55, d: 40, cols: [col(1, dw()), col(1, dr(), dr()), col(1, dw())] },
    { type: 'komoda', w: 100, h: 85, d: 42, cols: [col(1, dr(), dr(), dr()), col(1, dr(), dr(), dr())] },
    { type: 'regal', w: 60, h: 180, d: 35, cols: [col(1, op(), op(), op(), dw(1.2))] },
    { type: 'lawa', w: 100, h: 43, d: 55, top: 2.5, shelf: false },
    { type: 'polka', w: 90, h: 25, d: 22, style: 'box', dividers: 1 },
    { type: 'lozko', mattress: 140, headboardH: 100, frameH: 26, best: true },
    { type: 'lozko', mattress: 120, headboardH: 90, frameH: 26 },
    { type: 'szafka_nocna', w: 45, h: 52, d: 38, cols: [col(1, dr(), dr())] },
    { type: 'szafa', w: 100, h: 200, d: 58, cols: [col(1, dw()), col(1, dw())] },
    { type: 'biurko', w: 110, h: 76, d: 55, top: 2.5, pedestal: 38, side: 'right', drawerH: 12, cols: [col(1, dr(), dr(), dr())] },
    { type: 'toaletka', w: 90, h: 76, d: 40, top: 2, pedestal: 30, side: 'left', drawerH: 12, cols: [col(1, dr(), op())] },
  ],
  nokta: [
    { type: 'rtv', w: 180, h: 50, d: 40, cols: [col(1, fl()), col(1, op()), col(1, fl())] },
    { type: 'rtv', w: 140, h: 50, d: 40, cols: [col(1, dw()), col(1, op(1), dr(0.7))] },
    { type: 'komoda', w: 150, h: 82, d: 42, cols: [col(1, dr(), dr(), dr()), col(1, dw()), col(1, dw())] },
    { type: 'witryna', w: 60, h: 185, d: 38, cols: [col(1, gl(3), dr(0.6))] },
    { type: 'regal', w: 90, h: 180, d: 35, base: 'frame', cols: [col(1, op(), op(), op(), dw(1.3)), col(1, op(), op(), dw(2.3))] },
    { type: 'lawa', w: 120, h: 42, d: 60, top: 3, base: 'frame', shelf: true },
    { type: 'stol', w: 180, h: 76, d: 90, top: 4, base: 'frame', best: true },
    { type: 'kredens', w: 160, h: 125, d: 42, cols: [col(1, gl()), col(1, dr(0.5), dr(0.5), dw()), col(1, dw())] },
    { type: 'biurko', w: 140, h: 76, d: 65, top: 3, base: 'frame', pedestal: 40, side: 'left', cols: [col(1, dr(), dr())] },
    { type: 'polka', w: 100, h: 30, d: 24, style: 'box', dividers: 1 },
  ],
  solma: [
    { type: 'rtv', w: 160, h: 50, d: 40, best: true, cols: [col(1, dw()), col(1, dr(), dr()), col(1, dw())] },
    { type: 'komoda', w: 120, h: 82, d: 42, cols: [col(1, dw()), col(1, dr(), dr(), dr()), col(1, dw())] },
    { type: 'komoda', w: 80, h: 100, d: 40, tag: 'wysoka', suffix: 'H', cols: [col(1, dr(), dr(), dr(), dr())] },
    { type: 'witryna', w: 80, h: 190, d: 40, cols: [col(1, gl(3), dr(0.7)), col(1, gl(3), dr(0.7))] },
    { type: 'lawa', w: 100, h: 45, d: 60, top: 2, shelf: false },
    { type: 'lozko', mattress: 160, headboardH: 110, frameH: 30, storage: true, upholstered: true, headboard: 'channels' },
    { type: 'szafka_nocna', w: 50, h: 52, d: 40, cols: [col(1, dr(), dr())] },
    { type: 'toaletka', w: 100, h: 76, d: 42, top: 2, pedestal: 35, side: 'left', drawerH: 12, cols: [col(1, dr(), dr())] },
    { type: 'lustro', w: 60, h: 120, d: 3, tag: 'łukowe', suffix: 'A', shape: 'arch', frame: 2, frameMaterial: 'metal' },
    { type: 'szafa', w: 150, h: 205, d: 60, best: true, cols: [col(1, dw()), col(1, dw()), col(1, dw())] },
    { type: 'szafka_na_buty', w: 80, h: 100, d: 32, cols: [col(1, dr(0.4), fl(), fl())] },
  ],
  liran: [
    { type: 'rtv', w: 200, h: 36, d: 40, tag: 'wisząca', suffix: 'W', base: 'hanging', best: true, cols: [col(1, fl()), col(1, fl()), col(1, op()), col(1, fl())] },
    { type: 'rtv', w: 160, h: 45, d: 42, cols: [col(1, dr(), dr()), col(1, dr(), dr())] },
    { type: 'komoda', w: 140, h: 80, d: 42, cols: [col(1, dw()), col(1, dw()), col(1, dr(), dr(), dr())] },
    { type: 'witryna', w: 50, h: 190, d: 38, cols: [col(1, gl(3.2), dw())] },
    { type: 'regal', w: 80, h: 190, d: 35, cols: [col(1, op(), op(), op(), dw(1.4))] },
    { type: 'lawa', w: 110, h: 38, d: 60, top: 4, base: 'frame', shelf: false },
    { type: 'stol', w: 140, h: 76, d: 80, top: 2.5, base: 'frame' },
    { type: 'kredens', w: 120, h: 130, d: 42, cols: [col(1, gl(1.2), dw()), col(1, dr(), dr(), dr(), dr())] },
    { type: 'biurko', w: 120, h: 75, d: 60, top: 2.5, base: 'frame', pedestal: 40, side: 'right', drawerH: 10, cols: [col(1, dr(), dr(), dw(1.6))] },
    { type: 'polka', w: 160, h: 4, d: 22, style: 'board' },
  ],
  melva: [
    { type: 'rtv', w: 140, h: 56, d: 42, cols: [col(1, dw()), col(1, op(1), dr(0.8)), col(1, dw())] },
    { type: 'komoda', w: 110, h: 88, d: 44, cols: [col(1, dr(), dr(), dr(), dr()), col(1, dw())] },
    { type: 'komoda', w: 160, h: 88, d: 44, cols: [col(1, dw()), col(1, dr(), dr(), dr(), dr()), col(1, dw())] },
    { type: 'witryna', w: 100, h: 195, d: 42, cols: [col(1, gl(3), dr(0.5), dw()), col(1, gl(3), dr(0.5), dw())] },
    { type: 'kredens', w: 120, h: 140, d: 42, best: true, cols: [col(1, gl(1.2), dr(0.4), dw()), col(1, gl(1.2), dr(0.4), dw())] },
    { type: 'stol', w: 160, h: 76, d: 90, top: 3, tag: 'rozkładany', suffix: 'R', extendTo: 200 },
    { type: 'lawa', w: 100, h: 46, d: 60, top: 3, shelf: true },
    { type: 'lozko', mattress: 160, headboardH: 105, frameH: 30, upholstered: true },
    { type: 'szafka_nocna', w: 50, h: 55, d: 40, cols: [col(1, dr(0.6), dw())] },
    { type: 'lustro', w: 70, h: 100, d: 3, shape: 'rect', frame: 5, frameMaterial: 'board' },
    { type: 'szafa', w: 120, h: 200, d: 58, cols: [col(1, dw()), col(1, dw())] },
  ],
  briso: [
    { type: 'biurko', w: 120, h: 76, d: 60, top: 2.5, best: true, pedestal: 40, side: 'left', cols: [col(1, dr(), dr(), dr())] },
    { type: 'biurko', w: 140, h: 76, d: 65, top: 2.5, pedestal: 45, side: 'right', drawerH: 10, cols: [col(1, op(), dr(), dr())] },
    { type: 'regal', w: 50, h: 190, d: 35, cols: [col(1, op(), op(), op(), op(), dw(1.3))] },
    { type: 'regal', w: 100, h: 120, d: 35, tag: 'niski', suffix: 'N', cols: [col(1, op(), op(), op()), col(1, op(), dw(2))] },
    { type: 'szafa', w: 90, h: 195, d: 55, cols: [col(1, dw()), col(1, dw())] },
    { type: 'lozko', mattress: 90, headboardH: 80, frameH: 25, storage: true },
    { type: 'lozko', mattress: 120, headboardH: 85, frameH: 25, storage: true },
    { type: 'komoda', w: 80, h: 90, d: 40, cols: [col(1, dr(), dr(), dr(), dr())] },
    { type: 'polka', w: 100, h: 30, d: 22, style: 'box', dividers: 2 },
    { type: 'polka', w: 60, h: 35, d: 30, tag: 'z klapą', suffix: 'K', kind: 'cabinet', base: 'hanging', cols: [col(1, fl()), col(1, op())] },
    { type: 'szafka_nocna', w: 40, h: 45, d: 38, cols: [col(1, dr(), op())] },
  ],
  verno: [
    { type: 'szafa', w: 100, h: 200, d: 60, cols: [col(1, dw()), col(1, dw())] },
    { type: 'szafa', w: 150, h: 200, d: 60, best: true, cols: [col(1, dw()), col(1, dw(3), dr(0.5), dr(0.5)), col(1, dw())] },
    { type: 'szafka_na_buty', w: 60, h: 105, d: 30, cols: [col(1, dr(0.4), fl(), fl())] },
    { type: 'szafka_na_buty', w: 100, h: 80, d: 35, cols: [col(1, fl(), fl()), col(1, fl(), fl())] },
    { type: 'wieszak', w: 80, h: 100, d: 30, hooks: 5, shelf: true },
    { type: 'lustro', w: 50, h: 150, d: 3, shape: 'rect', frame: 3, frameMaterial: 'board' },
    { type: 'komoda', w: 100, h: 85, d: 40, cols: [col(1, dw()), col(1, dr(), dr(), dr())] },
    { type: 'lozko', mattress: 160, headboardH: 100, frameH: 30, storage: true },
    { type: 'lozko', mattress: 140, headboardH: 100, frameH: 30, storage: true },
    { type: 'szafka_nocna', w: 45, h: 30, d: 35, tag: 'wisząca', suffix: 'W', base: 'hanging', cols: [col(1, dr())] },
    { type: 'polka', w: 80, h: 25, d: 25, style: 'box', dividers: 0 },
  ],
};

// ---------------------------------------------------------------------------
// Model 3D (kontrakt model3d) + wykończenie wariantu
// ---------------------------------------------------------------------------
function finishFor(kind, p, spec) {
  const f = { body: p.body, front: p.front };
  if (p.top) f.top = p.top;
  if (p.legs) f.legs = p.legs;
  f.metal = p.metal;
  switch (kind) {
    case 'table': case 'coffeeTable': case 'desk':
      f.top = p.top ?? p.front;
      break;
    case 'wallShelf': case 'coatRack':
      f.body = f.front = p.top ?? p.front;
      delete f.top;
      break;
    case 'mirror':
      f.body = f.front = p.top ?? p.front;
      delete f.top;
      delete f.legs;
      break;
    case 'bed':
      delete f.top;
      break;
    default:
  }
  if (!['legsWood'].includes(spec.base)) delete f.legs;
  return f;
}

function buildModel(spec, coll) {
  const type = T[spec.type];
  const kind = spec.kind || type.kind;
  let base = spec.base || coll.base;
  // meble ścienne zawsze wiszą; stoły/biurka nie stoją na cokole
  if (['wallShelf', 'mirror', 'coatRack'].includes(kind)) base = 'hanging';
  if (['table', 'coffeeTable', 'desk'].includes(kind) && base === 'plinth') base = 'frame';
  const m = { kind };
  if (kind === 'bed') {
    m.w = spec.mattress + 6; m.h = spec.headboardH; m.d = 208;
  } else {
    m.w = spec.w; m.h = spec.h; m.d = spec.d;
  }
  m.base = base;
  if (base === 'hanging') m.legH = 0; // wiszące: brak nóg; sugerowana wysokość montażu w mountH
  else if (['table', 'coffeeTable', 'desk'].includes(kind)) m.legH = round(m.h - spec.top, 1);
  else if (kind === 'bed') m.legH = base === 'plinth' ? 6 : Math.min(coll.legH, 12);
  else m.legH = coll.legH;
  switch (kind) {
    case 'cabinet':
      m.columns = spec.cols; m.handle = coll.handle;
      if (spec.cols.some(c => c.cells.some(x => x.t === 'doorGlass'))) m.glassShelves = true;
      break;
    case 'desk':
      // columns = układ frontów kontenera (szafki pod blatem) o szerokości `pedestal` cm
      m.top = spec.top; m.pedestal = spec.pedestal; m.pedestalSide = spec.side;
      m.columns = spec.cols; m.handle = coll.handle;
      if (spec.drawerH) m.drawerH = spec.drawerH;
      break;
    case 'table':
      m.top = spec.top; if (spec.extendTo) m.extendTo = spec.extendTo; break;
    case 'coffeeTable':
      m.top = spec.top; m.shelf = !!spec.shelf; break;
    case 'bed':
      m.headboardH = spec.headboardH; m.mattress = [spec.mattress, 200]; m.frameH = spec.frameH; m.storage = !!spec.storage;
      m.upholstered = !!spec.upholstered; if (spec.headboard) m.headboard = spec.headboard;
      break;
    case 'wallShelf':
      m.style = spec.style; m.dividers = spec.dividers ?? 0;
      m.shelves = spec.style === 'board' ? 1 : 2; m.top = spec.style === 'board' ? spec.h : 1.8;
      break;
    case 'mirror':
      m.frame = spec.frame; m.shape = spec.shape; m.frameMaterial = spec.frameMaterial; break;
    case 'coatRack':
      m.hooks = spec.hooks; m.shelf = !!spec.shelf; break;
    default:
  }
  if (base === 'hanging') m.mountH = MOUNT_H[type.id] ?? 120;
  m.finish = finishFor(kind, coll.finishes[0], { base });
  return m;
}
/** Sugerowana wysokość montażu mebli wiszących (dolna krawędź nad podłogą, cm). */
const MOUNT_H = { rtv: 35, szafka_nocna: 35, polka: 140, lustro: 70, wieszak: 95 };

const countCells = m => {
  const n = { drawer: 0, door: 0, doorGlass: 0, open: 0, flap: 0 };
  for (const c of m.columns || []) for (const x of c.cells) n[x.t]++;
  if (m.drawerH) n.drawer++;
  return n;
};

/** Przybliżona waga: płyta 18 mm ≈ 12 kg/m², HDF ≈ 3 kg/m², szkło 4 mm ≈ 10 kg/m². */
function weightOf(m) {
  const A = (a, b) => (a * b) / 1e4; // cm² → m²
  let kg = 0;
  const bodyH = m.h - m.legH;
  const n = countCells(m);
  switch (m.kind) {
    case 'cabinet': {
      const cols = m.columns.length;
      kg += 12 * (2 * A(bodyH, m.d) + 2 * A(m.w, m.d) + (cols - 1) * A(bodyH, m.d));
      kg += 3 * A(m.w, bodyH);
      const total = m.columns.reduce((a, c) => a + c.w, 0);
      for (const c of m.columns) {
        const sum = c.cells.reduce((a, x) => a + x.h, 0);
        for (const x of c.cells) {
          const a = A((m.w * c.w) / total, (bodyH * x.h) / sum);
          if (x.t === 'doorGlass') kg += 10 * a + 1;
          else if (x.t !== 'open') kg += 12 * a;
          if (x.t === 'open') kg += 12 * A((m.w * c.w) / total, m.d); // półka
        }
      }
      kg += 2.5 * n.drawer + (m.base === 'legsMetal' || m.base === 'frame' ? 2 : 1);
      break;
    }
    case 'desk': {
      kg += 12 * A(m.w, m.d) * (m.top / 1.8);
      kg += 12 * (2 * A(m.legH, m.d) + A(m.pedestal, m.legH)); // kontener: boki + fronty
      kg += 3 * n.drawer + (m.base === 'frame' ? 8 : 4);
      break;
    }
    case 'table': kg += 12 * A(m.w, m.d) * (m.top / 1.8) + (m.base === 'frame' ? 12 : 8) + (m.extendTo ? 8 : 0); break;
    case 'coffeeTable': kg += 12 * A(m.w, m.d) * (m.top / 1.8) + (m.shelf ? 12 * A(m.w, m.d) : 0) + (m.base === 'frame' ? 6 : 3); break;
    case 'bed': {
      kg += 12 * (2 * A(m.d, m.frameH) + 2 * A(m.w, m.frameH) + A(m.w, m.headboardH));
      kg += 0.04 * (m.w - 6) + 8; // stelaż listwowy
      if (m.storage) kg += 12 * A(m.w, m.d) * 0.6;
      break;
    }
    case 'wallShelf': kg += m.style === 'board' ? 12 * A(m.w, m.d) * (m.h / 1.8) : 12 * (2 * A(m.w, m.d) + (2 + m.dividers) * A(m.h, m.d)); break;
    case 'mirror': kg += 10 * A(m.w, m.h) + (m.frameMaterial === 'metal' ? 2 : 3); break;
    case 'coatRack': kg += 12 * A(m.w, m.h) + (m.shelf ? 12 * A(m.w, m.d) : 0) + 0.15 * m.hooks; break;
    default:
  }
  return Math.max(1, Math.round(kg));
}

// ---------------------------------------------------------------------------
// Teksty (opisy, cechy)
// ---------------------------------------------------------------------------
const NUM_F = ['', 'jedną', 'dwie', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem'];
const NUM_COLL = ['', 'jedne', 'dwoje', 'troje', 'czworo', 'pięcioro', 'sześcioro'];
const accF = (n, one, few, many) => (n === 1 ? one : n <= 4 ? `${NUM_F[n]} ${few}` : `${NUM_F[n] || n} ${many}`);
const parts = (n, shoe) => [
  n.door && (n.door === 1 ? 'jedne drzwi' : `${NUM_COLL[n.door]} drzwi`),
  n.doorGlass && (n.doorGlass === 1 ? 'przeszklone drzwi' : `${NUM_COLL[n.doorGlass]} przeszklonych drzwi`),
  n.drawer && accF(n.drawer, 'szufladę', 'szuflady', 'szuflad'),
  n.flap && (shoe ? accF(n.flap, 'uchylną komorę na buty', 'uchylne komory na buty', 'uchylnych komór na buty')
    : accF(n.flap, 'klapę', 'klapy', 'klap')),
  n.open && accF(n.open, 'otwartą wnękę', 'otwarte wnęki', 'otwartych wnęk'),
].filter(Boolean);

function handleSentence(handle, metal) {
  return {
    edge: 'Fronty chwyta się za wyprofilowaną krawędź, bez wystających uchwytów.',
    knob: `Fronty mają małe okrągłe gałki w kolorze ${METAL_LOC[metal]}.`,
    bar: `Długie uchwyty w kolorze ${METAL_LOC[metal]} podkreślają poziomą linię frontów.`,
    groove: 'We frontach wyfrezowano wgłębienia na palce, więc nic nie wystaje.',
    push: 'Fronty nie mają uchwytów — otwiera się je lekkim naciśnięciem (push-to-open).',
  }[handle];
}
function baseSentence(m, metal, what = 'Stoi') {
  switch (m.base) {
    case 'legsWood': return m.legH < 30 ? `${what} na drewnianych nóżkach o wysokości ${m.legH} cm.` : `${what} na drewnianych nogach.`;
    case 'legsMetal': return `${what} na cienkich metalowych nogach w kolorze ${METAL_LOC[metal]}.`;
    case 'plinth': return `${what} na niskim, cofniętym cokole.`;
    case 'hanging': return 'Wisi na ścianie — elementy do zawieszenia są w zestawie.';
    case 'frame': return `Opiera się na metalowej ramie w kolorze ${METAL_LOC[metal]}.`;
    default: return '';
  }
}
const TV = [43, 50, 55, 65, 75, 85];
const tvFor = w => TV.filter(s => s * 2.214 <= w - 6).at(-1);

function describe(spec, m, coll, type) {
  const metal = coll.finishes[0].metal;
  const n = countCells(m);
  const shoe = type.id === 'szafka_na_buty';
  const has = parts(n, shoe);
  const comp = has.length ? `Ma ${joinPl(has)}.` : '';
  const N = coll.name;
  const s = [];
  switch (type.id) {
    case 'rtv':
      s.push(`Szafka RTV z kolekcji ${N} ma ${m.w} cm szerokości i zmieści telewizor do ok. ${tvFor(m.w)} cali.`, comp,
        m.base === 'hanging' ? baseSentence(m, metal) : handleSentence(m.handle, metal));
      break;
    case 'komoda':
      s.push(`Komoda z kolekcji ${N} o wymiarach ${m.w} × ${m.h} cm.`, comp, handleSentence(m.handle, metal));
      break;
    case 'witryna':
      s.push(`Witryna z kolekcji ${N} — ${m.h} cm wysokości i ${m.w} cm szerokości, na naczynia, szkło i książki.`, comp, baseSentence(m, metal));
      break;
    case 'regal':
      s.push(`Regał z kolekcji ${N} o wymiarach ${m.w} × ${m.h} cm.`, comp, baseSentence(m, metal));
      break;
    case 'kredens':
      s.push(`Kredens z kolekcji ${N} ma ${m.w} cm szerokości i ${m.h} cm wysokości.`, comp, handleSentence(m.handle, metal));
      break;
    case 'szafka_nocna':
      s.push(`Szafka nocna z kolekcji ${N} o szerokości ${m.w} cm.`, comp, baseSentence(m, metal));
      break;
    case 'szafa':
      s.push(`Szafa z kolekcji ${N}: ${m.w} cm szerokości, ${m.h} cm wysokości i ${m.d} cm głębokości.`, comp, handleSentence(m.handle, metal));
      break;
    case 'szafka_na_buty':
      s.push(`Szafka na buty z kolekcji ${N} ma tylko ${m.d} cm głębokości, więc zmieści się w wąskim przedpokoju.`, comp, handleSentence(m.handle, metal));
      break;
    case 'polka':
      if (m.kind === 'cabinet') s.push(`Wisząca półka z kolekcji ${N} o szerokości ${m.w} cm.`, comp, baseSentence(m, metal));
      else if (m.style === 'board') s.push(`Prosta półka ścienna z kolekcji ${N} o długości ${m.w} cm i grubości ${num(m.h)} cm.`, 'Mocowanie jest niewidoczne, więc półka wygląda, jakby wyrastała ze ściany.');
      else s.push(`Półka ścienna z kolekcji ${N} o szerokości ${m.w} cm${m.dividers ? `, podzielona na ${m.dividers + 1} części` : ''}.`, 'Pomieści książki, rośliny albo drobiazgi; wisi na ukrytych zawieszkach.');
      break;
    case 'lawa':
      s.push(`Ława z kolekcji ${N} z blatem ${m.w} × ${m.d} cm o grubości ${num(m.top)} cm.`,
        m.shelf ? 'Pod blatem jest półka na książki, gazety i piloty.' : 'Lekka forma bez półki dobrze wygląda przed sofą.',
        baseSentence(m, metal));
      break;
    case 'stol': {
      const seats = m.w >= 180 ? 'do ośmiu osób' : m.w >= 160 ? 'sześć osób' : 'cztery osoby';
      s.push(`Stół z kolekcji ${N} z blatem ${m.w} × ${m.d} cm — ${m.extendTo ? `po rozłożeniu do ${m.extendTo} cm usiądzie przy nim do ośmiu osób` : `wygodnie usiądzie przy nim ${seats}`}.`,
        baseSentence(m, metal));
      break;
    }
    case 'lozko':
      s.push(`Łóżko z kolekcji ${N} na materac ${m.mattress.join(' × ')} cm, z ${m.upholstered ? 'tapicerowanym wezgłowiem' : 'wezgłowiem'} o wysokości ${m.h} cm.`,
        m.storage ? 'Pod ramą jest pojemnik na pościel.' : `Prześwit ${m.legH} cm pod ramą ułatwia sprzątanie.`,
        'Stelaż w zestawie, materac do dokupienia.');
      break;
    case 'toaletka':
      s.push(`Toaletka z kolekcji ${N} o szerokości ${m.w} cm i głębokości ${m.d} cm.`, comp, baseSentence(m, metal));
      break;
    case 'biurko':
      s.push(`Biurko z kolekcji ${N} z blatem ${m.w} × ${m.d} cm.`, comp, baseSentence(m, metal));
      break;
    case 'lustro':
      s.push(`${m.shape === 'arch' ? 'Lustro z łukowym zakończeniem' : 'Prostokątne lustro'} z kolekcji ${N} o wymiarach ${m.w} × ${m.h} cm.`,
        `Rama ${m.frameMaterial === 'metal' ? `z metalu w kolorze ${METAL_LOC[metal]}` : `szerokości ${m.frame} cm w kolorze mebli z kolekcji`}.`);
      break;
    case 'wieszak':
      s.push(`Wieszak ścienny z kolekcji ${N} o szerokości ${m.w} cm z ${m.hooks} haczykami.`,
        m.shelf ? 'Na górze ma półkę na czapki, szaliki i rękawiczki.' : '');
      break;
    default:
  }
  return s.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function featuresOf(spec, m, coll, type) {
  const n = countCells(m);
  const f = [];
  const add = x => x && !f.includes(x) && f.push(x);
  if (m.handle === 'push' && (n.drawer || n.door || n.flap)) add('fronty otwierane naciśnięciem (push-to-open)');
  if (n.drawer) add('prowadnice szuflad z cichym domykiem');
  if (n.door || n.doorGlass) add('zawiasy z cichym domykiem');
  if (n.doorGlass) add('szkło hartowane, lekko przydymione');
  switch (type.id) {
    case 'rtv': add('otwory na przewody w plecach'); if (n.flap) add('klapy na podnośnikach gazowych'); break;
    case 'komoda': if (n.door) add('regulowana półka za drzwiami'); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    case 'witryna': add('regulowane półki za szkłem'); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    case 'regal': add('regulowane półki'); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    case 'kredens': add('regulowane półki'); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    case 'szafa': add('drążek na ubrania i półki wewnętrzne'); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    case 'szafka_na_buty': {
      const total = m.columns.reduce((a, c) => a + c.w, 0);
      const pairs = m.columns.reduce((a, c) => a + c.cells.filter(x => x.t === 'flap').length * Math.floor((m.w * c.w) / total / 16), 0);
      add(`uchylne komory na ok. ${pairs} par butów`); add('zabezpieczenie przed przewróceniem w zestawie'); break;
    }
    case 'szafka_nocna': if (m.base === 'hanging') add('montaż do ściany — zawieszki w zestawie'); add('blat na lampkę i książkę'); break;
    case 'lawa': add(m.shelf ? 'półka pod blatem' : `blat o grubości ${num(m.top)} cm`); add('filcowe podkładki pod nogi'); break;
    case 'stol': if (m.extendTo) add(`rozkładany do ${m.extendTo} cm`); add(`blat o grubości ${num(m.top)} cm`); add('filcowe podkładki pod nogi'); break;
    case 'lozko': add(`na materac ${m.mattress.join(' × ')} cm (do dokupienia)`); add('stelaż listwowy w zestawie'); if (m.storage) add('pojemnik na pościel'); if (m.upholstered) add('wezgłowie obite tkaniną'); break;
    case 'toaletka': add('płytka szuflada na kosmetyki'); break;
    case 'biurko': add('przepust kablowy w blacie'); add(`blat ${m.w} × ${m.d} cm`); break;
    case 'lustro': add('lustro 4 mm z folią zabezpieczającą'); add(m.shape === 'arch' ? 'do powieszenia pionowo' : 'można powiesić pionowo lub poziomo'); break;
    case 'wieszak': add(`${m.hooks} metalowych haczyków`); if (m.shelf) add('półka na czapki i rękawiczki'); add('montaż do ściany — kołki w zestawie'); break;
    case 'polka': add('montaż do ściany — zawieszki w zestawie'); add('zalecane obciążenie do 10 kg'); break;
    default:
  }
  if (m.base === 'hanging' && !f.some(x => x.startsWith('montaż do ściany'))) add('montaż do ściany — zawieszki w zestawie');
  if (!(m.kind === 'mirror' && m.frameMaterial === 'metal')) add('obrzeża ABS 2 mm');
  add('instrukcja i okucia w zestawie');
  return f.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Produkty
// ---------------------------------------------------------------------------
function nameOf(spec, coll, type) {
  const size = type.id === 'lozko' ? spec.mattress : spec.w;
  const tags = [];
  if (type.id === 'polka') tags.push('wisząca');
  if (spec.tag && !tags.includes(spec.tag)) tags.push(spec.tag);
  return `${type.name}${tags.length ? ' ' + tags.join(' ') : ''} ${size} ${coll.name}`;
}

function roomsOf(spec, coll, type) {
  let rooms = type.rooms.filter(r => coll.rooms.includes(r));
  if (type.id === 'lozko') {
    const r = spec.mattress <= 120 ? 'pokoj-mlodziezowy' : 'sypialnia';
    rooms = coll.rooms.includes(r) ? [r] : rooms;
  }
  if (!rooms.length) throw new Error(`${coll.slug}/${type.id}: brak pasujących pomieszczeń`);
  return rooms;
}

const products = [];
for (const coll of COLLECTIONS) {
  for (const spec of SPECS[coll.slug]) {
    const type = T[spec.type];
    const size = type.id === 'lozko' ? spec.mattress : spec.w;
    const code = `${type.skuCode}${size}${spec.suffix || ''}`;
    const sku = `LV-${coll.name}-${code}`;
    const name = nameOf(spec, coll, type);
    const model3d = buildModel(spec, coll);
    const r = rng(sku);

    // warianty kolorystyczne: zawsze pierwszy, potem część pozostałych
    const roll = r();
    const k = coll.finishes.length === 3 ? (roll < 0.6 ? 3 : roll < 0.9 ? 2 : 1) : (roll < 0.8 ? 2 : 1);
    const rest = coll.finishes.slice(1).map(p => [r(), p]).sort((a, b) => a[0] - b[0]).slice(0, k - 1).map(x => x[1]);
    const chosen = coll.finishes.filter(p => p === coll.finishes[0] || rest.includes(p));
    const variants = chosen.map((p, i) => {
      const s = r();
      const stock = i === 0 ? (s < 0.85 ? 'dostepny' : 'na-zamowienie') : s < 0.72 ? 'dostepny' : s < 0.9 ? 'na-zamowienie' : 'wyprzedany';
      return {
        code: p.code,
        sku: `${sku}-${p.code}`,
        finish: finishFor(model3d.kind, p, { base: model3d.base }),
        colorLabel: p.label,
        stock,
        ...(stock === 'na-zamowienie' ? { leadTimeDays: 14 + Math.floor(r() * 3) * 7 } : {}),
        images: { packshot: `renders/products/${sku}--${p.code}.webp` },
      };
    });

    products.push({
      id: `${coll.slug}-${code.toLowerCase()}`,
      sku,
      slug: slugify(name),
      name,
      collection: coll.slug,
      type: type.id,
      rooms: roomsOf(spec, coll, type),
      dims: { w: model3d.w, h: model3d.h, d: model3d.d },
      weightKg: weightOf(model3d),
      model3d,
      variants,
      basePrice: 0, // niżej, gdy znamy wszystkie meble danego typu
      currency: 'PLN',
      priceHistory: [],
      features: featuresOf(spec, model3d, coll, type),
      description: describe(spec, model3d, coll, type),
      assembly: 'do samodzielnego montażu',
      bestseller: !!spec.best,
      isNew: !!coll.isNew || r() < 0.06,
      images: { packshot: variants[0].images.packshot },
      demo: true,
    });
  }
}

// ceny: pozycja w widełkach typu wg objętości mebla (w obrębie typu) + poziom kolekcji
for (const type of TYPES) {
  const list = products.filter(p => p.type === type.id);
  // wysokość pod pierwiastkiem — szerokość i głębokość ważą w cenie więcej niż wysokość
  const vol = p => p.dims.w * Math.sqrt(p.dims.h) * p.dims.d;
  const lo = Math.min(...list.map(vol));
  const hi = Math.max(...list.map(vol));
  const [min, max] = type.priceRange;
  for (const p of list) {
    const t = hi > lo ? (vol(p) - lo) / (hi - lo) : 0.5;
    const jitter = rng(`${p.sku}|price`)() * 0.1 - 0.05;
    const x = clamp(0.1 + 0.55 * t + C[p.collection].tier + jitter, 0, 1);
    p.basePrice = clamp(psych(min + (max - min) * x), min, max);
  }
}

// ---------------------------------------------------------------------------
// Promocje (względem --today; czas Europe/Warsaw z offsetem)
// ---------------------------------------------------------------------------
const at = (days, hour = 0) => warsawISO(addDays(TODAY, days), hour);
const weekPick = products.find(p => p.sku === 'LV-NOKTA-RTV180');
const promotions = [
  {
    id: 'promo-olmo-jesien', name: 'Jesień z kolekcją OLMO', kind: 'percent', value: 15,
    scope: { collections: ['olmo'] }, startsAt: at(-7), endsAt: at(11), label: '−15% na kolekcję OLMO',
    description: 'Rabat na wszystkie meble z kolekcji OLMO.',
  },
  {
    id: 'promo-komody', name: 'Komody w niższych cenach', kind: 'percent', value: 10,
    scope: { types: ['komoda'] }, startsAt: at(-4), endsAt: at(18), label: '−10% na komody',
    description: 'Rabat na komody ze wszystkich kolekcji.',
  },
  {
    id: 'promo-cena-tygodnia-nokta-rtv180', name: 'Cena tygodnia', kind: 'fixedPrice', value: psych(weekPick.basePrice * 0.8),
    scope: { skus: [weekPick.sku] }, startsAt: at(5), endsAt: at(12), label: 'Cena tygodnia',
    description: `${weekPick.name} w cenie tygodnia.`,
  },
  {
    id: 'promo-sypialnia-wrzesien', name: 'Wrześniowe dni sypialni', kind: 'percent', value: 20,
    scope: { types: ['lozko', 'szafka_nocna'] }, startsAt: at(-35), endsAt: at(-21), label: '−20% na łóżka i szafki nocne',
    description: 'Rabat na łóżka i szafki nocne ze wszystkich kolekcji.',
  },
].map(p => ({ ...p, source: 'demo', demo: true }));

// ---------------------------------------------------------------------------
// Historia cen (60 dni) — faktyczne ceny dzień po dniu, zapisane jako zmiany.
// Części mebli podniesiono cenę regularną 19 dni temu (ok. 6%), części
// obniżono 45 dni temu — żeby informacja Omnibus miała co pokazać.
// ---------------------------------------------------------------------------
for (const p of products) {
  const r = rng(`${p.sku}|history`);
  const roll = r();
  const changes = [];
  if (p.sku === weekPick.sku || roll < 0.15) {
    const old = psych(p.basePrice * 0.94);
    if (old < p.basePrice) changes.push({ until: addDays(TODAY, -19), price: old });
  } else if (roll > 0.95) {
    changes.push({ until: addDays(TODAY, -45), price: psych(p.basePrice * 1.06) });
  }
  const regularOn = day => changes.find(c => day < c.until)?.price ?? p.basePrice;
  let last = null;
  for (let i = -60; i <= 0; i++) {
    const day = addDays(TODAY, i);
    const price = priceFor({ ...p, basePrice: regularOn(day), variants: [] }, null, promotions, warsawISO(day, 12)).price;
    if (price !== last) p.priceHistory.push({ date: day, price });
    last = price;
  }
}

// ---------------------------------------------------------------------------
// Kody pocztowe: 2 pierwsze cyfry → przybliżony środek okręgu (±kilkadziesiąt km).
// Prefiks 79 nie jest używany (okręg szczeciński: 70–78).
// ---------------------------------------------------------------------------
const PC = [
  ['00', 'Warszawa – Śródmieście', 'mazowieckie', 52.231, 21.006],
  ['01', 'Warszawa – Wola, Bemowo, Bielany, Żoliborz', 'mazowieckie', 52.262, 20.945],
  ['02', 'Warszawa – Mokotów, Ochota, Ursynów, Włochy', 'mazowieckie', 52.180, 20.990],
  ['03', 'Warszawa – Praga-Północ, Targówek, Białołęka', 'mazowieckie', 52.285, 21.050],
  ['04', 'Warszawa – Praga-Południe, Wawer, Wesoła', 'mazowieckie', 52.225, 21.125],
  ['05', 'Okolice Warszawy (Pruszków, Piaseczno, Legionowo, Otwock, Mińsk Mazowiecki)', 'mazowieckie', 52.200, 21.050],
  ['06', 'Ciechanów, Mława, Pułtusk, Przasnysz', 'mazowieckie', 52.850, 20.800],
  ['07', 'Ostrołęka, Wyszków, Ostrów Mazowiecka, Węgrów', 'mazowieckie', 52.850, 21.600],
  ['08', 'Siedlce, Garwolin, Sokołów Podlaski, Łuków', 'mazowieckie', 52.050, 22.100],
  ['09', 'Płock, Płońsk, Sierpc, Gostynin', 'mazowieckie', 52.550, 19.900],
  ['10', 'Olsztyn', 'warmińsko-mazurskie', 53.778, 20.480],
  ['11', 'Okolice Olsztyna, Kętrzyn, Giżycko, Mrągowo, Bartoszyce', 'warmińsko-mazurskie', 54.000, 21.100],
  ['12', 'Szczytno, Pisz', 'warmińsko-mazurskie', 53.600, 21.400],
  ['13', 'Działdowo, Nidzica, Nowe Miasto Lubawskie', 'warmińsko-mazurskie', 53.300, 20.100],
  ['14', 'Ostróda, Iława, Braniewo, Pasłęk', 'warmińsko-mazurskie', 53.850, 19.800],
  ['15', 'Białystok', 'podlaskie', 53.133, 23.164],
  ['16', 'Okolice Białegostoku, Suwałki, Augustów, Sokółka', 'podlaskie', 53.700, 23.100],
  ['17', 'Bielsk Podlaski, Hajnówka, Siemiatycze', 'podlaskie', 52.700, 23.300],
  ['18', 'Łomża, Zambrów, Kolno, Wysokie Mazowieckie', 'podlaskie', 53.150, 22.100],
  ['19', 'Ełk, Grajewo, Olecko, Gołdap, Mońki', 'warmińsko-mazurskie', 53.850, 22.400],
  ['20', 'Lublin', 'lubelskie', 51.246, 22.568],
  ['21', 'Okolice Lublina, Biała Podlaska, Lubartów, Radzyń Podlaski', 'lubelskie', 51.650, 22.800],
  ['22', 'Chełm, Zamość, Hrubieszów, Krasnystaw, Tomaszów Lubelski', 'lubelskie', 50.950, 23.300],
  ['23', 'Kraśnik, Biłgoraj, Janów Lubelski', 'lubelskie', 50.750, 22.450],
  ['24', 'Puławy, Opole Lubelskie, Bełżyce', 'lubelskie', 51.300, 22.000],
  ['25', 'Kielce', 'świętokrzyskie', 50.866, 20.628],
  ['26', 'Radom, Skarżysko-Kamienna, Końskie, Opoczno', 'mazowieckie', 51.250, 20.850],
  ['27', 'Starachowice, Ostrowiec Świętokrzyski, Sandomierz, Opatów', 'świętokrzyskie', 50.900, 21.450],
  ['28', 'Busko-Zdrój, Jędrzejów, Pińczów, Staszów', 'świętokrzyskie', 50.500, 20.750],
  ['29', 'Włoszczowa i okolice', 'świętokrzyskie', 50.850, 19.950],
  ['30', 'Kraków – Śródmieście, Krowodrza, Podgórze', 'małopolskie', 50.050, 19.920],
  ['31', 'Kraków – Nowa Huta, Czyżyny, Prądnik', 'małopolskie', 50.075, 20.010],
  ['32', 'Okolice Krakowa, Olkusz, Chrzanów, Oświęcim, Bochnia, Wieliczka', 'małopolskie', 50.100, 19.800],
  ['33', 'Tarnów, Nowy Sącz, Dąbrowa Tarnowska', 'małopolskie', 49.850, 20.850],
  ['34', 'Nowy Targ, Zakopane, Wadowice, Żywiec, Limanowa, Myślenice', 'małopolskie', 49.650, 19.800],
  ['35', 'Rzeszów', 'podkarpackie', 50.041, 21.999],
  ['36', 'Okolice Rzeszowa, Kolbuszowa, Strzyżów, Brzozów', 'podkarpackie', 50.000, 21.900],
  ['37', 'Przemyśl, Jarosław, Przeworsk, Łańcut, Leżajsk, Stalowa Wola, Nisko, Lubaczów', 'podkarpackie', 50.200, 22.500],
  ['38', 'Krosno, Jasło, Sanok, Gorlice, Lesko, Ustrzyki Dolne', 'podkarpackie', 49.600, 21.900],
  ['39', 'Dębica, Mielec, Tarnobrzeg, Ropczyce', 'podkarpackie', 50.250, 21.500],
  ['40', 'Katowice', 'śląskie', 50.264, 19.024],
  ['41', 'Sosnowiec, Chorzów, Bytom, Zabrze, Ruda Śląska', 'śląskie', 50.300, 18.950],
  ['42', 'Częstochowa, Będzin, Zawiercie, Lubliniec, Tarnowskie Góry', 'śląskie', 50.650, 19.000],
  ['43', 'Bielsko-Biała, Tychy, Pszczyna, Cieszyn, Jaworzno', 'śląskie', 49.950, 19.000],
  ['44', 'Gliwice, Rybnik, Wodzisław Śląski, Jastrzębie-Zdrój, Żory', 'śląskie', 50.100, 18.600],
  ['45', 'Opole', 'opolskie', 50.675, 17.921],
  ['46', 'Kluczbork, Namysłów, Olesno', 'opolskie', 50.950, 18.100],
  ['47', 'Kędzierzyn-Koźle, Strzelce Opolskie, Racibórz', 'opolskie', 50.300, 18.200],
  ['48', 'Nysa, Prudnik, Głubczyce', 'opolskie', 50.400, 17.500],
  ['49', 'Brzeg, Grodków, Niemodlin', 'opolskie', 50.750, 17.400],
  ['50', 'Wrocław – Śródmieście, Stare Miasto', 'dolnośląskie', 51.108, 17.035],
  ['51', 'Wrocław – Psie Pole', 'dolnośląskie', 51.135, 17.080],
  ['52', 'Wrocław – Krzyki (Brochów, Klecina)', 'dolnośląskie', 51.075, 17.010],
  ['53', 'Wrocław – Fabryczna, Krzyki', 'dolnośląskie', 51.095, 16.975],
  ['54', 'Wrocław – Fabryczna (Leśnica, Kozanów)', 'dolnośląskie', 51.130, 16.930],
  ['55', 'Okolice Wrocławia, Oława, Trzebnica, Środa Śląska', 'dolnośląskie', 51.100, 17.000],
  ['56', 'Oleśnica, Milicz, Syców, Góra', 'dolnośląskie', 51.400, 17.300],
  ['57', 'Kłodzko, Ząbkowice Śląskie, Strzelin', 'dolnośląskie', 50.550, 16.800],
  ['58', 'Wałbrzych, Świdnica, Jelenia Góra, Dzierżoniów', 'dolnośląskie', 50.800, 16.100],
  ['59', 'Legnica, Lubin, Bolesławiec, Zgorzelec, Jawor', 'dolnośląskie', 51.200, 15.900],
  ['60', 'Poznań – Grunwald, Jeżyce', 'wielkopolskie', 52.400, 16.880],
  ['61', 'Poznań – Stare Miasto, Nowe Miasto, Wilda', 'wielkopolskie', 52.405, 16.950],
  ['62', 'Gniezno, Konin, Września, Kalisz, Koło, Turek', 'wielkopolskie', 52.250, 17.950],
  ['63', 'Ostrów Wielkopolski, Jarocin, Krotoszyn, Kępno, Gostyń', 'wielkopolskie', 51.700, 17.600],
  ['64', 'Leszno, Piła, Kościan, Szamotuły, Nowy Tomyśl', 'wielkopolskie', 52.400, 16.600],
  ['65', 'Zielona Góra', 'lubuskie', 51.936, 15.506],
  ['66', 'Gorzów Wielkopolski, Świebodzin, Międzyrzecz, Krosno Odrzańskie', 'lubuskie', 52.400, 15.300],
  ['67', 'Nowa Sól, Głogów, Wschowa', 'lubuskie', 51.700, 15.900],
  ['68', 'Żary, Żagań, Lubsko', 'lubuskie', 51.600, 15.100],
  ['69', 'Słubice, Sulęcin, Rzepin', 'lubuskie', 52.400, 14.800],
  ['70', 'Szczecin – Śródmieście, Zachód, Prawobrzeże', 'zachodniopomorskie', 53.425, 14.560],
  ['71', 'Szczecin – Północ, Pogodno', 'zachodniopomorskie', 53.455, 14.530],
  ['72', 'Police, Goleniów, Świnoujście, Kamień Pomorski, Gryfice', 'zachodniopomorskie', 53.700, 14.800],
  ['73', 'Stargard, Choszczno, Łobez', 'zachodniopomorskie', 53.350, 15.300],
  ['74', 'Gryfino, Myślibórz, Pyrzyce, Dębno', 'zachodniopomorskie', 53.000, 14.700],
  ['75', 'Koszalin', 'zachodniopomorskie', 54.194, 16.172],
  ['76', 'Słupsk, Sławno, Darłowo', 'pomorskie', 54.400, 16.800],
  ['77', 'Bytów, Miastko, Człuchów, Złotów', 'pomorskie', 53.850, 17.100],
  ['78', 'Kołobrzeg, Białogard, Szczecinek, Wałcz, Drawsko Pomorskie', 'zachodniopomorskie', 53.700, 16.000],
  ['80', 'Gdańsk', 'pomorskie', 54.352, 18.647],
  ['81', 'Gdynia, Sopot', 'pomorskie', 54.500, 18.540],
  ['82', 'Elbląg, Malbork, Kwidzyn, Sztum', 'warmińsko-mazurskie', 54.000, 19.200],
  ['83', 'Tczew, Starogard Gdański, Kościerzyna, Kartuzy, Pruszcz Gdański', 'pomorskie', 54.100, 18.300],
  ['84', 'Wejherowo, Lębork, Puck, Rumia', 'pomorskie', 54.600, 18.000],
  ['85', 'Bydgoszcz', 'kujawsko-pomorskie', 53.123, 18.008],
  ['86', 'Świecie, Chełmno, Grudziądz, Solec Kujawski', 'kujawsko-pomorskie', 53.350, 18.500],
  ['87', 'Toruń, Włocławek, Brodnica, Lipno, Rypin', 'kujawsko-pomorskie', 52.950, 18.950],
  ['88', 'Inowrocław, Mogilno, Żnin, Radziejów', 'kujawsko-pomorskie', 52.750, 18.000],
  ['89', 'Nakło nad Notecią, Chojnice, Tuchola, Szubin', 'kujawsko-pomorskie', 53.400, 17.600],
  ['90', 'Łódź – Śródmieście, Polesie', 'łódzkie', 51.768, 19.457],
  ['91', 'Łódź – Bałuty', 'łódzkie', 51.800, 19.445],
  ['92', 'Łódź – Widzew', 'łódzkie', 51.758, 19.530],
  ['93', 'Łódź – Górna, Polesie', 'łódzkie', 51.730, 19.460],
  ['94', 'Łódź – Polesie (Retkinia, Teofilów)', 'łódzkie', 51.765, 19.385],
  ['95', 'Zgierz, Pabianice, Ozorków, Brzeziny, Koluszki', 'łódzkie', 51.800, 19.450],
  ['96', 'Skierniewice, Żyrardów, Sochaczew, Rawa Mazowiecka', 'łódzkie', 52.000, 20.200],
  ['97', 'Piotrków Trybunalski, Bełchatów, Tomaszów Mazowiecki, Radomsko', 'łódzkie', 51.300, 19.700],
  ['98', 'Sieradz, Wieluń, Zduńska Wola, Łask, Wieruszów', 'łódzkie', 51.500, 18.800],
  ['99', 'Kutno, Łowicz, Łęczyca, Poddębice', 'łódzkie', 52.150, 19.400],
];
const postcodes = {
  precision: 'prefix-2',
  note: 'Przybliżone środki okręgów pocztowych (pierwsze 2 cyfry kodu); dokładność rzędu kilkudziesięciu km. Opracowanie własne.',
  unusedPrefixes: ['79'],
  prefixes: Object.fromEntries(PC.map(([k, region, voivodeship, lat, lng]) => [k, { region, voivodeship, lat, lng }])),
};

// ---------------------------------------------------------------------------
// Sklepy partnerskie (fikcyjne; więcej na Podkarpaciu i w dużych miastach)
// ---------------------------------------------------------------------------
const RS = [
  // Podkarpacie
  ['Rzeszów', 'Słocina', '35-326', 50.052, 22.055, 'podkarpackie', 'P'],
  ['Rzeszów', 'Zachód', '35-060', 50.033, 21.968, 'podkarpackie', 'P'],
  ['Kolbuszowa', null, '36-100', 50.244, 21.776, 'podkarpackie', 'P'],
  ['Mielec', null, '39-300', 50.287, 21.424, 'podkarpackie', 'P'],
  ['Dębica', null, '39-200', 50.051, 21.411, 'podkarpackie', 'P'],
  ['Krosno', null, '38-400', 49.689, 21.770, 'podkarpackie', 'P'],
  ['Jasło', null, '38-200', 49.745, 21.472, 'podkarpackie', 'P'],
  ['Sanok', null, '38-500', 49.557, 22.205, 'podkarpackie', 'P'],
  ['Przemyśl', null, '37-700', 49.784, 22.768, 'podkarpackie', 'P'],
  ['Jarosław', null, '37-500', 50.016, 22.678, 'podkarpackie', 'P'],
  ['Stalowa Wola', null, '37-450', 50.583, 22.054, 'podkarpackie', 'P'],
  ['Tarnobrzeg', null, '39-400', 50.573, 21.679, 'podkarpackie', 'P'],
  ['Łańcut', null, '37-100', 50.069, 22.230, 'podkarpackie', 'P'],
  // duże miasta
  ['Warszawa', 'Bemowo', '01-494', 52.247, 20.912, 'mazowieckie', 'B'],
  ['Warszawa', 'Białołęka', '03-289', 52.318, 21.003, 'mazowieckie', 'B'],
  ['Warszawa', 'Mokotów', '02-675', 52.180, 21.003, 'mazowieckie', 'B'],
  ['Kraków', 'Bronowice', '30-394', 50.081, 19.885, 'małopolskie', 'B'],
  ['Kraków', 'Czyżyny', '31-564', 50.071, 20.001, 'małopolskie', 'B'],
  ['Wrocław', 'Fabryczna', '54-204', 51.121, 16.950, 'dolnośląskie', 'B'],
  ['Wrocław', 'Krzyki', '50-541', 51.081, 17.026, 'dolnośląskie', 'B'],
  ['Poznań', 'Grunwald', '60-185', 52.393, 16.866, 'wielkopolskie', 'B'],
  ['Poznań', 'Nowe Miasto', '61-315', 52.401, 16.990, 'wielkopolskie', 'B'],
  ['Łódź', null, '93-457', 51.735, 19.452, 'łódzkie', 'B'],
  ['Gdańsk', null, '80-298', 54.378, 18.567, 'pomorskie', 'B'],
  ['Gdynia', null, '81-537', 54.475, 18.520, 'pomorskie', 'B'],
  ['Szczecin', null, '70-814', 53.393, 14.636, 'zachodniopomorskie', 'B'],
  ['Katowice', null, '40-750', 50.226, 18.995, 'śląskie', 'B'],
  ['Lublin', null, '20-468', 51.224, 22.553, 'lubelskie', 'B'],
  ['Bydgoszcz', null, '85-791', 53.146, 18.071, 'kujawsko-pomorskie', 'B'],
  ['Białystok', null, '15-660', 53.115, 23.198, 'podlaskie', 'B'],
  // pozostałe
  ['Kielce', null, '25-116', 50.867, 20.664, 'świętokrzyskie', 'O'],
  ['Tarnów', null, '33-100', 50.012, 20.986, 'małopolskie', 'O'],
  ['Nowy Sącz', null, '33-300', 49.622, 20.697, 'małopolskie', 'O'],
  ['Opole', null, '45-325', 50.669, 17.952, 'opolskie', 'O'],
  ['Częstochowa', null, '42-200', 50.812, 19.120, 'śląskie', 'O'],
  ['Toruń', null, '87-100', 53.014, 18.598, 'kujawsko-pomorskie', 'O'],
  ['Olsztyn', null, '10-685', 53.759, 20.497, 'warmińsko-mazurskie', 'O'],
  ['Zielona Góra', null, '65-120', 51.936, 15.506, 'lubuskie', 'O'],
  ['Koszalin', null, '75-136', 54.194, 16.172, 'zachodniopomorskie', 'O'],
  ['Radom', null, '26-600', 51.403, 21.147, 'mazowieckie', 'O'],
  ['Zamość', null, '22-400', 50.723, 23.252, 'lubelskie', 'O'],
  ['Bielsko-Biała', null, '43-300', 49.822, 19.058, 'śląskie', 'O'],
  ['Płock', null, '09-400', 52.547, 19.706, 'mazowieckie', 'O'],
  ['Kalisz', null, '62-800', 51.761, 18.091, 'wielkopolskie', 'O'],
  ['Siedlce', null, '08-110', 52.168, 22.290, 'mazowieckie', 'O'],
];
const HOURS = [
  'pon.–pt. 10:00–18:00, sob. 9:00–14:00',
  'pon.–pt. 9:00–17:00, sob. 9:00–13:00',
  'pon.–sob. 10:00–20:00, niedziele handlowe 10:00–18:00',
  'pon.–pt. 10:00–19:00, sob. 10:00–15:00',
];
const collSlugs = COLLECTIONS.map(c => c.slug);
const resellers = RS.map(([city, district, postcode, lat, lng, voivodeship, kind], i) => {
  const r = rng(`reseller|${city}|${district}`);
  const [kMin, kMax] = kind === 'O' ? [3, 6] : [5, 8];
  const k = kMin + Math.floor(r() * (kMax - kMin + 1));
  const shuffled = collSlugs.map(s => [r(), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const collections = shuffled.slice(0, k).sort((a, b) => collSlugs.indexOf(a) - collSlugs.indexOf(b));
  const where = district ? `${city}, ${district}` : city;
  return {
    id: `rs-${slugify(where)}`,
    name: `Salon partnerski Liveo — ${where} (dane przykładowe)`,
    address: `ul. Przykładowa ${1 + Math.floor(r() * 120)}`,
    city,
    district,
    postcode,
    voivodeship,
    lat: round(lat + (r() - 0.5) * 0.02, 4),
    lng: round(lng + (r() - 0.5) * 0.03, 4),
    phone: null,
    email: null,
    collections,
    services: { montaz: r() < 0.6, dostawa: r() < 0.8, ekspozycja: kind === 'P' || r() < 0.75 },
    openingHours: HOURS[(i + Math.floor(r() * HOURS.length)) % HOURS.length],
    demo: true,
  };
});
// każda kolekcja w co najmniej 10 sklepach (dokładamy w kolejności listy)
for (const slug of collSlugs) {
  for (const r of resellers) {
    if (resellers.filter(x => x.collections.includes(slug)).length >= 10) break;
    if (!r.collections.includes(slug)) {
      r.collections.push(slug);
      r.collections.sort((a, b) => collSlugs.indexOf(a) - collSlugs.indexOf(b));
    }
  }
}

// ---------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------
const collections = COLLECTIONS.map((c, i) => ({
  slug: c.slug,
  name: c.name,
  tagline: c.tagline,
  description: c.description,
  style: c.style,
  rooms: c.rooms,
  heroRoom: c.heroRoom,
  handle: c.handle,
  base: c.base,
  finishes: c.finishes,
  isNew: !!c.isNew,
  order: i + 1,
  demo: true,
}));

const data = { finishes: FINISHES, types: TYPES, rooms: ROOMS, collections, products, promotions, postcodes, resellers };
const errors = validateData(data, TODAY);
if (errors.length) {
  console.error(`Błędy spójności (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const meta = {
  demo: true,
  note: 'Dane demonstracyjne — fikcyjne kolekcje, meble, ceny, promocje i sklepy. Docelowo: ERP Navireo + arkusz Excel klienta.',
  generatedFor: TODAY,
  seed: SEED,
  generator: 'tools/data/generate.mjs',
  counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : Object.keys(v.prefixes).length])),
  variants: products.reduce((a, p) => a + p.variants.length, 0),
};

mkdirSync(OUT, { recursive: true });
for (const [name, value] of Object.entries({ ...data, meta })) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
console.log(`Zapisano do ${OUT}:`);
for (const [k, v] of Object.entries(meta.counts)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log(`  ${'warianty'.padEnd(12)} ${meta.variants}`);
