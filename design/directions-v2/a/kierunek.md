# Kierunek A: Jasny katalog kolekcji (w duchu Forte)

Szkic: `design/directions-v2/a/index.html` (jedna strona, CSS w pliku, fonty w `fonts/`).

## Nastrój
Jasny, ciepły i uporządkowany katalog producenta. Ma przypominać dobrze urządzony salon meblowy w sobotnie przedpołudnie: dużo dziennego światła, ceny od razu na widoku, a kolekcje na pierwszym planie. Strona jest handlowa, ale nie krzyczy. Od Forte bierzemy logikę sklepu: kolekcje, polecane meble, rodzaje mebli i salony. Poprawiamy typografię, hero i ikony.

Znak rozpoznawczy pochodzi z logo Liveo. Grafitowa plakietka hasła w hero ma lewy bok ścięty pod kątem 26°, tak jak czarny pasek „Meble” w logo. Ten sam ścięty pasek, tylko w malinowym kolorze, służy jako plakietka rabatu „−15%”.

## Paleta
| Kolor | Hex | Użycie |
|---|---|---|
| Biel | `#FFFFFF` | tło strony i kart |
| Len | `#EFE9E1` | pas nagłówka, co druga sekcja (Kolekcje, Gdzie kupić), kafle usług, tło packshotów. Nigdy nie jest tłem całej strony. |
| Grafit | `#2B2A29` | tekst (14,3:1), plakietka hasła, przyciski drugorzędne, pas B2B. To kolor z SVG logo. |
| Ciepły szary | `#6B655E` | wymiary, opisy, linia Omnibus (5,8:1 na bieli, 4,8:1 na lnie) |
| Miód | `#F2C14E` | główny przycisk z grafitowym napisem (8,5:1), okrągła lupa, kreska pod pozycją menu, fokus na ciemnym tle. Nigdy nie jest kolorem tekstu. |
| Malina | `#C4303B` | cena promocyjna, plakietka rabatu (biały napis, 5,5:1), „Promocja do 31.10” |
| Butelkowa zieleń | `#2E6A48` | plakietka „Nowość” (6,4:1) |
| Obrys pól | `#8C857D` | 3:1 na lnie, 3,6:1 na bieli |

Cień `0 12px 32px rgba(43,42,41,.12)` pojawia się tylko w mega-menu. Sekcje oddziela zmiana tła, a nie linie.

## Fonty (self-hosting woff2, latin + latin-ext, `font-display: swap`)
- **Newsreader** (`@fontsource-variable/newsreader`, osie opsz i wght) do nagłówków. Grubość 300 przy dużym rozmiarze daje cienki, elegancki szeryf o charakterze IvyPresto Light z Forte. H1 54/58 px (telefon 34/38), H2 38/44 px wyśrodkowane (telefon 28/34), nazwa kolekcji 24/30 px w grubości 400. Preload dotyczy tylko pliku latin.
- **Jost** (`@fontsource-variable/jost`) do tekstu i interfejsu. To geometryczny krój zgrany z cienkim napisem LIVEO. Menu 16/500, tekst 17/27, nazwa mebla 16/22/500, wymiary 14/20, cena 20/600 (telefon 18), plakietki 13/600.
- Wersalikami piszemy tylko nazwy kolekcji (OLMO, SOLMA…). W szkicu nie ma kroju mono ani małych etykiet pisanych wersalikami.

## Wzorce i co z nich wzięliśmy
- **forte.com.pl**: układ sklepu (hero, kolekcje, hity, rodzaje mebli, salony), beżowy pas nagłówka, cienki szeryf w wyśrodkowanych nagłówkach sekcji, karta z wymiarami i ceną przekreśloną, okrągła żółta lupa w polu wyszukiwania i na telefonie. Nie wzięliśmy hero-karuzeli z uciętymi slajdami, mieszanki szeryfu z Arialem, wersalików „PROMOCJE” ani clipartowych ikon (zastąpiły je packshoty na lnie).
- **szynaka.pl**: „Gdzie kupić?” z pinezką zawsze widoczne w nagłówku. Kolekcje są główną sekcją strony.
- **ikea.com/pl**: kod pocztowy blisko nagłówka (kafel „Gdzie kupić” z polem `__-___` zaraz pod hero) i spójny system etykiet ceny i nowości (maks. 2 plakietki na karcie).
- **agata.pl**: termin promocji przy karcie („Promocja do 31.10”) i dolny pasek pod kciuk na telefonie (Meble · Kolekcje · Gdzie kupić · Doradca), bez pływającego czatu.

## Co działa w szkicu
- Nagłówek przykleja się do góry. Po 120 px pasek pomocniczy znika, a widoczny rząd ma 64 px (tylko transform i opacity, IntersectionObserver, bez czytania layoutu).
- Mega-menu „Meble” (8 packshotów i lista pozostałych rodzajów) i „Kolekcje” (8 miniatur z ceną „od”) otwierają się po najechaniu, kliknięciu i z klawiatury. Zamyka je Esc.
- Kółka wykończeń mają pole dotyku 32 px. Kliknięcie zmienia nazwę wykończenia i parametr `?kolor=` w adresie.
- „Gdzie kupić” liczy 3 najbliższe salony z `resellers.json` i `postcodes.json` (dane przykładowe) i zapisuje w nagłówku „3 salony przy 36-…”.
- Po najechaniu karta kolekcji płynnie przechodzi na drugą aranżację (300 ms), a karta produktu na packshot na lnie. Zdjęcie przybliża się do 1,03 (600 ms). Przy `prefers-reduced-motion` ruchu nie ma.
- Telefon ma osobny projekt: nagłówek 60 px, pionowy kadr hero 4:5, a plakietka hasła stoi pod zdjęciem i ma ścięty róg. Pas usług ma układ 2 × 2. Widać 4 kolekcje i przycisk „Pokaż wszystkie 8”. Produkty są w 2 kolumnach. Menu zajmuje cały ekran i ma 8 miniatur kolekcji. Na dole jest pasek 64 px.

## Czym różni się od pozostałych kierunków
To najbardziej „sklepowy” z trzech kierunków. Jasne tło, ceny i promocje widać już na pierwszym ekranie, a układ jest znajomy dla klienta Forte, Agaty czy IKEA. Ten kierunek nie stawia na nastrój magazynu wnętrzarskiego, tylko na szybkie znalezienie kolekcji, ceny i najbliższego salonu. Charakter marki budują cienki szeryf Newsreader i ścięty pasek z logo Liveo, a nie ozdobniki.

## Do decyzji i produkcji
- Wyszukiwarka tekstowa: jeśli klient ją zatwierdzi, pole działa na statycznym indeksie (np. Pagefind: 87 mebli i 8 kolekcji, ładowany dopiero po kliknięciu). Jeśli nie, w tym miejscu nagłówka stoi pole kodu pocztowego.
- Zdjęcia to atrapy-rendery. W produkcji hero będzie w AVIF/WebP z `srcset` i `fetchpriority="high"` (już ustawione), a karty w kilku szerokościach.
- Adresy salonów w szkicu są przykładowe. Odległości liczymy w linii prostej od środka okręgu pocztowego.
