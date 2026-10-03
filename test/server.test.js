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
      return new Promise((res, rej) => { waiters.push({ pred, resolve: res }); setTimeout(() => { if (process.env.DEBUG_WS) console.log('INBOX', JSON.stringify(inbox.map((m) => m.t === 'tick' ? 'tick' : m)).slice(0, 3000)); rej(new Error('timeout')); }, ms); });
    } }); });
    ws.on('error', reject);
  });
}

test('seeded world is available', async () => {
  const { data } = await call('GET', '/stats');
  assert.equal(data.games, 21); // 20 showcase games + The Hunt hub
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
  const club = await call('POST', '/economy/membership', { tier: 'TurboBuildersClub' }, c2); // costs Robits now
  assert.equal(club.status, 400);
  assert.match(club.data.error, /more Robits/);
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
  // pets: one of the pet models in your own colours
  const pet = (await call('POST', '/catalog/create', { type: 'Pet', name: 'Purple Dragon', price: 5, data: { model: 'dragon', color: '#7a3cff', accent: '#00e5ff' } }, maker)).data.item;
  assert.deepEqual([pet.type, pet.data], ['Pet', { model: 'dragon', color: '#7a3cff', accent: '#00e5ff' }]);
  assert.equal((await call('POST', '/catalog/create', { type: 'Pet', name: 'Bad Pet', data: { model: 'crown' } }, maker)).status, 400);
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
  assert.deepEqual(game.creator.flags, ['staff', 'verified']);
  assert.equal((await call('POST', `/admin/users/${starId}/flags`, { staff: true }, star)).status, 403);
  const r = await call('POST', `/admin/users/${starId}/flags`, { verified: true, bogus: true }, admin);
  assert.equal(r.status, 200);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, ['verified']);
  await call('POST', `/admin/users/${starId}/flags`, {}, admin);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, []);
  // one badge at a time (Badges tab)
  await call('POST', `/admin/users/${starId}/flags`, { flag: 'vip', on: true }, admin);
  await call('POST', `/admin/users/${starId}/flags`, { flag: 'partner', on: true }, admin);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, ['partner', 'vip']);
  await call('POST', `/admin/users/${starId}/flags`, { flag: 'vip', on: false }, admin);
  assert.deepEqual((await call('GET', `/users/${starId}`)).data.user.flags, ['partner']);
  assert.equal((await call('POST', `/admin/users/${starId}/flags`, { flag: 'bogus', on: true }, admin)).status, 400);
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
  assert.equal(r.status, 200, JSON.stringify(r.data));
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

test('Limited Creators make Limited items with a stock', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const maker = (await call('POST', '/auth/signup', { username: 'LimMaker', password: 'secret123' })).cookie;
  const buyer = (await call('POST', '/auth/signup', { username: 'LimBuyer', password: 'secret123' })).cookie;
  const makerId = (await call('GET', '/auth/me', null, maker)).data.user.id;
  const buyerId = (await call('GET', '/auth/me', null, buyer)).data.user.id;
  const hat = { type: 'Hat', name: 'Golden Lid', price: 10, data: { model: 'beanie', color: '#ffcc00' }, limited: true, stock: 1 };
  assert.equal((await call('POST', '/catalog/create', hat, maker)).status, 403);
  // the Item Creator right alone isn't enough for Limiteds
  await call('POST', `/admin/users/${makerId}/perms`, { perms: ['items'] }, admin);
  assert.equal((await call('POST', '/catalog/create', hat, maker)).status, 403);
  // Limited Creator alone can only make Limiteds
  await call('POST', `/admin/users/${makerId}/perms`, { perms: ['limiteds'] }, admin);
  assert.equal((await call('POST', '/catalog/create', { ...hat, limited: false }, maker)).status, 403);
  assert.equal((await call('POST', '/catalog/create', { ...hat, stock: 0 }, maker)).status, 400);
  const r = await call('POST', '/catalog/create', hat, maker);
  assert.equal(r.status, 200);
  assert.equal(r.data.item.limited, true);
  assert.equal(r.data.item.remaining, 1);
  assert.equal(r.data.item.owned, false); // the whole stock is for sale
  await call('POST', `/admin/users/${buyerId}/robits`, { amount: 100 }, admin);
  assert.equal((await call('POST', `/catalog/${r.data.item.id}/buy`, {}, buyer)).status, 200);
  assert.equal((await call('GET', `/catalog/${r.data.item.id}`)).data.item.remaining, 0);
  assert.equal((await call('POST', `/catalog/${r.data.item.id}/buy`, {}, admin)).status, 400); // sold out
  assert.equal((await call('DELETE', `/catalog/${r.data.item.id}`, null, maker)).status, 400); // already owned by a player
  // turning an existing item into a Limited
  const plain = (await call('GET', '/catalog')).data.items.find((i) => !i.limited && i.price > 0);
  assert.equal((await call('POST', `/catalog/${plain.id}/limited`, { stock: 5 }, buyer)).status, 403);
  const l = await call('POST', `/catalog/${plain.id}/limited`, { stock: 5 }, maker);
  assert.equal(l.data.item.limited, true);
  assert.equal(l.data.item.remaining, 5);
  assert.equal((await call('POST', `/catalog/${plain.id}/limited`, { limited: false }, maker)).data.item.limited, false);
});

test('Limited copies have serial numbers that move with trades', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const a = (await call('POST', '/auth/signup', { username: 'SerialA', password: 'secret123' })).cookie;
  const b = (await call('POST', '/auth/signup', { username: 'SerialB', password: 'secret123' })).cookie;
  const aid = (await call('GET', '/auth/me', null, a)).data.user.id;
  const bid = (await call('GET', '/auth/me', null, b)).data.user.id;
  const it = (await call('GET', '/catalog')).data.items.find((i) => !i.limited && i.price > 0 && i.price < 500);
  await call('POST', `/catalog/${it.id}/limited`, { stock: 10 }, admin);
  for (const c of [a, b]) {
    await call('POST', `/admin/users/${c === a ? aid : bid}/robits`, { amount: 1000 }, admin);
  }
  // players who already owned it got the first numbers
  const adminSerial = (await call('GET', `/catalog/${it.id}`, null, admin)).data.item.serial;
  assert.ok(adminSerial >= 1);
  const n = (await call('GET', `/catalog/${it.id}`)).data.item.lastSerial;
  await call('POST', `/catalog/${it.id}/buy`, {}, a);
  assert.equal((await call('GET', `/catalog/${it.id}`, null, a)).data.item.serial, n + 1);
  assert.equal((await call('GET', `/users/${aid}/inventory`)).data.items.find((i) => i.id === it.id).serial, n + 1);
  // trade the copy: #2 goes to B
  const other = (await call('GET', '/catalog')).data.items.find((i) => !i.limited && i.price > 0 && i.id !== it.id);
  await call('POST', `/admin/users/${bid}/items`, { itemId: other.id }, admin);
  const t = (await call('POST', '/trades', { toUserId: bid, give: [it.id], get: [other.id] }, a)).data.trade;
  assert.equal(t.give[0].serial, n + 1);
  await call('POST', `/trades/${t.id}/accept`, {}, b);
  assert.equal((await call('GET', `/catalog/${it.id}`, null, b)).data.item.serial, n + 1);
  const owners = (await call('GET', `/catalog/${it.id}/owners`)).data.owners;
  assert.ok(owners.some((o) => o.serial === adminSerial && o.user.username === 'Tester_1'));
  assert.ok(owners.some((o) => o.serial === n + 1 && o.user.username === 'SerialB'));
  assert.ok(!owners.some((o) => o.user.username === 'SerialA'));
  // the next buyer gets a new number
  await call('POST', `/catalog/${it.id}/buy`, {}, a);
  assert.equal((await call('GET', `/catalog/${it.id}`, null, a)).data.item.serial, n + 2);
});

test('deleting an account does not ban the device', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const gone = (await call('POST', '/auth/signup', { username: 'GoneSoon', password: 'secret123' })).cookie;
  const goneId = (await call('GET', '/auth/me', null, gone)).data.user.id;
  const friend = (await call('POST', '/auth/signup', { username: 'StaysHere', password: 'secret123' })).cookie;
  const friendId = (await call('GET', '/auth/me', null, friend)).data.user.id;
  await call('POST', `/friends/${friendId}/request`, {}, gone);
  await call('POST', `/friends/${goneId}/request`, {}, friend);
  assert.equal((await call('POST', `/admin/users/${goneId}/delete`, {}, friend)).status, 403);
  assert.equal((await call('POST', `/admin/users/${goneId}/delete`, {}, admin)).status, 200);
  assert.equal((await call('GET', `/users/${goneId}`)).status, 404);
  assert.equal((await call('GET', '/auth/me', null, gone)).data.user, null); // logged out
  assert.equal((await call('POST', '/auth/login', { username: 'GoneSoon', password: 'secret123' })).status, 401);
  assert.equal((await call('GET', `/users/${friendId}/friends`)).data.friends.length, 0);
  // same device can sign up again, even with the same name
  assert.equal((await call('POST', '/auth/signup', { username: 'GoneSoon', password: 'secret123' }, gone)).status, 200);
  // players can delete their own account with their password
  assert.equal((await call('POST', '/account/delete', { password: 'nope' }, friend)).status, 401);
  assert.equal((await call('POST', '/account/delete', { password: 'secret123' }, friend)).status, 200);
  assert.equal((await call('GET', `/users/${friendId}`)).status, 404);
});

