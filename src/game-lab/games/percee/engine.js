/*
 * La Percée — engine (no React, no three.js). Seeded world generation, simulation, and the 2D map view.
 *
 * History: before the Roman lines were finished, Vercingétorix sent his cavalry out by night
 * through the gaps in the works (Caesar, BG VII.71). Each "night" the ring is more complete.
 *
 * Everything that varies is generated from (seed, night) with a deterministic PRNG, so a seed
 * can be shared and everyone plays the same map (like Minecraft world seeds).
 *
 * Units: 1 world unit ≈ 6 cm in the 3D view. The plane is (x → east, y → south); angles are
 * atan2(y, x), so a positive turn is clockwise on the map and "to the right" in first person.
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
export const angDiff = (a, b) => { let d = ((a - b) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
export const TOWN = { rx: 160, ry: 100 };

/* ── tuning: every number a tester may want to change lives here ─── */
export const TUNE = {
  walk: 110, gallop: 205,          // speed, units / s
  accel: 6.5,                      // how fast the horse reaches its speed (1/s)
  stamDrain: 28, stamRegen: 20,    // % / s  → about 3.5 s of gallop
  stamDelay: 1.0,                  // s before the horse gets its breath back
  stamMin: 22,                     // % needed to gallop again once winded
  fillNear: 125, fillFar: 38,      // detection meter, % / s (0.8 s close, ~2.6 s at the edge of a cone)
  gallopSeen: 1.25,                // a galloping rider is easier to see
  firstGrace: 1.2, graceRate: 0.35, // first sighting of the night fills slowly for this long
  hold: 0.5,                       // s after leaving a cone before the meter drops
  decay: 13, decayHidden: 24,      // % / s (faster under trees and in town)
  suspectAt: 50,                   // "suspicious": cue, last-seen marker, cones follow you
  track: 0.9,                      // rad / s, how fast a suspicious sentry follows you
  turn: 2.3,                       // rad / s, how fast a sentry turns to a noise
  noiseClear: 150, noiseRain: 95,  // gallop is heard this far (rain covers hooves)
  noiseFill: 13, noiseCap: 62,     // noise alone never gets you caught…
  noiseLook: 35,                   // …but above this the sentries turn toward it
  trapStun: 1.2, trapAlarm: 18,
  stones: 2, stoneCooldown: 4, stoneHear: 170, investigate: 4,
  stoneMin: 90, stoneMax: 260,
  wallPad: 9, treePad: 6,
  rallyDist: 26, forestSight: 55,
  limit: (n) => 190 - n * 10,      // seconds before dawn (180 … 140)
  dawnWarn: 40,                    // the sky starts to pale this long before dawn
  towerRange: (n) => 158 + n * 10,
  towers: (n) => (n === 1 ? 5 : 5 + n * 2),
  patrols: (n) => n + 1,
  trapFields: (n) => (n === 1 ? 5 : 5 + n * 3),
};

