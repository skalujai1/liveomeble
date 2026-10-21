# Brief projektu — nowa strona Liveo Meble

Stan na: 2026-10-20 · Wersja robocza do akceptacji klienta.

Ten dokument zbiera to, co wiemy o firmie i projekcie, oraz zasady, którymi kierujemy się przy treściach.
Wszystko, czego nie potwierdził klient, ma znacznik **[do potwierdzenia]** albo **[niezweryfikowane]**.
Pełna lista otwartych pytań: [`do-potwierdzenia.md`](do-potwierdzenia.md). Architektura stron: [`ia.md`](ia.md).
Integracja z ERP: [`navireo-integracja.md`](navireo-integracja.md).

---

## 1. Co wiemy o Liveo

### Fakty z briefu klienta

| Fakt | Źródło | Status |
|---|---|---|
| Nazwa: **Liveo Meble sp. z o.o.** | brief | potwierdzone w briefie; pełne dane rejestrowe (NIP, KRS, adres) — [do potwierdzenia] |
| Siedziba / zakład: **Raniżów** (powiat kolbuszowski, Podkarpacie) | brief | adres pocztowy [do potwierdzenia] |
| Polski producent **mebli skrzyniowych i systemowych** | brief | potwierdzone |
| Sprzedaje **kolekcje** — meble projektowane razem, w kompletach | brief | potwierdzone |
| Typy mebli: szafki RTV, komody, witryny, regały, ławy, półki wiszące, stoły, kredensy, łóżka, szafki nocne, szafy, toaletki, lustra, biurka, szafki na buty, wieszaki / garderoby | brief | potwierdzone; kuchnie — [do potwierdzenia] |
| **Nie ma własnych salonów** — sprzedaje przez sieć sklepów partnerskich (resellerów) i B2B | brief | potwierdzone |
| ERP: **Navireo** (ceny, promocje, stany, kontrahenci, zamówienia) | brief | zakres API [do potwierdzenia] |
| Sprzedaż online B2C: **decyzja otwarta** | brief | architektura ma pozwolić dodać koszyk później |
| Obecna strona liveomeble.pl ma PageSpeed 95 / 89 / 96 / 100 (wydajność / dostępność / dobre praktyki / SEO) | brief | wynik z pomiaru klienta |
| Obecna strona jest źle wykonana — **nie inspirujemy się nią** | brief | decyzja |

### Informacje z wyszukiwarki — **[niezweryfikowane]**

Pojawiają się w wynikach wyszukiwania, ale nie mamy ich od klienta. **Nie publikujemy ich, dopóki klient ich nie potwierdzi.**

- Działalność „od lat 90.” — rok założenia [niezweryfikowane].
- Zatrudnienie „ok. 400 pracowników” [niezweryfikowane].
- Stara strona miała adresy w stylu sklepu internetowego (np. `/4-pokoj-dzienny`, `/143-zestawy-kuchenne`), co sugeruje,
  że w ofercie były zestawy kuchenne [niezweryfikowane — adresy z konfiguracji prototypu doradcy].

### Czego nie wiemy (i nie wymyślamy)

Liczba sklepów partnerskich, powierzchnia zakładu, eksport, certyfikaty, nagrody, gwarancja producenta,
materiały i grubości płyt, czas realizacji, liczba klientów, opinie. Dane demo w `src/data/` są **fikcyjne**
(`demo: true`) — kolekcje OLMO, TALVE, NOKTA, SOLMA, LIRAN, MELVA, BRISO, VERNO, ceny, promocje i sklepy służą
tylko do zbudowania i przetestowania strony.

---

## 2. Cele strony

1. **B2C — od inspiracji do sklepu.** Klient ogląda kolekcje i meble na dużych zdjęciach aranżacji, wybiera mebel
   i kolor, a strona wskazuje najbliższy sklep partnerski, który ma tę kolekcję.
   Główna metoda: **kod pocztowy**. Lokalizacja z IP — tylko podpowiedź. Geolokalizacja przeglądarki — opcjonalnie, po kliknięciu i za zgodą.
2. **B2B — strefa partnera.** Ceny partnerskie po zalogowaniu, zamówienia trafiające do ERP Navireo.
   Strona publiczna dla nowych partnerów: korzyści, proces, formularz — bez cennika.
3. **Aktualne ceny, promocje i stany z Navireo.** Promocja ustawiona w ERP sama przecenia meble na stronie;
   przy obniżce pokazujemy najniższą cenę z 30 dni przed obniżką (Omnibus).
4. **SEO i GEO.** Widoczność w Google oraz w odpowiedziach ChatGPT, Perplexity i podobnych narzędzi:
   czytelna struktura, dane strukturalne, odpowiedzi „najpierw konkret”, `llms.txt`.
