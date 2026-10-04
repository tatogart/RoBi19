// Hide and Seek Extreme, the way it was in 2015-2019: you're tiny, the house
// is huge. One player is IT and waits in a cage while everyone hides under
// giant tables, in cupboards and behind cereal boxes. Then IT is let out and
// tags whoever it finds. Found players go back to the lobby.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

// A box with one open side (a cupboard, a wardrobe, a toy box) at (x, y, z),
// size w x h x d; `open` is the open side: 'front' (-z), 'back', 'left', 'right', 'top'.
function hollow(parent, name, [x, y, z], [w, h, d], color, material = 'Wood', open = 'front', t = 1) {
  const m = model(parent, name);
  const side = (n, size, pos) => part(m, { name: n, size, pos, color, material });
  side('Bottom', [w, t, d], [x, y + t / 2, z]);
  if (open !== 'top') side('Top', [w, t, d], [x, y + h - t / 2, z]);
  if (open !== 'front') side('Front', [w, h, t], [x, y + h / 2, z - d / 2 + t / 2]);
  if (open !== 'back') side('Back', [w, h, t], [x, y + h / 2, z + d / 2 - t / 2]);
  if (open !== 'left') side('Left', [t, h, d], [x - w / 2 + t / 2, y + h / 2, z]);
  if (open !== 'right') side('Right', [t, h, d], [x + w / 2 - t / 2, y + h / 2, z]);
  return m;
}

