# Silnik renderów 3D (atrapy zdjęć)

Parametryczne meble (kontrakt `model3d`) renderowane w three.js w headless Chromium (SwiftShader, offline).
Wyniki to **atrapy** do czasu otrzymania zdjęć od klienta — opis plików w `src/assets/renders/manifest.json`.

## Instalacja

```bash
cd tools/render && npm install      # three@0.186.1, sharp, playwright-core (bez pobierania przeglądarek)
```

Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (inna ścieżka: `CHROME_PATH=...`).
Port lokalnego serwera: 8801 (`RENDER_PORT=...`).

## Packshoty (przezroczyste tło, cień kontaktowy, 1600×1200 WebP z alfą)

```bash
node tools/render/render.mjs tools/render/specs/sample.json src/assets/renders/sample
node tools/render/render.mjs src/data/products.json <katalog>              # cały katalog (model3d z produktów)
node tools/render/render.mjs src/data/products.json <katalog> --variants   # każdy wariant wykończenia osobno
```

Opcje: `--only nazwa1,nazwa2` (fragment nazwy pliku), `--samples 160` (próbki akumulacji: AA + miękkie cienie),
`--size 1600x1200`, `--png` (podgląd PNG), `--no-manifest`.
Spec: `{ "defaults": {...}, "items": [ { "file": "komoda-bialy-mat.webp", "title": "...", "model": { model3d } } ] }`
albo tablica produktów z polem `model3d`. Meble wiszące (`base: "hanging"`, `mountH`) renderowane są „na ścianie”
— z miękkim cieniem rzucanym na niewidoczną ścianę za meblem.

## Aranżacje (wnętrza, JPEG 2400×1350 `-wide` i 1200×1500 `-tall`)

```bash
node tools/render/rooms.mjs                                  # wszystkie pokoje, oba kadry → src/assets/renders/rooms/
node tools/render/rooms.mjs --only sypialnia --frame wide    # wybrane
node tools/render/rooms.mjs --preview --out /tmp/podglad     # szybki podgląd (40% rozmiaru, mniej próbek)
```

Definicje pokoi (meble, dekor, kamery, słońce, miejsce na tekst): `web/js/rooms.js`. Domyślnie 64 próbki akumulacji
(`--samples N`). Czas na 4 rdzeniach CPU (SwiftShader): ~4,5 min kadr wide + ~2,5 min kadr tall, czyli ~7 min na pokój
i ~45–55 min cały zestaw; packshot 1600×1200 przy 128–160 próbkach: ~3–5 min.

## Aranżacje kolekcji (każda kolekcja we własnym wnętrzu)

```bash
RENDER_PORT=8802 node tools/render/collections.mjs                 # wszystkie → src/assets/renders/collections/<slug>-wide|tall.jpg
node tools/render/collections.mjs --only nokta --preview --frame wide --scale 0.3 --samples 16 --out /tmp/podglad
```

Scena = pokój z `web/js/rooms.js` zgodny z `heroRoom` kolekcji, w którym meble bazowe zastępują meble kolekcji
(`model3d` z `src/data/products.json` w kolorze wybranego wariantu); mapa SKU → klucz modelu w `SCENES` w `collections.mjs`.
Pozycje dekoracji liczone są z wymiarów mebla. `src/lib/images.ts` bierze `collections/<slug>` przed poglądowym zdjęciem
pomieszczenia. Czas: ~6–8 min na kadr wide i ~3–4 min tall (4 rdzenie, przy równoległych packshotach).

## Budowa

- `web/js/furniture.js` — meble z `model3d` (korpus z płyt 1,8 cm, fronty ze szczelinami 3 mm, uchwyty, podstawy, łóżko z pościelą, stoły, lustra, wieszak),
- `web/js/materials.js`, `textures.js` — wykończenia (proceduralne słoje drewna, lakier, metal, szkło, tkaniny, tynk, deski, beton),
- `web/js/engine.js` — akumulacja progresywna (jitter subpikselowy = SSAA, losowane źródła = miękkie cienie), GTAO, ACES + łagodna „stopka” cieni, sRGB;
  łatka three.js: cienie rzucają tylko obiekty z warstwy `shadow.camera.layers` danego światła,
- `web/js/studio.js` — packshoty; `web/js/room.js` — wnętrza (słońce + niebo przez okno, odbicia z mapy otoczenia pokoju),
- `lib/driver.mjs` — serwer statyczny + Playwright + zapis (sharp), `lib/manifest.mjs` — `manifest.json`.
