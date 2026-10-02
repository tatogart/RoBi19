// Where to hide The Hunt token: a spot a player can actually get to.
// Starting from the spawns, we walk over the platforms the way a character
// can (jump up to ~6 studs, cross gaps up to ~8, drop down, climb trusses),
// then pick one of the reached platforms: far from the spawns, more often up
// high, not on a huge ground part (that's how tokens ended up behind the map),
// and with room above it.
import { Vector3 } from '../../shared/engine/types.js';
import { BasePart, SpawnLocation, partAABB } from '../../shared/engine/instances.js';

const BAD = /lava|kill|death|acid|spike|hazard|laser|trap|seek|void|fire|poison|danger|water/i;
const NOT_A_SPOT = /wall|barrier|fence|border|boundary|roof|ceiling|sky|invisible|tree|leaves|trunk|pole|pillar|lamp|sign|banner/i;
const JUMP_UP = 6;
const GAP = 8;
const GROUND_AREA = 12000; // bigger than this is ground: walkable, but not a hiding spot

function box(p) {
  const [a, b] = partAABB(p);
  return { minX: a.X, minY: a.Y, minZ: a.Z, maxX: b.X, maxY: b.Y, maxZ: b.Z, top: b.Y, part: p };
}
function gap(a, b) {
  const gx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const gz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
  return Math.hypot(gx, gz);
}

