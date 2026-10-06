// Control Center 5.0 "Classic": the old-school player tools (one click each,
// like the admin panel of 2010s) and site tools for the whole world.
//   POST /admin/users/:id/tool { op, ... }   one player
//   GET  /admin/tools                        world numbers + tool settings
//   POST /admin/tools { op, ... }            the whole site
//   GET  /admin/tools/users.csv              every account as a table
import { officialAccount } from './seed/seed.js';
import { siteSettings } from './adminplus.js';

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function installClassic(api, ctx) {
  const { db, manager, requireAdmin, requirePerm, bad, log, hooks, adminUser, deleteAccount, STARTER } = ctx;
  const D = db.data;
  const S = siteSettings(D);
  if (!Array.isArray(S.nameBlacklist)) S.nameBlacklist = [];
  if (typeof S.welcome !== 'string') S.welcome = '';
  const official = () => officialAccount(D);
  const inbox = (to, subject, body) => {
    D.messages.push({ id: db.nextId('message'), from: official()?.id || 0, to, subject, body, created: Date.now(), read: false, system: true });
  };
  const itemIds = (names) => Object.values(D.items).filter((i) => !i.custom && names.includes(i.name)).map((i) => i.id);

  // usernames with a blocked word can't be picked (sign up, rename)
  hooks.nameBlocked = (name) => {
    const n = String(name || '').toLowerCase();
    return S.nameBlacklist.some((w) => w && n.includes(w));
  };
  // a message in the inbox of every new account
  hooks.welcome = (u) => { if (S.welcome) inbox(u.id, 'Welcome to Robis!', S.welcome); };

  // ---------------------------------------------------------------- one player
  // ops anyone with the Moderator right can use; the rest are for admins
  const MOD_OPS = new Set(['wipeProfile', 'contentDeleted', 'systemMessage', 'clearMessages', 'clearWarnings', 'cancelTrades', 'lockName', 'kickFromGame']);
  const PLAYER_OPS = {
    // the starter look again (Bacon Hair, Smile, hoodie, jeans)
    resetAvatar(u) {
      const wear = itemIds(STARTER.wearing);
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      for (const id of wear) if (!inv.includes(id)) inv.push(id);
      u.avatar = { bodyColors: { ...STARTER.body }, wearing: wear };
      return 'Avatar reset';
    },
    wipeProfile(u) { u.blurb = ''; u.status = ''; return 'Profile wiped'; },
    // the classic: [ Content Deleted ]
    contentDeleted(u) {
      u.previousNames = [u.username, ...(u.previousNames || [])].slice(0, 10);
      u.username = 'ContentDeleted_' + u.id;
      u.blurb = '[ Content Deleted ]'; u.status = '';
      u.nameLocked = true;
      return 'Renamed to ' + u.username;
    },
    resetBadges(u) { delete D.badges[u.id]; return 'Game badges reset'; },
    clearFriends(u) {
      for (const f of D.friends[u.id] || []) D.friends[f] = (D.friends[f] || []).filter((x) => x !== u.id);
      D.friends[u.id] = [];
      D.friendRequests = D.friendRequests.filter((r) => r.from !== u.id && r.to !== u.id);
      return 'Friends cleared';
    },
    resetStipend(u) { u.lastStipend = 0; return 'Daily stipend can be claimed again'; },
    unpublishGames(u) {
      let n = 0;
      for (const g of Object.values(D.games)) if (g.creatorId === u.id && g.isPublic) { g.isPublic = false; n++; }
      return `${n} game(s) made private`;
    },
    deleteItems(u) {
      const mine = Object.values(D.items).filter((i) => i.custom && i.creatorId === u.id && !(i.limited && i.sales > 0));
      for (const it of mine) hooks.removeItem(it);
      return `${mine.length} uploaded item(s) deleted`;
    },
    lockName(u) { u.nameLocked = !u.nameLocked; return u.nameLocked ? 'Username locked' : 'Username unlocked'; },
    setTitle(u, b) { u.adminTitle = clean(b.title, 30); return u.adminTitle ? `Title: ${u.adminTitle}` : 'Title removed'; },
    systemMessage(u, b) {
      const body = clean(b.body, 1000);
      if (!body) throw new Error('Write the message.');
      inbox(u.id, clean(b.subject, 80) || 'A message from the Robis team', body);
      return 'Message sent';
    },
    clearMessages(u) {
      const before = D.messages.length;
      D.messages = D.messages.filter((m) => m.from !== u.id);
      return `${before - D.messages.length} sent message(s) deleted`;
    },
    clearWarnings(u) { u.warnings = []; delete u.pendingWarning; return 'Warnings cleared'; },
    cancelTrades(u) {
      let n = 0;
      for (const t of D.trades || []) if ((t.from === u.id || t.to === u.id) && t.status === 'pending') { t.status = 'cancelled'; t.updated = Date.now(); n++; }
      return `${n} open trade(s) cancelled`;
    },
    clearOutfits(u) { u.outfits = []; return 'Saved outfits deleted'; },
    clearWishlist(u) { u.wishlist = []; return 'Wishlist cleared'; },
    starterItems(u) {
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      let n = 0;
      for (const id of itemIds(STARTER.items)) if (!inv.includes(id)) { inv.push(id); n++; }
      return `${n} starter item(s) given back`;
    },
    // the admin wears this player's look
    copyLook(u, b, by) {
      by.avatar = JSON.parse(JSON.stringify(u.avatar || {}));
      const inv = D.inventory[by.id] || (D.inventory[by.id] = []);
      for (const id of by.avatar.wearing || []) if (!inv.includes(id)) inv.push(id);
      return 'You now wear their look';
    },
    kickFromGame(u, b) {
      const f = manager.findUser(u.id);
      if (!f) throw new Error('They are not in a game.');
      f.server.kick(f.session, clean(b.reason, 200) || 'You were kicked by the Robis team.');
      return 'Kicked from the game';
    },
  };
  api.post('/admin/users/:id/tool', requirePerm('moderator'), (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) return bad(res, 'User not found', 404);
    const b = req.body || {};
    const fn = PLAYER_OPS[b.op];
    if (!fn) return bad(res, 'Unknown tool.');
    if (!req.user.isAdmin && !MOD_OPS.has(b.op)) return bad(res, 'Only admins can use this tool.', 403);
    if (u.isAdmin && !req.user.isAdmin) return bad(res, 'Only admins can do this to an admin.', 403);
    if (u.id === req.user.id && ['contentDeleted', 'kickFromGame', 'copyLook'].includes(b.op)) return bad(res, 'Not on yourself.');
    let msg;
    try { msg = fn(u, b, req.user); } catch (e) { return bad(res, e.message); }
    log(u.id, 0, `${msg} (by ${req.user.username})`);
    db.save();
    res.json({ ok: true, message: msg, user: adminUser(u) });
  });

  // ---------------------------------------------------------------- alt accounts
  // Groups of accounts that were used on the same device and/or IP
  // (?by=device|ip|both, ?q=name to find one player's group). An IP that
  // dozens of accounts share is a school or a phone network: left out.
  const mask = (ip) => { const p = String(ip).split('.'); return p.length === 4 ? `${p[0]}.${p[1]}.*.*` : String(ip).slice(0, 9) + '…'; };
  api.get('/admin/alts', requirePerm('moderator'), (req, res) => {
    const by = ['device', 'ip', 'both'].includes(req.query.by) ? req.query.by : 'both';
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = Object.values(D.users).filter((u) => !u.system && !u.bot);
    const keyUsers = new Map(); // "d:..." / "i:..." -> users
    for (const u of list) {
      if (by !== 'ip') for (const d of u.devices || []) { const k = 'd:' + d; if (!keyUsers.has(k)) keyUsers.set(k, []); keyUsers.get(k).push(u); }
      if (by !== 'device') for (const i of u.ips || []) { if (i === '127.0.0.1' || i === '::1') continue; const k = 'i:' + i; if (!keyUsers.has(k)) keyUsers.set(k, []); keyUsers.get(k).push(u); }
    }
    // union-find: accounts linked by any shared key end up in one group
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const u of list) parent.set(u.id, u.id);
    let bigNetworks = 0;
    for (const [k, us] of keyUsers) {
      if (us.length < 2) continue;
      if (k.startsWith('i:') && us.length > 15) { bigNetworks++; continue; }
      for (let i = 1; i < us.length; i++) { const a = find(us[0].id), b = find(us[i].id); if (a !== b) parent.set(a, b); }
    }
    const groups = new Map();
    for (const u of list) { const r = find(u.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(u); }
    const out = [];
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      if (q && !members.some((u) => u.username.toLowerCase().includes(q))) continue;
      const ids = new Set(members.map((u) => u.id));
      const shared = [];
      for (const [k, us] of keyUsers) {
        const inGroup = us.filter((u) => ids.has(u.id));
        if (inGroup.length < 2 || (k.startsWith('i:') && us.length > 15)) continue;
        shared.push({ kind: k[0] === 'd' ? 'device' : 'ip', label: k[0] === 'd' ? 'Device ' + k.slice(2, 8) : 'IP ' + mask(k.slice(2)), users: inGroup.map((u) => u.username) });
      }
      out.push({
        size: members.length, banned: members.filter((u) => ctx.isBanned(u)).length,
        members: members.sort((a, b) => a.created - b.created).map((u) => ({ id: u.id, username: u.username, created: u.created, lastOnline: u.lastOnline || 0, banned: ctx.isBanned(u), guest: !!u.guest, isAdmin: !!u.isAdmin, robits: u.robits || 0 })),
        shared: shared.slice(0, 12),
      });
    }
    out.sort((a, b) => b.banned - a.banned || b.size - a.size);
    res.json({ groups: out.slice(0, 100), total: out.length, bigNetworks });
  });

  // ---------------------------------------------------------------- the whole site
  const accounts = () => Object.values(D.users).filter((u) => !u.system);
  api.get('/admin/tools', requireAdmin, (req, res) => {
    const all = accounts();
    const people = all.filter((u) => !u.bot && !u.guest);
    const dayAgo = Date.now() - 86400e3;
    let dbSize = 0;
    try { dbSize = JSON.stringify(D).length; } catch { /* too big to measure */ }
    res.json({
      stats: {
        players: people.length, guests: all.filter((u) => u.guest).length, bots: all.filter((u) => u.bot).length,
        newToday: people.filter((u) => u.created > dayAgo).length, onlineToday: people.filter((u) => (u.lastOnline || 0) > dayAgo).length,
        items: Object.keys(D.items).length, playerItems: Object.values(D.items).filter((i) => i.custom).length,
        games: Object.keys(D.games).length, publicGames: Object.values(D.games).filter((g) => g.isPublic).length,
        messages: D.messages.length, sessions: Object.keys(D.sessions).length, trades: (D.trades || []).length,
        robits: people.reduce((a, u) => a + (u.robits || 0), 0), servers: manager.allServers().length, dbSize,
      },
      richest: people.slice().sort((a, b) => (b.robits || 0) - (a.robits || 0)).slice(0, 10).map((u) => ({ id: u.id, username: u.username, robits: u.robits || 0 })),
      newest: people.slice().sort((a, b) => b.created - a.created).slice(0, 10).map((u) => ({ id: u.id, username: u.username, created: u.created })),
      settings: { guests: S.guests !== false, nameBlacklist: S.nameBlacklist, welcome: S.welcome },
    });
  });
  const SITE_OPS = {
    deleteGuests() { const g = accounts().filter((u) => u.guest && !manager.findUser(u.id)); for (const u of g) deleteAccount(u); return `${g.length} guest account(s) deleted`; },
    guests(b) { S.guests = !!b.on; return b.on ? 'Guest play is on' : 'Guest play is off'; },
    resetStipends() { for (const u of accounts()) u.lastStipend = 0; return 'Everyone can claim the stipend again'; },
    purgeSessions() {
      let n = 0;
      for (const [t, s] of Object.entries(D.sessions)) if (s.expires < Date.now() || !D.users[s.userId]) { delete D.sessions[t]; n++; }
      return `${n} old session(s) removed`;
    },
    purgeMessages(b) {
      const days = Math.max(7, Math.min(3650, Math.trunc(+b.days || 90)));
      const before = D.messages.length;
      D.messages = D.messages.filter((m) => (m.created || 0) > Date.now() - days * 86400e3);
      return `${before - D.messages.length} message(s) older than ${days} days deleted`;
    },
    clearChatlog() { if (D.chatlog) D.chatlog.length = 0; return 'Chat log cleared'; },
    shutdownAll(b) {
      const list = manager.allServers().filter((s) => !s.isTest);
      for (const s of list) s.close(clean(b.reason, 200) || 'Robis is restarting. Come back in a minute!');
      return `${list.length} server(s) shut down`;
    },
    // official catalog prices up or down (Limiteds and player items stay)
    bulkPrice(b) {
      const pct = Math.trunc(+b.percent || 0);
      if (!pct || pct < -90 || pct > 500) throw new Error('Pick a change between -90% and +500%.');
      let n = 0;
      for (const it of Object.values(D.items)) {
        if (it.custom || it.limited || it.offsale || !it.price) continue;
        it.price = Math.max(1, Math.round(it.price * (1 + pct / 100)));
        n++;
      }
      return `${n} price(s) changed by ${pct > 0 ? '+' : ''}${pct}%`;
    },
    nameBlacklist(b) {
      const words = [...new Set(String(b.words || '').toLowerCase().split(/[\s,]+/).map((w) => w.replace(/[^a-z0-9_]/g, '')).filter((w) => w.length >= 2))].slice(0, 200);
      S.nameBlacklist = words;
      return `${words.length} blocked word(s) in usernames`;
    },
    welcome(b) { S.welcome = clean(b.text, 1000); return S.welcome ? 'Welcome message saved' : 'Welcome message off'; },
    clearAnnouncement() { D.announcement = null; return 'Announcement removed'; },
  };
  api.post('/admin/tools', requireAdmin, (req, res) => {
    const b = req.body || {};
    const fn = SITE_OPS[b.op];
    if (!fn) return bad(res, 'Unknown tool.');
    let msg;
    try { msg = fn(b); } catch (e) { return bad(res, e.message); }
    db.save();
    res.json({ ok: true, message: msg });
  });
  // every account in a table (for a spreadsheet)
  api.get('/admin/tools/users.csv', requireAdmin, (req, res) => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['id', 'username', 'created', 'lastOnline', 'robits', 'membership', 'admin', 'banned', 'guest', 'bot'].join(',')];
    for (const u of accounts()) rows.push([u.id, q(u.username), new Date(u.created).toISOString(), u.lastOnline ? new Date(u.lastOnline).toISOString() : '', u.robits || 0, u.membership || 'None', u.isAdmin ? 1 : 0, ctx.isBanned(u) ? 1 : 0, u.guest ? 1 : 0, u.bot ? 1 : 0].join(','));
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="robis-users.csv"');
    res.send(rows.join('\n'));
  });
}
