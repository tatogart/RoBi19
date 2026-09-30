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
  assert.equal(data.games, 17);
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
  // a normal ban only blocks the account itself
  await call('POST', `/admin/users/${sid}/ban`, { banned: true, reason: 'test' }, cookie);
  const devOnly = c2.split('; ').find((c) => c.startsWith('robis_device='));
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' }, devOnly)).status, 403);
  assert.equal((await call('POST', '/auth/signup', { username: 'NewOne', password: 'secret123' }, devOnly)).status, 200);
  // a temporary ban lifts itself
  await call('POST', `/admin/users/${sid}/ban`, { banned: true, duration: '1h' }, cookie);
  assert.match((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' })).data.error, /Until/);
  srv.db.data.users[sid].banUntil = Date.now() - 1;
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' }, devOnly)).status, 200);
  // a device ban blocks the device too
  await call('POST', `/admin/users/${sid}/ban`, { banned: true, reason: 'test', device: true }, cookie);
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
  // fun commands
  a.ws.send(JSON.stringify({ t: 'chat', text: ':speed griefer 80' }));
  await a.wait((m) => m.t === 'sys' && m.text === ':speed → Griefer');
  a.ws.send(JSON.stringify({ t: 'chat', text: ':mute Griefer' }));
  await p.wait((m) => m.t === 'sys' && m.text === 'You have been muted.');
  p.ws.send(JSON.stringify({ t: 'chat', text: 'spam spam' }));
  await p.wait((m) => m.t === 'sys' && m.text === 'You are muted.');
  a.ws.send(JSON.stringify({ t: 'chat', text: ':kill others' }));
  await p.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'died'));
  a.ws.send(JSON.stringify({ t: 'chat', text: ':ban Griefer griefing' }));
  const kicked = await p.wait((m) => m.t === 'kick');
  assert.match(kicked.msg, /banned.*griefing/);
  await a.wait((m) => m.t === 'sys' && m.text === 'Banned Griefer.');
  assert.equal((await call('POST', '/auth/login', { username: 'Griefer', password: 'secret123' })).status, 403);
  a.ws.send(JSON.stringify({ t: 'chat', text: ':unban griefer' }));
  await a.wait((m) => m.t === 'sys' && m.text === 'Unbanned Griefer.');
  assert.equal((await call('POST', '/auth/login', { username: 'Griefer', password: 'secret123' })).status, 200);
  a.ws.close(); p.ws.close();
});

test('every showcase game starts without script errors', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'Tourist', password: 'secret123' });
  const games = (await call('GET', '/games?sort=popular&limit=50')).data.games;
  assert.ok(games.length >= 17);
  for (const g of games) {
    const c = await join(cookie, { placeId: g.id });
    await c.wait((m) => m.t === 'welcome');
    await new Promise((r) => setTimeout(r, 400));
    const errors = c.inbox.filter((m) => (m.t === 'output' && m.level === 'error') || m.t === 'error');
    assert.deepEqual(errors, [], g.name);
    c.ws.close();
  }
});

test('password guessing from one address is slowed down', async () => {
  let last;
  for (let i = 0; i < 22; i++) {
    last = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify({ username: 'Tester_1', password: 'wrong' }) });
  }
  assert.equal(last.status, 429);
  const other = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' }, body: JSON.stringify({ username: 'Tester_1', password: 'secret123' }) });
  assert.equal(other.status, 200);
});

