// Home: a short greeting with the level, one compact "Today" strip (daily
// Robits, Daily Spin, Daily Quests), then the games. Nothing else.
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { spinDialog, pollCards } from '../fun.js';
import { saleBanner } from '../gifts.js';
import { el, gameCard, avatarCard, headshotImg, toast, MEMBERSHIP, joinFriendDialog, nameBadges, modal } from '../ui.js';
import { tr } from '../../i18n.js';

const me = await initPage({ active: 'home' });
const app = document.getElementById('app');

// ---------------------------------------------------------------- greeting
const levelBox = el('div', { class: 'greet-level' });
app.append(el('div', { class: 'section greet greet-card compact' },
  el('a', { class: 'greet-head', href: '/avatar', title: 'Avatar' }, headshotImg(me, 160)),
  el('div', { class: 'greet-main' },
    el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, el('h1', { style: { margin: 0 }, text: `Hello, ${me.username}!` }), nameBadges(me) ? el('span', { class: 'name-badges big' }, ...nameBadges(me).childNodes) : null,
      MEMBERSHIP[me.membership] ? el('span', { class: 'pill', style: { background: MEMBERSHIP[me.membership].color, color: '#fff' }, text: MEMBERSHIP[me.membership].short || MEMBERSHIP[me.membership].name }) : null,
      me.guest ? el('span', { class: 'pill', text: '👤 GUEST' }) : null),
    levelBox,
    window.ROBIS_STANDALONE ? el('button', { class: 'btn btn-green btn-small', style: { marginTop: '8px' }, text: 'Join a friend', onclick: joinFriendDialog }) : null)));

// The Last Night of Robis: the farewell event and the Wall of Thanks
if (me.farewell) {
  app.append(el('a', { class: 'section hw-banner fw-banner', href: '/farewell' },
    el('span', { class: 'hw-banner-ic', text: '🏮' }),
    el('span', { class: 'hw-banner-text' }, el('b', { text: 'The Last Night of Robis' }), el('span', { text: 'Every game is a warm night with lanterns. Play to get the Farewell Lantern and leave a message on the Wall of Thanks.' })),
    el('span', { class: 'btn btn-small hw-banner-btn', text: 'Open' })));
}
// Halloween 2026: every game got a spooky update
if (me.halloween) {
  app.append(el('a', { class: 'section hw-banner', href: '/halloween' },
    el('span', { class: 'hw-banner-ic', text: '🎃' }),
    el('span', { class: 'hw-banner-text' }, el('b', { text: 'Halloween is here!' }), el('span', { text: 'Every game got a spooky update. Find candies in any game and get Halloween items.' })),
    el('span', { class: 'btn btn-small hw-banner-btn', text: 'Open' })));
}

// ---------------------------------------------------------------- today
const strip = el('div', { class: 'section today-strip' });
app.append(strip);
const chip = (icon, title, sub, btn) => el('div', { class: 'today-chip' }, el('span', { class: 'today-chip-ic', text: icon }), el('div', { class: 'today-chip-text' }, el('b', { text: title }), el('span', { class: 'small muted', text: sub })), btn);
const stipendBtn = me.canClaimStipend ? el('button', { class: 'btn btn-green btn-small', text: `R$${me.stipend}`, onclick: async () => {
  try { const r = await api.post('/economy/stipend'); setRobits(r.robits); toast(`+${r.amount} Robits!`, 'success'); stipendBtn.disabled = true; stipendBtn.textContent = '✓'; } catch (e) { toast(e.message, 'error'); }
} }) : el('span', { class: 'today-done', text: '✓' });
const questChip = chip('📜', 'Daily Quests', '...', null);
strip.append(
  chip('🎁', 'Daily Robits', me.canClaimStipend ? 'Ready to collect' : 'Come back tomorrow', stipendBtn),
  chip('🎡', 'Daily Spin', 'Spin the wheel', el('button', { class: 'btn btn-primary btn-small', text: 'Spin', onclick: () => spinDialog(setRobits) })),
  questChip);

