# Architektura informacji — nowa strona Liveo Meble

Stan na: 2026-10-20 · Wersja robocza do akceptacji klienta.

Dokument opisuje wszystkie strony serwisu: adresy, cel, kolejność sekcji, H1, `<title>`, meta description,
dane strukturalne (JSON-LD) i linkowanie wewnętrzne. Teksty sekcji są w `src/content/` (rozdział 6) — tu jest
szkielet, tam są słowa. Gdy coś się nie zgadza, **rozstrzyga plik treści** w `src/content/`, a ten dokument trzeba poprawić.

Powiązane: [`brief.md`](brief.md) · [`navireo-integracja.md`](navireo-integracja.md) · [`do-potwierdzenia.md`](do-potwierdzenia.md) · dane demo: [`src/data/README.md`](../src/data/README.md).

---

## 1. Zasady adresów i indeksowania

| Zasada | Szczegóły |
|---|---|
| Ukośnik na końcu | Każdy adres strony kończy się `/` (`/kolekcje/olmo/`). Adres bez ukośnika → 301 na wersję z ukośnikiem. Wyjątki: pliki (`/llms.txt`, `/sitemap.xml`, `/robots.txt`), API (`/api/...`). |
| Tylko małe litery ASCII | Bez polskich znaków, słowa łączone `-`: `pokoj-mlodziezowy`, `szafki-na-buty`. Slugi biorą się z `src/data/*.json` (`slug`). |
| Jeden adres = jedna treść | `<link rel="canonical">` na każdej stronie, zawsze do wersji bez parametrów. W linkach nigdy `index.html`. |
| Parametry = noindex | Filtry (`/meble/?pokoj=salon`), wariant koloru (`/produkt/<slug>/?kolor=DN`), wyszukiwarka sklepów (`/gdzie-kupic/?kod=35-060`) → `noindex, follow` + canonical do adresu bazowego. |
| Strony indeksowane | Wszystkie z mapy poniżej poza: `/strefa-partnera/` (noindex, nofollow) i stroną 404. |
| Okruszki | Na każdej stronie poza główną; ta sama ścieżka w HTML i w `BreadcrumbList`. |
| Język | `<html lang="pl">`. Wersje językowe — [do potwierdzenia]; jeśli powstaną: prefiks `/en/`, `/de/` + `hreflang`, wersja polska bez prefiksu. |
| Przyszły koszyk | Zarezerwowane adresy: `/koszyk/`, `/zamowienie/`, `/konto/` — nie używać do innych celów (patrz rozdz. 9). |

## 2. Mapa stron

```
/                                   Strona główna
├── kolekcje/                       Wszystkie kolekcje (8)
│   └── <slug>/                     olmo, talve, nokta, solma, liran, melva, briso, verno
├── meble/                          Wszystkie meble (87, 219 wariantów kolorów) + filtry
│   └── <kategoria>/                16 kategorii: szafki-rtv, komody, witryny, regaly, lawy, polki, stoly,
│                                   kredensy, lozka, szafki-nocne, szafy, toaletki, lustra, biurka,
│                                   szafki-na-buty, wieszaki
├── pomieszczenia/                  Meble według pomieszczenia
│   └── <slug>/                     salon, jadalnia, sypialnia, pokoj-mlodziezowy, przedpokoj, biuro
├── produkt/<slug>/                 Strona mebla (87), np. /produkt/szafka-rtv-160-olmo/
├── promocje/                       Aktualne promocje + zasady Omnibus
├── gdzie-kupic/                    Wyszukiwarka sklepów partnerskich
├── doradca-wnetrz/                 Opis doradcy AI + wejście do widżetu
├── poradnik/                       Lista artykułów
│   ├── jak-dobrac-szafke-rtv/
│   ├── jak-zmierzyc-wneke-pod-szafe/
│   ├── plyta-meblowa-laminowana/
│   └── jak-urzadzic-mala-sypialnie/
├── dla-partnerow/                  B2B: współpraca dla sklepów, formularz
├── strefa-partnera/                Logowanie + panel partnera (DEMO), noindex
├── o-nas/
├── kontakt/
├── polityka-prywatnosci/
├── regulamin/
└── 404                             404.html (status 404, noindex)

Pliki techniczne: /robots.txt · /sitemap.xml · /llms.txt · /llms-full.txt · /og/*.jpg · /api/* (Cloudflare Worker)
```

Strony indeksowane: **134** (1 główna + 2 zbiorcze kolekcji i mebli + 8 kolekcji + 16 kategorii + 1 + 6 pomieszczeń +
87 mebli + promocje, gdzie kupić, doradca, poradnik, dla partnerów, o nas, kontakt + 4 artykuły + 2 prawne).
Liczby wynikają z danych demo — po imporcie z Navireo/Excela zmienią się same.

Każdy mebel jest osiągalny w **3 kliknięciach** od strony głównej: główna → kolekcja (albo pomieszczenie) → mebel.

## 3. Szablony stron

Format każdej pozycji: **cel** · **sekcje w kolejności** (jedna myśl na sekcję; identyfikatory = `sections[].id`
w pliku treści) · **H1** · **`<title>`** (≤ 60 znaków) · **meta description** (≤ 155 znaków) · **JSON-LD** · **linki wewnętrzne**.
Długości tytułów i opisów są sprawdzone dla wszystkich stron statycznych; szablony mają reguły skracania.

### 3.1 Strona główna `/`

- **Plik treści:** `src/content/pages/home.json`
- **Cel:** w 5 sekund pokazać, że Liveo to meble projektowane w kolekcjach, i poprowadzić do kolekcji albo do sklepu.
- **Sekcje:** `hero` (jedno duże zdjęcie aranżacji = LCP, bez karuzeli) → `kolekcje` (8 kart) → `pomieszczenia` (6 kart) →
  `jak-kupic` (4 kroki: wybierasz tu, kupujesz w sklepie) → `doradca` → `promocje` (ukryta, gdy brak aktywnych) →
  `producent` → `poradnik` (4 artykuły) → `partnerzy` (pas B2B) → FAQ (7).
- **H1:** „Meble, które pasują do siebie <br>w każdym pokoju”
- **Title:** „Liveo Meble — kolekcje mebli do całego domu” (43)
- **Description:** „Meble projektowane w kolekcjach: szafki RTV, komody, witryny, łóżka i szafy w spójnych kolorach. Wybierz kolekcję i znajdź sklep partnerski blisko domu.” (152)
- **JSON-LD:** `Organization` (name, legalName, url, logo, address: Raniżów / podkarpackie / PL, `sameAs` po potwierdzeniu), `WebSite` (bez `SearchAction` — nie mamy wyszukiwarki tekstowej), `FAQPage`.
- **Linki:** wszystkie kolekcje, wszystkie pomieszczenia, `/gdzie-kupic/`, `/doradca-wnetrz/`, `/promocje/`, 4 artykuły, `/poradnik/`, `/o-nas/`, `/dla-partnerow/`.