/* ── world generation ──────────────────────────────────────────── */
function makeRing(rnd, cx, cy, rx, ry, gaps, gapWidth) {
  const p = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const N = 144;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const k = 1 + 0.06 * Math.sin(3 * a + p[0]) + 0.04 * Math.sin(5 * a + p[1]) + 0.02 * Math.sin(9 * a + p[2]);
    const x = cx + Math.cos(a) * rx * k; const y = cy + Math.sin(a) * ry * k;
    pts.push({ a, x, y, r: dist(x, y, cx, cy) });
  }
  // gaps: unfinished stretches of wall
  const gapAngles = [];
  const base = rnd() * TAU;
  for (let g = 0; g < gaps; g++) gapAngles.push(base + (g / gaps) * TAU + (rnd() - 0.5) * (TAU / gaps) * 0.6);
  const inGap = (a) => gapAngles.some((g) => Math.abs(angDiff(a, g)) < gapWidth / 2);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const A = pts[i]; const B = pts[(i + 1) % N];
    const mid = (i + 0.5) / N * TAU;
    if (!inGap(mid)) segs.push([A.x, A.y, B.x, B.y, i]);
  }
  const radiusAt = (a) => pts[Math.round(((a % TAU) + TAU) % TAU / TAU * N) % N];
  const gapPts = gapAngles.map((a) => { const q = radiusAt(a); return { a, x: q.x, y: q.y }; });
  return { pts, segs, gapAngles, gapPts, gapWidth, inGap, radiusAt, rx, ry, N };
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
      const phase = rnd() * TAU; const sweep = 0.6 + rnd() * 0.6;
      towers.push({
        kind: 'tower', x: p.x, y: p.y, base: normal, sweep,
        speed: 0.35 + rnd() * 0.45 + n * 0.06, phase, clock: 0,
        range: TUNE.towerRange(n), half: 0.36, dir: normal + Math.sin(phase) * sweep,
        see: 0, inv: 0, ix: 0, iy: 0,
      });
      placed++;
    }
  };
  addTowers(inner, TUNE.towers(n), false);
  addTowers(outer, TUNE.towers(n), true);

  // patrols walking an arc between the two walls
  const patrols = [];
  for (let i = 0; i < TUNE.patrols(n); i++) {
    const a0 = rnd() * TAU; const span = 0.5 + rnd() * 0.5;
    patrols.push({
      kind: 'patrol', a0, span, t: rnd() * TAU, clock: 0, speed: 0.25 + rnd() * 0.2, rx: 460, ry: 338,
      x: cx + Math.cos(a0) * 460, y: cy + Math.sin(a0) * 338, dir: a0 + Math.PI / 2, range: 100, half: 0.6,
      see: 0, inv: 0, ix: 0, iy: 0, moving: 1,
    });
  }

  const rivers = [];
  for (const yy of [cy - 150 - rnd() * 40, cy + 150 + rnd() * 40]) {
    const pts = []; const ph = rnd() * TAU; const amp = 30 + rnd() * 30;
    for (let x = -20; x <= WORLD.w + 20; x += 40) pts.push([x, yy + Math.sin(x / 160 + ph) * amp]);
    rivers.push(pts);
  }
  const nearRiver = (x, y, pad) => rivers.some((pts) => pts.some((p, i) => i > 0 && distToSeg(x, y, pts[i - 1][0], pts[i - 1][1], p[0], p[1]) < pad));

  // three Gaulish riders hide in groves: one inside the first line, two between the lines.
  // They are always reachable (never beyond the outer wall, never under a tower).
  const riders = [];
  const pickSpot = (between) => {
    let best = null;
    for (let k = 0; k < 60; k++) {
      const a = rnd() * TAU; const pi = inner.radiusAt(a); const po = outer.radiusAt(a);
      const t = between ? 0.3 + rnd() * 0.4 : 0;
      const f = between ? 1 : 0.64 + rnd() * 0.2;
      const x = between ? pi.x + (po.x - pi.x) * t : cx + (pi.x - cx) * f;
      const y = between ? pi.y + (po.y - pi.y) * t : cy + (pi.y - cy) * f;
      best = { x, y, a };
      if (towers.some((tw) => dist(tw.x, tw.y, x, y) < 105)) continue;
      if (nearRiver(x, y, 34)) continue;
      if (riders.some((r) => Math.abs(angDiff(r.a, a)) < 1.1)) continue;
      break;
    }
    return best;
  };
  for (let i = 0; i < 3; i++) {
    const s = pickSpot(i > 0);
    riders.push({ x: s.x, y: s.y, a: s.a, hx: s.x, hy: s.y, face: rnd() * TAU, rallied: false, order: 0 });
  }

  // forests (cover): a grove around each rider, then scattered woods
  const forests = [];
  const grove = (x, y, k, spread) => {
    const blobs = [{ x, y, r: 34 + rnd() * 16 }];
    for (let j = 1; j < k; j++) blobs.push({ x: x + (rnd() - 0.5) * spread, y: y + (rnd() - 0.5) * spread * 0.8, r: 28 + rnd() * 30 });
    forests.push(blobs);
  };
  for (const r of riders) grove(r.x, r.y, 3 + Math.floor(rnd() * 2), 80);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU; const r = 0.35 + rnd() * 0.75;
    const x = cx + Math.cos(a) * 640 * r; const y = cy + Math.sin(a) * 480 * r;
    const k = 3 + Math.floor(rnd() * 4);
    if (dist(x, y, cx, cy) < 215) continue;
    grove(x, y, k, 95);
  }

  const traps = [];
  const fields = TUNE.trapFields(n);
  for (let f = 0; f < fields; f++) {
    const a = rnd() * TAU;
    const pi = inner.radiusAt(a); const po = outer.radiusAt(a);
    const t = 0.25 + rnd() * 0.5;
    const fx = pi.x + (po.x - pi.x) * t; const fy = pi.y + (po.y - pi.y) * t;
    // quincunx, as Caesar describes the lilia (BG VII.73)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = fx + (c - 1.5) * 18 + (r % 2) * 9; const y = fy + (r - 1) * 16;
      if (riders.some((q) => dist(q.x, q.y, x, y) < 52)) continue;
      traps.push({ x, y, seen: false, sprung: false });
    }
  }

  // weather from the seed: rain muffles hooves and dims torches, fog shortens every line of sight
  const roll = rnd();
  const weather = n === NIGHTS ? 'rain' : n === 1 ? 'clear' : roll < 0.4 ? 'rain' : roll < 0.65 ? 'fog' : 'clear';
  const sight = weather === 'rain' ? 0.85 : weather === 'fog' ? 0.75 : 1;
  for (const t of towers) t.range *= sight;
  for (const q of patrols) q.range *= sight;

  const startA = rnd() * TAU;
  const player = { x: cx + Math.cos(startA) * 60, y: cy + Math.sin(startA) * 36, vx: 0, vy: 0, stam: 100, stun: 0, face: startA, winded: false, rest: 0, speed: 0, galloping: false };
  const grass = [];
  for (let i = 0; i < 900; i++) grass.push([rnd() * WORLD.w, rnd() * WORLD.h, rnd()]);

  // trees: their own random stream, so the layout above never shifts. Trunks are solid.
  const trnd = mulberry32(hashSeed(`${seedStr}#${night}#trees`));
  const trees = [];
  for (const blobs of forests) for (const b of blobs) {
    const k = Math.max(3, Math.round(b.r / 7.5));
    for (let j = 0; j < k; j++) {
      const a = trnd() * TAU; const r = Math.sqrt(trnd()) * b.r * 0.9;
      const x = b.x + Math.cos(a) * r; const y = b.y + Math.sin(a) * r; const s = 0.8 + trnd() * 0.7; const rot = trnd() * TAU;
      if (riders.some((q) => dist(q.x, q.y, x, y) < 20)) continue;
      if (trees.some((q) => dist(q.x, q.y, x, y) < 15)) continue;
      trees.push({ x, y, s, rot });
    }
  }

  // the round houses of Alésia: the same town every night (own random stream). Solid, like trunks.
  const hrnd = mulberry32(hashSeed(`${seedStr}#huts`));
  const huts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3; const r = 0.5 + (i % 3) * 0.16;
    const x = cx + Math.cos(a) * TOWN.rx * r; const y = cy + Math.sin(a) * TOWN.ry * r;
    const sc = 0.6 + hrnd() * 0.25; const rot = hrnd() * TAU;
    if (dist(x, y, player.x, player.y) < 27 * sc + 26) continue; // never on top of the rider
    huts.push({ x, y, s: sc, rot, r: 27 * sc });
  }

  const w = {
    seed: seedStr, night: n, cx, cy, inner, outer, towers, patrols, watchers: [...towers, ...patrols],
    forests, trees, huts, rivers, traps, player, grass, weather, riders,
    alarm: 0, time: 0, limit: TUNE.limit(n), state: 'play', reason: '',
    seen: 0, heard: 0, hold: 0, grace: TUNE.firstGrace, sighted: false, suspect: false, noisy: false,
    hidden: false, inTown: true, nearest: 9999, flash: 0, flash2: 0,
    lastSeen: { x: 0, y: 0, t: 0, on: false },
    stones: TUNE.stones, stoneCd: 0, stone: { on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, dur: 1 },
    ping: { on: false, x: 0, y: 0, t: 0 },
    rallied: 0, stats: { maxAlarm: 0, suspected: 0, traps: 0, stones: 0, seenTime: 0 },
    ev: [],
  };
  return w;
}

