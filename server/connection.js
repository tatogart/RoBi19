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
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
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
          if (!game.isPublic && game.creatorId !== user.id && !user.isAdmin) throw new Error('This game is private.');
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
    if (session && gameServer && !gameServer.closed) gameServer.leave(session);
  });
}
