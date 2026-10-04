// Bots that play like people: they join games, walk around, jump, follow
// someone for a while, hide, stand AFK, chat, dance, reset and leave. A few
// of them cheat (too fast, flying, teleporting), so the anti-cheat and
// Overwatch have someone real to catch. They move with the same character
// physics as the game client and send the same 'move' messages, so the game
// (scripts, touches, the anti-cheat) treats them like any other player.
import { BasePart } from '../../shared/engine/instances.js';
import { partBox, boxAABB, SpatialGrid, rayVsBox, sphereVsBox, stepCharacter } from '../../shared/engine/physics.js';

const SEND_HZ = 15;
const DANGER = /lava|kill|death|acid|toxic|void|spike|laser|zap/i;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;

// ---------------------------------------------------------------- the map
// What the bots of one server know about the map: collidable parts (to walk
// on and bump into) and spots worth walking to (the tops of floors and
// platforms).
class BotWorld {
  constructor(server) {
    this.server = server;
    this.ws = server.game.Workspace;
    this.grid = new SpatialGrid(16);
    this.dirty = true;
    this.spotsAt = -1;
    this.spots = [];
    const mark = (i) => { if (i instanceof BasePart) this.dirty = true; };
    server.game.on('added', mark);
    server.game.on('removing', mark);
    server.game.on('changed', (i, p) => { if (i instanceof BasePart && (p === 'CFrame' || p === 'Size' || p === 'CanCollide')) this.dirty = true; });
  }

  _parts() {
    const out = [];
    const walk = (i) => {
      for (const c of i._children) {
        if (c._isCharacter) continue;
        if (c instanceof BasePart && c._p.CanCollide) out.push(c);
        if (c._children.length) walk(c);
      }
    };
    walk(this.ws);
    return out;
  }

  rebuild() {
    this.grid.clear();
    for (const p of this._parts()) { const b = partBox(p); this.grid.insert(b, boxAABB(b)); }
    this.dirty = false;
  }

  query(minX, minZ, maxX, maxZ) {
    if (this.dirty) this.rebuild();
    return this.grid.query(minX, minZ, maxX, maxZ);
  }

  // distance along a ray to the first collidable part (or max)
  ray(ox, oy, oz, dx, dy, dz, max) {
    const minX = Math.min(ox, ox + dx * max) - 1, maxX = Math.max(ox, ox + dx * max) + 1;
    const minZ = Math.min(oz, oz + dz * max) - 1, maxZ = Math.max(oz, oz + dz * max) + 1;
    let best = max, hit = null;
    for (const b of this.query(minX, minZ, maxX, maxZ)) {
      const t = rayVsBox(b, ox, oy, oz, dx, dy, dz, best);
      if (t >= 0 && t < best) { best = t; hit = b.part; }
    }
    return { d: best, part: hit };
  }

  // the floor under a point: how far down, and what it is
  floor(x, y, z, max = 60) { return this.ray(x, y, z, 0, -1, 0, max); }

  // Places to walk to: the tops of upright, roomy, safe parts.
  spotList() {
    const t = this.server.time;
    if (this.spots.length && t - this.spotsAt < 30 && !this.dirty) return this.spots;
    if (this.dirty) this.rebuild();
    this.spotsAt = t;
    const spots = [];
    for (const p of this._parts()) {
      if (!p._p.Anchored || DANGER.test(p.Name) || /ceiling|roof/i.test(p.Name) || p._p.Transparency > 0.9) continue;
      const b = partBox(p);
      if (b.ay[1] < 0.95 || b.shape !== 'Block') continue;
      const w = b.hx * 2, d = b.hz * 2;
      if (w < 4 || d < 4) continue;
      const top = b.cy + b.hy;
      if (top > 400 || top < -50) continue;
      // big floors count more, but not hugely
      const n = Math.min(6, Math.ceil(Math.sqrt(w * d) / 30));
      for (let i = 0; i < n; i++) {
        const lx = (Math.random() - 0.5) * (w - 3), lz = (Math.random() - 0.5) * (d - 3);
        const x = b.cx + b.ax[0] * lx + b.az[0] * lz, z = b.cz + b.ax[2] * lx + b.az[2] * lz;
        spots.push({ x, y: top + 3.05, z, part: p });
      }
    }
    this.spots = spots;
    return spots;
  }

  // ------------------------------------------------------------ pickups
  // Coins (and MM2's dropped gun) lying around: what people run for.
  pickups() {
    const t = this.server.time;
    if (this.pickAt !== undefined && t - this.pickAt < 0.5) return this.picks;
    this.pickAt = t;
    const out = [];
    const walk = (i) => {
      for (const c of i._children) {
        if (c._isCharacter) continue;
        if (c instanceof BasePart && /coin|gundrop/i.test(c.Name) && c._p.Transparency < 0.9) {
          const sz = c._p.Size;
          if (sz.X < 8 && sz.Y < 8 && sz.Z < 8) out.push(c);
        }
        if (c._children.length) walk(c);
      }
    };
    walk(this.ws);
    this.picks = out;
    return out;
  }

  // shop buttons (parts named ShopButton with a ClickDetector)
  buttons() {
    const t = this.server.time;
    if (this.btnAt !== undefined && t - this.btnAt < 20) return this.btns;
    this.btnAt = t;
    this.btns = this.ws.GetDescendants().filter((d) => d instanceof BasePart && /shopbutton/i.test(d.Name) && d.FindFirstChildOfClass('ClickDetector'));
    return this.btns;
  }

