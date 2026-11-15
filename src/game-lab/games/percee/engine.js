/*
 * La Percée — engine (no React). Seeded world generation, simulation and canvas rendering.
 *
 * History: before the Roman lines were finished, Vercingétorix sent his cavalry out by night
 * through the gaps in the works (Caesar, BG VII.71). Each "night" the ring is more complete.
 *
 * Everything that varies is generated from (seed, night) with a deterministic PRNG, so a seed
 * can be shared and everyone plays the same map (like Minecraft world seeds).
 */

/* ── seeded randomness ─────────────────────────────────────────── */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
export function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── geometry helpers ──────────────────────────────────────────── */
const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = ((a - b) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return d; };
function segX(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const d = (p4y - p3y) * (p2x - p1x) - (p4x - p3x) * (p2y - p1y);
  if (d === 0) return false;
  const ua = ((p4x - p3x) * (p1y - p3y) - (p4y - p3y) * (p1x - p3x)) / d;
  const ub = ((p2x - p1x) * (p1y - p3y) - (p2y - p1y) * (p1x - p3x)) / d;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

export const WORLD = { w: 1800, h: 1240 };
export const NIGHTS = 5;

/* ── world generation ──────────────────────────────────────────── */
function makeRing(rnd, cx, cy, rx, ry, gaps, gapWidth) {
  const p = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const N = 144;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const k = 1 + 0.06 * Math.sin(3 * a + p[0]) + 0.04 * Math.sin(5 * a + p[1]) + 0.02 * Math.sin(9 * a + p[2]);
    pts.push({ a, x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  // gaps: unfinished stretches of wall
  const gapAngles = [];
  const base = rnd() * TAU;
  for (let g = 0; g < gaps; g++) gapAngles.push(base + (g / gaps) * TAU + (rnd() - 0.5) * (TAU / gaps) * 0.6);
  const inGap = (a) => gapAngles.some((g) => Math.abs(angDiff(a, g)) < gapWidth / 2);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const A = pts[i]; const B = pts[(i + 1) % N];
    const mid = (A.a + (B.a || TAU)) / 2;
    if (!inGap(mid)) segs.push([A.x, A.y, B.x, B.y]);
  }
  const radiusAt = (a) => {
    const i = Math.round(((a % TAU) + TAU) % TAU / TAU * N) % N;
    return pts[i];
  };
  return { pts, segs, gapAngles, gapWidth, inGap, radiusAt, rx, ry };
}

export function generate(seedStr, night) {
  const rnd = mulberry32(hashSeed(`${seedStr}#${night}`));
  const cx = WORLD.w / 2; const cy = WORLD.h / 2;
  const n = night; // 1..5
  const inner = makeRing(rnd, cx, cy, 330, 235, Math.max(1, 5 - n), 0.42 - n * 0.055);
  const outer = makeRing(rnd, cx, cy, 590, 440, Math.max(1, 6 - n), 0.36 - n * 0.045);

  // towers on both rings (never inside a gap), sweeping torch cones
  const towers = [];
  const addTowers = (ring, count, facingOut) => {
    let placed = 0; let tries = 0;
    while (placed < count && tries < 400) {
      tries++;
      const a = rnd() * TAU;
      if (ring.inGap(a)) continue;
      const p = ring.radiusAt(a);
      if (towers.some((t) => dist(t.x, t.y, p.x, p.y) < 120)) continue;
      const normal = Math.atan2(p.y - cy, p.x - cx) + (facingOut ? 0 : Math.PI);
      towers.push({
        x: p.x, y: p.y, base: normal, sweep: 0.6 + rnd() * 0.6,
        speed: 0.35 + rnd() * 0.45 + n * 0.06, phase: rnd() * TAU,
        range: 150 + n * 10, half: 0.36, dir: normal,
      });
      placed++;
    }
  };
  addTowers(inner, 5 + n * 2, false);
  addTowers(outer, 5 + n * 2, true);

  // patrols walking an arc of the ring between the walls
  const patrols = [];
  for (let i = 0; i < n; i++) {
    const a0 = rnd() * TAU; const span = 0.5 + rnd() * 0.5;
    patrols.push({ a0, span, t: rnd() * TAU, speed: 0.25 + rnd() * 0.2, rx: 460, ry: 338, x: 0, y: 0, dir: 0, range: 95, half: 0.6 });
  }

  // forests (cover), rivers (slow), lilia trap fields (hidden pits)
  const forests = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU; const r = 0.35 + rnd() * 0.75;
    const x = cx + Math.cos(a) * 640 * r; const y = cy + Math.sin(a) * 480 * r;
    if (dist(x, y, cx, cy) < 200) continue;
    const blobs = [];
    const k = 3 + Math.floor(rnd() * 4);
    for (let j = 0; j < k; j++) blobs.push({ x: x + (rnd() - 0.5) * 90, y: y + (rnd() - 0.5) * 70, r: 30 + rnd() * 34 });
    forests.push(blobs);
  }
  const rivers = [];
  for (const yy of [cy - 150 - rnd() * 40, cy + 150 + rnd() * 40]) {
    const pts = []; const ph = rnd() * TAU; const amp = 30 + rnd() * 30;
    for (let x = -20; x <= WORLD.w + 20; x += 40) pts.push([x, yy + Math.sin(x / 160 + ph) * amp]);
    rivers.push(pts);
  }
  const traps = [];
  const fields = 5 + n * 3;
  for (let f = 0; f < fields; f++) {
    const a = rnd() * TAU;
    const pi = inner.radiusAt(a); const po = outer.radiusAt(a);
    const t = 0.25 + rnd() * 0.5;
    const fx = pi.x + (po.x - pi.x) * t; const fy = pi.y + (po.y - pi.y) * t;
    // quincunx, as Caesar describes the lilia (BG VII.73)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      traps.push({ x: fx + (c - 1.5) * 18 + (r % 2) * 9, y: fy + (r - 1) * 16, seen: false, sprung: false });
    }
  }

  const startA = rnd() * TAU;
  const player = { x: cx + Math.cos(startA) * 150, y: cy + Math.sin(startA) * 100, vx: 0, vy: 0, stam: 100, stun: 0, face: startA };
  const grass = [];
  for (let i = 0; i < 900; i++) grass.push([rnd() * WORLD.w, rnd() * WORLD.h, rnd()]);

  return { seed: seedStr, night: n, cx, cy, inner, outer, towers, patrols, forests, rivers, traps, player, grass, alarm: 0, time: 0, state: 'play', heard: 0 };
}

