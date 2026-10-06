import { initPage, setRobits, socialBanner, SITE } from '../layout.js';
import { api } from '../api.js';
import { spinDialog, pollCards } from '../fun.js';
import { saleBanner } from '../gifts.js';
import { el, gameCard, avatarCard, headshotImg, toast, spinner, MEMBERSHIP, joinFriendDialog, nameBadges } from '../ui.js';

const me = await initPage({ active: 'home' });
const app = document.getElementById('app');

// The greeting card: the avatar, the level with its XP bar, the membership.
const levelBox = el('div', { class: 'greet-level' });
const greeting = el('div', { class: 'section greet greet-card' },
  el('div', { class: 'greet-head' }, headshotImg(me, 256)),
  el('div', { class: 'greet-main' },
    el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, el('h1', { style: { margin: 0 }, text: `Hello, ${me.username}!` }), nameBadges(me) ? el('span', { class: 'name-badges big' }, ...nameBadges(me).childNodes) : null),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '4px' } },
      MEMBERSHIP[me.membership] ? el('span', { class: 'pill', style: { background: MEMBERSHIP[me.membership].color, color: '#fff' }, text: MEMBERSHIP[me.membership].name.toUpperCase() }) : null,
      me.guest ? el('span', { class: 'pill', text: '👤 GUEST' }) : null,
      me.isAdmin ? el('a', { class: 'pill', href: '/admin', style: { background: '#00a2ff', color: '#fff' }, text: 'ADMIN PANEL' }) : null),
    levelBox,
    window.ROBIS_STANDALONE ? el('div', { style: { marginTop: '10px' } }, el('button', { class: 'btn btn-green', text: 'Join a friend', onclick: joinFriendDialog })) : null));
app.append(greeting);
{ const b = socialBanner(SITE); if (b) app.append(b); }

// "Today": the daily Robits, the Daily Spin and the Daily Quests side by side.
const today = el('div', { class: 'section today-grid' });
app.append(el('div', { class: 'section-header' }, el('h2', { text: 'Today' })), today);
const stipendCard = me.canClaimStipend
  ? el('div', { class: 'today-card' },
    el('div', { class: 'today-ic', text: '🎁' }),
    el('b', { text: 'Daily Robits' }), el('div', { class: 'small muted', text: 'Log in every day to collect a free stipend.' }),
    el('button', { class: 'btn btn-green', text: `Collect R$${me.stipend}`, onclick: async (e) => {
      try { const r = await api.post('/economy/stipend'); setRobits(r.robits); toast(`+${r.amount} Robits!`, 'success'); e.target.disabled = true; e.target.textContent = '✓'; } catch (ex) { toast(ex.message, 'error'); }
    } }))
  : el('div', { class: 'today-card done' }, el('div', { class: 'today-ic', text: '✅' }), el('b', { text: 'Daily Robits' }), el('div', { class: 'small muted', text: 'Collected! Come back tomorrow.' }));
const spinCard = el('div', { class: 'today-card' },
  el('span', { class: 'spin-mini' }),
  el('b', { text: 'Daily Spin' }), el('div', { class: 'small muted', text: 'Robits, a rare hat or the R$ 1,000 jackpot!' }),
  el('button', { class: 'btn btn-primary', text: 'Spin', onclick: () => spinDialog(setRobits) }));
const questCard = el('div', { class: 'today-card quests-card' }, spinner());
today.append(stipendCard, spinCard, questCard);

function drawLevel(q) {
  const pct = q.to > q.from ? Math.round(((q.xp - q.from) / (q.to - q.from)) * 100) : 100;
  levelBox.replaceChildren(...[
    el('div', { class: 'lvl-row' }, el('span', { class: 'lvl-badge', text: String(q.level) }),
      el('div', { class: 'lvl-bar' }, el('i', { style: { width: pct + '%' } })),
      el('span', { class: 'small muted no-i18n', text: `${q.xp - q.from} / ${q.to - q.from} XP` })),
    q.boost ? el('div', { class: 'small lvl-boost', text: `🔥 x${q.boost.mult} XP event!` }) : null].filter(Boolean));
}
function drawQuests(q) {
  drawLevel(q);
  if (!q.on) { questCard.replaceChildren(el('div', { class: 'today-ic', text: '📜' }), el('b', { text: 'Daily Quests' }), el('div', { class: 'small muted', text: 'Quests are resting today.' })); return; }
  const left = Math.max(0, q.resetsAt - Date.now());
  questCard.replaceChildren(
    el('div', { class: 'row', style: { justifyContent: 'space-between', width: '100%' } }, el('b', { text: '📜 Daily Quests' }), el('span', { class: 'small muted', text: `new in ${Math.floor(left / 3600e3)}h ${Math.floor((left % 3600e3) / 60e3)}m` })),
    ...q.quests.map((x) => el('div', { class: 'quest' + (x.claimed ? ' claimed' : x.done ? ' done' : '') },
      el('div', { class: 'quest-text' }, el('span', { text: x.text }), el('span', { class: 'small muted no-i18n', text: ` ${x.progress}/${x.need}` })),
      el('div', { class: 'quest-bar' }, el('i', { style: { width: Math.round((x.progress / x.need) * 100) + '%' } })),
      el('div', { class: 'quest-foot' },
        el('span', { class: 'small no-i18n', text: `R$ ${x.robits} · ${x.xp} XP` }),
        x.claimed ? el('span', { class: 'small', text: '✓' })
          : x.done ? el('button', { class: 'btn btn-small btn-green', text: 'Claim', onclick: async () => {
            try { const r = await api.post(`/quests/${x.id}/claim`); setRobits(r.robits); toast(`+R$ ${r.got.robits} · +${r.got.xp} XP`, 'success'); drawQuests(r); } catch (e) { toast(e.message, 'error'); }
          } }) : null))));
}
api.get('/quests').then(drawQuests).catch(() => questCard.remove());

// The Daily Spin: a prize wheel once a day (the card above).
// A sale is on (or coming): the banner with its countdown
const saleBox = el('div');
app.append(saleBox);
saleBanner().then((b) => { if (b) saleBox.replaceWith(b); });

// The admins' polls
const pollsBox = el('div');
app.append(pollsBox);
pollCards().then((c) => { if (c) pollsBox.replaceWith(c); });

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

// The highest levels on Robis
api.get('/leaderboard/levels').then(({ players }) => {
  if (!players.length) return;
  app.append(section('Top Players', null, el('div', { class: 'panel top-levels' }, players.slice(0, 10).map((p, i) => el('a', { class: 'top-level', href: `/profile?id=${p.id}` },
    el('span', { class: 'top-rank', text: i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1) }),
    el('span', { class: 'no-i18n top-name', text: p.username }),
    el('span', { class: 'lvl-badge small', text: String(p.level) }))))));
}).catch(() => {});
