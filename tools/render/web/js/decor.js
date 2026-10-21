// Dekoracje do aranżacji: wazon z gałązkami, książki, grafiki w ramach, ceramika, lampy, krzesło, dywan, roślina, kosz.
// Każdy obiekt: THREE.Group z podstawą na y=0, „przód” w kierunku +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishMaterial, metalMaterial, fabricMaterial, plainMaterial, glassMaterial } from './materials.js';
import { slab, lathe, taperedLeg, cylinderBetween, pillowGeometry } from './geom.js';
import { artTexture, rugTexture } from './textures.js';
import { patchMaterial } from './engine.js';
import { mulberry32, makeNoise } from './noise.js';

function grp(...objs) { const g = new THREE.Group(); objs.forEach((o) => g.add(o)); return g; }
function shadowAll(g) { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

const ceramicCache = new Map();
export function ceramic(hex, rough = 0.85) {
  const k = hex + rough;
  if (!ceramicCache.has(k)) ceramicCache.set(k, plainMaterial(hex, rough, { specularIntensity: 0.4 }));
  return ceramicCache.get(k);
}

// ---------------------------------------------------------------------------------------------
// Wazon z suchymi gałązkami
// ---------------------------------------------------------------------------------------------
export function vaseWithBranches({ h = 0.32, color = '#e9e3d8', branchColor = '#4a3b2e', seed = 3, spread = 1, branchH = 0.75, leaves = false, leafColor = '#9c8f6e', shape = 'bottle' } = {}) {
  const r = h * 0.32;
  const prof = shape === 'round'
    ? [[0, 0], [r * 0.55, 0], [r * 0.9, h * 0.1], [r * 1.1, h * 0.35], [r, h * 0.62], [r * 0.45, h * 0.86], [r * 0.38, h * 0.97], [r * 0.42, h], [r * 0.34, h], [r * 0.3, h * 0.9], [0, h * 0.88]]
    : [[0, 0], [r * 0.7, 0], [r * 0.82, h * 0.04], [r, h * 0.3], [r * 0.92, h * 0.55], [r * 0.5, h * 0.78], [r * 0.34, h * 0.9], [r * 0.38, h], [r * 0.3, h], [r * 0.28, h * 0.92], [0, h * 0.9]];
  const vase = lathe(prof, ceramic(color, 0.82), 64);
  const g = grp(vase);
  const rnd = mulberry32(seed);
  const n = makeNoise(seed);
  const geos = [];
  const leafGeos = [];
  const top = new THREE.Vector3(0, h * 0.95, 0);
  function branch(start, dir, len, rad, depth) {
    const pts = [start.clone()];
    let p = start.clone(), d = dir.clone();
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      d.add(new THREE.Vector3((rnd() - 0.5) * 0.25, -0.02 * i * (depth > 0 ? 1 : 0.3), (rnd() - 0.5) * 0.25)).normalize();
      p = p.clone().addScaledVector(d, len / steps);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    geos.push(new THREE.TubeGeometry(curve, 12, rad, 5, false));
    if (depth < 2) {
      const nb = depth === 0 ? 3 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < nb; k++) {
        const t = 0.35 + rnd() * 0.55;
        const sp = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const side = new THREE.Vector3(rnd() - 0.5, rnd() * 0.3, rnd() - 0.5).normalize();
        const nd = tan.clone().multiplyScalar(0.6).addScaledVector(side, 0.8).normalize();
        branch(sp, nd, len * (0.32 + rnd() * 0.25), rad * 0.6, depth + 1);
      }
    }
    if (leaves && depth >= 1) {
      for (let k = 0; k < 6; k++) {
        const t = 0.2 + rnd() * 0.8;
        const sp = curve.getPoint(t);
        const lg = new THREE.SphereGeometry(1, 6, 4);
        lg.scale(0.012, 0.002, 0.008);
        lg.rotateY(rnd() * Math.PI); lg.rotateX((rnd() - 0.5) * 1.2);
        lg.translate(sp.x, sp.y, sp.z);
        leafGeos.push(lg);
      }
    }
  }
  const nMain = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + rnd() * 0.6;
    const tilt = (0.18 + rnd() * 0.32) * spread;
    const dir = new THREE.Vector3(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).normalize();
    branch(top, dir, h * branchH * (1.6 + rnd() * 0.9), 0.0028, 0);
  }
  const bm = new THREE.Mesh(mergeGeometries(geos), plainMaterial(branchColor, 0.9));
  g.add(bm);
  if (leafGeos.length) {
    for (const lg of leafGeos) { lg.deleteAttribute('uv'); }
    g.add(new THREE.Mesh(mergeGeometries(leafGeos), plainMaterial(leafColor, 0.8, { side: THREE.DoubleSide })));
  }
  return shadowAll(g);
}

