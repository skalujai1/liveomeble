// Packshot: mebel na przezroczystym tle z miękkim cieniem kontaktowym (ShadowMaterial), widok 3/4.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './furniture.js';
import { AO, ShadowDirLight, halton, hemiDir, coneDir, dirFromAngles, resetAO } from './engine.js';

let studioEnv = null;
let mirrorCube = null;
/** Otoczenie odbijane w lustrach na packshotach: jasne studio (gradient + miękkie panele), bez „hot spotów”. */
function getMirrorCube(renderer) {
  if (mirrorCube) return mirrorCube;
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD;
      void main(){
        float y = vD.y;
        vec3 top = vec3(0.93, 0.93, 0.94), hor = vec3(0.80, 0.79, 0.77), floorC = vec3(0.56, 0.54, 0.51);
        vec3 c = y > 0.0 ? mix(hor, top, smoothstep(0.0, 0.7, y)) : mix(hor, floorC, smoothstep(0.0, 0.25, -y));
        // miękki „softbox” z lewej i ciemniejsza ściana w głębi — żeby lustro czytało się jako lustro
        float sb = smoothstep(0.55, 0.9, dot(vD, normalize(vec3(-0.8, 0.35, 0.5))));
        c += vec3(0.35) * sb;
        float wall = smoothstep(0.3, 0.9, dot(vD, normalize(vec3(0.6, 0.05, 1.0)))) * (1.0 - smoothstep(0.15, 0.45, abs(y)));
        c *= 1.0 - 0.18 * wall;
        gl_FragColor = vec4(c * 1.15, 1.0);
      }`,
  });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.1, 50, rt);
  cam.update(renderer, sc);
  mirrorCube = rt.texture;
  return mirrorCube;
}

/** Podmienia szkło luster na idealne lustro (MeshBasic + mapa sześcienna) — bez punktowych odblasków świateł. */
export function applyMirrors(root, cubeTex, tint = 0xdfe2e2) {
  root.traverse((o) => {
    if (o.isMesh && o.userData.mirror) {
      o.material = new THREE.MeshBasicMaterial({ color: tint, envMap: cubeTex, reflectivity: 1 });
      o.castShadow = false;
    }
  });
}
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

/**
 * Łapacz cieni (przezroczysty) z miękkim wygaszaniem poza obrysem mebla — bez twardych krawędzi frustum cieni.
 * rect: prostokąt obrysu w płaszczyźnie (oś a/b), fade: szerokość wygaszania (m).
 */
function shadowCatcher(opacity, axes, rect, fade) {
  const m = new THREE.ShadowMaterial({ color: 0x15110d, opacity });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRect = { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) };
    sh.uniforms.uFade = { value: fade };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec4 uRect; uniform float uFade;')
      .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );', `
        vec2 p = vec2(vWP.${axes[0]}, vWP.${axes[1]});
        vec2 q = max(vec2(0.0), max(uRect.xy - p, p - uRect.zw));
        float dd = length(q);
        float fadeK = 1.0 - smoothstep(0.0, uFade, dd);
        fadeK *= fadeK;
        gl_FragColor = vec4( color, opacity * fadeK * ( 1.0 - getShadowMask() ) );`);
  };
  m.customProgramCacheKey = () => 'catcher-' + axes;
  return m;
}

export function isHanging(spec) {
  return spec.base === 'hanging' || ['wallShelf', 'mirror', 'coatRack'].includes(spec.kind);
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
  const hanging = isHanging(job.spec);
  applyMirrors(model, getMirrorCube(r));

  scene.environment = getStudioEnv(r);
  scene.environmentIntensity = job.envIntensity ?? 0.55;
  AO.indirectScale.value = 1;
  AO.aoDirect.value = 0.3;
  AO.aoIntensity.value = 1;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxS = Math.max(size.x, size.z);

  // podłoże: podłoga (meble stojące) albo ściana za meblem (wiszące — bez podłogi, cień na ścianie)
  let catcher;
  if (!hanging) {
    catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), shadowCatcher(job.shadowOpacity ?? 0.6, 'xz', [box.min.x, box.min.z, box.max.x, box.max.z], Math.max(0.35, maxS * 0.32)));
    catcher.rotation.x = -Math.PI / 2;
  } else {
    catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), shadowCatcher(job.shadowOpacity ?? 0.42, 'xy', [box.min.x, box.min.y, box.max.x, box.max.y], Math.max(0.25, Math.max(size.x, size.y) * 0.22)));
    catcher.position.z = box.min.z - 0.0005;
  }
  catcher.receiveShadow = true;
  catcher.layers.set(0);
  scene.add(catcher);

  // kadr: mebel + odrobina podłogi z cieniem
  const frameBox = box.clone();
  if (!hanging) frameBox.min.y = 0;
  frameBox.expandByVector(new THREE.Vector3(0.02, 0, 0.02));
  const camera = new THREE.PerspectiveCamera();
  const view = job.view || {};
  const tall = size.y > 1.3;
  const defAz = job.spec.kind === 'mirror' ? 22 : 32;
  const defEl = hanging ? 8 : tall ? 12 : 18;
  const fit = fitCamera(camera, frameBox, { azimuth: view.azimuth ?? defAz, elevation: view.elevation ?? defEl, fov: view.fov ?? 24, aspect: W / H, margin: view.margin ?? (tall ? 0.1 : 0.13), vertical: view.vertical !== false });

  // pudełko dla cieni: mebel + podłoże wokół
  const shBox = box.clone();
  if (!hanging) {
    shBox.min.y = -0.01;
    const pad = maxS * 0.4 + 0.35;
    shBox.expandByVector(new THREE.Vector3(pad, 0, pad));
  } else {
    shBox.min.z = box.min.z - 0.01;
    const pad = Math.max(size.x, size.y) * 0.3 + 0.25;
    shBox.expandByVector(new THREE.Vector3(pad, pad, 0));
  }
  const key = new ShadowDirLight(scene, { mapSize: job.shadowMap || 2048, box: shBox, casterLayer: 1, normalBias: 0.004, radius: 2.5 });
  const dome = new ShadowDirLight(scene, { mapSize: job.shadowMap || 2048, box: shBox, casterLayer: 1, normalBias: 0.004, radius: 4 });
  const keyAxis = dirFromAngles(view.keyAzimuth ?? -35, view.keyElevation ?? (hanging ? 35 : 42));
  const keyCol = new THREE.Color(1.0, 0.975, 0.95);
  const domeCol = new THREE.Color(0.97, 0.98, 1.0);
  const Ik = job.keyIntensity ?? 2.1, Id = job.domeIntensity ?? 2.2, minEl = job.domeMinElevation ?? (hanging ? 45 : 38);
  const rot = [0.137, 0.731];
  // oś „nieba” dla miękkiego cienia: zenit (podłoga) albo kierunek od ściany, lekko z góry (ściana)
  const domeAxis = hanging ? new THREE.Vector3(0, 0.8, 1).normalize() : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3(1, 0, 0);
  const t2 = new THREE.Vector3().crossVectors(domeAxis, t1).normalize();

  // AO (raz, bez jittera)
  camera.setViewOffset(W, H, fit.shift.x * W, fit.shift.y * H, W, H);
  camera.updateMatrixWorld();
  resetAO();
  engine.computeAO(scene, camera, { ao: { radius: job.aoRadius ?? Math.max(0.12, Math.min(size.y, 1.2) * 0.25), thickness: 1.2, distanceExponent: 1.5, scale: 1.0, samples: 24 } });

  const ms = await engine.accumulate(scene, camera, {
    samples: job.samples || 128,
    jitter: 0.65,
    shift: fit.shift,
    clearAlpha: 0,
    onSample: (i) => {
      const u1 = (halton(i + 1, 5) + rot[0]) % 1, v1 = (halton(i + 1, 7) + rot[1]) % 1;
      key.aim(coneDir(keyAxis, THREE.MathUtils.degToRad(28), u1, v1), Ik, keyCol);
      // „niebo” studyjne: rozkład cosinusowy wokół osi, ograniczony stożkiem (90° - minEl)
      const u2 = (halton(i + 1, 11) + 0.31) % 1, v2 = (halton(i + 1, 13) + 0.57) % 1;
      const sMax = Math.cos(THREE.MathUtils.degToRad(minEl));
      const st = Math.sqrt(u2) * sMax;
      const ct = Math.sqrt(1 - st * st), ph = 2 * Math.PI * v2;
      const d = domeAxis.clone().multiplyScalar(ct).addScaledVector(t1, st * Math.cos(ph)).addScaledVector(t2, st * Math.sin(ph));
      dome.aim(d, Id, domeCol);
    },
  });
  const dataURL = engine.output({ exposure: job.exposure ?? 0.9, transparent: true, saturation: 1.0, contrast: 1.03 });
  // sprzątanie
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  key.light.shadow.map?.dispose(); dome.light.shadow.map?.dispose();
  return { dataURL, info: { ms, size: size.toArray(), hanging } };
}