test('players resell Limited copies', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const s = (await call('POST', '/auth/signup', { username: 'Reseller', password: 'secret123' })).cookie;
  const b = (await call('POST', '/auth/signup', { username: 'ResBuyer', password: 'secret123' })).cookie;
  const sid = (await call('GET', '/auth/me', null, s)).data.user.id;
  const bid = (await call('GET', '/auth/me', null, b)).data.user.id;
  const lim = (await call('GET', '/catalog?type=Collectibles')).data.items[0];
  const normal = (await call('GET', '/catalog')).data.items.find((i) => !i.limited && i.price > 0);
  await call('POST', `/admin/users/${sid}/items`, { itemId: lim.id }, admin);
  await call('POST', `/admin/users/${sid}/items`, { itemId: normal.id }, admin);
  await call('POST', `/admin/users/${bid}/robits`, { amount: 1000 }, admin);
  const serial = (await call('GET', `/catalog/${lim.id}`, null, s)).data.item.serial;
  assert.equal((await call('POST', `/catalog/${normal.id}/resell`, { price: 50 }, s)).status, 400); // not a Limited
  assert.equal((await call('POST', `/catalog/${lim.id}/resell`, { price: 50 }, b)).status, 400); // doesn't own it
  assert.equal((await call('POST', `/catalog/${lim.id}/resell`, { price: 0 }, s)).status, 400);
  const listed = (await call('POST', `/catalog/${lim.id}/resell`, { price: 500 }, s)).data.resale;
  assert.equal(listed.serial, serial);
  const resellers = (await call('GET', `/catalog/${lim.id}/resellers`)).data.resellers;
  assert.ok(resellers.some((r) => r.id === listed.id && r.price === 500));
  assert.equal((await call('POST', `/resales/${listed.id}/buy`, {}, s)).status, 400); // own listing
  const before = (await call('GET', '/auth/me', null, s)).data.user.robits;
  const buyerBefore = (await call('GET', '/auth/me', null, b)).data.user.robits;
  assert.equal((await call('POST', `/resales/${listed.id}/buy`, {}, b)).status, 200);
  assert.equal((await call('GET', '/auth/me', null, b)).data.user.robits, buyerBefore - 500);
  assert.equal((await call('GET', '/auth/me', null, s)).data.user.robits, before + 350); // 70%
  assert.equal((await call('GET', `/catalog/${lim.id}`, null, b)).data.item.serial, serial); // same copy
  assert.equal((await call('GET', `/catalog/${lim.id}`, null, s)).data.item.owned, false);
  assert.equal((await call('POST', `/resales/${listed.id}/buy`, {}, admin)).status, 404); // sold
  // a listing disappears when the copy is traded away or taken
  const l2 = (await call('POST', `/catalog/${lim.id}/resell`, { price: 900 }, b)).data.resale;
  await call('POST', `/admin/users/${bid}/items/remove`, { itemId: lim.id }, admin);
  assert.ok(!(await call('GET', `/catalog/${lim.id}/resellers`)).data.resellers.some((r) => r.id === l2.id));
});

test('admin panel: password reset, rename, log and announcement', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const p = (await call('POST', '/auth/signup', { username: 'ForgotPw', password: 'secret123' })).cookie;
  const pid = (await call('GET', '/auth/me', null, p)).data.user.id;
  assert.equal((await call('POST', `/admin/users/${pid}/password`, {}, p)).status, 403);
  const r = await call('POST', `/admin/users/${pid}/password`, {}, admin);
  assert.equal(r.status, 200);
  assert.ok(r.data.password.length >= 8);
  assert.equal((await call('GET', '/auth/me', null, p)).data.user, null); // logged out everywhere
  assert.equal((await call('POST', '/auth/login', { username: 'ForgotPw', password: 'secret123' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { username: 'ForgotPw', password: r.data.password })).status, 200);
  assert.equal((await call('POST', `/admin/users/${pid}/password`, { password: 'newpass1' }, admin)).data.password, 'newpass1');
  assert.equal((await call('POST', `/admin/users/${pid}/rename`, { username: 'RenamedPw' }, admin)).data.user.username, 'RenamedPw');
  assert.equal((await call('POST', `/admin/users/${pid}/kick`, {}, admin)).status, 400); // not in a game
  const info = (await call('GET', `/admin/users/${pid}`, null, admin)).data;
  assert.deepEqual(info.user.previousNames, ['ForgotPw']);
  assert.ok(info.log.some((e) => e.action === 'Password reset' && e.byName === 'Tester_1'));
  assert.ok(info.log.some((e) => e.action === 'Renamed to RenamedPw'));
  assert.ok(!info.log.some((e) => e.action.startsWith('Kicked'))); // failed actions aren't logged
  assert.equal((await call('POST', '/admin/announcement', { text: 'Server restart at 9!' }, admin)).status, 200);
  assert.equal((await call('GET', '/announcement')).data.announcement.text, 'Server restart at 9!');
  await call('POST', '/admin/announcement', { text: '' }, admin);
  assert.equal((await call('GET', '/announcement')).data.announcement, null);
  const log = (await call('GET', '/admin/log', null, admin)).data.log;
  assert.ok(log.some((e) => e.action === 'Announcement: Server restart at 9!'));
  assert.ok((await call('GET', '/admin/games', null, admin)).data.games.length > 0);
  assert.equal((await call('GET', '/admin/items', null, p)).status, 401);
});

test('tools: StarterPack, equip, Activated with Raycast; vehicles: drive and get out', async () => {
  const { cookie } = await call('POST', '/auth/signup', { username: 'ToolUser', password: 'secret123' });
  const { data } = await call('POST', '/games', { name: 'Tool Test', template: 'baseplate' }, cookie);
  const id = data.game.id;
  const { place } = (await call('GET', `/games/${id}/place`, null, cookie)).data;
  place.services.StarterPack = { c: 'StarterPack', ch: [{ c: 'Tool', p: { Name: 'Blaster', ToolModel: 'gun' }, ch: [{ c: 'Script', p: { Name: 'Shoot', Source: `
    local tool = script.Parent
    tool.Activated:Connect(function(target)
      local char = tool.Parent
      local head = char.Head
      local r = workspace:Raycast(head.Position, (target - head.Position).Unit * 200, char)
      print("hit", r and r.Instance.Name or "nothing")
    end)
  ` } }] }] };
  place.services.Workspace.ch.push({ c: 'Part', p: { Name: 'Target', Anchored: true, Size: [4, 4, 4], CFrame: [0, 5, -30, 1, 0, 0, 0, 1, 0, 0, 0, 1] } });
  place.services.Workspace.ch.push({ c: 'VehicleSeat', p: { Name: 'Kart', Anchored: true, MaxSpeed: 70, Size: [2, 1, 2], CFrame: [40, 1, 40, 1, 0, 0, 0, 1, 0, 0, 0, 1] } });
  place.services.Workspace.ch.push({ c: 'VehicleSeat', p: { Name: 'Kart2', Anchored: true, MaxSpeed: 50, Size: [2, 1, 2], CFrame: [80, 1, 80, 1, 0, 0, 0, 1, 0, 0, 0, 1] } });
  place.services.ServerScriptService.ch.push({ c: 'Script', p: { Name: 'Sitter', Source: `
    game.Players.PlayerAdded:Connect(function(p)
      p.Chatted:Connect(function(msg)
        if msg == "sit" then print("sat", workspace.Kart2:Sit(p.Character.Humanoid)) end
      end)
    end)
  ` } });
  const put = await call('PUT', `/games/${id}/place`, { place }, cookie);
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const c = await join(cookie, { placeId: id });
  const welcome = await c.wait((m) => m.t === 'welcome');
  const charOp = await c.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  const spawnCf = charOp.ops.find((o) => o[0] === 'char')[3];
  // find the Blaster in the replicated Backpack
  const findTool = () => {
    const scan = (nodes) => { for (const n of nodes || []) { if (n.c === 'Tool') return n; const r = scan(n.ch); if (r) return r; } return null; };
    for (const m of c.inbox) {
      if (m.t === 'welcome') { const r = scan(m.snapshot.flatMap((s) => s.ch || [])); if (r) return r; }
      if (m.t === 'tick') for (const o of m.ops) if (o[0] === 'add') { const r = o[2].c === 'Tool' ? o[2] : scan(o[2].ch); if (r) return r; }
    }
    return null;
  };
  await c.wait((m) => m.t === 'tick' && !!findTool()).catch((e) => { console.log('NOTOOL', JSON.stringify(Object.keys(place.services)), JSON.stringify(c.inbox.filter((m) => m.t === 'output'))); throw e; });
  const tool = findTool();
  assert.ok(welcome);
  c.ws.send(JSON.stringify({ t: 'equip', id: tool.id }));
  await new Promise((r) => setTimeout(r, 200));
  // stand at the spawn and shoot at the target
  c.ws.send(JSON.stringify({ t: 'move', p: [0, spawnCf[1], 0], ry: 0, a: 'idle' }));
  c.ws.send(JSON.stringify({ t: 'activate', id: tool.id, p: [0, 5, -30] }));
  await c.wait((m) => m.t === 'output' && m.text === 'hit Target').catch((e) => { console.log('OUT', JSON.stringify(c.inbox.filter((m) => m.t === 'output' || m.t === 'sys'))); throw e; });
  // walk onto the VehicleSeat: driving starts; Space gets out
  c.ws.send(JSON.stringify({ t: 'move', p: [40, 3.5, 40], ry: 0, a: 'idle' }));
  const drive = await c.wait((m) => m.t === 'drive' && m.on);
  assert.equal(drive.max, 70);
  c.ws.send(JSON.stringify({ t: 'move', p: [60, 3.5, 60], ry: 0, a: 'drive:#ff0000' }));
  await new Promise((r) => setTimeout(r, 100));
  c.ws.send(JSON.stringify({ t: 'exitVehicle' }));
  await c.wait((m) => m.t === 'drive' && !m.on);
  // you step out beside the car
  const out = await c.wait((m) => m.t === 'teleport');
  assert.ok(Math.hypot(out.cf[0] - 60, out.cf[2] - 60) > 3);
  // a script seats you (seat:Sit): moved to the seat, then driving
  c.inbox.length = 0;
  c.ws.send(JSON.stringify({ t: 'chat', text: 'sit' }));
  await c.wait((m) => m.t === 'output' && m.text === 'sat true');
  const tp = c.inbox.find((m) => m.t === 'teleport');
  assert.ok(tp && Math.abs(tp.cf[0] - 80) < 0.01 && Math.abs(tp.cf[2] - 80) < 0.01);
  assert.equal((await c.wait((m) => m.t === 'drive' && m.on)).max, 50);
  c.ws.close();
});

