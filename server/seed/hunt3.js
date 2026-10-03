// More hub maps for custom The Hunt events (Admin Panel -> The Hunt -> new event
// -> Map). One builder, four themes: a snowy Frost Festival, a Haunted Night
// graveyard, a pastel Candy Kingdom and a Sunken City under the sea.
// Like the Another Dimension hub: portals to every game of the event, the
// prizes on pedestals, 6 collectibles hidden around the map (the hub prize),
// the team goal on a big sign, jump pads and a fun button.
import { Vector3, Color3 } from '../../shared/engine/types.js';
import { newGame, part, model, folder, script, inst, finish } from './builder.js';

export const HUB_THEMES = {
  winter: {
    title: 'Frost Festival', collectible: 'present', collectibles: 'presents',
    ground: '#f4f8ff', groundMat: 'Sand', rim: '#9fd8ff', path: '#c9e6ff', sky: [[200, 220, 245], [180, 200, 230]], clock: 15, fog: [230, 240, 255],
    portal: ['#4fc3ff', '#ff4d6d', '#38d27a', '#ffd166'], pillar: '#ffffff', pillarMat: 'Ice', frag: ['#ff4d6d', '#ffd166'],
    button: 'LET IT SNOW', welcome: 'Welcome to the Frost Festival! Find the 6 hidden presents.',
  },
  spooky: {
    title: 'Haunted Night', collectible: 'pumpkin', collectibles: 'pumpkins',
    ground: '#2d3a24', groundMat: 'Grass', rim: '#ff7a1a', path: '#4a4035', sky: [[70, 50, 100], [60, 40, 90]], clock: 0, fog: [30, 15, 45],
    portal: ['#ff7a1a', '#9b5cff', '#7dff6b', '#ff3b3b'], pillar: '#3b3640', pillarMat: 'Slate', frag: ['#ff7a1a', '#2d7a1f'],
    button: 'SPOOK', welcome: 'Welcome to the Haunted Night... Find the 6 hidden pumpkins. If you dare.',
  },
  candy: {
    title: 'Candy Kingdom', collectible: 'candy', collectibles: 'candies',
    ground: '#ffd6ec', groundMat: 'SmoothPlastic', rim: '#ff5fa2', path: '#fff1c9', sky: [[255, 220, 240], [250, 215, 235]], clock: 13, fog: [255, 225, 245],
    portal: ['#ff5fa2', '#5fd3ff', '#b6ff5f', '#ffb85f'], pillar: '#ffffff', pillarMat: 'SmoothPlastic', frag: ['#ff3b8d', '#ffffff'],
    button: 'SUGAR RUSH', welcome: 'Welcome to the Candy Kingdom! Find the 6 hidden candies.',
  },
  ocean: {
    title: 'Sunken City', collectible: 'pearl', collectibles: 'pearls',
    ground: '#e3d29a', groundMat: 'Sand', rim: '#1fd1c9', path: '#c9b77e', sky: [[60, 140, 190], [50, 120, 170]], clock: 12, fog: [20, 90, 140],
    portal: ['#1fd1c9', '#5f8bff', '#ff7ab6', '#ffe066'], pillar: '#bfc9c2', pillarMat: 'Marble', frag: ['#f6f2ff', '#9ad7ff'],
    button: 'BUBBLES', welcome: 'Welcome to the Sunken City! Find the 6 hidden pearls.',
  },
};

