// Silnik: akumulacja progresywna (SSAA przez jitter subpikselowy + miękkie cienie przez losowane światła),
// GTAO tylko dla światła pośredniego (wstrzyknięte do shaderów materiałów), tone mapping ACES na końcu.
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;

/** Wspólne uniformy AO — jedna tekstura AO dla całej klatki. */
export const AO = {
  tAO: { value: white },
  aoRes: { value: new THREE.Vector2(1, 1) },
  aoIntensity: { value: 1 },
  indirectScale: { value: 1 },
  aoDirect: { value: 0 },
};

export function resetAO() {
  AO.tAO.value = white;
  AO.aoRes.value.set(1, 1);
}

/** Wstrzykuje AO z ekranu (GTAO) do światła pośredniego materiału Standard/Physical. */
export function patchMaterial(m) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, AO);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tAO; uniform vec2 aoRes; uniform float aoIntensity; uniform float indirectScale; uniform float aoDirect;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
  float ssao = texture2D( tAO, gl_FragCoord.xy / aoRes ).r;
  ssao = mix( 1.0, ssao, aoIntensity );
  reflectedLight.indirectDiffuse *= ssao * indirectScale;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ssao;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ssao;
  #endif
  float dNV_ = saturate( dot( geometryNormal, geometryViewDir ) );
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( dNV_, ssao, material.roughness );
  float dAO_ = mix( 1.0, ssao, aoDirect );
  reflectedLight.directDiffuse *= dAO_;
  reflectedLight.directSpecular *= dAO_;
}`);
  };
  m.customProgramCacheKey = () => 'liveo-ao-v1';
  return m;
}

// ---------------------------------------------------------------------------------------------
// Sekwencje niskiej rozbieżności
// ---------------------------------------------------------------------------------------------
export function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

/** Kierunek na półsferze (y w górę) z punktu 2D [0,1)² — równomiernie w kącie bryłowym. */
export function hemiDir(u, v, out = new THREE.Vector3()) {
  const y = u; // równomiernie w cos(theta)
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = 2 * Math.PI * v;
  return out.set(r * Math.cos(phi), y, r * Math.sin(phi));
}

/** Kierunek w stożku wokół osi `axis` o połowie kąta `angle` (rad), równomiernie w kącie bryłowym. */
export function coneDir(axis, angle, u, v, out = new THREE.Vector3()) {
  const cosMax = Math.cos(angle);
  const c = 1 - u * (1 - cosMax);
  const s = Math.sqrt(Math.max(0, 1 - c * c));
  const phi = 2 * Math.PI * v;
  const a = axis.clone().normalize();
  const t = Math.abs(a.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b1 = new THREE.Vector3().crossVectors(t, a).normalize();
  const b2 = new THREE.Vector3().crossVectors(a, b1);
  return out.copy(a).multiplyScalar(c).addScaledVector(b1, s * Math.cos(phi)).addScaledVector(b2, s * Math.sin(phi));
}

export function dirFromAngles(azimuthDeg, elevationDeg) {
  // azymut 0 = +z (przód), 90 = +x (prawo)
  const az = THREE.MathUtils.degToRad(azimuthDeg), el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

// ---------------------------------------------------------------------------------------------
// Światło kierunkowe z cieniem dopasowanym do pudełka sceny
// ---------------------------------------------------------------------------------------------
export class ShadowDirLight {
  constructor(scene, { mapSize = 2048, box, casterLayer = 1, bias = -0.0003, normalBias = 0.006, radius = 1.5, color = 0xffffff } = {}) {
    this.light = new THREE.DirectionalLight(color, 1);
    this.light.castShadow = true;
    const s = this.light.shadow;
    s.mapSize.set(mapSize, mapSize);
    s.bias = bias; s.normalBias = normalBias; s.radius = radius;
    s.camera.layers.set(casterLayer);
    this.box = box.clone();
    scene.add(this.light, this.light.target);
    this._o = new THREE.Object3D();
  }
  aim(dir, intensity, color) {
    const L = this.light;
    const c = this.box.getCenter(new THREE.Vector3());
    const r = this.box.getBoundingSphere(new THREE.Sphere()).radius;
    L.target.position.copy(c);
    L.position.copy(c).addScaledVector(dir.clone().normalize(), r * 2 + 1);
    L.intensity = intensity;
    if (color) L.color.copy(color);
    L.updateMatrixWorld(); L.target.updateMatrixWorld();
    // ciasne dopasowanie ortho do narożników pudełka w przestrzeni światła
    const o = this._o;
    o.position.copy(L.position); o.lookAt(c); o.updateMatrixWorld();
    const inv = o.matrixWorld.clone().invert();
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const b = this.box, p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
      min.min(p); max.max(p);
    }
    const cam = L.shadow.camera;
    // Object3D.lookAt kieruje +z na cel (kamera: -z) — granice bierzemy symetrycznie, głębokość z +z
    const hx = Math.max(-min.x, max.x), hy = Math.max(-min.y, max.y);
    cam.left = -hx; cam.right = hx; cam.bottom = -hy; cam.top = hy;
    cam.near = Math.max(0.01, min.z - 0.1);
    cam.far = max.z + 0.1;
    cam.updateProjectionMatrix();
  }
  set enabled(v) { this.light.visible = v; }
}

// ---------------------------------------------------------------------------------------------
// Akumulator
// ---------------------------------------------------------------------------------------------
const accShader = {
  uniforms: { tPrev: { value: null }, tNew: { value: null }, w: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tPrev, tNew; uniform float w;
    void main(){ vec4 a = texture2D(tPrev, vUv); vec4 b = texture2D(tNew, vUv); if (any(isnan(b)) || any(isinf(b))) b = a; b = max(b, vec4(0.0)); b.rgb = min(b.rgb, vec3(64.0)); gl_FragColor = mix(a, b, w); }`,
};

