// One running game instance ("server" in the 2019 sense): owns a DataModel,
// runs its Scripts, simulates touches/physics and replicates to clients.
import crypto from 'node:crypto';
import { CFrame, Vector3, Color3 } from '../../shared/engine/types.js';
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
import { findHuntSpot } from './huntspot.js';
import { RUNE_TIME } from '../huntquests.js';

const TICK_HZ = 30;
const REPLICATED = new Set(['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'StarterGui', 'Teams']);
// Scripts run in these services (Players: scripts in Tools in a Backpack, like Roblox).
const RUNNABLE = new Set(['Workspace', 'ServerScriptService', 'Players']);
const EMPTY_SHUTDOWN_MS = 60_000;

export class GameServer {
  constructor(opts) {
    this.id = crypto.randomUUID();
    this.gameId = opts.gameId || 0;
    this.name = opts.name || 'Place';
    this.creatorId = opts.creatorId || 0;
    this.maxPlayers = opts.maxPlayers || 12;
    this.isTest = !!opts.test;
    this.privateId = opts.privateId || 0; // a private server (see manager.serverForPrivate)
    this.subPlace = opts.subPlace || 0; // a place of the game other than its start place
    this.placeName = opts.placeName || '';
    this.reserved = !!opts.reserved; // made for one group (TeleportPartyAsync)
    this.huntPreview = !!opts.huntPreview; // a tester's server while The Hunt is a private preview
    this.privateName = opts.privateName || '';
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
    game.PlaceId = this.subPlace || this.gameId;
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
      awardBadge: (uid, name) => { this._questBadge(uid, name); return this.backend.awardBadge ? this.backend.awardBadge(uid, name) : false; },
      questDone: (uid) => this._questScript(uid),
      hasBadge: (uid, name) => this.backend.hasBadge ? this.backend.hasBadge(uid, name) : false,
      passes: this.backend.passes || null,
      hunt: this.backend.hunt || null,
      teleport: (players, placeId, together) => this.teleportToPlace(players, placeId, together),
      placeId: (name) => (this.manager && this.manager.places ? this.manager.places.byName(this.gameId, name) : 0),
      promptPass: (player, passId) => this.promptPass(player, passId),
      bubble: (part, msg) => this.enqueue(['bubble', part.id, filterChat(msg)]),
    });
    setErrorReporter((e) => this.log('error', String(e && e.message || e)));

    game.on('added', (inst, root) => this._onAdded(inst, root));
    game.on('removing', (inst, root) => this._onRemoving(inst, root));
    game.on('changed', (inst, prop) => this._onChanged(inst, prop));

    this.pendingScripts = new Set();
    this.maybeStop = new Set();
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
    game._sit = (seat, hum) => {
      const s = [...this.sessions.values()].find((x) => x.character && x.character === hum.Parent);
      if (!s || seat.ClassName !== 'VehicleSeat') return false;
      this.enterVehicle(s, seat, { scripted: true });
      return !!(s.vehicle && s.vehicle.seat === seat);
    };
    game._moveCharacter = (model, pos) => {
      if (!model._isCharacter) return false;
      this.teleport(model, CFrame.fromPosition(pos.add(new Vector3(0, 3, 0))));
      return true;
    };
    game._groupRank = (player, gid) => (this.manager && this.manager.groupRank ? this.manager.groupRank(player._p.UserId, gid) : 0);
    game._groupRole = (player, gid) => (this.manager && this.manager.groupRole ? this.manager.groupRole(player._p.UserId, gid) : 'Guest');
    game._notify = (player, text) => {
      const s = this.sessions.get(player._p.UserId);
      if (s) this.send(s, { t: 'sys', text: text.slice(0, 300) });
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
    if (inst instanceof Script) {
      if (this.maybeStop.has(inst) && this._runnable(inst)) this.maybeStop.delete(inst);
      else this._maybeQueueScript(inst);
    }
    if (inst instanceof Explosion && inst.IsDescendantOf(this.game.Workspace)) this._explode(inst);
    // Only the root of an added subtree is sent; children are serialized with it at flush time.
    if (inst === root && inst._parent && this.isReplicated(inst)) this.enqueue(['add', inst._parent.id, null, inst]);
  }

  _onRemoving(inst, root) {
    // A script being moved (a Tool going from the Backpack to the hand) keeps
    // running; it's only stopped at the end of the tick if it really left.
    if (inst instanceof Script) { this.maybeStop.add(inst); this.pendingScripts.delete(inst); }
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
    // A script setting the character's Velocity (jump pads, launchers) pushes the player.
    if (prop === 'Velocity' && inst._parent && inst._parent._isCharacter && inst.Name === 'HumanoidRootPart') {
      const session = [...this.sessions.values()].find((s) => s.character === inst._parent);
      const v = inst._p.Velocity;
      if (session && v.Magnitude > 0) this.send(session, { t: 'impulse', v: [v.X, v.Y, v.Z], set: true });
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

  _runnable(s) {
    let top = s;
    while (top._parent && top._parent !== this.game) top = top._parent;
    return top._parent === this.game && RUNNABLE.has(top.ClassName);
  }

  _maybeQueueScript(s) {
    if (s.Disabled) return;
    if (!this._runnable(s)) return;
    this.pendingScripts.add(s);
  }

  _stopMovedScripts() {
    if (!this.maybeStop.size) return;
    for (const s of this.maybeStop) if (s._destroyed || !this._runnable(s)) this.rt.stopScript(s);
    this.maybeStop.clear();
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
      // Game owners and Robis admins can use the F9 console (server Lua) everywhere.
      isDeveloper: this.isTest || user.id === this.creatorId || !!user.isAdmin || !!opts.developer,
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
    const backpack = new CLASSES.Backpack();
    backpack.Name = 'Backpack';
    backpack.Parent = player;

    // Send the world first so the client can build it while scripts react.
    this.flush();
    this.send(session, {
      t: 'welcome',
      userId: user.id,
      serverId: this.id,
      gameId: this.gameId,
      name: this.name,
      isTest: this.isTest,
      privateName: this.privateName || undefined,
      isDeveloper: session.isDeveloper,
      snapshot: this.snapshot(),
      players: [...this.sessions.values()].map((s) => this.playerInfo(s)),
      chars: [...this.sessions.values()].filter((s) => s.character).map((s) => [s.user.id, s.character.id]),
      logs: session.isDeveloper ? this.logs.slice(-200) : [],
    });
    this.broadcast({ t: 'playerJoined', player: this.playerInfo(session) }, session);
    // Auto-assign to the smallest AutoAssignable team, like Roblox.
    const teams = this.game.GetService('Teams').GetTeams().filter((t) => t._p.AutoAssignable);
    if (teams.length) {
      const count = (t) => players.GetPlayers().filter((p) => p._p.Team === t).length;
      const team = teams.slice().sort((a, b) => count(a) - count(b))[0];
      player._p.Team = team;
      player._p.TeamColor = team._p.TeamColor;
      player._p.Neutral = false;
    }
    player.Parent = players;
    players._fire('PlayerAdded', player);
    this.log('info', `${user.username} joined the game`);
    if (players.CharacterAutoLoads) this.loadCharacter(player);
    this._huntJoin(session);
    return session;
  }

  // ------------------------------------------------------------ The Hunt
  // While a game is in The Hunt event, a golden token is hidden in it for the
  // players taking part (only admins while the event is private).
  _huntJoin(session) {
    const h = this.backend.hunt;
    if (!h || this.isTest || !h.eligible(session.user.id)) return;
    // a private preview only runs on the testers' own servers
    if (h.isPublic && !h.isPublic() && !this.huntPreview) return;
    if (h.kind && h.kind() === 'quests') { this._questJoin(session); return; }
    if (this.subPlace || !h.inEvent()) return;
    this._huntEnsure();
    const p = h.progress(session.user.id);
    const found = p && p.games.some((g) => g.id === this.gameId && g.found);
    session.huntFound = !!found;
    session.huntLevel = 0;
    if (!this.huntScan) this.huntScan = setInterval(() => { try { this._huntScanTick(); } catch (e) { this.log('warn', 'The Hunt: ' + e.message); } }, 1200);
    setTimeout(() => {
      if (!this.sessions.has(session.user.id)) return;
      this.send(session, { t: 'sys', text: found
        ? `The Hunt: you already found the shard in this game (${p.count}/${p.total}).`
        : 'The Hunt: a dimension shard is hidden somewhere in this game. Follow your scanner!' });
    }, 1500);
  }

  // The scanner: players still looking get the shard's signal strength (1-5).
  // The first time someone gets close, the shard may jump to another spot once.
  _huntScanTick() {
    const t = this.huntToken;
    const hunting = [...this.sessions.values()].filter((s) => s.huntFound === false);
    if (!hunting.length) return;
    if (!t || t._destroyed) { for (const s of hunting) if (s.huntLevel !== 0) { s.huntLevel = 0; this.send(s, { t: 'huntSignal', level: 0 }); } return; }
    const pos = t.Position;
    for (const s of hunting) {
      const [x, y, z] = s.state.p;
      const d = Math.hypot(x - pos.X, y - pos.Y, z - pos.Z);
      if (d < 9 && !this.huntBlinked && this._huntPlace) {
        this.huntBlinked = true;
        if (Math.random() < 0.5) {
          (t.Parent || t).Destroy();
          this.huntToken = null;
          if (this._huntPlace(25) || this._huntPlace(0)) {
            for (const o of hunting) this.send(o, { t: 'sys', text: 'The Hunt: the shard slipped into another dimension... follow the signal!' });
            return;
          }
        }
      }
      const level = d < 15 ? 5 : d < 40 ? 4 : d < 80 ? 3 : d < 150 ? 2 : 1;
      if (level !== s.huntLevel) { s.huntLevel = level; this.send(s, { t: 'huntSignal', level }); }
    }
  }

  _huntCleanup() {
    const h = this.backend.hunt;
    if ([...this.sessions.values()].some((s) => h && h.eligible(s.user.id))) return;
    clearInterval(this.huntTimer);
    this.huntTimer = null;
    clearInterval(this.huntScan);
    this.huntScan = null;
    clearInterval(this.questTimer);
    this.questTimer = null;
    if (this.runes) { for (const r of this.runes) if (!r._destroyed) (r.Parent || r).Destroy(); this.runes = null; }
    if (!this.huntToken || this.huntToken._destroyed) return;
    (this.huntToken.Parent || this.huntToken).Destroy();
    this.huntToken = null;
  }

  // Keeps a token in the game: games that build their map while running (DOORS
  // rooms, Natural Disaster maps, the random Tower) get it once there's a spot
  // far from the spawn, and it moves if the platform under it goes away.
  _huntEnsure() {
    const place = (minDist, ground = false) => {
      let pos = null;
      try { pos = findHuntSpot(this.game.Workspace, Math.random, { minDist, ground }); } catch (e) { this.log('warn', 'The Hunt: ' + e.message); }
      if (pos) this.huntToken = this._spawnHuntToken(pos);
      return !!pos;
    };
    this._huntPlace = place;
    const tick = () => {
      if (this.closed) return;
      try { step(); } catch (e) { this.log('warn', 'The Hunt: ' + e.message); }
    };
    const step = () => {
      const t = this.huntToken;
      if (t && !t._destroyed) {
        if (this._huntSupported(t.Position)) return;
        (t.Parent || t).Destroy(); // its platform is gone
        this.huntToken = null;
      }
      this.huntTries = (this.huntTries || 0) + 1;
      // far from the spawn (small maps: a bit less); after ~2 minutes without
      // such a spot, take the farthest one there is
      if (place(45) || place(25)) return;
      // nothing to stand on but the ground (an empty map): the ground it is
      if (findHuntSpot(this.game.Workspace, Math.random, { minDist: 0 }) === null && place(0, true)) return;
      if (this.huntTries > 8) place(0);
    };
    if (!this.huntToken || this.huntToken._destroyed) tick();
    if (!this.huntTimer) this.huntTimer = setInterval(tick, 15000);
  }

  _huntSupported(pos) {
    return this.game.Workspace.GetDescendants().some((p) => {
      if (!(p instanceof BasePart) || !p._p.CanCollide || p === this.huntToken) return false;
      const [a, b] = partAABB(p);
      return pos.X > a.X - 0.5 && pos.X < b.X + 0.5 && pos.Z > a.Z - 0.5 && pos.Z < b.Z + 0.5 && b.Y <= pos.Y && b.Y > pos.Y - 4;
    });
  }

  // The shard itself (a purple crystal), at a spot from huntspot.js.
  _spawnHuntToken(pos) {
    const folder = createInstance('Folder');
    folder.Name = 'TheHunt';
    const t = createInstance('Part');
    t.Name = 'HuntToken';
    t.Size = new Vector3(1.2, 1.2, 1.2);
    t.Material = 'Neon';
    t.Color = Color3.fromHex('#b45cff');
    t.Anchored = true;
    t.CanCollide = false;
    const cf = CFrame.fromOrientation(45, 0, 45);
    cf.x = pos.X; cf.y = pos.Y + 0.3; cf.z = pos.Z;
    t.CFrame = cf;
    t.Parent = folder;
    // a faint glow only - no label to give it away
    const light = createInstance('PointLight');
    light.Color = Color3.fromHex('#b45cff');
    light.Range = 6;
    light.Brightness = 0.6;
    light.Parent = t;
    folder.Parent = this.game.Workspace;
    return t;
  }

  // ------------------------------------------------------------ The Hunt: quests
  // Quest events give every game its own quest (server/huntquests.js). Most are
  // checked here from what happens in the game: leaderstats, badges, buttons,
  // places you reach, rune stones; or the game's scripts call
  // HuntService:CompleteQuest(player).
  _questJoin(session) {
    const h = this.backend.hunt;
    if (!h.inEvent() || (h.isHub && h.isHub())) return;
    const def = h.quest && h.quest();
    if (!def) return;
    const p = h.progress(session.user.id);
    const done = !!(p && p.games.some((g) => g.id === this.gameId && g.found));
    session.quest = { def, done, readyAt: Date.now() + 4000, last: {}, gained: 0, best: 0, visited: new Set(), clicked: new Set(), rune: 0, runeStart: 0, hudAt: 0 };
    if (def.type === 'runes' && !done) this._runesEnsure();
    if (!this.questTimer) this.questTimer = setInterval(() => { try { this._questTick(); } catch (e) { this.log('warn', 'The Hunt: ' + e.message); } }, 1000);
    setTimeout(() => {
      if (this.sessions.get(session.user.id) !== session) return;
      this._questHud(session, true);
      this.send(session, { t: 'sys', text: done
        ? `The Hunt: you already have the relic of this game (${p.count}/${p.total}).`
        : `The Hunt quest: ${def.text}` });
    }, 1500);
  }

  _questStatValue(session, name) {
    const ls = session.player && session.player.FindFirstChild('leaderstats');
    const v = ls && ls.FindFirstChild(name);
    if (!v) return null;
    const n = parseFloat(v.Value);
    return Number.isFinite(n) ? n : null;
  }

  // What the quest panel shows: the quest and how far along you are.
  _questHud(session, force = false) {
    const q = session.quest;
    if (!q) return;
    const now = Date.now();
    if (!force && now - q.hudAt < 700) { q.hudDirty = true; return; }
    q.hudAt = now;
    q.hudDirty = false;
    const d = q.def;
    let progress = '', left = 0;
    if (!q.done) {
      if (d.type === 'stat') progress = `${Math.min(d.target, Math.floor(this._questStatValue(session, d.stat) || 0))} / ${d.target} ${d.stat}`;
      else if (d.type === 'gain') progress = `${Math.min(d.target, q.gained)} / ${d.target}`;
      else if (d.type === 'below') progress = q.best ? `Best this visit: ${q.best}s (need ${d.target}s or less)` : `Need ${d.target}s or less`;
      else if (d.type === 'badge' && d.stat) { const v = this._questStatValue(session, d.stat); if (v !== null) progress = `${d.stat}: ${v}`; }
      else if (d.type === 'click') progress = `${q.clicked.size} / ${this._questButtons().length} buttons`;
      else if (d.type === 'visit') progress = (d.names || d.parts).map((n, i) => (q.visited.has(d.parts[i]) ? '✓ ' : '• ') + n).join('   ');
      else if (d.type === 'runes') {
        progress = `Runes lit: ${q.rune} / 3`;
        if (q.rune > 0) left = Math.max(0, Math.ceil((q.runeStart + RUNE_TIME * 1000 - now) / 1000));
      }
    }
    this.send(session, { t: 'huntQuest', text: d.text, progress, left, done: q.done });
  }

  _questComplete(session) {
    const q = session.quest;
    if (!q || q.done) return;
    q.done = true;
    const h = this.backend.hunt;
    const r = h && h.collect(session.user.id);
    this._questHud(session, true);
    if (!r || !r.new) return;
    this.send(session, { t: 'hunt', kind: 'quests', count: r.count, total: r.total, reward: r.reward || null, robits: r.robits || 0 });
    this.log('info', `${session.user.username} completed The Hunt quest (${r.count}/${r.total})`);
  }

  // Leaderstat quests: checked every second from the player's leaderstats.
  // Counting starts from the value when the quest starts (after the first
  // seconds, while saved stats load), so the first win counts too.
  _questStatTick(session) {
    const q = session.quest;
    const d = q.def;
    if (!d.stat || q.done) return;
    const v = this._questStatValue(session, d.stat);
    if (v === null) return;
    const now = Date.now();
    if (now < q.readyAt) { q.last[d.stat] = v; return; }
    const prev = q.last[d.stat];
    q.last[d.stat] = v;
    if (prev === undefined) {
      // the stat appeared after the start: it began at 0
      if (d.type === 'gain' && v > 0) q.gained += v;
    } else if (v !== prev) {
      if (d.type === 'gain' && v > prev) q.gained += v - prev;
      if (d.type === 'below' && v > 0 && (!q.best || v < q.best)) q.best = v;
    } else if (d.type !== 'stat') {
      return;
    }
    if ((d.type === 'stat' && v >= d.target) || (d.type === 'gain' && q.gained >= d.target) || (d.type === 'below' && q.best && q.best <= d.target)) {
      this._questComplete(session);
      return;
    }
    if (prev !== v) this._questHud(session);
  }

  _questBadge(uid, name) {
    const session = this.sessions.get(uid);
    const q = session && session.quest;
    if (q && !q.done && q.def.type === 'badge' && q.def.badge === name) this._questComplete(session);
  }

  // The game's own scripts: HuntService:CompleteQuest(player)
  _questScript(uid) {
    const session = this.sessions.get(uid);
    const q = session && session.quest;
    if (!q || q.done || q.def.type !== 'script') return false;
    this._questComplete(session);
    return true;
  }

  _questButtons() {
    const d = [...this.sessions.values()].map((s) => s.quest && s.quest.def).find((x) => x && x.type === 'click');
    const model = d && this.game.Workspace.FindFirstChild(d.model);
    if (!model) return [];
    return model.GetDescendants().filter((p) => p instanceof BasePart && (p.FindFirstChildOfClass('ClickDetector') || (p.Parent && p.Parent !== model && p.Parent.FindFirstChildOfClass && p.Parent.FindFirstChildOfClass('ClickDetector'))));
  }

  _questClick(session, part) {
    const q = session.quest;
    if (!q || q.done || q.def.type !== 'click') return;
    const buttons = this._questButtons();
    if (!buttons.includes(part)) return;
    q.clicked.add(part.id);
    if (buttons.every((b) => q.clicked.has(b.id))) return this._questComplete(session);
    this._questHud(session, true);
  }

  // Every second: places reached, the rune timer, late panel updates.
  _questTick() {
    const now = Date.now();
    let parts = null;
    for (const s of this.sessions.values()) {
      const q = s.quest;
      if (!q) continue;
      if (q.hudDirty) this._questHud(s);
      if (q.done) continue;
      const d = q.def;
      if (d.stat) { this._questStatTick(s); if (q.done) continue; }
      if (d.type === 'visit' && s.character) {
        if (!parts) parts = this.game.Workspace.GetDescendants().filter((p) => p instanceof BasePart);
        const [x, y, z] = s.state.p;
        let changed = false;
        for (const name of d.parts) {
          if (q.visited.has(name)) continue;
          const near = parts.some((p) => {
            if (p.Name !== name) return false;
            const [a, b] = partAABB(p);
            const dx = Math.max(a.X - x, 0, x - b.X), dy = Math.max(a.Y - y, 0, y - b.Y), dz = Math.max(a.Z - z, 0, z - b.Z);
            return Math.hypot(dx, dy, dz) < 4.5;
          });
          if (near) { q.visited.add(name); changed = true; }
        }
        if (changed) {
          if (q.visited.size >= d.parts.length) { this._questComplete(s); continue; }
          this._questHud(s, true);
        }
      }
      if (d.type === 'runes' && q.rune > 0 && now - q.runeStart > RUNE_TIME * 1000) {
        q.rune = 0;
        this.send(s, { t: 'sys', text: 'The Hunt: too slow! The runes went dark. Start again from rune I.' });
        this._questHud(s, true);
      }
    }
    if (this.runes) this._runesEnsure();
  }

  // Three rune stones, far from the spawn and from each other. They move if
  // what they stand on goes away (maps built while the game runs).
  _runesEnsure() {
    const ok = (r) => r && !r._destroyed && this._huntSupported(r.Position.sub(new Vector3(0, 1.8, 0)));
    if (this.runes && this.runes.every(ok)) return;
    if (this.runesAt && Date.now() - this.runesAt < 15000 && this.runes) return;
    this.runesAt = Date.now();
    const keep = (this.runes || []).map((r) => (ok(r) ? r : (r && !r._destroyed && (r.Parent || r).Destroy(), null)));
    let folder = this.game.Workspace.FindFirstChild('HuntRunes');
    if (!folder) { folder = createInstance('Folder'); folder.Name = 'HuntRunes'; folder.Parent = this.game.Workspace; }
    const taken = keep.filter(Boolean).map((r) => r.Position);
    const ROMAN = ['I', 'II', 'III'];
    for (let i = 0; i < 3; i++) {
      if (keep[i]) continue;
      let pos = null;
      for (const [minDist, apart] of [[45, 40], [30, 25], [20, 12], [0, 0]]) {
        for (let k = 0; k < 12 && !pos; k++) {
          let p = null;
          try { p = findHuntSpot(this.game.Workspace, Math.random, { minDist }); } catch { p = null; }
          if (p && taken.every((t) => t.sub(p).Magnitude >= apart)) pos = p;
        }
        if (pos) break;
      }
      if (!pos) { try { pos = findHuntSpot(this.game.Workspace, Math.random, { minDist: 0, ground: true }); } catch { pos = null; } }
      if (!pos) continue;
      const r = createInstance('Part');
      r.Name = 'Rune';
      r.Size = new Vector3(2.4, 3.6, 1);
      r.Material = 'Neon';
      r.Color = Color3.fromHex('#5bd6a0');
      r.Anchored = true;
      r.CanCollide = false;
      r.CFrame = CFrame.fromPosition(new Vector3(pos.X, pos.Y + 1.8, pos.Z));
      const label = createInstance('BillboardText');
      label.Text = ROMAN[i];
      label.StudsOffset = new Vector3(0, 3, 0);
      label.Parent = r;
      const glow = createInstance('PointLight');
      glow.Color = Color3.fromHex('#5bd6a0');
      glow.Range = 10;
      glow.Brightness = 0.8;
      glow.Parent = r;
      r.Parent = folder;
      keep[i] = r;
      taken.push(r.Position);
    }
    this.runes = keep;
  }

  _runeTouched(session, idx) {
    const q = session.quest;
    if (!q || q.done || q.def.type !== 'runes') return;
    const ROMAN = ['I', 'II', 'III'];
    if (idx < q.rune) return;
    if (idx > q.rune) {
      if (Date.now() - (q.warnAt || 0) > 3000) { q.warnAt = Date.now(); this.send(session, { t: 'sys', text: `The Hunt: this rune is still dark... light rune ${ROMAN[q.rune]} first.` }); }
      return;
    }
    q.rune++;
    if (q.rune === 1) q.runeStart = Date.now();
    if (q.rune >= 3) return this._questComplete(session);
    this.send(session, { t: 'sys', text: `The Hunt: rune ${ROMAN[idx]} is glowing! Find rune ${ROMAN[q.rune]}.` });
    this._questHud(session, true);
  }

  _huntTouched(session) {
    const h = this.backend.hunt;
    if (!h || !h.eligible(session.user.id)) return;
    const r = h.collect(session.user.id);
    if (!r || !r.new) return;
    session.huntFound = true;
    this.send(session, { t: 'huntSignal', level: -1 });
    this.send(session, { t: 'hunt', count: r.count, total: r.total, reward: r.reward || null, robits: r.robits || 0 });
    this.log('info', `${session.user.username} found The Hunt shard (${r.count}/${r.total})`);
  }

  // TeleportService: the players' clients move to another place (of this game
  // or another one). together: all of them into one fresh server.
  teleportToPlace(players, placeId, together = false) {
    const sessions = players.map((p) => p && this.sessions.get(p._p ? p._p.UserId : p.UserId)).filter(Boolean);
    if (!sessions.length) return;
    if (this.isTest) {
      for (const s of sessions) this.send(s, { t: 'sys', text: `Teleport to place ${placeId} (only works in a published game).` });
      return;
    }
    const where = this.manager && this.manager.places ? this.manager.places.resolve(placeId) : { gameId: placeId, place: 0 };
    if (!where) { this.log('error', `TeleportService: there is no place ${placeId}`); return; }
    let serverId;
    if (together) {
      try { serverId = this.manager.reserve(where.gameId, where.place, { huntPreview: !!this.huntPreview }); } catch (e) { this.log('error', 'TeleportService: ' + e.message); return; }
    }
    for (const s of sessions) this.send(s, { t: 'teleportPlace', placeId: where.gameId, place: where.place || undefined, serverId });
  }

  playerInfo(s) {
    const flags = Object.keys(s.user.flags || {}).filter((f) => s.user.flags[f]);
    return { userId: s.user.id, name: s.user.username, avatar: s.avatar, playerId: s.player && s.player.id, flags };
  }

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
    this._huntCleanup();
    this.broadcast({ t: 'playerLeft', userId: session.user.id });
    this.log('info', `${session.user.username} ${reason}`);
    if (!this.sessions.size) {
      this.emptySince = Date.now();
      if (this.isTest) this.close();
    }
  }

  // Chat commands. Admins can use all of them; the game's creator can use
  // the fun ones and :kick in their own game.
  adminCommand(session, text) {
    const parts = text.slice(1).trim().split(/\s+/);
    const c = (parts.shift() || '').toLowerCase();
    const say = (msg) => this.send(session, { t: 'sys', text: msg });
    const hooks0 = this.manager && this.manager.admin;
    const isAdmin = !!session.user.isAdmin;
    const isMod = isAdmin || !!(hooks0 && hooks0.can && hooks0.can(session.user, 'moderator'));
    const isOwner = isAdmin || session.user.id === this.creatorId;
    const FUN = ['kill', 'respawn', 'heal', 'god', 'ungod', 'fly', 'unfly', 'speed', 'jump', 'tp', 'bring', 'to', 'freeze', 'thaw', 'explode',
      'fire', 'sparkles', 'ff', 'unff', 'invisible', 'visible', 'clean', 'announce', 'hint', 'time'];
    const MODERATE = ['mute', 'unmute', 'kick'];
    const MOD = ['ban', 'hardban', 'unban'];
    const INFO = ['players', 'cmds'];
    if (![...FUN, ...MODERATE, ...MOD, ...INFO].includes(c)) return false;
    // Admins: everything. Moderators: kick/mute/ban. Game owners: fun commands and kick/mute in their game.
    // a moderator's fine settings (Admin Panel -> Permissions)
    const modOpt = (key) => isAdmin || !!(hooks0 && hooks0.opt ? hooks0.opt(session.user, 'moderator', key) : true);
    const modMay = { kick: modOpt('kick'), mute: modOpt('mute'), unmute: modOpt('mute'), ban: modOpt('ban'), unban: modOpt('ban'), hardban: modOpt('ban') && modOpt('deviceBan') };
    const allowed = isAdmin || (INFO.includes(c) && (isMod || isOwner)) || (FUN.includes(c) && isOwner)
      || (MODERATE.includes(c) && (isOwner || (isMod && modMay[c]))) || (MOD.includes(c) && isMod && modMay[c]);
    if (!allowed) {
      if (isMod && (MODERATE.includes(c) || MOD.includes(c))) { say('Your rights don\'t include this.'); return true; }
      return false;
    }
    if (c === 'cmds') {
      say(':kill :respawn :heal :god :ungod :fly :unfly :speed n :jump n :freeze :thaw :explode :fire :sparkles :ff :unff :invisible :visible :clean :tp a b :bring :to :mute :unmute :kick · :announce text · :hint text · :time 0-24 · :players'
        + (isMod ? ' · :ban name [1h|1d|7d|30d] reason · :hardban (also device) · :unban name' : '')
        + '  —  targets: name, me, all, others');
      return true;
    }
    if (c === 'players') { say([...this.sessions.values()].map((s) => s.user.username).join(', ')); return true; }
    if (c === 'announce' || c === 'hint') {
      const m = new CLASSES[c === 'announce' ? 'Message' : 'Hint']();
      m.Text = `${session.user.username}: ${parts.join(' ').slice(0, 150)}`;
      m.Parent = this.game.Workspace;
      setTimeout(() => { if (!m._destroyed) m.Destroy(); }, c === 'announce' ? 5000 : 8000);
      return true;
    }
    if (c === 'time') {
      const t = +parts[0];
      if (!Number.isFinite(t)) { say('Usage: :time 0-24'); return true; }
      this.game.GetService('Lighting').ClockTime = ((t % 24) + 24) % 24;
      return true;
    }
    const hooks = this.manager && this.manager.admin;
    if (MOD.includes(c)) {
      const target = parts[0] && (hooks ? hooks.findUser(parts[0]) : null);
      if (!hooks) { say('Bans are not available here.'); return true; }
      if (!target) { say(`No player named "${parts[0] || ''}".`); return true; }
      if (target.id === session.user.id) { say('You can\'t do that to yourself.'); return true; }
      if (target.isAdmin) { say(`${target.username} is an admin.`); return true; }
      if (!isAdmin && hooks.can && (hooks.can(target, 'moderator') || hooks.can(target, 'economy'))) { say('Only admins can ban other staff.'); return true; }
      if (c === 'unban') { hooks.ban(target, false); say(`Unbanned ${target.username}.`); return true; }
      const dur = hooks.banTimes[parts[1]] ? parts[1] : '';
      if (!isAdmin && hooks.opt && hooks.banSteps) {
        const max = hooks.opt(session.user, 'moderator', 'maxBan');
        if (hooks.banSteps.indexOf(dur || 'forever') > hooks.banSteps.indexOf(max)) { say(`Your longest ban is ${max}.`); return true; }
      }
      const reason = parts.slice(dur ? 2 : 1).join(' ').slice(0, 200);
      hooks.ban(target, true, reason, { device: c === 'hardban', ms: hooks.banTimes[dur] || 0 });
      say(`Banned ${target.username}${dur ? ' for ' + dur : ''}${c === 'hardban' ? ' (account + device)' : ''}.`);
      return true;
    }
    // Everything else acts on players in this server.
    const all = [...this.sessions.values()];
    const pick = (word) => {
      const w = String(word || 'me').toLowerCase();
      if (w === 'me') return [session];
      if (w === 'all') return all;
      if (w === 'others') return all.filter((s) => s !== session);
      const exact = all.filter((s) => s.user.username.toLowerCase() === w);
      return exact.length ? exact : all.filter((s) => s.user.username.toLowerCase().startsWith(w));
    };
    const targets = pick(parts[0]);
    if (!targets.length) { say(`No player named "${parts[0]}".`); return true; }
    const hum = (s) => s.character && s.character.FindFirstChildOfClass('Humanoid');
    const torso = (s) => s.character && s.character.FindFirstChild('Torso');
    const add = (s, cls) => { const t = torso(s); if (t) { const e = new CLASSES[cls](); e.Parent = t; } };
    const num = (v, lo, hi, def) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
    for (const s of targets) {
      const h = hum(s);
      switch (c) {
        case 'kill': if (h) { h._god = false; h.Health = 0; } break;
        case 'respawn': this.loadCharacter(s.player); break;
        case 'heal': if (h) h.Health = h.MaxHealth; break;
        case 'god': if (h) { h._god = true; h.Health = h.MaxHealth; } break;
        case 'ungod': if (h) h._god = false; break;
        case 'fly': if (h) { h.Flying = true; this.send(s, { t: 'sys', text: 'You can fly! Space / Jump: up, Q / ▼: down.' }); } break;
        case 'unfly': if (h) h.Flying = false; break;
        case 'speed': if (h) h.WalkSpeed = num(parts[1], 0, 200, 50); break;
        case 'jump': if (h) h.JumpPower = num(parts[1], 0, 300, 120); break;
        case 'freeze': if (h) { h.WalkSpeed = 0; h.JumpPower = 0; } break;
        case 'thaw': if (h) { h.WalkSpeed = 16; h.JumpPower = 50; } break;
        case 'explode': {
          const t = torso(s);
          if (t) { const e = new CLASSES.Explosion(); e.Position = t.Position; e.BlastRadius = 6; e.Parent = this.game.Workspace; }
          break;
        }
        case 'fire': add(s, 'Fire'); break;
        case 'sparkles': add(s, 'Sparkles'); break;
        case 'ff': if (s.character) new CLASSES.ForceField().Parent = s.character; break;
        case 'unff': for (const f of s.character ? s.character.GetChildren() : []) if (f.ClassName === 'ForceField') f.Destroy(); break;
        case 'invisible': case 'visible':
          for (const p of s.character ? s.character.GetDescendants() : []) {
            if (p instanceof BasePart && p.Name !== 'HumanoidRootPart') p.Transparency = c === 'invisible' ? 1 : 0;
          }
          break;
        case 'clean':
          for (const e of s.character ? s.character.GetDescendants() : []) if (['Fire', 'Sparkles', 'Smoke'].includes(e.ClassName)) e.Destroy();
          break;
        case 'tp': case 'bring': case 'to': {
          const dest = c === 'bring' ? session : c === 'to' ? s : pick(parts[1])[0];
          const who = c === 'to' ? session : s;
          const dt = dest && torso(dest);
          if (dt && who.character && who !== dest) this.teleport(who.character, CFrame.fromPosition(dt.Position.add(new Vector3(0, 0, 4))));
          break;
        }
        case 'mute': if (s !== session) { s.muted = true; this.send(s, { t: 'sys', text: 'You have been muted.' }); } break;
        case 'unmute': s.muted = false; break;
        case 'kick':
          if (s === session || s.user.isAdmin) break;
          this.kick(s, parts.slice(1).join(' ') || `Kicked by ${session.user.username}`);
          break;
      }
      if (c === 'to') break;
    }
    say(`:${c} → ${targets.map((s) => s.user.username).join(', ')}`);
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
    let spawns = this.game.Workspace.GetDescendants().filter((d) => d instanceof SpawnLocation && d.Enabled);
    if (!spawns.length) return null;
    // Team spawns: players on a team spawn on SpawnLocations of their TeamColor.
    const team = player._p.Team;
    const same = (a, b) => a && b && a.toHex() === b.toHex();
    const mine = team ? spawns.filter((sp) => !sp._p.Neutral && same(sp._p.TeamColor, team._p.TeamColor)) : spawns.filter((sp) => sp._p.Neutral);
    if (mine.length) spawns = mine;
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
    // Every spawn starts with a fresh Backpack: the StarterPack's tools.
    const backpack = player.FindFirstChild('Backpack');
    if (backpack) {
      for (const t of backpack.GetChildren()) t.Destroy();
      for (const t of this.game.GetService('StarterPack').GetChildren()) {
        try { t.Clone().Parent = backpack; } catch { /* not cloneable */ }
      }
    }
    this.applyPassPerks(session, hum);
    this.enqueue(['char', player.UserId, model.id, cf.toArray()]);
    player._fire('CharacterAdded', model);
  }

  // Built-in game pass perks (no scripting needed), on every spawn.
  applyPassPerks(session, hum) {
    const passes = this.backend.passes;
    if (!passes || !hum) return;
    for (const perk of passes.perks(session.user.id)) {
      if (perk === 'speed') hum.WalkSpeed = Math.max(hum.WalkSpeed, 26);
      if (perk === 'jump') hum.JumpPower = Math.max(hum.JumpPower, 80);
      if (perk === 'fly') hum.Flying = true;
    }
  }

  // MarketplaceService:PromptGamePassPurchase: the player sees a buy dialog.
  promptPass(player, passId) {
    const session = this.sessions.get(player._p ? player._p.UserId : player.UserId);
    const passes = this.backend.passes;
    if (!session || !passes) return;
    const info = passes.info(+passId, session.user.id);
    if (!info || info.gameId !== this.gameId) { this.log('warn', `PromptGamePassPurchase: no game pass ${passId} in this game`); return; }
    this.send(session, { t: 'promptPass', pass: info, robits: session.user.robits });
  }

  // The player bought (or closed) a pass dialog in game.
  buyPassInGame(session, passId, confirm) {
    const passes = this.backend.passes;
    const market = this.game.GetService('MarketplaceService');
    if (!passes) return;
    const info = passes.info(+passId, session.user.id);
    if (!info || info.gameId !== this.gameId) return;
    let bought = false;
    if (confirm) {
      const r = passes.buy(session.user.id, +passId);
      if (r.error) this.send(session, { t: 'passResult', ok: false, msg: r.error, id: +passId });
      else {
        bought = true;
        this.send(session, { t: 'passResult', ok: true, pass: r.pass, robits: r.robits });
        const hum = session.character && session.character.FindFirstChildOfClass('Humanoid');
        this.applyPassPerks(session, hum);
      }
    }
    market._fire('PromptGamePassPurchaseFinished', session.player, +passId, bought);
  }

  removeCharacter(session) {
    this.exitVehicle(session, { aside: false });
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
    this.exitVehicle(session, { aside: false });
    this.enqueue(['died', session.user.id]);
    const players = this.game.GetService('Players');
    if (players.CharacterAutoLoads) session.respawnAt = this.time + Math.max(0, players.RespawnTime);
  }

  // ------------------------------------------------------------ vehicles
  enterVehicle(session, seat, { scripted = false } = {}) {
    if (seat._p.Disabled || seat._occupied || !session.character || seat._destroyed) return;
    if (session.vehicle) { if (!scripted) return; this.exitVehicle(session, { aside: false }); }
    if (!scripted && session.vehicleCooldown && this.time < session.vehicleCooldown) return;
    // Seated by a script (seat:Sit): bring the player to the seat first.
    if (scripted) this.teleport(session.character, CFrame.fromPosition(seat._p.CFrame.Position.add(new Vector3(0, 1.5, 0))));
    const model = seat.Parent && seat.Parent.ClassName === 'Model' && seat.Parent !== this.game.Workspace ? seat.Parent : seat;
    seat._occupied = session;
    session.vehicle = { seat, model, parent: model.Parent };
    // The car rides with the player (drawn under them by every client) while it's driven.
    model.Parent = this.game.GetService('ServerStorage');
    const color = '#' + seat._p.Color.toHex().replace('#', '');
    const look = seat._p.CFrame.LookVector;
    this.send(session, { t: 'drive', on: true, max: seat._p.MaxSpeed, turn: seat._p.TurnSpeed, color, ry: Math.atan2(-look.X, -look.Z) });
    seat._fire('Entered', session.player);
  }

  exitVehicle(session, { aside = true } = {}) {
    const v = session.vehicle;
    if (!v) return;
    session.vehicle = null;
    session.vehicleCooldown = this.time + 1.5;
    v.seat._occupied = null;
    const [x, y, z] = session.state.p;
    if (v.parent && !v.parent._destroyed) {
      // Park the car where the player got out: its seat goes under them, facing their way.
      const delta = rootCFrame(x, y - 1.5, z, session.state.ry).mul(v.seat._p.CFrame.Inverse());
      const parts = v.model === v.seat ? [v.seat] : v.model.GetDescendants().filter((d) => d instanceof BasePart);
      for (const p of parts) p.CFrame = delta.mul(p._p.CFrame);
      v.model.Parent = v.parent;
    }
    this.send(session, { t: 'drive', on: false });
    // Step out beside the car, not inside it.
    if (aside && session.character) {
      const ry = session.state.ry || 0;
      this.teleport(session.character, CFrame.fromPosition(new Vector3(x - Math.cos(ry) * 4.5, y + 0.5, z + Math.sin(ry) * 4.5)));
    }
    v.seat._fire('Exited', session.player);
  }

  teleport(model, cf) {
    const session = [...this.sessions.values()].find((s) => s.character === model);
    this._posing = true;
    poseCharacter(model, cf);
    this._posing = false;
    if (session) {
      session.state.p = [cf.x, cf.y, cf.z];
      // A just-loaded character must reach the client first, or its spawn would undo the teleport.
      if (this.queue.some((op) => op[0] === 'char')) this.flush();
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
        if (text[0] === ':' && this.adminCommand(session, text)) return;
        if (session.muted) { this.send(session, { t: 'sys', text: 'You are muted.' }); return; }
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
        if (session.quest) this._questClick(session, part);
        break;
      }
      case 'equip': {
        const ch = session.character;
        const backpack = session.player && session.player.FindFirstChild('Backpack');
        if (!ch || !backpack) return;
        const tool = msg.id ? this.game.getById(String(msg.id)) : null;
        for (const t of ch.GetChildren()) {
          if (t.ClassName === 'Tool' && t !== tool) { t._fire('Unequipped'); t.Parent = backpack; }
        }
        if (tool && tool.ClassName === 'Tool' && tool.Parent === backpack) { tool.Parent = ch; tool._fire('Equipped'); }
        break;
      }
      case 'activate': {
        const tool = this.game.getById(String(msg.id));
        if (!tool || tool.ClassName !== 'Tool' || !session.character || tool.Parent !== session.character || !tool._p.Enabled) return;
        const hum = session.character.FindFirstChildOfClass('Humanoid');
        if (!hum || hum.Health <= 0) return;
        if (session.lastActivate && this.time - session.lastActivate < 0.05) return;
        session.lastActivate = this.time;
        const p = Array.isArray(msg.p) ? msg.p.map(Number) : null;
        const aim = p && p.every(Number.isFinite) ? new Vector3(p[0], p[1], p[2]) : null;
        tool._fire('Activated', aim);
        break;
      }
      case 'exitVehicle': this.exitVehicle(session); break;
      case 'buyPass': this.buyPassInGame(session, msg.id, !!msg.confirm); break;
      case 'passList': this.send(session, { t: 'passList', passes: this.backend.passes ? this.backend.passes.list(session.user.id) : [] }); break;
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
      this._stopMovedScripts();
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
      if (this.runes && (this.runes.includes(a) || this.runes.includes(b))) {
        const rune = this.runes.includes(a) ? a : b;
        const limb = rune === a ? b : a;
        const who = limb._parent && limb._parent._isCharacter && [...this.sessions.values()].find((x) => x.character === limb._parent);
        if (who) this._runeTouched(who, this.runes.indexOf(rune));
      }
      if (this.huntToken && (a === this.huntToken || b === this.huntToken)) {
        const limb = a === this.huntToken ? b : a;
        const who = limb._parent && limb._parent._isCharacter && [...this.sessions.values()].find((x) => x.character === limb._parent);
        if (who) this._huntTouched(who);
      }
      // Touching a VehicleSeat (or any part of the car it's in) gets you in.
      for (const [part, limb] of [[a, b], [b, a]]) {
        if (!(limb._parent && limb._parent._isCharacter) || part._parent === limb._parent) continue;
        let seat = part.ClassName === 'VehicleSeat' ? part : null;
        const m = part._parent;
        if (!seat && m && m.ClassName === 'Model' && !m._isCharacter) seat = m.FindFirstChildOfClass('VehicleSeat');
        if (!seat) continue;
        const driver = [...this.sessions.values()].find((x) => x.character === limb._parent);
        if (driver) this.enterVehicle(driver, seat);
      }
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
      privateId: this.privateId || undefined,
    };
  }

  close(msg = 'This game has shut down') {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    clearInterval(this.huntTimer);
    clearInterval(this.huntScan);
    for (const s of [...this.sessions.values()]) {
      this.send(s, { t: 'shutdown', msg });
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
