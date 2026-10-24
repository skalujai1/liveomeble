# Do potwierdzenia z klientem

Lista otwartych pytań i założeń przyjętych na czas prac na danych demonstracyjnych.

## Dane, ceny i sklepy partnerskie

1. **Kuchnia** — na razie nie modelujemy kuchni (zestawy i szafki kuchenne): w danych jest 6 pomieszczeń
   (salon, jadalnia, sypialnia, pokój młodzieżowy, przedpokój, domowe biuro). Czy kuchnie mają być na nowej stronie?
   Doradca wnętrz nadal ma przycisk „Kuchnia” — przy danych demo pokazuje tylko stoły i kredensy.
2. **Ceny wariantów kolorystycznych** — w danych demo kolor nie zmienia ceny. Czy w Navireo warianty
   (np. biały połysk, złote dodatki) mają osobne ceny? Struktura to obsługuje (`variants[].basePrice`).
3. **Promocje z Navireo** — przyjęto: rabat procentowy albo cena promocyjna; zakres: kolekcja / typ mebla / indeks;
   promocje się **nie łączą** (wygrywa najkorzystniejsza dla klienta); cena po rabacie zaokrąglana **w dół** do pełnych złotych.
   Do potwierdzenia: czy tak liczy ERP i w jakiej strefie czasowej zapisuje daty.
4. **Omnibus (najniższa cena z 30 dni)** — czy Navireo przechowuje historię cen detalicznych? Jeśli nie,
   strona powinna zapisywać każdą zmianę ceny przy synchronizacji (zalecane).
5. **Widełki cen** dla typów spoza briefu przyjęto roboczo: kredens 1099–2199 zł, toaletka 599–1199 zł,
   szafka na buty 399–999 zł, wieszak 199–499 zł.
6. **Stany magazynowe** — przyjęto statusy: dostępny / na zamówienie (z czasem realizacji) / wyprzedany.
   Doradca wnętrz nie poleca wariantów wyprzedanych. Czy pokazywać je na stronie produktu?
7. **Sklepy partnerskie** — potrzebna lista: nazwa, adres, kod, współrzędne, kolekcje na ekspozycji, usługi
   (montaż, dostawa), godziny otwarcia; zgoda partnerów na publikację; czy pokazujemy telefon i e-mail.
8. **Kody pocztowe** — wyszukiwanie sklepu korzysta z przybliżonego środka okręgu (2 pierwsze cyfry kodu,
   dokładność rzędu kilkudziesięciu km). Prefiks 79 przyjęto jako nieużywany. Dokładniejsza baza
   (pełne kody → miejscowości) to osobna decyzja (źródło i licencja).
9. **Nazwy mebli** — konwencja demo: „<Typ> <szerokość> <KOLEKCJA>” (np. „Szafka RTV 160 OLMO”). Jak nazywa meble ERP?
10. **Montaż** — w danych demo wszystkie meble są „do samodzielnego montażu”. Czy są wyjątki (np. meble składane fabrycznie)?

## Marka i materiały

11. **Logo w SVG** — wersja podstawowa, znak, wersja na ciemne tło; zasady użycia (pole ochronne, minimalny rozmiar).
12. **Kolory i fonty marki** — czy jest księga znaku? Jeśli tak: kolory i fonty (z licencją webową). Paleta i fonty strony to decyzja projektowa,
    ale powinny zgadzać się z marką. Fonty muszą mieć polskie znaki.
13. **Zdjęcia** — aranżacje każdej kolekcji (min. jedno duże zdjęcie poziome i jedno pionowe na kolekcję), zdjęcia każdego mebla w każdym kolorze
    na jasnym tle, detale (uchwyty, okucia, nóżki), zdjęcia z zakładu do strony „O nas” — w wysokiej rozdzielczości, z prawem do użycia
    na stronie i przez partnerów. Bez zdjęć stockowych ludzi. Do czasu zdjęć strona używa renderów 3D z danych.
14. **Excel z meblami** — dla każdego mebla: indeks, nazwa, kolekcja, rodzaj, kolory (z indeksami), wymiary szer. × wys. × gł., waga, opis,
    cechy (okucia, materiały, grubość płyty), montaż, liczba paczek, pomieszczenia.
15. **Prawdziwe kolekcje** — nazwy, opisy i skład kolekcji. Kolekcje demo (OLMO, TALVE, NOKTA, SOLMA, LIRAN, MELVA, BRISO, VERNO) są fikcyjne.

## Navireo, ceny i promocje

