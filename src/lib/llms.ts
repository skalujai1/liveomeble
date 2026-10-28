// Treść /llms.txt i /llms-full.txt (docs/ia.md 7.3): Markdown dla modeli językowych.
// Bez cen (karty produktu ich nie mają — cenę podaje salon partnerski), bez strefy partnera.
import { DEMO, SITE_URL } from '../config';
import { getArticles } from './articles';
import { collections, finishLabels, pages, productCount, productsByType, rooms, roomsList, site, types } from './site';
import { plainText } from './text';

const abs = (p: string) => `${SITE_URL}${p}`;

export async function llmsTxt(): Promise<string> {
  const articles = await getArticles();
  const L: string[] = [];
  L.push('# Liveo Meble', '');
  L.push('> Liveo Meble sp. z o.o. to polski producent mebli skrzyniowych i systemowych z Raniżowa (Podkarpacie).');
  L.push('> Meble są projektowane w kolekcjach — szafka RTV, komoda, witryna czy szafa z jednej kolekcji mają te same kolory.');
  L.push('> Liveo nie ma własnych salonów i nie sprzedaje mebli na tej stronie: meble kupuje się w salonach partnerskich, które podają cenę i termin dostawy.', '');
  if (DEMO) L.push(`Uwaga: ${site.footer.demoNotice}`, '');
  L.push('## Jak kupić');
  L.push(`- [Gdzie kupić](${abs('/gdzie-kupic/')}): wyszukiwarka salonów partnerskich po kodzie pocztowym.`, '');
  L.push('## Kolekcje');
  for (const c of collections) {
    L.push(`- [${c.name}](${abs(`/kolekcje/${c.slug}/`)}): ${c.tagline} Pomieszczenia: ${roomsList(c.rooms)}. Kolory: ${finishLabels(c)}.`);
  }
  L.push('', '## Rodzaje mebli');
  for (const t of types) L.push(`- [${t.plural}](${abs(`/meble/${t.slug}/`)}): ${productCount(productsByType(t.id).length)}.`);
  L.push('', '## Pomieszczenia');
  for (const r of rooms) L.push(`- [${r.name}](${abs(`/pomieszczenia/${r.slug}/`)}): ${r.description}`);
  L.push('', '## Poradnik');
  for (const a of articles) L.push(`- [${a.data.title}](${abs(`/poradnik/${a.data.slug}/`)}): ${a.data.keyTakeaway}`);
  L.push('', '## Firma');
  L.push(`- [O nas](${abs('/o-nas/')}): kim jest Liveo i dlaczego meble w kolekcjach.`);
  L.push(`- [Kontakt](${abs('/kontakt/')}): dane producenta; zakup i reklamacje załatwia sklep partnerski.`);
  L.push(`- [Dla partnerów](${abs('/dla-partnerow/')}): współpraca dla sklepów meblowych.`);
  L.push(`- [Doradca wnętrz](${abs('/doradca-wnetrz/')}): asystent AI — dobiera komplet z jednej kolekcji do zdjęcia pokoju; zdjęcie zostaje na urządzeniu.`);
  L.push('', '## Optional');
  L.push(`- [Polityka prywatności](${abs('/polityka-prywatnosci/')})`);
  L.push(`- [Regulamin](${abs('/regulamin/')})`);
  L.push(`- [Pełna treść poradników i FAQ](${abs('/llms-full.txt')})`);
  return L.join('\n') + '\n';
}

export async function llmsFullTxt(): Promise<string> {
  const articles = await getArticles();
  const L: string[] = ['# Liveo Meble — poradniki i najczęstsze pytania', ''];
  if (DEMO) L.push(`Uwaga: ${site.footer.demoNotice}`, '');
  const faqPages: [string, string, { q: string; a: string }[]][] = [
    ['Strona główna', '/', pages.home.faq.items],
    ['Kolekcje', '/kolekcje/', pages.kolekcje.faq.items],
    ['Meble', '/meble/', pages.meble.faq.items],
    ['Gdzie kupić', '/gdzie-kupic/', pages.gdzieKupic.faq.items],
    ['Doradca wnętrz', '/doradca-wnetrz/', pages.doradca.faq.items],
    ['Dla partnerów', '/dla-partnerow/', pages.dlaPartnerow.faq.items],
    ['O nas', '/o-nas/', pages.oNas.faq.items],
    ['Kontakt', '/kontakt/', pages.kontakt.faq.items],
  ];
  L.push('## Najczęstsze pytania', '');
  for (const [name, path, items] of faqPages) {
    L.push(`### ${name} (${abs(path)})`, '');
    for (const it of items) L.push(`**${plainText(it.q)}**`, plainText(it.a), '');
  }
  L.push('## Poradniki', '');
  for (const a of articles) {
    L.push(`### ${a.data.title}`, `Źródło: ${abs(`/poradnik/${a.data.slug}/`)}`, '', a.body?.trim() ?? '', '');
  }
  return L.join('\n') + '\n';
}
