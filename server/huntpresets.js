// Ready-made events for every hub map: a story and a prize pack (Admin Panel
// -> The Hunt -> Quick event, and the prepared events made once in every world).
const p5 = (names, model, colors, type = 'Hat') => names.map((name, i) => ({ name, type: Array.isArray(type) ? type[i] : type, model: Array.isArray(model) ? model[i] : model, color: colors[i % colors.length], accent: '#ffffff', ...(i === 0 ? { count: 1 } : { share: [25, 50, 75, 100][i - 1] }) }));
export const HUNT_PRESETS = {
  winter: { title: 'Frost Festival', story: 'Snow has fallen on Robis! Step through the festive portals, finish a quest in every game and find the 6 presents hidden around the Frost Festival.',
    prizes: p5(['Snowflake Beanie', 'Frosty Shades', 'Penguin Pal', 'Ice Saber', 'Crown of Winter'], ['beanie', 'shades', 'penguin', 'saber', 'crown'], ['#9fd8ff', '#4fc3ff', '#1b1b1b', '#bfefff', '#e8f6ff'], ['Hat', 'Hat', 'Pet', 'Gear', 'Hat']),
    team: { name: 'Festival Party Hat', type: 'Hat', model: 'party', color: '#ff4d6d' }, hub: { name: 'Gift Halo', type: 'Hat', model: 'halo', color: '#ffd166' } },
  spooky: { title: 'Haunted Night', story: 'The moon is full and the games are haunted... Survive a quest in every game and find the 6 pumpkins hidden in the graveyard.',
    prizes: p5(['Witch Hat', 'Ghost Buddy', 'Pumpkin Torch', 'Spooky Wings', 'Crown of the Night'], ['witch', 'ghost', 'torch', 'wings', 'crown'], ['#7a3dbf', '#f4f8ff', '#ff7a1a', '#2b2b2b', '#ff7a1a'], ['Hat', 'Pet', 'Gear', 'Hat', 'Hat']),
    team: { name: 'Bat Wings', type: 'Hat', model: 'wings', color: '#3b3640' }, hub: { name: 'Pumpkin Halo', type: 'Hat', model: 'halo', color: '#ff7a1a' } },
  candy: { title: 'Candy Kingdom', story: 'Everything is made of sugar! Finish a sweet quest in every game and find the 6 candies hidden in the Candy Kingdom.',
    prizes: p5(['Gumdrop Cap', 'Candy Bunny', 'Lollipop Hammer', 'Party Cone', 'Sugar Crown'], ['cap', 'bunny', 'hammer', 'party', 'crown'], ['#ff5fa2', '#ffffff', '#ff3b8d', '#5fd3ff', '#ffb3d9'], ['Hat', 'Pet', 'Gear', 'Hat', 'Hat']),
    team: { name: 'Sprinkle Headphones', type: 'Hat', model: 'headphones', color: '#b6ff5f' }, hub: { name: 'Candy Halo', type: 'Hat', model: 'halo', color: '#ff5fa2' } },
  ocean: { title: 'Sunken City', story: 'An ancient city rose from the sea! Swim through the portals, finish a quest in every game and find the 6 pearls of the Sunken City.',
    prizes: p5(['Captain Hat', 'Diver Helmet', 'Trident Saber', 'Sea Dragon', 'Crown of the Deep'], ['pirate', 'astronaut', 'saber', 'dragon', 'crown'], ['#1f3a5f', '#1fd1c9', '#ffe066', '#1fd1c9', '#5f8bff'], ['Hat', 'Hat', 'Gear', 'Pet', 'Hat']),
    team: { name: 'Pearl Shades', type: 'Hat', model: 'shades', color: '#f6f2ff' }, hub: { name: 'Pearl Halo', type: 'Hat', model: 'halo', color: '#f6f2ff' } },
  relics: { title: 'Lost Temple', story: 'A lost temple was found in the jungle. Finish a quest in every game to win its relics, and solve the rune puzzle in the temple.',
    prizes: p5(['Explorer Hat', 'Jungle Torch', 'Stone Golem', 'Temple Wings', 'Golden Idol Crown'], ['explorer', 'torch', 'golem', 'wings', 'crown'], ['#c8a165', '#ff8a3d', '#8a8590', '#5bd6a0', '#ffc400'], ['Hat', 'Gear', 'Pet', 'Hat', 'Hat']),
    team: { name: 'Temple Viking Helm', type: 'Hat', model: 'viking', color: '#c8a165' }, hub: { name: 'Rune Halo', type: 'Hat', model: 'halo', color: '#5bd6a0' } },
  dimension: { title: 'Star Voyage', story: 'A wormhole opened over Robis! Jump into the space station, finish a quest in every game and collect the 6 star fragments.',
    prizes: p5(['Astronaut Helmet', 'UFO Pal', 'Space Saber', 'Planet Hat', 'Crown of the Cosmos'], ['astronaut', 'ufo', 'saber', 'planet', 'crown'], ['#e8e8f0', '#7dffb0', '#00e5ff', '#b45cff', '#ffd27a'], ['Hat', 'Pet', 'Gear', 'Hat', 'Hat']),
    team: { name: 'Alien Buddy', type: 'Pet', model: 'alien', color: '#7dffb0' }, hub: { name: 'Stardust Halo', type: 'Hat', model: 'halo', color: '#7df9ff' } },
};
