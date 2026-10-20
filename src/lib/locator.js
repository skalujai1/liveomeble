// Wyszukiwarka najbliższych sklepów partnerskich Liveo.
//
// Czysty moduł ESM bez zależności (Node i przeglądarka).
// Główna metoda: kod pocztowy wpisany przez klienta → przybliżony środek okręgu
// pocztowego (2 pierwsze cyfry, src/data/postcodes.json) → sklepy posortowane po
// odległości w linii prostej. Lokalizacja z IP może co najwyżej podpowiedzieć kod,
// a geolokalizacja przeglądarki (za zgodą) daje dokładny punkt { lat, lng }.

const EARTH_KM = 6371.0088;

/**
 * "35060" | "35-060" | " 35 060 " | "35–060" | 35060 → "35-060"; wszystko inne → null.
 */
export function normalizePostcode(input) {
  if (typeof input === 'number') {
    return Number.isInteger(input) && input >= 0 && input <= 99999 ? normalizePostcode(String(input).padStart(5, '0')) : null;
  }
  if (typeof input !== 'string') return null;
  const s = input.replace(/[\s   ]/g, '');
  // myślnik (albo półpauza, pauza, minus) tylko między 2. a 3. cyfrą
  const m = /^(\d{2})[-‐-―−]?(\d{3})$/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Kod pocztowy → { lat, lng, region, prefix, precision } albo null.
 * `postcodes` to zawartość postcodes.json ({ precision, prefixes: { "35": {...} } })
 * albo sama mapa prefiksów.
 */
export function lookupPostcode(code, postcodes) {
  const norm = normalizePostcode(code);
  if (!norm || !postcodes) return null;
  const map = postcodes.prefixes || postcodes;
  const prefix = norm.slice(0, 2);
  const hit = map[prefix];
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return null;
  return { lat: hit.lat, lng: hit.lng, region: hit.region, prefix, precision: postcodes.precision || 'prefix-2' };
}

const rad = d => (d * Math.PI) / 180;

/** Odległość po ortodromie w km między { lat, lng } a { lat, lng }. */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validPoint = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Najbliższe sklepy partnerskie.
 * @param {object[]} resellers
 * @param {{lat:number,lng:number}} point
 * @param {object} [o]
 * @param {string} [o.collection] slug kolekcji (np. "olmo") — sklep musi mieć ją w ofercie
 * @param {number} [o.limit=5]
 * @param {number} [o.maxKm] pomiń sklepy dalej niż maxKm
 * @returns {object[]} kopie rekordów z polem distanceKm (0,1 km), od najbliższego
 */
export function nearestResellers(resellers, point, { collection, limit = 5, maxKm } = {}) {
  if (!Array.isArray(resellers) || !validPoint(point)) return [];
  const want = collection ? String(collection).trim().toLowerCase() : null;
  const out = [];
  for (const r of resellers) {
    if (!validPoint(r)) continue;
    if (want && !(r.collections || []).some(c => String(c).toLowerCase() === want)) continue;
    const d = haversineKm(point, r);
    if (maxKm != null && d > maxKm) continue;
    out.push({ ...r, distanceKm: Math.round(d * 10) / 10 });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm || String(a.name).localeCompare(String(b.name), 'pl'));
  return limit == null ? out : out.slice(0, Math.max(0, limit));
}