  // ------------------------------------------------------------ finding the way
  // Can a character stand at (x, z) coming from feet height `ref`? Returns the
  // floor height or null (a wall, the void, lava, no room for the body).
  standAt(x, z, ref) {
    const top = ref + 5.6;
    const r = this.ray(x, top, z, 0, -1, 0, 22);
    if (r.d >= 22 || r.d < 0.05) return null;
    if (r.part && DANGER.test(r.part.Name)) return null;
    const fy = top - r.d;
    for (const h of [1.3, 3.2, 4.4]) if (this.blocked(x, fy + h, z, 0.8)) return null;
    return fy;
  }

  blocked(x, y, z, R) {
    for (const b of this.query(x - R - 1, z - R - 1, x + R + 1, z + R + 1)) if (sphereVsBox(b, x, y, z, R)) return true;
    return false;
  }

  // A* over 2-stud cells: walls, doors, steps (jumps up to 5 studs), drops.
  // Returns waypoints [{x, z, y (feet), jump}] or null.
  path(sx, sfeet, sz, gx, gfeet, gz, maxNodes = 2500) {
    const C = 2;
    const cell = (v) => Math.round(v / C);
    const six = cell(sx), siz = cell(sz), gix = cell(gx), giz = cell(gz);
    const memo = new Map();
    const stand = (ix, iz, ref) => {
      const k = ix + ',' + iz + ',' + Math.round(ref);
      if (!memo.has(k)) memo.set(k, this.standAt(ix * C, iz * C, ref));
      return memo.get(k);
    };
    const start = { ix: six, iz: siz, fy: sfeet, g: 0, f: 0, prev: null, jump: false };
    const open = [start];
    const best = new Map([[six + ',' + siz, start]]);
    const closed = new Set();
    const h = (n) => Math.hypot(n.ix - gix, n.iz - giz);
    start.f = h(start);
    let end = null, n = 0, closest = start;
    while (open.length && n++ < maxNodes) {
      // (a small open list: a linear pick is fine and simple)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      const key = cur.ix + ',' + cur.iz;
      if (closed.has(key)) continue;
      closed.add(key);
      if (h(cur) < h(closest)) closest = cur;
      if (Math.abs(cur.ix - gix) <= 1 && Math.abs(cur.iz - giz) <= 1 && Math.abs(cur.fy - gfeet) < 4) { end = cur; break; }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const nx = cur.ix + dx, nz = cur.iz + dz;
          if (closed.has(nx + ',' + nz)) continue;
          const fy = stand(nx, nz, cur.fy);
          if (fy === null) continue;
          const dy = fy - cur.fy;
          if (dy > 5 || dy < -14) continue;
          // no cutting corners past walls
          if (dx && dz && (stand(cur.ix + dx, cur.iz, cur.fy) === null || stand(cur.ix, cur.iz + dz, cur.fy) === null)) continue;
          const jump = dy > 1.2;
          const g = cur.g + (dx && dz ? 1.414 : 1) + (jump ? 3 : 0) + (dy < -4 ? 2 : 0);
          const k = nx + ',' + nz;
          const old = best.get(k);
          if (old && old.g <= g) continue;
          const node = { ix: nx, iz: nz, fy, g, f: 0, prev: cur, jump };
          node.f = g + h(node);
          best.set(k, node);
          open.push(node);
        }
      }
      // running jumps over gaps (obbies, platforms): from an edge to a floor
      // 4-10 studs away, as far as a jump carries
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const n1 = stand(cur.ix + dx, cur.iz + dz, cur.fy);
          if (n1 !== null && n1 - cur.fy > -4) continue; // just walk there
          for (let k = 2; k <= 5; k++) {
            const nx = cur.ix + dx * k, nz = cur.iz + dz * k;
            const len = k * C * (dx && dz ? 1.414 : 1);
            const fy = stand(nx, nz, cur.fy + 3.5);
            if (fy === null) continue;
            const dy = fy - cur.fy;
            if (dy > 3.5 || dy < -10 || len > (dy > 1 ? 6.5 : dy > -2 ? 8 : 10)) break;
            const key = nx + ',' + nz;
            if (closed.has(key)) break;
            const g = cur.g + k * 1.5 + 4;
            const old = best.get(key);
            if (old && old.g <= g) break;
            const node = { ix: nx, iz: nz, fy, g, f: 0, prev: cur, jump: true, gap: true };
            node.f = g + h(node);
            best.set(key, node);
            open.push(node);
            break;
          }
        }
      }
    }
    if (!end) return null;
    const pts = [];
    for (let x = end; x; x = x.prev) pts.push({ x: x.ix * C, z: x.iz * C, y: x.fy, jump: x.jump, gap: !!x.gap });
    pts.reverse();
    pts.push({ x: gx, z: gz, y: gfeet, jump: false });
    // smooth: skip points the bot can walk to in a straight line
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = Math.min(pts.length - 1, i + 12);
      for (; j > i + 1; j--) if (!pts.slice(i + 1, j + 1).some((q) => q.jump) && this._straight(pts[i], pts[j])) break;
      out.push(pts[j]);
      i = j;
    }
    return out.slice(1);
  }

  _straight(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d);
    let fy = a.y;
    for (let k = 1; k < n; k++) {
      const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n;
      const y = this.standAt(x, z, fy);
      if (y === null || Math.abs(y - fy) > 1.2) return false;
      fy = y;
    }
    return true;
  }
}

function worldOf(server) { return server._botWorld || (server._botWorld = new BotWorld(server)); }

