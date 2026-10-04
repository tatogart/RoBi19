import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { confetti } from '../fun.js';
import { wishButton, giftDialog, salePrice, countdown } from '../gifts.js';
import { el, icon, fmtFull, fmtDate, qs, modal, toast, userLink, headshotImg } from '../ui.js';
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
      item.price ? el('span', { class: 'big-price' }, icon('robits', 'robits-icon'), fmtFull(item.price)) : el('span', { class: 'big-price', text: 'Free' }), salePrice(item)),
    item.sale ? (() => { const c = el('b', { class: 'no-i18n' }); countdown(c, item.sale.ends, () => setTimeout(refreshItem, 1200)); return el('div', { class: 'sale-line' }, el('span', { class: 'no-i18n', text: `🔥 ${item.sale.name}` }), ' · ', el('span', { text: 'ends in' }), ' ', c); })() : null,
    item.owned
      ? el('div', { class: 'row wrap' }, el('span', { class: 'pill', text: '✓ You own this item' }),
        item.serial ? el('span', { class: 'pill serial-pill no-i18n', text: `#${item.serial}${item.stock ? ' / ' + fmtFull(item.stock) : ''}` }) : null,
        el('a', { class: 'btn', href: '/avatar', text: 'Wear it' }))
      : el('button', { class: 'btn btn-green btn-large', text: item.price ? 'Buy' : 'Get', disabled: item.limited && item.remaining === 0, onclick: buy }),
    me && !item.offsale && !(item.limited && item.remaining === 0) ? el('div', { class: 'row wrap', style: { marginTop: '10px', gap: '8px' } },
      item.owned ? null : wishButton(item),
      el('button', { class: 'btn gift-btn', text: '🎁 Gift to a friend', onclick: () => giftDialog(item, me, { onDone: (r) => { setRobits(r.robits); refreshItem(); } }) })) : null,
    item.limited ? el('div', { class: 'small muted', style: { marginTop: '8px' }, text: item.remaining === 0 ? 'Sold out — buy it from a reseller or get it in a trade.' : item.stock ? `${fmtFull(item.remaining)} of ${fmtFull(item.stock)} remaining` : `${fmtFull(item.remaining)} remaining` }) : null,
    item.limited && item.bestPrice ? el('div', { class: 'price-line', style: { marginTop: '10px' } }, el('span', { class: 'muted', text: 'Best Price' }),
      el('span', { class: 'big-price small-price' }, icon('robits', 'robits-icon'), fmtFull(item.bestPrice))) : null,
    // Owners of a Limited can sell their copy to other players.
    item.limited && item.owned ? (item.myResale
      ? el('div', { class: 'row wrap', style: { marginTop: '10px' } },
        el('span', { class: 'pill on-sale-pill' }, 'On sale for ', icon('robits', 'robits-icon'), fmtFull(item.myResale.price)),
        el('button', { class: 'btn btn-small', text: 'Take off sale', onclick: () => cancelResale(item.myResale.id) }))
      : el('button', { class: 'btn btn-primary', style: { marginTop: '10px' }, text: 'Sell', onclick: sellDialog })) : null].filter(Boolean));
}

// ---------------------------------------------------------------- reselling Limiteds
const resellers = el('div');
async function refreshItem() {
  ({ item } = await api.get(`/catalog/${item.id}`));
  renderBuy();
  loadResellers();
}
async function loadResellers() {
  if (!item.limited) return;
  try {
    const { resellers: list } = await api.get(`/catalog/${item.id}/resellers`);
    resellers.replaceChildren(el('div', { class: 'panel' },
      el('h3', { text: 'Resellers' }),
      list.length ? el('div', { class: 'reseller-list' }, list.map((r) => el('div', { class: 'reseller-row' },
        el('span', { class: 'reseller-head' }, headshotImg(r.seller, 64)),
        el('div', { class: 'reseller-who' }, userLink(r.seller), r.serial ? el('span', { class: 'pill serial-pill no-i18n', text: `#${r.serial}` }) : null),
        el('span', { class: 'big-price small-price' }, icon('robits', 'robits-icon'), fmtFull(r.price)),
        me && r.seller.id === me.id ? el('span', { class: 'muted small', text: 'Your copy' })
          : el('button', { class: 'btn btn-green', text: 'Buy', disabled: item.owned, onclick: () => buyResale(r) }))))
        : el('div', { class: 'muted', text: 'Nobody is selling this item right now.' })));
  } catch { /* offline */ }
}
function sellDialog() {
  const price = el('input', { class: 'input', type: 'number', min: 1, value: item.bestPrice || item.price || 100 });
  const youGet = el('div', { class: 'small muted' });
  const upd = () => { youGet.textContent = `You will get R$${fmtFull(Math.floor((+price.value || 0) * 0.7))} (30% marketplace fee).`; };
  price.oninput = upd; upd();
  modal({
    title: 'Sell ' + item.name,
    body: el('div', {}, el('p', { text: `Sell your copy${item.serial ? ' #' + item.serial : ''} to another player.` }), el('label', { class: 'field' }, 'Price (R$)', price), youGet),
    buttons: [{ text: 'Put on sale', cls: 'btn-green', onClick: async () => {
      try { await api.post(`/catalog/${item.id}/resell`, { price: +price.value }); toast('Your item is on sale!', 'success'); refreshItem(); } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}
async function cancelResale(id) {
  try { await api.post(`/resales/${id}/cancel`); toast('Taken off sale', 'success'); refreshItem(); } catch (e) { toast(e.message, 'error'); }
}
function buyResale(r) {
  if (!me) { location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search); return; }
  modal({
    title: 'Buy Item',
    body: el('div', { class: 'center' },
      el('p', {}, 'Buy ', el('b', { text: item.name }), r.serial ? ` #${r.serial}` : '', ` from ${r.seller.username} for `, el('b', {}, icon('robits', 'robits-icon'), fmtFull(r.price)), '?'),
      el('p', { class: 'small muted', text: `Your balance after this transaction will be R$ ${fmtFull(me.robits - r.price)}` })),
    buttons: [{ text: 'Buy Now', cls: 'btn-green', onClick: async () => {
      try {
        const res = await api.post(`/resales/${r.id}/buy`);
        me.robits = res.robits; setRobits(res.robits);
        toast('Purchase completed!', 'success'); confetti();
        refreshItem();
      } catch (e) { toast(e.message, 'error'); refreshItem(); }
    } }, { text: 'Cancel' }],
  });
}
loadResellers();
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
          toast('Purchase completed!', 'success'); confetti();
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
@media (max-width: 800px) { .item-page { flex-direction: column; } }
.small-price { font-size: 20px; } .small-price .robits-icon { width: 20px; height: 20px; }
.on-sale-pill { background: #02b757; color: #fff; display: inline-flex; align-items: center; gap: 4px; } .on-sale-pill .robits-icon { width: 14px; height: 14px; }
.reseller-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.reseller-row:last-child { border-bottom: 0; }
.reseller-head img { width: 44px; height: 44px; border-radius: 50%; background: #d4d4d4; display: block; }
.reseller-who { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }`;
document.head.append(style);
app.append(owners);
app.append(resellers);
