import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, icon, iconSvg, fmtNum, fmtFull, fmtDate, qs, toast, launchGame, headshotImg, gameCard, spinner, joinFriendDialog, userLink, modal } from '../ui.js';
import { setRobits } from '../layout.js';
import { confetti } from '../fun.js';
import { gameThumbnail } from '../../render/thumbs.js';

const me = await initPage({ active: 'games', requireAuth: false });
const app = document.getElementById('app');
const id = +qs('id');
let game;
try { ({ game } = await api.get(`/games/${id}`)); } catch (e) {
  app.append(el('div', { class: 'panel empty', text: 'This game is unavailable.' }));
  throw e;
}
document.title = `${game.name} - Robis`;

const thumb = el('div', { class: 'game-hero-thumb' });
gameThumbnail(game, 512).then((u) => thumb.append(el('img', { src: u, alt: game.name })));

const voteBar = el('div', { class: 'vote-bar' }, el('div', { class: 'vote-fill' }));
const upBtn = el('button', { class: 'vote-btn', title: 'Like' }, icon('thumbup'), el('span'));
const downBtn = el('button', { class: 'vote-btn', title: 'Dislike' }, icon('thumbdown'), el('span'));
const favBtn = el('button', { class: 'vote-btn', title: 'Favorite' }, icon('star'), el('span'));
function renderVotes() {
  const total = game.upVotes + game.downVotes;
  voteBar.firstChild.style.width = total ? (game.upVotes / total) * 100 + '%' : '0%';
  upBtn.lastChild.textContent = fmtNum(game.upVotes);
  downBtn.lastChild.textContent = fmtNum(game.downVotes);
  favBtn.lastChild.textContent = fmtNum(game.favorites);
  upBtn.classList.toggle('on', game.myVote === 1);
  downBtn.classList.toggle('on', game.myVote === -1);
  favBtn.classList.toggle('on', game.isFavorite);
}
const needLogin = () => { if (!me) { location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search); return true; } return false; };
upBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/vote`, { vote: game.myVote === 1 ? 0 : 1 })); renderVotes(); };
downBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/vote`, { vote: game.myVote === -1 ? 0 : -1 })); renderVotes(); };
favBtn.onclick = async () => { if (needLogin()) return; ({ game } = await api.post(`/games/${id}/favorite`)); renderVotes(); };
renderVotes();

const playBtn = el('button', { class: 'btn btn-green play-btn', onclick: () => { if (!needLogin()) launchGame(id); } }, el('span', { html: iconSvg('play'), style: { width: '34px', height: '34px', display: 'inline-flex' } }));
// Robis Awards: trophies and nominations under the title
const awardsRow = el('div', { class: 'award-row' });
api.get(`/awards/game/${id}`).then(({ awards }) => {
  awardsRow.replaceChildren(...awards.map((a) => el('a', { class: 'award-chip' + (a.won ? ' won' : ''), href: '/awards', title: a.season },
    el('span', { text: a.won ? '🏆' : '🎖' }), el('span', { class: 'no-i18n', text: `${a.season} · ` }), el('span', { text: a.category }), a.won ? el('b', { text: ' · Winner' }) : el('span', { class: 'muted', text: a.status === 'voting' ? ' · Nominee (vote now!)' : ' · Nominee' }))));
}).catch(() => {});
const details = el('div', { class: 'game-details' },
  el('h1', { text: game.name }),
  el('div', { class: 'muted' }, 'By ', game.creator ? userLink(game.creator) : 'Unknown'),
  awardsRow,
  !game.isPublic ? el('div', { class: 'pill', style: { marginTop: '8px', background: '#ffe3e3' }, text: 'Private — only you can play this' }) : null,
  el('div', { class: 'spacer' }),
  playBtn,
  // Phone/PC app: host this game for friends (they join with the room code).
  window.ROBIS_STANDALONE && game.isPublic ? el('div', { class: 'row', style: { marginTop: '8px', gap: '8px' } },
    el('button', { class: 'btn btn-primary', style: { flex: 1 }, text: 'Play with friends', onclick: () => { if (!needLogin()) location.href = `/play?placeId=${id}&host=1`; } }),
    el('button', { class: 'btn', style: { flex: 1 }, text: 'Join a friend', onclick: () => { if (!needLogin()) joinFriendDialog(); } })) : null,
  el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'space-between' } }, favBtn, el('div', { class: 'row', style: { gap: '6px' } }, upBtn, downBtn)),
  voteBar,
  me && (me.perms || []).includes('games') ? el('button', { class: 'btn btn-small', style: { marginTop: '10px' }, text: game.featured ? 'Remove from Featured' : 'Feature this game', onclick: async (e) => {
    try { ({ game } = await api.post(`/games/${id}/feature`, { featured: !game.featured })); e.target.textContent = game.featured ? 'Remove from Featured' : 'Feature this game'; toast(game.featured ? 'Game featured!' : 'Removed from Featured', 'success'); } catch (err) { toast(err.message, 'error'); }
  } }) : null,
  game.canEdit ? el('div', { class: 'row', style: { marginTop: '12px' } },
    el('a', { class: 'btn btn-small', href: `/studio?gameId=${id}`, text: 'Edit in Studio' }),
    game.isOwner ? el('a', { class: 'btn btn-small', href: `/develop?configure=${id}`, text: 'Configure' }) : null) : null);

