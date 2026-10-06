// Admin Panel 2.0 ("Control Center"): a sidebar with every section, live numbers
// and a search for everything (Ctrl+K), a player panel with tabs (inventory: give
// any item; economy, warnings, notes, history), reports, activity, Gift Center.
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { tr } from '../../i18n.js';
import { el, fmtFull, fmtNum, headshotImg, toast, modal, timeAgo, spinner, nameBadges, itemCard, presenceText } from '../ui.js';
import { BADGE_SVG, BADGE_TITLE } from '../../badges.js';
import { avatarHeadshot } from '../../render/thumbs.js';

const me = await initPage({ active: 'admin' });
const app = document.getElementById('app');
const perm = (p) => me.isAdmin || (me.perms || []).includes(p);
if (!perm('moderator') && !perm('economy')) {
  app.append(el('div', { class: 'panel empty', text: 'Only admins can open this page.' }));
  await new Promise(() => {});
}

// ---------------------------------------------------------------- layout
// Admin Panel 2.0: a sidebar with every section in groups, a top bar with the
// live numbers and the search (Ctrl+K: players, items, sections, actions).
const ICONS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z',
  pulse: 'M2 12h4l3-8 4 16 3-8h6',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zm-7 10a7 7 0 0114 0zm14-10a3.5 3.5 0 100-7M18 21h4a6 6 0 00-5-6',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  badge: 'M12 2l3 6 6 1-4.5 4.5 1 6.5L12 17l-5.5 3 1-6.5L3 9l6-1z',
  gift: 'M3 10h18v4H3zm2 4h14v8H5zm7-4v12M12 10c-2-4-7-5-7-2s5 2 7 2zm0 0c2-4 7-5 7-2s-5 2-7 2',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zm0 0l9 4 9-4M12 11v10',
  ticket: 'M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4zm11 0v12',
  game: 'M6 8h12a4 4 0 014 4v2a3 3 0 01-5 2l-2-2H9l-2 2a3 3 0 01-5-2v-2a4 4 0 014-4zm1 3v4m-2-2h4m7-1h.01M18 14h.01',
  hunt: 'M12 2l7 10-7 10-7-10z',
  server: 'M3 4h18v6H3zm0 10h18v6H3zm3-7h.01M6 17h.01',
  megaphone: 'M3 10v4h4l6 5V5L7 10zm13-2a5 5 0 010 8',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zm8-3l2-1-2-4-2 1a7 7 0 00-2-1V5h-4v2a7 7 0 00-2 1L8 7 6 11l2 1v2l-2 1 2 4 2-1a7 7 0 002 1v2h4v-2a7 7 0 002-1l2 1 2-4-2-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zm10 3l-5-5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  wheel: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 0v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  terminal: 'M3 5h18v14H3zm4 4l3 3-3 3m5 0h5',
  crown: 'M3 18h18M4 16L3 7l5 4 4-6 4 6 5-4-1 9z',
  scale: 'M12 3v18M7 21h10M4 7h16M4 7l-2 6a3 3 0 006 0zm16 0l-2 6a3 3 0 006 0z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  tag: 'M3 12V3h9l9 9-9 9zm4-5h.01',
  chat: 'M4 5h16v11H9l-5 4z',
  note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-13v5l3 2',
  toggle: 'M8 7h8a5 5 0 010 10H8A5 5 0 018 7zm0 7a2 2 0 100-4 2 2 0 000 4z',
  coins: 'M12 7c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 4v6c0 1.7 3.6 3 8 3s8-1.3 8-3V4M4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4 1.3 6L12 16.4 6.6 19.3l1.3-6-4.5-4 6-.7z',
  sidebar: 'M3 4h18v16H3zM9 4v16',
};
const ic = (name, cls = 'adm-ic') => el('span', { class: cls, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ICONS.box}"/></svg>` });

const announceBox = el('div');
const nav = el('nav', { class: 'adm-nav' });
const pageTitle = el('div', { class: 'adm-page-title' });
const liveBox = el('div', { class: 'adm-live' });
const body = el('div', { class: 'adm-body' }, spinner());
const subBar = el('div', { class: 'adm-subtabs' }); // the tabs of the open section (5.0)
// sections pass `cond ? panel : null`: leave the nulls out (the DOM would print "null")
body.replaceChildren = (...kids) => Element.prototype.replaceChildren.apply(body, kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
const searchBtn = el('button', { class: 'adm-search', onclick: () => palette() }, ic('search'), el('span', { class: 'adm-search-text', text: 'Search players, items, sections...' }), el('kbd', { text: 'Ctrl K' }));
// Control Center 5.0 Classic: compact, the old admin look; full width (the site's menu steps aside), a sidebar that
// folds to icons, favourite sections on top, groups that fold away.
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
document.body.classList.add('adm-full');
const shell = el('div', { class: 'adm adm-classic' + (store.get('adm.mini', false) ? ' mini' : '') });
const foldBtn = el('button', { class: 'adm-fold', title: 'Fold the menu', onclick: () => { shell.classList.toggle('mini'); store.set('adm.mini', shell.classList.contains('mini')); } }, ic('sidebar'));
app.append(shell);
shell.append(
  el('aside', { class: 'adm-side' },
    el('div', { class: 'adm-brand' }, el('div', { class: 'adm-logo' }, ic('bolt')), el('div', { class: 'adm-brand-text' }, el('b', {}, el('span', { text: 'Control Center' }), el('span', { class: 'adm-ver', text: '5.0' })), el('div', { class: 'adm-brand-sub', text: me.isAdmin ? 'Administrator' : 'Staff' })), foldBtn),
    nav,
    el('div', { class: 'adm-side-foot' }, el('span', { class: 'no-i18n', text: me.username }), el('span', { class: 'muted', text: ' · Control Center 5.0 Classic' }))),
  el('main', { class: 'adm-main' },
    el('div', { class: 'adm-top' }, pageTitle, searchBtn, liveBox, el('a', { class: 'adm-back', href: '/home', title: 'Back to the site' }, ic('home'))),
    subBar,
    body));

let data;
async function load() {
  data = await api.get('/admin/overview');
  if (!pageTitle.childNodes.length) pageTitle.replaceChildren(ic(TABS[current].icon), el('span', { text: TABS[current].label }));
  drawAnnouncement();
  TABS[current].draw();
}

// ---------------------------------------------------------------- announcement
function drawAnnouncement() {
  if (!perm('moderator')) { announceBox.replaceChildren(); return; }
  const a = data.announcement;
  const text = el('input', { class: 'input', maxlength: 300, placeholder: 'Message for every player (shown on every page and in games)', value: a ? a.text : '' });
  const color = el('select', { class: 'input', style: { width: 'auto', flex: 'none', minWidth: 0 } },
    [['blue', 'Blue'], ['green', 'Green'], ['orange', 'Orange'], ['red', 'Red']].map(([v, t]) => el('option', { value: v, text: t, selected: (a?.color || 'blue') === v })));
  const post = async (t) => {
    try { await api.post('/admin/announcement', { text: t, color: color.value }); toast(t ? 'Announcement posted' : 'Announcement removed', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  announceBox.replaceChildren(el('div', { class: 'panel' },
    el('h3', { text: 'Announcement' }),
    a ? el('div', { class: 'small muted', style: { marginBottom: '8px' }, text: `Showing now · posted by ${a.by} ${timeAgo(a.time)}` }) : null,
    el('div', { class: 'row wrap' }, text, color,
      el('button', { class: 'btn btn-primary', text: 'Post', onclick: () => post(text.value.trim()) }),
      a ? el('button', { class: 'btn', text: 'Remove', onclick: () => post('') }) : null)));
}

// ---------------------------------------------------------------- sections
const TABS = {
  dashboard: { label: 'Dashboard', group: 'Overview', icon: 'home', draw: drawDashboard },
  notes: { label: 'Staff Notes', group: 'Overview', icon: 'note', draw: drawNotes },
  activity: { label: 'Activity', group: 'Overview', icon: 'pulse', draw: drawActivity },
  players: { label: 'Players', group: 'People', icon: 'users', draw: drawPlayers },
  alts: { label: 'Alt Accounts', group: 'People', icon: 'eye', draw: drawAlts, perm: 'moderator' },
  reports: { label: 'Reports', group: 'People', icon: 'flag', draw: drawReports, perm: 'moderator' },
  appeals: { label: 'Appeals', group: 'People', icon: 'scale', draw: drawAppeals, perm: 'moderator' },
  chat: { label: 'Chat Log', group: 'People', icon: 'chat', draw: drawChatLog, perm: 'moderator' },
  overwatch: { label: 'Overwatch', group: 'People', icon: 'eye', draw: drawOverwatch, admin: true },
  badges: { label: 'Badges', group: 'People', icon: 'badge', draw: drawBadges, admin: true },
  gifts: { label: 'Gift Center', group: 'Economy', icon: 'gift', draw: drawGifts, admin: true },
  items: { label: 'Items', group: 'Economy', icon: 'box', draw: drawItems },
  promo: { label: 'Promo Codes', group: 'Economy', icon: 'ticket', draw: drawPromo, perm: 'economy' },
  spin: { label: 'Daily Spin', group: 'Economy', icon: 'wheel', draw: drawSpin, admin: true },
  sales: { label: 'Sales', group: 'Economy', icon: 'tag', draw: drawSales, admin: true },
  economy: { label: 'Economy', group: 'Economy', icon: 'coins', draw: drawEconomy, admin: true },
  progress: { label: 'Quests & Levels', group: 'Economy', icon: 'star', draw: drawProgress, admin: true },
  games: { label: 'Games', group: 'Content', icon: 'game', draw: drawGames },
  hunt: { label: 'The Hunt', group: 'Content', icon: 'hunt', draw: drawHunt, admin: true },
  polls: { label: 'Polls', group: 'Content', icon: 'chart', draw: drawPolls, admin: true },
  awards: { label: 'Robis Awards', group: 'Content', icon: 'star', draw: drawAwards, admin: true },
  servers: { label: 'Servers', group: 'Live', icon: 'server', draw: drawServers },
  abuse: { label: 'Admin Abuse', group: 'Live', icon: 'crown', draw: drawAbuse, admin: true },
  bots: { label: 'Bots', group: 'Live', icon: 'users', draw: drawBots, admin: true },
  live: { label: 'Live Events', group: 'Live', icon: 'sparkle', draw: drawLiveEvents, admin: true },
  broadcast: { label: 'Broadcast', group: 'Live', icon: 'megaphone', draw: drawBroadcast, admin: true },
  schedule: { label: 'Scheduler', group: 'Live', icon: 'clock', draw: drawSchedule, admin: true },
  tools: { label: 'Site Tools', group: 'System', icon: 'bolt', draw: drawSiteTools, admin: true },
  settings: { label: 'Settings', group: 'System', icon: 'gear', draw: drawSettings, admin: true },
  switches: { label: 'Switches', group: 'System', icon: 'toggle', draw: drawSwitches, admin: true },
  console: { label: 'Console', group: 'System', icon: 'terminal', draw: drawConsole, admin: true },
  log: { label: 'Admin Log', group: 'System', icon: 'list', draw: drawLog },
};
for (const [id, t] of Object.entries(TABS)) if ((t.admin && !me.isAdmin) || (t.perm && !perm(t.perm))) delete TABS[id];
let current = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
const navBtns = {};
// Control Center 5.0: the sidebar has only the big sections (Overview, Players,
// Economy...), each one a row of classic tabs on top of the page.
const GROUP_ICONS = { Overview: 'home', People: 'users', Economy: 'coins', Content: 'game', Live: 'server', System: 'gear' };
const GROUP_NAMES = { People: 'Players' };
function openTab(id) {
  current = id;
  store.set('adm.last.' + TABS[id].group, id);
  buildNav();
  pageTitle.replaceChildren(ic(TABS[id].icon), el('span', { text: GROUP_NAMES[TABS[id].group] || TABS[id].group }), el('span', { class: 'adm-crumb', text: '›' }), el('span', { text: TABS[id].label }));
  closeDrawer();
  TABS[id].draw();
}
const counts = {}; // tab -> [number, colour]
function buildNav() {
  const groups = [...new Set(Object.values(TABS).map((t) => t.group))];
  const out = [];
  for (const g of groups) {
    const ids = Object.keys(TABS).filter((id) => TABS[id].group === g);
    const n = ids.reduce((a, id) => a + ((counts[id] && counts[id][0]) || 0), 0);
    const hot = ids.map((id) => counts[id]).find((c) => c && c[0]);
    const go = () => { const last = store.get('adm.last.' + g, ids[0]); const id = TABS[last] && TABS[last].group === g ? last : ids[0]; history.replaceState(null, '', '#' + id); openTab(id); };
    const b = el('button', { class: 'adm-link' + (ids.includes(current) ? ' active' : ''), title: GROUP_NAMES[g] || g, onclick: go },
      ic(GROUP_ICONS[g] || 'box'), el('span', { class: 'adm-link-text', text: GROUP_NAMES[g] || g }), el('span', { class: 'adm-sub-n', text: String(ids.length) }),
      el('span', { class: 'adm-count' + (n ? ' on ' + (hot[1] || '') : ''), text: n ? String(n) : '' }));
    navBtns[g] = b;
    out.push(b);
  }
  nav.replaceChildren(...out);
  // the tabs of the open section
  const g = TABS[current].group;
  subBar.replaceChildren(...Object.keys(TABS).filter((id) => TABS[id].group === g).map((id) => {
    const c = counts[id];
    return el('button', { class: 'adm-subtab' + (id === current ? ' active' : ''), onclick: () => { history.replaceState(null, '', '#' + id); openTab(id); } },
      el('span', { text: TABS[id].label }), c && c[0] ? el('span', { class: 'adm-count on ' + (c[1] || ''), text: String(c[0]) }) : null);
  }));
}
buildNav();
// what needs a look: open reports, appeals, Overwatch cases, flagged chat
async function pollAttention() {
  try {
    const a = await api.get('/admin/attention');
    Object.assign(counts, { reports: [a.reports, 'red'], appeals: [a.appeals, 'orange'], overwatch: [a.overwatch, 'orange'], chat: [a.chat, 'yellow'], schedule: [a.scheduled, 'blue'] });
    window.__admAttention = a;
    buildNav();
  } catch { /* no rights or offline */ }
}
pollAttention();
setInterval(pollAttention, 30000);
addEventListener('hashchange', () => { const id = location.hash.slice(1); if (TABS[id] && id !== current) openTab(id); });

// The live numbers at the top (and the open reports in the sidebar).
async function pollLive() {
  try {
    const l = await api.get('/admin/live');
    liveBox.replaceChildren(
      el('span', { class: 'adm-chip green', title: 'Online now' }, el('i', { class: 'dot' }), el('b', { text: String(l.online) }), el('span', { text: ' online' })),
      el('span', { class: 'adm-chip blue', title: 'Playing now' }, el('b', { text: String(l.playing) }), el('span', { text: ' playing' })),
      el('span', { class: 'adm-chip', title: 'Game servers' }, el('b', { text: String(l.servers) }), el('span', { text: ' servers' })));
    void l.reports;
  } catch { /* offline for a moment */ }
}
pollLive();
setInterval(pollLive, 15000);

// ---------------------------------------------------------------- players
const search = el('input', { class: 'input', placeholder: 'Search players' });
const filter = el('select', { class: 'input', style: { width: 'auto', flex: 'none', minWidth: 0 } },
  [['all', 'Everyone'], ['players', 'Players (no bots, no guests)'], ['people', 'Without bots'], ['bots', '🤖 Bots'], ['guests', '👤 Guests'], ['online', 'Online'], ['banned', 'Banned'], ['warned', 'With warnings'], ['staff', 'Staff'], ['badges', 'With badges'], ['new', 'New today'], ['rich', 'Richest first']].map(([v, t]) => el('option', { value: v, text: t })));
const list = el('div');
// a phone can't draw hundreds of avatars at once: wait for the typing to stop,
// show the list a page at a time and draw a head only when it scrolls into view
let searchTimer = 0;
search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { shown = PAGE; drawList(); }, 250); });
filter.addEventListener('change', () => { shown = PAGE; drawList(); });
const PAGE = 30;
var shown = PAGE;
const headQueue = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    headQueue.unobserve(e.target);
    const u = e.target._user;
    avatarHeadshot(u.avatar, 96).then((url) => { e.target.src = url; }).catch(() => {});
  }
}, { rootMargin: '200px' }) : null;
function lazyHead(u) {
  if (!headQueue) return headshotImg(u, 96);
  const img = el('img', { alt: u.username, class: 'lazy-head' });
  img._user = u;
  headQueue.observe(img);
  return img;
}

function drawPlayers() {
  body.replaceChildren(el('div', { class: 'row wrap', style: { marginBottom: '12px' } }, search, filter), bulkBar, list);
  drawBulk();
  drawList();
}
const FILTERS = {
  all: () => true,
  people: (u) => !u.bot,
  players: (u) => !u.bot && !u.guest,
  guests: (u) => !!u.guest,
  bots: (u) => !!u.bot,
  online: (u) => u.presence && u.presence.status !== 'offline',
  banned: (u) => u.banned,
  staff: (u) => u.isAdmin || (u.perms || []).length,
  badges: (u) => (u.flags || []).length > 0,
  new: (u) => Date.now() - u.created < 24 * 3600e3,
  warned: (u) => (u.warnings || 0) > 0,
  rich: () => true,
};
function drawList() {
  const q = search.value.trim().toLowerCase();
  const users = data.users.filter((u) => (!q || u.username.toLowerCase().includes(q) || String(u.id) === q) && FILTERS[filter.value](u));
  if (filter.value === 'rich') users.sort((a, b) => b.robits - a.robits);
  const more = users.length > shown ? el('button', { class: 'btn btn-block', style: { marginTop: '8px' }, text: `Show more (${users.length - shown} left)`, onclick: () => { shown += PAGE * 2; drawList(); } }) : null;
  list.replaceChildren(...(users.length ? [el('div', { class: 'small muted', style: { marginBottom: '6px' }, text: `${users.length} found` }), ...users.slice(0, shown).map(row)] : [el('div', { class: 'empty', text: 'No players found.' })]), ...(more ? [more] : []));
}

function replaceUser(u) {
  const i = data.users.findIndex((x) => x.id === u.id);
  if (i >= 0) data.users[i] = u;
  if (u.id === me.id) setRobits(u.robits);
  if (current === 'players') drawList();
}

async function act(path, body, msg) {
  try {
    const r = await api.post(path, body);
    if (r.user) replaceUser(r.user);
    if (msg) toast(msg, 'success');
    return r;
  } catch (e) { toast(e.message, 'error'); return null; }
}

const PERM_NAMES = { moderator: 'Moderator', economy: 'Economy', items: 'Item Creator', limiteds: 'Limited Creator', games: 'Curator' };
function pills(u) {
  return [
    u.isAdmin ? el('span', { class: 'pill admin-pill', text: 'Admin' }) : null,
    u.bot ? el('span', { class: 'pill', text: '🤖 Bot' }) : null,
    u.guest ? el('span', { class: 'pill', text: '👤 Guest' }) : null,
    ...(u.perms || []).map((p) => el('span', { class: 'pill perm-pill', text: PERM_NAMES[p] || p })),
    u.banned ? el('span', { class: 'pill ban-pill', text: (u.deviceBan ? 'Device ban' : 'Banned') + (u.banUntil ? ' until ' + new Date(u.banUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '') }) : null,
  ];
}

// ---- many players at once: tick them, then pick an action in the bar
const picked = new Map(); // id -> user
const bulkBar = el('div', { class: 'bulk-bar' });
function drawBulk() {
  bulkBar.classList.toggle('on', picked.size > 0);
  if (!picked.size) { bulkBar.replaceChildren(); return; }
  const B = (t, fn, cls = '') => el('button', { class: 'cl-btn ' + cls, text: t, onclick: fn });
  bulkBar.replaceChildren(
    el('b', { class: 'bulk-count', text: `${picked.size} selected` }),
    perm('moderator') ? B('Warn', () => bulkAsk('Warn the selected players', 'What is the warning for?', (u, v) => api.post(`/admin/users/${u.id}/warn`, { reason: v }))) : null,
    perm('moderator') ? B('Message', () => bulkAsk('Message the selected players', 'Message from the Robis team', (u, v) => api.post(`/admin/users/${u.id}/tool`, { op: 'systemMessage', body: v }))) : null,
    perm('economy') ? B('Give Robits', () => bulkAsk('Give Robits to the selected players', 'How many? (minus takes)', (u, v) => api.post(`/admin/users/${u.id}/robits`, { amount: Math.trunc(+v || 0) }), 'number')) : null,
    me.isAdmin ? B('Give XP', () => bulkAsk('Give XP to the selected players', 'How much XP?', (u, v) => api.post(`/admin/users/${u.id}/xp`, { amount: Math.trunc(+v || 0) }), 'number')) : null,
    perm('moderator') ? B('Ban 1 day', () => bulkAsk('Ban the selected players for 1 day', 'Reason', (u, v) => api.post(`/admin/users/${u.id}/ban`, { banned: true, duration: '1d', reason: v })), 'red') : null,
    B('Clear', () => { picked.clear(); drawBulk(); drawList(); }));
}
function bulkAsk(title, placeholder, fn, type = 'text') {
  const input = el(type === 'number' ? 'input' : 'textarea', { class: 'input', placeholder, ...(type === 'number' ? { type: 'number', value: 100 } : { rows: 3, maxlength: 500 }) });
  const users = [...picked.values()].filter((u) => u.id !== me.id);
  modal({
    title, width: 480,
    body: el('div', {}, el('p', { class: 'small muted no-i18n', text: users.map((u) => u.username).join(', ') }), input),
    buttons: [{ text: 'Do it', cls: 'btn-primary', onClick: async () => {
      const v = input.value.trim();
      if (!v) { toast('Fill it in first.', 'error'); return false; }
      let ok = 0, failed = 0;
      for (const u of users) { try { const r = await fn(u, v); if (r && r.user) replaceUser(r.user); ok++; } catch { failed++; } }
      toast(`Done: ${ok}` + (failed ? ` · failed: ${failed}` : ''), failed ? 'error' : 'success');
      picked.clear(); drawBulk(); load();
    } }, { text: 'Cancel' }],
  });
}

function row(u) {
  const self = u.id === me.id;
  const st = u.presence?.status || 'offline';
  const tick = self ? el('span', { class: 'bulk-tick' }) : el('input', { type: 'checkbox', class: 'bulk-tick', checked: picked.has(u.id), 'aria-label': 'Select', onchange: (e) => { if (e.target.checked) picked.set(u.id, u); else picked.delete(u.id); drawBulk(); } });
  return el('div', { class: 'admin-row' + (u.banned ? ' banned' : '') }, tick,
    el('a', { class: 'admin-head', href: `/profile?id=${u.id}` }, lazyHead(u), st !== 'offline' ? el('span', { class: 'presence-dot ' + st }) : null),
    el('div', { class: 'admin-info' },
      el('div', {}, el('a', { href: `/profile?id=${u.id}` }, el('b', { class: 'no-i18n', text: u.username })), nameBadges(u), ...pills(u)),
      el('div', { class: 'small muted', text: `R$ ${fmtFull(u.robits)} · ${u.items} items · ${u.games} games · joined ${timeAgo(u.created)}` }),
      st !== 'offline' ? el('div', { class: 'small online-text', text: presenceText(u.presence) }) : null),
    el('div', { class: 'admin-actions' },
      el('button', { class: 'btn btn-small btn-primary', text: 'Manage', onclick: () => manage(u) }),
      self || !perm('moderator') ? null : el('button', { class: 'btn btn-small' + (u.banned ? '' : ' btn-red'), text: u.banned ? 'Unban' : 'Ban', onclick: () => ban(u) })));
}

// ---------------------------------------------------------------- the player drawer
// Everything about one account in a panel from the right, in tabs:
// overview, inventory, economy, moderation, notes and history.
let drawerEl = null;
function closeDrawer() {
  if (!drawerEl) return;
  drawerEl.classList.remove('open');
  const d = drawerEl;
  drawerEl = null;
  setTimeout(() => d.remove(), 200);
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawerEl && !document.querySelector('.modal-backdrop')) closeDrawer(); });

