// Menu mobilne i podmenu „Pomieszczenia”. Bez czytania układu: tylko atrybuty i klasy.
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

  const subToggle = menu.querySelector<HTMLButtonElement>('[data-submenu-toggle]');
  const setSub = (open: boolean) => subToggle?.setAttribute('aria-expanded', String(open));
  subToggle?.addEventListener('click', () => setSub(subToggle.getAttribute('aria-expanded') !== 'true'));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (subToggle?.getAttribute('aria-expanded') === 'true') {
      setSub(false);
      subToggle.focus();
    } else if (toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false, { focusToggle: true });
    }
  });
  // Klik poza podmenu zamyka je (bez pomiarów — tylko sprawdzenie, czy cel jest w środku).
  document.addEventListener('click', e => {
    const item = subToggle?.closest('li');
    if (item && !item.contains(e.target as Node)) setSub(false);
  });
}
