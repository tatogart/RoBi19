// Procedural material textures (no external assets). Textures are mostly
// light grey detail maps that get tinted by the part colour.
import * as THREE from 'three';

const texCache = new Map();
const matCache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Deterministic PRNG so textures look identical every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function noise(ctx, w, h, amount, seed, base = 235, size = 1) {
  const r = rng(seed);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const v = Math.floor(base + (r() - 0.5) * amount);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, size, size);
    }
  }
}

const GENERATORS = {
  Plastic(ctx, w) { noise(ctx, w, w, 10, 1, 245, 2); },
  Concrete(ctx, w) {
    noise(ctx, w, w, 40, 2, 225, 1);
    const r = rng(22);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(90,90,90,${r() * 0.25})`; ctx.fillRect(r() * w, r() * w, 2 + r() * 3, 2 + r() * 3); }
  },
  Granite(ctx, w) {
    noise(ctx, w, w, 70, 3, 215, 2);
    const r = rng(33);
    for (let i = 0; i < 200; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(40,40,40,.4)' : 'rgba(255,255,255,.35)'; ctx.fillRect(r() * w, r() * w, 2, 2); }
  },
  Sand(ctx, w) { noise(ctx, w, w, 45, 4, 225, 1); },
  Grass(ctx, w) {
    noise(ctx, w, w, 50, 5, 215, 2);
    const r = rng(55);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * w;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); ctx.stroke();
    }
  },
  Wood(ctx, w) {
    ctx.fillStyle = '#dcdcdc'; ctx.fillRect(0, 0, w, w);
    const r = rng(6);
    for (let y = 0; y < w; y += 2) {
      const v = 200 + Math.sin(y * 0.35 + Math.sin(y * 0.05) * 3) * 25 + r() * 10;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 2);
    }
    ctx.strokeStyle = 'rgba(80,80,80,.35)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y0 = r() * w;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.08 + i) * 3);
      ctx.stroke();
    }
  },
  WoodPlanks(ctx, w) {
    GENERATORS.Wood(ctx, w);
    ctx.fillStyle = 'rgba(60,60,60,.55)';
    for (let y = 0; y < w; y += w / 4) {
      ctx.fillRect(0, y, w, 2);
      const off = ((y / (w / 4)) % 2) * (w / 2);
      ctx.fillRect((off + w / 3) % w, y, 2, w / 4);
    }
  },
  Brick(ctx, w) {
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, w, w);
    const r = rng(7);
    const bh = w / 8, bw = w / 4;
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 5; col++) {
        const v = 215 + r() * 30;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  },
  Cobblestone(ctx, w) {
    ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, w, w);
    const r = rng(8);
    for (let i = 0; i < 40; i++) {
      const v = 190 + r() * 55;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      const x = r() * w, y = r() * w, rad = w / 14 + r() * w / 14;
      ctx.ellipse(x, y, rad, rad * (0.7 + r() * 0.3), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  Pebble(ctx, w) {
    noise(ctx, w, w, 30, 9, 200, 2);
    const r = rng(99);
    for (let i = 0; i < 90; i++) {
      const v = 190 + r() * 60;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath(); ctx.arc(r() * w, r() * w, 2 + r() * 5, 0, Math.PI * 2); ctx.fill();
    }
  },
  Slate(ctx, w) {
    noise(ctx, w, w, 30, 10, 200, 2);
    const r = rng(100);
    ctx.strokeStyle = 'rgba(60,60,60,.5)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); let x = r() * w, y = r() * w; ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },
  Marble(ctx, w) {
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, w, w);
    const r = rng(11);
    ctx.strokeStyle = 'rgba(120,120,120,.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); let x = r() * w, y = 0; ctx.moveTo(x, y);
      while (y < w) { x += (r() - 0.5) * 18; y += 10; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },
  Metal(ctx, w) {
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, w, w);
    const r = rng(12);
    for (let y = 0; y < w; y++) { const v = 205 + r() * 30; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, y, w, 1); }
  },
  DiamondPlate(ctx, w) {
    GENERATORS.Metal(ctx, w);
    const s = w / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.save();
        ctx.translate(x * s + s / 2, y * s + s / 2);
        ctx.rotate((x + y) % 2 ? 0.8 : -0.8);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-s / 3, -2, s / 1.5, 3);
        ctx.fillStyle = 'rgba(60,60,60,.5)'; ctx.fillRect(-s / 3, 1, s / 1.5, 1.5);
        ctx.restore();
      }
    }
  },
  CorrodedMetal(ctx, w) {
    GENERATORS.Metal(ctx, w);
    const r = rng(13);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${120 + r() * 60},${70 + r() * 40},${40},${0.25 + r() * 0.35})`;
      ctx.beginPath(); ctx.arc(r() * w, r() * w, 2 + r() * 10, 0, Math.PI * 2); ctx.fill();
    }
  },
  Foil(ctx, w) {
    noise(ctx, w, w, 60, 14, 220, 4);
  },
  Fabric(ctx, w) {
    ctx.fillStyle = '#dadada'; ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < w; i += 3) {
      ctx.fillStyle = i % 6 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.12)';
      ctx.fillRect(i, 0, 1, w); ctx.fillRect(0, i, w, 1);
    }
  },
  Ice(ctx, w) {
    ctx.fillStyle = '#f4f8ff'; ctx.fillRect(0, 0, w, w);
    const r = rng(15);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(r() * w, r() * w); ctx.lineTo(r() * w, r() * w); ctx.stroke(); }
  },
};

