// Client-side thumbnail renderer: avatar headshots, full bodies, catalog items
// and game thumbnails, all drawn with one shared offscreen WebGL renderer.
import * as THREE from 'three';
import { buildAvatar, preloadAvatar, buildPet } from './avatar.js';

let renderer = null;
let queue = Promise.resolve();
const cache = new Map();

function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

// Rendered avatar/item pictures are kept in IndexedDB, so pages don't draw
// the same headshot again on every visit. Bump THUMB_VERSION when the look changes.
const THUMB_VERSION = 5;
const PERSIST = /^(head|body|item):/;
let dbPromise = null;
function thumbDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open('robis-thumbs', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('t');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
function hashKey(str) {
  let h1 = 0x811c9dc5, h2 = 0x12345;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 + c, 0x5bd1e995) >>> 0; }
  return THUMB_VERSION + ':' + h1.toString(36) + h2.toString(36) + ':' + str.length;
}
async function stored(key) {
  const db = await thumbDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction('t').objectStore('t').get(hashKey(key));
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
let writes = 0;
async function store(key, url) {
  if (!url || typeof url !== 'string' || !url.startsWith('data:')) return;
  const db = await thumbDb();
  if (!db) return;
  try {
    const os = db.transaction('t', 'readwrite').objectStore('t');
    os.put(url, hashKey(key));
    // Keep the cache from growing forever: now and then drop it when it gets big.
    if (++writes % 50 === 0) {
      const c = os.count();
      c.onsuccess = () => { if (c.result > 600) os.clear(); };
    }
  } catch { /* quota or private mode */ }
}

function schedule(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const draw = () => (queue = queue.then(fn, fn)).catch((e) => { console.warn('thumbnail failed', e); return ''; });
  const p = PERSIST.test(key)
    ? stored(key).then((hit) => hit || draw().then((url) => { store(key, url); return url; }))
    : draw();
  cache.set(key, p);
  return p;
}

function studioLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, -6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfdcff, 0.8);
  rim.position.set(4, 3, 5);
  scene.add(rim);
}

function render(scene, camera, w, h, type = 'image/png') {
  const r = getRenderer();
  r.setSize(w, h, false);
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  return r.domElement.toDataURL(type, 0.9);
}

export function avatarKey(avatar) { return JSON.stringify(avatar || {}); }

// Round headshot used everywhere on the website.
export function avatarHeadshot(avatar, size = 150) {
  return schedule('head:' + size + avatarKey(avatar), async () => {
    const scene = new THREE.Scene();
    studioLights(scene);
    await preloadAvatar(avatar);
    const av = buildAvatar(avatar, { shadow: false });
    av.group.rotation.y = Math.PI + 0.35; // face the camera (avatar faces -Z)
    scene.add(av.group);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const headY = av.pivots.head.position.y;
    cam.position.set(0, headY + 0.55, 5.3);
    cam.lookAt(0, headY + 0.15, 0);
    const url = render(scene, cam, size, size);
    av.dispose();
    return url;
  });
}

export function avatarFullBody(avatar, size = 420, opts = {}) {
  return schedule('body:' + size + (opts.angle || 0) + avatarKey(avatar), async () => {
    const scene = new THREE.Scene();
    studioLights(scene);
    await preloadAvatar(avatar);
    const av = buildAvatar(avatar, { shadow: false });
    av.group.rotation.y = Math.PI + 0.45 + (opts.angle || 0);
    if (av.gear) av.animate('idle', 0.5, 0);
    scene.add(av.group);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    cam.position.set(0, 0.6, 13.5);
    cam.lookAt(0, -0.2, 0);
    const url = render(scene, cam, size, size);
    av.dispose();
    return url;
  });
}

// Catalog item preview: the item on a neutral grey mannequin.
export function itemThumbnail(item, size = 200) {
  return schedule('item:' + size + item.id + JSON.stringify(item.data), async () => {
    if (item.type === 'Pet') {
      const scene = new THREE.Scene();
      studioLights(scene);
      const pet = buildPet(item.data);
      if (pet) { pet.rotation.y = Math.PI + 0.7; scene.add(pet); }
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      cam.position.set(0, 1.9, 6.4); cam.lookAt(0, 0.95, 0);
      const url = render(scene, cam, size, size);
      pet?.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      return url;
    }
    const grey = { head: '#c8c8c8', torso: '#c8c8c8', leftArm: '#c8c8c8', rightArm: '#c8c8c8', leftLeg: '#c8c8c8', rightLeg: '#c8c8c8' };
    const avatar = { bodyColors: grey, items: [{ id: item.id, type: item.type, data: item.data }] };
    const scene = new THREE.Scene();
    studioLights(scene);
    await preloadAvatar(avatar);
    const av = buildAvatar(avatar, { shadow: false });
    scene.add(av.group);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const t = item.type;
    if (item.data && item.data.model === 'wings') {
      av.group.rotation.y = 0.5;
      cam.position.set(0, 1.2, 10); cam.lookAt(0, 0.3, 0);
    } else if (t === 'Hat' || t === 'Hair' || t === 'Face') {
      for (const k of ['Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg']) av.limbs[k].visible = false;
      av.group.rotation.y = Math.PI + (t === 'Face' ? 0 : 0.6);
      const y = av.pivots.head.position.y + (t === 'Face' ? 0 : 0.35);
      cam.position.set(0, y + 0.8, t === 'Face' ? 4.2 : 6.2);
      cam.lookAt(0, y, 0);
    } else if (t === 'Gear') {
      av.animate('idle', 0.5, 0);
      av.group.rotation.y = Math.PI + 1.1;
      cam.position.set(0, 1, 11); cam.lookAt(0.5, 0, 0);
    } else if (t === 'Pants') {
      av.group.rotation.y = Math.PI + 0.3;
      av.limbs.Head.visible = false;
      cam.position.set(0, -0.8, 11); cam.lookAt(0, -1.2, 0);
    } else {
      av.group.rotation.y = Math.PI + 0.3;
      av.limbs.Head.visible = false;
      cam.position.set(0, 0.6, 9); cam.lookAt(0, 0, 0);
    }
    const url = render(scene, cam, size, size);
    av.dispose();
    return url;
  });
}