test('changing the username costs R$1,000 and keeps the old name', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'OldName', password: 'secret123' });
  assert.equal((await call('POST', '/account/username', { username: 'NewName', password: 'secret123' }, cookie)).status, 400); // only 100 R$
  const uid = (await call('GET', '/auth/me', null, cookie)).data.user.id;
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  await call('POST', `/admin/users/${uid}/robits`, { amount: 1000 }, admin);
  assert.equal((await call('POST', '/account/username', { username: 'NewName', password: 'wrong' }, cookie)).status, 401);
  assert.equal((await call('POST', '/account/username', { username: 'tester_1', password: 'secret123' }, cookie)).status, 400);
  const r = await call('POST', '/account/username', { username: 'NewName', password: 'secret123' }, cookie);
  assert.equal(r.data.user.username, 'NewName');
  assert.equal(r.data.user.robits, 100);
  assert.deepEqual((await call('GET', `/users/${uid}`)).data.user.previousNames, ['OldName']);
  assert.equal((await call('POST', '/auth/login', { username: 'NewName', password: 'secret123' })).status, 200);
  assert.equal((await call('POST', '/account/password', { password: 'secret123', newPassword: 'another1' }, cookie)).status, 200);
  assert.equal((await call('POST', '/auth/login', { username: 'NewName', password: 'another1' })).status, 200);
});

test('friends can invite each other to a game', async () => {
  const a = (await call('POST', '/auth/signup', { username: 'Inviter', password: 'secret123' })).cookie;
  const b = (await call('POST', '/auth/signup', { username: 'Invitee', password: 'secret123' })).cookie;
  const bid = (await call('GET', '/auth/me', null, b)).data.user.id;
  const aid = (await call('GET', '/auth/me', null, a)).data.user.id;
  const gameId = (await call('GET', '/games?sort=popular')).data.games[0].id;
  assert.equal((await call('POST', '/invites', { toUserId: bid, gameId }, a)).status, 400); // not friends yet
  await call('POST', `/friends/${bid}/request`, {}, a);
  await call('POST', `/friends/${aid}/request`, {}, b);
  assert.equal((await call('POST', '/invites', { toUserId: bid, gameId, serverId: 'srv1' }, a)).status, 200);
  const { invites } = (await call('GET', '/invites', null, b)).data;
  assert.equal(invites.length, 1);
  assert.equal(invites[0].from.username, 'Inviter');
  assert.equal(invites[0].serverId, 'srv1');
  await call('POST', `/invites/${invites[0].id}/dismiss`, {}, b);
  assert.equal((await call('GET', '/invites', null, b)).data.invites.length, 0);
});

test('admins give players rights in the admin panel', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const mod = (await call('POST', '/auth/signup', { username: 'ModGuy', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'KidGuy', password: 'secret123' })).cookie;
  const modId = (await call('GET', '/auth/me', null, mod)).data.user.id;
  const kidId = (await call('GET', '/auth/me', null, kid)).data.user.id;
  assert.equal((await call('GET', '/admin/overview', null, mod)).status, 403);
  // only admins hand out rights
  assert.equal((await call('POST', `/admin/users/${modId}/perms`, { perms: ['moderator'] }, kid)).status, 403);
  const r = await call('POST', `/admin/users/${modId}/perms`, { perms: ['moderator', 'nonsense'] }, admin);
  assert.deepEqual(r.data.user.perms, ['moderator']);
  assert.deepEqual((await call('GET', '/auth/me', null, mod)).data.user.perms, ['moderator']);
  // a moderator can open the panel and ban, but not give Robits
  assert.equal((await call('GET', '/admin/overview', null, mod)).status, 200);
  assert.equal((await call('POST', `/admin/users/${kidId}/robits`, { amount: 5 }, mod)).status, 403);
  assert.equal((await call('POST', `/admin/users/${kidId}/ban`, { banned: true }, mod)).status, 200);
  assert.equal((await call('POST', `/admin/users/${kidId}/ban`, { banned: false }, mod)).status, 200);
  // game curators feature games
  const gid = (await call('GET', '/games?sort=popular')).data.games[0].id;
  assert.equal((await call('POST', `/games/${gid}/feature`, { featured: true }, mod)).status, 403);
  await call('POST', `/admin/users/${modId}/perms`, { perms: ['moderator', 'games'] }, admin);
  assert.equal((await call('POST', `/games/${gid}/feature`, { featured: true }, mod)).data.game.featured, true);
});

