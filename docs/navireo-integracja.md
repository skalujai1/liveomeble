# Integracja z ERP Navireo — przepływ danych

Stan na: 2026-10-20 · **Szkic do rozmowy z wdrożeniowcem Navireo.**

Nie mamy dokumentacji ani dostępu do Navireo u Liveo. Wszystko, co dotyczy samego Navireo (moduły, pola, dokumenty,
sposób dostępu), to **założenia [do potwierdzenia]**. Pewne są tylko wymagania strony i to, co jest już zrobione w repozytorium:
format danych (`src/data/`, opis w [`src/data/README.md`](../src/data/README.md)), liczenie cen i promocji (`src/lib/pricing.js`)
i wyszukiwarka sklepów (`src/lib/locator.js`). Integracja ma dostarczać dane **w tym samym formacie**, więc strona się nie zmieni.

Powiązane: [`brief.md`](brief.md) · [`ia.md`](ia.md) · [`do-potwierdzenia.md`](do-potwierdzenia.md)

---

## 1. Czego potrzebuje strona

| # | Wymaganie | Skąd |
|---|---|---|
| W1 | Ceny detaliczne brutto, promocje i dostępność mebli na stronie — aktualne | brief, cel 3 |
| W2 | Promocja ustawiona w Navireo **sama** przecenia meble na stronie, bez pracy ręcznej | brief, cel 3 |
| W3 | Przy obniżce: najniższa cena z 30 dni przed obniżką (Omnibus) | prawo (art. 6a ustawy o informowaniu o cenach) |
| W4 | Lista sklepów partnerskich i ich kolekcji do wyszukiwarki „Gdzie kupić” | brief, cel 1 |
| W5 | Strefa partnera: ceny partnerskie po zalogowaniu, zamówienia trafiające do Navireo | brief, cel 2 |
| W6 | Strona działa i jest szybka także wtedy, gdy ERP albo API nie odpowiada | brief, cel 6 (PageSpeed 98–100) |
| W7 | Żadnych kluczy ani haseł do ERP w przeglądarce ani w repozytorium; ERP nie jest wystawiony do internetu | bezpieczeństwo |
| W8 | Możliwość dodania sprzedaży online później (koszyk) bez przebudowy integracji | brief |

## 2. Co wiemy o Navireo, a czego nie

- Według naszej wiedzy Navireo to system ERP firmy InsERT, a dostęp programistyczny w tej rodzinie produktów zapewnia zwykle
  płatny moduł **Sfera** (interfejs dla Windows/.NET), przy bazie Microsoft SQL Server. **[do potwierdzenia: wersja, licencje, sposób hostowania]**
- **Nie zakładamy**, że Navireo ma publiczne REST API dostępne z internetu.
- Możliwe źródła danych — do wyboru z wdrożeniowcem:
  1. Sfera (odczyt i zapis, w tym tworzenie dokumentów zamówień) — **rekomendowane**, jeśli jest licencja;
  2. widoki SQL tylko do odczytu + osobny sposób zapisu zamówień;
  3. cykliczny eksport plików (XML/CSV) z Navireo;
  4. gotowy moduł lub integracja, którą wdrożeniowiec już ma (np. dla B2B lub e-commerce).

Wniosek: między Navireo a internetem potrzebny jest **łącznik** — mała usługa w sieci Liveo, która czyta Navireo lokalnie
i sama wysyła dane na zewnątrz. Dzięki temu nie otwieramy żadnych portów do ERP.

## 3. Architektura

