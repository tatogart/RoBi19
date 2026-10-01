// The Robis game client: connects to a game server, mirrors its world,
// renders it, and simulates the local character.
import * as THREE from 'three';
import { Vector3, CFrame } from '/shared/engine/types.js';
import { stepCharacter } from '/shared/engine/physics.js';
import { SceneSync } from '../render/scene.js';
import { Environment } from '../render/sky.js';
import { Mirror } from './mirror.js';
import { CollisionWorld } from './world.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { HUD } from './ui.js';
import { CharacterView } from './characters.js';
import * as sound from './sound.js';

const SEND_HZ = 20;
const SETTINGS_KEY = 'robis.settings';

export class GameClient {
  constructor(container, opts = {}) {
    this.opts = opts;
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = 'game-root' + (opts.embedded ? ' embedded' : '');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view';
    this.canvas.tabIndex = 0;
    this.root.append(this.canvas);
    container.append(this.root);

    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    // Phones get lighter graphics by default (sharper settings are one tap away in the menu).
    this.settings = { quality: this.isTouch ? 'Medium' : 'High', sensitivity: 1, volume: 0.6, shiftLockEnabled: true, showFps: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
    sound.setVolume(this.settings.volume);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 10000);
    this.env = new Environment(this.scene, this.renderer);
    this.setQuality(this.settings.quality);

    this.cam = new FollowCamera(this.camera, null);
    this.cam.sensitivity = this.settings.sensitivity;
    this.input = new Input(this.canvas, {
      onRotate: (dx, dy) => this.cam.rotate(dx, dy),
      onZoom: (s) => this.cam.zoomBy(s),
      onKey: (e) => this.onKey(e),
      onClick: (e) => this.onClick(e),
      onHover: (e) => this.onHover(e),
    });
    this.hud = new HUD(this.root, this);

    this.views = new Map(); // userId -> CharacterView
    this.playerInfos = new Map();
    this.local = null; // local physics state
    this.userId = null;
    this.running = false;
    this.lastSend = 0;
    this.raycaster = new THREE.Raycaster();
    this._resize = () => this.resize();
    this.ro = new ResizeObserver(this._resize);
    this.ro.observe(this.root);
    this.frames = 0;
    this.fpsTime = 0;
  }

