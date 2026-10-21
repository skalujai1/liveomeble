// Zgody na pliki cookie: decyzja w localStorage, skrypty <script type="text/plain" data-consent="kategoria">
// uruchamiane dopiero po zgodzie na swoją kategorię. Bez czytania układu.

type Consent = { v: 1; analytics: boolean; marketing: boolean; at: string };
const KEY = 'liveo-consent';

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.v === 1 ? c : null;
  } catch {
    return null;
  }
}

function save(c: Omit<Consent, 'v' | 'at'>) {
  const full: Consent = { v: 1, ...c, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(full)); } catch { /* tryb prywatny — decyzja tylko na tę wizytę */ }
  activate(full);
  document.dispatchEvent(new CustomEvent('liveo:consent', { detail: full }));
}

function activate(c: Consent) {
  document.querySelectorAll<HTMLScriptElement>('script[type="text/plain"][data-consent]').forEach(s => {
    const cat = s.dataset.consent as 'analytics' | 'marketing';
    if (!c[cat] || s.dataset.activated) return;
    s.dataset.activated = '1';
    const run = document.createElement('script');
    if (s.dataset.src) {
      run.src = s.dataset.src;
      run.async = true;
    } else run.textContent = s.textContent;
    s.after(run);
  });
}

export function initConsent() {
  const banner = document.querySelector<HTMLElement>('[data-consent-banner]');
  if (!banner) return;
  const settings = banner.querySelector<HTMLFormElement>('[data-consent-settings]');
  const show = (withSettings = false) => {
    banner.hidden = false;
    if (settings) {
      settings.hidden = !withSettings;
      const cur = getConsent();
      settings.querySelectorAll<HTMLInputElement>('input[name]').forEach(i => { i.checked = !!cur?.[i.name as 'analytics']; });
    }
  };
  const hide = () => { banner.hidden = true; };

  const current = getConsent();
  if (current) activate(current);
  else show();

  banner.querySelector('[data-consent-accept]')?.addEventListener('click', () => { save({ analytics: true, marketing: true }); hide(); });
  banner.querySelector('[data-consent-reject]')?.addEventListener('click', () => { save({ analytics: false, marketing: false }); hide(); });
  banner.querySelector('[data-consent-open-settings]')?.addEventListener('click', () => show(true));
  settings?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(settings);
    save({ analytics: fd.has('analytics'), marketing: fd.has('marketing') });
    hide();
  });
  document.querySelectorAll('[data-open-consent]').forEach(b => b.addEventListener('click', () => show(true)));
  (window as any).LiveoConsent = { get: getConsent, open: () => show(true) };
}
