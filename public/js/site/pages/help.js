import { initPage } from '../layout.js';
import { el } from '../ui.js';

await initPage({ active: '', requireAuth: false });
const app = document.getElementById('app');
const kbd = (k) => el('kbd', { text: k });
const rows = [
  [['W', 'A', 'S', 'D'], 'Walk (or arrow keys)'], [['Space'], 'Jump'], [['Right mouse'], 'Rotate the camera'],
  [['Mouse wheel', 'I', 'O'], 'Zoom in / out (all the way in = first person)'], [['Shift'], 'Toggle Shift Lock'],
  [['/'], 'Chat (try /e dance, /e wave, /e cheer)'], [['Tab'], 'Toggle the player list'], [['Esc'], 'Game menu'],
  [['R'], 'Reset character (from the menu)'], [['F9'], 'Developer console (game owners)'],
];
app.append(
  el('h1', { text: 'Help & About' }),
  el('div', { class: 'panel' }, el('h2', { text: 'About Robis' }),
    el('p', { text: 'Robis is an open-source, non-commercial tribute to the 2019 era of user-generated game platforms. It includes a website, a multiplayer 3D client, a Lua scripting engine and Robis Studio — all running from a single Node.js server.' }),
    el('p', { text: 'Robis is a fan project and is not affiliated with, endorsed by, or connected to Roblox Corporation.' })),
  el('div', { class: 'panel' }, el('h2', { text: 'Controls' }),
    el('table', { class: 'list' }, rows.map(([keys, what]) => el('tr', {}, el('td', { style: { width: '40%' } }, keys.flatMap((k, i) => (i ? [' ', kbd(k)] : [kbd(k)]))), el('td', { text: what }))))),
  el('div', { class: 'panel', id: 'parents' }, el('h2', { text: 'For Parents' }),
    el('p', { text: 'Chat is filtered and there are no real-money purchases — Robits are imaginary: you earn them with the daily stipend, and only admins can give out more. Everything runs on the computer where the server is installed.' })),
  el('div', { class: 'panel', id: 'privacy' }, el('h2', { text: 'Privacy' }),
    el('p', { text: 'Accounts and games are stored in a local JSON database (the data/ folder). Nothing is sent to third parties.' })));
const style = document.createElement('style');
style.textContent = 'kbd { background: #fff; border: 1px solid #b8b8b8; border-bottom-width: 3px; border-radius: 4px; padding: 1px 7px; font-family: inherit; font-size: 14px; }';
document.head.append(style);
