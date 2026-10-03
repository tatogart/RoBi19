// The big Admin Panel update: dashboard numbers and charts, live game
// servers, site settings (maintenance, sign-ups, starting Robits, chat
// words, social links), broadcasts to every player and alt accounts.
import { setExtraWords } from './game/chatfilter.js';
import { officialAccount } from './seed/seed.js';

export const DEFAULT_SOCIALS = [{ type: 'telegram', label: 'Telegram', url: 'https://t.me/Robisgame' }, { type: 'vk', label: 'VK', url: 'https://vk.ru/club241960834' }];
const SOCIAL_TYPES = ['telegram', 'youtube', 'discord', 'tiktok', 'vk', 'other'];

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// Daily numbers for the dashboard: D.daily['2026-10-02'] = { active: [ids], plays: n, players: [ids] }
export function markActive(D, uid) {
  const d = (D.daily || (D.daily = {}));
  const k = dayKey();
  const e = d[k] || (d[k] = { active: [], plays: 0, players: [] });
  if (!e.active.includes(uid)) e.active.push(uid);
  if (Object.keys(d).length > 45) for (const old of Object.keys(d).sort().slice(0, Object.keys(d).length - 45)) delete d[old];
}
export function countPlay(D, uid) {
  markActive(D, uid);
  const e = D.daily[dayKey()];
  e.plays++;
  if (!e.players.includes(uid)) e.players.push(uid);
}

export function siteSettings(D) {
  const S = D.settings || (D.settings = {});
  if (!S.socials) S.socials = DEFAULT_SOCIALS.map((x) => ({ ...x }));
  // the VK group came later: add it once to worlds that already had socials
  if (!S.vkAdded) { S.vkAdded = true; if (!S.socials.some((x) => x.type === 'vk')) S.socials.push({ ...DEFAULT_SOCIALS[1] }); }
  if (S.signups === undefined) S.signups = true;
  if (S.startRobits === undefined) S.startRobits = 100;
  if (!S.maintenance) S.maintenance = { on: false, message: '' };
  if (!S.bannedWords) S.bannedWords = [];
  if (!S.discord) S.discord = { on: false, appId: '', secret: '' };
  return S;
}
// Settings for the Admin Panel: the Discord secret never leaves the server.
const adminView = (S) => ({ ...S, discord: { on: !!S.discord.on, appId: S.discord.appId, hasSecret: !!S.discord.secret } });
export const isStaffUser = (u) => !!u && (u.isAdmin || (u.perms || []).length > 0);

