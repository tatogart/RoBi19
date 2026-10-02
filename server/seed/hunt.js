// The Hunt: an event hub with a portal to every game in the event. Each
// portal teleports you into its game, where a golden token is hidden (the
// game server places it, see GameServer._spawnHuntToken). The hub is rebuilt
// whenever the list of games or prizes changes (server/hunt.js).
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish, tree } from './builder.js';

const COLORS = ['#f5cd30', '#00a2ff', '#e8590c', '#4b974b', '#a347ff', '#ff4d8d', '#00c2c2', '#c4281c'];
const GOLD = '#ffc400';

function light(p, color, range = 18, brightness = 1.5) {
  inst(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
}

// prizes: [{ name, need }] for the prize hall
export function buildHuntHub(games, prizes = []) {
  const g = newGame();
  const ws = g.Workspace;
  const L = g.Lighting;
  L.ClockTime = 20.5;
  L.Brightness = 0.9;
  L.Ambient = Color3.fromRGB(70, 55, 110);
  L.OutdoorAmbient = Color3.fromRGB(80, 60, 120);
  L.FogEnd = 700;
  L.FogColor = Color3.fromRGB(45, 30, 75);

  const n = Math.max(games.length, 1);
  const R = Math.max(60, Math.ceil((n * 17) / (2 * Math.PI)));
  const size = Math.max(320, R * 2 + 140);
  part(ws, { name: 'Ground', size: [size, 4, size], pos: [0, -2, 0], color: '#2f6b3a', material: 'Grass', props: { Locked: true } });

  // ---------------------------------------------------------------- central plaza
  const plaza = model(ws, 'Plaza');
  part(plaza, { name: 'Plaza', size: [1, 84, 84], pos: [0, 0.5, 0], color: '#3b3157', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  part(plaza, { name: 'PlazaRing', size: [1, 90, 90], pos: [0, 0.4, 0], color: GOLD, material: 'Metal', shape: 'Cylinder', rot: [0, 0, 90] });
  part(plaza, { name: 'Inlay', size: [1.1, 30, 30], pos: [0, 0.55, 0], color: '#4a3a78', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  // star rays in the floor
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(plaza, { name: 'Ray', size: [2, 0.2, 26], pos: [Math.sin(a) * 26, 1.05, Math.cos(a) * 26], rot: [0, (a * 180) / Math.PI, 0], color: GOLD, material: 'Neon', canCollide: false });
  }
  // the fountain with the giant spinning coin
  const fountain = model(ws, 'Fountain');
  part(fountain, { name: 'Basin', size: [3, 22, 22], pos: [0, 1.5, 0], color: '#d9d4e8', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  part(fountain, { name: 'Water', size: [0.4, 19, 19], pos: [0, 3.1, 0], color: '#3aa0ff', material: 'Glass', transparency: 0.35, shape: 'Cylinder', rot: [0, 0, 90], canCollide: false });
  part(fountain, { name: 'Pillar', size: [10, 3, 3], pos: [0, 7, 0], color: '#d9d4e8', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  const coin = part(fountain, { name: 'GiantToken', size: [1.6, 11, 11], pos: [0, 17, 0], color: GOLD, material: 'Neon', shape: 'Cylinder', canCollide: false });
  part(fountain, { name: 'CoinStar', size: [1.8, 4, 4], pos: [0, 17, 0], color: '#fff3b0', material: 'Neon', shape: 'Cylinder', canCollide: false });
  inst(coin, 'BillboardText', { Text: 'THE HUNT', StudsOffset: new Vector3(0, 9, 0) });
  inst(coin, 'Sparkles', { SparkleColor: Color3.fromHex(GOLD) });
  light(coin, GOLD, 50, 2.5);
  // benches around the fountain
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bx = Math.sin(a) * 19, bz = Math.cos(a) * 19, yaw = (a * 180) / Math.PI;
    part(plaza, { name: 'Bench', size: [7, 0.8, 2.2], pos: [bx, 2.2, bz], rot: [0, yaw + 90, 0], color: '#6b4a2f', material: 'WoodPlanks' });
    part(plaza, { name: 'BenchLeg', size: [6, 1.2, 1.4], pos: [bx, 1.4, bz], rot: [0, yaw + 90, 0], color: '#3b3157', material: 'Marble' });
  }

  // ---------------------------------------------------------------- spawn + info board
  part(ws, { cls: 'SpawnLocation', name: 'Spawn', size: [12, 1, 12], pos: [0, 1.5, 32], color: GOLD, top: 'Smooth', props: { Duration: 0 } });
  const board = model(ws, 'InfoBoard');
  part(board, { name: 'Board', size: [22, 9, 1], pos: [0, 7, 40.5], color: '#1b1430', material: 'SmoothPlastic' });
  part(board, { name: 'Frame', size: [23, 10, 0.8], pos: [0, 7, 41], color: GOLD, material: 'Metal' });
  for (const x of [-10, 10]) part(board, { name: 'Post', size: [1, 12, 1], pos: [x, 6, 41], color: GOLD, material: 'Metal' });
  const sign = part(board, { name: 'HowTo', size: [20, 1, 0.2], pos: [0, 9, 40], color: '#1b1430', transparency: 1, canCollide: false });
  inst(sign, 'BillboardText', { Text: 'Walk into a portal  ->  find the golden token  ->  win prizes!', StudsOffset: new Vector3(0, 1, 0) });
  const sign2 = part(board, { name: 'Count', size: [20, 1, 0.2], pos: [0, 6, 40], color: '#1b1430', transparency: 1, canCollide: false });
  inst(sign2, 'BillboardText', { Text: `${games.length} games  -  ${games.length} tokens  -  ${prizes.length} prizes`, StudsOffset: new Vector3(0, 0, 0) });

  // ---------------------------------------------------------------- portals in a ring
  const portals = folder(ws, 'Portals');
  const decor = folder(ws, 'Decor');
  games.forEach((game, i) => {
    // half a step off, so no portal hides behind the info board at the spawn
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const yaw = (a * 180) / Math.PI;
    const c = game.byPlayer ? '#ff4d8d' : COLORS[i % COLORS.length];
    const m = model(portals, game.name);
    // a glowing path from the plaza
    const from = 44, len = R - from - 3;
    if (len > 2) {
      const mid = from + len / 2;
      part(m, { name: 'Path', size: [7, 0.4, len], pos: [Math.sin(a) * mid, 1.2, Math.cos(a) * mid], rot: [0, yaw, 0], color: '#4a3f6b', material: 'Slate' });
      for (const s of [-1, 1]) part(m, { name: 'PathEdge', size: [0.5, 0.5, len], pos: [Math.sin(a) * mid + Math.cos(a) * s * 3.7, 1.3, Math.cos(a) * mid - Math.sin(a) * s * 3.7], rot: [0, yaw, 0], color: c, material: 'Neon', canCollide: false });
    }
    part(m, { name: 'Base', size: [15, 1.2, 7], pos: [x, 1.6, z], rot: [0, yaw, 0], color: '#1b1430', material: 'Marble' });
    for (const s of [-1, 1]) {
      const px = x + Math.cos(a) * s * 6.5, pz = z - Math.sin(a) * s * 6.5;
      part(m, { name: 'Pillar', size: [2, 15, 2], pos: [px, 9.5, pz], rot: [0, yaw, 0], color: '#2a2140', material: 'Marble' });
      part(m, { name: 'PillarGlow', size: [2.3, 0.6, 2.3], pos: [px, 16.8, pz], rot: [0, yaw, 0], color: c, material: 'Neon', canCollide: false });
    }
    part(m, { name: 'Top', size: [15, 2, 2.4], pos: [x, 17.8, z], rot: [0, yaw, 0], color: '#2a2140', material: 'Marble' });
    part(m, { name: 'TopGlow', size: [15.2, 0.5, 2.6], pos: [x, 16.6, z], rot: [0, yaw, 0], color: c, material: 'Neon', canCollide: false });
    const gate = part(m, { name: 'Portal', size: [11, 14, 1], pos: [x, 9, z], rot: [0, yaw, 0], color: c, material: 'Neon', transparency: 0.3, canCollide: false });
    inst(gate, 'IntValue', { Name: 'PlaceId', Value: game.id });
    inst(gate, 'BillboardText', { Text: game.name + (game.byPlayer ? '  (by ' + game.creator + ')' : ''), StudsOffset: new Vector3(0, 11, 0) });
    inst(gate, 'Sparkles', { SparkleColor: Color3.fromHex(c) });
    light(gate, c, 22, 1.4);
    // a lamp post between this portal and the next
    const b = ((i + 1) / n) * Math.PI * 2;
    const lx = Math.sin(b) * (R - 2), lz = Math.cos(b) * (R - 2);
    part(decor, { name: 'LampPost', size: [0.8, 10, 0.8], pos: [lx, 5, lz], color: '#1b1430', material: 'Metal' });
    const bulb = part(decor, { name: 'Lamp', size: [2, 2, 2], pos: [lx, 10.6, lz], color: '#fff1c4', material: 'Neon', shape: 'Ball', canCollide: false });
    light(bulb, '#ffd27a', 20, 1.2);
  });

  // ---------------------------------------------------------------- floating crystals
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = R * 0.62;
    const col = COLORS[(i * 3) % COLORS.length];
    const cr = part(decor, { name: 'Crystal', size: [2.4, 6, 2.4], pos: [Math.sin(a) * r, 12 + (i % 3) * 3, Math.cos(a) * r], rot: [0, i * 36, 20], color: col, material: 'Neon', transparency: 0.15, canCollide: false });
    inst(cr, 'Sparkles', { SparkleColor: Color3.fromHex(col) });
  }

  // ---------------------------------------------------------------- trees and rocks outside the ring
  const nature = folder(ws, 'Nature');
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.12;
    const r = R + 22 + (i % 3) * 9;
    if (Math.abs(Math.sin(a) * r) > size / 2 - 8 || Math.abs(Math.cos(a) * r) > size / 2 - 8) continue;
    tree(nature, Math.sin(a) * r, Math.cos(a) * r, 0, 0.9 + (i % 4) * 0.15);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.5;
    const r = R + 12;
    part(nature, { name: 'Rock', size: [4 + (i % 3), 2.5 + (i % 2), 3.5], pos: [Math.sin(a) * r, 1, Math.cos(a) * r], rot: [0, i * 47, 0], color: '#5c5470', material: 'Slate' });
  }

  // ---------------------------------------------------------------- prizes around the fountain
  if (prizes.length) {
    const hall = model(ws, 'Prizes');
    prizes.forEach((p, i) => {
      const a = ((i + 0.5) / prizes.length) * Math.PI * 2;
      const px = Math.sin(a) * 33, pz = Math.cos(a) * 33;
      const col = COLORS[i % COLORS.length];
      part(hall, { name: 'Pedestal', size: [3.4, 3, 3.4], pos: [px, 2.5, pz], rot: [0, (a * 180) / Math.PI, 0], color: '#d9d4e8', material: 'Marble' });
      part(hall, { name: 'PedestalTrim', size: [3.8, 0.4, 3.8], pos: [px, 4.1, pz], rot: [0, (a * 180) / Math.PI, 0], color: GOLD, material: 'Metal' });
      const orb = part(hall, { name: 'Prize', size: [2.2, 2.2, 2.2], pos: [px, 5.9, pz], color: col, material: 'Neon', shape: 'Ball', canCollide: false });
      inst(orb, 'BillboardText', { Text: `${p.need}: ${p.name}`, StudsOffset: new Vector3(0, 2.3, 0) });
      light(orb, col, 10, 1);
    });
  }

  script(g.ServerScriptService, 'Hunt', `
-- The Hunt hub: walk into a portal to go to that game and find its token.
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local Hunt = game:GetService("HuntService")

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local tokens = Instance.new("StringValue")
	tokens.Name = "Tokens"
	local p = Hunt:GetProgress(player.UserId)
	tokens.Value = p.Collected .. "/" .. p.Total
	tokens.Parent = ls
	wait(1)
	player:Notify("Welcome to The Hunt! Find the golden token hidden in every game. You have " .. p.Collected .. " of " .. p.Total .. ".")
end)

local busy = {}
for _, portal in ipairs(workspace.Portals:GetDescendants()) do
	if portal.Name == "Portal" then
		portal.Touched:Connect(function(hit)
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if not player or busy[player] then return end
			busy[player] = true
			player:Notify("Teleporting to " .. portal.Parent.Name .. "...")
			wait(0.5)
			TeleportService:Teleport(portal.PlaceId.Value, player)
			wait(3)
			busy[player] = nil
		end)
	end
end

-- The giant coin spins and bobs.
local coin = workspace.Fountain.GiantToken
local star = workspace.Fountain.CoinStar
local base = coin.Position
local t = 0
while true do
	t = t + 0.05
	local cf = CFrame.new(base + Vector3.new(0, math.sin(t * 1.5) * 1.2, 0)) * CFrame.Angles(0, t, 0)
	coin.CFrame = cf
	star.CFrame = cf
	wait(0.05)
end
`);
  return finish(g, { name: 'The Hunt' });
}
