/*
 * La Percée — leaderboard (per device, per map seed) and share codes.
 *
 * There is no server: a score lives in this browser's localStorage. To compare with classmates,
 * a score packs into a 12-character code (Crockford Base32: 11 symbols + 1 check symbol, value mod 31) that anyone can type
 * into their own board. Codes can be forged — fine for a class game; the check only catches typos.
 */
import { hashSeed } from './engine.js';

const KEY = 'percee-board-v2';
const OLD_KEY = 'percee-board';
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const todaySeed = (d = new Date()) => `alesia-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
export const randomSeed = () => Math.random().toString(36).slice(2, 8);
export const cleanInitials = (s) => (String(s || '').toUpperCase().replace(/[^A-Z]/g, '') + 'AAA').slice(0, 3);
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** better first: more nights, then more riders, then less time */
export const compare = (a, b) => b.nights - a.nights || (b.riders || 0) - (a.riders || 0) || a.time - b.time;

export function loadBoard() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const b = JSON.parse(raw); if (b && typeof b === 'object') return b; }
    // first run after the update: keep the scores of the old board
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (old && typeof old === 'object') {
      const out = {};
      for (const seed of Object.keys(old)) {
        out[seed] = (old[seed] || []).map((e, i) => ({ id: `old-${e.at || i}`, ini: cleanInitials(e.name), nights: e.nights | 0, riders: e.riders | 0, time: e.time | 0, medals: [], at: e.at || 0, src: 'local' }));
      }
      return out;
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

export function encodeScore(seed, e) {
  const ini = cleanInitials(e.ini);
  let v = 1n;                                                    // version (2 bits)
  v = (v << 16n) | BigInt(seedTag(seed));
  v = (v << 3n) | BigInt(Math.min(7, e.nights | 0));
  v = (v << 4n) | BigInt(Math.min(15, e.riders | 0));
  v = (v << 12n) | BigInt(Math.min(4095, Math.max(0, Math.round(e.time))));
  for (let i = 0; i < 3; i++) v = (v << 5n) | BigInt(ini.charCodeAt(i) - 65);
  v = (v << 3n) | BigInt(Math.min(7, (e.medals || []).filter((m) => m === 3).length));
  let s = '';
  for (let i = 0; i < 11; i++) { s = ALPHA[Number(v & 31n)] + s; v >>= 5n; }
  const chk = ALPHA[Number(decodeRaw(s) % 31n)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}${chk}`;
}
function decodeRaw(s) { let v = 0n; for (const ch of s) v = (v << 5n) | BigInt(ALPHA.indexOf(ch)); return v; }

/** → { ok, entry, tag } or { ok: false, why: 'format' | 'check' } */
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
  const time = take(12); const riders = take(4); const nights = take(3); const tag = take(16); const ver = take(2);
  if (ver !== 1 || c1 > 25 || c2 > 25 || c3 > 25 || nights > 5) return { ok: false, why: 'format' };
  const ini = String.fromCharCode(65 + c1, 65 + c2, 65 + c3);
  return { ok: true, tag, entry: { id: `code-${body}`, ini, nights, riders, time, medals: Array(golds).fill(3), at: Date.now(), src: 'code' } };
}
/** which of the given seeds a decoded code belongs to (or null) */
export const matchSeed = (tag, seeds) => seeds.find((s) => seedTag(s) === tag) || null;
