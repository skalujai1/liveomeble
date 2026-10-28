// Pełny doradca wnętrz (/doradca-wnetrz/): cztery kroki — zdjęcie, pokój i kolory, komplety, gdzie kupić.
// Dobór mebli i rozumienie poleceń: te same moduły co mały czat (liveo-assistant/widget/recommender.js).
// Analiza zdjęcia (engine.js: MobileCLIP + paleta barw) ładuje się dopiero przy pierwszym zdjęciu,
// z kopii widżetu w /liveo-assistant/widget/ (tools/sync-assistant.mjs). Zdjęcie nie opuszcza przeglądarki.
// Czat przekazuje tu zdjęcie, analizę i komplet przez sessionStorage „lv-advisor” (liveo-assistant.js, handoff()).
import {
  ROOMS, TYPES, prefsFromAnalysis, recommendSets, recommendByType, explainSet, formatPrice, parseQuery, catalogSummary,
} from '../../liveo-assistant/widget/recommender.js';

type Room = { slug: string; name: string; accusative: string; genitive: string };
type Boot = {
  engineUrl: string; catalogUrl: string; embeddingsUrl: string; chatUrl: string;
  rooms: Record<string, Room>; finishHex: Record<string, string>;
};
type Product = {
  name: string; collection: string; model: string; type: string; rooms?: string[]; price: number | null; regular: number | null;
  lowest30?: number | null; url: string; img: string; color?: { label: string } | null;
};
type Catalog = { products: Product[]; collections: Record<string, string> };
type Set_ = { collection: string; color: { label: string } | null; items: Product[]; total: number };

const HANDOFF_KEY = 'lv-advisor';
const BUDGETS = [500, 800, 1000, 1500, 2000];
const PLACES: Record<string, string> = {
  podjazd: 'podjazd', budynek: 'budynek z zewnątrz', ogrod: 'ogród albo taras', samochod: 'samochód lub ulicę', krajobraz: 'krajobraz',
};
const OBJECTS: Record<string, string> = {
  osoba: 'Widzę na zdjęciu osobę, ale nie widzę wnętrza.',
  zwierze: 'Na tym zdjęciu jest zwierzę, ale nie widzę wnętrza.',
  jedzenie: 'To zdjęcie jedzenia, a nie pomieszczenia.',
  dokument: 'To wygląda na dokument, rysunek albo zrzut ekranu — do takiego zdjęcia nie dobiorę mebli.',
};

