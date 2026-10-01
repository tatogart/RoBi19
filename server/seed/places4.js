// Nostalgic places: a family home, rotating minigames and a theme park.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, spawn, tree, finish } from './builder.js';

const RAINBOW = ['#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc'];

// ================================================================ Happy Home in Robisia
export function gameHappyHome() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 15;
  baseplate(ws, { color: '#4b974b', size: [300, 20, 300] });
  part(ws, { name: 'Street', size: [300, 0.2, 16], pos: [0, 0.1, 44], color: '#3a3a3c', material: 'Slate' });
  part(ws, { name: 'Sidewalk', size: [300, 0.4, 5], pos: [0, 0.2, 33.5], color: '#a3a2a5', material: 'Concrete' });
  part(ws, { name: 'Path', size: [6, 0.3, 16], pos: [0, 0.15, 23], color: '#a3a2a5', material: 'Concrete' });
  spawn(ws, [0, 0.5, 38], { color: '#a3a2a5' });

  const house = model(ws, 'House');
  const W = '#f2e3c6';
  part(house, { name: 'Floor', size: [44, 1, 30], pos: [0, 0.5, 0], color: '#cc8e69', material: 'WoodPlanks' });
  // ground floor walls (door gap at the front, windows at the sides)
  for (const [x, z, sx, sz] of [[0, -14.5, 44, 1], [-21.5, 0, 1, 30], [21.5, 0, 1, 30], [-13.5, 14.5, 17, 1], [13.5, 14.5, 17, 1]]) {
    part(house, { name: 'Wall', size: [sx, 11, sz], pos: [x, 6.5, z], color: W });
  }
  part(house, { name: 'Wall', size: [10, 3, 1], pos: [0, 10.5, 14.5], color: W });
  for (const z of [-6, 6]) for (const x of [-21.6, 21.6]) part(house, { name: 'Window', size: [0.3, 4, 6], pos: [x, 6, z], color: '#b4d2e4', material: 'Glass', transparency: 0.4 });
  // second floor with a hole for the stairs
  part(house, { name: 'Upstairs', size: [44, 1, 20], pos: [0, 12.5, -5], color: '#cc8e69', material: 'WoodPlanks' });
  part(house, { name: 'Upstairs', size: [30, 1, 10], pos: [7, 12.5, 10], color: '#cc8e69', material: 'WoodPlanks' });
  part(house, { cls: 'WedgePart', name: 'Stairs', size: [8, 12, 14], pos: [-17, 6.5, 7.5], rot: [0, 180, 0], color: '#a0725b', material: 'WoodPlanks' });
  for (const [x, z, sx, sz] of [[0, -14.5, 44, 1], [-21.5, 0, 1, 30], [21.5, 0, 1, 30], [0, 14.5, 44, 1]]) {
    part(house, { name: 'Wall', size: [sx, 9, sz], pos: [x, 17.5, z], color: '#dcc9a6' });
  }
  part(house, { cls: 'WedgePart', name: 'Roof', size: [46, 8, 16], pos: [0, 26, -8], color: '#56422f' });
  part(house, { cls: 'WedgePart', name: 'Roof', size: [46, 8, 16], pos: [0, 26, 8], rot: [0, 180, 0], color: '#56422f' });

  const stuff = model(ws, 'Furniture');
  // living room: couch and TV
  part(stuff, { name: 'Couch', size: [12, 2, 4], pos: [8, 2, 8], color: '#c4281c', material: 'Fabric' });
  part(stuff, { name: 'CouchBack', size: [12, 3, 1], pos: [8, 3.5, 10.5], color: '#c4281c', material: 'Fabric' });
  part(stuff, { name: 'TVStand', size: [8, 3, 3], pos: [8, 2.5, -2], color: '#56422f', material: 'Wood' });
  const tv = part(stuff, { name: 'TV', size: [7, 4.5, 0.6], pos: [8, 6.25, -2.5], color: '#111111' });
  inst(tv, 'ClickDetector', { MaxActivationDistance: 30 });
  inst(tv, 'BillboardText', { Text: 'TV (click)', StudsOffset: new Vector3(0, 3.5, 0) });
  part(stuff, { name: 'Screen', size: [6.2, 3.8, 0.2], pos: [8, 6.25, -2.1], color: '#1b2a35', material: 'Neon' });
  // kitchen
  part(stuff, { name: 'Counter', size: [14, 4, 3], pos: [-12, 2.5, -12.5], color: '#f8f8f8', material: 'Marble' });
  const fridge = part(stuff, { name: 'Fridge', size: [4, 8, 3], pos: [-3, 4.5, -12.5], color: '#e5e4df', material: 'Metal' });
  inst(fridge, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(fridge, 'BillboardText', { Text: 'Snack!', StudsOffset: new Vector3(0, 5, 0) });
  // upstairs bedroom
  for (const [x, c] of [[-10, '#0d69ac'], [10, '#ff66cc']]) {
    part(stuff, { name: 'Bed', size: [6, 2, 10], pos: [x, 14, -9], color: '#f8f8f8', material: 'Fabric' });
    part(stuff, { name: 'Blanket', size: [6.2, 0.4, 6], pos: [x, 15.2, -7], color: c, material: 'Fabric' });
    part(stuff, { name: 'Pillow', size: [4, 0.8, 2], pos: [x, 15.4, -12.5], color: '#ffffff', material: 'Fabric' });
  }
  const lights = folder(ws, 'Lights');
  for (const [x, y, z] of [[8, 11.5, 2], [-12, 11.5, -6], [0, 21, -5]]) {
    const l = part(lights, { name: 'Lamp', size: [2, 0.6, 2], pos: [x, y, z], color: '#fff6a8', material: 'Neon' });
    inst(l, 'PointLight', { Range: 20, Brightness: 1.2 });
  }
  const sw = part(stuff, { name: 'LightSwitch', size: [1, 1.4, 0.3], pos: [-3, 5, 13.8], color: '#f8f8f8' });
  inst(sw, 'ClickDetector', { MaxActivationDistance: 16 });
  inst(sw, 'BillboardText', { Text: 'Lights', StudsOffset: new Vector3(0, 1.5, 0), TextSize: 16 });
  const bell = part(house, { name: 'Doorbell', size: [0.8, 0.8, 0.3], pos: [6, 5, 15.2], color: '#f5cd30', material: 'Neon' });
  inst(bell, 'ClickDetector', { MaxActivationDistance: 16 });

  // backyard: pool and trampoline
  part(ws, { name: 'PoolEdge', size: [30, 1, 20], pos: [0, 0.5, -34], color: '#f8f8f8', material: 'Marble' });
  part(ws, { name: 'Water', size: [26, 0.6, 16], pos: [0, 1.1, -34], color: '#04afec', material: 'Glass', transparency: 0.35, canCollide: false });
  part(ws, { name: 'PoolFloor', size: [26, 0.2, 16], pos: [0, -1.5, -34], color: '#6e99ca' });
  const tramp = part(ws, { name: 'Trampoline', size: [0.6, 10, 10], pos: [-35, 1, -30], color: '#1b2a35', shape: 'Cylinder', rot: [0, 0, 90] });
  inst(tramp, 'BillboardText', { Text: 'Trampoline', StudsOffset: new Vector3(0, 4, 0) });
  // the family car
  const car = model(ws, 'Car');
  part(car, { name: 'Body', size: [8, 3, 16], pos: [30, 2, 10], color: '#0d69ac', material: 'SmoothPlastic' });
  part(car, { name: 'Top', size: [7, 2.5, 8], pos: [30, 4.75, 9], color: '#6e99ca', material: 'Glass', transparency: 0.3 });
  for (const [dx, dz] of [[-4.2, -5], [4.2, -5], [-4.2, 5], [4.2, 5]]) part(car, { name: 'Wheel', size: [1, 3, 3], pos: [30 + dx, 1.5, 10 + dz], color: '#111111', shape: 'Cylinder' });
  const horn = part(car, { name: 'Horn', size: [2, 0.4, 2], pos: [30, 6.2, 9], color: '#f5cd30', material: 'Neon' });
  inst(horn, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(horn, 'BillboardText', { Text: 'Honk!', StudsOffset: new Vector3(0, 2, 0) });
  for (const [x, z] of [[-40, 10], [40, -35], [-45, -45], [55, 20], [-60, 20]]) tree(ws, x, z);
  script(g.ServerScriptService, 'Home', `
-- Happy Home in Robisia: everything in the house can be clicked.
local Debris = game:GetService("Debris")
local stuff = workspace.Furniture

local function say(text, secs)
	local h = Instance.new("Hint")
	h.Text = text
	h.Parent = workspace
	Debris:AddItem(h, secs or 3)
end

-- TV: flip through the channels
local channels = {Color3.fromRGB(27, 42, 53), Color3.fromRGB(0, 162, 255), Color3.fromRGB(255, 102, 204), Color3.fromRGB(75, 151, 75), Color3.fromRGB(245, 205, 48)}
local ch = 1
stuff.TV.ClickDetector.MouseClick:Connect(function(player)
	ch = ch % #channels + 1
	stuff.Screen.Color = channels[ch]
	say(player.Name .. " switched to channel " .. ch, 2)
end)

-- Fridge: a snack appears on the counter
stuff.Fridge.ClickDetector.MouseClick:Connect(function(player)
	local snack = Instance.new("Part")
	snack.Name = "Snack"
	snack.Shape = Enum.PartType.Ball
	snack.Size = Vector3.new(1.5, 1.5, 1.5)
	snack.Color = Color3.fromHSV(math.random(), 0.8, 1)
	snack.Position = stuff.Counter.Position + Vector3.new(math.random(-5, 5), 3, 0)
	snack.Parent = workspace
	Debris:AddItem(snack, 20)
end)

-- Light switch
local on = true
stuff.LightSwitch.ClickDetector.MouseClick:Connect(function()
	on = not on
	for _, lamp in ipairs(workspace.Lights:GetChildren()) do
		lamp.PointLight.Enabled = on
		lamp.Material = on and Enum.Material.Neon or Enum.Material.SmoothPlastic
	end
end)

-- Doorbell and car horn
workspace.House.Doorbell.ClickDetector.MouseClick:Connect(function(player)
	say("Ding dong! " .. player.Name .. " is at the door!", 3)
end)
workspace.Car.Horn.ClickDetector.MouseClick:Connect(function(player)
	say("HONK HONK! (" .. player.Name .. ")", 2)
end)

-- Trampoline
workspace.Trampoline.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h and h.JumpPower < 100 then
		h.JumpPower = 140
		delay(1, function() h.JumpPower = 50 end)
	end
end)
`);
  return finish(g, { name: 'Happy Home in Robisia' });
}

// ================================================================ Minigame Mania
export function gameMinigames() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 14;
  part(ws, { name: 'Void', size: [400, 2, 400], pos: [0, -20, 0], color: '#111111', material: 'Slate', props: { Locked: true } });
  // lobby
  const lobby = model(ws, 'Lobby');
  part(lobby, { name: 'LobbyFloor', size: [50, 2, 50], pos: [0, 80, 90], color: '#6b327c', material: 'SmoothPlastic', top: 'Studs' });
  part(lobby, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [10, 1, 10], pos: [0, 81.5, 90], color: '#f5cd30' });
  for (const [x, z, sx, sz] of [[0, 65, 50, 1], [0, 115, 50, 1], [-25, 90, 1, 50], [25, 90, 1, 50]]) {
    part(lobby, { name: 'Glass', size: [sx, 8, sz], pos: [x, 85, z], color: '#b4d2e4', material: 'Glass', transparency: 0.6 });
  }
  const sign = part(lobby, { name: 'Sign', size: [20, 6, 1], pos: [0, 86, 66], color: '#1b2a35' });
  inst(sign, 'BillboardText', { Text: 'MINIGAME MANIA', StudsOffset: new Vector3(0, 5, 0) });
  // arena: 10x10 tiles
  const tiles = folder(ws, 'Tiles');
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    part(tiles, { name: 'Tile', size: [6, 1, 6], pos: [(i - 4.5) * 6.2, 20, (j - 4.5) * 6.2], color: (i + j) % 2 ? '#a3a2a5' : '#f8f8f8', material: 'SmoothPlastic' });
  }
  part(ws, { cls: 'SpawnLocation', name: 'ArenaSpawn', size: [2, 0.2, 2], pos: [0, 21, 0], transparency: 1, canCollide: false, props: { Enabled: false } });
  part(ws, { name: 'Lava', size: [120, 1, 120], pos: [0, 2, 0], color: '#ff5a00', material: 'Neon', canCollide: false });
  script(g.ServerScriptService, 'Minigames', `
-- Minigame Mania: a random minigame every round. Survive to win!
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local tiles = workspace.Tiles:GetChildren()
local lobbySpawn = workspace.Lobby.LobbySpawn
local arenaSpawn = workspace.ArenaSpawn
local hint = Instance.new("Hint", workspace)

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local r = Instance.new("BoolValue")
	r.Name = "InRound"
	r.Parent = player
	-- Dying knocks you out of the round (you respawn in the lobby, alive, but you didn't survive).
	player.CharacterAdded:Connect(function(char)
		local hum = char:FindFirstChild("Humanoid")
		if hum then hum.Died:Connect(function() if player:FindFirstChild("InRound") then player.InRound.Value = false end end) end
	end)
end)

workspace.Lava.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h then h.Health = 0 end
end)

local function announce(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

local function alive()
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if h and h.Health > 0 and p.InRound.Value then table.insert(list, p) end
	end
	return list
end

local function resetTiles()
	for i, t in ipairs(tiles) do
		t.Transparency = 0
		t.CanCollide = true
		t.Material = Enum.Material.SmoothPlastic
		t.Color = (i % 2 == 0) and Color3.fromRGB(163, 162, 165) or Color3.fromRGB(248, 248, 248)
	end
end

local function hide(t)
	t.Transparency = 0.9
	t.CanCollide = false
end

local busy = {}
local burning = {}
local mode = nil
for _, t in ipairs(tiles) do
	t.Touched:Connect(function(hit)
		if mode == "Spleef" and not busy[t] and t.CanCollide and hit.Parent:FindFirstChild("Humanoid") then
			busy[t] = true
			t.Color = Color3.fromRGB(255, 90, 0)
			delay(0.6, function() hide(t) busy[t] = nil end)
		elseif mode == "Hot Floor" and burning[t] then
			local h = hit.Parent:FindFirstChild("Humanoid")
			if h then h.Health = 0 end
		end
	end)
end

local COLORS = {
	{"RED", Color3.fromRGB(196, 40, 28)}, {"BLUE", Color3.fromRGB(13, 105, 172)},
	{"GREEN", Color3.fromRGB(75, 151, 75)}, {"YELLOW", Color3.fromRGB(245, 205, 48)},
}

local games = {
	{ name = "Spleef", tip = "Tiles fall after you step on them. Keep moving!", run = function(t0)
		while tick() - t0 < 45 and #alive() > 0 do wait(0.5) end
	end },
	{ name = "Color Crazy", tip = "Stand on the colour I call out!", run = function(t0)
		for round = 1, 7 do
			if #alive() == 0 then break end
			local colorOf = {}
			for _, t in ipairs(tiles) do
				local c = math.random(1, 4)
				colorOf[t] = c
				t.Color = COLORS[c][2]
			end
			local pick = math.random(1, 4)
			hint.Text = "Stand on " .. COLORS[pick][1] .. "!"
			wait(math.max(1.5, 5 - round * 0.5))
			for _, t in ipairs(tiles) do if colorOf[t] ~= pick then hide(t) end end
			wait(2)
			resetTiles()
			wait(1)
		end
	end },
	{ name = "Hot Floor", tip = "Orange tiles are about to burn. Get off them!", run = function(t0)
		while tick() - t0 < 35 and #alive() > 0 do
			local hot = {}
			for _, t in ipairs(tiles) do
				if math.random() < 0.35 then table.insert(hot, t) t.Color = Color3.fromRGB(255, 170, 0) end
			end
			wait(1.2)
			for _, t in ipairs(hot) do burning[t] = true t.Material = Enum.Material.Neon t.Color = Color3.fromRGB(255, 40, 0) end
			wait(1.3)
			burning = {}
			resetTiles()
		end
	end },
	{ name = "Shrinking Floor", tip = "The floor gets smaller. Stay in the middle!", run = function(t0)
		local radius = 32
		while radius > 4 and #alive() > 0 do
			radius = radius - 3
			for _, t in ipairs(tiles) do
				local p = t.Position
				if math.max(math.abs(p.X), math.abs(p.Z)) > radius then hide(t) end
			end
			wait(3)
		end
		wait(4)
	end },
}

while true do
	mode = nil
	resetTiles()
	for i = 10, 1, -1 do
		hint.Text = "Next minigame in " .. i
		wait(1)
	end
	local players = Players:GetPlayers()
	if #players == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		local mg = games[math.random(1, #games)]
		announce(mg.name .. "! " .. mg.tip, 4)
		for _, p in ipairs(players) do
			p.InRound.Value = true
			p.RespawnLocation = arenaSpawn
			p:LoadCharacter()
			p.RespawnLocation = lobbySpawn
		end
		wait(4)
		mode = mg.name
		hint.Text = mg.name .. "!"
		mg.run(tick())
		mode = nil
		local winners = alive()
		local names = {}
		for _, p in ipairs(winners) do
			p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
			table.insert(names, p.Name)
		end
		hint.Text = #names > 0 and ("Winners: " .. table.concat(names, ", ")) or "Nobody survived!"
		for _, p in ipairs(Players:GetPlayers()) do p.InRound.Value = false end
		wait(4)
		for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
	end
end
`);
  return finish(g, { name: 'Minigame Mania' });
}