5. **Doradca wnętrz.** Widżet czatu: klient wysyła zdjęcie pokoju, a doradca proponuje komplet z jednej kolekcji
   dopasowany kolorem. Zdjęcie jest analizowane w przeglądarce klienta (prototyp w `liveo-assistant/`).
6. **Wydajność.** PageSpeed lepszy niż obecny (95 / 89 / 96 / 100) — cel: **98–100 w każdej kategorii**, na telefonie i na komputerze.

Później (poza zakresem pierwszej wersji, ale architektura to przewiduje): koszyk i sprzedaż online, wersje językowe,
podstrony lokalne sklepów.

---

## 3. Odbiorcy

### Klienci indywidualni (B2C)

Rodziny i pary, które urządzają mieszkanie lub dom — często cały pokój naraz albo kolejne pokoje po kolei.
Średni segment cenowy. Kupują rzadko, więc chcą mieć pewność.

Czego potrzebują od strony:

- zobaczyć meble **w aranżacji** i ocenić, czy pasują do ich wnętrza;
- znać **wymiary, kolory i cenę** bez szukania;
- wiedzieć, **gdzie zobaczyć meble na żywo** i kupić je blisko domu;
- dobrać **kolejne meble z tej samej kolekcji** (dziś szafka RTV, za rok komoda);
- prostej pomocy przy decyzji — poradnik, doradca wnętrz.

Obawy: czy kolor na zdjęciu zgadza się z rzeczywistością, czy mebel zmieści się we wnęce, czy promocja jest prawdziwa,
czy złożą go sami.

### Partnerzy handlowi (B2B)

Właściciele i pracownicy sklepów meblowych — stacjonarnych i internetowych. Obecni i przyszli partnerzy.

Czego potrzebują: aktualnych cen partnerskich i stanów, szybkiego składania zamówień bez telefonów i maili,
materiałów (zdjęcia, opisy, wymiary) do własnej sprzedaży, jasnej informacji, jak zacząć współpracę.

---

## 4. Konkurencja i stara strona

**Forte (forte.com.pl)** — duża, masowa marka mebli. Nie konkurujemy skalą. Odróżniamy się:

- **kolekcje w centrum** — strona prowadzi od kolekcji do kompletu, a nie od wyszukiwarki do pojedynczego mebla;
- **spokój zamiast katalogu** — mniej elementów na ekranie, duże zdjęcia aranżacji, meble „oddychają”;
- **konkret przy każdym meblu** — wymiary, kolory, cena z informacją Omnibus, status dostępności, sklepy z tą kolekcją;
- **droga do sklepu** — od mebla do najbliższego partnera w dwóch krokach;
- **pomoc w decyzji** — doradca wnętrz i poradnik z rzetelną wiedzą, bez obietnic.

**Stara strona liveomeble.pl** — nie przenosimy jej układu, grafiki ani tekstów. Przenosimy tylko to, co potwierdzi klient
(dane firmy, nazwy kolekcji, zdjęcia) i ustawiamy przekierowania 301 ze starych adresów (lista adresów — [do potwierdzenia]).

---

## 5. Odczucie i kierunek

Strona, którą chce się oglądać: obrazowa, czytelna, współczesna, przyzwoita, spokojna. Dużo powietrza.
Duże zdjęcia aranżacji. Kolekcje w centrum.

Czego unikamy (decyzja projektowa, dotyczy też tekstów i zdjęć):

- wyglądu skaluj.ai — biel + jeden niebieski akcent, font Geist, pływające menu-pigułka;
- generycznych szablonów sklepów (karuzele, banery „SALE”, liczniki, tłok ikon);
- klisz AI: kremowe tło #F4F1EA + szeryf + terakota; prawie czarne tło + kwasowa zieleń; gradient fiolet → niebieski;
  fonty Inter / Space Grotesk / Roboto / Arial; emoji jako punktory; wszystko wyśrodkowane; zaokrąglone karty z paskiem-akcentem;
- zdjęć stockowych ludzi i ozdobników „bo ładne”.

---

## 6. Ton komunikacji marki Liveo

To **ton producenta mebli**, nie agencji. Mówimy jak dobry sprzedawca w salonie, który zna meble od środka:
**rzeczowo, ciepło, konkretnie**.

### Zasady

1. **Najpierw konkret.** Pierwsze zdanie odpowiada na pytanie. Potem szczegóły.
   „Szafka ma 160 cm szerokości i zmieści telewizor do ok. 65 cali.”
