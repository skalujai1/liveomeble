#!/usr/bin/env node
// Kontrola zbudowanej strony (dist/) — uruchamiana po `astro build` (postbuild) i przez `npm run check:dist`.
// Standard: docs/standard-seo-geo-a11y.md. Błąd = kod wyjścia 1 (build się nie udaje), ostrzeżenie = tylko raport.
//
//   meta       <html lang="pl">, unikalne <title> (≤ 60) i description (≤ 155), canonical (absolutny, ze „/”), robots, OG, Twitter
//   nagłówki   jeden <h1>, bez przeskoków (h1 → h2 → h3)
//   JSON-LD    jeden blok @graph, parsuje się, wymagane typy dla szablonu, FAQPage = FAQ na stronie (słowo w słowo),
//              BreadcrumbList = okruszki na stronie, Offer z ceną (priceValidUntil przy promocji)
//   linki      każdy link wewnętrzny i zasób (href, src, srcset) istnieje w dist/, kotwice #id istnieją, adresy stron z „/”
//   a11y       unikalne id, etykiety pól formularzy, nazwy przycisków, alt/width/height obrazów, lazy poza LCP
//   sitemap    wszystkie strony indeksowane (i tylko one) z lastmod; robots.txt; llms.txt
//   DEMO       przy DEMO = false znaczniki [do potwierdzenia] / [do uzupełnienia] na stronach indeksowanych = błąd
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'dist');
const CONFIG = readFileSync(join(ROOT, 'src/config.ts'), 'utf8');
const SITE = /SITE_URL\s*=\s*'([^']+)'/.exec(CONFIG)[1];
const DEMO = /export const DEMO\s*=\s*true/.test(CONFIG);

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();

if (!existsSync(DIST)) {
  console.error('Brak katalogu dist/ — najpierw `npm run build`.');
  process.exit(1);
}

// ── Pliki ────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const allFiles = walk(DIST);
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
const pathOf = f => '/' + relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '').replace(/^404\.html$/, '404');

/** Czy adres (ścieżka bez parametrów) istnieje w dist/. */
function resolveTarget(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { p = pathname; }
  const fsPath = join(DIST, p);
  if (p.endsWith('/')) return existsSync(join(fsPath, 'index.html')) ? join(fsPath, 'index.html') : null;
  if (existsSync(fsPath) && statSync(fsPath).isFile()) return fsPath;
  return null;
}

// ── Strony ───────────────────────────────────────────────────────────────────
const pages = new Map(); // path → { doc, ids, robots, … }
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const doc = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const path = pathOf(file);
  const ids = new Set();
  for (const el of doc.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (ids.has(id)) err(path, `zduplikowane id="${id}"`);
    ids.add(id);
  }
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  pages.set(path, { file, html, doc, ids, robots, noindex: /noindex/.test(robots) || path === '/404' });
}

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
let jsonLdBlocks = 0;
let faqPagesChecked = 0;
let breadcrumbsChecked = 0;
let linksChecked = 0;
const todoPages = [];

