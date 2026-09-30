// Browser version of server/db.js: everything lives in memory and is saved to
// IndexedDB on the device, so the phone build needs no server at all.
const DB_NAME = 'robis';
const STORE = 'kv';

function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const EMPTY = () => ({
  meta: { version: 1, nextIds: { user: 1, game: 1, item: 1, message: 1 } },
  users: {}, sessions: {}, games: {}, items: {}, inventory: {}, friends: {}, friendRequests: [],
  favorites: {}, votes: {}, datastores: {}, messages: [], badges: {}, transactions: [],
});

export class Database {
  static async open() {
    const db = new Database();
    db.idb = await idb();
    const all = await new Promise((resolve, reject) => {
      const out = new Map();
      const tx = db.idb.transaction(STORE, 'readonly');
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) { resolve(out); return; }
        out.set(c.key, c.value);
        c.continue();
      };
      cur.onerror = () => reject(cur.error);
    });
    db.data = Object.assign(EMPTY(), all.get('db') || {});
    for (const [k, v] of all) {
      if (k.startsWith('place:')) db.places.set(+k.slice(6), v);
      if (k.startsWith('thumb:')) db.thumbs.set(k.slice(6), v);
    }
    return db;
  }

  constructor() {
    this.data = EMPTY();
    this.places = new Map();
    this.thumbs = new Map();
  }

  get isEmpty() { return Object.keys(this.data.users).length === 0; }

  nextId(kind) {
    const n = this.data.meta.nextIds;
    const id = n[kind] || 1;
    n[kind] = id + 1;
    return id;
  }

  _put(key, value) {
    const tx = this.idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
  }

  // Pages navigate right after API calls (e.g. sign-up -> /home), so writes
  // can't wait on a timer: queue them in the same task instead.
  save() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => this.flush());
  }

  flush() {
    this._queued = false;
    this._put('db', JSON.parse(JSON.stringify(this.data)));
  }

  readPlace(id) { const p = this.places.get(+id); return p ? JSON.parse(JSON.stringify(p)) : null; }
  writePlace(id, place) { this.places.set(+id, place); this._put('place:' + +id, place); }

  thumbPath(kind, id) { return `${kind}-${+id}`; }
  hasThumb(kind, id) { return this.thumbs.has(this.thumbPath(kind, id)); }
  writeThumb(kind, id, base64) { const k = this.thumbPath(kind, id); this.thumbs.set(k, base64); this._put('thumb:' + k, base64); }
  readThumb(key) { return this.thumbs.get(key) || null; }
}
