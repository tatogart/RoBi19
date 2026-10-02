// REST API for the Robis website, Studio and client.
import crypto from 'node:crypto';
import express from 'express';
import {
  checkPassword, createSession, destroySession, sessionCookie, validUsername, COOKIE, parseCookies, bannedClient, noteClient, isBanned, banDetails,
} from './auth.js';
import { createUser, addSeedGames, addCatalogItems, ensureOwner, officialAccount, OWNER_NAME } from './seed/seed.js';
import { hashPassword } from './auth.js';
import { TEMPLATES } from './seed/places.js';
import { normalizeAvatar, WEAR_LIMITS, ITEM_TYPES, CATALOG } from '../shared/avatar.js';
import { PLACE_FORMAT } from '../shared/engine/serialize.js';
import { filterChat } from './game/chatfilter.js';

const ONLINE_MS = 2 * 60 * 1000;
const STIPEND_MS = 24 * 3600 * 1000;

// Builders Club tiers (2019 names). Admins hand them out, also through promo codes
// (then for a number of days: u.membershipUntil; u.membershipAfter is the plan to go back to).
export const MEMBERSHIPS = {
  None: { name: 'Classic', stipend: 25 },
  BuildersClub: { name: 'Builders Club', short: 'BC', stipend: 40 },
  TurboBuildersClub: { name: 'Turbo Builders Club', short: 'TBC', stipend: 60 },
  OutrageousBuildersClub: { name: 'Outrageous Builders Club', short: 'OBC', stipend: 85 },
};
const ADMIN_ROBITS = 1_000_000;
// Rights an admin can give other players in the Admin Panel. Admins have all.
export const PERMISSIONS = {
  moderator: 'Moderator: ban, kick and mute players',
  economy: 'Economy: give Robits, items and Builders Club',
  items: 'Item Creator (BETA): make catalog items',
  limiteds: 'Limited Creator: make Limited items with a set stock',
  games: 'Game Curator: feature games on the front page',
};
// Name badges shown next to a username. Only admins hand them out (Admin Panel).
export const FLAGS = {
  staff: 'Robis icon (official / staff)',
  verified: 'Verified (blue check)',
  partner: 'Partner (gold check)',
  moderator: 'Moderator (green shield)',
  developer: 'Developer (code)',
  star: 'Star Creator',
  vip: 'VIP (crown)',
  creator: 'Video Creator',
  champion: 'Champion (trophy)',
  bughunter: 'Bug Hunter',
  supporter: 'Supporter (heart)',
  og: 'OG Player',
};
export const userFlags = (u) => Object.keys(FLAGS).filter((f) => u && u.flags && u.flags[f]);
export const can = (u, perm) => !!u && (u.isAdmin || (u.perms || []).includes(perm));

