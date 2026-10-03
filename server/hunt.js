// The Hunt: Robis' big events. The admins run them from Admin Panel -> The Hunt:
// launch one of the prepared events, open it for everyone, end it, or schedule
// the end and the next event's start. One event is live at a time.
//
// Two kinds of events:
//   shards - something is hidden in every game of the event (Another Dimension)
//   quests - every game has its own quest, made from what you do in that game
//            (Lost Relics; see server/huntquests.js)
//
// D.hunt (state of the current event at the top level):
//   current: event key, state: 'live' | 'ended', public, endsAt, next: { key, startsAt, public }
//   games, autoPlayers, progress { userId: [gameIds] }, rewarded { userId: [prize keys] },
//   rewards { prize key: itemId }, hubId, hubKey, fragments, hubDone, riftGoal, riftOpen
//   past: [{ key, name, progress, rewarded, rewards, hubId, ended }]
import { buildHuntHub } from './seed/hunt.js';
import { buildRelicsHub } from './seed/hunt2.js';
import { buildThemedHub, HUB_THEMES } from './seed/hunt3.js';
import { officialAccount } from './seed/seed.js';
import { questFor, RUNES_TEXT } from './huntquests.js';

// ---------------------------------------------------------------- the events
// Prize ladder: count = a number of finds, share = a part of all of them.
// bonus.hub: the hub's own quest; bonus.team: everyone together reaches teamGoal.
export const EVENTS = {
  dimension: {
    name: 'The Hunt: Another Dimension', kind: 'shards', unit: 'shard', units: 'shards', robits: 20, teamGoal: 50, fragments: 6,
    description: 'Part 2 of The Hunt! A rift to another dimension has opened. Jump through the wormholes, follow your scanner to the dimension shard hidden in every game, collect star fragments in the low-gravity hub and open the Rift together with everyone. 10 prizes, up to the Crown of the Cosmos.',
    rewards: {
      dtee: { count: 1, name: 'Dimension Explorer Tee', type: 'TShirt', data: { graphic: 'star' } },
      helmet: { count: 3, name: 'Astronaut Helmet', type: 'Hat', data: { model: 'astronaut', color: '#f2f2f2', accent: '#9fe8ff' } },
      alien: { count: 6, name: 'Zib the Alien', type: 'Pet', data: { model: 'alien', color: '#5bd65b', accent: '#ff66cc' } },
      planet: { count: 9, name: 'Pocket Planet', type: 'Hat', data: { model: 'planet', color: '#a347ff', accent: '#ffd27a' } },
      ufo: { share: 0.5, name: 'Mini UFO', type: 'Pet', data: { model: 'ufo', color: '#b8c4d6', accent: '#7dffb0' } },
      saber: { share: 0.75, name: 'Dimension Saber', type: 'Gear', data: { model: 'saber', color: '#b45cff' } },
      nwings: { share: 0.9, name: 'Nebula Wings', type: 'Hat', data: { model: 'wings', color: '#5a2bd6', accent: '#00e5ff' } },
      cosmos: { share: 1, name: 'Crown of the Cosmos', type: 'Hat', data: { model: 'crown', color: '#9fe8ff', accent: '#b45cff' } },
    },
    bonus: {
      stardust: { hub: true, how: 'Collect all 6 star fragments in the hub', name: 'Stardust Halo', type: 'Hat', data: { model: 'halo', color: '#7df9ff' } },
      rift: { team: true, how: 'Everyone together opens the Rift (find at least 1 shard)', name: 'Rift Walker Planet', type: 'Hat', data: { model: 'planet', color: '#ff4d8d', accent: '#7df9ff' } },
    },
    build: (games, prizes, ev) => buildHuntHub(games, prizes, { fragments: ev.fragments }),
  },
  relics: {
    name: 'The Hunt: Lost Relics', kind: 'quests', unit: 'relic', units: 'relics', robits: 25, teamGoal: 40,
    description: 'The Hunt is back! Ancient relics are hidden behind a quest in every game: beat the obby, win a round, survive the disasters, reach Door 25... Every quest you complete gives you its relic. Solve the rune puzzle in the jungle temple and open the Great Temple together with everyone. 10 prizes, up to the Crown of Legends.',
    rewards: {
      rtee: { count: 1, name: 'Relic Hunter Tee', type: 'TShirt', data: { graphic: 'star' } },
      explorer: { count: 3, name: 'Explorer Hat', type: 'Hat', data: { model: 'explorer', color: '#c8a165', accent: '#5a3b1e' } },
      torch: { count: 5, name: 'Temple Torch', type: 'Gear', data: { model: 'torch', color: '#7a4a22' } },
      golem: { count: 8, name: 'Pebble the Golem', type: 'Pet', data: { model: 'golem', color: '#8a8f7a', accent: '#5bd6a0' } },
      jade: { share: 0.5, name: 'Jade Dragon', type: 'Pet', data: { model: 'dragon', color: '#2f8f5b', accent: '#ffd27a' } },
      sunsword: { share: 0.75, name: 'Sunstone Sword', type: 'Gear', data: { model: 'sword', color: '#ffb300' } },
      awings: { share: 0.9, name: 'Wings of the Ancients', type: 'Hat', data: { model: 'wings', color: '#c8a165', accent: '#2f8f5b' } },
      legends: { share: 1, name: 'Crown of Legends', type: 'Hat', data: { model: 'crown', color: '#ffd27a', accent: '#2f8f5b' } },
    },
    bonus: {
      runes: { hub: true, how: 'Solve the rune puzzle in the jungle temple', name: 'Rune Halo', type: 'Hat', data: { model: 'halo', color: '#5bd6a0' } },
      temple: { team: true, how: 'Everyone together opens the Great Temple (complete at least 1 quest)', name: 'Temple Guardian Helm', type: 'Hat', data: { model: 'viking', color: '#ffd27a', accent: '#2f8f5b' } },
    },
    build: (games, prizes) => buildRelicsHub(games, prizes),
  },
};
// Tomorrow's switch (Moscow time, UTC+3): Another Dimension ends at 15:00 and
// Lost Relics starts as a private preview for the admins.
const SWITCH_AT = Date.UTC(2026, 9, 3, 12, 0);
// Models a prize can use in a custom event (see public/js/render/avatar.js).
export const PRIZE_MODELS = {
  Hat: ['cap', 'cone', 'tophat', 'crown', 'viking', 'party', 'headphones', 'halo', 'dominator', 'beanie', 'pirate', 'witch', 'shades', 'wings', 'astronaut', 'planet', 'explorer'],
  Pet: ['dog', 'cat', 'bunny', 'penguin', 'robot', 'ghost', 'dragon', 'ufo', 'alien', 'golem'],
  Gear: ['sword', 'rocket', 'gun', 'flashlight', 'brush', 'hammer', 'saber', 'torch'],
  TShirt: ['star'],
};
// What an admin can set for a game's quest (see server/huntquests.js).
export const QUEST_TYPES = ['default', 'runes', 'stat', 'gain', 'below', 'badge', 'visit', 'click', 'script'];
const HEX = /^#[0-9a-f]{6}$/i;
const cleanText = (v, max = 200) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
// A quest set by an admin, checked and cleaned (null = use the game's own quest).
export function cleanQuest(q) {
  if (!q || !QUEST_TYPES.includes(q.type) || q.type === 'default') return null;
  const text = cleanText(q.text, 160);
  const target = Math.max(1, Math.min(1e9, Math.trunc(+q.target || 0)));
  const name = cleanText(q.name, 60);
  if (q.type === 'runes') return { type: 'runes', text: text || RUNES_TEXT };
  if (q.type === 'script') return { type: 'script', text: text || 'Complete the quest of this game' };
  if (!name) throw new Error('Write the name of the leaderstat, badge, part or model.');
  if (['stat', 'gain', 'below'].includes(q.type)) return { type: q.type, stat: name, target, text: text || (q.type === 'gain' ? `Get ${target} more ${name}` : q.type === 'below' ? `Get ${name} of ${target} or less` : `Reach ${target} ${name}`) };
  if (q.type === 'badge') return { type: 'badge', badge: name, text: text || `Earn the badge "${name}"` };
  if (q.type === 'click') return { type: 'click', model: name, text: text || `Press every button of ${name}` };
  const parts = name.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6);
  return { type: 'visit', parts, text: text || `Reach ${parts.join(', ')}` };
}
// A prize of a custom event, checked and cleaned.
function cleanPrize(r, ladder = true) {
  const type = PRIZE_MODELS[r && r.type] ? r.type : 'Hat';
  const model = PRIZE_MODELS[type].includes(r.model) ? r.model : PRIZE_MODELS[type][0];
  const name = cleanText(r.name, 50);
  if (name.length < 3) throw new Error('Every prize needs a name (3 letters or more).');
  const data = type === 'TShirt' ? { graphic: 'star' } : { model, color: HEX.test(r.color) ? r.color : '#ffc400', accent: HEX.test(r.accent) ? r.accent : '#ffffff' };
  const out = { name, type, data };
  if (!ladder) return out;
  if (r.share) out.share = Math.max(0.05, Math.min(1, (+r.share || 0) / 100));
  else out.count = Math.max(1, Math.min(1000, Math.trunc(+r.count || 1)));
  return out;
}
// The hub maps a custom event can use.
export const HUB_MAPS = ['relics', 'dimension', ...Object.keys(HUB_THEMES)];
// Games that are never in the event (nothing to do in a house).
const EXCLUDED_KEYS = ['happyhome'];

