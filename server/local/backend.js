// The whole Robis server running inside the browser (standalone / phone build).
// boot.js routes fetch('/api/...') and WebSocket('/ws') here instead of the network.
import { Database } from './db-local.js';
import { createApi } from '../api.js';
import { GameManager } from '../game/manager.js';
import { seed } from '../seed/seed.js';
import { userFromToken, parseCookies, COOKIE } from '../auth.js';
import { handleConnection } from '../connection.js';
import { createUser } from '../seed/seed.js';
import { validUsername, isBanned, banDetails } from '../auth.js';

let ready = null;
export function init() {
  if (!ready) {
    ready = (async () => {
      const db = await Database.open();
      if (db.isEmpty) { seed(db); db.flush(); }
      const manager = new GameManager(db);
      // Every phone is its own world, so being first proves nothing: admins need the code.
      const api = createApi(db, manager, { firstUserIsAdmin: false, requireAdminCode: true, adminCodeHash: __ROBIS_ADMIN_HASH__ });
      addEventListener('pagehide', () => db.flush());
      return { db, manager, api };
    })();
  }
  return ready;
}

// Handles one REST call. Returns {status, headers, body, token} where token is
// the new session (string), '' when logged out, or undefined when unchanged.
export async function handle({ method, path, query, body, token }) {
  const { db, api } = await init();
  const req = {
    method, path, query: query || {}, body: body || {}, params: {},
    headers: { cookie: token ? `${COOKIE}=${token}` : '' },
  };
  req.user = userFromToken(db, token);
  if (req.user) req.user.lastOnline = Date.now();
  const res = {
    statusCode: 200, headers: {}, body: null, token: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) {
      if (k.toLowerCase() === 'set-cookie') {
        const t = parseCookies(String(v))[COOKIE];
        this.token = /Max-Age=0\b/.test(String(v)) ? '' : t;
      } else this.headers[k.toLowerCase()] = v;
    },
    json(o) { this.headers['content-type'] = 'application/json'; this.body = JSON.stringify(o); },
    end() {},
    sendFile(key) {
      const b64 = db.readThumb(key);
      if (!b64) { this.statusCode = 404; return; }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.headers['content-type'] = bytes[0] === 0xff ? 'image/jpeg' : 'image/png';
      this.body = new Blob([bytes], { type: this.headers['content-type'] });
    },
  };
  await api.handle(req, res);
  if (method !== 'GET') await db.settled();
  return { status: res.statusCode, headers: res.headers, body: res.body, token: res.token };
}

// An in-memory socket pair. `client` behaves like a browser WebSocket; the
// server end is what GameServer expects from the `ws` package.
export async function connect(token, client) {
  const { db, manager } = await init();
  const listeners = { message: [], close: [] };
  const server = {
    readyState: 1,
    on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); },
    send(data) {
      if (server.readyState !== 1) return;
      queueMicrotask(() => client._deliver(data));
    },
    close() {
      if (server.readyState !== 1) return;
      server.readyState = 3;
      queueMicrotask(() => client._closed());
      for (const fn of listeners.close) fn();
    },
  };
  client._server = server;
  client._toServer = (data) => { if (server.readyState === 1) for (const fn of listeners.message) fn(data); };
  handleConnection(server, userFromToken(db, token), { db, manager });
}

// A friend joining this device's game room (public/js/game/rooms.js).
// Friends get a password-less account in this world, found again by their
// device id, so admins here can see and ban them like anyone else.
const HEX = /^#[0-9a-f]{6}$/i;
function cleanAvatar(a) {
  const colors = {};
  for (const [k, v] of Object.entries((a && a.bodyColors) || {})) if (HEX.test(v)) colors[k] = v;
  const items = (Array.isArray(a && a.items) ? a.items : []).slice(0, 10)
    .map((i) => ({ id: +i.id || 0, name: String(i.name || '').slice(0, 60), type: String(i.type || '').slice(0, 20), data: i.data && typeof i.data === 'object' ? i.data : {} }))
    .filter((i) => JSON.stringify(i.data).length < 2000);
  return { bodyColors: colors, items };
}

export async function connectRemote(hello, sock) {
  const { db, manager } = await init();
  const D = db.data;
  const rid = /^[a-z0-9]{16}$/.test(hello && hello.id) ? hello.id : null;
  if (!rid) { sock.send(JSON.stringify({ t: 'error', msg: 'Bad room request.' })); sock.close(); return; }
  let user = Object.values(D.users).find((u) => u.remoteId === rid);
  if (!user) {
    let base = validUsername(hello.name) ? hello.name : 'Guest';
    let name = base;
    for (let i = 2; Object.values(D.users).some((u) => u.username.toLowerCase() === name.toLowerCase()); i++) name = (base.slice(0, 17) + '_' + i).replace(/__+/, '_');
    user = createUser(db, name, null, { remote: true, remoteId: rid });
    delete user.salt;
    delete user.hash;
  }
  user.remoteAvatar = cleanAvatar(hello.avatar);
  user.lastOnline = Date.now();
  db.save();
  if (isBanned(user)) {
    sock.send(JSON.stringify({ t: 'error', msg: `You are banned from this room.${banDetails(user)}` }));
    sock.close();
    return;
  }
  // Guests may only join a normal game server, never start a Studio test one.
  const guestSock = Object.create(sock);
  guestSock.on = (ev, fn) => sock.on(ev, ev !== 'message' ? fn : (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.t === 'join' && m.test) { delete m.test; raw = JSON.stringify(m); }
    } catch { /* handled by the connection */ }
    fn(raw);
  });
  handleConnection(guestSock, user, { db, manager });
}