/* ── queries ───────────────────────────────────────────────────── */
export function inForest(w, x, y) {
  for (const blobs of w.forests) for (const b of blobs) if (dist(x, y, b.x, b.y) < b.r) return true;
  return false;
}
export function inRiver(w, x, y) {
  for (const pts of w.rivers) {
    const i = clamp(Math.floor((x + 20) / 40), 0, pts.length - 2);
    if (distToSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < 14) return true;
  }
  return false;
}
/** y of river `i` at x (for the 3D riverbed) */
export function riverY(w, i, x) {
  const pts = w.rivers[i];
  const k = clamp((x + 20) / 40, 0, pts.length - 1.001); const j = Math.floor(k); const f = k - j;
  return pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
}
export const inTown = (w, x, y) => ((x - w.cx) / TOWN.rx) ** 2 + ((y - w.cy) / TOWN.ry) ** 2 < 1;
function insideRing(w, ring, x, y) {
  return dist(x, y, w.cx, w.cy) < ring.radiusAt(Math.atan2(y - w.cy, x - w.cx)).r;
}
/** The gap to aim for: through the first line while you are inside it, then through the second. */
export function nextGap(w) {
  const p = w.player;
  const ring = insideRing(w, w.inner, p.x, p.y) ? w.inner : w.outer;
  let best = ring.gapPts[0]; let bd = Infinity;
  for (const g of ring.gapPts) { const d = dist(p.x, p.y, g.x, g.y); if (d < bd) { bd = d; best = g; } }
  return best;
}

let _wd = 0; let _wi = -1; let _ring = null;
function wallCheck(w, ax, ay, bx, by) {
  // returns true when the move ax,ay → bx,by is not allowed; leaves the nearest segment in _ring/_wi
  let crosses = false; let dNew = Infinity; let dOld = Infinity;
  for (const ring of [w.inner, w.outer]) {
    const segs = ring.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (Math.abs(s[0] - bx) > 60 && Math.abs(s[2] - bx) > 60) continue;
      if (Math.abs(s[1] - by) > 60 && Math.abs(s[3] - by) > 60) continue;
      if (segX(ax, ay, bx, by, s[0], s[1], s[2], s[3])) crosses = true;
      const d = distToSeg(bx, by, s[0], s[1], s[2], s[3]);
      if (d < dNew) { dNew = d; _ring = ring; _wi = i; }
      const d0 = distToSeg(ax, ay, s[0], s[1], s[2], s[3]);
      if (d0 < dOld) dOld = d0;
    }
  }
  _wd = dNew;
  return crosses || (dNew < TUNE.wallPad && dNew <= dOld);
}

