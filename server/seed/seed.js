// Fills an empty database with the Robis account, the catalog and showcase games.
import { hashPassword } from '../auth.js';
import { CATALOG } from '../../shared/avatar.js';
import { SEED_GAMES } from './places.js';
import { MORE_GAMES } from './places2.js';
import { TEAM_GAMES } from './places3.js';
import { NOSTALGIA_GAMES } from './places4.js';
import { NEW_GAMES } from './places6.js';

export const STARTER_ITEMS = ['Bacon Hair', 'Smile', 'Blue Hoodie', 'Jeans', 'Robis Logo T-Shirt', 'Classic Robis Cap', 'Pal Hair', 'Man Face', 'Woman Face'];
export const STARTER_WEARING = ['Bacon Hair', 'Smile', 'Blue Hoodie', 'Jeans'];
export const STARTER_BODY = { head: '#eab892', torso: '#eab892', leftArm: '#eab892', rightArm: '#eab892', leftLeg: '#eab892', rightLeg: '#eab892' };

export function createUser(db, username, password, extra = {}) {
  const id = db.nextId('user');
  const { salt, hash } = password === null ? {} : hashPassword(password);
  const itemIds = Object.values(db.data.items).filter((i) => STARTER_ITEMS.includes(i.name)).map((i) => i.id);
  const wearing = Object.values(db.data.items).filter((i) => STARTER_WEARING.includes(i.name)).map((i) => i.id);
  const user = {
    id, username, salt, hash,
    created: Date.now(),
    lastOnline: Date.now(),
    robits: 100,
    blurb: '',
    status: '',
    isAdmin: false,
    lastStipend: 0,
    membership: 'None',
    avatar: { bodyColors: { ...STARTER_BODY }, wearing },
    ...extra,
  };
  db.data.users[id] = user;
  db.data.inventory[id] = [...new Set([...(db.data.inventory[id] || []), ...itemIds])];
  db.data.friends[id] = [];
  db.data.favorites[id] = [];
  db.save();
  return user;
}

// An account without a password (it can own things but can't be logged into).
export function createSystemUser(db, username, extra = {}) {
  const user = createUser(db, username, null, { system: true, robits: 0, ...extra });
  delete user.salt;
  delete user.hash;
  db.save();
  return user;
}

