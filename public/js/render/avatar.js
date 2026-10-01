// Classic blocky R6 avatar: body colours, clothing textures, faces, hats and animation.
import * as THREE from 'three';

// ------------------------------------------------------------ resolve
export function resolveItems(avatar) {
  const r = { bodyColors: avatar?.bodyColors || {}, hats: [], face: { face: 'smile' }, shirt: null, pants: null, tshirt: null, gear: null, pet: null };
  for (const it of avatar?.items || []) {
    if (it.type === 'Hat' || it.type === 'Hair') r.hats.push(it.data);
    else if (it.type === 'Face') r.face = it.data;
    else if (it.type === 'Shirt') r.shirt = it.data;
    else if (it.type === 'Pants') r.pants = it.data;
    else if (it.type === 'TShirt') r.tshirt = it.data;
    else if (it.type === 'Gear') r.gear = it.data;
    else if (it.type === 'Pet') r.pet = it.data;
  }
  return r;
}

// ------------------------------------------------------------ custom pictures (BETA items)
const IMAGES = new Map(); // data URL -> Promise<HTMLImageElement>
function loadImage(url) {
  if (!IMAGES.has(url)) {
    IMAGES.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return IMAGES.get(url);
}
const loaded = new Map(); // data URL -> HTMLImageElement, once ready
async function ready(url) { const img = await loadImage(url); if (img) loaded.set(url, img); return img; }
// Resolves once every custom picture this avatar uses is loaded (for thumbnails).
export function preloadAvatar(avatar) {
  const urls = (avatar?.items || []).map((i) => i.data && i.data.image).filter(Boolean);
  return Promise.all(urls.map(ready));
}
function drawPicture(ctx, url, x, y, w, h) {
  const img = loaded.get(url);
  if (!img) return false;
  const k = Math.min(w / img.width, h / img.height);
  const dw = img.width * k, dh = img.height * k;
  ctx.imageSmoothingEnabled = img.width > 48; // keep pixel art crisp
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

// ------------------------------------------------------------ canvas helpers
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

// ------------------------------------------------------------ faces
export function drawFace(ctx, w, h, face) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#111';
  const eye = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const smile = (y, r, a0 = 0.15, a1 = 0.85, lw = 8) => { ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, y, r, Math.PI * a0, Math.PI * a1); ctx.stroke(); };
  switch (face) {
    case 'epic':
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(cx - 70, cy - 55); ctx.lineTo(cx - 25, cy - 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 70, cy - 55); ctx.lineTo(cx + 25, cy - 40); ctx.stroke();
      eye(cx - 42, cy - 18, 14, 16); eye(cx + 42, cy - 18, 14, 16);
      ctx.fillStyle = '#fff'; eye(cx - 38, cy - 22, 5, 5); eye(cx + 46, cy - 22, 5, 5);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.moveTo(cx - 75, cy + 15); ctx.quadraticCurveTo(cx, cy + 95, cx + 75, cy + 15); ctx.quadraticCurveTo(cx, cy + 40, cx - 75, cy + 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 50, cy + 25, 100, 10);
      break;
    case 'man':
      eye(cx - 32, cy - 12, 9, 11); eye(cx + 32, cy - 12, 9, 11);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx - 48, cy - 42); ctx.lineTo(cx - 18, cy - 38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 48, cy - 42); ctx.lineTo(cx + 18, cy - 38); ctx.stroke();
      smile(cy + 10, 30, 0.25, 0.75, 6);
      break;
    case 'woman':
      eye(cx - 32, cy - 10, 10, 13); eye(cx + 32, cy - 10, 10, 13);
      ctx.lineWidth = 4;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + s * (26 + i * 6), cy - 22); ctx.lineTo(cx + s * (30 + i * 9), cy - 32); ctx.stroke(); }
      ctx.fillStyle = '#d0354a';
      ctx.beginPath(); ctx.ellipse(cx, cy + 40, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a0a0'; ctx.globalAlpha = 0.5;
      eye(cx - 60, cy + 18, 14, 8); eye(cx + 60, cy + 18, 14, 8); ctx.globalAlpha = 1;
      break;
    case 'happy':
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx - 36, cy - 8, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 36, cy - 8, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 62, cy + 12); ctx.quadraticCurveTo(cx, cy + 100, cx + 62, cy + 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e06070'; ctx.beginPath(); ctx.ellipse(cx, cy + 50, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'silly':
      eye(cx - 34, cy - 14, 11, 15); ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(cx + 22, cy - 12); ctx.lineTo(cx + 48, cy - 16); ctx.stroke();
      smile(cy + 8, 36);
      ctx.fillStyle = '#e0505f'; ctx.beginPath(); ctx.ellipse(cx + 12, cy + 50, 14, 18, 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'chill':
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(cx - 52, cy - 10); ctx.lineTo(cx - 16, cy - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 52, cy - 10); ctx.lineTo(cx + 16, cy - 10); ctx.stroke();
      eye(cx - 34, cy - 4, 10, 6); eye(cx + 34, cy - 4, 10, 6);
      ctx.beginPath(); ctx.moveTo(cx - 25, cy + 38); ctx.quadraticCurveTo(cx + 5, cy + 50, cx + 32, cy + 30); ctx.stroke();
      break;
    case 'beast':
      ctx.fillStyle = '#c40000';
      ctx.beginPath(); ctx.moveTo(cx - 60, cy - 35); ctx.lineTo(cx - 15, cy - 10); ctx.lineTo(cx - 55, cy - 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 60, cy - 35); ctx.lineTo(cx + 15, cy - 10); ctx.lineTo(cx + 55, cy - 5); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.moveTo(cx - 60, cy + 25); ctx.lineTo(cx + 60, cy + 25); ctx.lineTo(cx + 40, cy + 60); ctx.lineTo(cx - 40, cy + 60); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - 52 + i * 20, cy + 25); ctx.lineTo(cx - 42 + i * 20, cy + 40); ctx.lineTo(cx - 32 + i * 20, cy + 25); ctx.fill(); }
      break;
    case 'winning':
      eye(cx - 34, cy - 14, 11, 14); eye(cx + 34, cy - 14, 11, 14);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx - 50, cy - 40); ctx.lineTo(cx - 20, cy - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 50, cy - 46); ctx.lineTo(cx + 20, cy - 36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 55, cy + 22); ctx.quadraticCurveTo(cx, cy + 65, cx + 60, cy + 10); ctx.quadraticCurveTo(cx, cy + 40, cx - 55, cy + 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 38, cy + 28, 76, 9);
      break;
    case 'shocked':
      ctx.fillStyle = '#fff'; eye(cx - 34, cy - 14, 18, 20); eye(cx + 34, cy - 14, 18, 20);
      ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx - 34, cy - 14, 18, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 34, cy - 14, 18, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#111'; eye(cx - 34, cy - 12, 7, 7); eye(cx + 34, cy - 12, 7, 7);
      eye(cx, cy + 42, 16, 20);
      break;
    case 'smile':
    default:
      eye(cx - 30, cy - 15, 11, 18); eye(cx + 30, cy - 15, 11, 18);
      smile(cy + 2, 48, 0.2, 0.8, 9);
  }
}