test('groups: create, join with approval, roles, wall, shout and Robis Badges', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const a = (await call('POST', '/auth/signup', { username: 'GroupBoss', password: 'secret123' })).cookie;
  const b = (await call('POST', '/auth/signup', { username: 'GroupFan', password: 'secret123' })).cookie;
  const aid = (await call('GET', '/auth/me', null, a)).data.user.id;
  const bid = (await call('GET', '/auth/me', null, b)).data.user.id;
  const bal = (await call('GET', '/auth/me', null, a)).data.user.robits;
  await call('POST', `/admin/users/${aid}/robits`, { amount: 500 }, admin);
  const g = await call('POST', '/groups', { name: 'Builders Club Fans', description: 'We build!', icon: '★', approval: true }, a);
  assert.equal(g.status, 200, JSON.stringify(g.data));
  const gid = g.data.group.id;
  assert.equal((await call('GET', '/auth/me', null, a)).data.user.robits, bal + 500 - 100);
  assert.equal((await call('POST', '/groups', { name: 'builders club fans' }, a)).status, 400); // name taken
  // approval needed
  assert.equal((await call('POST', `/groups/${gid}/join`, {}, b)).data.pending, true);
  assert.equal((await call('POST', `/groups/${gid}/wall`, { text: 'hi' }, b)).status, 403);
  const full = (await call('GET', `/groups/${gid}`, null, a)).data.group;
  assert.equal(full.requests.length, 1);
  await call('POST', `/groups/${gid}/requests/${bid}`, { accept: true }, a);
  assert.equal((await call('GET', `/groups/${gid}`, null, b)).data.group.myRole, 'member');
  assert.equal((await call('POST', `/groups/${gid}/wall`, { text: 'hello damn world' }, b)).data.group.wall[0].text, 'hello #### world');
  assert.equal((await call('POST', `/groups/${gid}/shout`, { text: 'Meeting at 5' }, b)).status, 403);
  assert.equal((await call('POST', `/groups/${gid}/shout`, { text: 'Meeting at 5' }, a)).data.group.shout.text, 'Meeting at 5');
  await call('POST', `/groups/${gid}/members/${bid}`, { action: 'admin' }, a);
  assert.equal((await call('POST', `/groups/${gid}/shout`, { text: 'Admin shout' }, b)).status, 200);
  assert.equal((await call('POST', `/groups/${gid}/leave`, {}, a)).status, 400); // owner can't leave
  // profile: groups and Robis Badges
  const ug = (await call('GET', `/users/${bid}/groups`)).data;
  assert.equal(ug.groups[0].role, 'admin');
  assert.equal(ug.primary.id, gid);
  const ach = (await call('GET', `/users/${aid}`)).data.user.achievements.map((x) => x.id);
  assert.ok(ach.includes('founder'));
  // owner gives the group away
  await call('POST', `/groups/${gid}/members/${bid}`, { action: 'owner' }, a);
  const after = (await call('GET', `/groups/${gid}`, null, a)).data.group;
  assert.equal(after.owner.username, 'GroupFan');
  assert.equal(after.myRole, 'admin');
  assert.equal((await call('GET', '/groups?q=fans')).data.groups.length, 1);
});

test('the main account is Seek_tv87 and an admin can take it over', async () => {
  const games = (await call('GET', '/games?sort=popular')).data.games;
  assert.equal(games[0].creator.username, 'Seek_tv87');
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  // nobody can sign up with the main account's name
  assert.equal((await call('POST', '/auth/signup', { username: 'Seek_tv87', password: 'secret123' })).status, 400);
  const fan = (await call('POST', '/auth/signup', { username: 'NotTheOwner', password: 'secret123' })).cookie;
  await call('POST', '/admin/users/' + (await call('GET', '/auth/me', null, fan)).data.user.id + '/robits', { amount: 2000 }, admin);
  assert.equal((await call('POST', '/account/username', { username: 'Seek_tv87', password: 'secret123' }, fan)).status, 400); // not an admin
  // an admin renames themself to Seek_tv87: the games and catalog become theirs
  const r = await call('POST', '/account/username', { username: 'Seek_tv87', password: 'secret123' }, admin);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const me = (await call('GET', '/auth/me', null, admin)).data.user;
  const games2 = (await call('GET', '/games?sort=popular')).data.games;
  assert.equal(games2[0].creator.id, me.id);
  assert.deepEqual(me.flags.sort(), ['staff', 'verified']);
  await call('POST', '/account/username', { username: 'Tester_1', password: 'secret123' }, admin); // put the name back for later tests
});

test('Team Create: collaborators edit the same place together', async () => {
  const owner = (await call('POST', '/auth/signup', { username: 'TeamOwner', password: 'secret123' })).cookie;
  const mate = (await call('POST', '/auth/signup', { username: 'TeamMate', password: 'secret123' })).cookie;
  const stranger = (await call('POST', '/auth/signup', { username: 'Stranger', password: 'secret123' })).cookie;
  const { game } = (await call('POST', '/games', { name: 'Together', template: 'baseplate' }, owner)).data;
  assert.equal((await call('GET', `/games/${game.id}/place`, null, mate)).status, 403);
  assert.equal((await call('POST', `/games/${game.id}/collaborators`, { username: 'TeamMate' }, mate)).status, 403);
  assert.equal((await call('POST', `/games/${game.id}/collaborators`, { username: 'TeamMate' }, owner)).status, 200);
  assert.equal((await call('GET', `/games/${game.id}/place`, null, mate)).status, 200);
  assert.equal((await call('GET', '/team-create', null, mate)).data.games[0].id, game.id);
  // live session
  const ws = (cookie) => new Promise((resolve) => {
    const w = new WebSocket(base.replace('http', 'ws') + '/ws', { headers: { cookie } });
    const inbox = [];
    w.on('message', (d) => inbox.push(JSON.parse(d)));
    w.on('open', () => resolve({ w, inbox, until: async (pred) => { for (let i = 0; i < 60; i++) { const m = inbox.find(pred); if (m) return m; await new Promise((r) => setTimeout(r, 50)); } throw new Error('timeout'); } }));
  });
  const a = await ws(owner), b = await ws(mate), c = await ws(stranger);
  a.w.send(JSON.stringify({ t: 'tc.join', gameId: game.id }));
  await a.until((m) => m.t === 'tc.welcome');
  b.w.send(JSON.stringify({ t: 'tc.join', gameId: game.id }));
  // the owner is asked for the latest version for the newcomer
  const need = await a.until((m) => m.t === 'tc.need');
  a.w.send(JSON.stringify({ t: 'tc.snapshot', for: need.for, place: { format: 'robis-place', services: {} } }));
  await b.until((m) => m.t === 'tc.snapshot');
  const pres = await a.until((m) => m.t === 'tc.presence' && m.users.length === 2);
  assert.deepEqual(pres.users.map((u) => u.name).sort(), ['TeamMate', 'TeamOwner']);
  b.w.send(JSON.stringify({ t: 'tc.ops', ops: [['rem', 'abc']] }));
  const ops = await a.until((m) => m.t === 'tc.ops');
  assert.equal(ops.from, 'TeamMate');
  c.w.send(JSON.stringify({ t: 'tc.join', gameId: game.id }));
  await c.until((m) => m.t === 'tc.error');
  a.w.close(); b.w.close(); c.w.close();
});

test('pets: buy one, wear one at a time, it shows in the game avatar', async () => {
  const p = (await call('POST', '/auth/signup', { username: 'PetOwner', password: 'secret123' })).cookie;
  const pets = (await call('GET', '/catalog?type=Pet')).data.items;
  assert.ok(pets.length >= 8);
  const kitty = pets.find((i) => i.name === 'Kitty');
  const puppy = pets.find((i) => i.name === 'Puppy');
  assert.equal((await call('POST', `/catalog/${kitty.id}/buy`, {}, p)).status, 200); // a new player can afford it
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const pid = (await call('GET', '/auth/me', null, p)).data.user.id;
  await call('POST', `/admin/users/${pid}/items`, { itemId: puppy.id }, admin);
  const { avatar } = (await call('GET', '/avatar', null, p)).data;
  const r = await call('PUT', '/avatar', { ...avatar, wearing: [...avatar.wearing, kitty.id, puppy.id] }, p);
  const worn = r.data.resolved.items.filter((i) => i.type === 'Pet');
  assert.equal(worn.length, 1); // one pet at a time
  assert.equal(worn[0].data.model, 'cat');
});

test('promo codes: staff generate them, players redeem each once', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'PromoKid', password: 'secret123' })).cookie;
  const pal = (await call('POST', '/auth/signup', { username: 'PromoPal', password: 'secret123' })).cookie;
  // only staff with the Economy right
  assert.equal((await call('POST', '/admin/promocodes', { robits: 10 }, kid)).status, 403);
  assert.equal((await call('POST', '/admin/promocodes', {}, admin)).status, 400); // nothing to give
  const item = (await call('GET', '/catalog?q=Puppy')).data.items[0];
  const batch = (await call('POST', '/admin/promocodes', { robits: 300, items: [item.id], count: 3, maxUses: 1 }, admin)).data.codes;
  assert.equal(batch.length, 3);
  assert.match(batch[0].code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const custom = (await call('POST', '/admin/promocodes', { robits: 50, code: 'party2019', maxUses: 0 }, admin)).data.codes[0];
  assert.equal(custom.code, 'PARTY2019');
  assert.equal((await call('POST', '/admin/promocodes', { robits: 5, code: 'PARTY2019' }, admin)).status, 400); // taken
  const before = (await call('GET', '/auth/me', null, kid)).data.user.robits;
  const r = await call('POST', '/promocodes/redeem', { code: ' ' + batch[0].code.toLowerCase() + ' ' }, kid);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.robits, 300);
  assert.deepEqual(r.data.items.map((i) => i.id), [item.id]);
  assert.equal((await call('GET', '/auth/me', null, kid)).data.user.robits, before + 300);
  assert.ok((await call('GET', '/users/' + (await call('GET', '/auth/me', null, kid)).data.user.id + '/inventory')).data.items.some((i) => i.id === item.id));
  assert.equal((await call('POST', '/promocodes/redeem', { code: batch[0].code }, kid)).data.error, 'You already used this code.');
  assert.equal((await call('POST', '/promocodes/redeem', { code: batch[0].code }, pal)).data.error, 'This code has been used up.');
  // an unlimited code works for everyone, once each
  assert.equal((await call('POST', '/promocodes/redeem', { code: 'party2019' }, kid)).status, 200);
  assert.equal((await call('POST', '/promocodes/redeem', { code: 'party2019' }, pal)).status, 200);
  // turned off codes don't work
  await call('POST', '/admin/promocodes/edit', { code: batch[1].code, op: 'off' }, admin);
  assert.equal((await call('POST', '/promocodes/redeem', { code: batch[1].code }, pal)).data.error, 'That code is not valid.');
  // wrong guesses are limited
  for (let i = 0; i < 7; i++) await call('POST', '/promocodes/redeem', { code: 'WRONG-' + i }, pal); // + the turned-off one = 8
  assert.equal((await call('POST', '/promocodes/redeem', { code: batch[2].code }, pal)).status, 429);
  const list = (await call('GET', '/admin/promocodes', null, admin)).data.codes;
  assert.equal(list.find((c) => c.code === 'PARTY2019').uses, 2);
  assert.equal(list.find((c) => c.code === batch[1].code).state, 'off');
});

