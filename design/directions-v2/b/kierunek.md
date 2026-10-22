# Kierunek B: Pełny kadr

Nowoczesny lifestyle w duchu Kave Home, ale jaśniejszy i bardziej rodzinny.

## Nastrój
Współczesny, pewny siebie i „zamieszkany”. Stronę niosą duże zdjęcia w dziennym świetle, a interfejs jest czarno-biały i mało widoczny. Kolor pochodzi tylko ze zdjęć i wykończeń mebli. Nazwy kolekcji (OLMO, TALVE, SOLMA) są składane jak plakat, a ceny i promocje stoją zawsze pod zdjęciem albo na jednolitym piasku, nigdy na zdjęciu.

W 3 sekundy widać:
- że to meble: zdjęcie pokoju na pełną szerokość;
- że Liveo sprzedaje kolekcje: hasło i wielkie nazwy kolekcji;
- gdzie kupić: pinezka „Gdzie kupić” w nagłówku i pole kodu pocztowego tuż pod zdjęciem, widoczne na pierwszym ekranie.

## Paleta
| Token | Hex | Do czego |
|---|---|---|
| Biel | `#FFFFFF` | tło |
| Piasek | `#F2EEE7` | pasek ogłoszeń, tło packshotów, pas z kodem, „Znajdź salon” |
| Atrament | `#161514` | tekst (18:1), przyciski główne, pas B2B i stopka |
| Szary | `#5F5A54` | teksty pomocnicze, linia Omnibus (6,8:1 na bieli) |
| Kamień | `#D9D2C7` | linie 1 px, placeholdery zdjęć |
| Obrys pól | `#8A8279` | dolna linia pól (3,8:1) |
| Czerwień makowa | `#C21F32` | cena promocyjna, plakietka rabatu (5,9:1) |
| Oliwka | `#55602E` | plakietka „Nowość”, wyróżnienie w pasku ogłoszeń (6,8:1) |
| Logo | `#2B2A29` | oryginalny kolor logo na białym nagłówku |

## Fonty
Oba są self-hosted (woff2, latin + latin-ext, `font-display: swap`), pliki leżą w `fonts/`.
- **Albert Sans** (zmienny 100–900) obsługuje cały interfejs. H1 ma 76/74 px przy 500, a na telefonie 44 px. H2 ma 44/48 px, a na telefonie 30/34 px. Nazwa kolekcji w plakacie ma 120 px przy −0,04em, a na telefonie 56 px. Menu ma 16/500, tekst 17/27, cena 19/600.
- **Brygada 1918**, kursywa: tylko zdania prowadzące pod H1 i H2 oraz taglines kolekcji (22/32, na telefonie 19/28).

## Wzorce i co z nich wzięte
- **kavehome.com/pl** (wzorzec główny):
  - hero na pełną szerokość z wielkim hasłem w lewym dolnym rogu i białym prostokątnym przyciskiem;
  - para groteska + szeryf;
  - karuzela wysokich kafli 4:5 z podpisem pod zdjęciem, z widocznym fragmentem następnego kafla;
  - bloki 50/50;
  - rytm „pełna szerokość ↔ kontener” ze szczeliną 8 px;
  - pasek ogłoszeń na jasnym tle;
  - pole „Szukaj” jako podkreślona linia.

  Odrzucone: ciemne, nastrojowe kadry.
- **vitra.com**:
  - podpisy i ceny zawsze pod zdjęciem;
  - pinezka „Gdzie kupić” w samym nagłówku;
  - jeden geometryczny krój w całym interfejsie.
- **normann-copenhagen.com**: nazwa jako ogromny napis plakatowy. Tak pokazujemy nazwy kolekcji, które przy wejściu w widok przesuwają się o 24 px.

## Co jest na szkicu
- Pasek ogłoszeń z promocją OLMO.
- Biały, nieprzezroczysty nagłówek sticky, który chowa się przy przewijaniu w dół. Ma mega-menu „Meble” po najechaniu albo przy fokusie.
- Hero (render salonu, LCP z `fetchpriority=high`) i pas z kodem pocztowym oraz przyciskiem „Użyj mojej lokalizacji”. O lokalizację pytamy dopiero po kliknięciu.
- 3 plakaty kolekcji: aranżacja i packshot z ceną na piasku, wielka nazwa, tagline, „12 mebli w 3 kolorach · od 211 zł” i dwa przyciski.
- Karuzela pozostałych 5 kolekcji.
- 4 karty produktów. Jedna jest w promocji: −15%, cena przekreślona i linia „Najniższa cena z 30 dni przed obniżką”. Karty mają kwadraty wykończeń, a po najechaniu pokazują aranżację.
- Blok 50/50 „Doradca wnętrz”.
- „Znajdź salon partnerski” z polem kodu i opisem, jak kupić.
- Pas B2B na atramencie i stopka z danymi LIVEO Meble, ul. Borki 5, Raniżów.

Na telefonie układ jest osobny:
- nagłówek 60 px (hamburger, logo, pinezka, lupa);
- pionowy kadr hero i biały przycisk na całą szerokość;
- w plakatach tylko aranżacja 4:5, a przyciski jeden pod drugim;
- kafle karuzeli na 78% szerokości;
- produkty w 2 kolumnach.

## Czym się wyróżnia
- **Zdjęcie jest interfejsem.** Kierunek prawie nie ma własnej grafiki: nie ma ornamentów, ramek, ikon dekoracyjnych ani kolorowych teł sekcji. Sekcje oddziela światło (72–112 px), nie linie. Kolor dają meble i ściany na zdjęciach.
- **Kolekcja jest bohaterem, a nie produkt.** Wielkie nazwy (OLMO, TALVE, SOLMA) działają jak okładki, a pod nimi od razu stoją liczba mebli, liczba kolorów i cena „od”.
- **„Gdzie kupić” jest na pierwszym ekranie dwa razy:** pinezka w nagłówku i pole kodu pocztowego pod hero. To odpowiada modelowi sprzedaży przez salony partnerskie.
- **Ostra geometria.** Promień wynosi 0 wszędzie: zdjęcia, przyciski, pola, plakietki i kwadraty wykończeń. Jedyny cień ma mega-menu.

Celowo unikamy:
- mono i wersalików w etykietach;
- numeracji „01 —”;
- pigułek i szkła;
- gradientu w tekście;
- niebieskiego akcentu;
- ciemnego hero z wideo;
- kremu z terakotą.

## Ryzyko i uwagi
- Styl stoi na zdjęciach z ludźmi w jasnym, dziennym świetle. Potrzebna jest jedna sesja lifestyle (6–10 kadrów do hero i plakatów). Do tego czasu szkic używa renderów z silnika.
- Rendery są jaśniejsze niż zdjęcia, więc scrim w hero jest mocniejszy niż w briefie: do 0,58 przy dole, na 62% wysokości. Zmierzony kontrast białego H1 wynosi co najmniej 3,2:1 w najjaśniejszym punkcie, a w zdaniu pod H1 co najmniej 5:1. Przy prawdziwych zdjęciach scrim można zmniejszyć do 0,45 na 40% wysokości.
- Packshoty mają cień przycięty na krawędzi pliku. Na szkicu krawędzie wygaszamy maską. Docelowo trzeba je eksportować z marginesem.
- Liczby na stronie (meble, kolory, ceny) pochodzą z danych demo `src/data/*.json`. Nie ma na niej żadnych liczb o firmie.
