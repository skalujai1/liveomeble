// Pomocnicze bryły: zaokrąglone płyty z mapowaniem UV w metrach (kierunek słojów), toczone profile, tkaniny.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, makeNoise } from './noise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const AX = { x: 0, y: 1, z: 2 };

/**
 * Mapowanie UV „pudełkowe” w metrach: na każdej ścianie oś U = oś słojów (jeśli leży w płaszczyźnie ściany).
 * texInfo: { lenM, widM } — fizyczny rozmiar tekstury. Losowe przesunięcie z `seed` (różny rysunek na każdej płycie).
 */
export function boxUV(geo, grain = 'x', texInfo = { lenM: 1, widM: 1 }, seed = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = geo.attributes.uv || new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  const mn = [bb.min.x, bb.min.y, bb.min.z];
  const r = mulberry32(seed);
  const L = texInfo.lenM || 1, Wd = texInfo.widM || 1;
  const g = AX[grain];
  const others = [0, 1, 2].filter((a) => a !== g);
  const offU = r() * Math.max(0, 1 - size[g] / L);
  const offV = r() * 0.9;
  const flip = r() < 0.5;
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i) - mn[0]; p[1] = pos.getY(i) - mn[1]; p[2] = pos.getZ(i) - mn[2];
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const dom = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    let u, v;
    if (dom !== g) {
      const vAxis = [0, 1, 2].find((a) => a !== dom && a !== g);
      u = p[g] / L + offU;
      v = p[vAxis] / Wd + offV + (dom === others[0] ? 0.0 : 0.37);
    } else {
      u = p[others[0]] / L + offU;
      v = p[others[1]] / Wd + offV;
    }
    if (flip) u = 1 - u;
    uv.setXY(i, u, v);
  }
  geo.setAttribute('uv', uv);
  uv.needsUpdate = true;
  return geo;
}

export function longestAxis(w, h, d) {
  return w >= h && w >= d ? 'x' : h >= d ? 'y' : 'z';
}

/** Płyta: zaokrąglony prostopadłościan z materiałem i mapowaniem słojów. */
export function slab(w, h, d, mat, { radius = 0.0018, grain, seed = 1, segments = 2, shadow = true } = {}) {
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const geo = r > 0.0003 ? new RoundedBoxGeometry(w, h, d, segments, r) : new THREE.BoxGeometry(w, h, d);
  boxUV(geo, grain || longestAxis(w, h, d), mat.userData.texInfo || { lenM: 1, widM: 1 }, seed);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

/** Bryła obrotowa z profilu [[r, y], ...]. */
export function lathe(profile, mat, segments = 64) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Zwężająca się noga (stożek ścięty) z delikatnym zaokrągleniem stopki. */
export function taperedLeg(h, rTop, rBot, mat, segments = 32) {
  const prof = [[0, 0], [rBot - 0.002, 0], [rBot, 0.002], [rTop, h - 0.001], [rTop - 0.001, h], [0, h]];
  const m = lathe(prof, mat, segments);
  // UV wzdłuż długości (słoje pionowo)
  const uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * h / 2.2 + 0.3, uv.getX(i) * 0.14);
  return m;
}

export function cylinderBetween(a, b, r, mat, seg = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), seg);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Poduszka: superkwadryka ze ściśniętymi brzegami i drobnymi zmarszczkami. */
export function pillowGeometry(w, t, d, { seed = 1, wrinkle = 0.004, boxy = 0.28, pinch = 0.75 } = {}) {
  // sfera z sześcianu (bez biegunów → bez artefaktów „koperty”)
  let geo = new THREE.BoxGeometry(2, 2, 2, 40, 12, 40);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position;
  const n = makeNoise(seed);
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i).normalize();
    let X = sp(v3.x, boxy), Z = sp(v3.z, boxy), Y = sp(v3.y, 0.9);
    const e = Math.max(Math.abs(X), Math.abs(Z));
    Y *= 1 - pinch * Math.pow(e, 3.0);
    X *= w / 2; Z *= d / 2; Y *= t / 2;
    const k = n.noise(X * 14, Z * 14) * 0.55 + n.noise(X * 34 + 3, Z * 34) * 0.3 + n.noise(X * 70, Z * 70 + 5) * 0.15;
    const amp = wrinkle * (0.35 + Math.pow(e, 2));
    pos.setXYZ(i, X + k * amp * Math.sign(X) * 0.5, Y + k * amp * Math.sign(v3.y), Z + k * amp * Math.sign(Z) * 0.5);
  }
  geo.computeVertexNormals();
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) + 0.5; uv[i * 2 + 1] = pos.getZ(i) + pos.getY(i) * 0.5 + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * Narzuta/kołdra „opadająca” na prostopadłościan (materac). Środek górnej płaszczyzny: (0, topY, z0..z0+lTop).
 * Zwraca BufferGeometry z UV w metrach.
 */
