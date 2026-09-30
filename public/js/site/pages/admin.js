import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, fmtFull, fmtNum, headshotImg, toast, modal, timeAgo, spinner } from '../ui.js';

const me = await initPage({ active: 'admin' });
const app = document.getElementById('app');
if (!me.isAdmin) {
  app.append(el('div', { class: 'panel empty', text: 'Only admins can open this page.' }));
  await new Promise(() => {});
}

app.append(el('h1', { text: 'Admin Panel' }));
const statsBox = el('div', { class: 'stat-grid' });
const search = el('input', { class: 'input', placeholder: 'Search players' });
const list = el('div', {}, spinner());
app.append(statsBox, el('div', { class: 'panel' }, el('div', { class: 'row', style: { marginBottom: '12px' } }, el('h2', { style: { margin: 0 }, text: 'Players' }), el('div', { class: 'spacer' }), search), list));

let data;
async function load() {
  data = await api.get('/admin/overview');
  const s = data.stats;
  statsBox.replaceChildren(...[['Players', s.users], ['Games', s.games], ['Catalog items', s.items], ['Robits in circulation', fmtNum(s.robits)], ['Playing now', s.playing]]
    .map(([l, v]) => el('div', { class: 'panel stat' }, el('div', { class: 'value', text: v }), el('div', { class: 'label', text: l }))));
  draw();
}

function draw() {
  const q = search.value.trim().toLowerCase();
  const users = data.users.filter((u) => !q || u.username.toLowerCase().includes(q));
  list.replaceChildren(...(users.length ? users.map(row) : [el('div', { class: 'empty', text: 'No players found.' })]));
}
search.addEventListener('input', draw);

function replaceUser(u) {
  const i = data.users.findIndex((x) => x.id === u.id);
  if (i >= 0) data.users[i] = u;
  if (u.id === me.id) setRobits(u.robits);
  draw();
}

async function act(path, body, msg) {
  try {
    const r = await api.post(path, body);
    replaceUser(r.user);
    if (msg) toast(msg, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function row(u) {
  const self = u.id === me.id;
  const tier = el('select', { class: 'input', style: { width: 'auto' } },
    data.memberships.map((m) => el('option', { value: m.id, text: m.name, selected: (u.membership || 'None') === m.id })));
  tier.onchange = () => act(`/admin/users/${u.id}/membership`, { tier: tier.value }, 'Membership updated');
  return el('div', { class: 'admin-row' + (u.banned ? ' banned' : '') },
    el('a', { class: 'admin-head', href: `/profile?id=${u.id}` }, headshotImg(u, 96)),
    el('div', { class: 'admin-info' },
      el('div', {}, el('a', { href: `/profile?id=${u.id}` }, el('b', { text: u.username })),
        u.isAdmin ? el('span', { class: 'pill admin-pill', text: 'Admin' }) : null,
        u.banned ? el('span', { class: 'pill ban-pill', text: (u.deviceBan ? 'Device ban' : 'Banned') + (u.banUntil ? ' until ' + new Date(u.banUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '') }) : null),
      el('div', { class: 'small muted', text: `R$ ${fmtFull(u.robits)} · ${u.items} items · ${u.games} games · joined ${timeAgo(u.created)}` })),
    el('div', { class: 'admin-actions' },
      el('button', { class: 'btn btn-small btn-green', text: 'Give Robits', onclick: () => giveRobits(u) }),
      el('button', { class: 'btn btn-small', text: 'Give all items', onclick: () => act(`/admin/users/${u.id}/items`, { all: true }, `${u.username} now owns every item`) }),
      tier,
      self ? null : el('button', { class: 'btn btn-small', text: u.isAdmin ? 'Remove admin' : 'Make admin', onclick: () => act(`/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }, u.isAdmin ? 'Admin removed' : `${u.username} is now an admin`) }),
      self ? null : el('button', { class: 'btn btn-small btn-red', text: u.banned ? 'Unban' : 'Ban', onclick: () => ban(u) })));
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

load();

const style = document.createElement('style');
style.textContent = `
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-grid .panel + .panel { margin-top: 0; }
.stat { text-align: center; }
.stat .value { font-size: 26px; font-weight: 700; }
.stat .label { font-size: 13px; color: var(--text-light); }
.admin-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.admin-row.banned { opacity: .6; }
.admin-head { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: #d4d4d4; flex: none; }
.admin-head img { width: 100%; height: 100%; }
.admin-info { flex: 1; min-width: 180px; }
.admin-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.admin-actions select.input { padding: 4px 6px; font-size: 13px; }
.admin-pill { background: var(--blue); color: #fff; margin-left: 6px; }
.ban-pill { background: #d0021b; color: #fff; margin-left: 6px; }
`;
document.head.append(style);
