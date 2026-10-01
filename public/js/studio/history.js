// Undo/redo for Studio. Each step stores the *changes* it made (as place-diff
// ops), so undo only reverts your own change even when teammates are editing
// the same place (Team Create).
import { savePlace } from '/shared/engine/serialize.js';
import { diffPlaces, applyOps } from '/shared/engine/placediff.js';

export class History {
  constructor(studio, limit = 80) {
    this.studio = studio;
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.current = null;
    this.currentStr = '';
  }

  snapshot() { return savePlace(this.studio.game); }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
    this.current = this.snapshot();
    this.currentStr = JSON.stringify(this.current);
    this.studio.dirty = false;
  }

  commit(label = 'Change') {
    const snap = this.snapshot();
    const str = JSON.stringify(snap);
    if (str === this.currentStr) return;
    const prev = this.current || snap;
    const fwd = diffPlaces(prev, snap);
    const inv = diffPlaces(snap, prev);
    this.undoStack.push({ label, fwd, inv });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.current = snap;
    this.currentStr = str;
    this.redoStack = [];
    this.studio.dirty = true;
    this.studio.emit('history');
    this.studio.onLocalOps?.(fwd);
  }

  // Someone else's change arrived: take it as the new baseline (not undoable here).
  accept() {
    this.current = this.snapshot();
    this.currentStr = JSON.stringify(this.current);
  }

  _apply(ops) {
    const s = this.studio;
    const selIds = s.selection.map((i) => i.id);
    s.suspendEvents = true;
    applyOps(s.game, ops);
    s.suspendEvents = false;
    this.accept();
    s.setSelection(selIds.map((id) => s.game.getById(id)).filter(Boolean));
    s.emit('tree');
    s.emit('history');
    s.dirty = true;
    s.onLocalOps?.(ops);
  }

  undo() {
    const e = this.undoStack.pop();
    if (!e) return false;
    this.redoStack.push(e);
    this._apply(e.inv);
    this.studio.status(`Undo: ${e.label}`);
    return true;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.undoStack.push(e);
    this._apply(e.fwd);
    this.studio.status(`Redo: ${e.label}`);
    return true;
  }
}
