#!/usr/bin/env node
// Aranżacje kolekcji: node tools/render/collections.mjs [--only olmo,nokta] [--frame wide|tall] [--samples N] [--preview] [--scale 0.4] [--out <dir>]
// Każda kolekcja dostaje własne wnętrze z jej meblami (model3d z src/data/products.json, w kolorze wybranego wariantu)
// na bazie pokoju z web/js/rooms.js → src/assets/renders/collections/<slug>-wide.jpg i -tall.jpg.
// Bez tego karty kolekcji pokazywały wspólne, poglądowe zdjęcie pomieszczenia (kilka kolekcji z tym samym obrazem).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openRenderer, saveJpeg, fmtMs } from './lib/driver.mjs';
import { updateManifest, describeRoom, RENDERS } from './lib/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const load = (f) => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8')); return j.products ?? j.collections ?? j; };
const products = load('products.json');
const collections = load('collections.json');

// Scena kolekcji: pokój bazowy (zgodny z heroRoom kolekcji), meble kolekcji w miejsce mebli bazowych
// (klucz modelu w rooms.js → SKU + kod wariantu) i ewentualnie inny kolor ściany tylnej.
const SCENES = {
  olmo: { room: 'salon-jasny', models: { rtv180: ['LV-OLMO-RTV160', 'DN'] } },
  talve: { room: 'sypialnia', models: { lozko160: ['LV-TALVE-LOZ140', 'GR-DN'], nocna: ['LV-TALVE-SZN45', 'GR-DN'] } },
  nokta: { room: 'jadalnia', models: { stol160: ['LV-NOKTA-STO180', 'DM-CM'], sideboardOrzech: ['LV-NOKTA-KRE160', 'DM-CM'] } },
  solma: { room: 'sypialnia', models: { lozko160: ['LV-SOLMA-LOZ160', 'KA-ZL'], nocna: ['LV-SOLMA-SZN50', 'KA-ZL'] }, roomPatch: { walls: { back: '#d6c9b8' } } },
  liran: { room: 'salon-szalwia', models: { komoda120: ['LV-LIRAN-KOM140', 'CM-DN'], witryna: ['LV-LIRAN-WIT50', 'CM-DN'] } },
  melva: { room: 'jadalnia', models: { stol160: ['LV-MELVA-STO160R', 'KA-DM'], sideboardOrzech: ['LV-MELVA-KRE120', 'KA-DM'] }, roomPatch: { walls: { back: '#a9b09c' } } },
  briso: { room: 'biuro', models: { biurko120: ['LV-BRISO-BIU120', 'BM-DN'], regal80: ['LV-BRISO-REG50', 'BM-DN'] } },
  verno: { room: 'przedpokoj', models: { szafkaNaButy: ['LV-VERNO-SZB100', 'BM-DN'], wieszak: ['LV-VERNO-WIE80', 'BM-DN'], lustroLuk: ['LV-VERNO-LUS50', 'BM-DN'] } },
};

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const preview = args.includes('--preview');
const outDir = path.resolve(flag('--out', path.join(RENDERS, 'collections')));
const only = flag('--only');
const frames = flag('--frame') ? flag('--frame').split(',') : ['wide', 'tall'];
// cinema = panorama do hero na pełną szerokość; angle = ujęcie pod kątem; detail = zbliżenie (galeria kolekcji)
const SIZES = { wide: [2400, 1350], tall: [1200, 1500], cinema: [3200, 1600], angle: [2400, 1600], detail: [1600, 2000] };
// Punkt, w który celują kadry angle i detail: środek głównego mebla w pokoju bazowym (x, y, z w metrach; ściana tylna z = 0).
const FOCUS = {
  'salon-jasny': [0.55, 0.42, 0.25], 'salon-szalwia': [-0.7, 0.45, 0.25], sypialnia: [1.25, 0.45, 0.7],
  jadalnia: [1.1, 0.5, 0.25], przedpokoj: [0.45, 0.5, 0.2], biuro: [0.55, 0.6, 0.35],
};
const CAMERA = {
  angle: ([x, y, z]) => ({ pos: [x + 2.3, 1.3, z + 3.1], target: [x, y + 0.12, z], fov: 40 }),
  detail: ([x, y, z]) => ({ pos: [x + 0.45, y + 0.22, z + 1.3], target: [x, y, z], fov: 34 }),
};
// Pokoje, w których kamera z CAMERA wypada za ścianą albo celuje w mało ciekawy fragment
const CAMERA_FIX = {
  sypialnia: {
    angle: { pos: [2.75, 1.3, 3.4], target: [1.0, 0.55, 0.9], fov: 42 },
    detail: { pos: [2.45, 0.62, 1.25], target: [2.0, 0.42, 0.22], fov: 34 }, // szafka nocna i róg łóżka
  },
  przedpokoj: { angle: { pos: [1.55, 1.3, 3.0], target: [0.45, 0.62, 0.2], fov: 44 } },
  'salon-szalwia': { detail: { pos: [0.05, 1.05, 1.35], target: [-0.4, 0.86, 0.2], fov: 34 } }, // blat komody z lampą
  biuro: { detail: { pos: [1.05, 1.05, 1.45], target: [0.5, 0.78, 0.3], fov: 34 } }, // blat biurka z lampką
};
const samples = Number(flag('--samples', preview ? 48 : 64));
const sc = Number(flag('--scale', preview ? 0.4 : 1));
const ROOM_LOC = { salon: 'w salonie', sypialnia: 'w sypialni', jadalnia: 'w jadalni', przedpokoj: 'w przedpokoju', 'pokoj-mlodziezowy': 'w pokoju młodzieżowym', biuro: 'w domowym biurze' };

