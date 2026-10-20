// Aranżacje wnętrz: bryła pokoju (ściany z tynku, podłoga z desek / beton, okno), światło dzienne
// (słońce + niebo przez okno z cieniami ścian), odbite światło z przechwyconej mapy otoczenia pokoju
// (2 odbicia, cube capture) próbkowane jako kierunkowe światła z cieniami mebli + GTAO, akumulacja.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { AO, ShadowDirLight, halton, coneDir, dirFromAngles, resetAO, patchMaterial } from './engine.js';
import { plasterTexture, floorTexture, concreteTexture } from './textures.js';
import { finishMaterial, plainMaterial } from './materials.js';
import { ROOMS } from './rooms.js';

export const L_ALL = 0, L_BOUNCE = 1, L_DAY = 2; // warstwy: widoczne, rzucają cień „odbity”, rzucają cień dzienny

// ---------------------------------------------------------------------------------------------
// Materiały ścian/podłogi
// ---------------------------------------------------------------------------------------------
function wallMaterial(hex, strength = 1) {
  const t = plasterTexture(hex, { strength });
  return patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, roughness: 1, roughnessMap: t.data, bumpMap: t.data, bumpScale: 0.35, specularIntensity: 0.25 }));
}

/** UV w metrach z pozycji świata (rzut pudełkowy) — ciągłość tekstury między kawałkami ścian. */
function worldUV(mesh, scale = 1, offset = [0, 0]) {
  const g = mesh.geometry;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  mesh.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, w;
    if (nx >= ny && nx >= nz) { u = v.z; w = v.y; } else if (ny >= nz) { u = v.x; w = v.z; } else { u = v.x; w = v.y; }
    uv.setXY(i, u * scale + offset[0], w * scale + offset[1]);
  }
  uv.needsUpdate = true;
}

