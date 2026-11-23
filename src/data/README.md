# Dane strony — Liveo Meble

Katalog na stronie to **prawdziwe meble Liveo z kart produktu** (eksport Navireo), a lista salonów —
prawdziwe salony partnerskie z liveomeble.pl. Pliki w tym katalogu generuje `node tools/data/generate.mjs`
(bez zależności). Po zmianie generatora: `npm test`.

## Skąd są dane

| Krok | Skrypt | Wejście → wyjście |
|---|---|---|
| 1. Import kart | `python tools/data/import-karty.py "<folder z xlsx>"` (openpyxl) | karty produktu `*.xlsx` (Drive Liveo: „karty produktu dla białegostoku”, 46 plików) → `tools/data/karty-liveo.json` |
| 1b. Salony | `python tools/data/import-salony.py` (openpyxl) | **baza salonów `tools/data/salony-liveo.xlsx`** (źródło prawdy od 03.11.2026) → `tools/data/salony-liveo.json` |
| 1c. Ceny | `python3 tools/data/import-ceny.py` (bez zależności, ok. 15 min) | **sklep liveomeble.pl**: cena, cena przed obniżką, Omnibus, daty promocji każdego mebla → `tools/data/ceny-liveomeble.json` (data odczytu w pliku). Uruchamiamy, gdy zmieniają się ceny lub promocje w sklepie. |
| 1c. Granice | `python tools/data/build-geo.py <wojewodztwa-min.geojson>` | PRG (GUGiK) z github.com/ppatrzyk/polska-geojson → `src/lib/geo-pl.json` (mapa salonów) |
| 2. Zdjęcia | `npm run images` (`tools/data/fetch-images.mjs`, sharp) | linki z kart (serwer `upload.liveomeble.pl`) → `public/katalog/*.webp` + `manifest.json` (poza repozytorium; w CI w cache) |
| 3. Dane strony | `npm run data` (`tools/data/generate.mjs`) | `karty-liveo.json` + `salony-liveo.json` + manifest zdjęć → `src/data/*.json` |

`npm run build` robi kroki 2–3 sam (prebuild). Krok 1 uruchamia się ręcznie, gdy Liveo przyśle nowe karty.

## Zasady importu (uzgodnione 28.10.2026)

- **Mebel** = kolekcja + kod bryły (np. ARIS AS01). **Wariant** = kolor (osobny wiersz/plik w karcie, np. DANTE w 5 kolorach frontów).
- **Łóżka**: osobny mebel na rozmiar materaca i wersję (z pojemnikiem / bez stelaża), np. „Łóżko 160 z pojemnikiem ATE AT15”.
- **Kuchnie** tylko jako gotowe zestawy (TIFFANY T-35, długość 180–260 cm; A/B/C to kolory). Pojedyncze szafki, fronty, blaty i cokoły (PATI, TIFFANY) — pominięte.
- **Pominięte** jako akcesoria: uchwyty, LED i zasilacze, panele zagłowia, półki i fronty do szaf, korpusy FRESCO (system szaf z elementów). Lista w `karty-liveo.json → excluded` (z powodem).
- **Ceny i promocje 1:1 ze sklepu liveomeble.pl** (karty nie mają cen detalicznych). `generate.mjs` łączy stronę sklepu z wariantem po indeksie („DT01 D/C/T/A KPL”), a gdy sklep go nie podaje — po modelu, rozmiarze łóżka, pojemniku (S.P.) i kolorach. Cena regularna → `variant.basePrice`, promocja → `promotions.json` (`fixedPrice` na indeks, z wartością Omnibus ze sklepu). Generator sprawdza, że cena policzona przez `priceFor()` = cena w sklepie co do grosza (inaczej przerywa). Warianty bez strony w sklepie albo niejednoznaczne: `meta.json` → `prices.missing` / `prices.unresolved` — na stronie „Cenę sprawdzisz w salonie partnerskim”.
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
| `resellers.json` | 448 salonów z bazy xlsx (443 w Polsce, 5 w Słowenii): adres, województwo, `offer` (meble skrzyniowe / tapicerka), `approx` + `note` (pinezka przybliżona) |
| `meta.json` | data importu, źródło, liczności |

## Logika (src/lib)

- `images.ts` — zdjęcia katalogu z `public/katalog` (packshot wariantu, aranżacje kolekcji i pokoi).
- `locator.js` — `normalizePostcode`, `lookupPostcode`, `haversineKm`, `nearestResellers`.
- `pricing.js` — silnik cen i promocji (Omnibus): ceny na stronie (PriceBlock), w JSON-LD i w doradcy; ten sam format przyjmie cennik z Navireo.

## Eksport dla doradcy wnętrz

`node tools/data/export-assistant-catalog.mjs` → `liveo-assistant/data/catalog.json`
(jeden rekord na wariant, `price: null`, zdjęcie z `/katalog/`, profil koloru z dekorów).
