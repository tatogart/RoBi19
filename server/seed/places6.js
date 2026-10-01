// New games for the big update: DOORS, Kart Racing, a team shooter and Speed Draw.
// They use the newer engine features: Tools (StarterPack, Activated, Raycast)
// and VehicleSeats.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, spawn, finish } from './builder.js';

const RAINBOW = ['#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc', '#00aaaa'];

function tool(parent, name, toolModel, color, o = {}) {
  return inst(parent, 'Tool', { Name: name, ToolModel: toolModel, Color: Color3.fromHex(color), ToolTip: o.tip || '', Automatic: !!o.auto });
}

// ================================================================ DOORS
export function gameDoors() {
  const g = newGame();
  const ws = g.Workspace;
  const L = g.Lighting;
  L.ClockTime = 0;
  L.Brightness = 0.4;
  L.Ambient = Color3.fromRGB(25, 22, 30);
  L.OutdoorAmbient = Color3.fromRGB(20, 20, 26);
  L.FogEnd = 220;
  L.FogColor = Color3.fromRGB(8, 8, 12);
  // The hotel lobby: the elevator where every run starts.
  const lob = model(ws, 'Lobby');
  part(lob, { name: 'LobbyFloor', size: [30, 1, 30], pos: [0, 0.5, 40], color: '#56422f', material: 'WoodPlanks' });
  part(lob, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [8, 1, 8], pos: [0, 1.5, 44], color: '#7c5c46', props: { Duration: 0 } });
  for (const [x, z, sx, sz] of [[0, 55, 30, 1], [-15, 40, 1, 30], [15, 40, 1, 30], [-9, 25, 12, 1], [9, 25, 12, 1]]) {
    part(lob, { name: 'Wall', size: [sx, 14, sz], pos: [x, 7.5, z], color: '#3b2a24', material: 'Wood' });
  }
  part(lob, { name: 'Ceiling', size: [30, 1, 30], pos: [0, 14.5, 40], color: '#2a1f1b', material: 'Wood' });
  const lamp = part(lob, { name: 'Lamp', size: [3, 0.5, 3], pos: [0, 14, 40], color: '#ffe0a0', material: 'Neon' });
  inst(lamp, 'PointLight', { Range: 30, Brightness: 2, Color: Color3.fromRGB(255, 210, 150) });
  part(lob, { name: 'LobbyGate', size: [6, 12, 1], pos: [0, 7, 25], color: '#1b1b1b', material: 'Metal' });
  part(ws, { name: 'Void', size: [300, 2, 4000], pos: [0, -60, -1900], color: '#000000', transparency: 1, canCollide: false });
  folder(ws, 'Rooms');
  const sp = g.GetService('StarterPack');
  tool(sp, 'Flashlight', 'flashlight', '#333333', { tip: 'Lights the way in dark rooms' });
  script(g.ServerScriptService, 'Hotel', `
-- DOORS: walk through the hotel, door by door. Hide in closets when the
-- lights flicker (Rush is coming!), find keys for locked doors and survive
-- Seek's chase. Reach Door 50 to escape.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local rooms = workspace.Rooms
local hint = Instance.new("Hint", workspace)
local lobbySpawn = workspace.Lobby.LobbySpawn
local GOAL = 50
local WIDTH = 28

local inRun = {}      -- players in the current run
local hiding = {}     -- player -> closet
local roomList = {}   -- n -> { model, z0, z1, door, lights, locked, keyFound }
local opened = 0      -- highest door opened
local running = false
local entityActive = false
local chase = false

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local best = Instance.new("IntValue")
	best.Name = "Best Door"
	best.Parent = ls
	local wins = Instance.new("IntValue")
	wins.Name = "Escapes"
	wins.Parent = ls
	player.CharacterAdded:Connect(function(char)
		local hum = char:FindFirstChild("Humanoid")
		if hum then hum.Died:Connect(function() inRun[player] = nil hiding[player] = nil end) end
	end)
end)
Players.PlayerRemoving:Connect(function(p) inRun[p] = nil hiding[p] = nil end)

local function say(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

local function runners()
	local list = {}
	for p in pairs(inRun) do
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if p.Parent and h and h.Health > 0 then table.insert(list, p) end
	end
	return list
end

local function rootOf(p)
	return p.Character and p.Character:FindFirstChild("HumanoidRootPart")
end

local function newPart(parent, name, size, cf, color, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Anchored = true
	p.Parent = parent
	return p
end

local WOOD = Color3.fromRGB(86, 66, 47)
local WALL = Color3.fromRGB(70, 50, 44)
local DARK = Color3.fromRGB(40, 30, 26)

-- A closet you can hide in: click it to get in, click again to get out.
local function closet(room, x, z, facing)
	local m = Instance.new("Model")
	m.Name = "Closet"
	m.Parent = room
	local c = CFrame.new(x, 4.5, z) * CFrame.Angles(0, facing, 0)
	newPart(m, "Back", Vector3.new(5, 8, 0.5), c * CFrame.new(0, 0, 2), WOOD, Enum.Material.Wood)
	newPart(m, "Side", Vector3.new(0.5, 8, 4), c * CFrame.new(-2.5, 0, 0), WOOD, Enum.Material.Wood)
	newPart(m, "Side", Vector3.new(0.5, 8, 4), c * CFrame.new(2.5, 0, 0), WOOD, Enum.Material.Wood)
	newPart(m, "Top", Vector3.new(5.5, 0.5, 4.5), c * CFrame.new(0, 4.2, 0), WOOD, Enum.Material.Wood)
	local door = newPart(m, "ClosetDoor", Vector3.new(5, 8, 0.4), c * CFrame.new(0, 0, -2), Color3.fromRGB(120, 90, 60), Enum.Material.Wood)
	door.CanCollide = false
	door.Transparency = 0.15
	local cd = Instance.new("ClickDetector")
	cd.MaxActivationDistance = 12
	cd.Parent = door
	local inside = c * CFrame.new(0, -0.5, 0.2)
	local outside = c * CFrame.new(0, -0.5, -5)
	cd.MouseClick:Connect(function(player)
		if not inRun[player] or not player.Character then return end
		if hiding[player] == m then
			hiding[player] = nil
			player.Character:MoveTo(outside.Position)
		elseif not hiding[player] then
			for p, cl in pairs(hiding) do if cl == m then return end end
			hiding[player] = m
			player.Character:MoveTo(inside.Position)
		end
	end)
end

-- A drawer: one in a locked room hides the key.
local function drawer(room, info, x, z, hasKey)
	local d = newPart(room, "Drawer", Vector3.new(4, 3, 2.4), CFrame.new(x, 2.5, z), WOOD, Enum.Material.Wood)
	newPart(room, "Knob", Vector3.new(0.6, 0.6, 0.3), CFrame.new(x, 2.8, z - 1.3), Color3.fromRGB(200, 170, 80), Enum.Material.Metal)
	local cd = Instance.new("ClickDetector")
	cd.MaxActivationDistance = 12
	cd.Parent = d
	local searched = false
	cd.MouseClick:Connect(function(player)
		if searched then return end
		searched = true
		d.Color = DARK
		if hasKey and not info.keyFound then
			info.keyFound = true
			local key = newPart(room, "Key", Vector3.new(1.2, 0.3, 0.6), CFrame.new(x, 4.2, z), Color3.fromRGB(255, 205, 50), Enum.Material.Neon)
			Debris:AddItem(key, 2)
			say(player.Name .. " found the key! The door is unlocked.", 3)
			if info.padlock then info.padlock:Destroy() end
		end
	end)
end

local openDoor

local function makeRoom(n)
	local prev = roomList[n - 1]
	local z0 = prev and prev.z1 or 25
	local kind = "normal"
	if n >= 30 and n <= 35 then kind = "chase"
	elseif n % 7 == 0 and n > 3 then kind = "dark"
	elseif n % 5 == 0 and n > 3 then kind = "locked"
	elseif n % 9 == 4 then kind = "hall" end
	local len = kind == "hall" and 64 or (kind == "chase" and 48 or 38)
	local z1 = z0 - len
	local m = Instance.new("Model")
	m.Name = "Room" .. n
	m.Parent = rooms
	local mid = (z0 + z1) / 2
	local floorColor = kind == "dark" and Color3.fromRGB(45, 35, 30) or Color3.fromRGB(110, 80, 55)
	newPart(m, "Floor", Vector3.new(WIDTH, 1, len), CFrame.new(0, 0.5, mid), floorColor, Enum.Material.WoodPlanks)
	newPart(m, "Carpet", Vector3.new(8, 0.1, len), CFrame.new(0, 1.05, mid), Color3.fromRGB(110, 25, 30), Enum.Material.Fabric).CanCollide = false
	newPart(m, "Ceiling", Vector3.new(WIDTH, 1, len), CFrame.new(0, 14.5, mid), DARK, Enum.Material.Wood)
	newPart(m, "Wall", Vector3.new(1, 14, len), CFrame.new(-WIDTH / 2, 7.5, mid), WALL, Enum.Material.Brick)
	newPart(m, "Wall", Vector3.new(1, 14, len), CFrame.new(WIDTH / 2, 7.5, mid), WALL, Enum.Material.Brick)
	newPart(m, "EndWall", Vector3.new(WIDTH / 2 - 3, 14, 1), CFrame.new(-(WIDTH / 4 + 1.5), 7.5, z1), WALL, Enum.Material.Brick)
	newPart(m, "EndWall", Vector3.new(WIDTH / 2 - 3, 14, 1), CFrame.new(WIDTH / 4 + 1.5, 7.5, z1), WALL, Enum.Material.Brick)
	newPart(m, "EndWall", Vector3.new(6, 4, 1), CFrame.new(0, 12.5, z1), WALL, Enum.Material.Brick)
	local door = newPart(m, "Door", Vector3.new(6, 10, 0.6), CFrame.new(0, 6, z1), Color3.fromRGB(95, 60, 35), Enum.Material.Wood)
	local plate = Instance.new("BillboardText")
	plate.Text = string.format("%04d", n + 1)
	plate.StudsOffset = Vector3.new(0, 6.5, 0)
	plate.Parent = door
	local info = { model = m, z0 = z0, z1 = z1, door = door, lights = {}, kind = kind, locked = kind == "locked", keyFound = false }
	roomList[n] = info
	-- lights
	if kind ~= "dark" then
		for i = 1, math.max(1, math.floor(len / 22)) do
			local lz = z0 - i * len / (math.floor(len / 22) + 1)
			local l = newPart(m, "Lamp", Vector3.new(2.5, 0.4, 2.5), CFrame.new(0, 13.8, lz), Color3.fromRGB(255, 220, 160), Enum.Material.Neon)
			local light = Instance.new("PointLight")
			light.Range = 34
			light.Brightness = 1.6
			light.Color = Color3.fromRGB(255, 205, 150)
			light.Parent = l
			table.insert(info.lights, l)
		end
	end
	-- furniture
	if kind ~= "chase" then
		local closets = kind == "hall" and 4 or math.random(1, 3)
		for i = 1, closets do
			local side = (i % 2 == 0) and 1 or -1
			local cz = z0 - 6 - (i - 1) * (len - 12) / math.max(1, closets - 1)
			if closets == 1 then cz = mid end
			closet(m, side * (WIDTH / 2 - 2.6), cz, side * math.pi / 2)
		end
		local keyIndex = math.random(1, 3)
		for i = 1, (kind == "locked") and 3 or math.random(0, 2) do
			local side = (i % 2 == 0) and -1 or 1
			drawer(m, info, side * (WIDTH / 2 - 2.2), z0 - 4 - i * (len - 8) / 4, kind == "locked" and i == keyIndex)
		end
	else
		-- Seek's hallway: shelves to jump over, puddles to avoid.
		for i = 1, 3 do
			local oz = z0 - i * len / 4
			local x = (i % 2 == 0) and 6 or -6
			newPart(m, "FallenShelf", Vector3.new(16, 2.2, 1.6), CFrame.new(x, 2.1, oz), WOOD, Enum.Material.Wood)
			local lamp = newPart(m, "Lamp", Vector3.new(2, 0.4, 2), CFrame.new(0, 13.8, oz), Color3.fromRGB(255, 120, 100), Enum.Material.Neon)
			local light = Instance.new("PointLight")
			light.Range = 30
			light.Brightness = 1.2
			light.Color = Color3.fromRGB(255, 90, 80)
			light.Parent = lamp
		end
		local eye = newPart(m, "Eye", Vector3.new(1.5, 1.5, 0.2), CFrame.new(-WIDTH / 2 + 0.7, 7, mid) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(240, 240, 240), Enum.Material.Neon)
		eye.CanCollide = false
	end
	if info.locked then
		info.padlock = newPart(m, "Padlock", Vector3.new(1.4, 1.6, 0.6), CFrame.new(0, 6, z1 + 0.6), Color3.fromRGB(255, 205, 50), Enum.Material.Metal)
	end
	-- the trigger in front of the door
	local trig = newPart(m, "DoorTrigger", Vector3.new(8, 10, 6), CFrame.new(0, 6, z1 + 3), Color3.new(0, 0, 0))
	trig.Transparency = 1
	trig.CanCollide = false
	trig.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or not inRun[player] or not running then return end
		if info.locked and not info.keyFound then return end
		openDoor(n)
	end)
	return info
end

-- Lights flicker, then an entity flies through every open room. Hide!
local function rushPass(name, passes)
	entityActive = true
	local first = math.max(0, opened - 4)
	for n = first, opened do
		local info = roomList[n]
		if info then
			for _, l in ipairs(info.lights) do
				spawn(function()
					for i = 1, 8 do
						if not l.Parent then return end
						l.Transparency = (i % 2 == 0) and 0 or 0.9
						wait(0.18)
					end
				end)
			end
		end
	end
	say("The lights are flickering... HIDE!", 2.5)
	wait(3.2)
	local zStart = (roomList[first] and roomList[first].z0 or 25) + 20
	local zEnd = (roomList[opened] and roomList[opened].z1 or -40) - 10
	local e = newPart(workspace, name, Vector3.new(8, 8, 8), CFrame.new(0, 6, zStart), Color3.fromRGB(20, 20, 20), Enum.Material.Neon)
	e.CanCollide = false
	local face = Instance.new("BillboardText")
	face.Text = name == "Ambush" and "ಠ_ಠ" or "ʘ‿ʘ"
	face.StudsOffset = Vector3.new(0, 0, 0)
	face.Parent = e
	Instance.new("Smoke", e)
	for pass = 1, passes do
		local from, to = zStart, zEnd
		if pass % 2 == 0 then from, to = zEnd, zStart end
		e.Position = Vector3.new(0, 6, from)
		local dist = math.abs(to - from)
		local speed = name == "Ambush" and 140 or 95
		TweenService:Create(e, TweenInfo.new(dist / speed, Enum.EasingStyle.Linear), {Position = Vector3.new(0, 6, to)}):Play()
		local t0 = tick()
		while tick() - t0 < dist / speed do
			for _, p in ipairs(runners()) do
				local r = rootOf(p)
				if r and not hiding[p] and math.abs(r.Position.Z - e.Position.Z) < 7 then
					local h = p.Character:FindFirstChild("Humanoid")
					if h then h.Health = 0 end
					say(p.Name .. " was caught by " .. name .. "!", 2)
				end
			end
			wait(0.05)
		end
		if pass < passes then wait(1.5) end
	end
	e:Destroy()
	for _, p in ipairs(runners()) do
		BadgeService:AwardBadge(p.UserId, name == "Ambush" and "Survived Ambush" or "Survived Rush")
	end
	entityActive = false
end

-- Seek: run! He follows you through rooms 30 to 36.
local function seekChase()
	chase = true
	for n = 31, 36 do if not roomList[n] then makeRoom(n) end end
	for n = 30, 35 do
		local info = roomList[n]
		info.door.CanCollide = false
		info.door.Transparency = 1
	end
	opened = 36
	say("RUN!", 2)
	-- Seek appears a whole room behind you and waits 2 seconds: a fair head start.
	local start = (roomList[29] and roomList[29].z0 or roomList[30].z0 + 30) - 2
	local finishZ = roomList[35].z1 - 2
	local seek = newPart(workspace, "Seek", Vector3.new(4, 9, 2), CFrame.new(0, 5.5, start), Color3.fromRGB(10, 10, 10), Enum.Material.SmoothPlastic)
	seek.CanCollide = false
	local eye = Instance.new("BillboardText")
	eye.Text = "◉"
	eye.Parent = seek
	local speed = 15.2
	local z = start
	wait(2)
	while z > finishZ do
		z = z - speed * 0.1
		seek.Position = Vector3.new(0, 5.5, z)
		for _, p in ipairs(runners()) do
			local r = rootOf(p)
			if r and r.Position.Z > z - 1 then
				local h = p.Character:FindFirstChild("Humanoid")
				if h then h.Health = 0 end
				say("Seek caught " .. p.Name .. "!", 2)
			end
		end
		wait(0.1)
	end
	seek:Destroy()
	-- the door slams shut behind the survivors
	local back = roomList[35]
	back.door.CanCollide = true
	back.door.Transparency = 0
	for _, p in ipairs(runners()) do BadgeService:AwardBadge(p.UserId, "Escaped Seek") end
	chase = false
end

openDoor = function(n)
	if n ~= opened or entityActive or chase then return end
	local info = roomList[n]
	if not info then return end
	info.door.CanCollide = false
	TweenService:Create(info.door, TweenInfo.new(0.4), {Transparency = 1}):Play()
	opened = n + 1
	for _, p in ipairs(runners()) do
		if p.leaderstats["Best Door"].Value < opened then p.leaderstats["Best Door"].Value = opened end
		if opened == 25 then BadgeService:AwardBadge(p.UserId, "Door 25") end
	end
	if opened >= GOAL then
		for _, p in ipairs(runners()) do
			p.leaderstats.Escapes.Value = p.leaderstats.Escapes.Value + 1
			BadgeService:AwardBadge(p.UserId, "Escaped the Hotel")
		end
		say("You escaped the hotel!", 5)
		running = false
		return
	end
	makeRoom(opened)
	-- clean up rooms far behind
	local old = roomList[opened - 6]
	if old then old.model:Destroy() roomList[opened - 6] = nil end
	if opened == 30 then spawn(seekChase) return end
	-- entities get more likely the deeper you go
	if opened > 5 and not chase then
		local r = math.random()
		local chance = 0.12 + opened / 200
		if r < chance then
			spawn(function() rushPass(opened > 20 and math.random() < 0.4 and "Ambush" or "Rush", opened > 20 and 3 or 1) end)
		end
	end
	if info.kind == "dark" then
		say("It's dark in here... use your Flashlight (press 1).", 3)
	end
end

local function reset()
	rooms:ClearAllChildren()
	roomList = {}
	opened = 0
	entityActive = false
	chase = false
	hiding = {}
	workspace.Lobby.LobbyGate.CanCollide = true
	workspace.Lobby.LobbyGate.Transparency = 0
end

while true do
	reset()
	for i = 15, 1, -1 do
		hint.Text = "The elevator opens in " .. i .. "..."
		wait(1)
	end
	if #Players:GetPlayers() == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		for _, p in ipairs(Players:GetPlayers()) do
			inRun[p] = true
			p.RespawnLocation = lobbySpawn
			p:LoadCharacter()
		end
		makeRoom(0)
		workspace.Lobby.LobbyGate.CanCollide = false
		workspace.Lobby.LobbyGate.Transparency = 1
		running = true
		hint.Text = "Find Door " .. GOAL .. ". Good luck..."
		while running and #runners() > 0 do
			-- Someone already waiting at the door (key just found, chase just ended)? Open it.
			local info = roomList[opened]
			if info and not entityActive and not chase and (not info.locked or info.keyFound) then
				for _, p in ipairs(runners()) do
					local r = rootOf(p)
					if r and r.Position.Z < info.z1 + 7 and r.Position.Z > info.z1 - 1 and math.abs(r.Position.X) < 6 then openDoor(opened) break end
				end
			end
			local alive = #runners()
			hint.Text = "Door " .. string.format("%04d", opened) .. "  |  " .. alive .. " alive" .. (chase and "  |  RUN!" or "")
			wait(0.5)
		end
		if running then
			hint.Text = "Everyone died at Door " .. opened .. ". Try again!"
		else
			hint.Text = "Escaped at Door " .. GOAL .. "!"
		end
		running = false
		inRun = {}
		wait(5)
		for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
	end
end
`);
  return finish(g, { name: 'DOORS' });
}