// ------------------------------------------------------------ clothing
function drawPattern(ctx, w, h, d, face) {
  const { color, accent } = d;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  switch (d.pattern) {
    case 'plaid':
      ctx.globalAlpha = 0.45; ctx.fillStyle = accent;
      for (let i = 0; i < w; i += 16) { ctx.fillRect(i, 0, 5, h); }
      for (let i = 0; i < h; i += 16) { ctx.fillRect(0, i, w, 5); }
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
      for (let i = 8; i < w; i += 16) { ctx.fillRect(i, 0, 1, h); ctx.fillRect(0, i, w, 1); }
      ctx.globalAlpha = 1;
      break;
    case 'stripes':
      ctx.fillStyle = accent;
      for (let i = 0; i < h; i += 12) ctx.fillRect(0, i, w, 5);
      break;
    case 'camo': {
      let s = 7;
      const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? accent : shade(color, 1.3);
        ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 6 + r() * 10, 4 + r() * 6, r() * 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'jeans':
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.15, 0); ctx.lineTo(w * 0.15, h); ctx.stroke();
      ctx.fillStyle = accent; ctx.globalAlpha = 0.4; ctx.fillRect(0, h - 6, w, 6); ctx.globalAlpha = 1;
      break;
    case 'suit':
      if (face === 'front') {
        ctx.fillStyle = '#f2f2f2';
        ctx.beginPath(); ctx.moveTo(w * 0.32, 0); ctx.lineTo(w * 0.68, 0); ctx.lineTo(w * 0.5, h * 0.6); ctx.fill();
        ctx.fillStyle = '#b3261e';
        ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.05); ctx.lineTo(w * 0.54, h * 0.05); ctx.lineTo(w * 0.56, h * 0.45); ctx.lineTo(w * 0.5, h * 0.55); ctx.lineTo(w * 0.44, h * 0.45); ctx.fill();
        ctx.fillStyle = '#555';
        for (const y of [0.65, 0.8]) { ctx.beginPath(); ctx.arc(w * 0.5, h * y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    case 'hoodie':
      if (face === 'front') {
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.roundRect(w * 0.2, h * 0.58, w * 0.6, h * 0.3, 6); ctx.fill();
        ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(w * 0.42, 2); ctx.lineTo(w * 0.4, h * 0.3); ctx.moveTo(w * 0.58, 2); ctx.lineTo(w * 0.6, h * 0.3); ctx.stroke();
      } else if (face === 'back') {
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.ellipse(w * 0.5, 0, w * 0.35, h * 0.28, 0, 0, Math.PI); ctx.fill();
      }
      break;
    case 'bc':
      if (face === 'front') {
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(w / 2, h * 0.45, w * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.floor(w * 0.22)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('BC', w / 2, h * 0.46);
      }
      break;
    default:
  }
}

function drawTShirt(ctx, w, h, g, image) {
  if (image) { drawPicture(ctx, image, w * 0.12, h * 0.1, w * 0.76, h * 0.76); return; }
  const cx = w / 2, cy = h * 0.45, s = w * 0.3;
  ctx.save();
  if (g === 'logo') {
    ctx.translate(cx, cy); ctx.rotate(Math.PI / 12);
    ctx.fillStyle = '#00a2ff'; ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
  } else if (g === 'heart') {
    ctx.fillStyle = '#e8243c';
    ctx.beginPath(); ctx.moveTo(cx, cy + s);
    ctx.bezierCurveTo(cx - s * 2, cy - s * 0.2, cx - s * 0.6, cy - s * 1.4, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.4, cx + s * 2, cy - s * 0.2, cx, cy + s); ctx.fill();
  } else if (g === 'star') {
    ctx.fillStyle = '#ffc400'; ctx.translate(cx, cy); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.fill();
  } else if (g === 'oof' || g === 'noob') {
    ctx.fillStyle = g === 'oof' ? '#111' : '#f5cd30';
    ctx.font = `900 ${Math.floor(w * 0.24)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.strokeText(g.toUpperCase(), cx, cy); ctx.fillText(g.toUpperCase(), cx, cy);
  }
  ctx.restore();
}

// Builds the six face materials for a limb box.
function limbMaterials(kind, skin, look) {
  const S = kind === 'torso' && look.tshirt && look.tshirt.image ? 128 : 64;
  const faces = ['side', 'side', 'top', 'bottom', 'back', 'front']; // +x -x +y -y +z -z
  const picture = kind === 'torso' && look.tshirt && look.tshirt.image;
  return faces.map((face) => {
    const [c, ctx] = makeCanvas(S, S);
    const paint = () => {
    ctx.fillStyle = skin; ctx.fillRect(0, 0, S, S);
    if (kind === 'torso') {
      if (look.shirt) drawPattern(ctx, S, S, look.shirt, face);
      if (face === 'bottom' && look.pants) { ctx.fillStyle = look.pants.color; ctx.fillRect(0, 0, S, S); }
      if (face === 'front' && look.tshirt) drawTShirt(ctx, S, S, look.tshirt.graphic, look.tshirt.image);
    } else if (kind === 'arm') {
      if (look.shirt && face !== 'bottom') {
        const [c2, ctx2] = makeCanvas(S, S);
        drawPattern(ctx2, S, S, look.shirt, 'side');
        const hgt = face === 'top' ? S : S * 0.72;
        ctx.drawImage(c2, 0, 0, S, hgt, 0, 0, S, hgt);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; if (face !== 'top') ctx.fillRect(0, hgt - 2, S, 2);
      }
    } else if (kind === 'leg') {
      if (look.pants) {
        drawPattern(ctx, S, S, look.pants, 'leg-' + face);
        if (look.pants.pattern === 'suit' && face !== 'top' && face !== 'bottom') {
          ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
        }
        if (face === 'bottom') { ctx.fillStyle = shade(look.pants.color, 0.5); ctx.fillRect(0, 0, S, S); }
      }
    }
    // subtle edge shading for the classic look
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    };
    paint();
    const tex = toTexture(c);
    // A custom T-shirt picture may still be loading: draw it when it arrives.
    if (picture && face === 'front' && !loaded.has(picture)) ready(picture).then(() => { paint(); tex.needsUpdate = true; });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  });
}

// ------------------------------------------------------------ head
let HEAD_GEO = null;
const HEAD_PROFILE = [[0, -0.6], [0.42, -0.6], [0.56, -0.55], [0.62, -0.42], [0.625, 0], [0.62, 0.42], [0.56, 0.55], [0.42, 0.6], [0, 0.6]];
// Head radius at height y (between the points of the profile above).
function headRadius(y) {
  const p = HEAD_PROFILE.slice(1, -1);
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) { const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]); return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t; }
  }
  return p[p.length - 1][0];
}

function headGeometry() {
  if (HEAD_GEO) return HEAD_GEO;
  const pts = HEAD_PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
  HEAD_GEO = new THREE.LatheGeometry(pts, 32);
  return HEAD_GEO;
}

function faceMesh(faceData) {
  const [c, ctx] = makeCanvas(256, 200);
  const image = faceData && faceData.image;
  const paint = () => { ctx.clearRect(0, 0, 256, 200); if (!image || !drawPicture(ctx, image, 48, 20, 160, 160)) { if (!image) drawFace(ctx, 256, 200, faceData ? faceData.face : 'smile'); } };
  paint();
  const span = 1.7;
  const g = new THREE.CylinderGeometry(0.632, 0.632, 0.84, 24, 1, true, Math.PI - span / 2, span);
  const tex = toTexture(c);
  if (image && !loaded.has(image)) ready(image).then(() => { paint(); tex.needsUpdate = true; });
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'Face';
  return mesh;
}

// ------------------------------------------------------------ accessories
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra }); }
function M(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

const HATS = {
  cap(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.SphereGeometry(0.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.color), 0, 0.28, 0));
    const brim = M(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20, 1, false, Math.PI / 2, Math.PI), mat(d.color), 0, 0.3, -0.45);
    brim.scale.set(1.2, 1, 1);
    g.add(brim);
    g.add(M(new THREE.SphereGeometry(0.08, 8, 6), mat(d.accent), 0, 0.94, 0));
    return g;
  },
  cone(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.BoxGeometry(1.3, 0.1, 1.3), mat(d.color), 0, 0.62, 0));
    g.add(M(new THREE.CylinderGeometry(0.08, 0.55, 1.6, 20), mat(d.color), 0, 1.45, 0));
    g.add(M(new THREE.CylinderGeometry(0.3, 0.37, 0.25, 20), mat(d.accent), 0, 1.4, 0));
    return g;
  },
  tophat(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 28), mat(d.color), 0, 0.6, 0));
    g.add(M(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 28), mat(d.color), 0, 1.18, 0));
    g.add(M(new THREE.CylinderGeometry(0.565, 0.565, 0.16, 28), mat(d.accent), 0, 0.74, 0));
    return g;
  },
  crown(d) {
    const g = new THREE.Group();
    const gold = mat(d.color, { metalness: 0.8, roughness: 0.25 });
    g.add(M(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 24, 1, true), gold, 0, 0.72, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(M(new THREE.ConeGeometry(0.12, 0.35, 6), gold, Math.sin(a) * 0.6, 1.05, Math.cos(a) * 0.6));
      if (i % 2 === 0) g.add(M(new THREE.SphereGeometry(0.07, 8, 6), mat(d.accent, { emissive: d.accent, emissiveIntensity: 0.3 }), Math.sin(a) * 0.63, 0.72, Math.cos(a) * 0.63));
    }
    return g;
  },
  bighead() { const g = new THREE.Group(); g.userData.bighead = true; return g; },
  viking(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.SphereGeometry(0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.color, { metalness: 0.7, roughness: 0.35 }), 0, 0.2, 0));
    g.add(M(new THREE.CylinderGeometry(0.69, 0.69, 0.15, 24), mat(shade(d.color, 0.7), { metalness: 0.7 }), 0, 0.22, 0));
    for (const s of [-1, 1]) {
      const horn = M(new THREE.ConeGeometry(0.14, 0.8, 12), mat(d.accent), s * 0.8, 0.7, 0, 0, 0, -s * 0.9);
      g.add(horn);
    }
    return g;
  },
  party(d) {
    const g = new THREE.Group();
    const cone = M(new THREE.ConeGeometry(0.42, 1.1, 20), mat(d.color), 0.1, 1.1, 0, 0, 0, -0.15);
    g.add(cone);
    g.add(M(new THREE.SphereGeometry(0.13, 10, 8), mat(d.accent), 0.18, 1.68, 0));
    g.add(M(new THREE.TorusGeometry(0.33, 0.04, 6, 20), mat(d.accent), 0.04, 0.85, 0, Math.PI / 2, 0.15, 0));
    return g;
  },
  headphones(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.TorusGeometry(0.7, 0.07, 8, 24, Math.PI), mat(d.color), 0, 0.1, 0));
    for (const s of [-1, 1]) g.add(M(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 18), mat(d.accent), s * 0.7, 0, 0, 0, 0, Math.PI / 2));
    return g;
  },
  halo(d) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: d.color });
    m.toneMapped = false;
    const ring = M(new THREE.TorusGeometry(0.5, 0.07, 10, 32), m, 0, 1.25, 0, Math.PI / 2, 0, 0);
    ring.castShadow = false;
    g.add(ring);
    g.userData.spin = ring;
    return g;
  },
  dominator(d) {
    const g = new THREE.Group();
    const dark = mat(d.color, { metalness: 0.5, roughness: 0.4 });
    g.add(M(new THREE.CylinderGeometry(0.5, 0.72, 1.1, 24, 1, true), dark, 0, 0.95, 0.04));
    g.add(M(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 1.5, 0.04));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(M(new THREE.ConeGeometry(0.1, 0.5, 6), dark, Math.sin(a) * 0.52, 1.7, Math.cos(a) * 0.52));
    }
    g.add(M(new THREE.CylinderGeometry(0.73, 0.73, 0.12, 24), mat(d.accent, { metalness: 0.6 }), 0, 0.45, 0.04));
    const gem = new THREE.MeshBasicMaterial({ color: d.accent }); gem.toneMapped = false;
    g.add(M(new THREE.OctahedronGeometry(0.16), gem, 0, 1.05, -0.62));
    return g;
  },
  beanie(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.SphereGeometry(0.67, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.color, { roughness: 1 }), 0, 0.15, 0));
    g.add(M(new THREE.CylinderGeometry(0.69, 0.69, 0.25, 24), mat(shade(d.color, 0.85), { roughness: 1 }), 0, 0.22, 0));
    g.add(M(new THREE.SphereGeometry(0.17, 10, 8), mat(d.accent, { roughness: 1 }), 0, 0.85, 0));
    return g;
  },
  pirate(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 3), mat(d.color), 0, 0.58, 0, 0, Math.PI, 0));
    g.add(M(new THREE.SphereGeometry(0.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.color), 0, 0.55, 0));
    g.add(M(new THREE.SphereGeometry(0.1, 8, 6), mat(d.accent), 0, 0.95, -0.5));
    return g;
  },
  witch(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 28), mat(d.color), 0, 0.58, 0));
    g.add(M(new THREE.ConeGeometry(0.55, 1.7, 24), mat(d.color), 0, 1.45, 0.1, 0.12, 0, 0));
    g.add(M(new THREE.CylinderGeometry(0.56, 0.56, 0.15, 24), mat(d.accent), 0, 0.67, 0));
    return g;
  },
  shades(d) {
    const g = new THREE.Group();
    const lens = mat(d.color, { roughness: 0.1, metalness: 0.6 });
    g.add(M(new THREE.BoxGeometry(0.42, 0.22, 0.05), lens, -0.24, 0.12, -0.66));
    g.add(M(new THREE.BoxGeometry(0.42, 0.22, 0.05), lens, 0.24, 0.12, -0.66));
    g.add(M(new THREE.BoxGeometry(1.3, 0.05, 0.05), mat(d.accent), 0, 0.2, -0.66));
    return g;
  },
  wings(d) {
    const g = new THREE.Group();
    g.userData.attach = 'torso';
    for (const s of [-1, 1]) {
      const w = M(new THREE.SphereGeometry(1, 16, 10), mat(d.color, { roughness: 0.9 }), s * 0.9, 0.4, 0.7, 0, s * 0.5, s * 0.4);
      w.scale.set(0.9, 0.45, 0.1);
      g.add(w);
    }
    return g;
  },
  // ---- hair
  bacon(d) {
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.9 });
    g.add(M(new THREE.SphereGeometry(0.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.3), m, 0, 0.12, 0.03));
    for (let i = 0; i < 5; i++) {
      const strip = M(new THREE.BoxGeometry(1.25, 0.14, 0.22), m, 0, 0.62 + Math.sin(i * 1.7) * 0.05, -0.4 + i * 0.2, 0.25, 0, Math.sin(i * 2.3) * 0.15);
      g.add(strip);
    }
    g.add(M(new THREE.BoxGeometry(1.2, 0.5, 0.2), m, 0, 0.25, 0.55));
    return g;
  },
  charmer(d) {
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.85 });
    g.add(M(new THREE.SphereGeometry(0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), m, 0, 0.1, 0.04));
    g.add(M(new THREE.BoxGeometry(1.1, 0.3, 0.5), m, 0.08, 0.62, -0.42, -0.4, 0, -0.18));
    g.add(M(new THREE.BoxGeometry(1.24, 0.7, 0.22), m, 0, 0.12, 0.56));
    return g;
  },
  spiky(d) {
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.7 });
    g.add(M(new THREE.SphereGeometry(0.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), m, 0, 0.12, 0));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.add(M(new THREE.ConeGeometry(0.2, 0.75, 6), m, Math.sin(a) * 0.35, 0.8, Math.cos(a) * 0.35, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6));
    }
    g.add(M(new THREE.ConeGeometry(0.22, 0.9, 6), m, 0, 1.0, 0));
    return g;
  },
  pal(d) {
    // The other 2019 default: short, dark, a fringe swept to one side.
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.9 });
    g.add(hairShell(m, { front: 0.36, back: -0.3, sides: 0.05 }));
    // the side-swept fringe
    const fringe = M(new THREE.BoxGeometry(0.95, 0.2, 0.22), m, -0.1, 0.42, -0.56, -0.25, 0, 0.22);
    g.add(fringe);
    g.add(M(new THREE.BoxGeometry(0.5, 0.16, 0.2), m, 0.3, 0.5, -0.52, -0.3, 0, -0.1));
    // sideburns
    for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.1, 0.3, 0.2), m, s * 0.62, 0.0, 0.05));
    return g;
  },
  charmer(d) {
    // Brown Charmer Hair: a big swoop over the forehead, longer at the back.
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.85 });
    g.add(hairShell(m, { front: 0.34, back: -0.42, sides: -0.05, thick: 0.08 }));
    const swoop = M(new THREE.SphereGeometry(0.42, 18, 10), m, -0.18, 0.5, -0.38);
    swoop.scale.set(1.35, 0.55, 0.9);
    swoop.rotation.z = 0.25;
    g.add(swoop);
    const tip = M(new THREE.SphereGeometry(0.22, 14, 8), m, 0.32, 0.36, -0.55);
    tip.scale.set(1.2, 0.6, 0.7);
    g.add(tip);
    return g;
  },
  spiky(d) {
    // Blonde Spiked Hair: spikes that grow out of the scalp in every direction.
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.7 });
    g.add(hairShell(m, { front: 0.36, back: -0.15, sides: 0.1 }));
    const up = new THREE.Vector3(0, 1, 0);
    const spike = (x, y, z, len, w) => {
      const dir = new THREE.Vector3(x, y - 0.05, z).normalize();
      const c = M(new THREE.ConeGeometry(w, len, 6), m);
      c.quaternion.setFromUnitVectors(up, dir);
      c.position.copy(dir.clone().multiplyScalar(0.55 + len / 2 - 0.1)).add(new THREE.Vector3(0, 0.05, 0));
      g.add(c);
    };
    spike(0, 1, 0, 0.75, 0.2);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; spike(Math.sin(a) * 0.55, 0.85, Math.cos(a) * 0.55, 0.6, 0.17); }
    // a lower ring around the sides and back only, so nothing pokes into the face
    for (let i = 0; i < 7; i++) { const a = -1.9 + (i / 6) * 3.8; spike(Math.sin(a), 0.45, Math.cos(a), 0.5, 0.15); }
    return g;
  },
  long(d) {
    // Long hair: covers the back of the head and falls over the shoulders.
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.85 });
    g.add(hairShell(m, { front: 0.3, back: -0.6, sides: -0.5, thick: 0.08 }));
    // the long part behind the back (the torso top is 0.5 below the head)
    const fall = M(new THREE.BoxGeometry(1.2, 1.3, 0.2), m, 0, -0.95, 0.6);
    g.add(fall);
    g.add(M(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 20, 1, false, 0, Math.PI), m, 0, -0.32, 0.6, Math.PI / 2, 0, 0));
    return g;
  },
};

// A hair "shell" that hugs the head, so no skin pokes through at the edges.
// front / back / sides: how low the hair reaches there (head goes -0.6..0.6;
// the face is between -0.42 and 0.42 at the front). The edge blends smoothly.
function hairShell(material, { front = 0.35, back = -0.3, sides = 0, thick = 0.06 } = {}) {
  const SEG = 48, ROWS = 14;
  const pos = [], idx = [];
  for (let j = 0; j <= SEG; j++) {
    const phi = (j / SEG) * Math.PI * 2; // 0 = back (+z), PI = face (-z)
    const c = Math.cos(phi);
    const bottom = c >= 0 ? sides + (back - sides) * c ** 1.5 : sides + (front - sides) * (-c) ** 1.5;
    const sx = Math.sin(phi), sz = Math.cos(phi);
    for (let i = 0; i <= ROWS; i++) {
      const t = i / ROWS;
      const y = bottom + (0.6 - bottom) * t;
      // round over the top edge of the head
      const r = i === ROWS ? 0.42 + thick : headRadius(y) + thick;
      pos.push(sx * r, i === ROWS ? 0.6 + thick : y, sz * r);
    }
    pos.push(0, 0.6 + thick, 0); // the crown
  }
  const col = ROWS + 2;
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i <= ROWS; i++) {
      const a = j * col + i, b = (j + 1) * col + i;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

const GEARS = {
  sword(d) {
    const g = new THREE.Group();
    const blade = mat(d.color, { metalness: 0.9, roughness: 0.2 });
    g.add(M(new THREE.BoxGeometry(0.22, 0.2, 3.2), blade, 0, 0, -2.2));
    g.add(M(new THREE.BoxGeometry(1, 0.25, 0.2), mat('#6b4a2b'), 0, 0, -0.55));
    g.add(M(new THREE.BoxGeometry(0.2, 0.2, 0.8), mat('#3a2a18'), 0, 0, 0));
    return g;
  },
  rocket(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 16), mat(d.color), 0, 0, -0.6, Math.PI / 2, 0, 0));
    g.add(M(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16), mat('#2a2a2a'), 0, 0, -2.3, Math.PI / 2, 0, 0));
    return g;
  },
  gun(d) {
    const g = new THREE.Group();
    const body = mat(d.color || '#2a2a2a', { metalness: 0.4, roughness: 0.5 });
    g.add(M(new THREE.BoxGeometry(0.35, 0.45, 1.6), body, 0, 0.15, -0.9));
    g.add(M(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 10), mat('#1b1b1b', { metalness: 0.7 }), 0, 0.22, -2.1, Math.PI / 2, 0, 0));
    g.add(M(new THREE.BoxGeometry(0.3, 0.7, 0.35), mat('#3a2a1a'), 0, -0.3, -0.35, 0.3, 0, 0));
    return g;
  },
  flashlight(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12), mat(d.color || '#333333'), 0, 0, -0.8, Math.PI / 2, 0, 0));
    const lens = new THREE.MeshBasicMaterial({ color: '#fff7c2' }); lens.toneMapped = false;
    g.add(M(new THREE.CylinderGeometry(0.26, 0.2, 0.3, 12), lens, 0, 0, -1.6, Math.PI / 2, 0, 0));
    const spot = new THREE.SpotLight(0xfff2c4, 6, 70, 0.45, 0.5, 1.2);
    spot.position.set(0, 0, -1.7);
    spot.target.position.set(0, 0, -12);
    g.add(spot, spot.target);
    return g;
  },
  brush(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), mat('#a0703c'), 0, 0, -1, Math.PI / 2, 0, 0));
    g.add(M(new THREE.BoxGeometry(0.4, 0.25, 0.5), mat(d.color || '#c4281c'), 0, 0, -2.2));
    return g;
  },
  hammer(d) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), mat('#7c5c46'), 0, 0, -1, Math.PI / 2, 0, 0));
    g.add(M(new THREE.BoxGeometry(0.5, 0.5, 1.1), mat(d.color || '#635f62', { metalness: 0.6 }), 0, 0, -2.1, 0, Math.PI / 2, 0));
    return g;
  },
};

// ------------------------------------------------------------ build
export function buildAvatar(avatar, opts = {}) {
  const look = resolveItems(avatar);
  const bc = { head: '#f5cd30', torso: '#0d69ac', leftArm: '#f5cd30', rightArm: '#f5cd30', leftLeg: '#4b974b', rightLeg: '#4b974b', ...look.bodyColors };
  const root = new THREE.Group();
  root.name = 'Avatar';
  const shadow = opts.shadow !== false;

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const torso = new THREE.Mesh(box(2, 2, 1), limbMaterials('torso', bc.torso, look));
  torso.name = 'Torso';
  root.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.5, 0);
  root.add(headPivot);
  const head = new THREE.Mesh(headGeometry(), new THREE.MeshStandardMaterial({ color: bc.head, roughness: 0.7 }));
  head.name = 'Head';
  headPivot.add(head);
  head.add(faceMesh(look.face));

  const limb = (name, kind, color, px, py, len = 2) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const m = new THREE.Mesh(box(1, len, 1), limbMaterials(kind, color, look));
    m.name = name;
    m.position.y = -len / 2 + (kind === 'arm' ? 0.5 : 0);
    pivot.add(m);
    root.add(pivot);
    return [pivot, m];
  };
  const [lArmP, lArm] = limb('Left Arm', 'arm', bc.leftArm, -1.5, 0.5);
  const [rArmP, rArm] = limb('Right Arm', 'arm', bc.rightArm, 1.5, 0.5);
  const [lLegP, lLeg] = limb('Left Leg', 'leg', bc.leftLeg, -0.5, -1);
  const [rLegP, rLeg] = limb('Right Leg', 'leg', bc.rightLeg, 0.5, -1);

  for (const d of look.hats) {
    const fn = HATS[d.model];
    if (!fn) continue;
    const acc = fn(d);
    if (acc.userData.bighead) { head.scale.setScalar(1.45); headPivot.position.y = 1.72; continue; }
    if (acc.userData.attach === 'torso') torso.add(acc); else head.add(acc);
    if (acc.userData.spin) root.userData.spin = acc.userData.spin;
  }
  let gear = null;
  if (look.gear && GEARS[look.gear.model]) {
    gear = GEARS[look.gear.model](look.gear);
    if (look.gear.model === 'rocket') { gear.position.set(0.3, 1.3, 0); rArm.add(gear); } else { gear.position.set(0, -1, -0.1); gear.rotation.x = -Math.PI / 2; rArm.add(gear); }
  }

  // Pet next to the avatar (pictures only; in games it follows on its own, see characters.js).
  if (look.pet && opts.pet !== false) {
    const pet = buildPet(look.pet);
    if (pet) {
      pet.position.set(1.9, -3 + (pet.userData.fly ? 1.4 : 0), -1.4);
      pet.scale.setScalar(0.85);
      pet.rotation.y = -0.6;
      root.add(pet);
    }
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; } });
  const limbs = { Torso: torso, Head: head, 'Left Arm': lArm, 'Right Arm': rArm, 'Left Leg': lLeg, 'Right Leg': rLeg };
  const pivots = { head: headPivot, lArm: lArmP, rArm: rArmP, lLeg: lLegP, rLeg: rLegP };
  const anim = new AvatarAnimator(pivots, !!gear && look.gear.model !== 'rocket', root);
  // In-game Tools replace the catalog gear while equipped.
  let toolMesh = null, toolKey = '';
  const holdsGear = !!gear && look.gear.model !== 'rocket';
  const setTool = (name, color) => {
    const key = name ? name + color : '';
    if (key === toolKey) return;
    toolKey = key;
    if (toolMesh) { disposeTree(toolMesh); toolMesh = null; }
    if (gear) gear.visible = !name;
    anim.tool = name ? name !== 'rocket' : holdsGear;
    const fn = name && (GEARS[name] || GEARS.sword);
    if (!fn) return;
    toolMesh = fn({ color: color || '#a3a2a5' });
    if (name === 'rocket') { toolMesh.position.set(0.3, 1.3, 0); } else { toolMesh.position.set(0, -1, -0.1); toolMesh.rotation.x = -Math.PI / 2; }
    toolMesh.traverse((o) => { if (o.isMesh) o.castShadow = shadow; });
    rArm.add(toolMesh);
  };
  // Driving: a go-kart under the player, who sits in it.
  let kart = null, kartColor = '';
  const setKart = (color) => {
    if (color === kartColor) return;
    kartColor = color || '';
    if (kart) { disposeTree(kart); kart = null; }
    if (!color) return;
    kart = buildKart(color);
    kart.traverse((o) => { if (o.isMesh) o.castShadow = shadow; });
    root.add(kart);
  };
  return {
    group: root, limbs, pivots, gear, look, setTool, setKart,
    get driving() { return !!kart; },
    animate: (state, dt, speed) => anim.update(state, dt, speed),
    setEmote: (e) => anim.setEmote(e),
    dispose() {
      root.traverse((o) => {
        if (o.geometry && o.geometry !== HEAD_GEO) o.geometry.dispose();
        if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); }
      });
    },
  };
}

function disposeTree(o) {
  o.removeFromParent();
  o.traverse((x) => {
    if (x.geometry && x.geometry !== HEAD_GEO) x.geometry.dispose();
    if (x.material) for (const m of [].concat(x.material)) m.dispose();
  });
}

// A classic go-kart; the player's root is 3 studs above the ground.
function buildKart(color) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.4, metalness: 0.2 });
  const dark = mat('#1b1b1b', { roughness: 0.9 });
  g.add(M(new THREE.BoxGeometry(4, 0.8, 6.4), body, 0, -2.2, 0.2));
  g.add(M(new THREE.BoxGeometry(3.2, 0.6, 1.4), body, 0, -1.6, -2.6, -0.35, 0, 0));
  g.add(M(new THREE.BoxGeometry(2.6, 1.6, 0.6), body, 0, -1.2, 2.2));
  g.add(M(new THREE.BoxGeometry(4.6, 0.25, 0.9), dark, 0, -1.5, 3.3));
  for (const [x, z] of [[-2.1, -2.2], [2.1, -2.2], [-2.1, 2.4], [2.1, 2.4]]) {
    g.add(M(new THREE.CylinderGeometry(0.85, 0.85, 0.8, 16), dark, x, -2.15, z, 0, 0, Math.PI / 2));
  }
  g.add(M(new THREE.TorusGeometry(0.45, 0.08, 6, 16), dark, 0, -0.9, -1.2, -0.9, 0, 0));
  return g;
}

// ------------------------------------------------------------ pets
// Small blocky companions. They face -Z like avatars; the feet are at y = 0.
// userData: fly (hovers), parts to animate (tail, wings, ears).
const PETS = {
  dog(d) {
    const g = new THREE.Group();
    const fur = mat(d.color, { roughness: 0.9 }), white = mat(d.accent || '#f8f8f8', { roughness: 0.9 }), black = mat('#1b1b1b');
    g.add(M(new THREE.BoxGeometry(1, 0.8, 1.6), fur, 0, 0.9, 0));
    const head = M(new THREE.BoxGeometry(0.9, 0.85, 0.85), fur, 0, 1.45, -0.9);
    head.add(M(new THREE.BoxGeometry(0.5, 0.35, 0.4), white, 0, -0.15, -0.55));
    head.add(M(new THREE.BoxGeometry(0.18, 0.14, 0.1), black, 0, -0.02, -0.76));
    for (const s of [-1, 1]) {
      head.add(M(new THREE.BoxGeometry(0.12, 0.12, 0.05), black, s * 0.22, 0.12, -0.44));
      head.add(M(new THREE.BoxGeometry(0.2, 0.5, 0.3), mat(shade(d.color, 0.7)), s * 0.5, 0.05, 0.05));
    }
    g.add(head);
    for (const [x, z] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) g.add(M(new THREE.BoxGeometry(0.28, 0.55, 0.28), fur, x, 0.28, z));
    const tail = M(new THREE.BoxGeometry(0.16, 0.16, 0.6), fur, 0, 1.15, 0.95, -0.7, 0, 0);
    g.add(tail);
    g.userData = { tail, head };
    return g;
  },
  cat(d) {
    const g = new THREE.Group();
    const fur = mat(d.color, { roughness: 0.9 }), white = mat(d.accent || '#f8f8f8'), black = mat('#1b1b1b');
    g.add(M(new THREE.BoxGeometry(0.8, 0.65, 1.3), fur, 0, 0.75, 0));
    const head = M(new THREE.BoxGeometry(0.8, 0.7, 0.7), fur, 0, 1.25, -0.75);
    head.add(M(new THREE.BoxGeometry(0.4, 0.2, 0.1), white, 0, -0.18, -0.36));
    for (const s of [-1, 1]) {
      head.add(M(new THREE.ConeGeometry(0.16, 0.35, 4), fur, s * 0.24, 0.48, 0, 0, Math.PI / 4, 0));
      head.add(M(new THREE.BoxGeometry(0.12, 0.14, 0.05), mat('#3fb950'), s * 0.18, 0.08, -0.36));
    }
    head.add(M(new THREE.BoxGeometry(0.1, 0.08, 0.05), black, 0, -0.06, -0.38));
    g.add(head);
    for (const [x, z] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]]) g.add(M(new THREE.BoxGeometry(0.22, 0.45, 0.22), fur, x, 0.23, z));
    const tail = M(new THREE.BoxGeometry(0.14, 0.9, 0.14), fur, 0, 1.3, 0.7, 0.3, 0, 0);
    g.add(tail);
    g.userData = { tail, head };
    return g;
  },
  bunny(d) {
    const g = new THREE.Group();
    const fur = mat(d.color, { roughness: 1 }), pink = mat(d.accent || '#ff9cc8');
    const body = M(new THREE.SphereGeometry(0.55, 14, 10), fur, 0, 0.6, 0.1);
    body.scale.set(1, 0.95, 1.2);
    g.add(body);
    const head = M(new THREE.SphereGeometry(0.42, 14, 10), fur, 0, 1.15, -0.45);
    for (const s of [-1, 1]) {
      const ear = M(new THREE.BoxGeometry(0.16, 0.7, 0.1), fur, s * 0.15, 0.6, 0.05, 0, 0, s * 0.15);
      ear.add(M(new THREE.BoxGeometry(0.08, 0.5, 0.02), pink, 0, 0, -0.05));
      head.add(ear);
      head.add(M(new THREE.SphereGeometry(0.06, 8, 6), mat('#1b1b1b'), s * 0.16, 0.08, -0.36));
    }
    head.add(M(new THREE.SphereGeometry(0.06, 8, 6), pink, 0, -0.06, -0.42));
    g.add(head);
    g.add(M(new THREE.SphereGeometry(0.18, 8, 6), fur, 0, 0.55, 0.78));
    g.userData = { head, hop: true };
    return g;
  },
  penguin(d) {
    const g = new THREE.Group();
    const body = M(new THREE.SphereGeometry(0.6, 16, 12), mat(d.color), 0, 0.85, 0);
    body.scale.set(0.9, 1.35, 0.85);
    g.add(body);
    const belly = M(new THREE.SphereGeometry(0.5, 16, 12), mat('#f8f8f8'), 0, 0.8, -0.13);
    belly.scale.set(0.8, 1.15, 0.7);
    g.add(belly);
    const head = new THREE.Group();
    head.position.set(0, 1.55, 0);
    head.add(M(new THREE.ConeGeometry(0.12, 0.3, 8), mat(d.accent || '#ff9f1c'), 0, -0.05, -0.5, -Math.PI / 2, 0, 0));
    for (const s of [-1, 1]) head.add(M(new THREE.SphereGeometry(0.07, 8, 6), mat('#f8f8f8'), s * 0.18, 0.08, -0.42));
    g.add(head);
    for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.28, 0.08, 0.38), mat(d.accent || '#ff9f1c'), s * 0.2, 0.04, -0.1));
    const wings = [-1, 1].map((s) => { const w = M(new THREE.BoxGeometry(0.1, 0.8, 0.4), mat(d.color), s * 0.55, 0.9, 0, 0, 0, s * 0.2); g.add(w); return w; });
    g.userData = { head, flippers: wings, waddle: true };
    return g;
  },
  robot(d) {
    const g = new THREE.Group();
    const metal = mat(d.color, { metalness: 0.6, roughness: 0.35 });
    const glow = new THREE.MeshBasicMaterial({ color: d.accent || '#00e5ff' }); glow.toneMapped = false;
    g.add(M(new THREE.BoxGeometry(0.9, 0.7, 0.7), metal, 0, 0.5, 0));
    const head = M(new THREE.BoxGeometry(0.85, 0.65, 0.75), metal, 0, 1.25, 0);
    for (const s of [-1, 1]) head.add(M(new THREE.BoxGeometry(0.18, 0.12, 0.05), glow, s * 0.2, 0.05, -0.39));
    head.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), metal, 0, 0.5, 0));
    head.add(M(new THREE.SphereGeometry(0.08, 8, 6), glow, 0, 0.72, 0));
    g.add(head);
    const jet = M(new THREE.ConeGeometry(0.18, 0.4, 8), glow, 0, 0.0, 0, Math.PI, 0, 0);
    g.add(jet);
    g.userData = { fly: true, head, jet };
    return g;
  },
  ghost(d) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: d.color, transparent: true, opacity: 0.82, roughness: 0.4, emissive: new THREE.Color(d.color).multiplyScalar(0.25) });
    const top = M(new THREE.SphereGeometry(0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 1.1, 0);
    g.add(top);
    g.add(M(new THREE.CylinderGeometry(0.6, 0.68, 0.9, 16, 1, true), body, 0, 0.65, 0));
    for (const s of [-1, 1]) g.add(M(new THREE.SphereGeometry(0.1, 8, 6), mat(d.accent || '#1b1b1b'), s * 0.2, 1.15, -0.55));
    g.add(M(new THREE.SphereGeometry(0.09, 8, 6), mat(d.accent || '#1b1b1b'), 0, 0.88, -0.6));
    g.userData = { fly: true, sway: true };
    return g;
  },
  dragon(d) {
    const g = new THREE.Group();
    const scale = mat(d.color, { roughness: 0.6, metalness: d.color === '#ffc400' ? 0.6 : 0.1 });
    const acc = mat(d.accent || '#ffcf33', { roughness: 0.5 });
    g.add(M(new THREE.BoxGeometry(0.9, 0.8, 1.4), scale, 0, 0.8, 0));
    const head = M(new THREE.BoxGeometry(0.75, 0.65, 0.8), scale, 0, 1.35, -0.85);
    head.add(M(new THREE.BoxGeometry(0.5, 0.3, 0.45), scale, 0, -0.12, -0.55));
    for (const s of [-1, 1]) {
      head.add(M(new THREE.ConeGeometry(0.08, 0.35, 6), acc, s * 0.22, 0.45, 0.15, -0.4, 0, 0));
      head.add(M(new THREE.BoxGeometry(0.12, 0.12, 0.05), mat('#1b1b1b'), s * 0.2, 0.1, -0.41));
    }
    g.add(head);
    for (let i = 0; i < 3; i++) g.add(M(new THREE.ConeGeometry(0.1, 0.3, 4), acc, 0, 1.3 - i * 0.05, -0.3 + i * 0.4));
    const wings = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.45, 1.05, 0);
      const w = M(new THREE.BoxGeometry(1.1, 0.06, 0.8), acc, s * 0.55, 0, 0);
      pivot.add(w);
      g.add(pivot);
      return pivot;
    });
    const tail = M(new THREE.BoxGeometry(0.3, 0.3, 1.1), scale, 0, 0.7, 1.15, 0.3, 0, 0);
    tail.add(M(new THREE.ConeGeometry(0.2, 0.35, 4), acc, 0, 0, 0.6, Math.PI / 2, 0, 0));
    g.add(tail);
    g.userData = { fly: true, wings, tail, head };
    return g;
  },
};

export function buildPet(data) {
  const fn = PETS[data && data.model];
  if (!fn) return null;
  const pet = fn(data);
  pet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  pet.userData.t = Math.random() * 10;
  return pet;
}

// Idle/move animation. moving: 0..1.
export function animatePet(pet, dt, moving) {
  const u = pet.userData;
  u.t = (u.t || 0) + dt;
  const t = u.t;
  const body = pet.children[0];
  if (u.fly) {
    u.offsetY = 1.6 + Math.sin(t * 2.2) * 0.25;
  } else if (u.hop) {
    u.offsetY = moving > 0.2 ? Math.abs(Math.sin(t * 9)) * 0.45 : 0;
  } else {
    u.offsetY = moving > 0.2 ? Math.abs(Math.sin(t * 12)) * 0.12 : 0;
  }
  if (u.tail) u.tail.rotation.y = Math.sin(t * (moving > 0.2 ? 14 : 5)) * 0.5;
  if (u.wings) u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (Math.sin(t * 10) * 0.6 + 0.2); });
  if (u.flippers) u.flippers.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.2 + Math.max(0, Math.sin(t * 8)) * 0.4 * moving); });
  if (u.waddle) pet.rotation.z = Math.sin(t * 10) * 0.12 * moving;
  if (u.sway) pet.rotation.z = Math.sin(t * 1.5) * 0.08;
  if (u.head) u.head.rotation.x = Math.sin(t * 1.3) * 0.06;
  if (u.jet) u.jet.scale.y = 0.8 + Math.sin(t * 30) * 0.2;
  return body;
}

// ------------------------------------------------------------ animation
class AvatarAnimator {
  constructor(p, holdingTool, root) {
    this.p = p;
    this.t = 0;
    this.tool = holdingTool;
    this.root = root;
    this.emote = null;
    this.emoteT = 0;
  }
  setEmote(e) { this.emote = e; this.emoteT = 0; }
  update(state, dt, speed = 0) {
    this.t += dt;
    const { lArm, rArm, lLeg, rLeg, head } = this.p;
    const t = this.t;
    const targets = { la: [0, 0, 0], ra: [0, 0, 0], ll: [0, 0, 0], rl: [0, 0, 0], h: [0, 0, 0] };
    if (state !== 'idle' && state !== 'walk') this.emote = null;
    if (speed > 0.5 && this.emote) this.emote = null;
    if (state === 'walk') {
      const f = Math.min(1.2, speed / 14);
      const s = Math.sin(t * (6 + speed * 0.25)) * 0.9 * f;
      targets.la[0] = -s; targets.ra[0] = s; targets.ll[0] = s; targets.rl[0] = -s;
    } else if (state === 'jump') {
      targets.la[0] = Math.PI; targets.ra[0] = Math.PI;
    } else if (state === 'fall') {
      targets.la[0] = Math.PI * 0.9; targets.ra[0] = Math.PI * 0.9; targets.la[2] = -0.35; targets.ra[2] = 0.35;
      targets.ll[0] = 0.25; targets.rl[0] = -0.2;
    } else if (state === 'sit') {
      targets.ll[0] = Math.PI / 2; targets.rl[0] = Math.PI / 2; targets.la[0] = 0.4; targets.ra[0] = 0.4;
    } else if (this.emote) {
      this.emoteT += dt;
      const e = this.emote, k = this.emoteT;
      if (e === 'dance' || e === 'dance1') {
        const s = Math.sin(k * 8);
        targets.la[0] = Math.PI * 0.8 + s * 0.4; targets.ra[0] = Math.PI * 0.8 - s * 0.4;
        targets.ll[2] = s * 0.25; targets.rl[2] = s * 0.25; targets.h[1] = s * 0.3;
      } else if (e === 'dance2') {
        const s = Math.sin(k * 6);
        targets.la[2] = -1.4 - s * 0.3; targets.ra[2] = 1.4 - s * 0.3; targets.ll[0] = Math.max(0, s) * 0.8; targets.rl[0] = Math.max(0, -s) * 0.8;
      } else if (e === 'dance3') {
        const s = Math.sin(k * 10);
        targets.ra[0] = Math.PI + s * 0.5; targets.la[0] = -0.3; targets.h[0] = s * 0.15;
      } else if (e === 'wave') {
        targets.ra[2] = 2.6 + Math.sin(k * 10) * 0.35;
        if (k > 2.4) this.emote = null;
      } else if (e === 'point') {
        targets.ra[0] = Math.PI / 2;
        if (k > 2) this.emote = null;
      } else if (e === 'cheer') {
        targets.la[0] = Math.PI + Math.sin(k * 12) * 0.2; targets.ra[0] = Math.PI - Math.sin(k * 12) * 0.2;
        if (k > 2) this.emote = null;
      } else if (e === 'laugh') {
        targets.h[0] = -0.2 + Math.sin(k * 20) * 0.08; targets.la[0] = 0.3; targets.ra[0] = 0.3;
        if (k > 2) this.emote = null;
      } else this.emote = null;
    } else {
      const s = Math.sin(t * 1.6) * 0.06;
      targets.la[2] = -0.03 - s; targets.ra[2] = 0.03 + s;
    }
    if (this.tool && state !== 'jump' && state !== 'fall') { targets.ra = [Math.PI / 2, 0, 0]; }
    const k = Math.min(1, dt * (state === 'walk' ? 20 : 12));
    const apply = (o, v) => {
      o.rotation.x += (v[0] - o.rotation.x) * k;
      o.rotation.y += (v[1] - o.rotation.y) * k;
      o.rotation.z += (v[2] - o.rotation.z) * k;
    };
    apply(lArm, targets.la); apply(rArm, targets.ra); apply(lLeg, targets.ll); apply(rLeg, targets.rl); apply(head, targets.h);
    if (this.root.userData.spin) this.root.userData.spin.rotation.z += dt * 1.5;
  }
}
