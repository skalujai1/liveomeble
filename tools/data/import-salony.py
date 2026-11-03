#!/usr/bin/env python
# Baza salonów partnerskich (xlsx) → tools/data/salony-liveo.json (czyta go generate.mjs).
#
#   python tools/data/import-salony.py [tools/data/salony-liveo.xlsx]
#
# Plik xlsx jest źródłem prawdy (od 03.11.2026): kolumny Nazwa, Adres, Województwo, Oferta, Szerokość, Długość, Uwagi.
# Lista pochodzi z liveomeble.pl/salony-partnerskie (448 salonów: 443 w Polsce, 5 w Słowenii) z poprawkami opisanymi w „Uwagach”.
# Identyfikatory salonów z poprzedniej wersji zostają (dopasowanie po nazwie i adresie), nowe dostają id z nazwy i adresu.
import json, os, re, sys, hashlib, unicodedata
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'salony-liveo.xlsx')
OUT = os.path.join(HERE, 'salony-liveo.json')

norm = lambda s: ' '.join(str(s or '').split())
key = lambda name, addr: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', f'{name}{addr}'.lower()).encode('ascii', 'ignore').decode())

old_ids = {}
if os.path.exists(OUT):
    for s in json.load(open(OUT, encoding='utf-8'))['stores']:
        old_ids[key(s['name'], f"{s['street']}, {s['postcode']} {s['city']}")] = s['id']

ws = openpyxl.load_workbook(SRC, data_only=True).worksheets[0]
rows = ws.iter_rows(values_only=True)
header = [norm(h) for h in next(rows)]
col = {h: i for i, h in enumerate(header)}
need = ['Nazwa', 'Adres', 'Województwo', 'Oferta', 'Szerokość', 'Długość', 'Uwagi']
missing = [h for h in need if h not in col]
if missing:
    raise SystemExit(f'Brak kolumn w {SRC}: {missing}')

stores, seen = [], set()
for r in rows:
    get = lambda h: r[col[h]]
    name, addr = norm(get('Nazwa')), norm(get('Adres'))
    if not name:
        continue
    lat, lng = float(get('Szerokość')), float(get('Długość'))
    region = norm(get('Województwo'))
    note = norm(get('Uwagi')) or None
    country = 'SI' if region.lower() == 'słowenia' or addr.lower().endswith('słowenia') else 'PL'
    if country == 'PL':
        m = re.match(r'^(.*),\s*(\d{2}-\d{3})\s+(.+)$', addr)
        if not m:
            raise SystemExit(f'Nie rozumiem adresu: {addr} ({name})')
        street, postcode, city = m.group(1).strip(), m.group(2), m.group(3).strip()
    else:
        parts = [p.strip() for p in addr.split(',')]
        street = parts[0]
        m = re.match(r'^(?:SI-)?(\d{4})\s+(.+)$', parts[1], re.I)
        postcode, city = (m.group(1), m.group(2).title()) if m else ('', parts[1].title())
    k = key(name, f'{street}, {postcode} {city}')
    sid = old_ids.get(k) or 'x' + hashlib.sha1(k.encode()).hexdigest()[:8]
    while sid in seen:
        sid += 'b'
    seen.add(sid)
    stores.append({
        'id': sid, 'name': name, 'street': street, 'postcode': postcode, 'city': city, 'country': country,
        'voivodeship': region.lower() if country == 'PL' else None,
        'lat': round(lat, 6), 'lng': round(lng, 6),
        'offer': [x.strip() for x in norm(get('Oferta')).split(',') if x.strip()],
        'approx': bool(note and re.search(r'przybliżon|centrum miasta', note, re.I)),
        'note': note,
    })

out = {
    'source': 'tools/data/salony-liveo.xlsx (baza salonów od Michała, 03.11.2026; lista z liveomeble.pl/salony-partnerskie)',
    'stores': stores,
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
pl = sum(s['country'] == 'PL' for s in stores)
print(f'{len(stores)} salonów ({pl} w Polsce, {len(stores) - pl} za granicą), '
      f'zachowane id: {sum(s["id"] in old_ids.values() for s in stores)} → {OUT}')
