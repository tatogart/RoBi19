// The farewell event, "The Last Night of Robis", and the Wall of Thanks.
// While it's on, every game turns into a warm night with lanterns rising into
// the sky and the latest messages from the wall floating over the spawn
// (GameServer._farewell*). Everybody who plays a game during it gets the
// Farewell Lantern pet and the "Until the very end" badge; everybody who
// writes on the wall gets the "Thank You, Robis" badge.
//   GET    /farewell               the event, the wall, my message
//   POST   /farewell/wall          { text }  my message (one per player, can be changed)
//   POST   /farewell/like          { id }    like / unlike a message
//   DELETE /farewell/wall/:id      my message, or any message (staff)
//   GET/POST /admin/farewell       { on }
import { officialAccount } from './seed/seed.js';
import { filterChat } from './game/chatfilter.js';

const LANTERN = { name: 'Farewell Lantern', type: 'Pet', data: { model: 'lantern', color: '#ff8a3d', accent: '#ffd27a' }, desc: 'The Last Night of Robis. For everyone who played until the very end. Thank you!' };
const PLATE = { label: 'FAREWELL', color: '#ffb547' };

export function installFarewell(api, { db, manager, requireUser, requireAdmin, bad, log, hooks, publicItem }) {
  const D = db.data;
  const F = D.farewell || (D.farewell = { on: false, wall: [], nextId: 1 });
  if (!F.wall) F.wall = [];
  if (!F.nextId) F.nextId = 1;
  const testing = !!process.env.NODE_TEST_CONTEXT;
  // it starts once by itself (not in the tests)
  if (!F.started && !testing) { F.started = true; F.on = true; }
  const active = () => !!F.on;

  const lantern = () => {
    let it = D.items[F.itemId];
    if (!it) {
      const id = db.nextId('item');
      it = D.items[id] = { id, name: LANTERN.name, type: LANTERN.type, price: 0, data: LANTERN.data, creatorId: officialAccount(D)?.id || 0, created: Date.now(), sales: 0, offsale: true, limited: false, description: LANTERN.desc, special: PLATE };
      F.itemId = id;
      db.save();
    }
    return it;
  };
  lantern();

  // a player joined a game during the event: the lantern and the badge
  const played = (uid) => {
    const u = D.users[uid];
    if (!u || u.bot || u.system || u.guest || !active()) return false;
    const inv = D.inventory[uid] || (D.inventory[uid] = []);
    const it = lantern();
    let got = false;
    if (!inv.includes(it.id)) { inv.push(it.id); got = true; log(uid, 0, `${it.name} (The Last Night of Robis)`); }
    u.farewellPlayed = u.farewellPlayed || Date.now();
    db.save();
    return got;
  };
  // the newest messages for the games (floating over the spawn)
  const latest = (n = 6) => F.wall.filter((m) => !m.hidden).slice(-n).map((m) => ({ username: D.users[m.uid]?.username || '?', text: m.text }));
  hooks.farewellActive = active;
  if (manager) manager.farewell = { active, played, latest };

  const view = (m, me) => {
    const u = D.users[m.uid];
    return { id: m.id, userId: m.uid, username: u ? u.username : '?', text: m.text, created: m.created, edited: m.edited || null, likes: m.likes.length, liked: !!me && m.likes.includes(me.id), mine: !!me && m.uid === me.id };
  };
  const staff = (u) => !!u && (u.isAdmin || (u.perms || []).includes('moderator'));

  api.get('/farewell', (req, res) => {
    const u = req.user;
    const wall = F.wall.filter((m) => !m.hidden);
    const sort = req.query.sort === 'top' ? (a, b) => b.likes.length - a.likes.length || b.id - a.id : (a, b) => b.id - a.id;
    const mine = u ? wall.find((m) => m.uid === u.id) : null;
    res.json({
      active: active(), closing: hooks.closingInfo ? hooks.closingInfo() : null,
      count: wall.length, players: Object.values(D.users).filter((x) => x.farewellPlayed).length,
      wall: wall.slice().sort(sort).slice(0, 500).map((m) => view(m, u)),
      mine: mine ? view(mine, u) : null,
      lantern: { ...publicItem(lantern(), u), owned: !!u && (D.inventory[u.id] || []).includes(lantern().id) },
      staff: staff(u),
    });
  });
  api.post('/farewell/wall', requireUser, (req, res) => {
    const u = req.user;
    if (u.guest) return bad(res, 'Guests can\'t write on the wall. Make an account first.');
    const text = filterChat(String(req.body?.text || '').replace(/\s+/g, ' ').trim()).slice(0, 280);
    if (text.length < 3) return bad(res, 'Write at least a few words.');
    if (Date.now() - (u.lastWall || 0) < 15e3) return bad(res, 'Wait a few seconds.');
    u.lastWall = Date.now();
    let m = F.wall.find((x) => x.uid === u.id && !x.hidden);
    if (m) { m.text = text; m.edited = Date.now(); } else F.wall.push(m = { id: F.nextId++, uid: u.id, text, created: Date.now(), likes: [] });
    u.farewellWrote = u.farewellWrote || Date.now();
    db.save();
    res.json({ ok: true, message: view(m, u) });
  });
  api.post('/farewell/like', requireUser, (req, res) => {
    const m = F.wall.find((x) => x.id === +req.body?.id && !x.hidden);
    if (!m) return bad(res, 'That message is gone.', 404);
    const i = m.likes.indexOf(req.user.id);
    if (i >= 0) m.likes.splice(i, 1); else m.likes.push(req.user.id);
    db.save();
    res.json({ likes: m.likes.length, liked: i < 0 });
  });
  api.delete('/farewell/wall/:id', requireUser, (req, res) => {
    const m = F.wall.find((x) => x.id === +req.params.id && !x.hidden);
    if (!m) return bad(res, 'That message is gone.', 404);
    if (m.uid !== req.user.id && !staff(req.user)) return bad(res, 'That\'s not your message.', 403);
    m.hidden = true;
    m.hiddenBy = req.user.id;
    db.save();
    res.json({ ok: true });
  });

  api.get('/admin/farewell', requireAdmin, (req, res) => res.json({ on: active(), count: F.wall.filter((m) => !m.hidden).length, hidden: F.wall.filter((m) => m.hidden).length, players: Object.values(D.users).filter((x) => x.farewellPlayed).length }));
  api.post('/admin/farewell', requireAdmin, (req, res) => {
    if (req.body?.on !== undefined) F.on = !!req.body.on;
    db.save();
    res.json({ on: active() });
  });
}
