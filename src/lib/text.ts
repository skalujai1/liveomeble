// Pomocnicze funkcje tekstowe: szablony {placeholder}, liczba mnoga, Markdown w liniach, daty.
// Konwencje treści: docs/ia.md, rozdz. 6.1.

import { warsawDay } from './pricing.js';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

/** "{name} — {color}" + { name: 'OLMO' } → "OLMO — {color}" (nieznane klucze zostają). */
export function fill(template: string | undefined | null, vars: Record<string, unknown> = {}): string {
  return String(template ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

const PR = new Intl.PluralRules('pl');
/** plural({one:'{n} mebel',few:'{n} meble',many:'{n} mebli'}, 5) → "5 mebli" */
export function plural(forms: { one: string; few: string; many: string; other?: string }, n: number): string {
  const cat = PR.select(n) as keyof typeof forms;
  return fill(forms[cat] ?? forms.many, { n });
}

/** Pierwsza litera mała, reszta bez zmian: „Szafka RTV” → „szafka RTV”. */
export const lowerFirst = (s: string) => (s ? s[0].toLocaleLowerCase('pl') + s.slice(1) : s);
export const upperFirst = (s: string) => (s ? s[0].toLocaleUpperCase('pl') + s.slice(1) : s);

/** „a, b i c” */
export function listJoin(items: string[], last = ' i '): string {
  const xs = items.filter(Boolean);
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')}${last}${xs.at(-1)}`;
}

const TODO_RE = /\[(do potwierdzenia|do uzupełnienia|do decyzji|niezweryfikowane)([^\]]*)\]/g;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Markdown w jednej linii → bezpieczny HTML: [tekst](/adres/), **pogrubienie**, <br>.
 * Znaczniki [do potwierdzenia…] dostają <mark class="todo">, żeby były widoczne w wersji demo.
 */
export function inlineMd(src: string | undefined | null): string {
  let s = escapeHtml(src ?? '');
  s = s.replace(/ ?&lt;br\s*\/?&gt;/g, ' <br>');
  // Najpierw linki (ich tekst nie zawiera znaczników TODO), potem TODO, potem pogrubienia.
  s = s.replace(LINK_RE, (_m, text, href) => {
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${ext ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
  });
  s = s.replace(TODO_RE, m => `<mark class="todo">${m}</mark>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}

/** Ten sam tekst co inlineMd, ale jako czysty tekst (JSON-LD, meta, aria-label). */
export function plainText(src: string | undefined | null): string {
  return String(src ?? '')
    .replace(LINK_RE, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s*<br\s*\/?>\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Czy tekst zawiera znacznik do uzupełnienia przez klienta. */
export const hasTodo = (s: string | undefined | null) => /\[(do potwierdzenia|do uzupełnienia|do decyzji)/.test(String(s ?? ''));

/**
 * Zdania tekstu. Granica = . ! ? + spacja + wielka litera (albo cudzysłów), więc skróty
 * typu „ok. 65 cali”, „szer. 160 cm”, „np. biel” nie dzielą zdania.
 */
export function sentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  return t ? t.split(/(?<=[.!?…])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„"(\[])/u) : [];
}

/** Przycina tekst do `max` znaków na granicy zdania; gdy pierwsze zdanie jest za długie — na granicy słowa z „…”. */
export function truncateSentence(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let out = '';
  for (const s of sentences(t)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–—-]$/, '') + '…';
}

/** Pierwsze zdanie tekstu. */
export const firstSentence = (text: string) => sentences(text)[0] ?? '';

const DATE_LONG = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' });
const DATE_TIME = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw',
});

/** "2026-10-30" | Date → „30 października 2026” */
export function dateLong(d: string | Date): string {
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return DATE_LONG.format(date);
}
export const dateTimeLong = (d: string | Date) => DATE_TIME.format(new Date(d));

/**
 * Ostatni dzień promocji (czas polski). endsAt to północ rozpoczynająca pierwszy dzień PO promocji,
 * więc ostatni dzień = dzień chwili tuż przed endsAt.
 */
export function promoLastDay(endsAt: string | null | undefined): string | null {
  if (!endsAt) return null;
  return warsawDay(+new Date(endsAt) - 60_000);
}
