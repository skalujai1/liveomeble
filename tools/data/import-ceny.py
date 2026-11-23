#!/usr/bin/env python3
# Ceny ze sklepu liveomeble.pl → tools/data/ceny-liveomeble.json (czyta go generate.mjs).
#
#   python3 tools/data/import-ceny.py
#
# Dla każdego mebla w sklepie: indeks (reference), cena, cena przed obniżką i daty promocji — dokładnie tak,
# jak pokazuje je sklep. Indeks ma ten sam format co indeks wariantu w kartach produktu („DT01 D/C/T/A KPL”),
# więc generate.mjs łączy ceny z wariantami 1:1. Ceny i promocje w sklepie się zmieniają — skrypt uruchamiamy,
# gdy chcemy odświeżyć ceny na stronie; plik zapisuje datę odczytu. Tylko biblioteka standardowa Pythona.
#
# Skąd dane: lista mebli z kategorii sklepu (wszystkie strony), potem strona każdego mebla — atrybut
# data-product (PrestaShop) z polami reference, price_amount, price_without_reduction, has_discount,
# specific_prices (od kiedy / do kiedy trwa obniżka), cechą „Kod / symbol producenta” (model, np. DT01)
# i atrybutami koloru (korpus, front). Część mebli (np. DANTE) nie ma w sklepie indeksu — wtedy generate.mjs
# łączy je z wariantem po modelu i kolorach.
import html
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://liveomeble.pl'
# Kategorie nadrzędne + wszystkie kategorie z menu sklepu (kolekcje, pomieszczenia, rodzaje mebli). Kategoria
# nadrzędna w PrestaShop nie pokazuje mebli z podkategorii, więc przechodzimy po każdej z osobna.
CATEGORIES = ['/51-kolekcje', '/3-pomieszczenia', '/11-rodzaj-mebla', '/143-zestawy-kuchenne']


def menu_categories():
    s = get(BASE + '/')
    paths = re.findall(r'href="https://liveomeble\.pl(/\d+-[a-z0-9-]+)"[^>]*data-title=', s)
    return list(dict.fromkeys(CATEGORIES + paths))
OUT = Path(__file__).resolve().parent / 'ceny-liveomeble.json'
UA = 'Mozilla/5.0 (Liveo www, synchronizacja cen)'


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:  # sieć bywa kapryśna — kilka prób z przerwą
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def listing(path):
    """Wszystkie strony kategorii → {id_product: url}."""
    found, page = {}, 1
    while page <= 60:
        s = get(f'{BASE}{path}?page={page}')
        a = s.find('id="js-product-list"')
        if a < 0:
            break
        b = s.find('class="bottom_pagination', a)
        body = s[a:b if b > 0 else None]
        hits = re.findall(r'data-id-product="(\d+)"[^>]*>.*?<h3[^>]*>\s*<a href="([^"]+)"', body, re.S)
        for pid, url in hits:
            found.setdefault(int(pid), html.unescape(url).split('#')[0])
        print(f'  {path} strona {page}: {len(hits)}', file=sys.stderr)
        if not hits or 'rel="next"' not in (s[b:] if b > 0 else ''):
            break
        page += 1
    return found


def money(v):
    return None if v in (None, '', False) else round(float(v), 2)


def product(pid, url):
    s = get(url)
    m = re.search(r'data-product="([^"]+)"', s)
    if not m:
        return {'id_product': pid, 'url': url, 'error': 'brak data-product'}
    d = json.loads(html.unescape(m.group(1)))
    # Grupy atrybutów z formularza wariantów: więcej niż jedna opcja w grupie = kilka kombinacji na jednej stronie
    form = s[s.find('product-variants'):][:20000] if 'product-variants' in s else ''
    options = {}
    for g in re.findall(r'name="group\[(\d+)\]"', form):
        options[g] = options.get(g, 0) + 1
    sp = d.get('specific_prices') or {}
    sp = sp if isinstance(sp, dict) else {}
    discounted = bool(d.get('has_discount'))
    feats = {' '.join(str(f.get('name', '')).split()).lower(): ' '.join(str(f.get('value', '')).split())
             for f in d.get('features') or [] if isinstance(f, dict)}
    attrs = {' '.join(str(a.get('group', '')).split()).lower(): ' '.join(str(a.get('name', '')).split())
             for a in (d.get('attributes') or {}).values() if isinstance(a, dict)}
    # Omnibus w sklepie: „Najniższa cena tego produktu z ostatnich 30 dni: 1049 zł” (bez groszy albo z groszami)
    omnibus = re.search(r'class="info_omnimus">[^<]*?:\s*(?:<b>)?\s*(\d[\d\s ]*(?:,\d{2})?)\s*zł', s)
    return {
        'reference': (d.get('reference') or '').strip(),
        'name': html.unescape(d.get('name') or '').strip(),
        'model': feats.get('kod / symbol producenta') or None,
        'collection': feats.get('nazwa kolekcji') or None,
        'b2bName': feats.get('nazwa w systemie b2b') or None,
        'body': attrs.get('kolorystyka korpusu') or feats.get('korpus kolorystyka') or None,
        'front': attrs.get('dostępna kolorystyka frontu') or None,
        'id_product': pid,
        'id_product_attribute': d.get('id_product_attribute'),
        'url': url,
        'price': money(d.get('price_amount')),
        # cena przed obniżką tylko przy promocji (tak jak przekreślona cena w sklepie)
        'regular': money(d.get('price_without_reduction')) if discounted else None,
        'discount': ({'type': d.get('discount_type'), 'percent': d.get('discount_percentage_absolute'),
                      'amount': d.get('discount_amount')} if discounted else None),
        'from': (sp.get('from') or None) if discounted else None,
        'to': (sp.get('to') or None) if discounted else None,
        'omnibus': (float(omnibus.group(1).replace(' ', '').replace(' ', '').replace(',', '.'))
                    if omnibus else None),
        'multiOption': any(n > 1 for n in options.values()),
        'available': d.get('availability'),
    }


def main():
    print('Lista mebli z kategorii liveomeble.pl …', file=sys.stderr)
    ids = {}
    for c in menu_categories():
        for pid, url in listing(c).items():
            ids.setdefault(pid, url)
    print(f'Mebli w sklepie: {len(ids)}. Pobieram strony mebli …', file=sys.stderr)

    with ThreadPoolExecutor(4) as ex:
        items = list(ex.map(lambda kv: product(*kv), sorted(ids.items())))

    errors = [i for i in items if i.get('error')]
    items = [i for i in items if not i.get('error') and i['price'] is not None and (i['reference'] or i['model'])]
    items.sort(key=lambda i: (i['reference'] or '~', i['model'] or '', i['id_product']))
    OUT.write_text(json.dumps({
        'source': BASE,
        'fetchedAt': datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds'),
        'note': 'Ceny brutto ze sklepu liveomeble.pl; regular = cena przed obniżką (tylko przy promocji). '
                'Generowany przez tools/data/import-ceny.py.',
        'count': len(items),
        'items': items,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    promo = sum(1 for i in items if i['regular'])
    print(f'Zapisano {len(items)} cen ({promo} w promocji, {len(errors)} błędów) → {OUT}', file=sys.stderr)


if __name__ == '__main__':
    main()
