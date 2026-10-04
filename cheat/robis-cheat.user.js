// ==UserScript==
// @name         Robis Test Cheat
// @description  For testing the Robis anti-cheat and Overwatch (branch claude/robis-test-cheat)
// @version      1.0
// @match        *://*/play*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
// Robis Injected Test Cheat - for testing the anti-cheat and Robis Overwatch.
// Lives only in the branch claude/robis-test-cheat. It doesn't need any
// change in the game: it is injected into an open game (a bookmark /
// bookmarklet, or a userscript) and works on any Robis server, also on a
// phone. It changes what your own game sends to the server, so the server's
// anti-cheat sees a cheater and makes an Overwatch case.
(() => {
  if (window.__robisCheat) { window.__robisCheat.toggle(); return; }
  const st = { speed: false, mult: 3, fly: false, lift: 0, last: null, ws: null, ry: 0 };
  // fake a message from the server to our own game (it moves our player)
  const inject = (msg) => { if (st.ws && st.ws.onmessage) st.ws.onmessage({ data: JSON.stringify(msg) }); };
  const tp = (x, y, z) => { inject({ t: 'teleport', cf: [x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1] }); st.last = [x, y, z]; };
  const send0 = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    if (typeof data === 'string' && data.startsWith('{"t":"move"')) {
      st.ws = this;
      try {
        const m = JSON.parse(data);
        const p = m.p;
        st.ry = +m.ry || 0;
        // speed hack: every step is made longer (and our game is moved along)
        if (st.speed && st.last) {
          const dx = p[0] - st.last[0], dz = p[2] - st.last[2];
          const d = Math.hypot(dx, dz);
          if (d > 0.05 && d < 6 && Math.abs(p[1] - st.last[1]) < 1.5) {
            p[0] += dx * (st.mult - 1); p[2] += dz * (st.mult - 1);
            data = JSON.stringify(m);
            send0.call(this, data);
            tp(p[0], p[1], p[2]);
            return;
          }
        }
        // fly hack: no gravity, the arrows go up and down
        if (st.fly) inject({ t: 'impulse', v: [0, st.lift || 5, 0] }); // 5: just enough to float
        st.last = p.slice();
      } catch { /* not a move */ }
    }
    return send0.call(this, data);
  };
  // ---------------------------------------------------------------- the panel
  const css = document.createElement('style');
  css.textContent = `
#rc-panel{position:fixed;left:8px;top:56px;z-index:99999;width:220px;background:rgba(14,16,22,.95);color:#fff;border:2px solid #e8413c;border-radius:12px;font:14px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);touch-action:none;user-select:none}
#rc-panel.min .rc-body{display:none}
#rc-head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#e8413c;border-radius:9px 9px 0 0;font-weight:800;cursor:move}
#rc-head span{flex:1}#rc-head button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
.rc-body{padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.rc-row{display:flex;gap:6px}.rc-row>*{flex:1}
#rc-panel button.rc{background:#2a303c;color:#fff;border:1px solid #3a4252;border-radius:8px;padding:9px 6px;font:700 13px system-ui,sans-serif;cursor:pointer}
#rc-panel button.rc.on{background:#02b757;border-color:#02b757}
.rc-note{font-size:11px;opacity:.65}
#rc-panel input[type=range]{width:100%}`;
  document.head.append(css);
  const panel = document.createElement('div');
  panel.id = 'rc-panel';
  panel.innerHTML = `<div id="rc-head"><span>☠ Robis Test Cheat</span><button data-a="min">–</button></div>
<div class="rc-body">
<div class="rc-note">For testing the anti-cheat / Overwatch. You WILL be caught.</div>
<button class="rc" data-a="speed">⚡ Speed hack: OFF</button>
<input type="range" min="2" max="6" step="0.5" value="3" data-a="mult"><div class="rc-note" data-v="mult">x3</div>
<button class="rc" data-a="fly">🕊 Fly hack: OFF</button>
<div class="rc-row"><button class="rc" data-a="up">▲ Up</button><button class="rc" data-a="stop">■</button><button class="rc" data-a="down">▼ Down</button></div>
<div class="rc-row"><button class="rc" data-a="blink">⏩ Blink 15</button><button class="rc" data-a="sky">🚀 +50 up</button></div>
<button class="rc" data-a="rand">✨ Random teleport</button>
<div class="rc-note" data-v="status">Walk a step so the cheat finds the game.</div>
</div>`;
  document.body.append(panel);
  const $ = (a) => panel.querySelector(`[data-a=${a}]`);
  const status = panel.querySelector('[data-v=status]');
  const need = () => { if (!st.ws || !st.last) { status.textContent = 'Walk a step first!'; return false; } status.textContent = 'OK'; return true; };
  const draw = () => {
    $('speed').textContent = `⚡ Speed hack: ${st.speed ? 'ON' : 'OFF'}`; $('speed').classList.toggle('on', st.speed);
    $('fly').textContent = `🕊 Fly hack: ${st.fly ? 'ON' : 'OFF'}`; $('fly').classList.toggle('on', st.fly);
  };
  panel.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    e.stopPropagation();
    const fwd = [-Math.sin(st.ry), -Math.cos(st.ry)];
    if (a === 'min') panel.classList.toggle('min');
    else if (a === 'speed') st.speed = !st.speed;
    else if (a === 'fly') { st.fly = !st.fly; st.lift = 0; }
    else if (a === 'up') { st.fly = true; st.lift = 30; }
    else if (a === 'down') { st.fly = true; st.lift = -30; }
    else if (a === 'stop') st.lift = 0;
    else if (need()) {
      const [x, y, z] = st.last;
      if (a === 'blink') tp(x + fwd[0] * 15, y, z + fwd[1] * 15);
      else if (a === 'sky') tp(x, y + 50, z);
      else if (a === 'rand') tp(x + (Math.random() - 0.5) * 160, y + 5, z + (Math.random() - 0.5) * 160);
    }
    draw();
  });
  panel.addEventListener('input', (e) => { if (e.target.dataset.a === 'mult') { st.mult = +e.target.value; panel.querySelector('[data-v=mult]').textContent = 'x' + st.mult; } });
  // keep the game from treating taps on the panel as game input
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());
  // drag the panel by its title
  let drag = null;
  const head = panel.querySelector('#rc-head');
  head.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; drag = [e.clientX - panel.offsetLeft, e.clientY - panel.offsetTop]; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', (e) => { if (drag) { panel.style.left = (e.clientX - drag[0]) + 'px'; panel.style.top = (e.clientY - drag[1]) + 'px'; } });
  head.addEventListener('pointerup', () => { drag = null; });
  window.__robisCheat = { st, toggle: () => { panel.style.display = panel.style.display === 'none' ? '' : 'none'; } };
  draw();
})();