### 3.2 Kolekcje `/kolekcje/`

- **Plik treści:** `src/content/pages/kolekcje.json`
- **Cel:** porównać kolekcje obrazem i wybrać jedną.
- **Sekcje:** `wstep` → `lista` (karty kolekcji z filtrem po pomieszczeniu; filtr działa w przeglądarce, bez zmiany adresu) → `jak-wybrac` (4 wskazówki) → `gdzie-zobaczyc` → FAQ (6).
- **H1:** „Kolekcje mebli Liveo”
- **Title:** „Kolekcje mebli — komplety do salonu i sypialni | Liveo” (54)
- **Description:** „Kolekcje mebli Liveo: meble do salonu, jadalni, sypialni, przedpokoju i pokoju młodzieżowego w tych samych kolorach i z tymi samymi uchwytami.” (142)
- **JSON-LD:** `CollectionPage`, `ItemList` (8 × `ListItem` → URL kolekcji), `BreadcrumbList`, `FAQPage`.
- **Linki:** 8 kolekcji, `/doradca-wnetrz/`, `/gdzie-kupic/`.

### 3.3 Kolekcja `/kolekcje/<slug>/`

- **Plik treści:** `src/content/pages/kolekcje.json` → `template`; dane: `collections.json`, `products.json`, `finishes.json`.
- **Cel:** pokazać komplet w aranżacji, wszystkie meble kolekcji i drogę do sklepu z tą kolekcją.
- **Sekcje:** `hero` (aranżacja `heroRoom`) → `opis` → `meble` (pogrupowane po pomieszczeniach) → `kolory` (warianty kolekcji) →
  `szczegoly` (uchwyty, podstawa, styl, pomieszczenia) → `gdzie-kupic` (wyszukiwarka z ustawioną kolekcją) → `podobne` (maks. 3) → FAQ (4, generowane z danych).
- **H1:** „Kolekcja {NAZWA}”, np. „Kolekcja OLMO”
- **Title:** „Kolekcja {NAZWA} — meble {styl} | Liveo”, np. „Kolekcja OLMO — meble w stylu naturalnym | Liveo” (48). Najdłuższy w danych demo: MELVA (58). Powyżej 60 → „Kolekcja mebli {NAZWA} | Liveo”.
- **Description:** „{tagline} Meble z kolekcji {NAZWA} do: {pomieszczenia}. Sprawdź kolory, wymiary i ceny.” — przycięte na granicy zdania do 155.
- **JSON-LD:** `CollectionPage`, `ItemList` (meble kolekcji), `BreadcrumbList` (Strona główna › Kolekcje › OLMO), `FAQPage`.
- **Linki:** każdy mebel kolekcji, strony pomieszczeń z `rooms`, kategorie typów obecnych w kolekcji, `/gdzie-kupic/?kolekcja=<slug>`, 3 podobne kolekcje, `/doradca-wnetrz/`.

### 3.4 Wszystkie meble `/meble/`

- **Plik treści:** `src/content/pages/meble.json`
- **Cel:** szybko zawęzić 87 mebli do kilku pasujących.
- **Sekcje:** `wstep` → `rodzaje` (16 kafli kategorii) → `lista` (filtry + sortowanie + karty) → `doradca` → FAQ (6).
- **Filtry** (parametry GET, wiele wartości po przecinku): `pokoj` (pomieszczenie), `typ` (rodzaj mebla), `kolekcja`, `kolor` (wykończenia `group = board`),
  `cena` (`0-499`, `500-999`, `1000-1499`, `1500-`; liczona z aktualnej ceny z promocją), `promocje=1` (tylko promocje), `sort`.
  Bez JS: zwykły formularz GET i pełna lista w HTML. Z JS: filtrowanie w przeglądarce bez przeładowania, adres aktualizowany przez `history.replaceState`.
- **H1:** „Wszystkie meble Liveo”
- **Title:** „Meble do salonu, sypialni i przedpokoju — katalog | Liveo” (57)
- **Description:** „Wszystkie meble Liveo w jednym miejscu: szafki RTV, komody, witryny, stoły, łóżka, szafy i biurka. Filtruj według pokoju, koloru, ceny i promocji.” (146)
- **JSON-LD:** `CollectionPage`, `ItemList` (wszystkie meble), `BreadcrumbList`, `FAQPage`.
- **Linki:** 16 kategorii, wszystkie meble, `/promocje/`, `/doradca-wnetrz/`, poradnik o mierzeniu.

### 3.5 Kategoria `/meble/<kategoria>/`

- **Plik treści:** `src/content/pages/kategorie.json` (16 pozycji: SEO, wstęp, wskazówki, powiązany poradnik) + `template`.
- **Cel:** odpowiedzieć na zapytania typu „komody”, „szafka RTV wisząca” — lista mebli jednego rodzaju i krótka pomoc w wyborze.
- **Sekcje:** `wstep` → lista mebli (komponent z `/meble/` z ustawionym `typ`) → „Jak wybrać: {rodzaj}” (2–3 wskazówki, ogólna wiedza) →
  „{Rodzaj} do pomieszczeń” (linki do pomieszczeń) → link do poradnika (jeśli `guide`) → FAQ (5: trzy z danych — ceny od–do, kolekcje, szerokości — oraz dopasowanie do reszty mebli i gdzie kupić).
- **H1:** liczba mnoga typu, np. „Komody”
- **Title / description:** z `kategorie.json`, wszystkie ≤ 60 / ≤ 155:

