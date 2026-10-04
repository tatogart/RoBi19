// Bot players (Admin Panel -> Bots). They join public games now and then,
// play like people (server/game/bots.js) and leave after a while. A few
// servers get one cheater bot (too fast, flying or teleporting), so there is
// someone for the anti-cheat, reports and Overwatch to catch.
import { createUser } from './seed/seed.js';
import { Bot } from './game/bots.js';

const CHEATS = ['speed', 'fly', 'teleport'];
const TICK_MS = 4000;
const POOL_MAX = 120; // bot accounts at most
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const SKIN = ['#eab892', '#cc8e69', '#a0703c', '#f5cd30', '#ffcc99', '#d7c59a', '#7c5c46'];
const CLOTH = ['#c4281c', '#0d69ac', '#4b974b', '#f5cd30', '#6b327c', '#ff66cc', '#da8541', '#1b2a35', '#00aaaa', '#ffffff', '#a3a2a5', '#635f62'];
const PRE = ['', '', '', '', 'xX', 'Pro', 'Its', 'Mr', 'Lil', 'Super', 'The', 'Epic', 'Cool', 'Dark', 'Mega', 'Real', 'Not', 'Just'];
const CORE = ['Gamer', 'Builder', 'Noob', 'Ninja', 'Dragon', 'Pizza', 'Cookie', 'Shadow', 'Blox', 'Robi', 'Panda', 'Wolf', 'Fox', 'Kitty', 'Tiger', 'Bacon',
  'Slayer', 'Storm', 'Pixel', 'Cake', 'Bunny', 'Lava', 'Obby', 'Doge', 'Creeper', 'Frost', 'Toast', 'Sniper', 'Knight', 'Unicorn', 'Potato', 'Banana', 'Rocket', 'Ghost'];
const RU = ['Sasha', 'Dima', 'Vanya', 'Masha', 'Nastya', 'Kirill', 'Artem', 'Lera', 'Misha', 'Polina', 'Egor', 'Sonya', 'Maks', 'Katya', 'Danya', 'Vika', 'Timur', 'Alina', 'Gleb', 'Dasha'];

function makeName(ru) {
  if (ru) return pick(RU) + pick(['', '_', '']) + pick([String(Math.floor(rnd(1, 99))), String(Math.floor(rnd(2008, 2016))), 'Pro', 'Top', 'Krut', 'YT', String(Math.floor(rnd(100, 9999)))]);
  const pre = pick(PRE);
  let n = pre + (pre === 'xX' ? pick(CORE) + 'Xx' : pick(CORE));
  if (Math.random() < 0.4) n += pick(CORE);
  return n + pick(['', '', '_' + Math.floor(rnd(1, 999)), String(Math.floor(rnd(1, 9999))), 'YT', '_TV', String(Math.floor(rnd(2007, 2015)))]);
}

