// Game invites from friends: a popup with a Join button, on every site page
// and inside games. Checked when the page opens and every 15 seconds.
import { api } from './api.js';

const shown = new Set();
const box = document.createElement('div');
box.className = 'invite-stack';

const css = document.createElement('style');
css.textContent = `
.invite-stack { position: fixed; right: 12px; bottom: 72px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; max-width: min(340px, calc(100vw - 24px)); font-family: 'Source Sans Pro', 'Segoe UI', Arial, sans-serif; }
.invite-card { background: #fff; color: #393b3d; border-radius: 6px; box-shadow: 0 4px 18px rgba(0,0,0,.35); padding: 10px 12px; display: flex; gap: 10px; align-items: center; animation: invite-pop .2s ease-out; }
html[data-theme="dark"] .invite-card { background: #393b3d; color: #fff; }
.invite-card img { width: 44px; height: 44px; border-radius: 50%; background: #d4d4d4; flex: none; }
.invite-card .txt { flex: 1; font-size: 14px; line-height: 1.25; }
.invite-card .btns { display: flex; flex-direction: column; gap: 4px; }
.invite-card button { border: 0; border-radius: 4px; padding: 4px 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
.invite-card .join { background: #02b757; color: #fff; }
.invite-card .no { background: transparent; color: inherit; opacity: .7; }
@keyframes invite-pop { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
`;

function card(inv) {
  const c = document.createElement('div');
  c.className = 'invite-card';
  const img = document.createElement('img');
  img.alt = '';
  import('../render/thumbs.js').then(({ avatarHeadshot }) => avatarHeadshot(inv.from.avatar, 88)).then((u) => { img.src = u; }).catch(() => {});
  const txt = document.createElement('div');
  txt.className = 'txt';
  const t = document.createElement('span');
  t.textContent = `${inv.from.username} invited you to play ${inv.game.name}`;
  txt.append(t);
  const btns = document.createElement('div');
  btns.className = 'btns';
  const join = document.createElement('button');
  join.className = 'join';
  join.textContent = 'Join';
  join.onclick = () => {
    api.post(`/invites/${inv.id}/dismiss`).catch(() => {}).finally(() => {
      location.href = `/play?placeId=${inv.game.id}${inv.serverId ? '&serverId=' + encodeURIComponent(inv.serverId) : ''}`;
    });
  };
  const no = document.createElement('button');
  no.className = 'no';
  no.textContent = 'Ignore';
  no.onclick = () => { c.remove(); api.post(`/invites/${inv.id}/dismiss`).catch(() => {}); };
  btns.append(join, no);
  c.append(img, txt, btns);
  return c;
}

async function check() {
  try {
    const { invites } = await api.get('/invites');
    for (const inv of invites) {
      if (shown.has(inv.id)) continue;
      shown.add(inv.id);
      box.append(card(inv));
    }
  } catch { /* logged out or offline */ }
}

export function startInvites() {
  if (!box.isConnected) { document.head.append(css); document.body.append(box); }
  check();
  setInterval(check, 15000);
}

// Sends an invite for the game this player is in.
export function sendInvite(toUserId, gameId, serverId) {
  return api.post('/invites', { toUserId, gameId, serverId });
}
