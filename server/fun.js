// Fun stuff: the Daily Spin (a prize wheel once a day, with a streak bonus; set
// up by the admins: prizes, chances, boosts, free spins), the secret code (a
// hidden badge), pokes between friends, live events from the admins (Robits
// rain, a party, decorations on the site), polls and saved outfits.
import { officialAccount } from './seed/seed.js';

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const HEX = /^#[0-9a-f]{6}$/i;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, d = lo) => { const n = Math.trunc(+v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

// The wheel the first time: w = how likely (out of the total).
export const SPIN = [
  { label: 'R$ 10', robits: 10, color: '#00a2ff', w: 28 },
  { label: 'R$ 25', robits: 25, color: '#02b757', w: 24 },
  { label: 'R$ 50', robits: 50, color: '#f5a623', w: 18 },
  { label: 'R$ 100', robits: 100, color: '#7b5cff', w: 13 },
  { label: 'R$ 250', robits: 250, color: '#ff4d8d', w: 8 },
  { label: 'R$ 500', robits: 500, color: '#e8590c', w: 4 },
  { label: 'Lucky Cap', item: 'spinCap', color: '#00c2c2', w: 3 },
  { label: 'JACKPOT R$ 1,000', robits: 1000, color: '#ffc400', w: 2, jackpot: true },
];
export const DECORS = ['none', 'snow', 'halloween', 'hearts', 'confetti', 'leaves', 'stars'];

