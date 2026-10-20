// Pozwala uruchomić wszystkie testy danych poleceniem:  node --test tools/data/
// Node 22+ traktuje katalog jako moduł i wczytuje ten plik (Node 20 sam znajduje *.test.mjs).
// Dynamiczny import działa zarówno w CommonJS, jak i w ESM ("type": "module").
for (const f of ['./pricing.test.mjs', './locator.test.mjs', './data.test.mjs']) import(f);
