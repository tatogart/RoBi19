// Robis Studio — main application.
import * as THREE from 'three';
import { Vector3, Color3, CFrame, BRICK_COLORS, ENUMS } from '/shared/engine/types.js';
import { DataModel, CLASSES, BasePart, createInstance } from '/shared/engine/instances.js';
import { savePlace, loadPlace, clearPlace, serialize, deserialize, PLACE_FORMAT } from '/shared/engine/serialize.js';
import { api, getMe } from '../site/api.js';
import { renderPlace, gameThumbnail } from '../render/thumbs.js';
import { GameClient } from '../game/client.js';
import { Viewport } from './viewport.js';
import { Explorer } from './explorer.js';
import { Properties } from './properties.js';
import { ScriptEditor } from './editor.js';
import { History } from './history.js';
import { TOOLBOX, TOOLBOX_CATEGORIES, toolboxThumb } from './toolbox.js';
import { TeamCreate } from './teamcreate.js';
import { RIBBON, CLASS_ICONS, classIcon } from './icons.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

// Classes offered by "Insert Object", grouped like Studio's dialog.
const INSERTABLE = {
  Parts: ['Part', 'WedgePart', 'CornerWedgePart', 'TrussPart', 'SpawnLocation', 'Seat'],
  Containers: ['Model', 'Folder', 'Configuration'],
  Scripts: ['Script', 'ModuleScript', 'BindableEvent'],
  Values: ['IntValue', 'NumberValue', 'StringValue', 'BoolValue', 'ObjectValue', 'Vector3Value', 'Color3Value'],
  Effects: ['Fire', 'Sparkles', 'Smoke', 'PointLight', 'SpotLight', 'Explosion'],
  Interaction: ['ClickDetector', 'BillboardText', 'Hint', 'Message', 'Decal'],
  Gameplay: ['Tool', 'VehicleSeat'],
  Other: ['Humanoid', 'Team'],
};

class Studio {
  constructor() {
    this.game = new DataModel();
    this.selection = [];
    this.listeners = {};
    this.clipboard = [];
    this.gameId = null;
    this.gameInfo = null;
    this.playing = false;
    this.dirty = false;
    this.history = new History(this);
    this.team = null;
    // Team Create: our own changes go to everyone else editing this place.
    this.onLocalOps = (ops) => { if (this.team && !this.playing) this.team.sendOps(ops); };
  }

