// Create Item (BETA): players with the Item Creator right design their own
// catalog items. T-shirts and faces are pictures (draw them in the pixel
// editor or upload one), shirts and pants are a pattern with two colours,
// hats, hair and pets are the classic models in your own colours.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, toast, itemCard, spinner } from '../ui.js';
import { itemThumbnail } from '../../render/thumbs.js';
import { BODY_COLORS } from '/shared/avatar.js';

const me = await initPage({ active: 'create' });
const app = document.getElementById('app');
app.append(el('div', { class: 'row' }, el('h1', { style: { margin: 0 }, text: 'Create Item' }), el('span', { class: 'pill beta-pill', text: 'BETA' })));

const opts = await api.get('/create/options');
if (!opts.allowed) {
  app.append(el('div', { class: 'panel' },
    el('h3', { text: 'Item creation is in BETA' }),
    el('p', { text: 'Right now only players with the Item Creator or Limited Creator right can make items. Ask an admin of this Robis to give it to you in the Admin Panel.' })));
  await new Promise(() => {});
}

const TYPE_NAMES = { TShirt: 'T-Shirt', Shirt: 'Shirt', Pants: 'Pants', Face: 'Face', Hat: 'Hat', Hair: 'Hair', Pet: 'Pet' };
const PET_NAMES = { dog: 'Puppy', cat: 'Kitty', bunny: 'Bunny', penguin: 'Penguin', robot: 'Robot', ghost: 'Ghost', dragon: 'Dragon' };
let type = 'TShirt';
const state = { color: '#c4281c', accent: '#f8f8f8', pattern: 'stripes', model: opts.models.Hat[0] };

// ---------------------------------------------------------------- pixel editor
// A tiny paint program for T-shirts (64×64) and faces (64×50, see-through).
const painter = (() => {
  const canvas = el('canvas', { class: 'paint-canvas' });
  const ctx = canvas.getContext('2d');
  let brush = 2, colour = '#111111', erasing = false, down = false;
  const size = (t) => (t === 'Face' ? [64, 50] : [64, 64]);
  function reset(t) {
    const [w, h] = size(t);
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (t === 'Face') { // start from the classic smile
      ctx.fillStyle = '#111';
      ctx.fillRect(22, 14, 4, 8); ctx.fillRect(38, 14, 4, 8);
      for (let x = 20; x <= 44; x++) { const y = 30 + Math.round(Math.sin(((x - 20) / 24) * Math.PI) * 5); ctx.fillRect(x, y, 1, 2); }
    }
  }
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return [Math.floor(((p.clientX - r.left) / r.width) * canvas.width), Math.floor(((p.clientY - r.top) / r.height) * canvas.height)];
  };
  let last = null;
  const stamp = (x, y) => {
    const o = Math.floor(brush / 2);
    if (erasing) ctx.clearRect(x - o, y - o, brush, brush);
    else { ctx.fillStyle = colour; ctx.fillRect(x - o, y - o, brush, brush); }
  };
  // Fill in the pixels between pointer events so fast strokes have no gaps.
  const dot = (e) => {
    const [x, y] = at(e);
    if (last) {
      const n = Math.max(Math.abs(x - last[0]), Math.abs(y - last[1]));
      for (let i = 1; i <= n; i++) stamp(Math.round(last[0] + ((x - last[0]) * i) / n), Math.round(last[1] + ((y - last[1]) * i) / n));
    } else stamp(x, y);
    last = [x, y];
    changed();
  };
  canvas.addEventListener('pointerdown', (e) => { down = true; last = null; canvas.setPointerCapture(e.pointerId); dot(e); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => { if (down) dot(e); });
  canvas.addEventListener('pointerup', () => { down = false; last = null; });
  const swatches = el('div', { class: 'swatches' }, ['#111111', '#ffffff', ...BODY_COLORS.filter((c) => c !== '#111111' && c !== '#f8f8f8')].map((c) => {
    const b = el('button', { class: 'swatch', title: c, style: { background: c }, onclick: () => { colour = c; erasing = false; pick(b); } });
    return b;
  }));
  const pick = (b) => { swatches.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b)); eraser.classList.remove('btn-primary'); };
  const eraser = el('button', { class: 'btn btn-small', text: 'Eraser', onclick: () => { erasing = true; swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); eraser.classList.add('btn-primary'); } });
  const sizes = el('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { brush = +e.target.value; } },
    [[1, 'Small brush'], [2, 'Medium brush'], [4, 'Big brush'], [8, 'Huge brush']].map(([v, t]) => el('option', { value: v, text: t, selected: v === 2 })));
  const file = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = Math.min(canvas.width / img.width, canvas.height / img.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (canvas.width - img.width * k) / 2, (canvas.height - img.height * k) / 2, img.width * k, img.height * k);
      URL.revokeObjectURL(img.src);
      changed();
    };
    img.src = URL.createObjectURL(f);
    e.target.value = '';
  } });
  const tools = el('div', { class: 'row wrap', style: { marginTop: '8px' } },
    sizes, eraser,
    el('button', { class: 'btn btn-small', text: 'Clear', onclick: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); changed(); } }),
    el('button', { class: 'btn btn-small btn-green', text: 'Upload picture', onclick: () => file.click() }), file);
  const root = el('div', { class: 'painter' }, el('div', { class: 'paint-bg' }, canvas), swatches, tools,
    el('div', { class: 'small muted', text: 'Draw with the mouse or your finger, or upload any picture. The grey squares mean see-through.' }));
  return { root, reset, data: () => canvas.toDataURL('image/png') };
})();

