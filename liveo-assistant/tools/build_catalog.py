#!/usr/bin/env python3
"""
Buduje data/catalog.json na podstawie sklepu liveomeble.pl.

Uruchomienie (z katalogu liveo-assistant):
    python3 tools/build_catalog.py

Skrypt przechodzi po kategoriach "Pomieszczenia" (salon, jadalnia, kuchnia ...),
zbiera produkty z cenami i zdjęciami, a następnie dla każdego produktu ustala:
  - typ mebla (komoda, RTV, szafa ...),
  - kolorystykę z domyślnego wariantu (np. "dąb evoke / czarny") i jej cechy
    (jasność, drewno, czarne akcenty, połysk),
  - pomieszczenia, do których sklep go przypisuje,
  - czy jest bestsellerem (sekcja "Bestsellery" na stronie głównej).
Elementy techniczne (fronty, korpusy, blaty, hamulce ...) są pomijane.
Używa wyłącznie biblioteki standardowej Pythona.
"""
import html
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

BASE = "https://liveomeble.pl"
ROOMS = {
    "salon": "/4-pokoj-dzienny",
    "jadalnia": "/5-jadalnia",
    "kuchnia": "/6-kuchnia",
    "mlodziezowy": "/7-pokoj-mlodziezowy",
    "sypialnia": "/8-sypialnia",
    "przedpokoj": "/9-przedpokoj",
    "biuro": "/10-biuro",
}
OUT = Path(__file__).resolve().parent.parent / "data" / "catalog.json"

# --- typy mebli (kolejność ma znaczenie: pierwsze dopasowanie wygrywa) -------
EXCLUDE = re.compile(
    r"^_|FRONT|KORPUS|BLAT|HAMULEC|COKÓŁ|PÓŁKI WEWNĘTRZNE|PANEL|ZLEW|BLENDA|"
    r"OŚWIETLENIE|LED\b|STELAŻ|MATERAC|PODNOŚNIK|ZAWIAS"
)
TYPES = [
    ("zestaw_kuchenny", r"^ELIZA \d{3} KPL"),
    ("szafka_kuchenna", r"SZAFKA (GÓRNA|DOLNA)|^ELIZA EZ-|^MODENA MD"),
    ("lozko", r"ŁOŻE|ŁÓŻKO"),
    ("szafka_nocna", r"SZAFKA NOCNA"),
    ("toaletka", r"TOALETKA"),
    ("biurko", r"BIURKO"),
    ("stol", r"STÓŁ"),
    ("lawa", r"ŁAWA"),
    ("rtv", r"\bRTV\b"),
    ("witryna", r"WITRYNA"),
    ("kredens", r"KREDENS"),
    ("komoda", r"KOMODA"),
    ("regal", r"REGAŁ"),
    ("szafa", r"\bSZAFA\b"),
    ("szafka_na_buty", r"\bBUTY\b"),
    ("wieszak", r"WIESZAK|GARDEROBA"),
    ("lustro", r"^\S+ \S+ LUSTRO|\bLUSTRO\b"),
    ("polka", r"PÓŁKA"),
    ("zestaw", r"ZESTAW"),
    ("szafka", r"SZAFKA"),
]

# --- kolorystyka -----------------------------------------------------------
# jasność 0 (czarny) .. 1 (biały)
WOODS = {
    "sonoma": 0.72, "craft": 0.6, "evoke": 0.5, "cremona": 0.55, "april": 0.6,
    "grandson": 0.55, "kamienny": 0.5, "wotan": 0.35, "castello": 0.42,
    "nagano": 0.62, "mauvella": 0.62, "artisan": 0.5, "milano": 0.45,
    "wenge": 0.15, "truflowy": 0.45, "torro": 0.5, "cotta": 0.5,
}
COLORS = {
    "bialy": ("biały", 0.95), "biala": ("biała", 0.95), "biel": ("biel", 0.95),
    "kaszmir": ("kaszmir", 0.8), "szampanski": ("szampański", 0.8),
    "szary": ("szary", 0.55), "beton": ("beton", 0.5), "zielony": ("zielony", 0.35),
    "grafit": ("grafit", 0.2), "antracyt": ("antracyt", 0.2), "czarny": ("czarny", 0.05),
    "travertyn": ("trawertyn", 0.8), "zloty": ("złoty", 0.6),
}
WORD_PL = {"dab": "dąb", "zloty": "złoty", "polysk": "połysk", "jasna": "jasna",
           "ciemna": "ciemna", "jasny": "jasny", "ciemny": "ciemny", "alpejska": "alpejska"}


