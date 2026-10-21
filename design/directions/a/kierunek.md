# Kierunek A — „Wzornik”

**Materiał i warsztat.** Strona działa jak wzornik producenta: prawdziwe próbki wykończeń (słoje dębu, orzech, kolory matowe) prowadzą przez stronę, a każda aranżacja ma „metryczkę” — etykietę, jaką producent nakleja na tył mebla.

## Nastrój
Spokojny, rzeczowy, ciepły od materiału, nie od filtra. Jak dobrze zrobiony katalog z fabryki: duże zdjęcia wnętrz, dużo powietrza, konkretne podpisy. Duma z Raniżowa bez wielkich słów — fakty w „metryce producenta” zamiast haseł.

## Paleta — każdy kolor to wykończenie z katalogu (`src/data/finishes.json`)
| Rola | Wykończenie | Hex |
|---|---|---|
| Tło strony | Biały mat | `#EEECE8` |
| Metryczki, pola | Biały połysk | `#F7F6F3` |
| Tła packshotów | cień płyty | `#E3E0D9` |
| Tekst, przyciski | Czarny mat | `#222223` (13,5:1) |
| Tekst drugorzędny | Grafit | `#4A4B4D` (7,4:1) |
| Akcent graficzny | Dąb miodowy | `#B07B45` (linie, aktywna próbka; nie do drobnego tekstu) |
| Akcent w tekście | dąb miodowy przyciemniony | `#7A4F22` (6:1) |
| Drugi akcent | Szałwia | `#9AA58F` (powierzchnie, próbki) |

Słoje na próbkach są generowane tym samym silnikiem co rendery (`tools/render/web/js/textures.js`), więc próbka i mebel na zdjęciu mają ten sam rysunek drewna. Po sesji zdjęciowej podmieniamy je na skany prawdziwych płyt.

## Fonty
- **Bricolage Grotesque** (zmienny, oś optycznego rozmiaru 12–96) — nagłówki i tekst. W dużych rozmiarach ma wyraźny, lekko „ręczny” charakter (ścięcia, zwarte proporcje), w małych jest spokojny i czytelny. Ciepły grotesk zamiast szeryfu — nie wchodzimy w kliszę „kremowe tło + szeryf”.
- **IBM Plex Mono** — kody wykończeń (DN, KA-DN), etykiety, metryczki. Głos techniczny katalogu: tak producent opisuje płytę, indeks, wymiar.
- Oba z polskimi znakami, self-hosted (woff2, latin + latin-ext przez `unicode-range`, `font-display: swap`). Łącznie ok. 164 kB (Bricolage ok. 108 kB, bo jest zmienny z osią opsz). W produkcji przycinamy go do znaków PL i używanych grubości, cel poniżej 70 kB.

## Zdjęcia
Duże aranżacje w naturalnym, bocznym świetle dnia, bez ludzi; meble pokazane w całości, z powietrzem nad nimi. Packshoty na przezroczystym tle stoją na „płycie” w odcieniu wykończenia kolekcji. Docelowo: zdjęcia z jednej sesji, ta sama wysokość kamery i to samo światło w całym katalogu.

## Układ i ruch
- Asymetryczny układ 5/7: tekst i akcje po lewej, zdjęcie spada do prawej krawędzi ekranu. Na dole zdjęcia wysuwa się listwa próbek. Wybór próbki zmienia aranżację i metryczkę.
- Pod hero „metryka producenta”: cztery fakty bez liczb (gdzie produkujemy, z czego, gdzie kupić, co dla sklepów).
- Kolekcje to karty-wzory: packshot na płycie, nazwa, kody wykończeń jako mini próbki (front + blat), pomieszczenia.
- Telefon: zdjęcie na pełną szerokość, próbki pod kciukiem, wyszukiwarka sklepu pod zdjęciem, kolekcje w poziomej karuzeli ze snapem (bez poziomego scrolla strony).
- Ruch „szuflada z cichym domykiem”: szybki start i długie, miękkie wyhamowanie (`cubic-bezier(.22,.8,.16,1)`). Próbki wysuwają się z lekkim dobiegiem. Tylko transform i opacity, bez odczytu układu przy ładowaniu. `prefers-reduced-motion` wyłącza animacje.

## Czym różni się od Forte
Forte to sklep masowy: siatki produktów, ceny i promocje na pierwszym planie, czerwone etykiety. „Wzornik” mówi głosem producenta: najpierw materiał, wykończenie i komplet, potem sklep partnerski. Zamiast „kup teraz” mamy próbki i metryczki. Tak pokazuje się meble w salonie wystawowym, a nie w ulotce.

## Ryzyka
- **Rendery zamiast zdjęć**: koncept stoi na jakości materiału. Bez dobrych zdjęć i skanów płyt traci sens.
- **Próbki ≠ realne kolory**: kolor na ekranie zawsze trochę się różni. Potrzebny dopisek „kolor na ekranie może się różnić” przy wzorniku.
- **Bricolage** w dużych stopniach jest charakterny; wymaga pilnowania długości nagłówków (do ok. 7 słów).
- **Mono** w nadmiarze robi się „techniczne”, więc używamy go tylko do kodów, etykiet i metryczek.
- **Wydajność**: szkic używa renderów 2400 px (JPG). W produkcji obowiązkowo AVIF/WebP z `srcset`; pozostałe aranżacje wzornika ładujemy dopiero przy kontakcie z próbkami (tak jest już w szkicu).
- **Podpisy aranżacji** (kolekcja / mebel) w szkicu są przybliżone do danych demo i trzeba je potwierdzić.

## Placeholdery
- Znak słowny „LIVEO” z próbką dębu miodowego to **placeholder** (nie mamy logo klienta).
- Fakty w metryce producenta: „Projekt i produkcja: Raniżów” **[do potwierdzenia]** (czy cała produkcja jest w Raniżowie).
- Nazwy kolekcji, wykończenia i aranżacje są demo (`src/data`).
