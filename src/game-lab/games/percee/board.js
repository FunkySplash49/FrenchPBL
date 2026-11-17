/*
 * La Percée — leaderboard (per device, per map seed) and share codes.
 *
 * There is no server: a score lives in this browser's localStorage. To compare with classmates,
 * a score packs into a 12-character code (Crockford Base32: 11 symbols + 1 check symbol, value mod 31) that anyone can type
 * into their own board. Codes can be forged — fine for a class game; the check only catches typos.
 *
 * Scores are points (board v3, codes version 2). See POINTS below for the formula.
 */
import { hashSeed } from './engine.js';

const KEY = 'percee-board-v3';
const V2_KEY = 'percee-board-v2';
const OLD_KEY = 'percee-board';

/* ── points ──
   Per night escaped:  1000 for getting out
                      + medal: gold 500, silver 250, bronze 0
                      + 200 per rider rallied
                      + 300 if never suspected
                      + 50 per stone left unused
                      + 5 per second left before dawn (the fine-grained part: ties are rare)
   Per failed try (caught, dawn, or "restart this night"): −150 on the run.
   The run total is the sum, never below 0. Every part is a multiple of 5. */
export const POINTS = { escape: 1000, medal: [0, 0, 250, 500], rider: 200, clean: 300, stone: 50, perSec: 5, retry: 150 };

/** points for one escaped night → { total, parts: [{ k, n, pts }] } (k = key for the label in text.js) */
export function scoreNight({ medal = 1, riders = 0, clean = false, stonesLeft = 0, secsLeft = 0 }) {
  const P = POINTS; const secs = Math.max(0, Math.floor(secsLeft));
  const parts = [
    { k: 'escape', n: 1, pts: P.escape },
    { k: `medal${medal}`, n: 1, pts: P.medal[medal] || 0 },
    { k: 'riders', n: riders, pts: riders * P.rider },
    { k: 'clean', n: clean ? 1 : 0, pts: clean ? P.clean : 0 },
    { k: 'stones', n: stonesLeft, pts: stonesLeft * P.stone },
    { k: 'time', n: secs, pts: secs * P.perSec },
  ];
  return { total: parts.reduce((a, x) => a + x.pts, 0), parts };
}
/** run total from the nights' points and the number of failed tries */
export const scoreRun = (nightTotals, tries) => Math.max(0, nightTotals.reduce((a, x) => a + x, 0) - tries * POINTS.retry);
/** an estimate for a score saved before points existed (nights, riders and medals are known; time left, stealth on silver/bronze nights and stones are not) */
const estimate = (e) => {
  const medals = Array.isArray(e.medals) ? e.medals : [];
  let pts = (e.nights | 0) * POINTS.escape + (e.riders | 0) * POINTS.rider;
  for (const m of medals) pts += (POINTS.medal[m] || 0) + (m === 3 ? POINTS.clean : 0);
  return pts;
};
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const todaySeed = (d = new Date()) => `alesia-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
export const randomSeed = () => Math.random().toString(36).slice(2, 8);
export const cleanInitials = (s) => (String(s || '').toUpperCase().replace(/[^A-Z]/g, '') + 'AAA').slice(0, 3);
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
/** better first: more points, then more nights, then less time (a code has no time: it goes last among equals) */
export const compare = (a, b) => num(b.points) - num(a.points) || num(b.nights) - num(a.nights) || (a.time ?? 1e9) - (b.time ?? 1e9);

/** a stored entry in any older shape → a v3 entry with points (or null if it is unusable) */
function upgrade(e, i) {
  if (!e || typeof e !== 'object') return null;
  const medals = Array.isArray(e.medals) ? e.medals.map((m) => Math.max(0, Math.min(3, m | 0))) : [];
  const base = { id: String(e.id || `old-${e.at || i}`), ini: cleanInitials(e.ini || e.name), nights: Math.max(0, Math.min(5, e.nights | 0)), riders: Math.max(0, e.riders | 0), time: e.time == null ? null : Math.max(0, e.time | 0), medals, at: num(e.at) };
  if (Number.isFinite(e.points)) return { ...base, points: Math.max(0, Math.round(e.points)), src: e.src === 'code' ? 'code' : e.src === 'old' ? 'old' : 'local' };
  return { ...base, points: estimate(base), src: 'old' }; // marked: an estimate, from before points
}
function upgradeBoard(b) {
  const out = {};
  if (!b || typeof b !== 'object') return out;
  for (const seed of Object.keys(b)) {
    const list = Array.isArray(b[seed]) ? b[seed].map(upgrade).filter(Boolean) : [];
    if (list.length) out[seed] = list.sort(compare).slice(0, 50);
  }
  return out;
}

export function loadBoard() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const b = JSON.parse(raw); if (b && typeof b === 'object') return upgradeBoard(b); }
    // first run after the update: keep the scores of an older board, converted to points (kept under its old key too)
    for (const k of [V2_KEY, OLD_KEY]) {
      const old = JSON.parse(localStorage.getItem(k) || 'null');
      if (old && typeof old === 'object') return upgradeBoard(old);
    }
  } catch { /* private mode or broken JSON: start empty */ }
  return {};
}
export function saveBoard(board) {
  try { localStorage.setItem(KEY, JSON.stringify(board)); } catch { /* storage full or blocked */ }
}
/** add an entry (keeps the best 50 per seed); returns the new board */
export function addEntry(board, seed, entry) {
  const list = [...(board[seed] || []).filter((e) => e.id !== entry.id), entry].sort(compare).slice(0, 50);
  return { ...board, [seed]: list };
}
/** top N rows + where `id` stands + this player's best */
export function standings(board, seed, { top = 10, id = null, ini = null } = {}) {
  const all = (board[seed] || []).slice().sort(compare);
  const rank = id ? all.findIndex((e) => e.id === id) : -1;
  const best = ini ? all.find((e) => e.ini === ini && e.src !== 'code') || null : null;
  return { rows: all.slice(0, top), total: all.length, rank, mine: rank >= 0 ? all[rank] : null, best, bestRank: best ? all.indexOf(best) : -1 };
}

/* ── share codes ── */
const seedTag = (seed) => hashSeed(seed) & 0xffff;

/* Code version 2 (55 bits): version 2 · seed tag 16 · nights 3 · riders 4 · points ÷ 5 in 12 bits (up to 20 475)
   · initials 3 × 5 · gold nights 3. Version 1 codes (before points) carried the time instead of points. */
export function encodeScore(seed, e) {
  const ini = cleanInitials(e.ini);
  let v = 2n;                                                    // version (2 bits)
  v = (v << 16n) | BigInt(seedTag(seed));
  v = (v << 3n) | BigInt(Math.min(7, e.nights | 0));
  v = (v << 4n) | BigInt(Math.min(15, e.riders | 0));
  v = (v << 12n) | BigInt(Math.min(4095, Math.max(0, Math.round(num(e.points) / 5))));
  for (let i = 0; i < 3; i++) v = (v << 5n) | BigInt(ini.charCodeAt(i) - 65);
  v = (v << 3n) | BigInt(Math.min(7, (e.medals || []).filter((m) => m === 3).length));
  let s = '';
  for (let i = 0; i < 11; i++) { s = ALPHA[Number(v & 31n)] + s; v >>= 5n; }
  const chk = ALPHA[Number(decodeRaw(s) % 31n)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}${chk}`;
}
function decodeRaw(s) { let v = 0n; for (const ch of s) v = (v << 5n) | BigInt(ALPHA.indexOf(ch)); return v; }