// ---------------------------------------------------------------- chat
const SAY = {
  en: {
    hi: ['hi', 'hii', 'hello', 'hey guys', 'yo', 'sup'],
    reply: ['hi', 'hey', 'hello :)', 'yo', 'hii'],
    random: ['lol', 'this game is cool', 'anyone wanna be friends?', 'how do i get robits', 'lag', 'brb', 'oof', 'who wants to team?', 'follow me', 'xD', 'wait for me', 'where do i go', 'nice', 'can someone help me', 'im bored', 'add me', 'this is my fav game', 'lets go!!', 'whats ur fav game', 'i love this place'],
    died: ['oof', 'noooo', 'bruh', 'not again', 'rip me', 'lol i died'],
    bye: ['bye', 'gtg', 'cya', 'bye guys', 'gtg dinner'],
    hide: ['dont find me lol', 'shh im hiding', 'u cant see me'],
    name: ['what?', 'yes?', 'hm?', 'me?', 'yeah?'],
    cheat: ['ez', 'too slow lol', 'cant catch me', 'im just fast', 'skill issue'],
    afk: ['brb', 'afk', 'afk 1 min'],
    accuse: ['{n} is the murderer!!', 'ITS {n}', 'run!! {n} has a knife', '{n} is murder', 'sheriff its {n}!'],
    friend: ['sent u a friend request', 'add me back', 'lets be friends', 'friend me :)'],
  },
  ru: {
    hi: ['привет', 'всем привет', 'хай', 'ку', 'приветик'],
    reply: ['привет', 'ку', 'хай', 'привет)', 'здарова'],
    random: ['лол', 'кто хочет дружить?', 'классная игра', 'как получить робитсы', 'лагает', 'щас вернусь', 'ооф', 'кто со мной?', 'идите за мной', 'хахах', 'подождите меня', 'куда идти?', 'круто', 'помогите плиз', 'скучно', 'добавьте в друзья', 'моя любимая игра', 'погнали!!', 'какая у вас любимая игра?'],
    died: ['ооф', 'нееет', 'блин', 'опять', 'я умер лол'],
    bye: ['пока', 'мне пора', 'всем пока', 'бб', 'ушёл кушать'],
    hide: ['не ищите меня лол', 'тсс я прячусь', 'меня не видно'],
    name: ['что?', 'а?', 'да?', 'чего?', 'я?'],
    cheat: ['изи', 'медленные лол', 'не догоните', 'я просто быстрый', 'нубы'],
    afk: ['щас приду', 'афк', 'афк минуту'],
    accuse: ['{n} убийца!!', 'ЭТО {n}', 'бегите!! у {n} нож', '{n} мардер', 'шериф это {n}!'],
    friend: ['кинул тебе заявку в друзья', 'добавь меня', 'давай дружить', 'прими заявку)'],
  },
};
const HI = /^(hi+|hey+|hello|yo|sup|привет\S*|ку|хай|здаров\S*|всем привет)\b/i;
const EMOTES = ['dance', 'dance2', 'wave', 'cheer', 'laugh', 'point'];

// ---------------------------------------------------------------- one bot
// kind: '' for a fair player, or 'speed' / 'fly' / 'teleport'.
export class Bot {
  constructor(server, user, avatar, { cheat = '', lang = 'en', onGone } = {}) {
    this.server = server;
    this.user = user;
    this.cheat = cheat;
    this.lang = lang;
    this.onGone = onGone || (() => {});
    this.gone = false;
    this.world = worldOf(server);
    // a little personality: how much they move, chat, idle, hide
    this.p = {
      active: rnd(0.5, 1), chatty: rnd(0, 1), afky: rnd(0, 1), hider: rnd(0, 1), jumpy: rnd(0, 1), social: rnd(0, 1),
    };
    this.stayFor = rnd(90, 900) * (0.6 + this.p.active * 0.6); // seconds before going home
    this.joinedAt = server.time;
    this.state = null; // character controller state
    this.char = null;
    this.task = { kind: 'idle', until: server.time + rnd(1, 3) };
    this.nextSend = 0;
    this.nextChat = server.time + rnd(4, 20);
    this.nextCheat = server.time + rnd(15, 40);
    this.burst = null; // a cheat in progress
    this.lastSaid = new Map();
    this.pendingReply = null;
    this.stuckT = 0;
    this.ry = 0;
    this.ws = {
      readyState: 1,
      send: () => {},
      close: () => this._gone(),
    };
    this.session = server.join(this.ws, user, avatar, { bot: this });
    (server.bots || (server.bots = new Set())).add(this);
    if (chance(0.45 * (0.4 + this.p.chatty))) this.later(rnd(2, 6), () => this.say('hi'));
  }

  // ------------------------------------------------------------ messages from the server
  // GameServer.send / broadcast hand bots the message itself (no JSON)
  hear(m) {
    if (this.gone || !m) return;
    switch (m.t) {
      case 'teleport':
        if (this.state && Array.isArray(m.cf)) {
          Object.assign(this.state, { x: m.cf[0], y: m.cf[1], z: m.cf[2], vx: 0, vy: 0, vz: 0 });
          this.nav = null;
          // moved somewhere new (a round started): most people look up from their phone
          if (this.task.kind === 'afk' && chance(0.85)) this.setTask('idle', rnd(0.5, 3));
        }
        break;
      case 'impulse':
        if (this.state && Array.isArray(m.v)) { const st = this.state; if (m.set) { st.vx = 0; st.vy = 0; st.vz = 0; } st.vx += +m.v[0] || 0; st.vy += +m.v[1] || 0; st.vz += +m.v[2] || 0; st.grounded = false; st.jumped = true; }
        break;
      case 'chat': if (m.userId !== this.user.id) this._heard(m); break;
      case 'kick': case 'shutdown': this._gone(); break;
      default:
    }
  }

