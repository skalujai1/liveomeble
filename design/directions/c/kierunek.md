# Kierunek C — „Dom w pokojach”

Strona prowadzi tak, jak urządza się mieszkanie: pokój po pokoju. Każde pomieszczenie ma własny, stonowany ton. Przełączasz salon na sypialnię, a hero przechodzi w inny kolor, jakbyś wszedł do innego pokoju. Zdjęcia aranżacji są oprawione w łuk drzwi, a wyszukiwarka sklepu po kodzie pocztowym jest od razu w pierwszym ekranie.

## Nastrój
Przyjazny, rodzinny, spokojny. Czysto, bez słodkości. Miękkie formy (łuk, zaokrąglone kontrolki), dużo powietrza, duże zdjęcia. Strona ma być czytelna dla każdego domownika, od rodzica z telefonem w ręku po dziadków.

## Paleta
| Rola | Hex | Uwagi |
|---|---|---|
| Biel ściany (tło) | `#FBFAF7` | prawie biel, nie krem |
| Atrament (tekst) | `#2A2327` | ciepły grafit z nutą śliwki |
| Tekst drugorzędny | `#574E54` | AA na bieli i na każdym tonie pokoju |
| Śliwka (akcent) | `#5C2950` | przyciski, fokus, „O” w logo, promocja; jedyny mocny kolor |
| Śliwka jasna | `#F2E8EF` | tło przycisku „Doradca wnętrz” |

Tony pomieszczeń (tło i kolor ciemny do tekstu w tym pokoju):

| Pokój | Tło | Ciemny |
|---|---|---|
| Salon | `#E2E6DA` szałwiowa mgła | `#4E5C45` |
| Sypialnia | `#E5E1EA` wieczorny lila | `#5A4F6B` |
| Jadalnia | `#F0E4D6` jasny dąb | `#7E5131` |
| Pokój młodzieżowy | `#ECE8D3` len | `#625A22` |
| Przedpokój | `#EEE0DB` glina | `#804A43` |
| Domowe biuro | `#DEE5E8` mglisty błękit | `#405B67` |

Tony są wzięte z wnętrz na zdjęciach (ściana w szałwii, kaszmir, dąb), więc zdjęcie i tło tworzą jedno pomieszczenie. Każdy kolejny pokój dostaje swój ton, zawsze z tym samym atramentem i tą samą śliwką.

Wszystkie pary tekst/tło spełniają WCAG AA: atrament 11,9–12,5:1, tekst drugorzędny 6,2–6,5:1, kolor pokoju na jego tle 5,4–5,9:1, biały na śliwce 11,1:1.

## Fonty
- **Parkinsans** (zmienny 300–800, OFL): nagłówki, nazwy kolekcji, logo. Krój ma okrągłe, otwarte litery i miękkie zakończenia. Jest przyjazny, ale dorosły. Nie ma go w typowych szablonach.
- **Figtree** (zmienny 300–900, OFL): tekst, menu, formularze. Bardzo czytelny w małych rozmiarach i na telefonie.
- Self-hosted woff2, osobno latin i latin-ext (`unicode-range`), `font-display: swap`. Polskie znaki sprawdzone na screenshotach.

## Logo
**Placeholder.** Znak słowny „LIVEO” złożony w Parkinsans. Ostatnie „O” jest narysowane jako drzwi z zaokrągloną górą, w kolorze śliwki. To pomysł do rozwinięcia z projektantem znaku, nie gotowe logo.

## Zdjęcia
Aranżacje w pionowym kadrze (`*-tall.jpg`), oprawione w łuk drzwi. Jasne, dzienne światło, prawdziwe pokoje, bez ludzi ze stocku. Packshoty z przezroczystym tłem leżą na tonie pokoju, do którego pasuje dany mebel. Na sesji zdjęciowej warto dobierać kolor ściany do tonu pomieszczenia.