/** Proste naczynia ceramiczne: misa, mały wazon, świeca. */
export function bowl({ d = 0.26, h = 0.08, color = '#d8cfc2' } = {}) {
  const r = d / 2;
  return shadowAll(grp(lathe([[0, 0], [r * 0.45, 0], [r * 0.8, h * 0.35], [r, h], [r * 0.95, h], [r * 0.76, h * 0.38], [r * 0.4, h * 0.12], [0, h * 0.1]], ceramic(color, 0.7), 64)));
}
export function smallVase({ h = 0.18, color = '#2f2c29', shape = 0 } = {}) {
  const r = h * 0.35;
  const prof = shape === 1
    ? [[0, 0], [r * 0.9, 0], [r, h * 0.5], [r * 0.4, h * 0.85], [r * 0.3, h], [r * 0.22, h], [0, h * 0.85]]
    : [[0, 0], [r * 0.6, 0], [r, h * 0.45], [r * 0.95, h * 0.7], [r * 0.55, h], [r * 0.45, h], [0, h * 0.9]];
  return shadowAll(grp(lathe(prof, ceramic(color, 0.6), 64)));
}
export function candle({ h = 0.12, r = 0.035, color = '#efe9df' } = {}) {
  const c = lathe([[0, 0], [r, 0], [r, h], [r * 0.9, h + 0.003], [0, h - 0.004]], plainMaterial(color, 0.6, { sheen: 0.2 }), 40);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.012, 6), plainMaterial('#222', 0.9));
  wick.position.y = h + 0.003;
  return shadowAll(grp(c, wick));
}