export function drapeGeometry({ w, lTop, topY, z0 = 0, side = 0.25, foot = 0.25, r = 0.06, puff = 0.03, seed = 3, nu = 140, nv = 160, wrinkle = 1, headRoll = 0 }) {
  const n = makeNoise(seed);
  const arc = Math.PI / 2 * r;
  const sMax = w / 2 + arc + Math.max(0, side - r);
  const tMax = lTop + arc + Math.max(0, foot - r);
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const a = uv.getX(i), b = 1 - uv.getY(i);
    const s = (a * 2 - 1) * sMax;
    const t = b * tMax;
    const ex = Math.max(0, Math.abs(s) - w / 2), ez = Math.max(0, t - lTop);
    // metryka „superelipsy” (p=4) — narożnik bardziej prostokątny, bez szpica
    const e = Math.pow(Math.pow(ex, 4) + Math.pow(ez, 4), 0.25);
    let dx = 0, dz = 0;
    const eh = Math.hypot(ex, ez);
    if (eh > 1e-6) { dx = Math.sign(s) * ex / eh; dz = ez / eh; }
    let out, down;
    const hangMax = r + Math.max(0, Math.min(side > 0 ? side : foot, foot > 0 ? foot : side) - r);
    if (e < arc) { const th = e / r; out = r * Math.sin(th); down = r * (1 - Math.cos(th)); }
    else { out = r; down = Math.min(r + (e - arc), hangMax); }
    let x = Math.sign(s) * Math.min(Math.abs(s), w / 2) + dx * out;
    let z = z0 + Math.min(t, lTop) + dz * out;
    let y = topY - down;
    // puszystość (kopuła) na górze
    const inX = 1 - Math.pow(Math.min(1, Math.abs(s) / (w / 2)), 4);
    const inZ = 1 - Math.pow(Math.min(1, Math.abs(t - lTop / 2) / (lTop / 2)), 6);
    y += puff * Math.max(0, inX) * Math.max(0, inZ) * (0.85 + 0.15 * n.noise(s * 3, t * 3));
    // zmarszczki: na górze drobne, na zwisie pionowe fałdy
    const hang = Math.min(1, down / 0.12);
    const along = Math.abs(dx) > Math.abs(dz) ? t : s;
    const fold = Math.sin(along * 17 + n.noise(along * 1.5, 0.5) * 5) * 0.45 + n.noise(along * 7, down * 2.5) * 0.55;
    const offOut = fold * 0.012 * hang * wrinkle;
    x += dx * offOut; z += dz * offOut;
    const top = (n.noise(s * 3.2, t * 1.4) * 0.55 + n.noise(s * 7 + 7, t * 4) * 0.3 + n.noise(s * 16, t * 12) * 0.15) * 0.014 * wrinkle * (1 - hang);
    y += top;
    // rolka przy wezgłowiu (kołdra odwinięta)
    if (headRoll > 0 && t < headRoll) { const q = 1 - t / headRoll; y += Math.sin(q * Math.PI / 2) * 0.012 * (1 - hang); }
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, s + 2, t);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Zasłona: pionowa tkanina z fałdami (sinus + szum). */
export function curtainGeometry(width, height, { folds = 9, depth = 0.05, seed = 2 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height, 160, 40);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const n = makeNoise(seed);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const u = x / width + 0.5, v = y / height + 0.5;
    const ph = u * folds * Math.PI * 2 + n.noise(u * 3, v * 0.6) * 1.2;
    const z = Math.sin(ph) * depth * (0.8 + 0.2 * v) + n.noise(u * 12, v * 2) * 0.004;
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, x + 1, y);
  }
  geo.computeVertexNormals();
  return geo;
}
