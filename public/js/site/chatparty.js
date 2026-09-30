// The "Chat & Party" bar from 2016–2019: bottom-right, shows which friends
// are online and lets you jump into their game or message them.
import { api } from './api.js';
import { el, headshotImg, presenceText, launchGame, userLink } from './ui.js';

export function startChatParty(me) {
  if (matchMedia('(max-width: 900px)').matches) return; // phones use the tab bar instead
  const count = el('span', { class: 'cp-count', text: '0' });
  const list = el('div', { class: 'cp-list' });
  const panel = el('div', { class: 'cp-panel hidden' }, el('div', { class: 'cp-head', text: 'Friends' }), list);
  const bar = el('button', { class: 'cp-bar', onclick: () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) load(); } },
    el('span', { text: 'Chat & Party' }), count);
  const root = el('div', { class: 'chat-party' }, panel, bar);
  document.body.append(root);

  async function load() {
    try {
      const { friends } = await api.get(`/users/${me.id}/friends`);
      const rank = (f) => ({ ingame: 0, studio: 1, online: 2 }[f.presence.status] ?? 3);
      friends.sort((a, b) => rank(a) - rank(b));
      count.textContent = friends.filter((f) => f.presence.status !== 'offline').length;
      list.replaceChildren(...(friends.length ? friends.map((f) => el('div', { class: 'cp-row' },
        el('a', { class: 'cp-head-img', href: `/profile?id=${f.id}` }, headshotImg(f, 64), el('span', { class: 'presence-dot ' + f.presence.status })),
        el('div', { class: 'cp-info' }, userLink(f), el('div', { class: 'small muted', text: presenceText(f.presence) })),
        f.presence.status === 'ingame' && f.presence.gameId
          ? el('button', { class: 'btn btn-small btn-green', text: 'Join', onclick: () => launchGame(f.presence.gameId) })
          : el('a', { class: 'btn btn-small', href: `/messages?to=${encodeURIComponent(f.username)}`, text: 'Message' })))
        : [el('div', { class: 'cp-empty muted', text: 'No friends yet.' })]));
    } catch { /* offline */ }
  }
  load();
  setInterval(load, 30000);
}
