// Karta mebla: przełącznik koloru (radio). Bez JS warianty są zwykłą listą.
// Zmiana koloru podmienia zdjęcie, opis wariantu i ?kolor= w adresie (canonical zostaje bez parametru).

export function initProductPage() {
  const root = document.querySelector<HTMLElement>('[data-product-page]');
  const picker = root?.querySelector<HTMLFieldSetElement>('[data-variant-picker]');
  if (!root || !picker) return;
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
    // zmiana koloru przez użytkownika: mebel w nowym kolorze „obraca się” do kadru (3D), zamiast podmienić się skokiem
    if (updateUrl && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector<HTMLElement>('[data-gallery-item].is-active .media__img')?.animate(
        [{ transform: 'perspective(75rem) rotateY(-26deg) scale(0.94)', opacity: 0 }, { transform: 'perspective(75rem) rotateY(0) scale(1)', opacity: 1 }],
        { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
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
