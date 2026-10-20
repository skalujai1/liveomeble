// Parametryczny generator mebli z kontraktu model3d (wymiary w cm → scena w metrach).
// Układ: początek w środku podstawy na podłodze, front mebla w kierunku +z, x w prawo, y w górę.
import * as THREE from 'three';
import { finishMaterial, metalMaterial, glassMaterial, mirrorMaterial, fabricMaterial, plainMaterial, FINISHES } from './materials.js';
import { slab, lathe, taperedLeg, cylinderBetween, pillowGeometry, drapeGeometry, boxUV } from './geom.js';
import { mulberry32, hashString } from './noise.js';

const CM = 0.01;
const T = 0.018; // płyta
const GAP = 0.003; // szczelina frontów
const FT = 0.018; // grubość frontu

class Ctx {
  constructor(spec) {
    this.spec = spec;
    this.group = new THREE.Group();
    this.group.name = spec.id || spec.kind;
    this.rnd = mulberry32(hashString(JSON.stringify(spec)));
    this.F = Object.assign({ metal: 'czarny' }, spec.finish || {});
    this.F.front = this.F.front || this.F.body;
  }
  seed() { return Math.floor(this.rnd() * 1e9); }
  mat(id) {
    const f = FINISHES[id];
    if (f && f.wood) return finishMaterial(id, Math.floor(this.rnd() * 3));
    return finishMaterial(id);
  }
  slab(w, h, d, finishId, x, y, z, opts = {}) {
    const m = slab(w, h, d, opts.material || this.mat(finishId), Object.assign({ seed: this.seed() }, opts));
    m.position.set(x, y, z);
    (opts.parent || this.group).add(m);
    return m;
  }
  add(o, x = 0, y = 0, z = 0) { o.position.set(x, y, z); this.group.add(o); return o; }
}

// ---------------------------------------------------------------------------------------------
// Uchwyty
// ---------------------------------------------------------------------------------------------
function addHandle(c, type, front, orient) {
  // front: { x, y, z (lico frontu), w, h }, orient: 'h' (poziomo) | 'v' (pionowo)
  const metal = metalMaterial(c.F.metal);
  const g = new THREE.Group();
  if (type === 'bar') {
    const L = orient === 'h' ? THREE.MathUtils.clamp(front.w * 0.32, 0.128, 0.32) : THREE.MathUtils.clamp(front.h * 0.35, 0.128, 0.26);
    const s = 0.011, stand = 0.026;
    const bar = slab(orient === 'h' ? L + 0.02 : s, orient === 'h' ? s : L + 0.02, s, metal, { radius: 0.0045, segments: 3 });
    bar.position.set(0, 0, stand + s / 2);
    g.add(bar);
    for (const k of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, stand, 16), metal);
      p.rotation.x = Math.PI / 2;
      p.position.set(orient === 'h' ? (k * L) / 2 : 0, orient === 'h' ? 0 : (k * L) / 2, stand / 2);
      p.castShadow = p.receiveShadow = true;
      g.add(p);
    }
  } else if (type === 'knob') {
    const k = lathe([[0, 0], [0.007, 0], [0.006, 0.012], [0.011, 0.02], [0.0135, 0.026], [0.0125, 0.03], [0.006, 0.0315], [0, 0.0318]], metal, 40);
    k.rotation.x = Math.PI / 2;
    g.add(k);
  } else if (type === 'edge') {
    const L = Math.min(0.16, front.w * 0.4);
    const top = slab(L, 0.002, FT + 0.003, metal, { radius: 0.0008 });
    top.position.set(0, front.h / 2 + 0.001, -FT / 2);
    const lip = slab(L, 0.022, 0.002, metal, { radius: 0.0008 });
    lip.position.set(0, front.h / 2 - 0.008, 0.012);
    const bend = slab(L, 0.002, 0.012, metal, { radius: 0.0008 });
    bend.position.set(0, front.h / 2 + 0.002, 0.006);
    g.add(top, lip, bend);
    g.position.set(front.x, front.y, front.z);
    c.group.add(g);
    return;
  }
  if (type === 'bar' || type === 'knob') {
    g.position.set(front.hx, front.hy, front.z);
    c.group.add(g);
  }
}