| Adres | H1 | Title (znaki) | Poradnik |
|---|---|---|---|
| `/meble/szafki-rtv/` | Szafki RTV | Szafki RTV pod telewizor — stojące i wiszące \| Liveo (52) | jak-dobrac-szafke-rtv |
| `/meble/komody/` | Komody | Komody do salonu, sypialni i przedpokoju \| Liveo (48) | jak-urzadzic-mala-sypialnie |
| `/meble/witryny/` | Witryny | Witryny z przeszkleniem do salonu i jadalni \| Liveo (51) | — |
| `/meble/regaly/` | Regały | Regały na książki — otwarte i z drzwiami \| Liveo (48) | plyta-meblowa-laminowana |
| `/meble/lawy/` | Ławy | Ławy i stoliki kawowe do salonu \| Liveo (39) | — |
| `/meble/polki/` | Półki | Półki wiszące na ścianę \| Liveo (31) | — |
| `/meble/stoly/` | Stoły | Stoły do jadalni, także rozkładane \| Liveo (42) | — |
| `/meble/kredensy/` | Kredensy | Kredensy do jadalni i salonu \| Liveo (36) | — |
| `/meble/lozka/` | Łóżka | Łóżka 90, 120, 140 i 160 cm, także z pojemnikiem \| Liveo (56) | jak-urzadzic-mala-sypialnie |
| `/meble/szafki-nocne/` | Szafki nocne | Szafki nocne stojące i wiszące \| Liveo (38) | jak-urzadzic-mala-sypialnie |
| `/meble/szafy/` | Szafy | Szafy do sypialni, przedpokoju i pokoju nastolatka \| Liveo (58) | jak-zmierzyc-wneke-pod-szafe |
| `/meble/toaletki/` | Toaletki | Toaletki z szufladą do sypialni \| Liveo (39) | — |
| `/meble/lustra/` | Lustra | Lustra na ścianę do przedpokoju i sypialni \| Liveo (50) | — |
| `/meble/biurka/` | Biurka | Biurka do pokoju młodzieżowego i domowego biura \| Liveo (55) | — |
| `/meble/szafki-na-buty/` | Szafki na buty | Szafki na buty do przedpokoju \| Liveo (37) | — |
| `/meble/wieszaki/` | Wieszaki | Wieszaki do przedpokoju \| Liveo (31) | — |

- **JSON-LD:** `CollectionPage`, `ItemList`, `BreadcrumbList` (Strona główna › Meble › Komody), `FAQPage`.
- **Linki:** meble kategorii, pomieszczenia z `types[].rooms`, kolekcje, które mają ten typ, poradnik z `guide`, `/meble/`.

### 3.6 Pomieszczenia `/pomieszczenia/` i `/pomieszczenia/<slug>/`

- **Plik treści:** `src/content/pages/pomieszczenia.json` (strona zbiorcza + 6 pozycji + `template`).
- **Cel:** wejście „od pokoju” — dla osób, które urządzają konkretne pomieszczenie, a nie szukają konkretnego mebla.
- **Strona zbiorcza** `/pomieszczenia/`: H1 „Meble według pomieszczenia”, 6 kart; title „Meble według pomieszczenia — od salonu po przedpokój | Liveo” (60); JSON-LD `CollectionPage`, `BreadcrumbList`.
- **Sekcje strony pomieszczenia:** wstęp → „Kolekcje {pomieszczenia}” → „Meble {w pomieszczeniu}” (lista z ustawionym `pokoj`, grupowana po rodzaju) →
  „Na co zwrócić uwagę” (3 wskazówki) → doradca (z ustawionym pokojem) → FAQ (5: trzy dla pokoju z `items[].faq` + dwa wspólne z `template.faqShared`).

| Adres | H1 | Title (znaki) | Poradnik |
|---|---|---|---|
| `/pomieszczenia/salon/` | Meble do salonu | Meble do salonu — szafki RTV, komody, witryny \| Liveo (53) | jak-dobrac-szafke-rtv |
| `/pomieszczenia/jadalnia/` | Meble do jadalni | Meble do jadalni — stoły, kredensy, witryny \| Liveo (51) | — |
| `/pomieszczenia/sypialnia/` | Meble do sypialni | Meble do sypialni — łóżka, szafy, komody \| Liveo (48) | jak-urzadzic-mala-sypialnie |
| `/pomieszczenia/pokoj-mlodziezowy/` | Meble do pokoju młodzieżowego | Meble do pokoju młodzieżowego — biurka, łóżka \| Liveo (53) | — |
| `/pomieszczenia/przedpokoj/` | Meble do przedpokoju | Meble do przedpokoju — szafy, szafki na buty \| Liveo (52) | jak-zmierzyc-wneke-pod-szafe |
| `/pomieszczenia/biuro/` | Meble do domowego biura | Meble do domowego biura — biurka, regały \| Liveo (48) | — |

- **JSON-LD:** `CollectionPage`, `ItemList`, `BreadcrumbList`, `FAQPage`.
- **Linki:** kolekcje z tym pomieszczeniem, meble, kategorie typowe dla pokoju, poradnik, `/doradca-wnetrz/`.
- **Kuchnia:** brak strony, dopóki klient nie zdecyduje o kuchniach ([`do-potwierdzenia.md`](do-potwierdzenia.md), pkt 1).

### 3.7 Mebel `/produkt/<slug>/`

- **Plik treści:** `src/content/pages/produkt.json` (szablon); dane: `products.json` + kolekcja, wykończenia, promocje, sklepy.
- **Cel:** dać komplet informacji do decyzji (wygląd, kolor, wymiary, cena, dostępność) i poprowadzić do sklepu lub do reszty kompletu.
- **Sekcje:**
  1. `galeria` — packshot wariantu, aranżacja, detale; zmiana koloru podmienia zdjęcia;
  2. `podsumowanie` — kolekcja (link), wybór koloru (radio, `?kolor=` w adresie), wymiary, **cena z promocją i linią Omnibus**, dostępność, montaż, przyciski „Gdzie kupić” i „Zobacz komplet”;
  3. `opis`;
  4. `wymiary` — tabela + rysunek wymiarowy + link do poradnika o mierzeniu;
  5. `szczegoly` — `features[]`;
  6. `gdzie-kupic` — wyszukiwarka z ustawioną kolekcją, 3 najbliższe sklepy, link do pełnej listy;
  7. `komplet` — do 6 mebli z tej samej kolekcji w tym samym kolorze;
  8. `doradca`;
  9. FAQ (5, generowane wyłącznie z pól mebla).
