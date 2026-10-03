import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, fmtFull, fmtDate, headshotImg, avatarCard, gameCard, itemCard, presenceText, toast, modal, spinner, icon, launchGame, MEMBERSHIP, nameBadges, groupEmblem } from '../ui.js';
import { avatarFullBody } from '../../render/thumbs.js';

const me = await initPage({ active: 'profile', requireAuth: false });
const app = document.getElementById('app');
const uid = +qs('id') || me?.id;
if (!uid) { location.href = '/?returnUrl=/profile'; await new Promise(() => {}); }
let user;
try { ({ user } = await api.get(`/users/${uid}`)); } catch {
  app.append(el('div', { class: 'panel empty', text: 'User not found.' }));
  await new Promise(() => {});
}
document.title = `${user.username} - Robis`;
const own = me && me.id === user.id;

// ---------------------------------------------------------------- header
const actions = el('div', { class: 'row' });
function renderActions() {
  actions.replaceChildren();
  if (!me || own || user.isSystem) {
    if (own) actions.append(el('a', { class: 'btn', href: '/avatar', text: 'Edit Avatar' }));
    return;
  }
  if (user.isFriend) actions.append(el('button', { class: 'btn', text: 'Unfriend', onclick: async () => { await api.del(`/friends/${uid}`); user.isFriend = false; renderActions(); } }));
  else if (user.requestReceived) actions.append(el('button', { class: 'btn btn-primary', text: 'Accept Request', onclick: async () => { await api.post(`/friends/${uid}/accept`); user.isFriend = true; renderActions(); } }));
  else if (user.requestSent) actions.append(el('button', { class: 'btn', text: 'Request Sent', disabled: true }));
  else actions.append(el('button', { class: 'btn btn-primary', text: 'Add Friend', onclick: async () => {
    const r = await api.post(`/friends/${uid}/request`);
    if (r.status === 'friends') { user.isFriend = true; toast(`You are now friends with ${user.username}!`, 'success'); } else user.requestSent = true;
    renderActions();
  } }));
  actions.append(el('a', { class: 'btn', href: `/messages?to=${encodeURIComponent(user.username)}`, text: 'Message' }));
  actions.append(el('a', { class: 'btn', href: `/trades?with=${uid}` }, icon('trade'), 'Trade Items'));
  actions.append(el('button', { class: 'btn btn-report', title: 'Report this player to the Robis team', text: 'Report', onclick: async () => {
    const { reasons } = await api.get('/reports/reasons');
    const reason = el('select', { class: 'input' }, reasons.map((r) => el('option', { value: r, text: r })));
    const details = el('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: 'What happened? (optional)' });
    modal({
      title: `Report ${user.username}`,
      body: el('div', {}, el('p', { class: 'small muted', text: 'The Robis team will look at your report. Fake reports can get you banned.' }),
        el('label', { class: 'field' }, 'Reason', reason), el('label', { class: 'field' }, 'Details', details)),
      buttons: [{ text: 'Send report', cls: 'btn-red', onClick: async () => {
        try { await api.post('/reports', { userId: uid, reason: reason.value, details: details.value }); toast('Thanks! Your report was sent.', 'success'); } catch (e) { toast(e.message, 'error'); return false; }
      } }, { text: 'Cancel' }],
    });
  } }));
  if (user.presence.status === 'ingame' && user.presence.gameId) actions.append(el('button', { class: 'btn btn-green', text: 'Join Game', onclick: () => launchGame(user.presence.gameId) }));
}
renderActions();

const statusLine = el('div', { class: 'profile-status', text: user.status ? `"${user.status}"` : '' });
const header = el('div', { class: 'panel profile-header' },
  el('div', { class: 'profile-headshot' }, headshotImg(user, 300),
    user.presence.status !== 'offline' ? el('span', { class: 'presence-dot ' + user.presence.status, style: { width: '26px', height: '26px', right: '10px', bottom: '10px' } }) : null),
  el('div', { class: 'profile-main' },
    el('div', { class: 'row' }, el('h1', { class: 'no-i18n', style: { margin: 0 }, text: user.username }), nameBadges(user) ? el('span', { class: 'name-badges big' }, ...nameBadges(user).childNodes) : null,
      MEMBERSHIP[user.membership] ? el('span', { class: 'pill', title: MEMBERSHIP[user.membership].name, style: { background: MEMBERSHIP[user.membership].color, color: '#fff' }, text: MEMBERSHIP[user.membership].short }) : null,
      null),
    statusLine,
    el('div', { class: 'muted small', text: presenceText(user.presence) }),
    el('div', { class: 'profile-counts' },
      el('a', { href: `/friends?id=${uid}` }, el('b', { text: fmtFull(user.friendCount) }), ' Friends'),
      el('span', {}, el('b', { text: fmtFull(user.placeVisits) }), ' Place Visits')),
    actions));
app.append(header);

// ---------------------------------------------------------------- tabs
const tabs = el('div', { class: 'tabs', style: { marginTop: '20px' } });
const body = el('div');
app.append(tabs, body);

async function about() {
  const blurb = el('p', { style: { whiteSpace: 'pre-wrap' }, text: user.blurb || (own ? 'Tell people about yourself! Click Edit to write something.' : 'This user has not written anything yet.') });
  const aboutPanel = el('div', { class: 'panel' }, el('div', { class: 'section-header' }, el('h3', { text: 'About' }),
    own ? el('button', { class: 'btn btn-small', text: 'Edit', onclick: editAbout }) : null), blurb);
  const wearing = el('div', { class: 'panel' }, el('h3', { text: 'Currently Wearing' }));
  const bodyImg = el('img', { alt: '', style: { width: '100%', maxWidth: '360px' } });
  avatarFullBody(user.avatar, 420).then((u) => { bodyImg.src = u; });
  wearing.append(el('div', { class: 'wearing' }, el('div', { class: 'wearing-img' }, bodyImg),
    el('div', { class: 'item-grid', style: { flex: 1 } }, user.avatar.items.map((i) => itemCard({ ...i, price: 0 }, { hidePrice: true })))));
  const friendsP = el('div', { class: 'panel' }, el('div', { class: 'section-header' }, el('h3', { text: `Friends (${user.friendCount})` }), el('a', { class: 'btn btn-small', href: `/friends?id=${uid}`, text: 'See All' })), spinner());
  const favP = el('div', { class: 'panel' }, el('h3', { text: 'Favorite Games' }), spinner());
  const badgesP = el('div', { class: 'panel' }, el('h3', { text: 'Player Badges' }),
    user.badges.length ? el('div', { class: 'badges' }, user.badges.map((b) => el('a', { class: 'badge-card', href: `/game?id=${b.gameId}`, title: `Awarded ${fmtDate(b.awarded)}` },
      icon('badge'), el('b', { text: b.name }), el('span', { class: 'small muted', text: b.gameName })))) : el('div', { class: 'muted', text: 'No badges yet.' }));
  const statsP = el('div', { class: 'panel' }, el('h3', { text: 'Statistics' }),
    el('div', { class: 'stat-row', style: { border: 0, marginTop: 0, paddingTop: 0 } },
      el('div', {}, el('div', { class: 'label', text: 'Join Date' }), el('div', { class: 'value', text: fmtDate(user.created) })),
      el('div', {}, el('div', { class: 'label', text: 'Place Visits' }), el('div', { class: 'value', text: fmtFull(user.placeVisits) }))),
    user.previousNames && user.previousNames.length ? el('div', { class: 'small muted', style: { marginTop: '10px' } },
      el('span', { text: 'Previous usernames' }), ': ', el('span', { class: 'no-i18n', text: user.previousNames.join(', ') })) : null);
  const groupsP = el('div', { class: 'panel' }, el('div', { class: 'section-header' }, el('h3', { text: 'Groups' }), own ? el('a', { class: 'btn btn-small', href: '/groups', text: 'Find Groups' }) : null), spinner());
  const robisBadgesP = el('div', { class: 'panel' }, el('h3', { text: 'Robis Badges' }),
    (user.achievements || []).length ? el('div', { class: 'badges' }, user.achievements.map((b) => el('div', { class: 'badge-card robis-badge', title: b.desc },
      el('span', { class: 'rb-icon', text: b.icon }), el('b', { text: b.name }), el('span', { class: 'small muted', text: b.desc })))) : el('div', { class: 'muted', text: 'No Robis Badges yet.' }));
  body.replaceChildren(aboutPanel, wearing, friendsP, groupsP, favP, robisBadgesP, badgesP, statsP);
  const [fr, fav, grs] = await Promise.all([api.get(`/users/${uid}/friends`), api.get(`/users/${uid}/favorites`), api.get(`/users/${uid}/groups`).catch(() => ({ groups: [], primary: null }))]);
  const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };
  const sorted = grs.groups.slice().sort((a, b) => (grs.primary && b.id === grs.primary.id) - (grs.primary && a.id === grs.primary.id));
  groupsP.lastChild.replaceWith(sorted.length ? el('div', { class: 'group-grid' }, sorted.map((gr) => el('a', { class: 'group-card', href: `/group?id=${gr.id}` },
    groupEmblem(gr), el('div', { class: 'gc-info' }, el('div', { class: 'gc-name no-i18n', text: gr.name }),
      el('div', { class: 'small muted' }, el('span', { text: ROLE[gr.role] || '' }), grs.primary && grs.primary.id === gr.id ? el('span', { text: ' · Primary' }) : null)))))
    : el('div', { class: 'muted', text: 'Not in any groups.' }));
  friendsP.lastChild.replaceWith(fr.friends.length ? el('div', { class: 'friends-row', style: { padding: 0 } }, fr.friends.slice(0, 9).map(avatarCard)) : el('div', { class: 'muted', text: 'No friends yet.' }));
  favP.lastChild.replaceWith(fav.games.length ? el('div', { class: 'game-row' }, fav.games.map(gameCard)) : el('div', { class: 'muted', text: 'No favorites yet.' }));
}