/** Front (drzwi/szuflada/klapa) z uchwytem. rect: x0,x1,y0,y1; zFace = z lica. */
function addFront(c, rect, kind, zFace, opts = {}) {
  const w = rect.x1 - rect.x0 - GAP, h = rect.y1 - rect.y0 - GAP;
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  const handle = c.spec.handle || 'push';
  const finish = opts.finish || c.F.front;
  const grain = w >= h ? 'x' : 'y';
  let fh = h, fy = cy, fw = w, fx = cx;
  // frezowany uchwyt — wycięcie wzdłuż górnej krawędzi (szuflady/klapy) lub krawędzi otwierania (drzwi)
  const groove = handle === 'groove';
  const gs = 0.024;
  if (groove) {
    if (kind === 'door') { fw = w - gs; fx = cx + (opts.hinge === 'right' ? gs / 2 : -gs / 2); }
    else { fh = h - gs; fy = cy - gs / 2; }
  }
  if (kind === 'doorGlass') {
    const fwid = Math.min(0.055, w * 0.16);
    const mat = c.mat(finish);
    c.slab(w, fwid, FT, null, cx, cy + h / 2 - fwid / 2, zFace - FT / 2, { material: mat, grain: 'x', radius: 0.002 });
    c.slab(w, fwid, FT, null, cx, cy - h / 2 + fwid / 2, zFace - FT / 2, { material: mat, grain: 'x', radius: 0.002 });
    c.slab(fwid, h - 2 * fwid, FT, null, cx - w / 2 + fwid / 2, cy, zFace - FT / 2, { material: mat, grain: 'y', radius: 0.002 });
    c.slab(fwid, h - 2 * fwid, FT, null, cx + w / 2 - fwid / 2, cy, zFace - FT / 2, { material: mat, grain: 'y', radius: 0.002 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * fwid + 0.01, h - 2 * fwid + 0.01, 0.004), glassMaterial());
    glass.position.set(cx, cy, zFace - FT / 2);
    glass.castShadow = false; glass.receiveShadow = true;
    glass.renderOrder = 2;
    glass.userData.noAO = true;
    c.group.add(glass);
  } else {
    c.slab(fw, fh, FT, finish, fx, fy, zFace - FT / 2, { grain, radius: 0.0022 });
  }
  if (groove) {
    const dark = finishMaterial('czarny-mat');
    if (kind === 'door') {
      const gx = opts.hinge === 'right' ? cx - w / 2 + gs / 2 : cx + w / 2 - gs / 2;
      c.slab(gs - 0.002, h, 0.004, null, gx, cy, zFace - FT + 0.004, { material: dark });
      c.slab(0.002, h, FT - 0.004, null, gx + (opts.hinge === 'right' ? -gs / 2 + 0.003 : gs / 2 - 0.003), cy, zFace - FT / 2, { material: metalMaterial(c.F.metal) });
    } else {
      c.slab(w, gs - 0.002, 0.004, null, cx, cy + h / 2 - gs / 2, zFace - FT + 0.004, { material: dark });
      c.slab(w, 0.002, FT - 0.004, null, cx, cy + h / 2 - gs + 0.003, zFace - FT / 2, { material: metalMaterial(c.F.metal) });
    }
    return;
  }
  if (handle === 'push' || handle === 'none') return;
  // pozycja uchwytu
  const fr = { x: cx, y: cy, z: zFace, w, h };
  let orient = 'h';
  if (kind === 'door' || kind === 'doorGlass') {
    orient = 'v';
    const side = opts.hinge === 'right' ? -1 : 1; // uchwyt po stronie otwierania
    fr.hx = cx + side * (w / 2 - 0.045);
    // wysokie drzwi: uchwyt na wysokości ~100 cm od podłogi
    fr.hy = h > 0.9 ? THREE.MathUtils.clamp(1.02, rect.y0 + 0.2, rect.y1 - 0.2) : (h > 0.5 ? cy + h * 0.25 : cy);
    if (handle === 'knob') fr.hy = h > 0.9 ? fr.hy : cy + (h > 0.45 ? h * 0.3 : 0);
  } else {
    fr.hx = cx;
    fr.hy = h > 0.3 ? cy + h / 2 - 0.07 : cy;
    if (kind === 'flap') fr.hy = cy + h / 2 - 0.06;
  }
  if (handle === 'edge') { fr.x = kind === 'door' || kind === 'doorGlass' ? fr.hx - (opts.hinge === 'right' ? -1 : 1) * 0.02 : cx; }
  addHandle(c, handle, fr, orient);
}

