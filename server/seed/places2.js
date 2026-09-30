// More showcase games (added after the first five). Every game is built from
// code: parts plus server Scripts written in Robis Lua.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, spawn, tree, finish } from './builder.js';

const RAINBOW = ['#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc'];

// A floating lobby with glass walls, used by the round-based games.
function lobby(ws, y, color = '#a3a2a5') {
  const m = model(ws, 'Lobby');
  part(m, { name: 'LobbyFloor', size: [40, 2, 40], pos: [0, y, 0], color, material: 'Marble' });
  part(m, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [10, 1, 10], pos: [0, y + 1.5, 0], color: '#f8f8f8' });
  for (const [x, z, sx, sz] of [[0, -20, 40, 1], [0, 20, 40, 1], [-20, 0, 1, 40], [20, 0, 1, 40]]) {
    part(m, { name: 'Glass', size: [sx, 8, sz], pos: [x, y + 5, z], color: '#b4d2e4', material: 'Glass', transparency: 0.6 });
  }
  return m;
}

const WINS_STATS = `
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local inRound = Instance.new("BoolValue")
	inRound.Name = "InRound"
	inRound.Parent = player
end)
`;

// ================================================================ Disaster Island
function disasterMap(parent) {
  const map = model(parent, 'Map');
  const house = (x, z, color) => {
    const h = model(map, 'House');
    part(h, { name: 'Floor', size: [20, 1, 16], pos: [x, 2.5, z], color: '#7c5c46', material: 'WoodPlanks' });
    part(h, { name: 'Wall', size: [20, 10, 1], pos: [x, 8, z - 7.5], color, material: 'Brick' });
    part(h, { name: 'Wall', size: [1, 10, 16], pos: [x - 9.5, 8, z], color, material: 'Brick' });
    part(h, { name: 'Wall', size: [1, 10, 16], pos: [x + 9.5, 8, z], color, material: 'Brick' });
    part(h, { name: 'Wall', size: [7, 10, 1], pos: [x - 6.5, 8, z + 7.5], color, material: 'Brick' });
    part(h, { name: 'Wall', size: [7, 10, 1], pos: [x + 6.5, 8, z + 7.5], color, material: 'Brick' });
    part(h, { name: 'Roof', size: [22, 1, 18], pos: [x, 13.5, z], color: '#56422f', material: 'Wood' });
    part(h, { cls: 'TrussPart', name: 'Ladder', size: [2, 12, 2], pos: [x + 11, 8, z], color: '#a3a2a5', material: 'Metal' });
  };
  house(-40, -35, '#c4281c');
  house(40, -35, '#0d69ac');
  house(-40, 30, '#f5cd30');
  const tower = model(map, 'Tower');
  for (let f = 0; f < 4; f++) {
    const y = 2 + f * 9;
    part(tower, { name: 'TowerFloor', size: [14, 1, 14], pos: [35, y + 0.5, 35], color: '#a3a2a5', material: 'Concrete' });
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      part(tower, { name: 'Pillar', size: [1.5, 9, 1.5], pos: [35 + dx, y + 5, 35 + dz], color: '#635f62', material: 'Concrete' });
    }
  }
  part(tower, { name: 'TowerTop', size: [14, 1, 14], pos: [35, 38.5, 35], color: '#a3a2a5', material: 'Concrete' });
  part(tower, { cls: 'TrussPart', name: 'Ladder', size: [2, 37, 2], pos: [35, 20.5, 43], color: '#f5cd30', material: 'Metal' });
  for (const [x, z] of [[-10, -55], [15, 60], [-65, 0], [60, -5], [0, 10]]) tree(map, x, z, 2);
  return map;
}

