// Fun stuff: the daily spin (a prize wheel once a day, with a streak bonus),
// the secret code (a hidden badge) and pokes between friends.
import { officialAccount } from './seed/seed.js';

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
// The wheel: w = how likely (out of the total).
export const SPIN = [
  { label: 'R$ 10', robits: 10, color: '#00a2ff', w: 28 },
  { label: 'R$ 25', robits: 25, color: '#02b757', w: 24 },
  { label: 'R$ 50', robits: 50, color: '#f5a623', w: 18 },
  { label: 'R$ 100', robits: 100, color: '#7b5cff', w: 13 },
  { label: 'R$ 250', robits: 250, color: '#ff4d8d', w: 8 },
  { label: 'R$ 500', robits: 500, color: '#e8590c', w: 4 },
  { label: 'Lucky Cap', item: 'spinCap', color: '#00c2c2', w: 3 },
  { label: 'JACKPOT R$ 1,000', robits: 1000, color: '#ffc400', w: 2 },
];

export function installFun(api, { db, requireUser, bad, log, giveSerial, publicUser }) {
  const D = db.data;
  if (!D.funItems) D.funItems = {};
  if (!D.pokes) D.pokes = [];
  // the rare prize of the wheel (not for sale)
  if (!D.funItems.spinCap || !D.items[D.funItems.spinCap]) {
    const id = db.nextId('item');
    D.items[id] = {
      id, name: 'Lucky Spin Cap', type: 'Hat', price: 0, offsale: true, limited: false, sales: 0, created: Date.now(),
      creatorId: officialAccount(D)?.id || 0, data: { model: 'cap', color: '#00c2c2', accent: '#ffc400' },
      description: 'A rare prize from the Daily Spin. Lucky you!',
    };
    D.funItems.spinCap = id;
  }

  // ---------------------------------------------------------------- daily spin
  const streakOf = (u) => (u.spinDay === dayKey(Date.now() - 86400e3) || u.spinDay === dayKey() ? u.spinStreak || 0 : 0);
  api.get('/fun/spin', requireUser, (req, res) => {
    const u = req.user;
    const today = dayKey();
    const tomorrow = new Date(today + 'T00:00:00Z').getTime() + 86400e3;
    res.json({ segments: SPIN.map((s) => ({ label: s.label, color: s.color })), canSpin: u.spinDay !== today, nextAt: tomorrow, streak: streakOf(u) });
  });
  api.post('/fun/spin', requireUser, (req, res) => {
    const u = req.user;
    const today = dayKey();
    if (u.spinDay === today) return bad(res, 'You already spun today. Come back tomorrow!');
    const total = SPIN.reduce((n, s) => n + s.w, 0);
    let r = Math.random() * total;
    let index = 0;
    while (r >= SPIN[index].w) { r -= SPIN[index].w; index++; }
    const seg = SPIN[index];
    const streak = Math.min(7, (u.spinDay === dayKey(Date.now() - 86400e3) ? u.spinStreak || 0 : 0) + 1);
    u.spinDay = today;
    u.spinStreak = streak;
    let prize = seg.label;
    let robits = seg.robits || 0;
    if (seg.item) {
      const it = D.items[D.funItems[seg.item]];
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      if (it && !inv.includes(it.id)) { inv.push(it.id); giveSerial(it, u.id); prize = it.name; } else { robits = 250; prize = 'R$ 250 (you already have the Lucky Cap)'; }
    }
    // a streak of days in a row: +10 Robits for every day (up to 7)
    const bonus = streak > 1 ? streak * 10 : 0;
    if (robits + bonus) {
      u.robits += robits + bonus;
      log(u.id, robits + bonus, `Daily Spin: ${prize}${bonus ? ` + streak bonus R$ ${bonus}` : ''}`);
    }
    db.save();
    res.json({ index, prize, bonus, streak, robits: u.robits, jackpot: index === SPIN.length - 1 });
  });

  // ---------------------------------------------------------------- the secret code
  // Somewhere on Robis there's a secret code... (the Konami code). The first
  // time: a hidden badge and R$ 100.
  api.post('/fun/secret', requireUser, (req, res) => {
    const u = req.user;
    if (String(req.body?.code || '') !== 'uuddlrlrba') return bad(res, 'Nope.');
    if (u.secretFound) return res.json({ first: false });
    u.secretFound = Date.now();
    u.robits += 100;
    log(u.id, 100, 'Found the secret code!');
    db.save();
    res.json({ first: true, robits: u.robits });
  });

  // ---------------------------------------------------------------- pokes
  api.post('/users/:id/poke', requireUser, (req, res) => {
    const to = D.users[+req.params.id];
    if (!to || to.system || to.id === req.user.id) return bad(res, 'User not found', 404);
    if (!(D.friends[req.user.id] || []).includes(to.id)) return bad(res, 'You can only poke friends.');
    const now = Date.now();
    if (D.pokes.some((p) => p.from === req.user.id && p.to === to.id && now - p.created < 30e3)) return bad(res, 'Wait a little before poking again!', 429);
    D.pokes = D.pokes.filter((p) => now - p.created < 10 * 60e3);
    D.pokes.push({ id: (D.pokes.at(-1)?.id || 0) + 1, from: req.user.id, to: to.id, created: now });
    db.save();
    res.json({ ok: true });
  });
  // the pokes for me (each shown once)
  api.get('/pokes', requireUser, (req, res) => {
    const mine = D.pokes.filter((p) => p.to === req.user.id && D.users[p.from]);
    if (!mine.length) return res.json({ pokes: [] });
    D.pokes = D.pokes.filter((p) => p.to !== req.user.id);
    db.save();
    res.json({ pokes: mine.map((p) => ({ id: p.id, from: publicUser(D.users[p.from]), created: p.created })) });
  });
}
