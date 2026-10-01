// One player's game connection. `ws` is anything with send(string), close(),
// readyState and on('message' | 'close') — a real WebSocket on the Node server,
// or an in-memory socket in the standalone (phone) build.
export function handleConnection(ws, user, { db, manager }) {
  if (!user) {
    ws.send(JSON.stringify({ t: 'error', msg: 'You must be logged in to play.' }));
    ws.close();
    return;
  }
  let session = null;
  let gameServer = null;
  let team = null; // Team Create room membership
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (team || (!session && msg.t === 'tc.join')) { teamCreate(ws, user, msg, db, (t) => { team = t; }, team); return; }
    if (!session) {
      if (msg.t !== 'join') return;
      try {
        const avatar = user.remoteAvatar || manager.resolveAvatar(user);
        if (msg.test) {
          gameServer = manager.createTestServer(msg.test, user, +msg.placeId || 0);
        } else {
          const gameId = +msg.placeId;
          const game = db.data.games[gameId];
          if (!game) throw new Error('This game is unavailable.');
          if (!game.isPublic && game.creatorId !== user.id && !user.isAdmin && !(game.collaborators || []).includes(user.id)) throw new Error('This game is private.');
          gameServer = manager.serverForGame(gameId, msg.serverId);
          game.visits++;
          user.recentGames = [gameId, ...(user.recentGames || []).filter((g) => g !== gameId)].slice(0, 20);
          db.save();
        }
        session = gameServer.join(ws, user, avatar);
      } catch (e) {
        ws.send(JSON.stringify({ t: 'error', msg: e.message }));
        ws.close();
      }
      return;
    }
    if (gameServer.closed) return;
    try { gameServer.handle(session, msg); } catch (e) { gameServer.log('error', 'Internal: ' + e.message); }
  });
  ws.on('close', () => {
    if (team) leaveTeam(team);
    if (session && gameServer && !gameServer.closed) gameServer.leave(session);
  });
}

// ---------------------------------------------------------------- Team Create
// People editing the same place in Studio share their changes live. The server
// only relays: each Studio applies the others' edits (see shared/engine/placediff.js).
const rooms = new Map(); // gameId -> Set of { ws, user, id }
let memberId = 0;

export function canEditPlace(game, user) {
  return !!game && !!user && (user.id === game.creatorId || !!user.isAdmin || (game.collaborators || []).includes(user.id));
}

function roomUsers(room) { return [...room].map((m) => ({ id: m.user.id, name: m.user.username, member: m.id })); }
function sendTo(m, msg) { try { if (m.ws.readyState === 1) m.ws.send(JSON.stringify(msg)); } catch { /* closed */ } }
function presence(gameId) {
  const room = rooms.get(gameId);
  if (!room) return;
  const users = roomUsers(room);
  for (const m of room) sendTo(m, { t: 'tc.presence', users });
}

function leaveTeam(team) {
  const room = rooms.get(team.gameId);
  if (!room) return;
  room.delete(team);
  if (!room.size) rooms.delete(team.gameId); else presence(team.gameId);
}

function teamCreate(ws, user, msg, db, setTeam, team) {
  if (msg.t === 'tc.join') {
    if (team) leaveTeam(team);
    const gameId = +msg.gameId;
    const game = db.data.games[gameId];
    if (!canEditPlace(game, user)) { ws.send(JSON.stringify({ t: 'tc.error', msg: 'You can\'t edit this place.' })); return; }
    const room = rooms.get(gameId) || new Set();
    rooms.set(gameId, room);
    const me = { ws, user, gameId, id: ++memberId };
    const others = [...room];
    room.add(me);
    setTeam(me);
    sendTo(me, { t: 'tc.welcome', member: me.id, users: roomUsers(room) });
    // Ask someone already editing for the latest (maybe unpublished) version.
    if (others.length) sendTo(others[0], { t: 'tc.need', for: me.id });
    presence(gameId);
    return;
  }
  if (!team) return;
  const room = rooms.get(team.gameId);
  if (!room) return;
  if (msg.t === 'tc.ops' && Array.isArray(msg.ops)) {
    const out = { t: 'tc.ops', ops: msg.ops, from: user.username };
    for (const m of room) if (m !== team) sendTo(m, out);
  } else if (msg.t === 'tc.snapshot' && msg.place) {
    const target = [...room].find((m) => m.id === msg.for);
    if (target) sendTo(target, { t: 'tc.snapshot', place: msg.place, from: user.username });
  } else if (msg.t === 'tc.chat') {
    const text = String(msg.text || '').slice(0, 200).trim();
    if (text) for (const m of room) sendTo(m, { t: 'tc.chat', from: user.username, text });
  } else if (msg.t === 'tc.leave') {
    leaveTeam(team);
    setTeam(null);
  }
}
