/* Unit test for the class-board function, against the in-memory Redis.  Run: npm run test:api */
import assert from 'node:assert/strict';
import { createHandler, cleanName, maxPoints, pointsCeiling, composite, restRedis, KEYS, LIMITS, SCORE, RATE, RUN_TTL } from './board.mjs';
import { fakeRedis } from './fake-redis.mjs';
import { TUNE, NIGHTS } from '../src/game-lab/games/percee/engine.js';
import { POINTS, scoreNight, scoreRun } from '../src/game-lab/games/percee/board.js';
import { startClassRun, submitClassScore } from '../src/game-lab/games/percee/classApi.js';

let clock = 1_700_000_000_000;
const now = () => clock;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

const db = fakeRedis({ now });
const handle = createHandler({ redis: db, env: {}, now });
const URL0 = 'http://x/api/board';
let ip = 0;
let tickets = 0;
/** a ticket issued long enough ago for any claimed time */
const oldTicket = async () => {
  const id = `test-ticket-${String(++tickets).padStart(8, '0')}`;
  await db.cmd(['SET', KEYS.run + id, String(clock - 86_000_000), 'EX', String(RUN_TTL)]);
  return id;
};
const send = (body, { raw, from } = {}) => handle(new Request(URL0, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': from || `10.0.0.${++ip}` }, body: raw ?? JSON.stringify(body),
}));
/** a score with a valid ticket added */
const post = async (body, opts = {}) => send(body && typeof body === 'object' && !Array.isArray(body) && !('run' in body) ? { ...body, run: await oldTicket() } : body, opts);
const startRun = async (from = '10.1.1.1') => handle(new Request(`${URL0}?run=start`, { method: 'POST', headers: { 'x-forwarded-for': from } }));
const get = async () => { const r = await handle(new Request(`${URL0}?fresh=1`)); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); return r.json(); };
const run = (name, points, extra = {}) => ({ name, points, nights: 5, gold: 5, riders: 15, time: 600, ...extra });

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

await test('names: real names that contain a blocked word are accepted', () => {
  for (const ok of ['Harshit', 'Harshita', 'Akshit', 'Akshita', 'Rakshit', 'Rakshita', 'Anshita', 'Vanshita', 'Darshit', 'Yashita', 'Shital', 'Shitij', 'Yash Itani', 'Ansh Itkar', 'Dikshit',
    'Mohit', 'Rohit', 'Parikshit', 'Nishit', 'Tushit', 'Yoshitaka', 'Kinoshita', 'Shi Tao', 'Aryan', 'Aliza', 'Divyansh', 'Maurya', 'Assma', 'Sussex', 'Hancock', 'Nazia', 'Нина', 'Σοφία']) assert.equal(cleanName(ok).ok, true, ok);
});

await test('names: disguised spellings are caught, the name itself is never altered', () => {
  for (const bad of ['Shitface', 'Shitbag', 'Bigshit', 'sh1tface', 'Fu ckyou', 'Fu ckers', 'Jackshit', 'Horseshit', 'Sh itface', '5hitface', 'Big5hit',
    'Sh1t', 'SH1T', 'f4ck', 'F0CK', 'a55hole', 'b1tch', 'n1gger', 'Fu ck', 'F u c k', 'fu-ck', 'sh it', 'Rahul Fu ck', 'bullshit', 'Shitty', 'motherfucker',
    'f\u0443ck', 'fu\u0441k', 'sh\u0456t', '\u0455hit', 'f\u03c5ck']) assert.equal(cleanName(bad).error, 'profanity', bad);
  assert.equal(cleanName('Sofia 3').name, 'Sofia 3');
  assert.equal(cleanName('Нина').name, 'Нина');
});