app.append(el('div', { class: 'panel game-top' }, thumb, details));

const tabs = el('div', { class: 'tabs', style: { marginTop: '20px' } });
const tabBody = el('div', { class: 'panel' });
app.append(tabs, tabBody);
const TABS = {
  About: () => el('div', {},
    el('h3', { text: 'Description' }),
    el('p', { style: { whiteSpace: 'pre-wrap' }, text: game.description || 'No description.' }),
    el('div', { class: 'stat-row' },
      ...[['Playing', fmtFull(game.playing)], ['Visits', fmtFull(game.visits)], ['Created', fmtDate(game.created)], ['Updated', fmtDate(game.updated)], ['Max Players', game.maxPlayers], ['Genre', game.genre]]
        .map(([l, v]) => el('div', {}, el('div', { class: 'label', text: l }), el('div', { class: 'value', text: v })))),
    el('h3', { style: { marginTop: '24px' }, text: 'Recommended Games' }),
    (() => { const row = el('div', { class: 'game-row' }, spinner()); api.get('/games?sort=popular').then((r) => row.replaceChildren(...r.games.filter((g) => g.id !== id).slice(0, 6).map(gameCard))); return row; })()),
  Store: () => storeTab(),
  Servers: () => {
    const box = el('div', {}, spinner());
    const priv = el('div', { class: 'private-box' });
    if (!window.ROBIS_STANDALONE) drawPrivate(priv);
    api.get(`/games/${id}/servers`).then(({ servers }) => {
      if (!servers.length) { box.replaceChildren(el('div', { class: 'empty', text: 'There are no running servers. Press Play to start one!' })); return; }
      box.replaceChildren(...servers.map((s) => el('div', { class: 'server-row' },
        el('div', { class: 'server-info' },
          el('b', { text: `${s.players.length} of ${s.maxPlayers} people max` }),
          el('div', { class: 'server-bar' }, el('div', { style: { width: (s.players.length / s.maxPlayers) * 100 + '%' } })),
          el('div', { class: 'small muted', text: 'Server ' + s.id.slice(0, 8) })),
        el('div', { class: 'server-players' }, s.players.map((p) => el('a', { href: `/profile?id=${p.userId}`, title: p.name, class: 'server-head' }, p.avatar ? headshotImg({ username: p.name, avatar: p.avatar }, 64) : null))),
        el('button', { class: 'btn btn-green', text: 'Join', disabled: s.players.length >= s.maxPlayers, onclick: () => { if (!needLogin()) launchGame(id, s.id); } }))));
    }).catch((e) => toast(e.message, 'error'));
    return el('div', {}, priv, el('h3', { text: 'Public servers' }), box);
  },
};

