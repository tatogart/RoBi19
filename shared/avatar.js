// Avatar data model and the built-in catalog shared by server and client.

// The classic 2019 skin-tone / body colour palette (subset).
export const BODY_COLORS = [
  '#f8f8f8', '#cdcdcd', '#a3a2a5', '#635f62', '#1b2a35', '#111111',
  '#f5cd30', '#ffff00', '#fdea8d', '#e09864', '#cc8e69', '#a0725b',
  '#7c5c46', '#56422f', '#ffc9c9', '#eab892', '#d7c59a', '#c4281c',
  '#ff0000', '#da8541', '#4b974b', '#00ff00', '#287f47', '#0d69ac',
  '#6e99ca', '#b4d2e4', '#04afec', '#6b327c', '#aa00aa', '#ff66cc',
];

export const DEFAULT_AVATAR = {
  bodyColors: {
    head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b',
  },
  wearing: [],
};

export const ITEM_TYPES = ['Hat', 'Hair', 'Face', 'Shirt', 'Pants', 'TShirt', 'Gear'];
export const WEAR_LIMITS = { Hat: 3, Hair: 1, Face: 1, Shirt: 1, Pants: 1, TShirt: 1, Gear: 1 };

// Built-in catalog. `data` tells the renderer how to draw the item.
export const CATALOG = [
  // Hats (rendered from procedural meshes, see public/js/render/avatar.js)
  { name: 'Classic Robis Cap', type: 'Hat', price: 0, data: { model: 'cap', color: '#c4281c', accent: '#f8f8f8' }, desc: 'The cap everyone had in 2019. Free!' },
  { name: 'Traffic Cone', type: 'Hat', price: 25, data: { model: 'cone', color: '#ff7a00', accent: '#ffffff' }, desc: 'Safety first.' },
  { name: 'Stylish Top Hat', type: 'Hat', price: 150, data: { model: 'tophat', color: '#1b1b1b', accent: '#c4281c' }, desc: 'For the classy builder.' },
  { name: 'Golden Crown', type: 'Hat', price: 1000, data: { model: 'crown', color: '#ffc400', accent: '#e8002a' }, desc: 'Rule your server.' },
  { name: 'Bighead', type: 'Hat', price: 50, data: { model: 'bighead', color: '#f5cd30' }, desc: 'A bigger head. Classic.' },
  { name: 'Viking Helm', type: 'Hat', price: 200, data: { model: 'viking', color: '#8a8a8a', accent: '#f1e7c9' }, desc: 'Horns included.' },
  { name: 'Party Hat', type: 'Hat', price: 10, data: { model: 'party', color: '#ff47b6', accent: '#ffe600' }, desc: 'It is always a party.' },
  { name: 'Headphones', type: 'Hat', price: 80, data: { model: 'headphones', color: '#222222', accent: '#00a2ff' }, desc: 'Listen to the oof.' },
  { name: 'Sparkle Time Halo', type: 'Hat', price: 5000, limited: true, data: { model: 'halo', color: '#fff6a8', accent: '#ffffff' }, desc: 'Limited. Only for true Robloxians... Robisians.' },
  { name: 'Dominator of Robis', type: 'Hat', price: 25000, limited: true, data: { model: 'dominator', color: '#2a2a2a', accent: '#c4281c' }, desc: 'Legendary limited hat.' },
  { name: 'Beanie', type: 'Hat', price: 40, data: { model: 'beanie', color: '#2f6fd6', accent: '#ffffff' }, desc: 'Warm and cozy.' },
  { name: 'Pirate Hat', type: 'Hat', price: 120, data: { model: 'pirate', color: '#2b1d14', accent: '#f8f8f8' }, desc: 'Arr!' },
  { name: 'Witch Hat', type: 'Hat', price: 90, data: { model: 'witch', color: '#3b1f5c', accent: '#8bd94a' }, desc: 'Spooky season.' },
  { name: 'Sunglasses', type: 'Hat', price: 35, data: { model: 'shades', color: '#111111', accent: '#333333' }, desc: 'Deal with it.' },
  { name: 'Tiny Wings', type: 'Hat', price: 300, data: { model: 'wings', color: '#ffffff', accent: '#bde6ff' }, desc: 'Back accessory.' },
  // Hair
  { name: 'Bacon Hair', type: 'Hair', price: 0, data: { model: 'bacon', color: '#6b3a1e' }, desc: 'The legendary default hair.' },
  { name: 'Brown Charmer Hair', type: 'Hair', price: 60, data: { model: 'charmer', color: '#4a2c16' }, desc: 'Popular in 2019.' },
  { name: 'Blonde Spiked Hair', type: 'Hair', price: 60, data: { model: 'spiky', color: '#f2cf5b' }, desc: 'Super saiyan vibes.' },
  { name: 'Pal Hair', type: 'Hair', price: 0, data: { model: 'pal', color: '#2a1a0f' }, desc: 'Pal hair, the other default.' },
  { name: 'Long Pink Hair', type: 'Hair', price: 75, data: { model: 'long', color: '#ff8fcf' }, desc: 'Flowy.' },
  // Faces
  { name: 'Smile', type: 'Face', price: 0, data: { face: 'smile' }, desc: 'The classic face.' },
  { name: 'Epic Face', type: 'Face', price: 250, data: { face: 'epic' }, desc: 'Epic.' },
  { name: 'Man Face', type: 'Face', price: 0, data: { face: 'man' }, desc: 'Default man face.' },
  { name: 'Woman Face', type: 'Face', price: 0, data: { face: 'woman' }, desc: 'Default woman face.' },
  { name: 'Super Super Happy Face', type: 'Face', price: 400, data: { face: 'happy' }, desc: 'SO happy.' },
  { name: 'Silly Fun', type: 'Face', price: 30, data: { face: 'silly' }, desc: ':P' },
  { name: 'Chill', type: 'Face', price: 60, data: { face: 'chill' }, desc: 'Relaxed.' },
  { name: 'Beast Mode', type: 'Face', price: 999, limited: true, data: { face: 'beast' }, desc: 'Limited face.' },
  { name: 'Winning Smile', type: 'Face', price: 45, data: { face: 'winning' }, desc: 'Winning.' },
  { name: 'Shocked', type: 'Face', price: 20, data: { face: 'shocked' }, desc: 'O_O' },
  // Shirts
  { name: 'Blue Hoodie', type: 'Shirt', price: 5, data: { color: '#1e5fbf', accent: '#16468c', pattern: 'hoodie' }, desc: 'Comfy hoodie.' },
  { name: 'Red Plaid Shirt', type: 'Shirt', price: 5, data: { color: '#b3261e', accent: '#1b1b1b', pattern: 'plaid' }, desc: 'Lumberjack style.' },
  { name: 'Black Suit', type: 'Shirt', price: 30, data: { color: '#1c1c1c', accent: '#ffffff', pattern: 'suit' }, desc: 'Business Robisian.' },
  { name: 'Striped Tee', type: 'Shirt', price: 5, data: { color: '#ffffff', accent: '#2d7de0', pattern: 'stripes' }, desc: 'Stripes.' },
  { name: 'Green Camo Jacket', type: 'Shirt', price: 15, data: { color: '#4b5d2a', accent: '#2f3a1a', pattern: 'camo' }, desc: 'Camo.' },
  { name: 'Builders Club Shirt', type: 'Shirt', price: 50, data: { color: '#f2f2f2', accent: '#00a2ff', pattern: 'bc' }, desc: 'Remember BC?' },
  // Pants
  { name: 'Jeans', type: 'Pants', price: 5, data: { color: '#2d4f8a', accent: '#203a66', pattern: 'jeans' }, desc: 'Blue jeans.' },
  { name: 'Black Pants', type: 'Pants', price: 5, data: { color: '#1a1a1a', accent: '#333333', pattern: 'plain' }, desc: 'Classic black.' },
  { name: 'Khakis', type: 'Pants', price: 5, data: { color: '#bfa57a', accent: '#8f7a55', pattern: 'plain' }, desc: 'Casual.' },
  { name: 'Camo Pants', type: 'Pants', price: 10, data: { color: '#4b5d2a', accent: '#2f3a1a', pattern: 'camo' }, desc: 'Camo pants.' },
  { name: 'Suit Pants', type: 'Pants', price: 20, data: { color: '#1c1c1c', accent: '#111111', pattern: 'suit' }, desc: 'Matches the suit.' },
  // T-Shirts
  { name: 'Robis Logo T-Shirt', type: 'TShirt', price: 0, data: { graphic: 'logo' }, desc: 'Show your love.' },
  { name: 'I <3 Robis', type: 'TShirt', price: 2, data: { graphic: 'heart' }, desc: 'Heart tee.' },
  { name: 'Gold Star', type: 'TShirt', price: 2, data: { graphic: 'star' }, desc: 'You did great.' },
  { name: 'Oof', type: 'TShirt', price: 10, data: { graphic: 'oof' }, desc: 'OOF.' },
  { name: 'Noob', type: 'TShirt', price: 1, data: { graphic: 'noob' }, desc: 'Proudly noob.' },
  // Gear
  { name: 'Classic Sword', type: 'Gear', price: 100, data: { model: 'sword', color: '#b4b4b4' }, desc: 'The linked sword. Cosmetic.' },
  { name: 'Rocket Launcher', type: 'Gear', price: 250, data: { model: 'rocket', color: '#4b974b' }, desc: 'Cosmetic rocket launcher.' },
];

