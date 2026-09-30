import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import crypto from 'node:crypto';
import { createServer } from '../server/index.js';
import { pack, unpack } from '../server/backup.js';

let srv, base, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robis-test-'));
  srv = createServer({ dataDir: dir, quiet: true });
  await new Promise((r) => srv.server.listen(0, r));
  base = `http://127.0.0.1:${srv.server.address().port}`;
});

after(async () => {
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(method, url, body, cookie) {
  const res = await fetch(base + '/api' + url, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cookie: res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') };
}

function join(cookie, msg) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { cookie } });
    const inbox = [];
    const waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      inbox.push(m);
      for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
    });
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', ...msg })); resolve({ ws, inbox, wait: (pred, ms = 3000) => {
      const found = inbox.find(pred);
      if (found) return Promise.resolve(found);
      return new Promise((res, rej) => { waiters.push({ pred, resolve: res }); setTimeout(() => rej(new Error('timeout')), ms); });
    } }); });
    ws.on('error', reject);
  });
}

test('seeded world is available', async () => {
  const { data } = await call('GET', '/stats');
  assert.equal(data.games, 11);
  const games = (await call('GET', '/games?sort=popular')).data.games;
  assert.ok(games.some((g) => g.name === 'Mega Fun Obby'));
  const cat = (await call('GET', '/catalog?type=Hat')).data.items;
  assert.ok(cat.length >= 10);
});

test('signup, login validation, avatar and purchases', async () => {
  assert.equal((await call('POST', '/auth/signup', { username: 'x', password: 'secret1' })).status, 400);
  const r = await call('POST', '/auth/signup', { username: 'Tester_1', password: 'secret123' });
  assert.equal(r.status, 200);
  const cookie = r.cookie;
  assert.equal((await call('POST', '/auth/signup', { username: 'tester_1', password: 'secret123' })).status, 400);
  assert.equal((await call('POST', '/auth/login', { username: 'Tester_1', password: 'nope' })).status, 401);
  const me = (await call('GET', '/auth/me', null, cookie)).data.user;
  assert.equal(me.username, 'Tester_1');
  // the first player on a fresh server is its admin and gets the admin perks
  assert.equal(me.isAdmin, true);
  assert.equal(me.robits, 1_000_100);
  assert.equal(me.membership, 'OutrageousBuildersClub');
  const all = (await call('GET', '/catalog')).data.items.length;
  assert.equal((await call('GET', `/users/${me.id}/inventory`)).data.items.length, all);
  // later players are regular players with 100 R$
  const second = await call('POST', '/auth/signup', { username: 'Second', password: 'secret123' });
  assert.equal(second.data.user.isAdmin, false);
  assert.equal(second.data.user.robits, 100);
  const c2 = second.cookie;
  // the built-in Robis account has no password and can't be logged into
  assert.equal((await call('POST', '/auth/login', { username: 'Robis', password: '' })).status, 401);
  assert.equal((await call('POST', '/friends/1/request', {}, cookie)).status, 400);
  // buy a cheap hat
  const cone = (await call('GET', '/catalog?q=Traffic')).data.items[0];
  const buy = await call('POST', `/catalog/${cone.id}/buy`, {}, c2);
  assert.equal(buy.status, 200);
  assert.equal(buy.data.robits, 75);
  assert.equal((await call('POST', `/catalog/${cone.id}/buy`, {}, c2)).status, 400);
  // can wear owned items only
  const crown = (await call('GET', '/catalog?q=Crown')).data.items[0];
  const av = await call('PUT', '/avatar', { bodyColors: { head: '#ff0000' }, wearing: [cone.id, crown.id] }, c2);
  assert.deepEqual(av.data.avatar.wearing, [cone.id]);
  assert.equal(av.data.avatar.bodyColors.head, '#ff0000');
  // stipend once per day, bigger with Builders Club
  assert.equal((await call('POST', '/economy/stipend', {}, c2)).data.amount, 25);
  assert.equal((await call('POST', '/economy/stipend', {}, c2)).status, 400);
  // no free Robits or memberships: players can't give themselves any
  assert.equal((await call('POST', '/economy/buy', { amount: 400 }, c2)).status, 404);
  assert.equal((await call('POST', '/economy/membership', { tier: 'TurboBuildersClub' }, c2)).status, 404);
  // admin panel: only admins, gift Robits, ban
  assert.equal((await call('GET', '/admin/overview', null, c2)).status, 403);
  const ov = (await call('GET', '/admin/overview', null, cookie)).data;
  const sid = ov.users.find((u) => u.username === 'Second').id;
  assert.equal((await call('POST', `/admin/users/${sid}/robits`, { amount: 1000 }, cookie)).data.user.robits, 1100);
  assert.equal((await call('POST', `/admin/users/${sid}/membership`, { tier: 'TurboBuildersClub' }, cookie)).status, 200);
  assert.equal((await call('GET', '/auth/me', null, c2)).data.user.stipend, 60);
  assert.equal((await call('POST', `/admin/users/${me.id}/ban`, { banned: true }, cookie)).status, 400);
  await call('POST', `/admin/users/${sid}/ban`, { banned: true, reason: 'test' }, cookie);
  assert.equal((await call('GET', '/auth/me', null, c2)).data.user, null);
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' })).status, 403);
  // the banned player's device can't make a new account or use another one
  const alt = await call('POST', '/auth/signup', { username: 'AltAcc', password: 'secret123' });
  assert.equal(alt.status, 200);
  const devSecond = c2.split('; ').find((c) => c.startsWith('robis_device='));
  assert.equal((await call('POST', '/auth/signup', { username: 'Sneaky', password: 'secret123' }, devSecond)).status, 403);
  assert.equal((await call('POST', '/auth/login', { username: 'AltAcc', password: 'secret123' }, devSecond)).status, 403);
  assert.equal((await call('GET', '/auth/me', null, devSecond + '; ' + alt.cookie.split('; ').find((c) => c.startsWith('robis_session=')))).data.user, null);
  // but the admin's own device and IP never get banned
  assert.equal((await call('GET', '/auth/me', null, cookie)).data.user.username, 'Tester_1');
  assert.equal((await call('POST', `/admin/users/${me.id}/ban`, { banned: true }, cookie)).status, 400);
  await call('POST', `/admin/users/${sid}/ban`, { banned: false }, cookie);
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' }, devSecond)).status, 200);
  assert.equal((await call('POST', '/auth/signup', { username: 'Sneaky', password: 'secret123' }, devSecond)).status, 200);
});