export function gameDisaster() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13.5;
  part(ws, { name: 'Sea', size: [700, 20, 700], pos: [0, -12, 0], color: '#2f7fb5', material: 'Glass', top: 'Smooth', props: { Locked: true } });
  part(ws, { name: 'Beach', size: [176, 3.6, 176], pos: [0, -0.2, 0], color: '#d7c59a', material: 'Sand' });
  part(ws, { name: 'Island', size: [160, 4, 160], pos: [0, 0, 0], color: '#4b974b', material: 'Grass' });
  part(ws, { cls: 'SpawnLocation', name: 'IslandSpawn', size: [12, 1, 12], pos: [0, 2.5, -10], color: '#f5cd30', props: { Enabled: false } });
  lobby(ws, 160);
  disasterMap(ws);
  disasterMap(g.ServerStorage);
  part(ws, { name: 'Flood', size: [700, 2, 700], pos: [0, -4, 0], color: '#1e6fb8', material: 'Glass', transparency: 0.35, canCollide: false });
  script(g.ServerScriptService, 'Disasters', `
-- Natural disasters: survive the round to earn a Win.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local storage = game:GetService("ServerStorage")
local lobbySpawn = workspace.Lobby.LobbySpawn
local islandSpawn = workspace.IslandSpawn
local flood = workspace.Flood
local hint = Instance.new("Hint", workspace)
local flooding = false
${WINS_STATS}
flood.Touched:Connect(function(hit)
	if not flooding then return end
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h then h:TakeDamage(100) end
end)

local function announce(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

local function resetMap()
	local old = workspace:FindFirstChild("Map")
	if old then old:Destroy() end
	storage.Map:Clone().Parent = workspace
end

local function alivePlayers()
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if h and h.Health > 0 and p.InRound.Value then table.insert(list, p) end
	end
	return list
end

local disasters = {
	{ name = "Flash Flood", tip = "Get up high!", run = function(t)
		flooding = true
		TweenService:Create(flood, TweenInfo.new(10, Enum.EasingStyle.Sine), {Position = Vector3.new(0, 11, 0)}):Play()
		wait(t)
		flooding = false
		TweenService:Create(flood, TweenInfo.new(3), {Position = Vector3.new(0, -4, 0)}):Play()
	end },
	{ name = "Meteor Shower", tip = "Watch the sky and keep moving!", run = function(t)
		local stop = tick() + t
		while tick() < stop do
			local target = Vector3.new(math.random(-75, 75), 2, math.random(-75, 75))
			local m = Instance.new("Part")
			m.Name = "Meteor"
			m.Shape = Enum.PartType.Ball
			m.Size = Vector3.new(4, 4, 4)
			m.Material = Enum.Material.Neon
			m.Color = Color3.fromRGB(255, 110, 20)
			m.Anchored = true
			m.CanCollide = false
			m.Position = target + Vector3.new(30, 120, 0)
			m.Parent = workspace
			Instance.new("Fire", m)
			local fall = TweenService:Create(m, TweenInfo.new(1.4, Enum.EasingStyle.Linear), {Position = target})
			fall:Play()
			delay(1.4, function()
				local e = Instance.new("Explosion")
				e.Position = target
				e.BlastRadius = 9
				e.Parent = workspace
				m:Destroy()
			end)
			wait(0.35)
		end
	end },
	{ name = "Earthquake", tip = "Get out of the buildings!", run = function(t)
		for _, d in ipairs(workspace.Map:GetDescendants()) do
			if d:IsA("BasePart") and d.Name ~= "Leaves" and d.Name ~= "Trunk" then d.Anchored = false end
		end
		local stop = tick() + t
		while tick() < stop do
			local e = Instance.new("Explosion")
			e.Position = Vector3.new(math.random(-60, 60), 1, math.random(-60, 60))
			e.BlastRadius = 3
			e.BlastPressure = 200000
			e.Parent = workspace
			wait(1)
		end
	end },
}

while true do
	for i = 10, 1, -1 do
		hint.Text = "Intermission: " .. i
		wait(1)
	end
	if #Players:GetPlayers() == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		resetMap()
		hint.Text = "Teleporting to the island..."
		for _, p in ipairs(Players:GetPlayers()) do
			p.InRound.Value = true
			p.RespawnLocation = islandSpawn
			p:LoadCharacter()
			p.RespawnLocation = lobbySpawn
		end
		wait(4)
		local d = disasters[math.random(1, #disasters)]
		announce("Disaster: " .. d.name .. "! " .. d.tip, 4)
		hint.Text = d.name .. "!"
		local done = false
		spawn(function() d.run(30); done = true end)
		for t = 30, 1, -1 do
			hint.Text = d.name .. "!  " .. t .. "s  |  " .. #alivePlayers() .. " alive"
			wait(1)
		end
		while not done do wait(0.5) end
		local winners = alivePlayers()
		local names = {}
		for _, p in ipairs(winners) do
			p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
			table.insert(names, p.Name)
		end
		hint.Text = #names > 0 and ("Survivors: " .. table.concat(names, ", ")) or "Nobody survived!"
		for _, p in ipairs(Players:GetPlayers()) do p.InRound.Value = false end
		wait(4)
		for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
	end
end
`);
  return finish(g, { name: 'Disaster Island' });
}

