// The Hunt: Lost Relics - the event hub: an expedition camp in the jungle at
// the foot of the Great Temple. Every stone archway leads to a game and shows
// that game's quest. In the hub: the rune puzzle (4 clue tablets hidden around
// the hub tell the order of the runes), the relic museum with the prizes, and
// the Great Temple that opens when all players together complete enough quests.
// Rebuilt whenever the list of games or prizes changes (server/hunt.js).
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish, tree } from './builder.js';

const STONE = '#8f8a74';
const STONE2 = '#77725e';
const MOSS = '#4f7a3a';
const GOLD = '#ffc94a';
const JADE = '#5bd6a0';
const COLORS = ['#5bd6a0', '#ffc94a', '#ff8a3d', '#6fb7ff', '#e86a6a', '#c58cff', '#9be06b', '#ffd27a'];

function light(p, color, range = 16, brightness = 1.2) {
  inst(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
}

function torch(parent, x, y, z) {
  part(parent, { name: 'TorchPole', size: [0.6, 5, 0.6], pos: [x, y + 2.5, z], color: '#5a3b1e', material: 'Wood' });
  const bowl = part(parent, { name: 'TorchBowl', size: [1.4, 0.6, 1.4], pos: [x, y + 5.2, z], color: '#3a3a3a', material: 'Metal' });
  inst(bowl, 'Fire', { Size: 2 });
}

// A clue tablet: a stone slab with a line of the riddle.
function tablet(parent, name, x, y, z, yaw, text) {
  const t = part(parent, { name, size: [4, 5, 0.8], pos: [x, y + 2.5, z], rot: [0, yaw, 0], color: '#a39d84', material: 'Slate' });
  inst(t, 'BillboardText', { Text: text, StudsOffset: new Vector3(0, 3.6, 0) });
  part(parent, { name: name + 'Glyph', size: [2.4, 2.4, 0.2], pos: [x + Math.sin((yaw * Math.PI) / 180) * 0.45, y + 2.8, z + Math.cos((yaw * Math.PI) / 180) * 0.45], rot: [0, yaw, 45], color: JADE, material: 'Neon', canCollide: false });
  return t;
}

// games: [{ id, name, byPlayer, creator, quest }], prizes: [{ name, need | how, bonus }]
export function buildRelicsHub(games, prizes = []) {
  const g = newGame();
  const ws = g.Workspace;
  const L = g.Lighting;
  L.ClockTime = 17.2;
  L.Brightness = 1.1;
  L.Ambient = Color3.fromRGB(120, 110, 80);
  L.OutdoorAmbient = Color3.fromRGB(120, 120, 90);
  L.FogEnd = 650;
  L.FogColor = Color3.fromRGB(150, 170, 120);

  const n = Math.max(games.length, 1);
  const R = Math.max(100, Math.ceil((n * 19) / (2 * Math.PI)));
  const size = R * 2 + 120;
  part(ws, { name: 'Jungle', size: [size, 4, size], pos: [0, -2, 0], color: '#3f6b2a', material: 'Grass', props: { Locked: true } });

  // ---------------------------------------------------------------- the Great Temple
  const temple = model(ws, 'GreatTemple');
  const tiers = [[60, 6], [46, 12], [32, 18], [18, 24]];
  tiers.forEach(([w, top], i) => {
    part(temple, { name: 'Tier', size: [w, 6, w], pos: [0, top - 3, 0], color: i % 2 ? STONE2 : STONE, material: 'Cobblestone' });
    part(temple, { name: 'Moss', size: [w + 0.2, 0.6, w + 0.2], pos: [0, top - 0.1, 0], color: MOSS, material: 'Grass', canCollide: false });
  });
  // the stairs up the front (+z)
  for (let i = 0; i < 16; i++) {
    const y = (i + 1) * 1.5;
    const z = 44 - i * 2.2;
    part(temple, { name: 'Stair', size: [8, y, 2.3], pos: [0, y / 2, z], color: i % 2 ? STONE : STONE2, material: 'Slate' });
  }
  for (const s of [-1, 1]) part(temple, { cls: 'WedgePart', name: 'StairSide', size: [1.2, 24, 36], pos: [s * 4.6, 12, 27], rot: [0, 180, 0], color: STONE2, material: 'Slate' });
  // the shrine on top with its sealed door (opens for the team goal)
  part(temple, { name: 'ShrineBack', size: [14, 10, 2], pos: [0, 29, -6], color: STONE2, material: 'Cobblestone' });
  for (const s of [-1, 1]) part(temple, { name: 'ShrineWall', size: [2, 10, 10], pos: [s * 6, 29, -1], color: STONE2, material: 'Cobblestone' });
  part(temple, { name: 'ShrineRoof', size: [16, 2, 14], pos: [0, 35, -1], color: STONE, material: 'Cobblestone' });
  const door = part(temple, { name: 'SealedDoor', size: [10, 10, 1], pos: [0, 29, 4], color: '#5c5747', material: 'Slate' });
  inst(door, 'BillboardText', { Text: 'THE GREAT TEMPLE', StudsOffset: new Vector3(0, 8, 0) });
  const treasure = part(temple, { name: 'Treasure', size: [3, 3, 3], pos: [0, 26, -2], rot: [45, 0, 45], color: GOLD, material: 'Neon', canCollide: false });
  light(treasure, GOLD, 22, 0);
  const goalSign = part(temple, { name: 'GoalSign', size: [1, 1, 1], pos: [0, 40, 4], transparency: 1, canCollide: false });
  inst(goalSign, 'BillboardText', { Text: 'Open the Great Temple together!' });
  torch(temple, -7, 24, 8);
  torch(temple, 7, 24, 8);

  // ---------------------------------------------------------------- the rune puzzle
  const runes = model(ws, 'RuneStones');
  const RUNES = [['SUN', '#ffb347'], ['MOON', '#b8c8ff'], ['STAR', '#fff36b'], ['WAVE', '#5bc8ff']];
  RUNES.forEach(([name, col], i) => {
    const x = -15 + i * 10;
    part(runes, { name: name + 'Base', size: [4, 2, 4], pos: [x, 1, 54], color: STONE2, material: 'Slate' });
    const r = part(runes, { name, size: [3, 4, 1.2], pos: [x, 4, 54], color: col, material: 'Neon' });
    inst(r, 'ClickDetector', { MaxActivationDistance: 18 });
    inst(r, 'BillboardText', { Text: name, StudsOffset: new Vector3(0, 3.2, 0) });
  });
  const puzzleSign = part(runes, { name: 'PuzzleSign', size: [1, 1, 1], pos: [0, 10, 54], transparency: 1, canCollide: false });
  inst(puzzleSign, 'BillboardText', { Text: 'RUNE PUZZLE: find the 4 clue tablets, then click the runes in the right order' });

  // the clue tablets, hidden around the hub (the riddle tells the order)
  const clues = folder(ws, 'ClueTablets');
  tablet(clues, 'Clue1', -34, 0, 84, 30, 'I. The SUN wakes the jungle first...');
  tablet(clues, 'Clue2', -3.5, 24, 7.5, 0, 'II. ...then a STAR shows the way to the top...');
  // a ruin in the west
  const ruin = model(ws, 'Ruin');
  for (const [x, z, sx, sz, h] of [[-66, -12, 16, 2, 7], [-74, -4, 2, 14, 5], [-58, -4, 2, 14, 9], [-70, 4, 6, 2, 4]]) {
    part(ruin, { name: 'RuinWall', size: [sx, h, sz], pos: [x, h / 2, z], color: STONE2, material: 'Cobblestone' });
  }
  for (const [x, z, h] of [[-80, -20, 10], [-52, 10, 6], [-60, -24, 12]]) part(ruin, { name: 'BrokenPillar', size: [3, h, 3], pos: [x, h / 2, z], color: STONE, material: 'Cobblestone' });
  tablet(clues, 'Clue3', -66, 0, -6, 180, 'III. ...the WAVE washes the old path clean...');
  // a waterfall in the east, with the last tablet behind it
  const falls = model(ws, 'Waterfall');
  part(falls, { name: 'Cliff', size: [30, 26, 12], pos: [70, 13, -40], color: '#6e6a58', material: 'Slate' });
  part(falls, { name: 'Pool', size: [22, 0.6, 14], pos: [70, 0.2, -27], color: '#3a8fd0', material: 'Glass', transparency: 0.3, canCollide: false });
  part(falls, { name: 'Water', size: [10, 24, 1], pos: [70, 12, -33.4], color: '#6fc3ff', material: 'Glass', transparency: 0.45, canCollide: false });
  part(falls, { name: 'Cave', size: [8, 8, 4], pos: [70, 4, -35], color: '#2a271f', material: 'Slate', canCollide: false });
  tablet(clues, 'Clue4', 70, 0, -36.2, 0, 'IV. ...and the MOON closes the door.');

  // ---------------------------------------------------------------- the camp and the museum
  part(ws, { cls: 'SpawnLocation', name: 'Spawn', size: [10, 1, 10], pos: [0, 0.5, 80], color: '#c8a165', material: 'WoodPlanks', top: 'Smooth', props: { Duration: 0 } });
  const camp = model(ws, 'Camp');
  for (const [x, z, yaw, col] of [[-30, 78, 20, '#c8a165'], [30, 78, -20, '#7a8f5a'], [-24, 96, 0, '#b0784a']]) {
    part(camp, { cls: 'WedgePart', name: 'Tent', size: [8, 5, 5], pos: [x - Math.sin((yaw * Math.PI) / 180) * 2.5, 2.5, z + 2.5], rot: [0, yaw, 0], color: col, material: 'Fabric' });
    part(camp, { cls: 'WedgePart', name: 'Tent', size: [8, 5, 5], pos: [x + Math.sin((yaw * Math.PI) / 180) * 2.5, 2.5, z - 2.5], rot: [0, yaw + 180, 0], color: col, material: 'Fabric' });
  }
  const fire = part(camp, { name: 'Campfire', size: [3, 0.8, 3], pos: [-20, 0.4, 88], color: '#4a2f1a', material: 'Wood' });
  inst(fire, 'Fire', { Size: 4 });
  light(fire, '#ff9a4a', 24, 1.5);
  for (const [x, z] of [[24, 92], [27, 94], [24, 95]]) part(camp, { name: 'Crate', size: [3, 3, 3], pos: [x, 1.5, z], rot: [0, x * 7, 0], color: '#9a6b3a', material: 'WoodPlanks' });
  const board = part(camp, { name: 'QuestBoard', size: [14, 7, 0.6], pos: [14, 5, 86], rot: [0, -15, 0], color: '#6b4a2f', material: 'WoodPlanks' });
  for (const x of [8, 20]) part(camp, { name: 'BoardPost', size: [0.8, 9, 0.8], pos: [x, 4.5, 86 + (x - 14) * 0.27], color: '#4a2f1a', material: 'Wood' });
  inst(board, 'BillboardText', { Text: `${games.length} archways - ${games.length} quests - ${prizes.length} prizes`, StudsOffset: new Vector3(0, 5, 0) });
  const board2 = part(camp, { name: 'QuestBoardText', size: [1, 1, 1], pos: [14, 6, 85.4], transparency: 1, canCollide: false });
  inst(board2, 'BillboardText', { Text: 'Walk through an archway: every game has its own quest. Finish it to get the relic!' });

  if (prizes.length) {
    const museum = model(ws, 'RelicMuseum');
    prizes.forEach((p, i) => {
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      const px = side * 24, pz = 46 + row * 8;
      const col = p.bonus ? JADE : COLORS[i % COLORS.length];
      part(museum, { name: 'Pedestal', size: [3.4, 3, 3.4], pos: [px, 1.5, pz], color: STONE, material: 'Cobblestone' });
      part(museum, { name: 'PedestalTop', size: [3.8, 0.4, 3.8], pos: [px, 3.2, pz], color: GOLD, material: 'Metal' });
      const orb = part(museum, { name: 'Prize', size: [1.8, 1.8, 1.8], pos: [px, 4.6, pz], rot: [45, 0, 45], color: col, material: 'Neon', canCollide: false });
      inst(orb, 'BillboardText', { Text: p.bonus ? `BONUS: ${p.name}` : `${p.need}: ${p.name}`, StudsOffset: new Vector3(0, 2.2, 0) });
    });
  }

  // ---------------------------------------------------------------- archways to the games
  const portals = folder(ws, 'Portals');
  games.forEach((game, i) => {
    // around the temple, never right behind the camp
    const a = Math.PI + ((i + 0.5) / n) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const yaw = (a * 180) / Math.PI;
    const c = game.byPlayer ? '#ff8ad6' : COLORS[i % COLORS.length];
    const m = model(portals, game.name);
    const mid = (R + 40) / 2, len = R - 46;
    if (len > 2) part(m, { name: 'Path', size: [6, 0.2, len], pos: [Math.sin(a) * mid, 0.1, Math.cos(a) * mid], rot: [0, yaw, 0], color: '#a8946a', material: 'Slate', canCollide: false });
    for (const s of [-1, 1]) {
      const px = x + Math.cos(a) * s * 6, pz = z - Math.sin(a) * s * 6;
      part(m, { name: 'Pillar', size: [2.6, 14, 2.6], pos: [px, 7, pz], rot: [0, yaw, 0], color: STONE, material: 'Cobblestone' });
      part(m, { name: 'Vine', size: [2.8, 6, 2.8], pos: [px, 9, pz], rot: [0, yaw, 0], color: MOSS, material: 'Grass', canCollide: false, transparency: 0.2 });
      torch(m, x + Math.cos(a) * s * 8.5 + Math.sin(a) * 2, 0, z - Math.sin(a) * s * 8.5 + Math.cos(a) * 2);
    }
    part(m, { name: 'Lintel', size: [15, 3, 3], pos: [x, 15.5, z], rot: [0, yaw, 0], color: STONE2, material: 'Cobblestone' });
    part(m, { name: 'Gem', size: [1.6, 1.6, 1.6], pos: [x, 15.5, z], rot: [45, yaw, 45], color: c, material: 'Neon', canCollide: false });
    const gate = part(m, { name: 'Portal', size: [9.4, 13, 0.6], pos: [x, 6.5, z], rot: [0, yaw, 0], color: c, material: 'Neon', transparency: 0.55, canCollide: false });
    inst(gate, 'IntValue', { Name: 'PlaceId', Value: game.id });
    inst(gate, 'BillboardText', { Text: game.name + (game.byPlayer ? '  (by ' + game.creator + ')' : ''), StudsOffset: new Vector3(0, 12.5, 0) });
    const q = part(m, { name: 'QuestText', size: [1, 1, 1], pos: [x, 18.5, z], transparency: 1, canCollide: false });
    inst(q, 'BillboardText', { Text: 'Quest: ' + (game.quest || 'Complete the quest'), TextSize: 16, StudsOffset: new Vector3(0, 0, 0) });
  });

  // ---------------------------------------------------------------- jungle
  const jungle = folder(ws, 'Trees');
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + 0.07;
    const r = R + 18 + (i % 3) * 10;
    if (Math.abs(Math.sin(a) * r) > size / 2 - 8 || Math.abs(Math.cos(a) * r) > size / 2 - 8) continue;
    tree(jungle, Math.sin(a) * r, Math.cos(a) * r, 0, 1.1 + (i % 4) * 0.2);
  }
  for (const [x, z] of [[-45, 40], [45, 40], [-50, -55], [40, -70], [-88, 40], [88, 20], [-30, -80], [20, 60]]) tree(jungle, x, z, 0, 1.3);

  script(g.ServerScriptService, 'Relics', `
-- The Hunt: Lost Relics hub. Archways to the games (each has its own quest),
-- the rune puzzle and the Great Temple that everyone opens together.
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local Hunt = game:GetService("HuntService")

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local relics = Instance.new("StringValue")
	relics.Name = "Relics"
	local p = Hunt:GetProgress(player.UserId)
	relics.Value = p.Collected .. "/" .. p.Total
	relics.Parent = ls
	wait(1.5)
	player:Notify("Welcome to The Hunt: Lost Relics! Every archway leads to a game with its own quest. You have " .. p.Collected .. " of " .. p.Total .. " relics.")
end)

-- archways
local busy = {}
for _, portal in ipairs(workspace.Portals:GetDescendants()) do
	if portal.Name == "Portal" then
		portal.Touched:Connect(function(hit)
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if not player or busy[player] then return end
			busy[player] = true
			player:Notify("Off to " .. portal.Parent.Name .. "! Your quest is waiting...")
			wait(0.5)
			TeleportService:Teleport(portal.PlaceId.Value, player)
			wait(3)
			busy[player] = nil
		end)
	end
end

-- the rune puzzle: SUN, STAR, WAVE, MOON (the clue tablets say so)
local ORDER = {"SUN", "STAR", "WAVE", "MOON"}
local step = {}
Players.PlayerRemoving:Connect(function(p) step[p] = nil end)
for _, name in ipairs({"SUN", "MOON", "STAR", "WAVE"}) do
	local rune = workspace.RuneStones[name]
	rune.ClickDetector.MouseClick:Connect(function(player)
		local n = (step[player] or 0) + 1
		if ORDER[n] == name then
			step[player] = n
			if n == 4 then
				step[player] = 0
				local r = Hunt:CompleteHubQuest(player)
				if r.Prize ~= "" then
					player:Notify("The runes blaze with light! You solved the puzzle and won: " .. r.Prize .. "!")
				else
					player:Notify("The runes blaze with light! You solved the rune puzzle.")
				end
			else
				player:Notify("The " .. name .. " rune glows... (" .. n .. "/4)")
			end
		else
			step[player] = 0
			player:Notify("The runes go dark. That was not the right order - read the clue tablets!")
		end
	end)
end

-- the Great Temple opens when everyone together has done enough quests
local door = workspace.GreatTemple.SealedDoor
local sign = workspace.GreatTemple.GoalSign.BillboardText
local treasure = workspace.GreatTemple.Treasure
while true do
	local g = Hunt:GetGlobal()
	if g.Open then
		door.Transparency = 1
		door.CanCollide = false
		treasure.PointLight.Brightness = 2
		sign.Text = "THE GREAT TEMPLE IS OPEN! (" .. g.Shards .. " quests done by everyone)"
	else
		sign.Text = "Great Temple: " .. g.Shards .. " / " .. g.Goal .. " quests done by everyone"
	end
	wait(10)
end
`);
  return finish(g, { name: 'The Hunt: Lost Relics' });
}
