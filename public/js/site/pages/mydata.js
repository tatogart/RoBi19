// My data, as a presentation: slides drawn as pictures (1280 x 720) from
// /api/me/export - the account, items, friends, games, activity. Every
// slide downloads as a PNG; the games' files (for Studio) stay a small link.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, spinner, toast } from '../ui.js';
import { avatarHeadshot, itemThumbnail, gameThumbnail } from '../../render/thumbs.js';
import { LANG } from '../../i18n.js';

const me = await initPage({ active: 'settings' });
const app = document.getElementById('app');
const RU = LANG === 'ru';
const T = (en, ru) => (RU ? ru : en);
const W = 1280, H = 720;
const num = (n) => Math.trunc(+n || 0).toLocaleString(RU ? 'ru-RU' : 'en-US');
const date = (s) => (s ? new Date(s).toLocaleDateString(RU ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

app.append(el('h1', { text: T('My data', 'Мои данные') }));
const box = el('div', {}, spinner(), el('p', { class: 'muted small', text: T('Drawing your slides...', 'Рисуем твои слайды...') }));
app.append(box);

// ---------------------------------------------------------------- drawing helpers
const loadImg = (src) => new Promise((ok) => {
  if (!src) return ok(null);
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => ok(null);
  i.src = src;
});
const timeout = (p, ms = 8000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}
const FONT = '"Source Sans Pro", "Segoe UI", Arial, sans-serif';
function bg(ctx, top = '#00a2ff', bottom = '#0062c4') {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // the 2019 studs pattern, very light
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
}
function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(ctx, s, x, y, size, o = {}) {
  ctx.font = `${o.weight || 700} ${size}px ${FONT}`;
  ctx.fillStyle = o.color || '#fff';
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'alphabetic';
  let t = String(s);
  if (o.max) while (ctx.measureText(t).width > o.max && t.length > 1) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
}
function header(ctx, title, n, total) {
  text(ctx, 'ROBIS', 48, 70, 30, { weight: 900 });
  text(ctx, title, 48, 128, 52, { weight: 800 });
  text(ctx, `${me.username} · ${n} / ${total}`, W - 48, 70, 22, { align: 'right', weight: 600, color: 'rgba(255,255,255,.8)' });
}
function card(ctx, x, y, w, h, fill = 'rgba(255,255,255,.14)') {
  round(ctx, x, y, w, h, 16);
  ctx.fillStyle = fill; ctx.fill();
}

// ---------------------------------------------------------------- the slides
async function build(d) {
  await document.fonts?.ready;
  const head = await timeout(avatarHeadshot(me.avatar, 420).then(loadImg), 10000);
  const slides = [];
  const TOTAL = 7;

  // 1. cover
  {
    const [c, ctx] = canvas();
    bg(ctx);
    text(ctx, 'ROBIS', W / 2, 150, 96, { align: 'center', weight: 900 });
    if (head) { ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 330, 130, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill(); ctx.clip(); ctx.drawImage(head, W / 2 - 130, 200, 260, 260); ctx.restore(); }
    text(ctx, me.username, W / 2, 540, 64, { align: 'center', weight: 800 });
    text(ctx, T('My Robis data', 'Мои данные в Robis'), W / 2, 592, 30, { align: 'center', weight: 600, color: 'rgba(255,255,255,.85)' });
    text(ctx, T(`Saved on ${date(Date.now())}`, `Сохранено ${date(Date.now())}`), W / 2, 660, 22, { align: 'center', weight: 600, color: 'rgba(255,255,255,.7)' });
    slides.push(c);
  }

  // 2. the account
  {
    const [c, ctx] = canvas();
    bg(ctx);
    header(ctx, T('My account', 'Мой аккаунт'), 2, TOTAL);
    card(ctx, 48, 170, 380, 500);
    if (head) ctx.drawImage(head, 68, 190, 340, 340);
    text(ctx, me.username, 238, 580, 40, { align: 'center', max: 340 });
    text(ctx, T(`since ${date(d.account.created)}`, `с ${date(d.account.created)}`), 238, 625, 22, { align: 'center', weight: 600, color: 'rgba(255,255,255,.8)' });
    const rows = [
      ['💰', 'Robits', `R$ ${num(d.account.robits)}`],
      ['⭐', 'Premium', d.account.premium === 'None' ? T('No', 'Нет') : d.account.premium.replace('OutrageousBuildersClub', 'Premium 2200').replace('TurboBuildersClub', 'Premium 1000').replace('BuildersClub', 'Premium 450')],
      ['🏅', T('Level', 'Уровень'), `${d.account.level || 1} · ${num(d.account.xp)} XP`],
      ['🎒', T('Items', 'Предметов'), num(d.inventory.length)],
      ['👥', T('Friends', 'Друзей'), num(d.friends.length)],
      ['🎮', T('My games', 'Моих игр'), num(d.games.length)],
    ];
    rows.forEach(([ic, k, v], i) => {
      const y = 170 + i * 84;
      card(ctx, 460, y, 772, 72);
      text(ctx, ic, 484, y + 48, 32);
      text(ctx, k, 540, y + 47, 28, { weight: 600, color: 'rgba(255,255,255,.85)' });
      text(ctx, v, 1208, y + 48, 32, { align: 'right', weight: 800, max: 420 });
    });
    slides.push(c);
  }

  // 3. items
  {
    const [c, ctx] = canvas();
    bg(ctx, '#7a3cff', '#3b1f9c');
    header(ctx, T(`My items (${d.inventory.length})`, `Мои предметы (${d.inventory.length})`), 3, TOTAL);
    const list = d.inventory.filter((i) => i.type).slice(-24).reverse();
    const pics = await Promise.all(list.map((it) => timeout(itemThumbnail(it, 160).then(loadImg), 6000)));
    list.forEach((it, i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const x = 48 + col * 148, y = 160 + row * 180;
      card(ctx, x, y, 136, 168, 'rgba(255,255,255,.92)');
      if (pics[i]) ctx.drawImage(pics[i], x + 8, y + 6, 120, 120);
      text(ctx, it.name, x + 68, y + 152, 15, { align: 'center', color: '#222', max: 128 });
    });
    if (!list.length) text(ctx, T('No items yet', 'Предметов пока нет'), W / 2, 400, 40, { align: 'center' });
    if (d.inventory.length > 24) text(ctx, T(`+ ${d.inventory.length - 24} more`, `+ ещё ${d.inventory.length - 24}`), W - 48, 128, 26, { align: 'right', weight: 600 });
    slides.push(c);
  }

  // 4. friends
  {
    const [c, ctx] = canvas();
    bg(ctx, '#02b757', '#007a3a');
    header(ctx, T(`My friends (${d.friends.length})`, `Мои друзья (${d.friends.length})`), 4, TOTAL);
    const list = d.friends.slice(0, 40);
    list.forEach((f, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 48 + col * 300, y = 165 + row * 52;
      card(ctx, x, y, 284, 44);
      text(ctx, '👤 ' + f, x + 14, y + 31, 22, { weight: 700, max: 260 });
    });
    if (!list.length) text(ctx, T('No friends here yet', 'Друзей пока нет'), W / 2, 400, 40, { align: 'center' });
    if (d.friends.length > 40) text(ctx, T(`+ ${d.friends.length - 40} more`, `+ ещё ${d.friends.length - 40}`), W - 48, 128, 26, { align: 'right', weight: 600 });
    slides.push(c);
  }

  // 5. my games
  {
    const [c, ctx] = canvas();
    bg(ctx, '#ff7a12', '#c4281c');
    header(ctx, T(`My games (${d.games.length})`, `Мои игры (${d.games.length})`), 5, TOTAL);
    const list = d.games.slice(0, 6);
    const full = await Promise.all(list.map((g) => api.get(`/games/${g.id}`).then((r) => r.game).catch(() => null)));
    const pics = await Promise.all(full.map((g) => (g ? timeout(gameThumbnail(g, 384).then(loadImg), 10000) : null)));
    list.forEach((g, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 48 + col * 400, y = 160 + row * 270;
      card(ctx, x, y, 384, 256, 'rgba(255,255,255,.95)');
      if (pics[i]) { ctx.save(); round(ctx, x + 8, y + 8, 368, 180, 10); ctx.clip(); ctx.drawImage(pics[i], x + 8, y + 8, 368, 180); ctx.restore(); }
      text(ctx, g.name, x + 16, y + 222, 24, { color: '#222', max: 352 });
      text(ctx, T(`${num(g.visits)} visits`, `${num(g.visits)} посещений`), x + 16, y + 246, 18, { weight: 600, color: '#666' });
    });
    if (!list.length) text(ctx, T('You haven\'t made a game yet', 'Ты пока не сделал ни одной игры'), W / 2, 400, 40, { align: 'center' });
    slides.push(c);
  }

  // 6. activity
  {
    const [c, ctx] = canvas();
    bg(ctx, '#1b2a35', '#0b1218');
    header(ctx, T('My activity', 'Моя активность'), 6, TOTAL);
    const earned = d.transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const spent = -d.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
    const visits = d.games.reduce((a, g) => a + (g.visits || 0), 0);
    const tiles = [
      ['✉', T('Messages', 'Сообщений'), d.messages.length], ['🔁', T('Trades', 'Обменов'), d.trades.length],
      ['📈', T('Robits earned', 'Робитсов получено'), earned], ['🛒', T('Robits spent', 'Робитсов потрачено'), spent],
      ['🏘', T('Groups', 'Групп'), d.groups.length], ['👣', T('Visits of my games', 'Посещений моих игр'), visits],
    ];
    tiles.forEach(([ic, k, v], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 48 + col * 400, y = 170 + row * 250;
      card(ctx, x, y, 384, 230, 'rgba(255,255,255,.08)');
      text(ctx, ic, x + 30, y + 70, 44);
      text(ctx, num(v), x + 30, y + 150, 60, { weight: 900, color: '#3ddc84' });
      text(ctx, k, x + 30, y + 198, 24, { weight: 600, color: 'rgba(255,255,255,.8)', max: 340 });
    });
    slides.push(c);
  }

  // 7. thanks
  {
    const [c, ctx] = canvas();
    bg(ctx);
    text(ctx, T('Thank you for playing!', 'Спасибо, что играл!'), W / 2, 300, 72, { align: 'center', weight: 900 });
    text(ctx, T('Thank you for building, trading and being here with us.', 'Спасибо, что строил, обменивался и был с нами.'), W / 2, 370, 30, { align: 'center', weight: 600, color: 'rgba(255,255,255,.9)' });
    if (head) ctx.drawImage(head, W / 2 - 90, 410, 180, 180);
    text(ctx, 'ROBIS · 2019 – 2026', W / 2, 660, 26, { align: 'center', weight: 800 });
    slides.push(c);
  }
  return slides;
}

// ---------------------------------------------------------------- the viewer
const download = (c, i) => {
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `robis-${me.username}-${i + 1}.png`;
  document.body.append(a); a.click(); a.remove();
};
try {
  const d = await api.get('/me/export');
  const slides = await build(d);
  let at = 0;
  const img = el('img', { class: 'md-slide', alt: '' });
  const dots = el('div', { class: 'md-dots' });
  const show = (i) => {
    at = (i + slides.length) % slides.length;
    img.src = slides[at].toDataURL('image/png');
    dots.replaceChildren(...slides.map((_, k) => el('button', { class: 'md-dot' + (k === at ? ' on' : ''), onclick: () => show(k), 'aria-label': `${k + 1}` })));
  };
  const stage = el('div', { class: 'md-stage' },
    img,
    el('button', { class: 'md-nav md-prev', text: '‹', onclick: () => show(at - 1), 'aria-label': 'Back' }),
    el('button', { class: 'md-nav md-next', text: '›', onclick: () => show(at + 1), 'aria-label': 'Next' }));
  addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1); });
  box.replaceChildren(
    el('p', { class: 'muted', text: T('Your Robis as a presentation. Download the slides as pictures and keep them.', 'Твой Robis в виде презентации. Скачай слайды картинками и сохрани на память.') }),
    stage, dots,
    el('div', { class: 'row wrap md-actions' },
      el('button', { class: 'btn btn-green', text: T('Download this slide (PNG)', 'Скачать этот слайд (PNG)'), onclick: () => download(slides[at], at) }),
      el('button', { class: 'btn btn-primary', text: T('Download all slides', 'Скачать все слайды'), onclick: async () => {
        for (let i = 0; i < slides.length; i++) { download(slides[i], i); await new Promise((r) => setTimeout(r, 400)); }
        toast(T('Saved!', 'Сохранено!'), 'success');
      } }),
      el('button', { class: 'btn', text: T('Full screen', 'На весь экран'), onclick: () => stage.requestFullscreen?.() })),
    el('p', { class: 'small muted' }, T('Your games for Robis Studio (a file for programs, not for reading): ', 'Твои игры для Robis Studio (файл для программ, не для чтения): '),
      el('a', { href: '/api/me/export', download: '', text: T('download', 'скачать') })));
  show(0);
} catch (e) {
  box.replaceChildren(el('div', { class: 'empty', text: e.message }));
}

const style = document.createElement('style');
style.textContent = `
.md-stage { position: relative; background: #111; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
.md-stage:fullscreen { display: flex; align-items: center; justify-content: center; border-radius: 0; }
.md-slide { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; }
.md-stage:fullscreen .md-slide { max-height: 100vh; width: auto; max-width: 100vw; }
.md-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 64px; border: 0; border-radius: 8px; background: rgba(0,0,0,.35); color: #fff; font-size: 34px; cursor: pointer; }
.md-nav:hover { background: rgba(0,0,0,.55); }
.md-prev { left: 10px; } .md-next { right: 10px; }
.md-dots { display: flex; justify-content: center; gap: 8px; margin: 12px 0; }
.md-dot { width: 12px; height: 12px; border-radius: 50%; border: 0; background: var(--border, #ccc); cursor: pointer; padding: 0; }
.md-dot.on { background: var(--blue, #00a2ff); }
.md-actions { gap: 8px; justify-content: center; margin-bottom: 12px; }
`;
document.head.append(style);
