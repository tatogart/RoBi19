// A banned player: why, and the appeal form (pick the ban, a reason, explain,
// add a screenshot or a video). The Robis team answers in the Admin Panel.
import { api } from './api.js';
import { el, modal, toast, fmtDate } from './ui.js';
import { tr } from '../i18n.js';

export function bannedDialog(message, key, reply = false) {
  modal({
    title: tr('Your account is banned'),
    body: el('div', { class: 'banned-box' },
      el('div', { class: 'warning-icon', text: '!' }),
      el('p', { class: 'no-i18n', text: message }),
      reply ? el('p', { class: 'appeal-new-reply', text: tr('💬 The Robis team wrote to you about your appeal!') }) : null,
      el('p', { class: 'small muted', text: tr('Think it was a mistake? Send an appeal: the Robis team reads every one.') })),
    buttons: [reply ? { text: tr('Open the chat'), cls: 'btn-green', onClick: () => { openChat(key); } } : { text: tr('Appeal this ban'), cls: 'btn-primary', onClick: () => { appealDialog(key); } }, { text: tr('Close') }],
  });
}

// The chat about an open appeal: the Robis team asks for details or proof,
// the player answers (text, a screenshot or a video).
async function openChat(key) {
  let info;
  try { info = await api.get('/appeals/info?key=' + encodeURIComponent(key)); } catch (e) { toast(e.message, 'error'); return; }
  const a = info.appeals.find((x) => x.status === 'open');
  if (a) appealChat(key, a); else appealDialog(key);
}
export function appealChat(key, a) {
  const log = el('div', { class: 'appeal-chat' });
  const draw = () => {
    log.replaceChildren(
      el('div', { class: 'appeal-msg player first' }, el('div', { class: 'small muted', text: `${tr('Your appeal')} · ${fmtDate(a.created)}` }), el('div', { class: 'no-i18n', text: a.explanation })),
      ...a.chat.map((m) => el('div', { class: 'appeal-msg ' + m.from },
        el('div', { class: 'small muted' }, el('b', { class: 'no-i18n', text: m.from === 'staff' ? tr('Robis team') : m.name }), ' · ' + fmtDate(m.time)),
        m.text ? el('div', { class: 'no-i18n', text: m.text }) : null,
        m.media ? (m.mediaType.startsWith('video') ? el('video', { src: `/api/appeals/${a.id}/chat/${m.n}/media?key=${key}`, controls: true, class: 'appeal-media' }) : el('img', { src: `/api/appeals/${a.id}/chat/${m.n}/media?key=${key}`, class: 'appeal-media', alt: '' })) : null)));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  };
  draw();
  const text = el('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: tr('Answer the Robis team. Add a screenshot or a video as proof if you have one.') });
  let media = '';
  const preview = el('div', { class: 'appeal-preview' });
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime', style: { display: 'none' } });
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    if (f.size > MAX) { toast(tr('The file is too big (9 MB at most).'), 'error'); file.value = ''; return; }
    const r = new FileReader();
    r.onload = () => { media = r.result; preview.replaceChildren(el('span', { class: 'small', text: '📎 ' + f.name }), el('button', { type: 'button', class: 'btn btn-small', text: tr('Remove'), onclick: () => { media = ''; file.value = ''; preview.replaceChildren(); } })); };
    r.readAsDataURL(f);
  });
  const canWrite = a.chat.length > 0;
  modal({
    title: `${tr('Appeal')} #${a.id} · ${tr('Chat with the Robis team')}`,
    width: 600,
    body: el('div', { class: 'appeal-form' }, log,
      canWrite ? el('div', {}, text, el('div', { class: 'row', style: { marginTop: '6px' } }, el('button', { type: 'button', class: 'btn btn-small', text: tr('📎 Add a screenshot or a video'), onclick: () => file.click() }), file, preview))
        : el('p', { class: 'small muted', text: tr('The Robis team hasn\'t written yet. You can answer here once they do.') })),
    buttons: [canWrite ? { text: tr('Send'), cls: 'btn-green', onClick: async () => {
      try {
        const r = await api.post(`/appeals/${a.id}/chat`, { key, text: text.value, media });
        a = r.appeal; text.value = ''; media = ''; file.value = ''; preview.replaceChildren(); draw();
        toast(tr('Sent! The Robis team will answer here.'), 'success');
      } catch (e) { toast(e.message, 'error'); }
      return false;
    } } : null, { text: tr('Close') }].filter(Boolean),
  });
}

