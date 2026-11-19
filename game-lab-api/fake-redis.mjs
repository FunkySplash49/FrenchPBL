/*
 * In-memory stand-in for the Upstash REST client, with just the commands board.mjs uses.
 * Used by the unit test (game-lab-api/test.mjs) and the Vite dev server's /api/board mock.
 * Never part of the build or the deployed function.
 *
 * EVAL runs a JS port of each script board.mjs sends. Commands run one at a time on a single thread,
 * so every script is atomic here as it is inside Redis.
 */
import { SAVE_LUA, RATE_LUA, REMOVE_LUA, CLEAR_LUA } from './board.mjs';

export function fakeRedis({ now = () => Date.now() } = {}) {
  const z = new Map();      // key → Map(member → score)
  const h = new Map();      // key → Map(field → value)
  const s = new Map();      // key → { v, exp }
  const live = (k) => { const e = s.get(k); if (e && e.exp && e.exp <= now()) { s.delete(k); return null; } return e || null; };
  const zs = (k) => z.get(k) || new Map();
  const sorted = (k) => [...zs(k).entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  let down = false;

  function run([name, ...a]) {
    if (down) throw new Error('redis down');
    switch (String(name).toUpperCase()) {
      case 'SET': {
        const [k, v, ...opt] = a; const up = opt.map((o) => String(o).toUpperCase());
        if (up.includes('NX') && live(k)) return null;
        const ex = up.indexOf('EX');
        const exp = ex >= 0 ? now() + Number(opt[ex + 1]) * 1000 : up.includes('KEEPTTL') ? (live(k)?.exp || 0) : 0;
        s.set(k, { v: String(v), exp });
        return 'OK';
      }
      case 'GET': { const e = live(a[0]); return e ? e.v : null; }
      case 'TTL': { const e = live(a[0]); return !e ? -2 : e.exp ? Math.ceil((e.exp - now()) / 1000) : -1; }
      case 'EXPIRE': { const e = live(a[0]); if (!e) return 0; e.exp = now() + Number(a[1]) * 1000; return 1; }
      case 'INCR': { const e = live(a[0]) || { v: '0', exp: 0 }; e.v = String(Number(e.v) + 1); s.set(a[0], e); return Number(e.v); }
      case 'DEL': { let n = 0; for (const k of a) { if (z.delete(k)) n++; if (h.delete(k)) n++; if (s.delete(k)) n++; } return n; }
      case 'ZREVRANGE': { const [k, start, stop] = a; return sorted(k).slice(Number(start), Number(stop) + 1).map((x) => x[0]); }
      case 'ZCARD': return z.has(a[0]) ? z.get(a[0]).size : 0;
      case 'ZREM': { const m = zs(a[0]); let n = 0; for (const x of a.slice(1)) if (m.delete(x)) n++; return n; }
      case 'HDEL': { const m = h.get(a[0]) || new Map(); let n = 0; for (const x of a.slice(1)) if (m.delete(x)) n++; return n; }
      case 'HMGET': { const m = h.get(a[0]) || new Map(); return a.slice(1).map((f) => (m.has(f) ? m.get(f) : null)); }
      case 'EVAL': {
        const [script, nkeys, ...rest] = a;
        const keys = rest.slice(0, Number(nkeys)); const argv = rest.slice(Number(nkeys));
        if (script === RATE_LUA) {
          return keys.map((k, i) => { const n = run(['INCR', k]); if (run(['TTL', k]) < 0) run(['EXPIRE', k, argv[i] ?? argv[0]]); return n; });
        }
        if (script === REMOVE_LUA) { const n = run(['ZREM', keys[0], argv[0]]); run(['HDEL', keys[1], argv[0]]); return n; }
        if (script === CLEAR_LUA) { const n = run(['ZCARD', keys[0]]); run(['DEL', keys[0], keys[1]]); return n; }
        if (script !== SAVE_LUA) throw new Error('unknown script');
        const [zk, hk, ticket] = keys; const [member, score, val, fingerprint, at, minElapsed] = argv;
        if (!z.has(zk)) z.set(zk, new Map());
        if (!h.has(hk)) h.set(hk, new Map());
        const rankOf = () => sorted(zk).findIndex((x) => x[0] === member);
        const put = () => {
          const cur = z.get(zk).get(member);
          if (cur !== undefined && Number(score) <= cur) return [0, ''];
          const prev = cur !== undefined ? `\n${cur}\n${h.get(hk).get(member) ?? ''}` : '';
          z.get(zk).set(member, Number(score)); h.get(hk).set(member, val);
          return [1, prev];
        };
        const v = run(['GET', ticket]);
        if (v === null) return [0];
        if (v.startsWith('u|')) {
          const m = v.match(/^u\|([01])\|([^|]*)\|([^\n]*)\n?([^\n]*)\n?([\s\S]*)$/);
          if (!m || m[2] !== fingerprint) return [0];
          const [, was, , owner, oldScore, oldJson] = m;
          if (owner === member) return [1, Number(was), rankOf(), z.get(zk).size, h.get(hk).get(member) ?? val];
          if (was === '1') {
            const held = z.get(zk).get(owner);
            if (held === undefined || held !== Number(score)) return [0];
            z.get(zk).delete(owner); h.get(hk).delete(owner);
            if (oldScore !== '' && oldJson !== '') { z.get(zk).set(owner, Number(oldScore)); h.get(hk).set(owner, oldJson); }
          }
        } else if (Number(at) - Number(v) < Number(minElapsed)) return [0];
        const [improved, prev] = put();
        run(['SET', ticket, `u|${improved}|${fingerprint}|${member}${prev}`, 'KEEPTTL']);
        return [1, improved, rankOf(), z.get(zk).size, h.get(hk).get(member)];
      }
      default: throw new Error(`fake redis: ${name} not supported`);
    }
  }
  return {
    async cmd(args) { return run(args); },
    setDown(v) { down = !!v; },
    clear() { z.clear(); h.clear(); s.clear(); },
  };
}
