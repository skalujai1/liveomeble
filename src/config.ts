// Konfiguracja strony Liveo Meble.
// Plik jest importowany zarówno przy budowie (Astro), jak i przez skrypty w przeglądarce —
// trzymamy tu tylko stałe (bez process.env, bez sekretów).

/** Adres produkcyjny (canonical, sitemap, JSON-LD). Taki sam jak `site` w astro.config.mjs. */
export const SITE_URL = 'https://liveomeble.pl';

/**
 * Wersja demonstracyjna: pasek „Wersja robocza — produkty przykładowe”, notka w stopce,
 * oznaczenia DEMO. Przy `false` kontrola po buildzie przerywa, jeśli na stronach
 * indeksowanych zostały znaczniki [do potwierdzenia] / [do uzupełnienia].
 */
export const DEMO = true;

/**
 * API świeżych cen i stanów (Cloudflare Worker, patrz docs/navireo-integracja.md, rozdz. 6.1),
 * np. 'https://liveomeble.pl/api/prices'. Pusty = przeglądarka przelicza promocje
 * z osadzonego JSON-a względem bieżącej daty (promocja włącza się i wyłącza sama).
 */
export const PRICES_API = '';

/** Limit czasu zapytania o ceny (ms). Po nim zostają ceny z HTML. */
export const PRICES_TIMEOUT_MS = 2000;

/** Dane o stanach starsze niż tyle godzin → „Dostępność sprawdź w sklepie”. */
export const STOCK_STALE_HOURS = 24;

/**
 * Podpowiedź regionu z IP (GET /api/region → { country, region }). Tylko tekst, nigdy
 * automatyczne wypełnienie kodu. Pusty = brak podpowiedzi.
 */
export const REGION_API = '';

/**
 * Odbiornik formularzy, np. 'https://liveomeble.pl/api/forms' → POST {FORM_ENDPOINT}/contact
 * i {FORM_ENDPOINT}/partner (JSON). Pusty = formularze walidują dane i pokazują
 * komunikat, ale niczego nie wysyłają.
 */
export const FORM_ENDPOINT = '';

/**
 * Czat doradcy wnętrz — adres Cloudflare Workera z „/chat” na końcu
 * (liveo-assistant/README.md, „Uruchomienie Workera”). Pusty = tryb lokalny widżetu.
 */
export const CHAT_URL = '';

/** Konfiguracja widżetu doradcy (trafia do window.LiveoAssistantConfig). */
export const ASSISTANT = {
  scriptUrl: '/liveo-assistant/widget/liveo-assistant.js',
  /** Arkusz fontów widżetu — lokalny, żeby widżet nie pobierał Google Fonts. */
  fontsCssUrl: '/liveo-assistant/fonts.css',
  logoUrl: '/brand/liveo-logo.svg',
  /** Podstrona pełnego doradcy — czat przenosi tam zdjęcie i wynik (przycisk „Otwórz pełnego doradcę”). */
  advisorUrl: '/doradca-wnetrz/',
  contactUrl: '/kontakt/',
  storesUrl: '/gdzie-kupic/',
  demoSamples: false,
  /** Załaduj widżet sam, gdy przeglądarka jest bezczynna (ms po zdarzeniu load). 0 = tylko po kliknięciu. */
  idleLoadDelayMs: 4000,
} as const;

/** Strefa partnera — wartości przykładowe dla wersji DEMO (prawdziwe ceny przyjdą z Navireo). */
export const PARTNER_DEMO = {
  discountPercent: 35,
  vatRate: 23,
  company: { name: 'Meble Przykładowe s.c. (DEMO)', nip: '0000000000', manager: 'Opiekun handlowy (DEMO)' },
} as const;

/**
 * Skrypty wymagające zgody (analityka, marketing). Każdy trafia na stronę jako
 * <script type="text/plain" data-consent="..."> i uruchamia się dopiero po zgodzie.
 * Pusta lista = brak banera cookies (strona używa tylko pamięci niezbędnej).
 */
export const CONSENT_SCRIPTS: ReadonlyArray<{ category: 'analytics' | 'marketing'; src: string }> = [];
