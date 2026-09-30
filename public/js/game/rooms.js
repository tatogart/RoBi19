// Multiplayer for the phone/PC app (standalone build), where every device is
// its own world. One player hosts: their device runs the game server and gets
// a room code. Friends enter the code and join that game over WebRTC
// (PeerJS; the public PeerJS server only introduces the devices, game data
// then flows directly between them).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const peerId = (code) => 'robis-room-' + code.toLowerCase();

// Tests (and self-hosters) can point to another PeerJS server:
// localStorage['robis.peer'] = '{"host":"localhost","port":9000,"path":"/","secure":false}'
function peerOptions() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('robis.peer')) || {}; } catch { /* default server */ }
  return { debug: 0, ...o };
}

let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerLib) {
    peerLib = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/vendor/peerjs/peerjs.min.js'; // the phone build adds its base path
      s.onload = () => resolve(window.Peer);
      s.onerror = () => reject(new Error('Could not load the multiplayer library. Are you online?'));
      document.head.append(s);
    });
  }
  return peerLib;
}

function openPeer(peer) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('The room server did not answer. Check your internet connection.')), 15000);
    peer.once('open', () => { clearTimeout(t); resolve(peer); });
    peer.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

// ---------------------------------------------------------------- host
// Opens a room for the game server this device is running.
export async function hostRoom({ placeId, serverId, name, onGuests }) {
  const Peer = await loadPeer();
  const backend = await window.robisBackend();
  let peer = null;
  let code = '';
  for (let i = 0; i < 4 && !peer; i++) {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    try {
      peer = await openPeer(new Peer(peerId(code), peerOptions()));
    } catch (e) {
      if (e.type !== 'unavailable-id') throw e;
    }
  }
  if (!peer) throw new Error('Could not create a room. Try again.');
  const guests = new Set();
  const changed = () => onGuests && onGuests([...guests].map((g) => g.name));
  peer.on('connection', (conn) => {
    let joined = false;
    const listeners = { message: [], close: [] };
    const sock = {
      readyState: 1,
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); },
      send(data) { if (sock.readyState === 1 && conn.open) conn.send(data); },
      close() {
        if (sock.readyState !== 1) return;
        sock.readyState = 3;
        try { conn.close(); } catch { /* already closed */ }
        for (const fn of listeners.close) fn();
      },
    };
    const guest = { name: '?' };
    conn.on('data', (d) => {
      if (!joined) {
        if (!d || d.t !== 'hello') { conn.close(); return; }
        joined = true;
        guest.name = String(d.name || 'Guest').slice(0, 20);
        guests.add(guest);
        changed();
        conn.send({ t: 'room', placeId, serverId, name });
        backend.connectRemote(d, sock);
        return;
      }
      if (typeof d === 'string') for (const fn of listeners.message) fn(d);
    });
    conn.on('close', () => { guests.delete(guest); changed(); sock.close(); });
    conn.on('error', () => sock.close());
  });
  // Losing the introduction server doesn't drop players already connected.
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  return { code, close: () => peer.destroy() };
}

// ---------------------------------------------------------------- guest
function remoteId() {
  let id = '';
  try { id = localStorage.getItem('robis.remoteId') || ''; } catch { /* private mode */ }
  if (!/^[a-z0-9]{16}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('robis.remoteId', id); } catch { /* private mode */ }
  }
  return id;
}

// Looks like a WebSocket to the game client, but talks to a host's room.
export class RoomSocket {
  constructor(code) {
    this.readyState = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    this.room = null;
    this._start(normalizeCode(code));
  }

  async _start(code) {
    try {
      const Peer = await loadPeer();
      const [me, avatar] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()).then((r) => r.user),
        fetch('/api/avatar/resolved').then((r) => r.json()).catch(() => null),
      ]);
      this.peer = await openPeer(new Peer(undefined, peerOptions()));
      const conn = this.conn = this.peer.connect(peerId(code), { reliable: true, serialization: 'json' });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 20000);
        conn.on('open', () => { clearTimeout(t); resolve(); });
        this.peer.on('error', (e) => { clearTimeout(t); reject(e); });
      });
      conn.on('data', (d) => {
        if (!this.room) {
          if (d && d.t === 'room') {
            this.room = d;
            this.readyState = 1;
            if (this.onopen) this.onopen({});
          }
          return;
        }
        if (this.onmessage) this.onmessage({ data: typeof d === 'string' ? d : JSON.stringify(d) });
      });
      conn.on('close', () => this._closed());
      conn.send({ t: 'hello', v: 1, id: remoteId(), name: me ? me.username : 'Guest', avatar: avatar && avatar.avatar });
    } catch (e) {
      const msg = e && e.type === 'peer-unavailable' ? `There is no room with the code ${code}. Check the code, and make sure your friend is still in the game.`
        : e && e.message === 'timeout' ? 'Could not connect to your friend. Try again, or use the same Wi-Fi.'
          : (e && e.message) || 'Could not join the room.';
      this.readyState = 1;
      if (this.onmessage) this.onmessage({ data: JSON.stringify({ t: 'error', msg }) });
      this._closed();
    }
  }

  send(data) {
    if (this.readyState !== 1 || !this.conn) return;
    let m = data;
    try {
      const o = JSON.parse(data);
      if (o.t === 'join') {
        // Join the host's game server, whatever this page thinks it is playing.
        o.placeId = this.room.placeId;
        o.serverId = this.room.serverId;
        delete o.test;
        m = JSON.stringify(o);
      }
    } catch { /* pass through */ }
    this.conn.send(m);
  }

  close() { this._closed(); }

  _closed() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    try { this.peer && this.peer.destroy(); } catch { /* ignore */ }
    if (this.onclose) this.onclose({ code: 1000 });
  }

  addEventListener(ev, fn) { this['on' + ev] = fn; }
}
