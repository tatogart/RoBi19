// Studio templates and the showcase games that ship with Robis.
import { newGame, part, model, folder, script, inst, baseplate, spawn, tree, finish } from './builder.js';
import { Color3, Vector3 } from '../../shared/engine/types.js';

// ---------------------------------------------------------------- templates
export function templateBaseplate() {
  const g = newGame();
  const ws = g.Workspace;
  baseplate(ws);
  spawn(ws, [0, 0.5, 0]);
  return finish(g, { template: 'Baseplate' });
}

export function templateFlatTerrain() {
  const g = newGame();
  const ws = g.Workspace;
  baseplate(ws, { color: '#4b974b', material: 'Grass', top: 'Smooth', size: [1024, 20, 1024] });
  spawn(ws, [0, 0.5, 0], { color: '#4b974b' });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    tree(ws, Math.cos(a) * (60 + (i % 3) * 25), Math.sin(a) * (60 + (i % 4) * 20));
  }
  return finish(g, { template: 'Flat Terrain' });
}

export function templateClassic() {
  const g = newGame();
  const ws = g.Workspace;
  baseplate(ws, { color: '#288f47', top: 'Studs' });
  spawn(ws, [0, 0.5, 0]);
  part(ws, { name: 'Brick', size: [4, 1.2, 2], pos: [8, 0.6, 0], color: '#c4281c', top: 'Studs', bottom: 'Inlet' });
  part(ws, { name: 'Brick', size: [4, 1.2, 2], pos: [8, 1.8, 0], color: '#0d69ac', top: 'Studs', bottom: 'Inlet' });
  part(ws, { name: 'Brick', size: [4, 1.2, 2], pos: [8, 3, 0], color: '#f5cd30', top: 'Studs', bottom: 'Inlet' });
  return finish(g, { template: 'Classic' });
}

export function templateObby() {
  const g = newGame();
  const ws = g.Workspace;
  baseplate(ws, { color: '#5b5b5f' });
  spawn(ws, [0, 0.5, 0]);
  const kill = folder(ws, 'KillBricks');
  for (let i = 0; i < 6; i++) {
    part(ws, { name: 'Platform', size: [6, 1, 6], pos: [0, 4 + i * 2, -14 - i * 11], color: '#0d69ac' });
    part(kill, { name: 'Lava', size: [6, 1, 8], pos: [0, 0.6, -19.5 - i * 11], color: '#ff5a00', material: 'Neon' });
  }
  script(g.ServerScriptService, 'KillScript', KILL_SCRIPT);
  return finish(g, { template: 'Obby' });
}

export const TEMPLATES = {
  baseplate: { name: 'Baseplate', build: templateBaseplate, desc: 'A grey studded baseplate with a spawn.' },
  classic: { name: 'Classic', build: templateClassic, desc: 'Green studs, a few bricks. Very 2008.' },
  terrain: { name: 'Flat Terrain', build: templateFlatTerrain, desc: 'A grassy field with trees.' },
  obby: { name: 'Obby', build: templateObby, desc: 'A starter obstacle course with kill bricks.' },
};

// ---------------------------------------------------------------- shared scripts
const KILL_SCRIPT = `
-- Kills any character that touches a part inside workspace.KillBricks
local folder = workspace:WaitForChild("KillBricks")

local function hook(part)
	if not part:IsA("BasePart") then return end
	part.Touched:Connect(function(hit)
		local humanoid = hit.Parent:FindFirstChild("Humanoid")
		if humanoid then
			humanoid.Health = 0
		end
	end)
end

for _, part in ipairs(folder:GetDescendants()) do
	hook(part)
end
folder.DescendantAdded:Connect(hook)
`;

const DAY_NIGHT = `
-- Smooth day/night cycle
local Lighting = game:GetService("Lighting")
local minutesPerSecond = 2
while true do
	Lighting:SetMinutesAfterMidnight(Lighting:GetMinutesAfterMidnight() + minutesPerSecond * 0.25)
	wait(0.25)
end
`;

