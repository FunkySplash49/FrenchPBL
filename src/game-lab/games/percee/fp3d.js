/*
 * La Percée — first-person 3D view (three.js), built from the seeded world.
 *
 * Low-poly and cheap on purpose (phones, and the classroom's 4K touch monitor with a weak chip):
 *  - one shared Lambert material with vertex colours; everything repeated is an InstancedMesh
 *  - no shadow maps, a constant set of 4 lights (sky, moon, lantern, halo)
 *  - searchlights are additive cones + ground pools drawn by two instanced shaders (fog-correct)
 *  - rain falls in the vertex shader; the frame loop allocates nothing
 *  - pixel ratio capped at 1.5 and lowered automatically when frames get slow
 *
 * createFP(canvas) → { load(world, opts), render(dt, view), resize(), stats(), kick(), dispose() }
 * 1 world unit = 6 cm. World (x, y) → three (x·S, height, y·S).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD, TOWN, TUNE, hashSeed, mulberry32, riverY, nextGap } from './engine';

export const S = 0.06;
const EYE = 2.35; // a rider on horseback
const RES_STEPS = [1, 0.85, 0.7, 0.55, 0.45];
const SECTOR = 16;        // size of a culling sector for trees and stakes, three.js units
const TERRAIN_PATCH = 30; // terrain squares per side of a culling patch

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* cosmetic relief, shared by the terrain mesh and by everything standing on it */
function makeHeight(w) {
  const h0 = hashSeed(`${w.seed}#relief`) | 0;
  const hash = (i, j) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + h0) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const fx = x - xi; const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), sx), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx), sy);
  };
  const height = (ux, uy) => {
    const xr = Math.max(-20, Math.min(WORLD.w + 20, ux));
    const dr = Math.min(Math.abs(uy - riverY(w, 0, xr)), Math.abs(uy - riverY(w, 1, xr)));
    const bank = smooth(8, 46, dr);
    let h = ((noise(ux * 0.011, uy * 0.011) - 0.5) * 0.5 + (noise(ux * 0.045, uy * 0.045) - 0.5) * 0.16) * (0.25 + 0.75 * bank);
    h -= 0.5 * (1 - bank);
    // the oppidum stands on its plateau
    const te = Math.hypot((ux - w.cx) / (TOWN.rx + 40), (uy - w.cy) / (TOWN.ry + 32));
    h += 1.7 * (1 - smooth(0.7, 1.25, te));
    // the land rises beyond the works
    const e = Math.hypot((ux - w.cx) / 590, (uy - w.cy) / 440);
    const out = Math.min(1.8, Math.max(0, e - 1.5));
    h += out * out * 9 * (0.4 + noise(ux * 0.004 + 7, uy * 0.004 + 3));
    return h;
  };
  return { height, noise };
}

/* one geometry from coloured parts → one draw call per kind of object */
const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler(); const _v = new THREE.Vector3(); const _sc = new THREE.Vector3();
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _sc.set(sx, sy, sz));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color); const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}
/** merge parts; `ao` darkens the bottom (a cheap baked contact shadow) */
function build(parts, ao = 0.45) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingBox();
  const lo = g.boundingBox.min.y; const hi = g.boundingBox.max.y; const pos = g.attributes.position; const col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 - ao * (1 - smooth(0, 0.45, (pos.getY(i) - lo) / (hi - lo || 1)));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, n = 5, open = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open);
const cone = (r, h, n = 5, open = false) => new THREE.ConeGeometry(r, h, n, 1, open);
const ico = (r) => new THREE.IcosahedronGeometry(r, 0);

function glowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mistTexture(rnd) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 256; const y = rnd() * 256; const r = 24 + rnd() * 52;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { // tileable
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const FOG_FRAG = `
  float fogF = 0.0;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      fogF = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif`;

export function createFP(canvas) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr <= 1 && !coarse, powerPreference: 'high-performance', stencil: false });
  // physical pixels per CSS pixel of the canvas: the device ratio times the site's root zoom (1.5 or 2 on 4K screens)
  const zoomOf = () => { const r = canvas.getBoundingClientRect(); return canvas.offsetWidth && r.width ? r.width / canvas.offsetWidth : 1; };
  let maxRatio = Math.min(dpr, 1.5);
  let resIdx = 0; let ema = 16.7; let slow = 0; let fast = 0; let probe = 0; let probeMs = 0; let resHold = 0;
  let losses = 0;
  let floorIdx = 0;        // raised after a lost GPU context, so a weak GPU is not pushed over the edge again
  let resPending = true;   // a size change waits for the next draw: resizing clears the canvas, drawing at once avoids a black frame
  renderer.setPixelRatio(maxRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x0b1018);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.024);
  scene.fog.color = fogColor;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 420);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // constant light set
  const hemi = new THREE.HemisphereLight(0x5a6c94, 0x14100c, 1.0); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9db4dc, 1.1); moon.position.set(-0.45, 0.8, -0.4); scene.add(moon);
  const lantern = new THREE.SpotLight(0xffd59a, 0, 30, 0.5, 0.7, 1.3);
  lantern.position.set(0.2, -0.3, -2.1); camera.add(lantern); // just ahead of the horse's head, so the head is not floodlit
  const lanternTarget = new THREE.Object3D(); lanternTarget.position.set(0, -2.4, -12); camera.add(lanternTarget); lantern.target = lanternTarget;
  const halo = new THREE.PointLight(0xffc98a, 0, 7, 1.6); halo.position.set(0, 0.9, 0.6); camera.add(halo);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mat2 = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const glowTex = glowTexture();
  const shared = [mat, mat2, glowTex];
  // Materials outlive a night: disposing them made three.js delete and recompile ~15 shader programs at
  // the start of every night. Each one is made once, on first use, and its per-night values are set in load().
  const mats = new Map();
  const reuse = (key, make) => { let m = mats.get(key); if (!m) { m = make(); mats.set(key, m); shared.push(m); } return m; };

  let world = null;        // everything below is rebuilt by load()
  let L = null;
  const sceneObjs = []; const disposables = [];
  const add = (o) => { scene.add(o); sceneObjs.push(o); return o; };
  const keep = (x) => { disposables.push(x); return x; };
  /* Things repeated across the map (trees, stakes) are split into sectors with their own bounds, so
     whatever is outside the view is never sent to the GPU. items: [{ x, z, m: Matrix4, c: Color }] */
  const addSectors = (geo, material, items) => {
    const cells = new Map();
    for (const it of items) {
      const k = `${Math.floor(it.x / SECTOR)},${Math.floor(it.z / SECTOR)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(it);
    }
    for (const list of cells.values()) {
      const mesh = add(new THREE.InstancedMesh(geo, material, list.length));
      list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
      mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
    }
  };
  const dummy = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const DOWN = new THREE.Vector3(0, -1, 0); const dir3 = new THREE.Vector3(); const tmpC = new THREE.Color(); const tmpC2 = new THREE.Color();

  let wpx = 1; let hpx = 1;
  // never render more than ~1080p worth of pixels, whatever the screen
  const applyRes = () => { resPending = true; };
  const flushRes = () => {
    resPending = false;
    const cap = Math.sqrt(2.2e6 / (wpx * hpx));
    const ratio = Math.min(maxRatio, cap) * RES_STEPS[resIdx];
    const bw = Math.max(1, Math.floor(wpx * ratio)); const bh = Math.max(1, Math.floor(hpx * ratio));
    if (canvas.width === bw && canvas.height === bh && Math.abs(renderer.getPixelRatio() - ratio) < 1e-6) return; // same buffer: never clear it for nothing
    renderer.setPixelRatio(ratio); renderer.setSize(wpx, hpx, false);
  };
  const resize = () => {
    const nw = Math.max(1, canvas.clientWidth); const nh = Math.max(1, canvas.clientHeight);
    maxRatio = Math.min(dpr * zoomOf(), 1.5);
    if (nw !== wpx || nh !== hpx) { wpx = nw; hpx = nh; camera.aspect = wpx / hpx; camera.updateProjectionMatrix(); }
    applyRes();
  };
  let baseFov = 70; let fov = 70;
  let fovSetting = 70;     // the player's field of view (Settings)
  const fitFov = () => {
    // portrait phones: widen the vertical angle so the horizontal view stays usable
    const a = camera.aspect;
    baseFov = a >= 1.2 ? fovSetting : Math.min(fovSetting + 26, (2 * Math.atan(Math.tan(((fovSetting - 8) * Math.PI) / 360) / a) * 180) / Math.PI);
  };

  function unload() {
    sceneObjs.forEach((o) => { scene.remove(o); if (o.isInstancedMesh) o.dispose(); });
    disposables.forEach((d) => d.dispose());
    sceneObjs.length = 0; disposables.length = 0; L = null;
  }

  function load(w, opts = {}) {
    unload();
    world = w;
    const rnd = mulberry32(hashSeed(`${w.seed}#${w.night}#3d`));
    const { height, noise } = makeHeight(w);
    const hAt = (ux, uy) => height(ux, uy);
    const horror = !!opts.horror;
    const wx = w.weather;

    // ── palette of the night ──
    const horizon = new THREE.Color(wx === 'fog' ? 0x1b222b : wx === 'rain' ? 0x0c1017 : 0x0e1522);
    const zenith = new THREE.Color(wx === 'fog' ? 0x10151c : wx === 'rain' ? 0x05070b : 0x04060d);
    if (horror) { horizon.multiplyScalar(0.55); zenith.multiplyScalar(0.5); }
    const dawnHorizon = new THREE.Color(0x6a3a26); const dawnZenith = new THREE.Color(0x1a2238);
    const baseFog = (wx === 'fog' ? 0.05 : wx === 'rain' ? 0.031 : 0.023) + (horror ? 0.012 : 0);
    const hemiBase = (wx === 'clear' ? 1.15 : 0.85) * (horror ? 0.5 : 1);
    const moonBase = (wx === 'clear' ? 1.25 : wx === 'fog' ? 0.6 : 0.35) * (horror ? 0.45 : 1);

    // ── sky dome, stars, moon, far hills ──
    const skyMat = reuse('sky', () => new THREE.ShaderMaterial({
      uniforms: { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uDawn: { value: new THREE.Color(0xd9652a) }, uDawnK: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uDawn; uniform float uDawnK; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
          vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, h), 0.7));
          c += uDawn * uDawnK * exp(-h * 7.0) * (0.35 + 0.65 * max(0.0, d.x));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    const sky = add(new THREE.Mesh(keep(new THREE.SphereGeometry(380, 20, 10)), skyMat));
    // drawn after the solid scene, so the sky shader only runs on the pixels of sky that are really visible
    sky.renderOrder = 10; sky.frustumCulled = false;

    const starN = wx === 'clear' ? 420 : wx === 'fog' ? 60 : 0;
    let stars = null;
    if (starN) {
      const sp = new Float32Array(starN * 3);
      for (let i = 0; i < starN; i++) {
        const a = rnd() * Math.PI * 2; const e = 0.12 + rnd() * 1.35; const r = 360;
        sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const sg = keep(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      stars = add(new THREE.Points(sg, reuse('stars', () => new THREE.PointsMaterial({ color: 0xdfe6f5, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }))));
      stars.renderOrder = -9; stars.frustumCulled = false;
    }
    let moonMesh = null; let moonGlow = null;
    if (wx !== 'rain') {
      moonMesh = add(new THREE.Mesh(keep(new THREE.CircleGeometry(9, 20)), reuse('moon', () => new THREE.MeshBasicMaterial({ fog: false, depthWrite: false }))));
      moonMesh.renderOrder = 11; moonMesh.material.color.setHex(wx === 'fog' ? 0x8f9aae : 0xe6ecf7);
      moonGlow = add(new THREE.Sprite(reuse('moonGlow', () => new THREE.SpriteMaterial({ map: glowTex, color: 0x6f86b8, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }))));
      moonGlow.material.opacity = wx === 'fog' ? 0.9 : 0.55;
      moonGlow.scale.setScalar(wx === 'fog' ? 130 : 80); moonGlow.renderOrder = -8;
    }
    // far hills: a jagged ring, a shade darker than the horizon
    const hillSeg = 72; const hp = []; const hi = [];
    for (let i = 0; i <= hillSeg; i++) {
      const a = (i / hillSeg) * Math.PI * 2; const k = i % hillSeg;
      const top = 16 + noise(k * 0.37 + 3, 9) * 34 + noise(k * 1.3, 2) * 9;
      hp.push(Math.cos(a) * 330, -6, Math.sin(a) * 330, Math.cos(a) * 330, top, Math.sin(a) * 330);
      if (i) { const b = i * 2; hi.push(b - 2, b, b - 1, b - 1, b, b + 1); }
    }
    const hillGeo = keep(new THREE.BufferGeometry()); hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); hillGeo.setIndex(hi);
    const hillMat = reuse('hills', () => new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    const hills = add(new THREE.Mesh(hillGeo, hillMat)); hills.renderOrder = 12; hills.frustumCulled = false;

    // ── terrain: vertex-coloured, flat-shaded ──
    const margin = 620; const gw = (WORLD.w + margin * 2) * S; const gh = (WORLD.h + margin * 2) * S;
    const segX = 150; const segZ = Math.round(segX * gh / gw);
    const tg = keep(new THREE.PlaneGeometry(gw, gh, segX, segZ)); tg.rotateX(-Math.PI / 2); tg.translate(WORLD.w * S / 2, 0, WORLD.h * S / 2);
    const tp = tg.attributes.position; const tcol = new Float32Array(tp.count * 3);
    const cGrass = new THREE.Color(0x35432a); const cGrass2 = new THREE.Color(0x4a4a2c); const cMud = new THREE.Color(0x4a3a28); const cTown = new THREE.Color(0x4f5a34); const cBank = new THREE.Color(0x2a3030);
    for (let i = 0; i < tp.count; i++) {
      const ux = tp.getX(i) / S; const uy = tp.getZ(i) / S;
      tp.setY(i, hAt(ux, uy));
      const a = Math.atan2(uy - w.cy, ux - w.cx); const d = Math.hypot(ux - w.cx, uy - w.cy);
      const mud = 1 - smooth(4, 34, Math.min(Math.abs(d - w.inner.radiusAt(a).r), Math.abs(d - w.outer.radiusAt(a).r)));
      const xr = Math.max(-20, Math.min(WORLD.w + 20, ux));
      const wet = 1 - smooth(10, 40, Math.min(Math.abs(uy - riverY(w, 0, xr)), Math.abs(uy - riverY(w, 1, xr))));
      const town = 1 - smooth(0.8, 1.15, Math.hypot((ux - w.cx) / TOWN.rx, (uy - w.cy) / TOWN.ry));
      tmpC.copy(cGrass).lerp(cGrass2, noise(ux * 0.02 + 40, uy * 0.02));
      tmpC.lerp(cMud, mud * 0.85).lerp(cTown, town * 0.6).lerp(cBank, wet);
      const sh = 0.82 + noise(ux * 0.2, uy * 0.2) * 0.36;
      tcol[i * 3] = tmpC.r * sh; tcol[i * 3 + 1] = tmpC.g * sh; tcol[i * 3 + 2] = tmpC.b * sh;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tg.computeVertexNormals();
    // cut into patches that share one set of vertices, so the ground behind the camera is skipped
    const tIndex = tg.index.array; const tBox = new THREE.Box3(); const tV = new THREE.Vector3();
    for (let cz = 0; cz < segZ; cz += TERRAIN_PATCH) for (let cx = 0; cx < segX; cx += TERRAIN_PATCH) {
      const ids = []; tBox.makeEmpty();
      for (let iz = cz; iz < Math.min(cz + TERRAIN_PATCH, segZ); iz++) for (let ix = cx; ix < Math.min(cx + TERRAIN_PATCH, segX); ix++) {
        const q = (iz * segX + ix) * 6;
        for (let k = 0; k < 6; k++) { ids.push(tIndex[q + k]); tBox.expandByPoint(tV.fromBufferAttribute(tp, tIndex[q + k])); }
      }
      const pg = keep(new THREE.BufferGeometry());
      pg.setAttribute('position', tp); pg.setAttribute('normal', tg.attributes.normal); pg.setAttribute('color', tg.attributes.color); pg.setIndex(ids);
      pg.boundingSphere = tBox.getBoundingSphere(new THREE.Sphere());
      const patch = add(new THREE.Mesh(pg, mat)); patch.renderOrder = -5; patch.matrixAutoUpdate = false;
    }

    // rivers: dark water with a moonlit sheen
    const waterMat = reuse('water', () => new THREE.MeshLambertMaterial({ color: 0x1c2b3a, emissive: 0x0a1420, side: THREE.DoubleSide }));
    w.rivers.forEach((pts) => {
      const pos = []; const idx = [];
      pts.forEach(([x, y], i) => {
        const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)]; const [px, py] = pts[Math.max(i - 1, 0)];
        const dx = nx - px; const dy = ny - py; const l = Math.hypot(dx, dy) || 1;
        const ox = (-dy / l) * 30; const oy = (dx / l) * 30;
        pos.push((x + ox) * S, -0.2, (y + oy) * S, (x - ox) * S, -0.2, (y - oy) * S);
        if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
      });
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      add(new THREE.Mesh(geo, waterMat)).renderOrder = -4;
    });

    // ── searchlights: ground pools (the exact area a sentry sees) + additive beams ──
    const nW = w.watchers.length;
    const poolGeo = keep(new THREE.PlaneGeometry(2, 2)); poolGeo.rotateX(-Math.PI / 2);
    const aHalf = new Float32Array(nW); const aTint = new THREE.InstancedBufferAttribute(new Float32Array(nW), 1);
    aTint.setUsage(THREE.DynamicDrawUsage);
    w.watchers.forEach((o, i) => { aHalf[i] = o.half; });
    poolGeo.setAttribute('aHalf', new THREE.InstancedBufferAttribute(aHalf, 1)); poolGeo.setAttribute('aTint', aTint);
    const lightU = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(0xffb866) }, uAlert: { value: new THREE.Color(0xff5a48) }, uOpacity: { value: 1 } }]);
    const poolMat = reuse('pool', () => new THREE.ShaderMaterial({
      uniforms: lightU(), fog: true, transparent: false, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aHalf; attribute float aTint; varying vec2 vL; varying float vHalf; varying float vTint;
        #include <common>
        #include <fog_pars_vertex>
        void main(){ vL = position.xz; vHalf = aHalf; vTint = aTint;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uAlert; uniform float uOpacity; varying vec2 vL; varying float vHalf; varying float vTint;
        #include <common>
        #include <fog_pars_fragment>
        void main(){ float r = length(vL); float ang = abs(atan(vL.y, vL.x));
          float m = (1.0 - smoothstep(vHalf - 0.07, vHalf + 0.015, ang)) * (1.0 - smoothstep(0.9, 1.0, r)) * smoothstep(0.03, 0.12, r);
          if (m < 0.004) discard;
          ${FOG_FRAG}
          float edge = smoothstep(vHalf - 0.16, vHalf - 0.02, ang) + smoothstep(0.82, 0.96, r);
          vec3 c = mix(uColor, uAlert, vTint) * (mix(0.34, 0.16, r) + edge * 0.22) * (1.0 + vTint * 0.6);
          gl_FragColor = vec4(c * m * uOpacity * (1.0 - fogF), 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    const pools = add(new THREE.InstancedMesh(poolGeo, poolMat, nW)); pools.renderOrder = -3; pools.frustumCulled = false;
    pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const beamGeo = keep(new THREE.CylinderGeometry(0.04, 1, 1, 20, 1, true)); beamGeo.translate(0, -0.5, 0);
    beamGeo.setAttribute('aTint', aTint);
    const beamMat = reuse('beam', () => new THREE.ShaderMaterial({
      uniforms: lightU(), fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute float aTint; varying float vT; varying float vRim; varying float vTint;
        #include <common>
        #include <fog_pars_vertex>
        void main(){ vT = clamp(-position.y, 0.0, 1.0); vTint = aTint;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          vRim = abs(dot(n, normalize(-mvPosition.xyz)));
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uAlert; uniform float uOpacity; varying float vT; varying float vRim; varying float vTint;
        #include <common>
        #include <fog_pars_fragment>
        void main(){
          ${FOG_FRAG}
          float a = pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.75, vRim) * uOpacity;
          gl_FragColor = vec4(mix(uColor, uAlert, vTint) * (1.0 - fogF), a);
          #include <colorspace_fragment>
        }`,
    }));
    beamMat.uniforms.uOpacity.value = wx === 'fog' ? 0.3 : 0.2;
    const beams = add(new THREE.InstancedMesh(beamGeo, beamMat, nW)); beams.frustumCulled = false; beams.renderOrder = 5;
    beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // ── the Roman works: earth bank + palisade of pointed stakes ──
    const bp = []; const bc = []; const bi = [];
    const earth = new THREE.Color(0x4a3a26); const earthLo = new THREE.Color(0x2a2117);
    const quad = (a, b, c, d) => { const o = bp.length / 3; bp.push(...a, ...b, ...c, ...d); bi.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const colr = (...cs) => cs.forEach((c) => bc.push(c.r, c.g, c.b));
    const stakeSpots = [];
    for (const ring of [w.inner, w.outer]) {
      const has = new Set(ring.segs.map((s) => s[4]));
      for (const s of ring.segs) {
        const [x1, y1, x2, y2, id] = s;
        let nx = -(y2 - y1); let ny = x2 - x1; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const pt = (x, y, off, hgt) => [(x + nx * off) * S, hAt(x, y) + hgt, (y + ny * off) * S];
        const A = [pt(x1, y1, 22, -0.1), pt(x1, y1, 7, 1.15), pt(x1, y1, -7, 1.15), pt(x1, y1, -22, -0.1)];
        const B = [pt(x2, y2, 22, -0.1), pt(x2, y2, 7, 1.15), pt(x2, y2, -7, 1.15), pt(x2, y2, -22, -0.1)];
        for (let k = 0; k < 3; k++) {
          quad(A[k], B[k], B[k + 1], A[k + 1]);
          colr(k === 0 ? earthLo : earth, k === 0 ? earthLo : earth, k === 2 ? earthLo : earth, k === 2 ? earthLo : earth);
        }
        if (!has.has((id + ring.N - 1) % ring.N)) { quad(A[0], A[1], A[2], A[3]); colr(earthLo, earth, earth, earthLo); }
        if (!has.has((id + 1) % ring.N)) { quad(B[3], B[2], B[1], B[0]); colr(earthLo, earth, earth, earthLo); }
        const len = l * S; const k = Math.max(2, Math.round(len / 0.4));
        for (let j = 0; j < k; j++) { const f = (j + 0.5) / k; stakeSpots.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]); }
      }
    }
    const bankGeo = keep(new THREE.BufferGeometry());
    bankGeo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bankGeo.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    bankGeo.setIndex(bi); const bankFlat = keep(bankGeo.toNonIndexed()); bankFlat.computeVertexNormals();
    add(new THREE.Mesh(bankFlat, mat2)).frustumCulled = false;

    const stakeGeo = keep(build([part(cyl(0.14, 0.17, 1.9, 4, true), 0x6b4a2c, 0, 0.95, 0), part(cone(0.14, 0.4, 4, true), 0x8a6a44, 0, 2.1, 0)], 0.5));
    addSectors(stakeGeo, mat, stakeSpots.map(([x, y]) => {
      dummy.position.set(x * S + (rnd() - 0.5) * 0.05, hAt(x, y) + 1.0 + (rnd() - 0.5) * 0.12, y * S + (rnd() - 0.5) * 0.05);
      dummy.rotation.set((rnd() - 0.5) * 0.09, rnd() * 3, (rnd() - 0.5) * 0.09); dummy.scale.set(1, 0.92 + rnd() * 0.2, 1);
      dummy.updateMatrix();
      return { x: x * S, z: y * S, m: dummy.matrix.clone(), c: new THREE.Color().setScalar(0.75 + rnd() * 0.4) };
    }));

    // watchtowers
    const TH = 5.6;
    const towerGeo = keep(build([
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => part(box(0.22, TH, 0.22), 0x5c4028, a * 0.95, TH / 2, b * 0.95, b * 0.06, 0, -a * 0.06)),
      part(box(2.3, 0.1, 0.12), 0x4a3320, 0, 2.2, 0.95, 0, 0, 0.5), part(box(2.3, 0.1, 0.12), 0x4a3320, 0, 2.2, -0.95, 0, 0, -0.5),
      part(box(0.12, 0.1, 2.3), 0x4a3320, 0.95, 3.4, 0, 0.5, 0, 0), part(box(0.12, 0.1, 2.3), 0x4a3320, -0.95, 3.4, 0, -0.5, 0, 0),
      part(box(2.7, 0.2, 2.7), 0x73522f, 0, TH, 0),
      part(box(2.7, 0.75, 0.1), 0x6a4a2b, 0, TH + 0.45, 1.3), part(box(2.7, 0.75, 0.1), 0x6a4a2b, 0, TH + 0.45, -1.3),
      part(box(0.1, 0.75, 2.7), 0x6a4a2b, 1.3, TH + 0.45, 0), part(box(0.1, 0.75, 2.7), 0x6a4a2b, -1.3, TH + 0.45, 0),
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => part(box(0.12, 1.9, 0.12), 0x5c4028, a * 1.2, TH + 1.0, b * 1.2)),
      part(cone(2.2, 0.9, 4), 0x4a3824, 0, TH + 2.4, 0, 0, Math.PI / 4, 0),
      part(box(0.05, 1.5, 0.05), 0x3a2a1a, 1.2, TH + 2.7, 1.2), part(box(0.6, 0.45, 0.03), 0xb3261e, 1.5, TH + 3.15, 1.2),
    ], 0.55));
    const towerMesh = add(new THREE.InstancedMesh(towerGeo, mat, w.towers.length)); towerMesh.frustumCulled = false;
    const lampY = new Float32Array(nW);
    w.towers.forEach((t, i) => {
      const gy = hAt(t.x, t.y);
      dummy.position.set(t.x * S, gy + 1.0, t.y * S); dummy.rotation.set(0, -t.base, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      towerMesh.setMatrixAt(i, dummy.matrix); lampY[i] = gy + 1.0 + TH + 1.1;
    });

    // patrols (Roman red, per the faction colours)
    const soldierGeo = keep(build([
      part(box(0.2, 0.8, 0.22), 0x6b4a32, -0.13, 0.4, 0), part(box(0.2, 0.8, 0.22), 0x6b4a32, 0.13, 0.4, 0),
      part(box(0.56, 0.75, 0.32), 0xb3261e, 0, 1.15, 0), part(box(0.6, 0.3, 0.36), 0x8a8a90, 0, 1.4, 0),
      part(ico(0.19), 0xc9a078, 0, 1.72, 0), part(box(0.4, 0.16, 0.4), 0x9a9aa2, 0, 1.86, 0), part(box(0.06, 0.2, 0.42), 0xb3261e, 0, 2.02, 0),
      part(box(0.08, 1.05, 0.62), 0x9c2019, 0, 1.0, 0.36), part(box(0.04, 2.3, 0.04), 0x6b4a32, 0.1, 1.3, -0.34),
      part(box(0.06, 0.5, 0.06), 0x4a3320, 0.42, 1.55, -0.25),
    ], 0.35));
    const soldiers = add(new THREE.InstancedMesh(soldierGeo, mat, Math.max(1, w.patrols.length))); soldiers.frustumCulled = false;
    soldiers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // torches and fires: glow sprites instead of real lights
    const fires = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6; let x = w.cx + Math.cos(a) * 66; let y = w.cy + Math.sin(a) * 40;
      // a fire under a thatched eave would glow straight through the roof: keep it clear of every roof
      // (roof radius is 2.1 / S × scale world units; the glow sprite reaches about 22 units around the fire)
      for (const h of w.huts) {
        const clear = (2.1 / S) * h.s + 24; const dx = x - h.x; const dy = y - h.y; const d = Math.hypot(dx, dy);
        if (d < clear) { const k = d > 0.01 ? clear / d : 0; x = d > 0.01 ? h.x + dx * k : h.x + clear; y = d > 0.01 ? h.y + dy * k : y; }
      }
      fires.push([x, y]);
    }
    const nGlow = nW + fires.length;
    const gp = new Float32Array(nGlow * 3); const gc = new Float32Array(nGlow * 3);
    for (let i = 0; i < nGlow; i++) { gc[i * 3] = 1; gc[i * 3 + 1] = 0.62; gc[i * 3 + 2] = 0.28; }
    w.towers.forEach((t, i) => { gp[i * 3] = t.x * S; gp[i * 3 + 1] = lampY[i]; gp[i * 3 + 2] = t.y * S; });
    fires.forEach(([x, y], k) => { const i = nW + k; gp[i * 3] = x * S; gp[i * 3 + 1] = hAt(x, y) + 0.5; gp[i * 3 + 2] = y * S; });
    const glowGeo = keep(new THREE.BufferGeometry());
    const glowPos = new THREE.BufferAttribute(gp, 3); glowPos.setUsage(THREE.DynamicDrawUsage);
    glowGeo.setAttribute('position', glowPos); glowGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    const glowMat = reuse('glow', () => new THREE.PointsMaterial({ map: glowTex, size: 2.6, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const glows = add(new THREE.Points(glowGeo, glowMat)); glows.frustumCulled = false; glows.renderOrder = 6;

    // ── Alésia: round houses with thatched roofs, low fires ──
    const hutGeo = keep(build([part(cyl(1.5, 1.6, 1.3, 9), 0x7a6a4c, 0, 0.65, 0), part(cone(2.1, 2.2, 9), 0x8a7440, 0, 2.4, 0), part(box(0.6, 1.0, 0.1), 0x2a1a10, 0, 0.5, 1.56)], 0.4));
    const huts = add(new THREE.InstancedMesh(hutGeo, mat, Math.max(1, w.huts.length))); huts.frustumCulled = false;
    huts.setMatrixAt(0, zero);
    w.huts.forEach((h, i) => {
      dummy.position.set(h.x * S, hAt(h.x, h.y) - 0.05, h.y * S); dummy.rotation.set(0, h.rot, 0); dummy.scale.setScalar(h.s); dummy.updateMatrix();
      huts.setMatrixAt(i, dummy.matrix);
    });

    // ── trees (solid trunks, canopy above the rider's head) + a dark belt of woods beyond the works ──
    const treeGeo = keep(build([
      part(cyl(0.16, 0.26, 3.4, 5, true), 0x4a3524, 0, 1.7, 0),
      part(ico(1.7), 0x2c4a2a, 0, 4.5, 0, 0, 0, 0, 1, 0.8, 1), part(ico(1.25), 0x355a30, 0.7, 5.4, 0.3, 0.4, 0, 0, 1, 0.8, 1), part(ico(1.1), 0x27402a, -0.8, 4.2, -0.5, 0, 0.5, 0, 1, 0.75, 1),
    ], 0.3));
    const far = [];
    for (let i = 0; i < 150; i++) {
      const a = rnd() * Math.PI * 2; const po = w.outer.radiusAt(a); const k = 1.22 + rnd() * 0.75;
      far.push({ x: w.cx + (po.x - w.cx) * k, y: w.cy + (po.y - w.cy) * k, s: 1 + rnd() * 0.9, rot: rnd() * 6 });
    }
    const allTrees = [...w.trees, ...far];
    addSectors(treeGeo, mat, allTrees.map((t) => {
      dummy.position.set(t.x * S, hAt(t.x, t.y) - 0.1, t.y * S); dummy.rotation.set(0, t.rot, 0); dummy.scale.set(t.s, 0.85 + t.s * 0.25, t.s); dummy.updateMatrix();
      return { x: t.x * S, z: t.y * S, m: dummy.matrix.clone(), c: new THREE.Color().setRGB(0.8 + rnd() * 0.35, 0.8 + rnd() * 0.4, 0.8 + rnd() * 0.3) };
    }));

    // lilia: hidden pits with a stake, shown once spotted
    const trapGeo = keep(build([part(cone(0.07, 0.5, 4), 0xc9a050, 0, 0.2, 0), part(cyl(0.34, 0.26, 0.1, 6), 0x1c140c, 0, 0.02, 0)], 0));
    const trapMesh = add(new THREE.InstancedMesh(trapGeo, mat, Math.max(1, w.traps.length))); trapMesh.frustumCulled = false;
    for (let i = 0; i < Math.max(1, w.traps.length); i++) trapMesh.setMatrixAt(i, zero);
    const trapShown = new Uint8Array(w.traps.length);

    // the Gaulish riders (Gaul green cloaks)
    const riderGeo = keep(build([
      part(box(0.5, 0.6, 1.7), 0x5a4030, 0, 1.25, 0), part(box(0.3, 0.9, 0.4), 0x5a4030, 0, 1.75, -0.95, 0.6, 0, 0), part(box(0.24, 0.3, 0.6), 0x4a3324, 0, 2.15, -1.35, 0.3, 0, 0),
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => part(box(0.13, 1.0, 0.13), 0x4a3324, a * 0.18, 0.5, b * 0.7)),
      part(box(0.46, 0.75, 0.32), 0x2f6b3a, 0, 1.95, 0.1), part(box(0.6, 0.6, 0.12), 0x3d8a4b, 0, 1.9, 0.32, 0.25, 0, 0),
      part(ico(0.19), 0xc9a078, 0, 2.5, 0.08), part(box(0.2, 0.16, 0.22), 0xb9843a, 0, 2.62, 0.1),
      part(box(0.04, 2.0, 0.04), 0x6b4a32, 0.3, 2.3, 0.05),
    ], 0.3));
    const riderMesh = add(new THREE.InstancedMesh(riderGeo, mat, w.riders.length)); riderMesh.frustumCulled = false;
    riderMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // beacons: where to go (green = a rider to rally, gold = a gap, red = where you were last seen)
    const pillar = new THREE.CylinderGeometry(0.28, 0.5, 16, 8, 1, true); pillar.translate(0, 8, 0);
    const pc = new Float32Array(pillar.attributes.position.count * 3);
    for (let i = 0; i < pillar.attributes.position.count; i++) { const k = Math.pow(1 - pillar.attributes.position.getY(i) / 16, 1.5); pc[i * 3] = k; pc[i * 3 + 1] = k; pc[i * 3 + 2] = k; }
    pillar.setAttribute('color', new THREE.BufferAttribute(pc, 3)); keep(pillar);
    const gapsAll = [...w.inner.gapPts, ...w.outer.gapPts];
    const nB = w.riders.length + gapsAll.length + 1;
    const beaconMat = reuse('beacon', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.5 }));
    const beacons = add(new THREE.InstancedMesh(pillar, beaconMat, nB)); beacons.frustumCulled = false; beacons.renderOrder = 4;
    beacons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const cGaul = new THREE.Color(0x4fd070); const cGold = new THREE.Color(0xe2b04a); const cRome = new THREE.Color(0xf06a5a);
    w.riders.forEach((r, i) => beacons.setColorAt(i, cGaul));
    gapsAll.forEach((g, k) => {
      const i = w.riders.length + k; beacons.setColorAt(i, cGold);
      dummy.position.set(g.x * S, hAt(g.x, g.y), g.y * S); dummy.rotation.set(0, 0, 0); dummy.scale.set(1.5, 1, 1.5); dummy.updateMatrix(); beacons.setMatrixAt(i, dummy.matrix);
    });
    beacons.setColorAt(nB - 1, cRome); beacons.setMatrixAt(nB - 1, zero);

    // a ring on the ground: where the stone landed / where you were seen
    const ringGeo = keep(new THREE.RingGeometry(0.82, 1, 28)); ringGeo.rotateX(-Math.PI / 2);
    const mkRing = (key, color) => {
      const rm = reuse(key, () => new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
      rm.color.setHex(color);
      const m = add(new THREE.Mesh(ringGeo, rm));
      m.renderOrder = -2; m.visible = false; return m;
    };
    const pingRing = mkRing('ringPing', 0xf7ecd6); const seenRing = mkRing('ringSeen', 0xf06a5a);
    const stoneMesh = add(new THREE.Mesh(keep(ico(0.09)), reuse('stone', () => new THREE.MeshBasicMaterial({ color: 0xcfc6b4 })))); stoneMesh.visible = false;

    // ── weather ──
    let rain = null;
    if (wx === 'rain') {
      const N = coarse ? 900 : 1500; const seed = new Float32Array(N * 6); const end = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) {
        const a = rnd(); const b = rnd(); const c = rnd();
        seed.set([a, b, c, a, b, c], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
      }
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3)); geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
      const rm = reuse('rain', () => new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uBox: { value: 26 }, uSpeed: { value: 21 }, uLen: { value: 0.55 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xa9b8cc) }, uOpacity: { value: 0.5 } },
        transparent: true, depthWrite: false,
        vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform float uBox; uniform float uSpeed; uniform float uLen; uniform vec3 uCam; varying float vA;
          void main(){ vec3 p;
            p.xz = mod(aSeed.xz * uBox - uCam.xz, uBox) - uBox * 0.5;
            p.y = mod(aSeed.y * uBox - uTime * uSpeed * (0.8 + aSeed.x * 0.4), uBox) - uBox * 0.4;
            p.y += aEnd * uLen; p.x += aEnd * uLen * 0.18;
            vA = (1.0 - smoothstep(uBox * 0.22, uBox * 0.5, length(p.xz))) * (0.4 + 0.6 * aEnd);
            gl_Position = projectionMatrix * viewMatrix * vec4(uCam + p, 1.0); }`,
        fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }',
      }));
      rain = add(new THREE.LineSegments(geo, rm)); rain.frustumCulled = false; rain.renderOrder = 7;
    }
    // ground mist: two big drifting sheets
    const mistTex = keep(mistTexture(rnd)); const mists = [];
    const mistN = wx === 'rain' ? 1 : 2;
    for (let i = 0; i < mistN; i++) {
      const tex = i ? keep(mistTex.clone()) : mistTex; tex.repeat.set(3, 3);
      const mg = keep(new THREE.PlaneGeometry(150, 150)); mg.rotateX(-Math.PI / 2);
      const mm = reuse(`mist${i}`, () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
      mm.map = tex; mm.color.setHex(wx === 'fog' ? 0xaab4c4 : 0x7f8ea8); mm.opacity = (wx === 'fog' ? 0.5 : 0.28) * (horror ? 1.3 : 1);
      const m = add(new THREE.Mesh(mg, mm)); m.renderOrder = 3; m.frustumCulled = false; mists.push({ m, tex, y: 0.55 + i * 0.75 });
    }

    // hoof dust: a small pool of puffs
    const DN = 20; const dpos = new Float32Array(DN * 3); const dcol = new Float32Array(DN * 3); const dlife = new Float32Array(DN);
    const dustGeo = keep(new THREE.BufferGeometry());
    const dustPos = new THREE.BufferAttribute(dpos, 3); const dustCol = new THREE.BufferAttribute(dcol, 3);
    dustPos.setUsage(THREE.DynamicDrawUsage); dustCol.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute('position', dustPos); dustGeo.setAttribute('color', dustCol);
    const dust = add(new THREE.Points(dustGeo, reuse('dust', () => new THREE.PointsMaterial({ map: glowTex, size: 1.5, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))));
    dust.frustumCulled = false; dust.renderOrder = 6;

    // ── the horse you ride: neck, head, ears, mane and reins, seen from the saddle ──
    const coat = 0x5a3c26; const dark = 0x1c120b;
    const horseGeo = keep(build([
      part(box(0.3, 0.42, 1.25), coat, 0, -1.02, -0.72, 0.5, 0, 0),         // neck
      part(box(0.07, 0.2, 1.2), dark, 0, -0.78, -0.7, 0.5, 0, 0),           // mane
      part(box(0.25, 0.3, 0.42), coat, 0, -0.66, -1.36, 0.1, 0, 0),         // poll
      part(box(0.2, 0.24, 0.5), coat, 0, -0.8, -1.72, -0.5, 0, 0),          // face, sloping away
      part(box(0.09, 0.14, 0.2), dark, 0, -0.5, -1.3, 0.2, 0, 0),           // forelock
      part(cone(0.055, 0.2, 4), coat, -0.1, -0.44, -1.3, -0.25, 0, 0.2), part(cone(0.055, 0.2, 4), coat, 0.1, -0.44, -1.3, -0.25, 0, -0.2),
      part(box(0.025, 0.025, 1.5), dark, -0.19, -0.98, -0.95, 0.42, 0.1, 0), part(box(0.025, 0.025, 1.5), dark, 0.19, -0.98, -0.95, 0.42, -0.1, 0), // reins
      part(box(0.62, 0.3, 0.7), coat, 0, -1.42, -0.1),                        // withers
    ], 0.25));
    const rig = add(new THREE.Mesh(horseGeo, mat)); rig.frustumCulled = false; rig.rotation.order = 'YXZ';

    const sight = { horizon, zenith, dawnHorizon, dawnZenith, baseFog, hemiBase, moonBase };
    L = {
      hAt, sight, sky, skyMat, stars, moonMesh, moonGlow, hills, hillMat, pools, beams, aTint, lampY, soldiers, glows, glowPos, glowMat, nW,
      trapMesh, trapShown, riderMesh, beacons, nB, gapsAll, pingRing, seenRing, stoneMesh, rain, mists, dust, dustPos, dustCol, dpos, dcol, dlife, DN, rig,
      horror, hoof: 0, dustI: 0, t: 0, horseYaw: w.player.face, gait: 0, bobK: 0, shake: 0, kickT: 0, rider0: 0,
    };
    lantern.intensity = 0; halo.intensity = 0;
    // the lantern only shines in "Dread" mode; otherwise it is left out of the scene, so the shaders do
    // not evaluate a spot light of intensity 0 on every pixel (same picture, less work per pixel)
    lantern.visible = horror;
    fov = baseFov;
    // first matrices
    updateDynamic(0, w.player.face);
  }

  /* per-frame instance updates (no allocation) */
  function updateDynamic(dt, yaw) {
    const w = world; const p = w.player;
    const { hAt, pools, beams, aTint, lampY, soldiers, glowPos, nW, riderMesh, beacons, nB } = L;
    const tint = aTint.array; const gp = glowPos.array;
    const nT = w.towers.length;
    for (let i = 0; i < nW; i++) {
      const o = w.watchers[i]; const isT = i < nT;
      let ly;
      if (isT) ly = lampY[i];
      else {
        const gy = hAt(o.x, o.y); ly = gy + 1.75;
        dummy.position.set(o.x * S, gy, o.y * S); dummy.rotation.set(0, -o.dir - Math.PI / 2, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        soldiers.setMatrixAt(i - nT, dummy.matrix);
        gp[i * 3] = o.x * S + Math.cos(o.dir) * 0.3; gp[i * 3 + 1] = ly + 0.1; gp[i * 3 + 2] = o.y * S + Math.sin(o.dir) * 0.3;
      }
      const want = o.see ? 1 : o.inv > 0 ? 0.45 : 0;
      tint[i] += (want - tint[i]) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
      const gy0 = hAt(o.x + Math.cos(o.dir) * o.range * 0.5, o.y + Math.sin(o.dir) * o.range * 0.5);
      // pool: the exact sector the sentry sees, laid on the ground
      dummy.position.set(o.x * S, gy0 + 0.05, o.y * S); dummy.rotation.set(0, -o.dir, 0); dummy.scale.set(o.range * S, 1, o.range * S); dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
      // beam: from the lamp down to the middle of the pool
      const reach = o.range * 0.66 * S;
      dir3.set(Math.cos(o.dir) * reach, gy0 - ly, Math.sin(o.dir) * reach);
      const len = dir3.length(); dir3.multiplyScalar(1 / len);
      dummy.position.set(o.x * S, ly, o.y * S); dummy.quaternion.setFromUnitVectors(DOWN, dir3);
      const rad = reach * Math.tan(o.half) * 1.15; dummy.scale.set(rad, len * 1.3, rad); dummy.updateMatrix();
      beams.setMatrixAt(i, dummy.matrix);
    }
    pools.instanceMatrix.needsUpdate = true; beams.instanceMatrix.needsUpdate = true; aTint.needsUpdate = true;
    if (w.patrols.length) { soldiers.instanceMatrix.needsUpdate = true; glowPos.needsUpdate = true; }

    // riders + their beacons
    for (let i = 0; i < w.riders.length; i++) {
      const r = w.riders[i]; const gy = hAt(r.x, r.y);
      dummy.position.set(r.x * S, gy, r.y * S); dummy.rotation.set(0, -r.face - Math.PI / 2, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      riderMesh.setMatrixAt(i, dummy.matrix);
      if (r.rallied) beacons.setMatrixAt(i, zero);
      else { dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); beacons.setMatrixAt(i, dummy.matrix); }
    }
    riderMesh.instanceMatrix.needsUpdate = true;
    const ls = w.lastSeen;
    if (ls.on) { dummy.position.set(ls.x * S, hAt(ls.x, ls.y), ls.y * S); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.8, 0.35, 0.8); dummy.updateMatrix(); beacons.setMatrixAt(nB - 1, dummy.matrix); }
    else beacons.setMatrixAt(nB - 1, zero);
    beacons.instanceMatrix.needsUpdate = true;
    void yaw; void p;
  }

  function render(dt, view) {
    if (!L) return;
    const w = world; const p = w.player; const still = !!view.still;
    const { hAt, sight } = L;
    L.t += dt;
    const x = p.x * S; const z = p.y * S; const ground = hAt(p.x, p.y);
    const sp = p.speed / TUNE.gallop; // 0 … 1
    const gallop = p.galloping ? 1 : 0;
    const fear = w.alarm / 100;

    // gait: two bobs per stride, faster at a gallop
    L.gait += dt * (p.speed > 8 ? 5.5 + sp * 9 : 0);
    L.bobK += ((p.speed > 8 ? 0.5 + sp * 0.5 : 0) - L.bobK) * Math.min(1, dt * 6);
    const amp = still ? 0 : L.bobK;
    const bob = Math.abs(Math.sin(L.gait)) * 0.075 * amp;
    const sway = Math.sin(L.gait) * 0.02 * amp;

    // detection shake: a soft, decaying tremor (never under reduced motion)
    L.shake = Math.max(L.shake - dt * 2.4, w.seen ? 0.2 + fear * 0.5 : 0);
    if (L.kickT > 0) { L.kickT -= dt; L.shake = Math.max(L.shake, L.kickT * 2); }
    const sh = still ? 0 : L.shake * L.shake * 0.02;
    const t = L.t;
    camera.position.set(x, ground + EYE + bob, z);
    camera.rotation.y = -view.yaw - Math.PI / 2 + Math.sin(t * 37) * sh;
    camera.rotation.x = view.pitch + Math.sin(t * 43 + 1) * sh * 0.8 - bob * 0.12;
    camera.rotation.z = sway * 0.35 + Math.sin(t * 29 + 2) * sh * 0.6;
    if (view.fov !== undefined && view.fov !== fovSetting) { fovSetting = view.fov; fitFov(); fov = baseFov; camera.fov = fov; camera.updateProjectionMatrix(); }
    const wantFov = baseFov + (still ? 0 : gallop * 7);
    if (Math.abs(wantFov - fov) > 0.02) { fov += (wantFov - fov) * Math.min(1, dt * 5); camera.fov = fov; camera.updateProjectionMatrix(); }

    // the horse follows the direction you ride, a little behind your gaze
    const moveA = p.speed > 12 ? Math.atan2(p.vy, p.vx) : view.yaw;
    let dy = ((moveA - L.horseYaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(dy) > 2.2) dy = 0; // riding backwards: keep the head forward
    L.horseYaw += dy * Math.min(1, dt * 4);
    let rel = ((L.horseYaw - view.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (rel > 0.75) { L.horseYaw -= rel - 0.75; rel = 0.75; } else if (rel < -0.75) { L.horseYaw -= rel + 0.75; rel = -0.75; }
    const rig = L.rig;
    rig.position.set(x, ground + EYE + bob * 0.55 - (still ? 0 : Math.abs(Math.sin(L.gait + 0.6)) * 0.035 * amp), z);
    rig.rotation.y = -L.horseYaw - Math.PI / 2;
    rig.rotation.x = still ? 0 : Math.sin(L.gait * 1 + 0.8) * 0.035 * amp - gallop * 0.05;
    rig.rotation.z = -sway * 0.6;

    // lantern (Effroi): a flickering cone of warm light
    if (L.horror) {
      const fl = still ? 1 : 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3);
      lantern.intensity = 95 * fl; halo.intensity = 2.4 * fl;
    } else { lantern.intensity = 0; halo.intensity = 1.6; }

    updateDynamic(dt, view.yaw);

    // traps you have spotted
    const traps = w.traps; let trapDirty = false;
    for (let i = 0; i < traps.length; i++) {
      if (traps[i].seen && !L.trapShown[i]) {
        L.trapShown[i] = 1; trapDirty = true;
        dummy.position.set(traps[i].x * S, hAt(traps[i].x, traps[i].y) + 0.02, traps[i].y * S); dummy.rotation.set(0, i, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        L.trapMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    if (trapDirty) L.trapMesh.instanceMatrix.needsUpdate = true;

    // stone in flight, noise ring, last-seen ring
    const st = w.stone;
    L.stoneMesh.visible = st.on;
    if (st.on) {
      const k = st.t; const sx = st.x0 + (st.x1 - st.x0) * k; const sy = st.y0 + (st.y1 - st.y0) * k;
      L.stoneMesh.position.set(sx * S, lerp(ground + EYE - 0.3, hAt(st.x1, st.y1), k) + Math.sin(k * Math.PI) * 2.6, sy * S);
    }
    L.pingRing.visible = w.ping.on;
    if (w.ping.on) {
      const k = w.ping.t / 1.6; const r = still ? 2.2 : 0.6 + k * TUNE.stoneHear * S * 0.6;
      L.pingRing.position.set(w.ping.x * S, hAt(w.ping.x, w.ping.y) + 0.06, w.ping.y * S); L.pingRing.scale.set(r, 1, r);
      L.pingRing.material.color.setRGB(0.6 * (1 - k), 0.56 * (1 - k), 0.5 * (1 - k));
    }
    L.seenRing.visible = w.lastSeen.on;
    if (w.lastSeen.on) {
      const pr = still ? 1 : 1 + Math.sin(t * 4) * 0.08;
      L.seenRing.position.set(w.lastSeen.x * S, hAt(w.lastSeen.x, w.lastSeen.y) + 0.06, w.lastSeen.y * S); L.seenRing.scale.set(0.9 * pr, 1, 0.9 * pr);
    }

    // hoof dust
    const { dpos, dcol, dlife, DN } = L;
    if (!still && p.speed > 60) {
      L.hoof -= dt * (2 + sp * 7);
      if (L.hoof <= 0) {
        L.hoof = 1; const i = L.dustI = (L.dustI + 1) % DN; const side = i % 2 ? 0.35 : -0.35;
        const fx = Math.cos(L.horseYaw); const fz = Math.sin(L.horseYaw);
        dpos[i * 3] = x + fx * 1.3 - fz * side; dpos[i * 3 + 1] = ground + 0.15; dpos[i * 3 + 2] = z + fz * 1.3 + fx * side; dlife[i] = 1;
      }
    }
    for (let i = 0; i < DN; i++) {
      if (dlife[i] <= 0) { dcol[i * 3] = dcol[i * 3 + 1] = dcol[i * 3 + 2] = 0; continue; }
      dlife[i] -= dt * 1.6; dpos[i * 3 + 1] += dt * 0.5;
      const k = Math.max(0, dlife[i]) * 0.16;
      dcol[i * 3] = k; dcol[i * 3 + 1] = k * 0.9; dcol[i * 3 + 2] = k * 0.75;
    }
    L.dustPos.needsUpdate = true; L.dustCol.needsUpdate = true;

    // sky, fog, light: weather, lightning, the coming dawn
    const dawn = Math.max(0, Math.min(1, 1 - (w.limit - w.time) / TUNE.dawnWarn));
    const fl = still ? 0 : w.flash;
    tmpC.copy(sight.horizon).lerp(sight.dawnHorizon, dawn * 0.75);
    tmpC2.copy(sight.zenith).lerp(sight.dawnZenith, dawn * 0.8);
    if (fl > 0) { tmpC.r += fl * 0.22; tmpC.g += fl * 0.24; tmpC.b += fl * 0.3; tmpC2.r += fl * 0.1; tmpC2.g += fl * 0.11; tmpC2.b += fl * 0.15; }
    fogColor.copy(tmpC);
    L.skyMat.uniforms.uHorizon.value.copy(tmpC); L.skyMat.uniforms.uZenith.value.copy(tmpC2); L.skyMat.uniforms.uDawnK.value = dawn * 0.5;
    L.hillMat.color.copy(tmpC).multiplyScalar(0.5);
    scene.fog.density = sight.baseFog * (1 - dawn * 0.2) + (L.horror ? fear * 0.012 : 0);
    hemi.intensity = sight.hemiBase * (1 + dawn * 0.9) + fl * 5;
    moon.intensity = sight.moonBase * (1 - dawn * 0.4);
    L.sky.position.copy(camera.position); L.hills.position.set(x, 0, z);
    if (L.stars) { L.stars.position.copy(camera.position); L.stars.material.opacity = 0.85 * (1 - dawn); }
    if (L.moonMesh) {
      L.moonMesh.position.set(x - 150, 215, z - 135); L.moonMesh.lookAt(camera.position);
      L.moonGlow.position.copy(L.moonMesh.position);
    }
    L.glowMat.size = still ? 2.6 : 2.6 + Math.sin(t * 11) * Math.sin(t * 6.1) * 0.25;
    if (L.rain) { const u = L.rain.material.uniforms; u.uTime.value = still ? 0 : t; u.uCam.value.copy(camera.position); }
    for (let i = 0; i < L.mists.length; i++) {
      const m = L.mists[i]; m.m.position.set(x, ground * 0.3 + m.y, z);
      // keep the pattern anchored to the world while the sheet follows you, plus a slow drift
      m.tex.offset.set((x / 150) * 3 + (still ? 0 : t * 0.006 * (i ? -1 : 1)), (-z / 150) * 3 + (still ? 0 : t * 0.004));
    }

    if (resPending) flushRes();
    renderer.render(scene, camera);

    // dynamic resolution: drop a step after ~30 slow frames, climb back after ~3 s of fast ones
    const ms = dt * 1000;
    if (ms > 0 && ms < 250) {
      ema = ema * 0.95 + ms * 0.05;
      // 60 fps is the target. A 30 Hz panel and a GPU stuck at 30 fps look the same from here,
      // so the probe below tells them apart: if a lower resolution does not help, it goes back up.
      const target = 16.7;
      if (resHold > 0) resHold -= dt;
      if (probe > 0 && --probe === 0 && ema > probeMs * 0.88) {
        // the lower resolution did not make frames faster (the CPU or the compositor is the limit):
        // go back up and stop trying for a while, rather than blurring the picture for nothing
        resIdx--; resHold = 45; slow = 0; fast = 0; ema = target; applyRes();
      } else if (probe === 0) {
        if (ema > target * 1.3) { slow++; fast = 0; } else if (ema < target * 1.08) { fast++; slow = 0; } else { slow = 0; fast = 0; }
        if (slow > 30 && resIdx < RES_STEPS.length - 1 && resHold <= 0) { probeMs = ema; resIdx++; slow = 0; probe = 75; applyRes(); }
        else if (fast > 240 && resIdx > floorIdx) { resIdx--; fast = 0; ema = target * 1.15; applyRes(); }
      }
    }
  }

  resize(); fitFov();
  return {
    load,
    render,
    resize() { resize(); fitFov(); fov = baseFov; camera.fov = fov; camera.updateProjectionMatrix(); },
    /** a jolt (trap, being spotted) */
    kick(k = 0.5) { if (L) L.kickT = k; },
    stats() { const i = renderer.info.render; return { calls: i.calls, triangles: i.triangles, scale: RES_STEPS[resIdx], ratio: renderer.getPixelRatio(), buffer: [canvas.width, canvas.height], ms: Math.round(ema * 10) / 10, fov: Math.round(fov) }; },
    /** after the GPU dropped the context and gave it back; from the second time on, start one step lighter */
    restored() { losses++; if (losses > 1) floorIdx = Math.min(RES_STEPS.length - 2, floorIdx + 1); resIdx = Math.max(resIdx, floorIdx); resHold = 20; slow = fast = probe = 0; resPending = true; },
    /** dev only: force a resolution step */
    setStep(i) { resIdx = Math.max(0, Math.min(RES_STEPS.length - 1, i)); probe = 0; resHold = 60; applyRes(); },
    /** where the next gap is, for tests */
    gap() { return world ? nextGap(world) : null; },
    dispose() {
      unload();
      shared.forEach((d) => d.dispose());
      // hand the GPU memory back now rather than at the next garbage collection (many players in a row on one screen)
      try { renderer.forceContextLoss(); } catch { /* already lost */ }
      renderer.dispose();
    },
  };
}