/* ── simulation ────────────────────────────────────────────────── */
function inForest(w, x, y) {
  return w.forests.some((blobs) => blobs.some((b) => dist(x, y, b.x, b.y) < b.r));
}
function inRiver(w, x, y) {
  return w.rivers.some((pts) => pts.some((p, i) => i > 0 && distToSeg(x, y, pts[i - 1][0], pts[i - 1][1], p[0], p[1]) < 14));
}
function blocked(w, ax, ay, bx, by) {
  const hit = (segs) => segs.some((s) => segX(ax, ay, bx, by, s[0], s[1], s[2], s[3]));
  return hit(w.inner.segs) || hit(w.outer.segs);
}

/**
 * Advance the world by dt seconds. input = { x, y (−1..1), sprint }.
 * Returns events: [{ type: 'trap' | 'caught' | 'escaped' }]
 */
export function step(w, input, dt) {
  const ev = [];
  if (w.state !== 'play') return ev;
  w.time += dt;
  const p = w.player;

  // towers & patrols move
  for (const t of w.towers) t.dir = t.base + Math.sin(w.time * t.speed + t.phase) * t.sweep;
  for (const q of w.patrols) {
    const a = q.a0 + Math.sin(w.time * q.speed + q.t) * q.span;
    const nx = w.cx + Math.cos(a) * q.rx; const ny = w.cy + Math.sin(a) * q.ry;
    q.dir = Math.atan2(ny - q.y, nx - q.x) || q.dir;
    q.x = nx; q.y = ny;
  }

  // player movement
  const forest = inForest(w, p.x, p.y);
  const water = inRiver(w, p.x, p.y);
  let len = Math.hypot(input.x, input.y);
  const ix = len > 1 ? input.x / len : input.x; const iy = len > 1 ? input.y / len : input.y;
  len = Math.min(1, len);
  const galloping = input.sprint && p.stam > 1 && len > 0.2;
  p.stam = Math.max(0, Math.min(100, p.stam + (galloping ? -32 : 18) * dt));
  let speed = galloping ? 200 : 125;
  if (forest) speed *= 0.72;
  if (water) speed *= 0.5;
  if (p.stun > 0) { p.stun -= dt; speed *= 0.25; }
  const nx = Math.max(10, Math.min(WORLD.w - 10, p.x + ix * speed * dt));
  const ny = Math.max(10, Math.min(WORLD.h - 10, p.y + iy * speed * dt));
  if (len > 0.15) p.face = Math.atan2(iy, ix);
  if (!blocked(w, p.x, p.y, nx, ny)) { p.x = nx; p.y = ny; }
  else if (!blocked(w, p.x, p.y, nx, p.y)) p.x = nx;
  else if (!blocked(w, p.x, p.y, p.x, ny)) p.y = ny;

  // traps: revealed when close, sprung when stepped on
  for (const tr of w.traps) {
    const d = dist(p.x, p.y, tr.x, tr.y);
    if (d < 46) tr.seen = true;
    if (!tr.sprung && d < 7) {
      tr.sprung = true; p.stun = 1.4; w.alarm = Math.min(100, w.alarm + 22); ev.push({ type: 'trap' });
    }
  }

  // detection
  let seen = 0;
  const watchers = [...w.towers, ...w.patrols];
  for (const o of watchers) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > o.range) continue;
    const a = Math.atan2(p.y - o.y, p.x - o.x);
    if (Math.abs(angDiff(a, o.dir)) > o.half) continue;
    if (forest && d > 55) continue;
    seen = Math.max(seen, 1 - d / o.range + 0.35);
  }
  // galloping is loud
  const noise = galloping ? 130 : 0;
  let heard = 0;
  if (noise) for (const o of watchers) if (dist(p.x, p.y, o.x, o.y) < noise) heard = 1;
  w.heard = heard;
  w.nearest = Math.min(...watchers.map((o) => dist(p.x, p.y, o.x, o.y)));
  w.seen = seen;
  if (seen > 0) w.alarm += seen * 70 * dt;
  else if (heard) w.alarm += 14 * dt;
  else w.alarm -= 16 * dt;
  w.alarm = Math.max(0, Math.min(100, w.alarm));

  if (w.alarm >= 100) { w.state = 'caught'; ev.push({ type: 'caught' }); }

  // escape: well outside the outer ring
  const ro = w.outer.radiusAt(Math.atan2(p.y - w.cy, p.x - w.cx));
  if (dist(p.x, p.y, w.cx, w.cy) > dist(ro.x, ro.y, w.cx, w.cy) + 60) { w.state = 'escaped'; ev.push({ type: 'escaped' }); }
  return ev;
}

