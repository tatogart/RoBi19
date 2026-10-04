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

// ---------------------------------------------------------------- more models
function tool(name, toolModel, color, src, o = {}) {
  const t = createInstance('Tool');
  t.Name = name;
  t.ToolModel = toolModel;
  t.Color = Color3.fromHex(color);
  t.ToolTip = o.tip || '';
  t.Automatic = !!o.auto;
  if (src) script(t, name.replace(/\W+/g, '') + 'Script', src);
  return t;
}
function kart(name, color, speed, scale = 1) {
  const m = model(name);
  part(m, { name: 'Body', size: [4 * scale, 1 * scale, 6.4 * scale], pos: [0, 1, 0], color, material: 'SmoothPlastic' });
  const seat = part(m, { cls: 'VehicleSeat', name: 'Seat', size: [2, 1, 2], pos: [0, 2, 0.5], color });
  seat.MaxSpeed = speed;
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) part(m, { name: 'Wheel', size: [0.8 * scale, 1.6 * scale, 1.6 * scale], pos: [x * scale, 0.8 * scale, z * scale], color: '#1b1b1b', shape: 'Cylinder' });
  return m;
}

TOOLBOX.push(
  { name: 'Sword', cat: 'Weapons', build: () => tool('Sword', 'sword', '#a3a2a5', `
-- Click to slash anyone close in front of you (30 damage).
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown then return end
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	cooldown = true
	delay(0.5, function() cooldown = false end)
	for _, p in ipairs(Players:GetPlayers()) do
		local c = p.Character
		local r2 = c and c:FindFirstChild("HumanoidRootPart")
		local h = c and c:FindFirstChild("Humanoid")
		if c ~= char and r2 and h and (r2.Position - root.Position).Magnitude < 7 then h:TakeDamage(30) end
	end
end)
`, { tip: 'Click to slash' }) },
  { name: 'Blaster', cat: 'Weapons', build: () => tool('Blaster', 'gun', '#2a2a2a', `
-- Click where you want to shoot. Uses workspace:Raycast; headshots do double damage.
local tool = script.Parent
local Debris = game:GetService("Debris")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not target then return end
	local char = tool.Parent
	local head = char and char:FindFirstChild("Head")
	if not head then return end
	cooldown = true
	delay(0.25, function() cooldown = false end)
	local origin = head.Position
	local dir = (target - origin).Unit * 400
	local result = workspace:Raycast(origin, dir, char)
	local hitPos = result and result.Position or origin + dir
	local beam = Instance.new("Part")
	beam.Anchored = true
	beam.CanCollide = false
	beam.Material = Enum.Material.Neon
	beam.Color = Color3.fromRGB(255, 230, 0)
	beam.Size = Vector3.new(0.2, 0.2, (hitPos - origin).Magnitude)
	beam.CFrame = CFrame.new((origin + hitPos) / 2, hitPos)
	beam.Parent = workspace
	Debris:AddItem(beam, 0.08)
	if result then
		local h = result.Instance.Parent:FindFirstChild("Humanoid")
		if h then h:TakeDamage(result.Instance.Name == "Head" and 40 or 20) end
	end
end)
`, { tip: 'Click to shoot' }) },
  { name: 'Rocket Launcher', cat: 'Weapons', build: () => tool('Rocket Launcher', 'rocket', '#4b974b', `
-- Fires a slow rocket that explodes where it hits.
local tool = script.Parent
local TweenService = game:GetService("TweenService")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not target then return end
	local char = tool.Parent
	local head = char and char:FindFirstChild("Head")
	if not head then return end
	cooldown = true
	delay(2.5, function() cooldown = false end)
	local origin = head.Position + (target - head.Position).Unit * 3
	local hit = workspace:Raycast(origin, (target - origin).Unit * 300, char)
	local stop = hit and hit.Position or target
	local rocket = Instance.new("Part")
	rocket.Size = Vector3.new(1, 1, 3)
	rocket.CFrame = CFrame.new(origin, stop)
	rocket.Anchored = true
	rocket.CanCollide = false
	rocket.Parent = workspace
	Instance.new("Fire", rocket)
	local t = (stop - origin).Magnitude / 80
	TweenService:Create(rocket, TweenInfo.new(t, Enum.EasingStyle.Linear), {Position = stop}):Play()
	wait(t)
	rocket:Destroy()
	local e = Instance.new("Explosion")
	e.Position = stop
	e.BlastRadius = 8
	e.Parent = workspace
end)
`, { tip: 'Click to fire a rocket' }) },
  { name: 'Flashlight', cat: 'Weapons', build: () => tool('Flashlight', 'flashlight', '#333333', '', { tip: 'Lights up dark places' }) },
  { name: 'Speed Coil', cat: 'Weapons', build: () => tool('Speed Coil', 'hammer', '#1e88e5', `
-- Hold it to run faster.
local tool = script.Parent
tool.Equipped:Connect(function()
	local h = tool.Parent:FindFirstChild("Humanoid")
	if h then h.WalkSpeed = 30 end
end)
tool.Unequipped:Connect(function()
	local h = tool.Parent:FindFirstChild("Humanoid")
	if h then h.WalkSpeed = 16 end
end)
`, { tip: 'Hold to run fast' }) },
  { name: 'Gravity Coil', cat: 'Weapons', build: () => tool('Gravity Coil', 'hammer', '#8e24aa', `
-- Hold it to jump much higher.
local tool = script.Parent
tool.Equipped:Connect(function()
	local h = tool.Parent:FindFirstChild("Humanoid")
	if h then h.JumpPower = 110 end
end)
tool.Unequipped:Connect(function()
	local h = tool.Parent:FindFirstChild("Humanoid")
	if h then h.JumpPower = 50 end
end)
`, { tip: 'Hold to jump high' }) },
  { name: 'Go-Kart', cat: 'Vehicles', build: () => kart('Go-Kart', '#c4281c', 70) },
  { name: 'Race Car', cat: 'Vehicles', build: () => kart('Race Car', '#0d69ac', 105) },
  { name: 'Monster Truck', cat: 'Vehicles', build: () => kart('Monster Truck', '#4b974b', 55, 1.6) },
  { name: 'Round System', cat: 'Gameplay', build() {
    const sc = createInstance('Script');
    sc.Name = 'RoundSystem';
    sc.Source = `-- A complete round system: intermission, everyone teleports to the map,
-- survivors get a Win. Put a SpawnLocation named "MapSpawn" in your map
-- (set Enabled = false) and a normal SpawnLocation for the lobby.
local Players = game:GetService("Players")
local INTERMISSION, ROUND = 15, 60
local hint = Instance.new("Hint", workspace)
local inRound = {}

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder", player)
	ls.Name = "leaderstats"
	local wins = Instance.new("IntValue", ls)
	wins.Name = "Wins"
	player.CharacterAdded:Connect(function(char)
		char:WaitForChild("Humanoid").Died:Connect(function() inRound[player] = nil end)
	end)
end)

while true do
	for i = INTERMISSION, 1, -1 do hint.Text = "Intermission: " .. i wait(1) end
	local mapSpawn = workspace:FindFirstChild("MapSpawn", true)
	inRound = {}
	for _, p in ipairs(Players:GetPlayers()) do
		inRound[p] = true
		if mapSpawn then p.RespawnLocation = mapSpawn end
		p:LoadCharacter()
		p.RespawnLocation = nil
	end
	for t = ROUND, 1, -1 do
		local alive = 0
		for p in pairs(inRound) do if p.Parent then alive = alive + 1 end end
		hint.Text = "Survive! " .. t .. "s  |  " .. alive .. " alive"
		wait(1)
	end
	for p in pairs(inRound) do
		if p.Parent then p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1 end
	end
	for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
end
`;
    return sc;
  } },
  { name: 'Team Setup', cat: 'Gameplay', build() {
    const sc = createInstance('Script');
    sc.Name = 'TeamSetup';
    sc.Source = `-- Makes a Red and a Blue team; players are shared out automatically.
-- Give SpawnLocations Neutral = false and the team's TeamColor.
local Teams = game:GetService("Teams")
for _, info in ipairs({ { "Red", Color3.fromRGB(196, 40, 28) }, { "Blue", Color3.fromRGB(13, 105, 172) } }) do
	if not Teams:FindFirstChild(info[1]) then
		local t = Instance.new("Team")
		t.Name = info[1]
		t.TeamColor = info[2]
		t.AutoAssignable = true
		t.Parent = Teams
	end
end
`;
    return sc;
  } },
  { name: 'VIP Door', cat: 'Gameplay', build() {
    const p = part(null, { name: 'VIPDoor', size: [6, 9, 1], color: '#f5cd30', material: 'Glass', transparency: 0.3 });
    script(p, 'VIP', `
-- Only Builders Club members can walk through.
local Players = game:GetService("Players")
local door = script.Parent
door.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player and player.MembershipType ~= "None" then
		door.CanCollide = false
		wait(1.5)
		door.CanCollide = true
	end
end)
`);
    return p;
  } },
  { name: 'Group Door', cat: 'Gameplay', build() {
    const p = part(null, { name: 'GroupDoor', size: [6, 9, 1], color: '#6b327c', material: 'Glass', transparency: 0.3 });
    script(p, 'GroupOnly', `
-- Only members of your group can walk through. Put your group's id here
-- (it's in the address of the group page: /group?id=...).
local GROUP_ID = 1
local MIN_RANK = 1 -- 1 member, 200 admin, 255 owner
local Players = game:GetService("Players")
local door = script.Parent
door.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player and player:GetRankInGroup(GROUP_ID) >= MIN_RANK then
		door.CanCollide = false
		wait(1.5)
		door.CanCollide = true
	end
end)
`);
    return p;
  } },
  { name: 'Sliding Door', cat: 'Gameplay', build() {
    const m = model('SlidingDoor');
    part(m, { name: 'Frame', size: [8, 1, 1.2], pos: [0, 9.5, 0], color: '#635f62', material: 'Metal' });
    const d = part(m, { name: 'Door', size: [6, 9, 0.8], pos: [0, 4.5, 0], color: '#a3a2a5', material: 'Metal' });
    const cd = createInstance('ClickDetector'); cd.Parent = d;
    script(d, 'Slide', `
-- Click to open and close.
local TweenService = game:GetService("TweenService")
local door = script.Parent
local closed = door.Position
local open = closed + Vector3.new(6, 0, 0)
local isOpen = false
door.ClickDetector.MouseClick:Connect(function()
	isOpen = not isOpen
	TweenService:Create(door, TweenInfo.new(0.6), {Position = isOpen and open or closed}):Play()
end)
`);
    return m;
  } },
  { name: 'Health Pack', cat: 'Gameplay', build() {
    const p = part(null, { name: 'HealthPack', size: [2.5, 2.5, 2.5], color: '#4b974b', material: 'Neon', canCollide: false });
    script(p, 'Heal', `
-- Heals 50 health, then comes back after 15 seconds.
local pack = script.Parent
local ready = true
pack.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if ready and h and h.Health > 0 and h.Health < h.MaxHealth then
		ready = false
		h.Health = h.Health + 50
		pack.Transparency = 0.9
		wait(15)
		pack.Transparency = 0
		ready = true
	end
end)
`);
    return p;
  } },
  { name: 'Trampoline', cat: 'Obby', build() {
    const m = model('Trampoline');
    part(m, { name: 'Frame', size: [10, 1, 10], pos: [0, 0.5, 0], color: '#1b1b1b' });
    const pad = part(m, { name: 'Bounce', size: [8, 0.4, 8], pos: [0, 1.1, 0], color: '#0d69ac', material: 'Fabric' });
    script(pad, 'Bounce', `
-- Super jumps for a few seconds after touching it.
local pad = script.Parent
pad.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h and h.JumpPower < 120 then
		h.JumpPower = 120
		wait(3)
		h.JumpPower = 50
	end
end)
`);
    return m;
  } },
  { name: 'Badge Giver', cat: 'Gameplay', build() {
    const p = part(null, { name: 'BadgeGiver', size: [4, 4, 4], color: '#f5cd30', material: 'Neon', shape: 'Ball', canCollide: false });
    script(p, 'Badge', `
-- Touch it to get a badge (it shows on your profile).
local Players = game:GetService("Players")
local BadgeService = game:GetService("BadgeService")
local BADGE = "Found the Secret"
script.Parent.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player then BadgeService:AwardBadge(player.UserId, BADGE) end
end)
`);
    return p;
  } },
  { name: 'Save Coins Script', cat: 'Scripts', build() {
    const sc = createInstance('Script');
    sc.Name = 'SaveCoins';
    sc.Source = `-- Saves every player's "Coins" between visits with DataStoreService.
local Players = game:GetService("Players")
local store = game:GetService("DataStoreService"):GetDataStore("Coins")

Players.PlayerAdded:Connect(function(player)
	local ls = player:FindFirstChild("leaderstats") or Instance.new("Folder", player)
	ls.Name = "leaderstats"
	local coins = ls:FindFirstChild("Coins") or Instance.new("IntValue", ls)
	coins.Name = "Coins"
	coins.Value = store:GetAsync("u" .. player.UserId) or 0
end)

Players.PlayerRemoving:Connect(function(player)
	local ls = player:FindFirstChild("leaderstats")
	if ls and ls:FindFirstChild("Coins") then store:SetAsync("u" .. player.UserId, ls.Coins.Value) end
end)
`;
    return sc;
  } },
  { name: 'Skyscraper', cat: 'Buildings', build() {
    const m = model('Skyscraper');
    for (let f = 0; f < 8; f++) {
      const y = f * 10;
      part(m, { name: 'Floor', size: [24, 1, 24], pos: [0, y + 0.5, 0], color: '#a3a2a5', material: 'Concrete' });
      for (const [x, z, sx, sz] of [[0, -11.5, 24, 1], [0, 11.5, 24, 1], [-11.5, 0, 1, 24]]) part(m, { name: 'Window', size: [sx, 9, sz], pos: [x, y + 5.5, z], color: '#6ea8d8', material: 'Glass', transparency: 0.35 });
      part(m, { cls: 'TrussPart', name: 'Stairs', size: [2, 10, 2], pos: [10, y + 5.5, 6], color: '#635f62', material: 'Metal' });
    }
    part(m, { name: 'Roof', size: [24, 1, 24], pos: [0, 80.5, 0], color: '#635f62', material: 'Concrete' });
    return m;
  } },
  { name: 'Bridge', cat: 'Buildings', build() {
    const m = model('Bridge');
    part(m, { name: 'Deck', size: [40, 1, 10], pos: [0, 6, 0], color: '#7c5c46', material: 'WoodPlanks' });
    for (const z of [-5, 5]) part(m, { name: 'Rail', size: [40, 2, 0.5], pos: [0, 7.5, z], color: '#56422f', material: 'Wood' });
    for (const x of [-18, 18]) for (const z of [-4, 4]) part(m, { name: 'Pillar', size: [1.5, 6, 1.5], pos: [x, 3, z], color: '#635f62', material: 'Concrete' });
    for (const x of [-26, 26]) part(m, { cls: 'WedgePart', name: 'Ramp', size: [10, 6, 12], pos: [x, 3, 0], rot: [0, x < 0 ? -90 : 90, 0], color: '#7c5c46', material: 'WoodPlanks' });
    return m;
  } },
  { name: 'Castle Tower', cat: 'Buildings', build() {
    const m = model('CastleTower');
    part(m, { name: 'Tower', size: [24, 12, 12], pos: [0, 12, 0], color: '#a3a2a5', material: 'Cobblestone', shape: 'Cylinder', rot: [0, 0, 90] });
    part(m, { name: 'Top', size: [16, 1, 16], pos: [0, 24.5, 0], color: '#635f62', material: 'Cobblestone' });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; part(m, { name: 'Merlon', size: [2, 3, 2], pos: [Math.cos(a) * 7, 26.5, Math.sin(a) * 7], color: '#635f62', material: 'Cobblestone' }); }
    part(m, { cls: 'TrussPart', name: 'Ladder', size: [2, 25, 2], pos: [0, 12.5, 7], color: '#7c5c46', material: 'Wood' });
    return m;
  } },
  { name: 'Shop Stand', cat: 'Buildings', build() {
    const m = model('ShopStand');
    part(m, { name: 'Counter', size: [10, 3.5, 3], pos: [0, 1.75, 0], color: '#a0703c', material: 'WoodPlanks' });
    for (const x of [-4.6, 4.6]) part(m, { name: 'Post', size: [0.6, 8, 0.6], pos: [x, 4, 1], color: '#7c5c46', material: 'Wood' });
    part(m, { name: 'Awning', size: [11, 0.4, 5], pos: [0, 8, 0.5], rot: [-12, 0, 0], color: '#c4281c', material: 'Fabric' });
    return m;
  } },
  { name: 'Pine Tree', cat: 'Decor', build() {
    const m = model('PineTree');
    part(m, { name: 'Trunk', size: [1.5, 6, 1.5], pos: [0, 3, 0], color: '#56422f', material: 'Wood' });
    for (let k = 0; k < 4; k++) part(m, { name: 'Leaves', size: [9 - k * 2, 3, 9 - k * 2], pos: [0, 6.5 + k * 2.6, 0], color: '#2c6e3a', material: 'Grass' });
    return m;
  } },
  { name: 'Rock', cat: 'Decor', build: () => part(null, { name: 'Rock', size: [6, 4, 5], rot: [8, 30, 6], color: '#635f62', material: 'Slate' }) },
  { name: 'Bench', cat: 'Decor', build() {
    const m = model('Bench');
    part(m, { cls: 'Seat', name: 'Seat', size: [8, 0.6, 2.4], pos: [0, 2, 0], color: '#a0703c', material: 'Wood' });
    part(m, { name: 'Back', size: [8, 2.4, 0.4], pos: [0, 3.4, 1.1], color: '#a0703c', material: 'Wood' });
    for (const x of [-3.4, 3.4]) part(m, { name: 'Leg', size: [0.4, 1.8, 2.2], pos: [x, 0.9, 0], color: '#1b1b1b', material: 'Metal' });
    return m;
  } },
  { name: 'Fountain', cat: 'Decor', build() {
    const m = model('Fountain');
    part(m, { name: 'Basin', size: [2, 16, 16], pos: [0, 1, 0], color: '#a3a2a5', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
    part(m, { name: 'Water', size: [0.4, 14.5, 14.5], pos: [0, 2, 0], color: '#3a8ed8', material: 'Glass', shape: 'Cylinder', rot: [0, 0, 90], transparency: 0.3, canCollide: false });
    part(m, { name: 'Pillar', size: [6, 2, 2], pos: [0, 4, 0], color: '#a3a2a5', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
    const top = part(m, { name: 'Spray', size: [1.2, 1.2, 1.2], pos: [0, 7.6, 0], color: '#cfe8ff', material: 'Neon', shape: 'Ball', canCollide: false });
    const sp = createInstance('Sparkles'); sp.Parent = top;
    return m;
  } },
  { name: 'Fence', cat: 'Decor', build() {
    const m = model('Fence');
    for (let i = 0; i < 6; i++) part(m, { name: 'Picket', size: [0.8, 4, 0.4], pos: [-5 + i * 2, 2, 0], color: '#f8f8f8', material: 'Wood' });
    for (const y of [1.2, 3]) part(m, { name: 'Rail', size: [12, 0.4, 0.3], pos: [0, y, -0.3], color: '#f8f8f8', material: 'Wood' });
    return m;
  } },
  { name: 'Sign', cat: 'Decor', build() {
    const m = model('Sign');
    part(m, { name: 'Post', size: [0.6, 6, 0.6], pos: [0, 3, 0], color: '#7c5c46', material: 'Wood' });
    const b = part(m, { name: 'Board', size: [6, 3, 0.4], pos: [0, 6, 0], color: '#a0703c', material: 'WoodPlanks' });
    const t = createInstance('BillboardText'); t.Text = 'Welcome!'; t.Parent = b;
    return m;
  } },
);

// ---------------------------------------------------------------- the big toolbox update
function fx(parent, cls, props = {}) {
  const e = createInstance(cls);
  for (const [k, v] of Object.entries(props)) e[k] = v;
  e.Parent = parent;
  return e;
}
const glow = (p, color, range = 14, brightness = 1.5) => fx(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
const sign = (p, text) => fx(p, 'BillboardText', { Text: text });
const cyl = (m, name, d, h, pos, color, material = 'SmoothPlastic', o = {}) => part(m, { name, size: [h, d, d], pos, rot: [0, 0, 90], color, material, shape: 'Cylinder', ...o });

TOOLBOX.push(
  // ---- obby
  { name: 'Double Spinner', cat: 'Obby', build() {
    const m = model('DoubleSpinner');
    cyl(m, 'Hub', 2, 3, [0, 1.5, 0], '#1b1b1b', 'Metal');
    const bar = part(m, { name: 'KillBar', size: [24, 1, 1], pos: [0, 2.5, 0], color: '#ff2a00', material: 'Neon' });
    const bar2 = part(m, { name: 'KillBar', size: [1, 1, 24], pos: [0, 2.5, 0], color: '#ff2a00', material: 'Neon' });
    script(m, 'Spin', `
-- Two red bars spin around; touching them kills.
local m = script.Parent
local bars = {}
for _, b in ipairs(m:GetChildren()) do
	if b.Name == "KillBar" then
		table.insert(bars, { part = b, cf = b.CFrame })
		b.Touched:Connect(function(hit)
			local h = hit.Parent:FindFirstChild("Humanoid")
			if h then h.Health = 0 end
		end)
	end
end
local a = 0
while true do
	a = a + 0.05
	for _, b in ipairs(bars) do b.part.CFrame = b.cf * CFrame.Angles(0, a, 0) end
	wait(0.05)
end
`);
    return m;
  } },
  { name: 'Ladder', cat: 'Obby', build: () => part(null, { cls: 'TrussPart', name: 'Ladder', size: [2, 16, 2], pos: [0, 8, 0], color: '#7c5c46', material: 'Wood' }) },
  { name: 'Stage Counter', cat: 'Obby', build() {
    const sc = createInstance('Script');
    sc.Name = 'StageCounter';
    sc.Source = `-- Put it in ServerScriptService. Name your checkpoints 1, 2, 3... (SpawnLocations
-- in a folder "Checkpoints"): the leaderboard shows the stage each player reached.
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 1
	stage.Parent = ls
end)
local folder = workspace:FindFirstChild("Checkpoints")
if folder then
	for _, cp in ipairs(folder:GetChildren()) do
		local n = tonumber(cp.Name)
		if n then
			cp.Touched:Connect(function(hit)
				local player = Players:GetPlayerFromCharacter(hit.Parent)
				if player and player.leaderstats.Stage.Value < n then
					player.leaderstats.Stage.Value = n
					player.RespawnLocation = cp
				end
			end)
		end
	end
end
`;
    return sc;
  } },
  { name: 'Lava Floor', cat: 'Obby', build() {
    const p = part(null, { name: 'Lava', size: [40, 1, 40], color: '#ff5a00', material: 'Neon' });
    script(p, 'Lava', `
script.Parent.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h then h.Health = 0 end
end)
`);
    glow(p, '#ff5a00', 30, 1);
    return p;
  } },
  // ---- gameplay
  { name: 'Countdown Timer', cat: 'Gameplay', build() {
    const p = part(null, { name: 'Timer', size: [8, 4, 1], color: '#1b1b1b', material: 'SmoothPlastic' });
    sign(p, '60');
    script(p, 'Countdown', `
-- Counts down from 60 again and again; change START to what you like.
local START = 60
local text = script.Parent.BillboardText
while true do
	for i = START, 0, -1 do
		text.Text = tostring(i)
		wait(1)
	end
	text.Text = "TIME!"
	wait(3)
end
`);
    return p;
  } },
  { name: 'Speed Shop Button', cat: 'Gameplay', build() {
    const p = part(null, { name: 'BuySpeed', size: [4, 1, 4], color: '#02b757', material: 'Neon' });
    sign(p, 'Speed: 10 Coins');
    script(p, 'Shop', `
-- Step on it to buy more speed for 10 Coins (needs a "Coins" leaderstat).
local Players = game:GetService("Players")
local busy = {}
script.Parent.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or busy[player] then return end
	busy[player] = true
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	local h = hit.Parent:FindFirstChild("Humanoid")
	if coins and h and coins.Value >= 10 then
		coins.Value = coins.Value - 10
		h.WalkSpeed = h.WalkSpeed + 4
		player:Notify("Bought speed! Now: " .. h.WalkSpeed)
	elseif coins then
		player:Notify("You need 10 Coins.")
	end
	wait(1)
	busy[player] = nil
end)
`);
    return p;
  } },
  { name: 'KO Counter', cat: 'Scripts', build() {
    const sc = createInstance('Script');
    sc.Name = 'KOCounter';
    sc.Source = `-- Put it in ServerScriptService: "KOs" and "Deaths" on the leaderboard.
-- A KO counts for the last player who hurt someone (weapons set the "creator" tag).
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local kos = Instance.new("IntValue")
	kos.Name = "KOs"
	kos.Parent = ls
	local wos = Instance.new("IntValue")
	wos.Name = "Deaths"
	wos.Parent = ls
	player.CharacterAdded:Connect(function(char)
		local h = char:WaitForChild("Humanoid")
		h.Died:Connect(function()
			wos.Value = wos.Value + 1
			local tag = h:FindFirstChild("creator")
			local killer = tag and tag.Value
			if killer and killer ~= player and killer:FindFirstChild("leaderstats") then
				killer.leaderstats.KOs.Value = killer.leaderstats.KOs.Value + 1
			end
		end)
	end)
end)
`;
    return sc;
  } },
  { name: 'Welcome Message', cat: 'Scripts', build() {
    const sc = createInstance('Script');
    sc.Name = 'WelcomeMessage';
    sc.Source = `-- Greets every player with a big message on their screen.
game:GetService("Players").PlayerAdded:Connect(function(player)
	wait(2)
	player:ShowMessage("Welcome, " .. player.Name .. "!", 4, Color3.fromRGB(255, 210, 60))
end)
`;
    return sc;
  } },
  // ---- weapons
  { name: 'Laser Sword', cat: 'Weapons', build: () => tool('Laser Sword', 'saber', '#00e5ff', `
-- A glowing saber: 40 damage to anyone close in front of you.
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function()
	if cooldown then return end
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	cooldown = true
	delay(0.6, function() cooldown = false end)
	for _, p in ipairs(Players:GetPlayers()) do
		local c = p.Character
		local r2 = c and c:FindFirstChild("HumanoidRootPart")
		local h = c and c:FindFirstChild("Humanoid")
		if c ~= char and r2 and h and (r2.Position - root.Position).Magnitude < 8 then h:TakeDamage(40) end
	end
end)
`, { tip: 'Click to swing' }) },
  { name: 'Freeze Ray', cat: 'Weapons', build: () => tool('Freeze Ray', 'gun', '#7df9ff', `
-- Click a player: they freeze for 3 seconds.
local tool = script.Parent
local Players = game:GetService("Players")
tool.Activated:Connect(function(target)
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root or not target then return end
	local hit = workspace:Raycast(root.Position, (target - root.Position).Unit * 200, char)
	local h = hit and hit.Instance.Parent:FindFirstChild("Humanoid")
	if h and h.WalkSpeed > 0 then
		local speed, jump = h.WalkSpeed, h.JumpPower
		h.WalkSpeed = 0
		h.JumpPower = 0
		wait(3)
		h.WalkSpeed = speed
		h.JumpPower = jump
	end
end)
`, { tip: 'Freezes a player' }) },
  { name: 'Torch', cat: 'Weapons', build: () => tool('Torch', 'torch', '#ff8a3d', '', { tip: 'A burning torch' }) },
  { name: 'Healing Staff', cat: 'Weapons', build: () => tool('Healing Staff', 'brush', '#5bd6a0', `
-- Click to heal yourself and everyone close by (+30).
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function()
	if cooldown then return end
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	cooldown = true
	for _, p in ipairs(Players:GetPlayers()) do
		local c = p.Character
		local r2 = c and c:FindFirstChild("HumanoidRootPart")
		local h = c and c:FindFirstChild("Humanoid")
		if r2 and h and (r2.Position - root.Position).Magnitude < 15 then h.Health = math.min(h.MaxHealth, h.Health + 30) end
	end
	wait(5)
	cooldown = false
end)
`, { tip: 'Heals you and your friends' }) },
  // ---- vehicles
  { name: 'Police Car', cat: 'Vehicles', build() {
    const m = kart('Police Car', '#f8f8f8', 90, 1.2);
    const bar = part(m, { name: 'LightBar', size: [3, 0.5, 1], pos: [0, 2.8, -0.5], color: '#ff2a2a', material: 'Neon', canCollide: false });
    script(bar, 'Siren', `
local bar = script.Parent
while true do
	bar.Color = Color3.fromRGB(255, 40, 40)
	wait(0.4)
	bar.Color = Color3.fromRGB(40, 90, 255)
	wait(0.4)
end
`);
    return m;
  } },
  { name: 'Bus', cat: 'Vehicles', build() {
    const m = model('Bus');
    part(m, { name: 'Body', size: [6, 5, 18], pos: [0, 3.5, 0], color: '#f5cd30', material: 'SmoothPlastic' });
    part(m, { name: 'Windows', size: [6.1, 1.6, 15], pos: [0, 4.6, 0.5], color: '#6ea8d8', material: 'Glass', transparency: 0.3, canCollide: false });
    const seat = part(m, { cls: 'VehicleSeat', name: 'Seat', size: [2, 1, 2], pos: [0, 6.5, -6], color: '#1b1b1b' });
    seat.MaxSpeed = 50;
    for (let i = 0; i < 3; i++) part(m, { cls: 'Seat', name: 'Passenger', size: [4, 0.6, 2], pos: [0, 6.3, -1 + i * 3.5], color: '#c4281c' });
    for (const [x, z] of [[-3, -6], [3, -6], [-3, 6], [3, 6]]) part(m, { name: 'Wheel', size: [1, 2.6, 2.6], pos: [x, 1.3, z], color: '#1b1b1b', shape: 'Cylinder' });
    return m;
  } },
  { name: 'Tractor', cat: 'Vehicles', build() {
    const m = kart('Tractor', '#4b974b', 35, 1.3);
    part(m, { name: 'Exhaust', size: [0.5, 3, 0.5], pos: [1.5, 3.6, -2.5], color: '#1b1b1b', material: 'Metal' });
    return m;
  } },
  // ---- buildings
  { name: 'Watchtower', cat: 'Buildings', build() {
    const m = model('Watchtower');
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) part(m, { name: 'Leg', size: [1, 20, 1], pos: [x, 10, z], color: '#7c5c46', material: 'Wood' });
    part(m, { name: 'Deck', size: [10, 1, 10], pos: [0, 20.5, 0], color: '#a0703c', material: 'WoodPlanks' });
    part(m, { cls: 'TrussPart', name: 'Ladder', size: [2, 20, 2], pos: [0, 10, 5], color: '#7c5c46', material: 'Wood' });
    for (const [x, z, sx, sz] of [[0, -5, 10, 0.5], [-5, 0, 0.5, 10], [5, 0, 0.5, 10]]) part(m, { name: 'Rail', size: [sx, 2, sz], pos: [x, 22, z], color: '#7c5c46', material: 'Wood' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [11, 3, 5.5], pos: [0, 27, -2.75], color: '#56422f' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [11, 3, 5.5], pos: [0, 27, 2.75], rot: [0, 180, 0], color: '#56422f' });
    for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) part(m, { name: 'RoofPost', size: [0.5, 4, 0.5], pos: [x, 23.5, z], color: '#7c5c46', material: 'Wood' });
    return m;
  } },
  { name: 'Concert Stage', cat: 'Buildings', build() {
    const m = model('Stage');
    part(m, { name: 'Stage', size: [30, 3, 16], pos: [0, 1.5, 0], color: '#1b1b1b', material: 'WoodPlanks' });
    part(m, { name: 'Back', size: [30, 14, 1], pos: [0, 10, -7.5], color: '#2b2b40', material: 'Fabric' });
    const cols = ['#ff3b3b', '#3bff6b', '#3bb0ff', '#ffc400', '#ff3bd2'];
    const lights = model('Lights');
    lights.Parent = m;
    cols.forEach((c, i) => { const l = part(lights, { name: 'Light', size: [1.6, 1.6, 1.6], pos: [-12 + i * 6, 15, -6], color: c, material: 'Neon', shape: 'Ball' }); glow(l, c, 20, 1.5); });
    script(lights, 'Party', `
-- The stage lights change colour to the beat.
local cols = { Color3.fromRGB(255, 59, 59), Color3.fromRGB(59, 255, 107), Color3.fromRGB(59, 176, 255), Color3.fromRGB(255, 196, 0), Color3.fromRGB(255, 59, 210) }
local i = 0
while true do
	i = i + 1
	for k, l in ipairs(script.Parent:GetChildren()) do
		if l:IsA("BasePart") then l.Color = cols[(i + k) % #cols + 1] end
	end
	wait(0.5)
end
`);
    return m;
  } },
  { name: 'Swimming Pool', cat: 'Buildings', build() {
    const m = model('Pool');
    part(m, { name: 'Edge', size: [28, 1, 20], pos: [0, 0.5, 0], color: '#f8f8f8', material: 'Concrete' });
    part(m, { name: 'Water', size: [24, 0.6, 16], pos: [0, 1.1, 0], color: '#3fb6e8', material: 'Glass', transparency: 0.3, canCollide: false });
    part(m, { name: 'Board', size: [2, 0.4, 8], pos: [0, 4, -11], color: '#4fc3ff', material: 'SmoothPlastic' });
    part(m, { name: 'BoardPost', size: [1, 4, 1], pos: [0, 2, -14], color: '#f8f8f8', material: 'Metal' });
    return m;
  } },
  { name: 'Barn', cat: 'Buildings', build() {
    const m = model('Barn');
    part(m, { name: 'Walls', size: [20, 12, 16], pos: [0, 6, 0], color: '#a83232', material: 'WoodPlanks' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [21, 6, 8.5], pos: [0, 15, -4.25], color: '#4a4a4a' });
    part(m, { cls: 'WedgePart', name: 'Roof', size: [21, 6, 8.5], pos: [0, 15, 4.25], rot: [0, 180, 0], color: '#4a4a4a' });
    part(m, { name: 'Door', size: [8, 9, 0.4], pos: [0, 4.5, 8.1], color: '#f8f8f8', material: 'WoodPlanks' });
    for (const x of [-3, 3]) part(m, { name: 'Hay', size: [3, 2, 2], pos: [x + 8, 1, 10], color: '#e8c15a', material: 'Fabric' });
    return m;
  } },
  // ---- decor
  { name: 'Street Lamp (night)', cat: 'Decor', build() {
    const m = model('StreetLamp');
    part(m, { name: 'Post', size: [0.6, 12, 0.6], pos: [0, 6, 0], color: '#2b2b2b', material: 'Metal' });
    const b = part(m, { name: 'Bulb', size: [1.6, 1.6, 1.6], pos: [0, 12.5, 0], color: '#fff3c4', material: 'Neon', shape: 'Ball', canCollide: false });
    glow(b, '#ffe7a0', 24, 0);
    script(b, 'NightLight', `
-- Turns on at night, off in the day.
local Lighting = game:GetService("Lighting")
local light = script.Parent:FindFirstChildOfClass("PointLight")
while true do
	local t = Lighting.ClockTime
	light.Brightness = (t < 6.5 or t > 18) and 2 or 0
	wait(1)
end
`);
    return m;
  } },
  { name: 'Palm Tree', cat: 'Decor', build() {
    const m = model('PalmTree');
    for (let i = 0; i < 5; i++) part(m, { name: 'Trunk', size: [1.4, 3, 1.4], pos: [i * 0.3, 1.5 + i * 2.8, 0], rot: [0, 0, -4], color: '#8a6a43', material: 'Wood' });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 360; part(m, { name: 'Leaf', size: [8, 0.3, 2], pos: [1.5 + Math.cos(a * Math.PI / 180) * 3.5, 15, Math.sin(a * Math.PI / 180) * 3.5], rot: [0, -a, -20], color: '#2f8f4f', material: 'Grass', canCollide: false }); }
    return m;
  } },
  { name: 'Picnic Table', cat: 'Decor', build() {
    const m = model('PicnicTable');
    part(m, { name: 'Top', size: [8, 0.5, 3.5], pos: [0, 3, 0], color: '#a0703c', material: 'WoodPlanks' });
    for (const z of [-2.8, 2.8]) part(m, { cls: 'Seat', name: 'Bench', size: [8, 0.5, 1.4], pos: [0, 1.8, z], color: '#a0703c', material: 'WoodPlanks' });
    for (const x of [-3, 3]) part(m, { name: 'Leg', size: [0.5, 3, 6], pos: [x, 1.5, 0], color: '#7c5c46', material: 'Wood' });
    return m;
  } },
  { name: 'Flower Bed', cat: 'Decor', build() {
    const m = model('FlowerBed');
    part(m, { name: 'Soil', size: [8, 1, 4], pos: [0, 0.5, 0], color: '#56422f', material: 'Grass' });
    const cols = ['#ff4d8d', '#ffd166', '#b45cff', '#ff7a1a', '#ffffff'];
    for (let i = 0; i < 10; i++) {
      const x = -3.2 + (i % 5) * 1.6, z = i < 5 ? -0.9 : 0.9;
      part(m, { name: 'Stem', size: [0.2, 1.4, 0.2], pos: [x, 1.7, z], color: '#2f8f4f', canCollide: false });
      part(m, { name: 'Flower', size: [0.8, 0.8, 0.8], pos: [x, 2.6, z], color: cols[i % cols.length], shape: 'Ball', canCollide: false });
    }
    return m;
  } },
  { name: 'Snowman', cat: 'Decor', build() {
    const m = model('Snowman');
    part(m, { name: 'Bottom', size: [4, 4, 4], pos: [0, 2, 0], color: '#ffffff', shape: 'Ball' });
    part(m, { name: 'Middle', size: [3, 3, 3], pos: [0, 5, 0], color: '#ffffff', shape: 'Ball' });
    part(m, { name: 'Head', size: [2.2, 2.2, 2.2], pos: [0, 7.4, 0], color: '#ffffff', shape: 'Ball' });
    part(m, { name: 'Nose', size: [0.3, 0.3, 1.2], pos: [0, 7.4, -1.4], color: '#ff8a3d', canCollide: false });
    part(m, { name: 'Hat', size: [1.6, 1.4, 1.6], pos: [0, 9, 0], color: '#1b1b1b', shape: 'Cylinder', rot: [0, 0, 90] });
    return m;
  } },
  { name: 'Christmas Tree', cat: 'Decor', build() {
    const m = model('ChristmasTree');
    part(m, { name: 'Trunk', size: [1.5, 3, 1.5], pos: [0, 1.5, 0], color: '#56422f', material: 'Wood' });
    for (let k = 0; k < 4; k++) part(m, { name: 'Leaves', size: [3, 10 - k * 2.2, 10 - k * 2.2], pos: [0, 4 + k * 2.6, 0], rot: [0, 0, 90], color: '#1f7a3a', material: 'Grass', shape: 'Cylinder' });
    const star = part(m, { name: 'Star', size: [1.6, 1.6, 1.6], pos: [0, 14.5, 0], rot: [45, 0, 45], color: '#ffd166', material: 'Neon', canCollide: false });
    glow(star, '#ffd166', 20, 1.5);
    const cols = ['#ff4d6d', '#4fc3ff', '#ffd166', '#38d27a'];
    for (let i = 0; i < 14; i++) { const a = i * 1.3, r = 4.4 - (i / 14) * 3; part(m, { name: 'Ornament', size: [0.7, 0.7, 0.7], pos: [Math.sin(a) * r, 4 + i * 0.7, Math.cos(a) * r], color: cols[i % 4], material: 'Neon', shape: 'Ball', canCollide: false }); }
    return m;
  } },
  // ---- Halloween
  { name: "Jack-o'-Lantern", cat: 'Halloween', build() {
    const m = model('JackOLantern');
    const p = part(m, { name: 'Pumpkin', size: [4, 3.4, 4], pos: [0, 1.7, 0], color: '#ff7a1a', material: 'SmoothPlastic', shape: 'Ball' });
    part(m, { name: 'Stem', size: [0.5, 1, 0.5], pos: [0, 3.7, 0], color: '#3f6b2f', material: 'Wood' });
    for (const x of [-0.8, 0.8]) part(m, { name: 'Eye', size: [0.7, 0.7, 0.2], pos: [x, 2.2, -1.95], rot: [0, 0, 45], color: '#ffd23b', material: 'Neon', canCollide: false });
    part(m, { name: 'Mouth', size: [1.8, 0.4, 0.2], pos: [0, 1.2, -1.95], color: '#ffd23b', material: 'Neon', canCollide: false });
    glow(p, '#ff9a2a', 14, 1.5);
    return m;
  } },
  { name: 'Gravestone', cat: 'Halloween', build() {
    const m = model('Gravestone');
    part(m, { name: 'Stone', size: [3, 4, 0.8], pos: [0, 2, 0], rot: [0, 0, 4], color: '#8a8590', material: 'Slate' });
    cyl(m, 'Top', 3, 0.8, [0, 4, 0], '#8a8590', 'Slate', { rot: [0, 90, 0] });
    part(m, { name: 'Dirt', size: [3, 0.3, 6], pos: [0, 0.15, -3.5], color: '#4a3626', material: 'Grass' });
    const b = part(m, { name: 'Text', size: [2, 1, 0.1], pos: [0, 2.4, -0.45], transparency: 1, canCollide: false });
    sign(b, 'R.I.P.');
    return m;
  } },
  { name: 'Spooky Tree', cat: 'Halloween', build() {
    const m = model('SpookyTree');
    part(m, { name: 'Trunk', size: [1.6, 14, 1.6], pos: [0, 7, 0], rot: [0, 0, 4], color: '#2b2118', material: 'Wood' });
    for (const [x, y, rz, ry] of [[2.5, 10, 35, 0], [-2.5, 8, -40, 30], [1.5, 12.5, 60, 120], [-1.5, 11.5, -55, 200]]) part(m, { name: 'Branch', size: [6, 0.7, 0.7], pos: [x, y, 0], rot: [0, ry, rz], color: '#2b2118', material: 'Wood', canCollide: false });
    return m;
  } },
  { name: 'Floating Ghost', cat: 'Halloween', build() {
    const m = model('Ghost');
    const body = part(m, { name: 'Body', size: [3, 4, 3], pos: [0, 5, 0], color: '#f4f8ff', material: 'SmoothPlastic', shape: 'Ball', transparency: 0.25, canCollide: false });
    for (const x of [-0.6, 0.6]) part(m, { name: 'Eye', size: [0.5, 0.8, 0.2], pos: [x, 5.6, -1.4], color: '#1b1b1b', canCollide: false });
    script(m, 'Float', `
-- The ghost bobs up and down and turns around. Boo!
local m = script.Parent
local parts = {}
for _, p in ipairs(m:GetChildren()) do if p:IsA("BasePart") then parts[p] = p.CFrame end end
local t = 0
while true do
	t = t + 0.05
	for p, cf in pairs(parts) do p.CFrame = CFrame.new(0, math.sin(t * 2) * 1.2, 0) * cf end
	wait(0.05)
end
`);
    glow(body, '#cfe8ff', 10, 0.8);
    return m;
  } },
  { name: 'Witch Cauldron', cat: 'Halloween', build() {
    const m = model('Cauldron');
    part(m, { name: 'Pot', size: [4.4, 3.6, 4.4], pos: [0, 2, 0], color: '#1b1b1b', material: 'Metal', shape: 'Ball' });
    const brew = cyl(m, 'Brew', 3.6, 0.3, [0, 3.4, 0], '#5bff4d', 'Neon', { canCollide: false });
    fx(brew, 'Sparkles', { SparkleColor: Color3.fromHex('#9bff8a') });
    glow(brew, '#5bff4d', 16, 1.5);
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [0, 1.8]]) part(m, { name: 'Leg', size: [0.4, 1, 0.4], pos: [x, 0.5, z], color: '#1b1b1b', material: 'Metal' });
    return m;
  } },
  { name: 'Haunted Door', cat: 'Halloween', build() {
    const p = part(null, { name: 'HauntedDoor', size: [5, 8, 0.6], color: '#3b2a1e', material: 'WoodPlanks' });
    sign(p, 'Knock... if you dare');
    script(p, 'Haunted', `
-- Touch it: the door opens by itself... then slams shut. A message scares the player.
local door = script.Parent
local busy = false
door.Touched:Connect(function(hit)
	local player = game:GetService("Players"):GetPlayerFromCharacter(hit.Parent)
	if not player or busy then return end
	busy = true
	door.Transparency = 0.8
	door.CanCollide = false
	player:ShowMessage("BOO!", 1.5, Color3.fromRGB(255, 80, 30))
	wait(2)
	door.Transparency = 0
	door.CanCollide = true
	wait(1)
	busy = false
end)
`);
    return p;
  } },
);

