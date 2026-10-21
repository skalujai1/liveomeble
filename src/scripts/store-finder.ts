// Wyszukiwarka sklepów partnerskich w przeglądarce (kod pocztowy → najbliższe sklepy).
// Kod pocztowy i lokalizacja nie są nigdzie wysyłane: dane sklepów i okręgów pocztowych
// pobieramy w całości (/data/*.json), a odległości liczy src/lib/locator.js.

import { REGION_API } from '../config';
import { lookupPostcode, nearestResellers, normalizePostcode } from '../lib/locator.js';

type Store = {
  id: string; name: string; address: string; city: string; district?: string; postcode: string; voivodeship: string;
  lat: number; lng: number; phone: string | null; email: string | null; collections: string[];
  services: Record<string, boolean>; openingHours: string; distanceKm?: number;
};
type Texts = {
  errors: Record<string, string>;
  ipHint: { text: string; action: string; dismiss: string };
  geoLoading: string;
  item: Record<string, any>;
  title: string; titleWithPlace: string; resultsAnnounce: string;
  stores: { one: string; few: string; many: string };
  myLocation: string;
  collectionNames: Record<string, string>;
  headingLevel: number;
};

const NEARBY_KM = 60;
let dataPromise: Promise<{ stores: Store[]; postcodes: any }> | null = null;
const loadData = () =>
  (dataPromise ??= Promise.all([
    fetch('/data/resellers.json').then(r => r.json()),
    fetch('/data/postcodes.json').then(r => r.json()),
  ]).then(([stores, postcodes]) => ({ stores, postcodes })));

