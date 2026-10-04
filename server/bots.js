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

// ---------------------------------------------------------------- names
// Names like real players pick: a first name with numbers, a word with a
// birth year, something short made up, a keyboard smash...
const EN_BOYS = ['jeff', 'alex', 'max', 'ben', 'sam', 'tom', 'jake', 'liam', 'noah', 'ethan', 'ryan', 'tyler', 'dylan', 'josh', 'mason', 'leo', 'chris', 'nick', 'kyle', 'luke', 'owen', 'jack', 'matt', 'danny'];
const EN_GIRLS = ['mia', 'emma', 'lily', 'ava', 'zoe', 'kate', 'ella', 'chloe', 'ruby', 'amy', 'lucy', 'sophie', 'grace', 'molly', 'hannah', 'bella'];
const RU_BOYS = ['petr', 'sasha', 'dima', 'vanya', 'misha', 'egor', 'artem', 'kirill', 'maks', 'timur', 'gleb', 'danya', 'nikita', 'vova', 'andrey', 'ilya', 'roma', 'sergey', 'denis', 'pasha', 'arsen', 'lyoha', 'stas', 'kostya'];
const RU_GIRLS = ['masha', 'nastya', 'lera', 'polina', 'sonya', 'katya', 'vika', 'alina', 'dasha', 'liza', 'anya', 'yulya', 'ksyusha', 'veronika', 'arina', 'milana'];
const RU_WORDS = ['rossomakh', 'kotik', 'volk', 'zaika', 'ezhik', 'pelmen', 'shrek', 'banan', 'kartoshka', 'medved', 'tigr', 'sobaka', 'lisenok', 'kapibara', 'pirozhok', 'enot', 'barsik', 'kolobok', 'babaika'];
const EN_WORDS = ['ninja', 'potato', 'cookie', 'panda', 'shadow', 'gamer', 'builder', 'pizza', 'bacon', 'dragon', 'wolf', 'kitty', 'bunny', 'cupcake', 'noob', 'tiger', 'fox', 'cool', 'super', 'crazy'];
const EN_ENDS = ['kid', 'boy', 'girl', 'lover', 'master', 'man', 'king', 'queen', 'fan'];
const MASH = ['qwe', 'rty', 'asd', 'fgh', 'zxc', 'ytr', 'dfg', 'hjk', 'yui', 'uio', 'kjh', 'vbn', 'ewq', 'rtyy', 'sdf', 'ghj'];
const SYL = ['ted', 'mo', 'lo', 'ki', 'ma', 'xi', 'ny', 'ra', 'zu', 'pi', 'ko', 'li', 'vo', 'da', 'shi', 'tu', 'be', 'ni'];
const ENDS = ['kee', 'ky', 'ik', 'xx', 'y', 'ka', 'sha', 'ito', 'oo', 'ie'];

const digits = (min, max) => String(Math.floor(rnd(min, max)));
const year = () => digits(2006, 2017);
const num = () => pick([digits(1, 100), digits(1, 100), year(), digits(100, 1000), digits(1000, 100000), digits(100000, 1000000)]);
const cap = (w) => w[0].toUpperCase() + w.slice(1);

// -> { name, girl }
export function makeName(ru) {
  const girl = Math.random() < 0.4;
  const first = pick(ru ? (girl ? RU_GIRLS : RU_BOYS) : (girl ? EN_GIRLS : EN_BOYS));
  const word = pick(ru && Math.random() < 0.7 ? RU_WORDS : EN_WORDS);
  let n;
  const r = Math.random();
  if (r < 0.3) n = first + num(); // petr10140
  else if (r < 0.38) n = cap(first) + digits(10, 100) + cap(pick(['rut', 'pro', 'kun', 'top', 'ok', 'off', 'x'])); // Jeff69Rut
  else if (r < 0.56) n = cap(word) + digits(1, 100); // Rossomakh67
  else if (r < 0.68) n = pick(SYL) + pick(SYL) + pick(ENDS); // tedkee
  else if (r < 0.76) n = pick(MASH) + pick(MASH).slice(0, 2) + digits(10, 1000000); // rtyydy526263
  else if (r < 0.86) n = Math.random() < 0.5 ? first + '_' + word : word + '_' + first; // dima_pelmen
  else n = pick(EN_WORDS) + pick(EN_ENDS.filter((e) => (girl ? !['boy', 'man', 'king'].includes(e) : !['girl', 'queen'].includes(e)))) + (Math.random() < 0.6 ? pick([year(), digits(1, 100)]) : ''); // coolkid2011
  if (Math.random() < 0.4 && !/_/.test(n)) n = cap(n);
  return { name: n.slice(0, 20), girl };
}