// Categories for the Toolbox filter (older entries get theirs here).
const OLD_CATS = {
  'Kill Brick': 'Obby', Checkpoint: 'Obby', Spinner: 'Obby', 'Moving Platform': 'Obby', 'Disappearing Brick': 'Obby', 'Speed Pad': 'Obby', 'Jump Pad': 'Obby',
  Coin: 'Gameplay', Teleporter: 'Gameplay', 'Push Button': 'Gameplay', 'Lamp Post': 'Decor', Tree: 'Decor', Campfire: 'Decor',
  'Brick House': 'Buildings', 'Leaderboard Script': 'Scripts', 'Day/Night Script': 'Scripts',
};
for (const t of TOOLBOX) if (!t.cat) t.cat = OLD_CATS[t.name] || 'Gameplay';
export const TOOLBOX_CATEGORIES = ['All', 'Obby', 'Gameplay', 'Weapons', 'Vehicles', 'Buildings', 'Decor', 'Halloween', 'Scripts'];

let thumbCache = new Map();
export async function toolboxThumb(entry) {
  if (thumbCache.has(entry.name)) return thumbCache.get(entry.name);
  const p = (async () => {
    const { renderPlace } = await import('../render/thumbs.js');
    const game = new DataModel();
    const inst = entry.build();
    if (inst.IsA('BaseScript') || inst.ClassName === 'Tool') return null;
    inst.Parent = game.Workspace;
    return renderPlace(null, 176, { game, fit: true });
  })();
  thumbCache.set(entry.name, p);
  return p;
}