function sceneFor(c) {
  const s = SCENES[c.slug];
  if (!s) return null;
  const models = {};
  const pieces = [];
  for (const [key, [sku, code]] of Object.entries(s.models)) {
    const p = products.find((x) => x.sku === sku);
    const v = p?.variants.find((x) => x.code === code);
    if (!p?.model3d || !v) throw new Error(`${c.slug}: brak ${sku} / ${code} w products.json`);
    models[key] = { ...p.model3d, finish: v.finish || p.model3d.finish };
    pieces.push(`${p.name.replace(` ${c.name}`, '').toLocaleLowerCase('pl')} (${(v.colorLabel || code).toLocaleLowerCase('pl')})`);
  }
  const where = ROOM_LOC[c.heroRoom] ?? '';
  const title = `Kolekcja ${c.name} ${where} — ${pieces.join(', ')}`;
  return { ...s, models, info: { name: `kolekcja-${c.slug}`, title, description: `${title}. Render 3D (atrapa zdjęcia) — meble z kolekcji ${c.name} w aranżacji.`, palette: '', notes: {} } };
}

fs.mkdirSync(outDir, { recursive: true });
const R = await openRenderer();
const t0 = Date.now();
try {
  for (const c of collections) {
    if (only && !only.split(',').includes(c.slug)) continue;
    const scene = sceneFor(c);
    if (!scene) { console.log(`– ${c.slug}: brak sceny w SCENES, pomijam`); continue; }
    for (const frame of frames) {
      let [w, h] = SIZES[frame];
      if (sc !== 1) { w = Math.round(w * sc); h = Math.round(h * sc); }
      const file = path.join(outDir, `${c.slug}-${frame}.jpg`);
      process.stdout.write(`→ ${c.slug} (${scene.room}, ${frame}, ${w}×${h}, ${samples} próbek) … `);
      const focus = FOCUS[scene.room];
      const camera = frame === 'cinema' ? 'cinema' : CAMERA_FIX[scene.room]?.[frame] ?? CAMERA[frame]?.(focus);
      const job = { kind: 'room', room: scene.room, models: scene.models, roomPatch: scene.roomPatch, frame: SIZES[frame] && !['wide', 'tall'].includes(frame) ? 'wide' : frame, width: w, height: h, samples, preview };
      if (camera === 'cinema') job.cinema = true; else if (camera) job.camera = camera;
      const res = await R.render(job);
      await saveJpeg(res.png, file, 88);
      console.log(`${fmtMs(res.ms)} (${Math.round(fs.statSync(file).size / 1024)} kB)`);
      if (!preview) {
        const e = await describeRoom(file, scene.info, frame, [w, h]);
        updateManifest([{ ...e, room: c.heroRoom, collection: c.slug }]);
      }
    }
  }
  // Pokój młodzieżowy nie ma własnej aranżacji (roomImage brał kadr kolekcji BRISO): sypialnia z łóżkiem 90
  // i szafką nocną BRISO na ścianie w kolorze szałwii → rooms/pokoj-mlodziezowy-wide|tall.jpg.
  if (args.includes('--teen')) {
    const teen = { room: 'sypialnia', models: { lozko160: ['LV-BRISO-LOZ90', 'GR-DM'], nocna: ['LV-BRISO-SZN40', 'GR-DM'] }, roomPatch: { walls: { back: '#b9c2ad' } } };
    const models = {};
    for (const [key, [sku, code]] of Object.entries(teen.models)) {
      const p = products.find((x) => x.sku === sku);
      const v = p.variants.find((x) => x.code === code);
      models[key] = { ...p.model3d, finish: v.finish || p.model3d.finish };
    }
    const title = 'Pokój młodzieżowy — łóżko 90 i szafka nocna BRISO, ściana w kolorze szałwii';
    const roomsDir = path.join(RENDERS, 'rooms');
    for (const frame of ['wide', 'tall']) {
      const [w, h] = SIZES[frame];
      const file = path.join(preview ? outDir : roomsDir, `pokoj-mlodziezowy-${frame}.jpg`);
      process.stdout.write(`→ pokój młodzieżowy (${frame}) … `);
      const res = await R.render({ kind: 'room', room: teen.room, models, roomPatch: teen.roomPatch, frame, width: w, height: h, samples, preview });
      await saveJpeg(res.png, file, 88);
      console.log(fmtMs(res.ms));
      if (!preview) {
        const e = await describeRoom(file, { name: 'pokoj-mlodziezowy', title, description: `${title}. Render 3D (atrapa zdjęcia).`, palette: '', notes: {} }, frame, [w, h]);
        updateManifest([{ ...e, room: 'pokoj-mlodziezowy' }]);
      }
    }
  }
} finally {
  await R.close();
}
console.log(`Gotowe w ${fmtMs(Date.now() - t0)}`);
