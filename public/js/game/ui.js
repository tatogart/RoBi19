// In-game HUD: chat, leaderboard, health, hints, escape menu, dialogs, console.
import { badgesHtml } from '../badges.js';
import { nameColor } from './characters.js';
import { avatarHeadshot } from '../render/thumbs.js';
import { setVolume, getVolume, click } from './sound.js';

const ICON = {
  menu: '<svg viewBox="0 0 24 24" fill="currentColor"><g transform="translate(12 12) rotate(15)"><rect x="-8" y="-8" width="16" height="16" rx="1.5"/><rect x="-2.5" y="-2.5" width="5" height="5" fill="#333"/></g></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v11H9l-5 4z"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  jump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14l7-7 7 7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};

function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export class HUD {
  constructor(root, client) {
    this.root = root;
    this.client = client;
    this.el = h('div', 'hud');
    root.append(this.el);
    this.tags = h('div', 'overlay-tags');
    root.insertBefore(this.tags, this.el);

    // top bar
    this.topbar = h('div', 'topbar');
    this.menuBtn = h('button', '', ICON.menu); this.menuBtn.title = 'Menu (Esc)';
    this.chatBtn = h('button', 'on', ICON.chat); this.chatBtn.title = 'Chat';
    this.lockBtn = h('button', 'lock-btn', ICON.lock); this.lockBtn.title = 'Shift Lock (Shift)';
    this.fullBtn = h('button', 'fs-btn', ICON.fullscreen); this.fullBtn.title = 'Fullscreen';
    this.topbar.append(this.menuBtn, this.chatBtn, this.lockBtn, this.fullBtn);
    this.el.append(this.topbar);
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    root.classList.toggle('touch', this.touch);
    this.menuBtn.onclick = () => this.toggleMenu();
    this.chatBtn.onclick = () => {
      const open = this.chat.classList.toggle('hidden') === false;
      this.chatBtn.classList.toggle('on', open);
      // On phones opening the chat goes straight to the keyboard.
      if (open && this.touch) this.focusChat();
    };
    this.fullBtn.onclick = () => client.toggleFullscreen();
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) this.fullBtn.classList.add('hidden');
    this.lockBtn.onclick = () => client.toggleShiftLock();

    // chat
    this.chat = h('div', 'chat faded');
    this.chatLog = h('div', 'log');
    const bar = h('form', 'bar');
    this.chatInput = h('input');
    this.chatInput.maxLength = 200;
    this.chatInput.placeholder = (matchMedia('(pointer: coarse)').matches ? 'Tap here to chat' : 'To chat click here or press "/" key');
    this.chatInput.enterKeyHint = 'send';
    this.chatInput.autocomplete = 'off';
    bar.append(this.chatInput);
    this.chat.append(this.chatLog, bar);
    this.el.append(this.chat);
    bar.onsubmit = (e) => {
      e.preventDefault();
      const t = this.chatInput.value.trim();
      this.chatInput.value = '';
      this.chatInput.blur();
      if (t) client.sendChat(t);
    };
    this.chatInput.addEventListener('focus', () => { this.chat.classList.add('active'); client.input.enabled = false; });
    this.chatInput.addEventListener('blur', () => { this.chat.classList.remove('active'); client.input.enabled = true; this.fadeChatSoon(); });
    this.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.chatInput.blur(); e.stopPropagation(); });

    // leaderboard + health
    this.board = h('div', 'leaderboard');
    this.el.append(this.board);
    // Small screens: the player list starts collapsed and expands on tap.
    if (this.touch && Math.min(innerWidth, innerHeight) < 600) this.board.classList.add('collapsed');
    this.board.addEventListener('click', () => { if (this.touch) { this.board.classList.toggle('collapsed'); this.health.style.top = this.board.offsetHeight + 10 + 'px'; } });
    this.health = h('div', 'healthbar', '<div></div>');
    this.el.append(this.health);

    this.hint = h('div', 'hint');
    this.message = h('div', 'message-full');
    this.el.append(this.hint, this.message);
    this.crosshair = h('div', 'crosshair');
    this.el.append(this.crosshair);
    this.fps = h('div', 'fps');
    this.el.append(this.fps);

    // Tool hotbar (keys 1-9)
    this.hotbar = h('div', 'hotbar');
    this.el.append(this.hotbar);
    this._toolsKey = '';

    // mobile
    this.stick = h('div', 'touch-stick', '<div class="knob"></div>');
    this.jump = h('button', 'jump-btn', ICON.jump);
    this.jump.setAttribute('aria-label', 'Jump');
    // Phones: a "use" button for the equipped tool (aims at the crosshair; hold for automatic tools).
    this.useBtn = h('button', 'use-btn hidden', '🔫');
    this.useBtn.setAttribute('aria-label', 'Use tool');
    let useTimer = null;
    const useDown = (e) => {
      e.preventDefault(); e.stopPropagation();
      this.useBtn.classList.add('down');
      client.useTool();
      const t = client.equippedTool();
      if (t && t._p.Automatic) useTimer = setInterval(() => client.useTool(), 110);
    };
    const useUp = (e) => { e.preventDefault(); this.useBtn.classList.remove('down'); clearInterval(useTimer); useTimer = null; };
    this.useBtn.addEventListener('touchstart', useDown, { passive: false });
    this.useBtn.addEventListener('touchend', useUp);
    this.useBtn.addEventListener('touchcancel', useUp);
    // Fly down (only while flying).
    this.downBtn = h('button', 'fly-down-btn hidden', '▼');
    const down = (on) => (e) => { client.input.touchDown = on; this.downBtn.classList.toggle('down', on); e.preventDefault(); e.stopPropagation(); };
    this.downBtn.addEventListener('touchstart', down(true), { passive: false });
    this.downBtn.addEventListener('touchend', down(false));
    this.downBtn.addEventListener('touchcancel', down(false));
    this.el.append(this.stick, this.jump, this.useBtn, this.downBtn);
    client.input.stickEl = this.stick;
    client.input.knobEl = this.stick.firstChild;
    const press = (on) => (e) => { client.input.touchJump = on; if (on) client.input.jumpTap = true; this.jump.classList.toggle('down', on); e.preventDefault(); e.stopPropagation(); };
    this.jump.addEventListener('touchstart', press(true), { passive: false });
    this.jump.addEventListener('touchend', press(false));
    this.jump.addEventListener('touchcancel', press(false));

    // Portrait hint for phones (the game is playable either way).
    this.rotateHint = h('div', 'rotate-hint', '<span>📱↻</span> Rotate your device for a better view <button aria-label="Dismiss">×</button>');
    this.rotateHint.querySelector('button').onclick = () => { this.rotateHint.remove(); this.rotateDismissed = true; };
    this.el.append(this.rotateHint);
    setTimeout(() => this.rotateHint.classList.add('fade'), 6000);

    this._buildMenu();
    this._buildConsole();
    this.leaderboardVisible = true;
  }

  // ------------------------------------------------------------ tools
  setTools(tools, equipped) {
    const key = tools.map((t) => t.id + t._p.Name).join(',') + '|' + (equipped ? equipped.id : '');
    if (key === this._toolsKey) return;
    this._toolsKey = key;
    const ICONS = { sword: '🗡️', gun: '🔫', rocket: '🚀', flashlight: '🔦', brush: '🖌️', hammer: '🔨', saber: '⚔️', torch: '🔥' };
    this.useBtn.classList.toggle('hidden', !equipped);
    if (equipped) this.useBtn.textContent = ICONS[equipped._p.ToolModel] || '🧰';
    this.hotbar.replaceChildren(...tools.slice(0, 9).map((t, i) => {
      const b = h('button', 'slot' + (equipped && equipped.id === t.id ? ' on' : ''),
        `<span class="num">${i + 1}</span><span class="ico">${ICONS[t._p.ToolModel] || '🧰'}</span><span class="nm">${esc(t._p.Name)}</span>`);
      b.title = t._p.ToolTip || t._p.Name;
      b.onclick = (e) => { e.stopPropagation(); this.client.equipSlot(i); };
      b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); this.client.equipSlot(i); });
      return b;
    }));
  }

  // ------------------------------------------------------------ loading
  showLoading(name, by) {
    this.loading = h('div', 'loading-screen', `
      <div class="ls-name">${esc(name || 'Loading')}</div>
      <div class="ls-by">${by ? 'By ' + esc(by) : ''}</div>
      <img class="ls-logo" src="/img/icon.svg" alt="">
      <div class="ls-status">Loading...</div>
      <div class="ls-tip"></div>`);
    this.root.append(this.loading);
    // Classic loading screen tips.
    const TIPS = ['Press / to chat.', 'Try /e dance in the chat!', 'Press Shift to toggle Shift Lock.', 'Press Esc to open the menu.',
      'Make your own games with Robis Studio.', 'Invite friends from the Esc menu → Players.', 'Collect your daily Robits on the Home page.',
      'Right-click and drag to turn the camera.', 'Walk into a truss to climb it.'];
    const tip = this.loading.querySelector('.ls-tip');
    let i = Math.floor(Math.random() * TIPS.length);
    const next = () => { if (this.loading) { tip.textContent = 'Tip: ' + TIPS[i++ % TIPS.length]; } };
    next();
    this._tipTimer = setInterval(next, 3500);
  }
  setLoadingStatus(s) { if (this.loading) this.loading.querySelector('.ls-status').textContent = s; }
  setLoadingName(name, by) {
    if (!this.loading) return;
    this.loading.querySelector('.ls-name').textContent = name;
    this.loading.querySelector('.ls-by').textContent = by ? 'By ' + by : '';
  }
  hideLoading() {
    clearInterval(this._tipTimer);
    if (!this.loading) return;
    const l = this.loading;
    this.loading = null;
    l.classList.add('done');
    setTimeout(() => l.remove(), 700);
  }

  // ------------------------------------------------------------ chat
  addChat(name, text, opts = {}) {
    const line = h('div', 'line' + (opts.system ? ' system' : ''));
    if (opts.system) line.textContent = text;
    else line.innerHTML = `<span class="who" style="color:${nameColor(name)}">[${esc(name)}]${badgesHtml(opts.flags)}:</span> ${esc(text)}`;
    this.chatLog.append(line);
    while (this.chatLog.children.length > 100) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
    this.chat.classList.remove('faded');
    this.fadeChatSoon();
  }
  fadeChatSoon() {
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => { if (!this.chat.classList.contains('active')) this.chat.classList.add('faded'); }, 12000);
  }
  focusChat() { this.chat.classList.remove('hidden'); this.chatInput.focus(); }

  // ------------------------------------------------------------ leaderboard
  updateBoard(game, myUserId) {
    const players = game.GetService('Players').GetPlayers();
    let cols = [];
    const rows = players.map((p) => {
      const ls = p.FindFirstChild('leaderstats');
      const stats = {};
      if (ls) for (const v of ls.GetChildren()) {
        if (!('Value' in v._p)) continue;
        if (!cols.includes(v.Name)) cols.push(v.Name);
        stats[v.Name] = v._p.Value;
      }
      const team = p._p.Team;
      const info = this.client.playerInfos.get(p._p.UserId);
      return { name: p.Name, me: p._p.UserId === myUserId, stats, team: team ? team.Name : '', color: team ? team._p.TeamColor.toHex() : '', flags: info ? info.flags : [] };
    });
    cols = cols.slice(0, 4);
    if (cols.length) rows.sort((a, b) => (+b.stats[cols[0]] || 0) - (+a.stats[cols[0]] || 0));
    const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1)) : v === undefined ? '' : String(v));
    const key = JSON.stringify([rows, cols]);
    if (key === this._boardKey) return;
    this._boardKey = key;
    const row = (r) => `<tr class="${r.me ? 'me' : ''}"><td>${esc(r.name)}${badgesHtml(r.flags)}</td>${cols.map((c) => `<td>${esc(fmt(r.stats[c]))}</td>`).join('')}</tr>`;
    // Group by team (with the team's colour and summed first stat), like 2019.
    const teams = [...new Set(rows.map((r) => r.team))];
    const body = teams.length > 1 || teams[0] ? teams.map((t) => {
      const list = rows.filter((r) => r.team === t);
      const sum = cols.length ? list.reduce((a, r) => a + (+r.stats[cols[0]] || 0), 0) : '';
      const color = list[0].color || '#888888';
      return `<tr class="team"><td style="background:${color}">${esc(t || 'Neutral')}</td>${cols.map((c, i) => `<td style="background:${color}">${i === 0 ? esc(fmt(sum)) : ''}</td>`).join('')}</tr>${list.map(row).join('')}`;
    }).join('') : rows.map(row).join('');
    this.board.innerHTML = `<table>${cols.length ? `<tr><th>Players</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` : `<tr><th>Players</th></tr>`}
      ${body}</table>`;
    this.health.style.top = this.board.offsetHeight + 10 + 'px';
  }
  toggleBoard() {
    this.leaderboardVisible = !this.leaderboardVisible;
    this.board.style.display = this.leaderboardVisible ? '' : 'none';
  }

  setHealth(hp, max) {
    const f = max > 0 ? hp / max : 0;
    this.health.style.display = f < 1 ? 'block' : 'none';
    this.health.firstChild.style.width = Math.max(0, f * 100) + '%';
    this.health.firstChild.style.background = f > 0.5 ? '#29d157' : f > 0.2 ? '#f5cd30' : '#e8413c';
  }

  setHint(text) {
    this.hint.textContent = text;
    this.hint.style.display = text ? 'block' : 'none';
    // Keep the chat below the hint bar.
    this.el.classList.toggle('has-hint', !!text);
  }
  setMessage(text) { this.message.textContent = text; this.message.style.display = text ? 'flex' : 'none'; }

  // ------------------------------------------------------------ escape menu
  _buildMenu() {
    this.menu = h('div', 'esc-menu');
    const panel = h('div', 'esc-panel');
    this.menuTabs = h('div', 'esc-tabs');
    this.menuBody = h('div', 'esc-body');
    this.menuActions = h('div', 'esc-actions');
    panel.append(this.menuTabs, this.menuBody, this.menuActions);
    this.menu.append(panel);
    this.el.append(this.menu);
    this.menu.addEventListener('mousedown', (e) => { if (e.target === this.menu) this.toggleMenu(false); });
    const tabs = { Players: () => this._playersTab(), Store: () => this._storeTab(), Settings: () => this._settingsTab(), Help: () => this._helpTab() };
    for (const [name, fn] of Object.entries(tabs)) {
      const b = h('button', '', name);
      b.onclick = () => { [...this.menuTabs.children].forEach((x) => x.classList.toggle('active', x === b)); this.menuBody.dataset.tab = name; this._restoreActions(); fn(); };
      this.menuTabs.append(b);
    }
  }

  _restoreActions() {
    this.menuActions.innerHTML = '';
    const mk = (label, key, fn, primary) => {
      const b = h('button', primary ? 'primary' : '', `${label}<kbd>${key}</kbd>`);
      b.onclick = fn;
      this.menuActions.append(b);
    };
    mk('Reset Character', 'R', () => this.confirmReset());
    mk('Leave Game', 'L', () => this.confirmLeave());
    mk('Resume Game', 'ESC', () => this.toggleMenu(false), true);
  }

  toggleMenu(force) {
    const open = force === undefined ? !this.menu.classList.contains('open') : force;
    this.menu.classList.toggle('open', open);
    this.client.input.enabled = !open;
    if (open) {
      click();
      if (document.pointerLockElement) document.exitPointerLock();
      this.menuTabs.firstChild.click();
    }
    this.menuOpen = open;
  }

  confirmReset() {
    this.menuBody.innerHTML = '<div class="esc-confirm"><h2>Are you sure you want to reset your character?</h2></div>';
    this.menuActions.innerHTML = '';
    const yes = h('button', 'primary', 'Reset<kbd>Enter</kbd>');
    const no = h('button', '', "Don't Reset<kbd>ESC</kbd>");
    yes.onclick = () => { this.client.resetCharacter(); this.toggleMenu(false); };
    no.onclick = () => this.menuTabs.firstChild.click();
    this.menuActions.append(yes, no);
    this.pendingConfirm = yes;
  }

  confirmLeave() {
    this.menuBody.innerHTML = '<div class="esc-confirm"><h2>Are you sure you want to leave the game?</h2></div>';
    this.menuActions.innerHTML = '';
    const yes = h('button', 'primary', 'Leave<kbd>Enter</kbd>');
    const no = h('button', '', "Don't Leave<kbd>ESC</kbd>");
    yes.onclick = () => this.client.leave();
    no.onclick = () => this.menuTabs.firstChild.click();
    this.menuActions.append(yes, no);
    this.pendingConfirm = yes;
  }

  _playersTab() {
    this.pendingConfirm = null;
    this.menuBody.innerHTML = '';
    for (const info of this.client.playerInfos.values()) {
      const row = h('div', 'esc-player');
      const img = h('img');
      avatarHeadshot(info.avatar, 88).then((u) => { img.src = u; });
      const name = h('div', '', `<b>${esc(info.name)}</b>${badgesHtml(info.flags)}${info.userId === this.client.userId ? ' <span style="color:#aaa">(you)</span>' : ''}`);
      name.style.flex = '1';
      const prof = h('a', '', 'Profile');
      prof.href = `/profile?id=${info.userId}`;
      prof.target = '_blank';
      prof.style.color = '#8fd0ff';
      row.append(img, name, prof);
      this.menuBody.append(row);
    }
    // Invite friends to this server (not in Studio tests or friends' rooms).
    if (this.client.opts.placeId && !this.client.opts.testPlace) {
      const inv = h('button', 'esc-invite', 'Invite Friends');
      inv.onclick = () => this._inviteFriends();
      this.menuBody.append(inv);
    }
  }

  async _inviteFriends() {
    this.pendingConfirm = null;
    this.menuBody.innerHTML = '<div class="esc-sub">Invite Friends</div>';
    const list = h('div', 'esc-friends');
    this.menuBody.append(list);
    try {
      const me = await (await fetch('/api/auth/me')).json();
      const { friends } = await (await fetch(`/api/users/${me.user.id}/friends`)).json();
      const { sendInvite } = await import('/js/site/invites.js');
      if (!friends.length) { list.append(h('div', 'esc-empty', 'No friends yet.')); return; }
      friends.sort((a, b) => (b.presence.status !== 'offline') - (a.presence.status !== 'offline'));
      for (const f of friends) {
        const row = h('div', 'esc-player');
        const img = h('img');
        avatarHeadshot(f.avatar, 88).then((u) => { img.src = u; });
        const online = f.presence.status !== 'offline';
        const name = h('div', '', `<b>${esc(f.username)}</b> <span style="color:${online ? '#02b757' : '#aaa'}">${online ? 'Online' : 'Offline'}</span>`);
        name.style.flex = '1';
        const b = h('button', 'primary', 'Invite');
        b.onclick = async () => {
          b.disabled = true;
          try { await sendInvite(f.id, this.client.opts.placeId, this.client.serverId); b.textContent = 'Invited!'; } catch (e) { b.textContent = e.message; }
        };
        row.append(img, name, b);
        list.append(row);
      }
    } catch { list.append(h('div', 'esc-empty', 'Could not load friends.')); }
  }

  _settingsTab() {
    this.pendingConfirm = null;
    const c = this.client;
    this.menuBody.innerHTML = '';
    const row = (label, control) => { const r = h('div', 'esc-setting'); r.append(h('span', '', label), control); this.menuBody.append(r); };
    const sens = h('input'); sens.type = 'range'; sens.min = 0.2; sens.max = 3; sens.step = 0.1; sens.value = c.cam.sensitivity;
    sens.oninput = () => { c.cam.sensitivity = +sens.value; c.saveSettings(); };
    row('Camera Sensitivity', sens);
    const vol = h('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = getVolume();
    vol.oninput = () => { setVolume(+vol.value); c.saveSettings(); };
    row('Volume', vol);
    const gfx = h('select', '', ['Low', 'Medium', 'High'].map((q) => `<option ${c.settings.quality === q ? 'selected' : ''}>${q}</option>`).join(''));
    gfx.onchange = () => { c.setQuality(gfx.value); c.saveSettings(); };
    row('Graphics Quality', gfx);
    const lock = h('select', '', `<option value="1">On</option><option value="0" ${c.settings.shiftLockEnabled ? '' : 'selected'}>Off</option>`);
    lock.onchange = () => { c.settings.shiftLockEnabled = lock.value === '1'; c.saveSettings(); };
    row('Shift Lock Switch', lock);
    const fps = h('select', '', `<option value="0">Off</option><option value="1" ${c.settings.showFps ? 'selected' : ''}>On</option>`);
    fps.onchange = () => { c.settings.showFps = fps.value === '1'; c.saveSettings(); };
    row('Show FPS', fps);
  }

  // The Hunt: a big banner when you find a token.
  // The Hunt scanner: how strong the hidden shard's signal is (level 1-5,
  // 0 = no shard right now, -1 = found: the scanner goes away).
  huntScanner(level) {
    if (level < 0) { if (this.scanner) this.scanner.remove(); this.scanner = null; return; }
    if (!this.scanner) {
      this.scanner = h('div', 'hunt-scanner', `<div class="hs-title">SHARD SCANNER</div><div class="hs-bars">${'<i></i>'.repeat(5)}</div><div class="hs-text"></div>`);
      this.root.append(this.scanner);
    }
    const words = ['Searching...', 'Very weak', 'Weak', 'Getting closer', 'Strong', 'VERY STRONG!'];
    this.scanner.querySelectorAll('.hs-bars i').forEach((b, i) => b.classList.toggle('on', i < level));
    this.scanner.querySelector('.hs-text').textContent = words[level] || '';
    this.scanner.dataset.level = level;
  }

  // The Hunt quest panel (quest events): the quest of this game and how far
  // along you are; a countdown while the runes are lit.
  huntQuest(m) {
    if (!this.quest) {
      this.quest = h('div', 'hunt-quest', '<div class="hq-title">THE HUNT QUEST</div><div class="hq-text"></div><div class="hq-progress"></div><div class="hq-timer"></div>');
      this.root.append(this.quest);
    }
    const q = this.quest;
    q.classList.toggle('done', !!m.done);
    q.querySelector('.hq-text').textContent = m.text;
    q.querySelector('.hq-progress').textContent = m.done ? '✓ Relic found!' : m.progress || '';
    clearInterval(this.questTimer);
    const timer = q.querySelector('.hq-timer');
    timer.textContent = '';
    if (m.left > 0 && !m.done) {
      const end = Date.now() + m.left * 1000;
      const draw = () => {
        const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        timer.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (!s) clearInterval(this.questTimer);
      };
      draw();
      this.questTimer = setInterval(draw, 500);
    }
  }

  // player:ShowMessage(): big text in the middle of the screen for a moment.
  bigMessage(text, secs = 3, color = '#ffffff') {
    if (this.bigMsg) this.bigMsg.remove();
    const b = h('div', 'big-message');
    b.textContent = text;
    b.style.color = /^#[0-9a-f]{6}$/i.test(color) ? color : '#fff';
    this.root.append(b);
    this.bigMsg = b;
    setTimeout(() => b.classList.add('out'), secs * 1000);
    setTimeout(() => { b.remove(); if (this.bigMsg === b) this.bigMsg = null; }, secs * 1000 + 500);
  }

  huntBanner(count, total, reward, robits, kind) {
    const b = h('div', 'hunt-banner' + (kind === 'quests' ? ' relic' : ''), `<div class="hunt-token"></div><div><div class="hunt-title">${kind === 'quests' ? 'QUEST COMPLETE!' : 'SHARD FOUND!'}</div>
      <div class="hunt-count">${count} / ${total}${robits ? `<span class="hunt-robits">+${robits} R$</span>` : ''}</div>${reward ? `<div class="hunt-reward">You won: ${esc(reward.name)}!</div>` : ''}</div>`);
    this.root.append(b);
    setTimeout(() => b.classList.add('out'), 4500);
    setTimeout(() => b.remove(), 5200);
  }

  // Game passes of this game: buy them without leaving.
  _storeTab() {
    this.pendingConfirm = null;
    this.menuBody.innerHTML = '<div class="store-empty">Loading...</div>';
    this.client.send({ t: 'passList' });
  }
  showPassList(passes) {
    if (!this.menuOpen || this.menuBody.dataset.tab !== 'Store') return;
    if (!passes.length) { this.menuBody.innerHTML = '<div class="store-empty">This game has no game passes yet.</div>'; return; }
    const grid = h('div', 'store-grid');
    for (const p of passes) {
      const card = h('div', 'store-card', `<div class="pass-icon" style="background:${esc(p.color)}">${esc(p.icon)}</div>
        <b>${esc(p.name)}</b><div class="pass-desc">${esc(p.description || p.perkName || '')}</div>`);
      const btn = h('button', p.owned ? 'owned' : 'primary', p.owned ? 'Owned' : `R$ ${p.price}`);
      btn.disabled = p.owned;
      btn.onclick = () => { this.toggleMenu(false); this.passDialog(p); };
      card.append(btn);
      grid.append(card);
    }
    this.menuBody.replaceChildren(grid);
  }
  // The buy dialog (from the Store tab or MarketplaceService:PromptGamePassPurchase).
  passDialog(p, robits) {
    if (this.activeDialog) this.activeDialog.remove();
    const d = h('div', 'game-dialog');
    const box = h('div', 'box pass-box', `<h3>Buy Game Pass</h3>
      <div class="pass-row"><div class="pass-icon big" style="background:${esc(p.color)}">${esc(p.icon)}</div>
      <div><b>${esc(p.name)}</b><p>${esc(p.description || p.perkName || '')}</p></div></div>`);
    const btns = h('div', 'btns');
    const close = (confirm) => { d.remove(); this.activeDialog = null; this.client.send({ t: 'buyPass', id: p.id, confirm }); };
    if (p.owned) {
      box.append(h('p', '', 'You already own this pass.'));
      const ok = h('button', 'primary', 'OK'); ok.onclick = () => close(false); btns.append(ok);
    } else {
      const buy = h('button', 'primary', `Buy for R$ ${p.price}`); buy.onclick = () => close(true);
      const cancel = h('button', 'secondary', 'Cancel'); cancel.onclick = () => close(false);
      btns.append(buy, cancel);
      if (robits !== undefined) box.append(h('p', 'pass-balance', `Your balance: R$ ${robits}`));
    }
    box.append(btns);
    d.append(box);
    this.root.append(d);
    this.activeDialog = d;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _helpTab() {
    this.pendingConfirm = null;
    this.menuBody.innerHTML = `
      <table style="width:100%;font-size:16px;line-height:2">
        <tr><td>Move</td><td>W A S D / Arrow keys</td></tr>
        <tr><td>Jump</td><td>Space</td></tr>
        <tr><td>Rotate camera</td><td>Hold right mouse button</td></tr>
        <tr><td>Zoom</td><td>Mouse wheel, I / O</td></tr>
        <tr><td>Shift Lock</td><td>Shift</td></tr>
        <tr><td>Chat</td><td>/ &nbsp; (emotes: /e dance, /e dance2, /e dance3, /e wave, /e point, /e cheer, /e laugh)</td></tr>
        <tr><td>Player list</td><td>Tab</td></tr>
        <tr><td>Developer console</td><td>F9</td></tr>
      </table>`;
  }

  // ------------------------------------------------------------ dialogs
  dialog(title, text, buttons) {
    if (this.activeDialog) this.activeDialog.remove();
    const d = h('div', 'game-dialog');
    const box = h('div', 'box', `<h3>${esc(title)}</h3><p>${esc(text)}</p>`);
    const btns = h('div', 'btns');
    for (const b of buttons) {
      const x = h('button', b.primary ? 'primary' : 'secondary', esc(b.text));
      x.onclick = () => { d.remove(); this.activeDialog = null; b.onClick && b.onClick(); };
      btns.append(x);
    }
    box.append(btns);
    d.append(box);
    this.root.append(d);
    this.activeDialog = d;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ------------------------------------------------------------ developer console
  _buildConsole() {
    this.console = h('div', 'dev-console', '<div class="dc-head">Developer Console<button title="Close">×</button></div><div class="dc-log"></div>');
    const form = h('form');
    // A textarea, so pasted multi-line scripts keep their line breaks
    // (Enter runs, Shift+Enter adds a new line).
    this.consoleInput = h('textarea');
    this.consoleInput.rows = 1;
    this.consoleInput.spellcheck = false;
    this.consoleInput.placeholder = 'Server Lua or :commands (owners and admins). Shift+Enter: new line';
    const run = h('button', '', 'Run');
    run.type = 'submit';
    form.append(this.consoleInput, run);
    const grow = () => { const t = this.consoleInput; t.style.height = '34px'; t.style.height = Math.min(180, t.scrollHeight) + 'px'; };
    this.consoleInput.addEventListener('input', grow);
    this.console.append(form);
    this.el.append(this.console);
    this.console.querySelector('button').onclick = () => this.toggleConsole(false);
    form.onsubmit = (e) => {
      e.preventDefault();
      const src = this.consoleInput.value.trim();
      if (!src) return;
      this.consoleInput.value = '';
      grow();
      // ":kill all" etc. are chat commands; everything else is server Lua.
      if (src[0] === ':') this.client.send({ t: 'chat', text: src });
      else this.client.send({ t: 'exec', src });
    };
    this.consoleInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
      if (e.code === 'F9' || e.key === 'Escape') { e.preventDefault(); this.toggleConsole(false); }
    });
    this.consoleInput.addEventListener('focus', () => { this.client.input.enabled = false; });
    this.consoleInput.addEventListener('blur', () => { this.client.input.enabled = true; });
  }
  setFlying(on) {
    if (on === this.flying || !this.downBtn) return;
    this.flying = on;
    this.downBtn.classList.toggle('hidden', !on);
  }
  toggleConsole(force) {
    const open = force === undefined ? !this.console.classList.contains('open') : force;
    this.console.classList.toggle('open', open);
    // Closing gives the keyboard back to the game; opening puts the cursor in the box.
    if (open) setTimeout(() => this.consoleInput.focus(), 0);
    else this.consoleInput.blur();
  }
  log(entry) {
    const log = this.console.querySelector('.dc-log');
    const line = h('div', entry.level);
    const t = new Date(entry.time || Date.now()).toLocaleTimeString();
    line.textContent = `${t}  ${entry.text}`;
    log.append(line);
    while (log.children.length > 500) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  dispose() { this.el.remove(); this.tags.remove(); }
}
