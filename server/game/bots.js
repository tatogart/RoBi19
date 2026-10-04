// Bots that play like people: they join games, walk around, jump, follow
// someone for a while, hide, stand AFK, chat, dance, reset and leave. A few
// of them cheat (too fast, flying, teleporting), so the anti-cheat and
// Overwatch have someone real to catch. They move with the same character
// physics as the game client and send the same 'move' messages, so the game
// (scripts, touches, the anti-cheat) treats them like any other player.
import { BasePart } from '../../shared/engine/instances.js';
import { partBox, boxAABB, SpatialGrid, rayVsBox, stepCharacter } from '../../shared/engine/physics.js';

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
      if (!p._p.Anchored || DANGER.test(p.Name) || p._p.Transparency > 0.9) continue;
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
        if (this.state && Array.isArray(m.cf)) Object.assign(this.state, { x: m.cf[0], y: m.cf[1], z: m.cf[2], vx: 0, vy: 0, vz: 0 });
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
    else if (HI.test(text) && chance(0.25 + this.p.chatty * 0.4)) this.pendingReply = { at: this.server.time + rnd(1.5, 5), what: 'reply' };
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
    const w = [
      ['walk', 5 * this.p.active],
      ['idle', 1.5],
      ['afk', this.p.afky * 0.6],
      ['follow', others.length ? 2 * this.p.social : 0],
      ['hide', this.p.hider * 1.2],
      ['jump', this.p.jumpy * 0.8],
      ['emote', 0.5],
      ['tool', this._tools().length ? 1.2 : 0],
      ['reset', 0.08],
    ];
    let r = Math.random() * w.reduce((a, x) => a + x[1], 0);
    let kind = 'walk';
    for (const [k, v] of w) { if ((r -= v) <= 0) { kind = k; break; } }
    switch (kind) {
      case 'walk': this.setTask('walk', rnd(8, 25), { to: this._spot() }); break;
      case 'idle': this.setTask('idle', rnd(2, 9)); break;
      case 'afk':
        if (chance(0.4)) this.say('afk');
        this.setTask('afk', rnd(25, 120));
        break;
      case 'follow': this.setTask('follow', rnd(10, 30), { who: pick(others) }); break;
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
      case 'tool': this.setTask('tool', rnd(6, 15), { tool: pick(this._tools()) }); break;
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
      if (d < 6) continue;
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
      if (d0 > 150) continue;
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
    if (this.cheat) this._cheat(t);
    this._move(dt, hum);
  }

  // ------------------------------------------------------------ moving
  _move(dt, hum) {
    const s = this.state;
    const task = this.task;
    const t = this.server.time;
    let goal = null, jump = false, speedK = 1;
    if (task.kind === 'walk' || task.kind === 'jump') goal = task.to;
    else if (task.kind === 'hide') {
      goal = task.to;
      if (goal && Math.hypot(goal.x - s.x, goal.z - s.z) < 3) { this.setTask('idle', task.wait); }
    } else if (task.kind === 'follow') {
      const o = task.who;
      if (!o || !o.character || !this.server.sessions.has(o.user.id)) this.task.until = t;
      else {
        const [ox, oy, oz] = o.state.p;
        const d = Math.hypot(ox - s.x, oz - s.z);
        if (d > 6) goal = { x: ox, y: oy, z: oz };
        if (d > 200) this.task.until = t; // too far, forget it
      }
    } else if (task.kind === 'tool') {
      this._useTool(task);
      const o = task.target;
      if (o && o.character) { const [ox, oy, oz] = o.state.p; if (Math.hypot(ox - s.x, oz - s.z) > 5) goal = { x: ox, y: oy, z: oz }; }
    }
    if (task.kind === 'jump' && s.grounded && chance(dt * 4)) jump = true;
    let mx = 0, mz = 0;
    if (goal) {
      const dx = goal.x - s.x, dz = goal.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { if (task.kind === 'walk') this.task.until = Math.min(this.task.until, t + rnd(0, 2)); }
      else {
        mx = dx / d; mz = dz / d;
        // wander a little instead of a laser-straight line
        const wob = Math.sin(t * 0.7 + this.user.id) * 0.25;
        const c = Math.cos(wob), sn = Math.sin(wob);
        [mx, mz] = [mx * c - mz * sn, mx * sn + mz * c];
        if (s.grounded) {
          // a deep drop ahead: jump if the goal is just across, else turn back
          const ax = s.x + mx * 2.5, az = s.z + mz * 2.5;
          const f = this.world.floor(ax, s.y, az, 40);
          const deadly = f.d >= 40 || (f.part && DANGER.test(f.part.Name));
          if (f.d > 6 && !(f.d < 20 && !deadly)) {
            // (a small drop: just walk off it)
            if (d < 16 && goal.y < s.y + 6) jump = true;
            else { mx = 0; mz = 0; this.task.until = t; }
          }
          // blocked: jump over it
          const sp = Math.hypot(s.vx, s.vz);
          if (sp < hum.WalkSpeed * 0.3 && t - (task.started || 0) > 0.5) {
            this.stuckT += dt;
            if (this.stuckT > 0.3) jump = true;
            if (this.stuckT > 4) { this.stuckT = 0; this.task.until = t; if (chance(0.05)) this.server.handle(this.session, { t: 'reset' }); }
          } else this.stuckT = Math.max(0, this.stuckT - dt);
        }
        if (chance(dt * 0.15 * this.p.jumpy)) jump = true;
      }
    }
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
