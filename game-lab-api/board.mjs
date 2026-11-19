/*
 * La Percée — the class board, as one Vercel Function (Node.js runtime, Web-standard fetch handler).
 *
 * Deployed as api/board.mjs in the alesia-game-lab project (see tools/deploy-lab.sh), so it answers
 * at /api/board. No npm dependency: Upstash Redis is reached through its REST API with plain fetch.
 *
 *   GET    /api/board            → 200 [{ name, points, nights, gold, riders, time, at }]  best first, top 100
 *          cached by the CDN for a few seconds; with ?fresh=<anything> it is read straight from the store
 *   POST   /api/board?run=start  → 200 { run }  a one-use ticket for one run, valid 6 h (ask for it when the run starts)
 *   POST   /api/board  (JSON)    → 200 { ok, improved, rank, total, best }  (rank is 1-based)
 *          body { name, points, nights, gold, riders?, time, run, seed? }
 *   DELETE /api/board[?name=X]   → 200 { ok, removed }   only when ADMIN_KEY is set; header  x-admin-key: <ADMIN_KEY>
 *          removed = rows deleted (0 or 1 with ?name, the whole count without it)
 *   DELETE /api/board?check=1    → 200 { ok, check: true }  checks the key only, changes nothing (the gamekeeper panel)
 *
 * Errors: { error: <code> } with 400 (name | profanity | points | nights | gold | riders | time | run | json),
 *         405, 413 (too large), 429 (rate), 503 (not configured / store down).
 *
 * The ticket makes a forged score cost real time: the claimed playing time must have really passed since
 * the ticket was issued (less a small margin), and each ticket counts once. Sending the same score again
 * with the same ticket (the answer got lost) gives the same answer; under a corrected name it moves the
 * row that ticket wrote. The game runs in the browser, so this deters casual cheating; it cannot prove
 * a score was earned.
 *
 * One row per name (case-insensitive): a sorted set holds the best composite score per name, a hash
 * holds that run's details. Every change to the board is one Lua script, so concurrent requests are safe.
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN;
 *      ADMIN_KEY (optional) enables DELETE. Secrets are never logged.
 */

export const NIGHTS = 5;
export const TOP = 100;
export const MAX_BODY = 1024;
/* a class shares one school IP: the IP cap is loose, the per-name cap does the real limiting */
export const RATE = { perIp: 120, perName: 10, windowSec: 60, runsPerIpMinute: 90, runsPerIpHour: 1500, runsPerHour: 5000, hourSec: 3600 };
const PREFIX = 'percee:class';
export const KEYS = { z: `${PREFIX}:z`, h: `${PREFIX}:h`, rl: `${PREFIX}:rl:`, run: `${PREFIX}:run:` };
export const RUN_TTL = 6 * 3600;       // s
export const RUN_GRACE = 10;           // s of claimed time that need not have passed (rounding, clocks)

/* the game's scoring rules (percee/board.js POINTS, engine.js TUNE; test.mjs checks that they still match).
   Dawn comes at 180, 170, 160, 150, 140 s. */
export const LIMITS = [180, 170, 160, 150, 140];
export const SCORE = { escape: 1000, gold: 500, silver: 250, rider: 200, clean: 300, stone: 50, stones: 2, perSec: 5 };

/** the most a run can be worth with these nights, gold nights and riders (a night that is not gold is silver at best) */
export function pointsCeiling(nights, gold, riders) {
  const S = SCORE;
  let p = gold * S.gold + (nights - gold) * S.silver + riders * S.rider;
  for (let i = 0; i < nights; i++) p += S.escape + S.clean + S.stones * S.stone + S.perSec * LIMITS[i];
  return p;
}
export const maxPoints = (nights) => pointsCeiling(nights, nights, nights * 3);

/* ── names ── */
const BAD = [
  // FR
  'merde', 'putain', 'pute', 'connard', 'connasse', 'conne', 'con', 'salope', 'salaud', 'encule', 'enculer', 'nique', 'niquer', 'ntm', 'fdp',
  'batard', 'bite', 'couille', 'couilles', 'chatte', 'pd', 'pede', 'tapette', 'negre', 'bougnoule', 'gouine', 'branleur', 'abruti', 'debile', 'pouffiasse',
  // EN
  'fuck', 'fucker', 'fucking', 'shit', 'shits', 'shite', 'shitty', 'shitter', 'shitting', 'shithead', 'bullshit', 'dipshit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'whore', 'slut', 'nigger', 'nigga', 'fag', 'faggot',
  'retard', 'wanker', 'twat', 'porn', 'sex', 'penis', 'vagina', 'nazi', 'hitler', 'rape',
];
const BAD_SET = new Set(BAD);
/* roots that no real name contains, also caught inside one longer word */
const BAD_INSIDE = ['fuck', 'nigg', 'putain', 'encul', 'salope', 'connard', 'hitler'];
/* the same roots split over two words ("Fu ckers"), counted only from the start of the first word */
const BAD_ACROSS = ['fuck', 'nigg'];
/* "shit" is inside many real names (Harshit, Akshita, Dikshit, Shital, Yoshitaka), so it is only caught at the
   start or the end of a word, with these exceptions: whole names that begin with it… */