```
 SIEĆ LIVEO                                   │  INTERNET
                                              │
 ┌────────────────────┐                       │
 │ Navireo + SQL      │                       │
 └─────────┬──────────┘                       │
           │ Sfera / widoki / eksport          │
           │ [do ustalenia]                    │
 ┌─────────▼──────────┐  tylko wychodzące HTTPS │  ┌─────────────────────────────────────────────┐
 │ Łącznik Liveo      │ ──── POST /internal/sync/* (podpis HMAC) ───► │ Cloudflare Worker „liveo-api”           │
 │ (usługa Windows)   │ ◄─── GET /internal/orders/pending ─────────── │  • D1: katalog, ceny, historia cen,     │
 │                    │ ──── POST /internal/orders/{id}/ack ────────► │    promocje, stany, partnerzy, zamówienia│
 └────────────────────┘                       │  │  • KV: wersja danych / cache odpowiedzi  │
                                              │  │  • Cron: kontrola świeżości, przebudowa  │
                                              │  └───┬──────────────┬───────────────┬──────┘
                                              │      │ /api/* publ. │ /api/b2b/*    │ /internal/export/catalog
                                              │      ▼              ▼               ▼ (token)
                                              │  przeglądarka   strefa partnera   GitHub Actions
                                              │  (ceny, stany,  (sesja)           → src/data/*.json
                                              │   sklepy)                         → build strony statycznej
                                              │                                   → wdrożenie (hosting [do ustalenia])
```

**Dlaczego tak:**

- **Strona jest statyczna** (HTML z gotowymi cenami z dnia budowy) — szybka, odporna na awarie, dobra dla SEO i GEO.
- **Świeże dane dociąga przeglądarka** z API Workera — po załadowaniu strony, bez blokowania wyświetlania. Gdy API nie odpowie, zostają dane z HTML.
- **Jedna logika cen** — Worker, build i przeglądarka używają tego samego `src/lib/pricing.js` (`priceFor()`), więc cena jest wszędzie identyczna.
- **ERP nigdy nie przyjmuje połączeń z zewnątrz** — łącznik sam wysyła dane i sam pobiera zamówienia.

**Wariant prostszy na start [do decyzji]:** łącznik raz na kilka minut wysyła pełny plik JSON katalogu do Workera (albo do bucketu R2),
a Worker tylko go serwuje. Bez bazy D1, bez strefy partnera. Dobry na etap E2 (rozdz. 12); strefa partnera i zamówienia i tak wymagają D1.

## 4. Dwa obiegi danych: budowa strony i przeglądarka

### 4.1 Przy budowie strony (GitHub Actions)

1. Wyzwalacze: push na `main`; harmonogram (np. codziennie po północy i rano czasu polskiego — cron w Actions liczy w UTC i bywa opóźniony o kilka–kilkanaście minut);
   `repository_dispatch` wysłany przez Workera po istotnej zmianie (nowy lub wycofany mebel, zmiana opisu lub ceny regularnej, **start i koniec promocji**); ręcznie.
2. `tools/data/fetch-catalog.mjs` [do napisania] pobiera `GET /internal/export/catalog` z tokenem z sekretów Actions.
3. Walidacja: schemat pól jak w `src/data/README.md`; **bezpiecznik** — jeśli zniknęło więcej niż 20% mebli albo wszystkie ceny są zerowe, build się zatrzymuje i wysyła alert (zamiast opublikować pusty katalog).
4. Zapis `src/data/*.json` (ten sam format co dziś), testy `node --test tools/data/`, eksport katalogu doradcy (`tools/data/export-assistant-catalog.mjs`).
5. Build strony statycznej i wdrożenie.

### 4.2 W przeglądarce

1. HTML zawiera cenę, linię Omnibus i status dostępności policzone przy budowie (`priceFor(product, variant, promotions, buildTime)`), a w atrybutach — indeksy wariantów i czas budowy.
2. Plik promocji (mały) jest w HTML łącznie z promocjami **zaplanowanymi**. Przeglądarka liczy `priceFor(..., now)`, więc promocja zaczyna się i kończy o czasie, nawet bez przebudowy i bez API.
3. Po załadowaniu (w czasie bezczynności przeglądarki) skrypt pyta `GET /api/prices?skus=...` (paczki do 100 indeksów, limit czasu 2 s) i aktualizuje ceny i dostępność.
4. Gdy API nie odpowie: zostają dane z HTML. Gdy dane o stanach są starsze niż 24 h (`stale: true` albo stary czas budowy) — zamiast statusu pokazujemy „Dostępność sprawdź w sklepie” (`site.stock.unknown`).
5. Bez skoków układu: blok ceny ma zarezerwowane miejsce na linię Omnibus; skrypt podmienia tylko tekst, nie czyta wymiarów elementów.
6. Kod pocztowy z wyszukiwarki sklepów **nie trafia do API** — lista sklepów jest pobierana w całości (`GET /api/resellers` albo z HTML), a odległości liczy przeglądarka.

