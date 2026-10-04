// The big Crossroads update: street lamps that turn on at night, trampolines,
// two cars to drive around town, a playground with a spinning merry-go-round
// and a slide, a lake with a dock and a treasure island, a sky obby up to a
// floating island, the Robis Cafe, a clock tower that shows the time, a hill
// with a secret cave, and teleporters. Three new badges.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { part, model, folder, script, inst, tree } from './builder.js';

const light = (p, color, range = 16, brightness = 1.5) => inst(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
const label = (p, text, up = 3) => inst(p, 'BillboardText', { Text: text, StudsOffset: new Vector3(0, up, 0) });
const disc = (parent, name, x, y, z, d, h, color, material = 'SmoothPlastic', o = {}) =>
  part(parent, { name, size: [h, d, d], pos: [x, y - h / 2, z], rot: [0, 0, 90], color, material, shape: 'Cylinder', ...o });

function car(parent, name, x, z, color, ry = 0) {
  const m = model(parent, name);
  const r = (ry * Math.PI) / 180;
  const at = (dx, dz) => [x + Math.cos(r) * dx + Math.sin(r) * dz, z - Math.sin(r) * dx + Math.cos(r) * dz];
  const [bx, bz] = at(0, 0);
  part(m, { name: 'Body', size: [5, 1.6, 9], pos: [bx, 1.6, bz], rot: [0, ry, 0], color, material: 'SmoothPlastic' });
  const [cx, cz] = at(0, 1);
  part(m, { name: 'Cabin', size: [4.6, 1.8, 4], pos: [cx, 3.3, cz], rot: [0, ry, 0], color: '#cfe8ff', material: 'Glass', transparency: 0.35, canCollide: false });
  const [sx, sz] = at(0, 1.2);
  const seat = part(m, { cls: 'VehicleSeat', name: 'Seat', size: [2, 1, 2], pos: [sx, 2.6, sz], rot: [0, ry, 0], color: '#1b1b1b' });
  seat.MaxSpeed = 70;
  for (const [dx, dz] of [[-2.6, -3], [2.6, -3], [-2.6, 3], [2.6, 3]]) {
    const [wx, wz] = at(dx, dz);
    part(m, { name: 'Wheel', size: [1, 2, 2], pos: [wx, 1, wz], rot: [0, ry, 0], color: '#1b1b1b', shape: 'Cylinder', canCollide: false });
  }
  const [lx, lz] = at(0, -4.6);
  const lamp = part(m, { name: 'Headlights', size: [4, 0.6, 0.3], pos: [lx, 1.9, lz], rot: [0, ry, 0], color: '#fff6c8', material: 'Neon', canCollide: false });
  label(lamp, 'DRIVE ME', 3);
  return m;
}

export function crossroadsExtras(g) {
  const ws = g.Workspace;

  // ---------------------------------------------------------------- street lamps
  const lamps = folder(ws, 'StreetLamps');
  for (let i = -160; i <= 160; i += 40) {
    if (Math.abs(i) < 20) continue;
    for (const [x, z] of [[i, 12], [12, i]]) {
      part(lamps, { name: 'Post', size: [0.6, 12, 0.6], pos: [x, 6, z], color: '#2b2b2b', material: 'Metal' });
      const bulb = part(lamps, { name: 'Bulb', size: [1.6, 1.6, 1.6], pos: [x, 12.5, z], color: '#fff3c4', material: 'Neon', shape: 'Ball', canCollide: false });
      inst(bulb, 'PointLight', { Color: Color3.fromHex('#ffe7a0'), Range: 24, Brightness: 0, Name: 'Light' });
    }
  }

  // ---------------------------------------------------------------- trampolines by the spawn
  const tramps = folder(ws, 'Trampolines');
  [['#ff4d8d', -16, 16], ['#00a2ff', -24, 22], ['#02b757', -16, 28]].forEach(([c, x, z]) => {
    disc(tramps, 'Frame', x, 1, z, 9, 1, '#2b2b2b', 'Metal');
    const pad = disc(tramps, 'Trampoline', x, 1.4, z, 8, 0.4, c, 'Fabric');
    label(pad, 'BOING!', 2);
  });

  // ---------------------------------------------------------------- the car park
  const cars = folder(ws, 'Cars');
  part(cars, { name: 'Parking', size: [30, 0.2, 18], pos: [-40, 0.1, 25], color: '#4a4a4c', material: 'Slate' });
  car(cars, 'Red Car', -48, 25, '#c4281c', 90);
  car(cars, 'Blue Car', -33, 25, '#0d69ac', 90);

  // ---------------------------------------------------------------- playground
  const play = model(ws, 'Playground');
  const PX = 115, PZ = 45;
  part(play, { name: 'Sand', size: [44, 0.3, 34], pos: [PX, 0.15, PZ], color: '#e3d29a', material: 'Sand' });
  // merry-go-round (spun by the script, players ride it)
  disc(play, 'MerryBase', PX - 10, 0.8, PZ, 3, 0.8, '#635f62', 'Metal');
  const merry = disc(play, 'MerryGoRound', PX - 10, 1.5, PZ, 14, 0.6, '#ff4d8d', 'SmoothPlastic');
  label(merry, 'MERRY-GO-ROUND', 3);
  // slide: a ladder up, a platform, a slope down
  part(play, { cls: 'TrussPart', name: 'Ladder', size: [2, 10, 2], pos: [PX + 12, 5, PZ - 8], color: '#f5cd30', material: 'Metal' });
  part(play, { name: 'SlideTop', size: [6, 1, 6], pos: [PX + 12, 10.5, PZ - 5], color: '#00a2ff', material: 'SmoothPlastic' });
  part(play, { cls: 'WedgePart', name: 'Slide', size: [4, 10, 16], pos: [PX + 12, 5.5, PZ + 6], rot: [0, 180, 0], color: '#ff8a3d', material: 'SmoothPlastic' });
  for (let i = 0; i < 3; i++) part(play, { name: 'Swing', size: [2, 0.4, 1], pos: [PX - 2 + i * 4, 2, PZ + 12], color: ['#c4281c', '#02b757', '#7b5cff'][i] });
  part(play, { name: 'SwingBar', size: [14, 0.6, 0.6], pos: [PX + 2, 8, PZ + 12], color: '#2b2b2b', material: 'Metal' });
  for (const sx of [-5, 9]) part(play, { name: 'SwingPost', size: [0.6, 8, 0.6], pos: [PX + sx, 4, PZ + 12], color: '#2b2b2b', material: 'Metal' });

  // ---------------------------------------------------------------- the lake and the treasure island
  const lake = model(ws, 'Lake');
  const LX = -115, LZ = 105;
  disc(lake, 'Water', LX, 0.35, LZ, 70, 0.3, '#2f8fd8', 'Glass', { transparency: 0.35, canCollide: false });
  disc(lake, 'Shore', LX, 0.25, LZ, 76, 0.2, '#e3d29a', 'Sand', { canCollide: false });
  part(lake, { name: 'Dock', size: [6, 1, 24], pos: [LX + 26, 1, LZ - 14], rot: [0, 40, 0], color: '#7c5c46', material: 'WoodPlanks' });
  // stepping stones out to the island
  for (let i = 0; i < 5; i++) disc(lake, 'Stone', LX + 16 - i * 4, 1.2 + (i % 2) * 0.4, LZ - 6 + i * 3, 3.2, 1, '#8a8590', 'Slate');
  disc(lake, 'Island', LX - 8, 1.5, LZ + 10, 14, 1.6, '#e3d29a', 'Sand');
  tree(lake, LX - 11, LZ + 12, 1.5, 0.7);
  const chest = model(lake, 'TreasureChest');
  part(chest, { name: 'Box', size: [3, 2, 2], pos: [LX - 5, 2.5, LZ + 8], color: '#7c4a1e', material: 'WoodPlanks' });
  const lid = part(chest, { name: 'Lid', size: [3.2, 0.6, 2.2], pos: [LX - 5, 3.8, LZ + 8], color: '#ffc400', material: 'Metal' });
  inst(lid, 'ClickDetector', { MaxActivationDistance: 12 });
  label(lid, 'Treasure? (click)', 2);

  // ---------------------------------------------------------------- sky obby to a floating island
  const obby = folder(ws, 'SkyObby');
  const SX = 150, SZ = -60;
  const start = part(obby, { name: 'Start', size: [8, 1, 8], pos: [SX, 0.6, SZ], color: '#02b757', material: 'Neon' });
  label(start, 'SKY OBBY - reach the island!', 3);
  const COLS = ['#c4281c', '#da8541', '#f5cd30', '#4b974b', '#0d69ac', '#6b327c', '#ff66cc', '#00aaaa'];
  for (let i = 1; i <= 16; i++) {
    const a = i * 0.55;
    part(obby, { name: 'Step', size: [5, 1, 5], pos: [SX + Math.sin(a) * 14, i * 4, SZ - 20 + Math.cos(a) * 14], color: COLS[i % COLS.length], material: 'SmoothPlastic' });
  }
  const isl = model(ws, 'SkyIsland');
  const top = 16 * 4 + 4;
  disc(isl, 'Island', SX, top, SZ - 20, 22, 2, '#4b974b', 'Grass');
  part(isl, { name: 'Rock', size: [16, 8, 16], pos: [SX, top - 6, SZ - 20], rot: [10, 30, 6], color: '#635f62', material: 'Slate' });
  tree(isl, SX + 6, SZ - 24, top, 0.8);
  const trophy = part(isl, { name: 'Trophy', size: [2, 3, 2], pos: [SX - 3, top + 1.6, SZ - 18], color: '#ffc400', material: 'Neon', canCollide: false });
  inst(trophy, 'Sparkles', {});
  light(trophy, '#ffc400', 20, 1.5);
  label(trophy, 'TOUCH THE TROPHY', 2.5);
  const down = part(isl, { name: 'TeleportDown', size: [5, 0.4, 5], pos: [SX + 5, top + 0.2, SZ - 14], color: '#7b5cff', material: 'Neon' });
  label(down, 'Back down', 2);

  // ---------------------------------------------------------------- the Robis Cafe
  const cafe = model(ws, 'Robis Cafe');
  const CX = 105, CZ = -30;
  part(cafe, { name: 'Floor', size: [26, 1, 18], pos: [CX, 0.5, CZ], color: '#e8d2b0', material: 'WoodPlanks' });
  part(cafe, { name: 'Wall', size: [26, 10, 1], pos: [CX, 6, CZ - 8.5], color: '#f8f8f8', material: 'Brick' });
  part(cafe, { name: 'Wall', size: [1, 10, 18], pos: [CX + 12.5, 6, CZ], color: '#f8f8f8', material: 'Brick' });
  part(cafe, { name: 'Wall', size: [1, 10, 18], pos: [CX - 12.5, 6, CZ], color: '#f8f8f8', material: 'Brick' });
  part(cafe, { name: 'Roof', size: [28, 1, 20], pos: [CX, 11.5, CZ], color: '#c4281c', material: 'SmoothPlastic' });
  part(cafe, { name: 'Awning', size: [28, 0.4, 4], pos: [CX, 9, CZ + 11], rot: [-15, 0, 0], color: '#ff4d8d', material: 'Fabric' });
  const sign = part(cafe, { name: 'Sign', size: [12, 2.4, 0.4], pos: [CX, 13.4, CZ + 9], color: '#5a2d0c', material: 'WoodPlanks' });
  label(sign, '☕ ROBIS CAFE', 1.5);
  part(cafe, { name: 'Counter', size: [14, 3.5, 2.5], pos: [CX, 2.75, CZ - 4], color: '#7c5c46', material: 'Wood' });
  const coffee = part(cafe, { name: 'CoffeeMachine', size: [2, 2.4, 1.6], pos: [CX + 4, 5.7, CZ - 4], color: '#2b2b2b', material: 'Metal' });
  inst(coffee, 'ClickDetector', { MaxActivationDistance: 14 });
  label(coffee, 'Free coffee! (click)', 2);
  for (let i = 0; i < 3; i++) {
    const tx = CX - 7 + i * 7;
    disc(cafe, 'Table', tx, 3.4, CZ + 4, 4, 0.4, '#f8f8f8', 'Marble');
    part(cafe, { name: 'TableLeg', size: [0.5, 2.6, 0.5], pos: [tx, 2.2, CZ + 4], color: '#2b2b2b', material: 'Metal' });
    for (const dx of [-2.6, 2.6]) part(cafe, { cls: 'Seat', name: 'Chair', size: [1.8, 0.6, 1.8], pos: [tx + dx, 2.2, CZ + 4], color: '#c4281c' });
  }

  // ---------------------------------------------------------------- clock tower
  const clock = model(ws, 'Clock Tower');
  const KX = -35, KZ = -30;
  part(clock, { name: 'Base', size: [8, 30, 8], pos: [KX, 15, KZ], color: '#b38b6d', material: 'Brick' });
  part(clock, { name: 'Top', size: [9, 2, 9], pos: [KX, 31, KZ], color: '#635f62', material: 'Concrete' });
  part(clock, { cls: 'WedgePart', name: 'Roof', size: [9, 6, 4.5], pos: [KX, 35, KZ - 2.25], color: '#3b5b3b' });
  part(clock, { cls: 'WedgePart', name: 'Roof', size: [9, 6, 4.5], pos: [KX, 35, KZ + 2.25], rot: [0, 180, 0], color: '#3b5b3b' });
  const face = part(clock, { name: 'ClockFace', size: [5, 5, 0.3], pos: [KX, 24, KZ + 4.1], color: '#f8f8f8', material: 'SmoothPlastic' });
  label(face, '12:00', 0);
  light(face, '#fff6c8', 14, 0.8);

  // ---------------------------------------------------------------- hill with a secret cave
  const hill = model(ws, 'Hill');
  const HX = -135, HZ = -140;
  part(hill, { cls: 'WedgePart', name: 'Slope', size: [40, 18, 30], pos: [HX, 9, HZ + 30], rot: [0, 180, 0], color: '#3f8a3f', material: 'Grass' });
  part(hill, { name: 'Top', size: [40, 18, 30], pos: [HX, 9, HZ], color: '#3f8a3f', material: 'Grass' });
  part(hill, { cls: 'WedgePart', name: 'Slope', size: [40, 18, 30], pos: [HX, 9, HZ - 30], color: '#3f8a3f', material: 'Grass' });
  tree(hill, HX + 8, HZ - 2, 18, 1.1);
  const bench = part(hill, { cls: 'Seat', name: 'Lookout Bench', size: [6, 1, 2], pos: [HX - 6, 18.8, HZ + 4], color: '#7c5c46', material: 'WoodPlanks' });
  label(bench, 'Lookout', 2);
  // the cave: a dark room inside the hill, the way in is behind the bushes
  const cave = model(ws, 'SecretCave');
  part(cave, { name: 'Bush', size: [8, 5, 3], pos: [HX + 21.5, 2.5, HZ - 4], color: '#2f6b2f', material: 'Grass', canCollide: false, transparency: 0.1 });
  part(cave, { name: 'CaveFloor', size: [16, 0.4, 10], pos: [HX + 10, 0.4, HZ], color: '#3a3346', material: 'Slate' });
  const crystal = part(cave, { name: 'SecretCrystal', size: [2, 4, 2], pos: [HX + 6, 2.8, HZ], rot: [0, 45, 15], color: '#b45cff', material: 'Neon', canCollide: false });
  light(crystal, '#b45cff', 18, 2);
  inst(crystal, 'Sparkles', { SparkleColor: Color3.fromHex('#e0a8ff') });
  label(crystal, 'A SECRET CRYSTAL', 3);
  // cut the room out of the hill block: the hill's middle part is split in two around it
  const topPart = hill.FindFirstChild('Top');
  topPart.Destroy();
  part(hill, { name: 'Top', size: [40, 12, 30], pos: [HX, 12, HZ], color: '#3f8a3f', material: 'Grass' });
  part(hill, { name: 'Top', size: [20, 6, 30], pos: [HX - 10, 3, HZ], color: '#3f8a3f', material: 'Grass' });
  part(hill, { name: 'Top', size: [20, 6, 10], pos: [HX + 10, 3, HZ - 10], color: '#3f8a3f', material: 'Grass' });
  part(hill, { name: 'Top', size: [20, 6, 10], pos: [HX + 10, 3, HZ + 10], color: '#3f8a3f', material: 'Grass' });

  // ---------------------------------------------------------------- teleporters
  const tps = folder(ws, 'Teleporters');
  const pair = [['Playground', PX + 18, PZ - 14, '#00e5ff'], ['Lake', LX + 36, LZ - 32, '#00e5ff']];
  for (const [name, x, z, c] of pair) {
    const pad = part(tps, { name: 'Teleporter', size: [5, 0.4, 5], pos: [x, 0.5, z], color: c, material: 'Neon' });
    inst(pad, 'StringValue', { Name: 'Goes', Value: name === 'Lake' ? 'Playground' : 'Lake' });
    inst(pad, 'StringValue', { Name: 'Place', Value: name });
    label(pad, `Teleport to the ${name === 'Lake' ? 'playground' : 'lake'}`, 2);
  }

  script(g.ServerScriptService, 'TownFun', `
-- Crossroads: lamps at night, trampolines, the merry-go-round, the clock,
-- the treasure, the sky obby, the secret crystal, coffee and teleporters.
local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local BadgeService = game:GetService("BadgeService")

local function playerOf(hit)
	local char = hit and hit.Parent
	local p = char and Players:GetPlayerFromCharacter(char)
	return p, char, char and char:FindFirstChild("HumanoidRootPart")
end
local function badge(p, name, text)
	if BadgeService:AwardBadge(p.UserId, name) then
		p:Notify("Badge: " .. name .. "! " .. (text or ""))
	end
end

-- trampolines
local bounced = {}
for _, t in ipairs(workspace.Trampolines:GetChildren()) do
	if t.Name == "Trampoline" then
		t.Touched:Connect(function(hit)
			local p, char, root = playerOf(hit)
			if not root or bounced[p] then return end
			bounced[p] = true
			root.Velocity = Vector3.new(0, 115, 0)
			wait(0.6)
			bounced[p] = nil
		end)
	end
end

-- the treasure chest
local opened = {}
workspace.Lake.TreasureChest.Lid.ClickDetector.MouseClick:Connect(function(p)
	if opened[p] then return end
	opened[p] = true
	p:ShowMessage("You found the TREASURE!", 3, Color3.fromRGB(255, 196, 0))
	badge(p, "Treasure Hunter", "You found the treasure on the island.")
	local char = p.Character
	if char and char:FindFirstChild("Torso") and not char.Torso:FindFirstChild("Sparkles") then
		Instance.new("Sparkles", char.Torso)
	end
end)

-- the sky obby trophy, and the way back down
local SX, SZ = ${SX}, ${SZ}
workspace.SkyIsland.Trophy.Touched:Connect(function(hit)
	local p = playerOf(hit)
	if not p then return end
	badge(p, "Sky Climber", "You climbed the sky obby!")
end)
workspace.SkyIsland.TeleportDown.Touched:Connect(function(hit)
	local p, char, root = playerOf(hit)
	if root then char:MoveTo(Vector3.new(SX + 6, 4, SZ + 6)) end
end)

-- the secret crystal in the hill
workspace.SecretCave.SecretCrystal.Touched:Connect(function(hit)
	local p = playerOf(hit)
	if not p then return end
	badge(p, "Cave Explorer", "You found the secret cave!")
end)

-- free coffee
workspace["Robis Cafe"].CoffeeMachine.ClickDetector.MouseClick:Connect(function(p)
	p:Notify("Here's your coffee! You feel faster for 10 seconds.")
	local h = p.Character and p.Character:FindFirstChild("Humanoid")
	if h and h.WalkSpeed < 24 then
		h.WalkSpeed = 24
		delay(10, function() if h and h.WalkSpeed == 24 then h.WalkSpeed = 16 end end)
	end
end)

-- teleporters
local tpBusy = {}
local pads = {}
for _, pad in ipairs(workspace.Teleporters:GetChildren()) do pads[pad.Place.Value] = pad end
for _, pad in ipairs(workspace.Teleporters:GetChildren()) do
	pad.Touched:Connect(function(hit)
		local p, char, root = playerOf(hit)
		if not root or tpBusy[p] then return end
		tpBusy[p] = true
		local to = pads[pad.Goes.Value]
		if to then char:MoveTo(to.Position + Vector3.new(0, 4, 0) + Vector3.new(4, 0, 0)) end
		wait(2)
		tpBusy[p] = nil
	end)
end

-- lamps at night, the clock, the merry-go-round
local lights = {}
for _, d in ipairs(workspace.StreetLamps:GetDescendants()) do
	if d:IsA("PointLight") then table.insert(lights, d) end
end
local clockText = workspace["Clock Tower"].ClockFace.BillboardText
local merry = workspace.Playground.MerryGoRound
local mcf = merry.CFrame
local angle = 0
local wasNight = nil
while true do
	local t = Lighting.ClockTime
	local night = t < 6.5 or t > 18
	if night ~= wasNight then
		wasNight = night
		for _, l in ipairs(lights) do l.Brightness = night and 2 or 0 end
	end
	local h = math.floor(t)
	local m = math.floor((t - h) * 60)
	clockText.Text = string.format("%02d:%02d", h, m)
	angle = angle + 0.04
	merry.CFrame = mcf * CFrame.Angles(angle, 0, 0)
	wait(0.1)
end
`);
}
