#!/usr/bin/env node
// Generator danych strony Liveo Meble: PRAWDZIWY katalog z kart produktu Liveo + salony partnerskie.
//
//   node tools/data/generate.mjs [--today=2026-10-28] [--out=src/data]
//
// Źródła (oba w repozytorium, odświeżane osobnymi skryptami):
//   tools/data/karty-liveo.json   ← tools/data/import-karty.py (karty produktu xlsx z eksportu Navireo, Drive Liveo)
//   tools/data/salony-liveo.json  ← lista salonów z liveomeble.pl/salony-partnerskie
//   public/katalog/manifest.json  ← tools/data/fetch-images.mjs (zdjęcia z serwera Liveo, WebP)
// Karty nie mają cen detalicznych ani stanów magazynowych — strona ich nie pokazuje (cena w salonie partnerskim).
// Bez zależności — tylko Node (ESM). Wynik jest deterministyczny dla tych samych plików źródłowych.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const OUT = resolve(ROOT, args.out || 'src/data');
const KARTY = JSON.parse(readFileSync(join(ROOT, 'tools/data/karty-liveo.json'), 'utf8'));
const TODAY = args.today || KARTY.imported;
const IMAGES = existsSync(join(ROOT, 'public/katalog/manifest.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'public/katalog/manifest.json'), 'utf8'))
  : {};

// ---------------------------------------------------------------------------
// Narzędzia
// ---------------------------------------------------------------------------
const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const slugify = s => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const joinPl = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} i ${list.at(-1)}`);
const https = u => (u ? u.replace(/^http:\/\//, 'https://') : u);
/** Zdjęcie z manifestu (pobrane i przeskalowane) — albo null, gdy go nie ma. */
const image = u => {
  let e = u && IMAGES[https(u)];
  while (e?.alias) e = IMAGES[e.alias];
  return e ? { base: `/katalog/${e.key}`, widths: e.widths, w: e.w, h: e.h } : null;
};
/** „PŁYTA WIÓROWA 16MM” → „płyta wiórowa 16 mm”; zachowuje skróty (LED, HDF, MDF). */
const tidy = v => String(v).trim().replace(/\s+/g, ' ').replace(/(\d)\s*(MM|CM)\b/gi, (_, n, u) => `${n} ${u.toLowerCase()}`)
  .toLowerCase().replace(/\b(led|hdf|mdf|abs|pcv|pvc|rtv)\b/g, s => s.toUpperCase()).replace(/\s*\(\s*/g, ' (').replace(/\s+,/g, ',');
const num = n => String(Math.round(n * 10) / 10).replace('.', ',');

// ---------------------------------------------------------------------------
// Pomieszczenia (stałe strony). Kuchnia: zestawy kuchenne TIFFANY.
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
    description: 'Biurka, łóżka, regały, komody i szafy do pokoju nastolatka.' },
  { slug: 'przedpokoj', name: 'Przedpokój', shortName: 'Przedpokój', genitive: 'przedpokoju', accusative: 'przedpokój',
    locative: 'w przedpokoju', assistantKey: 'przedpokoj', description: 'Szafy, szafki na buty, wieszaki, lustra i komody do strefy wejścia.' },
  { slug: 'biuro', name: 'Domowe biuro', shortName: 'Biuro', genitive: 'domowego biura', accusative: 'domowe biuro',
    locative: 'w domowym biurze', assistantKey: 'biuro', description: 'Biurka, regały, komody i półki do pracy w domu.' },
  { slug: 'kuchnia', name: 'Kuchnia', shortName: 'Kuchnia', genitive: 'kuchni', accusative: 'kuchnię', locative: 'w kuchni',
    assistantKey: 'kuchnia', description: 'Gotowe zestawy kuchenne o długości od 180 do 260 cm.' },
].map((r, i) => ({ ...r, order: i + 1 }));

// ---------------------------------------------------------------------------
// Rodzaje mebli (stałe strony); pomieszczenia rodzaju liczone z kart (PRZEZNACZENIE).
// gender: rodzaj gramatyczny nazwy — do przymiotników („witryna niska”, „stół rozkładany”).
// ---------------------------------------------------------------------------
const TYPES = [
  ['rtv', 'Szafka RTV', 'Szafki RTV', 'szafek RTV', 'szafki-rtv', 'f'],
  ['komoda', 'Komoda', 'Komody', 'komód', 'komody', 'f'],
  ['witryna', 'Witryna', 'Witryny', 'witryn', 'witryny', 'f'],
  ['kredens', 'Kredens', 'Kredensy', 'kredensów', 'kredensy', 'm'],
  ['regal', 'Regał', 'Regały', 'regałów', 'regaly', 'm'],
  ['szafka', 'Szafka', 'Szafki', 'szafek', 'szafki', 'f'],
  ['polka', 'Półka', 'Półki', 'półek', 'polki', 'f'],
  ['lawa', 'Ława', 'Ławy', 'ław', 'lawy', 'f'],
  ['stol', 'Stół', 'Stoły', 'stołów', 'stoly', 'm'],
  ['lozko', 'Łóżko', 'Łóżka', 'łóżek', 'lozka', 'n'],
  ['szafka_nocna', 'Szafka nocna', 'Szafki nocne', 'szafek nocnych', 'szafki-nocne', 'f'],
  ['szafa', 'Szafa', 'Szafy', 'szaf', 'szafy', 'f'],
  ['toaletka', 'Toaletka', 'Toaletki', 'toaletek', 'toaletki', 'f'],
  ['lustro', 'Lustro', 'Lustra', 'luster', 'lustra', 'n'],
  ['biurko', 'Biurko', 'Biurka', 'biurek', 'biurka', 'n'],
  ['szafka_na_buty', 'Szafka na buty', 'Szafki na buty', 'szafek na buty', 'szafki-na-buty', 'f'],
  ['wieszak', 'Wieszak', 'Wieszaki', 'wieszaków', 'wieszaki', 'm'],
  ['kuchnia', 'Zestaw kuchenny', 'Zestawy kuchenne', 'zestawów kuchennych', 'zestawy-kuchenne', 'm'],
].map(([id, name, plural, genitivePlural, slug, gender], i) => ({ id, name, plural, genitivePlural, slug, gender, order: i + 1 }));
const T = Object.fromEntries(TYPES.map(t => [t.id, t]));

// ---------------------------------------------------------------------------
// Dekory (kolory płyt) z kart. hex = kolor próbki w interfejsie (poglądowy, dobrany do zdjęć produktów).
// ---------------------------------------------------------------------------
const DECOR_HEX = {
  'dąb cremona torro': '#b4895c', 'dąb cremona cotta': '#c49c6c', 'dąb cremona': '#b98f61', 'dąb evoke': '#c4a684',
  'dąb grandson': '#a8835a', 'dąb april': '#bc965f', 'dąb kamienny': '#a59584', 'dąb craft złoty': '#c18f4f',
  'dąb sonoma': '#c8a670', 'dąb sonoma truflowy': '#7c6047', 'dąb castello': '#8d6c4e', 'dąb nagano': '#c49f72',
  'dąb milano': '#b79770', 'dąb magia': '#b99b74', 'dąb': '#b58f62',
  'orzech': '#6b4a32', 'orzech ciemny': '#4f3527', 'orzech opera': '#6c4c36', 'orzech opera mat': '#6c4c36', 'wenge': '#3d2b22',
  'listwa drewno sosnowe': '#d3b184',
  'czarny': '#202020', 'czarny połysk': '#141414', 'grafit': '#3b3d40', 'antracyt mat': '#3d4044',
  'biały': '#f1f0ec', 'biały mat': '#efede8', 'biały połysk': '#fafafa', 'biel alpejska połysk': '#f7f6f1',
  'kaszmir': '#cdbfad', 'kaszmir mat': '#cbbca8', 'szary mat': '#9b9b97', 'szary połysk': '#a7a8a9',
  'zielony mat': '#5e6a54', 'beton': '#9c9a94',
};
const WOOD = /dąb|orzech|wenge|drewno/;
function lightness(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Math.round((y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y)) / 100;
}
const decorsUsed = new Set();
const partsOf = label => (label || '').toLowerCase().split(' / ').filter(Boolean);

// ---------------------------------------------------------------------------
// Katalog z kart produktu
// ---------------------------------------------------------------------------
/** Główne pomieszczenie rodzaju — gdy karta nie ma PRZEZNACZENIA i do przypisania aranżacji do pokoju. */
const TYPE_ROOM = {
  rtv: 'salon', komoda: 'salon', witryna: 'salon', kredens: 'jadalnia', regal: 'salon', szafka: 'salon', polka: 'salon',
  lawa: 'salon', stol: 'jadalnia', lozko: 'sypialnia', szafka_nocna: 'sypialnia', szafa: 'sypialnia', toaletka: 'sypialnia',
  lustro: 'przedpokoj', biurko: 'biuro', szafka_na_buty: 'przedpokoj', wieszak: 'przedpokoj', kuchnia: 'kuchnia',
};
const ADJ = [ // rodzaj w karcie → przymiotnik w nazwie (m, f, n)
  [/NISK/, ['niski', 'niska', 'niskie']], [/WYSOK/, ['wysoki', 'wysoka', 'wysokie']], [/NARO[ŻZ]/, ['narożny', 'narożna', 'narożne']],
  [/WISZ[ĄA]C/, ['wiszący', 'wisząca', 'wiszące']], [/RO[ZŹ]?[KŁ]?[ŁL]?ADAN/, ['rozkładany', 'rozkładana', 'rozkładane']],
];
const G = { m: 0, f: 1, n: 2 };
const MATERIAL_ROWS = [ // klucze z karty → wiersze specyfikacji
  ['Korpus', m => [m.body, m.bodyFinish]],
  ['Fronty', m => [m.front, m.frontFinish]],
  ['Blat', m => [m.top, m.topFinish, m.topColor]],
  ['Blat stołu / ławy', m => [!m.top && m.tableTop]],
  ['Plecy (część widoczna)', m => [m.backFinish, m.backColor]],
  ['Półki', m => [m.shelfQty && `${m.shelfQty} szt.`, m.shelf, m.shelfLoad && `obciążenie do ${m.shelfLoad} kg`]],
  ['Półki szklane', m => [m.glassShelfQty && `${m.glassShelfQty} szt.`, m.glassShelf, m.glassShelfMm, m.glassShelfLoad && `obciążenie do ${m.glassShelfLoad} kg`]],
  ['Przeszklenie frontu', m => [m.glassFront, m.glassFrontMm]],
  ['Lustro', m => [m.mirror && `${m.mirror} mm`]],
  ['Wyposażenie szafy', m => [m.wardrobe]],
  ['Szuflady', m => [m.drawers && `${m.drawers} szt.`, m.runners && `prowadnice ${tidy(m.runners)}`, m.drawerBottom && `dno: ${tidy(m.drawerBottom)}`]],
  ['Uchwyty', m => [m.handle]],
  ['Nóżki', m => [m.legs, m.legH && `wysokość ${m.legH} cm`]],
  ['Cokół', m => [m.plinth, m.plinthFinish]],
  ['Oświetlenie LED', m => [m.light && (/OPCJ/i.test(m.light) ? 'w opcji' : /STANDARD/i.test(m.light) ? 'w standardzie' : m.light), m.lightType]],
  ['Rama łóżka', m => [m.bedFrame]],
  ['Pojemnik na pościel', m => [m.bedStorage]],
  ['Stelaż', m => [m.slats, m.slatsMaterial, m.slatsType]],
  ['Rozkładany', m => [m.extendable]],
  ['Mechanizm rozkładania', m => [m.tableRunner]],
];
const clean = v => (v == null || v === '' ? null : tidy(v).replace(/^\(|\)$/g, '').replace(/\s*\($/, ''));
function specsOf(m) {
  const rows = [];
  for (const [label, get] of MATERIAL_ROWS) {
    const vals = [...new Set(get(m).map(clean).filter(v => v && !/^(nie|-|brak)$/i.test(v)))];
    if (vals.length) rows.push({ label, value: cap(vals.join(', ')) });
  }
  return rows;
}

/** Zdania o kolekcji z opisów marketingowych: o kolorach, stylu i całej serii — bez zdań o jednej bryle. */
const PIECE = /(^|[\s,(])(szaf\S*|komod\S*|witryn\S*|kredens\S*|rega\S*|łó[żz]\S*|ło[żz]\S*|ław\S*|st[óo]ł\S*|półk\S*|biurk\S*|toaletk\S*|lustr\S*|mebel|mebla|bryła|bryłami|bryły|wieszak\S*|kontenerek)|sprawdzi się w (konfiguracji|kompozycji)|pojedynczy|szuflad|drzwi|wnęk|\bcm\b|\b[A-Z]{1,3}-?\d{1,2}\b/i;
const ABOUT = /kolekcj|seri|kolor|dekor|odcie|drewn|front|połysk|biel|dąb|dęb|orzech|czarn|grafit/i;
// zdania, które opisują jedną bryłę bez jej nazwy („To…”, „Stanowi…”, „Jej kolor…”) albo jej wyposażenie
const PRONOUN_START = /^(To |Stanowi|Dzięki swo|Można|Do |Jej |Jego |Ich |Ustawion|Wykonan|Na |Przeszklen|Górne|Duża|Częściowo|Istnieje|Postaw|Dodaj)/;
function collectionSentences(descs, name) {
  const count = new Map();
  for (const d of descs) {
    for (const s of (d || '').split(/(?<=[.!])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/)) {
      const t = s.trim().replace(/\s+/g, ' ');
      if (t.length < 50 || t.length > 240 || !/[.!]$/.test(t)) continue;
      if (PIECE.test(t) || !ABOUT.test(t) || PRONOUN_START.test(t) || /\b(the|and|with)\b/i.test(t)) continue;
      count.set(t, (count.get(t) || 0) + 1);
    }
  }
  const out = [];
  for (const [s] of [...count].sort((a, b) => (new RegExp(name, 'i').test(b[0]) - new RegExp(name, 'i').test(a[0])) || b[1] - a[1] || a[0].length - b[0].length)) {
    // bez powtórzeń tej samej myśli innymi słowami (wspólne ≥ 50% słów)
    const words = x => new Set(x.toLowerCase().match(/[\p{L}]{4,}/gu));
    const ws = words(s);
    if (!out.some(x => [...words(x)].filter(w => ws.has(w)).length >= 0.5 * Math.min(ws.size, words(x).size))) out.push(s);
  }
  return out;
}

const mostCommon = list => [...list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0];
const collMap = new Map();
for (const k of KARTY.products) {
  if (!collMap.has(k.collection)) collMap.set(k.collection, []);
  collMap.get(k.collection).push(k);
}

const products = [];
const decorId = d => { decorsUsed.add(d); return slugify(d); };
for (const [collName, list] of collMap) {
  const collSlug = slugify(collName);
  for (const k of list) {
    const t = T[k.type];
    const kind = (k.kind || '').toUpperCase();
    let base = t.name;
    if (/[ŁL]AWOST[ÓO][ŁL]/.test(kind)) base = 'Ławostół';
    for (const [rx, forms] of ADJ) if (rx.test(kind) && k.type !== 'lozko') { base += ` ${forms[G[t.gender]]}`; break; }
    let name;
    if (k.type === 'lozko') {
      const ver = k.bed.storage ? ' z pojemnikiem' : !k.bed.slats ? ' bez stelaża' : '';
      name = `Łóżko${k.bed.size ? ` ${k.bed.size}` : ''}${ver} ${collName} ${k.model}`;
    } else if (k.type === 'kuchnia') {
      name = `Zestaw kuchenny ${collName} ${k.kitchenLength} cm`;
    } else {
      name = `${base} ${collName} ${k.model}`;
    }

    // wymiary: stoły i ławy — długość × szerokość × wysokość (w kartach długość bywa w osobnej kolumnie)
    let { w, h, d, len } = k.dims;
    if (k.type === 'stol' || k.type === 'lawa') {
      if (len) { if (!h && d) { h = d; d = undefined; } d = w && w < len ? w : d; w = len; }
      else if (w && d && d > w) [w, d] = [d, w];
    }
    if (k.type === 'kuchnia') w = k.kitchenLength;
    const dims = Object.fromEntries(Object.entries({ w, h, d }).filter(([, v]) => v));

    const seen = new Set();
    const variants = k.variants.map(v => {
      const parts = partsOf(v.label);
      let code = slugify(v.label || 'standard');
      while (seen.has(code)) code += '-2';
      seen.add(code);
      const photo = v.photos.map(image).find(Boolean) ?? null;
      const scene = v.arrangements.map(image).find(Boolean) ?? null;
      return {
        code, sku: v.symbol, ean: v.ean, colorLabel: v.label || 'Standard',
        finish: { body: parts[0] ? decorId(parts[0]) : null, front: decorId(parts[1] ?? parts[0] ?? 'dąb'), accent: parts[2] ? decorId(parts[2]) : null },
        images: { packshot: photo ?? scene, packshotIsScene: !photo && !!scene },
        // dodatkowe zdjęcia z karty (do 3, pobrane lokalnie); brakujące na serwerze Liveo pomijamy
        gallery: v.photos.slice(1, 4).map(image).filter(Boolean),
        description: v.description || null,
      };
    });

    const packages = k.packages.filter(x => x.w || x.ean);
    const grossKg = packages.reduce((a, x) => a + (x.kg || 0), 0);
    const rooms = k.rooms.length ? k.rooms : [TYPE_ROOM[k.type]];
    const def = variants.find(v => v.images.packshot && !v.images.packshotIsScene) ?? variants.find(v => v.images.packshot) ?? variants[0];
    // wariant bez własnego zdjęcia i bez aranżacji (np. zestaw kuchenny w innym kolorze) → zdjęcie innego wariantu, poglądowo
    for (const v of variants) if (!v.images.packshot && def.images.packshot) v.images = { packshot: def.images.packshot, packshotIsScene: true };
    products.push({
      id: slugify(name), sku: k.model, slug: slugify(name), name, collection: collSlug, type: k.type,
      kindLabel: cap(tidy(k.kind || t.name)), layout: k.layout || null, rooms,
      dims, weightKg: k.netKg != null ? Math.round(k.netKg * 100) / 100 : null, grossKg: k.grossKg ?? (grossKg ? Math.round(grossKg * 10) / 10 : null),
      variants: [def, ...variants.filter(v => v !== def)],
      description: def.description ?? variants.find(v => v.description)?.description ?? null,
      specs: specsOf(k.materials),
      delivery72: k.delivery72,
      assembly: /SAMODZIELN/i.test(k.assembly || '') ? 'do samodzielnego montażu' : k.assembly ? tidy(k.assembly) : null,
      equipment: k.equipment ? tidy(k.equipment) : null,
      packages: packages.map(x => ({ ean: x.ean ?? null, w: x.w ?? null, h: x.h ?? null, d: x.d ?? null, kg: x.kg ?? null })),
      drawing: image(k.drawing),
      documents: { instruction: https(k.instruction), animation: https(k.animation), drawing: image(k.drawing) ? null : https(k.drawing) },
      bed: k.bed ?? null, kitchenLength: k.kitchenLength ?? null,
      style: k.style === 'glamour' ? 'glamour' : 'nowoczesny',
      images: { packshot: def.images.packshot },
      isNew: false, bestseller: false, demo: false,
    });
  }
}
// unikalne slugi (np. ta sama ława w dwóch kolekcjach ma różne nazwy, ale na wszelki wypadek)
const slugs = new Map();
for (const p of products) {
  const n = (slugs.get(p.slug) || 0) + 1;
  slugs.set(p.slug, n);
  if (n > 1) p.slug = p.id = `${p.slug}-${n}`;
}

// Kolekcje: kolory, pomieszczenia, aranżacje (z pokojem), opis ze zdań wspólnych dla kolekcji
const collections = [...collMap.keys()].map(collName => {
  const slug = slugify(collName);
  const items = products.filter(p => p.collection === slug);
  const finishCount = new Map();
  for (const p of items) for (const v of p.variants) {
    const e = finishCount.get(v.code) || { code: v.code, label: v.colorLabel, ...v.finish, n: 0 };
    e.n++;
    finishCount.set(v.code, e);
  }
  const finishes = [...finishCount.values()].sort((a, b) => b.n - a.n).map(({ n, ...f }) => f);
  const roomCount = new Map();
  for (const p of items) for (const r of p.rooms) roomCount.set(r, (roomCount.get(r) || 0) + 1);
  const collRooms = ROOMS.map(r => r.slug).filter(r => roomCount.has(r)).sort((a, b) => roomCount.get(b) - roomCount.get(a));
  // aranżacja → pomieszczenie: najczęstsze główne pomieszczenie mebli, które ją podają w karcie
  const arrRoom = new Map();
  for (const k of collMap.get(collName)) for (const v of k.variants) for (const a of v.arrangements) {
    const m = arrRoom.get(https(a)) || new Map();
    const r = TYPE_ROOM[k.type];
    m.set(r, (m.get(r) || 0) + 1);
    arrRoom.set(https(a), m);
  }
  const arrangements = (KARTY.arrangements[collName] || []).map(https).map(u => {
    const img = image(u);
    if (!img) return null;
    const votes = [...(arrRoom.get(u) || new Map())].sort((a, b) => b[1] - a[1]);
    return { ...img, url: u, room: votes[0]?.[0] ?? collRooms[0] };
  }).filter(Boolean);
  const descs = collMap.get(collName).flatMap(k => k.variants.map(v => v.description));
  const sentences = collectionSentences(descs, collName);
  const top = finishes[0];
  const multi = finishes.filter(f => partsOf(f.label).length > 1);
  const shared = multi.length > 2 && multi.every(f => partsOf(f.label)[0] === partsOf(multi[0].label)[0]) ? partsOf(multi[0].label)[0] : null;
  const colorPhrase = shared ? `${shared} i fronty w ${multi.length} kolorach` : joinPl(partsOf(top?.label));
  const n = items.length;
  const meble = n === 1 ? 'mebel' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'meble' : 'mebli';
  const roomGen = collRooms.slice(0, 3).map(r => ROOMS.find(x => x.slug === r).genitive);
  return {
    slug, name: collName,
    tagline: `${cap(colorPhrase)}. ${n} ${meble} do ${joinPl(roomGen)}.`,
    description: sentences.slice(0, 2).join(' ')
      || `Kolekcja ${collName} to ${n} ${meble} do ${joinPl(collRooms.map(r => ROOMS.find(x => x.slug === r).genitive))} w kolorach: ${joinPl(finishes.map(f => f.label.toLowerCase()))}.`,
    style: items.some(p => p.style === 'glamour') ? 'glamour' : 'nowoczesny',
    rooms: collRooms, heroRoom: mostCommon(arrangements.map(a => a.room)) ?? collRooms[0], finishes, arrangements,
    productCount: n, isNew: false, demo: false,
  };
});
// kolejność: najszersze kolekcje (najwięcej wariantów) i z aranżacjami najpierw
collections.sort((a, b) => (b.arrangements.length > 0) - (a.arrangements.length > 0)
  || products.filter(p => p.collection === b.slug).reduce((s, p) => s + p.variants.length, 0) - products.filter(p => p.collection === a.slug).reduce((s, p) => s + p.variants.length, 0)
  || a.name.localeCompare(b.name, 'pl'));
collections.forEach((c, i) => { c.order = i + 1; });

const types = TYPES.filter(t => products.some(p => p.type === t.id)).map(t => ({
  ...t, rooms: ROOMS.map(r => r.slug).filter(r => products.some(p => p.type === t.id && p.rooms.includes(r))),
}));
const FINISHES = [...decorsUsed].sort().map(label => {
  const hex = DECOR_HEX[label];
  if (!hex) throw new Error(`Brak próbki koloru dla dekoru „${label}” (DECOR_HEX w generate.mjs)`);
  return { id: slugify(label), label: cap(label), group: 'board', hex, wood: WOOD.test(label), light: lightness(hex), gloss: /połysk/.test(label) };
});
const promotions = [];

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
  ['08', 'Siedlce, Garwolin, Sokołów Podlaski, Łosice', 'mazowieckie', 52.050, 22.100],
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
  ['21', 'Okolice Lublina, Biała Podlaska, Lubartów, Radzyń Podlaski, Łuków', 'lubelskie', 51.650, 22.800],
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
  ['32', 'Okolice Krakowa, Olkusz, Chrzanów, Oświęcim, Bochnia, Wieliczka, Myślenice', 'małopolskie', 50.100, 19.800],
  ['33', 'Tarnów, Nowy Sącz, Dąbrowa Tarnowska', 'małopolskie', 49.850, 20.850],
  ['34', 'Nowy Targ, Zakopane, Wadowice, Żywiec, Limanowa, Sucha Beskidzka', 'małopolskie', 49.650, 19.800],
  ['35', 'Rzeszów', 'podkarpackie', 50.041, 21.999],
  ['36', 'Okolice Rzeszowa, Kolbuszowa, Brzozów, Głogów Małopolski', 'podkarpackie', 50.000, 21.900],
  ['37', 'Przemyśl, Jarosław, Przeworsk, Łańcut, Leżajsk, Stalowa Wola, Nisko, Lubaczów', 'podkarpackie', 50.200, 22.500],
  ['38', 'Krosno, Jasło, Sanok, Gorlice, Strzyżów, Lesko, Ustrzyki Dolne', 'podkarpackie', 49.600, 21.900],
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
// Sklepy partnerskie: prawdziwa lista z liveomeble.pl/salony-partnerskie (tools/data/salony-liveo.json).
// Oficjalna strona nie podaje, które kolekcje ma salon — każdy salon dostaje wszystkie (ofertę potwierdza salon).
// ---------------------------------------------------------------------------
const SALONY = JSON.parse(readFileSync(join(ROOT, 'tools/data/salony-liveo.json'), 'utf8')).stores;
const collSlugs = collections.map(c => c.slug);
const resellers = SALONY.map(s => ({
  id: `rs-${s.id}`,
  name: s.name,
  address: s.street,
  city: s.city,
  district: null,
  postcode: s.postcode,
  voivodeship: s.voivodeship,
  lat: s.lat,
  lng: s.lng,
  phone: null,
  email: null,
  collections: collSlugs,
  services: {},
  openingHours: null,
  demo: false,
}));

// ---------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------
const data = { finishes: FINISHES, types, rooms: ROOMS, collections, products, promotions, postcodes, resellers };
const errors = validateData(data, TODAY);
if (errors.length) {
  console.error(`Błędy spójności (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const meta = {
  demo: false,
  note: 'Katalog z kart produktu Liveo (eksport Navireo, Drive „karty produktu dla białegostoku”), salony z liveomeble.pl. Bez cen i stanów — karty ich nie zawierają.',
  generatedFor: TODAY,
  source: KARTY.source,
  generator: 'tools/data/generate.mjs',
  counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : Object.keys(v.prefixes).length])),
  variants: products.reduce((a, p) => a + p.variants.length, 0),
  withoutPhoto: products.filter(p => !p.images.packshot).map(p => p.slug),
};

mkdirSync(OUT, { recursive: true });
for (const [name, value] of Object.entries({ ...data, meta })) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
console.log(`Zapisano do ${OUT}:`);
for (const [k, v] of Object.entries(meta.counts)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log(`  ${'warianty'.padEnd(12)} ${meta.variants}`);
if (meta.withoutPhoto.length) console.log(`  bez zdjęcia: ${meta.withoutPhoto.length} (${meta.withoutPhoto.slice(0, 5).join(', ')}…)`);