- **Cena:** zawsze `priceFor()` z `src/lib/pricing.js`. W HTML — cena z dnia budowy; w przeglądarce — odświeżenie z `GET /api/prices` (fallback: wartość z HTML). Przy promocji: cena promocyjna, przekreślona cena regularna i **zawsze** „Najniższa cena z 30 dni przed obniżką”. Szczegóły: [`navireo-integracja.md`](navireo-integracja.md).
- **H1:** `{name}`, np. „Szafka RTV 160 OLMO”
- **Title:** „{name} — {kolor} | Liveo”; > 60 znaków → „{name} — wymiary, kolory, cena | Liveo”; nadal > 60 → „{name} | Liveo”. W danych demo 5 z 219 kombinacji przekracza 60 i spada na regułę zapasową.
- **Description:** „{name}: szer. × wys. × gł. cm. {pierwsze zdanie opisu} Kolory: {lista}.” — przycięte na granicy zdania do 155.
- **JSON-LD:** `ProductGroup` (`productGroupID` = sku, `variesBy: color`, `hasVariant` → `Product` dla każdego koloru: `sku`, `color`, `image`, `width`/`height`/`depth` w `CMT`, `weight` w `KGM`, `brand` = Liveo, `offers` → `Offer`), `BreadcrumbList` (Strona główna › Meble › Szafki RTV › Szafka RTV 160 OLMO), `FAQPage`.
  - `Offer.price` = cena z `priceFor()` z dnia budowy, `priceCurrency: PLN`, `priceValidUntil` = koniec promocji (gdy jest).
  - `Offer.availability` — Liveo nie sprzedaje online, więc rekomendacja: `InStoreOnly` dla dostępnych i „na zamówienie”, `OutOfStock` dla wyprzedanych [do decyzji].
  - Przy promocji opcjonalnie `priceSpecification` z ceną regularną typu `StrikethroughPrice`.
  - **Bez** `aggregateRating` i `review` — nie mamy opinii i ich nie wymyślamy.
- **Linki:** kolekcja, kategoria (okruszki), pomieszczenia mebla, meble kompletu, `/gdzie-kupic/?kolekcja=<slug>`, poradnik o mierzeniu, `/doradca-wnetrz/`.

### 3.8 Promocje `/promocje/`

- **Plik treści:** `src/content/pages/promocje.json`
- **Cel:** pokazać trwające obniżki i uczciwie wyjaśnić, jak czytać ceny (Omnibus).
- **Sekcje:** `wstep` → `aktywne` (karty promocji + meble w każdej; liczone w przeglądarce z API, fallback z budowy; pusty stan) →
  `jak-czytac-ceny` (3 pojęcia + przykład) → `zasady` (Omnibus prostym językiem, promocje się nie łączą, ceny w sklepach) → `gdzie-kupic` → FAQ (6).
- **H1:** „Promocje”
- **Title:** „Promocje na meble Liveo — aktualne obniżki cen” (46)
- **Description:** „Aktualne promocje na meble Liveo: rabaty na kolekcje i rodzaje mebli. Przy każdej obniżce podajemy najniższą cenę z 30 dni przed nią.” (133)
- **JSON-LD:** `CollectionPage`, `ItemList` (meble w promocji w dniu budowy), `BreadcrumbList`, `FAQPage`.
- **Linki:** meble w promocji, `/meble/?promocje=1`, kolekcje objęte promocją, `/gdzie-kupic/`.

### 3.9 Gdzie kupić `/gdzie-kupic/`

- **Plik treści:** `src/content/pages/gdzie-kupic.json`
- **Cel:** od kodu pocztowego do najbliższego sklepu z wybraną kolekcją — w jednym kroku.
- **Sekcje:** `wyszukiwarka` (kod pocztowy — główna metoda; filtr kolekcji; przycisk „Użyj mojej lokalizacji” — dopiero po kliknięciu i za zgodą przeglądarki; podpowiedź regionu z IP — tylko tekst, nigdy automatyczne wypełnienie) →
  `wyniki` (5 najbliższych + „Pokaż kolejne”, odległość w linii prostej, kolekcje, usługi, godziny, „Wyznacz trasę”; mapa poglądowa w SVG, bez zewnętrznych kafelków) →
  `przed-wizyta` → `partnerzy` → FAQ (7).
- **Bez JS:** formularz GET + statyczna lista wszystkich sklepów według województw (dla czytników i wyszukiwarek).
- **Prywatność:** obliczenia (`normalizePostcode`, `lookupPostcode`, `nearestResellers` z `src/lib/locator.js`) w przeglądarce — kod nie trafia na serwer.
- **H1:** „Gdzie kupić meble Liveo”
- **Title:** „Gdzie kupić meble Liveo — sklepy partnerskie blisko Ciebie” (58)
- **Description:** „Wpisz kod pocztowy i znajdź najbliższy sklep partnerski z meblami Liveo. Sprawdź, które kolekcje ma na ekspozycji i czy oferuje dostawę lub montaż.” (147)
- **JSON-LD:** `WebPage`, `BreadcrumbList`, `FAQPage`. `ItemList` sklepów jako `FurnitureStore` — dopiero po zgodzie partnerów na publikację danych; bez sugerowania, że to salony Liveo (bez `parentOrganization`).
- **Linki:** kolekcje sklepu (przy każdym wyniku), `/dla-partnerow/`, poradnik o mierzeniu.

### 3.10 Dla partnerów `/dla-partnerow/`

- **Plik treści:** `src/content/pages/dla-partnerow.json`
- **Cel:** przekonać właściciela sklepu do zgłoszenia — konkretnie, bez cennika.
- **Sekcje:** `hero` → `co-dostajesz` (5 korzyści) → `jak-zaczac` (4 kroki) → `kogo-szukamy` → `zgloszenie` (formularz → `POST /api/forms/partner`) → `logowanie` (pas do strefy) → FAQ (6).
- **H1:** „Sprzedawaj meble Liveo <br>w swoim sklepie”
- **Title:** „Współpraca dla sklepów meblowych — zostań partnerem Liveo” (57)
- **Description:** „Sprzedawaj kolekcje mebli Liveo w swoim sklepie. Strefa partnera z cenami, stanami i zamówieniami online. Zobacz, jak zacząć współpracę.” (136)
- **JSON-LD:** `WebPage`, `BreadcrumbList`, `FAQPage`.
- **Linki:** `/strefa-partnera/`, `/kolekcje/`, `/gdzie-kupic/` (jak sklep widzą klienci), `/kontakt/`.

### 3.11 Strefa partnera `/strefa-partnera/` — DEMO

- **Plik treści:** `src/content/pages/strefa-partnera.json`
- **Cel:** logowanie partnera; w DEMO — pokazanie, jak działa cennik partnerski i zamówienie trafiające do Navireo.
- **Widoki:** logowanie (e-mail + hasło, „Nie pamiętam hasła”, „Wejdź do wersji demo”) → panel z zakładkami: `cennik` (ceny netto partnera, stany, dodawanie do zamówienia, eksport CSV) →
  `zamowienie` (pozycje, suma netto/VAT/brutto, adres dostawy, numer własny, uwagi, wysyłka) → `historia` (statusy: przyjęte → w Navireo → wysłane) → `materialy` → `konto`.
