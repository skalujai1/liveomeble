// Silnik analizy zdjęć – działa w całości w przeglądarce klienta.
//
// 1. Model MobileCLIP (Apple, przez transformers.js) zamienia zdjęcie na wektor
//    i porównuje go z gotowymi wektorami opisów z prompts.js
//    → rodzaj sceny (salon / kuchnia / podjazd …) i styl wnętrza.
// 2. Z pikseli zdjęcia wyliczamy paletę barw (k-średnie) → jasność i "ciepło" wnętrza.
//
// Zdjęcie nigdy nie opuszcza urządzenia klienta.

import { SCENES, STYLES, promptsHash } from './prompts.js';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
export const MODEL_ID = 'Xenova/mobileclip_s0';
const LOGIT_SCALE = 100; // skala z treningu CLIP/MobileCLIP

let libPromise;
function lib() {
  libPromise ??= import(TRANSFORMERS_URL).then(m => {
    m.env.allowLocalModels = false;
    return m;
  });
  return libPromise;
}

// ---------------------------------------------------------------------------
// Wektory opisów (tekst) – liczone raz, zapisywane w data/text-embeddings.json
// ---------------------------------------------------------------------------

function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Float32Array.from(v, x => x / n);
}

function meanVector(vectors) {
  const out = new Float32Array(vectors[0].length);
  for (const v of vectors) for (let i = 0; i < v.length; i++) out[i] += v[i];
  return normalize(out);
}

/** Liczy uśrednione wektory dla SCENES i STYLES modelem tekstowym. */
export async function computeTextEmbeddings({ dtype = 'fp32', onProgress } = {}) {
  const { AutoTokenizer, CLIPTextModelWithProjection } = await lib();
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  const model = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
    dtype, progress_callback: progressTracker(onProgress),
  });
  const embed = async group => {
    const out = {};
    for (const [key, def] of Object.entries(group)) {
      const inputs = tokenizer(def.prompts, { padding: 'max_length', truncation: true });
      const { text_embeds } = await model(inputs);
      out[key] = meanVector(text_embeds.normalize(2, -1).tolist().map(v => Float32Array.from(v)));
    }
    return out;
  };
  return { scenes: await embed(SCENES), styles: await embed(STYLES) };
}

function toBase64(f32) {
  const bytes = new Uint8Array(f32.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

export function serializeEmbeddings(emb) {
  const enc = g => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, toBase64(v)]));
  return { model: MODEL_ID, hash: promptsHash(), created: new Date().toISOString(),
           scenes: enc(emb.scenes), styles: enc(emb.styles) };
}

function deserializeEmbeddings(json) {
  const dec = g => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, fromBase64(v)]));
  return { scenes: dec(json.scenes), styles: dec(json.styles) };
}

// ---------------------------------------------------------------------------
// Postęp pobierania modelu (sumowany po wszystkich plikach)
// ---------------------------------------------------------------------------

function progressTracker(onProgress) {
  if (!onProgress) return undefined;
  const files = new Map();
  return e => {
    if (e.status === 'progress' && e.total) files.set(e.file, { loaded: e.loaded, total: e.total });
    if (e.status === 'done' && files.has(e.file)) files.get(e.file).loaded = files.get(e.file).total;
    let loaded = 0, total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    if (total) onProgress(Math.min(1, loaded / total));
  };
}

// ---------------------------------------------------------------------------
// Wczytanie zdjęcia (plik od klienta albo adres URL) do pomniejszonego canvasa
// ---------------------------------------------------------------------------

export async function loadImage(source, maxSide = 1024) {
  if (typeof source === 'string' || source instanceof URL) {
    const res = await fetch(source, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    source = await res.blob();
  }
  // rzuca wyjątek dla nieobsługiwanych formatów (np. HEIC w Chrome)
  const img = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const w = img.width, h = img.height;
  if (!w || !h) throw new Error('empty image');
  const s = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * s);
  canvas.height = Math.round(h * s);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return canvas;
}

// ---------------------------------------------------------------------------
// Paleta barw zdjęcia
// ---------------------------------------------------------------------------

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hex = c => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');