def color_profile(key):
    """'dab_evoke_czarny_polysk' -> etykieta + cechy kolorystyczne."""
    if not key:
        return None
    t = key.split("_")
    parts, lights, wood, black, gloss, i = [], [], False, False, False, 0
    while i < len(t):
        w = t[i]
        if w == "dab":
            j, name = i + 1, ["dąb"]
            light = 0.55
            while j < len(t) and (t[j] in WOODS or (t[j] == "zloty" and t[j - 1] == "craft")):
                name.append(WORD_PL.get(t[j], t[j]))
                light = WOODS.get(t[j], light)
                j += 1
            parts.append(" ".join(name)); lights.append(light); wood = True; i = j; continue
        if w == "orzech":
            j, name, light = i + 1, ["orzech"], 0.32
            while j < len(t) and t[j] in ("ciemny", "opera"):
                name.append(t[j]); light = 0.22 if t[j] == "ciemny" else light; j += 1
            parts.append(" ".join(name)); lights.append(light); wood = True; i = j; continue
        if w == "rijeka":
            shade = t[i + 1] if i + 1 < len(t) else ""
            parts.append(f"rijeka {shade}".strip()); lights.append(0.75 if shade == "jasna" else 0.3)
            wood = True; i += 2; continue
        if w == "buk":
            parts.append("buk"); lights.append(0.7); wood = True; i += 1; continue
        if w in ("wenge",):
            parts.append("wenge"); lights.append(0.15); wood = True; i += 1; continue
        if w in COLORS:
            label, light = COLORS[w]
            if w == "biel" and i + 1 < len(t) and t[i + 1] == "alpejska":
                label, i = "biel alpejska", i + 1
            if w == "travertyn" and i + 1 < len(t) and t[i + 1] in ("jasny", "ciemny"):
                label, i = f"trawertyn {t[i + 1]}", i + 1
            parts.append(label); lights.append(light)
            black = black or w in ("czarny", "grafit", "antracyt")
            i += 1; continue
        if w in ("mat", "polysk"):
            if parts:
                parts[-1] += " " + WORD_PL.get(w, w)
            gloss = gloss or w == "polysk"
            i += 1; continue
        i += 1  # nieznany token – pomijamy
    if not parts:
        return None
    # pierwszy kolor to zwykle korpus – ma większą wagę
    weights = [2.0] + [1.0] * (len(lights) - 1)
    light = sum(l * w for l, w in zip(lights, weights)) / sum(weights)
    label = " / ".join(parts)
    return {"label": label[0].upper() + label[1:], "light": round(light, 2),
            "wood": wood, "black": black, "gloss": gloss}


def color_key(url, name):
    frag = url.split("#", 1)[1] if "#" in url else ""
    m = re.findall(r"kolorystyka[a-z_]*-([a-z_]+)", frag)
    if m:
        # wariant frontu zwykle zawiera też kolor korpusu ("dab_evoke_czarny_polysk") – bierzemy najdłuższy opis
        return max(m, key=len)
    # brak wariantu w URL – szukamy kolorów w nazwie
    n = (name.lower().replace("ą", "a").replace("ę", "e").replace("ł", "l").replace("ó", "o")
         .replace("ś", "s").replace("ż", "z").replace("ź", "z").replace("ć", "c").replace("ń", "n"))
    n = re.sub(r"[^a-z ]", " ", n)
    toks = [w for w in n.split() if w in WOODS or w in COLORS or w in ("dab", "orzech", "rijeka", "jasna", "ciemna", "polysk", "mat", "buk")]
    return "_".join(toks) or None