// ---------------------------------------------------------------- looks
// Whole outfits from the official catalog, the way people dress: hair and
// a face, a shirt with matching pants, sometimes a hat.
const SKIN = ['#eab892', '#eab892', '#ffcc99', '#f2c6a0', '#cc8e69', '#a0703c', '#7c5c46'];
const STYLES = [
  // [weight, girls?, hair, face, shirt, pants, hats (some of the time)]
  [5, null, ['Bacon Hair', 'Pal Hair'], ['Smile'], ['Blue Hoodie'], ['Jeans'], []], // a new account: the starter look
  [5, false, ['Bacon Hair', 'Brown Charmer Hair', 'Pal Hair', 'Blonde Spiked Hair'], ['Smile', 'Man Face', 'Chill', 'Winning Smile', 'Silly Fun'], ['Blue Hoodie', 'Red Plaid Shirt', 'Striped Tee', 'Green Camo Jacket'], ['Jeans', 'Khakis', 'Black Pants', 'Camo Pants'], ['Classic Robis Cap', 'Beanie', 'Headphones', 'Sunglasses']],
  [4, true, ['Long Pink Hair', 'Brown Charmer Hair', 'Blonde Spiked Hair'], ['Woman Face', 'Smile', 'Super Super Happy Face', 'Winning Smile'], ['Striped Tee', 'Blue Hoodie', 'Red Plaid Shirt'], ['Black Pants', 'Jeans', 'Khakis'], ['Party Hat', 'Beanie', 'Tiny Wings', 'Headphones']],
  [1.5, false, ['Brown Charmer Hair', 'Pal Hair'], ['Man Face', 'Chill'], ['Black Suit'], ['Suit Pants'], ['Stylish Top Hat', 'Sunglasses']],
  [1.5, null, ['Bacon Hair', 'Pal Hair'], ['Epic Face', 'Silly Fun', 'Shocked'], ['Green Camo Jacket', 'Blue Hoodie'], ['Camo Pants', 'Black Pants'], ['Headphones', 'Viking Helm', 'Pirate Hat', 'Traffic Cone']],
  [1, null, ['Bacon Hair'], ['Smile'], ['Builders Club Shirt'], ['Black Pants', 'Jeans'], ['Classic Robis Cap']],
];

