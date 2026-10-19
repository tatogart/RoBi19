import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, itemCard, qs } from '../ui.js';

const me = await initPage({ active: 'inventory' });
const app = document.getElementById('app');
const uid = +qs('id') || me.id;
const { user } = await api.get(`/users/${uid}`);
app.append(el('h1', { text: uid === me.id ? 'My Inventory' : `${user.username}'s Inventory` }));
const types = [['', 'All'], ['Hat', 'Hats'], ['Hair', 'Hair'], ['Accessory', 'Accessories'], ['Face', 'Faces'], ['Shirt', 'Shirts'], ['Pants', 'Pants'], ['TShirt', 'T-Shirts'], ['Gear', 'Gear'], ['Pet', 'Pets'], ['GamePass', 'Game Passes']];
// 2020: one load, then search, sort and the type tabs (with counts) work instantly
const [{ items: all }, { passes }] = await Promise.all([api.get(`/users/${uid}/inventory`), api.get(`/users/${uid}/passes`)]);
const wearing = new Set(uid === me.id ? ((me.rawAvatar && me.rawAvatar.wearing) || []) : []);
const order = new Map(all.map((it, i) => [it.id, i]));
const value = all.reduce((a, it) => a + (it.price || 0), 0);
app.append(el('div', { class: 'inv-stats' },
  el('span', {}, el('b', { text: String(all.length) }), ' ', el('span', { text: 'items' })),
  el('span', {}, el('b', { text: String(all.filter((i) => i.limited).length) }), ' ', el('span', { text: 'Limiteds' })),
  el('span', {}, el('b', { class: 'no-i18n', text: 'R$ ' + value.toLocaleString('en-US') }), ' ', el('span', { text: 'catalog value' }))));
const q = el('input', { class: 'input', placeholder: 'Search this inventory' });
const sort = el('select', { class: 'input', style: { width: 'auto', flex: 'none' } },
  [['new', 'Newest first'], ['old', 'Oldest first'], ['name', 'Name'], ['price', 'Most expensive'], ['limited', 'Limiteds first']].map(([v, t]) => el('option', { value: v, text: t })));
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(el('div', { class: 'row wrap', style: { gap: '8px', marginBottom: '10px' } }, q, sort), tabs, body);
let current = '';
function draw() {
  if (current === 'GamePass') {
    body.replaceChildren(passes.length ? el('div', { class: 'item-grid' }, passes.map((p) => el('a', { class: 'item-card pass-inv', href: `/game?id=${p.gameId}` },
      el('div', { class: 'pass-inv-icon', style: { background: p.color }, text: p.icon }),
      el('div', { class: 'name', text: p.name }), el('div', { class: 'small muted no-i18n', text: p.gameName }))))
      : el('div', { class: 'empty', text: 'Nothing here yet.' }));
    return;
  }
  const f = q.value.trim().toLowerCase();
  const list = all.filter((i) => (!current || i.type === current) && (!f || i.name.toLowerCase().includes(f)));
  const S = { new: (a, b) => order.get(b.id) - order.get(a.id), old: (a, b) => order.get(a.id) - order.get(b.id), name: (a, b) => a.name.localeCompare(b.name), price: (a, b) => (b.price || 0) - (a.price || 0), limited: (a, b) => (b.limited - a.limited) || order.get(b.id) - order.get(a.id) }[sort.value];
  list.sort(S);
  body.replaceChildren(list.length ? el('div', { class: 'item-grid' }, list.map((i) => {
    const card = itemCard(i);
    if (wearing.has(i.id)) card.append(el('span', { class: 'wearing-tag', text: 'Wearing' }));
    return card;
  })) : el('div', { class: 'empty', text: f ? 'Nothing matches.' : 'Nothing here yet.' }));
}
for (const [t, label] of types) {
  const n = t === 'GamePass' ? passes.length : t ? all.filter((i) => i.type === t).length : all.length;
  if (t && !n) continue; // no empty tabs
  const b = el('button', { onclick: () => { current = t; [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); draw(); } },
    el('span', { text: label }), el('span', { class: 'tab-count no-i18n', text: String(n) }));
  tabs.append(b);
}
q.addEventListener('input', draw);
sort.addEventListener('change', draw);
tabs.firstChild.classList.add('active');
draw();

const style = document.createElement('style');
style.textContent = `
.inv-stats { display: flex; gap: 18px; flex-wrap: wrap; margin: -6px 0 12px; color: var(--text-light); }
.inv-stats b { color: var(--text); font-size: 18px; }
.tab-count { margin-left: 5px; font-size: 11px; background: var(--gray-bg); color: var(--text-light); border-radius: 8px; padding: 0 6px; }
.item-card { position: relative; }
.wearing-tag { position: absolute; left: 6px; bottom: 58px; background: #02b757; color: #fff; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 2px; }
.pass-inv { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; text-align: center; }
.pass-inv-icon { width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 44px; box-shadow: inset 0 0 0 4px rgba(255,255,255,.4); }
`;
document.head.append(style);
