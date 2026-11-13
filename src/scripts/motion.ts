// Ruch w całym serwisie (kierunek C, poziom „premium”): jeden gest „odsłona” i kilka cichych zachowań.
//  - [data-reveal] — element pojawia się przy pierwszym wejściu w kadr (klasa .is-in; CSS robi resztę).
//  - nagłówek: chowa się przy przewijaniu w dół, wraca w górę; na stronach z hero (.has-overlay)
//    jest przezroczysty nad zdjęciem i dostaje tło (.is-solid) po zjechaniu z hero.
//  - [data-hero] — „kurtyna kolekcji”: slajdy co 7 s, indeks nazw jako sterowanie, pauza (WCAG 2.2.2).
//  - [data-rail] — przeciągany pas kolekcji (przewijanie natywne + strzałki + przeciąganie myszą).
//  - [data-showcase] — lista pomieszczeń podmienia duże zdjęcie przy najechaniu / fokusie.
//  - głębia (3D): mebel przechyla się za kursorem, a kadr klikniętej karty przechodzi w zdjęcie na stronie mebla.
//    Reszta głębi (pas kolekcji na łuku, mapa, paralaksa) to sam CSS w editorial.css.
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

// Kropki na meblach w hero: sama kropka i karta z opisem (bez przyciemniania zdjęcia i obrysu mebla), miniatura ładowana
// dopiero przy pierwszym najechaniu,
// a kropki, które wypadłyby pod nazwą kolekcji, przyciskami albo paskiem indeksu, są ukrywane.
function initHotspots() {
  const lists = [...document.querySelectorAll<HTMLElement>('[data-spots]')];
  if (!lists.length) return;
  const header = document.querySelector<HTMLElement>('[data-header]');
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const GAP = 20;
  // Karta stoi obok mebla (po prawej, lewej, nad albo pod nim) tak, żeby go nie zasłaniała i mieściła się w kadrze;
  // spośród miejsc bez zasłaniania wybiera najbliższe kropce. Liczone w układzie warstwy kropek (bez jej zoomu).
  const place = (list: HTMLElement, spot: HTMLElement, box: number[]) => {
    const card = spot.querySelector<HTMLElement>('.hero-spot__card');
    const line = spot.querySelector<HTMLElement>('.hero-spot__line');
    const slide = list.closest<HTMLElement>('[data-slide]');
    if (!card || !line || !slide) return;
    const W = list.offsetWidth, H = list.offsetHeight, sw = slide.clientWidth, sh = slide.clientHeight;
    const offX = (sw - W) * 0.5, offY = (sh - H) * 0.58; // warstwa jest wyśrodkowana jak kadr zdjęcia (50% 58%)
    const sr = slide.getBoundingClientRect();
    const bar = slide.closest('[data-hero]')?.querySelector<HTMLElement>('.hero-curtain__bar');
    const top = Math.max(16, (header ? header.getBoundingClientRect().bottom - sr.top : 0) + 16);
    const bottom = Math.min(sh - 16, bar ? bar.getBoundingClientRect().top - sr.top - 16 : sh - 16);
    const safe = { l: 16 - offX, r: sw - 16 - offX, t: top - offY, b: bottom - offY };
    const [x1, y1, x2, y2] = box.map((v, i) => (v / 100) * (i % 2 ? H : W));
    const px = spot.offsetLeft, py = spot.offsetTop;
    const w = card.offsetWidth, h = card.offsetHeight;
    const cy = clamp(py - h / 2, safe.t, safe.b - h), cx = clamp(px - w / 2, safe.l, safe.r - w);
    const best = [
      { l: x2 + GAP, t: cy }, { l: x1 - GAP - w, t: cy }, { l: cx, t: y1 - GAP - h }, { l: cx, t: y2 + GAP },
    ].map(c => {
      const L = clamp(c.l, safe.l, safe.r - w), T = clamp(c.t, safe.t, safe.b - h);
      const cover = Math.max(0, Math.min(L + w, x2) - Math.max(L, x1)) * Math.max(0, Math.min(T + h, y2) - Math.max(T, y1));
      const nx = clamp(px, L, L + w), ny = clamp(py, T, T + h);
      return { L, T, cover, nx, ny, d: Math.hypot(nx - px, ny - py) };
    }).sort((a, b) => a.cover - b.cover || a.d - b.d)[0];
    card.style.left = `calc(50% + ${Math.round(best.L - px)}px)`;
    card.style.top = `calc(50% + ${Math.round(best.T - py)}px)`;
    // linia: od brzegu kropki do najbliższego punktu karty
    line.style.width = `${Math.max(0, best.d - 12)}px`;
    line.style.rotate = `${Math.atan2(best.ny - py, best.nx - px)}rad`;
  };
  for (const list of lists) {
    let active: HTMLElement | null = null;
    let timer = 0;
    const off = () => {
      active?.classList.remove('is-active');
      active = null;
    };
    const on = (spot: HTMLElement) => {
      clearTimeout(timer);
      if (active === spot) return;
      active?.classList.remove('is-active');
      // prostokąt mebla (box z hotspots.json) służy tylko do ustawienia karty obok mebla, żeby go nie zasłaniała
      const box = (spot.dataset.box || '').split(' ').map(Number);
      const t = spot.querySelector<HTMLElement>('[data-thumb]');
      if (t?.dataset.thumb) { t.style.backgroundImage = `url("${t.dataset.thumb}")`; delete t.dataset.thumb; }
      place(list, spot, box);
      spot.classList.add('is-active');
      active = spot;
    };
    // zjazd z kropki daje chwilę na dojechanie kursorem do karty (karta stoi obok mebla, nie przy kropce)
    const later = () => { clearTimeout(timer); timer = window.setTimeout(off, 450); };
    list.querySelectorAll<HTMLElement>('.hero-spot').forEach(spot => {
      const link = spot.querySelector<HTMLElement>('.hero-spot__link');
      if (!link) return;
      link.addEventListener('pointerenter', () => on(spot));
      link.addEventListener('pointerleave', later);
      link.addEventListener('focusin', () => on(spot));
      link.addEventListener('focusout', () => { clearTimeout(timer); off(); });
    });
    addEventListener('resize', () => { clearTimeout(timer); off(); });
  }
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const bar = hero?.querySelector<HTMLElement>('.hero-curtain__bar');
  const rectOf = (els: Element[]) => els.map(el => {
    // nazwa: prostokąt samego tekstu; czcionka ma wysoki zapas nad literami, więc górę obcinamy o 18% wysokości
    if (el.matches('.hero-curtain__name')) { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return new DOMRect(b.left, b.top + b.height * 0.18, b.width, b.height * 0.82); }
    return el.getBoundingClientRect();
  });
  const layout = () => {
    const top = header ? header.getBoundingClientRect().bottom + 8 : 0;
    const bottom = bar ? bar.getBoundingClientRect().top - 12 : innerHeight;
    for (const list of lists) {
      const slide = list.closest('[data-slide]');
      const copy = slide?.querySelector('.hero-curtain__copy');
      const blocks = copy ? rectOf([copy.querySelector('.hero-curtain__name')!, ...copy.querySelectorAll('.hero-curtain__meta > *, .hero-curtain__cta > *')].filter(Boolean)) : [];
      list.querySelectorAll<HTMLElement>('.hero-spot').forEach(spot => {
        spot.classList.remove('is-covered');
        const d = spot.getBoundingClientRect();
        const hit = d.top < top || d.top > bottom || d.left < 16 || d.left > innerWidth - 16
          || blocks.some(b => d.left > b.left - 28 && d.left < b.right + 28 && d.top > b.top - 28 && d.top < b.bottom + 28);
        spot.classList.toggle('is-covered', hit);
      });
    }
  };
  let raf = 0;
  addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); });
  document.fonts?.ready.then(layout);
  layout();
  setTimeout(layout, 1400); // po animacji wejścia tekstu pierwszego slajdu
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
      // aktywna nazwa zawsze widoczna w przewijanym indeksie (telefon)
      const list = dots[i]?.closest('ol');
      if (list && list.scrollWidth > list.clientWidth) list.scrollTo({ left: dots[i].offsetLeft - 16, behavior: reduce() ? 'auto' : 'smooth' });
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

