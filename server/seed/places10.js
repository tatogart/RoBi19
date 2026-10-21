// More 2019-2020 classics: Sword Fight on the Heights, Mining Simulator,
// The Robis Elevator and Cops and Robbers.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, spawn, tree, finish, thumbCam } from './builder.js';

function tool(parent, name, toolModel, color, tip = '') {
  return inst(parent, 'Tool', { Name: name, ToolModel: toolModel, Color: Color3.fromHex(color), ToolTip: tip });
}

// Lua helpers most of these games use.
const HELPERS = `
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local function root(p)
	local c = p.Character
	return c and c:FindFirstChild("HumanoidRootPart")
end
local function alive(p)
	local h = p.Character and p.Character:FindFirstChild("Humanoid")
	return h and h.Health > 0
end
local function announce(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 3)
end
local function moveTo(p, pos)
	local r = root(p)
	if r then r.CFrame = CFrame.new(pos) end
end
local function stat(p, name, add)
	local ls = p:FindFirstChild("leaderstats")
	local v = ls and ls:FindFirstChild(name)
	if v and add then v.Value = v.Value + add end
	return v
end
`;

// ================================================================ Sword Fight on the Heights
export function gameSwordHeights() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 15;
  g.Lighting.OutdoorAmbient = Color3.fromRGB(140, 150, 170);
  // the clouds far below: falling is a wipeout
  part(ws, { name: 'Clouds', size: [800, 2, 800], pos: [0, -40, 0], color: '#f2f6ff', material: 'SmoothPlastic', transparency: 0.15 });
  const map = model(ws, 'Heights');
  const peaks = [[0, 60, 0, 22], [-70, 34, -40, 18], [70, 40, -30, 18], [-60, 46, 60, 16], [60, 28, 64, 20], [0, 22, -90, 18], [-110, 18, 20, 14], [110, 52, 26, 14]];
  peaks.forEach(([x, y, z, s], i) => {
    // a rocky pillar with a flat grassy top
    part(map, { name: 'Pillar', size: [s - 4, y + 40, s - 4], pos: [x, (y - 40) / 2, z], color: '#6b6763', material: 'Slate' });
    part(map, { name: 'Top', size: [s, 2, s], pos: [x, y, z], color: i === 0 ? '#e8c84a' : '#4b974b', material: i === 0 ? 'Marble' : 'Grass' });
  });
  // narrow bridges between the peaks
  const bridge = (a, b) => {
    const [x1, y1, z1] = peaks[a], [x2, y2, z2] = peaks[b];
    const steps = 10;
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      part(map, { name: 'Bridge', size: [5, 1, 5], pos: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 1, z1 + (z2 - z1) * t], color: '#8a6a45', material: 'WoodPlanks' });
    }
  };
  for (const [a, b] of [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6], [2, 7], [3, 6], [4, 7]]) bridge(a, b);
  const sign = part(map, { name: 'Summit', size: [1, 1, 1], pos: [0, 70, 0], transparency: 1, canCollide: false });
  inst(sign, 'BillboardText', { Text: '⚔ THE SUMMIT ⚔' });
  for (const [x, y, z] of [[-70, 35.5, -40], [70, 41.5, -30], [-60, 47.5, 60], [60, 29.5, 64]]) spawn(ws, [x, y, z], { size: [8, 1, 8], color: '#a3a2a5' });
  thumbCam(ws, [120, 110, 150], [0, 30, 0]);
  const sp = g.GetService('StarterPack');
  const sword = tool(sp, 'Linked Sword', 'sword', '#b4b4b4', 'Click to slash, it knocks people back');
  script(sword, 'SwordScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function()
	if cooldown then return end
	local char = tool.Parent
	local me = char and char:FindFirstChild("HumanoidRootPart")
	local player = Players:GetPlayerFromCharacter(char)
	if not me or not player then return end
	cooldown = true
	delay(0.45, function() cooldown = false end)
	for _, p in ipairs(Players:GetPlayers()) do
		local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		local h = p.Character and p.Character:FindFirstChild("Humanoid")
		if p ~= player and r and h and h.Health > 0 and (r.Position - me.Position).Magnitude < 8 then
			h:TakeDamage(20)
			shared.lastHit[p.UserId] = { by = player, t = tick() }
			-- a knock back: maybe right off the edge
			local away = r.Position - me.Position
			away = Vector3.new(away.X, 0, away.Z)
			if away.Magnitude > 0.1 then r.Velocity = away.Unit * 45 + Vector3.new(0, 28, 0) end
			if h.Health <= 0 then shared.ko(player, p) end
		end
	end
end)
`);
  script(g.ServerScriptService, 'Heights', `
-- Sword Fight on the Heights: everyone has the linked sword. KOs count,
-- knocking someone off the heights counts too (the last hit in 5 seconds).
${HELPERS}
shared.lastHit = {}
local streak = {}
shared.ko = function(killer, victim)
	if not killer or killer == victim or killer.Parent ~= Players then return end
	stat(killer, "KOs", 1)
	streak[killer.UserId] = (streak[killer.UserId] or 0) + 1
	local s = streak[killer.UserId]
	if s == 3 then announce(killer.Name .. " is on a KILLING SPREE!", 3)
	elseif s == 5 then announce(killer.Name .. " is UNSTOPPABLE!", 3)
	elseif s == 8 then announce(killer.Name .. " is GODLIKE!", 3) end
