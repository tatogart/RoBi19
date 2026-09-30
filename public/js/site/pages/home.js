import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, gameCard, avatarCard, headshotImg, toast, spinner, MEMBERSHIP, joinFriendDialog } from '../ui.js';

const me = await initPage({ active: 'home' });
const app = document.getElementById('app');

const greeting = el('div', { class: 'section row greet', style: { gap: '20px' } },
  el('div', { class: 'greet-head', style: { width: '128px', height: '128px', borderRadius: '50%', overflow: 'hidden', background: '#d4d4d4', flex: 'none' } }, headshotImg(me, 256)),
  el('div', {},
    el('h1', { style: { margin: 0 }, text: `Hello, ${me.username}!` }),
    MEMBERSHIP[me.membership] ? el('div', { class: 'pill', style: { background: MEMBERSHIP[me.membership].color, color: '#fff' }, text: MEMBERSHIP[me.membership].name.toUpperCase() }) : null,
    me.isAdmin ? el('a', { class: 'pill', href: '/admin', style: { background: '#00a2ff', color: '#fff', marginLeft: '6px' }, text: 'ADMIN PANEL' }) : null,
    window.ROBIS_STANDALONE ? el('div', { style: { marginTop: '10px' } }, el('button', { class: 'btn btn-green', text: 'Join a friend', onclick: joinFriendDialog })) : null));
app.append(greeting);

if (me.canClaimStipend) {
  const banner = el('div', { class: 'panel section row stipend-banner' },
    el('span', { style: { fontSize: '28px' }, text: '🎁' }),
    el('div', { class: 'spacer' }, el('b', { text: 'Your daily Robits are ready!' }), el('div', { class: 'small muted', text: 'Log in every day to collect a free stipend.' })),
    el('button', { class: 'btn btn-green', text: `Collect R$${me.stipend}`, onclick: async () => {
      try { const r = await api.post('/economy/stipend'); setRobits(r.robits); toast(`+${r.amount} Robits!`, 'success'); banner.remove(); } catch (e) { toast(e.message, 'error'); }
    } }));
  app.append(banner);
}

function section(title, href, content) {
  return el('div', { class: 'section' },
    el('div', { class: 'section-header' }, el('h2', { text: title }), href ? el('a', { class: 'btn btn-small', href, text: 'See All' }) : null),
    content);
}

const friendsBox = el('div', { class: 'panel friends-row' }, spinner());
app.append(section(`Friends (${me.friendCount})`, '/friends', friendsBox));
const recentRow = el('div', { class: 'game-row' }, spinner());
const recentSec = section('Continue Playing', null, recentRow);
app.append(recentSec);
const popularRow = el('div', { class: 'game-row' }, spinner());
app.append(section('Recommended For You', '/games', popularRow));
const favRow = el('div', { class: 'game-row' });
const favSec = section('Favorites', `/profile?id=${me.id}`, favRow);
app.append(favSec);

const [friends, recent, popular, favs] = await Promise.all([
  api.get(`/users/${me.id}/friends`), api.get('/games/recent'), api.get('/games?sort=featured'), api.get(`/users/${me.id}/favorites`),
]);
friendsBox.replaceChildren(...(friends.friends.length
  ? friends.friends.sort((a, b) => (b.presence.status !== 'offline') - (a.presence.status !== 'offline')).map(avatarCard)
  : [el('div', { class: 'empty', text: 'You have no friends yet. Find some in the Friends tab!' })]));
if (recent.games.length) recentRow.replaceChildren(...recent.games.map(gameCard)); else recentSec.remove();
popularRow.replaceChildren(...popular.games.map(gameCard));
if (favs.games.length) favRow.replaceChildren(...favs.games.map(gameCard)); else favSec.remove();
