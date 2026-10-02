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
  box.replaceChildren(el('div', { class: 'hunt-hero' }, el('div', { class: 'hunt-logo', text: 'THE HUNT' }), el('p', { text: 'Something is coming... Stay tuned!' })));
} else {
  const pct = h.total ? Math.round((h.count / h.total) * 100) : 0;
  const hero = el('div', { class: 'hunt-hero' },
    !h.public ? el('div', { class: 'hunt-private', text: 'Private preview: only admins can see the event right now' }) : null,
    el('div', { class: 'hunt-logo', text: 'THE HUNT' }),
    el('p', { class: 'hunt-sub', text: 'Find the golden token hidden in every game. Collect them all to win the grand prize!' }),
    el('p', { class: 'hunt-sub small', text: `Every token gives R$ ${h.robitsPerToken}, and ${h.rewards.length} prizes are waiting along the way.` }),
    el('div', { class: 'hunt-progress' },
      el('div', { class: 'hunt-bar' }, el('div', { style: { width: pct + '%' } })),
      el('div', { class: 'hunt-count', text: `${h.count} / ${h.total} tokens` })),
    h.hubId ? el('button', { class: 'btn btn-large hunt-play', text: 'Play The Hunt', onclick: () => launchGame(h.hubId) }) : null);
  const prizes = el('div', { class: 'hunt-prizes' }, h.rewards.map((r) => {
    const img = el('div', { class: 'hunt-prize-img' });
    itemThumbnail({ id: r.id, type: r.type, data: r.data }, 200).then((u) => img.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('a', { class: 'hunt-prize' + (r.got ? ' got' : ''), href: `/item?id=${r.id}` }, img,
      el('b', { text: r.name }),
      el('div', { class: 'small', text: r.got ? '✓ Unlocked' : `Find ${r.need} tokens` }));
  }));
  const games = el('div', { class: 'hunt-games' }, h.games.map((g) => {
    const thumb = el('div', { class: 'hunt-thumb' });
    api.get(`/games/${g.id}`).then(({ game }) => gameThumbnail(game, 384)).then((u) => thumb.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('div', { class: 'hunt-game' + (g.found ? ' found' : '') },
      thumb,
      g.found ? el('div', { class: 'hunt-found', text: '✓' }) : el('div', { class: 'hunt-mini-token' }),
      el('b', { class: 'no-i18n', text: g.name }),
      el('div', { class: 'small muted' }, g.byPlayer ? el('span', {}, 'By ', el('span', { class: 'no-i18n', text: g.creator })) : el('span', { text: 'Official' })),
      el('button', { class: 'btn btn-small ' + (g.found ? '' : 'btn-green'), text: g.found ? 'Play again' : 'Find the token', onclick: () => launchGame(g.id) }));
  }));
  box.replaceChildren(hero,
    el('h2', { text: 'Prizes' }), prizes,
    el('h2', { text: 'Games' }), h.games.length ? games : el('div', { class: 'empty', text: 'No games in the event yet.' }));
  if (!h.games.length) toast('Add games to The Hunt in the Admin Panel.', 'error');
}

const style = document.createElement('style');
style.textContent = `
.hunt-hero { text-align: center; padding: 34px 20px; border-radius: 10px; color: #fff; background: radial-gradient(circle at 50% 0%, #6b3fa0, #2b2340 70%); margin-bottom: 20px; position: relative; overflow: hidden; }
.hunt-hero::before { content: ''; position: absolute; inset: 0; background: repeating-conic-gradient(from 0deg at 50% 0%, rgba(255,196,0,.07) 0 6deg, transparent 6deg 18deg); }
.hunt-hero > * { position: relative; }
.hunt-logo { font-size: 56px; font-weight: 900; letter-spacing: 6px; color: #ffc400; text-shadow: 0 3px 0 #a36b00, 0 0 30px rgba(255,196,0,.5); }
.hunt-sub { max-width: 560px; margin: 8px auto 18px; color: #e6dcff; }
.hunt-private { display: inline-block; background: #d0021b; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
.hunt-progress { max-width: 420px; margin: 0 auto; }
.hunt-bar { height: 14px; border-radius: 7px; background: rgba(255,255,255,.15); overflow: hidden; }
.hunt-bar div { height: 100%; background: linear-gradient(90deg, #ffc400, #ffe680); border-radius: 7px; }
.hunt-count { margin-top: 6px; font-weight: 700; font-size: 18px; }
.hunt-play { margin-top: 18px; background: #ffc400; color: #2b2340; font-weight: 800; border: 0; }
.hunt-play:hover { background: #ffd84d; }
.hunt-prizes { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.hunt-prize { background: var(--panel); border-radius: 8px; padding: 12px; text-align: center; color: inherit; text-decoration: none; border: 2px solid transparent; }
.hunt-prize.got { border-color: #02b757; }
.hunt-prize-img { aspect-ratio: 1; background: linear-gradient(#f7f7f7, #e4e4e4); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
html[data-theme="dark"] .hunt-prize-img { background: linear-gradient(#4d4f51, #393b3d); }
.hunt-prize-img img { width: 100%; }
.hunt-games { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.hunt-game { background: var(--panel); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; position: relative; }
.hunt-game.found { outline: 2px solid #ffc400; }
.hunt-thumb { aspect-ratio: 16 / 10; background: #d4d4d4; border-radius: 4px; overflow: hidden; }
.hunt-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hunt-found, .hunt-mini-token { position: absolute; top: 4px; right: 4px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.hunt-found { background: #ffc400; color: #2b2340; box-shadow: 0 0 10px #ffc400; }
.hunt-mini-token { background: rgba(0,0,0,.45); border: 2px dashed #ffc400; }
@media (max-width: 600px) { .hunt-logo { font-size: 38px; } }
`;
document.head.append(style);