/* ── rendering ─────────────────────────────────────────────────── */
let lightCanvas = null;

export function render(ctx, w, view, colors, opts = {}) {
  const { width: W, height: H } = view;
  const scale = view.scale;
  const p = w.player;
  const camX = Math.max(W / 2 / scale, Math.min(WORLD.w - W / 2 / scale, p.x));
  const camY = Math.max(H / 2 / scale, Math.min(WORLD.h - H / 2 / scale, p.y));
  const toS = (x, y) => [(x - camX) * scale + W / 2, (y - camY) * scale + H / 2];

  // dread shake (never under reduced motion)
  const shake = opts.horror && !opts.still && w.alarm > 55 ? (w.alarm - 55) / 45 * 5 : 0;
  ctx.save();
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  // grass speckle
  ctx.fillStyle = colors.speck;
  for (const [x, y, r] of w.grass) ctx.fillRect(x, y, 1.6 + r * 1.6, 1.6);

  // rivers
  ctx.strokeStyle = colors.river; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pts of w.rivers) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }

  // forests
  for (const blobs of w.forests) for (const b of blobs) {
    ctx.fillStyle = colors.forest; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = colors.forestDot;
  for (const blobs of w.forests) for (const b of blobs) {
    for (let k = 0; k < 6; k++) { const a = k * 1.1 + b.r; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * b.r * 0.55, b.y + Math.sin(a) * b.r * 0.55, 5, 0, TAU); ctx.fill(); }
  }

  // town (Alésia) on its plateau
  ctx.fillStyle = colors.plateau; ctx.strokeStyle = colors.gaul; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w.cx, w.cy, 160, 100, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // torch cones (drawn under walls)
  for (const t of [...w.towers, ...w.patrols]) {
    const g = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, t.range);
    g.addColorStop(0, colors.coneIn); g.addColorStop(1, colors.coneOut);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.range, t.dir - t.half, t.dir + t.half); ctx.closePath(); ctx.fill();
  }

  // walls with palisade ticks
  const drawRing = (ring, width) => {
    ctx.strokeStyle = colors.wall; ctx.lineWidth = width; ctx.lineCap = 'butt';
    for (const s of ring.segs) { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }
  };
  drawRing(w.outer, 7); drawRing(w.inner, 6);

  // traps: only those you have spotted
  for (const tr of w.traps) {
    if (!tr.seen && !opts.reveal) continue;
    ctx.strokeStyle = tr.sprung ? colors.rome : colors.trap; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, 5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tr.x - 3, tr.y); ctx.lineTo(tr.x + 3, tr.y); ctx.moveTo(tr.x, tr.y - 3); ctx.lineTo(tr.x, tr.y + 3); ctx.stroke();
  }

  // towers (Rome = squares) and patrols
  for (const t of w.towers) { ctx.fillStyle = colors.rome; ctx.fillRect(t.x - 7, t.y - 7, 14, 14); ctx.strokeStyle = colors.romeLight; ctx.lineWidth = 1.5; ctx.strokeRect(t.x - 7, t.y - 7, 14, 14); }
  for (const q of w.patrols) { ctx.fillStyle = colors.romeLight; ctx.fillRect(q.x - 4, q.y - 4, 8, 8); }

  // the rider (Gaul = circle)
  ctx.fillStyle = colors.gaul;
  ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = colors.text; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // darkness with holes: moonlight around the rider, torchlight at towers
  if (!lightCanvas) lightCanvas = document.createElement('canvas');
  if (lightCanvas.width !== W || lightCanvas.height !== H) { lightCanvas.width = W; lightCanvas.height = H; }
  const l = lightCanvas.getContext('2d');
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, W, H);
  l.fillStyle = colors.night; l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const [sx, sy] = toS(x, y);
    const g = l.createRadialGradient(sx, sy, 0, sx, sy, r * scale);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(sx, sy, r * scale, 0, TAU); l.fill();
  };
  if (opts.horror) {
    // Cry of Fear lantern: a small halo + a cone where you ride
    hole(p.x, p.y, 55, 0.9);
    const [px, py] = toS(p.x, p.y);
    const R = 210 * scale; const half = 0.5;
    const g = l.createRadialGradient(px, py, 0, px, py, R);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.7, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g;
    l.beginPath(); l.moveTo(px, py); l.arc(px, py, R, p.face - half, p.face + half); l.closePath(); l.fill();
  } else {
    hole(p.x, p.y, 135, 0.95);
  }
  for (const t of w.towers) hole(t.x, t.y, 70, 0.8);
  hole(w.cx, w.cy, 150, 0.45);
  ctx.drawImage(lightCanvas, 0, 0);

  if (opts.horror) horrorPass(ctx, w, W, H, opts);

  // alarm vignette
  if (w.alarm > 5) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(179,38,30,${(w.alarm / 100) * 0.55})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // minimap (walls + gaps + you; never the traps)
  const mw = Math.min(150, W * 0.28); const mh = mw * (WORLD.h / WORLD.w);
  const mx = W - mw - 10; const my = 10; const ms = mw / WORLD.w;
  ctx.fillStyle = 'rgba(18,10,6,0.78)'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = colors.wall; ctx.lineWidth = 1.5;
  for (const ring of [w.inner, w.outer]) for (const s of ring.segs) { ctx.beginPath(); ctx.moveTo(mx + s[0] * ms, my + s[1] * ms); ctx.lineTo(mx + s[2] * ms, my + s[3] * ms); ctx.stroke(); }
  ctx.fillStyle = colors.gaul; ctx.beginPath(); ctx.arc(mx + p.x * ms, my + p.y * ms, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(247,236,214,0.25)'; ctx.strokeRect(mx, my, mw, mh);
}