## 5. Mapowanie pól (szkic)

Pojęcia po stronie Navireo to nasze założenia na podstawie typowego ERP — **każdy wiersz do potwierdzenia z wdrożeniowcem**.

### 5.1 Meble (towary)

| Navireo (założenie) | Strona (`src/data/products.json`) | Uwagi |
|---|---|---|
| symbol / indeks towaru | `variants[].sku` (np. `LV-OLMO-RTV160-DN`) | jeden kolor = jeden towar? [do potwierdzenia] |
| wspólny indeks modelu (pole własne / cecha / wzorzec symbolu) | `sku` (np. `LV-OLMO-RTV160`), `id`, `slug` | potrzebne do grupowania kolorów jednego mebla |
| nazwa | `name` („Szafka RTV 160 OLMO”) | nazwa w ERP bywa techniczna — nazwa na stronę może pochodzić z Excela |
| cena detaliczna brutto (cennik / poziom cen) | `basePrice` albo `variants[].basePrice` | który cennik to cena dla klientów? [do potwierdzenia] |
| stawka VAT | `vatRate` (nowe pole) | potrzebne w strefie partnera (netto ↔ brutto) |
| stan, rezerwacje, magazyny | `variants[].stock`: `dostepny` / `na-zamowienie` / `wyprzedany` | na stronie publicznej **tylko status**, bez ilości |
| czas realizacji (pole własne?) | `variants[].leadTimeDays` | [do potwierdzenia, czy jest w ERP] |
| aktywny / wycofany, „publikuj na stronie” | mebel publikowany albo nie | wycofany mebel: strona zostaje z informacją albo 301 do kolekcji [do decyzji] |
| wymiary, waga, EAN | `dims {w,h,d}`, `weightKg`, `ean` (nowe pole) | jeśli brak w ERP — z Excela |
| grupa towarowa / cechy | `collection`, `type`, `rooms` | albo z Excela |
| — (nie z ERP) | `description`, `features[]`, `model3d`, `images`, `finish` | Excel klienta + zdjęcia / rendery |

### 5.2 Promocje

| Navireo (założenie) | Strona (`src/data/promotions.json`) | Uwagi |
|---|---|---|
| identyfikator, nazwa promocji | `id`, `name`, `label` | `label` — krótki tekst na stronę (np. „−15% na kolekcję OLMO”) |
| typ: rabat % / cena promocyjna | `kind`: `percent` / `fixedPrice`, `value` | inne typy (np. „2 za 1”) — poza zakresem [do potwierdzenia] |
| zakres: towary / grupa / cecha | `scope.skus` / `scope.types` / `scope.collections` | listy łączone przez AND, wartości w liście przez OR |
| data i godzina od–do | `startsAt`, `endsAt` (ISO z przesunięciem strefy) | aktywna gdy `startsAt <= teraz < endsAt`; strefa czasowa ERP [do potwierdzenia] |
| dotyczy detalu / partnerów | (nowe pole `channel`) | czy promocja producenta obejmuje ceny partnerskie? [do potwierdzenia] |

Reguły liczenia (zrobione w `pricing.js`): promocje się nie łączą — wygrywa najniższa cena; cena po rabacie w dół do pełnych złotych, min. 1 zł;
„promocja”, która nie obniża ceny, jest pomijana. **Do potwierdzenia, czy tak samo liczy ERP** — inaczej ceny na stronie i w sklepie mogą się różnić o złotówki.

### 5.3 Historia cen (Omnibus)

