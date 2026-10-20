// Materiały: wykończenia z kontraktu (finishes), metale, szkło, tkaniny, materiały pomocnicze.
import * as THREE from 'three';
import { woodTexture, paintTexture, fabricTexture } from './textures.js';
import { patchMaterial } from './engine.js';

export const FINISHES = {
  'dab-naturalny': { name: 'Dąb naturalny', wood: 'oak', color: '#c49a6c', roughness: 0.6 },
  'dab-miodowy': { name: 'Dąb miodowy', wood: 'oak', color: '#b07b45', roughness: 0.55 },
  'orzech': { name: 'Orzech', wood: 'walnut', color: '#6b4a32', roughness: 0.55 },
  'bialy-mat': { name: 'Biały mat', color: '#eeece8', roughness: 0.75 },
  'bialy-polysk': { name: 'Biały połysk', color: '#f3f2ef', roughness: 0.12, clearcoat: 0.8 },
  'kaszmir': { name: 'Kaszmir', color: '#d6c8b8', roughness: 0.65 },
  'szalwia': { name: 'Szałwia', color: '#9aa58f', roughness: 0.7 },
  'grafit': { name: 'Grafit', color: '#4a4b4d', roughness: 0.55 },
  'czarny-mat': { name: 'Czarny mat', color: '#222223', roughness: 0.65 },
};

export const METALS = {
  czarny: { name: 'Czarny metal', color: '#1a1a1a', metalness: 0.6, roughness: 0.45 },
  zloty: { name: 'Szczotkowany mosiądz', color: '#b8935a', metalness: 1, roughness: 0.35 },
  stal: { name: 'Stal', color: '#9a9ca0', metalness: 1, roughness: 0.3 },
};

const matCache = new Map();
function cachedMat(key, fn) {
  if (!matCache.has(key)) matCache.set(key, patchMaterial(fn()));
  return matCache.get(key);
}

/** Materiał wykończenia. Dla drewna `variant` wybiera inny wzór słojów (0..2). */
export function finishMaterial(id, variant = 0) {
  const f = FINISHES[id];
  if (!f) throw new Error('Nieznane wykończenie: ' + id);
  if (f.wood) {
    const v = variant % 3;
    return cachedMat(`fin|${id}|${v}`, () => {
      const t = woodTexture(f.color, f.wood, v);
      const m = new THREE.MeshPhysicalMaterial({
        name: id, color: 0xffffff, map: t.map, roughness: 1.0, roughnessMap: t.data, bumpMap: t.data, bumpScale: 0.35,
        clearcoat: 0.12, clearcoatRoughness: 0.55, specularIntensity: 0.6,
      });
      m.userData.texInfo = { lenM: t.lenM, widM: t.widM, wood: true };
      return m;
    });
  }
  return cachedMat(`fin|${id}`, () => {
    const p = paintTexture(f.roughness, { grain: f.clearcoat ? 0.3 : 1 });
    const m = new THREE.MeshPhysicalMaterial({
      name: id, color: new THREE.Color(f.color), roughness: 1.0, roughnessMap: p.data, bumpMap: p.data,
      bumpScale: f.clearcoat ? 0.02 : 0.06, clearcoat: f.clearcoat || 0, clearcoatRoughness: 0.06,
      specularIntensity: f.clearcoat ? 1 : 0.5,
    });
    m.userData.texInfo = { lenM: 0.5, widM: 0.5 };
    return m;
  });
}

/** Ciemniejsza wersja korpusu do wnętrza szafek (wnętrze jest w cieniu, ale materiał ten sam). */
export function interiorMaterial(id) {
  return finishMaterial(id, 2);
}

export function metalMaterial(id = 'czarny') {
  const m = METALS[id] || METALS.czarny;
  return cachedMat(`metal|${id}`, () => new THREE.MeshPhysicalMaterial({
    name: 'metal-' + id, color: new THREE.Color(m.color), metalness: m.metalness, roughness: m.roughness,
    clearcoat: id === 'czarny' ? 0.2 : 0, clearcoatRoughness: 0.4,
  }));
}

export function glassMaterial(tint = '#8a8d8f') {
  return cachedMat(`glass|${tint}`, () => {
    const m = new THREE.MeshPhysicalMaterial({
      name: 'glass', color: new THREE.Color(tint), metalness: 0, roughness: 0.04, transmission: 0.0,
      transparent: true, opacity: 0.32, specularIntensity: 1, ior: 1.5, envMapIntensity: 1.4, depthWrite: false,
    });
    m.userData.glass = true;
    return m;
  });
}

export function mirrorMaterial() {
  return cachedMat('mirror', () => new THREE.MeshPhysicalMaterial({ name: 'mirror', color: 0xd8dadb, metalness: 1, roughness: 0.03 }));
}

/** Tkanina: kind = linen | boucle | knit. Kolor sRGB. */
export function fabricMaterial(hex, kind = 'linen', opts = {}) {
  return cachedMat(`fabric|${hex}|${kind}|${opts.repeat || 0}|${opts.sheen ?? ''}`, () => {
    const t = fabricTexture(kind);
    const map = t.map.clone(); map.needsUpdate = true;
    const data = t.data.clone(); data.needsUpdate = true;
    const rep = opts.repeat || (kind === 'linen' ? 10 : kind === 'knit' ? 6 : 8);
    map.repeat.set(rep, rep); data.repeat.set(rep, rep);
    const c = new THREE.Color(hex);
    const m = new THREE.MeshPhysicalMaterial({
      name: 'fabric-' + kind, color: c, map, roughness: 1.0, roughnessMap: data, bumpMap: data,
      bumpScale: kind === 'knit' ? 2.5 : kind === 'boucle' ? 2.0 : 0.8,
      sheen: opts.sheen ?? 0.6, sheenRoughness: 0.75, sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
      specularIntensity: 0.25,
    });
    m.userData.texInfo = { lenM: 1, widM: 1, uvMode: 'repeat' };
    return m;
  });
}

/** Prosty materiał matowy (ceramika, papier itp.). */
export function plainMaterial(hex, roughness = 0.8, extra = {}) {
  return cachedMat(`plain|${hex}|${roughness}|${JSON.stringify(extra)}`, () => new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(hex), roughness, specularIntensity: 0.5 }, extra)));
}

export function finishName(id) { return (FINISHES[id] || METALS[id] || { name: id }).name; }
