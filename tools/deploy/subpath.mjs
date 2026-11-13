// Kopia gotowej strony (dist/) pod podkatalogiem cudzej domeny, np. https://skaluj.ai/liveomeble/ (GitHub Pages skaluj.ai).
//   node tools/deploy/subpath.mjs <katalog-docelowy> [--prefix /liveomeble] [--origin https://skaluj.ai]
//   np.: node tools/deploy/subpath.mjs D:/skaluj-ai/liveomeble
// Strona zakłada adresy od korzenia („/katalog/…”, „/produkt/…”), więc w plikach tekstowych (HTML, CSS, JS, JSON, SVG)
// adresy zaczynające się od nazwy wpisu z korzenia dist/ dostają przedrostek. Do tego: noindex (to podgląd, nie strona
// klienta), adresy kanoniczne i obrazy udostępniania na nowej domenie; bez robots.txt, map strony i plików Cloudflare.
// Katalog docelowy jest czyszczony — musi kończyć się nazwą przedrostka (zabezpieczenie przed pomyłką).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const prefix = opt('--prefix', '/liveomeble').replace(/\/$/, '');
const origin = opt('--origin', 'https://skaluj.ai').replace(/\/$/, '');
const [target] = args;
const from = resolve('dist');
if (!target) { console.error('Podaj katalog docelowy, np. D:/skaluj-ai/liveomeble'); process.exit(1); }
const to = resolve(target);
if (basename(to) !== basename(prefix)) { console.error(`Katalog docelowy musi kończyć się na „${basename(prefix)}” (jest: ${to})`); process.exit(1); }
if (!existsSync(join(from, 'index.html'))) { console.error('Brak dist/index.html — najpierw zbuduj stronę.'); process.exit(1); }

const SKIP = new Set(['robots.txt', '_headers', '_redirects']);
const skip = name => SKIP.has(name) || /^sitemap.*\.xml$/.test(name);
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.webmanifest']);

// Adres od korzenia = „/” + nazwa wpisu z korzenia dist/, poprzedzone cudzysłowem, nawiasem, przecinkiem, „=” albo spacją.
const roots = readdirSync(from).filter(n => !skip(n)).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const ROOT_URL = new RegExp(`(^|[\\s"'\`(,=])\\/(${roots.join('|')})(?=[\\/"'\`?#)\\s,;]|$)`, 'g');

function rewrite(text, ext) {
  let s = text.replace(ROOT_URL, `$1${prefix}/$2`);
  if (ext === '.html') {
    s = s.replace(/(\s(?:href|action)=)(["'])\/\2/g, `$1$2${prefix}/$2`); // link do strony głównej
    s = s.replace(/<meta name="robots" content="[^"]*"/g, '<meta name="robots" content="noindex, nofollow"');
    // adres kanoniczny i obrazy udostępniania (podgląd linku w komunikatorze) wskazują nową domenę
    s = s.replace(/(<link rel="canonical" href="|<meta (?:property|name)="(?:og:url|og:image|twitter:image)" content=")https:\/\/liveomeble\.pl\//g, `$1${origin}${prefix}/`);
  }
  return s;
}

if (existsSync(to)) rmSync(to, { recursive: true, force: true });
let files = 0, changed = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (dir === from && skip(name)) continue;
    const src = join(dir, name), dst = join(to, relative(from, src));
    if (statSync(src).isDirectory()) { walk(src); continue; }
    mkdirSync(dirname(dst), { recursive: true });
    const ext = extname(name).toLowerCase();
    files++;
    if (!TEXT.has(ext)) { cpSync(src, dst); continue; }
    const before = readFileSync(src, 'utf8'), after = rewrite(before, ext);
    if (after !== before) changed++;
    writeFileSync(dst, after);
  }
})(from);
console.log(`Gotowe: ${files} plików → ${to} (przepisane adresy w ${changed}); przedrostek ${prefix}, domena ${origin}.`);
if (!readFileSync(join(to, 'index.html'), 'utf8').includes(`${prefix}/_astro/`)) { console.error('Uwaga: index.html bez przepisanych adresów /_astro/'); process.exit(1); }