async function manage(u0, tab = 'overview') {
  closeDrawer();
  const panel = el('div', { class: 'adm-drawer-panel' }, spinner());
  const back = el('div', { class: 'adm-drawer' }, el('div', { class: 'adm-drawer-shade', onclick: closeDrawer }), panel);
  document.body.append(back);
  drawerEl = back;
  requestAnimationFrame(() => back.classList.add('open'));
  let info;
  try { info = await api.get(`/admin/users/${u0.id}`); } catch (e) { panel.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const u = info.user;
  const self = u.id === me.id;
  const lockedAdmin = u.isAdmin && !me.isAdmin;
  const canMod = perm('moderator') && !self && !lockedAdmin;
  const reopen = (t = tab) => { if (drawerEl === back) manage(u, t); };
  // runs an action, then shows the player again on the same tab
  const doAct = async (path, b, msg, t) => { await act(path, b, msg); reopen(t); };
  const go = (fn) => () => fn(u);
  const fact = (k, v, cls = '') => el('div', { class: 'fact ' + cls }, el('span', { class: 'muted', text: k }), el('b', { text: String(v) }));
  const ingame = u.presence?.status === 'ingame';

  const tabsBar = el('div', { class: 'adm-dtabs' });
  const content = el('div', { class: 'adm-dbody' });
  const TABS2 = {
    overview: ['Overview', () => overview()],
    tools: ['Player Tools', () => tools(), perm('moderator') && !lockedAdmin],
    inventory: ['Inventory', () => inventory()],
    economy: ['Economy', () => economy(), perm('economy')],
    moderation: ['Moderation', () => moderation(), perm('moderator')],
    notes: ['Notes', () => notes()],
    history: ['History', () => history()],
  };
  const show = (t) => {
    tab = t;
    for (const b of tabsBar.children) b.classList.toggle('active', b.dataset.t === t);
    content.replaceChildren(spinner());
    Promise.resolve(TABS2[t][1]()).then((node) => content.replaceChildren(node)).catch((e) => content.replaceChildren(el('div', { class: 'empty', text: e.message })));
  };
  for (const [t, [label, , ok = true]] of Object.entries(TABS2)) {
    if (!ok) continue;
    const b = el('button', { text: label, onclick: () => show(t) });
    b.dataset.t = t;
    tabsBar.append(b);
  }

  const overview = () => el('div', {},
    el('div', { class: 'facts' },
      fact('Robits', 'R$ ' + fmtFull(u.robits), 'big'), fact('Items', u.items), fact('Games', u.games), fact('Friends', u.friends), fact('Trades', u.trades),
      fact('Warnings', u.warnings || 0, u.warnings ? 'warn' : ''), fact('Joined', new Date(u.created).toLocaleDateString()), fact('Devices', u.devices), fact('IPs', u.ips), fact('Logged in on', u.sessions)),
    u.previousNames.length ? el('div', { class: 'small muted', style: { margin: '8px 0' } }, 'Previously: ', el('span', { class: 'no-i18n', text: u.previousNames.join(', ') })) : null,
    me.isAdmin ? el('div', { class: 'manage-section' }, el('h4', { text: 'Badges' }), badgePicker(u, () => {})) : null,
    me.isAdmin ? el('div', { class: 'manage-section' }, el('h4', { text: 'Rights' }), el('div', { class: 'row wrap' },
      self ? null : el('button', { class: 'btn btn-small', text: u.isAdmin ? 'Remove admin' : 'Make admin', onclick: () => doAct(`/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }, u.isAdmin ? 'Admin removed' : `${u.username} is now an admin`) }),
      self || u.isAdmin ? null : el('button', { class: 'btn btn-small', text: 'Permissions', onclick: go(permsDialog) }))) : null,
    el('div', { class: 'manage-section' }, el('h4', { text: 'Alt accounts (same device or IP)' }), (() => {
      const box = el('div', { class: 'promo-chosen' }, el('span', { class: 'muted small', text: 'Loading...' }));
      api.get(`/admin/users/${u.id}/alts`).then(({ alts }) => box.replaceChildren(...(alts.length ? alts.map((a) => el('button', { class: 'holder-chip' + (a.banned ? ' banned-chip' : ''), onclick: () => manage(a) },
        el('span', { class: 'no-i18n', text: a.username }),
        el('span', { class: 'muted small', text: ' ' + [a.device ? 'device' : '', a.ip ? 'IP' : ''].filter(Boolean).join(' + ') + (a.banned ? ' · banned' : '') })))
        : [el('span', { class: 'muted small', text: 'None found.' })]))).catch(() => box.replaceChildren());
      return box;
    })()));

  // Classic player tools: one click each (Control Center 5.0)
  const tools = () => {
    const run = async (op, extra = {}, ask = '') => {
      if (ask && !confirm(tr(ask))) return;
      try { const r = await api.post(`/admin/users/${u.id}/tool`, { op, ...extra }); if (r.user) replaceUser(r.user); toast(r.message, 'success'); reopen('tools'); } catch (e) { toast(e.message, 'error'); }
    };
    const T = (label, op, opts = {}) => (opts.admin && !me.isAdmin) || (opts.notSelf && self) ? null
      : el('button', { class: 'cl-btn' + (opts.red ? ' red' : ''), text: label, onclick: () => (opts.fn ? opts.fn() : run(op, {}, opts.ask)) });
    const title = el('input', { class: 'input', maxlength: 30, placeholder: 'Title on the profile (empty = none)', value: u.title || '' });
    const subj = el('input', { class: 'input', maxlength: 80, placeholder: 'Subject' });
    const msg = el('textarea', { class: 'input', rows: 2, maxlength: 1000, placeholder: 'Message from the Robis team (goes to their inbox)' });
    const box = (name, ...kids) => el('fieldset', { class: 'cl-box' }, el('legend', { text: name }), el('div', { class: 'cl-grid' }, ...kids));
    return el('div', { class: 'cl-tools' },
      el('table', { class: 'cl-table' }, el('tbody', {},
        [['User ID', '#' + u.id], ['Username', u.username], ['Created', new Date(u.created).toLocaleString()], ['Last online', u.lastOnline ? timeAgo(u.lastOnline) : '-'],
          ['Robits', 'R$ ' + fmtFull(u.robits)], ['Membership', u.membership || 'None'], ['Status', u.banned ? 'Banned' : u.guest ? 'Guest' : u.bot ? 'Bot' : 'OK'], ['Username lock', u.nameLocked ? 'Locked' : 'No']]
          .map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { class: 'no-i18n', text: String(v) }))))),
      box('Account',
        T('Reset avatar', 'resetAvatar', { admin: true, ask: 'Put the starter look back on?' }),
        T('Give starter items', 'starterItems', { admin: true }),
        T('Wipe profile', 'wipeProfile', { ask: 'Clear their About text and status?' }),
        T(u.nameLocked ? 'Unlock username' : 'Lock username', 'lockName'),
        T('[ Content Deleted ]', 'contentDeleted', { red: true, notSelf: true, ask: 'Rename to ContentDeleted, wipe the profile and lock the name?' }),
        T('Copy their look', 'copyLook', { admin: true, notSelf: true })),
      el('div', { class: 'row', style: { margin: '4px 0 8px' } }, title, el('button', { class: 'cl-btn', text: 'Set title', onclick: () => run('setTitle', { title: title.value }) })),
      box('Social',
        T('Clear friends', 'clearFriends', { admin: true, ask: 'Remove all their friends?' }),
        T('Clear wishlist', 'clearWishlist', { admin: true }),
        T('Delete outfits', 'clearOutfits', { admin: true }),
        T('Delete sent messages', 'clearMessages', { red: true, ask: 'Delete every message they sent?' })),
      box('Moderation',
        T('Clear warnings', 'clearWarnings', { ask: 'Clear all their warnings?' }),
        T('Cancel open trades', 'cancelTrades'),
        u.presence?.status === 'ingame' ? T('Kick from game', 'kickFromGame', { notSelf: true }) : null,
        T('Reset game badges', 'resetBadges', { admin: true, ask: 'Remove every game badge they earned?' })),
      box('Economy & content',
        T('Reset daily stipend', 'resetStipend', { admin: true }),
        T('Make games private', 'unpublishGames', { admin: true, ask: 'Make all their games private?' }),
        T('Delete uploaded items', 'deleteItems', { admin: true, red: true, ask: 'Delete every item they uploaded?' })),
      el('fieldset', { class: 'cl-box' }, el('legend', { text: 'System message' }), subj, msg,
        el('button', { class: 'cl-btn', style: { marginTop: '6px' }, text: 'Send', onclick: () => run('systemMessage', { subject: subj.value, body: msg.value }) })));
  };

  const inventory = async () => {
    const { items } = await api.get(`/users/${u.id}/inventory`);
    const q = el('input', { class: 'input', placeholder: 'Filter this inventory' });
    const grid = el('div', { class: 'adm-inv' });
    const draw = () => {
      const f = q.value.trim().toLowerCase();
      const list = items.filter((it) => !f || it.name.toLowerCase().includes(f));
      grid.replaceChildren(...(list.length ? list.map((it) => el('div', { class: 'adm-inv-item' },
        itemCard(it),
        perm('economy') ? el('button', { class: 'btn btn-small btn-red adm-take', text: 'Take', onclick: async () => {
          if (!confirm(`Take ${it.name} from ${u.username}?`)) return;
          await doAct(`/admin/users/${u.id}/items/remove`, { itemId: it.id }, `${it.name} taken`, 'inventory');
        } }) : null)) : [el('div', { class: 'empty', text: items.length ? 'Nothing matches.' : 'This player has no items.' })]));
    };
    q.addEventListener('input', draw);
    draw();
    return el('div', {},
      perm('economy') ? el('div', { class: 'adm-inv-actions' },
        el('button', { class: 'btn btn-green', onclick: () => itemPicker({ title: `Give items to ${u.username}`, owned: items.map((i) => i.id), onPick: async (picked) => {
          const r = await api.post(`/admin/users/${u.id}/give`, { itemIds: picked.map((i) => i.id) });
          toast(r.given.length ? `Given: ${r.given.join(', ')}` : 'They already have these items', 'success');
          replaceUser(r.user);
          reopen('inventory');
        } }) }, '+ Give items'),
        el('button', { class: 'btn', text: 'Give every item', onclick: () => { if (confirm(`Give ${u.username} every item for sale?`)) doAct(`/admin/users/${u.id}/items`, { all: true }, `${u.username} now owns every item`, 'inventory'); } }),
        items.length ? el('button', { class: 'btn btn-red', text: 'Take all', onclick: () => { if (confirm(`Take ALL items from ${u.username}?`)) doAct(`/admin/users/${u.id}/items/remove`, { all: true }, 'All items taken', 'inventory'); } }) : null) : null,
      el('div', { class: 'row', style: { margin: '10px 0' } }, q, el('span', { class: 'muted small', text: `${items.length} items` })),
      grid);
  };

  const economy = () => {
    const amount = el('input', { class: 'input', type: 'number', value: 1000, step: 100 });
    const exact = el('input', { class: 'input', type: 'number', min: 0, value: u.robits });
    const tier = el('select', { class: 'input' }, data.memberships.map((t) => el('option', { value: t.id, text: t.name, selected: (u.membership || 'None') === t.id })));
    const days = el('input', { class: 'input', type: 'number', min: 0, max: 3650, value: 0, style: { width: '110px' } });
    return el('div', {},
      el('div', { class: 'adm-robits' }, el('span', { class: 'muted', text: 'Balance' }), el('b', { text: 'R$ ' + fmtFull(u.robits) })),
      el('div', { class: 'manage-section' }, el('h4', { text: 'Give or take Robits' }),
        el('div', { class: 'row wrap' }, [100, 1000, 10000, 100000].map((n) => el('button', { class: 'btn btn-small', text: `+${fmtNum(n)}`, onclick: () => { amount.value = n; } })),
          el('button', { class: 'btn btn-small', text: '-1,000', onclick: () => { amount.value = -1000; } })),
        el('div', { class: 'row', style: { marginTop: '8px' } }, amount,
          el('button', { class: 'btn btn-green', text: 'Apply', onclick: () => doAct(`/admin/users/${u.id}/robits`, { amount: +amount.value }, 'Robits updated', 'economy') }))),
      me.isAdmin ? el('div', { class: 'manage-section' }, el('h4', { text: 'Level' }), (() => {
        const xp = el('input', { class: 'input', type: 'number', value: 100, step: 50, style: { width: '120px' } });
        return el('div', { class: 'row wrap' }, el('span', { class: 'lvl-badge', text: String(u.level || 1) }), el('span', { class: 'small muted no-i18n', text: `${fmtFull(u.xp || 0)} XP` }), xp,
          el('button', { class: 'btn btn-primary', text: 'Give XP', onclick: async () => { try { const r = await api.post(`/admin/users/${u.id}/xp`, { amount: +xp.value }); toast(`Level ${r.level} · ${fmtFull(r.xp)} XP`, 'success'); reopen('economy'); } catch (e) { toast(e.message, 'error'); } } }));
      })()) : null,
      el('div', { class: 'manage-section' }, el('h4', { text: 'Set the balance to exactly' }),
        el('div', { class: 'row' }, exact, el('button', { class: 'btn btn-primary', text: 'Set', onclick: () => doAct(`/admin/users/${u.id}/robitsset`, { value: +exact.value }, 'Balance set', 'economy') }))),
      el('div', { class: 'manage-section' }, el('h4', { text: 'Builders Club' }),
        el('div', { class: 'row wrap' }, tier, el('span', { text: 'for' }), days, el('span', { class: 'muted small', text: 'days (0 = forever)' }),
          el('button', { class: 'btn btn-primary', text: 'Apply', onclick: () => doAct(`/admin/users/${u.id}/membership`, { tier: tier.value, days: +days.value }, 'Membership updated', 'economy') }))));
  };

  const moderation = () => {
    const reason = el('input', { class: 'input', maxlength: 300, placeholder: 'What is the warning for?' });
    const quick = ['Bad words in chat', 'Being mean to other players', 'Spamming', 'Scamming in trades', 'Exploiting a bug'];
    const upBan = segBtns([['', 'No'], ['7d', '7 days'], ['30d', '30 days'], ['forever', 'Forever']], '');
    return el('div', {},
      canMod ? el('div', { class: 'manage-section' }, el('h4', { text: 'Warn' }),
        el('p', { class: 'small muted', text: 'The player sees a popup (on the site or in their game) and gets a message.' }),
        el('div', { class: 'promo-chosen', style: { marginBottom: '6px' } }, quick.map((t) => el('button', { class: 'holder-chip', text: t, onclick: () => { reason.value = t; } }))),
        el('div', { class: 'row' }, reason, el('button', { class: 'btn btn-orange', text: 'Warn', onclick: async () => {
          if (!reason.value.trim()) return toast('Write what the warning is for.', 'error');
          await doAct(`/admin/users/${u.id}/warn`, { reason: reason.value, uploadBan: upBan.value }, upBan.value ? `${u.username} was warned and can't upload items` : `${u.username} was warned`, 'moderation');
        } })),
        el('div', { class: 'small muted', style: { margin: '8px 0 4px' }, text: 'Also block item uploads (Create):' }), upBan,
        u.restrictions && u.restrictions.upload ? el('div', { class: 'small', style: { marginTop: '6px' } }, '🚫 ', el('span', { text: 'Uploads blocked until' }), ' ' + new Date(u.restrictions.upload).toLocaleString(),
          ' ', el('button', { class: 'btn btn-small', text: 'Unblock uploads', onclick: () => doAct(`/admin/users/${u.id}/restrict`, { clear: true }, 'Restrictions lifted', 'moderation') })) : null) : null,
      el('div', { class: 'manage-section' }, el('h4', { text: 'Account' }), el('div', { class: 'row wrap' },
        canMod ? el('button', { class: 'btn btn-small' + (u.banned ? '' : ' btn-red'), text: u.banned ? 'Unban' : 'Ban', onclick: () => ban(u) }) : null,
        canMod && !u.banned ? el('button', { class: 'btn btn-small', text: 'Mute / No trades', onclick: () => restrictDialog(u) }) : null,
        canMod && ingame ? el('button', { class: 'btn btn-small', text: 'Kick from game', onclick: go(kick) }) : null,
        canMod ? el('button', { class: 'btn btn-small', text: 'Reset password', onclick: go(resetPassword) }) : null,
        perm('moderator') && !lockedAdmin ? el('button', { class: 'btn btn-small', text: 'Change username', onclick: go(rename) }) : null,
        canMod ? el('button', { class: 'btn btn-small', text: 'Log out everywhere', onclick: () => doAct(`/admin/users/${u.id}/logout`, {}, `${u.username} was logged out`, 'moderation') }) : null,
        canMod ? el('button', { class: 'btn btn-small btn-red', text: 'Delete account', onclick: go(deleteAccount) }) : null)),
      u.banned && u.banReason ? el('div', { class: 'adm-banbox' }, el('b', { text: 'Ban reason: ' }), el('span', { class: 'no-i18n', text: u.banReason })) : null);
  };

  const notes = async () => {
    const r = await api.get(`/admin/users/${u.id}/notes`);
    const text = el('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: 'A note only the staff can see (e.g. "warned about trading scams")' });
    const list = (arr) => el('div', { class: 'adm-notes' }, arr.length ? arr.map((n) => el('div', { class: 'adm-note' },
      el('div', { class: 'small muted' }, el('b', { class: 'no-i18n', text: n.byName }), ' · ' + timeAgo(n.time)),
      el('div', { class: 'no-i18n', text: n.text }),
      n.by === me.id || me.isAdmin ? el('button', { class: 'adm-note-x', text: '×', title: 'Delete', onclick: async () => { await api.post(`/admin/users/${u.id}/notes`, { remove: n.id }); show('notes'); } }) : null))
      : [el('div', { class: 'muted small', text: 'No notes yet.' })]);
    return el('div', {},
      el('div', { class: 'row' }, text, el('button', { class: 'btn btn-primary', text: 'Add note', onclick: async () => {
        try { await api.post(`/admin/users/${u.id}/notes`, { text: text.value }); show('notes'); } catch (e) { toast(e.message, 'error'); }
      } })),
      el('h4', { text: 'Staff notes' }), list(r.notes),
      el('h4', { text: `Warnings (${r.warnings.length})` }),
      r.warnings.length ? el('div', { class: 'adm-notes' }, r.warnings.map((w) => el('div', { class: 'adm-note warn' }, el('div', { class: 'small muted' }, el('b', { class: 'no-i18n', text: w.byName }), ' · ' + timeAgo(w.time)), el('div', { class: 'no-i18n', text: w.reason }))))
        : el('div', { class: 'muted small', text: 'No warnings.' }));
  };

  const history = () => el('div', { class: 'manage-cols' },
    el('div', {}, el('h4', { text: 'Transactions' }),
      info.transactions.length ? el('div', { class: 'mini-list tall' }, info.transactions.map((t) => el('div', { class: 'mini-row' },
        el('span', { class: 'mini-amount ' + (t.amount > 0 ? 'plus' : t.amount < 0 ? 'minus' : ''), text: t.amount ? (t.amount > 0 ? '+' : '') + fmtFull(t.amount) : '·' }),
        el('span', { class: 'mini-text', text: t.desc }), el('span', { class: 'muted small', text: timeAgo(t.time) }))))
        : el('div', { class: 'muted small', text: 'Nothing yet.' })),
    el('div', {}, el('h4', { text: 'Admin actions' }),
      info.log.length ? el('div', { class: 'mini-list tall' }, info.log.map((e) => el('div', { class: 'mini-row' },
        el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: e.byName }), ' · ', el('span', { text: e.action })), el('span', { class: 'muted small', text: timeAgo(e.time) }))))
        : el('div', { class: 'muted small', text: 'Nothing yet.' })));

  panel.replaceChildren(
    el('div', { class: 'adm-dhead' },
      el('button', { class: 'adm-dclose', text: '×', title: 'Close (Esc)', onclick: closeDrawer }),
      el('a', { class: 'admin-head big', href: `/profile?id=${u.id}` }, headshotImg(u, 150), u.presence && u.presence.status !== 'offline' ? el('span', { class: 'presence-dot ' + u.presence.status }) : null),
      el('div', { class: 'adm-dname' },
        el('div', {}, el('b', { class: 'no-i18n', text: u.username }), nameBadges(u)),
        el('div', {}, ...pills(u), u.warnings ? el('span', { class: 'pill warn-pill', text: `${u.warnings} warning${u.warnings === 1 ? '' : 's'}` }) : null),
        el('div', { class: 'small muted', text: `#${u.id} · ${presenceText(u.presence)}` }),
        el('div', { class: 'row wrap', style: { gap: '6px', marginTop: '6px' } },
          ingame ? el('button', { class: 'btn btn-small btn-green', text: 'Join their server', onclick: async () => {
            try { const w = await api.get(`/admin/users/${u.id}/where`); location.href = `/play?placeId=${w.gameId}${w.place ? '&place=' + w.place : ''}&serverId=${encodeURIComponent(w.serverId)}`; } catch (e) { toast(e.message, 'error'); }
          } }) : null,
          el('a', { class: 'btn btn-small', href: `/messages?to=${encodeURIComponent(u.username)}`, text: 'Message' }),
          el('a', { class: 'btn btn-small', href: `/profile?id=${u.id}`, text: 'Profile' })))),
    tabsBar, content);
  show(TABS2[tab] ? tab : 'overview');
}

// Sets a new password and logs the player out everywhere.
function resetPassword(u) {
  const input = el('input', { class: 'input', type: 'text', placeholder: 'Leave empty for a random password', autocomplete: 'off' });
  const result = el('div');
  modal({
    title: `Reset password for ${u.username}`,
    body: el('div', {},
      el('p', { class: 'small muted', text: 'The player is logged out everywhere. Give them the new password; they can change it later in Settings.' }),
      el('label', { class: 'field' }, 'New password', input), result),
    buttons: [{ text: 'Reset password', cls: 'btn-primary', onClick: async () => {
      const r = await act(`/admin/users/${u.id}/password`, { password: input.value }, 'Password reset');
      if (!r) return false;
      const pw = el('code', { class: 'new-password', text: r.password });
      result.replaceChildren(el('div', { class: 'pw-box' },
        el('div', { class: 'small muted', text: 'New password:' }), pw,
        el('button', { class: 'btn btn-small', text: 'Copy', onclick: () => navigator.clipboard?.writeText(r.password).then(() => toast('Copied', 'success')).catch(() => {}) })));
      return false; // keep the dialog open so the password can be copied
    } }, { text: 'Close' }],
  });
}

function rename(u) {
  const input = el('input', { class: 'input', value: u.username, maxlength: 20 });
  modal({
    title: `Change username of ${u.username}`,
    body: el('div', {}, el('p', { class: 'small muted', text: 'Free for staff. The old name is shown on the profile.' }), input),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: async () => (await act(`/admin/users/${u.id}/rename`, { username: input.value.trim() }, 'Username changed')) ? undefined : false }, { text: 'Cancel' }],
  });
}

function kick(u) {
  const reason = el('input', { class: 'input', placeholder: 'Reason (optional)' });
  modal({
    title: `Kick ${u.username}?`,
    body: el('div', {}, el('p', { text: 'They are removed from the game they are playing.' }), reason),
    buttons: [{ text: 'Kick', cls: 'btn-red', onClick: () => act(`/admin/users/${u.id}/kick`, { reason: reason.value }, `${u.username} was kicked`) }, { text: 'Cancel' }],
  });
}

// Removes the account only: the device and IP are NOT banned, so the person can make a new account.
function deleteAccount(u) {
  modal({
    title: `Delete ${u.username}?`,
    body: el('div', {},
      el('p', { text: 'The account, its games, friends, messages and trades are deleted for good. This can\'t be undone.' }),
      el('p', { class: 'small muted', text: 'This is not a device ban: the person can sign up again with a new account. To stop that, use Ban → Account + device and IP instead.' })),
    buttons: [{ text: 'Delete account', cls: 'btn-red', onClick: async () => {
      try {
        await api.post(`/admin/users/${u.id}/delete`);
        toast(`${u.username} was deleted`, 'success');
        data.users = data.users.filter((x) => x.id !== u.id);
        drawList();
      } catch (e) { toast(e.message, 'error'); }
    } }, { text: 'Cancel' }],
  });
}

// ---------------------------------------------------------------- badges
// Admins decide who gets the checks, the Robis icon, the crown and the rest
// (FLAGS in server/api.js, pictures in public/js/badges.js).
async function setBadge(u, flag, on) {
  const r = await act(`/admin/users/${u.id}/flags`, { flag, on }, `${BADGE_TITLE[flag]} ${on ? 'given to' : 'taken from'} ${u.username}`);
  return r && r.user;
}

// A row of every badge; click one to give or take it.
function badgePicker(u, onChange) {
  const wrap = el('div', { class: 'badge-picker' });
  const draw = () => wrap.replaceChildren(...data.flags.map((f) => {
    const on = (u.flags || []).includes(f.id);
    return el('button', {
      class: 'badge-toggle' + (on ? ' on' : ''), title: f.label,
      onclick: async () => { const nu = await setBadge(u, f.id, !on); if (nu) { u.flags = nu.flags; draw(); onChange?.(nu); } },
    }, el('span', { class: 'badge-icon', html: BADGE_SVG[f.id] || '' }), el('span', { text: BADGE_TITLE[f.id] || f.id }));
  }));
  draw();
  return wrap;
}

function drawBadges() {
  const names = el('datalist', { id: 'admin-usernames' }, data.users.map((u) => el('option', { value: u.username })));
  const who = el('input', { class: 'input', placeholder: 'Player name', list: 'admin-usernames', autocomplete: 'off' });
  let chosen = data.flags[0]?.id;
  const choice = el('div', { class: 'badge-picker' });
  const drawChoice = () => choice.replaceChildren(...data.flags.map((f) => el('button', {
    class: 'badge-toggle' + (f.id === chosen ? ' on' : ''), title: f.label, onclick: () => { chosen = f.id; drawChoice(); },
  }, el('span', { class: 'badge-icon', html: BADGE_SVG[f.id] || '' }), el('span', { text: BADGE_TITLE[f.id] || f.id }))));
  drawChoice();
  const give = async () => {
    const u = data.users.find((x) => x.username.toLowerCase() === who.value.trim().toLowerCase());
    if (!u) { toast('No player with that name.', 'error'); return; }
    if ((u.flags || []).includes(chosen)) { toast(`${u.username} already has this badge.`, 'error'); return; }
    if (await setBadge(u, chosen, true)) { who.value = ''; drawBadges(); }
  };
  who.addEventListener('keydown', (e) => { if (e.key === 'Enter') give(); });
  const cards = data.flags.map((f) => {
    const holders = data.users.filter((u) => (u.flags || []).includes(f.id));
    return el('div', { class: 'badge-card' },
      el('div', { class: 'badge-card-head' },
        el('span', { class: 'badge-big', html: BADGE_SVG[f.id] || '' }),
        el('div', {}, el('b', { text: BADGE_TITLE[f.id] || f.id })),
        el('span', { class: 'badge-count', text: String(holders.length) })),
      holders.length ? el('div', { class: 'badge-holders' }, holders.map((u) => el('span', { class: 'holder-chip' },
        headshotImg(u, 48),
        el('a', { class: 'no-i18n', href: `/profile?id=${u.id}`, text: u.username }),
        el('button', { title: 'Take away', text: '×', onclick: async () => { if (await setBadge(u, f.id, false)) drawBadges(); } }))))
        : el('div', { class: 'small muted', text: 'Nobody has it yet.' }));
  });
  body.replaceChildren(
    el('div', { class: 'badge-give' },
      el('h3', { text: 'Give a badge' }),
      el('p', { class: 'small muted', text: 'Badges show next to the name everywhere: profile, games, chat and the player list. Pick a badge, type a name and press Give.' }),
      choice,
      el('div', { class: 'row wrap', style: { marginTop: '10px' } }, who, names, el('button', { class: 'btn btn-primary', text: 'Give', onclick: give }))),
    el('div', { class: 'badge-cards' }, cards));
}

// ---------------------------------------------------------------- promo codes
// Generator: Robits and/or items, how many codes, uses per code, expiry, or one custom code.
const promo = { robits: 100, items: [], count: 1, uses: 1, days: 0, code: '', note: '', membership: 'None', memberDays: 30, made: [] };
async function drawPromo() {
  const num = (key, attrs) => {
    const i = el('input', { class: 'input', type: 'number', value: promo[key], ...attrs });
    i.addEventListener('input', () => { promo[key] = +i.value || 0; });
    return i;
  };
  const txt = (key, attrs) => {
    const i = el('input', { class: 'input', value: promo[key], ...attrs });
    i.addEventListener('input', () => { promo[key] = i.value; if (key === 'code') countField.classList.toggle('hidden', !!i.value.trim()); });
    return i;
  };
  // items: search the catalog, click to add
  const chosen = el('div', { class: 'promo-chosen' });
  const drawChosen = () => chosen.replaceChildren(...promo.items.map((it) => el('span', { class: 'holder-chip' },
    el('span', { text: it.name }), el('button', { title: 'Remove', text: '×', onclick: () => { promo.items = promo.items.filter((x) => x.id !== it.id); drawChosen(); } }))));
  drawChosen();
  const found = el('div', { class: 'promo-found' });
  const q = el('input', { class: 'input', placeholder: 'Search items to add (name)' });
  let t = null;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const text = q.value.trim();
      if (!text) { found.replaceChildren(); return; }
      const { items } = await api.get(`/catalog?q=${encodeURIComponent(text)}`);
      found.replaceChildren(...items.slice(0, 8).map((it) => el('button', { class: 'btn btn-small', text: `+ ${it.name}`, onclick: () => {
        if (promo.items.length >= 10) { toast('Up to 10 items per code.', 'error'); return; }
        if (!promo.items.some((x) => x.id === it.id)) promo.items.push({ id: it.id, name: it.name });
        drawChosen();
      } })));
    }, 250);
  });
  const countField = el('label', { class: 'field' }, 'How many codes', num('count', { min: 1, max: 200 }));
  const tierSel = el('select', { class: 'input' }, data.memberships.map((m) => el('option', { value: m.id, text: m.id === 'None' ? 'No membership' : m.name, selected: m.id === promo.membership })));
  const daysField = el('label', { class: 'field' }, 'Membership days (0 = forever)', num('memberDays', { min: 0, max: 3650 }));
  daysField.classList.toggle('hidden', promo.membership === 'None');
  tierSel.onchange = () => { promo.membership = tierSel.value; daysField.classList.toggle('hidden', promo.membership === 'None'); };
  countField.classList.toggle('hidden', !!promo.code.trim());
  const madeBox = el('div');
  const drawMade = () => {
    if (!promo.made.length) { madeBox.replaceChildren(); return; }
    const all = promo.made.map((c) => c.code).join('\n');
    madeBox.replaceChildren(el('div', { class: 'promo-made' },
      el('div', { class: 'row' }, el('b', { text: `New codes (${promo.made.length})` }), el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn-small', text: 'Copy all', onclick: () => navigator.clipboard?.writeText(all).then(() => toast('Copied', 'success')).catch(() => {}) })),
      el('pre', { class: 'promo-codes no-i18n', text: all })));
  };
  drawMade();
  const make = async () => {
    try {
      const r = await api.post('/admin/promocodes', { membership: promo.membership, membershipDays: promo.memberDays, robits: promo.robits, items: promo.items.map((i) => i.id), count: promo.count, maxUses: promo.uses, days: promo.days, code: promo.code.trim(), note: promo.note });
      promo.made = r.codes;
      promo.code = '';
      toast(r.codes.length === 1 ? 'Code made' : `${r.codes.length} codes made`, 'success');
      drawPromo();
    } catch (e) { toast(e.message, 'error'); }
  };
  const listBox = el('div', {}, spinner());
  // Donate prices: what "Buy" on the Robits page shows; buying happens in Telegram.
  const donateBox = el('div', { class: 'donate-admin' });
  const drawDonate = async () => {
    const { donate } = await api.get('/economy/store');
    const tg = el('input', { class: 'input', value: '@' + donate.telegram });
    const rows = [
      ...donate.packs.map((p) => ['r' + p.robits, `R$ ${fmtFull(p.robits)}`, p.price]),
      ...donate.memberships.map((m) => [m.id, data.memberships.find((x) => x.id === m.id)?.name || m.id, m.price]),
      ...donate.giftcards.map((g) => [g.key, `Gift card: ${g.name}`, g.price]),
    ].map(([key, label, price]) => {
      const i = el('input', { class: 'input', value: price, placeholder: 'e.g. 99 ₽', maxlength: 30 });
      i.dataset.key = key;
      return el('label', { class: 'field' }, label, i);
    });
    donateBox.replaceChildren(
      el('h3', { style: { marginTop: '24px' }, text: 'Donate prices' }),
      el('p', { class: 'small muted', text: 'Shown on the Robits page. "Buy" opens this Telegram account with a ready message; you give the Robits or the membership by hand (or with a promo code).' }),
      el('label', { class: 'field', style: { maxWidth: '260px' } }, 'Telegram', tg),
      el('div', { class: 'promo-form' }, rows),
      el('button', { class: 'btn btn-primary', text: 'Save prices', onclick: async () => {
        const prices = {};
        for (const r of rows) { const i = r.querySelector('input'); prices[i.dataset.key] = i.value; }
        try { await api.post('/admin/donate', { prices, telegram: tg.value }); toast('Prices saved', 'success'); } catch (e) { toast(e.message, 'error'); }
      } }));
  };
  body.replaceChildren(
    el('div', { class: 'badge-give' },
      el('h3', { text: 'Make promo codes' }),
      el('p', { class: 'small muted', text: 'Players type codes on the Promo Codes page. Each player can use a code once. A Builders Club code gives the plan for the set days, then the player goes back to their old plan.' }),
      el('div', { class: 'promo-form' },
        el('label', { class: 'field' }, 'Robits', num('robits', { min: 0, max: 1000000 })),
        el('label', { class: 'field' }, 'Builders Club', tierSel),
        daysField,
        countField,
        el('label', { class: 'field' }, 'Uses per code (0 = no limit)', num('uses', { min: 0 })),
        el('label', { class: 'field' }, 'Expires in days (0 = never)', num('days', { min: 0, max: 3650 })),
        el('label', { class: 'field' }, 'Custom code (optional)', txt('code', { placeholder: 'e.g. ROBIS2019', maxlength: 30 })),
        el('label', { class: 'field' }, 'Note (only staff see it)', txt('note', { placeholder: 'e.g. YouTube giveaway', maxlength: 100 }))),
      el('div', { class: 'promo-items-field' }, el('b', { text: 'Items' }), q), found, chosen,
      el('button', { class: 'btn btn-green', style: { marginTop: '10px' }, text: 'Generate', onclick: make }),
      madeBox),
    el('h3', { text: 'All codes' }), listBox, donateBox);
  drawDonate();
  let codes = [];
  try { ({ codes } = await api.get('/admin/promocodes')); } catch (e) { listBox.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const edit = async (c, op) => {
    if (op === 'delete' && !confirm(`Delete code ${c.code}?`)) return;
    try { await api.post('/admin/promocodes/edit', { code: c.code, op }); drawPromo(); } catch (e) { toast(e.message, 'error'); }
  };
  const STATE_CLASS = { active: 'on', off: 'off', expired: 'off', 'used up': 'off' };
  listBox.replaceChildren(codes.length ? el('table', { class: 'list promo-table' },
    el('tr', {}, ['Code', 'Gives', 'Used', 'Expires', 'Status', ''].map((h) => el('th', { text: h }))),
    codes.map((c) => el('tr', {},
      el('td', {}, el('code', { class: 'no-i18n', text: c.code }), c.note ? el('div', { class: 'small muted', text: c.note }) : null),
      el('td', { class: 'small', text: [c.robits ? `R$ ${fmtFull(c.robits)}` : '', c.membershipName ? `${c.membershipName} (${c.memberDays ? c.memberDays + ' d' : '∞'})` : '', ...c.items.map((i) => i.name)].filter(Boolean).join(' + ') }),
      el('td', { class: 'small', title: c.lastUsers.join(', '), text: `${c.uses}${c.maxUses ? ' / ' + c.maxUses : ''}` }),
      el('td', { class: 'small', text: c.expires ? new Date(c.expires).toLocaleDateString() : 'Never' }),
      el('td', {}, el('span', { class: 'pill promo-state ' + STATE_CLASS[c.state], text: c.state })),
      el('td', { class: 'promo-actions' },
        el('button', { class: 'btn btn-small', text: 'Copy', onclick: () => navigator.clipboard?.writeText(c.code).then(() => toast('Copied', 'success')).catch(() => {}) }),
        c.state === 'off' ? el('button', { class: 'btn btn-small', text: 'Turn on', onclick: () => edit(c, 'on') }) : c.state === 'active' ? el('button', { class: 'btn btn-small', text: 'Turn off', onclick: () => edit(c, 'off') }) : null,
        el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: () => edit(c, 'delete') })))))
    : el('div', { class: 'empty', text: 'No codes yet.' }));
}