16. **Dostęp do Navireo** — kontakt do wdrożeniowca, decyzja o sposobie dostępu (Sfera, widoki SQL, eksport plików), środowisko testowe.
    Pełna lista pytań: [`navireo-integracja.md`, rozdz. 13](navireo-integracja.md#13-pytania-do-wdrożeniowca-navireo).
17. **Promocje producenta w sklepach** — czy promocja ustawiona w Navireo obowiązuje automatycznie u partnerów? Jeśli nie, strona musi to
    jasno mówić (teksty na `/promocje/` i przy cenie są przygotowane ze znacznikiem [do potwierdzenia]).
18. **Status ceny na stronie** — „cena producenta”, „cena sugerowana” czy cena sprzedaży? Decyzja z prawnikiem — wpływa na teksty przy cenie,
    sposób pokazywania promocji (Omnibus) i dane strukturalne.
19. **Ceny partnerskie** — struktura cenników partnerów; czy partner widzi w strefie ilości w magazynie, czy tylko status dostępności.
20. **Osoby po stronie Liveo** — kto odbiera alerty (nieudana synchronizacja, błąd zamówienia), kto jest opiekunem handlowym partnerów.

## Sklepy partnerskie (uzupełnienie pkt 7)

21. **Kolekcje w sklepach** — która kolekcja jest w którym sklepie; na ekspozycji czy tylko na zamówienie; czy sklep może zamówić każdą kolekcję.
22. **Aktualizacja danych sklepów** — kto zmienia godziny, kolekcje i usługi: Liveo czy partner w strefie partnera?
23. **Warunki współpracy B2B** — co można podać publicznie na `/dla-partnerow/` (ekspozycja, minimalne zamówienie, regiony, sklepy internetowe)
    i w jakim czasie odpowiadacie na zgłoszenie sklepu.
24. **Materiały dla partnerów** — format zdjęć i pliku produktowego, zasady licencji.

## Fakty o firmie (strona „O nas”, stopka, dane strukturalne)

25. **Dane rejestrowe** — NIP, KRS, REGON; czy podawać kapitał zakładowy. Adres (ul. Borki 5, 36-130 Raniżów), telefon i e-mail
    wzięte ze starej strony liveomeble.pl — potwierdzić, że są aktualne.
26. **Historia i liczby** — rok założenia (w wyszukiwarce: „od lat 90.” [niezweryfikowane]), zatrudnienie (w wyszukiwarce: „ok. 400 pracowników”
    [niezweryfikowane]). Potwierdzić ze źródłem albo nie publikujemy.
27. **Produkcja** — czy cała produkcja jest w Raniżowie; materiały (rodzaj i grubość płyt, klasa emisji formaldehydu), okucia (np. ciche domyki —
    w których meblach), kontrola jakości. Certyfikaty i nagrody — tylko z dokumentem.
28. **Gwarancja i reklamacje** — czy jest gwarancja producenta i na jakich warunkach; jak klient zgłasza reklamację (przez sklep czy bezpośrednio);
    proces dosyłania brakujących części i gdzie jest numer na etykiecie paczki.
29. **Dostawa i montaż** — kto dostarcza meble klientowi; czy wszystkie meble są w paczkach do samodzielnego montażu.
30. **Ciągłość kolekcji** — jak długo kolekcje są w ofercie (czy można dokupić mebel po kilku latach).

## Kontakt

31. **Dane kontaktowe** — telefon, e-mail ogólny i działu handlowego, godziny pracy biura, czas odpowiedzi; czy w Raniżowie jest ekspozycja dla klientów.
32. **Odbiorcy formularzy** — na jakie adresy trafiają wiadomości z formularza kontaktowego i zgłoszenia sklepu.
33. **Social media** — adresy profili (stopka, `sameAs` w danych strukturalnych) albo informacja, że ich nie prowadzicie.

## Strona, domena, prawo

34. **Domena i DNS** — czy zostaje liveomeble.pl; kto zarządza DNS; dostęp do panelu domeny.
35. **Hosting** — rekomendujemy hosting statyczny z CDN + Cloudflare Worker dla API. Konto Cloudflare zakłada Liveo (właściciel) czy wykonawca?
36. **Stare adresy** — lista adresów starej strony albo dostęp do Google Search Console — do przekierowań 301 (`ia.md`, rozdz. 8).
37. **Języki** — tylko polski czy także inne (np. dla partnerów z zagranicy)?
38. **Sprzedaż online B2C** — decyzja i orientacyjny termin (architektura przewiduje koszyk, `ia.md`, rozdz. 9).
39. **Teksty prawne** — weryfikacja wzorów (`src/content/legal/`) przez prawnika; czy Liveo ma inspektora ochrony danych; umowy powierzenia
    z dostawcami (hosting, Cloudflare, poczta, OpenRouter i dostawca modelu AI); podstawa przekazania danych poza EOG.
40. **Analityka** — czy w ogóle (wpływa na baner cookie i wynik PageSpeed); jeśli tak, które narzędzie. Rekomendacja: na start bez analityki
    albo narzędzie bez plików cookie.
41. **Doradca wnętrz** — zgoda na model AI przez OpenRouter (koszt, limit wydatków, dostawca modelu i kraj przetwarzania), konto OpenRouter na Liveo.
    Przed startem: pliki modelu analizy obrazu i biblioteka hostowane na naszym serwerze (dziś widżet pobiera je z zewnętrznego CDN).
42. **Roboty AI** — czy zgadzacie się na użycie treści strony do trenowania modeli (GPTBot, ClaudeBot, Google-Extended, CCBot)?
    Boty wyszukiwania AI (OAI-SearchBot, PerplexityBot) rekomendujemy wpuścić — od nich zależy, czy strona pojawi się jako źródło w ChatGPT i Perplexity.
43. **Autor poradników** — „Redakcja Liveo” czy konkretna osoba (imię, rola); kto zatwierdza treści przed publikacją.
44. **Ton komunikacji** — akceptacja zasad i słownika z `brief.md`, rozdz. 6.

## Ze starej strony liveomeble.pl (21.10.2026)

45. Czy przenosimy prawdziwą listę salonów partnerskich ze starej strony (za zgodą partnerów) w miejsce danych przykładowych?
46. Czy publikujemy przedstawicieli handlowych (imię, telefon, e-mail, województwa) w strefie „Dla partnerów”?
47. Meble tapicerowane oraz materace i stelaże — czy wchodzą do nowej strony (dziś modelujemy tylko meble skrzyniowe)?
48. Czy deklaracje „lata 90.” i „blisko 400 pracowników” możemy podać na stronie (aktualność liczby)?
49. Meble do obiektów użyteczności publicznej (kontrakty) — osobna sekcja B2B?