// ---------------------------------------------------------------- Crossroads
export function gameCrossroads() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 14;
  baseplate(ws, { color: '#4b974b', top: 'Studs', size: [360, 20, 360] });
  const roads = model(ws, 'Roads');
  part(roads, { name: 'Road', size: [360, 0.2, 18], pos: [0, 0.1, 0], color: '#3a3a3c', material: 'Slate' });
  part(roads, { name: 'Road', size: [18, 0.2, 360], pos: [0, 0.1, 0], color: '#3a3a3c', material: 'Slate' });
  for (let i = -8; i <= 8; i++) {
    if (Math.abs(i) < 1) continue;
    part(roads, { name: 'Stripe', size: [8, 0.22, 1], pos: [i * 20, 0.11, 0], color: '#f5cd30', material: 'SmoothPlastic' });
    part(roads, { name: 'Stripe', size: [1, 0.22, 8], pos: [0, 0.11, i * 20], color: '#f5cd30', material: 'SmoothPlastic' });
  }
  spawn(ws, [0, 0.6, 0], { size: [14, 1, 14], color: '#a3a2a5' });

  // The tower in the middle-north
  const tower = model(ws, 'Tower');
  const tz = -70;
  for (let f = 0; f < 4; f++) {
    const y = f * 14;
    const rx = f % 2 ? 11 : -11; // ramp column for this floor
    const fy = y + 14;
    // Floor above, with a hole where the ramp comes up.
    part(tower, { name: 'Floor', size: [30, 1, 17], pos: [0, fy, tz - 6.5], color: '#a3a2a5', material: 'Concrete' });
    part(tower, { name: 'Floor', size: [22, 1, 13], pos: [rx > 0 ? -4 : 4, fy, tz + 8.5], color: '#a3a2a5', material: 'Concrete' });
    part(tower, { name: 'Floor', size: [1, 1, 13], pos: [rx > 0 ? 14.5 : -14.5, fy, tz + 8.5], color: '#a3a2a5', material: 'Concrete' });
    for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
      part(tower, { name: 'Pillar', size: [2, 14, 2], pos: [x, y + 7, tz + z], color: '#635f62', material: 'Concrete' });
    }
    part(tower, { cls: 'WedgePart', name: 'Ramp', size: [6, 14, 26], pos: [rx, y + 7, tz], color: '#cc8e69', material: 'WoodPlanks' });
  }
  part(tower, { name: 'Flag Pole', size: [1, 16, 1], pos: [0, 64.5, tz], color: '#f8f8f8', material: 'Metal' });
  part(tower, { name: 'Flag', size: [6, 4, 0.3], pos: [3.5, 70, tz], color: '#00a2ff', material: 'Fabric' });

  // Houses in the corners
  const houseColors = ['#c4281c', '#0d69ac', '#f5cd30', '#6b327c'];
  [[60, 60], [-60, 60], [60, -60], [-60, -120]].forEach(([x, z], i) => {
    const h = model(ws, 'House');
    const c = houseColors[i];
    part(h, { name: 'Floor', size: [24, 1, 20], pos: [x, 0.5, z], color: '#7c5c46', material: 'WoodPlanks' });
    part(h, { name: 'Wall', size: [24, 10, 1], pos: [x, 6, z - 9.5], color: c, material: 'Brick' });
    part(h, { name: 'Wall', size: [1, 10, 20], pos: [x - 11.5, 6, z], color: c, material: 'Brick' });
    part(h, { name: 'Wall', size: [1, 10, 20], pos: [x + 11.5, 6, z], color: c, material: 'Brick' });
    part(h, { name: 'Wall', size: [9, 10, 1], pos: [x - 7.5, 6, z + 9.5], color: c, material: 'Brick' });
    part(h, { name: 'Wall', size: [9, 10, 1], pos: [x + 7.5, 6, z + 9.5], color: c, material: 'Brick' });
    part(h, { name: 'Wall', size: [6, 3, 1], pos: [x, 9.5, z + 9.5], color: c, material: 'Brick' });
    part(h, { name: 'Window', size: [0.3, 4, 6], pos: [x + 11.6, 6, z], color: '#b4d2e4', material: 'Glass', transparency: 0.4 });
    part(h, { cls: 'WedgePart', name: 'Roof', size: [26, 5, 11], pos: [x, 13.5, z - 5.5], color: '#56422f' });
    part(h, { cls: 'WedgePart', name: 'Roof', size: [26, 5, 11], pos: [x, 13.5, z + 5.5], color: '#56422f', rot: [0, 180, 0] });
    const lamp = part(h, { name: 'Lamp', size: [1, 1, 1], pos: [x, 10, z], color: '#fff6a8', material: 'Neon', shape: 'Ball' });
    inst(lamp, 'PointLight', { Range: 18, Brightness: 2, Color: Color3.fromRGB(255, 230, 160) });
  });

  for (const [x, z] of [[30, 30], [40, 90], [-35, 40], [-90, 30], [100, -30], [-110, -40], [120, 110], [-130, 130], [35, -130], [-30, -160], [140, -140], [150, 20], [-150, -100]]) {
    tree(ws, x, z, 0, 0.9 + ((x * z) % 3) * 0.1);
  }

  // A bench and a fountain by the spawn
  const fountain = model(ws, 'Fountain');
  part(fountain, { name: 'Base', size: [2, 16, 16], pos: [30, 1, -30], color: '#a3a2a5', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  part(fountain, { name: 'Water', size: [0.4, 14, 14], pos: [30, 2, -30], color: '#04afec', material: 'Glass', transparency: 0.3, shape: 'Cylinder', rot: [0, 0, 90], canCollide: false });
  const spout = part(fountain, { name: 'Spout', size: [2, 6, 2], pos: [30, 5, -30], color: '#f8f8f8', material: 'Marble' });
  inst(spout, 'Sparkles', { SparkleColor: Color3.fromRGB(120, 200, 255) });

  script(g.ServerScriptService, 'DayNight', DAY_NIGHT);
  script(g.ServerScriptService, 'Welcome', `
local Players = game:GetService("Players")
local hint = Instance.new("Hint")
hint.Parent = workspace

Players.PlayerAdded:Connect(function(player)
	hint.Text = "Welcome to Crossroads, " .. player.Name .. "!"
	wait(4)
	if hint.Text:find(player.Name, 1, true) then
		hint.Text = ""
	end
end)
`);
  return finish(g, { name: 'Crossroads' });
}

// ---------------------------------------------------------------- Obby
export function gameObby() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 15;
  g.Lighting.SkyColor = Color3.fromRGB(110, 180, 255);
  baseplate(ws, { color: '#ff5a00', material: 'Neon', top: 'Smooth', size: [600, 2, 600] }).Name = 'LavaFloor';
  ws.FindFirstChild('LavaFloor').Position = new Vector3(0, -40, 0);

  const kill = folder(ws, 'KillBricks');
  kill.Name = 'KillBricks';
  // Move the lava floor into the kill folder so it kills too.
  ws.FindFirstChild('LavaFloor').Parent = kill;
  const checkpoints = folder(ws, 'Checkpoints');
  const colors = ['#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc', '#04afec', '#a3a2a5', '#1b2a35'];
  const cp = (n, x, y, z) => {
    const s = part(checkpoints, {
      cls: 'SpawnLocation', name: String(n), size: [10, 1, 10], pos: [x, y, z], color: colors[(n - 1) % colors.length],
      material: 'SmoothPlastic', props: { Enabled: n === 1, Duration: 0 },
    });
    return s;
  };

  let z = 0, y = 0;
  cp(1, 0, y, z);
  // Stage 1: simple jumps
  for (let i = 0; i < 5; i++) { z -= 9; y += 1; part(ws, { name: 'Jump', size: [5, 1, 5], pos: [0, y, z], color: colors[i % colors.length] }); }
  z -= 11; cp(2, 0, y, z);
  // Stage 2: lava path with narrow beams
  for (let i = 0; i < 4; i++) {
    z -= 8;
    part(ws, { name: 'Beam', size: [2, 1, 8], pos: [i % 2 ? 3 : -3, y, z], color: '#f8f8f8' });
    part(kill, { name: 'Lava', size: [4, 1, 8], pos: [i % 2 ? -3 : 3, y, z], color: '#ff2a00', material: 'Neon' });
  }
  z -= 10; cp(3, 0, y, z);
  // Stage 3: moving platforms
  const movers = folder(ws, 'MovingPlatforms');
  for (let i = 0; i < 3; i++) {
    z -= 14;
    const m = part(movers, { name: 'Mover', size: [6, 1, 6], pos: [(i % 2 ? 1 : -1) * 10, y, z], color: '#04afec', material: 'SmoothPlastic' });
    inst(m, 'Vector3Value', { Name: 'Target', Value: new Vector3((i % 2 ? -1 : 1) * 10, y, z) });
  }
  z -= 14; cp(4, 0, y, z);
  // Stage 4: disappearing platforms
  const fading = folder(ws, 'FadingPlatforms');
  for (let i = 0; i < 6; i++) { z -= 7; y += 0.5; part(fading, { name: 'Fade', size: [5, 1, 5], pos: [(i % 3 - 1) * 4, y, z], color: '#ff66cc', material: 'Neon' }); }
  z -= 10; cp(5, 0, y, z);
  // Stage 5: spinning kill bar
  z -= 16;
  part(ws, { name: 'SpinFloor', size: [1, 22, 22], pos: [0, y, z], color: '#a3a2a5', shape: 'Cylinder', rot: [0, 0, 90] });
  part(ws, { name: 'SpinHub', size: [2, 4, 2], pos: [0, y + 2.5, z], color: '#1b2a35', material: 'Metal' });
  part(kill, { name: 'Spinner', size: [22, 1, 1.2], pos: [0, y + 1.5, z], color: '#ff2a00', material: 'Neon' });
  z -= 16; cp(6, 0, y, z);
  // Stage 6: speed pad and a long gap
  z -= 8;
  const pad = part(ws, { name: 'SpeedPad', size: [6, 0.4, 6], pos: [0, y + 0.7, z], color: '#00ff00', material: 'Neon' });
  inst(pad, 'BillboardText', { Text: 'SPEED!', StudsOffset: new Vector3(0, 3, 0), TextColor3: Color3.fromRGB(0, 255, 0) });
  part(ws, { name: 'Runway', size: [6, 1, 30], pos: [0, y, z - 12], color: '#f8f8f8' });
  z -= 42;
  part(ws, { name: 'Landing', size: [10, 1, 10], pos: [0, y, z], color: '#f8f8f8' });
  z -= 12; cp(7, 0, y, z);
  // Stage 7: jump pad up
  z -= 8;
  const jp = part(ws, { name: 'JumpPad', size: [6, 0.4, 6], pos: [0, y + 0.7, z], color: '#f5cd30', material: 'Neon' });
  inst(jp, 'BillboardText', { Text: 'JUMP!', StudsOffset: new Vector3(0, 3, 0), TextColor3: Color3.fromRGB(255, 220, 0) });
  z -= 9; y += 14;
  part(ws, { name: 'HighLedge', size: [10, 1, 10], pos: [0, y, z], color: '#f8f8f8' });
  z -= 12; cp(8, 0, y, z);
  // Finish
  z -= 14;
  const fin = part(ws, { name: 'Finish', size: [16, 1, 16], pos: [0, y, z], color: '#ffc400', material: 'Neon' });
  inst(fin, 'Sparkles', { SparkleColor: Color3.fromRGB(255, 220, 0) });
  inst(fin, 'BillboardText', { Text: 'FINISH', StudsOffset: new Vector3(0, 6, 0), TextSize: 36, TextColor3: Color3.fromRGB(255, 220, 0) });

  script(g.ServerScriptService, 'KillScript', KILL_SCRIPT);
  script(g.ServerScriptService, 'Checkpoints', `
-- Stage checkpoints with leaderstats + DataStore saving
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("ObbyStages")
local checkpoints = workspace:WaitForChild("Checkpoints")

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 1
	stage.Parent = stats

	local ok, saved = pcall(function()
		return store:GetAsync("user_" .. player.UserId)
	end)
	if ok and saved then
		stage.Value = saved
		local cp = checkpoints:FindFirstChild(tostring(saved))
		if cp then player.RespawnLocation = cp end
	end
end)

Players.PlayerRemoving:Connect(function(player)
	local stats = player:FindFirstChild("leaderstats")
	if stats then
		pcall(function()
			store:SetAsync("user_" .. player.UserId, stats.Stage.Value)
		end)
	end
end)

for _, cp in ipairs(checkpoints:GetChildren()) do
	cp.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		local n = tonumber(cp.Name)
		local stage = player.leaderstats.Stage
		if n and n > stage.Value then
			stage.Value = n
			player.RespawnLocation = cp
			store:SetAsync("user_" .. player.UserId, n)
		end
	end)
end
`);
  script(g.ServerScriptService, 'Obstacles', `
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

-- Moving platforms ping-pong forever
for _, p in ipairs(workspace.MovingPlatforms:GetChildren()) do
	local info = TweenInfo.new(3, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
	TweenService:Create(p, info, {Position = p.Target.Value}):Play()
end

-- Disappearing platforms
for _, p in ipairs(workspace.FadingPlatforms:GetChildren()) do
	local busy = false
	p.Touched:Connect(function(hit)
		if busy or not hit.Parent:FindFirstChild("Humanoid") then return end
		busy = true
		for i = 1, 10 do
			p.Transparency = i / 10
			wait(0.08)
		end
		p.CanCollide = false
		wait(2)
		p.CanCollide = true
		p.Transparency = 0
		busy = false
	end)
end

-- Spinning kill bar
local spinner = workspace.KillBricks.Spinner
RunService.Heartbeat:Connect(function(dt)
	spinner.CFrame = spinner.CFrame * CFrame.Angles(0, dt * 1.6, 0)
end)

-- Speed and jump pads
local function pad(part, apply)
	part.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h then apply(h) end
	end)
end
pad(workspace.SpeedPad, function(h)
	if h.WalkSpeed < 40 then
		h.WalkSpeed = 45
		delay(3, function() h.WalkSpeed = 16 end)
	end
end)
pad(workspace.JumpPad, function(h)
	if h.JumpPower < 100 then
		h.JumpPower = 120
		delay(2, function() h.JumpPower = 50 end)
	end
end)
`);
  script(g.ServerScriptService, 'Finish', `
local Players = game:GetService("Players")
local BadgeService = game:GetService("BadgeService")
local finished = {}

workspace.Finish.Touched:Connect(function(hit)
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if not player or finished[player] then return end
	finished[player] = true
	BadgeService:AwardBadge(player.UserId, "Obby Champion")
	local msg = Instance.new("Message")
	msg.Text = player.Name .. " beat the Mega Fun Obby!"
	msg.Parent = workspace
	game:GetService("Debris"):AddItem(msg, 4)
	local fire = Instance.new("Sparkles")
	fire.Parent = hit.Parent:FindFirstChild("Torso")
end)
`);
  return finish(g, { name: 'Mega Fun Obby' });
}

