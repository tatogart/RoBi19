// The 2.0 versions of two classics: Disaster Island (four maps, eleven
// disasters, double-disaster rounds) and Tower of Robis (a new random tower
// every round, no checkpoints, harder the higher you get).
import { Vector3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, spawn, tree, finish } from './builder.js';

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

// Leaderstats + "in the round" flag. Dying takes you out of the round, so only real survivors win.
const ROUND_STATS = `
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
	player.CharacterAdded:Connect(function(char)
		local hum = char:FindFirstChild("Humanoid")
		if hum then hum.Died:Connect(function() inRound.Value = false end) end
	end)
end)
`;

// ================================================================ Disaster Island maps
function house(map, x, z, color) {
  const h = model(map, 'House');
  part(h, { name: 'Floor', size: [20, 1, 16], pos: [x, 2.5, z], color: '#7c5c46', material: 'WoodPlanks' });
  part(h, { name: 'Wall', size: [20, 10, 1], pos: [x, 8, z - 7.5], color, material: 'Brick' });
  part(h, { name: 'Wall', size: [1, 10, 16], pos: [x - 9.5, 8, z], color, material: 'Brick' });
  part(h, { name: 'Wall', size: [1, 10, 16], pos: [x + 9.5, 8, z], color, material: 'Brick' });
  part(h, { name: 'Wall', size: [7, 10, 1], pos: [x - 6.5, 8, z + 7.5], color, material: 'Brick' });
  part(h, { name: 'Wall', size: [7, 10, 1], pos: [x + 6.5, 8, z + 7.5], color, material: 'Brick' });
  part(h, { name: 'Roof', size: [22, 1, 18], pos: [x, 13.5, z], color: '#56422f', material: 'Wood' });
  part(h, { cls: 'TrussPart', name: 'Ladder', size: [2, 12, 2], pos: [x + 11, 8, z], color: '#a3a2a5', material: 'Metal' });
}