  _heard(m) {
    const text = String(m.text || '').toLowerCase();
    if (this.pendingReply || this.task.kind === 'afk') return;
    const named = text.includes(this.user.username.toLowerCase());
    if (named && chance(0.8)) this.pendingReply = { at: this.server.time + rnd(1.5, 4), what: 'name' };
    else if (HI.test(text) && this.server.time - (this.lastHiReply || -1e9) > 30 && chance(0.25 + this.p.chatty * 0.4)) {
      this.lastHiReply = this.server.time;
      this.pendingReply = { at: this.server.time + rnd(1.5, 5), what: 'reply' };
    }
    // someone says "follow me": the social ones do
    if (/follow me|за мной|идите за мной/.test(text) && chance(this.p.social * 0.7)) {
      const s = [...this.server.sessions.values()].find((x) => x.user.id === m.userId);
      if (s) this.setTask('follow', rnd(10, 25), { who: s });
    }
  }

  say(what, raw) {
    if (this.gone) return;
    const lang = SAY[this.lang] || SAY.en;
    let text = raw || pick(lang[what] || lang.random);
    // people don't type perfectly
    if (!raw && chance(0.15)) text = text.toUpperCase();
    else if (!raw && chance(0.2)) text += pick(['', '!', '!!', ' :)', ' lol', ')']);
    this.server.handle(this.session, { t: 'chat', text });
  }

  later(sec, fn) { (this.timers || (this.timers = [])).push({ at: this.server.time + sec, fn }); }

  leave() {
    if (this.gone) return;
    this.server.leave(this.session, 'left');
    this._gone();
  }

  _gone() {
    if (this.gone) return;
    this.gone = true;
    this.ws.readyState = 3;
    if (this.server.sessions.get(this.user.id) === this.session) this.server.leave(this.session, 'left');
    if (this.server.bots) this.server.bots.delete(this);
    this.onGone(this);
  }

  // ------------------------------------------------------------ what to do next
  setTask(kind, sec, extra = {}) { this.task = { kind, until: this.server.time + sec, started: this.server.time, ...extra }; this.stuckT = 0; }

  others() { return [...this.server.sessions.values()].filter((s) => s !== this.session && s.character); }

  chooseTask() {
    const t = this.server.time;
    if (t - this.joinedAt > this.stayFor) {
      if (chance(0.5 + this.p.chatty * 0.3)) this.say('bye');
      this.setTask('leaving', rnd(1.5, 4));
      return;
    }
    const others = this.others();
    // in a round (a role, coins out): no AFK or resets, more hiding
    const round = !!this._role() || this.world.pickups().length > 0;
    const w = [
      ['walk', 5 * this.p.active],
      ['idle', 1.5],
      ['afk', round ? 0 : this.p.afky * 0.6],
      ['follow', others.length ? 2 * this.p.social : 0],
      ['hide', this.p.hider * (round ? 2.5 : 1.2)],
      ['jump', this.p.jumpy * 0.8],
      ['emote', 0.5],
      ['tool', this._tools().filter((x) => x.Name !== 'Knife' && x.Name !== 'Gun').length ? 1.2 : 0],
      ['reset', round ? 0 : 0.08],
    ];
    let r = Math.random() * w.reduce((a, x) => a + x[1], 0);
    let kind = 'walk';
    for (const [k, v] of w) { if ((r -= v) <= 0) { kind = k; break; } }
    switch (kind) {
      case 'walk': this.setTask('walk', rnd(8, 25), { to: this._spot() }); break;
      case 'idle': this.setTask('idle', rnd(1.5, 6)); break;
      case 'afk':
        if (chance(0.4)) this.say('afk');
        this.setTask('afk', rnd(25, 120));
        break;
      case 'follow': {
        // people follow people (more than bots), and someone who's moving
        const real = others.filter((o) => !o.bot);
        const pool = real.length && chance(0.7) ? real : others;
        const moving = pool.filter((o) => Math.hypot(o.state.v?.[0] || 0, o.state.v?.[2] || 0) > 2);
        this.setTask('follow', rnd(10, 30), { who: pick(moving.length ? moving : pool), still: 0 });
        break;
      }
      case 'hide': {
        const to = this._hideSpot();
        this.setTask('hide', rnd(15, 30), { to, wait: rnd(12, 40) });
        if (chance(0.15 * this.p.chatty)) this.later(rnd(5, 12), () => this.say('hide'));
        break;
      }
      case 'jump': this.setTask('jump', rnd(3, 8), { to: chance(0.5) ? this._spot(30) : null }); break;
      case 'emote':
        this.server.handle(this.session, { t: 'chat', text: '/e ' + pick(EMOTES) });
        this.setTask('idle', rnd(3, 7));
        break;
      case 'tool': this.setTask('tool', rnd(6, 15), { tool: pick(this._tools().filter((x) => x.Name !== 'Knife' && x.Name !== 'Gun')) }); break;
      case 'reset':
        this.server.handle(this.session, { t: 'reset' });
        this.setTask('idle', rnd(2, 4));
        break;
      default: this.setTask('idle', 3);
    }
  }

