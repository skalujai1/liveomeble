// Poradniki i strony prawne z kolekcji treści (src/content.config.ts).
import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'poradnik'>;

/** Poradniki: od najnowszego (date), potem alfabetycznie. */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('poradnik');
  for (const a of all) {
    if (a.data.slug !== a.id) throw new Error(`Poradnik ${a.id}: slug "${a.data.slug}" musi być równy nazwie pliku`);
  }
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date) || a.data.title.localeCompare(b.data.title, 'pl'));
}

export const articleCard = (a: Article) => ({ slug: a.data.slug, title: a.data.title, description: a.data.description, readingTime: a.data.readingTime });
