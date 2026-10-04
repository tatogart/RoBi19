// ROBIS TEST CHEAT - for testing the anti-cheat and Robis Overwatch only.
// This file lives in the separate branch claude/robis-test-cheat and is
// never merged into main. It only changes the cheater's own game: speed,
// fly, noclip and click-teleport. The server's anti-cheat should notice and
// make an Overwatch case.
//
// F8 (or the red button) opens the menu. Ctrl + click = teleport there.
// On a phone: tap the red button; "Tap to teleport" then the spot.
export function installTestCheat(client) {
  const st = { speed: false, fly: false, noclip: false, tp: false, mult: 3 };
  window.__robisCheat = { client, st };
  const css = document.createElement('style');
  css.textContent = `
.tc-btn { position: fixed; left: 10px; bottom: 120px; z-index: 5000; background: #c4281c; color: #fff; border: 0; border-radius: 8px; padding: 6px 10px; font: 700 12px sans-serif; cursor: pointer; opacity: .85; }
.tc-menu { position: fixed; left: 10px; bottom: 160px; z-index: 5000; width: 230px; background: rgba(15,17,23,.94); color: #fff; border: 2px solid #c4281c; border-radius: 10px; padding: 10px; font: 13px sans-serif; display: none; }
.tc-menu.open { display: block; }
.tc-menu h4 { margin: 0 0 4px; color: #ff6b6b; font-size: 14px; }
.tc-menu .tc-note { font-size: 11px; opacity: .7; margin-bottom: 8px; }
.tc-menu label { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; cursor: pointer; }
.tc-menu input[type=range] { width: 100%; }
.tc-tap { position: fixed; left: 50%; transform: translateX(-50%); top: 60px; z-index: 5000; background: #7b5cff; color: #fff; border: 0; border-radius: 22px; padding: 10px 18px; font: 700 14px sans-serif; display: none; box-shadow: 0 4px 14px rgba(0,0,0,.4); }
.tc-tap.show { display: block; } .tc-tap.armed { background: #02b757; }
/* phones: big buttons up top, out of the way of the joystick and the jump button */
.tc-touch .tc-btn { bottom: auto; top: 52px; left: 8px; padding: 10px 14px; font-size: 14px; }
.tc-touch .tc-menu { bottom: auto; top: 96px; left: 8px; right: 8px; width: auto; max-width: 340px; font-size: 16px; max-height: calc(100vh - 110px); overflow-y: auto; }
.tc-touch .tc-menu label { padding: 10px 0; }
.tc-touch .tc-menu input[type=checkbox] { width: 26px; height: 26px; }
.tc-touch .tc-menu input[type=range] { height: 30px; }
.tc-close { float: right; background: none; border: 0; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; }
`;
  document.head.append(css);
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) document.body.classList.add('tc-touch');
  const btn = document.createElement('button');
  btn.className = 'tc-btn';
  btn.textContent = touch ? '🛠 TEST CHEAT' : 'TEST CHEAT (F8)';
  const menu = document.createElement('div');
  menu.className = 'tc-menu';
  menu.innerHTML = `<button class="tc-close" aria-label="Close">×</button><h4>Robis Test Cheat</h4>
<div class="tc-note">Only for testing the anti-cheat and Overwatch. You WILL get caught.</div>
<label>⚡ Speed hack <input type="checkbox" data-k="speed"></label>
<input type="range" min="2" max="6" step="0.5" value="3" data-k="mult"><div class="tc-note" data-v="mult">x3 speed</div>
<label>🕊 Fly hack <input type="checkbox" data-k="fly"></label>
<label>🧱 Noclip (through walls) <input type="checkbox" data-k="noclip"></label>
<label>✨ ${touch ? 'Tap teleport' : 'Ctrl + click teleport'} <input type="checkbox" data-k="tp"></label>`;
  // phone: the teleport button (tap it, then tap where to go)
  const tap = document.createElement('button');
  tap.className = 'tc-tap';
  tap.textContent = '📍 Tap to teleport';
  let armed = false;
  const arm = (on) => { armed = on; tap.classList.toggle('armed', on); tap.textContent = on ? '👆 Now tap the spot' : '📍 Tap to teleport'; };
  tap.addEventListener('click', (e) => { e.stopPropagation(); arm(!armed); });
  document.body.append(btn, menu, tap);
  const toggle = () => menu.classList.toggle('open');
  btn.onclick = toggle;
  menu.querySelector('.tc-close').onclick = () => menu.classList.remove('open');
  for (const el of [btn, menu, tap]) for (const ev of ['touchstart', 'pointerdown', 'mousedown']) el.addEventListener(ev, (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (e.code === 'F8') { e.preventDefault(); toggle(); } });
  menu.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (k === 'mult') { st.mult = +e.target.value; menu.querySelector('[data-v=mult]').textContent = `x${st.mult} speed`; } else st[k] = e.target.checked;
    if (k === 'tp' && touch) { tap.classList.toggle('show', st.tp); arm(false); }
  });

  // Every frame, before the player moves: change the local Humanoid / world.
  let base = null;
  client.testCheat = {
    beforeStep(hum) {
      if (!hum) return;
      const p = hum._p;
      if (!base || base.hum !== hum) base = { hum, walk: p.WalkSpeed, fly: p.Flying };
      p.WalkSpeed = st.speed ? base.walk * st.mult : base.walk;
      p.Flying = st.fly || st.noclip || base.fly;
      // noclip: the world has no walls for this player
      const w = client.world;
      if (w && !w._tcWrapped) {
        const q = w.query.bind(w);
        w.query = (...a) => (st.noclip ? [] : q(...a));
        w._tcWrapped = true;
      }
    },
  };
  const jumpTo = (x, y) => {
    const p = client.aimPoint(x, y);
    client.local.x = p.x; client.local.y = p.y + 4; client.local.z = p.z;
    client.local.vx = client.local.vy = client.local.vz = 0;
  };
  // Ctrl + click: jump to the spot under the mouse
  addEventListener('mousedown', (e) => {
    if (!st.tp || !e.ctrlKey || !client.local) return;
    jumpTo(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // phone: after "Tap to teleport", the next tap on the game
  addEventListener('touchstart', (e) => {
    if (!st.tp || !armed || !client.local || !e.touches[0]) return;
    if ([btn, menu, tap].some((x) => x.contains(e.target))) return;
    jumpTo(e.touches[0].clientX, e.touches[0].clientY);
    arm(false);
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true, passive: false });
}
