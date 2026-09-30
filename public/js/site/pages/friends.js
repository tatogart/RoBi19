import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, avatarCard, headshotImg, spinner, toast, timeAgo } from '../ui.js';

const me = await initPage({ active: 'friends' });
const app = document.getElementById('app');
const uid = +qs('id') || me.id;
const own = uid === me.id;
const { user } = await api.get(`/users/${uid}`);
app.append(el('h1', { text: own ? 'My Friends' : `${user.username}'s Friends` }));

const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(tabs, body);

async function friends() {
  body.replaceChildren(spinner());
  const { friends: list } = await api.get(`/users/${uid}/friends`);
  body.replaceChildren(list.length ? el('div', { class: 'row wrap', style: { gap: '18px' } }, list.map(avatarCard)) : el('div', { class: 'empty', text: 'No friends yet.' }));
}

async function requests() {
  body.replaceChildren(spinner());
  const { requests: list } = await api.get('/friends/requests');
  if (!list.length) { body.replaceChildren(el('div', { class: 'empty', text: 'No friend requests.' })); return; }
  body.replaceChildren(...list.map((r) => {
    const row = el('div', { class: 'row', style: { padding: '10px 0', borderBottom: '1px solid #e3e3e3' } },
      el('a', { href: `/profile?id=${r.user.id}`, style: { width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: '#d4d4d4' } }, headshotImg(r.user, 112)),
      el('div', { class: 'spacer' }, el('a', { href: `/profile?id=${r.user.id}` }, el('b', { text: r.user.username })), el('div', { class: 'small muted', text: 'Sent ' + timeAgo(r.created) })),
      el('button', { class: 'btn btn-primary', text: 'Accept', onclick: async () => { await api.post(`/friends/${r.from}/accept`); toast('Friend added!', 'success'); row.remove(); } }),
      el('button', { class: 'btn', text: 'Ignore', onclick: async () => { await api.post(`/friends/${r.from}/decline`); row.remove(); } }));
    return row;
  }));
}

function find() {
  const input = el('input', { class: 'input', placeholder: 'Search for players by username', value: qs('q') || '' });
  const results = el('div', { class: 'row wrap', style: { gap: '18px', marginTop: '16px' } });
  const search = async () => {
    results.replaceChildren(spinner());
    const { users } = await api.get(`/users?q=${encodeURIComponent(input.value.trim())}`);
    results.replaceChildren(...(users.length ? users.filter((u) => u.id !== me.id).map(avatarCard) : [el('div', { class: 'empty', text: 'No players found.' })]));
  };
  body.replaceChildren(el('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); search(); } }, input, el('button', { class: 'btn btn-primary', text: 'Search' })), results);
  search();
}

const TABS = own ? [['Friends', friends], ['Requests', requests], ['Find Players', find]] : [['Friends', friends]];
for (const [name, fn] of TABS) {
  const b = el('button', { text: name, onclick: () => { [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); fn(); } });
  tabs.append(b);
}
tabs.firstChild.click();
