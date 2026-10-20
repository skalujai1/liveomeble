// Proceduralne tekstury (canvas): słoje drewna, deski podłogowe, tynk, beton, tkaniny, dywan, grafiki.
// Każda tekstura „data” pakuje: R = bump (wysokość), G = roughness (bezwzględna, materiał ma roughness=1).
import * as THREE from 'three';
import { makeNoise, mulberry32, clamp01, smooth, lerp } from './noise.js';

const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(c, srgb, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// ---------------------------------------------------------------------------------------------
// Drewno: pojedyncza funkcja wzoru (x wzdłuż słojów, y w poprzek; jednostki: cm)
// ---------------------------------------------------------------------------------------------
// Model fizyczny: deska wycięta z kłody (oś kłody wzdłuż X). Promień słoja R = sqrt(dy² + zc(x)²),
// gdzie zc to odległość płaszczyzny cięcia od rdzenia (zmienna wzdłuż deski → naturalne „katedry”).
// Panel składa się z kilku fornirowych „liści” (pasów) o różnych parametrach.
const WOOD_STYLES = {
  oak: { rate: 2.0, zMin: 1, zMax: 16, ring: 0.27, early: 0.4, streak: 0.2, pore: 0.36, low: 0.2, leafVar: 0.035, ray: 0.1,
    dark: [0.62, 0.56, 0.49], light: [1.1, 1.09, 1.07], rough: 0.6, poreRough: 0.18 },
  walnut: { rate: 1.4, zMin: 2, zMax: 20, ring: 0.36, early: 0.3, streak: 0.3, pore: 0.16, low: 0.45, leafVar: 0.08, ray: 0.0,
    dark: [0.5, 0.45, 0.46], light: [1.28, 1.2, 1.12], rough: 0.5, poreRough: 0.12 },
  floor: { rate: 1.9, zMin: 1, zMax: 14, ring: 0.26, early: 0.4, streak: 0.18, pore: 0.3, low: 0.18, leafVar: 0.0, ray: 0.08,
    dark: [0.7, 0.65, 0.58], light: [1.07, 1.07, 1.06], rough: 0.62, poreRough: 0.16 },
};

function makeLeaf(r, S, y0, w) {
  return {
    y0, y1: y0 + w,
    yc: y0 + w * (r() * 1.4 - 0.2),
    z0: S.zMin + r() * (S.zMax - S.zMin),
    slope: (r() < 0.5 ? -1 : 1) * (0.015 + r() * 0.07), xc: r() * 220,
    rate: S.rate * (0.75 + 0.5 * r()),
    bright: 1 + (r() - 0.5) * 2 * S.leafVar,
    ox: r() * 500,
  };
}

/** Wzór drewna w punkcie (X wzdłuż słojów, Y w poprzek; cm) dla danego liścia. */
function woodAt(n, S, lf, X, Y) {
  const Xo = X + lf.ox;
  const zc = Math.max(0.6, lf.z0 + lf.slope * (X - lf.xc) + n.fbm(Xo * 0.006, lf.yc * 0.1, 2) * 2.5);
  const dy = Y - lf.yc + n.fbm(Xo * 0.012, Y * 0.035, 3) * 1.6;
  let R = Math.sqrt(dy * dy + zc * zc);
  R += n.fbm(Xo * 0.025, Y * 0.09, 2) * 0.35;
  const t = R * lf.rate;
  const fi = Math.floor(t);
  const f = t - fi;
  // słój: ostry początek (drewno wczesne, porowate) i łagodne zanikanie
  const ringVar = 0.6 + 0.4 * n.noise(fi * 1.37, Xo * 0.02);
  const early = smooth(0.0, 0.05, f) * (1 - smooth(0.1, 0.42, f));
  const late = smooth(0.55, 0.98, f) * 0.35;
  const ring = (early + late) * ringVar;
  // długie smugi i włókna wzdłuż słojów
  const streak = n.noise(Xo * 0.04, Y * 4.5) * 0.6 + n.noise(Xo * 0.15, Y * 16) * 0.3 + n.noise(Xo * 0.5, Y * 45) * 0.2;
  // pory: krótkie ciemne kreski skupione w drewnie wczesnym
  const pr = n.noise(Xo * 1.1, Y * 38);
  const pore = smooth(0.32, 0.7, pr) * (0.25 + 0.75 * early);
  // promienie rdzeniowe (dąb): krótkie jaśniejsze plamki
  const rr = n.noise(Xo * 0.35, Y * 2.2);
  const ray = S.ray * smooth(0.55, 0.75, rr) * smooth(0.4, 0.9, n.noise(Xo * 2.5, Y * 9) * 0.5 + 0.5);
  const low = n.fbm(Xo * 0.005, Y * 0.02, 2);
  const d = ring * S.ring + early * S.early * 0.25 + streak * S.streak + pore * S.pore + low * S.low - ray;
  return { d, pore, late: ring, fib: streak, bright: lf.bright };
}

function woodSampler(style, seed) {
  const n = makeNoise(seed);
  const r = mulberry32(seed * 7 + 3);
  const S = WOOD_STYLES[style];
  const leaves = [];
  let y = -r() * 8;
  while (y < 260) { const w = style === 'walnut' ? 18 + r() * 14 : 13 + r() * 11; leaves.push(makeLeaf(r, S, y, w)); y += w; }
  return function sample(X, Y) {
    let lo = 0, hi = leaves.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (leaves[m].y0 <= Y) lo = m; else hi = m - 1; }
    return woodAt(n, S, leaves[lo], X, Y);
  };
}

