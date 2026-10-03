// Classic games: Murder Mystery 2 the way it was in 2015-2016. One murderer
// with a knife, one sheriff with a gun, everyone else innocent. Find out who
// the murderer is before it's too late! Collect coins during rounds.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

function tool(parent, name, toolModel, color, tip) {
  return inst(parent, 'Tool', { Name: name, ToolModel: toolModel, Color: Color3.fromHex(color), ToolTip: tip || '' });
}

// A wall from (x1, z1) to (x2, z2) (straight along X or Z), with door gaps at
// the given distances along it.
function wall(parent, x1, z1, x2, z2, y0, h, color, material, doors = []) {
  const alongX = z1 === z2;
  const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const start = alongX ? Math.min(x1, x2) : Math.min(z1, z2);
  const cuts = [...doors].sort((a, b) => a - b);
  let at = 0;
  const segs = [];
  for (const d of cuts) { if (d - 3 > at) segs.push([at, d - 3]); at = d + 3; }
  if (len > at) segs.push([at, len]);
  for (const [a, b] of segs) {
    const mid = start + (a + b) / 2, l = b - a;
    part(parent, { name: 'Wall', size: alongX ? [l, h, 1] : [1, h, l], pos: alongX ? [mid, y0 + h / 2, z1] : [x1, y0 + h / 2, mid], color, material });
  }
  // the wall above each door
  for (const d of cuts) {
    const mid = start + d;
    part(parent, { name: 'Wall', size: alongX ? [6, h - 8, 1] : [1, h - 8, 6], pos: alongX ? [mid, y0 + 8 + (h - 8) / 2, z1] : [x1, y0 + 8 + (h - 8) / 2, mid], color, material });
  }
}

function spawns(map, list, y) {
  const f = folder(map, 'Spawns');
  for (const [x, z] of list) part(f, { name: 'Spawn', size: [2, 1, 2], pos: [x, y, z], transparency: 1, canCollide: false });
}

function lamp(parent, x, y, z, color = '#fff1c4') {
  const l = part(parent, { name: 'Lamp', size: [3, 0.4, 3], pos: [x, y, z], color, material: 'Neon', canCollide: false });
  inst(l, 'PointLight', { Range: 26, Brightness: 1.2, Color: Color3.fromHex(color) });
}