- **DEMO:** stały baner „Wersja demonstracyjna”; ceny partnerskie wyliczone przykładowo; zamówienia zapisywane tylko w `localStorage` przeglądarki, bez wywołania API.
- **H1:** „Strefa partnera”
- **Title:** „Strefa partnera — logowanie | Liveo” (35) · **robots:** `noindex, nofollow`; poza `sitemap.xml` i `llms.txt`; panel: `Cache-Control: private, no-store`.
- **JSON-LD:** tylko `WebPage` (bez FAQPage, bez cen).
- **Linki:** `/dla-partnerow/` (dla osób bez konta), `/kontakt/`.

### 3.12 Doradca wnętrz `/doradca-wnetrz/`

- **Plik treści:** `src/content/pages/doradca-wnetrz.json`; widżet: `liveo-assistant/`.
- **Cel:** pełny doradca na stronie w czterech krokach: zdjęcie → pokój i kolory (do poprawienia) → komplety (najlepszy i kolejne kolekcje; filtry: pokój, ton, budżet na mebel, rodzaj mebla, polecenie tekstowe) → gdzie kupić (wyszukiwarka sklepów z wybraną kolekcją). Mały czat na pozostałych stronach to szybki podgląd: przenosi tu zdjęcie i wynik (`sessionStorage` `lv-advisor`, `?pokoj=`).
- **Sekcje:** `hero` (H1, lead, link „Jak korzystać”, prywatność, informacja „odpowiada asystent AI”) → `narzedzie` (`AdvisorTool.astro` + `src/scripts/advisor.ts`) → `jak-korzystac` (4 kroki, te same co w narzędziu) →
  `wskazowki` (jak zrobić zdjęcie) → `co-potrafi` (potrafi / nie potrafi) → `prywatnosc` → FAQ (8) → `dalej`.
- **Wydajność:** na tej stronie nie ładujemy małego czatu; katalog doradcy pobierany w czasie bezczynności, model analizy obrazu dopiero przy pierwszym zdjęciu.
- **H1:** „Doradca wnętrz”
- **Title:** „Doradca wnętrz — dobierz meble ze zdjęcia pokoju | Liveo” (56)
- **Description:** „Wyślij zdjęcie pokoju, a doradca wnętrz Liveo zaproponuje komplet mebli z jednej kolekcji dopasowany do kolorów wnętrza. Zdjęcie zostaje na urządzeniu.” (151)
- **JSON-LD:** `WebPage`, `BreadcrumbList`, `FAQPage`. Bez `SoftwareApplication` z ocenami.
- **Linki:** `/kolekcje/`, `/gdzie-kupic/`, `/polityka-prywatnosci/#doradca-wnetrz`. Wejście do doradcy jest też na stronie głównej, kolekcjach, pomieszczeniach, meblach i w poradnikach.

### 3.13 O nas `/o-nas/`

- **Plik treści:** `src/content/pages/o-nas.json`
- **Cel:** kim jest Liveo i dlaczego kolekcje — **tylko potwierdzone fakty**.
- **Sekcje:** `wstep` → `kolekcje` (dlaczego projektujemy w kompletach) → `produkcja` ([do potwierdzenia] — cała sekcja) → `historia` ([do potwierdzenia]; bez potwierdzenia — usunąć) → `jak-sprzedajemy` → `dla-sklepow` → `dane-firmy` → FAQ (5).
- **H1:** „Meble z Raniżowa, <br>projektowane w kolekcjach”
- **Title:** „O nas — producent mebli z Raniżowa | Liveo” (42)
- **Description:** „Liveo Meble to polski producent mebli skrzyniowych i systemowych z Raniżowa. Projektujemy meble w kolekcjach i sprzedajemy je przez sklepy partnerskie.” (151)
- **JSON-LD:** `AboutPage`, `Organization` (bez `foundingDate` i `numberOfEmployees` do potwierdzenia), `BreadcrumbList`, `FAQPage`.
- **Linki:** `/kolekcje/`, `/gdzie-kupic/`, `/dla-partnerow/`, `/kontakt/`.

### 3.14 Kontakt `/kontakt/`

- **Plik treści:** `src/content/pages/kontakt.json`
- **Cel:** skierować sprawę tam, gdzie zostanie załatwiona (zakup i reklamacja → sklep; współpraca → B2B), a resztę przyjąć formularzem.
- **Sekcje:** `wstep` → `sprawy` (4 ścieżki) → `dane` (adres, telefon, e-mail, godziny — wszystko [do potwierdzenia]) → `formularz` (`POST /api/forms/contact`) → `social` (ukryta, gdy pusta) → FAQ (5).
- **H1:** „Kontakt”
- **Title:** „Kontakt — Liveo Meble, Raniżów” (30)
- **Description:** „Kontakt z Liveo Meble: adres, telefon i e-mail producenta. Pytania o zakup, reklamacje i współpracę — sprawdź, gdzie najszybciej załatwisz sprawę.” (146)
- **JSON-LD:** `ContactPage`, `Organization` (+ `contactPoint` po potwierdzeniu danych), `BreadcrumbList`, `FAQPage`.
- **Linki:** `/gdzie-kupic/`, `/dla-partnerow/`, `/polityka-prywatnosci/`.

### 3.15 Poradnik `/poradnik/` i artykuły `/poradnik/<slug>/`

- **Pliki treści:** `src/content/pages/poradnik.json` (lista + szablon artykułu), `src/content/poradnik/*.md`.
- **Cel:** rzetelna, ogólna wiedza przed zakupem — odpowiedzi, które cytują wyszukiwarki i asystenci AI. Bez reklamy w treści i bez przypisywania meblom Liveo niepotwierdzonych cech.
- **Lista** `/poradnik/`: H1 „Poradnik”; title „Poradnik — jak wybrać i ustawić meble | Liveo” (45); JSON-LD `CollectionPage`, `ItemList`, `BreadcrumbList`.
- **Artykuł — sekcje:** H1 (`title`) → meta (autor, data, czas czytania) → lead → „Najważniejsze w jednym zdaniu” → spis treści (z H2) →
  H2 jako pytania (z listami i tabelą porównawczą) → „Jakich błędów unikać?” → „Jak zabrać się do tego krok po kroku?” → „Najczęstsze pytania” (H3 = pytania) → CTA (kategoria, pomieszczenie, doradca, gdzie kupić) → „Przeczytaj też”.
- **Title:** `seoTitle` z frontmatter (≤ 60). **Description:** `description` (≤ 155).
- **JSON-LD:** `Article` (`headline`, `description`, `datePublished`, `dateModified`, `author` = `Organization` „Liveo Meble”, dopóki autor nie jest potwierdzony, `publisher`, `image`), `BreadcrumbList`, `FAQPage` z `faq[]`.