end

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local ko = Instance.new("IntValue")
	ko.Name = "KOs"
	ko.Parent = ls
	local wo = Instance.new("IntValue")
	wo.Name = "Wipeouts"
	wo.Parent = ls
	player.CharacterAdded:Connect(function(char)
		local h = char:WaitForChild("Humanoid")
		h.Died:Connect(function()
			stat(player, "Wipeouts", 1)
			streak[player.UserId] = 0
		end)
	end)
end)

-- falling into the clouds: a wipeout, and a KO for whoever hit you last
workspace.Clouds.Touched:Connect(function(hit)
	local h = hit.Parent and hit.Parent:FindFirstChild("Humanoid")
	if not h or h.Health <= 0 then return end
	local victim = Players:GetPlayerFromCharacter(hit.Parent)
	h.Health = 0
	local last = victim and shared.lastHit[victim.UserId]
	if last and tick() - last.t < 5 then shared.ko(last.by, victim) end
end)

-- the summit: who is standing on top
local hint = Instance.new("Hint", workspace)
while true do
	wait(3)
	local kings = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local r = root(p)
		if r and alive(p) and math.abs(r.Position.X) < 11 and math.abs(r.Position.Z) < 11 and r.Position.Y > 60 and r.Position.Y < 70 then
			table.insert(kings, p.Name)
		end
	end
	hint.Text = #kings > 0 and ("On the summit: " .. table.concat(kings, ", ")) or "Sword Fight on the Heights - knock them off!"
end
`);
  return finish(g, { name: 'Sword Fight on the Heights' });
}

// ================================================================ Mining Simulator
export function gameMining() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13;
  part(ws, { name: 'Ground', size: [220, 2, 120], pos: [0, -1, -60], color: '#5f8f3e', material: 'Grass' });
  part(ws, { name: 'Ground', size: [80, 2, 100], pos: [-80, -1, 50], color: '#5f8f3e', material: 'Grass' });
  part(ws, { name: 'Ground', size: [80, 2, 100], pos: [80, -1, 50], color: '#5f8f3e', material: 'Grass' });
  spawn(ws, [0, 0.5, -40], { color: '#f5cd30' });
  for (const [x, z] of [[-90, -90], [-60, -100], [80, -95], [100, -70], [-95, 70], [95, 80]]) tree(ws, x, z);
  // the shop: sell pad and two upgrade buttons
  const shop = model(ws, 'Shop');
  part(shop, { name: 'Stand', size: [30, 1, 14], pos: [-40, 0.5, -40], color: '#7c5c46', material: 'WoodPlanks' });
  const sell = part(shop, { name: 'SellPad', size: [10, 0.6, 10], pos: [40, 0.3, -40], color: '#ffc400', material: 'Neon' });
  inst(sell, 'BillboardText', { Text: '💰 SELL ORE', StudsOffset: new Vector3(0, 4, 0) });
  const bag = part(shop, { name: 'BackpackButton', size: [6, 6, 2], pos: [-48, 4, -46], color: '#0d69ac' });
  inst(bag, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(bag, 'BillboardText', { Text: '🎒 Bigger Backpack', StudsOffset: new Vector3(0, 4.5, 0) });
  const pick = part(shop, { name: 'PickaxeButton', size: [6, 6, 2], pos: [-32, 4, -46], color: '#c4281c' });
  inst(pick, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(pick, 'BillboardText', { Text: '⛏ Better Pickaxe', StudsOffset: new Vector3(0, 4.5, 0) });
  // the mine: a pit of blocks; deeper = rarer ore
  const mine = folder(ws, 'Mine');
  const S = 5, N = 8, LAYERS = 6;
  for (let l = 0; l < LAYERS; l++) {
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < N; k++) {
        const b = part(mine, { name: 'Block', size: [S, S, S], pos: [(i - N / 2 + 0.5) * S, -S / 2 - l * S, 20 + (k + 0.5) * S], color: '#7f7f7f', material: 'Slate' });
        inst(b, 'IntValue', { Name: 'Layer', Value: l });
      }
    }
  }
  // the walls of the pit and a ladder out
  const W = N * S;
  for (const [x, z, sx, sz] of [[-W / 2 - 1, 20 + W / 2, 2, W], [W / 2 + 1, 20 + W / 2, 2, W], [0, 20 + W + 1, W + 4, 2]]) {
    part(ws, { name: 'PitWall', size: [sx, LAYERS * S + 2, sz], pos: [x, -LAYERS * S / 2, z], color: '#4a3d33', material: 'Slate' });
  }
  part(ws, { name: 'PitFloor', size: [W + 4, 2, W + 2], pos: [0, -LAYERS * S - 1, 20 + W / 2], color: '#2b2420', material: 'Slate' });
  part(ws, { cls: 'TrussPart', name: 'Ladder', size: [2, LAYERS * S + 2, 2], pos: [0, -LAYERS * S / 2 + 1, 19], color: '#a3a2a5' });
  const sign = part(ws, { name: 'MineSign', size: [16, 5, 1], pos: [0, 6, 16], color: '#3a2a1a', material: 'Wood' });
  inst(sign, 'BillboardText', { Text: '⛏ THE MINE ⛏' });
  thumbCam(ws, [70, 50, -70], [0, -6, 30]);
  const pickaxe = tool(g.GetService('StarterPack'), 'Pickaxe', 'hammer', '#7a5230', 'Click a block in the mine');
  script(g.ServerScriptService, 'Mining', `
