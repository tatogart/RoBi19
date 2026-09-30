// Trades, 2019 style: an inbox of Inbound / Outbound / Completed / Inactive
// trades, and the trade window (?with=userId) for making an offer.
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, qs, fmtFull, timeAgo, headshotImg, itemCard, toast, modal, spinner, icon, userLink } from '../ui.js';

const MAX_ITEMS = 4;
const TAX = 0.3;
const tradable = (it) => it.price > 0 || it.limited;

const me = await initPage({ active: 'trade' });
const app = document.getElementById('app');
const withId = +qs('with');
if (withId && withId !== me.id) await tradeWindow(withId);
else inbox();

// ---------------------------------------------------------------- trade inbox
function inbox() {
  app.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('h1', { text: 'Trades' }),
    el('a', { class: 'btn btn-small', href: '/settings#trading', text: 'Trade Settings' })));
  app.append(el('p', { class: 'muted small', text: 'To start a trade, open a player\'s profile and press "Trade Items".' }));
  const tabs = el('div', { class: 'tabs' });
  const body = el('div', { class: 'panel' });
  app.append(tabs, body);
  const show = async (type, b) => {
    [...tabs.children].forEach((x) => x.classList.toggle('active', x === b));
    body.replaceChildren(spinner());
    try {
      const { trades } = await api.get(`/trades?type=${type}`);
      body.replaceChildren(trades.length ? el('div', { class: 'trade-list' }, trades.map((t) => tradeRow(t, () => show(type, b))))
        : el('div', { class: 'empty', text: 'You have no ' + type + ' trades.' }));
    } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); }
  };
  for (const [type, label] of [['inbound', 'Inbound'], ['outbound', 'Outbound'], ['completed', 'Completed'], ['inactive', 'Inactive']]) {
    const b = el('button', { text: label, onclick: () => show(type, b) });
    tabs.append(b);
  }
  const fromHash = () => tabs.children[Math.max(0, ['inbound', 'outbound', 'completed', 'inactive'].indexOf(location.hash.slice(1)))].click();
  addEventListener('hashchange', fromHash);
  fromHash();
}

