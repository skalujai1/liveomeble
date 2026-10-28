// Obrazy Open Graph 1200×630 (podgląd linku w Facebooku, Messengerze, LinkedIn, Slacku, ChatGPT).
// Generowane przy buildzie z tych samych zdjęć co strona (sharp): aranżacja kolekcji / pomieszczenia
// albo packshot mebla na lnianym tle, w rogu logo Liveo. Bez tekstu w obrazie — tytuł podaje og:title.
//
//   /og/liveo.jpg                     strona główna i domyślny
//   /og/kolekcje/<slug>.jpg           kolekcja
//   /og/pomieszczenia/<slug>.jpg      pomieszczenie
//   /og/produkty/<slug>.jpg           mebel (tylko gdy wariant domyślny ma własne zdjęcie)
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { collectionImage, packshotFor, roomImage, type ImageRef } from '../../lib/images';
import { collections, defaultVariant, products, rooms } from '../../lib/site';

const W = 1200;
const H = 630;
const LINEN = { r: 239, g: 233, b: 225 };
const LOGO = join(process.cwd(), 'public/brand/liveo-logo.svg');

type Props = { kind: 'room' | 'packshot'; file: string };

/** Ścieżka pliku na dysku: zdjęcie katalogu (największa szerokość z public/katalog) albo obraz z src/assets. */
const fileOf = (img: ImageRef) =>
  img.pub ? join(process.cwd(), 'public', `${img.pub.base}-${Math.max(...img.pub.widths)}.webp`) : join(process.cwd(), img.file);

export const getStaticPaths = (() => {
  const paths: { params: { slug: string }; props: Props }[] = [];
  const room = (slug: string, img: ImageRef | null) => img && paths.push({ params: { slug }, props: { kind: 'room', file: fileOf(img) } });
  room('liveo', collectionImage(collections[0], 'wide'));
  for (const c of collections) room(`kolekcje/${c.slug}`, collectionImage(c, 'wide'));
  for (const r of rooms) room(`pomieszczenia/${r.slug}`, roomImage(r.slug, 'wide'));
  for (const p of products) {
    const img = packshotFor(p, defaultVariant(p));
    if (img && !img.approximate) paths.push({ params: { slug: `produkty/${p.slug}` }, props: { kind: 'packshot', file: fileOf(img) } });
  }
  return paths;
}) satisfies GetStaticPaths;

async function logoPlate() {
  // Logo na jasnej płytce w lewym dolnym rogu (czytelne na każdym zdjęciu).
  const logo = await sharp(await readFile(LOGO), { density: 300 }).resize({ height: 52 }).png().toBuffer();
  const { width = 140 } = await sharp(logo).metadata();
  const pw = width + 48;
  const ph = 52 + 36;
  const plate = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="14" fill="#ffffff"/></svg>`);
  return sharp(plate).composite([{ input: logo, left: 24, top: 18 }]).png().toBuffer().then(buf => ({ buf, h: ph }));
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const src = props.file;
  const plate = await logoPlate();
  let base: sharp.Sharp;
  if (props.kind === 'room') {
    base = sharp(src).resize(W, H, { fit: 'cover', position: 'attention' });
  } else {
    const shot = await sharp(src).resize(1000, 540, { fit: 'inside' }).png().toBuffer();
    const meta = await sharp(shot).metadata();
    base = sharp({ create: { width: W, height: H, channels: 3, background: LINEN } })
      .composite([{ input: shot, left: Math.round((W - (meta.width ?? 1000)) / 2), top: Math.round((H - 40 - (meta.height ?? 540)) / 2) }]);
    base = sharp(await base.png().toBuffer());
  }
  const out = await base
    .composite([{ input: plate.buf, left: 40, top: H - plate.h - 36 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/jpeg' } });
};