// ================================================================ Kart Racing
function trackPoints() {
  // A rounded rectangle with an S-bend: list of [x, z] centre-line points.
  const pts = [];
  const R = 70, S = 220;
  for (let i = 0; i <= 20; i++) pts.push([-S / 2 + (S * i) / 20, -R]); // bottom straight (left -> right)
  for (let i = 1; i < 20; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 20; pts.push([S / 2 + Math.cos(a) * R, Math.sin(a) * R]); }
  for (let i = 0; i <= 20; i++) { const x = S / 2 - (S * i) / 20; pts.push([x, R + Math.sin((i / 20) * Math.PI * 2) * 18]); } // top S-bends
  for (let i = 1; i < 20; i++) { const a = Math.PI / 2 + (Math.PI * i) / 20; pts.push([-S / 2 + Math.cos(a) * R, Math.sin(a) * R]); }
  return pts;
}

export function gameKartRacing() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 14;
  baseplate(ws, { color: '#4b974b', size: [600, 20, 400], material: 'Grass', top: 'Smooth' });
  const track = model(ws, 'Track');
  const pts = trackPoints();
  const W = 30;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n];
    const len = Math.hypot(x2 - x1, z2 - z1) + 3;
    const yaw = Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    part(track, { name: 'Road', size: [W, 0.4, len], pos: [cx, 0.2, cz], rot: [0, yaw, 0], color: '#3a3a3c', material: 'Concrete', top: 'Smooth' });
    // barriers on both sides
    const nx = (z2 - z1) / len, nz = -(x2 - x1) / len;
    for (const side of [-1, 1]) {
      part(track, { name: 'Barrier', size: [1.2, 3, len], pos: [cx + nx * side * (W / 2 + 0.6), 1.5, cz + nz * side * (W / 2 + 0.6)], rot: [0, yaw, 0], color: i % 2 ? '#c4281c' : '#f8f8f8', material: 'SmoothPlastic' });
    }
  }
  // Checkpoints in order around the lap; #1 is the start/finish line.
  const cps = folder(ws, 'Checkpoints');
  const cpIdx = [2, 18, 30, 40, 52, 62, 70, 76];
  cpIdx.forEach((pi, k) => {
    const [x1, z1] = pts[pi], [x2, z2] = pts[(pi + 1) % n];
    const yaw = Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI;
    part(cps, { name: String(k + 1), size: [W + 4, 12, 2], pos: [x1, 6, z1], rot: [0, yaw, 0], color: '#ffffff', transparency: 1, canCollide: false });
  });
  const [fx, fz] = pts[2];
  part(ws, { name: 'FinishStripe', size: [2, 0.45, W], pos: [fx, 0.25, fz], color: '#f8f8f8', material: 'SmoothPlastic', canCollide: false });
  const banner = part(ws, { name: 'FinishBanner', size: [2, 2, W + 6], pos: [fx, 14, fz], color: '#1b1b1b', material: 'SmoothPlastic' });
  inst(banner, 'BillboardText', { Text: 'FINISH', StudsOffset: new Vector3(0, 3, 0) });
  for (const s of [-1, 1]) part(ws, { name: 'Pole', size: [1, 14, 1], pos: [fx, 7, fz + s * (W / 2 + 3)], color: '#a3a2a5', material: 'Metal' });
  // Jump ramp and boost strip on the long straight.
  part(ws, { cls: 'WedgePart', name: 'Ramp', size: [12, 2.2, 10], pos: [20, 1.3, -70], rot: [0, -90, 0], color: '#f5cd30', material: 'Metal' });
  // Grandstands and the pit area.
  part(ws, { name: 'Grandstand', size: [120, 8, 12], pos: [0, 4, -110], color: '#a3a2a5', material: 'Concrete' });
  part(ws, { name: 'Grandstand', size: [120, 4, 12], pos: [0, 10, -116], color: '#a3a2a5', material: 'Concrete' });
  // Lobby / pit spawn.
  const pit = model(ws, 'Pit');
  part(pit, { name: 'PitFloor', size: [60, 1, 30], pos: [-60, 0.5, -140], color: '#635f62', material: 'Concrete' });
  part(pit, { cls: 'SpawnLocation', name: 'PitSpawn', size: [10, 1, 10], pos: [-60, 1.5, -140], color: '#f5cd30', props: { Duration: 0 } });
  // Kart templates (8 grid slots).
  const karts = folder(g.ServerStorage, 'KartTemplates');
  for (let i = 0; i < 8; i++) {
    const row = Math.floor(i / 2), col = i % 2;
    const x = fx - 12 - row * 12, z = fz + (col ? 7 : -7);
    const k = model(karts, 'Kart');
    part(k, { name: 'Body', size: [6.4, 1, 4], pos: [x, 1, z], color: RAINBOW[i], material: 'SmoothPlastic' });
    part(k, { cls: 'VehicleSeat', name: 'Seat', size: [2, 1, 2], pos: [x, 2, z], rot: [0, -90, 0], color: RAINBOW[i], props: { MaxSpeed: 82, TurnSpeed: 2.4 } });
    for (const [dx, dz] of [[-2.2, -2.1], [2.2, -2.1], [-2.2, 2.1], [2.2, 2.1]]) part(k, { name: 'Wheel', size: [0.8, 1.6, 1.6], pos: [x + dx, 0.8, z + dz], color: '#1b1b1b', shape: 'Cylinder', rot: [0, 90, 0] });
  }
  folder(ws, 'Karts');
  script(g.ServerScriptService, 'Race', `
-- Kart Racing: 3 laps. Everyone is put in a kart at the start (late joiners
-- get one too). WASD to drive, Space to get out, walk into a kart to get back
-- in. Checkpoints must be passed in order.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local hint = Instance.new("Hint", workspace)
local LAPS = 3
local cps = workspace.Checkpoints
local NCP = #cps:GetChildren()
local racing = false
local progress = {}   -- player -> { lap, next, finished, lapStart, best }
local finishOrder = {}
local pitSpawn = workspace.Pit.PitSpawn

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local lap = Instance.new("StringValue")
	lap.Name = "Lap"
	lap.Value = "-"
	lap.Parent = ls
end)

local function say(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

-- Seats a player in a kart (moving them there and putting them in).
local function seatIn(p, kart)
	local ch = p.Character
	local hum = ch and ch:FindFirstChildOfClass("Humanoid")
	if not hum then return false end
	return kart.Seat:Sit(hum)
end

local function resetKarts()
	workspace.Karts:ClearAllChildren()
	for _, k in ipairs(game:GetService("ServerStorage").KartTemplates:GetChildren()) do
		k:Clone().Parent = workspace.Karts
	end
end

for _, cp in ipairs(cps:GetChildren()) do
	local idx = tonumber(cp.Name)
	cp.Touched:Connect(function(hit)
		if not racing then return end
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		local pr = player and progress[player]
		if not pr or pr.finished or pr.next ~= idx then return end
		if idx == 1 then
			if pr.started then
				local lapTime = tick() - pr.lapStart
				if not pr.best or lapTime < pr.best then pr.best = lapTime end
				if lapTime < 40 then BadgeService:AwardBadge(player.UserId, "Speed Demon") end
				pr.lap = pr.lap + 1
				if pr.lap > LAPS then
					pr.finished = true
					table.insert(finishOrder, player)
					local place = #finishOrder
					player.leaderstats.Lap.Value = "#" .. place
					BadgeService:AwardBadge(player.UserId, "Racer")
					if place == 1 then
						player.leaderstats.Wins.Value = player.leaderstats.Wins.Value + 1
						BadgeService:AwardBadge(player.UserId, "Kart Champion")
					end
					say(player.Name .. " finished #" .. place .. "!", 3)
					return
				end
				player:Notify("Lap " .. pr.lap .. "/" .. LAPS .. " - lap time " .. string.format("%.1f", lapTime) .. "s")
			end
			pr.started = true
			pr.lapStart = tick()
		end
		pr.next = idx % NCP + 1
		player.leaderstats.Lap.Value = pr.lap .. "/" .. LAPS
	end)
end

-- Joined (or respawned) while a race is on: take a free kart from the grid
-- (or a fresh one) and go. Your lap and checkpoint progress is kept.
local templates = game:GetService("ServerStorage").KartTemplates:GetChildren()
local owned = {}   -- kart -> player
local spare = 0
local function lateJoin(p)
	if not racing then return end
	local pr = progress[p]
	if pr and pr.finished then return end
	if not pr then
		progress[p] = { lap = 1, next = 1, finished = false }
		p.leaderstats.Lap.Value = "1/" .. LAPS
	end
	local kart
	for _, k in ipairs(workspace.Karts:GetChildren()) do
		if not owned[k] then kart = k break end
	end
	if not kart then
		spare = spare % #templates + 1
		kart = templates[spare]:Clone()
		kart:TranslateBy(Vector3.new(-50, 0, 0)) -- behind the grid
		kart.Parent = workspace.Karts
	end
	owned[kart] = p
	if seatIn(p, kart) then
		p:Notify(pr and "Here's a new kart - keep racing!" or "The race is on - you got a kart, go go go!")
	end
end
Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(function()
		wait(1)
		if p.Parent then lateJoin(p) end
	end)
end)

while true do
	racing = false
	resetKarts()
	for i = 12, 1, -1 do
		hint.Text = "Next race in " .. i .. "  -  get ready!"
		wait(1)
	end
	local players = Players:GetPlayers()
	if #players == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		progress = {}
		finishOrder = {}
		owned = {}
		local karts = workspace.Karts:GetChildren()
		for i, p in ipairs(players) do
			if i <= #karts then
				progress[p] = { lap = 1, next = 1, finished = false }
				p.leaderstats.Lap.Value = "1/" .. LAPS
				p.RespawnLocation = pitSpawn
				p:LoadCharacter()
				owned[karts[i]] = p
				seatIn(p, karts[i])
			end
		end
		for i = 3, 1, -1 do
			hint.Text = "Starting in " .. i .. "..."
			wait(1)
		end
		racing = true
		hint.Text = "GO!"
		local t0 = tick()
		local firstDone = nil
		while true do
			local left = 0
			for p, pr in pairs(progress) do if p.Parent and not pr.finished then left = left + 1 end end
			if left == 0 then break end
			if #finishOrder > 0 and not firstDone then firstDone = tick() end
			if firstDone and tick() - firstDone > 25 then break end
			if tick() - t0 > 300 then break end
			local status = "Race  " .. math.floor(tick() - t0) .. "s"
			if firstDone then status = status .. "  |  Finish in " .. math.ceil(25 - (tick() - firstDone)) .. "s!" end
			hint.Text = status
			wait(0.5)
		end
		racing = false
		local names = {}
		for i, p in ipairs(finishOrder) do table.insert(names, i .. ". " .. p.Name) end
		hint.Text = #names > 0 and ("Results:  " .. table.concat(names, "   ")) or "Nobody finished!"
		wait(6)
		for _, p in ipairs(Players:GetPlayers()) do
			p.leaderstats.Lap.Value = "-"
			p:LoadCharacter()
		end
	end
end
`);
  return finish(g, { name: 'Robis Kart Racing' });
}