export function installAdminPlus(api, { db, manager, requireAdmin, requireStaff, bad, log, presence, isBanned, publicUser, version }) {
  const D = db.data;
  const S = siteSettings(D);
  setExtraWords(S.bannedWords);
  const users = () => Object.values(D.users).filter((u) => !u.system);

  // Public: what every page needs (social links, maintenance notice, sign-ups).
  api.get('/site', (req, res) => {
    res.json({ socials: S.socials, maintenance: S.maintenance.on ? S.maintenance : null, signups: S.signups !== false, staff: isStaffUser(req.user),
      discord: S.discord.on && S.discord.appId ? { appId: S.discord.appId } : null });
  });

  // Discord Activity: the page inside Discord trades the code from
  // discordSdk.commands.authorize() for an access token (that needs the secret),
  // so it can show what the player does in their Discord status.
  api.post('/discord/token', async (req, res) => {
    const d = S.discord;
    const code = String(req.body?.code || '');
    if (!d.on || !d.appId || !d.secret) return bad(res, 'Discord is not set up on this Robis.', 404);
    if (!/^[A-Za-z0-9]{10,100}$/.test(code)) return bad(res, 'Bad code.');
    try {
      const r = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: d.appId, client_secret: d.secret, grant_type: 'authorization_code', code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.access_token) return bad(res, 'Discord did not accept the code.', 502);
      res.json({ access_token: data.access_token });
    } catch {
      bad(res, 'Could not reach Discord.', 502);
    }
  });

  // ---------------------------------------------------------------- dashboard
  api.get('/admin/dashboard', requireStaff, (req, res) => {
    const all = users();
    const now = Date.now();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const t = now - i * 86400e3;
      const k = dayKey(t);
      const e = D.daily?.[k];
      days.push({ day: k, signups: all.filter((u) => dayKey(u.created) === k).length, active: e ? e.active.length : 0, plays: e ? e.plays : 0, players: e ? e.players.length : 0 });
    }
    const servers = manager.allServers().filter((s) => !s.isTest);
    const playingBy = {};
    for (const s of servers) playingBy[s.gameId] = (playingBy[s.gameId] || 0) + s.playerCount;
    const week = now - 7 * 86400e3;
    const tx = D.transactions.filter((t) => t.time > week);
    // (the phone build runs this in the browser: no process there)
    const proc = globalThis.process;
    const mem = proc?.memoryUsage ? proc.memoryUsage() : { rss: 0 };
    res.json({
      kpis: {
        users: all.length, online: all.filter((u) => presence(u).status !== 'offline').length,
        playing: servers.reduce((a, s) => a + s.playerCount, 0), servers: servers.length,
        newToday: all.filter((u) => dayKey(u.created) === dayKey()).length, activeToday: D.daily?.[dayKey()]?.active.length || 0,
        games: Object.keys(D.games).length, items: Object.keys(D.items).length, banned: all.filter((u) => isBanned(u)).length,
        robits: all.reduce((a, u) => a + (u.robits || 0), 0),
        earned7: tx.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0),
        spent7: -tx.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0),
        memory: Math.round(mem.rss / 1048576), uptime: Math.round(proc?.uptime ? proc.uptime() : 0), version: (version || '').slice(0, 7),
      },
      days,
      topGames: Object.values(D.games).sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 8)
        .map((g) => ({ id: g.id, name: g.name, visits: g.visits || 0, playing: playingBy[g.id] || 0, creator: D.users[g.creatorId]?.username || '?' })),
      newest: all.sort((a, b) => b.created - a.created).slice(0, 8).map((u) => ({ ...publicUser(u), created: u.created })),
      richest: users().sort((a, b) => (b.robits || 0) - (a.robits || 0)).slice(0, 8).map((u) => ({ id: u.id, username: u.username, robits: u.robits || 0 })),
      recentLog: (D.adminLog || []).slice(-10).reverse(),
    });
  });

  // ---------------------------------------------------------------- live servers
  api.get('/admin/servers', requireStaff, (req, res) => {
    res.json({ servers: manager.allServers().map((s) => ({
      id: s.id, gameId: s.gameId, name: s.name, privateName: s.privateName || '', isTest: s.isTest, max: s.maxPlayers,
      startedAt: s.startedAt, players: [...s.sessions.values()].map((x) => ({ userId: x.user.id, name: x.user.username })),
    })).sort((a, b) => b.players.length - a.players.length) });
  });
  const findServer = (req, res) => {
    const s = manager.allServers().find((x) => x.id === req.params.id);
    if (!s) { bad(res, 'That server is not running any more.', 404); return null; }
    return s;
  };
  api.post('/admin/servers/:id/message', requireStaff, (req, res) => {
    const s = findServer(req, res); if (!s) return;
    const text = String(req.body?.text || '').trim().slice(0, 200);
    if (!text) return bad(res, 'Type a message.');
    s.broadcast({ t: 'sys', text: `[Admin] ${text}` });
    res.json({ ok: true });
  });
  api.post('/admin/servers/:id/shutdown', requireStaff, (req, res) => {
    const s = findServer(req, res); if (!s) return;
    s.close(String(req.body?.reason || '').trim().slice(0, 200) || 'This server was shut down by an admin');
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- site settings
  api.get('/admin/settings', requireAdmin, (req, res) => res.json({ settings: adminView(S), socialTypes: SOCIAL_TYPES }));
  api.post('/admin/settings', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.maintenance) S.maintenance = { on: !!b.maintenance.on, message: String(b.maintenance.message || '').slice(0, 300) };
    if (b.signups !== undefined) S.signups = !!b.signups;
    if (b.startRobits !== undefined) {
      const n = Math.trunc(+b.startRobits);
      if (!(n >= 0 && n <= 1e6)) return bad(res, 'Starting Robits: between 0 and 1,000,000.');
      S.startRobits = n;
    }
    if (Array.isArray(b.bannedWords)) {
      S.bannedWords = [...new Set(b.bannedWords.map((w) => String(w).trim().toLowerCase()).filter((w) => w.length >= 2))].slice(0, 300);
      setExtraWords(S.bannedWords);
    }
    if (Array.isArray(b.socials)) {
      const list = [];
      for (const x of b.socials.slice(0, 8)) {
        const url = String(x.url || '').trim();
        if (!url) continue;
        if (!/^https:\/\/[^\s"<>]+$/.test(url)) return bad(res, `Links must start with https:// (${url.slice(0, 40)})`);
        list.push({ type: SOCIAL_TYPES.includes(x.type) ? x.type : 'other', label: String(x.label || '').trim().slice(0, 30) || 'Link', url: url.slice(0, 200) });
      }
      S.socials = list;
    }
    if (b.discord) {
      const appId = String(b.discord.appId ?? S.discord.appId).trim();
      if (appId && !/^\d{15,25}$/.test(appId)) return bad(res, 'The Discord Application ID is a long number (Developer Portal -> your app -> General Information).');
      S.discord.appId = appId;
      if (typeof b.discord.secret === 'string' && b.discord.secret.trim()) S.discord.secret = b.discord.secret.trim().slice(0, 100);
      if (b.discord.clearSecret) S.discord.secret = '';
      S.discord.on = !!b.discord.on && !!appId;
    }
    db.save();
    res.json({ settings: adminView(S) });
  });

  // ---------------------------------------------------------------- broadcasts
  // A message in every player's inbox (from the main account), shown live in games too.
  api.post('/admin/broadcast', requireAdmin, (req, res) => {
    const subject = String(req.body?.subject || '').trim().slice(0, 100);
    const body = String(req.body?.body || '').trim().slice(0, 5000);
    if (!subject || !body) return bad(res, 'Write a subject and a message.');
    const from = officialAccount(D)?.id || req.user.id;
    let n = 0;
    for (const u of users()) {
      D.messages.push({ id: db.nextId('message'), from, to: u.id, subject, body, created: Date.now(), read: false, broadcast: true });
      n++;
    }
    if (req.body?.live) for (const s of manager.allServers()) s.broadcast({ t: 'sys', text: `[Robis] ${subject}` });
    db.save();
    res.json({ sent: n });
  });
  // Robits for everyone (or only who's online right now).
  api.post('/admin/broadcast/robits', requireAdmin, (req, res) => {
    const amount = Math.trunc(+req.body?.amount || 0);
    if (!(amount >= 1 && amount <= 100000)) return bad(res, 'Robits for everyone: between 1 and 100,000.');
    const list = users().filter((u) => !isBanned(u) && (!req.body?.onlineOnly || presence(u).status !== 'offline'));
    for (const u of list) { u.robits += amount; log(u.id, amount, String(req.body?.reason || '').trim().slice(0, 80) || `Gift for everyone from ${req.user.username}`); }
    db.save();
    res.json({ players: list.length });
  });

  // ---------------------------------------------------------------- alt accounts
  // Accounts that were used on the same device or IP.
  api.get('/admin/users/:id/alts', requireStaff, (req, res) => {
    const u = D.users[+req.params.id];
    if (!u || u.system) return bad(res, 'User not found', 404);
    const dev = new Set(u.devices || []), ip = new Set(u.ips || []);
    const alts = users().filter((x) => x.id !== u.id).map((x) => ({
      x, device: (x.devices || []).some((d) => dev.has(d)), ip: (x.ips || []).some((i) => ip.has(i)),
    })).filter((a) => a.device || a.ip).slice(0, 30)
      .map(({ x, device, ip: sameIp }) => ({ id: x.id, username: x.username, device, ip: sameIp, banned: isBanned(x), created: x.created }));
    res.json({ alts });
  });
}
