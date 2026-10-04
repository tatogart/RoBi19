// Robis Overwatch: made-up "replays" of a tag game played by bots. In some
// of them the suspect cheats (speed, flying, teleports, walking through walls,
// aimbot), in the others the suspect plays fair. The server makes them from a
// seed every week; players watch and say what they think.
export const OW_FPS = 10;
export const OW_SECONDS = 24;
export const OW_KINDS = ['speed', 'fly', 'teleport', 'noclip', 'aimbot'];
export const OW_KIND_NAMES = { fair: 'Fair player', speed: 'Speed hack', fly: 'Fly hack', teleport: 'Teleport hack', noclip: 'Walks through walls', aimbot: 'Aimbot' };

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function hashSeed(...parts) {
  let h = 2166136261;
  for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

const ARENA = 46; // half size
const NAMES = ['xXNoobSlayerXx', 'BuilderBob', 'Guest_2019', 'PizzaKing', 'ObbyMaster', 'CoolKid99', 'LavaJumper', 'NinjaBrick', 'SkyWalker7', 'DoorRunner',
  'TycoonTom', 'FrostyGamer', 'BaconHair', 'RobitRich', 'CookieCrumb', 'PixelPanda', 'TurboToast', 'MegaBlox', 'SilentSam', 'HappyHeadstone'];
const SHIRTS = ['#c4281c', '#0d69ac', '#4b974b', '#f5cd30', '#6b327c', '#ff66cc', '#da8541', '#1b2a35', '#00aaaa', '#ffffff'];
const SKIN = ['#eab892', '#cc8e69', '#a0703c', '#f5cd30', '#ffcc99'];

function segHitsBox(ax, az, bx, bz, w, m) {
  // segment a-b vs box w grown by m (2D slab test)
  const minX = w.x - w.w / 2 - m, maxX = w.x + w.w / 2 + m, minZ = w.z - w.d / 2 - m, maxZ = w.z + w.d / 2 + m;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, minX, maxX], [az, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}
const inBox = (x, z, w, m = 1.5) => Math.abs(x - w.x) < w.w / 2 + m && Math.abs(z - w.z) < w.d / 2 + m;

// kind: 'fair' or one of OW_KINDS. Returns everything the viewer needs.
export function makeCase(seed, kind) {
  const R = rng(seed);
  const walls = [];
  for (let i = 0; i < 9; i++) {
    const long = R() < 0.5;
    walls.push({ x: Math.round((R() * 2 - 1) * (ARENA - 12)), z: Math.round((R() * 2 - 1) * (ARENA - 12)), w: long ? 14 + Math.round(R() * 10) : 3, d: long ? 3 : 14 + Math.round(R() * 10), h: 8, color: ['#a3a2a5', '#c4a484', '#7a8b9a'][i % 3] });
  }
  const free = (x, z) => Math.abs(x) < ARENA - 2 && Math.abs(z) < ARENA - 2 && !walls.some((w) => inBox(x, z, w));
  const randomFree = () => { for (let i = 0; i < 200; i++) { const x = (R() * 2 - 1) * (ARENA - 4), z = (R() * 2 - 1) * (ARENA - 4); if (free(x, z)) return [x, z]; } return [0, 0]; };
  const clearPath = (ax, az, bx, bz) => !walls.some((w) => segHitsBox(ax, az, bx, bz, w, 1.6));
  const N = 6;
  const used = new Set();
  const bots = Array.from({ length: N }, (_, i) => {
    let n; do { n = NAMES[Math.floor(R() * NAMES.length)]; } while (used.has(n)); used.add(n);
    const skin = SKIN[Math.floor(R() * SKIN.length)];
    return { name: n, colors: { head: skin, leftArm: skin, rightArm: skin, torso: SHIRTS[Math.floor(R() * SHIRTS.length)], leftLeg: SHIRTS[(i * 3 + 2) % SHIRTS.length], rightLeg: SHIRTS[(i * 3 + 2) % SHIRTS.length] } };
  });
  const S = 0; // the suspect is always bot 0 (the viewer is told who)
  const st = bots.map((_, i) => { const [x, z] = randomFree(); return { i, x, z, y: 3, ry: 0, tx: x, tz: z, jumpT: -1, hits: 0, nextShot: 1 + R() * 3, fly: 0, flyUntil: 0, nextTp: 3 + R() * 2 }; });
  const pickTarget = (b, ignoreWalls) => {
    for (let k = 0; k < 40; k++) {
      const [x, z] = ignoreWalls ? [(R() * 2 - 1) * (ARENA - 4), (R() * 2 - 1) * (ARENA - 4)] : randomFree();
      if (ignoreWalls) {
        // a noclipper aims for spots on the far side of walls
        if (walls.some((w) => segHitsBox(b.x, b.z, x, z, w, 0)) && free(x, z)) { b.tx = x; b.tz = z; return; }
      } else if (clearPath(b.x, b.z, x, z) && Math.hypot(x - b.x, z - b.z) > 8) { b.tx = x; b.tz = z; return; }
    }
    const [x, z] = randomFree(); b.tx = x; b.tz = z;
  };
  for (const b of st) pickTarget(b, kind === 'noclip' && b.i === S);
  const frames = [];
  const shots = [];
  const respawns = [];
  const dt = 1 / OW_FPS;
  const total = OW_SECONDS * OW_FPS;
  const visible = (a, b) => clearPath(a.x, a.z, b.x, b.z);
  for (let f = 0; f < total; f++) {
    const t = f * dt;
    const row = [];
    for (const b of st) {
      const cheat = b.i === S ? kind : 'fair';
      const speed = cheat === 'speed' ? 40 : 16;
      let dx = b.tx - b.x, dz = b.tz - b.z;
      const dist = Math.hypot(dx, dz);
      let moving = true;
      if (dist < 1.5) { pickTarget(b, cheat === 'noclip'); moving = R() < 0.6; }
      else {
        const step = Math.min(dist, speed * dt);
        let nx = b.x + (dx / dist) * step, nz = b.z + (dz / dist) * step;
        // fair players never pass through walls: pick a new spot when blocked
        if (cheat !== 'noclip' && walls.some((w) => inBox(nx, nz, w, 1.2))) { pickTarget(b, false); nx = b.x; nz = b.z; }
        b.x = nx; b.z = nz;
        b.ry = Math.atan2(-dx, -dz);
      }
      // jumps (everyone)
      if (b.jumpT < 0 && R() < 0.012) b.jumpT = 0;
      let y = 3;
      if (b.jumpT >= 0) { b.jumpT += dt; const jt = b.jumpT; y = 3 + Math.max(0, 50 * jt - 98 * jt * jt); if (jt > 0.51) b.jumpT = -1; }
      // fly hack: floats high above the floor for a few seconds at a time
      if (cheat === 'fly') {
        if (!b.flyUntil && R() < 0.03) b.flyUntil = t + 3 + R() * 3;
        if (b.flyUntil && t < b.flyUntil) b.fly = Math.min(12 + Math.sin(t * 2) * 2, b.fly + 15 * dt);
        else { b.fly = Math.max(0, b.fly - 20 * dt); if (b.flyUntil && t >= b.flyUntil) b.flyUntil = R() < 0.5 ? 0 : b.flyUntil; }
        y += b.fly;
      }
      // teleport hack: jumps across the map in one frame
      if (cheat === 'teleport' && t >= b.nextTp) {
        const [x, z] = randomFree(); b.x = x; b.z = z; b.nextTp = t + 3 + R() * 3; pickTarget(b, false);
      }
      // shooting (a game of laser tag)
      if (t >= b.nextShot) {
        const aim = cheat === 'aimbot';
        const others = st.filter((o) => o !== b && (aim || visible(b, o)) && Math.hypot(o.x - b.x, o.z - b.z) < (aim ? 90 : 55));
        if (others.length) {
          const o = others.reduce((p, q) => (Math.hypot(q.x - b.x, q.z - b.z) < Math.hypot(p.x - b.x, p.z - b.z) ? q : p));
          const hit = aim ? true : R() < 0.35;
          if (aim) b.ry = Math.atan2(-(o.x - b.x), -(o.z - b.z)); // snaps straight onto the target
          shots.push({ f, from: b.i, to: o.i, hit, mx: hit ? 0 : (R() - 0.5) * 6, mz: hit ? 0 : (R() - 0.5) * 6 });
          if (hit && ++o.hits >= 3) {
            o.hits = 0;
            const [x, z] = randomFree(); o.x = x; o.z = z; pickTarget(o, kind === 'noclip' && o.i === S);
            respawns.push({ f: o.i < b.i ? f + 1 : f, bot: o.i }); // the frame the jump shows up in
          }
        }
        b.nextShot = t + (aim ? 0.8 + R() * 0.4 : 2 + R() * 2.5);
      }
      const anim = y > 3.3 ? 2 : moving && dist >= 1.5 ? 1 : 0;
      row.push(+b.x.toFixed(2), +y.toFixed(2), +b.z.toFixed(2), +b.ry.toFixed(3), anim);
    }
    frames.push(row);
  }
  return { fps: OW_FPS, seconds: OW_SECONDS, arena: ARENA, walls, bots, suspect: S, frames, shots, respawns };
}