/** Dominujące kolory zdjęcia (k-średnie na pomniejszonym obrazie). */
export function extractPalette(canvas, k = 6) {
  const size = 64;
  const small = document.createElement('canvas');
  const scale = size / Math.max(canvas.width, canvas.height);
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const { data } = ctx.getImageData(0, 0, small.width, small.height);

  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return null;

  // start: kolory rozłożone równomiernie wg jasności – wynik deterministyczny
  const sorted = [...px].sort((a, b) => luminance(...a) - luminance(...b));
  let centers = Array.from({ length: k }, (_, i) => [...sorted[Math.floor((i + 0.5) * sorted.length / k)]]);
  const assign = new Array(px.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) { bestD = d; best = j; }
      });
      assign[i] = best;
      const s = sums[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    centers = sums.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]));
  }
  const counts = centers.map(() => 0);
  assign.forEach(a => counts[a]++);

  const colors = centers.map((c, j) => {
    const [h, s, l] = rgbToHsl(...c);
    return { hex: hex(c), share: counts[j] / px.length, light: luminance(...c), hue: h, sat: s, l };
  }).filter(c => c.share > 0.01).sort((a, b) => b.share - a.share);

  const light = colors.reduce((a, c) => a + c.light * c.share, 0);
  // "ciepłe" barwy: odcienie drewna, beżu, terakoty
  const warm = colors.reduce((a, c) => a + ((c.hue >= 12 && c.hue <= 52 && c.sat > 0.15 && c.l > 0.15 && c.l < 0.88) ? c.share : 0), 0);
  const cool = colors.reduce((a, c) => a + ((c.hue >= 180 && c.hue <= 260 && c.sat > 0.12) ? c.share : 0), 0);
  const dark = colors.reduce((a, c) => a + (c.light < 0.18 ? c.share : 0), 0);

  const words = [
    light > 0.6 ? 'jasne' : light < 0.36 ? 'ciemne' : 'stonowane',
    warm > 0.25 ? 'ciepłe' : cool > 0.2 ? 'chłodne' : 'neutralne',
  ];
  return { colors: colors.slice(0, 5), light, warm, cool, dark, words };
}

// ---------------------------------------------------------------------------
// Silnik
// ---------------------------------------------------------------------------

const softmax = logits => {
  const m = Math.max(...logits);
  const e = logits.map(x => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / s);
};

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export class VisionEngine {
  /**
   * @param {object} o
   * @param {string|URL} o.embeddingsUrl  data/text-embeddings.json
   * @param {string} [o.dtype]  wariant wag modelu wizyjnego: 'fp16' (23 MB, domyślny) lub 'fp32' (45 MB).
   *                            Uwaga: 'q8' (12 MB) psuje wyniki – MobileCLIP źle znosi kwantyzację.
   * @param {(p:number)=>void} [o.onProgress]  postęp pobierania 0..1
   */
  constructor({ embeddingsUrl, dtype = 'fp16', onProgress } = {}) {
    this.embeddingsUrl = embeddingsUrl;
    this.dtype = dtype;
    this.onProgress = onProgress;
    this.ready = false;
  }

  load() {
    this._loading ??= (async () => {
      const t = await lib();
      const vision = dtype => t.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype, progress_callback: progressTracker(v => this.onProgress?.(v)),
      });
      const [processor, model, text] = await Promise.all([
        t.AutoProcessor.from_pretrained(MODEL_ID),
        vision(this.dtype).catch(err => {
          if (this.dtype === 'fp32') throw err;
          console.warn(`[Liveo] model ${this.dtype} niedostępny, używam fp32`, err);
          return vision((this.dtype = 'fp32'));
        }),
        this._loadText(),
      ]);
      Object.assign(this, { processor, model, text, RawImage: t.RawImage });
      this.ready = true;
      this.onProgress?.(1);
    })();
    this._loading.catch(() => { this._loading = null; }); // pozwól spróbować ponownie
    return this._loading;
  }

  async _loadText() {
    try {
      const res = await fetch(this.embeddingsUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.model === MODEL_ID && json.hash === promptsHash()) return deserializeEmbeddings(json);
        console.warn('[Liveo] text-embeddings.json jest nieaktualny – przeliczam w przeglądarce (uruchom tools/build-embeddings.html).');
      }
    } catch { /* brak pliku – przeliczamy niżej */ }
    return computeTextEmbeddings({ dtype: 'q8' });
  }

  /** Główna analiza: canvas ze zdjęciem → scena, styl, paleta. */
  async analyze(canvas) {
    await this.load();
    const image = this.RawImage.fromCanvas(canvas);
    const inputs = await this.processor(image);
    const { image_embeds } = await this.model(inputs);
    const v = normalize(image_embeds.data);

    const sceneKeys = Object.keys(SCENES);
    const sp = softmax(sceneKeys.map(k => LOGIT_SCALE * dot(v, this.text.scenes[k])));
    const scenes = sceneKeys.map((k, i) => ({ key: k, ...SCENES[k], prompts: undefined, p: sp[i] }))
      .sort((a, b) => b.p - a.p);

    const styleKeys = Object.keys(STYLES);
    const stp = softmax(styleKeys.map(k => LOGIT_SCALE * dot(v, this.text.styles[k])));
    const styles = styleKeys.map((k, i) => ({ key: k, ...STYLES[k], prompts: undefined, p: stp[i] }))
      .sort((a, b) => b.p - a.p);

    return { scenes, styles, palette: extractPalette(canvas), decision: decide(scenes) };
  }
}