function box(scene, x0, x1, y0, y1, z0, z1, mat, layers = [L_ALL, L_DAY]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.layers.disableAll(); layers.forEach((l) => m.layers.enable(l));
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Bryła pokoju
// ---------------------------------------------------------------------------------------------
export function buildShell(scene, R) {
  const { w, d, h } = R;
  const T = 0.22;
  const x0 = -w / 2, x1 = w / 2;
  const wallHex = R.wallColor || '#ece7df';
  const mats = { base: wallMaterial(wallHex, R.plaster ?? 1) };
  const wallMat = (side) => {
    const c = R.walls && R.walls[side];
    if (!c) return mats.base;
    if (!mats[c]) mats[c] = wallMaterial(c, R.plaster ?? 1);
    return mats[c];
  };
  const ceilMat = wallMaterial(R.ceilingColor || '#f3f1ed', 0.4);
  const parts = [];
  // podłoga
  let floorMat;
  if (R.floor?.type === 'concrete') {
    const t = concreteTexture(R.floor.color || '#cfcac2');
    floorMat = patchMaterial(new THREE.MeshPhysicalMaterial({ map: t.map, roughness: 1, roughnessMap: t.data, bumpMap: t.data, bumpScale: 0.5, specularIntensity: 0.5 }));
    floorMat.userData.uvScale = 1 / 2.0;
  } else {
    const t = floorTexture(R.floor?.color || '#c9ab86', { size: 4096, sizeM: 6.4 });
    floorMat = patchMaterial(new THREE.MeshPhysicalMaterial({ map: t.map, roughness: 1, roughnessMap: t.data, bumpMap: t.data, bumpScale: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.35, specularIntensity: 0.6 }));
    floorMat.userData.uvScale = 1 / 6.4;
  }
  const floor = box(scene, x0 - T, x1 + T, -0.1, 0, -T, d + T, floorMat);
  {
    // UV podłogi: deski wzdłuż osi z (w głąb pokoju) — u = z, v = x
    const g = floor.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    const s = floorMat.userData.uvScale;
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i) + floor.position.x, Z = pos.getZ(i) + floor.position.z;
      if (R.floor?.type === 'concrete') uv.setXY(i, X * s, Z * s);
      else uv.setXY(i, (Z + 0.37) * s + 0.02, (X + 3.13) * s + 0.01);
    }
  }
  parts.push(floor);
  parts.push(box(scene, x0 - T, x1 + T, h, h + 0.2, -T, d + T, ceilMat));
  // ściany: back (z=0), left (x=x0), right (x=x1), front (z=d)
  const win = R.window;
  const wallSpec = [
    ['back', x0 - T, x1 + T, -T, 0],
    ['front', x0 - T, x1 + T, d, d + T],
    ['left', x0 - T, x0, 0, d],
    ['right', x1, x1 + T, 0, d],
  ];
  for (const [side, ax0, ax1, az0, az1] of wallSpec) {
    const mat = wallMat(side);
    const wins = (R.windows || (win ? [win] : [])).filter((ww) => ww.wall === side);
    if (!wins.length) { parts.push(box(scene, ax0, ax1, 0, h, az0, az1, mat)); continue; }
    // ściana z otworem (jedno okno na ścianę): dół, góra, boki
    const ww = wins[0];
    const along = side === 'left' || side === 'right' ? 'z' : 'x';
    const c = ww.center, hw = ww.width / 2, y0 = ww.sill, y1 = ww.sill + ww.height;
    if (along === 'z') {
      parts.push(box(scene, ax0, ax1, 0, y0, az0, az1, mat));
      parts.push(box(scene, ax0, ax1, y1, h, az0, az1, mat));
      parts.push(box(scene, ax0, ax1, y0, y1, az0, c - hw, mat));
      parts.push(box(scene, ax0, ax1, y0, y1, c + hw, az1, mat));
    } else {
      parts.push(box(scene, ax0, ax1, 0, y0, az0, az1, mat));
      parts.push(box(scene, ax0, ax1, y1, h, az0, az1, mat));
      parts.push(box(scene, ax0, c - hw, y0, y1, az0, az1, mat));
      parts.push(box(scene, c + hw, ax1, y0, y1, az0, az1, mat));
    }
    buildWindow(scene, R, ww, side, { ax0, ax1, az0, az1 });
  }
  for (const p of parts) if (p !== floor) worldUV(p, 1 / 1.1, [0.13, 0.41]);
  // listwy przypodłogowe
  const bb = R.baseboard ?? { h: 0.08, t: 0.014 };
  if (bb) {
    const bm = R.baseboardColor ? patchMaterial(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(R.baseboardColor), roughness: 0.6, specularIntensity: 0.4 })) : wallMat('back');
    const add = (a, b, c, e, f, g, side) => {
      const m = box(scene, a, b, c, e, f, g, R.baseboardColor ? bm : wallMat(side), [L_ALL, L_DAY]);
      worldUV(m, 1 / 1.1);
    };
    add(x0, x1, 0, bb.h, 0, bb.t, 'back');
    const leftWins = (R.windows || (win ? [win] : [])).filter((ww) => ww.wall === 'left' && ww.sill < 0.1);
    add(x0, x0 + bb.t, 0, bb.h, bb.t, d, 'left');
    add(x1 - bb.t, x1, 0, bb.h, bb.t, d, 'right');
  }
  return { box: new THREE.Box3(new THREE.Vector3(x0 - T, -0.1, -T), new THREE.Vector3(x1 + T, h + 0.2, d + T)) };
}

