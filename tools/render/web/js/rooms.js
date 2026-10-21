// Definicje aranżacji (atrapy zdjęć wnętrz). Układ pokoju: ściana tylna na z=0, pokój w stronę +z (kamera),
// x w prawo, podłoga y=0. Meble z silnika (model3d), dekoracje z decor.js.
// Kamery: poziome (bez zbieżności pionów), kadrowanie przesunięciem obiektywu (shiftX/shiftY).
import * as THREE from 'three';
import { buildModel } from './furniture.js';
import * as D from './decor.js';

function put(parent, obj, x, y, z, rotY = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = THREE.MathUtils.degToRad(rotY);
  parent.add(obj);
  return obj;
}
/** Mebel przy ścianie tylnej (z = głębokość/2 + szczelina). */
function atBack(parent, spec, x, gap = 0.02) {
  return put(parent, buildModel(spec), x, 0, (spec.d * 0.01) / 2 + gap);
}
/** Wysokości dna komórek (jedna kolumna szafki) — do ustawiania dekoracji na półkach. */
function cellFloors(spec) {
  const T = 0.018, legH = (spec.legH ?? 8) / 100, H = spec.h / 100;
  const topSep = spec.finish.top && spec.finish.top !== spec.finish.body;
  const Tt = topSep ? (spec.topT ?? 2.2) / 100 : T;
  const yIn0 = legH + T, yIn1 = H - Tt;
  const cells = spec.columns[0].cells;
  const innerH = yIn1 - yIn0 - (cells.length - 1) * T;
  const sum = cells.reduce((a, c) => a + (c.h || 1), 0);
  const out = [];
  let y = yIn1;
  for (const c of cells) { const ch = (innerH * (c.h || 1)) / sum; out.push({ y0: y - ch, h: ch }); y -= ch + T; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Modele mebli użyte w aranżacjach (format model3d)
// ---------------------------------------------------------------------------------------------
const M = {
  rtv180: {
    kind: 'cabinet', w: 180, h: 50, d: 40, base: 'legsMetal', legH: 12,
    columns: [{ w: 1, cells: [{ t: 'door' }] }, { w: 1, cells: [{ t: 'open' }, { t: 'drawer' }] }, { w: 1, cells: [{ t: 'door' }] }],
    handle: 'bar', finish: { body: 'dab-naturalny', front: 'dab-naturalny', metal: 'czarny' },
  },
  komoda120: {
    kind: 'cabinet', w: 120, h: 86, d: 42, base: 'legsMetal', legH: 14,
    columns: [{ w: 1, cells: [{ t: 'door' }] }, { w: 1, cells: [{ t: 'drawer' }, { t: 'drawer' }, { t: 'drawer' }] }],
    handle: 'bar', finish: { body: 'bialy-mat', front: 'bialy-mat', metal: 'zloty' },
  },
  lozko160: {
    kind: 'bed', w: 176, h: 108, d: 214, base: 'legsWood', legH: 8, headboard: 'channels', upholstered: true, mattress: [160, 200],
    throw: '#b49d84', cushions: ['#c9b49a', '#8f9a83'],
    finish: { body: 'kaszmir', front: 'kaszmir', legs: 'dab-naturalny' },
  },
  nocna: {
    kind: 'cabinet', w: 50, h: 56, d: 40, base: 'legsWood', legH: 15,
    columns: [{ w: 1, cells: [{ t: 'drawer', h: 1 }, { t: 'open', h: 1.1 }] }],
    handle: 'groove', finish: { body: 'czarny-mat', front: 'dab-naturalny', top: 'dab-naturalny', legs: 'dab-naturalny', metal: 'czarny' },
  },
  stol160: { kind: 'table', w: 160, h: 76, d: 90, base: 'legsWood', top: 4, finish: { body: 'dab-naturalny' } },
  sideboardOrzech: {
    kind: 'cabinet', w: 160, h: 78, d: 42, base: 'legsWood', legH: 16,
    columns: [{ w: 1, cells: [{ t: 'door' }] }, { w: 1, cells: [{ t: 'drawer' }, { t: 'drawer' }] }, { w: 1, cells: [{ t: 'door' }] }],
    handle: 'push', finish: { body: 'orzech', front: 'orzech', legs: 'orzech' },
  },
  witryna: {
    kind: 'cabinet', w: 90, h: 190, d: 40, base: 'legsMetal', legH: 10,
    columns: [{ w: 1, cells: [{ t: 'doorGlass', h: 3.4 }, { t: 'drawer', h: 0.62 }, { t: 'drawer', h: 0.62 }] }],
    handle: 'bar', finish: { body: 'grafit', front: 'grafit', metal: 'czarny' },
  },
  szafkaNaButy: {
    kind: 'cabinet', w: 110, h: 92, d: 35, base: 'legsMetal', legH: 14,
    columns: [{ w: 1, cells: [{ t: 'flap' }, { t: 'flap' }] }, { w: 1, cells: [{ t: 'flap' }, { t: 'flap' }] }],
    handle: 'edge', finish: { body: 'kaszmir', front: 'kaszmir', top: 'dab-naturalny', metal: 'zloty' },
  },
  lustroLuk: { kind: 'mirror', w: 60, h: 100, d: 3, frame: 3.2, shape: 'arch', legH: 108, finish: { body: 'dab-naturalny' } },
  wieszak: { kind: 'coatRack', w: 92, h: 22, d: 24, legH: 150, hooks: 5, shelf: true, finish: { body: 'dab-naturalny', metal: 'czarny' } },
  biurko120: {
    kind: 'desk', w: 120, h: 76, d: 60, base: 'legsWood', top: 2.5, pedestal: 40,
    columns: [{ w: 1, cells: [{ t: 'drawer' }, { t: 'drawer' }, { t: 'drawer', h: 1.3 }] }],
    handle: 'groove', finish: { body: 'szalwia', front: 'szalwia', top: 'dab-naturalny', legs: 'szalwia', metal: 'zloty' },
  },
  regal80: {
    kind: 'cabinet', w: 80, h: 190, d: 35, base: 'plinth', legH: 6,
    columns: [{ w: 1, cells: [{ t: 'open' }, { t: 'open' }, { t: 'open' }, { t: 'open' }, { t: 'open', h: 1.1 }] }],
    handle: 'push', finish: { body: 'dab-miodowy', front: 'dab-miodowy' },
  },
};

const WARM_WHITE = '#ece7df';

export const ROOMS = {
  // -------------------------------------------------------------------------------------------
  'salon-jasny': {
    title: 'Salon jasny — szafka RTV 180, dąb naturalny',
    description: 'Jasny salon w słońcu: szafka RTV 180 z dębu naturalnego na czarnych nogach, nad nią dwie grafiki, wazon z suchymi gałązkami, drzewko oliwne w donicy, beżowy dywan, dębowa podłoga w deskach; plamy słońca z okna po lewej.',
    palette: 'ciepła biel ścian, miodowy dąb, beż dywanu, akcenty terakoty i czerni',
    room: {
      w: 6.4, d: 6.0, h: 2.8, wallColor: WARM_WHITE, floor: { type: 'oak', color: '#c9ab86' },
      window: { wall: 'left', center: 2.5, width: 2.8, height: 2.3, sill: 0.35, cols: 3, transom: 0.55, curtains: true },
    },
    sun: { azimuth: -62, elevation: 24 },
    light: { sunIntensity: 4.2, skyIntensity: 2.8, bounce: 2.2, exposure: 1 },
    post: { warmth: 0.0 },
    capture: [0.3, 1.3, 2.4],
    populate(g) {
      const x = 0.55;
      atBack(g, M.rtv180, x);
      const top = 0.5;
      put(g, D.framedArt({ w: 0.62, h: 0.84, style: 'arches', frame: 'oak', palette: { bg: '#efe9df', a: '#c26e4b', b: '#dcc29b', c: '#7a8467', d: '#2e2b28' } }), x - 0.33, 1.46, 0);
      put(g, D.framedArt({ w: 0.42, h: 0.54, style: 'lines', frame: 'black', palette: { bg: '#f2eee7', a: '#c9a27a', d: '#3a3633' } }), x + 0.42, 1.33, 0);
      put(g, D.vaseWithBranches({ h: 0.3, color: '#e6e0d4', seed: 5 }), x + 0.68, top, 0.2);
      const books = put(g, D.bookStack({ count: 3, seed: 4, colors: ['#e3dccd', '#b8a58a', '#7d8a72'] }), x - 0.63, top, 0.22, 8);
      put(g, D.smallVase({ h: 0.14, color: '#2e2b29' }), x - 0.63, top + books.userData.height, 0.22);
      put(g, D.bowl({ d: 0.24, h: 0.07, color: '#cbbfae' }), x - 0.2, top, 0.24);
      put(g, D.oliveTree({ h: 1.75, seed: 11 }), 2.1, 0, 0.5);
      put(g, D.armchair({ color: '#e3dccf', kind: 'boucle', seed: 4 }), 1.0, 0, 2.45, -32);
      put(g, D.rug({ w: 2.6, d: 1.8, base: '#ddd5c7', line: '#c2b49d', pattern: 'diamond' }), 0.7, 0, 1.6);
    },
    cameras: {
      wide: { pos: [-1.0, 1.0, 4.4], yaw: 12, fov: 36, shiftY: 0.03 },
      tall: { pos: [0.1, 1.05, 3.6], yaw: 6, fov: 46, shiftY: 0.02 },
    },
    notes: { wide: 'lewa 1/3 kadru — gładka jasna ściana z miękkim światłem i plamą słońca (miejsce na tekst)', tall: 'górne ~30% kadru — jasna ściana nad grafikami (miejsce na tekst)' },
  },

  // -------------------------------------------------------------------------------------------
  'salon-szalwia': {
    title: 'Salon ze ścianą w kolorze szałwii — komoda 120 biały mat',
    description: 'Salon ze ścianą w kolorze szałwii: biała matowa komoda 120 ze złotymi uchwytami i nogami, nad nią lustro w łuku w dębowej ramie, ceramiczna lampa z lnianym abażurem, książki i wazon z gałązkami; obok grafitowa witryna, dębowa podłoga, światło z okna po prawej.',
    palette: 'szałwia (zgaszona zieleń), biel, złoto, dąb, grafit',
    room: {
      w: 6.4, d: 6.0, h: 2.8, wallColor: WARM_WHITE, walls: { back: '#a1aa94' }, floor: { type: 'oak', color: '#cdb18e' },
      window: { wall: 'right', center: 2.6, width: 2.4, height: 2.3, sill: 0.35, cols: 2, transom: 0.55 },
    },
    sun: { azimuth: 64, elevation: 26 },
    light: { sunIntensity: 3.9, skyIntensity: 2.8, bounce: 2.2, exposure: 1 },
    post: { warmth: 0.005 },
    capture: [-0.3, 1.3, 2.4],
    populate(g) {
      const kx = -0.7;
      atBack(g, M.komoda120, kx);
      const top = 0.86;
      put(g, D.wallMounted(buildModel(M.lustroLuk)), kx, 0, 0.03);
      put(g, D.tableLamp({ baseColor: '#e9e4da', shadeColor: '#efe8dc', h: 0.52 }), kx - 0.4, top, 0.22);
      const books = put(g, D.bookStack({ count: 2, seed: 9, colors: ['#e7e0d2', '#c4a98a'] }), kx + 0.4, top, 0.22, -6);
      put(g, D.vaseWithBranches({ h: 0.24, color: '#3a3532', seed: 21, shape: 'round', branchH: 0.9 }), kx + 0.4, top + books.userData.height, 0.22);
      put(g, D.candle({ h: 0.1 }), kx + 0.12, top, 0.26);
      atBack(g, M.witryna, 0.45);
      put(g, D.rug({ w: 2.4, d: 1.7, base: '#e2dbcf', line: '#c9bca7', pattern: 'stripes' }), -0.4, 0, 1.55);
      put(g, D.basket({ r: 0.19, h: 0.3, color: '#b89c78' }), -1.65, 0, 0.35);
      put(g, D.armchair({ color: '#d8cdbd', kind: 'linen', seed: 8 }), -1.15, 0, 2.5, 30);
    },
    cameras: {
      wide: { pos: [1.1, 1.0, 4.4], yaw: -15, fov: 36, shiftY: 0.03 },
      tall: { pos: [-0.25, 1.08, 3.7], yaw: -3, fov: 46, shiftY: 0.0 },
    },
    notes: { wide: 'prawa 1/3 kadru — ściana w kolorze szałwii z miękkim światłem (miejsce na tekst)', tall: 'górne ~25% kadru — ściana w kolorze szałwii nad lustrem (miejsce na tekst)' },
  },

  // -------------------------------------------------------------------------------------------
  sypialnia: {
    title: 'Sypialnia — łóżko 160 tapicerowane kaszmir, szafki nocne czarny mat + dąb',
    description: 'Spokojna sypialnia: tapicerowane łóżko 160×200 w kolorze kaszmiru z wezgłowiem w pionowe przeszycia, lniana pościel, pled i poduszki dekoracyjne, dwie szafki nocne czarny mat z dębem, ceramiczne lampki, grafika nad łóżkiem, wełniany dywan, światło z okna po lewej.',
    palette: 'kaszmir, len, ciepła biel, dąb, czarne akcenty, zgaszona oliwka',
    room: {
      w: 6.6, d: 6.4, h: 2.75, wallColor: '#e8e2d8', floor: { type: 'oak', color: '#c7a882' },
      window: { wall: 'left', center: 3.0, width: 2.2, height: 2.25, sill: 0.4, cols: 2, transom: 0.5 },
    },
    sun: { azimuth: -58, elevation: 20 },
    light: { sunIntensity: 3.4, skyIntensity: 3.0, bounce: 2.2, exposure: 1 },
    post: { warmth: 0.005 },
    capture: [0.6, 1.3, 2.8],
    populate(g) {
      const bx = 0.95;
      put(g, buildModel(M.lozko160), bx, 0, 1.07 + 0.02);
      for (const sx of [-1, 1]) {
        const nx = bx + sx * (0.88 + 0.06 + 0.25);
        atBack(g, M.nocna, nx);
        put(g, D.tableLamp({ baseColor: '#d8d0c3', shadeColor: '#efe8dc', h: 0.46 }), nx + sx * 0.05, 0.56, 0.2);
      }
      put(g, D.bookStack({ count: 2, seed: 12, colors: ['#e6dfd1', '#7d8a72'] }), bx - 1.19 + 0.1, 0.56, 0.26, 12);
      put(g, D.framedArt({ w: 1.0, h: 0.7, style: 'landscape', frame: 'oak', palette: { bg: '#efe9df', a: '#c9875f', b: '#dccbb0', c: '#a7ae97', d: '#5e6a58' } }), bx, 1.62, 0);
      put(g, D.rug({ w: 2.6, d: 2.0, base: '#e5ded2', line: '#cdbfaa', pattern: 'diamond' }), bx, 0, 1.75);
      put(g, D.vaseWithBranches({ h: 0.36, color: '#cfc6b8', seed: 33, shape: 'round', branchH: 1.0, spread: 1.2 }), -0.75, 0, 0.35);
    },
    cameras: {
      wide: { pos: [-0.6, 1.15, 5.2], yaw: 10, fov: 36, shiftY: 0.06 },
      tall: { pos: [0.95, 1.2, 5.1], fov: 46, shiftY: 0.04 },
    },
    notes: { wide: 'lewa ~1/3 kadru — jasna ściana i światło z okna (miejsce na tekst)', tall: 'górne ~25% kadru — ściana nad grafiką (miejsce na tekst)' },
  },

  // -------------------------------------------------------------------------------------------
  jadalnia: {
    title: 'Jadalnia — stół 160 dąb naturalny, komoda orzech',
    description: 'Jadalnia: dębowy stół 160×90 z drewnianymi krzesłami z tapicerowanym siedziskiem, czarna lampa wisząca, w tle niska komoda z orzecha z grafikami i ceramiką, dębowa podłoga, światło dzienne z okna po lewej.',
    palette: 'dąb naturalny, orzech, ciepła biel, czerń, beż',
    room: {
      w: 6.6, d: 6.6, h: 2.8, wallColor: '#ebe5dc', floor: { type: 'oak', color: '#cbb08c' },
      window: { wall: 'left', center: 2.4, width: 2.6, height: 2.3, sill: 0.35, cols: 3, transom: 0.55 },
    },
    sun: { azimuth: -55, elevation: 27 },
    light: { sunIntensity: 3.9, skyIntensity: 2.8, bounce: 2.2, exposure: 1 },
    post: { warmth: 0.0 },
    capture: [0.6, 1.3, 2.6],
    populate(g) {
      const tx = 0.9, tz = 2.2;
      put(g, buildModel(M.stol160), tx, 0, tz);
      const ch = { finish: 'dab-naturalny', seatColor: '#d6ccbc' };
      put(g, D.chair(ch), tx - 0.4, 0, tz - 0.62, 3);
      put(g, D.chair(ch), tx + 0.42, 0, tz - 0.6, -4);
      put(g, D.chair(ch), tx + 1.06, 0, tz + 0.02, -90 + 3);
      put(g, D.chair(ch), tx + 0.38, 0, tz + 0.7, 180 + 6);
      put(g, D.pendantLamp({ drop: 1.0, r: 0.22 }), tx, 2.8, tz);
      put(g, D.bowl({ d: 0.32, h: 0.09, color: '#d4c8b6' }), tx + 0.25, 0.76, tz + 0.05);
      put(g, D.vaseWithBranches({ h: 0.26, color: '#ece6dc', seed: 41, branchH: 0.85 }), tx - 0.3, 0.76, tz - 0.05);
      atBack(g, M.sideboardOrzech, 1.1);
      put(g, D.framedArt({ w: 0.5, h: 0.7, style: 'blobs', frame: 'black', palette: { bg: '#efe9df', a: '#b8613f', b: '#d8c3a0', c: '#88907a', d: '#2b2927' } }), 0.82, 1.38, 0);
      put(g, D.framedArt({ w: 0.5, h: 0.7, style: 'blocks', frame: 'black', palette: { bg: '#efe9df', a: '#c47a54', b: '#e0cfb1', c: '#7f8a76', d: '#2b2927' } }), 1.42, 1.38, 0);
      put(g, D.smallVase({ h: 0.22, color: '#c9bba6', shape: 1 }), 0.5, 0.78, 0.22);
      put(g, D.smallVase({ h: 0.14, color: '#2e2b29' }), 0.62, 0.78, 0.25);
      put(g, D.bookStack({ count: 2, seed: 8, colors: ['#e3dccd', '#b4654a'] }), 1.7, 0.78, 0.23, 5);
    },
    cameras: {
      wide: { pos: [-0.6, 1.2, 5.9], yaw: 8, fov: 36, shiftY: 0.05 },
      tall: { pos: [0.95, 1.25, 5.0], fov: 46, shiftY: 0.05 },
    },
    notes: { wide: 'lewa 1/3 kadru — jasna ściana z miękkim światłem okna (miejsce na tekst)', tall: 'górne ~25% kadru — ściana i lampa wisząca (miejsce na krótki tekst)' },
  },

  // -------------------------------------------------------------------------------------------
  przedpokoj: {
    title: 'Przedpokój — szafka na buty kaszmir, lustro w łuku, wieszak dąb',
    description: 'Jasny przedpokój: szafka na buty w kolorze kaszmiru z dębowym blatem i złotymi uchwytami krawędziowymi, lustro w łuku w dębowej ramie, dębowy wieszak z półką, kapelusz i lniana torba na haczykach, pleciony kosz, jasna posadzka betonowa.',
    palette: 'kaszmir, ciepła biel, dąb, złoto, jasny beton',
    room: {
      w: 4.2, d: 5.2, h: 2.7, wallColor: '#e9e3da', walls: { back: '#e2d9cc' }, floor: { type: 'concrete', color: '#cfcac1' },
      window: { wall: 'left', center: 3.4, width: 1.4, height: 2.1, sill: 0.6, cols: 1, transom: 0.5 },
    },
    sun: { azimuth: -40, elevation: 28 },
    light: { sunIntensity: 3.9, skyIntensity: 3.0, bounce: 2.3, exposure: 1 },
    post: { warmth: 0.005 },
    capture: [0.2, 1.3, 2.4],
    populate(g) {
      atBack(g, M.szafkaNaButy, 0.45);
      put(g, D.wallMounted(buildModel(M.lustroLuk)), 0.2, 0, 0.03);
      put(g, D.wallMounted(buildModel(M.wieszak)), 1.25, 0, 0.05);
      const h = put(g, D.hat({ color: '#c8b28a' }), 1.25 - 0.36, 1.55, 0.13);
      h.rotation.set(-0.25, 0, 0);
      put(g, D.toteBag({ color: '#cbb894' }), 1.25 + 0.18, 1.58, 0.12).rotation.z = 0.05;
      put(g, D.vaseWithBranches({ h: 0.22, color: '#e9e3d8', seed: 14, branchH: 0.9 }), 0.78, 0.92, 0.18);
      put(g, D.bowl({ d: 0.18, h: 0.05, color: '#2e2b29' }), 0.48, 0.92, 0.2);
      put(g, D.basket({ r: 0.17, h: 0.36, color: '#b99d77' }), -0.55, 0, 0.3);
      put(g, D.rug({ w: 0.9, d: 1.8, base: '#e2dacb', line: '#b9a98f', pattern: 'stripes' }), 0.45, 0, 1.45);
    },
    cameras: {
      wide: { pos: [-0.3, 1.15, 3.4], yaw: 9, fov: 40, shiftY: 0.05 },
      tall: { pos: [0.5, 1.15, 3.5], yaw: 2, fov: 48, shiftY: 0.02 },
    },
    notes: { wide: 'lewa ~1/3 kadru — jasna ściana (miejsce na tekst)', tall: 'górne ~20% kadru — ściana nad lustrem (miejsce na krótki tekst)' },
  },

  // -------------------------------------------------------------------------------------------
  biuro: {
    title: 'Domowe biuro — biurko 120 szałwia + dąb, regał dąb miodowy',
    description: 'Domowe biuro: biurko 120 w kolorze szałwii z dębowym blatem i kontenerem z szufladami, drewniane krzesło, lampka biurkowa, regał 80×190 z dębu miodowego z książkami i ceramiką, grafiki na ścianie, drzewko oliwne, dębowa podłoga, światło z okna po lewej.',
    palette: 'szałwia, dąb, dąb miodowy, ciepła biel, czarne akcenty',
    room: {
      w: 6.2, d: 6.0, h: 2.75, wallColor: '#ebe6de', floor: { type: 'oak', color: '#c4a47c' },
      window: { wall: 'left', center: 2.3, width: 2.4, height: 2.25, sill: 0.45, cols: 2, transom: 0.5 },
    },
    sun: { azimuth: -64, elevation: 25 },
    light: { sunIntensity: 3.9, skyIntensity: 2.8, bounce: 2.2, exposure: 1 },
    post: { warmth: 0.0 },
    capture: [0.5, 1.3, 2.4],
    populate(g) {
      const dx = 0.55;
      atBack(g, M.biurko120, dx, 0.03);
      put(g, D.chair({ finish: 'dab-naturalny', seatColor: '#cfc3b1' }), dx - 0.18, 0, 0.92, 180 + 14);
      put(g, D.deskLamp({ metal: 'czarny' }), dx - 0.45, 0.76, 0.2, 20);
      put(g, D.bookStack({ count: 3, seed: 17, colors: ['#e3dccd', '#7d8a72', '#c9b79c'] }), dx + 0.28, 0.76, 0.2, -8);
      put(g, D.smallVase({ h: 0.16, color: '#ece6dc', shape: 1 }), dx + 0.02, 0.76, 0.16);
      put(g, D.framedArt({ w: 0.5, h: 0.65, style: 'blobs', frame: 'oak', palette: { bg: '#f0ebe2', a: '#c0714d', b: '#d9c5a2', c: '#8e9a80', d: '#2f2c29' } }), dx - 0.15, 1.42, 0);
      put(g, D.framedArt({ w: 0.32, h: 0.42, style: 'lines', frame: 'black', palette: { bg: '#f2eee7', a: '#9aa58f', d: '#3a3633' } }), dx + 0.36, 1.32, 0);
      const rx = 1.78;
      atBack(g, M.regal80, rx);
      const cells = cellFloors(M.regal80);
      const zS = 0.2;
      put(g, D.bookRow({ length: 0.42, maxH: 0.27, seed: 3 }), rx - 0.12, cells[0].y0, zS);
      put(g, D.smallVase({ h: 0.16, color: '#2e2b29' }), rx + 0.22, cells[0].y0, zS);
      put(g, D.bowl({ d: 0.2, h: 0.06, color: '#d4c8b6' }), rx - 0.16, cells[1].y0, zS);
      put(g, D.bookStack({ count: 3, seed: 5 }), rx + 0.16, cells[1].y0, zS, 4);
      put(g, D.bookRow({ length: 0.6, maxH: 0.28, seed: 7 }), rx, cells[2].y0, zS);
      put(g, D.smallVase({ h: 0.2, color: '#cfc6b8', shape: 1 }), rx - 0.18, cells[3].y0, zS);
      put(g, D.bookRow({ length: 0.3, maxH: 0.26, seed: 9 }), rx + 0.14, cells[3].y0, zS);
      put(g, D.basket({ r: 0.15, h: 0.24, color: '#bba07c' }), rx, cells[4].y0, zS - 0.01);
      put(g, D.oliveTree({ h: 1.55, seed: 23, potR: 0.18, potH: 0.36 }), 2.55, 0, 0.5);
      put(g, D.rug({ w: 2.0, d: 1.5, base: '#e3dccf', line: '#b8ab95', pattern: 'stripes' }), dx, 0, 1.15);
    },
    cameras: {
      wide: { pos: [-0.6, 1.05, 4.4], yaw: 11, fov: 36, shiftY: 0.03 },
      tall: { pos: [0.75, 1.1, 4.0], yaw: 2, fov: 46, shiftY: 0.0 },
    },
    notes: { wide: 'lewa ~1/3 kadru — jasna ściana z miękkim światłem okna (miejsce na tekst)', tall: 'górne ~25% kadru — ściana nad biurkiem (miejsce na tekst)' },
  },
};

export function ROOM_LIST() {
  return Object.entries(ROOMS).map(([name, r]) => ({ name, title: r.title, description: r.description, palette: r.palette, notes: r.notes }));
}