export function normalizeAvatar(a) {
  const out = JSON.parse(JSON.stringify(DEFAULT_AVATAR));
  if (a && a.bodyColors) {
    for (const k of Object.keys(out.bodyColors)) {
      if (typeof a.bodyColors[k] === 'string' && /^#[0-9a-f]{6}$/i.test(a.bodyColors[k])) out.bodyColors[k] = a.bodyColors[k].toLowerCase();
    }
  }
  if (a && Array.isArray(a.wearing)) out.wearing = a.wearing.filter((x) => Number.isInteger(x)).slice(0, 10);
  return out;
}

// Resolves an avatar (item ids) into renderable parts using an item lookup.
export function resolveAvatar(avatar, getItem) {
  const a = normalizeAvatar(avatar);
  const r = { bodyColors: a.bodyColors, hats: [], face: { face: 'smile' }, shirt: null, pants: null, tshirt: null, gear: null };
  for (const id of a.wearing) {
    const it = getItem(id);
    if (!it) continue;
    if (it.type === 'Hat' || it.type === 'Hair') r.hats.push(it.data);
    else if (it.type === 'Face') r.face = it.data;
    else if (it.type === 'Shirt') r.shirt = it.data;
    else if (it.type === 'Pants') r.pants = it.data;
    else if (it.type === 'TShirt') r.tshirt = it.data;
    else if (it.type === 'Gear') r.gear = it.data;
  }
  return r;
}
