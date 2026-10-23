// Halloween 2026: every game got a spooky update with candies hidden in it.
// Here: my candy, the Halloween shop (items only for candy) and the top
// candy collectors (server/halloween.js).
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, toast, spinner, itemCard, fmtFull } from '../ui.js';

await initPage({ active: 'halloween' });
const app = document.getElementById('app');
const body = el('div', {}, spinner());
app.append(body);

async function load() {
  let r;
  try { r = await api.get('/halloween'); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const left = Math.max(0, r.until - Date.now());
  body.replaceChildren(
    el('div', { class: 'hw-hero' },
      el('div', { class: 'hw-moon' }),
      el('div', { class: 'hw-bats', text: '🦇  🦇    🦇' }),
      el('h1', { text: '🎃 Halloween 2026' }),
      el('p', { text: r.active ? 'Every game got a spooky update! Candies are hidden in every game: find them and spend them in the Halloween shop. The golden candy is worth 5.' : 'The Halloween event is over. See you next year!' }),
      r.active ? el('div', { class: 'hw-left small', text: `Ends in ${Math.floor(left / 86400e3)}d ${Math.floor((left % 86400e3) / 3600e3)}h` }) : null,
      el('div', { class: 'hw-stats' },
        el('div', { class: 'hw-stat' }, el('b', { class: 'no-i18n', text: `🍬 ${fmtFull(r.candy)}` }), el('span', { text: 'Your candy' })),
        el('div', { class: 'hw-stat' }, el('b', { class: 'no-i18n', text: `${fmtFull(r.today)} / ${fmtFull(r.cap)}` }), el('span', { text: 'Collected today' })),
        el('div', { class: 'hw-stat' }, el('b', { class: 'no-i18n', text: fmtFull(r.total) }), el('span', { text: 'Collected in all' }))),
      r.active ? el('a', { class: 'btn btn-large hw-play', href: '/games', text: 'Play and find candy' }) : null),
    el('h2', { text: 'Halloween Shop' }),
    el('p', { class: 'muted small', text: 'Only for candy, only during Halloween. These items can\'t be bought with Robits or traded.' }),
    el('div', { class: 'hw-shop' }, r.shop.map((it) => el('div', { class: 'hw-item' },
      itemCard(it, { hidePrice: true }),
      el('div', { class: 'hw-cost no-i18n', text: `🍬 ${fmtFull(it.cost)}` }),
      it.owned ? el('span', { class: 'pill online-pill', text: '✓ Owned' })
        : el('button', { class: 'btn btn-small hw-buy', text: 'Buy', disabled: !r.active || r.candy < it.cost, onclick: async () => {
          if (!confirm(`${it.name} for ${it.cost} candy?`)) return;
          try { await api.post('/halloween/buy', { itemId: it.id }); toast(`${it.name} is yours! Wear it in Avatar.`, 'success'); load(); } catch (e) { toast(e.message, 'error'); }
        } })))),
    el('h2', { text: 'Top Candy Collectors' }),
    r.top.length ? el('div', { class: 'panel hw-top' }, r.top.map((u, i) => el('a', { class: 'hw-top-row', href: `/profile?id=${u.id}` },
      el('span', { class: 'hw-rank', text: ['🥇', '🥈', '🥉'][i] || `#${i + 1}` }), el('span', { class: 'no-i18n', text: u.username }), el('b', { class: 'no-i18n', text: `🍬 ${fmtFull(u.total)}` }))))
      : el('div', { class: 'empty', text: 'Nobody has found candy yet. Be the first!' }));
}
load();

const style = document.createElement('style');
style.textContent = `
.hw-hero { position: relative; overflow: hidden; border-radius: 10px; padding: 26px 24px 22px; color: #fff; background: radial-gradient(circle at 80% 20%, #3b1f5c 0%, #1a0f24 55%, #0d0712 100%); margin-bottom: 18px; }
.hw-hero h1 { margin: 0 0 6px; font-size: 32px; color: #ff9a3c; text-shadow: 0 2px 0 #000; }
.hw-hero p { max-width: 640px; opacity: .92; }
.hw-moon { position: absolute; right: 30px; top: 18px; width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff8d8, #ffd27a 60%, #d9a33a); box-shadow: 0 0 40px rgba(255,210,122,.6); }
.hw-bats { position: absolute; right: 120px; top: 22px; font-size: 22px; letter-spacing: 6px; opacity: .8; }
.hw-left { color: #ffc98a; margin-top: 4px; }
.hw-stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
.hw-stat { background: rgba(255,255,255,.08); border: 1px solid rgba(255,154,60,.4); border-radius: 8px; padding: 8px 14px; display: flex; flex-direction: column; }
.hw-stat b { font-size: 20px; color: #ffd27a; }
.hw-stat span { font-size: 12px; opacity: .8; }
.hw-play { background: #ff7a12; border-color: #ff7a12; color: #fff; }
.hw-shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; margin-bottom: 20px; }
.hw-item { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.hw-cost { font-weight: 800; color: #ff7a12; text-align: center; }
.hw-buy { background: #ff7a12; border-color: #ff7a12; color: #fff; }
.hw-top { display: flex; flex-direction: column; }
.hw-top-row { display: flex; gap: 10px; align-items: center; padding: 8px 4px; border-bottom: 1px solid var(--border); color: inherit; }
.hw-top-row:last-child { border-bottom: 0; }
.hw-top-row b { margin-left: auto; color: #ff7a12; }
.hw-rank { width: 34px; text-align: center; }
`;
document.head.append(style);
