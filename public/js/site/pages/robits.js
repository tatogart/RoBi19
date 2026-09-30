import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, timeAgo, toast } from '../ui.js';

const me = await initPage({ active: 'robits' });
const app = document.getElementById('app');

const balance = el('span', { text: fmtFull(me.robits) });
const claim = el('button', { class: 'btn btn-green', text: 'Collect daily R$25', disabled: !me.canClaimStipend, onclick: async () => {
  try {
    const r = await api.post('/economy/stipend');
    balance.textContent = fmtFull(r.robits); setRobits(r.robits); claim.disabled = true;
    toast(`+${r.amount} Robits!`, 'success'); loadTx();
  } catch (e) { toast(e.message, 'error'); }
} });
app.append(el('h1', { text: 'Robits' }),
  el('div', { class: 'panel row wrap', style: { gap: '24px' } },
    el('div', { class: 'row', style: { fontSize: '34px', fontWeight: 700, color: '#02b757' } }, icon('robits', 'robits-icon big'), balance),
    el('div', { class: 'spacer' }, el('div', { text: 'Robits are the (totally free, totally fictional) currency of Robis.' }),
      el('div', { class: 'small muted', text: 'Earn them with the daily stipend or by selling your creations. Spend them in the Catalog.' })),
    claim));

const plans = [
  ['Classic', 'Free', ['Play every game', '100 R$ welcome bonus', 'Daily R$25 stipend']],
  ['Builders Club', 'Imaginary', ['Everything in Classic', 'Hard hat badge', 'Bragging rights']],
  ['Outrageous BC', 'Very imaginary', ['Everything in BC', 'Only Robis has it', 'Unlimited swag']],
];
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Membership' }),
  el('div', { class: 'plans' }, plans.map(([n, price, feats]) => el('div', { class: 'panel plan' },
    el('h3', { text: n }), el('div', { class: 'muted', text: price }),
    el('ul', {}, feats.map((f) => el('li', { text: f })))))));

const tx = el('div', { class: 'panel' });
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Transactions' }), tx);
async function loadTx() {
  const { transactions } = await api.get('/economy/transactions');
  tx.replaceChildren(transactions.length ? el('table', { class: 'list' },
    el('tr', {}, el('th', { text: 'Date' }), el('th', { text: 'Description' }), el('th', { text: 'Amount' })),
    transactions.map((t) => el('tr', {}, el('td', { text: timeAgo(t.time) }), el('td', { text: t.desc }),
      el('td', { style: { color: t.amount >= 0 ? '#02b757' : '#d0021b', fontWeight: 700 }, text: (t.amount >= 0 ? '+' : '') + fmtFull(t.amount) }))))
    : el('div', { class: 'empty', text: 'No transactions yet.' }));
}
loadTx();
const style = document.createElement('style');
style.textContent = `.robits-icon.big { width: 38px; height: 38px; } .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; } .plan + .plan { margin-top: 0; } .plan ul { padding-left: 20px; }`;
document.head.append(style);