export function installBots(api, { db, manager, requireAdmin, bad }) {
  const D = db.data;
  // on by default (but not in the test suite: tests turn bots on themselves)
  const testing = typeof process !== 'undefined' && process.env && process.env.NODE_TEST_CONTEXT;
  if (!D.bots) D.bots = { enabled: !testing, max: 14, perGame: 5, cheaters: 25, ru: 60 };
  const B = D.bots;
  const live = new Map(); // uid -> Bot
  let nextJoin = 0;

  const validName = (n) => /^[A-Za-z0-9_]{3,20}$/.test(n) && !/^_|_$/.test(n) && (n.match(/_/g) || []).length <= 1;
  const taken = (n) => Object.values(D.users).some((u) => u.username.toLowerCase() === n.toLowerCase());

  const looks = () => {
    const skin = pick(SKIN);
    const noob = Math.random() < 0.15; // the classic yellow-blue-green
    const shirt = pick(CLOTH), pants = pick(CLOTH);
    const bodyColors = noob
      ? { head: '#f5cd30', leftArm: '#f5cd30', rightArm: '#f5cd30', torso: '#0d69ac', leftLeg: '#4b974b', rightLeg: '#4b974b' }
      : { head: skin, leftArm: skin, rightArm: skin, torso: shirt, leftLeg: pants, rightLeg: pants };
    const items = Object.values(D.items).filter((i) => !i.limited && (i.price || 0) <= 400 && !i.custom);
    const wearing = [];
    if (!noob) {
      for (const [type, p] of [['Shirt', 0.85], ['Pants', 0.85], ['Hat', 0.45], ['Hair', 0.55], ['Face', 0.5], ['TShirt', 0.15]]) {
        const of = items.filter((i) => i.type === type);
        if (of.length && Math.random() < p) wearing.push(pick(of).id);
      }
    }
    return { bodyColors, wearing };
  };

  const newBotUser = () => {
    const ru = Math.random() * 100 < B.ru;
    let name = '';
    for (let i = 0; i < 30 && (!name || !validName(name) || taken(name)); i++) name = makeName(ru);
    if (!validName(name) || taken(name)) return null;
    const u = createUser(db, name, null, { bot: true, botLang: ru ? 'ru' : 'en', robits: Math.floor(rnd(0, 600)), created: Date.now() - Math.floor(rnd(5, 900)) * 86400e3 });
    delete u.salt; delete u.hash;
    u.avatar = looks();
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...u.avatar.wearing])];
    db.save();
    return u;
  };

  const freeBotUser = () => {
    const free = Object.values(D.users).filter((u) => u.bot && !u.banned && !live.has(u.id) && !manager.findUser(u.id));
    const total = Object.values(D.users).filter((u) => u.bot).length;
    // mostly the same faces come back; sometimes somebody new
    if (free.length && (total >= POOL_MAX || Math.random() < 0.8)) return pick(free);
    return newBotUser() || (free.length ? pick(free) : null);
  };

  const games = () => Object.values(D.games).filter((g) => g.isPublic && !g.huntHub && (g.maxPlayers || 12) >= 3);
  const botsIn = (gameId) => [...live.values()].filter((b) => b.server.gameId === gameId);

  // Puts a bot into a game. cheat: '' fair, a kind, or 'auto' (the server decides).
  const spawn = (gameId, cheat = 'auto') => {
    const g = D.games[gameId];
    if (!g) throw new Error('Game not found');
    const server = manager.serverForGame(gameId);
    if (server.sessions.size >= server.maxPlayers - 1) throw new Error('That server is full.');
    const user = freeBotUser();
    if (!user) throw new Error('No bot account is free.');
    if (cheat === 'auto') {
      // some servers have a cheater, most don't; never more than one
      if (server._botCheat === undefined) server._botCheat = Math.random() * 100 < B.cheaters ? pick(CHEATS) : '';
      const hasCheater = server.bots && [...server.bots].some((b) => b.cheat);
      cheat = server._botCheat && !hasCheater && Math.random() < 0.6 ? server._botCheat : '';
    }
    user.lastOnline = Date.now();
    g.visits = (g.visits || 0) + 1;
    const avatar = manager.resolveAvatar(user);
    const bot = new Bot(server, user, avatar, { cheat, lang: user.botLang || 'en', onGone: (b) => { if (live.get(b.user.id) === b) live.delete(b.user.id); b.user.lastOnline = Date.now(); } });
    live.set(user.id, bot);
    return bot;
  };

  // how many bots should be online now: goes up and down during the day
  const wanted = () => {
    const t = Date.now() / 60000;
    const wave = 0.6 + 0.25 * Math.sin(t / 47) + 0.15 * Math.sin(t / 13 + 1);
    return Math.max(0, Math.round(B.max * wave));
  };

  const tick = () => {
    try {
      for (const [uid, b] of live) if (b.gone || b.server.closed) live.delete(uid);
      if (!B.enabled) return; // (bots an admin adds by hand still come and go)
      // make room for real players: a nearly full server loses a bot
      for (const s of manager.allServers()) {
        if (!s.bots || !s.bots.size) continue;
        if (s.sessions.size >= s.maxPlayers - 1) { const b = [...s.bots].find((x) => x.task.kind !== 'leaving'); if (b) { b.say('bye'); b.setTask('leaving', rnd(1, 3)); } }
      }
      const want = wanted();
      if (live.size < want && Date.now() >= nextJoin) {
        // fill up quicker when there are few, then one by one
        nextJoin = Date.now() + (live.size < want / 2 ? rnd(1000, 4000) : rnd(4000, 20000));
        // popular games get more bots
        const list = games().filter((g) => botsIn(g.id).length < B.perGame).map((g) => [g, Math.sqrt((g.visits || 0) + 20)]);
        let r = Math.random() * list.reduce((a, x) => a + x[1], 0);
        for (const [g, w] of list) {
          if ((r -= w) > 0) continue;
          try { spawn(g.id); } catch { /* full or no account: next time */ }
          break;
        }
      } else if (live.size > want + 2) {
        // too many: someone goes home a bit earlier
        const b = pick([...live.values()]);
        if (b && b.task.kind !== 'leaving') b.stayFor = Math.min(b.stayFor, b.server.time - b.joinedAt + rnd(5, 60));
      }
    } catch { /* try again next time */ }
  };
  const timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
  manager.bots = {
    stop: () => clearInterval(timer),
    spawn, tick, live,
  };

  // ---------------------------------------------------------------- admin
  const view = () => ({
    settings: B,
    wanted: B.enabled ? wanted() : 0,
    accounts: Object.values(D.users).filter((u) => u.bot).length,
    bots: [...live.values()].filter((b) => !b.gone).map((b) => ({ ...b.info(), gameId: b.server.gameId, gameName: D.games[b.server.gameId]?.name || '?', server: b.server.id.slice(0, 8), players: b.server.sessions.size })),
    games: games().sort((a, b) => (b.visits || 0) - (a.visits || 0)).map((g) => ({ id: g.id, name: g.name })),
  });
  api.get('/admin/bots', requireAdmin, (req, res) => res.json(view()));
  api.post('/admin/bots', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'settings') {
      const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
      if (b.enabled !== undefined) {
        B.enabled = !!b.enabled;
        if (!B.enabled) for (const x of [...live.values()]) x.leave();
      }
      B.max = num(b.max ?? B.max, 0, 60, 14);
      B.perGame = num(b.perGame ?? B.perGame, 1, 20, 5);
      B.cheaters = num(b.cheaters ?? B.cheaters, 0, 100, 25);
      B.ru = num(b.ru ?? B.ru, 0, 100, 60);
      db.save();
      tick();
    } else if (b.op === 'spawn') {
      const cheat = b.cheat === 'random' ? pick(CHEATS) : CHEATS.includes(b.cheat) ? b.cheat : '';
      try { spawn(+b.gameId, cheat); } catch (e) { return bad(res, e.message); }
    } else if (b.op === 'kick') {
      const bot = live.get(+b.uid);
      if (!bot) return bad(res, 'Bot not found', 404);
      bot.leave();
    } else if (b.op === 'clear') {
      for (const x of [...live.values()]) x.leave();
    } else return bad(res, 'Unknown action.');
    res.json({ ok: true, ...view() });
  });
}