// ---------------------------------------------------------------- game passes
// Everyone sees the passes on sale; the game's owner also makes and edits them here.
let passMeta = null;
function storeTab() {
  const box = el('div', {}, spinner());
  const draw = async () => {
    const r = await api.get(`/games/${id}/passes`);
    passMeta = r;
    const cards = r.passes.map((p) => el('div', { class: 'pass-card' + (p.onSale ? '' : ' off') },
      el('div', { class: 'pass-icon', style: { background: p.color }, text: p.icon }),
      el('b', { class: 'pass-name', text: p.name }),
      el('div', { class: 'small muted pass-text', text: p.description || p.perkName }),
      p.perk !== 'none' ? el('div', { class: 'pill pass-perk', text: p.perkName }) : null,
      el('div', { class: 'pass-price' }, icon('robits', 'robits-icon'), el('span', { text: fmtFull(p.price) })),
      p.owned ? el('div', { class: 'pass-owned', text: '✓ Owned' })
        : el('button', { class: 'btn btn-green', text: 'Buy', disabled: !p.onSale, onclick: () => buyPass(p, draw) }),
      game.isOwner ? el('div', { class: 'small muted', text: `${fmtFull(p.sales)} sold${p.onSale ? '' : ' · off sale'}` }) : null,
      game.isOwner ? el('button', { class: 'btn btn-small', text: 'Edit', onclick: () => passEditor(p, draw) }) : null));
    box.replaceChildren(...[
      game.isOwner ? el('div', { class: 'row wrap', style: { marginBottom: '14px' } },
        el('button', { class: 'btn btn-primary', text: '+ Create a Game Pass', onclick: () => passEditor(null, draw) }),
        el('span', { class: 'small muted', text: 'You get 70% of every sale. Scripts can check passes with MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId).' })) : null,
      cards.length ? el('div', { class: 'pass-grid' }, cards) : el('div', { class: 'empty', text: 'This game has no game passes yet.' })].filter(Boolean));
  };
  draw().catch((e) => box.replaceChildren(el('div', { class: 'empty', text: e.message })));
  return box;
}
function buyPass(p, done) {
  if (needLogin()) return;
  modal({
    title: 'Buy Game Pass',
    body: el('div', { class: 'row', style: { gap: '14px' } },
      el('div', { class: 'pass-icon', style: { background: p.color }, text: p.icon }),
      el('div', {}, el('b', { text: p.name }), el('div', { class: 'small muted', text: p.description || p.perkName }),
        el('div', { class: 'pass-price' }, icon('robits', 'robits-icon'), el('span', { text: fmtFull(p.price) })))),
    buttons: [{ text: 'Buy Now', cls: 'btn-green', onClick: async () => {
      try {
        const r = await api.post(`/gamepasses/${p.id}/buy`);
        setRobits(r.robits);
        toast(`You bought ${p.name}!`, 'success');
        confetti();
        done();
      } catch (e) { toast(e.message, 'error'); return false; }
    } }, { text: 'Cancel' }],
  });
}
function passEditor(p, done) {
  const meta = passMeta || { perks: {}, icons: [] };
  const st = { name: p?.name || '', description: p?.description || '', price: p?.price || 100, icon: p?.icon || meta.icons[0] || '⭐', color: p?.color || '#00a2ff', perk: p?.perk || 'none', onSale: p ? p.onSale : true };
  const preview = el('div', { class: 'pass-icon big' });
  const upd = () => { preview.style.background = st.color; preview.textContent = st.icon; };
  upd();
  const icons = el('div', { class: 'pass-icons' }, meta.icons.map((ic) => {
    const b = el('button', { class: 'pass-icon-pick' + (ic === st.icon ? ' on' : ''), text: ic, onclick: () => { st.icon = ic; icons.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); upd(); } });
    return b;
  }));
  const input = (k, attrs) => { const i = el(attrs.tag || 'input', { class: 'input', value: st[k], ...attrs }); i.addEventListener('input', () => { st[k] = attrs.type === 'number' ? +i.value : i.value; }); return i; };
  const color = el('input', { type: 'color', value: st.color, oninput: (e) => { st.color = e.target.value; upd(); } });
  const perk = el('select', { class: 'input', onchange: (e) => { st.perk = e.target.value; } }, Object.entries(meta.perks).map(([k, v]) => el('option', { value: k, text: v, selected: k === st.perk })));
  const sale = el('input', { type: 'checkbox', checked: st.onSale, onchange: (e) => { st.onSale = e.target.checked; } });
  modal({
    title: p ? 'Edit Game Pass' : 'Create a Game Pass',
    width: 560,
    body: el('div', {},
      el('div', { class: 'row', style: { gap: '14px', alignItems: 'flex-start' } }, preview,
        el('div', { style: { flex: 1 } }, el('label', { class: 'field' }, 'Name', input('name', { maxlength: 50, placeholder: 'VIP' })),
          el('label', { class: 'field' }, 'Price (R$)', input('price', { type: 'number', min: 1, max: 100000 })))),
      el('label', { class: 'field' }, 'Description', input('description', { tag: 'textarea', rows: 2, maxlength: 500, placeholder: 'What does it give?' })),
      el('div', { class: 'field' }, el('b', { text: 'Icon' }), icons),
      el('label', { class: 'field' }, 'Colour', color),
      el('label', { class: 'field' }, 'Built-in perk (works without scripts)', perk),
      el('label', { class: 'perm-row' }, sale, el('span', { text: 'On sale' })),
      p ? el('div', { class: 'small muted', text: `Pass ID for scripts: ${p.id}` }) : null),
    buttons: [
      { text: p ? 'Save' : 'Create', cls: 'btn-primary', onClick: async () => {
        try {
          const r = p ? await api.post(`/gamepasses/${p.id}`, st) : await api.post(`/games/${id}/passes`, st);
          toast(p ? 'Saved' : `Game pass created (ID ${r.pass.id})`, 'success');
          done();
        } catch (e) { toast(e.message, 'error'); return false; }
      } },
      p && !p.sales ? { text: 'Delete', cls: 'btn-red', onClick: async () => { try { await api.post(`/gamepasses/${p.id}`, { delete: true }); done(); } catch (e) { toast(e.message, 'error'); return false; } } } : null,
      { text: 'Cancel' },
    ].filter(Boolean),
  });
}

