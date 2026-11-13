// Karta mebla: przełącznik koloru (radio). Bez JS warianty są zwykłą listą.
// Zmiana koloru podmienia zdjęcie, opis wariantu i ?kolor= w adresie (canonical zostaje bez parametru).
// Miniatury pod zdjęciem pokazują wybrany widok w miejscu zdjęcia głównego (nie otwierają pliku w nowej karcie).

export function initProductPage() {
  const root = document.querySelector<HTMLElement>('[data-product-page]');
  if (!root) return;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fadeIn = (img: HTMLElement | null) => { if (img && !still()) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }); };

  // Miniatury: zdjęcie z klikniętej miniatury trafia do dużego kadru tego samego koloru; zaznaczenie przez aria-current.
  root.addEventListener('click', e => {
    const link = (e.target as Element).closest?.<HTMLAnchorElement>('[data-gallery-thumbs] a');
    const list = link?.closest<HTMLElement>('[data-gallery-thumbs]');
    const thumb = link?.querySelector('img');
    const main = list && root.querySelector<HTMLImageElement>(`[data-gallery-item][data-variant="${list.dataset.variant}"] .media__img`);
    if (!link || !list || !thumb || !main) return;
    e.preventDefault();
    list.querySelectorAll('a[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'true');
    if (main.getAttribute('src') === link.getAttribute('href')) return;
    main.removeAttribute('srcset');
    main.src = link.getAttribute('href')!;
    main.alt = thumb.alt;
    for (const k of ['width', 'height']) main.setAttribute(k, thumb.getAttribute(k) ?? '');
    fadeIn(main);
  });

  const picker = root.querySelector<HTMLFieldSetElement>('[data-variant-picker]');
  if (!picker) return;
  const def = root.dataset.defaultVariant ?? '';
  const title = picker.querySelector<HTMLElement>('[data-color-title]');
  const radios = [...picker.querySelectorAll<HTMLInputElement>('input[name="kolor"]')];

  const select = (code: string, { updateUrl = true } = {}) => {
    const radio = radios.find(r => r.value === code);
    if (!radio) return;
    radio.checked = true;
    document.querySelectorAll<HTMLElement>('[data-gallery-item], [data-variant-only]').forEach(f => {
      const on = f.dataset.variant === code;
      if (f.hasAttribute('data-gallery-item')) f.classList.toggle('is-active', on);
      else f.hidden = !on;
    });
    // zmiana koloru przez użytkownika: nowe zdjęcie wchodzi łagodnym przenikaniem (mebel stoi nieruchomo)
    if (updateUrl) fadeIn(root.querySelector<HTMLElement>('[data-gallery-item].is-active .media__img'));
    if (title?.dataset.template) title.textContent = title.dataset.template.replace('{colorLabel}', radio.dataset.label ?? code);
    if (updateUrl) {
      const u = new URL(location.href);
      if (code === def) u.searchParams.delete('kolor');
      else u.searchParams.set('kolor', code);
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
  };

  picker.addEventListener('change', e => select((e.target as HTMLInputElement).value));
  const fromUrl = new URLSearchParams(location.search).get('kolor');
  if (fromUrl && fromUrl !== def && radios.some(r => r.value === fromUrl)) {
    select(fromUrl, { updateUrl: false });
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = 'noindex, follow';
  }
}
