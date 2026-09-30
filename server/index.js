// Robis server: website + REST API + WebSocket game servers.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Database } from './db.js';
import { userFromRequest } from './auth.js';
import { createApi } from './api.js';
import { GameManager } from './game/manager.js';
import { seed } from './seed/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createServer({ dataDir = process.env.ROBIS_DATA || path.join(ROOT, 'data'), quiet = false } = {}) {
  const db = new Database(dataDir);
  if (db.isEmpty) seed(db);
  const manager = new GameManager(db);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  // Authenticate every request via the session cookie.
  app.use((req, res, next) => {
    req.user = userFromRequest(db, req);
    if (req.user) req.user.lastOnline = Date.now();
    next();
  });

  app.use('/api', createApi(db, manager));
  const staticOpts = { maxAge: 0 };
  app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three'), staticOpts));
  app.use('/vendor/codemirror', express.static(path.join(ROOT, 'node_modules/codemirror'), staticOpts));
  app.use('/shared', express.static(path.join(ROOT, 'shared'), staticOpts));
  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], ...staticOpts }));
  app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public/404.html')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 * 1024 });

  wss.on('connection', (ws, req) => {
    const user = userFromRequest(db, req);
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
          const avatar = manager.resolveAvatar(user);
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
  });

  const close = () => new Promise((resolve) => {
    manager.shutdown();
    db.flush();
    wss.close();
    server.close(() => resolve());
  });
  if (!quiet) server.on('listening', () => {
    const a = server.address();
    console.log(`\n  ROBIS is running!  →  http://localhost:${a.port}`);
    // Addresses a phone on the same Wi-Fi can open.
    const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
    for (const i of lan) console.log(`  On your phone (same Wi-Fi)  →  http://${i.address}:${a.port}`);
    console.log('');
  });
  return { app, server, db, manager, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, close } = createServer();
  server.listen(+process.env.PORT || 3000);
  const stop = async () => { await close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