test('promo codes for Builders Club and donate prices', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'ClubKid', password: 'secret123' })).cookie;
  const me = async () => (await call('GET', '/auth/me', null, kid)).data.user;
  assert.equal((await call('POST', '/admin/promocodes', { membership: 'Nope', code: 'BADCLUB' }, admin)).status, 400);
  await call('POST', '/admin/promocodes', { membership: 'TurboBuildersClub', membershipDays: 7, code: 'TBC7' }, admin);
  await call('POST', '/admin/promocodes', { membership: 'BuildersClub', membershipDays: 30, code: 'BC30' }, admin);
  await call('POST', '/admin/promocodes', { membership: 'TurboBuildersClub', membershipDays: 3, code: 'TBC3' }, admin);
  const r = await call('POST', '/promocodes/redeem', { code: 'tbc7' }, kid);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.membership.name, 'Turbo Builders Club');
  let u = await me();
  assert.equal(u.membership, 'TurboBuildersClub');
  const week = u.membershipUntil - Date.now();
  assert.ok(week > 6.9 * 86400e3 && week <= 7 * 86400e3);
  // a lower plan is skipped, the same plan is extended
  assert.equal((await call('POST', '/promocodes/redeem', { code: 'BC30' }, kid)).data.membership.skipped, true);
  assert.equal((await me()).membership, 'TurboBuildersClub');
  await call('POST', '/promocodes/redeem', { code: 'TBC3' }, kid);
  u = await me();
  assert.ok(u.membershipUntil - Date.now() > 9.9 * 86400e3);
  // staff setting a plan makes it permanent
  await call('POST', `/admin/users/${u.id}/membership`, { tier: 'BuildersClub' }, admin);
  assert.deepEqual([(await me()).membership, (await me()).membershipUntil], ['BuildersClub', 0]);
  // donate prices
  assert.equal((await call('POST', '/admin/donate', { prices: { r400: '99 ₽' } }, kid)).status, 403);
  assert.equal((await call('POST', '/admin/donate', { prices: {}, telegram: 'not a name!' }, admin)).status, 400);
  await call('POST', '/admin/donate', { prices: { r400: '99 ₽', BuildersClub: '149 ₽', hack: 'x' }, telegram: '@Robis_support' }, admin);
  const { donate } = (await call('GET', '/economy/store')).data;
  assert.equal(donate.telegram, 'Robis_support');
  assert.equal(donate.packs.find((p) => p.robits === 400).price, '99 ₽');
  assert.equal(donate.memberships.find((m) => m.id === 'BuildersClub').price, '149 ₽');
});

test('game passes: owner sells them, perks and scripts see them, in-game purchase', async () => {
  const owner = (await call('POST', '/auth/signup', { username: 'PassMaker', password: 'secret123' })).cookie;
  const buyer = (await call('POST', '/auth/signup', { username: 'PassBuyer', password: 'secret123' })).cookie;
  const ownerId = (await call('GET', '/auth/me', null, owner)).data.user.id;
  const buyerId = (await call('GET', '/auth/me', null, buyer)).data.user.id;
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  await call('POST', `/admin/users/${buyerId}/robits`, { amount: 1000 }, admin);
  const { data } = await call('POST', '/games', { name: 'Pass Game', template: 'baseplate' }, owner);
  const gid = data.game.id;
  await call('PATCH', `/games/${gid}`, { isPublic: true }, owner);
  assert.equal((await call('POST', `/games/${gid}/passes`, { name: 'VIP', price: 50 }, buyer)).status, 403);
  assert.equal((await call('POST', `/games/${gid}/passes`, { name: 'VIP', price: 0 }, owner)).status, 400);
  const vip = (await call('POST', `/games/${gid}/passes`, { name: 'VIP', price: 100, icon: '👑', perk: 'speed' }, owner)).data.pass;
  const fly = (await call('POST', `/games/${gid}/passes`, { name: 'Wings', price: 200, icon: '🪽', perk: 'fly' }, owner)).data.pass;
  assert.equal(vip.perk, 'speed');
  // buy VIP on the website: the owner gets 70%
  const ownerBefore = (await call('GET', '/auth/me', null, owner)).data.user.robits;
  const r = await call('POST', `/gamepasses/${vip.id}/buy`, {}, buyer);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await call('GET', '/auth/me', null, owner)).data.user.robits, ownerBefore + 70);
  assert.equal((await call('POST', `/gamepasses/${vip.id}/buy`, {}, buyer)).data.error, 'You already own this pass.');
  assert.ok((await call('GET', `/games/${gid}/passes`, null, buyer)).data.passes.find((p) => p.id === vip.id).owned);
  assert.deepEqual((await call('GET', `/users/${buyerId}/passes`)).data.passes.map((p) => p.name), ['VIP']);
  // passes that sold can't be deleted
  assert.equal((await call('POST', `/gamepasses/${vip.id}`, { delete: true }, owner)).status, 400);
  // a script checks passes; the speed perk works without scripts
  const { place } = (await call('GET', `/games/${gid}/place`, null, owner)).data;
  place.services.ServerScriptService.ch.push({ c: 'Script', p: { Name: 'Passes', Source: `
    local MS = game:GetService("MarketplaceService")
    game.Players.PlayerAdded:Connect(function(p)
      p:Notify("owns " .. tostring(MS:UserOwnsGamePassAsync(p.UserId, ${vip.id})) .. " " .. tostring(MS:UserOwnsGamePassAsync(p.UserId, ${fly.id})))
      p.CharacterAdded:Connect(function(c) wait(0.2) p:Notify("speed " .. c.Humanoid.WalkSpeed) end)
      p.Chatted:Connect(function(m) if m == "buy" then MS:PromptGamePassPurchase(p, ${fly.id}) end end)
    end)
    MS.PromptGamePassPurchaseFinished:Connect(function(p, id, ok) p:Notify("finished " .. id .. " " .. tostring(ok) .. " " .. tostring(MS:UserOwnsGamePassAsync(p.UserId, id))) end)
  ` } });
  assert.equal((await call('PUT', `/games/${gid}/place`, { place }, owner)).status, 200);
  const c = await join(buyer, { placeId: gid });
  await c.wait((m) => m.t === 'sys' && /^owns/.test(m.text)).then((m) => assert.equal(m.text, 'owns true false'));
  await c.wait((m) => m.t === 'sys' && /^speed/.test(m.text)).then((m) => assert.equal(m.text, 'speed 26'));
  // in-game purchase from a script prompt
  c.ws.send(JSON.stringify({ t: 'chat', text: 'buy' }));
  const prompt = await c.wait((m) => m.t === 'promptPass');
  assert.equal(prompt.pass.id, fly.id);
  c.ws.send(JSON.stringify({ t: 'buyPass', id: fly.id, confirm: true }));
  assert.equal((await c.wait((m) => m.t === 'passResult')).ok, true);
  await c.wait((m) => m.t === 'sys' && /^finished/.test(m.text)).then((m) => assert.equal(m.text, `finished ${fly.id} true true`));
  // the Store tab lists them
  c.ws.send(JSON.stringify({ t: 'passList' }));
  assert.equal((await c.wait((m) => m.t === 'passList')).passes.length, 2);
  c.ws.close();
  assert.ok((await call('GET', `/games/${gid}/passes`, null, buyer)).data.passes.every((p) => p.owned));
  void ownerId;
});

test('private servers: buy, invite, only invited players join', async () => {
  const owner = (await call('POST', '/auth/signup', { username: 'PrivOwner', password: 'secret123' })).cookie;
  const host = (await call('POST', '/auth/signup', { username: 'PrivHost', password: 'secret123' })).cookie;
  const guest = (await call('POST', '/auth/signup', { username: 'PrivGuest', password: 'secret123' })).cookie;
  const stranger = (await call('POST', '/auth/signup', { username: 'PrivStranger', password: 'secret123' })).cookie;
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const hostId = (await call('GET', '/auth/me', null, host)).data.user.id;
  await call('POST', `/admin/users/${hostId}/robits`, { amount: 500 }, admin);
  const gid = (await call('POST', '/games', { name: 'Private Game', template: 'baseplate' }, owner)).data.game.id;
  await call('PATCH', `/games/${gid}`, { isPublic: true }, owner);
  // off until the owner turns them on
  assert.equal((await call('POST', `/games/${gid}/private/buy`, {}, host)).status, 400);
  assert.equal((await call('POST', `/games/${gid}/private/settings`, { enabled: true, price: 100 }, host)).status, 403);
  await call('POST', `/games/${gid}/private/settings`, { enabled: true, price: 100 }, owner);
  const bought = await call('POST', `/games/${gid}/private/buy`, { name: 'Our Server' }, host);
  assert.equal(bought.status, 200, JSON.stringify(bought.data));
  const ps = bought.data.server;
  assert.equal(ps.name, 'Our Server');
  assert.ok(ps.until > Date.now() + 29 * 86400e3);
  assert.equal(bought.data.robits, 600 - 100);
  // strangers can't join; the invite link adds you
  const s1 = await join(stranger, { placeId: gid, privateId: ps.id });
  assert.match((await s1.wait((m) => m.t === 'error')).msg, /not invited/);
  assert.equal((await call('POST', '/private/join', { code: ps.code }, guest)).status, 200);
  const h = await join(host, { placeId: gid, privateId: ps.id });
  const hw = await h.wait((m) => m.t === 'welcome');
  assert.equal(hw.privateName, 'Our Server');
  const g = await join(guest, { placeId: gid, privateId: ps.id });
  const gw = await g.wait((m) => m.t === 'welcome');
  assert.equal(gw.serverId, hw.serverId); // same private instance
  // private servers are not in the public list
  assert.ok(!(await call('GET', `/games/${gid}/servers`)).data.servers.some((s) => s.id === hw.serverId));
  const list = (await call('GET', `/games/${gid}/private`, null, guest)).data.servers;
  assert.equal(list.length, 1);
  assert.equal(list[0].code, undefined); // only the owner sees the code
  // the owner removes the guest and renews
  const guestId = (await call('GET', '/auth/me', null, guest)).data.user.id;
  await call('POST', `/private/${ps.id}`, { remove: guestId, newCode: true }, host);
  assert.equal((await call('GET', `/games/${gid}/private`, null, guest)).data.servers.length, 0);
  assert.equal((await call('POST', '/private/join', { code: ps.code }, guest)).status, 400); // old link
  const renewed = (await call('POST', `/private/${ps.id}`, { renew: true }, host)).data;
  assert.ok(renewed.server.until > ps.until + 29 * 86400e3);
  h.ws.close(); g.ws.close(); s1.ws.close();
});

