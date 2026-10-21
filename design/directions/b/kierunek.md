# Kierunek B — „Wymiar”

Galeria i pracownia architekta. Aranżacja wisi na kredowej ścianie jak eksponat, a meble mają wymiary naniesione cienką linią, tak jak na rysunku technicznym. Strona pokazuje, że meble Liveo projektuje się w kolekcjach i że pasują do siebie „co do centymetra”. Jest spokojna i rzeczowa. Nie udaje katalogu wnętrzarskiego lifestyle.

## Nastrój
Chłodny, cichy, precyzyjny, ale nie sterylny: ciepło dają zdjęcia z drewnem. Dużo kredowej bieli, grafit, ścisła siatka 12 kolumn i linie włosowe zamiast ramek i kart.

## Paleta
| Rola | Hex | Uwagi |
|---|---|---|
| Kreda (tło) | `#F3F3F1` | lekko chłodna biel, nie kremowa |
| Papier (etykiety, pola) | `#FBFBFA` | |
| Kamień (cokół pod packshoty) | `#E7E8E5` | |
| Linia włosowa | `#CDD0CD` / `#9EA29F` | podziały i obrysy pól |
| Grafit (tekst, przyciski) | `#24272B` | 13,5:1 na kredzie |
| Grafit drugorzędny | `#5D6166` | 5,6:1 na kredzie (AA) |
| **Minia (akcent)** | `#C23A16` | kolor farby podkładowej na stali i korekty kreślarskiej; 4,8:1 na kredzie (AA). Tylko linie wymiarowe, indeksy i znacznik „Promocje”. |

Jeden akcent, używany zawsze w tej samej roli („tu jest wymiar albo numer”). Nie jest niebieski ani zielony. Nasycona minia na chłodnym szarym tle nie przypomina kliszy terakota + krem.

## Fonty (2 rodziny, self-hosted woff2, latin + latin-ext)
- **Archivo** (zmienny: grubość + szerokość, OFL): nagłówki i tekst. Oś szerokości to narzędzie układu. Na desktopie H1 ma szerokość 108%, a nazwy kolekcji i znak słowny 125%, co daje architektoniczny, rozstrzelony charakter. Na telefonie H1 zwęża się do 92%, więc to inny krój w praktyce, a nie pomniejszony desktop.
- **Martian Mono** (zmienny, OFL): wymiary („180 × 50 × 40 cm”), indeksy „01–04”, etykiety. Ma cyfry tabelaryczne i techniczny, lekko szeroki rysunek, bez skojarzenia z edytorem kodu.
- Polskie znaki sprawdzone na zrzutach. **Ryzyko wydajności:** pliki zmienne Archivo ważą ok. 90 + 86 KB. Na produkcji trzeba je przyciąć (pyftsubset do latin + polskich znaków, a w razie potrzeby zamrozić 2–3 instancje), żeby utrzymać PageSpeed 98–100.

## Zdjęcia
Duże, spokojne kadry aranżacji z jednym głównym meblem i wolną ścianą. Na desktopie zdjęcie jest przycięte panoramicznie od góry. Na telefonie używamy osobnego kadru pionowego (*-tall), przyciętego od góry prawie do kwadratu, od krawędzi do krawędzi: dzięki temu mebel z wymiarami mieści się już na pierwszym ekranie. Na zdjęcie nakładamy **linie wymiarowe** dopasowane do mebla w kadrze (szerokość i wysokość). Packshoty stoją na jednolitym „cokole” w kolorze kamienia, a pod każdym jest linia z szerokością w cm. Wymaga to stałego kadrowania zdjęć klienta: mebel główny w dolnej połowie, wolna ściana.

## Układ
Ścisła siatka 12 kolumn, hierarchia przez skalę i szerokość kroju, a nie przez kolor. Hero: H1 i lead nad zdjęciem, a na zdjęciu **tabliczka jak w galerii** („Ryc. 01 · Salon”, nazwa mebla, wymiary). Tabliczka zawiera od razu wyszukiwarkę sklepu po kodzie pocztowym (z ikoną „użyj mojej lokalizacji” tylko za zgodą), bo ścieżka „widzę mebel → gdzie go zobaczę” jest głównym celem B2C. Na desktopie tabliczka leży na zdjęciu. Na tablecie i telefonie schodzi pod zdjęcie, żeby nie zasłaniać mebla. Pas kolekcji na desktopie ma 4 kolumny w rytmie numerowanych eksponatów. Na telefonie to lista-indeks (miniatura po lewej, opis po prawej), w której widać wszystkie cztery kolekcje bez przewijania w bok.

## Ruch
Linie wymiarowe „kreślą się” (scaleX/scaleY, własna krzywa `cubic-bezier(.7,0,.2,1)`), zdjęcie osiada ze skali 1,035, a tekst wchodzi o 14 px. Animujemy tylko transform i opacity. Kody pocztowe formatujemy bez odczytu układu. Przy `prefers-reduced-motion` wszystko od razu jest w stanie końcowym.

## Czym różni się od Forte
Forte to marka masowa: sklepowa siatka produktów, ceny i plakietki promocji na pierwszym planie, dużo elementów naraz. „Wymiar” pokazuje jeden mebel w jednej aranżacji, mówi językiem projektanta (wymiary, proporcje, komplet) i od pierwszego ekranu prowadzi do sklepu partnera, a nie do koszyka. Liveo wygląda tu jak producent, który wie, co robi, a nie jak dyskont.

## Ryzyka
- Linie wymiarowe trzeba ręcznie dopasować do każdego zdjęcia hero (współrzędne w %, osobno dla kadru szerokiego i pionowego). Przy podmianie zdjęć to dodatkowa praca albo pole w CMS.
- Chłodna paleta może wydać się zbyt „techniczna” rodzinom szukającym przytulności. Równoważą to ciepłe zdjęcia drewna, więc zdjęcia muszą być dobrej jakości.
- Wymiary na zdjęciu muszą zgadzać się z danymi z ERP/Excela. Błąd o 2 cm od razu podważa wiarygodność.
- Znak słowny „LIVEO” z linią wymiarową to **placeholder**: nie mamy pliku logo.
- Mebel na zdjęciu hero (NOKTA RTV 180), liczby mebli w kolekcjach i nazwy kolekcji pochodzą z danych demo (fikcyjnych). Zdjęcia to rendery poglądowe.