test('with an admin code only the code makes admins, and backups round-trip', async () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'robis-test-'));
  const s2 = createServer({ dataDir: d2, quiet: true, adminCode: 'test-code-1' });
  await new Promise((r) => s2.server.listen(0, r));
  const url = `http://127.0.0.1:${s2.server.address().port}/api`;
  const post = async (u, body, cookie) => {
    const res = await fetch(url + u, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json(), cookie: res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') };
  };
  try {
    const first = await post('/auth/signup', { username: 'Owner', password: 'secret123' });
    assert.equal(first.data.user.isAdmin, false);
    assert.equal(first.data.user.robits, 100);
    assert.equal((await post('/auth/admin-code', { code: 'nope' }, first.cookie)).status, 403);
    const promoted = await post('/auth/admin-code', { code: ' Test-Code-1 ' }, first.cookie);
    assert.equal(promoted.data.user.isAdmin, true);
    assert.equal(promoted.data.user.robits, 1_000_100);
    // encrypted backup of the whole data dir restores into an empty one
    s2.db.flush();
    const key = crypto.scryptSync('k', 'robis-backup', 32);
    const blob = pack(d2, key);
    const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'robis-test-'));
    unpack(blob, d3, key);
    const restored = JSON.parse(fs.readFileSync(path.join(d3, 'db.json'), 'utf8'));
    assert.ok(Object.values(restored.users).some((u) => u.username === 'Owner' && u.isAdmin));
    assert.equal(fs.readdirSync(path.join(d3, 'places')).length, fs.readdirSync(path.join(d2, 'places')).length);
    assert.throws(() => unpack(blob, d3, crypto.scryptSync('wrong', 'robis-backup', 32)));
    fs.rmSync(d3, { recursive: true, force: true });
  } finally {
    await s2.close();
    fs.rmSync(d2, { recursive: true, force: true });
  }
});

test('create, publish and play a game with scripts over WebSocket', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'Builder', password: 'secret123' });
  const { data } = await call('POST', '/games', { name: 'My Test Place', template: 'baseplate' }, cookie);
  const id = data.game.id;
  const { place } = (await call('GET', `/games/${id}/place`, null, cookie)).data;
  place.services.ServerScriptService.ch.push({
    c: 'Script', p: { Name: 'Hello', Source: `
      game.Players.PlayerAdded:Connect(function(p)
        local ls = Instance.new("Folder", p) ls.Name = "leaderstats"
        local v = Instance.new("IntValue", ls) v.Name = "Points" v.Value = 7
        print("welcome " .. p.Name)
      end)
      game.Players.PlayerAdded:Wait()
      local part = Instance.new("Part")
      part.Name = "Spawned"
      part.Parent = workspace
    ` },
  });
  assert.equal((await call('PUT', `/games/${id}/place`, { place }, cookie)).status, 200);
  // private game: others can't join; owner can
  const client = await join(cookie, { placeId: id });
  const welcome = await client.wait((m) => m.t === 'welcome');
  assert.ok(welcome.isDeveloper);
  const ch = await client.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  assert.ok(ch);
  await client.wait((m) => m.t === 'output' && m.text === 'welcome Builder');
  await client.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'add' && o[2].p.Name === 'Spawned'));
  // chat is filtered and broadcast
  client.ws.send(JSON.stringify({ t: 'chat', text: 'this is damn cool' }));
  const chat = await client.wait((m) => m.t === 'chat');
  assert.equal(chat.text, 'this is #### cool');
  // reset kills the character
  client.ws.send(JSON.stringify({ t: 'reset' }));
  await client.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'died'));
  client.ws.close();

  const other = (await call('POST', '/auth/signup', { username: 'Visitor', password: 'secret123' })).cookie;
  const v = await join(other, { placeId: id });
  const err = await v.wait((m) => m.t === 'error');
  assert.match(err.msg, /private/);
});