| Adres | Title (znaki) | Słowa | Linki do |
|---|---|---|---|
| `/poradnik/jak-dobrac-szafke-rtv/` | Jak dobrać szafkę RTV do telewizora i salonu \| Liveo (52) | 1191 | `/meble/szafki-rtv/`, `/pomieszczenia/salon/` |
| `/poradnik/jak-zmierzyc-wneke-pod-szafe/` | Jak zmierzyć wnękę pod szafę, żeby mebel pasował \| Liveo (56) | 1140 | `/meble/szafy/`, `/pomieszczenia/przedpokoj/`, `/pomieszczenia/sypialnia/` |
| `/poradnik/plyta-meblowa-laminowana/` | Płyta meblowa laminowana — co warto wiedzieć \| Liveo (52) | 1172 | `/meble/`, `/kolekcje/` |
| `/poradnik/jak-urzadzic-mala-sypialnie/` | Jak urządzić małą sypialnię: meble i ustawienie \| Liveo (55) | 1118 | `/pomieszczenia/sypialnia/`, `/meble/lozka/`, `/meble/szafy/` |

Każdy artykuł linkuje też do `/doradca-wnetrz/` lub `/gdzie-kupic/`. Do artykułów linkują: strona główna, strony kategorii i pomieszczeń (pole `guide`), karta mebla (sekcja wymiarów), `/gdzie-kupic/`.

### 3.16 Strony prawne `/polityka-prywatnosci/`, `/regulamin/`

- **Pliki treści:** `src/content/legal/polityka-prywatnosci.md`, `src/content/legal/regulamin.md` — **wzory do weryfikacji przez prawnika**.
- **Sekcje:** jak w plikach; spis treści z H2; data wersji na dole.
- **Title:** „Polityka prywatności | Liveo” (28), „Regulamin strony | Liveo” (24).
- **JSON-LD:** `WebPage`, `BreadcrumbList`.
- **Linki:** ze stopki na każdej stronie i z każdego formularza (klauzula informacyjna).

### 3.17 Strona 404

- **Plik treści:** `src/content/pages/site.json` → `notFound`.
- **Treść:** H1 „Tej strony nie ma”, wyjaśnienie, 4 linki (kolekcje, meble, gdzie kupić, główna), informacja dla osób ze starej strony.
- **Technicznie:** `404.html`, status HTTP 404, `noindex`. Stare adresy z liveomeble.pl mają przekierowania 301 (rozdz. 8), więc 404 to ostateczność.

## 4. Nawigacja

**Nagłówek** (`site.json` → `nav`): logo (→ `/`) · Kolekcje · Meble (podmenu: 6 pomieszczeń + „Wszystkie meble”) · Promocje · Doradca wnętrz · Poradnik · przycisk **Gdzie kupić**.
Linki drugorzędne (mniejsze, w menu mobilnym na dole): Dla partnerów · Strefa partnera.

- Menu mobilne: przycisk z `aria-expanded` i `aria-controls`, pułapka fokusu w otwartym menu, zamykanie klawiszem Esc, powrót fokusu na przycisk.
- Podmenu „Meble”: przycisk rozwijający z `aria-expanded` (nie sam hover), link „Meble” prowadzi do `/meble/`.
- Bieżąca strona: `aria-current="page"`.
- Pierwszy element strony: skip-link „Przejdź do treści” → `#tresc`.

**Stopka** (`site.json` → `footer`): 4 kolumny — Kolekcje (z danych) · Meble (pomieszczenia) · Pomoc w wyborze (Gdzie kupić, Doradca, Poradnik, Promocje) · Liveo (O nas, Kontakt, Dla partnerów, Strefa partnera);
pod spodem: dane spółki [do potwierdzenia], linki prawne, „Ustawienia plików cookie” (tylko gdy są cookies wymagające zgody), informacja DEMO.

## 5. Linkowanie wewnętrzne

| Ze strony | Linkuje do | Po co |
|---|---|---|
| Główna | wszystkie kolekcje, pomieszczenia, gdzie kupić, doradca, promocje, poradniki, o nas, dla partnerów | rozdziela ruch na główne wejścia |
| Kolekcje | każda kolekcja, doradca, gdzie kupić | wybór kolekcji |
| Kolekcja | jej meble, jej pomieszczenia, kategorie jej typów, 3 podobne kolekcje, gdzie kupić z kolekcją | komplet i droga do sklepu |
| Meble | 16 kategorii, meble, promocje, doradca | zawężanie |
| Kategoria | jej meble, pomieszczenia, kolekcje z tym typem, poradnik | zapytania „rodzaj mebla” |
| Pomieszczenie | kolekcje i meble do pokoju, poradnik, doradca z pokojem | zapytania „meble do salonu” |
| Mebel | kolekcja, kategoria, pomieszczenia, komplet (6), gdzie kupić z kolekcją, poradnik o mierzeniu, doradca | decyzja i dobór reszty kompletu |
| Promocje | meble w promocji, kolekcje objęte promocją, gdzie kupić | zakup |
| Artykuł | kategoria, pomieszczenie, doradca, gdzie kupić, 2 inne artykuły | z wiedzy do oferty |
| Gdzie kupić | kolekcje sklepu, dla partnerów, poradnik o mierzeniu | przygotowanie do wizyty |
| Dla partnerów | strefa partnera, kolekcje, gdzie kupić, kontakt | B2B |
| O nas / Kontakt | kolekcje, gdzie kupić, dla partnerów, polityka prywatności | zaufanie i właściwy kontakt |
| 404 | kolekcje, meble, gdzie kupić, główna, kontakt | odzyskanie wizyty |

Zasady:

- Tekst linku mówi, dokąd prowadzi: „Zobacz kolekcję OLMO”, „Szafki RTV”, nie „kliknij tutaj”, „więcej”.
- Każdy mebel ma co najmniej 3 linki przychodzące: z kolekcji, z kategorii, z pomieszczenia (oraz z kompletów innych mebli).
- Linki do wyszukiwarki z parametrem (`/gdzie-kupic/?kolekcja=olmo`) mają ten sam adres kanoniczny — nie tworzą nowych stron w indeksie.
- Nie linkujemy do stron z filtrami w treściach redakcyjnych; wyjątek: `/meble/?promocje=1` z promocji.

## 6. Struktura treści w `src/content`

Treści są oddzielone od wyglądu i od danych. Dane (meble, ceny, sklepy) są w `src/data/` i docelowo przychodzą z Navireo i Excela.
Treści (teksty sekcji, SEO, FAQ, artykuły) są w `src/content/` i redaguje je człowiek.