// ---------------------------------------------------------------------------------------------
// Książki
// ---------------------------------------------------------------------------------------------
const BOOK_COLORS = ['#e8e1d3', '#c9b79c', '#7d8a72', '#b4654a', '#2f3437', '#d9cdb8', '#8c7b68', '#efe9de', '#5b6b73'];
export function book({ w = 0.16, h = 0.24, t = 0.025, color = '#e8e1d3' } = {}) {
  // leżąca: w = szerokość (x), h = długość (z), t = grubość (y)
  const cover = 0.0018;
  const g = new THREE.Group();
  const coverMat = plainMaterial(color, 0.75);
  const paper = plainMaterial('#f1ece2', 0.95);
  const top = slab(w, cover, h, coverMat, { radius: 0.0006 }); top.position.y = t - cover / 2;
  const bot = slab(w, cover, h, coverMat, { radius: 0.0006 }); bot.position.y = cover / 2;
  const spine = slab(0.003, t, h, coverMat, { radius: 0.001 }); spine.position.set(-w / 2 + 0.0015, t / 2, 0);
  const pages = slab(w - 0.006, t - 2 * cover, h - 0.006, paper, { radius: 0.0008 }); pages.position.set(0.0005, t / 2, 0);
  g.add(top, bot, spine, pages);
  return shadowAll(g);
}
export function bookStack({ count = 3, seed = 1, colors } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < count; i++) {
    const w = 0.15 + rnd() * 0.08, h = 0.21 + rnd() * 0.08, t = 0.016 + rnd() * 0.022;
    const b = book({ w, h, t, color: (colors || BOOK_COLORS)[Math.floor(rnd() * (colors || BOOK_COLORS).length)] });
    b.position.y = y;
    b.rotation.y = (rnd() - 0.5) * 0.25;
    g.add(b);
    y += t;
  }
  g.userData.height = y;
  return g;
}
/** Rząd stojących książek (na półkę); szerokość całkowita ~ length. */
export function bookRow({ length = 0.4, maxH = 0.28, seed = 2, lean = true, colors } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  let x = -length / 2;
  const cols = colors || BOOK_COLORS;
  while (x < length / 2 - 0.02) {
    const t = 0.014 + rnd() * 0.03, h = maxH * (0.72 + rnd() * 0.28), w = 0.15 + rnd() * 0.06;
    const b = book({ w, h, t, color: cols[Math.floor(rnd() * cols.length)] });
    // stojąca: obrót tak, by grzbiet był z przodu (+z), wysokość = h
    b.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    b.position.set(x + t / 2, h / 2, 0);
    b.rotation.y = (rnd() - 0.5) * 0.04;
    g.add(b);
    x += t + 0.001;
  }
  if (lean) {
    const last = g.children[g.children.length - 1];
    if (last) { last.rotation.z += 0.0; }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Grafika w ramie (wisząca: tył na z=0, środek ramy na wysokości y)
// ---------------------------------------------------------------------------------------------
export function framedArt({ w = 0.5, h = 0.7, style = 'arches', palette = {}, frame = 'oak', matBorder = 0.06, depth = 0.025 } = {}) {
  const g = new THREE.Group();
  const fw = 0.018;
  const fm = frame === 'oak' ? finishMaterial('dab-naturalny', 1) : frame === 'black' ? finishMaterial('czarny-mat') : frame === 'walnut' ? finishMaterial('orzech', 0) : finishMaterial('bialy-mat');
  const parts = [
    [w, fw, depth, 0, h / 2 - fw / 2, 'x'], [w, fw, depth, 0, -h / 2 + fw / 2, 'x'],
    [fw, h - 2 * fw, depth, -w / 2 + fw / 2, 0, 'y'], [fw, h - 2 * fw, depth, w / 2 - fw / 2, 0, 'y'],
  ];
  for (const [a, b, c, x, y, gr] of parts) { const m = slab(a, b, c, fm, { radius: 0.002, grain: gr }); m.position.set(x, y, depth / 2); g.add(m); }
  const iw = w - 2 * fw, ih = h - 2 * fw;
  const mat = slab(iw, ih, 0.004, plainMaterial('#f3f0ea', 0.95), { radius: 0.0005 });
  mat.position.set(0, 0, depth - 0.012);
  g.add(mat);
  const aw = iw - 2 * matBorder, ah = ih - 2 * matBorder;
  const tex = artTexture(style, palette, 1024, Math.round(1024 * ah / aw));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), patchMaterial(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.9, specularIntensity: 0.3 })));
  art.position.set(0, 0, depth - 0.0095);
  art.receiveShadow = true;
  g.add(art);
  // szyba (delikatne odbicie)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, specularIntensity: 0.7, transparent: true, opacity: 0.06, depthWrite: false })));
  glass.position.set(0, 0, depth - 0.004);
  glass.userData.noAO = true;
  glass.material.userData.directSpec = 0.15;
  g.add(glass);
  g.traverse((o) => { if (o.isMesh && o !== glass) { o.castShadow = true; o.receiveShadow = true; } });
  return wallMounted(g);
}

/** Obiekty na ścianie nie rzucają cieni od światła odbitego (przy kątach ślizgowych dawały długie „prostokąty”). */
export function wallMounted(g) {
  g.traverse((o) => { if (o.isMesh) o.userData.noBounceCast = true; });
  return g;
}