// ---------------------------------------------------------------------------------------------
// Podstawy (nogi, cokół, płozy)
// ---------------------------------------------------------------------------------------------
function addBase(c, base, W, D, legH, zc, Dc) {
  if (legH <= 0.001 || base === 'hanging') return;
  if (base === 'plinth') {
    c.slab(W - 0.03, legH, Dc - 0.05, c.F.plinth || c.F.body, 0, legH / 2, zc - 0.02, { grain: 'x', radius: 0.001 });
  } else if (base === 'legsMetal') {
    const m = metalMaterial(c.F.metal);
    const s = 0.018;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = slab(s, legH, s, m, { radius: 0.003, segments: 2 });
      leg.position.set(sx * (W / 2 - 0.045), legH / 2, zc + sz * (Dc / 2 - 0.045));
      c.group.add(leg);
      const plate = slab(0.06, 0.003, 0.06, m, { radius: 0.001 });
      plate.position.set(leg.position.x, legH - 0.0015, leg.position.z);
      c.group.add(plate);
    }
    if (W > 1.5) for (const sz of [-1, 1]) {
      const leg = slab(s, legH, s, m, { radius: 0.003 });
      leg.position.set(0, legH / 2, zc + sz * (Dc / 2 - 0.045));
      c.group.add(leg);
    }
  } else if (base === 'legsWood') {
    const mat = c.mat(c.F.legs || c.F.top || c.F.body);
    const splay = THREE.MathUtils.degToRad(6);
    const rTop = Math.min(0.024, W * 0.05), rBot = rTop * 0.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = taperedLeg(legH / Math.cos(splay) + 0.004, rTop, rBot, mat);
      const holder = new THREE.Group();
      holder.position.set(sx * (W / 2 - 0.06), legH + 0.002, zc + sz * (Dc / 2 - 0.06));
      leg.rotation.x = Math.PI; // od góry w dół
      leg.position.y = 0;
      holder.add(leg);
      holder.rotation.z = -sx * splay * 0.8;
      holder.rotation.x = sz * splay * 0.8;
      c.group.add(holder);
    }
  } else if (base === 'frame') {
    const m = metalMaterial(c.F.metal);
    const s = 0.016;
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.035);
      for (const sz of [-1, 1]) {
        const p = slab(s, legH, s, m, { radius: 0.003 });
        p.position.set(x, legH / 2, zc + sz * (Dc / 2 - 0.03));
        c.group.add(p);
      }
      const rail = slab(s, s, Dc - 0.06 + s, m, { radius: 0.003 });
      rail.position.set(x, s / 2, zc);
      c.group.add(rail);
      const rail2 = slab(s, s, Dc - 0.06 + s, m, { radius: 0.003 });
      rail2.position.set(x, legH - s / 2, zc);
      c.group.add(rail2);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Szafka / komoda / regał / witryna / szafa
