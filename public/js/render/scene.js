// Keeps a Three.js scene in sync with a DataModel (Workspace parts, lights, effects).
import * as THREE from 'three';
import { createPartMesh, updatePartMesh, applyCFrame } from './parts.js';

function spriteTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (kind === 'star') {
    ctx.translate(32, 32);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -28, 4, 56); }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let TEX = null;
const tex = () => TEX || (TEX = { soft: spriteTexture('soft'), star: spriteTexture('star') });

// A tiny sprite-based particle emitter for Fire / Smoke / Sparkles.
class Emitter {
  constructor(kind, inst) {
    this.kind = kind;
    this.inst = inst;
    this.group = new THREE.Group();
    this.parts = [];
    const n = kind === 'Sparkles' ? 14 : kind === 'Smoke' ? 16 : 22;
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({
        map: kind === 'Sparkles' ? tex().star : tex().soft,
        transparent: true, depthWrite: false,
        blending: kind === 'Smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(m);
      s.userData.life = Math.random();
      this.group.add(s);
      this.parts.push(s);
    }
    this.light = null;
    if (kind === 'Fire') {
      this.light = new THREE.PointLight(0xff8a3c, 2, 14, 1.5);
      this.group.add(this.light);
    }
  }
  update(dt) {
    const p = this.inst._p;
    const enabled = p.Enabled !== false;
    this.group.visible = enabled;
    if (!enabled) return;
    const size = this.kind === 'Fire' ? p.Size : this.kind === 'Smoke' ? p.Size : 1;
    for (const s of this.parts) {
      let life = s.userData.life + dt * (this.kind === 'Smoke' ? 0.35 : this.kind === 'Sparkles' ? 0.6 : 1.1);
      if (life > 1) {
        life -= 1;
        s.userData.ox = (Math.random() - 0.5) * size * 0.4;
        s.userData.oz = (Math.random() - 0.5) * size * 0.4;
        s.userData.a = Math.random() * Math.PI * 2;
      }
      s.userData.life = life;
      const ox = s.userData.ox || 0, oz = s.userData.oz || 0;
      if (this.kind === 'Fire') {
        s.position.set(ox * (1 - life), life * size * 1.4, oz * (1 - life));
        const k = (1 - life) * size * 0.9;
        s.scale.set(k, k, k);
        const c1 = p.Color, c2 = p.SecondaryColor;
        s.material.color.setRGB(c1.R + (c2.R - c1.R) * life, c1.G + (c2.G - c1.G) * life, c1.B + (c2.B - c1.B) * life);
        s.material.opacity = (1 - life) * 0.8;
      } else if (this.kind === 'Smoke') {
        s.position.set(ox + life * 0.5, life * size * 3 * (p.RiseVelocity || 1), oz);
        const k = size * (0.6 + life * 2);
        s.scale.set(k, k, k);
        s.material.color.setRGB(p.Color.R, p.Color.G, p.Color.B);
        s.material.opacity = (1 - life) * p.Opacity;
      } else {
        const a = (s.userData.a || 0) + life * 4;
        s.position.set(Math.cos(a) * 1.4, life * 3 - 0.5, Math.sin(a) * 1.4);
        s.scale.setScalar(0.5 * (1 - life) + 0.2);
        s.material.color.setRGB(p.SparkleColor.R, p.SparkleColor.G, p.SparkleColor.B);
        s.material.opacity = 1 - life;
      }
    }
    if (this.light) this.light.intensity = 1.6 + Math.sin(performance.now() / 70) * 0.4 + Math.random() * 0.3;
  }
  dispose() { for (const s of this.parts) s.material.dispose(); }
}

function textSprite(text, color = '#ffffff', size = 24) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `700 ${size * 2}px "Source Sans Pro", Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  const h = size * 2 + 20;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true });
  const s = new THREE.Sprite(m);
  const scale = size / 24;
  s.scale.set((w / h) * 1.6 * scale, 1.6 * scale, 1);
  return s;
}

const MAX_LIGHTS = 8; // pooled point lights (see SceneSync)

export class SceneSync {
  constructor(game, scene, opts = {}) {
    this.game = game;
    this.scene = scene;
    this.opts = opts;
    this.meshes = new Map(); // inst id -> Object3D
    this.effects = new Map(); // inst id -> {obj, emitter}
    this.root = new THREE.Group();
    scene.add(this.root);
    // PointLights: a place can have dozens, but phones can only shade a few
    // (too many and the game never draws). A fixed pool of real lights goes to
    // the light sources nearest the camera; the count never changes, so shaders
    // aren't rebuilt either.
    this.lightSources = new Set();
    this.lightPool = Array.from({ length: MAX_LIGHTS }, () => { const l = new THREE.PointLight(0xffffff, 0, 1, 1.2); this.root.add(l); return l; });
    this.lightTimer = 0;
    this.unsub = [
      game.on('added', (i) => this.add(i)),
      game.on('removing', (i) => this.remove(i)),
      game.on('changed', (i, p) => this.change(i, p)),
    ];
    this.ws = game.GetService('Workspace');
    for (const d of this.ws.GetDescendants()) this.add(d);
  }

  inWorkspace(inst) { return inst === this.ws || inst.IsDescendantOf(this.ws); }
  skip(inst) { return this.opts.filter ? !this.opts.filter(inst) : false; }

  // Where an effect/light should attach: part mesh, or a custom object (character limb).
  attachTarget(part) {
    if (!part) return null;
    if (this.opts.resolveAttach) {
      const o = this.opts.resolveAttach(part);
      if (o) return o;
    }
    return this.meshes.get(part.id) || null;
  }

  add(inst) {
    if (!this.inWorkspace(inst)) return;
    const cls = inst.ClassName;
    if (inst._p.CFrame && inst._p.Size) {
      if (this.skip(inst)) return;
      if (this.meshes.has(inst.id)) return;
      const mesh = createPartMesh(inst);
      this.meshes.set(inst.id, mesh);
      this.root.add(mesh);
      // Effects parented to this part before it was rendered.
      for (const c of inst._children) if (!this.effects.has(c.id)) this.add(c);
      this.opts.onPartAdded && this.opts.onPartAdded(inst, mesh);
      return;
    }
    const parent = inst._parent;
    if (cls === 'PointLight' || cls === 'SpotLight') {
      const target = this.attachTarget(parent);
      if (!target) return;
      const p = inst._p;
      if (cls === 'PointLight') {
        // just a marker: a pooled light shines here when it's close enough
        const anchor = new THREE.Object3D();
        anchor.userData.light = { color: new THREE.Color(), intensity: 0, distance: 1 };
        target.add(anchor);
        this.effects.set(inst.id, { obj: anchor, pooled: true });
        this.lightSources.add(anchor);
        this.updateLight(inst, anchor);
        this.lightTimer = 0;
        return;
      }
      const light = new THREE.SpotLight(0xffffff, 1, p.Range, (p.Angle * Math.PI) / 360, 0.4, 1.2);
      light.position.set(0, 0, 0); light.target.position.set(0, 0, -1); light.add(light.target);
      target.add(light);
      this.effects.set(inst.id, { obj: light });
      this.updateLight(inst, light);
      return;
    }
    if (cls === 'Fire' || cls === 'Sparkles' || cls === 'Smoke') {
      const target = this.attachTarget(parent);
      if (!target) return;
      const em = new Emitter(cls, inst);
      target.add(em.group);
      this.effects.set(inst.id, { obj: em.group, emitter: em });
      return;
    }
    if (cls === 'BillboardText') {
      const target = this.attachTarget(parent);
      if (!target) return;
      const p = inst._p;
      const s = textSprite(p.Text, '#' + p.TextColor3.toHex().slice(1), p.TextSize);
      s.position.set(p.StudsOffset.X, p.StudsOffset.Y, p.StudsOffset.Z);
      s.visible = p.Enabled;
      target.add(s);
      this.effects.set(inst.id, { obj: s });
      return;
    }
    if (cls === 'Explosion') {
      this.explode(inst);
    }
    this.opts.onOther && this.opts.onOther(inst, true);
  }

  updateLight(inst, light) {
    const p = inst._p;
    if (light.userData.light) { // a pooled PointLight's settings
      const d = light.userData.light;
      d.color.setRGB(p.Color.R, p.Color.G, p.Color.B);
      d.intensity = p.Enabled ? p.Brightness * 6 : 0;
      d.distance = p.Range * 1.5;
      this.lightTimer = 0;
      return;
    }
    light.color.setRGB(p.Color.R, p.Color.G, p.Color.B);
    light.intensity = p.Enabled ? p.Brightness * 6 : 0;
    light.distance = p.Range * 1.5;
  }

  remove(inst) {
    const m = this.meshes.get(inst.id);
    if (m) {
      m.removeFromParent();
      this.meshes.delete(inst.id);
      this.opts.onPartRemoved && this.opts.onPartRemoved(inst, m);
    }
    const e = this.effects.get(inst.id);
    if (e) {
      if (e.pooled) { this.lightSources.delete(e.obj); this.lightTimer = 0; }
      e.obj.removeFromParent();
      if (e.emitter) e.emitter.dispose();
      this.effects.delete(inst.id);
    }
    this.opts.onOther && this.opts.onOther(inst, false);
  }

  change(inst, prop) {
    const m = this.meshes.get(inst.id);
    if (m) { updatePartMesh(m, inst, prop); this.opts.onPartChanged && this.opts.onPartChanged(inst, m, prop); return; }
    const e = this.effects.get(inst.id);
    if (e) {
      if (inst.ClassName === 'PointLight' || inst.ClassName === 'SpotLight') this.updateLight(inst, e.obj);
      else if (inst.ClassName === 'BillboardText') {
        const parent = e.obj.parent;
        this.remove(inst);
        if (parent) this.add(inst);
      }
      return;
    }
    if (inst.ClassName === 'Lighting' || inst.ClassName === 'Hint' || inst.ClassName === 'Message') this.opts.onOther && this.opts.onOther(inst, true, prop);
  }

  explode(inst) {
    const p = inst._p;
    if (!p.Visible) return;
    const g = new THREE.Group();
    g.position.set(p.Position.X, p.Position.Y, p.Position.Z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(ball);
    const light = new THREE.PointLight(0xffaa55, 30, p.BlastRadius * 6, 1.5);
    g.add(light);
    const sparks = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex().soft, color: i % 3 ? 0xff7a1a : 0xfff0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(p.BlastRadius * (1.5 + Math.random() * 2));
      s.userData.v = v;
      g.add(s);
      sparks.push(s);
    }
    this.scene.add(g);
    const r = Math.max(2, p.BlastRadius);
    let t = 0;
    const anim = { update: (dt) => {
      t += dt;
      const k = t / 0.8;
      ball.scale.setScalar(r * (0.3 + k * 1.2));
      ball.material.opacity = Math.max(0, 0.9 - k);
      light.intensity = Math.max(0, 30 * (1 - k * 1.5));
      for (const s of sparks) {
        s.position.addScaledVector(s.userData.v, dt);
        s.userData.v.y -= 20 * dt;
        s.scale.setScalar(2 * (1 - k));
        s.material.opacity = Math.max(0, 1 - k);
      }
      return k < 1;
    } };
    this.anims = this.anims || [];
    this.anims.push({ anim, g });
    this.opts.onExplosion && this.opts.onExplosion(inst);
  }

  // Gives the pooled lights to the light sources nearest `camera` (a few times a second).
  assignLights(camera) {
    const at = new THREE.Vector3();
    const cam = camera ? camera.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const near = [];
    for (const a of this.lightSources) {
      if (!a.userData.light.intensity) continue;
      a.getWorldPosition(at);
      near.push({ a, pos: at.clone(), d: at.distanceToSquared(cam) });
    }
    near.sort((x, y) => x.d - y.d);
    this.lightPool.forEach((l, i) => {
      const n = near[i];
      if (!n) { l.intensity = 0; return; }
      const d = n.a.userData.light;
      l.position.copy(n.pos);
      l.color.copy(d.color);
      l.intensity = d.intensity;
      l.distance = d.distance;
    });
  }

  update(dt, camera) {
    this.lightTimer -= dt;
    if (this.lightTimer <= 0 && this.lightSources.size) { this.lightTimer = 0.25; this.assignLights(camera); }
    for (const e of this.effects.values()) if (e.emitter) e.emitter.update(dt);
    if (this.anims) {
      this.anims = this.anims.filter(({ anim, g }) => {
        const alive = anim.update(dt);
        if (!alive) { g.removeFromParent(); g.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); }); }
        return alive;
      });
    }
  }

  meshFor(inst) { return this.meshes.get(inst.id); }

  dispose() {
    for (const u of this.unsub) u();
    this.root.removeFromParent();
    for (const e of this.effects.values()) { e.obj.removeFromParent(); if (e.emitter) e.emitter.dispose(); }
    this.meshes.clear();
    this.effects.clear();
  }
}

export { applyCFrame };