await test('points ceiling follows the formula', () => {
  assert.equal(maxPoints(0), 0);
  assert.equal(maxPoints(1), 3400);
  assert.equal(maxPoints(5), 16500);
  assert.equal(pointsCeiling(1, 0, 0), 1000 + 250 + 300 + 100 + 900);
  assert.equal(pointsCeiling(1, 1, 3), maxPoints(1));
  assert.ok(composite({ points: 100, nights: 1, time: 999 }) > composite({ points: 95, nights: 5, time: 1 }));
  assert.ok(composite({ points: 100, nights: 2, time: 999 }) > composite({ points: 100, nights: 1, time: 1 }));
  assert.ok(composite({ points: 100, nights: 2, time: 10 }) > composite({ points: 100, nights: 2, time: 11 }));
});

await test('the API agrees with the game: dawn, stones, points', () => {
  assert.equal(LIMITS.length, NIGHTS);
  LIMITS.forEach((s, i) => assert.equal(s, TUNE.limit(i + 1), `night ${i + 1}`));
  assert.equal(SCORE.stones, TUNE.stones);
  assert.deepEqual([SCORE.escape, SCORE.silver, SCORE.gold, SCORE.rider, SCORE.clean, SCORE.stone, SCORE.perSec],
    [POINTS.escape, POINTS.medal[2], POINTS.medal[3], POINTS.rider, POINTS.clean, POINTS.stone, POINTS.perSec]);
  let best = 0;
  for (let n = 1; n <= NIGHTS; n++) best += scoreNight({ medal: 3, riders: 3, clean: true, stonesLeft: TUNE.stones, secsLeft: TUNE.limit(n) }).total;
  assert.equal(best, maxPoints(NIGHTS), 'a perfect run is exactly the ceiling');
});

await test('the scoring formula', () => {
  const night = scoreNight({ medal: 2, riders: 2, clean: true, stonesLeft: 1, secsLeft: 30.9 });
  assert.equal(night.total, 1000 + 250 + 400 + 300 + 50 + 150);
  assert.equal(scoreNight({}).total, 1000, 'bronze, nothing else');
  assert.equal(scoreRun([2000, 3000], 2), 4700);
  assert.equal(scoreRun([100], 5), 0, 'never below zero');
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
    [run('Eve', 100, { gold: 2, riders: 5 }), 'riders'], [run('Eve', 14755, { gold: 2, riders: 10 }), 'points'], [run('Eve', 2555, { nights: 1, gold: 0, riders: 0, time: 100 }), 'points'],
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

await test('run ticket: required, one use, real time must have passed', async () => {
  db.clear();
  const code = async (r) => [r.status, (await r.json()).error];
  assert.deepEqual(await code(await send(run('Tess', 100))), [400, 'run'], 'missing');
  assert.deepEqual(await code(await send(run('Tess', 100, { run: 42 }))), [400, 'run'], 'not a string');
  assert.deepEqual(await code(await send(run('Tess', 100, { run: 'unknown-ticket-000000' }))), [400, 'run'], 'unknown');

  let r = await startRun(); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const id = (await r.json()).run; assert.equal(typeof id, 'string');
  assert.equal(await db.cmd(['GET', KEYS.run + id]), String(clock));
  assert.equal(await db.cmd(['TTL', KEYS.run + id]), RUN_TTL);

  clock += 589_000;
  assert.deepEqual(await code(await send(run('Tess', 500, { run: id }))), [400, 'run'], '600 s claimed after 589 s');
  clock += 1_000;
  r = await send(run('Tess', 500, { run: id })); assert.equal(r.status, 200, '600 s claimed after 590 s');
  assert.equal((await r.json()).improved, true);
  assert.deepEqual(await code(await send(run('Tess', 900, { run: id }))), [400, 'run'], 'already used for another score');
  assert.equal((await get())[0].points, 500);

  const late = (await (await startRun()).json()).run;
  clock += (RUN_TTL + 1) * 1000;
  assert.deepEqual(await code(await send(run('Tess', 600, { run: late, time: 30 }))), [400, 'run'], 'expired');
});

await test('run ticket: a lost answer can be retried, a refused name does not spend it', async () => {
  db.clear();
  const id = await oldTicket();
  assert.equal((await send(run('Merde', 100, { run: id }))).status, 400);
  const first = await (await send(run('Rio', 700, { run: id }))).json();
  assert.equal(first.ok, true); assert.equal(first.improved, true);
  const again = await (await send(run('rio', 700, { run: id }))).json();
  assert.deepEqual({ ...again, best: null }, { ...first, best: null }, 'same answer');
  assert.equal((await get()).length, 1);

  const second = await oldTicket();
  await post(run('Rio', 900));
  const low = await (await send(run('Rio', 100, { run: second }))).json(); assert.equal(low.improved, false);
  assert.equal((await (await send(run('Rio', 100, { run: second }))).json()).improved, false, 'the retry still reports "not improved"');

  const admin = createHandler({ redis: db, env: { ADMIN_KEY: 'k' }, now });
  await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'k' } }));
  const after = await send(run('Rio', 100, { run: second })); assert.equal(after.status, 200);
  assert.equal((await after.json()).rank, 1, 'a retry after a reset answers without bringing the row back');
  assert.deepEqual(await get(), []);
});

