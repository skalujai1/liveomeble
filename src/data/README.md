# Dane demo — Liveo Meble

Wszystkie pliki w tym katalogu generuje `node tools/data/generate.mjs [--today=YYYY-MM-DD]`
(deterministycznie, bez zależności). **Kolekcje, meble, ceny, promocje i sklepy są fikcyjne**
(`demo: true`). Docelowo dane przyjdą z ERP Navireo (API) i arkusza Excel klienta — pola
poniżej są do tego przygotowane. Po zmianie generatora: `node --test tools/data/`.

| Plik | Zawartość | Docelowe źródło |
|---|---|---|
| `finishes.json` | wykończenia: płyty (`group: "board"`), metale (`"metal"`), szkło (`"glass"`); `light` = L* 0–1 | słownik kolorów z Excela |
| `types.json` | 16 typów mebli: nazwy l.poj./l.mn./dopełniacz l.mn., slug kategorii, pokoje, `priceRange`, `kind` modelu 3D | stałe strony |
| `rooms.json` | 6 pomieszczeń (bez kuchni), przypadki, `assistantKey` dla doradcy | stałe strony |
| `collections.json` | 8 kolekcji: opis, styl, pokoje, `finishes` (warianty kolorystyczne), uchwyt, podstawa | Excel (opisy) |
| `products.json` | 87 mebli, 219 wariantów kolorystycznych | Navireo (indeksy, ceny, stany) + Excel (opisy, cechy, wymiary) |
| `promotions.json` | promocje (aktywne/przyszła/wygasła względem `--today`) | Navireo |
| `postcodes.json` | prefiks kodu (2 cyfry) → przybliżony środek okręgu | stałe (opracowanie własne) |
| `resellers.json` | 45 sklepów partnerskich | lista partnerów od klienta / CRM |
| `meta.json` | data generowania, ziarno, liczności | — |

## Produkt

- `sku` = indeks produktu (`LV-<KOLEKCJA>-<TYP><SZER>[SUFIKS]`), wariant: `variants[].sku = <sku>-<code>`.
- `basePrice` — cena regularna brutto PLN; cenę do pokazania liczy **zawsze** `priceFor()` z `src/lib/pricing.js`
  (promocja z ERP przecenia mebel bez zmiany danych produktu).
- `priceHistory` — zmiany faktycznej ceny sprzedaży z 60 dni (`{date, price}` = cena od tego dnia); źródło informacji Omnibus.
- `variants[].stock`: `dostepny` | `na-zamowienie` (+ `leadTimeDays`) | `wyprzedany`.
- `variants[].images.packshot` = `renders/products/<sku>--<code>.webp` (renderer, wg `model3d` + `variants[].finish`).
- `rooms` — slugi z `rooms.json`; łóżka ≤ 120 cm → pokój młodzieżowy, ≥ 140 cm → sypialnia.

## model3d — konwencje i rozszerzenia kontraktu

Wymiary w cm (`w`, `h`, `d` = `dims`). `finish` w `model3d` to wariant domyślny; każdy wariant ma własny `finish`.

- **Komórki frontów** (`columns[].cells`) są wymienione **od góry do dołu**; `w`/`h` to proporcje.
- **`legH`** — wysokość nóg/cokołu wliczona w `h`. Stoły, ławy, biurka: `legH = h − top`. Meble wiszące: `legH = 0`,
  a **`mountH`** to sugerowana wysokość dolnej krawędzi nad podłogą (do aranżacji).
- **cabinet**: `glassShelves: true`, gdy są drzwi przeszklone (szklane półki widoczne za szkłem).
- **desk** (biurko, toaletka): `pedestal` (cm) + `pedestalSide` (`left`|`right`) — kontener pod blatem;
  `columns` opisują **tylko kontener**; reszta szerokości to miejsce na nogi. `drawerH` (cm, opcjonalnie) —
  płytka szuflada pod blatem nad miejscem na nogi.
- **bed**: `mattress: [szer, dł]`, `headboardH`, `frameH` (wysokość ramy), `storage` (pojemnik), `upholstered`
  (tapicerowane wezgłowie w kolorze `finish.body`), opcjonalnie `headboard: "channels"`.
- **table**: opcjonalnie `extendTo` (cm po rozłożeniu). **coffeeTable**: `shelf` (półka pod blatem).
- **wallShelf**: `style` `board` (jedna deska, `top` = grubość) | `box` (otwarta skrzynka), `dividers`, `shelves`.
- **mirror**: `frame` (cm), `shape` `rect`|`arch`, `frameMaterial` `board`|`metal` (metal = kolor `finish.metal`).
- **coatRack**: `hooks`, `shelf`.
- `finish.legs` (opcjonalnie) — kolor drewnianych nóg (`base: "legsWood"`).

## Logika (src/lib)

- `pricing.js` — `priceFor(product, variantCode, promotions, now)`, `formatPrice`, `activePromotions`.
  Najlepsza pojedyncza promocja (bez łączenia), aktywna gdy `startsAt <= now < endsAt`, cena w dół do pełnych zł, min. 1 zł.
  Zakres promocji: listy `collections`/`types`/`skus` łączone przez AND, wartości w liście przez OR.
- `locator.js` — `normalizePostcode`, `lookupPostcode`, `haversineKm`, `nearestResellers` (filtr po kolekcji).
