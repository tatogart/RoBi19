// Control Center 4.0 (Admin Panel): the chat log of every game, a scheduler
// for timed actions, switches that turn site features off, the economy at a
// glance, a notes board for the staff and the "needs attention" counters.
import { siteSettings } from './adminplus.js';
import { scamLevel } from '../shared/scam.js';

const CHAT_KEEP = 2000;
const FEATURES = {
  trades: 'Trading',
  gifts: 'Gifts',
  friendRequests: 'Friend requests',
  groups: 'Creating and joining groups',
  purchases: 'Buying in the catalog',
  gameCreate: 'Creating games',
  spin: 'Daily Spin',
  chat: 'Chat in games',
};
// which POST routes each switch closes (staff can still use them)
const GATES = [
  ['trades', /^\/trades(\/|$)/],
  ['gifts', /^\/catalog\/\d+\/gift$/],
  ['friendRequests', /^\/friends\/\d+\/request$/],
  ['groups', /^\/groups(\/\d+\/join)?$/],
  ['purchases', /^\/catalog\/\d+\/(buy|resell)$/],
  ['gameCreate', /^\/games$/],
  ['spin', /^\/fun\/spin$/],
];
const KINDS = {
  announce: 'Site announcement',
  gamemsg: 'Message in every game',
  rain: 'Robits rain (everyone online)',
  maintenance: 'Maintenance on / off',
  bots: 'Bots on / off',
  shutdown: 'Restart all game servers',
};

