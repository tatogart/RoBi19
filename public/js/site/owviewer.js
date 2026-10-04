// The Overwatch replay player: a small arena with walls, bots that run, jump
// and shoot laser tag, the suspect marked in red. Play / pause, speed, a
// timeline, follow-the-suspect camera and X-ray walls.
import * as THREE from 'three';
import { buildAvatar } from '../render/avatar.js';
import { el } from './ui.js';
import { tr } from '../i18n.js';

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 28px Source Sans Pro, Arial';
  g.textAlign = 'center';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 128, 40);
  g.fillStyle = color; g.fillText(text, 128, 40);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(6, 1.5, 1);
  s.renderOrder = 10;
  return s;
}

export function createViewer(root, rp, { onProgress } = {}) {
  const canvas = el('canvas', { class: 'ow-canvas' });
  const time = el('input', { type: 'range', min: 0, max: rp.frames.length - 1, value: 0, step: 1, class: 'ow-time' });
  const clock = el('span', { class: 'ow-clock no-i18n', text: '0:00' });
  const playBtn = el('button', { class: 'btn btn-small', text: '❚❚' });
  const speedBtn = el('button', { class: 'btn btn-small', text: '1x' });
  const camBtn = el('button', { class: 'btn btn-small on', text: tr('🎯 Follow suspect') });
  const xrayBtn = el('button', { class: 'btn btn-small', text: tr('👁 X-ray walls') });
  const restart = el('button', { class: 'btn btn-small', text: '⟲' });
  root.replaceChildren(el('div', { class: 'ow-stage' }, canvas, el('div', { class: 'ow-legend' }, el('span', { class: 'ow-sus', text: tr('SUSPECT') }), ' ', el('b', { class: 'no-i18n', text: rp.bots[rp.suspect].name }))),
    el('div', { class: 'ow-controls' }, playBtn, restart, time, clock, speedBtn, camBtn, xrayBtn));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fd3ff');
  scene.fog = new THREE.Fog('#9fd3ff', 120, 260);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(40, 80, 30);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70 });
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const A = rp.arena;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(A * 2, 1, A * 2), new THREE.MeshLambertMaterial({ color: '#5b8f4f' }));
  floor.position.y = -0.5; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(A * 2, A / 2, 0x3f6b37, 0x4c7d44); grid.position.y = 0.02; scene.add(grid);
  const wallMats = [];
  for (const w of rp.walls) {
    const m = new THREE.MeshLambertMaterial({ color: w.color, transparent: true, opacity: 1 });
    wallMats.push(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), m);
    b.position.set(w.x, w.h / 2, w.z); b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
  }
  for (const [x, z, sx, sz] of [[0, -A, A * 2, 1], [0, A, A * 2, 1], [-A, 0, 1, A * 2], [A, 0, 1, A * 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 3, sz), new THREE.MeshLambertMaterial({ color: '#635f62' }));
    b.position.set(x, 1.5, z); scene.add(b);
  }
  const bots = rp.bots.map((b, i) => {
    const av = buildAvatar({ bodyColors: b.colors, items: [] }, { pet: false });
    scene.add(av.group);
    av.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const tag = nameSprite(b.name, i === rp.suspect ? '#ff4d4d' : '#ffffff');
    scene.add(tag);
    let ring = null;
    if (i === rp.suspect) {
      ring = new THREE.Mesh(new THREE.RingGeometry(2, 2.5, 32), new THREE.MeshBasicMaterial({ color: '#ff3b3b', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2; scene.add(ring);
    }
    return { av, tag, ring, flash: 0, lastAnim: 0 };
  });
  // laser beams
  const beams = [];
  const beamMat = (hit) => new THREE.LineBasicMaterial({ color: hit ? '#ff3b3b' : '#ffd23b', transparent: true });
  const poofs = [];

  let f = 0, playing = true, speed = 1, follow = true, maxSeen = 0, acc = 0;
  let yaw = 0.6, pitch = 0.65, dist = 55;
  const target = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 600);

  const frameAt = (k) => rp.frames[Math.max(0, Math.min(rp.frames.length - 1, k))];
  const shotsByFrame = new Map();
  for (const s of rp.shots) { if (!shotsByFrame.has(s.f)) shotsByFrame.set(s.f, []); shotsByFrame.get(s.f).push(s); }
  const respawnSet = new Set(rp.respawns.map((r) => r.f + ':' + r.bot));

  const fireShots = (k) => {
    for (const s of shotsByFrame.get(k) || []) {
      const fr = frameAt(k);
      const a = new THREE.Vector3(fr[s.from * 5], fr[s.from * 5 + 1] + 0.6, fr[s.from * 5 + 2]);
      const b = new THREE.Vector3(fr[s.to * 5] + s.mx, fr[s.to * 5 + 1] + 0.2, fr[s.to * 5 + 2] + s.mz);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), beamMat(s.hit));
      scene.add(line);
      beams.push({ line, life: 0.25 });
      if (s.hit) bots[s.to].flash = 0.3;
    }
    for (let i = 0; i < bots.length; i++) if (respawnSet.has(k + ':' + i)) {
      const fr = frameAt(k - 1);
      const p = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
      p.position.set(fr[i * 5], fr[i * 5 + 1], fr[i * 5 + 2]);
      scene.add(p); poofs.push({ p, life: 0.5 });
    }
  };
  const fmt = (k) => { const s = Math.floor(k / rp.fps); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const seek = (k) => { f = Math.max(0, Math.min(rp.frames.length - 1, k)); acc = 0; time.value = String(Math.floor(f)); };

  playBtn.onclick = () => { playing = !playing; if (playing && f >= rp.frames.length - 1) seek(0); playBtn.textContent = playing ? '❚❚' : '▶'; };
  restart.onclick = () => { seek(0); playing = true; playBtn.textContent = '❚❚'; };
  speedBtn.onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 0.5 : speed === 0.5 ? 0.25 : 1; speedBtn.textContent = speed + 'x'; };
  camBtn.onclick = () => { follow = !follow; camBtn.classList.toggle('on', follow); camBtn.textContent = follow ? tr('🎯 Follow suspect') : tr('🗺 Whole map'); };
  let xray = false;
  xrayBtn.onclick = () => { xray = !xray; xrayBtn.classList.toggle('on', xray); for (const m of wallMats) m.opacity = xray ? 0.25 : 1; };
  time.addEventListener('input', () => { seek(+time.value); });
  // drag to turn the camera, wheel to zoom
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; yaw -= (e.clientX - drag[0]) * 0.008; pitch = Math.max(0.15, Math.min(1.45, pitch + (e.clientY - drag[1]) * 0.006)); drag = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(12, Math.min(140, dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

  let last = performance.now(), raf = 0, prevInt = -1;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) {
      acc += dt * rp.fps * speed;
      while (acc >= 1) { acc -= 1; if (f < rp.frames.length - 1) f++; else { playing = false; playBtn.textContent = '▶'; acc = 0; break; } }
      time.value = String(f);
    }
    if (f !== prevInt) { if (f > prevInt && f - prevInt < 6) for (let k = prevInt + 1; k <= f; k++) fireShots(k); prevInt = f; }
    maxSeen = Math.max(maxSeen, f);
    onProgress && onProgress(maxSeen / (rp.frames.length - 1));
    clock.textContent = `${fmt(f)} / ${fmt(rp.frames.length - 1)}`;
    // positions: between this frame and the next (smooth)
    const a = frameAt(f), b = frameAt(f + 1), t = playing ? acc : 0;
    bots.forEach((bot, i) => {
      const o = i * 5;
      const jump = Math.hypot(b[o] - a[o], b[o + 2] - a[o + 2]) > 8; // a teleport / respawn: no sliding
      const k = jump ? 0 : t;
      const x = a[o] + (b[o] - a[o]) * k, y = a[o + 1] + (b[o + 1] - a[o + 1]) * k, z = a[o + 2] + (b[o + 2] - a[o + 2]) * k;
      let dr = b[o + 3] - a[o + 3]; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      bot.av.group.position.set(x, y, z);
      bot.av.group.rotation.y = a[o + 3] + dr * k;
      const anim = a[o + 4] === 2 ? 'jump' : a[o + 4] === 1 ? 'walk' : 'idle';
      bot.av.animate(playing ? anim : 'idle', playing ? dt * speed : 0, anim === 'walk' ? 16 : 0);
      bot.tag.position.set(x, y + 3.6, z);
      if (bot.ring) { bot.ring.position.set(x, 0.05, z); bot.ring.material.opacity = 0.5 + Math.sin(now / 200) * 0.3; }
      bot.flash = Math.max(0, bot.flash - dt);
      bot.av.group.visible = !(bot.flash > 0 && Math.floor(now / 60) % 2);
      if (i === rp.suspect && follow) target.lerp(new THREE.Vector3(x, y, z), Math.min(1, dt * 6));
    });
    if (!follow) target.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 3));
    for (const bm of beams.splice(0)) { bm.life -= dt; if (bm.life > 0) { bm.line.material.opacity = bm.life * 4; beams.push(bm); } else { scene.remove(bm.line); bm.line.geometry.dispose(); bm.line.material.dispose(); } }
    for (const pf of poofs.splice(0)) { pf.life -= dt; if (pf.life > 0) { pf.p.scale.setScalar(1 + (0.5 - pf.life) * 3); pf.p.material.opacity = pf.life; poofs.push(pf); } else { scene.remove(pf.p); } }
    const d = follow ? dist * 0.55 : dist * 1.4;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(target.x, target.y + 2, target.z);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      for (const b of bots) b.av.dispose();
      renderer.dispose();
    },
  };
}