function writeWood(img, dat, i, s, base, S) {
  const v = clamp01(0.3 + s.d);
  const b = s.bright || 1;
  for (let k = 0; k < 3; k++) {
    const lo = base[k] * S.dark[k] * b, hi = Math.min(255, base[k] * S.light[k] * b);
    img[i + k] = lerp(hi, lo, v);
  }
  img[i + 3] = 255;
  const h = 0.62 - s.pore * 0.55 - s.late * 0.1 + s.fib * 0.06;
  dat[i] = clamp01(h) * 255;
  dat[i + 1] = clamp01(S.rough + s.pore * S.poreRough - s.late * 0.03) * 255;
  dat[i + 2] = 0; dat[i + 3] = 255;
}

/** Tekstura drewna dla frontów/płyt. Rozmiar fizyczny: lenM (wzdłuż słojów) × widM. */
export function woodTexture(hex, style = 'oak', variant = 0, opts = {}) {
  const W = opts.w || 2048, H = opts.h || 1024, lenM = opts.lenM || 2.2, widM = opts.widM || 0.9;
  return cached(`wood|${hex}|${style}|${variant}|${W}`, () => {
    const base = hexToRgb(hex);
    const S = WOOD_STYLES[style];
    const sample = woodSampler(style, 1000 + variant * 977 + base[0]);
    const cm = canvas(W, H), cd = canvas(W, H);
    const im = cm.getContext('2d').createImageData(W, H);
    const id = cd.getContext('2d').createImageData(W, H);
    const sx = (lenM * 100) / W, sy = (widM * 100) / H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        writeWood(im.data, id.data, i, sample(x * sx, y * sy), base, S);
      }
    }
    cm.getContext('2d').putImageData(im, 0, 0);
    cd.getContext('2d').putImageData(id, 0, 0);
    return { map: toTex(cm, true, true), data: toTex(cd, false, true), lenM, widM };
  });
}

