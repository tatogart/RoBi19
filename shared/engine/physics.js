// Lightweight collision helpers shared by the client (character controller)
// and the server (Touched detection, simple unanchored-part physics).
// Everything works on plain {x,y,z} objects for speed.

export function partBox(part) {
  const cf = part._p.CFrame, s = part._p.Size, r = cf.r;
  return {
    part,
    cx: cf.x, cy: cf.y, cz: cf.z,
    // local axes (columns of the rotation matrix)
    ax: [r[0], r[3], r[6]], ay: [r[1], r[4], r[7]], az: [r[2], r[5], r[8]],
    hx: s.X / 2, hy: s.Y / 2, hz: s.Z / 2,
    shape: part.ClassName === 'WedgePart' ? 'Wedge'
      : part.ClassName === 'CornerWedgePart' ? 'Block'
      : (part._p.Shape || 'Block'),
  };
}

export function boxAABB(b) {
  const ex = Math.abs(b.ax[0]) * b.hx + Math.abs(b.ay[0]) * b.hy + Math.abs(b.az[0]) * b.hz;
  const ey = Math.abs(b.ax[1]) * b.hx + Math.abs(b.ay[1]) * b.hy + Math.abs(b.az[1]) * b.hz;
  const ez = Math.abs(b.ax[2]) * b.hx + Math.abs(b.ay[2]) * b.hy + Math.abs(b.az[2]) * b.hz;
  return { minX: b.cx - ex, minY: b.cy - ey, minZ: b.cz - ez, maxX: b.cx + ex, maxY: b.cy + ey, maxZ: b.cz + ez };
}