// ---------------------------------------------------------------------------
// Interpretacja wyniku
// ---------------------------------------------------------------------------

/**
 * Zamienia rozkład prawdopodobieństw na decyzję dla czatu:
 *   { type: 'room', room, alternatives[], confidence }
 *   { type: 'ask', suggestions[], reason }      – wnętrze, ale nie wiadomo jakie
 *   { type: 'nofurn' | 'reject' | 'product', scene }
 */
export function decide(scenes) {
  const sum = f => scenes.filter(f).reduce((a, s) => a + s.p, 0);
  const top = scenes[0];
  const rooms = scenes.filter(s => s.kind === 'room');
  const places = scenes.filter(s => s.kind === 'reject' && !s.object);
  const pRoom = sum(s => s.kind === 'room');
  const pEmpty = sum(s => s.kind === 'unsure');
  const pInterior = pRoom + pEmpty;
  const pPlace = sum(s => s.kind === 'reject' && !s.object);
  const suggestions = rooms.slice(0, 3).map(r => r.key);

  // 1. miejsce na zewnątrz: podjazd, ogród, budynek, ulica, krajobraz
  if (pPlace >= 0.5 || (pPlace >= 0.3 && pPlace > pInterior)) {
    return { type: 'reject', scene: places[0], confidence: pPlace, suggestions };
  }
  // 2. wnętrze, do którego Liveo nie ma mebli (łazienka, garaż)
  if (top.kind === 'nofurn' && top.p >= 0.45 && top.p > pRoom) {
    return { type: 'nofurn', scene: top, confidence: top.p, suggestions };
  }
  // 3. zbliżenie na osobę, zwierzę, jedzenie, dokument – bez śladu wnętrza
  //    (pies na tle salonu to nadal salon, więc wtedy idziemy dalej)
  if (top.object && pInterior < 0.25) return { type: 'reject', scene: top, confidence: top.p, suggestions };
  // 4. zdjęcie pojedynczego mebla
  if (top.kind === 'product' && pInterior < 0.25) return { type: 'product', scene: top, suggestions };

  // 5. wnętrze
  if (pInterior >= 0.25) {
    if (pEmpty >= 0.45 && pEmpty > rooms[0].p) return { type: 'ask', reason: 'empty', suggestions };
    if (rooms[0].p >= 0.2) {
      return {
        type: 'room', room: rooms[0].key, confidence: rooms[0].p / pRoom,
        alternatives: rooms.slice(1, 3).filter(r => r.p / pRoom >= 0.15).map(r => r.key),
      };
    }
  }
  return { type: 'ask', reason: 'unclear', suggestions };
}
