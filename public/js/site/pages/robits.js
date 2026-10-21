import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, timeAgo, toast, modal } from '../ui.js';

const me = await initPage({ active: 'robits' });
const app = document.getElementById('app');
const store = await api.get('/economy/store');

// ---------------------------------------------------------------- balance + stipend
const balance = el('span', { text: fmtFull(me.robits) });
const updateBalance = (n) => { me.robits = n; balance.textContent = fmtFull(n); setRobits(n); };
const claim = el('button', { class: 'btn btn-green', text: `Collect daily R$${me.stipend}`, disabled: !me.canClaimStipend, onclick: async () => {
  try {
    const r = await api.post('/economy/stipend');
    updateBalance(r.robits); claim.disabled = true;
    toast(`+${r.amount} Robits!`, 'success'); loadTx();
  } catch (e) { toast(e.message, 'error'); }
} });
app.append(el('h1', { text: 'Robits' }),
  el('div', { class: 'panel row wrap', style: { gap: '24px' } },
    el('div', { class: 'row', style: { fontSize: '34px', fontWeight: 700, color: '#02b757' } }, icon('robits', 'robits-icon big'), balance),
    el('div', { class: 'spacer' }, el('div', { text: 'Robits are the currency of Robis. Spend them in the Catalog!' }),
      el('div', { class: 'small muted', text: 'Earn Robits with the daily stipend, from promo codes and from the admins, or support Robis and buy some below.' }),
      el('a', { class: 'small', href: '/promocodes', text: 'Have a promo code? Redeem it here' })),
    claim));

// ---------------------------------------------------------------- donate
// "Buy" makes an order (RB-12345) and opens the seller's chat in Telegram with
// a ready message; a bot answers there for the seller (server/tgshop.js).
const donate = store.donate;
const tgUrl = `https://t.me/${donate.telegram}`;
// online payment (Lolz Market in rubles, CryptoBot in dollars) when it's set up
const payOpts = await api.get('/economy/pay-options').catch(() => ({ methods: [], amounts: {} }));
const waysFor = (key) => payOpts.methods.filter((m) => (payOpts.amounts[key] || {})[m.id] > 0);
const money = (m, a) => (m.id === 'crypto' ? `$${(+a).toFixed(2)}` : `${fmtFull(a)} ₽`);
async function buy(key) {
  const ways = waysFor(key);
  if (ways.length) {
    const box = modal({
      title: 'How do you want to pay?', width: 420,
      body: el('div', { class: 'pay-ways' }, ways.map((m) => el('button', { class: 'btn btn-large pay-way pay-' + m.id, onclick: () => { box.close(); pay(key, m); } },
        el('b', { class: 'no-i18n', text: m.name }), el('span', { class: 'no-i18n', text: money(m, payOpts.amounts[key][m.id]) })))),
      buttons: [{ text: 'Cancel' }],
    });
    return;
  }
  // no online payment: write to the seller in Telegram
  const w = window.open('', '_blank'); // right on the click (Safari blocks it after waiting for the server)
  if (w) w.opener = null;
  let r;
  try { r = await api.post('/economy/order', { key }); } catch (e) { if (w) w.close(); toast(e.message, 'error'); return; }
  try { await navigator.clipboard.writeText(r.text); } catch { /* no clipboard */ }
  if (w) w.location.href = r.url; else location.href = r.url;
  toast(`Order ${r.order.code}: send the message in Telegram (it's copied too)`, 'success');
  loadOrders();
}
async function pay(key, m) {
  const w = window.open('', '_blank');
  if (w) w.opener = null;
  let r;
  try { r = await api.post('/economy/order', { key, method: m.id }); } catch (e) { if (w) w.close(); toast(e.message, 'error'); return; }
  if (w) w.location.href = r.pay.url; else location.href = r.pay.url;
  toast(`Order ${r.order.code}: pay on ${m.name}, it's given by itself after the payment`, 'success');
  loadOrders();
  // check the order while the buyer pays
  const t0 = Date.now();
  const iv = setInterval(async () => { await loadOrders(); if (Date.now() - t0 > 20 * 60e3) clearInterval(iv); }, 15000);
}
// my orders: what was bought in Telegram and what is still waiting
const ordersBox = el('div', { class: 'orders-box' });
const ORDER_STATUS = { new: 'Send the message in Telegram', waiting: 'Waiting for payment', check: 'Checking the payment', done: 'Done', cancelled: 'Cancelled', expired: 'Expired' };
async function loadOrders() {
  const { orders } = await api.get('/economy/orders').catch(() => ({ orders: [] }));
  ordersBox.replaceChildren(...(orders.length ? [el('h3', { text: 'My orders' }), el('table', { class: 'list' }, orders.map((o) => el('tr', {},
    el('td', { class: 'no-i18n', text: o.code }), el('td', { text: o.item }), el('td', { class: 'no-i18n', text: o.price || '' }),
    el('td', { class: 'order-' + o.status, text: ORDER_STATUS[o.status] || o.status }), el('td', { class: 'no-i18n', text: o.giftCode || '' }))))] : []));
}
loadOrders();
const onlinePrice = (key) => waysFor(key).map((m) => money(m, payOpts.amounts[key][m.id])).join(' · ');
const priceTag = (p, key) => el('div', { class: 'donate-price no-i18n', text: (key && onlinePrice(key)) || p || 'Price in Telegram' });
const packs = el('div', { class: 'donate-packs' }, donate.packs.map((p, i) => el('div', { class: 'panel donate-pack' + (i === 2 ? ' best' : '') },
  i === 2 ? el('div', { class: 'donate-tag', text: 'Popular' }) : null,
  el('div', { class: 'donate-amount' }, icon('robits', 'robits-icon'), el('span', { text: fmtFull(p.robits) })),
  priceTag(p.price, 'r' + p.robits),
  el('button', { class: 'btn btn-green', text: 'Buy', onclick: () => buy('r' + p.robits) }))));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Buy Robits' }),
  payOpts.methods.length
    ? el('p', { class: 'muted small', text: `Support Robis! Press Buy and pay with ${payOpts.methods.map((m) => m.name).join(' or ')}: your Robits come by themselves a minute after the payment.` })
    : el('p', { class: 'muted small' }, 'Support Robis! Press Buy: we open ', el('a', { href: tgUrl, target: '_blank', rel: 'noopener', class: 'no-i18n', text: '@' + donate.telegram }),
      ' in Telegram with a ready message and an order number. Pay there and you get your Robits.'),
  packs, ordersBox);

