/*
 * La Percée — first-person 3D view (three.js), built from the same seeded world as the 2D map.
 * 1 world unit = 5 cm. The lantern is a spotlight on the camera (Cry of Fear); tower torches are
 * real point lights for the nearest towers and glowing cones for the sweep you must avoid.
 */
import * as THREE from 'three';
import { WORLD } from './engine';

const S = 0.05;
const EYE = 2.3; // a rider on horseback

export function createFP(canvas, w, colors) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(coarse ? 1.25 : 1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040302);
  scene.fog = new THREE.FogExp2(0x040302, 0.055);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);

  const C = (v) => new THREE.Color(v);
  const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // moon + sky
  const hemi = new THREE.HemisphereLight(0x6a7890, 0x120a06, 0.35); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fa3c0, 0.35); moon.position.set(-30, 40, -20); scene.add(moon);
  const starGeo = keep(new THREE.BufferGeometry());
  const stars = new Float32Array(900);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2; const e = 0.15 + Math.random() * 1.2; const r = 100;
    stars.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starMesh = new THREE.Points(starGeo, keep(new THREE.PointsMaterial({ color: 0xf7ecd6, size: 0.35, fog: false })));
  scene.add(starMesh);

  // ground with a little relief
  const gw = WORLD.w * S; const gh = WORLD.h * S;
  const groundGeo = keep(new THREE.PlaneGeometry(gw + 40, gh + 40, 70, 50));
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, (Math.sin(gp.getX(i) * 0.3) + Math.cos(gp.getZ(i) * 0.27)) * 0.08 + (Math.random() - 0.5) * 0.08);
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, keep(flat(C(colors.ground))));
  ground.position.set(gw / 2, -0.05, gh / 2);
  scene.add(ground);

  // town on its plateau, with a few huts
  const plateau = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1.15, 0.6, 18)), keep(flat(0x24452a)));
  plateau.scale.set(160 * S, 1, 100 * S); plateau.position.set(w.cx * S, -0.2, w.cy * S);
  scene.add(plateau);
  const hutMat = keep(flat(0x5a3a24)); const roofMat = keep(flat(0x3d2617));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3; const r = 0.72 + (i % 3) * 0.08;
    const hut = new THREE.Group();
    const wall = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 7)), hutMat); wall.position.y = 0.55;
    const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(0.95, 1.2, 7)), roofMat); roof.position.y = 1.7;
    hut.add(wall, roof);
    hut.position.set((w.cx + Math.cos(a) * 140 * r) * S, 0.1, (w.cy + Math.sin(a) * 85 * r) * S);
    scene.add(hut);
  }

  // walls: instanced palisade sections + posts
  const segs = [...w.inner.segs, ...w.outer.segs];
  const wallGeo = keep(new THREE.BoxGeometry(1, 2.6, 0.28));
  const wallMesh = new THREE.InstancedMesh(wallGeo, keep(flat(0x6b3a22)), segs.length);
  const postGeo = keep(new THREE.CylinderGeometry(0.16, 0.2, 3.3, 5));
  const postMesh = new THREE.InstancedMesh(postGeo, keep(flat(0x4a2716)), segs.length);
  const dummy = new THREE.Object3D();
  segs.forEach(([x1, y1, x2, y2], i) => {
    const dx = (x2 - x1) * S; const dz = (y2 - y1) * S; const len = Math.hypot(dx, dz);
    dummy.position.set((x1 + x2) / 2 * S, 1.3, (y1 + y2) / 2 * S);
    dummy.rotation.set(0, -Math.atan2(dz, dx), 0); dummy.scale.set(len + 0.05, 1, 1);
    dummy.updateMatrix(); wallMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x1 * S, 1.65, y1 * S); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); postMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(wallMesh, postMesh);

  // towers + torch cones
  const towerMat = keep(flat(C(colors.rome)));
  const torchMat = keep(new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  const coneMat = keep(new THREE.MeshBasicMaterial({ color: 0xf5b26b, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const towers = w.towers.map((t) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(1.5, 5.5, 1.5)), towerMat); body.position.y = 2.75;
    const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 0.25, 2.2)), keep(flat(0x5a2a1a))); deck.position.y = 5.6;
    const torch = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.22, 0)), torchMat); torch.position.y = 6.1;
    g.add(body, deck, torch);
    g.position.set(t.x * S, 0, t.y * S);
    const len = t.range * S; const rad = Math.tan(t.half) * len;
    const coneGeo = keep(new THREE.ConeGeometry(rad, len, 18, 1, true));
    coneGeo.translate(0, -len / 2, 0); coneGeo.rotateZ(Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(t.x * S, 5.8, t.y * S); cone.rotation.order = 'YZX'; cone.rotation.z = -0.32;
    scene.add(g, cone);
    return { t, cone, torch };
  });
  const torchLights = Array.from({ length: 4 }, () => {
    const l = new THREE.PointLight(0xffa850, 40, 16, 1.6); scene.add(l); return l;
  });

  // patrols
  const soldierMat = keep(flat(C(colors.romeLight)));
  const patrols = w.patrols.map((q) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(0.6, 1.3, 0.4)), soldierMat); body.position.y = 0.9;
    const head = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.22, 0)), keep(flat(0x8a5a3a))); head.position.y = 1.75;
    const shield = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 1, 0.7)), towerMat); shield.position.set(0.35, 0.9, 0);
    const lamp = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.12, 0)), torchMat); lamp.position.set(0.3, 1.5, 0.3);
    g.add(body, head, shield, lamp);
    const len = q.range * S; const rad = Math.tan(q.half) * len;
    const coneGeo = keep(new THREE.ConeGeometry(rad, len, 14, 1, true));
    coneGeo.translate(0, -len / 2, 0); coneGeo.rotateZ(Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, coneMat); cone.rotation.order = 'YZX'; cone.rotation.z = -0.15;
    scene.add(g, cone);
    return { q, g, cone };
  });

  // forests: instanced low-poly trees
  const treeSpots = [];
  for (const blobs of w.forests) for (const b of blobs) {
    const n = Math.max(3, Math.round(b.r / 9));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2; const r = Math.sqrt(Math.random()) * b.r * 0.85;
      treeSpots.push([b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.8 + Math.random() * 0.6]);
    }
  }
  const treeMesh = new THREE.InstancedMesh(keep(new THREE.ConeGeometry(1.1, 4.2, 6)), keep(flat(0x1c2a16)), treeSpots.length);
  const trunkMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5)), keep(flat(0x3d2617)), treeSpots.length);
  treeSpots.forEach(([x, y, sc], i) => {
    dummy.rotation.set(0, Math.random() * 3, 0);
    dummy.position.set(x * S, 2.6 * sc, y * S); dummy.scale.set(sc, sc, sc); dummy.updateMatrix(); treeMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x * S, 0.6, y * S); dummy.updateMatrix(); trunkMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(treeMesh, trunkMesh);

  // rivers: flat glossy strips
  const waterMat = keep(new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.15, metalness: 0.6 }));
  for (const pts of w.rivers) {
    const pos = []; const idx = [];
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)]; const [px, py] = pts[Math.max(i - 1, 0)];
      const dx = nx - px; const dy = ny - py; const l = Math.hypot(dx, dy) || 1;
      const ox = (-dy / l) * 13; const oy = (dx / l) * 13;
      pos.push((x + ox) * S, 0.03, (y + oy) * S, (x - ox) * S, 0.03, (y - oy) * S);
      if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    });
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, waterMat));
  }

  // lilia: hidden spikes, shown once spotted
  const trapMesh = new THREE.InstancedMesh(keep(new THREE.ConeGeometry(0.12, 0.6, 4)), keep(flat(0xc9a050, { emissive: 0x3a2a08 })), w.traps.length);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  w.traps.forEach((_, i) => trapMesh.setMatrixAt(i, zero));
  scene.add(trapMesh);
  const shown = new Set();

  // the rider's lantern
  const lantern = new THREE.SpotLight(0xffd59a, 70, 26, 0.48, 0.65, 1.4);
  const lanternTarget = new THREE.Object3D(); scene.add(lanternTarget); lantern.target = lanternTarget;
  const halo = new THREE.PointLight(0xffc98a, 6, 6, 1.5);
  scene.add(lantern, halo);

  // hidden Gaulish riders: a faint green glow in the woods
  const riderMat = keep(flat(C(colors.gaul), { emissive: C(colors.gaul), emissiveIntensity: 0.6 }));
  const riders = w.riders.map((r) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(keep(new THREE.ConeGeometry(0.45, 1.6, 6)), riderMat); body.position.y = 0.8;
    const head = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.22, 0)), riderMat); head.position.y = 1.8;
    g.add(body, head); g.position.set(r.x * S, 0, r.y * S); scene.add(g);
    return { r, g };
  });

  // rain: streaks that fall around the rider
  let rain = null;
  if (w.weather === 'rain') {
    const N = 900; const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 40; const y = Math.random() * 14; const z = (Math.random() - 0.5) * 40;
      pos.set([x, y, z, x - 0.05, y - 0.55, z], i * 6);
    }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(geo, keep(new THREE.LineBasicMaterial({ color: 0xb8c4d0, transparent: true, opacity: 0.35 })));
    scene.add(rain);
  }
  const baseFog = w.weather === 'fog' ? 0.09 : w.weather === 'rain' ? 0.065 : 0.05;

  // the horse you ride: neck, mane and ears at the bottom of the view (attached to the camera)
  const horse = new THREE.Group();
  const coat = keep(flat(0x3a2414)); const maneMat = keep(flat(0x140c07));
  const neck = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.26, 1.1, 6)), coat);
  neck.rotation.x = -1.15; neck.position.set(0, -0.62, -0.75);
  const head = new THREE.Mesh(keep(new THREE.BoxGeometry(0.22, 0.24, 0.62)), coat);
  head.rotation.x = 0.35; head.position.set(0, -0.48, -1.3);
  const mane = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.12, 0.95)), maneMat);
  mane.rotation.x = -0.45; mane.position.set(0, -0.44, -0.78);
  const earGeo = keep(new THREE.ConeGeometry(0.05, 0.16, 4));
  const earL = new THREE.Mesh(earGeo, coat); earL.position.set(-0.07, -0.3, -1.08); earL.rotation.x = -0.3;
  const earR = earL.clone(); earR.position.x = 0.07;
  horse.add(neck, head, mane, earL, earR);
  camera.add(horse); scene.add(camera);

  let shakeT = 0;
  const resize = () => {
    const wpx = canvas.clientWidth; const hpx = canvas.clientHeight;
    renderer.setSize(wpx, hpx, false); camera.aspect = wpx / hpx; camera.updateProjectionMatrix();
  };
  resize();

  return {
    resize,
    render(dt, heading, opts = {}) {
      const p = w.player;
      const x = p.x * S; const z = p.y * S;
      shakeT += dt;
      const fear = w.alarm / 100;
      const bob = opts.moving && !opts.still ? Math.sin(shakeT * (opts.gallop ? 16 : 9)) * (opts.gallop ? 0.09 : 0.04) : 0;
      const jit = !opts.still && fear > 0.55 ? (fear - 0.55) * 0.12 : 0;
      camera.position.set(x + (Math.random() - 0.5) * jit, EYE + bob + (Math.random() - 0.5) * jit, z + (Math.random() - 0.5) * jit);
      const lx = Math.cos(heading); const lz = Math.sin(heading);
      camera.lookAt(x + lx * 10, EYE - 0.6, z + lz * 10);
      // horse head nods with the gait; ears prick up when the alarm rises
      horse.position.y = opts.still ? 0 : Math.sin(shakeT * (opts.gallop ? 16 : 9)) * (opts.moving ? 0.035 : 0.006);
      earL.rotation.z = earR.rotation.z = 0; earL.rotation.x = earR.rotation.x = -0.3 - fear * 0.5;
      lantern.position.set(x + lx * 0.3, EYE - 0.3, z + lz * 0.3);
      lanternTarget.position.set(x + lx * 12, 0, z + lz * 12);
      lantern.intensity = 70 * (0.92 + Math.random() * 0.08);
      halo.position.set(x, 1.6, z);
      starMesh.position.set(x, 0, z);

      // tower cones sweep; nearest towers get real flickering light
      towers.forEach(({ t, cone }) => { cone.rotation.y = -t.dir; });
      const near = towers.map((o) => ({ o, d: (o.t.x - p.x) ** 2 + (o.t.y - p.y) ** 2 })).sort((a, b) => a.d - b.d);
      torchLights.forEach((l, i) => {
        const n = near[i]; if (!n) { l.intensity = 0; return; }
        l.position.set(n.o.t.x * S, 6.2, n.o.t.y * S); l.intensity = 34 + Math.random() * 10;
      });
      patrols.forEach(({ q, g, cone }) => {
        g.position.set(q.x * S, 0, q.y * S); g.rotation.y = -q.dir;
        cone.position.set(q.x * S, 1.5, q.y * S); cone.rotation.y = -q.dir;
      });
      // reveal spotted traps
      w.traps.forEach((tr, i) => {
        if (tr.seen && !shown.has(i)) {
          shown.add(i); dummy.position.set(tr.x * S, 0.25, tr.y * S); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
          dummy.updateMatrix(); trapMesh.setMatrixAt(i, dummy.matrix); trapMesh.instanceMatrix.needsUpdate = true;
        }
      });
      scene.fog.density = baseFog + fear * 0.03;
      riders.forEach(({ r, g }) => { g.visible = !r.rallied; });
      if (rain) {
        rain.position.set(x, 0, z);
        const a = rain.geometry.attributes.position;
        for (let i = 0; i < a.count; i += 2) {
          let y0 = a.getY(i) - dt * 18;
          if (y0 < 0) y0 += 14;
          a.setY(i, y0); a.setY(i + 1, y0 - 0.55);
        }
        a.needsUpdate = true;
      }
      // lightning lights up the whole valley for an instant
      hemi.intensity = 0.35 + w.flash * 2.6;
      scene.fog.color.setRGB(0.016 + w.flash * 0.25, 0.012 + w.flash * 0.26, 0.008 + w.flash * 0.3);
      scene.background.copy(scene.fog.color);
      renderer.render(scene, camera);
    },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      [wallMesh, postMesh, treeMesh, trunkMesh, trapMesh].forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}

/** small 2D minimap for the first-person view */
export function drawMinimap(ctx, w, heading, colors) {
  const W = ctx.canvas.width; const H = ctx.canvas.height; const s = W / WORLD.w;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(18,10,6,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = colors.wall; ctx.lineWidth = 1.5;
  for (const ring of [w.inner, w.outer]) for (const sg of ring.segs) { ctx.beginPath(); ctx.moveTo(sg[0] * s, sg[1] * s); ctx.lineTo(sg[2] * s, sg[3] * s); ctx.stroke(); }
  const px = w.player.x * s; const py = w.player.y * s;
  ctx.strokeStyle = colors.gaul; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(heading) * 10, py + Math.sin(heading) * 10); ctx.stroke();
  ctx.fillStyle = colors.gaul; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
}