// ---------------------------------------------------------------------------------------------
// Lampy (wyłączone — światło dzienne)
// ---------------------------------------------------------------------------------------------
function shadeMesh(rTop, rBot, h, color) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 64, 1, true);
  const m = new THREE.Mesh(geo, fabricMaterial(color, 'linen', { repeat: 14, sheen: 0.3 }));
  m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
  patchMaterial(m.material);
  m.castShadow = m.receiveShadow = true;
  // UV w metrach
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * rBot, uv.getY(i) * h);
  return m;
}
export function tableLamp({ baseColor = '#d9d1c4', shadeColor = '#efe8dc', h = 0.5 } = {}) {
  const bh = h * 0.55;
  const base = lathe([[0, 0], [0.05, 0], [0.085, bh * 0.25], [0.09, bh * 0.5], [0.07, bh * 0.8], [0.02, bh * 0.95], [0.012, bh], [0, bh]], ceramic(baseColor, 0.55), 64);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, h * 0.2, 12), metalMaterial('zloty'));
  stem.position.y = bh + h * 0.1;
  const shade = shadeMesh(0.12, 0.17, h * 0.36, shadeColor);
  shade.position.y = bh + h * 0.08 + h * 0.18;
  return shadowAll(grp(base, stem, shade));
}
export function floorLamp({ h = 1.55, shadeColor = '#efe8dc', metal = 'czarny' } = {}) {
  const m = metalMaterial(metal);
  const base = lathe([[0, 0], [0.14, 0], [0.145, 0.006], [0.14, 0.018], [0.02, 0.022], [0, 0.022]], m, 64);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, h - 0.3, 16), m);
  pole.position.y = (h - 0.3) / 2 + 0.02;
  const shade = shadeMesh(0.17, 0.22, 0.3, shadeColor);
  shade.position.y = h - 0.15;
  return shadowAll(grp(base, pole, shade));
}
export function pendantLamp({ drop = 0.9, color = '#1f1f1f', r = 0.2, ceilingY = 2.75 } = {}) {
  // początek grupy: na suficie; klosz zwisa w dół o `drop`
  const m = plainMaterial(color, 0.45, { metalness: 0.3 });
  const shade = lathe([[0.012, 0.0], [0.03, -0.005], [r * 0.45, -r * 0.25], [r * 0.8, -r * 0.55], [r, -r * 0.75], [r * 0.99, -r * 0.76], [r * 0.79, -r * 0.555], [r * 0.44, -r * 0.255], [0.029, -0.008], [0.0, -0.006]], m, 64);
  shade.position.y = -drop;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, drop, 8), plainMaterial('#151515', 0.6));
  cord.position.y = -drop / 2;
  const canopy = lathe([[0, 0], [0.05, 0], [0.05, -0.02], [0.04, -0.03], [0, -0.03]], m, 32);
  const g = shadowAll(grp(shade, cord, canopy));
  return g;
}
export function deskLamp({ metal = 'czarny' } = {}) {
  const m = metalMaterial(metal);
  const base = lathe([[0, 0], [0.075, 0], [0.075, 0.012], [0.02, 0.018], [0, 0.018]], m, 48);
  const a1 = cylinderBetween(new THREE.Vector3(0, 0.015, 0), new THREE.Vector3(0.04, 0.33, -0.02), 0.006, m);
  const a2 = cylinderBetween(new THREE.Vector3(0.04, 0.33, -0.02), new THREE.Vector3(0.2, 0.42, 0.0), 0.006, m);
  const head = lathe([[0.012, 0], [0.03, -0.01], [0.06, -0.07], [0.065, -0.1], [0.06, -0.1], [0.055, -0.072], [0.026, -0.012], [0.0, -0.008]], m, 48);
  head.position.set(0.2, 0.43, 0.0);
  head.rotation.z = 0.5;
  return shadowAll(grp(base, a1, a2, head));
}

