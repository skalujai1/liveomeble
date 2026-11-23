// Sprawdza linki do plików z kart produktu (instrukcje PDF, animacje, rysunki) i zapisuje te, które działają,
// do tools/data/links-ok.json. generate.mjs pokazuje na stronie tylko linki z tej listy (gdy lista istnieje),
// więc martwe adresy z eksportu (404 na upload.liveomeble.pl) nie trafiają na strony mebli.
// Uruchomienie: node tools/data/check-links.mjs  (potem npm run data). Wymaga dostępu do upload/pub.liveomeble.pl.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const karty = JSON.parse(readFileSync(join(here, 'karty-liveo.json'), 'utf8'));
const list = Array.isArray(karty) ? karty : karty.products ?? Object.values(karty);
const split = u => String(u || '').split(/\s+/).filter(x => /^https?:\/\//.test(x)).map(x => x.replace(/^http:\/\//, 'https://'));
const urls = new Set();
const walk = o => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (['instruction', 'animation', 'drawing'].includes(k) && typeof v === 'string') split(v).forEach(u => urls.add(u));
    else if (typeof v === 'object') walk(v);
  }
};
walk(list);

const check = async u => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      return r.status === 200 || r.status === 206;
    } catch { /* ponów raz */ }
  }
  return false;
};
const all = [...urls];
const ok = [];
for (let i = 0; i < all.length; i += 16) {
  const part = all.slice(i, i + 16);
  const res = await Promise.all(part.map(check));
  part.forEach((u, j) => res[j] && ok.push(u));
}
ok.sort();
writeFileSync(join(here, 'links-ok.json'), JSON.stringify({ checked: new Date().toISOString().slice(0, 10), total: all.length, ok }, null, 1) + '\n');
console.log(`Linki do plików: ${ok.length} działa z ${all.length} (zapisano tools/data/links-ok.json)`);