  // ------------------------------------------------------------ events
  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) fn(...a); }

  status(text) { $('status-text').textContent = text; }

  log(level, text) {
    const out = $('output');
    const line = h('div', { class: 'l-' + level }, h('span', { class: 't', text: new Date().toLocaleTimeString() }), text);
    out.append(line);
    while (out.children.length > 1000) out.firstChild.remove();
    out.scrollTop = out.scrollHeight;
  }

  commit(label) {
    if (this.playing) return;
    this.history.commit(label);
    this.updateTitle();
  }

  updateTitle() {
    const name = this.gameInfo ? this.gameInfo.name + (this.subPlace ? ` — ${this.subPlace.name}` : '') : 'Untitled Place';
    document.title = `${this.dirty ? '* ' : ''}${name} - Robis Studio`;
    this.editor.setPlaceName(name);
  }

  // ------------------------------------------------------------ selection
  isSelected(inst) { return this.selection.includes(inst); }
  selectionFor(game) { return this.playing ? (game === this.game ? [] : this.playSelection || []) : this.selection; }

  setSelection(list) {
    if (this.playing) {
      this.playSelection = list;
      this.properties.setTargets(list, true);
      this.explorer.render();
      return;
    }
    this.selection = [...new Set(list.filter(Boolean))];
    this.emit('selection');
  }
  toggleSelection(inst) {
    if (this.isSelected(inst)) this.setSelection(this.selection.filter((i) => i !== inst));
    else this.setSelection([...this.selection, inst]);
  }
  editableSelection() { return this.selection.filter((i) => !i.constructor.service && !i._destroyed); }

  // ------------------------------------------------------------ editing ops
  insert(inst, parent) {
    if (this.playing) return;
    parent = parent || this.defaultParent(inst);
    if (inst.IsA('BasePart') || inst.ClassName === 'Model') this.placeAtCursor(inst);
    inst.Parent = parent;
    this.setSelection([inst]);
    this.explorer.scrollTo(inst);
    this.commit(`Insert ${inst.ClassName}`);
    return inst;
  }

  defaultParent(inst) {
    if (inst.ClassName === 'Tool') return this.game.GetService('StarterPack'); // everyone gets it on spawn
    const scriptLike = inst.IsA('BaseScript') || inst.ClassName === 'ModuleScript';
    const sel = this.selection[0];
    const isPartChild = ['Fire', 'Sparkles', 'Smoke', 'PointLight', 'SpotLight', 'ClickDetector', 'BillboardText', 'Decal'].includes(inst.ClassName);
    if (isPartChild && sel && sel.IsA('BasePart')) return sel;
    if (sel && !scriptLike && !isPartChild && (sel.ClassName === 'Model' || sel.ClassName === 'Folder')) return sel;
    if (scriptLike && sel && !sel.constructor.service) return sel;
    if (scriptLike) return this.game.ServerScriptService;
    return this.game.Workspace;
  }

  placeAtCursor(inst) {
    const { point, normal } = this.viewport.insertPoint();
    const snap = (v) => Math.round(v);
    if (inst.IsA('BasePart')) {
      const s = inst.Size;
      const up = Math.abs(normal.y) > 0.5 ? s.Y / 2 : Math.abs(normal.x) > 0.5 ? s.X / 2 : s.Z / 2;
      const p = new THREE.Vector3().copy(point).addScaledVector(normal, up);
      inst.Position = new Vector3(snap(p.x), Math.round(p.y * 10) / 10, snap(p.z));
    } else {
      const [cf, size] = inst.GetBoundingBox();
      const target = new Vector3(snap(point.x), point.y + size.Y / 2, snap(point.z));
      inst.TranslateBy(target.sub(cf.Position));
    }
  }

  insertPart(cls = 'Part', shape) {
    const p = createInstance(cls);
    p.Anchored = true;
    if (shape) p.Shape = shape;
    if (shape === 'Ball') p.Size = new Vector3(4, 4, 4);
    if (shape === 'Cylinder') p.Size = new Vector3(2, 4, 4);
    if (cls === 'SpawnLocation') p.Size = new Vector3(12, 1, 12);
    if (cls === 'TrussPart') p.Size = new Vector3(2, 10, 2);
    if (cls === 'WedgePart') p.Size = new Vector3(4, 4, 4);
    if (cls === 'Seat') p.Size = new Vector3(4, 1, 4);
    this.insert(p);
  }

  insertObject(className) {
    const inst = createInstance(className);
    if (inst.IsA('BasePart')) inst.Anchored = true;
    if (className === 'Script') inst.Source = 'print("Hello world!")\n';
    if (className === 'Hint' || className === 'Message') inst.Text = 'Hello!';
    this.insert(inst);
    if (inst.IsA('BaseScript') || className === 'ModuleScript') this.openScript(inst);
  }

  deleteSelection() {
    const sel = this.editableSelection();
    if (!sel.length) return;
    for (const i of sel) { i._parentLocked = false; i.Destroy(); }
    this.setSelection([]);
    this.commit('Delete');
  }

  copy() {
    this.clipboard = this.editableSelection().map((i) => serialize(i));
    if (this.clipboard.length) this.status(`Copied ${this.clipboard.length} object(s)`);
  }
  cut() { this.copy(); this.deleteSelection(); }
  paste(into) {
    if (!this.clipboard.length) return;
    const parent = into || this.game.Workspace;
    const made = this.clipboard.map((d) => deserialize(d, { keepIds: false })).filter(Boolean);
    for (const m of made) m.Parent = parent;
    this.setSelection(made);
    this.commit('Paste');
  }
  duplicate() {
    const sel = this.editableSelection();
    if (!sel.length) return;
    const made = [];
    for (const i of sel) {
      const c = i.Clone();
      if (!c) continue;
      if (c.IsA('BasePart')) c.Position = c.Position.add(new Vector3(0, c.Size.Y, 0));
      else if (c.ClassName === 'Model') c.TranslateBy(new Vector3(0, c.GetExtentsSize().Y, 0));
      c.Parent = i.Parent;
      made.push(c);
    }
    this.setSelection(made);
    this.commit('Duplicate');
  }
  group() {
    const sel = this.editableSelection();
    if (!sel.length) return;
    const m = createInstance('Model');
    m.Parent = sel[0].Parent;
    for (const i of sel) i.Parent = m;
    this.setSelection([m]);
    this.commit('Group');
  }
  ungroup() {
    const out = [];
    for (const m of this.editableSelection().filter((i) => i.ClassName === 'Model' || i.ClassName === 'Folder')) {
      for (const c of m.GetChildren()) { c.Parent = m.Parent; out.push(c); }
      m.Destroy();
    }
    if (!out.length) return;
    this.setSelection(out);
    this.commit('Ungroup');
  }
  reparent(list, target) {
    if (this.playing) return;
    let moved = 0;
    for (const i of list) {
      if (i === target || i.constructor.service || target.IsDescendantOf(i)) continue;
      try { i.Parent = target; moved++; } catch (e) { this.log('error', e.message); }
    }
    if (moved) this.commit('Reparent');
  }
  setOnSelectedParts(prop, value, label) {
    const parts = [];
    for (const s of this.editableSelection()) {
      if (s.IsA('BasePart')) parts.push(s);
      else for (const d of s.GetDescendants()) if (d.IsA('BasePart')) parts.push(d);
    }
    if (!parts.length) return;
    for (const p of parts) p[prop] = typeof value === 'function' ? value(p) : value;
    this.commit(label);
    this.properties.refreshValues();
  }
  rotateSelection(axis) {
    const sel = this.editableSelection();
    for (const s of sel) {
      const r = axis === 'y' ? CFrame.Angles(0, Math.PI / 2, 0) : CFrame.Angles(Math.PI / 2, 0, 0);
      if (s.IsA('BasePart')) { const cf = s.CFrame; s.CFrame = new CFrame(cf.x, cf.y, cf.z).mul(r).mul(cf.Rotation); }
      else if (s.ClassName === 'Model') {
        const [c] = s.GetBoundingBox();
        const pivot = new CFrame(c.x, c.y, c.z);
        const t = pivot.mul(r).mul(pivot.Inverse());
        for (const p of s.GetDescendants()) if (p.IsA('BasePart')) p.CFrame = t.mul(p.CFrame);
      }
    }
    if (sel.length) this.commit('Rotate');
  }

  openScript(s) { this.editor.open(s); }

  // ------------------------------------------------------------ place loading
  loadPlaceData(place, info = null, opts = {}) {
    if (!opts.keepTeam && this.team) { this.team.close(); this.team = null; }
    this.editor.closeAll();
    this.suspendEvents = true;
    clearPlace(this.game);
    loadPlace(this.game, place, { keepIds: true });
    this.suspendEvents = false;
    this.gameInfo = info;
    this.gameId = info ? info.id : null;
    // one of the game's other places (see the Places window), or its start place
    this.subPlace = info && opts.subPlace ? opts.subPlace : null;
    this.setSelection([]);
    this.history.reset();
    if (!opts.keepTeam && info && info.id && info.canEdit) this.team = new TeamCreate(this, info.id, this.subPlace ? this.subPlace.id : 0);
    this.emit('team');
    this.explorer.setGame(this.game);
    this.viewport.env.apply(this.game.Lighting);
    this.updateTitle();
    const url = new URL(location.href);
    if (this.gameId) url.searchParams.set('gameId', this.gameId); else url.searchParams.delete('gameId');
    if (this.subPlace) url.searchParams.set('place', this.subPlace.id); else url.searchParams.delete('place');
    history.replaceState(null, '', url);
    this.viewport.camera.position.set(20, 22, 30);
    this.viewport.yaw = Math.atan2(20, 30);
    this.viewport.pitch = -0.45;
  }

  async openGame(id, placeId = 0) {
    try {
      const { place, game, subPlace } = await api.get(`/games/${id}/place${placeId ? '?place=' + placeId : ''}`);
      this.loadPlaceData(place, game.canEdit ? game : null, { subPlace });
      this.log('info', `Opened "${game.name}"${subPlace ? ` — place "${subPlace.name}" (ID ${subPlace.id})` : ''}${game.canEdit ? '' : ' (copy — publishing will create a new game)'}`);
    } catch (e) {
      this.log('error', e.message);
      alert(e.message);
    }
  }

  async newFromTemplate(key) {
    const { place } = await api.get(`/templates/${key}`);
    this.loadPlaceData(place, null);
    this.log('info', `New place from template "${key}"`);
  }

  saveToFile() {
    this.editor.flush();
    const data = savePlace(this.game, { name: this.gameInfo?.name || 'Place' });
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${(this.gameInfo?.name || 'Place').replace(/[^\w-]+/g, '_')}.robis.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.status('Saved to file');
  }

  openFromFile() {
    const input = h('input', { type: 'file', accept: '.json,.robis' });
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.format !== PLACE_FORMAT) throw new Error('Not a Robis place file');
        this.loadPlaceData(data, null);
        this.log('info', `Opened ${f.name}`);
      } catch (e) { alert(e.message); }
    };
    input.click();
  }

  async publish() {
    if (this.playing) return;
    this.editor.flush();
    if (!this.gameId) {
      const name = await this.prompt('Publish to Robis', 'Name of your new game', this.gameInfo?.name || `${this.me.username}'s Place`);
      if (!name) return;
      const { game } = await api.post('/games', { name });
      this.gameInfo = game;
      this.gameId = game.id;
      const url = new URL(location.href);
      url.searchParams.set('gameId', game.id);
      history.replaceState(null, '', url);
    }
    this.status('Publishing...');
    try {
      const place = savePlace(this.game, { name: this.gameInfo.name });
      let thumbnail;
      try { thumbnail = await renderPlace(null, 384, { game: this.game }); } catch { /* optional */ }
      const r = await api.put(`/games/${this.gameId}/place${this.subPlace ? '?place=' + this.subPlace.id : ''}`, { place, thumbnail });
      this.gameInfo = r.game;
      this.dirty = false;
      this.updateTitle();
      this.status('Published to Robis');
      this.log('info', `Published "${r.game.name}" — ${location.origin}/game?id=${this.gameId}${r.game.isPublic ? '' : ' (private — make it public from Game Settings)'}`);
      this.toast('Published!');
    } catch (e) {
      this.log('error', 'Publish failed: ' + e.message);
      this.status('Publish failed');
    }
  }

  toast(text) {
    const t = h('div', { class: 'toast-s', text });
    document.body.append(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ------------------------------------------------------------ play mode
  play() {
    if (this.playing) return;
    this.editor.flush();
    this.editor.activate(null);
    const place = savePlace(this.game);
    this.playing = true;
    this.viewport.gizmo.detach();
    this.viewport.canvas.style.visibility = 'hidden';
    const host = h('div', { class: 'viewport' });
    $('doc-area').append(host);
    this.playHost = host;
    const banner = h('div', { class: 'play-banner', text: 'Playing — press Shift+F5 or Stop to return to editing' });
    host.append(banner);
    this.log('info', 'Starting test session...');
    this.client = new GameClient(host, {
      embedded: true,
      testPlace: place,
      placeId: this.gameId || 0,
      gameInfo: { name: this.gameInfo?.name || 'Studio Test', creator: { username: this.me.username } },
      onOutput: (m) => this.log(m.level, m.text),
      onExit: () => this.stop(),
    });
    this.client.start();
    this.properties.setTargets([], true);
    const waitMirror = setInterval(() => {
      if (!this.playing) { clearInterval(waitMirror); return; }
      if (this.client.game) {
        clearInterval(waitMirror);
        this.explorer.setGame(this.client.game, true);
      }
    }, 200);
    this.updateRibbonState();
    this.status('Playing');
  }

  stop() {
    if (!this.playing) return;
    const c = this.client;
    this.client = null;
    this.playing = false;
    if (c) c.stop();
    if (this.playHost) { this.playHost.remove(); this.playHost = null; }
    this.viewport.canvas.style.visibility = 'visible';
    this.explorer.setGame(this.game);
    this.emit('selection');
    this.updateRibbonState();
    this.log('info', 'Test session ended.');
    this.status('Ready');
  }

  // ------------------------------------------------------------ places
  // A game is a set of places: the start place (where players join) and more
  // (a lobby's levels, other worlds). Scripts move players between them with
  // TeleportService:Teleport(placeId, player).
  async placesDialog() {
    if (!this.gameId) { alert('Publish your game first: places belong to a published game.'); return; }
    const body = h('div', { class: 'places-dlg' });
    let close;
    const open = async (pl) => {
      if (this.dirty && !confirm('You have unpublished changes in this place. Open another place anyway?')) return;
      close();
      await this.openGame(this.gameId, pl.start ? 0 : pl.id);
    };
    const draw = async () => {
      let r;
      try { r = await api.get(`/games/${this.gameId}/places`); } catch (e) { body.replaceChildren(h('div', { text: e.message })); return; }
      const cur = this.subPlace ? this.subPlace.id : this.gameId;
      body.replaceChildren(
        h('p', { class: 'muted', text: 'Players join the Start Place. Send them to another place from a script:' }),
        h('pre', { class: 'places-code', text: 'local TeleportService = game:GetService("TeleportService")\nTeleportService:Teleport(PLACE_ID, player)\n-- a group into one new server (like an elevator):\nTeleportService:TeleportPartyAsync(PLACE_ID, {player1, player2})\n-- find an id by name:\nlocal id = TeleportService:GetPlaceId("Level 1")' }),
        h('div', { class: 'places-list' }, r.places.map((pl) => h('div', { class: 'places-row' + (pl.id === cur ? ' current' : '') },
          h('span', { class: 'ic', html: RIBBON.places }),
          h('div', { class: 'places-name' }, h('b', { text: pl.name }), h('span', { class: 'muted', text: `  ID ${pl.id}${pl.start ? ' · start place' : ''}${pl.id === cur ? ' · open now' : ''}` })),
          pl.id === cur ? null : h('button', { class: 'sbtn', text: 'Open', onclick: () => open(pl) }),
          h('button', { class: 'sbtn', text: 'Copy ID', onclick: () => navigator.clipboard?.writeText(String(pl.id)).then(() => this.toast('Copied')).catch(() => {}) }),
          pl.start ? null : h('button', { class: 'sbtn', text: 'Rename', onclick: async () => {
            const name = await this.prompt('Rename place', 'Name', pl.name);
            if (!name) return;
            try { await api.post(`/places/${pl.id}`, { name }); if (this.subPlace && this.subPlace.id === pl.id) { this.subPlace.name = name; this.updateTitle(); } draw(); } catch (e) { alert(e.message); }
          } }),
          pl.start || pl.id === cur ? null : h('button', { class: 'sbtn', text: 'Delete', onclick: async () => {
            if (!confirm(`Delete the place "${pl.name}"? This can't be undone.`)) return;
            try { await api.post(`/places/${pl.id}`, { delete: true }); draw(); } catch (e) { alert(e.message); }
          } })))),
        r.canEdit ? h('button', { class: 'sbtn primary', text: '+ New place', onclick: async () => {
          const name = await this.prompt('New place', 'Name (for example: Level 1, The Hotel, Arena)', '');
          if (!name) return;
          try { const x = await api.post(`/games/${this.gameId}/places`, { name, template: 'baseplate' }); this.log('info', `Place "${name}" made — its ID is ${x.place.id}`); draw(); } catch (e) { alert(e.message); }
        } }) : null);
    };
    close = this.dialog('Places', body, [{ text: 'Close' }], 640);
    draw();
  }

  // ------------------------------------------------------------ dialogs & menus
  dialog(title, body, buttons = [{ text: 'Close' }], width) {
    const back = h('div', { class: 'sdialog-back' });
    const close = () => back.remove();
    const box = h('div', { class: 'sdialog', style: width ? `width:${width}px` : null },
      h('div', { class: 'sdialog-head' }, title, h('button', { text: '×', onclick: close })),
      h('div', { class: 'sdialog-body' }, body),
      buttons.length ? h('div', { class: 'sdialog-foot' }, buttons.map((b) => h('button', {
        class: 'sbtn' + (b.primary ? ' primary' : ''), text: b.text,
        onclick: async () => { const r = b.onClick ? await b.onClick() : undefined; if (r !== false) close(); },
      }))) : null);
    back.append(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.body.append(back);
    return close;
  }

  prompt(title, label, value = '') {
    return new Promise((resolve) => {
      const input = h('input', { value });
      let done = false;
      const close = this.dialog(title, h('label', { class: 'sfield' }, label, input), [
        { text: 'OK', primary: true, onClick: () => { done = true; resolve(input.value.trim()); } },
        { text: 'Cancel', onClick: () => { done = true; resolve(null); } },
      ]);
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { done = true; resolve(input.value.trim()); close(); } });
      setTimeout(() => { input.focus(); input.select(); });
      const obs = new MutationObserver(() => { if (!document.body.contains(input)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.body, { childList: true });
    });
  }

  menu(x, y, items) {
    document.querySelectorAll('.menu').forEach((m) => m.remove());
    const m = h('div', { class: 'menu' });
    for (const it of items) {
      if (it === '-') { m.append(h('hr')); continue; }
      if (it.custom) { m.append(it.custom); continue; }
      m.append(h('button', {
        disabled: it.disabled, onclick: () => { m.remove(); it.onClick(); },
      }, it.icon ? h('span', { class: 'ic', html: it.icon }) : null, it.text, it.kb ? h('span', { class: 'kb', text: it.kb }) : null));
    }
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    setTimeout(() => {
      const close = (e) => { if (!m.contains(e.target)) { m.remove(); removeEventListener('mousedown', close); } };
      addEventListener('mousedown', close);
    });
    return m;
  }

  contextMenu(x, y, inst) {
    const ro = this.playing;
    const any = this.editableSelection().length > 0;
    const scriptLike = inst && (inst.IsA('BaseScript') || inst.ClassName === 'ModuleScript');
    this.menu(x, y, [
      { text: 'Cut', kb: 'Ctrl+X', disabled: ro || !any, onClick: () => this.cut() },
      { text: 'Copy', kb: 'Ctrl+C', disabled: ro || !any, onClick: () => this.copy() },
      { text: 'Paste Into', kb: 'Ctrl+Shift+V', disabled: ro || !this.clipboard.length || !inst, onClick: () => this.paste(inst) },
      { text: 'Duplicate', kb: 'Ctrl+D', disabled: ro || !any, onClick: () => this.duplicate() },
      { text: 'Delete', kb: 'Del', disabled: ro || !any, onClick: () => this.deleteSelection() },
      { text: 'Rename', kb: 'F2', disabled: ro || !inst || inst.constructor.service, onClick: () => this.explorer.rename(inst) },
      '-',
      { text: 'Group', kb: 'Ctrl+G', disabled: ro || !any, onClick: () => this.group() },
      { text: 'Ungroup', kb: 'Ctrl+U', disabled: ro || !any, onClick: () => this.ungroup() },
      { text: 'Select Children', disabled: !inst, onClick: () => this.setSelection(inst.GetChildren()) },
      { text: 'Zoom to', kb: 'F', disabled: !any, onClick: () => this.viewport.focusSelection() },
      '-',
      scriptLike ? { text: 'Open Script', onClick: () => this.openScript(inst) } : null,
      { text: 'Insert Object...', disabled: ro, onClick: () => this.insertObjectDialog(inst) },
    ].filter(Boolean));
  }

  insertObjectDialog(parent) {
    const filter = h('input', { placeholder: 'Search object' });
    const list = h('div', { class: 'insert-list' });
    let close;
    const draw = () => {
      const q = filter.value.toLowerCase();
      list.replaceChildren();
      for (const [cat, classes] of Object.entries(INSERTABLE)) {
        const shown = classes.filter((c) => c.toLowerCase().includes(q) && CLASSES[c]);
        if (!shown.length) continue;
        list.append(h('div', { class: 'insert-cat', text: cat }));
        for (const c of shown) {
          list.append(h('button', { onclick: () => {
            close();
            const inst = createInstance(c);
            if (inst.IsA('BasePart')) inst.Anchored = true;
            if (c === 'Hint' || c === 'Message') inst.Text = 'Hello!';
            this.insert(inst, parent && !(inst.IsA('BasePart') && parent.IsA('BasePart')) ? parent : undefined);
            if (inst.IsA('BaseScript') || c === 'ModuleScript') this.openScript(inst);
          } }, h('span', { class: 'ic', html: classIcon(CLASSES[c]) }), c));
        }
      }
    };
    filter.addEventListener('input', draw);
    filter.addEventListener('keydown', (e) => e.stopPropagation());
    draw();
    close = this.dialog(`Insert Object${parent ? ' into ' + parent.Name : ''}`, h('div', {}, h('label', { class: 'sfield' }, filter), list), [], 460);
    setTimeout(() => filter.focus());
  }

  fileMenu() {
    const r = $('file-btn').getBoundingClientRect();
    this.menu(r.left, r.bottom, [
      { text: 'New', kb: 'Ctrl+N', onClick: () => this.startPage() },
      { text: 'Open from Robis...', kb: 'Ctrl+O', onClick: () => this.startPage('open') },
      { text: 'Open from File...', onClick: () => this.openFromFile() },
      '-',
      { text: 'Save to File', onClick: () => this.saveToFile() },
      { text: this.gameId ? 'Publish to Robis' : 'Publish to Robis As...', kb: 'Ctrl+S', onClick: () => this.publish() },
      { text: 'Game Settings', disabled: !this.gameId, onClick: () => this.gameSettings() },
      '-',
      { text: 'View Game Page', disabled: !this.gameId, onClick: () => open(`/game?id=${this.gameId}`, '_blank') },
      { text: 'Exit Studio', onClick: () => { location.href = '/develop'; } },
    ]);
  }

  async startPage(tab = 'new') {
    const [{ templates }, { games }] = await Promise.all([api.get('/templates'), api.get(`/users/${this.me.id}/games`)]);
    const body = h('div');
    const tabs = h('div', { style: 'display:flex;gap:6px;margin-bottom:12px' });
    const content = h('div');
    let close;
    const show = (t) => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.t === t));
      if (t === 'new') {
        content.replaceChildren(h('div', { class: 'start-grid' }, templates.map((tp) => h('button', {
          class: 'start-card', onclick: async () => { close(); await this.newFromTemplate(tp.key); },
        }, h('b', { text: tp.name }), h('span', { text: tp.desc })))));
      } else {
        content.replaceChildren(games.length ? h('div', { class: 'start-grid' }, games.map((g) => {
          const img = h('img', { alt: '' });
          if (g.hasThumbnail) gameThumbnail(g, 256).then((u) => { img.src = u; });
          return h('button', { class: 'start-card', onclick: async () => { close(); await this.openGame(g.id); } },
            img, h('b', { text: g.name }), h('span', { text: g.isPublic ? 'Public' : 'Private' }));
        })) : h('div', { text: 'You have no games yet. Pick a template on the New tab!' }));
      }
    };
    for (const [t, label] of [['new', 'New'], ['open', 'My Games']]) tabs.append(h('button', { class: 'sbtn', 'data-t': t, text: label, onclick: () => show(t) }));
    body.append(tabs, content);
    show(tab);
    close = this.dialog('Welcome to Robis Studio', body, [
      { text: 'Open from File...', onClick: () => this.openFromFile() },
      { text: 'Close' },
    ], 720);
  }

  // Team Create: who is editing right now, collaborators (owner adds them) and a team chat.
  async teamDialog() {
    if (!this.gameId) { this.dialog('Team Create', h('p', { text: 'Publish your place first, then invite people to edit it with you.' })); return; }
    const body = h('div', { class: 'team-dialog' });
    const draw = async () => {
      let data = { collaborators: [], owner: null };
      try { data = await api.get(`/games/${this.gameId}/collaborators`); } catch (e) { body.replaceChildren(h('p', { text: e.message })); return; }
      const isOwner = this.gameInfo && this.gameInfo.isOwner;
      const online = (this.team && this.team.users) || [];
      const input = h('input', { placeholder: 'Username' });
      input.addEventListener('keydown', (e) => e.stopPropagation());
      const chat = h('input', { placeholder: 'Message your team (shows in Output)' });
      chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && chat.value.trim()) { this.team?.chat(chat.value.trim()); chat.value = ''; } });
      body.replaceChildren(
        h('p', { class: 'muted', text: 'Collaborators can open this place in Studio and edit it with you at the same time. Everyone sees each other\'s changes live; Undo only undoes your own changes.' }),
        h('h4', { text: `Editing now (${online.length})` }),
        h('div', { class: 'team-list' }, online.map((u) => h('div', { class: 'team-user online', text: u.name }))),
        h('h4', { text: 'Collaborators' }),
        h('div', { class: 'team-list' },
          data.owner ? h('div', { class: 'team-user' }, data.owner.username, h('span', { class: 'muted', text: ' (owner)' })) : null,
          data.collaborators.map((u) => h('div', { class: 'team-user' }, u.username,
            isOwner ? h('button', { class: 'sbtn', text: 'Remove', onclick: async () => { await api.del(`/games/${this.gameId}/collaborators/${u.id}`); draw(); } }) : null))),
        isOwner ? h('div', { class: 'team-add' }, input, h('button', { class: 'sbtn primary', text: 'Add', onclick: async () => {
          try { await api.post(`/games/${this.gameId}/collaborators`, { username: input.value.trim() }); draw(); } catch (e) { alert(e.message); }
        } })) : null,
        this.team ? h('div', { class: 'team-add' }, chat) : null);
    };
    draw();
    this.on('team', () => { if (document.body.contains(body)) draw(); });
    this.dialog('Team Create', body, [{ text: 'Close' }], 460);
  }

  async gameSettings() {
    if (!this.gameId) return;
    const { game } = await api.get(`/games/${this.gameId}`);
    const name = h('input', { value: game.name, maxlength: 50 });
    const desc = h('textarea', { rows: 4, maxlength: 1000 });
    desc.value = game.description;
    const maxP = h('input', { type: 'number', min: 1, max: 50, value: game.maxPlayers });
    const pub = h('input', { type: 'checkbox', checked: game.isPublic });
    const copy = h('input', { type: 'checkbox', checked: game.copyable });
    for (const i of [name, desc, maxP]) i.addEventListener('keydown', (e) => e.stopPropagation());
    this.dialog('Game Settings', h('div', {},
      h('label', { class: 'sfield' }, 'Name', name), h('label', { class: 'sfield' }, 'Description', desc),
      h('label', { class: 'sfield' }, 'Max Players', maxP),
      h('label', {}, pub, ' Public — anyone can find and play this game'), h('br'),
      h('label', {}, copy, ' Copying allowed — anyone can open it in Studio')), [
      { text: 'Save', primary: true, onClick: async () => {
        const r = await api.patch(`/games/${this.gameId}`, { name: name.value, description: desc.value, maxPlayers: +maxP.value, isPublic: pub.checked, copyable: copy.checked });
        this.gameInfo = r.game;
        this.updateTitle();
        this.toast('Settings saved');
      } },
      { text: 'Cancel' },
    ]);
  }

  colorMenu(x, y) {
    const grid = h('div', { class: 'color-grid' }, BRICK_COLORS.map((e) => h('button', {
      title: e[1], style: `background:rgb(${e[2]},${e[3]},${e[4]})`,
      onclick: () => { document.querySelectorAll('.menu').forEach((m) => m.remove()); this.setOnSelectedParts('Color', Color3.fromRGB(e[2], e[3], e[4]), 'Color'); },
    })));
    this.menu(x, y, [{ custom: grid }]);
  }

  materialMenu(x, y) {
    this.menu(x, y, ENUMS.Material.map((m) => ({ text: m, onClick: () => this.setOnSelectedParts('Material', m, 'Material') })));
  }

  // ------------------------------------------------------------ ribbon
  buildRibbon() {
    const s = this;
    const vp = () => this.viewport;
    const btn = (id, label, icon, onClick, opts = {}) => {
      const b = h('button', { class: 'rbtn' + (opts.small ? ' small' : ''), title: opts.title || label, 'data-id': id },
        h('span', { class: 'ic', html: RIBBON[icon] || icon }), h('span', { text: label }), opts.caret ? h('span', { class: 'caret', text: '▼' }) : null);
      b.addEventListener('click', (e) => onClick(e, b));
      return b;
    };
    const group = (label, ...items) => h('div', { class: 'rgroup' }, h('div', { class: 'rgroup-items' }, items), h('div', { class: 'rgroup-label', text: label }));
    const at = (b) => { const r = b.getBoundingClientRect(); return [r.left, r.bottom]; };
    const tools = () => group('Tools',
      btn('tool-select', 'Select', 'select', () => this.setTool('select'), { title: 'Select (Ctrl+1)' }),
      btn('tool-move', 'Move', 'move', () => this.setTool('move'), { title: 'Move (Ctrl+2)' }),
      btn('tool-scale', 'Scale', 'scale', () => this.setTool('scale'), { title: 'Scale (Ctrl+3)' }),
      btn('tool-rotate', 'Rotate', 'rotate', () => this.setTool('rotate'), { title: 'Rotate (Ctrl+4)' }));
    const partMenu = (e, b) => this.menu(...at(b), [
      { text: 'Block', icon: CLASS_ICONS.part, onClick: () => this.insertPart('Part') },
      { text: 'Sphere', icon: CLASS_ICONS.part, onClick: () => this.insertPart('Part', 'Ball') },
      { text: 'Wedge', icon: CLASS_ICONS.wedge, onClick: () => this.insertPart('WedgePart') },
      { text: 'Corner Wedge', icon: CLASS_ICONS.wedge, onClick: () => this.insertPart('CornerWedgePart') },
      { text: 'Cylinder', icon: CLASS_ICONS.part, onClick: () => this.insertPart('Part', 'Cylinder') },
      { text: 'Truss', icon: CLASS_ICONS.truss, onClick: () => this.insertPart('TrussPart') },
      { text: 'Spawn Location', icon: CLASS_ICONS.spawn, onClick: () => this.insertPart('SpawnLocation') },
      { text: 'Seat', icon: CLASS_ICONS.seat, onClick: () => this.insertPart('Seat') },
    ]);
    const testGroup = () => group('Test',
      btn('play', 'Play', 'play', () => this.play(), { title: 'Play (F5)' }),
      btn('stop', 'Stop', 'stop', () => this.stop(), { title: 'Stop (Shift+F5)' }));
    const TABS = {
      HOME: () => [
        group('Clipboard',
          btn('paste', 'Paste', 'paste', () => this.paste()),
          h('div', { class: 'rcol' },
            btn('copy', 'Copy', 'copy', () => this.copy(), { small: true }),
            btn('cut', 'Cut', 'cut', () => this.cut(), { small: true }),
            btn('dup', 'Duplicate', 'duplicate', () => this.duplicate(), { small: true }))),
        tools(),
        group('Insert',
          btn('part', 'Part', 'part', partMenu, { caret: true }),
          btn('toolbox', 'Toolbox', 'toolbox', () => this.togglePanel('toolbox'))),
        group('Edit',
          btn('color', 'Color', 'color', (e, b) => this.colorMenu(...at(b)), { caret: true }),
          btn('material', 'Material', 'material', (e, b) => this.materialMenu(...at(b)), { caret: true }),
          h('div', { class: 'rcol' },
            btn('group', 'Group', 'group', () => this.group(), { small: true, title: 'Group (Ctrl+G)' }),
            btn('lock', 'Lock', 'lock', () => this.setOnSelectedParts('Locked', (p) => !p.Locked, 'Lock'), { small: true }),
            btn('anchor', 'Anchor', 'anchor', () => this.setOnSelectedParts('Anchored', (p) => !p.Anchored, 'Anchor'), { small: true }))),
        testGroup(),
        group('Settings', btn('settings', 'Game Settings', 'settings', () => this.gameSettings()),
          btn('places', 'Places', 'places', () => this.placesDialog(), { title: 'The places of this game: a lobby, levels, ... Teleport between them with TeleportService' })),
        group('Collaborate', btn('team', 'Team Create', 'group', () => this.teamDialog(), { title: 'Edit this place together with friends' })),
        group('Publish', btn('publish', 'Publish', 'publish', () => this.publish(), { title: 'Publish to Robis (Ctrl+S)' })),
      ],
      MODEL: () => [
        tools(),
        group('Snap to Grid',
          h('div', { class: 'rcol', style: 'justify-content:center' },
            h('label', { class: 'snap-row' }, (() => { const c = h('input', { type: 'checkbox', checked: vp().snapEnabled }); c.onchange = () => { vp().snapEnabled = c.checked; vp().updateGizmo(); }; return c; })(), 'Snap'),
            h('label', { class: 'snap-row' }, 'Rotate', (() => { const i = h('input', { type: 'number', value: vp().rotateSnap, min: 1, max: 90 }); i.onchange = () => { vp().rotateSnap = +i.value || 15; vp().updateGizmo(); }; i.onkeydown = (e) => e.stopPropagation(); return i; })(), '°'),
            h('label', { class: 'snap-row' }, 'Move', (() => { const i = h('input', { type: 'number', value: vp().moveSnap, min: 0.05, step: 0.05 }); i.onchange = () => { vp().moveSnap = +i.value || 1; vp().updateGizmo(); }; i.onkeydown = (e) => e.stopPropagation(); return i; })(), 'studs'))),
        group('Transform',
          btn('space', 'World/Local', 'rotate', (e, b) => { vp().space = vp().space === 'world' ? 'local' : 'world'; vp().updateGizmo(); this.status(`Transform space: ${vp().space}`); }, { title: 'Toggle local space (Ctrl+L)' }),
          btn('rot90', 'Rotate 90°', 'rotate', () => this.rotateSelection('y'), { title: 'Rotate (Ctrl+R)' }),
          btn('tilt90', 'Tilt 90°', 'rotate', () => this.rotateSelection('x'), { title: 'Tilt (Ctrl+T)' })),
        group('Parts',
          btn('m-part', 'Part', 'part', partMenu, { caret: true }),
          btn('m-sphere', 'Sphere', 'sphere', () => this.insertPart('Part', 'Ball')),
          btn('m-cyl', 'Cylinder', 'cylinder', () => this.insertPart('Part', 'Cylinder')),
          btn('m-wedge', 'Wedge', 'wedge', () => this.insertPart('WedgePart')),
          btn('m-spawn', 'Spawn', 'spawn', () => this.insertPart('SpawnLocation'))),
        group('Advanced',
          btn('m-script', 'Script', 'script', () => this.insertObject('Script')),
          btn('m-module', 'Module', 'module', () => this.insertObject('ModuleScript')),
          btn('m-effects', 'Effects', 'effects', (e, b) => this.menu(...at(b), ['Fire', 'Sparkles', 'Smoke', 'PointLight', 'SpotLight', 'ClickDetector', 'BillboardText']
            .map((c) => ({ text: c, icon: classIcon(CLASSES[c]), onClick: () => this.insertObject(c) }))), { caret: true }),
          btn('m-insert', 'Insert Object', 'part', () => this.insertObjectDialog(this.selection[0]))),
      ],
      TEST: () => [
        testGroup(),
        group('Output', btn('t-clear', 'Clear Output', 'output', () => { $('output').replaceChildren(); })),
      ],
      VIEW: () => [
        group('Show',
          btn('v-explorer', 'Explorer', 'explorer', () => this.togglePanel('explorer')),
          btn('v-properties', 'Properties', 'properties', () => this.togglePanel('properties')),
          btn('v-output', 'Output', 'output', () => this.togglePanel('output')),
          btn('v-toolbox', 'Toolbox', 'toolbox', () => this.togglePanel('toolbox')),
          btn('v-command', 'Command Bar', 'command', () => this.togglePanel('command'))),
        group('Camera',
          btn('v-focus', 'Focus', 'camera', () => this.viewport.focusSelection(), { title: 'Zoom to selection (F)' }),
          btn('v-reset', 'Reset View', 'camera', () => { const v = this.viewport; v.camera.position.set(20, 22, 30); v.yaw = Math.atan2(20, 30); v.pitch = -0.45; })),
      ],
    };
    const tabList = $('ribbon-tab-list');
    const ribbon = $('ribbon');
    const showTab = (name) => {
      tabList.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === name));
      ribbon.replaceChildren(...TABS[name]());
      this.updateRibbonState();
    };
    for (const name of Object.keys(TABS)) tabList.append(h('button', { text: name, onclick: () => showTab(name) }));
    showTab('HOME');
    $('file-btn').onclick = () => this.fileMenu();
  }

  updateRibbonState() {
    const vp = this.viewport;
    document.querySelectorAll('.rbtn').forEach((b) => {
      const id = b.dataset.id;
      if (id && id.startsWith('tool-')) b.classList.toggle('active', vp.tool === id.slice(5));
      if (id === 'play') b.disabled = this.playing;
      if (id === 'stop') b.disabled = !this.playing;
      if (id === 'space') b.querySelector('span:last-child').textContent = vp.space === 'world' ? 'World Space' : 'Local Space';
    });
  }

  setTool(t) {
    this.viewport.setTool(t);
    this.updateRibbonState();
    this.status(`${t[0].toUpperCase() + t.slice(1)} tool`);
  }

  togglePanel(name) {
    const map = { toolbox: 'toolbox-panel', explorer: 'explorer-panel', properties: 'properties-panel', output: 'output-panel', command: 'command-bar' };
    const el = $(map[name]);
    el.classList.toggle('hidden');
    const right = $('right-panels');
    const expOpen = !$('explorer-panel').classList.contains('hidden');
    const propOpen = !$('properties-panel').classList.contains('hidden');
    right.classList.toggle('hidden', !expOpen && !propOpen);
    $('right-splitter').classList.toggle('hidden', !expOpen || !propOpen);
    if (name === 'toolbox' && !el.classList.contains('hidden')) this.renderToolbox();
    this.viewport.resize();
  }

  renderToolbox() {
    const grid = $('toolbox');
    const q = $('toolbox-filter').value.toLowerCase();
    // Category chips above the grid.
    let cats = $('toolbox-cats');
    if (!cats) { cats = h('div', { class: 'tb-cats', id: 'toolbox-cats' }); grid.before(cats); }
    this.toolboxCat = this.toolboxCat || 'All';
    cats.replaceChildren(...TOOLBOX_CATEGORIES.map((c) => h('button', { class: c === this.toolboxCat ? 'on' : '', text: c, onclick: () => { this.toolboxCat = c; this.renderToolbox(); } })));
    grid.replaceChildren(...TOOLBOX.filter((t) => t.name.toLowerCase().includes(q) && (this.toolboxCat === 'All' || t.cat === this.toolboxCat)).map((t) => {
      const img = h('img', { alt: '' });
      toolboxThumb(t).then((u) => { if (u) img.src = u; else img.replaceWith(h('div', { class: 'ic', style: 'width:88px;height:88px', html: t.cat === 'Weapons' ? '<div style="font-size:52px;text-align:center;line-height:88px">🧰</div>' : CLASS_ICONS.script })); });
      return h('div', { class: 'tb-item', title: `Insert ${t.name}`, onclick: () => {
        if (this.playing) return;
        const inst = t.build();
        this.insert(inst);
        if (inst.IsA('BaseScript')) this.openScript(inst);
      } }, img, t.name);
    }));
  }

  // ------------------------------------------------------------ keyboard
  onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F5') { e.preventDefault(); if (e.shiftKey) this.stop(); else this.play(); return; }
    if (this.playing) return;
    const typing = e.target.closest && e.target.closest('input, textarea, .CodeMirror');
    if (typing) return;
    const k = e.key.toLowerCase();
    const map = {
      z: () => this.history.undo(), y: () => this.history.redo(),
      c: () => this.copy(), x: () => this.cut(), v: () => (e.shiftKey ? this.paste(this.selection[0]) : this.paste()),
      d: () => this.duplicate(), g: () => this.group(), u: () => this.ungroup(), s: () => this.publish(),
      1: () => this.setTool('select'), 2: () => this.setTool('move'), 3: () => this.setTool('scale'), 4: () => this.setTool('rotate'),
      r: () => this.rotateSelection('y'), t: () => this.rotateSelection('x'), n: () => this.startPage(), o: () => this.startPage('open'),
      l: () => { this.viewport.space = this.viewport.space === 'world' ? 'local' : 'world'; this.viewport.updateGizmo(); this.updateRibbonState(); },
    };
    if (ctrl && e.shiftKey && k === 'x') { e.preventDefault(); $('explorer-filter').focus(); return; }
    if (ctrl && e.shiftKey && k === 'p') { e.preventDefault(); $('properties-filter').focus(); return; }
    if (ctrl && map[k]) { e.preventDefault(); map[k](); if (k === 'z' || k === 'y') this.editor.rebind(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelection(); return; }
    if (e.key === 'F2' && this.selection[0]) { e.preventDefault(); this.explorer.rename(this.selection[0]); return; }
    if (k === 'f' && document.activeElement === this.viewport.canvas) { this.viewport.focusSelection(); }
  }

  // Studio needs a mouse, keyboard and a big screen; say so on phones.
  phoneGate() {
    const small = Math.min(innerWidth, innerHeight) < 600 && matchMedia('(pointer: coarse)').matches;
    if (!small || sessionStorage.getItem('robis.studioOnPhone')) return Promise.resolve();
    return new Promise((resolve) => {
      const gate = h('div', { class: 'phone-gate' },
        h('img', { src: '/img/icon.svg', alt: '' }),
        h('h2', { text: 'Robis Studio works best on a computer' }),
        h('p', { text: 'Building needs a mouse, a keyboard and a big screen. You can still play every game on your phone!' }),
        h('a', { class: 'sbtn primary', href: '/games', text: 'Play games' }),
        h('button', { class: 'sbtn', text: 'Open Studio anyway', onclick: () => { try { sessionStorage.setItem('robis.studioOnPhone', '1'); } catch { /* ignore */ } gate.remove(); resolve(); } }));
      document.body.append(gate);
    });
  }

  // ------------------------------------------------------------ boot
  async init() {
    this.me = await getMe();
    if (!this.me) { location.href = '/?returnUrl=' + encodeURIComponent(location.pathname + location.search); return; }
    await this.phoneGate();
    $('studio-user').append(h('span', { text: this.me.username }), h('a', { href: '/develop', text: 'Create page' }));
    this.viewport = new Viewport(this, $('viewport'));
    this.explorer = new Explorer(this, $('explorer'), $('explorer-filter'));
    this.properties = new Properties(this, $('properties'), $('properties-filter'), $('prop-target'));
    this.editor = new ScriptEditor(this, $('doc-tabs'), $('doc-area'), $('viewport'));
    this.viewport.setGame(this.game);
    this.explorer.setGame(this.game);
    this.buildRibbon();

    this.on('selection', () => {
      if (this.playing) return;
      this.explorer.render();
      this.properties.setTargets(this.selection);
      this.viewport.onSelectionChanged();
      $('status-right').textContent = this.selection.length ? `${this.selection.length} selected` : '';
    });
    this.game.on('changed', (inst) => { if (!this.playing && this.isSelected(inst)) this.properties.refreshValues(); });
    this.game.on('removing', (inst) => {
      if (this.suspendEvents) return;
      if (this.isSelected(inst)) { this.selection = this.selection.filter((i) => i !== inst); queueMicrotask(() => this.emit('selection')); }
    });
    this.on('history', () => this.updateTitle());
    // Team Create presence in the status bar.
    const teamEl = h('span', { class: 'team-status' });
    $('statusbar').insertBefore(teamEl, $('status-right'));
    this.on('team', () => {
      const users = (this.team && this.team.users) || [];
      teamEl.textContent = users.length > 1 ? `👥 Team Create: ${users.map((u) => u.name).join(', ')}` : '';
    });

    addEventListener('keydown', (e) => this.onKey(e));
    addEventListener('beforeunload', (e) => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    for (const b of document.querySelectorAll('.panel-close')) b.onclick = () => this.togglePanel(b.dataset.panel);
    $('output-clear').onclick = () => $('output').replaceChildren();
    $('toolbox-filter').addEventListener('input', () => this.renderToolbox());
    $('toolbox-filter').addEventListener('keydown', (e) => e.stopPropagation());
    // Multi-line: pasted scripts keep their line breaks; Enter runs, Shift+Enter adds a line.
    const growCmd = () => { const t = $('command-input'); t.style.height = '24px'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; };
    $('command-input').addEventListener('input', growCmd);
    $('command-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('command-bar').requestSubmit(); }
    });
    $('command-bar').addEventListener('submit', (e) => {
      e.preventDefault();
      const src = $('command-input').value.trim();
      if (!src) return;
      $('command-input').value = '';
      growCmd();
      this.log('info', '> ' + src);
      if (this.playing && this.client) this.client.send({ t: 'exec', src });
      else this.log('warn', 'The command bar runs Lua on the test server. Press Play (F5) first.');
    });
    // Splitter between Explorer and Properties
    const split = $('right-splitter');
    split.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const right = $('right-panels').getBoundingClientRect();
      const move = (ev) => { $('properties-panel').style.height = Math.max(80, Math.min(right.height - 80, right.bottom - ev.clientY)) + 'px'; };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
    this.renderToolbox();

    const params = new URLSearchParams(location.search);
    if (params.get('gameId')) await this.openGame(+params.get('gameId'), +params.get('place') || 0);
    else {
      await this.newFromTemplate('baseplate');
      this.startPage();
    }
    this.log('info', 'Robis Studio ready. Press F5 to test your game, Ctrl+S to publish.');
  }
}

const studio = new Studio();
window.studio = studio;
studio.init();
