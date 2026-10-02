// The Hunt event: a hub game with portals, a golden token hidden in every game
// of the event (official games plus the most popular player games), prizes for
// half and for all tokens. While it's private only admins (and the main
// account) can see the event page, play the hub and collect tokens.
//
// D.hunt = { public, games: [official game ids], autoPlayers, progress: { userId: [gameIds] },
//            hubId, hubKey, rewards: { half: itemId, all: itemId }, rewarded: { userId: ['half','all'] } }
import { buildHuntHub } from './seed/hunt.js';
import { officialAccount } from './seed/seed.js';

const DEFAULT_KEYS = ['doors', 'kart', 'brickbattle', 'speeddraw', 'obby', 'disaster', 'tower', 'lava'];
const REWARDS = {
  half: { name: 'Hunt Dragon', type: 'Pet', data: { model: 'dragon', color: '#1b1b1b', accent: '#ffc400' }, description: 'A prize from The Hunt: find half of the tokens.' },
  all: { name: "Hunter's Golden Crown", type: 'Hat', data: { model: 'crown', color: '#ffc400', accent: '#e8002a' }, description: 'The grand prize of The Hunt: find every token.' },
};

export function installHunt(api, { db, manager, requireUser, requireAdmin, bad, log, giveSerial }) {
  const D = db.data;
  if (!D.hunt) D.hunt = {};
  const H = D.hunt;
  H.progress = H.progress || {};
  H.rewarded = H.rewarded || {};
  if (H.autoPlayers === undefined) H.autoPlayers = 5;
  const official = () => officialAccount(D);
  if (!H.games) {
    // Start with the best official games.
    const off = official();
    H.games = DEFAULT_KEYS.map((k) => Object.values(D.games).find((g) => g.seedKey === k && (!off || g.creatorId === off.id))).filter(Boolean).map((g) => g.id);
  }

  // Prize items: not for sale, only given by the event.
  H.rewards = H.rewards || {};
  for (const [k, r] of Object.entries(REWARDS)) {
    if (H.rewards[k] && D.items[H.rewards[k]]) continue;
    const id = db.nextId('item');
    D.items[id] = { id, name: r.name, type: r.type, price: 0, data: r.data, description: r.description, creatorId: official()?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false };
    H.rewards[k] = id;
  }

  const eligible = (uid) => {
    if (H.public) return true;
    const u = D.users[uid];
    return !!u && (u.isAdmin || u.id === official()?.id);
  };
  // The games in the event: the chosen official games + the most popular player games.
  const eventGames = () => {
    const off = official();
    const picked = H.games.map((id) => D.games[id]).filter((g) => g && g.id !== H.hubId);
    const players = Object.values(D.games)
      .filter((g) => g.isPublic && g.id !== H.hubId && (!off || g.creatorId !== off.id) && !picked.includes(g) && !D.users[g.creatorId]?.system)
      .sort((a, b) => (b.visits || 0) - (a.visits || 0) || b.upVotes - a.upVotes)
      .slice(0, Math.max(0, H.autoPlayers | 0));
    return [...picked.map((g) => ({ g, byPlayer: false })), ...players.map((g) => ({ g, byPlayer: true }))].map(({ g, byPlayer }) => ({
      id: g.id, name: g.name, byPlayer, creator: D.users[g.creatorId]?.username || '?',
    }));
  };
  const progress = (uid) => {
    const games = eventGames();
    const have = H.progress[uid] || [];
    const list = games.map((g) => ({ ...g, found: have.includes(g.id) }));
    const count = list.filter((g) => g.found).length;
    return { games: list, count, total: list.length };
  };
  const giveReward = (uid, key) => {
    const got = H.rewarded[uid] || (H.rewarded[uid] = []);
    if (got.includes(key)) return null;
    got.push(key);
    const it = D.items[H.rewards[key]];
    if (!it) return null;
    const inv = D.inventory[uid] || (D.inventory[uid] = []);
    if (!inv.includes(it.id)) { inv.push(it.id); giveSerial(it, uid); }
    log(uid, 0, `The Hunt prize: ${it.name}`);
    return { id: it.id, name: it.name };
  };
  const collect = (uid, gameId) => {
    if (!eligible(uid)) return null;
    const games = eventGames();
    if (!games.some((g) => g.id === gameId)) return null;
    const have = H.progress[uid] || (H.progress[uid] = []);
    if (have.includes(gameId)) return { new: false };
    have.push(gameId);
    const p = progress(uid);
    let reward = null;
    if (p.count >= Math.ceil(p.total / 2)) reward = giveReward(uid, 'half') || reward;
    if (p.count >= p.total) reward = giveReward(uid, 'all') || reward;
    db.save();
    return { new: true, count: p.count, total: p.total, reward };
  };
  manager.hunt = {
    eligible,
    inEvent: (gameId) => eventGames().some((g) => g.id === gameId),
    collect,
    progress: (uid) => (eligible(uid) ? progress(uid) : null),
  };

  // The hub game (owned by the main account), rebuilt when the list changes.
  const syncHub = () => {
    const off = official();
    if (!off) return null;
    let hub = D.games[H.hubId];
    const games = eventGames();
    const key = JSON.stringify(games.map((g) => [g.id, g.name, g.creator]));
    if (!hub) {
      const id = db.nextId('game');
      hub = D.games[id] = {
        id, name: 'The Hunt', description: 'The Hunt is here! Step through the portals, find the golden token hidden in every game and win the Hunt Dragon and the Hunter\'s Golden Crown.',
        creatorId: off.id, genre: 'Adventure', created: Date.now(), updated: Date.now(), visits: 0, maxPlayers: 20,
        isPublic: !!H.public, featured: false, copyable: false, upVotes: 0, downVotes: 0, favorites: 0, huntHub: true,
      };
      H.hubId = id;
      H.hubKey = '';
    }
    hub.isPublic = !!H.public;
    hub.featured = !!H.public;
    if (H.hubKey !== key || !db.readPlace(hub.id)) {
      db.writePlace(hub.id, buildHuntHub(games));
      hub.updated = Date.now();
      H.hubKey = key;
    }
    db.save();
    return hub;
  };
  syncHub();
  const timer = setInterval(() => { try { syncHub(); } catch { /* try again later */ } }, 10 * 60e3);
  timer.unref?.();

  const status = (u) => {
    const p = u ? progress(u.id) : { games: eventGames().map((g) => ({ ...g, found: false })), count: 0, total: eventGames().length };
    return {
      public: !!H.public, hubId: syncHub()?.id || null, ...p,
      rewards: Object.entries(H.rewards).map(([k, id]) => ({ key: k, id, name: D.items[id]?.name, type: D.items[id]?.type, data: D.items[id]?.data, need: k === 'half' ? Math.ceil(p.total / 2) : p.total, got: !!u && (H.rewarded[u.id] || []).includes(k) })),
    };
  };
  api.get('/hunt', (req, res) => {
    if (!req.user || !eligible(req.user.id)) return res.json({ visible: false });
    res.json({ visible: true, ...status(req.user) });
  });

  // Admin: open it to everyone, pick the official games, how many player games join.
  api.get('/admin/hunt', requireAdmin, (req, res) => {
    const off = official();
    res.json({
      public: !!H.public, autoPlayers: H.autoPlayers, games: H.games, hubId: H.hubId,
      official: Object.values(D.games).filter((g) => off && g.creatorId === off.id && g.id !== H.hubId && g.isPublic).map((g) => ({ id: g.id, name: g.name, visits: g.visits })),
      event: eventGames(),
      finders: Object.values(H.progress).filter((l) => l.length).length,
    });
  });
  api.post('/admin/hunt', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.public !== undefined) H.public = !!b.public;
    if (Array.isArray(b.games)) H.games = [...new Set(b.games.map((x) => +x))].filter((id) => D.games[id] && id !== H.hubId).slice(0, 30);
    if (b.autoPlayers !== undefined) {
      const n = Math.trunc(+b.autoPlayers || 0);
      if (n < 0 || n > 20) return bad(res, 'Player games: between 0 and 20.');
      H.autoPlayers = n;
    }
    syncHub();
    db.save();
    res.json({ ok: true, event: eventGames(), public: !!H.public });
  });
  void requireUser;
}
