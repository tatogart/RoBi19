import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createServer } from '../server/index.js';

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
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
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
  assert.equal(data.games, 5);
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
  // free Robits packs and membership
  assert.equal((await call('POST', '/economy/buy', { amount: 400 }, c2)).data.robits, 75 + 25 + 400);
  assert.equal((await call('POST', '/economy/buy', { amount: 123 }, c2)).status, 400);
  assert.equal((await call('POST', '/economy/membership', { tier: 'TurboBuildersClub' }, c2)).data.user.stipend, 60);
  // admin panel: only admins, gift Robits, ban
  assert.equal((await call('GET', '/admin/overview', null, c2)).status, 403);
  const ov = (await call('GET', '/admin/overview', null, cookie)).data;
  const sid = ov.users.find((u) => u.username === 'Second').id;
  assert.equal((await call('POST', `/admin/users/${sid}/robits`, { amount: 1000 }, cookie)).data.user.robits, 1500);
  assert.equal((await call('POST', `/admin/users/${me.id}/ban`, { banned: true }, cookie)).status, 400);
  await call('POST', `/admin/users/${sid}/ban`, { banned: true, reason: 'test' }, cookie);
  assert.equal((await call('GET', '/auth/me', null, c2)).data.user, null);
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' })).status, 403);
  await call('POST', `/admin/users/${sid}/ban`, { banned: false }, cookie);
  assert.equal((await call('POST', '/auth/login', { username: 'Second', password: 'secret123' })).status, 200);
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
