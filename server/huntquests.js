// Quests for quest events of The Hunt (like Roblox's The Hunt: every game has
// its own challenge, made from what you really do in that game).
//
// Types (checked by GameServer, see _quest*):
//   stat   - a leaderstat reaches `target` (e.g. 40 Coins in one visit)
//   gain   - a leaderstat goes up by `target` while you play (e.g. win 1 round)
//   below  - a leaderstat (a time) is set to more than 0 and at most `target`
//   badge  - the game awards a BadgeService badge (`badge`), e.g. "Door 25"
//   click  - press every button (ClickDetector) in the model `model`
//   visit  - stand on / reach each part named in `parts`
//   runes  - find 3 rune stones hidden in the map and touch them in order in time
//   script - the game's own scripts call HuntService:CompleteQuest(player)
// Quests that work in any game (games without a quest of their own get one of
// these, a different one per game; see GENERIC):
//   orbs     - collect `target` golden orbs scattered over the map (any order)
//   delivery - find the lost package and bring it to the mailbox
//   beacon   - stand on the glowing beacon for `target` seconds
//   distance - run `target` studs
//   jumps    - jump `target` times
//   emotes   - do `target` different emotes (/e dance, the emote menu...)
//   playtime - play (not AFK) for `target` seconds
export const QUESTS = {
  crossroads: { type: 'visit', parts: ['Flag Pole'], text: 'Climb the ramps of the town tower and touch the flag pole on the roof' },
  obby: { type: 'badge', badge: 'Obby Champion', stat: 'Stage', text: 'Beat the Mega Fun Obby - reach the finish' },
  coins: { type: 'stat', stat: 'Coins', target: 40, text: 'Collect 40 coins in one visit' },
  lava: { type: 'gain', stat: 'Wins', target: 1, text: 'Outrun the rising lava and win a round' },
  buttons: { type: 'click', model: 'Buttons', text: 'Press every button in Button Mania' },
  disaster: { type: 'gain', stat: 'Wins', target: 2, text: 'Survive 2 natural disasters' },
  tower: { type: 'badge', badge: 'Tower Climber', stat: 'Height', text: 'Climb to the very top of the Tower of Robis' },
  speedrun: { type: 'below', stat: 'Time', target: 40, text: 'Run the course from START to FINISH in under 40 seconds' },
  tycoon: { type: 'gain', stat: 'Cash', target: 300, text: 'Earn $300 with your tycoon' },
  cafe: { type: 'gain', stat: 'Pizzas', target: 5, text: 'Bake and serve 5 pizzas' },
  race: { type: 'gain', stat: 'Wins', target: 1, text: 'Win a Sprint Race' },
  ctf: { type: 'gain', stat: 'Captures', target: 1, text: 'Steal the enemy flag and bring it to your base' },
  koth: { type: 'gain', stat: 'Wins', target: 1, text: 'Hold the hill until you win a round' },
  minigames: { type: 'gain', stat: 'Wins', target: 1, text: 'Win a round of Minigame Mania' },
  themepark: { type: 'visit', parts: ['Disc', 'Cabin', 'DropPlatform'], names: ['the carousel', 'the Ferris wheel', 'the Drop Tower'], text: 'Ride the carousel, the Ferris wheel and the Drop Tower' },
  doors: { type: 'badge', badge: 'Door 25', text: 'Take the elevator down and reach Door 25 in the hotel' },
  // games that need other players get a quest anyone can do alone
  freezetag: { type: 'generic' },
  brickbattle: { type: 'generic' },
  speeddraw: { type: 'generic' },
  mm2: { type: 'generic' },
};
export const RUNES_TEXT = 'Find the 3 ancient runes hidden in this game and touch them in order (I, II, III) within 3 minutes';
export const RUNE_TIME = 180;
// a mix of "find / collect" and "do something" quests
export const GENERIC = [
  { type: 'runes', text: RUNES_TEXT },
  { type: 'delivery', text: 'Find the lost package and deliver it to the mailbox' },
  { type: 'emotes', target: 3, text: 'Do 3 different emotes in this game (the 😀 button or /e dance)' },
  { type: 'orbs', target: 6, text: 'Collect the 6 golden orbs scattered around this game' },
  { type: 'jumps', target: 30, text: 'Jump 30 times' },
  { type: 'beacon', target: 20, text: 'Find the glowing beacon and stand on it for 20 seconds' },
  { type: 'distance', target: 1500, text: 'Explore: run 1,500 studs around this game' },
  { type: 'playtime', target: 240, text: 'Play this game for 4 minutes (no AFK!)' },
];
// the same game always gets the same quest (in one event), games next to each other different ones
const pick = (id, salt = '') => {
  let h = 0;
  for (const ch of String(salt)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GENERIC[((+id || 0) + h) % GENERIC.length];
};

// The quest of a game. Player games: their own (scripts that call
// HuntService:CompleteQuest, text from HuntService:SetQuestText) or one of GENERIC.
export function questFor(game, readPlace, cache = new Map(), salt = '') {
  if (!game) return null;
  const q = game.seedKey && QUESTS[game.seedKey];
  if (q) return q.type === 'generic' ? pick(game.id, salt) : q;
  const key = game.id + ':' + (game.updated || 0) + ':' + salt;
  if (cache.has(key)) return cache.get(key);
  let own = null;
  try {
    const src = JSON.stringify(readPlace(game.id) || '');
    if (src.includes('CompleteQuest')) {
      const m = src.match(/SetQuestText\((?:\\")([^"\\]{3,120})(?:\\")\)/);
      own = { type: 'script', text: m ? m[1] : `Complete the quest made by the creator of ${game.name}` };
    }
  } catch { /* no place file */ }
  const quest = own || pick(game.id, salt);
  cache.set(key, quest);
  return quest;
}
