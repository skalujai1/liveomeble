// Dobór mebli Liveo do wnętrza.
//
// Pomysł: Liveo sprzedaje kolekcje mebli projektowanych razem (ARIS, DANTE, IRMA …),
// więc proponujemy KOMPLET – kilka mebli z jednej kolekcji, w jednym kolorze,
// dobranym do stylu i barw zdjęcia. Kolejne propozycje to kolejne kolekcje.

export const ROOMS = {
  salon:       { label: 'Salon', name: 'salon', acc: 'salon', gen: 'salonu',
                 types: ['rtv', 'komoda', 'witryna', 'regal', 'lawa', 'polka'] },
  jadalnia:    { label: 'Jadalnia', name: 'jadalnia', acc: 'jadalnię', gen: 'jadalni',
                 types: ['stol', 'kredens', 'witryna', 'komoda', 'regal', 'polka'] },
  kuchnia:     { label: 'Kuchnia', name: 'kuchnia', acc: 'kuchnię', gen: 'kuchni',
                 types: ['zestaw_kuchenny', 'szafka_kuchenna', 'stol', 'kredens'] },
  sypialnia:   { label: 'Sypialnia', name: 'sypialnia', acc: 'sypialnię', gen: 'sypialni',
                 types: ['lozko', 'szafka_nocna', 'szafa', 'komoda', 'toaletka', 'lustro'] },
  mlodziezowy: { label: 'Pokój młodzieżowy', name: 'pokój młodzieżowy', acc: 'pokój młodzieżowy', gen: 'pokoju młodzieżowego',
                 types: ['biurko', 'lozko', 'szafa', 'regal', 'polka', 'komoda'] },
  biuro:       { label: 'Biuro', name: 'domowe biuro', acc: 'domowe biuro', gen: 'domowego biura',
                 types: ['biurko', 'regal', 'komoda', 'szafa', 'polka', 'szafka'] },
  przedpokoj:  { label: 'Przedpokój', name: 'przedpokój', acc: 'przedpokój', gen: 'przedpokoju',
                 types: ['szafa', 'szafka_na_buty', 'komoda', 'lustro', 'wieszak', 'szafka'] },
};

export const TYPES = {
  rtv: ['Szafka RTV', 'Szafki RTV'], komoda: ['Komoda', 'Komody'], witryna: ['Witryna', 'Witryny'],
  regal: ['Regał', 'Regały'], lawa: ['Ława', 'Ławy'], polka: ['Półka', 'Półki'], stol: ['Stół', 'Stoły'],
  kredens: ['Kredens', 'Kredensy'], zestaw_kuchenny: ['Zestaw kuchenny', 'Zestawy kuchenne'],
  szafka_kuchenna: ['Szafka kuchenna', 'Szafki kuchenne'], lozko: ['Łóżko', 'Łóżka'],
  szafka_nocna: ['Szafka nocna', 'Szafki nocne'], szafa: ['Szafa', 'Szafy'], toaletka: ['Toaletka', 'Toaletki'],
  lustro: ['Lustro', 'Lustra'], biurko: ['Biurko', 'Biurka'], szafka_na_buty: ['Szafka na buty', 'Szafki na buty'],
  wieszak: ['Wieszak', 'Wieszaki'], szafka: ['Szafka', 'Szafki'], zestaw: ['Zestaw', 'Zestawy'],
};

// Preferencje, gdy nie mamy zdjęcia (klient wybrał pomieszczenie z listy)
export const NEUTRAL = { light: 0.62, wood: 0.55, black: 0.3, gloss: 0.3 };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const modelBase = p => p.model.replace(/\/\d+$/, '');

/** Łóżko 90 cm pasuje do pokoju młodzieżowego, do sypialni – od 140 cm. */
function fitsRoom(p, room) {
  if (p.type !== 'lozko') return true;
  const m = p.name.match(/\/(\d{2,3})\b|(?:ŁÓŻKO|ŁOŻE) (\d{2,3})\b/);
  const width = m ? Number(m[1] || m[2]) : null;
  if (!width) return true;
  if (room === 'sypialnia') return width >= 140;
  if (room === 'mlodziezowy') return width <= 140;
  return true;
}

