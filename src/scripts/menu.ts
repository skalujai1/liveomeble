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
 * i oddaje fokus na przycisk, klik poza panelem zamyka. Najechanie myszą pokazuje panel przez CSS.
 */
export function initMega() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-mega-item]')];
  const close = (item: HTMLElement, focus = false) => {
    const btn = item.querySelector<HTMLButtonElement>('[data-mega-toggle]');
    item.classList.remove('is-open');
    btn?.setAttribute('aria-expanded', 'false');
    if (focus) btn?.focus();
  };
  for (const item of items) {
    const btn = item.querySelector<HTMLButtonElement>('[data-mega-toggle]');
    btn?.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach(i => i !== item && close(i));
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
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