test('The Hunt: private event, hidden tokens, hub portals teleport, prizes', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'HuntKid', password: 'secret123' })).cookie;
  // a popular player game joins automatically
  const maker = (await call('POST', '/auth/signup', { username: 'HuntMaker', password: 'secret123' })).cookie;
  const pg = (await call('POST', '/games', { name: 'Player Hit Game', template: 'obby' }, maker)).data.game;
  await call('PATCH', `/games/${pg.id}`, { isPublic: true }, maker);
  // released by default; the admin can make it private again
  assert.equal((await call('GET', '/hunt', null, kid)).data.visible, true);
  await call('POST', '/admin/hunt', { public: false }, admin);
  assert.equal((await call('GET', '/hunt', null, kid)).data.visible, false);
  assert.equal((await call('GET', '/auth/me', null, kid)).data.user.hunt, false);
  assert.equal((await call('GET', '/admin/hunt', null, kid)).status, 403);
  let h = (await call('GET', '/hunt', null, admin)).data;
  assert.equal(h.visible, true);
  assert.equal(h.public, false);
  assert.ok(h.games.length >= 2);
  assert.ok(h.games.some((g) => g.byPlayer && g.id === pg.id), JSON.stringify(h.games));
  assert.ok(!h.games.some((g) => g.name === 'Happy Home in Robisia')); // no house in the event
  // keep the event small: one official game + the player game
  const adm = (await call('GET', '/admin/hunt', null, admin)).data;
  const official = adm.official.find((g) => /Obby/.test(g.name)) || adm.official[0];
  await call('POST', '/admin/hunt', { games: [official.id], autoPlayers: 1 }, admin);
  h = (await call('GET', '/hunt', null, admin)).data;
  assert.equal(h.games.length, 2);
  const playerGame = h.games.find((g) => g.byPlayer);
  assert.ok(playerGame && h.games.some((g) => g.id === official.id));
  // the hub game isn't public while the event is private
  assert.equal((await call('GET', `/games/${h.hubId}`, null, kid)).status, 404);
  // find the token in the player game
  const findToken = (c) => {
    for (const m of c.inbox) {
      const nodes = m.t === 'welcome' ? m.snapshot.flatMap((s) => s.ch || []) : m.t === 'tick' ? m.ops.filter((o) => o[0] === 'add').map((o) => o[2]) : [];
      for (const n of nodes) if (n.c === 'Folder' && n.p.Name === 'TheHunt') return n.ch[0];
    }
    return null;
  };
  const c = await join(admin, { placeId: playerGame.id });
  await c.wait((m) => m.t === 'tick' && !!findToken(c));
  const tok = findToken(c);
  const [x, y, z] = tok.p.CFrame;
  c.ws.send(JSON.stringify({ t: 'move', p: [x, y, z], ry: 0, a: 'idle' }));
  const got = await c.wait((m) => m.t === 'hunt');
  assert.deepEqual([got.count, got.total], [1, 2]);
  assert.equal(got.robits, 20);
  // the first token's prize (the Hunt Dragon needs 60% now)
  assert.equal(got.reward.items[0].name, 'Dimension Explorer Tee'); // 1 of 2 shards: also half (the Mini UFO)
  assert.equal((await call('GET', '/hunt', null, admin)).data.rewards.length, 10);
  c.ws.close();
  // players without access get no token
  await call('POST', '/admin/hunt', {}, admin);
  // the hub: walking into a portal teleports you
  const hub = await join(admin, { placeId: h.hubId });
  const w = await hub.wait((m) => m.t === 'welcome');
  const portals = w.snapshot.find((s) => s.c === 'Workspace').ch.find((n) => n.p.Name === 'Portals');
  const gate = portals.ch[0].ch.find((n) => n.p.Name === 'Portal');
  await hub.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  hub.ws.send(JSON.stringify({ t: 'move', p: [gate.p.CFrame[0], 4.5, gate.p.CFrame[2]], ry: 0, a: 'idle' }));
  const tp = await hub.wait((m) => m.t === 'teleportPlace');
  assert.ok([official.id, playerGame.id].includes(tp.placeId), JSON.stringify([tp, official.id, playerGame.id, portals.ch.map((c) => c.p.Name)]));
  hub.ws.close();
  // open it for everyone
  await call('POST', '/admin/hunt', { public: true }, admin);
  assert.equal((await call('GET', '/hunt', null, kid)).data.visible, true);
  assert.equal((await call('GET', `/games/${h.hubId}`, null, kid)).status, 200);
  // prizes can't be bought
  const prize = h.rewards[0];
  assert.equal((await call('POST', `/catalog/${prize.id}/buy`, {}, kid)).data.error, 'This item is not for sale.');
  await call('POST', '/admin/hunt', { public: false }, admin);
});

test('Builders Club for Robits; gift cards only in Telegram', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'ClubBuyer', password: 'secret123' })).cookie;
  const me = async () => (await call('GET', '/auth/me', null, kid)).data.user;
  const id = (await me()).id;
  assert.equal((await call('POST', '/economy/membership', { tier: 'BuildersClub' }, kid)).status, 400); // not enough Robits
  await call('POST', `/admin/users/${id}/robits`, { amount: 20000 }, admin);
  const before = (await me()).robits;
  const r = await call('POST', '/economy/membership', { tier: 'BuildersClub' }, kid);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.robits, before - 1500);
  let u = await me();
  assert.equal(u.membership, 'BuildersClub');
  assert.ok(u.membershipUntil > Date.now() + 29 * 86400e3);
  // the same plan is extended, a better one upgrades, a lower one is refused
  await call('POST', '/economy/membership', { tier: 'BuildersClub' }, kid);
  assert.ok((await me()).membershipUntil > Date.now() + 59 * 86400e3);
  await call('POST', '/economy/membership', { tier: 'TurboBuildersClub' }, kid);
  assert.equal((await me()).membership, 'TurboBuildersClub');
  assert.equal((await call('POST', '/economy/membership', { tier: 'BuildersClub' }, kid)).status, 400);
  assert.equal((await call('POST', '/economy/membership', { tier: 'None' }, kid)).status, 400);
  // gift cards can't be bought for Robits any more; their Telegram prices still work
  assert.equal((await call('POST', '/giftcards/buy', { key: 'g1000' }, kid)).status, 404);
  await call('POST', '/admin/donate', { prices: { g1000: '199 ₽' }, telegram: 'Robis_support' }, admin);
  const { donate } = (await call('GET', '/economy/store')).data;
  assert.equal(donate.giftcards.find((g) => g.key === 'g1000').price, '199 ₽');
  assert.equal(donate.memberships.find((m) => m.id === 'BuildersClub').cost, 1500);
});

test('The Hunt: admins give and take a player\'s tokens', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'TokenKid', password: 'secret123' })).cookie;
  assert.equal((await call('POST', '/admin/hunt/tokens', { user: 'TokenKid', all: true }, kid)).status, 403);
  let p = (await call('GET', '/admin/hunt/player?user=tokenkid', null, admin)).data;
  assert.equal(p.count, 0);
  const g = p.games[0];
  const before = (await call('GET', '/auth/me', null, kid)).data.user.robits;
  p = (await call('POST', '/admin/hunt/tokens', { user: 'TokenKid', gameId: g.id }, admin)).data;
  assert.equal(p.count, 1);
  assert.equal(p.newPrizes[0].name, 'Dimension Explorer Tee');
  assert.equal((await call('GET', '/auth/me', null, kid)).data.user.robits, before + 20);
  p = (await call('POST', '/admin/hunt/tokens', { user: 'TokenKid', all: true }, admin)).data;
  assert.equal(p.count, p.total);
  assert.ok(p.prizes.includes('cosmos'));
  p = (await call('POST', '/admin/hunt/tokens', { user: 'TokenKid', all: true, take: true }, admin)).data;
  assert.equal(p.count, 0);
  assert.ok(p.prizes.includes('cosmos')); // prizes stay
  assert.equal((await call('POST', '/admin/hunt/tokens', { user: 'Nobody_xyz', all: true }, admin)).status, 404);
});

test('admin panel update: dashboard, servers, settings, broadcast, alts, socials', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'PanelKid', password: 'secret123' })).cookie;
  // socials: the Telegram channel by default
  const site = (await call('GET', '/site')).data;
  assert.equal(site.socials[0].url, 'https://t.me/Robisgame');
  assert.equal(site.maintenance, null);
  // dashboard
  assert.equal((await call('GET', '/admin/dashboard', null, kid)).status, 403);
  const dash = (await call('GET', '/admin/dashboard', null, admin)).data;
  assert.equal(dash.days.length, 14);
  assert.ok(dash.kpis.users > 1 && dash.topGames.length > 0);
  // servers: one running, message and shut down
  const game = (await call('GET', '/games?sort=popular')).data.games[0];
  const c = await join(kid, { placeId: game.id });
  const w = await c.wait((m) => m.t === 'welcome');
  const servers = (await call('GET', '/admin/servers', null, admin)).data.servers;
  assert.ok(servers.some((s) => s.id === w.serverId && s.players.some((p) => p.name === 'PanelKid')));
  await call('POST', `/admin/servers/${w.serverId}/message`, { text: 'hello all' }, admin);
  assert.equal((await c.wait((m) => m.t === 'sys' && m.text.includes('hello all'))).text, '[Admin] hello all');
  await call('POST', `/admin/servers/${w.serverId}/shutdown`, { reason: 'Update time' }, admin);
  assert.equal((await c.wait((m) => m.t === 'shutdown')).msg, 'Update time');
  // settings: starting Robits, closed sign-ups, chat words, maintenance, socials
  assert.equal((await call('POST', '/admin/settings', { startRobits: 777 }, kid)).status, 403);
  await call('POST', '/admin/settings', { startRobits: 777, bannedWords: ['bananas'], socials: [{ type: 'telegram', label: 'Telegram', url: 'https://t.me/Robisgame' }, { type: 'youtube', label: 'YouTube', url: 'https://youtube.com/@robis' }] }, admin);
  assert.equal((await call('POST', '/auth/signup', { username: 'RichNewbie', password: 'secret123' })).data.user.robits, 777);
  assert.equal((await call('GET', '/site')).data.socials.length, 2);
  assert.equal((await call('POST', '/admin/settings', { socials: [{ url: 'javascript:alert(1)' }] }, admin)).status, 400);
  await call('POST', '/admin/settings', { signups: false }, admin);
  assert.equal((await call('POST', '/auth/signup', { username: 'LateNewbie', password: 'secret123' })).status, 403);
  await call('POST', '/admin/settings', { signups: true, maintenance: { on: true, message: 'Back at 5!' } }, admin);
  assert.equal((await call('GET', '/site')).data.maintenance.message, 'Back at 5!');
  const blocked = await join(kid, { placeId: game.id });
  assert.equal((await blocked.wait((m) => m.t === 'error')).msg, 'Back at 5!');
  const staff = await join(admin, { placeId: game.id }); // staff can still play
  const sw = await staff.wait((m) => m.t === 'welcome' || m.t === 'error');
  assert.equal(sw.t, 'welcome');
  staff.ws.send(JSON.stringify({ t: 'chat', text: 'I love bananas' }));
  assert.equal((await staff.wait((m) => m.t === 'chat')).text, 'I love #######');
  staff.ws.close();
  await call('POST', '/admin/settings', { maintenance: { on: false, message: '' }, startRobits: 100, bannedWords: [] }, admin);
  // broadcast: a message in every inbox, Robits for everyone
  const sent = (await call('POST', '/admin/broadcast', { subject: 'Big update', body: 'Hello everyone!' }, admin)).data.sent;
  assert.ok(sent > 2);
  assert.ok((await call('GET', '/messages', null, kid)).data.messages.some((m) => m.subject === 'Big update'));
  const before = (await call('GET', '/auth/me', null, kid)).data.user.robits;
  await call('POST', '/admin/broadcast/robits', { amount: 50 }, admin);
  assert.equal((await call('GET', '/auth/me', null, kid)).data.user.robits, before + 50);
  // alt accounts: same device cookie
  const kidId = (await call('GET', '/auth/me', null, kid)).data.user.id;
  assert.ok(Array.isArray((await call('GET', `/admin/users/${kidId}/alts`, null, admin)).data.alts));
});

