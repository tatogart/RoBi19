// Builds Three.js meshes for BaseParts (blocks, balls, cylinders, wedges, trusses).
import * as THREE from 'three';
import { getMaterial } from './materials.js';

const geoCache = new Map();

// Box with UVs measured in studs so textures tile at a constant size.
function boxGeometry(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z; 4 verts each
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  }
  return g;
}

function ballGeometry(sx, sy, sz) {
  const d = Math.min(sx, sy, sz);
  const g = new THREE.SphereGeometry(d / 2, 28, 18);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * d, uv.getY(i) * Math.PI * d / 2);
  return g;
}

function cylinderGeometry(sx, sy, sz) {
  const r = Math.min(sy, sz) / 2;
  const g = new THREE.CylinderGeometry(r, r, sx, 28, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * sx);
  g.rotateZ(-Math.PI / 2); // Roblox cylinders run along X
  return g;
}

// Wedge: bottom face full, back face (+Z) full height, slope rises from front (-Z) to back.
function wedgeGeometry(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const P = {
    fbl: [-x, -y, -z], fbr: [x, -y, -z], bbl: [-x, -y, z], bbr: [x, -y, z],
    btl: [-x, y, z], btr: [x, y, z],
  };
  const pos = [], uvs = [];
  const slopeLen = Math.hypot(sy, sz);
  const quad = (a, b, c, d, w, h) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uvs.push(0, 0, w, 0, w, h, 0, 0, w, h, 0, h);
  };
  const tri = (a, b, c, uva, uvb, uvc) => { pos.push(...a, ...b, ...c); uvs.push(...uva, ...uvb, ...uvc); };
  quad(P.fbl, P.bbl, P.bbr, P.fbr, sz, sx); // bottom (facing -y)
  quad(P.bbr, P.bbl, P.btl, P.btr, sx, sy); // back (+z)
  quad(P.fbl, P.fbr, P.btr, P.btl, sx, slopeLen); // slope
  tri(P.fbr, P.bbr, P.btr, [0, 0], [sz, 0], [sz, sy]); // right side (+x)
  tri(P.bbl, P.fbl, P.btl, [0, 0], [sz, 0], [0, sy]); // left side (-x)
  fixWinding(pos, uvs, [0, -y / 3, z / 3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

// Makes every triangle face away from an interior point (so normals point outwards).
function fixWinding(pos, uvs, center) {
  for (let t = 0; t < pos.length; t += 9) {
    const a = pos.slice(t, t + 3), b = pos.slice(t + 3, t + 6), c = pos.slice(t + 6, t + 9);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [(a[0] + b[0] + c[0]) / 3 - center[0], (a[1] + b[1] + c[1]) / 3 - center[1], (a[2] + b[2] + c[2]) / 3 - center[2]];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) {
      for (let k = 0; k < 3; k++) { const tmp = pos[t + 3 + k]; pos[t + 3 + k] = pos[t + 6 + k]; pos[t + 6 + k] = tmp; }
      if (uvs) {
        const ti = (t / 9) * 6;
        for (let k = 0; k < 2; k++) { const tmp = uvs[ti + 2 + k]; uvs[ti + 2 + k] = uvs[ti + 4 + k]; uvs[ti + 4 + k] = tmp; }
      }
    }
  }
}

function cornerWedgeGeometry(sx, sy, sz) {
  // Pyramid-like corner wedge: apex above the (+x, -z) corner.
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const a = [x, y, -z];
  const b0 = [-x, -y, -z], b1 = [x, -y, -z], b2 = [x, -y, z], b3 = [-x, -y, z];
  const pos = [...b0, ...b2, ...b1, ...b0, ...b3, ...b2, ...b1, ...b2, ...a, ...b0, ...b1, ...a, ...b2, ...b3, ...a, ...b3, ...b0, ...a];
  fixWinding(pos, null, [x / 2, -y / 2, -z / 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uvs = [];
  for (let i = 0; i < pos.length / 3; i++) uvs.push(pos[i * 3] + pos[i * 3 + 2], pos[i * 3 + 1] + pos[i * 3 + 2]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function partGeometry(inst) {
  const s = inst._p.Size;
  const cls = inst.ClassName;
  const shape = cls === 'WedgePart' ? 'Wedge' : cls === 'CornerWedgePart' ? 'Corner' : (inst._p.Shape || 'Block');
  const key = `${shape}:${s.X.toFixed(3)},${s.Y.toFixed(3)},${s.Z.toFixed(3)}`;
  let g = geoCache.get(key);
  if (g) return g;
  if (shape === 'Ball') g = ballGeometry(s.X, s.Y, s.Z);
  else if (shape === 'Cylinder') g = cylinderGeometry(s.X, s.Y, s.Z);
  else if (shape === 'Wedge') g = wedgeGeometry(s.X, s.Y, s.Z);
  else if (shape === 'Corner') g = cornerWedgeGeometry(s.X, s.Y, s.Z);
  else g = boxGeometry(s.X, s.Y, s.Z);
  g.userData.shape = shape;
  if (geoCache.size > 3000) geoCache.clear();
  geoCache.set(key, g);
  return g;
}

export function partMaterials(inst, geometry) {
  const p = inst._p;
  const base = {
    material: p.Material, color: '#' + colorHex(p.Color), transparency: p.Transparency, reflectance: p.Reflectance,
  };
  if (inst.ClassName === 'TrussPart') return getMaterial({ ...base, special: 'truss' });
  const shape = geometry.userData.shape;
  if (shape !== 'Block') return getMaterial(base);
  const side = getMaterial(base);
  const top = inst.ClassName === 'SpawnLocation'
    ? getMaterial({ ...base, special: 'spawn' })
    : getMaterial({ ...base, surface: p.TopSurface });
  const bottom = getMaterial({ ...base, surface: p.BottomSurface });
  return [side, side, top, bottom, side, side];
}

function colorHex(c) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return h(c.R) + h(c.G) + h(c.B);
}

const _m = new THREE.Matrix4();
export function applyCFrame(obj, cf) {
  const r = cf.r;
  _m.set(r[0], r[1], r[2], cf.x, r[3], r[4], r[5], cf.y, r[6], r[7], r[8], cf.z, 0, 0, 0, 1);
  _m.decompose(obj.position, obj.quaternion, obj.scale);
  obj.scale.set(1, 1, 1);
}

export function createPartMesh(inst) {
  const geo = partGeometry(inst);
  const mesh = new THREE.Mesh(geo, partMaterials(inst, geo));
  mesh.castShadow = inst._p.CastShadow !== false && inst._p.Transparency < 0.9;
  mesh.receiveShadow = true;
  mesh.userData.inst = inst;
  mesh.visible = inst._p.Transparency < 1;
  applyCFrame(mesh, inst._p.CFrame);
  return mesh;
}

export function updatePartMesh(mesh, inst, prop) {
  if (prop === 'CFrame') { applyCFrame(mesh, inst._p.CFrame); return; }
  if (prop === 'Size' || prop === 'Shape') {
    mesh.geometry = partGeometry(inst);
    mesh.material = partMaterials(inst, mesh.geometry);
    return;
  }
  if (['Color', 'Material', 'Transparency', 'Reflectance', 'TopSurface', 'BottomSurface'].includes(prop)) {
    mesh.material = partMaterials(inst, mesh.geometry);
    mesh.visible = inst._p.Transparency < 1;
    mesh.castShadow = inst._p.CastShadow !== false && inst._p.Transparency < 0.9;
  }
  if (prop === 'CastShadow') mesh.castShadow = inst._p.CastShadow !== false;
}