// ================================================================ Tower of Robis
export function gameTower() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 15;
  baseplate(ws, { color: '#6b327c', size: [300, 20, 300] });
  spawn(ws, [0, 0.5, 26], { color: '#f8f8f8' });
  const kill = folder(ws, 'KillBricks');
  const cps = folder(ws, 'Checkpoints');
  // A path that spirals up around the core.
  let a = Math.PI / 2, y = 1, stage = 1;
  const R = 16;
  const at = (ang) => [Math.cos(ang) * R, Math.sin(ang) * R];
  for (let i = 0; i < 44; i++) {
    const color = RAINBOW[Math.floor(i / 6) % RAINBOW.length];
    const [x, z] = at(a);
    if (i > 0 && i % 8 === 0) {
      part(cps, { cls: 'SpawnLocation', name: String(++stage), size: [6, 1, 6], pos: [x, y, z], color: '#f8f8f8', props: { Enabled: false } });
    } else if (i % 11 === 5) {
      // Truss outside the platform: climb it to a ledge further out.
      part(ws, { name: 'Platform', size: [5, 1, 5], pos: [x, y, z], color });
      const k = (R + 3.5) / R, k2 = (R + 7) / R;
      part(ws, { cls: 'TrussPart', name: 'Truss', size: [2, 11, 2], pos: [x * k, y + 5, z * k], color: '#a3a2a5', material: 'Metal' });
      y += 10;
      part(ws, { name: 'Ledge', size: [5, 1, 5], pos: [x * k2, y, z * k2], color });
      y -= 2.2;
    } else if (i % 5 === 3) {
      // Lava next to a small safe block.
      const ki = (R - 2) / R, ko = (R + 2) / R;
      part(ws, { name: 'Safe', size: [3, 1, 3], pos: [x * ki, y, z * ki], color: '#f8f8f8' });
      part(kill, { name: 'Lava', size: [3, 1.2, 3], pos: [x * ko, y, z * ko], color: '#ff2a00', material: 'Neon' });
    } else {
      part(ws, { name: 'Platform', size: i % 3 === 0 ? [4, 1, 4] : [5, 1, 5], pos: [x, y, z], color });
    }
    a += 0.42;
    y += 2.2;
  }
  const top = y + 1;
  part(ws, { name: 'Core', size: [top - 1, 18, 18], pos: [0, (top - 1) / 2, 0], color: '#635f62', material: 'Slate', shape: 'Cylinder', rot: [0, 0, 90] });
  part(ws, { name: 'TopBridge', size: [4, 1, 10], pos: [Math.cos(a) * 11, top, Math.sin(a) * 11], rot: [0, -a * 180 / Math.PI + 90, 0], color: '#f8f8f8' });
  const fin = part(ws, { name: 'Finish', size: [20, 1, 20], pos: [0, top + 0.5, 0], color: '#ffc400', material: 'Neon' });
  inst(fin, 'BillboardText', { Text: 'THE TOP!', StudsOffset: new Vector3(0, 6, 0) });
  script(g.ServerScriptService, 'KillScript', `
local folder = workspace:WaitForChild("KillBricks")
for _, part in ipairs(folder:GetChildren()) do
	part.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h then h.Health = 0 end
	end)
end
`);
  script(g.ServerScriptService, 'Tower', `
-- Climb the tower: checkpoints save your stage, the top gives a Win.
local Players = game:GetService("Players")
local BadgeService = game:GetService("BadgeService")
local checkpoints = workspace.Checkpoints

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 1
	stage.Parent = ls
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
end)

for _, cp in ipairs(checkpoints:GetChildren()) do
	cp.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		local n = tonumber(cp.Name)
		if player and n and n > player.leaderstats.Stage.Value then
			player.leaderstats.Stage.Value = n
			player.RespawnLocation = cp
		end
	end)
end

-- Fell to the ground? Back to your checkpoint.
workspace.Baseplate.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if player and h and h.Health > 0 and player.leaderstats.Stage.Value > 1 then h.Health = 0 end
end)

local cooldown = {}
workspace.Finish.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or cooldown[player] then return end
	cooldown[player] = true
	player.leaderstats.Wins.Value = player.leaderstats.Wins.Value + 1
	BadgeService:AwardBadge(player.UserId, "Tower Climber")
	local m = Instance.new("Message")
	m.Text = player.Name .. " reached the top of the Tower of Robis!"
	m.Parent = workspace
	game:GetService("Debris"):AddItem(m, 4)
	wait(4)
	player.leaderstats.Stage.Value = 1
	player.RespawnLocation = nil
	player:LoadCharacter()
	cooldown[player] = nil
end)
`);
  return finish(g, { name: 'Tower of Robis' });
}