let quests = null;
function drawLevel(q) {
  const pct = q.to > q.from ? Math.round(((q.xp - q.from) / (q.to - q.from)) * 100) : 100;
  levelBox.replaceChildren(...[
    el('div', { class: 'lvl-row' }, el('span', { class: 'lvl-badge', text: String(q.level) }),
      el('div', { class: 'lvl-bar' }, el('i', { style: { width: pct + '%' } })),
      el('span', { class: 'small muted no-i18n', text: `${q.xp - q.from} / ${q.to - q.from} XP` })),
    q.boost ? el('div', { class: 'small lvl-boost', text: `🔥 x${q.boost.mult} XP event!` }) : null].filter(Boolean));
}
function drawQuestChip(q) {
  quests = q;
  drawLevel(q);
  if (!q.on || !q.quests.length) { questChip.remove(); return; }
  const done = q.quests.filter((x) => x.claimed).length;
  const ready = q.quests.filter((x) => x.done && !x.claimed).length;
  questChip.replaceChildren(el('span', { class: 'today-chip-ic', text: '📜' }),
    el('div', { class: 'today-chip-text' }, el('b', { text: 'Daily Quests' }), el('span', { class: 'small muted no-i18n', text: `${done} / ${q.quests.length}` })),
    el('button', { class: 'btn btn-small' + (ready ? ' btn-green' : ''), text: ready ? `${tr('Claim')} (${ready})` : tr('Open'), onclick: questsDialog }));
}
// the quests in a dialog (the home stays short)
function questsDialog() {
  const box = el('div', { class: 'quests-list' });
  const draw = () => box.replaceChildren(...quests.quests.map((x) => el('div', { class: 'quest' + (x.claimed ? ' claimed' : x.done ? ' done' : '') },
    el('div', { class: 'quest-text' }, el('span', { text: x.text }), el('span', { class: 'small muted no-i18n', text: ` ${x.progress}/${x.need}` })),
    el('div', { class: 'quest-bar' }, el('i', { style: { width: Math.round((x.progress / x.need) * 100) + '%' } })),
    el('div', { class: 'quest-foot' },
      el('span', { class: 'small no-i18n', text: `R$ ${x.robits} · ${x.xp} XP` }),
      x.claimed ? el('span', { class: 'small', text: '✓' })
        : x.done ? el('button', { class: 'btn btn-small btn-green', text: 'Claim', onclick: async () => {
          try { const r = await api.post(`/quests/${x.id}/claim`); setRobits(r.robits); toast(`+R$ ${r.got.robits} · +${r.got.xp} XP`, 'success'); drawQuestChip(r); draw(); } catch (e) { toast(e.message, 'error'); }
        } }) : null))));
  draw();
  const left = Math.max(0, quests.resetsAt - Date.now());
  modal({ title: tr('Daily Quests'), width: 460, body: el('div', {}, box, el('div', { class: 'small muted', style: { marginTop: '8px' }, text: `new in ${Math.floor(left / 3600e3)}h ${Math.floor((left % 3600e3) / 60e3)}m` })), buttons: [{ text: tr('Close') }] });
}
api.get('/quests').then(drawQuestChip).catch(() => questChip.remove());

// a sale or a poll only when there is one
const saleBox = el('div');
app.append(saleBox);
saleBanner().then((b) => { if (b) saleBox.replaceWith(b); else saleBox.remove(); });
const pollsBox = el('div');
app.append(pollsBox);
pollCards().then((c) => { if (c) pollsBox.replaceWith(c); else pollsBox.remove(); });

// ---------------------------------------------------------------- games
function section(title, href, content) {
  return el('div', { class: 'section' },
    el('div', { class: 'section-header' }, el('h2', { text: title }), href ? el('a', { class: 'see-all', href, text: 'See All →' }) : null),
    content);
}
const row = () => el('div', { class: 'game-row' }, ...Array.from({ length: 6 }, () => el('div', { class: 'game-card skeleton' })));
const friendsSec = section(`Friends (${me.friendCount})`, '/friends', el('div', { class: 'panel friends-row' }));
const recentSec = section('Continue Playing', null, row());
const popularSec = section('Recommended For You', '/games', row());
const favSec = section('Favorites', `/profile?id=${me.id}`, row());
app.append(friendsSec, recentSec, popularSec, favSec);

const [friends, recent, popular, favs] = await Promise.all([
  api.get(`/users/${me.id}/friends`), api.get('/games/recent'), api.get('/games?sort=featured'), api.get(`/users/${me.id}/favorites`),
]);
const fill = (sec, games) => { if (games.length) sec.querySelector('.game-row').replaceChildren(...games.map(gameCard)); else sec.remove(); };
// friends: online first; no row at all without friends
if (friends.friends.length) friendsSec.querySelector('.friends-row').replaceChildren(...friends.friends.sort((a, b) => (b.presence.status !== 'offline') - (a.presence.status !== 'offline')).slice(0, 12).map(avatarCard));
else friendsSec.remove();
fill(recentSec, recent.games);
fill(popularSec, popular.games);
fill(favSec, favs.games);