// ---------------------------------------------------------------- gift cards
// Sold only in Telegram: support sends the buyer the card's code.
const giftBox = el('div', { class: 'gift-grid' }, donate.giftcards.map((g) => el('div', { class: 'gift-card-wrap' },
  el('div', { class: 'gift-card', style: { background: `linear-gradient(135deg, ${g.color}, #1b1b1b 160%)` } },
    el('div', { class: 'gift-logo', text: 'ROBIS' }),
    el('div', { class: 'gift-chip' }),
    el('div', { class: 'gift-amount', text: g.membership ? '◈' : fmtFull(g.robits) }),
    el('div', { class: 'gift-label', text: g.membership ? 'Premium · 30 days' : 'Robits' }),
    el('div', { class: 'gift-ribbon', text: 'GIFT CARD' })),
  el('div', { class: 'gift-buy' },
    onlinePrice(g.key) || g.price ? el('div', { class: 'donate-price no-i18n', style: { textAlign: 'center' }, text: onlinePrice(g.key) || g.price }) : null,
    el('button', { class: 'btn btn-green', text: waysFor(g.key).length ? 'Buy' : 'Buy in Telegram', onclick: () => buy(g.key) })))));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Gift Cards' }),
  el('p', { class: 'muted small', text: 'Give Robits or Premium to a friend. Gift cards are sold in Telegram: you get a code, your friend redeems it on the Promo Codes page.' }),
  giftBox);

// ---------------------------------------------------------------- Premium
const PERKS = {
  None: ['Play every game', 'Daily R$25', 'Build in Robis Studio'],
  BuildersClub: ['Daily R$40', 'Premium badge', 'Trade and sell Limiteds', 'Everything in Classic'],
  TurboBuildersClub: ['Daily R$60', 'Premium badge', 'Everything in Premium 450'],
  OutrageousBuildersClub: ['Daily R$85', 'Premium badge', 'Everything in Premium 1000'],
};
const plans = el('div', { class: 'plans' }, store.memberships.map((m) => {
  const current = (me.membership || 'None') === m.id;
  return el('div', { class: 'panel plan' + (current ? ' current' : '') },
    el('h3', { text: m.name }),
    el('ul', {}, (PERKS[m.id] || []).map((f) => el('li', { text: f }))),
    current ? el('div', { class: 'plan-tag', text: me.membershipUntil ? `Your plan until ${new Date(me.membershipUntil).toLocaleDateString()}` : 'Your plan' }) : null,
    m.id !== 'None' ? planBuy(m, current) : null);
}));
// Premium: bought only in Telegram
function planBuy(m, current) {
  const d = donate.memberships.find((x) => x.id === m.id) || {};
  return el('div', { class: 'plan-buy' },
    el('button', { class: 'btn btn-small btn-green', text: onlinePrice(m.id) ? `Buy · ${onlinePrice(m.id)}` : d.price ? `Telegram · ${d.price}` : 'Buy in Telegram', onclick: () => buy(m.id) }));
}
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Premium' }),
  el('p', { class: 'muted small', text: 'Premium replaced Builders Club in 2020. Buy it in Telegram or get it from a promo code.' }), plans);

