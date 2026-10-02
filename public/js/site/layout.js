// Builds the shared page chrome (blue header, left navigation, footer).
import { api, getMe } from './api.js';
import { el, icon, iconSvg, fmtNum, headshotImg, toast, modal, joinFriendDialog } from './ui.js';
import { installApp, isInstalled } from './install.js';
import { startInvites } from './invites.js';
import { startChatParty } from './chatparty.js';

const isStaff = (me) => me.isAdmin || (me.perms || []).some((p) => p === 'moderator' || p === 'economy');

const NAV = [
  ['home', 'Home', '/home'],
  ['profile', 'Profile', '/profile'],
  ['messages', 'Messages', '/messages'],
  ['friends', 'Friends', '/friends'],
  ['avatar', 'Avatar', '/avatar'],
  ['inventory', 'Inventory', '/inventory'],
  ['trade', 'Trade', '/trades'],
  ['groups', 'Groups', '/groups'],
  ['promocodes', 'Promo Codes', '/promocodes'],
  ['blog', 'Blog', '/blog'],
];

export async function initPage({ requireAuth = true, active = '', nav = true } = {}) {
  const me = await getMe();
  if (requireAuth && !me) {
    location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search);
    return new Promise(() => {});
  }
  document.body.prepend(buildHeader(me, active));
  if (nav && me) {
    document.body.prepend(buildNav(me, active));
    document.body.append(buildTabBar(active));
    document.body.classList.add('has-tabbar');
  }
  const content = document.querySelector('.rbx-content');
  if (content) {
    if (!nav || !me) content.classList.add('no-nav');
    content.append(buildFooter());
  }
  if (me) refreshCounts(me);
  showAnnouncement();
  if (me) startInvites();
  if (me && nav) startChatParty(me);
  return me;
}

function adminCodeDialog() {
  const input = el('input', { class: 'input', placeholder: 'XXXX-XXXX-XXXX', autocomplete: 'off', style: { textTransform: 'uppercase' } });
  modal({
    title: 'Admin Code',
    body: el('div', {}, el('p', { text: 'Only the owner of this Robis has the admin code.', style: { marginBottom: '10px' } }), input),
    buttons: [
      { text: 'Cancel' },
      { text: 'Activate', cls: 'btn-primary', onClick: async () => {
        try { await api.post('/auth/admin-code', { code: input.value }); } catch (e) { toast(e.message || 'Wrong admin code.', 'error'); return false; }
        toast('You are now an admin!', 'success');
        setTimeout(() => location.reload(), 600);
      } },
    ],
  });
  setTimeout(() => input.focus(), 50);
}

function buildHeader(me, active) {
  const search = el('form', { class: 'search', onsubmit: (e) => { e.preventDefault(); const q = e.target.q.value.trim(); location.href = '/games?q=' + encodeURIComponent(q); } },
    el('input', { name: 'q', placeholder: 'Search', 'aria-label': 'Search' }),
    el('button', { type: 'submit', html: iconSvg('search'), 'aria-label': 'Search', style: { color: '#999' } }));
  const right = el('div', { class: 'right' });
  if (me) {
    const robits = el('a', { href: '/robits', title: 'Robits' }, icon('robits', 'robits-icon'), el('span', { id: 'hdr-robits', text: fmtNum(me.robits) }));
    const bell = el('a', { href: '/friends', title: 'Notifications', class: 'hide-mobile' }, icon('bell'), el('span', { id: 'hdr-notif', class: 'badge-count hidden' }));
    const gear = el('button', { class: 'icon-btn', title: 'Settings', 'aria-label': 'Settings' }, icon('settings'));
    let dd = null;
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dd) { dd.remove(); dd = null; return; }
      dd = el('div', { class: 'dropdown' },
        el('a', { href: '/profile', text: 'My Profile' }),
        el('a', { href: '/develop', text: 'Create / Develop' }),
        el('a', { href: '/studio', text: 'Robis Studio' }),
        el('a', { href: '/robits', text: 'Robits & Builders Club' }),
        isStaff(me) ? el('a', { href: '/admin', text: 'Admin Panel' }) : null,
        me.isAdmin ? null : el('button', { text: 'Enter Admin Code', onclick: adminCodeDialog }),
        window.ROBIS_STANDALONE ? el('button', { text: 'Join a friend', onclick: joinFriendDialog }) : null,
        isInstalled() ? null : el('button', { text: 'Install Robis app', onclick: installApp }),
        el('a', { href: '/settings', text: 'Settings' }),
        el('a', { href: '/help', text: 'Help' }),
        el('button', { text: 'Logout', onclick: async () => { await api.post('/auth/logout'); location.href = '/'; } }));
      document.body.append(dd);
      const close = () => { if (dd) { dd.remove(); dd = null; } document.removeEventListener('click', close); };
      setTimeout(() => document.addEventListener('click', close));
    });
    right.append(robits, bell, gear);
  } else {
    right.append(el('a', { href: '/?signup=1', text: 'Sign Up', class: 'hide-mobile' }), el('a', { href: '/', text: 'Log In', class: 'login-btn' }));
  }
  const header = el('header', { class: 'rbx-header' },
    me ? el('button', { class: 'menu-btn', 'aria-label': 'Menu', html: '&#9776;', onclick: () => document.body.classList.toggle('nav-open') }) : null,
    el('a', { class: 'logo', href: me ? '/home' : '/' },
      el('img', { src: '/img/logo.svg', alt: 'ROBIS', class: 'logo-full' }),
      el('img', { src: '/img/icon.svg', alt: 'ROBIS', class: 'logo-small', style: { filter: 'brightness(0) invert(1)' } })),
    el('nav', { class: 'main' },
      el('a', { href: '/games', text: 'Games', class: active === 'games' ? 'active' : '' }),
      el('a', { href: '/catalog', text: 'Catalog', class: active === 'catalog' ? 'active' : '' }),
      el('a', { href: '/develop', text: 'Create', class: active === 'create' ? 'active' : '' }),
      el('a', { href: '/robits', text: 'Robits', class: active === 'robits' ? 'active' : '' })),
    search, right);
  return header;
}

