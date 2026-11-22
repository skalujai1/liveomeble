// Wyszukiwarka w nagłówku: jedno pole na meble i salony. Kod pocztowy (np. 35-060) wysyła formularz do „Gdzie kupić”,
// a nazwa, symbol albo kolor („DT04”, „biała komoda”) od razu pokazuje pasujące meble z miniaturami.
// Indeks /data/szukaj.json (src/pages/data/szukaj.json.ts) pobiera się przy pierwszym otwarciu. Ctrl/Cmd+K otwiera pole.
type Item = { n: string; u: string; i: string; d: string; m: string; k: string; s?: string; c?: string };

const POSTCODE = /^\d{2}-?\d{3}$/;
const norm = (s: string) => s.toLocaleLowerCase('pl').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const forms = (n: number) => (n === 1 ? 'mebel' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'meble' : 'mebli');

export function initSearch() {
  const form = document.getElementById('naglowek-szukaj') as (HTMLFormElement & { showPopover?: () => void }) | null;
  const input = form?.querySelector<HTMLInputElement>('input[name="kod"]');
  const box = form?.querySelector<HTMLElement>('[data-search-results]');
  const status = form?.querySelector<HTMLElement>('[data-search-status]');
  if (!form || !input || !box || !status) return;

  let items: Item[] | null = null;
  let loading: Promise<void> | null = null;
  const load = () => (loading ??= fetch('/data/szukaj.json')
    .then(r => r.json())
    .then((d: Item[]) => { items = d.map(x => ({ ...x, s: norm(`${x.n} ${x.k}`), c: norm(x.d || '') })); })
    .catch(() => { loading = null; }));

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = '') => {
    const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e;
  };

  const render = () => {
    const q = input.value.trim();
    box.replaceChildren();
    status.textContent = '';
    if (!q) return;
    if (POSTCODE.test(q)) {
      const b = el('button', 'site-search__postcode', `Pokaż salony przy ${q}`);
      b.type = 'submit';
      box.append(b);
      return;
    }
    if (!items) { void load().then(() => { if (input.value.trim() === q) render(); }); return; }
    // polska odmiana: „biała” ma trafić w „Biały”, „komody” w „Komoda”: dłuższe słowa (bez cyfr) szukamy bez ostatniej
    // litery; kolejność: najpierw meble, których nazwa zawiera całe wpisane słowo („szafa” przed „szafka”, „DT04” przed „DT01”)
    const raw = norm(q).split(/\s+/).filter(Boolean);
    const stems = raw.map(t => (t.length >= 4 && !/\d/.test(t) ? t.slice(0, -1) : t));
    const word = (hay: string, t: string) => ` ${hay} `.includes(` ${t} `);
    const hits = items.filter(it => stems.every(t => it.s!.includes(t)))
      .map(it => {
        const name = norm(it.n);
        const score = raw.reduce((sum, t, i) => sum + (word(name, t) ? 4 : name.includes(t) ? 2 : it.c!.includes(stems[i]) ? 3 : it.s!.includes(t) ? 1 : 0), 0);
        return { it, score };
      })
      .filter((x, _i, all) => !/\d/.test(q) || x.score >= Math.max(...all.map(y => y.score)) || x.score >= 2)
      .sort((a, b) => b.score - a.score)
      .map(x => x.it);
    status.textContent = hits.length ? `${hits.length} ${forms(hits.length)}` : '';
    if (!hits.length) {
      box.append(el('p', 'site-search__empty', `Brak mebli dla „${q}”. Wpisz nazwę kolekcji, rodzaj albo symbol, np. DT04, albo kod pocztowy.`));
      return;
    }
    const ul = el('ul', 'site-search__list');
    for (const it of hits.slice(0, 6)) {
      const li = el('li', '');
      const a = el('a', 'site-search__item');
      a.href = it.u;
      const pic = el('span', 'site-search__thumb');
      if (it.i) { const img = new Image(); img.src = it.i; img.alt = ''; img.loading = 'lazy'; pic.append(img); }
      const txt = el('span', 'site-search__text');
      txt.append(el('b', '', it.n), el('small', '', it.m));
      a.append(pic, txt);
      li.append(a);
      ul.append(li);
    }
    box.append(ul);
    if (hits.length > 6) box.append(el('p', 'site-search__more', `i jeszcze ${hits.length - 6} ${forms(hits.length - 6)}. Doprecyzuj, np. dodaj kolor albo kolekcję.`));
  };

  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(render, 110); });
  input.addEventListener('focus', () => void load(), { once: true });
  form.addEventListener('submit', e => {
    const q = input.value.trim();
    if (!q || POSTCODE.test(q)) return; // kod pocztowy: zwykła wysyłka do „Gdzie kupić”
    e.preventDefault();
    const a = box.querySelector<HTMLAnchorElement>('a');
    if (a) location.href = a.href;
  });
  // strzałki: z pola do wyników i między wynikami
  form.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...box.querySelectorAll<HTMLAnchorElement>('a')];
    if (!links.length) return;
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    e.preventDefault();
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)].focus();
    else if (i <= 0) input.focus();
    else links[i - 1].focus();
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && form.showPopover && getComputedStyle(form.previousElementSibling as Element).display !== 'none') {
      e.preventDefault();
      try { form.showPopover(); } catch { /* już otwarte */ }
      input.focus();
    }
  });
}
