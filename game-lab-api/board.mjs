/*
 * La Percée — the class board, as one Vercel Function (Node.js runtime, Web-standard fetch handler).
 *
 * Deployed as api/board.mjs in the alesia-game-lab project (see tools/deploy-lab.sh), so it answers
 * at /api/board. No npm dependency: Upstash Redis is reached through its REST API with plain fetch.
 *
 *   GET    /api/board            → 200 [{ name, points, nights, gold, riders, time, at }]  best first, top 100
 *   POST   /api/board  (JSON)    → 200 { ok, improved, rank, total, best }  (rank is 1-based)
 *          body { name, points, nights, gold, riders?, time, seed? }
 *   DELETE /api/board[?name=X]   → 200 { ok, removed }   only when ADMIN_KEY is set; header  x-admin-key: <ADMIN_KEY>
 *          removed = rows deleted (0 or 1 with ?name, the whole count without it)
 *   DELETE /api/board?check=1    → 200 { ok, check: true }  checks the key only, changes nothing (the gamekeeper panel)
 *
 * Errors: { error: <code> } with 400 (name | profanity | points | nights | gold | riders | time | json),
 *         405, 413 (too large), 429 (rate), 503 (not configured / store down).
 *
 * One row per name (case-insensitive): a sorted set holds the best composite score per name, a hash
 * holds that run's details. Both are written together by one Lua script, so concurrent submits are safe.
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN;
 *      ADMIN_KEY (optional) enables DELETE. Secrets are never logged.
 */

export const NIGHTS = 5;
export const TOP = 100;
export const MAX_BODY = 1024;
/* a class shares one school IP: the IP cap is loose, the per-name cap does the real limiting */
export const RATE = { perIp: 120, perName: 10, windowSec: 60 };
const PREFIX = 'percee:class';
export const KEYS = { z: `${PREFIX}:z`, h: `${PREFIX}:h`, rl: `${PREFIX}:rl:` };

/* the points formula's ceiling (board.js POINTS): per night 1000 escape + 500 gold + 3×200 riders + 300 clean
   + 2×50 stones + 5 per second left; dawn comes at 180, 170, 160, 150, 140 s */
const LIMITS = [180, 170, 160, 150, 140];
export const maxPoints = (nights) => {
  let p = 0;
  for (let i = 0; i < nights; i++) p += 1000 + 500 + 600 + 300 + 100 + 5 * LIMITS[i];
  return p;
};

/* ── names ── */
const BAD = [
  // FR
  'merde', 'putain', 'pute', 'connard', 'connasse', 'conne', 'con', 'salope', 'salaud', 'encule', 'enculer', 'nique', 'niquer', 'ntm', 'fdp',
  'batard', 'bite', 'couille', 'couilles', 'chatte', 'pd', 'pede', 'tapette', 'negre', 'bougnoule', 'gouine', 'branleur', 'abruti', 'debile', 'pouffiasse',
  // EN
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'whore', 'slut', 'nigger', 'nigga', 'fag', 'faggot',
  'retard', 'wanker', 'twat', 'porn', 'sex', 'penis', 'vagina', 'nazi', 'hitler', 'rape',
];
const BAD_SET = new Set(BAD);
const BAD_INSIDE = ['fuck', 'shit', 'nigg', 'putain', 'encul', 'salope', 'connard', 'hitler'];   // also caught inside a longer word
const fold = (s) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** → { ok: true, name, key } or { ok: false, error: 'name' | 'profanity' } */
export function cleanName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'name' };
  const name = raw.normalize('NFC').replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < 1 || len > 24) return { ok: false, error: 'name' };
  if (!/^[\p{L}\p{M}\p{N}' -]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return { ok: false, error: 'name' };
  const f = fold(name);
  const words = f.split(/[\s'-]+/).filter(Boolean);
  const joined = words.join('');
  if (words.some((w) => BAD_SET.has(w)) || (joined.length > 3 && BAD_SET.has(joined)) || BAD_INSIDE.some((b) => joined.includes(b))) return { ok: false, error: 'profanity' };
  return { ok: true, name, key: name.toLocaleLowerCase('fr') };
}

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);

/** body → { ok: true, entry } or { ok: false, error } */
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'json' };
  const n = cleanName(body.name);
  if (!n.ok) return n;
  const { points, nights, gold, time } = body;
  const riders = body.riders ?? 0;
  if (!isInt(nights) || nights < 0 || nights > NIGHTS) return { ok: false, error: 'nights' };
  if (!isInt(points) || points < 0 || points % 5 !== 0 || points > maxPoints(nights)) return { ok: false, error: 'points' };
  if (!isInt(gold) || gold < 0 || gold > nights) return { ok: false, error: 'gold' };
  if (!isInt(riders) || riders < 0 || riders > nights * 3) return { ok: false, error: 'riders' };
  if (!isInt(time) || time < 0 || time > 24 * 3600 || (nights > 0 && time < nights * 5)) return { ok: false, error: 'time' };
  const seed = typeof body.seed === 'string' ? body.seed.slice(0, 32) : '';
  return { ok: true, key: n.key, entry: { name: n.name, points, nights, gold, riders, time, seed } };
}

