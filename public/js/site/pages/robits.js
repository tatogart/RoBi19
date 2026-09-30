import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, timeAgo, toast } from '../ui.js';

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
      el('div', { class: 'small muted', text: 'Earn Robits with the daily stipend and from the admins. Robits and Builders Club can\'t be bought.' })),
    claim));

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
    current ? el('div', { class: 'plan-tag', text: 'Your plan' }) : null);
}));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Builders Club' }),
  el('p', { class: 'muted small', text: 'Memberships are given out by the admins of this Robis.' }), plans);

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
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.plan { display: flex; flex-direction: column; }
.plan ul { padding-left: 20px; flex: 1; }
.plan.current { outline: 2px solid var(--blue); }
.plan-tag { text-align: center; font-weight: 700; color: var(--blue); }
`;
document.head.append(style);