  // ------------------------------------------------------------ lifecycle
  start() {
    const { gameInfo } = this.opts;
    this.hud.showLoading(gameInfo?.name || 'Robis', gameInfo?.creator?.username);
    this.hud.setLoadingStatus('Connecting to server...');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      this.hud.setLoadingStatus('Joining game...');
      const msg = { t: 'join', placeId: this.opts.placeId || 0 };
      if (this.opts.serverId) msg.serverId = this.opts.serverId;
      if (this.opts.testPlace) msg.test = this.opts.testPlace;
      this.ws.send(JSON.stringify(msg));
    };
    this.ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.handle(m);
    };
    this.ws.onclose = () => {
      if (this.stopped || this.closedByServer) return;
      this.hud.hideLoading();
      this.hud.dialog('Disconnected', 'Lost connection to the game server, please reconnect (Error Code: 277)', [
        { text: 'Leave', onClick: () => this.leave() },
        { text: 'Reconnect', primary: true, onClick: () => this.reconnect() },
      ]);
    };
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  reconnect() {
    if (this.opts.embedded) { this.leave(); return; }
    location.reload();
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  leave() {
    this.stop();
    if (this.opts.onExit) this.opts.onExit();
    else location.href = this.opts.placeId ? `/game?id=${this.opts.placeId}` : '/home';
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.running = false;
    try { this.ws && this.ws.close(); } catch { /* ignore */ }
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.dispose();
    this.ro.disconnect();
    for (const v of this.views.values()) v.dispose();
    if (this.sync) this.sync.dispose();
    if (this.world) this.world.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.root.remove();
  }

  saveSettings() {
    this.settings.sensitivity = this.cam.sensitivity;
    this.settings.volume = sound.getVolume();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  setQuality(q) {
    this.settings.quality = q;
    const pr = q === 'Low' ? 0.75 : q === 'Medium' ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'Low';
    this.env.sun.castShadow = q !== 'Low';
    const size = q === 'High' ? 2048 : 1024;
    if (this.env.sun.shadow.mapSize.x !== size) {
      this.env.sun.shadow.mapSize.set(size, size);
      if (this.env.sun.shadow.map) { this.env.sun.shadow.map.dispose(); this.env.sun.shadow.map = null; }
    }
    this.resize();
  }

  // Slow device? Lower the graphics once (after the world has settled), so the game stays playable.
  autoQuality(fps) {
    if (!this.game || this.local === null || document.hidden) { this._slow = 0; return; }
    this._played = (this._played || 0) + 0.5;
    if (this._played < 8 || this._autoLowered) return;
    this._slow = fps < 24 ? (this._slow || 0) + 1 : 0;
    if (this._slow >= 8 && this.settings.quality !== 'Low') {
      const next = this.settings.quality === 'High' ? 'Medium' : 'Low';
      this.setQuality(next);
      this.saveSettings();
      this._autoLowered = true;
      this.hud.addChat('', `Graphics lowered to ${next} to keep the game smooth (change it in the menu).`, { system: true });
    }
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ networking
  handle(m) {
    switch (m.t) {
      case 'welcome': return this.onWelcome(m);
      case 'tick':
        for (const op of m.ops) this.applyOp(op);
        for (const [uid, p, ry, a] of m.st) { const v = this.views.get(uid); if (v && !v.dead) v.setState(p, ry, a); }
        return;
      case 'playerJoined': this.addPlayer(m.player); return;
      case 'playerLeft': {
        const v = this.views.get(m.userId);
        if (v) { v.dispose(); this.views.delete(m.userId); }
        this.playerInfos.delete(m.userId);
        return;
      }
      case 'chat': {
        this.hud.addChat(m.name, m.text, { flags: this.playerInfos.get(m.userId)?.flags });
        const v = this.views.get(m.userId);
        if (v) v.bubble(m.text);
        return;
      }
      case 'sys': this.hud.addChat('', m.text, { system: true }); this.hud.log({ level: 'info', text: m.text }); return;
      case 'emote': { const v = this.views.get(m.userId); if (v) v.emote(m.emote); return; }
      case 'teleport': {
        if (this.local) {
          const [x, y, z] = m.cf;
          Object.assign(this.local, { x, y, z, vx: 0, vy: 0, vz: 0 });
        }
        return;
      }
      case 'drive':
        this.vehicle = m.on ? { max: +m.max || 60, turn: +m.turn || 2.2, color: m.color || '#c4281c', speed: 0 } : null;
        if (m.on && Number.isFinite(m.ry)) { const v = this.views.get(this.userId); if (v) v.ry = m.ry; this.cam.yaw = m.ry; }
        this.input.jumpTap = false;
        if (m.on) this.hud.addChat('', 'You are driving! WASD / joystick to steer, Space or Jump to get out.', { system: true });
        return;
      case 'impulse': if (this.local) { this.local.vx += m.v[0]; this.local.vy = m.v[1]; this.local.vz += m.v[2]; this.local.grounded = false; } return;
      case 'output':
        if (this.opts.onOutput) this.opts.onOutput(m); else this.hud.log(m);
        return;
      case 'kick':
        this.closedByServer = true;
        this.hud.hideLoading();
        this.hud.dialog('Disconnected', `You were kicked from this game: ${m.msg} (Error Code: 267)`, [{ text: 'Leave', primary: true, onClick: () => this.leave() }]);
        return;
      case 'shutdown':
        this.closedByServer = true;
        this.hud.dialog('Disconnected', `${m.msg} (Error Code: 288)`, [{ text: 'Leave', primary: true, onClick: () => this.leave() }]);
        return;
      case 'error':
        this.closedByServer = true;
        this.hud.hideLoading();
        this.hud.dialog('Unable to join', m.msg, [{ text: 'Leave', primary: true, onClick: () => this.leave() }]);
        return;
      default:
    }
  }

  onWelcome(m) {
    this.serverId = m.serverId;
    if (this.opts.onWelcome) setTimeout(() => this.opts.onWelcome(m));
    this.userId = m.userId;
    this.isDeveloper = m.isDeveloper;
    this.hud.setLoadingName(m.name, this.opts.gameInfo?.creator?.username);
    this.hud.setLoadingStatus('Loading world...');
    this.mirror = new Mirror();
    this.mirror.loadSnapshot(m.snapshot);
    const game = this.game = this.mirror.game;
    this.world = new CollisionWorld(game);
    this.cam.world = this.world;
    this.sync = new SceneSync(game, this.scene, {
      filter: (i) => !(i._parent && i._parent._isCharacter),
      resolveAttach: (part) => this.limbFor(part),
      onOther: (inst, added, prop) => this.onOther(inst, added, prop),
      onExplosion: (inst) => {
        const d = this.local ? Math.hypot(inst._p.Position.X - this.local.x, inst._p.Position.Z - this.local.z) : 50;
        if (d < 200) sound.explosion();
      },
    });
    game.on('changed', (inst, prop) => this.onMirrorChanged(inst, prop));
    this.env.apply(game.GetService('Lighting'));
    for (const p of m.players) this.addPlayer(p);
    for (const [uid, modelId] of m.chars) {
      const v = this.views.get(uid);
      if (v) { v.modelId = modelId; this.attachCharacterExtras(v); }
    }
    for (const l of m.logs || []) this.handle({ t: 'output', ...l });
    this.hud.addChat('', `Welcome to ${m.name}! Press / to chat.`, { system: true });
    setTimeout(() => this.hud.hideLoading(), this.local ? 300 : 1500);
    this.boardTimer = 0;
  }

  addPlayer(info) {
    this.playerInfos.set(info.userId, info);
    if (this.views.has(info.userId)) return;
    const v = new CharacterView(this.scene, this.hud.tags, info, info.userId === this.userId);
    this.views.set(info.userId, v);
  }

  applyOp(op) {
    switch (op[0]) {
      case 'char': return this.onChar(op[1], op[2], op[3]);
      case 'died': return this.onDied(op[1]);
      case 'bubble': {
        const part = this.game.getById(op[1]);
        if (part && part._parent && part._parent._isCharacter) {
          const v = this.viewForModel(part._parent);
          if (v) v.bubble(op[2]);
        }
        return;
      }
      default: this.mirror.apply(op);
    }
  }

  viewForModel(model) {
    for (const v of this.views.values()) if (v.modelId === model.id) return v;
    return null;
  }

  limbFor(part) {
    const model = part._parent;
    if (!model || !model._isCharacter) return null;
    const v = this.viewForModel(model);
    if (!v) return null;
    return v.av.limbs[part.Name === 'HumanoidRootPart' ? 'Torso' : part.Name] || v.av.limbs.Torso;
  }

  attachCharacterExtras(v) {
    const model = this.game.getById(v.modelId);
    if (!model) return;
    v.setForceField(!!model.FindFirstChildOfClass('ForceField'));
    for (const d of model.GetDescendants()) if (!d._p.CFrame) this.sync.add(d);
    for (const d of model.GetChildren()) {
      if (d._p.Color && v.av.limbs[d.Name] && d.Name !== 'HumanoidRootPart') {
        const bc = this.playerInfos.get(v.userId)?.avatar?.bodyColors || {};
        const key = { Head: 'head', Torso: 'torso', 'Left Arm': 'leftArm', 'Right Arm': 'rightArm', 'Left Leg': 'leftLeg', 'Right Leg': 'rightLeg' }[d.Name];
        if (key && bc[key] && d._p.Color.toHex() !== bc[key]) v.setLimbColor(d.Name, d._p.Color);
        if (d._p.Transparency > 0) v.setLimbTransparency(d.Name, d._p.Transparency);
      }
    }
  }

  onChar(userId, modelId, cf) {
    const v = this.views.get(userId);
    if (!v) return;
    v.modelId = modelId;
    v.spawn(cf);
    this.attachCharacterExtras(v);
    if (userId === this.userId) {
      this.local = { x: cf[0], y: cf[1], z: cf[2], vx: 0, vy: 0, vz: 0, grounded: false, groundPart: null, ry: v.ry };
      this.cam.yaw = v.ry;
      this.cam.focus.set(cf[0], cf[1] + 1.5, cf[2]);
      this.hud.hideLoading();
    }
  }

  onDied(userId) {
    const v = this.views.get(userId);
    if (!v) return;
    const groundY = (userId === this.userId && this.local ? this.local.y : v.pos.y) - 3;
    v.die(groundY);
    if (userId === this.userId) {
      sound.oof();
      this.localDead = true;
    } else if (this.local && v.pos.distanceTo(new THREE.Vector3(this.local.x, this.local.y, this.local.z)) < 80) sound.oof();
  }

  onMirrorChanged(inst, prop) {
    // Script-driven changes to character limbs (paint, invisibility).
    const model = inst._parent;
    if (model && model._isCharacter && (prop === 'Color' || prop === 'Transparency') && inst.Name !== 'HumanoidRootPart') {
      const v = this.viewForModel(model);
      if (v) { if (prop === 'Color') v.setLimbColor(inst.Name, inst._p.Color); else v.setLimbTransparency(inst.Name, inst._p.Transparency); }
    }
  }

  onOther(inst, added, prop) {
    const cls = inst.ClassName;
    if (cls === 'Lighting') { this.env.apply(inst); return; }
    if (cls === 'ForceField' && inst._parent && inst._parent._isCharacter) {
      const v = this.viewForModel(inst._parent);
      if (v) v.setForceField(added);
    }
    if (cls === 'Hint' || cls === 'Message') this.hintsDirty = true;
  }

  refreshHints() {
    let hint = '', msg = '';
    const walk = (i) => {
      for (const c of i._children) {
        if (c.ClassName === 'Hint' && c._p.Text && !hint) hint = c._p.Text;
        else if (c.ClassName === 'Message' && c._p.Text && !msg) msg = c._p.Text;
        if (c._children.length && !(c._p.CFrame)) walk(c);
      }
    };
    walk(this.game.GetService('Workspace'));
    this.hud.setHint(hint);
    this.hud.setMessage(msg);
  }

  // ------------------------------------------------------------ input
  onKey(e) {
    const hud = this.hud;
    if (e.code === 'Escape') { hud.toggleMenu(); return false; }
    if (hud.menuOpen) {
      if (e.code === 'KeyR') { hud.confirmReset(); return false; }
      if (e.code === 'KeyL') { hud.confirmLeave(); return false; }
      if (e.code === 'Enter' && hud.pendingConfirm) { hud.pendingConfirm.click(); return false; }
      return false;
    }
    if (e.code === 'Slash' || (e.key === '/' && !e.repeat)) { hud.focusChat(); return false; }
    if (e.code === 'Tab') { hud.toggleBoard(); return false; }
    if (e.code === 'F9') { hud.toggleConsole(); return false; }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) { this.toggleShiftLock(); return true; }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit && !e.repeat) { this.equipSlot(+digit[1] - 1); return false; }
    sound.unlock();
    return true;
  }

  toggleShiftLock() {
    if (!this.settings.shiftLockEnabled) return;
    this.cam.shiftLock = !this.cam.shiftLock;
    this.hud.lockBtn.classList.toggle('on', this.cam.shiftLock);
    if (this.cam.shiftLock) this.canvas.requestPointerLock?.();
    else if (document.pointerLockElement && !this.cam.firstPerson) document.exitPointerLock();
  }

  async toggleFullscreen() {
    const d = document;
    const el = this.opts.embedded ? this.root : d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        await (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else {
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
        // Games play best in landscape; not every browser allows locking.
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }
    } catch { /* not supported (e.g. iPhone Safari) */ }
    setTimeout(() => this.resize(), 300);
  }

  resetCharacter() { this.send({ t: 'reset' }); }

  sendChat(text) { this.send({ t: 'chat', text }); }

  pickPart(clientX, clientY) {
    if (!this.sync) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    if (document.pointerLockElement) ndc.set(0, 0);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.sync.root.children, false);
    for (const h of hits) {
      const inst = h.object.userData.inst;
      if (!inst || inst._p.Transparency >= 1) continue;
      return { inst, point: h.point };
    }
    return null;
  }

  clickDetectorFor(inst) {
    return inst.FindFirstChildOfClass('ClickDetector') || (inst._parent && inst._parent.FindFirstChildOfClass && inst._parent.ClassName === 'Model' ? inst._parent.FindFirstChildOfClass('ClickDetector') : null);
  }

  onClick(e) {
    sound.unlock();
    if (this.cam.firstPerson && !document.pointerLockElement) this.canvas.requestPointerLock?.();
    if (this.equippedTool()) {
      // Mouse: fired on mouse down (see frame); taps on phones fire here.
      if (e.touch !== false && !e.button && this.isTouch && !this._mouseFired) this.useTool(e.clientX, e.clientY);
      this._mouseFired = false;
      return;
    }
    const hit = this.pickPart(e.clientX, e.clientY);
    if (!hit) return;
    const cd = this.clickDetectorFor(hit.inst);
    if (cd && this.local && hit.point.distanceTo(new THREE.Vector3(this.local.x, this.local.y, this.local.z)) <= cd._p.MaxActivationDistance + 4) {
      sound.click();
      this.send({ t: 'click', id: hit.inst.id });
    }
  }

  onHover(e) {
    if (this._hoverT && performance.now() - this._hoverT < 60) return;
    this._hoverT = performance.now();
    const hit = this.pickPart(e.clientX, e.clientY);
    this.root.classList.toggle('hover-click', !!(hit && this.clickDetectorFor(hit.inst)));
  }

  // ------------------------------------------------------------ tools
  myPlayer() {
    if (!this.game) return null;
    return this.game.GetService('Players').GetChildren().find((p) => p._p.UserId === this.userId) || null;
  }
  myCharacter() {
    const v = this.views.get(this.userId);
    return v && v.modelId && this.game ? this.game.getById(v.modelId) : null;
  }
  backpackTools() {
    const bp = this.myPlayer()?.FindFirstChild('Backpack');
    const eq = this.equippedTool();
    const list = bp ? bp.GetChildren().filter((t) => t.ClassName === 'Tool') : [];
    // Keep slot order stable: equipping moves a tool out of the Backpack.
    this._slots = (this._slots || []).filter((id) => (eq && eq.id === id) || list.some((t) => t.id === id));
    for (const t of [eq, ...list]) if (t && !this._slots.includes(t.id)) this._slots.push(t.id);
    return this._slots.map((id) => this.game.getById(id)).filter(Boolean);
  }
  equippedTool() {
    const ch = this.myCharacter();
    return ch ? ch.GetChildren().find((t) => t.ClassName === 'Tool') || null : null;
  }
  equipSlot(i) {
    const tools = this.backpackTools();
    const t = tools[i];
    if (!t) return;
    const eq = this.equippedTool();
    this.send({ t: 'equip', id: eq && eq.id === t.id ? null : t.id });
    sound.click();
    setTimeout(() => this.hud.setTools(this.backpackTools(), this.equippedTool()), 250);
  }
  // Where the player aims: the first thing under the mouse (players included), or far away.
  aimPoint(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    if (document.pointerLockElement) ndc.set(0, 0);
    // Phone use button: aim at the crosshair, a little above the middle (over your own head).
    else if (clientX === undefined) ndc.set(0, this.isTouch ? 0.14 : 0);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [...this.sync.root.children];
    for (const v of this.views.values()) if (!v.isLocal && v.group.visible) targets.push(v.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    const me = this.local ? new THREE.Vector3(this.local.x, this.local.y, this.local.z) : null;
    for (const h of hits) {
      const inst = h.object.userData.inst;
      if (inst && inst._p.Transparency >= 1) continue;
      if (me && h.point.distanceTo(me) < 2) continue;
      return h.point;
    }
    return this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 600);
  }
  useTool(clientX, clientY) {
    const t = this.equippedTool();
    if (!t || !this.sync) return;
    const p = this.aimPoint(clientX, clientY);
    this.send({ t: 'activate', id: t.id, p: [p.x, p.y, p.z] });
  }

  // ------------------------------------------------------------ simulation
  myHumanoid() {
    const v = this.views.get(this.userId);
    if (!v || !v.modelId || !this.game) return null;
    const model = this.game.getById(v.modelId);
    return model ? model.FindFirstChildOfClass('Humanoid') : null;
  }

  stepLocal(dt) {
    const v = this.views.get(this.userId);
    const s = this.local;
    if (!v || !s || v.dead) return;
    const hum = this.myHumanoid();
    const humP = hum ? hum._p : { WalkSpeed: 16, JumpPower: 50, Health: 100, MaxHealth: 100 };
    if (hum && humP.Health <= 0) return;

    // Ride moving platforms.
    if (s.groundPart && s.groundCF && s.groundPart._p.CFrame !== s.groundCF && !s.groundPart._destroyed) {
      const delta = s.groundPart._p.CFrame.mul(s.groundCF.Inverse());
      const np = delta.pointToWorldSpace(new Vector3(s.x, s.y, s.z));
      s.x = np.X; s.y = np.Y; s.z = np.Z;
      const look = delta.vectorToWorldSpace(new Vector3(-Math.sin(v.ry), 0, -Math.cos(v.ry)));
      const dyaw = Math.atan2(-look.X, -look.Z) - v.ry;
      v.ry += dyaw;
      if (!this.cam.shiftLock) this.cam.yaw += dyaw;
    }

    if (this.vehicle) { this.stepVehicle(dt, v, s, humP); return; }
    const mv = this.input.moveVector();
    const f = this.cam.forward, r = this.cam.right;
    let mx = f.x * mv.y + r.x * mv.x, mz = f.z * mv.y + r.z * mv.x;
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    const faceCamera = this.cam.shiftLock || this.cam.firstPerson;
    if (faceCamera) v.ry = this.cam.yaw;
    else if (m > 0.05) {
      const target = Math.atan2(-mx, -mz);
      let d = target - v.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.ry += d * Math.min(1, dt * 14);
    }
    const wasGrounded = s.grounded;
    this.hud.setFlying?.(!!humP.Flying);
    if (humP.Flying) {
      // Free flight: no gravity, Space/Jump goes up, Q/▼ goes down.
      const k = this.input.keys;
      const up = this.input.wantsJump() ? 1 : 0;
      const down = (k.has('KeyQ') || this.input.touchDown) ? 1 : 0;
      const speed = Math.max(16, humP.WalkSpeed) * 2;
      s.vy = (up - down) * speed * 0.8;
      s.jumped = true; // no snapping to the ground while hovering
      stepCharacter(s, { mx, mz, jump: false }, dt, { query: (a, b, c, d) => this.world.query(a, b, c, d), gravity: 0 }, { ...humP, WalkSpeed: speed, JumpPower: 0 });
    } else {
      stepCharacter(s, { mx, mz, jump: this.input.wantsJump() }, dt, { query: (a, b, c, d) => this.world.query(a, b, c, d), gravity: this.game.GetService('Workspace')._p.Gravity }, humP);
    }
    if (s.jumped && wasGrounded) sound.jump();
    s.groundCF = s.groundPart ? s.groundPart._p.CFrame : null;

    const hspeed = Math.hypot(s.vx, s.vz);
    const anim = humP.Flying && !s.grounded ? 'fall' : s.grounded ? (hspeed > 0.5 ? 'walk' : 'idle') : (s.vy > 0 ? 'jump' : 'fall');
    v.pos.set(s.x, s.y, s.z);
    v.anim = anim;
    v.speed = hspeed;
    v.health = humP.Health;
    v.maxHealth = humP.MaxHealth;
    this.hud.setHealth(humP.Health, humP.MaxHealth);

    const now = performance.now();
    if (now - this.lastSend > 1000 / SEND_HZ) {
      this.lastSend = now;
      this.send({ t: 'move', p: [s.x, s.y, s.z], ry: v.ry, a: anim, v: [s.vx, s.vy, s.vz] });
    }
  }

  // Go-kart driving: W/S throttle, A/D steer, Space (or Jump) to get out.
  stepVehicle(dt, v, s, humP) {
    const car = this.vehicle;
    const mv = this.input.moveVector();
    // A fresh press (not one still held from jumping in) gets you out.
    if (this.input.takeJumpTap()) {
      if (!car.exitSent) { car.exitSent = true; this.send({ t: 'exitVehicle' }); }
    }
    const target = mv.y * car.max * (mv.y < 0 ? 0.45 : 1);
    const accel = Math.sign(target - car.speed) * (Math.abs(target) > Math.abs(car.speed) ? 38 : 60);
    car.speed += accel * dt;
    if (Math.abs(target - car.speed) < Math.abs(accel * dt)) car.speed = target;
    const steer = -mv.x * car.turn * Math.min(1, Math.abs(car.speed) / 12) * Math.sign(car.speed || 1);
    v.ry += steer * dt;
    if (!this.cam.firstPerson) {
      let d = v.ry - this.cam.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.cam.yaw += d * Math.min(1, dt * 3);
    }
    const dirx = -Math.sin(v.ry), dirz = -Math.cos(v.ry);
    const sgn = car.speed < 0 ? -1 : 1;
    const before = Math.hypot(s.vx, s.vz);
    stepCharacter(s, { mx: dirx * sgn, mz: dirz * sgn, jump: false }, dt,
      { query: (a, b, c, d) => this.world.query(a, b, c, d), gravity: this.game.GetService('Workspace')._p.Gravity },
      { ...humP, WalkSpeed: Math.abs(car.speed), JumpPower: 0 });
    // Hitting a wall stops the kart.
    const after = Math.hypot(s.vx, s.vz);
    if (Math.abs(car.speed) > 10 && after < Math.abs(car.speed) * 0.35 && before > 5) car.speed *= 0.3;
    s.groundCF = s.groundPart ? s.groundPart._p.CFrame : null;
    const anim = 'drive:' + car.color;
    v.pos.set(s.x, s.y, s.z);
    v.anim = anim;
    v.speed = 0;
    this.hud.setHealth(humP.Health, humP.MaxHealth);
    const now = performance.now();
    if (now - this.lastSend > 1000 / SEND_HZ) {
      this.lastSend = now;
      this.send({ t: 'move', p: [s.x, s.y, s.z], ry: v.ry, a: anim, v: [s.vx, s.vy, s.vz] });
    }
  }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.game) {
      this.stepLocal(dt);
      for (const v of this.views.values()) v.update(dt);
      const me = this.views.get(this.userId);
      if (me) {
        const head = new THREE.Vector3(me.pos.x, me.pos.y + 1.5, me.pos.z);
        if (me.dead && me.debris) head.copy(me.debris.find((d) => d.half === 0.5)?.obj.position || head);
        this.cam.update(dt, head);
        me.group.visible = !me.dead && !this.cam.firstPerson;
        this.env.setFocus(me.pos);
      }
      // Tools: fire on mouse down; automatic tools keep firing while held.
      const tool = this.equippedTool();
      if (tool && this.input.lmb && !this.isTouchOnly) {
        const ev = this.input.lmbEvent;
        const first = !this._lmbWas;
        if (first || (tool._p.Automatic && now - (this._lastFire || 0) > 100)) {
          this._lastFire = now;
          this._mouseFired = true;
          this.useTool(ev ? ev.clientX : undefined, ev ? ev.clientY : undefined);
        }
      }
      this._lmbWas = !!this.input.lmb;
      // On phones the use button aims at the crosshair in the middle of the screen.
      this.hud.crosshair.style.display = this.cam.shiftLock || this.cam.firstPerson || (this.isTouch && tool) ? 'block' : 'none';
      this.root.classList.toggle('tool-cursor', !!tool);
      this.hud.crosshair.classList.toggle('touch-aim', !!(this.isTouch && tool && !this.cam.shiftLock && !this.cam.firstPerson));
      this.sync.update(dt);
      this.boardTimer -= dt;
      if (this.boardTimer <= 0) {
        this.boardTimer = 0.5;
        this.hud.updateBoard(this.game, this.userId);
        this.refreshHints();
        this.hud.setTools(this.backpackTools(), this.equippedTool());
        for (const v of this.views.values()) {
          const model = v.modelId && this.game.getById(v.modelId);
          v.setTool(model ? model.GetChildren().find((t) => t.ClassName === 'Tool') || null : null);
        }
        for (const v of this.views.values()) {
          if (v.isLocal || !v.modelId) continue;
          const model = this.game.getById(v.modelId);
          const hum = model && model.FindFirstChildOfClass('Humanoid');
          if (hum) { v.health = hum._p.Health; v.maxHealth = hum._p.MaxHealth; }
        }
      } else if (this.hintsDirty) { this.hintsDirty = false; this.refreshHints(); }
      const w = this.root.clientWidth, h = this.root.clientHeight;
      for (const v of this.views.values()) v.updateTag(this.camera, w, h, v.isLocal);
    } else {
      this.camera.position.set(0, 20, 40);
      this.camera.lookAt(0, 0, 0);
    }
    this.env.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime > 0.5) {
      const fps = this.frames / this.fpsTime;
      this.hud.fps.textContent = this.settings.showFps ? `${Math.round(fps)} FPS` : '';
      this.frames = 0; this.fpsTime = 0;
      this.autoQuality(fps);
    }
  }
}

export { CFrame };
