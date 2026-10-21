// Slugi i kotwice bez polskich znaków — wspólne dla buildu (Astro, Markdown) i narzędzi.
// „Jak zmierzyć wysokość wnęki?” → "jak-zmierzyc-wysokosc-wneki"
// „Doradca wnętrz (czat AI)”     → "doradca-wnetrz" (dopiski w nawiasach pomijamy — krótsze, stabilne kotwice)

const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

export function asciiSlug(text) {
  return String(text ?? '')
    .toLocaleLowerCase('pl')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[ąćęłńóśźż]/g, ch => PL[ch])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' i ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Licznik slugów w obrębie jednego dokumentu: powtórzenia dostają sufiks -2, -3… */
export function createSlugger() {
  const seen = new Map();
  return text => {
    const base = asciiSlug(text) || 'sekcja';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };
}