function toLocal(b, x, y, z) {
  const dx = x - b.cx, dy = y - b.cy, dz = z - b.cz;
  return [
    dx * b.ax[0] + dy * b.ax[1] + dz * b.ax[2],
    dx * b.ay[0] + dy * b.ay[1] + dz * b.ay[2],
    dx * b.az[0] + dy * b.az[1] + dz * b.az[2],
  ];
}
function toWorldVec(b, lx, ly, lz) {
  return [
    b.ax[0] * lx + b.ay[0] * ly + b.az[0] * lz,
    b.ax[1] * lx + b.ay[1] * ly + b.az[1] * lz,
    b.ax[2] * lx + b.ay[2] * ly + b.az[2] * lz,
  ];
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Closest point on the shape (in local space) to local point p.
// Returns [qx,qy,qz, inside(bool)].
function closestLocal(b, px, py, pz) {
  const { hx, hy, hz } = b;
  if (b.shape === 'Ball') {
    const r = Math.min(hx, hy, hz);
    const d = Math.hypot(px, py, pz);
    if (d < 1e-9) return [0, r, 0, true];
    const k = r / d;
    return [px * k, py * k, pz * k, d < r];
  }
  if (b.shape === 'Cylinder') {
    // Roblox cylinders run along the local X axis.
    const r = Math.min(hy, hz);
    const qx = clamp(px, -hx, hx);
    const d = Math.hypot(py, pz);
    const inside = Math.abs(px) <= hx && d <= r;
    if (inside) {
      const dCap = hx - Math.abs(px), dSide = r - d;
      if (dCap < dSide) return [Math.sign(px || 1) * hx, py, pz, true];
      const k = d > 1e-9 ? r / d : 0;
      return [px, d > 1e-9 ? py * k : r, pz * k, true];
    }
    const k = d > r ? r / d : 1;
    return [qx, py * k, pz * k, false];
  }
  let qx = clamp(px, -hx, hx), qy = clamp(py, -hy, hy), qz = clamp(pz, -hz, hz);
  let inside = qx === px && qy === py && qz === pz;
  if (b.shape === 'Wedge') {
    // Solid where (y + hy) / (2hy) <= (z + hz) / (2hz): slope faces -Z, high at +Z.
    const nY = 2 * hz, nZ = -2 * hy; // plane normal (unnormalised) pointing out of the slope
    const nl = Math.hypot(nY, nZ);
    const ny = nY / nl, nz = nZ / nl;
    const planeD = (py - (-hy)) * ny + (pz - (-hz)) * nz; // signed distance of p from slope plane
    const qd = (qy + hy) * ny + (qz + hz) * nz;
    if (qd > 0) {
      // clamped point is above the slope: project onto the plane and re-clamp
      qy -= qd * ny; qz -= qd * nz;
      qy = clamp(qy, -hy, hy); qz = clamp(qz, -hz, hz);
      inside = false;
    } else if (inside) {
      inside = planeD <= 0;
    }
    if (inside) {
      // pick nearest face among box faces and slope
      const cands = [
        [hx - Math.abs(px), 'x'], [hy + py, '-y'], [hz - pz, '+z'], [-planeD, 's'],
      ];
      cands.sort((a, c) => a[0] - c[0]);
      const f = cands[0][1];
      if (f === 'x') return [Math.sign(px || 1) * hx, py, pz, true];
      if (f === '-y') return [px, -hy, pz, true];
      if (f === '+z') return [px, py, hz, true];
      return [px, py - planeD * ny, pz - planeD * nz, true];
    }
    return [qx, qy, qz, false];
  }
  if (inside) {
    const dx = hx - Math.abs(px), dy = hy - Math.abs(py), dz = hz - Math.abs(pz);
    if (dx <= dy && dx <= dz) return [Math.sign(px || 1) * hx, py, pz, true];
    if (dy <= dz) return [px, Math.sign(py || 1) * hy, pz, true];
    return [px, py, Math.sign(pz || 1) * hz, true];
  }
  return [qx, qy, qz, false];
}

// Sphere vs part. Returns null or {nx,ny,nz, depth} (push the sphere along n by depth).
export function sphereVsBox(b, x, y, z, radius) {
  const [px, py, pz] = toLocal(b, x, y, z);
  const [qx, qy, qz, inside] = closestLocal(b, px, py, pz);
  let dx = px - qx, dy = py - qy, dz = pz - qz;
  let d = Math.hypot(dx, dy, dz);
  if (!inside && d >= radius) return null;
  if (d < 1e-9) {
    // centre exactly on the surface: push up
    const [wx, wy, wz] = toWorldVec(b, 0, 1, 0);
    return { nx: wx, ny: wy, nz: wz, depth: radius };
  }
  let depth;
  if (inside) { dx = -dx; dy = -dy; dz = -dz; depth = radius + d; } else depth = radius - d;
  const [nx, ny, nz] = toWorldVec(b, dx / d, dy / d, dz / d);
  return { nx, ny, nz, depth };
}

// Separating-axis test between two oriented boxes (shapes approximated as boxes).
export function boxesOverlap(a, b, margin = 0) {
  const A = [a.ax, a.ay, a.az], B = [b.ax, b.ay, b.az];
  const ea = [a.hx + margin, a.hy + margin, a.hz + margin], eb = [b.hx, b.hy, b.hz];
  const t = [b.cx - a.cx, b.cy - a.cy, b.cz - a.cz];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const R = [], AbsR = [];
  for (let i = 0; i < 3; i++) {
    R[i] = []; AbsR[i] = [];
    for (let j = 0; j < 3; j++) { R[i][j] = dot(A[i], B[j]); AbsR[i][j] = Math.abs(R[i][j]) + 1e-6; }
  }
  const tl = [dot(t, A[0]), dot(t, A[1]), dot(t, A[2])];
  for (let i = 0; i < 3; i++) {
    const ra = ea[i], rb = eb[0] * AbsR[i][0] + eb[1] * AbsR[i][1] + eb[2] * AbsR[i][2];
    if (Math.abs(tl[i]) > ra + rb) return false;
  }
  for (let j = 0; j < 3; j++) {
    const ra = ea[0] * AbsR[0][j] + ea[1] * AbsR[1][j] + ea[2] * AbsR[2][j];
    if (Math.abs(tl[0] * R[0][j] + tl[1] * R[1][j] + tl[2] * R[2][j]) > ra + eb[j]) return false;
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3, j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const ra = ea[i1] * AbsR[i2][j] + ea[i2] * AbsR[i1][j];
      const rb = eb[j1] * AbsR[i][j2] + eb[j2] * AbsR[i][j1];
      if (Math.abs(tl[i2] * R[i1][j] - tl[i1] * R[i2][j]) > ra + rb) return false;
    }
  }
  return true;
}

export function aabbOverlap(a, b, m = 0) {
  return a.minX - m <= b.maxX && a.maxX + m >= b.minX && a.minY - m <= b.maxY && a.maxY + m >= b.minY && a.minZ - m <= b.maxZ && a.maxZ + m >= b.minZ;
}

