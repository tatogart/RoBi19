// Differences between two saved places, as a list of small operations, and a
// way to apply them to a live DataModel. Used by Studio's undo/redo (so undo
// only reverts *your* change) and by Team Create (edits are sent to the other
// people editing the same place).
//
// Ops:
//   ['add', parentRef, node]   node = serialized subtree (keeps ids)
//   ['rem', id]
//   ['move', id, parentRef]
//   ['set', id, props]         props = the full encoded property set
//   ['svc', serviceName, props]
// parentRef is an instance id, or 'svc:<ServiceName>'.
import { deserialize, setEncodedProp, encodeValue } from './serialize.js';

function flatten(place) {
  const map = new Map();
  const svc = {};
  for (const [name, sd] of Object.entries(place.services || {})) {
    svc[name] = JSON.stringify(sd.p || {});
    const walk = (node, parent) => {
      map.set(node.id, { node, parent, c: node.c, p: JSON.stringify(node.p || {}) });
      for (const ch of node.ch || []) walk(ch, node.id);
    };
    for (const ch of sd.ch || []) walk(ch, 'svc:' + name);
  }
  return { map, svc };
}

export function diffPlaces(prev, next) {
  const a = flatten(prev), b = flatten(next);
  const ops = [];
  // removed (only the top of each removed subtree)
  for (const [id, e] of a.map) {
    if (b.map.has(id)) continue;
    if (a.map.has(e.parent) && !b.map.has(e.parent)) continue;
    ops.push(['rem', id]);
  }
  // added (only the top of each added subtree; the node carries its children)
  for (const [id, e] of b.map) {
    if (a.map.has(id)) continue;
    if (b.map.has(e.parent) && !a.map.has(e.parent)) continue;
    ops.push(['add', e.parent, e.node]);
  }
  // moved / changed
  for (const [id, e] of b.map) {
    const old = a.map.get(id);
    if (!old) continue;
    if (old.c !== e.c) { ops.push(['rem', id], ['add', e.parent, e.node]); continue; }
    if (old.parent !== e.parent) ops.push(['move', id, e.parent]);
    if (old.p !== e.p) ops.push(['set', id, e.node.p || {}]);
  }
  for (const [name, p] of Object.entries(b.svc)) {
    if (a.svc[name] !== p) ops.push(['svc', name, (next.services[name] || {}).p || {}]);
  }
  return ops;
}

function resolve(game, ref) {
  if (typeof ref === 'string' && ref.startsWith('svc:')) {
    try { return game.GetService(ref.slice(4)); } catch { return null; }
  }
  return game.getById(ref);
}

function setAll(inst, props, lookup) {
  const schema = inst.constructor.schema;
  for (const k in schema) {
    const d = schema[k];
    if (d.derived || d.readonly) continue;
    const enc = k in props ? props[k] : encodeValue(d.type, d.default);
    try { setEncodedProp(inst, k, enc, lookup); } catch { /* bad value */ }
  }
}

// Applies ops; returns how many could be applied (missing targets are skipped,
// which is what you want when two people edit at once).
export function applyOps(game, ops) {
  const lookup = (id) => game.getById(id);
  let n = 0;
  const order = { rem: 0, add: 1, move: 2, set: 3, svc: 4 };
  const sorted = ops.map((op, i) => [op, i]).sort((x, y) => (order[x[0][0]] - order[y[0][0]]) || (x[1] - y[1])).map(([op]) => op);
  for (const op of sorted) {
    try {
      if (op[0] === 'rem') {
        const inst = game.getById(op[1]);
        if (inst && !inst.constructor.service) { inst.Destroy(); n++; }
      } else if (op[0] === 'add') {
        const parent = resolve(game, op[1]);
        if (!parent || game.getById(op[2].id)) continue;
        const inst = deserialize(op[2], { keepIds: true, lookup });
        if (inst) { inst.Parent = parent; n++; }
      } else if (op[0] === 'move') {
        const inst = game.getById(op[1]);
        const parent = resolve(game, op[2]);
        if (inst && parent && inst !== parent && !parent.IsDescendantOf(inst)) { inst.Parent = parent; n++; }
      } else if (op[0] === 'set') {
        const inst = game.getById(op[1]);
        if (inst) { setAll(inst, op[2], lookup); n++; }
      } else if (op[0] === 'svc') {
        const s = resolve(game, 'svc:' + op[1]);
        if (s) { setAll(s, op[2], lookup); n++; }
      }
    } catch { /* skip ops that no longer fit */ }
  }
  return n;
}