## Układ
- **Hero to pokój.** Panel w tonie pomieszczenia to ściana. Zdjęcie aranżacji jest w niej wycięte jak drzwi: łuk u góry, a dół „stoi na podłodze”, czyli dotyka dolnej krawędzi panelu. Na łuku wisi tabliczka z nazwą pokoju i mebla. Jest na ścianie, nie na meblu.
- Po lewej mówimy, kim jesteśmy (producent z Raniżowa) i co tu zrobisz („Urządź dom pokój po pokoju”). Pod spodem jest wyszukiwarka sklepu: kod pocztowy z automatycznym myślnikiem, a lokalizacja tylko po kliknięciu i za zgodą. W szkicu działa na danych demo z `src/data` i pokazuje 3 najbliższe sklepy.
- Nad drzwiami jest przełącznik „Zajrzyj do pokoju”. Każdy pokój ma znaczek w kształcie drzwiczek w swoim kolorze. Kliknięcie zmienia ton ściany, zdjęcie i tabliczkę.
- **Doradca wnętrz** ma stały przycisk w nagłówku i drugą ścieżkę pod wyszukiwarką („Wyślij zdjęcie swojego pokoju”). Nie zasłania mebli na zdjęciu.
- **Kolekcje:** 4 kafle w tonach pokoi, a na nich tylko mebel (packshot), bez etykiet. Pod spodem: nazwa, próbki wykończeń, jedno zdanie i pokoje oznaczone tymi samymi drzwiczkami co w hero. Promocja z ERP to znacznik w kolorze śliwki (w szkicu: demo „−15% na OLMO” z `promotions.json`).
- **Telefon** (osobny projekt, nie ściśnięty desktop). Kolejność: tekst → pokoje (przewijane palcem w jednym rzędzie) → duże drzwi ze zdjęciem → wyszukiwarka, która nachodzi na dół zdjęcia. Meble są widoczne w pierwszym ekranie, a nagłówek wyszukiwarki na jego krawędzi. Kolekcje przewija się w poziomie z podglądem kolejnej karty. Menu otwiera się na pełny ekran, z kafelkami pokoi w ich tonach.

## Ruch
Spokojny i fizyczny. Przy zmianie pokoju ton przenika się przez warstwę opacity (760 ms, `cubic-bezier(.55,.05,.25,1)`). Nowe zdjęcie lekko „osiada” (scale 1.035 → 1). Kontrolki uginają się przy kliknięciu (scale .97). Animowane są tylko transform i opacity, a przy `prefers-reduced-motion` zmiana jest natychmiastowa. Skrypt nie czyta układu strony podczas ładowania.

## Czym różni się od Forte
Forte sprzedaje katalog: dużo produktów, siatka, ceny, banery. My zaczynamy od domu i pokoju, a kolekcja jest odpowiedzią na pytanie „co postawić w salonie”. Kolor mówi, gdzie jesteś. Zamiast koszyka jest jasna droga do sklepu blisko domu.

## Dostępność i wydajność
Strona ma skip-link, widoczny fokus (śliwkowy obrys 3 px), nagłówki h1 → h2 → h3 i przyciski pokoi z `aria-pressed`. Menu mobilne ma `aria-expanded` i zamyka się klawiszem Esc. Pole kodu ma `autocomplete="postal-code"` i klawiaturę numeryczną. Zdjęcie hero ładuje się z `fetchpriority="high"`, packshoty z `loading="lazy"`. Fonty to 4 pliki woff2 (ok. 76 kB razem). Brak zewnętrznych skryptów i CDN.

## Ryzyka
- Sześć tonów to dyscyplina: każdy nowy kolor musi przejść test kontrastu i zostać w rodzinie zgaszonych barw. Inaczej strona zrobi się pastelowa i „dziecięca”.
- Łuk jest modny we wnętrzach. Trzymamy go tylko dla zdjęć pomieszczeń (i „O” w logo), żeby nie stał się ozdobnikiem.
- Ton i zdjęcie muszą do siebie pasować. Sesja zdjęciowa powinna to uwzględniać.
- Nawigacja przez pokoje wymaga dobrego przypisania mebli do pomieszczeń w ERP lub w CMS (jeden mebel może być w kilku pokojach).
- Dane sklepów i promocji w szkicu są przykładowe (`src/data/*.json`, `demo: true`).