2. **Krótkie zdania.** Jedno zdanie — jedna informacja. Bez wtrąceń w wtrąceniach.
3. **Na „Ty”, ale bez spoufalania.** „Wybierz kolor”, „Sprawdź wymiary”. Bez „Hej!”, bez wykrzykników w seriach.
4. **Rzeczy po imieniu.** „Płyta laminowana w dekorze dębu”, nie „szlachetne drewno”. „Do samodzielnego montażu”, nie „łatwy montaż w 5 minut”.
5. **Liczby tylko sprawdzone.** Wymiary, ceny, terminy — z danych. Fakty o firmie — tylko potwierdzone.
6. **Ciepło przez konkret, nie przez przymiotniki.** Zamiast „przytulny, wyjątkowy, ponadczasowy” — „nóżki 12 cm, więc łatwo pod nimi posprzątać”.
7. **Uczciwie o ograniczeniach.** „Kolor na ekranie może się nieco różnić — zobacz próbkę w sklepie.” „Odległość liczymy w przybliżeniu.”
8. **Partnersko wobec sklepów.** Do partnerów B2B piszemy jak do współpracowników: warunki, terminy, kontakt. Bez marketingowego nadęcia.

### Słownik

| Piszemy | Nie piszemy | Dlaczego |
|---|---|---|
| meble, mebel | produkty, asortyment (w tekstach dla klienta) | mówimy językiem klienta |
| kolekcja, komplet | linia produktowa, seria | „kolekcja” to nasza główna jednostka |
| sklep partnerski, sklep z meblami Liveo | reseller, dystrybutor (B2C) | „reseller” tylko w tekstach B2B i technicznych |
| partner (B2B) | klient hurtowy | relacja, nie transakcja |
| dekor dębu naturalnego | dąb, drewno dębowe | to płyta laminowana, nie lite drewno |
| kolor / wykończenie | wariant (dla klienta) | „wariant” tylko w danych i strefie partnera |
| dostępny / na zamówienie / wyprzedany | „ostatnie sztuki!”, „hit!” | spokój zamiast presji |
| najniższa cena z 30 dni przed obniżką | „najlepsza cena”, „-50% tylko dziś” | przejrzystość i prawo |
| cm, zł | centymetrów w tabelach, PLN dla klienta | krótko i po polsku |

### Zapis

- Ceny: `1 299 zł` (spacja niełamliwa jako separator tysięcy i przed „zł”) — tak formatuje `formatPrice()`.
- Wymiary: `160 × 52 × 40 cm` (szer. × wys. × gł.), znak mnożenia `×`, nie litera „x”.
- Zakresy: półpauza bez spacji — `40–55 cm`, `pon.–pt.`
- Nazwy kolekcji WERSALIKAMI: OLMO, TALVE. Nazwa mebla: „Szafka RTV 160 OLMO”.
- Daty: `31 października 2026` w tekście, `31.10.2026` w tabelach.
- Tytuły z ręcznym łamaniem: zawsze **spacja przed `<br>`** („Meble do całego <br>domu”), żeby po ukryciu łamania słowa się nie skleiły.

### Przykłady

| Zamiast | Lepiej |
|---|---|
| „Odkryj wyjątkowy świat mebli, które odmienią Twoje wnętrze!” | „Meble projektujemy w kolekcjach. Szafka RTV, komoda i witryna z jednej kolekcji mają te same kolory i uchwyty.” |
| „Innowacyjne rozwiązania dla wymagających” | „Szuflady mają prowadnice z cichym domykiem.” [do potwierdzenia przy każdym meblu] |
| „Skontaktuj się z nami, a nasi eksperci...” | „Napisz do nas. Odpowiadamy w dni robocze.” [czas odpowiedzi do potwierdzenia] |
| „Najlepsze ceny na rynku” | „Cena: 721 zł. Najniższa cena z 30 dni przed obniżką: 849 zł.” |

---

## 7. Zasady treści (obowiązują wszystkich autorów)

1. **Bez zmyślonych liczb i faktów.** Żadnych „X lat na rynku”, „X tys. zadowolonych klientów”, certyfikatów, nagród,
   opinii, wyników badań — dopóki klient ich nie potwierdzi. W miejscu brakującej informacji: **[do potwierdzenia]**.
2. **Dane demo są oznaczone.** Strony z danymi przykładowymi (sklepy, ceny, strefa partnera) mają widoczną informację „dane przykładowe / DEMO”.
3. **Poradnik = ogólna wiedza.** Artykuły nie przypisują meblom Liveo cech, których nie potwierdzono. Liczby tylko powszechnie znane i sprawdzalne.
4. **Jedna myśl na sekcję.** Każda sekcja ma jeden nagłówek i jedno zadanie.
5. **Odpowiedź w pierwszym zdaniu (GEO).** W FAQ i poradnikach pierwsze zdanie odpowiedzi musi samo w sobie wystarczyć jako odpowiedź.
6. **Teksty po polsku, z polskimi znakami.** Alt każdego zdjęcia po polsku, opisuje, co widać (mebel, kolor, pomieszczenie).
7. **Teksty prawne** (polityka prywatności, regulamin) to wzory do weryfikacji przez prawnika.
8. **Ceny** pokazujemy zgodnie z zasadami w `navireo-integracja.md` i `src/lib/pricing.js`; status ceny na stronie
   (cena sugerowana producenta czy oferta sprzedaży) — [do potwierdzenia z prawnikiem i klientem].