/** Wynik analizy zdjęcia → czego szukamy (jasność, drewno, czerń, połysk; 0–1). */
export function prefsFromAnalysis(a) {
  if (!a) return { ...NEUTRAL };
  const st = { light: 0, wood: 0, black: 0, gloss: 0 };
  for (const s of a.styles) for (const k in st) st[k] += s.pref[k] * s.p;
  const pal = a.palette;
  if (!pal) return st;
  return {
    light: clamp(0.5 * st.light + 0.5 * clamp((pal.light - 0.22) / 0.55)),
    wood: clamp(0.6 * st.wood + 0.4 * (pal.warm > 0.2 ? 0.9 : pal.warm > 0.08 ? 0.6 : 0.3)),
    black: clamp(0.7 * st.black + 0.3 * (pal.dark > 0.12 ? 0.9 : 0.2)),
    gloss: st.gloss,
  };
}

/** Jak bardzo kolorystyka produktu pasuje do preferencji (0–1). */
export function colorScore(color, prefs) {
  if (!color) return 0.45;
  const tone = 1 - Math.abs(color.light - prefs.light);
  const wood = color.wood ? prefs.wood : 1 - prefs.wood;
  const black = color.black ? prefs.black : 1 - prefs.black * 0.6;
  const gloss = color.gloss ? prefs.gloss : 1 - prefs.gloss * 0.4;
  return 0.45 * tone + 0.25 * wood + 0.18 * black + 0.12 * gloss;
}

function productScore(p, prefs) {
  return colorScore(p.color, prefs) + (p.bestseller ? 0.04 : 0) + (p.regular ? 0.02 : 0);
}

/**
 * Komplety (kolekcja + kolor) do pomieszczenia, od najlepiej pasującego.
 * @param {object} o
 * @param {Set<string>} [o.skip]   kolekcje już pokazane
 * @param {number} [o.maxPrice]    maks. cena pojedynczego mebla
 * @param {boolean} [o.budget]     preferuj tańsze komplety
 */
export function recommendSets(products, room, prefs, { skip = new Set(), maxPrice, budget = false } = {}) {
  const types = ROOMS[room].types;
  const units = new Map();
  for (const p of products) {
    if (!types.includes(p.type) || (maxPrice && p.price > maxPrice) || !fitsRoom(p, room)) continue;
    if (p.rooms?.length && !p.rooms.includes(room)) continue; // katalog mówi, do jakich pomieszczeń jest mebel
    const key = `${p.collection}|${p.color?.label ?? '-'}`;
    if (!units.has(key)) units.set(key, { collection: p.collection, color: p.color, items: [] });
    units.get(key).items.push(p);
  }

  // waga typów: pierwszy (np. RTV w salonie) najważniejszy
  const weight = types.map((_, i) => 1 / (1 + i * 0.35));
  const coreWeight = weight.slice(0, Math.min(4, types.length)).reduce((a, b) => a + b, 0);

  let sets = [];
  for (const u of units.values()) {
    if (skip.has(u.collection)) continue;
    const picks = [];
    // bez cen w katalogu (karty produktu Liveo) kolejność decyduje „polecany”, potem kolejność w danych
    const byPriority = (a, b) => (b.bestseller - a.bestseller) || ((a.price ?? 0) - (b.price ?? 0));
    for (const t of types) {
      const c = u.items.filter(p => p.type === t).sort(byPriority)[0];
      if (c) picks.push(c);
    }
    if (picks.length < 2 && types.length > 2) continue; // za mało na komplet
    // mały komplet dopełnij do 3 innymi modelami z kolekcji (np. kilka szafek kuchennych)
    const rest = u.items.filter(p => !picks.some(x => modelBase(x) === modelBase(p)))
      .sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type) || byPriority(a, b));
    for (const p of rest) {
      if (picks.length >= 3) break;
      if (!picks.some(x => modelBase(x) === modelBase(p))) picks.push(p);
    }
    picks.sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type));

    const covered = new Set(picks.map(p => p.type));
    const coverage = types.reduce((a, t, i) => a + (covered.has(t) ? weight[i] : 0), 0) / coreWeight;
    const total = picks.reduce((a, p) => a + (p.price ?? 0), 0);
    // bez najważniejszego mebla (łóżko w sypialni, stół w jadalni …) komplet jest mniej przydatny
    const anchor = covered.has(types[0]) ? 1 : 0.8;
    const score = colorScore(u.color, prefs) * (0.55 + 0.45 * clamp(coverage)) * anchor
                + (picks.some(p => p.bestseller) ? 0.03 : 0);
    sets.push({ collection: u.collection, color: u.color, items: picks.slice(0, 6), total, score,
                avg: total / picks.length });
  }

  if (budget && sets.length) {
    const maxAvg = Math.max(...sets.map(s => s.avg));
    sets.forEach(s => { s.score = 0.55 * s.score + 0.45 * (1 - s.avg / maxAvg); });
  }
  sets.sort((a, b) => b.score - a.score);
  // jedna propozycja na kolekcję (najlepszy kolor)
  const seen = new Set();
  sets = sets.filter(s => !seen.has(s.collection) && seen.add(s.collection));
  return sets;
}

