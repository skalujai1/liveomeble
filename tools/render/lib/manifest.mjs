// Manifest renderów: src/assets/renders/manifest.json — lista plików z opisem po polsku.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { REPO } from './driver.mjs';

export const RENDERS = path.join(REPO, 'src', 'assets', 'renders');
const MANIFEST = path.join(RENDERS, 'manifest.json');

const FINISH_NAMES = {
  'dab-naturalny': 'dąb naturalny', 'dab-miodowy': 'dąb miodowy', orzech: 'orzech', 'bialy-mat': 'biały mat',
  'bialy-polysk': 'biały połysk', kaszmir: 'kaszmir', szalwia: 'szałwia', grafit: 'grafit', 'czarny-mat': 'czarny mat',
};
const METAL_NAMES = { czarny: 'czarny metal', zloty: 'szczotkowany mosiądz (złoty)', stal: 'stal' };

function hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''); }

/** Kolory dominujące: prosta kwantyzacja (piksele nieprzezroczyste). */
export async function dominantColors(file, k = 4) {
  const { data, info } = await sharp(file).resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const key = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | (data[i + 2] >> 4);
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
    buckets.set(key, b);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const out = [];
  for (const b of sorted) {
    const c = [b.r / b.n, b.g / b.n, b.b / b.n];
    if (out.some((o) => Math.hypot(o.c[0] - c[0], o.c[1] - c[1], o.c[2] - c[2]) < 38)) continue;
    out.push({ c, n: b.n });
    if (out.length >= k) break;
  }
  return out.map((o) => hex(...o.c));
}

export async function describePackshot(file, it, job) {
  const m = it.model;
  const f = m.finish || {};
  const parts = [FINISH_NAMES[f.body] || f.body];
  if (f.front && f.front !== f.body) parts.push(`fronty ${FINISH_NAMES[f.front] || f.front}`);
  if (f.top && f.top !== f.body) parts.push(`blat ${FINISH_NAMES[f.top] || f.top}`);
  if (f.metal && (m.handle && m.handle !== 'push' || /legsMetal|frame/.test(m.base || ''))) parts.push(METAL_NAMES[f.metal] || f.metal);
  return {
    file: path.relative(RENDERS, file).split(path.sep).join('/'),
    type: 'packshot',
    title: it.title || `${m.kind} ${m.w}`,
    description: `${it.title || m.kind}. Packshot na przezroczystym tle z miękkim cieniem kontaktowym, widok 3/4 z lekkiego nadwidoku. Wykończenie: ${parts.join(', ')}.`,
    width: job.width, height: job.height, format: 'webp (alfa)',
    dominantColors: await dominantColors(file),
    textSpace: 'tło przezroczyste — tekst poza obrazem lub na tle strony',
    model: m,
    placeholder: true,
  };
}

export async function describeRoom(file, room, frame, size) {
  return {
    file: path.relative(RENDERS, file).split(path.sep).join('/'),
    type: 'aranzacja',
    room: room.name,
    frame,
    title: room.title,
    description: room.description || room.title,
    width: size[0], height: size[1], format: 'jpg',
    dominantColors: await dominantColors(file),
    palette: room.palette || '',
    textSpace: (room.notes && room.notes[frame]) || '',
    placeholder: true,
  };
}

export function updateManifest(entries) {
  let man = { note: 'Atrapy zdjęć (rendery 3D z tools/render) — do podmiany na zdjęcia klienta.', items: [] };
  if (fs.existsSync(MANIFEST)) { try { man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { /* nowy */ } }
  const byFile = new Map(man.items.map((i) => [i.file, i]));
  for (const e of entries) byFile.set(e.file, e);
  man.items = [...byFile.values()].sort((a, b) => (a.type === b.type ? a.file.localeCompare(b.file) : a.type === 'aranzacja' ? -1 : 1));
  man.generated = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(RENDERS, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + '\n');
}