test('item creators make custom catalog items (BETA)', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const maker = (await call('POST', '/auth/signup', { username: 'Maker', password: 'secret123' })).cookie;
  const buyer = (await call('POST', '/auth/signup', { username: 'Buyer', password: 'secret123' })).cookie;
  const makerId = (await call('GET', '/auth/me', null, maker)).data.user.id;
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const tee = { type: 'TShirt', name: 'My Cool Tee', price: 10, data: { image: png } };
  assert.equal((await call('POST', '/catalog/create', tee, maker)).status, 403); // needs the right
  await call('POST', `/admin/users/${makerId}/perms`, { perms: ['items'] }, admin);
  assert.equal((await call('POST', '/catalog/create', { ...tee, data: { image: 'javascript:alert(1)' } }, maker)).status, 400);
  assert.equal((await call('POST', '/catalog/create', { type: 'Hat', name: 'Bad Hat', data: { model: 'nope' } }, maker)).status, 400);
  const made = (await call('POST', '/catalog/create', tee, maker)).data.item;
  assert.equal(made.custom, true);
  assert.equal(made.data.image, png);
  const hat = (await call('POST', '/catalog/create', { type: 'Hat', name: 'Green Crown', price: 0, data: { model: 'crown', color: '#00ff00', accent: '#<script>' } }, maker)).data.item;
  assert.deepEqual(hat.data, { model: 'crown', color: '#00ff00', accent: '#f8f8f8' });
  // sold in the catalog; the creator gets 70%
  assert.ok((await call('GET', '/catalog?q=Cool')).data.items.some((i) => i.id === made.id));
  assert.equal((await call('POST', `/catalog/${made.id}/buy`, {}, buyer)).status, 200);
  assert.equal((await call('GET', '/auth/me', null, maker)).data.user.robits, 107);
  // others can't delete it; the creator can
  assert.equal((await call('DELETE', `/catalog/${made.id}`, null, buyer)).status, 403);
  assert.equal((await call('DELETE', `/catalog/${made.id}`, null, maker)).status, 200);
  assert.equal((await call('GET', `/catalog/${made.id}`)).status, 404);
});

test('name badges are only given by admins', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const star = (await call('POST', '/auth/signup', { username: 'StarKid', password: 'secret123' })).cookie;
  const starId = (await call('GET', '/auth/me', null, star)).data.user.id;
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, []); // nobody gets badges by default
  // the official Robis account made the seeded games and has the check + Robis icon
  const game = (await call('GET', '/games?sort=popular')).data.games[0];
  assert.deepEqual(game.creator.flags, ['verified', 'staff']);
  assert.equal((await call('POST', `/admin/users/${starId}/flags`, { staff: true }, star)).status, 403);
  const r = await call('POST', `/admin/users/${starId}/flags`, { verified: true, bogus: true }, admin);
  assert.equal(r.status, 200);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, ['verified']);
  await call('POST', `/admin/users/${starId}/flags`, {}, admin);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, []);
});