const PR = new Intl.PluralRules('pl');
const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const km = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string | null | false)[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

function setupFinder(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-sf-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-sf-postcode]')!;
  const select = root.querySelector<HTMLSelectElement>('[data-sf-collection]')!;
  const error = root.querySelector<HTMLElement>('[data-sf-error]')!;
  const status = root.querySelector<HTMLElement>('[data-sf-status]')!;
  const results = root.querySelector<HTMLElement>('[data-sf-results]')!;
  const title = root.querySelector<HTMLElement>('[data-sf-title]')!;
  const note = root.querySelector<HTMLElement>('[data-sf-note]')!;
  const list = root.querySelector<HTMLOListElement>('[data-sf-list]')!;
  const moreBtn = root.querySelector<HTMLButtonElement>('[data-sf-more]')!;
  const moreLink = root.querySelector<HTMLAnchorElement>('[data-sf-more-link]');
  const geoWrap = root.querySelector<HTMLElement>('[data-sf-geo-wrap]');
  const geoBtn = root.querySelector<HTMLButtonElement>('[data-sf-geo]');
  const ipHint = root.querySelector<HTMLElement>('[data-sf-ip]');
  const map = root.querySelector<SVGSVGElement>('[data-sf-map] svg');
  const t: Texts = JSON.parse(root.querySelector('[data-sf-texts]')?.textContent || '{}');
  const limit = Number(root.dataset.limit) || 5;
  const syncUrl = root.dataset.syncUrl === '1';
  let all: Store[] = [];
  let shown = 0;

  // Przycisk jest widoczny od razu (bez przesunięcia układu); bez JS ukrywa go CSS (.no-js), bez API — tutaj.
  if (geoWrap && !('geolocation' in navigator)) geoWrap.hidden = true;
  const warm = () => { loadData().catch(() => {}); };
  form.addEventListener('focusin', warm, { once: true });
  form.addEventListener('pointerenter', warm, { once: true });

  const showError = (msg: string | null) => {
    error.textContent = msg ?? '';
    error.hidden = !msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const say = (msg: string) => { status.textContent = msg; };

  const storeItem = (s: Store, collection: string) => {
    const it = t.item;
    const H = `h${Math.min(6, t.headingLevel)}` as 'h3';
    const addr = `${s.address}, ${s.postcode} ${s.city}`;
    const services = Object.entries(s.services).filter(([, on]) => on).map(([k]) => it.services[k]).filter(Boolean);
    const collLinks = el('span', { class: 'store__collections-list' });
    s.collections.forEach((c, i) => {
      if (i) collLinks.append(', ');
      collLinks.append(el('a', { href: `/kolekcje/${c}/` }, t.collectionNames[c] ?? c.toUpperCase()));
    });
    const route = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.address}, ${s.postcode} ${s.city}`)}`;
    return el('li', { class: 'store', 'data-store-id': s.id },
      el(H, { class: 'store__name' }, s.name),
      s.distanceKm != null ? el('p', { class: 'store__distance' }, fill(it.distance, { km: km(s.distanceKm) })) : null,
      collection ? el('p', { class: 'store__highlight' }, fill(it.highlight, { collection: t.collectionNames[collection] ?? collection })) : null,
      el('p', { class: 'store__address' }, addr),
      el('p', { class: 'store__collections' }, `${it.collections}: `, collLinks),
      services.length ? el('p', { class: 'store__services' }, services.join(' · ')) : null,
      el('p', { class: 'store__hours' }, `${it.hours}: ${s.openingHours}`),
      el('p', { class: 'store__actions' },
        el('a', { href: route, target: '_blank', rel: 'noopener', 'aria-label': fill(it.routeAria, { name: s.name }) }, it.route),
        s.phone ? el('a', { href: `tel:${s.phone.replace(/\s/g, '')}` }, `${it.phone}: ${s.phone}`) : null,
        s.email ? el('a', { href: `mailto:${s.email}` }, it.email) : null,
      ),
    );
  };

  const renderMore = (collection: string) => {
    const next = all.slice(shown, shown + limit);
    list.append(...next.map(s => storeItem(s, collection)));
    shown += next.length;
    moreBtn.hidden = !!moreLink || shown >= all.length;
    if (map) {
      const ids = new Set(all.slice(0, shown).map(s => s.id));
      map.querySelectorAll<SVGCircleElement>('[data-store-id]').forEach(c => c.classList.toggle('is-result', ids.has(c.dataset.storeId!)));
    }
  };

  const markMe = (lat: number, lng: number) => {
    const me = map?.querySelector<SVGCircleElement>('[data-map-me]');
    if (!map || !me) return;
    const d = map.dataset;
    me.setAttribute('cx', ((lng - Number(d.mapLng0)) * Number(d.mapKx)).toFixed(1));
    me.setAttribute('cy', ((Number(d.mapLat0) - lat) * Number(d.mapKy)).toFixed(1));
    me.classList.add('is-visible');
  };

  const search = async (point: { lat: number; lng: number }, place: string, collection: string) => {
    let data;
    try {
      data = await loadData();
    } catch {
      say(t.errors.geoUnavailable);
      return;
    }
    const withCollection = nearestResellers(data.stores, point, { collection: collection || undefined, limit: null }) as Store[];
    note.hidden = true;
    if (collection && !withCollection.length) {
      all = nearestResellers(data.stores, point, { limit: null }) as Store[];
      note.textContent = fill(t.errors.noneAtAll, { collection: t.collectionNames[collection] ?? collection });
      note.hidden = false;
      collection = '';
    } else {
      all = withCollection;
      if (collection && all[0] && all[0].distanceKm! > NEARBY_KM) {
        note.textContent = fill(t.errors.noneNearby, { km: NEARBY_KM, collection: t.collectionNames[collection] ?? collection });
        note.hidden = false;
      }
    }
    list.replaceChildren();
    shown = 0;
    title.textContent = place ? fill(t.titleWithPlace, { place }) : t.title;
    results.hidden = false;
    renderMore(collection);
    markMe(point.lat, point.lng);
    if (moreLink) {
      const u = new URL(moreLink.href, location.href);
      if (collection) u.searchParams.set('kolekcja', collection);
      const code = normalizePostcode(input.value);
      if (code) u.searchParams.set('kod', code);
      moreLink.href = u.pathname + u.search;
    }
    const n = all.length;
    say(fill(t.resultsAnnounce, { count: fill(t.stores[PR.select(n) as 'one'] ?? t.stores.many, { n }) }));
  };

  const runPostcode = async () => {
    const code = normalizePostcode(input.value);
    if (!code) {
      showError(t.errors.invalid);
      input.focus();
      return;
    }
    input.value = code;
    let data;
    try { data = await loadData(); } catch { say(t.errors.geoUnavailable); return; }
    const hit = lookupPostcode(code, data.postcodes);
    if (!hit) {
      showError(t.errors.unknown);
      input.focus();
      return;
    }
    showError(null);
    if (syncUrl) {
      const sp = new URLSearchParams(location.search);
      sp.set('kod', code);
      if (select.value) sp.set('kolekcja', select.value); else sp.delete('kolekcja');
      history.replaceState(history.state, '', `${location.pathname}?${sp}`);
    }
    await search(hit, `${code} (${hit.region})`, select.value);
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    runPostcode();
  });
  input.addEventListener('input', () => { if (!error.hidden && normalizePostcode(input.value)) showError(null); });
  select.addEventListener('change', () => { if (!results.hidden) (normalizePostcode(input.value) ? runPostcode() : null); });
  moreBtn.addEventListener('click', () => renderMore(select.value));

  geoBtn?.addEventListener('click', () => {
    showError(null);
    say(t.geoLoading);
    geoBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        geoBtn.disabled = false;
        search({ lat: pos.coords.latitude, lng: pos.coords.longitude }, t.myLocation, select.value);
      },
      err => {
        geoBtn.disabled = false;
        say(err.code === err.PERMISSION_DENIED ? t.errors.geoDenied : t.errors.geoUnavailable);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });

  // Wejście z linku (np. z karty mebla): /gdzie-kupic/?kod=35-060&kolekcja=olmo
  const sp = new URLSearchParams(location.search);
  const presetCollection = sp.get('kolekcja');
  if (presetCollection && [...select.options].some(o => o.value === presetCollection)) select.value = presetCollection;
  const presetCode = sp.get('kod');
  if (syncUrl && presetCode) {
    input.value = presetCode;
    runPostcode();
  }
  if (syncUrl && (presetCode || presetCollection)) {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = 'noindex, follow';
  }

  // Podpowiedź regionu z IP — tylko tekst, kod wpisuje klient.
  if (REGION_API && ipHint) {
    fetch(REGION_API).then(r => (r.ok ? r.json() : null)).then(j => {
      if (j?.country === 'PL' && j.region) {
        ipHint.textContent = fill(t.ipHint.text, { region: j.region });
        ipHint.hidden = false;
      }
    }).catch(() => {});
  }
}

export function initStoreFinders() {
  document.querySelectorAll<HTMLElement>('[data-store-finder]').forEach(setupFinder);
}