const REQUIRED_LD = [
  [/^\/$/, ['Organization', 'WebSite', 'FAQPage']],
  [/^\/kolekcje\/$/, ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']],
  [/^\/kolekcje\/[^/]+\/$/, ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']],
  [/^\/meble\/$/, ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']],
  [/^\/meble\/[^/]+\/$/, ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']],
  [/^\/pomieszczenia\/[^/]+\/$/, ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']],
  [/^\/produkt\/[^/]+\/$/, [['Product', 'ProductGroup'], 'BreadcrumbList', 'FAQPage']],
  [/^\/poradnik\/[^/]+\/$/, [['Article', 'BlogPosting'], 'BreadcrumbList', 'FAQPage']],
  [/^\/promocje\/$/, ['CollectionPage', 'BreadcrumbList', 'FAQPage']],
  [/^\/o-nas\/$/, ['AboutPage', 'BreadcrumbList']],
  [/^\/kontakt\/$/, ['ContactPage', 'BreadcrumbList']],
];

let redirects = 0;
for (const [path, page] of pages) {
  const { doc } = page;
  const is404 = path === '/404';

  // Przekierowanie ze starego adresu (astro.config.mjs → redirects): meta refresh + noindex + canonical do celu.
  const refresh = doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content');
  if (refresh) {
    redirects++;
    const to = /url=(.+)$/i.exec(refresh)?.[1];
    if (!to || !resolveTarget(new URL(to, SITE).pathname)) err(path, `przekierowanie do nieistniejącej strony: ${to}`);
    if (!page.noindex) err(path, 'przekierowanie bez noindex');
    if (doc.querySelector('link[rel="canonical"]')?.getAttribute('href') !== new URL(to ?? '/', SITE).href) err(path, 'przekierowanie: canonical ≠ cel');
    continue;
  }

  // ── meta ──
  if (doc.querySelector('html')?.getAttribute('lang') !== 'pl') err(path, 'brak <html lang="pl">');
  const title = norm(doc.querySelector('title')?.text);
  const desc = norm(doc.querySelector('meta[name="description"]')?.getAttribute('content'));
  if (!title) err(path, 'brak <title>');
  else if ([...title].length > 60) err(path, `<title> ma ${[...title].length} znaków (> 60): „${title}”`);
  if (!desc) err(path, 'brak meta description');
  else if ([...desc].length > 155) err(path, `description ma ${[...desc].length} znaków (> 155)`);
  if (!page.robots) err(path, 'brak meta robots');
  if (title) titles.set(title, [...(titles.get(title) || []), path]);
  if (desc) descriptions.set(desc, [...(descriptions.get(desc) || []), path]);
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!is404) {
    if (!canonical) err(path, 'brak canonical');
    else {
      if (canonical !== SITE + path) err(path, `canonical ${canonical} ≠ ${SITE + path}`);
      canonicals.set(canonical, [...(canonicals.get(canonical) || []), path]);
    }
  }
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:type', 'og:locale']) {
    if (!doc.querySelector(`meta[property="${prop}"]`)) err(path, `brak ${prop}`);
  }
  for (const name of ['twitter:card', 'twitter:title']) {
    if (!doc.querySelector(`meta[name="${name}"]`)) err(path, `brak ${name}`);
  }
  if (!page.noindex && !doc.querySelector('meta[property="og:image"]')) warn(path, 'brak og:image (obrazy OG 1200×630 powstaną z renderami)');

  // ── nagłówki ──
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const h1s = headings.filter(h => h.tagName === 'H1');
  if (h1s.length !== 1) err(path, `${h1s.length} × <h1> (powinien być dokładnie jeden)`);
  let prev = 0;
  for (const h of headings) {
    const lvl = Number(h.tagName[1]);
    if (prev === 0 && lvl !== 1) err(path, `pierwszy nagłówek to <${h.tagName.toLowerCase()}> „${norm(h.text).slice(0, 50)}”, a nie <h1>`);
    else if (lvl > prev + 1 && prev !== 0) err(path, `przeskok nagłówków h${prev} → h${lvl} („${norm(h.text).slice(0, 50)}”)`);
    if (!norm(h.text)) err(path, `pusty <${h.tagName.toLowerCase()}>`);
    prev = lvl;
  }

  // ── JSON-LD ──
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  if (ldScripts.length > 1) err(path, `${ldScripts.length} bloki JSON-LD (powinien być jeden @graph)`);
  let nodes = [];
  for (const s of ldScripts) {
    jsonLdBlocks++;
    try {
      const data = JSON.parse(s.text);
      if (data['@context'] !== 'https://schema.org') err(path, 'JSON-LD: @context ≠ https://schema.org');
      nodes = nodes.concat(data['@graph'] || [data]);
    } catch (e) {
      err(path, `JSON-LD nie parsuje się: ${e.message}`);
    }
  }
  const types = new Set(nodes.map(n => n['@type']));
  for (const n of nodes) {
    if (!n['@type']) err(path, 'JSON-LD: węzeł bez @type');
    if (JSON.stringify(n).includes('[do ')) {
      (DEMO ? warn : err)(path, `JSON-LD zawiera znacznik [do …] w ${n['@type']}`);
    }
  }
  if (!is404 && !ldScripts.length && !page.noindex) err(path, 'brak JSON-LD');
  for (const [re, req] of REQUIRED_LD) {
    if (!re.test(path)) continue;
    for (const t of req) {
      const alts = Array.isArray(t) ? t : [t];
      if (!alts.some(a => types.has(a))) err(path, `JSON-LD: brak ${alts.join('/')}`);
    }
  }

  // FAQPage = FAQ widoczne na stronie (słowo w słowo, w tej samej kolejności)
  const faqHtml = doc.querySelectorAll('[data-faq] .faq__item').map(it => ({
    q: norm(it.querySelector('.faq__q')?.text),
    a: norm(it.querySelector('[data-faq-answer]')?.text),
  }));
  // Poradnik: FAQ to sekcja Markdown „Najczęstsze pytania” (H3 = pytanie, akapity do następnego H3 = odpowiedź).
  const faqH2 = doc.querySelectorAll('[data-article-body] h2').find(h => /Najczęstsze pytania/.test(h.text));
  for (let el = faqH2?.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
    if (el.tagName === 'H3') faqHtml.push({ q: norm(el.text), a: '' });
    else if (faqHtml.length) faqHtml[faqHtml.length - 1].a = norm(`${faqHtml[faqHtml.length - 1].a} ${el.text}`);
  }
  const faqLd = nodes.filter(n => n['@type'] === 'FAQPage').flatMap(n => n.mainEntity || []).map(q => ({ q: norm(q.name), a: norm(q.acceptedAnswer?.text) }));
  if (faqLd.length || (faqHtml.length && !page.noindex)) {
    faqPagesChecked++;
    if (faqLd.length !== faqHtml.length) err(path, `FAQ: ${faqHtml.length} pytań na stronie, ${faqLd.length} w JSON-LD`);
    faqLd.forEach((it, i) => {
      const h = faqHtml[i];
      if (!h) return;
      if (h.q !== it.q) err(path, `FAQ #${i + 1}: pytanie różni się\n    strona:  ${h.q}\n    JSON-LD: ${it.q}`);
      if (h.a !== it.a) err(path, `FAQ #${i + 1}: odpowiedź różni się\n    strona:  ${h.a.slice(0, 160)}\n    JSON-LD: ${it.a.slice(0, 160)}`);
    });
  }

  // BreadcrumbList = okruszki na stronie
  const crumbsHtml = doc.querySelectorAll('nav.breadcrumbs li').map(li => {
    const a = li.querySelector('a');
    return { name: norm(li.text), url: a ? SITE + a.getAttribute('href') : SITE + path };
  });
  const bc = nodes.find(n => n['@type'] === 'BreadcrumbList');
  if (path !== '/' && !is404 && !page.noindex && !bc) err(path, 'brak BreadcrumbList');
  if (bc || crumbsHtml.length) {
    breadcrumbsChecked++;
    const ld = (bc?.itemListElement || []).map(i => ({ name: norm(i.name), url: i.item }));
    if (ld.length !== crumbsHtml.length) err(path, `okruszki: ${crumbsHtml.length} na stronie, ${ld.length} w BreadcrumbList`);
    else ld.forEach((c, i) => {
      if (c.name !== crumbsHtml[i].name || c.url !== crumbsHtml[i].url) err(path, `okruszek #${i + 1}: „${crumbsHtml[i].name}” ${crumbsHtml[i].url} ≠ „${c.name}” ${c.url}`);
    });
  }

  // Product / Offer
  const products = nodes.filter(n => n['@type'] === 'Product' || n['@type'] === 'ProductGroup');
  for (const p of products) {
    const variants = p['@type'] === 'ProductGroup' ? p.hasVariant || [] : [p];
    if (!p.name || !(p.sku || p.productGroupID)) err(path, 'Product: brak name/sku');
    for (const v of variants) {
      const o = v.offers;
      if (!o || !o.price || o.priceCurrency !== 'PLN') err(path, `Offer: brak ceny w PLN (${v.sku})`);
      if (o?.priceSpecification && !o.priceValidUntil) warn(path, `Offer ${v.sku}: cena promocyjna bez priceValidUntil (promocja bez daty końca)`);
    }
    if (p.aggregateRating || p.review) err(path, 'Product: aggregateRating/review — nie mamy opinii');
  }

  // ── linki i zasoby ──
  const refs = [];
  for (const a of doc.querySelectorAll('a[href]')) refs.push({ kind: 'a', url: a.getAttribute('href') });
  for (const el of doc.querySelectorAll('link[href]')) {
    const rel = el.getAttribute('rel') || '';
    if (rel !== 'canonical') refs.push({ kind: 'link', url: el.getAttribute('href') });
  }
  for (const el of doc.querySelectorAll('img[src], script[src], source[src]')) refs.push({ kind: 'asset', url: el.getAttribute('src') });
  for (const el of doc.querySelectorAll('img[srcset], source[srcset]')) {
    for (const part of el.getAttribute('srcset').split(',')) refs.push({ kind: 'asset', url: part.trim().split(/\s+/)[0] });
  }
  for (const el of doc.querySelectorAll('form[action]')) refs.push({ kind: 'form', url: el.getAttribute('action') });
  for (const { kind, url } of refs) {
    if (!url || /^(mailto:|tel:|data:|javascript:)/.test(url)) continue;
    if (url.startsWith('#')) {
      if (url.length > 1 && !page.ids.has(decodeURIComponent(url.slice(1)))) err(path, `kotwica nie istnieje: ${url}`);
      continue;
    }
    let u;
    try { u = new URL(url, SITE + path); } catch { err(path, `niepoprawny adres ${url}`); continue; }
    if (u.origin !== SITE) {
      if (/^https?:/.test(url) && kind !== 'a') err(path, `zewnętrzny zasób ${url} (wszystko ma być lokalne)`);
      continue;
    }
    linksChecked++;
    if (/index\.html$/.test(u.pathname)) err(path, `link z index.html: ${url}`);
    const target = resolveTarget(u.pathname);
    if (!target) {
      err(path, `martwy ${kind === 'a' ? 'link' : 'zasób'}: ${url}`);
      continue;
    }
    if (kind === 'a' && !u.pathname.endsWith('/') && target.endsWith('.html')) err(path, `link do strony bez „/” na końcu: ${url}`);
    if (u.hash && u.hash.length > 1 && target.endsWith('.html')) {
      const targetPage = pages.get(pathOf(target));
      const id = decodeURIComponent(u.hash.slice(1));
      if (targetPage && !targetPage.ids.has(id)) err(path, `kotwica nie istnieje: ${url}`);
    }
  }

  // ── dostępność (statycznie) ──
  const imgs = doc.querySelectorAll('img');
  let eager = 0;
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (img.getAttribute('alt') === undefined) err(path, `<img> bez alt: ${src}`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) err(path, `<img> bez width/height: ${src}`);
    if (img.getAttribute('loading') !== 'lazy' && !img.closest('.site-header')) eager++; // logo w nagłówku jest zawsze na pierwszym ekranie
  }
  if (eager > 1) warn(path, `${eager} obrazy bez loading="lazy" (poza LCP powinny być lazy)`);
  for (const el of doc.querySelectorAll('input, select, textarea')) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
    const id = el.getAttribute('id');
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
      (id && doc.querySelector(`label[for="${id}"]`)) || el.closest('label');
    if (!labelled) err(path, `pole bez etykiety: <${el.tagName.toLowerCase()} name="${el.getAttribute('name') || ''}">`);
    const describedby = el.getAttribute('aria-describedby');
    if (describedby) for (const ref of describedby.split(/\s+/)) if (!page.ids.has(ref)) err(path, `aria-describedby="${ref}" — brak elementu`);
  }
  for (const el of doc.querySelectorAll('[aria-controls], [aria-labelledby]')) {
    for (const attr of ['aria-controls', 'aria-labelledby']) {
      const v = el.getAttribute(attr);
      if (v) for (const ref of v.split(/\s+/)) if (!page.ids.has(ref)) err(path, `${attr}="${ref}" — brak elementu`);
    }
  }
  for (const b of doc.querySelectorAll('button')) {
    if (!norm(b.text) && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby')) err(path, 'przycisk bez nazwy dostępnej');
  }
  for (const a of doc.querySelectorAll('a[href]')) {
    if (!norm(a.text) && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])')) err(path, `link bez tekstu: ${a.getAttribute('href')}`);
  }
  if (!doc.querySelector('a.skip-link[href="#tresc"]') || !page.ids.has('tresc')) err(path, 'brak skip-linku do #tresc');
  for (const tag of ['header', 'main', 'footer']) if (!doc.querySelector(tag)) err(path, `brak <${tag}>`);

  // ── znaczniki do uzupełnienia ──
  const bodyText = doc.querySelector('main')?.text ?? '';
  if (/\[(do potwierdzenia|do uzupełnienia)/.test(bodyText) && !page.noindex) {
    todoPages.push(path);
    if (!DEMO) err(path, 'znacznik [do potwierdzenia]/[do uzupełnienia] na stronie indeksowanej (DEMO = false)');
  }
}

for (const [t, ps] of titles) if (ps.length > 1) err(ps.join(', '), `ten sam <title> „${t}”`);
for (const [d, ps] of descriptions) if (ps.length > 1) err(ps.join(', '), `ten sam description „${d.slice(0, 60)}…”`);
for (const [c, ps] of canonicals) if (ps.length > 1) err(ps.join(', '), `ten sam canonical ${c}`);

// ── sitemap ──
const sitemapFiles = allFiles.filter(f => /sitemap-\d+\.xml$/.test(f));
const inSitemap = new Map();
if (!existsSync(join(DIST, 'sitemap-index.xml'))) err('sitemap', 'brak sitemap-index.xml');
for (const f of sitemapFiles) {
  const xml = readFileSync(f, 'utf8');
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1];
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1];
    if (loc) inSitemap.set(loc, lastmod);
  }
}
for (const [loc, lastmod] of inSitemap) {
  const p = loc.replace(SITE, '');
  const page = pages.get(p);
  if (!page) err('sitemap', `adres bez strony w dist/: ${loc}`);
  else if (page.noindex) err('sitemap', `strona noindex w mapie: ${loc}`);
  if (!lastmod) err('sitemap', `brak lastmod: ${loc}`);
}
for (const [p, page] of pages) {
  if (!page.noindex && !inSitemap.has(SITE + p)) err('sitemap', `strona indeksowana poza mapą: ${p}`);
}