-- Mining Simulator: mine blocks with the pickaxe, fill your backpack, sell
-- the ore at the gold pad, buy a bigger backpack and a better pickaxe.
-- Deeper layers have rarer ore. The mine refills every 3 minutes.
${HELPERS}
local store = game:GetService("DataStoreService"):GetDataStore("MiningSim")
local mine = workspace.Mine
local ORES = {
	{ name = "Stone", value = 1, hits = 1, color = Color3.fromRGB(127, 127, 127), mat = Enum.Material.Slate },
	{ name = "Coal", value = 3, hits = 2, color = Color3.fromRGB(40, 40, 40), mat = Enum.Material.Slate },
	{ name = "Iron", value = 7, hits = 3, color = Color3.fromRGB(205, 160, 120), mat = Enum.Material.Metal },
	{ name = "Gold", value = 15, hits = 4, color = Color3.fromRGB(255, 200, 40), mat = Enum.Material.Metal },
	{ name = "Ruby", value = 32, hits = 6, color = Color3.fromRGB(220, 30, 60), mat = Enum.Material.Neon },
	{ name = "Diamond", value = 70, hits = 8, color = Color3.fromRGB(90, 230, 255), mat = Enum.Material.Neon },
}
local BAGS = { 20, 50, 120, 300, 800 }
local BAG_COST = { 0, 60, 300, 1200, 5000 }
local PICKS = { 1, 2, 3, 5, 8 }
local PICK_COST = { 0, 100, 450, 1800, 7000 }
local oreOf, hitsLeft = {}, {}