// ---------------------------------------------------------------------------------------------
function buildCabinet(c, s, origin = { x: 0, y: 0 }) {
  const W = s.w * CM, H = s.h * CM, D = s.d * CM;
  const base = s.base || 'plinth';
  const legH = (s.legH ?? (base === 'plinth' ? 8 : base === 'hanging' ? 40 : 12)) * CM;
  const cols = s.columns || [{ w: 1, cells: [{ t: 'door', h: 1 }] }];
  const hasFronts = cols.some((col) => col.cells.some((cl) => cl.t !== 'open'));
  const Dc = hasFronts ? D - FT : D;
  const zc = hasFronts ? -FT / 2 : 0;
  const zFront = D / 2;
  const y0 = base === 'hanging' ? legH : legH;
  const Hc = H - legH;
  const topSep = c.F.top && c.F.top !== c.F.body;
  const Tt = topSep ? (s.topT ?? 2.2) * CM : T;
  const body = c.F.body;
  const ox = origin.x;

  // blat / wieniec górny (na całą głębokość, fronty pod nim)
  c.slab(W, Tt, D, topSep ? c.F.top : body, ox, y0 + Hc - Tt / 2, 0, { grain: 'x', radius: topSep ? 0.003 : 0.002 });
  // boki
  for (const sx of [-1, 1]) c.slab(T, Hc - Tt, Dc, body, ox + sx * (W / 2 - T / 2), y0 + (Hc - Tt) / 2, zc, { grain: 'y' });
  // wieniec dolny
  c.slab(W - 2 * T, T, Dc, body, ox, y0 + T / 2, zc, { grain: 'x' });
  // plecy
  c.slab(W - 2 * T, Hc - Tt - T, 0.006, body, ox, y0 + T + (Hc - Tt - T) / 2, -D / 2 + 0.006, { grain: 'y', radius: 0.001 });

  // kolumny
  const innerW = W - 2 * T - (cols.length - 1) * T;
  const sumW = cols.reduce((a, col) => a + (col.w || 1), 0);
  let x = ox - W / 2 + T;
  const yIn0 = y0 + T, yIn1 = y0 + Hc - Tt;
  cols.forEach((col, ci) => {
    const cw = (innerW * (col.w || 1)) / sumW;
    const x0 = x, x1 = x + cw;
    // granice frontów kolumny
    const fx0 = ci === 0 ? ox - W / 2 : x0 - T / 2;
    const fx1 = ci === cols.length - 1 ? ox + W / 2 : x1 + T / 2;
    if (ci < cols.length - 1) c.slab(T, yIn1 - yIn0, Dc - 0.008, body, x1 + T / 2, (yIn0 + yIn1) / 2, zc - 0.004, { grain: 'y' });
    const cells = col.cells;
    const innerH = yIn1 - yIn0 - (cells.length - 1) * T;
    const sumH = cells.reduce((a, cl) => a + (cl.h || 1), 0);
    let y = yIn1;
    cells.forEach((cl, ri) => {
      const ch = (innerH * (cl.h || 1)) / sumH;
      const cy1 = y, cy0 = y - ch;
      if (ri < cells.length - 1) c.slab(cw, T, Dc - 0.008, body, (x0 + x1) / 2, cy0 - T / 2, zc - 0.004, { grain: 'x' });
      const fy1 = ri === 0 ? yIn1 - GAP / 2 : cy1 + T / 2;
      const fy0 = ri === cells.length - 1 ? y0 + 0.0015 : cy0 - T / 2;
      const kind = cl.t || 'open';
      const shelvesInside = kind === 'open' || kind === 'doorGlass';
      if (shelvesInside && ch > 0.42) {
        const n = Math.max(1, Math.round(ch / 0.34) - 1);
        for (let k = 1; k <= n; k++) {
          const sy = cy0 + (ch * k) / (n + 1);
          if (kind === 'doorGlass' && s.glassShelves) {
            const gs = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.004, 0.006, Dc - 0.04), glassMaterial('#c9cfcc'));
            gs.position.set((x0 + x1) / 2, sy, zc - 0.01); gs.userData.noAO = true; c.group.add(gs);
          } else {
            c.slab(cw - 0.002, T, Dc - 0.02, body, (x0 + x1) / 2, sy, zc - 0.006, { grain: 'x' });
          }
        }
      }
      if (kind === 'open') { /* wnęka */ }
      else if (kind === 'door' || kind === 'doorGlass') {
        const rect = { x0: fx0, x1: fx1, y0: fy0, y1: fy1 };
        const wTot = fx1 - fx0;
        if (wTot > (s.splitDoors ?? 0.8)) {
          const xm = (fx0 + fx1) / 2;
          addFront(c, { x0: fx0, x1: xm, y0: fy0, y1: fy1 }, kind, zFront, { hinge: 'left' });
          addFront(c, { x0: xm, x1: fx1, y0: fy0, y1: fy1 }, kind, zFront, { hinge: 'right' });
        } else {
          // zawiasy po zewnętrznej stronie mebla
          const hinge = (fx0 + fx1) / 2 < ox ? 'left' : 'right';
          addFront(c, rect, kind, zFront, { hinge: cols.length === 1 ? (cl.hinge || 'left') : hinge });
        }
      } else {
        addFront(c, { x0: fx0, x1: fx1, y0: fy0, y1: fy1 }, kind, zFront, {});
      }
      y = cy0 - T;
    });
    x = x1 + T;
  });

  addBase(c, base, W, D, legH, zc, Dc);
}