test('places: a game has more places, scripts teleport between them (DOORS lobby → hotel)', async () => {
  const maker = (await call('POST', '/auth/signup', { username: 'PlaceMaker', password: 'secret123' })).cookie;
  const other = (await call('POST', '/auth/signup', { username: 'PlaceSnoop', password: 'secret123' })).cookie;
  const g = (await call('POST', '/games', { name: 'Many Places', template: 'baseplate' }, maker)).data.game;
  let r = (await call('GET', `/games/${g.id}/places`, null, maker)).data;
  assert.deepEqual(r.places.map((p) => [p.name, p.start]), [['Start Place', true]]);
  assert.equal((await call('POST', `/games/${g.id}/places`, { name: 'Level 1' }, other)).status, 403);
  const lv = (await call('POST', `/games/${g.id}/places`, { name: 'Level 1', template: 'baseplate' }, maker)).data.place;
  assert.ok(lv.id > 100000);
  r = (await call('GET', `/games/${g.id}/places`, null, maker)).data;
  assert.deepEqual(r.places.map((p) => p.name), ['Start Place', 'Level 1']);
  // Studio opens and saves the other place by itself
  const pl = (await call('GET', `/games/${g.id}/place?place=${lv.id}`, null, maker)).data;
  assert.equal(pl.subPlace.name, 'Level 1');
  assert.equal((await call('PUT', `/games/${g.id}/place?place=${lv.id}`, { place: pl.place }, maker)).status, 200);
  await call('POST', `/places/${lv.id}`, { name: 'Level One' }, maker);
  assert.equal((await call('GET', `/games/${g.id}/places`, null, maker)).data.places[1].name, 'Level One');
  assert.equal((await call('POST', `/places/${lv.id}`, { delete: true }, other)).status, 403);
  await call('POST', `/places/${lv.id}`, { delete: true }, maker);
  assert.equal((await call('GET', `/games/${g.id}/places`, null, maker)).data.places.length, 1);

  // DOORS: the lobby is the start place, The Hotel is its other place
  const doors = (await call('GET', '/games?sort=popular')).data.games.find((x) => x.name === 'DOORS')
    || (await call('GET', '/games?q=DOORS')).data.games.find((x) => x.name === 'DOORS');
  const dp = (await call('GET', `/games/${doors.id}/places`, null, maker)).data.places;
  const hotel = dp.find((p) => p.name === 'The Hotel');
  assert.ok(hotel, JSON.stringify(dp));
  // a place of another game can't be joined through this one
  const bad = await join(maker, { placeId: g.id, place: hotel.id });
  assert.equal((await bad.wait((m) => m.t === 'error')).msg, 'This place is not part of the game.');
  const c = await join(maker, { placeId: doors.id });
  const w = await c.wait((m) => m.t === 'welcome');
  const ws0 = w.snapshot.find((s) => s.c === 'Workspace');
  assert.ok(ws0.ch.some((n) => n.p.Name === 'Elevator'));
  await c.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  const step = setInterval(() => c.ws.send(JSON.stringify({ t: 'move', p: [0, 4.5, -19.5], ry: 0, a: 'idle' })), 300);
  const tp = await c.wait((m) => m.t === 'teleportPlace', 16000).finally(() => clearInterval(step));
  assert.equal(tp.placeId, doors.id);
  assert.equal(tp.place, hotel.id);
  assert.ok(tp.serverId);
  c.ws.close();
  // the group's own hotel server: not in the public server list
  const h = await join(maker, { placeId: doors.id, place: hotel.id, serverId: tp.serverId });
  const hw = await h.wait((m) => m.t === 'welcome');
  assert.equal(hw.serverId, tp.serverId);
  assert.ok(hw.snapshot.find((s) => s.c === 'Workspace').ch.some((n) => n.p.Name === 'Rooms'));
  h.ws.close();
});

test('The Hunt: Another Dimension: hub star fragments, launch pads, the old event is put away', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  await call('POST', '/admin/hunt', { public: true }, admin);
  const kid = (await call('POST', '/auth/signup', { username: 'SpaceKid', password: 'secret123' })).cookie;
  const h = (await call('GET', '/hunt', null, kid)).data;
  assert.equal(h.name, 'The Hunt: Another Dimension');
  assert.equal(h.fragments.total, 6);
  assert.ok(h.rift.goal > 0);
  assert.ok(h.rewards.some((r) => r.bonus && r.name === 'Stardust Halo'));
  const hub = (await call('GET', `/games/${h.hubId}`, null, kid)).data.game;
  assert.equal(hub.name, 'The Hunt: Another Dimension');
  const c = await join(kid, { placeId: h.hubId });
  const w = await c.wait((m) => m.t === 'welcome');
  const wsNode = w.snapshot.find((s) => s.c === 'Workspace');
  assert.equal(wsNode.p.Gravity, 75); // low gravity
  const frag = wsNode.ch.find((n) => n.p.Name === 'StarFragments').ch[0];
  const pad = wsNode.ch.find((n) => n.p.Name === 'LaunchPads').ch[0];
  await c.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  // a launch pad throws you up
  c.ws.send(JSON.stringify({ t: 'move', p: [pad.p.CFrame[0], pad.p.CFrame[1] + 2.5, pad.p.CFrame[2]], ry: 0, a: 'idle' }));
  const up = await c.wait((m) => m.t === 'impulse');
  assert.ok(up.v[1] > 50);
  // a star fragment counts once
  c.ws.send(JSON.stringify({ t: 'move', p: [frag.p.CFrame[0], frag.p.CFrame[1], frag.p.CFrame[2]], ry: 0, a: 'idle' }));
  assert.match((await c.wait((m) => m.t === 'sys' && /Star fragment/.test(m.text))).text, /Star fragment 1\/6/);
  c.ws.close();
  assert.equal((await call('GET', '/hunt', null, kid)).data.fragments.count, 1);
});

test('permissions: fine settings for each right (item types, limits, bans, Robits)', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const helper = await call('POST', '/auth/signup', { username: 'FineHelper', password: 'secret123' });
  const hc = helper.cookie;
  const id = helper.data.user.id;
  const victim = (await call('POST', '/auth/signup', { username: 'FineVictim', password: 'secret123' })).data.user;
  await call('POST', `/admin/users/${id}/perms`, {
    perms: ['items', 'moderator', 'economy'],
    permOpts: { items: { types: ['Hat', 'Pet'], maxPrice: 50, perDay: 1 }, moderator: { maxBan: '1d', deviceBan: false, deleteUsers: false }, economy: { maxRobits: 100, membership: false } },
  }, admin);
  const o = (await call('GET', '/create/options', null, hc)).data;
  assert.deepEqual(o.types, ['Hat', 'Pet']);
  const hat = { type: 'Hat', name: 'Fine Hat', price: 10, data: { model: 'beanie', color: '#ffcc00' } };
  assert.equal((await call('POST', '/catalog/create', { ...hat, type: 'Shirt', data: { color: '#ff0000' } }, hc)).status, 403);
  assert.match((await call('POST', '/catalog/create', { ...hat, price: 500 }, hc)).data.error, /highest price/);
  assert.equal((await call('POST', '/catalog/create', hat, hc)).status, 200);
  assert.match((await call('POST', '/catalog/create', { ...hat, name: 'Second Hat' }, hc)).data.error, /a day/);
  // bans up to a day, no device bans
  assert.equal((await call('POST', `/admin/users/${victim.id}/ban`, { banned: true, duration: '7d' }, hc)).status, 403);
  assert.equal((await call('POST', `/admin/users/${victim.id}/ban`, { banned: true, duration: '1d', device: true }, hc)).status, 403);
  assert.equal((await call('POST', `/admin/users/${victim.id}/ban`, { banned: true, duration: '1d' }, hc)).status, 200);
  await call('POST', `/admin/users/${victim.id}/ban`, { banned: false }, hc);
  assert.equal((await call('POST', `/admin/users/${victim.id}/delete`, {}, hc)).status, 403);
  // Robits: at most 100 at once, no Builders Club
  assert.equal((await call('POST', `/admin/users/${victim.id}/robits`, { amount: 1000 }, hc)).status, 403);
  assert.equal((await call('POST', `/admin/users/${victim.id}/robits`, { amount: 100 }, hc)).status, 200);
  assert.equal((await call('POST', `/admin/users/${victim.id}/membership`, { tier: 'BuildersClub' }, hc)).status, 403);
  // the settings come back in the Admin Panel
  const u = (await call('GET', '/admin/overview', null, admin)).data.users.find((x) => x.id === id);
  assert.deepEqual(u.permOpts.items.types, ['Hat', 'Pet']);
});

test('The Hunt: the Rift goal can be reached and admins can change it', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  await call('POST', '/admin/hunt', { public: true }, admin);
  const kid = (await call('POST', '/auth/signup', { username: 'RiftKid', password: 'secret123' })).cookie;
  let a = (await call('GET', '/admin/hunt', null, admin)).data;
  assert.equal(a.riftGoal, 50); // a round number a small server can reach
  assert.equal((await call('POST', '/admin/hunt', { riftGoal: 0 }, admin)).status, 400);
  const g = (await call('GET', '/admin/hunt/player?user=riftkid', null, admin)).data.games[0];
  await call('POST', '/admin/hunt/tokens', { user: 'RiftKid', gameId: g.id }, admin);
  a = (await call('GET', '/admin/hunt', null, admin)).data;
  await call('POST', '/admin/hunt', { riftGoal: a.riftShards }, admin);
  const h = (await call('GET', '/hunt', null, kid)).data;
  assert.equal(h.rift.open, true);
  assert.ok(h.rewards.find((r) => r.key === 'rift').got);
  await call('POST', '/admin/hunt', { riftGoal: 50 }, admin);
});