// Karta mebla: drugi widok (np. z otwartymi drzwiami) ładowany dopiero przy pierwszym najechaniu myszą.
function initCardFlip() {
  if (!matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointerover', e => {
    const card = (e.target as Element).closest?.<HTMLElement>('.product-card--flip');
    if (!card || card.dataset.flip) return;
    card.dataset.flip = '1';
    const el = card.querySelector<HTMLElement>('.product-card__second[data-src]');
    if (!el) return;
    const src = el.dataset.src!;
    el.removeAttribute('data-src');
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${src}")`; card.classList.add('is-ready'); };
    img.src = src;
  }, { passive: true });
}

// Głębia: packshot stoi na tle w kolorze kadru, więc pochylony w 3D wygląda jak sam mebel obracany w dłoni.
// Kursor ustawia --tx / --ty (od -0,5 do 0,5) na kadrze; kąt i powrót do zera robi CSS. Tylko mysz, jeden nasłuch.
function initTilt() {
  if (reduce() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const SEL = '.product-card__frame, .featured-tile__media, .page-product .gallery__item .media';
  let el: HTMLElement | null = null;
  let raf = 0, px = 0, py = 0;
  const release = () => {
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.removeProperty('--tx');
    el.style.removeProperty('--ty');
    el = null;
  };
  const apply = () => {
    raf = 0;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--tx', ((px - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--ty', ((py - r.top) / r.height - 0.5).toFixed(3));
  };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const t = (e.target as Element).closest?.<HTMLElement>(SEL) ?? null;
    if (t !== el) { release(); el = t; el?.classList.add('is-tilting'); }
    if (!el) return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', release);
  addEventListener('scroll', release, { passive: true });
}