// ================================================================ Speed Run
export function gameSpeedRun() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 0.5;
  g.Lighting.Ambient = Color3.fromRGB(90, 90, 120);
  baseplate(ws, { color: '#111111', size: [400, 20, 700], material: 'SmoothPlastic', top: 'Smooth' });
  spawn(ws, [0, 0.5, 20], { color: '#1b2a35' });
  const start = part(ws, { name: 'Start', size: [16, 0.4, 3], pos: [0, 0.2, 8], color: '#00ff00', material: 'Neon' });
  inst(start, 'BillboardText', { Text: 'START', StudsOffset: new Vector3(0, 4, 0) });
  const kill = folder(ws, 'KillBricks');
  const pads = folder(ws, 'SpeedPads');
  let z = 0, y = 0;
  const lane = (len, color, x = 0, w = 10) => { part(ws, { name: 'Track', size: [w, 1, len], pos: [x, y + 0.5, z - len / 2], color, material: 'Neon' }); z -= len; };
  // 1: straight with speed pad
  lane(40, '#0d69ac');
  part(pads, { name: 'Pad', size: [8, 0.3, 4], pos: [0, y + 1.15, z + 6], color: '#00ff00', material: 'Neon' });
  // 2: jumps over the void
  for (let i = 0; i < 6; i++) { z -= 9; y += 1; part(ws, { name: 'Jump', size: [6, 1, 6], pos: [(i % 2 ? 3 : -3), y + 0.5, z], color: RAINBOW[i], material: 'Neon' }); }
  z -= 6;
  // 3: long runway with lava stripes to hop
  const runStart = z;
  lane(80, '#6b327c');
  for (let i = 1; i < 6; i++) part(kill, { name: 'Stripe', size: [10, 1.1, 2], pos: [0, y + 0.55, runStart - i * 14], color: '#ff2a00', material: 'Neon' });
  part(pads, { name: 'Pad', size: [8, 0.3, 4], pos: [0, y + 1.15, runStart - 4], color: '#00ff00', material: 'Neon' });
  // 4: zig-zag narrow path
  for (let i = 0; i < 6; i++) { part(ws, { name: 'Zig', size: [3, 1, 12], pos: [(i % 2 ? 4 : -4), y + 0.5, z - 6], color: '#f5cd30', material: 'Neon' }); part(ws, { name: 'Zag', size: [11, 1, 3], pos: [0, y + 0.5, z - 12], color: '#f5cd30', material: 'Neon' }); z -= 12; }
  // 5: stairs up
  for (let i = 0; i < 8; i++) { z -= 5; y += 1.6; part(ws, { name: 'Stair', size: [10, 1, 5], pos: [0, y + 0.5, z], color: '#04afec', material: 'Neon' }); }
  z -= 10;
  const fin = part(ws, { name: 'Finish', size: [16, 1, 16], pos: [0, y + 0.5, z], color: '#ffc400', material: 'Neon' });
  inst(fin, 'BillboardText', { Text: 'FINISH', StudsOffset: new Vector3(0, 5, 0) });
  script(g.ServerScriptService, 'SpeedRun', `
-- Run from START to FINISH as fast as you can. Your best time is saved.
local Players = game:GetService("Players")
local store = game:GetService("DataStoreService"):GetDataStore("SpeedRunBest")
local started = {}

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local last = Instance.new("NumberValue")
	last.Name = "Time"
	last.Parent = ls
	local best = Instance.new("NumberValue")
	best.Name = "Best"
	best.Value = store:GetAsync("u" .. player.UserId) or 0
	best.Parent = ls
end)
Players.PlayerRemoving:Connect(function(player) started[player] = nil end)

workspace.Start.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player then started[player] = tick() end
end)

workspace.Finish.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or not started[player] then return end
	local t = math.floor((tick() - started[player]) * 10) / 10
	started[player] = nil
	local ls = player.leaderstats
	ls.Time.Value = t
	local m = Instance.new("Message")
	if ls.Best.Value == 0 or t < ls.Best.Value then
		ls.Best.Value = t
		store:SetAsync("u" .. player.UserId, t)
		m.Text = player.Name .. " set a new record: " .. t .. "s!"
	else
		m.Text = player.Name .. " finished in " .. t .. "s"
	end
	m.Parent = workspace
	game:GetService("Debris"):AddItem(m, 3)
	wait(3)
	player:LoadCharacter()
end)

-- Falling off the course ends the run.
workspace.Baseplate.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player and started[player] then
		started[player] = nil
		player:LoadCharacter()
	end
end)

for _, pad in ipairs(workspace.SpeedPads:GetChildren()) do
	pad.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h and h.WalkSpeed < 40 then
			h.WalkSpeed = 48
			delay(2.5, function() h.WalkSpeed = 24 end)
		end
	end)
end

-- Everyone runs a bit faster here.
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(char)
		char:WaitForChild("Humanoid").WalkSpeed = 24
	end)
end)

for _, part in ipairs(workspace.KillBricks:GetChildren()) do
	part.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h then h.Health = 0 end
	end)
end
`);
  return finish(g, { name: 'Speed Run' });
}