  // somewhere to walk: mostly near, sometimes anywhere
  _spot(near = 0) {
    const spots = this.world.spotList();
    if (!spots.length || !this.state) return null;
    const s = this.state;
    const range = near || (chance(0.7) ? 70 : 1e9);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      const c = pick(spots);
      const d = Math.hypot(c.x - s.x, c.z - s.z);
      if (d < 6 || (c.bad && this.server.time - c.bad < 60)) continue;
      const up = c.y - s.y;
      // far, much higher or much lower spots are less likely
      const score = -(d > range ? d : 0) - Math.max(0, up - 4) * 3 - Math.max(0, -up - 20) + Math.random() * 30;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // somewhere away from everyone, ideally behind a wall
  _hideSpot() {
    const spots = this.world.spotList();
    const others = this.others();
    if (!spots.length || !this.state) return null;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 20; i++) {
      const c = pick(spots);
      const d0 = Math.hypot(c.x - this.state.x, c.z - this.state.z);
      if (d0 > 150 || Math.abs(c.y - this.state.y) > 10 || (c.bad && this.server.time - c.bad < 60)) continue;
      let near = 200, seen = false;
      for (const o of others) {
        const [ox, oy, oz] = o.state.p;
        const d = Math.hypot(c.x - ox, c.y - oy, c.z - oz);
        near = Math.min(near, d);
        if (d < 120) {
          const r = this.world.ray(ox, oy + 1.5, oz, (c.x - ox) / d, (c.y + 1.5 - oy - 1.5) / d, (c.z - oz) / d, d);
          if (r.d >= d - 1) seen = true;
        }
      }
      const score = near + (seen ? 0 : 60) - d0 * 0.2;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  _tools() {
    const bp = this.session.player && this.session.player.FindFirstChild('Backpack');
    return bp ? bp.GetChildren().filter((t) => t.ClassName === 'Tool') : [];
  }

  // ------------------------------------------------------------ every tick
  step(dt) {
    if (this.gone) return;
    const server = this.server;
    const t = server.time;
    const session = this.session;
    if (server.sessions.get(this.user.id) !== session) { this._gone(); return; }
    if (this.timers && this.timers.length) {
      const due = this.timers.filter((x) => t >= x.at);
      if (due.length) { this.timers = this.timers.filter((x) => t < x.at); for (const x of due) x.fn(); }
    }
    if (this.pendingReply && t >= this.pendingReply.at) { this.say(this.pendingReply.what); this.pendingReply = null; }
    if (this.task.kind === 'leaving') { if (t >= this.task.until) this.leave(); return; }
    const ch = session.character;
    const hum = ch && ch.FindFirstChildOfClass('Humanoid');
    if (!ch || !hum) { this.char = null; return; }
    if (hum.Health <= 0) {
      if (this.char === ch && !this.saidDied) { this.saidDied = true; if (chance(0.35 * (0.3 + this.p.chatty))) this.later(rnd(0.5, 2), () => this.say('died')); }
      return;
    }
    // a fresh character (joined, died, reset): start from where the server put it
    if (this.char !== ch) {
      this.char = ch;
      this.saidDied = false;
      const [x, y, z] = session.state.p;
      this.state = { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false };
      this.burst = null;
      this.nav = null;
      this.setTask('idle', rnd(0.5, 2.5));
    }
    // sat in a seat: get out after a while
    if (session.vehicle) {
      if (!this.seatAt) this.seatAt = t + rnd(3, 12);
      if (t >= this.seatAt) { this.seatAt = 0; server.handle(session, { t: 'exitVehicle' }); }
      return;
    }
    if (t >= this.task.until) this.chooseTask();
    if (this.task.kind === 'leaving') return;
    if (this.task.kind !== 'afk' && t >= this.nextChat) {
      this.nextChat = t + rnd(25, 120) / (0.3 + this.p.chatty);
      if (this.others().length && chance(0.6)) this.say('random');
    }
    if (t >= (this.nextThink || 0)) { this.nextThink = t + rnd(0.2, 0.35); this._think(t); }
    if (this.cheat) this._cheat(t);
    this._move(dt, hum);
  }

  // ------------------------------------------------------------ moving
  _move(dt, hum) {
    const s = this.state;
    const task = this.task;
    const t = this.server.time;
    let goal = null, jump = false, speedK = 1, moving = false;
    const posOf = (o) => ({ x: o.state.p[0], y: o.state.p[1], z: o.state.p[2], moving: true });
    if (task.kind === 'walk' || task.kind === 'jump' || task.kind === 'flee') goal = task.to;
    else if (task.kind === 'hide') {
      goal = task.to;
      if (goal && Math.hypot(goal.x - s.x, goal.z - s.z) < 3) { this.setTask('idle', task.wait); goal = null; }
    } else if (task.kind === 'collect') {
      const c = task.part;
      if (!c || c._destroyed || !c._parent) { this.task.until = t; } else goal = { x: c._p.CFrame.x, y: c._p.CFrame.y + 1, z: c._p.CFrame.z, near: 0.6 };
    } else if (task.kind === 'follow') {
      const o = task.who;
      if (!this._alive(o)) this.task.until = t;
      else {
        const d = Math.hypot(o.state.p[0] - s.x, o.state.p[2] - s.z);
        if (d > 6) goal = posOf(o);
        if (d > 200) this.task.until = t; // too far, forget it
        // they just stand there: get bored
        const v = o.state.v || [0, 0, 0];
        task.still = Math.hypot(v[0] || 0, v[2] || 0) < 1 && d <= 8 ? (task.still || 0) + dt : 0;
        if (task.still > rnd(3, 6)) this.task.until = t;
      }
    } else if (task.kind === 'tool') {
      this._useTool(task);
      const o = task.target;
      if (this._alive(o) && Math.hypot(o.state.p[0] - s.x, o.state.p[2] - s.z) > 5) goal = posOf(o);
    } else if (task.kind === 'hunt' || task.kind === 'shoot') {
      goal = this._fight(task, t);
    }
    if (task.kind === 'jump' && s.grounded && chance(dt * 4)) jump = true;
    let mx = 0, mz = 0;
    if (goal) {
      const w = this._steer(goal, t);
      if (w) this.failN = 0;
      if (!w) {
        // can't get there: forget it (and that spot for a while); after a
        // few misses just head somewhere close in a straight line
        if (!goal.moving && (this.failN = (this.failN || 0) + 1) >= 3) { this.failN = 0; const to = this._spot(25); if (to) { this.setTask('walk', rnd(4, 9), { to: { ...to, direct: true } }); return; } }
        if (!goal.moving) { goal.bad = t; this.task.until = t; }
        if (task.kind === 'collect' && task.part) task.part._botSkip = true;
      } else if (w.arrived) {
        if (task.kind === 'walk' || task.kind === 'collect') this.task.until = Math.min(this.task.until, t + (task.kind === 'collect' ? 0.2 : rnd(0, 2)));
      } else {
        const dx = w.x - s.x, dz = w.z - s.z;
        const d = Math.hypot(dx, dz) || 1;
        mx = dx / d; mz = dz / d;
        moving = true;
        // a little sway instead of a laser-straight line (only on long legs)
        if (d > 8) {
          const wob = Math.sin(t * 0.7 + this.user.id) * 0.18;
          const c = Math.cos(wob), sn = Math.sin(wob);
          [mx, mz] = [mx * c - mz * sn, mx * sn + mz * c];
        }
        if (s.grounded && w.jump) {
          if (w.gap) {
            // a running jump: take off at the edge
            const f = this.world.floor(s.x + mx * 1.1, s.y, s.z + mz * 1.1, 8);
            if (f.d > 4.5 || d < 2.5) jump = true;
          } else if (d < 4) jump = true;
        }
        if (s.grounded) {
          // blocked: jump, then find the way again
          const sp = Math.hypot(s.vx, s.vz);
          if (sp < hum.WalkSpeed * 0.3 && t - (task.started || 0) > 0.5) {
            this.stuckT += dt;
            if (this.stuckT > 0.4) jump = true;
            if (this.stuckT > 1.5 && this.nav) this.nav.at = -1e9; // repath
            if (this.stuckT > 5) { this.stuckT = 0; this.task.until = t; if (chance(0.05)) this.server.handle(this.session, { t: 'reset' }); }
          } else this.stuckT = Math.max(0, this.stuckT - dt);
        }
        if (task.kind !== 'hunt' && task.kind !== 'flee' && chance(dt * 0.12 * this.p.jumpy)) jump = true;
      }
    }
    if (!moving) this.stuckT = 0;
    if (this.burst && this.burst.kind === 'speed') speedK = this.burst.k;
    const humP = { WalkSpeed: Math.max(0, hum.WalkSpeed) * speedK, JumpPower: hum.JumpPower, BodyScale: hum._p.BodyScale || 1 };
    const gravity = this.server.game.Workspace.Gravity;
    const flying = this.burst && this.burst.kind === 'fly';
    if (flying) { s.vy = this.burst.vy; s.jumped = true; }
    stepCharacter(s, { mx, mz, jump: !flying && jump }, dt, { query: (a, b, c, d) => this.world.query(a, b, c, d), gravity: flying ? 0 : gravity }, humP);
    if (mx || mz) {
      let d = Math.atan2(-mx, -mz) - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * Math.min(1, dt * 10);
    }
    if (t >= this.nextSend) {
      this.nextSend = t + 1 / SEND_HZ;
      const hs = Math.hypot(s.vx, s.vz);
      const a = flying ? 'fall' : s.grounded ? (hs > 0.5 ? 'walk' : 'idle') : (s.vy > 0 ? 'jump' : 'fall');
      if (this.task.kind === 'afk' && s.grounded && hs < 0.1 && this.sentStill) return; // standing still: nothing to send, like the client
      this.sentStill = s.grounded && hs < 0.1;
      this.server.handle(this.session, { t: 'move', p: [s.x, s.y, s.z], ry: this.ry, a, v: [s.vx, s.vy, s.vz] });
    }
  }

  _alive(o) {
    if (!o || !o.character || this.server.sessions.get(o.user.id) !== o) return false;
    const h = o.character.FindFirstChildOfClass('Humanoid');
    return !!h && h.Health > 0;
  }

  // Next point on the way to `goal` (found with BotWorld.path), or null when
  // there is no way. {arrived: true} once there.
  _steer(goal, t) {
    const s = this.state;
    const feet = s.y - 3;
    const near = goal.near || 1.6;
    const d = Math.hypot(goal.x - s.x, goal.z - s.z);
    if (d < near && Math.abs(goal.y - s.y) < 5) return { arrived: true };
    if (goal.direct) return { x: goal.x, z: goal.z, jump: goal.y > s.y + 1.5 };
    let nav = this.nav;
    const moved = nav && Math.hypot(nav.gx - goal.x, nav.gz - goal.z);
    const stale = !nav || nav.goal !== goal && moved > (goal.moving ? 5 : 1) || (goal.moving && t - nav.at > 1.5) || t - nav.at > 12;
    if (stale && t >= (this.nextPath || 0)) {
      this.nextPath = t + 0.5;
      // close and clear: just walk
      let pts = d < 10 && Math.abs(goal.y - s.y) < 2 && this.world._straight({ x: s.x, z: s.z, y: feet }, { x: goal.x, z: goal.z, y: goal.y - 3 })
        ? [{ x: goal.x, z: goal.z, y: goal.y - 3, jump: false }]
        : this.world.path(s.x, feet, s.z, goal.x, goal.y - 3, goal.z);
      nav = this.nav = { goal, gx: goal.x, gz: goal.z, pts, i: 0, at: t };
    }
    if (!nav) return goal.moving ? { x: goal.x, z: goal.z } : null;
    if (!nav.pts) return goal.moving ? { x: goal.x, z: goal.z } : null;
    while (nav.i < nav.pts.length - 1 && Math.hypot(nav.pts[nav.i].x - s.x, nav.pts[nav.i].z - s.z) < 1.3) nav.i++;
    const w = nav.pts[nav.i];
    if (!w) return { arrived: true };
    if (nav.i === nav.pts.length - 1 && Math.hypot(w.x - s.x, w.z - s.z) < near) return { arrived: true };
    return w;
  }

  // ------------------------------------------------------------ Murder Mystery
  // Roles come from the tools: the knife makes a murderer, the gun a sheriff.
  _holds(sess, name) {
    const ch = sess && sess.character;
    const x = ch && ch.FindFirstChild(name);
    return !!x && x.ClassName === 'Tool';
  }

  _has(name) {
    if (this._holds(this.session, name)) return true;
    const bp = this.session.player && this.session.player.FindFirstChild('Backpack');
    return !!(bp && bp.FindFirstChild(name));
  }

  _role() { return this._has('Knife') ? 'murderer' : this._has('Gun') ? 'sheriff' : ''; }

  _sees(o) {
    const s = this.state;
    const [ox, oy, oz] = o.state.p;
    const d = Math.hypot(ox - s.x, oy - s.y, oz - s.z);
    if (d < 1) return true;
    const r = this.world.ray(s.x, s.y + 1.5, s.z, (ox - s.x) / d, (oy - s.y) / d, (oz - s.z) / d, d);
    return r.d >= d - 1.5;
  }

  _equip(name) {
    const ch = this.session.character;
    if (this._holds(this.session, name)) return ch.FindFirstChild(name);
    const bp = this.session.player && this.session.player.FindFirstChild('Backpack');
    const tool = bp && bp.FindFirstChild(name);
    if (tool) this.server.handle(this.session, { t: 'equip', id: tool.id });
    return null;
  }

  // What's going on around: run from a murderer, shoot one, hunt, grab coins
  // and the dropped gun. Called a few times a second.
  _think(t) {
    const s = this.state;
    const role = this._role();
    if (role !== this.lastRole) {
      this.lastRole = role;
      if (role === 'murderer') this.huntAfter = t + rnd(6, 22); // act normal for a bit first
      if (role) this.setTask('idle', rnd(0.5, 2));
      else if (this.session.character) this.server.handle(this.session, { t: 'equip', id: null });
    }
    if (this.task.kind === 'afk') return;
    const busy = ['hunt', 'shoot', 'leaving'].includes(this.task.kind);
    const others = this.others().filter((o) => this._alive(o));
    if (role !== 'murderer') {
      // someone with a knife out, close and in sight
      const killer = others.find((o) => this._holds(o, 'Knife') && Math.hypot(o.state.p[0] - s.x, o.state.p[2] - s.z) < (role ? 80 : 40) && this._sees(o));
      if (killer) {
        if (!this.accused) this.accused = new Set();
        if (!this.accused.has(killer.user.id)) {
          this.accused.add(killer.user.id);
          if (chance(0.45)) this.later(rnd(0.6, 2), () => this.say('', pick((SAY[this.lang] || SAY.en).accuse).replace('{n}', killer.user.username)));
        }
        if (role === 'sheriff' && this.task.kind !== 'shoot') { this.setTask('shoot', rnd(6, 10), { who: killer, fireAt: t + rnd(0.5, 1.2) }); return; }
        if (!role && this.task.kind !== 'flee') { this.setTask('flee', rnd(4, 7), { to: this._awayFrom(killer) }); return; }
      }
    }
    if (role === 'murderer' && !busy && t >= (this.huntAfter || 0)) {
      // the one alone first
      const lonely = others.map((o) => [o, others.filter((x) => x !== o && Math.hypot(x.state.p[0] - o.state.p[0], x.state.p[2] - o.state.p[2]) < 18).length + Math.hypot(o.state.p[0] - s.x, o.state.p[2] - s.z) / 40]).sort((a, b) => a[1] - b[1]);
      if (lonely.length) { this.setTask('hunt', rnd(15, 35), { who: chance(0.75) ? lonely[0][0] : pick(lonely)[0] }); return; }
    }
    if (busy || this.task.kind === 'flee' || this.task.kind === 'collect') return;
    const picks = this.world.pickups();
    // between rounds: now and then spend coins in a shop (buttons people click)
    if (!role && !picks.length && chance(0.006)) {
      const btn = this.world.buttons().filter((b) => Math.hypot(b._p.CFrame.x - s.x, b._p.CFrame.z - s.z) < 35);
      if (btn.length) this.server.handle(this.session, { t: 'click', id: pick(btn).id });
    }
    // the dropped gun: an innocent goes for it
    if (!role) {
      const gun = picks.find((p) => /gundrop/i.test(p.Name));
      if (gun && Math.hypot(gun._p.CFrame.x - s.x, gun._p.CFrame.z - s.z) < 140 && chance(0.25 + this.p.social * 0.3)) { this.setTask('collect', 25, { part: gun }); return; }
    }
    // coins nearby: most people grab them
    if (['idle', 'walk', 'jump'].includes(this.task.kind) && picks.length && chance(0.35)) {
      const near = picks.filter((p) => !/gundrop/i.test(p.Name) && !p._botSkip).map((p) => [p, Math.hypot(p._p.CFrame.x - s.x, p._p.CFrame.z - s.z) + Math.abs(p._p.CFrame.y - s.y) * 3]).filter((x) => x[1] < 70).sort((a, b) => a[1] - b[1]);
      if (near.length) this.setTask('collect', 12, { part: pick(near.slice(0, 3))[0] });
    }
  }

  // somewhere far from someone
  _awayFrom(o) {
    const s = this.state;
    const [ox, , oz] = o.state.p;
    const spots = this.world.spotList().filter((c) => !c.bad && Math.abs(c.y - s.y) < 6 && Math.hypot(c.x - s.x, c.z - s.z) < 60);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 14 && spots.length; i++) {
      const c = pick(spots);
      const score = Math.hypot(c.x - ox, c.z - oz) - Math.hypot(c.x - s.x, c.z - s.z) * 0.3 + Math.random() * 5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best || { x: s.x + (s.x - ox), y: s.y, z: s.z + (s.z - oz) };
  }

  // the murderer's knife and the sheriff's gun
  _fight(task, t) {
    const s = this.state;
    const o = task.who;
    if (!this._alive(o)) {
      if (task.kind === 'hunt') this.later(rnd(0.5, 2), () => { if (this.task.kind !== 'hunt') this.server.handle(this.session, { t: 'equip', id: null }); });
      this.task.until = t;
      return null;
    }
    const [ox, oy, oz] = o.state.p;
    const d = Math.hypot(ox - s.x, oz - s.z);
    if (task.kind === 'hunt') {
      if (!this._has('Knife')) { this.task.until = t; return null; }
      // the knife comes out when close (and away from a crowd, if possible)
      if (d < 16) {
        const tool = this._equip('Knife');
        if (tool && d < 5.5 && t >= (task.nextStab || 0)) {
          task.nextStab = t + rnd(0.65, 1.2);
          this.server.handle(this.session, { t: 'activate', id: tool.id, p: [ox, oy, oz] });
        }
      }
      return { x: ox, y: oy, z: oz, moving: true, near: 2.5 };
    }
    // sheriff: get a clear look, then fire (people miss sometimes)
    if (!this._has('Gun')) { this.task.until = t; return null; }
    const tool = this._equip('Gun');
    if (tool && t >= task.fireAt && this._sees(o) && d < 90) {
      const miss = chance(0.3 + d / 200) ? rnd(2, 5) * (chance(0.5) ? 1 : -1) : rnd(-0.6, 0.6);
      this.server.handle(this.session, { t: 'activate', id: tool.id, p: [ox + miss, oy + rnd(-0.5, 0.8), oz + miss * 0.5] });
      task.fireAt = t + rnd(3.1, 4);
    }
    return d > 25 || !this._sees(o) ? { x: ox, y: oy, z: oz, moving: true, near: 12 } : null;
  }

  _useTool(task) {
    const ch = this.session.character;
    if (!task.tool || task.tool._destroyed) { this.task.until = this.server.time; return; }
    if (task.tool.Parent !== ch) this.server.handle(this.session, { t: 'equip', id: task.tool.id });
    if (!task.target || !task.target.character) {
      const s = this.state;
      const near = this.others().map((o) => [o, Math.hypot(o.state.p[0] - s.x, o.state.p[2] - s.z)]).filter((x) => x[1] < 40).sort((a, b) => a[1] - b[1]);
      task.target = near.length && chance(0.8) ? near[0][0] : null;
    }
    const t = this.server.time;
    if (!task.nextUse || t >= task.nextUse) {
      task.nextUse = t + rnd(0.4, 1.5);
      const o = task.target;
      const p = o && o.character ? o.state.p : [this.state.x - Math.sin(this.ry) * 10, this.state.y, this.state.z - Math.cos(this.ry) * 10];
      // aim like a person: a bit off
      const aim = [p[0] + rnd(-2, 2), p[1] + rnd(-1, 1.5), p[2] + rnd(-2, 2)];
      this.server.handle(this.session, { t: 'activate', id: task.tool.id, p: aim });
    }
    if (t >= this.task.until - 0.1 && chance(0.7)) this.server.handle(this.session, { t: 'equip', id: null });
  }

  // ------------------------------------------------------------ cheating
  _cheat(t) {
    const s = this.state;
    const b = this.burst;
    if (!b) {
      if (t < this.nextCheat || this.task.kind === 'leaving' || t - (this.session.spawnedAt || 0) < 5) return;
      const kind = this.cheat;
      this.burst = { kind, until: t + (kind === 'fly' ? rnd(10, 16) : rnd(6, 10)), k: rnd(2.4, 3.4), vy: 0, nextTp: t + 0.5, phase: 0, phaseAt: t };
      this.setTask('walk', 20, { to: this._spot(1e9) }); // back from AFK too
      if (chance(0.3)) this.later(rnd(1, 4), () => this.say('cheat'));
      return;
    }
    if (t >= b.until) {
      this.burst = null;
      this.nextCheat = t + rnd(20, 70);
      return;
    }
    // a speed hacker keeps running while it lasts
    if (b.kind === 'speed' && this.task.kind !== 'walk' && this.task.kind !== 'follow') this.setTask('walk', 20, { to: this._spot(1e9) });
    if (b.kind === 'fly') {
      // up for ~3 s, hover, a little down, up again
      const ph = (t - b.phaseAt) % 6;
      b.vy = ph < 3 ? rnd(9, 13) : ph < 4.5 ? 0 : -4;
    } else if (b.kind === 'teleport' && t >= b.nextTp) {
      b.nextTp = t + rnd(1.2, 2.5);
      // somewhere on the map, far enough to count (never into the void)
      const spots = this.world.spotList().filter((c) => { const d = Math.hypot(c.x - s.x, c.z - s.z); return d > 40 && d < 250 && Math.abs(c.y - s.y) < 40; });
      const to = spots.length ? pick(spots) : null;
      if (to) Object.assign(s, { x: to.x, y: to.y, z: to.z, vx: 0, vy: 0, vz: 0 });
      this.nextSend = 0;
    }
  }

  info() {
    return {
      uid: this.user.id, name: this.user.username, cheat: this.cheat, doing: this.burst ? 'cheating: ' + this.burst.kind : this.task.kind,
      online: Math.round(this.server.time - this.joinedAt), lang: this.lang,
    };
  }
}
