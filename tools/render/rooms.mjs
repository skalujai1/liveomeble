#!/usr/bin/env node
// Aranżacje: node tools/render/rooms.mjs [--only salon-jasny,biuro] [--frame wide|tall] [--samples N] [--preview] [--scale 0.4] [--out <dir>]
// Domyślnie: wszystkie pokoje, oba kadry → src/assets/renders/rooms/<nazwa>-wide.jpg (2400×1350) i -tall.jpg (1200×1500).
import path from 'node:path';
import fs from 'node:fs';
import { openRenderer, saveJpeg, fmtMs } from './lib/driver.mjs';
import { updateManifest, describeRoom, RENDERS } from './lib/manifest.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const preview = args.includes('--preview');
const outDir = path.resolve(flag('--out', path.join(RENDERS, 'rooms')));
const only = flag('--only');
const frames = flag('--frame') ? [flag('--frame')] : ['wide', 'tall'];
const SIZES = { wide: [2400, 1350], tall: [1200, 1500] };
const samples = Number(flag('--samples', preview ? 48 : 64));

const R = await openRenderer();
const rooms = await R.page.evaluate(async () => (await import('./js/rooms.js')).ROOM_LIST());
const t0 = Date.now();
const entries = [];
try {
  for (const room of rooms) {
    if (only && !only.split(',').includes(room.name)) continue;
    for (const frame of frames) {
      let [w, h] = SIZES[frame];
      const sc = Number(flag('--scale', preview ? 0.4 : 1));
      if (sc !== 1) { w = Math.round(w * sc); h = Math.round(h * sc); }
      const file = path.join(outDir, `${room.name}-${frame}.jpg`);
      process.stdout.write(`→ ${room.name} (${frame}, ${w}×${h}, ${samples} próbek) … `);
      const res = await R.render({ kind: 'room', room: room.name, frame, width: w, height: h, samples, preview });
      await saveJpeg(res.png, file, 88);
      console.log(`${fmtMs(res.ms)} (${Math.round(fs.statSync(file).size / 1024)} kB)`);
      if (!preview) { const e = await describeRoom(file, room, frame, [w, h]); entries.push(e); updateManifest([e]); }
    }
  }
} finally {
  await R.close();
}
console.log(`Gotowe w ${fmtMs(Date.now() - t0)}`);