/** Najlepiej pasujące meble jednego typu (np. "pokaż komody"), różne modele. */
export function recommendByType(products, type, prefs, { room, maxPrice, budget = false, limit = 8 } = {}) {
  const best = new Map();
  for (const p of products) {
    if (p.type !== type || (maxPrice && p.price > maxPrice) || !fitsRoom(p, room)) continue;
    const s = productScore(p, prefs);
    const k = modelBase(p);
    if (!best.has(k) || best.get(k).s < s) best.set(k, { p, s });
  }
  let list = [...best.values()];
  if (budget && list.length) {
    const max = Math.max(...list.map(x => x.p.price ?? 0));
    if (max > 0) list.forEach(x => { x.s = 0.5 * x.s + 0.5 * (1 - (x.p.price ?? max) / max); });
  }
  return list.sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.p);
}

/** Krótkie uzasadnienie, dlaczego komplet pasuje (do wiadomości w czacie). */
export function explainSet(set, prefs, hasPhoto) {
  const c = set.color;
  if (!c) return '';
  const why = [];
  if (c.wood && prefs.wood > 0.6) why.push('ciepłe drewno');
  if (c.light > 0.72 && prefs.light > 0.6) why.push('jasna kolorystyka');
  if (c.light < 0.4 && prefs.light < 0.45) why.push('głęboki, ciemny kolor');
  if (c.black && prefs.black > 0.5) why.push('czarne akcenty');
  if (c.gloss && prefs.gloss > 0.5) why.push('elegancki połysk');
  if (!why.length) why.push(c.light > 0.6 ? 'jasna, uniwersalna kolorystyka' : 'ponadczasowa kolorystyka');
  const list = why.length > 1 ? why.slice(0, -1).join(', ') + ' i ' + why.at(-1) : why[0];
  return hasPhoto
    ? `${list[0].toUpperCase() + list.slice(1)} – ${why.length > 1 ? 'pasują' : 'pasuje'} do tego, co widzę na zdjęciu.`
    : `${list[0].toUpperCase() + list.slice(1)}.`;
}

// ---------------------------------------------------------------------------
// Krótkie polecenia tekstowe bez modelu językowego (czat i podstrona doradcy)
// ---------------------------------------------------------------------------
export const plain = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

