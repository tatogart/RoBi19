// The Hunt event: a hub game with portals, a golden token hidden in every game
// of the event (official games plus the most popular player games), prizes for
// half and for all tokens. While it's private only admins (and the main
// account) can see the event page, play the hub and collect tokens.
//
// D.hunt = { public, games: [official game ids], autoPlayers, progress: { userId: [gameIds] },
//            hubId, hubKey, rewards: { half: itemId, all: itemId }, rewarded: { userId: ['half','all'] } }
import { buildHuntHub } from './seed/hunt.js';
import { officialAccount } from './seed/seed.js';

// The Hunt: Another Dimension (part 2). Part 1 (the golden tokens) is over:
// its progress is kept in D.hunt.past and its prizes stay in inventories.
export const HUNT_NAME = 'The Hunt: Another Dimension';
// Prize ladder: count = a number of shards, share = a part of all shards.
const REWARDS = {
  dtee: { count: 1, name: 'Dimension Explorer Tee', type: 'TShirt', data: { graphic: 'star' }, description: 'The Hunt: Another Dimension - find your first shard.' },
  helmet: { count: 3, name: 'Astronaut Helmet', type: 'Hat', data: { model: 'astronaut', color: '#f2f2f2', accent: '#9fe8ff' }, description: 'The Hunt: Another Dimension - find 3 shards.' },
  alien: { count: 6, name: 'Zib the Alien', type: 'Pet', data: { model: 'alien', color: '#5bd65b', accent: '#ff66cc' }, description: 'The Hunt: Another Dimension - find 6 shards.' },
  planet: { count: 9, name: 'Pocket Planet', type: 'Hat', data: { model: 'planet', color: '#a347ff', accent: '#ffd27a' }, description: 'The Hunt: Another Dimension - find 9 shards.' },
  ufo: { share: 0.5, name: 'Mini UFO', type: 'Pet', data: { model: 'ufo', color: '#b8c4d6', accent: '#7dffb0' }, description: 'The Hunt: Another Dimension - find half of the shards.' },
  saber: { share: 0.75, name: 'Dimension Saber', type: 'Gear', data: { model: 'saber', color: '#b45cff' }, description: 'The Hunt: Another Dimension - find 75% of the shards.' },
  nwings: { share: 0.9, name: 'Nebula Wings', type: 'Hat', data: { model: 'wings', color: '#5a2bd6', accent: '#00e5ff' }, description: 'The Hunt: Another Dimension - find 90% of the shards.' },
  cosmos: { share: 1, name: 'Crown of the Cosmos', type: 'Hat', data: { model: 'crown', color: '#9fe8ff', accent: '#b45cff' }, description: 'The grand prize of The Hunt: Another Dimension - find every shard.' },
};
// Extra prizes that aren't on the ladder.
const BONUS = {
  stardust: { how: 'Collect all 6 star fragments in the hub', name: 'Stardust Halo', type: 'Hat', data: { model: 'halo', color: '#7df9ff' }, description: 'The Hunt: Another Dimension - collect every star fragment in the hub.' },
  rift: { how: 'Everyone together opens the Rift (find at least 1 shard)', name: 'Rift Walker Planet', type: 'Hat', data: { model: 'planet', color: '#ff4d8d', accent: '#7df9ff' }, description: 'The Hunt: Another Dimension - the players opened the Rift together.' },
};
const ALL_PRIZES = { ...REWARDS, ...BONUS };
const FRAGMENTS = 6;
const ROBITS_PER_TOKEN = 20;
const HUB_DESCRIPTION = 'Part 2 of The Hunt! A rift to another dimension has opened. Jump through the wormholes, follow your scanner to the dimension shard hidden in every game, collect star fragments in the low-gravity hub and open the Rift together with everyone. 10 prizes, up to the Crown of the Cosmos.';
// Default shards everyone must find together to open the Rift (admins can change it).
const RIFT_GOAL = 50;
// Games that are never in the event (nothing to hunt in a house).
const EXCLUDED_KEYS = ['happyhome'];
// shards needed for a prize when the event has `total` shards
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
  // Version 3: part 2 starts. Part 1's tokens and prizes are put away.
  if (H.version < 3) {
    H.past = [...(H.past || []), { name: 'The Hunt', progress: H.progress, rewarded: H.rewarded, rewards: H.rewards }];
    H.progress = {};
    H.rewarded = {};
    H.rewards = {};
    H.fragments = {};
    H.riftOpen = false;
    H.hubKey = '';
    H.version = 3;
  }
  H.fragments = H.fragments || {};
  // 300 was out of reach for a small server: a round number players can get to
  if (!H.riftGoal || H.riftGoal === 300) H.riftGoal = RIFT_GOAL;
  const riftGoal = () => H.riftGoal || RIFT_GOAL;

  // Prize items: not for sale, only given by the event.
  H.rewards = H.rewards || {};
  for (const [k, r] of Object.entries(ALL_PRIZES)) {
    if (H.rewards[k] && D.items[H.rewards[k]]) continue;
    const id = db.nextId('item');
    D.items[id] = { id, name: r.name, type: r.type, price: 0, data: r.data, description: r.description, creatorId: official()?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false };
    H.rewards[k] = id;
  }
  // prizes in ladder order
  const prizeKeys = () => Object.keys(REWARDS).filter((k) => D.items[H.rewards[k]]);
  const prizeList = (total) => [
    ...prizeKeys().map((k) => ({ key: k, id: H.rewards[k], name: D.items[H.rewards[k]].name, need: needFor(k, total) })),
    ...Object.keys(BONUS).filter((k) => D.items[H.rewards[k]]).map((k) => ({ key: k, id: H.rewards[k], name: D.items[H.rewards[k]].name, how: BONUS[k].how, bonus: true })),
  ];
  // Shards found by everyone together; at RIFT_GOAL the Rift opens for all finders.
  const globalShards = () => Object.values(H.progress).reduce((n, l) => n + l.length, 0);
  const riftCheck = (uid) => {
    if (!H.riftOpen && globalShards() >= riftGoal()) H.riftOpen = true;
    if (H.riftOpen && uid && (H.progress[uid] || []).length) return giveReward(uid, 'rift');
    return null;
  };
  const eligible = (uid) => {
    if (H.public) return true;
    const u = D.users[uid];
    return !!u && (u.isAdmin || u.id === official()?.id);
  };
  // The games in the event: the chosen official games + the most popular player games.
  const excluded = (g) => EXCLUDED_KEYS.includes(g.seedKey);
  const eventGames = () => {
    const off = official();
    const picked = H.games.map((id) => D.games[id]).filter((g) => g && g.id !== H.hubId && !excluded(g));
    const players = Object.values(D.games)
      .filter((g) => g.isPublic && g.id !== H.hubId && !excluded(g) && (!off || g.creatorId !== off.id) && !picked.includes(g) && !D.users[g.creatorId]?.system)
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
  // force: given by an admin (works while the event is private too)
  const collect = (uid, gameId, force = false) => {
    if (!force && !eligible(uid)) return null;
    const games = eventGames();
    if (!games.some((g) => g.id === gameId)) return null;
    const have = H.progress[uid] || (H.progress[uid] = []);
    if (have.includes(gameId)) return { new: false };
    have.push(gameId);
    const p = progress(uid);
    const rewards = [];
    for (const k of prizeKeys()) if (p.count >= needFor(k, p.total)) { const r = giveReward(uid, k); if (r) rewards.push(r); }
    const rift = riftCheck(uid);
    if (rift) rewards.push(rift);
    const reward = rewards.length ? { name: rewards.map((r) => r.name).join(', '), items: rewards } : null;
    const u = D.users[uid];
    if (u) { u.robits += ROBITS_PER_TOKEN; log(uid, ROBITS_PER_TOKEN, force ? `The Hunt token from the admins (${p.count}/${p.total})` : `The Hunt token (${p.count}/${p.total})`); }
    db.save();
    return { new: true, count: p.count, total: p.total, reward, robits: ROBITS_PER_TOKEN };
  };
  // Star fragments: a little quest in the hub. n = 0 only asks.
  const fragment = (uid, n, gameId) => {
    if (!eligible(uid) || gameId !== H.hubId) return null;
    const have = H.fragments[uid] || (H.fragments[uid] = []);
    let isNew = false, prize = null;
    if (n >= 1 && n <= FRAGMENTS && !have.includes(n)) {
      have.push(n);
      isNew = true;
      if (have.length >= FRAGMENTS) prize = giveReward(uid, 'stardust');
      db.save();
    }
    return { new: isNew, count: have.length, total: FRAGMENTS, list: [...have], prize: prize ? prize.name : '' };
  };
  manager.hunt = {
    eligible,
    inEvent: (gameId) => eventGames().some((g) => g.id === gameId),
    collect,
    fragment,
    global: () => ({ Shards: globalShards(), Goal: riftGoal(), Open: !!H.riftOpen }),
    progress: (uid) => {
      if (!eligible(uid)) return null;
      if (riftCheck(uid)) db.save(); // the Rift opened since this player's last shard
      return progress(uid);
    },
  };

  // The hub game (owned by the main account), rebuilt when the list changes.
  const syncHub = () => {
    const off = official();
    if (!off) return null;
    let hub = D.games[H.hubId];
    const games = eventGames();
    const prizes = prizeList(games.length);
    const key = JSON.stringify([7, games.map((g) => [g.id, g.name, g.creator]), prizes.map((p) => [p.name, p.need])]);
    if (!hub) {
      const id = db.nextId('game');
      hub = D.games[id] = {
        id, name: HUNT_NAME, description: HUB_DESCRIPTION,
        creatorId: off.id, genre: 'Adventure', created: Date.now(), updated: Date.now(), visits: 0, maxPlayers: 20,
        isPublic: !!H.public, featured: false, copyable: false, upVotes: 0, downVotes: 0, favorites: 0, huntHub: true,
      };
      H.hubId = id;
      H.hubKey = '';
    }
    hub.name = HUNT_NAME;
    hub.description = HUB_DESCRIPTION;
    hub.isPublic = !!H.public;
    hub.featured = !!H.public;
    if (H.hubKey !== key || !db.readPlace(hub.id)) {
      db.writePlace(hub.id, buildHuntHub(games, prizes, { fragments: FRAGMENTS, goal: riftGoal() }));
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
    if (u && riftCheck(u.id)) db.save();
    const p = u ? progress(u.id) : { games: eventGames().map((g) => ({ ...g, found: false })), count: 0, total: eventGames().length };
    return {
      name: HUNT_NAME, public: !!H.public, hubId: syncHub()?.id || null, ...p,
      robitsPerToken: ROBITS_PER_TOKEN,
      rift: { shards: globalShards(), goal: riftGoal(), open: !!H.riftOpen },
      fragments: { count: u ? (H.fragments[u.id] || []).length : 0, total: FRAGMENTS },
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
      riftGoal: riftGoal(), riftShards: globalShards(), riftOpen: !!H.riftOpen,
      official: Object.values(D.games).filter((g) => off && g.creatorId === off.id && g.id !== H.hubId && g.isPublic && !excluded(g)).map((g) => ({ id: g.id, name: g.name, visits: g.visits })),
      event: eventGames(),
      finders: Object.values(H.progress).filter((l) => l.length).length,
    });
  });
  // Admin: one player's tokens. Give or take a game's token, give all, take all.
  const findUser = (q) => {
    const s = String(q || '').trim().toLowerCase();
    return Object.values(D.users).find((u) => !u.system && (String(u.id) === s || u.username.toLowerCase() === s));
  };
  const playerTokens = (u) => ({ user: { id: u.id, username: u.username }, ...progress(u.id), prizes: H.rewarded[u.id] || [] });
  api.get('/admin/hunt/player', requireAdmin, (req, res) => {
    const u = findUser(req.query.user);
    if (!u) return bad(res, 'No player with that name.', 404);
    res.json(playerTokens(u));
  });
  // { user, gameId | all: true, take: bool }
  api.post('/admin/hunt/tokens', requireAdmin, (req, res) => {
    const b = req.body || {};
    const u = findUser(b.user);
    if (!u) return bad(res, 'No player with that name.', 404);
    const games = eventGames();
    const ids = b.all ? games.map((g) => g.id) : [+b.gameId].filter((id) => games.some((g) => g.id === id));
    if (!ids.length) return bad(res, 'That game is not in The Hunt.');
    const prizes = [];
    if (b.take) {
      // tokens go away; prizes already won are kept
      H.progress[u.id] = (H.progress[u.id] || []).filter((id) => !ids.includes(id));
    } else {
      for (const id of ids) { const r = collect(u.id, id, true); if (r?.reward) prizes.push(...r.reward.items); }
    }
    log(u.id, 0, `The Hunt: ${b.take ? 'took' : 'gave'} ${b.all ? 'all tokens' : '1 token'} (${req.user.username})`);
    db.save();
    res.json({ ...playerTokens(u), newPrizes: prizes });
  });

  api.post('/admin/hunt', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.public !== undefined) H.public = !!b.public;
    if (Array.isArray(b.games)) H.games = [...new Set(b.games.map((x) => +x))].filter((id) => D.games[id] && id !== H.hubId).slice(0, 30);
    if (b.riftGoal !== undefined) {
      const n = Math.trunc(+b.riftGoal || 0);
      if (n < 1 || n > 100000) return bad(res, 'Rift goal: between 1 and 100,000 shards.');
      H.riftGoal = n;
      H.riftOpen = globalShards() >= n;
    }
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