function buildWindow(scene, R, ww, side, wallBox) {
  const frameMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ww.frameColor || '#2a2a2a'), roughness: 0.45, metalness: 0.2, specularIntensity: 0.6 }));
  const sillMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ww.sillColor || '#efede8'), roughness: 0.35, specularIntensity: 0.6 }));
  const fw = 0.055, fd = 0.07;
  const c = ww.center, hw = ww.width / 2, y0 = ww.sill, y1 = ww.sill + ww.height;
  const isX = side === 'left' || side === 'right'; // okno w ścianie bocznej (oś z)
  const inner = side === 'left' ? wallBox.ax1 : side === 'right' ? wallBox.ax0 : side === 'back' ? wallBox.az1 : wallBox.az0;
  const sign = side === 'left' || side === 'back' ? -1 : 1; // kierunek „na zewnątrz”
  const mid = inner + sign * (ww.depth ?? 0.12); // płaszczyzna ramy (od lica ściany)
  const rect = (a0, a1, b0, b1, mat, depth = fd, layers = [L_ALL, L_DAY]) => {
    if (isX) return box(scene, mid - depth / 2, mid + depth / 2, b0, b1, a0, a1, mat, layers);
    return box(scene, a0, a1, b0, b1, mid - depth / 2, mid + depth / 2, mat, layers);
  };
  // rama obwodowa
  rect(c - hw, c + hw, y0, y0 + fw, frameMat);
  rect(c - hw, c + hw, y1 - fw, y1, frameMat);
  rect(c - hw, c - hw + fw, y0, y1, frameMat);
  rect(c + hw - fw, c + hw, y0, y1, frameMat);
  // słupki i ślemię
  const cols = ww.cols || 2, rows = ww.rows || 1;
  for (let i = 1; i < cols; i++) { const a = c - hw + (ww.width * i) / cols; rect(a - fw * 0.45, a + fw * 0.45, y0, y1, frameMat); }
  if (ww.transom) { const b = y1 - ww.transom; rect(c - hw, c + hw, b - fw * 0.45, b + fw * 0.45, frameMat); }
  for (let j = 1; j < rows; j++) { const b = y0 + (ww.height * j) / rows; rect(c - hw, c + hw, b - fw * 0.4, b + fw * 0.4, frameMat); }
  // szyba (nie rzuca cienia)
  const glass = rect(c - hw, c + hw, y0, y1, patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.08, depthWrite: false, specularIntensity: 1 })), 0.006, [L_ALL]);
  glass.castShadow = false; glass.userData.noAO = true; glass.userData.captureHide = true;
  // parapet wewnętrzny
  if (y0 > 0.05) {
    const depthIn = Math.abs(mid - inner) + 0.04;
    if (isX) box(scene, Math.min(inner + sign * 0.0, mid) - (sign > 0 ? 0 : 0.04), Math.max(inner, mid) + (sign > 0 ? 0.04 : 0), y0 - 0.025, y0, c - hw - 0.05, c + hw + 0.05, sillMat);
    else box(scene, c - hw - 0.05, c + hw + 0.05, y0 - 0.025, y0, Math.min(inner, mid) - (sign > 0 ? 0 : 0.04), Math.max(inner, mid) + (sign > 0 ? 0.04 : 0), sillMat);
  }
  // tło za oknem — prześwietlone niebo/zieleń (widoczne tylko w kadrze, bez cieni)
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(ww.skyTop || '#dfe7ef').multiplyScalar(ww.skyGain ?? 9) }, bottom: { value: new THREE.Color(ww.skyBottom || '#c9d3c2').multiplyScalar(ww.skyGain ?? 9) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.0); }',
    fragmentShader: 'uniform vec3 top, bottom; varying vec3 vP; void main(){ float t = smoothstep(0.0, 3.0, vP.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    side: THREE.DoubleSide,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), bgMat);
  const dist = 4;
  if (isX) { bg.position.set(inner + sign * dist, 4, c); bg.rotation.y = Math.PI / 2; }
  else { bg.position.set(c, 4, inner + sign * dist); }
  bg.layers.set(L_ALL);
  bg.userData.captureHide = true; bg.userData.noAO = true;
  scene.add(bg);
  return { glass, bg };
}

