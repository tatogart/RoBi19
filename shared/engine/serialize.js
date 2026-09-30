// Serialization of instance trees: used for place files (.rbxp.json),
// Studio clipboard/undo history and network replication.
import { Vector3, Color3, CFrame, UDim2 } from './types.js';
import { CLASSES, Instance, SAVED_SERVICES, coerce } from './instances.js';

export const PLACE_FORMAT = 'robis-place';
export const PLACE_VERSION = 1;

export function encodeValue(type, v) {
  if (v == null) return null;
  switch (type) {
    case 'Vector3': case 'Color3': case 'CFrame': case 'UDim2':
      return v.toArray().map(round);
    case 'ref':
      return v instanceof Instance ? v.id : null;
    default:
      return v;
  }
}

export function decodeValue(type, v) {
  if (v == null) return type === 'ref' ? null : v;
  switch (type) {
    case 'Vector3': return Vector3.fromArray(v);
    case 'Color3': return Color3.fromArray(v);
    case 'CFrame': return CFrame.fromArray(v);
    case 'UDim2': return UDim2.fromArray(v);
    default: return v;
  }
}

function round(n) { return Math.round(n * 1e5) / 1e5; }

function sameEncoded(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

// opts.replication: skip noReplicate props; opts.filter(inst) => false skips subtree.
export function serialize(inst, opts = {}) {
  const C = inst.constructor;
  const schema = C.schema;
  const p = {};
  for (const k in schema) {
    const d = schema[k];
    if (d.derived) continue;
    if (opts.replication && d.noReplicate) continue;
    const enc = encodeValue(d.type, inst._p[k]);
    if (k !== 'Name' && sameEncoded(enc, encodeValue(d.type, d.default))) continue;
    p[k] = enc;
  }
  const out = { c: C.className, id: inst.id, p };
  if (inst._isCharacter) out.char = 1;
  const ch = [];
  for (const c of inst._children) {
    if (!opts.replication && !c.Archivable) continue;
    if (opts.filter && !opts.filter(c)) continue;
    ch.push(serialize(c, opts));
  }
  if (ch.length) out.ch = ch;
  return out;
}

// Builds a detached tree. Refs are resolved against the new tree (and `lookup`
// for refs pointing outside of it). keepIds=false assigns fresh ids.
export function deserialize(data, opts = {}) {
  const map = new Map();
  const pending = [];
  const build = (d) => {
    const C = CLASSES[d.c];
    if (!C) return null;
    const inst = new C();
    if (opts.keepIds !== false && d.id) inst.id = d.id;
    if (d.char) inst._isCharacter = true;
    map.set(d.id, inst);
    applyProps(inst, d.p || {}, pending);
    for (const cd of d.ch || []) {
      const c = build(cd);
      if (!c) continue;
      c._parent = inst;
      inst._children.push(c);
    }
    return inst;
  };
  const root = build(data);
  resolveRefs(pending, map, opts.lookup);
  return root;
}

function applyProps(inst, props, pending) {
  const schema = inst.constructor.schema;
  for (const k in props) {
    const d = schema[k];
    if (!d || d.derived) continue;
    if (d.type === 'ref') { pending.push([inst, k, props[k]]); continue; }
    try { inst._p[k] = coerce(d.type, decodeValue(d.type, props[k])); } catch { /* ignore bad values */ }
  }
}

function resolveRefs(pending, map, lookup) {
  for (const [inst, k, id] of pending) {
    inst._p[k] = (id && (map.get(id) || (lookup && lookup(id)))) || null;
  }
}

// Sets a property coming from the network/undo system (fires change hooks).
export function setEncodedProp(inst, k, v, lookup) {
  const d = inst.constructor.schema[k];
  if (!d || d.derived) return;
  const val = d.type === 'ref' ? (v ? lookup(v) : null) : coerce(d.type, decodeValue(d.type, v));
  inst._set(k, val);
}

// ---------------------------------------------------------------- places
export function savePlace(game, meta = {}) {
  const services = {};
  for (const name of SAVED_SERVICES) {
    const s = game.FindService(name);
    if (!s) continue;
    const data = serialize(s, { filter: (c) => !c._isCharacter });
    delete data.id;
    services[name] = { p: data.p, ch: data.ch || [] };
  }
  return { format: PLACE_FORMAT, version: PLACE_VERSION, meta, services };
}

export function loadPlace(game, place, opts = {}) {
  if (!place || place.format !== PLACE_FORMAT) throw new Error('Not a Robis place file');
  const all = [];
  for (const name of SAVED_SERVICES) {
    const sd = place.services[name];
    if (!sd) continue;
    const s = game.GetService(name);
    const pending = [];
    applyProps(s, sd.p || {}, pending);
    for (const k of Object.keys(sd.p || {})) s._changed(k);
    for (const cd of sd.ch || []) {
      const inst = deserialize(cd, { keepIds: opts.keepIds, lookup: (id) => game.getById(id) });
      if (inst) all.push([inst, s]);
    }
  }
  for (const [inst, s] of all) inst.Parent = s;
  return game;
}

export function clearPlace(game) {
  for (const name of SAVED_SERVICES) {
    const s = game.FindService(name);
    if (s) for (const c of s.GetChildren()) c.Destroy();
  }
}
