// Explorer panel: the instance tree with selection, rename, drag & drop and context menu.
import { TREE_SERVICES } from '/shared/engine/instances.js';
import { classIcon } from './icons.js';

export class Explorer {
  constructor(studio, el, filterEl) {
    this.studio = studio;
    this.el = el;
    this.filterEl = filterEl;
    this.expanded = new Set();
    this.rows = new Map(); // inst id -> row element
    this.pending = false;
    this.game = null;
    this.readOnly = false;
    this.anchor = null;
    filterEl.addEventListener('input', () => this.refresh());
    el.addEventListener('keydown', (e) => this.onKey(e));
    el.addEventListener('contextmenu', (e) => { if (e.target === el) { e.preventDefault(); } });
  }

  setGame(game, readOnly = false) {
    if (this.unsub) this.unsub.forEach((u) => u());
    this.game = game;
    this.readOnly = readOnly;
    this.expanded = new Set([game.GetService('Workspace').id]);
    const schedule = () => this.refresh();
    this.unsub = [
      game.on('added', schedule),
      game.on('removing', schedule),
      game.on('changed', (i, p) => { if (p === 'Name' || p === 'Disabled') schedule(); }),
    ];
    this.refresh();
  }

  refresh() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(); });
  }

  expandTo(inst) {
    for (let a = inst._parent; a && a !== this.game; a = a._parent) this.expanded.add(a.id);
  }

  render() {
    if (!this.game) return;
    const filter = this.filterEl.value.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    this.rows.clear();
    const sel = new Set(this.studio.selectionFor(this.game).map((i) => i.id));
    const matches = (inst) => inst.Name.toLowerCase().includes(filter) || inst.ClassName.toLowerCase().includes(filter);
    const visit = (inst, depth) => {
      const kids = inst.GetChildren().filter((c) => !filter || matches(c) || c.GetDescendants().some(matches));
      if (filter && !matches(inst) && !kids.length) return;
      const row = this.row(inst, depth, kids.length > 0, sel.has(inst.id));
      frag.append(row);
      if (kids.length && (this.expanded.has(inst.id) || filter)) {
        const sorted = inst.ClassName === 'DataModel' ? kids : kids;
        for (const c of sorted) visit(c, depth + 1);
      }
    };
    for (const name of TREE_SERVICES) {
      const s = this.game.FindService(name);
      if (s) visit(s, 0);
    }
    this.el.replaceChildren(frag);
  }

  row(inst, depth, hasKids, selected) {
    const row = document.createElement('div');
    row.className = 'enode' + (selected ? ' sel' : '');
    row.style.paddingLeft = depth * 14 + 2 + 'px';
    const tw = document.createElement('span');
    tw.className = 'tw';
    tw.textContent = hasKids ? (this.expanded.has(inst.id) ? '▼' : '▶') : '';
    // Toggle on mousedown: the row's own mousedown (selection) re-renders the
    // tree, so a 'click' would land on an element that no longer exists.
    tw.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !hasKids) return;
      e.stopPropagation();
      e.preventDefault();
      if (this.expanded.has(inst.id)) this.expanded.delete(inst.id); else this.expanded.add(inst.id);
      this.render();
    });
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.innerHTML = classIcon(inst.constructor);
    const nm = document.createElement('span');
    nm.className = 'nm' + (inst._p.Disabled ? ' disabled' : '');
    nm.textContent = inst.Name;
    row.append(tw, ic, nm);
    row.title = inst.ClassName;
    this.rows.set(inst.id, row);

    row.addEventListener('mousedown', (e) => {
      if (e.button === 2) { if (!this.studio.isSelected(inst)) this.studio.setSelection([inst]); return; }
      this.el.focus();
      if (e.shiftKey && this.anchor) this.selectRange(this.anchor, inst);
      else if (e.ctrlKey || e.metaKey) this.studio.toggleSelection(inst);
      else { this.studio.setSelection([inst]); this.anchor = inst; }
    });
    row.addEventListener('dblclick', () => {
      if (inst.IsA('BaseScript') || inst.ClassName === 'ModuleScript') this.studio.openScript(inst);
      else if (inst.IsA('BasePart') || inst.ClassName === 'Model') this.studio.viewport.focusSelection();
    });
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.studio.contextMenu(e.clientX, e.clientY, inst); });
    if (!this.readOnly && !inst.constructor.service) {
      row.draggable = true;
      row.addEventListener('dragstart', (e) => {
        if (!this.studio.isSelected(inst)) this.studio.setSelection([inst]);
        e.dataTransfer.setData('text/plain', inst.id);
        e.dataTransfer.effectAllowed = 'move';
      });
    }
    if (!this.readOnly) {
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drop'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop');
        this.studio.reparent(this.studio.selection, inst);
      });
    }
    return row;
  }

  selectRange(a, b) {
    const ids = [...this.rows.keys()];
    const i = ids.indexOf(a.id), j = ids.indexOf(b.id);
    if (i < 0 || j < 0) return;
    const [lo, hi] = i < j ? [i, j] : [j, i];
    this.studio.setSelection(ids.slice(lo, hi + 1).map((id) => this.game.getById(id)).filter((x) => x && !x.constructor.service));
  }

  rename(inst) {
    if (this.readOnly || inst.constructor.service) return;
    this.expandTo(inst);
    this.render();
    const row = this.rows.get(inst.id);
    if (!row) return;
    const nm = row.querySelector('.nm');
    const input = document.createElement('input');
    input.value = inst.Name;
    nm.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (ok && input.value.trim() && input.value !== inst.Name) {
        inst.Name = input.value.trim().slice(0, 100);
        this.studio.commit('Rename');
      }
      this.render();
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
  }

  scrollTo(inst) {
    this.expandTo(inst);
    this.render();
    const row = this.rows.get(inst.id);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  onKey(e) {
    const s = this.studio;
    if (e.key === 'F2' && s.selection[0]) { e.preventDefault(); this.rename(s.selection[0]); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && s.selection[0]) {
      e.preventDefault();
      const ids = [...this.rows.keys()];
      const i = ids.indexOf(s.selection[0].id);
      const n = ids[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (n) s.setSelection([this.game.getById(n)]);
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && s.selection[0]) {
      e.preventDefault();
      if (e.key === 'ArrowRight') this.expanded.add(s.selection[0].id); else this.expanded.delete(s.selection[0].id);
      this.render();
    }
  }
}