function makeLook(girl, byName) {
  const id = (n) => (byName[n] ? byName[n].id : null);
  const skin = pick(SKIN);
  // the classic noob: no clothes, yellow, blue and green
  if (Math.random() < 0.07) {
    return { bodyColors: { head: '#f5cd30', leftArm: '#f5cd30', rightArm: '#f5cd30', torso: '#0d69ac', leftLeg: '#4b974b', rightLeg: '#4b974b' }, wearing: [id('Smile'), Math.random() < 0.4 ? id('Noob') : null].filter(Boolean) };
  }
  const fits = STYLES.filter((x) => x[1] === null || x[1] === girl);
  let r = Math.random() * fits.reduce((a, x) => a + x[0], 0);
  let st = fits[0];
  for (const x of fits) { if ((r -= x[0]) <= 0) { st = x; break; } }
  const [, , hair, face, shirt, pants, hats] = st;
  const wearing = [pick(hair), pick(face), pick(shirt), pick(pants)];
  if (hats.length && Math.random() < 0.35) wearing.push(pick(hats));
  if (Math.random() < 0.1) wearing.push(pick(['Robis Logo T-Shirt', 'I <3 Robis', 'Gold Star', 'Oof']));
  const shirtItem = byName[wearing[2]], pantsItem = byName[wearing[3]];
  const tc = shirtItem?.data?.color || skin, lc = pantsItem?.data?.color || skin;
  return { bodyColors: { head: skin, leftArm: skin, rightArm: skin, torso: tc, leftLeg: lc, rightLeg: lc }, wearing: wearing.map(id).filter(Boolean) };
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

  // the official catalog by name (outfits only use those)
  const catalog = () => {
    const out = {};
    for (const i of Object.values(D.items)) if (!i.limited && !i.custom && !out[i.name]) out[i.name] = i;
    return out;
  };
  // Bots signed up while Robis has been around (not before the first real
  // players), more of them lately.
  const siteStart = () => {
    const real = Object.values(D.users).filter((u) => !u.bot && !u.system && u.created).map((u) => u.created);
    return Math.min(Date.now() - 86400e3, real.length ? Math.min(...real) : Date.now());
  };
  const joinDate = () => {
    const a = siteStart(), b = Date.now() - 3600e3;
    return Math.floor(a + (b - a) * Math.pow(Math.random(), 0.7));
  };
  const freshName = (ru) => {
    for (let i = 0; i < 40; i++) {
      const x = makeName(ru);
      if (validName(x.name) && !taken(x.name)) return x;
    }
    return null;
  };
  const dress = (u, girl) => {
    u.avatar = makeLook(girl, catalog());
    D.inventory[u.id] = [...new Set([...(D.inventory[u.id] || []), ...u.avatar.wearing])];
  };

  const newBotUser = () => {
    const ru = Math.random() * 100 < B.ru;
    const nm = freshName(ru);
    if (!nm) return null;
    const u = createUser(db, nm.name, null, { bot: true, botLang: ru ? 'ru' : 'en', girl: nm.girl, robits: Math.floor(rnd(20, 2500)), created: joinDate() });
    delete u.salt; delete u.hash;
    u.lastOnline = u.created;
    dress(u, nm.girl);
    db.save();
    return u;
  };

  // Bot accounts from before: new names, outfits and sign-up dates (once).
  if ((B.looks || 1) < 2) {
    for (const u of Object.values(D.users)) {
      if (!u.bot) continue;
      const ru = u.botLang === 'ru';
      const nm = freshName(ru);
      if (nm) { u.username = nm.name; u.girl = nm.girl; }
      dress(u, !!u.girl);
      u.created = joinDate();
      if ((u.lastOnline || 0) < u.created) u.lastOnline = u.created;
      if (u.robits < 20) u.robits = Math.floor(rnd(20, 2500));
    }
    B.looks = 2;
    db.save();
  }

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

  // ---------------------------------------------------------------- friends
  // Bots answer friend requests (most say yes, after a while, like people)
  // and send some to the people they played with for a few minutes.
  const decided = new Map(); // 'from:to' -> { at, yes }
  const asked = new Set(); // 'bot:user' pairs already thought about
  const lastAsked = new Map(); // real user -> when a bot last asked them
  const addFriends = (a, b) => {
    D.friends[a] = [...new Set([...(D.friends[a] || []), b])];
    D.friends[b] = [...new Set([...(D.friends[b] || []), a])];
  };
  const friendsTick = () => {
    if (!Array.isArray(D.friendRequests)) return;
    const now = Date.now();
    let changed = false;
    for (const r of [...D.friendRequests]) {
      const to = D.users[r.to];
      if (!to || !to.bot) continue;
      const k = r.from + ':' + r.to;
      let d = decided.get(k);
      if (!d) {
        // playing right now: answers in a minute or two; else when they "come back"
        const delay = live.has(r.to) ? rnd(15e3, 120e3) : rnd(4 * 60e3, 2 * 3600e3);
        d = { at: Math.max(now, (r.created || now) + delay), yes: Math.random() < 0.85 };
        decided.set(k, d);
      }
      if (now < d.at) continue;
      decided.delete(k);
      D.friendRequests = D.friendRequests.filter((x) => x !== r);
      if (d.yes) {
        addFriends(r.from, r.to);
        const b = live.get(r.to);
        if (b && b.server.sessions.has(r.from) && Math.random() < 0.6) b.say('', pick(b.lang === 'ru' ? ['принял)', 'добавил тебя', 'теперь друзья :)'] : ['accepted :)', 'added u', 'we are friends now :)']));
      }
      changed = true;
    }
    for (const b of live.values()) {
      if (b.gone || b.friendAsked) continue;
      for (const o of b.server.sessions.values()) {
        if (o === b.session || !o.user || o.user.system) continue;
        if (now - Math.max(b.session.joinedAt, o.joinedAt) < 150e3) continue; // played together a bit first
        const k = b.user.id + ':' + o.user.id;
        if (asked.has(k)) continue;
        if (asked.size > 20000) asked.clear();
        asked.add(k);
        const bot = !!o.user.bot;
        if (Math.random() > (bot ? 0.12 : 0.1 + b.p.social * 0.2)) continue;
        if ((D.friends[b.user.id] || []).includes(o.user.id)) continue;
        if (D.friendRequests.some((r) => (r.from === b.user.id && r.to === o.user.id) || (r.from === o.user.id && r.to === b.user.id))) continue;
        if (bot) addFriends(b.user.id, o.user.id); // two bots just become friends
        else {
          if (now - (lastAsked.get(o.user.id) || 0) < 30 * 60e3) continue; // not every bot at once
          lastAsked.set(o.user.id, now);
          D.friendRequests.push({ from: b.user.id, to: o.user.id, created: now });
          b.later(rnd(1, 4), () => b.say('friend'));
        }
        b.friendAsked = true;
        changed = true;
        break;
      }
    }
    if (changed) db.save();
  };

  const tick = () => {
    try { friendsTick(); } catch { /* next time */ }
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
    spawn, tick, live, friendsTick,
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
