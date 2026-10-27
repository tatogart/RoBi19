// The Last Night of Robis: the farewell event and the Wall of Thanks
// (server/farewell.js). Everybody leaves one message (it can be changed),
// likes other messages; playing any game gives the Farewell Lantern pet.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, toast, spinner, itemCard } from '../ui.js';
import { LANG } from '../../i18n.js';

const me = await initPage({ active: 'farewell' });
const app = document.getElementById('app');
const RU = LANG === 'ru';
const T = (en, ru) => (RU ? ru : en);
const num = (n) => Math.trunc(+n || 0).toLocaleString(RU ? 'ru-RU' : 'en-US');
const ago = (t) => {
  const m = Math.floor((Date.now() - t) / 60e3);
  if (m < 1) return T('just now', 'только что');
  if (m < 60) return RU ? `${m} мин назад` : `${m}m ago`;
  if (m < 1440) return RU ? `${Math.floor(m / 60)} ч назад` : `${Math.floor(m / 60)}h ago`;
  return new Date(t).toLocaleDateString(RU ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
};
const NOTE = ['#fff4c2', '#ffe0cc', '#e3f1ff', '#e6ffe0', '#f4e3ff', '#ffe3ec'];

const top = el('div', {}, spinner());
const form = el('div');
const tabs = el('div', { class: 'fw-tabs' });
const wall = el('div', { class: 'fw-wall' });
app.append(top, form, tabs, wall);
let sort = 'new';
let data = null;

function countdown(at) {
  const b = el('b', { class: 'no-i18n' });
  const tick = () => {
    const ms = at - Date.now();
    const [d, h, m] = [Math.floor(ms / 86400e3), Math.floor((ms % 86400e3) / 3600e3), Math.floor((ms % 3600e3) / 60e3)];
    b.textContent = ms <= 0 ? T('the end', 'конец') : RU ? `${d} д ${h} ч ${m} мин` : `${d}d ${h}h ${m}m`;
  };
  tick();
  setInterval(tick, 30e3);
  return b;
}

function drawTop(r) {
  const lanterns = el('div', { class: 'fw-sky', 'aria-hidden': 'true' });
  for (let i = 0; i < 16; i++) lanterns.append(el('span', { class: 'fw-l', text: '🏮', style: { left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 1.7) % 14}s`, animationDuration: `${11 + (i % 5) * 2}s`, fontSize: `${16 + (i % 4) * 6}px` } }));
  top.replaceChildren(el('div', { class: 'fw-hero no-i18n' },
    lanterns,
    el('h1', { text: T('🏮 The Last Night of Robis', '🏮 Последняя ночь Robis') }),
    el('p', { text: r.active
      ? T('Robis is saying goodbye. Every game turned into a warm night with lanterns rising into the sky. Play any game to get the Farewell Lantern, and leave a few words on the Wall of Thanks: they float over the spawn in the games.',
        'Robis прощается. Все игры превратились в тёплую ночь с фонариками, которые улетают в небо. Зайди в любую игру и получи Прощальный фонарик, а на Стене благодарностей оставь пару слов: они висят над спавном в играх.')
      : T('Thank you for everything. Leave a few words on the Wall of Thanks.', 'Спасибо за всё. Оставь пару слов на Стене благодарностей.') }),
    r.closing ? el('div', { class: 'fw-left' }, T('Robis closes in ', 'Robis закроется через '), countdown(r.closing.at)) : null,
    el('div', { class: 'fw-stats' },
      el('div', { class: 'fw-stat' }, el('b', { text: num(r.count) }), el('span', { text: T('messages on the wall', 'сообщений на стене') })),
      el('div', { class: 'fw-stat' }, el('b', { text: num(r.players) }), el('span', { text: T('stayed until the end', 'остались до конца') }))),
    el('div', { class: 'fw-reward' },
      el('div', { class: 'fw-reward-card' }, itemCard(r.lantern, { hidePrice: true })),
      el('div', {},
        el('b', { text: T('Farewell Lantern', 'Прощальный фонарик') }),
        el('p', { class: 'small', text: r.lantern.owned ? T('✓ It\'s yours. Wear it in Avatar!', '✓ Он твой. Надень его в Аватаре!') : T('Play any game during the Last Night to get it, plus the "Until The Very End" badge.', 'Зайди в любую игру в Последнюю ночь, чтобы получить его и значок «До самого конца».') }),
        r.lantern.owned ? el('a', { class: 'btn btn-small', href: '/avatar', text: T('Avatar', 'Аватар') }) : el('a', { class: 'btn btn-small fw-btn', href: '/games', text: T('Play', 'Играть') })))));
}

function drawForm(r) {
  const mine = r.mine;
  const ta = el('textarea', { class: 'fw-ta', maxlength: 280, rows: 3, placeholder: T('What will you remember about Robis? Who do you want to thank?', 'Что тебе запомнится в Robis? Кого хочешь поблагодарить?') });
  ta.value = mine ? mine.text : '';
  const left = el('span', { class: 'small muted no-i18n' });
  const upd = () => { left.textContent = `${ta.value.length} / 280`; };
  ta.addEventListener('input', upd);
  upd();
  const send = el('button', { class: 'btn btn-green no-i18n', text: mine ? T('Change my message', 'Изменить сообщение') : T('Leave it on the wall', 'Оставить на стене'), onclick: async () => {
    send.disabled = true;
    try { await api.post('/farewell/wall', { text: ta.value }); toast(T('Thank you! Your message is on the wall.', 'Спасибо! Твоё сообщение на стене.'), 'success'); load(); } catch (e) { toast(e.message, 'error'); send.disabled = false; }
  } });
  form.replaceChildren(el('div', { class: 'panel fw-form no-i18n' },
    el('h2', { text: T('💌 Wall of Thanks', '💌 Стена благодарностей') }),
    me && !me.guest ? el('div', {}, ta, el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' } }, left, send),
      mine ? null : el('p', { class: 'small muted', text: T('Writing here gives the "Thank You, Robis" badge.', 'За сообщение ты получишь значок «Спасибо, Robis».') }))
      : el('p', { class: 'muted', text: T('Log in with an account to write on the wall.', 'Войди в аккаунт, чтобы написать на стене.') })));
}

function card(m, i) {
  const like = el('button', { class: 'fw-like' + (m.liked ? ' on' : ''), title: T('Like', 'Нравится'), onclick: async () => {
    try { const r = await api.post('/farewell/like', { id: m.id }); m.liked = r.liked; m.likes = r.likes; like.classList.toggle('on', r.liked); like.textContent = `${r.liked ? '❤' : '♡'} ${r.likes}`; } catch (e) { toast(e.message, 'error'); }
  } }, `${m.liked ? '❤' : '♡'} ${m.likes}`);
  const del = m.mine || data.staff ? el('button', { class: 'fw-del', title: T('Delete', 'Удалить'), text: '✕', onclick: async () => {
    if (!confirm(T('Delete this message?', 'Удалить это сообщение?'))) return;
    try { await api.del(`/farewell/wall/${m.id}`); load(); } catch (e) { toast(e.message, 'error'); }
  } }) : null;
  return el('div', { class: 'fw-note no-i18n' + (m.mine ? ' mine' : ''), style: { background: NOTE[m.id % NOTE.length], transform: `rotate(${((m.id * 7) % 5) - 2}deg)` } },
    del,
    el('p', { class: 'fw-text', text: m.text }),
    el('div', { class: 'fw-foot' },
      el('a', { class: 'fw-who', href: `/profile?id=${m.userId}` }, el('span', { class: 'fw-ava', text: (m.username[0] || '?').toUpperCase(), style: { background: `hsl(${(m.userId * 47) % 360} 60% 45%)` } }), m.username),
      el('span', { class: 'fw-time', text: ago(m.created) }),
      like));
}

function drawWall(r) {
  tabs.replaceChildren(...[['new', T('Newest', 'Новые')], ['top', T('Most liked', 'Лучшие')]].map(([k, label]) =>
    el('button', { class: 'btn btn-small no-i18n' + (sort === k ? ' btn-primary' : ''), text: label, onclick: () => { sort = k; load(); } })));
  wall.replaceChildren(...(r.wall.length ? r.wall.map(card) : [el('div', { class: 'empty no-i18n', text: T('The wall is empty. Be the first to say thank you!', 'Стена пока пустая. Будь первым, кто скажет спасибо!') })]));
}

async function load(quiet) {
  try { data = await api.get(`/farewell?sort=${sort}`); } catch (e) { if (!quiet) top.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  if (!quiet) { drawTop(data); drawForm(data); }
  drawWall(data);
}
load();
setInterval(() => { if (!document.hidden && !document.activeElement?.classList.contains('fw-ta')) load(true); }, 30e3);

const style = document.createElement('style');
style.textContent = `
.fw-hero { position: relative; overflow: hidden; border-radius: 10px; padding: 28px 24px 22px; color: #fff; background: radial-gradient(circle at 75% 15%, #4a2d6b 0%, #1c1430 55%, #0c0a18 100%); margin-bottom: 16px; }
.fw-hero > *:not(.fw-sky) { position: relative; }
.fw-hero h1 { margin: 0 0 8px; font-size: 32px; color: #ffcf7a; text-shadow: 0 2px 0 #000; }
.fw-hero p { max-width: 660px; opacity: .93; }
.fw-sky { position: absolute; inset: 0; pointer-events: none; }
.fw-l { position: absolute; bottom: -40px; opacity: .85; filter: drop-shadow(0 0 8px #ff9a3c); animation: fw-rise linear infinite; }
@keyframes fw-rise { from { transform: translate(0, 0); opacity: 0; } 10% { opacity: .9; } to { transform: translate(30px, -520px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .fw-l { animation: none; bottom: 10%; } }
.fw-left { color: #ffcf7a; margin-top: 4px; }
.fw-stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
.fw-stat { background: rgba(255,255,255,.08); border: 1px solid rgba(255,181,71,.4); border-radius: 8px; padding: 8px 14px; display: flex; flex-direction: column; }
.fw-stat b { font-size: 20px; color: #ffcf7a; }
.fw-stat span { font-size: 12px; opacity: .8; }
.fw-reward { display: flex; gap: 14px; align-items: center; background: rgba(0,0,0,.25); border-radius: 8px; padding: 10px; max-width: 520px; }
.fw-reward-card { width: 120px; flex: none; color: var(--text); }
.fw-reward p { margin: 4px 0 8px; }
.fw-btn, .fw-reward .btn { background: #ff8a3d; border-color: #ff8a3d; color: #fff; }
.fw-form h2 { margin-top: 0; }
.fw-ta { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg, #fff); color: inherit; }
.fw-tabs { display: flex; gap: 6px; margin: 14px 0 10px; }
.fw-wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 6px 2px 20px; }
.fw-note { position: relative; color: #2b2b2b; border-radius: 4px; padding: 14px 14px 10px; box-shadow: 0 3px 8px rgba(0,0,0,.18); display: flex; flex-direction: column; min-height: 120px; }
.fw-note.mine { outline: 2px solid #ff8a3d; }
.fw-text { margin: 0 0 10px; white-space: pre-wrap; overflow-wrap: anywhere; flex: 1; font-size: 15px; }
.fw-foot { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.fw-who { display: flex; align-items: center; gap: 6px; color: #2b2b2b; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-ava { width: 22px; height: 22px; border-radius: 50%; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex: none; }
.fw-time { color: #777; font-size: 12px; white-space: nowrap; }
.fw-like { margin-left: auto; border: 0; background: rgba(255,255,255,.6); border-radius: 12px; padding: 2px 8px; cursor: pointer; color: #c23; font-weight: 700; white-space: nowrap; }
.fw-like.on { background: #ffd6dc; }
.fw-del { position: absolute; top: 4px; right: 6px; border: 0; background: none; color: #999; cursor: pointer; font-size: 13px; }
.fw-del:hover { color: #c23; }
`;
document.head.append(style);
