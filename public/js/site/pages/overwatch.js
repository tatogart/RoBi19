// Robis Overwatch: watch a replay, say if the suspect cheats.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, toast, spinner } from '../ui.js';
import { createViewer } from '../owviewer.js';
import { tr } from '../../i18n.js';

await initPage({ active: 'overwatch' });
const app = document.getElementById('app');
const head = el('div');
const stage = el('div', { class: 'ow-main' });
app.append(head, stage);
let viewer = null;

const TAGS = [['speed', '⚡ Too fast'], ['fly', '🕊 Flying'], ['teleport', '✨ Teleports'], ['walls', '🧱 Through walls'], ['aim', '🎯 Aimbot'], ['other', '❓ Something else']];

async function load() {
  let info;
  try { info = await api.get('/overwatch'); } catch (e) { stage.replaceChildren(el('div', { class: 'empty', text: e.message })); return; }
  if (!info.access) {
    head.replaceChildren(hero());
    stage.replaceChildren(el('div', { class: 'panel empty', text: info.mode === 'off' ? tr('Overwatch is closed right now.') : tr('Overwatch is only for invited investigators. The Robis team picks them - play fair, report cheaters, and maybe you are next!') }));
    return;
  }
  const s = info.stats;
  head.replaceChildren(hero(),
    el('div', { class: 'ow-stats' },
      stat(`${info.perWeek - info.left} / ${info.perWeek}`, tr('cases this week')),
      stat(s.accuracy === null ? '—' : s.accuracy + '%', tr('your accuracy')),
      stat(String(s.correct), tr('correct verdicts')),
      stat(new Date(info.nextWeek).toLocaleDateString(), tr('new cases'))),
    ...(info.lastWeek ? [el('div', { class: 'ow-last' }, tr(`Last week: ${info.lastWeek.correct} of ${info.lastWeek.answered} of your verdicts were right.`))] : []));
  if (!info.left) { stage.replaceChildren(el('div', { class: 'panel empty' }, el('div', { style: { fontSize: '40px' }, text: '🕵️' }), el('b', { text: tr('All cases of this week are judged. Thanks, investigator!') }), el('div', { class: 'muted', text: tr('New cases come every Monday.') }))); return; }
  stage.replaceChildren(el('div', { class: 'ow-intro panel' },
    el('h3', { text: tr('How it works') }),
    el('p', { text: tr('You get a replay of a laser tag game. One player - the SUSPECT, in red - may be cheating. Watch closely (you can slow it down, turn the camera, see through walls) and decide: cheater or fair player?') }),
    el('p', { class: 'small muted', text: tr('Watch at least half of the replay before you decide. Your accuracy is shown after the week ends.') }),
    el('button', { class: 'btn btn-green btn-large', text: tr('▶ Watch a case'), onclick: openCase })));
}
const hero = () => el('div', { class: 'ow-hero' }, el('div', { class: 'ow-logo', text: '🕵️' }), el('div', {}, el('h1', { text: 'Robis Overwatch' }), el('p', { text: tr('Help the Robis team catch cheaters. New cases every week.') })));
const stat = (v, l) => el('div', { class: 'ow-stat' }, el('b', { text: v }), el('span', { text: l }));

async function openCase() {
  stage.replaceChildren(spinner());
  let c;
  try { c = await api.get('/overwatch/case'); } catch (e) { toast(e.message, 'error'); load(); return; }
  if (c.done) { load(); return; }
  if (viewer) viewer.destroy();
  const box = el('div', { class: 'ow-viewer' });
  const tags = new Set();
  const tagBox = el('div', { class: 'ow-tags' }, TAGS.map(([k, t]) => el('button', { class: 'ow-tag', text: tr(t), onclick: (e) => { if (tags.has(k)) tags.delete(k); else tags.add(k); e.target.classList.toggle('on', tags.has(k)); } })));
  const watched = el('div', { class: 'ow-watched' }, el('div', {}));
  const cheat = el('button', { class: 'btn btn-red btn-large', text: tr('🚫 Cheater'), disabled: true });
  const fair = el('button', { class: 'btn btn-green btn-large', text: tr('✅ Fair player'), disabled: true });
  const send = async (verdict) => {
    cheat.disabled = fair.disabled = true;
    try { await api.post(`/overwatch/case/${c.id}`, { verdict, tags: [...tags] }); toast(tr('Verdict saved. Thanks!'), 'success'); if (viewer) { viewer.destroy(); viewer = null; } await load(); openCase(); }
    catch (e) { toast(e.message, 'error'); cheat.disabled = fair.disabled = false; }
  };
  cheat.onclick = () => send('cheater');
  fair.onclick = () => send('fair');
  stage.replaceChildren(el('div', { class: 'ow-case' },
    el('div', { class: 'ow-case-head' }, el('b', { text: tr(`Case ${c.number} of ${c.of}`) }), el('span', { class: 'muted small no-i18n', text: '#' + c.id })),
    box,
    el('div', { class: 'ow-verdict panel' },
      el('b', { text: tr('Was the suspect cheating?') }), watched,
      el('div', { class: 'small muted', text: tr('What did you see? (optional)') }), tagBox,
      el('div', { class: 'row', style: { gap: '10px' } }, cheat, fair))));
  viewer = createViewer(box, c.replay, { onProgress: (p) => {
    watched.firstChild.style.width = Math.round(p * 100) + '%';
    if (p >= 0.5 && cheat.disabled && !watched.dataset.ok) { watched.dataset.ok = '1'; cheat.disabled = fair.disabled = false; }
  } });
}
load();