/** → { ok, entry, tag } or { ok: false, why: 'format' | 'check' | 'old' } ('old': a valid code from before points) */
export function decodeScore(text) {
  const s = String(text || '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== 12) return { ok: false, why: 'format' };
  const body = s.slice(0, 11); const chk = s[11];
  for (const ch of body) if (!ALPHA.includes(ch)) return { ok: false, why: 'format' };
  let v = decodeRaw(body);
  if (ALPHA[Number(v % 31n)] !== chk) return { ok: false, why: 'check' };
  const take = (bits) => { const x = Number(v & ((1n << BigInt(bits)) - 1n)); v >>= BigInt(bits); return x; };
  const golds = take(3);
  const c3 = take(5); const c2 = take(5); const c1 = take(5);
  const pts5 = take(12); const riders = take(4); const nights = take(3); const tag = take(16); const ver = take(2);
  if (c1 > 25 || c2 > 25 || c3 > 25 || nights > 5) return { ok: false, why: 'format' };
  if (ver === 1) return { ok: false, why: 'old' };
  if (ver !== 2) return { ok: false, why: 'format' };
  const ini = String.fromCharCode(65 + c1, 65 + c2, 65 + c3);
  return { ok: true, tag, entry: { id: `code-${body}`, ini, nights, riders, points: pts5 * 5, time: null, medals: Array(Math.min(golds, nights)).fill(3), at: Date.now(), src: 'code' } };
}
/** which of the given seeds a decoded code belongs to (or null) */
export const matchSeed = (tag, seeds) => seeds.find((s) => seedTag(s) === tag) || null;
