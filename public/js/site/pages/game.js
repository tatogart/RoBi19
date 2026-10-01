import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, icon, iconSvg, fmtNum, fmtFull, fmtDate, qs, toast, launchGame, headshotImg, gameCard, spinner, joinFriendDialog, userLink } from '../ui.js';
import { gameThumbnail } from '../../render/thumbs.js';

const me = await initPage({ active: 'games', requireAuth: false });
const app = document.getElementById('app');
const id = +qs('id');
let game;
try { ({ game } = await api.get(`/games/${id}`)); } catch (e) {
  app.append(el('div', { class: 'panel empty', text: 'This game is unavailable.' }));
  throw e;
}
document.title = `${game.name} - Robis`;

const thumb = el('div', { class: 'game-hero-thumb' });
gameThumbnail(game, 512).then((u) => thumb.append(el('img', { src: u, alt: game.name })));

const voteBar = el('div', { class: 'vote-bar' }, el('div', { class: 'vote-fill' }));
const upBtn = el('button', { class: 'vote-btn', title: 'Like' }, icon('thumbup'), el('span'));
const downBtn = el('button', { class: 'vote-btn', title: 'Dislike' }, icon('thumbdown'), el('span'));
const favBtn = el('button', { class: 'vote-btn', title: 'Favorite' }, icon('star'), el('span'));
function renderVotes() {
  const total = game.upVotes + game.downVotes;
  voteBar.firstChild.style.width = total ? (game.upVotes / total) * 100 + '%' : '0%';
  upBtn.lastChild.textContent = fmtNum(game.upVotes);
  downBtn.lastChild.textContent = fmtNum(game.downVotes);
  favBtn.lastChild.textContent = fmtNum(game.favorites);
  upBtn.classList.toggle('on', game.myVote === 1);
  downBtn.classList.toggle('on', game.myVote === -1);
  favBtn.classList.toggle('on', game.isFavorite);
}
const needLogin = () => { if (!me) { location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search); return true; } return false; };
upBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/vote`, { vote: game.myVote === 1 ? 0 : 1 })); renderVotes(); };
downBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/vote`, { vote: game.myVote === -1 ? 0 : -1 })); renderVotes(); };
favBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/favorite`)); renderVotes(); };
renderVotes();

const playBtn = el('button', { class: 'btn btn-green play-btn', onclick: () => { if (!needLogin()) launchGame(id); } }, el('span', { html: iconSvg('play'), style: { width: '34px', height: '34px', display: 'inline-flex' } }));
const details = el('div', { class: 'game-details' },
  el('h1', { text: game.name }),
  el('div', { class: 'muted' }, 'By ', game.creator ? userLink(game.creator) : 'Unknown'),
  !game.isPublic ? el('div', { class: 'pill', style: { marginTop: '8px', background: '#ffe3e3' }, text: 'Private — only you can play this' }) : null,
  el('div', { class: 'spacer' }),
  playBtn,
  // Phone/PC app: host this game for friends (they join with the room code).
  window.ROBIS_STANDALONE && game.isPublic ? el('div', { class: 'row', style: { marginTop: '8px', gap: '8px' } },
    el('button', { class: 'btn btn-primary', style: { flex: 1 }, text: 'Play with friends', onclick: () => { if (!needLogin()) location.href = `/play?placeId=${id}&host=1`; } }),
    el('button', { class: 'btn', style: { flex: 1 }, text: 'Join a friend', onclick: () => { if (!needLogin()) joinFriendDialog(); } })) : null,
  el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'space-between' } }, favBtn, el('div', { class: 'row', style: { gap: '6px' } }, upBtn, downBtn)),
  voteBar,
  me && (me.perms || []).includes('games') ? el('button', { class: 'btn btn-small', style: { marginTop: '10px' }, text: game.featured ? 'Remove from Featured' : 'Feature this game', onclick: async (e) => {
    try { ({ game } = await api.post(`/games/${id}/feature`, { featured: !game.featured })); e.target.textContent = game.featured ? 'Remove from Featured' : 'Feature this game'; toast(game.featured ? 'Game featured!' : 'Removed from Featured', 'success'); } catch (err) { toast(err.message, 'error'); }
  } }) : null,
  game.canEdit ? el('div', { class: 'row', style: { marginTop: '12px' } },
    el('a', { class: 'btn btn-small', href: `/studio?gameId=${id}`, text: 'Edit in Studio' }),
    game.isOwner ? el('a', { class: 'btn btn-small', href: `/develop?configure=${id}`, text: 'Configure' }) : null) : null);

app.append(el('div', { class: 'panel game-top' }, thumb, details));

const tabs = el('div', { class: 'tabs', style: { marginTop: '20px' } });
const tabBody = el('div', { class: 'panel' });
app.append(tabs, tabBody);
const TABS = {
  About: () => el('div', {},
    el('h3', { text: 'Description' }),
    el('p', { style: { whiteSpace: 'pre-wrap' }, text: game.description || 'No description.' }),
    el('div', { class: 'stat-row' },
      ...[['Playing', fmtFull(game.playing)], ['Visits', fmtFull(game.visits)], ['Created', fmtDate(game.created)], ['Updated', fmtDate(game.updated)], ['Max Players', game.maxPlayers], ['Genre', game.genre]]
        .map(([l, v]) => el('div', {}, el('div', { class: 'label', text: l }), el('div', { class: 'value', text: v })))),
    el('h3', { style: { marginTop: '24px' }, text: 'Recommended Games' }),
    (() => { const row = el('div', { class: 'game-row' }, spinner()); api.get('/games?sort=popular').then((r) => row.replaceChildren(...r.games.filter((g) => g.id !== id).slice(0, 6).map(gameCard))); return row; })()),
  Servers: () => {
    const box = el('div', {}, spinner());
    api.get(`/games/${id}/servers`).then(({ servers }) => {
      if (!servers.length) { box.replaceChildren(el('div', { class: 'empty', text: 'There are no running servers. Press Play to start one!' })); return; }
      box.replaceChildren(...servers.map((s) => el('div', { class: 'server-row' },
        el('div', { class: 'server-info' },
          el('b', { text: `${s.players.length} of ${s.maxPlayers} people max` }),
          el('div', { class: 'server-bar' }, el('div', { style: { width: (s.players.length / s.maxPlayers) * 100 + '%' } })),
          el('div', { class: 'small muted', text: 'Server ' + s.id.slice(0, 8) })),
        el('div', { class: 'server-players' }, s.players.map((p) => el('a', { href: `/profile?id=${p.userId}`, title: p.name, class: 'server-head' }, p.avatar ? headshotImg({ username: p.name, avatar: p.avatar }, 64) : null))),
        el('button', { class: 'btn btn-green', text: 'Join', disabled: s.players.length >= s.maxPlayers, onclick: () => { if (!needLogin()) launchGame(id, s.id); } }))));
    }).catch((e) => toast(e.message, 'error'));
    return box;
  },
};
for (const name of Object.keys(TABS)) {
  const b = el('button', { text: name, onclick: () => { [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); tabBody.replaceChildren(TABS[name]()); } });
  tabs.append(b);
}
tabs.firstChild.click();

const style = document.createElement('style');
style.textContent = `
.game-top { display: flex; gap: 24px; }
.game-hero-thumb { flex: 0 0 55%; aspect-ratio: 16 / 10; background: #d4d4d4; border-radius: 3px; overflow: hidden; }
.game-hero-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.game-details { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.game-details h1 { font-size: 30px; word-break: break-word; }
.play-btn { width: 100%; padding: 14px; margin-top: 16px; }
.play-btn svg { width: 34px; height: 34px; }
.vote-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; cursor: pointer; color: var(--text-light); font-weight: 600; padding: 4px; }
.vote-btn.on { color: var(--blue); }
.vote-bar { height: 4px; background: #b8b8b8; border-radius: 2px; margin-top: 6px; overflow: hidden; }
.vote-fill { height: 100%; background: var(--text); }
.server-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.server-info { width: 200px; }
.server-bar { height: 6px; background: #e3e3e3; border-radius: 3px; margin: 6px 0; overflow: hidden; }
.server-bar div { height: 100%; background: var(--green); }
.server-players { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; }
.server-head { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #d4d4d4; }
.server-head img { width: 100%; height: 100%; }
@media (max-width: 800px) { .game-top { flex-direction: column; } .game-hero-thumb { flex: none; } .server-row { flex-wrap: wrap; } }
`;
document.head.append(style);
