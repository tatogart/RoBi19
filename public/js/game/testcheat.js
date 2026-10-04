// ROBIS TEST CHEAT - for testing the anti-cheat and Robis Overwatch only.
// This file lives in the separate branch claude/robis-test-cheat and is
// never merged into main. It only changes the cheater's own game: speed,
// fly, noclip and click-teleport. The server's anti-cheat should notice and
// make an Overwatch case.
//
// F8 (or the red button) opens the menu. Ctrl + click = teleport there.
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
`;
  document.head.append(css);
  const btn = document.createElement('button');
  btn.className = 'tc-btn';
  btn.textContent = 'TEST CHEAT (F8)';
  const menu = document.createElement('div');
  menu.className = 'tc-menu';
  menu.innerHTML = `<h4>Robis Test Cheat</h4>
<div class="tc-note">Only for testing the anti-cheat and Overwatch. You WILL get caught.</div>
<label>⚡ Speed hack <input type="checkbox" data-k="speed"></label>
<input type="range" min="2" max="6" step="0.5" value="3" data-k="mult"><div class="tc-note" data-v="mult">x3 speed</div>
<label>🕊 Fly hack <input type="checkbox" data-k="fly"></label>
<label>🧱 Noclip (through walls) <input type="checkbox" data-k="noclip"></label>
<label>✨ Ctrl + click teleport <input type="checkbox" data-k="tp"></label>`;
  document.body.append(btn, menu);
  const toggle = () => menu.classList.toggle('open');
  btn.onclick = toggle;
  addEventListener('keydown', (e) => { if (e.code === 'F8') { e.preventDefault(); toggle(); } });
  menu.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (k === 'mult') { st.mult = +e.target.value; menu.querySelector('[data-v=mult]').textContent = `x${st.mult} speed`; } else st[k] = e.target.checked;
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
  // Ctrl + click: jump to the spot under the mouse
  addEventListener('mousedown', (e) => {
    if (!st.tp || !e.ctrlKey || !client.local) return;
    const p = client.aimPoint(e.clientX, e.clientY);
    client.local.x = p.x; client.local.y = p.y + 4; client.local.z = p.z;
    client.local.vx = client.local.vy = client.local.vz = 0;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}
