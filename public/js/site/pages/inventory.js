import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, itemCard, qs, spinner } from '../ui.js';

const me = await initPage({ active: 'inventory' });
const app = document.getElementById('app');
const uid = +qs('id') || me.id;
const { user } = await api.get(`/users/${uid}`);
app.append(el('h1', { text: uid === me.id ? 'My Inventory' : `${user.username}'s Inventory` }));
const types = [['', 'All'], ['Hat', 'Hats'], ['Hair', 'Hair'], ['Face', 'Faces'], ['Shirt', 'Shirts'], ['Pants', 'Pants'], ['TShirt', 'T-Shirts'], ['Gear', 'Gear'], ['Pet', 'Pets'], ['GamePass', 'Game Passes']];
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(tabs, body);
for (const [t, label] of types) {
  const b = el('button', { text: label, onclick: async () => {
    [...tabs.children].forEach((x) => x.classList.toggle('active', x === b));
    body.replaceChildren(spinner());
    if (t === 'GamePass') {
      const { passes } = await api.get(`/users/${uid}/passes`);
      body.replaceChildren(passes.length ? el('div', { class: 'item-grid' }, passes.map((p) => el('a', { class: 'item-card pass-inv', href: `/game?id=${p.gameId}` },
        el('div', { class: 'pass-inv-icon', style: { background: p.color }, text: p.icon }),
        el('div', { class: 'name', text: p.name }), el('div', { class: 'small muted no-i18n', text: p.gameName }))))
        : el('div', { class: 'empty', text: 'Nothing here yet.' }));
      return;
    }
    const { items } = await api.get(`/users/${uid}/inventory${t ? '?type=' + t : ''}`);
    body.replaceChildren(items.length ? el('div', { class: 'item-grid' }, items.map((i) => itemCard(i))) : el('div', { class: 'empty', text: 'Nothing here yet.' }));
  } });
  tabs.append(b);
}
tabs.firstChild.click();

const style = document.createElement('style');
style.textContent = `
.pass-inv { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; text-align: center; }
.pass-inv-icon { width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 44px; box-shadow: inset 0 0 0 4px rgba(255,255,255,.4); }
`;
document.head.append(style);