// ================================================================ Brick Tycoon
function tycoonPlot(parent, n, cx, cz, color) {
  const plot = model(parent, 'Plot' + n);
  inst(plot, 'IntValue', { Name: 'OwnerId', Value: 0 });
  part(plot, { name: 'Base', size: [44, 1, 44], pos: [cx, 0.5, cz], color: '#a3a2a5', material: 'Concrete' });
  const door = part(plot, { name: 'Door', size: [8, 7, 1], pos: [cx, 4.5, cz + 22], color, material: 'Neon', transparency: 0.3, canCollide: false });
  inst(door, 'BillboardText', { Text: 'Touch to claim!', StudsOffset: new Vector3(0, 5, 0) });
  // Conveyor from the droppers to the collector.
  part(plot, { name: 'Conveyor', size: [4, 2, 30], pos: [cx - 12, 2, cz], color: '#1b2a35', material: 'DiamondPlate' });
  part(plot, { name: 'Collector', size: [6, 3, 6], pos: [cx - 12, 2.5, cz - 18], color: '#4b974b', material: 'Neon' });
  const droppers = folder(plot, 'Droppers');
  const items = folder(plot, 'Items');
  const buttons = folder(plot, 'Buttons');
  const hidden = { transparency: 1, canCollide: false };
  const dropperAt = (i, zz, price) => {
    const d = part(droppers, { name: 'Dropper' + i, size: [5, 5, 5], pos: [cx - 12, 8, cz + zz], color: '#635f62', material: 'Metal', ...(price ? hidden : {}) });
    inst(d, 'IntValue', { Name: 'Worth', Value: i });
    inst(d, 'BoolValue', { Name: 'Bought', Value: !price });
    return d;
  };
  dropperAt(1, 12, 0);
  const shop = [
    ['Dropper2', 25, () => dropperAt(2, 5, 25)],
    ['Dropper3', 90, () => dropperAt(3, -2, 90)],
    ['Walls', 150, () => {
      const w = model(items, 'Walls');
      for (const [x, z, sx, sz] of [[0, -21.5, 44, 1], [-21.5, 0, 1, 44], [21.5, 0, 1, 44], [-13, 21.5, 18, 1], [13, 21.5, 18, 1]]) {
        part(w, { name: 'Wall', size: [sx, 10, sz], pos: [cx + x, 6, cz + z], color, material: 'Brick', ...hidden });
      }
      return w;
    }],
    ['Dropper4', 250, () => dropperAt(4, -9, 250)],
    ['Tower', 600, () => {
      const t = model(items, 'Tower');
      part(t, { name: 'TowerBase', size: [10, 20, 10], pos: [cx + 14, 11, cz - 14], color, material: 'Brick', ...hidden });
      part(t, { name: 'Flag', size: [6, 4, 0.4], pos: [cx + 17, 25, cz - 14], color: '#ffc400', material: 'Fabric', ...hidden });
      part(t, { name: 'Pole', size: [0.6, 8, 0.6], pos: [cx + 14, 25, cz - 14], color: '#f8f8f8', material: 'Metal', ...hidden });
      return t;
    }],
  ];
  shop.forEach(([name, price, build], i) => {
    build();
    const b = part(buttons, { name: 'Buy' + name, size: [4, 0.6, 4], pos: [cx + 8, 1.3, cz + 14 - i * 7], color: '#00ff00', material: 'Neon', ...hidden });
    inst(b, 'StringValue', { Name: 'Item', Value: name });
    inst(b, 'IntValue', { Name: 'Price', Value: price });
    inst(b, 'BillboardText', { Text: `${name.replace(/(\d)/, ' $1')} - $${price}`, StudsOffset: new Vector3(0, 3, 0), Enabled: false });
  });
  return plot;
}

export function gameTycoon() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 11;
  baseplate(ws, { color: '#4b974b', size: [300, 20, 300] });
  spawn(ws, [0, 0.5, 0], { color: '#f5cd30' });
  const plots = folder(ws, 'Tycoons');
  tycoonPlot(plots, 1, -40, -40, '#c4281c');
  tycoonPlot(plots, 2, 40, -40, '#0d69ac');
  tycoonPlot(plots, 3, -40, 40, '#f5cd30');
  tycoonPlot(plots, 4, 40, 40, '#6b327c');
  for (const [x, z] of [[0, -90], [0, 90], [-90, 0], [90, 0]]) tree(ws, x, z);
  script(g.ServerScriptService, 'Tycoon', `
-- Claim a plot, collect cash from your droppers and buy upgrades.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local BadgeService = game:GetService("BadgeService")
local plots = workspace.Tycoons

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Parent = ls
end)

local function show(item, visible)
	local parts = item:IsA("BasePart") and {item} or item:GetDescendants()
	for _, p in ipairs(parts) do
		if p:IsA("BasePart") then
			p.Transparency = visible and 0 or 1
			p.CanCollide = visible
		end
	end
end

local function ownerOf(plot)
	local id = plot.OwnerId.Value
	if id == 0 then return nil end
	return Players:GetPlayerByUserId(id)
end

local function reset(plot)
	plot.OwnerId.Value = 0
	plot.Door.Transparency = 0.3
	plot.Door.BillboardText.Text = "Touch to claim!"
	for _, d in ipairs(plot.Droppers:GetChildren()) do
		d.Bought.Value = d.Name == "Dropper1"
		show(d, d.Bought.Value)
	end
	for _, it in ipairs(plot.Items:GetChildren()) do show(it, false) end
	for _, b in ipairs(plot.Buttons:GetChildren()) do
		show(b, false)
		b.BillboardText.Enabled = false
	end
end

local function hasPlot(player)
	for _, plot in ipairs(plots:GetChildren()) do
		if plot.OwnerId.Value == player.UserId then return true end
	end
	return false
end

for _, plot in ipairs(plots:GetChildren()) do
	reset(plot)
	plot.Door.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or plot.OwnerId.Value ~= 0 or hasPlot(player) then return end
		plot.OwnerId.Value = player.UserId
		plot.Door.Transparency = 0.8
		plot.Door.BillboardText.Text = player.Name .. "'s Tycoon"
		for _, b in ipairs(plot.Buttons:GetChildren()) do
			show(b, true)
			b.BillboardText.Enabled = true
		end
	end)
	for _, b in ipairs(plot.Buttons:GetChildren()) do
		b.Touched:Connect(function(hit)
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if not player or player.UserId ~= plot.OwnerId.Value or b.Transparency > 0.5 then return end
			local cash = player.leaderstats.Cash
			if cash.Value < b.Price.Value then return end
			cash.Value = cash.Value - b.Price.Value
			local name = b.Item.Value
			local dropper = plot.Droppers:FindFirstChild(name)
			if dropper then
				dropper.Bought.Value = true
				show(dropper, true)
			else
				show(plot.Items[name], true)
			end
			show(b, false)
			b.BillboardText.Enabled = false
			if name == "Tower" then BadgeService:AwardBadge(player.UserId, "Tycoon Master") end
		end)
	end
end

Players.PlayerRemoving:Connect(function(player)
	for _, plot in ipairs(plots:GetChildren()) do
		if plot.OwnerId.Value == player.UserId then reset(plot) end
	end
end)

-- Droppers make bricks that ride the conveyor into the collector.
while true do
	for _, plot in ipairs(plots:GetChildren()) do
		local owner = ownerOf(plot)
		if owner then
			for _, d in ipairs(plot.Droppers:GetChildren()) do
				if d.Bought.Value then
					local brick = Instance.new("Part")
					brick.Size = Vector3.new(1.5, 1.5, 1.5)
					brick.BrickColor = BrickColor.random()
					brick.Anchored = true
					brick.CanCollide = false
					brick.Position = d.Position - Vector3.new(0, 4, 0)
					brick.Parent = workspace
					local target = plot.Collector.Position + Vector3.new(0, 2, 0)
					TweenService:Create(brick, TweenInfo.new(2, Enum.EasingStyle.Linear), {Position = Vector3.new(target.X, 3.8, target.Z)}):Play()
					local worth = d.Worth.Value
					delay(2, function()
						brick:Destroy()
						if owner.Parent then owner.leaderstats.Cash.Value = owner.leaderstats.Cash.Value + worth end
					end)
				end
			end
		end
	end
	wait(1.5)
end
`);
  return finish(g, { name: 'Brick Tycoon' });
}