const STATUS = { pending: 'Pending', accepted: 'Completed', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', failed: 'Failed' };

function tradeRow(t, refresh) {
  const other = t.inbound ? t.from : t.to;
  return el('button', { class: 'trade-row', onclick: () => tradeDialog(t, refresh) },
    el('span', { class: 'trade-head' }, headshotImg(other, 96)),
    el('span', { class: 'trade-who' },
      el('span', {}, el('b', { class: 'no-i18n', text: other.username })),
      el('span', { class: 'small muted', text: `${t.inbound ? 'Sent to you' : 'Sent by you'} · ${timeAgo(t.updated)}` })),
    el('span', { class: 'pill trade-status ' + t.status, text: STATUS[t.status] || t.status }));
}

// One side of a trade: the items and Robits a player puts in.
function sideView(title, items, robits) {
  const value = items.reduce((a, i) => a + (i.price || 0), 0);
  return el('div', { class: 'trade-side' },
    el('h4', { text: title }),
    el('div', { class: 'trade-slots' }, items.map((i) => itemCard(i)), ...Array.from({ length: MAX_ITEMS - items.length }, () => el('div', { class: 'trade-slot' }))),
    robits ? el('div', { class: 'trade-robits' }, 'Plus ', icon('robits', 'robits-icon'), fmtFull(robits)) : null,
    el('div', { class: 'small muted' }, 'Value: ', icon('robits', 'robits-icon'), fmtFull(value + robits)));
}

function tradeDialog(t, refresh) {
  const other = t.inbound ? t.from : t.to;
  const mine = t.inbound ? [t.get, t.getRobits] : [t.give, t.giveRobits];
  const theirs = t.inbound ? [t.give, t.giveRobits] : [t.get, t.getRobits];
  const act = (path, msg) => async () => {
    try {
      const r = await api.post(`/trades/${t.id}/${path}`);
      if (r.robits !== undefined) setRobits(r.robits);
      toast(msg, 'success');
    } catch (e) { toast(e.message, 'error'); }
    refresh();
    api.get('/trades/count').then(({ inbound }) => {
      const c = document.getElementById('nav-trade');
      if (c) { c.textContent = inbound; c.classList.toggle('hidden', !inbound); }
    }).catch(() => {});
  };
  const buttons = t.status !== 'pending' ? [{ text: 'Close' }]
    : t.inbound ? [{ text: 'Accept', cls: 'btn-green', onClick: act('accept', 'Trade completed!') }, { text: 'Decline', cls: 'btn-red', onClick: act('decline', 'Trade declined') }, { text: 'Close' }]
      : [{ text: 'Cancel Trade', cls: 'btn-red', onClick: act('decline', 'Trade cancelled') }, { text: 'Close' }];
  modal({
    title: 'Trade with ' + other.username,
    width: 720,
    body: el('div', {},
      el('div', { class: 'trade-with' }, 'Trade with ', userLink(other), el('span', { class: 'pill trade-status ' + t.status, text: STATUS[t.status] })),
      t.reason ? el('p', { class: 'error-text', text: t.reason }) : null,
      el('div', { class: 'trade-sides' }, sideView('Items you will give', ...mine), sideView('Items you will receive', ...theirs)),
      t.status === 'pending' && (mine[1] || theirs[1]) ? el('p', { class: 'small muted', text: 'Robits received in a trade have a 30% fee.' }) : null),
    buttons,
  });
}

// ---------------------------------------------------------------- trade window
async function tradeWindow(uid) {
  let partner;
  try { ({ user: partner } = await api.get(`/users/${uid}`)); } catch {
    app.append(el('div', { class: 'panel empty', text: 'User not found.' }));
    return;
  }
  document.title = `Trade with ${partner.username} - Robis`;
  app.append(el('div', { class: 'trade-with big' }, el('h1', { text: 'Trade with' }), userLink(partner)));
  const [mineInv, theirInv, fresh] = await Promise.all([
    api.get(`/users/${me.id}/inventory`), api.get(`/users/${uid}/inventory`), api.get('/auth/me'),
  ]);
  const myRobits = fresh.user.robits;
  const theirOwned = new Set(theirInv.items.map((i) => i.id));
  const myOwned = new Set(mineInv.items.map((i) => i.id));
  const give = [], get = [];
  const giveR = el('input', { class: 'input', type: 'number', min: 0, max: myRobits, value: 0 });
  const getR = el('input', { class: 'input', type: 'number', min: 0, value: 0 });

  const offerBox = el('div', { class: 'trade-slots' });
  const requestBox = el('div', { class: 'trade-slots' });
  const myGrid = el('div', { class: 'item-grid trade-pick' });
  const theirGrid = el('div', { class: 'item-grid trade-pick' });

  const slots = (box, list) => box.replaceChildren(...list.map((it) => itemCard(it, { onClick: () => { list.splice(list.indexOf(it), 1); draw(); } })),
    ...Array.from({ length: MAX_ITEMS - list.length }, () => el('div', { class: 'trade-slot' })));
  const pick = (grid, items, list, blockedFor) => {
    // Items the other player already has can't be traded to them; show those last.
    const usable = items.filter(tradable).sort((x, y) => blockedFor.has(x.id) - blockedFor.has(y.id));
    grid.replaceChildren(...(usable.length ? usable.map((it) => {
      const card = itemCard(it, { onClick: () => {
        if (list.includes(it)) { list.splice(list.indexOf(it), 1); draw(); return; }
        if (blockedFor.has(it.id)) { toast(`${blockedFor === theirOwned ? partner.username : 'You'} already own${blockedFor === theirOwned ? 's' : ''} ${it.name}.`, 'error'); return; }
        if (list.length >= MAX_ITEMS) { toast(`You can add up to ${MAX_ITEMS} items on each side.`, 'error'); return; }
        list.push(it); draw();
      } });
      if (list.includes(it)) card.classList.add('selected');
      if (blockedFor.has(it.id)) card.classList.add('dim');
      return card;
    }) : [el('div', { class: 'empty', text: 'No tradable items.' })]));
  };
  function draw() {
    slots(offerBox, give); slots(requestBox, get);
    pick(myGrid, mineInv.items, give, theirOwned);
    pick(theirGrid, theirInv.items, get, myOwned);
  }
  draw();

  const send = el('button', { class: 'btn btn-green', text: 'Make Offer', onclick: async () => {
    send.disabled = true;
    try {
      await api.post('/trades', { toUserId: uid, give: give.map((i) => i.id), get: get.map((i) => i.id), giveRobits: +giveR.value || 0, getRobits: +getR.value || 0 });
      toast('Trade sent!', 'success');
      setTimeout(() => { location.href = '/trades#outbound'; }, 700);
    } catch (e) { toast(e.message, 'error'); send.disabled = false; }
  } });

  app.append(el('div', { class: 'trade-window' },
    el('div', { class: 'trade-inventories' },
      el('div', { class: 'panel' }, el('h3', { text: 'Your Inventory' }), myGrid),
      el('div', { class: 'panel' }, el('h3', { text: 'Their Inventory' }), theirGrid)),
    el('div', { class: 'panel trade-offer' },
      el('h3', { text: 'Your Offer' }), offerBox,
      el('label', { class: 'field' }, el('span', {}, 'Plus Robits (you have ', icon('robits', 'robits-icon'), fmtFull(myRobits), ')'), giveR),
      el('h3', { text: 'Your Request' }), requestBox,
      el('label', { class: 'field' }, 'Plus Robits', getR),
      el('p', { class: 'small muted', text: `Up to ${MAX_ITEMS} items on each side. Only items that cost Robits or are Limited can be traded. Robits received in a trade have a ${TAX * 100}% fee.` }),
      send)));
}