// ---------------------------------------------------------------------------------------------
// Przechwycenie oświetlenia pokoju do mapy sześciennej (uśrednione po próbkach nieba)
// ---------------------------------------------------------------------------------------------
const cubeAccShader = {
  uniforms: { tNew: { value: null }, tPrev: { value: null }, w: { value: 1 }, face: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform samplerCube tNew, tPrev; uniform float w; uniform int face;
    vec3 dirFor(int f, vec2 st) { vec2 c = st * 2.0 - 1.0;
      if (f == 0) return vec3(1.0, -c.y, -c.x);
      if (f == 1) return vec3(-1.0, -c.y, c.x);
      if (f == 2) return vec3(c.x, 1.0, c.y);
      if (f == 3) return vec3(c.x, -1.0, -c.y);
      if (f == 4) return vec3(c.x, -c.y, 1.0);
      return vec3(-c.x, -c.y, -1.0); }
    void main(){ vec3 d = normalize(dirFor(face, vUv)); vec4 a = textureCube(tPrev, d); vec4 b = textureCube(tNew, d); gl_FragColor = mix(a, b, w); }`,
};

const probeShader = {
  uniforms: { tEnv: { value: null }, tDirs: { value: null }, count: { value: 1 }, bias: { value: 3 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform samplerCube tEnv; uniform sampler2D tDirs; uniform float bias;
    void main(){ vec3 d = texture2D(tDirs, vec2(vUv.x, 0.5)).xyz; gl_FragColor = vec4(textureCube(tEnv, normalize(d), bias).rgb, 1.0); }`,
};

function makeCubeRT(size) {
  return new THREE.WebGLCubeRenderTarget(size, { type: THREE.FloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
}

async function captureEnv(engine, scene, rig, pos, { samples = 24, size = 128 } = {}) {
  const r = engine.renderer;
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, depthBuffer: true });
  const cam = new THREE.CubeCamera(0.05, 60, cubeRT);
  cam.position.copy(pos);
  scene.add(cam);
  let A = makeCubeRT(size), B = makeCubeRT(size);
  const mat = new THREE.ShaderMaterial(Object.assign({}, cubeAccShader, { uniforms: THREE.UniformsUtils.clone(cubeAccShader.uniforms), depthTest: false, depthWrite: false }));
  const quad = new FullScreenQuad(mat);
  const hidden = [];
  scene.traverse((o) => { if (o.userData.captureHide && o.visible) { o.visible = false; hidden.push(o); } });
  r.shadowMap.autoUpdate = false;
  for (let k = 0; k < samples; k++) {
    rig.sample(k, samples);
    r.shadowMap.needsUpdate = true;
    cam.update(r, scene);
    mat.uniforms.tNew.value = cubeRT.texture;
    mat.uniforms.tPrev.value = A.texture;
    mat.uniforms.w.value = 1 / (k + 1);
    for (let f = 0; f < 6; f++) {
      mat.uniforms.face.value = f;
      r.setRenderTarget(B, f);
      quad.render(r);
    }
    [A, B] = [B, A];
    if (k % 4 === 3) await new Promise((res) => setTimeout(res, 0));
  }
  r.shadowMap.autoUpdate = true;
  hidden.forEach((o) => (o.visible = true));
  scene.remove(cam);
  cubeRT.dispose(); B.dispose(); mat.dispose();
  r.setRenderTarget(null);
  return A;
}

function probeDirs(engine, envRT, dirs, bias = 3) {
  const r = engine.renderer;
  const N = dirs.length;
  const data = new Float32Array(N * 4);
  dirs.forEach((d, i) => { data[i * 4] = d.x; data[i * 4 + 1] = d.y; data[i * 4 + 2] = d.z; data[i * 4 + 3] = 1; });
  const tDirs = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
  tDirs.needsUpdate = true;
  const rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, depthBuffer: false });
  const mat = new THREE.ShaderMaterial(Object.assign({}, probeShader, { uniforms: THREE.UniformsUtils.clone(probeShader.uniforms), depthTest: false, depthWrite: false }));
  mat.uniforms.tEnv.value = envRT.texture; mat.uniforms.tDirs.value = tDirs; mat.uniforms.bias.value = bias;
  const quad = new FullScreenQuad(mat);
  r.setRenderTarget(rt); quad.render(r);
  const out = new Float32Array(N * 4);
  r.readRenderTargetPixels(rt, 0, 0, N, 1, out);
  r.setRenderTarget(null);
  rt.dispose(); tDirs.dispose(); mat.dispose();
  return dirs.map((d, i) => new THREE.Color(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]));
}

