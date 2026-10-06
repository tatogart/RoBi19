// Levels and Daily Quests. Players earn XP by playing (minutes in games),
// by visiting every day and by finishing quests; every level up gives Robits.
// Three quests a day, picked at random from QUESTS, tracked on the server.
//   GET  /quests                 my level, my quests of today
//   POST /quests/:id/claim       take a finished quest's reward
//   GET  /leaderboard/levels     the highest levels
//   GET/POST /admin/progress     the settings (Control Center -> Economy)
//   POST /admin/users/:id/xp     give (or take) XP

// kind: what counts; need: how many; robits / xp: the reward
const QUESTS = [
  { id: 'play3', kind: 'play', need: 3, text: 'Join 3 games', robits: 20, xp: 40 },
  { id: 'games2', kind: 'game', need: 2, text: 'Play 2 different games', robits: 25, xp: 50 },
  { id: 'min15', kind: 'minutes', need: 15, text: 'Play for 15 minutes', robits: 30, xp: 60 },
  { id: 'min40', kind: 'minutes', need: 40, text: 'Play for 40 minutes', robits: 50, xp: 100 },
  { id: 'chat3', kind: 'chat', need: 3, text: 'Send 3 messages in a game chat', robits: 15, xp: 30 },
  { id: 'avatar', kind: 'avatar', need: 1, text: 'Change your avatar', robits: 15, xp: 30 },
  { id: 'vote', kind: 'vote', need: 1, text: 'Like or dislike a game', robits: 10, xp: 25 },
  { id: 'fav', kind: 'favorite', need: 1, text: 'Add a game to your favorites', robits: 10, xp: 25 },
  { id: 'friend', kind: 'friend', need: 1, text: 'Send or accept a friend request', robits: 15, xp: 30 },
  { id: 'buy', kind: 'buy', need: 1, text: 'Get an item from the catalog', robits: 15, xp: 30 },
];
const PER_DAY = 3;
const VISIT_XP = 20; // the first visit of the day
const MAX_LEVEL = 100;

// total XP needed for a level: 0, 100, 300, 600, 1000...
export const xpForLevel = (l) => 50 * l * (l - 1);
export const levelOf = (xp) => { let l = 1; while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++; return l; };

// which successful requests count for which quest
const TRACK = [
  ['PUT', /^\/avatar$/, 'avatar'],
  ['POST', /^\/games\/\d+\/vote$/, 'vote'],
  ['POST', /^\/games\/\d+\/favorite$/, 'favorite'],
  ['POST', /^\/friends\/\d+\/(request|accept)$/, 'friend'],
  ['POST', /^\/catalog\/\d+\/buy$/, 'buy'],
  ['POST', /^\/resales\/\d+\/buy$/, 'buy'],
];