function mapSuburbia(parent) {
  const map = model(parent, 'Suburbia');
  house(map, -40, -35, '#c4281c');
  house(map, 40, -35, '#0d69ac');
  house(map, -40, 30, '#f5cd30');
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

function mapConstruction(parent) {
  const map = model(parent, 'Construction Site');
  // A half-built office: concrete floors on columns, stairs made of girders.
  const b = model(map, 'Building');
  for (let f = 0; f < 5; f++) {
    const y = 2 + f * 8;
    part(b, { name: 'Slab', size: [30, 1, 24], pos: [-30, y + 0.5, -20], color: '#a3a2a5', material: 'Concrete' });
    for (const [dx, dz] of [[-14, -11], [14, -11], [-14, 11], [14, 11], [0, -11], [0, 11]]) {
      part(b, { name: 'Column', size: [1.6, 8, 1.6], pos: [-30 + dx, y + 4.5, -20 + dz], color: '#635f62', material: 'Concrete' });
    }
    part(b, { cls: 'TrussPart', name: 'Ladder', size: [2, 8, 2], pos: [-30 + (f % 2 ? 13 : -13), y + 4.5, -6], color: '#f5cd30', material: 'Metal' });
  }
  // Tower crane: a tall truss with an arm on top.
  const crane = model(map, 'Crane');
  part(crane, { cls: 'TrussPart', name: 'Mast', size: [3, 60, 3], pos: [35, 32, 30], color: '#f5cd30', material: 'Metal' });
  part(crane, { name: 'CraneCab', size: [6, 4, 6], pos: [35, 64, 30], color: '#f5cd30', material: 'Metal' });
  part(crane, { name: 'Jib', size: [50, 2, 3], pos: [20, 67, 30], color: '#f5cd30', material: 'Metal' });
  part(crane, { name: 'Counterweight', size: [6, 4, 4], pos: [50, 65, 30], color: '#635f62', material: 'Concrete' });
  // Scaffolding and piles of girders.
  for (let i = 0; i < 4; i++) {
    part(map, { name: 'Scaffold', size: [10, 0.6, 4], pos: [10, 6 + i * 6, -45], color: '#7c5c46', material: 'WoodPlanks' });
    part(map, { cls: 'TrussPart', name: 'Scaffold Pole', size: [1, 6, 1], pos: [5.5, 3 + i * 6, -45], color: '#a3a2a5', material: 'Metal' });
  }
  for (let i = 0; i < 5; i++) part(map, { name: 'Girder', size: [16, 1, 1], pos: [30, 2.5 + i, -40 + (i % 2) * 2], color: '#c4281c', material: 'Metal' });
  part(map, { name: 'Container', size: [8, 8, 18], pos: [-50, 6, 40], color: '#0d69ac', material: 'Metal' });
  part(map, { name: 'Container', size: [8, 8, 18], pos: [-50, 14, 40], color: '#c4281c', material: 'Metal' });
  part(map, { cls: 'TrussPart', name: 'Ladder', size: [2, 16, 2], pos: [-45, 10, 50], color: '#a3a2a5', material: 'Metal' });
  return map;
}

function mapPirateCove(parent) {
  const map = model(parent, 'Pirate Cove');
  // The ship stranded on the beach.
  const ship = model(map, 'Ship');
  part(ship, { name: 'Hull', size: [16, 6, 44], pos: [45, 5, 0], color: '#56422f', material: 'WoodPlanks' });
  part(ship, { name: 'Deck', size: [14, 1, 42], pos: [45, 8.5, 0], color: '#7c5c46', material: 'WoodPlanks' });
  part(ship, { name: 'Cabin', size: [12, 6, 10], pos: [45, 12, 15], color: '#56422f', material: 'Wood' });
  part(ship, { cls: 'TrussPart', name: 'Mast', size: [2, 34, 2], pos: [45, 26, -4], color: '#56422f', material: 'Wood' });
  part(ship, { name: 'CrowsNest', size: [6, 1, 6], pos: [45, 40, -4], color: '#7c5c46', material: 'WoodPlanks' });
  part(ship, { name: 'Sail', size: [18, 14, 0.4], pos: [45, 26, -2], color: '#f8f8f8', material: 'Fabric', canCollide: false });
  part(ship, { cls: 'TrussPart', name: 'Rope Ladder', size: [2, 8, 2], pos: [36.5, 5, 0], color: '#a3a2a5', material: 'Wood' });
  // Lighthouse.
  const lh = model(map, 'Lighthouse');
  part(lh, { name: 'Lighthouse', size: [44, 10, 10], pos: [-45, 24, -45], color: '#f8f8f8', material: 'Concrete', shape: 'Cylinder', rot: [0, 0, 90] });
  part(lh, { name: 'Stripe', size: [6, 10.4, 10.4], pos: [-45, 20, -45], color: '#c4281c', material: 'Concrete', shape: 'Cylinder', rot: [0, 0, 90] });
  part(lh, { name: 'Balcony', size: [16, 1, 16], pos: [-45, 46.5, -45], color: '#635f62', material: 'Metal' });
  const lamp = part(lh, { name: 'Lamp', size: [6, 4, 6], pos: [-45, 49, -45], color: '#ffe680', material: 'Neon' });
  inst(lamp, 'PointLight', { Range: 40, Brightness: 2 });
  part(lh, { cls: 'TrussPart', name: 'Ladder', size: [2, 46, 2], pos: [-45, 24, -39], color: '#a3a2a5', material: 'Metal' });
  // Docks, huts and palm trees.
  part(map, { name: 'Dock', size: [8, 1, 40], pos: [-10, 2.6, 60], color: '#7c5c46', material: 'WoodPlanks' });
  for (const [x, z] of [[-30, 20], [-10, -20]]) {
    const hut = model(map, 'Hut');
    part(hut, { name: 'Floor', size: [12, 1, 12], pos: [x, 3, z], color: '#7c5c46', material: 'WoodPlanks' });
    for (const [dx, dz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) part(hut, { name: 'Post', size: [1, 7, 1], pos: [x + dx, 6.5, z + dz], color: '#56422f', material: 'Wood' });
    part(hut, { name: 'Roof', size: [14, 1.5, 14], pos: [x, 10.5, z], color: '#d7c59a', material: 'Grass' });
  }
  for (const [x, z] of [[0, 30], [20, -50], [-60, 10], [10, 0], [-25, -60]]) {
    part(map, { name: 'Trunk', size: [1.6, 14, 1.6], pos: [x, 9, z], color: '#a0703c', material: 'Wood' });
    part(map, { name: 'Leaves', size: [10, 1.5, 10], pos: [x, 16, z], color: '#4b974b', material: 'Grass' });
  }
  return map;
}

function mapMountain(parent) {
  const map = model(parent, 'Mountain Village');
  // A stepped mountain in the middle: the higher, the safer from floods.
  const mtn = model(map, 'Mountain');
  for (let i = 0; i < 6; i++) {
    const s = 70 - i * 11;
    part(mtn, { name: 'Rock', size: [s, 6, s], pos: [-10, 5 + i * 6, -10], color: i > 3 ? '#f8f8f8' : '#635f62', material: i > 3 ? 'Ice' : 'Slate' });
  }
  for (let i = 0; i < 6; i++) part(mtn, { cls: 'TrussPart', name: 'Climb', size: [2, 6, 2], pos: [-10 + (70 - i * 11) / 2 + 1, 8 + i * 6, -10], color: '#a3a2a5', material: 'Metal' });
  for (const [x, z, c] of [[40, 40, '#c4281c'], [45, 5, '#0d69ac'], [10, 50, '#4b974b']]) {
    const cabin = model(map, 'Cabin');
    part(cabin, { name: 'Floor', size: [14, 1, 12], pos: [x, 2.5, z], color: '#7c5c46', material: 'WoodPlanks' });
    part(cabin, { name: 'Wall', size: [14, 8, 1], pos: [x, 7, z - 5.5], color: '#a0703c', material: 'Wood' });
    part(cabin, { name: 'Wall', size: [1, 8, 12], pos: [x - 6.5, 7, z], color: '#a0703c', material: 'Wood' });
    part(cabin, { name: 'Wall', size: [1, 8, 12], pos: [x + 6.5, 7, z], color: '#a0703c', material: 'Wood' });
    part(cabin, { name: 'Roof', size: [16, 1, 14], pos: [x, 11.5, z], color: c, material: 'Wood' });
  }
  for (const [x, z] of [[-60, 40], [-55, -55], [60, -40], [25, -60], [-30, 55]]) {
    part(map, { name: 'Trunk', size: [1.5, 6, 1.5], pos: [x, 5, z], color: '#56422f', material: 'Wood' });
    for (let k = 0; k < 3; k++) part(map, { name: 'Leaves', size: [8 - k * 2.5, 3, 8 - k * 2.5], pos: [x, 9 + k * 3, z], color: '#2c6e3a', material: 'Grass' });
  }
  return map;
}

export function gameDisaster() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13.5;
  part(ws, { name: 'Sea', size: [700, 20, 700], pos: [0, -12, 0], color: '#2f7fb5', material: 'Glass', top: 'Smooth', props: { Locked: true } });
  part(ws, { name: 'Beach', size: [176, 3.6, 176], pos: [0, -0.2, 0], color: '#d7c59a', material: 'Sand' });
  part(ws, { name: 'Island', size: [160, 4, 160], pos: [0, 0, 0], color: '#4b974b', material: 'Grass' });
  part(ws, { cls: 'SpawnLocation', name: 'IslandSpawn', size: [12, 1, 12], pos: [0, 2.5, 20], color: '#f5cd30', props: { Enabled: false } });
  lobby(ws, 160);
  const maps = folder(g.ServerStorage, 'Maps');
  mapSuburbia(maps); mapConstruction(maps); mapPirateCove(maps); mapMountain(maps);
  part(ws, { name: 'Flood', size: [700, 2, 700], pos: [0, -4, 0], color: '#1e6fb8', material: 'Glass', transparency: 0.35, canCollide: false });
  script(g.ServerScriptService, 'Disasters', `
-- Natural disasters on four maps. Survive the round to earn a Win.
-- Later rounds can be DOUBLE DISASTERS.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local Lighting = game:GetService("Lighting")
local maps = game:GetService("ServerStorage").Maps
local lobbySpawn = workspace.Lobby.LobbySpawn
local islandSpawn = workspace.IslandSpawn
local flood = workspace.Flood
local hint = Instance.new("Hint", workspace)
local flooding = false
local survived = {}
${ROUND_STATS}
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

local function alivePlayers()
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if h and h.Health > 0 and p.InRound.Value then table.insert(list, p) end
	end
	return list
end

-- Is something above this player's head (a roof keeps acid rain and snow off)?
local function underCover(char)
	local head = char:FindFirstChild("Head")
	if not head then return true end
	return workspace:Raycast(head.Position + Vector3.new(0, 1, 0), Vector3.new(0, 80, 0), char) ~= nil
end

local function forEachAlive(fn)
	for _, p in ipairs(alivePlayers()) do
		local c = p.Character
		local h = c and c:FindFirstChild("Humanoid")
		if c and h then fn(p, c, h) end
	end
end

local function mapParts()
	local list = {}
	local map = workspace:FindFirstChild("Map")
	if map then
		for _, d in ipairs(map:GetDescendants()) do
			if d:IsA("BasePart") then table.insert(list, d) end
		end
	end
	return list
end

local function sky(clock, fogEnd, fogColor)
	Lighting.ClockTime = clock
	Lighting.FogEnd = fogEnd or 100000
	if fogColor then Lighting.FogColor = fogColor end
end

local disasters = {
	{ name = "Flash Flood", tip = "Get up high!", run = function(t)
		flooding = true
		TweenService:Create(flood, TweenInfo.new(10, Enum.EasingStyle.Sine), {Position = Vector3.new(0, 13, 0)}):Play()
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
			m.Size = Vector3.new(5, 5, 5)
			m.Material = Enum.Material.Neon
			m.Color = Color3.fromRGB(255, 110, 20)
			m.Anchored = true
			m.CanCollide = false
			m.Position = target + Vector3.new(30, 120, 0)
			m.Parent = workspace
			Instance.new("Fire", m)
			TweenService:Create(m, TweenInfo.new(1.3, Enum.EasingStyle.Linear), {Position = target}):Play()
			delay(1.3, function()
				local e = Instance.new("Explosion")
				e.Position = target
				e.BlastRadius = 10
				e.Parent = workspace
				m:Destroy()
			end)
			wait(0.28)
		end
	end },
	{ name = "Earthquake", tip = "Get out of the buildings!", run = function(t)
		for _, d in ipairs(mapParts()) do
			if d.Name ~= "Leaves" and d.Name ~= "Trunk" then d.Anchored = false end
		end
		local stop = tick() + t
		while tick() < stop do
			local e = Instance.new("Explosion")
			e.Position = Vector3.new(math.random(-60, 60), 1, math.random(-60, 60))
			e.BlastRadius = 4
			e.BlastPressure = 250000
			e.Parent = workspace
			wait(0.8)
		end
	end },
	{ name = "Tornado", tip = "Stay away from the twister!", run = function(t)
		local tw = Instance.new("Part")
		tw.Name = "Tornado"
		tw.Shape = Enum.PartType.Cylinder
		tw.Size = Vector3.new(120, 22, 22)
		tw.CFrame = CFrame.new(-70, 60, -70) * CFrame.Angles(0, 0, math.pi / 2)
		tw.Anchored = true
		tw.CanCollide = false
		tw.Transparency = 0.45
		tw.Color = Color3.fromRGB(90, 90, 95)
		tw.Material = Enum.Material.Glass
		tw.Parent = workspace
		Instance.new("Smoke", tw)
		sky(16, 600, Color3.fromRGB(120, 120, 125))
		local stop = tick() + t
		while tick() < stop do
			local target = Vector3.new(math.random(-70, 70), 60, math.random(-70, 70))
			local move = TweenService:Create(tw, TweenInfo.new(3, Enum.EasingStyle.Linear), {Position = target})
			move:Play()
			for i = 1, 6 do
				local pos = tw.Position
				local e = Instance.new("Explosion")
				e.Position = Vector3.new(pos.X, 3, pos.Z)
				e.BlastRadius = 12
				e.BlastPressure = 400000
				e.DestroyJointRadiusPercent = 0
				e.Parent = workspace
				forEachAlive(function(p, c, h)
					local root = c:FindFirstChild("HumanoidRootPart")
					if root and (Vector3.new(root.Position.X, 0, root.Position.Z) - Vector3.new(pos.X, 0, pos.Z)).Magnitude < 13 then h:TakeDamage(12) end
				end)
				for _, d in ipairs(mapParts()) do
					if (d.Position - Vector3.new(pos.X, d.Position.Y, pos.Z)).Magnitude < 14 then d.Anchored = false end
				end
				wait(0.5)
			end
		end
		tw:Destroy()
		sky(13.5)
	end },
	{ name = "Acid Rain", tip = "Find a roof! The rain burns.", run = function(t)
		sky(17, 500, Color3.fromRGB(110, 160, 70))
		local stop = tick() + t
		while tick() < stop do
			for i = 1, 6 do
				local d = Instance.new("Part")
				d.Name = "Acid"
				d.Size = Vector3.new(0.4, 3, 0.4)
				d.Material = Enum.Material.Neon
				d.Color = Color3.fromRGB(120, 255, 60)
				d.Anchored = true
				d.CanCollide = false
				d.Position = Vector3.new(math.random(-80, 80), 70, math.random(-80, 80))
				d.Parent = workspace
				TweenService:Create(d, TweenInfo.new(1, Enum.EasingStyle.Linear), {Position = d.Position - Vector3.new(0, 68, 0)}):Play()
				Debris:AddItem(d, 1)
			end
			forEachAlive(function(p, c, h) if not underCover(c) then h:TakeDamage(7) end end)
			wait(0.5)
		end
		sky(13.5)
	end },
	{ name = "Lightning Storm", tip = "Keep moving! Lightning strikes where you stand.", run = function(t)
		sky(0, 400, Color3.fromRGB(30, 30, 45))
		local stop = tick() + t
		while tick() < stop do
			local alive = alivePlayers()
			if #alive > 0 then
				local p = alive[math.random(1, #alive)]
				local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
				if root then
					local spot = Vector3.new(root.Position.X, root.Position.Y - 2.8, root.Position.Z)
					local warn = Instance.new("Part")
					warn.Name = "Warning"
					warn.Shape = Enum.PartType.Cylinder
					warn.Size = Vector3.new(0.2, 12, 12)
					warn.CFrame = CFrame.new(spot) * CFrame.Angles(0, 0, math.pi / 2)
					warn.Anchored = true
					warn.CanCollide = false
					warn.Material = Enum.Material.Neon
					warn.Color = Color3.fromRGB(255, 240, 80)
					warn.Transparency = 0.4
					warn.Parent = workspace
					delay(1.1, function()
						warn:Destroy()
						local bolt = Instance.new("Part")
						bolt.Name = "Lightning"
						bolt.Size = Vector3.new(1.2, 200, 1.2)
						bolt.Position = spot + Vector3.new(0, 100, 0)
						bolt.Anchored = true
						bolt.CanCollide = false
						bolt.Material = Enum.Material.Neon
						bolt.Color = Color3.fromRGB(220, 230, 255)
						bolt.Parent = workspace
						Debris:AddItem(bolt, 0.25)
						local e = Instance.new("Explosion")
						e.Position = spot
						e.BlastRadius = 6
						e.Parent = workspace
					end)
				end
			end
			wait(1.2)
		end
		sky(13.5)
	end },
	{ name = "Volcano", tip = "Lava bombs! Watch the ground for red spots.", run = function(t)
		local cone = Instance.new("Part")
		cone.Name = "Volcano"
		cone.Size = Vector3.new(30, 26, 30)
		cone.Position = Vector3.new(0, -10, -70)
		cone.Color = Color3.fromRGB(70, 50, 40)
		cone.Material = Enum.Material.Slate
		cone.Anchored = true
		cone.Parent = workspace
		TweenService:Create(cone, TweenInfo.new(3), {Position = Vector3.new(0, 13, -70)}):Play()
		sky(18.5, 800, Color3.fromRGB(150, 80, 50))
		wait(3)
		local pools = {}
		local stop = tick() + t - 3
		while tick() < stop do
			local target = Vector3.new(math.random(-70, 70), 2.3, math.random(-70, 70))
			local b = Instance.new("Part")
			b.Name = "LavaBomb"
			b.Shape = Enum.PartType.Ball
			b.Size = Vector3.new(4, 4, 4)
			b.Material = Enum.Material.Neon
			b.Color = Color3.fromRGB(255, 80, 0)
			b.Anchored = true
			b.CanCollide = false
			b.Position = Vector3.new(0, 30, -70)
			b.Parent = workspace
			TweenService:Create(b, TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Position = (target + Vector3.new(0, 30, -70)) / 2 + Vector3.new(0, 35, 0)}):Play()
			delay(0.8, function()
				TweenService:Create(b, TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {Position = target}):Play()
			end)
			delay(1.6, function()
				b:Destroy()
				local pool = Instance.new("Part")
				pool.Name = "LavaPool"
				pool.Size = Vector3.new(8, 0.4, 8)
				pool.Position = target
				pool.Anchored = true
				pool.CanCollide = false
				pool.Material = Enum.Material.Neon
				pool.Color = Color3.fromRGB(255, 60, 0)
				pool.Parent = workspace
				pool.Touched:Connect(function(hit)
					local h = hit.Parent:FindFirstChild("Humanoid")
					if h then h:TakeDamage(35) end
				end)
				table.insert(pools, pool)
			end)
			wait(0.45)
		end
		wait(1.7)
		for _, p in ipairs(pools) do p:Destroy() end
		TweenService:Create(cone, TweenInfo.new(3), {Position = Vector3.new(0, -12, -70)}):Play()
		Debris:AddItem(cone, 3.5)
		sky(13.5)
	end },
	{ name = "Blizzard", tip = "Get inside to stay warm! The snow slows you down.", run = function(t)
		sky(15, 120, Color3.fromRGB(235, 240, 250))
		forEachAlive(function(p, c, h) h.WalkSpeed = 10 end)
		local stop = tick() + t
		while tick() < stop do
			forEachAlive(function(p, c, h) if not underCover(c) then h:TakeDamage(5) end end)
			wait(1)
		end
		forEachAlive(function(p, c, h) h.WalkSpeed = 16 end)
		sky(13.5)
	end },
	{ name = "Tsunami", tip = "A giant wave! Climb something tall NOW!", run = function(t)
		local wave = Instance.new("Part")
		wave.Name = "Tsunami"
		wave.Size = Vector3.new(260, 34, 24)
		wave.Position = Vector3.new(0, 14, -140)
		wave.Anchored = true
		wave.CanCollide = false
		wave.Material = Enum.Material.Glass
		wave.Transparency = 0.25
		wave.Color = Color3.fromRGB(40, 120, 200)
		wave.Parent = workspace
		wave.Touched:Connect(function(hit)
			local h = hit.Parent:FindFirstChild("Humanoid")
			if h then h:TakeDamage(100) return end
			if hit:IsDescendantOf(workspace.Map) then hit.Anchored = false end
		end)
		wait(4)
		TweenService:Create(wave, TweenInfo.new(t - 8, Enum.EasingStyle.Linear), {Position = Vector3.new(0, 14, 140)}):Play()
		wait(t - 4)
		wave:Destroy()
	end },
	{ name = "Wildfire", tip = "The fire spreads! Don't touch anything burning.", run = function(t)
		local parts = mapParts()
		local burning = {}
		local function ignite(pt)
			if burning[pt] or not pt.Parent then return end
			burning[pt] = true
			Instance.new("Fire", pt)
			pt.Color = Color3.fromRGB(60, 40, 30)
			pt.Touched:Connect(function(hit)
				local h = hit.Parent:FindFirstChild("Humanoid")
				if h and burning[pt] then h:TakeDamage(20) end
			end)
		end
		for i = 1, 3 do if #parts > 0 then ignite(parts[math.random(1, #parts)]) end end
		local stop = tick() + t
		while tick() < stop do
			for pt in pairs(burning) do
				for _, other in ipairs(parts) do
					if not burning[other] and math.random() < 0.08 and (other.Position - pt.Position).Magnitude < 14 then ignite(other) end
				end
			end
			wait(1.5)
		end
	end },
	{ name = "Sandstorm", tip = "You can barely see! Gusts of wind push you around.", run = function(t)
		sky(14, 70, Color3.fromRGB(210, 180, 120))
		local stop = tick() + t
		while tick() < stop do
			forEachAlive(function(p, c, h)
				local root = c:FindFirstChild("HumanoidRootPart")
				if root and math.random() < 0.35 then
					local e = Instance.new("Explosion")
					e.Position = root.Position + Vector3.new(math.random(-6, 6), -2, math.random(-6, 6))
					e.BlastRadius = 7
					e.BlastPressure = 300000
					e.DestroyJointRadiusPercent = 0
					e.Parent = workspace
				end
				if not underCover(c) then h:TakeDamage(2) end
			end)
			wait(1)
		end
		sky(13.5)
	end },
}

local round = 0
while true do
	for i = 12, 1, -1 do
		hint.Text = "Intermission: " .. i
		wait(1)
	end
	if #Players:GetPlayers() == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		round = round + 1
		local old = workspace:FindFirstChild("Map")
		if old then old:Destroy() end
		local list = maps:GetChildren()
		local map = list[math.random(1, #list)]:Clone()
		local mapName = map.Name
		map.Name = "Map"
		map.Parent = workspace
		hint.Text = "Map: " .. mapName .. "! Teleporting..."
		for _, p in ipairs(Players:GetPlayers()) do
			p.InRound.Value = true
			p.RespawnLocation = islandSpawn
			p:LoadCharacter()
			p.RespawnLocation = lobbySpawn
		end
		wait(5)
		-- From round 3 on, there's a 30% chance of two disasters at once.
		local picks = { disasters[math.random(1, #disasters)] }
		if round >= 3 and math.random() < 0.3 then
			local second = disasters[math.random(1, #disasters)]
			if second ~= picks[1] then table.insert(picks, second) end
		end
		local title = picks[1].name
		if #picks == 2 then title = "DOUBLE DISASTER: " .. picks[1].name .. " + " .. picks[2].name end
		announce(title .. "! " .. picks[1].tip, 4)
		local length = 35
		local running = #picks
		for _, d in ipairs(picks) do
			spawn(function() d.run(length); running = running - 1 end)
		end
		for t = length, 1, -1 do
			hint.Text = title .. "  " .. t .. "s  |  " .. #alivePlayers() .. " alive"
			wait(1)
		end
		local waited = 0
		while running > 0 and waited < 10 do wait(0.5) waited = waited + 0.5 end
		local winners = alivePlayers()
		local names = {}
		for _, p in ipairs(winners) do
			p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
			survived[p.UserId] = (survived[p.UserId] or 0) + 1
			BadgeService:AwardBadge(p.UserId, "Disaster Survivor")
			if survived[p.UserId] >= 10 then BadgeService:AwardBadge(p.UserId, "Disaster Master") end
			if #picks == 2 then BadgeService:AwardBadge(p.UserId, "Double Trouble") end
			table.insert(names, p.Name)
		end
		hint.Text = #names > 0 and ("Survivors: " .. table.concat(names, ", ")) or "Nobody survived!"
		for _, p in ipairs(Players:GetPlayers()) do p.InRound.Value = false end
		flooding = false
		flood.Position = Vector3.new(0, -4, 0)
		sky(13.5)
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
  spawn(ws, [0, 0.5, 30], { color: '#f8f8f8' });
  part(ws, { name: 'Core', size: [4, 400, 4], pos: [0, 200, 0], color: '#635f62', material: 'Slate' });
  folder(ws, 'Tower');
  script(g.ServerScriptService, 'Tower', `
-- Tower of Robis 2.0: a brand-new random tower every round. No checkpoints,
-- and the higher you climb, the harder it gets. Reach the top before the timer runs out!
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local BadgeService = game:GetService("BadgeService")
local Debris = game:GetService("Debris")
local hint = Instance.new("Hint", workspace)
local towerFolder = workspace.Tower
local COLORS = {
	Color3.fromRGB(196, 40, 28), Color3.fromRGB(218, 133, 65), Color3.fromRGB(245, 205, 48), Color3.fromRGB(75, 151, 75),
	Color3.fromRGB(13, 105, 172), Color3.fromRGB(107, 50, 124), Color3.fromRGB(255, 102, 204), Color3.fromRGB(0, 170, 170),
}
local KILL = Color3.fromRGB(255, 42, 0)
local finished = {}
local topY = 0

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local h = Instance.new("IntValue")
	h.Name = "Height"
	h.Parent = ls
end)

local function block(cf, size, color, name, material)
	local p = Instance.new("Part")
	p.Name = name or "Platform"
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Anchored = true
	p.Parent = towerFolder
	return p
end

local function killBrick(cf, size)
	local k = block(cf, size, KILL, "Kill", Enum.Material.Neon)
	k.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h then h.Health = 0 end
	end)
	return k
end

-- Builds the spiral path around the core. Each step picks a random obstacle;
-- deeper "stages" use smaller platforms, longer gaps and more traps.
local function build(seed, mutator)
	towerFolder:ClearAllChildren()
	finished = {}
	local rng = Random.new(seed)
	local R = 17
	local a = 0
	local y = 1
	local steps = 56
	local stageColor = COLORS[1]
	local function at(ang, height) return Vector3.new(math.cos(ang) * R, height, math.sin(ang) * R) end
	block(CFrame.new(at(a, y)), Vector3.new(7, 1, 7), Color3.fromRGB(248, 248, 248), "Start")
	for i = 1, steps do
		local stage = math.floor((i - 1) / 8) + 1
		stageColor = COLORS[(stage - 1) % #COLORS + 1]
		local hard = math.min(1, i / steps)
		local size = 5 - hard * 2.2
		if mutator == "Tiny Platforms" then size = size - 0.8 end
		local gap = 3.2 + hard * 2.6
		local rise = 1.6 + rng:NextNumber(0, 1.6)
		local kinds = { "jump", "jump", "beam", "truss", "kill", "moving", "fade", "sweeper", "wedge" }
		local kind = kinds[rng:NextInteger(1, i < 6 and 2 or #kinds)]
		local from = at(a, y)
		if kind == "beam" then
			local len = 8 + hard * 6
			a = a + len / R
			y = y + 0.5
			local to = at(a, y)
			local mid = (from + to) / 2
			block(CFrame.new(mid, to), Vector3.new(1.2 - hard * 0.4, 1, (to - from).Magnitude), stageColor, "Beam")
			a = a + (gap + size) / R
			y = y + rise * 0.5
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		elseif kind == "truss" then
			a = a + (size / 2 + 2) / R
			local h = 9 + hard * 6
			local base = at(a, y)
			local t = Instance.new("TrussPart")
			t.Name = "Truss"
			t.Size = Vector3.new(2, h, 2)
			t.CFrame = CFrame.new(base + Vector3.new(0, h / 2, 0))
			t.Anchored = true
			t.Color = Color3.fromRGB(163, 162, 165)
			t.Parent = towerFolder
			if hard > 0.5 then killBrick(CFrame.new(base + Vector3.new(0, h * 0.5, 0) + (base - Vector3.new(0, base.Y, 0)).Unit * 1.6), Vector3.new(1.4, 1.4, 1.4)) end
			y = y + h - 1
			a = a + 3.2 / R
			block(CFrame.new(at(a, y)), Vector3.new(size + 1, 1, size + 1), stageColor, "Ledge")
		elseif kind == "kill" then
			local len = 14
			a = a + (len / 2 + 2) / R
			y = y + 0.4
			local c = at(a, y)
			local cf = CFrame.new(c, Vector3.new(0, c.Y, 0)) * CFrame.Angles(0, math.pi / 2, 0)
			block(cf, Vector3.new(5, 1, len), stageColor, "Floor")
			local strips = 2 + math.floor(hard * 2)
			for s = 1, strips do
				local off = -len / 2 + s * len / (strips + 1)
				killBrick(cf * CFrame.new(0, 0.7, off), Vector3.new(5, 0.6, 1.2 + hard))
			end
			a = a + (len / 2 + gap) / R
			y = y + rise * 0.6
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		elseif kind == "moving" then
			a = a + (gap + size + 2) / R
			y = y + rise * 0.5
			local c = at(a, y)
			local p = block(CFrame.new(c), Vector3.new(size + 1, 1, size + 1), Color3.fromRGB(255, 255, 255), "Mover")
			local out = (Vector3.new(c.X, 0, c.Z)).Unit * (4 + hard * 4)
			p.Position = c - out
			TweenService:Create(p, TweenInfo.new(2.4 - hard, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {Position = c + out}):Play()
			a = a + (gap + size + 2) / R
			y = y + rise * 0.5
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		elseif kind == "fade" then
			for k = 1, 3 do
				a = a + (gap * 0.8 + size) / R
				y = y + rise * 0.4
				local p = block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), Color3.fromRGB(180, 210, 255), "Fader", Enum.Material.Glass)
				local phase = k * 0.6
				spawn(function()
					wait(phase)
					while p.Parent do
						wait(2.2 - hard * 0.8)
						for f = 1, 5 do p.Transparency = f / 6 wait(0.08) end
						p.CanCollide = false
						p.Transparency = 0.9
						wait(1.2)
						p.CanCollide = true
						p.Transparency = 0
					end
				end)
			end
		elseif kind == "sweeper" then
			a = a + (gap + 5) / R
			y = y + rise * 0.4
			local c = at(a, y)
			local cf = CFrame.new(c, Vector3.new(0, c.Y, 0))
			block(cf, Vector3.new(8, 1, 8), stageColor, "Floor")
			local bar = killBrick(cf * CFrame.new(-4, 1.2, 0), Vector3.new(0.8, 1.2, 8))
			TweenService:Create(bar, TweenInfo.new(1.6 - hard * 0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {CFrame = cf * CFrame.new(4, 1.2, 0)}):Play()
			a = a + (5 + gap) / R
			y = y + rise * 0.6
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		elseif kind == "wedge" then
			a = a + (size / 2 + 5) / R
			local c = at(a, y + 2)
			local w = Instance.new("WedgePart")
			w.Name = "Ramp"
			w.Size = Vector3.new(4, 4, 8)
			w.CFrame = CFrame.new(c, at(a - 0.5, y + 2))
			w.Anchored = true
			w.Color = stageColor
			w.Parent = towerFolder
			y = y + 4
			a = a + (5 + gap) / R
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		else
			a = a + (gap + size) / R
			y = y + rise
			block(CFrame.new(at(a, y)), Vector3.new(size, 1, size), stageColor)
		end
	end
	a = a + 6 / R
	y = y + 2
	local fin = block(CFrame.new(at(a, y)), Vector3.new(10, 1, 10), Color3.fromRGB(255, 196, 0), "Finish", Enum.Material.Neon)
	local tag = Instance.new("BillboardText")
	tag.Text = "THE TOP!"
	tag.StudsOffset = Vector3.new(0, 5, 0)
	tag.Parent = fin
	topY = y
	fin.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or finished[player] then return end
		finished[player] = true
		player.leaderstats.Wins.Value = player.leaderstats.Wins.Value + 1
		BadgeService:AwardBadge(player.UserId, "Tower Climber")
		if mutator ~= "" then BadgeService:AwardBadge(player.UserId, "Tower Master") end
		local m = Instance.new("Message")
		m.Text = player.Name .. " beat the tower!"
		m.Parent = workspace
		Debris:AddItem(m, 4)
		delay(3, function() if player.Parent then player:LoadCharacter() end end)
	end)
end

-- Live "Height" stat so everyone can see who's highest.
spawn(function()
	while true do
		for _, p in ipairs(Players:GetPlayers()) do
			local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
			if root and p:FindFirstChild("leaderstats") then p.leaderstats.Height.Value = math.max(0, math.floor(root.Position.Y)) end
		end
		wait(0.5)
	end
end)

local MUTATORS = { "", "", "", "Low Gravity", "Speed Boost", "Tiny Platforms", "Fog" }
local ROUND = 6 * 60
while true do
	local mutator = MUTATORS[math.random(1, #MUTATORS)]
	workspace.Gravity = mutator == "Low Gravity" and 120 or 196.2
	game:GetService("Lighting").FogEnd = mutator == "Fog" and 90 or 100000
	build(math.random(1, 1000000), mutator)
	for _, p in ipairs(Players:GetPlayers()) do
		p:LoadCharacter()
	end
	local m = Instance.new("Message")
	m.Text = "A new tower has been built!" .. (mutator ~= "" and ("  Mutator: " .. mutator) or "")
	m.Parent = workspace
	Debris:AddItem(m, 4)
	for t = ROUND, 1, -1 do
		if mutator == "Speed Boost" then
			for _, p in ipairs(Players:GetPlayers()) do
				local h = p.Character and p.Character:FindFirstChild("Humanoid")
				if h and h.WalkSpeed < 22 then h.WalkSpeed = 22 end
			end
		end
		hint.Text = string.format("New tower in %d:%02d", math.floor(t / 60), t % 60) .. (mutator ~= "" and ("   |   " .. mutator) or "") .. "   |   Top: " .. math.floor(topY) .. " studs"
		wait(1)
	end
end
`);
  return finish(g, { name: 'Tower of Robis' });
}