// opts.firstUserIsAdmin: the first account on a fresh server becomes admin (shared server).
// opts.adminCodeHash: sha256 of a secret admin code; entering it makes any account an admin.
// opts.requireAdminCode: only code-verified accounts may stay admins (phone build, where
//   every device is its own "server" and anyone would otherwise be first).
export function createApi(db, manager, opts = {}) {
  const firstUserIsAdmin = opts.firstUserIsAdmin !== false;
  const adminCodeHash = (opts.adminCodeHash || '').trim().toLowerCase();
  const api = express.Router();
  const D = db.data;

  // Serial numbers of Limited copies: D.serials[itemId][userId] = #. Copies keep
  // their number when traded; a number taken away by an admin is never reused.
  if (!D.serials) D.serials = {};
  const giveSerial = (it, userId) => {
    if (!it || !it.limited) return null;
    const map = D.serials[it.id] || (D.serials[it.id] = {});
    if (!map[userId]) { it.lastSerial = (it.lastSerial || 0) + 1; map[userId] = it.lastSerial; }
    return map[userId];
  };
  const serialOf = (it, userId) => (it && it.limited && D.serials[it.id]?.[userId]) || null;
  const moveSerial = (itemId, from, to) => {
    const map = D.serials[itemId];
    if (!map || !map[from]) return;
    map[to] = map[from];
    delete map[from];
  };
  const dropSerial = (itemId, userId) => { if (D.serials[itemId]) delete D.serials[itemId][userId]; };
  // Gives numbers to every owner of a Limited that doesn't have one yet (oldest accounts first).
  const syncSerials = (only) => {
    let changed = false;
    const owners = Object.keys(D.inventory).map(Number).sort((a, b) => a - b);
    for (const it of only ? [only] : Object.values(D.items)) {
      if (!it.limited) continue;
      for (const uid of owners) {
        if ((D.inventory[uid] || []).includes(it.id) && !serialOf(it, uid)) { giveSerial(it, uid); changed = true; }
      }
    }
    return changed;
  };

  // Admins get the full owner experience: Robits, OBC and every catalog item.
  const grantAdminPerks = (u) => {
    if (!u || !u.isAdmin || u.adminPerks || u.system) return;
    u.adminPerks = true;
    u.robits = (u.robits || 0) + ADMIN_ROBITS;
    u.membership = 'OutrageousBuildersClub';
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...Object.keys(D.items).map(Number)])];
    for (const it of Object.values(D.items)) giveSerial(it, u.id);
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
  // The official Robis account wears the Robis icon and the check (once; admins can change it).
  { const off = officialAccount(D); if (off && !off.flags) off.flags = { staff: true, verified: true }; }
  ensureOwner(db);

  // New showcase places reach existing worlds too.
  addSeedGames(db);
  addCatalogItems(db);
  // Admins own every catalog item, new ones too.
  for (const u of Object.values(D.users)) {
    if (!u.isAdmin || !u.adminPerks || u.system) continue;
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...Object.keys(D.items).filter((k) => !D.items[k].custom).map(Number)])];
  }
  if (syncSerials()) db.save();

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

  // Bans an account. opts.device also blocks the devices and IPs it used,
  // except ones an admin also uses (so the owner's own phone or Wi-Fi never
  // gets banned). opts.ms makes it temporary.
  const BAN_TIMES = { '1h': 3600e3, '1d': 86400e3, '3d': 3 * 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
  const setBan = (u, banned, reason, opts = {}) => {
    u.banned = banned;
    u.banReason = banned ? String(reason || '').slice(0, 200) : '';
    u.banUntil = banned && opts.ms ? Date.now() + opts.ms : 0;
    u.bannedDevices = [];
    u.bannedIps = [];
    if (banned) {
      if (opts.device) {
        const admins = Object.values(D.users).filter((a) => a.isAdmin);
        const safe = (key) => new Set(admins.flatMap((a) => a[key] || []));
        const dev = safe('devices');
        const ips = safe('ips');
        u.bannedDevices = (u.devices || []).filter((d) => !dev.has(d));
        u.bannedIps = (u.ips || []).filter((i) => !ips.has(i));
      }
      const msg = `You have been banned.${banDetails(u)}`;
      for (const [t, s] of Object.entries(D.sessions)) if (s.userId === u.id) delete D.sessions[t];
      const f = manager.findUser(u.id);
      if (f) f.server.kick(f.session, msg);
      // Also kick other accounts playing from a banned device.
      if (opts.device) for (const o of Object.values(D.users)) {
        if (o.isAdmin || o === u || !bannedClient(db, { device: o.devices?.[0], ip: '' })) continue;
        for (const [t, s] of Object.entries(D.sessions)) if (s.userId === o.id) delete D.sessions[t];
        const g = manager.findUser(o.id);
        if (g) g.server.kick(g.session, msg);
      }
    }
    db.save();
  };

  // Lets admins use :ban / :unban from the in-game chat.
  manager.admin = {
    findUser: (name) => Object.values(D.users).find((u) => !u.system && u.username.toLowerCase() === String(name).toLowerCase()) || null,
    ban: (u, banned, reason, opts) => setBan(u, banned, reason, opts),
    banTimes: BAN_TIMES,
    can: (u, perm) => can(D.users[u.id] || u, perm),
  };

  // ------------------------------------------------------------ helpers
  const requireUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'You must be logged in.' });
    next();
  };
  // Admins, or players given this right in the Admin Panel.
  const requirePerm = (perm) => (req, res, next) => {
    if (!req.user) return bad(res, 'You must be logged in.', 401);
    if (!can(req.user, perm)) return bad(res, 'You don\'t have permission to do that.', 403);
    next();
  };
  const staff = (u) => can(u, 'moderator') || can(u, 'economy');
  const requireStaff = (req, res, next) => {
    if (!req.user) return bad(res, 'You must be logged in.', 401);
    if (!staff(req.user)) return bad(res, 'Admins only.', 403);
    next();
  };
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
  // Is this name taken? The main account's name (Seek_tv87) can be taken over
  // from the built-in system account by an admin (see ensureOwner).
  const nameTaken = (name, self, mayClaim) => Object.values(D.users).some((o) => o !== self && o.username.toLowerCase() === name.toLowerCase()
    && !(mayClaim && o.system && o.official && name.toLowerCase() === OWNER_NAME.toLowerCase()));
  const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

  const presence = (u) => {
    if (u.system) return { status: 'offline' };
    const s = manager.findUser(u.id);
    if (s) return { status: s.server.isTest ? 'studio' : 'ingame', gameId: s.server.isTest ? null : s.server.gameId };
    if (Date.now() - (u.lastOnline || 0) < ONLINE_MS) return { status: 'online' };
    return { status: 'offline', lastOnline: u.lastOnline };
  };

  // Robis Badges: earned automatically for what you do on the site (shown on profiles).
  const ACHIEVEMENTS = [
    ['admin', '🛡️', 'Administrator', 'Runs this Robis.', (u) => u.isAdmin],
    ['club', '🏗️', 'Welcome To The Club', 'Has a Builders Club membership.', (u) => u.membership && u.membership !== 'None'],
    ['veteran', '🎖️', 'Veteran', 'Has been on Robis for a year.', (u) => Date.now() - u.created > 365 * 86400e3],
    ['friendly', '🤝', 'Friendly', 'Has 5 friends.', (u, x) => x.friendCount >= 5],
    ['friendship', '💞', 'Friendship', 'Has 20 friends.', (u, x) => x.friendCount >= 20],
    ['builder', '🧱', 'Builder', 'Made a game.', (u) => Object.values(D.games).some((g) => g.creatorId === u.id)],
    ['homestead', '🏠', 'Homestead', 'Their places were visited 100 times.', (u, x) => x.placeVisits >= 100],
    ['bricksmith', '⚒️', 'Bricksmith', 'Their places were visited 1,000 times.', (u, x) => x.placeVisits >= 1000],
    ['designer', '🎨', 'Item Designer', 'Made a catalog item.', (u) => Object.values(D.items).some((i) => i.custom && i.creatorId === u.id)],
    ['trader', '🔁', 'Trader', 'Completed a trade.', (u) => (D.trades || []).some((t) => t.status === 'accepted' && (t.from === u.id || t.to === u.id))],
    ['collector', '💎', 'Collector', 'Owns a Limited item.', (u) => (D.inventory[u.id] || []).some((i) => D.items[i] && D.items[i].limited)],
    ['rich', '💰', 'Robit Tycoon', 'Has 10,000 Robits.', (u) => (u.robits || 0) >= 10000],
    ['hunter', '🏅', 'Badge Hunter', 'Earned 10 game badges.', (u, x) => (D.badges[u.id] || []).length >= 10],
    ['founder', '👑', 'Group Founder', 'Owns a group.', (u) => Object.values(D.groups || {}).some((gr) => gr.ownerId === u.id)],
    ['combat', '⚔️', 'Combat Initiation', 'Knocked someone out in a battle game.', (u) => (D.badges[u.id] || []).some((b) => b.name === 'First Blood')],
    ['warrior', '🗡️', 'Warrior', 'Got 25 KOs in one battle.', (u) => (D.badges[u.id] || []).some((b) => b.name === 'Warrior')],
  ];
  const achievements = (u, x) => ACHIEVEMENTS.filter((a) => { try { return a[4](u, x); } catch { return false; } }).map(([id, icon, name, desc]) => ({ id, icon, name, desc }));

  // A membership from a promo code runs out: back to the plan the player had before.
  const checkMembership = (u) => {
    if (u && u.membershipUntil && Date.now() > u.membershipUntil) {
      D.transactions.push({ userId: u.id, amount: 0, desc: `${MEMBERSHIPS[u.membership]?.name || 'Membership'} ended`, time: Date.now() });
      u.membership = u.membershipAfter || 'None';
      u.membershipUntil = 0;
      delete u.membershipAfter;
      db.save();
    }
  };
  const publicUser = (u, full = false) => {
    if (!u) return null;
    checkMembership(u);
    const out = {
      id: u.id, username: u.username, created: u.created, status: u.status || '',
      membership: u.membership || 'None', membershipUntil: u.membershipUntil || 0, isAdmin: !!u.isAdmin, isSystem: !!u.system, presence: presence(u), flags: userFlags(u),
      avatar: resolvedAvatar(u),
    };
    if (full) {
      out.blurb = u.blurb || '';
      out.friendCount = (D.friends[u.id] || []).length;
      out.badges = (D.badges[u.id] || []).slice(-50);
      out.placeVisits = Object.values(D.games).filter((g) => g.creatorId === u.id).reduce((a, g) => a + g.visits, 0);
      out.previousNames = u.previousNames || [];
      out.achievements = achievements(u, out);
    }
    return out;
  };

  const resolvedAvatar = (u) => {
    const a = normalizeAvatar(u.avatar);
    return { bodyColors: a.bodyColors, items: a.wearing.map((id) => D.items[id]).filter(Boolean).map((i) => ({ id: i.id, name: i.name, type: i.type, data: i.data })) };
  };
  manager.resolveAvatar = resolvedAvatar;

  const stipendFor = (u) => { checkMembership(u); return (MEMBERSHIPS[u.membership] || MEMBERSHIPS.None).stipend; };
  const me = (u) => ({
    ...publicUser(u, true), robits: u.robits, canClaimStipend: Date.now() - (u.lastStipend || 0) > STIPEND_MS,
    stipend: stipendFor(u), rawAvatar: normalizeAvatar(u.avatar),
    perms: u.isAdmin ? Object.keys(PERMISSIONS) : (u.perms || []), tradePrivacy: u.tradePrivacy || 'everyone',
  });

  // Owners, admins and the people they add to Team Create can edit a place.
  const canEditPlace = (g, u) => !!g && !!u && (u.id === g.creatorId || !!u.isAdmin || (g.collaborators || []).includes(u.id));
  const publicGame = (g, user) => {
    const creator = D.users[g.creatorId];
    const servers = manager.serversFor(g.id);
    const playing = servers.reduce((a, s) => a + s.playerCount, 0);
    const total = g.upVotes + g.downVotes;
    return {
      id: g.id, name: g.name, description: g.description, genre: g.genre,
      creator: creator ? { id: creator.id, username: creator.username, flags: userFlags(creator) } : null,
      created: g.created, updated: g.updated, visits: g.visits, maxPlayers: g.maxPlayers,
      isPublic: g.isPublic, playing, upVotes: g.upVotes, downVotes: g.downVotes,
      rating: total ? Math.round((g.upVotes / total) * 100) : null, favorites: g.favorites, featured: !!g.featured,
      copyable: !!g.copyable, hasThumbnail: db.hasThumb('game', g.id),
      myVote: user ? D.votes[`${g.id}:${user.id}`] || 0 : 0,
      isFavorite: user ? (D.favorites[user.id] || []).includes(g.id) : false,
      canEdit: canEditPlace(g, user), isOwner: !!user && (user.id === g.creatorId || !!user.isAdmin),
    };
  };

  const publicItem = (it, user) => {
    const creator = D.users[it.creatorId];
    return {
      id: it.id, name: it.name, type: it.type, price: it.price, data: it.data, description: it.description,
      creator: creator ? { id: creator.id, username: creator.username, flags: userFlags(creator) } : null,
      created: it.created, sales: it.sales, limited: !!it.limited, remaining: it.remaining ?? null, stock: it.stock ?? null, custom: !!it.custom,
      owned: user ? (D.inventory[user.id] || []).includes(it.id) : false,
      serial: user ? serialOf(it, user.id) : null, lastSerial: it.limited ? it.lastSerial || 0 : null,
      bestPrice: it.limited ? bestPrice(it.id) : null,
      myResale: user && it.limited ? ((r) => (r ? { id: r.id, price: r.price } : null))(D.resales.find((r) => r.itemId === it.id && r.sellerId === user.id)) : null,
    };
  };

  const log = (userId, amount, desc) => {
    D.transactions.push({ userId, amount, desc, time: Date.now() });
    if (D.transactions.length > 5000) D.transactions.splice(0, 1000);
  };

  // ------------------------------------------------------------ auth
  // Keeps a device cookie the server middleware may have set on this response.
  const setCookie = (res, c) => (res.append ? res.append('Set-Cookie', c) : res.setHeader('Set-Cookie', c));
  const banMessage = (u) => `This account has been banned.${banDetails(u)}`;

  // Slows down password guessing and account spam on public servers.
  const hits = new Map();
  const limited = (req, res, kind, max, ms) => {
    const ip = req.client && req.client.ip;
    if (!ip || ip === '127.0.0.1' || ip === '::1') return false; // local play and tests
    const key = kind + ' ' + ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + ms }; hits.set(key, h); }
    if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (++h.n <= max) return false;
    bad(res, `Too many attempts. Try again in ${Math.ceil((h.reset - now) / 60000)} min.`, 429);
    return true;
  };

  api.post('/auth/signup', (req, res) => {
    if (limited(req, res, 'signup', 10, 3600e3)) return;
    const { username, password } = req.body || {};
    const banned = bannedClient(db, req.client);
    if (banned) return bad(res, `This device is banned from this Robis (account ${banned.username}).${banDetails(banned)}`, 403);
    if (!validUsername(username)) return bad(res, 'Usernames can be 3 to 20 characters long, letters, numbers and at most one underscore.');
    if (typeof password !== 'string' || password.length < 6) return bad(res, 'Password must be at least 6 characters.');
    if (password.toLowerCase() === username.toLowerCase()) return bad(res, 'Password cannot be your username.');
    // The very first person to sign up on a fresh server becomes its admin.
    const isFirst = firstUserIsAdmin && !Object.values(D.users).some((u) => !u.system);
    if (nameTaken(username, null, isFirst)) {
      return bad(res, username.toLowerCase() === OWNER_NAME.toLowerCase()
        ? `${OWNER_NAME} is the main account. Sign up with another name, enter the admin code, then change your username to ${OWNER_NAME} in Settings.`
        : 'This username is already in use.');
    }
    const user = createUser(db, username, password, isFirst ? { isAdmin: true } : {});
    grantAdminPerks(user);
    if (isFirst) ensureOwner(db);
    noteClient(db, user, req.client);
    const token = createSession(db, user.id);
    setCookie(res, sessionCookie(token));
    res.json({ user: me(user) });
  });

  api.post('/auth/login', (req, res) => {
    if (limited(req, res, 'login', 20, 600e3)) return;
    const { username, password } = req.body || {};
    const user = Object.values(D.users).find((u) => u.username.toLowerCase() === String(username || '').toLowerCase());
    if (!user || !checkPassword(user, String(password || ''))) return bad(res, 'Incorrect username or password.', 401);
    if (isBanned(user)) return bad(res, banMessage(user), 403);
    const other = !user.isAdmin && bannedClient(db, req.client);
    if (other) return bad(res, `This device is banned from this Robis (account ${other.username}).${banDetails(other)}`, 403);
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

  // The avatar as the game renders it (used when joining a friend's room).
  api.get('/avatar/resolved', requireUser, (req, res) => res.json({ avatar: resolvedAvatar(req.user) }));

  // Lets open pages notice a new deploy and reload (see public/js/site/install.js).
  api.get('/version', (req, res) => res.json({ version: opts.version || '' }));

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

  // ------------------------------------------------------------ game invites
  // A player in a game invites a friend; the friend sees a popup with a Join
  // button (on any page or in their own game) for 10 minutes.
  const INVITE_MS = 10 * 60 * 1000;
  if (!D.invites) D.invites = [];
  api.post('/invites', requireUser, (req, res) => {
    const to = D.users[toInt(req.body?.toUserId)];
    const game = D.games[toInt(req.body?.gameId)];
    if (!to || to.system) return bad(res, 'User not found', 404);
    if (!(D.friends[req.user.id] || []).includes(to.id)) return bad(res, 'You can only invite friends.');
    if (!game) return bad(res, 'Game not found', 404);
    const now = Date.now();
    D.invites = D.invites.filter((i) => now - i.created < INVITE_MS && !(i.from === req.user.id && i.to === to.id));
    D.invites.push({ id: db.nextId('message'), from: req.user.id, to: to.id, gameId: game.id, serverId: String(req.body?.serverId || '').slice(0, 64), created: now });
    if (D.invites.length > 500) D.invites.splice(0, D.invites.length - 500);
    db.save();
    res.json({ ok: true });
  });
  api.get('/invites', requireUser, (req, res) => {
    const now = Date.now();
    const list = (D.invites || []).filter((i) => i.to === req.user.id && now - i.created < INVITE_MS && D.users[i.from] && D.games[i.gameId]);
    res.json({ invites: list.map((i) => ({ id: i.id, from: publicUser(D.users[i.from]), game: { id: i.gameId, name: D.games[i.gameId].name }, serverId: i.serverId, created: i.created })) });
  });
  api.post('/invites/:id/dismiss', requireUser, (req, res) => {
    const id = toInt(req.params.id);
    D.invites = (D.invites || []).filter((i) => !(i.id === id && i.to === req.user.id));
    db.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ trades
  // 2019-style trading: up to 4 items and some Robits on each side. Robits
  // that change hands are taxed 30%. Nothing moves until the other player
  // accepts, and everything is checked again at that moment.
  const TRADE_MAX_ITEMS = 4;
  const TRADE_TAX = 0.3;
  const TRADE_MS = 7 * 24 * 3600e3;
  if (!D.trades) D.trades = [];
  const tradable = (it) => !!it && (it.price > 0 || it.limited);
  // Removes an item from a player's inventory and takes it off their avatar.
  const takeItem = (userId, itemId) => {
    const inv = D.inventory[userId] || [];
    const i = inv.indexOf(itemId);
    if (i >= 0) inv.splice(i, 1);
    dropSerial(itemId, userId);
    const u = D.users[userId];
    if (u && u.avatar && Array.isArray(u.avatar.wearing)) u.avatar.wearing = u.avatar.wearing.filter((x) => x !== itemId);
  };
  const itemList = (v) => [...new Set((Array.isArray(v) ? v : []).map(toInt).filter((i) => i !== null))];
  const robitsAmount = (v) => Math.max(0, Math.min(1e9, Math.trunc(+v || 0)));
  // Returns why a trade can't happen right now, or '' when it can.
  const tradeProblem = (t) => {
    const from = D.users[t.from], to = D.users[t.to];
    if (!from || !to) return 'That player no longer exists.';
    if (isBanned(from) || isBanned(to)) return 'One of the players is banned.';
    const side = (owner, other, ids) => {
      const inv = D.inventory[owner.id] || [];
      const theirs = D.inventory[other.id] || [];
      for (const id of ids) {
        const it = D.items[id];
        if (!tradable(it)) return 'One of the items can\'t be traded.';
        if (!inv.includes(id)) return `${owner.username} no longer owns ${it.name}.`;
        if (theirs.includes(id)) return `${other.username} already owns ${it.name}.`;
      }
      return '';
    };
    return side(from, to, t.give) || side(to, from, t.get)
      || (from.robits < t.giveRobits ? `${from.username} doesn't have enough Robits.` : '')
      || (to.robits < t.getRobits ? `${to.username} doesn't have enough Robits.` : '');
  };
  const expireTrades = () => {
    const now = Date.now();
    for (const t of D.trades) if (t.status === 'pending' && now - t.created > TRADE_MS) { t.status = 'expired'; t.updated = now; }
    if (D.trades.length > 3000) D.trades.splice(0, D.trades.length - 3000);
  };
  const publicTrade = (t, viewer) => ({
    id: t.id, status: t.status, created: t.created, updated: t.updated || t.created, reason: t.reason || '',
    from: publicUser(D.users[t.from]), to: publicUser(D.users[t.to]),
    give: t.give.map((i) => D.items[i]).filter(Boolean).map((i) => ({ ...publicItem(i, viewer), serial: t.status === 'accepted' ? serialOf(i, t.to) : serialOf(i, t.from) })), giveRobits: t.giveRobits,
    get: t.get.map((i) => D.items[i]).filter(Boolean).map((i) => ({ ...publicItem(i, viewer), serial: t.status === 'accepted' ? serialOf(i, t.from) : serialOf(i, t.to) })), getRobits: t.getRobits,
    inbound: t.to === viewer.id,
  });
  const tradeFor = (req, res) => {
    const t = D.trades.find((x) => x.id === toInt(req.params.id) && (x.from === req.user.id || x.to === req.user.id));
    if (!t) { bad(res, 'Trade not found', 404); return null; }
    return t;
  };

  api.post('/trades', requireUser, (req, res) => {
    const from = req.user;
    const to = D.users[toInt(req.body?.toUserId)];
    if (!to || to.system) return bad(res, 'User not found', 404);
    if (to.id === from.id) return bad(res, 'You can\'t trade with yourself.');
    const privacy = to.tradePrivacy || 'everyone';
    if (privacy === 'nobody' || (privacy === 'friends' && !(D.friends[to.id] || []).includes(from.id))) return bad(res, `${to.username} isn't accepting trades from you.`);
    const t = {
      id: db.nextId('trade'), from: from.id, to: to.id, status: 'pending', created: Date.now(),
      give: itemList(req.body?.give), giveRobits: robitsAmount(req.body?.giveRobits),
      get: itemList(req.body?.get), getRobits: robitsAmount(req.body?.getRobits),
    };
    if (t.give.length > TRADE_MAX_ITEMS || t.get.length > TRADE_MAX_ITEMS) return bad(res, `You can trade at most ${TRADE_MAX_ITEMS} items on each side.`);
    if (!t.give.length && !t.get.length) return bad(res, 'Add at least one item to the trade.');
    if ((!t.give.length && !t.giveRobits) || (!t.get.length && !t.getRobits)) return bad(res, 'Both sides of a trade need something.');
    const problem = tradeProblem(t);
    if (problem) return bad(res, problem);
    expireTrades();
    if (D.trades.filter((x) => x.from === from.id && x.status === 'pending').length >= 25) return bad(res, 'You have too many open trades. Wait for answers or cancel some.');
    D.trades.push(t);
    db.save();
    res.json({ trade: publicTrade(t, from) });
  });

  api.get('/trades', requireUser, (req, res) => {
    expireTrades();
    const id = req.user.id;
    const type = String(req.query.type || 'inbound');
    const mine = D.trades.filter((t) => t.from === id || t.to === id);
    const list = type === 'outbound' ? mine.filter((t) => t.status === 'pending' && t.from === id)
      : type === 'completed' ? mine.filter((t) => t.status === 'accepted')
        : type === 'inactive' ? mine.filter((t) => !['pending', 'accepted'].includes(t.status))
          : mine.filter((t) => t.status === 'pending' && t.to === id);
    res.json({ trades: list.sort((a, b) => (b.updated || b.created) - (a.updated || a.created)).slice(0, 100).map((t) => publicTrade(t, req.user)) });
  });

  api.get('/trades/count', requireUser, (req, res) => {
    expireTrades();
    res.json({ inbound: D.trades.filter((t) => t.to === req.user.id && t.status === 'pending').length });
  });

  api.get('/trades/:id', requireUser, (req, res) => {
    const t = tradeFor(req, res); if (!t) return;
    res.json({ trade: publicTrade(t, req.user) });
  });

  api.post('/trades/:id/accept', requireUser, (req, res) => {
    expireTrades();
    const t = tradeFor(req, res); if (!t) return;
    if (t.to !== req.user.id) return bad(res, 'Only the other player can accept this trade.', 403);
    if (t.status !== 'pending') return bad(res, 'This trade is no longer active.');
    const problem = tradeProblem(t);
    if (problem) {
      t.status = 'failed'; t.reason = problem; t.updated = Date.now();
      db.save();
      return bad(res, `The trade could not be completed: ${problem}`);
    }
    const from = D.users[t.from], to = D.users[t.to];
    const hand = (a, b, id) => {
      moveSerial(id, a.id, b.id); // the copy keeps its serial number
      takeItem(a.id, id);
      (D.inventory[b.id] || (D.inventory[b.id] = [])).push(id);
    };
    for (const id of t.give) hand(from, to, id);
    for (const id of t.get) hand(to, from, id);
    const move = (payer, payee, amount) => {
      if (!amount) return;
      const received = Math.floor(amount * (1 - TRADE_TAX));
      payer.robits -= amount;
      payee.robits += received;
      log(payer.id, -amount, `Trade with ${payee.username}`);
      log(payee.id, received, `Trade with ${payer.username} (after 30% fee)`);
    };
    move(from, to, t.giveRobits);
    move(to, from, t.getRobits);
    t.status = 'accepted'; t.updated = Date.now();
    // Other open trades may have just become impossible; they fail when someone tries to accept them.
    db.save();
    res.json({ trade: publicTrade(t, req.user), robits: req.user.robits });
  });

  api.post('/trades/:id/decline', requireUser, (req, res) => {
    const t = tradeFor(req, res); if (!t) return;
    if (t.status !== 'pending') return bad(res, 'This trade is no longer active.');
    t.status = t.from === req.user.id ? 'cancelled' : 'declined';
    t.updated = Date.now();
    db.save();
    res.json({ trade: publicTrade(t, req.user) });
  });

  api.post('/account/trade-privacy', requireUser, (req, res) => {
    const v = String(req.body?.privacy || '');
    if (!['everyone', 'friends', 'nobody'].includes(v)) return bad(res, 'Choose who can trade with you.');
    req.user.tradePrivacy = v;
    db.save();
    res.json({ user: me(req.user) });
  });

  // ------------------------------------------------------------ groups
  // Communities, like 2019 Groups: an emblem, a shout, a wall, members with
  // roles (Owner / Admin / Member) and open or approval-only joining.
  const GROUP_PRICE = 100;
  const GROUP_ICONS = ['★', '⚔', '♛', '☠', '♥', '⚡', '☀', '☾', '♪', '✿', '⚽', '🎮', '🏰', '🐉', '🚀', '🔥', '💎', '🍕'];
  const ROLE_RANK = { owner: 255, admin: 200, member: 1 };
  if (!D.groups) D.groups = {};
  const groupRole = (gr, uid) => (gr && gr.members[uid]) || null;
  const isGroupAdmin = (gr, u) => !!u && (['owner', 'admin'].includes(groupRole(gr, u.id)) || can(u, 'moderator'));
  const groupsOf = (uid) => Object.values(D.groups).filter((gr) => gr.members[uid]);
  const publicGroup = (gr, viewer, full = false) => {
    const owner = D.users[gr.ownerId];
    const out = {
      id: gr.id, name: gr.name, description: gr.description, color: gr.color, icon: gr.icon, approval: !!gr.approval,
      created: gr.created, memberCount: Object.keys(gr.members).length,
      owner: owner ? { id: owner.id, username: owner.username, flags: userFlags(owner) } : null,
      shout: gr.shout || null,
      myRole: viewer ? groupRole(gr, viewer.id) : null,
      requested: viewer ? (gr.requests || []).includes(viewer.id) : false,
    };
    if (full) {
      const order = { owner: 0, admin: 1, member: 2 };
      out.members = Object.entries(gr.members)
        .map(([uid, role]) => ({ role, user: publicUser(D.users[uid]) }))
        .filter((m) => m.user)
        .sort((a, b) => order[a.role] - order[b.role] || a.user.username.localeCompare(b.user.username))
        .slice(0, 200);
      out.wall = (gr.wall || []).slice(-60).reverse().map((p) => ({ ...p, user: publicUser(D.users[p.userId]) })).filter((p) => p.user);
      if (viewer && isGroupAdmin(gr, viewer)) out.requests = (gr.requests || []).map((uid) => publicUser(D.users[uid])).filter(Boolean);
    }
    return out;
  };
  const groupFor = (req, res) => {
    const gr = D.groups[toInt(req.params.id)];
    if (!gr) { bad(res, 'Group not found', 404); return null; }
    return gr;
  };
  const cleanText = (v, max) => filterChat(String(v || '').trim().slice(0, max));

  api.get('/groups', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = Object.values(D.groups)
      .filter((gr) => !q || gr.name.toLowerCase().includes(q))
      .sort((a, b) => Object.keys(b.members).length - Object.keys(a.members).length || b.created - a.created)
      .slice(0, 60);
    res.json({ groups: list.map((gr) => publicGroup(gr, req.user)), mine: req.user ? groupsOf(req.user.id).map((gr) => publicGroup(gr, req.user)) : [], icons: GROUP_ICONS, price: GROUP_PRICE });
  });

  api.post('/groups', requireUser, (req, res) => {
    const u = req.user;
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 40) return bad(res, 'Group names are 3 to 40 characters long.');
    if (filterChat(name) !== name) return bad(res, 'That group name is not allowed.');
    if (Object.values(D.groups).some((gr) => gr.name.toLowerCase() === name.toLowerCase())) return bad(res, 'A group with this name already exists.');
    if (groupsOf(u.id).filter((gr) => gr.ownerId === u.id).length >= 10 && !u.isAdmin) return bad(res, 'You can own at most 10 groups.');
    const price = u.isAdmin ? 0 : GROUP_PRICE;
    if (u.robits < price) return bad(res, `Creating a group costs R$${GROUP_PRICE}.`);
    u.robits -= price;
    const id = db.nextId('group');
    D.groups[id] = {
      id, name, description: cleanText(req.body?.description, 1000), ownerId: u.id, created: Date.now(),
      color: /^#[0-9a-f]{6}$/i.test(req.body?.color) ? req.body.color : '#0d69ac',
      icon: GROUP_ICONS.includes(req.body?.icon) ? req.body.icon : GROUP_ICONS[0],
      approval: !!req.body?.approval, members: { [u.id]: 'owner' }, requests: [], wall: [], shout: null,
    };
    if (!u.primaryGroup) u.primaryGroup = id;
    log(u.id, -price, `Created the group ${name}`);
    db.save();
    res.json({ group: publicGroup(D.groups[id], u), robits: u.robits });
  });

  api.get('/groups/:id', (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (!isGroupAdmin(gr, req.user)) return bad(res, 'Only the group\'s admins can change it.', 403);
    const b = req.body || {};
    if (b.description !== undefined) gr.description = cleanText(b.description, 1000);
    if (/^#[0-9a-f]{6}$/i.test(b.color)) gr.color = b.color;
    if (GROUP_ICONS.includes(b.icon)) gr.icon = b.icon;
    if (b.approval !== undefined) gr.approval = !!b.approval;
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.delete('/groups/:id', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (gr.ownerId !== req.user.id && !can(req.user, 'moderator')) return bad(res, 'Only the owner can delete the group.', 403);
    delete D.groups[gr.id];
    for (const u of Object.values(D.users)) if (u.primaryGroup === gr.id) u.primaryGroup = null;
    db.save();
    res.json({ ok: true });
  });

  api.post('/groups/:id/join', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    const uid = req.user.id;
    if (gr.members[uid]) return bad(res, 'You are already in this group.');
    if (groupsOf(uid).length >= 100) return bad(res, 'You can be in at most 100 groups.');
    if (gr.approval) {
      gr.requests = gr.requests || [];
      if (!gr.requests.includes(uid)) gr.requests.push(uid);
      db.save();
      return res.json({ group: publicGroup(gr, req.user, true), pending: true });
    }
    gr.members[uid] = 'member';
    if (!req.user.primaryGroup) req.user.primaryGroup = gr.id;
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/leave', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    const uid = req.user.id;
    gr.requests = (gr.requests || []).filter((x) => x !== uid);
    if (gr.ownerId === uid) return bad(res, 'The owner can\'t leave. Give the group to someone else or delete it.');
    delete gr.members[uid];
    if (req.user.primaryGroup === gr.id) req.user.primaryGroup = null;
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/requests/:uid', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (!isGroupAdmin(gr, req.user)) return bad(res, 'Only the group\'s admins can do that.', 403);
    const uid = toInt(req.params.uid);
    if (!(gr.requests || []).includes(uid)) return bad(res, 'Request not found', 404);
    gr.requests = gr.requests.filter((x) => x !== uid);
    if (req.body?.accept && D.users[uid]) {
      gr.members[uid] = 'member';
      if (!D.users[uid].primaryGroup) D.users[uid].primaryGroup = gr.id;
    }
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/members/:uid', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    const uid = toInt(req.params.uid);
    const target = gr.members[uid];
    if (!target) return bad(res, 'That player is not in this group.', 404);
    const me = groupRole(gr, req.user.id);
    const mod = can(req.user, 'moderator');
    const action = String(req.body?.action || '');
    if (action === 'kick') {
      if (target === 'owner') return bad(res, 'The owner can\'t be removed.');
      if (!(me === 'owner' || mod || (me === 'admin' && target === 'member'))) return bad(res, 'You can\'t remove this member.', 403);
      delete gr.members[uid];
      if (D.users[uid] && D.users[uid].primaryGroup === gr.id) D.users[uid].primaryGroup = null;
    } else if (action === 'admin' || action === 'member') {
      if (me !== 'owner' && !mod) return bad(res, 'Only the owner can change roles.', 403);
      if (target === 'owner') return bad(res, 'The owner\'s role can\'t be changed.');
      gr.members[uid] = action;
    } else if (action === 'owner') {
      if (me !== 'owner' && !mod) return bad(res, 'Only the owner can give the group away.', 403);
      gr.members[gr.ownerId] = 'admin';
      gr.members[uid] = 'owner';
      gr.ownerId = uid;
    } else return bad(res, 'Unknown action.');
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/wall', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (!gr.members[req.user.id]) return bad(res, 'Join the group to post on its wall.', 403);
    if (limited(req, res, 'wall', 30, 600e3)) return;
    const text = cleanText(req.body?.text, 500);
    if (!text) return bad(res, 'Write something first.');
    gr.wall = gr.wall || [];
    gr.wall.push({ id: db.nextId('message'), userId: req.user.id, text, time: Date.now() });
    if (gr.wall.length > 500) gr.wall.splice(0, gr.wall.length - 500);
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.delete('/groups/:id/wall/:postId', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    const pid = toInt(req.params.postId);
    const post = (gr.wall || []).find((p) => p.id === pid);
    if (!post) return bad(res, 'Post not found', 404);
    if (post.userId !== req.user.id && !isGroupAdmin(gr, req.user)) return bad(res, 'You can\'t delete this post.', 403);
    gr.wall = gr.wall.filter((p) => p !== post);
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/shout', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (!isGroupAdmin(gr, req.user)) return bad(res, 'Only the group\'s admins can post a shout.', 403);
    const text = cleanText(req.body?.text, 255);
    gr.shout = text ? { text, userId: req.user.id, username: req.user.username, time: Date.now() } : null;
    db.save();
    res.json({ group: publicGroup(gr, req.user, true) });
  });

  api.post('/groups/:id/primary', requireUser, (req, res) => {
    const gr = groupFor(req, res); if (!gr) return;
    if (!gr.members[req.user.id]) return bad(res, 'You are not in this group.');
    req.user.primaryGroup = gr.id;
    db.save();
    res.json({ ok: true });
  });

  api.get('/users/:id/groups', (req, res) => {
    const id = toInt(req.params.id);
    const u = D.users[id];
    if (!u) return bad(res, 'User not found', 404);
    const list = groupsOf(id).map((gr) => ({ ...publicGroup(gr, req.user), role: gr.members[id] }));
    res.json({ groups: list, primary: u.primaryGroup && D.groups[u.primaryGroup] ? publicGroup(D.groups[u.primaryGroup], req.user) : null });
  });
  // Used by Player:GetRankInGroup() in games.
  manager.groupRank = (uid, gid) => {
    const gr = D.groups[toInt(gid)];
    const role = gr && gr.members[uid];
    return role ? ROLE_RANK[role] || 1 : 0;
  };
  manager.groupRole = (uid, gid) => {
    const gr = D.groups[toInt(gid)];
    const role = gr && gr.members[uid];
    return role ? role[0].toUpperCase() + role.slice(1) : 'Guest';
  };

  // ------------------------------------------------------------ account settings
  // Changing your username costs 1,000 R$ (like in 2019); old names stay on the profile.
  const USERNAME_PRICE = 1000;
  api.post('/account/username', requireUser, (req, res) => {
    const u = req.user;
    const name = String(req.body?.username || '').trim();
    if (!checkPassword(u, String(req.body?.password || ''))) return bad(res, 'Incorrect password.', 401);
    if (!validUsername(name)) return bad(res, 'Usernames can be 3 to 20 characters long, letters, numbers and at most one underscore.');
    if (name === u.username) return bad(res, 'That is already your username.');
    if (nameTaken(name, u, u.isAdmin)) return bad(res, 'This username is already in use.');
    const price = u.isAdmin ? 0 : USERNAME_PRICE;
    if (u.robits < price) return bad(res, `You need R$${USERNAME_PRICE} to change your username.`);
    u.robits -= price;
    u.previousNames = [u.username, ...(u.previousNames || [])].filter((n) => n.toLowerCase() !== name.toLowerCase()).slice(0, 10);
    u.username = name;
    log(u.id, -price, `Username changed to ${name}`);
    ensureOwner(db);
    db.save();
    res.json({ user: me(u) });
  });

  api.post('/account/password', requireUser, (req, res) => {
    const u = req.user;
    const next = String(req.body?.newPassword || '');
    if (!checkPassword(u, String(req.body?.password || ''))) return bad(res, 'Incorrect password.', 401);
    if (next.length < 6) return bad(res, 'Password must be at least 6 characters.');
    if (next.toLowerCase() === u.username.toLowerCase()) return bad(res, 'Password cannot be your username.');
    Object.assign(u, hashPassword(next));
    db.save();
    res.json({ ok: true });
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
    res.json({ items: items.map((i) => ({ ...publicItem(i, req.user), serial: serialOf(i, id) })) });
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
    if (req.query.creator) items = items.filter((i) => i.creatorId === toInt(req.query.creator));
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

  // ------------------------------------------------------------ custom items (BETA)
  // Players with the "items" right (and admins) make their own catalog items:
  // T-shirts and faces from a picture, shirts and pants from a pattern and
  // colours, hats, hair and pets from the classic models in their own colours.
  const HEX6 = /^#[0-9a-f]{6}$/i;
  const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const MODELS = {
    Hat: [...new Set(CATALOG.filter((i) => i.type === 'Hat').map((i) => i.data.model))],
    Hair: [...new Set(CATALOG.filter((i) => i.type === 'Hair').map((i) => i.data.model))],
    Pet: [...new Set(CATALOG.filter((i) => i.type === 'Pet').map((i) => i.data.model))],
  };
  const PATTERNS = ['plain', 'stripes', 'plaid', 'camo', 'hoodie', 'jeans', 'suit', 'bc'];
  const cleanItemData = (type, d = {}) => {
    const color = HEX6.test(d.color) ? d.color.toLowerCase() : '#c4281c';
    const accent = HEX6.test(d.accent) ? d.accent.toLowerCase() : '#f8f8f8';
    const image = typeof d.image === 'string' && IMG.test(d.image) && d.image.length <= 60000 ? d.image : null;
    if (type === 'TShirt' || type === 'Face') {
      if (!image) throw new Error('Upload or draw a picture first.');
      return type === 'Face' ? { face: 'custom', image } : { graphic: 'custom', image };
    }
    if (type === 'Shirt' || type === 'Pants') return { color, accent, pattern: PATTERNS.includes(d.pattern) ? d.pattern : 'plain' };
    if (type === 'Hat' || type === 'Hair' || type === 'Pet') {
      if (!MODELS[type].includes(d.model)) throw new Error('Pick a model.');
      return { model: d.model, color, accent };
    }
    throw new Error('This item type can\'t be created yet.');
  };

  api.get('/create/options', requireUser, (req, res) => {
    res.json({ types: ['TShirt', 'Shirt', 'Pants', 'Face', 'Hat', 'Hair', 'Pet'], models: MODELS, patterns: PATTERNS, allowed: can(req.user, 'items') || can(req.user, 'limiteds'), limiteds: can(req.user, 'limiteds'), onlyLimiteds: !can(req.user, 'items') });
  });

  // Limited items: a fixed stock; once it sells out the item can only be traded.
  const MAX_STOCK = 100000;
  const fmtStock = (n) => n.toLocaleString('en-US');
  const stockAmount = (v) => Math.trunc(+v);
  api.post('/catalog/create', requireUser, (req, res) => {
    const b = req.body || {};
    const limited = !!b.limited;
    if (!can(req.user, 'items') && !(limited && can(req.user, 'limiteds'))) return bad(res, 'You don\'t have permission to do that.', 403);
    if (limited && !can(req.user, 'limiteds')) return bad(res, 'Only players with the Limited Creator right can make Limited items.', 403);
    const stock = stockAmount(b.stock);
    if (limited && !(stock >= 1 && stock <= MAX_STOCK)) return bad(res, `The stock must be between 1 and ${fmtStock(MAX_STOCK)}.`);
    const type = String(b.type || '');
    const name = String(b.name || '').trim().slice(0, 50);
    if (name.length < 3) return bad(res, 'The name needs at least 3 characters.');
    const price = Math.trunc(+b.price || 0);
    if (price < 0 || price > 100000) return bad(res, 'The price must be between 0 and 100,000.');
    const mine = Object.values(D.items).filter((i) => i.creatorId === req.user.id && i.custom).length;
    if (mine >= 100 && !req.user.isAdmin) return bad(res, 'You have reached the maximum number of items.');
    let data;
    try { data = cleanItemData(type, b.data); } catch (e) { return bad(res, e.message); }
    const id = db.nextId('item');
    D.items[id] = {
      id, name, type, price, data, description: String(b.description || '').slice(0, 500),
      creatorId: req.user.id, created: Date.now(), sales: 0, limited, remaining: limited ? stock : null, stock: limited ? stock : null, custom: true,
    };
    // The creator keeps a copy of normal items; a Limited's whole stock goes on sale.
    if (!limited) (D.inventory[req.user.id] || (D.inventory[req.user.id] = [])).push(id);
    db.save();
    res.json({ item: publicItem(D.items[id], req.user) });
  });

  // The creator can take their item off sale; moderators can remove anything made by players.
  api.delete('/catalog/:id', requireUser, (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    if (!it.custom) return bad(res, 'Built-in items can\'t be deleted.');
    if (it.creatorId !== req.user.id && !can(req.user, 'moderator')) return bad(res, 'You don\'t have permission to do that.', 403);
    if (it.limited && it.sales > 0 && !can(req.user, 'moderator')) return bad(res, 'Players already own this Limited, so it can\'t be deleted.');
    delete D.items[it.id];
    delete D.serials[it.id];
    for (const list of Object.values(D.inventory)) { const i = list.indexOf(it.id); if (i >= 0) list.splice(i, 1); }
    for (const u of Object.values(D.users)) if (u.avatar && Array.isArray(u.avatar.wearing)) u.avatar.wearing = u.avatar.wearing.filter((x) => x !== it.id);
    db.save();
    res.json({ ok: true });
  });

  // Turns any item into a Limited with a stock (0 = off sale right away, trade only),
  // or back into a normal item.
  api.post('/catalog/:id/limited', requirePerm('limiteds'), (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    if (req.body?.limited === false) {
      it.limited = false; it.remaining = null; it.stock = null;
      delete D.serials[it.id]; it.lastSerial = 0;
    } else {
      const stock = stockAmount(req.body?.stock);
      if (!(stock >= 0 && stock <= MAX_STOCK)) return bad(res, `The stock must be between 0 and ${fmtStock(MAX_STOCK)}.`);
      it.limited = true; it.remaining = stock; it.stock = it.sales + stock;
      syncSerials(it); // the players who already own it get the first numbers
    }
    db.save();
    res.json({ item: publicItem(it, req.user) });
  });

  // ------------------------------------------------------------ Limited resale
  // Owners put their Limited copy up for sale at their own price. The buyer
  // gets that exact copy (with its serial number); the seller gets 70%.
  const RESALE_CUT = 0.7;
  if (!D.resales) D.resales = [];
  const validResale = (r) => {
    const it = D.items[r.itemId];
    return !!(it && it.limited && D.users[r.sellerId] && (D.inventory[r.sellerId] || []).includes(r.itemId));
  };
  const resalesFor = (itemId) => {
    const before = D.resales.length;
    D.resales = D.resales.filter(validResale); // drop listings whose copy is gone (traded, taken, deleted)
    if (D.resales.length !== before) db.save();
    return D.resales.filter((r) => r.itemId === itemId).sort((a, b) => a.price - b.price || a.created - b.created);
  };
  const bestPrice = (itemId) => {
    let best = null;
    for (const r of D.resales) if (r.itemId === itemId && validResale(r) && (best === null || r.price < best)) best = r.price;
    return best;
  };
  const publicResale = (r) => ({ id: r.id, price: r.price, created: r.created, serial: serialOf(D.items[r.itemId], r.sellerId), seller: publicUser(D.users[r.sellerId]) });

  api.get('/catalog/:id/resellers', (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    res.json({ resellers: resalesFor(it.id).slice(0, 100).map(publicResale) });
  });

  api.post('/catalog/:id/resell', requireUser, (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    if (!it.limited) return bad(res, 'Only Limited items can be sold by players.');
    if (!(D.inventory[req.user.id] || []).includes(it.id)) return bad(res, 'You don\'t own this item.');
    const price = Math.trunc(+req.body?.price || 0);
    if (price < 1 || price > 1e9) return bad(res, 'Enter a price of at least R$1.');
    D.resales = D.resales.filter((r) => !(r.itemId === it.id && r.sellerId === req.user.id));
    const r = { id: db.nextId('resale'), itemId: it.id, sellerId: req.user.id, price, created: Date.now() };
    D.resales.push(r);
    db.save();
    res.json({ resale: publicResale(r) });
  });

  api.post('/resales/:id/cancel', requireUser, (req, res) => {
    const r = D.resales.find((x) => x.id === toInt(req.params.id));
    if (!r) return bad(res, 'This item is no longer for sale.', 404);
    if (r.sellerId !== req.user.id && !can(req.user, 'economy')) return bad(res, 'You don\'t have permission to do that.', 403);
    D.resales = D.resales.filter((x) => x !== r);
    db.save();
    res.json({ ok: true });
  });

  api.post('/resales/:id/buy', requireUser, (req, res) => {
    const r = D.resales.find((x) => x.id === toInt(req.params.id));
    if (!r || !validResale(r)) return bad(res, 'This item is no longer for sale.', 404);
    const it = D.items[r.itemId];
    const seller = D.users[r.sellerId];
    const buyer = req.user;
    if (seller.id === buyer.id) return bad(res, 'You can\'t buy your own item.');
    if ((D.inventory[buyer.id] || []).includes(it.id)) return bad(res, 'You already own this item.');
    if (buyer.robits < r.price) return bad(res, `You need ${r.price - buyer.robits} more Robits to purchase this item.`);
    buyer.robits -= r.price;
    const cut = Math.floor(r.price * RESALE_CUT);
    seller.robits += cut;
    moveSerial(it.id, seller.id, buyer.id);
    takeItem(seller.id, it.id);
    (D.inventory[buyer.id] || (D.inventory[buyer.id] = [])).push(it.id);
    D.resales = D.resales.filter((x) => x !== r && !(x.itemId === it.id && x.sellerId === seller.id));
    log(buyer.id, -r.price, `Purchased ${it.name} from ${seller.username}`);
    log(seller.id, cut, `Sold ${it.name} to ${buyer.username}`);
    db.save();
    res.json({ ok: true, robits: buyer.robits, item: publicItem(it, buyer) });
  });

  // Who owns which copy of a Limited, by serial number.
  api.get('/catalog/:id/owners', (req, res) => {
    const it = D.items[toInt(req.params.id)];
    if (!it) return bad(res, 'Item not found', 404);
    if (!it.limited) return res.json({ owners: [] });
    const owners = Object.entries(D.serials[it.id] || {})
      .filter(([uid]) => D.users[uid] && (D.inventory[uid] || []).includes(it.id))
      .map(([uid, serial]) => ({ serial, user: publicUser(D.users[uid]) }))
      .sort((a, b) => a.serial - b.serial).slice(0, 500);
    res.json({ owners });
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
    giveSerial(it, req.user.id);
    db.save();
    res.json({ ok: true, robits: req.user.robits, item: publicItem(it, req.user) });
  });

  // ------------------------------------------------------------ admin code
  api.post('/auth/admin-code', requireUser, (req, res) => {
    if (limited(req, res, 'code', 10, 600e3)) return;
    if (!adminCodeHash) return bad(res, 'Admin codes are not enabled on this server.');
    const code = String(req.body?.code || '').trim().toUpperCase();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (!code || hash !== adminCodeHash) return bad(res, 'Wrong admin code.', 403);
    req.user.isAdmin = true;
    req.user.adminByCode = true;
    grantAdminPerks(req.user);
    ensureOwner(db);
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

  // Donate: Robits packs and memberships are bought by writing to support in
  // Telegram; admins set the price labels (Admin Panel → Promo Codes).
  const DONATE_PACKS = [400, 1000, 2500, 5000, 10000];
  if (!D.donate) D.donate = {};
  const donateInfo = () => ({
    telegram: D.donate.telegram || 'Robis_support',
    packs: DONATE_PACKS.map((robits) => ({ robits, price: D.donate.prices?.['r' + robits] || '' })),
    memberships: Object.keys(MEMBERSHIPS).filter((id) => id !== 'None').map((id) => ({ id, price: D.donate.prices?.[id] || '' })),
  });
  api.get('/economy/store', (req, res) => {
    res.json({
      memberships: Object.entries(MEMBERSHIPS).map(([id, m]) => ({ id, ...m })),
      current: req.user ? req.user.membership || 'None' : null,
      donate: donateInfo(),
    });
  });
  api.post('/admin/donate', requirePerm('economy'), (req, res) => {
    const b = req.body || {};
    const prices = {};
    for (const [k, v] of Object.entries(b.prices || {})) {
      if (!/^(r\d+|BuildersClub|TurboBuildersClub|OutrageousBuildersClub)$/.test(k)) continue;
      const t = String(v || '').trim().slice(0, 30);
      if (t) prices[k] = t;
    }
    D.donate.prices = prices;
    const tg = String(b.telegram || '').trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    if (tg && !/^[A-Za-z0-9_]{4,32}$/.test(tg)) return bad(res, 'That is not a Telegram username.');
    D.donate.telegram = tg || 'Robis_support';
    db.save();
    res.json({ donate: donateInfo() });
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

  // ---- Team Create: collaborators
  api.get('/games/:id/collaborators', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (!canEditPlace(g, req.user)) return bad(res, 'Forbidden', 403);
    res.json({ collaborators: (g.collaborators || []).map((id) => publicUser(D.users[id])).filter(Boolean), owner: publicUser(D.users[g.creatorId]) });
  });
  api.post('/games/:id/collaborators', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (g.creatorId !== req.user.id && !req.user.isAdmin) return bad(res, 'Only the game\'s owner can add collaborators.', 403);
    const name = String(req.body?.username || '').trim().toLowerCase();
    const u = Object.values(D.users).find((x) => !x.system && x.username.toLowerCase() === name);
    if (!u) return bad(res, 'User not found', 404);
    if (u.id === g.creatorId) return bad(res, 'The owner can already edit this place.');
    g.collaborators = [...new Set([...(g.collaborators || []), u.id])].slice(0, 20);
    db.save();
    res.json({ collaborators: g.collaborators.map((id) => publicUser(D.users[id])).filter(Boolean) });
  });
  api.delete('/games/:id/collaborators/:uid', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const uid = toInt(req.params.uid);
    if (g.creatorId !== req.user.id && !req.user.isAdmin && req.user.id !== uid) return bad(res, 'Forbidden', 403);
    g.collaborators = (g.collaborators || []).filter((x) => x !== uid);
    db.save();
    res.json({ collaborators: g.collaborators.map((id) => publicUser(D.users[id])).filter(Boolean) });
  });
  // Games you can edit together with others.
  api.get('/team-create', requireUser, (req, res) => {
    res.json({ games: Object.values(D.games).filter((g) => (g.collaborators || []).includes(req.user.id)).map((g) => publicGame(g, req.user)) });
  });

  api.get('/games/:id/place', (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    const canEdit = canEditPlace(g, req.user);
    if (!canEdit && !g.copyable) return bad(res, 'This place is not copyable.', 403);
    const place = db.readPlace(g.id);
    if (!place) return bad(res, 'Place file missing', 404);
    res.json({ place, game: publicGame(g, req.user) });
  });

  api.put('/games/:id/place', requireUser, (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    if (!canEditPlace(g, req.user)) return bad(res, 'You do not have permission to edit this place.', 403);
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
    const canEdit = canEditPlace(g, req.user);
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

  // Game Curators (and admins) choose the Featured games.
  api.post('/games/:id/feature', requirePerm('games'), (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    g.featured = !!req.body?.featured;
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
    ...publicUser(u), robits: u.robits, isAdmin: !!u.isAdmin, perms: u.perms || [], banned: isBanned(u), banReason: u.banReason || '', banUntil: u.banUntil || 0, deviceBan: !!(u.bannedDevices?.length || u.bannedIps?.length),
    items: (D.inventory[u.id] || []).length, games: Object.values(D.games).filter((g) => g.creatorId === u.id).length,
  });
  const target = (req, res) => {
    const u = D.users[toInt(req.params.id)];
    if (!u || u.system) { bad(res, 'User not found', 404); return null; }
    return u;
  };

  // ---- admin log: every admin action, who did it and to whom
  if (!D.adminLog) D.adminLog = [];
  const ACTIONS = {
    robits: (b) => `Robits ${+b.amount > 0 ? '+' : ''}${Math.trunc(+b.amount || 0)}`,
    membership: (b) => `Membership: ${MEMBERSHIPS[b.tier]?.name || b.tier}`,
    items: (b) => (b.all ? 'Gave all items' : `Gave item: ${D.items[toInt(b.itemId)]?.name || '?'}`),
    remove: (b) => (b.all ? 'Took all items' : `Took item: ${D.items[toInt(b.itemId)]?.name || '?'}`),
    admin: (b) => (b.isAdmin ? 'Made admin' : 'Removed admin'),
    flags: (b) => (b.flag ? `Badge ${b.flag} ${b.on ? 'given' : 'taken away'}` : `Badges: ${Object.keys(FLAGS).filter((f) => b[f]).join(', ') || 'none'}`),
    perms: (b) => `Permissions: ${(Array.isArray(b.perms) ? b.perms : []).join(', ') || 'none'}`,
    delete: () => 'Deleted account',
    ban: (b) => (b.banned ? `Banned (${b.duration || 'forever'}${b.device ? ', device + IP' : ''})${b.reason ? ': ' + String(b.reason).slice(0, 100) : ''}` : 'Unbanned'),
    password: () => 'Password reset',
    rename: (b) => `Renamed to ${String(b.username || '').trim()}`,
    kick: (b) => `Kicked from game${b.reason ? ': ' + String(b.reason).slice(0, 100) : ''}`,
    logout: () => 'Logged out everywhere',
    announcement: (b) => (String(b.text || '').trim() ? `Announcement: ${String(b.text).trim().slice(0, 120)}` : 'Cleared announcement'),
    gamedelete: () => 'Deleted game',
    promocodes: (b) => (b.op ? `Promo code ${String(b.code || '').toUpperCase()}: ${b.op}` : `Made ${b.code ? 'promo code ' + String(b.code).toUpperCase() : (Math.trunc(+b.count || 1)) + ' promo code(s)'}: R$${Math.trunc(+b.robits || 0)}${(b.items || []).length ? ' + ' + b.items.length + ' item(s)' : ''}${MEMBERSHIPS[b.membership] && b.membership !== 'None' ? ' + ' + MEMBERSHIPS[b.membership].name + (+b.membershipDays ? ' ' + Math.trunc(+b.membershipDays) + 'd' : '') : ''}`),
    donate: () => 'Changed donate prices',
  };
  api.use('/admin', (req, res, next) => {
    if (req.method !== 'POST' || !req.user) return next();
    const m = req.path.match(/^\/(?:users\/(\d+)|games\/(\d+))?\/?([a-z]+)?(?:\/([a-z]+))?$/);
    if (!m) return next();
    const key = m[4] === 'remove' ? 'remove' : m[2] ? 'gamedelete' : m[3];
    const describe = ACTIONS[key];
    if (!describe) return next();
    const targetUser = m[1] ? D.users[toInt(m[1])] : null;
    const targetGame = m[2] ? D.games[toInt(m[2])] : null;
    const entry = {
      time: Date.now(), by: req.user.id, byName: req.user.username, action: describe(req.body || {}),
      targetId: targetUser ? targetUser.id : null, targetName: targetUser ? targetUser.username : targetGame ? targetGame.name : '',
    };
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      D.adminLog.push(entry);
      if (D.adminLog.length > 3000) D.adminLog.splice(0, D.adminLog.length - 3000);
      db.save();
    });
    next();
  });

  api.get('/admin/log', requireStaff, (req, res) => {
    const uid = toInt(req.query.user);
    const list = D.adminLog.filter((e) => !uid || e.targetId === uid || e.by === uid);
    res.json({ log: list.slice(-300).reverse() });
  });

  // ---- site-wide announcement (a banner on every page and a message in every game)
  api.get('/announcement', (req, res) => res.json({ announcement: D.announcement || null }));
  api.post('/admin/announcement', requirePerm('moderator'), (req, res) => {
    const text = String(req.body?.text || '').trim().slice(0, 300);
    const color = ['blue', 'green', 'orange', 'red'].includes(req.body?.color) ? req.body.color : 'blue';
    D.announcement = text ? { text, color, by: req.user.username, time: Date.now() } : null;
    if (text) for (const srv of manager.allServers()) srv.broadcast({ t: 'sys', text: `[Announcement] ${text}` });
    db.save();
    res.json({ announcement: D.announcement });
  });

  // ------------------------------------------------------------ promo codes
  // Staff with the Economy right make codes (Robits and/or items); players
  // redeem them on the Promo Codes page, each code once per player.
  // D.promocodes[CODE] = { code, robits, items, maxUses (0 = no limit), usedBy, expires (0 = never), active, created, byName, note }
  if (!D.promocodes) D.promocodes = {};
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  const normCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
  const newCode = () => {
    for (;;) {
      const r = crypto.randomBytes(8);
      const bytes = r.bytes || r;
      let c = '';
      for (let i = 0; i < 8; i++) c += CODE_CHARS[bytes[i] % CODE_CHARS.length] + (i === 3 ? '-' : '');
      if (!D.promocodes[c]) return c;
    }
  };
  const promoState = (p) => (!p.active ? 'off' : p.expires && Date.now() > p.expires ? 'expired' : p.maxUses && p.usedBy.length >= p.maxUses ? 'used up' : 'active');
  const publicPromo = (p) => ({
    code: p.code, robits: p.robits, membership: p.membership || '', membershipName: p.membership ? MEMBERSHIPS[p.membership]?.name : '', memberDays: p.memberDays || 0,
    items: p.items.map((id) => D.items[id]).filter(Boolean).map((it) => ({ id: it.id, name: it.name, type: it.type })),
    maxUses: p.maxUses, uses: p.usedBy.length, expires: p.expires, created: p.created, byName: p.byName, note: p.note || '', state: promoState(p),
    lastUsers: p.usedBy.slice(-5).map((id) => D.users[id]?.username).filter(Boolean),
  });

  api.get('/admin/promocodes', requirePerm('economy'), (req, res) => {
    res.json({ codes: Object.values(D.promocodes).sort((a, b) => b.created - a.created).slice(0, 500).map(publicPromo) });
  });

  // Makes one custom code (code: 'ROBIS2019') or a batch of random ones (count).
  api.post('/admin/promocodes', requirePerm('economy'), (req, res) => {
    const b = req.body || {};
    const robits = Math.trunc(+b.robits || 0);
    if (robits < 0 || robits > 1e6) return bad(res, 'Robits must be between 0 and 1,000,000.');
    const items = [...new Set((Array.isArray(b.items) ? b.items : []).map(toInt))].filter((id) => D.items[id]).slice(0, 10);
    const membership = b.membership && b.membership !== 'None' ? String(b.membership) : '';
    if (membership && !MEMBERSHIPS[membership]) return bad(res, 'Unknown membership.');
    const memberDays = Math.trunc(+b.membershipDays || 0);
    if (memberDays < 0 || memberDays > 3650) return bad(res, 'Membership days must be between 0 (forever) and 3650.');
    if (!robits && !items.length && !membership) return bad(res, 'Add Robits, an item or a membership.');
    const maxUses = Math.trunc(+b.maxUses || 0);
    if (maxUses < 0 || maxUses > 1e6) return bad(res, 'Uses must be between 0 (no limit) and 1,000,000.');
    const days = +b.days || 0;
    if (days < 0 || days > 3650) return bad(res, 'Expiry must be between 0 (never) and 3650 days.');
    const custom = normCode(b.code);
    let codes;
    if (custom) {
      if (!/^[A-Z0-9-]{3,30}$/.test(custom)) return bad(res, 'A code is 3-30 letters, digits or dashes.');
      if (D.promocodes[custom]) return bad(res, 'That code already exists.');
      codes = [custom];
    } else {
      const count = Math.trunc(+b.count || 1);
      if (count < 1 || count > 200) return bad(res, 'Make between 1 and 200 codes at a time.');
      codes = Array.from({ length: count }, () => { const c = newCode(); D.promocodes[c] = { code: c }; return c; });
    }
    const now = Date.now();
    for (const code of codes) {
      D.promocodes[code] = { code, robits, items, membership, memberDays, maxUses, usedBy: [], expires: days ? now + days * 86400e3 : 0, active: true, created: now, by: req.user.id, byName: req.user.username, note: String(b.note || '').slice(0, 100) };
    }
    db.save();
    res.json({ codes: codes.map((c) => publicPromo(D.promocodes[c])) });
  });

  // { code, op: 'off' | 'on' | 'delete' }
  api.post('/admin/promocodes/edit', requirePerm('economy'), (req, res) => {
    const p = D.promocodes[normCode(req.body?.code)];
    if (!p) return bad(res, 'Code not found.', 404);
    const op = req.body?.op;
    if (op === 'delete') delete D.promocodes[p.code];
    else if (op === 'off' || op === 'on') p.active = op === 'on';
    else return bad(res, 'Unknown action.');
    db.save();
    res.json({ ok: true, code: op === 'delete' ? null : publicPromo(p) });
  });

  // Builders Club from a promo code: a better plan replaces yours for `days`
  // (0 = forever) and you go back to your old plan after; the same plan is
  // extended; a lower plan than yours is skipped.
  const TIERS = Object.keys(MEMBERSHIPS);
  const giveMembership = (u, tier, days) => {
    checkMembership(u);
    const cur = u.membership || 'None';
    const now = Date.now();
    const name = MEMBERSHIPS[tier].name;
    if (TIERS.indexOf(tier) < TIERS.indexOf(cur)) return { name, skipped: true };
    if (tier === cur) {
      if (!u.membershipUntil) return { name, skipped: true }; // already yours for good
      u.membershipUntil = days ? Math.max(u.membershipUntil, now) + days * 86400e3 : 0;
      if (!days) delete u.membershipAfter;
      return { name, until: u.membershipUntil };
    }
    // a better plan: remember the plan to go back to (if it was yours for good)
    if (days) u.membershipAfter = u.membershipUntil ? (u.membershipAfter || 'None') : cur;
    else delete u.membershipAfter;
    u.membership = tier;
    u.membershipUntil = days ? now + days * 86400e3 : 0;
    return { name, until: u.membershipUntil };
  };

  // Players redeem codes. Wrong guesses are limited so codes can't be brute-forced.
  const promoFails = new Map(); // userId -> [times]
  api.post('/promocodes/redeem', requireUser, (req, res) => {
    const u = req.user;
    const now = Date.now();
    const fails = (promoFails.get(u.id) || []).filter((t) => now - t < 10 * 60e3);
    if (fails.length >= 8) return bad(res, 'Too many wrong codes. Try again in a few minutes.', 429);
    const p = D.promocodes[normCode(req.body?.code)];
    const fail = (msg) => { fails.push(now); promoFails.set(u.id, fails); bad(res, msg); };
    if (!p) return fail('That code is not valid.');
    if (p.usedBy.includes(u.id)) return bad(res, 'You already used this code.');
    const st = promoState(p);
    if (st === 'off') return fail('That code is not valid.');
    if (st === 'expired') return bad(res, 'This code has expired.');
    if (st === 'used up') return bad(res, 'This code has been used up.');
    p.usedBy.push(u.id);
    const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
    const got = [];
    for (const id of p.items) {
      const it = D.items[id];
      if (!it || inv.includes(id)) continue;
      inv.push(id);
      giveSerial(it, u.id);
      got.push({ id: it.id, name: it.name, type: it.type });
    }
    if (p.robits) u.robits += p.robits;
    const member = p.membership ? giveMembership(u, p.membership, p.memberDays || 0) : null;
    const what = [...got.map((i) => i.name), member ? member.name : ''].filter(Boolean);
    log(u.id, p.robits, `Promo code ${p.code}` + (what.length ? ` (${what.join(', ')})` : ''));
    db.save();
    res.json({ robits: p.robits, items: got, membership: member, balance: u.robits });
  });

  api.get('/admin/overview', requireStaff, (req, res) => {
    const users = Object.values(D.users).filter((u) => !u.system);
    const day = Date.now() - 24 * 3600e3;
    res.json({
      stats: {
        users: users.length, games: Object.keys(D.games).length, items: Object.keys(D.items).length,
        robits: users.reduce((a, u) => a + (u.robits || 0), 0),
        playing: manager.allServers().reduce((a, s) => a + s.playerCount, 0),
        online: users.filter((u) => presence(u).status !== 'offline').length,
        banned: users.filter((u) => isBanned(u)).length,
        newToday: users.filter((u) => u.created > day).length,
        trades: (D.trades || []).filter((t) => t.status === 'pending').length,
        resales: D.resales.length,
      },
      announcement: D.announcement || null,
      users: users.sort((a, b) => b.lastOnline - a.lastOnline).map(adminUser),
      memberships: Object.entries(MEMBERSHIPS).map(([id, m]) => ({ id, name: m.name })),
      permissions: Object.entries(PERMISSIONS).map(([id, label]) => ({ id, label })),
      flags: Object.entries(FLAGS).map(([id, label]) => ({ id, label })),
    });
  });

  api.post('/admin/users/:id/robits', requirePerm('economy'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const amount = Math.trunc(+req.body?.amount || 0);
    if (!amount || Math.abs(amount) > 1e9) return bad(res, 'Enter an amount.');
    u.robits = Math.max(0, u.robits + amount);
    log(u.id, amount, amount > 0 ? `Gift from ${req.user.username}` : `Removed by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/membership', requirePerm('economy'), (req, res) => {
    const u = target(req, res); if (!u) return;
    if (!MEMBERSHIPS[req.body?.tier]) return bad(res, 'Unknown membership.');
    u.membership = req.body.tier;
    u.membershipUntil = 0; // set by staff: no end date
    delete u.membershipAfter;
    log(u.id, 0, `Membership set by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/items', requirePerm('economy'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const ids = req.body?.all ? Object.keys(D.items).map(Number) : [toInt(req.body?.itemId)].filter((i) => D.items[i]);
    if (!ids.length) return bad(res, 'Item not found.');
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...ids])];
    for (const id of ids) giveSerial(D.items[id], u.id);
    db.save();
    res.json({ user: adminUser(u) });
  });

  // Takes one item (or every item) away from a player.
  api.post('/admin/users/:id/items/remove', requirePerm('economy'), (req, res) => {
    const u = target(req, res); if (!u) return;
    const owned = [...(D.inventory[u.id] || [])];
    const ids = req.body?.all ? owned : [toInt(req.body?.itemId)].filter((i) => owned.includes(i));
    if (!ids.length) return bad(res, req.body?.all ? 'This player has no items.' : 'This player doesn\'t own that item.');
    for (const id of ids) takeItem(u.id, id);
    log(u.id, 0, ids.length === 1 ? `${D.items[ids[0]]?.name || 'Item'} removed by ${req.user.username}` : `${ids.length} items removed by ${req.user.username}`);
    db.save();
    res.json({ user: adminUser(u), removed: ids.length });
  });

  api.post('/admin/users/:id/admin', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.id === req.user.id) return bad(res, 'You can\'t change your own admin rights.');
    if (req.body?.isAdmin) { u.isAdmin = true; u.adminByCode = true; grantAdminPerks(u); ensureOwner(db); } else { u.adminByCode = false; revokeAdmin(u); }
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/flags', requireAdmin, (req, res) => {
    const u = D.users[toInt(req.params.id)];
    if (!u) return bad(res, 'User not found', 404);
    // Either one badge ({ flag, on }) or the whole set ({ verified: true, ... }).
    if (req.body?.flag) {
      if (!FLAGS[req.body.flag]) return bad(res, 'Unknown badge.');
      u.flags = { ...(u.flags || {}) };
      if (req.body.on) u.flags[req.body.flag] = true; else delete u.flags[req.body.flag];
    } else {
      u.flags = {};
      for (const f of Object.keys(FLAGS)) if (req.body?.[f]) u.flags[f] = true;
    }
    log(u.id, 0, `Badges set by ${req.user.username}: ${userFlags(u).join(', ') || 'none'}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/perms', requireAdmin, (req, res) => {
    const u = target(req, res); if (!u) return;
    const perms = Array.isArray(req.body?.perms) ? req.body.perms.filter((p) => PERMISSIONS[p]) : [];
    u.perms = [...new Set(perms)];
    log(u.id, 0, `Permissions set by ${req.user.username}: ${u.perms.join(', ') || 'none'}`);
    db.save();
    res.json({ user: adminUser(u) });
  });

  // Deletes an account for good: the player, their games, friends, messages and
  // trades. Unlike a device ban, the device and IP stay free, so the person can
  // sign up again with a new account.
  const deleteAccount = (u) => {
    const id = u.id;
    for (const [t, s] of Object.entries(D.sessions)) if (s.userId === id) delete D.sessions[t];
    const f = manager.findUser(id);
    if (f) f.server.kick(f.session, 'This account has been deleted.');
    for (const g of Object.values(D.games)) {
      if (g.creatorId !== id) continue;
      for (const srv of manager.serversFor(g.id)) srv.close();
      delete D.games[g.id];
    }
    for (const itemId of D.inventory[id] || []) dropSerial(itemId, id);
    delete D.inventory[id];
    delete D.friends[id];
    for (const list of Object.values(D.friends)) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }
    D.friendRequests = D.friendRequests.filter((r) => r.from !== id && r.to !== id);
    D.messages = D.messages.filter((m) => m.from !== id && m.to !== id);
    D.invites = (D.invites || []).filter((i) => i.from !== id && i.to !== id);
    D.trades = (D.trades || []).filter((t) => t.from !== id && t.to !== id);
    delete D.favorites[id];
    delete D.badges[id];
    // Groups: leave them; owned groups go to an admin (or the oldest member), or are deleted when empty.
    for (const gr of Object.values(D.groups || {})) {
      gr.requests = (gr.requests || []).filter((x) => x !== id);
      if (!gr.members[id]) continue;
      delete gr.members[id];
      if (gr.ownerId !== id) continue;
      const next = Object.entries(gr.members).sort(([, a], [, b]) => (a === 'admin' ? 0 : 1) - (b === 'admin' ? 0 : 1))[0];
      if (next) { gr.ownerId = +next[0]; gr.members[next[0]] = 'owner'; } else delete D.groups[gr.id];
    }
    delete D.users[id];
    db.save();
  };

  api.post('/admin/users/:id/delete', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.id === req.user.id) return bad(res, 'Delete your own account in Settings.');
    if (u.isAdmin && !req.user.isAdmin) return bad(res, 'Only admins can delete an admin.', 403);
    log(req.user.id, 0, `Deleted the account ${u.username}`);
    deleteAccount(u);
    res.json({ ok: true });
  });

  api.post('/account/delete', requireUser, (req, res) => {
    const u = req.user;
    if (!checkPassword(u, String(req.body?.password || ''))) return bad(res, 'Incorrect password.', 401);
    deleteAccount(u);
    setCookie(res, sessionCookie('', 0));
    res.json({ ok: true });
  });

  // Full info about one player for the Admin Panel.
  api.get('/admin/users/:id', requireStaff, (req, res) => {
    const u = target(req, res); if (!u) return;
    res.json({
      user: {
        ...adminUser(u), previousNames: u.previousNames || [], lastOnline: u.lastOnline || 0,
        devices: (u.devices || []).length, ips: (u.ips || []).length, sessions: Object.values(D.sessions).filter((x) => x.userId === u.id).length,
        friends: (D.friends[u.id] || []).length, tradePrivacy: u.tradePrivacy || 'everyone',
        trades: (D.trades || []).filter((t) => t.from === u.id || t.to === u.id).length,
      },
      transactions: D.transactions.filter((t) => t.userId === u.id).slice(-40).reverse(),
      log: D.adminLog.filter((e) => e.targetId === u.id).slice(-40).reverse(),
    });
  });

  // Password reset: a new password (typed by the admin, or a random one) and every session is logged out.
  const randomPassword = () => {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    return [...crypto.randomBytes(10)].map((b) => abc[b % abc.length]).join('');
  };
  const staffGuard = (req, res, u) => {
    if (u.id === req.user.id) { bad(res, 'Use Settings for your own account.'); return false; }
    if (u.isAdmin && !req.user.isAdmin) { bad(res, 'Only admins can do that to an admin.', 403); return false; }
    return true;
  };
  const logoutEverywhere = (u) => { for (const [t, x] of Object.entries(D.sessions)) if (x.userId === u.id) delete D.sessions[t]; };
  api.post('/admin/users/:id/password', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u || !staffGuard(req, res, u)) return;
    const typed = String(req.body?.password || '');
    if (typed && typed.length < 6) return bad(res, 'Password must be at least 6 characters.');
    const password = typed || randomPassword();
    Object.assign(u, hashPassword(password));
    logoutEverywhere(u);
    db.save();
    res.json({ password, user: adminUser(u) });
  });

  api.post('/admin/users/:id/logout', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u || !staffGuard(req, res, u)) return;
    logoutEverywhere(u);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/rename', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.isAdmin && !req.user.isAdmin && u.id !== req.user.id) return bad(res, 'Only admins can do that to an admin.', 403);
    const name = String(req.body?.username || '').trim();
    if (!validUsername(name)) return bad(res, 'Usernames can be 3 to 20 characters long, letters, numbers and at most one underscore.');
    if (name === u.username) return bad(res, 'That is already their username.');
    if (nameTaken(name, u, u.isAdmin)) return bad(res, 'This username is already in use.');
    u.previousNames = [u.username, ...(u.previousNames || [])].filter((n) => n.toLowerCase() !== name.toLowerCase()).slice(0, 10);
    u.username = name;
    ensureOwner(db);
    db.save();
    res.json({ user: adminUser(u) });
  });

  api.post('/admin/users/:id/kick', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u || !staffGuard(req, res, u)) return;
    const f = manager.findUser(u.id);
    if (!f) return bad(res, 'This player is not in a game.');
    const reason = String(req.body?.reason || '').trim().slice(0, 100);
    f.server.kick(f.session, `You were kicked by a moderator.${reason ? ' Reason: ' + reason : ''}`);
    res.json({ user: adminUser(u) });
  });

  // Games and items lists for the Admin Panel tabs.
  api.get('/admin/games', requireStaff, (req, res) => {
    const games = Object.values(D.games).sort((a, b) => b.updated - a.updated).map((g) => ({
      id: g.id, name: g.name, isPublic: !!g.isPublic, featured: !!g.featured, visits: g.visits || 0, updated: g.updated, created: g.created,
      playing: manager.serversFor(g.id).reduce((a, s) => a + s.playerCount, 0),
      creator: D.users[g.creatorId] ? { id: g.creatorId, username: D.users[g.creatorId].username } : null,
    }));
    res.json({ games });
  });
  api.post('/admin/games/:id/delete', requirePerm('moderator'), (req, res) => {
    const g = D.games[toInt(req.params.id)];
    if (!g) return bad(res, 'Game not found', 404);
    for (const srv of manager.serversFor(g.id)) srv.close();
    delete D.games[g.id];
    db.save();
    res.json({ ok: true });
  });
  api.get('/admin/items', requireStaff, (req, res) => {
    const items = Object.values(D.items).filter((i) => i.custom || i.limited).sort((a, b) => b.created - a.created).map((i) => ({
      ...publicItem(i, null), owners: Object.values(D.inventory).filter((l) => l.includes(i.id)).length,
      listings: D.resales.filter((r) => r.itemId === i.id).length,
    }));
    res.json({ items });
  });

  api.post('/admin/users/:id/ban', requirePerm('moderator'), (req, res) => {
    const u = target(req, res); if (!u) return;
    if (u.id === req.user.id) return bad(res, 'You can\'t ban yourself.');
    if (u.isAdmin && req.body?.banned) return bad(res, 'Remove admin rights before banning an admin.');
    if (!req.user.isAdmin && staff(u) && req.body?.banned) return bad(res, 'Only admins can ban other staff.');
    setBan(u, !!req.body?.banned, req.body?.reason, { device: !!req.body?.device, ms: BAN_TIMES[req.body?.duration] || 0 });
    res.json({ user: adminUser(u) });
  });

  api.use((req, res) => bad(res, 'Not found', 404));
  return api;
}