// ---------------------------------------------------------------------------------------------
// Krzesło (drewniane, z tapicerowanym siedziskiem)
// ---------------------------------------------------------------------------------------------
export function chair({ finish = 'dab-naturalny', seatColor = '#d9cfc0', seatH = 0.46, w = 0.46, d = 0.5, backH = 0.82 } = {}) {
  const g = new THREE.Group();
  const wood = finishMaterial(finish, 1);
  const legR = 0.017;
  // nogi przednie
  for (const sx of [-1, 1]) {
    const leg = taperedLeg(seatH - 0.03, legR, legR * 0.7, wood);
    leg.position.set(sx * (w / 2 - 0.03), 0, d / 2 - 0.035);
    g.add(leg);
  }
  // nogi tylne (aż do oparcia, lekko odchylone)
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * (w / 2 - 0.03), 0, -d / 2 + 0.04);
    const b = new THREE.Vector3(sx * (w / 2 - 0.035), backH, -d / 2 - 0.02);
    const geo = new THREE.CylinderGeometry(legR * 0.85, legR * 0.7, a.distanceTo(b), 24);
    const m = new THREE.Mesh(geo, wood);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  }
  // rama siedziska
  const fr = slab(w - 0.02, 0.05, d - 0.03, wood, { radius: 0.004, grain: 'x' });
  fr.position.set(0, seatH - 0.06, 0.0);
  g.add(fr);
  // poduszka siedziska
  const cushion = new THREE.Mesh(pillowGeometry(w + 0.01, 0.065, d - 0.0, { seed: 5, wrinkle: 0.002, boxy: 0.18, pinch: 0.35 }), fabricMaterial(seatColor, 'boucle', { repeat: 10 }));
  cushion.position.set(0, seatH - 0.012, 0.01);
  g.add(cushion);
  // oparcie wygięte (fragment cylindra)
  const R = 0.6, ang = (w - 0.02) / R;
  const bg = new THREE.CylinderGeometry(R, R, 0.1, 48, 1, true, Math.PI - ang / 2, ang);
  const back = new THREE.Mesh(bg, wood);
  back.material = finishMaterial(finish, 2);
  back.position.set(0, backH - 0.08, -d / 2 - 0.015 + R - 0.0);
  back.scale.set(1, 1, 1);
  g.add(back);
  // grubość oparcia — druga powłoka
  const bg2 = new THREE.CylinderGeometry(R + 0.016, R + 0.016, 0.1, 48, 1, true, Math.PI - ang / 2, ang);
  const back2 = new THREE.Mesh(bg2, finishMaterial(finish, 2));
  back2.material.side = THREE.FrontSide;
  back2.position.copy(back.position);
  g.add(back2);
  back.material = back.material.clone(); back.material.side = THREE.BackSide; patchMaterial(back.material);
  const capT = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.016, 48, 1, Math.PI / 2 + ang / 2 - ang, ang), finishMaterial(finish, 2));
  capT.material = capT.material.clone(); capT.material.side = THREE.DoubleSide; patchMaterial(capT.material);
  capT.rotation.x = -Math.PI / 2;
  capT.position.set(back.position.x, back.position.y + 0.05, back.position.z);
  g.add(capT);
  const capB = capT.clone(); capB.position.y -= 0.1; g.add(capB);
  // poprzeczki
  for (const sx of [-1, 1]) { const s = cylinderBetween(new THREE.Vector3(sx * (w / 2 - 0.03), 0.16, d / 2 - 0.035), new THREE.Vector3(sx * (w / 2 - 0.03), 0.16, -d / 2 + 0.04), 0.008, wood); g.add(s); }
  return shadowAll(g);
}

// ---------------------------------------------------------------------------------------------
// Dywan
// ---------------------------------------------------------------------------------------------
export function rug({ w = 2.0, d = 1.4, base = '#e6dfd3', line = '#b9ac98', pattern = 'diamond', t = 0.012 } = {}) {
  const tex = rugTexture({ w: 2048, h: Math.round(2048 * d / w), base, line, pattern });
  const mat = patchMaterial(new THREE.MeshPhysicalMaterial({ map: tex.map, roughness: 1, roughnessMap: tex.data, bumpMap: tex.data, bumpScale: 3.5, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(base), specularIntensity: 0.2 }));
  const geo = new THREE.BoxGeometry(w, t, d, 1, 1, 1);
  // UV: góra 0..1
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, 0.5 - pos.getZ(i) / d);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = t / 2;
  m.receiveShadow = true; m.castShadow = true;
  m.userData.noBounceCast = true;
  return grp(m);
}

// ---------------------------------------------------------------------------------------------
// Kosz pleciony
// ---------------------------------------------------------------------------------------------
export function basket({ r = 0.2, h = 0.3, color = '#b79c76' } = {}) {
  const mat = fabricMaterial(color, 'knit', { repeat: 9 });
  const prof = [[0, 0.004], [r * 0.9, 0], [r, 0.02], [r * 1.02, h * 0.9], [r * 1.04, h], [r * 0.99, h], [r * 0.97, h * 0.9], [r * 0.95, 0.03], [0, 0.03]];
  const m = lathe(prof, mat, 64);
  const uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * h * 1.3);
  return shadowAll(grp(m));
}

