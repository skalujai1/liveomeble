// Asystent wnętrz Liveo – widżet czatu do osadzenia na stronie sklepu.
//
// Osadzenie (jedna linia przed </body>):
//   <script type="module" src="/liveo-assistant/widget/liveo-assistant.js"></script>
//
// Opcjonalna konfiguracja (przed skryptem):
//   <script>window.LiveoAssistantConfig = { demoSamples: false, chatUrl: 'https://liveo-doradca.<konto>.workers.dev/chat' }</script>
//
// chatUrl – adres Workera z modelem językowym (../worker). Pusty = tryb lokalny: proste polecenia
// rozumiane bez AI. Gdy Worker nie odpowie, widżet też wraca do trybu lokalnego.

import { VisionEngine, loadImage } from './engine.js';
import {
  ROOMS, TYPES, NEUTRAL, prefsFromAnalysis, recommendSets, recommendByType, explainSet, formatPrice,
} from './recommender.js';

const HERE = new URL('./', import.meta.url);
const CFG = {
  catalogUrl: new URL('../data/catalog.json', HERE).href,
  embeddingsUrl: new URL('../data/text-embeddings.json', HERE).href,
  cssUrl: new URL('liveo-assistant.css', HERE).href,
  logoUrl: 'https://liveomeble.pl/img/liveo_logo.svg',
  contactUrl: 'https://liveomeble.pl/kontakt',
  storesUrl: '/gdzie-kupic/',
  chatUrl: '',          // Worker z modelem językowym; pusty = tylko tryb lokalny
  chatTimeout: 30000,
  demoSamples: true, // przykładowe zdjęcia do testów (prototyp)
  teaserDelay: 1800,
  ...(window.LiveoAssistantConfig || {}),
};

const unsplash = id => `https://images.unsplash.com/${id}?w=900&q=75&fm=jpg`;
const SAMPLES = [
  { label: 'Salon', url: unsplash('photo-1583847268964-b28dc8f51f92') },
  { label: 'Sypialnia', url: unsplash('photo-1522771739844-6a9f6d5f14af') },
  { label: 'Loft', url: unsplash('photo-1507149833265-60c372daea22') },
  { label: 'Kuchnia', url: unsplash('photo-1556911220-bff31c812dba') },
  { label: 'Podjazd', url: unsplash('photo-1692133188474-8c5591e6a6a8') },
  { label: 'Łazienka', url: unsplash('photo-1584622650111-993a426fbf0a') },
];