const SHIT_NAMES = new Set(['shita', 'shitaab', 'shital', 'shitala', 'shitali', 'shitan', 'shitansh', 'shitanshu', 'shitao', 'shitara', 'shitesh', 'shitian', 'shitij', 'shiting', 'shito', 'shitole', 'shitong', 'shitrit']);
/* …and the sounds that come before it at the end of a name: Har-, Dar-, Van-, Ya-, Ni-, Tu-, Ak-, Rak-, Dik- */
const NAME_BEFORE_SHIT = /(?:^|[^aeiou])[aiu][nr]?$|[aeiu]k$/;
const fold = (s) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/* characters that stand in for a letter, for the check only: digits, then Cyrillic and Greek lookalikes */
const STANDS_FOR = { 0: 'ou', 1: 'il', 3: 'e', 4: 'au', 5: 's', 7: 't', 8: 'b', 9: 'g', у: 'uy', υ: 'uy' };
for (const pair of 'аa еe оo рp сc хx кk мm тt вb нh іi јj ѕs һh ԁd αa βb εe ηn ιi κk νv οo ρp τt χx'.split(' ')) STANDS_FOR[pair[0]] = pair[1];

const looksLike = (word, bad) => word.length === bad.length && [...bad].every((c, i) => word[i] === c || STANDS_FOR[word[i]]?.includes(c));
const isBadWord = (word) => BAD_SET.has(word) || BAD.some((b) => looksLike(word, b));
const hasBadRoot = (word) => BAD_INSIDE.some((r) => {
  for (let i = 0; i + r.length <= word.length; i++) if (looksLike(word.slice(i, i + r.length), r)) return true;
  return false;
});
const hasShitEdge = (word) => {
  if (word.length <= 4 || SHIT_NAMES.has(word)) return false;
  if (looksLike(word.slice(0, 4), 'shit')) return true;
  return looksLike(word.slice(-4), 'shit') && !NAME_BEFORE_SHIT.test(word.slice(0, -4));
};
/** a blocked word on its own, or spelled across neighbouring words ("Fu ck"); never a match that merely spans two words of a name */
function isProfane(name) {
  const words = fold(name).split(/[\s'-]+/).filter(Boolean);
  if (words.some((w) => isBadWord(w) || hasBadRoot(w) || hasShitEdge(w))) return true;
  for (let i = 0; i < words.length; i++) {
    let joined = words[i];
    for (let j = i + 1; j < words.length; j++) {
      joined += words[j];
      if (joined.length > 3 && isBadWord(joined)) return true;
      if (BAD_ACROSS.some((r) => words[i].length < r.length && looksLike(joined.slice(0, r.length), r))) return true;
      if (words[i].length === 2 && hasShitEdge(joined)) return true;
    }
  }
  return false;
}

/** → { ok: true, name, key } or { ok: false, error: 'name' | 'profanity' } */
export function cleanName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'name' };
  const name = raw.normalize('NFC').replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < 1 || len > 24) return { ok: false, error: 'name' };
  if (!/^[\p{L}\p{M}\p{N}' -]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return { ok: false, error: 'name' };
  if (isProfane(name)) return { ok: false, error: 'profanity' };
  return { ok: true, name, key: name.toLocaleLowerCase('fr') };
}

const isInt = (x) => typeof x === 'number' && Number.isInteger(x);
const RUN_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** body → { ok: true, entry } or { ok: false, error } */
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'json' };
  const n = cleanName(body.name);
  if (!n.ok) return n;
  const { points, nights, gold, time } = body;
  const riders = body.riders ?? 0;
  if (!isInt(nights) || nights < 0 || nights > NIGHTS) return { ok: false, error: 'nights' };
  if (!isInt(gold) || gold < 0 || gold > nights) return { ok: false, error: 'gold' };
  if (!isInt(riders) || riders < gold * 3 || riders > nights * 3) return { ok: false, error: 'riders' };
  if (!isInt(points) || points < 0 || points % 5 !== 0 || points > pointsCeiling(nights, gold, riders)) return { ok: false, error: 'points' };
  if (!isInt(time) || time < 0 || time > 24 * 3600 || (nights > 0 && time < nights * 5)) return { ok: false, error: 'time' };
  if (typeof body.run !== 'string' || !RUN_ID.test(body.run)) return { ok: false, error: 'run' };
  const seed = typeof body.seed === 'string' ? body.seed.slice(0, 32) : '';
  return { ok: true, key: n.key, run: body.run, entry: { name: n.name, points, nights, gold, riders, time, seed } };
}

