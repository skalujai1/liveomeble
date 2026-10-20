// Packshot: mebel na przezroczystym tle z miękkim cieniem kontaktowym (ShadowMaterial), widok 3/4.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './furniture.js';
import { AO, ShadowDirLight, halton, hemiDir, coneDir, dirFromAngles, resetAO } from './engine.js';

let studioEnv = null;
function getStudioEnv(renderer) {
  if (!studioEnv) {
    const pm = new THREE.PMREMGenerator(renderer);
    studioEnv = pm.fromScene(new RoomEnvironment(), 0.035).texture;
    pm.dispose();
  }
  return studioEnv;
}

/**
 * Ustawia kamerę tak, by pudełko `box` mieściło się w kadrze z marginesem.
 * Kamera poziomo (pion bez zbieżności — perspektywa dwupunktowa) + przesunięcie obiektywu (shift).
 */
export function fitCamera(camera, box, { azimuth = 32, elevation = 16, fov = 24, aspect = 4 / 3, margin = 0.08, vertical = true, biasY = 0 } = {}) {
  camera.fov = fov; camera.aspect = aspect; camera.near = 0.05; camera.far = 100;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  const dir = dirFromAngles(azimuth, elevation);
  const target = box.getCenter(new THREE.Vector3());
  let dist = box.getBoundingSphere(new THREE.Sphere()).radius / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  let shift = { x: 0, y: 0 };
  for (let it = 0; it < 12; it++) {
    camera.position.copy(target).addScaledVector(dir, dist);
    if (vertical) camera.lookAt(target.x, camera.position.y, target.z);
    else camera.lookAt(target);
    camera.updateMatrixWorld();
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (const c of corners) {
      const p = c.clone().project(camera);
      mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y);
    }
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const ex = (mxx - mnx) / 2, ey = (mxy - mny) / 2;
    const k = Math.max(ex / (1 - margin), ey / (1 - margin));
    dist *= 0.5 + 0.5 * k;
    // przesunięcie celu w poziomie (prawo kamery), w pionie przez shift obiektywu
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const halfW = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect * dist;
    target.addScaledVector(right, cx * halfW * 0.9);
    shift = { x: 0, y: -(cy + biasY) / 2 };
    if (!vertical) { const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); target.addScaledVector(up, cy * halfW / aspect * 0.9); shift.y = 0; }
  }
  return { shift, target, dist };
}

export async function renderPackshot(engine, job) {
  const W = job.width || 1600, H = job.height || 1200;
  engine.setSize(W, H);
  const r = engine.renderer;
  const scene = new THREE.Scene();
  const model = buildModel(job.spec);
  model.rotation.y = THREE.MathUtils.degToRad(job.rotate || 0);
  scene.add(model);
  model.updateMatrixWorld(true);

  scene.environment = getStudioEnv(r);
  scene.environmentIntensity = job.envIntensity ?? 0.55;
  AO.indirectScale.value = 1;
  AO.aoDirect.value = 0.3;
  AO.aoIntensity.value = 1;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x14100c, opacity: job.shadowOpacity ?? 0.62 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.layers.set(0);
  scene.add(ground);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  // kadr: mebel + odrobina podłogi z cieniem
  const frameBox = box.clone();
  frameBox.min.y = 0;
  frameBox.expandByVector(new THREE.Vector3(0.02, 0, 0.02));
  const camera = new THREE.PerspectiveCamera();
  const view = job.view || {};
  const fit = fitCamera(camera, frameBox, { azimuth: view.azimuth ?? 32, elevation: view.elevation ?? (size.y > 1.3 ? 12 : 18), fov: view.fov ?? 24, aspect: W / H, margin: view.margin ?? (size.y > 1.3 ? 0.1 : 0.13), vertical: view.vertical !== false });

  // pudełko dla cieni: mebel + podłoga wokół
  const shBox = box.clone();
  shBox.min.y = -0.01;
  const pad = Math.max(size.x, size.z) * 0.35 + 0.3;
  shBox.expandByVector(new THREE.Vector3(pad, 0, pad));
  const key = new ShadowDirLight(scene, { mapSize: job.shadowMap || 2048, box: shBox, casterLayer: 1, normalBias: 0.004, radius: 2.5 });
  const dome = new ShadowDirLight(scene, { mapSize: job.shadowMap || 2048, box: shBox, casterLayer: 1, normalBias: 0.004, radius: 4 });
  const keyAxis = dirFromAngles(view.keyAzimuth ?? -35, view.keyElevation ?? 40);
  const keyCol = new THREE.Color(1.0, 0.975, 0.95);
  const domeCol = new THREE.Color(0.97, 0.98, 1.0);
  const Ik = job.keyIntensity ?? 2.0, Id = job.domeIntensity ?? 2.3, minEl = job.domeMinElevation ?? 28;
  const rot = [0.137, 0.731];

  // AO (raz, bez jittera)
  camera.setViewOffset(W, H, fit.shift.x * W, fit.shift.y * H, W, H);
  camera.updateMatrixWorld();
  resetAO();
  engine.computeAO(scene, camera, { ao: { radius: job.aoRadius ?? Math.max(0.12, size.y * 0.25), thickness: 1.2, distanceExponent: 1.5, scale: 1.0, samples: 24 } });

  const ms = await engine.accumulate(scene, camera, {
    samples: job.samples || 128,
    jitter: 0.65,
    shift: fit.shift,
    clearAlpha: 0,
    onSample: (i) => {
      const u1 = (halton(i + 1, 5) + rot[0]) % 1, v1 = (halton(i + 1, 7) + rot[1]) % 1;
      key.aim(coneDir(keyAxis, THREE.MathUtils.degToRad(30), u1, v1), Ik, keyCol);
      // „niebo” studyjne: rozkład cosinusowy (jaśniej w zenicie), elewacja > minEl
      const u2 = (halton(i + 1, 11) + 0.31) % 1, v2 = (halton(i + 1, 13) + 0.57) % 1;
      const sMax = Math.cos(THREE.MathUtils.degToRad(minEl));
      const st = Math.sqrt(u2) * sMax; // sin(theta) — próbkowanie cosinusowe w ograniczonym stożku
      const ct = Math.sqrt(1 - st * st), ph = 2 * Math.PI * v2;
      dome.aim(new THREE.Vector3(st * Math.cos(ph), ct, st * Math.sin(ph)), Id, domeCol);
    },
  });
  const dataURL = engine.output({ exposure: job.exposure ?? 0.9, transparent: true, saturation: 1.0, contrast: 1.02 });
  // sprzątanie
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  key.light.shadow.map?.dispose(); dome.light.shadow.map?.dispose();
  return { dataURL, info: { ms, size: size.toArray() } };
}
