# Standard odbioru: SEO, GEO, dostępność

Strona nie przechodzi do publikacji, dopóki każdy punkt nie jest spełniony albo świadomie odłożony z wpisem w `docs/do-potwierdzenia.md`.
Sprawdzamy na zbudowanym `dist/` (skrypty w `tools/check/`) oraz w przeglądarce (Lighthouse, axe-core, klawiatura).

## 1. SEO techniczne

- [ ] Każda strona ma unikalny `<title>` (≤ 60 znaków) i meta description (≤ 155), `lang="pl"`, canonical (absolutny, ze slashem na końcu), Open Graph i Twitter Card z obrazem 1200×630.
- [ ] Jeden `<h1>` na stronę, nagłówki bez przeskoków (h1 → h2 → h3).
- [ ] `sitemap.xml` z `lastmod`, w tym wszystkie kolekcje, kategorie, pomieszczenia, produkty i poradniki. Strony DEMO i strefa partnera mają `noindex` i nie trafiają do sitemapy.
- [ ] `robots.txt`: allow all, link do sitemapy. Boty AI (GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended) nie są blokowane.
- [ ] Czyste URL-e po polsku bez znaków diakrytycznych, przekierowania 301 ze starych adresów liveomeble.pl (lista w `docs/ia.md`). Na GitHub Pages: plik z `meta refresh` + `noindex, follow` + canonical na nowy adres.
- [ ] Brak martwych linków wewnętrznych i brakujących plików (crawler po `dist/`).
- [ ] Obrazy: `alt` po polsku opisujący mebel (kolekcja, typ, kolor), `width`/`height`, AVIF/WebP, `loading="lazy"` poniżej pierwszego ekranu, LCP z `fetchpriority="high"`.
- [ ] Core Web Vitals: Lighthouse ≥ 98 we wszystkich czterech kategoriach (desktop i mobile, 3 pomiary, mediana), CLS ≈ 0, TBT < 100 ms. Obecna strona: 95 / 89 / 96 / 100.
- [ ] Paginacja i filtry na `/meble/` nie tworzą duplikatów do indeksowania: filtry działają w przeglądarce, a kategorie mają własne statyczne URL-e.

## 2. Dane strukturalne (JSON-LD)

- [ ] Strona główna: `Organization` (nazwa, logo, adres, `sameAs` do profili społecznościowych, gdy klient je poda) + `WebSite`.
- [ ] Produkt: `Product` (nazwa, sku, marka Liveo, kolekcja jako `isRelatedTo`/`model`, wymiary `width`/`height`/`depth` w CMT, kolor, materiał, obrazy) + `Offer` z ceną i `priceValidUntil` dla promocji. Uwaga: produkty kupuje się u partnerów, więc Google może pokazywać fragmenty produktu, ale nie wyniki zakupowe — opisać to klientowi.
- [ ] Kolekcja i kategoria: `CollectionPage` + `ItemList` produktów.
- [ ] Każda strona poza główną: `BreadcrumbList` zgodny z okruszkami na stronie.
- [ ] FAQ: `FAQPage` z pytaniami i odpowiedziami słowo w słowo jak na stronie (sprawdzane skryptem).
- [ ] Poradnik: `Article`/`BlogPosting` (autor, data, data modyfikacji, obraz).
- [ ] Gdzie kupić: sklepy partnerskie jako `Store`/`FurnitureStore` dopiero przy prawdziwych danych (dane demo nie trafiają do JSON-LD).
- [ ] Każdy blok JSON-LD parsuje się i przechodzi walidację schematu (skrypt + Rich Results Test po wdrożeniu).

## 3. GEO (widoczność w ChatGPT, Perplexity, Gemini, AI Overviews)