// ---------------------------------------------------------------------------
function h(tag: string, attrs?: Record<string, any> | null, ...kids: any[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const bold = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const locative = (words: string[]) => words.map(w => w.replace(/e$/, 'ych')).join(', ');
const slugOf = (collection: string) => collection.toLocaleLowerCase('pl');
const pieces = (n: number) => `${n} ${n === 1 ? 'mebel' : n < 5 ? 'meble' : 'mebli'}`;

export function initAdvisor() {
  const root = document.querySelector<HTMLElement>('[data-advisor]');
  const bootEl = root?.querySelector('script[data-advisor-boot]');
  if (!root || !bootEl) return;
  const boot: Boot = JSON.parse(bootEl.textContent || '{}');
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const nav = $('.advisor-steps');
  const tabs = $$<HTMLButtonElement>('[data-step-tab]');
  const panels = $$('[data-panel]');
  const labels = tabs.map(t => t.querySelector('.advisor-steps__label')!.lastChild!.textContent || '');
  const fileInput = $<HTMLInputElement>('[data-file]');
  const cameraInput = $<HTMLInputElement>('[data-camera]');
  const drop = $('[data-drop]');
  const dropError = $('[data-drop-error]');
  const progress = $('[data-progress]');
  const seenLead = $('[data-seen-lead]');
  const seenForm = $('[data-seen-form]');
  const problem = $('[data-problem]');
  const showSetsBtn = $<HTMLButtonElement>('[data-show-sets]');
  const results = $('[data-results]');
  const fRoom = $<HTMLSelectElement>('[data-f-room]');
  const fBudget = $<HTMLSelectElement>('[data-f-budget]');
  const fType = $<HTMLSelectElement>('[data-f-type]');
  const fCheaper = $<HTMLInputElement>('[data-f-cheaper]');
  const askForm = $<HTMLFormElement>('[data-ask]');
  const askReply = $('[data-ask-reply]');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  // Na telefonie ustawienia zwinięte, żeby komplety były od razu pod polem polecenia.
  const settings = root.querySelector<HTMLDetailsElement>('[data-settings]');
  if (settings) settings.open = matchMedia('(min-width: 64rem)').matches;

  const S = {
    step: 0, reached: 0, busy: false,
    photo: null as string | null,
    analysis: null as any,
    room: null as string | null,
    tone: 0,
    maxPrice: null as number | null,
    cheaper: false,
    type: '',
    main: null as string | null,
    skip: new Set<string>(),
    alts: 2,
    ai: [] as { role: 'user' | 'assistant'; content: string }[],
  };

  // ----- dane i silnik (leniwie) ------------------------------------------------
  let productsCache: Product[] = [];
  let collectionsCache: Record<string, string> = {};
  let catalogP: Promise<Catalog> | null = null;
  const catalog = () => (catalogP ??= fetch(boot.catalogUrl)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((c: Catalog) => { productsCache = c.products; collectionsCache = c.collections || {}; return c; })
    .catch(err => { catalogP = null; throw err; }));
  let engineP: Promise<any> | null = null;
  const engineModule = () => (engineP ??= import(/* @vite-ignore */ boot.engineUrl).catch(err => { engineP = null; throw err; }));
  let engine: any = null;

  const availableRoom = (key: string | null | undefined, products: Product[]) =>
    !!key && !!boot.rooms[key] && products.some(p => (p.rooms?.length ? p.rooms.includes(key) : ROOMS[key]?.types.includes(p.type)));
  const roomKeyFromParam = (v: string | null) => {
    if (!v) return null;
    if (boot.rooms[v]) return v;
    return Object.keys(boot.rooms).find(k => boot.rooms[k].slug === v) ?? null;
  };

  // ----- kroki -------------------------------------------------------------------
  function canOpen(i: number) {
    if (i === 0) return true;
    if (i === 1) return S.reached >= 1;
    return !!S.room && S.reached >= i;
  }

  function go(step: number, { focus = true } = {}) {
    S.step = step;
    S.reached = Math.max(S.reached, step);
    panels.forEach((p, i) => { p.hidden = i !== step; });
    tabs.forEach((t, i) => {
      t.disabled = !canOpen(i);
      if (i === step) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
      t.parentElement!.classList.toggle('is-done', i < S.reached && i !== step);
    });
    nav.style.setProperty('--i', String(step));
    $('[data-step-n]').textContent = String(step + 1);
    $('[data-step-label]').textContent = labels[step];
    if (!focus) return;
    const title = panels[step].querySelector<HTMLElement>('.advisor-panel__title')!;
    if (nav.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    title.focus({ preventScroll: true });
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => {
    if (!canOpen(i) || i === S.step) return;
    go(i);
    if (i === 2) renderResults();
  }));
  root.addEventListener('click', e => {
    const el = (e.target as Element).closest<HTMLElement>('[data-go]');
    if (!el) return;
    const i = Number(el.dataset.go);
    go(i);
    if (i === 2) renderResults();
  });

  // ----- krok 1: zdjęcie albo pomieszczenie ---------------------------------------------
  if (isTouch) {
    $<HTMLButtonElement>('[data-pick="camera"]').hidden = false;
    const gallery = $<HTMLButtonElement>('[data-pick="file"]');
    gallery.textContent = gallery.dataset.labelTouch || gallery.textContent;
    gallery.classList.replace('btn--primary', 'btn--secondary');
    $$('[data-desktop-only]').forEach(el => { el.hidden = true; });
  }
  $('[data-pick="camera"]').addEventListener('click', () => cameraInput.click());
  $('[data-pick="file"]').addEventListener('click', () => fileInput.click());
  for (const input of [fileInput, cameraInput]) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) onPhoto(file);
    });
  }
  let depth = 0;
  const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes('Files');
  drop.addEventListener('dragenter', e => { if (hasFiles(e)) { depth++; drop.classList.add('is-over'); } });
  drop.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('is-over'); } });
  drop.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  drop.addEventListener('drop', e => {
    e.preventDefault(); depth = 0; drop.classList.remove('is-over');
    const file = [...(e.dataTransfer?.files || [])][0];
    if (file) onPhoto(file);
  });
  document.addEventListener('paste', e => {
    if (S.step !== 0) return;
    const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); onPhoto(file); }
  });
  $$<HTMLAnchorElement>('[data-room]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    startWithRoom(a.dataset.room!);
  }));

  function showDropError(text: string) {
    dropError.textContent = text;
    dropError.hidden = false;
  }

  async function startWithRoom(key: string, { focus = true } = {}) {
    Object.assign(S, { photo: null, analysis: null, room: key, tone: 0, type: '', main: null, maxPrice: null, cheaper: false });
    S.skip.clear();
    renderSeen();
    S.reached = Math.max(S.reached, 2);
    go(2, { focus });
    await renderResults();
  }

  async function onPhoto(file: File) {
    if (S.busy) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      showDropError('To nie jest zdjęcie. Wybierz plik JPG, PNG albo WEBP.');
      return;
    }
    S.busy = true;
    dropError.hidden = true;
    drop.setAttribute('aria-busy', 'true');
    try {
      let m: any;
      try {
        m = await engineModule();
      } catch {
        showDropError('Nie udało się uruchomić analizy zdjęć. Sprawdź połączenie z internetem albo wybierz pomieszczenie obok.');
        return;
      }
      let canvas: HTMLCanvasElement;
      try {
        canvas = await m.loadImage(file, 1024);
      } catch {
        showDropError('Nie udało się otworzyć tego zdjęcia. Jeśli to plik HEIC z iPhone’a, zapisz go jako JPG albo zrób zrzut ekranu zdjęcia.');
        return;
      }
      Object.assign(S, { photo: canvas.toDataURL('image/jpeg', 0.82), analysis: null, room: null, tone: 0, type: '', main: null });
      S.skip.clear();
      S.reached = 1; // nowe zdjęcie: komplety trzeba wyliczyć od nowa
      renderSeen({ analyzing: true });
      go(1);

      const items = [...progress.querySelectorAll('li')];
      const mark = (i: number) => items.forEach((li, j) => { li.classList.toggle('is-done', j < i); li.classList.toggle('is-active', j === i); });
      const note = (text: string) => { items[1].querySelector('.advisor-progress__note')!.textContent = text; };
      mark(0);
      await sleep(300);
      mark(1);
      engine ??= new m.VisionEngine({ embeddingsUrl: boot.embeddingsUrl });
      if (!engine.ready) note(' · pierwsze uruchomienie, pobieram model');
      engine.onProgress = (v: number) => note(v < 1 ? ` · pobieram model ${Math.round(v * 100)}%` : '');
      let analysis: any;
      try {
        [analysis] = await Promise.all([engine.analyze(canvas), catalog()]);
      } catch (err) {
        console.error('[Liveo]', err);
        progress.hidden = true;
        seenLead.textContent = 'Nie udało się teraz przeanalizować zdjęcia. Sprawdź połączenie z internetem i spróbuj ponownie albo wybierz pomieszczenie poniżej.';
        seenForm.hidden = false;
        return;
      } finally {
        note('');
      }
      mark(2);
      await sleep(400);
      mark(3);
      S.analysis = analysis;
      const d = analysis.decision;
      if (d.type === 'room') S.room = d.room;
      renderSeen();
    } finally {
      S.busy = false;
      drop.removeAttribute('aria-busy');
    }
  }

  // ----- krok 2: co widzi doradca ------------------------------------------------
  function setPhoto() {
    const frame = $('[data-photo-frame]');
    frame.querySelector('img')?.remove();
    $('[data-photo-empty]').hidden = !!S.photo;
    if (S.photo) frame.prepend(h('img', { class: 'advisor-photo__img', src: S.photo, alt: 'Twoje zdjęcie pokoju' }));
  }

  function renderPalette(el: HTMLElement, pal: any) {
    el.replaceChildren(...(pal?.colors || []).slice(0, 5).map((c: any) =>
      h('span', { style: `background:${c.hex};flex-grow:${Math.max(1, Math.round(c.share * 100))}` })));
    el.hidden = !pal?.colors?.length;
  }

  function renderSeen({ analyzing = false } = {}) {
    setPhoto();
    const a = S.analysis;
    renderPalette($('[data-palette]'), a?.palette);
    $('[data-palette-caption]').hidden = !a?.palette;
    progress.hidden = !analyzing;
    problem.hidden = true;
    seenForm.hidden = analyzing;
    if (analyzing) {
      seenLead.textContent = 'Analizuję zdjęcie w Twojej przeglądarce…';
      return;
    }
    const products = productsCache;
    let lead = '';
    if (!a) {
      lead = 'Bez zdjęcia doradca dobiera meble w uniwersalnej, jasnej kolorystyce. Zdjęcie możesz dodać w każdej chwili.';
    } else {
      const d = a.decision;
      const style = a.styles?.[0];
      const styleTxt = style && style.p > 0.3 ? ` w stylu **${style.label}**` : '';
      const pal = a.palette ? `, w ${locative(a.palette.words)} barwach` : '';
      switch (d.type) {
        case 'room':
          if (d.room === 'kuchnia' && boot.rooms.jadalnia) {
            // Kuchni nie ma na liście pomieszczeń; stoły i kredensy z jadalni pasują do kuchni z częścią jadalną.
            lead = `Widzę **kuchnię**${styleTxt}${pal}. Do kuchni z częścią jadalną pasują meble z jadalni — stoły i kredensy — więc zaznaczyłem jadalnię.`;
            S.room = 'jadalnia';
          } else if (!boot.rooms[d.room] || (products.length && !availableRoom(d.room, products))) {
            lead = `Widzę **${ROOMS[d.room]?.acc ?? 'pomieszczenie'}**, ale nie mam do tego pomieszczenia propozycji. Wybierz inne poniżej.`;
            S.room = null;
          } else {
            const alt = d.confidence < 0.6 && d.alternatives?.[0] && boot.rooms[d.alternatives[0]] ? ` Jeśli to raczej ${ROOMS[d.alternatives[0]].name}, wybierz to poniżej.` : '';
            lead = `Widzę **${ROOMS[d.room].acc}**${styleTxt}${pal}.${alt}`;
          }
          break;
        case 'ask':
          lead = d.reason === 'empty' ? `To **puste pomieszczenie**${pal}. Wybierz, czym ma być.` : 'Nie mam pewności, jakie to pomieszczenie. Wybierz je poniżej.';
          break;
        case 'product':
          lead = 'Widzę na zdjęciu pojedynczy mebel. Najlepiej działam ze zdjęciem całego pomieszczenia, ale mogę dobrać meble w podobnej kolorystyce. Wybierz pomieszczenie.';
          break;
        case 'nofurn':
          lead = d.scene?.key === 'garaz'
            ? 'To **garaż** — tutaj nasze meble raczej się nie sprawdzą. Dodaj zdjęcie innego pomieszczenia.'
            : 'To **łazienka** — w ofercie Liveo nie ma mebli łazienkowych. Dodaj zdjęcie innego pomieszczenia.';
          seenForm.hidden = true;
          problem.hidden = false;
          break;
        case 'reject':
        default: {
          const place = PLACES[d.scene?.key];
          lead = `${place ? `Wygląda na to, że to zdjęcie przedstawia **${place}**.` : OBJECTS[d.scene?.key] || 'Na tym zdjęciu nie widzę wnętrza.'} Liveo tworzy meble do wnętrz — dodaj zdjęcie pomieszczenia, które urządzasz.`;
          seenForm.hidden = true;
          problem.hidden = false;
        }
      }
    }
    seenLead.innerHTML = bold(lead);
    syncControls();
  }

  $('[data-force-room]').addEventListener('click', () => { problem.hidden = true; seenForm.hidden = false; });
  $$<HTMLInputElement>('[data-room-radio]').forEach(r => r.addEventListener('change', () => {
    S.room = r.value; S.type = ''; S.main = null; S.skip.clear();
    syncControls();
  }));
  $$<HTMLInputElement>('[data-tone-radio]').forEach(r => r.addEventListener('change', () => {
    S.tone = Number(r.value); S.main = null;
    syncControls();
    if (S.step === 2) renderResults();
  }));
  showSetsBtn.addEventListener('click', () => {
    if (!S.room) return;
    S.main = null;
    S.reached = Math.max(S.reached, 2);
    go(2);
    renderResults();
  });

  // ----- krok 3: komplety i filtry ------------------------------------------------

  function fillTypes() {
    const types: string[] = S.room ? ROOMS[S.room].types.filter((t: string) => productsCache.some(p => p.type === t)) : [];
    const keep = fType.value;
    fType.replaceChildren(h('option', { value: '' }, 'Cały komplet'), ...types.map(t => h('option', { value: t }, TYPES[t][1])));
    fType.value = types.includes(S.type) ? S.type : types.includes(keep) && keep === S.type ? keep : '';
    if (!types.includes(S.type)) S.type = '';
  }

  function syncControls() {
    $$<HTMLInputElement>('[data-room-radio]').forEach(r => { r.checked = r.value === S.room; });
    $$<HTMLInputElement>('[data-tone-radio]').forEach(r => { r.checked = Number(r.value) === S.tone; });
    showSetsBtn.disabled = !S.room;
    if (S.room) fRoom.value = S.room;
    if (S.maxPrice && ![...fBudget.options].some(o => o.value === String(S.maxPrice))) {
      fBudget.append(h('option', { value: S.maxPrice }, `do ${formatPrice(S.maxPrice)}`));
    }
    fBudget.value = S.maxPrice ? String(S.maxPrice) : '';
    fCheaper.checked = S.cheaper;
    fillTypes();
    tabs.forEach((t, i) => { t.disabled = !canOpen(i); });
  }

  fRoom.addEventListener('change', () => { S.room = fRoom.value; S.type = ''; S.main = null; S.skip.clear(); renderResults(); });
  fBudget.addEventListener('change', () => { S.maxPrice = fBudget.value ? Number(fBudget.value) : null; S.main = null; renderResults(); });
  fType.addEventListener('change', () => { S.type = fType.value; renderResults(); });
  fCheaper.addEventListener('change', () => { S.cheaper = fCheaper.checked; S.main = null; renderResults(); });

  function prefs() {
    const p = prefsFromAnalysis(S.analysis);
    if (S.tone) {
      p.light = clamp(p.light + S.tone * 0.28);
      if (S.tone < 0) p.black = clamp(p.black + 0.2);
    }
    return p;
  }

  function renderSummary() {
    const thumb = $('[data-summary-thumb]');
    thumb.hidden = !S.photo;
    thumb.style.backgroundImage = S.photo ? `url("${S.photo}")` : '';
    const room = S.room ? boot.rooms[S.room]?.name ?? ROOMS[S.room]?.label : '';
    $('[data-summary-room]').replaceChildren(h('b', null, room), h('span', null, S.analysis ? 'kolory z Twojego zdjęcia' : 'bez zdjęcia'));
    renderPalette($('[data-summary-palette]'), S.analysis?.palette);
  }

  function card(p: Product) {
    const off = p.regular && p.price != null ? Math.round((1 - p.price / p.regular) * 100) : 0;
    const name = p.model !== p.collection ? p.model : p.name;
    return h('li', { class: 'product-card advisor-card' },
      h('a', { class: 'product-card__link', href: p.url },
        h('div', { class: 'media media--contain', style: '--media-ratio: 1' },
          h('img', { class: 'media__img', src: p.img, alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 480 })),
        h('h4', { class: 'product-card__title' }, name)),
      p.color && h('p', { class: 'product-card__meta' }, p.color.label),
      p.price == null ? h('p', { class: 'product-card__meta' }, 'Cena w salonie partnerskim') : h('div', { class: 'price price--card' + (p.regular ? ' price--promo' : '') },
        h('p', { class: 'price__main' },
          h('span', { class: 'price__current' }, formatPrice(p.price)),
          p.regular && h('s', { class: 'price__regular' }, h('span', { class: 'visually-hidden' }, 'Cena regularna: '), formatPrice(p.regular))),
        p.regular && h('p', { class: 'price__lowest' }, `Najniższa cena z 30 dni przed obniżką: ${formatPrice(p.lowest30 ?? p.regular)}`)),
      off >= 5 && h('p', { class: 'product-card__badges' }, h('span', { class: 'badge badge--promo' }, `−${off}%`)));
  }

  /** Kółko koloru mebli; kolor dwóch płyt („Biały mat / dąb naturalny”) jako dwie połówki. */
  function finishChip(color: { label: string } | null) {
    if (!color) return null;
    const hex = color.label.split('/').map(s => boot.finishHex[s.trim().toLocaleLowerCase('pl')]).filter(Boolean);
    const [a = '#d6cfc5', b = a] = hex;
    return h('span', { class: 'advisor-finish' }, h('i', { style: `--c:${a};--c2:${b}` }), color.label);
  }

  function emptyState(text: string, action?: { label: string; run: () => void }) {
    results.replaceChildren(h('div', { class: 'advisor-empty' },
      h('p', null, text),
      action && h('button', { class: 'btn btn--secondary', type: 'button', onclick: action.run }, action.label)));
  }

  async function renderResults() {
    if (!S.room) return;
    let data: Catalog;
    try {
      data = await catalog();
    } catch {
      emptyState('Nie udało się wczytać katalogu mebli. Sprawdź połączenie z internetem.', { label: 'Spróbuj ponownie', run: renderResults });
      return;
    }
    syncControls();
    renderSummary();
    const room = boot.rooms[S.room];
    const forWhom = S.analysis ? 'do Twojego wnętrza' : `do ${room?.genitive ?? ROOMS[S.room].gen}`;
    const p = prefs();

    if (S.type) {
      const items = recommendByType(data.products, S.type, p, { room: S.room, maxPrice: S.maxPrice ?? undefined, budget: S.cheaper, limit: 8 }) as Product[];
      if (!items.length) return emptyState(`Nie ma takich mebli${S.maxPrice ? ` do ${formatPrice(S.maxPrice)}` : ''}.`, S.maxPrice ? { label: 'Usuń limit ceny', run: () => { S.maxPrice = null; renderResults(); } } : undefined);
      results.replaceChildren(h('div', null,
        h('h3', { class: 'advisor-results__title' }, `${TYPES[S.type][1]}${S.maxPrice ? ` do ${formatPrice(S.maxPrice)}` : ''}, które najlepiej pasują ${forWhom}`),
        h('ul', { class: 'product-grid advisor-grid' }, items.map(card)),
        h('p', { class: 'advisor-results__back' }, h('button', { class: 'link-button', type: 'button', onclick: () => { S.type = ''; renderResults(); } }, 'Wróć do całych kompletów'))));
      return;
    }

    const sets = recommendSets(data.products, S.room, p, { skip: S.skip, maxPrice: S.maxPrice ?? undefined, budget: S.cheaper }) as Set_[];
    if (!sets.length) {
      if (S.skip.size) return emptyState('To już wszystkie kolekcje, które pasują do tych ustawień.', { label: 'Pokaż od najlepiej dopasowanej', run: () => { S.skip.clear(); renderResults(); } });
      return emptyState(`Nie ma kompletów${S.maxPrice ? ` z meblami do ${formatPrice(S.maxPrice)}` : ''} do tego pomieszczenia.`, S.maxPrice ? { label: 'Usuń limit ceny', run: () => { S.maxPrice = null; renderResults(); } } : undefined);
    }
    const main = sets.find(s => s.collection === S.main) ?? sets[0];
    S.main = main.collection;
    const alts = sets.filter(s => s !== main);
    const why = explainSet(main, p, !!S.analysis);
    const href = collectionsCache[main.collection];

    const mainEl = h('article', { class: 'advisor-set', 'aria-labelledby': 'komplet-tytul' },
      h('header', { class: 'advisor-set__head' },
        h('div', null,
          h('h3', { class: 'advisor-set__title', id: 'komplet-tytul', tabindex: '-1' }, `Kolekcja ${main.collection}`),
          h('p', { class: 'advisor-set__why' }, why || `Meble z jednej kolekcji ${forWhom}.`)),
        h('div', { class: 'advisor-match' },
          S.analysis?.palette && h('span', { class: 'advisor-match__room' }, h('span', { class: 'advisor-palette advisor-palette--small', 'aria-hidden': 'true' }), 'Twój pokój'),
          S.analysis?.palette && h('span', { class: 'advisor-match__sep', 'aria-hidden': 'true' }),
          finishChip(main.color))),
      h('ul', { class: 'product-grid advisor-grid' }, main.items.map(card)),
      h('footer', { class: 'advisor-set__foot' },
        h('p', { class: 'advisor-set__total' }, main.total > 0 ? [`${pieces(main.items.length)} razem `, h('b', null, formatPrice(main.total))] : `${pieces(main.items.length)} z jednej kolekcji`),
        h('div', { class: 'advisor-set__actions' },
          href && h('a', { class: 'btn btn--secondary', href }, `Cała kolekcja ${main.collection}`),
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => { S.reached = 3; go(3); } }, `Gdzie kupić ${main.collection}`))));
    const pal = mainEl.querySelector<HTMLElement>('.advisor-match .advisor-palette');
    if (pal) renderPalette(pal, S.analysis.palette);

    const shown = alts.slice(0, S.alts);
    const altsEl = shown.length ? h('section', { class: 'advisor-alts', 'aria-labelledby': 'inne-tytul' },
      h('h3', { class: 'advisor-alts__title', id: 'inne-tytul' }, `Też pasują ${forWhom}`),
      h('ul', { class: 'advisor-alts__list' }, shown.map(s => h('li', { class: 'advisor-alt' },
        h('div', { class: 'advisor-alt__thumbs', 'aria-hidden': 'true' }, s.items.slice(0, 4).map(it => h('img', { src: it.img, alt: '', loading: 'lazy', width: 160, height: 160 }))),
        h('div', { class: 'advisor-alt__body' },
          h('p', { class: 'advisor-alt__name' }, `Kolekcja ${s.collection}`),
          h('p', { class: 'advisor-alt__meta' }, finishChip(s.color), h('span', null, s.total > 0 ? `${pieces(s.items.length)} · ${formatPrice(s.total)}` : pieces(s.items.length)))),
        h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => pickSet(s.collection) }, 'Pokaż ten komplet')))),
      alts.length > shown.length && h('button', { class: 'link-button advisor-alts__more', type: 'button', onclick: () => { S.alts += 2; renderResults(); } },
        `Pokaż kolejne kolekcje (${alts.length - shown.length})`)) : null;

    results.replaceChildren(mainEl, altsEl ?? '');
    renderChosen(main);
  }

  function pickSet(collection: string) {
    S.main = collection;
    renderResults().then(() => {
      const t = results.querySelector<HTMLElement>('#komplet-tytul');
      if (!t) return;
      if (t.getBoundingClientRect().top < 0) t.scrollIntoView({ block: 'center' });
      t.focus({ preventScroll: true });
    });
  }

  // ----- polecenia tekstowe ------------------------------------------------------
  function reply(text: string, ai = false, link?: { label: string; href: string }) {
    askReply.innerHTML = (ai ? '<span class="advisor-ask__ai">Asystent AI</span> ' : '') + bold(text);
    if (link) askReply.append(' ', h('a', { href: link.href }, link.label));
    askReply.hidden = false;
  }

  askForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = askForm.elements.namedItem('q') as HTMLInputElement;
    const text = input.value.trim();
    if (text) onAsk(text);
  });
  $$<HTMLButtonElement>('[data-example]').forEach(b => b.addEventListener('click', () => {
    (askForm.elements.namedItem('q') as HTMLInputElement).value = b.textContent || '';
    onAsk(b.textContent || '');
  }));

  async function onAsk(text: string) {
    try { await catalog(); } catch { /* renderResults pokaże komunikat */ }
    if (boot.chatUrl) {
      const ai = await askAI(text);
      if (ai) {
        reply(ai.reply, true);
        return applyAction(ai.action);
      }
    }
    applyLocal(text);
  }

  async function askAI(text: string): Promise<{ reply: string; action: any } | null> {
    S.ai.push({ role: 'user', content: text.slice(0, 1000) });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    askForm.setAttribute('aria-busy', 'true');
    try {
      const main = S.main ? `${S.main}` : null;
      const res = await fetch(boot.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: S.ai.slice(-8),
          context: { catalog: catalogSummary(productsCache), state: { room: S.room, lastSet: main, hasPhoto: !!S.analysis, maxPrice: S.maxPrice } },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('pusta odpowiedź');
      S.ai.push({ role: 'assistant', content: data.reply.slice(0, 1000) });
      return { reply: data.reply, action: data.action || null };
    } catch (err) {
      S.ai.pop();
      console.warn('[Liveo] asystent AI niedostępny — tryb lokalny', err);
      return null;
    } finally {
      clearTimeout(timer);
      askForm.removeAttribute('aria-busy');
    }
  }

  function applyAction(a: any) {
    switch (a?.type) {
      case 'room':
        if (boot.rooms[a.room]) Object.assign(S, { room: a.room, type: '', main: null, maxPrice: a.maxPrice || S.maxPrice });
        break;
      case 'furniture':
        if (TYPES[a.furnitureType]) {
          const room = boot.rooms[a.room] ? a.room : S.room && ROOMS[S.room].types.includes(a.furnitureType) ? S.room
            : Object.keys(boot.rooms).find(k => ROOMS[k]?.types.includes(a.furnitureType)) ?? S.room;
          Object.assign(S, { room, type: a.furnitureType, maxPrice: a.maxPrice || S.maxPrice });
        }
        break;
      case 'more':
        if (a.tone) S.tone = a.tone === 'lighter' ? 1 : -1;
        if (a.cheaper) S.cheaper = true;
        if (!a.tone && !a.cheaper && S.main) S.skip.add(S.main);
        S.main = null;
        break;
      case 'photo':
        return go(0);
      case 'stores':
        S.reached = 3;
        return go(3);
      case 'contact':
        askReply.append(' ', h('a', { href: '/kontakt/' }, 'Kontakt z Liveo'));
        return;
    }
    renderResults();
  }

  function applyLocal(text: string) {
    const q = parseQuery(text);
    if (q.nofurn) return reply(q.nofurn === 'lazienka' ? 'W ofercie Liveo nie ma mebli łazienkowych.' : 'Do garażu nasze meble raczej się nie sprawdzą.');
    if (q.outdoor && !q.room) return reply('Liveo tworzy meble do wnętrz — nie ma w ofercie mebli ogrodowych ani balkonowych.');
    if (q.info) return reply('W sprawach zamówień, dostawy, montażu i gwarancji pomoże obsługa klienta Liveo.', false, { label: 'Kontakt z Liveo', href: '/kontakt/' });

    const done: string[] = [];
    if (q.room && boot.rooms[q.room] && availableRoom(q.room, productsCache)) {
      if (q.room !== S.room) { Object.assign(S, { room: q.room, type: '', main: null }); S.skip.clear(); }
      done.push(boot.rooms[q.room].name.toLocaleLowerCase('pl'));
    }
    if (q.type && TYPES[q.type]) {
      if (!S.room || !ROOMS[S.room].types.includes(q.type)) {
        const other = Object.keys(boot.rooms).find(k => ROOMS[k]?.types.includes(q.type) && availableRoom(k, productsCache));
        if (other) { S.room = other; done.push(boot.rooms[other].name.toLocaleLowerCase('pl')); }
      }
      if (S.room && ROOMS[S.room].types.includes(q.type)) { S.type = q.type; done.push(TYPES[q.type][1].toLocaleLowerCase('pl')); }
    }
    if (q.maxPrice) { S.maxPrice = q.maxPrice; S.main = null; done.push(`do ${formatPrice(q.maxPrice)} za mebel`); }
    if (q.budget && !q.maxPrice) { S.cheaper = true; S.main = null; done.push('najpierw tańsze'); }
    if (q.lighter || q.darker) { S.tone = q.lighter ? 1 : -1; S.main = null; done.push(q.lighter ? 'jaśniejsze meble' : 'ciemniejsze meble'); }
    if (q.next && !q.type) {
      if (S.main) S.skip.add(S.main);
      S.main = null;
      done.push('inna kolekcja');
    }
    if (!done.length) {
      return reply(q.greet || q.thanks || q.help
        ? 'Napisz, czego szukasz, np. „komoda do 1000 zł”, „jaśniejsze” albo „szafa do przedpokoju”. Możesz też użyć ustawień poniżej.'
        : 'Nie zrozumiałem tego polecenia. Spróbuj np. „komoda do 1000 zł”, „jaśniejsze” albo „szafa do przedpokoju”.');
    }
    reply(`Ustawiam: ${done.join(', ')}.`);
    renderResults();
  }

  // ----- krok 4: gdzie kupić -------------------------------------------------------
  function renderChosen(set: Set_) {
    $('[data-chosen]').replaceChildren(
      h('p', { class: 'advisor-chosen__title' }, `Twój komplet: kolekcja ${set.collection}`),
      h('p', { class: 'advisor-chosen__meta' }, finishChip(set.color), h('span', null, set.total > 0 ? `${pieces(set.items.length)} razem ${formatPrice(set.total)}` : pieces(set.items.length))),
      h('div', { class: 'advisor-chosen__thumbs', 'aria-hidden': 'true' }, set.items.slice(0, 6).map(it => h('img', { src: it.img, alt: '', loading: 'lazy', width: 160, height: 160 }))),
      h('button', { class: 'link-button', type: 'button', 'data-go': '2' }, 'Wróć do kompletów'));
    const select = root.querySelector<HTMLSelectElement>('#doradca-sklepy [data-sf-collection]');
    const slug = slugOf(set.collection);
    if (select && [...select.options].some(o => o.value === slug)) select.value = slug;
  }

  // ----- od nowa --------------------------------------------------------------------
  $$('[data-restart]').forEach(b => b.addEventListener('click', () => {
    Object.assign(S, { reached: 0, photo: null, analysis: null, room: null, tone: 0, maxPrice: null, cheaper: false, type: '', main: null, alts: 2 });
    S.skip.clear();
    results.replaceChildren();
    askReply.hidden = true;
    renderSeen();
    history.replaceState(null, '', location.pathname + location.hash);
    go(0);
  }));

  // ----- wejście z czatu albo z linku ?pokoj= ---------------------------------------------
  let handoff: any = null;
  try {
    handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch { /* tryb prywatny */ }
  const roomParam = roomKeyFromParam(new URLSearchParams(location.search).get('pokoj'));
  if (handoff?.v === 1 && (handoff.analysis || handoff.room)) {
    Object.assign(S, {
      photo: typeof handoff.photo === 'string' && handoff.photo.startsWith('data:image/') ? handoff.photo : null,
      analysis: handoff.analysis || null,
      room: boot.rooms[handoff.room] ? handoff.room : roomParam,
      main: handoff.collection || null,
      maxPrice: Number(handoff.opts?.maxPrice) || null,
      cheaper: !!handoff.opts?.budget,
    });
    S.reached = S.room ? 2 : 1;
    renderSeen();
    go(S.room ? 2 : 1, { focus: false });
    if (S.room) renderResults();
  } else if (roomParam) {
    startWithRoom(roomParam, { focus: false });
  }
  // katalog w czasie bezczynności — pierwsze kliknięcie pokoju pokazuje wynik od razu
  const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
  (idle ?? setTimeout)(() => { catalog().catch(() => {}); });
}