export function gameMM2() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 14;
  g.Lighting.Ambient = Color3.fromRGB(120, 120, 120);
  part(ws, { name: 'Void', size: [900, 2, 900], pos: [0, -40, 0], color: '#1b1b1b', props: { Locked: true } });

  // ---------------------------------------------------------------- lobby
  const lobby = model(ws, 'Lobby');
  part(lobby, { name: 'Floor', size: [56, 1, 44], pos: [0, 0.5, 0], color: '#7c5c46', material: 'WoodPlanks' });
  part(lobby, { name: 'Carpet', size: [24, 0.1, 18], pos: [0, 1.05, 4], color: '#6b1f1f', material: 'Fabric', canCollide: false });
  for (const [x, z, sx, sz] of [[0, -22, 56, 1], [0, 22, 56, 1], [-28, 0, 1, 44], [28, 0, 1, 44]]) part(lobby, { name: 'Wall', size: [sx, 14, sz], pos: [x, 7.5, z], color: '#d9d2c0', material: 'Plastic' });
  part(lobby, { name: 'Ceiling', size: [56, 1, 44], pos: [0, 15, 0], color: '#f2f2f2' });
  part(lobby, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [10, 1, 10], pos: [0, 1.1, 8], color: '#a3a2a5', props: { Duration: 0 } });
  for (const [x, z] of [[-14, -8], [14, -8], [-14, 10], [14, 10]]) lamp(lobby, x, 14.4, z);
  // couches and a table
  for (const s of [-1, 1]) {
    part(lobby, { name: 'Couch', size: [12, 2, 4], pos: [s * 20, 2, -12], color: '#2b4a7a', material: 'Fabric' });
    part(lobby, { name: 'CouchBack', size: [12, 3, 1], pos: [s * 20, 3.5, -14], color: '#2b4a7a', material: 'Fabric' });
  }
  part(lobby, { name: 'Table', size: [8, 0.6, 4], pos: [0, 3, -12], color: '#5a3b1e', material: 'Wood' });
  const sign = part(lobby, { name: 'Sign', size: [20, 6, 0.5], pos: [0, 9, -21.3], color: '#1b1b1b' });
  inst(sign, 'BillboardText', { Text: 'MURDER MYSTERY 2', StudsOffset: new Vector3(0, 0, 0) });
  const how = part(lobby, { name: 'HowTo', size: [1, 1, 1], pos: [0, 6, -21], transparency: 1, canCollide: false });
  inst(how, 'BillboardText', { Text: 'Innocents: hide and survive. Sheriff: shoot the murderer. Murderer: get everyone!', TextSize: 16 });

  const maps = folder(ws, 'Maps');

  // ---------------------------------------------------------------- map 1: Office
  const office = model(maps, 'Office');
  const OX = 260, OY = 0;
  part(office, { name: 'Floor', size: [96, 1, 72], pos: [OX, OY + 0.5, 0], color: '#5a6b7c', material: 'Fabric' });
  part(office, { name: 'Ceiling', size: [96, 1, 72], pos: [OX, OY + 13, 0], color: '#e8e8e8' });
  wall(office, OX - 48, -36, OX + 48, -36, OY + 1, 12, '#c8cfd6', 'Plastic');
  wall(office, OX - 48, 36, OX + 48, 36, OY + 1, 12, '#c8cfd6', 'Plastic');
  wall(office, OX - 48, -36, OX - 48, 36, OY + 1, 12, '#c8cfd6', 'Plastic');
  wall(office, OX + 48, -36, OX + 48, 36, OY + 1, 12, '#c8cfd6', 'Plastic');
  // rooms along the back: meeting room, boss office, kitchen
  wall(office, OX - 48, -10, OX + 48, -10, OY + 1, 12, '#aab4be', 'Plastic', [16, 48, 80]);
  wall(office, OX - 16, -36, OX - 16, -10, OY + 1, 12, '#aab4be', 'Plastic');
  wall(office, OX + 16, -36, OX + 16, -10, OY + 1, 12, '#aab4be', 'Plastic');
  part(office, { name: 'MeetingTable', size: [16, 0.8, 7], pos: [OX - 32, OY + 3.4, -23], color: '#4a3524', material: 'Wood' });
  part(office, { name: 'BossDesk', size: [10, 3, 4], pos: [OX, OY + 2.5, -28], color: '#2f2016', material: 'Wood' });
  part(office, { name: 'Counter', size: [24, 4, 3], pos: [OX + 32, OY + 3, -34], color: '#d9d9d9', material: 'Marble' });
  part(office, { name: 'Fridge', size: [4, 9, 4], pos: [OX + 44, OY + 5.5, -32], color: '#f2f2f2', material: 'Metal' });
  // cubicles in the open space
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const cx = OX - 36 + i * 24, cz = 6 + j * 18;
      part(office, { name: 'Cubicle', size: [12, 5, 0.6], pos: [cx, OY + 3.5, cz - 5], color: '#7d8a99', material: 'Fabric' });
      part(office, { name: 'Cubicle', size: [0.6, 5, 10], pos: [cx - 6, OY + 3.5, cz], color: '#7d8a99', material: 'Fabric' });
      part(office, { name: 'Desk', size: [7, 0.6, 3], pos: [cx - 1, OY + 3.3, cz - 3], color: '#d6c29a', material: 'Wood' });
      part(office, { name: 'Monitor', size: [2.5, 1.8, 0.3], pos: [cx - 1, OY + 4.6, cz - 4], color: '#1b1b1b' });
    }
  }
  part(office, { name: 'Plant', size: [2, 5, 2], pos: [OX + 44, OY + 3.5, 32], color: '#2f5a2a', material: 'Grass' });
  part(office, { name: 'WaterCooler', size: [2, 5, 2], pos: [OX - 44, OY + 3.5, 32], color: '#6fb7ff', material: 'Glass' });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) lamp(office, OX - 30 + i * 30, OY + 12.4, j ? 20 : -24);
  spawns(office, [[OX - 36, 0], [OX - 12, 0], [OX + 12, 0], [OX + 36, 0], [OX - 30, 30], [OX + 30, 30], [OX - 32, -18], [OX + 32, -18], [OX, -20], [OX, 30]], OY + 2);

  // ---------------------------------------------------------------- map 2: Mansion
  const man = model(maps, 'Mansion');
  const MX = -260, MY = 0;
  part(man, { name: 'Floor', size: [104, 1, 84], pos: [MX, MY + 0.5, 0], color: '#6b4a2f', material: 'WoodPlanks' });
  part(man, { name: 'Ceiling', size: [104, 1, 84], pos: [MX, MY + 15, 0], color: '#efe6d6' });
  const W = '#e6dcc5';
  wall(man, MX - 52, -42, MX + 52, -42, MY + 1, 14, W, 'Plastic');
  wall(man, MX - 52, 42, MX + 52, 42, MY + 1, 14, W, 'Plastic');
  wall(man, MX - 52, -42, MX - 52, 42, MY + 1, 14, W, 'Plastic');
  wall(man, MX + 52, -42, MX + 52, 42, MY + 1, 14, W, 'Plastic');
  // a hall in the middle, rooms on both sides
  wall(man, MX - 16, -42, MX - 16, 42, MY + 1, 14, '#d4c6a6', 'Plastic', [14, 42, 70]);
  wall(man, MX + 16, -42, MX + 16, 42, MY + 1, 14, '#d4c6a6', 'Plastic', [14, 42, 70]);
  wall(man, MX - 52, 0, MX - 16, 0, MY + 1, 14, '#d4c6a6', 'Plastic', [18]);
  wall(man, MX + 16, 0, MX + 52, 0, MY + 1, 14, '#d4c6a6', 'Plastic', [18]);
  part(man, { name: 'HallCarpet', size: [10, 0.1, 80], pos: [MX, MY + 1.05, 0], color: '#7a1f2b', material: 'Fabric', canCollide: false });
  // library (bookshelves)
  for (let i = 0; i < 4; i++) part(man, { name: 'Bookshelf', size: [10, 10, 2], pos: [MX - 40 + (i % 2) * 14, MY + 6, -34 + Math.floor(i / 2) * 14], color: '#4a2f1a', material: 'Wood' });
  // dining room
  part(man, { name: 'DiningTable', size: [20, 1, 6], pos: [MX + 34, MY + 3.5, -21], color: '#5a3b1e', material: 'Wood' });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) part(man, { name: 'Chair', size: [2, 4, 2], pos: [MX + 26 + i * 5.4, MY + 3, -21 + s * 5], color: '#3a2412', material: 'Wood' });
  // bedroom
  part(man, { name: 'Bed', size: [10, 2.5, 14], pos: [MX - 36, MY + 2.2, 26], color: '#d9d9f0', material: 'Fabric' });
  part(man, { name: 'Wardrobe', size: [8, 11, 3], pos: [MX - 22, MY + 6.5, 38], color: '#3a2412', material: 'Wood' });
  // kitchen
  part(man, { name: 'Counter', size: [3, 4, 26], pos: [MX + 50, MY + 3, 22], color: '#d9d9d9', material: 'Marble' });
  part(man, { name: 'Island', size: [10, 4, 5], pos: [MX + 34, MY + 3, 24], color: '#bfb8a8', material: 'Marble' });
  // the grand piano in the hall
  part(man, { name: 'Piano', size: [7, 3.5, 6], pos: [MX, MY + 2.8, -30], color: '#111111', material: 'SmoothPlastic' });
  for (const z of [-28, 0, 28]) { lamp(man, MX, MY + 14.4, z, '#ffe0a0'); lamp(man, MX - 34, MY + 14.4, z, '#ffe0a0'); lamp(man, MX + 34, MY + 14.4, z, '#ffe0a0'); }
  spawns(man, [[MX, -20], [MX, 20], [MX - 34, -20], [MX - 34, 20], [MX + 34, -10], [MX + 34, 30], [MX - 40, -10], [MX + 40, 10], [MX, 36], [MX, -36]], MY + 2);

  // ---------------------------------------------------------------- weapons
  const store = g.ServerStorage;
  const knife = tool(store, 'Knife', 'sword', '#3a3a3a', 'Click near someone to stab');
  script(knife, 'KnifeScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function()
	if cooldown then return end
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local me = Players:GetPlayerFromCharacter(char)
	if not root or not me then return end
	cooldown = true
	delay(0.6, function() cooldown = false end)
	local best, bestDist = nil, 7
	for _, p in ipairs(Players:GetPlayers()) do
		local r = p ~= me and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		local h = r and p.Character:FindFirstChild("Humanoid")
		if r and h and h.Health > 0 then
			local d = (r.Position - root.Position).Magnitude
			if d < bestDist then best, bestDist = h, d end
		end
	end
	if best then best.Health = 0 end
end)
`);
  const gun = tool(store, 'Gun', 'gun', '#2a2a2a', 'Click to shoot (reloads 3 seconds). Shoot only the murderer!');
  script(gun, 'GunScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not target then return end
	local char = tool.Parent
	local head = char and char:FindFirstChild("Head")
	local me = Players:GetPlayerFromCharacter(char)
	if not head or not me then return end
	cooldown = true
	delay(3, function() cooldown = false end)
	local origin = head.Position
	local dir = (target - origin).Unit * 300
	local r = workspace:Raycast(origin, dir, char)
	local hitPos = r and r.Position or (origin + dir)
	local beam = Instance.new("Part")
	beam.Name = "Bullet"
	beam.Anchored = true
	beam.CanCollide = false
	beam.Material = Enum.Material.Neon
	beam.Color = Color3.fromRGB(255, 220, 90)
	beam.Size = Vector3.new(0.15, 0.15, (hitPos - origin).Magnitude)
	beam.CFrame = CFrame.new((origin + hitPos) / 2, hitPos)
	beam.Parent = workspace
	Debris:AddItem(beam, 0.1)
	if not r then return end
	local victim = Players:GetPlayerFromCharacter(r.Instance.Parent)
	if victim and victim ~= me then shared.mm2Shot(me, victim) end
end)
`);

  // ---------------------------------------------------------------- the game
  script(g.ServerScriptService, 'MurderMystery', `
-- Murder Mystery 2 (classic). Rounds: intermission, a map, roles, 3 minutes.
-- The murderer wins when everyone else is dead; the innocents win when the
-- murderer dies or the time runs out. If the sheriff dies, the gun drops and
-- any innocent can pick it up and become the hero.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local store = game:GetService("DataStoreService"):GetDataStore("MM2Classic")
local hint = Instance.new("Hint", workspace)
local ROUND = 180
local roles = {}
local alive = {}
local running = false
local murderer = nil
local winner = nil
local map = nil
local coinFolder = Instance.new("Folder")
coinFolder.Name = "Coins"
coinFolder.Parent = workspace

local function msg(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 4)
end

local function saveStats(p)
	local ls = p:FindFirstChild("leaderstats")
	if ls then pcall(function() store:SetAsync("u" .. p.UserId, { coins = ls.Coins.Value, wins = ls.Wins.Value }) end) end
end

local function aliveCount()
	local n, innocents = 0, 0
	for p in pairs(alive) do
		if p.Parent then n = n + 1; if p ~= murderer then innocents = innocents + 1 end end
	end
	return n, innocents
end

local function checkEnd()
	if not running then return end
	if not murderer or not alive[murderer] then winner = "Innocents"; running = false; return end
	local _, innocents = aliveCount()
	if innocents == 0 then winner = "Murderer"; running = false end
end

local function takeTools(p)
	local bp = p:FindFirstChild("Backpack")
	if bp then bp:ClearAllChildren() end
	if p.Character then
		for _, t in ipairs(p.Character:GetChildren()) do if t:IsA("Tool") then t:Destroy() end end
	end
end

local function giveTool(p, name)
	local bp = p:FindFirstChild("Backpack")
	if bp then game.ServerStorage[name]:Clone().Parent = bp end
end

-- the dropped gun: an innocent who walks over it becomes the hero
local function dropGun(pos)
	local d = Instance.new("Part")
	d.Name = "GunDrop"
	d.Size = Vector3.new(2, 1, 2)
	d.Anchored = true
	d.CanCollide = false
	d.Material = Enum.Material.Neon
	d.Color = Color3.fromRGB(80, 160, 255)
	d.Position = Vector3.new(pos.X, pos.Y - 1.5, pos.Z)
	d.Parent = coinFolder
	local t = Instance.new("BillboardText")
	t.Text = "GUN"
	t.Parent = d
	msg("The sheriff is dead! The gun was dropped...", 3)
	d.Touched:Connect(function(hit)
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if not p or not running or not alive[p] or p == murderer or not d.Parent then return end
		d:Destroy()
		roles[p] = "Hero"
		giveTool(p, "Gun")
		p:ShowMessage("You picked up the gun!", 3, Color3.fromRGB(80, 160, 255))
	end)
end

-- the gun hit someone: the murderer dies; shooting an innocent kills the shooter too
shared.mm2Shot = function(shooter, victim)
	if not running or not alive[shooter] or not alive[victim] then return end
	local vh = victim.Character and victim.Character:FindFirstChild("Humanoid")
	if vh then vh.Health = 0 end
	if victim ~= murderer then
		local sh = shooter.Character and shooter.Character:FindFirstChild("Humanoid")
		shooter:ShowMessage("You shot an innocent!", 3, Color3.fromRGB(255, 80, 80))
		if sh then sh.Health = 0 end
	end
end

Players.PlayerAdded:Connect(function(p)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = p
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = ls
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local ok, saved = pcall(function() return store:GetAsync("u" .. p.UserId) end)
	if ok and type(saved) == "table" then coins.Value = saved.coins or 0; wins.Value = saved.wins or 0 end
	p.CharacterAdded:Connect(function(char)
		local h = char:WaitForChild("Humanoid")
		h.Died:Connect(function()
			if not running or not alive[p] then return end
			alive[p] = nil
			local root = char:FindFirstChild("HumanoidRootPart")
			if (roles[p] == "Sheriff" or roles[p] == "Hero") and root then dropGun(root.Position) end
			checkEnd()
		end)
	end)
	if running then p:Notify("A round is on - you'll play in the next one.") end
end)
Players.PlayerRemoving:Connect(function(p)
	saveStats(p)
	alive[p] = nil
	checkEnd()
end)

local function spawnCoins()
	local floor = map.Floor
	for i = 1, 14 do
		local c = Instance.new("Part")
		c.Name = "Coin"
		c.Shape = Enum.PartType.Cylinder
		c.Size = Vector3.new(0.4, 2, 2)
		c.Anchored = true
		c.CanCollide = false
		c.Material = Enum.Material.Neon
		c.Color = Color3.fromRGB(255, 205, 50)
		local x = floor.Position.X + (math.random() - 0.5) * (floor.Size.X - 8)
		local z = floor.Position.Z + (math.random() - 0.5) * (floor.Size.Z - 8)
		c.CFrame = CFrame.new(x, floor.Position.Y + 2.5, z) * CFrame.Angles(0, 0, math.pi / 2)
		c.Parent = coinFolder
		c.Touched:Connect(function(hit)
			local p = Players:GetPlayerFromCharacter(hit.Parent)
			if not p or not alive[p] or not c.Parent then return end
			c:Destroy()
			p.leaderstats.Coins.Value = p.leaderstats.Coins.Value + 1
		end)
	end
end

local function shuffle(t)
	for i = #t, 2, -1 do local j = math.random(1, i); t[i], t[j] = t[j], t[i] end
	return t
end

while true do
	local players = Players:GetPlayers()
	if #players < 2 then
		hint.Text = "Waiting for players... (Murder Mystery needs at least 2)"
		wait(2)
	else
		for i = 15, 1, -1 do
			hint.Text = "Intermission: " .. i
			wait(1)
		end
		players = shuffle(Players:GetPlayers())
		if #players >= 2 then
			local maps = workspace.Maps:GetChildren()
			map = maps[math.random(1, #maps)]
			roles, alive, winner = {}, {}, nil
			murderer = players[1]
			local spots = shuffle(map.Spawns:GetChildren())
			for i, p in ipairs(players) do
				roles[p] = i == 1 and "Murderer" or i == 2 and "Sheriff" or "Innocent"
				local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
				if root then
					alive[p] = true
					local s = spots[((i - 1) % #spots) + 1]
					root.CFrame = CFrame.new(s.Position + Vector3.new(0, 3, 0))
				end
				if roles[p] == "Murderer" then
					p:ShowMessage("You are the MURDERER", 4, Color3.fromRGB(255, 60, 60))
					p:Notify("Murderer: get everyone before the time runs out. Don't get shot!")
				elseif roles[p] == "Sheriff" then
					p:ShowMessage("You are the SHERIFF", 4, Color3.fromRGB(80, 160, 255))
					p:Notify("Sheriff: find the murderer and shoot them. Shooting an innocent kills you too!")
				else
					p:ShowMessage("You are INNOCENT", 4, Color3.fromRGB(90, 220, 110))
					p:Notify("Innocent: hide, collect coins and stay alive!")
				end
			end
			msg("Map: " .. map.Name, 3)
			wait(4)
			if alive[murderer] then giveTool(murderer, "Knife") end
			for p, r in pairs(roles) do if r == "Sheriff" and alive[p] then giveTool(p, "Gun") end end
			running = true
			spawnCoins()
			local t = ROUND
			while running and t > 0 do
				local n, innocents = aliveCount()
				hint.Text = map.Name .. "   |   " .. innocents .. " innocent" .. (innocents == 1 and "" or "s") .. " left   |   " .. math.floor(t / 60) .. ":" .. string.format("%02d", t % 60)
				checkEnd()
				wait(1)
				t = t - 1
			end
			running = false
			if not winner then winner = "Innocents" end
			local mname = murderer and murderer.Name or "?"
			if winner == "Murderer" then
				msg("The murderer " .. mname .. " wins!", 5)
				if murderer and murderer.Parent then murderer.leaderstats.Wins.Value = murderer.leaderstats.Wins.Value + 1 end
			else
				msg("Innocents win! The murderer was " .. mname, 5)
				for p in pairs(alive) do
					if p.Parent and p ~= murderer then p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1 end
				end
			end
			hint.Text = "Round over"
			wait(5)
			coinFolder:ClearAllChildren()
			for _, p in ipairs(Players:GetPlayers()) do
				takeTools(p)
				saveStats(p)
				p:LoadCharacter()
			end
			roles, alive, murderer = {}, {}, nil
		end
	end
end
`);
  return finish(g, { name: 'Murder Mystery 2' });
}

export const CLASSIC_GAMES = [
  { key: 'mm2', name: 'Murder Mystery 2', build: gameMM2, genre: 'Horror', featured: true, maxPlayers: 12,
    visits: 154820, up: 4210, down: 260, favorites: 9800,
    description: 'The classic! One murderer, one sheriff, everyone else innocent. Hide, collect coins and figure out who the murderer is before it\'s too late. The sheriff must shoot the murderer - but shooting an innocent kills the sheriff too!' },
];