// ── robots.txt, llms.txt ──
const robotsTxt = existsSync(join(DIST, 'robots.txt')) ? readFileSync(join(DIST, 'robots.txt'), 'utf8') : '';
if (!robotsTxt) err('robots.txt', 'brak pliku');
else {
  if (!robotsTxt.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) err('robots.txt', 'brak linku do sitemap-index.xml');
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended']) {
    const block = new RegExp(`User-agent:\\s*${bot}\\s*\\n(?:User-agent:.*\\n)*Disallow:\\s*/\\s*$`, 'm');
    if (block.test(robotsTxt)) err('robots.txt', `${bot} zablokowany`);
  }
}
for (const f of ['llms.txt', 'llms-full.txt']) {
  const p = join(DIST, f);
  if (!existsSync(p)) { err(f, 'brak pliku'); continue; }
  const txt = readFileSync(p, 'utf8');
  if (!/^# Liveo Meble/.test(txt)) err(f, 'nie zaczyna się od „# Liveo Meble”');
  if (/strefa-partnera/.test(txt)) err(f, 'zawiera strefę partnera');
  for (const m of txt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    const u = new URL(m[1]);
    if (u.origin === SITE && !resolveTarget(u.pathname)) err(f, `martwy link ${m[1]}`);
  }
}

// ── raport ──
const indexable = [...pages.values()].filter(p => !p.noindex).length;
console.log(`\nKontrola dist/ — ${pages.size} stron HTML (${indexable} indeksowanych, ${pages.size - indexable - redirects} noindex, ${redirects} przekierowań ze starych adresów), ${allFiles.length} plików`);
console.log(`  JSON-LD: ${jsonLdBlocks} bloków · FAQ porównane na ${faqPagesChecked} stronach · okruszki na ${breadcrumbsChecked} · linki/zasoby wewnętrzne: ${linksChecked}`);
console.log(`  sitemap: ${inSitemap.size} adresów · DEMO: ${DEMO ? 'tak' : 'nie'} · strony indeksowane ze znacznikiem [do potwierdzenia]: ${todoPages.length}`);
const summarize = (list, label, max) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const l of list.slice(0, max)) console.log('  - ' + l);
  if (list.length > max) console.log(`  … i ${list.length - max} więcej`);
};
// Ostrzeżenia tego samego rodzaju zwijamy (np. brak og:image na każdej stronie).
const grouped = new Map();
for (const w of warnings) {
  const key = w.replace(/^[^:]+: /, '');
  grouped.set(key, [...(grouped.get(key) || []), w.split(':')[0]]);
}
summarize([...grouped].map(([k, ps]) => (ps.length > 2 ? `${k} — ${ps.length} stron` : `${ps.join(', ')}: ${k}`)), 'Ostrzeżenia', 30);
summarize(errors, 'BŁĘDY', 80);
if (errors.length) {
  console.log(`\nKontrola nieudana: ${errors.length} błędów.`);
  process.exit(1);
}
console.log('\nKontrola OK — 0 błędów.');