// ================================================================ Brick Battle (team shooter)
export function gameBrickBattle() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 16;
  baseplate(ws, { color: '#635f62', size: [260, 20, 260] });
  const RED = '#c4281c', BLUE = '#0d69ac';
  inst(g.GetService('Teams'), 'Team', { Name: 'Red', TeamColor: Color3.fromHex(RED), AutoAssignable: true });
  inst(g.GetService('Teams'), 'Team', { Name: 'Blue', TeamColor: Color3.fromHex(BLUE), AutoAssignable: true });
  for (const [z, c] of [[-105, RED], [105, BLUE]]) {
    const base = model(ws, c === RED ? 'RedBase' : 'BlueBase');
    part(base, { name: 'BaseFloor', size: [60, 2, 30], pos: [0, 1, z], color: c, material: 'Concrete' });
    for (const x of [-15, 15]) {
      part(base, { cls: 'SpawnLocation', name: 'Spawn', size: [10, 1, 10], pos: [x, 2.5, z + (z < 0 ? -6 : 6)], color: c, props: { Neutral: false, TeamColor: Color3.fromHex(c), Duration: 3 } });
    }
    part(base, { name: 'Wall', size: [60, 8, 2], pos: [0, 6, z + (z < 0 ? 14 : -14)], color: c, material: 'Brick' });
    part(base, { name: 'Wall Gap', size: [8, 8, 2], pos: [0, 6, z + (z < 0 ? 14 : -14)], color: c, transparency: 1, canCollide: false });
  }
  // Cover: crates, walls and a central tower with trusses.
  const cover = model(ws, 'Cover');
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 26; i++) {
    const x = Math.round((rng() - 0.5) * 200), z = Math.round((rng() - 0.5) * 150);
    if (Math.abs(x) < 16 && Math.abs(z) < 16) continue;
    const h = 4 + Math.round(rng() * 6);
    part(cover, { name: 'Crate', size: [6, h, 6], pos: [x, h / 2, z], color: rng() < 0.5 ? '#a0703c' : '#7c5c46', material: 'WoodPlanks' });
  }
  for (const [x, z] of [[-60, 0], [60, 0], [0, -50], [0, 50]]) part(cover, { name: 'Barrier', size: z ? [30, 6, 2] : [2, 6, 30], pos: [x, 3, z], color: '#a3a2a5', material: 'Concrete' });
  const tower = model(ws, 'Tower');
  part(tower, { name: 'TowerBase', size: [24, 1, 24], pos: [0, 12.5, 0], color: '#a3a2a5', material: 'Concrete' });
  for (const [dx, dz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) part(tower, { name: 'Leg', size: [2, 12, 2], pos: [dx, 6, dz], color: '#635f62', material: 'Metal' });
  part(tower, { cls: 'TrussPart', name: 'Ladder', size: [2, 13, 2], pos: [0, 6.5, -13], color: '#f5cd30', material: 'Metal' });
  part(tower, { cls: 'TrussPart', name: 'Ladder', size: [2, 13, 2], pos: [0, 6.5, 13], color: '#f5cd30', material: 'Metal' });
  for (const [x, z, sx, sz] of [[0, -11.5, 24, 1], [0, 11.5, 24, 1]]) part(tower, { name: 'Rail', size: [sx, 3, sz], pos: [x, 14.5, z], color: '#635f62', material: 'Metal' });
  // Health packs.
  const packs = folder(ws, 'HealthPacks');
  for (const [x, z] of [[-90, 0], [90, 0], [0, -30], [0, 30]]) {
    part(packs, { name: 'HealthPack', size: [2.5, 2.5, 2.5], pos: [x, 1.5, z], color: '#4b974b', material: 'Neon', canCollide: false });
  }
  const sp = g.GetService('StarterPack');
  const blaster = tool(sp, 'Blaster', 'gun', '#2a2a2a', { tip: 'Click to shoot (20 damage, 40 to the head)' });
  script(blaster, 'BlasterScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not target then return end
	local char = tool.Parent
	local head = char and char:FindFirstChild("Head")
	local player = Players:GetPlayerFromCharacter(char)
	if not head or not player then return end
	cooldown = true
	delay(0.22, function() cooldown = false end)
	local origin = head.Position
	local dir = (target - origin).Unit * 400
	local r = workspace:Raycast(origin, dir, char)
	local hitPos = r and r.Position or (origin + dir)
	-- a short-lived laser beam
	local len = (hitPos - origin).Magnitude
	local beam = Instance.new("Part")
	beam.Name = "Laser"
	beam.Anchored = true
	beam.CanCollide = false
	beam.Material = Enum.Material.Neon
	beam.Color = player.TeamColor and player.Team and player.Team.TeamColor or Color3.fromRGB(255, 255, 0)
	beam.Size = Vector3.new(0.2, 0.2, len)
	beam.CFrame = CFrame.new((origin + hitPos) / 2, hitPos)
	beam.Parent = workspace
	Debris:AddItem(beam, 0.08)
	if not r then return end
	local victimChar = r.Instance.Parent
	local hum = victimChar and victimChar:FindFirstChild("Humanoid")
	local victim = Players:GetPlayerFromCharacter(victimChar)
	if hum and hum.Health > 0 and (not victim or victim.Team ~= player.Team) then
		local dmg = r.Instance.Name == "Head" and 40 or 20
		hum:TakeDamage(dmg)
		if hum.Health <= 0 then shared.creditKill(player, victim) end
	end
end)
`);
  const rocket = tool(sp, 'Rocket Launcher', 'rocket', '#4b974b', { tip: 'Slow, but explodes! (3 second reload)' });
  script(rocket, 'RocketScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not target then return end
	local char = tool.Parent
	local head = char and char:FindFirstChild("Head")
	local player = Players:GetPlayerFromCharacter(char)
	if not head or not player then return end
	cooldown = true
	delay(3, function() cooldown = false end)
	local origin = head.Position + (target - head.Position).Unit * 3
	local r = workspace:Raycast(origin, (target - origin).Unit * 300, char)
	local stop = r and r.Position or target
	local dist = (stop - origin).Magnitude
	local rk = Instance.new("Part")
	rk.Name = "Rocket"
	rk.Size = Vector3.new(1, 1, 3)
	rk.CFrame = CFrame.new(origin, stop)
	rk.Anchored = true
	rk.CanCollide = false
	rk.Color = Color3.fromRGB(75, 151, 75)
	rk.Parent = workspace
	Instance.new("Fire", rk)
	TweenService:Create(rk, TweenInfo.new(dist / 90, Enum.EasingStyle.Linear), {Position = stop}):Play()
	wait(dist / 90)
	rk:Destroy()
	local before = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if h then before[p] = h.Health end
	end
	local e = Instance.new("Explosion")
	e.Position = stop
	e.BlastRadius = 9
	e.DestroyJointRadiusPercent = 0
	e.Parent = workspace
	for _, p in ipairs(Players:GetPlayers()) do
		local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if root and h and h.Health > 0 and p.Team ~= player.Team and (root.Position - stop).Magnitude < 10 then
			h:TakeDamage(70)
			if h.Health <= 0 then shared.creditKill(player, p) end
		end
	end
end)
`);
  const sword = tool(sp, 'Sword', 'sword', '#a3a2a5', { tip: 'Up close: 35 damage' });
  script(sword, 'SwordScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown then return end
	local char = tool.Parent
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local player = Players:GetPlayerFromCharacter(char)
	if not root or not player then return end
	cooldown = true
	delay(0.5, function() cooldown = false end)
	for _, p in ipairs(Players:GetPlayers()) do
		local r2 = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if p ~= player and r2 and h and h.Health > 0 and p.Team ~= player.Team and (r2.Position - root.Position).Magnitude < 7 then
			h:TakeDamage(35)
			if h.Health <= 0 then shared.creditKill(player, p) end
		end
	end
end)
`);
  script(g.ServerScriptService, 'Match', `