/** Throw a stone from the player along `angle`, `d` units away. Returns false when none is left. */
export function throwStone(w, angle, d) {
  if (w.state !== 'play' || w.stones <= 0 || w.stoneCd > 0 || w.stone.on) return false;
  const p = w.player; const s = w.stone;
  const dd = clamp(d, TUNE.stoneMin, TUNE.stoneMax);
  s.on = true; s.t = 0; s.x0 = p.x; s.y0 = p.y;
  s.x1 = clamp(p.x + Math.cos(angle) * dd, 10, WORLD.w - 10); s.y1 = clamp(p.y + Math.sin(angle) * dd, 10, WORLD.h - 10);
  s.dur = 0.55 + dd / 420;
  w.stones--; w.stoneCd = TUNE.stoneCooldown; w.stats.stones++;
  return true;
}

function alert(w, x, y, radius, secs) {
  for (const o of w.watchers) {
    if (dist(o.x, o.y, x, y) < radius) { o.inv = Math.max(o.inv, secs); o.ix = x; o.iy = y; }
  }
}

/* ── simulation ────────────────────────────────────────────────── */
/**
 * Advance the world by dt seconds.
 * input = { x, y } desired direction in world space (length ≤ 1), sprint, face (optional view angle).
 * Returns the (reused) event list: { type: 'trap' | 'rally' | 'thunder' | 'sighted' | 'suspect' | 'lost' |
 *   'calm' | 'stone' | 'winded' | 'caught' | 'escaped', … }
 */
