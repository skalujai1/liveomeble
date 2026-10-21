// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { headingIdsAscii, keyTakeawayClass, scrollableTables } from './src/lib/markdown-plugins.mjs';
import { sitemapLastmod } from './tools/sitemap-lastmod.mjs';

const lastmod = sitemapLastmod();
// Poza mapą strony: strefa partnera (noindex, nofollow) i 404.
const NOT_IN_SITEMAP = /\/(strefa-partnera|404)\/?$/;

// Stare adresy liveomeble.pl → nowe (docs/ia.md, rozdz. 8; lista [niezweryfikowana] — uzupełnić po crawlu starej strony
// i danych z Google Search Console). Na hostingu statycznym Astro tworzy stronę z meta refresh + canonical;
// na Cloudflare/Netlify lepiej dodać prawdziwe 301 w konfiguracji hostingu (te same pary).
const OLD_URLS = {
  '/4-pokoj-dzienny': '/pomieszczenia/salon/',
  '/5-jadalnia': '/pomieszczenia/jadalnia/',
  '/8-sypialnia': '/pomieszczenia/sypialnia/',
  '/7-pokoj-mlodziezowy': '/pomieszczenia/pokoj-mlodziezowy/',
  '/9-przedpokoj': '/pomieszczenia/przedpokoj/',
  '/10-biuro': '/pomieszczenia/biuro/',
  // '/143-zestawy-kuchenne': [do decyzji: kuchnie — /kolekcje/ albo przyszła strona kuchni]
};

export default defineConfig({
  site: 'https://liveomeble.pl',
  redirects: Object.fromEntries(Object.entries(OLD_URLS).map(([from, to]) => [from, { status: 301, destination: to }])),
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Cały CSS jest mały (tokeny + baza) — wstawiony w <head> nie blokuje renderowania osobnym żądaniem.
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  markdown: {
    processor: satteri({
      // Teksty mają polskie cudzysłowy „…” — bez automatycznej typografii (FAQ musi być słowo w słowo jak w JSON-LD).
      features: { smartPunctuation: false },
      hastPlugins: [headingIdsAscii(), keyTakeawayClass(), scrollableTables()],
    }),
  },
  image: {
    // Rendery i zdjęcia lokalne (src/assets) — bez zdalnych domen.
    domains: [],
  },
  integrations: [
    sitemap({
      filter: page => !NOT_IN_SITEMAP.test(new URL(page).pathname),
      serialize(item) {
        item.lastmod = lastmod.get(new URL(item.url).pathname);
        return item;
      },
    }),
  ],
});
