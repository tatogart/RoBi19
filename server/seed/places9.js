// Piggy (2020 style): one player is Piggy, everyone else is trapped in the
// house. Find the red key and the blue key, carry them to the locks on the
// front door (one item at a time!) and escape before Piggy gets you.
import { Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

// A wall from (x1, z1) to (x2, z2) along X or Z, with door gaps (6 wide).
function wall(parent, x1, z1, x2, z2, h, color, doors = []) {
  const alongX = z1 === z2;
  const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const start = alongX ? Math.min(x1, x2) : Math.min(z1, z2);
  let at = 0;
  const segs = [];
  for (const d of [...doors].sort((a, b) => a - b)) { if (d - 3 > at) segs.push([at, d - 3]); at = d + 3; }
  if (len > at) segs.push([at, len]);
  for (const [a, b] of segs) {
    const mid = start + (a + b) / 2, l = b - a;
    part(parent, { name: 'Wall', size: alongX ? [l, h, 1] : [1, h, l], pos: alongX ? [mid, h / 2 + 1, z1] : [x1, h / 2 + 1, mid], color, material: 'Plastic' });
  }
  for (const d of doors) {
    const mid = start + d;
    part(parent, { name: 'Wall', size: alongX ? [6, h - 8, 1] : [1, h - 8, 6], pos: alongX ? [mid, 9 + (h - 8) / 2, z1] : [x1, 9 + (h - 8) / 2, mid], color, material: 'Plastic' });
  }
}

export function gamePiggy() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 20.5;
  g.Lighting.Ambient = Color3.fromRGB(95, 90, 110);
  part(ws, { name: 'Void', size: [1000, 2, 1000], pos: [0, -60, 0], color: '#1b1b1b' });

  // ---------------------------------------------------------------- lobby
  const lobby = model(ws, 'Lobby');
  const LY = 200;
  part(lobby, { name: 'Floor', size: [50, 1, 40], pos: [0, LY + 0.5, 0], color: '#ff9ccf', material: 'SmoothPlastic' });
  for (const [x, z, sx, sz] of [[0, -20, 50, 1], [0, 20, 50, 1], [-25, 0, 1, 40], [25, 0, 1, 40]]) part(lobby, { name: 'Wall', size: [sx, 14, sz], pos: [x, LY + 7.5, z], color: '#ffe0ef' });
  part(lobby, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [10, 1, 10], pos: [0, LY + 1.1, 4], color: '#ff5fa2', props: { Duration: 0 } });
  const sign = part(lobby, { name: 'Sign', size: [22, 6, 0.5], pos: [0, LY + 9, -19.5], color: '#2a1b22' });
  inst(sign, 'BillboardText', { Text: 'PIGGY: THE HOUSE' });
  const how = part(lobby, { name: 'HowTo', size: [1, 1, 1], pos: [0, LY + 5.5, -19], transparency: 1, canCollide: false });
  inst(how, 'BillboardText', { Text: 'Find the red key and the blue key, open the locks on the front door and escape. Don\'t let Piggy catch you!', TextSize: 15 });

  // ---------------------------------------------------------------- the house
  const h = model(ws, 'House');
  const HX = 0, HZ = 0, W = 110, D = 80, H = 14;
  const x0 = HX - W / 2, x1 = HX + W / 2, z0 = HZ - D / 2, z1 = HZ + D / 2;
  part(h, { name: 'Floor', size: [W, 1, D], pos: [HX, 0.5, HZ], color: '#7c5c46', material: 'WoodPlanks' });
  part(h, { name: 'Ceiling', size: [W, 1, D], pos: [HX, H + 1.5, HZ], color: '#d9d2c0' });
  part(h, { name: 'Grass', size: [220, 1, 200], pos: [HX, 0, HZ], color: '#2f5a2a', material: 'Grass' });
  // outer walls; the front door (z0, middle) is the way out
  wall(h, x0, z1, x1, z1, H, '#c9b8a3');
  wall(h, x0, z0, x1, z0, H, '#c9b8a3', [W / 2]);
  wall(h, x0, z0, x0, z1, H, '#c9b8a3');
  wall(h, x1, z0, x1, z1, H, '#c9b8a3');
  // rooms: a hall in the middle, kitchen, living room, bedroom, bathroom, garage
  wall(h, x0, HZ, HX - 15, HZ, H, '#b8a48d', [18]);
  wall(h, HX + 15, HZ, x1, HZ, H, '#b8a48d', [22]);
  wall(h, HX - 15, z0, HX - 15, z1, H, '#b8a48d', [12, 58]);
  wall(h, HX + 15, z0, HX + 15, z1, H, '#b8a48d', [14, 62]);
  wall(h, HX + 15, HZ + 20, x1, HZ + 20, H, '#b8a48d', [20]);
  // furniture to hide behind
  part(h, { name: 'KitchenCounter', size: [3, 4, 26], pos: [x0 + 2, 3, z0 + 16], color: '#e8e8e8', material: 'Marble' });
  part(h, { name: 'Fridge', size: [5, 10, 4], pos: [x0 + 4, 6, z0 + 34], color: '#f2f2f2', material: 'Metal' });
  part(h, { name: 'Table', size: [10, 1, 6], pos: [x0 + 20, 4, z0 + 20], color: '#5a3b1e', material: 'Wood' });
  for (const [dx, dz] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) part(h, { name: 'TableLeg', size: [1, 3, 1], pos: [x0 + 20 + dx, 2, z0 + 20 + dz], color: '#5a3b1e', material: 'Wood' });
  part(h, { name: 'Couch', size: [14, 3, 5], pos: [x0 + 20, 2.5, z1 - 8], color: '#7a2a3a', material: 'Fabric' });
  part(h, { name: 'CouchBack', size: [14, 4, 1.5], pos: [x0 + 20, 4, z1 - 5], color: '#7a2a3a', material: 'Fabric' });
  part(h, { name: 'TV', size: [10, 6, 1], pos: [x0 + 20, 5, z1 - 32], color: '#111111' });
  part(h, { name: 'Bed', size: [10, 3, 14], pos: [x1 - 10, 2.5, z1 - 10], color: '#d9d9f0', material: 'Fabric' });
  part(h, { name: 'Wardrobe', size: [8, 11, 3], pos: [x1 - 30, 6.5, z1 - 3], color: '#4a2f1a', material: 'Wood' });
  part(h, { name: 'Bathtub', size: [12, 3, 6], pos: [x1 - 10, 2.5, HZ + 4], color: '#ffffff', material: 'Marble' });
  part(h, { name: 'Car', size: [9, 5, 16], pos: [x1 - 20, 3.5, z0 + 16], color: '#c4281c', material: 'Metal' });
  part(h, { name: 'Boxes', size: [5, 5, 5], pos: [x1 - 6, 3.5, z0 + 6], color: '#c4a484' });
  part(h, { name: 'Boxes', size: [4, 4, 4], pos: [x1 - 6, 8, z0 + 6], color: '#b8956a' });
  part(h, { name: 'Clock', size: [3, 10, 2], pos: [HX, 6, z1 - 2], color: '#5a3b1e', material: 'Wood' });
  for (const [x, z] of [[HX, HZ - 20], [HX, HZ + 20], [x0 + 22, z0 + 20], [x0 + 22, z1 - 20], [x1 - 22, z0 + 20], [x1 - 22, z1 - 10], [x1 - 22, HZ + 10]]) {
    const l = part(h, { name: 'Lamp', size: [2, 0.4, 2], pos: [x, H + 0.8, z], color: '#ffe0a0', material: 'Neon', canCollide: false });
    inst(l, 'PointLight', { Range: 24, Brightness: 1, Color: Color3.fromHex('#ffd9a0') });
  }
  // the front door with two locks, and the way out
  const door = model(h, 'FrontDoor');
  part(door, { name: 'ExitDoor', size: [6, 8, 0.6], pos: [HX, 5, z0], color: '#5a3b1e', material: 'Wood' });
  part(door, { name: 'RedLock', size: [1.6, 1.6, 0.8], pos: [HX - 1.5, 5, z0 - 0.5], color: '#e8243c', material: 'Neon' });
  part(door, { name: 'BlueLock', size: [1.6, 1.6, 0.8], pos: [HX + 1.5, 5, z0 - 0.5], color: '#2d7de0', material: 'Neon' });
  part(door, { name: 'RedLock', size: [1.6, 1.6, 0.8], pos: [HX - 1.5, 5, z0 + 0.5], color: '#e8243c', material: 'Neon' });
  part(door, { name: 'BlueLock', size: [1.6, 1.6, 0.8], pos: [HX + 1.5, 5, z0 + 0.5], color: '#2d7de0', material: 'Neon' });
  part(h, { name: 'Escape', size: [16, 1, 10], pos: [HX, 1.1, z0 - 12], color: '#3ddc84', material: 'Neon', transparency: 0.4, canCollide: false });
  // where the items can be, and where people start
  const spots = folder(h, 'ItemSpots');
  for (const [x, z] of [[x0 + 4, z0 + 26], [x0 + 20, z0 + 20], [x0 + 6, z1 - 6], [x0 + 30, z1 - 20], [x1 - 6, z1 - 6], [x1 - 30, z1 - 8], [x1 - 6, HZ + 8], [x1 - 30, HZ + 14], [x1 - 6, z0 + 26], [x1 - 34, z0 + 6], [HX, HZ + 30], [HX - 8, HZ - 30]]) {
    part(spots, { name: 'Spot', size: [1, 1, 1], pos: [x, 2, z], transparency: 1, canCollide: false });
  }
  const starts = folder(h, 'Starts');
  for (const [x, z] of [[HX - 6, HZ], [HX + 6, HZ], [HX, HZ + 10], [HX, HZ - 10], [x0 + 20, z1 - 14], [x1 - 20, z1 - 14], [x0 + 22, HZ - 10], [x1 - 22, HZ - 10]]) {
    part(starts, { name: 'Start', size: [2, 1, 2], pos: [x, 2, z], transparency: 1, canCollide: false });
  }
  part(h, { name: 'PiggyStart', size: [2, 1, 2], pos: [x1 - 20, 2, z0 + 30], transparency: 1, canCollide: false });

  // ---------------------------------------------------------------- the game
  script(g.ServerScriptService, 'Piggy', `
-- Piggy. Intermission, then one player is Piggy (pink, with a bat) and waits
-- 15 seconds while everyone else runs. Survivors carry ONE item at a time:
-- the red key opens the red lock, the blue key the blue lock. Both open: the
-- front door opens - step on the green exit to escape. Piggy catches whoever
-- it touches. 4 minutes.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local store = game:GetService("DataStoreService"):GetDataStore("PiggyHouse")
local hint = Instance.new("Hint", workspace)
local house = workspace.House
local ROUND, HEAD_START = 240, 15
local piggy = nil
local survivors = {}
local escaped = 0
local running = false
local locks = {}
local items = Instance.new("Folder")
items.Name = "Items"
items.Parent = workspace

local function msg(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end

local function value(p, name)
	local v = p:FindFirstChild(name)
	if not v then
		v = Instance.new("StringValue")
		v.Name = name
		v.Parent = p
	end
	return v
end

local function rootOf(p) return p.Character and p.Character:FindFirstChild("HumanoidRootPart") end
local function moveTo(p, pos)
	local r = rootOf(p)
	if r then r.CFrame = CFrame.new(pos + Vector3.new(0, 3, 0)) end
end
local function toLobby(p) moveTo(p, workspace.Lobby.LobbySpawn.Position) end

local function saveStats(p)
	local ls = p:FindFirstChild("leaderstats")
	if ls then pcall(function() store:SetAsync("u" .. p.UserId, { coins = ls.Coins.Value, escapes = ls.Escapes.Value }) end) end
end

local function count()
	local n = 0
	for p in pairs(survivors) do if p.Parent then n = n + 1 end end
	return n
end

local COLORS = { ["Red Key"] = Color3.fromRGB(232, 36, 60), ["Blue Key"] = Color3.fromRGB(45, 125, 224) }

local function randomSpot()
	local s = house.ItemSpots:GetChildren()
	return s[math.random(1, #s)].Position
end

-- an item lying somewhere in the house
local function spawnItem(name, pos)
	local k = Instance.new("Part")
	k.Name = name == "Red Key" and "RedKey" or "BlueKey"
	k.Size = Vector3.new(1.4, 0.4, 2.4)
	k.Anchored = true
	k.CanCollide = false
	k.Material = Enum.Material.Neon
	k.Color = COLORS[name]
	k.Position = pos
	k.Parent = items
	local t = Instance.new("BillboardText")
	t.Text = name
	t.TextSize = 13
	t.Parent = k
	k.Touched:Connect(function(hit)
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if not p or not survivors[p] or not k.Parent then return end
		local c = value(p, "Carrying")
		if c.Value ~= "" then p:Notify("You can only carry one item. Drop it at its lock first!") return end
		k:Destroy()
		c.Value = name
		p:ShowMessage("You picked up the " .. name .. "!", 2, COLORS[name])
	end)
end

local function openDoor()
	local d = house.FrontDoor.ExitDoor
	d.CanCollide = false
	d.Transparency = 0.8
	msg("The front door is open! RUN!", 4)
end

-- a lock on the door: bring the right key
local function setupLock(lock, name)
	lock.Touched:Connect(function(hit)
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if not p or not survivors[p] or locks[name] then return end
		local c = value(p, "Carrying")
		if c.Value ~= name then return end
		c.Value = ""
		locks[name] = true
		for _, l in ipairs(house.FrontDoor:GetChildren()) do
			if l.Name == lock.Name then l.Transparency = 1; l.CanCollide = false end
		end
		msg(p.Name .. " used the " .. name .. "!", 3)
		p.leaderstats.Coins.Value = p.leaderstats.Coins.Value + 5
		if locks["Red Key"] and locks["Blue Key"] then openDoor() end
	end)
end
for _, l in ipairs(house.FrontDoor:GetChildren()) do
	if l.Name == "RedLock" then setupLock(l, "Red Key") end
	if l.Name == "BlueLock" then setupLock(l, "Blue Key") end
end

house.Escape.Touched:Connect(function(hit)
	local p = Players:GetPlayerFromCharacter(hit.Parent)
	if not p or not survivors[p] or not running then return end
	survivors[p] = nil
	escaped = escaped + 1
	value(p, "Role").Value = "Escaped"
	p.leaderstats.Escapes.Value = p.leaderstats.Escapes.Value + 1
	p.leaderstats.Coins.Value = p.leaderstats.Coins.Value + 20
	p:ShowMessage("YOU ESCAPED!", 4, Color3.fromRGB(61, 220, 132))
	msg(p.Name .. " escaped!", 3)
	toLobby(p)
	if count() == 0 then running = false end
end)

local function caught(p, how)
	if not survivors[p] then return end
	survivors[p] = nil
	value(p, "Role").Value = "Caught"
	local c = value(p, "Carrying")
	if c.Value ~= "" then spawnItem(c.Value, randomSpot()); c.Value = "" end
	p:ShowMessage(how or "Piggy got you!", 3, Color3.fromRGB(255, 90, 140))
	msg(p.Name .. (how and " is out!" or " was caught!"), 2)
	if piggy and piggy.Parent and not how then piggy.leaderstats.Coins.Value = piggy.leaderstats.Coins.Value + 5 end
	toLobby(p)
	if count() == 0 then running = false end
end

Players.PlayerAdded:Connect(function(p)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = p
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = ls
	local esc = Instance.new("IntValue")
	esc.Name = "Escapes"
	esc.Parent = ls
	local ok, saved = pcall(function() return store:GetAsync("u" .. p.UserId) end)
	if ok and type(saved) == "table" then coins.Value = saved.coins or 0; esc.Value = saved.escapes or 0 end
	value(p, "Role").Value = "Lobby"
	value(p, "Carrying").Value = ""
	p.CharacterAdded:Connect(function(char)
		local h = char:WaitForChild("Humanoid")
		h.Died:Connect(function() if survivors[p] then caught(p, "You fell!") end end)
	end)
	if running then p:Notify("A round is on - you'll play in the next one.") end
end)
Players.PlayerRemoving:Connect(function(p)
	saveStats(p)
	survivors[p] = nil
	if p == piggy then running = false; piggy = nil end
	if count() == 0 then running = false end
end)

-- Piggy: pink, a bat and a name tag
local function makePiggy(p)
	local char = p.Character
	if not char then return end
	for _, part in ipairs(char:GetChildren()) do
		if part:IsA("BasePart") then part.Color = Color3.fromRGB(255, 160, 190) end
	end
	local head = char:FindFirstChild("Head")
	if head then
		local t = Instance.new("BillboardText")
		t.Name = "PiggyTag"
		t.Text = "PIGGY"
		t.TextSize = 20
		t.Parent = head
	end
end

local function shuffle(t)
	for i = #t, 2, -1 do local j = math.random(1, i); t[i], t[j] = t[j], t[i] end
	return t
end

while true do
	local players = Players:GetPlayers()
	if #players < 2 then
		hint.Text = "Waiting for players... (Piggy needs at least 2)"
		wait(2)
	else
		for i = 15, 1, -1 do
			hint.Text = "Intermission: " .. i
			wait(1)
		end
		players = shuffle(Players:GetPlayers())
		if #players >= 2 then
			items:ClearAllChildren()
			locks = {}
			escaped = 0
			for _, l in ipairs(house.FrontDoor:GetChildren()) do l.Transparency = 0; l.CanCollide = true end
			survivors = {}
			piggy = players[1]
			local starts = shuffle(house.Starts:GetChildren())
			for i, p in ipairs(players) do
				value(p, "Carrying").Value = ""
				if p == piggy then
					value(p, "Role").Value = "Piggy"
					makePiggy(p)
					p:ShowMessage("You are PIGGY! Catch everyone!", 4, Color3.fromRGB(255, 120, 170))
				else
					value(p, "Role").Value = "Survivor"
					survivors[p] = true
					moveTo(p, starts[((i - 2) % #starts) + 1].Position)
					p:ShowMessage("Find the keys and escape! " .. piggy.Name .. " is Piggy!", 4, Color3.fromRGB(255, 255, 255))
				end
			end
			-- the keys, in two different places
			local spots = shuffle(house.ItemSpots:GetChildren())
			spawnItem("Red Key", spots[1].Position)
			spawnItem("Blue Key", spots[2].Position)
			running = true
			for t = HEAD_START, 1, -1 do
				if not running then break end
				hint.Text = "Run and hide! Piggy comes in " .. t
				wait(1)
			end
			if piggy and piggy.Parent and running then
				moveTo(piggy, house.PiggyStart.Position)
				local h = piggy.Character and piggy.Character:FindFirstChild("Humanoid")
				if h then h.WalkSpeed = 17 end
				msg("Piggy is coming...", 3)
			end
			local t = ROUND
			while running and t > 0 do
				local keys = (locks["Red Key"] and 1 or 0) + (locks["Blue Key"] and 1 or 0)
				hint.Text = "The House   |   " .. count() .. " left   |   locks " .. keys .. "/2   |   " .. math.floor(t / 60) .. ":" .. string.format("%02d", t % 60)
				for _ = 1, 4 do
					local pr = rootOf(piggy)
					if not pr then running = false; break end
					for p in pairs(survivors) do
						local r = rootOf(p)
						if r and (r.Position - pr.Position).Magnitude < 5 then caught(p) end
					end
					if not running then break end
					wait(0.25)
				end
				t = t - 1
			end
			running = false
			if escaped > 0 then
				msg(escaped .. " escaped! The survivors win!", 5)
			else
				msg("Piggy got everyone!", 5)
				if piggy and piggy.Parent then
					piggy.leaderstats.Coins.Value = piggy.leaderstats.Coins.Value + 15
					piggy.leaderstats.Escapes.Value = piggy.leaderstats.Escapes.Value
				end
			end
			hint.Text = "Round over"
			wait(5)
			survivors, piggy = {}, nil
			items:ClearAllChildren()
			for _, p in ipairs(Players:GetPlayers()) do
				value(p, "Role").Value = "Lobby"
				value(p, "Carrying").Value = ""
				saveStats(p)
				p:LoadCharacter()
			end
		end
	end
end
`);
  return finish(g, { name: 'Piggy: The House' });
}

export const PIGGY_GAMES = [
  { key: 'piggy', name: 'Piggy: The House', build: gamePiggy, genre: 'Horror', featured: true, maxPlayers: 10,
    visits: 76120, up: 2710, down: 190, favorites: 5300,
    description: 'Piggy is coming! Find the red key and the blue key, carry them to the locks on the front door (one item at a time) and escape the house. One player is Piggy - don\'t get caught!' },
];
