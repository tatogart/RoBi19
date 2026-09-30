// Builds the shared page chrome (blue header, left navigation, footer).
import { api, getMe } from './api.js';
import { el, icon, iconSvg, fmtNum, headshotImg, toast } from './ui.js';

const NAV = [
  ['home', 'Home', '/home'],
  ['profile', 'Profile', '/profile'],
  ['messages', 'Messages', '/messages'],
  ['friends', 'Friends', '/friends'],
  ['avatar', 'Avatar', '/avatar'],
  ['inventory', 'Inventory', '/inventory'],
  ['blog', 'Blog', '/blog'],
];

export async function initPage({ requireAuth = true, active = '', nav = true } = {}) {
  const me = await getMe();
  if (requireAuth && !me) {
    location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search);
    return new Promise(() => {});
  }
  document.body.prepend(buildHeader(me, active));
  if (nav && me) document.body.prepend(buildNav(me, active));
  const content = document.querySelector('.rbx-content');
  if (content) {
    if (!nav || !me) content.classList.add('no-nav');
    content.append(buildFooter());
  }
  if (me) refreshCounts(me);
  return me;
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
        el('a', { href: '/robits', text: 'Robits & Transactions' }),
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

function buildNav(me, active) {
  const nav = el('aside', { class: 'rbx-leftnav' });
  nav.append(el('a', { class: 'user', href: '/profile', style: { padding: '6px 16px 14px' } },
    el('span', { class: 'headshot' }, headshotImg(me, 64)), el('span', { text: me.username })));
  for (const [ic, label, href] of NAV) {
    const a = el('a', { href, class: active === ic ? 'active' : '' }, icon(ic), el('span', { text: label }));
    if (ic === 'messages') a.append(el('span', { class: 'count hidden', id: 'nav-msg' }));
    if (ic === 'friends') a.append(el('span', { class: 'count hidden', id: 'nav-friends' }));
    nav.append(a);
  }
  nav.append(el('a', { class: 'upgrade', href: '/robits', text: me.membership === 'None' ? 'Get Builders Club' : 'Builders Club' }));
  nav.append(el('div', { class: 'section-label', text: 'Events' }));
  nav.append(el('a', { href: '/game?id=2' }, icon('star'), el('span', { text: 'Obby Week!' })));
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('nav-open') && !nav.contains(e.target) && !e.target.closest('.menu-btn')) document.body.classList.remove('nav-open');
  });
  return nav;
}

async function refreshCounts() {
  try {
    const [msgs, reqs] = await Promise.all([api.get('/messages'), api.get('/friends/requests')]);
    const setCount = (id, n) => { const e = document.getElementById(id); if (e) { e.textContent = n; e.classList.toggle('hidden', !n); } };
    setCount('nav-msg', msgs.unread);
    setCount('nav-friends', reqs.requests.length);
    setCount('hdr-notif', reqs.requests.length + msgs.unread);
  } catch { /* ignore */ }
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
