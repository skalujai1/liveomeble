// Daty `lastmod` do sitemap.xml (czytane przez astro.config.mjs przy budowie).
// Meble: dzień ostatniej zmiany ceny (priceHistory) albo danych; poradniki i strony prawne: `updated`.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const frontmatterValue = (src, key) => (new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, 'm').exec(src) || [])[1];

export function sitemapLastmod(today = new Date().toISOString().slice(0, 10)) {
  const meta = readJson('src/data/meta.json');
  const base = meta.generatedFor || today;
  const map = new Map();
  for (const p of readJson('src/data/products.json')) {
    const changes = (p.priceHistory || []).map(e => e.date).filter(d => d <= today).sort();
    const last = changes.at(-1);
    map.set(`/produkt/${p.slug}/`, last && last > base ? last : base);
  }
  for (const dir of ['poradnik', 'legal']) {
    const abs = join(ROOT, 'src/content', dir);
    for (const f of readdirSync(abs).filter(f => f.endsWith('.md'))) {
      const src = readFileSync(join(abs, f), 'utf8');
      const slug = frontmatterValue(src, 'slug') || f.replace(/\.md$/, '');
      const updated = frontmatterValue(src, 'updated') || frontmatterValue(src, 'date');
      const path = dir === 'poradnik' ? `/poradnik/${slug}/` : `/${slug}/`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(updated || '')) map.set(path, updated);
    }
  }
  return { get: path => map.get(path) || base };
}