// ---------------------------------------------------------------------------
// Ikony (Lucide, licencja ISC)
// ---------------------------------------------------------------------------
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I = {
  camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.2"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
  imagePlus: svg('<path d="M16 5h6M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/><circle cx="9" cy="9" r="2"/>'),
  send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  restart: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  sofa: svg('<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2M20 18v2"/>'),
  sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  left: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
  external: svg('<path d="M7 17 17 7M7 7h10v10"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
};

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Minimalny markdown: **pogrubienie**, akapity. */
const md = text => text.split(/\n+/).map(p => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`).join('');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const cap = s => s[0].toUpperCase() + s.slice(1);
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* prywatny tryb */ } },
};
const isTouch = matchMedia('(pointer: coarse)').matches;
// "jasne, ciepłe" → "jasnych, ciepłych"
const locative = words => words.map(w => w.replace(/e$/, 'ych')).join(', ');

const PLACES = {
  podjazd: ['podjazd', '🚗'], budynek: ['budynek z zewnątrz', '🏠'], ogrod: ['ogród albo taras', '🌿'],
  samochod: ['samochód lub ulicę', '🚙'], krajobraz: ['krajobraz', '🏞️'],
};
const OBJECTS = {
  osoba: 'Widzę na zdjęciu osobę, ale nie widzę wnętrza 🙂',
  zwierze: 'Uroczy zwierzak! 🐾 Niestety na tym zdjęciu nie widzę wnętrza.',
  jedzenie: 'Wygląda smakowicie 🍽️, ale to nie jest zdjęcie pomieszczenia.',
  dokument: 'To wygląda na dokument, rysunek albo zrzut ekranu 📄 – do takiego zdjęcia nie dobiorę mebli.',
};

// ---------------------------------------------------------------------------
// Rozumienie krótkich wiadomości tekstowych (prototyp – bez modelu językowego)
// ---------------------------------------------------------------------------
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

function parse(text) {
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

// ---------------------------------------------------------------------------
// Widżet
// ---------------------------------------------------------------------------
class LiveoAssistant {
  constructor() {
    this.products = [];
    this.collections = {};
    this.analysis = null;   // wynik analizy ostatniego zdjęcia
    this.room = null;
    this.prefs = { ...NEUTRAL };
    this.opts = {};         // { budget, maxPrice }
    this.shown = new Set(); // pokazane kolekcje
    this.busy = false;
    this.history = [];      // tekst rozmowy dla modelu językowego (bez zdjęć)
    this.engine = new VisionEngine({
      embeddingsUrl: CFG.embeddingsUrl,
      onProgress: p => this.setStatus(p < 1 ? `Przygotowuję analizę zdjęć… ${Math.round(p * 100)}%` : null),
    });
  }

  // ----- montaż ---------------------------------------------------------------
  mount() {
    if (!document.querySelector('link[data-liveo-fonts]')) {
      document.head.append(h('link', { rel: 'stylesheet', 'data-liveo-fonts': true,
        href: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Questrial&display=swap' }));
    }
    this.host = h('div', { id: 'liveo-assistant', style: 'visibility:hidden' });
    const root = this.host.attachShadow({ mode: 'open' });
    const css = h('link', { rel: 'stylesheet', href: CFG.cssUrl });
    css.addEventListener('load', () => this.host.style.removeProperty('visibility'));
    root.append(css, this.buildPanel(), this.buildLauncher());
    this.root = root;
    document.body.append(this.host);

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen) this.close(); });
    document.addEventListener('paste', e => this.isOpen && this.onPaste(e));

    if (!store.get('lv-teaser-seen')) setTimeout(() => !this.isOpen && this.showTeaser(), CFG.teaserDelay);
    window.LiveoAssistant = { open: () => this.open(), close: () => this.close(), instance: this };
  }

  buildLauncher() {
    this.launcher = h('button', {
      class: 'launcher', 'aria-label': 'Otwórz doradcę wnętrz Liveo', 'aria-expanded': 'false',
      'aria-controls': 'lv-panel', onclick: () => (this.isOpen ? this.close() : this.open()),
    });
    this.launcher.innerHTML = `<span class="ic-open">${I.sofa}</span><span class="ic-close">${I.close}</span><span class="dot">${I.sparkle}</span>`;
    return this.launcher;
  }

  showTeaser() {
    if (this.teaser || this.isOpen) return;
    this.teaser = h('div', { class: 'teaser', role: 'status' },
      h('button', { class: 'teaser-main', onclick: () => this.open() },
        h('div', null, h('b', null, 'Dobierz meble do wnętrza'), h('span', null, 'Wyślij zdjęcie pokoju – pokażę pasujące meble'))),
      h('button', { class: 'teaser-x', 'aria-label': 'Zamknij podpowiedź', html: I.close, onclick: () => this.hideTeaser() }));
    this.root.append(this.teaser);
  }

  hideTeaser() {
    this.teaser?.remove();
    this.teaser = null;
    store.set('lv-teaser-seen', '1');
  }

  buildPanel() {
    this.status = h('div', { class: 'status' }, h('i'), h('span', null, 'Online'));
    this.messages = h('div', { class: 'messages', role: 'log', 'aria-live': 'polite', 'aria-label': 'Rozmowa' });
    this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => this.onFiles(e.target.files) });
    this.cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => this.onFiles(e.target.files) });
    this.input = h('input', {
      type: 'text', placeholder: 'Napisz albo dodaj zdjęcie…', 'aria-label': 'Wiadomość', enterkeyhint: 'send', autocomplete: 'off',
      oninput: () => { this.sendBtn.disabled = !this.input.value.trim(); },
    });
    this.sendBtn = h('button', { class: 'send', type: 'submit', 'aria-label': 'Wyślij', disabled: true, html: I.send });
    this.dropzone = h('div', { class: 'dropzone', html: `<div>${I.imagePlus}<b>Upuść zdjęcie tutaj</b><span>dobiorę do niego meble</span></div>` });

    this.panel = h('section', { class: 'panel', id: 'lv-panel', role: 'dialog', 'aria-label': 'Doradca wnętrz Liveo' },
      h('header', { class: 'head' },
        h('img', { class: 'logo', src: CFG.logoUrl, alt: 'Liveo Meble' }),
        h('div', { class: 'titles' }, h('h2', null, 'Doradca wnętrz'), this.status),
        h('button', { class: 'icon-btn', 'aria-label': 'Zacznij od nowa', title: 'Zacznij od nowa', html: I.restart, onclick: () => this.restart() }),
        h('button', { class: 'icon-btn', 'aria-label': 'Zamknij', title: 'Zamknij', html: I.close, onclick: () => this.close() })),
      this.messages,
      h('div', { class: 'composer' },
        h('form', { onsubmit: e => { e.preventDefault(); this.onText(); } },
          h('button', { class: 'attach', type: 'button', 'aria-label': 'Dodaj zdjęcie', title: 'Dodaj zdjęcie', html: I.imagePlus,
                        onclick: () => this.fileInput.click() }),
          this.input, this.sendBtn),
        h('p', { class: 'fineprint' }, CFG.chatUrl
          ? 'Odpowiada asystent AI – może się mylić · zdjęcia zostają na Twoim urządzeniu'
          : 'Wersja testowa · zdjęcia są analizowane tylko na Twoim urządzeniu')),
      this.fileInput, this.cameraInput, this.dropzone);

    // przeciągnij i upuść
    let depth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    this.panel.addEventListener('dragenter', e => { if (hasFiles(e)) { depth++; this.dropzone.classList.add('show'); } });
    this.panel.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; this.dropzone.classList.remove('show'); } });
    this.panel.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    this.panel.addEventListener('drop', e => {
      e.preventDefault(); depth = 0; this.dropzone.classList.remove('show');
      this.onFiles(e.dataTransfer.files);
    });
    return this.panel;
  }

  // ----- otwieranie -----------------------------------------------------------
  get isOpen() { return this.panel.classList.contains('open'); }

  open() {
    this.hideTeaser();
    this.panel.classList.add('open');
    this.launcher.setAttribute('aria-expanded', 'true');
    this.launcher.setAttribute('aria-label', 'Zamknij doradcę wnętrz');
    if (matchMedia('(max-width: 520px)').matches) document.documentElement.style.overflow = 'hidden';
    if (!this.started) {
      this.started = true;
      this.catalogReady = this.loadCatalog();
      this.engine.load().catch(() => this.setStatus(null)); // model pobiera się w tle
      this.greet();
    }
    if (!isTouch) setTimeout(() => this.input.focus({ preventScroll: true }), 300);
  }

  close() {
    this.panel.classList.remove('open');
    this.launcher.setAttribute('aria-expanded', 'false');
    this.launcher.setAttribute('aria-label', 'Otwórz doradcę wnętrz Liveo');
    document.documentElement.style.removeProperty('overflow');
    this.launcher.focus({ preventScroll: true });
  }

  restart() {
    if (this.busy) return;
    this.messages.replaceChildren();
    Object.assign(this, { analysis: null, room: null, prefs: { ...NEUTRAL }, opts: {}, shown: new Set(), busy: false, history: [], current: null });
    this.greet();
  }

  async loadCatalog() {
    const res = await fetch(CFG.catalogUrl);
    const data = await res.json();
    this.products = data.products;
    this.collections = data.collections || {};
  }

  setStatus(text) {
    this.status.classList.toggle('loading', !!text);
    this.status.lastChild.textContent = text || 'Online';
  }

  // ----- wiadomości -----------------------------------------------------------
  add(el, { scroll = true } = {}) {
    this.messages.append(el);
    if (scroll) this.scrollTo(el);
    return el;
  }

  /** Przewija tak, żeby początek nowej wiadomości był widoczny. */
  scrollTo(el) {
    const box = this.messages;
    box.scrollTop = Math.min(el.offsetTop - 12, box.scrollHeight - box.clientHeight);
  }

  bot(html, extra) {
    return this.add(h('div', { class: 'msg bot' }, h('div', { html }), extra));
  }

  async say(text, extra) {
    const typing = this.add(h('div', { class: 'msg bot typing', 'aria-label': 'Doradca pisze' }, h('i'), h('i'), h('i')));
    await sleep(Math.min(900, 280 + text.length * 4));
    typing.remove();
    this.remember('assistant', text);
    return this.bot(md(text), extra);
  }

  user(text) {
    this.remember('user', text);
    this.add(h('div', { class: 'msg user' }, text));
  }

  remember(role, content) {
    this.history.push({ role, content: String(content).slice(0, 1000) });
    if (this.history.length > 16) this.history.splice(0, this.history.length - 16);
  }

  userPhoto(src) {
    this.add(h('div', { class: 'msg user photo' }, h('img', { src, alt: 'Twoje zdjęcie' })));
  }

  clearChips() { this.messages.querySelectorAll('.chips').forEach(c => c.remove()); }

  /** Szybkie odpowiedzi pod ostatnią wiadomością. */
  chips(items, label) {
    this.clearChips();
    const box = h('div', { class: 'chips' }, label && h('div', { class: 'chips-label' }, label));
    for (const c of items.filter(Boolean)) {
      const el = c.href
        ? h('a', { class: 'chip', href: c.href, target: '_blank', rel: 'noopener' }, c.label)
        : h('button', { class: 'chip' + (c.primary ? ' primary' : ''), type: 'button', onclick: () => {
            if (this.busy) return;
            if (!c.keep) box.remove(); // "Wyślij zdjęcie" zostaje – klient może zamknąć wybór pliku
            if (c.echo !== false) this.user(c.echo || c.label.replace(/^\p{Extended_Pictographic}️?\s*/u, ''));
            c.run();
          } }, c.icon && h('span', { html: c.icon, style: 'display:contents' }), c.label);
      box.append(el);
    }
    return this.add(box, { scroll: false });
  }

  /** Pomieszczenia, do których katalog ma meble (przed wczytaniem katalogu – wszystkie). */
  availableRooms() {
    if (!this.products.length) return Object.keys(ROOMS);
    return Object.keys(ROOMS).filter(k => this.products.some(p => (p.rooms?.length ? p.rooms.includes(k) : ROOMS[k].types.includes(p.type))));
  }

  roomChips(keys = Object.keys(ROOMS), extra = []) {
    const available = this.availableRooms();
    const order = [...new Set([...keys, ...Object.keys(ROOMS)])].filter(k => available.includes(k));
    return [...extra, ...order.map(k => ({ label: `${ROOMS[k].emoji} ${ROOMS[k].label}`, run: () => this.showRoom(k) }))];
  }

  photoChip(primary = true) {
    return { label: 'Wyślij zdjęcie', icon: I.camera, primary, echo: false, keep: true, run: () => this.pickPhoto() };
  }

  pickPhoto() { (isTouch ? this.cameraInput : this.fileInput).click(); }

  // ----- powitanie ------------------------------------------------------------
  greet() {
    this.bot(md('Cześć! 👋 Jestem **doradcą wnętrz Liveo**.\nPokaż mi pomieszczenie, które urządzasz, a w kilka sekund dobiorę pasujące meble z naszej oferty.'));
    this.add(this.buildUpload(), { scroll: false });
    // pokoje z katalogu – po jego wczytaniu (bez czekania, gdy katalog się nie wczyta)
    const showRooms = () => this.chips(this.roomChips(), 'Nie masz zdjęcia pod ręką? Wybierz pomieszczenie:');
    (this.catalogReady || Promise.resolve()).then(showRooms, showRooms);
  }

  buildUpload() {
    const card = h('div', { class: 'upload' },
      h('div', { class: 'big-ic', html: I.camera }),
      h('h3', null, 'Dodaj zdjęcie pomieszczenia'),
      h('p', null, isTouch ? 'Zrób zdjęcie albo wybierz je z galerii' : 'Kliknij, przeciągnij plik albo wklej (Ctrl+V)'),
      h('div', { class: 'actions' },
        isTouch && h('button', { class: 'btn', type: 'button', html: `${I.camera}<span>Zrób zdjęcie</span>`, onclick: () => this.cameraInput.click() }),
        h('button', { class: 'btn' + (isTouch ? ' ghost' : ''), type: 'button', html: `${I.image}<span>${isTouch ? 'Z galerii' : 'Wybierz zdjęcie'}</span>`,
                      onclick: () => this.fileInput.click() })),
      CFG.demoSamples && h('div', { class: 'samples' },
        h('span', null, 'Albo sprawdź, jak to działa, na przykładzie:'),
        h('div', { class: 'row' }, SAMPLES.map(s => h('button', { class: 'sample', type: 'button', 'aria-label': `Przykład: ${s.label}`,
          onclick: () => this.analyzePhoto(s.url) }, h('img', { src: s.url.replace('w=900', 'w=300'), alt: '', loading: 'lazy' }), h('span', null, s.label))))),
      h('div', { class: 'privacy', html: `${I.lock}<span>Zdjęcie analizujemy w Twojej przeglądarce – nie wysyłamy go na żaden serwer.</span>` }));
    return h('div', { class: 'msg wide' }, card);
  }

  // ----- zdjęcia --------------------------------------------------------------
  onFiles(files) {
    const list = [...(files || [])];
    this.fileInput.value = this.cameraInput.value = '';
    if (!list.length) return;
    const img = list.find(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!img) {
      this.say('To chyba nie jest zdjęcie 🙂 Wyślij plik JPG, PNG albo WEBP.');
      return;
    }
    this.analyzePhoto(img);
  }

  onPaste(e) {
    const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); this.analyzePhoto(file); }
  }

  progress(labels) {
    const items = labels.map(l => h('li', null, h('span', { class: 'ic' }), h('span', null, l)));
    const el = this.add(h('div', { class: 'msg bot' }, h('ul', { class: 'steps', 'aria-label': 'Analiza zdjęcia' }, items)));
    const step = i => items.forEach((li, j) => {
      li.classList.toggle('done', j < i);
      li.classList.toggle('active', j === i);
      li.querySelector('.ic').innerHTML = j < i ? I.check : '';
    });
    const note = (i, text) => {
      let n = items[i].querySelector('.pct');
      if (!n) items[i].append((n = h('span', { class: 'pct' })));
      n.textContent = text ? ` · ${text}` : '';
    };
    return { el, step, note };
  }

  async analyzePhoto(source) {
    if (this.busy) return;
    this.busy = true;
    this.clearChips();
    try {
      let canvas;
      try {
        canvas = await loadImage(source, 1024);
      } catch {
        await this.say('Nie udało mi się otworzyć tego zdjęcia 😕 Jeśli to plik HEIC z iPhone’a, wyślij go jako JPG albo zrób zrzut ekranu zdjęcia.');
        this.chips([this.photoChip(), ...this.roomChips().slice(0, 3)]);
        return;
      }
      this.userPhoto(canvas.toDataURL('image/jpeg', 0.82));

      const p = this.progress(['Wczytuję zdjęcie', 'Sprawdzam, co jest na zdjęciu', 'Rozpoznaję styl i kolory', 'Dobieram meble Liveo']);
      p.step(0);
      await sleep(350);
      p.step(1);
      const onProg = this.engine.onProgress;
      if (!this.engine.ready) {
        p.note(1, 'pierwsze uruchomienie');
        this.engine.onProgress = v => { onProg(v); p.note(1, v < 1 ? `pobieram model ${Math.round(v * 100)}%` : ''); };
      }
      let analysis;
      const t0 = performance.now();
      try {
        [analysis] = await Promise.all([this.engine.analyze(canvas), this.catalogReady]);
      } catch (err) {
        console.error('[Liveo]', err);
        p.el.remove();
        await this.say('Ups, nie udało mi się teraz przeanalizować zdjęcia (sprawdź połączenie z internetem). Możesz spróbować ponownie albo po prostu wybrać pomieszczenie:');
        this.chips(this.roomChips(undefined, [this.photoChip()]));
        return;
      } finally {
        this.engine.onProgress = onProg;
        p.note(1, '');
      }
      await sleep(Math.max(0, 600 - (performance.now() - t0)));

      const d = analysis.decision;
      if (d.type === 'room') {
        p.step(2); await sleep(450);
        p.step(3); await sleep(450);
      }
      p.el.remove();
      this.respond(analysis);
    } finally {
      this.busy = false;
    }
  }

  async respond(a) {
    const d = a.decision;
    const notRoom = { label: 'To jest pomieszczenie', run: () => this.askRoom(a) };
    switch (d.type) {
      case 'room':
        return this.showRoom(d.room, { analysis: a, alternatives: d.alternatives, confidence: d.confidence });

      case 'reject': {
        const place = PLACES[d.scene.key];
        const head = place
          ? `Hmm, wygląda na to, że to zdjęcie przedstawia **${place[0]}** ${place[1]}`
          : OBJECTS[d.scene.key] || 'Hmm, na tym zdjęciu nie widzę wnętrza.';
        const extra = d.scene.key === 'ogrod' ? ' Nie mamy w ofercie mebli ogrodowych.' : '';
        await this.say(`${head}\nTutaj niestety nie pomogę – Liveo tworzy meble do wnętrz.${extra} Wyślij zdjęcie pomieszczenia, które chcesz urządzić, np. salonu, sypialni albo przedpokoju.`);
        return this.chips([this.photoChip(), notRoom]);
      }

      case 'nofurn': {
        const what = d.scene.key === 'garaz' ? '**garaż** 🚗 – tutaj nasze meble raczej się nie sprawdzą' : '**łazienka** 🛁 – w ofercie Liveo nie ma mebli łazienkowych';
        await this.say(`To ${what}, więc tutaj nie pomogę.\nChętnie za to doradzę przy salonie, sypialni, jadalni, kuchni, przedpokoju czy domowym biurze.`);
        return this.chips(this.roomChips(undefined, [this.photoChip()]));
      }

      case 'product':
        this.analysis = a;
        await this.say('Widzę na zdjęciu pojedynczy mebel 🙂 Najlepiej działam ze zdjęciem całego pomieszczenia, ale mogę dobrać meble w podobnej kolorystyce. Do jakiego pomieszczenia szukasz?');
        return this.askRoomChips(a, d.suggestions);

      case 'ask':
      default:
        await this.say(d.reason === 'empty'
          ? 'To **puste pomieszczenie** – idealny moment na urządzanie! ✨ Powiedz mi, czym ma być:'
          : 'Nie mam pewności, jakie to pomieszczenie 🤔 Podpowiesz?');
        return this.askRoomChips(a, d.suggestions, true);
    }
  }

  async askRoom(a) {
    await this.say('Jasne, przepraszam za pomyłkę! Jakie to pomieszczenie?');
    this.askRoomChips(a);
  }

  askRoomChips(a, suggestions, withNotRoom = false) {
    const chips = this.roomChips(suggestions).map(c => ({ ...c, run: () => this.showRoom(roomKeyOf(c.label), { analysis: a, confirmed: true }) }));
    if (withNotRoom) chips.push({ label: 'To nie jest pomieszczenie', run: () => this.say('W porządku! Wyślij zdjęcie wnętrza, które urządzasz, a dobiorę do niego meble 🙂').then(() => this.chips([this.photoChip()])) });
    this.chips(chips);
  }

  // ----- propozycje -----------------------------------------------------------
  async showRoom(room, { analysis = null, alternatives = [], confidence = 1, confirmed = false, opts = {}, tone = 0 } = {}) {
    await this.catalogReady;
    const r = ROOMS[room];
    this.room = room;
    this.analysis = analysis; // bez zdjęcia → neutralne preferencje
    this.prefs = prefsFromAnalysis(analysis);
    if (tone) this.adjustTone(tone);
    this.opts = { ...opts };
    this.shown = new Set();

    if (analysis && !confirmed) {
      const style = analysis.styles[0];
      const pal = analysis.palette;
      const styleTxt = style.p > 0.3 ? ` w stylu **${style.label}**` : '';
      const doubt = confidence < 0.6 && alternatives[0] ? `\nJeśli to raczej ${ROOMS[alternatives[0]].name}, kliknij niżej – przełączę propozycje.` : '';
      this.groupStart = await this.say(`Widzę **${r.acc}** ${r.emoji}${styleTxt}, w ${locative(pal.words)} barwach.${doubt}`, swatches(pal));
    } else if (analysis) {
      this.groupStart = await this.say(`Dobrze – urządzamy **${r.acc}** ${r.emoji}. Dopasuję meble do kolorów z Twojego zdjęcia.`, swatches(analysis.palette));
    }
    this.alternatives = analysis && !confirmed ? alternatives : [];
    return this.showSet({ first: true });
  }

  async showSet({ first = false, cheaper = false, intro } = {}) {
    const hasPhoto = !!this.analysis;
    let sets = recommendSets(this.products, this.room, this.prefs, { skip: this.shown, ...this.opts });
    if (cheaper && this.current) sets = sets.filter(s => s.avg < this.current.avg).concat(sets.filter(s => s.avg >= this.current.avg));
    const set = sets[0];
    if (!set) {
      if (this.shown.size) {
        await this.say('To już wszystkie kolekcje, które pasują do tych założeń 🙂 Zacząć od najlepiej dopasowanej?');
        this.shown = new Set();
        return this.chips([{ label: 'Tak, pokaż od początku', primary: true, run: () => this.showSet() }, this.photoChip(false)]);
      }
      await this.say('Nie znalazłem mebli spełniających te warunki 😕 Spróbuj zwiększyć budżet albo wybrać inne pomieszczenie.');
      this.opts = {};
      return this.chips(this.roomChips([this.room]).slice(0, 4));
    }
    this.shown.add(set.collection);
    this.current = set;

    const r = ROOMS[this.room];
    const color = set.color ? ` w kolorze **${set.color.label.toLowerCase()}**` : '';
    const why = explainSet(set, this.prefs, hasPhoto);
    const limit = this.opts.maxPrice ? ` (każdy mebel do ${formatPrice(this.opts.maxPrice)})` : '';
    const lead = intro || (cheaper ? `Tańsza propozycja: kolekcja **${set.collection}**${color}${limit}.` : first
      ? (hasPhoto ? `Proponuję meble z kolekcji **${set.collection}**${color}. ${why}`
                  : `Oto propozycja do ${r.gen} ${r.emoji} – kolekcja **${set.collection}**${color}. Meble z jednej kolekcji świetnie do siebie pasują.`)
      : `A może kolekcja **${set.collection}**${color}? ${why}`);
    const msg = await this.say(lead);
    this.add(this.buildCards(set.items), { scroll: false });
    this.add(this.buildSetSummary(set), { scroll: false });
    this.scrollTo(this.groupStart || msg);
    this.groupStart = null;
    this.setChips(first && !hasPhoto);
  }

  setChips(suggestPhoto) {
    const alt = this.alternatives?.[0];
    this.chips([
      { label: '🔁 Inna kolekcja', echo: 'Pokaż inną kolekcję', run: () => this.showSet() },
      { label: '💰 Tańsze', echo: 'Pokaż coś tańszego', run: () => { this.opts.budget = true; this.showSet({ cheaper: true }); } },
      { label: '☀️ Jaśniejsze', echo: 'Wolę jaśniejsze', run: () => this.shiftTone(+1) },
      { label: '🌙 Ciemniejsze', echo: 'Wolę ciemniejsze', run: () => this.shiftTone(-1) },
      { label: '🧩 Wybierz rodzaj mebla', echo: 'Chcę wybrać rodzaj mebla', run: () => this.askType() },
      alt && { label: `${ROOMS[alt].emoji} To jednak ${ROOMS[alt].name}`, run: () => { this.alternatives = []; this.showRoom(alt, { analysis: this.analysis, confirmed: true }); } },
      suggestPhoto ? this.photoChip(false) : { label: 'Nowe zdjęcie', icon: I.camera, echo: false, keep: true, run: () => this.pickPhoto() },
    ]);
  }

  adjustTone(dir) {
    const p = this.prefs;
    p.light = Math.min(1, Math.max(0, p.light + dir * 0.28));
    if (dir < 0) p.black = Math.min(1, p.black + 0.2);
  }

  async shiftTone(dir) {
    this.adjustTone(dir);
    this.shown = new Set();
    await this.showSet({ intro: dir > 0 ? 'Jasne! ☀️ Oto jaśniejsza propozycja:' : 'Oto ciemniejsza, bardziej wyrazista propozycja 🌙' });
  }

  async askType() {
    const types = ROOMS[this.room].types.filter(t => this.products.some(p => p.type === t));
    await this.say('Jakiego mebla szukasz?');
    this.chips(types.map(t => ({ label: TYPES[t][1], run: () => this.showType(t) })));
  }

  async showType(type) {
    await this.catalogReady;
    const items = recommendByType(this.products, type, this.prefs, { ...this.opts, room: this.room });
    const name = TYPES[type][1].toLowerCase();
    if (!items.length) {
      await this.say(`Nie znalazłem: ${name}${this.opts.maxPrice ? ` do ${formatPrice(this.opts.maxPrice)}` : ''} 😕`);
      return this.chips([{ label: 'Pokaż bez limitu ceny', run: () => { delete this.opts.maxPrice; this.showType(type); } }, this.photoChip(false)]);
    }
    const budget = this.opts.maxPrice ? ` do ${formatPrice(this.opts.maxPrice)}` : '';
    const msg = await this.say(this.analysis
      ? `${cap(name)}${budget}, które najlepiej pasują do Twojego wnętrza:`
      : `${cap(name)}${budget} – oto moje propozycje:`);
    this.add(this.buildCards(items), { scroll: false });
    this.scrollTo(msg);
    const others = (this.room ? ROOMS[this.room].types : []).filter(t => t !== type).slice(0, 3);
    this.chips([
      this.room && { label: '🛋️ Pokaż cały komplet', echo: 'Pokaż cały komplet', run: () => { this.shown = new Set(); this.showSet({ first: true }); } },
      ...others.map(t => ({ label: TYPES[t][1], run: () => this.showType(t) })),
      { label: 'Nowe zdjęcie', icon: I.camera, echo: false, keep: true, run: () => this.pickPhoto() },
    ]);
  }

  // ----- karty ----------------------------------------------------------------
  buildCards(items) {
    const cards = h('div', { class: 'cards' }, items.map((p, i) => this.buildCard(p, i)));
    const prev = h('button', { class: 'nav-btn prev', type: 'button', 'aria-label': 'Poprzednie', html: I.left, hidden: true,
                               onclick: () => cards.scrollBy({ left: -cards.clientWidth * 0.8, behavior: 'smooth' }) });
    const next = h('button', { class: 'nav-btn next', type: 'button', 'aria-label': 'Następne', html: I.right,
                               onclick: () => cards.scrollBy({ left: cards.clientWidth * 0.8, behavior: 'smooth' }) });
    const sync = () => {
      prev.hidden = cards.scrollLeft < 8;
      next.hidden = cards.scrollLeft + cards.clientWidth >= cards.scrollWidth - 8;
    };
    cards.addEventListener('scroll', sync, { passive: true });
    setTimeout(sync, 50);
    return h('div', { class: 'msg wide' }, h('div', { class: 'reco' }, prev, cards, next));
  }

  buildCard(p, i) {
    const off = p.regular ? Math.round((1 - p.price / p.regular) * 100) : 0;
    const name = p.model !== p.collection ? p.model : p.name;
    return h('a', { class: 'card', href: p.url, target: '_blank', rel: 'noopener', title: p.name, style: `animation-delay:${i * 70}ms` },
      h('div', { class: 'pic' },
        h('img', { src: p.img, alt: p.name, loading: 'lazy' }),
        h('div', { class: 'badges' }, off >= 5 && h('span', { class: 'badge sale' }, `−${off}%`), p.bestseller && h('span', { class: 'badge' }, 'Bestseller'))),
      h('div', { class: 'body' },
        h('span', { class: 'type' }, TYPES[p.type]?.[0] || ''),
        h('span', { class: 'name' }, name),
        p.color && h('span', { class: 'color' }, p.color.label),
        h('span', { class: 'price' + (p.regular ? ' on-sale' : '') }, h('b', null, formatPrice(p.price)), p.regular && h('s', null, formatPrice(p.regular))),
        h('span', { class: 'cta', html: `Zobacz w sklepie ${I.external}` })));
  }

  buildSetSummary(set) {
    const url = this.collections[set.collection] || ROOM_URLS[this.room];
    return h('div', { class: 'msg wide' }, h('div', { class: 'set-sum' },
      h('span', null, `${set.items.length} ${set.items.length < 5 ? 'meble' : 'mebli'} razem: `, h('b', null, formatPrice(set.total))),
      url && h('a', { href: url, target: '_blank', rel: 'noopener', html: `Cała kolekcja ${esc(set.collection)} ${I.external}` })));
  }

  // ----- tekst ----------------------------------------------------------------
  async onText() {
    const text = this.input.value.trim();
    if (!text || this.busy) return;
    this.input.value = '';
    this.sendBtn.disabled = true;
    this.clearChips();
    this.user(text);
    await this.catalogReady;
    if (CFG.chatUrl) {
      const answer = await this.askAI();
      if (answer) return this.runAction(answer.action);
    }
    return this.localReply(parse(text));
  }

  // ----- model językowy (Worker → OpenRouter) ------------------------------------
  /** Wysyła rozmowę do Workera. Zwraca { reply, action } albo null (wtedy tryb lokalny). */
  async askAI() {
    this.busy = true;
    const typing = this.add(h('div', { class: 'msg bot typing', 'aria-label': 'Doradca pisze' }, h('i'), h('i'), h('i')));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CFG.chatTimeout);
    try {
      const res = await fetch(CFG.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.history.slice(-12), context: this.aiContext() }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('pusta odpowiedź');
      typing.remove();
      this.remember('assistant', data.reply);
      this.bot(md(data.reply));
      return { reply: data.reply, action: data.action || null };
    } catch (err) {
      typing.remove();
      console.warn('[Liveo] asystent AI niedostępny – tryb lokalny', err);
      return null;
    } finally {
      clearTimeout(timer);
      this.busy = false;
    }
  }

  /** Krótki opis oferty i stanu rozmowy – model widzi tylko to, co jest w katalogu. */
  aiContext() {
    const cols = new Map();
    for (const p of this.products) {
      const c = cols.get(p.collection) || { types: new Set(), colors: new Set(), rooms: new Set(), min: Infinity, promo: false };
      c.types.add(TYPES[p.type]?.[0] || p.type);
      if (p.color?.label) c.colors.add(p.color.label);
      (p.rooms || []).forEach(r => c.rooms.add(ROOMS[r]?.name || r));
      c.min = Math.min(c.min, p.price);
      c.promo ||= !!p.regular;
      cols.set(p.collection, c);
    }
    const catalog = [...cols].map(([name, c]) => `${name}: ${[...c.types].join(', ')}; pomieszczenia: ${[...c.rooms].join(', ')}; kolory: ${[...c.colors].slice(0, 4).join(', ')}; ceny od ${formatPrice(c.min)}${c.promo ? '; trwa promocja' : ''}`).join('\n');
    const s = this.current;
    return {
      catalog: catalog.slice(0, 4000),
      state: {
        room: this.room,
        lastSet: s ? `${s.collection}${s.color ? ` (${s.color.label})` : ''}: ${s.items.map(p => `${p.name} ${formatPrice(p.price)}`).join('; ')}`.slice(0, 600) : null,
        hasPhoto: !!this.analysis,
        maxPrice: this.opts.maxPrice || null,
      },
    };
  }

  /** Wykonuje akcję wybraną przez model – produkty zawsze pochodzą z lokalnego katalogu. */
  async runAction(a) {
    const roomFor = type => Object.keys(ROOMS).find(k => ROOMS[k].types.includes(type));
    const priceOpts = a?.maxPrice ? { maxPrice: a.maxPrice } : {};
    switch (a?.type) {
      case 'room':
        if (ROOMS[a.room]) return this.showRoom(a.room, { analysis: this.analysis, confirmed: !!this.analysis, opts: priceOpts });
        break;
      case 'furniture':
        if (TYPES[a.furnitureType]) {
          if (ROOMS[a.room]) this.room = a.room;
          else if (!this.room || !ROOMS[this.room].types.includes(a.furnitureType)) this.room = roomFor(a.furnitureType) || this.room;
          this.opts = priceOpts;
          return this.showType(a.furnitureType);
        }
        break;
      case 'more':
        if (this.room) {
          if (a.tone) return this.shiftTone(a.tone === 'lighter' ? 1 : -1);
          if (a.cheaper) { this.opts.budget = true; return this.showSet({ cheaper: true }); }
          return this.showSet();
        }
        return this.chips(this.roomChips(undefined, [this.photoChip()]), 'Do jakiego pomieszczenia?');
      case 'photo':
        return this.chips([this.photoChip(), ...this.roomChips().slice(0, 3)]);
      case 'stores':
        return this.chips([{ label: 'Znajdź sklep partnerski ↗', href: CFG.storesUrl }, this.photoChip(false)]);
      case 'contact':
        return this.chips([{ label: 'Kontakt z Liveo ↗', href: CFG.contactUrl }, this.photoChip(false)]);
    }
    return this.chips(this.room
      ? [{ label: '🔁 Inna kolekcja', echo: 'Pokaż inną kolekcję', run: () => this.showSet() }, this.photoChip(false)]
      : this.roomChips(undefined, [this.photoChip()]));
  }

  // ----- tryb lokalny (bez modelu językowego) -------------------------------------
  async localReply(q) {
    if (q.nofurn) {
      await this.say(q.nofurn === 'lazienka'
        ? 'W ofercie Liveo nie ma mebli łazienkowych 🛁, ale chętnie pomogę urządzić inne pomieszczenie.'
        : 'Do garażu nasze meble raczej się nie sprawdzą 🙂 Mogę za to pomóc z innym pomieszczeniem.');
      return this.chips(this.roomChips(undefined, [this.photoChip()]));
    }
    if (q.outdoor && !q.room) {
      await this.say('Liveo tworzy meble do wnętrz – nie mamy mebli ogrodowych ani balkonowych 🌿 Chętnie pomogę za to w domu!');
      return this.chips(this.roomChips(undefined, [this.photoChip()]));
    }
    const tone = q.lighter ? 1 : q.darker ? -1 : 0;
    // nowe pytanie o pomieszczenie / rodzaj mebla zaczyna od czystych warunków,
    // a "tańsze", "inna kolekcja" itp. zachowują wcześniejszy budżet
    const opts = q.room || q.type ? {} : { ...this.opts };
    if (q.maxPrice) opts.maxPrice = q.maxPrice;
    if (q.budget && !q.maxPrice) opts.budget = true;

    if (q.room && q.room !== this.room) {
      if (q.type) {
        Object.assign(this, { room: q.room, opts, prefs: prefsFromAnalysis(this.analysis) });
        if (tone) this.adjustTone(tone);
        return this.showType(q.type);
      }
      return this.showRoom(q.room, { analysis: this.analysis, confirmed: !!this.analysis, opts, tone });
    }
    this.opts = opts;
    if (tone) this.adjustTone(tone);
    if (q.type) {
      this.room ??= Object.keys(ROOMS).find(k => ROOMS[k].types.includes(q.type));
      return this.showType(q.type);
    }
    if (q.next || q.budget || q.maxPrice || q.lighter || q.darker) {
      if (!this.room) {
        await this.say('Jasne! Do jakiego pomieszczenia szukasz mebli?');
        return this.chips(this.roomChips(undefined, [this.photoChip()]));
      }
      if (!q.next) this.shown = new Set();
      return this.showSet({ cheaper: q.budget });
    }
    if (q.info) {
      await this.say('W sprawach zamówień, dostawy, montażu i gwarancji najszybciej pomoże obsługa klienta Liveo. Ja jestem od doboru mebli do wnętrza 🙂');
      return this.chips([{ label: 'Kontakt z Liveo ↗', href: CFG.contactUrl }, this.photoChip(false)]);
    }
    if (q.greet) {
      await this.say('Cześć! 😊 Wyślij zdjęcie pomieszczenia albo napisz, czego szukasz – np. „biała komoda do sypialni do 1000 zł”.');
      return this.chips(this.roomChips(undefined, [this.photoChip()]));
    }
    if (q.thanks) {
      await this.say('Cała przyjemność po mojej stronie! Gdyby coś jeszcze – jestem tutaj 🙂');
      return this.chips([this.photoChip(false), this.room && { label: '🔁 Inna kolekcja', run: () => this.showSet() }]);
    }
    if (q.room) return this.showSet({ first: true });
    await this.say(q.help
      ? 'Wyślij mi zdjęcie pomieszczenia 📷 – rozpoznam, jakie to wnętrze, jaki ma styl i kolory, i od razu pokażę pasujące meble Liveo. Możesz też pisać, np. „szafa do przedpokoju”, „coś tańszego”, „jaśniejsze”.'
      : 'Na razie najlepiej rozumiem zdjęcia wnętrz i krótkie polecenia, np. „komoda do salonu do 1000 zł” albo „pokaż jaśniejsze” 🙂');
    return this.chips(this.roomChips(undefined, [this.photoChip()]));
  }
}

const ROOM_URLS = {
  salon: 'https://liveomeble.pl/4-pokoj-dzienny', jadalnia: 'https://liveomeble.pl/5-jadalnia',
  kuchnia: 'https://liveomeble.pl/143-zestawy-kuchenne', mlodziezowy: 'https://liveomeble.pl/7-pokoj-mlodziezowy',
  sypialnia: 'https://liveomeble.pl/8-sypialnia', przedpokoj: 'https://liveomeble.pl/9-przedpokoj', biuro: 'https://liveomeble.pl/10-biuro',
};

const roomKeyOf = label => Object.keys(ROOMS).find(k => label.endsWith(ROOMS[k].label));

function swatches(pal) {
  if (!pal?.colors?.length) return null;
  return h('div', { class: 'swatches', 'aria-label': 'Kolory Twojego wnętrza' },
    pal.colors.slice(0, 5).map(c => h('span', { style: `background:${c.hex}`, title: c.hex })),
    h('small', null, 'kolory z Twojego zdjęcia'));
}

// ---------------------------------------------------------------------------
const start = () => new LiveoAssistant().mount();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
