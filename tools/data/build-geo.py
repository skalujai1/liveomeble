#!/usr/bin/env python
# Granice województw do mapy salonów → src/lib/geo-pl.json (ścieżki SVG w jednostkach mapy).
#
#   python tools/data/build-geo.py <wojewodztwa-min.geojson>
#
# Źródło: Państwowy Rejestr Granic (GUGiK, dane bez opłat), plik z projektu ppatrzyk/polska-geojson
# (https://github.com/ppatrzyk/polska-geojson, „wojewodztwa-min.geojson”). Rzut taki sam jak w src/lib/geo.ts
# (równoodległościowy, skala długości dla ok. 52°N); kształty upraszczamy (Douglas–Peucker), żeby SVG był lekki.
import json, sys, os

LNG0, LAT0, KX, KY = 14.0, 55.0, 61.57, 100.0   # = MAP w src/lib/geo.ts
TOLERANCE = 0.9                                  # jednostki mapy (~1 km)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'lib', 'geo-pl.json')

def project(lng, lat):
    return ((lng - LNG0) * KX, (LAT0 - lat) * KY)

def dp(points, eps):
    """Douglas–Peucker dla otwartej linii."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-9
    best, idx = 0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [points[0], points[-1]]
    return dp(points[: idx + 1], eps)[:-1] + dp(points[idx:], eps)

def ring_path(ring):
    pts = [project(lng, lat) for lng, lat in ring]
    # pierścień zamknięty → dzielimy na dwie połówki, żeby DP nie zjadł całego kształtu
    half = len(pts) // 2
    simple = dp(pts[: half + 1], TOLERANCE)[:-1] + dp(pts[half:], TOLERANCE)
    if len(simple) < 4:
        return ''
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in simple[:-1]) + 'Z'

def area_centroid(ring):
    pts = [project(lng, lat) for lng, lat in ring]
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        f = x1 * y2 - x2 * y1
        a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    a *= 0.5
    return (abs(a), cx / (6 * a), cy / (6 * a)) if a else (0, pts[0][0], pts[0][1])

src = json.load(open(sys.argv[1], encoding='utf-8'))
regions = []
for f in src['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    d = ''.join(ring_path(ring) for poly in polys for ring in poly)
    biggest = max((area_centroid(poly[0]) for poly in polys), key=lambda t: t[0])
    regions.append({'name': f['properties']['nazwa'], 'd': d, 'cx': round(biggest[1], 1), 'cy': round(biggest[2], 1)})
regions.sort(key=lambda r: r['name'])
out = {
    'source': 'Państwowy Rejestr Granic (GUGiK), przez github.com/ppatrzyk/polska-geojson (wojewodztwa-min.geojson); uproszczone',
    'projection': {'lng0': LNG0, 'lat0': LAT0, 'kx': KX, 'ky': KY, 'tolerance': TOLERANCE},
    'regions': regions,
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"{len(regions)} województw, {sum(r['d'].count('L') + r['d'].count('M') for r in regions)} punktów, {os.path.getsize(OUT) // 1024} kB → {OUT}")