- [ ] `llms.txt` w roocie: kim jest Liveo, jak kupić (sklepy partnerskie), lista kolekcji i kluczowych stron z jednozdaniowym opisem.
- [ ] Nagłówki H2 jako pytania klientów, a odpowiedź konkretna w pierwszym zdaniu sekcji (np. „Gdzie kupić meble Liveo?” → „W sklepach partnerskich; najbliższy znajdziesz po kodzie pocztowym.”).
- [ ] Fakty w tekście, nie tylko w obrazkach: wymiary w cm, kolory, materiały, liczba szuflad i półek, dostępne warianty.
- [ ] Tabele porównawcze (np. komody w kolekcjach: szerokość, szuflady, kolory, cena od).
- [ ] Spójna encja firmy: ta sama nazwa, adres i opis na stronie, w JSON-LD, wizytówce Google i profilach społecznościowych.
- [ ] Poradnik linkuje do kolekcji i kategorii, a kolekcje do poradnika.
- [ ] Po wdrożeniu: Google Search Console + **Bing Webmaster Tools** (ChatGPT korzysta z indeksu Bing) + IndexNow przy publikacji zmian.
- [ ] Żadnych zmyślonych liczb ani twierdzeń — modele AI cytują stronę dosłownie.

## 4. Dostępność (WCAG 2.2 AA)

Od 28 czerwca 2025 r. Europejski Akt o Dostępności (w Polsce ustawa o zapewnianiu spełniania wymagań dostępności niektórych produktów i usług) obejmuje m.in. handel elektroniczny dla konsumentów. Jeśli Liveo uruchomi sprzedaż online, dostępność będzie wymogiem prawnym — to nie porada prawna, do potwierdzenia z prawnikiem klienta.

- [ ] Lighthouse Accessibility 100 i **zero błędów axe-core** na każdym typie strony (główna, kolekcja, kategoria, pomieszczenie, produkt, gdzie kupić, dla partnerów, strefa partnera, kontakt, poradnik, 404).
- [ ] Skip-link, landmarki (`header`, `nav`, `main`, `footer`), widoczny fokus (min. 2 px, kontrast 3:1) na każdym interaktywnym elemencie.
- [ ] Kontrast tekstu ≥ 4.5:1 (duży ≥ 3:1), także na zdjęciach, na cenach promocyjnych i w stanach hover/fokus.
- [ ] Cała strona obsługiwana klawiaturą: menu i menu mobilne (Esc zamyka, fokus wraca), filtry, przełącznik wariantów kolorów, galeria, formularze, akordeony FAQ, widżet doradcy.
- [ ] Formularze: etykiety, komunikaty błędów powiązane z polem (`aria-describedby`), `aria-live` dla wyników wyszukiwania sklepów i filtrów, autouzupełnianie (`autocomplete`).
- [ ] Cele dotykowe min. 24×24 px (WCAG 2.2), zalecane 44×44 px na telefonie.
- [ ] Kolor nie jest jedyną informacją: wariant koloru ma nazwę tekstową, promocja ma tekst, nie tylko czerwień.
- [ ] Powiększenie 200% i szerokość 320 px bez utraty treści i bez poziomego scrolla.
- [ ] `prefers-reduced-motion` respektowane, brak automatycznie ruszających się treści bez pauzy.
- [ ] Teksty alternatywne: produktowe opisowe, dekoracyjne `alt=""`.
- [ ] Język prosty, linki opisowe (nie „kliknij tutaj”), komunikaty błędów mówią, co poprawić.

## 5. Jak sprawdzamy

1. `npm run build` → `tools/check/run-all.mjs`: JSON-LD, FAQ = tekst, nagłówki, linki, meta, sitemap.
2. axe-core (Playwright) na wszystkich szablonach stron, desktop i 390 px.
3. Lighthouse desktop i mobile, 3 pomiary na szablon, mediana.
4. Test klawiatury i czytnika ekranu na kluczowych ścieżkach: wybór mebla → wariant → gdzie kupić; filtr mebli; formularz partnera; doradca.
5. Niezależny audyt agentów (każde znalezisko weryfikowane przed poprawką), raport w PR.
