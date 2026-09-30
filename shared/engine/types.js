// Core value types shared by the server, the game client and Robis Studio.
// They mirror the Roblox 2019 data types closely enough for Lua scripts.

const DEG = Math.PI / 180;

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.X = +x || 0;
    this.Y = +y || 0;
    this.Z = +z || 0;
  }
  static fromArray(a) { return new Vector3(a[0], a[1], a[2]); }
  toArray() { return [this.X, this.Y, this.Z]; }
  add(v) { return new Vector3(this.X + v.X, this.Y + v.Y, this.Z + v.Z); }
  sub(v) { return new Vector3(this.X - v.X, this.Y - v.Y, this.Z - v.Z); }
  mul(v) {
    if (typeof v === 'number') return new Vector3(this.X * v, this.Y * v, this.Z * v);
    return new Vector3(this.X * v.X, this.Y * v.Y, this.Z * v.Z);
  }
  div(v) {
    if (typeof v === 'number') return new Vector3(this.X / v, this.Y / v, this.Z / v);
    return new Vector3(this.X / v.X, this.Y / v.Y, this.Z / v.Z);
  }
  neg() { return new Vector3(-this.X, -this.Y, -this.Z); }
  get Magnitude() { return Math.hypot(this.X, this.Y, this.Z); }
  get Unit() {
    const m = this.Magnitude;
    return m > 0 ? this.div(m) : new Vector3();
  }
  Dot(v) { return this.X * v.X + this.Y * v.Y + this.Z * v.Z; }
  Cross(v) {
    return new Vector3(
      this.Y * v.Z - this.Z * v.Y,
      this.Z * v.X - this.X * v.Z,
      this.X * v.Y - this.Y * v.X,
    );
  }
  Lerp(v, t) { return this.add(v.sub(this).mul(t)); }
  equals(v) { return v instanceof Vector3 && v.X === this.X && v.Y === this.Y && v.Z === this.Z; }
  toString() { return `${fmt(this.X)}, ${fmt(this.Y)}, ${fmt(this.Z)}`; }
}

