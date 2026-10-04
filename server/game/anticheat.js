// Anti-cheat for Robis Overwatch. Players move on their own computer and send
// the server where they are, so a cheat can make them too fast, fly or jump
// across the map. The server keeps the last 24 seconds of everyone's moves;
// when a player moves in ways the game doesn't allow, it makes a real
// Overwatch case out of it (a replay of the suspect and the players around).
// Investigators judge it, the admins decide.
import { partBox, boxAABB } from '../../shared/engine/physics.js';

const KEEP = 24; // seconds of history
const FPS = 10;
const ANIM = { idle: 0, walk: 1, jump: 2, fall: 2 };

export class AntiCheat {
  constructor(server) {
    this.server = server;
    this.history = []; // [{ t, p: { uid: [x, y, z, ry, anim] } }]
    this.lastSample = -1;
    this.lastCase = new Map(); // uid -> time of the last case
  }

  // ---------------------------------------------------------------- history
  sample() {
    const s = this.server;
    if (s.time - this.lastSample < 1 / FPS - 1e-3) return;
    this.lastSample = s.time;
    const p = {};
    for (const x of s.sessions.values()) {
      if (!x.character || !x.state) continue;
      const [px, py, pz] = x.state.p;
      p[x.user.id] = [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2), +(+x.state.ry || 0).toFixed(3), ANIM[x.state.a] ?? 1];
    }
    this.history.push({ t: s.time, p });
    while (this.history.length > KEEP * FPS) this.history.shift();
  }

  // ---------------------------------------------------------------- checks
  // Called with every 'move' from a player, before it's applied.
  check(session, nx, ny, nz) {
    const s = this.server;
    const hooks = s.manager && s.manager.overwatch;
    if (!hooks || !hooks.enabled()) return;
    const ch = session.character;
    const hum = ch && ch.FindFirstChildOfClass('Humanoid');
    if (!hum || hum.Health <= 0 || !session.state) return;
    const now = s.time;
    const ac = session.ac || (session.ac = { t: now, x: nx, y: ny, z: nz, dist: 0, span: 0, riseFrom: null, riseStart: 0, score: 0, why: {}, scoreAt: now, peak: 0 });
    const dt = now - ac.t;
    const [ox, oy, oz] = [ac.x, ac.y, ac.z];
    Object.assign(ac, { t: now, x: nx, y: ny, z: nz });
    if (dt <= 0) return;
    // things the game itself does: no checks for a moment
    const excused = session.vehicle || hum.Flying || (session.lastServerTp && now - session.lastServerTp < 2) || now - (session.spawnedAt || 0) < 3;
    if (excused) { ac.dist = 0; ac.span = 0; ac.riseFrom = null; return; }
    const scale = Math.max(1, ch._scale || 1);
    const walk = Math.max(16, hum.WalkSpeed) * scale;
    const d = Math.hypot(nx - ox, nz - oz);
    // A player who stands still sends nothing, so a long gap means they stood
    // there: a big jump right after it is a teleport too.
    const step = Math.min(dt, 1);
    if (dt > 1.5) {
      if (d > Math.max(30, walk * step * 4) || ny - oy > 30) this.strikeNow(session, ac, now, 'teleport', 4, `moved ${Math.hypot(nx - ox, ny - oy, nz - oz).toFixed(0)} studs at once`);
      ac.dist = 0; ac.span = 0; ac.riseFrom = null;
      return;
    }
    // decay: 1 point every 10 seconds
    ac.score = Math.max(0, ac.score - (now - ac.scoreAt) / 10);
    ac.scoreAt = now;
    const strike = (why, pts, detail) => {
      ac.score += pts;
      ac.why[why] = (ac.why[why] || 0) + 1;
      ac.lastDetail = detail;
      if (ac.score >= 6) this.suspect(session, ac);
    };
    // teleport: far in one step (sideways, or straight up)
    // (the most a launch pad / trampoline can lift you in dt: v = 120, gravity)
    const tUp = Math.min(dt, 0.6);
    if (d > Math.max(30, walk * dt * 4) || ny - oy > Math.max(30, 120 * tUp - 98 * tUp * tUp + 6)) { strike('teleport', 4, `moved ${Math.hypot(nx - ox, ny - oy, nz - oz).toFixed(0)} studs in ${dt.toFixed(2)} s`); ac.dist = 0; ac.span = 0; ac.riseFrom = null; return; }
    // speed: over about a second
    ac.dist += d; ac.span += dt;
    if (ac.span >= 1) {
      const v = ac.dist / ac.span;
      const allowed = walk * 1.4 + 6;
      if (v > allowed) strike('speed', 2, `ran ${v.toFixed(0)} studs/s (the game allows ${walk.toFixed(0)})`);
      ac.dist = 0; ac.span = 0;
    }
    // fly: going up for too long (not on a ladder, normal gravity)
    const gravity = s.game.Workspace.Gravity;
    if (ny > oy + 0.05 && gravity >= 150 && !this.nearTruss(nx, ny, nz)) {
      if (ac.riseFrom === null) { ac.riseFrom = oy; ac.riseStart = now; }
      if (now - ac.riseStart > 2.2 && ny - ac.riseFrom > 20) { strike('fly', 3, `flew up ${(ny - ac.riseFrom).toFixed(0)} studs`); ac.riseFrom = null; }
    } else if (ny < oy - 0.05) ac.riseFrom = null;
  }

  strikeNow(session, ac, now, why, pts, detail) {
    ac.score = Math.max(0, ac.score - (now - ac.scoreAt) / 10) + pts;
    ac.scoreAt = now;
    ac.why[why] = (ac.why[why] || 0) + 1;
    ac.lastDetail = detail;
    if (ac.score >= 6) this.suspect(session, ac);
  }

  nearTruss(x, y, z) {
    for (const b of this.server.grid.query(x - 4, z - 4, x + 4, z + 4)) {
      const p = b.part;
      if (p && p.ClassName === 'TrussPart') { const a = boxAABB(b); if (y > a.minY - 4 && y < a.maxY + 6) return true; }
    }
    return false;
  }

  // ---------------------------------------------------------------- a case
  suspect(session, ac) {
    const s = this.server;
    const uid = session.user.id;
    if (this.lastCase.has(uid) && s.time - this.lastCase.get(uid) < 600) return; // one case per player per 10 minutes here
    this.lastCase.set(uid, s.time);
    const why = { ...ac.why };
    const detail = ac.lastDetail;
    ac.score = 0; ac.why = {};
    // wait a little so the replay shows what happened after too
    setTimeout(() => { try { this.makeCase(session, why, detail); } catch (e) { s.log('warn', 'Anti-cheat: ' + e.message); } }, 4000);
  }

  makeCase(session, why, detail) {
    const s = this.server;
    const hooks = s.manager && s.manager.overwatch;
    if (!hooks || s.closed) return;
    const uid = session.user.id;
    const hist = this.history.filter((h) => h.p[uid]);
    if (hist.length < FPS * 5) return;
    // the suspect and up to 5 players nearest to them
    const dist = new Map();
    for (const h of hist) {
      const me = h.p[uid];
      for (const [id, q] of Object.entries(h.p)) if (+id !== uid) dist.set(+id, (dist.get(+id) || 0) + Math.hypot(q[0] - me[0], q[2] - me[2]));
    }
    const others = [...dist.entries()].sort((a, b) => a[1] - b[1]).slice(0, 5).map(([id]) => id);
    const ids = [uid, ...others];
    const last = new Map();
    const frames = hist.map((h) => {
      const row = [];
      for (const id of ids) {
        const q = h.p[id] || last.get(id) || [0, -500, 0, 0, 0]; // not here yet: far below
        if (h.p[id]) last.set(id, q);
        row.push(...q);
      }
      return row;
    });
    // the map around the action: anchored parts as boxes
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const h of hist) for (const id of ids) { const q = h.p[id]; if (!q || q[1] < -400) continue; minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[2]); maxZ = Math.max(maxZ, q[2]); }
    const pad = 40;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const walls = [];
    for (const p of s._collectParts()) {
      if (!p._p.Anchored || p._p.Transparency >= 0.95 || (p._parent && p._parent._isCharacter)) continue;
      const a = boxAABB(partBox(p));
      if (a.maxX < minX - pad || a.minX > maxX + pad || a.maxZ < minZ - pad || a.minZ > maxZ + pad) continue;
      walls.push({ x: +((a.minX + a.maxX) / 2).toFixed(1), y: +((a.minY + a.maxY) / 2).toFixed(1), z: +((a.minZ + a.maxZ) / 2).toFixed(1), w: +(a.maxX - a.minX).toFixed(1), h: +(a.maxY - a.minY).toFixed(1), d: +(a.maxZ - a.minZ).toFixed(1), color: '#' + p._p.Color.toHex().replace('#', ''), dist: Math.hypot((a.minX + a.maxX) / 2 - cx, (a.minZ + a.maxZ) / 2 - cz) });
    }
    walls.sort((a, b) => a.dist - b.dist);
    const bots = ids.map((id) => {
      const x = [...s.sessions.values()].find((q) => q.user.id === id);
      return { name: x ? x.user.username : 'Player', colors: (x && x.avatar && x.avatar.bodyColors) || {} };
    });
    const replay = {
      real: true, fps: FPS, seconds: Math.round(frames.length / FPS), arena: Math.max(30, Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 2 + pad)), center: [cx, cz],
      walls: walls.slice(0, 350).map(({ dist: _, ...w }) => w), bots, suspect: 0, frames, shots: [], respawns: [],
    };
    hooks.addCase({ uid, username: session.user.username, gameId: s.gameId, why, detail, replay });
  }
}