/** one number that sorts like the board: more points, then more nights, then less time */
export const composite = (e) => e.points * 1e7 + e.nights * 1e6 + (999999 - Math.min(999999, e.time));

/* Atomic: spend the run's ticket and keep the best score.
   KEYS: zset, hash, ticket · ARGV: member, score, json, score fingerprint, now ms, minimum elapsed ms
   → { 0 } when the ticket is refused, else { 1, improved 0|1, rank (0-based, -1 if the row is gone), total, stored json }.
   A ticket holds its start time. Once spent it holds "u|<improved>|<fingerprint>|<member>", followed by the row it
   replaced, if any ("\n<score>\n<json>"). The same score sent again gets the same answer. Under another name it
   moves the row this ticket wrote: the row it replaced comes back, and a better score under the new name stays.
   A row the gamekeeper removed, or that a later run replaced, is never brought back through its old ticket. */
export const SAVE_LUA = `
local function put(member, score, json)
  local cur = redis.call('ZSCORE', KEYS[1], member)
  if (not cur) or tonumber(score) > tonumber(cur) then
    local prev = ''
    if cur then prev = '\\n' .. cur .. '\\n' .. (redis.call('HGET', KEYS[2], member) or '') end
    redis.call('ZADD', KEYS[1], score, member)
    redis.call('HSET', KEYS[2], member, json)
    return 1, prev
  end
  return 0, ''
end
local v = redis.call('GET', KEYS[3])
if not v then return { 0 } end
if string.sub(v, 1, 2) == 'u|' then
  local was, print, owner, oldScore, oldJson = string.match(v, '^u|([01])|([^|]*)|([^\\n]*)\\n?([^\\n]*)\\n?(.*)$')
  if (not was) or print ~= ARGV[4] then return { 0 } end
  if owner == ARGV[1] then
    return { 1, tonumber(was), redis.call('ZREVRANK', KEYS[1], ARGV[1]) or -1, redis.call('ZCARD', KEYS[1]), redis.call('HGET', KEYS[2], ARGV[1]) or ARGV[3] }
  end
  if was == '1' then
    local held = redis.call('ZSCORE', KEYS[1], owner)
    if (not held) or tonumber(held) ~= tonumber(ARGV[2]) then return { 0 } end
    redis.call('ZREM', KEYS[1], owner)
    redis.call('HDEL', KEYS[2], owner)
    if oldScore ~= '' and oldJson ~= '' then
      redis.call('ZADD', KEYS[1], oldScore, owner)
      redis.call('HSET', KEYS[2], owner, oldJson)
    end
  end
else
  if tonumber(ARGV[5]) - tonumber(v) < tonumber(ARGV[6]) then return { 0 } end
end
local improved, prev = put(ARGV[1], ARGV[2], ARGV[3])
redis.call('SET', KEYS[3], 'u|' .. improved .. '|' .. ARGV[4] .. '|' .. ARGV[1] .. prev, 'KEEPTTL')
return { 1, improved, redis.call('ZREVRANK', KEYS[1], ARGV[1]), redis.call('ZCARD', KEYS[1]), redis.call('HGET', KEYS[2], ARGV[1]) }
`;

/* Counts one request on each key. A counter always ends up with an expiry, even one left without any.
   KEYS: counters · ARGV: window in seconds for each key (the first one serves the keys without their own) → { count, … } */
export const RATE_LUA = `
local out = {}
for i, key in ipairs(KEYS) do
  out[i] = redis.call('INCR', key)
  if redis.call('TTL', key) < 0 then redis.call('EXPIRE', key, ARGV[i] or ARGV[1]) end
end
return out
`;

/* KEYS: zset, hash · ARGV: member → rows removed */
export const REMOVE_LUA = `
local n = redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
return n
`;

/* KEYS: zset, hash → rows removed. Rate counters are left alone: they all expire within a minute. */
export const CLEAR_LUA = `
local n = redis.call('ZCARD', KEYS[1])
redis.call('DEL', KEYS[1], KEYS[2])
return n
`;