// Przejście karta → strona mebla (View Transitions między dokumentami): kadr klikniętej karty dostaje nazwę „mebel”,
// taką samą jak zdjęcie główne na stronie mebla, więc przeglądarka płynnie przeprowadza jedno w drugie.
// Powrót (strona mebla → lista) obsługuje krótki skrypt w <head> (BaseLayout), bo musi zdążyć przed pierwszą klatką.
function initProductMorph() {
  if (!('onpageswap' in window) || reduce()) return;
  let clicked: HTMLElement | null = null;
  document.addEventListener('click', e => {
    // tylko linki do mebla (kafel „Polecane” ma też link „Gdzie kupić”)
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href]');
    clicked = a && new URL(a.href).pathname.startsWith('/produkt/') ? a.closest<HTMLElement>('.product-card, .featured-tile') : null;
  }, true);
  addEventListener('pageswap', e => {
    const vt = (e as Event & { viewTransition?: { finished: Promise<void> } }).viewTransition;
    if (!vt) return;
    // lista po powrocie wie, której karcie nadać nazwę
    try { sessionStorage.setItem('lv-morph', location.pathname); } catch { /* tryb prywatny */ }
    const frame = clicked?.querySelector<HTMLElement>('.product-card__frame, .featured-tile__media');
    if (!frame) return;
    // nazwa musi być jedna na stronę: zdjęcie główne (strona mebla → inny mebel z kompletu) oddaje ją karcie
    document.querySelectorAll<HTMLElement>('.gallery__item .media').forEach(m => { m.style.viewTransitionName = 'none'; });
    frame.style.viewTransitionName = 'mebel';
    // po powrocie z pamięci podręcznej (bfcache) strona ma być w stanie wyjściowym
    const reset = () => {
      frame.style.viewTransitionName = '';
      document.querySelectorAll<HTMLElement>('.gallery__item .media').forEach(m => { m.style.viewTransitionName = ''; });
    };
    vt.finished.then(reset, reset);
  });
}

export function initMotion() {
  document.documentElement.classList.add('motion-ready');
  initReveal();
  initHeader();
  initHero();
  initHotspots();
  initCardFlip();
  initTilt();
  initProductMorph();
  initRails();
  initShowcase();
}
