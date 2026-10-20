#!/usr/bin/env node
// Packshoty: node tools/render/render.mjs <spec.json> <out-dir> [--only <plik|fragment>] [--samples N] [--size 1600x1200] [--png]
// spec.json: { "defaults": {...}, "items": [ { "file": "szafka-rtv-dab-naturalny.webp", "title": "...", "model": { model3d } } ] }
import fs from 'node:fs';
import path from 'node:path';
import { openRenderer, saveWebp, fmtMs, REPO } from './lib/driver.mjs';
import { updateManifest, describePackshot } from './lib/manifest.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const [specPath, outDir] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--png'].includes(args[i - 1])));
if (!specPath || !outDir) {
  console.error('Użycie: node tools/render/render.mjs <spec.json> <out-dir> [--only nazwa] [--samples N] [--size 1600x1200]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const items = Array.isArray(spec) ? spec.map((m) => ({ model: m })) : spec.items;
const defaults = Object.assign({ width: 1600, height: 1200, samples: 160 }, spec.defaults || {});
if (flag('--samples')) defaults.samples = Number(flag('--samples'));
if (flag('--size')) { const [w, h] = flag('--size').split('x').map(Number); defaults.width = w; defaults.height = h; }
const only = flag('--only');

function fileName(it) {
  if (it.file) return it.file;
  const m = it.model;
  const kind = { cabinet: 'szafka', bed: 'lozko', table: 'stol', coffeeTable: 'lawa', desk: 'biurko', wallShelf: 'polka', mirror: 'lustro', coatRack: 'wieszak' }[m.kind] || m.kind;
  return `${kind}-${m.finish.front || m.finish.body}.webp`;
}

const R = await openRenderer();
const t0 = Date.now();
const manifest = [];
try {
  for (const it of items) {
    const file = fileName(it);
    if (only && !file.includes(only)) continue;
    const job = Object.assign({ kind: 'packshot' }, defaults, it.render || {}, { spec: it.model, view: it.view || {} });
    process.stdout.write(`→ ${file} … `);
    const res = await R.render(job);
    const out = path.resolve(outDir, file);
    if (args.includes('--png')) fs.writeFileSync(out.replace(/\.webp$/, '.png'), res.png);
    else await saveWebp(res.png, out, 88);
    const kb = Math.round(fs.statSync(args.includes('--png') ? out.replace(/\.webp$/, '.png') : out).size / 1024);
    console.log(`${fmtMs(res.ms)} (${kb} kB)`);
    manifest.push(await describePackshot(out, it, job));
  }
} finally {
  await R.close();
}
if (!args.includes('--png') && manifest.length) updateManifest(manifest);
console.log(`Gotowe: ${manifest.length} plików w ${fmtMs(Date.now() - t0)}`);
