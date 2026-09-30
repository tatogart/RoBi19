// Classic blocky R6 avatar: body colours, clothing textures, faces, hats and animation.
import * as THREE from 'three';

// ------------------------------------------------------------ resolve
export function resolveItems(avatar) {
  const r = { bodyColors: avatar?.bodyColors || {}, hats: [], face: { face: 'smile' }, shirt: null, pants: null, tshirt: null, gear: null };
  for (const it of avatar?.items || []) {
    if (it.type === 'Hat' || it.type === 'Hair') r.hats.push(it.data);
    else if (it.type === 'Face') r.face = it.data;
    else if (it.type === 'Shirt') r.shirt = it.data;
    else if (it.type === 'Pants') r.pants = it.data;
    else if (it.type === 'TShirt') r.tshirt = it.data;
    else if (it.type === 'Gear') r.gear = it.data;
  }
  return r;
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

function drawTShirt(ctx, w, h, g) {
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
  const S = 64;
  const faces = ['side', 'side', 'top', 'bottom', 'back', 'front']; // +x -x +y -y +z -z
  return faces.map((face) => {
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = skin; ctx.fillRect(0, 0, S, S);
    if (kind === 'torso') {
      if (look.shirt) drawPattern(ctx, S, S, look.shirt, face);
      if (face === 'bottom' && look.pants) { ctx.fillStyle = look.pants.color; ctx.fillRect(0, 0, S, S); }
      if (face === 'front' && look.tshirt) drawTShirt(ctx, S, S, look.tshirt.graphic);
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
        drawPattern(ctx, S, S, look.pants, face);
        if (face === 'bottom') { ctx.fillStyle = shade(look.pants.color, 0.5); ctx.fillRect(0, 0, S, S); }
      }
    }
    // subtle edge shading for the classic look
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.75 });
  });
}

// ------------------------------------------------------------ head
let HEAD_GEO = null;
function headGeometry() {
  if (HEAD_GEO) return HEAD_GEO;
  const pts = [[0, -0.6], [0.42, -0.6], [0.56, -0.55], [0.62, -0.42], [0.625, 0], [0.62, 0.42], [0.56, 0.55], [0.42, 0.6], [0, 0.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  HEAD_GEO = new THREE.LatheGeometry(pts, 32);
  return HEAD_GEO;
}

function faceMesh(face) {
  const [c, ctx] = makeCanvas(256, 200);
  drawFace(ctx, 256, 200, face);
  const span = 1.7;
  const g = new THREE.CylinderGeometry(0.632, 0.632, 0.84, 24, 1, true, Math.PI - span / 2, span);
  const m = new THREE.MeshStandardMaterial({ map: toTexture(c), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
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
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.9 });
    g.add(M(new THREE.SphereGeometry(0.665, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), m, 0, 0.1, 0));
    for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.12, 0.45, 0.3), m, s * 0.6, 0.02, -0.05));
    g.add(M(new THREE.BoxGeometry(1.2, 0.18, 0.3), m, 0, 0.52, -0.45, -0.3, 0, 0));
    return g;
  },
  long(d) {
    const g = new THREE.Group();
    const m = mat(d.color, { roughness: 0.85 });
    g.add(M(new THREE.SphereGeometry(0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), m, 0, 0.1, 0.03));
    g.add(M(new THREE.BoxGeometry(1.35, 1.9, 0.35), m, 0, -0.45, 0.45));
    for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.2, 1.3, 0.5), m, s * 0.62, -0.25, 0.15));
    return g;
  },
};

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
  head.add(faceMesh(look.face.face));

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

  root.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; } });
  const limbs = { Torso: torso, Head: head, 'Left Arm': lArm, 'Right Arm': rArm, 'Left Leg': lLeg, 'Right Leg': rLeg };
  const pivots = { head: headPivot, lArm: lArmP, rArm: rArmP, lLeg: lLegP, rLeg: rLegP };
  const anim = new AvatarAnimator(pivots, !!gear && look.gear.model !== 'rocket', root);
  return {
    group: root, limbs, pivots, gear, look,
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
