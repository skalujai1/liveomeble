// /data/szukaj.json — lekki indeks mebli dla wyszukiwarki w nagłówku (nazwa, adres, miniatura, słowa do szukania:
// symbole, kolory, kolekcja i rodzaj). Pobierany dopiero przy pierwszym otwarciu wyszukiwarki.
import type { APIRoute } from 'astro';
import { packshotFor, srcOf } from '../../lib/images';
import { collectionOf, productsSorted, typeOf, url } from '../../lib/site';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      productsSorted.map(p => {
        const img = packshotFor(p, p.variants[0]);
        const col = collectionOf(p);
        const type = typeOf(p);
        return {
          n: p.name,
          u: url.product(p.slug),
          i: img?.pub ? srcOf(img.pub, 480) : '',
          d: p.variants[0].colorLabel, // kolor na miniaturze: przy „biała komoda” najpierw komody białe na zdjęciu
          m: `Kolekcja ${col.name} · ${p.variants.length > 1 ? `${p.variants.length} kolory` : p.variants[0].colorLabel}`,
          k: [p.sku, ...p.variants.map(v => `${v.sku} ${v.colorLabel}`), col.name, type?.plural, type?.name].filter(Boolean).join(' '),
        };
      }),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
