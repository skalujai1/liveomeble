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
  // Kategorie i kolekcje ze starej strony liveomeble.pl (lista z jej menu, 28.10.2026) → odpowiedniki na nowej.
  '/11-rodzaj-mebla': '/meble/',
  '/133-regaly': '/meble/regaly/',
  '/134-witryny': '/meble/witryny/',
  '/135-komody': '/meble/komody/',
  '/136-szafy': '/meble/szafy/',
  '/137-rtv': '/meble/szafki-rtv/',
  '/138-lozka': '/meble/lozka/',
  '/139-szafki-nocne': '/meble/szafki-nocne/',
  '/140-biurka': '/meble/biurka/',
  '/143-kuchnie': '/meble/zestawy-kuchenne/',
  '/143-zestawy-kuchenne': '/meble/zestawy-kuchenne/',
  '/235-kredensy': '/meble/kredensy/',
  '/236-lawy-i-stoly': '/meble/stoly/',
  '/268-remi': '/kolekcje/remi/',
  '/3-pomieszczenia': '/pomieszczenia/',
  '/314-s-line': '/kolekcje/s-line/',
  '/352-ate': '/kolekcje/ate/',
  '/357-promocje': '/meble/',
  '/440-montana-': '/kolekcje/montana/',
  '/443-kris': '/kolekcje/kris/',
  '/447-vero': '/kolekcje/vero/',
  '/455-aston': '/kolekcje/aston/',
  '/469-mati': '/kolekcje/mati/',
  '/475-intenso': '/kolekcje/intenso/',
  '/479-polki-wiszace-': '/meble/polki/',
  '/485-ferro': '/kolekcje/ferro/',
  '/491-milton': '/kolekcje/milton/',
  '/501-vigo': '/kolekcje/vigo/',
  '/503-dante-': '/kolekcje/dante/',
  '/509-luxor': '/kolekcje/luxor/',
  '/51-kolekcje': '/kolekcje/',
  '/52-aris': '/kolekcje/aris/',
  '/55-besto': '/kolekcje/besto/',
  '/57-brando': '/kolekcje/brando/',
  '/6-kuchnia': '/pomieszczenia/kuchnia/',
  '/60-dorian': '/kolekcje/dorian/',
  '/61-forrest': '/kolekcje/forrest/',
  '/62-g-te': '/kolekcje/g-te/',
  '/64-irma': '/kolekcje/irma/',
  '/65-ivo': '/kolekcje/ivo/',
  '/66-kubo': '/kolekcje/kubo/',
  '/67-lionel': '/kolekcje/lionel/',
  '/69-marco': '/kolekcje/marco/',
  '/70-naomi': '/kolekcje/naomi/',
  '/72-noel': '/kolekcje/noel/',
  '/73-prisco': '/kolekcje/prisco/',
  '/74-sandy': '/kolekcje/sandy/',
  '/75-snobi-': '/kolekcje/snobi/',
  '/78-york': '/kolekcje/york/',
  '/promocje/': '/meble/',
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