/* ── Cry of Fear pass: film grain, throbbing fear vignette, chromatic edges ── */
let grain = null;
function makeGrain() {
  const c = document.createElement('canvas'); c.width = 192; c.height = 192;
  const g = c.getContext('2d'); const img = g.createImageData(192, 192);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = Math.random() * 70;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function horrorPass(ctx, w, W, H, opts) {
  if (!grain) grain = makeGrain();
  // grain, re-offset every frame
  ctx.save();
  ctx.globalAlpha = 0.22;
  const ox = opts.still ? 0 : Math.random() * 192; const oy = opts.still ? 0 : Math.random() * 192;
  for (let x = -ox; x < W; x += 192) for (let y = -oy; y < H; y += 192) ctx.drawImage(grain, x, y);
  ctx.restore();
  // heavy vignette that throbs with the heartbeat
  const fear = w.alarm / 100;
  const beat = opts.still ? 0 : Math.max(0, Math.sin(w.time * (4 + fear * 7))) ** 8 * fear;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.22 - beat * 0.05), W / 2, H / 2, Math.max(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 + fear * 0.3})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // chromatic split at the edges when afraid
  if (fear > 0.4) {
    const a = (fear - 0.4) * 0.5;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const r = ctx.createLinearGradient(0, 0, W * 0.18, 0); r.addColorStop(0, `rgba(240,40,40,${a})`); r.addColorStop(1, 'rgba(240,40,40,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W * 0.18, H);
    const c = ctx.createLinearGradient(W, 0, W * 0.82, 0); c.addColorStop(0, `rgba(40,200,220,${a})`); c.addColorStop(1, 'rgba(40,200,220,0)');
    ctx.fillStyle = c; ctx.fillRect(W * 0.82, 0, W * 0.18, H);
    ctx.restore();
  }
  // scanline flicker
  if (!opts.still && Math.random() < 0.04 + fear * 0.1) {
    ctx.fillStyle = 'rgba(247,236,214,0.05)';
    ctx.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6);
  }
}