---

## 8. Standardy wykonania (poziom agencji skaluj.ai — nie jej wygląd)

- Działa perfekcyjnie od 360 px; telefon to osobny projekt, nie „ściśnięty desktop”; zero poziomego przewijania.
- Jedna wyraźna myśl na sekcję, mocna hierarchia, dużo powietrza; nic nie wygląda jak gotowy szablon.
- Ograniczona paleta (baza + 1–2 akcenty konsekwentnie), maks. 2 rodziny fontów.
- Fonty self-hosted (woff2, latin + latin-ext przez `unicode-range`, `font-display: swap`), `@font-face` inline w `<head>`, z polskimi znakami. Bez CDN.
- Ruch spokojny i fizyczny (własne krzywe, tylko `transform`/`opacity`), z obsługą `prefers-reduced-motion`; bez odczytu układu w trakcie ładowania.
- Obrazy zawsze z `width`/`height`, `loading="lazy"` poniżej pierwszego ekranu, `alt` po polsku.
- Dostępność: kontrast WCAG AA, widoczny fokus, skip-link, nagłówki h1 → h2 → h3 bez przeskoków, ARIA w menu.

---

## 9. Treści w repozytorium

| Miejsce | Co |
|---|---|
| `src/data/` | dane demo: kolekcje, meble, pokoje, typy, wykończenia, promocje, sklepy, kody pocztowe |
| `src/content/pages/*.json` | teksty sekcji stron (strona główna, kolekcje, meble, kategorie, pomieszczenia, produkt, promocje, gdzie kupić, dla partnerów, strefa partnera, doradca, o nas, kontakt, poradnik, elementy wspólne i 404) |
| `src/content/poradnik/*.md` | artykuły poradnika (Markdown + frontmatter z FAQ) |
| `src/content/legal/*.md` | wzory: polityka prywatności, regulamin |
| `docs/` | brief, architektura informacji, integracja z Navireo, lista pytań do klienta |

Struktura plików treści jest opisana w [`ia.md`, rozdział 6](ia.md#6-struktura-treści-w-srccontent).

## Fakty ze starej strony liveomeble.pl (odczyt 21.10.2026)

Źródło: liveomeble.pl (strony „O nas”, „Kontakt”, „Salony partnerskie”, stopka). To deklaracje firmy — na nowej stronie używamy ich po potwierdzeniu przez klienta.

- **Firma:** LIVEO Meble Spółka z ograniczoną odpowiedzialnością, 36-130 Raniżów, ul. Borki 5, woj. podkarpackie. Zakład produkcyjny pod tym samym adresem.
- **Kontakt ogólny:** biuro@liveomeble.pl, tel. +48 17 58 18 000. Formularz kontaktowy z tematami: kadry, meble skrzyniowe, meble tapicerowane, ogólny, reklamacje, webmaster, współpraca.
- **Asortyment (menu starej strony):** meble skrzyniowe, materace i stelaże, meble tapicerowane; działy „Promocje” i „Wyprzedaże”. W tekście „O nas”: komody, witryny, szafy, stoły, krzesła, regały, biurka, akcesoria (oświetlenie, materace); meble do mieszkań i do obiektów użyteczności publicznej.
- **O firmie (deklaracje):** tradycja sięgająca lat 90., „blisko 400 wykwalifikowanych pracowników”, własna infrastruktura produkcyjna, udział w targach w Polsce i za granicą, materiały przyjazne środowisku, wspieranie organizacji na rzecz dzieci.
- **Sprzedaż:** przez salony partnerskie — stara strona ma ich listę według województw (16 województw + „pozostałe”). Po zgodzie klienta i partnerów można ją przenieść do `src/data/resellers.json` zamiast danych przykładowych.
- **Przedstawiciele handlowi (B2B)** — 3 osoby z podziałem na województwa (imiona, telefony i e-maile są na stronie /kontakt). Na nowej stronie publikujemy je tylko po potwierdzeniu klienta (dane osobowe pracowników).
- **Gwarancja, reklamacje, regulacje i bezpieczeństwo, nota prawna** — osobne strony w stopce starej strony; treść do przeniesienia po weryfikacji.
