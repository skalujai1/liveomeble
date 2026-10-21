// Kolekcje treści: poradnik i strony prawne (Markdown z frontmatter, opis w docs/ia.md, rozdz. 6.2–6.3).
// Teksty stron (src/content/pages/*.json) importujemy bezpośrednio w src/lib/site.ts.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const faq = z.array(z.object({ q: z.string(), a: z.string() })).default([]);

const poradnik = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/poradnik' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().max(60),
    slug: z.string(),
    description: z.string().max(155),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    author: z.string().default('Redakcja Liveo'),
    authorNote: z.string().optional(),
    readingTime: z.number().int().positive(),
    keyTakeaway: z.string(),
    related: z.array(z.string()).default([]),
    links: z.object({ category: z.string().optional(), room: z.string().optional() }).default({}),
    faq,
    factCheck: z.array(z.any()).optional(),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().max(60),
    slug: z.string(),
    description: z.string().max(155),
    status: z.string(),
    legalReview: z.string().optional(),
    version: z.string(),
    updated: z.string(),
    effectiveFrom: z.string().optional(),
  }),
});

export const collections = { poradnik, legal };
