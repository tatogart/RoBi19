// One running game instance ("server" in the 2019 sense): owns a DataModel,
// runs its Scripts, simulates touches/physics and replicates to clients.
import crypto from 'node:crypto';
import { CFrame, Vector3 } from '../../shared/engine/types.js';
import {
  DataModel, BaseScript, BasePart, Script, SpawnLocation, Explosion, Humanoid, ClickDetector,
  createInstance, setErrorReporter, partAABB, CLASSES,
} from '../../shared/engine/instances.js';
import { loadPlace, serialize, encodeValue } from '../../shared/engine/serialize.js';
import { partBox, boxAABB, boxesOverlap, SpatialGrid, aabbOverlap } from '../../shared/engine/physics.js';
import { buildCharacter, poseCharacter, rootCFrame, LIMBS } from '../../shared/engine/character.js';
import { LuaRuntime } from './lua.js';
import { installServices } from './services.js';
import { filterChat } from './chatfilter.js';

const TICK_HZ = 30;
const REPLICATED = new Set(['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'StarterGui', 'Teams']);
const RUNNABLE = new Set(['Workspace', 'ServerScriptService']);
const EMPTY_SHUTDOWN_MS = 60_000;

export class GameServer {
  constructor(opts) {
    this.id = crypto.randomUUID();
    this.gameId = opts.gameId || 0;
    this.name = opts.name || 'Place';
    this.creatorId = opts.creatorId || 0;
    this.maxPlayers = opts.maxPlayers || 12;
    this.isTest = !!opts.test;
    this.backend = opts.backend || {};
    this.onClose = opts.onClose || (() => {});
    this.manager = opts.manager || null;
    this.sessions = new Map(); // userId -> session
    this.queue = [];
    this.setIndex = new Map();
    this.logs = [];
    this.closed = false;
    this.startedAt = Date.now();
    this.time = 0;

    const game = this.game = new DataModel();
    game.PlaceId = this.gameId;
    game.GameId = this.gameId;
    game.JobId = this.id;
    game.CreatorId = this.creatorId;
    game._isStudio = this.isTest;
    this._installHostHooks();
    loadPlace(game, opts.place, { keepIds: true });
    game.GetService('Players')._p.MaxPlayers = this.maxPlayers;

    this.rt = new LuaRuntime(game, {
      output: (level, text, script) => this.log(level, text, script),
      now: () => this.time,
    });
    installServices(game, this.rt, {
      dataStore: this.backend.dataStore || memoryStore(),
      awardBadge: (uid, name) => this.backend.awardBadge ? this.backend.awardBadge(uid, name) : false,
      hasBadge: (uid, name) => this.backend.hasBadge ? this.backend.hasBadge(uid, name) : false,
      bubble: (part, msg) => this.enqueue(['bubble', part.id, filterChat(msg)]),
    });
    setErrorReporter((e) => this.log('error', String(e && e.message || e)));

    game.on('added', (inst, root) => this._onAdded(inst, root));
    game.on('removing', (inst, root) => this._onRemoving(inst, root));
    game.on('changed', (inst, prop) => this._onChanged(inst, prop));

    this.pendingScripts = new Set();
    for (const d of game.GetDescendants()) if (d instanceof Script) this._maybeQueueScript(d);
    this.touching = new Map(); // key -> [a, b]
    this.grid = new SpatialGrid(16);
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    this.lastTick = performance.now();
    this.emptySince = Date.now();
    this.log('info', `Server ${this.id.slice(0, 8)} started for "${this.name}"`);
    // Scripts start before anyone can join, like on a real server.
    this._runPendingScripts();
    this.flush();
  }

  // ------------------------------------------------------------ logging
  log(level, text, script) {
    const entry = { level, text: String(text), time: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    for (const s of this.sessions.values()) {
      if (s.isDeveloper) this.send(s, { t: 'output', ...entry });
    }
    if (typeof process !== 'undefined' && process.env.ROBIS_LOG_SCRIPTS) console.log(`[game ${this.gameId}] [${level}] ${text}`);
  }

  // ------------------------------------------------------------ hooks for the engine
  _installHostHooks() {
    const game = this.game;
    game._loadCharacter = (player) => this.loadCharacter(player);
    game._kick = (player, msg) => {
      const s = this.sessions.get(player.UserId);
      if (s) this.kick(s, msg ? String(msg) : 'You have been kicked from the game');
    };
    game._breakJoints = (inst) => {
      const model = inst._isCharacter ? inst : inst.Parent;
      const hum = model && model.FindFirstChildOfClass && model.FindFirstChildOfClass('Humanoid');
      if (hum && model._isCharacter) hum.Health = 0;
    };
    game._hasForceField = (hum) => !!(hum.Parent && hum.Parent.FindFirstChildOfClass('ForceField'));
    game._moveCharacter = (model, pos) => {
      if (!model._isCharacter) return false;
      this.teleport(model, CFrame.fromPosition(pos.add(new Vector3(0, 3, 0))));
      return true;
    };
    game._getTouchingParts = (part) => {
      const out = [];
      for (const [a, b] of this.touching.values()) {
        if (a === part) out.push(b); else if (b === part) out.push(a);
      }
      return out;
    };
  }

  isReplicated(inst) {
    let top = inst;
    while (top._parent && top._parent !== this.game) top = top._parent;
    if (top._parent !== this.game) return false;
    return REPLICATED.has(top.ClassName);
  }

  _onAdded(inst, root) {
    if (inst instanceof Script) this._maybeQueueScript(inst);
    if (inst instanceof Explosion && inst.IsDescendantOf(this.game.Workspace)) this._explode(inst);
    // Only the root of an added subtree is sent; children are serialized with it at flush time.
    if (inst === root && inst._parent && this.isReplicated(inst)) this.enqueue(['add', inst._parent.id, null, inst]);
  }

  _onRemoving(inst, root) {
    if (inst instanceof Script) { this.rt.stopScript(inst); this.pendingScripts.delete(inst); }
    if (inst === root && this.isReplicated(inst)) this.enqueue(['rem', inst.id]);
  }

  _onChanged(inst, prop) {
    if (inst instanceof Script && prop === 'Disabled') {
      if (inst.Disabled) this.rt.stopScript(inst); else this._maybeQueueScript(inst);
    }
    if (inst._parent && inst._parent._isCharacter && prop === 'CFrame' && !this._posing
      && (inst.Name === 'HumanoidRootPart' || inst.Name === 'Torso')) {
      this.teleport(inst._parent, inst.CFrame);
      return;
    }
    if (!this.isReplicated(inst)) return;
    const d = inst.constructor.schema[prop];
    if (!d || d.noReplicate || d.derived) return;
    const key = inst.id + '\0' + prop;
    const v = encodeValue(d.type, inst._p[prop]);
    const idx = this.setIndex.get(key);
    if (idx !== undefined && this.queue[idx] && this.queue[idx][1] === inst.id) {
      this.queue[idx][3] = v;
    } else {
      this.setIndex.set(key, this.queue.length);
      this.queue.push(['set', inst.id, prop, v]);
    }
  }

  enqueue(op) { this.queue.push(op); }

  _runPendingScripts() {
    if (!this.pendingScripts.size) return;
    const list = [...this.pendingScripts];
    this.pendingScripts.clear();
    for (const s of list) if (!s._destroyed && s.getRoot() === this.game) this.rt.runScript(s);
  }

  _maybeQueueScript(s) {
    if (s.Disabled) return;
    let top = s;
    while (top._parent && top._parent !== this.game) top = top._parent;
    if (!RUNNABLE.has(top.ClassName)) return;
    this.pendingScripts.add(s);
  }

  // ------------------------------------------------------------ players
  get playerCount() { return this.sessions.size; }
  get isFull() { return this.sessions.size >= this.maxPlayers; }

  join(ws, user, avatar, opts = {}) {
    const old = this.sessions.get(user.id);
    if (old) this.kick(old, 'Same account launched game from different device.');
    const session = {
      ws, user, avatar, player: null, character: null,
      state: { p: [0, 10, 0], ry: 0, a: 'idle', v: [0, 0, 0] },
      isDeveloper: this.isTest || user.id === this.creatorId || !!opts.developer,
      respawnAt: 0,
      joinedAt: Date.now(),
    };
    this.sessions.set(user.id, session);
    this.emptySince = 0;

    const players = this.game.GetService('Players');
    const player = new CLASSES.Player();
    player.Name = user.username;
    player._p.UserId = user.id;
    player._p.DisplayName = user.username;
    session.player = player;
    player._parentLocked = false;

    // Send the world first so the client can build it while scripts react.
    this.flush();
    this.send(session, {
      t: 'welcome',
      userId: user.id,
      serverId: this.id,
      gameId: this.gameId,
      name: this.name,
      isTest: this.isTest,
      isDeveloper: session.isDeveloper,
      snapshot: this.snapshot(),
      players: [...this.sessions.values()].map((s) => this.playerInfo(s)),
      chars: [...this.sessions.values()].filter((s) => s.character).map((s) => [s.user.id, s.character.id]),
      logs: session.isDeveloper ? this.logs.slice(-200) : [],
    });
    this.broadcast({ t: 'playerJoined', player: this.playerInfo(session) }, session);
    player.Parent = players;
    players._fire('PlayerAdded', player);
    this.log('info', `${user.username} joined the game`);
    if (players.CharacterAutoLoads) this.loadCharacter(player);
    return session;
  }

  playerInfo(s) { return { userId: s.user.id, name: s.user.username, avatar: s.avatar, playerId: s.player && s.player.id }; }

  leave(session, reason = 'left') {
    if (!this.sessions.has(session.user.id) || this.sessions.get(session.user.id) !== session) return;
    const players = this.game.GetService('Players');
    const player = session.player;
    if (player) {
      players._fire('PlayerRemoving', player);
      this.removeCharacter(session);
      player._parentLocked = false;
      player.Destroy();
    }
    this.sessions.delete(session.user.id);
    this.broadcast({ t: 'playerLeft', userId: session.user.id });
    this.log('info', `${session.user.username} ${reason}`);
    if (!this.sessions.size) {
      this.emptySince = Date.now();
      if (this.isTest) this.close();
    }
  }

  // Chat commands for admins: :kick, :ban, :unban, :players.
  adminCommand(session, text) {
    const [cmd, name = '', ...rest] = text.slice(1).trim().split(/\s+/);
    const reason = rest.join(' ').slice(0, 200);
    const say = (msg) => this.send(session, { t: 'sys', text: msg });
    const c = cmd.toLowerCase();
    if (!['kick', 'ban', 'unban', 'players', 'cmds'].includes(c)) return false;
    if (c === 'cmds') { say(':kick name [reason] · :ban name [reason] · :unban name · :players'); return true; }
    if (c === 'players') { say([...this.sessions.values()].map((s) => s.user.username).join(', ')); return true; }
    const hooks = this.manager && this.manager.admin;
    const target = name && (hooks ? hooks.findUser(name) : [...this.sessions.values()].find((s) => s.user.username.toLowerCase() === name.toLowerCase())?.user);
    if (!target) { say(`No player named "${name}".`); return true; }
    if (target.id === session.user.id) { say('You can\'t do that to yourself.'); return true; }
    if (target.isAdmin && c !== 'unban') { say(`${target.username} is an admin.`); return true; }
    if (c === 'kick') {
      const s = this.sessions.get(target.id);
      if (!s) { say(`${target.username} is not in this server.`); return true; }
      this.kick(s, reason || `Kicked by ${session.user.username}`);
      say(`Kicked ${target.username}.`);
    } else if (!hooks) {
      say('Bans are not available here.');
    } else {
      hooks.ban(target, c === 'ban', reason);
      say(c === 'ban' ? `Banned ${target.username}.` : `Unbanned ${target.username}.`);
    }
    return true;
  }

  kick(session, msg) {
    this.send(session, { t: 'kick', msg });
    this.leave(session, 'was kicked');
    try { session.ws.close(); } catch { /* ignore */ }
  }

  findSpawn(player) {
    const rl = player.RespawnLocation;
    if (rl && rl instanceof SpawnLocation && rl.IsDescendantOf(this.game.Workspace)) return rl;
    const spawns = this.game.Workspace.GetDescendants().filter((d) => d instanceof SpawnLocation && d.Enabled);
    if (!spawns.length) return null;
    return spawns[Math.floor(Math.random() * spawns.length)];
  }

  loadCharacter(player) {
    const session = this.sessions.get(player.UserId);
    if (!session) return;
    this.removeCharacter(session);
    const spawn = this.findSpawn(player);
    let cf;
    if (spawn) {
      const top = spawn.CFrame.mul(new CFrame(0, spawn.Size.Y / 2, 0)).Position;
      const jx = (Math.random() - 0.5) * Math.max(0, spawn.Size.X - 2);
      const jz = (Math.random() - 0.5) * Math.max(0, spawn.Size.Z - 2);
      cf = rootCFrame(top.X + jx, top.Y + 3.05, top.Z + jz, spawn.Orientation.Y * Math.PI / 180);
    } else {
      cf = rootCFrame(0, 60, 0, 0);
    }
    const model = buildCharacter(player.Name, session.avatar.bodyColors, cf);
    const hum = model.FindFirstChildOfClass('Humanoid');
    hum._p.DisplayName = player.Name;
    hum.getSignal('Died').Connect(() => this._onDied(session, model));
    if (spawn && spawn.Duration > 0) {
      const ff = createInstance('ForceField');
      ff.Parent = model;
      setTimeout(() => { if (!ff._destroyed) ff.Destroy(); }, spawn.Duration * 1000);
    }
    session.character = model;
    session.state = { p: [cf.x, cf.y, cf.z], ry: 0, a: 'idle', v: [0, 0, 0] };
    session.respawnAt = 0;
    model.Parent = this.game.Workspace;
    player.Character = model;
    this.enqueue(['char', player.UserId, model.id, cf.toArray()]);
    player._fire('CharacterAdded', model);
  }

  removeCharacter(session) {
    const ch = session.character;
    if (!ch) return;
    session.player._fire('CharacterRemoving', ch);
    session.character = null;
    if (session.player.Character === ch) session.player.Character = null;
    for (const [k, [a, b]] of this.touching) {
      if ((a.Parent === ch) || (b.Parent === ch)) this.touching.delete(k);
    }
    if (!ch._destroyed) ch.Destroy();
  }

  _onDied(session, model) {
    if (session.character !== model) return;
    this.enqueue(['died', session.user.id]);
    const players = this.game.GetService('Players');
    if (players.CharacterAutoLoads) session.respawnAt = this.time + Math.max(0, players.RespawnTime);
  }

  teleport(model, cf) {
    const session = [...this.sessions.values()].find((s) => s.character === model);
    this._posing = true;
    poseCharacter(model, cf);
    this._posing = false;
    if (session) {
      session.state.p = [cf.x, cf.y, cf.z];
      this.send(session, { t: 'teleport', cf: cf.toArray() });
    }
  }

  // ------------------------------------------------------------ network input
  handle(session, msg) {
    switch (msg.t) {
      case 'move': {
        const ch = session.character;
        if (!ch || !Array.isArray(msg.p)) return;
        const hum = ch.FindFirstChildOfClass('Humanoid');
        const [x, y, z] = msg.p.map(Number);
        if (![x, y, z].every(Number.isFinite)) return;
        session.state = { p: [x, y, z], ry: +msg.ry || 0, a: String(msg.a || 'idle').slice(0, 16), v: msg.v || [0, 0, 0] };
        if (hum && hum.Health > 0) {
          this._posing = true;
          poseCharacter(ch, rootCFrame(x, y, z, session.state.ry));
          this._posing = false;
        }
        break;
      }
      case 'chat': {
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) return;
        if (text.startsWith('/e ')) {
          this.broadcast({ t: 'emote', userId: session.user.id, emote: text.slice(3).trim().toLowerCase() });
          return;
        }
        if (text[0] === ':' && session.user.isAdmin && this.adminCommand(session, text)) return;
        const clean = filterChat(text);
        this.broadcast({ t: 'chat', userId: session.user.id, name: session.user.username, text: clean });
        session.player._fire('Chatted', clean);
        break;
      }
      case 'click': {
        const part = this.game.getById(String(msg.id));
        if (!part || !(part instanceof BasePart)) return;
        const cd = part.FindFirstChildOfClass('ClickDetector') || (part.Parent && part.Parent.FindFirstChildOfClass && part.Parent.FindFirstChildOfClass('ClickDetector'));
        if (!cd) return;
        const [x, y, z] = session.state.p;
        const dist = part.Position.sub(new Vector3(x, y, z)).Magnitude;
        if (dist > cd.MaxActivationDistance + Math.max(part.Size.X, part.Size.Y, part.Size.Z)) return;
        cd._fire('MouseClick', session.player);
        break;
      }
      case 'reset': {
        const hum = session.character && session.character.FindFirstChildOfClass('Humanoid');
        if (hum) hum.Health = 0;
        break;
      }
      case 'exec': {
        if (!session.isDeveloper) return;
        this.log('info', '> ' + String(msg.src).slice(0, 200));
        this.rt.exec(String(msg.src || ''));
        break;
      }
      case 'ping':
        this.send(session, { t: 'pong', id: msg.id });
        break;
      default:
    }
  }

  // ------------------------------------------------------------ simulation
  tick() {
    if (this.closed) return;
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - this.lastTick) / 1000);
    this.lastTick = nowMs;
    this.time += dt;
    try {
      this._runPendingScripts();
      this.rt.step();
      this.game.GetService('RunService')._fire('Stepped', this.time, dt);
      this.game.GetService('TweenService').step(dt);
      this._physics(dt);
      this._touches();
      this._checkCharacters();
      this.game.GetService('RunService')._fire('Heartbeat', dt);
      if (Math.floor(this.time / 30) !== Math.floor((this.time - dt) / 30)) this.rt.collectInstances();
    } catch (e) {
      this.log('error', 'Internal: ' + (e && e.stack || e));
    }
    this.flush();
    if (!this.sessions.size && this.emptySince && Date.now() - this.emptySince > EMPTY_SHUTDOWN_MS) this.close();
  }

  _checkCharacters() {
    const fall = this.game.Workspace.FallenPartsDestroyHeight;
    for (const s of this.sessions.values()) {
      if (s.character) {
        const hum = s.character.FindFirstChildOfClass('Humanoid');
        if (hum && hum.Health > 0 && s.state.p[1] < fall) hum.Health = 0;
        if (!hum && !s.respawnAt) s.respawnAt = this.time + 5;
      }
      if (s.respawnAt && this.time >= s.respawnAt) {
        s.respawnAt = 0;
        this.loadCharacter(s.player);
      }
    }
  }

  _collectParts() {
    const parts = [];
    const walk = (i) => {
      for (const c of i._children) {
        if (c instanceof BasePart) parts.push(c);
        if (c._children.length) walk(c);
      }
    };
    walk(this.game.Workspace);
    return parts;
  }

  _physics(dt) {
    const g = this.game.Workspace.Gravity;
    const fall = this.game.Workspace.FallenPartsDestroyHeight;
    const parts = this._collectParts();
    const movers = [];
    for (const p of parts) {
      if (p._p.Anchored || (p._parent && p._parent._isCharacter)) continue;
      if (p._sleeping && p._p.Velocity.Magnitude === 0) continue;
      movers.push(p);
    }
    if (!movers.length) return;
    const solids = parts.filter((p) => p._p.CanCollide && !(p._parent && p._parent._isCharacter));
    const boxes = solids.map((p) => [p, partAABB(p)]);
    for (const p of movers) {
      let v = p._p.Velocity;
      const [mn, mx] = partAABB(p);
      // support check: find the highest top below us
      let support = -Infinity;
      for (const [q, [qa, qb]] of boxes) {
        if (q === p) continue;
        if (qa.X < mx.X - 0.05 && qb.X > mn.X + 0.05 && qa.Z < mx.Z - 0.05 && qb.Z > mn.Z + 0.05 && qb.Y <= mn.Y + 0.3) {
          if (qb.Y > support) support = qb.Y;
        }
      }
      const vy = v.Y - g * dt;
      let ny = mn.Y + vy * dt;
      let newVy = vy;
      if (ny <= support) { ny = support; newVy = 0; }
      let dx = v.X * dt, dz = v.Z * dt;
      // horizontal: stop if moving into something
      if (dx || dz) {
        const na = { minX: mn.X + dx, minY: ny + 0.05, minZ: mn.Z + dz, maxX: mx.X + dx, maxY: ny + (mx.Y - mn.Y), maxZ: mx.Z + dz };
        for (const [q, [qa, qb]] of boxes) {
          if (q === p) continue;
          if (aabbOverlap(na, { minX: qa.X, minY: qa.Y, minZ: qa.Z, maxX: qb.X, maxY: qb.Y, maxZ: qb.Z })) { dx = 0; dz = 0; break; }
        }
      }
      const friction = newVy === 0 ? Math.max(0, 1 - dt * 4) : 1;
      const nv = new Vector3(v.X * friction, newVy, v.Z * friction);
      const moved = Math.abs(ny - mn.Y) > 1e-4 || dx || dz;
      if (moved) {
        const cf = p._p.CFrame;
        p.CFrame = new CFrame(cf.x + dx, cf.y + (ny - mn.Y), cf.z + dz, cf.r);
      }
      const still = !moved && Math.abs(nv.X) < 0.05 && Math.abs(nv.Z) < 0.05 && nv.Y === 0;
      p._p.Velocity = still ? new Vector3() : nv;
      p._sleeping = still;
      if (p.Position.Y < fall) p.Destroy();
    }
  }

  _touches() {
    const parts = this._collectParts().filter((p) => p._p.CanTouch !== false);
    const grid = this.grid;
    grid.clear();
    const boxes = new Map();
    for (const p of parts) {
      const b = partBox(p);
      boxes.set(p, b);
      grid.insert(b, boxAABB(b));
    }
    const now = new Map();
    const check = (a, ab) => {
      const aa = boxAABB(ab);
      const cands = grid.query(aa.minX - 0.2, aa.minZ - 0.2, aa.maxX + 0.2, aa.maxZ + 0.2);
      for (const bb of cands) {
        const b = bb.part;
        if (b === a || (b._parent === a._parent && a._parent && a._parent._isCharacter)) continue;
        if (!aabbOverlap(aa, boxAABB(bb), 0.2)) continue;
        if (!boxesOverlap(ab, bb, 0.12)) continue;
        const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        if (!now.has(key)) now.set(key, a.id < b.id ? [a, b] : [b, a]);
      }
    };
    // Character limbs vs everything.
    for (const s of this.sessions.values()) {
      const ch = s.character;
      if (!ch) continue;
      const hum = ch.FindFirstChildOfClass('Humanoid');
      if (!hum || hum.Health <= 0) continue;
      for (const l of LIMBS) {
        if (l.name === 'HumanoidRootPart') continue;
        const limb = ch.FindFirstChild(l.name);
        if (limb) check(limb, boxes.get(limb) || partBox(limb));
      }
    }
    // Moving unanchored parts vs everything.
    for (const p of parts) {
      if (!p._p.Anchored && !p._sleeping && !(p._parent && p._parent._isCharacter)) check(p, boxes.get(p));
    }
    for (const [key, pair] of now) {
      if (this.touching.has(key)) continue;
      this.touching.set(key, pair);
      const [a, b] = pair;
      a._fire('Touched', b);
      b._fire('Touched', a);
      for (const [limb, other] of [[a, b], [b, a]]) {
        if (limb._parent && limb._parent._isCharacter) {
          const hum = limb._parent.FindFirstChildOfClass('Humanoid');
          if (hum) hum._fire('Touched', other, limb);
        }
      }
    }
    for (const [key, [a, b]] of this.touching) {
      if (now.has(key)) continue;
      this.touching.delete(key);
      if (!a._destroyed) a._fire('TouchEnded', b);
      if (!b._destroyed) b._fire('TouchEnded', a);
    }
  }

  _explode(ex) {
    const pos = ex.Position, r = ex.BlastRadius;
    setTimeout(() => {
      if (this.closed) return;
      for (const s of this.sessions.values()) {
        if (!s.character) continue;
        const [x, y, z] = s.state.p;
        const d = new Vector3(x, y, z).sub(pos).Magnitude;
        if (d <= r) {
          const hum = s.character.FindFirstChildOfClass('Humanoid');
          if (hum && !this.game._hasForceField(hum) && ex.DestroyJointRadiusPercent > 0) hum.Health = 0;
          ex._fire('Hit', s.character.FindFirstChild('Torso'), d);
          const push = new Vector3(x, y, z).sub(pos).Unit.mul(Math.min(120, ex.BlastPressure / 5000));
          this.send(s, { t: 'impulse', v: [push.X, Math.abs(push.Y) + 40, push.Z] });
        }
      }
      for (const p of this._collectParts()) {
        if (p._p.Anchored || (p._parent && p._parent._isCharacter)) continue;
        const dir = p.Position.sub(pos);
        const d = dir.Magnitude;
        if (d > r * 1.5) continue;
        ex._fire('Hit', p, d);
        const k = Math.min(100, ex.BlastPressure / 8000) * (1 - d / (r * 1.5));
        p._sleeping = false;
        p._p.Velocity = dir.Unit.mul(k).add(new Vector3(0, k, 0));
      }
      setTimeout(() => { if (!ex._destroyed) ex.Destroy(); }, 1500);
    }, 0);
  }

  // ------------------------------------------------------------ replication
  snapshot() {
    const out = [];
    for (const s of this.game._children) {
      if (!REPLICATED.has(s.ClassName)) continue;
      out.push(serialize(s, { replication: true }));
    }
    return out;
  }

  flush() {
    const ops = [];
    const sent = new Set();
    for (const op of this.queue) {
      if (op[0] === 'add') {
        const inst = op[3];
        if (sent.has(inst.id) || inst._destroyed || !inst._parent || !this.isReplicated(inst)) continue;
        sent.add(inst.id);
        for (const d of inst.GetDescendants()) sent.add(d.id);
        ops.push(['add', inst._parent.id, serialize(inst, { replication: true })]);
      } else ops.push(op);
    }
    this.queue = [];
    this.setIndex.clear();
    const states = [];
    for (const s of this.sessions.values()) {
      if (!s.character) continue;
      states.push([s.user.id, s.state.p.map((n) => Math.round(n * 100) / 100), Math.round(s.state.ry * 1000) / 1000, s.state.a]);
    }
    if (!ops.length && !states.length) return;
    for (const s of this.sessions.values()) {
      this.send(s, { t: 'tick', ops, st: states.filter((x) => x[0] !== s.user.id) });
    }
  }

  send(session, msg) {
    try {
      if (session.ws.readyState === 1) session.ws.send(JSON.stringify(msg));
    } catch { /* ignore */ }
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const s of this.sessions.values()) {
      if (s === except) continue;
      try { if (s.ws.readyState === 1) s.ws.send(data); } catch { /* ignore */ }
    }
  }

  info() {
    return {
      id: this.id,
      gameId: this.gameId,
      players: [...this.sessions.values()].map((s) => ({ userId: s.user.id, name: s.user.username })),
      maxPlayers: this.maxPlayers,
      startedAt: this.startedAt,
      isTest: this.isTest,
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    for (const s of [...this.sessions.values()]) {
      this.send(s, { t: 'shutdown', msg: 'This game has shut down' });
      try { s.ws.close(); } catch { /* ignore */ }
    }
    this.sessions.clear();
    this.rt.close();
    for (const h of this.game._timers || []) clearTimeout(h);
    this.onClose(this);
  }
}

function memoryStore() {
  const m = new Map();
  return {
    get: (store, key) => m.get(store + '\0' + key),
    set: (store, key, v) => { if (v === undefined) m.delete(store + '\0' + key); else m.set(store + '\0' + key, v); },
  };
}

export { Humanoid, ClickDetector, BaseScript };