const ROOM_WORDS = [
  [/salon|pokoj dzienn|pokoju dzienn|living/, 'salon'], [/sypial/, 'sypialnia'], [/kuchn|kuchen/, 'kuchnia'],
  [/jadal/, 'jadalnia'], [/biur|gabinet|do pracy|home office/, 'biuro'],
  [/przedpok|korytarz|\bhol\b|holu|wiatrol|wejsci/, 'przedpokoj'],
  [/mlodziez|dziec|dziecie|nastolat|syna|corki/, 'mlodziezowy'],
];
const TYPE_WORDS = [
  [/rtv|telewiz|\btv\b|pod tv/, 'rtv'], [/komod/, 'komoda'], [/witryn|gablot/, 'witryna'], [/regal/, 'regal'],
  [/\blaw[ay]?\b|stolik kawow/, 'lawa'], [/polk|polec/, 'polka'], [/\bst[oó]l\b|stoly|stolu|stoł/, 'stol'],
  [/kredens/, 'kredens'], [/lozk|loze|lozek/, 'lozko'], [/nocn/, 'szafka_nocna'], [/toaletk/, 'toaletka'],
  [/lustr/, 'lustro'], [/biurk/, 'biurko'], [/but/, 'szafka_na_buty'], [/wieszak|garderob/, 'wieszak'],
  [/zabudow|zestaw kuchen|meble kuchen|szafki kuchen/, 'zestaw_kuchenny'], [/\bszaf[aey]?\b|\bszafe\b/, 'szafa'],
];

/** „biała komoda do sypialni do 1000 zł” → { room: 'sypialnia', type: 'komoda', maxPrice: 1000, lighter: true, … } */
export function parseQuery(text) {
  const t = plain(text);
  const find = list => list.find(([rx]) => rx.test(t))?.[1];
  const price = t.match(/(?:do|max|maks|ponizej|nie wiecej niz|budzet)\s*(\d[\d\s]{1,6})/);
  return {
    room: find(ROOM_WORDS),
    type: find(TYPE_WORDS),
    maxPrice: price ? parseInt(price[1].replace(/\s/g, ''), 10) : null,
    budget: /tansz|taniej|tanio|budzet|oszczed|promocj/.test(t),
    lighter: /jasn|bial|bialy|biel/.test(t),
    darker: /ciemn|czarn|grafit|antracyt/.test(t),
    next: /inn[aey]? koleke|inna|kolejn|nastepn|wiecej propozyc|cos innego/.test(t),
    nofurn: /lazienk|garaz/.test(t) ? (/garaz/.test(t) ? 'garaz' : 'lazienka') : null,
    outdoor: /ogrod|taras|balkon|podjazd|ogrodow/.test(t),
    greet: /^(czesc|hej|hejka|dzien dobry|witam|siema|dobry wieczor|hello|hi)\b/.test(t),
    thanks: /dzieki|dziekuj|super|swietnie|ok dzieki/.test(t),
    info: /kontakt|telefon|dostaw|zamow|montaz|gwarancj|zwrot|reklamac|platnos|raty|sklep stacjonar|salon meblow|czas realizacji/.test(t),
    help: /co potrafisz|jak (to )?dziala|pomoc|help|jak uzywac/.test(t),
  };
}

/** Skrót oferty dla modelu językowego (Worker): kolekcja → rodzaje, pomieszczenia, kolory, cena „od”. */
export function catalogSummary(products) {
  const cols = new Map();
  for (const p of products) {
    const c = cols.get(p.collection) || { types: new Set(), colors: new Set(), rooms: new Set(), min: Infinity, promo: false };
    c.types.add(TYPES[p.type]?.[0] || p.type);
    if (p.color?.label) c.colors.add(p.color.label);
    (p.rooms || []).forEach(r => c.rooms.add(ROOMS[r]?.name || r));
    if (p.price != null) c.min = Math.min(c.min, p.price);
    c.promo ||= !!p.regular;
    cols.set(p.collection, c);
  }
  return [...cols].map(([name, c]) => `${name}: ${[...c.types].join(', ')}; pomieszczenia: ${[...c.rooms].join(', ')}; kolory: ${[...c.colors].slice(0, 4).join(', ')}${Number.isFinite(c.min) ? `; ceny od ${formatPrice(c.min)}` : '; cenę podaje salon partnerski'}${c.promo ? '; trwa promocja' : ''}`)
    .join('\n').slice(0, 4000);
}

/** 1379 → "1 379 zł", 1379.5 → "1 379,50 zł" (jak w sklepie Liveo) */
export function formatPrice(v) {
  const [int, dec] = (Math.round(v * 100) / 100).toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec === '00' ? '' : ',' + dec) + ' zł';
}