/* ── Upstash REST client (plain fetch) ── */
export function restRedis(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const base = url.replace(/\/+$/, '');
  return {
    async cmd(args) {
      const r = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw new Error(`redis http ${r.status}`);
      if (j.error) throw new Error('redis error');
      return j.result;
    },
  };
}

/* ── the handler ── */
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});
/* the CDN answers repeat reads for a few seconds, so a class (or a script) polling the board costs the store almost nothing */
const BOARD_CACHE = 'public, max-age=0, s-maxage=3, stale-while-revalidate=5';
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
      const q = new URL(req.url).searchParams;

      if (method === 'GET') {
        const headers = q.has('fresh') ? {} : { 'Cache-Control': BOARD_CACHE };
        const names = await db.cmd(['ZREVRANGE', KEYS.z, '0', String(TOP - 1)]);
        if (!names || !names.length) return json([], 200, headers);
        const rows = await db.cmd(['HMGET', KEYS.h, ...names]);
        return json(rows.map((s) => (s ? parseRow(s) : null)).filter(Boolean), 200, headers);
      }

      if (method === 'DELETE') {
        const admin = env.ADMIN_KEY;
        if (!admin) return json({ error: 'disabled' }, 403);
        if (!safeEq(req.headers.get('x-admin-key') || '', admin)) return json({ error: 'forbidden' }, 403);
        if (q.has('check')) return json({ ok: true, check: true });
        const only = q.get('name');
        if (only != null) {
          const n = cleanName(only);
          const key = n.ok ? n.key : only.trim().toLocaleLowerCase('fr');
          const removed = await db.cmd(['EVAL', REMOVE_LUA, '2', KEYS.z, KEYS.h, key]);
          return json({ ok: true, removed });
        }
        const removed = await db.cmd(['EVAL', CLEAR_LUA, '2', KEYS.z, KEYS.h]);
        return json({ ok: true, removed: removed || 0 });
      }

      // POST
      const windowSec = String(RATE.windowSec);
      if (q.get('run') === 'start') {
        const hourSec = String(RATE.hourSec);
        const ip = clientIp(req);
        const [minute, hour] = await db.cmd(['EVAL', RATE_LUA, '2', `${KEYS.rl}run:${ip}`, `${KEYS.rl}runh:${ip}`, windowSec, hourSec]);
        if (minute > RATE.runsPerIpMinute) return json({ error: 'rate' }, 429, { 'Retry-After': windowSec });
        if (hour > RATE.runsPerIpHour) return json({ error: 'rate' }, 429, { 'Retry-After': hourSec });
        // counted only once the IP is within its own limits, so one noisy address cannot use up everyone's tickets
        const [all] = await db.cmd(['EVAL', RATE_LUA, '1', `${KEYS.rl}runs`, hourSec]);
        if (all > RATE.runsPerHour) return json({ error: 'rate' }, 429, { 'Retry-After': hourSec });
        const run = crypto.randomUUID();
        await db.cmd(['SET', KEYS.run + run, String(now()), 'EX', String(RUN_TTL)]);
        return json({ run });
      }

      const declared = Number(req.headers.get('content-length') || 0);
      if (declared > MAX_BODY) return json({ error: 'too-large' }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > MAX_BODY) return json({ error: 'too-large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'json' }, 400); }
      const v = validate(body);
      if (!v.ok) return json({ error: v.error }, 400);

      const [byIp, byName] = await db.cmd(['EVAL', RATE_LUA, '2', `${KEYS.rl}ip:${clientIp(req)}`, `${KEYS.rl}name:${v.key}`, windowSec]);
      if (byIp > RATE.perIp || byName > RATE.perName) return json({ error: 'rate' }, 429, { 'Retry-After': windowSec });

      const e = v.entry;
      const entry = { ...e, at: now() };
      const fingerprint = JSON.stringify([e.points, e.nights, e.gold, e.riders, e.time]);
      const minElapsed = Math.max(0, e.time - RUN_GRACE) * 1000;
      const [saved, improved, rank, total, stored] = await db.cmd(['EVAL', SAVE_LUA, '3', KEYS.z, KEYS.h, KEYS.run + v.run,
        v.key, String(composite(entry)), JSON.stringify(entry), fingerprint, String(now()), String(minElapsed)]);
      if (saved !== 1) return json({ error: 'run' }, 400);
      return json({ ok: true, improved: improved === 1, rank: rank >= 0 ? rank + 1 : Math.max(1, total), total, best: parseRow(stored) || entry });
    } catch {
      return json({ error: 'store' }, 503);
    }
  };
}

const handle = createHandler();
export default { fetch: (req) => handle(req) };
