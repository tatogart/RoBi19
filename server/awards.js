// Robis Awards (like the Bloxy Awards): the admins prepare a season of
// awards with categories and nominated games, open the voting, and close it.
// Winners get a trophy on their game page. Stages:
//   draft (only admins see it) -> voting -> results.
const DEFAULT_CATEGORIES = [
  ['best', 'Game of the Year', 'The best game on Robis this year.'],
  ['new', 'Best New Game', 'A game that came out this year and stole the show.'],
  ['friends', 'Most Fun with Friends', 'The game you always play with your friends.'],
  ['scary', 'Scariest Game', 'The one that made you jump.'],
  ['obby', 'Best Obby', 'The obby you couldn\'t stop playing.'],
  ['build', 'Best Building', 'The most beautiful place on Robis.'],
];

export function installAwards(api, { db, requireUser, requireAdmin, bad, hooks }) {
  const D = db.data;
  if (!D.awards) D.awards = { seasons: [], next: 1 };
  const A = D.awards;
  const clean = (v, n) => String(v ?? '').trim().slice(0, n);
  const seasonById = (id) => A.seasons.find((s) => s.id === +id);
  // the season players see: voting or results (the newest)
  const live = () => A.seasons.filter((s) => s.status !== 'draft').sort((a, b) => b.id - a.id)[0] || null;
  const gameView = (id) => {
    const g = D.games[id];
    return g ? { id: g.id, name: g.name, updated: g.updated, creator: D.users[g.creatorId]?.username || '' } : null;
  };
  const tally = (c) => {
    const n = {};
    for (const gid of Object.values(c.votes || {})) n[gid] = (n[gid] || 0) + 1;
    return n;
  };
  const winnerOf = (c) => {
    const n = tally(c);
    let best = null;
    for (const gid of c.nominees) if (best === null || (n[gid] || 0) > (n[best] || 0)) best = gid;
    return best;
  };
  hooks.awardsLive = () => { const s = live(); return s ? { id: s.id, title: s.title, status: s.status } : null; };

  // ---------------------------------------------------------------- players
  api.get('/awards', (req, res) => {
    const s = req.query.id ? seasonById(req.query.id) : live();
    if (!s || (s.status === 'draft' && !(req.user && req.user.isAdmin))) return res.json({ season: null, past: A.seasons.filter((x) => x.status === 'results').map((x) => ({ id: x.id, title: x.title })) });
    const uid = req.user ? req.user.id : 0;
    res.json({
      season: {
        id: s.id, title: s.title, status: s.status, intro: s.intro || '', ends: s.ends || 0,
        categories: s.categories.map((c) => {
          const n = tally(c);
          const total = Object.keys(c.votes || {}).length;
          return {
            id: c.id, name: c.name, desc: c.desc, myVote: (c.votes || {})[uid] || 0,
            nominees: c.nominees.map((gid) => ({ ...gameView(gid), votes: s.status === 'results' ? n[gid] || 0 : undefined, share: s.status === 'results' && total ? Math.round(((n[gid] || 0) / total) * 100) : undefined })).filter((x) => x.id),
            winner: s.status === 'results' ? c.winner || 0 : 0,
          };
        }),
      },
      past: A.seasons.filter((x) => x.status === 'results' && x.id !== s.id).map((x) => ({ id: x.id, title: x.title })),
    });
  });
  api.post('/awards/vote', requireUser, (req, res) => {
    const s = live();
    if (!s || s.status !== 'voting') return bad(res, 'Voting is closed right now.');
    const c = s.categories.find((x) => x.id === String(req.body?.category || ''));
    if (!c) return bad(res, 'Category not found', 404);
    const gid = +req.body?.gameId;
    if (!c.nominees.includes(gid)) return bad(res, 'That game is not nominated here.');
    if (!c.votes) c.votes = {};
    c.votes[req.user.id] = gid; // you can change your mind until the end
    db.save();
    res.json({ ok: true });
  });
  // trophies and nominations of one game (for its page)
  api.get('/awards/game/:id', (req, res) => {
    const id = +req.params.id;
    const out = [];
    for (const s of A.seasons) {
      if (s.status === 'draft') continue;
      for (const c of s.categories) {
        if (!c.nominees.includes(id)) continue;
        out.push({ season: s.title, category: c.name, won: s.status === 'results' && c.winner === id, nominated: true, status: s.status });
      }
    }
    res.json({ awards: out });
  });
  // bots vote too (server/bots.js), like any player
  hooks.awardsVote = (uid) => {
    const s = live();
    if (!s || s.status !== 'voting') return;
    for (const c of s.categories) {
      if (!c.nominees.length || (c.votes && c.votes[uid])) continue;
      // popular games get more votes
      const w = c.nominees.map((gid) => Math.sqrt((D.games[gid]?.visits || 0) + 50));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let pick = c.nominees[0];
      for (let i = 0; i < w.length; i++) { if ((r -= w[i]) <= 0) { pick = c.nominees[i]; break; } }
      if (!c.votes) c.votes = {};
      c.votes[uid] = pick;
    }
    db.save();
  };

  // ---------------------------------------------------------------- admin
  const adminView = (s) => ({
    ...s,
    categories: s.categories.map((c) => ({ id: c.id, name: c.name, desc: c.desc, winner: c.winner || 0, votes: Object.keys(c.votes || {}).length, tally: tally(c), nominees: c.nominees.map(gameView).filter(Boolean) })),
  });
  api.get('/admin/awards', requireAdmin, (req, res) => {
    res.json({
      seasons: A.seasons.slice().reverse().map(adminView),
      games: Object.values(D.games).filter((g) => g.isPublic).sort((a, b) => (b.visits || 0) - (a.visits || 0)).map((g) => ({ id: g.id, name: g.name })),
      presets: DEFAULT_CATEGORIES.map(([id, name, desc]) => ({ id, name, desc })),
    });
  });
  api.post('/admin/awards', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.op === 'create') {
      const title = clean(b.title, 60) || `Robis Awards ${new Date().getFullYear()}`;
      const s = { id: A.next++, title, intro: clean(b.intro, 300), status: 'draft', created: Date.now(), categories: DEFAULT_CATEGORIES.map(([id, name, desc]) => ({ id, name, desc, nominees: [], votes: {} })) };
      A.seasons.push(s);
      db.save();
      return res.json({ ok: true, id: s.id });
    }
    const s = seasonById(b.id);
    if (!s) return bad(res, 'Season not found', 404);
    if (b.op === 'edit') {
      if (b.title !== undefined) s.title = clean(b.title, 60) || s.title;
      if (b.intro !== undefined) s.intro = clean(b.intro, 300);
    } else if (b.op === 'addCategory') {
      const name = clean(b.name, 40);
      if (!name) return bad(res, 'Name the category.');
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString(36).slice(-4);
      s.categories.push({ id, name, desc: clean(b.desc, 120), nominees: [], votes: {} });
    } else if (b.op === 'removeCategory') {
      s.categories = s.categories.filter((c) => c.id !== b.category);
    } else if (b.op === 'nominees') {
      const c = s.categories.find((x) => x.id === b.category);
      if (!c) return bad(res, 'Category not found', 404);
      const ids = [...new Set((Array.isArray(b.gameIds) ? b.gameIds : []).map(Number).filter((id) => D.games[id]))].slice(0, 8);
      c.nominees = ids;
      for (const [uid, gid] of Object.entries(c.votes || {})) if (!ids.includes(gid)) delete c.votes[uid];
    } else if (b.op === 'status') {
      if (!['draft', 'voting', 'results'].includes(b.status)) return bad(res, 'Unknown stage.');
      if (b.status !== 'draft' && !s.categories.some((c) => c.nominees.length >= 2)) return bad(res, 'Nominate at least two games in a category first.');
      s.status = b.status;
      if (b.status === 'voting') for (const c of s.categories) c.winner = 0;
      // the votes decide the winners (admins can pick another one after)
      if (b.status === 'results') for (const c of s.categories) c.winner = c.winner || winnerOf(c);
    } else if (b.op === 'winner') {
      const c = s.categories.find((x) => x.id === b.category);
      if (!c || !c.nominees.includes(+b.gameId)) return bad(res, 'Pick one of the nominees.');
      c.winner = +b.gameId;
    } else if (b.op === 'delete') {
      A.seasons = A.seasons.filter((x) => x !== s);
    } else return bad(res, 'Unknown action.');
    db.save();
    res.json({ ok: true });
  });
}
