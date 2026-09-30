import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, CFrame, Color3, BrickColor } from '../shared/engine/types.js';
import { DataModel, createInstance } from '../shared/engine/instances.js';
import { savePlace, loadPlace, serialize, deserialize } from '../shared/engine/serialize.js';
import { partBox, sphereVsBox, boxesOverlap, stepCharacter, SpatialGrid, boxAABB } from '../shared/engine/physics.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('Vector3 math', () => {
  const v = new Vector3(1, 2, 3).add(new Vector3(1, 1, 1)).mul(2);
  assert.deepEqual(v.toArray(), [4, 6, 8]);
  close(new Vector3(3, 4, 0).Magnitude, 5);
  assert.deepEqual(new Vector3(1, 0, 0).Cross(new Vector3(0, 1, 0)).toArray(), [0, 0, 1]);
});

test('CFrame orientation round-trips', () => {
  const cf = CFrame.fromOrientation(30, 45, 60);
  const o = cf.toOrientation();
  close(o.X, 30, 1e-4); close(o.Y, 45, 1e-4); close(o.Z, 60, 1e-4);
  const a = new CFrame(1, 2, 3).mul(CFrame.Angles(0.3, 0.2, 0.1));
  const back = a.mul(a.Inverse());
  for (const [i, v] of back.toArray().entries()) close(v, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1][i], 1e-9);
  // LookVector of an unrotated CFrame is -Z
  assert.deepEqual(new CFrame().LookVector.toArray().map((x) => x + 0), [0, 0, -1]);
});

test('BrickColor and Color3', () => {
  assert.equal(BrickColor.new('Bright red').Name, 'Bright red');
  assert.equal(Color3.fromRGB(255, 0, 0).toHex(), '#ff0000');
  assert.equal(BrickColor.fromColor3(Color3.fromRGB(250, 2, 2)).Name, 'Really red');
});

test('instance tree, hooks and events', () => {
  const game = new DataModel();
  const added = [];
  game.on('added', (i) => added.push(i.Name));
  const model = createInstance('Model');
  model.Name = 'House';
  const part = createInstance('Part', model);
  part.Name = 'Wall';
  let childAdded = null;
  game.Workspace.ChildAdded.Connect((c) => { childAdded = c; });
  model.Parent = game.Workspace;
  assert.deepEqual(added, ['House', 'Wall']);
  assert.equal(childAdded, model);
  assert.equal(game.Workspace.FindFirstChild('Wall', true), part);
  assert.equal(part.getFullName(), 'Workspace.House.Wall');
  assert.ok(part.IsA('BasePart') && part.IsA('Instance') && !part.IsA('Model'));
  let changed = null;
  part.Changed.Connect((p) => { changed = p; });
  part.Transparency = 0.5;
  assert.equal(changed, 'Transparency');
  const clone = model.Clone();
  assert.notEqual(clone.FindFirstChild('Wall'), part);
  model.Destroy();
  assert.throws(() => { model.Parent = game.Workspace; });
  assert.equal(game.getById(part.id), null);
});

test('services cannot be reparented and names are validated', () => {
  const game = new DataModel();
  assert.throws(() => { game.Workspace.Parent = null; });
  assert.throws(() => createInstance('Workspace'));
  assert.throws(() => createInstance('NotAClass'));
});

test('place save/load keeps structure, values and refs', () => {
  const game = new DataModel();
  const m = createInstance('Model', game.Workspace);
  const p = createInstance('Part', m);
  p.Size = new Vector3(2, 3, 4);
  p.CFrame = new CFrame(1, 2, 3).mul(CFrame.Angles(0, 1, 0));
  p.Material = 'Neon';
  m.PrimaryPart = p;
  const s = createInstance('Script', game.ServerScriptService);
  s.Source = 'print(1)';
  const data = JSON.parse(JSON.stringify(savePlace(game)));
  const g2 = new DataModel();
  loadPlace(g2, data);
  const m2 = g2.Workspace.FindFirstChildOfClass('Model');
  const p2 = m2.FindFirstChildOfClass('Part');
  assert.equal(m2.PrimaryPart, p2);
  assert.deepEqual(p2.Size.toArray(), [2, 3, 4]);
  assert.equal(p2.Material, 'Neon');
  close(p2.Position.X, 1, 1e-4);
  assert.equal(g2.ServerScriptService.FindFirstChild('Script').Source, 'print(1)');
  // serialize/deserialize with fresh ids
  const copy = deserialize(serialize(m), { keepIds: false });
  assert.notEqual(copy.id, m.id);
  assert.equal(copy.GetChildren().length, 1);
});

test('collision: sphere vs box and rotated boxes', () => {
  const game = new DataModel();
  const floor = createInstance('Part', game.Workspace);
  floor.Size = new Vector3(20, 2, 20);
  floor.Position = new Vector3(0, -1, 0);
  const hit = sphereVsBox(partBox(floor), 0, 0.5, 0, 1);
  assert.ok(hit && hit.ny > 0.99 && Math.abs(hit.depth - 0.5) < 1e-6);
  assert.equal(sphereVsBox(partBox(floor), 0, 5, 0, 1), null);
  const a = createInstance('Part');
  a.Size = new Vector3(2, 2, 2);
  const b = createInstance('Part');
  b.Size = new Vector3(2, 2, 2);
  b.CFrame = new CFrame(2.3, 0, 0).mul(CFrame.Angles(0, Math.PI / 4, 0)); // rotated corner reaches x = 0.886
  assert.ok(boxesOverlap(partBox(a), partBox(b)));
  b.Position = new Vector3(4, 0, 0);
  assert.ok(!boxesOverlap(partBox(a), partBox(b)));
});

test('character controller lands on the floor and walks', () => {
  const game = new DataModel();
  const floor = createInstance('Part', game.Workspace);
  floor.Size = new Vector3(100, 2, 100);
  floor.Position = new Vector3(0, -1, 0);
  const grid = new SpatialGrid();
  const b = partBox(floor);
  grid.insert(b, boxAABB(b));
  const world = { query: (...a) => grid.query(...a), gravity: 196.2 };
  const s = { x: 0, y: 10, z: 0, vx: 0, vy: 0, vz: 0, grounded: false };
  const hum = { WalkSpeed: 16, JumpPower: 50 };
  for (let i = 0; i < 120; i++) stepCharacter(s, { mx: 0, mz: 0, jump: false }, 1 / 60, world, hum);
  assert.ok(s.grounded);
  close(s.y, 3, 0.05);
  for (let i = 0; i < 60; i++) stepCharacter(s, { mx: 0, mz: -1, jump: false }, 1 / 60, world, hum);
  close(s.z, -16, 0.5);
  stepCharacter(s, { mx: 0, mz: 0, jump: true }, 1 / 60, world, hum);
  assert.ok(!s.grounded && s.vy > 40);
});