await test('run ticket: a corrected name moves the row, and only that row', async () => {
  db.clear();
  const names = async () => (await get()).map((x) => `${x.name} ${x.points}`);
  // the answer got lost, the player fixes a typo
  let id = await oldTicket();
  await send(run('Camile', 700, { run: id }));
  let r = await send(run('Camille', 700, { run: id })); assert.equal(r.status, 200);
  let j = await r.json(); assert.equal(j.improved, true); assert.equal(j.best.name, 'Camille');
  assert.deepEqual(await names(), ['Camille 700']);
  r = await send(run('Camille', 700, { run: id })); assert.equal(r.status, 200, 'the corrected name can be retried too');
  assert.deepEqual(await names(), ['Camille 700']);
  // another score on the spent ticket stays refused, under any name
  assert.equal((await send(run('Camille', 705, { run: id }))).status, 400);
  assert.equal((await send(run('Someone', 705, { run: id }))).status, 400);
  // a better score under the new name is kept, and the row written by this ticket is still removed
  await post(run('Noor', 5000));
  r = await send(run('Noor', 700, { run: id })); j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.improved, false); assert.equal(j.best.points, 5000);
  assert.deepEqual(await names(), ['Noor 5000']);
  // the score that was replaced under the old name comes back, it is not lost
  db.clear();
  await post(run('Maya', 300));
  id = await oldTicket();
  await send(run('Maya', 900, { run: id }));
  await send(run('Maia', 900, { run: id }));
  assert.deepEqual(await names(), ['Maia 900', 'Maya 300']);
  // a ticket that changed nothing (a better score was already there) deletes nothing when renamed
  db.clear();
  await post(run('Sam', 5000));
  id = await oldTicket();
  await send(run('Sam', 100, { run: id }));
  r = await send(run('Samir', 100, { run: id })); assert.equal(r.status, 200);
  assert.deepEqual(await names(), ['Sam 5000', 'Samir 100']);
  // a row the gamekeeper removed does not return through its old ticket under a new name
  db.clear();
  const admin = createHandler({ redis: db, env: { ADMIN_KEY: 'k' }, now });
  id = await oldTicket();
  await send(run('Cheat', 900, { run: id }));
  await admin(new Request(`${URL0}?name=cheat`, { method: 'DELETE', headers: { 'x-admin-key': 'k' } }));
  assert.equal((await send(run('Cheat Two', 900, { run: id }))).status, 400);
  assert.deepEqual(await names(), []);
  // nor does a rename remove a better score the same player set afterwards
  id = await oldTicket();
  await send(run('Lea', 400, { run: id }));
  await post(run('Lea', 800));
  assert.equal((await send(run('Leah', 400, { run: id }))).status, 400);
  assert.deepEqual(await names(), ['Lea 800']);
});