// ================================================================ Robis Theme Park
export function gameThemePark() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 12;
  baseplate(ws, { color: '#4b974b', size: [400, 20, 400] });
  spawn(ws, [0, 0.5, 70], { color: '#f5cd30' });
  part(ws, { name: 'Walkway', size: [12, 0.3, 140], pos: [0, 0.15, 10], color: '#d7c59a', material: 'Sand' });
  part(ws, { name: 'Walkway', size: [140, 0.3, 12], pos: [0, 0.15, 0], color: '#d7c59a', material: 'Sand' });
  const gate = model(ws, 'Entrance');
  part(gate, { name: 'Pillar', size: [3, 16, 3], pos: [-9, 8, 55], color: '#c4281c' });
  part(gate, { name: 'Pillar', size: [3, 16, 3], pos: [9, 8, 55], color: '#c4281c' });
  const arch = part(gate, { name: 'Arch', size: [22, 3, 3], pos: [0, 17.5, 55], color: '#f5cd30', material: 'Neon' });
  inst(arch, 'BillboardText', { Text: 'ROBIS THEME PARK', StudsOffset: new Vector3(0, 4, 0) });

  // Ferris wheel (cabins are platforms that stay level while they go round)
  const wheel = model(ws, 'FerrisWheel');
  part(wheel, { name: 'Leg', size: [2, 48, 2], pos: [-8, 22, -70], rot: [0, 0, 12], color: '#f8f8f8', material: 'Metal' });
  part(wheel, { name: 'Leg', size: [2, 48, 2], pos: [8, 22, -70], rot: [0, 0, -12], color: '#f8f8f8', material: 'Metal' });
  part(wheel, { name: 'Hub', size: [4, 4, 4], pos: [0, 44, -70], color: '#c4281c', shape: 'Ball' });
  const cabins = folder(wheel, 'Cabins');
  for (let i = 0; i < 8; i++) {
    part(cabins, { name: 'Cabin', size: [6, 1, 6], pos: [0, 44, -70], color: RAINBOW[i % RAINBOW.length], material: 'SmoothPlastic' });
  }
  part(wheel, { name: 'Boarding', size: [10, 3, 10], pos: [0, 1.5, -58], color: '#a3a2a5', material: 'DiamondPlate' });

  // Carousel
  const carousel = model(ws, 'Carousel');
  const disc = part(carousel, { name: 'Disc', size: [1, 30, 30], pos: [-60, 1, 0], color: '#ff66cc', shape: 'Cylinder', rot: [0, 0, 90], material: 'SmoothPlastic' });
  inst(disc, 'BillboardText', { Text: 'Carousel', StudsOffset: new Vector3(0, 10, 0) });
  part(carousel, { name: 'Pole', size: [2, 16, 2], pos: [-60, 9, 0], color: '#f5cd30', material: 'Metal' });
  part(carousel, { name: 'Canopy', size: [1, 32, 32], pos: [-60, 17.5, 0], color: '#c4281c', shape: 'Cylinder', rot: [0, 0, 90], material: 'Fabric' });
  const horses = folder(carousel, 'Horses');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(horses, { name: 'Horse', size: [1.5, 3, 4], pos: [-60 + Math.cos(a) * 10, 3, Math.sin(a) * 10], color: ['#f8f8f8', '#56422f', '#f5cd30'][i % 3] });
  }

  // Drop tower
  const tower = model(ws, 'DropTower');
  part(tower, { name: 'Tower', size: [4, 70, 4], pos: [62, 35, 0], color: '#1b2a35', material: 'Metal' });
  const seat = part(tower, { name: 'DropPlatform', size: [12, 1, 12], pos: [62, 1, 0], color: '#f5cd30', material: 'DiamondPlate' });
  inst(seat, 'BillboardText', { Text: 'Drop Tower', StudsOffset: new Vector3(0, 4, 0) });

  // Snack stand
  const stand = part(ws, { name: 'SnackStand', size: [8, 5, 4], pos: [20, 2.5, 25], color: '#f8f8f8' });
  inst(stand, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(stand, 'BillboardText', { Text: 'Ice cream (click)', StudsOffset: new Vector3(0, 4.5, 0) });
  part(ws, { name: 'Awning', size: [9, 0.6, 5], pos: [20, 6.5, 25], color: '#c4281c', material: 'Fabric' });
  for (const [x, z] of [[-30, 40], [30, 40], [-35, -35], [35, -35], [80, 50], [-80, 50]]) tree(ws, x, z);
  const balloons = folder(ws, 'Balloons');
  for (let i = 0; i < 10; i++) {
    part(balloons, { name: 'Balloon', size: [2, 2.5, 2], pos: [-20 + i * 4, 14 + (i % 3), 30], color: RAINBOW[i % RAINBOW.length], shape: 'Ball', material: 'SmoothPlastic', canCollide: false });
  }
  script(g.ServerScriptService, 'Rides', `
-- Robis Theme Park: stand on a ride and it takes you along.
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

-- Ferris wheel: cabins go round the hub and stay level
local hub = workspace.FerrisWheel.Hub.Position
local cabins = workspace.FerrisWheel.Cabins:GetChildren()
local R = 40
-- Carousel
local disc = workspace.Carousel.Disc
local center = disc.Position
local horses = workspace.Carousel.Horses:GetChildren()
-- Balloons bob up and down
local balloons = workspace.Balloons:GetChildren()
local t = 0
RunService.Heartbeat:Connect(function(dt)
	t = t + dt
	for i, c in ipairs(cabins) do
		local a = t * 0.18 + (i / #cabins) * math.pi * 2
		c.CFrame = CFrame.new(hub + Vector3.new(0, math.sin(a) * R, math.cos(a) * R))
	end
	disc.CFrame = CFrame.new(center) * CFrame.Angles(0, t * 0.5, math.rad(90))
	for i, h in ipairs(horses) do
		local a = t * 0.5 + (i / #horses) * math.pi * 2
		h.CFrame = CFrame.new(center + Vector3.new(math.cos(a) * 10, 3 + math.sin(t * 3 + i) * 0.8, -math.sin(a) * 10)) * CFrame.Angles(0, -a, 0)
	end
	for i, b in ipairs(balloons) do
		b.Position = Vector3.new(b.Position.X, 14 + (i % 3) + math.sin(t * 1.5 + i) * 0.6, b.Position.Z)
	end
end)

-- Ice cream!
workspace.SnackStand.ClickDetector.MouseClick:Connect(function(player)
	local cone = Instance.new("Part")
	cone.Name = "IceCream"
	cone.Shape = Enum.PartType.Ball
	cone.Size = Vector3.new(1.4, 1.4, 1.4)
	cone.Color = Color3.fromHSV(math.random(), 0.4, 1)
	cone.Position = workspace.SnackStand.Position + Vector3.new(math.random(-3, 3), 3.5, -3)
	cone.Parent = workspace
	Debris:AddItem(cone, 15)
end)

-- Drop tower: slowly up, a scary pause, then DOWN
local seat = workspace.DropTower.DropPlatform
local bottom = seat.Position
while true do
	wait(6)
	local up = TweenService:Create(seat, TweenInfo.new(9, Enum.EasingStyle.Sine), {Position = bottom + Vector3.new(0, 60, 0)})
	up:Play()
	wait(12)
	local down = TweenService:Create(seat, TweenInfo.new(1.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {Position = bottom})
	down:Play()
	wait(2)
end
`);
  return finish(g, { name: 'Robis Theme Park' });
}

export const NOSTALGIA_GAMES = [
  { key: 'happyhome', name: 'Happy Home in Robisia', build: gameHappyHome, genre: 'Town and City', featured: true, maxPlayers: 12,
    visits: 64810, up: 1720, down: 140, favorites: 4300,
    description: 'Hang out at the classic family home! Flip TV channels, grab a snack, bounce on the trampoline and swim in the pool.' },
  { key: 'minigames', name: 'Minigame Mania', build: gameMinigames, genre: 'Comedy', featured: true, maxPlayers: 16,
    visits: 88430, up: 2410, down: 190, favorites: 6900,
    description: 'Spleef, Color Crazy, Hot Floor, Shrinking Floor... A random minigame every round. Survive to win!' },
  { key: 'themepark', name: 'Robis Theme Park', build: gameThemePark, genre: 'Town and City', featured: false, maxPlayers: 20,
    visits: 30512, up: 900, down: 85, favorites: 2100,
    description: 'Ride the Ferris wheel, spin on the carousel, scream on the Drop Tower and grab an ice cream.' },
];