// ================================================================ Robis Café
export function gameCafe() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 16;
  baseplate(ws, { color: '#4b974b', size: [300, 20, 300] });
  part(ws, { name: 'Street', size: [300, 0.2, 16], pos: [0, 0.1, 40], color: '#3a3a3c', material: 'Slate' });
  spawn(ws, [0, 0.5, 26], { color: '#a3a2a5' });
  const cafe = model(ws, 'Cafe');
  part(cafe, { name: 'Floor', size: [50, 1, 36], pos: [0, 0.5, -4], color: '#cc8e69', material: 'WoodPlanks' });
  const wallC = '#f2e3c6';
  for (const [x, z, sx, sz] of [[0, -21.5, 50, 1], [-24.5, -4, 1, 36], [24.5, -4, 1, 36], [-15.5, 13.5, 19, 1], [15.5, 13.5, 19, 1]]) {
    part(cafe, { name: 'Wall', size: [sx, 12, sz], pos: [x, 7, z], color: wallC, material: 'Plastic' });
  }
  part(cafe, { name: 'Wall', size: [12, 3, 1], pos: [0, 11.5, 13.5], color: wallC });
  part(cafe, { name: 'Roof', size: [52, 1, 38], pos: [0, 13.5, -4], color: '#56422f', material: 'Wood' });
  part(cafe, { name: 'Awning', size: [52, 0.5, 5], pos: [0, 12, 16.5], rot: [-15, 0, 0], color: '#c4281c', material: 'Fabric' });
  const sign = part(cafe, { name: 'SignBoard', size: [20, 3, 0.5], pos: [0, 15.5, 14], color: '#1b2a35' });
  inst(sign, 'BillboardText', { Text: 'ROBIS CAFÉ', StudsOffset: new Vector3(0, 2, 0) });
  // Counter + kitchen
  part(cafe, { name: 'Counter', size: [30, 4, 3], pos: [0, 3, -12], color: '#56422f', material: 'Wood' });
  part(cafe, { name: 'CounterTop', size: [31, 0.4, 3.6], pos: [0, 5.2, -12], color: '#f8f8f8', material: 'Marble' });
  const oven = part(cafe, { name: 'Oven', size: [6, 5, 4], pos: [-12, 3.5, -18.5], color: '#635f62', material: 'Metal' });
  inst(oven, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(oven, 'BillboardText', { Text: 'Bake a pizza', StudsOffset: new Vector3(0, 4, 0) });
  inst(oven, 'PointLight', { Color: Color3.fromRGB(255, 120, 40), Range: 8, Brightness: 2 });
  const soda = part(cafe, { name: 'SodaMachine', size: [4, 7, 3], pos: [12, 4.5, -19], color: '#0d69ac' });
  inst(soda, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(soda, 'BillboardText', { Text: 'Free soda', StudsOffset: new Vector3(0, 5, 0) });
  // Tables
  for (const [x, z] of [[-14, 0], [0, 2], [14, 0], [-14, 8], [14, 8]]) {
    const t = model(cafe, 'Table');
    part(t, { name: 'Top', size: [0.4, 6, 6], pos: [x, 3.6, z], color: '#f8f8f8', shape: 'Cylinder', rot: [0, 0, 90], material: 'Marble' });
    part(t, { name: 'Leg', size: [1, 3.2, 1], pos: [x, 2, z], color: '#1b2a35', material: 'Metal' });
    for (const d of [-4.5, 4.5]) part(t, { cls: 'Seat', name: 'Seat', size: [2.5, 1, 2.5], pos: [x + d, 2, z], color: '#c4281c', material: 'Fabric' });
  }
  // Dance floor + jukebox
  const floor = folder(ws, 'DanceFloor');
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    part(floor, { name: 'Tile', size: [4, 0.3, 4], pos: [-40 + i * 4, 0.15, -8 + j * 4], color: RAINBOW[(i + j) % RAINBOW.length], material: 'Neon' });
  }
  const juke = part(ws, { name: 'Jukebox', size: [4, 6, 2.5], pos: [-40, 3, -14], color: '#ff66cc', material: 'Neon' });
  inst(juke, 'ClickDetector', { MaxActivationDistance: 24 });
  inst(juke, 'BillboardText', { Text: 'Party!', StudsOffset: new Vector3(0, 4.5, 0) });
  for (const x of [-12, 0, 12]) {
    const lamp = part(cafe, { name: 'Lamp', size: [1.5, 1.5, 1.5], pos: [x, 12, -4], color: '#fff6a8', material: 'Neon', shape: 'Ball' });
    inst(lamp, 'PointLight', { Range: 18, Brightness: 1.5 });
  }
  for (const [x, z] of [[-60, 60], [60, 60], [-60, -40], [60, -40], [35, 25]]) tree(ws, x, z);
  script(g.ServerScriptService, 'Cafe', `
-- The Robis Café: bake pizzas, grab a soda, start a dance party.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local cafe = workspace.Cafe

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local pizzas = Instance.new("IntValue")
	pizzas.Name = "Pizzas"
	pizzas.Parent = ls
end)

local baking = false
cafe.Oven.ClickDetector.MouseClick:Connect(function(player)
	if baking then return end
	baking = true
	cafe.Oven.BillboardText.Text = "Baking..."
	wait(2)
	local pizza = Instance.new("Part")
	pizza.Name = "Pizza"
	pizza.Shape = Enum.PartType.Cylinder
	pizza.Size = Vector3.new(0.4, 3, 3)
	pizza.Color = Color3.fromRGB(245, 180, 60)
	pizza.Anchored = true
	pizza.CFrame = CFrame.new(math.random(-12, 12), 5.6, -12) * CFrame.Angles(0, 0, math.rad(90))
	pizza.Parent = workspace
	Debris:AddItem(pizza, 20)
	player.leaderstats.Pizzas.Value = player.leaderstats.Pizzas.Value + 1
	cafe.Oven.BillboardText.Text = "Bake a pizza"
	baking = false
end)

cafe.SodaMachine.ClickDetector.MouseClick:Connect(function(player)
	local can = Instance.new("Part")
	can.Name = "Soda"
	can.Size = Vector3.new(0.8, 1.2, 0.8)
	can.Color = Color3.fromHSV(math.random(), 0.9, 0.9)
	can.Position = cafe.SodaMachine.Position + Vector3.new(0, 0, 3)
	can.Parent = workspace
	Debris:AddItem(can, 15)
	print(player.Name .. " grabbed a soda")
end)

local partying = false
workspace.Jukebox.ClickDetector.MouseClick:Connect(function(player)
	if partying then return end
	partying = true
	local m = Instance.new("Hint")
	m.Text = player.Name .. " started a dance party!"
	m.Parent = workspace
	local tiles = workspace.DanceFloor:GetChildren()
	for i = 1, 40 do
		for _, t in ipairs(tiles) do t.Color = Color3.fromHSV(math.random(), 1, 1) end
		for _, l in ipairs(cafe:GetChildren()) do
			if l.Name == "Lamp" then l.PointLight.Color = Color3.fromHSV(math.random(), 1, 1) end
		end
		wait(0.25)
	end
	for _, l in ipairs(cafe:GetChildren()) do
		if l.Name == "Lamp" then l.PointLight.Color = Color3.new(1, 1, 1) end
	end
	m:Destroy()
	partying = false
end)
`);
  return finish(g, { name: 'Robis Café' });
}

