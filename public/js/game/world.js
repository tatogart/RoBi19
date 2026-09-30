// Collision world for the local character controller, built from the mirror.
import { BasePart } from '/shared/engine/instances.js';
import { partBox, boxAABB, SpatialGrid, rayVsBox } from '/shared/engine/physics.js';

const WATCH = new Set(['CFrame', 'Size', 'CanCollide', 'Shape']);

export class CollisionWorld {
  constructor(game) {
    this.game = game;
    this.ws = game.GetService('Workspace');
    this.grid = new SpatialGrid(16);
    this.dirty = true;
    this.parts = new Set();
    for (const d of this.ws.GetDescendants()) this._track(d);
    this.unsub = [
      game.on('added', (i) => { if (this._track(i)) this.dirty = true; }),
      game.on('removing', (i) => { if (this.parts.delete(i)) this.dirty = true; }),
      game.on('changed', (i, p) => {
        if (!WATCH.has(p) || !(i instanceof BasePart)) return;
        if (this.parts.has(i) || p === 'CanCollide') { this._track(i); this.dirty = true; }
      }),
    ];
  }

  _isCharacterPart(p) { return p._parent && p._parent._isCharacter; }

  _track(i) {
    if (!(i instanceof BasePart) || !i.IsDescendantOf(this.ws) || this._isCharacterPart(i)) return false;
    if (i._p.CanCollide) { this.parts.add(i); return true; }
    this.parts.delete(i);
    return true;
  }

  rebuild() {
    this.grid.clear();
    for (const p of this.parts) {
      if (p._destroyed || !p._parent) { this.parts.delete(p); continue; }
      const b = partBox(p);
      this.grid.insert(b, boxAABB(b));
    }
    this.dirty = false;
  }

  query(minX, minZ, maxX, maxZ) {
    if (this.dirty) this.rebuild();
    return this.grid.query(minX, minZ, maxX, maxZ);
  }

  // Ray against collidable, mostly opaque parts; returns distance or maxDist.
  raycast(o, d, maxDist) {
    if (this.dirty) this.rebuild();
    let best = maxDist;
    const minX = Math.min(o.x, o.x + d.x * maxDist) - 1, maxX = Math.max(o.x, o.x + d.x * maxDist) + 1;
    const minZ = Math.min(o.z, o.z + d.z * maxDist) - 1, maxZ = Math.max(o.z, o.z + d.z * maxDist) + 1;
    for (const b of this.grid.query(minX, minZ, maxX, maxZ)) {
      if (b.part._p.Transparency > 0.5) continue;
      const t = rayVsBox(b, o.x, o.y, o.z, d.x, d.y, d.z, best);
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }

  dispose() { for (const u of this.unsub) u(); }
}