// ---------------------------------------------------------------- The Hunt
// The event manager: what's live, launch a prepared event, open it for
// everyone, end it, schedule the end and the next start; then the settings of
// the live event and finds for a single player.
const toLocalInput = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : '');
const fromLocalInput = (v) => (v ? new Date(v).getTime() : 0);
const fmtWhen = (ms) => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const KIND_LABEL = { quests: 'Quests in every game', shards: 'Hidden items in every game' };

async function drawHunt() {
  body.replaceChildren(spinner());
  let h;
  try { h = await api.get('/admin/hunt'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const control = async (b, msg) => {
    try { await api.post('/admin/hunt/control', b); toast(msg, 'success'); drawHunt(); } catch (e) { toast(e.message, 'error'); }
  };
  const live = h.state === 'live';
  const quests = h.kind === 'quests';
  const unit = quests ? 'quests' : 'finds';

  // ---- now
  const endIn = el('input', { class: 'input', type: 'datetime-local', value: toLocalInput(h.endsAt), style: { width: 'auto' } });
  const nowCard = el('div', { class: 'hunt-admin-card now' + (live ? ' live' : '') },
    el('div', { class: 'row wrap', style: { gap: '10px', alignItems: 'center' } },
      el('span', { class: 'hunt-state ' + (live ? (h.public ? 'live' : 'preview') : 'ended'), text: live ? (h.public ? 'LIVE' : 'PRIVATE PREVIEW') : 'ENDED' }),
      el('h3', { class: 'no-i18n', style: { margin: 0 }, text: h.name }),
      el('span', { class: 'small muted', text: KIND_LABEL[h.kind] || '' })),
    el('div', { class: 'small muted', style: { margin: '6px 0 10px' } },
      live ? `Started ${h.startedAt ? fmtWhen(h.startedAt) : '-'} · ${h.finders} players took part · ${h.riftShards} ${unit} by everyone` : `Ended ${h.endedAt ? fmtWhen(h.endedAt) : ''}`,
      live ? (h.endsAt ? ` · ends ${fmtWhen(h.endsAt)}` : ' · no end time') : ''),
    live ? el('div', { class: 'row wrap', style: { gap: '8px' } },
      el('button', { class: 'btn ' + (h.public ? '' : 'btn-green'), text: h.public ? 'Make private (admins only)' : 'Open for everyone', onclick: async () => {
        try { await api.post('/admin/hunt', { public: !h.public }); toast(h.public ? 'Now only admins can see it' : 'The Hunt is open for everyone!', 'success'); drawHunt(); } catch (e) { toast(e.message, 'error'); }
      } }),
      el('button', { class: 'btn btn-red', text: 'End now', onclick: () => { if (confirm(`End ${h.name} now? Players keep their prizes, the hub closes.`)) control({ action: 'end' }, 'The event has ended'); } })) : null,
    live && !h.public ? testersBox(h) : null,
    live ? el('div', { class: 'row wrap', style: { gap: '8px', marginTop: '10px', alignItems: 'center' } },
      el('span', { text: 'End automatically at' }), endIn,
      el('button', { class: 'btn btn-small btn-primary', text: 'Set', onclick: () => { if (!endIn.value) return toast('Pick a date and time.', 'error'); control({ action: 'schedule', endsAt: fromLocalInput(endIn.value) }, 'End time saved'); } }),
      h.endsAt ? el('button', { class: 'btn btn-small', text: 'No end time', onclick: () => control({ action: 'schedule', endsAt: 0 }, 'End time removed') }) : null) : null);

  // ---- next (scheduled start)
  const nextSel = el('select', { class: 'input', style: { width: 'auto' } }, h.events.map((e) => el('option', { value: e.key, text: e.name, selected: h.next ? h.next.key === e.key : e.key !== h.current })));
  const nextAt = el('input', { class: 'input', type: 'datetime-local', value: toLocalInput(h.next?.startsAt || h.endsAt), style: { width: 'auto' } });
  const nextPub = el('input', { type: 'checkbox', checked: !!h.next?.public });
  const nextCard = el('div', { class: 'hunt-admin-card' },
    el('h4', { text: 'Next event' }),
    h.next ? el('div', { class: 'hunt-next-row' },
      el('b', { class: 'no-i18n', text: h.events.find((e) => e.key === h.next.key)?.name || h.next.key }),
      el('span', { text: ` starts ${fmtWhen(h.next.startsAt)}` }),
      el('span', { class: 'small muted', text: h.next.public ? ' · open for everyone' : ' · as a private preview (open it when you are ready)' }),
      el('button', { class: 'btn btn-small', style: { marginLeft: '8px' }, text: 'Cancel', onclick: () => control({ action: 'schedule', next: null }, 'Schedule cancelled') }))
      : el('div', { class: 'small muted', text: 'Nothing scheduled.' }),
    el('div', { class: 'row wrap', style: { gap: '8px', marginTop: '10px', alignItems: 'center' } },
      nextSel, el('span', { text: 'starts at' }), nextAt,
      el('label', { class: 'perm-row', style: { margin: 0 } }, nextPub, el('span', { text: 'Open for everyone' })),
      el('button', { class: 'btn btn-small btn-primary', text: 'Schedule', onclick: () => {
        if (!nextAt.value) return toast('Pick a date and time.', 'error');
        control({ action: 'schedule', next: { key: nextSel.value, startsAt: fromLocalInput(nextAt.value), public: nextPub.checked } }, 'Next event scheduled');
      } })),
    el('p', { class: 'small muted', text: 'When the next event starts, the live one ends by itself. A private preview is only for the main account and the testers: test it, then press Open for everyone.' }));

  // ---- prepared events
  const evCards = el('div', { class: 'hunt-events' }, h.events.map((e) => el('div', { class: 'hunt-admin-card event' + (e.key === h.current && live ? ' current' : '') },
    el('b', { class: 'no-i18n', text: e.name }),
    el('div', { class: 'small', text: `${KIND_LABEL[e.kind]} · ${e.prizes} prizes` }),
    el('p', { class: 'small muted', text: e.description }),
    e.custom ? el('div', { class: 'row wrap', style: { gap: '6px' } },
      el('span', { class: 'pill', text: e.ready ? '✨ Ready-made' : 'Your event' }),
      el('button', { class: 'btn btn-small', text: 'Edit', onclick: () => customEventEditor(h, e.key) }),
      e.key === h.current && live ? null : el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: async () => {
        if (!confirm(`Delete ${e.name}?`)) return;
        try { await api.post('/admin/hunt/custom', { key: e.key, delete: true }); toast('Deleted', 'success'); drawHunt(); } catch (err) { toast(err.message, 'error'); }
      } })) : null,
    e.key === h.current && live ? el('span', { class: 'hunt-state live', text: 'RUNNING' }) : el('div', { class: 'row wrap', style: { gap: '6px' } },
      el('button', { class: 'btn btn-small', text: '👁 Visit the lobby', title: 'Walk around the lobby before the event starts (only admins can get in)', onclick: async () => {
        try { const r = await api.post('/admin/hunt/lobby', { key: e.key }); const { launchGame } = await import('../ui.js'); launchGame(r.gameId); } catch (err) { toast(err.message, 'error'); }
      } }),
      el('button', { class: 'btn btn-small', text: 'Launch (private preview)', onclick: () => { if (confirm(`Launch ${e.name} as a private preview now?${live ? ` ${h.name} ends.` : ''}`)) control({ action: 'launch', key: e.key, public: false }, `${e.name} started (private)`); } }),
      el('button', { class: 'btn btn-small btn-green', text: 'Launch for everyone', onclick: () => { if (confirm(`Launch ${e.name} for everyone now?${live ? ` ${h.name} ends.` : ''}`)) control({ action: 'launch', key: e.key, public: true }, `${e.name} is live!`); } })))));

  evCards.prepend(el('button', { class: 'hunt-admin-card hunt-new-event quick', onclick: () => quickEvent(h) },
    el('b', { text: '⚡ Quick event' }),
    el('div', { class: 'small muted', text: 'Pick a map, give it a name - prizes, story and goals are made for you. Ready in 10 seconds.' })));
  evCards.append(el('button', { class: 'hunt-admin-card hunt-new-event', onclick: () => customEventEditor(h, null) },
    el('b', { text: '+ Make your own event' }),
    el('div', { class: 'small muted', text: 'Name, story, quests or hidden items, the hub, prizes and goals - all yours.' })));
  const past = h.past.length ? el('div', { class: 'small muted' }, h.past.slice().reverse().map((p) => el('div', { class: 'no-i18n', text: `${p.name} - ${p.players} players${p.ended ? ' - ended ' + fmtWhen(p.ended) : ''}` }))) : null;

  // ---- settings of the live event
  const auto = el('input', { class: 'input', type: 'number', min: 0, max: 20, value: h.autoPlayers, style: { width: '90px' } });
  const team = el('input', { class: 'input', type: 'number', min: 1, max: 100000, value: h.riftGoal, style: { width: '110px' } });
  const boxes = h.official.map((g) => {
    const cb = el('input', { type: 'checkbox', checked: h.games.includes(g.id) });
    cb.dataset.id = g.id;
    return el('label', { class: 'perm-row' }, cb, el('span', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: ` · ${fmtNum(g.visits || 0)} visits` }));
  });
  const save = async () => {
    try {
      await api.post('/admin/hunt', { autoPlayers: +auto.value, riftGoal: +team.value, games: boxes.map((b) => b.firstChild).filter((c) => c.checked).map((c) => +c.dataset.id) });
      toast('Saved', 'success');
      drawHunt();
    } catch (e) { toast(e.message, 'error'); }
  };
  const settings = live ? el('div', {},
    el('h3', { text: 'Settings of the live event' }),
    el('div', { class: 'row wrap', style: { gap: '12px', margin: '6px 0 12px' } },
      el('a', { class: 'btn', href: '/hunt', text: 'Open the event page' }),
      h.hubId ? el('a', { class: 'btn', href: `/game?id=${h.hubId}`, text: 'Hub game' }) : null),
    el('h4', { text: 'Official games' }), el('div', { class: 'hunt-admin-games' }, boxes),
    el('label', { class: 'row', style: { gap: '8px', margin: '12px 0' } }, el('span', { text: 'Most popular player games to add' }), auto),
    el('label', { class: 'row wrap', style: { gap: '8px', margin: '12px 0' } }, el('span', { text: quests ? 'Team goal (quests done by everyone together)' : 'Rift goal (shards found by everyone together)' }), team,
      el('span', { class: 'small muted', text: `now ${h.riftShards}${h.riftOpen ? ' · OPEN' : ''} · the most possible is players × games in the event` })),
    el('h4', { text: `In the event now (${h.event.length})` }),
    quests
      ? el('div', { class: 'hunt-admin-quests' }, h.event.map((g) => el('div', { class: 'hunt-admin-quest' }, el('b', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: g.byPlayer ? ' · ' + g.creator : ' · official' }),
        h.overrides[g.id] ? el('span', { class: 'pill', style: { marginLeft: '6px' }, text: 'changed' }) : null,
        el('div', { class: 'small', text: g.quest }),
        el('button', { class: 'btn btn-small', style: { marginTop: '4px' }, text: 'Edit quest', onclick: () => questEditor(h, g) }))))
      : el('div', { class: 'promo-chosen' }, h.event.map((g) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: g.byPlayer ? ' · ' + g.creator : ' · official' })))),
    el('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, text: 'Save', onclick: save }),
    huntPlayerBox(quests)) : null;

  body.replaceChildren(
    el('div', { class: 'badge-give' }, el('h3', { text: 'The Hunt' }), nowCard, nextCard),
    el('h3', { text: 'Prepared events' }), evCards,
    past ? el('div', { style: { margin: '10px 0 18px' } }, el('h4', { text: 'Past events' }), past) : null,
    settings);
}

// Who sees the private preview (only them, not every admin).
function testersBox(h) {
  const who = el('input', { class: 'input', placeholder: 'Player name', style: { width: '180px' } });
  const send = async (b, msg) => { try { await api.post('/admin/hunt/testers', b); toast(msg, 'success'); drawHunt(); } catch (e) { toast(e.message, 'error'); } };
  return el('div', { class: 'hunt-testers' },
    el('div', { class: 'small', text: 'The private preview is only visible to these players (they play on their own servers, so nobody else sees the quests):' }),
    el('div', { class: 'row wrap', style: { gap: '6px', margin: '6px 0' } },
      h.owner ? el('span', { class: 'holder-chip no-i18n', text: h.owner + ' (main account)' }) : null,
      h.testers.map((t) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: t.username }), el('button', { class: 'chip-x', text: '×', title: 'Remove', onclick: () => send({ remove: t.id }, 'Removed') }))),
      h.testers.some((t) => t.id === me.id) ? null : el('button', { class: 'btn btn-small btn-primary', text: 'Add me', onclick: () => send({ me: true }, 'Added') })),
    el('div', { class: 'row wrap', style: { gap: '6px' } }, who, el('button', { class: 'btn btn-small', text: 'Add tester', onclick: () => send({ add: who.value.trim() }, 'Added') })));
}

