// The Hunt: the event page. Your tokens, the prizes and every game in the event.
import { initPage } from '../layout.js';
import { api } from '../api.js';
import { el, launchGame, spinner, toast } from '../ui.js';
import { gameThumbnail, itemThumbnail } from '../../render/thumbs.js';

await initPage({ active: 'hunt' });
const app = document.getElementById('app');
const box = el('div', {}, spinner());
app.append(box);

const h = await api.get('/hunt');
const fmtWhen = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
// a live countdown text: "2d 4h", "3h 12m", "4m 05s"
const countdown = (t) => {
  const s = Math.max(0, Math.floor((t - Date.now()) / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return d ? `${d}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${mm}m ${String(ss).padStart(2, '0')}s`;
};
const ticking = (t, fmt) => {
  const node = el('span', { class: 'no-i18n', text: fmt(countdown(t)) });
  const iv = setInterval(() => { node.textContent = fmt(countdown(t)); if (t <= Date.now()) clearInterval(iv); }, 1000);
  return node;
};
if (!h.visible) {
  // between events
  box.replaceChildren(el('div', { class: 'hunt-hero relics' },
    el('div', { class: 'hunt-logo', text: 'THE HUNT' }),
    h.ended ? el('p', { class: 'hunt-sub', text: `${h.ended.name} has ended. Thanks to everyone who played! Your prizes stay in your inventory.` }) : null,
    h.next ? el('div', { class: 'hunt-next' }, el('b', { class: 'no-i18n', text: h.next.name }), el('div', {}, 'Starts in ', ticking(h.next.startsAt, (x) => x)))
      : el('p', { text: 'Something is coming... Stay tuned!' })));
} else {
  const quests = h.kind === 'quests';
  const [, sub = ''] = h.name.split(': ');
  const pct = h.total ? Math.round((h.count / h.total) * 100) : 0;
  const teamPct = Math.min(100, Math.round((h.team.shards / h.team.goal) * 100));
  const unitsWord = h.custom ? (quests ? 'quests' : 'finds') : quests ? 'relics' : 'shards';
  const jungle = h.hubStyle === 'relics';
  const hero = el('div', { class: 'hunt-hero' + (jungle ? ' relics' : '') },
    jungle ? el('div', { class: 'hunt-leaf l1' }) : el('div', { class: 'hunt-planet p1' }),
    jungle ? el('div', { class: 'hunt-leaf l2' }) : el('div', { class: 'hunt-planet p2' }),
    !h.public ? el('div', { class: 'hunt-private', text: 'Private preview: only admins can see the event right now' }) : null,
    h.custom ? null : el('div', { class: 'hunt-part', text: quests ? 'PART 3' : 'PART 2' }),
    el('div', { class: 'hunt-logo', text: 'THE HUNT' }),
    el('div', { class: 'hunt-logo2 no-i18n', text: sub.toUpperCase() }),
    h.custom ? el('p', { class: 'hunt-sub no-i18n', text: h.description }) : el('p', { class: 'hunt-sub', text: quests
      ? 'Ancient relics are hidden behind a quest in every game. Beat the obby, win a round, survive the disasters, reach Door 25... Finish a game\'s quest to get its relic!'
      : 'A rift to another dimension has opened! Jump through the wormholes and find the dimension shard hidden in every game. Your scanner shows how close you are.' }),
    el('p', { class: 'hunt-sub small', text: quests
      ? `Every quest gives R$ ${h.robitsPerToken}, and ${h.rewards.length} prizes are waiting along the way.`
      : `Every shard gives R$ ${h.robitsPerToken}, and ${h.rewards.length} prizes are waiting along the way.` }),
    el('div', { class: 'hunt-progress' },
      el('div', { class: 'hunt-bar' }, el('div', { style: { width: pct + '%' } })),
      el('div', { class: 'hunt-count', text: `${h.count} / ${h.total} ${unitsWord}` })),
    h.endsAt ? el('div', { class: 'hunt-ends' }, 'Ends in ', ticking(h.endsAt, (x) => x), el('span', { class: 'muted no-i18n', text: ` (${fmtWhen(h.endsAt)})` })) : null,
    h.hubId ? el('button', { class: 'btn btn-large hunt-play', text: 'Enter the hub', onclick: () => launchGame(h.hubId) }) : null);
  const stats = el('div', { class: 'hunt-stats' },
    el('div', { class: 'hunt-stat' },
      el('b', { text: h.custom ? 'Team goal' : quests ? 'The Great Temple' : 'The Rift' }),
      el('div', { class: 'hunt-bar rift' }, el('div', { style: { width: teamPct + '%' } })),
      el('div', { class: 'small', text: h.team.open
        ? (quests ? `OPEN! ${h.team.shards} quests done by everyone` : `OPEN! ${h.team.shards} shards found by everyone`)
        : (quests ? `${h.team.shards} / ${h.team.goal} quests done by everyone. Open it together for a prize!` : `${h.team.shards} / ${h.team.goal} shards found by everyone. Open it together for a prize!`) })),
    jungle
      ? el('div', { class: 'hunt-stat' },
        el('b', { text: 'Rune puzzle' }),
        el('div', { class: 'hunt-stars' + (h.hubQuestDone ? ' solved' : ''), text: h.hubQuestDone ? '☀ ★ ≈ ☾' : '? ? ? ?' }),
        el('div', { class: 'small', text: h.hubQuestDone ? 'Solved!' : 'Find the 4 clue tablets in the hub, then click the runes in the right order' }))
      : el('div', { class: 'hunt-stat' },
        el('b', { text: 'Star fragments' }),
        el('div', { class: 'hunt-stars' }, Array.from({ length: h.fragments.total }, (_, i) => el('span', { class: i < h.fragments.count ? 'on' : '', text: '★' }))),
        el('div', { class: 'small', text: 'Hidden on asteroids and the moon base in the hub' })),
    el('div', { class: 'hunt-stat' },
      el('b', { text: 'In the hub' }),
      el('div', { class: 'small', text: jungle
        ? 'A jungle camp • the Great Temple • stone archways to every game • the rune puzzle • the relic museum'
        : 'Low gravity • launch pads • a rocket to the moon • meteor showers • ZERO-G button' })));
  const prizes = el('div', { class: 'hunt-prizes' }, h.rewards.map((r) => {
    const img = el('div', { class: 'hunt-prize-img' });
    itemThumbnail({ id: r.id, type: r.type, data: r.data }, 200).then((u) => img.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('a', { class: 'hunt-prize' + (r.got ? ' got' : ''), href: `/item?id=${r.id}` }, img,
      el('b', { text: r.name }),
      r.bonus ? el('div', { class: 'hunt-bonus', text: 'BONUS' }) : null,
      el('div', { class: 'small', text: r.got ? '✓ Unlocked' : r.bonus ? r.how : quests ? `Complete ${r.need} quests` : `Find ${r.need} shards` }));
  }));
  const games = el('div', { class: 'hunt-games' }, h.games.map((g) => {
    const thumb = el('div', { class: 'hunt-thumb' });
    api.get(`/games/${g.id}`).then(({ game }) => gameThumbnail(game, 384)).then((u) => thumb.append(el('img', { src: u, alt: '' }))).catch(() => {});
    return el('div', { class: 'hunt-game' + (g.found ? ' found' : '') },
      thumb,
      g.found ? el('div', { class: 'hunt-found', text: '✓' }) : el('div', { class: 'hunt-mini-token' }),
      el('b', { class: 'no-i18n', text: g.name }),
      el('div', { class: 'small muted' }, g.byPlayer ? el('span', {}, 'By ', el('span', { class: 'no-i18n', text: g.creator })) : el('span', { text: 'Official' })),
      quests ? el('div', { class: 'hunt-quest-text' }, el('b', { text: 'Quest: ' }), el('span', { text: g.quest })) : null,
      el('button', { class: 'btn btn-small ' + (g.found ? '' : 'btn-green'), text: g.found ? 'Play again' : quests ? 'Start the quest' : 'Find the shard', onclick: () => launchGame(g.id) }));
  }));
  box.replaceChildren(hero, stats,
    el('h2', { text: 'Prizes' }), prizes,
    el('h2', { text: quests ? 'Quests' : 'Games' }), h.games.length ? games : el('div', { class: 'empty', text: 'No games in the event yet.' }));
  if (!h.games.length) toast('Add games to The Hunt in the Admin Panel.', 'error');
}

const style = document.createElement('style');
style.textContent = `
.hunt-hero { text-align: center; padding: 38px 20px; border-radius: 10px; color: #fff; background: radial-gradient(ellipse at 50% 10%, #3a1a6b, #0b0a2a 70%); margin-bottom: 16px; position: relative; overflow: hidden; }
.hunt-hero::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(1.5px 1.5px at 10% 20%, #fff, transparent), radial-gradient(1px 1px at 30% 70%, #cfe8ff, transparent), radial-gradient(1.5px 1.5px at 55% 30%, #fff, transparent), radial-gradient(1px 1px at 75% 80%, #e0c8ff, transparent), radial-gradient(1.5px 1.5px at 90% 15%, #fff, transparent), radial-gradient(1px 1px at 45% 90%, #fff, transparent), radial-gradient(1px 1px at 20% 50%, #ffe9c4, transparent), radial-gradient(1.5px 1.5px at 65% 55%, #fff, transparent); background-size: 300px 200px; animation: hunt-stars 60s linear infinite; }
@keyframes hunt-stars { to { background-position: 300px 200px; } }
.hunt-hero > * { position: relative; }
.hunt-planet { position: absolute !important; border-radius: 50%; }
.hunt-planet.p1 { width: 160px; height: 160px; left: -40px; bottom: -50px; background: radial-gradient(circle at 35% 35%, #c08bff, #6b3fa0 55%, #2a1050); box-shadow: 0 0 40px rgba(180,92,255,.5); }
.hunt-planet.p2 { width: 60px; height: 60px; right: 40px; top: 30px; background: radial-gradient(circle at 35% 35%, #ffd0b0, #c4501c 60%, #5a1a0a); }
.hunt-part { display: inline-block; font-weight: 900; letter-spacing: 4px; font-size: 12px; color: #7df9ff; border: 1px solid #7df9ff; padding: 2px 10px; border-radius: 10px; margin-bottom: 6px; }
.hunt-logo { font-size: 56px; font-weight: 900; letter-spacing: 6px; color: #ffc400; text-shadow: 0 3px 0 #a36b00, 0 0 30px rgba(255,196,0,.5); line-height: 1; }
.hunt-logo2 { font-size: 26px; font-weight: 900; letter-spacing: 8px; margin-top: 6px; background: linear-gradient(90deg, #7df9ff, #b45cff, #ff4d8d); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 10px rgba(180,92,255,.6)); }
.hunt-sub { max-width: 580px; margin: 10px auto 16px; color: #e6dcff; }
.hunt-private { display: inline-block; background: #d0021b; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
.hunt-progress { max-width: 420px; margin: 0 auto; }
.hunt-bar { height: 14px; border-radius: 7px; background: rgba(255,255,255,.15); overflow: hidden; }
.hunt-bar div { height: 100%; background: linear-gradient(90deg, #7df9ff, #b45cff); border-radius: 7px; box-shadow: 0 0 10px #b45cff; }
.hunt-bar.rift { background: rgba(127,127,127,.25); margin: 8px 0 6px; }
.hunt-bar.rift div { background: linear-gradient(90deg, #ff4d8d, #b45cff); }
.hunt-count { margin-top: 6px; font-weight: 700; font-size: 18px; }
.hunt-play { margin-top: 18px; background: linear-gradient(90deg, #7df9ff, #b45cff); color: #0b0a2a; font-weight: 800; border: 0; }
.hunt-play:hover { filter: brightness(1.1); }
.hunt-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 18px; }
.hunt-stat { background: var(--panel); border-radius: 8px; padding: 12px 14px; border-left: 4px solid #b45cff; }
.hunt-stars { font-size: 24px; letter-spacing: 4px; margin: 4px 0; color: rgba(127,127,127,.4); }
.hunt-stars .on { color: #ffd84d; text-shadow: 0 0 8px #ffc400; }
.hunt-prizes { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.hunt-prize { background: var(--panel); border-radius: 8px; padding: 12px; text-align: center; color: inherit; text-decoration: none; border: 2px solid transparent; position: relative; }
.hunt-prize.got { border-color: #02b757; }
.hunt-bonus { position: absolute; top: 8px; left: 8px; background: #00b8d4; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; }
.hunt-prize-img { aspect-ratio: 1; background: radial-gradient(circle at 50% 40%, #3a2a6b, #14102e); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.hunt-prize-img img { width: 100%; }
.hunt-games { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.hunt-game { background: var(--panel); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; position: relative; }
.hunt-game.found { outline: 2px solid #b45cff; }
.hunt-thumb { aspect-ratio: 16 / 10; background: #d4d4d4; border-radius: 4px; overflow: hidden; }
.hunt-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hunt-found, .hunt-mini-token { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: 900; transform: rotate(45deg); border-radius: 5px; }
.hunt-found > *, .hunt-found { color: #fff; }
.hunt-found { background: linear-gradient(135deg, #f3dcff, #b45cff 50%, #4a1a9c); box-shadow: 0 0 10px #b45cff; }
.hunt-mini-token { background: rgba(0,0,0,.45); border: 2px dashed #b45cff; }
.hunt-hero.relics { background: radial-gradient(ellipse at 50% 0%, #6b8a3a, #1f3318 75%); }
.hunt-hero.relics::before { background-image: repeating-linear-gradient(115deg, rgba(255,201,74,.06) 0 12px, transparent 12px 40px); animation: none; }
.hunt-hero.relics .hunt-logo2 { background: linear-gradient(90deg, #ffd27a, #5bd6a0, #ffc94a); -webkit-background-clip: text; background-clip: text; }
.hunt-hero.relics .hunt-part { color: #ffd27a; border-color: #ffd27a; }
.hunt-hero.relics .hunt-bar div { background: linear-gradient(90deg, #5bd6a0, #ffc94a); box-shadow: 0 0 10px #c8a165; }
.hunt-hero.relics .hunt-play { background: linear-gradient(90deg, #ffd27a, #5bd6a0); }
.hunt-leaf { position: absolute !important; width: 220px; height: 90px; border-radius: 0 100% 0 100%; background: linear-gradient(135deg, #3d6b2a, #2a4a1c); opacity: .8; }
.hunt-leaf.l1 { left: -40px; bottom: 10px; transform: rotate(-20deg); }
.hunt-leaf.l2 { right: -50px; top: 20px; transform: rotate(160deg); }
.hunt-ends { margin-top: 12px; font-weight: 700; color: #ffe9b0; }
.hunt-next { margin: 14px auto 0; display: inline-block; padding: 10px 18px; border-radius: 10px; background: rgba(0,0,0,.3); font-size: 18px; }
.hunt-quest-text { font-size: 13px; background: rgba(200,161,101,.15); border-left: 3px solid #c8a165; padding: 5px 7px; border-radius: 0 5px 5px 0; }
.hunt-stars.solved { color: #ffd84d; text-shadow: 0 0 8px #ffc400; }
@media (max-width: 600px) { .hunt-logo { font-size: 40px; } .hunt-logo2 { font-size: 17px; letter-spacing: 4px; } }
`;
document.head.append(style);
