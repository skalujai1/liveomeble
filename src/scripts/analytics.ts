// Zdarzenia do Google Analytics 4 — tylko akcje, które pokazują, czy strona prowadzi klientów do salonów.
// Nic nie wysyłamy bez zgody: window.gtag istnieje dopiero po zgodzie „Statystyki odwiedzin” (ConsentBanner + consent.ts).
// Nazwy zdarzeń po polsku (tak widać je w raportach GA4); parametry bez danych osobowych.

type Params = Record<string, string | number | undefined>;

export function track(name: string, params: Params = {}) {
  const gtag = (window as any).gtag as ((...a: unknown[]) => void) | undefined;
  if (!gtag) return;
  gtag('event', name, { strona: location.pathname, ...params });
}

const text = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);

export function initAnalytics() {
  // Kliknięcia w linki: telefon, e-mail, trasa do salonu, instrukcja PDF, animacja, kropka na meblu, „Gdzie kupić”
  document.addEventListener('click', e => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const store = a.closest('.store, [data-store-id]')?.querySelector('h3, h4, .store__name');
    const salon = store ? text(store) : undefined;
    if (href.startsWith('tel:')) track('klik_telefon', { salon, etykieta: text(a) });
    else if (href.startsWith('mailto:')) track('klik_email', { salon });
    else if (href.includes('google.com/maps')) track('klik_trasa', { salon });
    else if (/\.pdf($|\?)/i.test(href)) track('pobranie_instrukcji', { plik: href.split('/').pop() });
    else if (/\/anim\//i.test(href)) track('animacja_360', { plik: href.split('/').pop() });
    else if (a.classList.contains('hero-spot__link')) track('klik_kropka_mebla', { mebel: a.getAttribute('aria-label')?.split(',')[0] });
    else if (a.matches('[data-open-assistant]')) track('doradca_otwarcie', { skad: a.dataset.openAssistant });
    else if (href.startsWith('/gdzie-kupic/')) track('klik_gdzie_kupic', { etykieta: text(a) });
  });
  // Przycisk czatu doradcy (to <button>, nie link)
  document.addEventListener('click', e => {
    const b = (e.target as Element).closest?.('button[data-open-assistant]') as HTMLButtonElement | null;
    if (b) track('doradca_otwarcie', { skad: b.dataset.openAssistant });
  });
  // Wyszukiwarka salonów: kod pocztowy albo lokalizacja; kolekcja z filtra
  document.addEventListener('submit', e => {
    const f = e.target as HTMLFormElement;
    if (!f.matches?.('[data-sf-form]')) return;
    const col = f.querySelector<HTMLSelectElement>('[data-sf-collection]')?.value;
    track('wyszukanie_salonu', { sposob: 'kod pocztowy', kolekcja: col || 'wszystkie' });
  });
  document.addEventListener('click', e => {
    if ((e.target as Element).closest?.('[data-sf-geo]')) track('wyszukanie_salonu', { sposob: 'lokalizacja' });
  });
  // Doradca wnętrz: dodane zdjęcie pokoju (samo zdjęcie nigdzie nie wychodzi — tylko fakt dodania)
  document.addEventListener('change', e => {
    const i = e.target as HTMLInputElement;
    if (i.matches?.('input[type="file"][data-file], input[type="file"][data-camera]') && i.files?.length) track('doradca_zdjecie');
  });
  // Formularze kontaktowy i partnerski — po udanym wysłaniu (forms.ts)
  document.addEventListener('liveo:form-sent', e => track('formularz_wyslany', { formularz: (e as CustomEvent).detail?.form }));
}
