// Uproszczony kontur Polski i rzut współrzędnych na mapę poglądową (SVG, bez zewnętrznych kafelków).
// Rzut równoodległościowy ze skalą długości dla ok. 52°N — wystarczy do mapy „gdzie mniej więcej”.

export const MAP = { lng0: 14.0, lat0: 55.0, kx: 61.57, ky: 100, width: 630, height: 600 };

export const project = (lat: number, lng: number) => ({
  x: +((lng - MAP.lng0) * MAP.kx).toFixed(1),
  y: +((MAP.lat0 - lat) * MAP.ky).toFixed(1),
});

// [lng, lat] — kontur przybliżony (kilkadziesiąt punktów), zgodnie z ruchem wskazówek zegara od Świnoujścia.
const OUTLINE: [number, number][] = [
  [14.21, 53.94], [14.78, 54.03], [15.58, 54.18], [16.4, 54.43], [16.85, 54.59], [17.55, 54.76], [18.33, 54.83],
  [18.4, 54.79], [18.55, 54.52], [18.65, 54.37], [19.45, 54.38], [19.6, 54.45], [20.6, 54.37], [21.5, 54.33],
  [22.79, 54.36], [23.35, 54.2], [23.5, 54.0], [23.92, 53.15], [23.94, 52.73], [23.6, 52.1], [23.55, 51.55],
  [23.7, 51.4], [24.15, 50.86], [23.5, 50.4], [22.9, 49.95], [22.68, 49.55], [22.89, 49.05], [22.56, 49.08],
  [21.6, 49.42], [20.9, 49.33], [20.2, 49.2], [19.95, 49.2], [19.4, 49.6], [18.85, 49.52], [18.63, 49.75],
  [18.55, 49.92], [18.0, 50.0], [17.6, 50.27], [16.9, 50.45], [16.6, 50.1], [16.2, 50.63], [15.4, 50.78],
  [14.82, 50.87], [15.0, 51.15], [14.74, 51.54], [14.6, 51.85], [14.75, 52.07], [14.56, 52.35], [14.15, 52.83],
  [14.48, 53.25], [14.29, 53.73],
];

export const outlinePath = () =>
  OUTLINE.map(([lng, lat], i) => {
    const { x, y } = project(lat, lng);
    return `${i ? 'L' : 'M'}${x} ${y}`;
  }).join('') + 'Z';
