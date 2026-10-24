#!/usr/bin/env bash
# Renderuje packshot każdego wariantu z src/data/products.json do src/assets/renders/products/<sku>--<kod>.webp.
# Pomija pliki, które już istnieją (można przerwać i wznowić). Ustawienia: 1200×900, 32 próbki (~35 s / plik na 4 rdzeniach).
set -u
cd "$(dirname "$0")/../.."
OUT=src/assets/renders/products
SAMPLES=${SAMPLES:-32}
SIZE=${SIZE:-1200x900}
mkdir -p "$OUT"
node -e "const p=require('./src/data/products.json');for(const x of p)for(const v of x.variants)console.log(x.sku+'--'+v.code)" | while read -r name; do
  [ -f "$OUT/$name.webp" ] && continue
  echo "$(date +%H:%M:%S) $name"
  node tools/render/render.mjs src/data/products.json "$OUT" --variants --only "$name" --samples "$SAMPLES" --size "$SIZE" --no-manifest >/dev/null 2>&1 || echo "  BŁĄD: $name"
done
echo "KONIEC: $(ls "$OUT" | wc -l) plików"
