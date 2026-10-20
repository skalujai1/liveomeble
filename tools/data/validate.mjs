// Sprawdzanie spójności danych demo (src/data/*.json).
// Używane przez generate.mjs (przerywa przy błędzie) i data.test.mjs.

import { priceFor, warsawISO } from '../../src/lib/pricing.js';

export const KINDS = ['cabinet', 'bed', 'table', 'coffeeTable', 'desk', 'wallShelf', 'mirror', 'coatRack'];
export const BASES = ['plinth', 'legsMetal', 'legsWood', 'hanging', 'frame'];
export const CELLS = ['drawer', 'door', 'doorGlass', 'open', 'flap'];
export const HANDLES = ['bar', 'knob', 'groove', 'push', 'edge'];
export const STOCK = ['dostepny', 'na-zamowienie', 'wyprzedany'];

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** Błędy modelu 3D względem kontraktu (pusta lista = OK). */
export function validateModel3d(m, { boards, metals }, where = 'model3d') {
  const e = [];
  const err = msg => e.push(`${where}: ${msg}`);
  if (!m || typeof m !== 'object') return [`${where}: brak modelu`];
  if (!KINDS.includes(m.kind)) err(`nieznany kind "${m.kind}"`);
  for (const k of ['w', 'h', 'd']) if (!isNum(m[k]) || m[k] <= 0) err(`wymiar ${k} nieprawidłowy`);
  if (!BASES.includes(m.base)) err(`nieznana podstawa "${m.base}"`);
  if (!isNum(m.legH) || m.legH < 0 || m.legH >= m.h) err('legH nieprawidłowe');
  if (m.base === 'hanging' && m.legH !== 0) err('wiszący mebel z legH ≠ 0');
  if (m.base === 'hanging' && !(isNum(m.mountH) && m.mountH >= 0)) err('wiszący mebel bez mountH');
  const f = m.finish || {};
  if (!boards.has(f.body)) err(`finish.body "${f.body}" nie istnieje`);
  if (!boards.has(f.front)) err(`finish.front "${f.front}" nie istnieje`);
  if (f.top != null && !boards.has(f.top)) err(`finish.top "${f.top}" nie istnieje`);
  if (f.legs != null && !boards.has(f.legs)) err(`finish.legs "${f.legs}" nie istnieje`);
  if (!metals.has(f.metal)) err(`finish.metal "${f.metal}" nie istnieje`);

  if (m.kind === 'cabinet' || m.kind === 'desk') {
    if (!HANDLES.includes(m.handle)) err(`nieznany uchwyt "${m.handle}"`);
    if (!Array.isArray(m.columns) || !m.columns.length) err('brak kolumn');
    for (const [i, c] of (m.columns || []).entries()) {
      if (!isNum(c.w) || c.w <= 0) err(`kolumna ${i}: w nieprawidłowe`);
      if (!Array.isArray(c.cells) || !c.cells.length) { err(`kolumna ${i}: brak cells`); continue; }
      for (const cell of c.cells) {
        if (!CELLS.includes(cell.t)) err(`kolumna ${i}: nieznany element "${cell.t}"`);
        if (!isNum(cell.h) || cell.h <= 0) err(`kolumna ${i}: h elementu nieprawidłowe`);
      }
    }
    if (m.kind === 'desk') {
      // biurko/toaletka: columns opisują kontener o szerokości `pedestal` cm; reszta to miejsce na nogi
      if (!isNum(m.pedestal) || m.pedestal < 25 || m.w - m.pedestal < 50) err('pedestal poza zakresem (min. 50 cm na nogi)');
      if (!['left', 'right'].includes(m.pedestalSide)) err('pedestalSide: left | right');
      if (m.drawerH != null && !(isNum(m.drawerH) && m.drawerH > 0 && m.drawerH < 20)) err('drawerH poza zakresem');
    }
  } else if (m.columns) err('kolumny tylko dla cabinet/desk');

  if (['table', 'coffeeTable', 'desk'].includes(m.kind)) {
    if (!isNum(m.top) || m.top < 1.5 || m.top > 5) err('grubość blatu poza 1,5–5 cm');
    if (isNum(m.top) && Math.abs(m.legH - (m.h - m.top)) > 0.01) err('legH ≠ h − top');
  }
  if (m.kind === 'bed') {
    if (!isNum(m.headboardH) || m.headboardH <= 0) err('brak headboardH');
    const mm = m.mattress;
    if (!Array.isArray(mm) || mm.length !== 2 || !mm.every(isNum)) err('mattress jako [szerokość, długość] w cm');
    else if (mm[0] >= m.w || mm[1] >= m.d) err('materac większy niż rama');
    if (typeof m.upholstered !== 'boolean') err('upholstered: true | false');
  }
  if (m.kind === 'mirror') {
    if (!isNum(m.frame) || m.frame <= 0) err('brak szerokości ramy');
    if (!['rect', 'arch'].includes(m.shape)) err(`nieznany kształt lustra "${m.shape}"`);
  }
  if (m.kind === 'wallShelf' && !(Number.isInteger(m.shelves) && m.shelves >= 1 && isNum(m.top))) err('półka: shelves i top');
  if (['wallShelf', 'mirror', 'coatRack'].includes(m.kind) && m.base !== 'hanging') err('mebel ścienny musi mieć base "hanging"');
  return e;
}