// ---------------------------------------------------------------- Coin Rush
export function gameCoins() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 17.2;
  g.Lighting.OutdoorAmbient = Color3.fromRGB(150, 130, 120);
  baseplate(ws, { color: '#d7c59a', material: 'Sand', top: 'Smooth', size: [300, 20, 300] });
  spawn(ws, [0, 0.5, 0], { color: '#f5cd30' });
  // Walls and platforms
  const arena = model(ws, 'Arena');
  for (const [x, z, sx, sz] of [[0, -100, 200, 4], [0, 100, 200, 4], [-100, 0, 4, 200], [100, 0, 4, 200]]) {
    part(arena, { name: 'Wall', size: [sx, 12, sz], pos: [x, 6, z], color: '#a0725b', material: 'Brick' });
  }
  const plats = [[-40, 6, -40], [40, 10, -40], [-40, 14, 40], [40, 8, 40], [0, 18, -60], [-70, 10, 0], [70, 12, 0]];
  plats.forEach(([x, y, z], i) => {
    part(arena, { name: 'Platform', size: [16, 1, 16], pos: [x, y, z], color: ['#0d69ac', '#c4281c', '#4b974b', '#6b327c'][i % 4], material: 'SmoothPlastic' });
    part(arena, { cls: 'WedgePart', name: 'Ramp', size: [6, y, 14], pos: [x, y / 2, z + 15], rot: [0, 180, 0], color: '#a3a2a5' });
  });
  for (const [x, z] of [[-80, -80], [80, -80], [-80, 80], [80, 80]]) tree(ws, x, z);

  const coins = folder(ws, 'Coins');
  const spots = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    spots.push([Math.cos(a) * 25, 3, Math.sin(a) * 25]);
  }
  for (const [x, y, z] of plats) spots.push([x, y + 3, z]);
  spots.forEach(([x, y, z], i) => {
    const mega = i % 11 === 10;
    const c = part(coins, {
      name: mega ? 'MegaCoin' : 'Coin', size: mega ? [0.6, 5, 5] : [0.4, 3, 3], pos: [x, y, z], shape: 'Cylinder',
      color: mega ? '#ff3b3b' : '#ffc400', material: 'Neon', canCollide: false,
    });
    inst(c, 'IntValue', { Name: 'Worth', Value: mega ? 10 : 1 });
  });
  script(g.ServerScriptService, 'CoinSystem', `
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local store = game:GetService("DataStoreService"):GetDataStore("CoinRush")
local coins = workspace:WaitForChild("Coins")
local storage = game:GetService("ServerStorage")

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local c = Instance.new("IntValue")
	c.Name = "Coins"
	c.Parent = ls
	local best = Instance.new("IntValue")
	best.Name = "Best"
	best.Value = store:GetAsync(player.UserId) or 0
	best.Parent = ls
end)

Players.PlayerRemoving:Connect(function(player)
	local ls = player:FindFirstChild("leaderstats")
	if ls and ls.Coins.Value > ls.Best.Value then
		store:SetAsync(player.UserId, ls.Coins.Value)
	end
end)

local function setup(coin)
	coin.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or coin.Parent ~= coins then return end
		local ls = player:FindFirstChild("leaderstats")
		ls.Coins.Value = ls.Coins.Value + coin.Worth.Value
		if ls.Coins.Value > ls.Best.Value then ls.Best.Value = ls.Coins.Value end
		coin.Parent = storage
		wait(8)
		coin.Parent = coins
	end)
end
for _, coin in ipairs(coins:GetChildren()) do setup(coin) end

-- spin every coin
local t = 0
RunService.Heartbeat:Connect(function(dt)
	t = t + dt
	for _, coin in ipairs(coins:GetChildren()) do
		coin.CFrame = CFrame.new(coin.Position) * CFrame.Angles(0, t * 2, 0)
	end
end)
`);
  return finish(g, { name: 'Coin Rush' });
}

