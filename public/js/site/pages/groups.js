// Groups: search, your groups and making a new one (R$100, like in 2019).
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, fmtNum, toast, modal, spinner, icon, groupEmblem as emblem } from '../ui.js';

const me = await initPage({ active: 'groups' });
const app = document.getElementById('app');
const search = el('input', { class: 'input', placeholder: 'Search groups' });
const mineBox = el('div', { class: 'group-grid' });
const allBox = el('div', { class: 'group-grid' }, spinner());
let data;

function card(gr) {
  return el('a', { class: 'group-card', href: `/group?id=${gr.id}` },
    emblem(gr),
    el('div', { class: 'gc-info' },
      el('div', { class: 'gc-name no-i18n', text: gr.name }),
      el('div', { class: 'small muted', text: `${fmtNum(gr.memberCount)} ${gr.memberCount === 1 ? 'member' : 'members'}` }),
      gr.myRole ? el('span', { class: 'pill gc-role', text: { owner: 'Owner', admin: 'Admin', member: 'Member' }[gr.myRole] }) : null));
}

async function load() {
  data = await api.get('/groups' + (search.value.trim() ? '?q=' + encodeURIComponent(search.value.trim()) : ''));
  mineBox.replaceChildren(...(data.mine.length ? data.mine.map(card) : [el('div', { class: 'muted', text: 'You are not in any groups yet. Join one below or create your own!' })]));
  allBox.replaceChildren(...(data.groups.length ? data.groups.map(card) : [el('div', { class: 'empty', text: 'No groups found.' })]));
}

function createDialog() {
  const name = el('input', { class: 'input', maxlength: 40, placeholder: 'Group name' });
  const desc = el('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: 'What is your group about?' });
  const color = el('input', { type: 'color', value: '#0d69ac' });
  let icon = data.icons[0];
  const preview = el('span', { class: 'group-emblem lg', style: { background: color.value }, text: icon });
  color.oninput = () => { preview.style.background = color.value; };
  const icons = el('div', { class: 'icon-pick' }, data.icons.map((ic) => el('button', { type: 'button', class: 'btn btn-small' + (ic === icon ? ' btn-primary' : ''), text: ic, onclick: (e) => {
    icon = ic; preview.textContent = ic;
    [...icons.children].forEach((b) => b.classList.toggle('btn-primary', b === e.currentTarget));
  } })));
  const approval = el('input', { type: 'checkbox' });
  modal({
    title: 'Create Group',
    width: 560,
    body: el('div', {},
      el('div', { class: 'row', style: { marginBottom: '10px' } }, preview, el('div', { class: 'small muted', text: me.isAdmin ? 'Free for admins.' : `Creating a group costs R$${data.price}.` })),
      el('label', { class: 'field' }, 'Name', name),
      el('label', { class: 'field' }, 'Description', desc),
      el('label', { class: 'field' }, 'Emblem colour ', color),
      el('div', { class: 'field' }, el('div', { text: 'Emblem symbol', style: { fontWeight: 600, marginBottom: '4px' } }), icons),
      el('label', { class: 'perm-row' }, approval, el('span', { text: 'New members need approval' }))),
    buttons: [{ text: 'Create', cls: 'btn-green', onClick: async () => {
      try {
        const r = await api.post('/groups', { name: name.value, description: desc.value, color: color.value, icon, approval: approval.checked });
        setRobits(r.robits);
        location.href = `/group?id=${r.group.id}`;
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

let timer;
search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
app.append(
  el('div', { class: 'row wrap', style: { justifyContent: 'space-between' } }, el('h1', { text: 'Groups' }),
    el('button', { class: 'btn btn-green', onclick: () => createDialog() }, icon('groups'), ' Create Group')),
  el('div', { class: 'panel' }, el('h3', { text: 'My Groups' }), mineBox),
  el('div', { class: 'panel' }, el('div', { class: 'row wrap', style: { marginBottom: '12px' } }, el('h3', { style: { margin: 0 }, text: 'Popular Groups' }), el('div', { class: 'spacer' }), search), allBox));
await load();