/** Równomierne kierunki na sferze (Fibonacci) z losowym obrotem. */
function sphereDirs(n, seed = 0.37) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const a = i * ga + seed * 6.283;
    out.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  // przemieszaj (kolejność próbek w akumulacji)
  const rnd = (i) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd(i) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Render aranżacji
// ---------------------------------------------------------------------------------------------
export async function renderRoom(engine, job) {
  const def = ROOMS[job.room];
  if (!def) throw new Error('Nieznana aranżacja: ' + job.room);
  const W = job.width, H = job.height;
  engine.setSize(W, H);
  const r = engine.renderer;
  const t0 = performance.now();
  const scene = new THREE.Scene();
  const R = def.room;
  const shell = buildShell(scene, R);
  const content = new THREE.Group();
  scene.add(content);
  def.populate(content, { frame: job.frame });
  // warstwy: zawartość rzuca cienie odbite i dzienne
  content.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { if (!o.userData.layersSet) { o.layers.disableAll(); o.layers.enable(L_ALL); o.layers.enable(L_BOUNCE); o.layers.enable(L_DAY); } } });
  scene.updateMatrixWorld(true);

  // kamera (poziomo, bez zbieżności pionów; kadr przez przesunięcie obiektywu)
  const cd = def.cameras[job.frame];
  const camera = new THREE.PerspectiveCamera(cd.fov, W / H, 0.05, 60);
  camera.position.fromArray(cd.pos);
  const yaw = THREE.MathUtils.degToRad(cd.yaw || 0);
  camera.lookAt(camera.position.x + Math.sin(yaw), camera.position.y + Math.tan(THREE.MathUtils.degToRad(cd.pitch || 0)), camera.position.z - Math.cos(yaw));
  camera.updateMatrixWorld();
  const shift = { x: cd.shiftX || 0, y: cd.shiftY || 0 };

  // ---- światła
  const L = Object.assign({ sunIntensity: 7, skyIntensity: 3.2, bounce: 1, envDiffuse: 0.35, exposure: 1 }, def.light || {});
  const roomBox = shell.box.clone();
  const sun = new ShadowDirLight(scene, { mapSize: 4096, box: roomBox, casterLayer: L_DAY, bias: -0.0002, normalBias: 0.012, radius: 1.5 });
  const sky = new ShadowDirLight(scene, { mapSize: 4096, box: roomBox, casterLayer: L_DAY, bias: -0.0002, normalBias: 0.012, radius: 2.5 });
  const contentBox = new THREE.Box3().setFromObject(content);
  contentBox.min.y = -0.02;
  contentBox.expandByVector(new THREE.Vector3(0.6, 0.05, 0.6));
  contentBox.intersect(new THREE.Box3(new THREE.Vector3(-R.w / 2, -0.05, 0), new THREE.Vector3(R.w / 2, R.h, R.d)));
  const bounce = new ShadowDirLight(scene, { mapSize: 2048, box: contentBox, casterLayer: L_BOUNCE, bias: -0.0004, normalBias: 0.01, radius: 3 });
  const win = R.windows ? R.windows[0] : R.window;
  const out = win.wall === 'left' ? new THREE.Vector3(-1, 0, 0) : win.wall === 'right' ? new THREE.Vector3(1, 0, 0) : win.wall === 'back' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
  const sunDir = def.sun ? dirFromAngles(def.sun.azimuth, def.sun.elevation) : null;
  const sunCol = new THREE.Color(def.sun?.color || '#fff0dc');
  const skyCol = new THREE.Color(def.skyColor || '#d9e4f4');
  const groundOut = new THREE.Color(def.groundColor || '#b9b4a6');
  const rot = [0.21, 0.63];
  const daySample = (k) => {
    // słońce: tarcza ~1.2° (miękka półcień)
    if (sunDir) sun.aim(coneDir(sunDir, THREE.MathUtils.degToRad(1.2), (halton(k + 1, 2) + 0.5) % 1, (halton(k + 1, 3) + 0.5) % 1), L.sunIntensity, sunCol);
    else sun.light.visible = false;
    // niebo za oknem: kierunki z półsfery na zewnątrz (cos-ważone wokół normalnej okna), poniżej horyzontu — odbicie od ziemi
    const u = (halton(k + 1, 5) + rot[0]) % 1, v = (halton(k + 1, 7) + rot[1]) % 1;
    const sMax = 0.995;
    const st = Math.sqrt(u) * sMax, ct = Math.sqrt(1 - st * st), ph = 2 * Math.PI * v;
    const t1 = new THREE.Vector3(0, 1, 0), t2 = new THREE.Vector3().crossVectors(out, t1);
    const d = out.clone().multiplyScalar(ct).addScaledVector(t1, st * Math.sin(ph)).addScaledVector(t2, st * Math.cos(ph)).normalize();
    if (d.y < 0.03) { d.y = Math.abs(d.y) * 0.6 + 0.03; d.normalize(); sky.aim(d, L.skyIntensity * 0.55, groundOut); }
    else sky.aim(d, L.skyIntensity * (0.75 + 0.5 * d.y), skyCol);
  };

  // ---- mapa otoczenia: 2 odbicia
  resetAO();
  AO.indirectScale.value = 1; AO.aoDirect.value = 0; AO.aoIntensity.value = 1;
  bounce.light.visible = false;
  const capPos = new THREE.Vector3().fromArray(def.capture || [0, 1.3, R.d * 0.45]);
  const rig = { sample: (k) => daySample(k) };
  scene.environment = null;
  const amb = new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 0.15);
  scene.add(amb);
  const env1 = await captureEnv(engine, scene, rig, capPos, { samples: job.preview ? 12 : 24 });
  scene.remove(amb);
  scene.environment = env1.texture;
  scene.environmentIntensity = 1;
  const env2 = await captureEnv(engine, scene, rig, capPos, { samples: job.preview ? 12 : 24 });
  scene.environment = env2.texture;
  scene.environmentIntensity = L.envIntensity ?? 1;
  console.log(`[render] mapa otoczenia gotowa (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

  // ---- światło odbite jako kierunkowe próbki (cienie mebli)
  const N = job.samples || 128;
  const dirs = sphereDirs(N);
  const cols = probeDirs(engine, env2, dirs, 3.5);
  { const lums = cols.map((c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722); console.log(`[render] otoczenie: lum śr. ${(lums.reduce((a, b) => a + b, 0) / lums.length).toFixed(3)}, max ${Math.max(...lums).toFixed(3)}, min ${Math.min(...lums).toFixed(3)}`); }
  bounce.light.visible = true;
  const kB = (1 - L.envDiffuse) * L.bounce * 4 * Math.PI;

  // ---- GTAO
  camera.setViewOffset(W, H, shift.x * W, shift.y * H, W, H);
  camera.updateMatrixWorld();
  engine.computeAO(scene, camera, { ao: { radius: L.aoRadius ?? 0.35, thickness: 1.0, distanceExponent: 1.6, scale: 1.0, samples: 24 } });
  AO.indirectScale.value = L.envDiffuse;
  AO.aoDirect.value = L.aoDirect ?? 0.12;
  AO.aoIntensity.value = 1;

  const ms = await engine.accumulate(scene, camera, {
    samples: N,
    jitter: 0.6,
    shift,
    clearAlpha: 1,
    onSample: (i) => {
      daySample(i + 3);
      const c = cols[i];
      const lum = Math.max(1e-4, c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);
      bounce.aim(dirs[i], kB * lum, c.clone().multiplyScalar(1 / lum));
    },
  });
  const post = Object.assign({ exposure: 1, saturation: 0.97, contrast: 1.04, lift: 0.012, vignette: 0.14, warmth: 0.015 }, def.post || {}, { exposure: L.exposure });
  const dataURL = engine.output(post);
  env1.dispose(); env2.dispose();
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  [sun, sky, bounce].forEach((l) => l.light.shadow.map?.dispose());
  return { dataURL, info: { ms, totalMs: performance.now() - t0 } };
}