// ---------------------------------------------------------------- Lava Rising
export function gameLava() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 19;
  g.Lighting.FogEnd = 600;
  g.Lighting.FogColor = Color3.fromRGB(80, 40, 30);
  g.Lighting.SkyColor = Color3.fromRGB(200, 90, 50);
  part(ws, { name: 'Ground', size: [200, 4, 200], pos: [0, -2, 0], color: '#56422f', material: 'Slate' });
  const lobby = model(ws, 'Lobby');
  part(lobby, { name: 'LobbyFloor', size: [40, 2, 40], pos: [0, 120, 0], color: '#a3a2a5', material: 'Marble' });
  part(lobby, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [10, 1, 10], pos: [0, 121.5, 0], color: '#f8f8f8' });
  for (const [x, z, sx, sz] of [[0, -20, 40, 1], [0, 20, 40, 1], [-20, 0, 1, 40], [20, 0, 1, 40]]) {
    part(lobby, { name: 'Glass', size: [sx, 8, sz], pos: [x, 125, z], color: '#b4d2e4', material: 'Glass', transparency: 0.6 });
  }
  const map = model(ws, 'Map');
  const towers = [[-40, -40, 60], [40, -40, 45], [-40, 40, 35], [40, 40, 70], [0, 0, 55], [-70, 0, 30], [70, 0, 40], [0, -75, 50], [0, 75, 28]];
  towers.forEach(([x, z, h], i) => {
    part(map, { name: 'Tower', size: [10, h, 10], pos: [x, h / 2, z], color: ['#a3a2a5', '#635f62', '#cc8e69'][i % 3], material: 'Concrete' });
    for (let s = 0; s < Math.floor(h / 6); s++) {
      const a = s * 1.2;
      part(map, { name: 'Step', size: [4, 1, 4], pos: [x + Math.cos(a) * 8, 3 + s * 6, z + Math.sin(a) * 8], color: '#f5cd30' });
    }
  });
  part(map, { cls: 'SpawnLocation', name: 'ArenaSpawn', size: [12, 1, 12], pos: [0, 0.5, -20], color: '#4b974b', props: { Enabled: false } });
  const lava = part(ws, { name: 'Lava', size: [220, 2, 220], pos: [0, -3, 0], color: '#ff5a00', material: 'Neon', canCollide: false });
  inst(lava, 'PointLight', { Range: 60, Brightness: 3, Color: Color3.fromRGB(255, 120, 40) });
  script(g.ServerScriptService, 'Rounds', `
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local lava = workspace.Lava
local lobbySpawn = workspace.Lobby.LobbySpawn
local arenaSpawn = workspace.Map.ArenaSpawn
local hint = Instance.new("Hint", workspace)

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local alive = Instance.new("BoolValue")
	alive.Name = "InRound"
	alive.Parent = player
end)

lava.Touched:Connect(function(hit)
	local h = hit.Parent:FindFirstChild("Humanoid")
	if h then h:TakeDamage(100) end
end)

local function alivePlayers()
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local c = p.Character
		local h = c and c:FindFirstChild("Humanoid")
		if h and h.Health > 0 and p:FindFirstChild("InRound") and p.InRound.Value then
			table.insert(list, p)
		end
	end
	return list
end

while true do
	for i = 15, 1, -1 do
		hint.Text = "Intermission: " .. i
		wait(1)
	end
	if #Players:GetPlayers() == 0 then
		hint.Text = "Waiting for players..."
		wait(2)
	else
		hint.Text = "The lava is rising! Climb!"
		for _, p in ipairs(Players:GetPlayers()) do
			p.InRound.Value = true
			p.RespawnLocation = arenaSpawn
			p:LoadCharacter()
			p.RespawnLocation = lobbySpawn
		end
		wait(3)
		local rise = TweenService:Create(lava, TweenInfo.new(45, Enum.EasingStyle.Linear), {Position = Vector3.new(0, 62, 0)})
		rise:Play()
		for t = 45, 1, -1 do
			local n = #alivePlayers()
			hint.Text = "Survive! " .. t .. "s  |  " .. n .. " alive"
			if n == 0 then break end
			wait(1)
		end
		rise:Cancel()
		local winners = alivePlayers()
		for _, p in ipairs(winners) do
			p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
		end
		if #winners > 0 then
			local names = {}
			for _, p in ipairs(winners) do table.insert(names, p.Name) end
			hint.Text = "Survivors: " .. table.concat(names, ", ")
		else
			hint.Text = "Nobody survived!"
		end
		for _, p in ipairs(Players:GetPlayers()) do p.InRound.Value = false end
		wait(3)
		TweenService:Create(lava, TweenInfo.new(3), {Position = Vector3.new(0, -3, 0)}):Play()
		for _, p in ipairs(Players:GetPlayers()) do p:LoadCharacter() end
	end
end
`);
  return finish(g, { name: 'Lava Rising' });
}

