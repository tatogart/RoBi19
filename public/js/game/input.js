// Keyboard, mouse and touch input for the game client.
export class Input {
  constructor(el, opts = {}) {
    this.el = el;
    this.keys = new Set();
    this.jumpPressed = false;
    this.rmb = false;
    this.pointerLocked = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchJump = false;
    this.enabled = true;
    this.onRotate = opts.onRotate || (() => {});
    this.onZoom = opts.onZoom || (() => {});
    this.onKey = opts.onKey || (() => {});
    this.onClick = opts.onClick || (() => {});
    this.onHover = opts.onHover || (() => {});
    this._bind();
  }

  _bind() {
    const el = this.el;
    this.h = {
      keydown: (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (this.onKey(e) === false) { e.preventDefault(); return; }
        if (!this.enabled) return;
        const k = e.code;
        if (k === 'Space') { this.jumpPressed = true; e.preventDefault(); }
        this.keys.add(k);
        if (k === 'KeyI') this.onZoom(-1);
        if (k === 'KeyO') this.onZoom(1);
      },
      keyup: (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.jumpPressed = false; },
      blur: () => { this.keys.clear(); this.jumpPressed = false; this.rmb = false; },
      mousedown: (e) => {
        if (e.button === 2) { this.rmb = true; this.lastX = e.clientX; this.lastY = e.clientY; }
        if (e.button === 0) { this.downX = e.clientX; this.downY = e.clientY; }
      },
      mouseup: (e) => {
        if (e.button === 2) this.rmb = false;
        if (e.button === 0 && this.downX !== undefined && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) < 6) this.onClick(e);
      },
      mousemove: (e) => {
        if (this.pointerLocked) { this.onRotate(e.movementX, e.movementY); return; }
        if (this.rmb) {
          this.onRotate(e.clientX - this.lastX, e.clientY - this.lastY);
          this.lastX = e.clientX; this.lastY = e.clientY;
        } else this.onHover(e);
      },
      wheel: (e) => { e.preventDefault(); this.onZoom(Math.sign(e.deltaY)); },
      contextmenu: (e) => e.preventDefault(),
      lockchange: () => { this.pointerLocked = document.pointerLockElement === el; },
    };
    addEventListener('keydown', this.h.keydown);
    addEventListener('keyup', this.h.keyup);
    addEventListener('blur', this.h.blur);
    el.addEventListener('mousedown', this.h.mousedown);
    addEventListener('mouseup', this.h.mouseup);
    addEventListener('mousemove', this.h.mousemove);
    el.addEventListener('wheel', this.h.wheel, { passive: false });
    el.addEventListener('contextmenu', this.h.contextmenu);
    document.addEventListener('pointerlockchange', this.h.lockchange);
    this._bindTouch();
  }

  _bindTouch() {
    const el = this.el;
    this.touches = new Map();
    el.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const stick = t.clientX < innerWidth * 0.4 && t.clientY > innerHeight * 0.45;
        this.touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, stick });
        if (stick && this.stickEl) {
          this.stickEl.style.display = 'block';
          this.stickEl.style.left = t.clientX - 60 + 'px';
          this.stickEl.style.top = t.clientY - 60 + 'px';
        }
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const s = this.touches.get(t.identifier);
        if (!s) continue;
        if (s.stick) {
          let dx = t.clientX - s.x0, dy = t.clientY - s.y0;
          const m = Math.hypot(dx, dy);
          if (m > 50) { dx *= 50 / m; dy *= 50 / m; }
          this.touchMove = { x: dx / 50, y: dy / 50 };
          if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
        } else {
          this.onRotate((t.clientX - s.x) * 1.4, (t.clientY - s.y) * 1.4);
        }
        s.x = t.clientX; s.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const s = this.touches.get(t.identifier);
        if (s && s.stick) {
          this.touchMove = { x: 0, y: 0 };
          if (this.stickEl) this.stickEl.style.display = 'none';
          if (this.knobEl) this.knobEl.style.transform = '';
        } else if (s && Math.hypot(t.clientX - s.x0, t.clientY - s.y0) < 8) {
          this.onClick({ clientX: t.clientX, clientY: t.clientY });
        }
        this.touches.delete(t.identifier);
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  // Movement input in camera space: x = right, y = forward.
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.touchMove.x;
    y -= this.touchMove.y;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  wantsJump() { return this.enabled && (this.jumpPressed || this.touchJump); }

  dispose() {
    removeEventListener('keydown', this.h.keydown);
    removeEventListener('keyup', this.h.keyup);
    removeEventListener('blur', this.h.blur);
    removeEventListener('mouseup', this.h.mouseup);
    removeEventListener('mousemove', this.h.mousemove);
    document.removeEventListener('pointerlockchange', this.h.lockchange);
  }
}