// ---------------------------------------------------------------------------------------------
// Łóżko
// ---------------------------------------------------------------------------------------------
function buildBed(c, s) {
  const W = s.w * CM, L = s.d * CM, H = s.h * CM;
  const [mw, ml] = (s.mattress || [160, 200]).map((v) => v * CM);
  const legH = (s.legH ?? 8) * CM;
  const railTop = legH + 0.24;
  const upholstered = s.upholstered !== false;
  const fabricHex = (FINISHES[c.F.body] || {}).color || '#d6c8b8';
  const frameMat = upholstered ? fabricMaterial(fabricHex, 'boucle', { repeat: 9 }) : null;
  const zHead = -L / 2;
  const hbT = 0.1; // grubość wezgłowia
  const frameL = L - hbT;
  const fz = zHead + hbT + frameL / 2;
  // rama
  const railW = (W - mw) / 2 + 0.01;
  const rails = [
    [railW, railTop - legH, frameL, -W / 2 + railW / 2, fz],
    [railW, railTop - legH, frameL, W / 2 - railW / 2, fz],
    [W - 2 * railW, railTop - legH, railW, 0, zHead + L - railW / 2],
  ];
  for (const [w, h, d, x, z] of rails) {
    if (upholstered) c.slab(w, h, d, null, x, legH + h / 2, z, { material: frameMat, radius: 0.025, segments: 4 });
    else c.slab(w, h, d, c.F.body, x, legH + h / 2, z, { radius: 0.003 });
  }
  // wezgłowie
  const hbH = H - legH;
  if (s.headboard === 'channels' && upholstered) {
    const n = Math.max(5, Math.round(W / 0.16));
    const cw = W / n;
    for (let i = 0; i < n; i++) {
      c.slab(cw + 0.002, hbH, hbT, null, -W / 2 + cw * (i + 0.5), legH + hbH / 2, zHead + hbT / 2, { material: frameMat, radius: Math.min(0.045, cw / 2 - 0.002), segments: 5, grain: 'y' });
    }
  } else if (upholstered) {
    c.slab(W, hbH, hbT, null, 0, legH + hbH / 2, zHead + hbT / 2, { material: frameMat, radius: 0.04, segments: 5 });
  } else {
    c.slab(W, hbH, 0.03, c.F.front || c.F.body, 0, legH + hbH / 2, zHead + 0.015, { grain: 'x', radius: 0.003 });
  }
  // nogi
  if (legH > 0.01) {
    const m = s.base === 'legsMetal' ? metalMaterial(c.F.metal) : c.mat(c.F.legs || 'dab-naturalny');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = taperedLeg(legH, 0.022, 0.017, m);
      leg.position.set(sx * (W / 2 - 0.08), 0, sz > 0 ? zHead + L - 0.08 : zHead + 0.14);
      c.group.add(leg);
    }
  }
  // materac + prześcieradło
  const mattH = 0.22;
  const mTop = railTop - 0.06 + mattH;
  const sheetHex = s.sheet || '#ece8e1';
  const mz = zHead + hbT + 0.005 + ml / 2;
  c.slab(mw - 0.004, mattH, ml - 0.01, null, 0, mTop - mattH / 2, mz, { material: fabricMaterial(sheetHex, 'linen', { repeat: 12 }), radius: 0.05, segments: 5 });
  // kołdra
  const duvetHex = s.duvet || '#e3dcd0';
  const lTop = ml * 0.68;
  const zStart = mz + ml / 2 - lTop;
  const duvet = new THREE.Mesh(
    drapeGeometry({ w: mw + 0.01, lTop, topY: mTop + 0.012, z0: zStart, side: 0.3, foot: 0.3, r: Math.max(0.07, (W - mw) / 2 + 0.035), puff: 0.06, seed: c.seed() % 1000, headRoll: 0.18 }),
    fabricMaterial(duvetHex, 'linen', { repeat: 11 }),
  );
  duvet.material.side = THREE.DoubleSide;
  duvet.castShadow = duvet.receiveShadow = true;
  c.group.add(duvet);
  // odwinięty brzeg kołdry
  const fold = new THREE.Mesh(
    drapeGeometry({ w: mw + 0.01, lTop: 0.3, topY: mTop + 0.07, z0: zStart, side: 0.16, foot: 0.04, r: Math.max(0.07, (W - mw) / 2 + 0.05), puff: 0.012, seed: 77, nu: 120, nv: 40, wrinkle: 0.6 }),
    duvet.material,
  );
  fold.castShadow = fold.receiveShadow = true;
  c.group.add(fold);
  const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, mw - 0.02, 8, 24), duvet.material);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, mTop + 0.04, zStart + 0.005);
  roll.castShadow = roll.receiveShadow = true;
  c.group.add(roll);
  // poduszki
  const pillowHex = s.pillow || '#eeeae3';
  const pn = mw >= 1.35 ? 2 : 1;
  for (let i = 0; i < pn; i++) {
    const pw = Math.min(0.7, (mw - 0.06) / pn - 0.02);
    const geo = pillowGeometry(pw, 0.16, 0.5, { seed: 10 + i, wrinkle: 0.006 });
    const p = new THREE.Mesh(geo, fabricMaterial(pillowHex, 'linen', { repeat: 12 }));
    const px = pn === 1 ? 0 : (i - 0.5) * (pw + 0.03);
    p.position.set(px, mTop + 0.22, zHead + hbT + 0.14);
    p.rotation.set(-1.18, (i - 0.5) * 0.05, (i - 0.5) * 0.03);
    p.castShadow = p.receiveShadow = true;
    c.group.add(p);
  }
  // poduszki dekoracyjne
  if (s.cushions) {
    s.cushions.forEach((hex, i, arr) => {
      const geo = pillowGeometry(0.46, 0.14, 0.46, { seed: 40 + i, wrinkle: 0.005, boxy: 0.32 });
      const kind = i % 2 ? 'linen' : 'boucle';
      const p = new THREE.Mesh(geo, fabricMaterial(hex, kind, { repeat: 10 }));
      const px = (i - (arr.length - 1) / 2) * 0.42;
      p.position.set(px, mTop + 0.2, zHead + hbT + 0.33);
      p.rotation.set(-1.05, (i - (arr.length - 1) / 2) * 0.12, (i - (arr.length - 1) / 2) * -0.05);
      p.castShadow = p.receiveShadow = true;
      c.group.add(p);
    });
  }
  // pled w nogach
  if (s.throw) {
    const thr = new THREE.Mesh(
      drapeGeometry({ w: mw + 0.03, lTop: 0.42, topY: mTop + 0.075, z0: zStart + lTop - 0.42 - 0.02, side: 0.36, foot: 0.0, r: Math.max(0.1, (W - mw) / 2 + 0.07), puff: 0.006, seed: 9, wrinkle: 1.4, nu: 140, nv: 60 }),
      fabricMaterial(s.throw, 'knit', { repeat: 7 }),
    );
    thr.material.side = THREE.DoubleSide;
    thr.castShadow = thr.receiveShadow = true;
    c.group.add(thr);
  }
}

