// Fills an empty database with the Robis account, the catalog and showcase games.
import crypto from 'node:crypto';
import { hashPassword } from '../auth.js';
import { CATALOG } from '../../shared/avatar.js';
import { SEED_GAMES } from './places.js';

export const STARTER_ITEMS = ['Bacon Hair', 'Smile', 'Blue Hoodie', 'Jeans', 'Robis Logo T-Shirt', 'Classic Robis Cap', 'Pal Hair', 'Man Face', 'Woman Face'];
export const STARTER_WEARING = ['Bacon Hair', 'Smile', 'Blue Hoodie', 'Jeans'];
export const STARTER_BODY = { head: '#eab892', torso: '#eab892', leftArm: '#eab892', rightArm: '#eab892', leftLeg: '#eab892', rightLeg: '#eab892' };

export function createUser(db, username, password, extra = {}) {
  const id = db.nextId('user');
  const { salt, hash } = hashPassword(password);
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
  // The admin password is never stored in the code: take it from the environment
  // or generate a random one and show it once in the console.
  const adminPassword = process.env.ROBIS_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const robis = createUser(db, 'Robis', adminPassword, {
    isAdmin: true, robits: 1_000_000, membership: 'OutrageousBuildersClub',
    blurb: 'Welcome to Robis! We are a user-generated gaming platform where you can play and build games. Powered by imagination since 2019.',
    status: 'Building the future, one brick at a time.',
  });
  // Robis owns everything
  db.data.inventory[robis.id] = Object.keys(db.data.items).map(Number);
  const find = (n) => Object.values(db.data.items).find((i) => i.name === n).id;
  robis.avatar = {
    bodyColors: { head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b' },
    wearing: [find('Dominator of Robis'), find('Epic Face'), find('Black Suit'), find('Suit Pants')],
  };
  const bots = [
    ['Builderman2019', 'Robis Studio is my home.', ['Stylish Top Hat', 'Smile', 'Builders Club Shirt', 'Black Pants']],
    ['OofMaster', 'oof oof oof', ['Traffic Cone', 'Epic Face', 'Red Plaid Shirt', 'Jeans']],
    ['NoobSlayer99', 'I beat every obby', ['Golden Crown', 'Chill', 'Green Camo Jacket', 'Camo Pants']],
    ['PinkPrincess', 'Lava Rising champion!!', ['Long Pink Hair', 'Woman Face', 'Striped Tee', 'Khakis', 'Party Hat']],
  ];
  for (const [name, blurb, wear] of bots) {
    const u = createUser(db, name, 'password123', { blurb, status: blurb, robits: 500 });
    const ids = wear.map(find);
    db.data.inventory[u.id] = [...new Set([...db.data.inventory[u.id], ...ids])];
    u.avatar.wearing = ids;
    if (name === 'OofMaster') u.avatar.bodyColors = { head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b' };
    // Everyone is friends with Robis
    db.data.friends[u.id].push(robis.id);
    db.data.friends[robis.id].push(u.id);
  }

  for (const [i, sg] of SEED_GAMES.entries()) {
    const id = db.nextId('game');
    const place = sg.build();
    db.writePlace(id, place);
    const creatorId = i === 2 ? 3 : i === 4 ? 4 : robis.id;
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
  console.log('[seed] done.');
  if (!process.env.ROBIS_ADMIN_PASSWORD) {
    console.log(`\n  Admin account created:  Robis / ${adminPassword}`);
    console.log('  Save this password now — it is shown only once. Reset it any time with: npm run admin-password\n');
  }
}
