// The whole Robis server running inside the browser (standalone / phone build).
// boot.js routes fetch('/api/...') and WebSocket('/ws') here instead of the network.
import { Database } from './db-local.js';
import { createApi } from '../api.js';
import { GameManager } from '../game/manager.js';
import { seed } from '../seed/seed.js';
import { userFromToken, parseCookies, COOKIE } from '../auth.js';
import { handleConnection } from '../connection.js';

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
