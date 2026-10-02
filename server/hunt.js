// The Hunt event: a hub game with portals, a golden token hidden in every game
// of the event (official games plus the most popular player games), prizes for
// half and for all tokens. While it's private only admins (and the main
// account) can see the event page, play the hub and collect tokens.
//
// D.hunt = { public, games: [official game ids], autoPlayers, progress: { userId: [gameIds] },
//            hubId, hubKey, rewards: { half: itemId, all: itemId }, rewarded: { userId: ['half','all'] } }
import { buildHuntHub } from './seed/hunt.js';
import { officialAccount } from './seed/seed.js';

// Prize ladder: count = a number of tokens, share = a part of all tokens.
const REWARDS = {
  tee: { count: 1, name: 'The Hunt Tee', type: 'TShirt', data: { graphic: 'star' }, description: 'A prize from The Hunt: find your first token.' },
  cap: { count: 3, name: "Hunter's Cap", type: 'Hat', data: { model: 'cap', color: '#2b2340', accent: '#ffc400' }, description: 'A prize from The Hunt: find 3 tokens.' },
  shades: { count: 5, name: 'Golden Hunt Shades', type: 'Hat', data: { model: 'shades', color: '#ffc400', accent: '#b37f00' }, description: 'A prize from The Hunt: find 5 tokens.' },
  kitty: { count: 8, name: 'Golden Hunt Kitty', type: 'Pet', data: { model: 'cat', color: '#ffc400', accent: '#2b2340' }, description: 'A prize from The Hunt: find 8 tokens.' },
  half: { share: 0.5, name: 'Hunt Dragon', type: 'Pet', data: { model: 'dragon', color: '#1b1b1b', accent: '#ffc400' }, description: 'A prize from The Hunt: find half of the tokens.' },
  wings: { share: 0.75, name: "Hunter's Golden Wings", type: 'Hat', data: { model: 'wings', color: '#ffc400', accent: '#fff3b0' }, description: 'A prize from The Hunt: find three quarters of the tokens.' },
  sword: { share: 0.9, name: 'Golden Hunt Sword', type: 'Gear', data: { model: 'sword', color: '#ffc400' }, description: 'A prize from The Hunt: find almost every token.' },
  all: { share: 1, name: "Hunter's Golden Crown", type: 'Hat', data: { model: 'crown', color: '#ffc400', accent: '#e8002a' }, description: 'The grand prize of The Hunt: find every token.' },
};
const ROBITS_PER_TOKEN = 25;
// tokens needed for a prize when the event has `total` tokens
const needFor = (key, total) => {
  const r = REWARDS[key];
  return Math.max(1, Math.min(total, r.count || Math.ceil(total * r.share)));
};

export function installHunt(api, { db, manager, requireUser, requireAdmin, bad, log, giveSerial }) {
  const D = db.data;
  if (!D.hunt) D.hunt = {};
  const H = D.hunt;
  H.progress = H.progress || {};
  H.rewarded = H.rewarded || {};
  const official = () => officialAccount(D);
  // Version 2 (the release): every official game, 8 player games, open for everyone.
  if ((H.version || 0) < 2) {
    const off = official();
    const allOfficial = Object.values(D.games).filter((g) => off && g.creatorId === off.id && g.isPublic && !g.huntHub).map((g) => g.id);
    H.games = [...new Set([...(H.games || []), ...allOfficial])];
    H.autoPlayers = Math.max(H.autoPlayers || 0, 8);
    H.public = true;
    H.version = 2;
  }

  // Prize items: not for sale, only given by the event.
  H.rewards = H.rewards || {};
  for (const [k, r] of Object.entries(REWARDS)) {
    if (H.rewards[k] && D.items[H.rewards[k]]) continue;
    const id = db.nextId('item');
    D.items[id] = { id, name: r.name, type: r.type, price: 0, data: r.data, description: r.description, creatorId: official()?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false };
    H.rewards[k] = id;
  }
  // prizes in ladder order
  const prizeKeys = () => Object.keys(REWARDS).filter((k) => D.items[H.rewards[k]]);
  const prizeList = (total) => prizeKeys().map((k) => ({ key: k, id: H.rewards[k], name: D.items[H.rewards[k]].name, need: needFor(k, total) }));
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
    const rewards = [];
    for (const k of prizeKeys()) if (p.count >= needFor(k, p.total)) { const r = giveReward(uid, k); if (r) rewards.push(r); }
    const reward = rewards.length ? { name: rewards.map((r) => r.name).join(', '), items: rewards } : null;
    const u = D.users[uid];
    if (u) { u.robits += ROBITS_PER_TOKEN; log(uid, ROBITS_PER_TOKEN, `The Hunt token (${p.count}/${p.total})`); }
    db.save();
    return { new: true, count: p.count, total: p.total, reward, robits: ROBITS_PER_TOKEN };
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
    const prizes = prizeList(games.length);
    const key = JSON.stringify([3, games.map((g) => [g.id, g.name, g.creator]), prizes.map((p) => [p.name, p.need])]);
    if (!hub) {
      const id = db.nextId('game');
      hub = D.games[id] = {
        id, name: 'The Hunt', description: 'The Hunt is here! Step through the portals, find the golden token hidden in every game, get Robits for every token and win 8 prizes, up to the Hunter\'s Golden Crown.',
        creatorId: off.id, genre: 'Adventure', created: Date.now(), updated: Date.now(), visits: 0, maxPlayers: 20,
        isPublic: !!H.public, featured: false, copyable: false, upVotes: 0, downVotes: 0, favorites: 0, huntHub: true,
      };
      H.hubId = id;
      H.hubKey = '';
    }
    hub.isPublic = !!H.public;
    hub.featured = !!H.public;
    if (H.hubKey !== key || !db.readPlace(hub.id)) {
      db.writePlace(hub.id, buildHuntHub(games, prizes));
      hub.updated = Date.now();
      H.hubKey = key;
      // empty hub servers restart with the new portals
      for (const srv of manager.serversFor(hub.id)) if (!srv.playerCount) srv.close();
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
      robitsPerToken: ROBITS_PER_TOKEN,
      rewards: prizeList(p.total).map((r) => ({ ...r, type: D.items[r.id].type, data: D.items[r.id].data, got: !!u && (H.rewarded[u.id] || []).includes(r.key) })),
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
