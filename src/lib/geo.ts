// Rzut współrzędnych na mapę salonów (SVG, bez zewnętrznych kafelków) i granice województw.
// Rzut równoodległościowy ze skalą długości dla ok. 52°N — wystarczy do mapy „gdzie mniej więcej”.
// Granice: Państwowy Rejestr Granic (GUGiK), uproszczone przez tools/data/build-geo.py → geo-pl.json.
import geo from './geo-pl.json';

export const MAP = { lng0: 14.0, lat0: 55.0, kx: 61.57, ky: 100, width: 630, height: 600 };

export const project = (lat: number, lng: number) => ({
  x: +((lng - MAP.lng0) * MAP.kx).toFixed(1),
  y: +((MAP.lat0 - lat) * MAP.ky).toFixed(1),
});

/** Województwa: nazwa (jak w danych salonów), ścieżka SVG i punkt na etykietę. */
export const regions = geo.regions as { name: string; d: string; cx: number; cy: number }[];

/** Cały kraj jedną ścieżką (suma województw). */
export const outlinePath = () => regions.map(r => r.d).join('');
