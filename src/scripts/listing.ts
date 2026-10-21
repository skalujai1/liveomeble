// Filtry i sortowanie listy mebli w przeglądarce (dane w atrybutach data-* kart).
// Parametry w adresie: pokoj, typ, kolekcja, kolor (wiele wartości po przecinku), cena, promocje=1, sort.
// Tylko atrybuty i kolejność węzłów — bez czytania układu.

const MULTI = ['pokoj', 'typ', 'kolekcja', 'kolor'] as const;
const FILTER_KEYS = [...MULTI, 'cena', 'promocje', 'sort'];

type Filters = { multi: Record<string, string[]>; cena: string; promocje: boolean; sort: string };

function readUrl(): Filters {
  const sp = new URLSearchParams(location.search);
  const multi: Record<string, string[]> = {};
  for (const k of MULTI) multi[k] = sp.getAll(k).flatMap(v => v.split(',')).map(s => s.trim()).filter(Boolean);
  return { multi, cena: sp.get('cena') ?? '', promocje: sp.get('promocje') === '1', sort: sp.get('sort') ?? '' };
}

function readForm(form: HTMLFormElement): Filters {
  const fd = new FormData(form);
  const multi: Record<string, string[]> = {};
  for (const k of MULTI) multi[k] = fd.getAll(k).map(String);
  return { multi, cena: String(fd.get('cena') ?? ''), promocje: fd.get('promocje') === '1', sort: String(fd.get('sort') ?? '') };
}

function writeForm(form: HTMLFormElement, f: Filters) {
  form.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(i => {
    i.checked = i.name === 'promocje' ? f.promocje : (f.multi[i.name] ?? []).includes(i.value);
  });
  form.querySelectorAll<HTMLInputElement>('input[type=radio][name=cena]').forEach(i => { i.checked = i.value === f.cena; });
  const sort = form.querySelector<HTMLSelectElement>('[data-listing-sort]');
  if (sort && f.sort && [...sort.options].some(o => o.value === f.sort)) sort.value = f.sort;
}

const inPrice = (price: number, range: string) => {
  if (!range) return true;
  const [a, b] = range.split('-');
  return price >= Number(a || 0) && (b === '' || b === undefined ? true : price <= Number(b));
};

function matches(el: HTMLElement, f: Filters) {
  const d = el.dataset;
  const any = (attr: string | undefined, wanted: string[]) => !wanted.length || (attr ?? '').split(' ').some(x => wanted.includes(x));
  return any(d.rooms, f.multi.pokoj)
    && any(d.type, f.multi.typ)
    && any(d.collection, f.multi.kolekcja)
    && any(d.colors, f.multi.kolor)
    && inPrice(Number(d.price), f.cena)
    && (!f.promocje || d.promo === '1');
}

const SORTERS: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
  polecane: (a, b) => Number(a.dataset.order) - Number(b.dataset.order),
  'cena-rosnaco': (a, b) => Number(a.dataset.price) - Number(b.dataset.price) || SORTERS.polecane(a, b),
  'cena-malejaco': (a, b) => Number(b.dataset.price) - Number(a.dataset.price) || SORTERS.polecane(a, b),
  nowosci: (a, b) => Number(b.dataset.new) - Number(a.dataset.new) || SORTERS.polecane(a, b),
  szerokosc: (a, b) => Number(a.dataset.width) - Number(b.dataset.width) || SORTERS.polecane(a, b),
};

const PR = new Intl.PluralRules('pl');

function setupListing(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-listing-form]');
  const list = root.querySelector<HTMLElement>('[data-listing-list]');
  const count = root.querySelector<HTMLElement>('[data-listing-count]');
  const empty = root.querySelector<HTMLElement>('[data-listing-empty]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-listing-toggle]');
  if (!form || !list) return;
  const items = [...list.querySelectorAll<HTMLElement>('[data-listing-item]')];
  const forms = JSON.parse(count?.dataset.forms ?? '{}');
  root.classList.add('listing--js');

  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      form.classList.toggle('is-open', open);
    });
  }

  const apply = (f: Filters, { updateUrl = true } = {}) => {
    let shown = 0;
    for (const el of items) {
      const ok = matches(el, f);
      el.hidden = !ok;
      if (ok) shown++;
    }
    const sorter = SORTERS[f.sort] ?? SORTERS.polecane;
    const sorted = [...items].sort(sorter);
    if (sorted.some((el, i) => list.children[i] !== el)) list.append(...sorted);
    if (count) {
      const tpl = forms[PR.select(shown)] ?? forms.many ?? '{n}';
      const text = tpl.replace('{n}', String(shown));
      if (count.textContent !== text) count.textContent = text;
    }
    if (empty) empty.hidden = shown > 0;
    if (updateUrl) {
      const sp = new URLSearchParams(location.search);
      FILTER_KEYS.forEach(k => sp.delete(k));
      for (const k of MULTI) if (f.multi[k].length) sp.set(k, f.multi[k].join(','));
      if (f.cena) sp.set('cena', f.cena);
      if (f.promocje) sp.set('promocje', '1');
      if (f.sort && f.sort !== 'polecane') sp.set('sort', f.sort);
      const qs = sp.toString().replace(/%2C/g, ',');
      history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
      markNoindex(!!qs);
    }
  };

  const fromUrl = readUrl();
  const hasParams = FILTER_KEYS.some(k => new URLSearchParams(location.search).has(k));
  if (hasParams) {
    writeForm(form, fromUrl);
    apply(readForm(form), { updateUrl: false });
    markNoindex(true);
  }

  form.addEventListener('change', () => apply(readForm(form)));
  form.addEventListener('submit', e => {
    e.preventDefault();
    apply(readForm(form));
  });
  const clear = () => {
    form.reset();
    // reset() przywraca stan z HTML — jawnie zaznacz „Dowolna” i kolejność „Polecane”
    writeForm(form, { multi: { pokoj: [], typ: [], kolekcja: [], kolor: [] }, cena: '', promocje: false, sort: 'polecane' });
    apply(readForm(form));
  };
  root.querySelectorAll('[data-listing-clear]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); clear(); }));
  // Ceny przeliczone w przeglądarce (promocja mogła się zacząć/skończyć) → filtry ceny i promocji od nowa.
  document.addEventListener('liveo:prices', () => apply(readForm(form), { updateUrl: false }));
}

/** Adres z parametrami filtrów nie powinien trafić do indeksu (canonical i tak wskazuje stronę bazową). */
function markNoindex(on: boolean) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'robots';
    document.head.append(meta);
  }
  meta.dataset.original ??= meta.content;
  meta.content = on ? 'noindex, follow' : meta.dataset.original;
}

export function initListings() {
  document.querySelectorAll<HTMLElement>('[data-listing]').forEach(setupListing);
}
