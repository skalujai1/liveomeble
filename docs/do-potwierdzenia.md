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
