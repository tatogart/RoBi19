// Snapshot-based undo/redo for Studio (whole-place snapshots, ids preserved).
import { savePlace, loadPlace, clearPlace } from '/shared/engine/serialize.js';

export class History {
  constructor(studio, limit = 60) {
    this.studio = studio;
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.current = null;
  }

  snapshot() { return JSON.stringify(savePlace(this.studio.game)); }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
    this.current = this.snapshot();
    this.studio.dirty = false;
  }

  commit(label = 'Change') {
    const snap = this.snapshot();
    if (snap === this.current) return;
    if (this.current) this.undoStack.push({ snap: this.current, label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.current = snap;
    this.redoStack = [];
    this.studio.dirty = true;
    this.studio.emit('history');
  }

  restore(snap) {
    const s = this.studio;
    const selIds = s.selection.map((i) => i.id);
    s.suspendEvents = true;
    clearPlace(s.game);
    loadPlace(s.game, JSON.parse(snap), { keepIds: true });
    s.suspendEvents = false;
    this.current = snap;
    s.setSelection(selIds.map((id) => s.game.getById(id)).filter(Boolean));
    s.emit('tree');
    s.emit('history');
    s.dirty = true;
  }

  undo() {
    const e = this.undoStack.pop();
    if (!e) return false;
    this.redoStack.push({ snap: this.current, label: e.label });
    this.restore(e.snap);
    this.studio.status(`Undo: ${e.label}`);
    return true;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.undoStack.push({ snap: this.current, label: e.label });
    this.restore(e.snap);
    this.studio.status(`Redo: ${e.label}`);
    return true;
  }
}
