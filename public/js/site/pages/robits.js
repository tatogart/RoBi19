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
    m.id !== 'None' ? priceTag(donate.memberships.find((x) => x.id === m.id)?.price) : null,
    m.id !== 'None' ? el('button', { class: 'btn btn-small btn-primary', text: current ? 'Extend' : 'Buy', onclick: () => buy(m.name) }) : null);
}));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Builders Club' }),
  el('p', { class: 'muted small', text: 'Buy a membership through Telegram, get one from a promo code or from the admins.' }), plans);

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
.donate-packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.donate-pack { margin: 0; text-align: center; position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 22px; }
.donate-pack + .donate-pack { margin-top: 0; }
.donate-pack.best { outline: 2px solid #02b757; }
.donate-tag { position: absolute; top: -10px; background: #02b757; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 10px; text-transform: uppercase; }
.donate-amount { display: flex; align-items: center; gap: 6px; font-size: 24px; font-weight: 700; color: #02b757; }
.donate-amount .robits-icon { width: 26px; height: 26px; }
.donate-price { font-weight: 600; }
.donate-pack .btn { width: 100%; }
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.plan { display: flex; flex-direction: column; }
.plan ul { padding-left: 20px; flex: 1; }
.plan.current { outline: 2px solid var(--blue); }
.plan-tag { text-align: center; font-weight: 700; color: var(--blue); }
`;
document.head.append(style);
