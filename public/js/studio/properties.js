// Properties panel: typed editors for every property in the class schema.
import { Vector3, Color3, BrickColor, BRICK_COLORS, ENUMS, fmt } from '/shared/engine/types.js';

const CAT_ORDER = ['Data', 'Appearance', 'Behavior', 'Part', 'Surface', 'Game', 'Control', 'World', 'Fog', 'Sky', 'Teams', 'Forcefield', 'Assembly'];

function fmtV3(v) { return `${fmt(v.X)}, ${fmt(v.Y)}, ${fmt(v.Z)}`; }
function parseV3(s) {
  const n = String(s).split(/[\s,]+/).filter(Boolean).map(Number);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x))) return null;
  return new Vector3(n[0], n[1], n[2]);
}
function parseC3(s) {
  const t = String(s).trim();
  if (t.startsWith('#')) return Color3.fromHex(t);
  const n = t.split(/[\s,]+/).filter(Boolean).map(Number);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x))) return null;
  return Color3.fromRGB(n[0], n[1], n[2]);
}

export class Properties {
  constructor(studio, el, filterEl, targetEl) {
    this.studio = studio;
    this.el = el;
    this.filterEl = filterEl;
    this.targetEl = targetEl;
    this.updaters = new Map();
    this.collapsed = new Set();
    this.readOnly = false;
    filterEl.addEventListener('input', () => this.render());
  }

  setTargets(list, readOnly = false) {
    this.targets = list;
    this.readOnly = readOnly;
    this.render();
  }