// ---------------------------------------------------------------------------------------------
// Stół / ława / biurko
// ---------------------------------------------------------------------------------------------
function tableLegs(c, base, W, D, H, inset, legFinish, opts = {}) {
  const legLen = H;
  if (base === 'legsMetal') {
    const m = metalMaterial(c.F.metal);
    const s = opts.metalSize || 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = slab(s, legLen, s, m, { radius: 0.004 });
      leg.position.set(sx * (W / 2 - inset), legLen / 2, sz * (D / 2 - inset));
      c.group.add(leg);
    }
    // rama pod blatem
    const fh = 0.04;
    for (const sz of [-1, 1]) { const r = slab(W - 2 * inset, fh, 0.02, m, { radius: 0.003 }); r.position.set(0, H - fh / 2, sz * (D / 2 - inset)); c.group.add(r); }
    for (const sx of [-1, 1]) { const r = slab(0.02, fh, D - 2 * inset, m, { radius: 0.003 }); r.position.set(sx * (W / 2 - inset), H - fh / 2, 0); c.group.add(r); }
  } else if (base === 'frame') {
    const m = metalMaterial(c.F.metal);
    const s = 0.03;
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - inset);
      for (const sz of [-1, 1]) { const p = slab(s, H, s, m, { radius: 0.004 }); p.position.set(x, H / 2, sz * (D / 2 - inset - 0.02)); c.group.add(p); }
      const top = slab(s, s, D - 2 * inset - 0.04 + s, m, { radius: 0.004 }); top.position.set(x, H - s / 2, 0); c.group.add(top);
      const bot = slab(s, s, D - 2 * inset - 0.04 + s, m, { radius: 0.004 }); bot.position.set(x, s / 2, 0); c.group.add(bot);
    }
  } else {
    const mat = c.mat(legFinish);
    const splay = THREE.MathUtils.degToRad(opts.splay ?? 3);
    const rTop = opts.rTop || 0.026, rBot = opts.rBot || 0.017;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = taperedLeg(legLen / Math.cos(splay) + 0.003, rTop, rBot, mat);
      const holder = new THREE.Group();
      holder.position.set(sx * (W / 2 - inset), H + 0.001, sz * (D / 2 - inset));
      leg.rotation.x = Math.PI;
      holder.add(leg);
      holder.rotation.z = -sx * splay;
      holder.rotation.x = sz * splay;
      c.group.add(holder);
    }
    if (opts.apron) {
      const ah = 0.07, at = 0.022;
      for (const sz of [-1, 1]) c.slab(W - 2 * inset - 0.03, ah, at, legFinish, 0, H - ah / 2, sz * (D / 2 - inset), { grain: 'x', radius: 0.002 });
      for (const sx of [-1, 1]) c.slab(at, ah, D - 2 * inset - 0.03, legFinish, sx * (W / 2 - inset), H - ah / 2, 0, { grain: 'z', radius: 0.002 });
    }
  }
}

