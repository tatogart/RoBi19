// One group: emblem, owner, shout, about, the wall, members (with roles) and,
// for the group's admins, join requests and settings.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, fmtNum, fmtDate, timeAgo, toast, modal, spinner, headshotImg, userLink, groupEmblem } from '../ui.js';

const me = await initPage({ active: 'groups', requireAuth: false });
const app = document.getElementById('app');
const id = +qs('id');
let gr;
try { ({ group: gr } = await api.get(`/groups/${id}`)); } catch {
  app.append(el('div', { class: 'panel empty', text: 'Group not found.' }));
  await new Promise(() => {});
}
document.title = `${gr.name} - Robis`;
const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const isMod = me && (me.isAdmin || (me.perms || []).includes('moderator'));
const canAdmin = () => isMod || gr.myRole === 'owner' || gr.myRole === 'admin';

const header = el('div');
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(header, tabs, body);
let tab = 'wall';

async function act(promise, msg) {
  try {
    const r = await promise;
    if (r.group) gr = r.group;
    if (msg) toast(msg, 'success');
    draw();
    return r;
  } catch (e) { toast(e.message, 'error'); return null; }
}

function drawHeader() {
  const actions = el('div', { class: 'row wrap' });
  if (me) {
    if (!gr.myRole && !gr.requested) actions.append(el('button', { class: 'btn btn-green', text: gr.approval ? 'Request to Join' : 'Join Group', onclick: () => act(api.post(`/groups/${id}/join`), gr.approval ? 'Request sent!' : 'Welcome to the group!') }));
    if (gr.requested) actions.append(el('button', { class: 'btn', text: 'Request Pending', disabled: true }));
    if (gr.myRole && gr.myRole !== 'owner') actions.append(el('button', { class: 'btn', text: 'Leave Group', onclick: () => { if (confirm('Leave this group?')) act(api.post(`/groups/${id}/leave`), 'You left the group'); } }));
    if (gr.myRole) actions.append(el('button', { class: 'btn', text: 'Make Primary', title: 'Show this group on your profile', onclick: () => act(api.post(`/groups/${id}/primary`), 'Shown on your profile') }));
  }
  header.replaceChildren(el('div', { class: 'panel group-header' },
    groupEmblem(gr, 'xl'),
    el('div', { class: 'gh-main' },
      el('h1', { class: 'no-i18n', text: gr.name }),
      el('div', { class: 'muted' }, 'By ', gr.owner ? userLink(gr.owner) : '—'),
      el('div', { class: 'gh-stats' },
        el('span', {}, el('b', { text: fmtNum(gr.memberCount) }), ' ', el('span', { text: gr.memberCount === 1 ? 'Member' : 'Members' })),
        gr.myRole ? el('span', { class: 'pill gc-role', text: ROLE[gr.myRole] }) : null,
        gr.approval ? el('span', { class: 'pill', text: 'Approval needed' }) : null),
      actions)),
  gr.shout || canAdmin() ? el('div', { class: 'panel group-shout' },
    el('h3', { text: 'Group Shout' }),
    gr.shout ? el('div', {}, el('div', { class: 'shout-text no-i18n', text: gr.shout.text }), el('div', { class: 'small muted' }, el('span', { class: 'no-i18n', text: gr.shout.username }), ' · ', el('span', { text: timeAgo(gr.shout.time) }))) : el('div', { class: 'muted small', text: 'No shout yet.' }),
    canAdmin() ? shoutForm() : null) : null,
  el('div', { class: 'panel' }, el('h3', { text: 'About' }), el('p', { class: 'no-i18n group-about', text: gr.description || '' }), el('div', { class: 'small muted', text: `Created ${fmtDate(gr.created)}` })));
}

function shoutForm() {
  const input = el('input', { class: 'input', maxlength: 255, placeholder: 'Shout to everyone in the group' });
  return el('div', { class: 'row', style: { marginTop: '10px' } }, input,
    el('button', { class: 'btn btn-primary', text: 'Shout', onclick: () => act(api.post(`/groups/${id}/shout`, { text: input.value }), 'Shout posted') }));
}

function drawTabs() {
  const list = [['wall', 'Wall'], ['members', `Members (${gr.memberCount})`]];
  if (canAdmin() && me) list.push(['requests', `Requests (${(gr.requests || []).length})`], ['settings', 'Settings']);
  tabs.replaceChildren(...list.map(([k, label]) => el('button', { class: k === tab ? 'active' : '', text: label, onclick: () => { tab = k; draw(); } })));
}