// A custom event (made in Admin Panel -> The Hunt) as an event like the ones above.
function customEvent(c) {
  const quests = c.kind === 'quests';
  const rewards = {};
  (c.prizes || []).forEach((r, i) => { rewards['c' + (r.id || i)] = r; });
  const bonus = {};
  if (c.teamPrize) bonus.cteam = { ...c.teamPrize, team: true, how: `Everyone together reaches the team goal (${quests ? 'complete' : 'find'} at least 1)` };
  const theme = HUB_THEMES[c.hub];
  if (c.hubPrize) bonus.chub = { ...c.hubPrize, hub: true, how: c.hub === 'relics' ? 'Solve the rune puzzle in the hub' : theme ? `Find all 6 ${theme.collectibles} in the hub` : 'Collect all 6 star fragments in the hub' };
  return {
    name: c.name, kind: c.kind, unit: quests ? 'quest' : 'find', units: quests ? 'quests' : 'finds', robits: c.robits, teamGoal: c.teamGoal,
    fragments: c.hub === 'relics' ? 0 : 6, description: c.description, rewards, bonus, custom: true, hubStyle: c.hub, quests: c.quests || {},
    build: (games, prizes) => (c.hub === 'relics' ? buildRelicsHub(games, prizes, { name: c.name })
      : theme ? buildThemedHub(games, prizes, { theme: c.hub, name: c.name })
        : buildHuntHub(games, prizes, { fragments: 6, name: c.name })),
  };
}