// ================================================================ Sprint Race
export function gameRace() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 9;
  baseplate(ws, { color: '#4b974b', size: [200, 20, 500] });
  lobby(ws, 80, '#f5cd30');
  const lanes = folder(ws, 'Lanes');
  const gates = folder(ws, 'Gates');
  const hurdles = folder(ws, 'Hurdles');
  const L = 260;
  for (let i = 0; i < 6; i++) {
    const x = -25 + i * 10;
    part(ws, { name: 'Track', size: [9, 0.3, L + 20], pos: [x, 0.15, -L / 2], color: '#c4281c', material: 'Slate' });
    part(ws, { name: 'Line', size: [0.6, 0.32, L + 20], pos: [x + 4.8, 0.16, -L / 2], color: '#f8f8f8', material: 'SmoothPlastic' });
    part(lanes, { cls: 'SpawnLocation', name: 'Lane' + (i + 1), size: [6, 1, 6], pos: [x, 0.5, 12], color: RAINBOW[i], props: { Enabled: false } });
    part(gates, { name: 'Gate', size: [9, 8, 1], pos: [x, 4, 6], color: '#f8f8f8', material: 'Glass', transparency: 0.5 });
    for (let h = 1; h <= 4; h++) part(hurdles, { name: 'Hurdle', size: [8, 1.6, 0.6], pos: [x, 0.8, -h * 50], color: '#f8f8f8', material: 'Wood' });
  }
  const fin = part(ws, { name: 'FinishLine', size: [62, 0.4, 4], pos: [0, 0.3, -L], color: '#ffc400', material: 'Neon' });
  inst(fin, 'BillboardText', { Text: 'FINISH', StudsOffset: new Vector3(0, 8, 0) });
  part(ws, { name: 'Grandstand', size: [12, 10, 120], pos: [-42, 5, -130], color: '#a3a2a5', material: 'Concrete' });
  part(ws, { name: 'Grandstand', size: [12, 10, 120], pos: [42, 5, -130], color: '#a3a2a5', material: 'Concrete' });
  script(g.ServerScriptService, 'Race', `
-- Race to the finish line! First place gets a Win.
local Players = game:GetService("Players")
local lobbySpawn = workspace.Lobby.LobbySpawn
local hint = Instance.new("Hint", workspace)
local racing = false
local placed = {}
${WINS_STATS}
local function setGates(open)
	for _, g in ipairs(workspace.Gates:GetChildren()) do
		g.CanCollide = not open
		g.Transparency = open and 1 or 0.5
	end
end

workspace.FinishLine.Touched:Connect(function(hit)
	if not racing then return end
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or not player.InRound.Value or placed[player] then return end
	table.insert(placed, player)
	placed[player] = #placed
	if #placed == 1 then
		player.leaderstats.Wins.Value = player.leaderstats.Wins.Value + 1
	end
	local m = Instance.new("Message")
	m.Text = player.Name .. " finished #" .. #placed .. "!"
	m.Parent = workspace
	game:GetService("Debris"):AddItem(m, 2)
end)

while true do
	setGates(false)
	for i = 10, 1, -1 do
		hint.Text = "Next race in " .. i
		wait(1)
	end
	local players = Players:GetPlayers()
	if #players == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		placed = {}
		local lanes = workspace.Lanes:GetChildren()
		for i, p in ipairs(players) do
			p.InRound.Value = true
			p.RespawnLocation = lanes[(i - 1) % #lanes + 1]
			p:LoadCharacter()
			p.RespawnLocation = lobbySpawn
		end
		for i = 3, 1, -1 do
			hint.Text = "Get ready... " .. i
			wait(1)
		end
		hint.Text = "GO!"
		setGates(true)
		racing = true
		local t0 = tick()
		while tick() - t0 < 45 do
			local left = 0
			for _, p in ipairs(players) do
				if p.Parent and p.InRound.Value and not placed[p] then left = left + 1 end
			end
			if left == 0 then break end
			hint.Text = "Race!  " .. math.floor(tick() - t0) .. "s"
			wait(0.5)
		end
		racing = false
		local names = {}
		for i, p in ipairs(placed) do table.insert(names, i .. ". " .. p.Name) end
		hint.Text = #names > 0 and table.concat(names, "   ") or "Nobody finished!"
		for _, p in ipairs(players) do if p.Parent then p.InRound.Value = false end end
		wait(5)
		for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
	end
end
`);
  return finish(g, { name: 'Sprint Race' });
}

