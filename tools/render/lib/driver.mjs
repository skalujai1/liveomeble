// Wspólny „sterownik” renderów: lokalny serwer statyczny + headless Chromium (Playwright)
// + zapis wyników przez sharp. Używany przez render.mjs (packshoty) i rooms.mjs (aranżacje).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(ROOT, '..', '..');
export const PORT = Number(process.env.RENDER_PORT || 8801);
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

function startServer(port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export async function openRenderer({ log = true } = {}) {
  const server = await startServer(PORT);
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: [
      // RENDER_GPU=1: karta graficzna przez ANGLE (Windows d3d11) — wielokrotnie szybciej niż SwiftShader na CPU.
      ...(process.env.RENDER_GPU ? ['--use-angle=' + (process.platform === 'win32' ? 'd3d11' : 'default'), '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      '--ignore-gpu-blocklist',
      '--disable-gpu-watchdog', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--js-flags=--max-old-space-size=8192',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(0);
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') console.error(`[page ${t}]`, m.text());
    else if (log && t === 'log' && m.text().startsWith('[render]')) console.log(m.text());
  });
  await page.goto(`http://127.0.0.1:${PORT}/web/index.html`);
  await page.waitForFunction(() => window.LIVEO && window.LIVEO.ready === true, null, { timeout: 120000 });
  return {
    page,
    /** job: { kind:'packshot'|'room', ... } → { png: Buffer, ms } */
    async render(job) {
      const t0 = Date.now();
      const res = await page.evaluate(async (j) => window.LIVEO.render(j), job);
      if (!res || !res.dataURL) throw new Error('Render nie zwrócił obrazu: ' + JSON.stringify(res && res.error));
      const png = Buffer.from(res.dataURL.split(',')[1], 'base64');
      return { png, ms: Date.now() - t0, info: res.info };
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

export async function saveWebp(png, out, quality = 88) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(png).webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(out);
}

export async function saveJpeg(png, out, quality = 88) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(png).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(out);
}

export function fmtMs(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}
