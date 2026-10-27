// Robis is closing: every event ends, every page and every game shows when
// the site closes, and everybody can download their data before that.
//   GET  /me/export               my data (a .json file): account, items,
//                                 friends, messages, transactions, my games with their places
//   GET  /admin/export            a full backup (admins): the database and every place
//   GET/POST /admin/closing       { on, days | at, message, endEvents }
const CLOSE_AT = Date.UTC(2026, 9, 30, 20, 59); // October 30, 23:59 Moscow time

export function installClosing(api, { db, manager, requireUser, requireAdmin, bad, hooks }) {
  const D = db.data;
  if (!D.settings) D.settings = {};
  const S = D.settings.closing || (D.settings.closing = { on: false, at: CLOSE_AT, message: '' });
  const testing = !!process.env.NODE_TEST_CONTEXT;

  // every event ends: The Hunt, Halloween, Robis Awards, sales, Admin Abuse, boosts, decorations
  const endEvents = () => {
    const now = Date.now();
    if (D.halloween) D.halloween.on = false;
    if (manager && manager.hunt && manager.hunt.endNow) manager.hunt.endNow('Robis is closing');
    if (hooks.awardsEnd) hooks.awardsEnd();
    for (const s of D.sales || []) if (s.ends > now) { s.ends = now; if (s.starts > now) s.starts = now; }
    const F = D.fun || {};
    if (F.abuse) F.abuse.ends = now; // its timer ends it in the games
    if (F.spin) F.spin.boost = null;
    if (F.decor) F.decor = { name: 'none', until: 0 };
    if (D.settings.progress) D.settings.progress.boost = null;
    S.eventsEnded = now;
    db.save();
  };
  // it starts once by itself (not in the tests)
  if (!S.started && !testing) { S.started = true; S.on = true; S.at = S.at || CLOSE_AT; endEvents(); }

  const info = () => (S.on ? { at: S.at, message: S.message || '' } : null);
  if (manager) manager.closing = info;
  hooks.closingInfo = info;

  // ---------------------------------------------------------------- my data
  const file = (res, name, data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(JSON.stringify(data, null, 1));
  };
  const itemView = (id) => { const it = D.items[id]; return it ? { id: it.id, name: it.name, type: it.type, data: it.data } : { id, name: '(deleted item)' }; };
  const name = (id) => (D.users[id] ? D.users[id].username : `#${id}`);
  const placesOf = (g) => {
    const out = { [g.id]: db.readPlace(g.id) };
    for (const p of Object.values(D.places || {})) if (p.gameId === g.id) out[p.id] = { name: p.name, place: db.readPlace(p.id) };
    return out;
  };
  api.get('/me/export', requireUser, (req, res) => {
    const u = req.user;
    const games = Object.values(D.games).filter((g) => g.creatorId === u.id);
    file(res, `robis-${u.username}-data.json`, {
      about: 'Your data from Robis. Your games are in "games" with their places (you can open the place JSON in a Robis Studio).',
      exported: new Date().toISOString(),
      account: {
        id: u.id, username: u.username, created: u.created ? new Date(u.created).toISOString() : null, robits: u.robits || 0,
        premium: u.membership || 'None', premiumUntil: u.membershipUntil ? new Date(u.membershipUntil).toISOString() : null,
        level: hooks.levelOf ? hooks.levelOf(u) : null, xp: u.xp || 0, blurb: u.blurb || '', status: u.status || '', candy: u.candy || 0,
        oldNames: u.oldNames || [], flags: u.flags || {},
      },
      avatar: u.avatar || null,
      outfits: u.outfits || [],
      inventory: (D.inventory[u.id] || []).map(itemView),
      wishlist: (u.wishlist || []).map(itemView),
      friends: (D.friends[u.id] || []).map(name),
      favorites: (D.favorites[u.id] || []).map((id) => (D.games[id] ? D.games[id].name : `#${id}`)),
      groups: Object.values(D.groups || {}).filter((gr) => gr.ownerId === u.id || (gr.members && gr.members[u.id])).map((gr) => ({ id: gr.id, name: gr.name, owner: gr.ownerId === u.id, role: gr.members ? gr.members[u.id] || null : null })),
      messages: (D.messages || []).filter((m) => m.to === u.id || m.from === u.id).slice(-1000)
        .map((m) => ({ from: name(m.from), to: name(m.to), subject: m.subject, body: m.body, sent: new Date(m.created).toISOString() })),
      transactions: (D.transactions || []).filter((t) => t.userId === u.id).map((t) => ({ amount: t.amount, desc: t.desc, time: new Date(t.time).toISOString() })),
      trades: (D.trades || []).filter((t) => t.from === u.id || t.to === u.id)
        .map((t) => ({ with: name(t.from === u.id ? t.to : t.from), gave: (t.from === u.id ? t.give : t.get).map(itemView), got: (t.from === u.id ? t.get : t.give).map(itemView), status: t.status })),
      games: games.map((g) => ({ id: g.id, name: g.name, description: g.description, visits: g.visits || 0, created: g.created ? new Date(g.created).toISOString() : null, places: placesOf(g) })),
    });
  });

  // ---------------------------------------------------------------- a full backup (admins)
  api.get('/admin/export', requireAdmin, (req, res) => {
    const data = { ...D, sessions: undefined };
    // no secrets in the file (bot tokens, Discord secret)
    if (data.settings) {
      data.settings = JSON.parse(JSON.stringify(data.settings));
      if (data.settings.tgbot) delete data.settings.tgbot.token;
      if (data.settings.discord) delete data.settings.discord.secret;
    }
    const places = {};
    for (const g of Object.values(D.games)) places[g.id] = db.readPlace(g.id);
    for (const p of Object.values(D.places || {})) places[p.id] = db.readPlace(p.id);
    file(res, `robis-backup-${new Date().toISOString().slice(0, 10)}.json`, { exported: new Date().toISOString(), data, places });
  });

  // ---------------------------------------------------------------- admin
  api.get('/admin/closing', requireAdmin, (req, res) => res.json({ ...S, info: info() }));
  api.post('/admin/closing', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.on !== undefined) S.on = !!b.on;
    if (b.days !== undefined && +b.days > 0) S.at = Date.now() + Math.min(365, +b.days) * 86400e3;
    if (b.at !== undefined && +b.at > 0) S.at = +b.at;
    if (b.message !== undefined) S.message = String(b.message).trim().slice(0, 500);
    if (b.endEvents) endEvents();
    db.save();
    res.json({ ...S, info: info() });
  });
}
