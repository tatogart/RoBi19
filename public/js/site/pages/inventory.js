import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, itemCard, qs, spinner } from '../ui.js';

const me = await initPage({ active: 'inventory' });
const app = document.getElementById('app');
const uid = +qs('id') || me.id;
const { user } = await api.get(`/users/${uid}`);
app.append(el('h1', { text: uid === me.id ? 'My Inventory' : `${user.username}'s Inventory` }));
const types = [['', 'All'], ['Hat', 'Hats'], ['Hair', 'Hair'], ['Face', 'Faces'], ['Shirt', 'Shirts'], ['Pants', 'Pants'], ['TShirt', 'T-Shirts'], ['Gear', 'Gear'], ['Pet', 'Pets']];
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(tabs, body);
for (const [t, label] of types) {
  const b = el('button', { text: label, onclick: async () => {
    [...tabs.children].forEach((x) => x.classList.toggle('active', x === b));
    body.replaceChildren(spinner());
    const { items } = await api.get(`/users/${uid}/inventory${t ? '?type=' + t : ''}`);
    body.replaceChildren(items.length ? el('div', { class: 'item-grid' }, items.map((i) => itemCard(i))) : el('div', { class: 'empty', text: 'Nothing here yet.' }));
  } });
  tabs.append(b);
}
tabs.firstChild.click();