test('The Hunt event manager: launch a quest event, quests in games, end it', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'QuestKid', password: 'secret123' })).cookie;
  let a = (await call('GET', '/admin/hunt', null, admin)).data;
  assert.ok(a.events.some((e) => e.key === 'relics' && e.kind === 'quests'));
  assert.equal(a.current, 'dimension');
  // a player game with its own quest, and one without (it gets the runes)
  const maker = (await call('POST', '/auth/signup', { username: 'QuestMaker', password: 'secret123' })).cookie;
  const own = (await call('POST', '/games', { name: 'Quest Script Game', template: 'baseplate' }, maker)).data.game;
  const place = (await call('GET', `/games/${own.id}/place`, null, maker)).data.place;
  place.services.ServerScriptService = place.services.ServerScriptService || { c: 'ServerScriptService', p: {}, ch: [] };
  place.services.ServerScriptService.ch.push({ c: 'Script', p: { Name: 'Quest', Source: 'local Hunt = game:GetService("HuntService")\nHunt:SetQuestText("Say hello to the dragon")\ngame:GetService("Players").PlayerAdded:Connect(function(p) wait(2) Hunt:CompleteQuest(p) end)' } });
  await call('PUT', `/games/${own.id}/place`, { place }, maker);
  await call('PATCH', `/games/${own.id}`, { isPublic: true }, maker);
  const plain = (await call('POST', '/games', { name: 'Quest Rune Game', template: 'obby' }, maker)).data.game;
  await call('PATCH', `/games/${plain.id}`, { isPublic: true }, maker);
  // launch Lost Relics for everyone
  assert.equal((await call('POST', '/admin/hunt/control', { action: 'launch', key: 'relics', public: true }, kid)).status, 403);
  a = (await call('POST', '/admin/hunt/control', { action: 'launch', key: 'relics', public: true }, admin)).data;
  assert.equal(a.current, 'relics');
  assert.ok(a.past.some((p) => p.key === 'dimension'));
  const keepGames = a.games;
  const keepAuto = a.autoPlayers;
  const bmId = a.official.find((x) => x.name === 'Button Mania').id;
  await call('POST', '/admin/hunt', { autoPlayers: 0, games: [...a.games, bmId, own.id, plain.id] }, admin);
  const h = (await call('GET', '/hunt', null, kid)).data;
  assert.equal(h.name, 'The Hunt: Lost Relics');
  assert.equal(h.kind, 'quests');
  assert.equal(h.count, 0);
  const g = (name) => h.games.find((x) => x.name === name);
  assert.equal(g('Quest Script Game').quest, 'Say hello to the dragon');
  assert.match(g('Quest Rune Game').quest, /runes/);
  assert.match(g('Button Mania').quest, /button/i);
  // 1) the game's own script completes the quest
  const c1 = await join(kid, { placeId: own.id });
  const q1 = await c1.wait((m) => m.t === 'huntQuest');
  assert.equal(q1.text, 'Say hello to the dragon');
  const done1 = await c1.wait((m) => m.t === 'hunt', 8000);
  assert.equal(done1.kind, 'quests');
  assert.deepEqual(done1.reward.items.map((i) => i.name), ['Relic Hunter Tee']);
  c1.ws.close();
  // 2) Button Mania: press every button
  const bm = g('Button Mania');
  const c2 = await join(kid, { placeId: bm.id });
  const w2 = await c2.wait((m) => m.t === 'welcome');
  await c2.wait((m) => m.t === 'huntQuest');
  const btns = w2.snapshot.find((s) => s.c === 'Workspace').ch.find((n) => n.p.Name === 'Buttons').ch.filter((n) => (n.ch || []).some((x) => x.c === 'ClickDetector'));
  assert.ok(btns.length >= 3);
  for (const b of btns) {
    c2.ws.send(JSON.stringify({ t: 'move', p: [b.p.CFrame[0], b.p.CFrame[1] + 2, b.p.CFrame[2] - 4], ry: 0, a: 'idle' }));
    await new Promise((r) => setTimeout(r, 120));
    c2.ws.send(JSON.stringify({ t: 'click', id: b.id }));
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.equal((await c2.wait((m) => m.t === 'hunt', 5000)).count, 2);
  c2.ws.close();
  // 3) the runes, in order
  const c3 = await join(kid, { placeId: plain.id });
  await c3.wait((m) => m.t === 'huntQuest');
  const findRunes = () => {
    for (const m of c3.inbox) {
      const nodes = m.t === 'tick' ? m.ops.filter((o) => o[0] === 'add').map((o) => o[2]) : [];
      for (const n of nodes) if (n.c === 'Folder' && n.p.Name === 'HuntRunes' && (n.ch || []).length === 3) return n.ch;
    }
    return null;
  };
  await c3.wait((m) => m.t === 'tick' && !!findRunes());
  await c3.wait((m) => m.t === 'tick' && m.ops.some((o) => o[0] === 'char'));
  const runes = findRunes();
  const touch = async (r) => {
    c3.ws.send(JSON.stringify({ t: 'move', p: [r.p.CFrame[0], r.p.CFrame[1], r.p.CFrame[2]], ry: 0, a: 'idle' }));
    await new Promise((res) => setTimeout(res, 400));
  };
  await touch(runes[2]);
  assert.ok(await c3.wait((m) => m.t === 'sys' && /still dark/.test(m.text)));
  await touch(runes[0]);
  await touch(runes[1]);
  await touch(runes[2]);
  assert.equal((await c3.wait((m) => m.t === 'hunt', 5000)).count, 3);
  c3.ws.close();
  // schedules: no times in the past; end it now
  assert.equal((await call('POST', '/admin/hunt/control', { action: 'schedule', endsAt: Date.now() - 3600e3 }, admin)).status, 400);
  a = (await call('POST', '/admin/hunt/control', { action: 'schedule', endsAt: Date.now() + 3600e3, next: { key: 'dimension', startsAt: Date.now() + 7200e3, public: true } }, admin)).data;
  assert.ok(a.endsAt > Date.now() && a.next.key === 'dimension');
  a = (await call('POST', '/admin/hunt/control', { action: 'end' }, admin)).data;
  assert.equal(a.state, 'ended');
  const after = (await call('GET', '/hunt', null, kid)).data;
  assert.equal(after.visible, false);
  assert.equal(after.ended.name, 'The Hunt: Lost Relics');
  assert.equal(after.next.name, 'The Hunt: Another Dimension');
  assert.equal((await call('GET', '/auth/me', null, kid)).data.user.hunt, false);
  // back to the dimension event for the other tests
  await call('POST', '/admin/hunt/control', { action: 'schedule', next: null }, admin);
  await call('POST', '/admin/hunt/control', { action: 'launch', key: 'dimension', public: true }, admin);
  await call('POST', '/admin/hunt', { autoPlayers: keepAuto, games: keepGames }, admin);
});

test('The Hunt private preview: only testers, on their own servers; first win counts; custom events', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const other = await call('POST', '/auth/signup', { username: 'OtherAdmin', password: 'secret123' });
  await call('POST', `/admin/users/${other.data.user.id}/admin`, { isAdmin: true }, admin);
  const player = (await call('POST', '/auth/signup', { username: 'PreviewPlayer', password: 'secret123' })).cookie;
  // a game whose quest is "get 1 more Wins": the script gives a win after 6 s
  const maker = (await call('POST', '/auth/signup', { username: 'WinMaker', password: 'secret123' })).cookie;
  const wg = (await call('POST', '/games', { name: 'First Win Game', template: 'baseplate' }, maker)).data.game;
  const place = (await call('GET', `/games/${wg.id}/place`, null, maker)).data.place;
  place.services.ServerScriptService.ch.push({ c: 'Script', p: { Name: 'Wins', Source: 'game:GetService("Players").PlayerAdded:Connect(function(p)\nlocal ls = Instance.new("Folder") ls.Name = "leaderstats" ls.Parent = p\nlocal w = Instance.new("IntValue") w.Name = "Wins" w.Parent = ls\nwait(6) w.Value = w.Value + 1\nend)' } });
  await call('PUT', `/games/${wg.id}/place`, { place }, maker);
  await call('PATCH', `/games/${wg.id}`, { isPublic: true }, maker);
  let a = (await call('GET', '/admin/hunt', null, admin)).data;
  const keepGames = a.games, keepAuto = a.autoPlayers;
  a = (await call('POST', '/admin/hunt/control', { action: 'launch', key: 'relics', public: false }, admin)).data;
  assert.deepEqual(a.testers.map((t) => t.username), ['Tester_1']);
  await call('POST', '/admin/hunt', { autoPlayers: 0, games: [wg.id] }, admin);
  await call('POST', '/admin/hunt/quest', { gameId: wg.id, quest: { type: 'gain', name: 'Wins', target: 1, text: 'Win once' } }, admin);
  // other admins and players don't see the preview
  assert.equal((await call('GET', '/hunt', null, other.cookie)).data.visible, false);
  assert.equal((await call('GET', '/auth/me', null, other.cookie)).data.user.hunt, false);
  const h = (await call('GET', '/hunt', null, admin)).data;
  assert.equal(h.visible, true);
  const hubTry = await join(other.cookie, { placeId: h.hubId });
  assert.equal((await hubTry.wait((m) => m.t === 'welcome' || m.t === 'error')).msg, 'The Hunt is not open yet.');
  // the tester plays on an own server; the player on a normal one without the quest
  const t = await join(admin, { placeId: wg.id });
  const tw = await t.wait((m) => m.t === 'welcome');
  assert.equal((await t.wait((m) => m.t === 'huntQuest')).text, 'Win once');
  const p = await join(player, { placeId: wg.id });
  const pw = await p.wait((m) => m.t === 'welcome');
  assert.notEqual(pw.serverId, tw.serverId);
  assert.ok(!(await call('GET', `/games/${wg.id}/servers`, null, player)).data.servers?.some((s) => s.id === tw.serverId));
  // the very first win counts
  const done = await t.wait((m) => m.t === 'hunt', 12000);
  assert.equal(done.count, 1);
  await new Promise((r) => setTimeout(r, 1000));
  assert.ok(!p.inbox.some((m) => m.t === 'huntQuest' || m.t === 'hunt'));
  t.ws.close(); p.ws.close();
  // the testers list
  a = (await call('POST', '/admin/hunt/testers', { add: 'OtherAdmin' }, admin)).data;
  assert.equal((await call('GET', '/hunt', null, other.cookie)).data.visible, true);
  await call('POST', '/admin/hunt/testers', { remove: other.data.user.id }, admin);
  // a custom event
  assert.equal((await call('POST', '/admin/hunt/custom', { event: { name: 'Pirates', prizes: [] } }, admin)).status, 400);
  const c = (await call('POST', '/admin/hunt/custom', { event: { name: 'Pirate Treasure', description: 'Find the gold!', kind: 'quests', hub: 'relics', robits: 30, teamGoal: 5,
    prizes: [{ name: 'Pirate Hat', type: 'Hat', model: 'pirate', color: '#222222', count: 1 }, { name: 'Golden Parrot', type: 'Pet', model: 'dragon', color: '#ffc400', share: 100 }],
    teamPrize: { name: 'Treasure Crown', type: 'Hat', model: 'crown', color: '#ffc400' } } }, admin)).data;
  assert.ok(c.events.some((e) => e.key === c.key && e.custom && e.name === 'The Hunt: Pirate Treasure'));
  await call('POST', '/admin/hunt/control', { action: 'launch', key: c.key, public: true }, admin);
  const ch = (await call('GET', '/hunt', null, player)).data;
  assert.equal(ch.name, 'The Hunt: Pirate Treasure');
  assert.equal(ch.description, 'Find the gold!');
  assert.deepEqual(ch.rewards.map((r) => r.name), ['Pirate Hat', 'Golden Parrot', 'Treasure Crown']);
  assert.equal((await call('POST', '/admin/hunt/custom', { key: c.key, delete: true }, admin)).status, 400); // it's live
  // back to the dimension event for the other tests
  await call('POST', '/admin/hunt/control', { action: 'launch', key: 'dimension', public: true }, admin);
  await call('POST', '/admin/hunt', { autoPlayers: keepAuto, games: keepGames }, admin);
});

