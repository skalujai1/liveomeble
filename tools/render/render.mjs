#!/usr/bin/env node
// Packshoty: node tools/render/render.mjs <spec.json|products.json> <out-dir> [--only a,b] [--samples N] [--size 1600x1200] [--png] [--no-manifest] [--variants] [--manifest-only]
// spec.json: { "defaults": {...}, "items": [ { "file": "szafka-rtv-dab-naturalny.webp", "title": "...", "model": { model3d } } ] }
import fs from 'node:fs';
import path from 'node:path';
import { openRenderer, saveWebp, fmtMs, REPO } from './lib/driver.mjs';
import { updateManifest, describePackshot } from './lib/manifest.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const BOOL = ['--png', '--no-manifest', '--variants', '--manifest-only'];
const [specPath, outDir] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !BOOL.includes(args[i - 1])));
if (!specPath || !outDir) {
  console.error('Użycie: node tools/render/render.mjs <spec.json|products.json> <out-dir> [--only nazwa] [--samples N] [--size 1600x1200] [--png] [--no-manifest] [--variants]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
// Obsługiwane wejścia: { defaults, items:[{file,title,model}] } | [model3d, ...] | src/data/products.json (produkty z model3d;
// z flagą --variants: osobny render każdego wariantu wykończenia, nazwa pliku z variants[].images.packshot).
function fromProducts(list) {
  const out = [];
  for (const p of list) {
    if (!p.model3d) { out.push({ model: p }); continue; }
    if (args.includes('--variants') && Array.isArray(p.variants) && p.variants.length) {
      for (const v of p.variants) {
        const img = (v.images && v.images.packshot) || `${v.sku || p.id + '-' + v.code}.webp`;
        out.push({ file: path.basename(img), title: `${p.name} — ${v.colorLabel || v.code}`, model: Object.assign({}, p.model3d, { finish: v.finish || p.model3d.finish }) });
      }
    } else {
      const img = (p.images && p.images.packshot) || `${p.sku || p.id}.webp`;
      out.push({ file: path.basename(img), title: p.name, model: p.model3d });
    }
  }
  return out;
}
const items = Array.isArray(spec) ? fromProducts(spec) : spec.items;
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

// --manifest-only: bez renderowania — tylko opisy istniejących plików w manifest.json
if (args.includes('--manifest-only')) {
  for (const it of items) {
    const out = path.resolve(outDir, fileName(it));
    if (!fs.existsSync(out)) { console.log(`(brak) ${out}`); continue; }
    const job = Object.assign({ kind: 'packshot' }, defaults, it.render || {}, { spec: it.model });
    updateManifest([await describePackshot(out, it, job)]);
    console.log(`manifest ← ${path.basename(out)}`);
  }
  process.exit(0);
}
const R = await openRenderer();
const t0 = Date.now();
const manifest = [];
let done = 0;
try {
  for (const it of items) {
    const file = fileName(it);
    if (only && !only.split(',').some((o) => file.includes(o))) continue;
    const job = Object.assign({ kind: 'packshot' }, defaults, it.render || {}, { spec: it.model, view: it.view || {} });
    process.stdout.write(`→ ${file} … `);
    const res = await R.render(job);
    const out = path.resolve(outDir, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (args.includes('--png')) fs.writeFileSync(out.replace(/\.webp$/, '.png'), res.png);
    else await saveWebp(res.png, out, 88);
    const kb = Math.round(fs.statSync(args.includes('--png') ? out.replace(/\.webp$/, '.png') : out).size / 1024);
    console.log(`${fmtMs(res.ms)} (${kb} kB)`);
    if (!args.includes('--png') && !args.includes('--no-manifest')) { const e = await describePackshot(out, it, job); manifest.push(e); updateManifest([e]); }
    done++;
  }
} finally {
  await R.close();
}
console.log(`Gotowe: ${done} plików w ${fmtMs(Date.now() - t0)}`);
