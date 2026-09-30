import { initPage, setRobits } from '../layout.js';
import { api, getMe } from '../api.js';
import { el, icon, fmtFull, timeAgo, toast, modal } from '../ui.js';

let me = await initPage({ active: 'robits' });
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
      el('div', { class: 'small muted', text: 'This is a fan project, so nothing costs real money: every package below is free.' })),
    claim));

// ---------------------------------------------------------------- Robits packages
const packs = el('div', { class: 'packs' }, store.packs.map((p, i) => el('div', { class: 'panel pack' + (i === 4 ? ' best' : '') },
  i === 4 ? el('div', { class: 'best-tag', text: 'BEST VALUE' }) : null,
  el('div', { class: 'pack-amount' }, icon('robits', 'robits-icon'), fmtFull(p.amount)),
  el('div', { class: 'pack-price' }, el('s', { text: p.price }), ' Free'),
  el('button', { class: 'btn btn-green btn-block', text: 'Buy', onclick: () => buy(p) }))));
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Buy Robits' }), packs);

function buy(p) {
  modal({
    title: 'Buy Robits',
    body: el('div', { class: 'center' },
      el('div', { class: 'pack-amount', style: { justifyContent: 'center' } }, icon('robits', 'robits-icon'), fmtFull(p.amount)),
      el('p', { class: 'muted', text: `Normally ${p.price} — free in Robis. No real money is ever charged.` })),
    buttons: [{ text: 'Get Robits', cls: 'btn-green', onClick: async () => {
      try {
        const r = await api.post('/economy/buy', { amount: p.amount });
        updateBalance(r.robits);
        toast(`+${fmtFull(r.amount)} Robits!`, 'success');
        loadTx();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

// ---------------------------------------------------------------- Builders Club
const PERKS = {
  None: ['Play every game', 'Daily R$25', 'Build in Robis Studio'],
  BuildersClub: ['Daily R$40', 'BC hard hat badge', 'Everything in Classic'],
  TurboBuildersClub: ['Daily R$60', 'TBC badge', 'Everything in BC'],
  OutrageousBuildersClub: ['Daily R$85', 'OBC badge', 'Everything in TBC'],
};
const plans = el('div', { class: 'plans' });
function drawPlans() {
  plans.replaceChildren(...store.memberships.map((m) => {
    const current = (me.membership || 'None') === m.id;
    return el('div', { class: 'panel plan' + (current ? ' current' : '') },
      el('h3', { text: m.name }),
      el('div', { class: 'muted small', text: m.id === 'None' ? 'Free' : 'Free (normally a monthly subscription)' }),
      el('ul', {}, (PERKS[m.id] || []).map((f) => el('li', { text: f }))),
      current ? el('button', { class: 'btn btn-block', text: 'Current plan', disabled: true })
        : el('button', { class: 'btn btn-primary btn-block', text: m.id === 'None' ? 'Switch to Classic' : 'Join', onclick: async () => {
          try {
            const r = await api.post('/economy/membership', { tier: m.id });
            me = r.user; getMe(true);
            claim.textContent = `Collect daily R$${me.stipend}`;
            toast(m.id === 'None' ? 'Membership cancelled' : `Welcome to ${m.name}!`, 'success');
            drawPlans(); loadTx();
          } catch (e) { toast(e.message, 'error'); }
        } }));
  }));
}
drawPlans();
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Builders Club' }), plans);

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
.packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.pack { text-align: center; position: relative; display: flex; flex-direction: column; gap: 8px; }
.pack + .pack, .plan + .plan { margin-top: 0; }
.pack.best { outline: 2px solid var(--green); }
.best-tag { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: var(--green); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.pack-amount { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 24px; font-weight: 700; color: #02b757; }
.pack-amount .robits-icon { width: 26px; height: 26px; }
.pack-price { color: var(--text-light); }
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.plan { display: flex; flex-direction: column; }
.plan ul { padding-left: 20px; flex: 1; }
.plan.current { outline: 2px solid var(--blue); }
`;
document.head.append(style);