// ---------------------------------------------------------------- Button Mania
export function gameButtons() {
  const g = newGame();
  const ws = g.Workspace;
  baseplate(ws, { color: '#0d69ac', top: 'Studs', size: [300, 20, 300] });
  spawn(ws, [0, 0.5, 30]);
  const buttons = model(ws, 'Buttons');
  const defs = [['Rain Bricks', '#4b974b', -24], ['BOOM', '#c4281c', -8], ['Day / Night', '#f5cd30', 8], ['Party Mode', '#ff66cc', 24]];
  for (const [name, color, x] of defs) {
    part(buttons, { name: name + ' Stand', size: [8, 3, 4], pos: [x, 1.5, 0], color: '#635f62', material: 'DiamondPlate' });
    const b = part(buttons, { name, size: [6, 1, 3], pos: [x, 3.5, 0], color, material: 'Neon' });
    inst(b, 'ClickDetector', { MaxActivationDistance: 40 });
    inst(b, 'BillboardText', { Text: name, StudsOffset: new Vector3(0, 3, 0) });
  }
  part(ws, { name: 'Arena', size: [80, 1, 80], pos: [0, 0.5, -60], color: '#a3a2a5', top: 'Studs' });
  part(ws, { name: 'Sign', size: [30, 8, 1], pos: [0, 8, 15], color: '#1b2a35' });
  const pile = folder(ws, 'Bricks');
  for (let i = 0; i < 12; i++) {
    part(pile, { name: 'Brick', size: [4, 2, 2], pos: [-10 + (i % 4) * 5, 2 + Math.floor(i / 4) * 2, -60], color: ['#c4281c', '#f5cd30', '#0d69ac'][i % 3], anchored: false, top: 'Studs' });
  }
  script(g.ServerScriptService, 'ButtonLogic', `
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")
local buttons = workspace.Buttons
local bricks = workspace.Bricks

local function press(button, fn)
	local cd = button:FindFirstChildOfClass("ClickDetector")
	local busy = false
	cd.MouseClick:Connect(function(player)
		if busy then return end
		busy = true
		local old = button.Color
		button.Color = Color3.new(1, 1, 1)
		print(player.Name .. " pressed " .. button.Name)
		fn(player)
		wait(0.3)
		button.Color = old
		busy = false
	end)
end

press(buttons["Rain Bricks"], function()
	for i = 1, 20 do
		local p = Instance.new("Part")
		p.Size = Vector3.new(math.random(2, 5), math.random(1, 3), math.random(2, 5))
		p.BrickColor = BrickColor.random()
		p.TopSurface = Enum.SurfaceType.Studs
		p.Position = Vector3.new(math.random(-35, 35), 60 + i * 2, -60 + math.random(-35, 35))
		p.Parent = bricks
		Debris:AddItem(p, 30)
		wait(0.05)
	end
end)

press(buttons["BOOM"], function()
	local e = Instance.new("Explosion")
	e.Position = Vector3.new(math.random(-20, 20), 2, -60 + math.random(-20, 20))
	e.BlastRadius = 12
	e.Parent = workspace
end)

press(buttons["Day / Night"], function()
	if Lighting.ClockTime > 6 and Lighting.ClockTime < 18 then
		Lighting.ClockTime = 0
	else
		Lighting.ClockTime = 14
	end
end)

local partying = false
press(buttons["Party Mode"], function()
	if partying then return end
	partying = true
	local base = workspace.Baseplate
	local old = base.Color
	for i = 1, 20 do
		base.Color = Color3.fromHSV(math.random(), 0.8, 1)
		wait(0.25)
	end
	base.Color = old
	partying = false
end)
`);
  return finish(g, { name: 'Button Mania' });
}

export const SEED_GAMES = [
  { key: 'crossroads', name: 'Crossroads', build: gameCrossroads, genre: 'Town and City', featured: true, maxPlayers: 20,
    description: 'The classic hangout map. Climb the tower, explore the houses and watch the sun go down. A timeless Robis experience.' },
  { key: 'obby', name: 'Mega Fun Obby', build: gameObby, genre: 'Adventure', featured: true, maxPlayers: 15,
    description: 'Jump, dodge lava, ride moving platforms and beat all 8 stages! Your stage is saved automatically. Beat it to earn the Obby Champion badge.' },
  { key: 'coins', name: 'Coin Rush', build: gameCoins, genre: 'Sports', featured: false, maxPlayers: 12,
    description: 'Collect as many spinning coins as you can. Red coins are worth 10! Your best score is saved.' },
  { key: 'lava', name: 'Lava Rising', build: gameLava, genre: 'Fighting', featured: true, maxPlayers: 16,
    description: 'Survive the rising lava by climbing towers. Every round you survive gives you a Win.' },
  { key: 'buttons', name: 'Button Mania', build: gameButtons, genre: 'Comedy', featured: false, maxPlayers: 10,
    description: 'Press the buttons. Make it rain bricks. Blow stuff up. Party!' },
];
