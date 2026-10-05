// Robis Awards: vote for the best games of the year in every category, then
// see the winners. The admins prepare the season (Control Center -> Awards).
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, toast, spinner } from '../ui.js';
import { gameThumbnail } from '../../render/thumbs.js';
import { confetti } from '../fun.js';
import { tr } from '../../i18n.js';

const me = await initPage({ active: 'awards' });
const app = document.getElementById('app');
const body = el('div', {}, spinner());
app.append(body);

async function load(id) {
  let r;
  try { r = await api.get('/awards' + (id ? '?id=' + id : '')); } catch (e) { body.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  const s = r.season;
  if (!s) {
    body.replaceChildren(hero('Robis Awards', 'The next Robis Awards are coming soon. Keep playing and making games!'), pastList(r.past));
    return;
  }
  const voting = s.status === 'voting';
  const cats = s.categories.filter((c) => c.nominees.length);
  const done = cats.filter((c) => c.myVote).length;
  body.replaceChildren(
    hero(s.title, s.intro || (voting ? 'Vote for your favourite game in every category. You can change your vote until voting closes.' : 'The votes are in! Here are the winners.'),
      voting ? el('div', { class: 'aw-progress' }, el('b', { text: `${done} / ${cats.length}` }), el('span', { text: tr('categories voted') })) : el('div', { class: 'aw-progress' }, el('b', { text: '🏆' }), el('span', { text: tr('Results') }))),
    ...cats.map((c) => el('section', { class: 'aw-cat' },
      el('div', { class: 'aw-cat-head' }, el('h2', { text: c.name }), el('span', { class: 'muted', text: c.desc })),
      el('div', { class: 'aw-nominees' }, c.nominees.map((g) => nominee(s, c, g, voting))))),
    pastList(r.past));
  if (!voting && !sessionStorage.getItem('aw-confetti-' + s.id)) { try { sessionStorage.setItem('aw-confetti-' + s.id, '1'); } catch { /* ignore */ } confetti(); }
}

function nominee(s, c, g, voting) {
  const thumb = el('div', { class: 'aw-thumb' });
  gameThumbnail(g).then((u) => thumb.append(el('img', { src: u, alt: '' })));
  const mine = c.myVote === g.id;
  const won = s.status === 'results' && c.winner === g.id;
  return el('div', { class: 'aw-nominee' + (mine ? ' mine' : '') + (won ? ' won' : '') },
    won ? el('div', { class: 'aw-ribbon', text: '🏆 WINNER' }) : null,
    el('a', { href: `/game?id=${g.id}` }, thumb),
    el('div', { class: 'aw-name no-i18n', text: g.name }),
    el('div', { class: 'small muted no-i18n', text: 'by ' + g.creator }),
    s.status === 'results' ? el('div', { class: 'aw-bar' }, el('i', { style: { width: (g.share || 0) + '%' } }), el('span', { text: `${g.share || 0}%` })) : null,
    voting ? el('button', { class: 'btn ' + (mine ? 'btn-green' : 'btn-primary'), text: mine ? '✓ Your vote' : 'Vote', disabled: !me, onclick: async () => {
      try { await api.post('/awards/vote', { category: c.id, gameId: g.id }); toast(tr('Vote saved!'), 'success'); load(); } catch (e) { toast(e.message, 'error'); }
    } }) : null);
}

function hero(title, text, side) {
  return el('div', { class: 'aw-hero' },
    el('div', { class: 'aw-trophy', text: '🏆' }),
    el('div', { class: 'aw-hero-text' }, el('h1', { class: 'no-i18n', text: title }), el('p', { text })),
    side || null);
}
function pastList(past) {
  if (!past || !past.length) return null;
  return el('div', { class: 'panel', style: { marginTop: '18px' } }, el('b', { text: 'Past Robis Awards' }), el('div', { class: 'row wrap', style: { marginTop: '8px' } },
    past.map((p) => el('button', { class: 'btn btn-small no-i18n', text: p.title, onclick: () => load(p.id) }))));
}

load();

const style = document.createElement('style');
style.textContent = `
.aw-hero { display: flex; align-items: center; gap: 18px; padding: 22px 24px; border-radius: 6px; color: #fff; margin-bottom: 18px; background: radial-gradient(circle at 15% 20%, rgba(255,214,90,.35), transparent 45%), linear-gradient(120deg, #1b1b2f, #3a2b6b 55%, #b8860b); box-shadow: var(--shadow); }
.aw-hero h1 { margin: 0 0 4px; color: #ffd75a; text-shadow: 0 2px 0 rgba(0,0,0,.35); }
.aw-hero p { margin: 0; color: rgba(255,255,255,.9); }
.aw-hero-text { flex: 1; min-width: 0; }
.aw-trophy { font-size: 54px; filter: drop-shadow(0 4px 8px rgba(0,0,0,.4)); }
.aw-progress { display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,.12); border-radius: 6px; padding: 8px 14px; }
.aw-progress b { font-size: 22px; }
.aw-cat { margin-bottom: 20px; }
.aw-cat-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.aw-cat-head h2 { margin: 0; font-size: 20px; }
.aw-nominees { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.aw-nominee { position: relative; background: var(--panel); border-radius: 6px; box-shadow: var(--shadow); padding: 8px; display: flex; flex-direction: column; gap: 4px; border: 2px solid transparent; }
.aw-nominee.mine { border-color: var(--green); }
.aw-nominee.won { border-color: #e0a800; box-shadow: 0 0 0 3px rgba(255,196,0,.35), var(--shadow); }
.aw-thumb { aspect-ratio: 1; border-radius: 4px; overflow: hidden; background: #d4d4d4; }
.aw-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.aw-name { font-weight: 700; font-size: 14px; }
.aw-nominee .btn { margin-top: 4px; }
.aw-ribbon { position: absolute; top: 14px; left: -4px; background: linear-gradient(90deg, #e0a800, #ffd75a); color: #3a2400; font-weight: 900; font-size: 12px; padding: 2px 10px; border-radius: 0 4px 4px 0; z-index: 1; box-shadow: 0 2px 4px rgba(0,0,0,.2); }
.aw-bar { position: relative; height: 18px; background: var(--gray-bg); border-radius: 9px; overflow: hidden; font-size: 12px; font-weight: 700; }
.aw-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #ffc400, #ff8a3d); }
.aw-bar span { position: relative; padding-left: 8px; }
@media (max-width: 600px) { .aw-hero { flex-wrap: wrap; } .aw-trophy { font-size: 40px; } }
`;
document.head.append(style);