# --- pobieranie ------------------------------------------------------------
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Liveo assistant catalog sync)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse_list(page):
    start = page.find('id="js-product-list"')
    if start < 0:
        return [], False
    end = page.find('class="bottom_pagination', start)
    body = page[start:end if end > 0 else None]
    out = []
    for chunk in body.split('js-product-miniature"')[1:]:
        pid = re.search(r'data-id-product="(\d+)"', chunk)
        a = re.search(r'<h3[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', chunk, re.S)
        img = re.search(r'<img[^>]+(?:data-src|src)="(https://liveomeble\.pl/[^"]+home_default[^"]*)"', chunk)
        price = re.search(r'itemprop="price" content="([\d.]+)"', chunk)
        reg = re.search(r'class="regular-price"[^>]*>(.*?)</span>', chunk, re.S)
        if not (pid and a):
            continue
        regular = None
        if reg:
            txt = re.sub(r"[^\d,]", "", clean(reg.group(1))).replace(",", ".")
            regular = float(txt) if txt else None
        out.append({"id": int(pid.group(1)), "name": clean(a.group(2)), "url": html.unescape(a.group(1)),
                    "img": img.group(1) if img else None,
                    "price": float(price.group(1)) if price else None, "regular": regular})
    tail = page[end:] if end > 0 else ""
    return out, bool(re.search(r'rel="next"', tail))


def scrape_room(room):
    items, p = [], 1
    while p <= 40:
        got, has_next = parse_list(get(f"{BASE}{ROOMS[room]}?page={p}"))
        items += got
        print(f"  {room:12s} strona {p:2d}: {len(got)} produktów", file=sys.stderr)
        if not got or not has_next:
            break
        p += 1
    return room, items


def home_info():
    """Bestsellery i adresy stron kolekcji (z menu) ze strony głównej."""
    page = get(BASE + "/")
    a = page.find("Bestsellery")
    b = page.find("Nowości", a)
    best = {int(x) for x in re.findall(r'data-id-product="(\d+)"', page[a:b])} if a > 0 else set()
    links = re.findall(r'href="(https://liveomeble\.pl/\d+-[a-z0-9-]+)"[^>]*data-title="([^"]+)"', page)
    collections = {}
    for url, title in links:
        collections.setdefault(html.unescape(title).strip().upper(), url)
    return best, collections


def main():
    print("Pobieram kategorie pomieszczeń z liveomeble.pl …", file=sys.stderr)
    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(scrape_room, ROOMS))
    best, collection_urls = home_info()

    products = {}
    for room, items in results:
        for it in items:
            p = products.setdefault(it["id"], {**it, "rooms": []})
            if room not in p["rooms"]:
                p["rooms"].append(room)

    catalog = []
    for p in products.values():
        name = p["name"].strip()
        up = name.upper()
        if not p["price"] or not p["img"] or EXCLUDE.search(up):
            continue
        ptype = next((t for t, rx in TYPES if re.search(rx, up)), None)
        if not ptype:
            continue
        words = name.split()
        collection = words[0].upper()
        model = " ".join(words[:2]) if len(words) > 1 and re.search(r"\d", words[1]) else collection
        color = color_profile(color_key(p["url"], name))
        catalog.append({
            "id": p["id"], "name": name, "collection": collection, "model": model, "type": ptype,
            "rooms": p["rooms"], "price": p["price"],
            "regular": p["regular"] if p["regular"] and p["regular"] > p["price"] else None,
            "url": p["url"], "img": p["img"], "color": color,
            "bestseller": p["id"] in best,
        })

    catalog.sort(key=lambda x: (x["collection"], x["name"]))
    used = {p["collection"] for p in catalog}
    collections = {k: v for k, v in collection_urls.items() if k in used}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": BASE, "updated": date.today().isoformat(),
                               "count": len(catalog), "collections": collections, "products": catalog},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Zapisano {len(catalog)} produktów → {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
