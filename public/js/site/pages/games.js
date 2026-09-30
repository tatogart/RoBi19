import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, gameCard, spinner, qs } from '../ui.js';

await initPage({ active: 'games', requireAuth: false });
const app = document.getElementById('app');
const q = qs('q');

const GENRES = ['All', 'Adventure', 'Building', 'Comedy', 'Fighting', 'FPS', 'Horror', 'Medieval', 'Military', 'Naval', 'RPG', 'Sci-Fi', 'Sports', 'Town and City', 'Western'];
const genreSel = el('select', { class: 'input', style: { width: 'auto' } }, GENRES.map((g) => el('option', { value: g, text: g })));
const header = el('div', { class: 'section-header' }, el('h1', { style: { margin: 0 }, text: q ? `Results for "${q}"` : 'Games' }), el('label', { class: 'row small' }, 'Genre', genreSel));
app.append(header);
const body = el('div');
app.append(body);

async function load() {
  body.replaceChildren(spinner());
  const genre = genreSel.value;
  if (q) {
    const { games } = await api.get(`/games?q=${encodeURIComponent(q)}`);
    body.replaceChildren(games.length ? el('div', { class: 'game-grid' }, games.map(gameCard)) : el('div', { class: 'empty', text: 'No games found.' }));
    return;
  }
  const sorts = [['popular', 'Popular'], ['top', 'Top Rated'], ['featured', 'Featured'], ['recent', 'Recently Updated'], ['visits', 'Most Visited']];
  const results = await Promise.all(sorts.map(([s]) => api.get(`/games?sort=${s}&genre=${encodeURIComponent(genre)}`)));
  body.replaceChildren(...sorts.map(([, title], i) => el('div', { class: 'section' },
    el('div', { class: 'section-header' }, el('h2', { text: title })),
    results[i].games.length ? el('div', { class: 'game-row' }, results[i].games.map(gameCard)) : el('div', { class: 'empty panel', text: 'No games in this genre yet.' }))));
}
genreSel.addEventListener('change', load);
load();
