// The short version of the test cheat, easy to copy on a phone: speed,
// fly up, +50 up, random teleport. Same idea as robis-cheat.js.
(() => {
  if (window.__rcl) return;
  window.__rcl = 1;
  const s = { sp: 0, fl: 0, l: null, w: null };
  const inj = (m) => s.w && s.w.onmessage({ data: JSON.stringify(m) });
  const tp = (x, y, z) => { inj({ t: 'teleport', cf: [x, y, z] }); s.l = [x, y, z]; };
  const o = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    if (typeof d == 'string' && d.startsWith('{"t":"move"')) {
      s.w = this;
      const m = JSON.parse(d), p = m.p;
      if (s.sp && s.l) {
        const a = p[0] - s.l[0], b = p[2] - s.l[2], h = Math.hypot(a, b);
        if (h > 0.05 && h < 6) { p[0] += a * 2; p[2] += b * 2; o.call(this, JSON.stringify(m)); tp(p[0], p[1], p[2]); return; }
      }
      if (s.fl) inj({ t: 'impulse', v: [0, 30, 0] });
      s.l = p;
    }
    return o.call(this, d);
  };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99999;display:flex;flex-direction:column;gap:6px';
  const b = (t, f) => {
    const e = document.createElement('button');
    e.textContent = t;
    e.style.cssText = 'background:#e8413c;color:#fff;border:0;border-radius:8px;padding:10px;font:700 15px sans-serif';
    e.onclick = (v) => { v.stopPropagation(); if (!s.l) return alert('Walk a step first!'); f(e); };
    box.append(e);
  };
  b('Speed x3: OFF', (e) => { s.sp ^= 1; e.textContent = 'Speed x3: ' + (s.sp ? 'ON' : 'OFF'); });
  b('Fly up: OFF', (e) => { s.fl ^= 1; e.textContent = 'Fly up: ' + (s.fl ? 'ON' : 'OFF'); });
  b('+50 up', () => tp(s.l[0], s.l[1] + 50, s.l[2]));
  b('Teleport', () => tp(s.l[0] + Math.random() * 160 - 80, s.l[1] + 5, s.l[2] + Math.random() * 160 - 80));
  document.body.append(box);
})();
