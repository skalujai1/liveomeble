// Promocje ze sklepu liveomeble.pl mają datę końca. Strona jest statyczna (cena z chwili budowy), więc po końcu
// promocji przeglądarka sama wraca do ceny regularnej: przekreślona cena staje się ceną, znika linia Omnibus,
// data końca i plakietka rabatu na karcie. Bez czytania układu, tylko podmiana tekstów i atrybutu hidden.

export function initPrices(now = Date.now()) {
  document.querySelectorAll<HTMLElement>('[data-price][data-promo-end]').forEach(el => {
    const end = Date.parse(el.dataset.promoEnd ?? '');
    if (!(now >= end)) return;
    const regular = el.querySelector('[data-price-regular]')?.textContent;
    const current = el.querySelector('[data-price-current]');
    if (!regular || !current) return;
    current.textContent = regular;
    for (const part of ['regular-wrap', 'lowest', 'until']) el.querySelector(`[data-price-${part}]`)?.setAttribute('hidden', '');
    const sr = el.querySelector<HTMLElement>('[data-price-sr]');
    if (sr?.dataset.label) sr.textContent = `${sr.dataset.label}: `;
    el.classList.remove('price--promo');
    el.removeAttribute('data-promo-end');
    const item = el.closest<HTMLElement>('[data-listing-item]');
    if (item) {
      item.dataset.promo = '0';
      item.querySelector('[data-promo-badge]')?.setAttribute('hidden', '');
    }
  });
}