// Tile size in studs for each material texture.
const TILE = {
  Plastic: 4, Concrete: 8, Granite: 8, Sand: 8, Grass: 8, Wood: 4, WoodPlanks: 8, Brick: 8, Cobblestone: 8,
  Pebble: 8, Slate: 8, Marble: 10, Metal: 4, DiamondPlate: 4, CorrodedMetal: 8, Foil: 4, Fabric: 2, Ice: 10,
};

const PROPS = {
  Plastic: { roughness: 0.75, metalness: 0 },
  SmoothPlastic: { roughness: 0.6, metalness: 0 },
  Neon: { roughness: 1, metalness: 0 },
  Wood: { roughness: 0.85 }, WoodPlanks: { roughness: 0.85 },
  Marble: { roughness: 0.35 }, Slate: { roughness: 0.9 }, Concrete: { roughness: 0.95 }, Granite: { roughness: 0.8 },
  Brick: { roughness: 0.95 }, Pebble: { roughness: 0.9 }, Cobblestone: { roughness: 0.9 },
  CorrodedMetal: { roughness: 0.8, metalness: 0.4 }, DiamondPlate: { roughness: 0.45, metalness: 0.6 },
  Foil: { roughness: 0.25, metalness: 0.8 }, Metal: { roughness: 0.4, metalness: 0.65 },
  Grass: { roughness: 1 }, Sand: { roughness: 1 }, Fabric: { roughness: 1 },
  Ice: { roughness: 0.15 }, Glass: { roughness: 0.05, metalness: 0.1 }, ForceField: { roughness: 1 },
};

export function materialTexture(name) {
  if (!GENERATORS[name]) return null;
  if (texCache.has(name)) return texCache.get(name);
  const [c, ctx] = canvas(128);
  GENERATORS[name](ctx, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const k = 1 / (TILE[name] || 4);
  t.repeat.set(k, k);
  texCache.set(name, t);
  return t;
}

function surfaceTexture(type) {
  const key = 'surface:' + type;
  if (texCache.has(key)) return texCache.get(key);
  const [c, ctx] = canvas(64);
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 64, 64);
  if (type === 'Studs') {
    // Round stud with highlight (top-left) and shadow (bottom-right)
    const g = ctx.createRadialGradient(26, 26, 4, 32, 32, 22);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e2e2e2'); g.addColorStop(1, '#9d9d9d');
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.arc(35, 35, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, 32, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, 32, 16, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
  } else if (type === 'Inlet') {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(32, 32, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath(); ctx.arc(34, 34, 15, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'Universal') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(16, 16, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function trussTexture() {
  if (texCache.has('truss')) return texCache.get('truss');
  const [c, ctx] = canvas(64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 64, 8); ctx.fillRect(0, 56, 64, 8); ctx.fillRect(0, 0, 8, 64); ctx.fillRect(56, 0, 8, 64);
  ctx.save(); ctx.translate(32, 32); ctx.rotate(Math.PI / 4); ctx.fillRect(-45, -4, 90, 8); ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.5, 0.5);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set('truss', t);
  return t;
}

export function spawnTexture() {
  if (texCache.has('spawn')) return texCache.get('spawn');
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(64, 64, 42, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.translate(64, 64); ctx.rotate(Math.PI / 12);
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-20, -20, 40, 40);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set('spawn', t);
  return t;
}

// Returns a (cached) material for a part face.
export function getMaterial({ material = 'Plastic', color = '#a3a2a5', transparency = 0, reflectance = 0, surface = 'Smooth', special = null }) {
  const key = [material, color, transparency, reflectance, surface, special].join('|');
  let m = matCache.get(key);
  if (m) return m;
  const col = new THREE.Color(color);
  const props = PROPS[material] || PROPS.Plastic;
  const opts = {
    color: col,
    roughness: Math.max(0.05, (props.roughness ?? 0.7) - reflectance * 0.6),
    metalness: Math.min(1, (props.metalness ?? 0) + reflectance * 0.5),
    transparent: transparency > 0,
    opacity: 1 - transparency,
    depthWrite: transparency < 0.5,
  };
  if (special === 'spawn') opts.map = spawnTexture();
  else if (special === 'truss') { opts.map = trussTexture(); opts.alphaTest = 0.5; opts.side = THREE.DoubleSide; }
  else if (surface && surface !== 'Smooth' && (material === 'Plastic' || material === 'SmoothPlastic')) opts.map = surfaceTexture(surface);
  else opts.map = materialTexture(material);
  if (material === 'Neon') {
    m = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.25), transparent: transparency > 0, opacity: 1 - transparency });
    m.toneMapped = false;
  } else if (material === 'Glass') {
    m = new THREE.MeshPhysicalMaterial({
      ...opts, map: null, transparent: true, opacity: Math.min(0.85, Math.max(0.25, 1 - transparency) * 0.6), roughness: 0.05, clearcoat: 1, depthWrite: false,
    });
  } else if (material === 'ForceField') {
    m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 * (1 - transparency), blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false });
  } else {
    m = new THREE.MeshStandardMaterial(opts);
  }
  matCache.set(key, m);
  return m;
}