// ---------------------------------------------------------------- private servers
async function drawPrivate(box) {
  if (!me) { box.replaceChildren(); return; }
  let r;
  try { r = await api.get(`/games/${id}/private`); } catch { return; }
  const parts = [el('h3', { text: 'Private Servers' })];
  if (r.isOwner) {
    const on = el('input', { type: 'checkbox', checked: r.enabled });
    const price = el('input', { class: 'input', type: 'number', min: 0, max: 100000, value: r.price, style: { width: '120px' } });
    parts.push(el('div', { class: 'private-settings' },
      el('label', { class: 'perm-row' }, on, el('span', { text: 'Let players buy private servers' })),
      el('label', { class: 'row', style: { gap: '8px' } }, el('span', { text: 'Price (R$ for 30 days, 0 = free)' }), price),
      el('button', { class: 'btn btn-small btn-primary', text: 'Save', onclick: async () => {
        try { await api.post(`/games/${id}/private/settings`, { enabled: on.checked, price: +price.value }); toast('Saved', 'success'); drawPrivate(box); } catch (e) { toast(e.message, 'error'); }
      } })));
  }
  if (r.enabled || r.isOwner) {
    const cost = r.isOwner ? 0 : r.price;
    parts.push(el('div', { class: 'row wrap', style: { gap: '10px', margin: '8px 0 12px' } },
      el('span', { class: 'muted', text: r.isOwner ? 'Your game: private servers are free for you.' : cost ? `Play with only the people you invite. R$ ${fmtFull(cost)} for ${r.days} days.` : 'Play with only the people you invite. Free!' }),
      el('button', { class: 'btn btn-green', text: cost ? `Create (R$ ${fmtFull(cost)})` : 'Create Private Server', onclick: async () => {
        try { const x = await api.post(`/games/${id}/private/buy`); if (x.robits !== undefined) setRobits(x.robits); toast('Private server created!', 'success'); drawPrivate(box); } catch (e) { toast(e.message, 'error'); }
      } })));
  } else parts.push(el('div', { class: 'muted small', style: { marginBottom: '12px' }, text: 'This game has no private servers.' }));
  for (const ps of r.servers) parts.push(privateRow(ps, () => drawPrivate(box)));
  box.replaceChildren(...parts);
}
function privateRow(ps, redraw) {
  const until = ps.until ? (ps.active ? `until ${new Date(ps.until).toLocaleDateString()}` : 'expired') : 'never expires';
  return el('div', { class: 'server-row private-row' + (ps.active ? '' : ' expired') },
    el('div', { class: 'server-info' },
      el('b', { class: 'no-i18n', text: ps.name }),
      el('div', { class: 'small muted' }, ps.isOwner ? 'Yours · ' : 'By ', ps.isOwner ? null : el('span', { class: 'no-i18n', text: ps.ownerName + ' · ' }), el('span', { text: until })),
      ps.playing ? el('div', { class: 'small online-text', text: `${ps.playing} playing` }) : null),
    el('div', { class: 'server-players' }),
    ps.isOwner ? el('button', { class: 'btn', text: 'Manage', onclick: () => managePrivate(ps, redraw) }) : null,
    el('button', { class: 'btn btn-green', text: 'Join', disabled: !ps.active, onclick: () => { if (!needLogin()) launchGame(id, null, ps.id); } }));
}
function managePrivate(ps, redraw) {
  const body = el('div');
  let cur = ps;
  const post = async (data, msg) => {
    try { const r = await api.post(`/private/${cur.id}`, data); if (r.robits !== undefined) setRobits(r.robits); if (r.server) { cur = r.server; draw(); } if (msg) toast(msg, 'success'); redraw(); } catch (e) { toast(e.message, 'error'); }
  };
  const draw = () => {
    const link = `${location.origin}${location.pathname}?id=${id}&privateCode=${cur.code}`;
    const name = el('input', { class: 'input', value: cur.name, maxlength: 40 });
    const who = el('input', { class: 'input', placeholder: 'Player name' });
    body.replaceChildren(
      el('label', { class: 'field' }, 'Name', el('div', { class: 'row' }, name, el('button', { class: 'btn btn-small', text: 'Rename', onclick: () => post({ name: name.value }, 'Renamed') }))),
      el('div', { class: 'field' }, el('b', { text: 'Invite link' }),
        el('div', { class: 'row' }, el('input', { class: 'input no-i18n', value: link, readonly: true }),
          el('button', { class: 'btn btn-small', text: 'Copy', onclick: () => navigator.clipboard?.writeText(link).then(() => toast('Copied', 'success')).catch(() => {}) }),
          el('button', { class: 'btn btn-small', text: 'New link', title: 'The old link stops working', onclick: () => post({ newCode: true }, 'New link made') }))),
      el('label', { class: 'perm-row', style: { margin: '6px 0 10px' } }, el('input', { type: 'checkbox', checked: cur.friends, onchange: (e) => post({ friends: e.target.checked }) }), el('span', { text: 'My friends can join without an invite' })),
      el('div', { class: 'field' }, el('b', { text: `Invited players (${cur.members.length})` }),
        el('div', { class: 'row' }, who, el('button', { class: 'btn btn-small btn-primary', text: 'Invite', onclick: () => post({ add: who.value }, 'Invited') })),
        el('div', { class: 'promo-chosen' }, cur.members.map((m) => el('span', { class: 'holder-chip' }, el('span', { class: 'no-i18n', text: m.username }),
          el('button', { title: 'Remove', text: '×', onclick: () => post({ remove: m.id }) }))))),
      el('div', { class: 'small muted', text: cur.until ? `Expires ${new Date(cur.until).toLocaleDateString()}` : 'Never expires' }),
      el('div', { class: 'row', style: { marginTop: '12px' } },
        cur.until ? el('button', { class: 'btn btn-green', text: 'Renew 30 days', onclick: () => post({ renew: true }, 'Renewed') }) : null,
        el('button', { class: 'btn btn-red', text: 'Delete server', onclick: async () => { if (!confirm('Delete this private server?')) return; await post({ delete: true }, 'Deleted'); m.close(); } })));
  };
  draw();
  const m = modal({ title: 'Private server', width: 560, body });
}

