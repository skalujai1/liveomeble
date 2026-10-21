// Wtyczki HAST dla procesora Markdown Sätteri (domyślny w Astro 7).
// Działają przed wbudowaną wtyczką Astro „heading-ids”, która szanuje nadane tu `id`.

import { createSlugger } from './slug.js';

/** Kotwice nagłówków h2–h4 bez polskich znaków (zgodnie z docs/ia.md, rozdz. 6.2). */
export function headingIdsAscii() {
  return () => {
    const slug = createSlugger();
    return {
      name: 'liveo-heading-ids-ascii',
      element: {
        filter: ['h2', 'h3', 'h4'],
        visit(node, ctx) {
          if (typeof node.properties?.id === 'string') return;
          ctx.setProperty(node, 'id', slug(ctx.textContent(node)));
        },
      },
    };
  };
}

/** Akapit „**Najważniejsze w jednym zdaniu:** …” dostaje klasę, żeby dało się go wyróżnić. */
export function keyTakeawayClass() {
  return {
    name: 'liveo-key-takeaway',
    element: {
      filter: ['p'],
      visit(node, ctx) {
        const first = node.children?.find(c => c.type === 'element' || (c.type === 'text' && c.value.trim()));
        if (!first || first.type !== 'element' || first.tagName !== 'strong') return;
        if (!/^Najważniejsze w jednym zdaniu:?$/.test(ctx.textContent(first).trim())) return;
        ctx.setProperty(node, 'className', ['key-takeaway']);
      },
    },
  };
}

/** Tabele w przewijanym kontenerze — szerokie tabele nie rozpychają strony na telefonie. */
export function scrollableTables() {
  return {
    name: 'liveo-scrollable-tables',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        const parent = ctx.parent(node);
        if (parent?.type === 'element' && parent.properties?.className?.includes?.('table-scroll')) return;
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Tabela — przewiń w poziomie' },
          children: [],
        });
      },
    },
  };
}
