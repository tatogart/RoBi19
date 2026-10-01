import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, fmtDate, qs, modal, toast, userLink } from '../ui.js';
import { itemThumbnail } from '../../render/thumbs.js';

const me = await initPage({ active: 'catalog', requireAuth: false });
const app = document.getElementById('app');
let { item } = await api.get(`/catalog/${+qs('id')}`);
document.title = `${item.name} - Robis Catalog`;

const thumb = el('div', { class: 'item-big-thumb' });
itemThumbnail(item, 420).then((u) => thumb.append(el('img', { src: u, alt: item.name })));
const buyArea = el('div');
function renderBuy() {
  buyArea.replaceChildren(...[
    el('div', { class: 'price-line' }, el('span', { class: 'muted', text: 'Price' }),
      item.price ? el('span', { class: 'big-price' }, icon('robits', 'robits-icon'), fmtFull(item.price)) : el('span', { class: 'big-price', text: 'Free' })),
    item.owned
      ? el('div', { class: 'row wrap' }, el('span', { class: 'pill', text: '✓ You own this item' }),
        item.serial ? el('span', { class: 'pill serial-pill no-i18n', text: `#${item.serial}${item.stock ? ' / ' + fmtFull(item.stock) : ''}` }) : null,
        el('a', { class: 'btn', href: '/avatar', text: 'Wear it' }))
      : el('button', { class: 'btn btn-green btn-large', text: item.price ? 'Buy' : 'Get', disabled: item.limited && item.remaining === 0, onclick: buy }),
    item.limited ? el('div', { class: 'small muted', style: { marginTop: '8px' }, text: item.remaining === 0 ? 'Sold out — you can still get it in a trade.' : item.stock ? `${fmtFull(item.remaining)} of ${fmtFull(item.stock)} remaining` : `${fmtFull(item.remaining)} remaining` }) : null].filter(Boolean));
}
async function buy() {
  if (!me) { location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search); return; }
  modal({
    title: 'Buy Item',
    body: el('div', { class: 'center' },
      el('p', {}, 'Would you like to buy the ', el('b', { text: item.name }), ` from ${item.creator?.username || 'Robis'} for `, item.price ? el('b', {}, icon('robits', 'robits-icon'), fmtFull(item.price)) : el('b', { text: 'Free' }), '?'),
      el('p', { class: 'small muted', text: `Your balance after this transaction will be R$ ${fmtFull(me.robits - item.price)}` })),
    buttons: [
      { text: 'Buy Now', cls: 'btn-green', onClick: async () => {
        try {
          const r = await api.post(`/catalog/${item.id}/buy`);
          item = r.item; me.robits = r.robits; setRobits(r.robits); renderBuy();
          toast('Purchase completed!', 'success');
        } catch (e) { toast(e.message, 'error'); }
      } },
      { text: 'Cancel' },
    ],
  });
}
// Limited Creator right: turn this item into a Limited with a stock, or back.
function limitedDialog() {
  const stock = el('input', { class: 'input', type: 'number', min: 0, max: 100000, value: item.limited ? item.remaining ?? 0 : 100 });
  const save = async (body, msg) => {
    try { ({ item } = await api.post(`/catalog/${item.id}/limited`, body)); toast(msg, 'success'); setTimeout(() => location.reload(), 500); } catch (e) { toast(e.message, 'error'); return false; }
  };
  modal({
    title: item.limited ? 'Limited settings' : 'Make Limited',
    body: el('div', {},
      el('p', { class: 'small muted', text: 'A Limited has a set stock. When it sells out, players can only get it in a trade. Stock 0 takes it off sale right away.' }),
      el('label', { class: 'field' }, 'Copies left for sale', stock)),
    buttons: [
      { text: 'Save', cls: 'btn-green', onClick: () => save({ limited: true, stock: +stock.value }, 'Limited saved') },
      ...(item.limited ? [{ text: 'Make normal item', onClick: () => save({ limited: false }, 'No longer Limited') }] : []),
      { text: 'Cancel' },
    ],
  });
}

renderBuy();
// Limiteds: every copy has a serial number; list who owns which.
const owners = el('div');
if (item.limited) {
  api.get(`/catalog/${item.id}/owners`).then(({ owners: list }) => {
    if (!list.length) return;
    owners.replaceChildren(el('div', { class: 'panel' },
      el('h3', { text: 'Owners' }),
      el('div', { class: 'owners-list' }, list.map((o) => el('div', { class: 'owner-row' },
        el('span', { class: 'serial-pill pill no-i18n', text: `#${o.serial}` }), userLink(o.user))))));
  }).catch(() => {});
}
app.append(el('div', { class: 'panel item-page' }, thumb,
  el('div', { class: 'item-info' },
    el('h1', { text: item.name }),
    el('div', { class: 'muted' }, 'By ', item.creator ? userLink(item.creator) : 'Robis'),
    item.limited ? el('span', { class: 'pill', style: { background: '#02b757', color: '#fff', marginTop: '8px' }, text: item.stock ? 'LIMITED U' : 'LIMITED' }) : null,
    me && (me.perms || []).includes('limiteds')
      ? el('button', { class: 'btn btn-small', style: { marginTop: '10px', marginLeft: '8px' }, text: item.limited ? 'Limited settings' : 'Make Limited', onclick: limitedDialog }) : null,
    item.custom ? el('span', { class: 'pill', style: { background: '#6b327c', color: '#fff', marginTop: '8px' }, text: 'BETA · made by a player' }) : null,
    item.custom && me && (item.creator?.id === me.id || me.isAdmin || (me.perms || []).includes('moderator'))
      ? el('button', { class: 'btn btn-small btn-red', style: { marginTop: '10px', marginLeft: '8px' }, text: item.creator?.id === me.id ? 'Delete my item' : 'Delete (moderation)', onclick: async () => {
        if (!confirm('Delete this item? Everyone who owns it will lose it.')) return;
        try { await api.del(`/catalog/${item.id}`); toast('Item deleted', 'success'); location.href = '/catalog'; } catch (e) { toast(e.message, 'error'); }
      } }) : null,
    el('hr', { style: { border: 0, borderTop: '1px solid #e3e3e3', margin: '16px 0' } }),
    buyArea,
    el('table', { class: 'list', style: { marginTop: '20px' } },
      el('tr', {}, el('td', { class: 'muted', text: 'Type' }), el('td', { text: { TShirt: 'T-Shirt' }[item.type] || item.type })),
      el('tr', {}, el('td', { class: 'muted', text: 'Created' }), el('td', { text: fmtDate(item.created) })),
      el('tr', {}, el('td', { class: 'muted', text: 'Sold' }), el('td', { text: fmtFull(item.sales) })),
      el('tr', {}, el('td', { class: 'muted', text: 'Description' }), el('td', { text: item.description }))))));
const style = document.createElement('style');
style.textContent = `.item-page { display: flex; gap: 30px; } .item-big-thumb { width: 420px; max-width: 100%; aspect-ratio: 1; background: linear-gradient(#f7f7f7,#e2e2e2); border-radius: 3px; flex: none; }
.item-big-thumb img { width: 100%; height: 100%; } .item-info { flex: 1; } .price-line { display: flex; align-items: center; gap: 20px; margin-bottom: 14px; }
.big-price { font-size: 26px; font-weight: 700; color: #02b757; display: inline-flex; align-items: center; gap: 6px; } .big-price .robits-icon { width: 26px; height: 26px; }
@media (max-width: 800px) { .item-page { flex-direction: column; } }`;
document.head.append(style);
app.append(owners);
