// Robis server: website + REST API + WebSocket game servers.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Database } from './db.js';
import { userFromRequest, clientInfo, newDeviceCookie, bannedClient } from './auth.js';
import { createApi } from './api.js';
import { GameManager } from './game/manager.js';
import { seed } from './seed/seed.js';
import { handleConnection } from './connection.js';
import { backupConfig, restore, startBackups } from './backup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One bad game script or timer must not take the whole site down: log it and keep going.
process.on('uncaughtException', (e) => console.error('[robis] uncaught error:', e && e.stack || e));
process.on('unhandledRejection', (e) => console.error('[robis] unhandled rejection:', e && e.stack || e));

// The deployed commit (Render sets RENDER_GIT_COMMIT; otherwise read .git).
function buildVersion() {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git/HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head;
    const ref = head.slice(5);
    const file = path.join(ROOT, '.git', ref);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const packed = fs.readFileSync(path.join(ROOT, '.git/packed-refs'), 'utf8');
    return (packed.split('\n').find((l) => l.endsWith(' ' + ref)) || '').split(' ')[0];
  } catch { return ''; }
}

export function createServer({ dataDir = process.env.ROBIS_DATA || path.join(ROOT, 'data'), quiet = false, adminCode } = {}) {
  const db = new Database(dataDir);
  // A logged-in account on a banned device or IP counts as logged out (admins excepted).
  const currentUser = (req, info) => {
    const u = userFromRequest(db, req);
    return u && !u.isAdmin && bannedClient(db, info) ? null : u;
  };
  if (db.isEmpty) seed(db);
  const manager = new GameManager(db);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  // Authenticate every request via the session cookie.
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    req.client = clientInfo(req);
    if (!req.client.device) {
      const d = newDeviceCookie();
      req.client.device = d.id;
      res.append('Set-Cookie', d.cookie);
    }
    req.user = currentUser(req, req.client);
    if (req.user) req.user.lastOnline = Date.now();
    next();
  });

  // Optional admin code: any account that enters it becomes an admin. With a
  // code set (public servers) the first account is no longer made admin.
  const code = adminCode ?? process.env.ROBIS_ADMIN_CODE;
  const adminCodeHash = code ? crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex') : '';
  app.use('/api', createApi(db, manager, { adminCodeHash, firstUserIsAdmin: !adminCodeHash, version: buildVersion() }));
  const staticOpts = { maxAge: 0 };
  app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three'), staticOpts));
  app.use('/vendor/codemirror', express.static(path.join(ROOT, 'node_modules/codemirror'), staticOpts));
  app.use('/shared', express.static(path.join(ROOT, 'shared'), staticOpts));
  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], ...staticOpts }));
  app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public/404.html')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 * 1024 });

  wss.on('connection', (ws, req) => handleConnection(ws, currentUser(req, clientInfo(req)), { db, manager }));

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
  const dataDir = process.env.ROBIS_DATA || path.join(ROOT, 'data');
  const backup = backupConfig();
  if (backup) {
    try { await restore(backup, dataDir); } catch (e) { console.error('[backup] restore failed:', e.message); process.exit(1); }
  }
  const { server, db, close } = createServer({ dataDir });
  const backups = backup ? startBackups(backup, db) : null;
  server.listen(+process.env.PORT || 3000);
  const stop = async () => { await close(); if (backups) await backups.flush(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
