// Tiny JSON-file database. Everything lives in memory and is flushed to
// data/db.json shortly after each change. Places and thumbnails are stored as
// separate files so the main database stays small.
import fs from 'node:fs';
import path from 'node:path';

const EMPTY = () => ({
  meta: { version: 1, nextIds: { user: 1, game: 1, item: 1, message: 1 } },
  users: {},
  sessions: {},
  games: {},
  items: {},
  inventory: {}, // userId -> [itemId]
  friends: {}, // userId -> [userId]
  friendRequests: [], // {from, to, created}
  favorites: {}, // userId -> [gameId]
  votes: {}, // `${gameId}:${userId}` -> 1 | -1
  datastores: {}, // gameId -> storeName -> key -> value
  messages: [], // {id, from, to, subject, body, created, read}
  badges: {}, // userId -> [{gameId, name, awarded}]
  transactions: [],
});

export class Database {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    fs.mkdirSync(path.join(dir, 'places'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'thumbs'), { recursive: true });
    this.data = EMPTY();
    if (fs.existsSync(this.file)) {
      try {
        this.data = Object.assign(EMPTY(), JSON.parse(fs.readFileSync(this.file, 'utf8')));
      } catch (e) {
        console.error('[db] could not read database, starting fresh:', e.message);
      }
    }
    this._timer = null;
  }

  get isEmpty() { return Object.keys(this.data.users).length === 0; }

  nextId(kind) {
    const n = this.data.meta.nextIds;
    const id = n[kind] || 1;
    n[kind] = id + 1;
    return id;
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this._timer);
    this._timer = null;
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  // ---- places ----
  placePath(gameId) { return path.join(this.dir, 'places', `${+gameId}.json`); }
  readPlace(gameId) {
    const p = this.placePath(gameId);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  }
  writePlace(gameId, place) { fs.writeFileSync(this.placePath(gameId), JSON.stringify(place)); }

  // ---- thumbnails ----
  thumbPath(kind, id) { return path.join(this.dir, 'thumbs', `${kind}-${+id}.png`); }
  hasThumb(kind, id) { return fs.existsSync(this.thumbPath(kind, id)); }
  writeThumb(kind, id, base64) { fs.writeFileSync(this.thumbPath(kind, id), Buffer.from(base64, 'base64')); }
}
