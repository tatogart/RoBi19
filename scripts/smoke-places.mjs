// Runs every showcase place on a real GameServer with a fake player for a
// while and reports script errors. Usage: node scripts/smoke-places.mjs [key] [seconds]
import { GameServer } from '../server/game/GameServer.js';
import { SEED_GAMES } from '../server/seed/places.js';
import { MORE_GAMES } from '../server/seed/places2.js';
import { TEAM_GAMES } from '../server/seed/places3.js';
import { NOSTALGIA_GAMES } from '../server/seed/places4.js';

let extra = [];
try { extra = (await import('../server/seed/places6.js')).NEW_GAMES || []; } catch { /* not there yet */ }
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
const secs = +process.argv[3] || 20;
const all = [...SEED_GAMES, ...MORE_GAMES, ...TEAM_GAMES, ...NOSTALGIA_GAMES, ...extra].filter((g) => !only || g.key === only);
let bad = 0;
for (const sg of all) {
  const server = new GameServer({ gameId: 1, name: sg.name, place: sg.build(), maxPlayers: 10 });
  const fake = (id, name) => ({ readyState: 1, send() {}, close() {} });
  server.join(fake(), { id: 1, username: 'Bot1' }, { bodyColors: {}, items: [] });
  server.join(fake(), { id: 2, username: 'Bot2' }, { bodyColors: {}, items: [] });
  // wander a little
  const t0 = Date.now();
  await new Promise((resolve) => {
    const iv = setInterval(() => {
      for (const s of server.sessions.values()) {
        if (!s.character) continue;
        const [x, y, z] = s.state.p;
        server.handle(s, { t: 'move', p: [x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2], ry: 0, a: 'walk' });
      }
      if (Date.now() - t0 > secs * 1000) { clearInterval(iv); resolve(); }
    }, 100);
  });
  const errors = server.logs.filter((l) => l.level === 'error');
  const hints = server.logs.filter((l) => l.level === 'print').slice(-3).map((l) => l.text);
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${sg.key}${errors.length ? '\n   ' + errors.slice(0, 5).map((e) => e.text).join('\n   ') : ''}${hints.length ? '\n   prints: ' + hints.join(' | ') : ''}`);
  if (errors.length) bad++;
  server.close();
}
process.exit(bad ? 1 : 0);
