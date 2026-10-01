// The Robis instance tree (DataModel). The same classes run in the game server
// (with Lua scripts), in the game client (as a replicated mirror) and in Studio.
import { Vector3, Color3, CFrame, BrickColor, EnumItem, ENUMS, UDim2, enumItem } from './types.js';

const ID_PREFIX = Math.random().toString(36).slice(2, 6);
let idCounter = 0;
export function newId() { return ID_PREFIX + (++idCounter).toString(36); }

export const CLASSES = Object.create(null);

// ---------------------------------------------------------------- Signal
export class Signal {
  constructor(name = 'Event') {
    this.name = name;
    this.handlers = [];
    this.waiters = [];
  }
  Connect(fn) {
    const conn = new Connection(this, fn);
    this.handlers.push(conn);
    return conn;
  }
  connect(fn) { return this.Connect(fn); }
  fire(...args) {
    const waiters = this.waiters;
    if (waiters.length) {
      this.waiters = [];
      for (const w of waiters) w(...args);
    }
    for (const c of this.handlers.slice()) {
      if (!c.Connected) continue;
      try { c.fn(...args); } catch (e) { reportError(e); }
    }
  }
  // Used by the Lua runtime for :Wait().
  once(fn) { this.waiters.push(fn); }
  disconnectAll() {
    for (const c of this.handlers) c.Connected = false;
    this.handlers = [];
    this.waiters = [];
  }
  toString() { return 'Signal ' + this.name; }
}

export class Connection {
  constructor(signal, fn) { this.signal = signal; this.fn = fn; this.Connected = true; }
  Disconnect() {
    this.Connected = false;
    const i = this.signal.handlers.indexOf(this);
    if (i >= 0) this.signal.handlers.splice(i, 1);
  }
  disconnect() { this.Disconnect(); }
  toString() { return 'Connection'; }
}

let errorReporter = (e) => console.error(e);
export function setErrorReporter(fn) { errorReporter = fn; }
function reportError(e) { errorReporter(e); }

// ---------------------------------------------------------------- property coercion
export function coerce(type, v) {
  if (type === 'string') return v == null ? '' : String(v);
  if (type === 'number') { const n = +v; return Number.isFinite(n) ? n : 0; }
  if (type === 'int') { const n = Math.trunc(+v); return Number.isFinite(n) ? n : 0; }
  if (type === 'bool') return !!v;
  if (type === 'Vector3') {
    if (v instanceof Vector3) return v;
    if (Array.isArray(v)) return Vector3.fromArray(v);
    throw new TypeError('Vector3 expected');
  }
  if (type === 'Color3') {
    if (v instanceof Color3) return v;
    if (v instanceof BrickColor) return v.Color;
    if (Array.isArray(v)) return Color3.fromArray(v);
    if (typeof v === 'string') return Color3.fromHex(v);
    throw new TypeError('Color3 expected');
  }
  if (type === 'CFrame') {
    if (v instanceof CFrame) return v;
    if (Array.isArray(v)) return CFrame.fromArray(v);
    throw new TypeError('CFrame expected');
  }
  if (type === 'UDim2') {
    if (v instanceof UDim2) return v;
    if (Array.isArray(v)) return UDim2.fromArray(v);
    throw new TypeError('UDim2 expected');
  }
  if (type === 'ref') {
    if (v == null) return null;
    if (v instanceof Instance) return v;
    throw new TypeError('Instance expected');
  }
  if (type.startsWith('enum:')) {
    const et = type.slice(5);
    if (v instanceof EnumItem) v = v.Name;
    if (typeof v === 'number') v = ENUMS[et][v];
    if (!ENUMS[et].includes(v)) throw new TypeError(`Invalid value for Enum.${et}`);
    return v;
  }
  return v;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a && typeof a.equals === 'function') return a.equals(b);
  return false;
}

// ---------------------------------------------------------------- Instance
export class Instance {
  constructor() {
    this.id = newId();
    this._p = Object.create(null);
    this._children = [];
    this._parent = null;
    this._signals = null;
    this._destroyed = false;
    this._parentLocked = false;
    const schema = this.constructor.schema;
    for (const k in schema) {
      const d = schema[k];
      if (!d.derived) this._p[k] = d.default;
    }
    this._p.Name = this.constructor.className;
  }

  get ClassName() { return this.constructor.className; }
  get Name() { return this._p.Name; }
  set Name(v) { this._set('Name', String(v)); }
  get Parent() { return this._parent; }
  set Parent(p) { this.setParent(p); }
  get Archivable() { return this._p.Archivable !== false; }
  set Archivable(v) { this._p.Archivable = !!v; }

  setParent(p) {
    if (p === this._parent) return;
    if (this._parentLocked) {
      throw new Error(`The Parent property of ${this.Name} is locked, current parent: NULL, new parent ${p ? p.Name : 'NULL'}`);
    }
    if (p !== null && p !== undefined && !(p instanceof Instance)) throw new TypeError('Parent must be an Instance');
    if (p) {
      for (let a = p; a; a = a._parent) {
        if (a === this) throw new Error(`Attempt to set parent of ${this.getFullName()} to ${p.getFullName()} would result in circular reference`);
      }
      if (p._destroyed) throw new Error('The Parent property of ' + p.Name + ' is locked');
    }
    const old = this._parent;
    const oldRoot = old ? old.getRoot() : null;
    if (old) {
      if (oldRoot._hooks) oldRoot._emitRemoving(this);
      const i = old._children.indexOf(this);
      if (i >= 0) old._children.splice(i, 1);
      for (let a = old; a; a = a._parent) a._fire('DescendantRemoving', this);
      old._fire('ChildRemoved', this);
    }
    this._parent = p || null;
    if (p) {
      p._children.push(this);
      p._fire('ChildAdded', this);
      for (let a = p; a; a = a._parent) a._fire('DescendantAdded', this);
    }
    this._fireAncestry(this, this._parent);
    this._fire('Changed', 'Parent');
    const newRoot = p ? p.getRoot() : null;
    if (newRoot && newRoot._hooks) newRoot._emitAdded(this);
  }

