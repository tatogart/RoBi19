// Builds the shared page chrome (blue header, left navigation, footer).
import { api, getMe } from './api.js';
import { inDiscord, setDiscordStatus } from '../discord.js';
import { el, icon, iconSvg, fmtNum, headshotImg, toast, modal, joinFriendDialog } from './ui.js';
import { installApp, isInstalled } from './install.js';
import { startInvites } from './invites.js';
import { startChatParty } from './chatparty.js';
import { installSecret, startLive } from './fun.js';
import { checkGifts } from './gifts.js';

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

// Social links (Admin Panel → Settings): small brand marks.
const SOCIAL_SVG = {
  telegram: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#29a9eb"/><path fill="#fff" d="M5.4 11.8l11.6-4.5c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5.1c.2-.2 0-.3-.4-.1l-6.9 4.4-3-.9c-.6-.2-.7-.6.1-.9z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033"/><path fill="#fff" d="M10 8.5v7l6-3.5z"/></svg>',
  discord: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#5865f2"/><path fill="#fff" d="M16.9 8.2a11 11 0 00-2.7-.8l-.3.6a10 10 0 00-3.8 0l-.3-.6a11 11 0 00-2.7.8C5.4 10.8 5 13.3 5.2 15.8a11 11 0 003.3 1.7l.7-1.1-1.1-.5.3-.2a7.8 7.8 0 006.8 0l.3.2-1.1.5.7 1.1a11 11 0 003.3-1.7c.3-2.9-.4-5.4-1.5-7.6zM9.8 14.3c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3zm4.4 0c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#111"/><path fill="#fff" d="M13.5 5h2.2c.2 1.5 1.2 2.6 2.8 2.8v2.2c-1 0-2-.3-2.8-.9v4.6a4 4 0 11-4-4v2.2a1.8 1.8 0 101.8 1.8z"/></svg>',
  vk: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0077ff"/><path fill="#fff" d="M12.8 16.5c-4.6 0-7.3-3.2-7.4-8.5h2.3c.1 3.9 1.8 5.6 3.2 5.9V8h2.2v3.4c1.3-.1 2.7-1.7 3.2-3.4h2.1a6.3 6.3 0 01-2.9 4.1 6.6 6.6 0 013.4 4.4h-2.4a4.2 4.2 0 00-3.4-3.1v3.1z"/></svg>',
  other: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#888"/><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" d="M10.5 13.5l3-3M9 11l-1.5 1.5a2.5 2.5 0 003.5 3.5L12.5 14.5M15 13l1.5-1.5A2.5 2.5 0 0013 8L11.5 9.5"/></svg>',
};
export function socialLinks(site, cls = 'social-links') {
  const list = (site && site.socials) || [];
  if (!list.length) return null;
  return el('div', { class: cls }, list.map((s) => el('a', { class: 'social-link', href: s.url, target: '_blank', rel: 'noopener', title: s.label },
    el('span', { class: 'social-icon', html: SOCIAL_SVG[s.type] || SOCIAL_SVG.other }), el('span', { class: 'no-i18n', text: s.label }))));
}
// A big "join us" card for the home page.
export function socialBanner(site) {
  const tg = ((site && site.socials) || [])[0];
  if (!tg) return null;
  return el('a', { class: 'social-banner', href: tg.url, target: '_blank', rel: 'noopener' },
    el('span', { class: 'social-banner-icon', html: SOCIAL_SVG[tg.type] || SOCIAL_SVG.other }),
    el('span', { class: 'social-banner-text' }, el('b', { text: `Join Robis on ${tg.label}!` }), el('span', { text: 'News, updates, events and giveaways first.' })),
    el('span', { class: 'btn btn-primary', text: 'Join' }));
}
export let SITE = null;

