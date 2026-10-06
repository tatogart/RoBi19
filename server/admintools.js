// Admin Panel 2.0 tools: find any item and put it in a player's inventory,
// mass gifts, set Robits exactly, warnings, staff notes on accounts, player
// reports, the live activity feed and "join the server a player is on".
import { officialAccount } from './seed/seed.js';

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

export function installAdminTools(api, ctx) {
  const { db, manager, requireUser, requireStaff, requireAdmin, requirePerm, requireOpt, bad, log, giveSerial, takeItem, presence, isBanned, adminUser, popt, MEMBERSHIPS } = ctx;
  const D = db.data;
  if (!D.staffNotes) D.staffNotes = {};
  if (!D.reports) D.reports = [];
  const official = () => officialAccount(D);
  const users = () => Object.values(D.users).filter((u) => !u.system);
  const target = (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) { bad(res, 'User not found', 404); return null; }
    return u;
  };
  const inbox = (to, subject, body) => {
    D.messages.push({ id: db.nextId('message'), from: official()?.id || 0, to, subject, body, created: Date.now(), read: false, system: true });
  };
  // a live message to a player who is in a game right now
  const live = (uid, msg) => {
    const f = manager.findUser(uid);
    if (f) f.server.send(f.session, msg);
    return !!f;
  };
  const owners = (itemId) => {
    let n = 0;
    for (const inv of Object.values(D.inventory)) if (inv.includes(itemId)) n++;
    return n;
  };
  const itemRow = (it) => ({
    id: it.id, name: it.name, type: it.type, data: it.data, price: it.price || 0, offsale: !!it.offsale, limited: !!it.limited,
    remaining: it.limited ? it.remaining ?? null : null, custom: !!it.custom, creator: D.users[it.creatorId]?.username || 'Robis',
  });

  // ---------------------------------------------------------------- items
  // Every item, also the ones not for sale (event prizes, old items).
  api.get('/admin/items/search', requireStaff, (req, res) => {
    const q = clean(req.query.q, 60).toLowerCase();
    const type = String(req.query.type || '');
    const list = Object.values(D.items)
      .filter((it) => (!q || it.name.toLowerCase().includes(q) || String(it.id) === q) && (!type || it.type === type))
      .sort((a, b) => (q && a.name.toLowerCase().startsWith(q) ? -1 : 0) - (q && b.name.toLowerCase().startsWith(q) ? -1 : 0) || b.id - a.id)
      .slice(0, Math.min(200, +req.query.limit || 60));
    res.json({ items: list.map((it) => ({ ...itemRow(it), owners: owners(it.id) })), types: [...new Set(Object.values(D.items).map((i) => i.type))].sort() });
  });

  // Put items in a player's inventory: { itemIds: [..] }
  api.post('/admin/users/:id/give', requirePerm('economy'), requireOpt('economy', 'giveItems'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const ids = [...new Set((Array.isArray(req.body?.itemIds) ? req.body.itemIds : []).map((x) => +x))].filter((id) => D.items[id]).slice(0, 100);
    if (!ids.length) return bad(res, 'Pick at least one item.');
    const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
    const given = [];
    for (const id of ids) {
      if (inv.includes(id)) continue;
      inv.push(id);
      giveSerial(D.items[id], u.id);
      given.push(D.items[id].name);
    }
    if (given.length && req.body?.notify !== false) {
      inbox(u.id, 'You got new items!', `The Robis team gave you: ${given.join(', ')}.${req.body?.note ? '\n\n' + clean(req.body.note, 300) : ''}`);
      live(u.id, { t: 'sys', text: `[Robis] You got: ${given.join(', ')}` });
    }
    db.save();
    res.json({ user: adminUser(u), given, already: ids.length - given.length });
  });

  // Robits set to an exact number.
  api.post('/admin/users/:id/robitsset', requirePerm('economy'), requireOpt('economy', 'robits'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const value = Math.trunc(+req.body?.value);
    if (!(value >= 0 && value <= 1e9)) return bad(res, 'Robits: between 0 and 1,000,000,000.');
    const diff = value - u.robits;
    const max = popt(req.user, 'economy', 'maxRobits');
    if (Math.abs(diff) > max) return bad(res, `You can give or take at most R$ ${max.toLocaleString('en-US')} at once.`, 403);
    u.robits = value;
    if (diff) log(u.id, diff, `Set to R$ ${value.toLocaleString('en-US')} by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  // ---------------------------------------------------------------- gift center
  // Gifts for many players at once: items, Robits and/or Builders Club.
  // { to: 'all' | 'online' | 'names', names: 'a, b', itemIds, robits, membership, days, message }
  const recipients = (b) => {
    if (b.to === 'names') {
      const names = String(b.names || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      const found = users().filter((u) => names.includes(u.username.toLowerCase()));
      const missing = names.filter((n) => !found.some((u) => u.username.toLowerCase() === n));
      return { list: found, missing };
    }
    const list = users().filter((u) => !isBanned(u) && (b.to !== 'online' || presence(u).status !== 'offline'));
    return { list, missing: [] };
  };
  api.post('/admin/gift/preview', requireAdmin, (req, res) => {
    const r = recipients(req.body || {});
    res.json({ count: r.list.length, missing: r.missing, sample: r.list.slice(0, 12).map((u) => u.username) });
  });
  api.post('/admin/gift', requireAdmin, (req, res) => {
    const b = req.body || {};
    const { list, missing } = recipients(b);
    if (!list.length) return bad(res, missing.length ? `No players named: ${missing.join(', ')}` : 'Nobody to give it to.');
    const ids = [...new Set((Array.isArray(b.itemIds) ? b.itemIds : []).map((x) => +x))].filter((id) => D.items[id]).slice(0, 50);
    const robits = Math.max(0, Math.min(1e6, Math.trunc(+b.robits || 0)));
    const tier = MEMBERSHIPS[b.membership] && b.membership !== 'None' ? b.membership : null;
    const days = Math.max(0, Math.min(3650, Math.trunc(+b.days || 0)));
    if (!ids.length && !robits && !tier) return bad(res, 'Add items, Robits or Builders Club.');
    const message = clean(b.message, 500);
    const what = [...ids.map((id) => D.items[id].name), robits ? `R$ ${robits.toLocaleString('en-US')}` : '', tier ? `${MEMBERSHIPS[tier].name}${days ? ` for ${days} days` : ''}` : ''].filter(Boolean);
    for (const u of list) {
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      for (const id of ids) if (!inv.includes(id)) { inv.push(id); giveSerial(D.items[id], u.id); }
      if (robits) { u.robits += robits; log(u.id, robits, message ? `Gift: ${message.slice(0, 60)}` : `Gift from the Robis team`); }
      if (tier) {
        u.membership = tier;
        u.membershipUntil = days ? Math.max(Date.now(), u.membershipUntil || 0) + days * 86400e3 : 0;
      }
      inbox(u.id, 'A gift from the Robis team!', `You got: ${what.join(', ')}.${message ? '\n\n' + message : ''}`);
      live(u.id, { t: 'sys', text: `[Robis] A gift for you: ${what.join(', ')}!` });
    }
    D.adminLog.push({ time: Date.now(), by: req.user.id, byName: req.user.username, action: `Gift to ${list.length} players: ${what.join(', ')}`, targetId: null, targetName: b.to === 'names' ? list.map((u) => u.username).join(', ').slice(0, 80) : b.to });
    db.save();
    res.json({ players: list.length, missing, gift: what });
  });

  // ---------------------------------------------------------------- warnings
  // A warning: the player sees it in a popup (site and game) and in their inbox.
  api.post('/admin/users/:id/warn', requirePerm('moderator'), requireOpt('moderator', 'warn'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const reason = clean(req.body?.reason, 300);
    if (!reason) return bad(res, 'Write what the warning is for.');
    u.warnings = u.warnings || [];
    u.warnings.push({ reason, by: req.user.id, byName: req.user.username, time: Date.now() });
    // a warning with an upload ban at once (Create: no more items)
    if (req.body?.uploadBan && ctx.hooks && ctx.hooks.banUploads) ctx.hooks.banUploads(u, req.body.uploadBan, reason);
    inbox(u.id, 'A warning from the Robis team', `You got a warning: ${reason}\n\nPlease follow the rules. More warnings can lead to a ban.${u.uploadBanUntil > Date.now() ? '\n\nYou also can\'t upload items for now.' : ''}`);
    // in a game: a popup there; otherwise the next page they open shows it
    if (live(u.id, { t: 'warning', reason, count: u.warnings.length })) delete u.pendingWarning;
    else u.pendingWarning = { reason, time: Date.now(), count: u.warnings.length };
    db.save();
    res.json({ user: adminUser(u), warnings: u.warnings.length });
  });
  // the player saw the warning popup
  api.post('/me/warning/seen', requireUser, (req, res) => {
    delete req.user.pendingWarning;
    db.save();
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- staff notes
  api.get('/admin/users/:id/notes', requireStaff, (req, res) => {
    const u = target(req, res); if (!u) return;
    res.json({ notes: (D.staffNotes[u.id] || []).slice().reverse(), warnings: (u.warnings || []).slice().reverse() });
  });
  api.post('/admin/users/:id/notes', requireStaff, (req, res) => {
    const u = target(req, res); if (!u) return;
    const list = D.staffNotes[u.id] || (D.staffNotes[u.id] = []);
    if (req.body?.remove) {
      const i = list.findIndex((n) => n.id === +req.body.remove);
      if (i < 0) return bad(res, 'Note not found.', 404);
      if (list[i].by !== req.user.id && !req.user.isAdmin) return bad(res, 'Only its author or an admin can delete a note.', 403);
      list.splice(i, 1);
    } else {
      const text = clean(req.body?.text, 500);
      if (!text) return bad(res, 'Write the note.');
      list.push({ id: (list.at(-1)?.id || 0) + 1, text, by: req.user.id, byName: req.user.username, time: Date.now() });
      if (list.length > 100) list.shift();
    }
    db.save();
    res.json({ notes: list.slice().reverse() });
  });

  // ---------------------------------------------------------------- reports
  // Players report someone (profile page); moderators handle the queue.
  const REASONS = ['Bad words or bullying', 'Cheating or exploiting', 'Scam or stealing', 'Inappropriate username or avatar', 'Spam', 'Something else'];
  api.get('/reports/reasons', (req, res) => res.json({ reasons: REASONS }));
  api.post('/reports', requireUser, (req, res) => {
    const b = req.body || {};
    const t = D.users[+b.userId];
    if (!t || t.system) return bad(res, 'Player not found.', 404);
    if (t.id === req.user.id) return bad(res, 'You can\'t report yourself.');
    if (!REASONS.includes(b.reason)) return bad(res, 'Pick a reason.');
    const mine = D.reports.filter((r) => r.from === req.user.id && Date.now() - r.time < 3600e3);
    if (mine.length >= 5) return bad(res, 'You sent a lot of reports. Try again later.', 429);
    if (D.reports.some((r) => r.from === req.user.id && r.userId === t.id && r.status === 'open')) return bad(res, 'You already reported this player. The team will look at it.');
    D.reports.push({ id: (D.reports.at(-1)?.id || 0) + 1, from: req.user.id, userId: t.id, reason: b.reason, details: clean(b.details, 500), time: Date.now(), status: 'open' });
    if (D.reports.length > 2000) D.reports.splice(0, 200);
    db.save();
    res.json({ ok: true });
  });
  const reportRow = (r) => ({
    ...r, fromName: D.users[r.from]?.username || '?', user: D.users[r.userId] ? adminUser(D.users[r.userId]) : null,
    handledName: r.handledBy ? D.users[r.handledBy]?.username || '?' : null,
    reportsOnUser: D.reports.filter((x) => x.userId === r.userId).length,
  });
  api.get('/admin/reports', requirePerm('moderator'), (req, res) => {
    const status = ['open', 'resolved', 'dismissed', 'all'].includes(req.query.status) ? req.query.status : 'open';
    const list = D.reports.filter((r) => status === 'all' || r.status === status).slice(-200).reverse();
    res.json({ reports: list.map(reportRow), open: D.reports.filter((r) => r.status === 'open').length });
  });
  api.post('/admin/reports/:rid', requirePerm('moderator'), (req, res) => {
    const r = D.reports.find((x) => x.id === +req.params.rid);
    if (!r) return bad(res, 'Report not found.', 404);
    const status = req.body?.status;
    if (!['open', 'resolved', 'dismissed'].includes(status)) return bad(res, 'Unknown status.');
    Object.assign(r, { status, note: clean(req.body?.note, 300), handledBy: req.user.id, handledAt: Date.now() });
    // closing a report closes the other open ones about the same player too
    if (req.body?.all) for (const x of D.reports) if (x.userId === r.userId && x.status === 'open') Object.assign(x, { status, handledBy: req.user.id, handledAt: Date.now() });
    if (status !== 'open' && D.users[r.from] && !req.body?.silent) {
      inbox(r.from, 'Thanks for your report', `We looked at your report about ${D.users[r.userId]?.username || 'a player'}${status === 'resolved' ? ' and took action' : ''}. Thanks for helping keep Robis safe!`);
    }
    D.adminLog.push({ time: Date.now(), by: req.user.id, byName: req.user.username, action: `Report #${r.id} ${status}${r.note ? ': ' + r.note.slice(0, 80) : ''}`, targetId: r.userId, targetName: D.users[r.userId]?.username || '' });
    db.save();
    res.json({ report: reportRow(r) });
  });

  // ---------------------------------------------------------------- live
  // The numbers in the top bar of the Admin Panel, every few seconds.
  api.get('/admin/live', requireStaff, (req, res) => {
    let online = 0;
    for (const u of users()) if (presence(u).status !== 'offline') online++;
    const servers = manager.allServers().filter((s) => !s.closed);
    res.json({
      online, playing: servers.reduce((n, s) => n + s.playerCount, 0), servers: servers.length,
      reports: D.reports.filter((r) => r.status === 'open').length, time: Date.now(),
    });
  });
  // Where a player is: join their server to watch.
  api.get('/admin/users/:id/where', requireStaff, (req, res) => {
    const u = target(req, res); if (!u) return;
    const f = manager.findUser(u.id);
    if (!f) return bad(res, `${u.username} is not in a game.`);
    res.json({ gameId: f.server.gameId, serverId: f.server.id, place: f.server.subPlace || 0, name: f.server.name });
  });

  // ---------------------------------------------------------------- activity
  // What happened on Robis lately: new players, purchases and gifts, admin
  // actions, reports, bans.
  api.get('/admin/activity', requireStaff, (req, res) => {
    const since = Date.now() - 7 * 86400e3;
    const out = [];
    for (const u of users()) if (u.created > since) out.push({ time: u.created, kind: 'signup', text: 'joined Robis', userId: u.id, username: u.username });
    for (const t of D.transactions.slice(-600)) {
      if (t.time < since || !t.amount) continue;
      const u = D.users[t.userId];
      if (!u || u.system) continue;
      out.push({ time: t.time, kind: t.amount > 0 ? 'earn' : 'spend', text: t.desc, amount: t.amount, userId: u.id, username: u.username });
    }
    for (const e of D.adminLog.slice(-200)) if (e.time > since) out.push({ time: e.time, kind: /ban/i.test(e.action) ? 'ban' : 'admin', text: e.action, byName: e.byName, userId: e.targetId, username: e.targetName });
    for (const r of D.reports.slice(-100)) if (r.time > since) out.push({ time: r.time, kind: 'report', text: `reported for: ${r.reason}`, userId: r.userId, username: D.users[r.userId]?.username || '?', byName: D.users[r.from]?.username || '?' });
    out.sort((a, b) => b.time - a.time);
    const kind = String(req.query.kind || '');
    res.json({ events: out.filter((e) => !kind || e.kind === kind).slice(0, 150) });
  });
}
