// Sprawdzanie spójności danych strony (src/data/*.json): katalog z kart produktu Liveo + salony.
// Używane przez generate.mjs (przerywa przy błędzie) i data.test.mjs.

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/**
 * Pełna kontrola spójności.
 * @param {object} data { finishes, types, rooms, collections, products, promotions, postcodes, resellers }
 * @returns {string[]} lista błędów (pusta = OK)
 */
export function validateData(data) {
  const e = [];
  const { finishes, types, rooms, collections, products, promotions, postcodes, resellers } = data;
  const finishIds = new Set(finishes.map(f => f.id));
  const typeIds = new Set(types.map(t => t.id));
  const roomSlugs = new Set(rooms.map(r => r.slug));
  const collSlugs = new Set(collections.map(c => c.slug));

  for (const f of finishes) if (!/^#[0-9a-f]{6}$/i.test(f.hex)) e.push(`dekor ${f.id}: hex ${f.hex}`);
  for (const t of types) if (!t.rooms.length || !t.rooms.every(r => roomSlugs.has(r))) e.push(`typ ${t.id}: pomieszczenia`);

  const slugs = new Set();
  for (const p of products) {
    const w = `mebel ${p.slug}`;
    if (slugs.has(p.slug)) e.push(`${w}: zdublowany slug`);
    slugs.add(p.slug);
    if (!/^[a-z0-9-]+$/.test(p.slug)) e.push(`${w}: slug`);
    if (!collSlugs.has(p.collection)) e.push(`${w}: kolekcja ${p.collection}`);
    if (!typeIds.has(p.type)) e.push(`${w}: typ ${p.type}`);
    if (!p.rooms.length || !p.rooms.every(r => roomSlugs.has(r))) e.push(`${w}: pomieszczenia ${p.rooms}`);
    if (!isNum(p.dims.w) || !isNum(p.dims.h)) e.push(`${w}: wymiary ${JSON.stringify(p.dims)}`);
    if (!p.variants.length) e.push(`${w}: brak wariantów`);
    const codes = new Set();
    for (const v of p.variants) {
      if (codes.has(v.code)) e.push(`${w}: zdublowany wariant ${v.code}`);
      codes.add(v.code);
      if (!v.colorLabel) e.push(`${w}/${v.code}: brak nazwy koloru`);
      for (const k of ['body', 'front', 'accent']) if (v.finish[k] && !finishIds.has(v.finish[k])) e.push(`${w}/${v.code}: dekor ${v.finish[k]}`);
      if (v.ean && !/^\d{13}$/.test(v.ean)) e.push(`${w}/${v.code}: EAN ${v.ean}`);
    }
    for (const u of Object.values(p.documents)) if (u && !u.startsWith('https://')) e.push(`${w}: dokument nie po https ${u}`);
    if ('basePrice' in p || 'priceHistory' in p) e.push(`${w}: karty nie mają cen — pole ceny nie powinno istnieć`);
  }
  for (const c of collections) {
    if (!products.some(p => p.collection === c.slug)) e.push(`kolekcja ${c.slug}: brak mebli`);
    if (!c.rooms.length || !c.rooms.every(r => roomSlugs.has(r))) e.push(`kolekcja ${c.slug}: pomieszczenia`);
    for (const a of c.arrangements) if (!roomSlugs.has(a.room)) e.push(`kolekcja ${c.slug}: aranżacja bez pomieszczenia`);
  }
  if (promotions.length) e.push('promocje: karty nie zawierają promocji — lista powinna być pusta');

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
    if (!/^\d{2}-\d{3}$/.test(r.postcode)) e.push(`${w}: kod ${r.postcode}`);
    const c = pref[r.postcode.slice(0, 2)];
    if (!c) e.push(`${w}: prefiks ${r.postcode} nie istnieje`);
    else {
      const dKm = Math.hypot((r.lat - c.lat) * 111, (r.lng - c.lng) * 111 * Math.cos((r.lat * Math.PI) / 180));
      if (dKm > 110) e.push(`${w}: ${Math.round(dKm)} km od środka prefiksu ${r.postcode.slice(0, 2)}`);
    }
    if (!r.collections.length || !r.collections.every(x => collSlugs.has(x))) e.push(`${w}: kolekcje`);
  }
  return e;
}
