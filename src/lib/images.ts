// Zdjęcia katalogu: packshoty wariantów i aranżacje kolekcji z kart produktu Liveo.
// Oryginały są na serwerze Liveo (upload.liveomeble.pl); tools/data/fetch-images.mjs pobiera je przed buildem
// i zapisuje jako WebP w public/katalog/<klucz>-<szerokość>.webp (generate.mjs wpisuje { base, widths, w, h } do danych).
// Brak zdjęcia nigdy nie przerywa budowy — komponent Media.astro pokaże wtedy placeholder.

import type { ImageMetadata } from 'astro';
import { collections, productsSorted, type Collection, type Product, type Variant } from './site';

/** Gotowe pliki WebP w public/: `${base}-${w}.webp` dla każdej szerokości z `widths`; w × h = oryginał. */
export type PublicImage = { base: string; widths: number[]; w: number; h: number };

export type ImageRef = {
  /** Obraz z src/assets (astro:assets) — dziś nieużywany przez katalog, zostaje dla treści redakcyjnych. */
  src?: ImageMetadata;
  /** Zdjęcie katalogu z public/katalog. */
  pub?: PublicImage;
  /** Identyfikator do raportów (adres pliku). */
  file: string;
  /** Opis po polsku — podstawa tekstu alternatywnego. */
  title?: string;
  /** true = obraz poglądowy (np. aranżacja kolekcji zamiast zdjęcia tego mebla). */
  approximate?: boolean;
};

export const srcsetOf = (img: PublicImage) => img.widths.map(w => `${img.base}-${w}.webp ${w}w`).join(', ');
export const srcOf = (img: PublicImage, prefer = 1000) =>
  `${img.base}-${img.widths.reduce((a, w) => (Math.abs(w - prefer) < Math.abs(a - prefer) ? w : a), img.widths[0])}.webp`;
export const widthOf = (img: ImageRef) => img.pub?.w ?? img.src?.width ?? 0;
export const heightOf = (img: ImageRef) => img.pub?.h ?? img.src?.height ?? 0;

const ref = (pub: PublicImage | null | undefined, title: string, approximate = false): ImageRef | null =>
  pub ? { pub, file: `${pub.base}.webp`, title, approximate } : null;

/** Packshot wariantu; brak własnego zdjęcia → aranżacja z karty (poglądowo) albo null. */
export function packshotFor(p: Product, v: Variant): ImageRef | null {
  const img = v.images?.packshot as PublicImage | null;
  return ref(img, `${p.name}, ${v.colorLabel.toLocaleLowerCase('pl')}`, !!v.images?.packshotIsScene);
}

/**
 * Aranżacja kolekcji. Kadry (wide 16:9, tall 4:5, cinema 2:1, angle 3:2, detail 4:5) to ta sama fotografia
 * przycięta przez CSS (object-fit: cover); kolejne kadry sięgają po kolejne aranżacje z karty.
 */
export type Frame = 'wide' | 'tall' | 'cinema' | 'angle' | 'detail';
const FRAME_INDEX: Record<Frame, number> = { cinema: 0, wide: 0, angle: 1, tall: 2, detail: 3 };
export function collectionImage(c: Collection, frame: Frame = 'wide', offset = 0): ImageRef | null {
  const list = c.arrangements as (PublicImage & { room: string })[];
  if (!list.length) return null;
  const a = list[(FRAME_INDEX[frame] + offset) % list.length];
  return ref(a, `Kolekcja ${c.name} w aranżacji`);
}

/** Aranżacja z kart po nazwie pliku (np. „d1c8d91c6a-aris_02_2160px”) — zdjęcia nagłówków poradnika. */
export function arrangementByName(name: string, title = ''): ImageRef | null {
  for (const c of collections) {
    const a = (c.arrangements as (PublicImage & { room: string })[]).find(x => x.base.split('/').pop() === name);
    if (a) return ref(a, title || `Kolekcja ${c.name} w aranżacji`);
  }
  return null;
}

/** Wszystkie aranżacje kolekcji (galeria na stronie kolekcji). */
export function collectionImages(c: Collection): ImageRef[] {
  return (c.arrangements as (PublicImage & { room: string })[]).map(a => ref(a, `Kolekcja ${c.name} w aranżacji`)!);
}

/** Aranżacja pomieszczenia: zdjęcie z kart, na którym jest to pomieszczenie (kolejne `index` — inne kolekcje). */
export function roomImage(roomSlug: string, _frame: 'wide' | 'tall' = 'wide', index = 0): ImageRef | null {
  const hits = collections.flatMap(c => (c.arrangements as (PublicImage & { room: string })[])
    .filter(a => a.room === roomSlug).slice(0, 1).map(a => ({ a, c })));
  if (hits.length) {
    const { a, c } = hits[index % hits.length];
    return ref(a, `Kolekcja ${c.name} ${roomLocative(roomSlug)}`);
  }
  // pomieszczenie bez otagowanej aranżacji: najpierw zdjęcie wskazane ręcznie (żeby dwa pokoje nie dostały
  // tego samego kadru co salon), dopiero potem aranżacja kolekcji z meblami do tego pomieszczenia (poglądowo)
  const pick = ROOM_PICKS[roomSlug];
  const picked = pick && arrangementByName(pick.name, pick.title);
  if (picked) return { ...picked, approximate: pick.approximate };
  const withRoom = collections.filter(x => x.rooms.includes(roomSlug) && x.arrangements.length);
  const c = withRoom[index % Math.max(1, withRoom.length)];
  return c ? { ...collectionImage(c, 'wide')!, approximate: true } : null;
}
/** Aranżacje z kart Liveo dla pomieszczeń, których generator nie rozpoznaje na zdjęciach (nazwa pliku bez szerokości). */
const ROOM_PICKS: Record<string, { name: string; title: string; approximate: boolean }> = {
  // pokój z biurkiem i toaletką z kolekcji REMI — to jest pokój młodzieżowy
  'pokoj-mlodziezowy': { name: 'ba8c0c0ff7-remi_03_bialy-evoke_2160px', title: 'Kolekcja REMI w pokoju młodzieżowym', approximate: false },
  // kącik do pracy z kolekcji KUBO; meble „do biura” są też z innych kolekcji, więc zdjęcie zostaje poglądowe
  biuro: { name: '6fb6de67ee-kubo_01_2160px', title: 'Biurko z kolekcji KUBO', approximate: true },
};
const LOC: Record<string, string> = {
  salon: 'w salonie', jadalnia: 'w jadalni', sypialnia: 'w sypialni', 'pokoj-mlodziezowy': 'w pokoju młodzieżowym',
  przedpokoj: 'w przedpokoju', biuro: 'w domowym biurze', kuchnia: 'w kuchni',
};
const roomLocative = (slug: string) => LOC[slug] ?? '';

/** Packshot reprezentujący rodzaj mebla (mega-menu, kafle kategorii): pierwszy mebel tego rodzaju z własnym zdjęciem. */
export function typeImage(typeId: string, list: Product[] = productsSorted): ImageRef | null {
  const p = list.find(x => x.type === typeId && x.variants[0].images?.packshot && !x.variants[0].images.packshotIsScene)
    ?? list.find(x => x.type === typeId);
  return p ? packshotFor(p, p.variants[0]) : null;
}

/** Lista plików (do raportu w kontroli buildu). */
export const availableRenders: string[] = [];
