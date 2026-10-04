// Gifts for friends (wrapped, unwrapped with an animation), the wishlist
// button and the sale banner with its countdown.
import { api } from './api.js';
import { el, modal, toast, icon, fmtFull, headshotImg } from './ui.js';
import { confetti } from './fun.js';
import { tr } from '../i18n.js';
import { itemThumbnail } from '../render/thumbs.js';

const WRAPS = ['#e8413c', '#00a2ff', '#02b757', '#7b5cff', '#ffc400', '#ff4d8d', '#1b1b1b'];

// "2d 04:13:09"
export function countdown(node, until, onDone) {
  const tick = () => {
    const ms = until - Date.now();
    if (ms <= 0) { node.textContent = '00:00:00'; clearInterval(t); onDone && onDone(); return; }
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
    const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0'), mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    node.textContent = (d ? `${d}${tr('d')} ` : '') + `${hh}:${mm}:${ss}`;
  };
  const t = setInterval(tick, 1000);
  tick();
  return t;
}

// The big sale banner (catalog, home): "BLACK FRIDAY -50% · ends in 1d 02:13:44".
export async function saleBanner() {
  let r;
  try { r = await api.get('/sales'); } catch { return null; }
  const s = r.live[0];
  const next = r.next;
  if (!s && !next) return null;
  const clock = el('span', { class: 'sale-clock no-i18n' });
  const box = el('a', { class: 'sale-banner' + (s ? '' : ' soon'), href: '/catalog' },
    el('div', { class: 'sale-left' },
      el('b', { class: 'sale-name no-i18n', text: (s || next).name.toUpperCase() }),
      el('span', { class: 'sale-pct', text: `-${(s || next).percent}%` }),
      el('span', { class: 'sale-scope', text: (s || next).scope === 'all' ? tr('on everything in the catalog') : tr(`on ${(s || next).scope}`) })),
    el('div', { class: 'sale-right' }, el('span', { class: 'small', text: s ? tr('Ends in') : tr('Starts in') }), clock));
  countdown(clock, s ? s.ends : next.starts, () => setTimeout(() => location.reload(), 1500));
  return box;
}

// The price with the sale: old price crossed out and the discount.
export function salePrice(item) {
  if (!item.sale) return null;
  return el('span', { class: 'sale-tag' }, el('s', { class: 'muted', text: fmtFull(item.sale.was) }), el('b', { text: ` -${item.sale.percent}%` }));
}

// ---------------------------------------------------------------- wishlist
export function wishButton(item, onChange) {
  const b = el('button', { class: 'btn wish-btn' + (item.wished ? ' on' : '') });
  const draw = () => { b.classList.toggle('on', !!item.wished); b.textContent = item.wished ? tr('♥ In your wishlist') : tr('♡ Add to wishlist'); };
  b.addEventListener('click', async () => {
    try { const r = await api.post('/wishlist', { itemId: item.id, on: !item.wished }); item.wished = r.wished; draw(); toast(r.wished ? tr('Added to your wishlist. Your friends can see it!') : tr('Removed from your wishlist'), 'success'); onChange && onChange(); } catch (e) { toast(e.message, 'error'); }
  });
  draw();
  return b;
}

// ---------------------------------------------------------------- send a gift
export async function giftDialog(item, me, { to = null, onDone } = {}) {
  let friends = [];
  try { ({ friends } = await api.get(`/users/${me.id}/friends`)); } catch { /* offline */ }
  if (!friends.length) { toast(tr('Add friends first - gifts are for friends.'), 'error'); return; }
  let pick = to ? friends.find((f) => f.id === to) || null : null;
  let wrap = WRAPS[0];
  const list = el('div', { class: 'gift-friends' });
  const drawFriends = () => list.replaceChildren(...friends.map((f) => el('button', { class: 'gift-friend' + (pick && pick.id === f.id ? ' on' : ''), onclick: () => { pick = f; drawFriends(); } },
    headshotImg(f, 64), el('span', { class: 'no-i18n', text: f.username }))));
  drawFriends();
  const wraps = el('div', { class: 'gift-wraps' });
  const drawWraps = () => wraps.replaceChildren(...WRAPS.map((c) => el('button', { class: 'gift-wrap' + (c === wrap ? ' on' : ''), style: { background: c }, title: c, onclick: () => { wrap = c; drawWraps(); } })));
  drawWraps();
  const msg = el('input', { class: 'input', maxlength: 200, placeholder: tr('A message (optional), e.g. "Happy birthday!"') });
  modal({
    title: tr('🎁 Send as a gift'),
    width: 520,
    body: el('div', { class: 'gift-dialog' },
      el('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
        el('b', { class: 'no-i18n', text: item.name }),
        el('span', { class: 'pill' }, icon('robits', 'robits-icon'), fmtFull(item.price))),
      el('div', { class: 'qe-step', text: tr('Who is it for?') }), list,
      el('div', { class: 'qe-step', text: tr('Wrapping paper') }), wraps,
      msg,
      el('p', { class: 'small muted', text: tr('Your friend gets it wrapped and unwraps it the next time they visit Robis.') })),
    buttons: [{ text: tr('Send the gift'), cls: 'btn-green', onClick: async () => {
      if (!pick) { toast(tr('Pick a friend.'), 'error'); return false; }
      try {
        const r = await api.post(`/catalog/${item.id}/gift`, { to: pick.id, wrap, message: msg.value });
        toast(`${tr('Gift sent to')} ${pick.username}! 🎁`, 'success');
        confetti({ count: 80 });
        onDone && onDone(r);
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: tr('Cancel') }],
  });
}

// ---------------------------------------------------------------- unwrapping
// Presents waiting for this player pop up (one after another).
let busy = false;
export async function checkGifts() {
  if (busy) return;
  let r;
  try { r = await api.get('/gifts'); } catch { return; }
  const g = r.unopened[0];
  if (!g || !g.item) return;
  busy = true;
  const thumb = el('div', { class: 'present-item' });
  itemThumbnail(g.item, 300).then((u) => thumb.append(el('img', { src: u, alt: '' }))).catch(() => {});
  const box = el('div', { class: 'present' },
    el('div', { class: 'present-lid' }, el('div', { class: 'present-bow' })),
    el('div', { class: 'present-box' }, el('div', { class: 'present-ribbon' })));
  box.style.setProperty('--wrap', /^#[0-9a-f]{6}$/i.test(g.wrap) ? g.wrap : '#e8413c');
  const reveal = el('div', { class: 'present-reveal' }, thumb,
    el('b', { class: 'no-i18n', text: g.item.name }),
    g.message ? el('div', { class: 'present-msg no-i18n', text: `“${g.message}”` }) : null,
    el('a', { class: 'btn btn-primary', href: '/avatar', text: tr('Wear it') }));
  const hint = el('div', { class: 'present-hint', text: tr('Click the present to open it!') });
  const stage = el('div', { class: 'present-stage' }, box, reveal, hint);
  const m = modal({
    title: `🎁 ${tr('A gift from')} ${g.from.username}!`,
    width: 460,
    body: stage,
    buttons: [{ text: tr('Close') }],
    onClose: () => { busy = false; setTimeout(checkGifts, 600); },
  });
  let opened = false;
  box.addEventListener('click', async () => {
    if (opened) return;
    opened = true;
    hint.remove();
    stage.classList.add('opening');
    try { await api.post(`/gifts/${g.id}/open`, {}); } catch { /* it opens next time */ }
    setTimeout(() => { stage.classList.add('open'); confetti({ count: 160 }); }, 900);
  });
  return m;
}
