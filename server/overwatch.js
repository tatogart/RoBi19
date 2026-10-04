// Robis Overwatch (like in CS): players with access watch replays of bots and
// say whether the suspect cheats. New cases every week (Monday); the answers
// and every investigator's accuracy are in Admin Panel -> Overwatch, where the
// admins also choose who may take part.
import { makeCase, hashSeed, OW_KINDS, OW_KIND_NAMES, OW_SECONDS } from '../shared/overwatch.js';

const WEEK = 7 * 86400e3;
const MONDAY = Date.UTC(2024, 0, 1); // a Monday
const weekNo = (t = Date.now()) => Math.floor((t - MONDAY) / WEEK);
const PER_WEEK = 10;

export function installOverwatch(api, { db, requireUser, requireAdmin, bad, hooks, log }) {
  const D = db.data;
  if (!D.overwatch) D.overwatch = { mode: 'chosen', access: [], salt: 0, answers: [] };
  const O = D.overwatch;
  const hasAccess = (u) => !!u && !u.system && (u.isAdmin || O.mode === 'everyone' || (O.mode === 'chosen' && O.access.includes(u.id)));
  hooks.overwatchAccess = hasAccess;

  // This week's cases: ids and what they really are (never sent to players).
  const casesFor = (week, salt = O.salt) => {
    const R = hashSeed('ow', week, salt);
    const kinds = ['fair', 'fair', 'fair', 'fair', ...OW_KINDS, OW_KINDS[R % OW_KINDS.length]];
    // shuffle with the week's seed
    let s = R;
    for (let i = kinds.length - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    return kinds.slice(0, PER_WEEK).map((kind, i) => ({ id: `${week}.${salt}.${i}`, week, kind, seed: hashSeed('case', week, salt, i) }));
  };
  const caseById = (id) => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(id || ''));
    if (!m) return null;
    return casesFor(+m[1], +m[2])[+m[3]] || null;
  };
  const cache = new Map();
  const replay = (c) => {
    if (!cache.has(c.id)) { cache.set(c.id, makeCase(c.seed, c.kind)); if (cache.size > 40) cache.delete(cache.keys().next().value); }
    return cache.get(c.id);
  };
  const truthOf = (c) => (c.kind === 'fair' ? 'fair' : 'cheater');
  const opened = new Map(); // `${uid}:${caseId}` -> when the replay was sent (to stop instant answers)

  const stats = (uid) => {
    const mine = O.answers.filter((a) => a.uid === uid);
    const thisWeek = weekNo();
    const done = mine.filter((a) => a.week < thisWeek); // results only show after the week
    const correct = done.filter((a) => a.correct).length;
    return { answered: mine.length, thisWeek: mine.filter((a) => a.week === thisWeek && a.salt === O.salt).length, judged: done.length, correct, accuracy: done.length ? Math.round((correct / done.length) * 100) : null };
  };

  api.get('/overwatch', requireUser, (req, res) => {
    const u = req.user;
    if (!hasAccess(u)) return res.json({ access: false, mode: O.mode });
    const week = weekNo();
    const st = stats(u.id);
    u.owCorrect = st.correct; // for the Robis Badge
    const answered = new Set(O.answers.filter((a) => a.uid === u.id).map((a) => a.caseId));
    const cases = casesFor(week);
    const last = O.answers.filter((a) => a.uid === u.id && a.week === week - 1);
    res.json({
      access: true, week, perWeek: PER_WEEK, left: cases.filter((c) => !answered.has(c.id)).length,
      nextWeek: MONDAY + (week + 1) * WEEK, stats: st,
      lastWeek: last.length ? { answered: last.length, correct: last.filter((a) => a.correct).length } : null,
    });
  });
  // A case to watch: a random one this player hasn't answered yet.
  api.get('/overwatch/case', requireUser, (req, res) => {
    const u = req.user;
    if (!hasAccess(u)) return bad(res, 'You don\'t have access to Overwatch.', 403);
    const answered = new Set(O.answers.filter((a) => a.uid === u.id).map((a) => a.caseId));
    const left = casesFor(weekNo()).filter((c) => !answered.has(c.id));
    if (!left.length) return res.json({ done: true });
    const c = left[Math.floor(Math.random() * left.length)];
    opened.set(`${u.id}:${c.id}`, Date.now());
    res.json({ id: c.id, number: PER_WEEK - left.length + 1, of: PER_WEEK, replay: replay(c) });
  });
  const TAGS = ['speed', 'fly', 'teleport', 'walls', 'aim', 'other'];
  api.post('/overwatch/case/:id', requireUser, (req, res) => {
    const u = req.user;
    if (!hasAccess(u)) return bad(res, 'You don\'t have access to Overwatch.', 403);
    const c = caseById(req.params.id);
    if (!c || c.week !== weekNo()) return bad(res, 'This case is closed. Watch a new one!', 404);
    if (O.answers.some((a) => a.uid === u.id && a.caseId === c.id)) return bad(res, 'You already judged this case.');
    const verdict = req.body?.verdict === 'cheater' ? 'cheater' : req.body?.verdict === 'fair' ? 'fair' : '';
    if (!verdict) return bad(res, 'Cheater or fair?');
    const at = opened.get(`${u.id}:${c.id}`);
    if (!at || Date.now() - at < (OW_SECONDS * 1000) / 5) return bad(res, 'Watch the replay first!');
    const tags = (Array.isArray(req.body?.tags) ? req.body.tags : []).filter((t) => TAGS.includes(t)).slice(0, 6);
    O.answers.push({ uid: u.id, caseId: c.id, week: c.week, salt: +c.id.split('.')[1], verdict, tags, correct: verdict === truthOf(c), t: Date.now() });
    if (O.answers.length > 20000) O.answers.splice(0, 5000);
    db.save();
    res.json({ ok: true, stats: stats(u.id) });
  });

  // ---------------------------------------------------------------- admin
  const userOf = (v) => {
    const s = String(v || '').trim();
    return /^\d+$/.test(s) ? D.users[+s] : Object.values(D.users).find((x) => x.username.toLowerCase() === s.toLowerCase());
  };
  api.get('/admin/overwatch', requireAdmin, (req, res) => {
    const week = weekNo();
    const cases = casesFor(week).map((c) => {
      const a = O.answers.filter((x) => x.caseId === c.id);
      const r = replay(c);
      return { id: c.id, kind: c.kind, kindName: OW_KIND_NAMES[c.kind], suspect: r.bots[r.suspect].name, votes: { cheater: a.filter((x) => x.verdict === 'cheater').length, fair: a.filter((x) => x.verdict === 'fair').length }, correct: a.length ? Math.round((a.filter((x) => x.correct).length / a.length) * 100) : null };
    });
    const by = new Map();
    for (const a of O.answers) {
      const e = by.get(a.uid) || { uid: a.uid, answered: 0, correct: 0, thisWeek: 0, last: 0 };
      e.answered++; if (a.correct) e.correct++; if (a.week === week) e.thisWeek++; e.last = Math.max(e.last, a.t);
      by.set(a.uid, e);
    }
    res.json({
      mode: O.mode, week, nextWeek: MONDAY + (week + 1) * WEEK,
      access: O.access.map((id) => ({ id, username: D.users[id]?.username || '?' })),
      cases,
      investigators: [...by.values()].map((e) => ({ ...e, username: D.users[e.uid]?.username || '?', accuracy: Math.round((e.correct / e.answered) * 100), hasAccess: hasAccess(D.users[e.uid]) })).sort((a, b) => b.answered - a.answered).slice(0, 100),
      recent: O.answers.slice(-40).reverse().map((a) => { const c = caseById(a.caseId); return { ...a, username: D.users[a.uid]?.username || '?', kind: c ? c.kind : '?' }; }),
      total: O.answers.length,
    });
  });
  // the replay of a case, for the admins (with the truth)
  api.get('/admin/overwatch/case/:id', requireAdmin, (req, res) => {
    const c = caseById(req.params.id);
    if (!c) return bad(res, 'Case not found', 404);
    res.json({ id: c.id, kind: c.kind, kindName: OW_KIND_NAMES[c.kind], replay: replay(c) });
  });
  api.post('/admin/overwatch', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'mode') {
      if (!['off', 'chosen', 'everyone'].includes(b.mode)) return bad(res, 'Unknown mode.');
      O.mode = b.mode;
    } else if (b.op === 'add' || b.op === 'remove') {
      const u = userOf(b.user);
      if (!u || u.system) return bad(res, 'Player not found.', 404);
      if (b.op === 'add' && !O.access.includes(u.id)) O.access.push(u.id);
      if (b.op === 'remove') O.access = O.access.filter((x) => x !== u.id);
    } else if (b.op === 'refresh') {
      O.salt = (O.salt || 0) + 1; // new cases right now (answers to the old ones are kept)
    } else return bad(res, 'Unknown action.');
    db.save();
    res.json({ ok: true });
  });
}
