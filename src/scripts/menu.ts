// Menu mobilne i mega-menu „Meble” / „Kolekcje”. Bez czytania układu: tylko atrybuty i klasy.

/** Menu mobilne: przycisk z aria-expanded, Esc zamyka i oddaje fokus na przycisk. */
export function initMenu() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!toggle || !menu) return;
  const label = toggle.querySelector<HTMLElement>('[data-menu-label]');
  toggle.hidden = false;

  const setOpen = (open: boolean, { focusToggle = false } = {}) => {
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-open', open);
    if (label) label.textContent = (open ? label.dataset.close : label.dataset.open) ?? label.textContent;
    if (!open && focusToggle) toggle.focus();
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true' && !document.querySelector('[data-mega-item].is-open')) {
      setOpen(false, { focusToggle: true });
    }
  });
}

/**
 * Mega-menu: przycisk ze strzałką obok linku otwiera panel (klik, Enter, spacja), Esc zamyka
 * i oddaje fokus na przycisk, klik poza panelem zamyka. Myszą: najechanie otwiera po chwili,
 * zjechanie zamyka po chwili (także panel otwarty kliknięciem) — krótka przerwa wybacza przejście
 * kursora przez szczelinę między linkiem a panelem.
 */
export function initMega() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-mega-item]')];
  // Zamiar myszy: najechanie otwiera po 90 ms, zjechanie zamyka po 220 ms. Ten sam zamiar nie przesuwa licznika,
  // więc ciągły ruch myszy poza panelem nie odkłada zamknięcia w nieskończoność.
  const timers = new Map<HTMLElement, { id: number; kind: 'open' | 'close' }>();
  const cancel = (item: HTMLElement) => {
    const t = timers.get(item);
    if (t) { clearTimeout(t.id); timers.delete(item); }
  };
  const close = (item: HTMLElement, focus = false) => {
    cancel(item);
    const btn = item.querySelector<HTMLButtonElement>('[data-mega-toggle]');
    item.classList.remove('is-open');
    btn?.setAttribute('aria-expanded', 'false');
    if (focus) btn?.focus();
  };
  const open = (item: HTMLElement) => {
    cancel(item);
    items.forEach(i => i !== item && close(i));
    item.classList.add('is-open');
    item.querySelector<HTMLButtonElement>('[data-mega-toggle]')?.setAttribute('aria-expanded', 'true');
  };
  const intend = (item: HTMLElement, kind: 'open' | 'close', ms: number) => {
    if (timers.get(item)?.kind === kind) return;
    cancel(item);
    timers.set(item, { kind, id: window.setTimeout(() => (kind === 'open' ? open(item) : close(item)), ms) });
  };
  const isMouse = (e: PointerEvent) => e.pointerType === 'mouse';
  // Bez warunku (hover: hover): laptopy z ekranem dotykowym zgłaszają czasem „brak hovera”, a mają mysz.
  for (const item of items) {
    item.addEventListener('pointerenter', e => { if (isMouse(e)) intend(item, 'open', 90); });
    item.addEventListener('pointerleave', e => { if (isMouse(e)) intend(item, 'close', 220); });
  }
  // Zabezpieczenie: przeglądarka potrafi zgubić pointerleave (szybki ruch, panel zmieniający się pod kursorem).
  // Każdy ruch myszy poza otwartym panelem i tak go zamyka; ruch w panelu anuluje zaplanowane zamknięcie.
  document.addEventListener('pointermove', e => {
    if (!isMouse(e)) return;
    for (const item of items) {
      const inside = item.contains(e.target as Node);
      const pending = timers.get(item)?.kind;
      if (!inside && (item.classList.contains('is-open') || pending === 'open')) intend(item, 'close', 220);
      else if (inside && pending === 'close' && item.classList.contains('is-open')) cancel(item);
    }
  }, { passive: true });
  // Kursor wyjechał poza okno, okno straciło fokus albo strona idzie do pamięci „wstecz”: panel się zamyka.
  document.documentElement.addEventListener('pointerleave', e => {
    if (isMouse(e)) items.forEach(i => i.classList.contains('is-open') && intend(i, 'close', 220));
  });
  const closeAll = () => items.forEach(i => close(i));
  window.addEventListener('blur', closeAll);
  window.addEventListener('pagehide', closeAll);
  for (const item of items) {
    const btn = item.querySelector<HTMLButtonElement>('[data-mega-toggle]');
    btn?.addEventListener('click', () => (item.classList.contains('is-open') ? close(item) : open(item)));
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = items.find(i => i.classList.contains('is-open'));
    if (open) close(open, true);
  });
  document.addEventListener('click', e => {
    for (const item of items) if (item.classList.contains('is-open') && !item.contains(e.target as Node)) close(item);
  });
  // Fokus poza panelem (Tab) zamyka go — bez pomiarów, tylko relatedTarget.
  for (const item of items) {
    item.addEventListener('focusout', e => {
      const next = (e as FocusEvent).relatedTarget as Node | null;
      if (next && !item.contains(next)) close(item);
    });
  }
}