// ---------------------------------------------------------------- form
const typeTabs = el('div', { class: 'tabs create-tabs' });
const editor = el('div', { class: 'panel' });
const nameIn = el('input', { class: 'input', maxlength: 50, placeholder: 'Item name' });
const descIn = el('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: 'Description (optional)' });
const priceIn = el('input', { class: 'input', type: 'number', min: 0, max: 100000, value: 10 });
const preview = el('div', { class: 'create-preview' }, spinner());
// Limited Creator right: a fixed stock; when it sells out the item can only be traded.
const limitedIn = el('input', { type: 'checkbox', checked: !!opts.onlyLimiteds, disabled: !!opts.onlyLimiteds });
const stockIn = el('input', { class: 'input', type: 'number', min: 1, max: 100000, value: 100 });
const stockField = el('label', { class: 'field' }, 'Stock (how many can be sold)', stockIn);
const syncLimited = () => stockField.classList.toggle('hidden', !limitedIn.checked);
limitedIn.onchange = syncLimited;
syncLimited();
const colorRow = () => el('div', { class: 'row wrap' },
  el('label', { class: 'field' }, 'Main colour', el('input', { type: 'color', value: state.color, oninput: (e) => { state.color = e.target.value; changed(); } })),
  el('label', { class: 'field' }, 'Second colour', el('input', { type: 'color', value: state.accent, oninput: (e) => { state.accent = e.target.value; changed(); } })));

function drawEditor() {
  typeTabs.replaceChildren(...opts.types.map((t) => el('button', { class: t === type ? 'active' : '', text: TYPE_NAMES[t], onclick: () => { type = t; if (MODELS()[0] && !MODELS().includes(state.model)) state.model = MODELS()[0]; drawEditor(); changed(); } })));
  const parts = [];
  if (type === 'TShirt' || type === 'Face') {
    painter.reset(type);
    parts.push(el('p', { class: 'small muted', text: type === 'Face' ? 'Draw a face. It goes on the front of the head.' : 'Draw a picture. It goes on the front of the torso, over any shirt.' }), painter.root);
  } else if (type === 'Shirt' || type === 'Pants') {
    parts.push(el('label', { class: 'field' }, 'Pattern', el('select', { class: 'input', onchange: (e) => { state.pattern = e.target.value; changed(); } },
      opts.patterns.map((p) => el('option', { value: p, text: p[0].toUpperCase() + p.slice(1), selected: p === state.pattern })))), colorRow());
  } else {
    if (type === 'Pet') parts.push(el('p', { class: 'small muted', text: 'Pick an animal and paint it. Pets follow their owner in every game.' }));
    parts.push(el('label', { class: 'field' }, 'Model', el('select', { class: 'input', onchange: (e) => { state.model = e.target.value; changed(); } },
      MODELS().map((m) => el('option', { value: m, text: (type === 'Pet' && PET_NAMES[m]) || m[0].toUpperCase() + m.slice(1), selected: m === state.model })))), colorRow());
  }
  editor.replaceChildren(...parts);
}
const MODELS = () => opts.models[type] || [];

const itemData = () => {
  if (type === 'TShirt' || type === 'Face') return { image: painter.data() };
  if (type === 'Shirt' || type === 'Pants') return { color: state.color, accent: state.accent, pattern: state.pattern };
  return { model: state.model, color: state.color, accent: state.accent };
};
// What the renderer draws (the server stores the same shape).
const renderData = () => {
  const d = itemData();
  if (type === 'TShirt') return { graphic: 'custom', image: d.image };
  if (type === 'Face') return { face: 'custom', image: d.image };
  return d;
};

let timer = null;
let n = 0;
function changed() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const url = await itemThumbnail({ id: 'preview' + (++n), type, data: renderData() }, 240);
    preview.replaceChildren(el('img', { src: url, alt: '' }));
  }, 250);
}