// Ray vs part (slab test in local space, shapes approximated as boxes). Returns distance or -1.
export function rayVsBox(b, ox, oy, oz, dx, dy, dz, maxDist = Infinity) {
  const [lx, ly, lz] = toLocal(b, ox, oy, oz);
  const ld = [
    dx * b.ax[0] + dy * b.ax[1] + dz * b.ax[2],
    dx * b.ay[0] + dy * b.ay[1] + dz * b.ay[2],
    dx * b.az[0] + dy * b.az[1] + dz * b.az[2],
  ];
  const lo = [lx, ly, lz], h = [b.hx, b.hy, b.hz];
  let tmin = 0, tmax = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ld[i]) < 1e-9) {
      if (lo[i] < -h[i] || lo[i] > h[i]) return -1;
    } else {
      let t1 = (-h[i] - lo[i]) / ld[i], t2 = (h[i] - lo[i]) / ld[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// ---------------------------------------------------------------- spatial grid
export class SpatialGrid {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); this.big = new Set(); }
  clear() { this.map.clear(); this.big.clear(); }
  insert(item, aabb) {
    const c = this.cell;
    const x0 = Math.floor(aabb.minX / c), x1 = Math.floor(aabb.maxX / c);
    const z0 = Math.floor(aabb.minZ / c), z1 = Math.floor(aabb.maxZ / c);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 64) { this.big.add(item); return; }
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = x * 73856093 ^ z * 19349663;
        let a = this.map.get(k);
        if (!a) this.map.set(k, a = []);
        a.push(item);
      }
    }
  }
  query(minX, minZ, maxX, maxZ, out = new Set()) {
    const c = this.cell;
    for (const b of this.big) out.add(b);
    for (let x = Math.floor(minX / c); x <= Math.floor(maxX / c); x++) {
      for (let z = Math.floor(minZ / c); z <= Math.floor(maxZ / c); z++) {
        const a = this.map.get(x * 73856093 ^ z * 19349663);
        if (a) for (const it of a) out.add(it);
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------- character controller
// The R6 character is 5 studs tall; the root (torso centre) sits 3 studs above the feet.
export const CHAR = {
  spheres: [-2, -0.6, 0.9], // vertical offsets from the root
  radius: 1,
  hipHeight: 3,
  stepHeight: 1.2,
};

// state: {x,y,z, vx,vy,vz, grounded, groundPart}
// input: {mx, mz (world move direction, unit or zero), jump}
// world: {query(minX,minZ,maxX,maxZ) -> boxes, gravity}
export function stepCharacter(state, input, dt, world, humanoid) {
  const speed = humanoid.WalkSpeed, jumpPower = humanoid.JumpPower;
  const gravity = world.gravity;
  // Horizontal velocity follows input instantly (Roblox-style), with slight smoothing in air.
  const tvx = input.mx * speed, tvz = input.mz * speed;
  const k = state.grounded ? 1 : Math.min(1, dt * 8);
  state.vx += (tvx - state.vx) * k;
  state.vz += (tvz - state.vz) * k;
  if (state.grounded && input.jump && jumpPower > 0) {
    state.vy = jumpPower;
    state.grounded = false;
    state.jumped = true;
  }
  state.vy -= gravity * dt;
  if (state.vy < -250) state.vy = -250;

  // Sub-step to avoid tunnelling through thin parts.
  const dist = Math.hypot(state.vx, state.vy, state.vz) * dt;
  const steps = Math.max(1, Math.ceil(dist / 0.5));
  const sdt = dt / steps;
  let grounded = false, groundPart = null;
  for (let s = 0; s < steps; s++) {
    state.x += state.vx * sdt;
    state.y += state.vy * sdt;
    state.z += state.vz * sdt;
    const r = resolve(state, world);
    if (r.grounded) { grounded = true; groundPart = r.groundPart; }
  }
  // Snap down onto the ground when walking down slopes/steps.
  if (!grounded && state.grounded && state.vy <= 0 && !state.jumped) {
    const saveY = state.y;
    state.y -= 1.1;
    const r = resolve(state, world);
    if (r.grounded) { grounded = true; groundPart = r.groundPart; state.vy = 0; } else state.y = saveY;
  }
  state.grounded = grounded;
  state.groundPart = groundPart;
  if (grounded) { state.jumped = false; if (state.vy < 0) state.vy = 0; }
  return state;
}

function resolve(state, world) {
  const R = CHAR.radius;
  const boxes = world.query(state.x - 3, state.z - 3, state.x + 3, state.z + 3);
  let grounded = false, groundPart = null;
  for (let iter = 0; iter < 4; iter++) {
    let any = false;
    for (let si = 0; si < CHAR.spheres.length; si++) {
      const off = CHAR.spheres[si];
      for (const b of boxes) {
        const hit = sphereVsBox(b, state.x, state.y + off, state.z, R);
        if (!hit) continue;
        any = true;
        let { nx, ny, nz, depth } = hit;
        if (si === 0 && ny > 0.55) {
          // Walkable surface under the feet: push straight up so we don't slide.
          state.y += depth / ny > 2 ? depth : depth / ny;
          grounded = true;
          groundPart = b.part;
          if (state.vy < 0) state.vy = 0;
          continue;
        }
        if (si === 0 && ny <= 0.55 && ny > -0.2 && state.vy <= 1) {
          // Step up small ledges.
          const top = stepTop(b, state);
          if (top !== null && top - (state.y - CHAR.hipHeight) <= CHAR.stepHeight && top - (state.y - CHAR.hipHeight) > 0) {
            state.y = top + CHAR.hipHeight + 0.01;
            grounded = true;
            groundPart = b.part;
            continue;
          }
        }
        state.x += nx * depth;
        state.y += ny * depth;
        state.z += nz * depth;
        const vn = state.vx * nx + state.vy * ny + state.vz * nz;
        if (vn < 0) { state.vx -= vn * nx; state.vy -= vn * ny; state.vz -= vn * nz; }
      }
    }
    if (!any) break;
  }
  return { grounded, groundPart };
}

function stepTop(b, state) {
  // Only axis-aligned-ish boxes: return world Y of the top face if the part is upright.
  if (b.ay[1] < 0.98 || b.shape !== 'Block') return null;
  return b.cy + b.hy;
}
