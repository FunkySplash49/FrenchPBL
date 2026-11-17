/* Unit test for the class-board function, against the in-memory Redis.  Run: npm run test:api */
import assert from 'node:assert/strict';
import { createHandler, cleanName, maxPoints, composite, restRedis } from './board.mjs';
import { fakeRedis } from './fake-redis.mjs';

let clock = 1_700_000_000_000;
const now = () => clock;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

const db = fakeRedis({ now });
const handle = createHandler({ redis: db, env: {}, now });
const URL0 = 'http://x/api/board';
let ip = 0;
const post = (body, { raw, from } = {}) => handle(new Request(URL0, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': from || `10.0.0.${++ip}` }, body: raw ?? JSON.stringify(body),
}));
const get = async () => { const r = await handle(new Request(URL0)); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); return r.json(); };
const run = (name, points, extra = {}) => ({ name, points, nights: 5, gold: 2, riders: 10, time: 600, ...extra });

await test('names: trims, collapses spaces, keeps accents, case-insensitive key', () => {
  assert.deepEqual(cleanName('  Chloé   Dupont '), { ok: true, name: 'Chloé Dupont', key: 'chloé dupont' });
  assert.equal(cleanName('Jean-Luc O’Neil').name, "Jean-Luc O'Neil");
  assert.equal(cleanName('Zoë2').ok, true);
  for (const bad of ['', '   ', 'a'.repeat(25), '<script>', 'Bob!', 'x_y', "'-'", 'emoji😀', 'tab\u0000']) assert.equal(cleanName(bad).ok, false, bad);
  assert.equal(cleanName('Merde').error, 'profanity');
  assert.equal(cleanName('big FUCKer').error, 'profanity');
  assert.equal(cleanName('Connard').error, 'profanity');
  for (const ok of ['Constance', 'Cassandra', 'Scott', 'Dick Turpin'.replace('Dick ', ''), 'Conrad', 'Basile']) assert.equal(cleanName(ok).ok, true, ok);
});

await test('points ceiling follows the formula', () => {
  assert.equal(maxPoints(0), 0);
  assert.equal(maxPoints(1), 3400);
  assert.equal(maxPoints(5), 16500);
  assert.ok(composite({ points: 100, nights: 1, time: 999 }) > composite({ points: 95, nights: 5, time: 1 }));
  assert.ok(composite({ points: 100, nights: 2, time: 999 }) > composite({ points: 100, nights: 1, time: 1 }));
  assert.ok(composite({ points: 100, nights: 2, time: 10 }) > composite({ points: 100, nights: 2, time: 11 }));
});

await test('empty board → []', async () => { assert.deepEqual(await get(), []); });

await test('submit and rank', async () => {
  let r = await post(run('Alice', 9000)); assert.equal(r.status, 200);
  let j = await r.json(); assert.equal(j.rank, 1); assert.equal(j.total, 1); assert.equal(j.improved, true);
  r = await post(run('Bob', 12000)); j = await r.json(); assert.equal(j.rank, 1); assert.equal(j.total, 2);
  r = await post(run('Chloé', 500, { nights: 1, gold: 0, riders: 1, time: 120 })); j = await r.json(); assert.equal(j.rank, 3);
  const b = await get();
  assert.deepEqual(b.map((x) => x.name), ['Bob', 'Alice', 'Chloé']);
  assert.deepEqual(Object.keys(b[0]).sort(), ['at', 'gold', 'name', 'nights', 'points', 'riders', 'time']);
});

await test('same name (any case) keeps only the best', async () => {
  let j = await (await post(run('alice', 8000))).json();
  assert.equal(j.improved, false); assert.equal(j.best.points, 9000); assert.equal(j.best.name, 'Alice'); assert.equal(j.rank, 2);
  j = await (await post(run('ALICE', 15000))).json();
  assert.equal(j.improved, true); assert.equal(j.rank, 1); assert.equal(j.total, 3);
  const b = await get();
  assert.equal(b.length, 3); assert.equal(b[0].name, 'ALICE'); assert.equal(b[0].points, 15000);
  // equal points: fewer seconds wins
  await post(run('Dan', 12000, { time: 500 }));
  assert.deepEqual((await get()).map((x) => x.name), ['ALICE', 'Dan', 'Bob', 'Chloé']);
});

await test('bad payloads are rejected', async () => {
  const cases = [
    [run('', 100), 'name'], [run('No<b>', 100), 'name'], [run('Merde', 100), 'profanity'],
    [run('Eve', 16505), 'points'], [run('Eve', 101), 'points'], [run('Eve', -5), 'points'], [run('Eve', '100'), 'points'],
    [run('Eve', 3500, { nights: 1, gold: 1, riders: 3, time: 100 }), 'points'],
    [run('Eve', 100, { nights: 6 }), 'nights'], [run('Eve', 100, { nights: 1.5 }), 'nights'],
    [run('Eve', 100, { gold: 6 }), 'gold'], [run('Eve', 100, { riders: 16 }), 'riders'],
    [run('Eve', 100, { time: -1 }), 'time'], [run('Eve', 100, { time: 1e9 }), 'time'],
    [[1, 2], 'json'], [null, 'json'],
  ];
  for (const [body, err] of cases) {
    const r = await post(body); assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal((await r.json()).error, err, JSON.stringify(body));
  }
  let r = await post(null, { raw: '{nope' }); assert.equal(r.status, 400);
  r = await post(null, { raw: JSON.stringify({ ...run('Eve', 100), pad: 'x'.repeat(1100) }) }); assert.equal(r.status, 413);
  assert.equal((await get()).length, 4);
});