function light(p, color, range = 18, brightness = 1.5) {
  inst(p, 'PointLight', { Color: Color3.fromHex(color), Range: range, Brightness: brightness });
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function disc(parent, name, x, y, z, d, h, color, material, o = {}) {
  return part(parent, { name, size: [h, d, d], pos: [x, y - h / 2, z], rot: [0, 0, 90], color, material, shape: 'Cylinder', ...o });
}
const label = (p, text, up = 3) => inst(p, 'BillboardText', { Text: text, StudsOffset: new Vector3(0, up, 0) });

// --------------------------------------------------------------- the landmark in the middle
// Every theme: something to climb, with a collectible on top (spot 0).
function landmark(ws, theme, t) {
  const m = model(ws, 'Landmark');
  if (theme === 'winter') {
    // a giant Christmas tree with a star, and a spiral of ice steps around it
    part(m, { name: 'Trunk', size: [3, 6, 3], pos: [0, 4, 0], color: '#6b4226', material: 'Wood' });
    [[22, 8], [17, 15], [12, 21], [7, 26]].forEach(([d, y], i) => {
      part(m, { name: 'Tree', size: [7, d, d], pos: [0, y, 0], rot: [0, 0, 90], color: i % 2 ? '#1f7a3a' : '#23893f', material: 'Grass', shape: 'Cylinder', canCollide: false });
    });
    const star = part(m, { name: 'TreeStar', size: [3, 3, 3], pos: [0, 31, 0], rot: [45, 0, 45], color: '#ffd166', material: 'Neon', canCollide: false });
    light(star, '#ffd166', 40, 2);
    for (let i = 0; i < 24; i++) {
      const a = i * 0.9, r = 4 + (i % 4) * 2.2, y = 6 + (i * 0.85);
      const b = part(m, { name: 'Ornament', size: [1, 1, 1], pos: [Math.sin(a) * r, y, Math.cos(a) * r], color: t.portal[i % 4], material: 'Neon', shape: 'Ball', canCollide: false });
      if (i % 6 === 0) light(b, t.portal[i % 4], 8, 0.8);
    }
  } else if (theme === 'spooky') {
    // a haunted tower with a glowing window
    part(m, { name: 'Tower', size: [10, 26, 10], pos: [0, 14, 0], color: '#3b3640', material: 'Slate', canCollide: false });
    part(m, { name: 'Roof', size: [12, 8, 12], pos: [0, 31, 0], rot: [0, 45, 0], color: '#241f2b', material: 'Slate', canCollide: false });
    const win = part(m, { name: 'Window', size: [3, 4, 0.4], pos: [0, 20, 5.1], color: '#ffb347', material: 'Neon', canCollide: false });
    light(win, '#ffb347', 30, 1.5);
    const moon = part(m, { name: 'Moon', size: [40, 40, 40], pos: [-160, 140, -260], color: '#fff6d6', material: 'Neon', shape: 'Ball', canCollide: false });
    light(moon, '#fff6d6', 60, 0.6);
  } else if (theme === 'candy') {
    // a candy castle tower with a lollipop on top
    part(m, { name: 'Tower', size: [26, 11, 11], pos: [0, 14, 0], rot: [0, 0, 90], color: '#ffb3d9', material: 'SmoothPlastic', shape: 'Cylinder', canCollide: false });
    for (let i = 0; i < 6; i++) part(m, { name: 'Stripe', size: [0.8, 11.4, 11.4], pos: [0, 4 + i * 4, 0], rot: [0, 0, 90], color: '#ffffff', material: 'SmoothPlastic', shape: 'Cylinder', canCollide: false });
    part(m, { name: 'Stick', size: [0.8, 8, 0.8], pos: [0, 31, 0], color: '#ffffff', material: 'SmoothPlastic' });
    const pop = part(m, { name: 'Lollipop', size: [1.2, 7, 7], pos: [0, 37, 0], rot: [0, 90, 0], color: '#ff3b8d', material: 'Neon', shape: 'Cylinder', canCollide: false });
    light(pop, '#ff3b8d', 30, 1.2);
  } else {
    // a sunken temple with a big glowing shell
    part(m, { name: 'Temple', size: [20, 3, 20], pos: [0, 2.5, 0], color: '#bfc9c2', material: 'Marble' });
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) part(m, { name: 'Column', size: [18, 2.4, 2.4], pos: [x, 13, z], rot: [0, 0, 90], color: '#bfc9c2', material: 'Marble', shape: 'Cylinder', canCollide: false });
    part(m, { name: 'TempleRoof', size: [22, 2, 22], pos: [0, 23, 0], color: '#a9b5ad', material: 'Marble', canCollide: false });
    const shell = part(m, { name: 'Shell', size: [6, 6, 6], pos: [0, 7, 0], color: '#ffb3d1', material: 'Neon', shape: 'Ball', canCollide: false });
    light(shell, '#ff7ab6', 30, 1.5);
  }
  // the way up: a spiral of steps around the landmark, ending on a top platform
  const steps = model(ws, 'Steps');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 1.8 + Math.PI * 0.2;
    disc(steps, 'Step', Math.sin(a) * 13, 4 + i * 3.6, Math.cos(a) * 13, 5.5, 1, i % 2 ? t.rim : t.pillar, theme === 'winter' ? 'Ice' : 'SmoothPlastic');
  }
  disc(steps, 'Top', 0, theme === 'candy' ? 28 : 33, 0, 7, 1, t.rim, 'SmoothPlastic');
  return [0, (theme === 'candy' ? 28 : 33) + 2, 0];
}