function buildTable(c, s) {
  const W = s.w * CM, H = s.h * CM, D = s.d * CM;
  const tt = (s.top || 3) * CM;
  const topF = c.F.top || c.F.body;
  c.slab(W, tt, D, topF, 0, H - tt / 2, 0, { grain: 'x', radius: 0.004, segments: 3 });
  const base = s.base || 'legsWood';
  const inset = s.kind === 'coffeeTable' ? 0.075 : 0.085;
  if (s.kind === 'coffeeTable') {
    tableLegs(c, base, W, D, H - tt, inset, c.F.legs || c.F.body, { rTop: 0.024, rBot: 0.016, splay: 5, metalSize: 0.022 });
    if (s.shelf) c.slab(W - 2 * inset - 0.01, 0.018, D - 2 * inset + 0.03, topF, 0, 0.13, 0, { grain: 'x', radius: 0.002 });
  } else {
    tableLegs(c, base, W, D, H - tt, inset, c.F.legs || c.F.body, { apron: base === 'legsWood', rTop: 0.028, rBot: 0.018, splay: 2 });
  }
}

function buildDesk(c, s) {
  const W = s.w * CM, H = s.h * CM, D = s.d * CM;
  const tt = (s.top || 2.5) * CM;
  const topF = c.F.top || c.F.body;
  c.slab(W, tt, D, topF, 0, H - tt / 2, 0, { grain: 'x', radius: 0.004, segments: 3 });
  const pedW = (s.pedestal || 40) * CM;
  const side = s.pedestalSide === 'left' ? -1 : 1;
  const pedSpec = { kind: 'cabinet', w: pedW * 100, h: (H - tt) * 100, d: (D - 0.03) * 100, base: 'plinth', legH: 2, columns: s.columns || [{ w: 1, cells: [{ t: 'drawer', h: 1 }, { t: 'drawer', h: 1 }, { t: 'drawer', h: 1.3 }] }], handle: s.handle };
  const sub = new Ctx(Object.assign({}, pedSpec, { finish: { body: c.F.body, front: c.F.front, metal: c.F.metal } }));
  buildCabinet(sub, pedSpec);
  sub.group.position.set(side * (W / 2 - pedW / 2 - 0.01), 0, -0.015);
  c.group.add(sub.group);
  // nogi po przeciwnej stronie
  const legF = c.F.legs || c.F.body;
  const legLen = H - tt;
  const inset = 0.06;
  if (s.base === 'legsMetal') {
    const m = metalMaterial(c.F.metal);
    for (const sz of [-1, 1]) { const leg = slab(0.03, legLen, 0.03, m, { radius: 0.004 }); leg.position.set(-side * (W / 2 - inset), legLen / 2, sz * (D / 2 - inset)); c.group.add(leg); }
  } else {
    const mat = c.mat(legF);
    for (const sz of [-1, 1]) {
      const leg = taperedLeg(legLen + 0.002, 0.025, 0.016, mat);
      const h = new THREE.Group(); h.position.set(-side * (W / 2 - inset), legLen + 0.001, sz * (D / 2 - inset));
      leg.rotation.x = Math.PI; h.add(leg);
      h.rotation.z = side * THREE.MathUtils.degToRad(2.5); h.rotation.x = sz * THREE.MathUtils.degToRad(2.5);
      c.group.add(h);
    }
  }
  // listwa pod blatem (oskrzynia) między nogami a kontenerem
  const span = W - pedW - inset - 0.04;
  c.slab(span, 0.06, 0.02, legF, -side * (W / 2 - inset - span / 2 + 0.01) , H - tt - 0.03, -D / 2 + inset, { grain: 'x', radius: 0.002 });
}

// ---------------------------------------------------------------------------------------------
// Półka wisząca, lustro, wieszak
// ---------------------------------------------------------------------------------------------
function buildWallShelf(c, s) {
  const W = s.w * CM, D = s.d * CM;
  const n = s.shelves || 1;
  const t = (s.top || 2.5) * CM;
  const y0 = (s.legH ?? 120) * CM;
  for (let i = 0; i < n; i++) c.slab(W, t, D, c.F.body, 0, y0 + i * 0.32, 0, { grain: 'x', radius: 0.003 });
}

