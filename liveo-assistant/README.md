# Doradca wnętrz Liveo

Widżet czatu na stronę Liveo. Klient wysyła zdjęcie pokoju albo pisze, czego szuka, a doradca pokazuje komplet mebli z jednej kolekcji, dopasowany kolorystycznie.

- **Zdjęcia** analizuje przeglądarka klienta (model MobileCLIP + paleta barw). Zdjęcie nie wychodzi z urządzenia.
- **Rozmowa tekstowa** idzie przez Cloudflare Worker do OpenRouter (model językowy). Klucz OpenRouter jest tylko w Workerze.
- **Produkty** zawsze pochodzą z lokalnego katalogu (`data/catalog.json`). Model wybiera tylko akcję, np. „pokaż komody do sypialni”, a karty i ceny układa widżet. Model nie może wymyślić produktu ani ceny.
- **Bez Workera** (pusty `chatUrl` albo awaria) widżet działa w trybie lokalnym: rozumie proste polecenia bez AI.

## Struktura

| Ścieżka | Co to jest |
|---|---|
| `widget/liveo-assistant.js` | widżet (Shadow DOM), osadzany jedną linią |
| `widget/liveo-assistant.css` | style widżetu |
| `widget/recommender.js` | dobór kompletów z kolekcji |
| `widget/engine.js`, `widget/prompts.js` | analiza zdjęć w przeglądarce |
| `data/catalog.json` | katalog dla widżetu (generuje `tools/data/export-assistant-catalog.mjs` w roocie repo) |
| `data/wiedza.txt` | baza wiedzy dla modelu językowego (fakty o firmie, zakupach, kontakcie) |
| `worker/` | Cloudflare Worker: widżet → Worker → OpenRouter |
| `tools/build_catalog.py` | stary skrypt pobierający katalog ze starej strony (przejściowy) |
| `server.py`, `index.html` | lokalny podgląd |

## Osadzenie na stronie

```html
<script>
  window.LiveoAssistantConfig = {
    chatUrl: 'https://liveo-doradca.<subdomena-konta>.workers.dev/chat', // adres Workera
    contactUrl: '/kontakt/',
    storesUrl: '/gdzie-kupic/',
    demoSamples: false,
    teaser: true,        // dymek z podpowiedzią obok przycisku (strona Liveo wyłącza go poniżej 48rem)
  };
</script>
<script type="module" src="/liveo-assistant/widget/liveo-assistant.js"></script>
```

## Uruchomienie Workera (pierwszy raz)

1. **OpenRouter:** utwórz klucz API na koncie z kredytami i ustaw na nim **limit wydatków**. To twarda ochrona przed nadużyciem; limit zapytań w Workerze działa w trybie „best effort”.
2. **Cloudflare:** utwórz token API z uprawnieniem „Edit Cloudflare Workers” i skopiuj ID konta.
3. **GitHub → Settings → Secrets and variables → Actions:** dodaj sekrety `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` i `OPENROUTER_API_KEY`.
4. **Wdrożenie:** push zmian w `liveo-assistant/worker/` na `main` albo ręczne uruchomienie akcji „Doradca wnętrz – Worker”.
5. **Sprawdzenie:** `https://liveo-doradca.<subdomena>.workers.dev/health` ma zwrócić `{"ok":true,"configured":true}`.
6. **Podpięcie:** wpisz ten adres z `/chat` na końcu jako `chatUrl` w konfiguracji widżetu na stronie.

Ustawienia w `worker/wrangler.toml`:
- `ALLOWED_ORIGINS`: domeny, z których widżet może pytać Workera.
- `MODELS`: łańcuch modeli. Pierwszy to główny, kolejne są zapasowe przy błędach 429/5xx. Przy braku kredytów (402) Worker od razu przestaje próbować.
- `KNOWLEDGE_URL`: opcjonalnie adres aktualnej bazy wiedzy na stronie (cache 5 min). Bez tego Worker używa `data/wiedza.txt` z chwili wdrożenia.

## Lokalnie

```bash
# widżet w trybie lokalnym
python3 server.py                      # → http://localhost:5180

# czat z AI: Worker lokalnie (wymaga pliku worker/.dev.vars z OPENROUTER_API_KEY=...)
cd worker && npm install && npx wrangler dev   # → http://127.0.0.1:8787
# potem: http://localhost:5180/?chat=http://127.0.0.1:8787/chat

# testy Workera
cd worker && npm test
```

`worker/.dev.vars` jest w `.gitignore` i nie trafia do repo.

## Prywatność i AI Act

- Do OpenRouter trafia tylko tekst rozmowy oraz skrót katalogu, bez zdjęć i danych osobowych zbieranych przez widżet. Ten przepływ trzeba opisać w polityce prywatności strony.
- Worker nie loguje treści rozmów. W logach są tylko model, status i czas odpowiedzi.
- Stopka widżetu informuje, że odpowiada asystent AI (art. 50 AI Act).