// --------------------------------------------------------------- decorations around the plaza
function decor(ws, theme, t, rand) {
  const d = folder(ws, 'Decor');
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = 50 + rand() * 40;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (theme === 'winter') {
      if (i % 2) {
        part(d, { name: 'Pine', size: [8, 6, 6], pos: [x, 5, z], rot: [0, 0, 90], color: '#1f6b35', material: 'Grass', shape: 'Cylinder', canCollide: false });
        part(d, { name: 'PineTop', size: [5, 3.5, 3.5], pos: [x, 10, z], rot: [0, 0, 90], color: '#f4f8ff', material: 'Sand', shape: 'Cylinder', canCollide: false });
      } else {
        part(d, { name: 'Snowman', size: [4, 4, 4], pos: [x, 2.5, z], color: '#ffffff', material: 'Sand', shape: 'Ball' });
        part(d, { name: 'SnowmanHead', size: [2.6, 2.6, 2.6], pos: [x, 5.4, z], color: '#ffffff', material: 'Sand', shape: 'Ball' });
        part(d, { name: 'Nose', size: [0.4, 0.4, 1.4], pos: [x, 5.4, z + 1.5], color: '#ff8a3d', material: 'SmoothPlastic', canCollide: false });
      }
    } else if (theme === 'spooky') {
      if (i % 3 === 0) {
        part(d, { name: 'Grave', size: [3, 4, 0.8], pos: [x, 2.5, z], rot: [0, rand() * 40 - 20, rand() * 10 - 5], color: '#8a8590', material: 'Slate' });
      } else if (i % 3 === 1) {
        part(d, { name: 'DeadTree', size: [1.2, 12, 1.2], pos: [x, 6.5, z], rot: [rand() * 10, 0, rand() * 10], color: '#2b2118', material: 'Wood', canCollide: false });
        part(d, { name: 'Branch', size: [6, 0.6, 0.6], pos: [x + 1.5, 10, z], rot: [0, rand() * 180, 30], color: '#2b2118', material: 'Wood', canCollide: false });
      } else {
        const p = part(d, { name: 'Jack', size: [2.4, 2, 2.4], pos: [x, 1.5, z], color: '#ff7a1a', material: 'SmoothPlastic', shape: 'Ball' });
        light(p, '#ff7a1a', 8, 0.8);
      }
    } else if (theme === 'candy') {
      const c = t.portal[i % 4];
      part(d, { name: 'CandyCane', size: [0.9, 10, 0.9], pos: [x, 5.5, z], color: '#ffffff', material: 'SmoothPlastic', canCollide: false });
      part(d, { name: 'CaneHook', size: [3, 0.9, 0.9], pos: [x + 1, 10.5, z], color: '#ff3b5c', material: 'SmoothPlastic', canCollide: false });
      if (i % 2) part(d, { name: 'Gumdrop', size: [3, 2.4, 3], pos: [x + 3, 1.8, z + 2], color: c, material: 'Glass', shape: 'Ball', transparency: 0.15 });
    } else {
      const c = ['#ff7ab6', '#ff9a5c', '#b45cff'][i % 3];
      part(d, { name: 'Coral', size: [1.4, 3 + rand() * 6, 1.4], pos: [x, 3, z], rot: [rand() * 20, 0, rand() * 20], color: c, material: 'SmoothPlastic', canCollide: false });
      if (i % 4 === 0) part(d, { name: 'Ruin', size: [3, 6 + rand() * 6, 3], pos: [x + 4, 4, z], rot: [rand() * 15, 0, rand() * 15], color: '#a9b5ad', material: 'Marble' });
      if (i % 3 === 0) part(d, { name: 'Kelp', size: [0.6, 14, 0.6], pos: [x - 3, 7, z], color: '#2f8f4f', material: 'Grass', canCollide: false });
    }
  }
  return d;
}

