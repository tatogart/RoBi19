// REST API for the Robis website, Studio and client.
import crypto from 'node:crypto';
import express from 'express';
import {
  checkPassword, createSession, destroySession, sessionCookie, validUsername, COOKIE, parseCookies, bannedClient, noteClient,
} from './auth.js';
import { createUser, addSeedGames } from './seed/seed.js';
import { TEMPLATES } from './seed/places.js';
import { normalizeAvatar, WEAR_LIMITS, ITEM_TYPES } from '../shared/avatar.js';
import { PLACE_FORMAT } from '../shared/engine/serialize.js';

const ONLINE_MS = 2 * 60 * 1000;
const STIPEND_MS = 24 * 3600 * 1000;

// Builders Club tiers (2019 names). Only admins can hand them out.
export const MEMBERSHIPS = {
  None: { name: 'Classic', stipend: 25 },
  BuildersClub: { name: 'Builders Club', short: 'BC', stipend: 40 },
  TurboBuildersClub: { name: 'Turbo Builders Club', short: 'TBC', stipend: 60 },
  OutrageousBuildersClub: { name: 'Outrageous Builders Club', short: 'OBC', stipend: 85 },
};
const ADMIN_ROBITS = 1_000_000;

// opts.firstUserIsAdmin: the first account on a fresh server becomes admin (shared server).
// opts.adminCodeHash: sha256 of a secret admin code; entering it makes any account an admin.
// opts.requireAdminCode: only code-verified accounts may stay admins (phone build, where
//   every device is its own "server" and anyone would otherwise be first).
export function createApi(db, manager, opts = {}) {
  const firstUserIsAdmin = opts.firstUserIsAdmin !== false;
  const adminCodeHash = (opts.adminCodeHash || '').trim().toLowerCase();
  const api = express.Router();
  const D = db.data;

  // Admins get the full owner experience: Robits, OBC and every catalog item.
  const grantAdminPerks = (u) => {
    if (!u || !u.isAdmin || u.adminPerks || u.system) return;
    u.adminPerks = true;
    u.robits = (u.robits || 0) + ADMIN_ROBITS;
    u.membership = 'OutrageousBuildersClub';
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...Object.keys(D.items).map(Number)])];
    D.transactions.push({ userId: u.id, amount: ADMIN_ROBITS, desc: 'Admin bonus', time: Date.now() });
    db.save();
  };
  const revokeAdmin = (u) => {
    if (!u.isAdmin) return;
    u.isAdmin = false;
    if (u.adminPerks) {
      u.adminPerks = false;
      u.robits = Math.max(0, (u.robits || 0) - ADMIN_ROBITS);
      u.membership = 'None';
      D.transactions.push({ userId: u.id, amount: -ADMIN_ROBITS, desc: 'Admin bonus removed', time: Date.now() });
    }
    db.save();
  };
  // Phone build: anyone who became admin just by signing up first loses it.
  if (opts.requireAdminCode) for (const u of Object.values(D.users)) if (u.isAdmin && !u.adminByCode) revokeAdmin(u);
  // Also for admins created before perks existed.
  for (const u of Object.values(D.users)) grantAdminPerks(u);
  // New showcase places reach existing worlds too.
  addSeedGames(db);

  // The free Robits packs and self-service Builders Club are gone: take back
  // what players gave themselves (runs once per database).
  if (!D.meta.freeDonateRevoked) {
    D.meta.freeDonateRevoked = true;
    const now = Date.now();
    for (const u of Object.values(D.users)) {
      let bought = 0;
      let selfJoined = false;
      for (const t of D.transactions) {
        if (t.userId !== u.id) continue;
        const m = /^Bought ([\d,]+) Robits$/.exec(t.desc);
        if (m) bought += +m[1].replace(/,/g, '');
        else if (/^Joined /.test(t.desc)) selfJoined = true;
        else if (t.desc === 'Cancelled membership' || /^Membership set by /.test(t.desc)) selfJoined = false;
      }
      if (bought) {
        const take = Math.min(bought, u.robits);
        u.robits -= take;
        D.transactions.push({ userId: u.id, amount: -take, desc: 'Free Robits removed', time: now });
      }
      if (selfJoined && !u.adminPerks && u.membership && u.membership !== 'None') {
        D.transactions.push({ userId: u.id, amount: 0, desc: `Free ${MEMBERSHIPS[u.membership]?.name || 'membership'} removed`, time: now });
        u.membership = 'None';
      }
    }
    db.save();
  }

  // Bans an account together with the devices and IPs it used, except ones
  // an admin also uses (so the owner's own phone or Wi-Fi never gets banned).
  const setBan = (u, banned, reason) => {
    u.banned = banned;
    u.banReason = banned ? String(reason || '').slice(0, 200) : '';
    if (banned) {
      const admins = Object.values(D.users).filter((a) => a.isAdmin);
      const safe = (key) => new Set(admins.flatMap((a) => a[key] || []));
      const dev = safe('devices');
      const ips = safe('ips');
      u.bannedDevices = (u.devices || []).filter((d) => !dev.has(d));
      u.bannedIps = (u.ips || []).filter((i) => !ips.has(i));
      for (const [t, s] of Object.entries(D.sessions)) if (s.userId === u.id) delete D.sessions[t];
      const f = manager.findUser(u.id);
      if (f) f.server.kick(f.session, `You have been banned.${u.banReason ? ' Reason: ' + u.banReason : ''}`);
      // Also kick other accounts playing from the banned device.
      for (const o of Object.values(D.users)) {
        if (o.isAdmin || o === u || !bannedClient(db, { device: o.devices?.[0], ip: '' })) continue;
        for (const [t, s] of Object.entries(D.sessions)) if (s.userId === o.id) delete D.sessions[t];
        const g = manager.findUser(o.id);
        if (g) g.server.kick(g.session, 'You have been banned.');
      }
    } else {
      u.bannedDevices = [];
      u.bannedIps = [];
    }
    db.save();
  };

  // Lets admins use :ban / :unban from the in-game chat.
  manager.admin = {
    findUser: (name) => Object.values(D.users).find((u) => !u.system && u.username.toLowerCase() === String(name).toLowerCase()) || null,
    ban: (u, banned, reason) => setBan(u, banned, reason),
  };

  // ------------------------------------------------------------ helpers
  const requireUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'You must be logged in.' });
    next();
  };
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
  const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

  const presence = (u) => {
    if (u.system) return { status: 'offline' };
    const s = manager.findUser(u.id);
    if (s) return { status: s.server.isTest ? 'studio' : 'ingame', gameId: s.server.isTest ? null : s.server.gameId };
    if (Date.now() - (u.lastOnline || 0) < ONLINE_MS) return { status: 'online' };
    return { status: 'offline', lastOnline: u.lastOnline };
  };

  const publicUser = (u, full = false) => {
    if (!u) return null;
    const out = {
      id: u.id, username: u.username, created: u.created, status: u.status || '',
      membership: u.membership || 'None', isAdmin: !!u.isAdmin, isSystem: !!u.system, presence: presence(u),
      avatar: resolvedAvatar(u),
    };
    if (full) {
      out.blurb = u.blurb || '';
      out.friendCount = (D.friends[u.id] || []).length;
      out.badges = (D.badges[u.id] || []).slice(-50);
      out.placeVisits = Object.values(D.games).filter((g) => g.creatorId === u.id).reduce((a, g) => a + g.visits, 0);
    }
    return out;
  };

  const resolvedAvatar = (u) => {
    const a = normalizeAvatar(u.avatar);
    return { bodyColors: a.bodyColors, items: a.wearing.map((id) => D.items[id]).filter(Boolean).map((i) => ({ id: i.id, name: i.name, type: i.type, data: i.data })) };
  };
  manager.resolveAvatar = resolvedAvatar;

  const stipendFor = (u) => (MEMBERSHIPS[u.membership] || MEMBERSHIPS.None).stipend;
  const me = (u) => ({
    ...publicUser(u, true), robits: u.robits, canClaimStipend: Date.now() - (u.lastStipend || 0) > STIPEND_MS,
    stipend: stipendFor(u), rawAvatar: normalizeAvatar(u.avatar),
  });

  const publicGame = (g, user) => {
    const creator = D.users[g.creatorId];
    const servers = manager.serversFor(g.id);
    const playing = servers.reduce((a, s) => a + s.playerCount, 0);
    const total = g.upVotes + g.downVotes;
    return {
      id: g.id, name: g.name, description: g.description, genre: g.genre,
      creator: creator ? { id: creator.id, username: creator.username } : null,
      created: g.created, updated: g.updated, visits: g.visits, maxPlayers: g.maxPlayers,
      isPublic: g.isPublic, playing, upVotes: g.upVotes, downVotes: g.downVotes,
      rating: total ? Math.round((g.upVotes / total) * 100) : null, favorites: g.favorites, featured: !!g.featured,
      copyable: !!g.copyable, hasThumbnail: db.hasThumb('game', g.id),
      myVote: user ? D.votes[`${g.id}:${user.id}`] || 0 : 0,
      isFavorite: user ? (D.favorites[user.id] || []).includes(g.id) : false,
      canEdit: user ? user.id === g.creatorId || user.isAdmin : false,
    };
  };

  const publicItem = (it, user) => {
    const creator = D.users[it.creatorId];
    return {
      id: it.id, name: it.name, type: it.type, price: it.price, data: it.data, description: it.description,
      creator: creator ? { id: creator.id, username: creator.username } : null,
      created: it.created, sales: it.sales, limited: it.limited, remaining: it.remaining,
      owned: user ? (D.inventory[user.id] || []).includes(it.id) : false,
    };
  };

  const log = (userId, amount, desc) => {
    D.transactions.push({ userId, amount, desc, time: Date.now() });
    if (D.transactions.length > 5000) D.transactions.splice(0, 1000);
  };

  // ------------------------------------------------------------ auth
  // Keeps a device cookie the server middleware may have set on this response.
  const setCookie = (res, c) => (res.append ? res.append('Set-Cookie', c) : res.setHeader('Set-Cookie', c));
  const banMessage = (u) => `This account has been banned.${u.banReason ? ' Reason: ' + u.banReason : ''}`;

  api.post('/auth/signup', (req, res) => {
    const { username, password } = req.body || {};
    const banned = bannedClient(db, req.client);
    if (banned) return bad(res, `You are banned from this Robis (account ${banned.username}).${banned.banReason ? ' Reason: ' + banned.banReason : ''}`, 403);
    if (!validUsername(username)) return bad(res, 'Usernames can be 3 to 20 characters long, letters, numbers and at most one underscore.');
    if (typeof password !== 'string' || password.length < 6) return bad(res, 'Password must be at least 6 characters.');
    if (password.toLowerCase() === username.toLowerCase()) return bad(res, 'Password cannot be your username.');
    if (Object.values(D.users).some((u) => u.username.toLowerCase() === username.toLowerCase())) return bad(res, 'This username is already in use.');
    // The very first person to sign up on a fresh server becomes its admin.
    const isFirst = firstUserIsAdmin && !Object.values(D.users).some((u) => !u.system);
    const user = createUser(db, username, password, isFirst ? { isAdmin: true } : {});
    grantAdminPerks(user);
    noteClient(db, user, req.client);
    const token = createSession(db, user.id);
    setCookie(res, sessionCookie(token));
    res.json({ user: me(user) });
  });

  api.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = Object.values(D.users).find((u) => u.username.toLowerCase() === String(username || '').toLowerCase());
    if (!user || !checkPassword(user, String(password || ''))) return bad(res, 'Incorrect username or password.', 401);
    if (user.banned) return bad(res, banMessage(user), 403);
    const other = !user.isAdmin && bannedClient(db, req.client);
    if (other) return bad(res, `You are banned from this Robis (account ${other.username}).${other.banReason ? ' Reason: ' + other.banReason : ''}`, 403);
    noteClient(db, user, req.client);
    const token = createSession(db, user.id);
    user.lastOnline = Date.now();
    setCookie(res, sessionCookie(token));
    res.json({ user: me(user) });
  });

  api.post('/auth/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) destroySession(db, token);
    setCookie(res, sessionCookie('', 0));
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => {
    if (req.user) noteClient(db, req.user, req.client);
    res.json({ user: req.user ? me(req.user) : null });
  });

  // ------------------------------------------------------------ users
  api.get('/users', (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    const list = Object.values(D.users)
      .filter((u) => !q || u.username.toLowerCase().includes(q))
      .sort((a, b) => b.lastOnline - a.lastOnline)
      .slice(0, 60)
      .map((u) => publicUser(u));
    res.json({ users: list });
  });

  api.get('/users/:id', (req, res) => {
    const u = D.users[toInt(req.params.id)];
    if (!u) return bad(res, 'User not found', 404);
    const out = publicUser(u, true);
    if (req.user) {
      out.isFriend = (D.friends[req.user.id] || []).includes(u.id);
      out.requestSent = D.friendRequests.some((r) => r.from === req.user.id && r.to === u.id);
      out.requestReceived = D.friendRequests.some((r) => r.from === u.id && r.to === req.user.id);
    }
    res.json({ user: out });
  });

  api.patch('/users/me', requireUser, (req, res) => {
    const { blurb, status } = req.body || {};
    if (typeof blurb === 'string') req.user.blurb = blurb.slice(0, 1000);
    if (typeof status === 'string') req.user.status = status.slice(0, 254);
    db.save();
    res.json({ user: me(req.user) });
  });

  api.get('/users/:id/friends', (req, res) => {
    const id = toInt(req.params.id);
    if (!D.users[id]) return bad(res, 'User not found', 404);
    res.json({ friends: (D.friends[id] || []).map((f) => publicUser(D.users[f])).filter(Boolean) });
  });

  api.get('/users/:id/games', (req, res) => {
    const id = toInt(req.params.id);
    const own = req.user && (req.user.id === id);
    const games = Object.values(D.games).filter((g) => g.creatorId === id && (g.isPublic || own)).sort((a, b) => b.updated - a.updated);
    res.json({ games: games.map((g) => publicGame(g, req.user)) });
  });

  api.get('/users/:id/favorites', (req, res) => {
    const id = toInt(req.params.id);
    const ids = D.favorites[id] || [];
    res.json({ games: ids.map((g) => D.games[g]).filter(Boolean).map((g) => publicGame(g, req.user)) });
  });

  api.get('/users/:id/inventory', (req, res) => {
    const id = toInt(req.params.id);
    const type = req.query.type;
    const items = (D.inventory[id] || []).map((i) => D.items[i]).filter((i) => i && (!type || i.type === type));
    res.json({ items: items.map((i) => publicItem(i, req.user)) });
  });

  // ------------------------------------------------------------ friends
  api.get('/friends/requests', requireUser, (req, res) => {
    const list = D.friendRequests.filter((r) => r.to === req.user.id).map((r) => ({ ...r, user: publicUser(D.users[r.from]) }));
    res.json({ requests: list });
  });

  api.post('/friends/:id/request', requireUser, (req, res) => {
    const id = toInt(req.params.id);
    const other = D.users[id];
    if (!other || id === req.user.id) return bad(res, 'Invalid user');
    if (other.system) return bad(res, 'This account does not accept friend requests.');
    if ((D.friends[req.user.id] || []).includes(id)) return bad(res, 'Already friends');
    // Accept automatically if they already asked us.
    const back = D.friendRequests.findIndex((r) => r.from === id && r.to === req.user.id);
    if (back >= 0) {
      D.friendRequests.splice(back, 1);
      addFriends(req.user.id, id);
      db.save();
      return res.json({ status: 'friends' });
    }
    if (!D.friendRequests.some((r) => r.from === req.user.id && r.to === id)) {
      D.friendRequests.push({ from: req.user.id, to: id, created: Date.now() });
    }
    db.save();
    res.json({ status: 'sent' });
  });

  const addFriends = (a, b) => {
    D.friends[a] = [...new Set([...(D.friends[a] || []), b])];
    D.friends[b] = [...new Set([...(D.friends[b] || []), a])];
  };

  api.post('/friends/:id/accept', requireUser, (req, res) => {
    const id = toInt(req.params.id);
    const i = D.friendRequests.findIndex((r) => r.from === id && r.to === req.user.id);
    if (i < 0) return bad(res, 'No such request');
    D.friendRequests.splice(i, 1);
    addFriends(req.user.id, id);
    db.save();
    res.json({ status: 'friends' });
  });

  api.post('/friends/:id/decline', requireUser, (req, res) => {
    const id = toInt(req.params.id);
    D.friendRequests = D.friendRequests.filter((r) => !(r.from === id && r.to === req.user.id));
    db.save();
    res.json({ ok: true });
  });

  api.delete('/friends/:id', requireUser, (req, res) => {
    const id = toInt(req.params.id);
    D.friends[req.user.id] = (D.friends[req.user.id] || []).filter((f) => f !== id);
    D.friends[id] = (D.friends[id] || []).filter((f) => f !== req.user.id);
    db.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ messages
  api.get('/messages', requireUser, (req, res) => {
    const box = req.query.box === 'sent' ? 'sent' : 'inbox';
    const list = D.messages
      .filter((m) => (box === 'sent' ? m.from === req.user.id : m.to === req.user.id))
      .sort((a, b) => b.created - a.created)
      .slice(0, 100)
      .map((m) => ({ ...m, fromUser: publicUser(D.users[m.from]), toUser: publicUser(D.users[m.to]) }));
    res.json({ messages: list, unread: D.messages.filter((m) => m.to === req.user.id && !m.read).length });
  });

  api.post('/messages', requireUser, (req, res) => {
    const { to, subject, body } = req.body || {};
    const target = D.users[toInt(to)] || Object.values(D.users).find((u) => u.username.toLowerCase() === String(to || '').toLowerCase());
    if (!target) return bad(res, 'Recipient not found');
    if (target.system) return bad(res, 'This account can\'t receive messages.');
    if (!String(body || '').trim()) return bad(res, 'Message is empty');
    const m = {
      id: db.nextId('message'), from: req.user.id, to: target.id,
      subject: String(subject || '(no subject)').slice(0, 100), body: String(body).slice(0, 5000), created: Date.now(), read: false,
    };
    D.messages.push(m);
    db.save();
    res.json({ message: m });
  });

  api.post('/messages/:id/read', requireUser, (req, res) => {
    const m = D.messages.find((x) => x.id === toInt(req.params.id) && x.to === req.user.id);
    if (m) { m.read = true; db.save(); }
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ avatar
  api.get('/avatar', requireUser, (req, res) => {
    res.json({ avatar: normalizeAvatar(req.user.avatar), resolved: resolvedAvatar(req.user) });
  });

  api.put('/avatar', requireUser, (req, res) => {
    const a = normalizeAvatar(req.body || {});
    const owned = new Set(D.inventory[req.user.id] || []);
    const counts = {};
    a.wearing = a.wearing.filter((id) => {
      const it = D.items[id];
      if (!it || !owned.has(id)) return false;
      counts[it.type] = (counts[it.type] || 0) + 1;
      return counts[it.type] <= (WEAR_LIMITS[it.type] || 1);
    });
    req.user.avatar = a;
    db.save();
    res.json({ avatar: a, resolved: resolvedAvatar(req.user) });
  });

  // ------------------------------------------------------------ catalog
  api.get('/catalog', (req, res) => {
    const { type, q, sort } = req.query;
    let items = Object.values(D.items).filter((i) => (!type || type === 'All' || i.type === type || (type === 'Accessories' && (i.type === 'Hat' || i.type === 'Hair')) || (type === 'Clothing' && ['Shirt', 'Pants', 'TShirt'].includes(i.type)) || (type === 'Collectibles' && i.limited)));
    if (q) items = items.filter((i) => i.name.toLowerCase().includes(String(q).toLowerCase()));
    if (sort === 'price-asc') items.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') items.sort((a, b) => b.price - a.price);
    else if (sort === 'recent') items.sort((a, b) => b.created - a.created);
    else items.sort((a, b) => b.sales - a.sales);
    res.json({ items: items.map((i) => publicItem(i, req.user)), types: ITEM_TYPES });
  });

  api.get('/catalog/:id', (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    res.json({ item: publicItem(it, req.user) });
  });

  api.post('/catalog/:id/buy', requireUser, (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    const inv = D.inventory[req.user.id] || (D.inventory[req.user.id] = []);
    if (inv.includes(it.id)) return bad(res, 'You already own this item.');
    if (it.limited && it.remaining !== null && it.remaining <= 0) return bad(res, 'This item is sold out.');
    if (req.user.robits < it.price) return bad(res, `You need ${it.price - req.user.robits} more Robits to purchase this item.`);
    req.user.robits -= it.price;
    const creator = D.users[it.creatorId];
    if (creator && creator.id !== req.user.id && it.price > 0) {
      const cut = Math.floor(it.price * 0.7);
      creator.robits += cut;
      log(creator.id, cut, `Sold ${it.name}`);
    }
    log(req.user.id, -it.price, `Purchased ${it.name}`);
    inv.push(it.id);
    it.sales++;
    if (it.limited && it.remaining !== null) it.remaining--;
    db.save();
    res.json({ ok: true, robits: req.user.robits, item: publicItem(it, req.user) });
  });

  // ------------------------------------------------------------ admin code
  api.post('/auth/admin-code', requireUser, (req, res) => {
    if (!adminCodeHash) return bad(res, 'Admin codes are not enabled on this server.');
    const code = String(req.body?.code || '').trim().toUpperCase();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (!code || hash !== adminCodeHash) return bad(res, 'Wrong admin code.', 403);
    req.user.isAdmin = true;
    req.user.adminByCode = true;
    grantAdminPerks(req.user);
    db.save();
    res.json({ user: me(req.user) });
  });

  // ------------------------------------------------------------ economy
  api.post('/economy/stipend', requireUser, (req, res) => {
    if (Date.now() - (req.user.lastStipend || 0) < STIPEND_MS) return bad(res, 'Come back tomorrow for more Robits!');
    const amount = stipendFor(req.user);
    req.user.lastStipend = Date.now();
    req.user.robits += amount;
    log(req.user.id, amount, 'Daily stipend');
    db.save();
    res.json({ robits: req.user.robits, amount });
  });

  api.get('/economy/store', (req, res) => {
    res.json({
      memberships: Object.entries(MEMBERSHIPS).map(([id, m]) => ({ id, ...m })),
      current: req.user ? req.user.membership || 'None' : null,
    });
  });

  api.get('/economy/transactions', requireUser, (req, res) => {
    res.json({ transactions: D.transactions.filter((t) => t.userId === req.user.id).slice(-100).reverse() });
  });

  // ------------------------------------------------------------ games
  api.get('/games', (req, res) => {
    const { sort, q, genre } = req.query;
    let games = Object.values(D.games).filter((g) => g.isPublic);
    if (q) games = games.filter((g) => g.name.toLowerCase().includes(String(q).toLowerCase()));
    if (genre && genre !== 'All') games = games.filter((g) => g.genre === genre);
    const list = games.map((g) => publicGame(g, req.user));
    const score = {
      popular: (g) => g.playing * 1000 + g.visits / 100,
      top: (g) => (g.rating ?? 0) * 10 + Math.log10(g.upVotes + 1),
      recent: (g) => g.updated,
      featured: (g) => (g.featured ? 1e12 : 0) + g.visits,
      visits: (g) => g.visits,
    }[sort] || ((g) => g.playing * 1000 + g.visits / 100);
    list.sort((a, b) => score(b) - score(a));
    res.json({ games: list });
  });

  api.get('/games/recent', requireUser, (req, res) => {
    const ids = (req.user.recentGames || []).slice(0, 12);
    res.json({ games: ids.map((id) => D.games[id]).filter(Boolean).map((g) => publicGame(g, req.user)) });
  });

  api.get('/games/:id', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g || (!g.isPublic && !(req.user && (req.user.id === g.creatorId || req.user.isAdmin)))) return bad(res, 'Game not found', 404);
    res.json({ game: publicGame(g, req.user) });
  });

  api.get('/games/:id/servers', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    res.json({
      servers: manager.serversFor(g.id).map((s) => {
        const i = s.info();
        i.players = i.players.map((p) => ({ ...p, avatar: D.users[p.userId] ? resolvedAvatar(D.users[p.userId]) : null }));
        return i;
      }),
    });
  });

  api.post('/games', requireUser, (req, res) => {
    const count = Object.values(D.games).filter((g) => g.creatorId === req.user.id).length;
    if (count >= 50 && !req.user.isAdmin) return bad(res, 'You have reached the maximum number of places.');
    const template = TEMPLATES[req.body?.template] || TEMPLATES.baseplate;
    const id = db.nextId('game');
    const name = String(req.body?.name || `${req.user.username}'s Place`).slice(0, 50);
    D.games[id] = {
      id, name, description: String(req.body?.description || '').slice(0, 1000), creatorId: req.user.id,
      genre: 'All', created: Date.now(), updated: Date.now(), visits: 0, maxPlayers: 12, isPublic: false,
      featured: false, copyable: false, upVotes: 0, downVotes: 0, favorites: 0,
    };
    db.writePlace(id, template.build());
    db.save();
    res.json({ game: publicGame(D.games[id], req.user) });
  });

  api.patch('/games/:id', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (g.creatorId !== req.user.id && !req.user.isAdmin) return bad(res, 'Forbidden', 403);
    const b = req.body || {};
    if (typeof b.name === 'string' && b.name.trim()) g.name = b.name.trim().slice(0, 50);
    if (typeof b.description === 'string') g.description = b.description.slice(0, 1000);
    if (typeof b.isPublic === 'boolean') g.isPublic = b.isPublic;
    if (typeof b.copyable === 'boolean') g.copyable = b.copyable;
    if (typeof b.genre === 'string') g.genre = b.genre.slice(0, 30);
    if (Number.isInteger(b.maxPlayers)) g.maxPlayers = Math.max(1, Math.min(50, b.maxPlayers));
    g.updated = Date.now();
    db.save();
    res.json({ game: publicGame(g, req.user) });
  });

  api.delete('/games/:id', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (g.creatorId !== req.user.id && !req.user.isAdmin) return bad(res, 'Forbidden', 403);
    for (const s of manager.serversFor(g.id)) s.close();
    delete D.games[g.id];
    db.save();
    res.json({ ok: true });
  });

  api.get('/games/:id/place', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const canEdit = req.user && (req.user.id === g.creatorId || req.user.isAdmin);
    if (!canEdit && !g.copyable) return bad(res, 'This place is not copyable.', 403);
    const place = db.readPlace(g.id);
    if (!place) return bad(res, 'Place file missing', 404);
    res.json({ place, game: publicGame(g, req.user) });
  });

  api.put('/games/:id/place', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (g.creatorId !== req.user.id && !req.user.isAdmin) return bad(res, 'You do not have permission to edit this place.', 403);
    const place = req.body?.place;
    if (!place || place.format !== PLACE_FORMAT || typeof place.services !== 'object') return bad(res, 'Invalid place file');
    db.writePlace(g.id, place);
    g.updated = Date.now();
    if (typeof req.body.thumbnail === 'string') saveThumb('game', g.id, req.body.thumbnail);
    db.save();
    res.json({ ok: true, game: publicGame(g, req.user) });
  });

  const saveThumb = (kind, id, dataUrl) => {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl);
    if (!m) return false;
    if (m[2].length * 0.75 > 4 * 1024 * 1024) return false;
    db.writeThumb(kind, id, m[2]);
    return true;
  };

  api.get('/games/:id/thumbnail', (req, res) => {
    const id = toInt(req.params.id);
    if (!db.hasThumb('game', id)) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(db.thumbPath('game', id));
  });

  // Anyone may supply a thumbnail for a game that has none (rendered client-side).
  api.put('/games/:id/thumbnail', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const canEdit = req.user && (req.user.id === g.creatorId || req.user.isAdmin);
    if (!canEdit && db.hasThumb('game', g.id)) return bad(res, 'Forbidden', 403);
    if (!saveThumb('game', g.id, String(req.body?.image || ''))) return bad(res, 'Invalid image');
    res.json({ ok: true });
  });

  // Public place data for rendering thumbnails (world only, no scripts).
  api.get('/games/:id/preview', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const place = db.readPlace(g.id);
    if (!place) return bad(res, 'Place file missing', 404);
    res.json({ place: { format: place.format, version: place.version, services: { Workspace: place.services.Workspace, Lighting: place.services.Lighting } } });
  });

  api.post('/games/:id/vote', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const vote = Math.sign(+req.body?.vote || 0);
    const key = `${g.id}:${req.user.id}`;
    const old = D.votes[key] || 0;
    if (old === 1) g.upVotes--; if (old === -1) g.downVotes--;
    if (vote === 1) g.upVotes++; if (vote === -1) g.downVotes++;
    if (vote) D.votes[key] = vote; else delete D.votes[key];
    db.save();
    res.json({ game: publicGame(g, req.user) });
  });

  api.post('/games/:id/favorite', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const fav = D.favorites[req.user.id] || (D.favorites[req.user.id] = []);
    const i = fav.indexOf(g.id);
    if (i >= 0) { fav.splice(i, 1); g.favorites--; } else { fav.push(g.id); g.favorites++; }
    db.save();
    res.json({ game: publicGame(g, req.user) });
  });

  // ------------------------------------------------------------ studio
  api.get('/templates', (req, res) => {
    res.json({ templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, name: t.name, desc: t.desc })) });
  });
  api.get('/templates/:key', (req, res) => {
    const t = TEMPLATES[req.params.key];
    if (!t) return bad(res, 'Template not found', 404);
    res.json({ place: t.build() });
  });

  // ------------------------------------------------------------ misc
  api.get('/stats', (req, res) => {
    const servers = manager.allServers().filter((s) => !s.isTest);
    res.json({
      users: Object.keys(D.users).length,
      games: Object.keys(D.games).length,
      playing: servers.reduce((a, s) => a + s.playerCount, 0),
      servers: servers.length,
    });
  });

  // ------------------------------------------------------------ admin panel
  const requireAdmin = (req, res, next) => {
    if (!req.user) return bad(res, 'You must be logged in.', 401);
    if (!req.user.isAdmin) return bad(res, 'Admins only.', 403);
    next();
  };
  const adminUser = (u) => ({
    ...publicUser(u), robits: u.robits, isAdmin: !!u.isAdmin, banned: !!u.banned, banReason: u.banReason || '',
    items: (D.inventory[u.id] || []).length, games: Object.values(D.games).filter((g) => g.creatorId === u.id).length,
  });
  const target = (req, res) => {
    const u = D.users[toInt(req.params.id)];
    if (!u || u.system) { bad(res, 'User not found', 404); return null; }
    return u;
  };

  api.get('/admin/overview', requireAdmin, (req, res) => {
    const users = Object.values(D.users).filter((u) => !u.system);
    res.json({
      stats: {
        users: users.length, games: Object.keys(D.games).length, items: Object.keys(D.items).length,
        robits: users.reduce((a, u) => a + (u.robits || 0), 0),
        playing: manager.allServers().reduce((a, s) => a + s.playerCount, 0),
      },
      users: users.sort((a, b) => b.lastOnline - a.lastOnline).map(adminUser),
      memberships: Object.entries(MEMBERSHIPS).map(([id, m]) => ({ id, name: m.name })),
    });
  });

  api.post('/admin/users/:id/robits', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    const amount = Math.trunc(+req.body?.amount || 0);
    if (!amount || Math.abs(amount) > 1e9) return bad(res, 'Enter an amount.');
    u.robits = Math.max(0, u.robits + amount);
    log(u.id, amount, amount > 0 ? `Gift from ${req.user.username}` : `Removed by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/membership', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    if (!MEMBERSHIPS[req.body?.tier]) return bad(res, 'Unknown membership.');
    u.membership = req.body.tier;
    log(u.id, 0, `Membership set by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/items', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    const ids = req.body?.all ? Object.keys(D.items).map(Number) : [toInt(req.body?.itemId)].filter((i) => D.items[i]);
    if (!ids.length) return bad(res, 'Item not found.');
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...ids])];
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/admin', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.id === req.user.id) return bad(res, 'You can\'t change your own admin rights.');
    if (req.body?.isAdmin) { u.isAdmin = true; u.adminByCode = true; grantAdminPerks(u); } else { u.adminByCode = false; revokeAdmin(u); }
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/ban', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.id === req.user.id) return bad(res, 'You can\'t ban yourself.');
    if (u.isAdmin && req.body?.banned) return bad(res, 'Remove admin rights before banning an admin.');
    setBan(u, !!req.body?.banned, req.body?.reason);
    res.json({ user: adminUser(u) });
  });

  api.use((req, res) => bad(res, 'Not found', 404));
  return api;
}
