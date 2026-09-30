// Helpers to build places from code (seed games and Studio templates).
import { Vector3, Color3, CFrame } from '../../shared/engine/types.js';
import { DataModel, createInstance } from '../../shared/engine/instances.js';
import { savePlace } from '../../shared/engine/serialize.js';

export function newGame() { return new DataModel(); }

export function part(parent, o = {}) {
  const p = createInstance(o.cls || 'Part');
  if (o.name) p.Name = o.name;
  p.Size = new Vector3(...(o.size || [4, 1, 2]));
  const [x, y, z] = o.pos || [0, 0.5, 0];
  const cf = o.rot ? CFrame.fromOrientation(...o.rot) : new CFrame();
  cf.x = x; cf.y = y; cf.z = z;
  p.CFrame = cf;
  if (o.color) p.Color = Color3.fromHex(o.color);
  if (o.material) p.Material = o.material;
  p.Anchored = o.anchored !== false;
  if (o.canCollide === false) p.CanCollide = false;
  if (o.transparency) p.Transparency = o.transparency;
  if (o.reflectance) p.Reflectance = o.reflectance;
  if (o.shape) p.Shape = o.shape;
  if (o.top) p.TopSurface = o.top;
  if (o.bottom) p.BottomSurface = o.bottom;
  if (o.props) for (const [k, v] of Object.entries(o.props)) p[k] = v;
  p.Parent = parent;
  return p;
}

export function model(parent, name) {
  const m = createInstance('Model');
  m.Name = name;
  m.Parent = parent;
  return m;
}

export function folder(parent, name) {
  const f = createInstance('Folder');
  f.Name = name;
  f.Parent = parent;
  return f;
}

export function script(parent, name, source, cls = 'Script') {
  const s = createInstance(cls);
  s.Name = name;
  s.Source = source.replace(/^\n/, '');
  s.Parent = parent;
  return s;
}

export function inst(parent, cls, props = {}) {
  const i = createInstance(cls);
  for (const [k, v] of Object.entries(props)) i[k] = v;
  i.Parent = parent;
  return i;
}

export function baseplate(ws, o = {}) {
  return part(ws, {
    name: 'Baseplate', size: o.size || [512, 20, 512], pos: [0, -10, 0], color: o.color || '#5b5b5f',
    material: o.material || 'Plastic', top: o.top || 'Studs', props: { Locked: true },
  });
}

export function spawn(ws, pos = [0, 0.5, 0], o = {}) {
  return part(ws, {
    cls: 'SpawnLocation', name: o.name || 'SpawnLocation', size: o.size || [12, 1, 12], pos,
    color: o.color || '#a3a2a5', top: 'Smooth', props: o.props,
  });
}

export function tree(parent, x, z, y = 0, scale = 1) {
  const m = model(parent, 'Tree');
  part(m, { name: 'Trunk', size: [2 * scale, 10 * scale, 2 * scale], pos: [x, y + 5 * scale, z], color: '#7c5c46', material: 'Wood' });
  part(m, { name: 'Leaves', size: [9 * scale, 9 * scale, 9 * scale], pos: [x, y + 12 * scale, z], color: '#4b974b', material: 'Grass', shape: 'Ball' });
  return m;
}

export function finish(game, meta) { return savePlace(game, meta); }
