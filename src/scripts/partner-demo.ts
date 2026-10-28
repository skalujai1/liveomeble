// Strefa partnera — DEMO w przeglądarce: logowanie dowolnymi danymi, katalog partnera, zamówienie i historia.
// NIC nie jest wysyłane: sesja w sessionStorage, zamówienia w localStorage tej przeglądarki.
// Docelowo: /api/b2b/* (docs/navireo-integracja.md, rozdz. 6.2) — ceny i wartości liczy serwer z cennika Navireo.
// Katalog z kart produktu Liveo nie ma cen: zamówienie to lista pozycji, paczek i wagi; cenę potwierdza opiekun.

type Row = {
  sku: string; ean: string; name: string; color: string; collection: string; collectionName: string; type: string;
  delivery72: boolean; packages: number; grossKg: number;
};
type Boot = {
  rows: Row[]; vat: number; builtAt: string; addresses: string[];
  company: { name: string; nip: string; manager: string };
  t: {
    delivery72: string; deliveryOther: string; statuses: Record<string, string>; plural: Record<string, string>;
    addedAnnounce: string; remove: string; confirm: string; success: { title: string; text: string; demo: string };
    loginError: string; greeting: string; accountMeta: string; vatLabel: string; updated: string;
  };
};
type Line = { sku: string; qty: number };
type Order = { webOrderId: string; date: string; count: number; items: Line[]; status: string; reference: string };