// opts.minDist: how far from the start spawns it must be (0 = take the farthest
// spots there are). Returns null when there's no such spot yet (games that build
// their map while running, like DOORS: try again later).
export function findHuntSpot(workspace, rnd = Math.random, opts = {}) {
  const need = opts.minDist === undefined ? 45 : opts.minDist;
  const parts = workspace.GetDescendants().filter((p) => p instanceof BasePart && p._p.Anchored && !(p.Parent && p.Parent._isCharacter)
    && p.Position.Y > -60 && p.Position.Y < 1500);
  const solid = parts.filter((p) => p._p.CanCollide && p._p.Transparency < 0.95);
  // Obby checkpoints are spawns too, but the token should be far from the start.
  const allSpawns = parts.filter((p) => p instanceof SpawnLocation);
  const enabled = allSpawns.filter((p) => p._p.Enabled !== false);
  const CP = /checkpoint|stage/i;
  const startSpawns = enabled.filter((p) => !CP.test(p.Name) && !(p.Parent && CP.test(p.Parent.Name)));
  const spawns = (startSpawns.length ? startSpawns : enabled.length ? enabled : allSpawns).map(box);
  const anySpawn = allSpawns.map(box);
  const safe = (p) => !BAD.test(p.Name) && !(p.Parent && BAD.test(p.Parent.Name)) && !p.FindFirstChildOfClass('Script');
  // walkable platforms (and trusses to climb)
  const nodes = solid.filter((p) => safe(p) && (p.ClassName === 'TrussPart' || (p._p.Size.X >= 1.5 && p._p.Size.Z >= 1.5))).map(box);
  for (const n of nodes) n.truss = n.part.ClassName === 'TrussPart';
  const lowest = () => nodes.filter((n) => n.top <= Math.min(...nodes.map((m) => m.top)) + 1);
  const starts = spawns.length ? spawns : lowest();
  if (!nodes.length || !starts.length) return null;

  const reached = new Set();
  const queue = [];
  const canGo = (a, b) => {
    const d = gap(a, b);
    if (a.truss) return d <= 4 && b.top <= a.maxY + JUMP_UP; // off the top (or side) of a ladder
    if (b.truss) return d <= 3 && a.top >= b.minY - JUMP_UP && a.top <= b.maxY; // grab a ladder
    return d <= GAP && b.top - a.top <= JUMP_UP && a.top - b.top <= 80;
  };
  const walk = (from) => {
    for (const s of from) for (const n of nodes) if (!reached.has(n) && canGo({ ...s, truss: false }, n)) { reached.add(n); queue.push(n); }
    while (queue.length) {
      const a = queue.shift();
      for (const b of nodes) if (!reached.has(b) && canGo(a, b)) { reached.add(b); queue.push(b); }
    }
  };
  // breadth-first walk from the spawns, plus the checkpoints players reach
  walk(starts);
  walk(anySpawn);

  // somewhere to stand: no other solid part right above the spot
  const blocked = (x, y, z) => solid.some((p) => {
    const [a, b] = partAABB(p);
    return x > a.X && x < b.X && z > a.Z && z < b.Z && y + 4 > a.Y && y + 0.2 < b.Y;
  });
  // opts.ground: an empty map (just a baseplate): somewhere on the ground, away from the spawn
  if (opts.ground) {
    const grounds = [...reached].filter((n) => !n.truss && (n.maxX - n.minX) * (n.maxZ - n.minZ) >= GROUND_AREA);
    const s0 = starts[0];
    const cx = (s0.minX + s0.maxX) / 2, cz = (s0.minZ + s0.maxZ) / 2;
    for (let tries = 0; tries < 40 && grounds.length; tries++) {
      const g = grounds[Math.floor(rnd() * grounds.length)];
      const a = rnd() * Math.PI * 2, d = 35 + rnd() * 55;
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      if (x < g.minX + 2 || x > g.maxX - 2 || z < g.minZ + 2 || z > g.maxZ - 2 || blocked(x, g.top, z)) continue;
      return new Vector3(x, g.top + 2, z);
    }
    return null;
  }
  const minDist = (n) => Math.min(...starts.map((s) => Math.hypot((n.minX + n.maxX) / 2 - (s.minX + s.maxX) / 2, (n.minZ + n.maxZ) / 2 - (s.minZ + s.maxZ) / 2)));
  let pool = [...reached].filter((n) => !n.truss && !(n.part instanceof SpawnLocation) && !NOT_A_SPOT.test(n.part.Name) && !(n.part.Parent && NOT_A_SPOT.test(n.part.Parent.Name))
    && (n.maxX - n.minX) * (n.maxZ - n.minZ) < GROUND_AREA);
  if (!pool.length && !need) return null;
  const spotOk = (n) => !n.truss && !(n.part instanceof SpawnLocation) && !NOT_A_SPOT.test(n.part.Name) && !(n.part.Parent && NOT_A_SPOT.test(n.part.Parent.Name))
    && (n.maxX - n.minX) * (n.maxZ - n.minZ) < GROUND_AREA;
  let far = pool.filter((n) => minDist(n) > need);
  if (!far.length && need) {
    // Games that send you from a lobby to the map (Natural Disaster): the map is
    // walkable from its own ground, so walk from the big ground parts too.
    const grounds = nodes.filter((n) => !reached.has(n) && !n.truss && (n.maxX - n.minX) * (n.maxZ - n.minZ) >= 400 && n.top < Math.max(...starts.map((s) => s.top)) - 20);
    walk(grounds);
    pool = [...reached].filter(spotOk);
    far = pool.filter((n) => minDist(n) > need);
  }
  if (far.length) pool = far;
  else if (need) return null;
  else pool = pool.sort((a, b) => minDist(b) - minDist(a)).slice(0, Math.max(1, Math.ceil(pool.length / 3))); // the farthest third
  // higher platforms more often
  const minY = Math.min(...pool.map((n) => n.top));
  for (let tries = 0; tries < 40 && pool.length; tries++) {
    const weights = pool.map((n) => 1 + Math.max(0, n.top - minY) / 6);
    let r = rnd() * weights.reduce((a, b) => a + b, 0);
    let n = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { n = pool[i]; break; } }
    const x = n.minX + 1 + rnd() * Math.max(0, n.maxX - n.minX - 2);
    const z = n.minZ + 1 + rnd() * Math.max(0, n.maxZ - n.minZ - 2);
    if (!blocked(x, n.top, z)) return new Vector3(x, n.top + 2, z);
    pool = pool.filter((m) => m !== n || rnd() < 0.5);
  }
  return null;
}