// ---------------------------------------------------------------------------------------------
// Roślina: drzewko oliwne w donicy
// ---------------------------------------------------------------------------------------------
export function oliveTree({ h = 1.6, potColor = '#cfc6b8', seed = 7, leafColor = '#8a967a', potH = 0.42, potR = 0.22 } = {}) {
  const g = new THREE.Group();
  const pot = lathe([[0, 0], [potR * 0.82, 0], [potR * 0.85, 0.01], [potR, potH * 0.92], [potR * 1.02, potH], [potR * 0.94, potH], [potR * 0.92, potH * 0.9], [0, potH * 0.9]], ceramic(potColor, 0.9), 64);
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(potR * 0.93, 32), plainMaterial('#3b3027', 1));
  soil.rotation.x = -Math.PI / 2; soil.position.y = potH * 0.88;
  g.add(soil);
  const rnd = mulberry32(seed);
  const barkMat = plainMaterial('#6b6155', 0.95);
  const geos = [];
  const tips = [];
  function branch(start, dir, len, rad, depth) {
    const pts = [start.clone()];
    let p = start.clone(), d = dir.clone();
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      d.add(new THREE.Vector3((rnd() - 0.5) * 0.3, 0.02, (rnd() - 0.5) * 0.3)).normalize();
      p = p.clone().addScaledVector(d, len / steps);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, 16, rad, 7, false);
    // zwężenie
    geos.push(tg);
    if (depth < 3) {
      const nb = depth === 0 ? 3 : 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < nb; k++) {
        const t = depth === 0 ? 0.75 + rnd() * 0.25 : 0.4 + rnd() * 0.6;
        const sp = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const a = rnd() * Math.PI * 2;
        const nd = tan.clone().multiplyScalar(0.5).add(new THREE.Vector3(Math.cos(a) * 0.75, 0.6 + rnd() * 0.5, Math.sin(a) * 0.75)).normalize();
        branch(sp, nd, len * (depth === 0 ? 0.42 + rnd() * 0.15 : 0.5 + rnd() * 0.2), rad * 0.6, depth + 1);
      }
    } else {
      tips.push(curve);
    }
    if (depth >= 2) tips.push(curve);
  }
  branch(new THREE.Vector3(0, potH * 0.85, 0), new THREE.Vector3(0.05, 1, 0.02).normalize(), (h - potH) * 0.55, 0.024, 0);
  g.add(new THREE.Mesh(mergeGeometries(geos), barkMat));
  // liście (instancjonowane)
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.006, 0.025, 0, 0.055); leafShape.quadraticCurveTo(-0.006, 0.025, 0, 0);
  const lg = new THREE.ShapeGeometry(leafShape, 4);
  const pos = lg.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -Math.pow(y / 0.055, 2) * 0.006 + Math.abs(pos.getX(i)) * 0.4); }
  lg.computeVertexNormals();
  const leafMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(leafColor), roughness: 0.62, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color('#c8cfbd'), specularIntensity: 0.5 }));
  // skupiska liści wokół końców gałęzi (zwarta korona)
  const centers = [];
  for (const c of tips) for (const t of [0.55, 0.8, 1.0]) centers.push(c.getPoint(t));
  const N = 7000;
  const inst = new THREE.InstancedMesh(lg, leafMat, N);
  const dummy = new THREE.Object3D();
  const colors = new THREE.Color();
  const base = new THREE.Color(leafColor);
  for (let i = 0; i < N; i++) {
    const c = centers[Math.floor(rnd() * centers.length)];
    // punkt w elipsoidzie (więcej na powierzchni)
    const a = rnd() * Math.PI * 2, z = rnd() * 2 - 1, rr = Math.pow(rnd(), 0.4) * (0.09 + rnd() * 0.07);
    const q = Math.sqrt(1 - z * z);
    dummy.position.set(c.x + Math.cos(a) * q * rr, c.y + z * rr * 0.75, c.z + Math.sin(a) * q * rr);
    dummy.rotation.set((rnd() - 0.5) * 2.6 + 0.4, rnd() * Math.PI * 2, (rnd() - 0.5) * 2.6);
    const sc = 0.75 + rnd() * 0.45;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    colors.copy(base).multiplyScalar(0.82 + rnd() * 0.36);
    if (rnd() < 0.3) colors.lerp(new THREE.Color('#b9c0ad'), 0.35);
    inst.setColorAt(i, colors);
  }
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
  return shadowAll(g);
}