const MAX = 9 * 1024 * 1024;
export async function appealDialog(key) {
  let info;
  try { info = await api.get('/appeals/info?key=' + encodeURIComponent(key)); } catch (e) { toast(e.message, 'error'); return; }
  let banId = info.bans[0]?.id ?? 0;
  const bans = el('div', { class: 'appeal-bans' });
  const drawBans = () => bans.replaceChildren(...info.bans.map((b) => el('button', { type: 'button', class: 'appeal-ban' + (b.id === banId ? ' on' : ''), onclick: () => { banId = b.id; drawBans(); } },
    el('b', { class: 'no-i18n', text: b.reason }),
    el('span', { class: 'small muted' }, b.time ? fmtDate(b.time) : '', b.until ? ` · ${tr('until')} ${fmtDate(b.until)}` : ` · ${tr('forever')}`, b.active ? el('span', { class: 'appeal-active', text: ' · ' + tr('active') }) : null))));
  drawBans();
  const reason = el('select', { class: 'input' }, info.reasons.map((r) => el('option', { value: r, text: tr(r) })));
  const text = el('textarea', { class: 'input', rows: 5, maxlength: 2000, placeholder: tr('Explain what happened, in your own words (20 letters or more).') });
  const count = el('span', { class: 'small muted', text: '0 / 2000' });
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 2000`; });
  let media = '';
  const preview = el('div', { class: 'appeal-preview' });
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime', style: { display: 'none' } });
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    if (f.size > MAX) { toast(tr('The file is too big (9 MB at most).'), 'error'); file.value = ''; return; }
    const r = new FileReader();
    r.onload = () => {
      media = r.result;
      preview.replaceChildren(f.type.startsWith('video/') ? el('video', { src: media, controls: true }) : el('img', { src: media, alt: '' }),
        el('button', { type: 'button', class: 'btn btn-small', text: tr('Remove'), onclick: () => { media = ''; file.value = ''; preview.replaceChildren(); } }));
    };
    r.readAsDataURL(f);
  });
  const old = info.appeals.length ? el('div', { class: 'appeal-old' }, el('b', { text: tr('Your appeals') }), info.appeals.map((a) => el('div', { class: 'appeal-row ' + a.status },
    el('span', { class: 'appeal-status', text: tr({ open: 'Waiting for an answer', accepted: 'Accepted', denied: 'Denied' }[a.status]) }),
    el('span', { class: 'small muted', text: fmtDate(a.created) }),
    a.outcome ? el('div', { class: 'small', text: tr(a.outcome) }) : null,
    a.answer ? el('div', { class: 'small no-i18n', text: '“' + a.answer + '”' }) : null,
    a.status === 'open' && a.chat.length ? el('button', { type: 'button', class: 'btn btn-small' + (a.waiting === 'player' ? ' btn-green' : ''), text: (a.waiting === 'player' ? tr('💬 New message - answer') : tr('💬 Open the chat')) + ` (${a.chat.length})`, onclick: () => appealChat(key, a) }) : null))) : null;
  modal({
    title: `${tr('Appeal')} · ${info.username}`,
    width: 600,
    body: el('div', { class: 'appeal-form' }, old,
      el('div', { class: 'qe-step', text: tr('1. Which ban?') }), bans,
      el('div', { class: 'qe-step', text: tr('2. Why should it be removed?') }), reason,
      el('div', { class: 'qe-step', text: tr('3. What happened?') }), text, count,
      el('div', { class: 'qe-step', text: tr('4. Proof (optional): a screenshot or a video') }),
      el('button', { type: 'button', class: 'btn', text: tr('📎 Add a screenshot or a video'), onclick: () => file.click() }), file, preview),
    buttons: [{ text: tr('Send the appeal'), cls: 'btn-green', onClick: async () => {
      try {
        await api.post('/appeals', { key, banId, reason: reason.value, explanation: text.value, media });
        toast(tr('Appeal sent! The Robis team will answer soon - log in again later to see the answer.'), 'success');
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: tr('Cancel') }],
  });
}