  _fireAncestry(child, parent) {
    this._fire('AncestryChanged', child, parent);
    for (const c of this._children) c._fireAncestry(child, parent);
  }

  getRoot() {
    let a = this;
    while (a._parent) a = a._parent;
    return a;
  }

  _set(k, v) {
    const old = this._p[k];
    if (valuesEqual(old, v)) return;
    this._p[k] = v;
    this._changed(k);
  }

  _changed(k) {
    if (this._signals) {
      const ps = this._signals['prop:' + k];
      if (ps) ps.fire();
      this._fireChanged(k);
    }
    const root = this.getRoot();
    if (root._hooks) root._emitChanged(this, k);
  }
  _fireChanged(k) { this._fire('Changed', k); }

  _fire(name, ...args) {
    if (this._signals && this._signals[name]) this._signals[name].fire(...args);
  }

  getSignal(name) {
    if (!this._signals) this._signals = Object.create(null);
    return this._signals[name] || (this._signals[name] = new Signal(name));
  }

  hasEvent(name) { return this.constructor.events.includes(name); }

  // ---- Lua-visible methods (PascalCase) ----
  GetChildren() { return this._children.slice(); }
  getChildren() { return this.GetChildren(); }
  GetDescendants() {
    const out = [];
    const walk = (i) => { for (const c of i._children) { out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  FindFirstChild(name, recursive = false) {
    name = String(name);
    for (const c of this._children) if (c._p.Name === name) return c;
    if (recursive) {
      for (const c of this._children) {
        const f = c.FindFirstChild(name, true);
        if (f) return f;
      }
    }
    return null;
  }
  findFirstChild(name, r) { return this.FindFirstChild(name, r); }
  FindFirstChildOfClass(cls) {
    for (const c of this._children) if (c.ClassName === cls) return c;
    return null;
  }
  FindFirstChildWhichIsA(cls, recursive = false) {
    for (const c of this._children) if (c.IsA(cls)) return c;
    if (recursive) for (const c of this._children) { const f = c.FindFirstChildWhichIsA(cls, true); if (f) return f; }
    return null;
  }
  FindFirstAncestor(name) {
    for (let a = this._parent; a; a = a._parent) if (a.Name === name) return a;
    return null;
  }
  FindFirstAncestorOfClass(cls) {
    for (let a = this._parent; a; a = a._parent) if (a.ClassName === cls) return a;
    return null;
  }
  FindFirstAncestorWhichIsA(cls) {
    for (let a = this._parent; a; a = a._parent) if (a.IsA(cls)) return a;
    return null;
  }
  IsA(cls) {
    for (let c = this.constructor; c && c.className; c = Object.getPrototypeOf(c)) {
      if (c.className === cls) return true;
    }
    return false;
  }
  isA(cls) { return this.IsA(cls); }
  IsDescendantOf(anc) {
    for (let a = this._parent; a; a = a._parent) if (a === anc) return true;
    return false;
  }
  IsAncestorOf(d) { return d instanceof Instance && d.IsDescendantOf(this); }
  GetFullName() { return this.getFullName(); }
  getFullName() {
    const parts = [];
    for (let a = this; a && !(a instanceof DataModel); a = a._parent) parts.unshift(a.Name);
    return parts.join('.');
  }
  ClearAllChildren() { for (const c of this._children.slice()) c.Destroy(); }
  Destroy() {
    if (this._destroyed) return;
    this.setParent(null);
    this._destroyed = true;
    this._parentLocked = true;
    for (const c of this._children.slice()) c.Destroy();
    if (this._signals) {
      const sig = this._signals;
      this._signals = null;
      for (const k in sig) sig[k].disconnectAll();
    }
  }
  destroy() { this.Destroy(); }
  Remove() { this.setParent(null); }
  remove() { this.Remove(); }
  Clone() {
    if (!this.Archivable) return null;
    const map = new Map();
    const copy = cloneTree(this, map);
    // Re-point refs that stay inside the cloned subtree.
    for (const [orig, cl] of map) {
      const schema = orig.constructor.schema;
      for (const k in schema) {
        if (schema[k].type === 'ref' && orig._p[k] && map.has(orig._p[k])) cl._p[k] = map.get(orig._p[k]);
      }
    }
    return copy;
  }
  clone() { return this.Clone(); }
  GetPropertyChangedSignal(prop) { return this.getSignal('prop:' + prop); }
  WaitForChild(name) { return this.FindFirstChild(name); } // Lua runtime overrides with yielding version
  toString() { return this.Name; }
}

function cloneTree(src, map) {
  const C = src.constructor;
  const inst = new C();
  for (const k in src._p) inst._p[k] = src._p[k];
  map.set(src, inst);
  for (const c of src._children) {
    if (!c.Archivable) continue;
    const cc = cloneTree(c, map);
    cc._parent = inst;
    inst._children.push(cc);
  }
  return inst;
}

// ---------------------------------------------------------------- class definition helper
Instance.className = 'Instance';
Instance.schema = { Name: { type: 'string', default: 'Instance', cat: 'Data' } };
Instance.events = ['Changed', 'ChildAdded', 'ChildRemoved', 'DescendantAdded', 'DescendantRemoving', 'AncestryChanged'];
Instance.creatable = false;
CLASSES.Instance = Instance;

export function defineClass(name, Base, opts = {}) {
  const C = opts.cls || class extends Base {};
  Object.defineProperty(C, 'name', { value: name });
  C.className = name;
  C.schema = Object.assign(Object.create(null), Base.schema, opts.props || {});
  C.events = Base.events.concat(opts.events || []);
  C.creatable = opts.creatable !== false;
  C.service = !!opts.service;
  C.icon = opts.icon || Base.icon || 'instance';
  C.category = opts.category || Base.category || 'Other';
  for (const [k, d] of Object.entries(opts.props || {})) {
    if (d.derived || Object.getOwnPropertyDescriptor(C.prototype, k)) continue;
    Object.defineProperty(C.prototype, k, {
      get() { return this._p[k]; },
      set(v) { this._set(k, coerce(d.type, v)); },
      configurable: true,
    });
  }
  for (const ev of opts.events || []) {
    if (Object.getOwnPropertyDescriptor(C.prototype, ev)) continue;
    Object.defineProperty(C.prototype, ev, { get() { return this.getSignal(ev); }, configurable: true });
  }
  CLASSES[name] = C;
  return C;
}

for (const ev of Instance.events) {
  Object.defineProperty(Instance.prototype, ev, { get() { return this.getSignal(ev); }, configurable: true });
}

// ---------------------------------------------------------------- BasePart & friends
const V = (x, y, z) => new Vector3(x, y, z);
const C3 = (r, g, b) => Color3.fromRGB(r, g, b);

class BasePartImpl extends Instance {
  get Position() { return this._p.CFrame.Position; }
  set Position(v) {
    v = coerce('Vector3', v);
    const cf = this._p.CFrame;
    this._set('CFrame', new CFrame(v.X, v.Y, v.Z, cf.r));
  }
  get Orientation() { return this._p.CFrame.toOrientation(); }
  set Orientation(v) {
    v = coerce('Vector3', v);
    const cf = this._p.CFrame;
    const r = CFrame.fromOrientation(v.X, v.Y, v.Z);
    r.x = cf.x; r.y = cf.y; r.z = cf.z;
    this._set('CFrame', r);
  }
  get Rotation() {
    const [x, y, z] = this._p.CFrame.toEulerAnglesXYZ();
    const d = 180 / Math.PI;
    return V(x * d, y * d, z * d);
  }
  set Rotation(v) {
    v = coerce('Vector3', v);
    const d = Math.PI / 180;
    const cf = this._p.CFrame;
    const r = CFrame.Angles(v.X * d, v.Y * d, v.Z * d);
    r.x = cf.x; r.y = cf.y; r.z = cf.z;
    this._set('CFrame', r);
  }
  get BrickColor() { return BrickColor.fromColor3(this._p.Color); }
  set BrickColor(v) {
    if (typeof v === 'string' || typeof v === 'number') v = BrickColor.new(v);
    if (!(v instanceof BrickColor)) throw new TypeError('BrickColor expected');
    this._set('Color', v.Color);
  }
  get Size() { return this._p.Size; }
  set Size(v) {
    v = coerce('Vector3', v);
    const min = this.constructor.minSize || 0.05;
    const clamped = V(Math.max(min, Math.min(2048, v.X)), Math.max(min, Math.min(2048, v.Y)), Math.max(min, Math.min(2048, v.Z)));
    this._set('Size', clamped);
  }
  get AssemblyLinearVelocity() { return this._p.Velocity; }
  set AssemblyLinearVelocity(v) { this.Velocity = v; }
  BreakJoints() { this.getRoot()._breakJoints && this.getRoot()._breakJoints(this); }
  GetMass() { const s = this._p.Size; return s.X * s.Y * s.Z * 0.7; }
  GetTouchingParts() {
    const root = this.getRoot();
    return root._getTouchingParts ? root._getTouchingParts(this) : [];
  }
}

export const BasePart = defineClass('BasePart', Instance, {
  cls: BasePartImpl,
  creatable: false,
  icon: 'part',
  category: 'Parts',
  props: {
    CFrame: { type: 'CFrame', default: new CFrame(0, 0.5, 0), cat: 'Data', hidden: true },
    Position: { type: 'Vector3', derived: true, cat: 'Data' },
    Orientation: { type: 'Vector3', derived: true, cat: 'Data' },
    Rotation: { type: 'Vector3', derived: true, cat: 'Data', hidden: true },
    Size: { type: 'Vector3', default: V(4, 1, 2), cat: 'Part' },
    Color: { type: 'Color3', default: C3(163, 162, 165), cat: 'Appearance' },
    BrickColor: { type: 'BrickColor', derived: true, cat: 'Appearance' },
    Material: { type: 'enum:Material', default: 'Plastic', cat: 'Appearance' },
    Transparency: { type: 'number', default: 0, cat: 'Appearance', min: 0, max: 1 },
    Reflectance: { type: 'number', default: 0, cat: 'Appearance', min: 0, max: 1 },
    TopSurface: { type: 'enum:SurfaceType', default: 'Smooth', cat: 'Surface' },
    BottomSurface: { type: 'enum:SurfaceType', default: 'Smooth', cat: 'Surface' },
    Anchored: { type: 'bool', default: false, cat: 'Behavior' },
    CanCollide: { type: 'bool', default: true, cat: 'Behavior' },
    CanTouch: { type: 'bool', default: true, cat: 'Behavior', hidden: true },
    Locked: { type: 'bool', default: false, cat: 'Behavior' },
    CastShadow: { type: 'bool', default: true, cat: 'Appearance' },
    Velocity: { type: 'Vector3', default: V(0, 0, 0), cat: 'Assembly', hidden: true },
  },
  events: ['Touched', 'TouchEnded'],
});

export const Part = defineClass('Part', BasePart, {
  props: { Shape: { type: 'enum:PartType', default: 'Block', cat: 'Part' } },
  icon: 'part',
});
export const WedgePart = defineClass('WedgePart', BasePart, { icon: 'wedge' });
export const CornerWedgePart = defineClass('CornerWedgePart', BasePart, { icon: 'wedge', creatable: true });
export const TrussPart = defineClass('TrussPart', BasePart, { icon: 'truss' });
export const SpawnLocation = defineClass('SpawnLocation', Part, {
  icon: 'spawn',
  props: {
    Enabled: { type: 'bool', default: true, cat: 'Behavior' },
    Neutral: { type: 'bool', default: true, cat: 'Teams' },
    TeamColor: { type: 'Color3', default: C3(255, 255, 255), cat: 'Teams' },
    Duration: { type: 'number', default: 10, cat: 'Forcefield' },
  },
});
export const Seat = defineClass('Seat', Part, {
  icon: 'seat',
  props: { Disabled: { type: 'bool', default: false, cat: 'Behavior' } },
});
// Touch it to drive: the player steers with WASD (or the joystick), Space gets out.
// The whole Model it's in rides along (it's hidden while driven, and put back where you get out).
export const VehicleSeat = defineClass('VehicleSeat', Seat, {
  cls: class extends Seat {
    // Puts a player's character in the driver's seat (like Seat:Sit on Roblox).
    Sit(humanoid) {
      const r = this.getRoot();
      return !!(r && r._sit && humanoid && r._sit(this, humanoid));
    }
  },
  icon: 'seat',
  props: {
    MaxSpeed: { type: 'number', default: 60, cat: 'Behavior' },
    TurnSpeed: { type: 'number', default: 2.2, cat: 'Behavior' },
  },
  events: ['Entered', 'Exited'],
});

// ---------------------------------------------------------------- containers
class ModelImpl extends Instance {
  GetModelCFrame() {
    const b = this.GetBoundingBox();
    return b[0];
  }
  GetBoundingBox() {
    const parts = this.GetDescendants().filter((d) => d instanceof BasePart);
    if (!parts.length) return [new CFrame(), V(0, 0, 0)];
    let min = V(Infinity, Infinity, Infinity), max = V(-Infinity, -Infinity, -Infinity);
    for (const p of parts) {
      const [a, b] = partAABB(p);
      min = V(Math.min(min.X, a.X), Math.min(min.Y, a.Y), Math.min(min.Z, a.Z));
      max = V(Math.max(max.X, b.X), Math.max(max.Y, b.Y), Math.max(max.Z, b.Z));
    }
    const c = min.add(max).mul(0.5);
    return [new CFrame(c.X, c.Y, c.Z), max.sub(min)];
  }
  GetExtentsSize() { return this.GetBoundingBox()[1]; }
  GetPrimaryPartCFrame() {
    return this._p.PrimaryPart ? this._p.PrimaryPart.CFrame : this.GetModelCFrame();
  }
  GetPivot() { return this.GetPrimaryPartCFrame(); }
  SetPrimaryPartCFrame(cf) {
    const from = this.GetPrimaryPartCFrame();
    const delta = cf.mul(from.Inverse());
    for (const p of this.GetDescendants()) if (p instanceof BasePart) p.CFrame = delta.mul(p.CFrame);
  }
  PivotTo(cf) { this.SetPrimaryPartCFrame(cf); }
  MoveTo(pos) {
    const cur = this.GetPrimaryPartCFrame();
    const root = this.getRoot();
    if (root._moveCharacter && root._moveCharacter(this, pos)) return;
    this.TranslateBy(pos.sub(cur.Position));
  }
  TranslateBy(d) {
    for (const p of this.GetDescendants()) if (p instanceof BasePart) p.Position = p.Position.add(d);
  }
  BreakJoints() { this.getRoot()._breakJoints && this.getRoot()._breakJoints(this); }
  MakeJoints() {}
}
// Tools: put them in StarterPack (everyone gets them on spawn) or a player's
// Backpack. Players equip them from the hotbar (keys 1-9) and click to use:
// Activated fires with the Vector3 the player aimed at.
export const Tool = defineClass('Tool', Instance, {
  icon: 'tool',
  props: {
    ToolModel: { type: 'string', default: 'sword', cat: 'Appearance' },
    Color: { type: 'Color3', default: C3(163, 162, 165), cat: 'Appearance' },
    ToolTip: { type: 'string', default: '', cat: 'Data' },
    Automatic: { type: 'bool', default: false, cat: 'Behavior' },
    Enabled: { type: 'bool', default: true, cat: 'Behavior' },
  },
  events: ['Activated', 'Equipped', 'Unequipped'],
});
export const Backpack = defineClass('Backpack', Instance, { icon: 'folder', creatable: false });

export const Model = defineClass('Model', Instance, {
  cls: ModelImpl,
  icon: 'model',
  props: { PrimaryPart: { type: 'ref', default: null, cat: 'Data' } },
});
export const Folder = defineClass('Folder', Instance, { icon: 'folder' });
export const Configuration = defineClass('Configuration', Instance, { icon: 'config' });

// ---------------------------------------------------------------- scripts
export const BaseScript = defineClass('BaseScript', Instance, {
  creatable: false,
  icon: 'script',
  category: 'Scripts',
  props: {
    Disabled: { type: 'bool', default: false, cat: 'Behavior' },
    Source: { type: 'string', default: 'print("Hello world!")\n', hidden: true, noReplicate: true },
  },
});
export const Script = defineClass('Script', BaseScript, { icon: 'script' });
export const LocalScript = defineClass('LocalScript', BaseScript, { icon: 'localscript' });
export const ModuleScript = defineClass('ModuleScript', Instance, {
  icon: 'module',
  category: 'Scripts',
  props: {
    Source: { type: 'string', default: 'local module = {}\n\nreturn module\n', hidden: true, noReplicate: true },
  },
});

// ---------------------------------------------------------------- values
function defineValue(name, type, def) {
  class ValueImpl extends Instance {
    _fireChanged(k) { if (k === 'Value') this._fire('Changed', this._p.Value); else if (k !== 'Value') this._fire('Changed', k); }
  }
  return defineClass(name, Instance, {
    cls: ValueImpl,
    icon: 'value',
    category: 'Values',
    props: { Value: { type, default: def, cat: 'Data' } },
  });
}
export const IntValue = defineValue('IntValue', 'int', 0);
export const NumberValue = defineValue('NumberValue', 'number', 0);
export const StringValue = defineValue('StringValue', 'string', '');
export const BoolValue = defineValue('BoolValue', 'bool', false);
export const ObjectValue = defineValue('ObjectValue', 'ref', null);
export const Vector3Value = defineValue('Vector3Value', 'Vector3', V(0, 0, 0));
export const Color3Value = defineValue('Color3Value', 'Color3', C3(255, 255, 255));

// ---------------------------------------------------------------- effects & misc
export const PointLight = defineClass('PointLight', Instance, {
  icon: 'light',
  category: 'Lights',
  props: {
    Brightness: { type: 'number', default: 1, cat: 'Appearance' },
    Color: { type: 'Color3', default: C3(255, 255, 255), cat: 'Appearance' },
    Range: { type: 'number', default: 8, cat: 'Appearance' },
    Enabled: { type: 'bool', default: true, cat: 'Appearance' },
    Shadows: { type: 'bool', default: false, cat: 'Appearance' },
  },
});
export const SpotLight = defineClass('SpotLight', Instance, {
  icon: 'light',
  category: 'Lights',
  props: {
    Brightness: { type: 'number', default: 1, cat: 'Appearance' },
    Color: { type: 'Color3', default: C3(255, 255, 255), cat: 'Appearance' },
    Range: { type: 'number', default: 16, cat: 'Appearance' },
    Angle: { type: 'number', default: 90, cat: 'Appearance' },
    Enabled: { type: 'bool', default: true, cat: 'Appearance' },
  },
});
export const Fire = defineClass('Fire', Instance, {
  icon: 'fire',
  category: 'Effects',
  props: {
    Color: { type: 'Color3', default: C3(236, 139, 70), cat: 'Appearance' },
    SecondaryColor: { type: 'Color3', default: C3(139, 80, 55), cat: 'Appearance' },
    Size: { type: 'number', default: 5, cat: 'Appearance' },
    Heat: { type: 'number', default: 9, cat: 'Appearance' },
    Enabled: { type: 'bool', default: true, cat: 'Appearance' },
  },
});
export const Sparkles = defineClass('Sparkles', Instance, {
  icon: 'sparkles',
  category: 'Effects',
  props: {
    SparkleColor: { type: 'Color3', default: C3(144, 25, 255), cat: 'Appearance' },
    Enabled: { type: 'bool', default: true, cat: 'Appearance' },
  },
});
export const Smoke = defineClass('Smoke', Instance, {
  icon: 'smoke',
  category: 'Effects',
  props: {
    Color: { type: 'Color3', default: C3(255, 255, 255), cat: 'Appearance' },
    Opacity: { type: 'number', default: 0.5, cat: 'Appearance' },
    Size: { type: 'number', default: 1, cat: 'Appearance' },
    RiseVelocity: { type: 'number', default: 1, cat: 'Appearance' },
    Enabled: { type: 'bool', default: true, cat: 'Appearance' },
  },
});
export const Explosion = defineClass('Explosion', Instance, {
  icon: 'explosion',
  category: 'Effects',
  props: {
    Position: { type: 'Vector3', default: V(0, 0, 0), cat: 'Data' },
    BlastRadius: { type: 'number', default: 4, cat: 'Data' },
    BlastPressure: { type: 'number', default: 500000, cat: 'Data' },
    DestroyJointRadiusPercent: { type: 'number', default: 1, cat: 'Data' },
    Visible: { type: 'bool', default: true, cat: 'Data' },
  },
  events: ['Hit'],
});
export const ClickDetector = defineClass('ClickDetector', Instance, {
  icon: 'click',
  category: 'Interaction',
  props: { MaxActivationDistance: { type: 'number', default: 32, cat: 'Data' } },
  events: ['MouseClick', 'MouseHoverEnter', 'MouseHoverLeave'],
});
export const Decal = defineClass('Decal', Instance, {
  icon: 'decal',
  category: 'Appearance',
  props: {
    Texture: { type: 'string', default: '', cat: 'Appearance' },
    Face: { type: 'string', default: 'Front', cat: 'Appearance' },
    Transparency: { type: 'number', default: 0, cat: 'Appearance' },
  },
});
export const Hint = defineClass('Hint', Instance, {
  icon: 'message',
  category: 'GUI',
  props: { Text: { type: 'string', default: '', cat: 'Data' } },
});
export const Message = defineClass('Message', Instance, {
  icon: 'message',
  category: 'GUI',
  props: { Text: { type: 'string', default: '', cat: 'Data' } },
});
export const BillboardText = defineClass('BillboardText', Instance, {
  icon: 'message',
  category: 'GUI',
  props: {
    Text: { type: 'string', default: 'Label', cat: 'Data' },
    TextColor3: { type: 'Color3', default: C3(255, 255, 255), cat: 'Appearance' },
    TextSize: { type: 'number', default: 24, cat: 'Appearance' },
    StudsOffset: { type: 'Vector3', default: V(0, 2, 0), cat: 'Data' },
    Enabled: { type: 'bool', default: true, cat: 'Data' },
  },
});
export const BindableEvent = defineClass('BindableEvent', Instance, {
  cls: class extends Instance { Fire(...args) { this._fire('Event', ...args); } },
  icon: 'event',
  category: 'Scripts',
  events: ['Event'],
});
export const Team = defineClass('Team', Instance, {
  cls: class extends Instance {
    GetPlayers() {
      const root = this.getRoot && this.getRoot();
      const players = root && root.GetService ? root.GetService('Players').GetPlayers() : [];
      return players.filter((p) => p._p.Team === this);
    }
  },
  icon: 'team',
  props: {
    TeamColor: { type: 'Color3', default: C3(255, 255, 255), cat: 'Data' },
    AutoAssignable: { type: 'bool', default: true, cat: 'Data' },
  },
});

// ---------------------------------------------------------------- humanoid & players
export const Humanoid = defineClass('Humanoid', Instance, {
  cls: class extends Instance {
    TakeDamage(n) {
      if (this.getRoot()._hasForceField && this.getRoot()._hasForceField(this)) return;
      this.Health = Math.max(0, this._p.Health - (+n || 0));
    }
    ChangeState() {}
    GetState() { return enumItem('HumanoidStateType', this._p.Health > 0 ? 'Running' : 'Dead'); }
    Move() {}
    MoveTo(pos) { const m = this._parent; if (m && m.MoveTo) m.MoveTo(pos); }
    UnequipTools() {}
    get Health() { return this._p.Health; }
    set Health(v) {
      const was = this._p.Health;
      const n = Math.max(0, Math.min(this._p.MaxHealth, +v || 0));
      if (this._god && n < was) return; // :god admin command
      this._set('Health', n);
      if (n !== was) this._fire('HealthChanged', n);
      if (was > 0 && n <= 0) this._fire('Died');
    }
  },
  icon: 'humanoid',
  props: {
    Health: { type: 'number', default: 100, cat: 'Game' },
    MaxHealth: { type: 'number', default: 100, cat: 'Game' },
    WalkSpeed: { type: 'number', default: 16, cat: 'Game' },
    JumpPower: { type: 'number', default: 50, cat: 'Game' },
    DisplayName: { type: 'string', default: '', cat: 'Data' },
    Sit: { type: 'bool', default: false, cat: 'Control' },
    Jump: { type: 'bool', default: false, cat: 'Control' },
  },
  events: ['Died', 'HealthChanged', 'Touched', 'Running', 'Jumping', 'FreeFalling', 'StateChanged'],
});
export const ForceField = defineClass('ForceField', Instance, {
  icon: 'forcefield',
  props: { Visible: { type: 'bool', default: true, cat: 'Data' } },
});

export const Player = defineClass('Player', Instance, {
  cls: class extends Instance {
    LoadCharacter() { const r = this.getRoot(); r._loadCharacter && r._loadCharacter(this); }
    Kick(msg) { const r = this.getRoot(); r._kick && r._kick(this, msg); }
    GetMouse() { return null; }
    IsFriendsWith() { return false; }
    GetRankInGroup(id) { const r = this.getRoot(); return r._groupRank ? r._groupRank(this, id) : 0; }
    GetRoleInGroup(id) { const r = this.getRoot(); return r._groupRole ? r._groupRole(this, id) : 'Guest'; }
    IsInGroup(id) { return this.GetRankInGroup(id) > 0; }
    // Robis extra: a private system message in this player's chat.
    Notify(text) { const r = this.getRoot(); r._notify && r._notify(this, String(text)); }
    DistanceFromCharacter(pos) {
      const c = this._p.Character;
      const hrp = c && c.FindFirstChild('HumanoidRootPart');
      return hrp ? hrp.Position.sub(pos).Magnitude : 0;
    }
  },
  creatable: false,
  icon: 'player',
  props: {
    UserId: { type: 'int', default: 0, cat: 'Data', readonly: true },
    DisplayName: { type: 'string', default: '', cat: 'Data' },
    Character: { type: 'ref', default: null, cat: 'Data' },
    RespawnLocation: { type: 'ref', default: null, cat: 'Data' },
    Team: { type: 'ref', default: null, cat: 'Teams' },
    TeamColor: { type: 'Color3', default: C3(255, 255, 255), cat: 'Teams' },
    Neutral: { type: 'bool', default: true, cat: 'Teams' },
    AccountAge: { type: 'int', default: 365, cat: 'Data', readonly: true },
    MembershipType: { type: 'string', default: 'None', cat: 'Data', readonly: true },
  },
  events: ['CharacterAdded', 'CharacterRemoving', 'Chatted'],
});

// ---------------------------------------------------------------- services
export const Workspace = defineClass('Workspace', Model, {
  service: true,
  creatable: false,
  icon: 'workspace',
  props: {
    Gravity: { type: 'number', default: 196.2, cat: 'World' },
    FallenPartsDestroyHeight: { type: 'number', default: -500, cat: 'World' },
    FilteringEnabled: { type: 'bool', default: true, cat: 'Behavior', readonly: true },
  },
});
// Ray casts against every visible part in the Workspace. ignore: an Instance
// (and its descendants) or a list of them. Returns { Instance, Position, Normal, Distance } or nil.
function castRay(ws, origin, dir, ignore) {
  const len = dir.Magnitude;
  if (!(len > 0)) return null;
  const ign = (Array.isArray(ignore) ? ignore : ignore ? [ignore] : []).filter((x) => x instanceof Instance);
  const ignored = (p) => ign.some((i) => p === i || p.IsDescendantOf(i));
  const ox = origin.X, oy = origin.Y, oz = origin.Z;
  const ux = dir.X / len, uy = dir.Y / len, uz = dir.Z / len;
  let best = null, bestT = len;
  const visit = (inst) => {
    for (const c of inst._children) {
      if (c instanceof BasePart) {
        if (c._p.Transparency < 1 && !ignored(c)) {
          const cf = c._p.CFrame, r = cf.r, sz = c._p.Size;
          const dx = ox - cf.x, dy = oy - cf.y, dz = oz - cf.z;
          // ray in the part's local space
          const lo = [dx * r[0] + dy * r[3] + dz * r[6], dx * r[1] + dy * r[4] + dz * r[7], dx * r[2] + dy * r[5] + dz * r[8]];
          const ld = [ux * r[0] + uy * r[3] + uz * r[6], ux * r[1] + uy * r[4] + uz * r[7], ux * r[2] + uy * r[5] + uz * r[8]];
          const h = [sz.X / 2, sz.Y / 2, sz.Z / 2];
          let t0 = 0, t1 = bestT, axis = -1, sign = 1;
          let hit = true;
          for (let a = 0; a < 3; a++) {
            if (Math.abs(ld[a]) < 1e-9) { if (lo[a] < -h[a] || lo[a] > h[a]) { hit = false; break; } continue; }
            let ta = (-h[a] - lo[a]) / ld[a], tb = (h[a] - lo[a]) / ld[a];
            let sg = -1;
            if (ta > tb) { const t = ta; ta = tb; tb = t; sg = 1; }
            if (ta > t0) { t0 = ta; axis = a; sign = sg; }
            if (tb < t1) t1 = tb;
            if (t0 > t1) { hit = false; break; }
          }
          if (hit && t0 <= bestT) {
            bestT = t0;
            const n = [0, 0, 0];
            if (axis >= 0) n[axis] = sign;
            // normal back to world space: columns of r
            best = { part: c, t: t0, n: new Vector3(r[0] * n[0] + r[1] * n[1] + r[2] * n[2], r[3] * n[0] + r[4] * n[1] + r[5] * n[2], r[6] * n[0] + r[7] * n[1] + r[8] * n[2]) };
          }
        }
      }
      if (c._children.length) visit(c);
    }
  };
  visit(ws);
  if (!best) return null;
  return { Instance: best.part, Position: new Vector3(ox + ux * best.t, oy + uy * best.t, oz + uz * best.t), Normal: best.n, Distance: best.t };
}
Workspace.prototype.Raycast = function (origin, direction, ignore) {
  if (!(origin instanceof Vector3) || !(direction instanceof Vector3)) return null;
  return castRay(this, origin, direction, ignore);
};
// Old-style: workspace:FindPartOnRay(Ray.new(origin, direction), ignore) -> part, position
Workspace.prototype.FindPartOnRay = function (ray, ignore) {
  const o = ray && (ray.Origin || ray.origin), d = ray && (ray.Direction || ray.direction);
  if (!(o instanceof Vector3) || !(d instanceof Vector3)) return [null, null];
  const r = castRay(this, o, d, ignore);
  return r ? [r.Instance, r.Position] : [null, o.add(d)];
};

export const Players = defineClass('Players', Instance, {
  cls: class extends Instance {
    GetPlayers() { return this._children.filter((c) => c instanceof Player); }
    getPlayers() { return this.GetPlayers(); }
    GetPlayerFromCharacter(ch) {
      if (!ch) return null;
      for (const p of this._children) if (p instanceof Player && p._p.Character === ch) return p;
      return null;
    }
    getPlayerFromCharacter(ch) { return this.GetPlayerFromCharacter(ch); }
    GetPlayerByUserId(id) {
      for (const p of this._children) if (p instanceof Player && p._p.UserId === +id) return p;
      return null;
    }
    GetNameFromUserIdAsync(id) { const p = this.GetPlayerByUserId(id); return p ? p.Name : 'Player' + id; }
    get NumPlayers() { return this.GetPlayers().length; }
  },
  service: true,
  creatable: false,
  icon: 'players',
  props: {
    MaxPlayers: { type: 'int', default: 12, cat: 'Data', readonly: true },
    RespawnTime: { type: 'number', default: 5, cat: 'Data' },
    CharacterAutoLoads: { type: 'bool', default: true, cat: 'Data' },
    LocalPlayer: { type: 'ref', default: null, cat: 'Data', hidden: true, noReplicate: true },
  },
  events: ['PlayerAdded', 'PlayerRemoving'],
});

class LightingImpl extends Instance {
  get TimeOfDay() {
    const t = ((this._p.ClockTime % 24) + 24) % 24;
    const h = Math.floor(t), m = Math.floor((t - h) * 60), s = Math.floor(((t - h) * 60 - m) * 60);
    return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
  }
  set TimeOfDay(v) {
    const [h = 0, m = 0, s = 0] = String(v).split(':').map(Number);
    this.ClockTime = h + m / 60 + s / 3600;
  }
  GetMinutesAfterMidnight() { return this._p.ClockTime * 60; }
  SetMinutesAfterMidnight(m) { this.ClockTime = (+m || 0) / 60; }
  GetSunDirection() {
    const a = ((this._p.ClockTime - 6) / 12) * Math.PI;
    return new Vector3(-Math.cos(a) * 0.6, Math.sin(a), -0.4).Unit;
  }
}
export const Lighting = defineClass('Lighting', Instance, {
  cls: LightingImpl,
  service: true,
  creatable: false,
  icon: 'lighting',
  props: {
    ClockTime: { type: 'number', default: 14, cat: 'Appearance' },
    TimeOfDay: { type: 'string', derived: true, cat: 'Data' },
    Brightness: { type: 'number', default: 2, cat: 'Appearance' },
    Ambient: { type: 'Color3', default: C3(70, 70, 70), cat: 'Appearance' },
    OutdoorAmbient: { type: 'Color3', default: C3(128, 128, 128), cat: 'Appearance' },
    FogColor: { type: 'Color3', default: C3(192, 192, 192), cat: 'Fog' },
    FogStart: { type: 'number', default: 0, cat: 'Fog' },
    FogEnd: { type: 'number', default: 100000, cat: 'Fog' },
    GlobalShadows: { type: 'bool', default: true, cat: 'Appearance' },
    SkyColor: { type: 'Color3', default: C3(92, 162, 232), cat: 'Sky' },
  },
});

export const ReplicatedStorage = defineClass('ReplicatedStorage', Instance, { service: true, creatable: false, icon: 'storage' });
export const ServerScriptService = defineClass('ServerScriptService', Instance, { service: true, creatable: false, icon: 'sss' });
export const ServerStorage = defineClass('ServerStorage', Instance, { service: true, creatable: false, icon: 'storage' });
export const StarterGui = defineClass('StarterGui', Instance, { service: true, creatable: false, icon: 'gui' });
export const Teams = defineClass('Teams', Instance, {
  cls: class extends Instance { GetTeams() { return this._children.filter((c) => c instanceof Team); } },
  service: true, creatable: false, icon: 'teams',
});
// Services whose behaviour is provided by the host (server runtime).
export const RunService = defineClass('RunService', Instance, {
  cls: class extends Instance {
    IsServer() { return true; }
    IsClient() { return false; }
    IsStudio() { return !!this.getRoot()._isStudio; }
  },
  service: true, creatable: false, icon: 'service', events: ['Heartbeat', 'Stepped', 'RenderStepped'],
});
export const StarterPack = defineClass('StarterPack', Instance, { service: true, creatable: false, icon: 'storage' });
export const Debris = defineClass('Debris', Instance, { service: true, creatable: false, icon: 'service' });
export const TweenService = defineClass('TweenService', Instance, { service: true, creatable: false, icon: 'service' });
export const HttpService = defineClass('HttpService', Instance, { service: true, creatable: false, icon: 'service' });
export const DataStoreService = defineClass('DataStoreService', Instance, { service: true, creatable: false, icon: 'service' });
export const Chat = defineClass('Chat', Instance, { service: true, creatable: false, icon: 'service' });
export const MarketplaceService = defineClass('MarketplaceService', Instance, { service: true, creatable: false, icon: 'service' });
export const BadgeService = defineClass('BadgeService', Instance, { service: true, creatable: false, icon: 'service' });

// Services shown in the Explorer (in order) and saved with a place.
export const TREE_SERVICES = ['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'Teams'];
export const SAVED_SERVICES = ['Workspace', 'Lighting', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'Teams'];

// ---------------------------------------------------------------- DataModel
class DataModelImpl extends Instance {
  constructor() {
    super();
    this._p.Name = 'Game';
    this._hooks = { added: [], removing: [], changed: [] };
    this._byId = new Map();
    this._byId.set(this.id, this);
    this.PlaceId = 0;
    this.GameId = 0;
    this.JobId = '';
    this.CreatorId = 0;
    for (const s of TREE_SERVICES) this.GetService(s);
  }
  GetService(name) {
    name = String(name);
    let s = this._children.find((c) => c.ClassName === name);
    if (s) return s;
    const C = CLASSES[name];
    if (!C || !C.service) throw new Error(`'${name}' is not a valid Service name`);
    s = new C();
    s._parentLocked = false;
    s.setParent(this);
    s._parentLocked = true;
    return s;
  }
  getService(n) { return this.GetService(n); }
  FindService(name) { return this._children.find((c) => c.ClassName === name) || null; }
  get workspace() { return this.Workspace; }
  IsLoaded() { return true; }
  BindToClose() {}

  on(ev, fn) { this._hooks[ev].push(fn); return () => { const a = this._hooks[ev]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; }
  getById(id) { return this._byId.get(id) || null; }
  _emitAdded(inst) {
    const visit = (i) => {
      this._byId.set(i.id, i);
      for (const h of this._hooks.added) h(i, inst);
      for (const c of i._children) visit(c);
    };
    visit(inst);
  }
  _emitRemoving(inst) {
    const visit = (i) => {
      for (const c of i._children) visit(c);
      for (const h of this._hooks.removing) h(i, inst);
      this._byId.delete(i.id);
    };
    visit(inst);
  }
  _emitChanged(inst, prop) { for (const h of this._hooks.changed) h(inst, prop); }
}
for (const name of TREE_SERVICES) {
  Object.defineProperty(DataModelImpl.prototype, name, { get() { return this.GetService(name); }, configurable: true });
}
export const DataModel = defineClass('DataModel', Instance, { cls: DataModelImpl, creatable: false, icon: 'game' });

// ---------------------------------------------------------------- utilities
export function createInstance(className, parent) {
  const C = CLASSES[className];
  if (!C || !C.creatable || C.service) throw new Error(`Unable to create an Instance of type "${className}"`);
  const inst = new C();
  if (parent) inst.Parent = parent;
  return inst;
}

export function partAABB(p) {
  const s = p.Size, cf = p.CFrame, r = cf.r;
  const ex = Math.abs(r[0]) * s.X / 2 + Math.abs(r[1]) * s.Y / 2 + Math.abs(r[2]) * s.Z / 2;
  const ey = Math.abs(r[3]) * s.X / 2 + Math.abs(r[4]) * s.Y / 2 + Math.abs(r[5]) * s.Z / 2;
  const ez = Math.abs(r[6]) * s.X / 2 + Math.abs(r[7]) * s.Y / 2 + Math.abs(r[8]) * s.Z / 2;
  return [V(cf.x - ex, cf.y - ey, cf.z - ez), V(cf.x + ex, cf.y + ey, cf.z + ez)];
}

export function propertyList(inst) {
  const schema = inst.constructor.schema;
  return Object.keys(schema).filter((k) => !schema[k].hidden).map((k) => ({ name: k, ...schema[k] }));
}