// A table (or a desk, a bed frame): a top on four legs, room to hide under it.
function table(parent, name, [x, z], [w, d], height, color, top = 2, leg = 2.5) {
  const m = model(parent, name);
  part(m, { name: 'Top', size: [w, top, d], pos: [x, height - top / 2, z], color, material: 'Wood' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(m, { name: 'Leg', size: [leg, height - top, leg], pos: [x + sx * (w / 2 - leg), (height - top) / 2, z + sz * (d / 2 - leg)], color, material: 'Wood' });
  }
  return m;
}

function ladder(parent, x, z, h, face = 0) {
  return part(parent, { cls: 'TrussPart', name: 'Ladder', size: [2, h, 2], pos: [x, h / 2, z], color: '#8a8a8a', material: 'Metal', rot: [0, face, 0] });
}

function spawns(map, list, y = 2) {
  const f = folder(map, 'Spawns');
  for (const [x, z] of list) part(f, { name: 'Spawn', size: [2, 1, 2], pos: [x, y, z], transparency: 1, canCollide: false });
}

function room(m, cx, w, d, h, floor, wall, floorMat) {
  part(m, { name: 'Floor', size: [w, 1, d], pos: [cx, 0.5, 0], color: floor, material: floorMat });
  part(m, { name: 'WallBack', size: [w, h, 2], pos: [cx, h / 2, d / 2 + 1], color: wall });
  part(m, { name: 'WallFront', size: [w, h, 2], pos: [cx, h / 2, -d / 2 - 1], color: wall });
  part(m, { name: 'WallLeft', size: [2, h, d], pos: [cx - w / 2 - 1, h / 2, 0], color: wall });
  part(m, { name: 'WallRight', size: [2, h, d], pos: [cx + w / 2 + 1, h / 2, 0], color: wall });
}

export function gameHideSeek() {
  const g = newGame();
  const ws = g.Workspace;
  g.Lighting.ClockTime = 13;
  g.Lighting.Ambient = Color3.fromRGB(135, 135, 135);
  part(ws, { name: 'Void', size: [1200, 2, 1200], pos: [0, -60, 0], color: '#1b1b1b' });

  // ---------------------------------------------------------------- lobby
  const lobby = model(ws, 'Lobby');
  const LY = 200; // the lobby floats far above the maps
  part(lobby, { name: 'Floor', size: [60, 1, 46], pos: [0, LY + 0.5, 0], color: '#3a8fd6', material: 'SmoothPlastic' });
  for (const [x, z, sx, sz] of [[0, -23, 60, 1], [0, 23, 60, 1], [-30, 0, 1, 46], [30, 0, 1, 46]]) part(lobby, { name: 'Wall', size: [sx, 16, sz], pos: [x, LY + 8.5, z], color: '#f2f2f2' });
  part(lobby, { cls: 'SpawnLocation', name: 'LobbySpawn', size: [12, 1, 12], pos: [-8, LY + 1.1, 4], color: '#f5cd30', props: { Duration: 0 } });
  // the seeker's cage (glass, so everyone sees who is IT)
  const cage = model(lobby, 'Cage');
  const CX = 20, CZ = -12;
  part(cage, { name: 'CageFloor', size: [10, 1, 10], pos: [CX, LY + 1.1, CZ], color: '#c4281c', material: 'Neon' });
  for (const [x, z, sx, sz] of [[CX, CZ - 5, 10, 0.6], [CX, CZ + 5, 10, 0.6], [CX - 5, CZ, 0.6, 10], [CX + 5, CZ, 0.6, 10]]) part(cage, { name: 'Glass', size: [sx, 12, sz], pos: [x, LY + 7.5, z], color: '#bfe6ff', material: 'Glass', transparency: 0.55 });
  part(cage, { name: 'CageTop', size: [10, 0.6, 10], pos: [CX, LY + 13.6, CZ], color: '#bfe6ff', material: 'Glass', transparency: 0.55 });
  part(cage, { name: 'CageSpot', size: [2, 1, 2], pos: [CX, LY + 2, CZ], transparency: 1, canCollide: false });
  const cageSign = part(cage, { name: 'CageSign', size: [1, 1, 1], pos: [CX, LY + 16, CZ], transparency: 1, canCollide: false });
  inst(cageSign, 'BillboardText', { Text: 'IT waits here', TextSize: 16 });
  const sign = part(lobby, { name: 'Sign', size: [24, 7, 0.5], pos: [-6, LY + 10, 22.5], color: '#1b1b1b' });
  inst(sign, 'BillboardText', { Text: 'HIDE AND SEEK EXTREME', StudsOffset: new Vector3(0, 0, 0) });
  const how = part(lobby, { name: 'HowTo', size: [1, 1, 1], pos: [-6, LY + 6, 22], transparency: 1, canCollide: false });
  inst(how, 'BillboardText', { Text: 'You are tiny! Hide anywhere in the giant house. IT has to find you before the time runs out.', TextSize: 15 });
  for (const [x, z] of [[-18, -10], [-20, 12], [6, 14]]) part(lobby, { name: 'Beanbag', size: [5, 3, 5], pos: [x, LY + 2.5, z], color: ['#ff66cc', '#00a2ff', '#4b974b'][Math.abs(x) % 3], material: 'Fabric', shape: 'Ball' });

  const maps = folder(ws, 'Maps');

  // ---------------------------------------------------------------- map 1: Giant Kitchen
  const k = model(maps, 'Giant Kitchen');
  const KX = 320;
  room(k, KX, 220, 180, 90, '#d9c7a3', '#f3e6c8', 'WoodPlanks');
  part(k, { name: 'Tiles', size: [80, 0.2, 180], pos: [KX + 70, 1.1, 0], color: '#f2f2f2', material: 'Marble' });
  // the dining table and chairs (hide under them, or climb up)
  table(k, 'DiningTable', [KX - 30, 10], [70, 44], 30, '#7a4b2a', 3, 4);
  ladder(k, KX - 30, 34, 30);
  for (const [dx, dz] of [[-24, -30], [0, -30], [24, -30], [-24, 50], [0, 50], [24, 50]]) {
    const ch = table(k, 'Chair', [KX - 30 + dx, 10 + dz * 0.85], [14, 14], 16, '#8b5a2b', 2, 2);
    part(ch, { name: 'Back', size: [14, 18, 2], pos: [KX - 30 + dx, 25, 10 + dz * 0.85 + (dz < 0 ? -6 : 6)], color: '#8b5a2b', material: 'Wood' });
  }
  // counters along the wall, with open cupboards under them
  for (let i = 0; i < 4; i++) {
    const z = -66 + i * 30;
    hollow(k, 'Cupboard', [KX + 98, 1, z], [20, 22, 26], '#f4f4f4', 'SmoothPlastic', 'left', 1.5);
  }
  part(k, { name: 'Counter', size: [24, 3, 124], pos: [KX + 98, 24.5, -21], color: '#6b6b6b', material: 'Marble' });
  ladder(k, KX + 84, -80, 26);
  // the fridge (with a gap behind it) and a stove
  part(k, { name: 'Fridge', size: [26, 70, 24], pos: [KX + 92, 36, 62], color: '#e8e8e8', material: 'Metal' });
  part(k, { name: 'Stove', size: [24, 24, 24], pos: [KX - 90, 13, -72], color: '#2a2a2a', material: 'Metal' });
  // things on the floor and on the table
  part(k, { name: 'CerealBox', size: [14, 22, 5], pos: [KX - 64, 12, -50], color: '#ff9f1a', rot: [0, 20, 0] });
  part(k, { name: 'CerealBox', size: [14, 22, 5], pos: [KX - 40, 41, 18], color: '#e8413c' });
  part(k, { name: 'Mug', size: [10, 12, 10], pos: [KX - 18, 36, 2], color: '#00a2ff', shape: 'Cylinder', rot: [0, 0, 90] });
  part(k, { name: 'Plate', size: [1.2, 20, 20], pos: [KX - 46, 30.6, 0], color: '#ffffff', shape: 'Cylinder', rot: [0, 0, 90] });
  part(k, { name: 'Toaster', size: [16, 12, 10], pos: [KX + 98, 32, -60], color: '#c0c0c0', material: 'Metal' });
  part(k, { name: 'TrashCan', size: [14, 20, 14], pos: [KX - 96, 11, 70], color: '#4b974b', shape: 'Cylinder', rot: [0, 0, 90] });
  hollow(k, 'ShoeBox', [KX - 60, 1, 64], [22, 10, 14], '#c4a484', 'Wood', 'top');
  part(k, { name: 'Rug', size: [50, 0.3, 36], pos: [KX - 30, 1.15, 10], color: '#a83f3f', material: 'Fabric', canCollide: false });
  for (const [x, z] of [[KX - 60, -60], [KX + 20, -60], [KX + 20, 60]]) part(k, { name: 'Lamp', size: [8, 1, 8], pos: [x, 88, z], color: '#fff1c4', material: 'Neon' });
  spawns(k, [[KX - 80, -40], [KX - 80, 40], [KX - 30, -60], [KX - 30, 70], [KX + 30, -40], [KX + 30, 40], [KX + 60, 0], [KX - 60, 0], [KX + 10, 75], [KX + 10, -75]]);
  part(k, { name: 'SeekerStart', size: [2, 1, 2], pos: [KX + 40, 2, 0], transparency: 1, canCollide: false });

  // ---------------------------------------------------------------- map 2: Giant Bedroom
  const b = model(maps, 'Giant Bedroom');
  const BX = -320;
  room(b, BX, 200, 170, 85, '#8a6a4a', '#c9d9f2', 'WoodPlanks');
  part(b, { name: 'Carpet', size: [90, 0.3, 70], pos: [BX + 10, 1.15, 0], color: '#ff9ccf', material: 'Fabric', canCollide: false });
  // the bed: a frame on legs (room under it) with a mattress
  table(b, 'BedFrame', [BX - 50, 40], [60, 80], 12, '#6b4a2f', 3, 4);
  part(b, { name: 'Mattress', size: [58, 8, 78], pos: [BX - 50, 16, 40], color: '#ffffff', material: 'Fabric' });
  part(b, { name: 'Blanket', size: [60, 2, 50], pos: [BX - 50, 21, 52], color: '#7b5cff', material: 'Fabric' });
  part(b, { name: 'Pillow', size: [20, 5, 12], pos: [BX - 62, 22, 8], color: '#f2f2f2', material: 'Fabric' });
  part(b, { name: 'Pillow', size: [20, 5, 12], pos: [BX - 38, 22, 8], color: '#f2f2f2', material: 'Fabric' });
  ladder(b, BX - 82, 40, 20);
  // the wardrobe (open), the toy box, the desk, the bookshelf
  hollow(b, 'Wardrobe', [BX + 80, 1, 60], [34, 70, 30], '#5a3b1e', 'Wood', 'left', 2);
  hollow(b, 'ToyBox', [BX + 30, 1, -60], [30, 14, 22], '#e8413c', 'SmoothPlastic', 'top');
  table(b, 'Desk', [BX + 60, -55], [44, 24], 24, '#c4a484', 2, 3);
  hollow(b, 'Bookshelf', [BX - 85, 1, -50], [24, 60, 20], '#4a2f1a', 'Wood', 'right', 2);
  for (let i = 1; i <= 3; i++) part(b, { name: 'Shelf', size: [22, 1.5, 18], pos: [BX - 85, 1 + i * 15, -50], color: '#4a2f1a', material: 'Wood' });
  // toys all over the floor
  const blocks = ['#e8413c', '#00a2ff', '#f5cd30', '#4b974b', '#ff66cc', '#7b5cff'];
  for (let i = 0; i < 8; i++) part(b, { name: 'ToyBlock', size: [9, 9, 9], pos: [BX - 10 + (i % 4) * 12, 5.5 + (i > 5 ? 9 : 0), -20 + Math.floor(i / 4) * 14], color: blocks[i % blocks.length], rot: [0, i * 17, 0] });
  part(b, { name: 'Ball', size: [16, 16, 16], pos: [BX + 40, 9, 10], color: '#ff9f1a', shape: 'Ball' });
  part(b, { name: 'Lamp', size: [10, 1, 10], pos: [BX, 83, 0], color: '#fff1c4', material: 'Neon' });
  spawns(b, [[BX - 70, -30], [BX - 20, -60], [BX + 10, 40], [BX + 60, 20], [BX + 70, -20], [BX - 10, 70], [BX + 30, 70], [BX - 40, -10], [BX + 50, -75], [BX - 85, 70]]);
  part(b, { name: 'SeekerStart', size: [2, 1, 2], pos: [BX + 20, 2, 0], transparency: 1, canCollide: false });

  // ---------------------------------------------------------------- the game
  script(g.ServerScriptService, 'HideAndSeek', `
-- Hide and Seek Extreme. Intermission, a map, one IT, 25 s to hide, then
-- IT hunts for 2:30. Touch a hider to find them. Found players go back to the
-- lobby. IT wins if nobody is left; the hiders who stay hidden win otherwise.
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local store = game:GetService("DataStoreService"):GetDataStore("HideSeekExtreme")
local hint = Instance.new("Hint", workspace)
local HIDE, ROUND = 25, 150
local seeker, map = nil, nil
local hiders = {}
local running = false

local function msg(text, secs)
	local m = Instance.new("Message")
	m.Text = text
	m.Parent = workspace
	Debris:AddItem(m, secs or 4)
end

local function setRole(p, r)
	local v = p:FindFirstChild("Role")
	if not v then
		v = Instance.new("StringValue")
		v.Name = "Role"
		v.Parent = p
	end
	v.Value = r
end

local function rootOf(p) return p.Character and p.Character:FindFirstChild("HumanoidRootPart") end
local function moveTo(p, pos)
	local r = rootOf(p)
	if r then r.CFrame = CFrame.new(pos + Vector3.new(0, 3, 0)) end
end

local function saveStats(p)
	local ls = p:FindFirstChild("leaderstats")
	if ls then pcall(function() store:SetAsync("u" .. p.UserId, { coins = ls.Coins.Value, wins = ls.Wins.Value }) end) end
end

local function count()
	local n = 0
	for p in pairs(hiders) do if p.Parent then n = n + 1 end end
	return n
end

local function found(p, how)
	if not hiders[p] then return end
	hiders[p] = nil
	setRole(p, "Found")
	msg(p.Name .. (how or " was found!"), 2)
	p:ShowMessage("You were found!", 3, Color3.fromRGB(255, 90, 90))
	if seeker and seeker.Parent and how == nil then seeker.leaderstats.Coins.Value = seeker.leaderstats.Coins.Value + 3 end
	local spawn = workspace.Lobby.LobbySpawn
	moveTo(p, spawn.Position)
	if count() == 0 then running = false end
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
	setRole(p, "Lobby")
	p.CharacterAdded:Connect(function(char)
		local h = char:WaitForChild("Humanoid")
		-- names over heads would give everyone away
		h.NameDisplayDistance = 0
		h.Died:Connect(function() if hiders[p] then found(p, " fell out of the house!") end end)
	end)
	if running then p:Notify("A round is on - you'll play in the next one.") end
end)

Players.PlayerRemoving:Connect(function(p)
	saveStats(p)
	hiders[p] = nil
	if p == seeker then running = false; seeker = nil end
	if count() == 0 then running = false end
end)

local function shuffle(t)
	for i = #t, 2, -1 do local j = math.random(1, i); t[i], t[j] = t[j], t[i] end
	return t
end

while true do
	local players = Players:GetPlayers()
	if #players < 2 then
		hint.Text = "Waiting for players... (Hide and Seek needs at least 2)"
		wait(2)
	else
		for i = 15, 1, -1 do
			hint.Text = "Intermission: " .. i
			wait(1)
		end
		players = shuffle(Players:GetPlayers())
		if #players >= 2 then
			local all = workspace.Maps:GetChildren()
			map = all[math.random(1, #all)]
			hiders = {}
			seeker = players[1]
			local spots = shuffle(map.Spawns:GetChildren())
			for i, p in ipairs(players) do
				if p == seeker then
					setRole(p, "It")
					moveTo(p, workspace.Lobby.Cage.CageSpot.Position)
					p:ShowMessage("You are IT! Count to " .. HIDE .. "...", 4, Color3.fromRGB(255, 70, 70))
					local head = p.Character and p.Character:FindFirstChild("Head")
					if head then
						local tag = Instance.new("BillboardText")
						tag.Name = "ItTag"
						tag.Text = "IT"
						tag.TextSize = 22
						tag.Parent = head
					end
				else
					setRole(p, "Hider")
					hiders[p] = true
					moveTo(p, spots[((i - 2) % #spots) + 1].Position)
					p:ShowMessage("HIDE! " .. seeker.Name .. " is IT", 4, Color3.fromRGB(90, 220, 110))
				end
			end
			msg("Map: " .. map.Name, 3)
			for t = HIDE, 1, -1 do
				if not seeker or not seeker.Parent then break end
				hint.Text = "Hide! " .. seeker.Name .. " is let out in " .. t
				wait(1)
			end
			if seeker and seeker.Parent then
				moveTo(seeker, map.SeekerStart.Position)
				local h = seeker.Character and seeker.Character:FindFirstChild("Humanoid")
				if h then h.WalkSpeed = 19 end
				msg("Ready or not, here I come!", 3)
				running = count() > 0
			end
			local t = ROUND
			while running and t > 0 do
				hint.Text = map.Name .. "   |   " .. count() .. " hiding   |   " .. math.floor(t / 60) .. ":" .. string.format("%02d", t % 60)
				-- four looks a second: IT touches whoever is close
				for _ = 1, 4 do
					local sr = rootOf(seeker)
					if not sr then running = false; break end
					for p in pairs(hiders) do
						local r = rootOf(p)
						if r and (r.Position - sr.Position).Magnitude < 5.5 then found(p) end
					end
					if not running then break end
					wait(0.25)
				end
				t = t - 1
			end
			running = false
			local left = count()
			if seeker and seeker.Parent and left == 0 then
				msg(seeker.Name .. " found everyone and wins!", 5)
				seeker.leaderstats.Wins.Value = seeker.leaderstats.Wins.Value + 1
				seeker.leaderstats.Coins.Value = seeker.leaderstats.Coins.Value + 15
			else
				msg(left .. " hider" .. (left == 1 and "" or "s") .. " stayed hidden and win!", 5)
				for p in pairs(hiders) do
					if p.Parent then
						p.leaderstats.Wins.Value = p.leaderstats.Wins.Value + 1
						p.leaderstats.Coins.Value = p.leaderstats.Coins.Value + 10
					end
				end
			end
			hint.Text = "Round over"
			wait(5)
			hiders, seeker = {}, nil
			for _, p in ipairs(Players:GetPlayers()) do
				setRole(p, "Lobby")
				saveStats(p)
				p:LoadCharacter()
			end
		end
	end
end
`);
  return finish(g, { name: 'Hide and Seek Extreme' });
}

export const HIDE_GAMES = [
  { key: 'hideseek', name: 'Hide and Seek Extreme', build: gameHideSeek, genre: 'Adventure', featured: true, maxPlayers: 12,
    visits: 98240, up: 3120, down: 210, favorites: 6400,
    description: 'You are tiny and the house is HUGE. Hide under the giant table, in the cupboards or behind the cereal box - IT is coming to find you! Stay hidden until the time runs out to win.' },
];
