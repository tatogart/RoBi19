// The Hunt: Another Dimension - the event hub, a space station floating in
// another dimension. Wormholes lead to every game of the event (a dimension
// shard is hidden in each, placed by GameServer._spawnHuntToken). The hub has
// its own things to do: low gravity, launch pads up to floating asteroids,
// 6 star fragments to collect, a rocket to the moon base, meteor showers, a
// zero-g button and the Rift that everyone fills together.
// Rebuilt whenever the list of games or prizes changes (server/hunt.js).
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

const COLORS = ['#b45cff', '#00e5ff', '#ff4d8d', '#7dffb0', '#ffd27a', '#5a8bff', '#ff8a3d', '#e0a8ff'];
const PURPLE = '#b45cff';
const CYAN = '#00e5ff';
const DECK = '#5b6283';

function light(p, color, range = 18, brightness = 1.5) {
  inst(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
}

// the same "random" sky every build, so the place only changes when the games do
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// a disc (Cylinder lying flat): x, y = top surface, z
function disc(parent, name, x, y, z, d, h, color, material, o = {}) {
  return part(parent, { name, size: [h, d, d], pos: [x, y - h / 2, z], rot: [0, 0, 90], color, material, shape: 'Cylinder', ...o });
}

// A ring of glowing blocks standing up, facing the angle `a` (radians).
function ringOfBlocks(parent, cx, cy, cz, a, r, n, color, size = 1.6) {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const lx = Math.cos(t) * r, ly = Math.sin(t) * r;
    // the ring lies in the plane facing the centre: sideways is (cos a, 0, -sin a)
    part(parent, {
      name: 'Ring', size: [size, size, size * 0.8], pos: [cx + Math.cos(a) * lx, cy + ly, cz - Math.sin(a) * lx],
      rot: [0, (a * 180) / Math.PI, (t * 180) / Math.PI], color, material: 'Neon', canCollide: false,
    });
  }
}