export class Color3 {
  constructor(r = 0, g = 0, b = 0) {
    this.R = clamp01(+r || 0);
    this.G = clamp01(+g || 0);
    this.B = clamp01(+b || 0);
  }
  static fromRGB(r, g, b) { return new Color3(r / 255, g / 255, b / 255); }
  static fromHex(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16) || 0;
    return Color3.fromRGB((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  static fromHSV(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
    return new Color3(m[0], m[1], m[2]);
  }
  static fromArray(a) { return new Color3(a[0], a[1], a[2]); }
  toArray() { return [this.R, this.G, this.B]; }
  toRGB() { return [Math.round(this.R * 255), Math.round(this.G * 255), Math.round(this.B * 255)]; }
  toHex() { return '#' + this.toRGB().map((c) => c.toString(16).padStart(2, '0')).join(''); }
  Lerp(c, t) {
    return new Color3(this.R + (c.R - this.R) * t, this.G + (c.G - this.G) * t, this.B + (c.B - this.B) * t);
  }
  equals(c) { return c instanceof Color3 && c.R === this.R && c.G === this.G && c.B === this.B; }
  toString() { return this.toRGB().join(', '); }
}

// CFrame = position + 3x3 rotation matrix (row major, like Roblox's components).
export class CFrame {
  constructor(x = 0, y = 0, z = 0, r = null) {
    this.x = +x || 0;
    this.y = +y || 0;
    this.z = +z || 0;
    this.r = r ? r.slice() : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  static fromArray(a) { return new CFrame(a[0], a[1], a[2], a.length >= 12 ? a.slice(3, 12) : null); }
  toArray() { return [this.x, this.y, this.z, ...this.r]; }
  static fromPosition(v) { return new CFrame(v.X, v.Y, v.Z); }

  // CFrame.new(pos, lookAt)
  static lookAt(pos, target, up = new Vector3(0, 1, 0)) {
    let look = target.sub(pos).Unit;
    if (look.Magnitude === 0) return CFrame.fromPosition(pos);
    let right = look.Cross(up).Unit;
    if (right.Magnitude === 0) right = new Vector3(1, 0, 0);
    const upv = right.Cross(look);
    // columns: right, up, back(-look)
    return new CFrame(pos.X, pos.Y, pos.Z, [
      right.X, upv.X, -look.X,
      right.Y, upv.Y, -look.Y,
      right.Z, upv.Z, -look.Z,
    ]);
  }

  // Rotation about X then Y then Z (Roblox CFrame.Angles, radians).
  static Angles(rx = 0, ry = 0, rz = 0) {
    return CFrame.fromRotMatrix(mulMat(mulMat(rotX(rx), rotY(ry)), rotZ(rz)));
  }
  // Roblox Orientation (degrees) = rotation applied in Y, X, Z order.
  static fromOrientation(ox = 0, oy = 0, oz = 0) {
    return CFrame.fromRotMatrix(mulMat(mulMat(rotY(oy * DEG), rotX(ox * DEG)), rotZ(oz * DEG)));
  }
  static fromRotMatrix(m) { return new CFrame(0, 0, 0, m); }
  static fromAxisAngle(axis, angle) {
    const a = axis.Unit, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const { X: x, Y: y, Z: z } = a;
    return CFrame.fromRotMatrix([
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c,
    ]);
  }

  get Position() { return new Vector3(this.x, this.y, this.z); }
  get p() { return this.Position; }
  get X() { return this.x; }
  get Y() { return this.y; }
  get Z() { return this.z; }
  get RightVector() { return new Vector3(this.r[0], this.r[3], this.r[6]); }
  get UpVector() { return new Vector3(this.r[1], this.r[4], this.r[7]); }
  get LookVector() { return new Vector3(-this.r[2], -this.r[5], -this.r[8]); }
  get Rotation() { return new CFrame(0, 0, 0, this.r); }

  mul(o) {
    if (o instanceof CFrame) {
      const r = mulMat(this.r, o.r);
      const p = this.pointToWorldSpace(new Vector3(o.x, o.y, o.z));
      return new CFrame(p.X, p.Y, p.Z, r);
    }
    if (o instanceof Vector3) return this.pointToWorldSpace(o);
    throw new TypeError('CFrame can only be multiplied by CFrame or Vector3');
  }
  add(v) { return new CFrame(this.x + v.X, this.y + v.Y, this.z + v.Z, this.r); }
  sub(v) { return new CFrame(this.x - v.X, this.y - v.Y, this.z - v.Z, this.r); }

  Inverse() {
    const r = this.r;
    const t = [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
    const inv = new CFrame(0, 0, 0, t);
    const p = inv.vectorToWorldSpace(new Vector3(this.x, this.y, this.z));
    inv.x = -p.X; inv.y = -p.Y; inv.z = -p.Z;
    return inv;
  }
  pointToWorldSpace(v) {
    const r = this.r;
    return new Vector3(
      this.x + r[0] * v.X + r[1] * v.Y + r[2] * v.Z,
      this.y + r[3] * v.X + r[4] * v.Y + r[5] * v.Z,
      this.z + r[6] * v.X + r[7] * v.Y + r[8] * v.Z,
    );
  }
  vectorToWorldSpace(v) {
    const r = this.r;
    return new Vector3(
      r[0] * v.X + r[1] * v.Y + r[2] * v.Z,
      r[3] * v.X + r[4] * v.Y + r[5] * v.Z,
      r[6] * v.X + r[7] * v.Y + r[8] * v.Z,
    );
  }
  pointToObjectSpace(v) { return this.Inverse().pointToWorldSpace(v); }
  vectorToObjectSpace(v) { return this.Inverse().vectorToWorldSpace(v); }
  toWorldSpace(cf) { return this.mul(cf); }
  toObjectSpace(cf) { return this.Inverse().mul(cf); }

  // Returns Roblox Orientation in degrees (Y-X-Z order).
  toOrientation() {
    const r = this.r;
    const sx = clamp(-r[5], -1, 1);
    const x = Math.asin(sx);
    let y, z;
    if (Math.abs(sx) < 0.99999) {
      y = Math.atan2(r[2], r[8]);
      z = Math.atan2(r[3], r[4]);
    } else {
      y = Math.atan2(-r[6], r[0]);
      z = 0;
    }
    return new Vector3(round6(x / DEG), round6(y / DEG), round6(z / DEG));
  }
  toEulerAnglesXYZ() {
    const r = this.r;
    const y = Math.asin(clamp(r[2], -1, 1));
    let x, z;
    if (Math.abs(r[2]) < 0.99999) {
      x = Math.atan2(-r[5], r[8]);
      z = Math.atan2(-r[1], r[0]);
    } else {
      x = Math.atan2(r[7], r[4]);
      z = 0;
    }
    return [x, y, z];
  }
  toQuaternion() {
    const m = this.r;
    const tr = m[0] + m[4] + m[8];
    let x, y, z, w;
    if (tr > 0) {
      const s = 0.5 / Math.sqrt(tr + 1);
      w = 0.25 / s; x = (m[7] - m[5]) * s; y = (m[2] - m[6]) * s; z = (m[3] - m[1]) * s;
    } else if (m[0] > m[4] && m[0] > m[8]) {
      const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
      w = (m[7] - m[5]) / s; x = 0.25 * s; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s;
    } else if (m[4] > m[8]) {
      const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
      w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = 0.25 * s; z = (m[5] + m[7]) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
      w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = 0.25 * s;
    }
    return [x, y, z, w];
  }
  static fromQuaternion(x, y, z, w) {
    const n = Math.hypot(x, y, z, w) || 1;
    x /= n; y /= n; z /= n; w /= n;
    return CFrame.fromRotMatrix([
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ]);
  }
  Lerp(o, t) {
    const a = this.toQuaternion(), b = o.toQuaternion();
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (dot < 0) { for (let i = 0; i < 4; i++) b[i] = -b[i]; dot = -dot; }
    let q;
    if (dot > 0.9995) {
      q = a.map((v, i) => v + (b[i] - v) * t);
    } else {
      const th = Math.acos(dot), s = Math.sin(th);
      const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      q = a.map((v, i) => v * wa + b[i] * wb);
    }
    const cf = CFrame.fromQuaternion(q[0], q[1], q[2], q[3]);
    cf.x = this.x + (o.x - this.x) * t;
    cf.y = this.y + (o.y - this.y) * t;
    cf.z = this.z + (o.z - this.z) * t;
    return cf;
  }
  equals(o) {
    return o instanceof CFrame && o.x === this.x && o.y === this.y && o.z === this.z && o.r.every((v, i) => v === this.r[i]);
  }
  toString() { return this.toArray().map(fmt).join(', '); }
}

// A subset of the classic BrickColor palette.
export const BRICK_COLORS = [
  [1, 'White', 242, 243, 243], [194, 'Medium stone grey', 163, 162, 165], [199, 'Dark stone grey', 99, 95, 98],
  [26, 'Black', 27, 42, 53], [1003, 'Really black', 17, 17, 17], [1001, 'Institutional white', 248, 248, 248],
  [21, 'Bright red', 196, 40, 28], [1004, 'Really red', 255, 0, 0], [23, 'Bright blue', 13, 105, 172],
  [1010, 'Really blue', 0, 0, 255], [24, 'Bright yellow', 245, 205, 48], [1009, 'New Yeller', 255, 255, 0],
  [37, 'Bright green', 75, 151, 75], [1020, 'Lime green', 0, 255, 0], [28, 'Dark green', 40, 127, 71],
  [141, 'Earth green', 39, 70, 45], [106, 'Bright orange', 218, 133, 65], [1005, 'Deep orange', 255, 176, 0],
  [192, 'Reddish brown', 105, 64, 40], [217, 'Brown', 124, 92, 70], [18, 'Nougat', 204, 142, 105],
  [5, 'Brick yellow', 215, 197, 154], [1030, 'Pastel brown', 255, 204, 153], [125, 'Light orange', 234, 184, 146],
  [102, 'Medium blue', 110, 153, 202], [1019, 'Toothpaste', 0, 255, 255], [1013, 'Cyan', 4, 175, 236],
  [45, 'Light blue', 180, 210, 228], [1024, 'Pastel light blue', 175, 221, 255], [1011, 'Navy blue', 0, 32, 96],
  [104, 'Bright violet', 107, 50, 124], [1015, 'Magenta', 170, 0, 170], [1016, 'Pink', 255, 102, 204],
  [1032, 'Hot pink', 255, 0, 191], [1026, 'Lavender', 177, 167, 255], [119, 'Br. yellowish green', 164, 189, 71],
  [1021, 'Camo', 58, 125, 21], [151, 'Sand green', 120, 144, 130], [1025, 'Pastel green', 204, 255, 204],
  [38, 'Dark orange', 160, 95, 53], [1014, 'CGA brown', 170, 85, 0], [1007, 'Dusty Rose', 163, 75, 75],
  [1002, 'Mid gray', 205, 205, 205], [1022, 'Grime', 127, 142, 100], [1018, 'Teal', 18, 238, 212],
  [1017, 'Deep blue', 0, 16, 176], [1027, 'Pastel yellow', 255, 255, 204], [1008, 'Olive', 193, 190, 66],
  [1031, 'Royal purple', 98, 37, 209], [1029, 'Pastel violet', 255, 204, 255],
];

export class BrickColor {
  constructor(entry) {
    this.Number = entry[0];
    this.Name = entry[1];
    this.Color = Color3.fromRGB(entry[2], entry[3], entry[4]);
  }
  get r() { return this.Color.R; }
  get g() { return this.Color.G; }
  get b() { return this.Color.B; }
  static new(v, g, b) {
    if (typeof v === 'number' && g !== undefined) return BrickColor.fromColor3(new Color3(v, g, b));
    if (v instanceof Color3) return BrickColor.fromColor3(v);
    const e = BRICK_COLORS.find((c) => c[1] === v || c[0] === v);
    return new BrickColor(e || BRICK_COLORS[1]);
  }
  static fromColor3(c) {
    let best = BRICK_COLORS[0], bd = Infinity;
    const [r, g, b] = c.toRGB();
    for (const e of BRICK_COLORS) {
      const d = (e[2] - r) ** 2 + (e[3] - g) ** 2 + (e[4] - b) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return new BrickColor(best);
  }
  static random() { return new BrickColor(BRICK_COLORS[Math.floor(Math.random() * BRICK_COLORS.length)]); }
  static Red() { return BrickColor.new('Bright red'); }
  static Blue() { return BrickColor.new('Bright blue'); }
  static Green() { return BrickColor.new('Bright green'); }
  static Yellow() { return BrickColor.new('Bright yellow'); }
  static White() { return BrickColor.new('White'); }
  static Black() { return BrickColor.new('Black'); }
  static Gray() { return BrickColor.new('Medium stone grey'); }
  equals(o) { return o instanceof BrickColor && o.Number === this.Number; }
  toString() { return this.Name; }
}

// Enums — stored as string names on instances, exposed to Lua as EnumItems.
export const ENUMS = {
  Material: ['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Marble', 'Slate', 'Concrete', 'Granite',
    'Brick', 'Pebble', 'Cobblestone', 'CorrodedMetal', 'DiamondPlate', 'Foil', 'Metal', 'Grass', 'Sand', 'Fabric',
    'Ice', 'Glass', 'ForceField'],
  PartType: ['Ball', 'Block', 'Cylinder'],
  SurfaceType: ['Smooth', 'Studs', 'Inlet', 'Universal'],
  EasingStyle: ['Linear', 'Sine', 'Back', 'Quad', 'Quart', 'Quint', 'Bounce', 'Elastic', 'Exponential', 'Circular', 'Cubic'],
  EasingDirection: ['In', 'Out', 'InOut'],
  PlaybackState: ['Begin', 'Delayed', 'Playing', 'Paused', 'Completed', 'Cancelled'],
  HumanoidStateType: ['Running', 'Jumping', 'Freefall', 'Landed', 'Dead', 'Seated', 'Climbing', 'Physics'],
  KeyCode: ['Unknown'],
};

export class EnumItem {
  constructor(type, name) {
    this.EnumType = type;
    this.Name = name;
    this.Value = ENUMS[type].indexOf(name);
  }
  toString() { return `Enum.${this.EnumType}.${this.Name}`; }
}

const enumCache = {};
export function enumItem(type, name) {
  const key = type + '.' + name;
  return enumCache[key] || (enumCache[key] = new EnumItem(type, name));
}

export class UDim2 {
  constructor(xs = 0, xo = 0, ys = 0, yo = 0) {
    this.X = { Scale: +xs || 0, Offset: +xo || 0 };
    this.Y = { Scale: +ys || 0, Offset: +yo || 0 };
  }
  toArray() { return [this.X.Scale, this.X.Offset, this.Y.Scale, this.Y.Offset]; }
  static fromArray(a) { return new UDim2(a[0], a[1], a[2], a[3]); }
  equals(o) { return o instanceof UDim2 && this.toArray().every((v, i) => v === o.toArray()[i]); }
  toString() { return `{${this.X.Scale}, ${this.X.Offset}}, {${this.Y.Scale}, ${this.Y.Offset}}`; }
}

export class TweenInfo {
  constructor(time = 1, style = 'Quad', direction = 'Out', repeatCount = 0, reverses = false, delay = 0) {
    this.Time = +time;
    this.EasingStyle = style instanceof EnumItem ? style.Name : String(style);
    this.EasingDirection = direction instanceof EnumItem ? direction.Name : String(direction);
    this.RepeatCount = repeatCount | 0;
    this.Reverses = !!reverses;
    this.DelayTime = +delay || 0;
  }
}

// ---- helpers ----
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
export function mulMat(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return o;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function clamp01(v) { return clamp(v, 0, 1); }
function round6(v) { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; }
export function fmt(n) {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}