await test('run ticket: limits per minute, per hour and for the whole class, all with an expiry', async () => {
  db.clear();
  const from = '5.5.5.5';
  for (let i = 0; i < RATE.runsPerIpMinute; i++) assert.equal((await startRun(from)).status, 200);
  assert.equal((await startRun(from)).status, 429, 'minute');
  assert.equal((await startRun('5.5.5.6')).status, 200, 'another address is not affected');
  for (const [key, ttl] of [[`${KEYS.rl}run:${from}`, RATE.windowSec], [`${KEYS.rl}runh:${from}`, RATE.hourSec], [`${KEYS.rl}runs`, RATE.hourSec]]) {
    const left = await db.cmd(['TTL', key]); assert.ok(left > 0 && left <= ttl, key);
  }
  // the hourly limit, staying under the limit of each minute
  db.clear();
  let sent = 0;
  while (sent < RATE.runsPerIpHour) {
    for (let i = 0; i < RATE.runsPerIpMinute && sent < RATE.runsPerIpHour; i++, sent++) assert.equal((await startRun(from)).status, 200);
    clock += 61_000;
  }
  const r = await startRun(from); assert.equal(r.status, 429, 'hour'); assert.equal(r.headers.get('retry-after'), String(RATE.hourSec));
  clock += RATE.hourSec * 1000;
  assert.equal((await startRun(from)).status, 200, 'free again after the hour');
  // a blocked address does not use up the tickets of the class
  db.clear();
  for (let i = 0; i < RATE.runsPerIpMinute + 50; i++) await startRun(from);
  assert.equal(Number(await db.cmd(['GET', `${KEYS.rl}runs`])), RATE.runsPerIpMinute);
  // the cap for everyone together
  db.clear();
  for (let i = 0; i < RATE.runsPerHour; i++) assert.equal((await startRun(`20.${i >> 16 & 255}.${i >> 8 & 255}.${i & 255}`)).status, 200);
  assert.equal((await startRun('30.0.0.1')).status, 429, 'whole class');
  clock += RATE.hourSec * 1000;
  assert.equal((await startRun('30.0.0.1')).status, 200);
  assert.equal(RUN_TTL, 6 * 3600);
  db.clear();
});

await test('the game asks again for a ticket after a failure, and reports a refused one', async () => {
  const realFetch = globalThis.fetch;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const script = (steps) => { let n = 0; globalThis.fetch = async () => { const s = steps[n++]; if (s instanceof Error) throw s; return s(); }; return () => n; };
  const waits = []; const pause = async (ms) => { waits.push(ms); };
  try {
    let calls = script([() => reply(503, {}), () => reply(429, {}), new Error('offline'), () => reply(200, { run: 'ticket-after-retries' })]);
    assert.equal(await startClassRun(pause), 'ticket-after-retries'); assert.equal(calls(), 4); assert.deepEqual(waits, [1000, 3000, 8000]);
    waits.length = 0;
    calls = script([() => reply(503, {}), () => reply(503, {}), () => reply(503, {}), () => reply(503, {}), () => reply(200, { run: 'too-late' })]);
    assert.equal(await startClassRun(pause), null, 'gives up after three waits'); assert.equal(calls(), 4);
    waits.length = 0;
    for (const status of [400, 403, 404, 500]) {
      calls = script([() => reply(status, {}), () => reply(200, { run: 'never-asked' })]);
      assert.equal(await startClassRun(pause), null, String(status)); assert.equal(calls(), 1, String(status));
    }
    assert.deepEqual(waits, [], 'other answers are not retried');
    script([() => reply(400, { error: 'run' })]);
    assert.deepEqual(await submitClassScore({}), { ok: false, error: 'run' });
    script([() => reply(400, { error: 'points' })]);
    assert.deepEqual(await submitClassScore({}), { ok: false, error: 'invalid' });
  } finally { globalThis.fetch = realFetch; }
});

