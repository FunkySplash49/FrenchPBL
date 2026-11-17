/*
 * La Percée — the shared class board, client side. Talks to /api/board (game-lab-api/board.mjs on
 * Vercel; a mock with in-memory data under `npm run dev`). Nothing here may throw into the game:
 * every failure comes back as a value, and the game falls back to the board on this device.
 */

const URL_ = '/api/board';
const PENDING = 'percee-pending';
const TIMEOUT = 8000;

/** the server's rules, checked before sending (the server checks again, plus a word filter) */
export const tidyName = (s) => String(s || '').normalize('NFC').replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, ' ').trim();
export function nameProblem(raw) {
  const n = tidyName(raw);
  if (!n) return 'empty';
  if ([...n].length > 24) return 'long';
  if (!/^[\p{L}\p{M}\p{N}' -]+$/u.test(n) || !/[\p{L}\p{N}]/u.test(n)) return 'chars';
  return null;
}
export const sameName = (a, b) => !!a && !!b && tidyName(a).toLocaleLowerCase('fr') === tidyName(b).toLocaleLowerCase('fr');

async function call(init) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(URL_, { cache: 'no-store', ...init, signal: ctl.signal });
    const type = r.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await r.json().catch(() => null) : null;
    return { status: r.status, body };
  } finally { clearTimeout(timer); }
}

/** → { ok: true, rows } or { ok: false } (offline, no API, store down) */
export async function fetchClassBoard() {
  try {
    const { status, body } = await call({ method: 'GET' });
    if (status === 200 && Array.isArray(body)) return { ok: true, rows: body };
  } catch { /* offline or timed out */ }
  return { ok: false };
}

/** payload { name, points, nights, gold, riders, time, seed }
    → { ok: true, rank, total, improved, best } | { ok: false, error: 'name' | 'profanity' | 'rate' | 'invalid' | 'offline' } */
export async function submitClassScore(payload) {
  try {
    const { status, body } = await call({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (status === 200 && body?.ok) return { ok: true, rank: body.rank, total: body.total, improved: !!body.improved, best: body.best };
    if (status === 400 && (body?.error === 'name' || body?.error === 'profanity')) return { ok: false, error: body.error };
    if (status === 400 || status === 413) return { ok: false, error: 'invalid' };
    if (status === 429) return { ok: false, error: 'rate' };
  } catch { /* offline or timed out */ }
  return { ok: false, error: 'offline' };
}

/* a score that could not be sent waits here, and is sent again later (one at a time: the latest wins) */
export function loadPending() {
  try { const p = JSON.parse(localStorage.getItem(PENDING) || 'null'); return p && typeof p === 'object' && p.name ? p : null; } catch { return null; }
}
export function savePending(p) {
  try { if (p) localStorage.setItem(PENDING, JSON.stringify(p)); else localStorage.removeItem(PENDING); } catch { /* blocked */ }
}