| Źródło | Strona | Uwagi |
|---|---|---|
| historia cen w Navireo, jeśli istnieje | `priceHistory[] {date, price}` | [do potwierdzenia] |
| jeśli nie — **zapisujemy sami**: każda zmiana faktycznej ceny przy synchronizacji → tabela `price_changes` w D1 | `priceHistory[]` | zalecane niezależnie od ERP; od dnia uruchomienia |

### 5.4 Kontrahenci → sklepy partnerskie i konta B2B

| Navireo (założenie) | Strona | Uwagi |
|---|---|---|
| kontrahent z grupą/cechą „partner” | `resellers[]` (wyszukiwarka) i `partners` (strefa) | jak oznaczeni są partnerzy? [do potwierdzenia] |
| nazwa, adres, kod, miejscowość, województwo | `name`, `address`, `postcode`, `city`, `voivodeship` | publikacja **tylko za zgodą partnera** |
| telefon, e-mail | `phone`, `email` | tylko gdy partner się zgodzi; inaczej `null` |
| NIP, adresy dostaw, opiekun handlowy, cennik | konto w strefie partnera | nigdy w publicznym API |
| osoby kontaktowe | użytkownicy strefy partnera | [do potwierdzenia] |
| — (raczej nie w ERP) | `lat`, `lng`, `collections`, `services`, `openingHours` | geokodowanie przy imporcie + uzupełnianie przez Liveo lub partnera [do decyzji: Excel czy panel] |

### 5.5 Zamówienia B2B

| Strona | Navireo (założenie) | Uwagi |
|---|---|---|
| zamówienie ze strefy partnera | dokument zamówienia od klienta [do potwierdzenia: typ dokumentu, seria, magazyn] | tworzy łącznik |
| `partnerId` | kontrahent | z sesji, nie z formularza |
| pozycje `{sku, qty}` | pozycje dokumentu | **cenę liczy ERP** z cennika kontrahenta — ceny z przeglądarki nie przekazujemy jako wiążącej |
| `webOrderId` | pole na numer zewnętrzny / uwagi [do potwierdzenia] | do wykrywania duplikatów |
| `reference` (numer własny partnera) | pole na numer obcy [do potwierdzenia] | |
| `deliveryAddressId`, `requestedDate`, `notes` | adres dostawy, termin, uwagi | |
| `status` na stronie | statusy dokumentu w ERP | mapowanie: `received` → `queued` → `inErp` → `partial` / `shipped` / `cancelled`, `error` |

Przykład danych wysyłanych przez łącznik (ceny i stany, przyrostowo):

```json
POST /internal/sync/prices
{
  "source": "navireo",
  "syncedAt": "2026-10-20T14:05:00+02:00",
  "full": false,
  "items": [
    { "sku": "LV-OLMO-RTV160-DN", "priceGross": 849, "vatRate": 23, "stock": "na-zamowienie", "leadTimeDays": 14 }
  ]
}
```

## 6. Endpointy Workera

Wszystkie odpowiedzi w JSON, UTF-8. Ceny w złotych brutto (publiczne) albo netto (B2B), liczby całkowite lub z dwoma miejscami po przecinku.

### 6.1 Publiczne (przeglądarka)

CORS tylko dla domeny strony. Bez cookies. Limit zapytań na adres IP (bez zapisywania IP).

| Metoda i adres | Co zwraca | Cache |
|---|---|---|
| `GET /api/prices?skus=LV-OLMO-RTV160-DN,LV-OLMO-RTV160-KA-DN` | dla każdego indeksu: `price`, `regular`, `lowest30`, `promoId`, `promoLabel`, `promoEndsAt`, `stock`, `leadTimeDays`; plus `generatedAt`, `stale` | przeglądarka 60 s, CDN 5 min, `stale-while-revalidate` |
| `GET /api/promotions` | promocje aktywne i zaplanowane na 14 dni (pola publiczne) | 5 min |
| `GET /api/resellers?collection=olmo` | sklepy partnerskie (tylko ze zgodą na publikację), bez odległości | 1 h |
| `GET /api/region` | `{ country, region }` z danych CDN o połączeniu — tylko do podpowiedzi „jesteś w okolicy…”; nic nie jest zapisywane | bez cache |
| `POST /api/forms/contact` | `202` albo błędy walidacji pól | — |
| `POST /api/forms/partner` | `202` albo błędy walidacji pól | — |
| `GET /api/health` | `{ ok, lastSync, stale }` | bez cache |

