// Promo Codes: type a code from the admins to get Robits and items.
import { initPage, setRobits } from '../layout.js';
import { api } from '../api.js';
import { el, icon, fmtFull, itemCard, toast, qs } from '../ui.js';

await initPage({ active: 'promocodes' });
const app = document.getElementById('app');

const input = el('input', { class: 'input promo-input', placeholder: 'Enter code', maxlength: 40, autocomplete: 'off', spellcheck: false, value: qs('code') || '' });
const result = el('div', { class: 'promo-result' });
const btn = el('button', { class: 'btn btn-green btn-large', text: 'Redeem', onclick: redeem });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') redeem(); });

async function redeem() {
  const code = input.value.trim();
  if (!code) { input.focus(); return; }
  btn.disabled = true;
  result.replaceChildren();
  try {
    const r = await api.post('/promocodes/redeem', { code });
    setRobits(r.balance);
    input.value = '';
    const items = await Promise.all(r.items.map((i) => api.get(`/catalog/${i.id}`).then((x) => x.item).catch(() => null)));
    result.replaceChildren(el('div', { class: 'promo-ok' },
      el('h3', { text: 'Code redeemed!' }),
      r.robits ? el('div', { class: 'promo-robits' }, icon('robits', 'robits-icon'), el('span', { text: '+' + fmtFull(r.robits) })) : null,
      items.filter(Boolean).length ? el('div', {}, el('div', { class: 'small muted', text: 'New in your inventory:' }), el('div', { class: 'item-grid promo-items' }, items.filter(Boolean).map((it) => itemCard(it)))) : null,
      !r.robits && !items.filter(Boolean).length ? el('div', { class: 'muted', text: 'You already own everything this code gives.' }) : null));
    toast('Code redeemed!', 'success');
  } catch (e) {
    result.replaceChildren(el('div', { class: 'promo-err', text: e.message }));
  }
  btn.disabled = false;
}

app.append(
  el('h1', { text: 'Promo Codes' }),
  el('div', { class: 'panel promo-panel' },
    el('div', { class: 'promo-art', text: '🎁' }),
    el('div', { class: 'promo-main' },
      el('p', { text: 'Got a code from the admins, an event or a video? Type it here to get Robits and free items.' }),
      el('div', { class: 'row wrap' }, input, btn),
      result,
      el('div', { class: 'small muted', style: { marginTop: '10px' }, text: 'Each code works once per player. Codes don\'t care about upper or lower case.' }))));

const style = document.createElement('style');
style.textContent = `
.promo-panel { display: flex; gap: 24px; align-items: flex-start; max-width: 820px; }
.promo-art { font-size: 84px; line-height: 1; flex: none; }
.promo-main { flex: 1; min-width: 0; }
.promo-input { max-width: 300px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; font-family: Consolas, Menlo, monospace; }
.promo-input::placeholder { text-transform: none; letter-spacing: 0; font-family: inherit; }
.promo-result:not(:empty) { margin-top: 14px; }
.promo-ok h3 { margin: 0 0 8px; color: #02b757; }
.promo-robits { display: flex; align-items: center; gap: 6px; font-size: 28px; font-weight: 700; color: #02b757; margin-bottom: 10px; }
.promo-robits .robits-icon { width: 30px; height: 30px; }
.promo-items { margin-top: 6px; }
.promo-err { color: #d0021b; font-weight: 600; }
@media (max-width: 600px) { .promo-panel { flex-direction: column; gap: 8px; } .promo-art { font-size: 56px; } }
`;
document.head.append(style);
