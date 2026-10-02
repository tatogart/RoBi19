// The Hunt: an event hub with a portal to every game in the event. Each
// portal teleports you into its game, where a golden token is hidden (the
// game server places it, see GameServer._spawnHuntToken). The hub is rebuilt
// whenever the list of games changes (server/hunt.js).
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

const COLORS = ['#f5cd30', '#00a2ff', '#e8590c', '#4b974b', '#a347ff', '#ff4d8d', '#00aaaa', '#c4281c'];

export function buildHuntHub(games) {
  const g = newGame();
  const ws = g.Workspace;
  const L = g.Lighting;
  L.ClockTime = 19.5;
  L.Brightness = 0.8;
  L.FogEnd = 600;
  L.FogColor = Color3.fromRGB(40, 30, 60);
  part(ws, { name: 'Ground', size: [400, 4, 400], pos: [0, -2, 0], color: '#2b2340', material: 'Slate', props: { Locked: true } });
  // Central plaza with the giant token.
  part(ws, { name: 'Plaza', size: [1, 70, 70], pos: [0, 0.5, 0], color: '#3b3157', material: 'Marble', shape: 'Cylinder', rot: [0, 0, 90] });
  part(ws, { cls: 'SpawnLocation', name: 'Spawn', size: [12, 1, 12], pos: [0, 1.5, 22], color: '#f5cd30', top: 'Smooth', props: { Duration: 0 } });
  part(ws, { name: 'Pedestal', size: [10, 6, 10], pos: [0, 4, 0], color: '#1b1b1b', material: 'Marble' });
  const big = part(ws, { name: 'GiantToken', size: [9, 9, 9], pos: [0, 13, 0], color: '#ffc400', material: 'Neon', shape: 'Ball', canCollide: false });
  inst(big, 'BillboardText', { Text: 'THE HUNT', StudsOffset: new Vector3(0, 7, 0) });
  inst(big, 'PointLight', { Color: Color3.fromHex('#ffc400'), Range: 40, Brightness: 2 });
  // A ring of portals.
  const portals = folder(ws, 'Portals');
  const n = Math.max(games.length, 1);
  const R = Math.max(40, n * 6);
  games.forEach((game, i) => {
    const a = (i / n) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const yaw = (a * 180) / Math.PI;
    const c = COLORS[i % COLORS.length];
    const m = model(portals, game.name);
    // a path from the plaza
    const mid = R / 2 + 17;
    part(m, { name: 'Path', size: [6, 0.4, R - 34], pos: [Math.sin(a) * mid, 1.2, Math.cos(a) * mid], rot: [0, yaw, 0], color: '#4a3f6b', material: 'Slate' });
    part(m, { name: 'Base', size: [14, 1, 6], pos: [x, 1.5, z], rot: [0, yaw, 0], color: '#1b1b1b', material: 'Marble' });
    for (const s of [-1, 1]) {
      part(m, { name: 'Pillar', size: [2, 14, 2], pos: [x + Math.cos(a) * s * 6, 9, z - Math.sin(a) * s * 6], rot: [0, yaw, 0], color: c, material: 'Marble' });
    }
    part(m, { name: 'Top', size: [14, 2, 2], pos: [x, 17, z], rot: [0, yaw, 0], color: c, material: 'Marble' });
    const gate = part(m, { name: 'Portal', size: [10, 13, 1], pos: [x, 8.5, z], rot: [0, yaw, 0], color: c, material: 'Neon', transparency: 0.35, canCollide: false });
    inst(gate, 'IntValue', { Name: 'PlaceId', Value: game.id });
    inst(gate, 'BillboardText', { Text: game.name + (game.byPlayer ? '  (by ' + game.creator + ')' : ''), StudsOffset: new Vector3(0, 10, 0) });
  });
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
`);
  return finish(g, { name: 'The Hunt' });
}
