// Little fun things: confetti, the Daily Spin wheel and the secret code.
import { api } from './api.js';
import { el, modal, toast, fmtNum } from './ui.js';
import { tr } from '../i18n.js';

// Confetti over the whole page (a canvas that removes itself).
export function confetti({ count = 140, colors = ['#00a2ff', '#02b757', '#ffc400', '#ff4d8d', '#7b5cff', '#e8590c'], emoji = null } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = el('canvas', { class: 'confetti-canvas' });
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const bits = Array.from({ length: count }, () => ({
    x: emoji ? Math.random() * W : W / 2 + (Math.random() - 0.5) * 120,
    y: emoji ? -40 - Math.random() * H * 0.6 : H * 0.35,
    vx: emoji ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 14,
    vy: emoji ? 2 + Math.random() * 3 : -6 - Math.random() * 10,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    s: 6 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += emoji ? 0.03 : 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      if (emoji) { ctx.font = `${b.s * 3}px serif`; ctx.fillText(emoji, -b.s, b.s); } else { ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); }
      ctx.restore();
    }
    if (t - t0 < 4500) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- the Daily Spin
export async function spinDialog(onRobits) {
  let info;
  try { info = await api.get('/fun/spin'); } catch (e) { toast(e.message, 'error'); return; }
  const n = info.segments.length;
  const step = 360 / n;
  const wheel = el('div', { class: 'spin-wheel', style: { background: `conic-gradient(${info.segments.map((s, i) => `${s.color} ${i * step}deg ${(i + 1) * step}deg`).join(',')})` } },
    info.segments.map((s, i) => el('span', { class: 'spin-label no-i18n', style: { transform: `rotate(${i * step + step / 2}deg) translateY(-96px)` }, text: s.label.replace('JACKPOT ', '★ ') })));
  const result = el('div', { class: 'spin-result' });
  const streak = el('div', { class: 'small muted', text: tr(`Streak: ${info.streak} day${info.streak === 1 ? '' : 's'} in a row (spin every day for a bonus!)`) });
  const btn = el('button', { class: 'btn btn-green btn-large', text: info.canSpin ? tr('SPIN!') : tr('Come back tomorrow'), disabled: !info.canSpin });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let r;
    try { r = await api.post('/fun/spin', {}); } catch (e) { toast(e.message, 'error'); return; }
    // 5 full turns, then stop with the won segment under the pointer (at the top)
    const end = 360 * 5 + (360 - (r.index * step + step / 2)) + (Math.random() - 0.5) * step * 0.6;
    wheel.style.transform = `rotate(${end}deg)`;
    setTimeout(() => {
      result.replaceChildren(el('b', { class: 'no-i18n', text: `🎉 ${tr('You won')}: ${tr(r.prize)}` }), ...(r.bonus ? [el('div', { class: 'small', text: tr(`+ R$ ${r.bonus} streak bonus (day ${r.streak})`) })] : []));
      btn.textContent = tr('Come back tomorrow');
      confetti(r.jackpot ? { count: 260 } : {});
      onRobits && onRobits(r.robits);
      streak.textContent = tr(`Streak: ${r.streak} day${r.streak === 1 ? '' : 's'} in a row (spin every day for a bonus!)`);
    }, 4200);
  });
  modal({
    title: 'Daily Spin',
    width: 380,
    body: el('div', { class: 'spin-box' },
      el('div', { class: 'spin-wrap' }, el('div', { class: 'spin-pointer' }), wheel, el('div', { class: 'spin-hub' })),
      result, btn, streak),
    buttons: [{ text: 'Close' }],
  });
}

// ---------------------------------------------------------------- the secret code
// ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
export function installSecret(onRobits) {
  let pos = 0;
  document.addEventListener('keydown', async (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === KONAMI[pos] ? pos + 1 : k === KONAMI[0] ? 1 : 0;
    if (pos < KONAMI.length) return;
    pos = 0;
    confetti({ count: 60, emoji: '🟥' });
    document.body.classList.add('secret-spin');
    setTimeout(() => document.body.classList.remove('secret-spin'), 1200);
    try {
      const r = await api.post('/fun/secret', { code: 'uuddlrlrba' });
      if (r.first) { toast(tr('You found the secret! +R$ 100 and the Secret Finder badge 🕹️'), 'success'); onRobits && onRobits(r.robits); }
      else toast(tr('You already found the secret 😉'), '');
    } catch { /* logged out */ }
  });
}

export { fmtNum };