Przykład odpowiedzi:

```json
GET /api/prices?skus=LV-OLMO-RTV160-DN
{
  "generatedAt": "2026-10-20T14:06:12+02:00",
  "stale": false,
  "currency": "PLN",
  "items": {
    "LV-OLMO-RTV160-DN": {
      "price": 721, "regular": 849, "lowest30": 849,
      "promoId": "promo-olmo-jesien", "promoLabel": "−15% na kolekcję OLMO",
      "promoEndsAt": "2026-10-31T00:00:00+01:00",
      "stock": "na-zamowienie", "leadTimeDays": 14
    }
  }
}
```

Walidacja: indeksy pasują do wzorca `^LV-[A-Z0-9-]{3,40}$`, maks. 100 w jednym zapytaniu; nieznane indeksy są pomijane, nie zwracają błędu.

### 6.2 Strefa partnera `/api/b2b/*`

Wszystkie odpowiedzi: `Cache-Control: private, no-store`. Każde zapytanie do bazy jest ograniczone do kontrahenta z sesji.

| Metoda i adres | Opis |
|---|---|
| `POST /api/b2b/login` | `{email, password}` → cookie sesji; limit prób na konto i na IP, blokada czasowa |
| `POST /api/b2b/logout` | unieważnia sesję |
| `POST /api/b2b/password/reset-request`, `POST /api/b2b/password/reset` | link jednorazowy z krótkim czasem ważności |
| `GET /api/b2b/me` | użytkownik, firma, opiekun, adresy dostaw |
| `GET /api/b2b/pricelist?collection=&type=` | pozycje: `sku`, nazwa, kolor, cena katalogowa brutto, **cena partnera netto**, VAT, stan, czas realizacji, czas danych |
| `GET /api/b2b/pricelist.csv` | to samo jako CSV (UTF-8 z BOM, średnik — dla Excela) |
| `POST /api/b2b/orders` | nagłówek `Idempotency-Key: <uuid>`; `{items:[{sku,qty}], deliveryAddressId, requestedDate, reference, notes}` → `201 {webOrderId, status, totals}` |
| `GET /api/b2b/orders`, `GET /api/b2b/orders/{id}` | historia i szczegóły ze statusem i numerem w Navireo |

`POST /api/b2b/orders`: Worker sprawdza sesję, aktywność indeksów, ilości (liczby całkowite 1–999), **przelicza wartości z cennika partnera** (ignoruje ceny z przeglądarki),
zapisuje zamówienie ze statusem `received` i kolejkuje je dla łącznika (`queued`). Ponowne wysłanie z tym samym `Idempotency-Key` zwraca to samo zamówienie.

### 6.3 Wewnętrzne (łącznik i build)

| Metoda i adres | Kto | Opis |
|---|---|---|
| `POST /internal/sync/products` | łącznik | pełny albo przyrostowy katalog |
| `POST /internal/sync/prices` | łącznik | ceny i stany (przyrostowo, często) |
| `POST /internal/sync/promotions` | łącznik | promocje |
| `POST /internal/sync/partners` | łącznik | kontrahenci-partnerzy, cenniki partnerów |
| `GET /internal/orders/pending` | łącznik | zamówienia do utworzenia w Navireo |
| `POST /internal/orders/{id}/ack` | łącznik | `{erpNumber, status}` po utworzeniu dokumentu |
| `POST /internal/orders/{id}/status` | łącznik | zmiany statusu z ERP |
| `POST /internal/orders/{id}/error` | łącznik | opis błędu → alert do opiekuna |
| `GET /internal/export/catalog` | GitHub Actions | pełny katalog w formacie `src/data/*.json` |