export function installHunt(api, { db, manager, requireUser, requireAdmin, bad, log, giveSerial }) {
  const D = db.data;
  if (!D.hunt) D.hunt = {};
  const H = D.hunt;
  if (!D.huntCustom) D.huntCustom = {};
  const eventDef = (key) => EVENTS[key] || (D.huntCustom[key] ? customEvent(D.huntCustom[key]) : null);
  const official = () => officialAccount(D);
  const allOfficial = () => {
    const off = official();
    return Object.values(D.games).filter((g) => off && g.creatorId === off.id && g.isPublic && !g.huntHub).map((g) => g.id);
  };
  // ---------------------------------------------------------------- old worlds
  if ((H.version || 0) < 2) {
    H.games = [...new Set([...(H.games || []), ...allOfficial()])];
    H.autoPlayers = Math.max(H.autoPlayers || 0, 8);
    H.public = true;
    H.version = 2;
  }
  if (H.version < 3) {
    H.past = [...(H.past || []), { key: 'golden', name: 'The Hunt', progress: H.progress || {}, rewarded: H.rewarded || {}, rewards: H.rewards || {} }];
    Object.assign(H, { progress: {}, rewarded: {}, rewards: {}, fragments: {}, riftOpen: false, hubKey: '', version: 3 });
  }
  if (H.version < 4) {
    // the event manager: Another Dimension is the live event; tomorrow at 15:00
    // it ends and Lost Relics starts privately (the admins open it when ready)
    H.current = 'dimension';
    H.state = 'live';
    if (Date.now() < SWITCH_AT) {
      H.endsAt = SWITCH_AT;
      H.next = { key: 'relics', startsAt: SWITCH_AT, public: false };
    }
    H.version = 4;
  }
  H.progress = H.progress || {};
  H.rewarded = H.rewarded || {};
  H.rewards = H.rewards || {};
  H.fragments = H.fragments || {};
  H.hubDone = H.hubDone || {};
  H.past = H.past || [];
  if (!H.current) H.current = 'dimension';
  if (!H.state) H.state = 'live';
  const ev = () => eventDef(H.current) || EVENTS.dimension;
  // The private preview is only for the main account and the testers the
  // admins pick (by default the admin who launched it) - not every admin.
  H.testers = H.testers || [];
  // an event already started by hand must not start again from the schedule
  // (that would wipe its progress)
  if (H.state === 'live' && H.next && H.next.key === H.current) H.next = null;
  H.questOverrides = H.questOverrides || {};
  const live = () => H.state === 'live';
  if (!H.riftGoal || H.riftGoal === 300) H.riftGoal = ev().teamGoal;
  const teamGoal = () => H.riftGoal || ev().teamGoal;
  const allPrizes = () => ({ ...ev().rewards, ...ev().bonus });
  const bonusKey = (what) => Object.keys(ev().bonus).find((k) => ev().bonus[k][what]);

  // Prize items: not for sale, only given by the event.
  const makePrizes = () => {
    for (const [k, r] of Object.entries(allPrizes())) {
      if (H.rewards[k] && D.items[H.rewards[k]]) continue;
      const id = db.nextId('item');
      D.items[id] = {
        id, name: r.name, type: r.type, price: 0, data: r.data, creatorId: official()?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false,
        description: `${ev().name}: ${r.how || (r.count ? `${r.count} ${r.count === 1 ? ev().unit : ev().units}` : `${Math.round(r.share * 100)}% of the ${ev().units}`)}.`,
      };
      H.rewards[k] = id;
    }
  };
  makePrizes();
  const needFor = (key, total) => {
    const r = ev().rewards[key];
    return Math.max(1, Math.min(total, r.count || Math.ceil(total * r.share)));
  };
  const prizeKeys = () => Object.keys(ev().rewards).filter((k) => D.items[H.rewards[k]]);
  const prizeList = (total) => [
    ...prizeKeys().map((k) => ({ key: k, id: H.rewards[k], name: D.items[H.rewards[k]].name, need: needFor(k, total) })),
    ...Object.keys(ev().bonus).filter((k) => D.items[H.rewards[k]]).map((k) => ({ key: k, id: H.rewards[k], name: D.items[H.rewards[k]].name, how: ev().bonus[k].how, bonus: true })),
  ];
  const giveReward = (uid, key) => {
    if (!key) return null;
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
  // Finds by everyone together; at the goal the team prize goes to every finder.
  const globalFinds = () => Object.values(H.progress).reduce((n, l) => n + l.length, 0);
  const teamCheck = (uid) => {
    if (!live()) return null;
    if (!H.riftOpen && globalFinds() >= teamGoal()) H.riftOpen = true;
    if (H.riftOpen && uid && (H.progress[uid] || []).length) return giveReward(uid, bonusKey('team'));
    return null;
  };
  const eligible = (uid) => {
    if (!live()) return false;
    if (H.public) return true;
    const u = D.users[uid];
    return !!u && (u.id === official()?.id || H.testers.includes(u.id));
  };
  // The games in the event: the chosen official games + the most popular player games.
  const excluded = (g) => EXCLUDED_KEYS.includes(g.seedKey) || g.huntHub;
  const isHub = (id) => id === H.hubId || !!D.games[id]?.huntHub;
  const eventGames = () => {
    const off = official();
    const picked = (H.games || []).map((id) => D.games[id]).filter((g) => g && !isHub(g.id) && !excluded(g));
    const players = Object.values(D.games)
      .filter((g) => g.isPublic && !isHub(g.id) && !excluded(g) && (!off || g.creatorId !== off.id) && !picked.includes(g) && !D.users[g.creatorId]?.system)
      .sort((a, b) => (b.visits || 0) - (a.visits || 0) || b.upVotes - a.upVotes)
      .slice(0, Math.max(0, H.autoPlayers | 0));
    return [...picked.map((g) => ({ g, byPlayer: false })), ...players.map((g) => ({ g, byPlayer: true }))].map(({ g, byPlayer }) => ({
      id: g.id, name: g.name, byPlayer, creator: D.users[g.creatorId]?.username || '?',
      ...(ev().kind === 'quests' ? { quest: questText(g) } : {}),
    }));
  };
  const questCache = new Map();
  // the admins' quests for this event (custom events keep theirs with the event)
  const overrides = () => (ev().custom ? ev().quests : (H.questOverrides[H.current] || {}));
  const quest = (gameId) => {
    if (ev().kind !== 'quests') return null;
    return overrides()[gameId] || questFor(D.games[gameId], (id) => db.readPlace(id), questCache);
  };
  const questText = (g) => quest(g.id)?.text || '';
  const progress = (uid) => {
    const games = eventGames();
    const have = H.progress[uid] || [];
    const list = games.map((g) => ({ ...g, found: have.includes(g.id) }));
    const count = list.filter((g) => g.found).length;
    return { games: list, count, total: list.length };
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
    const team = teamCheck(uid);
    if (team) rewards.push(team);
    const reward = rewards.length ? { name: rewards.map((r) => r.name).join(', '), items: rewards } : null;
    const u = D.users[uid];
    const what = ev().kind === 'quests' ? 'quest' : ev().unit;
    if (u) { u.robits += ev().robits; log(uid, ev().robits, `${ev().name}: ${what}${force ? ' from the admins' : ''} (${p.count}/${p.total})`); }
    db.save();
    return { new: true, count: p.count, total: p.total, reward, robits: ev().robits, kind: ev().kind };
  };
  // Shards event: star fragments in the hub. n = 0 only asks.
  const fragment = (uid, n, gameId) => {
    if (!eligible(uid) || gameId !== H.hubId || !ev().fragments) return null;
    const total = ev().fragments;
    const have = H.fragments[uid] || (H.fragments[uid] = []);
    let isNew = false, prize = null;
    if (n >= 1 && n <= total && !have.includes(n)) {
      have.push(n);
      isNew = true;
      if (have.length >= total) prize = giveReward(uid, bonusKey('hub'));
      db.save();
    }
    return { new: isNew, count: have.length, total, list: [...have], prize: prize ? prize.name : '' };
  };
  // The hub's quest (the rune puzzle in Lost Relics) is done.
  const hubQuest = (uid, gameId) => {
    if (!eligible(uid) || gameId !== H.hubId) return null;
    const first = !H.hubDone[uid];
    H.hubDone[uid] = true;
    const prize = giveReward(uid, bonusKey('hub'));
    if (first || prize) db.save();
    return { new: first, prize: prize ? prize.name : '' };
  };
  manager.hunt = {
    eligible,
    kind: () => ev().kind,
    isPublic: () => !!H.public,
    // private preview: testers play the event's games on their own servers,
    // so nobody else sees the quests, runes or shards
    previewFor: (uid, gameId) => live() && !H.public && eligible(uid) && (gameId === H.hubId || eventGames().some((g) => g.id === gameId)),
    inEvent: (gameId) => live() && eventGames().some((g) => g.id === gameId),
    quest,
    collect,
    fragment,
    hubQuest,
    isHub: (gameId) => gameId === H.hubId,
    global: () => ({ Shards: globalFinds(), Goal: teamGoal(), Open: !!H.riftOpen }),
    progress: (uid) => {
      if (!eligible(uid)) return null;
      if (teamCheck(uid)) db.save(); // the team goal was reached since this player's last find
      return progress(uid);
    },
  };

  // ---------------------------------------------------------------- the hub game
  // Owned by the main account, rebuilt when the list of games changes.
  const syncHub = () => {
    const off = official();
    if (!off) return null;
    let hub = D.games[H.hubId];
    if (!live()) {
      if (hub) { hub.isPublic = false; hub.featured = false; }
      return hub || null;
    }
    const games = eventGames();
    const prizes = prizeList(games.length);
    const key = JSON.stringify([8, H.current, games.map((g) => [g.id, g.name, g.creator, g.quest || '']), prizes.map((p) => [p.name, p.need])]);
    if (!hub) {
      const id = db.nextId('game');
      hub = D.games[id] = {
        id, name: ev().name, description: ev().description,
        creatorId: off.id, genre: 'Adventure', created: Date.now(), updated: Date.now(), visits: 0, maxPlayers: 20,
        isPublic: !!H.public, featured: false, copyable: false, upVotes: 0, downVotes: 0, favorites: 0, huntHub: true,
      };
      H.hubId = id;
      H.hubKey = '';
    }
    hub.name = ev().name;
    hub.description = ev().description;
    hub.isPublic = !!H.public;
    hub.featured = !!H.public;
    if (H.hubKey !== key || !db.readPlace(hub.id)) {
      db.writePlace(hub.id, ev().build(games, prizes, ev()));
      hub.updated = Date.now();
      H.hubKey = key;
      // empty hub servers restart with the new hub
      for (const srv of manager.serversFor(hub.id)) if (!srv.playerCount) srv.close();
    }
    db.save();
    return hub;
  };

  // ---------------------------------------------------------------- launch / end
  const closeServers = (gameIds, msg) => {
    for (const id of gameIds) for (const srv of manager.serversFor(id)) if (!srv.closed) srv.close(msg);
  };
  const endEvent = (why = 'ended') => {
    if (!live()) return;
    H.state = 'ended';
    H.endedAt = Date.now();
    H.endsAt = 0;
    const hub = D.games[H.hubId];
    if (hub) { hub.isPublic = false; hub.featured = false; }
    closeServers([H.hubId], `${ev().name} has ended. Thanks for playing!`);
    H.endReason = why;
    db.save();
  };
  // Starts an event from scratch; the one before is put away (its prizes stay
  // with the players who won them).
  const launch = (key, opts = {}) => {
    const def = eventDef(key);
    if (!def) throw new Error('Unknown event.');
    if (H.next && H.next.key === key) H.next = null;
    if (live()) endEvent('ended (a new event started)');
    H.past.push({ key: H.current, name: ev().name, progress: H.progress, rewarded: H.rewarded, rewards: H.rewards, hubId: H.hubId, ended: H.endedAt || Date.now() });
    if (H.past.length > 20) H.past.shift();
    Object.assign(H, {
      current: key, state: 'live', public: !!opts.public, startedAt: Date.now(), endsAt: opts.endsAt || 0, endedAt: 0,
      progress: {}, rewarded: {}, rewards: {}, fragments: {}, hubDone: {}, riftOpen: false, riftGoal: def.teamGoal,
      hubId: 0, hubKey: '', testers: opts.testers ? [...new Set(opts.testers)] : H.testers,
    });
    if (!H.games || !H.games.length) H.games = allOfficial();
    makePrizes();
    syncHub();
    // running games pick up the new event when they restart
    closeServers(eventGames().map((g) => g.id).filter((id) => ![...manager.serversFor(id)].some((s) => s.playerCount)), 'The Hunt is changing');
    db.save();
  };
  const tick = () => {
    const now = Date.now();
    if (live() && H.endsAt && now >= H.endsAt) endEvent('ended on schedule');
    if (H.next && H.next.startsAt && now >= H.next.startsAt) {
      const n = H.next;
      H.next = null;
      try { launch(n.key, { public: n.public, testers: n.testers }); } catch { /* unknown event */ }
    }
  };
  tick();
  syncHub();
  const timer = setInterval(() => { try { tick(); syncHub(); } catch { /* try again */ } }, 20e3);
  timer.unref?.();
  const hubTimer = setInterval(() => { try { syncHub(); } catch { /* try again later */ } }, 10 * 60e3);
  hubTimer.unref?.();

  // ---------------------------------------------------------------- the event page
  const status = (u) => {
    if (u && teamCheck(u.id)) db.save();
    const p = u ? progress(u.id) : { games: eventGames().map((g) => ({ ...g, found: false })), count: 0, total: eventGames().length };
    const team = { shards: globalFinds(), goal: teamGoal(), open: !!H.riftOpen };
    return {
      key: H.current, name: ev().name, kind: ev().kind, unit: ev().unit, units: ev().units,
      custom: !!ev().custom, description: ev().description, hubStyle: ev().hubStyle || (ev().kind === 'quests' ? 'relics' : 'dimension'),
      public: !!H.public, hubId: syncHub()?.id || null, endsAt: H.endsAt || 0, ...p,
      robitsPerToken: ev().robits,
      rift: team, team,
      fragments: { count: u ? (H.fragments[u.id] || []).length : 0, total: ev().fragments || 0 },
      hubQuestDone: !!(u && H.hubDone[u.id]),
      rewards: prizeList(p.total).map((r) => ({ ...r, type: D.items[r.id].type, data: D.items[r.id].data, got: !!u && (H.rewarded[u.id] || []).includes(r.key) })),
    };
  };
  api.get('/hunt', (req, res) => {
    if (!req.user) return res.json({ visible: false });
    if (!live()) {
      // between events: what ended, and when the next one starts (if it's public)
      const nextPublic = H.next && H.next.public;
      return res.json({ visible: false, ended: { name: ev().name, at: H.endedAt || 0 }, next: nextPublic ? { name: eventDef(H.next.key)?.name, startsAt: H.next.startsAt } : null });
    }
    if (!eligible(req.user.id)) return res.json({ visible: false });
    res.json({ visible: true, ...status(req.user) });
  });

  // ---------------------------------------------------------------- admin
  const adminState = () => {
    const off = official();
    return {
      current: H.current, state: H.state, name: ev().name, kind: ev().kind, public: !!H.public,
      startedAt: H.startedAt || 0, endsAt: H.endsAt || 0, endedAt: H.endedAt || 0, next: H.next || null,
      events: [...Object.keys(EVENTS), ...Object.keys(D.huntCustom)].map((key) => { const e = eventDef(key); return { key, name: e.name, kind: e.kind, description: e.description, custom: !!e.custom, prizes: Object.keys(e.rewards).length + Object.keys(e.bonus).length }; }),
      custom: D.huntCustom,
      testers: H.testers.map((id) => ({ id, username: D.users[id]?.username || '?' })),
      owner: official()?.username || '',
      prizeModels: PRIZE_MODELS, questTypes: QUEST_TYPES,
      overrides: overrides(),
      past: H.past.map((p) => ({ key: p.key, name: p.name, ended: p.ended || 0, players: Object.values(p.progress || {}).filter((l) => l.length).length })),
      autoPlayers: H.autoPlayers, games: H.games || [], hubId: H.hubId,
      riftGoal: teamGoal(), riftShards: globalFinds(), riftOpen: !!H.riftOpen,
      official: Object.values(D.games).filter((g) => off && g.creatorId === off.id && !isHub(g.id) && g.isPublic && !excluded(g)).map((g) => ({ id: g.id, name: g.name, visits: g.visits })),
      event: eventGames(),
      finders: Object.values(H.progress).filter((l) => l.length).length,
    };
  };
  api.get('/admin/hunt', requireAdmin, (req, res) => res.json(adminState()));
  // Admin: one player's finds. Give or take a game's find, give all, take all.
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
    if (!live()) return bad(res, 'No event is running.');
    const games = eventGames();
    const ids = b.all ? games.map((g) => g.id) : [+b.gameId].filter((id) => games.some((g) => g.id === id));
    if (!ids.length) return bad(res, 'That game is not in The Hunt.');
    const prizes = [];
    if (b.take) {
      // finds go away; prizes already won are kept
      H.progress[u.id] = (H.progress[u.id] || []).filter((id) => !ids.includes(id));
    } else {
      for (const id of ids) { const r = collect(u.id, id, true); if (r?.reward) prizes.push(...r.reward.items); }
    }
    log(u.id, 0, `The Hunt: ${b.take ? 'took' : 'gave'} ${b.all ? 'everything' : '1 game'} (${req.user.username})`);
    db.save();
    res.json({ ...playerTokens(u), newPrizes: prizes });
  });
  // Settings of the live event.
  api.post('/admin/hunt', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.public !== undefined) H.public = !!b.public;
    // whoever makes it private keeps seeing it
    if (b.public === false && !H.testers.includes(req.user.id)) H.testers.push(req.user.id);
    if (Array.isArray(b.games)) H.games = [...new Set(b.games.map((x) => +x))].filter((id) => D.games[id] && !isHub(id)).slice(0, 30);
    if (b.riftGoal !== undefined) {
      const n = Math.trunc(+b.riftGoal || 0);
      if (n < 1 || n > 100000) return bad(res, 'Team goal: between 1 and 100,000.');
      H.riftGoal = n;
      H.riftOpen = globalFinds() >= n;
    }
    if (b.autoPlayers !== undefined) {
      const n = Math.trunc(+b.autoPlayers || 0);
      if (n < 0 || n > 20) return bad(res, 'Player games: between 0 and 20.');
      H.autoPlayers = n;
    }
    syncHub();
    db.save();
    res.json({ ok: true, ...adminState() });
  });
  // Event control: { action: 'launch', key, public } | { action: 'end' }
  //   | { action: 'schedule', endsAt, next: { key, startsAt, public } | null }
  const when = (v) => {
    const t = +v || 0;
    if (t && t < Date.now() - 60e3) throw new Error('That time is in the past.');
    return t;
  };
  api.post('/admin/hunt/control', requireAdmin, (req, res) => {
    const b = req.body || {};
    try {
      if (b.action === 'launch') {
        launch(String(b.key), { public: !!b.public, endsAt: when(b.endsAt), testers: [req.user.id] });
      } else if (b.action === 'end') {
        endEvent(`ended by ${req.user.username}`);
      } else if (b.action === 'schedule') {
        if (b.endsAt !== undefined) {
          if (!live() && +b.endsAt) throw new Error('No event is running.');
          H.endsAt = when(b.endsAt);
        }
        if (b.next !== undefined) {
          if (b.next && !eventDef(b.next.key)) throw new Error('Unknown event.');
          H.next = b.next ? { key: b.next.key, startsAt: when(b.next.startsAt), public: !!b.next.public, testers: [...new Set([...H.testers, req.user.id])] } : null;
          if (H.next && !H.next.startsAt) throw new Error('Pick when the next event starts.');
        }
      } else {
        throw new Error('Unknown action.');
      }
    } catch (e) { return bad(res, e.message); }
    db.save();
    res.json({ ok: true, ...adminState() });
  });
  // Who sees the private preview: { add: username } | { remove: userId } | { me: true }
  api.post('/admin/hunt/testers', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.me) H.testers = [...new Set([...H.testers, req.user.id])];
    if (b.add) {
      const u = findUser(b.add);
      if (!u) return bad(res, 'No player with that name.', 404);
      H.testers = [...new Set([...H.testers, u.id])];
    }
    if (b.remove) H.testers = H.testers.filter((id) => id !== +b.remove);
    db.save();
    res.json({ ok: true, ...adminState() });
  });
  // A game's quest in the live event: { gameId, quest: { type, name, target, text } | null }
  api.post('/admin/hunt/quest', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (!live() || ev().kind !== 'quests') return bad(res, 'The live event has no quests.');
    const gameId = +b.gameId;
    if (!eventGames().some((g) => g.id === gameId)) return bad(res, 'That game is not in The Hunt.');
    let q;
    try { q = cleanQuest(b.quest); } catch (e) { return bad(res, e.message); }
    const list = ev().custom ? (D.huntCustom[H.current].quests = D.huntCustom[H.current].quests || {}) : (H.questOverrides[H.current] = H.questOverrides[H.current] || {});
    if (q) list[gameId] = q; else delete list[gameId];
    syncHub();
    db.save();
    // players already in that game get the new quest when they join again
    res.json({ ok: true, ...adminState() });
  });
  // Custom events: { key?, event: {...} } saves, { key, delete: true } deletes.
  api.post('/admin/hunt/custom', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.delete) {
      if (!D.huntCustom[b.key]) return bad(res, 'Event not found.', 404);
      if (H.current === b.key && live()) return bad(res, 'End this event before deleting it.');
      delete D.huntCustom[b.key];
      if (H.next && H.next.key === b.key) H.next = null;
      db.save();
      return res.json({ ok: true, ...adminState() });
    }
    const e = b.event || {};
    let c;
    try {
      const name = cleanText(e.name, 60);
      if (name.length < 3) throw new Error('Give the event a name.');
      const prizes = (Array.isArray(e.prizes) ? e.prizes : []).slice(0, 12).map((r, i) => ({ ...cleanPrize(r), id: Math.trunc(+r.id) || i + 1 }));
      if (!prizes.length) throw new Error('Add at least one prize.');
      const ids = new Set();
      for (const p of prizes) { while (ids.has(p.id)) p.id++; ids.add(p.id); }
      c = {
        name: /^the hunt/i.test(name) ? name : 'The Hunt: ' + name,
        description: cleanText(e.description, 500) || 'A new The Hunt event!',
        kind: e.kind === 'shards' ? 'shards' : 'quests',
        hub: HUB_MAPS.includes(e.hub) ? e.hub : 'relics',
        robits: Math.max(0, Math.min(1000, Math.trunc(+e.robits || 0))),
        teamGoal: Math.max(1, Math.min(100000, Math.trunc(+e.teamGoal || 30))),
        prizes,
        teamPrize: e.teamPrize && e.teamPrize.name ? cleanPrize(e.teamPrize, false) : null,
        hubPrize: e.hubPrize && e.hubPrize.name ? cleanPrize(e.hubPrize, false) : null,
      };
    } catch (err) { return bad(res, err.message); }
    let key = String(b.key || '');
    if (key && !D.huntCustom[key]) return bad(res, 'Event not found.', 404);
    if (!key) { key = 'custom' + (db.nextId('huntEvent')); }
    c.quests = D.huntCustom[key]?.quests || {};
    D.huntCustom[key] = c;
    // the live event: its prizes follow the changes
    if (H.current === key && live()) {
      const ev2 = customEvent(c);
      for (const [k, r] of Object.entries({ ...ev2.rewards, ...ev2.bonus })) {
        const it = D.items[H.rewards[k]];
        if (it) Object.assign(it, { name: r.name, type: r.type, data: r.data });
      }
      makePrizes();
      if (!H.riftOpen) H.riftGoal = c.teamGoal;
      syncHub();
    }
    db.save();
    res.json({ ok: true, key, ...adminState() });
  });
  void requireUser;
}
