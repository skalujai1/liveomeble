// Leniwy start widżetu doradcy wnętrz: po kliknięciu [data-open-assistant] albo w czasie bezczynności.
// Widżet (liveo-assistant/widget/liveo-assistant.js) montuje się sam po załadowaniu i wystawia
// window.LiveoAssistant = { open, close } — wtedy usuwamy nasz tymczasowy przycisk.

type Boot = { scriptUrl: string; fontsCssUrl: string; idleLoadDelayMs: number; config: Record<string, unknown> };
declare global {
  interface Window {
    LiveoAssistantConfig?: Record<string, unknown>;
    LiveoAssistant?: { open: () => void; close: () => void };
  }
}

let loading: Promise<void> | null = null;

function load(boot: Boot): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    // Dymek z podpowiedzią tylko na szerszych ekranach — na telefonie zasłaniał treść strony.
    const teaser = window.matchMedia('(min-width: 48rem)').matches;
    window.LiveoAssistantConfig = { teaser, ...boot.config, ...(window.LiveoAssistantConfig || {}) };
    // Widżet dołącza Google Fonts, jeśli nie znajdzie link[data-liveo-fonts] — dajemy mu lokalny arkusz.
    if (!document.querySelector('link[data-liveo-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = boot.fontsCssUrl;
      link.setAttribute('data-liveo-fonts', '');
      document.head.append(link);
    }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = boot.scriptUrl;
    s.onerror = () => reject(new Error('Nie udało się wczytać doradcy wnętrz'));
    document.body.append(s);
    const t0 = Date.now();
    const wait = () => {
      if (window.LiveoAssistant) resolve();
      else if (Date.now() - t0 > 20000) reject(new Error('Doradca wnętrz nie odpowiada'));
      else setTimeout(wait, 60);
    };
    wait();
  });
  loading.then(
    () => document.querySelectorAll('.assistant-launcher').forEach(b => b.remove()),
    () => { loading = null; },
  );
  return loading;
}

export function initAssistant() {
  const bootEl = document.querySelector('script[data-assistant-boot]');
  if (!bootEl) return;
  const boot: Boot = JSON.parse(bootEl.textContent || '{}');

  const launcher = document.querySelector<HTMLButtonElement>('.assistant-launcher');
  if (launcher) launcher.hidden = false;

  document.querySelectorAll<HTMLElement>('a[data-open-assistant]').forEach(a => a.setAttribute('role', 'button'));
  document.addEventListener('click', e => {
    const trigger = (e.target as Element | null)?.closest<HTMLElement>('[data-open-assistant]');
    if (!trigger) return;
    e.preventDefault();
    trigger.setAttribute('aria-busy', 'true');
    load(boot)
      .then(() => window.LiveoAssistant?.open())
      .catch(() => { if (trigger instanceof HTMLAnchorElement) location.href = trigger.href; })
      .finally(() => trigger.removeAttribute('aria-busy'));
  });

  if (boot.idleLoadDelayMs > 0) {
    const later = () =>
      setTimeout(() => {
        const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
        const go = () => { load(boot).catch(() => {}); };
        if (idle) idle(go, { timeout: 5000 });
        else go();
      }, boot.idleLoadDelayMs);
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  }
}