const create = el('button', { class: 'btn btn-green btn-large', text: 'Create', onclick: async () => {
  create.disabled = true;
  try {
    const { item } = await api.post('/catalog/create', { type, name: nameIn.value, description: descIn.value, price: +priceIn.value, data: itemData(), limited: limitedIn.checked, stock: +stockIn.value });
    toast('Item created!', 'success');
    location.href = `/item?id=${item.id}`;
  } catch (e) { toast(e.message, 'error'); create.disabled = false; }
} });

app.append(
  el('p', { class: 'muted', text: 'Make your own clothes, faces, hats and pets. They go on sale in the Catalog, and you get 70% of every sale.' }),
  typeTabs,
  el('div', { class: 'create-grid' },
    editor,
    el('div', { class: 'panel create-side' },
      el('h3', { text: 'Preview' }), preview,
      el('label', { class: 'field' }, 'Name', nameIn),
      el('label', { class: 'field' }, 'Description', descIn),
      el('label', { class: 'field' }, 'Price (R$)', priceIn),
      opts.limiteds ? el('label', { class: 'perm-row limited-row' }, limitedIn, el('span', { class: 'limited-chip', text: 'LIMITED' }), el('span', { text: 'Make it a Limited' })) : null,
      opts.limiteds ? stockField : null,
      create)));

// ---------------------------------------------------------------- my items
const mine = el('div', { class: 'item-grid' }, spinner());
app.append(el('h2', { style: { marginTop: '24px' }, text: 'My Items' }), mine);
api.get(`/catalog?creator=${me.id}&sort=recent`).then(({ items }) => {
  mine.replaceChildren(...(items.filter((i) => i.custom).length ? items.filter((i) => i.custom).map((i) => itemCard(i)) : [el('div', { class: 'muted', text: 'Nothing here yet.' })]));
});

drawEditor();
changed();

const style = document.createElement('style');
style.textContent = `
.beta-pill { background: #6b327c; color: #fff; }
.create-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 12px 0; }
.create-tabs button { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 8px 14px; cursor: pointer; font-weight: 600; font-family: inherit; }
.create-tabs button.active { background: var(--blue); color: #fff; border-color: var(--blue); }
.create-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.create-grid .panel + .panel { margin-top: 0; }
@media (max-width: 800px) { .create-grid { grid-template-columns: 1fr; } }
.create-preview { aspect-ratio: 1; background: linear-gradient(#f7f7f7, #e4e4e4); border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
html[data-theme="dark"] .create-preview { background: linear-gradient(#4d4f51, #393b3d); }
.create-preview img { width: 100%; }
.create-side .btn-large { width: 100%; margin-top: 8px; }
.paint-bg { background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px; display: inline-block; border: 2px solid var(--border); max-width: 100%; }
.paint-canvas { display: block; width: min(384px, 80vw); image-rendering: pixelated; touch-action: none; cursor: crosshair; }
.swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; max-width: 390px; }
.swatch { width: 24px; height: 24px; border: 2px solid rgba(0,0,0,.2); border-radius: 3px; cursor: pointer; padding: 0; }
.swatch.on { outline: 3px solid var(--blue); }
.field input[type=color] { width: 60px; height: 34px; border: 0; background: none; padding: 0; }
`;
document.head.append(style);