const SESSION = 'liveo-partner-demo';
const CART = 'liveo-partner-cart';
const ORDERS = 'liveo-partner-orders';
const store = {
  get<T>(s: Storage, k: string, def: T): T { try { return JSON.parse(s.getItem(k) || 'null') ?? def; } catch { return def; } },
  set(s: Storage, k: string, v: unknown) { try { s.setItem(k, JSON.stringify(v)); } catch { /* tryb prywatny */ } },
  del(s: Storage, k: string) { try { s.removeItem(k); } catch { /* */ } },
};
const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const PR = new Intl.PluralRules('pl');
const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('pl-PL')} kg`;
const DT = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' });

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of kids) if (c != null) el.append(c);
  return el;
}

export function initPartnerZone() {
  const app = document.querySelector<HTMLElement>('[data-partner-app]');
  const bootEl = document.querySelector('script[data-partner-boot]');
  if (!app || !bootEl) return;
  const B: Boot = JSON.parse(bootEl.textContent || '{}');
  const bySku = new Map(B.rows.map(r => [r.sku, r]));
  const $ = <T extends Element = HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const loginView = $('[data-view="login"]');
  const panelView = $('[data-view="panel"]');
  let cart: Line[] = store.get(sessionStorage, CART, []);

  // ---------- logowanie ----------
  const showPanel = (focus = true) => {
    loginView.hidden = true;
    panelView.hidden = false;
    $('[data-greeting]').textContent = fill(B.t.greeting, { companyName: B.company.name });
    $('[data-account-meta]').textContent = fill(B.t.accountMeta, { companyName: B.company.name, nip: B.company.nip, managerName: B.company.manager });
    $('[data-updated]').textContent = fill(B.t.updated, { datetime: DT.format(new Date(B.builtAt)) });
    renderPricelist();
    renderOrder();
    renderHistory();
    const g = $('[data-greeting]') as HTMLElement;
    g.setAttribute('tabindex', '-1');
    if (focus) g.focus();
  };
  const login = () => { store.set(sessionStorage, SESSION, { at: Date.now() }); showPanel(); };
  const loginForm = $<HTMLFormElement>('[data-login]');
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const err = $('[data-login-error]');
    if (!String(fd.get('email') || '').trim() || !String(fd.get('password') || '')) {
      err.textContent = B.t.loginError;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    login();
  });
  $('[data-demo-login]').addEventListener('click', login);
  $<HTMLInputElement>('[data-show-password]').addEventListener('change', e => {
    $<HTMLInputElement>('#pz-haslo').type = (e.target as HTMLInputElement).checked ? 'text' : 'password';
  });
  $('[data-logout]').addEventListener('click', () => {
    store.del(sessionStorage, SESSION);
    panelView.hidden = true;
    loginView.hidden = false;
    $<HTMLInputElement>('#pz-email').focus();
  });

  // ---------- zakładki ----------
  const tabs = [...app.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const selectTab = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`[data-panel="${t.dataset.tab}"]`).hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const k = e.key;
      const next = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
      if (next == null) return;
      e.preventDefault();
      selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
  });

  // ---------- katalog ----------
  const filters = $<HTMLFormElement>('[data-pricelist-filters]');
  const deliveryText = (r: Row) => (r.delivery72 ? B.t.delivery72 : B.t.deliveryOther);
  function renderPricelist() {
    const fd = new FormData(filters);
    const q = String(fd.get('q') || '').trim().toLocaleLowerCase('pl');
    const coll = String(fd.get('kolekcja') || '');
    const typ = String(fd.get('typ') || '');
    const onlyAvail = fd.has('dostepne');
    const list = B.rows.filter(r =>
      (!q || `${r.sku} ${r.ean} ${r.name} ${r.color}`.toLocaleLowerCase('pl').includes(q))
      && (!coll || r.collection === coll) && (!typ || r.type === typ) && (!onlyAvail || r.delivery72));
    const body = $('[data-pricelist-body]');
    body.replaceChildren(...list.map(r => {
      const qtyId = `qty-${r.sku}`;
      const qty = h('input', { type: 'number', min: '1', max: '999', value: '1', id: qtyId, 'aria-label': `Ilość: ${r.name}, ${r.color}` }) as HTMLInputElement;
      const add = h('button', { type: 'button', class: 'btn btn--secondary' }, 'Dodaj') as HTMLButtonElement;
      add.setAttribute('aria-label', `Dodaj do zamówienia: ${r.name}, ${r.color}`);
      add.addEventListener('click', () => addToCart(r.sku, Number(qty.value) || 1));
      return h('tr', {},
        h('td', {}, h('code', {}, r.sku)), h('td', {}, r.name), h('td', {}, r.color),
        h('td', {}, r.ean ? h('code', {}, r.ean) : '—'), h('td', { class: 'num' }, String(r.packages || '—')),
        h('td', {}, deliveryText(r)),
        h('td', {}, qty), h('td', {}, add));
    }));
    $('[data-pricelist-status]').textContent = `Pozycji w katalogu: ${list.length}`;
  }
  filters.addEventListener('input', renderPricelist);
  filters.addEventListener('change', renderPricelist);
  filters.addEventListener('submit', e => e.preventDefault());

  $('[data-export]').addEventListener('click', () => {
    const head = ['Symbol', 'Mebel', 'Kolor', 'Kolekcja', 'EAN', 'Paczki', 'Waga brutto (kg)', 'Dostawa w 72 h'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(';'), ...B.rows.map(r => [r.sku, r.name, r.color, r.collectionName, r.ean, r.packages, String(r.grossKg).replace('.', ','), r.delivery72 ? 'tak' : 'nie'].map(esc).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'katalog-partnera-liveo.csv' });
    document.body.append(a);
    a.click();
    a.remove();
  });

  // ---------- zamówienie ----------
  function addToCart(sku: string, qty: number) {
    const r = bySku.get(sku);
    if (!r) return false;
    const q = Math.max(1, Math.min(999, Math.round(qty)));
    const line = cart.find(l => l.sku === sku);
    if (line) line.qty = Math.min(999, line.qty + q);
    else cart.push({ sku, qty: q });
    store.set(sessionStorage, CART, cart);
    renderOrder();
    $('[data-added-status]').textContent = fill(B.t.addedAnnounce, { name: r.name, color: r.color, qty: q });
    return true;
  }
  const quick = $<HTMLFormElement>('[data-quick-add]');
  quick.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(quick);
    const typed = String(fd.get('sku') || '').trim().toUpperCase();
    const sku = B.rows.find(r => r.sku.toUpperCase() === typed || r.ean === typed)?.sku ?? typed;
    const err = $('[data-quick-error]');
    const ok = addToCart(sku, Number(fd.get('qty')) || 1);
    err.textContent = ok ? '' : 'Nie znamy tego symbolu ani kodu EAN. Wybierz symbol z listy.';
    err.hidden = ok;
    if (ok) quick.reset();
  });

  const totals = (lines: Line[]) => ({
    count: lines.reduce((a, l) => a + l.qty, 0),
    packages: lines.reduce((a, l) => a + (bySku.get(l.sku)?.packages ?? 0) * l.qty, 0),
    kg: lines.reduce((a, l) => a + (bySku.get(l.sku)?.grossKg ?? 0) * l.qty, 0),
  });
  const itemsText = (n: number) => fill(B.t.plural[PR.select(n)] ?? B.t.plural.many, { n });
  function renderOrder() {
    const empty = cart.length === 0;
    $('[data-order-empty]').hidden = !empty;
    $('[data-order-wrap]').hidden = empty;
    $('[data-order-summary]').hidden = empty;
    $('[data-order-body]').replaceChildren(...cart.map(l => {
      const r = bySku.get(l.sku)!;
      const qty = h('input', { type: 'number', min: '1', max: '999', value: String(l.qty), 'aria-label': `Ilość: ${r.name}, ${r.color}` }) as HTMLInputElement;
      qty.addEventListener('change', () => {
        l.qty = Math.max(1, Math.min(999, Math.round(Number(qty.value) || 1)));
        store.set(sessionStorage, CART, cart);
        renderOrder();
      });
      const rm = h('button', { type: 'button', class: 'btn btn--text', 'aria-label': fill(B.t.remove, { name: `${r.name}, ${r.color}` }) }, 'Usuń');
      rm.addEventListener('click', () => { cart = cart.filter(x => x !== l); store.set(sessionStorage, CART, cart); renderOrder(); });
      const lead = r.delivery72 ? null : h('span', { class: 'field__hint' }, ` · dostawa ${deliveryText(r)}`);
      return h('tr', {}, h('td', {}, `${r.name} — ${r.color} `, h('code', {}, r.sku), lead), h('td', {}, qty),
        h('td', { class: 'num' }, String(r.packages || '—')), h('td', { class: 'num' }, String(r.packages * l.qty || '—')), h('td', {}, rm));
    }));
    const t = totals(cart);
    $('[data-sum-net]').textContent = itemsText(t.count);
    $('[data-sum-vat-label]').textContent = B.t.vatLabel;
    $('[data-sum-vat]').textContent = String(t.packages);
    $('[data-sum-gross]').textContent = kg(t.kg);
    $('[data-sum-items]').textContent = itemsText(cart.length);
  }

  const addrSel = $<HTMLSelectElement>('[data-addresses]');
  addrSel.replaceChildren(...B.addresses.map(a => h('option', { value: a }, a)));
  const orderForm = $<HTMLFormElement>('[data-order-form]');
  const submitBtn = $<HTMLButtonElement>('[data-order-submit]');
  const confirmBtn = $<HTMLButtonElement>('[data-order-confirm]');
  const cancelBtn = $<HTMLButtonElement>('[data-order-cancel]');
  const orderErr = $('[data-order-error]');
  const setConfirming = (on: boolean) => {
    submitBtn.hidden = on;
    confirmBtn.hidden = !on;
    cancelBtn.hidden = !on;
  };
  orderForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!cart.length) {
      orderErr.textContent = 'Dodaj co najmniej jedną pozycję z katalogu.';
      orderErr.hidden = false;
      return;
    }
    orderErr.hidden = true;
    confirmBtn.textContent = fill(B.t.confirm, { gross: itemsText(totals(cart).count) });
    setConfirming(true);
    confirmBtn.focus();
  });
  cancelBtn.addEventListener('click', () => { setConfirming(false); submitBtn.focus(); });
  confirmBtn.addEventListener('click', () => {
    const t = totals(cart);
    const d = new Date();
    const id = `WWW-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const fd = new FormData(orderForm);
    const order: Order = { webOrderId: id, date: d.toISOString(), count: t.count, items: cart, status: 'received', reference: String(fd.get('reference') || '') };
    const orders: Order[] = store.get(localStorage, ORDERS, []);
    orders.unshift(order);
    store.set(localStorage, ORDERS, orders.slice(0, 50));
    cart = [];
    store.set(sessionStorage, CART, cart);
    orderForm.reset();
    setConfirming(false);
    renderOrder();
    renderHistory();
    const res = $('[data-order-result]');
    res.replaceChildren(
      h('p', {}, h('strong', {}, B.t.success.title)),
      h('p', {}, fill(B.t.success.text, { webOrderId: id })),
      h('p', {}, B.t.success.demo),
      h('p', {}, 'W wersji produkcyjnej zamówienie trafi do Navireo, a jego numer i status zobaczysz w zakładce „Zamówienia”.'),
    );
    res.hidden = false;
    res.focus();
  });

  // ---------- historia ----------
  function renderHistory() {
    const orders: Order[] = store.get(localStorage, ORDERS, []);
    $('[data-history-empty]').hidden = orders.length > 0;
    $('[data-history-wrap]').hidden = orders.length === 0;
    $('[data-history-body]').replaceChildren(...orders.map(o =>
      h('tr', {}, h('td', {}, DT.format(new Date(o.date))), h('td', {}, o.webOrderId), h('td', {}, '— (DEMO)'),
        h('td', { class: 'num' }, String(o.count ?? '—')), h('td', {}, B.t.statuses[o.status] ?? o.status))));
  }

  if (store.get(sessionStorage, SESSION, null)) showPanel(false);
}
