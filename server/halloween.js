// Halloween 2026: not quests but a global update of the games. While it's on,
// every game turns spooky (GameServer._halloween*): dusk light and fog,
// jack-o'-lanterns, gravestones and candies hidden around the map. Candy is
// collected in any game and spent in the Halloween shop on items you can't
// get any other way (they wear a HALLOWEEN plate).
//   GET  /halloween               the event, my candy, the shop, the top
//   POST /halloween/buy           { itemId }
//   GET/POST /admin/halloween     { on, days, cap }
import { officialAccount } from './seed/seed.js';

const SHOP = [
  { key: 'witch', name: 'Spooky Witch Hat', type: 'Hat', cost: 60, data: { model: 'witch', color: '#2b1840', accent: '#ff7a12' }, desc: 'Halloween 2026. Bought with candy.' },
  { key: 'pumpkin', name: 'Pumpkin Head', type: 'Hat', cost: 150, data: { model: 'pumpkinhead', color: '#ff7a12', accent: '#ffd23f' }, desc: 'Halloween 2026. A carved pumpkin that glows from the inside.' },
  { key: 'wings', name: 'Bat Wings', type: 'Accessory', cost: 250, data: { model: 'batwings', slot: 'back', color: '#2b1840', accent: '#7a3cff' }, desc: 'Halloween 2026. Flap flap.' },
  { key: 'ghost', name: 'Glowing Ghost', type: 'Pet', cost: 300, data: { model: 'ghost', color: '#b6ffb0', accent: '#1b1b1b' }, desc: 'Halloween 2026. A friendly ghost that glows in the dark.' },
  { key: 'jack', name: 'Jack-o\'-Lantern', type: 'Pet', cost: 450, data: { model: 'jackpet', color: '#ff7a12', accent: '#3b1f5c' }, desc: 'Halloween 2026. A floating pumpkin in a little witch hat.' },
  { key: 'crown', name: 'Candy King Crown', type: 'Hat', cost: 900, data: { model: 'crown', color: '#ff7a12', accent: '#7a3cff' }, desc: 'Halloween 2026. For the biggest candy collectors.' },
];
const PLATE = { label: 'HALLOWEEN', color: '#ff7a12' };
const END = Date.UTC(2026, 10, 3); // November 3

export function installHalloween(api, { db, manager, requireUser, requireAdmin, bad, log, hooks, publicItem }) {
  const D = db.data;
  const H = D.halloween || (D.halloween = { on: false, until: END, cap: 300, items: {} });
  if (!H.items) H.items = {};
  if (!H.cap) H.cap = 300;
  const testing = !!process.env.NODE_TEST_CONTEXT;
  // it starts once by itself (not in the tests)
  if (!H.started && !testing) { H.started = true; H.on = true; H.until = Math.max(H.until || 0, END); }
  const active = () => !!H.on && Date.now() < (H.until || 0);
  const today = () => new Date().toISOString().slice(0, 10);

  // the shop items: event items, never for sale for Robits, can't be traded
  const items = () => SHOP.map((s) => {
    let it = D.items[H.items[s.key]];
    if (!it) {
      const id = db.nextId('item');
      it = D.items[id] = { id, name: s.name, type: s.type, price: 0, data: s.data, creatorId: officialAccount(D)?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false, description: s.desc, special: PLATE };
      H.items[s.key] = id;
      db.save();
    }
    return { ...s, item: it };
  });
  items();

  // a candy picked up in a game (daily cap)
  const collect = (uid, amount = 1) => {
    const u = D.users[uid];
    if (!u || u.bot || u.system || !active()) return null;
    if (u.candyDay !== today()) { u.candyDay = today(); u.candyToday = 0; }
    if (u.candyToday >= H.cap) return { capped: true, candy: u.candy || 0 };
    const got = Math.min(amount, H.cap - u.candyToday);
    u.candyToday += got;
    u.candy = (u.candy || 0) + got;
    u.candyTotal = (u.candyTotal || 0) + got;
    db.save();
    return { got, candy: u.candy, capped: u.candyToday >= H.cap };
  };
  hooks.halloweenActive = active;
  if (manager) manager.halloween = { active, collect };

  const top = () => Object.values(D.users).filter((u) => (u.candyTotal || 0) > 0 && !u.bot && !u.system)
    .sort((a, b) => b.candyTotal - a.candyTotal).slice(0, 10).map((u) => ({ id: u.id, username: u.username, total: u.candyTotal }));

  api.get('/halloween', (req, res) => {
    const u = req.user;
    const inv = u ? D.inventory[u.id] || [] : [];
    res.json({
      active: active(), until: H.until, cap: H.cap,
      candy: u ? u.candy || 0 : 0, total: u ? u.candyTotal || 0 : 0, today: u && u.candyDay === today() ? u.candyToday || 0 : 0,
      shop: items().map((s) => ({ ...publicItem(s.item, u), cost: s.cost, owned: inv.includes(s.item.id) })),
      top: top(),
    });
  });
  api.post('/halloween/buy', requireUser, (req, res) => {
    const u = req.user;
    if (!active()) return bad(res, 'The Halloween event is over.');
    const s = items().find((x) => x.item.id === +req.body?.itemId);
    if (!s) return bad(res, 'That is not in the Halloween shop.');
    const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
    if (inv.includes(s.item.id)) return bad(res, 'You already have it.');
    if ((u.candy || 0) < s.cost) return bad(res, `You need ${s.cost - (u.candy || 0)} more candy.`);
    u.candy -= s.cost;
    inv.push(s.item.id);
    log(u.id, 0, `${s.name} for ${s.cost} candy (Halloween)`);
    db.save();
    res.json({ ok: true, candy: u.candy });
  });

  api.get('/admin/halloween', requireAdmin, (req, res) => res.json({ on: !!H.on, active: active(), until: H.until, cap: H.cap, top: top(),
    players: Object.values(D.users).filter((u) => (u.candyTotal || 0) > 0).length, candy: Object.values(D.users).reduce((a, u) => a + (u.candyTotal || 0), 0) }));
  api.post('/admin/halloween', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.on !== undefined) H.on = !!b.on;
    if (b.days !== undefined) { const d = Math.max(0, Math.min(60, +b.days || 0)); if (d) H.until = Date.now() + d * 86400e3; }
    if (b.cap !== undefined) H.cap = Math.max(10, Math.min(5000, Math.trunc(+b.cap || 300)));
    db.save();
    res.json({ on: !!H.on, active: active(), until: H.until, cap: H.cap });
  });
}
