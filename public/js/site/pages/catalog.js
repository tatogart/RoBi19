import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, spinner, itemCard } from '../ui.js';
import { saleBanner } from '../gifts.js';

await initPage({ active: 'catalog', requireAuth: false });
const app = document.getElementById('app');

const CATS = [['All', 'All Categories'], ['Featured', 'Featured'], ['Accessories', 'Accessories'], ['Hat', '— Hats'], ['Hair', '— Hair'], ['Face', 'Faces'], ['Clothing', 'Clothing'], ['Shirt', '— Shirts'], ['Pants', '— Pants'], ['TShirt', '— T-Shirts'], ['Gear', 'Gear'], ['Pet', 'Pets'], ['Collectibles', 'Collectibles']];
let cat = qs('type') || 'All';
const side = el('div', { class: 'panel cat-side' }, el('h3', { text: 'Category' }));
const catBtns = CATS.map(([k, label]) => {
  const b = el('button', { class: 'cat-btn', text: label, onclick: () => { cat = k; load(); } });
  b.dataset.k = k;
  return b;
});
side.append(...catBtns);
const search = el('input', { class: 'input', placeholder: 'Search catalog', value: qs('q') || '' });
const sort = el('select', { class: 'input', style: { width: 'auto' } },
  [['popular', 'Best Selling'], ['recent', 'Recently Updated'], ['price-asc', 'Price (Low to High)'], ['price-desc', 'Price (High to Low)']].map(([v, t]) => el('option', { value: v, text: t })));
const grid = el('div', { class: 'item-grid' });
app.append(el('h1', { text: 'Catalog' }),
  el('div', { class: 'catalog-wrap' }, side,
    el('div', { style: { flex: 1, minWidth: 0 } },
      el('form', { class: 'row', style: { marginBottom: '16px' }, onsubmit: (e) => { e.preventDefault(); load(); } }, search, sort, el('button', { class: 'btn btn-primary', text: 'Search' })),
      grid)));
sort.onchange = load;
saleBanner().then((b) => { if (b) app.querySelector('h1').after(b); });

async function load() {
  for (const b of catBtns) b.classList.toggle('active', b.dataset.k === cat);
  grid.replaceChildren(spinner());
  const type = cat === 'Featured' ? 'All' : cat;
  const { items } = await api.get(`/catalog?type=${type}&sort=${cat === 'Featured' ? 'popular' : sort.value}&q=${encodeURIComponent(search.value)}`);
  const list = cat === 'Featured' ? items.slice(0, 12) : items;
  grid.replaceChildren(...(list.length ? list.map((i) => itemCard(i)) : [el('div', { class: 'empty', text: 'No items found.' })]));
}
load();

const style = document.createElement('style');
style.textContent = `
.catalog-wrap { display: flex; gap: 20px; align-items: flex-start; }
.cat-side { width: 200px; flex: none; padding: 12px 0; }
.cat-side h3 { padding: 0 16px; }
.cat-btn { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 7px 16px; cursor: pointer; font-weight: 600; color: var(--text); }
.cat-btn:hover { background: var(--gray-bg); }
.cat-btn.active { color: var(--blue); background: var(--gray-bg); }
@media (max-width: 760px) { .catalog-wrap { flex-direction: column; align-items: stretch; } .cat-side { width: 100%; display: flex; flex-wrap: nowrap; overflow-x: auto; padding: 4px; } .cat-side h3 { display: none; } .cat-btn { width: auto; white-space: nowrap; border-radius: 14px; } .catalog-wrap form { flex-wrap: wrap; } .catalog-wrap form .input:first-child { flex: 1 1 100%; } }
`;
document.head.append(style);
