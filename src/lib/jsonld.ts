// Dane strukturalne schema.org (JSON-LD). Zasady: docs/ia.md, rozdz. 7.1 —
// jeden blok @graph na stronę, stabilne @id, tylko dane widoczne na stronie,
// bez ocen, opinii, liczby pracowników i roku założenia.

import { SITE_URL } from '../config';
import { plainText } from './text';
import { site, type FaqItem } from './site';

export type Node = Record<string, unknown>;
export type Crumb = { name: string; url: string };

export const abs = (path: string) => new URL(path, SITE_URL).href;
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

const brand = site.brand;

export function organization(extra: Node = {}): Node {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: brand.name,
    legalName: brand.legalName,
    url: abs('/'),
    address: {
      '@type': 'PostalAddress',
      addressLocality: brand.locality,
      addressRegion: brand.region,
      addressCountry: brand.country,
    },
    // logo, sameAs, contactPoint — po potwierdzeniu przez klienta (docs/do-potwierdzenia.md)
    ...extra,
  };
}

export function website(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: abs('/'),
    name: brand.name,
    inLanguage: 'pl-PL',
    publisher: { '@id': ORG_ID },
  };
}

/** Strona: WebPage / CollectionPage / AboutPage / ContactPage… */
export function webPage(type: string, o: { path: string; title: string; description?: string; hasBreadcrumb?: boolean; extra?: Node }): Node {
  const url = abs(o.path);
  return {
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name: o.title,
    ...(o.description ? { description: o.description } : {}),
    inLanguage: 'pl-PL',
    isPartOf: { '@id': WEBSITE_ID },
    ...(o.hasBreadcrumb ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    ...(o.extra || {}),
  };
}

export function breadcrumbList(path: string, crumbs: Crumb[]): Node {
  const url = abs(path);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plainText(c.name),
      item: abs(c.url),
    })),
  };
}

/** FAQPage — tekst pytań i odpowiedzi z tego samego źródła co HTML (Faq.astro). */
export function faqPage(path: string, items: FaqItem[]): Node {
  const url = abs(path);
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    mainEntity: items.map(it => ({
      '@type': 'Question',
      name: plainText(it.q),
      acceptedAnswer: { '@type': 'Answer', text: plainText(it.a) },
    })),
  };
}

export function itemList(path: string, items: { url: string; name: string }[], name?: string): Node {
  const url = abs(path);
  return {
    '@type': 'ItemList',
    '@id': `${url}#itemlist`,
    ...(name ? { name } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(it.url), name: it.name })),
  };
}

export function article(o: {
  path: string; headline: string; description: string; datePublished: string; dateModified?: string; image?: string;
}): Node {
  const url = abs(o.path);
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    headline: o.headline,
    description: o.description,
    datePublished: o.datePublished,
    dateModified: o.dateModified || o.datePublished,
    inLanguage: 'pl-PL',
    // Autor = organizacja, dopóki podpis autora nie jest potwierdzony (docs/ia.md, 3.15).
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    ...(o.image ? { image: abs(o.image) } : {}),
  };
}

const cm = (value: number) => ({ '@type': 'QuantitativeValue', value, unitCode: 'CMT' });
const kg = (value: number) => ({ '@type': 'QuantitativeValue', value, unitCode: 'KGM' });

export type OfferInput = {
  price: number; regular: number | null; validUntil: string | null; stock: string; url: string;
};

export function offer(o: OfferInput): Node {
  return {
    '@type': 'Offer',
    url: abs(o.url),
    price: o.price.toFixed(2),
    priceCurrency: 'PLN',
    // Liveo nie sprzedaje online — meble kupuje się w sklepach partnerskich [do decyzji, docs/ia.md 3.7].
    availability: o.stock === 'wyprzedany' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStoreOnly',
    itemCondition: 'https://schema.org/NewCondition',
    ...(o.validUntil ? { priceValidUntil: o.validUntil } : {}),
    ...(o.regular
      ? {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            priceType: 'https://schema.org/StrikethroughPrice',
            price: o.regular.toFixed(2),
            priceCurrency: 'PLN',
          },
        }
      : {}),
  };
}

export function aggregateOffer(offers: OfferInput[]): Node {
  const prices = offers.map(o => o.price);
  return {
    '@type': 'AggregateOffer',
    priceCurrency: 'PLN',
    lowPrice: Math.min(...prices).toFixed(2),
    highPrice: Math.max(...prices).toFixed(2),
    offerCount: offers.length,
  };
}

export type VariantLd = {
  code: string; sku: string; color: string; url: string; image?: string; offer: OfferInput;
};

/**
 * Mebel: jeden kolor → Product z Offer; kilka kolorów → ProductGroup (variesBy: color)
 * z wariantami Product + Offer i podsumowaniem AggregateOffer.
 */
export function productLd(o: {
  path: string; name: string; description: string; sku: string; category: string;
  dims: { w: number; h: number; d: number }; weightKg?: number; variants: VariantLd[];
}): Node {
  const url = abs(o.path);
  const common = {
    brand: { '@type': 'Brand', name: 'Liveo' },
    manufacturer: { '@id': ORG_ID },
    category: o.category,
    width: cm(o.dims.w),
    height: cm(o.dims.h),
    depth: cm(o.dims.d),
    ...(o.weightKg ? { weight: kg(o.weightKg) } : {}),
  };
  const variant = (v: VariantLd, standalone: boolean): Node => ({
    '@type': 'Product',
    '@id': standalone ? `${url}#product` : `${url}#${v.code}`,
    name: standalone ? o.name : `${o.name} — ${v.color}`,
    ...(standalone ? { description: o.description } : {}),
    sku: v.sku,
    color: v.color,
    url: abs(v.url),
    ...(v.image ? { image: abs(v.image) } : {}),
    ...(standalone ? common : { isVariantOf: { '@id': `${url}#product` } }),
    offers: offer(v.offer),
  });
  if (o.variants.length === 1) return variant(o.variants[0], true);
  return {
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: o.name,
    description: o.description,
    url,
    productGroupID: o.sku,
    variesBy: ['https://schema.org/color'],
    ...common,
    offers: aggregateOffer(o.variants.map(v => v.offer)),
    hasVariant: o.variants.map(v => variant(v, false)),
  };
}

export const graph = (nodes: Node[]) => ({ '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) });