Uwierzytelnienie: łącznik — podpis HMAC-SHA256 treści + znacznik czasu w nagłówku (`X-Liveo-Timestamp`, `X-Liveo-Signature`), okno 5 minut, odrzucanie powtórzeń;
opcjonalnie dodatkowo token usługowy Cloudflare Access. Build — token `Bearer` tylko do odczytu.

## 7. Synchronizacja — częstotliwość (propozycja)

| Dane | Jak często | Tryb |
|---|---|---|
| Stany i ceny | co 5–15 min [do ustalenia z wdrożeniowcem — obciążenie ERP] | przyrostowo (tylko zmiany) |
| Promocje | co 5–15 min + natychmiast po zmianie, jeśli łącznik ją wykryje | pełna lista aktywnych i zaplanowanych |
| Meble (opisy, wymiary, nowe, wycofane) | raz dziennie + na żądanie | pełny |
| Partnerzy i cenniki partnerów | raz dziennie + na żądanie | pełny |
| Zamówienia B2B | łącznik pyta co 1–2 min | kolejka |

Brak udanej synchronizacji przez 1 h → alert e-mail do Liveo [do ustalenia: odbiorcy]. Przez 24 h → API zwraca `stale: true`, strona ukrywa statusy dostępności.

## 8. Cache

| Co | Gdzie | Jak długo | Unieważnianie |
|---|---|---|---|
| HTML stron | CDN | długo | każde wdrożenie |
| CSS, JS, fonty, obrazy z hashem w nazwie | CDN + przeglądarka | 1 rok, `immutable` | nowa nazwa pliku |
| `/api/prices`, `/api/promotions` | CDN (cache Workera) + przeglądarka | 5 min / 60 s | numer wersji danych w kluczu cache — zmienia się po każdej synchronizacji ze zmianami |
| `/api/resellers` | CDN | 1 h | jw. |
| `/api/b2b/*` | nigdzie | — | `private, no-store` |

Granice promocji: Worker skraca `max-age` tak, żeby odpowiedź nie była trzymana dłużej niż do najbliższego `startsAt` lub `endsAt`.
Przeglądarka i tak liczy cenę na „teraz”, więc nawet stara odpowiedź nie pokaże wygasłej promocji.

## 9. Omnibus — szczegóły

- Linia „Najniższa cena z 30 dni przed obniżką” pojawia się **zawsze** przy przekreślonej cenie — nigdy sama przekreślona cena.
- `lowest30` = najniższa cena z 30 dni przed dniem rozpoczęcia obniżki (`lowestPriceBefore()` w `pricing.js`, czas polski).
- **Do zrobienia w danych i w `pricing.js`:**
  - mebel w sprzedaży krócej niż 30 dni → najniższa cena od dnia wprowadzenia do sprzedaży — potrzebne pole `availableFrom` (dziś funkcja przyjmuje cenę regularną);
  - obniżka zwiększana stopniowo → najniższa cena sprzed **pierwszej** obniżki — potrzebne wykrywanie ciągłego okresu obniżek w historii cen.
- Historię cen trzymamy co najmniej 30 dni wstecz od każdej promocji; zalecamy 13 miesięcy (kontrola, reklamacje) [do decyzji].
- **Pytanie prawne:** Liveo jako producent nie sprzedaje na stronie konsumentom — czy pokazywane ceny są „cenami sugerowanymi” i czy obowiązek Omnibus dotyczy strony producenta. Rekomendacja: stosować zasady Omnibus tak, jakby dotyczyły, bo to bezpieczne i uczciwe. [do potwierdzenia z prawnikiem]

## 10. Bezpieczeństwo

