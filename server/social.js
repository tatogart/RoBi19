// Wishlists (friends see them and can gift), wrapped gifts that are unwrapped
// with an animation, Black Friday sales with a countdown, partial unbans (a
// ban becomes a mute or a trade ban) and ban appeals with a screenshot or a
// video.
import crypto from 'node:crypto';
// bare names: the phone / standalone build swaps them for empty modules (then files stay in memory)
import fs from 'fs';
import path from 'path';

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, d = lo) => { const n = Math.trunc(+v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const HEX = /^#[0-9a-f]{6}$/i;
export const WRAPS = ['#e8413c', '#00a2ff', '#02b757', '#7b5cff', '#ffc400', '#ff4d8d', '#1b1b1b'];
// Attachments for appeals: pictures and short videos, as data URLs.
const MEDIA = /^data:(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime));base64,[A-Za-z0-9+/=]+$/;
const MAX_MEDIA = 12 * 1024 * 1024; // characters of the data URL (~9 MB of file)

export function installSocial(api, ctx) {
  const { db, requireUser, requireAdmin, requireStaff, bad, log, giveSerial, publicUser, publicItem, isBanned, setBan, hooks, banDetails } = ctx;
  const D = db.data;
  if (!D.gifts) D.gifts = [];
  if (!D.sales) D.sales = [];
  if (!D.appeals) D.appeals = [];
  const now = () => Date.now();
  // appeal screenshots / videos live in files next to the database
  const hasFiles = typeof fs.writeFileSync === 'function' && !!db.dir;
  const mediaDir = hasFiles ? path.join(db.dir, 'appeals') : '';
  const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const mediaPath = (a) => (hasFiles ? path.join(mediaDir, `${a.id}.${EXT[a.mediaType] || 'bin'}`) : '');
  const memMedia = new Map(); // standalone: appeal id -> data URL
  const friends = (a, b) => (D.friends[a] || []).includes(b);

  // ---------------------------------------------------------------- sales
  // A sale: { id, name, percent, scope: 'all' | Hat | Shirt | ..., starts, ends }
  const liveSale = (it) => {
    if (!it || it.limited || it.offsale || !it.price) return null;
    const t = now();
    let best = null;
    for (const s of D.sales) {
      if (s.starts > t || s.ends <= t) continue;
      if (s.scope !== 'all' && s.scope !== it.type && !(s.scope === 'Accessories' && (it.type === 'Hat' || it.type === 'Hair')) && !(s.scope === 'Clothing' && ['Shirt', 'Pants', 'TShirt'].includes(it.type))) continue;
      if (!best || s.percent > best.percent) best = s;
    }
    return best;
  };
  hooks.salePrice = (it) => {
    const s = liveSale(it);
    return s ? Math.max(1, Math.ceil(it.price * (1 - s.percent / 100))) : it.price;
  };
  hooks.saleInfo = (it) => {
    const s = liveSale(it);
    return s ? { percent: s.percent, ends: s.ends, name: s.name, was: it.price } : null;
  };
  const saleView = (s) => ({ id: s.id, name: s.name, percent: s.percent, scope: s.scope, starts: s.starts, ends: s.ends, live: s.starts <= now() && s.ends > now() });
  // Public: the sale that's on (or the next one, for "starts in").
  api.get('/sales', (req, res) => {
    const t = now();
    D.sales = D.sales.filter((s) => s.ends > t - 7 * 86400e3);
    const live = D.sales.filter((s) => s.starts <= t && s.ends > t).sort((a, b) => b.percent - a.percent);
    const next = D.sales.filter((s) => s.starts > t).sort((a, b) => a.starts - b.starts)[0];
    res.json({ live: live.map(saleView), next: next ? saleView(next) : null });
  });
  api.get('/admin/sales', requireAdmin, (req, res) => res.json({ sales: D.sales.slice().reverse().map(saleView) }));
  api.post('/admin/sales', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'delete' || b.op === 'end') {
      const s = D.sales.find((x) => x.id === +b.id);
      if (!s) return bad(res, 'Sale not found', 404);
      if (b.op === 'delete') D.sales = D.sales.filter((x) => x !== s); else s.ends = now();
      db.save();
      return res.json({ ok: true });
    }
    const percent = int(b.percent, 5, 90, 0);
    if (!percent) return bad(res, 'The discount is 5% to 90%.');
    const starts = +b.starts > now() ? +b.starts : now();
    const ends = +b.ends;
    if (!(ends > starts)) return bad(res, 'The sale must end after it starts.');
    const scopes = ['all', 'Accessories', 'Clothing', 'Hat', 'Hair', 'Face', 'Shirt', 'Pants', 'TShirt', 'Gear', 'Pet'];
    const s = { id: (D.sales.at(-1)?.id || 0) + 1, name: clean(b.name, 40) || 'Black Friday', percent, scope: scopes.includes(b.scope) ? b.scope : 'all', starts, ends, by: req.user.username };
    D.sales.push(s);
    db.save();
    res.json({ ok: true, sale: saleView(s) });
  });

  // ---------------------------------------------------------------- wishlist
  api.get('/users/:id/wishlist', (req, res) => {
    const u = D.users[+req.params.id];
    if (!u) return bad(res, 'User not found', 404);
    const me = req.user;
    const allowed = me && (me.id === u.id || friends(me.id, u.id) || me.isAdmin);
    if (!allowed) return res.json({ hidden: true, items: [] });
    const owned = new Set(D.inventory[u.id] || []);
    const items = (u.wishlist || []).map((id) => D.items[id]).filter((it) => it && !owned.has(it.id)).map((it) => ({ ...publicItem(it, me), canGift: !it.offsale && !(it.limited && it.remaining !== null && it.remaining <= 0) }));
    res.json({ hidden: false, items });
  });
  api.post('/wishlist', requireUser, (req, res) => {
    const u = req.user;
    const it = D.items[+req.body?.itemId];
    if (!it) return bad(res, 'Item not found', 404);
    const list = u.wishlist || (u.wishlist = []);
    const on = req.body?.on !== false;
    if (on && !list.includes(it.id)) {
      if (list.length >= 50) return bad(res, 'Your wishlist is full (50 items).');
      list.push(it.id);
    } else if (!on) u.wishlist = list.filter((x) => x !== it.id);
    db.save();
    res.json({ wished: (u.wishlist || []).includes(it.id) });
  });

  // ---------------------------------------------------------------- gifts
  // Buy an item for a friend: it arrives wrapped, they unwrap it.
  api.post('/catalog/:id/gift', requireUser, (req, res) => {
    const from = req.user;
    const it = D.items[+req.params.id];
    const to = D.users[+req.body?.to];
    if (!it) return bad(res, 'Item not found', 404);
    if (!to || to.system || to.id === from.id) return bad(res, 'Pick a friend to gift.');
    if (!friends(from.id, to.id)) return bad(res, 'You can only send gifts to friends.');
    if (isBanned(to)) return bad(res, 'This player can\'t get gifts right now.');
    if (it.offsale) return bad(res, 'This item is not for sale.');
    if (it.limited && it.remaining !== null && it.remaining <= 0) return bad(res, 'This item is sold out.');
    const inv = D.inventory[to.id] || (D.inventory[to.id] = []);
    if (inv.includes(it.id) || D.gifts.some((g) => g.to === to.id && g.itemId === it.id && !g.opened)) return bad(res, `${to.username} already has this item.`);
    const price = hooks.salePrice(it);
    if (from.robits < price) return bad(res, `You need ${price - from.robits} more Robits to gift this item.`);
    from.robits -= price;
    const creator = D.users[it.creatorId];
    if (creator && creator.id !== from.id && price > 0) {
      const cut = Math.floor(price * 0.7);
      creator.robits += cut;
      log(creator.id, cut, `Sold ${it.name} (a gift)`);
    }
    log(from.id, -price, `Gift for ${to.username}: ${it.name}`);
    inv.push(it.id);
    it.sales++;
    if (it.limited && it.remaining !== null) it.remaining--;
    giveSerial(it, to.id);
    // it came off their wishlist
    if (to.wishlist) to.wishlist = to.wishlist.filter((x) => x !== it.id);
    const g = { id: (D.gifts.at(-1)?.id || 0) + 1, from: from.id, to: to.id, itemId: it.id, message: clean(req.body?.message, 200), wrap: HEX.test(req.body?.wrap) ? req.body.wrap : WRAPS[0], created: now(), opened: 0 };
    D.gifts.push(g);
    if (D.gifts.length > 5000) D.gifts.splice(0, 1000);
    db.save();
    res.json({ ok: true, robits: from.robits, gift: g.id });
  });
  const giftView = (g, viewer) => ({
    id: g.id, from: publicUser(D.users[g.from]), message: g.message, wrap: g.wrap, created: g.created, opened: g.opened,
    item: D.items[g.itemId] ? publicItem(D.items[g.itemId], viewer) : null,
  });
  // Unopened presents (shown on every page) and the last opened ones.
  api.get('/gifts', requireUser, (req, res) => {
    const mine = D.gifts.filter((g) => g.to === req.user.id && D.items[g.itemId]);
    res.json({ unopened: mine.filter((g) => !g.opened).map((g) => giftView(g, req.user)), opened: mine.filter((g) => g.opened).slice(-20).reverse().map((g) => giftView(g, req.user)) });
  });
  api.post('/gifts/:id/open', requireUser, (req, res) => {
    const g = D.gifts.find((x) => x.id === +req.params.id && x.to === req.user.id);
    if (!g) return bad(res, 'Gift not found', 404);
    if (!g.opened) { g.opened = now(); db.save(); }
    res.json({ gift: giftView(g, req.user) });
  });

  // ---------------------------------------------------------------- restrictions
  // Instead of a full unban: the player may play, but can't chat (mute) or
  // can't trade, until a time.
  const restriction = (u) => {
    const t = now();
    return { mute: u.muteUntil > t ? u.muteUntil : 0, trade: u.tradeBanUntil > t ? u.tradeBanUntil : 0 };
  };
  hooks.isMuted = (u) => !!u && u.muteUntil > now();
  hooks.isTradeBanned = (u) => !!u && u.tradeBanUntil > now();
  hooks.restriction = restriction;
  const fmtLeft = (t) => { const h = Math.ceil((t - now()) / 3600e3); return h > 48 ? `${Math.ceil(h / 24)} days` : `${h} hour${h === 1 ? '' : 's'}`; };
  hooks.muteMessage = (u) => `You are muted for ${fmtLeft(u.muteUntil)}${u.muteReason ? ': ' + u.muteReason : ''}.`;
  hooks.tradeMessage = (u) => `Trading is blocked for your account for ${fmtLeft(u.tradeBanUntil)}${u.tradeBanReason ? ': ' + u.tradeBanReason : ''}.`;
  const DAYS = { '1h': 3600e3, '1d': 86400e3, '3d': 3 * 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3, '365d': 365 * 86400e3 };
  // Replaces a ban (or adds a restriction): { kind: 'unban' | 'mute' | 'trade' | 'both', time: '7d', reason }
  const softenBan = (u, b, by) => {
    const kind = ['unban', 'mute', 'trade', 'both'].includes(b.kind) ? b.kind : 'unban';
    const ms = DAYS[b.time] || DAYS['7d'];
    const reason = clean(b.reason, 200);
    (u.banHistory || []).forEach((h) => { if (!h.endedAt) { h.endedAt = now(); h.endedHow = kind === 'unban' ? 'unbanned' : `replaced with ${kind === 'both' ? 'mute + trade ban' : kind === 'mute' ? 'a mute' : 'a trade ban'} (${b.time || '7d'})`; h.endedBy = by; } });
    if (isBanned(u)) setBan(u, false);
    if (kind === 'mute' || kind === 'both') { u.muteUntil = now() + ms; u.muteReason = reason; }
    if (kind === 'trade' || kind === 'both') {
      u.tradeBanUntil = now() + ms; u.tradeBanReason = reason;
      for (const t of D.trades) if (t.status === 'pending' && (t.from === u.id || t.to === u.id)) { t.status = 'declined'; t.reason = 'Trading was blocked'; t.updated = now(); }
    }
    db.save();
    return kind;
  };
  api.post('/admin/users/:id/soften', requireStaff, (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) return bad(res, 'User not found', 404);
    const kind = softenBan(u, req.body || {}, req.user.username);
    res.json({ ok: true, kind, restriction: restriction(u), banned: isBanned(u) });
  });
  api.post('/admin/users/:id/restrict', requireStaff, (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) return bad(res, 'User not found', 404);
    const b = req.body || {};
    if (b.clear) { u.muteUntil = 0; u.tradeBanUntil = 0; db.save(); return res.json({ ok: true, restriction: restriction(u) }); }
    const ms = DAYS[b.time] || DAYS['1d'];
    if (b.kind === 'mute' || b.kind === 'both') { u.muteUntil = now() + ms; u.muteReason = clean(b.reason, 200); }
    if (b.kind === 'trade' || b.kind === 'both') { u.tradeBanUntil = now() + ms; u.tradeBanReason = clean(b.reason, 200); }
    db.save();
    res.json({ ok: true, restriction: restriction(u) });
  });
  api.get('/me/restrictions', requireUser, (req, res) => res.json(restriction(req.user)));

  // ---------------------------------------------------------------- appeals
  // A banned player can't log in, so the login answer gives them a one-time
  // appeal key (made when the password was right).
  hooks.appealKey = (u) => {
    if (!u.appealKey || u.appealKeyAt < now() - 3600e3) { u.appealKey = crypto.randomBytes(18).toString('hex'); u.appealKeyAt = now(); db.save(); }
    return u.appealKey;
  };
  const byKey = (key) => /^[0-9a-f]{36}$/.test(String(key || '')) && Object.values(D.users).find((u) => u.appealKey === key && u.appealKeyAt > now() - 3600e3);
  const appealView = (a, full = false) => {
    const u = D.users[a.userId];
    return {
      id: a.id, status: a.status, created: a.created, decided: a.decided || 0, decidedBy: a.decidedBy || '', answer: a.answer || '', outcome: a.outcome || '',
      ban: a.ban, reason: a.reason, explanation: a.explanation, media: !!a.media, mediaType: a.mediaType || '',
      user: u ? { id: u.id, username: u.username, banned: isBanned(u), banReason: u.banReason || '', banUntil: u.banUntil || 0 } : null,
    };
  };
  const APPEAL_REASONS = ['I didn\'t do it', 'Someone else used my account', 'It was a mistake / misunderstanding', 'The ban is too long', 'I\'m sorry and won\'t do it again', 'Other'];
  // The banned player's bans (to pick one) and their earlier appeals.
  api.get('/appeals/info', (req, res) => {
    const u = byKey(req.query.key);
    if (!u) return bad(res, 'This appeal link has expired. Log in again to get a new one.', 403);
    const bans = (u.banHistory || []).slice().reverse().map((h) => ({ id: h.id, reason: h.reason || 'No reason given', time: h.time, until: h.until || 0, by: h.by ? 'Robis team' : '', active: !h.endedAt }));
    if (!bans.length && isBanned(u)) bans.push({ id: 0, reason: u.banReason || 'No reason given', time: 0, until: u.banUntil || 0, active: true });
    res.json({ username: u.username, banned: isBanned(u), details: banDetails(u), bans, reasons: APPEAL_REASONS, appeals: D.appeals.filter((a) => a.userId === u.id).slice(-5).reverse().map((a) => appealView(a)) });
  });
  api.post('/appeals', (req, res) => {
    const b = req.body || {};
    const u = byKey(b.key);
    if (!u) return bad(res, 'This appeal link has expired. Log in again to get a new one.', 403);
    if (D.appeals.some((a) => a.userId === u.id && a.status === 'open')) return bad(res, 'You already have an appeal waiting. The Robis team will answer it soon.');
    const recent = D.appeals.filter((a) => a.userId === u.id && a.created > now() - 86400e3).length;
    if (recent >= 3) return bad(res, 'You can send 3 appeals a day at most.');
    const explanation = clean(b.explanation, 2000);
    if (explanation.length < 20) return bad(res, 'Explain what happened (20 letters or more).');
    const reason = APPEAL_REASONS.includes(b.reason) ? b.reason : 'Other';
    let media = '';
    if (b.media) {
      const m = String(b.media);
      if (m.length > MAX_MEDIA) return bad(res, 'The file is too big (9 MB at most).');
      if (!MEDIA.test(m)) return bad(res, 'Only pictures (PNG, JPG, GIF, WEBP) and videos (MP4, WEBM, MOV).');
      media = m;
    }
    const banId = int(b.banId, 0, 1e9, 0);
    const h = (u.banHistory || []).find((x) => x.id === banId);
    const a = {
      id: (D.appeals.at(-1)?.id || 0) + 1, userId: u.id, status: 'open', created: now(),
      ban: h ? { id: h.id, reason: h.reason || '', time: h.time, until: h.until || 0 } : { id: 0, reason: u.banReason || '', time: 0, until: u.banUntil || 0 },
      reason, explanation, media: false, mediaType: media ? media.slice(5, media.indexOf(';')) : '',
    };
    if (media) {
      if (hasFiles) {
        fs.mkdirSync(mediaDir, { recursive: true });
        fs.writeFileSync(mediaPath(a), Buffer.from(media.slice(media.indexOf(',') + 1), 'base64'));
      } else memMedia.set(a.id, media);
      a.media = true;
    }
    D.appeals.push(a);
    if (D.appeals.length > 2000) D.appeals.splice(0, 500);
    db.save();
    res.json({ ok: true, appeal: appealView(a) });
  });
  api.get('/admin/appeals', requireStaff, (req, res) => {
    const status = ['open', 'accepted', 'denied'].includes(req.query.status) ? req.query.status : 'open';
    res.json({ appeals: D.appeals.filter((a) => a.status === status).slice(-100).reverse().map((a) => appealView(a)), open: D.appeals.filter((a) => a.status === 'open').length });
  });
  api.get('/admin/appeals/:id', requireStaff, (req, res) => {
    const a = D.appeals.find((x) => x.id === +req.params.id);
    if (!a) return bad(res, 'Appeal not found', 404);
    const u = D.users[a.userId];
    res.json({ appeal: appealView(a, true), history: (u?.banHistory || []).slice().reverse() });
  });
  // the screenshot / video of an appeal
  api.get('/admin/appeals/:id/media', requireStaff, (req, res) => {
    const a = D.appeals.find((x) => x.id === +req.params.id);
    if (!a || !a.media) return bad(res, 'No file', 404);
    if (!hasFiles) {
      // the phone / standalone version: the file is kept in memory
      const m = memMedia.get(a.id);
      if (!m) return bad(res, 'No file', 404);
      const bin = atob(m.slice(m.indexOf(',') + 1));
      res.setHeader('Content-Type', a.mediaType);
      res.body = new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: a.mediaType });
      return;
    }
    if (!fs.existsSync(mediaPath(a))) return bad(res, 'No file', 404);
    res.setHeader('Content-Type', a.mediaType);
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.sendFile(path.resolve(mediaPath(a)));
  });
  // { decision: 'deny' | 'unban' | 'mute' | 'trade' | 'both', time, answer }
  api.post('/admin/appeals/:id', requireStaff, (req, res) => {
    const a = D.appeals.find((x) => x.id === +req.params.id);
    if (!a) return bad(res, 'Appeal not found', 404);
    if (a.status !== 'open') return bad(res, 'This appeal was already answered.');
    const b = req.body || {};
    const u = D.users[a.userId];
    if (!u) return bad(res, 'User not found', 404);
    a.answer = clean(b.answer, 500);
    a.decided = now();
    a.decidedBy = req.user.username;
    if (b.decision === 'deny') { a.status = 'denied'; a.outcome = 'The ban stays'; } else {
      const kind = softenBan(u, { kind: b.decision, time: b.time, reason: a.answer || 'After an appeal' }, req.user.username);
      a.status = 'accepted';
      a.outcome = kind === 'unban' ? 'Unbanned' : `Unbanned, but ${kind === 'both' ? 'muted and can\'t trade' : kind === 'mute' ? 'muted' : 'can\'t trade'} for ${b.time || '7d'}`;
    }
    db.save();
    res.json({ ok: true, appeal: appealView(a) });
  });
}