// ---------------------------------------------------------------------------------------------
// Podłoga: deski dębowe (u = wzdłuż desek)
// ---------------------------------------------------------------------------------------------
export function floorTexture(hex = '#c9ab86', opts = {}) {
  const N = opts.size || 4096, sizeM = opts.sizeM || 6.4, plankW = opts.plankW || 0.19;
  return cached(`floor|${hex}|${N}|${sizeM}|${plankW}`, () => {
    const base = hexToRgb(hex);
    const S = WOOD_STYLES.floor;
    const r = mulberry32(4242);
    const n = makeNoise(99);
    const rows = Math.ceil(sizeM / plankW);
    const rowPlanks = [];
    for (let j = 0; j < rows; j++) {
      const joints = [];
      let p = -r() * 1.8;
      while (p < sizeM) {
        const L = 1.1 + r() * 1.3;
        const lf = makeLeaf(r, S, 0, plankW * 100);
        lf.yc = plankW * 100 * (r() * 1.6 - 0.3);
        joints.push({ start: p, end: p + L, leaf: lf, bright: 0.92 + r() * 0.13, warm: (r() - 0.5) * 0.03 });
        p += L;
      }
      rowPlanks.push(joints);
    }
    const pxm = N / sizeM;
    const cm = canvas(N, N), cd = canvas(N, N);
    const ctxm = cm.getContext('2d'), ctxd = cd.getContext('2d');
    const strip = 256;
    const b = [0, 0, 0];
    for (let y0 = 0; y0 < N; y0 += strip) {
      const im = ctxm.createImageData(N, strip), id = ctxd.createImageData(N, strip);
      for (let yy = 0; yy < strip; yy++) {
        const v = (y0 + yy) / pxm;
        const row = Math.floor(v / plankW);
        const lv = v - row * plankW;
        const planks = rowPlanks[Math.min(row, rows - 1)];
        let pi = 0;
        for (let x = 0; x < N; x++) {
          const u = x / pxm;
          while (pi < planks.length - 1 && u >= planks[pi].end) pi++;
          const pl = planks[pi];
          const lu = u - pl.start;
          const s = woodAt(n, S, pl.leaf, lu * 100, lv * 100);
          s.bright = 1;
          const i = (yy * N + x) * 4;
          b[0] = base[0] * pl.bright * (1 + pl.warm); b[1] = base[1] * pl.bright; b[2] = base[2] * pl.bright * (1 - pl.warm);
          writeWood(im.data, id.data, i, s, b, S);
          const eu = Math.min(lu, pl.end - u), ev = Math.min(lv, plankW - lv);
          const e = Math.min(eu, ev);
          const bevel = 1 - smooth(0.0, 0.0022, e);
          if (bevel > 0) {
            for (let k = 0; k < 3; k++) im.data[i + k] *= 1 - bevel * 0.5;
            id.data[i] = id.data[i] * (1 - bevel);
          }
          id.data[i + 1] = clamp01(id.data[i + 1] / 255 + n.noise(u * 3, v * 3) * 0.05) * 255;
        }
      }
      ctxm.putImageData(im, 0, y0);
      ctxd.putImageData(id, 0, y0);
    }
    return { map: toTex(cm, true, false), data: toTex(cd, false, false), sizeM };
  });
}

// ---------------------------------------------------------------------------------------------
// Tynk (bezszwowy), beton
// ---------------------------------------------------------------------------------------------
export function plasterTexture(hex, opts = {}) {
  const N = opts.size || 1024, strength = opts.strength ?? 1;
  return cached(`plaster|${hex}|${N}|${strength}`, () => {
    const base = hexToRgb(hex);
    const n = makeNoise(31);
    const cm = canvas(N, N), cd = canvas(N, N);
    const im = cm.getContext('2d').createImageData(N, N), id = cd.getContext('2d').createImageData(N, N);
    const P = 8; // okres w komórkach dla niskiej częstotliwości
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        const low = n.fbm(u * P, v * P, 3, P, P);
        const mid = n.fbm(u * 32, v * 32, 2, 32, 32);
        const fine = n.fbm(u * 160, v * 160, 2, 160, 160);
        const i = (y * N + x) * 4;
        const c = 1 + (low * 0.012 + mid * 0.004) * strength;
        im.data[i] = Math.min(255, base[0] * c); im.data[i + 1] = Math.min(255, base[1] * c); im.data[i + 2] = Math.min(255, base[2] * c); im.data[i + 3] = 255;
        id.data[i] = clamp01(0.5 + (fine * 0.4 + mid * 0.18) * strength) * 255;
        id.data[i + 1] = clamp01(0.9 + fine * 0.04) * 255;
        id.data[i + 2] = 0; id.data[i + 3] = 255;
      }
    }
    cm.getContext('2d').putImageData(im, 0, 0);
    cd.getContext('2d').putImageData(id, 0, 0);
    return { map: toTex(cm, true, true), data: toTex(cd, false, true) };
  });
}

