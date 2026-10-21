# Liveo Meble — strona www

Statyczna strona w [Astro](https://astro.build) (Node ≥ 22.22). Szkielet techniczny z neutralnym, tymczasowym wyglądem:
trasy, dane, ceny z promocjami (Omnibus), wyszukiwarka sklepów, SEO/JSON-LD, dostępność. Dane są demonstracyjne.

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm install` | instalacja zależności |
| `npm run dev` | serwer deweloperski (http://localhost:4321) |
| `npm run build` | dane (`tools/data/generate.mjs`) → katalog doradcy → kopia widżetu do `public/liveo-assistant/` → `astro build` → kontrola `dist/` (`tools/check/run-all.mjs`; błąd przerywa build) |
| `npm run preview` | podgląd `dist/` na porcie 8803 |
| `npm test` | testy danych, cen i lokalizatora (`node --test tools/data/`) |
| `npm run check:dist` | sama kontrola zbudowanego `dist/` |

## Gdzie co jest

- `src/config.ts` — przełączniki: `DEMO` (pasek „Wersja robocza”, oznaczenia DEMO), `PRICES_API` (świeże ceny z Navireo),
  `FORM_ENDPOINT` (odbiornik formularzy), `CHAT_URL` (Worker doradcy), `CONSENT_SCRIPTS` (skrypty wymagające zgody).
  Puste adresy = tryb bez backendu: ceny i promocje liczone w przeglądarce z osadzonych danych, formularze tylko walidują.
- `src/data/*.json` — katalog, ceny, promocje, sklepy (docelowo z Navireo, `docs/navireo-integracja.md`).
- `src/content/` — teksty stron, FAQ, poradniki, strony prawne (`docs/ia.md`, rozdz. 6).
- `src/lib/` — logika: `pricing.js` (ceny, Omnibus), `locator.js` (najbliższe sklepy), `jsonld.ts`, `images.ts`.
- `src/scripts/` — małe skrypty przeglądarki bez frameworka (menu, filtry, ceny, warianty, sklepy, formularze, zgody, doradca).
- `src/styles/tokens.css` + `base.css` — cały wygląd; warstwa wizualna podmienia tokeny i style ról (klasy BEM).
- `src/assets/renders/` — rendery z `tools/render/` (brak pliku = placeholder z rysunkiem mebla, build się nie psuje).
- `liveo-assistant/` — doradca wnętrz (widżet + Worker); do `public/` tylko kopiujemy (`tools/sync-assistant.mjs`).

Standard odbioru: `docs/standard-seo-geo-a11y.md`.