local function fill()
	for _, b in ipairs(mine:GetChildren()) do
		local l = b.Layer.Value
		-- the best ore a layer can have is its depth + 1; rarer ones less often
		local best = math.min(#ORES, l + 2)
		local CHANCE = { 0.1, 0.22, 0.32, 0.4, 0.45 }
		local i = 1
		for k = best, 2, -1 do
			if math.random() < CHANCE[best - k + 1] then i = k break end
		end
		local o = ORES[i]
		oreOf[b] = o
		hitsLeft[b] = o.hits
		b.Color = o.color
		b.Material = o.mat
		b.Transparency = 0
		b.CanCollide = true
	end
end
fill()

local function data(p)
	return p:FindFirstChild("MineData")
end
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = ls
	local ore = Instance.new("IntValue")
	ore.Name = "Ore"
	ore.Parent = ls
	local d = Instance.new("Folder")
	d.Name = "MineData"
	d.Parent = player
	local bag = Instance.new("IntValue")
	bag.Name = "Bag"
	bag.Value = 1
	bag.Parent = d
	local pick = Instance.new("IntValue")
	pick.Name = "Pick"
	pick.Value = 1
	pick.Parent = d
	local worth = Instance.new("IntValue")
	worth.Name = "Worth"
	worth.Parent = d
	local ok, saved = pcall(function() return store:GetAsync("u" .. player.UserId) end)
	if ok and type(saved) == "table" then
		coins.Value = saved.coins or 0
		bag.Value = math.max(1, math.min(#BAGS, saved.bag or 1))
		pick.Value = math.max(1, math.min(#PICKS, saved.pick or 1))
	end
end)
Players.PlayerRemoving:Connect(function(player)
	local d = data(player)
	if not d then return end
	pcall(function()
		store:SetAsync("u" .. player.UserId, { coins = player.leaderstats.Coins.Value, bag = d.Bag.Value, pick = d.Pick.Value })
	end)
end)

-- the pickaxe: the block next to where you clicked, close to you
shared.mine = function(player, target)
	local r = root(player)
	local d = data(player)
	if not r or not d or not target then return end
	local best, bestD = nil, 4.5
	for _, b in ipairs(mine:GetChildren()) do
		if b.CanCollide then
			local dist = (b.Position - target).Magnitude
			if dist < bestD and (b.Position - r.Position).Magnitude < 16 then best, bestD = b, dist end
		end
	end
	if not best then return end
	local ls = player.leaderstats
	if ls.Ore.Value >= BAGS[d.Bag.Value] then
		announce("Your backpack is full! Sell your ore at the gold pad.", 2)
		return
	end
	hitsLeft[best] = hitsLeft[best] - PICKS[d.Pick.Value]
	if hitsLeft[best] > 0 then
		best.Transparency = 0.35
		return
	end
	local o = oreOf[best]
	best.Transparency = 1
	best.CanCollide = false
	ls.Ore.Value = ls.Ore.Value + 1
	d.Worth.Value = d.Worth.Value + o.value
	if o.value >= 32 then announce(player.Name .. " found " .. o.name .. "!", 2) end
end

workspace.Shop.SellPad.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	local d = player and data(player)
	if not d or d.Worth.Value <= 0 then return end
	player.leaderstats.Coins.Value = player.leaderstats.Coins.Value + d.Worth.Value
	d.Worth.Value = 0
	player.leaderstats.Ore.Value = 0
end)

local function buy(player, what)
	local d = data(player)
	if not d then return end
	local coins = player.leaderstats.Coins
	local level = d[what].Value
	local costs = what == "Bag" and BAG_COST or PICK_COST
	if level >= #costs then announce("You already have the best one!", 2) return end
	local cost = costs[level + 1]
	if coins.Value < cost then announce("You need " .. cost .. " coins.", 2) return end
	coins.Value = coins.Value - cost
	d[what].Value = level + 1
	if what == "Bag" then announce("Backpack: " .. BAGS[level + 1] .. " ore!", 2)
	else announce("Pickaxe power: " .. PICKS[level + 1] .. "!", 2) end
end
workspace.Shop.BackpackButton.ClickDetector.MouseClick:Connect(function(p) buy(p, "Bag") end)
workspace.Shop.PickaxeButton.ClickDetector.MouseClick:Connect(function(p) buy(p, "Pick") end)

local hint = Instance.new("Hint", workspace)
while true do
	for i = 180, 1, -1 do
		hint.Text = "The mine refills in " .. i .. " s  |  Sell ore at the gold pad, upgrades at the shop"
		wait(1)
	end
	announce("The mine refills! Watch out below.", 3)
	fill()
end
`);
  script(pickaxe, 'PickaxeScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not shared.mine then return end
	local player = Players:GetPlayerFromCharacter(tool.Parent)
	if not player then return end
	cooldown = true
	delay(0.3, function() cooldown = false end)
	shared.mine(player, target)
end)
`);
  return finish(g, { name: 'Mining Simulator' });
}

// ================================================================ The Robis Elevator
export function gameElevator() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 14;
  part(ws, { name: 'Void', size: [2000, 2, 2000], pos: [0, -80, 0], transparency: 1, canCollide: false });
  // the lobby and the elevator
  const lobby = model(ws, 'Lobby');
  part(lobby, { name: 'Floor', size: [60, 1, 60], pos: [0, 0.5, 0], color: '#d8cfc0', material: 'Marble' });
  for (const [x, z, sx, sz] of [[0, -30, 60, 1], [0, 30, 60, 1], [-30, 0, 1, 60], [30, 0, 1, 60]]) part(lobby, { name: 'Wall', size: [sx, 16, sz], pos: [x, 8.5, z], color: '#8a7b6a' });
  spawn(ws, [0, 1.1, 18], { size: [10, 1, 10] });
  const el = model(ws, 'Elevator');
  part(el, { name: 'ElevatorFloor', size: [16, 1, 16], pos: [0, 1.2, -18], color: '#5b5b5f', material: 'DiamondPlate' });
  for (const [x, z, sx, sz] of [[0, -26.5, 16, 1], [-8.5, -18, 1, 16], [8.5, -18, 1, 16]]) part(el, { name: 'ElevatorWall', size: [sx, 14, sz], pos: [x, 8.5, z], color: '#b4b4b4', material: 'Metal' });
  part(el, { name: 'ElevatorRoof', size: [18, 1, 18], pos: [0, 15.5, -18], color: '#9a9a9a', material: 'Metal' });
  const door = part(el, { name: 'Door', size: [16, 14, 1], pos: [0, 8.5, -9.5], color: '#c8c8c8', material: 'Metal', transparency: 0.6, canCollide: false });
  inst(door, 'BillboardText', { Text: '🛗 THE ELEVATOR', StudsOffset: new Vector3(0, 9, 0) });
  // the floors, far away from each other
  const floors = folder(ws, 'Floors');
  const FLOORS = [
    ['Lava', '#3a1a10'], ['Moon', '#2a2a40'], ['Disco', '#1b1b1b'], ['Noob', '#5f8f3e'],
    ['Bricks', '#6b6b6b'], ['Shrink', '#0d69ac'], ['Candy', '#ff9ccf'], ['Spinner', '#da8541'],
  ];
  FLOORS.forEach(([name, color], i) => {
    const cx = 300 + (i % 4) * 140, cz = Math.floor(i / 4) * 140;
    const f = model(floors, name);
    if (name !== 'Shrink') part(f, { name: 'Floor', size: [70, 1, 70], pos: [cx, 0.5, cz], color, material: name === 'Moon' ? 'Slate' : 'SmoothPlastic' });
    for (const [x, z, sx, sz] of [[cx, cz - 35, 70, 1], [cx, cz + 35, 70, 1], [cx - 35, cz, 1, 70], [cx + 35, cz, 1, 70]]) part(f, { name: 'Wall', size: [sx, 20, sz], pos: [x, 10.5, z], color: '#3b3b3b', transparency: name === 'Moon' ? 0.5 : 0 });
    part(f, { name: 'Start', size: [1, 1, 1], pos: [cx, 4, cz + 25], transparency: 1, canCollide: false });
    const label = part(f, { name: 'Label', size: [1, 1, 1], pos: [cx, 16, cz - 30], transparency: 1, canCollide: false });
    inst(label, 'BillboardText', { Text: `FLOOR: ${name.toUpperCase()}` });
    if (name === 'Lava') {
      part(f, { name: 'Lava', size: [60, 1, 46], pos: [cx, 1.2, cz - 8], color: '#ff4b00', material: 'Neon' });
      for (const [dx, dz] of [[-20, -20], [0, -12], [18, -22], [-10, 4], [12, 6]]) part(f, { name: 'Safe', size: [8, 3, 8], pos: [cx + dx, 2.5, cz + dz], color: '#5b5b5f', material: 'Slate' });
    }
    if (name === 'Disco') {
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) part(f, { name: 'Tile', size: [12, 0.4, 12], pos: [cx - 26 + a * 13, 1.2, cz - 26 + b * 13], color: '#ff00aa', material: 'Neon' });
    }
    if (name === 'Noob') part(f, { name: 'GiantNoob', size: [10, 18, 6], pos: [cx, 10, cz - 25], color: '#f5cd30', material: 'SmoothPlastic', canCollide: false });
    if (name === 'Shrink') {
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) part(f, { name: 'Tile', size: [10, 1, 10], pos: [cx - 30 + a * 10, 0.5, cz - 30 + b * 10], color: (a + b) % 2 ? '#0d69ac' : '#5aa8e0' });
    }
    if (name === 'Candy') {
      for (const [dx, dz, c] of [[-20, -10, '#ff5fa2'], [15, -15, '#7bdcff'], [0, 5, '#fff07a'], [20, 15, '#b07bff']]) {
        part(f, { name: 'Lollipop', size: [1, 10, 1], pos: [cx + dx, 5.5, cz + dz], color: '#ffffff' });
        part(f, { name: 'Candy', size: [6, 6, 6], pos: [cx + dx, 12, cz + dz], color: c, material: 'Neon', shape: 'Ball' });
      }
    }
    if (name === 'Spinner') part(f, { name: 'Bar', size: [64, 2, 2], pos: [cx, 2.5, cz], color: '#c4281c', material: 'Neon' });
  });
  thumbCam(ws, [40, 40, 40], [0, 4, -12]);
  script(g.ServerScriptService, 'Elevator', `
-- The Robis Elevator: get in, the doors close, and it stops at a random
-- floor. Survive 20 seconds there and you ride again. Floors survived count.
${HELPERS}
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local floors = workspace.Floors:GetChildren()
local hint = Instance.new("Hint", workspace)
local current = nil
local riders = {}

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local f = Instance.new("IntValue")
	f.Name = "Floors"
	f.Parent = ls
	local best = Instance.new("IntValue")
	best.Name = "Best Ride"
	best.Parent = ls
end)

local function inElevator(p)
	local r = root(p)
	if not r or not alive(p) then return false end
	local d = r.Position - Vector3.new(0, r.Position.Y, -18)
	return math.abs(d.X) < 8 and math.abs(d.Z) < 8 and r.Position.Y < 15
end
local function inFloor(p, f)
	local r = root(p)
	if not r or not alive(p) then return false end
	local s = f.Start.Position
	return math.abs(r.Position.X - s.X) < 36 and math.abs(r.Position.Z - (s.Z - 25)) < 36 and r.Position.Y > -5
end
local function kill(hit)
	local h = hit.Parent and hit.Parent:FindFirstChild("Humanoid")
	if h then h.Health = 0 end
end

-- falling out of a floor
workspace.Void.Touched:Connect(kill)
-- the dangers of the floors
for _, f in ipairs(floors) do
	if f:FindFirstChild("Lava") then f.Lava.Touched:Connect(function(hit) if current == f then kill(hit) end end) end
	if f:FindFirstChild("GiantNoob") then f.GiantNoob.Touched:Connect(function(hit) if current == f then kill(hit) end end) end
	if f:FindFirstChild("Bar") then f.Bar.Touched:Connect(function(hit) if current == f then kill(hit) end end) end
end
local spinT = 0
RunService.Heartbeat:Connect(function(dt)
	if not current then return end
	local bar = current:FindFirstChild("Bar")
	if bar then
		spinT = spinT + dt
		bar.CFrame = CFrame.new(bar.Position) * CFrame.Angles(0, spinT * 1.6, 0)
	end
end)

local EVENTS = {
	Lava = function(f) wait(20) end,
	Moon = function(f)
		workspace.Gravity = 35
		wait(20)
		workspace.Gravity = 196.2
	end,
	Disco = function(f)
		local colors = { Color3.fromRGB(255, 0, 170), Color3.fromRGB(0, 200, 255), Color3.fromRGB(255, 220, 0), Color3.fromRGB(0, 255, 120) }
		for i = 1, 40 do
			for _, t in ipairs(f:GetChildren()) do if t.Name == "Tile" then t.Color = colors[math.random(1, #colors)] end end
			wait(0.5)
		end
	end,
	Noob = function(f)
		local noob = f.GiantNoob
		local home = noob.Position
		for i = 1, 100 do
			local target, best = nil, 1e9
			for _, p in ipairs(riders) do
				local r = root(p)
				if r and alive(p) and (r.Position - noob.Position).Magnitude < best then target, best = r, (r.Position - noob.Position).Magnitude end
			end
			if target then
				local dir = Vector3.new(target.Position.X - noob.Position.X, 0, target.Position.Z - noob.Position.Z)
				if dir.Magnitude > 0.5 then noob.CFrame = CFrame.new(noob.Position + dir.Unit * 1.6) end
			end
			wait(0.2)
		end
		noob.CFrame = CFrame.new(home)
	end,
	Bricks = function(f)
		local c = f.Start.Position - Vector3.new(0, 0, 25)
		for i = 1, 40 do
			local b = Instance.new("Part")
			b.Size = Vector3.new(4, 2, 4)
			b.Color = Color3.fromRGB(math.random(80, 255), math.random(80, 255), math.random(80, 255))
			b.Position = c + Vector3.new(math.random(-30, 30), 40, math.random(-30, 30))
			b.Anchored = false
			b.Parent = f
			b.Touched:Connect(function(hit) if b.Velocity.Y < -15 then kill(hit) end end)
			Debris:AddItem(b, 4)
			wait(0.5)
		end
	end,
	Shrink = function(f)
		local tiles = {}
		for _, t in ipairs(f:GetChildren()) do if t.Name == "Tile" then table.insert(tiles, t) end end
		for i = 1, 20 do
			for k = 1, 2 do
				if #tiles > 4 then
					local t = table.remove(tiles, math.random(1, #tiles))
					t.Transparency = 0.8
					t.CanCollide = false
				end
			end
			wait(1)
		end
		for _, t in ipairs(f:GetChildren()) do if t.Name == "Tile" then t.Transparency = 0 t.CanCollide = true end end
	end,
	Candy = function(f)
		for _, p in ipairs(riders) do stat(p, "Floors", 1) end
		announce("A sweet floor! +1 bonus floor", 3)
		wait(20)
	end,
	Spinner = function(f) wait(20) end,
}

local ride = {}
while true do
	for i = 12, 1, -1 do
		hint.Text = "The elevator leaves in " .. i .. " - get in!"
		wait(1)
	end
	riders = {}
	for _, p in ipairs(Players:GetPlayers()) do if inElevator(p) then table.insert(riders, p) end end
	if #riders == 0 then
		hint.Text = "Nobody is in the elevator..."
		wait(2)
	else
		workspace.Elevator.Door.Transparency = 0
		workspace.Elevator.Door.CanCollide = true
		hint.Text = "Going up..."
		wait(3)
		local f = floors[math.random(1, #floors)]
		current = f
		hint.Text = "Floor: " .. f.Name .. "! Survive 20 seconds!"
		for i, p in ipairs(riders) do
			moveTo(p, f.Start.Position + Vector3.new((i % 5) * 3 - 6, 0, 0))
		end
		EVENTS[f.Name](f)
		current = nil
		-- the survivors ride again
		local back = 0
		for i, p in ipairs(riders) do
			if inFloor(p, f) then
				back = back + 1
				stat(p, "Floors", 1)
				ride[p.UserId] = (ride[p.UserId] or 0) + 1
				local best = stat(p, "Best Ride")
				if best and ride[p.UserId] > best.Value then best.Value = ride[p.UserId] end
				moveTo(p, Vector3.new((i % 4) * 3 - 4, 4, -18))
			else
				ride[p.UserId] = 0
			end
		end
		announce(back .. " survived the " .. f.Name .. " floor!", 3)
		workspace.Elevator.Door.Transparency = 0.6
		workspace.Elevator.Door.CanCollide = false
	end
end
`);
  return finish(g, { name: 'The Robis Elevator' });
}