const QUEST_TYPE_LABEL = {
  default: 'The game\'s own quest (default)', runes: 'Find 3 runes in order (any game)', stat: 'Reach a leaderstat (e.g. 40 Coins)', gain: 'Get more of a leaderstat (e.g. 2 Wins)',
  below: 'A leaderstat at or below a number (e.g. Time 40)', badge: 'Earn a badge of the game', visit: 'Reach parts by name', click: 'Press every button in a model', script: 'The game\'s scripts call HuntService:CompleteQuest',
};
const QUEST_NAME_HINT = { stat: 'Leaderstat name (e.g. Coins)', gain: 'Leaderstat name (e.g. Wins)', below: 'Leaderstat name (e.g. Time)', badge: 'Badge name (e.g. Door 25)', visit: 'Part names, comma separated', click: 'Model name (e.g. Buttons)' };
// A game's quest in the live event.
function questEditor(h, g) {
  const cur = h.overrides[g.id] || {};
  const type = el('select', { class: 'input' }, h.questTypes.map((t) => el('option', { value: t, text: QUEST_TYPE_LABEL[t] || t, selected: t === (cur.type || 'default') })));
  const name = el('input', { class: 'input', value: cur.stat || cur.badge || cur.model || (cur.parts || []).join(', ') || '' });
  const target = el('input', { class: 'input', type: 'number', min: 1, value: cur.target || 1 });
  const text = el('input', { class: 'input', maxlength: 160, value: cur.text || '', placeholder: 'What the player has to do (shown everywhere)' });
  const nameRow = el('label', { class: 'field' }, el('span', {}), name);
  const targetRow = el('label', { class: 'field' }, 'Number', target);
  const sync = () => {
    const t = type.value;
    nameRow.style.display = QUEST_NAME_HINT[t] ? '' : 'none';
    nameRow.firstChild.textContent = QUEST_NAME_HINT[t] || '';
    targetRow.style.display = ['stat', 'gain', 'below'].includes(t) ? '' : 'none';
  };
  type.addEventListener('change', sync);
  sync();
  modal({
    title: `Quest: ${g.name}`,
    body: el('div', { class: 'quest-editor' },
      el('p', { class: 'small muted', text: `Now: ${g.quest}` }),
      el('label', { class: 'field' }, 'Kind of quest', type), nameRow, targetRow,
      el('label', { class: 'field' }, 'Quest text', text),
      el('p', { class: 'small muted', text: 'Players who are in the game now get the new quest the next time they join.' })),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: async () => {
      try {
        await api.post('/admin/hunt/quest', { gameId: g.id, quest: type.value === 'default' ? null : { type: type.value, name: name.value, target: +target.value, text: text.value } });
        toast('Quest saved', 'success');
        drawHunt();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

// Make or edit your own event: the story, the kind, the hub, the prizes.
function customEventEditor(h, key) {
  const c = key ? JSON.parse(JSON.stringify(h.custom[key])) : { name: '', description: '', kind: 'quests', hub: 'relics', robits: 25, teamGoal: 30, prizes: [{ name: '', type: 'Hat', data: { model: 'crown', color: '#ffc400', accent: '#ffffff' }, count: 1 }], teamPrize: null, hubPrize: null };
  const name = el('input', { class: 'input', maxlength: 60, value: c.name.replace(/^The Hunt: /, ''), placeholder: 'e.g. Pirate Treasure' });
  const desc = el('textarea', { class: 'input', rows: 3, maxlength: 500, value: c.description, placeholder: 'The story of the event (shown on the event page and the hub game)' });
  const kind = el('select', { class: 'input' }, [['quests', 'Quests in every game'], ['shards', 'Hidden items in every game (with a scanner)']].map(([v, t]) => el('option', { value: v, text: t, selected: c.kind === v })));
  const hub = el('select', { class: 'input' }, [['relics', 'Jungle temple (rune puzzle)'], ['dimension', 'Space station (star fragments)'], ['winter', 'Frost Festival (presents)'], ['spooky', 'Haunted Night (pumpkins)'], ['candy', 'Candy Kingdom (candies)'], ['ocean', 'Sunken City (pearls)']].map(([v, t]) => el('option', { value: v, text: t, selected: c.hub === v })));
  const robits = el('input', { class: 'input', type: 'number', min: 0, max: 1000, value: c.robits });
  const goal = el('input', { class: 'input', type: 'number', min: 1, max: 100000, value: c.teamGoal });
  const prizeRow = (p, ladder) => {
    const d = p.data || {};
    const type = el('select', { class: 'input' }, Object.keys(h.prizeModels).map((t) => el('option', { value: t, text: t === 'TShirt' ? 'T-Shirt' : t, selected: t === p.type })));
    const model = el('select', { class: 'input' });
    const fillModels = () => model.replaceChildren(...h.prizeModels[type.value].map((m) => el('option', { value: m, text: m, selected: m === d.model })));
    type.addEventListener('change', fillModels);
    fillModels();
    const pname = el('input', { class: 'input', maxlength: 50, value: p.name || '', placeholder: 'Prize name' });
    const color = el('input', { type: 'color', value: d.color || '#ffc400' });
    const accent = el('input', { type: 'color', value: d.accent || '#ffffff' });
    const mode = el('select', { class: 'input' }, [['count', 'after'], ['share', '% of all']].map(([v, t]) => el('option', { value: v, text: t, selected: v === (p.share ? 'share' : 'count') })));
    const need = el('input', { class: 'input', type: 'number', min: 1, value: p.share ? Math.round(p.share * 100) : p.count || 1, style: { width: '80px' } });
    const row = el('div', { class: 'prize-row' }, pname, type, model, color, accent,
      ladder ? mode : null, ladder ? need : null,
      ladder ? el('button', { class: 'btn btn-small btn-red', text: '×', title: 'Remove', onclick: () => row.remove() }) : null);
    row.read = () => ({ id: p.id, name: pname.value, type: type.value, model: model.value, color: color.value, accent: accent.value, ...(mode.value === 'share' ? { share: +need.value } : { count: +need.value }) });
    return row;
  };
  const ladder = el('div', { class: 'prize-rows' }, c.prizes.map((p) => prizeRow(p, true)));
  const optional = (p, label) => {
    const on = el('input', { type: 'checkbox', checked: !!p });
    const row = prizeRow(p || { name: '', type: 'Hat', data: { model: 'halo', color: '#5bd6a0' } }, false);
    const sync = () => { row.style.display = on.checked ? '' : 'none'; };
    on.addEventListener('change', sync);
    sync();
    return { node: el('div', {}, el('label', { class: 'perm-row' }, on, el('span', { text: label })), row), read: () => (on.checked ? row.read() : null) };
  };
  const team = optional(c.teamPrize, 'Team prize: everyone gets it when all players together reach the team goal');
  const hubP = optional(c.hubPrize, 'Hub prize: for the hub\'s puzzle (rune puzzle / star fragments)');
  modal({
    title: key ? `Edit ${c.name}` : 'Your own event',
    width: 760,
    body: el('div', { class: 'custom-event' },
      el('label', { class: 'field' }, 'Name (The Hunt: ...)', name),
      el('label', { class: 'field' }, 'Story', desc),
      el('div', { class: 'row wrap', style: { gap: '10px' } },
        el('label', { class: 'field' }, 'Kind', kind), el('label', { class: 'field' }, 'Hub', hub),
        el('label', { class: 'field' }, 'Robits for each', robits), el('label', { class: 'field' }, 'Team goal', goal)),
      el('h4', { text: 'Prizes (in order: after N finds or a % of all games)' }), ladder,
      el('button', { class: 'btn btn-small', text: '+ Add prize', onclick: () => ladder.append(prizeRow({ name: '', type: 'Hat', data: { model: 'cap', color: '#ffc400' }, count: ladder.children.length + 1 }, true)) }),
      el('h4', { text: 'Bonus prizes' }), team.node, hubP.node,
      el('p', { class: 'small muted', text: 'The games of the event and their quests are set in the settings of the live event: launch it as a private preview, change the quests, test it, then open it for everyone.' })),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: async () => {
      try {
        await api.post('/admin/hunt/custom', { key, event: { name: name.value, description: desc.value, kind: kind.value, hub: hub.value, robits: +robits.value, teamGoal: +goal.value, prizes: [...ladder.children].map((r) => r.read()), teamPrize: team.read(), hubPrize: hubP.read() } });
        toast('Event saved', 'success');
        drawHunt();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

// ---------------------------------------------------------------- quick event
// The easy way: a map, a name, a length - prizes and the story come with the map.
const EVENT_STYLE = {
  winter: { icon: '❄️', bg: 'linear-gradient(135deg,#5fa8e8,#173a6b)' },
  spooky: { icon: '🎃', bg: 'linear-gradient(135deg,#5a2d82,#120a1c)' },
  candy: { icon: '🍭', bg: 'linear-gradient(135deg,#ff8cc6,#8a2d6b)' },
  ocean: { icon: '🌊', bg: 'linear-gradient(135deg,#2fb8c9,#0b2f5a)' },
  relics: { icon: '🗿', bg: 'linear-gradient(135deg,#6b8a3a,#1f3318)' },
  dimension: { icon: '🪐', bg: 'linear-gradient(135deg,#3a1a6b,#0b0a2a)' },
};
function quickEvent(h) {
  const EVENT_MAPS = Object.fromEntries(Object.entries(h.presets || {}).map(([k, v]) => [k, { ...EVENT_STYLE[k], ...v }]));
  let map = 'winter';
  const name = el('input', { class: 'input', maxlength: 60, value: EVENT_MAPS[map].title });
  const grid = el('div', { class: 'qe-maps' });
  const prizesBox = el('div', { class: 'qe-prizes' });
  const drawMaps = () => {
    grid.replaceChildren(...Object.entries(EVENT_MAPS).map(([k, m]) => el('button', { type: 'button', class: 'qe-map' + (k === map ? ' on' : ''), style: { background: m.bg }, onclick: () => {
      const auto = Object.values(EVENT_MAPS).some((x) => x.title === name.value) || !name.value;
      map = k;
      if (auto) name.value = m.title;
      drawMaps();
    } }, el('span', { class: 'qe-icon', text: m.icon }), el('b', { text: m.title }))));
    const m = EVENT_MAPS[map];
    prizesBox.replaceChildren(el('div', { class: 'small muted', text: 'Prizes:' }),
      ...m.prizes.map((p, i) => el('span', { class: 'qe-chip' }, el('i', { style: { background: p.color } }), `${p.name}`, el('small', { text: i === 0 ? ' · 1st' : ` · ${p.share}%` }))),
      el('span', { class: 'qe-chip bonus' }, el('i', { style: { background: m.team.color } }), m.team.name, el('small', { text: ' · team' })),
      el('span', { class: 'qe-chip bonus' }, el('i', { style: { background: m.hub.color } }), m.hub.name, el('small', { text: ' · hub' })));
  };
  drawMaps();
  const seg = (opts, val) => {
    const box = el('div', { class: 'qe-seg' });
    box.value = val;
    const draw = () => box.replaceChildren(...opts.map(([v, t]) => el('button', { type: 'button', class: v === box.value ? 'on' : '', text: t, onclick: () => { box.value = v; draw(); } })));
    draw();
    return box;
  };
  const kind = seg([['quests', '📜 Quests in every game'], ['shards', '🔍 Hidden items (scanner)']], 'quests');
  const length = seg([['0', 'No end'], ['1', '1 day'], ['3', '3 days'], ['7', '1 week']], '3');
  const start = seg([['save', 'Just save'], ['private', 'Test (only me)'], ['public', 'Launch for everyone']], 'private');
  const robits = el('input', { class: 'input', type: 'number', min: 0, max: 1000, value: 25, style: { width: '90px' } });
  modal({
    title: '⚡ Quick event',
    width: 720,
    body: el('div', { class: 'quick-event' },
      el('div', { class: 'qe-step', text: '1. Pick a map' }), grid,
      el('div', { class: 'qe-step', text: '2. Name it' }), el('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, el('span', { class: 'muted', text: 'The Hunt:' }), name),
      el('div', { class: 'qe-step', text: '3. What players do' }), kind,
      el('div', { class: 'row wrap', style: { gap: '18px' } },
        el('div', {}, el('div', { class: 'qe-step', text: '4. How long' }), length),
        el('div', {}, el('div', { class: 'qe-step', text: 'Robits for each' }), robits)),
      el('div', { class: 'qe-step', text: '5. Start' }), start,
      prizesBox,
      el('p', { class: 'small muted', text: 'You can change everything later with Edit (prizes, story, quests of every game).' })),
    buttons: [{ text: 'Create', cls: 'btn-green', onClick: async () => {
      const m = EVENT_MAPS[map];
      try {
        const r = await api.post('/admin/hunt/custom', { event: { name: name.value || m.title, description: m.story, kind: kind.value, hub: map, robits: +robits.value, teamGoal: 30, prizes: m.prizes, teamPrize: m.team, hubPrize: m.hub } });
        if (start.value !== 'save') {
          const days = +length.value;
          await api.post('/admin/hunt/control', { action: 'launch', key: r.key, public: start.value === 'public', endsAt: days ? Date.now() + days * 86400e3 : 0 });
        }
        toast(start.value === 'public' ? 'The event is live!' : start.value === 'private' ? 'Started: only you can see it. Test it, then open it for everyone.' : 'Event saved', 'success');
        drawHunt();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

// Give or take a player's finds (prizes and Robits come with them as usual).
function huntPlayerBox(quests) {
  const what = quests ? 'quests' : 'finds';
  const who = el('input', { class: 'input', placeholder: 'Player name', list: 'admin-usernames-hunt', autocomplete: 'off', style: { maxWidth: '260px' } });
  const names = el('datalist', { id: 'admin-usernames-hunt' }, data.users.map((u) => el('option', { value: u.username })));
  const out = el('div');
  const draw = (p) => {
    out.replaceChildren(
      el('div', { class: 'row wrap', style: { gap: '10px', margin: '10px 0' } },
        el('b', { class: 'no-i18n', text: p.user.username }),
        el('span', { text: `${p.count} / ${p.total} ${what}` }),
        el('button', { class: 'btn btn-small btn-green', text: 'Give all', onclick: () => send({ all: true }) }),
        el('button', { class: 'btn btn-small btn-red', text: 'Take all', onclick: () => { if (confirm('Take everything? Prizes stay.')) send({ all: true, take: true }); } })),
      el('div', { class: 'small muted', style: { marginBottom: '6px' }, text: 'Click a game to give or take it.' }),
      el('div', { class: 'badge-picker' }, p.games.map((g) => el('button', {
        class: 'badge-toggle' + (g.found ? ' on' : ''), title: g.found ? 'Take' : 'Give',
        onclick: () => send({ gameId: g.id, take: g.found }),
      }, el('span', { class: 'hunt-dot-mini' + (g.found ? ' got' : '') }), el('span', { class: 'no-i18n', text: g.name })))));
  };
  const load = async () => {
    try { draw(await api.get(`/admin/hunt/player?user=${encodeURIComponent(who.value.trim())}`)); } catch (e) { toast(e.message, 'error'); }
  };
  const send = async (b) => {
    try {
      const r = await api.post('/admin/hunt/tokens', { user: who.value.trim(), ...b });
      draw(r);
      toast(r.newPrizes?.length ? `Done! Prizes: ${r.newPrizes.map((x) => x.name).join(', ')}` : 'Done', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  who.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  return el('div', { class: 'badge-give', style: { marginTop: '24px', borderBottom: 0 } },
    el('h3', { text: quests ? 'Quests for a player' : 'Finds for a player' }),
    el('p', { class: 'small muted', text: 'Give or take by hand. What you give brings its Robits and unlocks prizes like the real thing; taking keeps the prizes.' }),
    el('div', { class: 'row wrap' }, who, names, el('button', { class: 'btn btn-primary', text: 'Show', onclick: load })),
    out);
}

// ---------------------------------------------------------------- item picker
// Find any item (also event prizes and items not for sale) and pick one or more.
function itemPicker({ title = 'Pick items', owned = [], onPick, multi = true, button = 'Give' }) {
  const picked = new Map();
  const q = el('input', { class: 'input', placeholder: 'Search by name or ID' });
  const type = el('select', { class: 'input', style: { width: 'auto', flex: 'none' } }, el('option', { value: '', text: 'All types' }));
  const grid = el('div', { class: 'adm-pick-grid' }, spinner());
  const chosen = el('div', { class: 'adm-pick-chosen' });
  const drawChosen = () => chosen.replaceChildren(...(picked.size ? [...picked.values()].map((it) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: it.name }),
    el('button', { class: 'chip-x', text: '×', onclick: () => { picked.delete(it.id); drawChosen(); load(); } }))) : [el('span', { class: 'muted small', text: multi ? 'Click items to pick them.' : 'Click an item.' })]));
  let typesLoaded = false;
  let timer = 0;
  const load = async () => {
    const r = await api.get(`/admin/items/search?q=${encodeURIComponent(q.value.trim())}&type=${encodeURIComponent(type.value)}&limit=60`);
    if (!typesLoaded) { typesLoaded = true; type.append(...r.types.map((t) => el('option', { value: t, text: t }))); }
    grid.replaceChildren(...(r.items.length ? r.items.map((it) => {
      const card = el('button', { class: 'adm-pick' + (picked.has(it.id) ? ' on' : '') + (owned.includes(it.id) ? ' owned' : ''), onclick: () => {
        if (!multi) { picked.clear(); picked.set(it.id, it); finish(); return; }
        if (picked.has(it.id)) picked.delete(it.id); else picked.set(it.id, it);
        card.classList.toggle('on', picked.has(it.id));
        drawChosen();
      } }, itemCard(it),
      el('div', { class: 'adm-pick-tags' },
        el('span', { class: 'muted small', text: `#${it.id} · ${it.type}` }),
        it.offsale ? el('span', { class: 'pill', text: 'not for sale' }) : null,
        it.limited ? el('span', { class: 'pill limited-pill', text: 'Limited' }) : null,
        owned.includes(it.id) ? el('span', { class: 'pill online-pill', text: 'owned' }) : null));
      return card;
    }) : [el('div', { class: 'empty', text: 'No items found.' })]));
  };
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 200); });
  type.addEventListener('change', load);
  let m;
  const finish = async () => {
    if (!picked.size) { toast('Pick at least one item.', 'error'); return false; }
    try { await onPick([...picked.values()]); m.close(); } catch (e) { toast(e.message, 'error'); }
    return false;
  };
  m = modal({
    title, width: 900,
    body: el('div', { class: 'adm-picker' }, el('div', { class: 'row' }, q, type), chosen, grid),
    buttons: multi ? [{ text: button, cls: 'btn-green', onClick: finish }, { text: 'Cancel' }] : [{ text: 'Cancel' }],
  });
  drawChosen();
  load();
  setTimeout(() => q.focus(), 50);
}

// ---------------------------------------------------------------- search (Ctrl+K)
// Players, items, sections and actions in one box.
function palette() {
  if (document.querySelector('.adm-palette')) return;
  const input = el('input', { class: 'adm-pal-input', placeholder: 'Type a player, an item, a section... (Esc to close)' });
  const list = el('div', { class: 'adm-pal-list' });
  const back = el('div', { class: 'adm-palette' }, el('div', { class: 'adm-pal-box' }, el('div', { class: 'adm-pal-top' }, ic('search'), input), list));
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  let rows = [];
  let sel = 0;
  let itemTimer = 0;
  const actions = [
    ['Give an item to a player', 'gift', () => giveToPlayerDialog()],
    me.isAdmin ? ['Send a gift to many players', 'gift', () => { location.hash = 'gifts'; }] : null,
    me.isAdmin ? ['Message every player', 'megaphone', () => { location.hash = 'broadcast'; }] : null,
    perm('moderator') ? ['Open reports', 'flag', () => { location.hash = 'reports'; }] : null,
  ].filter(Boolean);
  const draw = () => {
    list.replaceChildren(...rows.map((r, i) => {
      const b = el('button', { class: 'adm-pal-row' + (i === sel ? ' sel' : ''), onclick: () => { close(); r.run(); } }, r.icon, el('span', { class: 'adm-pal-label no-i18n', text: r.label }), el('span', { class: 'adm-pal-kind', text: r.kind }));
      b.addEventListener('mousemove', () => { if (sel !== i) { sel = i; draw(); } });
      return b;
    }));
    if (!rows.length) list.append(el('div', { class: 'muted small', style: { padding: '12px' }, text: 'Nothing found.' }));
  };
  const update = () => {
    const q = input.value.trim().toLowerCase();
    const tabs = Object.entries(TABS).filter(([, t]) => !q || t.label.toLowerCase().includes(q)).map(([id, t]) => ({ label: t.label, kind: 'Section', icon: ic(t.icon), run: () => { location.hash = id; } }));
    const acts = actions.filter(([l]) => !q || l.toLowerCase().includes(q)).map(([l, i, run]) => ({ label: l, kind: 'Action', icon: ic(i), run }));
    const players = q ? data.users.filter((u) => u.username.toLowerCase().includes(q) || String(u.id) === q).slice(0, 8).map((u) => ({ label: u.username, kind: 'Player', icon: el('span', { class: 'adm-pal-head' }, headshotImg(u, 48)), run: () => manage(u) })) : [];
    rows = [...players, ...tabs, ...acts];
    sel = 0;
    draw();
    clearTimeout(itemTimer);
    if (q.length >= 2) itemTimer = setTimeout(async () => {
      try {
        const r = await api.get(`/admin/items/search?q=${encodeURIComponent(q)}&limit=6`);
        if (input.value.trim().toLowerCase() !== q) return;
        rows = [...rows, ...r.items.map((it) => ({ label: it.name, kind: 'Item', icon: ic('box'), run: () => giveToPlayerDialog(it) }))];
        draw();
      } catch { /* ignore */ }
    }, 180);
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && rows[sel]) { close(); rows[sel].run(); }
  });
  update();
  input.focus();
}
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
});

// "Give an item to a player": pick the player (and the item if not given).
function giveToPlayerDialog(item) {
  const who = el('input', { class: 'input', placeholder: 'Player name', list: 'adm-names', autocomplete: 'off' });
  const names = el('datalist', { id: 'adm-names' }, data.users.map((u) => el('option', { value: u.username })));
  const go = async (items) => {
    const u = data.users.find((x) => x.username.toLowerCase() === who.value.trim().toLowerCase());
    if (!u) throw new Error('No player with that name.');
    const r = await api.post(`/admin/users/${u.id}/give`, { itemIds: items.map((i) => i.id) });
    replaceUser(r.user);
    toast(r.given.length ? `${u.username} got: ${r.given.join(', ')}` : `${u.username} already has it`, 'success');
  };
  modal({
    title: item ? `Give ${item.name}` : 'Give an item to a player',
    body: el('div', {}, item ? el('div', { class: 'adm-give-item' }, itemCard(item)) : null, el('label', { class: 'field' }, 'To', who), names),
    buttons: [{ text: item ? 'Give' : 'Pick the items...', cls: 'btn-green', onClick: async () => {
      if (!data.users.some((x) => x.username.toLowerCase() === who.value.trim().toLowerCase())) { toast('No player with that name.', 'error'); return false; }
      if (item) { try { await go([item]); } catch (e) { toast(e.message, 'error'); return false; } return undefined; }
      itemPicker({ title: `Give items to ${who.value.trim()}`, onPick: go });
      return undefined;
    } }, { text: 'Cancel' }],
  });
  setTimeout(() => who.focus(), 50);
}

// ---------------------------------------------------------------- activity
const ACT_KIND = { signup: ['New player', 'users', 'blue'], earn: ['Robits in', 'bolt', 'green'], spend: ['Robits out', 'bolt', 'orange'], admin: ['Staff', 'gear', 'purple'], ban: ['Ban', 'flag', 'red'], report: ['Report', 'flag', 'orange'] };
async function drawActivity(kind = '') {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get(`/admin/activity${kind ? '?kind=' + kind : ''}`); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const chips = el('div', { class: 'adm-filters' }, [['', 'Everything'], ...Object.entries(ACT_KIND).map(([k, [l]]) => [k, l])].map(([k, l]) => el('button', { class: 'adm-filter' + (k === kind ? ' on' : ''), text: l, onclick: () => drawActivity(k) })));
  let lastDay = '';
  const rows = [];
  for (const e of r.events) {
    const day = new Date(e.time).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    if (day !== lastDay) { rows.push(el('div', { class: 'adm-day', text: day })); lastDay = day; }
    const [label, icon, color] = ACT_KIND[e.kind] || ['', 'list', ''];
    const user = e.userId ? data.users.find((u) => u.id === e.userId) : null;
    rows.push(el('div', { class: 'adm-feed-row' },
      el('span', { class: 'adm-feed-ic ' + color, title: label }, ic(icon)),
      el('div', { class: 'adm-feed-text' },
        e.byName && e.kind !== 'report' ? el('b', { class: 'no-i18n', text: e.byName + ' ' }) : null,
        e.kind === 'report' ? el('span', {}, el('b', { class: 'no-i18n', text: e.byName }), ' ') : null,
        user ? el('button', { class: 'adm-link-btn no-i18n', text: e.username, onclick: () => manage(user) }) : e.username ? el('span', { class: 'no-i18n', text: e.username }) : null,
        el('span', { text: ' ' }), el('span', { class: 'adm-feed-what', text: e.text })),
      e.amount ? el('span', { class: 'mini-amount ' + (e.amount > 0 ? 'plus' : 'minus'), text: (e.amount > 0 ? '+' : '') + fmtFull(e.amount) }) : null,
      el('span', { class: 'muted small', text: new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
  }
  body.replaceChildren(chips, rows.length ? el('div', { class: 'adm-feed' }, rows) : el('div', { class: 'empty', text: 'Nothing happened this week.' }));
}

// ---------------------------------------------------------------- reports
async function drawReports(status = 'open') {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get(`/admin/reports?status=${status}`); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const handle = async (rep, st, all) => {
    const note = st === 'open' ? '' : prompt(st === 'resolved' ? 'What did you do? (optional)' : 'Why is it dismissed? (optional)') ?? null;
    if (note === null) return;
    try { await api.post(`/admin/reports/${rep.id}`, { status: st, note, all }); toast(st === 'resolved' ? 'Resolved' : st === 'dismissed' ? 'Dismissed' : 'Opened again', 'success'); drawReports(status); pollLive(); } catch (e) { toast(e.message, 'error'); }
  };
  body.replaceChildren(
    el('div', { class: 'adm-filters' }, [['open', `Open (${r.open})`], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([k, l]) => el('button', { class: 'adm-filter' + (k === status ? ' on' : ''), text: l, onclick: () => drawReports(k) }))),
    el('p', { class: 'small muted', text: 'Players report others from their profile page. The reporter gets a thank-you message when you close the report.' }),
    r.reports.length ? el('div', { class: 'adm-reports' }, r.reports.map((rep) => el('div', { class: 'adm-report ' + rep.status },
      el('div', { class: 'adm-report-head' },
        rep.user ? el('button', { class: 'admin-head', onclick: () => manage(rep.user) }, headshotImg(rep.user, 96)) : null,
        el('div', { style: { flex: 1 } },
          el('div', {}, rep.user ? el('button', { class: 'adm-link-btn no-i18n', style: { fontWeight: 700, fontSize: '16px' }, text: rep.user.username, onclick: () => manage(rep.user) }) : '?', rep.user ? pills(rep.user) : null,
            rep.reportsOnUser > 1 ? el('span', { class: 'pill warn-pill', text: `${rep.reportsOnUser} reports` }) : null,
            rep.user?.warnings ? el('span', { class: 'pill warn-pill', text: `${rep.user.warnings} warnings` }) : null),
          el('div', { class: 'small muted' }, 'Reported by ', el('span', { class: 'no-i18n', text: rep.fromName }), ` · ${timeAgo(rep.time)} · #${rep.id}`)),
        el('span', { class: 'pill report-state ' + rep.status, text: rep.status })),
      el('div', { class: 'adm-report-reason', text: rep.reason }),
      rep.details ? el('div', { class: 'adm-report-details no-i18n', text: `“${rep.details}”` }) : null,
      rep.status !== 'open' ? el('div', { class: 'small muted' }, `${rep.status === 'resolved' ? 'Resolved' : 'Dismissed'} by `, el('span', { class: 'no-i18n', text: rep.handledName || '?' }), rep.note ? el('span', { class: 'no-i18n', text: ': ' + rep.note }) : null) : null,
      el('div', { class: 'row wrap', style: { gap: '6px', marginTop: '8px' } },
        rep.user ? el('button', { class: 'btn btn-small btn-primary', text: 'Open player', onclick: () => manage(rep.user, 'moderation') }) : null,
        rep.status === 'open' ? el('button', { class: 'btn btn-small btn-green', text: 'Resolve', onclick: () => handle(rep, 'resolved', rep.reportsOnUser > 1 && confirm('Close the other open reports about this player too?')) }) : null,
        rep.status === 'open' ? el('button', { class: 'btn btn-small', text: 'Dismiss', onclick: () => handle(rep, 'dismissed') }) : el('button', { class: 'btn btn-small', text: 'Open again', onclick: () => handle(rep, 'open') }))))) : el('div', { class: 'adm-empty-big' }, ic('flag', 'adm-empty-ic'), el('div', { text: status === 'open' ? 'No open reports. All good!' : 'Nothing here.' })));
}

// ---------------------------------------------------------------- gift center
function drawGifts() {
  const items = new Map();
  const to = el('select', { class: 'input' }, [['all', 'Every player'], ['online', 'Players online now'], ['names', 'Only these players...']].map(([v, t]) => el('option', { value: v, text: t })));
  const names = el('textarea', { class: 'input', rows: 2, placeholder: 'Player names, separated by commas or spaces' });
  const preview = el('div', { class: 'small muted' });
  const robits = el('input', { class: 'input', type: 'number', min: 0, max: 1000000, value: 0 });
  const tier = el('select', { class: 'input' }, [el('option', { value: '', text: 'No Builders Club' }), ...data.memberships.filter((t) => t.id !== 'None').map((t) => el('option', { value: t.id, text: t.name }))]);
  const days = el('input', { class: 'input', type: 'number', min: 0, max: 3650, value: 30 });
  const message = el('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: 'A message with the gift (optional), e.g. "Thanks for playing!"' });
  const chosen = el('div', { class: 'adm-pick-chosen' });
  const drawItems2 = () => chosen.replaceChildren(...(items.size ? [...items.values()].map((it) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: it.name }), el('button', { class: 'chip-x', text: '×', onclick: () => { items.delete(it.id); drawItems2(); } }))) : [el('span', { class: 'muted small', text: 'No items.' })]));
  const syncTo = () => { names.style.display = to.value === 'names' ? '' : 'none'; refresh(); };
  let t = 0;
  const refresh = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      try {
        const r = await api.post('/admin/gift/preview', { to: to.value, names: names.value });
        preview.replaceChildren(...[el('b', { text: `${r.count} players` }), r.sample.length ? el('span', { class: 'no-i18n', text: ` · ${r.sample.join(', ')}${r.count > r.sample.length ? '...' : ''}` }) : null,
          r.missing.length ? el('div', { style: { color: '#d0021b' } }, 'Not found: ', el('span', { class: 'no-i18n', text: r.missing.join(', ') })) : null].filter(Boolean));
      } catch { /* ignore */ }
    }, 250);
  };
  to.addEventListener('change', syncTo);
  names.addEventListener('input', refresh);
  const send = async () => {
    const what = [...[...items.values()].map((i) => i.name), +robits.value ? `R$ ${robits.value}` : '', tier.value ? `${tier.selectedOptions[0].text}${+days.value ? ` (${days.value} days)` : ''}` : ''].filter(Boolean);
    if (!what.length) return toast('Add items, Robits or Builders Club.', 'error');
    if (!confirm(`Send ${what.join(', ')} to ${preview.querySelector('b')?.textContent || 'them'}?`)) return;
    try {
      const r = await api.post('/admin/gift', { to: to.value, names: names.value, itemIds: [...items.keys()], robits: +robits.value, membership: tier.value, days: +days.value, message: message.value });
      toast(`Sent to ${r.players} players!`, 'success');
      items.clear(); drawItems2(); robits.value = 0; tier.value = ''; message.value = '';
    } catch (e) { toast(e.message, 'error'); }
  };
  body.replaceChildren(el('div', { class: 'adm-gift' },
    el('div', { class: 'adm-gift-hero' }, ic('gift', 'adm-gift-ic'), el('div', {}, el('h3', { text: 'Gift Center' }), el('p', { class: 'muted', text: 'Give items, Robits or Builders Club to everyone, to who is online, or to a list of players. Each of them gets a message with the gift.' }))),
    el('div', { class: 'adm-gift-grid' },
      el('div', { class: 'adm-card' }, el('h4', { text: '1. Who gets it' }), to, names, preview),
      el('div', { class: 'adm-card' }, el('h4', { text: '2. What they get' }),
        el('label', { class: 'field' }, 'Items', chosen, el('button', { class: 'btn btn-small', text: '+ Add items', onclick: () => itemPicker({ title: 'Items for the gift', button: 'Add', onPick: (list) => { for (const it of list) items.set(it.id, it); drawItems2(); } }) })),
        el('label', { class: 'field' }, 'Robits', robits),
        el('div', { class: 'row wrap' }, el('label', { class: 'field' }, 'Builders Club', tier), el('label', { class: 'field' }, 'Days (0 = forever)', days))),
      el('div', { class: 'adm-card' }, el('h4', { text: '3. Message' }), message,
        el('button', { class: 'btn btn-green btn-large', style: { marginTop: '10px', width: '100%' }, text: 'Send the gift', onclick: send })))));
  drawItems2();
  syncTo();
}

// ---------------------------------------------------------------- dashboard
const fmtUptime = (s) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);
// A 14-day bar chart of one number: hover a bar for its value; the last day and
// the best day are labelled.
function dayChart(title, days, key) {
  const vals = days.map((d) => d[key]);
  const max = Math.max(1, ...vals);
  const best = vals.indexOf(Math.max(...vals));
  return el('div', { class: 'dash-chart' },
    el('div', { class: 'dash-chart-head' }, el('b', { text: title }), el('span', { class: 'muted small', text: `today: ${vals[vals.length - 1]}` })),
    el('div', { class: 'dash-bars' }, days.map((d, i) => {
      const v = d[key];
      const label = new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return el('div', { class: 'dash-bar-col', title: `${label}: ${v}` },
        (i === best || i === days.length - 1) && v ? el('div', { class: 'dash-bar-val', text: String(v) }) : el('div', { class: 'dash-bar-val' }),
        el('div', { class: 'dash-bar', style: { height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` } }),
        el('div', { class: 'dash-bar-day', text: i % 2 === days.length % 2 ? label : '' }));
    })));
}
async function drawDashboard() {
  body.replaceChildren(spinner());
  let d;
  try { d = await api.get('/admin/dashboard'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const k = d.kpis;
  const tile = (label, value, sub, cls = '') => el('div', { class: 'dash-tile ' + cls }, el('div', { class: 'dash-value', text: String(value) }), el('div', { class: 'dash-label', text: label }), sub ? el('div', { class: 'dash-sub', text: sub }) : null);
  const list = (title, rows) => el('div', { class: 'dash-card' }, el('h3', { text: title }), rows.length ? el('div', { class: 'mini-list' }, rows) : el('div', { class: 'muted small', text: 'Nothing yet.' }));
  const qa = (label, icon, run, cls = '') => el('button', { class: 'adm-qa ' + cls, onclick: run }, ic(icon), el('span', { text: label }));
  const hour = new Date().getHours();
  body.replaceChildren(
    attentionStrip(),
    el('div', { class: 'adm-welcome' },
      el('div', {}, el('h2', { text: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }, el('span', { class: 'no-i18n', text: ', ' + me.username + '!' })),
        el('p', { class: 'muted', text: `${k.online} players online, ${k.playing} playing, ${k.newToday} new today. Press Ctrl+K to find anything.` })),
      el('div', { class: 'adm-qas' },
        perm('economy') ? qa('Give an item', 'gift', () => giveToPlayerDialog(), 'green') : null,
        me.isAdmin ? qa('Gift Center', 'gift', () => { location.hash = 'gifts'; }) : null,
        perm('moderator') ? qa('Reports', 'flag', () => { location.hash = 'reports'; }, 'orange') : null,
        me.isAdmin ? qa('Broadcast', 'megaphone', () => { location.hash = 'broadcast'; }) : null,
        me.isAdmin ? qa('The Hunt', 'hunt', () => { location.hash = 'hunt'; }, 'purple') : null,
        me.isAdmin ? qa('Admin Abuse', 'crown', () => { location.hash = 'abuse'; }, 'orange') : null,
        me.isAdmin ? qa('Robits rain', 'sparkle', () => { location.hash = 'live'; }) : null,
        me.isAdmin ? qa('Daily Spin', 'wheel', () => { location.hash = 'spin'; }) : null,
        me.isAdmin ? qa('Console', 'terminal', () => { location.hash = 'console'; }) : null)),
    el('div', { class: 'dash-tiles' },
      tile('Players', fmtFull(k.users), `+${k.newToday} today`, 'blue'),
      tile('Online now', k.online, `${k.activeToday} visited today`, 'green'),
      tile('Playing now', k.playing, `${k.servers} servers`, 'green'),
      tile('Games', k.games),
      tile('Catalog items', k.items),
      tile('Robits in circulation', fmtNum(k.robits)),
      tile('Robits earned (7 days)', fmtNum(k.earned7)),
      tile('Robits spent (7 days)', fmtNum(k.spent7)),
      tile('Banned', k.banned, null, k.banned ? 'red' : ''),
      tile('Server', `${k.memory} MB`, `up ${fmtUptime(k.uptime)}${k.version ? ' · ' + k.version : ''}`)),
    el('div', { class: 'dash-charts' },
      dayChart('New players', d.days, 'signups'),
      dayChart('Players who visited', d.days, 'active'),
      dayChart('Games played', d.days, 'plays')),
    el('div', { class: 'dash-grid' },
      list('Top games', d.topGames.map((g) => el('div', { class: 'mini-row' },
        el('a', { class: 'mini-text no-i18n', href: `/game?id=${g.id}`, text: g.name }),
        g.playing ? el('span', { class: 'pill online-pill', text: `${g.playing} playing` }) : null,
        el('span', { class: 'muted small', text: `${fmtNum(g.visits)} visits` })))),
      list('New players', d.newest.map((u) => el('div', { class: 'mini-row' },
        el('a', { class: 'mini-text no-i18n', href: `/profile?id=${u.id}`, text: u.username }), el('span', { class: 'muted small', text: timeAgo(u.created) })))),
      list('Richest players', d.richest.map((u) => el('div', { class: 'mini-row' },
        el('a', { class: 'mini-text no-i18n', href: `/profile?id=${u.id}`, text: u.username }), el('span', { class: 'small', text: `R$ ${fmtFull(u.robits)}` })))),
      list('Latest admin actions', d.recentLog.map((e) => el('div', { class: 'mini-row' },
        el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: e.byName }), ' · ', el('span', { text: e.action }), e.targetName ? el('span', { class: 'muted no-i18n', text: ' · ' + e.targetName }) : null),
        el('span', { class: 'muted small', text: timeAgo(e.time) }))))));
}

// ---------------------------------------------------------------- servers
async function drawServers() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/servers'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (path, b, msg) => { try { await api.post(path, b); toast(msg, 'success'); drawServers(); } catch (e) { toast(e.message, 'error'); } };
  body.replaceChildren(
    el('div', { class: 'row wrap', style: { marginBottom: '12px', gap: '10px' } },
      el('b', { text: `${r.servers.length} servers running` }),
      el('span', { class: 'muted small', text: `${r.servers.reduce((a, s) => a + s.players.length, 0)} players` }),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn btn-small', text: 'Refresh', onclick: drawServers })),
    r.servers.length ? el('div', {}, r.servers.map((s) => {
      const msg = el('input', { class: 'input', placeholder: 'Message to everyone on this server', maxlength: 200 });
      return el('div', { class: 'server-card' },
        el('div', { class: 'row wrap', style: { gap: '8px' } },
          el('a', { class: 'no-i18n', href: s.gameId ? `/game?id=${s.gameId}` : '#', style: { fontWeight: 700 }, text: s.name }),
          s.privateName ? el('span', { class: 'pill', text: `Private: ${s.privateName}` }) : null,
          s.isTest ? el('span', { class: 'pill', text: 'Studio test' }) : null,
          el('span', { class: 'muted small', text: `${s.players.length}/${s.max} · up ${fmtUptime(Math.round((Date.now() - s.startedAt) / 1000))} · ${s.id.slice(0, 8)}` })),
        el('div', { class: 'promo-chosen' }, s.players.length ? s.players.map((p) => el('span', { class: 'holder-chip' },
          el('a', { class: 'no-i18n', href: `/profile?id=${p.userId}`, text: p.name }),
          el('button', { title: 'Kick', text: '×', onclick: () => { if (confirm(`Kick ${p.name}?`)) post(`/admin/users/${p.userId}/kick`, { reason: 'Kicked by an admin' }, `${p.name} was kicked`); } })))
          : [el('span', { class: 'muted small', text: 'Empty (closes by itself in a minute)' })]),
        el('div', { class: 'row', style: { marginTop: '8px' } }, msg,
          el('button', { class: 'btn btn-small btn-primary', text: 'Send', onclick: () => post(`/admin/servers/${s.id}/message`, { text: msg.value }, 'Message sent') }),
          el('button', { class: 'btn btn-small btn-red', text: 'Shut down', onclick: () => { if (confirm('Shut this server down? Everyone on it is disconnected.')) post(`/admin/servers/${s.id}/shutdown`, {}, 'Server shut down'); } })));
    })) : el('div', { class: 'empty', text: 'No game servers are running.' }));
}

// ---------------------------------------------------------------- broadcast
function drawBroadcast() {
  const subject = el('input', { class: 'input', maxlength: 100, placeholder: 'Subject' });
  const text = el('textarea', { class: 'input', rows: 4, maxlength: 5000, placeholder: 'Message for every player' });
  const live = el('input', { type: 'checkbox', checked: true });
  const amount = el('input', { class: 'input', type: 'number', min: 1, max: 100000, value: 100, style: { width: '140px' } });
  const reason = el('input', { class: 'input', maxlength: 80, placeholder: 'Reason (shown in their transactions)', style: { maxWidth: '320px' } });
  const online = el('input', { type: 'checkbox' });
  body.replaceChildren(
    announceBox,
    el('div', { class: 'badge-give', style: { marginTop: '16px' } },
      el('h3', { text: 'Message to every player' }),
      el('p', { class: 'small muted', text: 'Goes to every inbox (Messages), from the main account.' }),
      subject, el('div', { style: { height: '8px' } }), text,
      el('label', { class: 'perm-row' }, live, el('span', { text: 'Also show it in every running game' })),
      el('button', { class: 'btn btn-primary', text: 'Send to everyone', onclick: async () => {
        if (!confirm('Send this message to every player?')) return;
        try { const r = await api.post('/admin/broadcast', { subject: subject.value, body: text.value, live: live.checked }); toast(`Sent to ${r.sent} players`, 'success'); subject.value = ''; text.value = ''; } catch (e) { toast(e.message, 'error'); }
      } })),
    el('div', { class: 'badge-give', style: { borderBottom: 0 } },
      el('h3', { text: 'Robits for everyone' }),
      el('div', { class: 'row wrap' }, amount, reason),
      el('label', { class: 'perm-row' }, online, el('span', { text: 'Only players who are online now' })),
      el('button', { class: 'btn btn-green', text: 'Give', onclick: async () => {
        if (!confirm(`Give R$ ${amount.value} to ${online.checked ? 'everyone online' : 'every player'}?`)) return;
        try { const r = await api.post('/admin/broadcast/robits', { amount: +amount.value, onlineOnly: online.checked, reason: reason.value }); toast(`${r.players} players got R$ ${amount.value}`, 'success'); load(); } catch (e) { toast(e.message, 'error'); }
      } })));
}

// ---------------------------------------------------------------- settings
async function drawSettings() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/settings'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const S = r.settings;
  const maint = el('input', { type: 'checkbox', checked: S.maintenance.on });
  const maintMsg = el('input', { class: 'input', maxlength: 300, value: S.maintenance.message, placeholder: 'Robis is under maintenance. Please come back soon!' });
  const signups = el('input', { type: 'checkbox', checked: S.signups !== false });
  const start = el('input', { class: 'input', type: 'number', min: 0, max: 1000000, value: S.startRobits, style: { width: '140px' } });
  const words = el('textarea', { class: 'input', rows: 3, value: S.bannedWords.join(', '), placeholder: 'word1, word2, ...' });
  const dc = S.discord || { on: false, appId: '', hasSecret: false };
  const dcOn = el('input', { type: 'checkbox', checked: !!dc.on });
  const dcStatus = el('input', { type: 'checkbox', checked: dc.status !== false });
  const dcApp = el('input', { class: 'input', value: dc.appId || '', placeholder: 'Application ID (a long number)', inputmode: 'numeric' });
  const dcSecret = el('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: dc.hasSecret ? 'Client Secret is saved (type a new one to change it)' : 'Client Secret' });
  const host = location.host;
  const discordSteps = el('ol', { class: 'discord-steps' },
    el('li', {}, 'Open ', el('a', { href: 'https://discord.com/developers/applications', target: '_blank', rel: 'noopener', text: 'discord.com/developers/applications' }), ' and press New Application (name it Robis).'),
    el('li', {}, 'General Information: copy the Application ID here. OAuth2: press Reset Secret and copy the Client Secret here.'),
    el('li', {}, 'OAuth2 -> Redirects: add https://127.0.0.1 (Discord needs one, it is not used).'),
    el('li', {}, 'Activities -> URL Mappings: Prefix / -> Target ', el('b', { class: 'no-i18n', text: host }), ' (without https://).'),
    el('li', {}, 'Activities -> Settings: turn on Enable Activities and pick Web as the platform.'),
    el('li', {}, 'Rich Presence -> Art Assets: upload the Robis logo with the name robis (the picture in the Discord status).'),
    el('li', {}, 'Save here, then in any Discord voice channel press the rocket (Activities) and pick Robis. While it is not public, only the people in App Testers (Developer Portal) can start it.'));
  const socialRows = el('div');
  const socials = S.socials.map((x) => ({ ...x }));
  const drawSocials = () => socialRows.replaceChildren(...socials.map((x, i) => el('div', { class: 'row wrap social-row' },
    el('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { x.type = e.target.value; } }, r.socialTypes.map((t) => el('option', { value: t, text: t[0].toUpperCase() + t.slice(1), selected: t === x.type }))),
    el('input', { class: 'input', value: x.label, placeholder: 'Name', style: { maxWidth: '160px' }, oninput: (e) => { x.label = e.target.value; } }),
    el('input', { class: 'input', value: x.url, placeholder: 'https://t.me/...', oninput: (e) => { x.url = e.target.value; } }),
    el('button', { class: 'btn btn-small', text: '×', title: 'Remove', onclick: () => { socials.splice(i, 1); drawSocials(); } }))),
  el('button', { class: 'btn btn-small', text: '+ Add a link', onclick: () => { socials.push({ type: 'other', label: '', url: '' }); drawSocials(); } }));
  drawSocials();
  const save = async () => {
    try {
      await api.post('/admin/settings', {
        maintenance: { on: maint.checked, message: maintMsg.value }, signups: signups.checked, startRobits: +start.value,
        bannedWords: words.value.split(/[,\n]/), socials: socials,
        discord: { on: dcOn.checked, status: dcStatus.checked, appId: dcApp.value.trim(), secret: dcSecret.value },
      });
      toast('Settings saved', 'success');
      drawSettings();
    } catch (e) { toast(e.message, 'error'); }
  };
  const section = (title, hint, ...kids) => el('div', { class: 'settings-section' }, el('h3', { text: title }), hint ? el('p', { class: 'small muted', text: hint }) : null, ...kids);
  body.replaceChildren(
    section('Maintenance mode', 'Only staff can play and use the site; everyone else sees the message.',
      el('label', { class: 'perm-row' }, maint, el('b', { text: 'Turn on maintenance mode' })), maintMsg),
    section('Sign-ups', null,
      el('label', { class: 'perm-row' }, signups, el('span', { text: 'New players can create accounts' })),
      el('label', { class: 'row', style: { gap: '8px', marginTop: '6px' } }, el('span', { text: 'Robits for new accounts' }), start)),
    section('Chat filter', 'Extra words to hide in chat (on top of the built-in list). Separate them with commas.', words),
    section('Social links', 'Shown in the menu, on the home page and at the bottom of every page.', socialRows),
    section('Discord', '"Playing Robis" in the players\' Discord profiles: they download a small app (Settings -> Discord status) that shows what they play.',
      el('label', { class: 'perm-row' }, dcStatus, el('b', { text: 'Show "Playing Robis" in Discord profiles' }), dc.status !== false && dc.appId ? el('span', { class: 'pill online-pill', text: 'on' }) : null),
      el('label', { class: 'field' }, 'Application ID', dcApp),
      el('h4', { text: 'How to set it up' }),
      el('ol', { class: 'discord-steps' },
        el('li', {}, 'Open ', el('a', { href: 'https://discord.com/developers/applications', target: '_blank', rel: 'noopener', text: 'discord.com/developers/applications' }), ' and press New Application. Name it Robis - players see this name: "Playing Robis".'),
        el('li', { text: 'General Information: copy the Application ID into the field above and save.' }),
        el('li', { text: 'Rich Presence -> Art Assets: upload the Robis logo (at least 512x512) with the name robis. It is the picture next to the status (Discord shows new pictures after a few minutes).' }),
        el('li', { text: 'Done! Players find "Discord status" in their Settings, download the app and run it.' })),
      el('details', { class: 'discord-more' }, el('summary', { text: 'Optional: Robis inside Discord (Activity in voice channels)' }),
        el('label', { class: 'perm-row' }, dcOn, el('span', { text: 'Robis works as a Discord Activity' })),
        dcSecret,
        dc.hasSecret ? el('button', { class: 'btn btn-small', style: { marginTop: '6px' }, text: 'Delete the saved secret', onclick: async () => {
          try { await api.post('/admin/settings', { discord: { on: dcOn.checked, appId: dcApp.value.trim(), clearSecret: true } }); toast('Secret deleted', 'success'); drawSettings(); } catch (e) { toast(e.message, 'error'); }
        } }) : null,
        discordSteps)),
    el('button', { class: 'btn btn-primary btn-large', text: 'Save settings', onclick: save }));
}

// Admins give other players rights (see PERMISSIONS in server/api.js), and
// set exactly what each right allows (PERM_OPTIONS: item types, limits...).
const TYPE_LABELS = { TShirt: 'T-Shirts', Shirt: 'Shirts', Pants: 'Pants', Face: 'Faces', Hat: 'Hats', Hair: 'Hair', Pet: 'Pets' };
const BAN_LABELS = { '1h': '1 hour', '1d': '1 day', '3d': '3 days', '7d': '7 days', '30d': '30 days', forever: 'Forever' };
function permsDialog(u) {
  const opts = JSON.parse(JSON.stringify(u.permOpts || {}));
  const val = (perm, o) => (opts[perm] && opts[perm][o.key] !== undefined ? opts[perm][o.key] : o.default);
  const set = (perm, key, v) => { (opts[perm] || (opts[perm] = {}))[key] = v; };
  const control = (perm, o) => {
    if (o.type === 'bool') {
      const cb = el('input', { type: 'checkbox', checked: !!val(perm, o), onchange: () => set(perm, o.key, cb.checked) });
      return el('label', { class: 'perm-opt' }, cb, el('span', { text: o.label }));
    }
    if (o.type === 'number') {
      const inp = el('input', { class: 'input', type: 'number', min: o.min, max: o.max, value: val(perm, o), onchange: () => set(perm, o.key, +inp.value) });
      return el('label', { class: 'perm-opt perm-num' }, el('span', { text: o.label }), inp);
    }
    if (o.type === 'choice') {
      const sel = el('select', { class: 'input', onchange: () => set(perm, o.key, sel.value) }, o.choices.map((c) => el('option', { value: c, text: BAN_LABELS[c] || c, selected: c === val(perm, o) })));
      return el('label', { class: 'perm-opt perm-num' }, el('span', { text: o.label }), sel);
    }
    // list: chips to switch on and off
    const cur = new Set(val(perm, o));
    return el('div', { class: 'perm-opt' }, el('span', { text: o.label }),
      el('div', { class: 'perm-chips' }, o.choices.map((c) => {
        const chip = el('button', { class: 'badge-toggle' + (cur.has(c) ? ' on' : ''), text: TYPE_LABELS[c] || c, onclick: () => {
          if (cur.has(c)) cur.delete(c); else cur.add(c);
          chip.classList.toggle('on', cur.has(c));
          set(perm, o.key, o.choices.filter((x) => cur.has(x)));
        } });
        return chip;
      })));
  };
  const rows = data.permissions.map((p) => {
    const cb = el('input', { type: 'checkbox', checked: (u.perms || []).includes(p.id) });
    cb.dataset.perm = p.id;
    const more = (p.options || []).length ? el('div', { class: 'perm-opts' }, p.options.map((o) => control(p.id, o))) : null;
    const sync = () => { if (more) more.style.display = cb.checked ? '' : 'none'; };
    cb.addEventListener('change', sync);
    sync();
    return { cb, node: el('div', { class: 'perm-block' }, el('label', { class: 'perm-row' }, cb, el('span', { text: p.label })), more) };
  });
  modal({
    title: `Permissions for ${u.username}`,
    body: el('div', { class: 'perm-dialog' }, el('p', { class: 'small muted', text: 'Admins have every right. Give other players only what they need, and set exactly what each right allows.' }), rows.map((r) => r.node)),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: () => act(`/admin/users/${u.id}/perms`, { perms: rows.filter((r) => r.cb.checked).map((r) => r.cb.dataset.perm), permOpts: opts }, 'Permissions saved') }, { text: 'Cancel' }],
  });
}

// Shows a player's inventory; click an item to take it away.
async function takeItems(u) {
  const grid = el('div', { class: 'item-grid' }, spinner());
  const draw = async () => {
    const { items } = await api.get(`/users/${u.id}/inventory`);
    grid.replaceChildren(...(items.length ? items.map((it) => itemCard(it, { onClick: async () => {
      if (!confirm(`Take ${it.name} from ${u.username}?`)) return;
      await act(`/admin/users/${u.id}/items/remove`, { itemId: it.id }, `${it.name} taken from ${u.username}`);
      draw();
    } })) : [el('div', { class: 'empty', text: 'This player has no items.' })]));
  };
  modal({
    title: `Take items from ${u.username}`,
    width: 760,
    body: el('div', {}, el('p', { class: 'small muted', text: 'Click an item to take it away. It is also removed from the avatar.' }), el('div', { class: 'take-grid' }, grid)),
    buttons: [{ text: 'Take all items', cls: 'btn-red', onClick: async () => {
      if (!confirm(`Take ALL items from ${u.username}?`)) return false;
      await act(`/admin/users/${u.id}/items/remove`, { all: true }, `All items taken from ${u.username}`);
    } }, { text: 'Close' }],
  });
  draw();
}

function giveRobits(u) {
  const amount = el('input', { class: 'input', type: 'number', value: 1000, step: 100 });
  modal({
    title: `Robits for ${u.username}`,
    body: el('div', {}, el('label', { class: 'field' }, 'Amount (negative to take away)', amount),
      el('div', { class: 'row wrap' }, [100, 1000, 10000, 100000].map((n) => el('button', { class: 'btn btn-small', text: `+${fmtNum(n)}`, onclick: () => { amount.value = n; } })))),
    buttons: [{ text: 'Give', cls: 'btn-green', onClick: () => act(`/admin/users/${u.id}/robits`, { amount: +amount.value }, 'Done!') }, { text: 'Cancel' }],
  });
}

function ban(u) {
  if (u.banned) { unbanDialog(u); return; }
  const reason = el('input', { class: 'input', placeholder: 'Reason (optional)' });
  const duration = el('select', { class: 'input' },
    [['', 'Forever'], ['1h', '1 hour'], ['1d', '1 day'], ['3d', '3 days'], ['7d', '7 days'], ['30d', '30 days']].map(([v, t]) => el('option', { value: v, text: t })));
  const kind = el('select', { class: 'input' },
    el('option', { value: 'account', text: 'Account only' }),
    el('option', { value: 'device', text: 'Account + device and IP (no new accounts)' }));
  modal({
    title: `Ban ${u.username}?`,
    body: el('div', {}, el('p', { text: 'They will be logged out and kicked from any game.' }),
      el('label', { class: 'field' }, 'Type', kind),
      el('label', { class: 'field' }, 'Length', duration),
      el('label', { class: 'field' }, 'Reason', reason)),
    buttons: [{ text: 'Ban', cls: 'btn-red', onClick: () => act(`/admin/users/${u.id}/ban`, { banned: true, reason: reason.value, duration: duration.value, device: kind.value === 'device' }, `${u.username} was banned`) }, { text: 'Cancel' }],
  });
}

// Removing a ban: fully, or the ban becomes a mute / a trade ban for a while.
const RESTRICT_TIMES = [['1d', '1 day'], ['3d', '3 days'], ['7d', '7 days'], ['30d', '30 days'], ['365d', '1 year']];
function unbanDialog(u, after) {
  const kind = segBtns([['unban', 'Full unban'], ['mute', 'Unban + mute'], ['trade', 'Unban + no trades'], ['both', 'Unban + mute + no trades']], 'unban');
  const time = segBtns(RESTRICT_TIMES, '7d');
  const reason = el('input', { class: 'input', maxlength: 200, placeholder: 'Note for the player (optional)' });
  modal({
    title: `Remove ${u.username}'s ban`,
    width: 560,
    body: el('div', { class: 'quick-event' },
      el('p', { class: 'small muted', text: 'Partial unban: they can play again, but can\'t chat (mute) or can\'t trade until the time runs out.' }),
      el('div', { class: 'qe-step', text: 'How' }), kind,
      el('div', { class: 'qe-step', text: 'For how long (mute / no trades)' }), time, reason),
    buttons: [{ text: 'Remove the ban', cls: 'btn-green', onClick: async () => {
      try { await api.post(`/admin/users/${u.id}/soften`, { kind: kind.value, time: time.value, reason: reason.value }); toast(`${u.username} was unbanned`, 'success'); await load(); after && after(); } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}
// A mute or a trade ban without a ban.
function restrictDialog(u) {
  const kind = segBtns([['mute', 'Mute (no chat)'], ['trade', 'No trades'], ['both', 'Both'], ['upload', 'No uploads']], 'mute');
  const time = segBtns([['1h', '1 hour'], ...RESTRICT_TIMES, ['forever', 'Forever']], '1d');
  const reason = el('input', { class: 'input', maxlength: 200, placeholder: 'Reason (the player sees it)' });
  modal({
    title: `Restrict ${u.username}`,
    width: 560,
    body: el('div', { class: 'quick-event' }, el('div', { class: 'qe-step', text: 'What' }), kind, el('div', { class: 'qe-step', text: 'How long' }), time, reason),
    buttons: [
      { text: 'Restrict', cls: 'btn-red', onClick: async () => { try { await api.post(`/admin/users/${u.id}/restrict`, { kind: kind.value, time: time.value, reason: reason.value }); toast('Done', 'success'); } catch (e) { toast(e.message, 'error'); return false; } } },
      { text: 'Lift all restrictions', onClick: async () => { try { await api.post(`/admin/users/${u.id}/restrict`, { clear: true }); toast('Restrictions lifted', 'success'); } catch (e) { toast(e.message, 'error'); return false; } } },
      { text: 'Cancel' }],
  });
}

// ---------------------------------------------------------------- appeals
var appealStatus = 'open';
async function drawAppeals() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/appeals?status=' + appealStatus); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const c = navBtns.appeals && navBtns.appeals.querySelector('.adm-count');
  if (c) { c.textContent = r.open ? String(r.open) : ''; c.classList.toggle('on', !!r.open); }
  body.replaceChildren(
    el('div', { class: 'adm-filters' }, [['open', `Waiting (${r.open})`], ['accepted', 'Accepted'], ['denied', 'Denied']].map(([k, t]) => el('button', { class: 'adm-filter' + (k === appealStatus ? ' on' : ''), text: t, onclick: () => { appealStatus = k; drawAppeals(); } }))),
    r.appeals.length ? el('div', { class: 'appeal-list' }, r.appeals.map((a) => el('button', { class: 'appeal-card ' + a.status, onclick: () => openAppeal(a.id) },
      el('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, el('b', { class: 'no-i18n', text: a.user?.username || '?' }),
        a.chat.length ? el('span', { class: 'pill' + (a.waiting === 'staff' ? ' warn-pill' : ''), text: a.waiting === 'staff' ? `💬 new reply (${a.chat.length})` : `💬 waiting for the player (${a.chat.length})` }) : null,
        a.media ? el('span', { class: 'pill', text: a.mediaType.startsWith('video') ? '🎬 video' : '🖼 screenshot' }) : null, el('span', { class: 'muted small', text: timeAgo(a.created) })),
      el('div', { class: 'small' }, el('span', { class: 'muted', text: 'Ban: ' }), el('span', { class: 'no-i18n', text: a.ban.reason || 'no reason' })),
      el('div', { class: 'small' }, el('b', { text: a.reason })),
      el('div', { class: 'small muted no-i18n appeal-snippet', text: a.explanation }),
      a.outcome ? el('div', { class: 'small', text: `${a.outcome} · ${a.decidedBy}` }) : null)))
      : el('div', { class: 'empty', text: appealStatus === 'open' ? 'No appeals waiting. 🎉' : 'Nothing here.' }));
}
// The chat with the banned player: ask for details or proof before deciding.
const APPEAL_ASKS = [
  'Please send a screenshot or a video that shows what happened.',
  'Tell us more: when did it happen, in which game, and who else was there?',
  'Do you have proof that someone else used your account?',
  'Thanks! We are checking your proof now.',
];
function appealChatBox(a) {
  const log = el('div', { class: 'appeal-chat' });
  const draw = () => {
    log.replaceChildren(...(a.chat.length ? a.chat.map((m) => el('div', { class: 'appeal-msg ' + m.from },
      el('div', { class: 'small muted' }, el('b', { class: 'no-i18n', text: m.from === 'staff' ? m.name + ' (team)' : m.name }), ' · ' + timeAgo(m.time)),
      m.text ? el('div', { class: 'no-i18n', text: m.text }) : null,
      m.media ? (m.mediaType.startsWith('video') ? el('video', { src: `/api/admin/appeals/${a.id}/chat/${m.n}/media`, controls: true, class: 'appeal-media' })
        : el('a', { href: `/api/admin/appeals/${a.id}/chat/${m.n}/media`, target: '_blank' }, el('img', { src: `/api/admin/appeals/${a.id}/chat/${m.n}/media`, class: 'appeal-media', alt: 'proof' }))) : null))
      : [el('div', { class: 'muted small', text: 'No messages yet. Ask the player for details or proof: they see it the next time they try to log in.' })]));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  };
  draw();
  if (a.status !== 'open') return el('div', {}, el('div', { class: 'qe-step', text: 'Chat' }), log);
  const text = el('textarea', { class: 'input', rows: 2, maxlength: 1000, placeholder: 'Write to the player (the ban stays while you talk)' });
  const send = async () => {
    if (!text.value.trim()) return toast('Write a message.', 'error');
    try { const r = await api.post(`/admin/appeals/${a.id}/chat`, { text: text.value }); a.chat = r.appeal.chat; a.waiting = r.appeal.waiting; text.value = ''; draw(); toast('Sent', 'success'); } catch (e) { toast(e.message, 'error'); }
  };
  return el('div', {},
    el('div', { class: 'qe-step', text: 'Chat with the player' }), log,
    el('div', { class: 'promo-chosen', style: { margin: '6px 0' } }, APPEAL_ASKS.map((t) => el('button', { class: 'holder-chip', text: t, onclick: () => { text.value = tr(t); text.focus(); } }))),
    el('div', { class: 'row' }, text, el('button', { class: 'btn btn-primary', text: 'Send', onclick: send })));
}
async function openAppeal(id) {
  let r;
  try { r = await api.get('/admin/appeals/' + id); } catch (e) { toast(e.message, 'error'); return; }
  const a = r.appeal;
  const decision = segBtns([['deny', 'Deny (ban stays)'], ['unban', 'Full unban'], ['mute', 'Unban + mute'], ['trade', 'Unban + no trades'], ['both', 'Unban + both']], 'deny');
  const time = segBtns(RESTRICT_TIMES, '7d');
  const answer = el('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: 'Answer to the player (they see it when they try to log in)' });
  const media = a.media ? (a.mediaType.startsWith('video') ? el('video', { src: `/api/admin/appeals/${a.id}/media`, controls: true, class: 'appeal-media' }) : el('a', { href: `/api/admin/appeals/${a.id}/media`, target: '_blank' }, el('img', { src: `/api/admin/appeals/${a.id}/media`, class: 'appeal-media', alt: 'screenshot' }))) : el('div', { class: 'muted small', text: 'No screenshot or video.' });
  modal({
    title: `Appeal #${a.id} · ${a.user?.username || '?'}`,
    width: 720,
    body: el('div', { class: 'quick-event' },
      el('div', { class: 'appeal-ban on' }, el('b', { class: 'no-i18n', text: a.ban.reason || 'No reason given' }), el('span', { class: 'small muted', text: `${a.ban.time ? new Date(a.ban.time).toLocaleString() : ''}${a.ban.until ? ' · until ' + new Date(a.ban.until).toLocaleString() : ' · forever'}` })),
      el('div', { class: 'qe-step', text: a.reason }),
      el('p', { class: 'no-i18n', style: { whiteSpace: 'pre-wrap' }, text: a.explanation }),
      media,
      a.status === 'open' || a.chat.length ? appealChatBox(a) : null,
      r.history.length > 1 ? el('details', {}, el('summary', { text: `Ban history (${r.history.length})` }), r.history.map((h) => el('div', { class: 'small' }, el('span', { class: 'no-i18n', text: `${new Date(h.time).toLocaleDateString()} · ${h.reason || 'no reason'}${h.by ? ' · by ' + h.by : ''}${h.endedHow ? ' · ' + h.endedHow : ''}` })))) : null,
      a.status === 'open' ? el('div', { class: 'quick-event' }, el('div', { class: 'qe-step', text: 'Decision' }), decision, el('div', { class: 'qe-step', text: 'Mute / no trades for' }), time, answer)
        : el('div', { class: 'small' }, el('b', { text: a.outcome }), a.answer ? el('div', { class: 'no-i18n', text: '“' + a.answer + '”' }) : null)),
    buttons: a.status === 'open' ? [{ text: 'Answer', cls: 'btn-primary', onClick: async () => {
      try { await api.post('/admin/appeals/' + a.id, { decision: decision.value, time: time.value, answer: answer.value }); toast('Answered', 'success'); drawAppeals(); load(); } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Close' }] : [{ text: 'Close' }],
  });
}

// ---------------------------------------------------------------- games
async function drawGames() {
  body.replaceChildren(spinner());
  const { games } = await api.get('/admin/games');
  const q = el('input', { class: 'input', placeholder: 'Search games' });
  const rows = el('div');
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const shown = games.filter((g) => !s || g.name.toLowerCase().includes(s) || (g.creator?.username || '').toLowerCase().includes(s));
    rows.replaceChildren(...(shown.length ? shown.map((g) => el('div', { class: 'admin-row' },
      el('div', { class: 'admin-info' },
        el('div', {}, el('a', { href: `/game?id=${g.id}` }, el('b', { class: 'no-i18n', text: g.name })),
          g.featured ? el('span', { class: 'pill perm-pill', text: 'Featured' }) : null,
          g.isPublic ? null : el('span', { class: 'pill', text: 'Private' })),
        el('div', { class: 'small muted' }, 'By ', g.creator ? el('a', { class: 'no-i18n', href: `/profile?id=${g.creator.id}`, text: g.creator.username }) : 'Robis',
          ` · ${fmtFull(g.visits)} visits · ${g.playing} playing · updated ${timeAgo(g.updated)}`)),
      el('div', { class: 'admin-actions' },
        perm('games') ? el('button', { class: 'btn btn-small', text: g.featured ? 'Unfeature' : 'Feature', onclick: async () => {
          try { await api.post(`/games/${g.id}/feature`, { featured: !g.featured }); g.featured = !g.featured; draw(); } catch (e) { toast(e.message, 'error'); }
        } }) : null,
        perm('moderator') ? el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: async () => {
          if (!confirm(`Delete the game ${g.name}? This can't be undone.`)) return;
          try { await api.post(`/admin/games/${g.id}/delete`); games.splice(games.indexOf(g), 1); draw(); toast('Game deleted', 'success'); } catch (e) { toast(e.message, 'error'); }
        } }) : null))) : [el('div', { class: 'empty', text: 'No games found.' })]));
  };
  q.addEventListener('input', draw);
  body.replaceChildren(el('div', { class: 'row', style: { marginBottom: '12px' } }, q), rows);
  draw();
}

// ---------------------------------------------------------------- items
async function drawItems() {
  body.replaceChildren(spinner());
  const { items } = await api.get('/admin/items');
  body.replaceChildren(
    el('p', { class: 'small muted', text: 'Limited items and items made by players. Open an item to change its Limited settings or see its owners.' }),
    items.length ? el('div', { class: 'admin-items' }, items.map((it) => el('div', { class: 'admin-item' },
      itemCard(it),
      el('div', { class: 'small muted' },
        it.limited ? el('div', { text: it.remaining === 0 ? 'Sold out' : `${fmtFull(it.remaining ?? 0)} left` }) : null,
        el('div', { text: `${fmtFull(it.owners)} owners · ${fmtFull(it.listings)} for sale` })),
      it.custom && perm('moderator') ? el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: async () => {
        if (!confirm(`Delete ${it.name}? Everyone who owns it will lose it.`)) return;
        try { await api.del(`/catalog/${it.id}`); toast('Item deleted', 'success'); drawItems(); } catch (e) { toast(e.message, 'error'); }
      } }) : null)))
      : el('div', { class: 'empty', text: 'No items yet.' }));
}

// ---------------------------------------------------------------- log
async function drawLog() {
  body.replaceChildren(spinner());
  const { log } = await api.get('/admin/log');
  const q = el('input', { class: 'input', placeholder: 'Filter by player or action' });
  const rows = el('div');
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const shown = log.filter((e) => !s || `${e.byName} ${e.action} ${e.targetName}`.toLowerCase().includes(s));
    rows.replaceChildren(...(shown.length ? shown.map((e) => el('div', { class: 'log-row' },
      el('span', { class: 'muted small log-time', text: new Date(e.time).toLocaleString() }),
      el('span', { class: 'log-text' },
        el('b', { class: 'no-i18n', text: e.byName }), ' → ',
        e.targetId ? el('a', { class: 'no-i18n', href: `/profile?id=${e.targetId}`, text: e.targetName }) : el('span', { class: 'no-i18n', text: e.targetName || '—' }),
        ': ', el('span', { text: e.action }))))
      : [el('div', { class: 'empty', text: 'Nothing here yet.' })]));
  };
  q.addEventListener('input', draw);
  body.replaceChildren(el('div', { class: 'row', style: { marginBottom: '12px' } }, q), rows);
  draw();
}

await load();

const style = document.createElement('style');
style.textContent = `
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-grid .panel + .panel { margin-top: 0; }
.stat { text-align: center; padding: 12px 8px; }
.stat .value { font-size: 24px; font-weight: 700; }
.stat .label { font-size: 13px; color: var(--text-light); }
.admin-body { min-height: 200px; }
.admin-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.admin-row:last-child { border-bottom: 0; }
.admin-row.banned { opacity: .6; }
.admin-head { width: 48px; height: 48px; border-radius: 50%; background: #d4d4d4; flex: none; position: relative; }
.admin-head img { width: 100%; height: 100%; border-radius: 50%; }
.admin-head .presence-dot { position: absolute; right: -2px; bottom: -2px; }
.admin-head.big { width: 96px; height: 96px; }
.admin-info { flex: 1; min-width: 180px; }
.admin-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.admin-pill { background: var(--blue); color: #fff; margin-left: 6px; }
.ban-pill { background: #d0021b; color: #fff; margin-left: 6px; }
.perm-pill { background: #6b327c; color: #fff; margin-left: 6px; }
.online-text { color: #02b757; }
.perm-row { display: flex; gap: 10px; align-items: center; padding: 6px 0; cursor: pointer; }
.row .input { flex: 1; min-width: 160px; }
.manage-top { display: flex; gap: 16px; align-items: center; margin-bottom: 14px; }
.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-bottom: 8px; }
.fact { background: var(--bg, #f2f4f5); border-radius: 4px; padding: 6px 8px; display: flex; flex-direction: column; font-size: 13px; }
html[data-theme="dark"] .fact { background: #2b2d2f; }
.manage-section { margin-top: 12px; }
.manage-section h4, .manage-cols h4 { margin: 0 0 6px; }
.manage-section select.input { padding: 4px 6px; font-size: 13px; flex: 0 0 auto; min-width: 0; }
.manage-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.mini-list { max-height: 220px; overflow-y: auto; font-size: 13px; }
.mini-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border); align-items: baseline; }
.mini-text { flex: 1; }
.mini-amount { font-weight: 700; min-width: 56px; }
.mini-amount.plus { color: #02b757; } .mini-amount.minus { color: #d0021b; }
.pw-box { margin-top: 10px; padding: 10px; border-radius: 4px; background: #e8f6ee; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
html[data-theme="dark"] .pw-box { background: #1f3a2a; }
.new-password { font-size: 20px; font-weight: 700; letter-spacing: 1px; user-select: all; }
.admin-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.admin-item { display: flex; flex-direction: column; gap: 6px; }
.log-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; font-size: 14px; }
.log-time { min-width: 150px; }
.log-text { flex: 1; }
@media (max-width: 700px) { .manage-cols { grid-template-columns: 1fr; } .manage-top { flex-direction: column; align-items: flex-start; } }
`;
document.head.append(style);

// ---------------------------------------------------------------- shared bits for the new sections
const usersList = () => el('datalist', { id: 'admin-usernames-all' }, (data?.users || []).map((u) => el('option', { value: u.username })));
const whoInput = (placeholder = 'Player name, "online" or "all"') => el('input', { class: 'input', placeholder, list: 'admin-usernames-all', autocomplete: 'off' });
const card = (title, sub, ...kids) => el('div', { class: 'adm-card' }, el('div', { class: 'adm-card-head' }, el('b', { text: title }), sub ? el('span', { class: 'muted small', text: sub }) : null), ...kids);
const segBtns = (opts, val, onChange) => {
  const box = el('div', { class: 'qe-seg' });
  box.value = val;
  const draw = () => box.replaceChildren(...opts.map(([v, t]) => el('button', { type: 'button', class: String(v) === String(box.value) ? 'on' : '', text: t, onclick: () => { box.value = v; draw(); onChange && onChange(v); } })));
  draw();
  box.set = (v) => { box.value = v; draw(); };
  return box;
};

// ---------------------------------------------------------------- Daily Spin
// The wheel's prizes and chances (with a live preview), boosts, free spins,
// "next prize" for a player, numbers and the latest spins.
async function drawSpin() {
  body.replaceChildren(spinner());
  let s;
  try { s = await api.get('/admin/spin'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const { wheelEl } = await import('../fun.js');
  const cfg = s.config;
  const segs = cfg.segments.map((x) => ({ ...x }));
  const itemNames = { ...s.items };
  const post = async (b, msg) => {
    try { const r = await api.post('/admin/spin', b); toast(msg + (r.players ? ` (${r.players})` : ''), 'success'); drawSpin(); } catch (e) { toast(e.message, 'error'); }
  };

  // ---- the wheel editor
  const preview = el('div', { class: 'spin-wrap adm-spin-preview' });
  const rows = el('div', { class: 'spin-rows' });
  const drawPreview = () => preview.replaceChildren(el('div', { class: 'spin-pointer' }), wheelEl(segs), el('div', { class: 'spin-hub' }));
  const drawRows = () => {
    const total = segs.reduce((n, x) => n + (+x.w || 0), 0) || 1;
    rows.replaceChildren(el('div', { class: 'spin-row head' }, el('span', { text: '' }), el('span', { text: 'On the wheel' }), el('span', { text: 'Robits' }), el('span', { text: 'Item' }), el('span', { text: 'Weight' }), el('span', { text: 'Chance' }), el('span', { text: '' })),
      ...segs.map((x, i) => {
        const upd = (k, v) => { x[k] = v; drawPreview(); if (k === 'w') drawRows(); };
        return el('div', { class: 'spin-row' },
          el('input', { type: 'color', value: x.color, oninput: (e) => upd('color', e.target.value) }),
          el('input', { class: 'input', maxlength: 24, value: x.label, oninput: (e) => upd('label', e.target.value) }),
          el('input', { class: 'input', type: 'number', min: 0, value: x.robits || 0, oninput: (e) => upd('robits', +e.target.value) }),
          el('button', { class: 'btn btn-small spin-item', text: x.item ? (itemNames[x.item]?.name || `#${x.item}`) : '+ Item', onclick: () => itemPicker({ title: 'Prize item', multi: false, button: 'Pick', onPick: ([it]) => { x.item = it.id; itemNames[it.id] = it; if (!x.label || x.label.startsWith('R$')) x.label = it.name.slice(0, 24); drawPreview(); drawRows(); } }) },
          ),
          el('input', { class: 'input', type: 'number', min: 0.1, step: 0.1, value: x.w, oninput: (e) => upd('w', +e.target.value), onchange: drawRows }),
          el('span', { class: 'spin-chance', text: ((x.w / total) * 100).toFixed(1) + '%' }),
          el('div', { class: 'row', style: { gap: '4px', justifyContent: 'flex-end' } },
            x.item ? el('button', { class: 'btn btn-small', title: 'Remove the item', text: '⨯ item', onclick: () => { x.item = 0; drawRows(); } }) : null,
            el('label', { class: 'small', title: 'Jackpot: extra confetti' }, el('input', { type: 'checkbox', checked: !!x.jackpot, onchange: (e) => { x.jackpot = e.target.checked; } }), '★'),
            el('button', { class: 'btn btn-small btn-red', text: '×', title: 'Remove', onclick: () => { if (segs.length <= 2) return toast('The wheel needs at least 2 prizes.', 'error'); segs.splice(i, 1); drawPreview(); drawRows(); } })));
      }));
  };
  drawPreview();
  drawRows();
  const streakBonus = el('input', { class: 'input', type: 'number', min: 0, max: 1000, value: cfg.streakBonus ?? 10, style: { width: '90px' } });
  const maxStreak = el('input', { class: 'input', type: 'number', min: 1, max: 30, value: cfg.maxStreak ?? 7, style: { width: '90px' } });
  const save = () => post({ op: 'save', on: cfg.on, segments: segs, streakBonus: +streakBonus.value, maxStreak: +maxStreak.value }, 'The wheel is saved');

  // ---- boost
  const mult = segBtns([[2, 'x2'], [3, 'x3'], [5, 'x5'], [10, 'x10']], 2);
  const hours = segBtns([[1, '1 hour'], [3, '3 hours'], [24, '1 day'], [72, '3 days']], 3);
  const boostCard = card('Boost', s.boost ? `x${s.boost.mult} until ${new Date(s.boost.until).toLocaleString()}` : 'All Robits prizes are bigger for a while',
    mult, hours,
    el('div', { class: 'row', style: { gap: '6px' } },
      el('button', { class: 'btn btn-primary', text: s.boost ? 'Change boost' : 'Start boost', onclick: () => post({ op: 'boost', mult: +mult.value, hours: +hours.value }, 'Boost started') }),
      s.boost ? el('button', { class: 'btn', text: 'Stop', onclick: () => post({ op: 'boost', mult: 1, hours: 0 }, 'Boost stopped') }) : null));

  // ---- players
  const who = whoInput();
  const count = el('input', { class: 'input', type: 'number', min: 1, max: 10, value: 1, style: { width: '70px' } });
  const rigWho = whoInput('Player name');
  const rigSeg = el('select', { class: 'input', style: { width: 'auto' } }, el('option', { value: '', text: 'Random (as usual)' }), cfg.segments.map((x, i) => el('option', { value: i, text: x.label })));
  const playersCard = card('Players', 'Free spins work even if they already spun today',
    el('div', { class: 'row wrap', style: { gap: '6px' } }, who, count,
      el('button', { class: 'btn btn-green', text: '🎟 Give free spins', onclick: () => post({ op: 'give', target: who.value, count: +count.value }, 'Free spins given') }),
      el('button', { class: 'btn', text: '↺ Let spin again today', onclick: () => post({ op: 'reset', target: who.value }, 'They can spin again') })),
    el('div', { class: 'adm-sub', text: 'Next prize for a player (a surprise!)' }),
    el('div', { class: 'row wrap', style: { gap: '6px' } }, rigWho, rigSeg,
      el('button', { class: 'btn btn-primary', text: 'Set', onclick: () => post({ op: 'rig', target: rigWho.value, index: rigSeg.value === '' ? null : +rigSeg.value }, 'Next prize set') })),
    s.rigged.length ? el('div', { class: 'small muted' }, s.rigged.map((r) => el('div', { class: 'no-i18n', text: `${r.username} → ${cfg.segments[r.index]?.label || '?'}` }))) : null);

  const t = s.stats.today;
  const tile = (label, value, cls = '') => el('div', { class: 'dash-tile ' + cls }, el('div', { class: 'dash-value', text: String(value) }), el('div', { class: 'dash-label', text: label }));
  body.replaceChildren(usersList(),
    el('div', { class: 'adm-hero spin' },
      el('div', {}, el('h2', { text: '🎡 Daily Spin' }), el('p', { text: cfg.on ? 'The wheel is on: every player can spin once a day.' : 'The wheel is off: players can\'t spin.' })),
      el('label', { class: 'adm-switch' }, el('input', { type: 'checkbox', checked: cfg.on, onchange: (e) => post({ op: 'toggle', on: e.target.checked }, e.target.checked ? 'The wheel is on' : 'The wheel is off') }), el('span', {}), el('b', { text: cfg.on ? 'ON' : 'OFF' }))),
    el('div', { class: 'dash-tiles' }, tile('Spins today', t.spins, 'blue'), tile('Robits paid today', fmtNum(t.paid), 'green'), tile('Items won today', t.items), tile('Jackpots today', t.jackpots, t.jackpots ? 'orange' : '')),
    el('div', { class: 'adm-spin-editor' },
      el('div', { class: 'adm-spin-left' }, preview, el('p', { class: 'small muted', text: 'The preview changes as you edit. Weight = how likely, compared with the others.' })),
      el('div', { class: 'adm-spin-right' }, rows,
        el('div', { class: 'row wrap', style: { gap: '8px', marginTop: '10px', alignItems: 'center' } },
          el('button', { class: 'btn', text: '+ Add prize', onclick: () => { if (segs.length >= 12) return toast('12 prizes at most.', 'error'); segs.push({ label: 'R$ 75', robits: 75, item: 0, color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'), w: 10 }); drawPreview(); drawRows(); } }),
          el('label', { class: 'small' }, 'Streak bonus R$/day ', streakBonus),
          el('label', { class: 'small' }, 'Max streak days ', maxStreak),
          el('button', { class: 'btn btn-green', text: 'Save the wheel', onclick: save })))),
    el('div', { class: 'adm-cards' }, boostCard, playersCard),
    s.stats.days.length > 1 ? el('div', { class: 'dash-charts' }, dayChart('Spins', s.stats.days, 'spins'), dayChart('Robits paid', s.stats.days, 'paid')) : null,
    card('Latest spins', null, s.recent.length ? el('div', { class: 'mini-list' }, s.recent.map((r) => el('div', { class: 'mini-row' },
      el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: r.username }), ' · ', el('span', { class: 'no-i18n', text: r.prize })), el('span', { class: 'muted small', text: timeAgo(r.t) })))) : el('div', { class: 'muted small', text: 'Nobody has spun yet.' })));
}

// ---------------------------------------------------------------- Live Events
// Robits rain, a party on every open page, decorations on the site.
async function drawLiveEvents() {
  body.replaceChildren(spinner());
  let f;
  try { f = await api.get('/admin/fun'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => {
    try { const r = await api.post('/admin/fun', b); toast(msg + (r.players ? ` (${r.players} players)` : ''), 'success'); drawLiveEvents(); } catch (e) { toast(e.message, 'error'); }
  };
  const amount = segBtns([[10, 'R$ 10'], [25, 'R$ 25'], [50, 'R$ 50'], [100, 'R$ 100'], [500, 'R$ 500']], 25);
  const custom = el('input', { class: 'input', type: 'number', min: 1, max: 10000, placeholder: 'or any', style: { width: '100px' } });
  const who = segBtns([['online', `Everyone online (${f.online})`], ['all', `Everyone (${f.players})`]], 'online');
  const rainText = el('input', { class: 'input', maxlength: 120, placeholder: 'Message (optional), e.g. "Thanks for playing!"' });
  const partyText = el('input', { class: 'input', maxlength: 120, placeholder: 'e.g. 1000 players! Party time!' });
  const emoji = segBtns([['', 'Confetti'], ['🎂', '🎂'], ['🎈', '🎈'], ['🔥', '🔥'], ['💎', '💎'], ['🟥', 'Bricks']], '');
  const DEC = { none: ['Off', '🚫'], snow: ['Snow', '❄️'], halloween: ['Halloween', '🎃'], hearts: ['Hearts', '💖'], confetti: ['Confetti', '🎉'], leaves: ['Autumn', '🍂'], stars: ['Stars', '✨'] };
  const decHours = segBtns([[0, 'Until turned off'], [24, '1 day'], [72, '3 days'], [168, '1 week']], 0);
  const now = f.decor.name !== 'none' && (!f.decor.until || f.decor.until > Date.now()) ? f.decor.name : 'none';
  body.replaceChildren(
    el('div', { class: 'adm-hero live' }, el('div', {}, el('h2', { text: '✨ Live Events' }), el('p', { text: `Make something happen for everyone right now. ${f.online} players online.` }))),
    el('div', { class: 'adm-cards' },
      card('💰 Robits rain', 'Everyone gets Robits and sees them rain on the screen',
        amount, custom, who, rainText,
        el('button', { class: 'btn btn-green', text: 'Make it rain!', onclick: () => {
          const n = +custom.value || +amount.value;
          if (!confirm(`Give R$ ${n} to ${who.value === 'all' ? 'every player' : 'every player online'}?`)) return;
          post({ op: 'rain', amount: n, target: who.value, text: rainText.value }, 'It\'s raining Robits!');
        } })),
      card('🎉 Party', 'Confetti and a big message on every open page', partyText, emoji,
        el('button', { class: 'btn btn-primary', text: 'Start the party', onclick: () => post({ op: 'party', text: partyText.value, emoji: emoji.value }, 'Party started!') })),
      card('🎄 Site decorations', now === 'none' ? 'Nothing is falling now' : `Now: ${DEC[now][0]}${f.decor.until ? ' until ' + new Date(f.decor.until).toLocaleString() : ''}`,
        el('div', { class: 'decor-pick' }, Object.entries(DEC).map(([k, [name, icon]]) => el('button', { class: 'decor-opt' + (k === now ? ' on' : ''), onclick: () => post({ op: 'decor', decor: k, hours: +decHours.value }, k === 'none' ? 'Decorations off' : `${name} on the site!`) },
          el('span', { class: 'decor-icon', text: icon }), el('span', { text: name })))),
        decHours)),
    card('History', 'The last 10 minutes', f.events.length ? el('div', { class: 'mini-list' }, f.events.map((e) => el('div', { class: 'mini-row' },
      el('span', { class: 'mini-text' }, el('b', { text: e.type === 'rain' ? `💰 R$ ${e.amount}` : '🎉 Party' }), e.text ? el('span', { class: 'no-i18n', text: ' · ' + e.text }) : null, e.players !== null ? el('span', { class: 'muted', text: ` · ${e.players} players` }) : null),
      el('span', { class: 'muted small no-i18n', text: `${e.by} · ${timeAgo(e.created)}` })))) : el('div', { class: 'muted small', text: 'Nothing yet.' })));
}

// ---------------------------------------------------------------- Polls
async function drawPolls() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/polls'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { await api.post('/admin/polls', b); toast(msg, 'success'); drawPolls(); } catch (e) { toast(e.message, 'error'); } };
  const q = el('input', { class: 'input', maxlength: 140, placeholder: 'Question, e.g. "What should the next event be?"' });
  const opts = el('div', { class: 'poll-edit' });
  const addOpt = (v = '') => { if (opts.children.length < 6) opts.append(el('input', { class: 'input', maxlength: 60, value: v, placeholder: `Answer ${opts.children.length + 1}` })); };
  addOpt(); addOpt();
  const hours = segBtns([[0, 'No end'], [24, '1 day'], [72, '3 days'], [168, '1 week']], 72);
  const IDEAS = [['What should the next The Hunt be?', ['Frost Festival ❄️', 'Haunted Night 🎃', 'Candy Kingdom 🍭', 'Sunken City 🌊']], ['Best game on Robis?', ['DOORS', 'Natural Disaster', 'Murder Mystery 2', 'Tower']], ['What should we add next?', ['New games', 'New items', 'New events', 'More Robits!']]];
  body.replaceChildren(
    el('div', { class: 'adm-hero polls' }, el('div', {}, el('h2', { text: '📊 Polls' }), el('p', { text: 'Ask the players. Polls show on the home page; players see the results after voting.' }))),
    card('New poll', null, q, opts,
      el('div', { class: 'row wrap', style: { gap: '6px' } }, el('button', { class: 'btn btn-small', text: '+ Answer', onclick: () => addOpt() }),
        el('span', { class: 'small muted', text: 'Ideas:' }), IDEAS.map(([qq, oo]) => el('button', { class: 'btn btn-small', text: qq, onclick: () => { q.value = qq; opts.replaceChildren(); oo.forEach(addOpt); } }))),
      hours,
      el('button', { class: 'btn btn-green', text: 'Post the poll', onclick: () => post({ op: 'create', question: q.value, options: [...opts.children].map((i) => i.value), hours: +hours.value }, 'Poll posted') })),
    ...r.polls.map((p) => {
      const max = Math.max(1, ...p.counts);
      return card(p.question, `${p.total} votes · ${p.closed ? 'closed' : p.ends ? 'ends ' + new Date(p.ends).toLocaleString() : 'open'} · by ${p.by}`,
        el('div', { class: 'poll-options' }, p.options.map((o, i) => el('div', { class: 'poll-result' + (p.counts[i] === max && p.total ? ' top' : '') },
          el('div', { class: 'poll-fill', style: { width: (p.total ? Math.round((p.counts[i] / p.total) * 100) : 0) + '%' } }),
          el('span', { class: 'no-i18n', text: o }), el('b', { text: `${p.counts[i]} · ${p.total ? Math.round((p.counts[i] / p.total) * 100) : 0}%` })))),
        el('div', { class: 'row', style: { gap: '6px' } },
          p.closed ? null : el('button', { class: 'btn btn-small', text: 'Close', onclick: () => post({ op: 'close', id: p.id }, 'Poll closed') }),
          el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: () => { if (confirm('Delete this poll?')) post({ op: 'delete', id: p.id }, 'Deleted'); } })));
    }));
}

// ---------------------------------------------------------------- Console
// Commands for everything, fast: "give Bob 500", "rain 50", "decor snow"...
const CMDS = [
  ['help', 'all commands'],
  ['robits <player> <amount>', 'give (or take, with -) Robits'],
  ['item <player> <item id>', 'give an item'],
  ['kick <player> [reason]', 'kick from their game'],
  ['warn <player> <reason>', 'send a warning'],
  ['spin <player|online|all> [n]', 'give free spins'],
  ['spinreset <player|online|all>', 'let them spin again today'],
  ['boost <x> <hours>', 'Daily Spin boost (boost 1 0 = off)'],
  ['rain <amount> [all]', 'Robits rain for everyone online (or all)'],
  ['party [message]', 'confetti and a message on every page'],
  ['decor <none|snow|halloween|hearts|confetti|leaves|stars> [hours]', 'site decorations'],
  ['announce <text>', 'the announcement bar ("announce" alone removes it)'],
  ['poll <question> | <answer> | <answer>...', 'post a poll'],
  ['find <name>', 'open a player'],
  ['clear', 'clear the console'],
];
var consoleLines = [];
function drawConsole() {
  const out = el('div', { class: 'adm-console-out' });
  const print = (text, cls = '') => { consoleLines.push([text, cls]); consoleLines = consoleLines.slice(-200); out.append(el('div', { class: 'cline ' + cls, text })); out.scrollTop = out.scrollHeight; };
  for (const [t, c] of consoleLines) out.append(el('div', { class: 'cline ' + c, text: t }));
  const input = el('input', { class: 'adm-console-in', placeholder: 'Type a command, e.g. help', autocomplete: 'off', spellcheck: false });
  const history = [];
  let hi = 0;
  const userBy = (name) => (data?.users || []).find((u) => u.username.toLowerCase() === String(name || '').toLowerCase() || String(u.id) === String(name));
  const need = (name) => { const u = userBy(name); if (!u) throw new Error(`No player "${name}".`); return u; };
  const run = async (line) => {
    const [cmd, ...a] = line.trim().split(/\s+/);
    const rest = line.trim().slice(cmd.length).trim();
    switch ((cmd || '').toLowerCase()) {
      case 'help': CMDS.forEach(([c, d]) => print(`${c.padEnd(44)} ${d}`, 'muted')); return;
      case 'clear': consoleLines = []; out.replaceChildren(); return;
      case 'robits': { const u = need(a[0]); await api.post(`/admin/users/${u.id}/robits`, { amount: +a[1] }); return print(`✓ ${u.username}: ${+a[1] > 0 ? '+' : ''}${+a[1]} Robits`, 'ok'); }
      case 'item': { const u = need(a[0]); await api.post(`/admin/users/${u.id}/items`, { itemId: +a[1] }); return print(`✓ Gave item #${+a[1]} to ${u.username}`, 'ok'); }
      case 'kick': { const u = need(a[0]); await api.post(`/admin/users/${u.id}/kick`, { reason: a.slice(1).join(' ') }); return print(`✓ Kicked ${u.username}`, 'ok'); }
      case 'warn': { const u = need(a[0]); await api.post(`/admin/users/${u.id}/warn`, { reason: a.slice(1).join(' ') }); return print(`✓ Warned ${u.username}`, 'ok'); }
      case 'spin': { const r = await api.post('/admin/spin', { op: 'give', target: a[0], count: +a[1] || 1 }); return print(`✓ Free spins for ${r.players} player(s)`, 'ok'); }
      case 'spinreset': { const r = await api.post('/admin/spin', { op: 'reset', target: a[0] }); return print(`✓ ${r.players} player(s) can spin again`, 'ok'); }
      case 'boost': await api.post('/admin/spin', { op: 'boost', mult: +a[0], hours: +a[1] }); return print(+a[0] > 1 && +a[1] ? `✓ x${+a[0]} boost for ${+a[1]}h` : '✓ Boost off', 'ok');
      case 'rain': { const r = await api.post('/admin/fun', { op: 'rain', amount: +a[0], target: a[1] === 'all' ? 'all' : 'online' }); return print(`✓ R$ ${+a[0]} rained on ${r.players} player(s)`, 'ok'); }
      case 'party': await api.post('/admin/fun', { op: 'party', text: rest }); return print('✓ Party started', 'ok');
      case 'decor': await api.post('/admin/fun', { op: 'decor', decor: a[0], hours: +a[1] || 0 }); return print(`✓ Decorations: ${a[0]}`, 'ok');
      case 'announce': await api.post('/admin/announcement', { text: rest, color: 'blue' }); return print(rest ? '✓ Announcement posted' : '✓ Announcement removed', 'ok');
      case 'poll': { const [qq, ...oo] = rest.split('|').map((x) => x.trim()); await api.post('/admin/polls', { op: 'create', question: qq, options: oo, hours: 72 }); return print('✓ Poll posted', 'ok'); }
      case 'find': { const u = need(rest); manage(u); return print(`→ ${u.username}`, 'muted'); }
      default: throw new Error(`Unknown command "${cmd}". Type help.`);
    }
  };
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowUp') { if (hi > 0) input.value = history[--hi]; e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { input.value = hi < history.length - 1 ? history[++hi] : (hi = history.length, ''); e.preventDefault(); return; }
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const line = input.value;
    history.push(line); hi = history.length;
    input.value = '';
    print('> ' + line, 'cmd');
    try { await run(line); } catch (err) { print('✗ ' + (err.message || err), 'err'); }
  });
  if (!consoleLines.length) print('Robis admin console. Type help for the commands. ↑ = last command.', 'muted');
  body.replaceChildren(el('div', { class: 'adm-console', onclick: () => input.focus() }, out, el('div', { class: 'adm-console-row' }, el('span', { text: '>' }), input)),
    el('div', { class: 'adm-cmds' }, CMDS.map(([c, d]) => el('button', { class: 'adm-cmd', title: d, onclick: () => { input.value = c.split(' ')[0] + ' '; input.focus(); } }, el('code', { text: c }), el('span', { class: 'muted small', text: d })))));
  setTimeout(() => input.focus(), 50);
}

// ---------------------------------------------------------------- Admin Abuse
// Like the big games do: pick a game (Crossroads!), everyone on the site sees a
// banner with Join, and in the game you are a giant admin with a crown. Global
// messages, effects for everyone, coin rain, fireworks, meteors, Robits.
const ABUSE_FX = {
  giant: ['🗿', 'Me: GIANT', 'You are 4 times bigger, with a crown'],
  bigAll: ['🦍', 'Everyone big', 'All players twice as big'],
  tiny: ['🐜', 'Everyone tiny', 'All players half size'],
  speed: ['⚡', 'Super speed', 'Everyone runs fast'],
  jump: ['🦘', 'Mega jump', 'Everyone jumps high'],
  fly: ['🕊️', 'Everyone flies', 'Space - up, Q - down'],
  lowgrav: ['🌙', 'Low gravity', 'Floaty jumps for everyone'],
  disco: ['🪩', 'Disco', 'Night and party lights'],
  night: ['🌃', 'Night', 'Make it night'],
};
const ABUSE_ONCE = { coinrain: ['🪙', 'Coin rain'], fireworks: ['🎆', 'Fireworks'], meteors: ['☄️', 'Meteors'], bring: ['🧲', 'Bring everyone to me'] };
var abuseTimer = 0; // var: the page can open on this section before the module has finished loading
async function drawAbuse() {
  clearInterval(abuseTimer);
  let r;
  try { r = await api.get('/admin/abuse'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => {
    try { const x = await api.post('/admin/abuse', b); if (msg) toast(msg + (x.players ? ` (${x.players})` : ''), 'success'); drawAbuse(); } catch (e) { toast(e.message, 'error'); }
  };
  const { launchGame } = await import('../ui.js');
  const a = r.abuse;
  if (!a) {
    let gameId = r.games[0]?.id;
    const grid = el('div', { class: 'abuse-games' });
    const drawGames = () => grid.replaceChildren(...r.games.map((g) => el('button', { class: 'abuse-game' + (g.id === gameId ? ' on' : ''), onclick: () => { gameId = g.id; drawGames(); } },
      el('b', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: g.playing ? `${g.playing} playing` : 'empty' }))));
    drawGames();
    const minutes = segBtns([[0, 'Until I end it'], [15, '15 min'], [30, '30 min'], [60, '1 hour']], 30);
    const text = el('input', { class: 'input', maxlength: 120, placeholder: 'Banner text (optional), e.g. "Free Robits! Come quick!"' });
    body.replaceChildren(
      el('div', { class: 'adm-hero abuse' }, el('div', {}, el('h2', { text: '🔥 Admin Abuse' }), el('p', { text: 'Show up in a game as a giant admin. Everyone on the site gets a banner with a Join button.' }))),
      card('1. The game', 'Crossroads is the classic place for it', grid),
      card('2. How long', null, minutes),
      card('3. Go!', null, text,
        el('button', { class: 'btn abuse-start', text: '🔥 START ADMIN ABUSE', onclick: () => post({ op: 'start', gameId, minutes: +minutes.value, text: text.value }, 'Admin Abuse started! Join the game.') })));
    return;
  }
  const left = a.ends ? Math.max(0, Math.round((a.ends - Date.now()) / 60e3)) : null;
  const msg = el('input', { class: 'input', maxlength: 120, placeholder: 'Global message, e.g. "Everyone to the tower!"' });
  const color = segBtns([['#ffd23b', '🟡'], ['#ff3b3b', '🔴'], ['#3bff6b', '🟢'], ['#3bb0ff', '🔵'], ['#ffffff', '⚪']], '#ffd23b');
  const everywhere = el('input', { type: 'checkbox' });
  const site = el('input', { type: 'checkbox' });
  const send = () => { if (!msg.value.trim()) return toast('Write the message.', 'error'); post({ op: 'message', text: msg.value, color: color.value, everywhere: everywhere.checked, site: site.checked }, 'Sent!'); };
  msg.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  const amount = segBtns([[10, 'R$ 10'], [25, 'R$ 25'], [50, 'R$ 50'], [100, 'R$ 100']], 25);
  body.replaceChildren(
    el('div', { class: 'adm-hero abuse live' },
      el('div', {}, el('h2', {}, '🔥 ', el('span', { text: 'ADMIN ABUSE' }), ' · ', el('span', { class: 'no-i18n', text: a.game })),
        el('p', { text: `${a.players} players in ${a.servers} server(s)${left !== null ? ` · ${left} min left` : ''}${a.adminIn ? '' : ' · you are not in the game yet!'}` })),
      el('div', { class: 'row', style: { gap: '8px', position: 'relative', zIndex: 1 } },
        el('button', { class: 'btn btn-green btn-large', text: a.adminIn ? 'Open the game' : 'Join the game', onclick: () => launchGame(a.gameId) }),
        el('button', { class: 'btn btn-large', text: 'End', onclick: () => { if (confirm('End the Admin Abuse?')) post({ op: 'end' }, 'Admin Abuse ended'); } }))),
    card('📢 Global message', 'A big message on everyone\'s screen', msg, color,
      el('div', { class: 'row wrap', style: { gap: '14px' } },
        el('label', { class: 'small' }, everywhere, ' In every game on Robis'),
        el('label', { class: 'small' }, site, ' Also on the website')),
      el('button', { class: 'btn btn-primary', text: 'Send', onclick: send })),
    el('div', { class: 'abuse-fx' }, Object.entries(ABUSE_FX).map(([k, [icon, name, sub]]) => el('button', { class: 'abuse-tile' + (a.effects[k] ? ' on' : ''), onclick: () => post({ op: 'effect', effect: k, on: !a.effects[k] }) },
      el('span', { class: 'abuse-icon', text: icon }), el('b', { text: name }), el('span', { class: 'small', text: sub }), el('span', { class: 'abuse-state', text: a.effects[k] ? 'ON' : 'OFF' })))),
    el('div', { class: 'adm-cards' },
      card('💥 Right now', 'One-time effects', el('div', { class: 'row wrap', style: { gap: '8px' } }, Object.entries(ABUSE_ONCE).map(([k, [icon, name]]) => el('button', { class: 'btn', onclick: () => post({ op: 'once', effect: k }, name + '!') }, icon + ' ', el('span', { text: name }))))),
      card('💰 Robits for everyone in the game', null, amount, el('button', { class: 'btn btn-green', text: 'Give', onclick: () => post({ op: 'robits', amount: +amount.value }, 'Given') }))),
    el('p', { class: 'small muted', text: 'In the game you can also type :giant, :tiny, :normal, :size 3, :fireworks, :coinrain, :meteors and :global text in the chat.' }));
  abuseTimer = setInterval(() => { if (current === 'abuse' && !document.hidden && document.activeElement !== msg) drawAbuse(); else if (current !== 'abuse') clearInterval(abuseTimer); }, 10000);
}

// ---------------------------------------------------------------- Sales
// "Black Friday": a discount on the catalog for a while, with a countdown.
const toLocalDT = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); };
async function drawSales() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/sales'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { await api.post('/admin/sales', b); toast(msg, 'success'); drawSales(); } catch (e) { toast(e.message, 'error'); } };
  const name = el('input', { class: 'input', maxlength: 40, value: 'Black Friday' });
  const pct = segBtns([[10, '-10%'], [20, '-20%'], [30, '-30%'], [50, '-50%'], [70, '-70%']], 50);
  const scope = el('select', { class: 'input', style: { width: 'auto' } }, [['all', 'Everything'], ['Accessories', 'Accessories'], ['Clothing', 'Clothing'], ['Hat', 'Hats'], ['Hair', 'Hair'], ['Face', 'Faces'], ['Gear', 'Gear'], ['Pet', 'Pets']].map(([v, t]) => el('option', { value: v, text: t })));
  const starts = el('input', { class: 'input', type: 'datetime-local', value: toLocalDT(Date.now()), style: { width: 'auto' } });
  const length = segBtns([[3, '3 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']], 24);
  const PRESETS = [['Black Friday', 50, 72], ['Cyber Monday', 30, 24], ['Halloween Sale', 40, 72], ['Flash Sale', 70, 3], ['New Year Sale', 50, 168]];
  const fmt = (t) => new Date(t).toLocaleString();
  body.replaceChildren(
    el('div', { class: 'adm-hero sales' }, el('div', {}, el('h2', { text: '🏷️ Sales' }), el('p', { text: 'Discounts on the catalog (not on Limiteds), with a countdown on the catalog and home pages.' }))),
    card('New sale', null,
      el('div', { class: 'row wrap', style: { gap: '6px' } }, el('span', { class: 'small muted', text: 'Quick:' }), PRESETS.map(([n, p, h]) => el('button', { class: 'btn btn-small', text: `${n} -${p}%`, onclick: () => { name.value = n; pct.set(p); length.set(h); } }))),
      el('label', { class: 'field' }, 'Name', name),
      el('div', { class: 'qe-step', text: 'Discount' }), pct,
      el('div', { class: 'row wrap', style: { gap: '14px' } }, el('label', { class: 'field' }, 'On', scope), el('label', { class: 'field' }, 'Starts', starts)),
      el('div', { class: 'qe-step', text: 'How long' }), length,
      el('button', { class: 'btn btn-green', text: '🏷️ Start the sale', onclick: () => {
        const s = new Date(starts.value).getTime() || Date.now();
        post({ name: name.value, percent: +pct.value, scope: scope.value, starts: s, ends: Math.max(s, Date.now()) + +length.value * 3600e3 }, 'Sale created!');
      } })),
    card('Sales', null, r.sales.length ? el('div', { class: 'mini-list' }, r.sales.map((s) => el('div', { class: 'mini-row' },
      el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: `${s.name} -${s.percent}%` }), el('span', { class: 'muted', text: ` · ${s.scope === 'all' ? 'everything' : s.scope} · ${fmt(s.starts)} → ${fmt(s.ends)}` })),
      s.live ? el('span', { class: 'pill online-pill', text: 'ON NOW' }) : s.starts > Date.now() ? el('span', { class: 'pill', text: 'SOON' }) : el('span', { class: 'pill', text: 'ENDED' }),
      s.live ? el('button', { class: 'btn btn-small', text: 'End now', onclick: () => post({ op: 'end', id: s.id }, 'Sale ended') }) : null,
      el('button', { class: 'btn btn-small btn-red', text: '×', onclick: () => post({ op: 'delete', id: s.id }, 'Deleted') }))))
      : el('div', { class: 'muted small', text: 'No sales yet.' })));
}

// ---------------------------------------------------------------- Overwatch
// ---------------------------------------------------------------- bots
var botsTimer = 0; // var: the page can open on this section before the module has finished loading
async function drawBots() {
  clearInterval(botsTimer);
  let r;
  try { r = await api.get('/admin/bots'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { await api.post('/admin/bots', b); if (msg) toast(msg, 'success'); drawBots(); } catch (e) { toast(e.message, 'error'); } };
  const S = r.settings;
  const num = (v, min, max) => el('input', { class: 'input', type: 'number', min, max, value: v, style: { width: '90px' } });
  const max = num(S.max, 0, 60), perGame = num(S.perGame, 1, 20), cheaters = num(S.cheaters, 0, 100), ru = num(S.ru, 0, 100);
  const game = el('select', { class: 'input' }, r.games.map((g) => el('option', { value: g.id, text: g.name })));
  const CHEAT = { '': '😇 Fair player', speed: '⚡ Speed hack', fly: '🕊 Fly hack', teleport: '✨ Teleport hack', random: '🎲 Random cheater' };
  const cheat = el('select', { class: 'input' }, Object.entries(CHEAT).map(([k, v]) => el('option', { value: k, text: v })));
  const field = (label, input, hint) => el('div', { style: { margin: '6px 0' } },
    el('label', { class: 'row', style: { gap: '8px', alignItems: 'center', justifyContent: 'space-between' } }, el('span', { text: label }), input),
    hint ? el('div', { class: 'muted small', text: hint }) : null);
  const ICON = { walk: '🚶', idle: '🧍', afk: '💤', follow: '👣', hide: '🙈', jump: '🦘', tool: '🗡', leaving: '👋' };
  body.replaceChildren(
    el('div', { class: 'adm-hero bots' }, el('div', {}, el('h2', { text: '🤖 Bots' }),
      el('p', { text: `Bots join public games and play like people: walk, jump, follow someone, hide, go AFK, chat, dance, reset and leave. A few of them cheat, so the anti-cheat, reports and Overwatch have someone to catch. Online now: ${r.bots.length} (aiming for ${r.wanted}). Bot accounts: ${r.accounts}.` }))),
    el('div', { class: 'adm-cards' },
      card('Bots', 'Off: every bot leaves at once', segBtns([[true, 'On'], [false, 'Off']], S.enabled, (v) => post({ op: 'settings', enabled: v === true || v === 'true' }, 'Saved'))),
      card('Settings', 'How many bots and how many cheaters',
        field('Bots online at most', max, 'goes up and down during the day'),
        field('Bots in one game at most', perGame),
        field('Servers with a cheater, %', cheaters, 'one cheater per server at most'),
        field('Russian-speaking bots, %', ru, 'for new bot accounts'),
        el('button', { class: 'btn btn-primary', text: 'Save', onclick: () => post({ op: 'settings', max: +max.value, perGame: +perGame.value, cheaters: +cheaters.value, ru: +ru.value }, 'Saved') })),
      card('Add a bot now', 'Into the game\'s public server', game, cheat,
        el('button', { class: 'btn btn-primary', text: '➕ Add bot', onclick: () => post({ op: 'spawn', gameId: +game.value, cheat: cheat.value }, 'The bot joined') }))),
    card(`Online bots (${r.bots.length})`, 'Cheaters are only shown here', r.bots.length ? el('div', { class: 'mini-list' }, r.bots.map((b) => el('div', { class: 'mini-row' },
      el('span', { class: 'mini-text' }, el('a', { class: 'no-i18n', href: `/profile?id=${b.uid}`, text: b.name }), el('span', { class: 'muted no-i18n', text: ` · ${b.gameName} (${b.players} in server) · ${b.lang.toUpperCase()}` })),
      b.cheat ? el('span', { class: 'pill ow-wrong', text: CHEAT[b.cheat] }) : el('span', { class: 'pill', text: '😇 Fair' }),
      el('span', { class: 'small', text: b.doing.startsWith('cheating') ? '🚨 ' + b.doing : `${ICON[b.doing] || ''} ${b.doing}` }),
      el('span', { class: 'muted small', text: Math.floor(b.online / 60) + ' min' }),
      el('button', { class: 'btn btn-small', text: 'Kick', onclick: () => post({ op: 'kick', uid: b.uid }) }))))
      : el('div', { class: 'muted small', text: S.enabled ? 'No bots online yet. They come in one by one.' : 'Bots are off.' }),
    el('div', { class: 'row wrap', style: { gap: '8px', marginTop: '8px' } },
      r.bots.length ? el('button', { class: 'btn btn-red', text: 'Everyone leave', onclick: () => post({ op: 'clear' }, 'All bots left') }) : null,
      r.accounts ? el('button', { class: 'btn btn-red', text: `🗑 Delete all bot accounts (${r.accounts})`, onclick: async () => {
        if (!confirm(tr(`Delete all ${r.accounts} bot accounts? Their friends, items and requests go too. While bots are on, new bots will make new accounts.`))) return;
        try { const x = await api.post('/admin/bots', { op: 'deleteAll' }); toast(`Deleted ${x.deleted} bot accounts`, 'success'); if (data && data.users) data.users = data.users.filter((u) => !u.bot); drawBots(); } catch (e) { toast(e.message, 'error'); }
      } }) : null)));
  botsTimer = setInterval(() => { if (current === 'bots' && !document.hidden && !body.contains(document.activeElement)) drawBots(); else if (current !== 'bots') clearInterval(botsTimer); }, 8000);
}

async function drawOverwatch() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/overwatch'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { await api.post('/admin/overwatch', b); toast(msg, 'success'); drawOverwatch(); } catch (e) { toast(e.message, 'error'); } };
  const mode = segBtns([['off', 'Off'], ['chosen', 'Only chosen players'], ['everyone', 'Everyone']], r.mode, (v) => post({ op: 'mode', mode: v }, 'Saved'));
  const who = whoInput('Player name');
  const KIND_ICON = { fair: '✅', speed: '⚡', fly: '🕊', teleport: '✨', noclip: '🧱', aimbot: '🎯' };
  const watch = async (id) => {
    const c = await api.get('/admin/overwatch/case/' + id);
    const { createViewer } = await import('../owviewer.js');
    const box = el('div', { class: 'ow-viewer' });
    let v = null;
    modal({ title: `Case ${c.id} · truth: ${c.kindName}`, width: 900, body: box, buttons: [{ text: 'Close' }], onClose: () => v && v.destroy() });
    v = createViewer(box, c.replay);
  };
  body.replaceChildren(usersList(),
    el('div', { class: 'adm-hero overwatch' }, el('div', {}, el('h2', { text: '🕵️ Overwatch' }), el('p', { text: `Players judge bot replays: cheater or fair? ${r.total} answers so far. New cases every Monday (${new Date(r.nextWeek).toLocaleDateString()}).` })),
      el('button', { class: 'btn', style: { position: 'relative', zIndex: 1 }, text: '🔄 New cases now', onclick: () => { if (confirm('Make new cases for this week now? Answers to the old ones are kept.')) post({ op: 'refresh' }, 'New cases made'); } })),
    el('div', { class: 'adm-cards' },
      card('Anti-cheat', 'Spots players who are too fast, fly or teleport in games and makes a real case', segBtns([[true, 'On'], [false, 'Off']], r.anticheat, (v) => post({ op: 'anticheat', on: v === true || v === 'true' }, 'Saved'))),
      card('Who can take part', 'Admins always can', mode,
        el('div', { class: 'row', style: { gap: '6px' } }, who, el('button', { class: 'btn btn-primary', text: 'Give access', onclick: () => post({ op: 'add', user: who.value }, 'Access given') })),
        r.access.length ? el('div', { class: 'ow-access' }, r.access.map((a) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: a.username }), el('button', { class: 'chip-x', text: '×', title: 'Take access away', onclick: () => post({ op: 'remove', user: a.id }, 'Access taken away') })))) : el('div', { class: 'muted small', text: 'Nobody chosen yet.' })),
      card('This week\'s cases', 'The truth is only shown here', el('div', { class: 'mini-list' }, r.cases.map((c) => el('div', { class: 'mini-row' },
        el('span', { class: 'mini-text' }, el('b', { text: `${KIND_ICON[c.kind] || ''} ${c.kindName}` }), el('span', { class: 'muted no-i18n', text: ` · ${c.suspect}` })),
        el('span', { class: 'small', text: `🚫 ${c.votes.cheater} · ✅ ${c.votes.fair}${c.correct !== null ? ` · ${c.correct}% right` : ''}` }),
        el('button', { class: 'btn btn-small', text: '▶', title: 'Watch', onclick: () => watch(c.id) })))))),
    card('🚨 Real cases', 'From the anti-cheat: real players in real games. The investigators vote, you decide.', r.real.length ? el('div', { class: 'mini-list' }, r.real.map((c) => el('div', { class: 'mini-row ow-real-row ' + c.status },
      el('span', { class: 'mini-text' },
        el('a', { class: 'no-i18n', href: `/profile?id=${c.uid}`, text: c.username }), el('span', { class: 'muted no-i18n', text: ` · ${c.gameName} · ${Object.keys(c.why || {}).join(', ')}` }),
        c.detail ? el('div', { class: 'small muted no-i18n', text: c.detail }) : null),
      el('span', { class: 'small', text: `🚫 ${c.votes.cheater} · ✅ ${c.votes.fair}` }),
      c.verdict ? el('span', { class: 'pill ' + (c.verdict === 'cheater' ? 'ow-wrong' : ''), text: { cheater: 'Players: CHEATER', fair: 'Players: fair', unsure: 'Players: not sure' }[c.verdict] }) : null,
      el('span', { class: 'muted small', text: timeAgo(c.created) }),
      el('button', { class: 'btn btn-small', text: '▶', title: 'Watch', onclick: () => watch(c.id) }),
      c.status === 'open' ? el('button', { class: 'btn btn-small btn-red', text: 'Ban', onclick: () => { const u = (data?.users || []).find((x) => x.id === c.uid) || { id: c.uid, username: c.username, banned: false }; ban(u); post({ op: 'real', id: c.id, status: 'cheater' }, 'Marked as a cheater'); } }) : el('span', { class: 'pill', text: c.status === 'cheater' ? 'CHEATER' : 'CLEAN' }),
      c.status === 'open' ? el('button', { class: 'btn btn-small', text: 'Clean', title: 'Not a cheater', onclick: () => post({ op: 'real', id: c.id, status: 'clean' }, 'Marked clean') }) : el('button', { class: 'btn btn-small', text: '↺', title: 'Open again', onclick: () => post({ op: 'real', id: c.id, status: 'open' }, 'Opened again') }))))
      : el('div', { class: 'muted small', text: 'No real cases yet. When the anti-cheat spots someone, the case shows up here and in Overwatch.' })),
    card('Investigators', 'Everyone who answered, best first', r.investigators.length ? el('table', { class: 'ow-table' },
      el('tr', {}, ['Player', 'Answers', 'This week', 'Right', 'Accuracy', 'Access', ''].map((t) => el('th', { text: t }))),
      r.investigators.map((i) => el('tr', {},
        el('td', {}, el('a', { class: 'no-i18n', href: `/profile?id=${i.uid}`, text: i.username })),
        el('td', { text: String(i.answered) }), el('td', { text: String(i.thisWeek) }), el('td', { text: String(i.correct) }),
        el('td', {}, el('span', { class: 'ow-acc ' + (i.accuracy >= 75 ? 'good' : i.accuracy >= 50 ? 'ok' : 'bad'), text: i.accuracy + '%' })),
        el('td', { text: i.hasAccess ? '✓' : '—' }),
        el('td', {}, r.access.some((a) => a.id === i.uid) ? el('button', { class: 'btn btn-small', text: 'Remove', onclick: () => post({ op: 'remove', user: i.uid }, 'Access taken away') }) : r.mode === 'chosen' ? el('button', { class: 'btn btn-small', text: 'Give access', onclick: () => post({ op: 'add', user: i.uid }, 'Access given') }) : null))))
      : el('div', { class: 'muted small', text: 'No answers yet.' })),
    card('Latest answers', null, r.recent.length ? el('div', { class: 'mini-list' }, r.recent.map((a) => el('div', { class: 'mini-row' },
      el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: a.username }), ' · ', el('span', { text: a.verdict === 'cheater' ? '🚫 cheater' : '✅ fair' }), a.tags.length ? el('span', { class: 'muted', text: ` (${a.tags.join(', ')})` }) : null,
        el('span', { class: 'muted', text: ` · really: ${a.kind}` })),
      el('span', { class: 'small ' + (a.correct ? 'ow-right' : 'ow-wrong'), text: a.correct ? '✓ right' : '✗ wrong' }),
      el('span', { class: 'muted small', text: timeAgo(a.t) })))) : el('div', { class: 'muted small', text: 'No answers yet.' })));
}

// ---------------------------------------------------------------- quests & levels
async function drawProgress() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/progress'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const P = r.settings;
  const save = async (b, msg = 'Saved') => { try { await api.post('/admin/progress', b); toast(msg, 'success'); drawProgress(); } catch (e) { toast(e.message, 'error'); } };
  const mult = el('input', { class: 'input', type: 'number', step: 0.5, min: 0, max: 10, value: P.rewardMult ?? 1, style: { width: '90px' } });
  const lvl = el('input', { class: 'input', type: 'number', min: 0, max: 1000, value: P.levelReward ?? 10, style: { width: '90px' } });
  const bMult = segBtns([['2', 'x2'], ['3', 'x3'], ['5', 'x5']], '2');
  const bHours = segBtns([['1', '1 hour'], ['6', '6 hours'], ['24', '1 day'], ['72', '3 days']], '24');
  const box = (name, ...kids) => el('fieldset', { class: 'cl-box' }, el('legend', { text: name }), ...kids);
  const boostOn = P.boost && P.boost.until > Date.now();
  body.replaceChildren(el('div', { class: 'cl-cols' },
    el('div', {},
      box('Daily Quests & Levels',
        el('p', { class: 'small muted', text: 'Players get 3 quests a day and XP for playing (2 XP a minute), for visiting every day and for quests. Every level up gives Robits.' }),
        el('div', { class: 'cl-grid' }, el('button', { class: 'cl-btn' + (P.on === false ? '' : ' red'), text: P.on === false ? 'Turn quests on' : 'Turn quests off', onclick: () => save({ on: P.on === false }) }))),
      box('Rewards',
        el('div', { class: 'row', style: { marginBottom: '6px' } }, el('span', { text: 'Quest rewards ×' }), mult),
        el('div', { class: 'row', style: { marginBottom: '6px' } }, el('span', { text: 'Robits per level (× the level)' }), lvl),
        el('button', { class: 'cl-btn', text: 'Save', onclick: () => save({ rewardMult: +mult.value, levelReward: +lvl.value }) })),
      box('XP event',
        boostOn ? el('p', { class: 'small', text: `🔥 x${P.boost.mult} XP until ${new Date(P.boost.until).toLocaleString()}` }) : el('p', { class: 'small muted', text: 'No XP event right now.' }),
        bMult, el('div', { style: { height: '6px' } }), bHours,
        el('div', { class: 'cl-grid', style: { marginTop: '8px' } },
          el('button', { class: 'cl-btn', text: 'Start the XP event', onclick: () => save({ boost: { mult: +bMult.value, hours: +bHours.value } }, 'XP event started') }),
          boostOn ? el('button', { class: 'cl-btn red', text: 'Stop it', onclick: () => save({ boost: { hours: 0 } }, 'XP event stopped') }) : null)),
      box('All quests', el('table', { class: 'cl-table' }, el('tbody', {}, r.quests.map((q) => el('tr', {}, el('th', { text: q.text }), el('td', { class: 'no-i18n', text: `R$ ${q.robits} · ${q.xp} XP` }))))))),
    el('div', {},
      box('Statistics', el('table', { class: 'cl-table' }, el('tbody', {},
        [['Players with a level', fmtFull(r.stats.withLevel)], ['Quests done today', fmtFull(r.stats.questsToday)], ['Quests done in all', fmtFull(r.stats.questsAll)]]
          .map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v })))))),
      box('Highest levels', el('table', { class: 'cl-table' }, el('tbody', {}, r.stats.top.map((u, i) => el('tr', {},
        el('th', {}, el('span', { text: `${i + 1}. ` }), el('a', { href: '#', class: 'no-i18n', text: u.username, onclick: (e) => { e.preventDefault(); manage(u); } })),
        el('td', { class: 'no-i18n', text: `Lv ${u.level} · ${fmtFull(u.xp)} XP` })))))))));
}

// ---------------------------------------------------------------- alt accounts
// Groups of accounts that shared a device or an IP: banned ones first.
var altBy = 'both';
async function drawAlts(q = '') {
  const qIn = el('input', { class: 'input', placeholder: 'Find a player\'s alts (name)', value: q });
  const by = segBtns([['both', 'Device or IP'], ['device', 'Same device'], ['ip', 'Same IP']], altBy, (v) => { altBy = v; drawAlts(qIn.value.trim()); });
  qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') drawAlts(qIn.value.trim()); });
  const out = el('div', {}, spinner());
  body.replaceChildren(el('div', { class: 'row wrap', style: { gap: '8px', marginBottom: '10px' } }, qIn, el('button', { class: 'btn btn-primary', text: 'Find', onclick: () => drawAlts(qIn.value.trim()) }), by), out);
  let r;
  try { r = await api.get(`/admin/alts?by=${altBy}&q=${encodeURIComponent(q)}`); } catch (e) { out.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const fmt = (t) => (t ? new Date(t).toLocaleDateString() : '-');
  out.replaceChildren(
    el('div', { class: 'small muted', style: { marginBottom: '8px' }, text: `${r.total} group(s) of alt accounts` + (r.bigNetworks ? ` · ${r.bigNetworks} shared network(s) (schools, phone networks) left out` : '') }),
    ...(r.groups.length ? r.groups.map((g) => el('fieldset', { class: 'cl-box' },
      el('legend', { text: `${g.size} accounts` + (g.banned ? ` · ${g.banned} banned` : '') }),
      el('table', { class: 'cl-table alt-table' }, el('tbody', {}, g.members.map((m) => el('tr', { class: m.banned ? 'alt-banned' : '' },
        el('td', {}, el('a', { href: '#', class: 'no-i18n', text: m.username, onclick: (e) => { e.preventDefault(); manage(m); } }),
          m.banned ? el('span', { class: 'pill ban-pill', text: 'Banned' }) : null, m.guest ? el('span', { class: 'pill', text: '👤 Guest' }) : null, m.isAdmin ? el('span', { class: 'pill admin-pill', text: 'Admin' }) : null),
        el('td', { class: 'small', text: `joined ${fmt(m.created)}` }),
        el('td', { class: 'small', text: m.lastOnline ? `seen ${timeAgo(m.lastOnline)}` : '' }),
        el('td', { class: 'small no-i18n', text: 'R$ ' + fmtFull(m.robits) }))))),
      g.shared.length ? el('div', { class: 'promo-chosen', style: { marginTop: '6px' } }, g.shared.map((x) => el('span', { class: 'holder-chip', title: x.users.join(', ') }, el('span', { text: x.kind === 'device' ? '📱 ' : '🌐 ' }), el('span', { class: 'no-i18n', text: `${x.label} · ${x.users.length}` })))) : null))
      : [el('div', { class: 'empty', text: q ? 'No alts found for this name.' : 'No alt accounts found.' })]));
}

// ---------------------------------------------------------------- site tools (5.0)
async function drawSiteTools() {
  body.replaceChildren(spinner());
  let t;
  try { t = await api.get('/admin/tools'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const run = async (op, extra = {}, ask = '') => {
    if (ask && !confirm(tr(ask))) return;
    try { const r = await api.post('/admin/tools', { op, ...extra }); toast(r.message, 'success'); drawSiteTools(); } catch (e) { toast(e.message, 'error'); }
  };
  const st = t.stats;
  const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
  const box = (name, ...kids) => el('fieldset', { class: 'cl-box' }, el('legend', { text: name }), ...kids);
  const B = (label, fn, red) => el('button', { class: 'cl-btn' + (red ? ' red' : ''), text: label, onclick: fn });
  const pct = el('input', { class: 'input', type: 'number', value: 10, style: { width: '90px' } });
  const days = el('input', { class: 'input', type: 'number', value: 90, min: 7, style: { width: '90px' } });
  const words = el('textarea', { class: 'input', rows: 2, placeholder: 'Words not allowed in usernames, separated by commas', value: t.settings.nameBlacklist.join(', ') });
  const welcome = el('textarea', { class: 'input', rows: 2, maxlength: 1000, placeholder: 'A message every new player gets in their inbox (empty = off)', value: t.settings.welcome });
  const reason = el('input', { class: 'input', placeholder: 'Reason shown to players (optional)' });
  const list = (rows) => el('table', { class: 'cl-table' }, el('tbody', {}, rows.map(([a, b]) => el('tr', {}, el('th', { class: 'no-i18n' }, a), el('td', { class: 'no-i18n', text: b })))));
  body.replaceChildren(el('div', { class: 'cl-cols' },
    el('div', {},
      box('World statistics', list([
        ['Players', fmtFull(st.players)], ['Guests', fmtFull(st.guests)], ['Bots', fmtFull(st.bots)], ['New today', fmtFull(st.newToday)], ['Online today', fmtFull(st.onlineToday)],
        ['Items (player-made)', `${fmtFull(st.items)} (${fmtFull(st.playerItems)})`], ['Games (public)', `${fmtFull(st.games)} (${fmtFull(st.publicGames)})`],
        ['Messages', fmtFull(st.messages)], ['Sessions', fmtFull(st.sessions)], ['Trades', fmtFull(st.trades)], ['Robits owned', 'R$ ' + fmtFull(st.robits)],
        ['Servers running', fmtFull(st.servers)], ['Database', kb(st.dbSize)]])),
      box('Richest players', list(t.richest.map((u) => [el('a', { href: '#', text: u.username, onclick: (e) => { e.preventDefault(); manage(u); } }), 'R$ ' + fmtFull(u.robits)]))),
      box('Newest players', list(t.newest.map((u) => [el('a', { href: '#', text: u.username, onclick: (e) => { e.preventDefault(); manage(u); } }), timeAgo(u.created)])))),
    el('div', {},
      box('Guests',
        el('p', { class: 'small muted', text: `${st.guests} guest account(s) right now.` }),
        el('div', { class: 'cl-grid' },
          B(t.settings.guests ? 'Turn guest play off' : 'Turn guest play on', () => run('guests', { on: !t.settings.guests })),
          B('Delete all guests', () => run('deleteGuests', {}, 'Delete every guest account that is not in a game?'), true))),
      box('Maintenance',
        el('div', { class: 'cl-grid' },
          B('Remove old sessions', () => run('purgeSessions')),
          B('Clear chat log', () => run('clearChatlog', {}, 'Clear the whole chat log?')),
          B('Everyone: new stipend', () => run('resetStipends', {}, 'Let everyone claim the daily stipend again?')),
          B('Remove announcement', () => run('clearAnnouncement')),
          B('Download players (CSV)', () => { location.href = '/api/admin/tools/users.csv'; })),
        el('div', { class: 'row', style: { marginTop: '8px' } }, el('span', { text: 'Delete messages older than' }), days, el('span', { text: 'days' }), B('Delete', () => run('purgeMessages', { days: +days.value }, 'Delete old messages for everyone?'), true)),
        el('div', { class: 'row', style: { marginTop: '8px' } }, reason, B('Shut down all servers', () => run('shutdownAll', { reason: reason.value }, 'Close every game server now?'), true))),
      box('Catalog prices',
        el('p', { class: 'small muted', text: 'Changes every official item for sale (not Limiteds, not player items).' }),
        el('div', { class: 'row' }, pct, el('span', { text: '%' }), B('Change prices', () => run('bulkPrice', { percent: +pct.value }, 'Change the price of every official item?')))),
      box('Usernames', words, B('Save blocked words', () => run('nameBlacklist', { words: words.value }))),
      box('Welcome message', welcome, B('Save', () => run('welcome', { text: welcome.value }))))));
}

// ================================================================ Control Center 4.0
// "Needs attention" on the Dashboard: what is waiting for the staff.
// replaceChildren without the nulls of `cond ? x : null` (the DOM would print "null")
const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
function attentionStrip() {
  const box = el('div', { class: 'cc-attn' });
  const draw = (a) => {
    if (!a) { box.replaceChildren(); return; }
    const item = (n, label, icon, tab, tone) => el('button', { class: 'cc-attn-item ' + (n ? tone : 'calm'), onclick: () => { location.hash = tab; } },
      el('span', { class: 'cc-attn-ic' }, ic(icon)), el('b', { text: String(n) }), el('span', { text: label }));
    fill(box,
      perm('moderator') ? item(a.reports, 'open reports', 'flag', 'reports', 'red') : null,
      perm('moderator') ? item(a.appeals, 'appeals', 'scale', 'appeals', 'orange') : null,
      me.isAdmin ? item(a.overwatch, 'Overwatch cases', 'eye', 'overwatch', 'orange') : null,
      perm('moderator') ? item(a.chat, 'flagged chat (24h)', 'chat', 'chat', 'yellow') : null,
      me.isAdmin ? item(a.scheduled, 'scheduled', 'clock', 'schedule', 'blue') : null,
      a.maintenance ? el('div', { class: 'cc-warn' }, '🛠 ', el('span', { text: 'Maintenance is ON: players can\'t play.' })) : null,
      a.off.length ? el('div', { class: 'cc-warn' }, '⏸ ', el('span', { text: 'Turned off: ' + a.off.join(', ') })) : null);
    if (a.notes.length || a.online.length) {
      box.append(el('div', { class: 'cc-attn-row' },
        a.notes.length ? el('div', { class: 'cc-pinned' }, el('b', { text: '📌 Pinned notes' }), a.notes.map((n) => el('div', { class: 'cc-pinned-note' }, el('span', { class: 'no-i18n', text: n.text }), el('span', { class: 'muted small no-i18n', text: ' — ' + n.by })))) : null,
        a.online.length ? el('div', { class: 'cc-online' }, el('b', {}, '🟢 ', el('span', { text: `In games now (${a.onlineCount})` })),
          el('div', { class: 'cc-chips' }, a.online.map((o) => el('a', { class: 'cc-chip no-i18n', href: `/profile?id=${o.id}`, title: o.gameName, text: o.username })))) : null));
    }
  };
  draw(window.__admAttention);
  api.get('/admin/attention').then((a) => { window.__admAttention = a; draw(a); }).catch(() => {});
  return box;
}

// ---------------------------------------------------------------- Chat Log
var chatTimer = 0; // var: the page can open on this section before the module has finished loading
async function drawChatLog() {
  clearInterval(chatTimer);
  const q = el('input', { class: 'input', placeholder: 'Search words or a player', style: { maxWidth: '280px' } });
  const game = el('select', { class: 'input', style: { width: 'auto' } }, el('option', { value: '', text: 'All games' }));
  const flagged = el('input', { type: 'checkbox' });
  const bots = el('input', { type: 'checkbox' });
  const list = el('div', { class: 'cc-chat' }, spinner());
  const info = el('div', { class: 'muted small' });
  const live = el('input', { type: 'checkbox', checked: true });
  let gamesFilled = false;
  const act = async (m, what) => {
    const u = { id: m.uid, username: m.name };
    if (what === 'profile') { open(`/profile?id=${m.uid}`, '_blank'); return; }
    if (what === 'mute') { try { await api.post(`/admin/users/${m.uid}/restrict`, { kind: 'mute', time: '1h', reason: 'Chat: ' + m.text.slice(0, 80) }); toast(`${m.name} is muted for 1 hour`, 'success'); } catch (e) { toast(e.message, 'error'); } return; }
    if (what === 'warn') { try { await api.post(`/admin/users/${m.uid}/warn`, { reason: 'Chat: ' + m.text.slice(0, 120) }); toast(`${m.name} got a warning`, 'success'); } catch (e) { toast(e.message, 'error'); } return; }
    if (what === 'ban') ban(u);
  };
  const load = async () => {
    let r;
    try { r = await api.get(`/admin/chatlog?q=${encodeURIComponent(q.value.trim())}&game=${game.value}&flagged=${flagged.checked ? 1 : 0}&bots=${bots.checked ? 1 : 0}`); } catch (e) { list.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
    if (!gamesFilled) { gamesFilled = true; for (const g of r.games) game.append(el('option', { value: g.id, text: g.name })); }
    info.textContent = tr(`${r.messages.length} shown · ${r.total} kept · ${r.flagged24} flagged in 24 hours`);
    list.replaceChildren(...(r.messages.length ? r.messages.map((m) => el('div', { class: 'cc-msg' + (m.scam ? ' scam' : m.filtered ? ' filtered' : '') },
      el('span', { class: 'cc-msg-time', text: new Date(m.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
      el('a', { class: 'cc-msg-name no-i18n', href: `/profile?id=${m.uid}`, target: '_blank', text: m.name }),
      m.bot ? el('span', { class: 'pill', text: '🤖' }) : null,
      el('span', { class: 'cc-msg-text no-i18n', text: m.text }),
      m.scam ? el('span', { class: 'pill cc-tag-red', text: m.scam === 'scam' ? 'SCAM' : 'LINK' }) : m.filtered ? el('span', { class: 'pill cc-tag-yellow', text: 'FILTERED' }) : null,
      el('span', { class: 'cc-msg-game muted small no-i18n', text: m.gameName }),
      m.bot ? null : el('span', { class: 'cc-msg-acts' },
        el('button', { class: 'btn btn-small', text: 'Warn', onclick: () => act(m, 'warn') }),
        el('button', { class: 'btn btn-small', text: 'Mute 1h', onclick: () => act(m, 'mute') }),
        me.isAdmin || perm('moderator') ? el('button', { class: 'btn btn-small btn-red', text: 'Ban', onclick: () => act(m, 'ban') }) : null)))
      : [el('div', { class: 'empty', text: 'No messages yet. Chat from every game shows up here.' })]));
  };
  for (const x of [game, flagged, bots]) x.addEventListener('change', load);
  let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
  body.replaceChildren(
    el('div', { class: 'adm-hero chat' }, el('div', {}, el('h2', { text: '💬 Chat Log' }), el('p', { text: 'Everything players write in games, as they wrote it (before the filter). Red: scam links, yellow: caught by the filter.' }))),
    el('div', { class: 'panel' },
      el('div', { class: 'row wrap', style: { marginBottom: '10px' } }, q, game,
        el('label', { class: 'row', style: { gap: '6px' } }, flagged, el('span', { text: 'Only flagged' })),
        el('label', { class: 'row', style: { gap: '6px' } }, bots, el('span', { text: 'Show bots' })),
        el('label', { class: 'row', style: { gap: '6px' } }, live, el('span', { text: 'Live' })),
        el('a', { class: 'btn btn-small', href: '#settings', text: 'Banned words →' })),
      info, list));
  await load();
  chatTimer = setInterval(() => { if (current === 'chat' && live.checked && !document.hidden && document.activeElement !== q) load(); else if (current !== 'chat') clearInterval(chatTimer); }, 5000);
}

// ---------------------------------------------------------------- Scheduler
async function drawSchedule() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/schedule'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { const x = await api.post('/admin/schedule', b); toast(msg + (x.result ? ': ' + x.result : ''), 'success'); drawSchedule(); } catch (e) { toast(e.message, 'error'); } };
  const kind = el('select', { class: 'input' }, Object.entries(r.kinds).map(([k, v]) => el('option', { value: k, text: v })));
  const pad = (n) => String(n).padStart(2, '0');
  const soon = new Date(Date.now() + 3600e3);
  const at = el('input', { class: 'input', type: 'datetime-local', value: `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:00` });
  const repeat = el('select', { class: 'input', style: { width: 'auto' } }, [['', 'Once'], ['daily', 'Every day'], ['hourly', 'Every hour']].map(([v, t]) => el('option', { value: v, text: t })));
  const text = el('input', { class: 'input', maxlength: 300, placeholder: 'Text' });
  const amount = el('input', { class: 'input', type: 'number', min: 1, max: 10000, value: 100, style: { width: '110px' } });
  const on = segBtns([[true, 'Turn ON'], [false, 'Turn OFF']], true, (v) => { on.value = v === true || v === 'true'; });
  on.value = true;
  const color = el('select', { class: 'input', style: { width: 'auto' } }, [['blue', 'Blue'], ['green', 'Green'], ['orange', 'Orange'], ['red', 'Red']].map(([v, t]) => el('option', { value: v, text: t })));
  const fields = el('div', { class: 'cc-fields' });
  const showFields = () => {
    const k = kind.value;
    const f = (label, x) => el('label', { class: 'cc-field' }, el('span', { text: label }), x);
    fill(fields,
      k === 'announce' || k === 'gamemsg' || k === 'rain' || k === 'shutdown' || k === 'maintenance' ? f(k === 'rain' ? 'Message (optional)' : k === 'shutdown' ? 'What players see' : k === 'maintenance' ? 'Maintenance message (optional)' : 'Text', text) : null,
      k === 'announce' ? f('Colour', color) : null,
      k === 'rain' ? f('Robits each', amount) : null,
      k === 'maintenance' || k === 'bots' ? f('', on) : null);
  };
  kind.addEventListener('change', showFields);
  showFields();
  const ICON = { announce: '📢', gamemsg: '💬', rain: '💸', maintenance: '🛠', bots: '🤖', shutdown: '🔄' };
  const describe = (j) => {
    const p = j.params || {};
    return j.kind === 'rain' ? `R$${p.amount} each${p.text ? ' · ' + p.text : ''}` : j.kind === 'maintenance' || j.kind === 'bots' ? (p.on ? 'ON' : 'OFF') + (p.text ? ' · ' + p.text : '') : p.text || (j.kind === 'announce' ? '(remove the announcement)' : '');
  };
  body.replaceChildren(
    el('div', { class: 'adm-hero schedule' }, el('div', {}, el('h2', { text: '⏰ Scheduler' }), el('p', { text: 'Make things happen by themselves at a set time: an announcement, a Robits rain, maintenance, bots, a restart of the game servers. Once, every day or every hour.' }))),
    card('New timed action', null,
      el('div', { class: 'cc-fields' },
        el('label', { class: 'cc-field' }, el('span', { text: 'What' }), kind),
        el('label', { class: 'cc-field' }, el('span', { text: 'When' }), at),
        el('label', { class: 'cc-field' }, el('span', { text: 'Repeat' }), repeat)),
      fields,
      el('div', {}, el('button', { class: 'btn btn-primary', text: '⏰ Schedule', onclick: () => post({ kind: kind.value, at: new Date(at.value).toISOString(), repeat: repeat.value, text: text.value, amount: +amount.value, on: on.value, color: color.value }, 'Scheduled') }))),
    card('Timeline', null, r.jobs.length ? el('div', { class: 'cc-timeline' }, r.jobs.map((j) => el('div', { class: 'cc-job' + (j.done ? ' done' : '') },
      el('span', { class: 'cc-job-ic', text: ICON[j.kind] || '•' }),
      el('div', { class: 'cc-job-main' },
        el('b', { text: r.kinds[j.kind] || j.kind }),
        el('div', { class: 'small no-i18n', text: describe(j) }),
        el('div', { class: 'muted small' }, el('span', { text: (j.done ? '✓ ' : '') + new Date(j.done ? j.lastRun : j.at).toLocaleString() }), j.repeat ? el('span', { text: ' · ' + (j.repeat === 'daily' ? 'every day' : 'every hour') }) : null, el('span', { class: 'no-i18n', text: ' · ' + j.by }), j.result ? el('span', { class: 'no-i18n', text: ' · ' + j.result }) : null)),
      j.done ? null : el('span', { class: 'cc-job-in', text: timeLeft(j.at - r.now) }),
      j.done ? null : el('button', { class: 'btn btn-small', text: '▶ Now', title: 'Run it right now', onclick: () => post({ op: 'run', id: j.id }, 'Done') }),
      el('button', { class: 'btn btn-small', text: '✕', title: 'Cancel', onclick: () => post({ op: 'cancel', id: j.id }, 'Removed') }))))
      : el('div', { class: 'muted small', text: 'Nothing scheduled yet.' })));
}
function timeLeft(ms) {
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h} h ${m % 60} min`;
  return `in ${Math.floor(h / 24)} days`;
}

// ---------------------------------------------------------------- Switches
async function drawSwitches() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/features'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const ICON = { trades: '🔁', gifts: '🎁', friendRequests: '🤝', groups: '👥', purchases: '🛒', gameCreate: '🛠', spin: '🎡', chat: '💬' };
  body.replaceChildren(
    el('div', { class: 'adm-hero switches' }, el('div', {}, el('h2', { text: '🎚 Switches' }), el('p', { text: 'Turn parts of Robis off for everyone in one click (say, trading while there\'s a scam wave). The staff can still use everything.' }))),
    el('div', { class: 'cc-switches' }, Object.entries(r.names).map(([k, name]) => {
      const on = r.features[k] !== false;
      return el('button', { class: 'cc-switch' + (on ? ' on' : ''), onclick: async () => {
        try { await api.post('/admin/features', { key: k, on: !on }); toast(tr(`${name}: ${!on ? 'ON' : 'OFF'}`), 'success'); drawSwitches(); pollAttention(); } catch (e) { toast(e.message, 'error'); }
      } },
      el('span', { class: 'cc-switch-ic', text: ICON[k] || '•' }), el('b', { text: name }),
      el('span', { class: 'cc-toggle' }, el('i')), el('span', { class: 'cc-switch-state', text: on ? 'ON' : 'OFF' }));
    })),
    el('div', { class: 'muted small', style: { marginTop: '10px' }, text: 'Sign-ups and maintenance are in Settings.' }));
}

// ---------------------------------------------------------------- Economy
async function drawEconomy() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/economy'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const max = Math.max(1, ...r.days.map((d) => Math.max(d.made, d.spent)));
  const chart = el('div', { class: 'cc-eco-chart' }, r.days.map((d) => el('div', { class: 'cc-eco-col', title: `${new Date(d.t).toLocaleDateString()}: +${fmtFull(d.made)} / -${fmtFull(d.spent)}` },
    el('div', { class: 'cc-eco-bars' },
      el('div', { class: 'cc-eco-bar made', style: { height: `${(d.made / max) * 100}%` } }),
      el('div', { class: 'cc-eco-bar spent', style: { height: `${(d.spent / max) * 100}%` } })),
    el('div', { class: 'cc-eco-day', text: new Date(d.t).getDate() + '' }))));
  const made = r.days.reduce((a, d) => a + d.made, 0), spent = r.days.reduce((a, d) => a + d.spent, 0);
  const tile = (label, value, cls = '') => el('div', { class: 'dash-tile ' + cls }, el('div', { class: 'dash-value', text: value }), el('div', { class: 'dash-label', text: label }));
  body.replaceChildren(
    el('div', { class: 'adm-hero economy' }, el('div', {}, el('h2', { text: '💰 Economy' }), el('p', { text: 'Where the Robits come from and where they go: the last 14 days, the richest players, the best-selling items and the biggest moves of the day. Bots and system accounts are left out.' }))),
    el('div', { class: 'dash-tiles' },
      tile('Robits held by players', fmtNum(r.total), 'blue'),
      tile('Average per player', fmtFull(r.average)),
      tile('Median per player', fmtFull(r.median)),
      tile('Made in 14 days', '+' + fmtNum(made), 'green'),
      tile('Spent in 14 days', '-' + fmtNum(spent), 'red'),
      tile('Balance (14 days)', (made - spent >= 0 ? '+' : '') + fmtNum(made - spent), made >= spent ? 'orange' : 'green')),
    card('Robits made and spent, by day', 'Green: made (stipends, sales, rewards). Red: spent.', chart),
    el('div', { class: 'adm-cards' },
      card('Richest players', null, el('div', { class: 'mini-list' }, r.richest.map((u, i) => el('div', { class: 'mini-row' },
        el('span', { class: 'cc-rank', text: String(i + 1) }), el('a', { class: 'mini-text no-i18n', href: `/profile?id=${u.id}`, text: u.username + (u.admin ? ' 🛡' : '') }), el('b', { text: 'R$ ' + fmtFull(u.robits) }))))),
      card('Best-selling items', null, r.items.length ? el('div', { class: 'mini-list' }, r.items.map((it, i) => el('div', { class: 'mini-row' },
        el('span', { class: 'cc-rank', text: String(i + 1) }), el('a', { class: 'mini-text no-i18n', href: `/item?id=${it.id}`, text: it.name }), el('span', { class: 'small', text: tr(`${it.sales} sold`) }), el('b', { text: 'R$ ' + fmtNum(it.earned) }))))
        : el('div', { class: 'muted small', text: 'Nothing sold yet.' })),
      card('Biggest moves today', 'R$ 50 or more', r.big.length ? el('div', { class: 'mini-list' }, r.big.map((t) => el('div', { class: 'mini-row' },
        el('a', { class: 'mini-text no-i18n', href: `/profile?id=${t.userId}`, text: t.username }), el('span', { class: 'small muted no-i18n', text: t.desc }), el('b', { class: t.amount > 0 ? 'cc-plus' : 'cc-minus', text: (t.amount > 0 ? '+' : '') + fmtFull(t.amount) }))))
        : el('div', { class: 'muted small', text: 'Quiet day.' }))));
}

// ---------------------------------------------------------------- Staff Notes
async function drawNotes() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/notes'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b) => { try { await api.post('/admin/notes', b); drawNotes(); pollAttention(); } catch (e) { toast(e.message, 'error'); } };
  const text = el('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: 'Write a note for the team: plans, who to keep an eye on, what was decided...' });
  let color = 'yellow';
  const colors = el('div', { class: 'cc-colors' }, ['yellow', 'blue', 'green', 'pink'].map((c) => el('button', { class: 'cc-color ' + c + (c === color ? ' on' : ''), title: c, onclick: (e) => { color = c; for (const b of colors.children) b.classList.toggle('on', b === e.currentTarget); } })));
  body.replaceChildren(
    el('div', { class: 'adm-hero notes' }, el('div', {}, el('h2', { text: '📝 Staff Notes' }), el('p', { text: 'A board for the whole team. Pinned notes also show on the Dashboard.' }))),
    el('div', { class: 'panel cc-note-new' }, text, el('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '8px' } }, colors, el('button', { class: 'btn btn-primary', text: 'Add note', onclick: () => { if (text.value.trim()) post({ op: 'add', text: text.value, color }); } }))),
    r.notes.length ? el('div', { class: 'cc-notes' }, r.notes.map((n) => el('div', { class: 'cc-note ' + n.color + (n.pinned ? ' pinned' : '') },
      n.pinned ? el('div', { class: 'cc-note-pin', text: '📌' }) : null,
      el('div', { class: 'cc-note-text no-i18n', text: n.text }),
      el('div', { class: 'cc-note-foot' }, el('span', { class: 'small no-i18n', text: n.by }), el('span', { class: 'small muted', text: timeAgo(n.time) }), el('span', { class: 'spacer' }),
        el('button', { class: 'cc-note-btn', title: n.pinned ? 'Unpin' : 'Pin', text: n.pinned ? 'Unpin' : 'Pin', onclick: () => post({ op: 'pin', id: n.id }) }),
        n.by === me.username || me.isAdmin ? el('button', { class: 'cc-note-btn', title: 'Delete', text: '✕', onclick: () => { if (confirm(tr('Delete this note?'))) post({ op: 'delete', id: n.id }); } }) : null))))
      : el('div', { class: 'panel empty', text: 'No notes yet.' }));
}

// ---------------------------------------------------------------- Robis Awards
// Prepare a season: categories, nominated games, then open the voting and
// show the results (players see it on /awards, winners get a trophy).
async function drawAwards() {
  body.replaceChildren(spinner());
  let r;
  try { r = await api.get('/admin/awards'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const post = async (b, msg) => { try { await api.post('/admin/awards', b); if (msg) toast(msg, 'success'); drawAwards(); } catch (e) { toast(e.message, 'error'); } };
  const title = el('input', { class: 'input', placeholder: `Robis Awards ${new Date().getFullYear()}`, style: { maxWidth: '300px' } });
  const gameName = (id) => (r.games.find((g) => g.id === id) || {}).name || '#' + id;
  const STAGE = { draft: '📝 Draft (only admins see it)', voting: '🗳 Voting is open', results: '🏆 Results are out' };
  const season = (s) => {
    const cats = s.categories.map((c) => {
      const pickGame = el('select', { class: 'input', style: { width: 'auto', maxWidth: '240px' } }, el('option', { value: '', text: '+ Nominate a game' }),
        r.games.filter((g) => !c.nominees.some((n) => n.id === g.id)).map((g) => el('option', { value: g.id, text: g.name })));
      pickGame.onchange = () => { if (pickGame.value) post({ op: 'nominees', id: s.id, category: c.id, gameIds: [...c.nominees.map((n) => n.id), +pickGame.value] }); };
      return el('div', { class: 'aw-adm-cat' },
        el('div', { class: 'row', style: { justifyContent: 'space-between' } },
          el('div', {}, el('b', { class: 'no-i18n', text: c.name }), el('div', { class: 'small muted no-i18n', text: c.desc })),
          el('span', { class: 'small muted', text: tr(`${c.votes} votes`) }),
          el('button', { class: 'btn btn-small', text: '✕', title: 'Remove the category', onclick: () => { if (confirm(tr('Remove this category?'))) post({ op: 'removeCategory', id: s.id, category: c.id }); } })),
        el('div', { class: 'aw-adm-nom' },
          c.nominees.map((n) => el('span', { class: 'aw-adm-chip' + (c.winner === n.id ? ' win' : '') },
            el('span', { class: 'no-i18n', text: (c.winner === n.id ? '🏆 ' : '') + n.name + (s.status !== 'draft' ? ` (${c.tally[n.id] || 0})` : '') }),
            s.status === 'results' && c.winner !== n.id ? el('button', { title: 'Make this the winner', text: '🏆', onclick: () => post({ op: 'winner', id: s.id, category: c.id, gameId: n.id }, 'Winner changed') }) : null,
            el('button', { title: 'Take the nomination away', text: '×', onclick: () => post({ op: 'nominees', id: s.id, category: c.id, gameIds: c.nominees.filter((x) => x.id !== n.id).map((x) => x.id) }) }))),
          c.nominees.length < 8 ? pickGame : null));
    });
    const catName = el('input', { class: 'input', placeholder: 'New category, e.g. Best Roleplay', style: { maxWidth: '260px' } });
    const catDesc = el('input', { class: 'input', placeholder: 'What it is for (optional)', style: { maxWidth: '300px' } });
    return card(s.title, STAGE[s.status],
      el('div', { class: 'row wrap' },
        segBtns([['draft', 'Draft'], ['voting', 'Voting'], ['results', 'Results']], s.status, (v) => post({ op: 'status', id: s.id, status: v }, 'Stage changed')),
        el('a', { class: 'btn btn-small', href: `/awards?id=${s.id}`, target: '_blank', text: 'Open the page' }),
        el('button', { class: 'btn btn-small btn-red', text: 'Delete', onclick: () => { if (confirm(tr('Delete this season and its votes?'))) post({ op: 'delete', id: s.id }, 'Deleted'); } })),
      ...cats,
      el('div', { class: 'row wrap' }, catName, catDesc, el('button', { class: 'btn btn-small btn-primary', text: 'Add category', onclick: () => post({ op: 'addCategory', id: s.id, name: catName.value, desc: catDesc.value }, 'Category added') })));
  };
  body.replaceChildren(
    el('div', { class: 'adm-hero awards' }, el('div', {}, el('h2', { text: '🏆 Robis Awards' }), el('p', { text: 'Like the Bloxys: make a season, nominate games in each category, open the voting, then show the winners. Winners get a trophy on their game page. Bots vote too.' }))),
    card('New season', 'Starts as a draft with 6 categories you can change', el('div', { class: 'row wrap' }, title, el('button', { class: 'btn btn-primary', text: '+ Create season', onclick: () => post({ op: 'create', title: title.value }, 'Season created') }))),
    ...(r.seasons.length ? r.seasons.map(season) : [el('div', { class: 'panel empty', text: 'No seasons yet.' })]));
}
