import * as THREE from 'three';
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, itemCard, toast } from '../ui.js';
import { buildAvatar } from '../../render/avatar.js';
import { BODY_COLORS, WEAR_LIMITS } from '/shared/avatar.js';

const me = await initPage({ active: 'avatar' });
const app = document.getElementById('app');

let { avatar } = await api.get('/avatar');
const { items } = await api.get(`/users/${me.id}/inventory`);
const byId = new Map(items.map((i) => [i.id, i]));

// ---------------------------------------------------------------- 3D preview
const canvas = el('canvas', { class: 'avatar-canvas' });
const preview = el('div', { class: 'panel avatar-preview' }, canvas,
  el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
    el('span', { class: 'pill', text: 'R6' }), el('span', { class: 'small muted', text: 'Drag to rotate' })));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(-4, 8, -6);
key.castShadow = true;
scene.add(key);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3;
floor.receiveShadow = true;
scene.add(floor);
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
cam.position.set(0, 1.2, 15);
cam.lookAt(0, -0.3, 0);
let av = null, yaw = Math.PI + 0.4;

function toResolved() {
  return { bodyColors: avatar.bodyColors, items: avatar.wearing.map((id) => byId.get(id)).filter(Boolean).map((i) => ({ id: i.id, type: i.type, data: i.data })) };
}
function rebuild() {
  if (av) { scene.remove(av.group); av.dispose(); }
  av = buildAvatar(toResolved());
  scene.add(av.group);
}
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (dragging) { yaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
canvas.addEventListener('pointerup', () => { dragging = false; });
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  if (av) { av.group.rotation.y = yaw; av.animate('idle', dt, 0); }
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- saving
let saveTimer = null;
function save() {
  rebuild();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { ({ avatar } = await api.put('/avatar', avatar)); } catch (e) { toast(e.message, 'error'); }
  }, 400);
}

// ---------------------------------------------------------------- editor tabs
const TABS = [['Recent', null], ['Hats', ['Hat']], ['Hair', ['Hair']], ['Faces', ['Face']], ['Shirts', ['Shirt']], ['Pants', ['Pants']], ['T-Shirts', ['TShirt']], ['Gear', ['Gear']], ['Pets', ['Pet']], ['Body Colors', 'body']];
const tabs = el('div', { class: 'tabs' });
const body = el('div', { class: 'panel', style: { minHeight: '360px' } });
function toggleWear(it) {
  const w = avatar.wearing;
  const i = w.indexOf(it.id);
  if (i >= 0) w.splice(i, 1);
  else {
    const same = w.filter((id) => byId.get(id)?.type === it.type);
    if (same.length >= (WEAR_LIMITS[it.type] || 1)) w.splice(w.indexOf(same[0]), 1);
    w.push(it.id);
  }
  save();
}
function showItems(types) {
  const list = types ? items.filter((i) => types.includes(i.type)) : items.slice().reverse().slice(0, 24);
  if (!list.length) { body.replaceChildren(el('div', { class: 'empty' }, 'You don\'t own any of these yet. ', el('a', { href: '/catalog', text: 'Visit the Catalog' }))); return; }
  const grid = el('div', { class: 'item-grid' });
  const draw = () => grid.replaceChildren(...list.map((it) => {
    const card = itemCard(it, { onClick: () => { toggleWear(it); draw(); }, hidePrice: true });
    if (avatar.wearing.includes(it.id)) { card.classList.add('selected'); card.append(el('span', { class: 'check', text: '✓' })); }
    return card;
  }));
  draw();
  body.replaceChildren(grid);
}
function showBody() {
  let sel = 'head';
  const parts = { head: 'Head', torso: 'Torso', leftArm: 'Left Arm', rightArm: 'Right Arm', leftLeg: 'Left Leg', rightLeg: 'Right Leg' };
  const fig = el('div', { class: 'body-fig' });
  const drawFig = () => fig.replaceChildren(...Object.keys(parts).map((k) => el('button', {
    class: `bp bp-${k}` + (sel === k ? ' sel' : ''), title: parts[k], style: { background: avatar.bodyColors[k] },
    onclick: () => { sel = k; drawFig(); },
  })));
  drawFig();
  const palette = el('div', { class: 'palette' }, BODY_COLORS.map((c) => el('button', {
    class: 'swatch', style: { background: c }, title: c,
    onclick: () => { avatar.bodyColors[sel] = c; drawFig(); save(); },
  })));
  const all = el('button', { class: 'btn btn-small', text: 'Apply to whole body', onclick: () => { for (const k of Object.keys(parts)) avatar.bodyColors[k] = avatar.bodyColors[sel]; drawFig(); save(); } });
  body.replaceChildren(el('div', { class: 'row wrap', style: { alignItems: 'flex-start', gap: '30px' } },
    el('div', {}, el('div', { class: 'small muted', text: 'Click a body part, then a color' }), fig, all), palette));
}
for (const [label, types] of TABS) {
  const b = el('button', { text: label, onclick: () => {
    [...tabs.children].forEach((x) => x.classList.toggle('active', x === b));
    if (types === 'body') showBody(); else showItems(types);
  } });
  tabs.append(b);
}

app.append(el('h1', { text: 'Avatar Editor' }),
  el('div', { class: 'avatar-layout' }, preview, el('div', { class: 'avatar-editor' }, tabs, body)));
rebuild();
tabs.children[1].click();

const style = document.createElement('style');
style.textContent = `
.avatar-layout { display: flex; gap: 20px; align-items: flex-start; }
.avatar-preview { width: 340px; flex: none; }
.avatar-canvas { width: 100%; height: 420px; display: block; cursor: grab; background: radial-gradient(#fff, #e8e8e8); border-radius: 3px; }
.avatar-editor { flex: 1; min-width: 0; }
.body-fig { position: relative; width: 160px; height: 200px; margin: 12px 0; }
.bp { position: absolute; border: 2px solid rgba(0,0,0,.2); cursor: pointer; border-radius: 2px; }
.bp.sel { outline: 3px solid var(--blue); z-index: 2; }
.bp-head { left: 58px; top: 0; width: 44px; height: 40px; border-radius: 10px; }
.bp-torso { left: 40px; top: 44px; width: 80px; height: 80px; }
.bp-leftArm { left: 0; top: 44px; width: 38px; height: 80px; }
.bp-rightArm { left: 122px; top: 44px; width: 38px; height: 80px; }
.bp-leftLeg { left: 40px; top: 126px; width: 39px; height: 74px; }
.bp-rightLeg { left: 81px; top: 126px; width: 39px; height: 74px; }
.palette { display: grid; grid-template-columns: repeat(6, 40px); gap: 8px; }
.swatch { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(0,0,0,.15); cursor: pointer; }
.swatch:hover { transform: scale(1.1); }
@media (max-width: 860px) { .avatar-layout { flex-direction: column; align-items: stretch; } .palette { grid-template-columns: repeat(6, 36px); } .swatch { width: 36px; height: 36px; } .avatar-preview { width: 100%; } .avatar-canvas { height: 320px; } }
`;
document.head.append(style);