// ================================================================ Cops and Robbers
export function gameCopsRobbers() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 16;
  const teams = g.GetService('Teams');
  inst(teams, 'Team', { Name: 'Police', TeamColor: Color3.fromHex('#0d69ac'), AutoAssignable: true });
  inst(teams, 'Team', { Name: 'Criminals', TeamColor: Color3.fromHex('#da8541'), AutoAssignable: true });
  part(ws, { name: 'Ground', size: [420, 2, 420], pos: [0, -1, 0], color: '#5f8f3e', material: 'Grass' });
  // roads
  part(ws, { name: 'Road', size: [400, 0.2, 18], pos: [0, 0.1, 0], color: '#3b3b3b', material: 'Concrete' });
  part(ws, { name: 'Road', size: [18, 0.2, 400], pos: [0, 0.12, 0], color: '#3b3b3b', material: 'Concrete' });
  const box = (parent, name, x, z, w, d, h, color, mat = 'Brick') => {
    const m = model(parent, name);
    for (const [px, pz, sx, sz] of [[x, z - d / 2, w, 1], [x - w / 2, z, 1, d], [x + w / 2, z, 1, d]]) part(m, { name: 'Wall', size: [sx, h, sz], pos: [px, h / 2, pz], color, material: mat });
    part(m, { name: 'WallFront', size: [w / 2 - 4, h, 1], pos: [x - w / 4 - 2, h / 2, z + d / 2], color, material: mat });
    part(m, { name: 'WallFront', size: [w / 2 - 4, h, 1], pos: [x + w / 4 + 2, h / 2, z + d / 2], color, material: mat });
    part(m, { name: 'Roof', size: [w + 2, 1, d + 2], pos: [x, h + 0.5, z], color: '#3b3b3b' });
    part(m, { name: 'Floor', size: [w, 0.4, d], pos: [x, 0.2, z], color: '#d8cfc0', material: 'Marble' });
    return m;
  };
  // the bank (cash to steal), the criminal base, the police station and the prison
  const bank = box(ws, 'Bank', 90, -90, 40, 30, 14, '#e8e0c8', 'Marble');
  const sign = part(bank, { name: 'Sign', size: [20, 4, 1], pos: [90, 17, -74], color: '#2a5a2a' });
  inst(sign, 'BillboardText', { Text: '🏦 ROBIS BANK' });
  for (const [dx, dz] of [[-10, -6], [0, -6], [10, -6]]) part(bank, { name: 'Cash', size: [5, 3, 3], pos: [90 + dx, 1.9, -90 + dz], color: '#3ddc84', material: 'Neon' });
  const hideout = model(ws, 'Hideout');
  part(hideout, { name: 'Base', size: [40, 1, 40], pos: [-140, 0.5, 140], color: '#6b4a2b', material: 'WoodPlanks' });
  const dep = part(hideout, { name: 'Deposit', size: [10, 0.6, 10], pos: [-140, 1.3, 130], color: '#ffc400', material: 'Neon' });
  inst(dep, 'BillboardText', { Text: '💰 DROP THE CASH', StudsOffset: new Vector3(0, 4, 0) });
  part(ws, { cls: 'SpawnLocation', name: 'CriminalSpawn', size: [10, 1, 10], pos: [-140, 1.2, 150], color: '#da8541', props: { Neutral: false, TeamColor: Color3.fromHex('#da8541') } });
  const station = box(ws, 'PoliceStation', -90, -90, 40, 30, 14, '#5b7bb0');
  const ps = part(station, { name: 'Sign', size: [20, 4, 1], pos: [-90, 17, -74], color: '#0d69ac' });
  inst(ps, 'BillboardText', { Text: '🚓 POLICE' });
  part(ws, { cls: 'SpawnLocation', name: 'PoliceSpawn', size: [10, 1, 10], pos: [-90, 1.2, -92], color: '#0d69ac', props: { Neutral: false, TeamColor: Color3.fromHex('#0d69ac') } });
  const prison = model(ws, 'Prison');
  part(prison, { name: 'Yard', size: [50, 1, 50], pos: [140, 0.5, 140], color: '#8a8a8a', material: 'Concrete' });
  for (const [x, z, sx, sz] of [[140, 115, 50, 1], [140, 165, 50, 1], [115, 140, 1, 50], [165, 140, 1, 50]]) part(prison, { name: 'Fence', size: [sx, 18, sz], pos: [x, 9.5, z], color: '#9a9a9a', material: 'DiamondPlate' });
  const cell = part(prison, { name: 'Cell', size: [1, 1, 1], pos: [140, 3, 140], transparency: 1, canCollide: false });
  inst(cell, 'BillboardText', { Text: '⛓ PRISON', StudsOffset: new Vector3(0, 12, 0) });
  // team pads in the middle of town
  const pads = model(ws, 'TeamPads');
  const pp = part(pads, { name: 'JoinPolice', size: [8, 0.6, 8], pos: [-20, 0.4, 25], color: '#0d69ac', material: 'Neon' });
  inst(pp, 'BillboardText', { Text: 'JOIN POLICE', StudsOffset: new Vector3(0, 4, 0) });
  const cp = part(pads, { name: 'JoinCriminals', size: [8, 0.6, 8], pos: [20, 0.4, 25], color: '#da8541', material: 'Neon' });
  inst(cp, 'BillboardText', { Text: 'JOIN CRIMINALS', StudsOffset: new Vector3(0, 4, 0) });
  for (const [x, z] of [[-60, 60], [60, 60], [-60, -40], [40, 140], [-180, -60], [180, -40], [0, 180], [0, -180]]) tree(ws, x, z);
  thumbCam(ws, [180, 110, 180], [20, 0, -20]);
  const cuffs = tool(g.GetService('StarterPack'), 'Handcuffs', 'flashlight', '#2a2a2a', 'Police: click a criminal close to you to arrest them');
  script(g.ServerScriptService, 'CopsRobbers', `
-- Cops and Robbers: criminals rob the bank (touch the green cash) and bring
-- the money to the hideout. Police arrest criminals with handcuffs (click
-- one close to you): they go to prison for 30 seconds and lose the cash
-- they carry. Change teams on the pads in town.
${HELPERS}
local Teams = game:GetService("Teams")
local police, crooks = Teams.Police, Teams.Criminals
local carrying, jailedUntil = {}, {}
local CARRY_MAX = 1500

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local money = Instance.new("IntValue")
	money.Name = "Money"
	money.Parent = ls
	local bounty = Instance.new("IntValue")
	bounty.Name = "Bounty"
	bounty.Parent = ls
	local arrests = Instance.new("IntValue")
	arrests.Name = "Arrests"
	arrests.Parent = ls
end)
Players.PlayerRemoving:Connect(function(p) carrying[p.UserId] = nil jailedUntil[p.UserId] = nil end)

local function setTeam(player, team)
	if player.Team == team then return end
	if jailedUntil[player.UserId] then announce("You can't change teams in prison!", 2) return end
	player.Team = team
	carrying[player.UserId] = 0
	player:LoadCharacter()
end
workspace.TeamPads.JoinPolice.Touched:Connect(function(hit)
	local p = Players:GetPlayerFromCharacter(hit.Parent)
	if p then setTeam(p, police) end
end)
workspace.TeamPads.JoinCriminals.Touched:Connect(function(hit)
	local p = Players:GetPlayerFromCharacter(hit.Parent)
	if p then setTeam(p, crooks) end
end)

-- robbing: every touch of the cash adds to what you carry
local robbing = {}
for _, cash in ipairs(workspace.Bank:GetChildren()) do
	if cash.Name == "Cash" then
		cash.Touched:Connect(function(hit)
			local p = Players:GetPlayerFromCharacter(hit.Parent)
			if not p or p.Team ~= crooks or robbing[p.UserId] then return end
			robbing[p.UserId] = true
			delay(0.5, function() robbing[p.UserId] = nil end)
			local c = carrying[p.UserId] or 0
			if c >= CARRY_MAX then return end
			if c == 0 then announce(p.Name .. " is robbing the bank!", 3) end
			carrying[p.UserId] = math.min(CARRY_MAX, c + 50)
			stat(p, "Bounty", 10)
		end)
	end
end
workspace.Hideout.Deposit.Touched:Connect(function(hit)
	local p = Players:GetPlayerFromCharacter(hit.Parent)
	if not p or p.Team ~= crooks then return end
	local c = carrying[p.UserId] or 0
	if c <= 0 then return end
	carrying[p.UserId] = 0
	stat(p, "Money", c)
	announce(p.Name .. " got away with $" .. c .. "!", 3)
end)

-- arresting
shared.arrest = function(cop, target)
	if cop.Team ~= police then announce("Only the police can arrest people.", 2) return end
	local r = root(cop)
	if not r then return end
	local best, bestD = nil, 9
	for _, p in ipairs(Players:GetPlayers()) do
		local pr = root(p)
		if p.Team == crooks and pr and alive(p) and not jailedUntil[p.UserId] and (pr.Position - r.Position).Magnitude < bestD then best, bestD = p, (pr.Position - r.Position).Magnitude end
	end
	if not best then return end
	local bounty = stat(best, "Bounty")
	local reward = 50 + (bounty and bounty.Value or 0)
	stat(cop, "Arrests", 1)
	stat(cop, "Money", reward)
	if bounty then bounty.Value = 0 end
	carrying[best.UserId] = 0
	jailedUntil[best.UserId] = tick() + 30
	moveTo(best, workspace.Prison.Cell.Position)
	announce(cop.Name .. " arrested " .. best.Name .. "! (+$" .. reward .. ")", 3)
end

local hint = Instance.new("Hint", workspace)
while true do
	wait(1)
	local now = tick()
	for _, p in ipairs(Players:GetPlayers()) do
		local t = jailedUntil[p.UserId]
		if t then
			local r = root(p)
			-- escaping the yard? back in the cell
			if r and (math.abs(r.Position.X - 140) > 26 or math.abs(r.Position.Z - 140) > 26) then moveTo(p, workspace.Prison.Cell.Position) end
			if now > t then
				jailedUntil[p.UserId] = nil
				moveTo(p, Vector3.new(-140, 4, 150))
				announce(p.Name .. " is out of prison!", 2)
			end
		end
	end
	local robbers = 0
	for _, c in pairs(carrying) do if c > 0 then robbers = robbers + 1 end end
	hint.Text = robbers > 0 and ("🚨 " .. robbers .. " robber(s) with cash! Police, stop them!") or "Criminals: rob the bank. Police: arrest them!"
end
`);
  script(cuffs, 'CuffScript', `
local tool = script.Parent
local Players = game:GetService("Players")
local cooldown = false
tool.Activated:Connect(function(target)
	if cooldown or not shared.arrest then return end
	local player = Players:GetPlayerFromCharacter(tool.Parent)
	if not player then return end
	cooldown = true
	delay(1, function() cooldown = false end)
	shared.arrest(player, target)
end)
`);
  return finish(g, { name: 'Cops and Robbers' });
}