function editAbout() {
  const status = el('input', { class: 'input', value: user.status || '', maxlength: 254 });
  const blurb = el('textarea', { class: 'input', rows: 6, maxlength: 1000 });
  blurb.value = user.blurb || '';
  modal({
    title: 'Edit Profile',
    body: el('div', {}, el('label', { class: 'field' }, 'Status', status), el('label', { class: 'field' }, 'About', blurb)),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: async () => {
      const r = await api.patch('/users/me', { status: status.value, blurb: blurb.value });
      user.status = r.user.status; user.blurb = r.user.blurb;
      statusLine.textContent = user.status ? `"${user.status}"` : '';
      about();
    } }, { text: 'Cancel' }],
  });
}

async function creations() {
  body.replaceChildren(el('div', { class: 'panel' }, spinner()));
  const { games } = await api.get(`/users/${uid}/games`);
  body.replaceChildren(el('div', { class: 'panel' }, el('h3', { text: 'Games' }),
    games.length ? el('div', { class: 'game-grid' }, games.map(gameCard)) : el('div', { class: 'empty', text: 'No public games yet.' })));
}

for (const [name, fn] of [['About', about], ['Creations', creations]]) {
  const b = el('button', { text: name, onclick: () => { [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); fn(); } });
  tabs.append(b);
}
tabs.firstChild.click();