await test('a rate counter always expires, even when the window ends between two requests', async () => {
  db.clear();
  const realCmd = db.cmd;
  const from = '8.8.8.8'; const key = `${KEYS.rl}ip:${from}`;
  assert.equal((await post(run('Win 0', 5), { from })).status, 200);
  clock += 59_999;
  // the window runs out at the very moment the next request is counted
  const racing = { cmd: async (args) => { if (args[0] === 'EVAL' && args[3] === key) clock += 2; return realCmd(args); } };
  const raced = createHandler({ redis: racing, env: {}, now });
  await raced(new Request(URL0, { method: 'POST', headers: { 'x-forwarded-for': from }, body: JSON.stringify(run('Win 1', 5, { run: await oldTicket() })) }));
  assert.ok(await db.cmd(['TTL', key]) > 0, 'the new counter has an expiry');
  for (let hour = 0; hour < RATE.perIp + 20; hour++) { clock += 3_600_000; assert.equal((await post(run(`Hour ${hour}`, 5), { from })).status, 200); }
  // a counter already stuck without an expiry (from before this fix) heals itself
  await db.cmd(['SET', key, '500']); assert.equal(await db.cmd(['TTL', key]), -1);
  assert.equal((await post(run('Stuck', 5), { from })).status, 429);
  assert.ok(await db.cmd(['TTL', key]) > 0);
  clock += 61_000;
  assert.equal((await post(run('Free', 5), { from })).status, 200);
});

await test('reading the board: cached by the CDN, fresh on request, never for writes', async () => {
  let r = await handle(new Request(URL0)); assert.match(r.headers.get('cache-control'), /s-maxage=\d+/); assert.match(r.headers.get('cache-control'), /stale-while-revalidate/);
  await post(run('Cached', 5));
  r = await handle(new Request(URL0)); assert.match(r.headers.get('cache-control'), /s-maxage/);
  r = await handle(new Request(`${URL0}?fresh=123`)); assert.equal(r.headers.get('cache-control'), 'no-store');
  r = await post(run('Written', 5)); assert.equal(r.headers.get('cache-control'), 'no-store');
  const admin = createHandler({ redis: db, env: { ADMIN_KEY: 'k' }, now });
  r = await admin(new Request(`${URL0}?name=written`, { method: 'DELETE', headers: { 'x-admin-key': 'k' } })); assert.equal(r.headers.get('cache-control'), 'no-store');
  db.setDown(true); r = await handle(new Request(URL0)); assert.equal(r.status, 503); assert.equal(r.headers.get('cache-control'), 'no-store'); db.setDown(false);
});

await test('deleting a row or the board leaves nothing behind', async () => {
  db.clear();
  await post(run('Gone', 5)); await post(run('Kept', 10));
  const admin = createHandler({ redis: db, env: { ADMIN_KEY: 'k' }, now });
  await admin(new Request(`${URL0}?name=gone`, { method: 'DELETE', headers: { 'x-admin-key': 'k' } }));
  assert.deepEqual(await db.cmd(['HMGET', KEYS.h, 'gone', 'kept']).then((x) => x.map(Boolean)), [false, true]);
  assert.equal(await db.cmd(['ZCARD', KEYS.z]), 1);
  await admin(new Request(URL0, { method: 'DELETE', headers: { 'x-admin-key': 'k' } }));
  assert.equal(await db.cmd(['ZCARD', KEYS.z]), 0);
  assert.deepEqual(await db.cmd(['HMGET', KEYS.h, 'kept']), [null]);
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
    return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
  };
  try {
    const c = restRedis({ KV_REST_API_URL: 'https://db.example/', KV_REST_API_TOKEN: 'tok' });
    assert.equal(await c.cmd(['SET', 'a', 'b']), 'OK');
    assert.equal(calls[0].url, 'https://db.example'); assert.equal(calls[0].auth, 'Bearer tok'); assert.deepEqual(calls[0].body, ['SET', 'a', 'b']);
  } finally { globalThis.fetch = realFetch; }
});

console.log(`\n${passed} tests passed`);