/** one number that sorts like the board: more points, then more nights, then less time */
export const composite = (e) => e.points * 1e7 + e.nights * 1e6 + (999999 - Math.min(999999, e.time));

/* Atomic "keep the best": write only when the new composite beats the stored one.
   KEYS: zset, hash · ARGV: member, score, json → { improved 0|1, rank (0-based), total, stored json } */
export const SAVE_LUA = `
local old = redis.call('ZSCORE', KEYS[1], ARGV[1])
local improved = 0
if (not old) or tonumber(ARGV[2]) > tonumber(old) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
  improved = 1
end
return { improved, redis.call('ZREVRANK', KEYS[1], ARGV[1]), redis.call('ZCARD', KEYS[1]), redis.call('HGET', KEYS[2], ARGV[1]) }
`;

/* ── Upstash REST client (plain fetch) ── */
export function restRedis(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const base = url.replace(/\/+$/, '');
  const post = async (path, body) => {
    const r = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error(`redis http ${r.status}`);
    return j;
  };
  return {
    async cmd(args) { const j = await post('', args); if (j.error) throw new Error('redis error'); return j.result; },
    async pipeline(list) {
      const j = await post('/pipeline', list);
      if (!Array.isArray(j)) throw new Error('redis error');
      return j.map((x) => { if (x.error) throw new Error('redis error'); return x.result; });
    },
  };
}

/* ── the handler ── */
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});
const clientIp = (req) => (req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim().slice(0, 64);
const safeEq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const parseRow = (s) => {
  try {
    const e = JSON.parse(s);
    return { name: e.name, points: e.points, nights: e.nights, gold: e.gold, riders: e.riders ?? 0, time: e.time, at: e.at };
  } catch { return null; }
};

/** createHandler({ redis, env, now }) → async (Request) => Response. `redis` defaults to the Upstash REST client. */
export function createHandler({ redis, env = process.env, now = () => Date.now() } = {}) {
  return async function handle(req) {
    const db = redis === undefined ? restRedis(env) : redis;
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, DELETE, OPTIONS' } });
    if (!['GET', 'POST', 'DELETE'].includes(method)) return json({ error: 'method' }, 405, { Allow: 'GET, POST, DELETE' });
    if (!db) return json({ error: 'unconfigured' }, 503);

    try {
      if (method === 'GET') {
        const names = await db.cmd(['ZREVRANGE', KEYS.z, '0', String(TOP - 1)]);
        if (!names || !names.length) return json([]);
        const rows = await db.cmd(['HMGET', KEYS.h, ...names]);
        return json(rows.map((s) => (s ? parseRow(s) : null)).filter(Boolean));
      }

      if (method === 'DELETE') {
        const admin = env.ADMIN_KEY;
        if (!admin) return json({ error: 'disabled' }, 403);
        if (!safeEq(req.headers.get('x-admin-key') || '', admin)) return json({ error: 'forbidden' }, 403);
        const q = new URL(req.url).searchParams;
        if (q.has('check')) return json({ ok: true, check: true });
        const only = q.get('name');
        if (only != null) {
          const n = cleanName(only);
          const key = n.ok ? n.key : only.trim().toLocaleLowerCase('fr');
          const [a] = await db.pipeline([['ZREM', KEYS.z, key], ['HDEL', KEYS.h, key]]);
          return json({ ok: true, removed: a });
        }
        const [count] = await db.pipeline([['ZCARD', KEYS.z], ['DEL', KEYS.z], ['DEL', KEYS.h]]);
        return json({ ok: true, removed: count || 0 });
      }

      // POST
      const declared = Number(req.headers.get('content-length') || 0);
      if (declared > MAX_BODY) return json({ error: 'too-large' }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY) return json({ error: 'too-large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'json' }, 400); }
      const v = validate(body);
      if (!v.ok) return json({ error: v.error }, 400);

      const rIp = `${KEYS.rl}ip:${clientIp(req)}`; const rName = `${KEYS.rl}name:${v.key}`; const ex = String(RATE.windowSec);
      const [, byIp, , byName] = await db.pipeline([['SET', rIp, '0', 'EX', ex, 'NX'], ['INCR', rIp], ['SET', rName, '0', 'EX', ex, 'NX'], ['INCR', rName]]);
      if (byIp > RATE.perIp || byName > RATE.perName) return json({ error: 'rate' }, 429, { 'Retry-After': ex });

      const entry = { ...v.entry, at: now() };
      const [improved, rank, total, stored] = await db.cmd(['EVAL', SAVE_LUA, '2', KEYS.z, KEYS.h, v.key, String(composite(entry)), JSON.stringify(entry)]);
      return json({ ok: true, improved: improved === 1, rank: rank + 1, total, best: parseRow(stored) || entry });
    } catch {
      return json({ error: 'store' }, 503);
    }
  };
}

const handle = createHandler();
export default { fetch: (req) => handle(req) };
