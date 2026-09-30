// Toolbox: ready-made models and scripts (each is built from code, no assets).
import { Vector3, Color3, CFrame } from '/shared/engine/types.js';
import { createInstance, DataModel } from '/shared/engine/instances.js';

function part(parent, o) {
  const p = createInstance(o.cls || 'Part');
  p.Name = o.name || p.Name;
  p.Size = new Vector3(...(o.size || [4, 1, 2]));
  const cf = o.rot ? CFrame.fromOrientation(...o.rot) : new CFrame();
  const [x, y, z] = o.pos || [0, 0, 0];
  cf.x = x; cf.y = y; cf.z = z;
  p.CFrame = cf;
  p.Anchored = o.anchored !== false;
  if (o.color) p.Color = Color3.fromHex(o.color);
  if (o.material) p.Material = o.material;
  if (o.shape) p.Shape = o.shape;
  if (o.transparency) p.Transparency = o.transparency;
  if (o.canCollide === false) p.CanCollide = false;
  if (parent) p.Parent = parent;
  return p;
}
function script(parent, name, src) {
  const s = createInstance('Script');
  s.Name = name;
  s.Source = src.replace(/^\n/, '');
  s.Parent = parent;
  return s;
}
function model(name) { const m = createInstance('Model'); m.Name = name; return m; }