/**
 * Pełna kontrola spójności.
 * @param {object} data { finishes, types, rooms, collections, products, promotions, postcodes, resellers }
 * @param {string} today "YYYY-MM-DD" — dzień, dla którego wygenerowano dane
 */
export function validateData(data, today) {
  const e = [];
  const { finishes, types, rooms, collections, products, promotions, postcodes, resellers } = data;
  const boards = new Set(finishes.filter(f => f.group === 'board').map(f => f.id));
  const metals = new Set(finishes.filter(f => f.group === 'metal').map(f => f.id));
  const typeMap = new Map(types.map(t => [t.id, t]));
  const roomSet = new Set(rooms.map(r => r.slug));
  const collMap = new Map(collections.map(c => [c.slug, c]));

  if (collections.length !== 8) e.push(`oczekiwano 8 kolekcji, jest ${collections.length}`);
  for (const c of collections) {
    if (!c.rooms.every(r => roomSet.has(r))) e.push(`kolekcja ${c.slug}: nieznane pomieszczenie`);
    if (!roomSet.has(c.heroRoom) || !c.rooms.includes(c.heroRoom)) e.push(`kolekcja ${c.slug}: heroRoom spoza rooms`);
    if (c.finishes.length < 2 || c.finishes.length > 3) e.push(`kolekcja ${c.slug}: ${c.finishes.length} wariantów kolorystycznych`);
    for (const p of c.finishes) {
      for (const k of ['body', 'front', 'top', 'legs']) if (p[k] != null && !boards.has(p[k])) e.push(`kolekcja ${c.slug}/${p.code}: ${k}`);
      if (!metals.has(p.metal)) e.push(`kolekcja ${c.slug}/${p.code}: metal`);
    }
    const n = products.filter(p => p.collection === c.slug).length;
    if (n < 8 || n > 13) e.push(`kolekcja ${c.slug}: ${n} mebli (oczekiwano 8–13)`);
  }

  const ids = new Set();
  const skus = new Set();
  const slugs = new Set();
  const todayNoon = warsawISO(today, 12);
  for (const p of products) {
    const w = `produkt ${p.sku}`;
    for (const [set, v, label] of [[ids, p.id, 'id'], [skus, p.sku, 'sku'], [slugs, p.slug, 'slug']]) {
      if (set.has(v)) e.push(`${w}: zduplikowane ${label}`);
      set.add(v);
    }
    if (p.demo !== true) e.push(`${w}: brak demo: true`);
    const coll = collMap.get(p.collection);
    const type = typeMap.get(p.type);
    if (!coll) e.push(`${w}: nieznana kolekcja ${p.collection}`);
    if (!type) { e.push(`${w}: nieznany typ ${p.type}`); continue; }
    if (!/^LV-[A-Z]+-[A-Z]{3}\d{2,3}[A-Z]?$/.test(p.sku)) e.push(`${w}: format sku`);
    if (coll && !p.name.endsWith(` ${coll.name}`)) e.push(`${w}: nazwa bez nazwy kolekcji`);
    if (!p.rooms.length || !p.rooms.every(r => roomSet.has(r))) e.push(`${w}: pomieszczenia`);
    if (coll && !p.rooms.every(r => coll.rooms.includes(r))) e.push(`${w}: pomieszczenie spoza kolekcji`);
    const [min, max] = type.priceRange;
    if (!(p.basePrice >= min && p.basePrice <= max)) e.push(`${w}: cena ${p.basePrice} poza ${min}–${max}`);
    if (!Number.isInteger(p.basePrice)) e.push(`${w}: cena nie jest całkowita`);
    if (!(p.weightKg > 0)) e.push(`${w}: waga`);
    if (p.features.length < 3 || p.features.length > 5) e.push(`${w}: ${p.features.length} cech`);
    if (!p.description || p.description.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length < 2) e.push(`${w}: opis za krótki`);
    const m = p.model3d;
    e.push(...validateModel3d(m, { boards, metals }, `${w} model3d`));
    if (m && (m.w !== p.dims.w || m.h !== p.dims.h || m.d !== p.dims.d)) e.push(`${w}: dims ≠ model3d`);
    const okKinds = type.id === 'polka' ? ['wallShelf', 'cabinet'] : [type.kind];
    if (m && !okKinds.includes(m.kind)) e.push(`${w}: kind ${m.kind} nie pasuje do typu`);
    if (!p.variants?.length || p.variants.length > 3) e.push(`${w}: ${p.variants?.length} wariantów`);
    const codes = new Set();
    for (const v of p.variants || []) {
      if (codes.has(v.code)) e.push(`${w}: zduplikowany wariant ${v.code}`);
      codes.add(v.code);
      if (!STOCK.includes(v.stock)) e.push(`${w}/${v.code}: stan ${v.stock}`);
      if (v.images?.packshot !== `renders/products/${p.sku}--${v.code}.webp`) e.push(`${w}/${v.code}: ścieżka packshotu`);
      e.push(...validateModel3d({ ...m, finish: v.finish }, { boards, metals }, `${w}/${v.code} finish`)
        .filter(x => x.includes('finish')));
      if (!v.colorLabel) e.push(`${w}/${v.code}: brak colorLabel`);
    }
    if (p.variants?.[0]?.stock === 'wyprzedany') e.push(`${w}: domyślny wariant wyprzedany`);
    const h = p.priceHistory || [];
    if (!h.length) e.push(`${w}: brak historii cen`);
    for (let i = 1; i < h.length; i++) if (!(h[i - 1].date < h[i].date)) e.push(`${w}: historia cen nieposortowana`);
    if (h.length && h.at(-1).price !== priceFor(p, null, promotions, todayNoon).price) {
      e.push(`${w}: ostatnia cena w historii ≠ aktualna cena (${h.at(-1).price} vs ${priceFor(p, null, promotions, todayNoon).price})`);
    }
  }

  // promocje względem dnia generowania
  const now = Date.parse(todayNoon);
  const status = p => (Date.parse(p.startsAt) > now ? 'future' : Date.parse(p.endsAt) <= now ? 'expired' : 'active');
  const st = promotions.map(status);
  if (st.filter(s => s === 'active').length < 2) e.push('promocje: mniej niż 2 aktywne');
  if (!st.includes('future')) e.push('promocje: brak przyszłej');
  if (!st.includes('expired')) e.push('promocje: brak wygasłej');
  for (const p of promotions) {
    if (!['percent', 'fixedPrice'].includes(p.kind)) e.push(`promocja ${p.id}: kind`);
    if (!/[+-]\d{2}:\d{2}$/.test(p.startsAt) || !/[+-]\d{2}:\d{2}$/.test(p.endsAt)) e.push(`promocja ${p.id}: daty bez offsetu`);
    for (const c of p.scope.collections || []) if (!collMap.has(c)) e.push(`promocja ${p.id}: kolekcja ${c}`);
    for (const t of p.scope.types || []) if (!typeMap.has(t)) e.push(`promocja ${p.id}: typ ${t}`);
    for (const s of p.scope.skus || []) if (!skus.has(s)) e.push(`promocja ${p.id}: sku ${s}`);
  }

  // kody pocztowe
  const pref = postcodes.prefixes;
  for (const [k, v] of Object.entries(pref)) {
    if (!/^\d{2}$/.test(k)) e.push(`kody: zły prefiks ${k}`);
    if (!(v.lat > 49 && v.lat < 54.9 && v.lng > 14.1 && v.lng < 24.2)) e.push(`kody: ${k} poza Polską`);
    if (!v.region) e.push(`kody: ${k} bez regionu`);
  }

  // sklepy
  for (const r of resellers) {
    const w = `sklep ${r.id}`;
    if (r.demo !== true || !r.name.includes('(dane przykładowe)')) e.push(`${w}: brak oznaczenia demo`);
    if (!/^\d{2}-\d{3}$/.test(r.postcode)) e.push(`${w}: kod ${r.postcode}`);
    const c = pref[r.postcode.slice(0, 2)];
    if (!c) e.push(`${w}: prefiks ${r.postcode} nie istnieje`);
    else {
      const dKm = Math.hypot((r.lat - c.lat) * 111, (r.lng - c.lng) * 111 * Math.cos((r.lat * Math.PI) / 180));
      if (dKm > 110) e.push(`${w}: ${Math.round(dKm)} km od środka prefiksu ${r.postcode.slice(0, 2)}`);
    }
    if (r.phone !== null || r.email !== null) e.push(`${w}: kontakt powinien być null`);
    if (!r.collections.length || !r.collections.every(x => collMap.has(x))) e.push(`${w}: kolekcje`);
  }
  for (const c of collections) {
    const n = resellers.filter(r => r.collections.includes(c.slug)).length;
    if (n < 8) e.push(`kolekcja ${c.slug} tylko w ${n} sklepach`);
  }
  return e;
}