export const MORE_CLASSICS = [
  { key: 'swordheights', name: 'Sword Fight on the Heights', build: gameSwordHeights, genre: 'Fighting', featured: true, maxPlayers: 16,
    visits: 58310, up: 2104, down: 160, favorites: 3900,
    description: 'The classic! Everyone gets the linked sword. Slash people, knock them off the heights into the clouds and hold the golden summit.' },
  { key: 'mining', name: 'Mining Simulator', build: gameMining, genre: 'Adventure', featured: true, maxPlayers: 12,
    visits: 64420, up: 2530, down: 210, favorites: 4700,
    description: 'Mine blocks with your pickaxe, fill your backpack and sell the ore for coins. Buy a bigger backpack and a better pickaxe, dig deeper for gold, rubies and diamonds!' },
  { key: 'elevator', name: 'The Robis Elevator', build: gameElevator, genre: 'Comedy', featured: true, maxPlayers: 16,
    visits: 47210, up: 1830, down: 140, favorites: 3100,
    description: 'Get in the elevator! Every ride stops at a random floor: lava, the Moon, a giant noob, falling bricks, a spinning bar... Survive 20 seconds and ride again.' },
  { key: 'copsrobbers', name: 'Cops and Robbers', build: gameCopsRobbers, genre: 'Town and City', featured: true, maxPlayers: 20,
    visits: 52900, up: 1960, down: 175, favorites: 3600,
    description: 'Criminals: rob the bank and bring the cash to the hideout. Police: catch them with handcuffs and send them to prison! Change teams on the pads in town.' },
];
