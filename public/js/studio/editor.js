// Script editor tabs (CodeMirror 5 with Lua highlighting and Robis globals autocomplete-lite).
import { classIcon, CLASS_ICONS } from './icons.js';

const ROBIS_GLOBALS = ['game', 'workspace', 'script', 'wait', 'spawn', 'delay', 'tick', 'time', 'print', 'warn', 'Instance', 'Vector3', 'CFrame',
  'Color3', 'BrickColor', 'Enum', 'TweenInfo', 'UDim2', 'Random', 'typeof', 'require', 'shared'];

export class ScriptEditor {
  constructor(studio, tabsEl, areaEl, viewportEl) {
    this.studio = studio;
    this.tabsEl = tabsEl;
    this.areaEl = areaEl;
    this.viewportEl = viewportEl;
    this.docs = []; // {script, host, cm, tab}
    this.active = null; // null = the place (3D view)
    this.placeTab = this.makeTab(CLASS_ICONS.game, 'Place', null);
    this.renderTabs();
  }

  makeTab(icon, label, doc) {
    const t = document.createElement('div');
    t.className = 'doc-tab';
    t.innerHTML = `<span class="ic">${icon}</span><span class="lbl"></span>`;
    t.querySelector('.lbl').textContent = label;
    t.onclick = () => this.activate(doc);
    if (doc) {
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '×';
      x.title = 'Close';
      x.onclick = (e) => { e.stopPropagation(); this.close(doc); };
      t.append(x);
    }
    return t;
  }

  setPlaceName(name) { this.placeTab.querySelector('.lbl').textContent = name; }

  renderTabs() {
    this.tabsEl.replaceChildren(this.placeTab, ...this.docs.map((d) => d.tab));
    this.placeTab.classList.toggle('active', this.active === null);
    for (const d of this.docs) {
      d.tab.classList.toggle('active', this.active === d);
      d.tab.querySelector('.lbl').textContent = d.script.Name;
    }
  }

  open(script) {
    let doc = this.docs.find((d) => d.script === script);
    if (!doc) {
      const host = document.createElement('div');
      host.className = 'editor-host';
      this.areaEl.append(host);
      const cm = window.CodeMirror(host, {
        value: script.Source || '',
        mode: 'lua',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        extraKeys: {
          'Ctrl-/': 'toggleComment',
          'Cmd-/': 'toggleComment',
          'Ctrl-S': () => this.studio.publish(),
          'Cmd-S': () => this.studio.publish(),
          F5: () => this.studio.play(),
        },
      });
      let timer = null;
      cm.on('change', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (script.Source !== cm.getValue()) { script.Source = cm.getValue(); this.studio.commit('Edit Script'); }
        }, 500);
      });
      doc = { script, host, cm, tab: null };
      doc.tab = this.makeTab(classIcon(script.constructor), script.Name, doc);
      this.docs.push(doc);
      this.watch(doc);
    }
    this.activate(doc);
  }

  watch(doc) {
    const off = this.studio.game.on('removing', (i) => { if (i === doc.script) this.close(doc); });
    const off2 = this.studio.game.on('changed', (i, p) => {
      if (i !== doc.script) return;
      if (p === 'Name') this.renderTabs();
      if (p === 'Source' && doc.cm.getValue() !== i.Source) doc.cm.setValue(i.Source || '');
    });
    doc.unwatch = () => { off(); off2(); };
  }

  activate(doc) {
    this.active = doc;
    this.viewportEl.style.visibility = doc ? 'hidden' : 'visible';
    for (const d of this.docs) d.host.style.display = d === doc ? 'block' : 'none';
    if (doc) { doc.cm.refresh(); doc.cm.focus(); }
    this.renderTabs();
  }

  close(doc) {
    const i = this.docs.indexOf(doc);
    if (i < 0) return;
    if (doc.script.Source !== doc.cm.getValue() && !doc.script._destroyed) { doc.script.Source = doc.cm.getValue(); this.studio.commit('Edit Script'); }
    doc.unwatch && doc.unwatch();
    doc.host.remove();
    this.docs.splice(i, 1);
    if (this.active === doc) this.activate(this.docs[i] || this.docs[i - 1] || null);
    else this.renderTabs();
  }

  closeAll() { for (const d of [...this.docs]) this.close(d); }

  // Re-bind open editors after undo/redo replaced the instances.
  rebind() {
    for (const d of [...this.docs]) {
      const s = this.studio.game.getById(d.script.id);
      if (!s) { this.close(d); continue; }
      d.unwatch && d.unwatch();
      d.script = s;
      if (d.cm.getValue() !== s.Source) d.cm.setValue(s.Source || '');
      this.watch(d);
    }
    this.renderTabs();
  }

  flush() {
    for (const d of this.docs) if (d.script.Source !== d.cm.getValue()) d.script.Source = d.cm.getValue();
  }

  get globals() { return ROBIS_GLOBALS; }
}
