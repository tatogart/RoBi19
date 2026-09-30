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
    choice('Theme', theme, [['light', 'Light'], ['dark', 'Dark']], (t) => { setTheme(t); drawAppearance(t); }),
    choice('Language', LANG, [['en', 'English'], ['ru', 'Русский']], (l) => { if (l !== LANG) setLang(l); }));
};
drawAppearance(THEME);
app.append(appearance);

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

const style = document.createElement('style');
style.textContent = `
.settings-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; flex-wrap: wrap; }
.settings-label { width: 120px; color: var(--text-light); }
.seg { display: flex; gap: 6px; }
.panel h4 { margin: 16px 0 6px; }
.panel .row .input { flex: 1; min-width: 160px; }
`;
document.head.append(style);