```
src/content/
├── pages/
│   ├── site.json            elementy wspólne: marka, nawigacja, stopka, mikroteksty, ceny, stany, formularze, cookies, 404
│   ├── home.json            /
│   ├── kolekcje.json        /kolekcje/ + template dla /kolekcje/<slug>/
│   ├── meble.json           /meble/ (filtry, sortowanie, reguły adresów)
│   ├── kategorie.json       /meble/<kategoria>/ — 16 pozycji + template
│   ├── pomieszczenia.json   /pomieszczenia/ + 6 pozycji + template
│   ├── produkt.json         szablon /produkt/<slug>/
│   ├── promocje.json        /promocje/
│   ├── gdzie-kupic.json     /gdzie-kupic/
│   ├── dla-partnerow.json   /dla-partnerow/
│   ├── strefa-partnera.json /strefa-partnera/ (DEMO)
│   ├── doradca-wnetrz.json  /doradca-wnetrz/
│   ├── o-nas.json           /o-nas/
│   ├── kontakt.json         /kontakt/
│   └── poradnik.json        /poradnik/ + szablon artykułu
├── poradnik/
│   └── <slug>.md            artykuł (slug = nazwa pliku = adres)
└── legal/
    ├── polityka-prywatnosci.md
    └── regulamin.md
```

### 6.1 `pages/*.json`

| Pole | Znaczenie |
|---|---|
| `id` | identyfikator strony (= nazwa pliku) |
| `url` / `urlPattern` | adres strony albo wzorzec dla stron z danych (`/produkt/{slug}/`) |
| `status` | `draft` → `review` → `approved`; do produkcji tylko `approved` |
| `demo` | `true` = strona pokazuje baner DEMO |
| `seo.title`, `seo.description` | `<title>` (≤ 60) i meta description (≤ 155); wzorce z `{placeholder}` mają reguły skracania w `_notes` |
| `seo.jsonLd` | lista typów schema.org do wygenerowania |
| `seo.robots` | gdy inne niż domyślne `index, follow` |
| `h1` | nagłówek strony; może zawierać `<br>` — **zawsze ze spacją przed** |
| `sections[]` | sekcje w kolejności wyświetlania: `id` (kotwica), `type` (komponent), `title` (H2), `lead`/`text`, `items[]`, `cta`, `source` (skąd dane), `_notes` |
| `faq.title`, `faq.items[{q,a}]` | FAQ na dole strony: H2 = `title`, H3 = `q`; z tego samego źródła powstaje `FAQPage` |
| `template` | szablon dla stron generowanych z danych (kolekcja, kategoria, pomieszczenie) |
| `items[]` | (kategorie, pomieszczenia) treści dla każdej strony osobno: `slug`, `seo`, `intro`, `tips`, `faq`, `guide` |
| `urlRules` | reguły parametrów, canonical i noindex |
| `_note`, `_notes`, `_*` | notatki dla redakcji i programistów — **nie renderować** |

**Konwencje w tekstach:**

- `{nazwa}` — podstawia szablon (np. `{name}`, `{price}`, `{roomsList}`). Formy liczby mnogiej przez `site.plural` (`Intl.PluralRules('pl')`: `one`/`few`/`many`).
- `[tekst](/adres/)` — link Markdown w polach `a`, `text`, `lead`; renderowany jako `<a>`. Linki wewnętrzne zawsze z ukośnikiem na końcu.
- Wartość będąca ścieżką (np. `"consent": "site.forms.consent"`) — odwołanie do innego klucza zamiast kopii tekstu.
- `type` sekcji to nazwa komponentu: `hero`, `intro`, `text`, `features`, `steps`, `band`, `collections`, `rooms`, `categories`, `products`, `product-listing`, `promotions`, `finishes`, `facts`, `store-finder`, `store-results`, `form`, `explainer`, `rules`, `routing`, `contact-details`, `company`, `two-lists`, `links`, `articles`, `gallery`, `summary`, `dimensions`, `list`.
- Znaczniki **[do potwierdzenia]** i **[do uzupełnienia]** oznaczają brakujące fakty. Build produkcyjny ma **przerwać budowanie**, jeśli znajdzie je na stronie indeksowanej; build demo wyświetla je z wyróżnieniem.

### 6.2 `poradnik/*.md`

Markdown z frontmatter YAML:

| Pole | Znaczenie |
|---|---|
| `title` | H1 artykułu |
| `seoTitle` | `<title>` (≤ 60, z „\| Liveo”) |
| `slug` | adres `/poradnik/<slug>/` — musi być równy nazwie pliku |
| `description` | meta description (≤ 155) i tekst karty na liście |
| `date`, `updated` | `YYYY-MM-DD` → `datePublished`, `dateModified` |
| `author`, `authorNote` | „Redakcja Liveo” — [do potwierdzenia]; do czasu potwierdzenia w JSON-LD autorem jest organizacja |
| `readingTime` | minuty (słowa / ok. 180, w górę) |
| `keyTakeaway` | „Najważniejsze w jednym zdaniu” — **słowo w słowo** jak w treści; trafia też do `llms.txt` |
| `related` | slugi artykułów do „Przeczytaj też” |
| `links` | `category`, `room` — dokąd prowadzi CTA i gdzie artykuł jest polecany |
| `faq[{q,a}]` | pytania i odpowiedzi **słowo w słowo** jak w sekcji „Najczęstsze pytania” (H3) — źródło `FAQPage` |
| `factCheck` | (opcjonalnie) twierdzenia do sprawdzenia przed publikacją (normy, przepisy) |

Treść: lead → `**Najważniejsze w jednym zdaniu:** …` → H2 (pytania) → „Jakich błędów unikać?” → „Jak zabrać się do tego krok po kroku?” → „Najczęstsze pytania” (H3) → CTA.
Test treści (do dodania w buildzie) sprawdza: długości `seoTitle`/`description`, zgodność `keyTakeaway` i `faq[]` z treścią, liczbę słów (900–1300), kolejność nagłówków h1 → h2 → h3.
Kotwice nagłówków: slug bez polskich znaków („Jak zmierzyć wysokość wnęki?” → `#jak-zmierzyc-wysokosc-wneki`).

### 6.3 `legal/*.md`

Frontmatter: `title`, `seoTitle`, `slug`, `description`, `status: "wzor"`, `legalReview: "wymagana"`, `version`, `updated`, `effectiveFrom`.
Pierwszy blok cytatu („Wzór do weryfikacji przez prawnika — to nie porada prawna”) **usuwa się przed publikacją** — build produkcyjny ma przerwać budowanie, gdy `status` jest inny niż `zatwierdzony`.

## 7. SEO i GEO

### 7.1 Dane strukturalne — zasady wspólne

