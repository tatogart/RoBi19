import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, timeAgo, toast } from '../ui.js';
import { LANG } from '../../i18n.js';

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
// "Buy" copies a ready message and opens support in Telegram; the admins hand
// out what was bought.
const donate = store.donate;
const tgUrl = `https://t.me/${donate.telegram}`;
async function buy(what) {
  const msg = LANG === 'ru'
    ? `Привет! Хочу купить ${what} в Robis. Мой ник: ${me.username}`
    : `Hi! I'd like to buy ${what} on Robis. My username: ${me.username}`;
  let copied = false;
  try { await navigator.clipboard.writeText(msg); copied = true; } catch { /* no clipboard */ }
  window.open(tgUrl, '_blank', 'noopener');
  toast(copied ? 'Message copied - paste it in the Telegram chat' : `Write to @${donate.telegram} in Telegram`, 'success');
}
const priceTag = (p) => el('div', { class: 'donate-price', text: p || 'Price in Telegram' });
const packs = el('div', { class: 'donate-packs' }, donate.packs.map((p, i) => el('div', { class: 'panel donate-pack' + (i === 2 ? ' best' : '') },
  i === 2 ? el('div', { class: 'donate-tag', text: 'Popular' }) : null,
  el('div', { class: 'donate-amount' }, icon('robits', 'robits-icon'), el('span', { text: fmtFull(p.robits) })),
  priceTag(p.price),
  el('button', { class: 'btn btn-green', text: 'Buy', onclick: () => buy(`${fmtFull(p.robits)} Robits`) }))));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Buy Robits' }),
  el('p', { class: 'muted small' }, 'Support Robis! Press Buy: we open ', el('a', { href: tgUrl, target: '_blank', rel: 'noopener', class: 'no-i18n', text: '@' + donate.telegram }),
    ' in Telegram with a ready message. Pay there and you get your Robits.'),
  packs);

// ---------------------------------------------------------------- gift cards
// Sold only in Telegram: support sends the buyer the card's code.
const giftBox = el('div', { class: 'gift-grid' }, donate.giftcards.map((g) => el('div', { class: 'gift-card-wrap' },
  el('div', { class: 'gift-card', style: { background: `linear-gradient(135deg, ${g.color}, #1b1b1b 160%)` } },
    el('div', { class: 'gift-logo', text: 'ROBIS' }),
    el('div', { class: 'gift-chip' }),
    el('div', { class: 'gift-amount', text: g.membership ? 'BC' : fmtFull(g.robits) }),
    el('div', { class: 'gift-label', text: g.membership ? 'Builders Club · 30 days' : 'Robits' }),
    el('div', { class: 'gift-ribbon', text: 'GIFT CARD' })),
  el('div', { class: 'gift-buy' },
    g.price ? el('div', { class: 'donate-price', style: { textAlign: 'center' }, text: g.price }) : null,
    el('button', { class: 'btn btn-green', text: 'Buy in Telegram', onclick: () => buy(`a gift card: ${g.name}`) })))));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Gift Cards' }),
  el('p', { class: 'muted small', text: 'Give Robits or Builders Club to a friend. Gift cards are sold in Telegram: you get a code, your friend redeems it on the Promo Codes page.' }),
  giftBox);

// ---------------------------------------------------------------- Builders Club
const PERKS = {
  None: ['Play every game', 'Daily R$25', 'Build in Robis Studio'],
  BuildersClub: ['Daily R$40', 'BC hard hat badge', 'Everything in Classic'],
  TurboBuildersClub: ['Daily R$60', 'TBC badge', 'Everything in BC'],
  OutrageousBuildersClub: ['Daily R$85', 'OBC badge', 'Everything in TBC'],
};
const plans = el('div', { class: 'plans' }, store.memberships.map((m) => {
  const current = (me.membership || 'None') === m.id;
  return el('div', { class: 'panel plan' + (current ? ' current' : '') },
    el('h3', { text: m.name }),
    el('ul', {}, (PERKS[m.id] || []).map((f) => el('li', { text: f }))),
    current ? el('div', { class: 'plan-tag', text: me.membershipUntil ? `Your plan until ${new Date(me.membershipUntil).toLocaleDateString()}` : 'Your plan' }) : null,
    m.id !== 'None' ? planBuy(m, current) : null);
}));
// Builders Club: bought in Telegram.
function planBuy(m, current) {
  const d = donate.memberships.find((x) => x.id === m.id) || {};
  return el('div', { class: 'plan-buy' },
    el('button', { class: 'btn btn-small btn-green', text: d.price ? `Telegram · ${d.price}` : 'Buy in Telegram', onclick: () => buy(current ? `${m.name} (extend)` : m.name) }));
}
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Builders Club' }),
  el('p', { class: 'muted small', text: 'Buy a membership in Telegram or get one from a promo code.' }), plans);

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