export function seed(db) {
  console.log('[seed] creating the Robis world...');
  // Catalog first so users get starter items.
  const now = Date.now();
  for (const [i, it] of CATALOG.entries()) {
    const id = db.nextId('item');
    db.data.items[id] = {
      id, name: it.name, type: it.type, price: it.price, data: it.data, description: it.desc,
      creatorId: 1, created: now - (CATALOG.length - i) * 86400e3, sales: Math.floor(Math.random() * 50000),
      limited: !!it.limited, remaining: it.limited ? 100 : null,
    };
  }
  // "Robis" is a system account: it owns the catalog and the showcase games,
  // but has no password, so nobody can log into it. Players create their own accounts.
  const robis = createSystemUser(db, 'Robis', {
    membership: 'OutrageousBuildersClub',
    blurb: 'Welcome to Robis! This is the main account that made the catalog and the first games. Create your own account and start building!',
    status: 'Building the future, one brick at a time.',
  });
  db.data.inventory[robis.id] = Object.keys(db.data.items).map(Number);
  const find = (n) => Object.values(db.data.items).find((i) => i.name === n).id;
  robis.avatar = {
    bodyColors: { head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b' },
    wearing: [find('Dominator of Robis'), find('Epic Face'), find('Black Suit'), find('Suit Pants')],
  };

  ensureOwner(db);
  addSeedGames(db);
  db.flush();
  console.log('[seed] done. Open the site and sign up — the first account you create becomes the admin (with ROBIS_ADMIN_CODE set: whoever enters that code).');
}

// ---------------------------------------------------------------- main account
// The main (official) account owns the catalog and the showcase games. It is
// Seek_tv87. Until a real admin account with that name exists, the built-in
// system account (no password, nobody can log in) carries the name; once an
// admin is called Seek_tv87 (sign up, enter the admin code, then rename in
// Settings), everything is handed over to that account.
export const OWNER_NAME = (typeof process !== 'undefined' && process.env && process.env.ROBIS_OWNER) || 'Seek_tv87';
export function officialAccount(D) {
  const users = Object.values(D.users);
  return users.find((u) => u.official) || users.find((u) => u.system && u.username === 'Robis') || null;
}
export function ensureOwner(db) {
  const D = db.data;
  const off = officialAccount(D);
  if (!off) return null;
  off.official = true;
  const same = (u) => u.username.toLowerCase() === OWNER_NAME.toLowerCase();
  const real = Object.values(D.users).find((u) => !u.system && u.isAdmin && same(u));
  if (off.system && real) {
    for (const g of Object.values(D.games)) if (g.creatorId === off.id) g.creatorId = real.id;
    for (const it of Object.values(D.items)) if (it.creatorId === off.id) it.creatorId = real.id;
    if (!real.flags || !Object.keys(real.flags).length) real.flags = { ...(off.flags || { verified: true, staff: true }) };
    real.official = true;
    for (const map of Object.values(D.serials || {})) delete map[off.id];
    for (const list of Object.values(D.friends)) { const i = list.indexOf(off.id); if (i >= 0) list.splice(i, 1); }
    delete D.inventory[off.id];
    delete D.users[off.id];
    db.save();
    return real;
  }
  if (off.system && !same(off) && !Object.values(D.users).some((u) => u !== off && same(u))) {
    off.previousNames = [off.username, ...(off.previousNames || [])].slice(0, 10);
    off.username = OWNER_NAME;
    db.save();
  }
  return off;
}

// Adds catalog items this world doesn't have yet (new items in updates).
export function addCatalogItems(db) {
  const D = db.data;
  const owner = officialAccount(D);
  const have = new Set(Object.values(D.items).filter((i) => !i.custom).map((i) => i.name));
  let added = 0;
  for (const it of CATALOG) {
    if (have.has(it.name)) continue;
    const id = db.nextId('item');
    D.items[id] = {
      id, name: it.name, type: it.type, price: it.price, data: it.data, description: it.desc,
      creatorId: owner ? owner.id : 1, created: Date.now(), sales: 0,
      limited: !!it.limited, remaining: it.limited ? 100 : null,
    };
    added++;
  }
  if (added) db.save();
  return added;
}

// A quick fingerprint of a place file, to notice when someone edited it.
function placeHash(place) {
  const str = JSON.stringify(place);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ':' + str.length;
}

// A showcase game's other places (DOORS' hotel...): made if missing, and
// updated like the game itself unless someone edited them in Studio.
function syncSubPlaces(db, game, sg, now) {
  const D = db.data;
  if (!sg.subPlaces) return;
  if (!D.places) D.places = {};
  if ((D.meta.nextIds.place || 0) < 100001) D.meta.nextIds.place = 100001;
  for (const sp of sg.subPlaces) {
    const p = Object.values(D.places).find((x) => x.gameId === game.id && x.seedKey === sp.key);
    if (!p) {
      const id = db.nextId('place');
      const place = sp.build();
      db.writePlace(id, place);
      D.places[id] = { id, gameId: game.id, name: sp.name, created: now, updated: now, seedKey: sp.key, seedHash: placeHash(place) };
      continue;
    }
    const current = db.readPlace(p.id);
    if (current && p.seedHash && placeHash(current) !== p.seedHash) continue; // edited in Studio
    const fresh = sp.build();
    const h = placeHash(fresh);
    if (!current || h !== placeHash(current)) { db.writePlace(p.id, fresh); p.updated = now; }
    p.seedHash = h;
  }
}

// Adds showcase games this world doesn't have yet (so older worlds get new
// places too), and updates the ones nobody has edited to the newest version.
// Returns how many were added.
export function addSeedGames(db) {
  const D = db.data;
  const robis = officialAccount(D);
  if (!robis) return 0;
  const done = new Set(D.meta.seedKeys || []);
  const now = Date.now();
  let added = 0;
  const all = [...SEED_GAMES.map((g, i) => ({
    ...g,
    visits: [48213, 125903, 8721, 67390, 3321][i], up: [912, 2210, 144, 1398, 67][i], down: [48, 190, 21, 120, 9][i],
    favorites: [3002, 9120, 311, 5120, 82][i], copyable: g.key !== 'obby', age: 40 - i * 7,
  })), ...MORE_GAMES.map((g) => ({ ...g, copyable: true, age: 3 })), ...TEAM_GAMES.map((g) => ({ ...g, copyable: true, age: 1 })), ...NOSTALGIA_GAMES.map((g) => ({ ...g, copyable: true, age: 0 })), ...NEW_GAMES.map((g) => ({ ...g, copyable: true, age: 0 }))];
  for (const sg of all) {
    const existing = Object.values(D.games).find((g) => g.seedKey === sg.key)
      || Object.values(D.games).find((g) => g.creatorId === robis.id && g.name === sg.name && !g.seedKey);
    if (existing) {
      // Update the showcase game to the newest version, unless someone edited it in Studio.
      existing.seedKey = sg.key;
      const current = db.readPlace(existing.id);
      if (current && (!existing.seedHash || placeHash(current) === existing.seedHash)) {
        const fresh = sg.build();
        const h = placeHash(fresh);
        if (h !== placeHash(current)) { db.writePlace(existing.id, fresh); existing.updated = now; }
        existing.seedHash = h;
        syncSubPlaces(db, existing, sg, now);
      }
      done.add(sg.key);
      continue;
    }
    if (done.has(sg.key)) continue; // the owner deleted it on purpose
    done.add(sg.key);
    const id = db.nextId('game');
    const place = sg.build();
    db.writePlace(id, place);
    D.games[id] = {
      id, name: sg.name, description: sg.description, creatorId: robis.id, genre: sg.genre,
      created: now - sg.age * 86400e3, updated: now - 3600e3,
      visits: sg.visits || 0, maxPlayers: sg.maxPlayers, isPublic: true, featured: sg.featured, copyable: sg.copyable,
      upVotes: sg.up || 0, downVotes: sg.down || 0, favorites: sg.favorites || 0,
      seedKey: sg.key, seedHash: placeHash(place),
    };
    syncSubPlaces(db, D.games[id], sg, now);
    added++;
  }
  D.meta.seedKeys = [...done];
  db.save();
  return added;
}