const style = document.createElement('style');
style.textContent = `
.profile-header { display: flex; gap: 24px; align-items: center; }
.profile-headshot { width: 150px; height: 150px; border-radius: 50%; overflow: hidden; background: #d4d4d4; flex: none; position: relative; }
.profile-headshot img { width: 100%; height: 100%; }
.profile-main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.profile-status { font-style: italic; color: var(--text-light); }
.profile-counts { display: flex; gap: 20px; color: var(--text); }
.profile-counts a { color: var(--text); }
.tabs + div > .panel { border-radius: 0; }
.wearing { display: flex; gap: 20px; align-items: flex-start; }
.wearing-img { width: 300px; flex: none; background: radial-gradient(#fff, #e8e8e8); border-radius: 3px; }
.badges { display: flex; flex-wrap: wrap; gap: 12px; }
.badge-card { width: 130px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; color: var(--text); padding: 10px; background: var(--gray-bg); border-radius: 4px; }
.badge-card svg { width: 48px; height: 48px; color: #f6b702; }
@media (max-width: 760px) { .profile-header, .wearing { flex-direction: column; align-items: stretch; } .profile-header { text-align: center; } .profile-headshot { margin: 0 auto; } .profile-main .row, .profile-counts { justify-content: center; flex-wrap: wrap; } .wearing-img { width: 100%; } }
`;
document.head.append(style);