export function step(w, input, dt) {
  const ev = w.ev; ev.length = 0;
  if (w.state !== 'play') return ev;
  w.time += dt;
  const p = w.player;
  const T = TUNE;

  // ── sentries: sweep, or turn to what they heard / glimpsed ──
  for (const t of w.towers) {
    let want; let rate = T.turn;
    if (t.inv > 0) { t.inv -= dt; want = Math.atan2(t.iy - t.y, t.ix - t.x); if (t.see && w.suspect) rate = T.track; }
    else { t.clock += dt; want = t.base + Math.sin(t.clock * t.speed + t.phase) * t.sweep; }
    t.dir += clamp(angDiff(want, t.dir), -rate * dt, rate * dt);
  }
  for (const q of w.patrols) {
    let want;
    if (q.inv > 0) { q.inv -= dt; q.moving = 0; want = Math.atan2(q.iy - q.y, q.ix - q.x); }
    else {
      q.clock += dt; q.moving = 1;
      const a = q.a0 + Math.sin(q.clock * q.speed + q.t) * q.span;
      const nx = w.cx + Math.cos(a) * q.rx; const ny = w.cy + Math.sin(a) * q.ry;
      want = (nx !== q.x || ny !== q.y) ? Math.atan2(ny - q.y, nx - q.x) : q.dir;
      q.x = nx; q.y = ny;
    }
    q.dir += clamp(angDiff(want, q.dir), -3 * dt, 3 * dt);
  }

  // ── the rider ──
  const forest = inForest(w, p.x, p.y);
  const water = inRiver(w, p.x, p.y);
  let len = Math.hypot(input.x, input.y);
  const ix = len > 1 ? input.x / len : input.x; const iy = len > 1 ? input.y / len : input.y;
  len = Math.min(1, len);
  if (p.winded && p.stam >= T.stamMin) p.winded = false;
  const galloping = !!input.sprint && !p.winded && p.stam > 0 && len > 0.2 && p.stun <= 0;
  if (galloping) { p.stam -= T.stamDrain * dt; p.rest = T.stamDelay; if (p.stam <= 0) { p.stam = 0; p.winded = true; ev.push({ type: 'winded' }); } }
  else if (p.rest > 0) p.rest -= dt;
  else p.stam = Math.min(100, p.stam + T.stamRegen * dt);
  p.galloping = galloping;
  let speed = galloping ? T.gallop : T.walk;
  if (forest) speed *= 0.75;
  if (water) speed *= 0.5;
  if (p.stun > 0) { p.stun -= dt; speed *= 0.2; }
  const k = Math.min(1, T.accel * dt);
  p.vx += (ix * speed - p.vx) * k; p.vy += (iy * speed - p.vy) * k;
  p.speed = Math.hypot(p.vx, p.vy);
  if (p.speed < 0.5 && len === 0) { p.vx = 0; p.vy = 0; p.speed = 0; }
  if (input.face !== undefined) p.face = input.face;
  else if (len > 0.15) p.face = Math.atan2(iy, ix);

  if (p.speed > 0) {
    const mx = p.vx * dt; const my = p.vy * dt;
    let nx = clamp(p.x + mx, 10, WORLD.w - 10); let ny = clamp(p.y + my, 10, WORLD.h - 10);
    if (wallCheck(w, p.x, p.y, nx, ny)) {
      // slide along the wall
      const s = _ring.segs[_wi]; let tx = s[2] - s[0]; let ty = s[3] - s[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const along = mx * tx + my * ty;
      nx = p.x + tx * along; ny = p.y + ty * along;
      if (wallCheck(w, p.x, p.y, nx, ny)) {
        if (!wallCheck(w, p.x, p.y, p.x + mx, p.y)) { nx = p.x + mx; ny = p.y; }
        else if (!wallCheck(w, p.x, p.y, p.x, p.y + my)) { nx = p.x; ny = p.y + my; }
        else { nx = p.x; ny = p.y; p.vx *= 0.5; p.vy *= 0.5; }
      }
    }
    // tree trunks push you aside
    const trees = w.trees;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]; const dx = nx - t.x; const dy = ny - t.y;
      if (dx > T.treePad || dx < -T.treePad || dy > T.treePad || dy < -T.treePad) continue;
      const d = Math.hypot(dx, dy);
      if (d < T.treePad && d > 0.001) {
        const ox = t.x + (dx / d) * T.treePad; const oy = t.y + (dy / d) * T.treePad;
        if (!wallCheck(w, p.x, p.y, ox, oy)) { nx = ox; ny = oy; }
      }
    }
    for (let i = 0; i < w.huts.length; i++) {
      const h = w.huts[i]; const dx = nx - h.x; const dy = ny - h.y; const pad = h.r + 5;
      if (dx > pad || dx < -pad || dy > pad || dy < -pad) continue;
      const d = Math.hypot(dx, dy);
      if (d < pad && d > 0.001) { nx = h.x + (dx / d) * pad; ny = h.y + (dy / d) * pad; }
    }
    p.x = nx; p.y = ny;
  }

  // traps: revealed when close, sprung when stepped on
  for (const tr of w.traps) {
    const dx = p.x - tr.x; const dy = p.y - tr.y;
    if (dx > 46 || dx < -46 || dy > 46 || dy < -46) continue;
    const d = Math.hypot(dx, dy);
    if (d < 46) tr.seen = true;
    if (!tr.sprung && d < 7) {
      tr.sprung = true; p.stun = T.trapStun; w.alarm = Math.min(96, w.alarm + T.trapAlarm); w.stats.traps++;
      alert(w, p.x, p.y, 150, 2.5);
      ev.push({ type: 'trap' });
    }
  }

  // rally hidden riders; rallied riders fall in behind you
  for (let i = 0; i < w.riders.length; i++) {
    const r = w.riders[i];
    if (!r.rallied) {
      if (dist(p.x, p.y, r.x, r.y) < T.rallyDist) { r.rallied = true; r.order = ++w.rallied; ev.push({ type: 'rally', index: i, count: w.rallied }); }
      continue;
    }
    const back = 26 + r.order * 20; const side = (r.order % 2 ? 1 : -1) * 12;
    const tx = p.x - Math.cos(p.face) * back - Math.sin(p.face) * side; const ty = p.y - Math.sin(p.face) * back + Math.cos(p.face) * side;
    const dx = tx - r.x; const dy = ty - r.y; const d = Math.hypot(dx, dy);
    if (d > 6) {
      const sp = Math.min(d * 2.2, 230) * dt;
      r.x += (dx / d) * sp; r.y += (dy / d) * sp;
      r.face += clamp(angDiff(Math.atan2(dy, dx), r.face), -5 * dt, 5 * dt);
    }
  }

  // the stone in the air, then the noise where it lands
  if (w.stoneCd > 0) w.stoneCd = Math.max(0, w.stoneCd - dt);
  if (w.stone.on) {
    w.stone.t += dt / w.stone.dur;
    if (w.stone.t >= 1) {
      w.stone.on = false;
      w.ping.on = true; w.ping.x = w.stone.x1; w.ping.y = w.stone.y1; w.ping.t = 0;
      alert(w, w.stone.x1, w.stone.y1, T.stoneHear, T.investigate);
      ev.push({ type: 'stone' });
    }
  }
  if (w.ping.on) { w.ping.t += dt; if (w.ping.t > 1.6) w.ping.on = false; }

  // storm: one flash, then a dimmer second one
  if (w.weather === 'rain') {
    w.flash = Math.max(0, w.flash - dt * 2.5);
    if (w.flash2 > 0) { w.flash2 -= dt; if (w.flash2 <= 0) w.flash = Math.max(w.flash, 0.45); }
    if (w.flash <= 0 && w.flash2 <= 0 && Math.random() < dt * 0.055) { w.flash = 1; w.flash2 = 0.28; ev.push({ type: 'thunder' }); }
  }

  // ── detection: a meter that fills while a sentry has you in its light ──
  // inside Alésia you are among your own: the town is a safe zone
  const town = inTown(w, p.x, p.y);
  w.inTown = town;
  let rate = 0; let nearest = 9999; let heard = 0;
  const noise = galloping ? (w.weather === 'rain' ? T.noiseRain : T.noiseClear) : 0;
  for (const o of w.watchers) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < nearest) nearest = d;
    o.see = 0;
    if (town) continue;
    if (noise && d < noise) { heard = 1; if (w.alarm >= T.noiseLook && o.inv < 0.6) { o.inv = 1.4; o.ix = p.x; o.iy = p.y; } }
    if (d > o.range) continue;
    if (Math.abs(angDiff(Math.atan2(p.y - o.y, p.x - o.x), o.dir)) > o.half) continue;
    if (forest && d > T.forestSight) continue;
    o.see = 1;
    const r = T.fillFar + (T.fillNear - T.fillFar) * (1 - d / o.range);
    if (r > rate) rate = r;
  }
  w.nearest = nearest; w.heard = heard; w.noisy = galloping;
  const was = w.seen > 0;
  if (rate > 0) {
    if (!w.sighted) { w.sighted = true; ev.push({ type: 'sighted' }); }
    if (w.grace > 0) { w.grace -= dt; rate *= T.graceRate; }
    if (galloping) rate *= T.gallopSeen;
    w.alarm += rate * dt; w.hold = T.hold; w.stats.seenTime += dt;
    w.lastSeen.x = p.x; w.lastSeen.y = p.y;
  } else {
    if (was && w.suspect) {
      // they lost you: they keep staring at the place where they last saw you
      w.lastSeen.on = true; w.lastSeen.t = 0;
      alert(w, w.lastSeen.x, w.lastSeen.y, 230, 3);
      ev.push({ type: 'lost' });
    }
    if (heard && w.alarm < T.noiseCap) w.alarm += T.noiseFill * dt;
    else if (w.hold > 0) w.hold -= dt;
    else if (!heard) w.alarm -= (forest || town ? T.decayHidden : T.decay) * dt;
  }
  w.seen = rate > 0 ? 1 : 0;
  w.hidden = forest && !w.seen;
  w.alarm = clamp(w.alarm, 0, 100);
  if (w.alarm > w.stats.maxAlarm) w.stats.maxAlarm = w.alarm;
  if (!w.suspect && w.alarm >= T.suspectAt) { w.suspect = true; w.stats.suspected++; ev.push({ type: 'suspect' }); }
  else if (w.suspect && w.alarm < T.suspectAt * 0.45) { w.suspect = false; ev.push({ type: 'calm' }); }
  // while suspicious, the sentries that see you follow you (slowly: a gallop sideways can shake them)
  if (w.suspect && w.seen) for (const o of w.watchers) if (o.see) { o.inv = Math.max(o.inv, 0.5); o.ix = p.x; o.iy = p.y; }
  if (w.lastSeen.on) { w.lastSeen.t += dt; if (w.lastSeen.t > 6) w.lastSeen.on = false; }

  if (w.alarm >= 100) { w.state = 'caught'; w.reason = 'seen'; ev.push({ type: 'caught', reason: 'seen' }); return ev; }
  if (w.time >= w.limit) { w.state = 'caught'; w.reason = 'dawn'; ev.push({ type: 'caught', reason: 'dawn' }); return ev; }

  // escape: well outside the outer ring
  const ro = w.outer.radiusAt(Math.atan2(p.y - w.cy, p.x - w.cx));
  if (dist(p.x, p.y, w.cx, w.cy) > ro.r + 60) { w.state = 'escaped'; ev.push({ type: 'escaped' }); }
  return ev;
}