// ------------------------------------------------------------ games
const PALETTE = ['#e8413c', '#2b8be0', '#f5a623', '#3fb950', '#8b5cf6', '#ec4899', '#14b8a6'];
function placeholder(g) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = PALETTE[g.id % PALETTE.length];
  const grd = ctx.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, col); grd.addColorStop(1, '#222');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
  ctx.translate(128, 110); ctx.rotate(Math.PI / 12);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-40, -40, 80, 80);
  ctx.fillStyle = col; ctx.fillRect(-12, -12, 24, 24);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.font = '700 22px "Source Sans Pro", Arial'; ctx.textAlign = 'center';
  ctx.fillText(g.name.slice(0, 20), 128, 210);
  return c.toDataURL();
}

export function gameThumbnail(g, size = 384) {
  if (g.hasThumbnail) {
    const url = `/api/games/${g.id}/thumbnail?v=${g.updated}`;
    // In the standalone (phone) build the API lives inside the page, so <img>
    // can't load it directly: fetch it and hand out a blob URL instead.
    if (!window.ROBIS_STANDALONE) return Promise.resolve(url);
    return schedule('gameimg:' + g.id + ':' + g.updated, async () => URL.createObjectURL(await (await fetch(url)).blob()));
  }
  return schedule('game:' + g.id + ':' + g.updated, async () => {
    try {
      const res = await fetch(`/api/games/${g.id}/preview`);
      if (!res.ok) return placeholder(g);
      const { place } = await res.json();
      const url = await renderPlace(place, size);
      // Store it so everyone else gets it for free.
      fetch(`/api/games/${g.id}/thumbnail`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) }).catch(() => {});
      return url;
    } catch (e) {
      console.warn(e);
      return placeholder(g);
    }
  });
}

// Renders a place from a nice angle (used by Studio publish and the website).
export async function renderPlace(place, size = 384, opts = {}) {
  const [{ DataModel }, { loadPlace }, { SceneSync }, { Environment }] = await Promise.all([
    import('/shared/engine/instances.js'), import('/shared/engine/serialize.js'), import('./scene.js'), import('./sky.js'),
  ]);
  const game = opts.game || new DataModel();
  if (!opts.game) loadPlace(game, place);
  const scene = new THREE.Scene();
  const r = getRenderer();
  const env = new Environment(scene, r);
  env.apply(game.GetService('Lighting'));
  const sync = new SceneSync(game, scene);
  // Frame the interesting part of the map (ignore giant baseplates).
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const m of sync.meshes.values()) {
    const s = m.userData.inst._p.Size;
    if (s.X * s.Z > 40000) continue;
    tmp.setFromObject(m);
    box.union(tmp);
  }
  if (box.isEmpty()) box.set(new THREE.Vector3(-20, 0, -20), new THREE.Vector3(20, 10, 20));
  const center = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  // `fit`: frame the whole object (toolbox previews); otherwise a map overview.
  const radius = opts.fit ? Math.max(1.5, sz.length() / 2) * 1.85
    : Math.min(260, Math.max(opts.minRadius ?? 20, Math.max(sz.x, sz.z) * 0.55, sz.y));
  const cam = new THREE.PerspectiveCamera(45, 1, 0.5, 10000);
  cam.position.set(center.x + radius * 0.9, center.y + radius * 0.65, center.z + radius * 0.9);
  cam.lookAt(center.x, center.y - sz.y * 0.1, center.z);
  env.setFocus(center);
  env.update(0, cam);
  cam.updateMatrixWorld();
  sync.assignLights(cam);
  const url = render(scene, cam, size, size, 'image/jpeg');
  sync.dispose();
  // Part materials/geometries are shared caches, so only free the sky.
  env.dome.geometry.dispose();
  env.dome.material.dispose();
  return url;
}