export function installProgress(api, { db, manager, requireUser, requireAdmin, bad, log, hooks }) {
  const D = db.data;
  if (!D.settings) D.settings = {};
  if (!D.settings.progress) D.settings.progress = { on: true, rewardMult: 1, levelReward: 10, boost: null };
  const P = D.settings.progress;
  const now = () => Date.now();
  const dayKey = (t = now()) => new Date(t).toISOString().slice(0, 10);
  const xpMult = () => (P.boost && P.boost.until > now() ? P.boost.mult || 1 : 1);

  // gives XP; levels up (with Robits) when it's enough
  const addXp = (u, amount, why) => {
    if (!u || u.system || u.bot || !amount) return;
    const before = levelOf(u.xp || 0);
    u.xp = Math.max(0, (u.xp || 0) + Math.round(amount * (amount > 0 ? xpMult() : 1)));
    const after = levelOf(u.xp);
    if (after > before) {
      let got = 0;
      for (let l = before + 1; l <= after; l++) got += l * (P.levelReward || 0);
      if (got) { u.robits = (u.robits || 0) + got; log(u.id, got, `Level ${after}!`); }
      u.levelUp = { level: after, robits: got, time: now() }; // a popup on the next page
      if (manager && manager.findUser) {
        const f = manager.findUser(u.id);
        if (f) f.server.send(f.session, { t: 'sys', text: `⭐ Level up! You are now level ${after}${got ? ` (+R$ ${got})` : ''}${why ? '' : ''}` });
      }
    }
  };
  hooks.addXp = addXp;

  // today's quests (new ones every day)
  const questsOf = (u) => {
    if (!u.quests || u.quests.day !== dayKey()) {
      const pool = QUESTS.slice();
      const list = [];
      while (list.length < PER_DAY && pool.length) list.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      u.quests = { day: dayKey(), list: list.map((q) => ({ id: q.id, progress: 0, claimed: false })), games: [] };
    }
    return u.quests;
  };
  const view = (u) => {
    const Q = questsOf(u);
    const xp = u.xp || 0;
    const level = levelOf(xp);
    return {
      on: P.on !== false, level, xp, from: xpForLevel(level), to: level >= MAX_LEVEL ? xpForLevel(level) : xpForLevel(level + 1),
      boost: P.boost && P.boost.until > now() ? P.boost : null,
      quests: P.on === false ? [] : Q.list.map((q) => {
        const def = QUESTS.find((x) => x.id === q.id);
        return def ? { id: q.id, text: def.text, need: def.need, progress: Math.min(def.need, q.progress), done: q.progress >= def.need, claimed: q.claimed, robits: Math.round(def.robits * (P.rewardMult || 1)), xp: Math.round(def.xp * (P.rewardMult || 1)) } : null;
      }).filter(Boolean),
      resetsAt: new Date(dayKey() + 'T00:00:00Z').getTime() + 86400e3,
    };
  };
  hooks.levelOf = (u) => levelOf(u.xp || 0);

  // something happened that a quest may count
  const progress = (uid, kind, amount = 1, extra = {}) => {
    const u = D.users[uid];
    if (!u || u.system || u.bot || P.on === false) return;
    const Q = questsOf(u);
    if (kind === 'game') {
      if (Q.games.includes(extra.gameId)) return;
      Q.games.push(extra.gameId);
    }
    let changed = false;
    for (const q of Q.list) {
      const def = QUESTS.find((x) => x.id === q.id);
      if (!def || def.kind !== kind || q.progress >= def.need) continue;
      q.progress = Math.min(def.need, q.progress + amount);
      changed = true;
    }
    if (changed) db.save();
  };
  hooks.progress = progress;
  if (manager) {
    manager.progress = progress;
    manager.playMinutes = (uid, minutes) => {
      const u = D.users[uid];
      if (!u || minutes < 1) return;
      progress(uid, 'minutes', Math.floor(minutes));
      addXp(u, Math.min(120, Math.floor(minutes)) * 2, 'play'); // 2 XP a minute (up to 2 hours a game)
      db.save();
    };
    const prevChat = manager.chatlog;
    manager.chatlog = (e) => { if (prevChat) prevChat(e); if (!e.bot) progress(e.uid, 'chat'); };
  }
  // requests that count (see TRACK) + the first visit of the day
  hooks.track = (req, res) => {
    const u = req.user;
    if (!u || u.bot || u.system) return;
    if (req.method === 'GET' && req.path === '/auth/me' && u.visitDay !== dayKey()) {
      u.visitDay = dayKey();
      addXp(u, VISIT_XP, 'visit');
      db.save();
      return;
    }
    const t = TRACK.find(([m, re]) => m === req.method && re.test(req.path));
    if (t) res.on('finish', () => { if (res.statusCode < 400) progress(u.id, t[2]); });
  };

  api.get('/quests', requireUser, (req, res) => { const v = view(req.user); db.save(); res.json(v); });
  api.post('/quests/:id/claim', requireUser, (req, res) => {
    const u = req.user;
    const q = questsOf(u).list.find((x) => x.id === req.params.id);
    const def = q && QUESTS.find((x) => x.id === q.id);
    if (!def) return bad(res, 'Quest not found', 404);
    if (q.claimed) return bad(res, 'You already took this reward.');
    if (q.progress < def.need) return bad(res, 'Finish the quest first.');
    q.claimed = true;
    const robits = Math.round(def.robits * (P.rewardMult || 1));
    if (robits) { u.robits = (u.robits || 0) + robits; log(u.id, robits, `Quest: ${def.text}`); }
    addXp(u, Math.round(def.xp * (P.rewardMult || 1)), 'quest');
    u.questsDone = (u.questsDone || 0) + 1;
    db.save();
    res.json({ ...view(u), robits: u.robits, got: { robits, xp: def.xp } });
  });
  // the level-up popup was shown
  api.post('/quests/levelup/seen', requireUser, (req, res) => { delete req.user.levelUp; db.save(); res.json({ ok: true }); });
  api.get('/leaderboard/levels', (req, res) => {
    const list = Object.values(D.users).filter((u) => !u.system && !u.bot && !u.guest && (u.xp || 0) > 0)
      .sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 20)
      .map((u) => ({ id: u.id, username: u.username, level: levelOf(u.xp || 0), xp: u.xp || 0 }));
    res.json({ players: list });
  });

  // ---------------------------------------------------------------- admin
  api.get('/admin/progress', requireAdmin, (req, res) => {
    const players = Object.values(D.users).filter((u) => !u.system && !u.bot);
    const today = dayKey();
    res.json({
      settings: P, quests: QUESTS,
      stats: {
        withLevel: players.filter((u) => (u.xp || 0) > 0).length,
        questsToday: players.reduce((a, u) => a + (u.quests && u.quests.day === today ? u.quests.list.filter((q) => q.claimed).length : 0), 0),
        questsAll: players.reduce((a, u) => a + (u.questsDone || 0), 0),
        top: players.sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 10).map((u) => ({ id: u.id, username: u.username, level: levelOf(u.xp || 0), xp: u.xp || 0 })),
      },
    });
  });
  api.post('/admin/progress', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.on !== undefined) P.on = !!b.on;
    if (b.rewardMult !== undefined) P.rewardMult = Math.max(0, Math.min(10, +b.rewardMult || 0));
    if (b.levelReward !== undefined) P.levelReward = Math.max(0, Math.min(1000, Math.trunc(+b.levelReward || 0)));
    if (b.boost !== undefined) {
      const hours = Math.max(0, Math.min(24 * 14, +b.boost.hours || 0));
      const mult = Math.max(1, Math.min(10, +b.boost.mult || 2));
      P.boost = hours ? { mult, until: now() + hours * 3600e3 } : null;
    }
    db.save();
    res.json({ ok: true, settings: P });
  });
  api.post('/admin/users/:id/xp', requireAdmin, (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) return bad(res, 'User not found', 404);
    const amount = Math.trunc(+req.body?.amount || 0);
    if (!amount || Math.abs(amount) > 1e6) return bad(res, 'Give an amount of XP.');
    if (amount > 0) {
      // admin XP is not boosted
      const keep = P.boost; P.boost = null;
      addXp(u, amount, 'admin');
      P.boost = keep;
    } else u.xp = Math.max(0, (u.xp || 0) + amount);
    db.save();
    res.json({ ok: true, level: levelOf(u.xp || 0), xp: u.xp || 0 });
  });
}
