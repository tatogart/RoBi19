import { initPage, setRobits } from '../layout.js';
import { api, getMe } from '../api.js';
import { el, toast } from '../ui.js';
import { LANG, THEME, setLang, setTheme } from '../../i18n.js';

let me = await initPage({ active: 'settings' });
const app = document.getElementById('app');
app.append(el('h1', { text: 'Account Settings' }));

// ---------------------------------------------------------------- appearance
const choice = (label, current, options, onPick) => el('div', { class: 'settings-row' },
  el('div', { class: 'settings-label', text: label }),
  el('div', { class: 'seg' }, options.map(([value, text]) => el('button', {
    class: 'btn btn-small' + (value === current ? ' btn-primary' : ''), text, onclick: () => onPick(value),
  }))));
const appearance = el('div', { class: 'panel' }, el('h3', { text: 'Appearance' }));
const drawAppearance = (theme) => {
  appearance.replaceChildren(el('h3', { text: 'Appearance' }),
    choice('Theme', theme, [['light', 'Light'], ['dark', 'Dark'], ['halloween', '🎃 Halloween']], (t) => { setTheme(t); drawAppearance(t); }),
    choice('Language', LANG, [['en', 'English'], ['ru', 'Русский']], (l) => { if (l !== LANG) setLang(l); }));
};
drawAppearance(THEME);
app.append(appearance);

