// Games made for several players at once: teams, tagging and a hill to hold.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, baseplate, tree, finish } from './builder.js';

const RED = '#c4281c';
const BLUE = '#0d69ac';

function team(g, name, color, auto = true) {
  return inst(g.GetService('Teams'), 'Team', { Name: name, TeamColor: Color3.fromHex(color), AutoAssignable: auto });
}

function teamSpawn(parent, name, pos, color) {
  return part(parent, {
    cls: 'SpawnLocation', name, size: [10, 1, 10], pos, color,
    props: { Neutral: false, TeamColor: Color3.fromHex(color) },
  });
}

// Shared Lua helpers for the team games.
const HELPERS = `
local function torso(p)
	local c = p.Character
	return c and c:FindFirstChild("Torso")
end
local function alive(p)
	local h = p.Character and p.Character:FindFirstChild("Humanoid")
	return h and h.Health > 0
end
local function announce(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	game:GetService("Debris"):AddItem(m, secs or 3)
end
`;

// ================================================================ Capture the Flag
export function gameCTF() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13;
  baseplate(ws, { color: '#4b974b', size: [400, 20, 400] });
  team(g, 'Red', RED);
  team(g, 'Blue', BLUE);
  part(ws, { name: 'MidLine', size: [120, 0.2, 2], pos: [0, 0.1, 0], color: '#f8f8f8', material: 'SmoothPlastic' });
  const walls = model(ws, 'Walls');
  for (const [x, z, sx, sz] of [[0, -125, 124, 2], [0, 125, 124, 2], [-61, 0, 2, 252], [61, 0, 2, 252]]) {
    part(walls, { name: 'Wall', size: [sx, 8, sz], pos: [x, 4, z], color: '#a3a2a5', material: 'Concrete' });
  }
  // Cover in the middle.
  const cover = folder(ws, 'Cover');
  for (const [x, z] of [[-30, -20], [25, -35], [-15, 30], [35, 20], [0, 0], [-40, 50], [40, -55], [10, 60], [-10, -65]]) {
    part(cover, { name: 'Crate', size: [6, 6, 6], pos: [x, 3, z], color: '#a0725b', material: 'WoodPlanks' });
  }
  for (const [name, color, z] of [['Red', RED, 100], ['Blue', BLUE, -100]]) {
    const s = z > 0 ? 1 : -1;
    const base = part(ws, { name: name + 'Base', size: [24, 0.4, 16], pos: [0, 0.2, z], color, material: 'Neon', transparency: 0.4 });
    inst(base, 'BillboardText', { Text: name + ' base', StudsOffset: new Vector3(0, 12, 0) });
    part(ws, { name: 'Pole', size: [0.6, 10, 0.6], pos: [0, 5, z], color: '#f8f8f8', material: 'Metal' });
    part(ws, { name: name + 'Flag', size: [4, 3, 0.3], pos: [2, 8.5, z], color, material: 'Fabric', canCollide: false });
    teamSpawn(ws, name + 'Spawn', [0, 0.5, z + s * 16], color);
    part(ws, { name: 'BaseWall', size: [30, 5, 1], pos: [0, 2.5, z + s * 23], color, material: 'Brick' });
  }
  script(g.ServerScriptService, 'CaptureTheFlag', `
-- Red vs Blue. Grab the enemy flag and bring it to your base while your
-- own flag is at home. Touch an enemy on your half to send them back.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local hint = Instance.new("Hint", workspace)
local GOAL = 3
local score = {Red = 0, Blue = 0}
${HELPERS}
local flags = {}
for _, name in ipairs({"Red", "Blue"}) do
	local part = workspace[name .. "Flag"]
	flags[name] = {part = part, home = part.Position, carrier = nil}
end

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local caps = Instance.new("IntValue")
	caps.Name = "Captures"
	caps.Parent = ls
	local tags = Instance.new("IntValue")
	tags.Name = "Tags"
	tags.Parent = ls
end)

local function teamOf(p) return p.Team and p.Team.Name end
local function showScore() hint.Text = "Red " .. score.Red .. "  :  " .. score.Blue .. " Blue    (first to " .. GOAL .. ")" end
local function returnFlag(name)
	local f = flags[name]
	f.carrier = nil
	f.part.CFrame = CFrame.new(f.home)
end
showScore()

for name, f in pairs(flags) do
	f.part.Touched:Connect(function(hit)
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if p and alive(p) and not f.carrier and teamOf(p) and teamOf(p) ~= name then
			f.carrier = p
			announce(p.Name .. " took the " .. name .. " flag!", 2)
		end
	end)
end

for _, name in ipairs({"Red", "Blue"}) do
	workspace[name .. "Base"].Touched:Connect(function(hit)
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if not p or teamOf(p) ~= name then return end
		local enemy = name == "Red" and "Blue" or "Red"
		if flags[enemy].carrier ~= p or flags[name].carrier then return end
		score[name] = score[name] + 1
		p.leaderstats.Captures.Value = p.leaderstats.Captures.Value + 1
		returnFlag(enemy)
		showScore()
		if score[name] >= GOAL then
			announce(name .. " team wins!", 5)
			wait(5)
			score.Red, score.Blue = 0, 0
			returnFlag("Red")
			returnFlag("Blue")
			showScore()
			for _, pl in ipairs(Players:GetPlayers()) do pl:LoadCharacter() end
		else
			announce(p.Name .. " captured the " .. enemy .. " flag!", 3)
		end
	end)
end

-- Carried flags follow their carrier and go home if the carrier dies or leaves.
RunService.Heartbeat:Connect(function()
	for name, f in pairs(flags) do
		local c = f.carrier
		if c then
			local t = c.Parent and alive(c) and torso(c)
			if t then
				f.part.CFrame = CFrame.new(t.Position + Vector3.new(0, 4, 0))
			else
				returnFlag(name)
			end
		end
	end
end)

-- Tagging: touching an enemy who is on your half sends them back.
while true do
	wait(0.2)
	local list = Players:GetPlayers()
	for _, a in ipairs(list) do
		for _, b in ipairs(list) do
			local ta, tb = torso(a), torso(b)
			if a ~= b and ta and tb and teamOf(a) and teamOf(b) and teamOf(a) ~= teamOf(b) and alive(a) and alive(b)
				and (ta.Position - tb.Position).Magnitude < 4.5 then
				local side = teamOf(a) == "Red" and 1 or -1
				if tb.Position.Z * side > 0 then
					b.Character.Humanoid.Health = 0
					a.leaderstats.Tags.Value = a.leaderstats.Tags.Value + 1
				end
			end
		end
	end
end
`);
  return finish(g, { name: 'Capture the Flag' });
}

