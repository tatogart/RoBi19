// Little fun things: confetti, the Daily Spin wheel and the secret code.
import { api } from './api.js';
import { el, modal, toast, fmtNum, launchGame } from './ui.js';
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
// The wheel itself (also the preview in the Admin Panel).
export function wheelEl(segments, size = 260) {
  const step = 360 / segments.length;
  return el('div', { class: 'spin-wheel', style: { background: `conic-gradient(${segments.map((s, i) => `${s.color} ${i * step}deg ${(i + 1) * step}deg`).join(',')})` } },
    segments.map((s, i) => el('span', { class: 'spin-label no-i18n', style: { transform: `rotate(${i * step + step / 2}deg) translateY(-${Math.round(size * 0.37)}px)` }, text: String(s.label).replace('JACKPOT ', '★ ') })));
}
export async function spinDialog(onRobits) {
  let info;
  try { info = await api.get('/fun/spin'); } catch (e) { toast(e.message, 'error'); return; }
  const n = info.segments.length;
  const step = 360 / n;
  const wheel = wheelEl(info.segments);
  const result = el('div', { class: 'spin-result' });
  const streakText = (k) => tr(`Streak: ${k} day${k === 1 ? '' : 's'} in a row (spin every day for a bonus!)`);
  const streak = el('div', { class: 'small muted', text: streakText(info.streak) });
  const label = (free) => (free > 0 ? tr(`SPIN! (${free} free)`) : tr('SPIN!'));
  const btn = el('button', { class: 'btn btn-green btn-large', text: !info.on ? tr('The wheel is resting') : info.canSpin ? label(info.spunToday ? info.freeSpins : 0) : tr('Come back tomorrow'), disabled: !info.canSpin });
  let turns = 0;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let r;
    try { r = await api.post('/fun/spin', {}); } catch (e) { toast(e.message, 'error'); return; }
    // 5 full turns, then stop with the won segment under the pointer (at the top)
    turns += 5;
    const end = 360 * turns + (360 - (r.index * step + step / 2)) + (Math.random() - 0.5) * step * 0.6;
    wheel.style.transform = `rotate(${end}deg)`;
    setTimeout(() => {
      result.replaceChildren(el('b', { class: 'no-i18n', text: `🎉 ${tr('You won')}: ${tr(r.prize)}` }), ...(r.bonus ? [el('div', { class: 'small', text: tr(`+ R$ ${r.bonus} streak bonus (day ${r.streak})`) })] : []));
      if (r.freeSpins > 0) { btn.textContent = label(r.freeSpins); btn.disabled = false; } else btn.textContent = tr('Come back tomorrow');
      confetti(r.jackpot ? { count: 260 } : {});
      onRobits && onRobits(r.robits);
      streak.textContent = streakText(r.streak);
    }, 4200);
  });
  modal({
    title: 'Daily Spin',
    width: 380,
    body: el('div', { class: 'spin-box' },
      info.boost ? el('div', { class: 'spin-boost', text: tr(`x${info.boost.mult} BOOST: all Robits prizes are bigger right now!`) }) : null,
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

// ---------------------------------------------------------------- live events
// Decorations on every page, Robits rain and parties from the admins.
const DECOR = {
  snow: ['❄', '❅', '❆'], halloween: ['🎃', '🦇', '👻', '🕸️'], hearts: ['💖', '💗', '💕'],
  confetti: ['🎉', '🎊', '✨'], leaves: ['🍂', '🍁', '🍃'], stars: ['✨', '⭐', '🌟'],
};
const hideKey = 'robis.decor.hidden';
let decorBox = null;
export function setDecor(name) {
  let hidden = '';
  try { hidden = localStorage.getItem(hideKey) || ''; } catch { /* private mode */ }
  if (decorBox && decorBox.dataset.name === name) return;
  if (decorBox) { decorBox.remove(); decorBox = null; }
  if (!DECOR[name] || hidden === name || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const list = DECOR[name];
  decorBox = el('div', { class: 'decor-layer decor-' + name, 'aria-hidden': 'true' },
    Array.from({ length: 22 }, (_, i) => el('span', { class: 'decor-bit', text: list[i % list.length], style: {
      left: `${(i * 4.6 + (i % 3) * 7) % 100}%`, animationDuration: `${9 + (i % 7) * 1.7}s`, animationDelay: `-${(i * 1.3) % 12}s`, fontSize: `${14 + (i % 4) * 5}px`,
    } })));
  decorBox.dataset.name = name;
  const close = el('button', { class: 'decor-close', title: 'Hide decorations', text: '×', onclick: () => {
    try { localStorage.setItem(hideKey, name); } catch { /* ignore */ }
    decorBox.remove(); decorBox = null;
  } });
  decorBox.append(close);
  document.body.append(decorBox);
}

function bigBanner(text, sub) {
  const b = el('div', { class: 'live-banner' }, el('b', { class: 'no-i18n', text }), sub ? el('div', { class: 'small no-i18n', text: sub }) : null);
  document.body.append(b);
  setTimeout(() => b.classList.add('out'), 5000);
  setTimeout(() => b.remove(), 5600);
}

// While an admin "abuses" a game: a bar on every page with a Join button.
let abuseBar = null;
function showAbuse(a) {
  const hidden = (() => { try { return sessionStorage.getItem('robis.abuse.hidden'); } catch { return null; } })();
  if (!a || hidden === String(a.id)) { if (abuseBar) { abuseBar.remove(); abuseBar = null; } return; }
  if (abuseBar && abuseBar.dataset.id === String(a.id)) return;
  if (abuseBar) abuseBar.remove();
  abuseBar = el('div', { class: 'abuse-bar' },
    el('span', { class: 'abuse-fire', text: '🔥' }),
    el('span', { class: 'abuse-text' }, el('b', { text: tr('ADMIN ABUSE') }), ' ', el('span', { class: 'no-i18n', text: `${a.game} · ${a.by}` })),
    el('button', { class: 'btn btn-small abuse-join', text: tr('Join now!'), onclick: () => launchGame(a.gameId) }),
    el('button', { class: 'abuse-x', text: '×', title: 'Hide', onclick: () => { try { sessionStorage.setItem('robis.abuse.hidden', String(a.id)); } catch { /* ignore */ } abuseBar.remove(); abuseBar = null; } }));
  abuseBar.dataset.id = String(a.id);
  document.body.append(abuseBar);
}

export function startLive(onRobits) {
  const key = 'robis.live.last';
  let last = 0;
  try { last = +(sessionStorage.getItem(key) || localStorage.getItem(key) || 0); } catch { /* ignore */ }
  const check = async () => {
    let r;
    try { r = await api.get('/fun/live?since=' + last); } catch { return; }
    setDecor(r.decor);
    for (const e of r.events) {
      if (e.type === 'rain') {
        confetti({ count: 70, emoji: '💰' });
        bigBanner(`${tr('Robits rain!')} +R$ ${fmtNum(e.amount)}`, e.text || `${tr('From')} ${e.by}`);
        api.get('/auth/me').then((m) => m.user && onRobits && onRobits(m.user.robits)).catch(() => {});
      } else if (e.type === 'abuse') {
        confetti({ count: 120, colors: ['#ff3b3b', '#ffc400', '#ffffff'] });
        bigBanner(`🔥 ${tr('ADMIN ABUSE')}: ${e.game}!`, e.text || `${e.by} ${tr('is in the game right now - join!')}`);
      } else if (e.type === 'party') {
        confetti({ count: 200 });
        if (e.emoji) setTimeout(() => confetti({ count: 40, emoji: e.emoji }), 600);
        bigBanner(e.text, `${tr('From')} ${e.by}`);
      }
    }
    last = Math.max(last, r.last);
    try { localStorage.setItem(key, String(last)); } catch { /* ignore */ }
    showAbuse(r.abuse);
    const nav = document.querySelector('.spin-nav');
    if (nav) nav.classList.toggle('boost', !!r.boost);
  };
  check();
  setInterval(check, 15000);
}

// ---------------------------------------------------------------- polls
// The admins' polls on the home page: vote, then see the results.
export async function pollCards() {
  let polls;
  try { ({ polls } = await api.get('/polls')); } catch { return null; }
  if (!polls.length) return null;
  const card = (p) => {
    const box = el('div', { class: 'panel section poll-card' });
    const draw = () => {
      const voted = p.myVote !== null;
      const max = Math.max(1, ...(p.counts || [0]));
      box.replaceChildren(
        el('div', { class: 'poll-head' }, el('span', { text: '📊' }), el('b', { class: 'no-i18n', text: p.question }), p.closed ? el('span', { class: 'pill', text: 'CLOSED' }) : null),
        el('div', { class: 'poll-options' }, p.options.map((o, i) => (p.counts
          ? el('div', { class: 'poll-result' + (p.myVote === i ? ' mine' : '') + (p.counts[i] === max && p.total ? ' top' : '') },
            el('div', { class: 'poll-fill', style: { width: (p.total ? Math.round((p.counts[i] / p.total) * 100) : 0) + '%' } }),
            el('span', { class: 'no-i18n', text: o + (p.myVote === i ? ' ✓' : '') }), el('b', { text: (p.total ? Math.round((p.counts[i] / p.total) * 100) : 0) + '%' }))
          : el('button', { class: 'btn poll-option no-i18n', text: o, onclick: async () => {
            try { ({ poll: p } = await api.post(`/polls/${p.id}/vote`, { option: i })); draw(); confetti({ count: 50 }); } catch (e) { toast(e.message, 'error'); }
          } })))),
        el('div', { class: 'small muted', text: voted || p.closed ? tr(`${p.total} vote${p.total === 1 ? '' : 's'}`) : tr('Vote to see the results!') }));
    };
    draw();
    return box;
  };
  return el('div', {}, polls.map(card));
}