-- Brick Battle: Red vs Blue team deathmatch. First team to 30 KOs, or the
-- team ahead after 5 minutes, wins the match.
local Players = game:GetService("Players")
local Teams = game:GetService("Teams")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local hint = Instance.new("Hint", workspace)
local GOAL = 30
local score = { Red = 0, Blue = 0 }
local streak = {}
local playing = true

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local ko = Instance.new("IntValue")
	ko.Name = "KOs"
	ko.Parent = ls
	local wo = Instance.new("IntValue")
	wo.Name = "WOs"
	wo.Parent = ls
	player.CharacterAdded:Connect(function(char)
		local hum = char:FindFirstChild("Humanoid")
		if hum then hum.Died:Connect(function()
			wo.Value = wo.Value + 1
			streak[player] = 0
		end) end
	end)
end)

local function say(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

-- Called by the weapons when they knock someone out.
shared.creditKill = function(killer, victim)
	if not playing or not killer or not killer.Parent then return end
	killer.leaderstats.KOs.Value = killer.leaderstats.KOs.Value + 1
	streak[killer] = (streak[killer] or 0) + 1
	local team = killer.Team and killer.Team.Name
	if team and score[team] then score[team] = score[team] + 1 end
	BadgeService:AwardBadge(killer.UserId, "First Blood")
	if killer.leaderstats.KOs.Value >= 25 then BadgeService:AwardBadge(killer.UserId, "Warrior") end
	if streak[killer] == 5 then
		say(killer.Name .. " is on a 5 KO streak!", 2)
		BadgeService:AwardBadge(killer.UserId, "Unstoppable")
	end
end

-- Health packs respawn 15 seconds after being used.
for _, pack in ipairs(workspace.HealthPacks:GetChildren()) do
	local ready = true
	pack.Touched:Connect(function(hit)
		if not ready then return end
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h and h.Health > 0 and h.Health < h.MaxHealth then
			ready = false
			h.Health = math.min(h.MaxHealth, h.Health + 50)
			pack.Transparency = 0.9
			delay(15, function() ready = true pack.Transparency = 0 end)
		end
	end)
end

while true do
	score = { Red = 0, Blue = 0 }
	playing = true
	for _, p in ipairs(Players:GetPlayers()) do
		p.leaderstats.KOs.Value = 0
		p.leaderstats.WOs.Value = 0
		p:LoadCharacter()
	end
	say("Fight! First team to " .. GOAL .. " KOs wins.", 3)
	local t0 = tick()
	while tick() - t0 < 300 and score.Red < GOAL and score.Blue < GOAL do
		local left = 300 - math.floor(tick() - t0)
		hint.Text = string.format("RED %d  -  %d BLUE     %d:%02d", score.Red, score.Blue, math.floor(left / 60), left % 60)
		wait(0.5)
	end
	playing = false
	local winner = score.Red > score.Blue and "Red" or (score.Blue > score.Red and "Blue" or nil)
	if winner then
		say(winner .. " team wins the match!", 5)
		for _, p in ipairs(Players:GetPlayers()) do
			if p.Team and p.Team.Name == winner then BadgeService:AwardBadge(p.UserId, "Match Winner") end
		end
	else
		say("It's a draw!", 5)
	end
	hint.Text = string.format("Final: RED %d  -  %d BLUE", score.Red, score.Blue)
	wait(8)
end
`);
  return finish(g, { name: 'Brick Battle' });
}

// ================================================================ Speed Draw
const WORDS = [
  ['cat', 'кот'], ['dog', 'собака'], ['house', 'дом'], ['tree', 'дерево'], ['sun', 'солнце'], ['car', 'машина'], ['fish', 'рыба'],
  ['apple', 'яблоко'], ['pizza', 'пицца'], ['rocket', 'ракета'], ['flower', 'цветок'], ['star', 'звезда'], ['heart', 'сердце'],
  ['moon', 'луна'], ['cloud', 'облако'], ['robot', 'робот'], ['crown', 'корона'], ['ghost', 'призрак'], ['snake', 'змея'],
  ['boat', 'лодка'], ['train', 'поезд'], ['banana', 'банан'], ['cake', 'торт'], ['clock', 'часы'], ['key', 'ключ'],
  ['sword', 'меч'], ['hat', 'шляпа'], ['shoe', 'ботинок'], ['phone', 'телефон'], ['guitar', 'гитара'], ['bird', 'птица'],
  ['rainbow', 'радуга'], ['mountain', 'гора'], ['volcano', 'вулкан'], ['snowman', 'снеговик'], ['pencil', 'карандаш'],
  ['eye', 'глаз'], ['bread', 'хлеб'], ['ice cream', 'мороженое'], ['spider', 'паук'], ['castle', 'замок'], ['umbrella', 'зонт'],
];

export function gameSpeedDraw() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13;
  baseplate(ws, { color: '#e8e2d0', size: [200, 20, 200], material: 'Wood', top: 'Smooth' });
  spawn(ws, [0, 0.5, 30], { color: '#f8f8f8' });
  // The canvas: 36 x 22 tiles on a wall.
  const COLS = 36, ROWS = 22, T = 1.5;
  const canvas = model(ws, 'Canvas');
  const x0 = -(COLS * T) / 2 + T / 2, y0 = 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      part(canvas, { name: `${c},${r}`, size: [T, T, 0.4], pos: [x0 + c * T, y0 + r * T, -20], color: '#ffffff', material: 'SmoothPlastic' });
    }
  }
  part(ws, { name: 'Frame', size: [COLS * T + 3, ROWS * T + 3, 0.8], pos: [0, y0 + (ROWS * T) / 2 - T / 2, -20.7], color: '#7c5c46', material: 'Wood' });
  // Paint pots: touch one to pick that colour (white = eraser).
  const palette = folder(ws, 'Palette');
  const COLORS = ['#1b1b1b', '#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc', '#7c5c46', '#ffffff'];
  COLORS.forEach((c, i) => part(palette, { name: 'Paint', size: [5, 1, 5], pos: [-27 + i * 6, 0.5, -8], color: c, material: c === '#ffffff' ? 'SmoothPlastic' : 'Neon' }));
  const clear = part(ws, { name: 'ClearButton', size: [6, 2, 2], pos: [35, 2, -18], color: '#c4281c', material: 'SmoothPlastic' });
  inst(clear, 'ClickDetector', { MaxActivationDistance: 30 });
  inst(clear, 'BillboardText', { Text: 'CLEAR', StudsOffset: new Vector3(0, 2.5, 0) });
  const bench = model(ws, 'Benches');
  for (let i = 0; i < 4; i++) part(bench, { cls: 'Seat', name: 'Bench', size: [16, 1, 3], pos: [-24 + i * 16, 1, 14], color: '#a0703c', material: 'Wood' });
  const brush = tool(g.ServerStorage, 'Brush', 'brush', '#1b1b1b', { tip: 'Hold the mouse on the canvas to paint', auto: true });
  script(brush, 'BrushScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local canvas = workspace.Canvas
local COLS, ROWS, T = ${COLS}, ${ROWS}, ${T}
local X0, Y0, Z = ${x0}, ${y0}, -20
local last, lastTime = nil, 0
local function tileAt(pos)
	if math.abs(pos.Z - Z) > 2 then return nil end
	local c = math.floor((pos.X - X0) / T + 0.5)
	local r = math.floor((pos.Y - Y0) / T + 0.5)
	if c < 0 or c >= COLS or r < 0 or r >= ROWS then return nil end
	return c, r
end
local function paint(c, r)
	local t = canvas:FindFirstChild(c .. "," .. r)
	if t then t.Color = tool.Color end
end
tool.Activated:Connect(function(target)
	if not target then return end
	local player = Players:GetPlayerFromCharacter(tool.Parent)
	if not player or not shared.canPaint or not shared.canPaint(player) then return end
	local c, r = tileAt(target)
	if not c then last = nil return end
	-- join the dots, so fast strokes stay smooth lines
	if last and tick() - lastTime < 0.35 then
		local dc, dr = c - last[1], r - last[2]
		local n = math.max(math.abs(dc), math.abs(dr))
		for i = 1, n do paint(math.floor(last[1] + dc * i / n + 0.5), math.floor(last[2] + dr * i / n + 0.5)) end
	end
	paint(c, r)
	last = { c, r }
	lastTime = tick()
end)
`);
  script(g.ServerScriptService, 'Game', `
-- Speed Draw: one player draws a secret word, everyone else guesses in chat.
-- Guess fast for more points! With fewer than 2 players it's free drawing.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local hint = Instance.new("Hint", workspace)
local brushTemplate = game:GetService("ServerStorage").Brush
local WORDS = { ${WORDS.map(([e, r]) => `{"${e}", "${r}"}`).join(', ')} }
local drawer = nil
local word = nil
local guessed = {}
local turnStart = 0
local TURN = 75

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local pts = Instance.new("IntValue")
	pts.Name = "Points"
	pts.Parent = ls
	player.CharacterAdded:Connect(function()
		wait(0.2)
		if drawer == nil or drawer == player then
			local bp = player:FindFirstChild("Backpack")
			if bp and not bp:FindFirstChild("Brush") then brushTemplate:Clone().Parent = bp end
		end
	end)
	player.Chatted:Connect(function(msg)
		if not word or player == drawer or guessed[player] then return end
		local m = string.lower(msg)
		if m == word[1] or m == word[2] then
			guessed[player] = true
			local bonus = math.max(1, math.floor((TURN - (tick() - turnStart)) / 10))
			player.leaderstats.Points.Value = player.leaderstats.Points.Value + 2 + bonus
			if drawer and drawer.Parent then drawer.leaderstats.Points.Value = drawer.leaderstats.Points.Value + 1 end
			BadgeService:AwardBadge(player.UserId, "Good Guess")
			if player.leaderstats.Points.Value >= 50 then BadgeService:AwardBadge(player.UserId, "Art Critic") end
			local m2 = Instance.new("Message")
			m2.Text = player.Name .. " guessed the word!"
			m2.Parent = workspace
			Debris:AddItem(m2, 2)
		end
	end)
end)

-- Who may paint right now (used by the Brush).
shared.canPaint = function(p) return drawer == nil or p == drawer end

-- Paint pots set your brush colour.
for _, pot in ipairs(workspace.Palette:GetChildren()) do
	pot.Touched:Connect(function(hit)
		local char = hit.Parent
		local player = Players:GetPlayerFromCharacter(char)
		if not player then return end
		for _, holder in ipairs({ char, player:FindFirstChild("Backpack") }) do
			if holder then
				local b = holder:FindFirstChild("Brush")
				if b then b.Color = pot.Color end
			end
		end
	end)
end

local function clearCanvas()
	for _, t in ipairs(workspace.Canvas:GetChildren()) do t.Color = Color3.new(1, 1, 1) end
end
workspace.ClearButton.ClickDetector.MouseClick:Connect(function(player)
	if drawer == nil or player == drawer then clearCanvas() end
end)

local function setBrushes(owner)
	for _, p in ipairs(Players:GetPlayers()) do
		local should = owner == nil or p == owner
		for _, holder in ipairs({ p.Character, p:FindFirstChild("Backpack") }) do
			if holder then
				local b = holder:FindFirstChild("Brush")
				if b and not should then b:Destroy() end
			end
		end
		local has = (p.Character and p.Character:FindFirstChild("Brush")) or (p:FindFirstChild("Backpack") and p.Backpack:FindFirstChild("Brush"))
		if should and not has and p:FindFirstChild("Backpack") then brushTemplate:Clone().Parent = p.Backpack end
	end
end

local order = 0
while true do
	local players = Players:GetPlayers()
	if #players < 2 then
		drawer = nil
		word = nil
		setBrushes(nil)
		hint.Text = "Free drawing! Speed Draw starts when 2 players are here.  (Brush: press 1, paint pots change colour)"
		wait(3)
	else
		order = order % #players + 1
		drawer = players[order]
		word = WORDS[math.random(1, #WORDS)]
		guessed = {}
		clearCanvas()
		setBrushes(drawer)
		drawer:Notify("Your word is: " .. string.upper(word[1]) .. " (" .. word[2] .. "). Draw it! Press 1 for the brush.")
		turnStart = tick()
		local blanks = string.gsub(word[1], "%a", "_ ")
		while tick() - turnStart < TURN and drawer.Parent do
			local count, total = 0, 0
			for _, p in ipairs(Players:GetPlayers()) do
				if p ~= drawer then total = total + 1 if guessed[p] then count = count + 1 end end
			end
			if total > 0 and count == total then break end
			local left = TURN - math.floor(tick() - turnStart)
			hint.Text = drawer.Name .. " is drawing:  " .. blanks .. "  (" .. #word[1] .. " letters)   " .. left .. "s   |   Type your guess in the chat!"
			wait(0.5)
		end
		hint.Text = "The word was: " .. string.upper(word[1]) .. " (" .. word[2] .. ")"
		word = nil
		wait(4)
	end
end
`);
  return finish(g, { name: 'Speed Draw' });
}

