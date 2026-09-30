import * as THREE from 'three';
import { api, getMe } from '../api.js';
import { el, toast } from '../ui.js';
import { DataModel } from '/shared/engine/instances.js';
import { loadPlace } from '/shared/engine/serialize.js';
import { SceneSync } from '../../render/scene.js';
import { Environment } from '../../render/sky.js';

const params = new URLSearchParams(location.search);
const returnUrl = params.get('returnUrl') || '/home';

getMe().then((me) => { if (me) location.href = returnUrl; });

// ---- birthday selects (just for the nostalgia)
const f = document.getElementById('signup-form');
['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  .forEach((m) => f.month.append(el('option', { text: m })));
for (let d = 1; d <= 31; d++) f.day.append(el('option', { text: d }));
for (let y = 2019; y >= 1950; y--) f.year.append(el('option', { text: y }));

f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('signup-error');
  err.textContent = '';
  try {
    await api.post('/auth/signup', { username: f.username.value.trim(), password: f.password.value });
    location.href = returnUrl;
  } catch (ex) { err.textContent = ex.message; }
});

const lf = document.getElementById('login-form');
lf.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.post('/auth/login', { username: lf.username.value.trim(), password: lf.password.value });
    location.href = returnUrl;
  } catch (ex) { toast(ex.message, 'error'); }
});
if (params.get('signup')) f.username.focus();

// Phone version: each phone is its own world, so point to the shared server.
if (window.ROBIS_ONLINE_URL) {
  f.prepend(el('a', { class: 'btn btn-green btn-large online-link', href: window.ROBIS_ONLINE_URL, text: 'Play online with friends' }),
    el('p', { class: 'online-note', text: 'This app keeps a private world on your phone. Tap above to join the shared online server where your friends are.' }));
}

document.querySelector('.footer').innerHTML = '©2019 Robis — an open-source fan tribute to 2019-era game platforms. Not affiliated with Roblox Corporation.';

// ---- live 3D background: slowly orbit around the Crossroads map
async function hero() {
  const canvas = document.getElementById('hero-canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch { return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 10000);
  const env = new Environment(scene, renderer);
  const res = await fetch('/api/games/1/preview');
  if (!res.ok) return;
  const { place } = await res.json();
  const game = new DataModel();
  loadPlace(game, place);
  env.apply(game.GetService('Lighting'));
  const sync = new SceneSync(game, scene);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
  let t = 0, last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt * 0.05;
    cam.position.set(Math.cos(t) * 110, 45, Math.sin(t) * 110 - 30);
    cam.lookAt(0, 12, -30);
    env.setFocus(new THREE.Vector3(0, 0, -30));
    env.update(dt, cam);
    sync.update(dt);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
hero();