/** Kapelusz (na wieszak). */
export function hat({ color = '#c8b28a' } = {}) {
  const m = lathe([[0, 0.11], [0.06, 0.105], [0.085, 0.08], [0.09, 0.02], [0.17, 0.004], [0.175, 0], [0.17, -0.004], [0.09, 0.012], [0.08, 0.075], [0.0, 0.098]], fabricMaterial(color, 'knit', { repeat: 20 }), 64);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0905, 0.091, 0.025, 64, 1, true), plainMaterial('#2c2a28', 0.8));
  band.position.y = 0.035;
  return shadowAll(grp(m, band));
}

/** Torba płócienna wisząca (prosta bryła poduszkowa). */
export function toteBag({ color = '#e3dbcc' } = {}) {
  const mat = fabricMaterial(color, 'linen', { repeat: 10 });
  const body = new THREE.Mesh(pillowGeometry(0.36, 0.022, 0.4, { seed: 31, wrinkle: 0.009, boxy: 0.06, pinch: 0.92 }), mat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, -0.3, 0.004);
  // dwa ucha (taśmy) zawieszone na haczyku
  const straps = [];
  for (const k of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0055, 8, 40, Math.PI), mat);
    st.scale.set(1, 1.35, 1);
    st.position.set(0, -0.1, k * 0.006);
    st.rotation.z = k * 0.04;
    straps.push(st);
  }
  return shadowAll(grp(body, ...straps));
}

// ---------------------------------------------------------------------------------------------
// Meble tapicerowane do aranżacji (dekor, nie z katalogu): fotel, sofa, puf
// ---------------------------------------------------------------------------------------------
function softBlock(w, h, d, mat, r = 0.04) {
  const m = slab(w, h, d, mat, { radius: Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002), segments: 5 });
  return m;
}
function woodLegs(g, W, D, h, finish = 'dab-naturalny', inset = 0.06, rTop = 0.02, rBot = 0.013) {
  const mat = finishMaterial(finish, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const len = h + 0.004;
    const leg = taperedLeg(len, rTop, rBot, mat);
    const holder = new THREE.Group();
    holder.position.set(sx * (W / 2 - inset), h, sz * (D / 2 - inset));
    leg.position.y = -len;
    holder.add(leg);
    holder.rotation.z = sx * 0.06; holder.rotation.x = -sz * 0.06;
    g.add(holder);
  }
}

/** Fotel: rama z zaokrąglonych brył, poduszka siedziska, oparcie; tkanina bouclé lub len. */
export function armchair({ color = '#e2dbcf', kind = 'boucle', w = 0.78, d = 0.8, legs = 'dab-naturalny', seed = 3 } = {}) {
  const g = new THREE.Group();
  const fab = fabricMaterial(color, kind, { repeat: 9 });
  const legH = 0.14, baseH = 0.2, armW = 0.14, armH = 0.6, backH = 0.78;
  woodLegs(g, w, d, legH, legs);
  const base = softBlock(w, baseH, d, fab, 0.05); base.position.set(0, legH + baseH / 2, 0); g.add(base);
  for (const sx of [-1, 1]) { const a = softBlock(armW, armH - legH, d, fab, 0.06); a.position.set(sx * (w / 2 - armW / 2), legH + (armH - legH) / 2, 0); g.add(a); }
  const back = softBlock(w, backH - legH, 0.17, fab, 0.07); back.position.set(0, legH + (backH - legH) / 2, -d / 2 + 0.085); back.rotation.x = -0.06; g.add(back);
  const seat = new THREE.Mesh(pillowGeometry(w - 2 * armW + 0.02, 0.14, d - 0.2, { seed, wrinkle: 0.003, boxy: 0.22, pinch: 0.4 }), fab);
  seat.position.set(0, legH + baseH + 0.055, 0.07); g.add(seat);
  const bc = new THREE.Mesh(pillowGeometry(w - 2 * armW, 0.13, 0.42, { seed: seed + 1, wrinkle: 0.004, boxy: 0.25, pinch: 0.5 }), fab);
  bc.rotation.x = Math.PI / 2 - 0.22; bc.position.set(0, legH + baseH + 0.27, -d / 2 + 0.22); g.add(bc);
  return shadowAll(g);
}