export function concreteTexture(hex = '#c9c5bd', opts = {}) {
  const N = opts.size || 2048;
  return cached(`concrete|${hex}|${N}`, () => {
    const base = hexToRgb(hex);
    const n = makeNoise(77);
    const cm = canvas(N, N), cd = canvas(N, N);
    const im = cm.getContext('2d').createImageData(N, N), id = cd.getContext('2d').createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        const low = n.fbm(u * 6, v * 6, 4, 6, 6);
        const mid = n.fbm(u * 40, v * 40, 3, 40, 40);
        const pit = n.noise(u * 400, v * 400, 400, 400);
        const pits = smooth(0.55, 0.8, pit);
        const i = (y * N + x) * 4;
        const c = 1 + low * 0.07 + mid * 0.025 - pits * 0.12;
        im.data[i] = Math.min(255, base[0] * c); im.data[i + 1] = Math.min(255, base[1] * c); im.data[i + 2] = Math.min(255, base[2] * c * 0.995); im.data[i + 3] = 255;
        id.data[i] = clamp01(0.6 - pits * 0.5 + mid * 0.1) * 255;
        id.data[i + 1] = clamp01(0.62 + low * 0.12 + pits * 0.2) * 255;
        id.data[i + 2] = 0; id.data[i + 3] = 255;
      }
    }
    cm.getContext('2d').putImageData(im, 0, 0);
    cd.getContext('2d').putImageData(id, 0, 0);
    return { map: toTex(cm, true, true), data: toTex(cd, false, true) };
  });
}

// ---------------------------------------------------------------------------------------------
// Tkaniny: len / splot (bezszwowe), dzianina, dywan
// ---------------------------------------------------------------------------------------------
export function fabricTexture(kind = 'linen', opts = {}) {
  const N = opts.size || 512;
  return cached(`fabric|${kind}|${N}`, () => {
    const n = makeNoise(kind === 'linen' ? 5 : kind === 'boucle' ? 9 : 13);
    const cm = canvas(N, N), cd = canvas(N, N);
    const im = cm.getContext('2d').createImageData(N, N), id = cd.getContext('2d').createImageData(N, N);
    const threads = kind === 'linen' ? 96 : 128;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        let h, c;
        if (kind === 'boucle') {
          const a = n.fbm(u * 64, v * 64, 3, 64, 64);
          const b = n.noise(u * 160, v * 160, 160, 160);
          h = 0.5 + a * 0.6 + b * 0.25;
          c = 1 + a * 0.12;
        } else if (kind === 'knit') {
          // dzianina: rzędy oczek w kształcie „V”
          const cols = 48, rowsK = 64;
          const cu = u * cols, cv = v * rowsK;
          const fu = cu - Math.floor(cu) - 0.5, fv = cv - Math.floor(cv);
          const vshape = Math.abs(fu) * 1.6 - (fv - 0.5);
          const loop = Math.cos(Math.PI * (vshape)) * 0.5 + 0.5;
          h = loop * (0.75 + 0.25 * Math.cos(fu * Math.PI * 2)) + n.noise(u * 200, v * 200, 200, 200) * 0.08;
          c = 0.88 + h * 0.18;
        } else {
          // len / bawełna: splot płócienny z nieregularną grubością nitek (slub)
          const tu = u * threads, tv = v * threads;
          const iu = Math.floor(tu), iv = Math.floor(tv);
          const slubU = n.noise(iu * 0.37, v * 6, 0, 6) * 0.5 + 0.5;
          const slubV = n.noise(u * 6, iv * 0.41, 6, 0) * 0.5 + 0.5;
          const over = ((iu + iv) & 1) === 0;
          const pu = Math.sin((tu - iu) * Math.PI), pv = Math.sin((tv - iv) * Math.PI);
          h = over ? pv * (0.6 + 0.4 * slubU) : pu * (0.6 + 0.4 * slubV);
          h = h * 0.8 + n.fbm(u * 24, v * 24, 2, 24, 24) * 0.15;
          c = 0.93 + 0.07 * (over ? slubU : slubV) + n.fbm(u * 8, v * 8, 2, 8, 8) * 0.03;
        }
        const i = (y * N + x) * 4;
        const g = clamp01(c) * 255;
        im.data[i] = g; im.data[i + 1] = g; im.data[i + 2] = g; im.data[i + 3] = 255;
        id.data[i] = clamp01(h) * 255;
        id.data[i + 1] = clamp01(0.85 + (1 - h) * 0.1) * 255;
        id.data[i + 2] = 0; id.data[i + 3] = 255;
      }
    }
    cm.getContext('2d').putImageData(im, 0, 0);
    cd.getContext('2d').putImageData(id, 0, 0);
    // mapa koloru jest w skali szarości — mnożona przez kolor materiału
    return { map: toTex(cm, true, true), data: toTex(cd, false, true) };
  });
}

