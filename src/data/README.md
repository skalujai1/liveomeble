# Dane strony — Liveo Meble

Katalog na stronie to **prawdziwe meble Liveo z kart produktu** (eksport Navireo), a lista salonów —
prawdziwe salony partnerskie z liveomeble.pl. Pliki w tym katalogu generuje `node tools/data/generate.mjs`
(bez zależności). Po zmianie generatora: `npm test`.

## Skąd są dane

| Krok | Skrypt | Wejście → wyjście |
|---|---|---|
| 1. Import kart | `python tools/data/import-karty.py "<folder z xlsx>"` (openpyxl) | karty produktu `*.xlsx` (Drive Liveo: „karty produktu dla białegostoku”, 46 plików) → `tools/data/karty-liveo.json` |
| 2. Zdjęcia | `npm run images` (`tools/data/fetch-images.mjs`, sharp) | linki z kart (serwer `upload.liveomeble.pl`) → `public/katalog/*.webp` + `manifest.json` (poza repozytorium; w CI w cache) |
| 3. Dane strony | `npm run data` (`tools/data/generate.mjs`) | `karty-liveo.json` + `salony-liveo.json` + manifest zdjęć → `src/data/*.json` |

`npm run build` robi kroki 2–3 sam (prebuild). Krok 1 uruchamia się ręcznie, gdy Liveo przyśle nowe karty.

## Zasady importu (uzgodnione 28.10.2026)

- **Mebel** = kolekcja + kod bryły (np. ARIS AS01). **Wariant** = kolor (osobny wiersz/plik w karcie, np. DANTE w 5 kolorach frontów).
- **Łóżka**: osobny mebel na rozmiar materaca i wersję (z pojemnikiem / bez stelaża), np. „Łóżko 160 z pojemnikiem ATE AT15”.
- **Kuchnie** tylko jako gotowe zestawy (TIFFANY T-35, długość 180–260 cm; A/B/C to kolory). Pojedyncze szafki, fronty, blaty i cokoły (PATI, TIFFANY) — pominięte.
- **Pominięte** jako akcesoria: uchwyty, LED i zasilacze, panele zagłowia, półki i fronty do szaf, korpusy FRESCO (system szaf z elementów). Lista w `karty-liveo.json → excluded` (z powodem).
- **Bez cen i promocji**: karty nie mają cen detalicznych (tylko cenę dropshipping netto w 11 wierszach — nie pokazujemy jej). Strona odsyła po cenę do salonu partnerskiego. `promotions.json` jest pusty, `src/lib/pricing.js` czeka na cennik z Navireo.
- Kolory: nazwy z kolumn KOLORYSTYKA KORPUSU / FRONTU, skróty z nazw handlowych rozwinięte („DĄB CR. T” → „dąb cremona torro”). Próbki kolorów (`finishes.json → hex`) są poglądowe.
- Opis kolekcji: zdania z opisów marketingowych z kart, które dotyczą całej serii (kolorów, charakteru) — bez dopisywania własnych.

## Pliki

| Plik | Zawartość |
|---|---|
| `collections.json` | 32 kolekcje: opis, kolory (`finishes`), pomieszczenia, aranżacje z kart (`arrangements` z pokojem) |
| `products.json` | 469 mebli, 666 wariantów: wymiary, waga, paczki z EAN, materiały (`specs`), dostawa 72 h, zdjęcia, rysunek wymiarowy, instrukcja PDF, animacja 360° |
| `finishes.json` | 35 dekorów z kart (hex próbki, jasność, drewno, połysk) |
| `types.json` | rodzaje mebli z kart (z pomieszczeniami liczonymi z danych) |
| `rooms.json` | 7 pomieszczeń (z kuchnią) |
| `promotions.json` | pusta lista — karty nie zawierają promocji |
| `postcodes.json` | prefiks kodu (2 cyfry) → przybliżony środek okręgu |
| `resellers.json` | 443 salony partnerskie z liveomeble.pl |
| `meta.json` | data importu, źródło, liczności |

## Logika (src/lib)

- `images.ts` — zdjęcia katalogu z `public/katalog` (packshot wariantu, aranżacje kolekcji i pokoi).
- `locator.js` — `normalizePostcode`, `lookupPostcode`, `haversineKm`, `nearestResellers`.
- `pricing.js` — silnik cen i promocji (Omnibus), gotowy na cennik z Navireo; dziś nieużywany przez strony.

## Eksport dla doradcy wnętrz

`node tools/data/export-assistant-catalog.mjs` → `liveo-assistant/data/catalog.json`
(jeden rekord na wariant, `price: null`, zdjęcie z `/katalog/`, profil koloru z dekorów).
