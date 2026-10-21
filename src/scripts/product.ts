// Karta mebla: przełącznik koloru (radio). Bez JS warianty są zwykłą listą z dostępnością.
// Zmiana koloru podmienia zdjęcie, cenę, dostępność i ?kolor= w adresie (canonical zostaje bez parametru).
import { renderPrice, renderStock } from './prices';

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
    root.querySelectorAll<HTMLElement>('[data-gallery-item]').forEach(f => f.classList.toggle('is-active', f.dataset.variant === code));
    root.querySelectorAll<HTMLElement>('[data-price]').forEach(el => { el.dataset.variant = code; renderPrice(el); });
    root.querySelectorAll<HTMLElement>('[data-stock][data-product]').forEach(el => { el.dataset.variant = code; renderStock(el); });
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
