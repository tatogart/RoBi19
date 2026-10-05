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

export const ITEM_TYPES = ['Hat', 'Hair', 'Accessory', 'Face', 'Shirt', 'Pants', 'TShirt', 'Gear', 'Pet'];
export const WEAR_LIMITS = { Hat: 3, Hair: 1, Accessory: 4, Face: 1, Shirt: 1, Pants: 1, TShirt: 1, Gear: 1, Pet: 1 };

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
  // ---- girls' collection (models: public/js/render/avatar.js)
  { name: 'Pink Pigtails', type: 'Hair', price: 65, data: { model: 'pigtails', color: '#ff8fcf', accent: '#ffffff' }, desc: 'Two bouncy pigtails with white ribbons.' },
  { name: 'Brown Pigtails', type: 'Hair', price: 50, data: { model: 'pigtails', color: '#6b3a1e', accent: '#ff5fa2' }, desc: 'Classic pigtails with pink ribbons.' },
  { name: 'Blonde Ponytail', type: 'Hair', price: 55, data: { model: 'ponytail', color: '#f2cf5b', accent: '#ff5fa2' }, desc: 'A high ponytail. Sporty and cute.' },
  { name: 'Black Ponytail', type: 'Hair', price: 55, data: { model: 'ponytail', color: '#1b1412', accent: '#e8413c' }, desc: 'Sleek and simple.' },
  { name: 'Cute Bun', type: 'Hair', price: 60, data: { model: 'bun', color: '#7a4a2a', accent: '#ff9ccf' }, desc: 'A neat bun on top with a scrunchie.' },
  { name: 'Lavender Bob', type: 'Hair', price: 70, data: { model: 'bob', color: '#b79cff' }, desc: 'A short bob with bangs in pastel purple.' },
  { name: 'Black Bob', type: 'Hair', price: 45, data: { model: 'bob', color: '#18120f' }, desc: 'A short bob with bangs.' },
  { name: 'Long Brown Hair', type: 'Hair', price: 50, data: { model: 'long', color: '#5a321a' }, desc: 'Long and flowy.' },
  { name: 'Long Blonde Hair', type: 'Hair', price: 50, data: { model: 'long', color: '#f2d27a' }, desc: 'Long and golden.' },
  { name: 'Curly Hair', type: 'Hair', price: 80, data: { model: 'curly', color: '#3b2314' }, desc: 'Big, soft curls.' },
  { name: 'Pink Bow', type: 'Hat', price: 25, data: { model: 'bow', color: '#ff5fa2', accent: '#ffd1e6' }, desc: 'A big pink bow.' },
  { name: 'Red Polka Bow', type: 'Hat', price: 30, data: { model: 'bow', color: '#e8243c', accent: '#ffffff' }, desc: 'Red with white dots.' },
  { name: 'Flower Crown', type: 'Hat', price: 90, data: { model: 'flowercrown', color: '#ff8fcf', accent: '#7ddc6a' }, desc: 'Spring flowers all around.' },
  { name: 'Princess Tiara', type: 'Hat', price: 150, data: { model: 'tiara', color: '#e8e8ff', accent: '#ff5fa2' }, desc: 'Sparkly. For royalty only.' },
  { name: 'Cat Ears', type: 'Hat', price: 40, data: { model: 'catears', color: '#1b1b1b', accent: '#ff9ccf' }, desc: 'Meow.' },
  { name: 'Bunny Ears', type: 'Hat', price: 40, data: { model: 'bunnyears', color: '#ffffff', accent: '#ffb3d1' }, desc: 'Hop hop.' },
  { name: 'Heart Shades', type: 'Hat', price: 35, data: { model: 'heartglasses', color: '#ff2f6e', accent: '#ffffff' }, desc: 'Love is in the air.' },
  { name: 'Daisy Headband', type: 'Hat', price: 20, data: { model: 'headband', color: '#ffffff', accent: '#ffd400' }, desc: 'A headband with a daisy.' },
  { name: 'Cute Face', type: 'Face', price: 35, data: { face: 'cute' }, desc: 'Big sparkly eyes.' },
  { name: 'Wink', type: 'Face', price: 25, data: { face: 'wink' }, desc: ';)' },
  { name: 'Kissy Face', type: 'Face', price: 30, data: { face: 'kissy' }, desc: 'Mwah!' },
  { name: 'Kawaii Face', type: 'Face', price: 40, data: { face: 'kawaii' }, desc: '^_^' },
  { name: 'Sweet Smile', type: 'Face', price: 20, data: { face: 'sweet' }, desc: 'Lashes and a little smile.' },
  { name: 'Pink Heart Top', type: 'Shirt', price: 10, data: { color: '#ffb3d1', accent: '#ff2f6e', pattern: 'hearts' }, desc: 'Covered in little hearts.' },
  { name: 'Polka Dot Blouse', type: 'Shirt', price: 10, data: { color: '#ffffff', accent: '#ff5fa2', pattern: 'dots' }, desc: 'Cute dots.' },
  { name: 'Lavender Dress Top', type: 'Shirt', price: 15, data: { color: '#c7a8ff', accent: '#ffffff', pattern: 'dress' }, desc: 'Wear it with the matching skirt.' },
  { name: 'Mint Ruffle Top', type: 'Shirt', price: 12, data: { color: '#a8f0d4', accent: '#ffffff', pattern: 'ruffle' }, desc: 'Fresh mint with ruffles.' },
  { name: 'Pink Hoodie', type: 'Shirt', price: 5, data: { color: '#ff8fc5', accent: '#e86aa8', pattern: 'hoodie' }, desc: 'The comfy hoodie, in pink.' },
  { name: 'Pink Skirt', type: 'Pants', price: 10, data: { color: '#ff8fc5', accent: '#ffffff', pattern: 'skirt' }, desc: 'A twirly skirt.' },
  { name: 'Lavender Skirt', type: 'Pants', price: 10, data: { color: '#c7a8ff', accent: '#ffffff', pattern: 'skirt' }, desc: 'Matches the dress top.' },
  { name: 'Denim Skirt', type: 'Pants', price: 8, data: { color: '#4a76b8', accent: '#2d4f8a', pattern: 'skirt' }, desc: 'A denim skirt.' },
  { name: 'White Leggings', type: 'Pants', price: 5, data: { color: '#f4f4f8', accent: '#d8d8e4', pattern: 'plain' }, desc: 'Simple and clean.' },
  { name: 'Rainbow Tee', type: 'TShirt', price: 3, data: { graphic: 'rainbow' }, desc: 'A happy rainbow.' },
  { name: 'Kitty Tee', type: 'TShirt', price: 3, data: { graphic: 'kitty' }, desc: 'A cute kitty face.' },
  { name: 'Cherry Tee', type: 'TShirt', price: 2, data: { graphic: 'cherry' }, desc: 'Two little cherries.' },
  // ---- accessories, like Roblox's: on the shoulder, back, neck, waist, face or front (data.slot)
  { name: 'Busy Bee Buddy', type: 'Accessory', price: 0, data: { model: 'bee', slot: 'shoulder', color: '#ffc400', accent: '#1b1b1b' }, desc: 'A friendly bee that rides on your shoulder. Free for everyone!' },
  { name: 'Shoulder Parrot', type: 'Accessory', price: 120, data: { model: 'parrot', slot: 'shoulder', color: '#e8243c', accent: '#2d7de0' }, desc: 'Squawk! A pirate\'s best friend.' },
  { name: 'Shoulder Kitty', type: 'Accessory', price: 90, data: { model: 'shouldercat', slot: 'shoulder', color: '#e8913a', accent: '#ffffff' }, desc: 'A tiny kitty napping on your shoulder.' },
  { name: 'Classic Backpack', type: 'Accessory', price: 40, data: { model: 'backpack', slot: 'back', color: '#2d7de0', accent: '#f5cd30' }, desc: 'Ready for school. Or an adventure.' },
  { name: 'Hero Cape', type: 'Accessory', price: 75, data: { model: 'cape', slot: 'back', color: '#c4281c', accent: '#f5cd30' }, desc: 'Every hero needs one.' },
  { name: 'Royal Purple Cape', type: 'Accessory', price: 150, data: { model: 'cape', slot: 'back', color: '#5b2a8a', accent: '#ffffff' }, desc: 'With a white trim.' },
  { name: 'Rocket Jetpack', type: 'Accessory', price: 200, data: { model: 'jetpack', slot: 'back', color: '#a3a2a5', accent: '#ff7a1a' }, desc: 'Does not actually fly. Probably.' },
  { name: 'Katana Sheath', type: 'Accessory', price: 110, data: { model: 'katana', slot: 'back', color: '#1b1b1b', accent: '#c4281c' }, desc: 'A sword on your back, ninja style.' },
  { name: 'Cozy Scarf', type: 'Accessory', price: 30, data: { model: 'scarf', slot: 'neck', color: '#c4281c', accent: '#ffffff' }, desc: 'Warm and stripey.' },
  { name: 'Gold Chain', type: 'Accessory', price: 250, data: { model: 'chain', slot: 'neck', color: '#ffc400', accent: '#ffe680' }, desc: 'Bling.' },
  { name: 'Red Bow Tie', type: 'Accessory', price: 20, data: { model: 'bowtie', slot: 'neck', color: '#c4281c', accent: '#8a1a12' }, desc: 'Fancy.' },
  { name: 'Fanny Pack', type: 'Accessory', price: 25, data: { model: 'fannypack', slot: 'waist', color: '#00a2ff', accent: '#ff66cc' }, desc: 'Totally 90s.' },
  { name: 'Sword Belt', type: 'Accessory', price: 85, data: { model: 'swordbelt', slot: 'waist', color: '#5a3b1e', accent: '#b4b4b4' }, desc: 'A sword on your hip.' },
  { name: 'Nerd Glasses', type: 'Accessory', price: 15, data: { model: 'nerdglasses', slot: 'face', color: '#1b1b1b', accent: '#ffffff' }, desc: 'Big round glasses.' },
  { name: 'Ninja Mask', type: 'Accessory', price: 45, data: { model: 'ninjamask', slot: 'face', color: '#1b1b1b', accent: '#c4281c' }, desc: 'Stealthy.' },
  { name: 'Teddy Bear Hug', type: 'Accessory', price: 60, data: { model: 'teddy', slot: 'front', color: '#a0703c', accent: '#f2d2b0' }, desc: 'A teddy bear you carry everywhere.' },
  // ---- developer items: only for people who made a game (or the Robis team)
  { name: 'Developer Hard Hat', type: 'Hat', price: 0, data: { model: 'hardhat', color: '#f5cd30', accent: '#1b1b1b', devOnly: true }, desc: 'For developers only: make a game in Create to unlock it. The builder\'s classic.' },
  { name: 'Code Visor', type: 'Accessory', price: 0, data: { model: 'codevisor', slot: 'face', color: '#0f1117', accent: '#3ddc84', devOnly: true }, desc: 'For developers only. See the world in Lua.' },
  { name: 'Builder\'s Tool Belt', type: 'Accessory', price: 0, data: { model: 'toolbelt', slot: 'waist', color: '#7a4b2a', accent: '#b4b4b4', devOnly: true }, desc: 'For developers only. A hammer, a wrench and a lot of bricks to place.' },
  { name: 'Dev Badge', type: 'Accessory', price: 0, data: { model: 'devbadge', slot: 'front', color: '#00a2ff', accent: '#ffffff', devOnly: true }, desc: 'For developers only. Wear it with pride.' },
  { name: 'Laptop Backpack', type: 'Accessory', price: 0, data: { model: 'laptoppack', slot: 'back', color: '#2a2d33', accent: '#00a2ff', devOnly: true }, desc: 'For developers only. Robis Studio, always with you.' },
  { name: 'Developer Hoodie', type: 'Shirt', price: 0, data: { color: '#1b2a35', accent: '#3ddc84', pattern: 'dev', devOnly: true }, desc: 'For developers only. </> on the front.' },
  // Gear
  { name: 'Classic Sword', type: 'Gear', price: 100, data: { model: 'sword', color: '#b4b4b4' }, desc: 'The linked sword. Cosmetic.' },
  { name: 'Rocket Launcher', type: 'Gear', price: 250, data: { model: 'rocket', color: '#4b974b' }, desc: 'Cosmetic rocket launcher.' },
  // Pets: they follow you around in every game (see public/js/render/avatar.js PETS).
  { name: 'Puppy', type: 'Pet', price: 100, data: { model: 'dog', color: '#a0703c', accent: '#f8f8f8' }, desc: 'A loyal little friend that follows you everywhere.' },
  { name: 'Kitty', type: 'Pet', price: 100, data: { model: 'cat', color: '#e8913a', accent: '#f8f8f8' }, desc: 'Purrs when you stand still.' },
  { name: 'Bunny', type: 'Pet', price: 200, data: { model: 'bunny', color: '#f8f8f8', accent: '#ff9cc8' }, desc: 'Hops after you.' },
  { name: 'Penguin', type: 'Pet', price: 250, data: { model: 'penguin', color: '#1b1b1b', accent: '#ff9f1c' }, desc: 'Waddles everywhere you go.' },
  { name: 'Robot Buddy', type: 'Pet', price: 400, data: { model: 'robot', color: '#a3a2a5', accent: '#00e5ff' }, desc: 'A hovering helper bot with glowing eyes.' },
  { name: 'Friendly Ghost', type: 'Pet', price: 500, data: { model: 'ghost', color: '#f4f8ff', accent: '#1b1b1b' }, desc: 'Boo! It floats along beside you.' },
  { name: 'Baby Dragon', type: 'Pet', price: 2500, limited: true, data: { model: 'dragon', color: '#3fb950', accent: '#ffcf33' }, desc: 'Limited. A tiny dragon that flaps along with you.' },
  { name: 'Golden Dragon', type: 'Pet', price: 15000, limited: true, data: { model: 'dragon', color: '#ffc400', accent: '#e8002a' }, desc: 'Limited. The rarest pet in Robis.' },
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
    else if (it.type === 'Pet') r.pet = it.data;
  }
  return r;
}