export function installControl(api, { db, manager, requireAdmin, requireStaff, bad, hooks, publicUser }) {
  const D = db.data;
  const S = siteSettings(D);
  if (!S.features) S.features = {};
  for (const k of Object.keys(FEATURES)) if (S.features[k] === undefined) S.features[k] = true;
  if (!D.chatlog) D.chatlog = [];
  if (!D.schedule) D.schedule = [];
  if (!D.teamNotes) D.teamNotes = [];
  const isStaff = (u) => !!u && (u.isAdmin || (u.perms || []).length > 0);
  const clean = (v, n) => String(v ?? '').trim().slice(0, n);

  // ---------------------------------------------------------------- switches
  hooks.featureGate = (req, res, next) => {
    if (req.method !== 'POST' || isStaff(req.user)) return next();
    for (const [k, re] of GATES) {
      if (S.features[k] === false && re.test(req.path)) return bad(res, `${FEATURES[k]} is turned off for now. Try again later!`, 403);
    }
    next();
  };
  if (manager) manager.features = () => S.features;

  api.get('/admin/features', requireAdmin, (req, res) => res.json({ features: S.features, names: FEATURES }));
  api.post('/admin/features', requireAdmin, (req, res) => {
    const k = String(req.body?.key || '');
    if (!(k in FEATURES)) return bad(res, 'Unknown switch.');
    S.features[k] = !!req.body?.on;
    db.save();
    res.json({ features: S.features });
  });

  // ---------------------------------------------------------------- chat log
  // GameServer calls this for every chat message (before the filter, so the
  // staff see what was really written).
  if (manager) manager.chatlog = (e) => {
    const shown = String(e.shown || '');
    const scam = scamLevel(String(e.text || ''));
    D.chatlog.push({
      t: Date.now(), uid: e.uid, name: e.name, gameId: e.gameId, server: e.server, text: String(e.text || '').slice(0, 200),
      filtered: shown !== e.text, scam: scam || undefined, bot: e.bot || undefined,
    });
    if (D.chatlog.length > CHAT_KEEP + 200) D.chatlog.splice(0, D.chatlog.length - CHAT_KEEP);
  };
  api.get('/admin/chatlog', requireStaff, (req, res) => {
    const q = clean(req.query.q, 60).toLowerCase();
    const flagged = req.query.flagged === '1';
    const bots = req.query.bots === '1';
    const gameId = +req.query.game || 0;
    const out = [];
    for (let i = D.chatlog.length - 1; i >= 0 && out.length < 300; i--) {
      const m = D.chatlog[i];
      if (!bots && m.bot) continue;
      if (flagged && !m.filtered && !m.scam) continue;
      if (gameId && m.gameId !== gameId) continue;
      if (q && !m.text.toLowerCase().includes(q) && !String(m.name).toLowerCase().includes(q)) continue;
      out.push({ ...m, gameName: D.games[m.gameId]?.name || '?' });
    }
    const games = [...new Set(D.chatlog.map((m) => m.gameId))].filter((id) => D.games[id]).map((id) => ({ id, name: D.games[id].name }));
    const day = Date.now() - 86400e3;
    res.json({ messages: out, games, total: D.chatlog.length, flagged24: D.chatlog.filter((m) => m.t > day && (m.filtered || m.scam) && !m.bot).length });
  });

  // ---------------------------------------------------------------- scheduler
  const run = (job) => {
    const p = job.params || {};
    switch (job.kind) {
      case 'announce':
        D.announcement = p.text ? { text: p.text, color: p.color || 'blue', by: job.by, time: Date.now() } : null;
        if (p.text && manager) for (const s of manager.allServers()) s.broadcast({ t: 'sys', text: `[Announcement] ${p.text}` });
        return p.text ? 'posted' : 'removed';
      case 'gamemsg': {
        let n = 0;
        if (manager) for (const s of manager.allServers()) { s.broadcast({ t: 'sys', text: `[Robis] ${p.text}` }); n += s.sessions.size; }
        return `${n} players saw it`;
      }
      case 'rain':
        return manager && manager.funRain ? `${manager.funRain(+p.amount || 0, p.text, job.by)} players got R$${p.amount}` : 'not available';
      case 'maintenance':
        S.maintenance.on = !!p.on;
        if (p.text) S.maintenance.message = p.text;
        return p.on ? 'on' : 'off';
      case 'bots':
        if (D.bots) { D.bots.enabled = !!p.on; if (!p.on && manager && manager.bots) for (const b of [...manager.bots.live.values()]) b.leave(); }
        return p.on ? 'on' : 'off';
      case 'shutdown': {
        const list = manager ? manager.allServers().filter((s) => !s.isTest) : [];
        for (const s of list) s.close(p.text || 'Robis is updating. Join again in a minute!');
        return `${list.length} servers`;
      }
      default: return 'unknown';
    }
  };
  const tick = () => {
    const now = Date.now();
    let changed = false;
    for (const j of D.schedule) {
      if (j.done || j.at > now) continue;
      try { j.result = run(j); } catch (e) { j.result = 'error: ' + e.message; }
      j.lastRun = now;
      if (j.repeat === 'daily') j.at += 86400e3 * Math.max(1, Math.ceil((now - j.at + 1) / 86400e3));
      else if (j.repeat === 'hourly') j.at += 3600e3 * Math.max(1, Math.ceil((now - j.at + 1) / 3600e3));
      else j.done = true;
      changed = true;
    }
    if (D.schedule.length > 100) D.schedule = D.schedule.filter((j) => !j.done).concat(D.schedule.filter((j) => j.done).slice(-30));
    if (changed) db.save();
  };
  const timer = setInterval(tick, 15000);
  if (timer.unref) timer.unref();
  if (manager) { const stop = manager.shutdown.bind(manager); manager.shutdown = () => { clearInterval(timer); stop(); }; }

  api.get('/admin/schedule', requireAdmin, (req, res) => res.json({ jobs: D.schedule.slice().sort((a, b) => (a.done - b.done) || a.at - b.at), kinds: KINDS, now: Date.now() }));
  api.post('/admin/schedule', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'cancel') { D.schedule = D.schedule.filter((j) => j.id !== +b.id); db.save(); return res.json({ ok: true }); }
    if (b.op === 'run') {
      const j = D.schedule.find((x) => x.id === +b.id);
      if (!j) return bad(res, 'Not found', 404);
      j.result = run(j); j.lastRun = Date.now();
      db.save();
      return res.json({ ok: true, result: j.result });
    }
    if (!(b.kind in KINDS)) return bad(res, 'What should happen?');
    const at = +new Date(b.at);
    if (!Number.isFinite(at) || at < Date.now() - 60e3) return bad(res, 'Pick a time in the future.');
    const params = { text: clean(b.text, 300), color: ['blue', 'green', 'orange', 'red'].includes(b.color) ? b.color : 'blue', amount: Math.max(0, Math.min(10000, Math.trunc(+b.amount || 0))), on: !!b.on };
    if (b.kind === 'gamemsg' && !params.text) return bad(res, 'Write the message.');
    if (b.kind === 'rain' && !params.amount) return bad(res, 'How many Robits?');
    const id = (D.schedule.reduce((m, j) => Math.max(m, j.id), 0) || 0) + 1;
    D.schedule.push({ id, kind: b.kind, at, repeat: ['daily', 'hourly'].includes(b.repeat) ? b.repeat : '', params, by: req.user.username, created: Date.now(), done: false });
    db.save();
    res.json({ ok: true, id });
  });

  // ---------------------------------------------------------------- economy
  api.get('/admin/economy', requireAdmin, (req, res) => {
    const DAY = 86400e3;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => ({ t: start.getTime() - (13 - i) * DAY, made: 0, spent: 0 }));
    const from = days[0].t;
    const big = [];
    for (const t of D.transactions || []) {
      if (t.time < from) continue;
      const d = days[Math.min(13, Math.floor((t.time - from) / DAY))];
      if (t.amount > 0) d.made += t.amount; else d.spent -= t.amount;
      if (t.time > Date.now() - DAY && Math.abs(t.amount) >= 50) big.push(t);
    }
    big.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const people = Object.values(D.users).filter((u) => !u.system && !u.bot);
    const total = people.reduce((a, u) => a + (u.robits || 0), 0);
    const sorted = people.slice().sort((a, b) => (b.robits || 0) - (a.robits || 0));
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)].robits || 0 : 0;
    const items = Object.values(D.items).filter((i) => (i.sales || 0) > 0).sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 10);
    res.json({
      days, total, players: people.length, average: people.length ? Math.round(total / people.length) : 0, median,
      richest: sorted.slice(0, 10).map((u) => ({ id: u.id, username: u.username, robits: u.robits || 0, admin: !!u.isAdmin })),
      items: items.map((i) => ({ id: i.id, name: i.name, sales: i.sales || 0, price: i.price || 0, earned: (i.sales || 0) * (i.price || 0) })),
      big: big.slice(0, 12).map((t) => ({ ...t, username: D.users[t.userId]?.username || '?' })),
    });
  });

  // ---------------------------------------------------------------- staff notes
  api.get('/admin/notes', requireStaff, (req, res) => res.json({ notes: D.teamNotes.slice().sort((a, b) => (b.pinned - a.pinned) || b.time - a.time) }));
  api.post('/admin/notes', requireStaff, (req, res) => {
    const b = req.body || {};
    if (b.op === 'add') {
      const text = clean(b.text, 1000);
      if (!text) return bad(res, 'Write something.');
      const id = (D.teamNotes.reduce((m, n) => Math.max(m, n.id), 0) || 0) + 1;
      D.teamNotes.push({ id, text, by: req.user.username, uid: req.user.id, time: Date.now(), pinned: false, color: ['yellow', 'blue', 'green', 'pink'].includes(b.color) ? b.color : 'yellow' });
      if (D.teamNotes.length > 200) D.teamNotes.splice(0, D.teamNotes.length - 200);
    } else {
      const n = D.teamNotes.find((x) => x.id === +b.id);
      if (!n) return bad(res, 'Not found', 404);
      if (b.op === 'pin') n.pinned = !n.pinned;
      else if (b.op === 'delete') {
        if (n.uid !== req.user.id && !req.user.isAdmin) return bad(res, 'Only the author or an admin can delete it.', 403);
        D.teamNotes = D.teamNotes.filter((x) => x !== n);
      } else return bad(res, 'Unknown action.');
    }
    db.save();
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- needs attention
  api.get('/admin/attention', requireStaff, (req, res) => {
    const day = Date.now() - 86400e3;
    const online = [];
    if (manager) for (const s of manager.allServers()) for (const x of s.sessions.values()) if (!x.bot && !s.isTest) online.push({ id: x.user.id, username: x.user.username, gameId: s.gameId, gameName: D.games[s.gameId]?.name || s.name });
    res.json({
      reports: (D.reports || []).filter((r) => r.status === 'open').length,
      appeals: (D.appeals || []).filter((a) => a.status === 'open').length,
      overwatch: (D.overwatch?.real || []).filter((r) => r.status === 'open').length,
      chat: D.chatlog.filter((m) => m.t > day && (m.filtered || m.scam) && !m.bot).length,
      scheduled: D.schedule.filter((j) => !j.done).length,
      off: Object.entries(S.features).filter(([, v]) => v === false).map(([k]) => FEATURES[k]),
      maintenance: !!S.maintenance.on,
      notes: D.teamNotes.filter((n) => n.pinned).slice(-3).map((n) => ({ text: n.text, by: n.by })),
      online: online.slice(0, 12), onlineCount: online.length,
      newPlayers: Object.values(D.users).filter((u) => !u.system && !u.bot && u.created > day).slice(-8).reverse().map((u) => publicUser ? { id: u.id, username: u.username, created: u.created } : u.id),
    });
  });
}