// ================================================================ Freeze Tag
export function gameFreezeTag() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 15;
  baseplate(ws, { color: '#b4d2e4', material: 'Ice', top: 'Smooth', size: [400, 20, 400] });
  team(g, 'Taggers', RED, false);
  team(g, 'Runners', BLUE, true);
  const arena = model(ws, 'Arena');
  for (const [x, z, sx, sz] of [[0, -80, 164, 4], [0, 80, 164, 4], [-80, 0, 4, 164], [80, 0, 4, 164]]) {
    part(arena, { name: 'Wall', size: [sx, 10, sz], pos: [x, 5, z], color: '#f8f8f8', material: 'Ice' });
  }
  const obstacles = [[-40, -40, 16, 4], [40, 40, 16, 4], [-40, 40, 4, 16], [40, -40, 4, 16], [0, -20, 20, 3], [0, 20, 20, 3], [-60, 0, 3, 20], [60, 0, 3, 20]];
  for (const [x, z, sx, sz] of obstacles) part(arena, { name: 'Block', size: [sx, 6, sz], pos: [x, 3, z], color: '#04afec', material: 'Ice' });
  part(arena, { name: 'Igloo', size: [14, 14, 14], pos: [0, 0, 0], color: '#f8f8f8', material: 'SmoothPlastic', shape: 'Ball' });
  teamSpawn(ws, 'RunnerSpawn', [0, 0.5, 55], BLUE);
  teamSpawn(ws, 'TaggerSpawn', [0, 0.5, -55], RED);
  for (const [x, z] of [[-65, -65], [65, 65], [-65, 65], [65, -65]]) tree(ws, x, z);
  script(g.ServerScriptService, 'FreezeTag', `
-- Taggers freeze runners by touching them; runners unfreeze each other.
-- Freeze everyone before the time runs out, or survive as a runner.
local Players = game:GetService("Players")
local Teams = game:GetService("Teams")
local hint = Instance.new("Hint", workspace)
local ROUND = 60
local frozen = {}
${HELPERS}
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
	local fr = Instance.new("IntValue")
	fr.Name = "Freezes"
	fr.Parent = ls
end)

local function setFrozen(p, on)
	frozen[p] = on or nil
	local c = p.Character
	local h = c and c:FindFirstChild("Humanoid")
	if not h then return end
	h.WalkSpeed = on and 0 or 16
	h.JumpPower = on and 0 or 50
	for _, part in ipairs(c:GetChildren()) do
		if part:IsA("BasePart") and part.Name ~= "HumanoidRootPart" then
			part.Transparency = on and 0.4 or 0
		end
	end
	local t = c:FindFirstChild("Torso")
	if on and t then Instance.new("Sparkles", t) end
	if not on then
		for _, d in ipairs(c:GetDescendants()) do if d:IsA("Sparkles") then d:Destroy() end end
	end
end

local function everyone(team)
	local list = {}
	for _, p in ipairs(Players:GetPlayers()) do
		if p.Team == team then table.insert(list, p) end
	end
	return list
end

while true do
	for _, p in ipairs(Players:GetPlayers()) do p.Team = Teams.Runners end
	frozen = {}
	for i = 10, 1, -1 do
		hint.Text = "Next round in " .. i
		wait(1)
	end
	local players = Players:GetPlayers()
	if #players < 2 then
		hint.Text = "Freeze Tag needs at least 2 players. Invite a friend!"
		wait(3)
	else
		-- One tagger for every 4 players.
		local n = math.max(1, math.floor(#players / 4))
		for i = 1, n do
			local pick = players[math.random(1, #players)]
			while pick.Team == Teams.Taggers do pick = players[math.random(1, #players)] end
			pick.Team = Teams.Taggers
		end
		for _, p in ipairs(players) do p:LoadCharacter() end
		local names = {}
		for _, p in ipairs(everyone(Teams.Taggers)) do
			table.insert(names, p.Name)
			local h = p.Character and p.Character:FindFirstChild("Humanoid")
			if h then h.WalkSpeed = 0 end
		end
		announce(table.concat(names, ", ") .. " is IT! Runners, run!", 3)
		wait(3)
		for _, p in ipairs(everyone(Teams.Taggers)) do
			local h = p.Character and p.Character:FindFirstChild("Humanoid")
			if h then h.WalkSpeed = 18 end
		end
		local t0 = tick()
		local winner = "Runners"
		while tick() - t0 < ROUND do
			local taggers, runners = everyone(Teams.Taggers), everyone(Teams.Runners)
			for _, a in ipairs(taggers) do
				for _, b in ipairs(runners) do
					local ta, tb = torso(a), torso(b)
					if ta and tb and not frozen[b] and (ta.Position - tb.Position).Magnitude < 4.5 then
						setFrozen(b, true)
						a.leaderstats.Freezes.Value = a.leaderstats.Freezes.Value + 1
					end
				end
			end
			for _, a in ipairs(runners) do
				for _, b in ipairs(runners) do
					local ta, tb = torso(a), torso(b)
					if a ~= b and ta and tb and not frozen[a] and frozen[b] and (ta.Position - tb.Position).Magnitude < 4.5 then
						setFrozen(b, false)
					end
				end
			end
			local free = 0
			for _, r in ipairs(runners) do if not frozen[r] and r.Parent then free = free + 1 end end
			if #runners == 0 or #taggers == 0 then winner = nil break end
			if free == 0 then winner = "Taggers" break end
			hint.Text = "Freeze Tag!  " .. math.ceil(ROUND - (tick() - t0)) .. "s  |  " .. free .. " runners free"
			wait(0.15)
		end
		if winner then
			for _, p in ipairs(Players:GetPlayers()) do
				if (winner == "Taggers" and p.Team == Teams.Taggers) or (winner == "Runners" and p.Team == Teams.Runners and not frozen[p]) then
					p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
				end
			end
			announce(winner == "Taggers" and "Everyone is frozen! Taggers win!" or "Time's up! Runners win!", 4)
		end
		wait(4)
		for _, p in ipairs(Players:GetPlayers()) do
			p.Team = Teams.Runners
			p:LoadCharacter()
		end
	end
end
`);
  return finish(g, { name: 'Freeze Tag' });
}

