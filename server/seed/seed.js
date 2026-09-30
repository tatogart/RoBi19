// Fills an empty database with the Robis account, the catalog and showcase games.
import { hashPassword } from '../auth.js';
import { CATALOG } from '../../shared/avatar.js';
import { SEED_GAMES } from './places.js';

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

  for (const [i, sg] of SEED_GAMES.entries()) {
    const id = db.nextId('game');
    const place = sg.build();
    db.writePlace(id, place);
    const creatorId = robis.id;
    db.data.games[id] = {
      id, name: sg.name, description: sg.description, creatorId, genre: sg.genre,
      created: now - (40 - i * 7) * 86400e3, updated: now - i * 3600e3,
      visits: [48213, 125903, 8721, 67390, 3321][i] || 0,
      maxPlayers: sg.maxPlayers, isPublic: true, featured: sg.featured, copyable: i !== 1,
      upVotes: [912, 2210, 144, 1398, 67][i] || 0, downVotes: [48, 190, 21, 120, 9][i] || 0,
      favorites: [3002, 9120, 311, 5120, 82][i] || 0,
    };
  }
  db.flush();
  console.log('[seed] done. Open the site and sign up — the first account you create becomes the admin (with ROBIS_ADMIN_CODE set: whoever enters that code).');
}