export const NEW_GAMES = [
  { key: 'doors', name: 'DOORS', build: gameDoors, genre: 'Horror', featured: true, maxPlayers: 4,
    visits: 102340, up: 3120, down: 210, favorites: 8800,
    description: 'Walk through the haunted hotel door by door. Hide in closets when the lights flicker, find keys for locked doors and run from Seek. Can you reach Door 50?' },
  { key: 'kart', name: 'Robis Kart Racing', build: gameKartRacing, genre: 'Sports', featured: true, maxPlayers: 8,
    visits: 61240, up: 1700, down: 120, favorites: 4100,
    description: 'Jump in a go-kart and race 3 laps! Drive with WASD, take the jump ramp, pass every checkpoint and beat your best lap.' },
  { key: 'brickbattle', name: 'Brick Battle', build: gameBrickBattle, genre: 'FPS', featured: true, maxPlayers: 16,
    visits: 84200, up: 2300, down: 260, favorites: 5600,
    description: 'Red vs Blue team battle with blasters, rocket launchers and swords. First team to 30 KOs wins! Headshots do double damage.' },
  { key: 'speeddraw', name: 'Speed Draw', build: gameSpeedDraw, genre: 'Comedy', featured: false, maxPlayers: 10,
    visits: 27400, up: 980, down: 60, favorites: 1900,
    description: 'One player draws a secret word, everyone else guesses in the chat. Guess fast for more points! Free drawing when you are alone.' },
];