// prizes: [{ name, need | how }]
export function buildThemedHub(games, prizes = [], opts = {}) {
  const theme = HUB_THEMES[opts.theme] ? opts.theme : 'winter';
  const t = HUB_THEMES[theme];
  const name = String(opts.name || 'The Hunt: ' + t.title).replace(/["\\]/g, '');
  const g = newGame();
  const ws = g.Workspace;
  const L = g.Lighting;
  L.ClockTime = t.clock;
  L.Brightness = theme === 'spooky' ? 0.5 : 1;
  L.Ambient = Color3.fromRGB(...t.sky[0]);
  L.OutdoorAmbient = Color3.fromRGB(...t.sky[1]);
  L.FogEnd = theme === 'ocean' ? 260 : theme === 'spooky' ? 320 : 900;
  L.FogColor = Color3.fromRGB(...t.fog);
  if (theme === 'ocean') ws.Gravity = 110; // a bit floaty under the sea
  const rand = rng(777 + theme.length);

  // ---------------------------------------------------------------- the ground
  const ground = model(ws, 'Ground');
  disc(ground, 'Plaza', 0, 1, 0, 210, 2, t.ground, t.groundMat, { props: { Locked: true } });
  disc(ground, 'PlazaRim', 0, 1.05, 0, 44, 0.1, t.rim, 'Neon', { canCollide: false, transparency: 0.4 });
  disc(ground, 'Center', 0, 1.08, 0, 40, 0.1, t.path, 'SmoothPlastic', { canCollide: false });
  part(ws, { cls: 'SpawnLocation', name: 'Spawn', size: [10, 1, 10], pos: [0, 1.5, 32], color: t.rim, material: 'Neon', top: 'Smooth', props: { Duration: 0 } });

  const top = landmark(ws, theme, t);
  decor(ws, theme, t, rand);

  // ---------------------------------------------------------------- info sign + team goal
  const board = model(ws, 'InfoBoard');
  part(board, { name: 'Board', size: [24, 10, 1], pos: [0, 7, 44], color: theme === 'spooky' ? '#1a1420' : '#ffffff', material: 'SmoothPlastic' });
  part(board, { name: 'Frame', size: [25, 11, 0.8], pos: [0, 7, 44.5], color: t.rim, material: 'Neon' });
  label(part(board, { name: 'Title', size: [20, 1, 0.2], pos: [0, 11, 43.4], transparency: 1, canCollide: false }), name, 1);
  label(part(board, { name: 'HowTo', size: [20, 1, 0.2], pos: [0, 8, 43.4], transparency: 1, canCollide: false }), `Step into a portal -> do the quest or find the token -> win prizes!  Hidden here: 6 ${t.collectibles}.`, 0);
  label(part(board, { name: 'Goal', size: [20, 1, 0.2], pos: [0, 5, 43.4], transparency: 1, canCollide: false }), 'Team goal: ...', 0);

  // ---------------------------------------------------------------- the fun button + jump pads
  const fb = model(ws, 'FunButton');
  part(fb, { name: 'Stand', size: [3, 3, 3], pos: [16, 2.5, 40], color: t.pillar, material: t.pillarMat });
  const btn = part(fb, { name: 'Button', size: [2.4, 0.8, 2.4], pos: [16, 4.4, 40], color: t.rim, material: 'Neon' });
  inst(btn, 'ClickDetector', { MaxActivationDistance: 20 });
  label(btn, `${t.button} (click)`, 3);
  const pads = folder(ws, 'JumpPads');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pad = part(pads, { name: 'JumpPad', size: [5, 0.4, 5], pos: [Math.sin(a) * 30, 2.2, Math.cos(a) * 30], color: t.portal[i % 4], material: 'Neon' });
    label(pad, 'JUMP!', 2.5);
  }

  // ---------------------------------------------------------------- prizes around the landmark
  if (prizes.length) {
    const hall = model(ws, 'Prizes');
    prizes.forEach((p, i) => {
      const a = ((i + 0.5) / prizes.length) * Math.PI * 2;
      const px = Math.sin(a) * 21, pz = Math.cos(a) * 21;
      const col = t.portal[i % 4];
      disc(hall, 'Pedestal', px, 3.2, pz, 3.6, 2.2, t.pillar, t.pillarMat);
      disc(hall, 'PedestalTrim', px, 3.3, pz, 4, 0.3, col, 'Neon', { canCollide: false });
      const orb = part(hall, { name: 'Prize', size: [2, 2, 2], pos: [px, 5.4, pz], rot: [45, 0, 45], color: col, material: 'Neon', canCollide: false });
      label(orb, p.bonus ? `BONUS: ${p.name}` : `${p.need}: ${p.name}`, 2.2);
    });
  }

  // ---------------------------------------------------------------- portals: arches in a big ring
  const n = Math.max(games.length, 1);
  const R = Math.max(62, Math.ceil((n * 18) / (2 * Math.PI)));
  const portals = folder(ws, 'Portals');
  games.forEach((game, i) => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const c = game.byPlayer ? '#ff4d8d' : t.portal[i % 4];
    const deg = (a * 180) / Math.PI;
    const m = model(portals, game.name);
    disc(m, 'Base', x, 1.6, z, 14, 0.6, t.path, 'SmoothPlastic');
    for (const s of [-1, 1]) {
      part(m, { name: 'Pillar', size: [1.6, 12, 1.6], pos: [x + Math.cos(a) * s * 5.5, 7.6, z - Math.sin(a) * s * 5.5], rot: [0, deg, 0], color: t.pillar, material: t.pillarMat });
    }
    part(m, { name: 'Arch', size: [13, 1.6, 1.8], pos: [x, 14.4, z], rot: [0, deg, 0], color: c, material: 'Neon', canCollide: false });
    const gate = part(m, { name: 'Portal', size: [9.4, 11, 0.6], pos: [x, 7.6, z], rot: [0, deg, 0], color: c, material: 'Neon', transparency: 0.35, canCollide: false });
    inst(gate, 'IntValue', { Name: 'PlaceId', Value: game.id });
    label(gate, game.name + (game.byPlayer ? '  (by ' + game.creator + ')' : ''), 9);
    inst(gate, 'Sparkles', { SparkleColor: Color3.fromHex(c) });
    light(gate, c, 20, 1.3);
  });

  // ---------------------------------------------------------------- 6 collectibles
  // on top of the landmark, on the jump-pad ledges, behind the sign, far out.
  const ledges = folder(ws, 'Ledges');
  const spots = [top];
  for (let i = 0; i < 3; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = Math.sin(a) * 36, lz = Math.cos(a) * 36, ly = 26 + i * 3;
    disc(ledges, 'Ledge', lx, ly, lz, 9, 1.2, t.rim, 'SmoothPlastic');
    spots.push([lx, ly + 2, lz]);
  }
  spots.push([0, 3, 50]); // behind the info sign
  const fa = rand() * Math.PI * 2;
  spots.push([Math.sin(fa) * (R + 18), 3, Math.cos(fa) * (R + 18)]); // out past the portals
  const frags = folder(ws, 'StarFragments');
  spots.forEach(([x, y, z], i) => {
    const shape = theme === 'ocean' || theme === 'spooky' ? 'Ball' : 'Block';
    const f = part(frags, { name: 'Fragment', size: theme === 'ocean' ? [1.4, 1.4, 1.4] : [1.8, 1.8, 1.8], pos: [x, y, z], rot: shape === 'Block' ? [0, 20, 0] : [0, 0, 0], color: t.frag[0], material: theme === 'ocean' ? 'Neon' : 'SmoothPlastic', shape, canCollide: false });
    inst(f, 'IntValue', { Name: 'Index', Value: i + 1 });
    inst(f, 'Sparkles', { SparkleColor: Color3.fromHex(t.frag[1]) });
    light(f, t.frag[0], 10, 1);
  });

  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  const stat = cap(t.collectibles);
  script(g.ServerScriptService, 'Hunt', `
-- ${name}: portals, jump pads, 6 hidden ${t.collectibles}, the fun button and the team goal.
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local Debris = game:GetService("Debris")
local Hunt = game:GetService("HuntService")
local hint = Instance.new("Hint", workspace)

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

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	ls.Parent = player
	local found = Instance.new("StringValue")
	found.Name = "Found"
	local p = Hunt:GetProgress(player.UserId)
	found.Value = p.Collected .. "/" .. p.Total
	found.Parent = ls
	local got = Instance.new("StringValue")
	got.Name = "${stat}"
	local f = Hunt:CollectFragment(player.UserId, 0)
	got.Value = f.Count .. "/" .. f.Total
	got.Parent = ls
	wait(1.5)
	player:Notify("${t.welcome}")
end)

local busy = {}
for _, portal in ipairs(workspace.Portals:GetDescendants()) do
	if portal.Name == "Portal" then
		portal.Touched:Connect(function(hit)
			local player = charOf(hit)
			if not player or busy[player] then return end
			busy[player] = true
			player:Notify("Going to " .. portal.Parent.Name .. "...")
			wait(0.5)
			TeleportService:Teleport(portal.PlaceId.Value, player)
			wait(3)
			busy[player] = nil
		end)
	end
end

local jumped = {}
for _, pad in ipairs(workspace.JumpPads:GetChildren()) do
	pad.Touched:Connect(function(hit)
		local player, char, root = charOf(hit)
		if not root or jumped[player] then return end
		jumped[player] = true
		root.Velocity = Vector3.new(0, 105, 0)
		wait(1)
		jumped[player] = nil
	end)
end

for _, frag in ipairs(workspace.StarFragments:GetChildren()) do
	frag.Touched:Connect(function(hit)
		local player = charOf(hit)
		if not player then return end
		local r = Hunt:CollectFragment(player.UserId, frag.Index.Value)
		if not r.New then return end
		local ls = player:FindFirstChild("leaderstats")
		if ls then ls:FindFirstChild("${stat}").Value = r.Count .. "/" .. r.Total end
		if r.Prize ~= "" then
			player:Notify("All ${t.collectibles} found! You won: " .. r.Prize .. "!")
		else
			player:Notify("${cap(t.collectible)} " .. r.Count .. "/" .. r.Total .. " found!")
		end
	end)
end

-- the fun button: a burst of ${theme === 'winter' ? 'snow' : theme === 'spooky' ? 'bats' : theme === 'candy' ? 'candy' : 'bubbles'} over the plaza
local cooling = false
local COLORS = { ${t.portal.map((c) => `Color3.fromHex("${c}")`).join(', ')} }
workspace.FunButton.Button.ClickDetector.MouseClick:Connect(function(player)
	if cooling then return end
	cooling = true
	say(player.Name .. " pressed ${t.button}!", 4)
	for i = 1, 40 do
		local b = Instance.new("Part")
		b.Name = "Fun"
		b.Shape = Enum.PartType.Ball
		b.Size = Vector3.new(1, 1, 1) * (0.6 + math.random() * 1.2)
		b.Material = Enum.Material.Neon
		b.Color = ${theme === 'winter' ? 'Color3.new(1, 1, 1)' : 'COLORS[math.random(1, #COLORS)]'}
		b.CanCollide = false
		b.Anchored = false
		b.Position = Vector3.new(math.random(-40, 40), ${theme === 'ocean' ? '2' : '60'} + math.random() * 10, math.random(-40, 40))
		b.Velocity = Vector3.new(0, ${theme === 'ocean' ? '30' : '0'}, 0)
		b.Parent = workspace
		Debris:AddItem(b, 6)
		wait(0.05)
	end
	wait(10)
	cooling = false
end)

-- the team goal, on the sign
spawn(function()
	local goal = workspace.InfoBoard.Goal.BillboardText
	while true do
		local g = Hunt:GetGlobal()
		if g.Open then
			goal.Text = "TEAM GOAL REACHED! (" .. g.Shards .. " found by everyone)"
		else
			goal.Text = "Team goal: " .. g.Shards .. " / " .. g.Goal .. " - everyone together!"
		end
		wait(10)
	end
end)

-- the collectibles spin
local list = workspace.StarFragments:GetChildren()
local t = 0
while true do
	t = t + 0.1
	for i, f in ipairs(list) do
		f.CFrame = CFrame.new(f.Position) * CFrame.Angles(0, t + i, 0)
	end
	wait(0.1)
end
`);
  return finish(g, { name });
}