- Jeden blok `<script type="application/ld+json">` z `@graph` na stronę; `@id` stabilne (`https://<domena>/#organization`, `.../#website`, `<url>#breadcrumb`).
- Tylko dane widoczne na stronie. Bez ocen, opinii, nagród, liczby pracowników, roku założenia — dopóki klient ich nie potwierdzi.
- `FAQPage` — tylko gdy FAQ jest widoczne na stronie. Google pokazuje FAQ w wynikach już tylko wybranym serwisom, ale znacznik porządkuje pytania i odpowiedzi dla wyszukiwarek i asystentów AI.
- Ceny w JSON-LD = ceny w HTML z dnia budowy. Po każdej zmianie cen lub promocji strona się przebudowuje (patrz `navireo-integracja.md`).

### 7.2 GEO — widoczność w ChatGPT, Perplexity i podobnych

- **Odpowiedź w pierwszym zdaniu** — w FAQ, poradnikach i wstępach stron (patrz `brief.md`, rozdz. 7).
- **Fakty w HTML, nie tylko w JS** — wymiary, ceny, kolory, sklepy są w statycznym HTML; JS je tylko odświeża.
- **Spójne nazwy** — „Szafka RTV 160 OLMO” wszędzie tak samo: w H1, title, JSON-LD, `llms.txt`, katalogu doradcy.
- **Tabele z wymiarami** jako `<table>`, nie obrazki.
- **Daty aktualizacji** widoczne na poradnikach i przy cenach.
- **`robots.txt`:** zezwala wyszukiwarkom i botom wyszukiwania AI (np. `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`), blokuje `/strefa-partnera/` i `/api/`. Zgoda na boty trenujące modele (np. `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`) — [do decyzji klienta].
- **`sitemap.xml`:** wszystkie strony indeksowane z `lastmod` (dla mebli — data ostatniej zmiany ceny lub danych).

### 7.3 `llms.txt`

Plik `/llms.txt` (format z propozycji llmstxt.org: Markdown, H1, krótki opis w cytacie, sekcje z listami linków) generowany przy budowie z `src/data/` i `src/content/`.
Ma dać modelowi językowemu w jednym miejscu: kim jest Liveo, jak się kupuje, jakie są kolekcje i gdzie są szczegóły. **Bez cen** (zmieniają się — model ma odesłać do strony mebla), bez strefy partnera, bez danych demo w wersji produkcyjnej.

Zawartość:

1. H1 „Liveo Meble” i opis w jednym akapicie: producent mebli skrzyniowych i systemowych z Raniżowa; meble w kolekcjach; brak własnych salonów — sprzedaż przez sklepy partnerskie; strona nie sprzedaje online.
2. **Jak kupić** — link do `/gdzie-kupic/` z jednym zdaniem o wyszukiwaniu po kodzie pocztowym; link do `/promocje/` z zasadą Omnibus.
3. **Kolekcje** — każda: link + `tagline` + pomieszczenia + kolory.
4. **Rodzaje mebli** — 16 linków do kategorii z liczbą mebli.
5. **Pomieszczenia** — 6 linków z opisem z `rooms.json`.
6. **Poradnik** — 4 linki z `keyTakeaway`.
7. **Firma** — O nas, Kontakt, Dla partnerów, Doradca wnętrz (z informacją, że to asystent AI).
8. **Optional** — polityka prywatności, regulamin, `llms-full.txt`.

Przykład (początek):

```markdown
# Liveo Meble

> Liveo Meble sp. z o.o. to polski producent mebli skrzyniowych i systemowych z Raniżowa (Podkarpacie).
> Meble są projektowane w kolekcjach — szafka RTV, komoda, witryna czy szafa z jednej kolekcji mają te same kolory i uchwyty.
> Liveo nie ma własnych salonów i nie sprzedaje mebli na tej stronie: meble kupuje się w sklepach partnerskich.

## Jak kupić
- [Gdzie kupić](https://<domena>/gdzie-kupic/): wyszukiwarka sklepów partnerskich po kodzie pocztowym, z filtrem kolekcji.
- [Promocje](https://<domena>/promocje/): aktualne obniżki; przy każdej podana najniższa cena z 30 dni przed obniżką.

## Kolekcje
- [OLMO](https://<domena>/kolekcje/olmo/): Dekor jasnego dębu, spokojne proporcje i drewniane nóżki. Salon, jadalnia, sypialnia.
- …

## Poradnik
- [Jak zmierzyć wnękę pod szafę](https://<domena>/poradnik/jak-zmierzyc-wneke-pod-szafe/): Zmierz szerokość, wysokość i głębokość wnęki w kilku miejscach…
```

`/llms-full.txt` — opcjonalnie: pełna treść poradników i wszystkie FAQ w jednym pliku Markdown (bez cen).

## 8. Przekierowania ze starej strony

Stara strona liveomeble.pl ma inną strukturę adresów. Przed startem: pełna lista adresów (crawl starej strony + adresy z Google Search Console) → mapa 301.
Znane adresy kategorii (z kodu prototypu doradcy — [niezweryfikowane]):

| Stary adres | Nowy adres |
|---|---|
| `/4-pokoj-dzienny` | `/pomieszczenia/salon/` |
| `/5-jadalnia` | `/pomieszczenia/jadalnia/` |
| `/8-sypialnia` | `/pomieszczenia/sypialnia/` |
| `/7-pokoj-mlodziezowy` | `/pomieszczenia/pokoj-mlodziezowy/` |
| `/9-przedpokoj` | `/pomieszczenia/przedpokoj/` |
| `/10-biuro` | `/pomieszczenia/biuro/` |
| `/143-zestawy-kuchenne` | [do decyzji: kuchnie — `/kolekcje/` albo przyszła strona kuchni] |
| `/kontakt` | `/kontakt/` |
| strony produktów | odpowiednik `/produkt/<slug>/` po imporcie danych; brak odpowiednika → kategoria |

## 9. Rozbudowa w przyszłości

- **Sprzedaż online** (decyzja otwarta): `/koszyk/`, `/zamowienie/`, `/konto/`; przycisk „Dodaj do koszyka” obok „Gdzie kupić” na karcie mebla; `Offer.availability` zmienia się na stany online; regulamin sklepu jako osobny dokument.
- **Wersje językowe:** prefiks języka, `hreflang`, osobne pliki treści (`src/content/<lang>/`).
- **Strony sklepów partnerskich** (`/gdzie-kupic/<miasto>/<sklep>/`) — po zgodzie partnerów; dobre dla zapytań lokalnych („meble Liveo Rzeszów”).
- **Kuchnie** — `/pomieszczenia/kuchnia/` i kategorie kuchenne, jeśli klient je potwierdzi.
