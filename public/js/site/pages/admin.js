// Admin Panel: players (with a full "Manage" card: password reset, rename,
// kick, Robits, items, rights, bans), games, Limited and player-made items,
// the log of every admin action, and a site-wide announcement.
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, fmtFull, fmtNum, headshotImg, toast, modal, timeAgo, spinner, nameBadges, itemCard, presenceText } from '../ui.js';
import { BADGE_SVG, BADGE_TITLE } from '../../badges.js';

const me = await initPage({ active: 'admin' });
const app = document.getElementById('app');
const perm = (p) => me.isAdmin || (me.perms || []).includes(p);
if (!perm('moderator') && !perm('economy')) {
  app.append(el('div', { class: 'panel empty', text: 'Only admins can open this page.' }));
  await new Promise(() => {});
}

app.append(el('h1', { text: 'Admin Panel' }));
const statsBox = el('div', { class: 'stat-grid' });
const announceBox = el('div');
const tabs = el('div', { class: 'tabs admin-tabs' });
const body = el('div', { class: 'panel admin-body' }, spinner());
app.append(statsBox, announceBox, tabs, body);

let data;
async function load() {
  data = await api.get('/admin/overview');
  const s = data.stats;
  statsBox.replaceChildren(...[
    ['Players', s.users], ['Online now', s.online], ['Playing now', s.playing], ['New today', s.newToday], ['Banned players', s.banned],
    ['Games', s.games], ['Catalog items', s.items], ['Robits in circulation', fmtNum(s.robits)], ['Open trades', s.trades], ['Items for sale', s.resales],
  ].map(([l, v]) => el('div', { class: 'panel stat' }, el('div', { class: 'value', text: v }), el('div', { class: 'label', text: l }))));
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

// ---------------------------------------------------------------- tabs
const TABS = {
  players: { label: 'Players', draw: drawPlayers },
  badges: { label: 'Badges', draw: drawBadges, admin: true },
  promo: { label: 'Promo Codes', draw: drawPromo, perm: 'economy' },
  hunt: { label: 'The Hunt', draw: drawHunt, admin: true },
  games: { label: 'Games', draw: drawGames },
  items: { label: 'Items', draw: drawItems },
  log: { label: 'Admin Log', draw: drawLog },
};
for (const [id, t] of Object.entries(TABS)) if ((t.admin && !me.isAdmin) || (t.perm && !perm(t.perm))) delete TABS[id];
let current = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'players';
function openTab(id) {
  current = id;
  [...tabs.children].forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  TABS[id].draw();
}
for (const [id, t] of Object.entries(TABS)) {
  const b = el('button', { class: id === current ? 'active' : '', text: t.label, onclick: () => { history.replaceState(null, '', '#' + id); openTab(id); } });
  b.dataset.tab = id;
  tabs.append(b);
}
addEventListener('hashchange', () => { const id = location.hash.slice(1); if (TABS[id] && id !== current) openTab(id); });

// ---------------------------------------------------------------- players
const search = el('input', { class: 'input', placeholder: 'Search players' });
const filter = el('select', { class: 'input', style: { width: 'auto', flex: 'none', minWidth: 0 } },
  [['all', 'Everyone'], ['online', 'Online'], ['banned', 'Banned'], ['staff', 'Staff'], ['badges', 'With badges'], ['new', 'New today']].map(([v, t]) => el('option', { value: v, text: t })));
const list = el('div');
search.addEventListener('input', () => drawList());
filter.addEventListener('change', () => drawList());

function drawPlayers() {
  body.replaceChildren(el('div', { class: 'row wrap', style: { marginBottom: '12px' } }, search, filter), list);
  drawList();
}
const FILTERS = {
  all: () => true,
  online: (u) => u.presence && u.presence.status !== 'offline',
  banned: (u) => u.banned,
  staff: (u) => u.isAdmin || (u.perms || []).length,
  badges: (u) => (u.flags || []).length > 0,
  new: (u) => Date.now() - u.created < 24 * 3600e3,
};
function drawList() {
  const q = search.value.trim().toLowerCase();
  const users = data.users.filter((u) => (!q || u.username.toLowerCase().includes(q)) && FILTERS[filter.value](u));
  list.replaceChildren(...(users.length ? users.slice(0, 200).map(row) : [el('div', { class: 'empty', text: 'No players found.' })]));
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
    ...(u.perms || []).map((p) => el('span', { class: 'pill perm-pill', text: PERM_NAMES[p] || p })),
    u.banned ? el('span', { class: 'pill ban-pill', text: (u.deviceBan ? 'Device ban' : 'Banned') + (u.banUntil ? ' until ' + new Date(u.banUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '') }) : null,
  ];
}

function row(u) {
  const self = u.id === me.id;
  const st = u.presence?.status || 'offline';
  return el('div', { class: 'admin-row' + (u.banned ? ' banned' : '') },
    el('a', { class: 'admin-head', href: `/profile?id=${u.id}` }, headshotImg(u, 96), st !== 'offline' ? el('span', { class: 'presence-dot ' + st }) : null),
    el('div', { class: 'admin-info' },
      el('div', {}, el('a', { href: `/profile?id=${u.id}` }, el('b', { class: 'no-i18n', text: u.username })), nameBadges(u), ...pills(u)),
      el('div', { class: 'small muted', text: `R$ ${fmtFull(u.robits)} · ${u.items} items · ${u.games} games · joined ${timeAgo(u.created)}` }),
      st !== 'offline' ? el('div', { class: 'small online-text', text: presenceText(u.presence) }) : null),
    el('div', { class: 'admin-actions' },
      el('button', { class: 'btn btn-small btn-primary', text: 'Manage', onclick: () => manage(u) }),
      self || !perm('moderator') ? null : el('button', { class: 'btn btn-small' + (u.banned ? '' : ' btn-red'), text: u.banned ? 'Unban' : 'Ban', onclick: () => ban(u) })));
}

// The player card: everything about one account, grouped.
async function manage(u0) {
  const box = el('div', { class: 'manage' }, spinner());
  const m = modal({ title: u0.username, width: 760, body: box });
  let info;
  try { info = await api.get(`/admin/users/${u0.id}`); } catch (e) { box.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const u = info.user;
  const self = u.id === me.id;
  const lockedAdmin = u.isAdmin && !me.isAdmin;
  const go = (fn) => () => { m.close(); fn(u); };
  const fact = (k, v) => el('div', { class: 'fact' }, el('span', { class: 'muted', text: k }), el('b', { text: String(v) }));
  const section = (title, ...btns) => {
    const b = btns.filter(Boolean);
    return b.length ? el('div', { class: 'manage-section' }, el('h4', { text: title }), el('div', { class: 'row wrap' }, b)) : null;
  };
  const tier = el('select', { class: 'input', style: { width: 'auto' } },
    data.memberships.map((t) => el('option', { value: t.id, text: t.name, selected: (u.membership || 'None') === t.id })));
  tier.onchange = () => act(`/admin/users/${u.id}/membership`, { tier: tier.value }, 'Membership updated');
  const canMod = perm('moderator') && !self && !lockedAdmin;

  box.replaceChildren(
    el('div', { class: 'manage-top' },
      el('a', { class: 'admin-head big', href: `/profile?id=${u.id}` }, headshotImg(u, 150)),
      el('div', {},
        el('div', {}, el('b', { class: 'no-i18n', style: { fontSize: '20px' }, text: u.username }), nameBadges(u), ...pills(u)),
        el('div', { class: 'small muted', text: presenceText(u.presence) }),
        u.previousNames.length ? el('div', { class: 'small muted' }, 'Previously: ', el('span', { class: 'no-i18n', text: u.previousNames.join(', ') })) : null,
        u.banned && u.banReason ? el('div', { class: 'small', style: { color: '#d0021b' } }, 'Ban reason: ', el('span', { class: 'no-i18n', text: u.banReason })) : null)),
    el('div', { class: 'facts' },
      fact('Robits', fmtFull(u.robits)), fact('Items', u.items), fact('Games', u.games), fact('Friends', u.friends), fact('Trades', u.trades),
      fact('Joined', new Date(u.created).toLocaleDateString()), fact('Devices', u.devices), fact('IPs', u.ips), fact('Logged in on', u.sessions)),
    section('Account',
      canMod ? el('button', { class: 'btn btn-small btn-primary', text: 'Reset password', onclick: go(resetPassword) }) : null,
      perm('moderator') && !lockedAdmin ? el('button', { class: 'btn btn-small', text: 'Change username', onclick: go(rename) }) : null,
      canMod ? el('button', { class: 'btn btn-small', text: 'Log out everywhere', onclick: () => act(`/admin/users/${u.id}/logout`, {}, `${u.username} was logged out`) }) : null,
      canMod && u.presence?.status === 'ingame' ? el('button', { class: 'btn btn-small', text: 'Kick from game', onclick: go(kick) }) : null),
    section('Economy',
      perm('economy') ? el('button', { class: 'btn btn-small btn-green', text: 'Give Robits', onclick: go(giveRobits) }) : null,
      perm('economy') ? el('button', { class: 'btn btn-small', text: 'Give all items', onclick: () => act(`/admin/users/${u.id}/items`, { all: true }, `${u.username} now owns every item`) }) : null,
      perm('economy') ? el('button', { class: 'btn btn-small', text: 'Take items', onclick: go(takeItems) }) : null,
      perm('economy') ? tier : null),
    me.isAdmin ? section('Rights',
      self ? null : el('button', { class: 'btn btn-small', text: u.isAdmin ? 'Remove admin' : 'Make admin', onclick: () => { m.close(); act(`/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }, u.isAdmin ? 'Admin removed' : `${u.username} is now an admin`); } }),
      self || u.isAdmin ? null : el('button', { class: 'btn btn-small', text: 'Permissions', onclick: go(permsDialog) })) : null,
    me.isAdmin ? el('div', { class: 'manage-section' }, el('h4', { text: 'Badges' }), badgePicker(u, (nu) => {
      Object.assign(u, { flags: nu.flags });
      box.querySelector('.manage-top .name-badges')?.remove();
      const nb = nameBadges(nu);
      if (nb) box.querySelector('.manage-top b').after(nb);
    })) : null,
    section('Moderation',
      canMod ? el('button', { class: 'btn btn-small' + (u.banned ? '' : ' btn-red'), text: u.banned ? 'Unban' : 'Ban', onclick: go(ban) }) : null,
      canMod ? el('button', { class: 'btn btn-small btn-red', text: 'Delete account', onclick: go(deleteAccount) }) : null),
    el('div', { class: 'manage-cols' },
      el('div', {}, el('h4', { text: 'Recent transactions' }),
        info.transactions.length ? el('div', { class: 'mini-list' }, info.transactions.map((t) => el('div', { class: 'mini-row' },
          el('span', { class: 'mini-amount ' + (t.amount > 0 ? 'plus' : t.amount < 0 ? 'minus' : ''), text: t.amount ? (t.amount > 0 ? '+' : '') + fmtFull(t.amount) : '·' }),
          el('span', { class: 'mini-text', text: t.desc }), el('span', { class: 'muted small', text: timeAgo(t.time) }))))
          : el('div', { class: 'muted small', text: 'Nothing yet.' })),
      el('div', {}, el('h4', { text: 'Admin actions' }),
        info.log.length ? el('div', { class: 'mini-list' }, info.log.map((e) => el('div', { class: 'mini-row' },
          el('span', { class: 'mini-text' }, el('b', { class: 'no-i18n', text: e.byName }), ' · ', el('span', { text: e.action })), el('span', { class: 'muted small', text: timeAgo(e.time) }))))
          : el('div', { class: 'muted small', text: 'Nothing yet.' }))));
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
// Private (admins only) until it's switched on; pick official games, and how
// many of the most popular player games join automatically.
async function drawHunt() {
  body.replaceChildren(spinner());
  let h;
  try { h = await api.get('/admin/hunt'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const pub = el('input', { type: 'checkbox', checked: h.public });
  const auto = el('input', { class: 'input', type: 'number', min: 0, max: 20, value: h.autoPlayers, style: { width: '90px' } });
  const boxes = h.official.map((g) => {
    const cb = el('input', { type: 'checkbox', checked: h.games.includes(g.id) });
    cb.dataset.id = g.id;
    return el('label', { class: 'perm-row' }, cb, el('span', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: ` · ${fmtNum(g.visits || 0)} visits` }));
  });
  const save = async () => {
    try {
      await api.post('/admin/hunt', { public: pub.checked, autoPlayers: +auto.value, games: boxes.map((b) => b.firstChild).filter((c) => c.checked).map((c) => +c.dataset.id) });
      toast(pub.checked ? 'The Hunt is open for everyone!' : 'Saved (still private)', 'success');
      drawHunt();
    } catch (e) { toast(e.message, 'error'); }
  };
  body.replaceChildren(
    el('div', { class: 'badge-give' },
      el('h3', { text: 'The Hunt' }),
      el('p', { class: 'small muted', text: 'A hub with portals to every game in the event. A golden token is hidden in each game (placed automatically, even in player games). Every token gives 25 R$; 8 prizes from the first token up to the Hunter\'s Golden Crown for all of them.' }),
      el('label', { class: 'perm-row' }, pub, el('b', { text: 'Open for everyone' }), el('span', { class: 'small muted', text: ' (off: only admins can see the page, play the hub and find tokens)' })),
      el('div', { class: 'row wrap', style: { gap: '12px', margin: '10px 0' } },
        el('a', { class: 'btn', href: '/hunt', text: 'Open the event page' }),
        h.hubId ? el('a', { class: 'btn', href: `/game?id=${h.hubId}`, text: 'Hub game' }) : null,
        el('span', { class: 'small muted', text: `${h.finders} players found tokens` }))),
    el('h4', { text: 'Official games' }), el('div', { class: 'hunt-admin-games' }, boxes),
    el('label', { class: 'row', style: { gap: '8px', margin: '12px 0' } }, el('span', { text: 'Most popular player games to add' }), auto),
    el('h4', { text: `In the event now (${h.event.length})` }),
    el('div', { class: 'promo-chosen' }, h.event.map((g) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: g.name }), el('span', { class: 'small muted', text: g.byPlayer ? ' · ' + g.creator : ' · official' })))),
    el('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, text: 'Save', onclick: save }));
}

// Admins give other players rights (see PERMISSIONS in server/api.js).
function permsDialog(u) {
  const boxes = data.permissions.map((p) => {
    const cb = el('input', { type: 'checkbox', checked: (u.perms || []).includes(p.id) });
    cb.dataset.perm = p.id;
    return el('label', { class: 'perm-row' }, cb, el('span', { text: p.label }));
  });
  modal({
    title: `Permissions for ${u.username}`,
    body: el('div', {}, el('p', { class: 'small muted', text: 'Admins have every right. Give other players only what they need.' }), boxes),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: () => act(`/admin/users/${u.id}/perms`, { perms: boxes.map((b) => b.firstChild).filter((c) => c.checked).map((c) => c.dataset.perm) }, 'Permissions saved') }, { text: 'Cancel' }],
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
  if (u.banned) { act(`/admin/users/${u.id}/ban`, { banned: false }, `${u.username} was unbanned`); return; }
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
