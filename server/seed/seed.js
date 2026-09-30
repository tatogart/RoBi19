// Fills an empty database with the Robis account, the catalog and showcase games.
import { hashPassword } from '../auth.js';
import { CATALOG } from '../../shared/avatar.js';
import { SEED_GAMES } from './places.js';
import { MORE_GAMES } from './places2.js';
import { TEAM_GAMES } from './places3.js';
import { NOSTALGIA_GAMES } from './places4.js';

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
    blurb: 'Welcome to Robis! This is the official account that made the catalog and the first games. Create your own account and start building!',
    status: 'Building the future, one brick at a time.',
  });
  db.data.inventory[robis.id] = Object.keys(db.data.items).map(Number);
  const find = (n) => Object.values(db.data.items).find((i) => i.name === n).id;
  robis.avatar = {
    bodyColors: { head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b' },
    wearing: [find('Dominator of Robis'), find('Epic Face'), find('Black Suit'), find('Suit Pants')],
  };

  addSeedGames(db);
  db.flush();
  console.log('[seed] done. Open the site and sign up — the first account you create becomes the admin (with ROBIS_ADMIN_CODE set: whoever enters that code).');
}

// Adds showcase games this world doesn't have yet (so older worlds get new
// places too). Returns how many were added.
export function addSeedGames(db) {
  const D = db.data;
  const robis = Object.values(D.users).find((u) => u.system && u.username === 'Robis');
  if (!robis) return 0;
  const done = new Set(D.meta.seedKeys || []);
  const now = Date.now();
  let added = 0;
  const all = [...SEED_GAMES.map((g, i) => ({
    ...g,
    visits: [48213, 125903, 8721, 67390, 3321][i], up: [912, 2210, 144, 1398, 67][i], down: [48, 190, 21, 120, 9][i],
    favorites: [3002, 9120, 311, 5120, 82][i], copyable: g.key !== 'obby', age: 40 - i * 7,
  })), ...MORE_GAMES.map((g) => ({ ...g, copyable: true, age: 3 })), ...TEAM_GAMES.map((g) => ({ ...g, copyable: true, age: 1 })), ...NOSTALGIA_GAMES.map((g) => ({ ...g, copyable: true, age: 0 }))];
  for (const sg of all) {
    if (done.has(sg.key)) continue;
    done.add(sg.key);
    // Worlds from before seedKeys existed already have the first five.
    if (Object.values(D.games).some((g) => g.creatorId === robis.id && g.name === sg.name)) continue;
    const id = db.nextId('game');
    db.writePlace(id, sg.build());
    D.games[id] = {
      id, name: sg.name, description: sg.description, creatorId: robis.id, genre: sg.genre,
      created: now - sg.age * 86400e3, updated: now - 3600e3,
      visits: sg.visits || 0, maxPlayers: sg.maxPlayers, isPublic: true, featured: sg.featured, copyable: sg.copyable,
      upVotes: sg.up || 0, downVotes: sg.down || 0, favorites: sg.favorites || 0,
    };
    added++;
  }
  D.meta.seedKeys = [...done];
  db.save();
  return added;
}
