// Strefa partnera — DEMO w przeglądarce: logowanie dowolnymi danymi, cennik partnerski, zamówienie i historia.
// NIC nie jest wysyłane: sesja w sessionStorage, zamówienia w localStorage tej przeglądarki.
// Docelowo: /api/b2b/* (docs/navireo-integracja.md, rozdz. 6.2) — ceny i wartości liczy serwer z cennika Navireo.

import { formatPrice } from '../lib/pricing.js';

type Row = {
  sku: string; name: string; color: string; collection: string; collectionName: string; type: string;
  retail: number; promo: string | null; net: number; stock: string; leadTimeDays: number | null;
};
type Boot = {
  rows: Row[]; vat: number; builtAt: string; addresses: string[];
  company: { name: string; nip: string; manager: string };
  t: {
    stock: Record<string, string>; statuses: Record<string, string>; plural: Record<string, string>;
    addedAnnounce: string; remove: string; confirm: string; success: { title: string; text: string; demo: string };
    loginError: string; greeting: string; accountMeta: string; vatLabel: string; updated: string;
  };
};
type Line = { sku: string; qty: number };
type Order = { webOrderId: string; date: string; net: number; gross: number; items: Line[]; status: string; reference: string };

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
const money = (n: number) => formatPrice(Math.round(n * 100) / 100);
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

  // ---------- cennik ----------
  const filters = $<HTMLFormElement>('[data-pricelist-filters]');
  const stockText = (r: Row) =>
    r.stock === 'na-zamowienie' && r.leadTimeDays ? fill(B.t.stock['na-zamowienie'], { days: r.leadTimeDays }) : B.t.stock[r.stock] ?? r.stock;
  function renderPricelist() {
    const fd = new FormData(filters);
    const q = String(fd.get('q') || '').trim().toLocaleLowerCase('pl');
    const coll = String(fd.get('kolekcja') || '');
    const typ = String(fd.get('typ') || '');
    const onlyAvail = fd.has('dostepne');
    const list = B.rows.filter(r =>
      (!q || `${r.sku} ${r.name} ${r.color}`.toLocaleLowerCase('pl').includes(q))
      && (!coll || r.collection === coll) && (!typ || r.type === typ) && (!onlyAvail || r.stock === 'dostepny'));
    const body = $('[data-pricelist-body]');
    body.replaceChildren(...list.map(r => {
      const qtyId = `qty-${r.sku}`;
      const qty = h('input', { type: 'number', min: '1', max: '999', value: '1', id: qtyId, 'aria-label': `Ilość: ${r.name}, ${r.color}` }) as HTMLInputElement;
      const add = h('button', { type: 'button', class: 'btn btn--secondary' }, 'Dodaj') as HTMLButtonElement;
      add.setAttribute('aria-label', `Dodaj do zamówienia: ${r.name}, ${r.color}`);
      if (r.stock === 'wyprzedany') { add.disabled = true; qty.disabled = true; }
      add.addEventListener('click', () => addToCart(r.sku, Number(qty.value) || 1));
      return h('tr', {},
        h('td', {}, h('code', {}, r.sku)), h('td', {}, r.name), h('td', {}, r.color),
        h('td', { class: 'num' }, money(r.retail)), h('td', { class: 'num' }, money(r.net)),
        h('td', {}, r.promo ?? '—'), h('td', {}, stockText(r)), h('td', {}, qty), h('td', {}, add));
    }));
    $('[data-pricelist-status]').textContent = `Pozycji w cenniku: ${list.length}`;
  }
  filters.addEventListener('input', renderPricelist);
  filters.addEventListener('change', renderPricelist);
  filters.addEventListener('submit', e => e.preventDefault());

  $('[data-export]').addEventListener('click', () => {
    const head = ['Indeks', 'Mebel', 'Kolor', 'Kolekcja', 'Cena katalogowa brutto', 'Cena partnera netto (DEMO)', 'Promocja', 'Stan'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const num = (n: number) => n.toFixed(2).replace('.', ',');
    const lines = [head.map(esc).join(';'), ...B.rows.map(r => [r.sku, r.name, r.color, r.collectionName, num(r.retail), num(r.net), r.promo ?? '', stockText(r)].map(esc).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'cennik-partnera-DEMO.csv' });
    document.body.append(a);
    a.click();
    a.remove();
  });

  // ---------- zamówienie ----------
  function addToCart(sku: string, qty: number) {
    const r = bySku.get(sku);
    if (!r || r.stock === 'wyprzedany') return false;
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
    const sku = String(fd.get('sku') || '').trim().toUpperCase();
    const err = $('[data-quick-error]');
    const ok = addToCart(sku, Number(fd.get('qty')) || 1);
    err.textContent = ok ? '' : 'Nie znamy tego indeksu albo mebel jest wyprzedany. Wybierz indeks z listy.';
    err.hidden = ok;
    if (ok) quick.reset();
  });

  const totals = (lines: Line[]) => {
    const net = lines.reduce((a, l) => a + (bySku.get(l.sku)?.net ?? 0) * l.qty, 0);
    const vat = Math.round(net * B.vat) / 100;
    return { net, vat, gross: net + vat, count: lines.reduce((a, l) => a + l.qty, 0) };
  };
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
      const lead = r.stock === 'na-zamowienie' ? h('span', { class: 'field__hint' }, ` · ${stockText(r)}`) : null;
      return h('tr', {}, h('td', {}, `${r.name} — ${r.color} `, h('code', {}, r.sku), lead), h('td', {}, qty),
        h('td', { class: 'num' }, money(r.net)), h('td', { class: 'num' }, money(r.net * l.qty)), h('td', {}, rm));
    }));
    const t = totals(cart);
    $('[data-sum-net]').textContent = money(t.net);
    $('[data-sum-vat-label]').textContent = fill(B.t.vatLabel, { rate: B.vat });
    $('[data-sum-vat]').textContent = money(t.vat);
    $('[data-sum-gross]').textContent = money(t.gross);
    $('[data-sum-items]').textContent = fill(B.t.plural[PR.select(t.count)] ?? B.t.plural.many, { n: t.count });
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
      orderErr.textContent = 'Dodaj co najmniej jedną pozycję z cennika.';
      orderErr.hidden = false;
      return;
    }
    orderErr.hidden = true;
    confirmBtn.textContent = fill(B.t.confirm, { gross: money(totals(cart).gross) });
    setConfirming(true);
    confirmBtn.focus();
  });
  cancelBtn.addEventListener('click', () => { setConfirming(false); submitBtn.focus(); });
  confirmBtn.addEventListener('click', () => {
    const t = totals(cart);
    const d = new Date();
    const id = `WWW-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const fd = new FormData(orderForm);
    const order: Order = { webOrderId: id, date: d.toISOString(), net: t.net, gross: t.gross, items: cart, status: 'received', reference: String(fd.get('reference') || '') };
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
        h('td', { class: 'num' }, money(o.net)), h('td', {}, B.t.statuses[o.status] ?? o.status))));
  }

  if (store.get(sessionStorage, SESSION, null)) showPanel(false);
}