/** Dywan wełniany (berber) ze wzorem: tekstura całego dywanu (nie powtarzana). */
export function rugTexture(opts = {}) {
  const W = opts.w || 2048, H = opts.h || 1400;
  const c1 = hexToRgb(opts.base || '#e6dfd3'), c2 = hexToRgb(opts.line || '#b9ac98');
  const pattern = opts.pattern || 'diamond';
  return cached(`rug|${W}|${H}|${opts.base}|${opts.line}|${pattern}`, () => {
    const n = makeNoise(21);
    const cm = canvas(W, H), cd = canvas(W, H);
    const im = cm.getContext('2d').createImageData(W, H), id = cd.getContext('2d').createImageData(W, H);
    const loops = 260; // pętle na szerokość
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const lu = u * loops, lv = v * loops * (H / W);
        const loop = (Math.sin(lu * Math.PI * 2) * 0.5 + 0.5) * (Math.sin(lv * Math.PI * 2 + Math.sin(lu * Math.PI) * 1.2) * 0.5 + 0.5);
        const fuzz = n.fbm(u * 300, v * 300 * H / W, 2);
        let m = 0;
        if (pattern === 'diamond') {
          const du = (u - 0.5) * 6, dv = (v - 0.5) * 6 * H / W;
          const dd = Math.abs(((du + dv) % 2 + 2) % 2 - 1) + 0 * Math.abs(((du - dv) % 2 + 2) % 2 - 1);
          const dd2 = Math.abs(((du - dv) % 2 + 2) % 2 - 1);
          m = Math.max(1 - smooth(0.0, 0.06, Math.abs(dd - 0.5)), 1 - smooth(0.0, 0.06, Math.abs(dd2 - 0.5)));
          m *= 0.85 + 0.3 * n.noise(u * 40, v * 40);
        } else if (pattern === 'stripes') {
          const s = Math.abs(((v * 18) % 2) - 1);
          m = 1 - smooth(0.0, 0.08, Math.abs(s - 0.5));
        }
        const border = Math.min(u, 1 - u, v, 1 - v) * W;
        const bm = 1 - smooth(18, 22, border) + (smooth(34, 38, border) - smooth(42, 46, border));
        const mm = clamp01(Math.max(m, bm * 0.9));
        const i = (y * W + x) * 4;
        const shade = 0.9 + loop * 0.12 + fuzz * 0.08;
        for (let k = 0; k < 3; k++) im.data[i + k] = Math.min(255, lerp(c1[k], c2[k], mm) * shade);
        im.data[i + 3] = 255;
        id.data[i] = clamp01(0.35 + loop * 0.5 + fuzz * 0.2) * 255;
        id.data[i + 1] = 245; id.data[i + 2] = 0; id.data[i + 3] = 255;
      }
    }
    cm.getContext('2d').putImageData(im, 0, 0);
    cd.getContext('2d').putImageData(id, 0, 0);
    return { map: toTex(cm, true, false), data: toTex(cd, false, false) };
  });
}

/** Delikatna „skórka pomarańczy” lakieru / faktura MDF (bezszwowa). */
export function paintTexture(rough, opts = {}) {
  const N = 512;
  const grain = opts.grain ?? 1;
  return cached(`paint|${rough}|${grain}`, () => {
    const n = makeNoise(17);
    const cd = canvas(N, N);
    const id = cd.getContext('2d').createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        const a = n.fbm(u * 48, v * 48, 3, 48, 48);
        const i = (y * N + x) * 4;
        id.data[i] = clamp01(0.5 + a * 0.5 * grain) * 255;
        id.data[i + 1] = clamp01(rough * (1 + a * 0.08)) * 255;
        id.data[i + 2] = 0; id.data[i + 3] = 255;
      }
    }
    cd.getContext('2d').putImageData(id, 0, 0);
    return { data: toTex(cd, false, true) };
  });
}