// ---------------------------------------------------------------- Discord
// "Playing Robis" in your Discord profile: a small helper app for Windows
// shows what you play (see server/discordstatus.js).
const discordPanel = el('div', { class: 'panel discord-panel' });
app.append(discordPanel);
(async () => {
  let st;
  try { st = await api.get('/me/discord-status'); } catch { discordPanel.remove(); return; }
  if (!st.enabled) { discordPanel.remove(); return; }
  const isWindows = /Windows/i.test(navigator.userAgent);
  discordPanel.replaceChildren(
    el('h3', {}, el('span', { class: 'discord-logo', html: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M16.9 8.2a11 11 0 00-2.7-.8l-.3.6a10 10 0 00-3.8 0l-.3-.6a11 11 0 00-2.7.8C5.4 10.8 5 13.3 5.2 15.8a11 11 0 003.3 1.7l.7-1.1-1.1-.5.3-.2a7.8 7.8 0 006.8 0l.3.2-1.1.5.7 1.1a11 11 0 003.3-1.7c.3-2.9-.4-5.4-1.5-7.6zM9.8 14.3c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3zm4.4 0c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3z"/></svg>' }), el('span', { text: 'Discord status' })),
    el('p', { text: 'Show what you play on Robis in your Discord profile, like "Playing DOORS". Your friends can press a button there to play the same game.' }),
    el('div', { class: 'discord-preview' },
      el('div', { class: 'discord-preview-title', text: 'PLAYING A GAME' }),
      el('div', { class: 'discord-preview-body' },
        el('img', { src: '/img/icon-192.png', alt: '', onerror: (e) => { e.target.style.visibility = 'hidden'; } }),
        el('div', {}, el('b', { text: 'Robis' }), el('div', { class: 'small', text: st.now.clear ? 'Playing DOORS' : st.now.details }), el('div', { class: 'small', text: st.now.clear ? 'With 3 other players' : st.now.state || '' })))),
    el('ol', { class: 'discord-how' },
      el('li', { text: 'Download the Robis Discord status app (a small file for Windows, nothing to install).' }),
      el('li', { text: 'Open it once (if Windows asks, press More info -> Run anyway). That\'s it: it works in the background with no window and starts with Windows by itself.' }),
      el('li', { text: 'Make sure the Discord app is open and Settings -> Activity Privacy -> "Share your activity" is on.' }),
      el('li', { text: 'Play on Robis - your Discord profile shows the game! To turn it off, open the file again.' })),
    el('div', { class: 'row wrap', style: { gap: '8px' } },
      el('a', { class: 'btn btn-primary discord-btn', href: '/api/me/discord-status/RobisDiscordStatus.bat', download: 'RobisDiscordStatus.bat', text: 'Download for Windows' }),
      el('button', { class: 'btn btn-small', text: 'Make a new file (stops the old one)', onclick: async () => {
        if (!confirm('Make a new file? The old file stops working - download the new one after this.')) return;
        await api.post('/me/discord-status/reset');
        toast('Done! Download the new file.', 'success');
      } })),
    isWindows ? null : el('p', { class: 'small muted', text: 'The app works on Windows. On other computers the status is not available yet.' }),
    el('p', { class: 'small muted', text: 'The file is made just for you - don\'t share it: it shows your status in Discord.' }));
})();

// ---------------------------------------------------------------- username
const nameInput = el('input', { class: 'input', placeholder: 'New username', autocomplete: 'off' });
const namePass = el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
const current = el('b', { class: 'no-i18n', text: me.username });
const price = me.isAdmin ? 'Free for admins' : 'R$1,000';
app.append(el('div', { class: 'panel' },
  el('h3', { text: 'Account Info' }),
  el('div', { class: 'settings-row' }, el('div', { class: 'settings-label', text: 'Username' }), current),
  el('h4', { text: 'Change Username' }),
  el('p', { class: 'small muted', text: `Changing your username costs ${price}. Your old username is shown on your profile.` }),
  el('div', { class: 'row wrap' }, nameInput, namePass,
    el('button', { class: 'btn btn-green', text: 'Change', onclick: async () => {
      try {
        const r = await api.post('/account/username', { username: nameInput.value.trim(), password: namePass.value });
        me = r.user; await getMe(true);
        current.textContent = me.username;
        setRobits(me.robits);
        nameInput.value = namePass.value = '';
        toast('Username changed!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    } }))));

// ---------------------------------------------------------------- trading
const tradePanel = el('div', { class: 'panel', id: 'trading' });
const drawTrading = (v) => tradePanel.replaceChildren(el('h3', { text: 'Trading' }),
  choice('Who can trade with me?', v, [['everyone', 'Everyone'], ['friends', 'Friends'], ['nobody', 'No one']], async (p) => {
    try { me = (await api.post('/account/trade-privacy', { privacy: p })).user; drawTrading(me.tradePrivacy); toast('Saved', 'success'); } catch (e) { toast(e.message, 'error'); }
  }));
drawTrading(me.tradePrivacy || 'everyone');
app.append(tradePanel);

// ---------------------------------------------------------------- password
const oldPass = el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
const newPass = el('input', { class: 'input', type: 'password', placeholder: 'New password', autocomplete: 'new-password' });
app.append(el('div', { class: 'panel' },
  el('h3', { text: 'Security' }),
  el('h4', { text: 'Change Password' }),
  el('div', { class: 'row wrap' }, oldPass, newPass,
    el('button', { class: 'btn btn-primary', text: 'Change', onclick: async () => {
      try {
        await api.post('/account/password', { password: oldPass.value, newPassword: newPass.value });
        oldPass.value = newPass.value = '';
        toast('Password changed!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    } }))));

// ---------------------------------------------------------------- delete account
const delPass = el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
app.append(el('div', { class: 'panel' },
  el('h3', { text: 'Delete Account' }),
  el('p', { class: 'small muted', text: 'Your account, games, items, friends and messages are deleted for good. This can\'t be undone.' }),
  el('div', { class: 'row wrap' }, delPass,
    el('button', { class: 'btn btn-red', text: 'Delete my account', onclick: async () => {
      if (!confirm('Delete your account forever?')) return;
      try {
        await api.post('/account/delete', { password: delPass.value });
        location.href = '/';
      } catch (e) { toast(e.message, 'error'); }
    } }))));

const style = document.createElement('style');
style.textContent = `
.settings-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; flex-wrap: wrap; }
.settings-label { width: 120px; color: var(--text-light); }
.seg { display: flex; gap: 6px; }
.panel h4 { margin: 16px 0 6px; }
.discord-panel h3 { display: flex; align-items: center; gap: 8px; }
.discord-logo { width: 28px; height: 28px; border-radius: 8px; background: #5865f2; display: inline-flex; padding: 4px; }
.discord-logo svg { width: 100%; height: 100%; }
.discord-preview { background: #232428; color: #dbdee1; border-radius: 8px; padding: 10px 12px; max-width: 340px; margin: 10px 0; }
.discord-preview-title { font-size: 11px; font-weight: 800; letter-spacing: .5px; color: #b5bac1; margin-bottom: 8px; }
.discord-preview-body { display: flex; gap: 10px; align-items: center; }
.discord-preview-body img { width: 56px; height: 56px; border-radius: 8px; background: #1e1f22; object-fit: contain; }
.discord-preview-body b { color: #fff; }
.discord-how { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.discord-btn { background: #5865f2; border-color: #5865f2; }
.panel .row .input { flex: 1; min-width: 160px; }
`;
document.head.append(style);
