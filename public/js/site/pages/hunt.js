// The Hunt: the event page. Your tokens, the prizes and every game in the event.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, launchGame, spinner, toast } from '../ui.js';
import { gameThumbnail, itemThumbnail } from '../../render/thumbs.js';

await initPage({ active: 'hunt' });
const app = document.getElementById('app');
const box = el('div', {}, spinner());
app.append(box);

const h = await api.get('/hunt');
if (!h.visible) {
  box.replaceChildren(el('div', { class: 'hunt-hero' }, el('div', { class: 'hunt-logo', text: 'THE HUNT' }), el('div', { class: 'hunt-logo2', text: 'ANOTHER DIMENSION' }), el('p', { text: 'Something is coming... Stay tuned!' })));
} else {
  const pct = h.total ? Math.round((h.count / h.total) * 100) : 0;
  const riftPct = Math.min(100, Math.round((h.rift.shards / h.rift.goal) * 100));
  const hero = el('div', { class: 'hunt-hero' },
    el('div', { class: 'hunt-planet p1' }), el('div', { class: 'hunt-planet p2' }),
    !h.public ? el('div', { class: 'hunt-private', text: 'Private preview: only admins can see the event right now' }) : null,
    el('div', { class: 'hunt-part', text: 'PART 2' }),
    el('div', { class: 'hunt-logo', text: 'THE HUNT' }),
    el('div', { class: 'hunt-logo2', text: 'ANOTHER DIMENSION' }),
    el('p', { class: 'hunt-sub', text: 'A rift to another dimension has opened! Jump through the wormholes and find the dimension shard hidden in every game. Your scanner shows how close you are.' }),
    el('p', { class: 'hunt-sub small', text: `Every shard gives R$ ${h.robitsPerToken}, and ${h.rewards.length} prizes are waiting along the way.` }),
    el('div', { class: 'hunt-progress' },
      el('div', { class: 'hunt-bar' }, el('div', { style: { width: pct + '%' } })),
      el('div', { class: 'hunt-count', text: `${h.count} / ${h.total} shards` })),
    h.hubId ? el('button', { class: 'btn btn-large hunt-play', text: 'Enter the hub', onclick: () => launchGame(h.hubId) }) : null);
  const stats = el('div', { class: 'hunt-stats' },
    el('div', { class: 'hunt-stat' },
      el('b', { text: 'The Rift' }),
      el('div', { class: 'hunt-bar rift' }, el('div', { style: { width: riftPct + '%' } })),
      el('div', { class: 'small', text: h.rift.open ? `OPEN! ${h.rift.shards} shards found by everyone` : `${h.rift.shards} / ${h.rift.goal} shards found by everyone. Open it together for a prize!` })),
    el('div', { class: 'hunt-stat' },
      el('b', { text: 'Star fragments' }),
      el('div', { class: 'hunt-stars' }, Array.from({ length: h.fragments.total }, (_, i) => el('span', { class: i < h.fragments.count ? 'on' : '', text: '★' }))),
      el('div', { class: 'small', text: 'Hidden on asteroids and the moon base in the hub' })),
    el('div', { class: 'hunt-stat' },
      el('b', { text: 'In the hub' }),
      el('div', { class: 'small', text: 'Low gravity • launch pads • a rocket to the moon • meteor showers • ZERO-G button' })));
  const prizes = el('div', { class: 'hunt-prizes' }, h.rewards.map((r) => {
    const img = el('div', { class: 'hunt-prize-img' });
    itemThumbnail({ id: r.id, type: r.type, data: r.data }, 200).then((u) => img.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('a', { class: 'hunt-prize' + (r.got ? ' got' : ''), href: `/item?id=${r.id}` }, img,
      el('b', { text: r.name }),
      r.bonus ? el('div', { class: 'hunt-bonus', text: 'BONUS' }) : null,
      el('div', { class: 'small', text: r.got ? '✓ Unlocked' : r.bonus ? r.how : `Find ${r.need} shards` }));
  }));
  const games = el('div', { class: 'hunt-games' }, h.games.map((g) => {
    const thumb = el('div', { class: 'hunt-thumb' });
    api.get(`/games/${g.id}`).then(({ game }) => gameThumbnail(game, 384)).then((u) => thumb.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('div', { class: 'hunt-game' + (g.found ? ' found' : '') },
      thumb,
      g.found ? el('div', { class: 'hunt-found', text: '✓' }) : el('div', { class: 'hunt-mini-token' }),
      el('b', { class: 'no-i18n', text: g.name }),
      el('div', { class: 'small muted' }, g.byPlayer ? el('span', {}, 'By ', el('span', { class: 'no-i18n', text: g.creator })) : el('span', { text: 'Official' })),
      el('button', { class: 'btn btn-small ' + (g.found ? '' : 'btn-green'), text: g.found ? 'Play again' : 'Find the shard', onclick: () => launchGame(g.id) }));
  }));
  box.replaceChildren(hero, stats,
    el('h2', { text: 'Prizes' }), prizes,
    el('h2', { text: 'Games' }), h.games.length ? games : el('div', { class: 'empty', text: 'No games in the event yet.' }));
  if (!h.games.length) toast('Add games to The Hunt in the Admin Panel.', 'error');
}

const style = document.createElement('style');
style.textContent = `
.hunt-hero { text-align: center; padding: 38px 20px; border-radius: 10px; color: #fff; background: radial-gradient(ellipse at 50% 10%, #3a1a6b, #0b0a2a 70%); margin-bottom: 16px; position: relative; overflow: hidden; }
.hunt-hero::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(1.5px 1.5px at 10% 20%, #fff, transparent), radial-gradient(1px 1px at 30% 70%, #cfe8ff, transparent), radial-gradient(1.5px 1.5px at 55% 30%, #fff, transparent), radial-gradient(1px 1px at 75% 80%, #e0c8ff, transparent), radial-gradient(1.5px 1.5px at 90% 15%, #fff, transparent), radial-gradient(1px 1px at 45% 90%, #fff, transparent), radial-gradient(1px 1px at 20% 50%, #ffe9c4, transparent), radial-gradient(1.5px 1.5px at 65% 55%, #fff, transparent); background-size: 300px 200px; animation: hunt-stars 60s linear infinite; }
@keyframes hunt-stars { to { background-position: 300px 200px; } }
.hunt-hero > * { position: relative; }
.hunt-planet { position: absolute !important; border-radius: 50%; }
.hunt-planet.p1 { width: 160px; height: 160px; left: -40px; bottom: -50px; background: radial-gradient(circle at 35% 35%, #c08bff, #6b3fa0 55%, #2a1050); box-shadow: 0 0 40px rgba(180,92,255,.5); }
.hunt-planet.p2 { width: 60px; height: 60px; right: 40px; top: 30px; background: radial-gradient(circle at 35% 35%, #ffd0b0, #c4501c 60%, #5a1a0a); }
.hunt-part { display: inline-block; font-weight: 900; letter-spacing: 4px; font-size: 12px; color: #7df9ff; border: 1px solid #7df9ff; padding: 2px 10px; border-radius: 10px; margin-bottom: 6px; }
.hunt-logo { font-size: 56px; font-weight: 900; letter-spacing: 6px; color: #ffc400; text-shadow: 0 3px 0 #a36b00, 0 0 30px rgba(255,196,0,.5); line-height: 1; }
.hunt-logo2 { font-size: 26px; font-weight: 900; letter-spacing: 8px; margin-top: 6px; background: linear-gradient(90deg, #7df9ff, #b45cff, #ff4d8d); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 10px rgba(180,92,255,.6)); }
.hunt-sub { max-width: 580px; margin: 10px auto 16px; color: #e6dcff; }
.hunt-private { display: inline-block; background: #d0021b; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
.hunt-progress { max-width: 420px; margin: 0 auto; }
.hunt-bar { height: 14px; border-radius: 7px; background: rgba(255,255,255,.15); overflow: hidden; }
.hunt-bar div { height: 100%; background: linear-gradient(90deg, #7df9ff, #b45cff); border-radius: 7px; box-shadow: 0 0 10px #b45cff; }
.hunt-bar.rift { background: rgba(127,127,127,.25); margin: 8px 0 6px; }
.hunt-bar.rift div { background: linear-gradient(90deg, #ff4d8d, #b45cff); }
.hunt-count { margin-top: 6px; font-weight: 700; font-size: 18px; }
.hunt-play { margin-top: 18px; background: linear-gradient(90deg, #7df9ff, #b45cff); color: #0b0a2a; font-weight: 800; border: 0; }
.hunt-play:hover { filter: brightness(1.1); }
.hunt-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 18px; }
.hunt-stat { background: var(--panel); border-radius: 8px; padding: 12px 14px; border-left: 4px solid #b45cff; }
.hunt-stars { font-size: 24px; letter-spacing: 4px; margin: 4px 0; color: rgba(127,127,127,.4); }
.hunt-stars .on { color: #ffd84d; text-shadow: 0 0 8px #ffc400; }
.hunt-prizes { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.hunt-prize { background: var(--panel); border-radius: 8px; padding: 12px; text-align: center; color: inherit; text-decoration: none; border: 2px solid transparent; position: relative; }
.hunt-prize.got { border-color: #02b757; }
.hunt-bonus { position: absolute; top: 8px; left: 8px; background: #00b8d4; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; }
.hunt-prize-img { aspect-ratio: 1; background: radial-gradient(circle at 50% 40%, #3a2a6b, #14102e); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.hunt-prize-img img { width: 100%; }
.hunt-games { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.hunt-game { background: var(--panel); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; position: relative; }
.hunt-game.found { outline: 2px solid #b45cff; }
.hunt-thumb { aspect-ratio: 16 / 10; background: #d4d4d4; border-radius: 4px; overflow: hidden; }
.hunt-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hunt-found, .hunt-mini-token { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: 900; transform: rotate(45deg); border-radius: 5px; }
.hunt-found > *, .hunt-found { color: #fff; }
.hunt-found { background: linear-gradient(135deg, #f3dcff, #b45cff 50%, #4a1a9c); box-shadow: 0 0 10px #b45cff; }
.hunt-mini-token { background: rgba(0,0,0,.45); border: 2px dashed #b45cff; }
@media (max-width: 600px) { .hunt-logo { font-size: 40px; } .hunt-logo2 { font-size: 17px; letter-spacing: 4px; } }
`;
document.head.append(style);