// Bottom tab bar for phones (hidden on larger screens by CSS).
function buildTabBar(active) {
  const tabs = [['home', 'Home', '/home'], ['games', 'Games', '/games'], ['catalog', 'Catalog', '/catalog'], ['avatar', 'Avatar', '/avatar']];
  const bar = el('nav', { class: 'tabbar', 'aria-label': 'Main' },
    tabs.map(([ic, label, href]) => el('a', { href, class: active === ic ? 'active' : '' }, icon(ic), el('span', { text: label }))));
  const more = el('button', { type: 'button', 'aria-label': 'More' }, el('span', { class: 'icon', html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>' }), el('span', { text: 'More' }));
  more.addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('nav-open'); });
  bar.append(more);
  return bar;
}

function buildNav(me, active) {
  const nav = el('aside', { class: 'rbx-leftnav' });
  nav.append(el('a', { class: 'user', href: '/profile', style: { padding: '6px 16px 14px' } },
    el('span', { class: 'headshot' }, headshotImg(me, 64)), el('span', { text: me.username })));
  for (const [ic, label, href] of NAV) {
    const a = el('a', { href, class: active === ic ? 'active' : '' }, icon(ic), el('span', { text: label }));
    if (ic === 'messages') a.append(el('span', { class: 'count hidden', id: 'nav-msg' }));
    if (ic === 'friends') a.append(el('span', { class: 'count hidden', id: 'nav-friends' }));
    if (ic === 'trade') a.append(el('span', { class: 'count hidden', id: 'nav-trade' }));
    nav.append(a);
  }
  // Links that live in the top bar on desktop.
  nav.append(el('div', { class: 'section-label mobile-only', text: 'Explore' }));
  for (const [ic, label, href, key] of [['games', 'Games', '/games', 'games'], ['catalog', 'Catalog', '/catalog', 'catalog'], ['create', 'Create', '/develop', 'create'], ['robits', 'Robits', '/robits', 'robits']]) {
    nav.append(el('a', { href, class: 'mobile-only' + (active === key ? ' active' : '') }, icon(ic), el('span', { text: label })));
  }
  if (isStaff(me)) nav.append(el('a', { href: '/admin', class: active === 'admin' ? 'active' : '' }, icon('settings'), el('span', { text: 'Admin Panel' })));
  nav.append(el('div', { class: 'section-label', text: 'Events' }));
  if (me.hunt) nav.append(el('a', { href: '/hunt', class: 'hunt-nav' + (active === 'hunt' ? ' active' : '') }, el('span', { class: 'hunt-dot' }), el('span', { text: 'The Hunt' })));
  nav.append(el('a', { href: '/game?id=2' }, icon('star'), el('span', { text: 'Obby Week!' })));
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('nav-open') && !nav.contains(e.target) && !e.target.closest('.menu-btn')) document.body.classList.remove('nav-open');
  });
  return nav;
}

async function refreshCounts() {
  try {
    const [msgs, reqs, trades] = await Promise.all([api.get('/messages'), api.get('/friends/requests'), api.get('/trades/count').catch(() => ({ inbound: 0 }))]);
    const setCount = (id, n) => { const e = document.getElementById(id); if (e) { e.textContent = n; e.classList.toggle('hidden', !n); } };
    setCount('nav-msg', msgs.unread);
    setCount('nav-friends', reqs.requests.length);
    setCount('nav-trade', trades.inbound);
    setCount('hdr-notif', reqs.requests.length + msgs.unread + trades.inbound);
  } catch { /* ignore */ }
}

// The admins' site-wide announcement, under the header (players can hide it).
async function showAnnouncement() {
  let a;
  try { ({ announcement: a } = await api.get('/announcement')); } catch { return; }
  if (!a) return;
  const key = 'robis.announcement.hidden';
  try { if (localStorage.getItem(key) === String(a.time)) return; } catch { /* private mode */ }
  const bar = el('div', { class: 'announcement-bar ' + a.color },
    el('span', { class: 'announcement-icon', text: '📢' }),
    el('span', { class: 'announcement-text no-i18n', text: a.text }),
    el('button', { class: 'announcement-close', 'aria-label': 'Close', html: '&times;', onclick: () => {
      bar.remove();
      try { localStorage.setItem(key, String(a.time)); } catch { /* ignore */ }
    } }));
  const content = document.querySelector('.rbx-content');
  if (content) content.prepend(bar);
}

export function setRobits(n) {
  const e = document.getElementById('hdr-robits');
  if (e) e.textContent = fmtNum(n);
}

function buildFooter() {
  return el('footer', { class: 'footer' },
    el('div', { class: 'links' },
      el('a', { href: '/help', text: 'About Us' }), el('a', { href: '/help', text: 'Help' }),
      el('a', { href: '/develop', text: 'Create' }), el('a', { href: '/blog', text: 'Blog' }),
      el('a', { href: '/help#parents', text: 'Parents' }), el('a', { href: '/help#privacy', text: 'Privacy' })),
    el('div', { text: '©2019 Robis. An open-source fan tribute to the 2019 era of user-generated game platforms. Not affiliated with Roblox Corporation.' }));
}

export { toast };