export const TOOLBOX = [
  { name: 'Kill Brick', build() {
    const p = part(null, { name: 'KillBrick', size: [8, 1, 8], color: '#ff2a00', material: 'Neon' });
    script(p, 'Kill', `
script.Parent.Touched:Connect(function(hit)
	local humanoid = hit.Parent:FindFirstChild("Humanoid")
	if humanoid then
		humanoid.Health = 0
	end
end)
`);
    return p;
  } },
  { name: 'Checkpoint', build() {
    const p = part(null, { cls: 'SpawnLocation', name: 'Checkpoint', size: [8, 1, 8], color: '#4b974b' });
    p.Enabled = false;
    script(p, 'Checkpoint', `
local Players = game:GetService("Players")
local cp = script.Parent

cp.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player and player.RespawnLocation ~= cp then
		player.RespawnLocation = cp
		print(player.Name .. " reached a checkpoint!")
	end
end)
`);
    return p;
  } },
  { name: 'Coin', build() {
    const p = part(null, { name: 'Coin', size: [0.4, 3, 3], shape: 'Cylinder', color: '#ffc400', material: 'Neon', canCollide: false });
    script(p, 'CoinScript', `
-- Gives the player +1 "Coins" in leaderstats (creates it if needed)
local Players = game:GetService("Players")
local coin = script.Parent
local debounce = false

coin.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or debounce then return end
	debounce = true
	local stats = player:FindFirstChild("leaderstats")
	if not stats then
		stats = Instance.new("Folder")
		stats.Name = "leaderstats"
		stats.Parent = player
	end
	local coins = stats:FindFirstChild("Coins")
	if not coins then
		coins = Instance.new("IntValue")
		coins.Name = "Coins"
		coins.Parent = stats
	end
	coins.Value = coins.Value + 1
	coin.Transparency = 1
	wait(5)
	coin.Transparency = 0
	debounce = false
end)

while true do
	coin.CFrame = coin.CFrame * CFrame.Angles(0, math.rad(6), 0)
	wait()
end
`);
    return p;
  } },
  { name: 'Spinner', build() {
    const p = part(null, { name: 'Spinner', size: [16, 1, 1.5], color: '#ff2a00', material: 'Neon' });
    script(p, 'Spin', `
local RunService = game:GetService("RunService")
local part = script.Parent
RunService.Heartbeat:Connect(function(dt)
	part.CFrame = part.CFrame * CFrame.Angles(0, dt * 2, 0)
end)
`);
    return p;
  } },
  { name: 'Moving Platform', build() {
    const p = part(null, { name: 'MovingPlatform', size: [8, 1, 8], color: '#04afec', material: 'SmoothPlastic' });
    script(p, 'Move', `
local TweenService = game:GetService("TweenService")
local part = script.Parent
local info = TweenInfo.new(3, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
TweenService:Create(part, info, {Position = part.Position + Vector3.new(0, 0, -20)}):Play()
`);
    return p;
  } },
  { name: 'Disappearing Brick', build() {
    const p = part(null, { name: 'FadeBrick', size: [6, 1, 6], color: '#ff66cc', material: 'Neon' });
    script(p, 'Fade', `
local part = script.Parent
local busy = false
part.Touched:Connect(function(hit)
	if busy or not hit.Parent:FindFirstChild("Humanoid") then return end
	busy = true
	for i = 1, 10 do
		part.Transparency = i / 10
		wait(0.1)
	end
	part.CanCollide = false
	wait(3)
	part.CanCollide = true
	part.Transparency = 0
	busy = false
end)
`);
    return p;
  } },
  { name: 'Speed Pad', build() {
    const p = part(null, { name: 'SpeedPad', size: [6, 0.4, 6], color: '#00ff00', material: 'Neon' });
    script(p, 'Speed', `
script.Parent.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h and h.WalkSpeed < 40 then
		h.WalkSpeed = 50
		wait(3)
		h.WalkSpeed = 16
	end
end)
`);
    return p;
  } },
  { name: 'Jump Pad', build() {
    const p = part(null, { name: 'JumpPad', size: [6, 0.4, 6], color: '#f5cd30', material: 'Neon' });
    script(p, 'Jump', `
script.Parent.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h and h.JumpPower < 100 then
		h.JumpPower = 130
		wait(2)
		h.JumpPower = 50
	end
end)
`);
    return p;
  } },
  { name: 'Teleporter', build() {
    const m = model('Teleporter');
    part(m, { name: 'PadA', size: [6, 1, 6], pos: [-8, 0, 0], color: '#6b327c', material: 'Neon' });
    part(m, { name: 'PadB', size: [6, 1, 6], pos: [8, 0, 0], color: '#0d69ac', material: 'Neon' });
    script(m, 'Teleport', `
local model = script.Parent
local a, b = model.PadA, model.PadB
local cooldown = {}

local function link(from, to)
	from.Touched:Connect(function(hit)
		local char = hit.Parent
		local h = char:FindFirstChild("Humanoid")
		if h and not cooldown[char] then
			cooldown[char] = true
			char:MoveTo(to.Position + Vector3.new(0, 3, 0))
			wait(2)
			cooldown[char] = nil
		end
	end)
end
link(a, b)
link(b, a)
`);
    return m;
  } },
  { name: 'Push Button', build() {
    const m = model('Button');
    part(m, { name: 'Base', size: [4, 1, 4], pos: [0, 0, 0], color: '#635f62', material: 'DiamondPlate' });
    const btn = part(m, { name: 'Button', size: [2.4, 0.6, 2.4], pos: [0, 0.8, 0], color: '#c4281c', material: 'Neon', shape: 'Cylinder', rot: [0, 0, 90] });
    btn.Size = new Vector3(0.6, 2.4, 2.4);
    createInstance('ClickDetector', btn);
    script(m, 'ButtonScript', `
local button = script.Parent.Button
button.ClickDetector.MouseClick:Connect(function(player)
	print(player.Name .. " pressed the button!")
	button.Color = Color3.new(0, 1, 0)
	local e = Instance.new("Explosion")
	e.Position = button.Position + Vector3.new(0, 15, 0)
	e.BlastRadius = 0
	e.Parent = workspace
	wait(1)
	button.Color = Color3.fromRGB(196, 40, 28)
end)
`);
    return m;
  } },
  { name: 'Lamp Post', build() {
    const m = model('LampPost');
    part(m, { name: 'Pole', size: [0.6, 12, 0.6], pos: [0, 6, 0], color: '#1b2a35', material: 'Metal' });
    const lamp = part(m, { name: 'Lamp', size: [1.6, 1.6, 1.6], pos: [0, 12.6, 0], color: '#fff6a8', material: 'Neon', shape: 'Ball' });
    const l = createInstance('PointLight', lamp);
    l.Range = 20; l.Brightness = 2; l.Color = Color3.fromRGB(255, 230, 160);
    return m;
  } },
  { name: 'Tree', build() {
    const m = model('Tree');
    part(m, { name: 'Trunk', size: [2, 10, 2], pos: [0, 5, 0], color: '#7c5c46', material: 'Wood' });
    part(m, { name: 'Leaves', size: [9, 9, 9], pos: [0, 12, 0], color: '#4b974b', material: 'Grass', shape: 'Ball' });
    return m;
  } },
  { name: 'Campfire', build() {
    const m = model('Campfire');
    for (let i = 0; i < 4; i++) part(m, { name: 'Log', size: [4, 0.8, 0.8], pos: [0, 0.4, 0], rot: [0, i * 45, 0], color: '#56422f', material: 'Wood' });
    const core = part(m, { name: 'Embers', size: [1.5, 0.4, 1.5], pos: [0, 0.9, 0], color: '#ff7a00', material: 'Neon', shape: 'Ball' });
    createInstance('Fire', core);
    return m;
  } },
  { name: 'Brick House', build() {
    const m = model('House');
    const c = '#c4281c';
    part(m, { name: 'Floor', size: [20, 1, 16], pos: [0, 0.5, 0], color: '#7c5c46', material: 'WoodPlanks' });
    part(m, { name: 'Wall', size: [20, 10, 1], pos: [0, 6, -7.5], color: c, material: 'Brick' });
    part(m, { name: 'Wall', size: [1, 10, 16], pos: [-9.5, 6, 0], color: c, material: 'Brick' });
    part(m, { name: 'Wall', size: [1, 10, 16], pos: [9.5, 6, 0], color: c, material: 'Brick' });
    part(m, { name: 'Wall', size: [7, 10, 1], pos: [-6.5, 6, 7.5], color: c, material: 'Brick' });
    part(m, { name: 'Wall', size: [7, 10, 1], pos: [6.5, 6, 7.5], color: c, material: 'Brick' });
    part(m, { name: 'Wall', size: [6, 3, 1], pos: [0, 9.5, 7.5], color: c, material: 'Brick' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [22, 5, 9], pos: [0, 13.5, -4.5], color: '#56422f' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [22, 5, 9], pos: [0, 13.5, 4.5], rot: [0, 180, 0], color: '#56422f' });
    return m;
  } },
  { name: 'Leaderboard Script', build() {
    const s = createInstance('Script');
    s.Name = 'Leaderboard';
    s.Source = `-- Creates leaderstats for every player
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local points = Instance.new("IntValue")
	points.Name = "Points"
	points.Value = 0
	points.Parent = stats
end)
`;
    return s;
  } },
  { name: 'Day/Night Script', build() {
    const s = createInstance('Script');
    s.Name = 'DayNight';
    s.Source = `local Lighting = game:GetService("Lighting")
while true do
	Lighting.ClockTime = (Lighting.ClockTime + 0.02) % 24
	wait(0.1)
end
`;
    return s;
  } },
];

let thumbCache = new Map();
export async function toolboxThumb(entry) {
  if (thumbCache.has(entry.name)) return thumbCache.get(entry.name);
  const p = (async () => {
    const { renderPlace } = await import('../render/thumbs.js');
    const game = new DataModel();
    const inst = entry.build();
    if (inst.IsA('BaseScript')) return null;
    inst.Parent = game.Workspace;
    return renderPlace(null, 176, { game, minRadius: 5 });
  })();
  thumbCache.set(entry.name, p);
  return p;
}