function archShape(w, h, inset = 0) {
  const sh = new THREE.Shape();
  const r = w / 2 - inset;
  const x0 = -w / 2 + inset, x1 = w / 2 - inset, y0 = inset, yA = h - w / 2;
  sh.moveTo(x0, y0); sh.lineTo(x1, y0); sh.lineTo(x1, yA);
  sh.absarc(0, yA, r, 0, Math.PI, false);
  sh.lineTo(x0, y0);
  return sh;
}
function rectShape(w, h, inset = 0, rad = 0.004) {
  const sh = new THREE.Shape();
  const x0 = -w / 2 + inset, x1 = w / 2 - inset, y0 = inset, y1 = h - inset;
  const r = Math.min(rad, (x1 - x0) / 2);
  sh.moveTo(x0 + r, y0); sh.lineTo(x1 - r, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + r);
  sh.lineTo(x1, y1 - r); sh.quadraticCurveTo(x1, y1, x1 - r, y1); sh.lineTo(x0 + r, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - r);
  sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
  return sh;
}

function buildMirror(c, s) {
  const W = s.w * CM, H = s.h * CM;
  const fw = (s.frame ?? 3) * CM;
  const depth = 0.025;
  const shapeFn = s.shape === 'arch' ? archShape : rectShape;
  const outer = shapeFn(W, H, 0);
  const inner = shapeFn(W, H, fw);
  outer.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
  const geo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 64 });
  geo.computeVertexNormals();
  const mat = c.mat(c.F.body);
  boxUV(geo, 'y', mat.userData.texInfo || {}, c.seed());
  const frame = new THREE.Mesh(geo, mat);
  frame.castShadow = frame.receiveShadow = true;
  const y0 = (s.legH ?? 0) * CM;
  frame.position.set(0, y0, -depth / 2 - 0.003);
  c.group.add(frame);
  const glassGeo = new THREE.ShapeGeometry(shapeFn(W, H, fw - 0.004), 64);
  const glass = new THREE.Mesh(glassGeo, mirrorMaterial());
  glass.position.set(0, y0, 0.006 - depth / 2);
  glass.receiveShadow = true;
  c.group.add(glass);
  const back = slab(W - 0.01, H - 0.01, 0.006, plainMaterial('#3a3a3a', 0.9), { radius: 0.001 });
  back.position.set(0, y0 + H / 2, -depth / 2 - 0.004);
  if (s.shape !== 'arch') c.group.add(back);
}

function buildCoatRack(c, s) {
  const W = s.w * CM, H = s.h * CM;
  const y0 = (s.legH ?? 100) * CM;
  const pt = 0.02;
  c.slab(W, H, pt, c.F.body, 0, y0 + H / 2, -0.05 + pt / 2, { grain: 'x', radius: 0.003 });
  const n = s.hooks || Math.max(3, Math.round(W / 0.17));
  const m = metalMaterial(c.F.metal);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (W / n) * (i + 0.5);
    const y = y0 + H * 0.62;
    const z0 = -0.05 + pt;
    const a = cylinderBetween(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y - 0.012, z0 + 0.06), 0.005, m);
    const b = cylinderBetween(new THREE.Vector3(x, y - 0.012, z0 + 0.06), new THREE.Vector3(x, y + 0.02, z0 + 0.075), 0.005, m);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 12), m);
    ball.position.set(x, y + 0.02, z0 + 0.075); ball.castShadow = true;
    c.group.add(a, b, ball);
  }
  if (s.shelf) c.slab(W, 0.022, (s.d || 25) * CM, c.F.top || c.F.body, 0, y0 + H + 0.011, -0.05 + ((s.d || 25) * CM) / 2, { grain: 'x', radius: 0.003 });
}

// ---------------------------------------------------------------------------------------------
export function buildModel(spec) {
  const c = new Ctx(spec);
  switch (spec.kind) {
    case 'cabinet': buildCabinet(c, spec); break;
    case 'bed': buildBed(c, spec); break;
    case 'table': case 'coffeeTable': buildTable(c, spec); break;
    case 'desk': buildDesk(c, spec); break;
    case 'wallShelf': buildWallShelf(c, spec); break;
    case 'mirror': buildMirror(c, spec); break;
    case 'coatRack': buildCoatRack(c, spec); break;
    default: throw new Error('Nieznany rodzaj mebla: ' + spec.kind);
  }
  c.group.traverse((o) => { if (o.isMesh) o.layers.enableAll(); });
  c.group.userData.spec = spec;
  return c.group;
}