// ================================================================ King of the Hill
export function gameKingOfTheHill() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 17;
  baseplate(ws, { color: '#cc8e69', material: 'Sand', top: 'Smooth', size: [400, 20, 400] });
  part(ws, { cls: 'SpawnLocation', name: 'SpawnLocation', size: [10, 1, 10], pos: [0, 0.5, 60], color: '#a3a2a5' });
  part(ws, { cls: 'SpawnLocation', name: 'SpawnLocation', size: [10, 1, 10], pos: [0, 0.5, -60], color: '#a3a2a5' });
  part(ws, { cls: 'SpawnLocation', name: 'SpawnLocation', size: [10, 1, 10], pos: [60, 0.5, 0], color: '#a3a2a5' });
  part(ws, { cls: 'SpawnLocation', name: 'SpawnLocation', size: [10, 1, 10], pos: [-60, 0.5, 0], color: '#a3a2a5' });
  const hill = model(ws, 'Hill');
  for (let i = 0; i < 4; i++) {
    part(hill, { name: 'Tier', size: [3, 40 - i * 9, 40 - i * 9], pos: [0, 1.5 + i * 3, 0], color: ['#635f62', '#a3a2a5', '#cc8e69', '#a0725b'][i], material: 'Slate', shape: 'Cylinder', rot: [0, 0, 90] });
  }
  const crown = part(hill, { name: 'Crown', size: [0.6, 12, 12], pos: [0, 12.3, 0], color: '#ffc400', material: 'Neon', shape: 'Cylinder', rot: [0, 0, 90] });
  inst(crown, 'BillboardText', { Text: 'KING OF THE HILL', StudsOffset: new Vector3(0, 8, 0) });
  inst(crown, 'PointLight', { Color: Color3.fromRGB(255, 200, 0), Range: 20, Brightness: 2 });
  const pads = folder(ws, 'JumpPads');
  for (const [x, z] of [[30, 30], [-30, 30], [30, -30], [-30, -30]]) {
    part(pads, { name: 'JumpPad', size: [6, 0.4, 6], pos: [x, 0.2, z], color: '#00ff00', material: 'Neon' });
  }
  for (const [x, z] of [[-80, -80], [80, 80], [-80, 80], [80, -80]]) tree(ws, x, z);
  script(g.ServerScriptService, 'KingOfTheHill', `
-- Stand on the golden crown to score. Watch out for the shockwave!
local Players = game:GetService("Players")
local hint = Instance.new("Hint", workspace)
local crown = workspace.Hill.Crown
local GOAL = 60
${HELPERS}
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local points = Instance.new("IntValue")
	points.Name = "Points"
	points.Parent = ls
	local wins = Instance.new("IntValue")
	wins.Name = "Wins"
	wins.Parent = ls
end)

for _, pad in ipairs(workspace.JumpPads:GetChildren()) do
	pad.Touched:Connect(function(hit)
		local h = hit.Parent:FindFirstChild("Humanoid")
		if h and h.JumpPower < 100 then
			h.JumpPower = 130
			delay(1.5, function() h.JumpPower = 50 end)
		end
	end)
end

local function onHill(p)
	local t = torso(p)
	if not t or not alive(p) then return false end
	local d = t.Position - crown.Position
	return math.sqrt(d.X * d.X + d.Z * d.Z) < 6.5 and d.Y > 0 and d.Y < 6
end

local seconds = 0
while true do
	wait(1)
	seconds = seconds + 1
	local kings = {}
	for _, p in ipairs(Players:GetPlayers()) do
		if onHill(p) then table.insert(kings, p) end
	end
	for _, p in ipairs(kings) do
		-- Holding the hill alone is worth double.
		p.leaderstats.Points.Value = p.leaderstats.Points.Value + (#kings == 1 and 2 or 1)
		if p.leaderstats.Points.Value >= GOAL then
			p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
			announce(p.Name .. " is the King of the Hill!", 4)
			for _, q in ipairs(Players:GetPlayers()) do q.leaderstats.Points.Value = 0 end
			wait(4)
			for _, q in ipairs(Players:GetPlayers()) do q:LoadCharacter() end
			break
		end
	end
	local names = {}
	for _, p in ipairs(kings) do table.insert(names, p.Name) end
	hint.Text = #names > 0 and ("On the hill: " .. table.concat(names, ", ")) or "The hill is free! Go!"
	-- Every 12 seconds a shockwave knocks everyone off the top.
	if seconds % 12 == 0 then
		crown.Color = Color3.new(1, 0.2, 0.2)
		wait(0.6)
		local e = Instance.new("Explosion")
		e.Position = crown.Position + Vector3.new(0, 1, 0)
		e.BlastRadius = 14
		e.BlastPressure = 600000
		e.DestroyJointRadiusPercent = 0
		e.Parent = workspace
		crown.Color = Color3.fromRGB(255, 196, 0)
	end
end
`);
  return finish(g, { name: 'King of the Hill' });
}

export const TEAM_GAMES = [
  { key: 'ctf', name: 'Capture the Flag', build: gameCTF, genre: 'Fighting', featured: true, maxPlayers: 16,
    visits: 40211, up: 1105, down: 98, favorites: 2800,
    description: 'Red vs Blue! Steal the enemy flag and bring it home. Tag enemies on your half to send them back. First team to 3 wins.' },
  { key: 'freezetag', name: 'Freeze Tag', build: gameFreezeTag, genre: 'Comedy', featured: true, maxPlayers: 16,
    visits: 35870, up: 970, down: 77, favorites: 2300,
    description: 'Taggers freeze runners with a touch, runners unfreeze their friends. Play with 2 or more players!' },
  { key: 'koth', name: 'King of the Hill', build: gameKingOfTheHill, genre: 'Fighting', featured: false, maxPlayers: 12,
    visits: 21544, up: 640, down: 70, favorites: 1400,
    description: 'Stand on the golden crown to score points. Holding it alone counts double. Beware the shockwave!' },
];