function drawWall() {
  const input = el('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: 'Say something to the group' });
  const form = gr.myRole ? el('div', { class: 'row', style: { marginBottom: '14px', alignItems: 'flex-start' } }, input,
    el('button', { class: 'btn btn-primary', text: 'Post', onclick: () => act(api.post(`/groups/${id}/wall`, { text: input.value })) }))
    : el('p', { class: 'muted small', text: me ? 'Join the group to post on its wall.' : 'Log in and join the group to post on its wall.' });
  body.replaceChildren(form, gr.wall.length ? el('div', { class: 'wall' }, gr.wall.map((p) => el('div', { class: 'wall-post' },
    el('a', { class: 'wall-head', href: `/profile?id=${p.user.id}` }, headshotImg(p.user, 64)),
    el('div', { class: 'wall-body' },
      el('div', {}, userLink(p.user), el('span', { class: 'small muted', text: ' · ' + timeAgo(p.time) })),
      el('div', { class: 'no-i18n wall-text', text: p.text })),
    me && (p.user.id === me.id || canAdmin()) ? el('button', { class: 'btn btn-small', title: 'Delete', text: '✕', onclick: () => act(api.del(`/groups/${id}/wall/${p.id}`)) }) : null)))
    : el('div', { class: 'empty', text: 'Nothing on the wall yet.' }));
}

function drawMembers() {
  body.replaceChildren(el('div', { class: 'member-list' }, gr.members.map((m) => {
    const controls = [];
    if (me && m.user.id !== me.id && m.role !== 'owner') {
      if (gr.myRole === 'owner' || isMod) {
        controls.push(el('button', { class: 'btn btn-small', text: m.role === 'admin' ? 'Make Member' : 'Make Admin', onclick: () => act(api.post(`/groups/${id}/members/${m.user.id}`, { action: m.role === 'admin' ? 'member' : 'admin' }), 'Role changed') }));
        controls.push(el('button', { class: 'btn btn-small', text: 'Make Owner', onclick: () => { if (confirm(`Give the group to ${m.user.username}? You will become an admin.`)) act(api.post(`/groups/${id}/members/${m.user.id}`, { action: 'owner' }), 'Ownership transferred'); } }));
      }
      if (gr.myRole === 'owner' || isMod || (gr.myRole === 'admin' && m.role === 'member')) {
        controls.push(el('button', { class: 'btn btn-small btn-red', text: 'Kick', onclick: () => { if (confirm(`Remove ${m.user.username} from the group?`)) act(api.post(`/groups/${id}/members/${m.user.id}`, { action: 'kick' }), 'Removed'); } }));
      }
    }
    return el('div', { class: 'member-row' },
      el('a', { class: 'wall-head', href: `/profile?id=${m.user.id}` }, headshotImg(m.user, 64)),
      el('div', { class: 'member-info' }, userLink(m.user), el('span', { class: 'pill role-' + m.role, text: ROLE[m.role] })),
      el('div', { class: 'row wrap' }, controls));
  })));
}

function drawRequests() {
  const reqs = gr.requests || [];
  body.replaceChildren(reqs.length ? el('div', { class: 'member-list' }, reqs.map((u) => el('div', { class: 'member-row' },
    el('a', { class: 'wall-head', href: `/profile?id=${u.id}` }, headshotImg(u, 64)),
    el('div', { class: 'member-info' }, userLink(u)),
    el('div', { class: 'row' },
      el('button', { class: 'btn btn-small btn-green', text: 'Accept', onclick: () => act(api.post(`/groups/${id}/requests/${u.id}`, { accept: true }), 'Accepted') }),
      el('button', { class: 'btn btn-small', text: 'Decline', onclick: () => act(api.post(`/groups/${id}/requests/${u.id}`, { accept: false })) })))))
    : el('div', { class: 'empty', text: 'No join requests.' }));
}

function drawSettings() {
  const desc = el('textarea', { class: 'input', rows: 4, maxlength: 1000 }, gr.description || '');
  desc.value = gr.description || '';
  const color = el('input', { type: 'color', value: gr.color });
  const approval = el('input', { type: 'checkbox', checked: gr.approval });
  body.replaceChildren(
    el('label', { class: 'field' }, 'Description', desc),
    el('label', { class: 'field' }, 'Emblem colour ', color),
    el('label', { class: 'perm-row' }, approval, el('span', { text: 'New members need approval' })),
    el('div', { class: 'row wrap' },
      el('button', { class: 'btn btn-primary', text: 'Save', onclick: () => act(api.post(`/groups/${id}`, { description: desc.value, color: color.value, approval: approval.checked }), 'Saved') }),
      gr.myRole === 'owner' || isMod ? el('button', { class: 'btn btn-red', text: 'Delete Group', onclick: async () => {
        if (!confirm(`Delete ${gr.name} for good?`)) return;
        try { await api.del(`/groups/${id}`); location.href = '/groups'; } catch (e) { toast(e.message, 'error'); }
      } }) : null));
}

function draw() {
  drawHeader();
  drawTabs();
  ({ wall: drawWall, members: drawMembers, requests: drawRequests, settings: drawSettings })[tab]?.();
}
draw();
