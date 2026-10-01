// More showcase games (added after the first five). Every game is built from
// code: parts plus server Scripts written in Robis Lua.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, spawn, tree, finish } from './builder.js';
import { gameDisaster, gameTower } from './places5.js';

export { gameDisaster, gameTower };

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
	-- Dying knocks you out of the round (you respawn in the lobby, alive, but you didn't survive).
	player.CharacterAdded:Connect(function(char)
		local hum = char:FindFirstChild("Humanoid")
		if hum then hum.Died:Connect(function() if player:FindFirstChild("InRound") then player.InRound.Value = false end end) end
	end)
end)
`;

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
    description: 'Four maps and eleven disasters: floods, tornadoes, acid rain, lightning, volcanoes, tsunamis and more. Later rounds bring DOUBLE disasters!' },
  { key: 'tower', name: 'Tower of Robis', build: gameTower, genre: 'Adventure', featured: true, maxPlayers: 16,
    visits: 54210, up: 1230, down: 160, favorites: 3900,
    description: 'A brand-new random tower every round! No checkpoints, moving platforms, sweepers and fading blocks. It gets harder the higher you climb.' },
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
