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
      el('div', { class: 'small muted', text: 'Earn Robits with the daily stipend, from promo codes and from the admins, or support Robis and buy some below.' }),
      el('a', { class: 'small', href: '/promocodes', text: 'Have a promo code? Redeem it here' })),
    claim));

// ---------------------------------------------------------------- donate
// Robits are sold only in the Telegram bot, for Telegram Stars (server/tgbot.js).
// Gift cards are off for now.
const donate = store.donate;
const tg = await api.get('/me/telegram').catch(() => null);
const botOn = !!(tg && tg.on);
const openBot = (start) => {
  if (!tg.linked) { toast('Link Telegram first: Settings -> Telegram', 'error'); setTimeout(() => { location.href = '/settings'; }, 900); return; }
  window.open(`https://t.me/${tg.bot}?start=${start}`, '_blank', 'noopener');
};
if (botOn && tg.shop.robits.length) {
  const packs = el('div', { class: 'donate-packs' }, tg.shop.robits.map((p, i) => el('div', { class: 'panel donate-pack' + (i === 2 ? ' best' : '') },
    i === 2 ? el('div', { class: 'donate-tag', text: 'Popular' }) : null,
    el('div', { class: 'donate-amount' }, icon('robits', 'robits-icon'), el('span', { text: fmtFull(p.robits) })),
    el('div', { class: 'donate-price no-i18n', text: `⭐ ${fmtFull(p.stars)}` }),
    el('button', { class: 'btn btn-green tg-star-btn', text: 'Buy in Telegram', onclick: () => openBot('robits') }))));
  app.append(el('h2', { style: { marginTop: '28px' }, text: 'Buy Robits' }),
    el('p', { class: 'muted small' }, 'Support Robis! Robits are sold for Telegram Stars in our bot ', el('a', { href: `https://t.me/${tg.bot}`, target: '_blank', rel: 'noopener', class: 'no-i18n', text: '@' + tg.bot }),
      tg.linked ? '. They come to your account right after the payment.' : '. Link Telegram in Settings first.'),
    packs);
}

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
    m.id !== 'None' ? planBuy(m) : null);
}));
// Premium: for Robits right here, or for Telegram Stars in the bot
function planBuy(m) {
  const d = donate.memberships.find((x) => x.id === m.id) || {};
  const stars = botOn && tg.shop.premium[m.id] ? tg.shop.premium[m.id].stars : 0;
  return el('div', { class: 'plan-buy' },
    d.cost ? el('button', { class: 'btn btn-small btn-green', onclick: async () => {
      if (!confirm(`${m.name} for ${d.days} days: R$ ${fmtFull(d.cost)}?`)) return;
      try { const r = await api.post('/economy/membership', { tier: m.id }); setRobits(r.robits); toast(`${m.name} is yours!`, 'success'); setTimeout(() => location.reload(), 800); } catch (e) { toast(e.message, 'error'); }
    } }, icon('robits', 'robits-icon'), fmtFull(d.cost)) : null,
    stars ? el('button', { class: 'btn btn-small tg-star-btn no-i18n', text: `⭐ ${fmtFull(stars)} Stars`, onclick: () => openBot('premium') }) : null);
}
app.append(el('h2', { style: { marginTop: '28px' }, text: 'Premium' }),
  el('p', { class: 'muted small', text: 'Premium replaced Builders Club in 2020. Buy it for Robits, for Telegram Stars in our bot, or get it from a promo code.' }), plans);

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
.tg-star-btn { background: #229ed9; border-color: #229ed9; color: #fff; }
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
