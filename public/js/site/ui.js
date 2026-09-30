// Shared UI helpers: DOM builder, icons, cards, modals, formatting.
import { avatarHeadshot, gameThumbnail, itemThumbnail } from '../render/thumbs.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const ICONS = {
  home: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
  profile: '<circle cx="12" cy="8" r="4.5"/><path d="M3 21c1.5-4.5 5-6.5 9-6.5s7.5 2 9 6.5z"/>',
  messages: '<path d="M3 5h18v13H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 6 9 7 9-7" fill="none" stroke="currentColor" stroke-width="2"/>',
  friends: '<circle cx="8" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="3"/><path d="M1 20c1-4 3.5-6 7-6s6 2 7 6zm14.5-5.5c3 0 5.5 1.5 6.5 5.5h-5c-.3-2-1-3.8-1.5-5.5z"/>',
  avatar: '<path d="M8 2h8v6H8zM6 9h12v8H6zM3 9h2.5v8H3zm15.5 0H21v8h-2.5zM7 18h4.5v4H7zm5.5 0H17v4h-4.5z"/>',
  inventory: '<path d="M3 7h18v14H3zM8 3h8v4H8z" fill="none" stroke="currentColor" stroke-width="2"/>',
  games: '<path d="M6 7h12a4 4 0 0 1 4 4v4a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-4a4 4 0 0 1 4-4zm1 3v2H5v2h2v2h2v-2h2v-2H9v-2zm9 1a1 1 0 1 0 0 .01zm2 2a1 1 0 1 0 0 .01z"/>',
  catalog: '<path d="M4 3h16l-1.5 18h-13zM9 7a3 3 0 0 0 6 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  create: '<path d="M4 20h16M6 16l10-10 3 3-10 10H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  robits: '<path d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 8h4.2a2.6 2.6 0 0 1 0 5.2H9zm0 5.2V17m3.4-3.8L15.5 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.5 5.2-.1-3.4 2-1.6-2-3.4-2.4.9-2.9-1.7L14.7 2h-4l-.4 2.5-2.9 1.7L5 5.3 3 8.7l2 1.6v3.4l-2 1.6 2 3.4 2.4-.9 2.9 1.7.4 2.5h4l.4-2.5 2.9-1.7 2.4.9 2-3.4z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zm4 3h4a2 2 0 0 1-4 0z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  thumbup: '<path d="M2 10h4v11H2zm6 11V10l5-8c1.7 0 2.5 1.2 2.2 2.8L14.5 9H20c1.2 0 2.1 1.1 1.9 2.3l-1.4 7.8A2.3 2.3 0 0 1 18.2 21z"/>',
  thumbdown: '<path d="M22 14h-4V3h4zm-6-11v11l-5 8c-1.7 0-2.5-1.2-2.2-2.8L9.5 15H4c-1.2 0-2.1-1.1-1.9-2.3L3.5 4.9A2.3 2.3 0 0 1 5.8 3z"/>',
  people: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5z"/>',
  star: '<path d="m12 2 3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21.1l1.5-7L2 9.3l7-.8z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  logout: '<path d="M10 4H4v16h6M15 8l4 4-4 4M9 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trade: '<path d="M4 8h14l-4-4m6 12H6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  groups: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="11" r="2.5"/><circle cx="19" cy="11" r="2.5"/><path d="M6 21c.5-4 3-6 6-6s5.5 2 6 6zM0 19c.3-2.5 2-4 4.5-4l-1 4zm24 0c-.3-2.5-2-4-4.5-4l1 4z"/>',
  blog: '<path d="M4 3h12l4 4v14H4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11h8M8 15h8M8 7h5" stroke="currentColor" stroke-width="2"/>',
  studio: '<path d="M3 3h18v18H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8v8H8z"/>',
  badge: '<path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>',
  check: '<path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="m5 5 14 14M19 5 5 19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
};
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'icon ' + cls;
  span.style.display = 'inline-flex';
  span.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span;
}
export function iconSvg(name) { return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
export function robitsIcon() { const s = icon('robits', 'robits-icon'); return s; }

export function fmtNum(n) {
  n = +n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B+';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M+';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K+';
  return n.toLocaleString('en-US');
}
export function fmtFull(n) { return (+n || 0).toLocaleString('en-US'); }
export function fmtDate(t) { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
export function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return fmtDate(t);
}
export function qs(name) { return new URLSearchParams(location.search).get(name); }

export function presenceText(p) {
  if (!p) return '';
  if (p.status === 'ingame') return 'In Game';
  if (p.status === 'studio') return 'In Studio';
  if (p.status === 'online') return 'Online';
  return p.lastOnline ? 'Last online ' + timeAgo(p.lastOnline) : 'Offline';
}

// ------------------------------------------------------------ cards
export function gameCard(g) {
  const thumb = el('div', { class: 'thumb' });
  gameThumbnail(g).then((url) => { thumb.append(el('img', { src: url, alt: g.name, loading: 'lazy' })); });
  return el('a', { class: 'game-card', href: `/game?id=${g.id}`, title: g.name },
    g.featured ? el('span', { class: 'featured-tag', text: 'FEATURED' }) : null,
    thumb,
    el('div', { class: 'info' },
      el('div', { class: 'name', text: g.name }),
      el('div', { class: 'stats' },
        el('span', { html: iconSvg('thumbup') + ' ' + (g.rating === null ? '--' : g.rating + '%') }),
        el('span', { html: iconSvg('people') + ' ' + fmtNum(g.playing) }),
      ),
      g.creator ? el('div', { class: 'by', text: 'By ' + g.creator.username }) : null,
    ));
}

export function headshotImg(user, size = 150) {
  const img = el('img', { alt: user.username, loading: 'lazy' });
  avatarHeadshot(user.avatar, size).then((u) => { img.src = u; });
  return img;
}

export function avatarCard(user) {
  const hs = el('div', { class: 'headshot' }, headshotImg(user));
  const st = user.presence && user.presence.status;
  if (st && st !== 'offline') hs.append(el('span', { class: 'presence-dot ' + st }));
  return el('a', { class: 'avatar-card', href: `/profile?id=${user.id}` },
    hs,
    el('div', { class: 'name', text: user.username }),
    el('div', { class: 'presence', text: presenceText(user.presence) }));
}

export function itemCard(it, opts = {}) {
  const thumb = el('div', { class: 'thumb' });
  itemThumbnail(it).then((u) => thumb.append(el('img', { src: u, alt: it.name })));
  const card = el(opts.onClick ? 'div' : 'a', { class: 'item-card', href: opts.onClick ? null : `/item?id=${it.id}`, title: it.name, onclick: opts.onClick },
    it.limited ? el('span', { class: 'limited-tag', text: 'LIMITED' }) : null,
    it.owned && !opts.onClick ? el('span', { class: 'owned-tag', text: 'Owned' }) : null,
    thumb,
    el('div', { class: 'info' },
      el('div', { class: 'name', text: it.name }),
      opts.hidePrice ? null : el('div', { class: 'price' + (it.price ? '' : ' free') }, it.price ? [icon('robits', 'robits-icon'), fmtNum(it.price)] : 'Free')));
  return card;
}

// ------------------------------------------------------------ modals & toasts
export function modal({ title, body, buttons = [], onClose, width }) {
  const back = el('div', { class: 'modal-backdrop' });
  const close = () => { back.remove(); onClose && onClose(); };
  const box = el('div', { class: 'modal', style: width ? { maxWidth: width + 'px' } : null },
    title ? el('div', { class: 'modal-head' }, el('span', { text: title }), el('button', { onclick: close, html: '&times;', 'aria-label': 'Close' })) : null,
    el('div', { class: 'modal-body' }, body),
    buttons.length ? el('div', { class: 'modal-foot' }, buttons.map((b) => el('button', {
      class: 'btn ' + (b.cls || ''),
      onclick: async (e) => { const r = b.onClick ? await b.onClick(e) : undefined; if (r !== false) close(); },
    }, b.text))) : null);
  back.append(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  return { close, root: back };
}

export function toast(text, type = '') {
  const t = el('div', { class: 'toast ' + type, text });
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

export function spinner() { return el('div', { class: 'loading-spinner' }); }

// The 2019 "Robis is now loading. Get ready to play!" dialog before launching.
export function launchGame(gameId, serverId) {
  const logo = el('img', { src: '/img/icon.svg', class: 'spin-logo', alt: '' });
  const m = modal({
    body: el('div', { class: 'launch-dialog' }, logo,
      el('h3', { text: 'Robis is now loading. Get ready to play!' }),
      el('div', { class: 'muted', text: 'Starting the Robis Player...' })),
  });
  setTimeout(() => {
    m.close();
    location.href = `/play?placeId=${gameId}${serverId ? '&serverId=' + serverId : ''}`;
  }, 1300);
}
