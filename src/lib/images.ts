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

type ManifestItem = { file: string; type?: string; title?: string; description?: string; room?: string; frame?: string; collection?: string };
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
  // Pomieszczenie bez własnej aranżacji (np. pokój młodzieżowy) → aranżacja kolekcji, której to główne pomieszczenie.
  const col = [...manifest.values()].find(i => i.collection && i.room === roomSlug && i.frame === frame && FILES[`/src/assets/renders/${i.file}`]);
  return col ? get(col.file) : null;
}

/**
 * Aranżacja kolekcji: własna (collections/<slug>) albo aranżacja jej pomieszczenia `heroRoom` (poglądowo).
 * Kadry: wide 16:9, tall 4:5, cinema 2:1 (hero na pełną szerokość), angle 3:2 (pod kątem), detail 4:5 (zbliżenie).
 */
export type Frame = 'wide' | 'tall' | 'cinema' | 'angle' | 'detail';
export function collectionImage(c: Collection, frame: Frame = 'wide'): ImageRef | null {
  const own = get(`collections/${c.slug}-${frame}.jpg`) ?? get(`collections/${c.slug}-${frame}.webp`);
  if (own) return own;
  if (frame !== 'wide' && frame !== 'tall') return collectionImage(c, frame === 'detail' ? 'tall' : 'wide');
  const room = roomImage(c.heroRoom, frame, c.order - 1);
  return room ? { ...room, approximate: true } : null;
}

/** Wszystkie dostępne pliki (do raportu w kontroli buildu). */
export const availableRenders = files;

/** Packshot reprezentujący rodzaj mebla (mega-menu, kafle kategorii): własny render pierwszego mebla albo próbka. */
export function typeImage(typeId: string, list: { type: string; variants: Variant[] }[]): ImageRef | null {
  const p = list.find(x => x.type === typeId);
  if (p) {
    const hit = packshotFor(p as Product, p.variants[0]);
    if (hit) return hit;
  }
  const prefix = SAMPLE_PREFIX[typeId];
  const f = prefix && files.find(x => x.startsWith(`sample/${prefix}-`));
  return f ? { ...get(f)!, approximate: true } : null;
}
