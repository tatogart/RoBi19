// Client-side replica of the server DataModel, updated from snapshot + ops.
import { DataModel } from '/shared/engine/instances.js';
import { deserialize, setEncodedProp } from '/shared/engine/serialize.js';

export class Mirror {
  constructor() {
    this.game = new DataModel();
    this.lookup = (id) => this.game.getById(id);
  }

  loadSnapshot(services) {
    const game = this.game;
    for (const s of services) {
      let svc;
      try { svc = game.GetService(s.c); } catch { continue; }
      game._byId.delete(svc.id);
      svc.id = s.id;
      game._byId.set(s.id, svc);
    }
    for (const s of services) {
      const svc = game.getById(s.id);
      if (!svc) continue;
      for (const [k, v] of Object.entries(s.p || {})) if (k !== 'Name') setEncodedProp(svc, k, v, this.lookup);
      for (const cd of s.ch || []) {
        const inst = deserialize(cd, { lookup: this.lookup });
        if (inst) inst.Parent = svc;
      }
    }
  }

  apply(op) {
    const game = this.game;
    switch (op[0]) {
      case 'add': {
        const parent = game.getById(op[1]);
        if (!parent || game.getById(op[2].id)) return null;
        const inst = deserialize(op[2], { lookup: this.lookup });
        if (inst) inst.Parent = parent;
        return inst;
      }
      case 'rem': {
        const inst = game.getById(op[1]);
        if (inst && inst._parent) { inst._parentLocked = false; inst.Destroy(); }
        return null;
      }
      case 'set': {
        const inst = game.getById(op[1]);
        if (inst) setEncodedProp(inst, op[2], op[3], this.lookup);
        return inst;
      }
      default:
        return null;
    }
  }
}