// prizes: [{ name, need | how }] for the prize ring
export function buildHuntHub(games, prizes = [], opts = {}) {
  const FRAGS = opts.fragments || 6;
  const g = newGame();
  const ws = g.Workspace;
  ws.Gravity = 75; // low gravity everywhere in the hub
  const L = g.Lighting;
  L.ClockTime = 0;
  L.Brightness = 0.8;
  L.Ambient = Color3.fromRGB(105, 95, 155);
  L.OutdoorAmbient = Color3.fromRGB(95, 85, 145);
  L.FogEnd = 1500;
  L.FogColor = Color3.fromRGB(8, 4, 24);
  const rand = rng(4242);

  // ---------------------------------------------------------------- space
  const sky = folder(ws, 'Space');
  for (let i = 0; i < 70; i++) {
    const yaw = rand() * Math.PI * 2, pitch = -0.35 + rand() * 1.3;
    const r = 520 + rand() * 120;
    const col = ['#ffffff', '#cfe8ff', '#ffe9c4', '#e0c8ff'][i % 4];
    part(sky, { name: 'Star', size: [1.6 + rand() * 2, 1.6 + rand() * 2, 1.6 + rand() * 2], pos: [Math.sin(yaw) * Math.cos(pitch) * r, 40 + Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r], color: col, material: 'Neon', shape: 'Ball', canCollide: false });
  }
  const giant = part(sky, { name: 'GasGiant', size: [190, 190, 190], pos: [-300, 140, -420], color: '#6b3fa0', material: 'SmoothPlastic', shape: 'Ball', canCollide: false });
  light(giant, '#b45cff', 60, 0.6);
  part(sky, { name: 'GasGiantRing', size: [2, 330, 330], pos: [-300, 140, -420], rot: [0, 20, 72], color: '#e0a8ff', material: 'Neon', shape: 'Cylinder', transparency: 0.7, canCollide: false });
  part(sky, { name: 'RedPlanet', size: [80, 80, 80], pos: [340, 70, -260], color: '#c4501c', material: 'Slate', shape: 'Ball', canCollide: false });
  part(sky, { name: 'IcePlanet', size: [56, 56, 56], pos: [220, 190, 340], color: '#7df9ff', material: 'Ice', shape: 'Ball', canCollide: false });
  const moon = part(sky, { name: 'Moon', size: [20, 20, 20], pos: [130, 70, 0], color: '#a8a8b8', material: 'Slate', shape: 'Ball', canCollide: false });
  light(moon, '#cfe8ff', 30, 0.8);

  // ---------------------------------------------------------------- the station
  const st = model(ws, 'Station');
  disc(st, 'Deck', 0, 1, 0, 88, 2, DECK, 'DiamondPlate', { props: { Locked: true } });
  disc(st, 'DeckRim', 0, 0.6, 0, 92, 1.4, CYAN, 'Neon', { canCollide: false });
  disc(st, 'Inlay', 0, 1.06, 0, 30, 0.1, '#1a1030', 'Marble', { canCollide: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(st, { name: 'Rock', size: [26, 14, 22], pos: [Math.sin(a) * 22, -8, Math.cos(a) * 22], rot: [i * 13, i * 60, i * 7], color: '#3a3346', material: 'Slate' });
  }
  part(st, { name: 'Rock', size: [30, 22, 30], pos: [0, -18, 0], rot: [12, 30, 8], color: '#332c40', material: 'Slate' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    part(st, { name: 'Light', size: [1.2, 0.3, 1.2], pos: [Math.sin(a) * 42, 1.15, Math.cos(a) * 42], color: i % 2 ? CYAN : PURPLE, material: 'Neon', canCollide: false });
  }
  // lamp posts over the deck
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = Math.sin(a) * 18, lz = Math.cos(a) * 18;
    part(st, { name: 'LampPost', size: [0.8, 14, 0.8], pos: [lx, 8, lz], color: '#1e2236', material: 'Metal' });
    const bulb = part(st, { name: 'Lamp', size: [2.4, 2.4, 2.4], pos: [lx, 15.6, lz], color: '#e6f6ff', material: 'Neon', shape: 'Ball', canCollide: false });
    light(bulb, '#cfe8ff', 40, 1.6);
  }
  part(ws, { cls: 'SpawnLocation', name: 'Spawn', size: [10, 1, 10], pos: [0, 1.5, 33], color: PURPLE, material: 'Neon', top: 'Smooth', props: { Duration: 0 } });

  // ---------------------------------------------------------------- the Rift (centre)
  const rift = model(ws, 'Rift');
  disc(rift, 'RiftBase', 0, 1.6, 0, 22, 0.6, '#1a1030', 'Marble');
  disc(rift, 'RiftGlow', 0, 1.7, 0, 18, 0.2, PURPLE, 'Neon', { canCollide: false });
  const ringM = model(rift, 'RiftRing');
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    part(ringM, { name: 'Segment', size: [2.2, 2.2, 1.6], pos: [Math.cos(t) * 9, 13 + Math.sin(t) * 9, 0], rot: [0, 0, (t * 180) / Math.PI], color: i % 2 ? PURPLE : CYAN, material: 'Neon', canCollide: false });
  }
  const core = part(rift, { name: 'RiftCore', size: [0.6, 16, 16], pos: [0, 13, 0], rot: [0, 90, 0], color: '#5a1aa0', material: 'Neon', shape: 'Cylinder', transparency: 0.35, canCollide: false });
  inst(core, 'Sparkles', { SparkleColor: Color3.fromHex('#e0a8ff') });
  light(core, PURPLE, 60, 2.5);
  const label = part(rift, { name: 'RiftLabel', size: [1, 1, 1], pos: [0, 26, 0], transparency: 1, canCollide: false });
  inst(label, 'BillboardText', { Text: 'THE RIFT', StudsOffset: new Vector3(0, 0, 0) });
  const energy = part(rift, { name: 'RiftEnergy', size: [1, 1, 1], pos: [0, 24, 0], transparency: 1, canCollide: false });
  inst(energy, 'BillboardText', { Text: 'Rift energy: ...', StudsOffset: new Vector3(0, 0, 0) });
  // floating stepping stones spiral up over the rift (star fragment on top)
  const steps = model(ws, 'SkySteps');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 1.6 + Math.PI * 0.25;
    disc(steps, 'Stone', Math.sin(a) * 14, 5 + i * 4.5, Math.cos(a) * 14, 6, 1.2, i % 2 ? '#4a3f6b' : '#3a3346', 'Slate');
  }
  disc(steps, 'Top', 0, 38, 0, 10, 1.2, '#4a3f6b', 'Slate');

  // ---------------------------------------------------------------- info board + zero-g button
  const board = model(ws, 'InfoBoard');
  part(board, { name: 'Board', size: [24, 10, 1], pos: [0, 7, 41], color: '#0b0a2a', material: 'SmoothPlastic' });
  part(board, { name: 'Frame', size: [25, 11, 0.8], pos: [0, 7, 41.5], color: CYAN, material: 'Neon' });
  const how = part(board, { name: 'HowTo', size: [20, 1, 0.2], pos: [0, 10, 40.4], transparency: 1, canCollide: false });
  inst(how, 'BillboardText', { Text: 'Jump into a wormhole -> follow your SCANNER -> grab the dimension shard!', StudsOffset: new Vector3(0, 1, 0) });
  const count = part(board, { name: 'Count', size: [20, 1, 0.2], pos: [0, 7, 40.4], transparency: 1, canCollide: false });
  inst(count, 'BillboardText', { Text: `${games.length} wormholes  -  ${games.length} shards  -  ${FRAGS} star fragments  -  ${prizes.length} prizes`, StudsOffset: new Vector3(0, 0, 0) });
  const zg = model(ws, 'GravityButton');
  part(zg, { name: 'Stand', size: [3, 3, 3], pos: [16, 2.5, 38], color: '#2a2140', material: 'Metal' });
  const btn = part(zg, { name: 'Button', size: [2.4, 0.8, 2.4], pos: [16, 4.4, 38], color: '#7dffb0', material: 'Neon' });
  inst(btn, 'ClickDetector', { MaxActivationDistance: 20 });
  inst(btn, 'BillboardText', { Text: 'ZERO-G (click)', StudsOffset: new Vector3(0, 3, 0) });

  // ---------------------------------------------------------------- prizes around the rift
  if (prizes.length) {
    const hall = model(ws, 'Prizes');
    prizes.forEach((p, i) => {
      const a = ((i + 0.5) / prizes.length) * Math.PI * 2;
      const px = Math.sin(a) * 24, pz = Math.cos(a) * 24;
      const col = p.bonus ? '#7df9ff' : COLORS[i % COLORS.length];
      disc(hall, 'Pedestal', px, 3.2, pz, 3.6, 2.2, '#2a2140', 'Marble');
      disc(hall, 'PedestalTrim', px, 3.3, pz, 4, 0.3, col, 'Neon', { canCollide: false });
      const orb = part(hall, { name: 'Prize', size: [2, 2, 2], pos: [px, 5.4, pz], rot: [45, 0, 45], color: col, material: 'Neon', canCollide: false });
      inst(orb, 'BillboardText', { Text: p.bonus ? `BONUS: ${p.name}` : `${p.need}: ${p.name}`, StudsOffset: new Vector3(0, 2.2, 0) });
    });
  }

  // ---------------------------------------------------------------- wormholes on floating islands
  const n = Math.max(games.length, 1);
  const R = Math.max(72, Math.ceil((n * 20) / (2 * Math.PI)));
  const portals = folder(ws, 'Portals');
  games.forEach((game, i) => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const c = game.byPlayer ? '#ff4d8d' : COLORS[i % COLORS.length];
    const m = model(portals, game.name);
    // a bridge from the deck
    const from = 43, len = R - from - 8;
    if (len > 1) {
      const mid = from + len / 2;
      part(m, { name: 'Bridge', size: [6, 0.8, len + 2], pos: [Math.sin(a) * mid, 0.6, Math.cos(a) * mid], rot: [0, (a * 180) / Math.PI, 0], color: '#1e2236', material: 'Metal' });
      for (const s of [-1, 1]) part(m, { name: 'BridgeEdge', size: [0.4, 0.4, len + 2], pos: [Math.sin(a) * mid + Math.cos(a) * s * 3, 1.2, Math.cos(a) * mid - Math.sin(a) * s * 3], rot: [0, (a * 180) / Math.PI, 0], color: c, material: 'Neon', canCollide: false });
    }
    disc(m, 'Island', x, 1, z, 18, 2, '#2e2a3d', 'Slate');
    part(m, { name: 'IslandRock', size: [14, 10, 14], pos: [x, -5, z], rot: [10, i * 40, 6], color: '#332c40', material: 'Slate' });
    disc(m, 'IslandGlow', x, 1.05, z, 14, 0.1, c, 'Neon', { canCollide: false, transparency: 0.5 });
    ringOfBlocks(m, x, 8, z, a, 6, 14, c, 1.5);
    const gate = part(m, { name: 'Portal', size: [1, 11, 11], pos: [x, 8, z], rot: [0, (a * 180) / Math.PI + 90, 0], color: c, material: 'Neon', shape: 'Cylinder', transparency: 0.35, canCollide: false });
    inst(gate, 'IntValue', { Name: 'PlaceId', Value: game.id });
    inst(gate, 'BillboardText', { Text: game.name + (game.byPlayer ? '  (by ' + game.creator + ')' : ''), StudsOffset: new Vector3(0, 9, 0) });
    inst(gate, 'Sparkles', { SparkleColor: Color3.fromHex(c) });
    light(gate, c, 22, 1.4);
  });

  // ---------------------------------------------------------------- launch pads + floating asteroids
  const pads = folder(ws, 'LaunchPads');
  const rocks = folder(ws, 'Asteroids');
  const PADS = 4;
  const asteroidTops = [];
  for (let i = 0; i < PADS; i++) {
    const a = (i / PADS) * Math.PI * 2 + Math.PI / 4;
    const px = Math.sin(a) * 34, pz = Math.cos(a) * 34;
    const pad = part(pads, { name: 'LaunchPad', size: [6, 0.4, 6], pos: [px, 2.2, pz], color: '#7dffb0', material: 'Neon' });
    inst(pad, 'BillboardText', { Text: 'LAUNCH PAD', StudsOffset: new Vector3(0, 2.5, 0) });
    light(pad, '#7dffb0', 12, 1);
    // the asteroid above: a little outwards, so you steer onto it at the top
    const ax = Math.sin(a) * 40, az = Math.cos(a) * 40, ay = 42 + i * 4;
    part(rocks, { name: 'Asteroid', size: [12, 4, 12], pos: [ax, ay - 2, az], rot: [0, i * 33, 0], color: '#4a4058', material: 'Slate' });
    part(rocks, { name: 'AsteroidUnder', size: [8, 5, 8], pos: [ax, ay - 5.5, az], rot: [8, i * 50, 12], color: '#3a3346', material: 'Slate' });
    asteroidTops.push([ax, ay, az]);
  }

  // ---------------------------------------------------------------- the rocket and the moon base
  const rocket = model(ws, 'Rocket');
  const RX = -26, RZ = -24;
  disc(rocket, 'RocketPad', RX, 1.4, RZ, 14, 0.4, '#ff8a3d', 'Neon');
  const body = part(rocket, { name: 'Body', size: [14, 5, 5], pos: [RX, 10, RZ], rot: [0, 0, 90], color: '#f2f2f2', material: 'SmoothPlastic', shape: 'Cylinder', canCollide: false });
  void body;
  part(rocket, { name: 'Nose', size: [4, 4, 4], pos: [RX, 18, RZ], color: '#e8002a', material: 'SmoothPlastic', shape: 'Ball', canCollide: false });
  part(rocket, { name: 'Window', size: [0.6, 1.8, 1.8], pos: [RX, 13, RZ + 2.5], rot: [0, 90, 0], color: '#7df9ff', material: 'Neon', shape: 'Cylinder', canCollide: false });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    part(rocket, { name: 'Fin', size: [0.5, 5, 3], pos: [RX + Math.sin(a) * 3, 4.5, RZ + Math.cos(a) * 3], rot: [0, (a * 180) / Math.PI, 0], color: '#e8002a', material: 'SmoothPlastic', canCollide: false });
  }
  const flame = part(rocket, { name: 'Flame', size: [3, 3, 3], pos: [RX, 2.4, RZ], color: '#ff8a3d', material: 'Neon', shape: 'Ball', canCollide: false, transparency: 1 });
  light(flame, '#ff8a3d', 20, 0);
  const rocketSign = part(rocket, { name: 'Sign', size: [1, 1, 1], pos: [RX, 22, RZ], transparency: 1, canCollide: false });
  inst(rocketSign, 'BillboardText', { Text: 'ROCKET TO THE MOON BASE' });
  const base = model(ws, 'MoonBase');
  const MB = [60, 150, -190];
  disc(base, 'MoonDeck', MB[0], MB[1], MB[2], 30, 3, '#8c8c9c', 'Slate');
  part(base, { name: 'MoonRock', size: [26, 14, 26], pos: [MB[0], MB[1] - 9, MB[2]], rot: [6, 20, 10], color: '#6e6e7e', material: 'Slate' });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    disc(base, 'Crater', MB[0] + Math.sin(a) * 9, MB[1] + 0.05, MB[2] + Math.cos(a) * 9, 3 + (i % 2) * 2, 0.1, '#6e6e7e', 'Slate', { canCollide: false });
  }
  part(base, { name: 'FlagPole', size: [0.4, 8, 0.4], pos: [MB[0] - 8, MB[1] + 4, MB[2] - 8], color: '#d9d9d9', material: 'Metal' });
  part(base, { name: 'Flag', size: [4, 2.6, 0.2], pos: [MB[0] - 6, MB[1] + 6.7, MB[2] - 8], color: PURPLE, material: 'Neon' });
  const home = part(base, { name: 'ReturnPad', size: [6, 0.4, 6], pos: [MB[0] + 8, MB[1] + 0.2, MB[2] + 8], color: CYAN, material: 'Neon' });
  inst(home, 'BillboardText', { Text: 'BACK TO THE STATION', StudsOffset: new Vector3(0, 2.5, 0) });
  part(ws, { cls: 'Part', name: 'MoonLanding', size: [6, 1, 6], pos: [MB[0], MB[1] + 0.5, MB[2] + 4], transparency: 1, canCollide: false });

  // ---------------------------------------------------------------- star fragments
  const frags = folder(ws, 'StarFragments');
  const spots = [...asteroidTops.map(([x, y, z]) => [x, y + 2, z]), [0, 40, 0], [MB[0] - 4, MB[1] + 2.5, MB[2] + 2]].slice(0, FRAGS);
  spots.forEach(([x, y, z], i) => {
    const f = part(frags, { name: 'Fragment', size: [1.4, 1.4, 1.4], pos: [x, y, z], rot: [45, 0, 45], color: '#ffe680', material: 'Neon', canCollide: false });
    inst(f, 'IntValue', { Name: 'Index', Value: i + 1 });
    inst(f, 'Sparkles', { SparkleColor: Color3.fromHex('#ffe680') });
    light(f, '#ffe680', 10, 1);
  });

  script(g.ServerScriptService, 'Hunt', `
-- The Hunt: Another Dimension. The hub: wormholes, launch pads, star
-- fragments, the rocket, meteor showers, zero-g and the Rift.
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Hunt = game:GetService("HuntService")
local hint = Instance.new("Hint", workspace)
local NORMAL_GRAVITY = workspace.Gravity

local function charOf(hit)
	local char = hit and hit.Parent
	local player = char and Players:GetPlayerFromCharacter(char)
	if not player then return nil end
	return player, char, char:FindFirstChild("HumanoidRootPart")
end

local function say(text, secs)
	hint.Text = text
	delay(secs or 4, function() if hint.Text == text then hint.Text = "" end end)
end

-- leaderstats: shards and star fragments
Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local shards = Instance.new("StringValue")
	shards.Name = "Shards"
	local p = Hunt:GetProgress(player.UserId)
	shards.Value = p.Collected .. "/" .. p.Total
	shards.Parent = ls
	local stars = Instance.new("StringValue")
	stars.Name = "Stars"
	local f = Hunt:CollectFragment(player.UserId, 0)
	stars.Value = f.Count .. "/" .. f.Total
	stars.Parent = ls
	wait(1.5)
	player:Notify("Welcome to The Hunt: Another Dimension! Gravity is low here - jump around. You have " .. p.Collected .. " of " .. p.Total .. " shards.")
end)

-- wormholes
local busy = {}
for _, portal in ipairs(workspace.Portals:GetDescendants()) do
	if portal.Name == "Portal" then
		portal.Touched:Connect(function(hit)
			local player = charOf(hit)
			if not player or busy[player] then return end
			busy[player] = true
			player:Notify("Entering the wormhole to " .. portal.Parent.Name .. "...")
			wait(0.5)
			TeleportService:Teleport(portal.PlaceId.Value, player)
			wait(3)
			busy[player] = nil
		end)
	end
end

-- launch pads: up to the floating asteroids
local launched = {}
for _, pad in ipairs(workspace.LaunchPads:GetChildren()) do
	pad.Touched:Connect(function(hit)
		local player, char, root = charOf(hit)
		if not root or launched[player] then return end
		launched[player] = true
		root.Velocity = Vector3.new(0, 92, 0)
		wait(1)
		launched[player] = nil
	end)
end

-- star fragments: every player collects their own
for _, frag in ipairs(workspace.StarFragments:GetChildren()) do
	frag.Touched:Connect(function(hit)
		local player = charOf(hit)
		if not player then return end
		local r = Hunt:CollectFragment(player.UserId, frag.Index.Value)
		if not r.New then return end
		local ls = player:FindFirstChild("leaderstats")
		if ls then ls.Stars.Value = r.Count .. "/" .. r.Total end
		if r.Prize ~= "" then
			player:Notify("All star fragments found! You won: " .. r.Prize .. "!")
		else
			player:Notify("Star fragment " .. r.Count .. "/" .. r.Total .. " found!")
		end
	end)
end

-- zero-g button
local zeroG = false
workspace.GravityButton.Button.ClickDetector.MouseClick:Connect(function(player)
	if zeroG then return end
	zeroG = true
	workspace.Gravity = 22
	workspace.GravityButton.Button.Color = Color3.fromRGB(255, 77, 141)
	say(player.Name .. " turned on ZERO-G for 20 seconds!", 5)
	wait(20)
	workspace.Gravity = NORMAL_GRAVITY
	say("Gravity is back.", 3)
	wait(25)
	workspace.GravityButton.Button.Color = Color3.fromRGB(125, 255, 176)
	zeroG = false
end)

-- the rocket: everyone on the pad when it launches flies to the moon base
local rocket = workspace.Rocket
local landing = workspace.MoonLanding
local station = workspace.Spawn
workspace.MoonBase.ReturnPad.Touched:Connect(function(hit)
	local player, char, root = charOf(hit)
	if root then root.CFrame = CFrame.new(station.Position + Vector3.new(0, 4, 0)) end
end)
local function riders()
	local list = {}
	local pad = rocket.RocketPad
	for _, p in ipairs(Players:GetPlayers()) do
		local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		if r then
			local d = r.Position - pad.Position
			if math.abs(d.X) < 7 and math.abs(d.Z) < 7 and d.Y < 10 then table.insert(list, p) end
		end
	end
	return list
end
spawn(function()
	local sign = rocket.Sign.BillboardText
	rocket.PrimaryPart = rocket.Body
	local start = rocket.Body.CFrame
	while true do
		for i = 25, 1, -1 do
			sign.Text = "ROCKET TO THE MOON BASE - launch in " .. i
			wait(1)
		end
		local list = riders()
		sign.Text = "LIFT OFF!"
		rocket.Flame.Transparency = 0
		rocket.Flame.PointLight.Brightness = 3
		for _, p in ipairs(list) do p:Notify("3... 2... 1... LIFT OFF!") end
		for i = 1, 30 do
			rocket:SetPrimaryPartCFrame(start + Vector3.new(0, i * i * 0.18, 0))
			wait(0.05)
		end
		for _, p in ipairs(list) do
			local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
			if r then r.CFrame = CFrame.new(landing.Position + Vector3.new(math.random(-3, 3), 4, math.random(-3, 3))) end
		end
		wait(1)
		rocket.Flame.Transparency = 1
		rocket.Flame.PointLight.Brightness = 0
		rocket:SetPrimaryPartCFrame(start)
	end
end)

-- meteor showers: they push you around, nothing worse
spawn(function()
	while true do
		wait(70)
		say("METEOR SHOWER! Watch the sky!", 6)
		for i = 1, 12 do
			local a = math.random() * math.pi * 2
			local r = math.random() * 40
			local target = Vector3.new(math.sin(a) * r, 2, math.cos(a) * r)
			local m = Instance.new("Part")
			m.Name = "Meteor"
			m.Shape = Enum.PartType.Ball
			m.Size = Vector3.new(3, 3, 3)
			m.Material = Enum.Material.Neon
			m.Color = Color3.fromRGB(255, 120, 40)
			m.Anchored = true
			m.CanCollide = false
			m.Position = target + Vector3.new(30, 120, 10)
			m.Parent = workspace
			Instance.new("Fire", m)
			TweenService:Create(m, TweenInfo.new(1.4, Enum.EasingStyle.Linear), {Position = target}):Play()
			delay(1.4, function()
				local e = Instance.new("Explosion")
				e.Position = target
				e.BlastRadius = 8
				e.BlastPressure = 250000
				e.DestroyJointRadiusPercent = 0
				e.Parent = workspace
				m.Transparency = 0.5
				m.Size = Vector3.new(5, 0.4, 5)
				m.Shape = Enum.PartType.Cylinder
				Debris:AddItem(m, 3)
			end)
			wait(0.35)
		end
	end
end)

-- the moon goes around the station
spawn(function()
	local moon = workspace.Space.Moon
	local t = 0
	while true do
		t = t + 0.01
		moon.Position = Vector3.new(math.cos(t) * 130, 70 + math.sin(t * 2) * 10, math.sin(t) * 130)
		wait(0.1)
	end
end)

-- the Rift: spins, and fills up with every shard anyone finds
spawn(function()
	local energy = workspace.Rift.RiftEnergy.BillboardText
	while true do
		local g = Hunt:GetGlobal()
		if g.Open then
			energy.Text = "THE RIFT IS OPEN! (" .. g.Shards .. " shards found by everyone)"
		else
			energy.Text = "Rift energy: " .. g.Shards .. " / " .. g.Goal .. " shards - find shards to open it!"
		end
		wait(10)
	end
end)
local ring = workspace.Rift.RiftRing:GetChildren()
local core = workspace.Rift.RiftCore
local t = 0
while true do
	t = t + 0.06
	for i, seg in ipairs(ring) do
		local a = (i - 1) / #ring * math.pi * 2 + t
		seg.CFrame = CFrame.new(math.cos(a) * 9, 13 + math.sin(a) * 9, 0) * CFrame.Angles(0, 0, a)
	end
	core.Transparency = 0.3 + math.sin(t * 2) * 0.1
	wait(0.1)
end
`);
  return finish(g, { name: 'The Hunt: Another Dimension' });
}