export const MORE_GAMES = [
  { key: 'disaster', name: 'Disaster Island', build: gameDisaster, genre: 'Adventure', featured: true, maxPlayers: 16,
    visits: 91233, up: 1840, down: 130, favorites: 6100,
    description: 'Floods, meteor showers and earthquakes! Survive each disaster on the island to earn Wins.' },
  { key: 'tower', name: 'Tower of Robis', build: gameTower, genre: 'Adventure', featured: true, maxPlayers: 16,
    visits: 54210, up: 1230, down: 160, favorites: 3900,
    description: 'Climb the spiral tower: jump, dodge lava and climb trusses. Reach the top for a Win and the Tower Climber badge.' },
  { key: 'speedrun', name: 'Speed Run', build: gameSpeedRun, genre: 'Adventure', featured: false, maxPlayers: 12,
    visits: 23877, up: 610, down: 55, favorites: 1500,
    description: 'Neon speed run! Touch START, run the course and beat your best time. Speed pads help.' },
  { key: 'tycoon', name: 'Brick Tycoon', build: gameTycoon, genre: 'Building', featured: true, maxPlayers: 4,
    visits: 77402, up: 2002, down: 240, favorites: 5400,
    description: 'Claim a plot, collect cash from your droppers and buy upgrades until you own the tallest tower.' },
  { key: 'cafe', name: 'Robis Café', build: gameCafe, genre: 'Town and City', featured: false, maxPlayers: 20,
    visits: 18344, up: 480, down: 31, favorites: 950,
    description: 'Hang out at the café! Bake pizzas, grab a soda and start a dance party on the neon floor.' },
  { key: 'race', name: 'Sprint Race', build: gameRace, genre: 'Sports', featured: false, maxPlayers: 6,
    visits: 12006, up: 290, down: 40, favorites: 610,
    description: 'Six lanes, four hurdles, one winner. Wait for the countdown and sprint to the finish line!' },
];