// ---------------------------------------------------------------------------------------------
// Grafiki abstrakcyjne (do ram)
// ---------------------------------------------------------------------------------------------
export function artTexture(style = 'arches', palette = {}, w = 1024, h = 1365) {
  return cached(`art|${style}|${JSON.stringify(palette)}|${w}x${h}`, () => {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const P = Object.assign({ bg: '#efe9df', a: '#c56a46', b: '#d9b88a', c: '#6f7a5c', d: '#2b2a28' }, palette);
    g.fillStyle = P.bg; g.fillRect(0, 0, w, h);
    const r = mulberry32(hashCode(style + JSON.stringify(P)));
    if (style === 'arches') {
      g.fillStyle = P.b; g.beginPath(); g.arc(w * 0.5, h * 0.62, w * 0.34, Math.PI, 0); g.lineTo(w * 0.84, h * 0.9); g.lineTo(w * 0.16, h * 0.9); g.fill();
      g.fillStyle = P.a; g.beginPath(); g.arc(w * 0.5, h * 0.66, w * 0.2, Math.PI, 0); g.lineTo(w * 0.7, h * 0.9); g.lineTo(w * 0.3, h * 0.9); g.fill();
      g.fillStyle = P.d; g.beginPath(); g.arc(w * 0.72, h * 0.26, w * 0.07, 0, Math.PI * 2); g.fill();
      g.strokeStyle = P.c; g.lineWidth = w * 0.012; g.beginPath(); g.moveTo(w * 0.1, h * 0.9); g.lineTo(w * 0.9, h * 0.9); g.stroke();
    } else if (style === 'blobs') {
      const blob = (cx, cy, rad, col) => {
        g.fillStyle = col; g.beginPath();
        const k = 9; const off = r() * 6;
        for (let i = 0; i <= k * 4; i++) {
          const a = (i / (k * 4)) * Math.PI * 2;
          const rr = rad * (1 + 0.12 * Math.sin(a * 3 + off) + 0.06 * Math.sin(a * 5 + off * 2));
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 1.05;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath(); g.fill();
      };
      blob(w * 0.42, h * 0.38, w * 0.26, P.b);
      blob(w * 0.62, h * 0.62, w * 0.2, P.c);
      blob(w * 0.36, h * 0.7, w * 0.1, P.a);
      g.strokeStyle = P.d; g.lineWidth = w * 0.008; g.beginPath();
      g.moveTo(w * 0.15, h * 0.2); g.bezierCurveTo(w * 0.5, h * 0.05, w * 0.6, h * 0.5, w * 0.85, h * 0.35); g.stroke();
    } else if (style === 'lines') {
      g.strokeStyle = P.d; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        g.lineWidth = w * (0.004 + r() * 0.006);
        g.beginPath();
        const y = h * (0.2 + i * 0.1);
        g.moveTo(w * 0.15, y);
        g.bezierCurveTo(w * 0.35, y - h * 0.08 * r(), w * 0.65, y + h * 0.08 * r(), w * 0.85, y - h * 0.02);
        g.stroke();
      }
      g.fillStyle = P.a; g.beginPath(); g.arc(w * 0.68, h * 0.3, w * 0.12, 0, Math.PI * 2); g.fill();
    } else if (style === 'blocks') {
      g.fillStyle = P.b; g.fillRect(w * 0.12, h * 0.14, w * 0.5, h * 0.42);
      g.fillStyle = P.c; g.fillRect(w * 0.38, h * 0.44, w * 0.5, h * 0.4);
      g.fillStyle = P.a; g.beginPath(); g.arc(w * 0.38, h * 0.44, w * 0.13, 0, Math.PI * 2); g.fill();
      g.fillStyle = P.d; g.fillRect(w * 0.12, h * 0.86, w * 0.76, h * 0.008);
    } else if (style === 'landscape') {
      // „akwarela” — miękkie warstwy wzgórz
      for (let L = 0; L < 4; L++) {
        const col = [P.b, P.c, P.a, P.d][L];
        g.fillStyle = col; g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(0, h);
        const base = h * (0.45 + L * 0.13);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, base - Math.sin(x / w * Math.PI * (1.5 + L * 0.7) + L) * h * 0.05 - Math.sin(x / w * 9 + L * 2) * h * 0.01);
        g.lineTo(w, h); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = P.a; g.beginPath(); g.arc(w * 0.7, h * 0.28, w * 0.08, 0, Math.PI * 2); g.fill();
    }
    // ziarno papieru
    const im = g.getImageData(0, 0, w, h);
    const n = makeNoise(3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const k = 1 + n.noise(x * 0.35, y * 0.35) * 0.035 + (r() - 0.5) * 0.03;
      im.data[i] *= k; im.data[i + 1] *= k; im.data[i + 2] *= k;
    }
    g.putImageData(im, 0, 0);
    return toTex(c, true, false);
  });
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; }

/** Podgląd tekstury jako dataURL (debug). */
export function textureToDataURL(tex) { return tex.image.toDataURL('image/png'); }
