#!/usr/bin/env node
// Kontrola w przeglądarce na zbudowanym dist/: dostępność (axe-core, WCAG 2.2 AA) na wszystkich szablonach
// stron przy 1280 i 360 px, poziomy scroll, błędy JS oraz obsługa klawiaturą nagłówka (mega-menu, menu mobilne)
// i szybkiego „Znajdź salon”.
//
//   npm run build && npm run check:browser
//   CHROME_PATH=/ścieżka/do/chrome npm run check:browser
//
// Kończy się kodem 1, jeśli axe zgłosi naruszenie albo test interakcji nie przejdzie.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const AXE = await readFile(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PAGES = [
  '/', '/kolekcje/', '/kolekcje/olmo/', '/meble/', '/meble/komody/', '/pomieszczenia/', '/pomieszczenia/salon/',
  '/produkt/szafka-rtv-160-olmo/', '/promocje/', '/gdzie-kupic/', '/dla-partnerow/', '/strefa-partnera/',
  '/doradca-wnetrz/', '/o-nas/', '/kontakt/', '/poradnik/', '/poradnik/jak-dobrac-szafke-rtv/',
  '/polityka-prywatnosci/', '/404.html',
];
const WIDTHS = [1280, 360];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

// Serwer statyczny dist/ (katalogi → index.html, jak na hostingu).
const server = createServer(async (req, res) => {
  try {
    let p = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if ((await stat(p).catch(() => null))?.isDirectory()) p = join(p, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(DIST, '404.html')).catch(() => 'Nie znaleziono'));
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: CHROME });
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);
let axeRuns = 0;

async function open(path, width) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 780 : 900 }, isMobile: mobile, hasTouch: mobile, locale: 'pl-PL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { ctx, page, errors };
}

// 1. axe-core + poziomy scroll + błędy JS na każdym szablonie i szerokości
for (const path of PAGES) {
  for (const width of WIDTHS) {
    const where = `${path} @${width}`;
    const { ctx, page, errors } = await open(path, width);
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
      return r.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
    });
    axeRuns++;
    result.forEach(v => fail(where, `axe ${v}`));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) fail(where, `poziomy scroll ${overflow}px`);
    errors.forEach(e => fail(where, `błąd JS: ${e}`));
    await ctx.close();
  }
}

// 2. Mega-menu z klawiatury (desktop): Enter otwiera, Esc zamyka i oddaje fokus na przycisk.
{
  const { ctx, page } = await open('/', 1280);
  const btn = page.locator('[data-mega-toggle][aria-controls="mega-meble"]');
  await btn.focus();
  await page.keyboard.press('Enter');
  if ((await btn.getAttribute('aria-expanded')) !== 'true') fail('mega-menu', 'Enter nie otwiera „Meble”');
  if (!(await page.locator('#mega-meble').isVisible())) fail('mega-menu', 'panel „Meble” niewidoczny po otwarciu');
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => !!document.activeElement?.closest('#mega-meble'));
  if (!inside) fail('mega-menu', 'Tab po otwarciu nie przechodzi do linków panelu');
  await page.keyboard.press('Escape');
  if ((await btn.getAttribute('aria-expanded')) !== 'false') fail('mega-menu', 'Esc nie zamyka panelu');
  if (!(await btn.evaluate(b => b === document.activeElement))) fail('mega-menu', 'Esc nie oddaje fokusu na przycisk');
  const kol = page.locator('[data-mega-toggle][aria-controls="mega-kolekcje"]');
  await kol.click();
  await btn.click();
  if ((await kol.getAttribute('aria-expanded')) !== 'false') fail('mega-menu', 'otwarcie „Meble” nie zamyka „Kolekcje”');
  await ctx.close();
}

// 3. Menu mobilne: przycisk z aria-expanded, Esc zamyka i oddaje fokus.
{
  const { ctx, page } = await open('/', 360);
  const t = page.locator('[data-menu-toggle]');
  if (!(await t.isVisible())) fail('menu mobilne', 'brak przycisku Menu');
  await t.click();
  if ((await t.getAttribute('aria-expanded')) !== 'true') fail('menu mobilne', 'nie otwiera się');
  if (!(await page.locator('#menu-glowne').isVisible())) fail('menu mobilne', 'panel niewidoczny');
  await page.keyboard.press('Escape');
  if ((await t.getAttribute('aria-expanded')) !== 'false') fail('menu mobilne', 'Esc nie zamyka');
  if (!(await t.evaluate(b => b === document.activeElement))) fail('menu mobilne', 'Esc nie oddaje fokusu');
  await ctx.close();
}

// 4. „Znajdź salon” z nagłówka → /gdzie-kupic/?kod=… pokazuje najbliższe salony.
{
  const { ctx, page } = await open('/', 1280);
  await page.fill('#naglowek-kod', '35-060');
  await Promise.all([page.waitForURL(/\/gdzie-kupic\/\?kod=35-060/), page.press('#naglowek-kod', 'Enter')]);
  await page.waitForTimeout(1500);
  const n = await page.locator('[data-sf-list] > li').count();
  if (!n) fail('znajdź salon', 'brak wyników po wpisaniu kodu w nagłówku');
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\nKontrola w przeglądarce — ${failures.length} problemów:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Kontrola w przeglądarce OK — axe-core (WCAG 2.2 AA + dobre praktyki): ${axeRuns} uruchomień na ${PAGES.length} szablonach × ${WIDTHS.join(' i ')} px, 0 naruszeń; mega-menu, menu mobilne i „Znajdź salon” działają z klawiatury.`);