const postShader = {
  uniforms: {
    tAcc: { value: null }, exposure: { value: 1 }, transparent: { value: 0 }, saturation: { value: 1 },
    contrast: { value: 1 }, lift: { value: 0 }, vignette: { value: 0 }, warmth: { value: 0 }, resolution: { value: new THREE.Vector2() },
    highlightRoll: { value: 0 }, wb: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`precision highp float;
    varying vec2 vUv;
    uniform sampler2D tAcc; uniform float exposure, transparent, saturation, contrast, lift, vignette, warmth, highlightRoll; uniform vec2 resolution; uniform vec3 wb;
    vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
    vec3 aces( vec3 color ) {
      const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
      const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
      color *= exposure / 0.6;
      color = ACESInputMat * color; color = RRTAndODTFit( color ); color = ACESOutputMat * color;
      return clamp( color, 0.0, 1.0 );
    }
    vec3 srgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
    float hash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
    void main() {
      vec4 a = texture2D( tAcc, vUv );
      vec3 c = a.rgb; float alpha = 1.0;
      if ( transparent > 0.5 ) { alpha = clamp( a.a, 0.0, 1.0 ); c = alpha > 1e-5 ? c / alpha : vec3( 0.0 ); }
      // delikatne „zwinięcie” świateł przed ACES (okna), by uniknąć twardego przepalenia
      c = c / ( 1.0 + highlightRoll * max( max( c.r, c.g ), c.b ) * 0.0 );
      c *= wb * vec3( 1.0 + warmth, 1.0, 1.0 - warmth );
      c = aces( c );
      float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
      c = mix( vec3( l ), c, saturation );
      c = clamp( ( c - 0.5 ) * contrast + 0.5, 0.0, 1.0 );
      c = srgb( c );
      c = lift + ( 1.0 - lift ) * c;
      if ( vignette > 0.0 ) {
        vec2 q = vUv - 0.5; q.x *= resolution.x / resolution.y;
        float v = 1.0 - vignette * smoothstep( 0.35, 1.05, length( q ) );
        c *= v;
      }
      c += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      gl_FragColor = vec4( c, alpha );
    }`,
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = true;
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setPixelRatio(1);
    this.renderer = r;
    this.accMat = new THREE.ShaderMaterial(Object.assign({}, accShader, { uniforms: THREE.UniformsUtils.clone(accShader.uniforms), depthTest: false, depthWrite: false, blending: THREE.NoBlending }));
    this.postMat = new THREE.ShaderMaterial(Object.assign({}, postShader, { uniforms: THREE.UniformsUtils.clone(postShader.uniforms), depthTest: false, depthWrite: false, blending: THREE.NoBlending }));
    this.quad = new FullScreenQuad(this.accMat);
    this.size = [0, 0];
  }

  setSize(w, h) {
    if (this.size[0] === w && this.size[1] === h) return;
    this.size = [w, h];
    this.renderer.setSize(w, h, false);
    for (const k of ['rtFrame', 'rtA', 'rtB']) this[k] && this[k].dispose();
    this.rtFrame = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
    this.rtA = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, depthBuffer: false });
    this.rtB = this.rtA.clone();
  }

  /** Oblicza GTAO dla bieżącego kadru (bez jittera) i podpina do materiałów. */
  computeAO(scene, camera, params = {}) {
    const [w, h] = this.size;
    const r = this.renderer;
    const hidden = [];
    scene.traverse((o) => { if (o.visible && (o.userData.noAO || (o.material && (o.material.userData?.glass || o.material.isShadowMaterial)))) { o.visible = false; hidden.push(o); } });
    if (this.gtao) this.gtao.dispose();
    const gtao = new GTAOPass(scene, camera, w, h, undefined, Object.assign({ radius: 0.25, distanceExponent: 1, thickness: 1, scale: 1, samples: 24, distanceFallOff: 1, screenSpaceRadius: false }, params.ao || {}), Object.assign({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }, params.pd || {}));
    gtao.output = GTAOPass.OUTPUT.Off;
    const dummy = new THREE.WebGLRenderTarget(4, 4);
    resetAO();
    gtao.render(r, dummy, dummy);
    dummy.dispose();
    hidden.forEach((o) => (o.visible = true));
    this.gtao = gtao;
    AO.tAO.value = gtao.gtaoMap;
    AO.aoRes.value.set(w, h);
  }

  _sync() {
    const px = new Float32Array(4);
    this.renderer.readRenderTargetPixels(this.rtA, 0, 0, 1, 1, px);
  }

  /**
   * Progresywna akumulacja.
   * opts: { samples, jitter, onSample(i, n), clearAlpha, shift:{x,y} }
   */
  async accumulate(scene, camera, opts = {}) {
    const [W, H] = this.size;
    const r = this.renderer;
    const n = opts.samples || 64;
    const jitter = opts.jitter ?? 0.6;
    const shift = opts.shift || { x: 0, y: 0 };
    r.setClearColor(0x000000, opts.clearAlpha ?? 0);
    r.setRenderTarget(this.rtA); r.clear();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      if (opts.onSample) opts.onSample(i, n);
      const jx = (halton(i + 1, 2) - 0.5) * 2 * jitter, jy = (halton(i + 1, 3) - 0.5) * 2 * jitter;
      camera.setViewOffset(W, H, shift.x * W + jx, shift.y * H + jy, W, H);
      r.setRenderTarget(this.rtFrame);
      r.clear();
      r.render(scene, camera);
      this.accMat.uniforms.tPrev.value = this.rtA.texture;
      this.accMat.uniforms.tNew.value = this.rtFrame.texture;
      this.accMat.uniforms.w.value = 1 / (i + 1);
      this.quad.material = this.accMat;
      r.setRenderTarget(this.rtB);
      this.quad.render(r);
      [this.rtA, this.rtB] = [this.rtB, this.rtA];
      if (i % 2 === 1 || i === n - 1) {
        this._sync();
        await new Promise((res) => setTimeout(res, 0));
        if (i === 1 || (i + 1) % 32 === 0) console.log(`[render] próbka ${i + 1}/${n} (${((performance.now() - t0) / (i + 1) / 1000).toFixed(2)} s/klatkę)`);
      }
    }
    camera.setViewOffset(W, H, shift.x * W, shift.y * H, W, H);
    return performance.now() - t0;
  }

  /** Tone mapping + korekta do canvas; zwraca dataURL PNG. */
  output(post = {}) {
    const [W, H] = this.size;
    const u = this.postMat.uniforms;
    u.tAcc.value = this.rtA.texture;
    u.exposure.value = post.exposure ?? 1;
    u.transparent.value = post.transparent ? 1 : 0;
    u.saturation.value = post.saturation ?? 1;
    u.contrast.value = post.contrast ?? 1;
    u.lift.value = post.lift ?? 0;
    u.vignette.value = post.vignette ?? 0;
    u.warmth.value = post.warmth ?? 0;
    if (post.wb) u.wb.value.set(post.wb[0], post.wb[1], post.wb[2]); else u.wb.value.set(1, 1, 1);
    u.resolution.value.set(W, H);
    this.quad.material = this.postMat;
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.quad.render(this.renderer);
    return this.canvas.toDataURL('image/png');
  }
}