// ---------------------------------------------------------------- transactions
const tx = el('div', { class: 'panel' });
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Transactions' }), tx);
async function loadTx() {
  const { transactions } = await api.get('/economy/transactions');
  tx.replaceChildren(transactions.length ? el('table', { class: 'list' },
    el('tr', {}, el('th', { text: 'Date' }), el('th', { text: 'Description' }), el('th', { text: 'Amount' })),
    transactions.map((t) => el('tr', {}, el('td', { text: timeAgo(t.time) }), el('td', { text: t.desc }),
      el('td', { style: { color: t.amount >= 0 ? '#02b757' : '#d0021b', fontWeight: 700 }, text: (t.amount > 0 ? '+' : '') + fmtFull(t.amount) }))))
    : el('div', { class: 'empty', text: 'No transactions yet.' }));
}
loadTx();

const style = document.createElement('style');
style.textContent = `
.robits-icon.big { width: 38px; height: 38px; }
.orders-box { margin-top: 14px; }
.pay-ways { display: flex; flex-direction: column; gap: 10px; }
.pay-way { display: flex; justify-content: space-between; align-items: center; width: 100%; color: #fff; }
.pay-lzt { background: #1f8f4e; border-color: #1f8f4e; }
.pay-crypto { background: #229ed9; border-color: #229ed9; }
.orders-box h3 { margin: 6px 0; }
.order-done { color: #02b757; font-weight: 700; }
.order-cancelled, .order-expired { color: #999; }
.order-waiting, .order-check { color: #f5a300; font-weight: 700; }
.plan + .plan { margin-top: 0; }
.plan .btn { margin-top: 8px; }
.plan-buy { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.plan-buy .btn { margin-top: 0; width: 100%; }
.plan-cost { display: flex; align-items: center; gap: 4px; font-weight: 700; color: #02b757; }
.plan-cost .robits-icon { width: 18px; height: 18px; }
.donate-packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.donate-pack { margin: 0; text-align: center; position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 22px; }
.donate-pack + .donate-pack { margin-top: 0; }
.donate-pack.best { outline: 2px solid #02b757; }
.donate-tag { position: absolute; top: -10px; background: #02b757; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 10px; text-transform: uppercase; }
.donate-amount { display: flex; align-items: center; gap: 6px; font-size: 24px; font-weight: 700; color: #02b757; }
.donate-amount .robits-icon { width: 26px; height: 26px; }
.donate-price { font-weight: 600; }
.donate-pack .btn { width: 100%; }
.gift-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; margin-bottom: 16px; }
.gift-card { position: relative; aspect-ratio: 1.6; border-radius: 14px; color: #fff; padding: 14px 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
.gift-card::after { content: ''; position: absolute; right: -40px; top: -40px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,.12); }
.gift-logo { font-weight: 900; letter-spacing: 3px; font-size: 18px; }
.gift-chip { width: 34px; height: 24px; border-radius: 5px; background: linear-gradient(135deg, #ffe08a, #c99a2e); margin-top: 10px; }
.gift-amount { font-size: 34px; font-weight: 900; margin-top: 8px; line-height: 1; }
.gift-label { font-size: 13px; opacity: .9; }
.gift-ribbon { position: absolute; right: 12px; bottom: 10px; font-size: 11px; font-weight: 800; letter-spacing: 2px; opacity: .85; }
.gift-buy { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.gift-buy .btn { width: 100%; }
.gift-code { font-family: Consolas, Menlo, monospace; font-size: 26px; letter-spacing: 2px; text-align: center; padding: 14px; border: 2px dashed var(--border); border-radius: 8px; margin: 10px 0; user-select: all; }
.gift-done p { text-align: center; }
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.plan { display: flex; flex-direction: column; }
.plan ul { padding-left: 20px; flex: 1; }
.plan.current { outline: 2px solid var(--blue); }
.plan-tag { text-align: center; font-weight: 700; color: var(--blue); }
`;
document.head.append(style);