test('studio test sessions run unsaved places', async () => {
  const { cookie } = await call('POST', '/auth/login', { username: 'Builder', password: 'secret123' });
  const place = (await call('GET', '/templates/obby')).data.place;
  const c = await join(cookie, { test: place });
  const w = await c.wait((m) => m.t === 'welcome');
  assert.ok(w.isTest);
  c.ws.send(JSON.stringify({ t: 'exec', src: 'print("from command bar", #workspace.KillBricks:GetChildren())' }));
  const out = await c.wait((m) => m.t === 'output' && m.text.startsWith('from command bar'));
  assert.equal(out.text, 'from command bar 6');
  c.ws.close();
});

test('free Robits and self-joined memberships are taken back once', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'robis-test-'));
  const user = (id, name, extra) => ({ id, username: name, robits: 100, membership: 'None', created: 0, ...extra });
  fs.writeFileSync(path.join(d, 'db.json'), JSON.stringify({
    meta: { version: 1, nextIds: { user: 4, game: 1, item: 1, message: 1 } },
    users: {
      1: user(1, 'Rich', { robits: 2300, membership: 'OutrageousBuildersClub' }),
      2: user(2, 'Spent', { robits: 50, membership: 'BuildersClub' }),
      3: user(3, 'Gifted', { robits: 100, membership: 'TurboBuildersClub' }),
    },
    transactions: [
      { userId: 1, amount: 400, desc: 'Bought 400 Robits' }, { userId: 1, amount: 1700, desc: 'Bought 1,700 Robits' },
      { userId: 1, amount: 0, desc: 'Joined Outrageous Builders Club' },
      { userId: 2, amount: 800, desc: 'Bought 800 Robits' }, { userId: 2, amount: 0, desc: 'Joined Builders Club' },
      { userId: 3, amount: 0, desc: 'Joined Builders Club' }, { userId: 3, amount: 0, desc: 'Membership set by Admin' },
    ],
  }));
  let s = createServer({ dataDir: d, quiet: true });
  const u = s.db.data.users;
  assert.deepEqual([u[1].robits, u[1].membership], [200, 'None']);
  assert.deepEqual([u[2].robits, u[2].membership], [0, 'None']);
  assert.deepEqual([u[3].robits, u[3].membership], [100, 'TurboBuildersClub']);
  u[1].robits = 500;
  await s.close();
  s = createServer({ dataDir: d, quiet: true });
  assert.equal(s.db.data.users[1].robits, 500);
  await s.close();
  fs.rmSync(d, { recursive: true, force: true });
});

test('admins can kick and ban from the in-game chat', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const pleb = (await call('POST', '/auth/signup', { username: 'Griefer', password: 'secret123' })).cookie;
  const gameId = (await call('GET', '/games?sort=popular')).data.games[0].id;
  const a = await join(admin, { placeId: gameId });
  await a.wait((m) => m.t === 'welcome');
  const p = await join(pleb, { placeId: gameId });
  await p.wait((m) => m.t === 'welcome');
  p.ws.send(JSON.stringify({ t: 'chat', text: ':ban Tester_1' }));
  const echoed = await a.wait((m) => m.t === 'chat' && m.name === 'Griefer');
  assert.equal(echoed.text, ':ban Tester_1');
  a.ws.send(JSON.stringify({ t: 'chat', text: ':ban Griefer griefing' }));
  const kicked = await p.wait((m) => m.t === 'kick');
  assert.match(kicked.msg, /banned.*griefing/);
  assert.equal((await a.wait((m) => m.t === 'sys')).text, 'Banned Griefer.');
  assert.equal((await call('POST', '/auth/login', { username: 'Griefer', password: 'secret123' })).status, 403);
  a.ws.send(JSON.stringify({ t: 'chat', text: ':unban griefer' }));
  await a.wait((m) => m.t === 'sys' && m.text === 'Unbanned Griefer.');
  assert.equal((await call('POST', '/auth/login', { username: 'Griefer', password: 'secret123' })).status, 200);
  a.ws.close(); p.ws.close();
});

test('every showcase game starts without script errors', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'Tourist', password: 'secret123' });
  const games = (await call('GET', '/games?sort=popular&limit=50')).data.games;
  assert.ok(games.length >= 11);
  for (const g of games) {
    const c = await join(cookie, { placeId: g.id });
    await c.wait((m) => m.t === 'welcome');
    await new Promise((r) => setTimeout(r, 400));
    const errors = c.inbox.filter((m) => (m.t === 'output' && m.level === 'error') || m.t === 'error');
    assert.deepEqual(errors, [], g.name);
    c.ws.close();
  }
});