  // Called when a property of a selected instance changed elsewhere (gizmo, script, undo).
  refreshValues() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      for (const fn of this.updaters.values()) fn();
    });
  }

  apply(prop, value) {
    const list = this.targets.filter((t) => prop in t.constructor.schema || prop === 'Name');
    let err = null;
    for (const t of list) {
      try { t[prop] = value; } catch (e) { err = e; }
    }
    if (err) this.studio.log('error', `Could not set ${prop}: ${err.message}`);
    this.studio.commit(`Set ${prop}`);
    this.refreshValues();
  }

  render() {
    this.updaters.clear();
    const list = this.targets || [];
    this.el.replaceChildren();
    if (!list.length) {
      this.targetEl.textContent = '';
      this.el.append(Object.assign(document.createElement('div'), { className: 'pempty', textContent: 'Select an object to see its properties.' }));
      return;
    }
    const inst = list[0];
    this.targetEl.textContent = list.length > 1 ? `- ${list.length} objects` : `- ${inst.ClassName} "${inst.Name}"`;
    const filter = this.filterEl.value.trim().toLowerCase();
    const schema = inst.constructor.schema;
    const groups = new Map();
    const add = (cat, name, d) => { if (!groups.has(cat)) groups.set(cat, []); groups.get(cat).push([name, d]); };
    add('Data', 'ClassName', { type: 'string', readonly: true, special: true });
    add('Data', 'Name', { type: 'string' });
    add('Data', 'Parent', { type: 'ref', readonly: true, special: true });
    for (const [k, d] of Object.entries(schema)) {
      if (k === 'Name' || d.hidden) continue;
      if (list.some((t) => !(k in t.constructor.schema))) continue;
      add(d.cat || 'Data', k, d);
    }
    const cats = [...groups.keys()].sort((a, b) => (CAT_ORDER.indexOf(a) + 100) % 100 - (CAT_ORDER.indexOf(b) + 100) % 100);
    for (const cat of cats) {
      const props = groups.get(cat).filter(([n]) => !filter || n.toLowerCase().includes(filter));
      if (!props.length) continue;
      const head = document.createElement('div');
      head.className = 'pcat';
      head.textContent = (this.collapsed.has(cat) ? '▶ ' : '▼ ') + cat;
      head.onclick = () => { if (this.collapsed.has(cat)) this.collapsed.delete(cat); else this.collapsed.add(cat); this.render(); };
      this.el.append(head);
      if (this.collapsed.has(cat)) continue;
      for (const [name, d] of props) this.el.append(this.row(inst, name, d));
    }
  }

  row(inst, name, d) {
    const row = document.createElement('div');
    row.className = 'prow';
    const pn = document.createElement('div');
    pn.className = 'pn';
    pn.textContent = name;
    pn.title = name;
    const pv = document.createElement('div');
    pv.className = 'pv';
    row.append(pn, pv);
    const ro = this.readOnly || d.readonly;
    const get = () => inst[name];
    if (ro) {
      row.classList.add('readonly');
      const upd = () => {
        const v = get();
        pv.textContent = v && v.Name !== undefined && typeof v === 'object' ? v.Name : v instanceof Vector3 ? fmtV3(v) : v instanceof Color3 ? v.toRGB().join(', ') : String(v ?? '');
      };
      upd();
      this.updaters.set(name, upd);
      return row;
    }
    const type = d.type;
    if (type === 'bool') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.onchange = () => this.apply(name, cb.checked);
      pv.append(cb);
      this.updaters.set(name, () => { cb.checked = !!get(); });
    } else if (type.startsWith('enum:')) {
      const sel = document.createElement('select');
      for (const v of ENUMS[type.slice(5)]) sel.append(new Option(v, v));
      sel.onchange = () => this.apply(name, sel.value);
      pv.append(sel);
      this.updaters.set(name, () => { sel.value = get(); });
    } else if (type === 'BrickColor') {
      const sel = document.createElement('select');
      for (const e of BRICK_COLORS) sel.append(new Option(e[1], e[1]));
      sel.onchange = () => this.apply(name, BrickColor.new(sel.value));
      pv.append(sel);
      this.updaters.set(name, () => { sel.value = get().Name; });
    } else if (type === 'Color3') {
      const sw = document.createElement('button');
      sw.className = 'swatch-btn';
      const inp = document.createElement('input');
      inp.type = 'text';
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.style.display = 'none';
      sw.onclick = () => picker.click();
      picker.oninput = () => this.apply(name, Color3.fromHex(picker.value));
      inp.onchange = () => { const c = parseC3(inp.value); if (c) this.apply(name, c); else this.refreshValues(); };
      pv.append(sw, inp, picker);
      this.updaters.set(name, () => {
        const c = get();
        sw.style.background = c.toHex();
        picker.value = c.toHex();
        if (document.activeElement !== inp) inp.value = c.toRGB().join(', ');
      });
    } else if (type === 'Vector3') {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.onchange = () => { const v = parseV3(inp.value); if (v) this.apply(name, v); else this.refreshValues(); };
      pv.append(inp);
      this.updaters.set(name, () => { if (document.activeElement !== inp) inp.value = fmtV3(get()); });
    } else if (type === 'number' || type === 'int') {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.onchange = () => {
        const n = Number(inp.value);
        if (!Number.isFinite(n)) { this.refreshValues(); return; }
        let v = type === 'int' ? Math.trunc(n) : n;
        if (d.min !== undefined) v = Math.max(d.min, v);
        if (d.max !== undefined) v = Math.min(d.max, v);
        this.apply(name, v);
      };
      pv.append(inp);
      this.updaters.set(name, () => { if (document.activeElement !== inp) inp.value = fmt(get()); });
    } else if (type === 'ref') {
      const span = document.createElement('span');
      pv.append(span);
      this.updaters.set(name, () => { const v = get(); span.textContent = v ? v.Name : ''; });
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.onchange = () => this.apply(name, inp.value);
      pv.append(inp);
      this.updaters.set(name, () => { if (document.activeElement !== inp) inp.value = get() ?? ''; });
    }
    for (const x of pv.querySelectorAll('input, select')) x.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') x.blur(); });
    this.updaters.get(name)();
    return row;
  }
}
