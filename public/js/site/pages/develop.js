import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, fmtFull, timeAgo, modal, toast, spinner } from '../ui.js';
import { gameThumbnail } from '../../render/thumbs.js';

const me = await initPage({ active: 'create' });
const app = document.getElementById('app');
const GENRES = ['All', 'Adventure', 'Building', 'Comedy', 'Fighting', 'FPS', 'Horror', 'Medieval', 'Military', 'Naval', 'RPG', 'Sci-Fi', 'Sports', 'Town and City', 'Western'];

app.append(el('div', { class: 'dev-banner' },
  el('div', {}, el('h1', { text: 'Create' }), el('p', { text: 'Build anything you can imagine with Robis Studio, script it with Lua, and share it with the world.' })),
  el('div', { class: 'row' },
    el('a', { class: 'btn btn-green btn-large', href: '/studio', text: 'Open Robis Studio' }),
    el('button', { class: 'btn btn-large', text: 'Create New Game', onclick: createGame }),
    el('a', { class: 'btn btn-large', href: '/create', text: 'Create Item (BETA)' }))));
const list = el('div', { class: 'panel' }, spinner());
app.append(el('h2', { text: 'My Games' }), list);

async function load() {
  const { games } = await api.get(`/users/${me.id}/games`);
  if (!games.length) { list.replaceChildren(el('div', { class: 'empty', text: 'You haven\'t created any games yet. Click "Create New Game" to start!' })); return; }
  list.replaceChildren(...games.map((g) => {
    const img = el('img', { alt: '' });
    gameThumbnail(g, 256).then((u) => { img.src = u; });
    return el('div', { class: 'dev-row' },
      el('a', { class: 'dev-thumb', href: `/game?id=${g.id}` }, img),
      el('div', { class: 'spacer', style: { minWidth: 0 } },
        el('a', { href: `/game?id=${g.id}` }, el('b', { text: g.name })),
        el('div', { class: 'small muted', text: `${g.isPublic ? 'Public' : 'Private'} · ${fmtFull(g.visits)} visits · ${g.playing} playing · updated ${timeAgo(g.updated)}` })),
      el('a', { class: 'btn btn-primary btn-small', href: `/studio?gameId=${g.id}`, text: 'Edit' }),
      el('button', { class: 'btn btn-small', text: 'Configure', onclick: () => configure(g) }),
      el('button', { class: 'btn btn-small', text: g.isPublic ? 'Make Private' : 'Make Public', onclick: async () => { await api.patch(`/games/${g.id}`, { isPublic: !g.isPublic }); load(); } }));
  }));
}

async function createGame() {
  const { templates } = await api.get('/templates');
  const name = el('input', { class: 'input', value: `${me.username}'s Place` });
  let chosen = 'baseplate';
  const grid = el('div', { class: 'tpl-grid' });
  const draw = () => grid.replaceChildren(...templates.map((t) => el('button', {
    class: 'tpl' + (t.key === chosen ? ' sel' : ''), onclick: () => { chosen = t.key; draw(); },
  }, el('b', { text: t.name }), el('span', { class: 'small muted', text: t.desc }))));
  draw();
  modal({
    title: 'Create New Game', width: 560,
    body: el('div', {}, el('label', { class: 'field' }, 'Name', name), el('div', { class: 'field', text: 'Template' }), grid),
    buttons: [{ text: 'Create & Open Studio', cls: 'btn-green', onClick: async () => {
      try {
        const { game } = await api.post('/games', { name: name.value, template: chosen });
        location.href = `/studio?gameId=${game.id}`;
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

function configure(g) {
  const name = el('input', { class: 'input', value: g.name, maxlength: 50 });
  const desc = el('textarea', { class: 'input', rows: 5, maxlength: 1000 });
  desc.value = g.description;
  const genre = el('select', { class: 'input' }, GENRES.map((x) => el('option', { value: x, text: x, selected: x === g.genre })));
  const maxP = el('input', { class: 'input', type: 'number', min: 1, max: 50, value: g.maxPlayers });
  const pub = el('input', { type: 'checkbox', checked: g.isPublic });
  const copy = el('input', { type: 'checkbox', checked: g.copyable });
  modal({
    title: 'Configure Game', width: 560,
    body: el('div', {},
      el('label', { class: 'field' }, 'Name', name), el('label', { class: 'field' }, 'Description', desc),
      el('div', { class: 'row' }, el('label', { class: 'field spacer' }, 'Genre', genre), el('label', { class: 'field', style: { width: '140px' } }, 'Max Players', maxP)),
      el('label', { class: 'row small' }, pub, 'Public (anyone can play)'),
      el('label', { class: 'row small' }, copy, 'Copyable (anyone can open it in Studio)'),
      el('hr', { style: { border: 0, borderTop: '1px solid #e3e3e3' } }),
      el('button', { class: 'btn btn-red btn-small', text: 'Delete this game', onclick: async () => {
        if (!confirm(`Delete "${g.name}" forever?`)) return;
        await api.del(`/games/${g.id}`); document.querySelector('.modal-backdrop')?.remove(); load();
      } })),
    buttons: [{ text: 'Save', cls: 'btn-primary', onClick: async () => {
      try {
        await api.patch(`/games/${g.id}`, { name: name.value, description: desc.value, genre: genre.value, maxPlayers: +maxP.value, isPublic: pub.checked, copyable: copy.checked });
        toast('Saved', 'success'); load();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

load().then(() => {
  const c = +qs('configure');
  if (c) api.get(`/games/${c}`).then(({ game }) => configure(game));
});

const style = document.createElement('style');
style.textContent = `
.dev-banner { background: linear-gradient(120deg, #0074bd, #00a2ff); color: #fff; border-radius: 4px; padding: 28px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 28px; }
.dev-banner h1 { margin-bottom: 4px; }
.dev-banner p { margin: 0; opacity: .95; }
.dev-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.dev-thumb { width: 72px; height: 72px; background: #d4d4d4; border-radius: 3px; overflow: hidden; flex: none; }
.dev-thumb img { width: 100%; height: 100%; object-fit: cover; }
.tpl-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.tpl { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 12px; border: 2px solid var(--border); background: #fff; border-radius: 4px; cursor: pointer; }
.tpl.sel { border-color: var(--blue); background: #eaf6ff; }
`;
document.head.append(style);
