// Obrazy z src/assets/renders (atrapy z tools/render, docelowo zdjęcia klienta).
// Brak pliku nigdy nie przerywa budowy — komponent Media.astro pokaże wtedy placeholder.
//
//   renders/products/<sku>--<kod>.webp   packshot wariantu (variants[].images.packshot)
//   renders/sample/<typ>-<kolor>.webp    próbki packshotów (zastępczo dla tego samego rodzaju mebla)
//   renders/rooms/<nazwa>-wide|tall.jpg  aranżacje
//   renders/collections/<slug>-wide.jpg  aranżacja konkretnej kolekcji (gdy powstanie — ma pierwszeństwo)

import type { ImageMetadata } from 'astro';
import type { Collection, Product, Variant } from './site';

const FILES = import.meta.glob<{ default: ImageMetadata }>('/src/assets/renders/**/*.{webp,jpg,jpeg,png,avif}', { eager: true });
const MANIFESTS = import.meta.glob<{ items?: ManifestItem[] }>('/src/assets/renders/manifest.json', { eager: true, import: 'default' });

type ManifestItem = { file: string; type?: string; title?: string; description?: string; room?: string };
const manifest = new Map<string, ManifestItem>(
  (Object.values(MANIFESTS)[0]?.items ?? []).map(i => [i.file, i]),
);

export type ImageRef = {
  src: ImageMetadata;
  /** Ścieżka względem src/assets/renders — klucz do manifestu. */
  file: string;
  /** Opis z manifestu (po polsku) — podstawa tekstu alternatywnego, gdy obraz jest zastępczy. */
  title?: string;
  /** true = obraz poglądowy (inny mebel tego samego rodzaju), a nie zdjęcie tego wariantu. */
  approximate?: boolean;
};

const get = (file: string): ImageRef | null => {
  const mod = FILES[`/src/assets/renders/${file}`];
  return mod ? { src: mod.default, file, title: manifest.get(file)?.title } : null;
};

const files = Object.keys(FILES).map(k => k.replace('/src/assets/renders/', ''));

/** Prefiks pliku próbki dla rodzaju mebla (tools/render/specs/sample.json). */
const SAMPLE_PREFIX: Record<string, string> = {
  rtv: 'szafka-rtv', komoda: 'komoda', witryna: 'witryna', regal: 'regal', lawa: 'lawa', polka: 'polka',
  stol: 'stol', kredens: 'kredens', lozko: 'lozko', szafka_nocna: 'szafka-nocna', szafa: 'szafa',
  toaletka: 'toaletka', lustro: 'lustro', biurko: 'biurko', szafka_na_buty: 'szafka-na-buty', wieszak: 'wieszak',
};

/** Packshot wariantu; brak → próbka tego samego rodzaju (najlepiej w tym samym kolorze); brak → null. */
export function packshotFor(p: Product, v: Variant): ImageRef | null {
  const own = get(v.images?.packshot?.replace(/^renders\//, '') ?? '');
  if (own) return own;
  const prefix = SAMPLE_PREFIX[p.type];
  if (!prefix) return null;
  const samples = files.filter(f => f.startsWith(`sample/${prefix}-`));
  if (!samples.length) return null;
  const finish = v.finish as Record<string, string | undefined>;
  const best = samples.find(f => f.includes(`-${finish.front}.`)) ?? samples.find(f => f.includes(`-${finish.body}.`)) ?? samples[0];
  const ref = get(best)!;
  return { ...ref, approximate: true };
}

/** Render aranżacji dla pomieszczenia (salon, sypialnia…). */
const ROOM_RENDERS: Record<string, string[]> = {
  salon: ['salon-jasny', 'salon-szalwia'],
  jadalnia: ['jadalnia'],
  sypialnia: ['sypialnia'],
  'pokoj-mlodziezowy': ['pokoj-mlodziezowy'],
  przedpokoj: ['przedpokoj'],
  biuro: ['biuro'],
};

export function roomImage(roomSlug: string, frame: 'wide' | 'tall' = 'wide', index = 0): ImageRef | null {
  const names = ROOM_RENDERS[roomSlug] ?? [roomSlug];
  const ordered = [...names.slice(index % Math.max(1, names.length)), ...names];
  for (const n of ordered) {
    const hit = get(`rooms/${n}-${frame}.jpg`) ?? get(`rooms/${n}-${frame === 'wide' ? 'tall' : 'wide'}.jpg`);
    if (hit) return hit;
  }
  return null;
}

/** Aranżacja kolekcji: własna (collections/<slug>) albo aranżacja jej pomieszczenia `heroRoom` (poglądowo). */
export function collectionImage(c: Collection, frame: 'wide' | 'tall' = 'wide'): ImageRef | null {
  const own = get(`collections/${c.slug}-${frame}.jpg`) ?? get(`collections/${c.slug}-${frame}.webp`);
  if (own) return own;
  const room = roomImage(c.heroRoom, frame, c.order - 1);
  return room ? { ...room, approximate: true } : null;
}

/** Wszystkie dostępne pliki (do raportu w kontroli buildu). */
export const availableRenders = files;