export function installFun(api, { db, manager, requireUser, requireAdmin, bad, log, giveSerial, publicUser, presence }) {
  const D = db.data;
  if (!D.funItems) D.funItems = {};
  if (!D.pokes) D.pokes = [];
  // the rare prize of the wheel (not for sale)
  if (!D.funItems.spinCap || !D.items[D.funItems.spinCap]) {
    const id = db.nextId('item');
    D.items[id] = {
      id, name: 'Lucky Spin Cap', type: 'Hat', price: 0, offsale: true, limited: false, sales: 0, created: Date.now(),
      creatorId: officialAccount(D)?.id || 0, data: { model: 'cap', color: '#00c2c2', accent: '#ffc400' },
      description: 'A rare prize from the Daily Spin. Lucky you!',
    };
    D.funItems.spinCap = id;
  }
  if (!D.fun) D.fun = {};
  const F = D.fun;
  if (!F.spin) F.spin = { on: true, streakBonus: 10, maxStreak: 7, segments: SPIN.map((s) => ({ ...s, item: s.item ? D.funItems[s.item] : 0 })) };
  if (!F.stats) F.stats = {};
  if (!F.recent) F.recent = [];
  if (!F.rig) F.rig = {};
  if (!F.events) F.events = [];
  if (!F.polls) F.polls = [];
  if (!F.decor) F.decor = { name: 'none', until: 0 };
  const C = F.spin;

  const boost = () => (C.boost && C.boost.until > Date.now() ? C.boost : null);
  const decor = () => (F.decor.name !== 'none' && (!F.decor.until || F.decor.until > Date.now()) ? F.decor.name : 'none');
  const isOnline = (u) => presence(u).status !== 'offline';
  const players = () => Object.values(D.users).filter((u) => !u.system);
  // 'online', 'all', or a player's name / id
  const targets = (t) => {
    const s = String(t || '').trim();
    if (s === 'all') return players();
    if (s === 'online') return players().filter(isOnline);
    const u = /^\d+$/.test(s) ? D.users[+s] : Object.values(D.users).find((x) => x.username.toLowerCase() === s.toLowerCase());
    return u && !u.system ? [u] : [];
  };

  // ---------------------------------------------------------------- daily spin
  const streakOf = (u) => (u.spinDay === dayKey(Date.now() - 86400e3) || u.spinDay === dayKey() ? u.spinStreak || 0 : 0);
  api.get('/fun/spin', requireUser, (req, res) => {
    const u = req.user;
    const today = dayKey();
    const tomorrow = new Date(today + 'T00:00:00Z').getTime() + 86400e3;
    res.json({
      on: !!C.on, segments: C.segments.map((s) => ({ label: s.label, color: s.color })),
      canSpin: !!C.on && (u.spinDay !== today || (u.freeSpins || 0) > 0), freeSpins: u.freeSpins || 0, spunToday: u.spinDay === today,
      nextAt: tomorrow, streak: streakOf(u), boost: boost() ? { mult: C.boost.mult, until: C.boost.until } : null,
    });
  });
  api.post('/fun/spin', requireUser, (req, res) => {
    const u = req.user;
    const today = dayKey();
    if (!C.on) return bad(res, 'The Daily Spin is turned off right now.');
    const free = u.spinDay === today;
    if (free && !(u.freeSpins > 0)) return bad(res, 'You already spun today. Come back tomorrow!');
    let index;
    if (Number.isInteger(F.rig[u.id]) && C.segments[F.rig[u.id]]) { index = F.rig[u.id]; delete F.rig[u.id]; } else {
      const total = C.segments.reduce((n, s) => n + s.w, 0);
      let r = Math.random() * total;
      index = 0;
      while (index < C.segments.length - 1 && r >= C.segments[index].w) { r -= C.segments[index].w; index++; }
    }
    const seg = C.segments[index];
    let streak = u.spinStreak || 0;
    if (free) u.freeSpins--;
    else {
      streak = Math.min(C.maxStreak || 7, (u.spinDay === dayKey(Date.now() - 86400e3) ? u.spinStreak || 0 : 0) + 1);
      u.spinDay = today;
      u.spinStreak = streak;
    }
    let prize = seg.label;
    let robits = seg.robits || 0;
    if (seg.item) {
      const it = D.items[seg.item];
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      if (it && !inv.includes(it.id)) { inv.push(it.id); giveSerial(it, u.id); prize = it.name; } else { robits = robits || 250; prize = `R$ ${robits} (you already have ${it ? it.name : 'it'})`; }
    }
    const b = boost();
    if (b && robits) { robits = Math.round(robits * b.mult); prize = seg.item ? prize : `R$ ${robits.toLocaleString('en-US')} (x${b.mult} boost)`; }
    // days in a row: +streakBonus Robits for every day (not for free spins)
    const bonus = !free && streak > 1 ? streak * (C.streakBonus || 0) : 0;
    if (robits + bonus) {
      u.robits += robits + bonus;
      log(u.id, robits + bonus, `Daily Spin: ${prize}${bonus ? ` + streak bonus R$ ${bonus}` : ''}`);
    }
    const st = F.stats[today] || (F.stats[today] = { spins: 0, paid: 0, items: 0, jackpots: 0 });
    st.spins++; st.paid += robits + bonus; if (seg.item) st.items++; if (seg.jackpot || index === C.segments.length - 1) st.jackpots++;
    if (Object.keys(F.stats).length > 30) delete F.stats[Object.keys(F.stats).sort()[0]];
    F.recent.push({ uid: u.id, prize, t: Date.now() });
    if (F.recent.length > 50) F.recent.shift();
    db.save();
    res.json({ index, prize, bonus, streak, robits: u.robits, jackpot: !!seg.jackpot, freeSpins: u.freeSpins || 0 });
  });

  // ---- the admins: the wheel's prizes and chances, boosts, free spins
  const spinAdmin = () => {
    const days = Object.keys(F.stats).sort().slice(-14).map((d) => ({ day: d, ...F.stats[d] }));
    return {
      config: C, boost: boost(),
      stats: { days, today: F.stats[dayKey()] || { spins: 0, paid: 0, items: 0, jackpots: 0 } },
      recent: F.recent.slice().reverse().slice(0, 30).map((r) => ({ ...r, username: D.users[r.uid]?.username || '?' })),
      items: Object.fromEntries(C.segments.filter((s) => s.item && D.items[s.item]).map((s) => [s.item, { id: s.item, name: D.items[s.item].name, type: D.items[s.item].type, data: D.items[s.item].data }])),
      rigged: Object.entries(F.rig).map(([uid, i]) => ({ uid: +uid, username: D.users[uid]?.username || '?', index: i })),
    };
  };
  api.get('/admin/spin', requireAdmin, (req, res) => res.json(spinAdmin()));
  api.post('/admin/spin', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'save') {
      const segs = Array.isArray(b.segments) ? b.segments.slice(0, 12) : [];
      if (segs.length < 2) return bad(res, 'The wheel needs at least 2 prizes.');
      const out = [];
      for (const s of segs) {
        const label = clean(s.label, 24);
        if (!label) return bad(res, 'Every prize needs a name on the wheel.');
        const item = int(s.item, 0, 1e12, 0);
        if (item && !D.items[item]) return bad(res, `Item #${item} does not exist.`);
        const robits = int(s.robits, 0, 100000, 0);
        if (!item && !robits) return bad(res, `"${label}": give Robits or an item.`);
        out.push({ label, robits, item, color: HEX.test(s.color) ? s.color : '#00a2ff', w: Math.max(0.1, Math.min(1000, +s.w || 1)), jackpot: !!s.jackpot });
      }
      C.segments = out;
      C.on = b.on !== false;
      C.streakBonus = int(b.streakBonus, 0, 1000, 10);
      C.maxStreak = int(b.maxStreak, 1, 30, 7);
    } else if (b.op === 'toggle') {
      C.on = !!b.on;
    } else if (b.op === 'boost') {
      const mult = Math.max(1, Math.min(10, +b.mult || 1));
      const hours = Math.max(0, Math.min(168, +b.hours || 0));
      C.boost = mult > 1 && hours ? { mult, until: Date.now() + hours * 3600e3 } : null;
    } else if (b.op === 'give' || b.op === 'reset') {
      const list = targets(b.target);
      if (!list.length) return bad(res, 'No players found.');
      const n = int(b.count, 1, 10, 1);
      for (const u of list) {
        if (b.op === 'give') u.freeSpins = Math.min(50, (u.freeSpins || 0) + n);
        else u.spinDay = '';
      }
      db.save();
      return res.json({ ok: true, players: list.length, ...spinAdmin() });
    } else if (b.op === 'rig') {
      const [u] = targets(b.target);
      if (!u || targets(b.target).length !== 1) return bad(res, 'Write one player\'s name.');
      if (b.index === null || b.index === undefined || b.index === '') delete F.rig[u.id];
      else {
        const i = int(b.index, 0, C.segments.length - 1, 0);
        F.rig[u.id] = i;
      }
    } else return bad(res, 'Unknown action.');
    db.save();
    res.json({ ok: true, ...spinAdmin() });
  });

  // ---------------------------------------------------------------- the secret code
  // Somewhere on Robis there's a secret code... (the Konami code). The first
  // time: a hidden badge and R$ 100.
  api.post('/fun/secret', requireUser, (req, res) => {
    const u = req.user;
    if (String(req.body?.code || '') !== 'uuddlrlrba') return bad(res, 'Nope.');
    if (u.secretFound) return res.json({ first: false });
    u.secretFound = Date.now();
    u.robits += 100;
    log(u.id, 100, 'Found the secret code!');
    db.save();
    res.json({ first: true, robits: u.robits });
  });

  // ---------------------------------------------------------------- pokes
  api.post('/users/:id/poke', requireUser, (req, res) => {
    const to = D.users[+req.params.id];
    if (!to || to.system || to.id === req.user.id) return bad(res, 'User not found', 404);
    if (!(D.friends[req.user.id] || []).includes(to.id)) return bad(res, 'You can only poke friends.');
    const now = Date.now();
    if (D.pokes.some((p) => p.from === req.user.id && p.to === to.id && now - p.created < 30e3)) return bad(res, 'Wait a little before poking again!', 429);
    D.pokes = D.pokes.filter((p) => now - p.created < 10 * 60e3);
    D.pokes.push({ id: (D.pokes.at(-1)?.id || 0) + 1, from: req.user.id, to: to.id, created: now });
    db.save();
    res.json({ ok: true });
  });
  // the pokes for me (each shown once)
  api.get('/pokes', requireUser, (req, res) => {
    const mine = D.pokes.filter((p) => p.to === req.user.id && D.users[p.from]);
    if (!mine.length) return res.json({ pokes: [] });
    D.pokes = D.pokes.filter((p) => p.to !== req.user.id);
    db.save();
    res.json({ pokes: mine.map((p) => ({ id: p.id, from: publicUser(D.users[p.from]), created: p.created })) });
  });

  // ---------------------------------------------------------------- live events
  // Robits rain (everyone online, or everyone, gets Robits and sees it rain),
  // a party (confetti + a message on every open page) and decorations.
  // Pages ask GET /fun/live every 15 seconds (with the newest event id they saw).
  api.get('/fun/live', (req, res) => {
    const since = int(req.query.since, 0, 1e15, 0);
    const now = Date.now();
    const events = F.events.filter((e) => e.id > since && now - e.created < 5 * 60e3 && (!e.users || (req.user && e.users.includes(req.user.id))))
      .map(({ users, ...e }) => e);
    const ab = abuse();
    res.json({ last: F.events.at(-1)?.id || 0, decor: decor(), boost: boost() ? { mult: C.boost.mult, until: C.boost.until } : null, events,
      abuse: ab ? { id: ab.started, gameId: ab.gameId, game: D.games[ab.gameId].name, by: ab.byName, ends: ab.ends } : null });
  });
  const pushEvent = (e) => {
    F.events.push({ id: (F.events.at(-1)?.id || 0) + 1, created: Date.now(), ...e });
    F.events = F.events.filter((x) => Date.now() - x.created < 10 * 60e3).slice(-50);
  };
  api.post('/admin/fun', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'rain') {
      const amount = int(b.amount, 1, 10000, 0);
      if (!amount) return bad(res, 'How many Robits?');
      const list = b.target === 'all' ? players() : players().filter(isOnline);
      if (!list.length) return bad(res, 'Nobody is online right now.');
      for (const u of list) { u.robits += amount; log(u.id, amount, `Robits rain from ${req.user.username}`); }
      pushEvent({ type: 'rain', amount, text: clean(b.text, 120), by: req.user.username, users: list.map((u) => u.id) });
      db.save();
      return res.json({ ok: true, players: list.length });
    }
    if (b.op === 'party') {
      pushEvent({ type: 'party', text: clean(b.text, 120) || 'Party time!', by: req.user.username, emoji: clean(b.emoji, 4) });
      db.save();
      return res.json({ ok: true });
    }
    if (b.op === 'decor') {
      if (!DECORS.includes(b.decor)) return bad(res, 'Unknown decoration.');
      const hours = Math.max(0, Math.min(24 * 60, +b.hours || 0));
      F.decor = { name: b.decor, until: b.decor !== 'none' && hours ? Date.now() + hours * 3600e3 : 0 };
      db.save();
      return res.json({ ok: true, decor: decor() });
    }
    bad(res, 'Unknown action.');
  });
  api.get('/admin/fun', requireAdmin, (req, res) => {
    res.json({ decor: F.decor, decors: DECORS, online: players().filter(isOnline).length, players: players().length,
      events: F.events.slice().reverse().map(({ users, ...e }) => ({ ...e, players: users ? users.length : null })) });
  });

  // ---------------------------------------------------------------- Admin Abuse
  // An admin "abuses" one game: everyone on the site sees a banner with a Join
  // button; in the game the admin is a giant with a crown and can send global
  // messages and turn on effects for everyone (see GameServer.applyAbuse).
  const ABUSE_FX = ['giant', 'bigAll', 'tiny', 'speed', 'jump', 'fly', 'lowgrav', 'disco', 'night'];
  const ABUSE_ONCE = ['coinrain', 'fireworks', 'meteors', 'bring'];
  function abuse() {
    return F.abuse && (!F.abuse.ends || F.abuse.ends > Date.now()) && D.games[F.abuse.gameId] ? F.abuse : null;
  }
  if (manager) manager.abuse = abuse;
  const servers = (gameId) => (manager ? manager.allServers().filter((x) => x.gameId === gameId && !x.privateId && !x.isTest) : []);
  const endAbuse = () => {
    const a = F.abuse;
    F.abuse = null;
    if (a) for (const srv of servers(a.gameId)) { srv.refreshAbuse(); srv.abuseOnce('message', { text: 'Admin Abuse is over! Thanks for coming!', by: a.byName, state: a }); }
    db.save();
  };
  // ended by its timer
  const timer = setInterval(() => { if (F.abuse && !abuse()) endAbuse(); }, 15e3);
  timer.unref?.();
  const abuseView = () => {
    const a = abuse();
    const list = a ? servers(a.gameId) : [];
    return {
      abuse: a ? { ...a, game: D.games[a.gameId].name, servers: list.length, players: list.reduce((n, x) => n + x.sessions.size, 0), adminIn: list.some((x) => x.sessions.has(a.by)) } : null,
      games: Object.values(D.games).filter((g) => g.isPublic).sort((x, y) => (y.seedKey === 'crossroads') - (x.seedKey === 'crossroads') || y.visits - x.visits).slice(0, 60)
        .map((g) => ({ id: g.id, name: g.name, playing: servers(g.id).reduce((n, x) => n + x.sessions.size, 0) })),
      effects: ABUSE_FX, once: ABUSE_ONCE,
    };
  };
  api.get('/admin/abuse', requireAdmin, (req, res) => res.json(abuseView()));
  api.post('/admin/abuse', requireAdmin, (req, res) => {
    const b = req.body || {};
    const a = abuse();
    if (b.op === 'start') {
      const g = D.games[int(b.gameId, 0, 1e12, 0)];
      if (!g) return bad(res, 'Pick a game.');
      if (a) endAbuse();
      const minutes = Math.max(0, Math.min(600, +b.minutes || 0));
      F.abuse = { gameId: g.id, by: req.user.id, byName: req.user.username, started: Date.now(), ends: minutes ? Date.now() + minutes * 60e3 : 0, effects: { giant: true } };
      pushEvent({ type: 'abuse', gameId: g.id, game: g.name, by: req.user.username, text: clean(b.text, 120) });
      for (const srv of servers(g.id)) { srv.refreshAbuse(); srv.abuseOnce('message', { text: `ADMIN ABUSE! ${req.user.username} is here!`, by: req.user.username, color: '#ff3b3b' }); }
      db.save();
      return res.json({ ok: true, ...abuseView() });
    }
    if (!a) return bad(res, 'No Admin Abuse is running. Start one first.');
    if (b.op === 'end') { endAbuse(); return res.json({ ok: true, ...abuseView() }); }
    if (b.op === 'effect') {
      if (!ABUSE_FX.includes(b.effect)) return bad(res, 'Unknown effect.');
      a.effects[b.effect] = !!b.on;
      if (b.effect === 'bigAll' && b.on) a.effects.tiny = false;
      if (b.effect === 'tiny' && b.on) a.effects.bigAll = false;
      for (const srv of servers(a.gameId)) srv.refreshAbuse();
    } else if (b.op === 'once') {
      if (!ABUSE_ONCE.includes(b.effect)) return bad(res, 'Unknown effect.');
      for (const srv of servers(a.gameId)) srv.abuseOnce(b.effect, {});
    } else if (b.op === 'message') {
      const text = clean(b.text, 120);
      if (!text) return bad(res, 'Write the message.');
      const list = b.everywhere ? (manager ? manager.allServers().filter((x) => !x.isTest) : []) : servers(a.gameId);
      for (const srv of list) srv.abuseOnce('message', { text, by: req.user.username, color: b.color });
      if (b.site) pushEvent({ type: 'party', text, by: req.user.username });
    } else if (b.op === 'robits') {
      const amount = int(b.amount, 1, 10000, 0);
      if (!amount) return bad(res, 'How many Robits?');
      const ids = new Set(servers(a.gameId).flatMap((x) => [...x.sessions.keys()]));
      for (const id of ids) { const u = D.users[id]; if (u) { u.robits += amount; log(u.id, amount, `Admin Abuse gift from ${req.user.username}`); } }
      pushEvent({ type: 'rain', amount, text: `Admin Abuse in ${D.games[a.gameId].name}`, by: req.user.username, users: [...ids] });
      for (const srv of servers(a.gameId)) { srv.abuseOnce('coinrain', {}); srv.abuseOnce('message', { text: `+R$ ${amount} for everyone here!`, by: req.user.username, color: '#ffc400' }); }
      db.save();
      return res.json({ ok: true, players: ids.size, ...abuseView() });
    } else return bad(res, 'Unknown action.');
    db.save();
    res.json({ ok: true, ...abuseView() });
  });

  // ---------------------------------------------------------------- polls
  const pollView = (p, u) => {
    const votes = Object.values(p.votes);
    const mine = u ? p.votes[u.id] : undefined;
    const done = p.closed || (p.ends && p.ends < Date.now());
    return {
      id: p.id, question: p.question, options: p.options, created: p.created, ends: p.ends, closed: !!done,
      total: votes.length, myVote: mine ?? null,
      counts: mine !== undefined || done ? p.options.map((_, i) => votes.filter((v) => v === i).length) : null,
    };
  };
  api.get('/polls', (req, res) => {
    const now = Date.now();
    const list = F.polls.filter((p) => !p.closed && (!p.ends || p.ends > now) || (now - (p.closedAt || p.ends || 0) < 24 * 3600e3 && (p.closed || p.ends)))
      .slice(-3).reverse();
    res.json({ polls: list.map((p) => pollView(p, req.user)) });
  });
  api.post('/polls/:id/vote', requireUser, (req, res) => {
    const p = F.polls.find((x) => x.id === +req.params.id);
    if (!p) return bad(res, 'Poll not found', 404);
    if (p.closed || (p.ends && p.ends < Date.now())) return bad(res, 'This poll is closed.');
    const i = int(req.body?.option, -1, p.options.length - 1, -1);
    if (i < 0) return bad(res, 'Pick an answer.');
    if (p.votes[req.user.id] !== undefined) return bad(res, 'You already voted.');
    p.votes[req.user.id] = i;
    db.save();
    res.json({ poll: pollView(p, req.user) });
  });
  api.get('/admin/polls', requireAdmin, (req, res) => {
    res.json({ polls: F.polls.slice().reverse().map((p) => ({ ...pollView(p, null), counts: p.options.map((_, i) => Object.values(p.votes).filter((v) => v === i).length), by: p.by })) });
  });
  api.post('/admin/polls', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'create') {
      const question = clean(b.question, 140);
      const options = (Array.isArray(b.options) ? b.options : []).map((o) => clean(o, 60)).filter(Boolean).slice(0, 6);
      if (question.length < 3) return bad(res, 'Write the question.');
      if (options.length < 2) return bad(res, 'A poll needs at least 2 answers.');
      const hours = Math.max(0, Math.min(24 * 30, +b.hours || 0));
      F.polls.push({ id: (F.polls.at(-1)?.id || 0) + 1, question, options, votes: {}, created: Date.now(), ends: hours ? Date.now() + hours * 3600e3 : 0, closed: false, by: req.user.username });
      if (F.polls.length > 50) F.polls.shift();
    } else {
      const p = F.polls.find((x) => x.id === +b.id);
      if (!p) return bad(res, 'Poll not found', 404);
      if (b.op === 'close') { p.closed = true; p.closedAt = Date.now(); } else if (b.op === 'delete') F.polls = F.polls.filter((x) => x !== p);
      else return bad(res, 'Unknown action.');
    }
    db.save();
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- outfits
  // Up to 12 saved looks (body colours + what's worn); wearing one goes through
  // PUT /avatar, so items the player no longer owns are left out.
  api.get('/avatar/outfits', requireUser, (req, res) => res.json({ outfits: req.user.outfits || [] }));
  api.post('/avatar/outfits', requireUser, (req, res) => {
    const u = req.user;
    const list = u.outfits || (u.outfits = []);
    const b = req.body || {};
    if (b.delete) {
      u.outfits = list.filter((o) => o.id !== +b.delete);
    } else {
      if (list.length >= 12) return bad(res, 'You can save up to 12 outfits. Delete one first.');
      const name = clean(b.name, 30) || `Outfit ${list.length + 1}`;
      const a = u.avatar || {};
      list.push({ id: (list.at(-1)?.id || 0) + 1, name, avatar: { bodyColors: { ...(a.bodyColors || {}) }, wearing: [...(a.wearing || [])] }, created: Date.now() });
    }
    db.save();
    res.json({ outfits: u.outfits });
  });
}
