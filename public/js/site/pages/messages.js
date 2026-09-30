import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, qs, headshotImg, spinner, toast, timeAgo, modal } from '../ui.js';

await initPage({ active: 'messages' });
const app = document.getElementById('app');
app.append(el('div', { class: 'section-header' }, el('h1', { style: { margin: 0 }, text: 'Messages' }), el('button', { class: 'btn btn-primary', text: 'Compose', onclick: () => compose() })));
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel' });
app.append(tabs, body);

function compose(to = '', subject = '') {
  const toI = el('input', { class: 'input', value: to, placeholder: 'Username' });
  const subI = el('input', { class: 'input', value: subject, maxlength: 100 });
  const bodyI = el('textarea', { class: 'input', rows: 7, maxlength: 5000 });
  modal({
    title: 'New Message', width: 520,
    body: el('div', {}, el('label', { class: 'field' }, 'To', toI), el('label', { class: 'field' }, 'Subject', subI), el('label', { class: 'field' }, 'Message', bodyI)),
    buttons: [{ text: 'Send', cls: 'btn-primary', onClick: async () => {
      try { await api.post('/messages', { to: toI.value.trim(), subject: subI.value, body: bodyI.value }); toast('Message sent!', 'success'); } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}

async function box(name) {
  body.replaceChildren(spinner());
  const { messages } = await api.get(`/messages?box=${name}`);
  if (!messages.length) { body.replaceChildren(el('div', { class: 'empty', text: 'No messages.' })); return; }
  body.replaceChildren(...messages.map((m) => {
    const other = name === 'sent' ? m.toUser : m.fromUser;
    const row = el('div', { class: 'msg-row' + (!m.read && name === 'inbox' ? ' unread' : '') },
      el('div', { class: 'msg-head' }, other ? headshotImg(other, 96) : null),
      el('div', { class: 'spacer', style: { minWidth: 0 } },
        el('div', { class: 'row' }, el('b', { text: other ? other.username : 'Unknown' }), el('span', { class: 'small muted', text: timeAgo(m.created) })),
        el('div', { text: m.subject }),
        el('div', { class: 'small muted msg-preview', text: m.body })));
    row.onclick = async () => {
      if (!m.read && name === 'inbox') { api.post(`/messages/${m.id}/read`); row.classList.remove('unread'); m.read = true; }
      modal({
        title: m.subject, width: 560,
        body: el('div', {}, el('div', { class: 'small muted', style: { marginBottom: '10px' }, text: `${name === 'sent' ? 'To' : 'From'} ${other?.username} · ${new Date(m.created).toLocaleString()}` }), el('p', { style: { whiteSpace: 'pre-wrap' }, text: m.body })),
        buttons: name === 'inbox' ? [{ text: 'Reply', cls: 'btn-primary', onClick: () => compose(other?.username, 'RE: ' + m.subject) }, { text: 'Close' }] : [{ text: 'Close' }],
      });
    };
    return row;
  }));
}
for (const [n, label] of [['inbox', 'Inbox'], ['sent', 'Sent']]) {
  const b = el('button', { text: label, onclick: () => { [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); box(n); } });
  tabs.append(b);
}
tabs.firstChild.click();
if (qs('to')) compose(qs('to'));
const style = document.createElement('style');
style.textContent = `.msg-row { display: flex; gap: 12px; align-items: center; padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer; }
.msg-row:hover { background: var(--gray-bg); } .msg-row.unread { background: #eaf6ff; font-weight: 600; }
.msg-head { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: #d4d4d4; flex: none; } .msg-head img { width: 100%; height: 100%; }
.msg-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;
document.head.append(style);