export async function initPage({ requireAuth = true, active = '', nav = true } = {}) {
  const [me, site] = await Promise.all([getMe(), api.get('/site').catch(() => null)]);
  SITE = site;
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
    content.append(buildFooter(site));
  }
  // Maintenance (Admin Panel → Settings): only staff get past this.
  if (site && site.maintenance && !site.staff && content) {
    content.replaceChildren(el('div', { class: 'maintenance' },
      el('img', { src: '/img/icon.svg', alt: '' }),
      el('h1', { text: 'Robis is under maintenance' }),
      el('p', { text: site.maintenance.message || 'We are making Robis better. Please come back soon!' }),
      socialLinks(site)), buildFooter(site));
    return new Promise(() => {});
  }
  if (me) refreshCounts(me);
  if (me && me.warning) showWarning(me.warning);
  // Inside a Discord Activity: what the player is doing goes in their Discord status.
  if (site && site.discord && inDiscord()) {
    const where = { home: 'On the home page', games: 'Looking for a game', catalog: 'Shopping in the catalog', avatar: 'Changing their avatar', create: 'Creating', hunt: 'On The Hunt', profile: 'Looking at a profile', trades: 'Trading', groups: 'In groups', admin: 'In the Admin Panel' }[active] || 'Browsing Robis';
    setDiscordStatus(site.discord.appId, where, me ? `as ${me.username}` : undefined);
  }
  showAnnouncement();
  if (me) { startInvites(); installSecret(setRobits); startLive(setRobits); setTimeout(checkGifts, 1200); setInterval(checkGifts, 60000); }
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
  if (SITE && SITE.socials && SITE.socials.length) {
    nav.append(el('div', { class: 'section-label', text: 'Community' }));
    for (const s of SITE.socials) nav.append(el('a', { href: s.url, target: '_blank', rel: 'noopener', class: 'nav-social' }, el('span', { class: 'social-icon', html: SOCIAL_SVG[s.type] || SOCIAL_SVG.other }), el('span', { class: 'no-i18n', text: s.label })));
  }
  nav.append(el('div', { class: 'section-label', text: 'Events' }));
  if (me.awards) nav.append(el('a', { href: '/awards', class: 'awards-nav' + (active === 'awards' ? ' active' : '') }, el('span', { class: 'ow-nav-ic', text: '🏆' }), el('span', { text: 'Robis Awards' }), me.awards.status === 'voting' ? el('span', { class: 'count awards-vote', text: 'VOTE' }) : null));
  if (me.overwatch) nav.append(el('a', { href: '/overwatch', class: active === 'overwatch' ? 'active' : '' }, el('span', { class: 'ow-nav-ic', text: '🕵️' }), el('span', { text: 'Overwatch' })));
  if (me.hunt) nav.append(el('a', { href: '/hunt', class: 'hunt-nav' + (active === 'hunt' ? ' active' : '') }, el('span', { class: 'hunt-dot' }), el('span', { text: 'The Hunt' })));
  nav.append(el('a', { href: '/game?id=2' }, icon('star'), el('span', { text: 'Obby Week!' })));
  nav.append(el('a', { href: '#', class: 'spin-nav', onclick: (e) => { e.preventDefault(); import('./fun.js').then((f) => f.spinDialog(setRobits)); } }, el('span', { class: 'spin-dot' }), el('span', { text: 'Daily Spin' })));
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

function buildFooter(site) {
  return el('footer', { class: 'footer' },
    socialLinks(site, 'social-links footer-socials'),
    el('div', { class: 'links' },
      el('a', { href: '/help', text: 'About Us' }), el('a', { href: '/help', text: 'Help' }),
      el('a', { href: '/develop', text: 'Create' }), el('a', { href: '/blog', text: 'Blog' }),
      el('a', { href: '/help#parents', text: 'Parents' }), el('a', { href: '/help#privacy', text: 'Privacy' })),
    el('div', { text: '©2019 Robis. An open-source fan tribute to the 2019 era of user-generated game platforms. Not affiliated with Roblox Corporation.' }));
}

export { toast };

// A warning from the Robis team: shown once, until the player presses OK.
function showWarning(w) {
  modal({
    title: 'Warning from the Robis team',
    body: el('div', { class: 'warning-popup' },
      el('div', { class: 'warning-icon', text: '!' }),
      el('p', { class: 'no-i18n', style: { fontWeight: 700 }, text: w.reason }),
      el('p', { class: 'small muted', text: `This is warning number ${w.count}. Please follow the rules - more warnings can lead to a ban.` })),
    buttons: [{ text: 'I understand', cls: 'btn-primary', onClick: () => api.post('/me/warning/seen', {}).catch(() => {}) }],
    onClose: () => api.post('/me/warning/seen', {}).catch(() => {}),
  });
}