await test('rate limit: 10 a minute per name, 120 per IP (a class shares one IP)', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await post(run('Rate', 100 + i * 5), { from: '9.9.9.9' })).status, 200);
  let r = await post(run('rate', 999 * 5), { from: '7.7.7.7' }); assert.equal(r.status, 429);
  assert.equal((await post(run('Other', 100), { from: '9.9.9.9' })).status, 200);
  clock += 61_000;
  assert.equal((await post(run('Rate', 100), { from: '9.9.9.9' })).status, 200);
  clock += 61_000;
  for (let i = 0; i < 120; i++) await post(run(`Ip ${i}`, 5), { from: '6.6.6.6' });
  r = await post(run('Ip last', 5), { from: '6.6.6.6' }); assert.equal(r.status, 429);
  db.clear();
  await Promise.all(['Bob', 'ALICE', 'Dan', 'Chloé'].map((n, i) => post(run(n, 1000 - i * 100))));
});

await test('50 classmates at once', async () => {
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => post(run(`Élève ${i}`, (i + 1) * 100))));
  assert.ok(rs.every((r) => r.status === 200));
  const b = await get(); assert.equal(b.length, 54);
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].points >= b[i].points);
});

await test('top 100 only', async () => {
  await Promise.all(Array.from({ length: 60 }, (_, i) => post(run(`Extra ${i}`, 5))));
  assert.equal((await get()).length, 100);
});

await test('DELETE: disabled without ADMIN_KEY, guarded with it', async () => {
  let r = await handle(new Request(URL0, { method: 'DELETE' })); assert.equal(r.status, 403); assert.equal((await r.json()).error, 'disabled');
  const admin = createHandler({ redis: db, env: { ADMIN_KEY: 'k-123' }, now });
  r = await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'wrong' } })); assert.equal(r.status, 403);
  r = await admin(new Request(`${URL0}?check=1`, { method: 'DELETE', headers: { 'x-admin-key': 'wrong' } })); assert.equal(r.status, 403);
  r = await admin(new Request(`${URL0}?check=1`, { method: 'DELETE' })); assert.equal(r.status, 403);
  const before = (await get()).length; assert.ok(before > 1);
  r = await admin(new Request(`${URL0}?check=1`, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } }));
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, check: true });
  assert.equal((await get()).length, before, 'a key check changes nothing');
  r = await admin(new Request(`${URL0}?name=nobody%20here`, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } })); assert.equal((await r.json()).removed, 0);
  r = await admin(new Request(`${URL0}?name=dan`, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } })); assert.equal((await r.json()).removed, 1);
  assert.ok(!(await get()).some((x) => x.name === 'Dan'));
  const left = await db.cmd(['ZCARD', 'percee:class:z']); assert.ok(left > 100);   // more rows than GET shows (top 100)
  r = await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } })); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, removed: left });
  assert.deepEqual(await get(), []);
  // after a reset the board works as before: a score (even one re-sent from a pending save) lands as rank 1
  r = await post(run('Dan', 300)); assert.equal(r.status, 200); assert.equal((await r.json()).rank, 1);
  r = await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } }));
  assert.deepEqual(await r.json(), { ok: true, removed: 1 });
  r = await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'k-123' } }));
  assert.deepEqual(await r.json(), { ok: true, removed: 0 }, 'resetting an empty board is fine');
});

await test('other methods → 405; store down → 503; no env → 503', async () => {
  assert.equal((await handle(new Request(URL0, { method: 'PUT', body: '{}' }))).status, 405);
  db.setDown(true); assert.equal((await handle(new Request(URL0))).status, 503); db.setDown(false);
  const none = createHandler({ env: {} });
  assert.equal((await none(new Request(URL0))).status, 503);
  assert.equal(restRedis({}), null);
  assert.notEqual(restRedis({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }), null);
  assert.notEqual(restRedis({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }), null);
});

await test('REST client speaks the Upstash format', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify(Array.isArray(body[0]) ? body.map(() => ({ result: 1 })) : { result: 'OK' }), { status: 200 });
  };
  try {
    const c = restRedis({ KV_REST_API_URL: 'https://db.example/', KV_REST_API_TOKEN: 'tok' });
    assert.equal(await c.cmd(['SET', 'a', 'b']), 'OK');
    assert.deepEqual(await c.pipeline([['INCR', 'a'], ['INCR', 'b']]), [1, 1]);
    assert.equal(calls[0].url, 'https://db.example'); assert.equal(calls[0].auth, 'Bearer tok'); assert.deepEqual(calls[0].body, ['SET', 'a', 'b']);
    assert.equal(calls[1].url, 'https://db.example/pipeline'); assert.deepEqual(calls[1].body, [['INCR', 'a'], ['INCR', 'b']]);
  } finally { globalThis.fetch = realFetch; }
});

console.log(`\n${passed} tests passed`);
