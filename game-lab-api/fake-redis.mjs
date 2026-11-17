/*
 * In-memory stand-in for the Upstash REST client, with just the commands board.mjs uses.
 * Used by the unit test (game-lab-api/test.mjs) and the Vite dev server's /api/board mock.
 * Never part of the build or the deployed function.
 *
 * EVAL runs a JS port of SAVE_LUA (the only script board.mjs sends). Commands run one at a time on a
 * single thread, so the "keep the best" step is atomic here as it is inside Redis.
 */
import { SAVE_LUA } from './board.mjs';

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
        const ex = up.indexOf('EX'); s.set(k, { v: String(v), exp: ex >= 0 ? now() + Number(opt[ex + 1]) * 1000 : 0 });
        return 'OK';
      }
      case 'INCR': { const e = live(a[0]) || { v: '0', exp: 0 }; e.v = String(Number(e.v) + 1); s.set(a[0], e); return Number(e.v); }
      case 'DEL': { let n = 0; for (const k of a) { if (z.delete(k)) n++; if (h.delete(k)) n++; if (s.delete(k)) n++; } return n; }
      case 'ZREVRANGE': { const [k, start, stop] = a; return sorted(k).slice(Number(start), Number(stop) + 1).map((x) => x[0]); }
      case 'ZREM': { const m = zs(a[0]); let n = 0; for (const x of a.slice(1)) if (m.delete(x)) n++; return n; }
      case 'HDEL': { const m = h.get(a[0]) || new Map(); let n = 0; for (const x of a.slice(1)) if (m.delete(x)) n++; return n; }
      case 'HMGET': { const m = h.get(a[0]) || new Map(); return a.slice(1).map((f) => (m.has(f) ? m.get(f) : null)); }
      case 'EVAL': {
        const [script, nkeys, ...rest] = a;
        if (script !== SAVE_LUA || Number(nkeys) !== 2) throw new Error('unknown script');
        const [zk, hk, member, score, val] = rest;
        if (!z.has(zk)) z.set(zk, new Map());
        if (!h.has(hk)) h.set(hk, new Map());
        const old = z.get(zk).get(member);
        let improved = 0;
        if (old === undefined || Number(score) > old) { z.get(zk).set(member, Number(score)); h.get(hk).set(member, val); improved = 1; }
        const rank = sorted(zk).findIndex((x) => x[0] === member);
        return [improved, rank, z.get(zk).size, h.get(hk).get(member)];
      }
      default: throw new Error(`fake redis: ${name} not supported`);
    }
  }
  return {
    async cmd(args) { return run(args); },
    async pipeline(list) { return list.map(run); },
    setDown(v) { down = !!v; },
    clear() { z.clear(); h.clear(); s.clear(); },
  };
}