// Invite link: /game?id=1&privateCode=ABC → you're added, then you can join.
if (qs('privateCode') && me) {
  api.post('/private/join', { code: qs('privateCode') }).then(({ server }) => {
    history.replaceState(null, '', `?id=${id}`);
    modal({
      title: 'Private server invite',
      body: el('p', { text: `You were invited to "${server.name}" by ${server.ownerName}.` }),
      buttons: [{ text: 'Join now', cls: 'btn-green', onClick: () => launchGame(id, null, server.id) }, { text: 'Later' }],
    });
  }).catch((e) => toast(e.message, 'error'));
}
for (const name of Object.keys(TABS)) {
  const b = el('button', { text: name, onclick: () => { [...tabs.children].forEach((x) => x.classList.toggle('active', x === b)); tabBody.replaceChildren(TABS[name]()); } });
  tabs.append(b);
}
tabs.firstChild.click();

const style = document.createElement('style');
style.textContent = `
.game-top { display: flex; gap: 24px; }
.game-hero-thumb { flex: 0 0 55%; aspect-ratio: 16 / 10; background: #d4d4d4; border-radius: 3px; overflow: hidden; }
.game-hero-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.game-details { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.game-details h1 { font-size: 30px; word-break: break-word; }
.play-btn { width: 100%; padding: 14px; margin-top: 16px; }
.play-btn svg { width: 34px; height: 34px; }
.vote-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; cursor: pointer; color: var(--text-light); font-weight: 600; padding: 4px; }
.vote-btn.on { color: var(--blue); }
.vote-bar { height: 4px; background: #b8b8b8; border-radius: 2px; margin-top: 6px; overflow: hidden; }
.vote-fill { height: 100%; background: var(--text); }
.server-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.server-info { width: 200px; }
.server-bar { height: 6px; background: #e3e3e3; border-radius: 3px; margin: 6px 0; overflow: hidden; }
.server-bar div { height: 100%; background: var(--green); }
.server-players { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; }
.server-head { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #d4d4d4; }
.server-head img { width: 100%; height: 100%; }
.pass-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.pass-card { border: 1px solid var(--border); border-radius: 6px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.pass-card.off { opacity: .6; }
.pass-card .btn { width: 100%; }
.pass-name { font-size: 16px; word-break: break-word; }
.pass-text { min-height: 18px; }
.pass-perk { background: #e6f6ff; color: #0074bd; }
.pass-icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; flex: none; box-shadow: inset 0 0 0 4px rgba(255,255,255,.4), 0 1px 3px rgba(0,0,0,.25); }
.pass-icon.big { width: 96px; height: 96px; font-size: 48px; }
.pass-price { display: flex; align-items: center; gap: 4px; font-weight: 700; color: #02b757; font-size: 18px; }
.pass-price .robits-icon { width: 20px; height: 20px; }
.pass-owned { color: #02b757; font-weight: 700; padding: 6px; }
.pass-icons { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.pass-icon-pick { width: 38px; height: 38px; font-size: 20px; border: 1px solid var(--border); border-radius: 6px; background: transparent; cursor: pointer; }
.pass-icon-pick.on { border-color: var(--blue); background: rgba(0,162,255,.15); }
.private-box:not(:empty) { margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.private-settings { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 10px; border: 1px dashed var(--border); border-radius: 6px; margin-bottom: 8px; }
.private-row.expired { opacity: .6; }
@media (max-width: 800px) { .game-top { flex-direction: column; } .game-hero-thumb { flex: none; } .server-row { flex-wrap: wrap; } }
`;
document.head.append(style);
