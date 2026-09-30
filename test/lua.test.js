import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataModel, createInstance } from '../shared/engine/instances.js';
import { LuaRuntime } from '../server/game/lua.js';
import { installServices } from '../server/game/services.js';

function setup() {
  const game = new DataModel();
  const out = [];
  let now = 0;
  const rt = new LuaRuntime(game, { output: (level, text) => out.push([level, text]), now: () => now });
  const store = new Map();
  installServices(game, rt, {
    dataStore: { get: (s, k) => store.get(s + k), set: (s, k, v) => store.set(s + k, v) },
    awardBadge: () => true, hasBadge: () => false,
  });
  const run = (src, parent = game.ServerScriptService) => {
    const s = createInstance('Script');
    s.Source = src;
    s.Parent = parent;
    rt.runScript(s);
    return s;
  };
  const advance = (t) => { now += t; rt.step(); };
  const prints = () => out.filter(([l]) => l === 'print').map(([, t]) => t);
  return { game, rt, out, run, advance, prints, tweenStep: (dt) => game.GetService('TweenService').step(dt) };
}

test('print, globals and datatypes', () => {
  const { run, prints } = setup();
  run(`
    print("hi", 1 + 1, 10 / 2, 2.5)
    local v = Vector3.new(1, 2, 3) + Vector3.new(1, 1, 1)
    print(v, v.Magnitude > 4, typeof(v), typeof(workspace))
    print(CFrame.new(0, 5, 0).Position.Y, BrickColor.new("Bright red").Name, Enum.Material.Neon.Name)
  `);
  assert.deepEqual(prints(), ['hi 2 5 2.5', '2, 3, 4 true Vector3 Instance', '5 Bright red Neon']);
});

test('Instance API from Lua', () => {
  const { run, prints, game } = setup();
  run(`
    local p = Instance.new("Part")
    p.Name = "Brick"
    p.Size = Vector3.new(4, 1, 2)
    p.BrickColor = BrickColor.new("Bright blue")
    p.Material = Enum.Material.Wood
    p.Parent = workspace
    print(workspace.Brick == p, workspace:FindFirstChild("Brick").Material == Enum.Material.Wood, p:IsA("BasePart"))
    print(#workspace:GetChildren(), p:GetFullName(), script.Name)
    local ok, err = pcall(function() return workspace.DoesNotExist end)
    print(ok, err)
    p:Destroy()
    print(workspace:FindFirstChild("Brick"))
  `);
  assert.deepEqual(prints(), ['true true true', '1 Workspace.Brick Script', 'false DoesNotExist is not a valid member of Workspace', 'nil']);
  assert.equal(game.Workspace.GetChildren().length, 0);
});

test('wait, spawn, delay and events', () => {
  const { run, advance, prints, game } = setup();
  run(`
    spawn(function() print("spawned") end)
    delay(1, function() print("delayed") end)
    local part = Instance.new("Part", workspace)
    part.Name = "Pad"
    part.Touched:Connect(function(hit) print("touched by " .. hit.Name) end)
    print("before wait")
    local waited = wait(0.5)
    print("after wait", waited >= 0.5)
  `);
  assert.deepEqual(prints(), ['before wait']);
  advance(0.1);
  assert.deepEqual(prints(), ['before wait', 'spawned']);
  advance(0.5);
  assert.ok(prints().includes('after wait true'));
  advance(0.6);
  assert.ok(prints().includes('delayed'));
  const other = createInstance('Part');
  other.Name = 'Leg';
  game.Workspace.FindFirstChild('Pad').Touched.fire(other);
  assert.ok(prints().includes('touched by Leg'));
});

test('WaitForChild and Signal:Wait yield until ready', () => {
  const { run, advance, prints, game } = setup();
  run(`
    local f = workspace:WaitForChild("Later")
    print("got", f.Name)
    local child = workspace.ChildAdded:Wait()
    print("added", child.Name)
  `);
  const f = createInstance('Folder');
  f.Name = 'Later';
  f.Parent = game.Workspace;
  advance(0.05);
  assert.deepEqual(prints(), ['got Later']);
  const g = createInstance('Folder');
  g.Name = 'Next';
  g.Parent = game.Workspace;
  advance(0.05);
  assert.deepEqual(prints(), ['got Later', 'added Next']);
});

test('errors report the script and line', () => {
  const { run, out } = setup();
  const s = run('local x = 1\nerror("boom")');
  const err = out.find(([l]) => l === 'error');
  assert.ok(err && err[1].includes(`${s.getFullName()}:2: boom`), JSON.stringify(out));
});

test('infinite loops time out', { timeout: 30000 }, () => {
  const { run, out } = setup();
  run('while true do end');
  assert.ok(out.some(([l, t]) => l === 'error' && t.includes('Script timeout')));
});

test('sandbox removes host access', () => {
  const { run, prints } = setup();
  run('print(io, os.execute, require ~= nil, loadstring("return 1")())');
  assert.deepEqual(prints(), ['nil nil true 1']);
});

test('TweenService tweens properties', () => {
  const { run, advance, tweenStep, prints, game } = setup();
  run(`
    local p = Instance.new("Part", workspace)
    p.Name = "T"
    p.Position = Vector3.new(0, 0, 0)
    local tw = game:GetService("TweenService"):Create(p, TweenInfo.new(1, Enum.EasingStyle.Linear), {Position = Vector3.new(10, 0, 0), Transparency = 1})
    tw:Play()
    tw.Completed:Wait()
    print("done", p.Position.X, p.Transparency)
  `);
  for (let i = 0; i < 12; i++) { tweenStep(0.1); advance(0.1); }
  assert.deepEqual(prints(), ['done 10 1']);
  assert.equal(game.Workspace.FindFirstChild('T').Position.X, 10);
});

test('DataStore and HttpService', () => {
  const { run, prints } = setup();
  run(`
    local ds = game:GetService("DataStoreService"):GetDataStore("Test")
    ds:SetAsync("a", {coins = 5, name = "x"})
    local v = ds:GetAsync("a")
    print(v.coins, v.name, ds:IncrementAsync("n", 3), ds:UpdateAsync("n", function(old) return old * 2 end))
    local http = game:GetService("HttpService")
    print(http:JSONDecode(http:JSONEncode({1, 2, 3}))[2])
  `);
  assert.deepEqual(prints(), ['5 x 3 6', '2']);
});

test('ModuleScript require', () => {
  const { run, prints, game } = setup();
  const m = createInstance('ModuleScript');
  m.Name = 'Util';
  m.Source = 'local M = {}\nfunction M.double(x) return x * 2 end\nreturn M';
  m.Parent = game.ReplicatedStorage;
  run('local U = require(game.ReplicatedStorage.Util)\nprint(U.double(21))');
  assert.deepEqual(prints(), ['42']);
});