test('players trade items and Robits', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const a = (await call('POST', '/auth/signup', { username: 'TraderA', password: 'secret123' })).cookie;
  const b = (await call('POST', '/auth/signup', { username: 'TraderB', password: 'secret123' })).cookie;
  const aid = (await call('GET', '/auth/me', null, a)).data.user.id;
  const bid = (await call('GET', '/auth/me', null, b)).data.user.id;
  const paid = (await call('GET', '/catalog')).data.items.filter((i) => i.price > 0);
  const [hat, shirt, free] = [paid[0], paid[1], (await call('GET', '/catalog')).data.items.find((i) => !i.price && !i.limited)];
  await call('POST', `/admin/users/${aid}/items`, { itemId: hat.id }, admin);
  await call('POST', `/admin/users/${bid}/items`, { itemId: shirt.id }, admin);
  await call('POST', `/admin/users/${bid}/robits`, { amount: 1000 }, admin);
  // can't trade items you don't have, free items, or with yourself
  assert.equal((await call('POST', '/trades', { toUserId: bid, give: [shirt.id], get: [hat.id] }, a)).status, 400);
  if (free) assert.equal((await call('POST', '/trades', { toUserId: bid, give: [free.id], get: [shirt.id] }, a)).status, 400);
  assert.equal((await call('POST', '/trades', { toUserId: aid, give: [hat.id], get: [] }, a)).status, 400);
  const r = await call('POST', '/trades', { toUserId: bid, give: [hat.id], get: [shirt.id], getRobits: 100 }, a);
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/trades/count', null, b)).data.inbound, 1);
  assert.equal((await call('GET', '/trades?type=outbound', null, a)).data.trades.length, 1);
  assert.equal((await call('POST', `/trades/${r.data.trade.id}/accept`, {}, a)).status, 403); // only the receiver accepts
  const before = (await call('GET', '/auth/me', null, a)).data.user.robits;
  assert.equal((await call('POST', `/trades/${r.data.trade.id}/accept`, {}, b)).status, 200);
  const invA = (await call('GET', `/users/${aid}/inventory`)).data.items.map((i) => i.id);
  const invB = (await call('GET', `/users/${bid}/inventory`)).data.items.map((i) => i.id);
  assert.ok(invA.includes(shirt.id) && !invA.includes(hat.id));
  assert.ok(invB.includes(hat.id) && !invB.includes(shirt.id));
  assert.equal((await call('GET', '/auth/me', null, a)).data.user.robits, before + 70); // 30% fee
  assert.equal((await call('GET', '/trades?type=completed', null, b)).data.trades.length, 1);
  // a trade fails if an item is gone by the time it's accepted
  const t2 = (await call('POST', '/trades', { toUserId: bid, give: [shirt.id], get: [hat.id] }, a)).data.trade;
  await call('POST', `/admin/users/${aid}/items/remove`, { itemId: shirt.id }, admin);
  assert.equal((await call('POST', `/trades/${t2.id}/accept`, {}, b)).status, 400);
  assert.equal((await call('GET', '/trades?type=inactive', null, a)).data.trades[0].status, 'failed');
  // privacy
  await call('POST', '/account/trade-privacy', { privacy: 'nobody' }, b);
  assert.equal((await call('POST', '/trades', { toUserId: bid, give: [], giveRobits: 5, get: [hat.id] }, a)).status, 400);
});

test('admins take items away', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const p = (await call('POST', '/auth/signup', { username: 'Hoarder', password: 'secret123' })).cookie;
  const pid = (await call('GET', '/auth/me', null, p)).data.user.id;
  await call('POST', `/admin/users/${pid}/items`, { all: true }, admin);
  const inv = (await call('GET', `/users/${pid}/inventory`)).data.items;
  const avatar = (await call('GET', '/avatar', null, p)).data.avatar;
  await call('PUT', '/avatar', { ...avatar, wearing: [inv[0].id] }, p);
  assert.equal((await call('POST', `/admin/users/${pid}/items/remove`, { itemId: inv[0].id }, p)).status, 403);
  assert.equal((await call('POST', `/admin/users/${pid}/items/remove`, { itemId: inv[0].id }, admin)).status, 200);
  assert.ok(!(await call('GET', `/users/${pid}/inventory`)).data.items.some((i) => i.id === inv[0].id));
  assert.ok(!(await call('GET', '/avatar', null, p)).data.avatar.wearing.includes(inv[0].id)); // taken off the avatar too
  assert.equal((await call('POST', `/admin/users/${pid}/items/remove`, { all: true }, admin)).data.removed, inv.length - 1);
  assert.equal((await call('GET', `/users/${pid}/inventory`)).data.items.length, 0);
});