/** Sofa trzyosobowa. */
export function sofa({ color = '#d9d1c4', kind = 'linen', w = 2.2, d = 0.95, legs = 'dab-naturalny', seats = 3, pillows = [] } = {}) {
  const g = new THREE.Group();
  const fab = fabricMaterial(color, kind, { repeat: 9 });
  const legH = 0.12, baseH = 0.22, armW = 0.2, armH = 0.6, backH = 0.8;
  woodLegs(g, w, d, legH, legs, 0.08);
  const base = softBlock(w, baseH, d, fab, 0.05); base.position.set(0, legH + baseH / 2, 0); g.add(base);
  for (const sx of [-1, 1]) { const a = softBlock(armW, armH - legH, d, fab, 0.07); a.position.set(sx * (w / 2 - armW / 2), legH + (armH - legH) / 2, 0); g.add(a); }
  const back = softBlock(w, backH - legH, 0.2, fab, 0.08); back.position.set(0, legH + (backH - legH) / 2, -d / 2 + 0.1); g.add(back);
  const sw = (w - 2 * armW) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + armW + sw * (i + 0.5);
    const seat = new THREE.Mesh(pillowGeometry(sw - 0.01, 0.16, d - 0.26, { seed: 20 + i, wrinkle: 0.004, boxy: 0.2, pinch: 0.38 }), fab);
    seat.position.set(x, legH + baseH + 0.065, 0.08); g.add(seat);
    const bc = new THREE.Mesh(pillowGeometry(sw - 0.02, 0.17, 0.46, { seed: 30 + i, wrinkle: 0.006, boxy: 0.24, pinch: 0.5 }), fab);
    bc.rotation.x = Math.PI / 2 - 0.25; bc.position.set(x, legH + baseH + 0.3, -d / 2 + 0.27); g.add(bc);
  }
  pillows.forEach((hex, i) => {
    const p = new THREE.Mesh(pillowGeometry(0.45, 0.14, 0.45, { seed: 50 + i, wrinkle: 0.005, boxy: 0.3 }), fabricMaterial(hex, i % 2 ? 'linen' : 'boucle', { repeat: 10 }));
    const side = i % 2 ? 1 : -1;
    p.position.set(side * (w / 2 - armW - 0.26 - Math.floor(i / 2) * 0.2), legH + baseH + 0.33, -d / 2 + 0.38);
    p.rotation.set(Math.PI / 2 - 0.35, side * 0.2, side * -0.08);
    g.add(p);
  });
  return shadowAll(g);
}

/** Puf okrągły (dzianina / bouclé). */
export function pouf({ r = 0.26, h = 0.4, color = '#cdbfa9', kind = 'knit' } = {}) {
  const m = new THREE.Mesh(pillowGeometry(2 * r, h, 2 * r, { seed: 61, wrinkle: 0.004, boxy: 0.75, pinch: 0.25 }), fabricMaterial(color, kind, { repeat: 7 }));
  m.position.y = h / 2;
  return shadowAll(grp(m));
}

/** Okrągły stolik boczny (blat drewniany na metalowej nodze). */
export function sideTable({ r = 0.22, h = 0.52, finish = 'dab-naturalny', metal = 'czarny' } = {}) {
  const top = lathe([[0, 0], [r - 0.004, 0], [r, 0.004], [r, 0.018], [r - 0.004, 0.022], [0, 0.022]], finishMaterial(finish, 0), 64);
  top.position.y = h - 0.022;
  const m = metalMaterial(metal);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, h - 0.03, 24), m);
  stem.position.y = (h - 0.03) / 2 + 0.008;
  const base = lathe([[0, 0], [r * 0.7, 0], [r * 0.7, 0.008], [0.02, 0.014], [0, 0.014]], m, 48);
  return shadowAll(grp(top, stem, base));
}