/** Medal for a finished night: gold = all three riders and never suspected; silver = two riders or never suspected. */
export function medalFor(w) {
  if (w.state !== 'escaped') return 0;
  const clean = w.stats.suspected === 0;
  if (w.rallied >= 3 && clean) return 3;
  if (w.rallied >= 2 || clean) return 2;
  return 1;
}

/* ── 2D rendering (the secondary, top-down view) ────────────────── */
let lightCanvas = null;

export function render(ctx, w, view, colors, opts = {}) {
  const { width: W, height: H } = view;
  const scale = view.scale;
  if (!(W > 0 && H > 0 && scale > 0)) return; // canvas not laid out yet
  const p = w.player;
  const camX = Math.max(W / 2 / scale, Math.min(WORLD.w - W / 2 / scale, p.x));
  const camY = Math.max(H / 2 / scale, Math.min(WORLD.h - H / 2 / scale, p.y));
  const toS = (x, y) => [(x - camX) * scale + W / 2, (y - camY) * scale + H / 2];

  // dread shake (never under reduced motion)
  const shake = opts.horror && !opts.still && w.alarm > 55 ? (w.alarm - 55) / 45 * 4 : 0;
  ctx.save();
  if (shake) ctx.translate(Math.sin(w.time * 31) * shake, Math.cos(w.time * 27) * shake);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(-8, -8, W + 16, H + 16);
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
  ctx.fillStyle = colors.forest;
  for (const blobs of w.forests) for (const b of blobs) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = colors.forestDot;
  for (const t of w.trees) { ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, TAU); ctx.fill(); }

  // town (Alésia) on its plateau
  ctx.fillStyle = colors.plateau; ctx.strokeStyle = colors.gaul; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w.cx, w.cy, TOWN.rx, TOWN.ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colors.forestDot;
  for (const h of w.huts) { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill(); }

  // torch cones (drawn under walls); they redden when they have you
  for (const t of w.watchers) {
    const g = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, t.range);
    g.addColorStop(0, t.see ? colors.coneSee : colors.coneIn); g.addColorStop(1, colors.coneOut);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.range, t.dir - t.half, t.dir + t.half); ctx.closePath(); ctx.fill();
  }

  // walls
  const drawRing = (ring, width) => {
    ctx.strokeStyle = colors.wall; ctx.lineWidth = width; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const s of ring.segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
  };
  drawRing(w.outer, 7); drawRing(w.inner, 6);
  // the gaps (gold marks)
  ctx.strokeStyle = colors.trap; ctx.lineWidth = 2;
  for (const ring of [w.inner, w.outer]) for (const g of ring.gapPts) {
    ctx.beginPath(); ctx.moveTo(g.x - 7, g.y); ctx.lineTo(g.x, g.y - 7); ctx.lineTo(g.x + 7, g.y); ctx.lineTo(g.x, g.y + 7); ctx.closePath(); ctx.stroke();
  }

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

  // last place you were seen, and the stone
  if (w.lastSeen.on) {
    ctx.strokeStyle = colors.romeLight; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(w.lastSeen.x, w.lastSeen.y, 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (w.stone.on) {
    const s = w.stone; const k = s.t;
    ctx.fillStyle = colors.text; ctx.beginPath(); ctx.arc(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 26, 2.5, 0, TAU); ctx.fill();
  }
  if (w.ping.on) {
    ctx.strokeStyle = colors.text; ctx.globalAlpha = Math.max(0, 1 - w.ping.t / 1.6); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w.ping.x, w.ping.y, 10 + w.ping.t * (opts.still ? 0 : 60), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // hidden riders (a green ring), and your rallied riders trailing behind you
  for (const r of w.riders) {
    ctx.strokeStyle = colors.gaul; ctx.fillStyle = colors.gaul; ctx.lineWidth = 1.5;
    if (r.rallied) { ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(r.x, r.y, 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, TAU); ctx.fill(); }
  }

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
    if (sx < -r * scale || sy < -r * scale || sx > W + r * scale || sy > H + r * scale) return;
    const g = l.createRadialGradient(sx, sy, 0, sx, sy, r * scale);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(sx, sy, r * scale, 0, TAU); l.fill();
  };
  if (opts.horror) {
    // Cry of Fear lantern: a small halo + a cone where you ride
    hole(p.x, p.y, 60, 0.9);
    const [px, py] = toS(p.x, p.y);
    const R = 220 * scale; const half = 0.5;
    const g = l.createRadialGradient(px, py, 0, px, py, R);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.7, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g;
    l.beginPath(); l.moveTo(px, py); l.arc(px, py, R, p.face - half, p.face + half); l.closePath(); l.fill();
  } else {
    hole(p.x, p.y, 150, 0.95);
  }
  for (const t of w.watchers) hole(t.x + Math.cos(t.dir) * t.range * 0.5, t.y + Math.sin(t.dir) * t.range * 0.5, t.range * 0.75, 0.7);
  for (const r of w.riders) if (!r.rallied) hole(r.x, r.y, 26, 0.6);
  for (const ring of [w.inner, w.outer]) for (const g of ring.gapPts) hole(g.x, g.y, 24, 0.5);
  hole(w.cx, w.cy, 150, 0.45);
  ctx.drawImage(lightCanvas, 0, 0, W, H);

  if (w.weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,210,220,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = (Math.random() * W); const ry = (Math.random() * H);
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 12);
    }
    ctx.stroke();
    if (w.flash > 0 && !opts.still) { ctx.fillStyle = `rgba(220,230,255,${w.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  } else if (w.weather === 'fog') {
    ctx.fillStyle = 'rgba(120,110,100,0.12)'; ctx.fillRect(0, 0, W, H);
  }
  // dawn is coming
  const dawn = clamp(1 - (w.limit - w.time) / TUNE.dawnWarn, 0, 1);
  if (dawn > 0) { ctx.fillStyle = `rgba(238,138,69,${dawn * 0.14})`; ctx.fillRect(0, 0, W, H); }
  if (opts.horror) horrorPass(ctx, w, W, H, opts);

  // alarm vignette
  if (w.alarm > 5) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(179,38,30,${(w.alarm / 100) * 0.55})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
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
  ctx.save();
  ctx.globalAlpha = 0.22;
  const ox = opts.still ? 0 : Math.random() * 192; const oy = opts.still ? 0 : Math.random() * 192;
  for (let x = -ox; x < W; x += 192) for (let y = -oy; y < H; y += 192) ctx.drawImage(grain, x, y);
  ctx.restore();
  const fear = w.alarm / 100;
  const beat = opts.still ? 0 : Math.max(0, Math.sin(w.time * (4 + fear * 7))) ** 8 * fear;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.22 - beat * 0.05), W / 2, H / 2, Math.max(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 + fear * 0.3})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (fear > 0.4) {
    const a = (fear - 0.4) * 0.5;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const r = ctx.createLinearGradient(0, 0, W * 0.18, 0); r.addColorStop(0, `rgba(240,40,40,${a})`); r.addColorStop(1, 'rgba(240,40,40,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W * 0.18, H);
    const c = ctx.createLinearGradient(W, 0, W * 0.82, 0); c.addColorStop(0, `rgba(40,200,220,${a})`); c.addColorStop(1, 'rgba(40,200,220,0)');
    ctx.fillStyle = c; ctx.fillRect(W * 0.82, 0, W * 0.18, H);
    ctx.restore();
  }
}

/* ── minimap (both views): a static layer drawn once per night + the moving things ── */
export function createMinimap(canvas, w, colors) {
  const W = canvas.width; const H = canvas.height; const s = W / WORLD.w;
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const b = base.getContext('2d');
  b.fillStyle = 'rgba(18,10,6,0.82)'; b.fillRect(0, 0, W, H);
  b.strokeStyle = colors.river; b.lineWidth = Math.max(1.5, 22 * s);
  for (const pts of w.rivers) { b.beginPath(); pts.forEach(([x, y], i) => (i ? b.lineTo(x * s, y * s) : b.moveTo(x * s, y * s))); b.stroke(); }
  b.fillStyle = 'rgba(70,96,60,0.55)';
  for (const blobs of w.forests) for (const f of blobs) { b.beginPath(); b.arc(f.x * s, f.y * s, f.r * s, 0, TAU); b.fill(); }
  b.fillStyle = colors.plateau; b.beginPath(); b.ellipse(w.cx * s, w.cy * s, TOWN.rx * s, TOWN.ry * s, 0, 0, TAU); b.fill();
  b.strokeStyle = colors.wall; b.lineWidth = Math.max(1.5, W / 110);
  b.beginPath();
  for (const ring of [w.inner, w.outer]) for (const sg of ring.segs) { b.moveTo(sg[0] * s, sg[1] * s); b.lineTo(sg[2] * s, sg[3] * s); }
  b.stroke();
  b.fillStyle = colors.trap;
  for (const ring of [w.inner, w.outer]) for (const g of ring.gapPts) { b.beginPath(); b.arc(g.x * s, g.y * s, Math.max(2, W / 75), 0, TAU); b.fill(); }
  const ctx = canvas.getContext('2d');
  const dot = Math.max(2.5, W / 60);
  return function draw(yaw) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = colors.rome;
    for (const t of w.towers) ctx.fillRect(t.x * s - dot * 0.6, t.y * s - dot * 0.6, dot * 1.2, dot * 1.2);
    for (const r of w.riders) {
      if (r.rallied) continue;
      ctx.strokeStyle = colors.gaul; ctx.lineWidth = Math.max(1.5, W / 120);
      ctx.beginPath(); ctx.arc(r.x * s, r.y * s, dot * 1.1, 0, TAU); ctx.stroke();
    }
    if (w.lastSeen.on) { ctx.strokeStyle = colors.romeLight; ctx.beginPath(); ctx.arc(w.lastSeen.x * s, w.lastSeen.y * s, dot * 1.4, 0, TAU); ctx.stroke(); }
    if (w.ping.on) { ctx.strokeStyle = colors.text; ctx.beginPath(); ctx.arc(w.ping.x * s, w.ping.y * s, dot * 1.2, 0, TAU); ctx.stroke(); }
    const px = w.player.x * s; const py = w.player.y * s;
    if (yaw !== null) {
      ctx.fillStyle = 'rgba(125,192,138,0.28)';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, dot * 6, yaw - 0.6, yaw + 0.6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = colors.gaul; ctx.beginPath(); ctx.arc(px, py, dot, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.text; ctx.lineWidth = 1; ctx.stroke();
  };
}
