// Ruch w całym serwisie (kierunek C, poziom „premium”): jeden gest „odsłona” i kilka cichych zachowań.
//  - [data-reveal] — element pojawia się przy pierwszym wejściu w kadr (klasa .is-in; CSS robi resztę).
//  - nagłówek: chowa się przy przewijaniu w dół, wraca w górę; na stronach z hero (.has-overlay)
//    jest przezroczysty nad zdjęciem i dostaje tło (.is-solid) po zjechaniu z hero.
//  - [data-hero] — „kurtyna kolekcji”: slajdy co 7 s, indeks nazw jako sterowanie, pauza (WCAG 2.2.2).
//  - [data-rail] — przeciągany pas kolekcji (przewijanie natywne + strzałki + przeciąganie myszą).
//  - [data-showcase] — lista pomieszczeń podmienia duże zdjęcie przy najechaniu / fokusie.
// Bez JS wszystko jest widoczne i statyczne; przy prefers-reduced-motion nie ma autoodtwarzania ani animacji.

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!els.length) return;
  if (reduce() || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const overlay = document.body.classList.contains('has-overlay');
  const hero = overlay ? document.querySelector<HTMLElement>('[data-overlay-hero]') : null;
  let last = scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY;
    const menuOpen = document.documentElement.classList.contains('menu-open') || header.querySelector('.is-open');
    // chowanie: tylko po wyraźnym ruchu w dół i poza samą górą strony
    if (!menuOpen && y > 240 && y - last > 6) header.classList.add('is-hidden');
    else if (last - y > 6 || y < 120 || menuOpen) header.classList.remove('is-hidden');
    if (hero) {
      header.classList.toggle('is-solid', y > hero.offsetHeight - header.offsetHeight - 8);
      document.body.classList.toggle('at-hero', y < hero.offsetHeight * 0.6);
    }
    last = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();
}

function initHero() {
  document.querySelectorAll<HTMLElement>('[data-hero]').forEach(hero => {
    const slides = [...hero.querySelectorAll<HTMLElement>('[data-slide]')];
    const dots = [...hero.querySelectorAll<HTMLButtonElement>('[data-slide-to]')];
    const pause = hero.querySelector<HTMLButtonElement>('[data-hero-pause]');
    if (slides.length < 2) return;
    const DELAY = Number(hero.dataset.delay) || 7000;
    let i = 0;
    let timer = 0;
    let stopped = reduce();
    let held = false; // najechanie / fokus — chwilowo, bez zmiany przycisku pauzy

    const show = (n: number, focusSlide = false) => {
      const next = (n + slides.length) % slides.length;
      if (next === i) return;
      slides[i].classList.remove('is-active');
      slides[i].classList.add('is-leaving');
      const prev = slides[i];
      setTimeout(() => prev.classList.remove('is-leaving'), 1400);
      i = next;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === i);
        s.toggleAttribute('inert', k !== i);
        s.setAttribute('aria-hidden', String(k !== i));
      });
      dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
      hero.style.setProperty('--slide', String(i));
      if (focusSlide) slides[i].querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      // restart paska postępu (animacja CSS na aktywnej pozycji indeksu)
      hero.classList.remove('is-ticking'); void hero.offsetWidth; hero.classList.add('is-ticking');
      if (!stopped && !held) timer = window.setTimeout(() => show(i + 1), DELAY);
    };
    const setStopped = (v: boolean) => {
      stopped = v;
      hero.classList.toggle('is-paused', v);
      if (pause) {
        pause.setAttribute('aria-pressed', String(v));
        pause.querySelector('[data-label]')!.textContent = v ? 'Odtwórz' : 'Wstrzymaj';
      }
      schedule();
    };
    const hold = (v: boolean) => { held = v; hero.classList.toggle('is-held', v); schedule(); };

    // indeks to linki do kolekcji (bez JS); z JS przełączają slajd, a do kolekcji prowadzi przycisk w slajdzie
    dots.forEach((d, k) => d.addEventListener('click', e => { e.preventDefault(); show(k); }));
    pause?.addEventListener('click', () => setStopped(!stopped));
    hero.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hold(true); });
    hero.addEventListener('pointerleave', () => hold(false));
    hero.addEventListener('focusin', () => hold(true));
    hero.addEventListener('focusout', e => { if (!hero.contains(e.relatedTarget as Node)) hold(false); });
    document.addEventListener('visibilitychange', () => (document.hidden ? clearTimeout(timer) : schedule()));
    hero.addEventListener('keydown', e => {
      if (!(e.target as Element).closest('[data-slide-to]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); dots[i].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); dots[i].focus(); }
    });
    // przesunięcie palcem na telefonie
    let x0 = 0;
    hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    }, { passive: true });

    hero.classList.add('is-live');
    setStopped(stopped);
  });
}

function initRails() {
  document.querySelectorAll<HTMLElement>('[data-rail]').forEach(rail => {
    const track = rail.querySelector<HTMLElement>('[data-rail-track]');
    if (!track) return;
    const prev = rail.querySelector<HTMLButtonElement>('[data-rail-prev]');
    const next = rail.querySelector<HTMLButtonElement>('[data-rail-next]');
    const step = () => (track.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? track.clientWidth * 0.8;
    const sync = () => {
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      rail.style.setProperty('--progress', String(track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)));
    };
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce() ? 'auto' : 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce() ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });
    sync();

    // przeciąganie myszą (dotyk i trackpad przewijają natywnie)
    let down = false, moved = false, sx = 0, sl = 0;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) { moved = true; track.classList.add('is-dragging'); }
      track.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    });
    // po przeciągnięciu kliknięcie nie otwiera linku
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
  });
}

function initShowcase() {
  document.querySelectorAll<HTMLElement>('[data-showcase]').forEach(box => {
    const items = [...box.querySelectorAll<HTMLElement>('[data-showcase-item]')];
    const pics = [...box.querySelectorAll<HTMLElement>('[data-showcase-pic]')];
    const set = (k: number) => {
      items.forEach((it, j) => it.classList.toggle('is-active', j === k));
      pics.forEach((p, j) => p.classList.toggle('is-active', j === k));
    };
    items.forEach((it, k) => {
      it.addEventListener('pointerenter', () => set(k));
      it.addEventListener('focusin', () => set(k));
    });
  });
}

export function initMotion() {
  document.documentElement.classList.add('motion-ready');
  initReveal();
  initHeader();
  initHero();
  initRails();
  initShowcase();
}