test('Admin Panel 2.0: give items, set Robits, gifts, warnings, notes, reports, activity', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = await call('POST', '/auth/signup', { username: 'PanelTwoKid', password: 'secret123' });
  const snitch = (await call('POST', '/auth/signup', { username: 'PanelSnitch', password: 'secret123' })).cookie;
  const kidId = kid.data.user.id;
  // find an item that is not for sale (an event prize) and give it
  const found = (await call('GET', '/admin/items/search?q=Crown', null, admin)).data.items;
  const prize = found.find((i) => i.offsale);
  assert.ok(prize, JSON.stringify(found.map((i) => i.name)));
  assert.equal((await call('GET', '/admin/items/search?q=a', null, kid.cookie)).status, 403);
  let r = (await call('POST', `/admin/users/${kidId}/give`, { itemIds: [prize.id, found[0].id] }, admin)).data;
  assert.ok(r.given.includes(prize.name));
  assert.ok((await call('GET', `/users/${kidId}/inventory`)).data.items.some((i) => i.id === prize.id));
  assert.equal((await call('POST', `/admin/users/${kidId}/give`, { itemIds: [prize.id] }, admin)).data.given.length, 0);
  // the exact balance
  r = (await call('POST', `/admin/users/${kidId}/robitsset`, { value: 4321 }, admin)).data;
  assert.equal(r.user.robits, 4321);
  // membership for some days
  await call('POST', `/admin/users/${kidId}/membership`, { tier: 'BuildersClub', days: 7 }, admin);
  assert.equal((await call('GET', '/auth/me', null, kid.cookie)).data.user.membership, 'BuildersClub');
  // gift center: by names, with a message in the inbox
  const pv = (await call('POST', '/admin/gift/preview', { to: 'names', names: 'PanelTwoKid, nobody_here_xyz' }, admin)).data;
  assert.deepEqual([pv.count, pv.missing], [1, ['nobody_here_xyz']]);
  r = (await call('POST', '/admin/gift', { to: 'names', names: 'PanelTwoKid', robits: 79, message: 'Thanks!' }, admin)).data;
  assert.equal(r.players, 1);
  assert.equal((await call('GET', '/auth/me', null, kid.cookie)).data.user.robits, 4321 + 79);
  assert.ok((await call('GET', '/messages', null, kid.cookie)).data.messages.some((m) => /gift/i.test(m.subject)));
  // a warning: a popup on the next page, until seen
  await call('POST', `/admin/users/${kidId}/warn`, { reason: 'Spamming the chat' }, admin);
  let me = (await call('GET', '/auth/me', null, kid.cookie)).data.user;
  assert.equal(me.warning.reason, 'Spamming the chat');
  await call('POST', '/me/warning/seen', {}, kid.cookie);
  assert.equal((await call('GET', '/auth/me', null, kid.cookie)).data.user.warning, null);
  // staff notes
  let n = (await call('POST', `/admin/users/${kidId}/notes`, { text: 'Watch the trades' }, admin)).data.notes;
  assert.equal(n[0].text, 'Watch the trades');
  assert.equal((await call('GET', `/admin/users/${kidId}/notes`, null, kid.cookie)).status, 403);
  n = (await call('GET', `/admin/users/${kidId}/notes`, null, admin)).data;
  assert.equal(n.warnings.length, 1);
  // reports: a player reports, a moderator resolves, the reporter gets a thank-you
  assert.equal((await call('POST', '/reports', { userId: kidId, reason: 'nope' }, snitch)).status, 400);
  assert.equal((await call('POST', '/reports', { userId: kidId, reason: 'Spam', details: 'spams' }, snitch)).status, 200);
  assert.equal((await call('POST', '/reports', { userId: kidId, reason: 'Spam' }, snitch)).status, 400); // already open
  const rep = (await call('GET', '/admin/reports', null, admin)).data;
  assert.ok(rep.open >= 1);
  const mine = rep.reports.find((x) => x.userId === kidId);
  assert.equal((await call('GET', '/admin/live', null, admin)).data.reports, rep.open);
  await call('POST', `/admin/reports/${mine.id}`, { status: 'resolved', note: 'warned' }, admin);
  assert.ok((await call('GET', '/messages', null, snitch)).data.messages.some((m) => /report/i.test(m.subject)));
  // the activity feed and "where is the player"
  const act = (await call('GET', '/admin/activity', null, admin)).data.events;
  assert.ok(act.some((e) => e.kind === 'signup' && e.username === 'PanelTwoKid'));
  assert.ok(act.some((e) => e.kind === 'report'));
  assert.equal((await call('GET', `/admin/users/${kidId}/where`, null, admin)).status, 400);
});

test('Discord Activity: session without cookies, settings, token exchange is off until set up', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  // logging in from inside Discord gives the session to the page
  const res = await fetch(base + '/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-robis-discord': '1' }, body: JSON.stringify({ username: 'DiscordKid', password: 'secret123' }) });
  const data = await res.json();
  assert.match(data.session, /^[0-9a-f]{64}$/);
  // the header works instead of the cookie
  const me = await (await fetch(base + '/api/auth/me', { headers: { 'x-robis-session': data.session } })).json();
  assert.equal(me.user.username, 'DiscordKid');
  // normal logins don't show the session
  assert.equal((await call('POST', '/auth/login', { username: 'DiscordKid', password: 'secret123' })).data.session, undefined);
  // the game socket with ?rs=
  const game = (await call('GET', '/games?sort=popular')).data.games[0];
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws?rs=' + data.session);
  const first = await new Promise((resolve, reject) => {
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', placeId: game.id })));
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome' || m.t === 'error') resolve(m); });
    ws.on('error', reject);
  });
  assert.equal(first.t, 'welcome');
  ws.close();
  // not set up: no token exchange, nothing in /site
  assert.equal((await call('POST', '/discord/token', { code: 'abcdefghijkl' })).status, 404);
  assert.equal((await call('GET', '/site')).data.discord, null);
  // set up: the secret is kept on the server
  assert.equal((await call('POST', '/admin/settings', { discord: { on: true, appId: 'robis' } }, admin)).status, 400);
  const s = (await call('POST', '/admin/settings', { discord: { on: true, appId: '123456789012345678', secret: 'topsecretvalue' } }, admin)).data.settings;
  assert.deepEqual(s.discord, { on: true, status: true, appId: '123456789012345678', hasSecret: true });
  assert.ok(!JSON.stringify((await call('GET', '/admin/settings', null, admin)).data).includes('topsecretvalue'));
  assert.deepEqual((await call('GET', '/site')).data.discord, { appId: '123456789012345678' });
  await call('POST', '/admin/settings', { discord: { on: false, appId: '', clearSecret: true } }, admin);
});

test('Discord status: the helper app, what it shows, the private key', async () => {
  const admin = (await call('POST', '/auth/login', { username: 'Tester_1', password: 'secret123' })).cookie;
  const kid = (await call('POST', '/auth/signup', { username: 'StatusKid', password: 'secret123' })).cookie;
  // off until the admins set the Application ID
  assert.equal((await call('GET', '/me/discord-status', null, kid)).data.enabled, false);
  assert.equal((await fetch(base + '/api/me/discord-status/RobisDiscordStatus.bat', { headers: { cookie: kid } })).status, 404);
  await call('POST', '/admin/settings', { discord: { status: true, appId: '123456789012345678' } }, admin);
  assert.equal((await call('GET', '/site')).data.discordStatus, true);
  const st = (await call('GET', '/me/discord-status', null, kid)).data;
  assert.equal(st.enabled, true);
  assert.match(st.key, /^[0-9a-z]{32}$/);
  // the file: a .bat with the player's key and the app id
  const res = await fetch(base + '/api/me/discord-status/RobisDiscordStatus.bat', { headers: { cookie: kid } });
  assert.match(res.headers.get('content-disposition'), /RobisDiscordStatus\.bat/);
  const bat = await res.text();
  assert.ok(bat.startsWith('@echo off\r\n'));
  assert.ok(bat.includes(`$key = '${st.key}'`) && bat.includes("$app = '123456789012345678'") && bat.includes('#PSBEGIN#'));
  assert.ok(!bat.includes('\n') || bat.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r')));
  // what the helper sees: on the site, then in a game
  let p = (await call('GET', `/presence/discord/${st.key}`)).data;
  assert.equal(p.details, 'Browsing Robis');
  const game = (await call('GET', '/games?sort=popular')).data.games[0];
  const c = await join(kid, { placeId: game.id });
  await c.wait((m) => m.t === 'welcome');
  p = (await call('GET', `/presence/discord/${st.key}`)).data;
  assert.equal(p.details, `Playing ${game.name}`);
  assert.equal(p.state, 'Playing solo');
  assert.ok(p.start > 0 && p.buttons[0].url.endsWith(`/game?id=${game.id}`));
  c.ws.close();
  // a new key: the old file stops working
  await call('POST', '/me/discord-status/reset', {}, kid);
  assert.equal((await call('GET', `/presence/discord/${st.key}`)).status, 404);
  await call('POST', '/admin/settings', { discord: { status: false, appId: '' } }, admin);
});