- **Sekrety tylko jako sekrety:**
  - Cloudflare Worker (`wrangler secret put`): `CONNECTOR_HMAC_SECRET`, `BUILD_EXPORT_TOKEN`, `SESSION_SECRET`, klucz dostawcy poczty;
  - GitHub Actions (Settings → Secrets): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BUILD_EXPORT_TOKEN`;
  - łącznik: dane logowania do Navireo w magazynie poświadczeń systemu Windows albo pliku z ograniczonymi uprawnieniami na serwerze Liveo;
  - lokalnie: `.dev.vars` (w `.gitignore`). Nigdy w repozytorium, nigdy w kodzie strony.
- **Najmniejsze uprawnienia:** osobny użytkownik Navireo dla łącznika — odczyt towarów, cen, stanów, kontrahentów i tylko tworzenie zamówień [do ustalenia, jakie uprawnienia Navireo pozwala nadać].
- **Sieć:** łącznik tylko wychodzi (HTTPS 443 do domeny API); żadnych przekierowań portów do ERP.
- **Strefa partnera:** hasła jako skrót PBKDF2 (Web Crypto) z solą; sesja — losowy token 256 bit, w bazie tylko jego skrót; cookie `HttpOnly; Secure; SameSite=Strict`, ważność 8 h [do decyzji];
  sprawdzanie nagłówka `Origin` przy każdym `POST`; limit prób logowania; logowanie dwuskładnikowe — [do decyzji]; dziennik zdarzeń (logowania, zamówienia) bez haseł.
- **Publiczne API:** lista dozwolonych domen (CORS), walidacja wejścia, limity zapytań, brak danych osobowych w logach, brak zapisu IP.
  Publiczne API nigdy nie zwraca cen partnerskich, ilości w magazynie ani danych kontrahentów (poza sklepami, które zgodziły się na publikację).
- **Formularze:** pole-pułapka, minimalny czas wypełnienia, limit zgłoszeń; bez zewnętrznych skryptów CAPTCHA (wydajność, prywatność).
- **Kopie zapasowe:** codzienny eksport bazy D1 [do ustalenia: retencja].
- **Rotacja sekretów:** co najmniej raz w roku i po każdej zmianie osób z dostępem.

## 11. Odporność na błędy

| Sytuacja | Zachowanie |
|---|---|
| Worker nie odpowiada | Strona działa na danych z HTML; strefa partnera pokazuje komunikat o przerwie |
| Łącznik nie synchronizuje | Alert po 1 h; po 24 h `stale: true` i ukryte statusy dostępności |
| Synchronizacja „usuwa” dużą część katalogu | Bezpiecznik odrzuca paczkę (> 20% mebli) i wysyła alert |
| Zamówienie nie utworzyło się w Navireo | Status `error`, alert do opiekuna, partner widzi „Wymaga kontaktu” |
| Podwójne wysłanie zamówienia | `Idempotency-Key` na stronie + sprawdzenie `webOrderId` przed utworzeniem dokumentu w ERP |
| Zmiana ceny w trakcie składania zamówienia | Wartość liczy ERP; partner widzi potwierdzone wartości po `ack` |

## 12. Etapy wdrożenia

| Etap | Zakres | Zależy od |
|---|---|---|
| **E0** (zrobione) | dane demo, `pricing.js`, `locator.js`, strona statyczna bez ERP | — |
| **E1** | import z Excela klienta → `src/data/` (opisy, wymiary, kolekcje); ceny ręcznie | Excel z meblami |
| **E2** | łącznik tylko do odczytu: meble, ceny, promocje, stany → Worker → build + `/api/prices` | dostęp do Navireo, decyzja o sposobie odczytu |
| **E3** | sklepy partnerskie z kontrahentów + uzupełnianie danych sklepów (godziny, kolekcje, usługi) | lista partnerów i zgody na publikację |
| **E4** | strefa partnera: logowanie, cenniki, zamówienia → Navireo (najpierw na środowisku testowym) | cenniki partnerów, typ dokumentu zamówienia |
| **E5** (opcjonalnie) | sprzedaż online: koszyk, płatności, regulamin sklepu | decyzja biznesowa |

## 13. Pytania do wdrożeniowca Navireo

**Dostęp i technologia**

1. Jaka wersja Navireo działa u Liveo i gdzie (serwer w firmie, chmura, hosting u wdrożeniowca)? Jaka wersja SQL Server?
2. Czy Liveo ma licencję na Sferę (albo inny interfejs programistyczny) dla Navireo? Jeśli nie — koszt i alternatywy (eksport XML/CSV, widoki SQL, gotowy moduł B2B).
3. Czy dopuszczacie odczyt bezpośrednio z bazy (widoki tylko do odczytu) i czy nie narusza to wsparcia?
4. Czy jest środowisko testowe (kopia bazy) do budowy i testów integracji?
5. Na jakim komputerze może działać łącznik (Windows w sieci Liveo?) i kto będzie go utrzymywać?
6. Jakie są ograniczenia wydajności — jak często możemy pytać o ceny i stany bez obciążania pracy firmy? Kiedy są okna serwisowe i aktualizacje?

**Meble (towary)**

7. Jak zbudowany jest symbol towaru? Czy każdy kolor to osobny towar? Jak powiązać kolory jednego mebla (wspólny model)?
8. Które pola są wypełnione: nazwa, opis, wymiary, waga, EAN, kolor, kolekcja, rodzaj mebla? Gdzie są zapisane (grupy, cechy, pola własne)?
9. Jak oznaczyć towary, które mają być na stronie, i towary wycofane?

**Ceny i promocje**

10. Który cennik lub poziom cen to cena detaliczna brutto dla klientów? Czy w ERP jest cena sugerowana?
11. Jak definiuje się promocje: jaki moduł lub mechanizm, jakie pola (zakres: towar / grupa / cecha; typ: procent / cena; daty i godziny; strefa czasowa), czy promocje mogą się łączyć?
12. Czy Navireo przechowuje historię zmian cen detalicznych? Od kiedy?
13. Jak są zbudowane ceny partnerskie: cennik dla kontrahenta, dla grupy, rabat indywidualny? Czy promocje producenta obejmują też ceny partnerskie?
14. Jak ERP zaokrągla ceny po rabacie i jak liczy VAT w zamówieniach?

**Stany**

15. Które magazyny liczą się do dostępności na stronie? Jak policzyć ilość dostępną (stan minus rezerwacje)?
16. Czy w ERP jest informacja o czasie realizacji albo o produkcji na zamówienie?

**Kontrahenci i partnerzy**

17. Jak oznaczeni są partnerzy handlowi (grupa, cecha)? Czy są w ERP dane potrzebne w wyszukiwarce: godziny otwarcia, kolekcje na ekspozycji, usługi, współrzędne?
18. Czy w ERP są osoby kontaktowe kontrahentów (do kont w strefie partnera), adresy dostaw i przypisany opiekun handlowy?

**Zamówienia**

19. Jaki dokument tworzyć dla zamówienia partnera (zamówienie od klienta?), w jakiej serii i na jakim magazynie? Które pola są wymagane?
20. Gdzie zapisać numer zamówienia ze strony i numer własny partnera, żeby były widoczne na dokumentach?
21. Czy cenę w zamówieniu ma wyliczyć ERP z cennika kontrahenta (nasza rekomendacja)?
22. Jakie statusy ma zamówienie w ERP i jak je odczytać (w realizacji, wysłane, zafakturowane, anulowane)?
23. Kto i jak potwierdza partnerowi termin dostawy?

**Organizacja**

24. Kto po stronie wdrożeniowca jest kontaktem technicznym, jaki jest czas reakcji i koszt prac po Waszej stronie?

## 14. Założenia przyjęte na czas pracy z danymi demo

Spisane w [`src/data/README.md`](../src/data/README.md) i [`do-potwierdzenia.md`](do-potwierdzenia.md), pkt 2–6:
indeks `LV-<KOLEKCJA>-<TYP><SZER>[-<KOLOR>]`; kolor nie zmienia ceny (struktura pozwala na `variants[].basePrice`);
promocje: procent albo cena, zakres kolekcja / typ / indeks, bez łączenia, zaokrąglenie w dół do pełnych złotych;
statusy dostępności: dostępny / na zamówienie (z liczbą dni) / wyprzedany; historia cen z 60 dni.
