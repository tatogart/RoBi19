// Studio 3D viewport: fly camera, selection, move/scale/rotate gizmos.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CFrame, Vector3 } from '/shared/engine/types.js';
import { BasePart } from '/shared/engine/instances.js';
import { SceneSync } from '../render/scene.js';
import { Environment } from '../render/sky.js';

const tmpM = new THREE.Matrix4();

function cframeToMatrix(cf) {
  const r = cf.r;
  return new THREE.Matrix4().set(r[0], r[1], r[2], cf.x, r[3], r[4], r[5], cf.y, r[6], r[7], r[8], cf.z, 0, 0, 0, 1);
}
function matrixToCFrame(m) {
  const e = m.elements; // column-major
  // Remove any scale that crept in.
  const sx = Math.hypot(e[0], e[1], e[2]) || 1, sy = Math.hypot(e[4], e[5], e[6]) || 1, sz = Math.hypot(e[8], e[9], e[10]) || 1;
  return new CFrame(e[12], e[13], e[14], [e[0] / sx, e[4] / sy, e[8] / sz, e[1] / sx, e[5] / sy, e[9] / sz, e[2] / sx, e[6] / sy, e[10] / sz]);
}

export class Viewport {
  constructor(studio, el) {
    this.studio = studio;
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    el.append(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 10000);
    this.camera.position.set(20, 22, 30);
    this.yaw = Math.atan2(20, 30);
    this.pitch = -0.45;
    this.env = new Environment(this.scene, this.renderer);
    this.keys = new Set();
    this.selHelpers = new THREE.Group();
    this.scene.add(this.selHelpers);
    this.raycaster = new THREE.Raycaster();
    this.moveSnap = 1;
    this.rotateSnap = 15;
    this.snapEnabled = true;
    this.space = 'world';
    this.tool = 'select';

    // Gizmo
    this.proxy = new THREE.Object3D();
    this.scene.add(this.proxy);
    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmo.setSize(0.9);
    this.gizmoHelper = this.gizmo.getHelper();
    this.scene.add(this.gizmoHelper);
    this.gizmo.addEventListener('dragging-changed', (e) => this.onDragging(e.value));
    this.gizmo.addEventListener('objectChange', () => this.onGizmoChange());

    this.hud = document.createElement('div');
    this.hud.className = 'view-hud';
    el.append(this.hud);
    this._bind();
    // phones turning (Safari reports the new size late): check a few times
    const settle = () => { this.resize(); for (const ms of [120, 350, 800]) setTimeout(() => this.resize(), ms); };
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    if (this.ro) this.ro.observe(el);
    addEventListener('orientationchange', settle);
    if (window.visualViewport) visualViewport.addEventListener('resize', settle);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  setGame(game) {
    if (this.sync) this.sync.dispose();
    this.game = game;
    this.sync = new SceneSync(game, this.scene);
    this.env.apply(game.GetService('Lighting'));
    if (this.unsub) this.unsub();
    this.unsub = game.on('changed', (inst, prop) => {
      if (inst.ClassName === 'Lighting') this.env.apply(inst);
      if (!this.dragging && this.studio.isSelected(inst)) this.updateGizmo();
    });
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ input
  _bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => {
      c.focus();
      if (e.button === 2) { this.looking = true; this.lx = e.clientX; this.ly = e.clientY; this.moved = 0; }
      if (e.button === 1) { this.panning = true; this.lx = e.clientX; this.ly = e.clientY; e.preventDefault(); }
      if (e.button === 0) { this.downX = e.clientX; this.downY = e.clientY; }
    });
    addEventListener('mousemove', (e) => {
      if (this.looking) {
        const dx = e.clientX - this.lx, dy = e.clientY - this.ly;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.yaw -= dx * 0.005;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.005));
        this.lx = e.clientX; this.ly = e.clientY;
      } else if (this.panning) {
        const dx = e.clientX - this.lx, dy = e.clientY - this.ly;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        this.camera.position.addScaledVector(right, -dx * 0.08).addScaledVector(up, dy * 0.08);
        this.lx = e.clientX; this.ly = e.clientY;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2 && this.looking) {
        this.looking = false;
        if (this.moved < 4) this.studio.contextMenu(e.clientX, e.clientY, this.studio.selection[0] || null);
      }
      if (e.button === 1) this.panning = false;
      if (e.button === 0 && e.target === c && this.downX !== undefined && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) < 4 && !this.gizmoWasUsed) {
        this.pick(e);
      }
      this.gizmoWasUsed = false;
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = this.pointerRay(e).direction;
      this.camera.position.addScaledVector(dir, -Math.sign(e.deltaY) * (e.shiftKey ? 1 : 5));
    }, { passive: false });
    this._bindTouch();
    c.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey) this.keys.add(e.code); });
    c.addEventListener('keyup', (e) => this.keys.delete(e.code));
    c.addEventListener('blur', () => this.keys.clear());
  }

  // ------------------------------------------------------------ phones
  // One finger: look around (drag) or pick (tap); hold: the context menu.
  // Two fingers: pinch to move closer, drag to pan. The move gizmo still
  // works with a finger (TransformControls listens to pointer events).
  _bindTouch() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    // no fake mouse events after a touch (they would pick twice)
    c.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const pts = new Map();
    let one = null, two = null, hold = 0;
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      c.focus({ preventScroll: true });
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        one = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0, gizmo: this.gizmo.dragging || this.gizmo.axis !== null };
        clearTimeout(hold);
        hold = setTimeout(() => {
          // long press: pick what's under the finger and open the menu
          if (!one || one.moved > 8 || one.gizmo || this.gizmo.dragging) return;
          const ev = { clientX: one.x, clientY: one.y, shiftKey: false, ctrlKey: false, altKey: false };
          this.pick(ev);
          this.studio.contextMenu(one.x, one.y, this.studio.selection[0] || null);
          one.done = true;
        }, 550);
      } else if (pts.size === 2) { clearTimeout(hold); one = null; two = mid(); }
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.gizmo.dragging) return;
      if (pts.size === 1 && one && !one.gizmo) {
        const dx = e.clientX - one.lx, dy = e.clientY - one.ly;
        one.moved += Math.abs(dx) + Math.abs(dy);
        if (one.moved > 6) {
          this.yaw -= dx * 0.006;
          this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.006));
        }
        one.lx = e.clientX; one.ly = e.clientY;
      } else if (pts.size === 2 && two) {
        const m = mid();
        const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.addScaledVector(fwd, (m.d - two.d) * 0.12);
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        this.camera.position.addScaledVector(right, -(m.x - two.x) * 0.06).addScaledVector(up, (m.y - two.y) * 0.06);
        two = m;
      }
    });
    const end = (e) => {
      if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      clearTimeout(hold);
      if (one && pts.size === 0) {
        // a quick tap picks (unless it was the gizmo)
        if (!one.done && one.moved <= 8 && !one.gizmo && !this.gizmoWasUsed && performance.now() - one.t < 500) {
          this.pick({ clientX: one.x, clientY: one.y, shiftKey: false, ctrlKey: false, altKey: false });
        }
        this.gizmoWasUsed = false;
        one = null;
      }
      if (pts.size < 2) two = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  pointerRay(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray;
  }

  // Returns the first part under the pointer (skipping locked parts when requested).
  hitTest(e, skipLocked = true) {
    this.pointerRay(e);
    const hits = this.raycaster.intersectObjects(this.sync.root.children, false);
    for (const h of hits) {
      const inst = h.object.userData.inst;
      if (!inst) continue;
      if (skipLocked && inst._p.Locked) return { locked: true, point: h.point, inst };
      return { inst, point: h.point, normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0) };
    }
    return null;
  }

  pick(e) {
    const hit = this.hitTest(e);
    const s = this.studio;
    if (!hit || hit.locked) { if (!e.shiftKey && !e.ctrlKey) s.setSelection([]); return; }
    let target = hit.inst;
    if (!e.altKey) {
      // Select the top-level model under Workspace (like Studio).
      for (let a = target._parent; a && a.ClassName !== 'Workspace'; a = a._parent) if (a.ClassName === 'Model') target = a;
    }
    if (e.shiftKey || e.ctrlKey) s.toggleSelection(target); else s.setSelection([target]);
    s.explorer.scrollTo(target);
  }

  // Point in front of the camera where new objects get inserted.
  insertPoint() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.sync.root.children, false);
    if (hits.length && hits[0].distance < 300) {
      const n = hits[0].face ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      return { point: hits[0].point, normal: n };
    }
    const p = this.camera.position.clone().addScaledVector(this.raycaster.ray.direction, 25);
    return { point: p, normal: new THREE.Vector3(0, 1, 0) };
  }

  focusSelection() {
    const box = this.selectionBox();
    if (!box) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(4, box.getSize(new THREE.Vector3()).length());
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.position.copy(c).addScaledVector(dir, r * 1.2);
  }

  // ------------------------------------------------------------ selection & gizmo
  partsOf(inst) {
    if (inst instanceof BasePart) return [inst];
    return inst.GetDescendants().filter((d) => d instanceof BasePart);
  }

  selectionBox() {
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    for (const s of this.studio.selection) {
      for (const p of this.partsOf(s)) {
        const m = this.sync.meshFor(p);
        if (m) { tmp.setFromObject(m); box.union(tmp); }
      }
    }
    return box.isEmpty() ? null : box;
  }

  onSelectionChanged() {
    this.selHelpers.clear();
    for (const s of this.studio.selection) {
      const parts = this.partsOf(s);
      if (!parts.length) continue;
      if (s instanceof BasePart) {
        const m = this.sync.meshFor(s);
        if (m) { const h = new THREE.BoxHelper(m, 0x1a9fff); h.userData.target = m; this.selHelpers.add(h); }
      } else {
        const h = new THREE.Box3Helper(new THREE.Box3(), 0x1a9fff);
        h.userData.model = s;
        this.selHelpers.add(h);
      }
    }
    this.updateGizmo();
  }

  setTool(tool) {
    this.tool = tool;
    this.updateGizmo();
  }

  updateGizmo() {
    const sel = this.studio.selection.filter((s) => this.partsOf(s).length && !s.constructor.service);
    const tool = this.tool;
    if (!sel.length || tool === 'select' || this.studio.playing || (tool === 'scale' && !(sel.length === 1 && sel[0] instanceof BasePart))) {
      this.gizmo.detach();
      return;
    }
    const mode = { move: 'translate', scale: 'scale', rotate: 'rotate' }[tool];
    this.gizmo.setMode(mode);
    this.gizmo.setSpace(tool === 'scale' ? 'local' : this.space);
    this.gizmo.setTranslationSnap(this.snapEnabled ? this.moveSnap : null);
    this.gizmo.setRotationSnap(this.snapEnabled ? THREE.MathUtils.degToRad(this.rotateSnap) : null);
    this.gizmo.setScaleSnap(null);
    if (sel.length === 1 && sel[0] instanceof BasePart) {
      const m = cframeToMatrix(sel[0].CFrame);
      m.decompose(this.proxy.position, this.proxy.quaternion, this.proxy.scale);
    } else {
      const box = this.selectionBox();
      box.getCenter(this.proxy.position);
      this.proxy.quaternion.identity();
    }
    this.proxy.scale.set(1, 1, 1);
    this.proxy.updateMatrixWorld();
    if (this.gizmo.object !== this.proxy) this.gizmo.attach(this.proxy);
  }

  onDragging(on) {
    this.dragging = on;
    if (on) {
      this.gizmoWasUsed = true;
      this.proxy.updateMatrixWorld();
      this.startProxy = this.proxy.matrixWorld.clone();
      this.startParts = [];
      for (const s of this.studio.selection) for (const p of this.partsOf(s)) this.startParts.push([p, cframeToMatrix(p.CFrame), p.Size]);
    } else {
      this.gizmoWasUsed = true;
      this.studio.commit(this.tool === 'move' ? 'Move' : this.tool === 'rotate' ? 'Rotate' : 'Resize');
      this.updateGizmo();
    }
  }

  onGizmoChange() {
    if (!this.dragging || !this.startParts) return;
    this.proxy.updateMatrixWorld();
    if (this.tool === 'scale') {
      const [p, m0, size0] = this.startParts[0];
      const s = this.proxy.scale;
      const snap = this.snapEnabled ? this.moveSnap : 0.01;
      const q = (v) => Math.max(0.2, Math.round(v / snap) * snap || snap);
      const newSize = new Vector3(q(size0.X * Math.abs(s.x)), q(size0.Y * Math.abs(s.y)), q(size0.Z * Math.abs(s.z)));
      p.Size = newSize;
      p.CFrame = matrixToCFrame(m0);
      return;
    }
    const delta = tmpM.copy(this.proxy.matrixWorld).multiply(this.startProxy.clone().invert());
    for (const [p, m0] of this.startParts) {
      const m = delta.clone().multiply(m0);
      p.CFrame = matrixToCFrame(m);
    }
  }

  // ------------------------------------------------------------ frame
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.game || this.studio.playing || !this.el.offsetParent) return;
    // Fly camera
    const k = this.keys;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 8 : 40) * dt;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const typing = document.activeElement !== this.canvas;
    if (!typing) {
      if (k.has('KeyW')) this.camera.position.addScaledVector(fwd, speed);
      if (k.has('KeyS')) this.camera.position.addScaledVector(fwd, -speed);
      if (k.has('KeyA')) this.camera.position.addScaledVector(right, -speed);
      if (k.has('KeyD')) this.camera.position.addScaledVector(right, speed);
      if (k.has('KeyE')) this.camera.position.y += speed;
      if (k.has('KeyQ')) this.camera.position.y -= speed;
    }
    this.camera.lookAt(this.camera.position.clone().add(fwd));
    for (const h of this.selHelpers.children) {
      if (h.userData.target) h.update();
      else if (h.userData.model) {
        const b = new THREE.Box3();
        const t = new THREE.Box3();
        for (const p of this.partsOf(h.userData.model)) { const m = this.sync.meshFor(p); if (m) { t.setFromObject(m); b.union(t); } }
        h.box.copy(b);
      }
    }
    this.env.setFocus(this.camera.position.clone().addScaledVector(fwd, 40));
    this.env.update(dt, this.camera);
    this.sync.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
    const p = this.camera.position;
    this.hud.textContent = `Camera ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`;
  }
}

export { cframeToMatrix, matrixToCFrame };
